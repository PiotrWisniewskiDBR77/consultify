/**
 * NetworkBuffer
 *
 * Ring-buffer of recent HTTP requests made from the app. We only keep a
 * compact summary (method, url, status, durationMs, errorCode). Request
 * and response bodies are NOT captured (PII + size + complexity).
 *
 * The buffer is the backbone of "why did this bug happen" investigation
 * because most real bugs end with either a 4xx, 5xx or a client timeout.
 */

export interface NetworkEntry {
  at: string;
  method: string;
  url: string;
  status: number | null;
  durationMs: number | null;
  ok: boolean;
  error?: string;
  kind: 'fetch' | 'xhr';
}

const MAX_ENTRIES = 40;
const MAX_URL_LEN = 500;

const ring: NetworkEntry[] = [];
let installed = false;

function push(entry: NetworkEntry): void {
  if (ring.length >= MAX_ENTRIES) ring.shift();
  ring.push(entry);
}

function normaliseUrl(input: RequestInfo | URL | string): string {
  try {
    if (typeof input === 'string') return input.slice(0, MAX_URL_LEN);
    if (input instanceof URL) return input.toString().slice(0, MAX_URL_LEN);
    if (typeof (input as Request).url === 'string') {
      return (input as Request).url.slice(0, MAX_URL_LEN);
    }
  } catch {
    // ignore
  }
  return '[unknown]';
}

function normaliseMethod(init: RequestInit | undefined, input: RequestInfo | URL | string): string {
  const fromInit = init?.method;
  if (fromInit) return String(fromInit).toUpperCase();
  try {
    if (typeof input === 'object' && input && 'method' in input) {
      const m = (input as Request).method;
      if (m) return String(m).toUpperCase();
    }
  } catch {
    // ignore
  }
  return 'GET';
}

export function installNetworkBuffer(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  if (typeof window.fetch === 'function') {
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const startedAt = Date.now();
      const method = normaliseMethod(init, input);
      const url = normaliseUrl(input);
      try {
        const response = await originalFetch(input as RequestInfo, init);
        push({
          at: new Date(startedAt).toISOString(),
          method,
          url,
          status: response.status,
          durationMs: Date.now() - startedAt,
          ok: response.ok,
          kind: 'fetch',
        });
        return response;
      } catch (err) {
        push({
          at: new Date(startedAt).toISOString(),
          method,
          url,
          status: null,
          durationMs: Date.now() - startedAt,
          ok: false,
          error: err instanceof Error ? err.message : String(err),
          kind: 'fetch',
        });
        throw err;
      }
    };
  }

  if (typeof XMLHttpRequest !== 'undefined') {
    const proto = XMLHttpRequest.prototype as any;
    const originalOpen = proto.open;
    const originalSend = proto.send;
    proto.open = function patchedOpen(method: string, url: string, ...rest: unknown[]) {
      try {
        this.__fb_method__ = method ? method.toUpperCase() : 'GET';
        this.__fb_url__ = typeof url === 'string' ? url.slice(0, MAX_URL_LEN) : '[unknown]';
      } catch {
        // ignore
      }
      return originalOpen.apply(this, [method, url, ...rest]);
    };
    proto.send = function patchedSend(...args: unknown[]) {
      const startedAt = Date.now();
      const onDone = () => {
        try {
          push({
            at: new Date(startedAt).toISOString(),
            method: this.__fb_method__ || 'GET',
            url: this.__fb_url__ || '[unknown]',
            status: typeof this.status === 'number' ? this.status : null,
            durationMs: Date.now() - startedAt,
            ok: this.status >= 200 && this.status < 400,
            kind: 'xhr',
          });
        } catch {
          // ignore
        }
      };
      this.addEventListener?.('loadend', onDone);
      this.addEventListener?.('error', () => {
        push({
          at: new Date(startedAt).toISOString(),
          method: this.__fb_method__ || 'GET',
          url: this.__fb_url__ || '[unknown]',
          status: null,
          durationMs: Date.now() - startedAt,
          ok: false,
          error: 'network error',
          kind: 'xhr',
        });
      });
      return originalSend.apply(this, args as []);
    };
  }
}

export function snapshotNetworkBuffer(limit = MAX_ENTRIES): NetworkEntry[] {
  const start = Math.max(0, ring.length - limit);
  return ring.slice(start).map((entry) => ({ ...entry }));
}

export function snapshotNetworkErrors(limit = 20): NetworkEntry[] {
  return ring
    .filter((entry) => !entry.ok || (entry.status != null && entry.status >= 400))
    .slice(-limit)
    .map((entry) => ({ ...entry }));
}

export function clearNetworkBuffer(): void {
  ring.length = 0;
}
