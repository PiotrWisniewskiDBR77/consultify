/**
 * Ansoff Growth Paths — config layer barrel.
 *
 * SSOT for the Ansoff methodology content and its deterministic synthesis
 * engine. Cloned from the SWOT/Porter config pattern:
 *   - deepeningLadder.ts  : per-quadrant depth staircase + partner-grade proposal bank (PL/EN)
 *   - moveValidator.ts    : scoring, ranking, and W2 move sequencing (rationale/trade-off/rejected variant)
 *   - conclusionPrompts.ts: AI prompt builders grounded in the engine output
 */

import type { GrowthQuadrantId } from '@/store/useToolStore';

import {
  ANSOFF_DEEPENING_LADDER,
  ANSOFF_LADDER_RUNG_ORDER,
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

/** Resolve a quadrant's deepening ladder to one language, preserving rung order. */
export function localizeLadder(quadrant: GrowthQuadrantId, isPolish: boolean): LocalizedRung[] {
  const rungs = ANSOFF_DEEPENING_LADDER[quadrant];
  // Preserve canonical order regardless of source array order.
  return ANSOFF_LADDER_RUNG_ORDER.map((rungId) => {
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
