/**
 * Value Bridge Service (M16/3.1)
 *
 * Pure, side-effect-free functions that build a "value bridge" waterfall
 * from a set of initiatives. The waterfall visualises how transformation
 * value flows through maturity stages, from a Baseline of 0 up to value
 * actually Banked, exposing leakage between stages as 'decrease' bars.
 *
 * The output `steps[]` shape is consumed directly by the FinanceWaterfall
 * component (kind: 'start' | 'increase' | 'decrease' | 'total').
 *
 * Mapping an M13 initiative status -> value stage is a follow-up; here the
 * caller supplies `stage` directly on each initiative.
 */

// ==========================================
// TYPES
// ==========================================

export type ValueStage = 'identified' | 'committed' | 'in_flight' | 'realized' | 'banked';

export interface ValueBridgeInitiative {
  id: string;
  name?: string;
  /** NPV / benefit value attributed to the initiative. */
  value: number;
  /** Maturity stage of the value (caller-supplied). */
  stage: ValueStage;
}

export type WaterfallStepKind = 'start' | 'increase' | 'decrease' | 'total';

export interface WaterfallStep {
  label: string;
  value: number;
  kind: WaterfallStepKind;
}

export interface ValueBridge {
  steps: WaterfallStep[];
  /** Total value that has reached the Realized + Banked stages. */
  totalRealized: number;
  /** Total value across every stage (everything identified and beyond). */
  totalIdentified: number;
}

export interface StageBreakdownEntry {
  stage: ValueStage;
  count: number;
  value: number;
  /** Initiative names (falling back to id) at this stage. */
  initiatives: string[];
}

// ==========================================
// CONSTANTS
// ==========================================

/** Canonical stage order, ascending in maturity. */
const STAGE_ORDER: ValueStage[] = ['identified', 'committed', 'in_flight', 'realized', 'banked'];

/** Human-friendly labels for each stage bar in the waterfall. */
const STAGE_LABELS: Record<ValueStage, string> = {
  identified: 'Identified',
  committed: 'Committed',
  in_flight: 'In-flight',
  realized: 'Realized',
  banked: 'Banked',
};

// ==========================================
// HELPERS
// ==========================================

function isFiniteNumber(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n);
}

/** Coerce an initiative value to a safe, finite number (0 otherwise). */
function safeValue(value: unknown): number {
  return isFiniteNumber(value) ? value : 0;
}

/** Sum value per stage. Always returns an entry for every canonical stage. */
function sumByStage(initiatives: ValueBridgeInitiative[]): Record<ValueStage, number> {
  const totals: Record<ValueStage, number> = {
    identified: 0,
    committed: 0,
    in_flight: 0,
    realized: 0,
    banked: 0,
  };

  for (const init of initiatives ?? []) {
    if (!init || !STAGE_ORDER.includes(init.stage)) continue;
    totals[init.stage] += safeValue(init.value);
  }

  return totals;
}

// ==========================================
// PUBLIC API
// ==========================================

/**
 * Build the value-bridge waterfall.
 *
 * Bars: Baseline(0) -> Identified -> Committed -> In-flight -> Realized -> Banked.
 * Each stage bar carries the summed value of initiatives at that stage. Stages
 * whose value is lower than the preceding stage render as 'decrease' (leakage);
 * stages with higher value render as 'increase'. A terminal 'total' bar reflects
 * the final cumulative (banked) position.
 */
export function buildValueBridge(initiatives: ValueBridgeInitiative[]): ValueBridge {
  const totals = sumByStage(initiatives);

  const steps: WaterfallStep[] = [];

  // Baseline anchor at 0.
  steps.push({ label: 'Baseline', value: 0, kind: 'start' });

  // Walk the maturity ladder. The first stage (Identified) is measured from
  // the 0 baseline, so it is always an 'increase' of its own magnitude.
  // Each subsequent stage is a delta vs. the previous stage's absolute value:
  // a drop = leakage = 'decrease', a rise = 'increase'.
  let prevAbsolute = 0;
  for (const stage of STAGE_ORDER) {
    const absolute = totals[stage];
    const delta = absolute - prevAbsolute;
    steps.push({
      label: STAGE_LABELS[stage],
      value: Math.abs(delta),
      kind: delta < 0 ? 'decrease' : 'increase',
    });
    prevAbsolute = absolute;
  }

  // Terminal total = final cumulative position (value actually banked).
  steps.push({ label: 'Net Value', value: prevAbsolute, kind: 'total' });

  const totalIdentified = totals.identified;
  const totalRealized = totals.realized + totals.banked;

  return { steps, totalRealized, totalIdentified };
}

/**
 * Drill-down per stage: count, summed value, and initiative names for each
 * canonical stage. Stages with no initiatives are still returned (count 0).
 */
export function stageBreakdown(initiatives: ValueBridgeInitiative[]): StageBreakdownEntry[] {
  const buckets: Record<ValueStage, StageBreakdownEntry> = {
    identified: { stage: 'identified', count: 0, value: 0, initiatives: [] },
    committed: { stage: 'committed', count: 0, value: 0, initiatives: [] },
    in_flight: { stage: 'in_flight', count: 0, value: 0, initiatives: [] },
    realized: { stage: 'realized', count: 0, value: 0, initiatives: [] },
    banked: { stage: 'banked', count: 0, value: 0, initiatives: [] },
  };

  for (const init of initiatives ?? []) {
    if (!init || !STAGE_ORDER.includes(init.stage)) continue;
    const bucket = buckets[init.stage];
    bucket.count += 1;
    bucket.value += safeValue(init.value);
    bucket.initiatives.push(init.name?.trim() || init.id);
  }

  return STAGE_ORDER.map((stage) => buckets[stage]);
}
