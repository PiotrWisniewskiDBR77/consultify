import dns from 'node:dns';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';

/**
 * ssrfGuard — defensive guard for server-side outbound fetches of user-supplied
 * URLs (e.g. /api/link-preview bookmark resolution).
 *
 * Without this, an attacker can point the fetcher at internal infrastructure or
 * the cloud metadata endpoint (169.254.169.254 → instance credentials). The
 * guard allows only http/https and validates the *actual connecting address*:
 * a custom DNS `lookup` runs at TCP-connect time and rejects any address in a
 * private/loopback/link-local/reserved range. Doing the check at connect time
 * (instead of "resolve then fetch") closes the DNS-rebinding TOCTOU — the
 * address that is validated is exactly the one connected to. Redirects are
 * followed manually so every hop is re-validated; body size and total time are
 * capped.
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
  if (kind === 6) return isBlockedIpv6(ip);
  // Not a bare IP literal — caller resolves DNS first.
  return false;
}

function isBlockedIpv4(ip: string): boolean {
  const parts = ip.split('.').map((p) => Number(p));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return true; // malformed → block
  }
  const [a, b, c] = parts;
  if (a === 0) return true; // 0.0.0.0/8 "this network"
  if (a === 10) return true; // private
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local incl. 169.254.169.254 metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // private
  if (a === 192 && b === 168) return true; // private
  if (a === 192 && b === 0 && c === 0) return true; // 192.0.0.0/24 IETF protocol assignments
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
  if (a === 198 && (b === 18 || b === 19)) return true; // 198.18.0.0/15 benchmarking
  if (a >= 224) return true; // 224.0.0.0/4 multicast + 240.0.0.0/4 reserved + broadcast
  return false;
}

/**
 * Expand any valid IPv6 string (compressed, with optional dotted-quad tail) to
 * its 16 bytes. Returns null on malformed input.
 */
function ipv6ToBytes(input: string): number[] | null {
  let ip = input.toLowerCase();
  // A trailing dotted-quad (e.g. ::ffff:127.0.0.1) → fold into two hex groups.
  const lastColon = ip.lastIndexOf(':');
  const tail = ip.slice(lastColon + 1);
  if (tail.includes('.')) {
    const v4 = tail.split('.').map((n) => Number(n));
    if (v4.length !== 4 || v4.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null;
    const hi = ((v4[0] << 8) | v4[1]).toString(16);
    const lo = ((v4[2] << 8) | v4[3]).toString(16);
    ip = ip.slice(0, lastColon + 1) + hi + ':' + lo;
  }
  const halves = ip.split('::');
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(':') : [];
  const back = halves.length === 2 ? (halves[1] ? halves[1].split(':') : []) : [];
  let groups: string[];
  if (halves.length === 2) {
    const missing = 8 - head.length - back.length;
    if (missing < 0) return null;
    groups = [...head, ...Array(missing).fill('0'), ...back];
  } else {
    groups = head;
  }
  if (groups.length !== 8) return null;
  const bytes: number[] = [];
  for (const g of groups) {
    if (!/^[0-9a-f]{1,4}$/.test(g)) return null;
    const v = parseInt(g, 16);
    bytes.push((v >> 8) & 0xff, v & 0xff);
  }
  return bytes;
}

function isBlockedIpv6(ip: string): boolean {
  const b = ipv6ToBytes(ip);
  if (!b) return true; // unparseable → block
  // Loopback ::1 and unspecified ::
  if (b.every((x, i) => (i === 15 ? x === 1 : x === 0))) return true;
  if (b.every((x) => x === 0)) return true;
  // Unique-local fc00::/7
  if ((b[0] & 0xfe) === 0xfc) return true;
  // Link-local fe80::/10
  if (b[0] === 0xfe && (b[1] & 0xc0) === 0x80) return true;
  // IPv4-mapped ::ffff:0:0/96 → validate the embedded IPv4
  if (b.slice(0, 10).every((x) => x === 0) && b[10] === 0xff && b[11] === 0xff) {
    return isBlockedIpv4(`${b[12]}.${b[13]}.${b[14]}.${b[15]}`);
  }
  // IPv4-compatible ::a.b.c.d (deprecated) — validate embedded
  if (b.slice(0, 12).every((x) => x === 0) && (b[12] || b[13] || b[14] || b[15])) {
    return isBlockedIpv4(`${b[12]}.${b[13]}.${b[14]}.${b[15]}`);
  }
  // NAT64 64:ff9b::/96 → embedded IPv4 in last 4 bytes
  if (
    b[0] === 0x00 &&
    b[1] === 0x64 &&
    b[2] === 0xff &&
    b[3] === 0x9b &&
    b.slice(4, 12).every((x) => x === 0)
  ) {
    return isBlockedIpv4(`${b[12]}.${b[13]}.${b[14]}.${b[15]}`);
  }
  // 6to4 2002::/16 → embedded IPv4 in bytes 2..5
  if (b[0] === 0x20 && b[1] === 0x02) {
    return isBlockedIpv4(`${b[2]}.${b[3]}.${b[4]}.${b[5]}`);
  }
  // Teredo 2001:0000::/32 and documentation 2001:db8::/32 → block conservatively
  if (b[0] === 0x20 && b[1] === 0x01 && b[2] === 0x00 && b[3] === 0x00) return true;
  if (b[0] === 0x20 && b[1] === 0x01 && b[2] === 0x0d && b[3] === 0xb8) return true;
  return false;
}

/**
 * Parse + validate a user URL: only http(s); if the host is a bare IP literal it
 * must be public. Domain hosts are validated at connect time by safeFetchHtml's
 * lookup (which is what actually closes the rebinding window). Returns the URL.
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
  if (net.isIP(hostname)) {
    if (isBlockedIp(hostname)) throw new SsrfBlockedError('URL resolves to a blocked address');
    return parsed;
  }
  // Fail-fast pre-check for domains (authoritative check is the connect lookup).
  let addresses: dns.LookupAddress[];
  try {
    addresses = await dns.promises.lookup(hostname, { all: true });
  } catch {
    throw new SsrfBlockedError('DNS resolution failed');
  }
  if (addresses.length === 0) throw new SsrfBlockedError('No addresses for host');
  for (const { address } of addresses) {
    if (isBlockedIp(address)) throw new SsrfBlockedError('URL resolves to a blocked address');
  }
  return parsed;
}

/**
 * Resolve a host to a single PUBLIC address (or throw). Bare-IP literals are
 * validated directly; domains are DNS-resolved and every address checked.
 */
async function resolvePublicAddress(
  hostname: string
): Promise<{ address: string; family: number }> {
  const literal = net.isIP(hostname);
  if (literal) {
    if (isBlockedIp(hostname)) throw new SsrfBlockedError('URL resolves to a blocked address');
    return { address: hostname, family: literal };
  }
  let addresses: dns.LookupAddress[];
  try {
    addresses = await dns.promises.lookup(hostname, { all: true });
  } catch {
    throw new SsrfBlockedError('DNS resolution failed');
  }
  if (!addresses.length) throw new SsrfBlockedError('No addresses for host');
  for (const a of addresses) {
    if (isBlockedIp(a.address)) throw new SsrfBlockedError('URL resolves to a blocked address');
  }
  return { address: addresses[0].address, family: addresses[0].family };
}

export interface SafeFetchOptions {
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
  userAgent?: string;
}

interface OneHopResult {
  status: number;
  location: string;
  html: string;
}

async function fetchOnce(
  urlStr: string,
  opts: { timeoutMs: number; maxBytes: number; userAgent: string }
): Promise<OneHopResult> {
  let parsed: URL;
  try {
    parsed = new URL(urlStr);
  } catch {
    throw new SsrfBlockedError('Malformed URL');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new SsrfBlockedError('Only http(s) URLs are allowed');
  }
  const isHttps = parsed.protocol === 'https:';
  const hostname = parsed.hostname.replace(/^\[|\]$/g, '');
  // Resolve + validate ONCE, then connect to that exact IP — closes the DNS
  // rebinding TOCTOU (the validated address is the one connected to) and covers
  // IP-literal hosts (node's `lookup` option is never called for those).
  const { address, family } = await resolvePublicAddress(hostname);
  const mod = isHttps ? https : http;
  const port = parsed.port ? Number(parsed.port) : isHttps ? 443 : 80;

  return new Promise<OneHopResult>((resolve, reject) => {
    const req = mod.request(
      {
        host: address,
        family,
        port,
        path: `${parsed.pathname}${parsed.search}`,
        method: 'GET',
        timeout: opts.timeoutMs,
        // Preserve the real host for virtual hosting + TLS SNI/cert validation.
        headers: {
          Host: parsed.host,
          'User-Agent': opts.userAgent,
          Accept: 'text/html,application/xhtml+xml',
        },
        ...(isHttps ? { servername: hostname } : {}),
      },
      (res) => {
        const status = res.statusCode || 0;
        if (status >= 300 && status < 400) {
          res.resume(); // drain
          resolve({ status, location: String(res.headers.location || ''), html: '' });
          return;
        }
        const chunks: Buffer[] = [];
        let total = 0;
        let done = false;
        const finish = () => {
          if (done) return;
          done = true;
          resolve({ status, location: '', html: Buffer.concat(chunks).toString('utf8') });
        };
        res.on('data', (c: Buffer) => {
          total += c.length;
          if (total > opts.maxBytes) {
            res.destroy();
            finish();
            return;
          }
          chunks.push(c);
        });
        res.on('end', finish);
        res.on('close', finish);
        res.on('error', (e) => reject(e));
      }
    );
    req.on('timeout', () => req.destroy(new SsrfBlockedError('Request timed out')));
    req.on('error', (e) => reject(e));
    req.end();
  });
}

/**
 * Fetch the HTML body of a user URL with SSRF protection. Follows redirects
 * manually, re-validating each hop. Caps body size and total time. Returns
 * { finalUrl, html }.
 */
export async function safeFetchHtml(
  rawUrl: string,
  opts: SafeFetchOptions = {}
): Promise<{ finalUrl: string; html: string }> {
  const {
    timeoutMs = 5000,
    maxBytes = 1_000_000,
    maxRedirects = 4,
    userAgent = 'Consultify-LinkPreview/1.0',
  } = opts;

  let current = rawUrl;
  for (let hop = 0; hop <= maxRedirects; hop++) {
    const { status, location, html } = await fetchOnce(current, { timeoutMs, maxBytes, userAgent });
    if (status >= 300 && status < 400) {
      if (!location) throw new SsrfBlockedError('Redirect without location');
      current = new URL(location, current).toString();
      continue;
    }
    if (status < 200 || status >= 300) {
      throw new SsrfBlockedError(`Upstream responded ${status}`);
    }
    return { finalUrl: current, html };
  }
  throw new SsrfBlockedError('Too many redirects');
}
