/**
 * Pain Explorer — config layer barrel.
 *
 * SSOT for the pain-discovery methodology content and its deterministic
 * synthesis engine. Cloned from the SMED config pattern (src/config/smedplanner):
 *   - deepeningLadder.ts       : per-stage depth staircase + partner-grade proposal bank (PL/EN)
 *   - painExplorerQuestionBank.ts: laddered, branching q-bank — pain claim -> forced
 *                              qualification -> quantification -> diagnosis (OXFORD O3)
 *   - painSynthesisEngine.ts   : baseline + scoring + coverage-gap detection + W2 move
 *                              sequencing (rationale/trade-off/rejected variant)
 *   - conclusionPrompts.ts     : AI prompt builders grounded in the engine output
 *
 * Self-contained: the engine reads a minimal PainSession, and this barrel offers
 * a defensive adapter from the store's OperationalToolData sections so callers
 * never have to reach into section internals.
 */

import {
  type LadderRung,
  PAIN_DEEPENING_LADDER,
  PAIN_LADDER_RUNG_ORDER,
  type PainStageId,
} from './deepeningLadder';
import type { PainNature, PainPoint, PainSession, SolutionCandidate } from './painSynthesisEngine';

export * from './conclusionPrompts';
export * from './deepeningLadder';
export * from './painExplorerQuestionBank';
export * from './painSynthesisEngine';

/** A ladder rung with strings resolved to a single language. */
export interface LocalizedRung {
  id: LadderRung['id'];
  depth: LadderRung['depth'];
  label: string;
  question: string;
  rationale: string;
}

/** Resolve a stage's deepening ladder to one language, preserving rung order. */
export function localizeLadder(stage: PainStageId, isPolish: boolean): LocalizedRung[] {
  const rungs = PAIN_DEEPENING_LADDER[stage];
  return PAIN_LADDER_RUNG_ORDER.map((rungId) => {
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
// Adapter: OperationalToolData sections -> PainSession (defensive, store-agnostic)
// ---------------------------------------------------------------------------

const asStage = (raw: unknown): PainStageId | undefined =>
  raw === 'detect' || raw === 'qualify' || raw === 'measure' || raw === 'diagnose'
    ? raw
    : undefined;

const asNature = (raw: unknown): PainNature | undefined =>
  raw === 'root' || raw === 'symptom' ? raw : undefined;

const asLevel = (raw: unknown): PainPoint['severity'] =>
  raw === 'high' || raw === 'medium' || raw === 'low' ? raw : undefined;

const asNumber = (raw: unknown): number | undefined =>
  typeof raw === 'number' && Number.isFinite(raw) ? raw : undefined;

/**
 * Extract a PainSession from the operational tool's `sections`. Reads
 * `pain-points` and `solutions` defensively; unknown categories fall back to
 * sane defaults (undefined stage, unclassified nature) rather than throwing.
 *
 * Convention on OperationalItem: `category` carries the discovery stage;
 * `threshold` carries the pain nature (root/symptom); `target` optionally
 * carries the annual occurrence count; `durationMinutes` the per-occurrence time.
 */
export function toPainSession(sections: Record<string, unknown[]> | undefined): PainSession {
  const rawPains = (sections?.['pain-points'] || []) as Array<Record<string, unknown>>;
  const rawSolutions = (sections?.['solutions'] || []) as Array<Record<string, unknown>>;

  const pains: PainPoint[] = rawPains.map((item, idx) => {
    const minutes = asNumber(item.durationMinutes);
    return {
      id: String(item.id ?? `pain-${idx}`),
      stage: asStage(item.category),
      severity: asLevel(item.impact),
      frequency: asLevel(item.frequency),
      reach: asNumber(item.reach),
      minutesPerOccurrence: minutes,
      occurrencesPerYear: asNumber(item.target),
      nature: asNature(item.threshold),
      measured: minutes !== undefined,
      evidence: Array.isArray(item.evidence) ? (item.evidence as string[]) : [],
    };
  });

  const solutions: SolutionCandidate[] = rawSolutions.map((item, idx) => ({
    id: String(item.id ?? `sol-${idx}`),
    stage: asStage(item.category),
    painId: item.painId ? String(item.painId) : undefined,
    impact: asLevel(item.impact),
    effort: asLevel(item.effort),
    evidence: Array.isArray(item.evidence) ? (item.evidence as string[]) : [],
  }));

  return { pains, solutions };
}
