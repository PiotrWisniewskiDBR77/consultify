/**
 * businessCaseModel — deterministic engine tests (Oxford O4 foundation).
 * Pure-function tests: no LLM, no DB, no network. Covers the numeric contract
 * the narrative layer depends on (BusinessCaseService.buildFactsBlock etc.).
 */

import { describe, it, expect } from 'vitest';

import {
  computeNPV,
  computeIRR,
  computePayback,
  computeROI,
  buildCashflows,
  runBusinessCaseModel,
  type BusinessCasePlan,
  type ValueDriver,
} from '../../../server/src/services/advisory/businessCaseModel.js';
import {
  buildFactsBlock,
  checkNarrativeNumbers,
  resolveBusinessCaseWacc,
} from '../../../server/src/services/advisory/BusinessCaseService.js';

describe('computeNPV', () => {
  it('discounts future cashflows correctly at a given rate', () => {
    // year0 = -1000, year1 = 1100, at 10% discount → NPV = -1000 + 1000 = 0
    const npv = computeNPV([-1000, 1100], 10);
    expect(npv).toBeCloseTo(0, 1);
  });

  it('returns the raw sum when rate is 0', () => {
    const npv = computeNPV([-100, 50, 50, 50], 0);
    expect(npv).toBeCloseTo(50, 6);
  });
});

describe('computePayback', () => {
  it('computes fractional payback year for even cashflows', () => {
    // -1000 upfront, then 500/year → cumulative: -1000, -500, 0 → payback at year 2 exactly
    const payback = computePayback([-1000, 500, 500, 500]);
    expect(payback).toBe(2);
  });

  it('interpolates a fractional year within the recovery year', () => {
    // -1000, then 600/year: cumulative -1000,-400,+200 → crosses zero during year 2
    const payback = computePayback([-1000, 600, 600]);
    expect(payback).not.toBeNull();
    expect(payback as number).toBeGreaterThan(1);
    expect(payback as number).toBeLessThan(2);
  });

  it('returns null when investment never recovers within horizon', () => {
    const payback = computePayback([-1000, 100, 100]);
    expect(payback).toBeNull();
  });
});

describe('computeIRR', () => {
  it('finds the rate that zeroes NPV for a simple 2-period cashflow', () => {
    // -1000, 1100 → IRR = 10%
    const irr = computeIRR([-1000, 1100]);
    expect(irr).not.toBeNull();
    expect(irr as number).toBeCloseTo(10, 0);
  });

  it('returns null when cashflows never recover the investment', () => {
    const irr = computeIRR([-1000, 100, 100]);
    expect(irr).toBeNull();
  });
});

describe('computeROI', () => {
  it('computes ROI% relative to the upfront investment', () => {
    const { roiPct, totalInvestment, totalNominalBenefit } = computeROI([-1000, 600, 600]);
    expect(totalInvestment).toBe(1000);
    expect(totalNominalBenefit).toBe(1200);
    expect(roiPct).toBeCloseTo(20, 6); // (1200-1000)/1000 * 100
  });
});

describe('buildCashflows', () => {
  const drivers: ValueDriver[] = [
    { key: 'capex', label: 'Wdrożenie', role: 'capex', annualAmount: 100_000 },
    {
      key: 'adoption_savings',
      label: 'Oszczędności z adopcji',
      role: 'benefit',
      annualAmount: 80_000,
      rampPct: [0.5, 1],
    },
    { key: 'license_cost', label: 'Koszt licencji', role: 'cost', annualAmount: 10_000 },
  ];

  it('places capex at year 0 as a negative outflow', () => {
    const cf = buildCashflows(drivers, 3);
    expect(cf[0]).toBe(-100_000);
  });

  it('applies the ramp curve to benefit drivers per year', () => {
    const cf = buildCashflows(drivers, 3);
    // year1: 80000*0.5 - 10000 = 30000; year2: 80000*1 - 10000 = 70000; year3 repeats last ramp value
    expect(cf[1]).toBe(30_000);
    expect(cf[2]).toBe(70_000);
    expect(cf[3]).toBe(70_000);
  });

  it('applies a scenario override multiplier only to the targeted driver', () => {
    const cf = buildCashflows(drivers, 2, { adoption_savings: 0.7 });
    // year1: 80000*0.7*0.5 - 10000 = 18000
    expect(cf[1]).toBe(18_000);
    // capex untouched
    expect(cf[0]).toBe(-100_000);
  });
});

function samplePlan(): BusinessCasePlan {
  return {
    problem: 'Czy wdrożyć nowe narzędzie do automatyzacji raportowania?',
    options: [
      { id: 'opt_build', name: 'Wdrożenie narzędzia', description: 'Zakup i wdrożenie automatyzacji' },
      { id: 'opt_status_quo', name: 'Status quo', description: 'Pozostanie przy ręcznym raportowaniu' },
    ],
    drivers: [
      { key: 'capex', label: 'Wdrożenie', role: 'capex', annualAmount: 200_000 },
      {
        key: 'adoption',
        label: 'Oszczędność czasu zespołu',
        role: 'benefit',
        annualAmount: 150_000,
        rampPct: [0.6, 0.9, 1],
        rationale: 'Szacunek na bazie 3 FTE x 20% czasu odzyskanego',
      },
      {
        key: 'maintenance',
        label: 'Utrzymanie systemu',
        role: 'cost',
        annualAmount: 20_000,
        rationale: 'Support dostawcy',
      },
    ],
    scenarios: [
      {
        key: 'slow_adoption',
        name: 'Wolniejsza adopcja',
        driverKey: 'adoption',
        multiplier: 0.7,
        rationale: 'Zespół opiera się zmianie procesu',
      },
      {
        key: 'fast_adoption',
        name: 'Szybsza adopcja dzięki mistrzom zmiany',
        driverKey: 'adoption',
        multiplier: 1.2,
        rationale: 'Champions network przyspiesza wdrożenie',
      },
    ],
    horizonYears: 3,
    waccPct: 12,
    currency: 'PLN',
  };
}

describe('runBusinessCaseModel', () => {
  it('computes a base case and every named scenario', () => {
    const model = runBusinessCaseModel(samplePlan());
    expect(model.base.npv).toBeTypeOf('number');
    expect(model.scenarios).toHaveLength(2);
    expect(model.scenarios.map((s) => s.name)).toEqual([
      'Wolniejsza adopcja',
      'Szybsza adopcja dzięki mistrzom zmiany',
    ]);
  });

  it('ranks worst/best case by NPV among named scenarios', () => {
    const model = runBusinessCaseModel(samplePlan());
    expect(model.worstCase?.key).toBe('slow_adoption');
    expect(model.bestCase?.key).toBe('fast_adoption');
    expect(model.worstCase!.npv).toBeLessThan(model.bestCase!.npv);
  });

  it('throws when a scenario targets an unknown driver (fail loud, not silent)', () => {
    const plan = samplePlan();
    plan.scenarios[0].driverKey = 'does_not_exist';
    expect(() => runBusinessCaseModel(plan)).toThrow(/unknown driver/);
  });

  it('throws when the plan has no drivers', () => {
    const plan = { ...samplePlan(), drivers: [] };
    expect(() => runBusinessCaseModel(plan)).toThrow(/no drivers/);
  });
});

describe('buildFactsBlock + checkNarrativeNumbers (anti-fabrication net)', () => {
  it('produces a facts block containing the base NPV', () => {
    const model = runBusinessCaseModel(samplePlan());
    const facts = buildFactsBlock(model);
    expect(facts).toContain('NPV');
    expect(facts).toContain('PLN');
    expect(facts).toContain('Wolniejsza adopcja');
  });

  it('flags a narrative number that does not appear in the facts block', () => {
    const model = runBusinessCaseModel(samplePlan());
    const facts = buildFactsBlock(model);
    const fabricatedNarrative = 'Rekomendujemy wdrożenie, NPV wynosi 999999999 PLN.';
    const check = checkNarrativeNumbers(fabricatedNarrative, facts);
    expect(check.consistent).toBe(false);
    expect(check.unverifiedNumbers.length).toBeGreaterThan(0);
  });

  it('accepts a narrative that only quotes numbers present in the facts block', () => {
    const model = runBusinessCaseModel(samplePlan());
    const facts = buildFactsBlock(model);
    const npvRounded = Math.round(model.base.npv).toLocaleString('pl-PL');
    const honestNarrative = `Rekomendujemy wdrożenie. NPV bazowy wynosi ${npvRounded} PLN przy WACC ${model.waccPct}%.`;
    const check = checkNarrativeNumbers(honestNarrative, facts);
    expect(check.consistent).toBe(true);
  });
});

describe('resolveBusinessCaseWacc (discount rate is engine-owned, never an LLM guess)', () => {
  it('uses the industry guidance band midpoint when no client rate is supplied', () => {
    const r = resolveBusinessCaseWacc({ industrySegment: 'SaaS startup', sizeBand: 'medium' });
    expect(r.source).toBe('industry-guidance');
    expect(r.guidance.industry).toBe('software-saas');
    expect(r.waccPct).toBe(r.guidance.recommendedWaccPct);
    // SaaS band is the highest in the set — definitely not a flat 10% default.
    expect(r.waccPct).toBeGreaterThan(10);
    expect(r.grade.verdict).toBe('in-band');
  });

  it('prefers an explicit, finite, positive client rate over the guidance band', () => {
    const r = resolveBusinessCaseWacc({
      explicitWaccPct: 9,
      industrySegment: 'SaaS startup',
      sizeBand: 'medium',
    });
    expect(r.source).toBe('client');
    expect(r.waccPct).toBe(9);
    // 9% is below the SaaS band → graded as NPV-overstating, surfaced not hidden.
    expect(r.grade.verdict).toBe('below-band');
  });

  it('ignores a non-positive / non-finite client rate and falls back to guidance', () => {
    for (const bad of [0, -5, Number.NaN, Infinity]) {
      const r = resolveBusinessCaseWacc({ explicitWaccPct: bad, industrySegment: 'utilities' });
      expect(r.source).toBe('industry-guidance');
      expect(r.waccPct).toBe(r.guidance.recommendedWaccPct);
    }
  });

  it('differentiates the rate by industry (utilities < generic < SaaS)', () => {
    const util = resolveBusinessCaseWacc({ industrySegment: 'utilities' }).waccPct;
    const generic = resolveBusinessCaseWacc({ industrySegment: 'coś nieznanego' }).waccPct;
    const saas = resolveBusinessCaseWacc({ industrySegment: 'software' }).waccPct;
    expect(util).toBeLessThan(generic);
    expect(generic).toBeLessThan(saas);
  });

  it('surfaces WACC provenance + band grading in the facts block', () => {
    const model = runBusinessCaseModel(samplePlan());
    const resolution = resolveBusinessCaseWacc({ industrySegment: 'usługi profesjonalne' });
    const facts = buildFactsBlock(model, resolution);
    expect(facts).toContain('Pochodzenie WACC');
    expect(facts).toContain('guidance branżowego');
    expect(facts).toContain('Zakres branżowy');
  });
});
