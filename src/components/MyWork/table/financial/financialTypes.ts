/**
 * Financial Case types — Idea Table (Matryca) financial layer, Program E / epic E09.
 *
 * SSOT:
 *   - docs/qa/ideas-manual-audit-2026-08-09/09_IDEAS_COMPLETE_TRANSFORMATION_PROGRAM_FOR_CLAUDE.md
 *     §7 (Financial competence layer) — §7.1 inputs, §7.2 calculations, §7.3 UX,
 *     §7.4 acceptance case.
 *   - docs/qa/ideas-manual-audit-2026-08-09/11_IDEAS_EPICS_DOD_AND_FINAL_ACCEPTANCE_PROTOCOL.md
 *     epic E09.
 *
 * ── THE SEAM WITH THE CALCULATION ENGINE (sibling workstream, same epic E09) ──
 * This file owns the UI-facing contract: `FinancialCaseInput` goes IN,
 * `FinancialCaseResult` comes OUT, via `FinancialComputeFn`. The actual math
 * (gross/net benefit, cash flow, ROI, NPV, payback, BCR, sensitivity) is built
 * by a sibling agent and is DELIBERATELY NOT implemented anywhere in this
 * directory. `useFinancialCase.ts` only ever calls the `FinancialComputeFn` it
 * is given as a prop — when none is supplied it shows an honest "blocked —
 * calculation engine not connected" state rather than fabricating numbers
 * (Z3: zero placeholders that look like results).
 *
 * Reconciliation note for the orchestrator: if the sibling engine's real
 * function name/shape differs from `FinancialComputeFn` below, the fix is a
 * one-line adapter at the call site in `FinancialCaseView.tsx` (`computeFn`
 * prop) — nothing else in this directory needs to change, because every
 * other component only knows about `FinancialCaseInput`/`FinancialCaseResult`.
 */

export type FinancialDriverKind = 'cost' | 'benefit';
export type FinancialCostType = 'investment' | 'recurring';
/** §7.4 requires one `non_cash` and one `risk_avoidance` benefit, kept visually
 * distinct from ordinary `cash` benefits — never silently pooled. */
export type FinancialBenefitType = 'cash' | 'non_cash' | 'risk_avoidance';
export type FinancialConfidence = 'low' | 'medium' | 'high';
export type FinancialScenarioId = 'base' | 'upside' | 'downside';

export const FINANCIAL_SCENARIOS: FinancialScenarioId[] = ['base', 'upside', 'downside'];

export interface FinancialEvidenceRef {
  id: string;
  label: string;
  sourceDate?: string;
  url?: string;
}

export interface FinancialDriver {
  id: string;
  label: string;
  kind: FinancialDriverKind;
  /** Required when kind === 'cost'. */
  costType?: FinancialCostType;
  /** Required when kind === 'benefit'. */
  benefitType?: FinancialBenefitType;
  category: string;
  /** Unit of the raw quantity — 'PLN', 'EUR', 'hrs', 'FTE', etc. Money drivers
   * carry the case currency; non-cash drivers name their own unit. */
  unit: string;
  /** Monthly values across the implementation + benefit ramp. Key = 'YYYY-MM'. */
  monthlyValues: Record<string, number>;
  /** Per-scenario multiplier relative to Base (1 = unchanged). Base is always 1
   * and is not stored — only Upside/Downside deltas are driver-authored, per
   * §7.1 "Scenarios: Base, Upside, Downside with driver differences, not
   * copied totals". */
  scenarioMultipliers: Partial<Record<Exclude<FinancialScenarioId, 'base'>, number>>;
  confidence: FinancialConfidence;
  evidence: FinancialEvidenceRef[];
  notes?: string;
  updatedAt: string;
}

export interface FinancialCaseInput {
  currency: string; // ISO 4217, e.g. 'PLN'
  discountRatePct: number; // annual discount rate for NPV
  startPeriod: string; // 'YYYY-MM'
  horizonMonths: number;
  drivers: FinancialDriver[];
  scenarios: FinancialScenarioId[];
}

export interface FinancialPeriodResult {
  period: string; // 'YYYY-MM'
  cost: number;
  benefit: number;
  netCashFlow: number;
  cumulativeCashFlow: number;
}

export interface FinancialScenarioResult {
  scenario: FinancialScenarioId;
  periods: FinancialPeriodResult[];
  /** `null` when the engine cannot derive a representative full year from the
   * case horizon (e.g. horizonMonths < 12) — see `computeAnnualBenefit`'s
   * `representativeYearRange` in `src/services/ideaFinance/engine.ts`. Not
   * every case has an annual figure; never fabricated as 0 (Z3). */
  grossAnnualBenefit: number | null;
  netAnnualBenefit: number | null;
  /** `null` only if the engine's schedule builder itself rejects the case
   * (see `warnings` for the reason) — structurally distinct from "no cost
   * drivers yet", which is `0`. */
  implementationCost: number | null;
  recurringCostAnnual: number | null;
  roiPct: number | null;
  npv: number | null;
  paybackMonths: number | null;
  benefitCostRatio: number | null;
}

export interface FinancialSensitivityRow {
  driverId: string;
  driverLabel: string;
  baseNpv: number;
  /** NPV with this driver at -20%. */
  lowNpv: number;
  /** NPV with this driver at +20%. */
  highNpv: number;
}

export interface FinancialCaseWarning {
  code: string;
  message: string;
  driverId?: string;
}

export interface FinancialCaseResult {
  formulaVersion: string;
  computedAt: string;
  currency: string;
  scenarios: Partial<Record<FinancialScenarioId, FinancialScenarioResult>>;
  sensitivity: FinancialSensitivityRow[];
  warnings: FinancialCaseWarning[];
}

/**
 * The exact function signature this UI calls. Owned/implemented by the
 * sibling calculation-engine workstream (Program E, E09). Pure: same input →
 * same output, no I/O. May return sync or a Promise; `useFinancialCase.ts`
 * awaits either.
 */
export type FinancialComputeFn = (
  input: FinancialCaseInput
) => FinancialCaseResult | Promise<FinancialCaseResult>;

export type FinancialCaseStatus =
  | 'empty' // no drivers yet
  | 'stale' // drivers/case meta changed since last successful compute
  | 'computing'
  | 'fresh' // result matches current input
  | 'blocked' // no computeFn wired — honest, not a fake zero result
  | 'error'; // computeFn threw or returned malformed data

/** §7.4 minimums: at least 3 cost and 3 benefit drivers. */
export const MIN_DRIVERS_PER_KIND = 3;
