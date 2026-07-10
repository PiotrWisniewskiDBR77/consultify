import { describe, expect, it } from 'vitest';

import {
  RECONCILE_ENFORCE,
  reconcileStatements,
  shouldBlockReady,
  type PeriodStatements,
  type ReconcileCheck,
  type ReconcileResult,
} from '../../../server/src/services/reconciliationService.js';

// ---------------------------------------------------------------------------
// Helpers — build an internally-consistent, economic-signed single period.
// (Matches the model compute convention: outflows negative, WC cf-signed.)
// ---------------------------------------------------------------------------

function balancedPeriod(overrides: Partial<PeriodStatements> = {}): PeriodStatements {
  const pnl = {
    REVENUE: 1000,
    COGS: 600,
    GROSS_PROFIT: 400,
    OPEX: 250,
    DEPRECIATION: 50,
    EBIT: 100,
    INTEREST_EXPENSE: 20,
    EBT: 80,
    TAX: 0,
    NET_INCOME: 100,
  };
  const cf = {
    NET_INCOME_CF: 100,
    DEPRECIATION_ADDBACK: 50,
    CHANGE_WORKING_CAPITAL: -30, // cf-signed: WC build consumes cash
    OPERATING_CF: 120, // 100 + 50 - 30
    CAPEX: 40, // display_absolute magnitude
    INVESTING_CF: -40,
    DEBT_DRAWDOWN: 0,
    DEBT_REPAYMENT: 0,
    FINANCING_CF: -10, // e.g. dividends
    DIVIDENDS_PAID: 10,
    NET_CHANGE_CASH: 70, // 120 - 40 - 10
    OPENING_CASH: 200,
    CLOSING_CASH: 270,
  };
  const bs = {
    CASH: 270,
    AR: 150,
    INVENTORY: 100,
    CURRENT_ASSETS: 520,
    PROPERTY_PLANT_EQUIPMENT: 280,
    TOTAL_ASSETS: 800,
    AP: 90,
    CURRENT_LIABILITIES: 90,
    SHORT_TERM_DEBT: 60,
    LONG_TERM_DEBT: 350,
    TOTAL_LIABILITIES: 500,
    RETAINED_EARNINGS: 180,
    TOTAL_EQUITY: 300,
    TOTAL_LIABILITIES_EQUITY: 800,
  };
  return { pnl, bs, cf, periodDate: '2025-12-31', scaling: 'units', currency: 'PLN', ...overrides };
}

function byCode(result: ReconcileResult, code: string): ReconcileCheck | undefined {
  return result.checks.find((c) => c.checkCode === code);
}

function statusOf(result: ReconcileResult, code: string): string | undefined {
  return byCode(result, code)?.status;
}

// ---------------------------------------------------------------------------

describe('reconciliationService — balanced single period (golden case)', () => {
  const result = reconcileStatements({ context: 'import', periods: [balancedPeriod()] });

  it('passes R1/R2/R3/R8 and never fails', () => {
    expect(statusOf(result, 'R1_BS_EQUATION')).toBe('pass');
    expect(statusOf(result, 'R2_CASH_TIEOUT')).toBe('pass');
    expect(statusOf(result, 'R3_NET_INCOME_TIE')).toBe('pass');
    expect(statusOf(result, 'R8_SIGN_MAGNITUDE_SANITY')).toBe('pass');
    expect(result.summary.failed).toBe(0);
    expect(result.overallStatus).toBe('pass');
    expect(result.blocksReady).toBe(false);
  });

  it('skips two-period roll-forwards (R4 PP&E / R5 / R6 / R7) — no prior, NOT a fail', () => {
    expect(statusOf(result, 'R4_PPE_ROLLFORWARD')).toBe('skipped');
    expect(statusOf(result, 'R5_DEBT_ROLLFORWARD')).toBe('skipped');
    expect(statusOf(result, 'R6_WC_BRIDGE')).toBe('skipped');
    expect(statusOf(result, 'R7_PERIOD_CONTINUITY')).toBe('skipped');
    // Depreciation P&L<->CF consistency is single-period computable → passes.
    expect(statusOf(result, 'R4_DEPRECIATION_CONSISTENCY')).toBe('pass');
  });
});

describe('reconciliationService — fault injection', () => {
  it('R1 fails when the balance sheet does not balance (equity +10%)', () => {
    const p = balancedPeriod();
    p.bs = { ...p.bs, TOTAL_EQUITY: 330, TOTAL_LIABILITIES_EQUITY: 830 };
    const result = reconcileStatements({ context: 'import', periods: [p] });
    const r1 = byCode(result, 'R1_BS_EQUATION')!;
    expect(r1.status).toBe('fail');
    expect(r1.severity).toBe('error');
    expect(result.blocksReady).toBe(true);
    expect(result.overallStatus).toBe('fail');
  });

  it('R2 fails when closing cash disagrees with net change / BS cash', () => {
    const p = balancedPeriod();
    p.cf = { ...p.cf, CLOSING_CASH: 300 }; // opening 200 + net 70 != 300, and != BS.CASH 270
    const result = reconcileStatements({ context: 'import', periods: [p] });
    expect(statusOf(result, 'R2_CASH_TIEOUT')).toBe('fail');
    expect(result.blocksReady).toBe(true);
  });

  it('R3 fails when P&L net income is inconsistent with the cash-flow start line', () => {
    const p = balancedPeriod();
    p.cf = { ...p.cf, NET_INCOME_CF: 250 }; // != P&L NET_INCOME 100
    const result = reconcileStatements({ context: 'import', periods: [p] });
    expect(statusOf(result, 'R3_NET_INCOME_TIE')).toBe('fail');
  });

  it('R8 warns on scale suspicion (revenue divided by 1000, units scaling)', () => {
    const p = balancedPeriod();
    p.pnl = { ...p.pnl, REVENUE: 1, GROSS_PROFIT: 0.4, NET_INCOME: 0.1 };
    const result = reconcileStatements({ context: 'import', periods: [p] });
    const r8 = byCode(result, 'R8_SIGN_MAGNITUDE_SANITY')!;
    expect(r8.status).toBe('warning');
    expect(r8.severity).toBe('warning'); // never blocks
    expect(String((r8.details as any).issues.join(' '))).toMatch(/thousands\/millions/);
  });
});

describe('reconciliationService — the dictionary trap (missing != 0)', () => {
  it('R2 is SKIPPED (not a false pass) when cash-flow section codes are absent', () => {
    const p = balancedPeriod();
    // Remove every cash-related code — a naive val()->0 engine would report 0==0 pass.
    p.cf = { DEPRECIATION_ADDBACK: 50 };
    p.bs = { ...p.bs };
    delete (p.bs as any).CASH;
    const result = reconcileStatements({ context: 'import', periods: [p] });
    expect(statusOf(result, 'R2_CASH_TIEOUT')).toBe('skipped');
  });

  it('R1 is SKIPPED when total assets are absent — never a silent 0==0 pass', () => {
    const p = balancedPeriod();
    p.bs = { ...p.bs };
    delete (p.bs as any).TOTAL_ASSETS;
    delete (p.bs as any).TOTAL_LIABILITIES_EQUITY;
    delete (p.bs as any).TOTAL_LIABILITIES;
    delete (p.bs as any).TOTAL_EQUITY;
    const result = reconcileStatements({ context: 'import', periods: [p] });
    expect(statusOf(result, 'R1_BS_EQUATION')).toBe('skipped');
    expect(result.summary.failed).toBe(0);
  });
});

describe('reconciliationService — two-period series (roll-forwards activate)', () => {
  // Prior period EoP; current period built so roll-forwards tie out.
  const prior = balancedPeriod({ periodDate: '2024-12-31' });
  const current = balancedPeriod({ periodDate: '2025-12-31' });
  // Prior PP&E 250; current PP&E = 250 + capex 40 - depreciation 50 = 240.
  prior.bs = { ...prior.bs, PROPERTY_PLANT_EQUIPMENT: 250 };
  current.bs = { ...current.bs, PROPERTY_PLANT_EQUIPMENT: 240 };
  // Prior debt total 400; drawdown 30, repayment 10 → current debt 420 (ST 60 + LT 360).
  prior.bs = { ...prior.bs, SHORT_TERM_DEBT: 60, LONG_TERM_DEBT: 340 };
  current.bs = { ...current.bs, SHORT_TERM_DEBT: 60, LONG_TERM_DEBT: 360 };
  current.cf = { ...current.cf, DEBT_DRAWDOWN: 30, DEBT_REPAYMENT: 10 };
  // Cash continuity: current OPENING_CASH must equal prior CLOSING_CASH (270).
  current.cf = { ...current.cf, OPENING_CASH: 270, CLOSING_CASH: 340, NET_CHANGE_CASH: 70 };
  current.bs = { ...current.bs, CASH: 340 };
  // Retained earnings roll: RE_now = RE_prior(180) + NI(100) - dividends(10) = 270.
  // Keep R1 balanced by lifting equity & assets totals by the same +90.
  current.bs = {
    ...current.bs,
    RETAINED_EARNINGS: 270,
    TOTAL_EQUITY: 390,
    TOTAL_ASSETS: 890,
    TOTAL_LIABILITIES_EQUITY: 890,
  };

  const result = reconcileStatements({ context: 'import', periods: [prior, current] });
  const cur = result.checks.filter((c) => c.periodDate === '2025-12-31');
  const curStatus = (code: string) => cur.find((c) => c.checkCode === code)?.status;

  it('R4 PP&E roll-forward activates and passes', () => {
    expect(curStatus('R4_PPE_ROLLFORWARD')).toBe('pass');
  });

  it('R5 debt roll-forward + interest sanity activate', () => {
    expect(curStatus('R5_DEBT_ROLLFORWARD')).toBe('pass');
    expect(curStatus('R5_INTEREST_SANITY')).toBe('pass');
  });

  it('R7 period continuity passes when opening cash ties to prior closing', () => {
    expect(curStatus('R7_PERIOD_CONTINUITY')).toBe('pass');
  });

  it('does not block ready on a clean two-period series', () => {
    expect(result.summary.failed).toBe(0);
  });
});

describe('reconciliationService — model context uses divergent internal codes', () => {
  it('resolves PPE_NET / WC_CHANGES / CAPEX_CF aliases and balances', () => {
    const modelPeriod: PeriodStatements = {
      periodDate: '2025-01-01',
      pnl: { REVENUE: 1000, GROSS_PROFIT: 400, DEPRECIATION: 50, INTEREST_EXPENSE: 20, NET_INCOME: 100 },
      cf: {
        NET_INCOME_CF: 100,
        DEPRECIATION_ADDBACK: 50,
        WC_CHANGES: -30,
        OPERATING_CF: 120,
        CAPEX_CF: -40, // model stores capex as a negative outflow
        INVESTING_CF: -40,
        FINANCING_CF: -10,
        DIVIDEND_CF: -10,
        NET_CHANGE_CASH: 70,
        OPENING_CASH: 200,
        CLOSING_CASH: 270,
      },
      bs: {
        CASH: 270,
        PPE_NET: 280,
        TOTAL_ASSETS: 800,
        TOTAL_LIABILITIES: 500,
        TOTAL_EQUITY: 300,
        TOTAL_LIABILITIES_EQUITY: 800,
      },
    };
    const result = reconcileStatements({ context: 'model', periods: [modelPeriod] });
    expect(statusOf(result, 'R1_BS_EQUATION')).toBe('pass');
    expect(statusOf(result, 'R2_CASH_TIEOUT')).toBe('pass');
    expect(statusOf(result, 'R3_NET_INCOME_TIE')).toBe('pass'); // WC_CHANGES alias resolves
    expect(result.summary.failed).toBe(0);
  });
});

describe('reconciliationService — SHADOW MODE never gates', () => {
  it('RECONCILE_ENFORCE is false by default', () => {
    expect(RECONCILE_ENFORCE).toBe(false);
  });

  it('shouldBlockReady() returns false even when blocksReady is true', () => {
    const p = balancedPeriod();
    p.bs = { ...p.bs, TOTAL_EQUITY: 500, TOTAL_LIABILITIES_EQUITY: 1000 }; // breaks R1
    const result = reconcileStatements({ context: 'import', periods: [p] });
    expect(result.blocksReady).toBe(true); // the finding stands…
    expect(shouldBlockReady(result)).toBe(false); // …but shadow mode never blocks.
  });
});
