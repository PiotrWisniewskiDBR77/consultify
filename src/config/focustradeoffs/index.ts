/**
 * Focus & Trade-offs — config layer barrel.
 *
 * SSOT for the Focus & Trade-offs methodology content and its deterministic
 * synthesis engine. Cloned from the Ansoff/Porter/Portfolio config pattern:
 *   - deepeningLadder.ts  : per-lane depth staircase + partner-grade proposal bank (PL/EN)
 *   - moveValidator.ts    : scoring, ranking, and W2 move sequencing (rationale/trade-off/rejected variant)
 *   - conclusionPrompts.ts: AI prompt builders grounded in the engine output
 */

import {
  FOCUS_DEEPENING_LADDER,
  FOCUS_LADDER_RUNG_ORDER,
  type FocusLane,
  type LadderRung,
} from './deepeningLadder';

export * from './conclusionPrompts';
export * from './deepeningLadder';
export * from './moveValidator';

/** A ladder rung with strings resolved to a single language. */
export interface LocalizedRung {
  id: LadderRung['id'];
  depth: LadderRung['depth'];
  label: string;
  question: string;
  rationale: string;
}

/** Resolve a lane's deepening ladder to one language, preserving rung order. */
export function localizeLadder(lane: FocusLane, isPolish: boolean): LocalizedRung[] {
  const rungs = FOCUS_DEEPENING_LADDER[lane];
  // Preserve canonical order regardless of source array order.
  return FOCUS_LADDER_RUNG_ORDER.map((rungId) => {
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
