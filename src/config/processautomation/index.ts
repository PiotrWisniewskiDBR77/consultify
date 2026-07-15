/**
 * Process Automation — config layer barrel.
 *
 * SSOT for the Process Automation methodology content and its deterministic
 * synthesis engine. Cloned from the SMED Planner config pattern
 * (src/config/smedplanner):
 *   - deepeningLadder.ts    : per-phase depth staircase + partner-grade proposal bank (PL/EN)
 *   - automationEngine.ts   : baseline + scoring + W2 move sequencing (rationale/trade-off/rejected variant)
 *   - conclusionPrompts.ts  : AI prompt builders grounded in the engine output
 *
 * Self-contained: the engine reads a minimal AutomationSession, and this barrel
 * offers a defensive adapter from the store's OperationalToolData sections plus
 * the quantitative `flow.processAutomation` baseline so callers never have to
 * reach into section internals.
 */

import type {
  AutomationBaselineInput,
  AutomationCandidate,
  AutomationSession,
} from './automationEngine';
import {
  AUTOMATION_DEEPENING_LADDER,
  AUTOMATION_LADDER_RUNG_ORDER,
  type AutomationPhaseId,
  type LadderRung,
} from './deepeningLadder';

export * from './automationEngine';
export * from './automationInsightStaircase';
export * from './automationQuestionBank';
export * from './conclusionPrompts';
export * from './deepeningLadder';

/** A ladder rung with strings resolved to a single language. */
export interface LocalizedRung {
  id: LadderRung['id'];
  depth: LadderRung['depth'];
  label: string;
  question: string;
  rationale: string;
}

/** Resolve a phase's deepening ladder to one language, preserving rung order. */
export function localizeLadder(phase: AutomationPhaseId, isPolish: boolean): LocalizedRung[] {
  const rungs = AUTOMATION_DEEPENING_LADDER[phase];
  return AUTOMATION_LADDER_RUNG_ORDER.map((rungId) => {
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

// ---------------------------------------------------------------------------
// Adapter: OperationalToolData sections + flow -> AutomationSession (defensive)
// ---------------------------------------------------------------------------

const asPhase = (raw: unknown): AutomationPhaseId | undefined =>
  raw === 'map' || raw === 'standardize' || raw === 'automate' || raw === 'sustain'
    ? raw
    : undefined;

/**
 * Extract an AutomationSession from the operational tool's `sections` plus its
 * quantitative `flow.processAutomation` baseline. Reads the `redesign` section
 * (automation candidates) defensively; unknown categories fall back to
 * undefined phase rather than throwing.
 *
 * Convention on OperationalItem: `category` carries the automation phase;
 * `threshold`/`durationMinutes` may carry minutes saved; `evidence` backs it.
 */
export function toAutomationSession(
  sections: Record<string, unknown[]> | undefined,
  baseline?: AutomationBaselineInput
): AutomationSession {
  const rawCandidates = [
    ...((sections?.['redesign'] || []) as Array<Record<string, unknown>>),
    ...((sections?.['re-estimation'] || []) as Array<Record<string, unknown>>),
  ];

  const candidates: AutomationCandidate[] = rawCandidates.map((item, idx) => {
    const minutesSaved =
      typeof item.minutesSaved === 'number'
        ? item.minutesSaved
        : typeof item.durationMinutes === 'number'
          ? item.durationMinutes
          : undefined;
    return {
      id: String(item.id ?? `cand-${idx}`),
      phase: asPhase(item.category),
      impact: (item.impact as AutomationCandidate['impact']) ?? undefined,
      effort: (item.effort as AutomationCandidate['effort']) ?? undefined,
      evidence: Array.isArray(item.evidence) ? (item.evidence as string[]) : [],
      minutesSaved,
    };
  });

  return {
    candidates,
    baseline: baseline ?? {},
  };
}
