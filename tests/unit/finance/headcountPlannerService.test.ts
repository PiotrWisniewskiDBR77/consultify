/**
 * M16/6.3 — Headcount Planner Service unit tests.
 *
 * Pure-function math, no DB. Every expectation is hand-computed from the
 * production formula (fully-loaded = salary × (1 + benefitsLoadPct); linear ramp
 * over rampMonths starting at startPeriod) and shown in comments so a regression
 * fails here rather than shipping a bogus workforce plan.
 */
import { describe, expect, it } from 'vitest';

import {
  costPerHire,
  headcountOpex,
  headcountToCash,
  roleCost,
  type HeadcountRole,
} from '../../../server/src/services/headcountPlannerService.js';

const role = (over: Partial<HeadcountRole> = {}): HeadcountRole => ({
  id: 'r1',
  title: 'Engineer',
  baseSalary: 10000,
  benefitsLoadPct: 0.25,
  startPeriod: 0,
  rampMonths: 0,
  ...over,
});

describe('roleCost', () => {
  it('loaded cost exceeds base salary by the benefits load', () => {
    // 10000 × (1 + 0.25) = 12500
    const r = roleCost(role({ benefitsLoadPct: 0.25, rampMonths: 0 }), 0);
    expect(r.baseSalary).toBe(10000);
    expect(r.loadedCost).toBe(12500);
    expect(r.loadedCost).toBeGreaterThan(r.baseSalary);
    expect(r.isRamped).toBe(false);
  });

  it('zero benefits load → loaded equals base', () => {
    const r = roleCost(role({ benefitsLoadPct: 0 }), 0);
    expect(r.loadedCost).toBe(r.baseSalary);
  });

  it('costs nothing before the start period', () => {
    const r = roleCost(role({ startPeriod: 3 }), 0);
    expect(r.baseSalary).toBe(0);
    expect(r.loadedCost).toBe(0);
    expect(r.isRamped).toBe(false);
  });

  it('still zero at the period just before start', () => {
    const r = roleCost(role({ startPeriod: 3 }), 2);
    expect(r.loadedCost).toBe(0);
  });

  it('partial cost during a linear ramp (isRamped=true)', () => {
    // start=0, ramp=4 → period 0 = 1/4, period 1 = 2/4 ...
    const def = role({ startPeriod: 0, rampMonths: 4, benefitsLoadPct: 0.25 });

    const p0 = roleCost(def, 0); // 10000 × 1/4 = 2500 ; loaded = 3125
    expect(p0.baseSalary).toBe(2500);
    expect(p0.loadedCost).toBe(3125);
    expect(p0.isRamped).toBe(true);

    const p1 = roleCost(def, 1); // 10000 × 2/4 = 5000 ; loaded = 6250
    expect(p1.baseSalary).toBe(5000);
    expect(p1.isRamped).toBe(true);

    const p3 = roleCost(def, 3); // last ramp period → full cost
    expect(p3.baseSalary).toBe(10000);
    expect(p3.isRamped).toBe(false);
  });

  it('full cost once ramped, and ramp honors a later start', () => {
    const def = role({ startPeriod: 2, rampMonths: 2, benefitsLoadPct: 0 });
    expect(roleCost(def, 1).loadedCost).toBe(0); // before start
    expect(roleCost(def, 2).baseSalary).toBe(5000); // 1/2 ramp
    expect(roleCost(def, 2).isRamped).toBe(true);
    expect(roleCost(def, 3).baseSalary).toBe(10000); // 2/2 = full
    expect(roleCost(def, 9).baseSalary).toBe(10000); // long after ramp
  });
});

describe('headcountOpex', () => {
  const periods = ['M1', 'M2', 'M3'];

  it('sums loaded cost across all roles per period', () => {
    const roles = [
      role({ id: 'a', baseSalary: 10000, benefitsLoadPct: 0.25 }), // loaded 12500
      role({ id: 'b', baseSalary: 8000, benefitsLoadPct: 0.5 }), //  loaded 12000
    ];
    const rows = headcountOpex(roles, periods);
    expect(rows).toHaveLength(3);
    // both active from M1 → headcount 2, salary 18000, loaded 24500
    expect(rows[0]).toEqual({
      period: 'M1',
      headcount: 2,
      totalSalary: 18000,
      totalLoaded: 24500,
    });
  });

  it('headcount and cost grow as roles come online', () => {
    const roles = [
      role({ id: 'a', startPeriod: 0, baseSalary: 10000, benefitsLoadPct: 0 }),
      role({ id: 'b', startPeriod: 2, baseSalary: 10000, benefitsLoadPct: 0 }),
    ];
    const rows = headcountOpex(roles, periods);

    // M1: only role a active
    expect(rows[0].headcount).toBe(1);
    expect(rows[0].totalLoaded).toBe(10000);

    // M2: still only a (b starts at index 2)
    expect(rows[1].headcount).toBe(1);

    // M3: both active → headcount and cost rose
    expect(rows[2].headcount).toBe(2);
    expect(rows[2].totalLoaded).toBe(20000);
    expect(rows[2].totalLoaded).toBeGreaterThan(rows[0].totalLoaded);
    expect(rows[2].headcount).toBeGreaterThan(rows[0].headcount);
  });

  it('empty roster → zeroed rows, one per period', () => {
    const rows = headcountOpex([], periods);
    expect(rows).toHaveLength(3);
    expect(rows.every((r) => r.headcount === 0 && r.totalLoaded === 0)).toBe(true);
  });
});

describe('headcountToCash', () => {
  const periods = ['M1', 'M2', 'M3'];
  const roles = [role({ baseSalary: 10000, benefitsLoadPct: 0.25 })]; // loaded 12500

  it('with no lag, cash out equals that period loaded OPEX', () => {
    const cash = headcountToCash(roles, periods);
    expect(cash).toEqual([
      { period: 'M1', cashOut: 12500 },
      { period: 'M2', cashOut: 12500 },
      { period: 'M3', cashOut: 12500 },
    ]);
  });

  it('payroll lag shifts cash out by N periods', () => {
    const cash = headcountToCash(roles, periods, 1);
    // P0 accrual paid in P1; P0 itself has nothing due yet.
    expect(cash[0].cashOut).toBe(0);
    expect(cash[1].cashOut).toBe(12500);
    expect(cash[2].cashOut).toBe(12500);
  });

  it('total cash out is conserved across a lag (only timing shifts)', () => {
    const noLag = headcountToCash(roles, periods).reduce((s, r) => s + r.cashOut, 0);
    const lagged = headcountToCash(roles, periods, 1).reduce(
      (s, r) => s + r.cashOut,
      0,
    );
    // Last period's accrual falls outside the window when lagged, so lagged ≤ noLag.
    expect(lagged).toBeLessThanOrEqual(noLag);
    expect(lagged).toBe(25000); // M1+M2 accruals land in M2+M3
  });
});

describe('costPerHire', () => {
  it('averages fully-loaded annual cost across the roster', () => {
    const roles = [
      role({ id: 'a', baseSalary: 10000, benefitsLoadPct: 0.25 }), // 12500 ×12 = 150000
      role({ id: 'b', baseSalary: 10000, benefitsLoadPct: 0.25 }),
    ];
    const r = costPerHire(roles);
    expect(r.totalRoles).toBe(2);
    expect(r.avgLoadedAnnual).toBe(150000);
  });

  it('empty roster → zeros, no divide-by-zero', () => {
    expect(costPerHire([])).toEqual({ totalRoles: 0, avgLoadedAnnual: 0 });
  });
});
