/**
 * SOP Builder — config layer barrel.
 *
 * SSOT for the SOP methodology content and its deterministic synthesis engine.
 * Cloned from the Ansoff config pattern (src/config/ansoff):
 *   - deepeningLadder.ts  : per-section depth staircase + partner-grade proposal bank (PL/EN)
 *   - moveValidator.ts    : enforceability scoring + W2 rollout sequencing (rationale/trade-off/rejected variant)
 *   - conclusionPrompts.ts: AI prompt builders grounded in the engine output
 */

import {
  SOP_DEEPENING_LADDER,
  SOP_LADDER_RUNG_ORDER,
  type SopSectionId,
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
export function localizeLadder(section: SopSectionId, isPolish: boolean): LocalizedRung[] {
  const rungs = SOP_DEEPENING_LADDER[section];
  // Preserve canonical order regardless of source array order.
  return SOP_LADDER_RUNG_ORDER.map((rungId) => {
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
