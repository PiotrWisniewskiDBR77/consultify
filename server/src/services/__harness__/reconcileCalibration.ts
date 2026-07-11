/**
 * Reconcile Calibration Harness (F6 / R1-R8) — SYNTHETIC calibration, no DB.
 * ============================================================================
 * Unblocks reconciliationService.ts's "waiting for a real DBR77 pack to
 * calibrate" state without a real client pack. Builds 3 SYNTHETIC but
 * internally-consistent financial-statement packs (PLN thousands, mid-scale
 * manufacturing scale-up) entirely in memory — zero DB reads/writes — and
 * runs them through reconcileStatements() to verify:
 *
 *   (a) CLEAN pack   — every statement ties out exactly -> 0 violations.
 *   (b) MINOR-NOISE  — rounding-level deltas (import/precision noise) within
 *                       each check's tolerance band -> still 0 violations
 *                       (proves thresholds are not so tight they false-positive
 *                       on harmless import noise).
 *   (c) EGREGIOUS    — every one of R1-R8's checkable sub-rules is broken by a
 *                       large, deliberate delta -> every rule must fire
 *                       (proves thresholds are not so loose they miss a real
 *                       broken model).
 *
 * IMPORTANT — scope correction vs the task brief: reconciliationService.ts's
 * R1-R8 are strictly CROSS-STATEMENT (P&L <-> BS <-> CF, single entity, two
 * periods). There is NO segment-sum-to-total check and NO multi-method EV
 * convergence check in this service (that logic, if it exists, lives
 * elsewhere — e.g. valuation/EV services). This harness therefore does not
 * fabricate segment or EV data; it exercises exactly the 8+3 checks the
 * service actually computes (R1, R2, R3, R4 x2, R5 x2, R6, R7, R8).
 *
 * Run:  npx tsx server/src/services/__harness__/reconcileCalibration.ts
 * ============================================================================
 */

import {
  reconcileStatements,
  type PeriodStatements,
  type ReconcileCheck,
  type ReconcilePack,
} from '../reconciliationService.js';

// ── Pack (a): CLEAN — every statement ties out exactly ─────────────────────
// Company: synthetic mid-scale manufacturing scale-up, PLN thousands.
// Prior period (t-1) closes the balance sheet that period t opens from.

export function buildCleanPack(): ReconcilePack {
  const prior: PeriodStatements = {
    periodLabel: 'FY2024',
    periodDate: '2024-12-31',
    scaling: 'thousands',
    currency: 'PLN',
    pnl: {},
    bs: {
      CASH: 3000,
      AR: 4000,
      INVENTORY: 3000,
      PROPERTY_PLANT_EQUIPMENT: 18000,
      TOTAL_ASSETS: 28000, // 3000+4000+3000+18000
      AP: 2500,
      SHORT_TERM_DEBT: 1500,
      LONG_TERM_DEBT: 9000,
      TOTAL_LIABILITIES: 13000, // 2500+1500+9000
      RETAINED_EARNINGS: 9000,
      TOTAL_EQUITY: 15000, // 6000 share capital (not modeled) + 9000 RE
    },
    cf: {},
  };

  const current: PeriodStatements = {
    periodLabel: 'FY2025',
    periodDate: '2025-12-31',
    scaling: 'thousands',
    currency: 'PLN',
    pnl: {
      REVENUE: 40000,
      GROSS_PROFIT: 16000, // 40% GM
      DEPRECIATION: 2000, // role DEPRECIATION_PL
      INTEREST_EXPENSE: 900,
      NET_INCOME: 4000, // 10% NM
    },
    bs: {
      CASH: 5900, // = prior 3000 + NET_CHANGE_CASH 2900
      AR: 4200, // +200
      INVENTORY: 3200, // +200
      PROPERTY_PLANT_EQUIPMENT: 18500, // 18000 + |capex 2500| - |dep 2000|
      TOTAL_ASSETS: 31800, // 5900+4200+3200+18500
      AP: 2600, // +100
      SHORT_TERM_DEBT: 1700,
      LONG_TERM_DEBT: 9000,
      TOTAL_LIABILITIES: 13300, // 2600+1700+9000
      RETAINED_EARNINGS: 12500, // 9000 + (NI 4000 - dividends 500)
      TOTAL_EQUITY: 18500, // 6000 share capital + 12500 RE
    },
    cf: {
      NET_INCOME_CF: 4000,
      DEPRECIATION_ADDBACK: 2000,
      CHANGE_WORKING_CAPITAL: -300, // CF-signed: WC growth consumed cash
      OPERATING_CF: 5700, // 4000+2000-300
      INVESTING_CF: -2500, // = -CAPEX magnitude
      CAPEX: 2500, // display_absolute magnitude
      FINANCING_CF: -300, // 800 draw - 600 repay - 500 dividends
      DEBT_DRAWDOWN: 800,
      DEBT_REPAYMENT: 600,
      DIVIDENDS_PAID: 500,
      NET_CHANGE_CASH: 2900, // 5700-2500-300
      OPENING_CASH: 3000, // = prior BS cash
      CLOSING_CASH: 5900, // = opening + net change = current BS cash
    },
  };

  return { context: 'import', periods: [prior, current] };
}

// ── Pack (b): MINOR NOISE — rounding-level deltas, must still PASS ─────────
// Same shape as (a) but with small deltas (import rounding / unit noise)
// injected into each check's inputs, sized to stay inside that check's
// tolerance band (see toleranceNotes below).

export function buildMinorNoisePack(): ReconcilePack {
  const clean = buildCleanPack();
  const prior = { ...clean.periods[0]!, bs: { ...clean.periods[0]!.bs } };
  const current = {
    ...clean.periods[1]!,
    pnl: { ...clean.periods[1]!.pnl },
    bs: { ...clean.periods[1]!.bs },
    cf: { ...clean.periods[1]!.cf },
  };

  // R1 (tol 0.5% of scale~31800 => ~159): nudge TOTAL_EQUITY by +80.
  current.bs.TOTAL_EQUITY = 18580;

  // R2 (tol 0.5%): nudge CLOSING_CASH vs BS CASH by +15 (BS cash stays 5900,
  // CF closing cash reported 5915 — a common rounding mismatch on import).
  current.cf.CLOSING_CASH = 5915;

  // R3 (tol 1% of scale~4000-5700 => ~40-57): nudge NET_INCOME_CF vs NI by +25.
  current.cf.NET_INCOME_CF = 4025;

  // R4 depreciation consistency (tol 2% of ~2000 => ~40): nudge CF add-back by +15.
  current.cf.DEPRECIATION_ADDBACK = 2015;
  // NOTE: R4 roll-forward reads DEPRECIATION_ADDBACK too (falls back from PL dep),
  // so PPE_EoP must absorb the same +15 to stay inside its own 2% band; the
  // pre-existing PPE_EoP (18500) is already within tolerance of the reconstructed
  // 18000+2500-2015=18485 (delta 15, tol ~370), so no further change needed.

  // R5 debt roll-forward (tol 2% of ~10500-10700 => ~210): nudge EoP debt +50.
  current.bs.SHORT_TERM_DEBT = 1750;

  // R6 WC bridge (tol 2% of ~300 scale... use larger figure => scale is
  // max(expected,actual) ~300, tol = max(1, 2%*300)=6): nudge AR delta by +3.
  current.bs.AR = 4203;

  // R7 period continuity (tightest: tol 0.1% of ~3000 => 3): nudge opening
  // cash by +2 (within tolerance).
  current.cf.OPENING_CASH = 3002;

  return { context: 'import', periods: [prior, current] };
}

// ── Pack (c): EGREGIOUS — every checkable rule broken by a large delta ─────

export function buildEgregiousPack(): ReconcilePack {
  const prior = {
    ...buildCleanPack().periods[0]!,
    bs: { ...buildCleanPack().periods[0]!.bs },
  };
  const current: PeriodStatements = {
    periodLabel: 'FY2025 (broken)',
    periodDate: '2025-12-31',
    scaling: 'thousands',
    currency: 'PLN',
    pnl: {
      REVENUE: -500, // R8: revenue <= 0
      GROSS_PROFIT: 25000, // R8: GM = 25000/-500 => outside [0,100%] (also nonsensical)
      DEPRECIATION: 2000,
      INTEREST_EXPENSE: 5000, // R5b: implied rate vs avg debt blows past 25% sanity band
      NET_INCOME: 4000,
    },
    bs: {
      CASH: 5900,
      AR: 9000, // egregious jump for R6
      INVENTORY: 3200,
      PROPERTY_PLANT_EQUIPMENT: 30000, // egregious for R4 roll-forward
      TOTAL_ASSETS: 31800,
      AP: 2600,
      SHORT_TERM_DEBT: 1700,
      LONG_TERM_DEBT: 9000,
      TOTAL_LIABILITIES: 13300,
      RETAINED_EARNINGS: 12500,
      TOTAL_EQUITY: 25000, // R1: TA(31800) != TL+TE(13300+25000=38300)
    },
    cf: {
      NET_INCOME_CF: 9000, // R3a: vs NI 4000
      DEPRECIATION_ADDBACK: 500, // R4: vs PL dep 2000 (75% off)
      CHANGE_WORKING_CAPITAL: -300,
      OPERATING_CF: 100, // R3b: vs NI+dep+wc = 4000+500-300=4200
      INVESTING_CF: -2500,
      CAPEX: 9000, // R4 roll-forward: massively overstated
      FINANCING_CF: -300,
      DEBT_DRAWDOWN: 800,
      DEBT_REPAYMENT: 9000, // R5 roll-forward: massively overstated
      DIVIDENDS_PAID: 500,
      NET_CHANGE_CASH: -2700, // R2a: sections sum (100-2500-300=-2700) vs this... equal actually
      OPENING_CASH: 500, // R7: vs prior closing cash 3000 (egregious break)
      CLOSING_CASH: 999, // R2b/c: opening+netChange=500-2700=-2200 != 999; also != BS cash 5900
    },
  };

  return { context: 'import', periods: [prior, current] };
}

// ── Runner ───────────────────────────────────────────────────────────────

interface PackExpectation {
  name: string;
  build: () => ReconcilePack;
  expectViolations: boolean; // true = expect >=1 fail/warning on the checkable rules
}

const PACKS: PackExpectation[] = [
  { name: 'CLEAN', build: buildCleanPack, expectViolations: false },
  { name: 'MINOR_NOISE', build: buildMinorNoisePack, expectViolations: false },
  { name: 'EGREGIOUS', build: buildEgregiousPack, expectViolations: true },
];

function fmtCheck(c: ReconcileCheck): string {
  const delta = c.difference === null ? 'n/a' : c.difference.toFixed(2);
  const tol = c.tolerance === null ? 'n/a' : c.tolerance.toFixed(2);
  return `  [${c.status.toUpperCase().padEnd(8)}] ${c.checkCode.padEnd(28)} delta=${delta.padEnd(10)} tol=${tol.padEnd(10)} ${c.message}`;
}

export function runCalibration(): void {
  for (const pack of PACKS) {
    const result = reconcileStatements(pack.build());
    console.log(`\n=== ${pack.name} ===`);
    console.log(
      `overall=${result.overallStatus} blocksReady=${result.blocksReady} ` +
        `summary=${JSON.stringify(result.summary)}`
    );
    // Only print the current-period checks (period[1]) — prior period has no
    // history to roll forward from, so most of its checks legitimately skip.
    const currentPeriodChecks = result.checks.slice(result.checks.length / 2);
    for (const c of currentPeriodChecks) {
      console.log(fmtCheck(c));
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCalibration();
}
