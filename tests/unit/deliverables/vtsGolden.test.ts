// @vitest-environment node
/**
 * W13.9 — VTS Golden test: realny brief → buildSpine → złote inwarianty VTS Group.
 *
 * "VTS golden" = zestaw wymagań, które ZAWSZE muszą być spełnione dla profilu
 * VTS Group S.A. (produkcja, AI-readiness, wave-2-level data). Test deterministyczny
 * (bez LLM) opiera się na buildSpine + exportBundleFiles + ZIP.
 *
 * Invarianty:
 *   G1 — meta: company zawiera "VTS"
 *   G2 — PnL R3 przychód > R1 przychód (wzrost)
 *   G3 — hero "revenue_last" ≥ 1 000 (realny poziom produkcyjny)
 *   G4 — ≥ 1 założenie o sensitivityRank ≥ 3 (produkcja ma ryzyka)
 *   G5 — spineToUnifiedReport: ≥ 8 slajdów, każdy ma valid intent
 *   G6 — ZIP export: DOCX + XLSX + PPTX ≥ 1 KB każdy
 *   G7 — deck anti-pattern check: brak CRITICAL hits (cover + CTA)
 *   G8 — doc plan: sekcja exec_summary ma ≥ 1 blok kpi_strip
 */
import { describe, expect, it, beforeAll } from 'vitest';
import {
  buildSpine,
  spineToDeckSlides,
  spineToDocPlan,
  spineToTableIntent,
} from '../../../server/src/services/deliverables/bundleOrchestrator.js';
import { spineToUnifiedReport } from '../../../server/src/services/deliverables/spineToUnifiedReport.js';
import { exportBundleFiles, bundleFilesToZip } from '../../../server/src/services/deliverables/bundleExportRuntime.js';
import { detectDeckAntiPatterns } from '../../../server/src/services/deliverables/deckAntiPatternDetector.js';
import type { BusinessPlanInput } from '../../../server/src/services/deliverables/assumptionsModel.js';
import type { BusinessPlanSpine } from '../../../server/src/services/deliverables/businessPlanSpine.js';
import type { GeneratedBundle } from '../../../server/src/services/deliverables/bundleGenerationRuntime.js';

// VTS Group — profil produkcja (AI-readiness, wave-2 brief)
const VTS_INPUT: BusinessPlanInput = {
  company: 'VTS Group S.A.',
  language: 'PL',
  product: 'Platformy AI do optymalizacji procesów produkcyjnych i logistycznych',
  thesis: 'VTS Group transformuje produkcję klimatyzatorów przez AI — redukcja kosztów operacyjnych o 15%, skrócenie cyklu produkcji o 20% w 24 mies.',
  ask: 'Inwestycja wewnętrzna 2M PLN',
  startYear: 2026,
  years: 3,
  currency: 'PLN',
  drivers: {
    saasPricePerSeatMonth: 0, saasSeatsStart: 0, saasSeatGrowthYoY: 1.0,
    grossChurnAnnual: 0.05, nrr: 1.05, servicesRevenueStart: 280_000, servicesGrowthYoY: 0.18,
    grossMargin: 0.35, smPctRevenue: 0.08, rdPctRevenue: 0.06, gaPctRevenue: 0.12,
    daPctRevenue: 0.01, opexLeverageYoY: 0.95, cac: 0, arpuAnnual: 280_000,
    startingCash: 500_000, fundingRaised: 2_000_000, taxRate: 0.19,
  },
  market: {
    tamTopDown: 45_000, tamSource: 'GUS 2024',
    samValue: 4_500, somValue: 450,
    bottomUpCustomers: 3, bottomUpArpu: 280,
    unit: 'mln PLN',
  },
};

const VALID_M19_INTENTS = new Set([
  'cover', 'executive_summary', 'section_intro', 'key_messages', 'performance_overview',
  'single_insight', 'comparison', 'assessment', 'root_cause', 'recommendation_single',
  'recommendation_portfolio', 'initiative_portfolio', 'prioritization_matrix', 'roadmap',
  'risk_management', 'next_steps', 'appendix',
]);

let spine: BusinessPlanSpine;

describe('W13.9 — VTS Golden: realny profil produkcja AI-readiness', () => {
  beforeAll(() => { spine = buildSpine(VTS_INPUT); });

  it('G1 — meta.company zawiera "VTS"', () => {
    expect(spine.meta.company).toContain('VTS');
  });

  it('G2 — PnL R3 > R1 (wzrost 3-letni)', () => {
    const pnl = spine.financials.pnl;
    expect(pnl.length).toBe(3);
    expect(pnl[2].revenue).toBeGreaterThan(pnl[0].revenue);
  });

  it('G3 — hero "revenue_last" ≥ 100 000 PLN (realny poziom produkcja)', () => {
    const rev = spine.heroNumbers.find((h) => h.key === 'revenue_last');
    expect(rev).toBeDefined();
    expect(rev!.value).toBeGreaterThanOrEqual(100_000);
  });

  it('G4 — ≥ 1 założenie z sensitivityRank ≥ 3 (producja ma ryzyka)', () => {
    const highRisk = spine.assumptions.filter((a) => a.sensitivityRank >= 3);
    expect(highRisk.length).toBeGreaterThanOrEqual(1);
  });

  it('G5 — spineToUnifiedReport: ≥ 8 slajdów, każdy z katalog 17 intencji M19', () => {
    const report = spineToUnifiedReport(spine);
    expect(report.slides.length).toBeGreaterThanOrEqual(8);
    for (const s of report.slides) {
      expect(
        VALID_M19_INTENTS.has(s.intent),
        `Invalid intent "${s.intent}"`,
      ).toBe(true);
    }
  });

  it('G6 — ZIP export: DOCX + XLSX + PPTX, każdy ≥ 1 KB', async () => {
    const deck = spineToDeckSlides(spine);
    const docSections = spineToDocPlan(spine).sections.map((s) => ({
      heading: s.title,
      blocks: s.blocks.map((b) => ({
        type: b.type === 'kpi_strip' ? 'kpi' : b.type,
        content: { text: b.hint },
      })),
    }));
    const tableData = {
      fields: [
        { key: 'rok', header: 'Rok', type: 'text' },
        { key: 'przychod', header: 'Przychód', type: 'currency' },
        { key: 'ebitda', header: 'EBITDA', type: 'currency' },
      ],
      seedRows: spine.financials.pnl.map((p) => ({
        rok: p.period, przychod: Math.round(p.revenue), ebitda: Math.round(p.ebitda),
      })),
      conditionalFormatting: [],
    };
    const bundle: GeneratedBundle = {
      spine,
      doc: { sections: docSections },
      table: tableData,
      deck: {
        tierUsed: 'STANDARD', fallbackUsed: true,
        plans: deck.map((s, i) => ({
          slideIndex: i, layoutIntent: s.intent,
          title: s.content.title, keyMessage: s.key_message,
        })),
      },
      produced: { table: true, doc: true, deck: true },
    } as unknown as GeneratedBundle;

    const files = await exportBundleFiles(bundle, 'executive');
    const zip = await bundleFilesToZip(files, 'VTS');

    expect(zip).toBeInstanceOf(Buffer);
    expect(zip!.length).toBeGreaterThan(5_000);

    const { default: JSZip } = await import('jszip');
    const parsed = await JSZip.loadAsync(zip!);
    const names = Object.keys(parsed.files);
    expect(names).toContain('VTS-raport.docx');
    expect(names).toContain('VTS-model.xlsx');
    expect(names).toContain('VTS-prezentacja.pptx');
    for (const name of names) {
      const data = await parsed.files[name].async('uint8array');
      expect(data.length, `${name} jest pusty`).toBeGreaterThan(1024);
    }
  }, 30_000);

  it('G7 — deck anti-pattern check: brak AP-01 CRITICAL (>6 punktorów w slajdach SPINE)', () => {
    // Uwaga: spineToDeckSlides nie dodaje cover/CTA — te dodaje planDeckLayout (LLM step).
    // G7 weryfikuje tylko AP-01 (>6 bullets) — content quality, nie structural quality.
    const deck = spineToDeckSlides(spine);
    // Prepend cover + append CTA żeby spełnić AP-05/AP-06/AP-07
    const plans = [
      { slideIndex: 0, layoutIntent: 'cover', title: 'VTS Group — AI Readiness', keyMessage: '' },
      ...deck.map((s, i) => ({
        slideIndex: i + 1, layoutIntent: s.intent,
        title: s.content.title, keyMessage: s.key_message,
      })),
      { slideIndex: deck.length + 1, layoutIntent: 'next_steps', title: 'Następne kroki', keyMessage: 'Pilotaż AI w produkcji: 30 dni → 3 linie technologiczne → ROI Q3 2026.' },
    ];
    const report = detectDeckAntiPatterns(plans);
    // Brak AP-01 (zbyt wiele punktorów) — spineToDeckSlides nie generuje punktorów
    const ap01 = report.hits.filter((h) => h.code === 'AP-01-TOO-MANY-BULLETS');
    expect(ap01).toHaveLength(0);
    // Strukturalnie deck przechodzi (cover na 0, CTA na końcu)
    expect(report.criticalCount).toBe(0);
  });

  it('G8 — doc plan: sekcja exec_summary ma ≥ 1 blok kpi_strip', () => {
    const plan = spineToDocPlan(spine);
    // spineToDocPlan sections: { title, purpose, blocks } — purpose = "exec_summary: ..."
    const exec = plan.sections.find((s) => s.purpose?.startsWith('exec_summary'));
    expect(exec).toBeDefined();
    const kpiBlock = exec!.blocks.find((b) => b.type === 'kpi_strip');
    expect(kpiBlock).toBeDefined();
  });
});
