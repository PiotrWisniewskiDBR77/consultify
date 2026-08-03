/**
 * FIN-005/FIN-006 — bridges the two existing, unconnected canonical engines
 * so a `financial_models` row can produce NPV / IRR / payback.
 *
 * `computeModel()` (financialModelingService.ts) turns a model's
 * `financial_model_events` into a period-by-period P&L/BS/CF — but it has no
 * concept of NPV, IRR or payback. `appraise()` (investmentAppraisalService.ts)
 * computes exactly those, but its input is a flat `{cashflows, initialInvestment}`
 * — it has no concept of a model or an event.
 *
 * This module contains ZERO financial formulas of its own. It only reshapes
 * `ComputeResult.periods` (already computed by the canonical engine) into the
 * `AppraisalInput` shape the canonical appraisal engine already expects — the
 * same shape its one production caller (`InvestmentAppraisalPanel.tsx`, via
 * `POST /api/v8/finance/value/appraise`) has always supplied by hand.
 *
 * Derivation (deliberately narrow, not a general capital-budgeting rulebook):
 *   - `initialInvestment` = the FIRST period's investing cash flow, negated and
 *     floored at 0. This mirrors the `/value/appraise` route's own convention
 *     of treating a leading outflow as the period-0 outlay (financeValueRoutes.ts,
 *     "first negative flow ... treated as the initial investment").
 *   - `cashflows[i]` = that period's OPERATING_CF + FINANCING_CF, plus its own
 *     INVESTING_CF for every period AFTER the first (investing activity in a
 *     later period is NOT pulled forward to t=0 — it stays in its own period).
 *   - WACC/discount rate and hurdle rate are ALWAYS caller-supplied parameters,
 *     matching investmentAppraisalService's own invariant ("never hardcoded").
 *     `financial_models` has no `discount_rate` column (verified against
 *     migrations/571_financial_modeling_t054.sql), so this module never reads
 *     the DB or a model row for a rate — it stays a pure reshape. The route
 *     layer (`GET /models/:modelId/appraisal`, finance.routes.ts) is what may
 *     resolve a canonical rate from `model.assumptions_json.discountRatePct` /
 *     `.hurdleRatePct` (or an explicit query param) BEFORE calling into this
 *     module — this module itself still never defaults or invents a number.
 */

import type { ComputeResult, PeriodOutput } from './financialModelingService.js';
import {
  type AppraisalInput,
  type AppraisalResult,
  appraise,
} from './investmentAppraisalService.js';

export interface ModelAppraisalRates {
  /** Discount rate / WACC in percent. Required — never defaulted (see module doc). */
  discountRatePct: number;
  /** Hurdle rate in percent. Defaults to `discountRatePct` (investmentAppraisalService's own MIRR convention). */
  hurdleRatePct?: number;
}

function periodNetOfInvesting(period: PeriodOutput): number {
  return (period.cf.OPERATING_CF ?? 0) + (period.cf.FINANCING_CF ?? 0);
}

/**
 * Pure reshape: `ComputeResult.periods` -> `AppraisalInput`. No DB access, no
 * new arithmetic beyond what `computeModel()` already produced per period.
 */
export function deriveAppraisalInputFromComputeResult(
  computeResult: Pick<ComputeResult, 'periods'>,
  rates: ModelAppraisalRates
): AppraisalInput {
  const periods = computeResult.periods;
  const discountRatePct = rates.discountRatePct;
  const hurdleRatePct = rates.hurdleRatePct ?? discountRatePct;

  if (periods.length === 0) {
    return { cashflows: [], initialInvestment: 0, discountRatePct, hurdleRatePct };
  }

  // Only a NET OUTFLOW in period 0 is extracted as the outlay. A net inflow
  // there (e.g. a divestment) is not an "investment" and stays in cashflows[0]
  // — extracting it would silently discard it, since it can't be negative.
  const firstInvesting = periods[0].cf.INVESTING_CF ?? 0;
  const initialInvestment = Math.max(0, -firstInvesting);
  const firstPeriodResidualInvesting = firstInvesting + initialInvestment; // 0 when extracted, firstInvesting unchanged when not

  const cashflows = periods.map((period, index) =>
    index === 0
      ? periodNetOfInvesting(period) + firstPeriodResidualInvesting
      : periodNetOfInvesting(period) + (period.cf.INVESTING_CF ?? 0)
  );

  return { cashflows, initialInvestment, discountRatePct, hurdleRatePct };
}

export interface ModelAppraisal {
  input: AppraisalInput;
  result: AppraisalResult;
  /** Period labels, in the same order as `input.cashflows`, for lineage/display. */
  periodLabels: string[];
}

/**
 * Compose `deriveAppraisalInputFromComputeResult` with the canonical
 * `appraise()` engine. Still zero new formulas — this is glue, not a second
 * engine.
 */
export function appraiseComputeResult(
  computeResult: Pick<ComputeResult, 'periods'>,
  rates: ModelAppraisalRates
): ModelAppraisal {
  const input = deriveAppraisalInputFromComputeResult(computeResult, rates);
  return {
    input,
    result: appraise(input),
    periodLabels: computeResult.periods.map((p) => p.label),
  };
}
