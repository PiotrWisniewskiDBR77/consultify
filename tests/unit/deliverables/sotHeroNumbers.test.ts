// @vitest-environment node
/**
 * W13.3 — SoT hero-number consistency test (§D3).
 *
 * Proves that hero-numbers are computed ONCE in buildSpine and then reused
 * identically by all three converters (deck / doc / table). This is the
 * "single source of truth" guarantee — no duplicate math, no format divergence.
 *
 * Pure: no LLM calls. All functions under test are deterministic given the spine.
 */

import { describe, expect, it, beforeAll } from 'vitest';
import {
  buildSpine,
  spineToDeckSlides,
  spineToDocOutline,
  spineToTableIntent,
} from '../../../server/src/services/deliverables/bundleOrchestrator.js';
import type { BusinessPlanInput } from '../../../server/src/services/deliverables/assumptionsModel.js';
import type { BusinessPlanSpine } from '../../../server/src/services/deliverables/businessPlanSpine.js';

const INPUT: BusinessPlanInput = {
  company: 'TestCo SoT',
  language: 'PL',
  product: 'SaaS B2B logistics platform',
  thesis: 'TestCo eliminates scheduling lag in logistics (30% cost reduction).',
  ask: 'Seed €500k',
  startYear: 2026,
  years: 3,
  currency: 'EUR',
  drivers: {
    saasPricePerSeatMonth: 150,
    saasSeatsStart: 40,
    saasSeatGrowthYoY: 2.2,
    grossChurnAnnual: 0.12,
    nrr: 1.12,
    servicesRevenueStart: 600,
    servicesGrowthYoY: 0.25,
    grossMargin: 0.72,
    smPctRevenue: 0.22,
    rdPctRevenue: 0.14,
    gaPctRevenue: 0.09,
    daPctRevenue: 0.02,
    opexLeverageYoY: 0.88,
    cac: 900,
    arpuAnnual: 1800,
    startingCash: 300,
    fundingRaised: 500,
    taxRate: 0.19,
  },
  market: {
    tamTopDown: 8000,
    tamSource: 'est',
    samValue: 800,
    somValue: 80,
    bottomUpCustomers: 45,
    bottomUpArpu: 1.8,
    unit: 'mln EUR',
  },
};

let spine: BusinessPlanSpine;

describe('W13.3 — hero-number SoT consistency', () => {
  beforeAll(() => {
    spine = buildSpine(INPUT);
  });

  it('buildSpine zwraca heroNumbers (≥1 liczba)', () => {
    expect(spine.heroNumbers.length).toBeGreaterThan(0);
  });

  it('heroNumbers mają unikalne klucze', () => {
    const keys = spine.heroNumbers.map((h) => h.key);
    const unique = new Set(keys);
    expect(unique.size).toBe(keys.length);
  });

  it('każdy heroNumber ma niezerowe formatted (nie pusty string)', () => {
    for (const h of spine.heroNumbers) {
      expect(h.formatted.length).toBeGreaterThan(0);
      expect(h.formatted).not.toBe('');
    }
  });

  it('revenue_last heroNumber zgadza się z ostatnim rokiem PnL', () => {
    const heroRev = spine.heroNumbers.find((h) => h.key === 'revenue_last');
    expect(heroRev).toBeDefined();
    const lastPnl = spine.financials.pnl.at(-1);
    expect(lastPnl).toBeDefined();
    // hero.value = ostatnie revenue (z PnL) — same source
    expect(heroRev!.value).toBe(lastPnl!.revenue);
  });

  it('spineToDeckSlides reużywa heroNumbers.formatted w key_message', () => {
    const slides = spineToDeckSlides(spine);
    expect(slides.length).toBeGreaterThan(0);

    // Sekcja financial_plan ma heroNumberKeys: ['revenue_last', 'ebitda_last', ...]
    // → key_message = ich sformatowane wartości (§E4)
    const heroRev = spine.heroNumbers.find((h) => h.key === 'revenue_last')!;
    const heroEbitda = spine.heroNumbers.find((h) => h.key === 'ebitda_last')!;

    const allMessages = slides.map((s) => s.key_message ?? '').join('\n');
    expect(allMessages).toContain(heroRev.formatted);
    expect(allMessages).toContain(heroEbitda.formatted);
  });

  it('spineToDocOutline reużywa heroNumbers.formatted w purpose każdej sekcji z hero-kluczami', () => {
    const outline = spineToDocOutline(spine);
    expect(outline.length).toBeGreaterThan(0);

    const heroRev = spine.heroNumbers.find((h) => h.key === 'revenue_last')!;
    const allPurposes = outline.map((s) => s.purpose).join('\n');
    // financial_plan ma heroNumberKeys: ['revenue_last', ...]
    expect(allPurposes).toContain(heroRev.formatted);
  });

  it('spineToTableIntent zawiera surowe liczby z PnL (SoT = ten sam obiekt financials)', () => {
    const intent = spineToTableIntent(spine);
    // intent zawiera JSON.stringify(rows) — każdy wiersz ma przychod = pnl.revenue
    for (const pnl of spine.financials.pnl) {
      expect(intent).toContain(String(pnl.revenue));
    }
  });

  it('hero-numbers formatted strings nie zawierają surowymi {{placeholderami}} (sanity gate)', () => {
    for (const h of spine.heroNumbers) {
      expect(h.formatted).not.toMatch(/\{\{|\[TODO\]/);
    }
  });

  it('jeden brief → ten sam spine → deterministyczny revenue_last w deck + doc + table', () => {
    // Wywołuj 2× niezależnie — deterministyczne (czysta funkcja buildSpine)
    const spine1 = buildSpine(INPUT);
    const spine2 = buildSpine(INPUT);

    const rev1 = spine1.heroNumbers.find((h) => h.key === 'revenue_last')!.formatted;
    const rev2 = spine2.heroNumbers.find((h) => h.key === 'revenue_last')!.formatted;
    expect(rev1).toBe(rev2); // SoT: to samo wejście → ta sama liczba

    // Deck (wszystkie slajdy) zawiera revenue_last
    const allSlides1 = spineToDeckSlides(spine1).map((s) => s.key_message ?? '').join('\n');
    expect(allSlides1).toContain(rev1);

    // Doc (wszystkie sekcje) zawiera revenue_last
    const allPurposes1 = spineToDocOutline(spine1).map((s) => s.purpose).join('\n');
    expect(allPurposes1).toContain(rev1);

    // Table intent zawiera raw revenue value
    const tableIntent1 = spineToTableIntent(spine1);
    const lastRev = spine1.financials.pnl.at(-1)!.revenue;
    expect(tableIntent1).toContain(String(lastRev));
  });
});
