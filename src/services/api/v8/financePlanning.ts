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
