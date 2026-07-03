// @vitest-environment node
/**
 * W1.8b — bundleDeckQa: kompozycja dojrzałego gate strukturalnego M19
 * (validateReport / RulesEngine) na decku wiązki z SPINE — in-memory, bez DB.
 */
import { describe, expect, it } from 'vitest';
import { runBundleDeckQa } from '../../../server/src/services/deliverables/bundleDeckQa.js';
import { buildSpine } from '../../../server/src/services/deliverables/bundleOrchestrator.js';
import type { BusinessPlanInput } from '../../../server/src/services/deliverables/assumptionsModel.js';

const INPUT: BusinessPlanInput = {
  company: 'DeckQaCo', language: 'PL', product: 'SaaS B2B', thesis: 'Teza testowa redukcji kosztów o 30%.',
  ask: 'Seed €500k', startYear: 2026, years: 3, currency: 'EUR',
  drivers: {
    saasPricePerSeatMonth: 150, saasSeatsStart: 40, saasSeatGrowthYoY: 2.2, grossChurnAnnual: 0.12,
    nrr: 1.12, servicesRevenueStart: 600, servicesGrowthYoY: 0.25, grossMargin: 0.72,
    smPctRevenue: 0.22, rdPctRevenue: 0.14, gaPctRevenue: 0.09, daPctRevenue: 0.02,
    opexLeverageYoY: 0.88, cac: 900, arpuAnnual: 1800, startingCash: 300, fundingRaised: 500, taxRate: 0.19,
  },
  market: { tamTopDown: 8000, tamSource: 'est', samValue: 800, somValue: 80, bottomUpCustomers: 45, bottomUpArpu: 1.8, unit: 'mln EUR' },
};

const spine = buildSpine(INPUT);

describe('W1.8b — runBundleDeckQa (kompozycja M19 validateReport)', () => {
  it('zwraca podsumowanie z polami valid/errorCount/warningCount', () => {
    const summary = runBundleDeckQa(spine);
    expect(summary).not.toBeNull();
    expect(typeof summary!.valid).toBe('boolean');
    expect(typeof summary!.errorCount).toBe('number');
    expect(typeof summary!.warningCount).toBe('number');
  });

  it('valid === (errorCount === 0)', () => {
    const summary = runBundleDeckQa(spine)!;
    expect(summary.valid).toBe(summary.errorCount === 0);
  });

  it('deck z SPINE przechodzi gate strukturalny (brak error-violations)', () => {
    const summary = runBundleDeckQa(spine)!;
    // spineToUnifiedReport buduje poprawny raport → nie powinno być twardych błędów
    expect(summary.errorCount).toBe(0);
    expect(summary.valid).toBe(true);
  });

  it('topViolations to max 5 wpisów z rule+severity+message', () => {
    const summary = runBundleDeckQa(spine)!;
    expect(summary.topViolations.length).toBeLessThanOrEqual(5);
    for (const v of summary.topViolations) {
      expect(typeof v.rule).toBe('string');
      expect(['error', 'warning']).toContain(v.severity);
      expect(typeof v.message).toBe('string');
    }
  });

  it('deterministyczne — 2× ten sam spine → ten sam errorCount', () => {
    const a = runBundleDeckQa(spine)!;
    const b = runBundleDeckQa(spine)!;
    expect(a.errorCount).toBe(b.errorCount);
    expect(a.warningCount).toBe(b.warningCount);
  });
});
