/**
 * Finance v3 canonical — Enterprise Valuation compute, discounting layer (Gate D / Fala 7, WP-D10).
 *
 * Discounts each projection year's FCFF plus the terminal value back to present value at the
 * variant's computed WACC, and sums to Enterprise Value. End-of-year discounting convention
 * (`discountFactor(t) = 1 / (1 + WACC)^t`, `t` = whole years from the valuation date to each
 * period's END), the standard textbook convention — applied without escalation per DEC-FIN-012, the
 * same "adopt the unambiguous professional standard" judgment call `valuationWaccService.ts` already
 * makes for Hamada relevering. The terminal value is discounted at the SAME factor as the final
 * projection year (both sit at the end of the explicit forecast horizon).
 *
 * Pure module — no DB I/O, mirroring `baselineScheduleEngine.ts`'s "pure math over caller-supplied
 * scalars" discipline. `valuationComputeService.ts` is the only caller that reads
 * `finance_valuation_wacc_inputs`/writes `finance_valuation_methods.result_ev_decimal` around this.
 */

export interface YearlyFcff {
  fiscalYear: number;
  /** Full presentation-currency units — must already be unit/multiplier-normalized upstream. */
  fcff: number;
}

export interface DiscountedYear {
  fiscalYear: number;
  t: number;
  discountFactor: number;
  presentValue: number;
}

export interface DiscountCashFlowsResult {
  years: DiscountedYear[];
  presentValueOfExplicitFcff: number;
  presentValueOfTerminal: number;
  enterpriseValue: number;
  terminalSharePct: number | null;
}

export function discountFactor(waccPct: number, t: number): number {
  return 1 / Math.pow(1 + waccPct / 100, t);
}

/**
 * `years` must be chronologically ordered, one entry per explicit projection year (t = 1, 2, 3, ...
 * — the FIRST projection year is always one full period from the valuation date). `terminalValue`
 * is assumed to sit at the end of the LAST projection year (t = years.length) — the standard
 * Gordon-Growth-at-horizon-end convention.
 */
export function discountCashFlows(params: {
  years: readonly YearlyFcff[];
  waccPct: number;
  terminalValue: number;
}): DiscountCashFlowsResult {
  const discounted: DiscountedYear[] = params.years.map((y, idx) => {
    const t = idx + 1;
    const factor = discountFactor(params.waccPct, t);
    return { fiscalYear: y.fiscalYear, t, discountFactor: factor, presentValue: y.fcff * factor };
  });

  const presentValueOfExplicitFcff = discounted.reduce((sum, d) => sum + d.presentValue, 0);
  const terminalT = params.years.length;
  const terminalDiscountFactor = discountFactor(params.waccPct, terminalT);
  const presentValueOfTerminal = params.terminalValue * terminalDiscountFactor;
  const enterpriseValue = presentValueOfExplicitFcff + presentValueOfTerminal;
  const terminalSharePct = enterpriseValue !== 0 ? (presentValueOfTerminal / enterpriseValue) * 100 : null;

  return {
    years: discounted,
    presentValueOfExplicitFcff,
    presentValueOfTerminal,
    enterpriseValue,
    terminalSharePct,
  };
}
