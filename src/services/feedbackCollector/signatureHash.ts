/**
 * signatureHash
 *
 * Deterministic short hash (FNV-1a 32-bit) used to cluster duplicate reports.
 * Input is normalised:
 *  - stack-trace trimmed to top N frames, strip file row/col + URL params
 *  - route trimmed to first 3 path segments, UUIDs replaced with `:id`
 *  - message lower-cased, collapsed whitespace, numbers removed
 *
 * The resulting hash is short enough to fit in a badge and stable across
 * sessions / devices. We don't need cryptographic strength here.
 */

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const NUMBER_RE = /\d+/g;
const URL_SUFFIX_RE = /:(\d+):(\d+)\)?$/;

export function normaliseRoute(route?: string | null): string {
  if (!route) return '';
  const clean = route.split('?')[0].split('#')[0];
  const segs = clean.split('/').filter(Boolean).slice(0, 3);
  return (
    '/' +
    segs
      .map((s) => {
        if (UUID_RE.test(s)) return ':id';
        if (NUMBER_RE.test(s) && s.length > 3) return ':id';
        return s.toLowerCase();
      })
      .join('/')
  );
}

export function normaliseStack(stack?: string | null, topFrames = 5): string {
  if (!stack) return '';
  const lines = String(stack)
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('at ') || l.includes('@'))
    .slice(0, topFrames)
    .map((l) => l.replace(URL_SUFFIX_RE, '').replace(/https?:\/\/[^\s)]+/g, '[url]'));
  return lines.join('\n');
}

export function normaliseMessage(msg?: string | null): string {
  if (!msg) return '';
  return String(msg)
    .toLowerCase()
    .replace(UUID_RE, ':id')
    .replace(/\s+/g, ' ')
    .replace(NUMBER_RE, '0')
    .trim()
    .slice(0, 400);
}

export function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = (hash + ((hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24))) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

export interface SignatureInput {
  message?: string | null;
  stack?: string | null;
  route?: string | null;
}

export function computeSignatureHash(input: SignatureInput): string {
  const normalised = [
    normaliseStack(input.stack),
    normaliseRoute(input.route),
    normaliseMessage(input.message),
  ].join('\n---\n');
  return fnv1a(normalised);
}
