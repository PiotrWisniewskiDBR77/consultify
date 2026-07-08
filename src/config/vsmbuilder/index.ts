/**
 * VSM Builder — config layer barrel.
 *
 * SSOT for the Value-Stream-Mapping methodology content and its deterministic
 * synthesis engine. Cloned from the Inventory Autopilot config pattern
 * (src/config/inventoryautopilot):
 *   - deepeningLadder.ts   : per-lever depth staircase + partner-grade proposal bank (PL/EN)
 *   - vsmEngine.ts         : baseline (PCE, constraint, waste, hidden factory) + scoring
 *                            + W2 kaizen move sequencing (rationale/trade-off/rejected variant)
 *   - conclusionPrompts.ts : insight-first AI prompt builders grounded in the engine output
 *
 * Self-contained: the engine reads a minimal VsmSession, and this barrel offers
 * a defensive adapter from the store's OperationalToolData sections so callers
 * never have to reach into section internals.
 */

import {
  VSM_DEEPENING_LADDER,
  VSM_LADDER_RUNG_ORDER,
  type VsmLeverId,
  type LadderRung,
} from './deepeningLadder';
import type {
  KaizenMoveItem,
  MudaType,
  ProcessStep,
  StepValueType,
  VsmSession,
} from './vsmEngine';

export * from './deepeningLadder';
export * from './vsmEngine';
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
export function localizeLadder(lever: VsmLeverId, isPolish: boolean): LocalizedRung[] {
  const rungs = VSM_DEEPENING_LADDER[lever];
  return VSM_LADDER_RUNG_ORDER.map((rungId) => {
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
// Adapter: OperationalToolData sections -> VsmSession (defensive, store-agnostic)
// ---------------------------------------------------------------------------

const asNumber = (raw: unknown): number | undefined =>
  typeof raw === 'number' && Number.isFinite(raw) ? raw : undefined;

/** Parse a 0..1 fraction from either a fraction (0.92) or a percent (92). */
const asFraction = (raw: unknown): number | undefined => {
  const n = asNumber(raw);
  if (n === undefined) return undefined;
  return n > 1 ? n / 100 : n;
};

const asValueType = (raw: unknown): StepValueType | undefined =>
  raw === 'value-add' || raw === 'necessary-nva' || raw === 'pure-waste' ? raw : undefined;

const MUDA_TYPES: MudaType[] = [
  'overproduction',
  'waiting',
  'transport',
  'over-processing',
  'inventory',
  'motion',
  'defects',
  'unused-talent',
];
const asMuda = (raw: unknown): MudaType | undefined =>
  typeof raw === 'string' && (MUDA_TYPES as string[]).includes(raw) ? (raw as MudaType) : undefined;

const asLever = (raw: unknown): VsmLeverId | undefined =>
  raw === 'flow' || raw === 'bottleneck' || raw === 'waste' || raw === 'rework' ? raw : undefined;

const truthy = (raw: unknown): boolean =>
  raw === true || (typeof raw === 'string' && /true|yes|measured|1/i.test(raw));

/**
 * Extract a VsmSession from the operational tool's `sections`. Reads `steps`
 * (or `stages`) and `moves` (or `kaizen`) defensively; unknown categories fall
 * back to sane defaults rather than throwing.
 *
 * Convention on OperationalItem for process steps: `cycleTime` / `leadTime` /
 * `wipBefore` / `uptime` / `completeAccurate` / `fte` carry the process data
 * box; `category` carries the value type (value-add / necessary-nva /
 * pure-waste); `threshold` (text) carries the muda type; a `measured` flag marks
 * gemba-measured steps. For moves: `category` carries the lever; impact / effort
 * / evidence carry the scoring facts. Framing (`demand`, `monthlyVolume`,
 * `availableTime` → takt time) is read from a top-level section or the first
 * step if present.
 */
export function toVsmSession(sections: Record<string, unknown[]> | undefined): VsmSession {
  const rawSteps = ((sections?.['steps'] || sections?.['stages'] || []) as unknown[]) as Array<
    Record<string, unknown>
  >;
  const rawMoves = ((sections?.['moves'] || sections?.['kaizen'] || []) as unknown[]) as Array<
    Record<string, unknown>
  >;

  const steps: ProcessStep[] = rawSteps.map((item, idx) => ({
    id: String(item.id ?? item.name ?? `step-${idx}`),
    cycleTime: asNumber(item.cycleTime) ?? asNumber(item.ct),
    leadTime: asNumber(item.leadTime) ?? asNumber(item.lt),
    wipBefore: asNumber(item.wipBefore) ?? asNumber(item.wip),
    uptime: asFraction(item.uptime),
    completeAccurate: asFraction(item.completeAccurate) ?? asFraction(item.ca),
    fte: asNumber(item.fte),
    valueType: asValueType(item.category) ?? asValueType(item.valueType),
    muda: asMuda(item.threshold) ?? asMuda(item.muda),
    measured:
      truthy(item.measured) ||
      asNumber(item.cycleTime) !== undefined ||
      asNumber(item.leadTime) !== undefined,
  }));

  const moves: KaizenMoveItem[] = rawMoves.map((item, idx) => ({
    id: String(item.id ?? `move-${idx}`),
    lever: asLever(item.category) ?? asLever(item.lever),
    impact: (item.impact as KaizenMoveItem['impact']) ?? undefined,
    effort: (item.effort as KaizenMoveItem['effort']) ?? undefined,
    evidence: Array.isArray(item.evidence) ? (item.evidence as string[]) : [],
  }));

  const demand = asNumber(sections?.['demand']?.[0]) ?? undefined;
  const monthlyVolume =
    asNumber((rawSteps[0] as Record<string, unknown> | undefined)?.monthlyVolume) ??
    asNumber(sections?.['volume']?.[0]) ??
    undefined;
  const availableTime =
    asNumber(sections?.['availableTime']?.[0]) ??
    asNumber((rawSteps[0] as Record<string, unknown> | undefined)?.availableTime) ??
    undefined;

  return { steps, moves, demand, monthlyVolume, availableTime };
}
