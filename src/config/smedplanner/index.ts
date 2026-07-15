/**
 * SMED Planner — config layer barrel.
 *
 * SSOT for the SMED methodology content and its deterministic synthesis engine.
 * Cloned from the Ansoff config pattern (src/config/ansoff):
 *   - deepeningLadder.ts   : per-phase depth staircase + partner-grade proposal bank (PL/EN)
 *   - changeoverEngine.ts  : baseline + scoring + W2 move sequencing (rationale/trade-off/rejected variant)
 *   - conclusionPrompts.ts : AI prompt builders grounded in the engine output
 *
 * Self-contained: the engine reads a minimal SmedSession, and this barrel offers
 * a defensive adapter from the store's OperationalToolData sections so callers
 * never have to reach into section internals.
 */

import type { ChangeoverStep, ImprovementItem, SmedSession, StepKind } from './changeoverEngine';
import {
  type LadderRung,
  SMED_DEEPENING_LADDER,
  SMED_LADDER_RUNG_ORDER,
  type SmedPhaseId,
} from './deepeningLadder';

export * from './changeoverEngine';
export * from './conclusionPrompts';
export * from './deepeningLadder';
export * from './smedInsightStaircase';
export * from './smedQuestionBank';

/** A ladder rung with strings resolved to a single language. */
export interface LocalizedRung {
  id: LadderRung['id'];
  depth: LadderRung['depth'];
  label: string;
  question: string;
  rationale: string;
}

/** Resolve a phase's deepening ladder to one language, preserving rung order. */
export function localizeLadder(phase: SmedPhaseId, isPolish: boolean): LocalizedRung[] {
  const rungs = SMED_DEEPENING_LADDER[phase];
  return SMED_LADDER_RUNG_ORDER.map((rungId) => {
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
// Adapter: OperationalToolData sections -> SmedSession (defensive, store-agnostic)
// ---------------------------------------------------------------------------

const asKind = (raw: unknown): StepKind => (raw === 'external' ? 'external' : 'internal');

const asPotential = (raw: unknown): ChangeoverStep['potential'] =>
  raw === 'convertible' || raw === 'shortenable' || raw === 'fixed' ? raw : undefined;

const asPhase = (raw: unknown): SmedPhaseId | undefined =>
  raw === 'separate' || raw === 'convert' || raw === 'streamline' || raw === 'standardize'
    ? raw
    : undefined;

/**
 * Extract a SmedSession from the operational tool's `sections`. Reads
 * `changeover-steps` and `improvements` defensively; unknown categories fall
 * back to sane defaults (internal, unclassified) rather than throwing.
 *
 * Convention on OperationalItem: `category` carries internal/external OR the
 * improvement phase; `threshold` carries the step's improvement potential.
 */
export function toSmedSession(sections: Record<string, unknown[]> | undefined): SmedSession {
  const rawSteps = (sections?.['changeover-steps'] || []) as Array<Record<string, unknown>>;
  const rawImprovements = (sections?.['improvements'] || []) as Array<Record<string, unknown>>;

  const steps: ChangeoverStep[] = rawSteps.map((item, idx) => ({
    id: String(item.id ?? `step-${idx}`),
    kind: asKind(item.category),
    durationMinutes: typeof item.durationMinutes === 'number' ? item.durationMinutes : undefined,
    measured: typeof item.durationMinutes === 'number',
    potential: asPotential(item.threshold),
  }));

  const improvements: ImprovementItem[] = rawImprovements.map((item, idx) => ({
    id: String(item.id ?? `imp-${idx}`),
    phase: asPhase(item.category),
    impact: (item.impact as ImprovementItem['impact']) ?? undefined,
    effort: (item.effort as ImprovementItem['effort']) ?? undefined,
    evidence: Array.isArray(item.evidence) ? (item.evidence as string[]) : [],
  }));

  return { steps, improvements };
}
