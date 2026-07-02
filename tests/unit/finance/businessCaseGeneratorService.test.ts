import { describe, it, expect } from 'vitest';
import {
  generateOnePager,
  compareInitiatives,
  npv,
  irr,
  type InitiativeEconomics,
} from '../../../server/src/services/businessCaseGeneratorService.js';

const baseGo: InitiativeEconomics = {
  id: 'i-1',
  name: 'Automatyzacja raportowania',
  capex: 100_000,
  opexAnnual: 10_000,
  benefitAnnual: 60_000,
  horizonYears: 5,
};

const baseNoGo: InitiativeEconomics = {
  id: 'i-2',
  name: 'Eksperyment marginalny',
  capex: 200_000,
  opexAnnual: 50_000,
  benefitAnnual: 55_000,
  horizonYears: 3,
};

describe('npv helper', () => {
  it('discounts future cash flows correctly', () => {
    // -100 at t0, +110 at t1 @ 10% → exactly 0
    expect(npv(0.1, [-100, 110])).toBeCloseTo(0, 6);
  });

  it('year-0 flow is undiscounted', () => {
    expect(npv(0.25, [-50])).toBe(-50);
  });
});

describe('irr helper', () => {
  it('finds the rate that zeroes NPV', () => {
    const r = irr([-100, 110]);
    expect(r).not.toBeNull();
    expect(r as number).toBeCloseTo(0.1, 3);
  });

  it('returns null when no sign change (all positive)', () => {
    expect(irr([10, 20, 30])).toBeNull();
  });
});

describe('generateOnePager', () => {
  it('computes NPV using the SUPPLIED WACC (not hardcoded)', () => {
    const wacc = 10;
    const p = generateOnePager(baseGo, wacc);
    // net annual = 60k - 10k = 50k, capex 100k, 5y @ 10%
    const expected = npv(0.1, [-100_000, 50_000, 50_000, 50_000, 50_000, 50_000]);
    expect(p.npv).toBeCloseTo(expected, 0);
    expect(p.npv).toBeGreaterThan(0);
  });

  it('produces a non-empty narrative summary mentioning WACC and recommendation', () => {
    const p = generateOnePager(baseGo, 12);
    expect(typeof p.summary).toBe('string');
    expect(p.summary.length).toBeGreaterThan(0);
    expect(p.summary).toContain('WACC');
    expect(p.summary).toContain('12');
    expect(p.summary.toUpperCase()).toContain('REKOMENDACJA');
  });

  it('returns a GO verdict for a strongly positive case', () => {
    const p = generateOnePager(baseGo, 10);
    expect(p.verdict).toBe('go');
    expect(p.pi).toBeGreaterThan(1);
    expect(p.irr).not.toBeNull();
    expect(p.paybackYears).not.toBeNull();
  });

  it('returns a NO-GO verdict for a value-destroying case', () => {
    const p = generateOnePager(baseNoGo, 10);
    expect(p.verdict).toBe('no-go');
    expect(p.npv).toBeLessThan(0);
  });

  it('carries through the input fields', () => {
    const p = generateOnePager(baseGo, 8);
    expect(p.id).toBe('i-1');
    expect(p.name).toBe('Automatyzacja raportowania');
    expect(p.capex).toBe(100_000);
    expect(p.horizonYears).toBe(5);
  });
});

describe('WACC sensitivity', () => {
  it('higher WACC yields a lower NPV', () => {
    const low = generateOnePager(baseGo, 5);
    const high = generateOnePager(baseGo, 20);
    expect(high.npv).toBeLessThan(low.npv);
  });

  it('a high enough WACC can flip a GO into NO-GO', () => {
    const low = generateOnePager(baseGo, 5);
    const extreme = generateOnePager(baseGo, 60);
    expect(low.verdict).toBe('go');
    expect(extreme.npv).toBeLessThan(low.npv);
    expect(extreme.verdict).toBe('no-go');
  });
});

describe('compareInitiatives', () => {
  it('ranks the portfolio by NPV descending and assigns 1-based ranks', () => {
    const rows = compareInitiatives([baseNoGo, baseGo], 10);
    expect(rows).toHaveLength(2);
    // baseGo (positive NPV) should outrank baseNoGo (negative NPV)
    expect(rows[0].id).toBe('i-1');
    expect(rows[0].rank).toBe(1);
    expect(rows[1].id).toBe('i-2');
    expect(rows[1].rank).toBe(2);
    expect(rows[0].npv).toBeGreaterThan(rows[1].npv);
  });

  it('carries recommendation per row', () => {
    const rows = compareInitiatives([baseGo, baseNoGo], 10);
    const go = rows.find((r) => r.id === 'i-1');
    const noGo = rows.find((r) => r.id === 'i-2');
    expect(go?.recommendation).toBe('go');
    expect(noGo?.recommendation).toBe('no-go');
  });

  it('handles an empty portfolio', () => {
    expect(compareInitiatives([], 10)).toEqual([]);
  });
});
