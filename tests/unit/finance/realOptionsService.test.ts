import { describe, it, expect } from 'vitest';
import {
  deferOption,
  abandonOption,
  stagedInvestment,
  type DeferOptionInput,
} from '../../../server/src/services/realOptionsService';

const baseDefer: DeferOptionInput = {
  underlyingValue: 100,
  investmentCost: 100,
  volatility: 0.3,
  riskFreeRate: 0.05,
  timeToDecideYears: 1,
  steps: 4,
};

describe('deferOption', () => {
  it('returns a non-negative option value', () => {
    const r = deferOption(baseDefer);
    expect(r.optionValue).toBeGreaterThanOrEqual(0);
  });

  it('higher volatility yields a larger option value (option value rises in σ)', () => {
    const low = deferOption({ ...baseDefer, volatility: 0.15 });
    const high = deferOption({ ...baseDefer, volatility: 0.6 });
    expect(high.optionValue).toBeGreaterThan(low.optionValue);
  });

  it('expandedNpv = max(staticNpv, optionValue)', () => {
    const r = deferOption(baseDefer);
    const staticNpv = baseDefer.underlyingValue - baseDefer.investmentCost;
    expect(r.expandedNpv).toBe(Math.max(staticNpv, r.optionValue));
    // At-the-money with positive vol: option carries time value → defer.
    expect(r.expandedNpv).toBeGreaterThan(0);
  });

  it('recommends "defer" for an at-the-money project with volatility', () => {
    const r = deferOption(baseDefer);
    expect(r.recommendation).toBe('defer');
  });

  it('recommends "invest-now" for a certain, deep-in-the-money project', () => {
    // No volatility and no carry benefit to waiting (r = 0) → the option holds
    // no time value, so optionValue == staticNpv and immediate investing wins.
    const r = deferOption({
      ...baseDefer,
      underlyingValue: 300,
      investmentCost: 100,
      volatility: 0.0001,
      riskFreeRate: 0,
    });
    expect(r.recommendation).toBe('invest-now');
    expect(r.expandedNpv).toBeGreaterThan(0);
  });

  it('recommends "abandon" for a deep out-of-the-money project with no upside', () => {
    // Worthless underlying, zero vol → option dead, NPV negative.
    const r = deferOption({
      ...baseDefer,
      underlyingValue: 10,
      investmentCost: 100,
      volatility: 0.0001,
      timeToDecideYears: 0.1,
    });
    expect(r.optionValue).toBe(0);
    expect(r.recommendation).toBe('abandon');
  });

  it('is deterministic (same input → same output)', () => {
    expect(deferOption(baseDefer)).toEqual(deferOption(baseDefer));
  });
});

describe('abandonOption', () => {
  it('returns a non-negative put-like option value and echoes salvage', () => {
    const r = abandonOption({
      underlyingValue: 100,
      salvageValue: 80,
      volatility: 0.4,
      riskFreeRate: 0.05,
      timeToDecideYears: 1,
    });
    expect(r.salvageValue).toBe(80);
    expect(r.optionValue).toBeGreaterThanOrEqual(0);
  });

  it('higher volatility yields a larger abandonment value', () => {
    const common = {
      underlyingValue: 100,
      salvageValue: 90,
      riskFreeRate: 0.05,
      timeToDecideYears: 1,
      steps: 4,
    };
    const low = abandonOption({ ...common, volatility: 0.15 });
    const high = abandonOption({ ...common, volatility: 0.6 });
    expect(high.optionValue).toBeGreaterThan(low.optionValue);
  });
});

describe('stagedInvestment', () => {
  it('recommends "pilot-first" when uncertainty is high', () => {
    // Two risky stages: staging lets you stop spending after a failed pilot,
    // so abandonment flexibility makes pilot-first at least as good as full.
    const r = stagedInvestment([
      { cost: 50, expectedValue: 120, successProb: 0.5 },
      { cost: 200, expectedValue: 600, successProb: 0.5 },
    ]);
    expect(r.recommendation).toBe('pilot-first');
  });

  it('returns the expected sequential staged value', () => {
    const stages = [
      { cost: 50, expectedValue: 120, successProb: 0.5 },
      { cost: 200, expectedValue: 600, successProb: 0.5 },
    ];
    // EV = (0.5*120 - 50) + 0.5*(0.5*600 - 200) = 10 + 0.5*100 = 60
    const r = stagedInvestment(stages);
    expect(r.totalOptionValue).toBeCloseTo(60, 6);
  });

  it('handles an empty stage list', () => {
    const r = stagedInvestment([]);
    expect(r.totalOptionValue).toBe(0);
    expect(r.recommendation).toBe('full-commit');
  });

  it('is deterministic', () => {
    const stages = [{ cost: 10, expectedValue: 50, successProb: 0.7 }];
    expect(stagedInvestment(stages)).toEqual(stagedInvestment(stages));
  });
});
