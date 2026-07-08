/**
 * Digital Value Pool — config layer barrel.
 *
 * SSOT for the value-at-stake methodology content and its deterministic
 * synthesis engine. Cloned from the Inventory Autopilot config pattern
 * (src/config/inventoryautopilot):
 *   - deepeningLadder.ts    : per-phase depth staircase + partner-grade proposal bank (PL/EN)
 *   - valuePoolEngine.ts    : value-at-stake decomposition + priority matrix + 80/20 concentration
 *                             + feasibility gate ("pilot without scale") + dead fields + W2 roadmap
 *   - conclusionPrompts.ts  : INSIGHT-FIRST AI prompt builder grounded in the engine output
 *
 * Self-contained: the engine reads a minimal ValuePoolSession, and this barrel
 * offers a defensive adapter from the store's OperationalToolData sections so
 * callers never have to reach into section internals.
 *
 * Doctrine SSOT: Harvard/wdrozenie-100/_TOOLS_DOKTRYNA/digital-value-pool.md
 */

import {
  VALUE_POOL_DEEPENING_LADDER,
  VALUE_POOL_LADDER_RUNG_ORDER,
  type LadderRung,
  type ValuePoolPhaseId,
} from './deepeningLadder';
import type {
  UseCaseItem,
  ValueFunction,
  ValuePoolSession,
  ValueSide,
} from './valuePoolEngine';

export * from './deepeningLadder';
export * from './valuePoolEngine';
export * from './conclusionPrompts';

/** A ladder rung with strings resolved to a single language. */
export interface LocalizedRung {
  id: LadderRung['id'];
  depth: LadderRung['depth'];
  label: string;
  question: string;
  rationale: string;
}

/** Resolve a phase's deepening ladder to one language, preserving rung order. */
export function localizeLadder(phase: ValuePoolPhaseId, isPolish: boolean): LocalizedRung[] {
  const rungs = VALUE_POOL_DEEPENING_LADDER[phase];
  return VALUE_POOL_LADDER_RUNG_ORDER.map((rungId) => {
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
// Adapter: OperationalToolData sections -> ValuePoolSession (defensive, store-agnostic)
// ---------------------------------------------------------------------------

const asSide = (raw: unknown): ValueSide => (raw === 'revenue' ? 'revenue' : 'cost');

const asPhase = (raw: unknown): ValuePoolPhaseId | undefined =>
  raw === 'decompose' || raw === 'size' || raw === 'prioritize' || raw === 'sequence'
    ? raw
    : undefined;

const asLevel = (raw: unknown): 'high' | 'medium' | 'low' | undefined =>
  raw === 'high' || raw === 'medium' || raw === 'low' ? raw : undefined;

const asNumber = (raw: unknown): number | undefined =>
  typeof raw === 'number' && Number.isFinite(raw) ? raw : undefined;

/** Parse a benchmark share into 0..1 (accepts 0.2 or "20" or "20%"). */
const asShare = (raw: unknown): number | undefined => {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw > 1 ? raw / 100 : raw;
  if (typeof raw === 'string') {
    const n = parseFloat(raw.replace('%', '').trim());
    if (Number.isFinite(n)) return n > 1 ? n / 100 : n;
  }
  return undefined;
};

const truthy = (raw: unknown): boolean =>
  raw === true || (typeof raw === 'string' && /true|yes|ready|owned|1/i.test(raw));

/** A tri-state flag: explicit true/false, or undefined when unknown (so the gate does not fire on silence). */
const triFlag = (raw: unknown): boolean | undefined => {
  if (raw === true || raw === false) return raw;
  if (typeof raw === 'string') {
    if (/^(true|yes|ready|owned|1)$/i.test(raw.trim())) return true;
    if (/^(false|no|blocked|missing|0)$/i.test(raw.trim())) return false;
  }
  return undefined;
};

/**
 * Extract a ValuePoolSession from the operational tool's `sections`. Reads
 * `functions` (or `pools`) and `useCases` (or `moves`) defensively; unknown
 * values fall back to sane defaults (side cost, no benchmark) rather than
 * throwing.
 *
 * Convention on OperationalItem for functions: `category` carries the side
 * (cost/revenue); `target` carries the cost/revenue base; `threshold` carries
 * the benchmark share. For use-cases: `category` carries the functionId;
 * `phase`/impact/feasibility carry the scoring facts; `target` carries the
 * bottom-up value; boolean-ish fields (dataReady/hasOwner/scalable/
 * businessMetric) carry the scale-gate signals.
 */
export function toValuePoolSession(
  sections: Record<string, unknown[]> | undefined
): ValuePoolSession {
  const rawFunctions = ((sections?.['functions'] || sections?.['pools'] || []) as unknown[]) as Array<
    Record<string, unknown>
  >;
  const rawUseCases = ((sections?.['useCases'] ||
    sections?.['use_cases'] ||
    sections?.['moves'] ||
    []) as unknown[]) as Array<Record<string, unknown>>;

  const functions: ValueFunction[] = rawFunctions.map((item, idx) => ({
    id: String(item.id ?? `fn-${idx}`),
    name: typeof item.name === 'string' ? item.name : typeof item.title === 'string' ? item.title : undefined,
    side: asSide(item.side ?? item.category),
    base: asNumber(item.base) ?? asNumber(item.target),
    benchmarkShare: asShare(item.benchmarkShare) ?? asShare(item.threshold),
    measured:
      truthy(item.measured) ||
      asNumber(item.base) !== undefined ||
      asNumber(item.target) !== undefined,
  }));

  const useCases: UseCaseItem[] = rawUseCases.map((item, idx) => ({
    id: String(item.id ?? `uc-${idx}`),
    functionId:
      typeof item.functionId === 'string'
        ? item.functionId
        : typeof item.category === 'string'
          ? item.category
          : undefined,
    phase: asPhase(item.phase),
    impact: asLevel(item.impact),
    feasibility: asLevel(item.feasibility),
    bottomUpValue: asNumber(item.bottomUpValue) ?? asNumber(item.target),
    dataReady: triFlag(item.dataReady),
    hasOwner: triFlag(item.hasOwner),
    scalable: triFlag(item.scalable),
    businessMetric: triFlag(item.businessMetric),
  }));

  return { functions, useCases };
}
