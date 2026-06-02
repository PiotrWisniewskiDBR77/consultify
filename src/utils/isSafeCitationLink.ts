/**
 * Chat V9 / TRUST T-TR3-lite — pure URL sanitiser for citation
 * links rendered inside the Trust Badge popover.
 *
 * Contract
 * --------
 * Returns a normalised `string` that is safe to drop into an
 * `<a href>` attribute, or `null` if the input must not be
 * linkified. The caller (TrustBadge) renders the citation title
 * as plain text whenever we return `null`, so a rejected URL
 * degrades the row to pre-T-TR3-lite behaviour — never to a
 * broken link or an XSS vector.
 *
 * Accepted
 * --------
 * - `http:` and `https:` absolute URLs only. The popover is a
 *   "see the original source" affordance; relative URLs, file
 *   paths, `mailto:`, `tel:`, custom schemes, etc. are not
 *   sources the user could sensibly open from the badge, and
 *   every accept-by-default opens an attack surface.
 *
 * Rejected (returns `null`)
 * -------------------------
 * - Non-string input, empty / whitespace-only string.
 * - Strings that throw from the URL constructor (malformed).
 * - `javascript:`, `data:`, `vbscript:`, `file:`, `about:`,
 *   `chrome:`, `blob:`, or any other non-HTTP scheme.
 * - Strings whose leading whitespace-stripped prefix contains a
 *   `javascript:` / `data:` prefix (defence-in-depth: the URL
 *   constructor also rejects these, but we belt-and-brace).
 * - URLs whose hostname is empty after parsing (guards against
 *   `http://` with no host).
 */

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

/**
 * Quick structural prefix check. The URL constructor already
 * rejects `javascript:` via the WHATWG URL spec, but a caller
 * that passes us a mixed-case or whitespace-padded string
 * (`" JAVASCRIPT:foo"`) could bypass the constructor check on
 * older runtimes. We lowercase, trim, and guard explicitly so
 * the sanitiser's contract is auditable by reading the list
 * below — not by chasing spec-conformance of the runtime's URL
 * parser.
 */
const DANGEROUS_PREFIXES = ['javascript:', 'data:', 'vbscript:', 'file:', 'about:', 'blob:'];

export function isSafeCitationLink(raw: unknown): string | null {
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
  if (!parsed.hostname || parsed.hostname.length === 0) return null;

  // Re-serialise through the URL constructor so any oddities
  // (spaces, uppercased scheme, missing trailing slash on host-
  // only URLs) come back in a canonical form that `<a href>`
  // consumers can trust.
  return parsed.toString();
}
