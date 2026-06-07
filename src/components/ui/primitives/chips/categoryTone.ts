/**
 * categoryTone — delicate, bounded "identity" color for category/type/source
 * tags (NOT status). Returns a muted `--c-tag-*` CSS var, used ONLY as a small
 * leading dot on a neutral, left-aligned chip.
 *
 * Canon: identity tone is a BOUNDED EXCEPTION to "color = signal" — separate
 * muted palette, dot-only, so a tag can never read as a status/alarm.
 * See TABLE_AND_PREVIEW_CANON.md §4.0a.
 *
 * Known categories get an EXPLICIT, collision-free hue; anything else falls
 * back to a deterministic hash so the same label always gets the same color.
 */

const TAG_COUNT = 12;

/** Explicit map for known interview categories → distinct hue index (1-12). */
const KNOWN_TONE: Record<string, number> = {
  data: 1,
  digital: 2,
  operational: 3,
  cost: 4,
  custom: 5,
  quick: 6,
  standard: 7,
  alignment: 8,
  automation: 9,
  change: 10,
  customer: 11,
  executive: 12,
  // rarer ones reuse (table rarely shows >12 distinct at once)
  security: 1,
  esg: 7,
  sustainability: 7,
  pricing: 4,
};

/**
 * Map a category/type/source label to one of the muted tag hues (CSS var).
 * Returns `null` for empty labels (→ no dot).
 */
export function categoryTone(label?: string | null): string | null {
  const c = (label || '').trim().toLowerCase();
  if (!c) return null;
  const known = KNOWN_TONE[c];
  if (known) return `var(--c-tag-${known})`;
  let hash = 0;
  for (let i = 0; i < c.length; i++) {
    hash = (hash * 31 + c.charCodeAt(i)) >>> 0;
  }
  return `var(--c-tag-${(hash % TAG_COUNT) + 1})`;
}
