// @vitest-environment node
/**
 * W1.8a — bundleDocQa: kompozycja dojrzałego silnika M18 Document Studio QA
 * (runDocumentQa, 10 kategorii) na raporcie wiązki. Sprawdza ugruntowanie:
 * pusty doc → null; realny doc → raport z ocenami kategorii + anyBlocking.
 */
import { describe, expect, it } from 'vitest';
import { runBundleDocQa } from '../../../server/src/services/deliverables/bundleDocQa.js';
import { buildSpine } from '../../../server/src/services/deliverables/bundleOrchestrator.js';
import type { BusinessPlanInput } from '../../../server/src/services/deliverables/assumptionsModel.js';

const INPUT: BusinessPlanInput = {
  company: 'QaCo', language: 'PL', product: 'SaaS B2B', thesis: 'Teza testowa redukcji kosztów o 30%.',
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

// Minimalny content-like doc (kształt z generateDocumentContent: sections[].blocks[])
const FAKE_DOC = {
  sections: [
    { heading: 'Streszczenie wykonawcze', blocks: [
      { type: 'text', content: { text: 'QaCo redukuje koszty operacyjne o 30% dzięki automatyzacji logistyki. Rekomendujemy rundę seed €500k na 18 miesięcy runway.' } },
    ] },
    { heading: 'Model finansowy', blocks: [
      { type: 'text', content: { text: 'Przychód rośnie do poziomu rentowności w trzecim roku planu. EBITDA dodatnia od roku drugiego.' } },
    ] },
  ],
};

describe('W1.8a — runBundleDocQa (kompozycja M18 QA)', () => {
  it('pusty doc → null (fail-soft)', () => {
    expect(runBundleDocQa(null, spine)).toBeNull();
    expect(runBundleDocQa({}, spine)).toBeNull();
    expect(runBundleDocQa({ sections: [] }, spine)).toBeNull();
  });

  it('realny doc → podsumowanie z ocenami kategorii', () => {
    const summary = runBundleDocQa(FAKE_DOC, spine);
    expect(summary).not.toBeNull();
    expect(typeof summary!.anyBlocking).toBe('boolean');
    expect(typeof summary!.overallScore).toBe('number');
    expect(summary!.overallScore).toBeGreaterThanOrEqual(0);
    expect(summary!.overallScore).toBeLessThanOrEqual(100);
  });

  it('categoryScores pokrywa wiele kategorii M18 (≥5)', () => {
    const summary = runBundleDocQa(FAKE_DOC, spine);
    expect(Object.keys(summary!.categoryScores).length).toBeGreaterThanOrEqual(5);
  });

  it('blockingCategories ⊆ kategorie z categoryScores', () => {
    const summary = runBundleDocQa(FAKE_DOC, spine);
    const known = new Set(Object.keys(summary!.categoryScores));
    for (const c of summary!.blockingCategories) {
      expect(known.has(c)).toBe(true);
    }
  });

  it('highFindings = nieujemna liczba', () => {
    const summary = runBundleDocQa(FAKE_DOC, spine);
    expect(summary!.highFindings).toBeGreaterThanOrEqual(0);
  });

  it('deterministyczne — 2× ten sam doc → ten sam overallScore', () => {
    const a = runBundleDocQa(FAKE_DOC, spine);
    const b = runBundleDocQa(FAKE_DOC, spine);
    expect(a!.overallScore).toBe(b!.overallScore);
  });
});
