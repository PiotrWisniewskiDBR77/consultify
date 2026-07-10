/**
 * Reconciliation Service (F6 / R1-R8) — SHADOW MODE
 * ============================================================================
 * Pure, side-effect-free cross-statement reconciliation validator that proves
 * the three primary financial statements (P&L, BS, CF) articulate with one
 * another AND (with a prior period) roll forward correctly period-over-period.
 *
 * SSOT: Harvard/wdrozenie-100/_SPEC_RECONCILE_R1R8_2026-07-10.md
 *
 * Why a NEW service (not a reuse of crossStatementTieOutService.ts):
 *   crossStatementTieOutService.val() defaults every missing code to 0, and its
 *   code dictionary (CF_OPERATING, DEPRECIATION_AMORTIZATION, ...) does NOT exist
 *   in the canonical registry (which uses OPERATING_CF, DEPRECIATION_ADDBACK, ...).
 *   Wiring it 1:1 onto financial_statement_values would silently yield 0==0 PASS
 *   on an unbalanced model. This service uses ONLY registry-verified codes (§A.2
 *   of the spec) and treats a MISSING required component as `skipped`, never as 0.
 *
 * ── SHADOW MODE (RECONCILE_ENFORCE) ─────────────────────────────────────────
 *   This service COMPUTES R1-R8 and returns rich validation records, but it MUST
 *   NOT gate anything until the sign convention has been calibrated on a real
 *   DBR77 pack (§5 of the spec). `RECONCILE_ENFORCE` defaults to false; callers
 *   consult `shouldBlockReady()` (which returns false while enforce is off) so
 *   that pack readiness / model status are never changed by reconcile findings.
 *
 * ── CALIBRATION-REQUIRED (do NOT freeze before running §5 on DBR77) ──────────
 *   The sign of `display_absolute` CF line items (CAPEX, DEBT_REPAYMENT,
 *   DIVIDENDS_PAID, DEPRECIATION, CHANGE_WORKING_CAPITAL, CHANGE_AR/INVENTORY/AP)
 *   depends on how the importer stores them. Registry marks them display_absolute
 *   (positive magnitude) but the FCF formula (registry :2543 sum(OPERATING_CF,
 *   CAPEX)) hints CAPEX may be stored signed. To stay robust across BOTH storage
 *   conventions:
 *     - Roll-forward magnitude roles (R4 CAPEX/DEPR, R5 DRAWDOWN/REPAYMENT) use
 *       Math.abs() so they behave identically whether stored positive (import) or
 *       negative (model compute, e.g. CAPEX_CF = -capex).
 *     - Direction-sensitive checks (R3b indirect, R6 working-capital bridge) are
 *       written in the CF-signed convention that is internally consistent with
 *       the model compute, degraded to `warning` severity, and tag
 *       `details.calibration = 'sign_pending_dbr77'`.
 *   §5 must confirm the real sign on a live DBR77 pack before RECONCILE_ENFORCE
 *   is flipped to true.
 * ============================================================================
 */

import { getCanonicalLineByCode } from './financeCanonicalRegistry.js';

// ── SHADOW MODE MASTER SWITCH ───────────────────────────────────────────────
// While false, reconcile is purely observational: shouldBlockReady() always
// returns false, so no pack/model status is ever changed by reconcile findings.
// Do NOT flip to true before the DBR77 sign calibration test (spec §5) passes.
export const RECONCILE_ENFORCE = false;

export type ReconcileContext = 'import' | 'model';
export type ReconcileStatus = 'pass' | 'warning' | 'fail' | 'skipped';
export type ReconcileSeverity = 'error' | 'warning';

export interface PeriodStatements {
  pnl: Record<string, number>;
  bs: Record<string, number>;
  cf: Record<string, number>;
  bsPrior?: Record<string, number>;
  plPrior?: Record<string, number>;
  periodLabel?: string;
  periodDate?: string;
  scaling?: 'units' | 'thousands' | 'millions';
  currency?: string;
}

export interface ReconcilePack {
  periods: PeriodStatements[];
  context: ReconcileContext;
}

export interface ReconcileCheck {
  checkCode: string;
  checkName: string;
  severity: ReconcileSeverity;
  status: ReconcileStatus;
  expected: number | null;
  actual: number | null;
  difference: number | null;
  tolerance: number | null;
  message: string;
  periodDate?: string;
  details?: Record<string, unknown>;
}

export interface ReconcileResult {
  checks: ReconcileCheck[];
  overallStatus: 'pass' | 'warning' | 'fail';
  blocksReady: boolean;
  summary: { passed: number; warnings: number; failed: number; skipped: number };
}

// ── Constants ────────────────────────────────────────────────────────────────
const ABS_FLOOR = 1; // floor tolerance (1 currency unit) so zero bases don't false-fail

/**
 * Role → candidate canonical line codes (first present wins).
 * Handles the divergence between the IMPORT registry codes and the MODEL
 * compute's internal codes (financialModelingService PPE_NET/WC_CHANGES/CAPEX_CF/
 * DEBT_*_CF/DIVIDEND_CF), so one service serves both contexts.
 */
const ROLE_ALIASES: Record<string, string[]> = {
  // P&L
  REVENUE: ['REVENUE'],
  GROSS_PROFIT: ['GROSS_PROFIT'],
  DEPRECIATION_PL: ['DEPRECIATION'],
  INTEREST_EXPENSE: ['INTEREST_EXPENSE'],
  NET_INCOME: ['NET_INCOME'],
  // BS
  TOTAL_ASSETS: ['TOTAL_ASSETS'],
  TOTAL_LIABILITIES: ['TOTAL_LIABILITIES'],
  TOTAL_EQUITY: ['TOTAL_EQUITY'],
  TOTAL_LIABILITIES_EQUITY: ['TOTAL_LIABILITIES_EQUITY'],
  CASH: ['CASH'],
  AR: ['AR'],
  INVENTORY: ['INVENTORY'],
  AP: ['AP'],
  PPE: ['PROPERTY_PLANT_EQUIPMENT', 'PPE_NET'],
  SHORT_TERM_DEBT: ['SHORT_TERM_DEBT'],
  LONG_TERM_DEBT: ['LONG_TERM_DEBT'],
  TOTAL_DEBT: ['TOTAL_DEBT'],
  RETAINED_EARNINGS: ['RETAINED_EARNINGS'],
  // CF
  OPERATING_CF: ['OPERATING_CF'],
  INVESTING_CF: ['INVESTING_CF'],
  FINANCING_CF: ['FINANCING_CF'],
  NET_CHANGE_CASH: ['NET_CHANGE_CASH'],
  OPENING_CASH: ['OPENING_CASH'],
  CLOSING_CASH: ['CLOSING_CASH'],
  NET_INCOME_CF: ['NET_INCOME_CF'],
  DEPRECIATION_ADDBACK: ['DEPRECIATION_ADDBACK'],
  CHANGE_WORKING_CAPITAL: ['CHANGE_WORKING_CAPITAL', 'WC_CHANGES'],
  CHANGE_AR: ['CHANGE_AR'],
  CHANGE_INVENTORY: ['CHANGE_INVENTORY'],
  CHANGE_AP: ['CHANGE_AP'],
  CAPEX: ['CAPEX', 'CAPEX_CF'],
  DEBT_DRAWDOWN: ['DEBT_DRAWDOWN', 'DEBT_DRAWDOWN_CF'],
  DEBT_REPAYMENT: ['DEBT_REPAYMENT', 'DEBT_REPAYMENT_CF'],
  DIVIDENDS_PAID: ['DIVIDENDS_PAID', 'DIVIDEND_CF'],
};

// ── Value access (missing-aware; never defaults required components to 0) ─────

/** First-present alias value for the role, or undefined when the role is absent. */
function get(map: Record<string, number> | undefined, role: string): number | undefined {
  if (!map) return undefined;
  const codes = ROLE_ALIASES[role] || [role];
  for (const c of codes) {
    const raw = map[c];
    if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  }
  return undefined;
}

/**
 * signConvention lookup for the canonical code behind a role (import context).
 * Exposed for calibration/audit; the reconcile math below intentionally does NOT
 * apply a blanket sign flip (that would break R1, since TOTAL_LIABILITIES is
 * display_absolute yet used positively in A = L + E). Magnitude roles use abs()
 * instead — see the module header calibration note.
 */
export function signConventionOf(role: string): string | null {
  const codes = ROLE_ALIASES[role] || [role];
  for (const c of codes) {
    const def = getCanonicalLineByCode(c);
    if (def) return def.signConvention;
  }
  return null;
}

function round(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

/** Largest magnitude across compared figures — basis for the relative tolerance band. */
function scaleOf(...figures: number[]): number {
  return Math.max(1, ...figures.map((f) => Math.abs(f)));
}

function absTol(relPct: number, ...figures: number[]): number {
  return Math.max(ABS_FLOOR, (Math.abs(relPct) / 100) * scaleOf(...figures));
}

interface EvalArgs {
  checkCode: string;
  checkName: string;
  severity: ReconcileSeverity;
  expected: number;
  actual: number;
  relPct: number;
  passMsg: string;
  failMsg: string;
  periodDate?: string;
  details?: Record<string, unknown>;
}

/** Build a pass/warning/fail check from expected vs actual under a relative tolerance. */
function evaluate(args: EvalArgs): ReconcileCheck {
  const expected = round(args.expected);
  const actual = round(args.actual);
  const difference = round(actual - expected);
  const tolerance = round(absTol(args.relPct, expected, actual));
  const withinTolerance = Math.abs(difference) <= tolerance;
  const status: ReconcileStatus = withinTolerance
    ? 'pass'
    : args.severity === 'error'
      ? 'fail'
      : 'warning';
  return {
    checkCode: args.checkCode,
    checkName: args.checkName,
    severity: args.severity,
    status,
    expected,
    actual,
    difference,
    tolerance,
    message: withinTolerance ? args.passMsg : args.failMsg,
    periodDate: args.periodDate,
    details: args.details,
  };
}

/** A skipped check — data absent; NEVER a fail (spec §4.4, first period is legal). */
function skip(
  checkCode: string,
  checkName: string,
  severity: ReconcileSeverity,
  reason: string,
  periodDate?: string
): ReconcileCheck {
  return {
    checkCode,
    checkName,
    severity,
    status: 'skipped',
    expected: null,
    actual: null,
    difference: null,
    tolerance: null,
    message: `Skipped: ${reason}`,
    periodDate,
    details: { skipped: true, reason },
  };
}

// ── Per-period checks R1-R8 ───────────────────────────────────────────────────

function checkR1(p: PeriodStatements): ReconcileCheck {
  const code = 'R1_BS_EQUATION';
  const name = 'Balance Sheet Equation';
  const assets = get(p.bs, 'TOTAL_ASSETS');
  const tle = get(p.bs, 'TOTAL_LIABILITIES_EQUITY');
  const tl = get(p.bs, 'TOTAL_LIABILITIES');
  const te = get(p.bs, 'TOTAL_EQUITY');
  if (assets === undefined || (tle === undefined && tl === undefined && te === undefined)) {
    return skip(code, name, 'error', 'missing TOTAL_ASSETS or liabilities+equity', p.periodDate);
  }
  const liabPlusEquity = tle !== undefined ? tle : (tl ?? 0) + (te ?? 0);
  return evaluate({
    checkCode: code,
    checkName: name,
    severity: 'error',
    expected: assets,
    actual: liabPlusEquity,
    relPct: 0.5,
    passMsg: 'Assets = Liabilities + Equity.',
    failMsg: 'Balance sheet does not balance: assets != liabilities + equity.',
    periodDate: p.periodDate,
    details: {
      totalAssets: assets,
      totalLiabilities: tl ?? null,
      totalEquity: te ?? null,
      totalLiabilitiesEquity: tle ?? null,
      usedComputedTLE: tle !== undefined,
    },
  });
}

function checkR2(p: PeriodStatements): ReconcileCheck {
  const code = 'R2_CASH_TIEOUT';
  const name = 'Cash Flow Tie-out';
  const netChange = get(p.cf, 'NET_CHANGE_CASH');
  const ocf = get(p.cf, 'OPERATING_CF');
  const icf = get(p.cf, 'INVESTING_CF');
  const fcf = get(p.cf, 'FINANCING_CF');
  const hasSections = ocf !== undefined && icf !== undefined && fcf !== undefined;
  if (netChange === undefined && !hasSections) {
    return skip(code, name, 'error', 'missing NET_CHANGE_CASH and section totals', p.periodDate);
  }

  const sub: Record<string, unknown> = {};
  let worstDiff = 0;
  let worstScale = 1;
  const relPct = 0.5;

  // (a) sections sum to net change
  if (hasSections && netChange !== undefined) {
    const sum = (ocf ?? 0) + (icf ?? 0) + (fcf ?? 0);
    const d = Math.abs(sum - netChange);
    sub.sectionsSum = {
      expected: netChange,
      actual: round(sum),
      difference: round(sum - netChange),
    };
    if (d > worstDiff) {
      worstDiff = d;
      worstScale = scaleOf(sum, netChange);
    }
  } else {
    sub.sectionsSum = 'skipped: missing sections or net change';
  }

  // (b) opening + net change = closing
  const opening = get(p.cf, 'OPENING_CASH');
  const closing = get(p.cf, 'CLOSING_CASH');
  if (opening !== undefined && netChange !== undefined && closing !== undefined) {
    const expected = closing;
    const actual = opening + netChange;
    const d = Math.abs(actual - expected);
    sub.cashRoll = { expected, actual: round(actual), difference: round(actual - expected) };
    if (d > worstDiff) {
      worstDiff = d;
      worstScale = scaleOf(expected, actual);
    }
  } else {
    sub.cashRoll = 'skipped: missing opening/closing/net change';
  }

  // (c) CF closing cash = BS cash
  const bsCash = get(p.bs, 'CASH');
  if (closing !== undefined && bsCash !== undefined) {
    const d = Math.abs(bsCash - closing);
    sub.closingVsBs = { expected: closing, actual: bsCash, difference: round(bsCash - closing) };
    if (d > worstDiff) {
      worstDiff = d;
      worstScale = scaleOf(closing, bsCash);
    }
  } else {
    sub.closingVsBs = 'skipped: missing CF closing or BS cash';
  }

  const tolerance = Math.max(ABS_FLOOR, (relPct / 100) * worstScale);
  const within = worstDiff <= tolerance;
  return {
    checkCode: code,
    checkName: name,
    severity: 'error',
    status: within ? 'pass' : 'fail',
    expected: 0,
    actual: round(worstDiff),
    difference: round(worstDiff),
    tolerance: round(tolerance),
    message: within
      ? 'Cash reconciles: sections -> delta cash -> closing -> BS cash.'
      : 'Cash tie-out breaks in at least one sub-check (see details).',
    periodDate: p.periodDate,
    details: sub,
  };
}

function checkR3(p: PeriodStatements): ReconcileCheck {
  const code = 'R3_NET_INCOME_TIE';
  const name = 'Net Income Reconciliation';
  const ni = get(p.pnl, 'NET_INCOME');
  if (ni === undefined) {
    return skip(code, name, 'error', 'missing NET_INCOME', p.periodDate);
  }
  const sub: Record<string, unknown> = { calibration: 'sign_pending_dbr77' };
  let worstDiff = 0;
  let worstScale = 1;
  const relPct = 1;

  // (a) P&L net income == CF net-income start line
  const niCf = get(p.cf, 'NET_INCOME_CF');
  if (niCf !== undefined) {
    const d = Math.abs(niCf - ni);
    sub.niVsCf = { expected: ni, actual: niCf, difference: round(niCf - ni) };
    if (d > worstDiff) {
      worstDiff = d;
      worstScale = scaleOf(ni, niCf);
    }
  } else {
    sub.niVsCf = 'skipped: no NET_INCOME_CF';
  }

  // (b) indirect: OPERATING_CF == NET_INCOME + DEPRECIATION_ADDBACK + CHANGE_WORKING_CAPITAL(cf-signed)
  const ocf = get(p.cf, 'OPERATING_CF');
  const dep = get(p.cf, 'DEPRECIATION_ADDBACK');
  const wc = get(p.cf, 'CHANGE_WORKING_CAPITAL');
  if (ocf !== undefined && dep !== undefined && wc !== undefined) {
    const reconstructed = ni + dep + wc; // CF-signed WC (model WC_CHANGES = -deltaWC)
    const d = Math.abs(ocf - reconstructed);
    sub.indirect = {
      expected: ocf,
      actual: round(reconstructed),
      difference: round(reconstructed - ocf),
    };
    if (d > worstDiff) {
      worstDiff = d;
      worstScale = scaleOf(ocf, reconstructed);
    }
  } else {
    sub.indirect = 'skipped: missing OPERATING_CF / DEPRECIATION_ADDBACK / CHANGE_WORKING_CAPITAL';
  }

  // (c) retained earnings roll: RE - RE_prior = NI - dividends (needs prior BS)
  const rePrior = get(p.bsPrior, 'RETAINED_EARNINGS');
  const reNow = get(p.bs, 'RETAINED_EARNINGS');
  if (rePrior !== undefined && reNow !== undefined) {
    const div = get(p.cf, 'DIVIDENDS_PAID');
    const dividendsMagnitude = div !== undefined ? Math.abs(div) : 0;
    const expected = reNow - rePrior;
    const actual = ni - dividendsMagnitude;
    const d = Math.abs(actual - expected);
    sub.retainedRoll = {
      expected: round(expected),
      actual: round(actual),
      difference: round(actual - expected),
      dividendsAssumed: dividendsMagnitude,
    };
    if (d > worstDiff) {
      worstDiff = d;
      worstScale = scaleOf(expected, actual);
    }
  } else {
    sub.retainedRoll = 'skipped: no prior retained earnings';
  }

  const tolerance = Math.max(ABS_FLOOR, (relPct / 100) * worstScale);
  const within = worstDiff <= tolerance;
  return {
    checkCode: code,
    checkName: name,
    severity: 'error',
    status: within ? 'pass' : 'fail',
    expected: 0,
    actual: round(worstDiff),
    difference: round(worstDiff),
    tolerance: round(tolerance),
    message: within
      ? 'Net income ties across P&L, CF and (where present) retained earnings.'
      : 'Net income does not reconcile (see details; sign convention pending DBR77 calibration).',
    periodDate: p.periodDate,
    details: sub,
  };
}

function checkR4(p: PeriodStatements): ReconcileCheck[] {
  const rollCode = 'R4_PPE_ROLLFORWARD';
  const rollName = 'PP&E Roll-forward';
  const out: ReconcileCheck[] = [];

  // Sub-check: depreciation P&L vs CF add-back (magnitude, computable single-period).
  const depPl = get(p.pnl, 'DEPRECIATION_PL');
  const depCf = get(p.cf, 'DEPRECIATION_ADDBACK');
  if (depPl !== undefined && depCf !== undefined) {
    out.push(
      evaluate({
        checkCode: 'R4_DEPRECIATION_CONSISTENCY',
        checkName: 'Depreciation P&L <-> CF add-back',
        severity: 'warning',
        expected: Math.abs(depPl),
        actual: Math.abs(depCf),
        relPct: 2,
        passMsg: 'Depreciation expense matches the cash-flow add-back.',
        failMsg: 'Depreciation on P&L differs from the CF add-back.',
        periodDate: p.periodDate,
        details: { depreciationPl: depPl, depreciationAddback: depCf },
      })
    );
  } else {
    out.push(
      skip(
        'R4_DEPRECIATION_CONSISTENCY',
        'Depreciation P&L <-> CF add-back',
        'warning',
        'missing DEPRECIATION or DEPRECIATION_ADDBACK',
        p.periodDate
      )
    );
  }

  // Roll-forward (net PP&E): PPE_EoP = PPE_BoP + |CAPEX| - |DEPRECIATION|
  const ppeEoP = get(p.bs, 'PPE');
  const ppeBoP = get(p.bsPrior, 'PPE');
  const capex = get(p.cf, 'CAPEX');
  const dep = depCf !== undefined ? depCf : depPl;
  if (ppeEoP === undefined || ppeBoP === undefined || capex === undefined || dep === undefined) {
    out.push(
      skip(rollCode, rollName, 'warning', 'missing prior PP&E, CAPEX or depreciation', p.periodDate)
    );
    return out;
  }
  const reconstructed = ppeBoP + Math.abs(capex) - Math.abs(dep);
  out.push(
    evaluate({
      checkCode: rollCode,
      checkName: rollName,
      severity: 'warning',
      expected: ppeEoP,
      actual: reconstructed,
      relPct: 2,
      passMsg: 'Net PP&E rolls forward: BoP + capex - depreciation = EoP.',
      failMsg: 'Net PP&E does not roll forward (BoP + capex - depreciation != EoP).',
      periodDate: p.periodDate,
      details: {
        ppeBoP,
        ppeEoP,
        capexMagnitude: Math.abs(capex),
        depreciationMagnitude: Math.abs(dep),
        calibration: 'sign_pending_dbr77',
        note: 'net PP&E only; import registry has no PPE_GROSS/ACCUM_DEPRECIATION',
      },
    })
  );
  return out;
}

function debtTotal(map: Record<string, number> | undefined): number | undefined {
  if (!map) return undefined;
  const total = get(map, 'TOTAL_DEBT');
  if (total !== undefined) return total;
  const st = get(map, 'SHORT_TERM_DEBT');
  const lt = get(map, 'LONG_TERM_DEBT');
  if (st === undefined && lt === undefined) return undefined;
  return (st ?? 0) + (lt ?? 0);
}

function checkR5(p: PeriodStatements): ReconcileCheck[] {
  const rollCode = 'R5_DEBT_ROLLFORWARD';
  const rollName = 'Debt Roll-forward';
  const out: ReconcileCheck[] = [];

  const debtEoP = debtTotal(p.bs);
  const debtBoP = debtTotal(p.bsPrior);
  const draw = get(p.cf, 'DEBT_DRAWDOWN');
  const repay = get(p.cf, 'DEBT_REPAYMENT');
  if (debtEoP === undefined || debtBoP === undefined || draw === undefined || repay === undefined) {
    out.push(
      skip(rollCode, rollName, 'warning', 'missing prior debt, drawdown or repayment', p.periodDate)
    );
    return out;
  }
  const reconstructed = debtBoP + Math.abs(draw) - Math.abs(repay);
  out.push(
    evaluate({
      checkCode: rollCode,
      checkName: rollName,
      severity: 'warning',
      expected: debtEoP,
      actual: reconstructed,
      relPct: 2,
      passMsg: 'Debt rolls forward: BoP + drawdown - repayment = EoP.',
      failMsg: 'Debt does not roll forward (BoP + drawdown - repayment != EoP).',
      periodDate: p.periodDate,
      details: {
        debtBoP,
        debtEoP,
        drawdownMagnitude: Math.abs(draw),
        repaymentMagnitude: Math.abs(repay),
        calibration: 'sign_pending_dbr77',
      },
    })
  );

  // Interest sanity: implied rate on average debt within [0, 25%].
  const interest = get(p.pnl, 'INTEREST_EXPENSE');
  if (interest !== undefined) {
    const avgDebt = (debtBoP + debtEoP) / 2;
    const impliedRate = avgDebt !== 0 ? Math.abs(interest) / Math.abs(avgDebt) : 0;
    const sane = impliedRate >= 0 && impliedRate <= 0.25;
    out.push({
      checkCode: 'R5_INTEREST_SANITY',
      checkName: 'Implied Interest Rate Sanity',
      severity: 'warning',
      status: sane ? 'pass' : 'warning',
      expected: null,
      actual: round(impliedRate),
      difference: null,
      tolerance: 0.25,
      message: sane
        ? `Implied interest rate ${(impliedRate * 100).toFixed(1)}% is within [0, 25%].`
        : `Implied interest rate ${(impliedRate * 100).toFixed(1)}% is outside [0, 25%].`,
      periodDate: p.periodDate,
      details: { interest, avgDebt: round(avgDebt), impliedRate: round(impliedRate) },
    });
  } else {
    out.push(
      skip(
        'R5_INTEREST_SANITY',
        'Implied Interest Rate Sanity',
        'warning',
        'missing INTEREST_EXPENSE',
        p.periodDate
      )
    );
  }
  return out;
}

function checkR6(p: PeriodStatements): ReconcileCheck {
  const code = 'R6_WC_BRIDGE';
  const name = 'Working Capital Bridge';
  if (!p.bsPrior) {
    return skip(code, name, 'warning', 'no prior balance sheet', p.periodDate);
  }
  // deltaBS(AR+INV-AP) should equal -CHANGE_WORKING_CAPITAL(cf-signed).
  const arNow = get(p.bs, 'AR');
  const arPr = get(p.bsPrior, 'AR');
  const invNow = get(p.bs, 'INVENTORY');
  const invPr = get(p.bsPrior, 'INVENTORY');
  const apNow = get(p.bs, 'AP');
  const apPr = get(p.bsPrior, 'AP');
  const wcCf = get(p.cf, 'CHANGE_WORKING_CAPITAL');
  if (
    arNow === undefined ||
    arPr === undefined ||
    invNow === undefined ||
    invPr === undefined ||
    apNow === undefined ||
    apPr === undefined ||
    wcCf === undefined
  ) {
    return skip(
      code,
      name,
      'warning',
      'missing AR/INVENTORY/AP pair or CHANGE_WORKING_CAPITAL',
      p.periodDate
    );
  }
  const deltaWcBalance = arNow - arPr + (invNow - invPr) - (apNow - apPr);
  // Increase in operating assets consumes cash -> CF working-capital term is negative.
  return evaluate({
    checkCode: code,
    checkName: name,
    severity: 'warning',
    expected: -wcCf,
    actual: deltaWcBalance,
    relPct: 2,
    passMsg: 'Balance-sheet working-capital change matches the cash-flow working-capital line.',
    failMsg: 'Working-capital change on the balance sheet does not match the cash-flow line.',
    periodDate: p.periodDate,
    details: {
      deltaAR: arNow - arPr,
      deltaInventory: invNow - invPr,
      deltaAP: apNow - apPr,
      changeWorkingCapitalCf: wcCf,
      calibration: 'sign_pending_dbr77',
    },
  });
}

function checkR7(p: PeriodStatements): ReconcileCheck {
  const code = 'R7_PERIOD_CONTINUITY';
  const name = 'Period Continuity';
  if (!p.bsPrior) {
    return skip(code, name, 'warning', 'no prior period (first period is legal)', p.periodDate);
  }
  // Cash continuity: OPENING_CASH(t) = CLOSING_CASH(t-1) proxied by prior BS cash.
  const opening = get(p.cf, 'OPENING_CASH');
  const priorCash = get(p.bsPrior, 'CASH');
  if (opening === undefined || priorCash === undefined) {
    return skip(code, name, 'warning', 'missing OPENING_CASH or prior BS cash', p.periodDate);
  }
  return evaluate({
    checkCode: code,
    checkName: name,
    severity: 'warning',
    expected: priorCash,
    actual: opening,
    relPct: 0.1,
    passMsg: 'Opening cash equals prior-period closing cash.',
    failMsg: 'Opening cash does not equal prior-period closing cash (period discontinuity).',
    periodDate: p.periodDate,
    details: { openingCash: opening, priorClosingCash: priorCash },
  });
}

function checkR8(p: PeriodStatements): ReconcileCheck {
  const code = 'R8_SIGN_MAGNITUDE_SANITY';
  const name = 'Sign & Magnitude Sanity';
  const revenue = get(p.pnl, 'REVENUE');
  if (revenue === undefined) {
    return skip(code, name, 'warning', 'missing REVENUE', p.periodDate);
  }
  const issues: string[] = [];
  const gp = get(p.pnl, 'GROSS_PROFIT');
  const ni = get(p.pnl, 'NET_INCOME');
  const assets = get(p.bs, 'TOTAL_ASSETS');

  if (revenue <= 0) issues.push('REVENUE <= 0');
  if (gp !== undefined && revenue !== 0) {
    const gm = gp / revenue;
    if (gm < 0 || gm > 1) issues.push(`gross margin ${(gm * 100).toFixed(1)}% outside [0,100%]`);
  }
  if (ni !== undefined && revenue !== 0) {
    const nm = ni / revenue;
    if (nm < -1 || nm > 1) issues.push(`net margin ${(nm * 100).toFixed(1)}% outside [-100,100%]`);
  }
  if (assets !== undefined && assets <= 0) issues.push('TOTAL_ASSETS <= 0');
  // Scale suspicion: tiny revenue with 'units' scaling likely means thousands/millions.
  if (revenue > 0 && revenue < 1000 && (p.scaling === undefined || p.scaling === 'units')) {
    issues.push('REVENUE < 1000 with units scaling — possible thousands/millions mislabel');
  }

  const clean = issues.length === 0;
  return {
    checkCode: code,
    checkName: name,
    severity: 'warning',
    status: clean ? 'pass' : 'warning',
    expected: null,
    actual: null,
    difference: null,
    tolerance: null,
    message: clean
      ? 'Sign and magnitude sanity checks pass.'
      : `Sanity issues: ${issues.join('; ')}`,
    periodDate: p.periodDate,
    details: {
      revenue,
      grossProfit: gp ?? null,
      netIncome: ni ?? null,
      totalAssets: assets ?? null,
      issues,
    },
  };
}

// ── Orchestrator ──────────────────────────────────────────────────────────────

/**
 * Run R1-R8 across every period of the pack. Pure — no persistence, no gating.
 * `blocksReady` reflects what WOULD block if enforcement were on; callers must go
 * through shouldBlockReady() (false in shadow mode) before acting on it.
 */
export function reconcileStatements(pack: ReconcilePack): ReconcileResult {
  const checks: ReconcileCheck[] = [];
  const periods = Array.isArray(pack?.periods) ? pack.periods : [];

  for (let i = 0; i < periods.length; i += 1) {
    const period = periods[i]!;
    // Enrich with prior period from the series when caller did not attach one (model context).
    const enriched: PeriodStatements = {
      ...period,
      bsPrior: period.bsPrior ?? (i > 0 ? periods[i - 1]!.bs : undefined),
      plPrior: period.plPrior ?? (i > 0 ? periods[i - 1]!.pnl : undefined),
    };
    checks.push(checkR1(enriched));
    checks.push(checkR2(enriched));
    checks.push(checkR3(enriched));
    checks.push(...checkR4(enriched));
    checks.push(...checkR5(enriched));
    checks.push(checkR6(enriched));
    checks.push(checkR7(enriched));
    checks.push(checkR8(enriched));
  }

  let passed = 0;
  let warnings = 0;
  let failed = 0;
  let skipped = 0;
  for (const c of checks) {
    if (c.status === 'pass') passed += 1;
    else if (c.status === 'warning') warnings += 1;
    else if (c.status === 'fail') failed += 1;
    else skipped += 1;
  }
  const overallStatus: 'pass' | 'warning' | 'fail' =
    failed > 0 ? 'fail' : warnings > 0 ? 'warning' : 'pass';
  const blocksReady = checks.some((c) => c.severity === 'error' && c.status === 'fail');

  return { checks, overallStatus, blocksReady, summary: { passed, warnings, failed, skipped } };
}

/**
 * Gate helper — the ONLY place callers should consult before changing pack/model
 * status. In shadow mode (RECONCILE_ENFORCE === false) this ALWAYS returns false,
 * so reconcile can never block readiness. Flip RECONCILE_ENFORCE only after DBR77
 * sign calibration (spec §5).
 */
export function shouldBlockReady(result: ReconcileResult): boolean {
  if (!RECONCILE_ENFORCE) return false;
  return result.blocksReady;
}
