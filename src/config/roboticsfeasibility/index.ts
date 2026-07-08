/**
 * Robotics Feasibility — config layer barrel.
 *
 * SSOT for the robotics-feasibility methodology content and its deterministic
 * synthesis engine. Cloned from the RPA-Scanner config pattern
 * (src/config/rpascanner), the physical-automation analog:
 *   - deepeningLadder.ts   : per-axis depth staircase + partner-grade proposal bank (PL/EN)
 *   - roboticsEngine.ts    : two-gate feasibility (technical → economic) + verdict
 *                            (go/no-go/pilot/hybrid) + W2 move sequencing
 *   - conclusionPrompts.ts : insight-first AI prompt builders grounded in the engine output
 *
 * Self-contained: the engine reads a minimal RoboticsSession, and this barrel
 * offers a defensive adapter (toRoboticsSession, re-exported from the engine) from
 * the store's OperationalToolData sections so callers never reach into internals.
 */

import {
  ROBOTICS_DEEPENING_LADDER,
  ROBOTICS_LADDER_RUNG_ORDER,
  type LadderRung,
  type RoboticsAxisId,
} from './deepeningLadder';

export * from './deepeningLadder';
export * from './roboticsEngine';
export * from './conclusionPrompts';

/** A ladder rung with strings resolved to a single language. */
export interface LocalizedRung {
  id: LadderRung['id'];
  depth: LadderRung['depth'];
  label: string;
  question: string;
  rationale: string;
}

/** Resolve an axis's deepening ladder to one language, preserving rung order. */
export function localizeLadder(axis: RoboticsAxisId, isPolish: boolean): LocalizedRung[] {
  const rungs = ROBOTICS_DEEPENING_LADDER[axis];
  return ROBOTICS_LADDER_RUNG_ORDER.map((rungId) => {
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
