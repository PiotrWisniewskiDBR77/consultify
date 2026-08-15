/**
 * Cross-Statement Tie-Out Service (M16 / 9.4)
 *
 * Pure, side-effect-free validation that the three primary financial statements
 * articulate with one another: the Income Statement (P&L), the Balance Sheet (BS)
 * and the Cash Flow Statement (CF). Per-statement validators (financeDiagnostics,
 * statement analytics) check each statement in isolation; this service is the only
 * one that proves the *links between* them — the property auditors call "tie-out".
 *
 * Canonical line codes (uppercase) are read directly from the supplied maps. Missing
 * codes are treated as 0 so a partially-populated pack still yields meaningful checks.
 *
 * Tolerance is expressed as a percentage of the larger of |expected| / |actual| so the
 * same threshold behaves sensibly across statements of very different magnitudes.
 */

export type StatementValues = Record<string, number>;

export interface StatementPack {
  /** Income statement / profit & loss canonical line values. */
  pnl: StatementValues;
  /** Balance sheet canonical line values (closing / current period). */
  bs: StatementValues;
  /** Cash flow statement canonical line values. */
  cf: StatementValues;
  /** Prior-period balance sheet, used for change-based checks (retained earnings, cash). */
  bsPrior?: StatementValues;
}

export type TieOutStatus = 'pass' | 'warning' | 'fail';

export interface TieOutCheck {
  check: string;
  status: TieOutStatus;
  expected: number;
  actual: number;
  difference: number;
  message: string;
}

export interface TieOutSummary {
  passed: number;
  warnings: number;
  failed: number;
  isClean: boolean;
}

// Canonical line codes used by the tie-out checks.
const CODE = {
  NET_INCOME: 'NET_INCOME',
  DEPRECIATION_AMORTIZATION: 'DEPRECIATION_AMORTIZATION',
  RETAINED_EARNINGS: 'RETAINED_EARNINGS',
  CASH: 'CASH',
  TOTAL_ASSETS: 'TOTAL_ASSETS',
  TOTAL_LIABILITIES: 'TOTAL_LIABILITIES',
  TOTAL_EQUITY: 'TOTAL_EQUITY',
  // Cash flow
  CF_OPERATING: 'CF_OPERATING',
  CF_INVESTING: 'CF_INVESTING',
  CF_FINANCING: 'CF_FINANCING',
  CF_NET_CHANGE_IN_CASH: 'CF_NET_CHANGE_IN_CASH',
  CF_CLOSING_CASH: 'CF_CLOSING_CASH',
  CF_CHANGE_IN_WORKING_CAPITAL: 'CF_CHANGE_IN_WORKING_CAPITAL',
} as const;

/** Read a canonical line value, defaulting absent/non-finite entries to 0. */
function val(values: StatementValues | undefined, code: string): number {
  const raw = values?.[code];
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : 0;
}

/** Largest magnitude across the compared figures — the basis for the tolerance band. */
function scaleOf(...figures: number[]): number {
  return Math.max(1, ...figures.map((f) => Math.abs(f)));
}

function round(value: number): number {
  // Avoid float noise leaking into reported expected/actual/difference.
  return Math.round(value * 1e6) / 1e6;
}

interface CheckSpec {
  check: string;
  expected: number;
  actual: number;
  /** When the figures diverge beyond tolerance, escalate to this status. */
  onFail: 'warning' | 'fail';
  pass: string;
  fail: string;
}

function evaluate(spec: CheckSpec, tolerancePct: number): TieOutCheck {
  const expected = round(spec.expected);
  const actual = round(spec.actual);
  const difference = round(actual - expected);
  const tolerance = (Math.abs(tolerancePct) / 100) * scaleOf(expected, actual);
  const withinTolerance = Math.abs(difference) <= tolerance;
  const status: TieOutStatus = withinTolerance ? 'pass' : spec.onFail;
  return {
    check: spec.check,
    status,
    expected,
    actual,
    difference,
    message: withinTolerance ? spec.pass : spec.fail,
  };
}

/**
 * Run all cross-statement tie-out checks against a pack.
 *
 * @param pack          The three statements (plus optional prior BS).
 * @param tolerancePct  Allowed divergence as a percentage of the figures' magnitude. Default 1.
 */
export function validatePackTieOut(pack: StatementPack, tolerancePct = 1): TieOutCheck[] {
  const { pnl, bs, cf } = pack;
  const bsPrior = pack.bsPrior;

  const netIncome = val(pnl, CODE.NET_INCOME);
  const dAndA = val(pnl, CODE.DEPRECIATION_AMORTIZATION) || val(cf, CODE.DEPRECIATION_AMORTIZATION);

  const checks: TieOutCheck[] = [];

  const required: Array<[StatementValues | undefined, string]> = [
    [pnl, CODE.NET_INCOME],
    [bs, CODE.RETAINED_EARNINGS],
    [bs, CODE.CASH],
    [bs, CODE.TOTAL_ASSETS],
    [bs, CODE.TOTAL_LIABILITIES],
    [bs, CODE.TOTAL_EQUITY],
    [cf, CODE.CF_OPERATING],
    [cf, CODE.CF_INVESTING],
    [cf, CODE.CF_FINANCING],
    [cf, CODE.CF_NET_CHANGE_IN_CASH],
    [cf, CODE.CF_CLOSING_CASH],
    [cf, CODE.CF_CHANGE_IN_WORKING_CAPITAL],
    [bsPrior, CODE.RETAINED_EARNINGS],
  ];
  const missing = required
    .filter(([values, code]) => !Object.prototype.hasOwnProperty.call(values || {}, code))
    .map(([, code]) => code);
  checks.push({
    check: 'REQUIRED_LINES_PRESENT',
    status: missing.length === 0 ? 'pass' : 'fail',
    expected: required.length,
    actual: required.length - missing.length,
    difference: -missing.length,
    message:
      missing.length === 0
        ? 'All required cross-statement lines are present.'
        : `Tie-out is incomplete; missing required lines: ${missing.join(', ')}.`,
  });

  // 1. NET_INCOME_TO_RETAINED — net income flows into the change in retained earnings.
  //    (Ignores dividends; a divergence here flags an undocumented equity movement.)
  const retainedClosing = val(bs, CODE.RETAINED_EARNINGS);
  const retainedPrior = val(bsPrior, CODE.RETAINED_EARNINGS);
  const retainedChange = retainedClosing - retainedPrior;
  checks.push(
    evaluate(
      {
        check: 'NET_INCOME_TO_RETAINED',
        expected: netIncome,
        actual: retainedChange,
        onFail: 'warning',
        pass: 'Net income ties to the change in retained earnings.',
        fail: 'Net income does not match the change in retained earnings — check for dividends or unposted equity movements.',
      },
      tolerancePct
    )
  );

  // 2. CLOSING_CASH_MATCH — cash flow closing cash equals the balance sheet cash line.
  const closingCashCf = val(cf, CODE.CF_CLOSING_CASH);
  const cashBs = val(bs, CODE.CASH);
  checks.push(
    evaluate(
      {
        check: 'CLOSING_CASH_MATCH',
        expected: closingCashCf,
        actual: cashBs,
        onFail: 'fail',
        pass: 'Closing cash on the cash flow statement ties to balance sheet cash.',
        fail: 'Closing cash on the cash flow statement does not match balance sheet cash.',
      },
      tolerancePct
    )
  );

  // 3. CF_INDIRECT_RECONCILE — operating cash flow reconciles from net income.
  //    CF operating = net income + D&A − ΔWC.
  const cfOperating = val(cf, CODE.CF_OPERATING);
  const changeWC = val(cf, CODE.CF_CHANGE_IN_WORKING_CAPITAL);
  const reconciledOperating = netIncome + dAndA - changeWC;
  checks.push(
    evaluate(
      {
        check: 'CF_INDIRECT_RECONCILE',
        expected: reconciledOperating,
        actual: cfOperating,
        onFail: 'warning',
        pass: 'Operating cash flow reconciles to net income + D&A − ΔWC.',
        fail: 'Operating cash flow does not reconcile to net income + D&A − ΔWC.',
      },
      tolerancePct
    )
  );

  // 4. BS_BALANCES — the accounting identity: Assets = Liabilities + Equity.
  const totalAssets = val(bs, CODE.TOTAL_ASSETS);
  const totalLiabilities = val(bs, CODE.TOTAL_LIABILITIES);
  const totalEquity = val(bs, CODE.TOTAL_EQUITY);
  checks.push(
    evaluate(
      {
        check: 'BS_BALANCES',
        expected: totalAssets,
        actual: totalLiabilities + totalEquity,
        onFail: 'fail',
        pass: 'Balance sheet balances: assets equal liabilities plus equity.',
        fail: 'Balance sheet does not balance: assets do not equal liabilities plus equity.',
      },
      tolerancePct
    )
  );

  // 5. CF_SECTIONS_SUM — operating + investing + financing = net change in cash.
  const cfInvesting = val(cf, CODE.CF_INVESTING);
  const cfFinancing = val(cf, CODE.CF_FINANCING);
  const netChange = val(cf, CODE.CF_NET_CHANGE_IN_CASH);
  checks.push(
    evaluate(
      {
        check: 'CF_SECTIONS_SUM',
        expected: netChange,
        actual: cfOperating + cfInvesting + cfFinancing,
        onFail: 'fail',
        pass: 'Cash flow sections sum to the reported net change in cash.',
        fail: 'Cash flow sections do not sum to the reported net change in cash.',
      },
      tolerancePct
    )
  );

  return checks;
}

/** Aggregate a set of tie-out checks into pass/warning/fail counts and a clean flag. */
export function tieOutSummary(checks: TieOutCheck[]): TieOutSummary {
  let passed = 0;
  let warnings = 0;
  let failed = 0;
  for (const check of checks) {
    if (check.status === 'pass') passed += 1;
    else if (check.status === 'warning') warnings += 1;
    else failed += 1;
  }
  return {
    passed,
    warnings,
    failed,
    isClean: failed === 0 && warnings === 0,
  };
}
