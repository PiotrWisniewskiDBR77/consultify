/**
 * Finance Schedules Service (M16/6.1)
 *
 * Pure, deterministic functions that produce the standard supporting
 * schedules behind any three-statement / DCF financial model. They replace
 * the audited P1 hard-coded assumptions (working-capital split 0.4/0.3/0.3,
 * manual debt amortization, manual depreciation, manual tax) with first-class,
 * driver-based calculations.
 *
 * All functions are side-effect free: same input → same output. No DB, no IO.
 *
 *   1. workingCapitalSchedule  — AR/Inventory/AP from DSO/DIO/DPO days
 *   2. debtSchedule            — opening→closing roll-forward, interest on balance
 *   3. depreciationSchedule    — CAPEX-driven, straight-line or declining-balance
 *   4. taxSchedule             — tax on positive EBT with NOL carry-forward
 */

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Days in a financial year used for DSO/DIO/DPO conversions. */
const DAYS_IN_YEAR = 365;

/** Coerce to a finite number, falling back to 0 for null/undefined/NaN. */
function num(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

/** Round to a sane number of decimals to avoid float noise in outputs. */
function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

// ─── 1. Working Capital Schedule ──────────────────────────────────────────────

export interface WorkingCapitalPeriodInput {
  revenue: number;
  cogs: number;
}

export interface WorkingCapitalScheduleInput {
  periods: WorkingCapitalPeriodInput[];
  /** Days Sales Outstanding — drives Accounts Receivable. */
  dso: number;
  /** Days Payable Outstanding — drives Accounts Payable. */
  dpo: number;
  /** Days Inventory Outstanding — drives Inventory. */
  dio: number;
}

export interface WorkingCapitalScheduleRow {
  period: number;
  ar: number;
  inventory: number;
  ap: number;
  netWorkingCapital: number;
  /** Change vs prior period NWC. Period 0 delta == its own NWC (build-up). */
  deltaWC: number;
}

/**
 * Driver-based working-capital schedule.
 *   AR        = revenue × DSO / 365
 *   Inventory = cogs    × DIO / 365
 *   AP        = cogs    × DPO / 365
 *   NWC       = AR + Inventory − AP
 *   ΔWC       = NWC(t) − NWC(t−1)
 */
export function workingCapitalSchedule(
  input: WorkingCapitalScheduleInput
): WorkingCapitalScheduleRow[] {
  const dso = num(input?.dso);
  const dpo = num(input?.dpo);
  const dio = num(input?.dio);
  const periods = Array.isArray(input?.periods) ? input.periods : [];

  let priorNwc = 0;

  return periods.map((p, idx) => {
    const revenue = num(p?.revenue);
    const cogs = num(p?.cogs);

    const ar = (revenue * dso) / DAYS_IN_YEAR;
    const inventory = (cogs * dio) / DAYS_IN_YEAR;
    const ap = (cogs * dpo) / DAYS_IN_YEAR;
    const netWorkingCapital = ar + inventory - ap;
    const deltaWC = netWorkingCapital - priorNwc;

    priorNwc = netWorkingCapital;

    return {
      period: idx,
      ar: round2(ar),
      inventory: round2(inventory),
      ap: round2(ap),
      netWorkingCapital: round2(netWorkingCapital),
      deltaWC: round2(deltaWC),
    };
  });
}

// ─── 2. Debt Schedule ─────────────────────────────────────────────────────────

export interface DebtScheduleInput {
  /** Debt balance at the start of period 0 (before any period-0 drawdown). */
  openingDebt: number;
  /** Annual interest rate, in percent (e.g. 8 == 8%). Applied to opening balance. */
  annualRatePct: number;
  /** Number of periods to project. */
  periods: number;
  /** Scheduled principal repayment applied each period (constant amortization). */
  repaymentPerPeriod: number;
  /** Optional per-period new drawdowns, indexed by period. */
  drawdowns?: number[];
}

export interface DebtScheduleRow {
  period: number;
  opening: number;
  drawdown: number;
  principalRepayment: number;
  interest: number;
  closing: number;
}

/**
 * Debt roll-forward schedule.
 *   interest           = opening × (annualRatePct / 100)
 *   principalRepayment = min(repaymentPerPeriod, opening + drawdown)   (never below 0)
 *   closing            = opening + drawdown − principalRepayment
 * Opening of period t = closing of period t−1, so the balance declines as
 * principal amortizes (interest shrinks with it).
 */
export function debtSchedule(input: DebtScheduleInput): DebtScheduleRow[] {
  const rate = num(input?.annualRatePct) / 100;
  const periods = Math.max(0, Math.floor(num(input?.periods)));
  const repayment = num(input?.repaymentPerPeriod);
  const drawdowns = Array.isArray(input?.drawdowns) ? input.drawdowns : [];

  const rows: DebtScheduleRow[] = [];
  let opening = num(input?.openingDebt);

  for (let i = 0; i < periods; i++) {
    const drawdown = num(drawdowns[i]);
    const available = opening + drawdown;
    // Interest accrues on the opening balance (before this period's movements).
    const interest = opening * rate;
    // Cannot repay more principal than outstanding.
    const principalRepayment = Math.min(Math.max(repayment, 0), Math.max(available, 0));
    const closing = available - principalRepayment;

    rows.push({
      period: i,
      opening: round2(opening),
      drawdown: round2(drawdown),
      principalRepayment: round2(principalRepayment),
      interest: round2(interest),
      closing: round2(closing),
    });

    opening = closing;
  }

  return rows;
}

// ─── 3. Depreciation Schedule ─────────────────────────────────────────────────

export type DepreciationMethod = 'straight_line' | 'declining';

export interface DepreciationScheduleInput {
  /** Net book value of existing PP&E at the start of period 0. */
  openingPPE: number;
  /** Useful life in years/periods used for the depreciation rate. */
  usefulLifeYears: number;
  /** CAPEX additions per period, indexed by period. Length drives # of rows. */
  capexByPeriod: number[];
  method: DepreciationMethod;
}

export interface DepreciationScheduleRow {
  period: number;
  capex: number;
  depreciation: number;
  accumulated: number;
  nbv: number;
}

/**
 * CAPEX-driven depreciation schedule on a single depreciable pool.
 *
 *   straight_line: depreciation = depreciableCost / usefulLife, capped so the
 *                  pool fully depreciates to 0 over its life (the sum of
 *                  straight-line charges equals the depreciable cost).
 *   declining:     depreciation = NBV × (1 / usefulLife) × 2  (double-declining),
 *                  capped at remaining NBV.
 *
 * `accumulated` is cumulative depreciation; `nbv` = cost − accumulated.
 */
export function depreciationSchedule(input: DepreciationScheduleInput): DepreciationScheduleRow[] {
  const life = Math.max(1, num(input?.usefulLifeYears));
  const method: DepreciationMethod = input?.method === 'declining' ? 'declining' : 'straight_line';
  const capexByPeriod = Array.isArray(input?.capexByPeriod) ? input.capexByPeriod : [];

  const rows: DepreciationScheduleRow[] = [];

  // Gross depreciable cost of the pool (opening PP&E treated as fresh cost basis).
  let cost = num(input?.openingPPE);
  let accumulated = 0;
  const slRate = 1 / life;
  const ddRate = (1 / life) * 2;

  for (let i = 0; i < capexByPeriod.length; i++) {
    const capex = num(capexByPeriod[i]);
    cost += capex;

    const nbvBefore = cost - accumulated;
    let depreciation: number;

    if (method === 'declining') {
      depreciation = nbvBefore * ddRate;
    } else {
      depreciation = cost * slRate;
    }

    // Never depreciate below zero NBV.
    depreciation = Math.min(Math.max(depreciation, 0), Math.max(nbvBefore, 0));
    accumulated += depreciation;
    const nbv = cost - accumulated;

    rows.push({
      period: i,
      capex: round2(capex),
      depreciation: round2(depreciation),
      accumulated: round2(accumulated),
      nbv: round2(nbv),
    });
  }

  return rows;
}

// ─── 4. Tax Schedule ──────────────────────────────────────────────────────────

export interface TaxScheduleInput {
  /** Earnings Before Tax per period, indexed by period. */
  ebtByPeriod: number[];
  /** Statutory tax rate in percent (e.g. 19 == 19%). */
  taxRatePct: number;
}

export interface TaxScheduleRow {
  period: number;
  ebt: number;
  tax: number;
  /** Net Operating Loss carry-forward balance available *after* this period. */
  nol: number;
}

/**
 * Tax schedule with NOL (Net Operating Loss) carry-forward.
 *
 * Losses (negative EBT) accumulate as an NOL balance that shelters future
 * positive EBT before tax is applied:
 *   taxableIncome = max(0, ebt − nolOpening)
 *   tax           = taxableIncome × rate
 *   nolClosing    = nolOpening used up by profit, or grown by the period's loss
 *
 * Tax is never negative.
 */
export function taxSchedule(input: TaxScheduleInput): TaxScheduleRow[] {
  const rate = num(input?.taxRatePct) / 100;
  const ebtByPeriod = Array.isArray(input?.ebtByPeriod) ? input.ebtByPeriod : [];

  const rows: TaxScheduleRow[] = [];
  let nol = 0; // outstanding loss carry-forward

  for (let i = 0; i < ebtByPeriod.length; i++) {
    const ebt = num(ebtByPeriod[i]);

    let taxableIncome = 0;
    if (ebt > 0) {
      // Profit: use available NOL to shelter income, then shrink the NOL.
      const sheltered = Math.min(ebt, nol);
      taxableIncome = ebt - sheltered;
      nol -= sheltered;
    } else {
      // Loss: grows the carry-forward balance.
      nol += -ebt;
    }

    const tax = Math.max(0, taxableIncome * rate);

    rows.push({
      period: i,
      ebt: round2(ebt),
      tax: round2(tax),
      nol: round2(nol),
    });
  }

  return rows;
}
