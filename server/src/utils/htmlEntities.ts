/**
 * Server-side HTML-entity decoding — the inverse of `sanitizeString`
 * (server/src/utils/security.utils.ts), which the global input-sanitization
 * middleware runs on EVERY request body string.
 *
 * Why this exists (Z139 — data-integrity):
 * The sanitizer escapes `& < > " ' \`` on write. Rich-text surfaces
 * (Notebook pages, WorkCanvas drafts) store the escaped value verbatim and
 * hand it back to the client, where TipTap/React render it LITERALLY
 * (`&amp;`), then re-save it — so every save adds another layer
 * (`&amp;` -> `&amp;amp;` -> ...). The fix is to decode entities back to
 * plain text BEFORE storing: the DB then always holds plain text, and the
 * render path (React/TipTap) does its own escaping, so no XSS is
 * reintroduced. Never feed the decoded value into dangerouslySetInnerHTML.
 *
 * Mirrors the frontend `src/utils/decodeHtmlEntities.ts` and the local
 * `decodeIdeaText` (server/src/routes/my-work.routes.ts) — kept as a shared
 * server util so notebook + work-canvas apply the identical, proven logic.
 */

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

function decodeOnce(input: string): string {
  return input.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, body: string) => {
    if (body[0] === '#') {
      const isHex = body[1] === 'x' || body[1] === 'X';
      const code = parseInt(isHex ? body.slice(2) : body.slice(1), isHex ? 16 : 10);
      if (Number.isFinite(code) && code > 0 && code <= 0x10ffff) {
        try {
          return String.fromCodePoint(code);
        } catch {
          return match;
        }
      }
      return match;
    }
    const named = NAMED_ENTITIES[body.toLowerCase()];
    return named !== undefined ? named : match;
  });
}

/**
 * Decode HTML entities in a single string. Idempotent on plain text.
 * Iterative so it unwinds N-times encoding (`&amp;amp;quot;` -> `"`).
 * Returns non-strings unchanged (as '').
 */
export function decodeHtmlEntities(input: unknown): string {
  if (typeof input !== 'string' || input.length === 0) {
    return typeof input === 'string' ? input : '';
  }
  let current = input;
  for (let i = 0; i < 6; i += 1) {
    const next = decodeOnce(current);
    if (next === current) break;
    current = next;
  }
  return current;
}

/**
 * Recursively decode HTML entities on every string leaf of a value
 * (object / array / string), returning a decoded copy. Used to unwind the
 * sanitizer's per-leaf escaping of structured rich-text (e.g. a TipTap doc
 * object) BEFORE it is JSON.stringify-ed and stored — decoding the leaves
 * (not the serialized JSON) keeps quotes inside text safe for re-serialization.
 * Non-string scalars pass through untouched.
 */
export function deepDecodeHtmlEntities<T>(value: T, maxDepth = 12): T {
  if (maxDepth <= 0) return value;
  if (typeof value === 'string') return decodeHtmlEntities(value) as unknown as T;
  if (Array.isArray(value)) {
    return value.map((v) => deepDecodeHtmlEntities(v, maxDepth - 1)) as unknown as T;
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = deepDecodeHtmlEntities(v, maxDepth - 1);
    }
    return out as unknown as T;
  }
  return value;
}
