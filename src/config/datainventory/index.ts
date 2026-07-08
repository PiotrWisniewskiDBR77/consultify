/**
 * Data Inventory — config layer barrel.
 *
 * SSOT for the data-governance / AI-readiness methodology content and its
 * deterministic synthesis engine. Cloned from the Inventory Autopilot config
 * pattern (src/config/inventoryautopilot):
 *   - deepeningLadder.ts        : per-lever depth staircase + methodology bank
 *                                 (data domains, 8 DAMA quality dimensions,
 *                                 Gartner 5-level governance maturity,
 *                                 5 AI-readiness dimensions) + proposal bank (PL/EN)
 *   - dataInventoryEngine.ts    : inventory baseline + quality profile + governance
 *                                 maturity + AI readiness + dark-data/orphan detection
 *                                 + cross-domain spread + scoring + W2 governance sequence
 *   - conclusionPrompts.ts      : INSIGHT-FIRST AI prompt builders grounded in the engine
 *
 * Self-contained: the engine reads a minimal DataInventorySession, and this
 * barrel offers a defensive adapter from the store's OperationalToolData sections
 * (re-exported from the engine) so callers never reach into section internals.
 */

import {
  DATA_INVENTORY_DEEPENING_LADDER,
  DATA_INVENTORY_LADDER_RUNG_ORDER,
  type DataGovernanceLeverId,
  type LadderRung,
} from './deepeningLadder';

export * from './deepeningLadder';
export * from './dataInventoryEngine';
export * from './conclusionPrompts';

/** A ladder rung with strings resolved to a single language. */
export interface LocalizedRung {
  id: LadderRung['id'];
  depth: LadderRung['depth'];
  label: string;
  question: string;
  rationale: string;
}

/** Resolve a lever's deepening ladder to one language, preserving rung order. */
export function localizeLadder(lever: DataGovernanceLeverId, isPolish: boolean): LocalizedRung[] {
  const rungs = DATA_INVENTORY_DEEPENING_LADDER[lever];
  return DATA_INVENTORY_LADDER_RUNG_ORDER.map((rungId) => {
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
