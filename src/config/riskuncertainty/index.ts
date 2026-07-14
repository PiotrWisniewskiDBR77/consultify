/**
 * Risk & Uncertainty — config layer barrel.
 *
 * SSOT for the Risk & Uncertainty methodology content and its deterministic
 * synthesis engine. Cloned from the Ansoff config pattern (src/config/ansoff):
 *   - deepeningLadder.ts     : per-dimension depth staircase + partner-grade proposal bank (PL/EN)
 *   - moveValidator.ts       : risk exposure scoring, ranking, and W2 resilience move sequencing
 *   - riskMatrixEngine.ts    : 2x2 probability x impact zone classification + response map (O3)
 *   - riskInsightStaircase.ts: fact->interpretation->implication staircase + invented-number guard
 *                              + risk-vs-uncertainty (known/unknown-unknown) discipline (O3)
 *   - conclusionPrompts.ts   : AI prompt builders grounded in the engine output
 *   - raidHandoff.ts         : Risk → Initiative RAID handoff with tool-session provenance
 *
 * This closes the 19th consulting tool. The RAID handoff means the tool is NOT
 * a silo: identified risks/assumptions carry a source back-reference into an
 * initiative's RAID register (see raidHandoff.ts).
 */

import {
  type LadderRung,
  RISK_DEEPENING_LADDER,
  RISK_LADDER_RUNG_ORDER,
  type RiskDimensionId,
} from './deepeningLadder';

export * from './conclusionPrompts';
export * from './deepeningLadder';
export * from './moveValidator';
export * from './raidHandoff';
export * from './riskInsightStaircase';
export * from './riskMatrixEngine';

/** A ladder rung with strings resolved to a single language. */
export interface LocalizedRung {
  id: LadderRung['id'];
  depth: LadderRung['depth'];
  label: string;
  question: string;
  rationale: string;
}

/** Resolve a dimension's deepening ladder to one language, preserving rung order. */
export function localizeLadder(dimension: RiskDimensionId, isPolish: boolean): LocalizedRung[] {
  const rungs = RISK_DEEPENING_LADDER[dimension];
  // Preserve canonical order regardless of source array order.
  return RISK_LADDER_RUNG_ORDER.map((rungId) => {
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
