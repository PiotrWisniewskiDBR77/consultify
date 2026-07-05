/**
 * A3 Problem Solving — config layer barrel.
 *
 * SSOT for the A3 methodology content and its deterministic synthesis engine.
 * Cloned from the Ansoff config pattern (src/config/ansoff):
 *   - deepeningLadder.ts  : per-section depth staircase + partner-grade proposal bank (PL/EN)
 *   - moveValidator.ts    : readiness scoring + W2 countermeasure sequencing (rationale/trade-off/rejected variant)
 *   - conclusionPrompts.ts: AI prompt builders grounded in the engine output
 */

import {
  A3_DEEPENING_LADDER,
  A3_LADDER_RUNG_ORDER,
  type A3SectionId,
  type LadderRung,
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

/** Resolve a section's deepening ladder to one language, preserving rung order. */
export function localizeLadder(section: A3SectionId, isPolish: boolean): LocalizedRung[] {
  const rungs = A3_DEEPENING_LADDER[section];
  // Preserve canonical order regardless of source array order.
  return A3_LADDER_RUNG_ORDER.map((rungId) => {
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
