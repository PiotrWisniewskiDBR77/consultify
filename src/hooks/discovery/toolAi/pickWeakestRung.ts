/**
 * Dynamic rung selection for the deepening-ladder prompt overrides in
 * promptRegistry.ts.
 *
 * Context: the 9 ladder-carrying tool overrides in promptRegistry.ts each call
 * build<X>DeepenPrompt(sectionId, rungId, isPolish) with a hardcoded rungId
 * ('evidence' or 'quantification'), regardless of how far the session has
 * actually progressed. Two tools — A3 (assessA3) and SOP (assessSop), both in
 * src/config/<tool>/moveValidator.ts — already compute a per-section readiness
 * score shaped as { itemCount, <evidence|measurable>Ratio, ... }. This helper
 * turns that score into the next rung to target on the insight staircase
 * (surface -> evidence -> quantification -> risk-capability):
 *
 *   - no items yet             -> surface          (nothing to deepen; capture first)
 *   - items present, thin cover -> evidence         (< half carry a measurable anchor)
 *   - evidence OK, not full     -> quantification   (majority anchored, but not every item)
 *   - full coverage             -> risk-capability  (every item anchored; go up a rung)
 *
 * This is additive and does not change the ladder architecture: the caller
 * still owns building the { itemCount, coverageRatio } input from whichever
 * assess*() shape its tool has, and still owns the `fallback` rung to use
 * when no coverage is available. The other 7 tool overrides in
 * promptRegistry.ts don't have a compatible assess* shape (their engines read
 * a transformed Session, not raw per-section OperationalItem[] keyed by the
 * ladder section id) and keep calling with their previous hardcoded rung —
 * no regression there.
 */

export type LadderRungId = 'surface' | 'evidence' | 'quantification' | 'risk-capability';

export interface SectionCoverage {
  /** Items captured in the section so far. */
  itemCount: number;
  /** Share of items carrying a measurable/evidenced anchor, 0..1. */
  coverageRatio: number;
}

/** Below this share of evidenced items, the section still needs raw evidence, not tighter numbers. */
const THIN_COVERAGE_THRESHOLD = 0.5;

/**
 * Picks the weakest rung to deepen next for one ladder section, given its
 * current coverage from an assess*() readiness score. Returns `fallback` when
 * no coverage data is available (assess* not wired for this tool, or the
 * section id wasn't found in its scores) so callers never regress to an
 * unhandled state — this is the additive/OFF-path guarantee.
 */
export function pickWeakestRung(
  coverage: SectionCoverage | undefined,
  fallback: LadderRungId = 'evidence'
): LadderRungId {
  if (!coverage) return fallback;
  if (coverage.itemCount === 0) return 'surface';
  const ratio = Number.isFinite(coverage.coverageRatio) ? coverage.coverageRatio : 0;
  if (ratio < THIN_COVERAGE_THRESHOLD) return 'evidence';
  if (ratio < 1) return 'quantification';
  return 'risk-capability';
}
