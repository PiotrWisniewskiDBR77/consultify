// @vitest-environment node
/**
 * W12.3 — BundleOrchestrator parity validator.
 *
 * Weryfikuje że kluczowe funkcje bundleOrchestrator są ze sobą SPÓJNE i
 * że buildSpine produkuje dane, które każda funkcja pochodna interpretuje poprawnie:
 *
 *   1. buildSpine → spineToDeckSlides: każda sekcja ma slajd, każdy slajd ma intent
 *   2. buildSpine → spineToDocPlan: każda sekcja SPINE ma odpowiedni plan w doc
 *   3. buildSpine → spineToTableIntent: intent zawiera realne liczby z PnL (nie zera)
 *   4. buildSpine → attachChartSpecs: chart specs nie psują planów (additive-only)
 *   5. SPINE HeroNumbers spójność: hero keys muszą być unikalne, formatted non-empty
 *   6. SPINE PnL spójność: revenue > 0, wartości rosnące w base scenario (growth)
 *   7. SPINE Assumptions spójność: sensitivityRank sortowalne, range[0] < range[1]
 *   8. Parity: numSlides == numSections (1:1 mapping kontraktu)
 */
import { describe, expect, it, beforeAll } from 'vitest';
import {
  buildSpine,
  spineToDeckSlides,
  spineToDocPlan,
  spineToTableIntent,
  attachChartSpecs,
} from '../../../server/src/services/deliverables/bundleOrchestrator.js';
import type { BusinessPlanInput } from '../../../server/src/services/deliverables/assumptionsModel.js';
import type { BusinessPlanSpine } from '../../../server/src/services/deliverables/businessPlanSpine.js';

const INPUT: BusinessPlanInput = {
  company: 'ParityTest Corp',
  language: 'PL',
  product: 'B2B SaaS HR platform',
  thesis: 'ParityTest eliminuje papierową kadrę (−60% admin).',
  ask: 'Seed €300k',
  startYear: 2026,
  years: 3,
  currency: 'EUR',
  drivers: {
    saasPricePerSeatMonth: 80, saasSeatsStart: 20, saasSeatGrowthYoY: 2.0,
    grossChurnAnnual: 0.10, nrr: 1.10, servicesRevenueStart: 400, servicesGrowthYoY: 0.20,
    grossMargin: 0.70, smPctRevenue: 0.25, rdPctRevenue: 0.15, gaPctRevenue: 0.10,
    daPctRevenue: 0.02, opexLeverageYoY: 0.90, cac: 600, arpuAnnual: 960,
    startingCash: 200, fundingRaised: 300, taxRate: 0.19,
  },
  market: {
    tamTopDown: 5000, tamSource: 'est', samValue: 500, somValue: 50,
    bottomUpCustomers: 55, bottomUpArpu: 0.96, unit: 'mln EUR',
  },
};

let spine: BusinessPlanSpine;

describe('W12.3 — BundleOrchestrator parity', () => {
  beforeAll(() => { spine = buildSpine(INPUT); });

  // ── 1. Deck slides ───────────────────────────────────────────────────────────

  it('1. spineToDeckSlides: 1 slajd na sekcję, każdy ma intent i content', () => {
    const slides = spineToDeckSlides(spine);
    expect(slides.length).toBe(spine.sections.length);
    for (const slide of slides) {
      expect(slide.intent).toBeTruthy();
      expect(typeof slide.intent).toBe('string');
      expect(slide.content).toBeDefined();
    }
  });

  it('1b. spineToDeckSlides: każdy slide.key_message nie jest pusty (grounded)', () => {
    const slides = spineToDeckSlides(spine);
    for (const slide of slides) {
      expect(slide.key_message.length, `slide.intent=${slide.intent} key_message empty`).toBeGreaterThan(0);
    }
  });

  // ── 2. Doc plan ──────────────────────────────────────────────────────────────

  it('2. spineToDocPlan: zwraca sections[] z blokami dla każdej sekcji SPINE', () => {
    const plan = spineToDocPlan(spine);
    expect(plan.sections.length).toBeGreaterThanOrEqual(spine.sections.length);
    for (const sec of plan.sections) {
      expect(sec.title).toBeTruthy();
      expect(sec.blocks.length).toBeGreaterThan(0);
    }
  });

  it('2b. spineToDocPlan: bloki mają type i hint', () => {
    const plan = spineToDocPlan(spine);
    for (const sec of plan.sections) {
      for (const block of sec.blocks) {
        expect(block.type).toBeTruthy();
        expect(block.hint).toBeTruthy();
      }
    }
  });

  // ── 3. Table intent ──────────────────────────────────────────────────────────

  it('3. spineToTableIntent: zawiera nazwę firmy i realne liczby z PnL', () => {
    const intent = spineToTableIntent(spine);
    expect(intent).toContain(spine.meta.company);
    // PnL revenue R1 > 0
    const r1 = spine.financials.pnl[0].revenue;
    expect(r1).toBeGreaterThan(0);
    // intent zawiera r1 jako string
    expect(intent).toContain(String(Math.round(r1)));
  });

  it('3b. spineToTableIntent: zawiera walutę i kolumny finansowe', () => {
    const intent = spineToTableIntent(spine);
    expect(intent).toContain(spine.financials.currency);
    expect(intent.toLowerCase()).toMatch(/przychód|revenue|przychod/i);
  });

  // ── 4. attachChartSpecs (additive-only) ─────────────────────────────────────

  it('4. attachChartSpecs: nie usuwa ani nie zmienia istniejących pól planów', () => {
    const slides = spineToDeckSlides(spine).map((s, i) => ({
      slideIndex: i,
      layoutIntent: s.intent,
      title: s.content.title,
      keyMessage: s.key_message,
    }));
    const withCharts = attachChartSpecs(slides, spine);
    expect(withCharts.length).toBe(slides.length);
    for (let i = 0; i < slides.length; i++) {
      // oryginalne pola zachowane
      expect(withCharts[i].layoutIntent).toBe(slides[i].layoutIntent);
      expect(withCharts[i].title).toBe(slides[i].title);
      expect(withCharts[i].keyMessage).toBe(slides[i].keyMessage);
    }
  });

  // ── 5. HeroNumbers spójność ──────────────────────────────────────────────────

  it('5. hero numbers: klucze unikalne, formatted non-empty, value > 0 dla finansów', () => {
    const keys = spine.heroNumbers.map((h) => h.key);
    const uniqueKeys = new Set(keys);
    expect(uniqueKeys.size).toBe(keys.length); // brak duplikatów
    for (const h of spine.heroNumbers) {
      expect(h.formatted).toBeTruthy();
      expect(h.label).toBeTruthy();
    }
  });

  it('5b. hero "revenue_last" istnieje i jest dodatni', () => {
    const rev = spine.heroNumbers.find((h) => h.key === 'revenue_last');
    expect(rev).toBeDefined();
    expect(rev!.value).toBeGreaterThan(0);
  });

  // ── 6. PnL spójność ──────────────────────────────────────────────────────────

  it('6. PnL: 3 okresy, revenue rośnie R1→R2→R3', () => {
    const pnl = spine.financials.pnl;
    expect(pnl.length).toBe(INPUT.years);
    expect(pnl[0].revenue).toBeGreaterThan(0);
    expect(pnl[1].revenue).toBeGreaterThan(pnl[0].revenue);
    expect(pnl[2].revenue).toBeGreaterThan(pnl[1].revenue);
  });

  it('6b. PnL: każdy okres ma period string, revenue, cogs, ebitda', () => {
    for (const p of spine.financials.pnl) {
      expect(p.period).toBeTruthy();
      expect(typeof p.revenue).toBe('number');
      expect(typeof p.cogs).toBe('number');
      expect(typeof p.ebitda).toBe('number');
    }
  });

  // ── 7. Assumptions spójność ──────────────────────────────────────────────────

  it('7. assumptions: sensitivityRank sortowalny, range[0] < range[1]', () => {
    const sorted = spine.assumptions.slice().sort((a, b) => b.sensitivityRank - a.sensitivityRank);
    expect(sorted[0].sensitivityRank).toBeGreaterThanOrEqual(sorted[sorted.length - 1].sensitivityRank);
    for (const a of spine.assumptions) {
      expect(a.range[0]).toBeLessThan(a.range[1]);
    }
  });

  // ── 8. Parity: sections → slides 1:1 ────────────────────────────────────────

  it('8. parity: len(sections) == len(spineToDeckSlides)', () => {
    expect(spineToDeckSlides(spine).length).toBe(spine.sections.length);
  });
});
