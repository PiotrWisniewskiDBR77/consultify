/**
 * Capability Mapper — config layer barrel.
 *
 * SSOT for the Capability Mapper methodology content and its deterministic
 * synthesis engine. Cloned from the Ansoff config pattern, then raised to full
 * OXFORD O3 depth (SWOT/Porter/Portfolio pattern: q-bank + insight staircase +
 * matrix engine, on top of the existing ladder/validator/prompt trio):
 *   - deepeningLadder.ts            : per-sourcing-archetype depth staircase + partner-grade proposal bank (PL/EN)
 *   - moveValidator.ts              : gap scoring, ranking, and W2 sourcing sequencing (rationale/trade-off/rejected variant)
 *   - conclusionPrompts.ts          : AI prompt builders grounded in the engine output (existing JSON contract — unchanged)
 *   - capabilityQuestionBank.ts     : O3 laddered q-bank — identification -> maturity evidence -> importance & gap -> move
 *   - capabilityInsightStaircase.ts : O3 insight staircase (skad ocena zdolnosci) + invented-number guard
 *   - capabilityMatrixEngine.ts     : O3 maturity x importance matrix (core-capability vs commodity) + importance x gap x feasibility ranking + sourcing-mismatch guard
 */

import {
  CAPABILITY_DEEPENING_LADDER,
  CAPABILITY_LADDER_RUNG_ORDER,
  type LadderRung,
  type SourcingArchetype,
} from './deepeningLadder';

export * from './capabilityInsightStaircase';
export * from './capabilityMatrixEngine';
export * from './capabilityQuestionBank';
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

/** Resolve an archetype's deepening ladder to one language, preserving rung order. */
export function localizeLadder(archetype: SourcingArchetype, isPolish: boolean): LocalizedRung[] {
  const rungs = CAPABILITY_DEEPENING_LADDER[archetype];
  return CAPABILITY_LADDER_RUNG_ORDER.map((rungId) => {
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
