/**
 * M16/6.3 — Headcount Planner Service
 *
 * Pure (DB-free) workforce / OPEX planning math. Given a roster of roles and an
 * ordered list of period labels, projects fully-loaded personnel cost, headcount,
 * OPEX per period, and the resulting cash outflow.
 *
 * Conventions
 * -----------
 *  - "Fully-loaded" cost = baseSalary × (1 + benefitsLoadPct), where
 *    benefitsLoadPct is a fraction (0.25 = 25% on-costs / benefits / employer tax).
 *  - A role does NOT cost anything before its `startPeriod` (0-based index into
 *    `periods`). During the first `rampMonths` periods it is partially loaded
 *    (linear ramp), reaching full cost once ramped.
 *  - All amounts are PER PERIOD (the same cadence as `periods`, typically months).
 *
 * No DB, no I/O — every export is a deterministic pure function so it can be unit
 * tested in isolation and reused by the financial modeling engine.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HeadcountRole {
  id: string;
  title: string;
  /** Per-period base salary (e.g. monthly gross), in the model's currency. */
  baseSalary: number;
  /** Benefits / on-cost load as a fraction (0.25 = +25%). */
  benefitsLoadPct: number;
  /** 0-based index into `periods` at which the role starts incurring cost. */
  startPeriod: number;
  /**
   * Number of periods the role takes to reach full productivity/cost.
   * 0 (or 1) = full cost from the start period. N = linear ramp over N periods.
   */
  rampMonths: number;
}

export interface RoleCostResult {
  baseSalary: number;
  loadedCost: number;
  isRamped: boolean;
}

export interface HeadcountOpexRow {
  period: string;
  headcount: number;
  totalSalary: number;
  totalLoaded: number;
}

export interface HeadcountCashRow {
  period: string;
  cashOut: number;
}

export interface CostPerHireResult {
  totalRoles: number;
  avgLoadedAnnual: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const safeNum = (v: unknown): number => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Round to cents to keep aggregates free of float dust. */
const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Fraction of full cost a role bears at a given period.
 *  - period < startPeriod        → 0 (not yet hired)
 *  - within the ramp window       → linear fraction in (0, 1]
 *  - after the ramp               → 1 (full cost)
 *
 * Ramp is linear across `rampMonths` periods starting at `startPeriod`.
 * The first active period gets 1/ramp of full cost, the last ramp period gets 1.
 */
function rampFraction(role: HeadcountRole, periodIndex: number): number {
  const start = Math.max(0, Math.floor(safeNum(role.startPeriod)));
  if (periodIndex < start) return 0;

  const ramp = Math.max(0, Math.floor(safeNum(role.rampMonths)));
  if (ramp <= 1) return 1; // no ramp → full cost immediately

  const elapsed = periodIndex - start; // 0-based offset since start
  if (elapsed >= ramp) return 1;
  return (elapsed + 1) / ramp;
}

// ---------------------------------------------------------------------------
// 1. roleCost — single role's cost at a given period
// ---------------------------------------------------------------------------

/**
 * Cost of one role for a single period (identified by its 0-based index).
 *
 * @param role    the role definition
 * @param period  0-based period index into the timeline
 * @returns baseSalary (this period, after ramp), loadedCost (fully loaded),
 *          and isRamped (true while still ramping up, i.e. not yet at full cost).
 */
export function roleCost(role: HeadcountRole, period: number): RoleCostResult {
  const periodIndex = Math.floor(safeNum(period));
  const fraction = rampFraction(role, periodIndex);

  const fullSalary = safeNum(role.baseSalary);
  const loadMultiplier = 1 + safeNum(role.benefitsLoadPct);

  const baseSalary = round2(fullSalary * fraction);
  const loadedCost = round2(fullSalary * fraction * loadMultiplier);

  // Ramped == active but not yet at full cost (strictly between 0 and 1).
  const isRamped = fraction > 0 && fraction < 1;

  return { baseSalary, loadedCost, isRamped };
}

// ---------------------------------------------------------------------------
// 2. headcountOpex — aggregate OPEX per period across all roles
// ---------------------------------------------------------------------------

/**
 * Aggregate workforce OPEX for every period.
 *
 * @param roles    roster of roles
 * @param periods  ordered period labels (index = timeline position)
 * @returns one row per period: active headcount, total base salary, total loaded.
 */
export function headcountOpex(
  roles: HeadcountRole[],
  periods: string[],
): HeadcountOpexRow[] {
  const safeRoles = Array.isArray(roles) ? roles : [];
  const safePeriods = Array.isArray(periods) ? periods : [];

  return safePeriods.map((period, periodIndex) => {
    let headcount = 0;
    let totalSalary = 0;
    let totalLoaded = 0;

    for (const role of safeRoles) {
      const { baseSalary, loadedCost } = roleCost(role, periodIndex);
      if (loadedCost > 0 || baseSalary > 0) headcount += 1;
      totalSalary += baseSalary;
      totalLoaded += loadedCost;
    }

    return {
      period,
      headcount,
      totalSalary: round2(totalSalary),
      totalLoaded: round2(totalLoaded),
    };
  });
}

// ---------------------------------------------------------------------------
// 3. headcountToCash — cash outflow per period (with optional payroll lag)
// ---------------------------------------------------------------------------

/**
 * Convert workforce OPEX into a cash outflow schedule.
 *
 * Loaded personnel cost is treated as the cash basis. An optional `payLagPeriods`
 * shifts cash out by N periods (e.g. salaries accrued in P0 paid in P1), which
 * models payroll / payment timing without changing total spend.
 *
 * @param roles          roster of roles
 * @param periods        ordered period labels
 * @param payLagPeriods  periods to delay cash out (default 0 = same-period cash)
 * @returns one row per period: cashOut (loaded cost falling due that period).
 */
export function headcountToCash(
  roles: HeadcountRole[],
  periods: string[],
  payLagPeriods = 0,
): HeadcountCashRow[] {
  const opex = headcountOpex(roles, periods);
  const lag = Math.max(0, Math.floor(safeNum(payLagPeriods)));

  // cashOut[i] = loaded cost accrued in period (i - lag), if that period exists.
  return opex.map((_, periodIndex) => {
    const sourceIndex = periodIndex - lag;
    const cashOut =
      sourceIndex >= 0 && sourceIndex < opex.length
        ? opex[sourceIndex].totalLoaded
        : 0;
    return {
      period: opex[periodIndex].period,
      cashOut: round2(cashOut),
    };
  });
}

// ---------------------------------------------------------------------------
// 4. costPerHire — roster-level loaded cost summary
// ---------------------------------------------------------------------------

/**
 * Roster summary: number of roles and the average fully-loaded ANNUAL cost.
 *
 * Per-period base salary is annualized at 12 periods/year (monthly cadence),
 * then loaded with each role's benefits factor, and averaged across roles.
 *
 * @param roles roster of roles
 * @returns totalRoles and avgLoadedAnnual (0 when the roster is empty).
 */
export function costPerHire(roles: HeadcountRole[]): CostPerHireResult {
  const safeRoles = Array.isArray(roles) ? roles : [];
  const totalRoles = safeRoles.length;
  if (totalRoles === 0) return { totalRoles: 0, avgLoadedAnnual: 0 };

  const PERIODS_PER_YEAR = 12;
  let sumLoadedAnnual = 0;
  for (const role of safeRoles) {
    const loadedPerPeriod =
      safeNum(role.baseSalary) * (1 + safeNum(role.benefitsLoadPct));
    sumLoadedAnnual += loadedPerPeriod * PERIODS_PER_YEAR;
  }

  return {
    totalRoles,
    avgLoadedAnnual: round2(sumLoadedAnnual / totalRoles),
  };
}
