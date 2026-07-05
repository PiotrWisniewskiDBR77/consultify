/**
 * Ambition Decomposer — config layer barrel.
 *
 * SSOT for the Ambition Decomposer methodology content and its deterministic
 * synthesis engine. Cloned from the Ansoff config pattern:
 *   - deepeningLadder.ts  : per-theme-archetype depth staircase + partner-grade proposal bank (PL/EN)
 *   - moveValidator.ts    : theme scoring, prerequisite-aware sequencing, and W2 move sequencing
 *   - conclusionPrompts.ts: AI prompt builders grounded in the engine output
 */

import {
  AMBITION_DEEPENING_LADDER,
  AMBITION_LADDER_RUNG_ORDER,
  type LadderRung,
  type ThemeArchetype,
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

/** Resolve an archetype's deepening ladder to one language, preserving rung order. */
export function localizeLadder(archetype: ThemeArchetype, isPolish: boolean): LocalizedRung[] {
  const rungs = AMBITION_DEEPENING_LADDER[archetype];
  return AMBITION_LADDER_RUNG_ORDER.map((rungId) => {
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
