/**
 * highlightTextMatch
 *
 * Pure helper that splits a haystack string into alternating matched /
 * unmatched segments against a case-insensitive needle. Used by the
 * Governance Watchlist saved-search highlighter to render `<mark>` spans
 * around matches without coupling to React or DOM APIs.
 *
 * Design notes:
 *   - Empty / non-string needle short-circuits to a single unmatched segment
 *     so callers can render the haystack verbatim.
 *   - Matches are walked greedily left-to-right with `String#indexOf` after
 *     locale-lowercasing both sides; the matched slice is taken from the
 *     ORIGINAL haystack so the rendered text preserves the user's casing.
 *   - Multibyte safe in the practical sense — we operate on JS string
 *     code-units, the same way the DOM renders them, so emoji and CJK
 *     characters round-trip cleanly even though their `length` differs from
 *     their visible width.
 *   - `MAX_MATCHES` caps runaway DOMs (e.g. searching `e` against a giant
 *     paragraph). Beyond the cap, the trailing slice is emitted as a single
 *     unmatched segment instead of crashing the renderer.
 */

export interface HighlightSegment {
  text: string;
  matched: boolean;
}

const MAX_MATCHES = 50;

/**
 * Escape characters that have special meaning in a JS RegExp source so the
 * caller can safely build a literal-match RegExp from a user-supplied
 * needle. Exported for tests + adjacent helpers; the highlighter itself
 * does not use a RegExp because we want locale-aware lowercasing.
 */
export function escapeRegExp(s: string): string {
  if (typeof s !== 'string') return '';
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function buildHighlightSegments(haystack: string, needle: string): HighlightSegment[] {
  const safeHaystack = typeof haystack === 'string' ? haystack : '';
  const safeNeedle = typeof needle === 'string' ? needle : '';

  if (safeNeedle.length === 0) {
    return [{ text: safeHaystack, matched: false }];
  }

  // Lowercased twins drive the search; original casing is preserved by
  // slicing out of `safeHaystack` itself.
  const haystackLower = safeHaystack.toLocaleLowerCase();
  const needleLower = safeNeedle.toLocaleLowerCase();

  if (needleLower.length === 0) {
    return [{ text: safeHaystack, matched: false }];
  }

  const segments: HighlightSegment[] = [];
  let cursor = 0;
  let matches = 0;

  while (cursor < safeHaystack.length && matches < MAX_MATCHES) {
    const hit = haystackLower.indexOf(needleLower, cursor);
    if (hit === -1) break;

    if (hit > cursor) {
      segments.push({ text: safeHaystack.slice(cursor, hit), matched: false });
    }
    segments.push({
      text: safeHaystack.slice(hit, hit + needleLower.length),
      matched: true,
    });
    cursor = hit + needleLower.length;
    matches += 1;
  }

  if (cursor < safeHaystack.length) {
    segments.push({ text: safeHaystack.slice(cursor), matched: false });
  }

  // Defensive: if the haystack was empty or no matches were found, ensure we
  // always return at least one segment so consumers can `.map()` without a
  // null check.
  if (segments.length === 0) {
    return [{ text: safeHaystack, matched: false }];
  }

  return segments;
}
