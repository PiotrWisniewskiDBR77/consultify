/**
 * Constraint Control — config layer barrel.
 *
 * SSOT for the Theory-of-Constraints (Goldratt) methodology content and its
 * deterministic synthesis engine. Cloned from the Inventory Autopilot config
 * pattern (src/config/inventoryautopilot):
 *   - deepeningLadder.ts    : per-focusing-step depth staircase + partner-grade proposal bank (PL/EN)
 *   - constraintEngine.ts   : constraint location + T/I/OE + policy detection + Five-Focusing-Steps
 *                             ranking + W2 move sequencing (rationale/trade-off/rejected variant)
 *   - conclusionPrompts.ts  : AI prompt builders grounded in the engine output
 *
 * Self-contained: the engine reads a minimal ConstraintSession, and this barrel
 * offers a defensive adapter from the store's OperationalToolData sections so
 * callers never have to reach into section internals.
 */

import {
  CONSTRAINT_DEEPENING_LADDER,
  CONSTRAINT_LADDER_RUNG_ORDER,
  type FocusStepId,
  type LadderRung,
} from './deepeningLadder';
import type {
  ConstraintSession,
  FocusMoveItem,
  ProcessStep,
  ThroughputInputs,
} from './constraintEngine';

export * from './deepeningLadder';
export * from './constraintEngine';
export * from './conclusionPrompts';

/** A ladder rung with strings resolved to a single language. */
export interface LocalizedRung {
  id: LadderRung['id'];
  depth: LadderRung['depth'];
  label: string;
  question: string;
  rationale: string;
}

/** Resolve a focusing step's deepening ladder to one language, preserving rung order. */
export function localizeLadder(step: FocusStepId, isPolish: boolean): LocalizedRung[] {
  const rungs = CONSTRAINT_DEEPENING_LADDER[step];
  return CONSTRAINT_LADDER_RUNG_ORDER.map((rungId) => {
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
// Adapter: OperationalToolData sections -> ConstraintSession (defensive, store-agnostic)
// ---------------------------------------------------------------------------

const asStep = (raw: unknown): FocusStepId | undefined =>
  raw === 'identify' ||
  raw === 'exploit' ||
  raw === 'subordinate' ||
  raw === 'elevate' ||
  raw === 'policy'
    ? raw
    : undefined;

const asQueueTrend = (raw: unknown): ProcessStep['queueTrend'] =>
  raw === 'growing' || raw === 'stable' || raw === 'shrinking' ? raw : undefined;

const asNumber = (raw: unknown): number | undefined =>
  typeof raw === 'number' && Number.isFinite(raw) ? raw : undefined;

const truthy = (raw: unknown): boolean =>
  raw === true || (typeof raw === 'string' && /true|yes|1/i.test(raw));

/**
 * Extract a ConstraintSession from the operational tool's `sections`. Reads
 * `steps` (or `process`) and `moves` (or `focus`) and an optional `throughput`
 * (or `finance`) section defensively; unknown values fall back to undefined
 * rather than throwing.
 *
 * Convention on OperationalItem for process steps: `category`/`step` unused
 * (steps are the flow, not a step-lever); numeric fields carry `capacity`,
 * `demand`, `queue`; `threshold`/`trend` carries the queue trend; `utilization`
 * the reported busyness. For moves: `category` carries the focusing step
 * (identify/exploit/subordinate/elevate/policy); impact/effort/evidence carry
 * the scoring facts; `capitalSpend` flags CAPEX.
 */
export function toConstraintSession(
  sections: Record<string, unknown[]> | undefined
): ConstraintSession {
  const rawSteps = ((sections?.['steps'] || sections?.['process'] || []) as unknown[]) as Array<
    Record<string, unknown>
  >;
  const rawMoves = ((sections?.['moves'] || sections?.['focus'] || []) as unknown[]) as Array<
    Record<string, unknown>
  >;
  const rawThroughput = ((sections?.['throughput'] || sections?.['finance'] || []) as unknown[]) as Array<
    Record<string, unknown>
  >;

  const steps: ProcessStep[] = rawSteps.map((item, idx) => {
    const capacity = asNumber(item.capacity);
    const demand = asNumber(item.demand);
    const queue = asNumber(item.queue);
    return {
      id: String(item.id ?? `step-${idx}`),
      label: typeof item.label === 'string' ? item.label : typeof item.name === 'string' ? item.name : undefined,
      capacity,
      demand,
      queue,
      queueTrend: asQueueTrend(item.queueTrend ?? item.trend ?? item.threshold),
      utilization: asNumber(item.utilization),
      measured:
        capacity !== undefined || demand !== undefined || queue !== undefined,
    };
  });

  const moves: FocusMoveItem[] = rawMoves.map((item, idx) => ({
    id: String(item.id ?? `move-${idx}`),
    step: asStep(item.step ?? item.category),
    impact: (item.impact as FocusMoveItem['impact']) ?? undefined,
    effort: (item.effort as FocusMoveItem['effort']) ?? undefined,
    capitalSpend: truthy(item.capitalSpend),
    evidence: Array.isArray(item.evidence) ? (item.evidence as string[]) : [],
  }));

  // Throughput figures may arrive as a single-row section or as one item per
  // metric ({ metric: 'sales', value: N }); support both shapes.
  const throughput: ThroughputInputs = {};
  const first = rawThroughput[0] ?? {};
  const pick = (keys: string[]): number | undefined => {
    for (const k of keys) {
      const v = asNumber(first[k]);
      if (v !== undefined) return v;
    }
    // fallback: metric/value rows
    const row = rawThroughput.find(
      (r) => typeof r.metric === 'string' && keys.includes(String(r.metric))
    );
    return row ? asNumber(row.value) : undefined;
  };
  throughput.sales = pick(['sales']);
  throughput.totallyVariableCost = pick(['totallyVariableCost', 'tvc']);
  throughput.operatingExpense = pick(['operatingExpense', 'oe']);
  throughput.investment = pick(['investment', 'inventory', 'i']);

  const hasThroughput =
    throughput.sales !== undefined ||
    throughput.totallyVariableCost !== undefined ||
    throughput.operatingExpense !== undefined ||
    throughput.investment !== undefined;

  return { steps, moves, throughput: hasThroughput ? throughput : undefined };
}
