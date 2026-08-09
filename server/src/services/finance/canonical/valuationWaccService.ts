/**
 * Finance v3 canonical — Enterprise Valuation compute, WACC layer (Gate D / Fala 7, WP-D10).
 *
 * Program: handoff section 9 ("WACC: currency/nominal-real/pre-post-tax consistency, risk-free/ERP/
 * beta peer set/unlever/relever, target/current capital structure, cost of debt/spread/tax shield").
 * Schema: `WP-D09_valuation_schema_ADR.md` section 6 (`finance_valuation_wacc_inputs` bundle,
 * `wacc_computed_pct` NULL until computed — no silent zero) and section 15 point 2 (currency/
 * nominal-real/pre-post-tax consistency is "kontraktowana, nie egzekwowana schematem... zakres
 * przyszłego Valuation Compute WP" — THIS module is that WP; it is the service-layer enforcement
 * point the ADR explicitly deferred).
 *
 * Beta unlever/relever — Hamada equation (DEC-FIN-012: "dla zagadnień objętych jednoznacznym
 * profesjonalnym standardem... zespół przyjmuje najwyższy uzasadniony standard bez eskalowania").
 * Hamada is the standard, textbook relationship between an asset (unlevered) beta and an equity
 * (levered) beta under a target capital structure:
 *
 *   beta_relevered = beta_unlevered * (1 + (1 - taxRate) * (D / E))
 *
 * using the TARGET (not current) capital structure D/E — WACC is a forward-looking discount rate
 * for the target financing mix the business is being valued at, not a snapshot of today's leverage
 * (`current_capital_structure_*_pct` exists on the same row for disclosure/cross-check, not as the
 * relevering input). This choice is applied without escalation, per DEC-FIN-012 — it is the
 * conventional professional standard, not a novel judgment call.
 *
 * WACC (post-tax, the only convention this engine supports — see `assertWaccConsistency` below):
 *
 *   costOfEquity = riskFreeRatePct + betaRelevered * equityRiskPremiumPct
 *   costOfDebtAfterTax = costOfDebtPretaxPct * (1 - cashTaxRatePct / 100)
 *   wacc = (targetEquityPct / 100) * costOfEquity + (targetDebtPct / 100) * costOfDebtAfterTax
 */

import { withPinnedPostgresTransaction } from '../../../database/PostgresDatabase.js';

// ---------------------------------------------------------------------------
// Shapes
// ---------------------------------------------------------------------------

export interface WaccInputsRow {
  id: string;
  organization_id: string;
  business_version_id: string;
  risk_free_rate_pct: string | null;
  equity_risk_premium_pct: string | null;
  beta_unlevered: string | null;
  beta_relevered: string | null;
  target_capital_structure_debt_pct: string | null;
  target_capital_structure_equity_pct: string | null;
  current_capital_structure_debt_pct: string | null;
  current_capital_structure_equity_pct: string | null;
  cost_of_debt_pretax_pct: string | null;
  credit_spread_pct: string | null;
  cash_tax_rate_pct: string | null;
  currency: string;
  nominal_or_real: 'NOMINAL' | 'REAL';
  pre_or_post_tax: 'PRE_TAX' | 'POST_TAX';
  wacc_computed_pct: string | null;
}

export interface WaccBreakdown {
  betaRelevered: number;
  costOfEquityPct: number;
  costOfDebtAfterTaxPct: number;
  waccPct: number;
  targetDebtWeight: number;
  targetEquityWeight: number;
}

export type WaccErrorCode =
  | 'INCOMPLETE_WACC_INPUTS'
  | 'UNSUPPORTED_NOMINAL_REAL_CONVENTION'
  | 'UNSUPPORTED_PRE_POST_TAX_CONVENTION'
  | 'CURRENCY_MISMATCH'
  | 'CAPITAL_STRUCTURE_SUM_INVALID';

export type ComputeWaccResult =
  | { ok: true; breakdown: WaccBreakdown }
  | { ok: false; code: WaccErrorCode; message: string };

// ---------------------------------------------------------------------------
// Consistency gate — the service-layer enforcement the ADR (section 15 pt.2) deferred to this WP
// ---------------------------------------------------------------------------

/**
 * Both `baselineComputeService.ts` and `predictionComputeService.ts` produce NOMINAL, POST-TAX cash
 * flows (no inflation layer, no pre-tax WACC convention exists anywhere upstream in this program —
 * `EBIT * (1 - cash_tax_rate)` in the FCFF formula is itself already a post-tax construction). A
 * WACC bundle recorded as `REAL` or `PRE_TAX` would be numerically INCOMPATIBLE with those cash
 * flows if discounted together (a classic, well-known valuation error: mixing nominal cash flows
 * with a real discount rate, or after-tax cash flows with a pre-tax rate, silently over/under-states
 * EV). Per the task's own instruction ("odrzuć niespójną kombinację zamiast cicho liczyć błędnie"),
 * this is a hard rejection, not a warning — mirroring the same "hard block over silent wrong number"
 * judgment call the schema ADR already made for EV→Equity bridge `as_of` alignment (WP-D09 section 9).
 */
export function assertWaccConsistency(
  wacc: Pick<WaccInputsRow, 'nominal_or_real' | 'pre_or_post_tax' | 'currency'>,
  fcffCurrency: string
): { ok: true } | { ok: false; code: WaccErrorCode; message: string } {
  if (wacc.nominal_or_real !== 'NOMINAL') {
    return {
      ok: false,
      code: 'UNSUPPORTED_NOMINAL_REAL_CONVENTION',
      message: `finance_valuation_wacc_inputs.nominal_or_real='${wacc.nominal_or_real}' is inconsistent with this engine's NOMINAL FCFF (Baseline/Prediction compute produces nominal cash flows only, no inflation layer exists upstream) — recompute WACC on a NOMINAL basis or discount REAL cash flows instead`,
    };
  }
  if (wacc.pre_or_post_tax !== 'POST_TAX') {
    return {
      ok: false,
      code: 'UNSUPPORTED_PRE_POST_TAX_CONVENTION',
      message: `finance_valuation_wacc_inputs.pre_or_post_tax='${wacc.pre_or_post_tax}' is inconsistent with this engine's POST-TAX FCFF (FCFF = EBIT*(1-cash_tax_rate)+... is already an after-tax construction) — recompute WACC on a POST_TAX basis`,
    };
  }
  if (wacc.currency !== fcffCurrency) {
    return {
      ok: false,
      code: 'CURRENCY_MISMATCH',
      message: `finance_valuation_wacc_inputs.currency='${wacc.currency}' does not match the FCFF presentation currency '${fcffCurrency}' — WACC and cash flows must be denominated in the same currency before discounting`,
    };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Hamada unlever/relever + CAPM + WACC
// ---------------------------------------------------------------------------

export function relever(betaUnlevered: number, debtToEquity: number, cashTaxRatePct: number): number {
  return betaUnlevered * (1 + (1 - cashTaxRatePct / 100) * debtToEquity);
}

export function unlever(betaLevered: number, debtToEquity: number, cashTaxRatePct: number): number {
  return betaLevered / (1 + (1 - cashTaxRatePct / 100) * debtToEquity);
}

function requireNumber(value: string | null, field: string, missing: string[]): number {
  if (value === null || value === '') {
    missing.push(field);
    return NaN;
  }
  return Number(value);
}

/**
 * Pure computation — no DB I/O. `wacc` is the raw `finance_valuation_wacc_inputs` row;
 * `fcffCurrency` is the presentation currency the FCFF series was actually computed in
 * (`valuationFcffService.computeFcffSeries()`'s own `currency` field), so consistency is checked
 * against the REAL source data, not merely echoed back from the same table.
 */
export function computeWacc(wacc: WaccInputsRow, fcffCurrency: string): ComputeWaccResult {
  const consistency = assertWaccConsistency(wacc, fcffCurrency);
  if (!consistency.ok) return consistency;

  const missing: string[] = [];
  const riskFreeRatePct = requireNumber(wacc.risk_free_rate_pct, 'risk_free_rate_pct', missing);
  const equityRiskPremiumPct = requireNumber(wacc.equity_risk_premium_pct, 'equity_risk_premium_pct', missing);
  const betaUnlevered = requireNumber(wacc.beta_unlevered, 'beta_unlevered', missing);
  const targetDebtPct = requireNumber(wacc.target_capital_structure_debt_pct, 'target_capital_structure_debt_pct', missing);
  const targetEquityPct = requireNumber(wacc.target_capital_structure_equity_pct, 'target_capital_structure_equity_pct', missing);
  const costOfDebtPretaxPct = requireNumber(wacc.cost_of_debt_pretax_pct, 'cost_of_debt_pretax_pct', missing);
  const cashTaxRatePct = requireNumber(wacc.cash_tax_rate_pct, 'cash_tax_rate_pct', missing);

  if (missing.length > 0) {
    return {
      ok: false,
      code: 'INCOMPLETE_WACC_INPUTS',
      message: `finance_valuation_wacc_inputs is missing required field(s): ${missing.join(', ')}`,
    };
  }
  if (Math.abs(targetDebtPct + targetEquityPct - 100) > 0.01) {
    return {
      ok: false,
      code: 'CAPITAL_STRUCTURE_SUM_INVALID',
      message: `target capital structure sums to ${targetDebtPct + targetEquityPct}, not ~100 (chk_finance_wacc_target_structure_sum should have already rejected this at the DB layer)`,
    };
  }
  if (targetEquityPct <= 0) {
    return {
      ok: false,
      code: 'CAPITAL_STRUCTURE_SUM_INVALID',
      message: `target_capital_structure_equity_pct=${targetEquityPct} — Hamada relevering requires a positive equity weight (D/E undefined at 0% equity)`,
    };
  }

  const debtToEquity = targetDebtPct / targetEquityPct;
  const betaRelevered = relever(betaUnlevered, debtToEquity, cashTaxRatePct);
  const costOfEquityPct = riskFreeRatePct + betaRelevered * equityRiskPremiumPct;
  const costOfDebtAfterTaxPct = costOfDebtPretaxPct * (1 - cashTaxRatePct / 100);
  const targetDebtWeight = targetDebtPct / 100;
  const targetEquityWeight = targetEquityPct / 100;
  const waccPct = targetEquityWeight * costOfEquityPct + targetDebtWeight * costOfDebtAfterTaxPct;

  return {
    ok: true,
    breakdown: { betaRelevered, costOfEquityPct, costOfDebtAfterTaxPct, waccPct, targetDebtWeight, targetEquityWeight },
  };
}

// ---------------------------------------------------------------------------
// DB read/write
// ---------------------------------------------------------------------------

export async function loadWaccInputs(organizationId: string, businessVersionId: string): Promise<WaccInputsRow | null> {
  return withPinnedPostgresTransaction((tx) =>
    tx.queryOne<WaccInputsRow>(
      `SELECT * FROM finance_valuation_wacc_inputs WHERE organization_id = ? AND business_version_id = ?`,
      [organizationId, businessVersionId]
    )
  );
}

/**
 * Writes `wacc_computed_pct`/`beta_relevered` back onto the row. Never called with an incomplete or
 * inconsistent bundle — callers must check `computeWacc()`'s result first; this function assumes a
 * `{ ok: true }` breakdown was already produced from the SAME row being updated.
 */
export async function persistComputedWacc(
  organizationId: string,
  businessVersionId: string,
  breakdown: WaccBreakdown
): Promise<void> {
  await withPinnedPostgresTransaction((tx) =>
    tx.queryRun(
      `UPDATE finance_valuation_wacc_inputs
          SET wacc_computed_pct = ?, beta_relevered = ?, updated_at = now()
        WHERE organization_id = ? AND business_version_id = ?`,
      [breakdown.waccPct, breakdown.betaRelevered, organizationId, businessVersionId]
    )
  );
}
