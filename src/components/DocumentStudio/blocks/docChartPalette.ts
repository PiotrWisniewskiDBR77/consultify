/**
 * Document Studio — Harvard categorical chart palette (R3).
 *
 * Ported from `ReportBuilder/blocks/ChartRenderer.tsx` (DEFAULT_COLORS):
 * crimson-anchored, HBS complementary order. See
 * `DELIVERABLES_GRAPHIC_PARAMETERS.md` §P-CHART / §3:
 *   "paleta kategorialna ≤7 z motywu".
 *
 * `clampPalette(n)` returns a palette capped at `PALETTE_CAP` (7) entries,
 * recycling via modulo when more series/slices are requested than the cap.
 * Pure module — no side effects, never throws.
 */

/** Harvard / HBS crimson-anchored categorical palette. */
export const HARVARD_CHART_PALETTE: readonly string[] = [
  '#A51C30', // Harvard Crimson — primary series
  '#6578B4', // HBS Blue 2
  '#52A52E', // HBS Green 2
  '#E87D1E', // HBS Orange 2
  '#00979D', // HBS Teal 2
  '#80408D', // HBS Purple 2
  '#EBCD00', // HBS Gold 2
  '#C9006B', // HBS Magenta 2 (overflow — beyond the §P-CHART ≤7 cap)
  '#3B2883', // HBS Blue 1 (dark)
  '#AE6429', // HBS Orange 1 (dark)
];

/** §P-CHART / §3: categorical palette capped at ≤7 colours from the theme. */
export const PALETTE_CAP = 7;

/** §P-CHART: hard cap on series for line/bar (soft target ≤6, hard cap 8). */
export const MAX_SERIES = 8;

/** §P-CHART: pie ≤5 slices; surplus is aggregated into an "Inne"/"Other" slice. */
export const MAX_PIE_SLICES = 5;

/** Harvard Crimson — the canonical primary brand colour. */
export const PRIMARY_COLOR = HARVARD_CHART_PALETTE[0];

/**
 * Returns a palette array of length `min(count, PALETTE_CAP)` (at least 1
 * entry). Colours are drawn from {@link HARVARD_CHART_PALETTE}, wrapping with
 * modulo so the returned slice never exceeds the §P-CHART ≤7 cap.
 *
 * Tolerant of garbage input (NaN, negative, non-finite) → returns a single
 * primary colour. Never throws.
 */
export function clampPalette(count: number): string[] {
  const n = Number(count);
  const safe = Number.isFinite(n) && n > 0 ? Math.floor(n) : 1;
  const capped = Math.min(safe, PALETTE_CAP);
  const out: string[] = [];
  for (let i = 0; i < capped; i += 1) {
    out.push(HARVARD_CHART_PALETTE[i % HARVARD_CHART_PALETTE.length]);
  }
  return out;
}

/** Picks the colour for series/slice index `i`, wrapping at the ≤7 cap. */
export function colorAt(i: number): string {
  const idx = Number.isFinite(i) && i >= 0 ? Math.floor(i) : 0;
  return HARVARD_CHART_PALETTE[idx % PALETTE_CAP];
}
