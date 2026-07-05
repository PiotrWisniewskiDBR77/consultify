/**
 * Narrative Engine — config layer barrel.
 *
 * SSOT for the Narrative Engine methodology content and its deterministic
 * synthesis engine. Cloned from the Ansoff/Porter/Portfolio config pattern:
 *   - deepeningLadder.ts  : per-resonance-band depth staircase + partner-grade proposal bank (PL/EN)
 *   - moveValidator.ts    : scoring, ranking, and W2 move sequencing (rationale/trade-off/rejected variant)
 *   - conclusionPrompts.ts: AI prompt builders grounded in the engine output
 */

import {
  NARRATIVE_DEEPENING_LADDER,
  NARRATIVE_LADDER_RUNG_ORDER,
  type LadderRung,
  type ResonanceBand,
} from './deepeningLadder';

export * from './deepeningLadder';
export * from './moveValidator';
export * from './conclusionPrompts';

/** A ladder rung with strings resolved to a single language. */
export interface LocalizedRung {
  id: LadderRung['id'];
  depth: LadderRung['depth'];
  label: string;
  question: string;
  rationale: string;
}

/** Resolve a resonance band's deepening ladder to one language, preserving rung order. */
export function localizeLadder(band: ResonanceBand, isPolish: boolean): LocalizedRung[] {
  const rungs = NARRATIVE_DEEPENING_LADDER[band];
  // Preserve canonical order regardless of source array order.
  return NARRATIVE_LADDER_RUNG_ORDER.map((rungId) => {
    const rung = rungs.find((r) => r.id === rungId)!;
    return {
      id: rung.id,
      depth: rung.depth,
      label: isPolish ? rung.label.pl : rung.label.en,
      question: isPolish ? rung.question.pl : rung.question.en,
      rationale: isPolish ? rung.rationale.pl : rung.rationale.en,
    };
  });
}
