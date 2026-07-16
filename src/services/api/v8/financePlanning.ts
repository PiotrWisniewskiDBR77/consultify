/**
 * M16 Planning-Suite bridge (wire-b) — typed FE client for the 2 previously
 * orphaned prognosis/variance engines that already have live v8 endpoints
 * (fala 4) but had zero UI:
 *
 *   - cashForecastService     → POST /api/v8/finance-planning/cash-forecast
 *   - varianceNarrationService → POST /api/v8/finance-intelligence/variance/narrate
 *
 * Both are stateless pure-function endpoints (no persistence) — see
 * server/src/routes/v8/finance-planning.routes.ts and
 * server/src/routes/v8/finance-intelligence.routes.ts for the server contract.
 * `v8Post` unwraps the `{ data, meta }` envelope, so callers here get the
 * inner `data` object directly.
 *
 * Gated behind the `m16PlanningSuite` flag (financeFeatureFlags.ts) — panels
 * consuming this client render only when the flag is on.
 *
 * wire-c adds 3 more previously orphaned engines from the same
 * finance-planning.routes.ts bridge, behind the independent `m16AdvancedSuite`
 * flag (default OFF):
 *
 *   - driverTreeService       → POST /api/v8/finance-planning/driver-tree/{evaluate,chart}
 *   - rollingForecastService  → POST /api/v8/finance-planning/rolling-forecast/{reforecast,roll-forward}
 *   - headcountPlannerService → POST /api/v8/finance-planning/headcount/{opex,summary}
 */
import { v8Post } from './client';

// ─────────────────────────────────────────────────────────────────────────
// Cash / liquidity forecast
// ─────────────────────────────────────────────────────────────────────────

export interface CashForecastPeriodInput {
  /** Period label, e.g. "2026-01", "M1", "Q1". Optional — index used as fallback. */
  period?: string;
  inflows: number;
  outflows: number;
}

export interface CashForecastRequest {
  openingCash: number;
  periods: CashForecastPeriodInput[];
  /** Optional flat monthly burn used to extrapolate runway past the forecast horizon. */
  monthlyBurn?: number;
  /** Optional safety floor — periods below it are flagged in `alerts`. */
  minCash?: number;
}

export interface CashForecastRow {
  period: string;
  inflows: number;
  outflows: number;
  netCash: number;
  closingCash: number;
}

export interface CashRunwayResult {
  runwayPeriods: number;
  cashOutPeriod: string | null;
}

export interface CashMinAlert {
  period: string;
  closingCash: number;
  shortfall: number;
}

export interface CashCurvePoint {
  t: string;
  cash: number;
}

export interface CashForecastResponse {
  forecast: CashForecastRow[];
  runway: CashRunwayResult;
  alerts: CashMinAlert[];
  curve: CashCurvePoint[];
}

export async function postCashForecast(body: CashForecastRequest): Promise<CashForecastResponse> {
  return v8Post<CashForecastResponse>('/finance-planning/cash-forecast', body);
}

// ─────────────────────────────────────────────────────────────────────────
// Variance narration
// ─────────────────────────────────────────────────────────────────────────

export interface VarianceBridgeLineInput {
  /** Human label of the line item, e.g. "Revenue", "COGS", "Marketing". */
  label: string;
  plan: number;
  actual: number;
  /** True for cost/expense lines (lower actual is favourable). */
  isCost?: boolean;
}

export interface VarianceNarrateRequest {
  bridge: VarianceBridgeLineInput[];
  /** Max drivers to return; defaults server-side to 3. */
  topN?: number;
}

export type VarianceDirection = 'favorable' | 'unfavorable' | 'neutral';

export interface VarianceDriver {
  line: string;
  contribution: number;
  pct: number;
  direction: VarianceDirection;
}

export interface VarianceNarration {
  headline: string;
  drivers: VarianceDriver[];
  commentary: string;
}

export interface TopVarianceDriver {
  line: string;
  variance: number;
  sharePct: number;
}

export type VarianceSeverity = 'on-track' | 'watch' | 'off-track';

export interface VarianceNarrateResponse {
  narration: VarianceNarration;
  drivers: TopVarianceDriver[];
  severity: VarianceSeverity;
}

export async function postVarianceNarrate(
  body: VarianceNarrateRequest
): Promise<VarianceNarrateResponse> {
  return v8Post<VarianceNarrateResponse>('/finance-intelligence/variance/narrate', body);
}

// ─────────────────────────────────────────────────────────────────────────
// Driver tree (wire-c)
// ─────────────────────────────────────────────────────────────────────────

/** Supported reducer operations for formula nodes. */
export type DriverOp = '+' | '-' | '*' | '/' | 'sum' | 'product';

/** A single node in a driver tree. */
export interface DriverNodeInput {
  /** Stable unique identifier, referenced by other nodes' `operands`. */
  id: string;
  /** Human-readable label, e.g. "Revenue". */
  label: string;
  /** `input` = raw leaf value; `formula` = derived from operands. */
  kind: 'input' | 'formula';
  /** Raw value for `input` nodes. Ignored for `formula` nodes. */
  value?: number;
  /** Optional human-readable formula string, e.g. "Customers × ARPU". */
  formula?: string;
  /** Ids of operand nodes (only meaningful for `formula` nodes). */
  operands?: string[];
  /** How operands are combined (only meaningful for `formula` nodes). */
  op?: DriverOp;
}

export interface DriverTreeEvaluateResponse {
  /** Computed numeric value per node id. */
  values: Record<string, number>;
  /** Topological evaluation order (leaves → roots). */
  order: string[];
}

export async function postDriverTreeEvaluate(
  nodes: DriverNodeInput[]
): Promise<DriverTreeEvaluateResponse> {
  return v8Post<DriverTreeEvaluateResponse>('/finance-planning/driver-tree/evaluate', { nodes });
}

/** Recursive chart shape consumed by the driver-tree panel. */
export interface DriverChartNode {
  id: string;
  label: string;
  value: number;
  formula?: string;
  op?: DriverOp;
  children: DriverChartNode[];
}

export interface DriverTreeChartResponse {
  root: DriverChartNode;
}

export async function postDriverTreeChart(
  nodes: DriverNodeInput[],
  values?: Record<string, number>
): Promise<DriverTreeChartResponse> {
  return v8Post<DriverTreeChartResponse>('/finance-planning/driver-tree/chart', {
    nodes,
    ...(values ? { values } : {}),
  });
}

// ─────────────────────────────────────────────────────────────────────────
// Rolling forecast (wire-c)
// ─────────────────────────────────────────────────────────────────────────

/** A single period/value pair (plan, actual, or forecast input). */
export interface PeriodValueInput {
  period: string;
  value: number;
}

/** A reforecast line: blended actual-or-forecast value with provenance. */
export interface ReforecastLine {
  period: string;
  value: number;
  source: 'actual' | 'forecast';
}

export async function postRollingReforecast(
  plan: PeriodValueInput[],
  actuals: PeriodValueInput[]
): Promise<{ lines: ReforecastLine[] }> {
  return v8Post<{ lines: ReforecastLine[] }>('/finance-planning/rolling-forecast/reforecast', {
    plan,
    actuals,
  });
}

export async function postRollingRollForward(
  forecast: PeriodValueInput[],
  byPeriods?: number
): Promise<{ lines: PeriodValueInput[] }> {
  return v8Post<{ lines: PeriodValueInput[] }>(
    '/finance-planning/rolling-forecast/roll-forward',
    { forecast, ...(byPeriods !== undefined ? { byPeriods } : {}) }
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Headcount planner (wire-c)
// ─────────────────────────────────────────────────────────────────────────

export interface HeadcountRoleInput {
  id: string;
  title: string;
  /** Per-period base salary (e.g. monthly gross), in the model's currency. */
  baseSalary: number;
  /** Benefits / on-cost load as a fraction (0.25 = +25%). */
  benefitsLoadPct: number;
  /** 0-based index into `periods` at which the role starts incurring cost. */
  startPeriod: number;
  /** Periods to reach full cost (0/1 = full cost from the start period). */
  rampMonths: number;
}

export interface HeadcountOpexRow {
  period: string;
  headcount: number;
  totalSalary: number;
  totalLoaded: number;
}

export async function postHeadcountOpex(
  roles: HeadcountRoleInput[],
  periods: string[]
): Promise<{ rows: HeadcountOpexRow[] }> {
  return v8Post<{ rows: HeadcountOpexRow[] }>('/finance-planning/headcount/opex', {
    roles,
    periods,
  });
}

export interface HeadcountSummary {
  totalRoles: number;
  avgLoadedAnnual: number;
}

export async function postHeadcountSummary(
  roles: HeadcountRoleInput[]
): Promise<{ summary: HeadcountSummary }> {
  return v8Post<{ summary: HeadcountSummary }>('/finance-planning/headcount/summary', { roles });
}
