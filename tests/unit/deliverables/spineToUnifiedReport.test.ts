// @vitest-environment node
/**
 * W7.6 — spineToUnifiedReport: SPINE → UnifiedReportJSON (M19 PptxPipelineService).
 * Sprawdza: poprawne intencje (z katalogu 17), ugruntowanie liczb w SPINE,
 * oraz że dojrzały pipeline REALNIE generuje bufor .pptx z tego raportu.
 */
import { describe, expect, it, beforeAll } from 'vitest';
import { buildSpine } from '../../../server/src/services/deliverables/bundleOrchestrator.js';
import { spineToUnifiedReport } from '../../../server/src/services/deliverables/spineToUnifiedReport.js';
import { PptxPipelineService } from '../../../server/src/services/report/pptx/PptxPipelineService.js';
import type { BusinessPlanInput } from '../../../server/src/services/deliverables/assumptionsModel.js';
import type { BusinessPlanSpine } from '../../../server/src/services/deliverables/businessPlanSpine.js';

const INPUT: BusinessPlanInput = {
  company: 'TestCo Pipeline',
  language: 'PL',
  product: 'SaaS B2B logistics platform',
  thesis: 'TestCo eliminuje opóźnienia w logistyce (30% redukcja kosztów).',
  ask: 'Seed €500k',
  startYear: 2026,
  years: 3,
  currency: 'EUR',
  drivers: {
    saasPricePerSeatMonth: 150, saasSeatsStart: 40, saasSeatGrowthYoY: 2.2,
    grossChurnAnnual: 0.12, nrr: 1.12, servicesRevenueStart: 600, servicesGrowthYoY: 0.25,
    grossMargin: 0.72, smPctRevenue: 0.22, rdPctRevenue: 0.14, gaPctRevenue: 0.09,
    daPctRevenue: 0.02, opexLeverageYoY: 0.88, cac: 900, arpuAnnual: 1800,
    startingCash: 300, fundingRaised: 500, taxRate: 0.19,
  },
  market: {
    tamTopDown: 8000, tamSource: 'est', samValue: 800, somValue: 80,
    bottomUpCustomers: 45, bottomUpArpu: 1.8, unit: 'mln EUR',
  },
};

// 17 dozwolonych intencji M19
const VALID_INTENTS = new Set([
  'cover', 'executive_summary', 'section_intro', 'key_messages', 'performance_overview',
  'single_insight', 'comparison', 'assessment', 'root_cause', 'recommendation_single',
  'recommendation_portfolio', 'initiative_portfolio', 'prioritization_matrix', 'roadmap',
  'risk_management', 'next_steps', 'appendix',
]);

let spine: BusinessPlanSpine;

describe('W7.6 — spineToUnifiedReport', () => {
  beforeAll(() => { spine = buildSpine(INPUT); });

  it('zwraca meta + slides (≥6 slajdów)', () => {
    const report = spineToUnifiedReport(spine);
    expect(report.meta.client).toBe('TestCo Pipeline');
    expect(report.meta.language).toBe('pl');
    expect(report.slides.length).toBeGreaterThanOrEqual(6);
  });

  it('KAŻDY slajd ma intencję z katalogu 17 M19', () => {
    const report = spineToUnifiedReport(spine);
    for (const s of report.slides) {
      expect(VALID_INTENTS.has(s.intent)).toBe(true);
    }
  });

  it('pierwszy slajd to cover z nazwą firmy', () => {
    const report = spineToUnifiedReport(spine);
    expect(report.slides[0].intent).toBe('cover');
    expect((report.slides[0].content as any).organization).toBe('TestCo Pipeline');
  });

  it('exec summary zawiera KPI z hero-numbers (ugruntowane)', () => {
    const report = spineToUnifiedReport(spine);
    const exec = report.slides.find((s) => s.intent === 'executive_summary');
    expect(exec).toBeDefined();
    const kpis = (exec!.content as any).kpis as Array<{ name: string; value: string }>;
    expect(kpis.length).toBeGreaterThan(0);
    // wartości = formatted hero-numbers (te same co w deck/doc/table — SoT)
    const revHero = spine.heroNumbers.find((h) => h.key === 'revenue_last')!;
    expect(kpis.some((kp) => kp.value === revHero.formatted)).toBe(true);
  });

  it('slajd finansowy ma bar chart z REALNYCH wartości pnl', () => {
    const report = spineToUnifiedReport(spine);
    const fin = report.slides.find(
      (s) => s.intent === 'single_insight' && (s.content as any).chart_type === 'bar',
    );
    expect(fin).toBeDefined();
    const data = (fin!.content as any).chart_data;
    expect(data.labels).toEqual(spine.financials.pnl.map((p) => p.period));
    // pierwsza seria = przychód, wartości = round(pnl.revenue)
    expect(data.series[0].values).toEqual(spine.financials.pnl.map((p) => Math.round(p.revenue)));
  });

  it('slajd ryzyk pochodzi z top-założeń wg sensitivityRank (ugruntowane)', () => {
    const report = spineToUnifiedReport(spine);
    const risk = report.slides.find((s) => s.intent === 'risk_management');
    expect(risk).toBeDefined();
    const risks = (risk!.content as any).risks as Array<{ risk: string }>;
    expect(risks.length).toBeGreaterThan(0);
    const topLabel = spine.assumptions.slice().sort((a, b) => b.sensitivityRank - a.sensitivityRank)[0].label;
    expect(risks[0].risk).toContain(topLabel);
  });

  it('slajd ask zawiera wycenę (W12.2 valuation hero)', () => {
    const report = spineToUnifiedReport(spine);
    const ask = report.slides.find((s) => s.intent === 'recommendation_single');
    expect(ask).toBeDefined();
    const valLow = spine.heroNumbers.find((h) => h.key === 'valuation_low')?.formatted;
    if (valLow) {
      expect((ask!.content as any).impact).toContain(valLow);
    }
  });

  it('DOJRZAŁY M19 pipeline REALNIE generuje bufor .pptx z tego raportu', async () => {
    const report = spineToUnifiedReport(spine);
    const pipeline = new PptxPipelineService();
    const result = await pipeline.generateFromUnifiedJson(report, {
      language: 'pl', skipValidation: true,
    });
    expect(result.buffer).toBeInstanceOf(Buffer);
    expect(result.buffer.length).toBeGreaterThan(1000);
    // PPTX = zip → zaczyna się od "PK"
    expect(result.buffer.subarray(0, 2).toString('latin1')).toBe('PK');
    expect(result.slideCount).toBeGreaterThanOrEqual(6);
  });
});
