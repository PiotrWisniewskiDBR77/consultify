import dns from 'node:dns/promises';
import net from 'node:net';

/**
 * ssrfGuard — defensive guard for server-side outbound fetches of user-supplied
 * URLs (e.g. /api/link-preview bookmark resolution).
 *
 * Without this, an attacker can point the fetcher at internal infrastructure or
 * the cloud metadata endpoint (169.254.169.254 → instance credentials). The
 * guard: allows only http/https, DNS-resolves the host and rejects any address
 * in a private/loopback/link-local/reserved range, and re-validates every
 * redirect hop (so an external URL that 3xx-redirects inward is still blocked).
 */

export class SsrfBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SsrfBlockedError';
  }
}

/** True when an IPv4/IPv6 literal falls in a private/reserved/loopback range. */
export function isBlockedIp(ip: string): boolean {
  const kind = net.isIP(ip);
  if (kind === 4) return isBlockedIpv4(ip);
  if (kind === 6) return isBlockedIpv6(ip.toLowerCase());
  // Not a bare IP literal — caller resolves DNS first.
  return false;
}

function isBlockedIpv4(ip: string): boolean {
  const parts = ip.split('.').map((p) => Number(p));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return true; // malformed → block
  }
  const [a, b] = parts;
  if (a === 0) return true; // 0.0.0.0/8 "this network"
  if (a === 10) return true; // private
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local incl. 169.254.169.254 metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // private
  if (a === 192 && b === 168) return true; // private
  if (a === 192 && b === 0) return true; // 192.0.0.0/24 IETF protocol assignments
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
  if (a === 198 && (b === 18 || b === 19)) return true; // 198.18.0.0/15 benchmarking
  if (a >= 224) return true; // 224.0.0.0/4 multicast + 240.0.0.0/4 reserved + broadcast
  return false;
}

function isBlockedIpv6(ip: string): boolean {
  if (ip === '::1' || ip === '::') return true; // loopback / unspecified
  if (ip.startsWith('fe80') || ip.startsWith('fe9') || ip.startsWith('fea') || ip.startsWith('feb'))
    return true; // fe80::/10 link-local
  if (ip.startsWith('fc') || ip.startsWith('fd')) return true; // fc00::/7 unique-local
  // IPv4-mapped (::ffff:a.b.c.d) — validate the embedded IPv4.
  const mapped = ip.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isBlockedIpv4(mapped[1]);
  return false;
}

/**
 * Parse + validate a user URL: only http(s), and every DNS-resolved address must
 * be public. Throws SsrfBlockedError otherwise. Returns the parsed URL.
 */
export async function assertUrlIsSafe(rawUrl: string): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new SsrfBlockedError('Malformed URL');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new SsrfBlockedError('Only http(s) URLs are allowed');
  }
  const hostname = parsed.hostname.replace(/^\[|\]$/g, ''); // strip IPv6 brackets

  // If the host is a bare IP literal, validate it directly (no DNS).
  if (net.isIP(hostname)) {
    if (isBlockedIp(hostname)) throw new SsrfBlockedError('URL resolves to a blocked address');
    return parsed;
  }

  // Otherwise resolve and validate every address the host maps to.
  let addresses: { address: string }[];
  try {
    addresses = await dns.lookup(hostname, { all: true });
  } catch {
    throw new SsrfBlockedError('DNS resolution failed');
  }
  if (addresses.length === 0) throw new SsrfBlockedError('No addresses for host');
  for (const { address } of addresses) {
    if (isBlockedIp(address)) throw new SsrfBlockedError('URL resolves to a blocked address');
  }
  return parsed;
}

export interface SafeFetchOptions {
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
  userAgent?: string;
}

/**
 * Fetch the HTML body of a user URL with SSRF protection. Follows redirects
 * manually, re-validating each hop's target so an allowed URL cannot bounce into
 * private space. Caps body size and total time. Returns { finalUrl, html }.
 */
export async function safeFetchHtml(
  rawUrl: string,
  opts: SafeFetchOptions = {}
): Promise<{ finalUrl: string; html: string }> {
  const { timeoutMs = 5000, maxBytes = 1_000_000, maxRedirects = 4, userAgent = 'Consultify-LinkPreview/1.0' } = opts;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let current = rawUrl;
    for (let hop = 0; hop <= maxRedirects; hop++) {
      const safeUrl = await assertUrlIsSafe(current);
      const resp = await fetch(safeUrl.toString(), {
        signal: controller.signal,
        redirect: 'manual',
        headers: { 'User-Agent': userAgent, Accept: 'text/html,application/xhtml+xml' },
      });
      // Manual redirect handling: re-validate the next hop.
      if (resp.status >= 300 && resp.status < 400) {
        const location = resp.headers.get('location');
        if (!location) throw new SsrfBlockedError('Redirect without location');
        current = new URL(location, safeUrl).toString();
        continue;
      }
      if (!resp.ok) throw new SsrfBlockedError(`Upstream responded ${resp.status}`);

      // Read the body with a hard byte cap.
      const reader = resp.body?.getReader();
      if (!reader) return { finalUrl: safeUrl.toString(), html: '' };
      const chunks: Uint8Array[] = [];
      let total = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          total += value.byteLength;
          if (total > maxBytes) {
            await reader.cancel().catch(() => undefined);
            break;
          }
          chunks.push(value);
        }
      }
      const html = Buffer.concat(chunks.map((c) => Buffer.from(c))).toString('utf8');
      return { finalUrl: safeUrl.toString(), html };
    }
    throw new SsrfBlockedError('Too many redirects');
  } finally {
    clearTimeout(timer);
  }
}
