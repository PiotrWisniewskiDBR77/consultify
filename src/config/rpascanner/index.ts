/**
 * RPA Scanner — config layer barrel.
 *
 * SSOT for the RPA/automation-feasibility methodology content and its
 * deterministic synthesis engine. Cloned from the SMED config pattern
 * (src/config/smedplanner):
 *   - deepeningLadder.ts    : per-gate depth staircase + partner-grade proposal bank (PL/EN)
 *   - feasibilityEngine.ts  : baseline + scoring + W2 move sequencing (rationale/trade-off/rejected variant)
 *   - conclusionPrompts.ts  : AI prompt builders grounded in the engine output
 *
 * Self-contained: the engine reads a minimal RpaSession, and this barrel offers
 * a defensive adapter from the store's OperationalToolData sections so callers
 * never have to reach into section internals.
 */

import {
  type LadderRung,
  RPA_DEEPENING_LADDER,
  RPA_LADDER_RUNG_ORDER,
  type RpaGateId,
} from './deepeningLadder';
import type { AutomationIdea, ProcessCandidate, RpaSession, TechTier } from './feasibilityEngine';

export * from './conclusionPrompts';
export * from './deepeningLadder';
export * from './feasibilityEngine';
export * from './rpaInsightStaircase';
export * from './rpaQuestionBank';

/** A ladder rung with strings resolved to a single language. */
export interface LocalizedRung {
  id: LadderRung['id'];
  depth: LadderRung['depth'];
  label: string;
  question: string;
  rationale: string;
}

/** Resolve a gate's deepening ladder to one language, preserving rung order. */
export function localizeLadder(gate: RpaGateId, isPolish: boolean): LocalizedRung[] {
  const rungs = RPA_DEEPENING_LADDER[gate];
  return RPA_LADDER_RUNG_ORDER.map((rungId) => {
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
// Adapter: OperationalToolData sections -> RpaSession (defensive, store-agnostic)
// ---------------------------------------------------------------------------

const asGate = (raw: unknown): RpaGateId | undefined =>
  raw === 'identify' || raw === 'standardize' || raw === 'quantify' || raw === 'feasibility'
    ? raw
    : undefined;

const asTechTier = (raw: unknown): TechTier | undefined =>
  raw === 'rpa' || raw === 'ocr' || raw === 'api' || raw === 'ai' ? raw : undefined;

const asLevel = (raw: unknown): ProcessCandidate['standardization'] =>
  raw === 'high' || raw === 'medium' || raw === 'low' ? raw : undefined;

const asNumber = (raw: unknown): number | undefined =>
  typeof raw === 'number' && Number.isFinite(raw) ? raw : undefined;

/** Coerce a raw exception rate into 0..1; accepts a fraction or a 0..100 percentage. */
const asRate = (raw: unknown): number | undefined => {
  const n = asNumber(raw);
  if (n === undefined) return undefined;
  const rate = n > 1 ? n / 100 : n;
  return Math.min(1, Math.max(0, rate));
};

/**
 * Extract an RpaSession from the operational tool's `sections`. Reads
 * `process-candidates` and `automation-ideas` defensively; unknown categories
 * fall back to sane defaults (undefined gate, unclassified tech tier) rather
 * than throwing.
 *
 * Convention on OperationalItem: `category` carries the assessment gate;
 * `threshold` carries the tech tier (rpa/ocr/api/ai); `target` optionally
 * carries the monthly volume; `durationMinutes` the per-run handling time;
 * `frequency` optionally carries the exception rate.
 */
export function toRpaSession(sections: Record<string, unknown[]> | undefined): RpaSession {
  const rawCandidates = (sections?.['process-candidates'] || []) as Array<Record<string, unknown>>;
  const rawIdeas = (sections?.['automation-ideas'] || []) as Array<Record<string, unknown>>;

  const candidates: ProcessCandidate[] = rawCandidates.map((item, idx) => {
    const handling = asNumber(item.durationMinutes);
    return {
      id: String(item.id ?? `proc-${idx}`),
      gate: asGate(item.category),
      standardization: asLevel(item.standardization ?? item.impact),
      volumePerMonth: asNumber(item.target),
      handlingMinutes: handling,
      exceptionRate: asRate(item.frequency),
      techTier: asTechTier(item.threshold),
      measured: handling !== undefined && asNumber(item.target) !== undefined,
      evidence: Array.isArray(item.evidence) ? (item.evidence as string[]) : [],
    };
  });

  const ideas: AutomationIdea[] = rawIdeas.map((item, idx) => ({
    id: String(item.id ?? `idea-${idx}`),
    gate: asGate(item.category),
    processId: item.processId ? String(item.processId) : undefined,
    impact: asLevel(item.impact),
    effort: asLevel(item.effort),
    evidence: Array.isArray(item.evidence) ? (item.evidence as string[]) : [],
  }));

  return { candidates, ideas };
}
