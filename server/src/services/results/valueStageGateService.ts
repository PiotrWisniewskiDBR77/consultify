/**
 * valueStageGateService — McKinsey value-capture doctrine (pure functions, zero DB).
 *
 * Initiative value matures through stages L0–L5 with rising confidence. We split
 * portfolio value into "banked" (realized) vs "forecast" (risk-weighted pipeline).
 *
 * All functions here are deterministic and side-effect free — they take plain
 * inputs and return plain outputs. No database, no I/O, no clock.
 */

export type ValueStage =
  | 'L0_idea'
  | 'L1_sized'
  | 'L2_validated'
  | 'L3_planned'
  | 'L4_inflight'
  | 'L5_realized';

/** Canonical maturity order, lowest (idea) → highest (realized). */
export const STAGE_ORDER: ValueStage[] = [
  'L0_idea',
  'L1_sized',
  'L2_validated',
  'L3_planned',
  'L4_inflight',
  'L5_realized',
];

/**
 * Default confidence per stage. Rises monotonically with maturity; L5 is fully
 * certain (1.0) because the value has been realized & verified.
 */
export const STAGE_DEFAULT_CONFIDENCE: Record<ValueStage, number> = {
  L0_idea: 0.1,
  L1_sized: 0.3,
  L2_validated: 0.5,
  L3_planned: 0.7,
  L4_inflight: 0.85,
  L5_realized: 1.0,
};

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function safeValue(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

/**
 * Risk-adjusted value = value × clamp(confidence, 0, 1).
 * Non-finite value/confidence degrade gracefully to 0.
 */
export function riskAdjustedValue(value: number, confidence: number): number {
  return safeValue(value) * clamp01(confidence);
}

/** Resolve effective confidence: explicit override, else stage default. */
function resolveConfidence(stage: ValueStage, confidence?: number): number {
  if (typeof confidence === 'number' && Number.isFinite(confidence)) {
    return clamp01(confidence);
  }
  return STAGE_DEFAULT_CONFIDENCE[stage] ?? 0;
}

export interface ClassifyValueInput {
  stage: ValueStage;
  value: number;
  confidence?: number;
}

export interface ClassifiedValue {
  banked: number;
  forecast: number;
  riskAdjusted: number;
}

/**
 * Classify a single value item into banked vs forecast.
 *
 * - L5_realized → the full (non-risk-adjusted) value is banked; forecast = 0.
 * - any other stage → forecast = risk-adjusted value; banked = 0.
 *
 * `riskAdjusted` is always reported for transparency (value × effective confidence).
 */
export function classifyValue(input: ClassifyValueInput): ClassifiedValue {
  const value = safeValue(input.value);
  const confidence = resolveConfidence(input.stage, input.confidence);
  const riskAdjusted = value * confidence;

  if (input.stage === 'L5_realized') {
    return { banked: value, forecast: 0, riskAdjusted };
  }

  return { banked: 0, forecast: riskAdjusted, riskAdjusted };
}

export interface InitiativeStageSignals {
  status?: string;
  hasRoiBaseline?: boolean;
  hasRealized?: boolean;
}

/**
 * Map an initiative's lifecycle status + data signals to a value stage.
 *
 * Status families (case-insensitive):
 *   DRAFT/PLANNING          → L0 (L1 once it has a sized ROI baseline)
 *   APPROVED/SCHEDULED      → L2 (L3 once planned with ROI baseline)
 *   EXECUTING/IN_PROGRESS/
 *     BLOCKED               → L4 (in-flight)
 *   DONE/COMPLETED/TRACKING → L5 if value realized, else L4
 *
 * `hasRoiBaseline` promotes a sized/planned initiative one notch within its band.
 * `hasRealized` is required to reach L5.
 */
export function stageFromInitiative(i: InitiativeStageSignals): ValueStage {
  const status = (i.status || '').trim().toUpperCase();
  const hasRoiBaseline = Boolean(i.hasRoiBaseline);
  const hasRealized = Boolean(i.hasRealized);

  switch (status) {
    case 'DRAFT':
    case 'PLANNING':
    case 'IDEA':
    case 'PROPOSED':
      // Early: idea by default, sized once a baseline exists.
      return hasRoiBaseline ? 'L1_sized' : 'L0_idea';

    case 'APPROVED':
    case 'SCHEDULED':
    case 'READY':
      // Validated by default, planned once a baseline exists.
      return hasRoiBaseline ? 'L3_planned' : 'L2_validated';

    case 'EXECUTING':
    case 'IN_PROGRESS':
    case 'ACTIVE':
    case 'BLOCKED':
    case 'ON_HOLD':
      return 'L4_inflight';

    case 'DONE':
    case 'COMPLETED':
    case 'TRACKING':
    case 'CLOSED':
      // Realized only when value is confirmed; otherwise still in-flight.
      return hasRealized ? 'L5_realized' : 'L4_inflight';

    default:
      // Unknown status: lean on data signals.
      if (hasRealized) return 'L5_realized';
      if (hasRoiBaseline) return 'L1_sized';
      return 'L0_idea';
  }
}

export interface PortfolioValueItem {
  stage: ValueStage;
  value: number;
  confidence?: number;
}

export interface PortfolioValueSplit {
  banked: number;
  forecast: number;
  total: number;
  riskAdjustedTotal: number;
}

/**
 * Aggregate a portfolio of value items into banked / forecast / total.
 *
 * - banked            = Σ banked (realized full value)
 * - forecast          = Σ forecast (risk-adjusted pipeline)
 * - total             = banked + forecast
 * - riskAdjustedTotal = Σ riskAdjusted across all items (banked items risk-adjust
 *                       to their full value since L5 confidence defaults to 1.0)
 */
export function portfolioValueSplit(items: PortfolioValueItem[]): PortfolioValueSplit {
  let banked = 0;
  let forecast = 0;
  let riskAdjustedTotal = 0;

  for (const item of items ?? []) {
    const c = classifyValue(item);
    banked += c.banked;
    forecast += c.forecast;
    riskAdjustedTotal += c.riskAdjusted;
  }

  return {
    banked,
    forecast,
    total: banked + forecast,
    riskAdjustedTotal,
  };
}
