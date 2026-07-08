/**
 * Decision Engine — config layer barrel.
 *
 * SSOT for the Decision-Quality methodology content and its deterministic
 * synthesis engine. Cloned from the Inventory Autopilot config pattern
 * (src/config/inventoryautopilot):
 *   - deepeningLadder.ts   : per-element depth staircase + partner-grade proposal bank (PL/EN)
 *   - decisionEngine.ts    : matrix + six-link scoring + weakest-link + tornado + move sequence
 *   - conclusionPrompts.ts : insight-first AI prompt builders grounded in the engine output
 *
 * Doctrine: Harvard/wdrozenie-100/_TOOLS_DOKTRYNA/decision-engine.md (Decision
 * Quality Chain — SDG, Howard/Spetzler; McKinsey debiasing; Klein pre-mortem).
 *
 * Self-contained: the engine reads a minimal DecisionSession, and this barrel
 * offers a defensive adapter (`toDecisionSession`) from the store's
 * OperationalToolData sections so callers never reach into section internals.
 */

import {
  DECISION_DEEPENING_LADDER,
  DECISION_LADDER_RUNG_ORDER,
  type DecisionElementId,
  type LadderRung,
} from './deepeningLadder';

export * from './deepeningLadder';
export * from './decisionEngine';
export * from './conclusionPrompts';

/** A ladder rung with strings resolved to a single language. */
export interface LocalizedRung {
  id: LadderRung['id'];
  depth: LadderRung['depth'];
  label: string;
  question: string;
  rationale: string;
}

/** Resolve an element's deepening ladder to one language, preserving rung order. */
export function localizeLadder(element: DecisionElementId, isPolish: boolean): LocalizedRung[] {
  const rungs = DECISION_DEEPENING_LADDER[element];
  return DECISION_LADDER_RUNG_ORDER.map((rungId) => {
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
