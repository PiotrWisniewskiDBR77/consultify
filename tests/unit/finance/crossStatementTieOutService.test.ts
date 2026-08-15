import { describe, it, expect } from 'vitest';

import {
  validatePackTieOut,
  tieOutSummary,
  type StatementPack,
  type TieOutCheck,
} from '../../../server/src/services/crossStatementTieOutService.js';

function find(checks: TieOutCheck[], name: string): TieOutCheck {
  const hit = checks.find((c) => c.check === name);
  if (!hit) throw new Error(`check ${name} not found`);
  return hit;
}

/**
 * A fully articulated pack:
 *  - Prior retained earnings 1000, net income 200 → closing retained 1200.
 *  - CF: NI 200 + D&A 50 − ΔWC 30 = 220 operating; investing −40; financing −80 → net change 100.
 *  - Opening cash 300 + 100 = 400 closing cash = BS cash.
 *  - Assets 2000 = Liabilities 800 + Equity 1200.
 */
function coherentPack(): StatementPack {
  return {
    pnl: {
      NET_INCOME: 200,
      DEPRECIATION_AMORTIZATION: 50,
    },
    bs: {
      RETAINED_EARNINGS: 1200,
      CASH: 400,
      TOTAL_ASSETS: 2000,
      TOTAL_LIABILITIES: 800,
      TOTAL_EQUITY: 1200,
    },
    bsPrior: {
      RETAINED_EARNINGS: 1000,
    },
    cf: {
      CF_OPERATING: 220,
      CF_INVESTING: -40,
      CF_FINANCING: -80,
      CF_NET_CHANGE_IN_CASH: 100,
      CF_CLOSING_CASH: 400,
      CF_CHANGE_IN_WORKING_CAPITAL: 30,
    },
  };
}

describe('crossStatementTieOutService', () => {
  it('coherent pack → every check passes', () => {
    const checks = validatePackTieOut(coherentPack());
    expect(checks).toHaveLength(6);
    for (const c of checks) {
      expect(c.status, `${c.check} should pass`).toBe('pass');
      expect(Math.abs(c.difference)).toBeLessThanOrEqual(Math.abs(c.expected) * 0.01 + 1e-6);
    }
    const summary = tieOutSummary(checks);
    expect(summary).toEqual({ passed: 6, warnings: 0, failed: 0, isClean: true });
  });

  it('missing required line fails closed even when zero substitution would balance', () => {
    const pack = coherentPack();
    delete pack.bs.TOTAL_ASSETS;
    pack.bs.TOTAL_LIABILITIES = 0;
    pack.bs.TOTAL_EQUITY = 0;
    const checks = validatePackTieOut(pack);
    const presence = find(checks, 'REQUIRED_LINES_PRESENT');
    expect(presence.status).toBe('fail');
    expect(presence.message).toContain('TOTAL_ASSETS');
    expect(tieOutSummary(checks).isClean).toBe(false);
  });

  it('cash divergence → CLOSING_CASH_MATCH fails', () => {
    const pack = coherentPack();
    pack.bs.CASH = 999; // BS cash no longer ties to CF closing cash
    const checks = validatePackTieOut(pack);
    const cashCheck = find(checks, 'CLOSING_CASH_MATCH');
    expect(cashCheck.status).toBe('fail');
    expect(cashCheck.expected).toBe(400);
    expect(cashCheck.actual).toBe(999);
    expect(cashCheck.difference).toBe(599);
    expect(tieOutSummary(checks).failed).toBeGreaterThanOrEqual(1);
    expect(tieOutSummary(checks).isClean).toBe(false);
  });

  it('balance sheet out of balance → BS_BALANCES fails', () => {
    const pack = coherentPack();
    pack.bs.TOTAL_ASSETS = 2500; // assets no longer equal liabilities + equity (2000)
    const checks = validatePackTieOut(pack);
    const bsCheck = find(checks, 'BS_BALANCES');
    expect(bsCheck.status).toBe('fail');
    expect(bsCheck.expected).toBe(2500);
    expect(bsCheck.actual).toBe(2000);
    expect(bsCheck.difference).toBe(-500);
  });

  it('net income vs retained earnings drift → NET_INCOME_TO_RETAINED warns', () => {
    const pack = coherentPack();
    pack.bs.RETAINED_EARNINGS = 1400; // change is 400, not the 200 net income
    const checks = validatePackTieOut(pack);
    const niCheck = find(checks, 'NET_INCOME_TO_RETAINED');
    expect(niCheck.status).toBe('warning');
    expect(niCheck.expected).toBe(200);
    expect(niCheck.actual).toBe(400);
  });

  it('operating cash flow that does not reconcile → CF_INDIRECT_RECONCILE warns', () => {
    const pack = coherentPack();
    pack.cf.CF_OPERATING = 500; // expected 200 + 50 − 30 = 220
    const checks = validatePackTieOut(pack);
    const reconcile = find(checks, 'CF_INDIRECT_RECONCILE');
    expect(reconcile.status).toBe('warning');
    expect(reconcile.expected).toBe(220);
    expect(reconcile.actual).toBe(500);
  });

  it('cf sections that do not sum → CF_SECTIONS_SUM fails', () => {
    const pack = coherentPack();
    pack.cf.CF_NET_CHANGE_IN_CASH = 250; // sections sum to 100
    const checks = validatePackTieOut(pack);
    const sections = find(checks, 'CF_SECTIONS_SUM');
    expect(sections.status).toBe('fail');
    expect(sections.expected).toBe(250);
    expect(sections.actual).toBe(100);
  });

  it('tolerance band absorbs sub-threshold rounding noise', () => {
    const pack = coherentPack();
    pack.bs.CASH = 401; // 0.25% off 400 → within 1% tolerance
    const checks = validatePackTieOut(pack, 1);
    expect(find(checks, 'CLOSING_CASH_MATCH').status).toBe('pass');
  });

  it('tieOutSummary counts warnings and clears isClean even with no failures', () => {
    const summary = tieOutSummary([
      { check: 'A', status: 'pass', expected: 0, actual: 0, difference: 0, message: '' },
      { check: 'B', status: 'warning', expected: 0, actual: 0, difference: 0, message: '' },
    ]);
    expect(summary).toEqual({ passed: 1, warnings: 1, failed: 0, isClean: false });
  });
});
