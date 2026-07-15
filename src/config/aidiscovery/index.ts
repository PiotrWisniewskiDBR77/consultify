/**
 * AI Discovery — config layer barrel.
 *
 * SSOT for the AI use-case discovery methodology content and its deterministic
 * synthesis engine. Cloned from the SMED config pattern (src/config/smedplanner):
 *   - deepeningLadder.ts      : per-phase depth staircase + partner-grade proposal bank (PL/EN)
 *   - aiDiscoveryQuestionBank.ts: laddered, branching q-bank — use case claim -> forced data
 *                              proof -> quantification -> sequencing (OXFORD O3)
 *   - useCaseEngine.ts        : baseline + scoring + coverage-gap detection + W2 move
 *                              sequencing (rationale/trade-off/rejected variant)
 *   - conclusionPrompts.ts    : AI prompt builders grounded in the engine output
 *
 * Self-contained: the engine reads a minimal DiscoverySession, and this barrel
 * offers a defensive adapter from the store's OperationalToolData sections so
 * callers never have to reach into section internals.
 */

import {
  AI_DEEPENING_LADDER,
  AI_LADDER_RUNG_ORDER,
  type AiPhaseId,
  type LadderRung,
} from './deepeningLadder';
import type {
  AiUseCase,
  DataReadiness,
  DiscoveryMoveItem,
  DiscoverySession,
} from './useCaseEngine';

export * from './aiDiscoveryQuestionBank';
export * from './conclusionPrompts';
export * from './deepeningLadder';
export * from './useCaseEngine';

/** A ladder rung with strings resolved to a single language. */
export interface LocalizedRung {
  id: LadderRung['id'];
  depth: LadderRung['depth'];
  label: string;
  question: string;
  rationale: string;
}

/** Resolve a phase's deepening ladder to one language, preserving rung order. */
export function localizeLadder(phase: AiPhaseId, isPolish: boolean): LocalizedRung[] {
  const rungs = AI_DEEPENING_LADDER[phase];
  return AI_LADDER_RUNG_ORDER.map((rungId) => {
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
// Adapter: OperationalToolData sections -> DiscoverySession (defensive, store-agnostic)
// ---------------------------------------------------------------------------

const asReadiness = (raw: unknown): DataReadiness =>
  raw === 'ready' || raw === 'partial' || raw === 'missing' ? raw : 'missing';

const asPhase = (raw: unknown): AiPhaseId | undefined =>
  raw === 'discover' || raw === 'feasibility' || raw === 'value' || raw === 'sequence'
    ? raw
    : undefined;

const asLevel = (raw: unknown): 'high' | 'medium' | 'low' | undefined =>
  raw === 'high' || raw === 'medium' || raw === 'low' ? raw : undefined;

const asNumber = (raw: unknown): number | undefined =>
  typeof raw === 'number' && Number.isFinite(raw) ? raw : undefined;

/** Affirmative flag: boolean true or an explicit yes/true/1 string. */
const truthy = (raw: unknown): boolean =>
  raw === true || (typeof raw === 'string' && /^(true|yes|owned|1)$/i.test(raw.trim()));

/** Presence of a free-text value (e.g. an owner name) — any non-empty string or true. */
const present = (raw: unknown): boolean =>
  raw === true || (typeof raw === 'string' && raw.trim().length > 0);

/**
 * Extract a DiscoverySession from the operational tool's `sections`. Reads
 * `usecases` (or `use-cases`) and `moves` (or `prioritization`) defensively;
 * unknown data-readiness falls back to 'missing' rather than throwing.
 *
 * Convention on OperationalItem for use cases: `threshold` carries data
 * readiness (ready/partial/missing); `target` (or an `annualValue` field)
 * carries the value at stake; an `owner` (or `hasOwner` flag) marks a named
 * business owner; `impact` carries technical feasibility. For moves: `category`
 * carries the phase; impact/effort/evidence carry the scoring facts.
 */
export function toDiscoverySession(
  sections: Record<string, unknown[]> | undefined
): DiscoverySession {
  const rawUseCases = (sections?.['usecases'] ||
    sections?.['use-cases'] ||
    []) as unknown[] as Array<Record<string, unknown>>;
  const rawMoves = (sections?.['moves'] ||
    sections?.['prioritization'] ||
    []) as unknown[] as Array<Record<string, unknown>>;

  const useCases: AiUseCase[] = rawUseCases.map((item, idx) => ({
    id: String(item.id ?? `uc-${idx}`),
    dataReadiness: asReadiness(item.threshold),
    annualValue: asNumber(item.annualValue) ?? asNumber(item.target),
    hasOwner: truthy(item.hasOwner) || present(item.owner),
    feasibility: asLevel(item.impact),
    measured: asNumber(item.annualValue) !== undefined || asNumber(item.target) !== undefined,
  }));

  const moves: DiscoveryMoveItem[] = rawMoves.map((item, idx) => ({
    id: String(item.id ?? `move-${idx}`),
    phase: asPhase(item.category),
    impact: asLevel(item.impact),
    effort: asLevel(item.effort),
    evidence: Array.isArray(item.evidence) ? (item.evidence as string[]) : [],
  }));

  return { useCases, moves };
}
