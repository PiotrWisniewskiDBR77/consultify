/**
 * GROW-CONTENT (2026-07-05) — block density contract.
 *
 * W7 (fill-canvas) redistributed sparse content so it stopped gluing to the top
 * with a dead bottom, but its own README is explicit that centering whitespace is
 * NOT the same as filling the canvas: "prawdziwy premium wymaga *powiększania
 * treści* (większy hero-number, bogatsze kafelki KPI, realne wykresy)".
 *
 * This is that grow: blocks now accept an optional `density`. When a block is the
 * DOMINANT content of its region — a lone hero metric, a chart that owns a tall
 * slot — CardRenderer passes `density: 'hero'` and the block renders with far more
 * visual weight (bigger type, taller charts, trend chips) so it fills the region
 * instead of floating small in whitespace. Absent/`'default'` → byte-identical to
 * the pre-grow render, so every existing `{ block, theme }` caller (and test) is
 * untouched.
 */
export type BlockDensity = 'default' | 'hero';
