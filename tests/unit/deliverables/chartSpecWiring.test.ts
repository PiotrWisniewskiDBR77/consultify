// @vitest-environment node
/**
 * Unit test — W1.5: chart-spec → renderer wired.
 * (1) attachChartSpecs: performance_overview → bar_series, risk_management → rag, others → no spec
 * (2) deckPlansToPptxBuffer: when plan has chartSpec, addChart / addShape is called
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// ─────────────────────────────────────────────────────────
// Part 1: attachChartSpecs (pure function, no mocks needed)
// ─────────────────────────────────────────────────────────
import { attachChartSpecs } from '../../../server/src/services/deliverables/bundleOrchestrator.js';
import { buildSpine } from '../../../server/src/services/deliverables/bundleOrchestrator.js';
import type { BusinessPlanInput } from '../../../server/src/services/deliverables/assumptionsModel.js';

const input = (): BusinessPlanInput => ({
  company: 'TestCo', language: 'PL', product: 'TestProd',
  thesis: 'Teza testowa.', ask: 'Seed 500k EUR', startYear: 2026, years: 3, currency: 'EUR',
  drivers: {
    saasPricePerSeatMonth: 100, saasSeatsStart: 50, saasSeatGrowthYoY: 2.0,
    grossChurnAnnual: 0.15, nrr: 1.1, servicesRevenueStart: 500, servicesGrowthYoY: 0.2,
    grossMargin: 0.70, smPctRevenue: 0.25, rdPctRevenue: 0.15, gaPctRevenue: 0.10, daPctRevenue: 0.02,
    opexLeverageYoY: 0.9, cac: 1000, arpuAnnual: 1200, startingCash: 500, fundingRaised: 500, taxRate: 0.19,
  },
  market: { tamTopDown: 10000, tamSource: 'est', samValue: 1000, somValue: 100, bottomUpCustomers: 50, bottomUpArpu: 1.2, unit: 'mln EUR' },
});

describe('W1.5 — attachChartSpecs', () => {
  let spine: ReturnType<typeof buildSpine>;
  beforeEach(() => { spine = buildSpine(input()); });

  it('performance_overview → bar_series z revenue+EBITDA', () => {
    const plans = [{ layoutIntent: 'performance_overview', slideIndex: 0 }];
    const result = attachChartSpecs(plans, spine);
    const spec = result[0].chartSpec;
    expect(spec).not.toBeNull();
    expect(spec?.type).toBe('bar_series');
    if (spec?.type === 'bar_series') {
      expect(spec.labels).toHaveLength(3); // 3 years
      expect(spec.series.find((s) => s.name === 'Przychód')).toBeTruthy();
      expect(spec.series.find((s) => s.name === 'EBITDA')).toBeTruthy();
    }
  });

  it('risk_management → rag z sensitivity-ranked assumptions', () => {
    const plans = [{ layoutIntent: 'risk_management', slideIndex: 5 }];
    const result = attachChartSpecs(plans, spine);
    const spec = result[0].chartSpec;
    expect(spec?.type).toBe('rag');
    if (spec?.type === 'rag') {
      expect(spec.items.length).toBeGreaterThan(0);
      expect(['green', 'amber', 'red']).toContain(spec.items[0].status);
    }
  });

  it('inne layoutIntent → brak chartSpec (additive, brak mutacji)', () => {
    const plans = [
      { layoutIntent: 'executive_summary', slideIndex: 0 },
      { layoutIntent: 'single_insight', slideIndex: 1 },
      { layoutIntent: 'roadmap', slideIndex: 2 },
    ];
    const result = attachChartSpecs(plans, spine);
    // żaden z tych nie powinien mieć chartSpec (lub mają undefined/null)
    for (const r of result) {
      expect(r.chartSpec ?? null).toBeNull();
    }
  });

  it('W7.5 — market → marimekko z grounded TAM/SAM/SOM (zero fabrykacji)', () => {
    const plans = [{ layoutIntent: 'market', slideIndex: 4 }];
    const result = attachChartSpecs(plans, spine);
    const spec = result[0].chartSpec;
    expect(spec?.type).toBe('marimekko');
    if (spec?.type === 'marimekko') {
      expect(spec.columns).toHaveLength(2); // TAM→SAM, SAM→SOM
      // segmenty addytywne: SAM osiągalny + reszta = TAM
      const col0 = spec.columns[0];
      const sam = col0.segments.find((s) => s.name.includes('SAM'))!.value;
      const rest = col0.segments.find((s) => s.name.includes('Reszta'))!.value;
      // tam=10000, sam=1000 → reszta 9000 (z derived som=100 w GTM; sprawdzamy spójność hierarchii)
      expect(sam + rest).toBeCloseTo(spine.market.tam.value, 5);
    }
  });

  it('W7.5 — market z niepoprawną hierarchią → brak mekko (fail-safe, brak fabrykacji)', () => {
    // sztuczny spine z som > sam → pomijamy
    const broken = { ...spine, market: { ...spine.market, som: { ...spine.market.som, value: 999999 } } };
    const plans = [{ layoutIntent: 'market', slideIndex: 4 }];
    const result = attachChartSpecs(plans, broken as typeof spine);
    expect(result[0].chartSpec ?? null).toBeNull();
  });

  it('key_metrics_overview → bar_series (alias)', () => {
    const plans = [{ layoutIntent: 'key_metrics_overview', slideIndex: 3 }];
    const result = attachChartSpecs(plans, spine);
    expect(result[0].chartSpec?.type).toBe('bar_series');
  });
});

// ─────────────────────────────────────────────────────────
// Part 2: deckPlansToPptxBuffer uses addChart when spec present
// ─────────────────────────────────────────────────────────

// Mock pptxgenjs so addChart / addShape calls are captured.
const mockAddChart = vi.fn().mockReturnValue(undefined);
const mockAddShape = vi.fn().mockReturnValue(undefined);
const mockAddText = vi.fn().mockReturnValue(undefined);
const mockSlide = { background: {}, addText: mockAddText, addShape: mockAddShape, addChart: mockAddChart };
const mockPptx: any = {
  layout: '',
  author: '',
  company: '',
  title: '',
  addSlide: vi.fn(() => mockSlide),
  ShapeType: { rect: 'rect', ellipse: 'ellipse', pie: 'pie' },
  write: vi.fn().mockResolvedValue(Buffer.from('pptx')),
};

// Intercept require('pptxgenjs') → return mockPptx constructor
vi.mock('node:module', () => ({
  createRequire: () => (_module: string) => function() { return mockPptx; },
}));

import { deckPlansToPptxBuffer } from '../../../server/src/services/deliverables/bundlePptxRuntime.js';

describe('W1.5 — deckPlansToPptxBuffer renders chart when chartSpec present', () => {
  beforeEach(() => {
    mockAddChart.mockClear();
    mockAddShape.mockClear();
    mockAddText.mockClear();
    mockPptx.addSlide.mockClear();
    mockPptx.write.mockClear();
    mockPptx.write.mockResolvedValue(Buffer.from('pptx'));
    mockPptx.addSlide.mockReturnValue(mockSlide);
  });

  it('bar_series chart spec → addChart called with "bar" type', async () => {
    const plans = [{
      slideIndex: 0,
      layoutIntent: 'performance_overview',
      title: 'Przychód rośnie',
      keyMessage: 'Revenue grows 3x',
      chartSpec: {
        type: 'bar_series' as const,
        labels: ['Rok 1', 'Rok 2', 'Rok 3'],
        series: [
          { name: 'Przychód', values: [1000, 2000, 3000], color: '0C447C' },
          { name: 'EBITDA', values: [-100, 200, 600], color: '1D9E75' },
        ],
      },
    }];
    await deckPlansToPptxBuffer(plans);
    expect(mockAddChart).toHaveBeenCalledWith('bar', expect.any(Array), expect.objectContaining({ barDir: 'col' }));
    // W14.1 — altText obecny i wyprowadzony z danych (a11y)
    const chartOpts = mockAddChart.mock.calls[0][2];
    expect(typeof chartOpts.altText).toBe('string');
    expect(chartOpts.altText.length).toBeGreaterThan(0);
  });

  it('rag chart spec → addShape called with colored rect per item', async () => {
    const plans = [{
      slideIndex: 0,
      layoutIntent: 'risk_management',
      title: 'Ryzyka',
      keyMessage: 'Ryzyka zarządcze',
      chartSpec: {
        type: 'rag' as const,
        items: [
          { label: 'Ryzyko 1', value: 9, status: 'red' as const },
          { label: 'Ryzyko 2', value: 5, status: 'amber' as const },
          { label: 'Ryzyko 3', value: 2, status: 'green' as const },
        ],
      },
    }];
    await deckPlansToPptxBuffer(plans);
    // addShape called at least 3 times (one rect per item)
    const rectCalls = mockAddShape.mock.calls.filter((c) => c[0] === 'rect');
    expect(rectCalls.length).toBeGreaterThanOrEqual(3);
  });

  it('no chartSpec → addChart NOT called (falls back to text layout)', async () => {
    const plans = [{
      slideIndex: 0,
      layoutIntent: 'single_insight',
      title: 'Insight',
      keyMessage: 'Plain text slide',
    }];
    await deckPlansToPptxBuffer(plans);
    expect(mockAddChart).not.toHaveBeenCalled();
  });

  // W7.5 — marimekko + harvey balls
  it('marimekko chart spec → addShape called with rect per segment', async () => {
    const plans = [{
      slideIndex: 0,
      layoutIntent: 'comparison',
      title: 'Udział rynku wg segmentu',
      keyMessage: 'Dominujemy w SMB, gonimy Enterprise.',
      chartSpec: {
        type: 'marimekko' as const,
        columns: [
          { label: 'Enterprise', segments: [{ name: 'My', value: 30 }, { name: 'Konkurent', value: 70 }] },
          { label: 'SMB', segments: [{ name: 'My', value: 60 }, { name: 'Konkurent', value: 40 }] },
        ],
      },
    }];
    await deckPlansToPptxBuffer(plans);
    const rectCalls = mockAddShape.mock.calls.filter((c) => c[0] === 'rect');
    expect(rectCalls.length).toBeGreaterThanOrEqual(4); // 4 segmenty
  });

  it('harvey_balls chart spec → addShape called with ellipse + pie', async () => {
    const plans = [{
      slideIndex: 0,
      layoutIntent: 'assessment',
      title: 'Dojrzałość AI wg wymiaru',
      keyMessage: 'Dane wysoko, kompetencje nisko.',
      chartSpec: {
        type: 'harvey_balls' as const,
        rows: [
          { label: 'Dane', level: 3 },
          { label: 'Procesy', level: 2 },
          { label: 'Kompetencje', level: 0 },
        ],
      },
    }];
    await deckPlansToPptxBuffer(plans);
    const ellipseCalls = mockAddShape.mock.calls.filter((c) => c[0] === 'ellipse');
    const pieCalls = mockAddShape.mock.calls.filter((c) => c[0] === 'pie');
    expect(ellipseCalls.length).toBe(3); // 3 okręgi tła
    expect(pieCalls.length).toBe(2); // tylko poziomy >0 (Dane, Procesy)
  });
});
