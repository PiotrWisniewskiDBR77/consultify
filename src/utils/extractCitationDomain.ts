/**
 * Chat V9 / TRUST T-TR3.4 — pure domain extractor for the
 * Trust Badge citation preview.
 *
 * Returns the hostname of a citation URL, stripped of a
 * leading `www.`, or `null` when the input cannot be safely
 * interpreted as an http(s) URL.
 *
 * Why bother with a dedicated helper
 * ----------------------------------
 * 1. The Trust Badge already uses `isSafeCitationLink` to
 *    gate the clickable-link path. That helper returns a
 *    canonicalised URL string; for the domain pill we want
 *    the *hostname* only. Duplicating the parse inline at
 *    the render site would couple the display to the
 *    sanitiser's internal shape.
 *
 * 2. The pill must degrade silently: if a citation lacks a
 *    link, has a file URI, or points to a dangerous
 *    protocol, we render no pill rather than a broken or
 *    misleading one. A single source of truth for "when do
 *    we show a domain?" keeps that decision testable in
 *    isolation.
 *
 * 3. Stripping `www.` is a product decision (`www.nytimes.com`
 *    and `nytimes.com` read as the same source to users). We
 *    keep the canonical hostname on the record, but render
 *    the humanised version.
 *
 * Contract
 * --------
 * - Returns a lowercased hostname, never a path / query /
 *   fragment / port.
 * - Strips a single leading `www.` prefix if present; does
 *   not strip `www1.`, `www2.`, or unrelated subdomains.
 * - Rejects: non-strings, empty strings, `file:`, `data:`,
 *   `javascript:`, `blob:`, `about:`, `vbscript:`, URLs with
 *   an empty hostname, and anything `new URL()` fails to
 *   parse.
 * - Accepts: `http:` and `https:` only.
 */

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);
const DANGEROUS_PREFIXES = [
  'javascript:',
  'data:',
  'vbscript:',
  'file:',
  'about:',
  'blob:',
];

export function extractCitationDomain(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;

  const lowered = trimmed.toLowerCase();
  for (const prefix of DANGEROUS_PREFIXES) {
    if (lowered.startsWith(prefix)) return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }

  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) return null;
  const host = parsed.hostname;
  if (!host || host.length === 0) return null;

  const normalised = host.toLowerCase();
  return normalised.startsWith('www.') ? normalised.slice(4) : normalised;
}
