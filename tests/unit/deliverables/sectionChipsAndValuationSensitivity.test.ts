// @vitest-environment node
/**
 * W2.3 — section chips w PPTX: `addSectionChip` wywołane per slajd z rozpoznanym layoutIntent.
 * W12.2 — valuation sensitivity matrix: 3 drivery × 3 scenariusze, deterministyczne, fail-soft.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// ─── W12.2: ValuationSensitivity ────────────────────────────────────────────

import { computeFinancialModel } from '../../../server/src/services/deliverables/financialEngine.js';
import type { FinancialDrivers } from '../../../server/src/services/deliverables/financialEngine.js';

const BASE_DRIVERS: FinancialDrivers = {
  currency: 'EUR',
  years: 3,
  startYearLabel: (i) => `Rok ${i + 1}`,
  saasPricePerSeatMonth: 120,
  saasSeatsStart: 50,
  saasSeatGrowthYoY: 2.0,
  grossChurnAnnual: 0.15,
  nrr: 1.10,
  servicesRevenueStart: 500,
  servicesGrowthYoY: 0.20,
  grossMargin: 0.72,
  smPctRevenue: 0.22,
  rdPctRevenue: 0.14,
  gaPctRevenue: 0.09,
  daPctRevenue: 0.02,
  opexLeverageYoY: 0.90,
  cac: 1000,
  arpuAnnual: 1440,
  startingCash: 400,
  fundingRaised: 500,
  taxRate: 0.19,
};

describe('W12.2 — valuationSensitivity w FinancialModel', () => {
  let model: ReturnType<typeof computeFinancialModel>;
  beforeEach(() => { model = computeFinancialModel(BASE_DRIVERS); });

  it('computeFinancialModel zwraca valuationSensitivity (nie undefined)', () => {
    expect(model.valuationSensitivity).toBeDefined();
    expect(Array.isArray(model.valuationSensitivity)).toBe(true);
  });

  it('zawiera ≥3 drivery (saasSeatGrowthYoY, nrr, grossMargin)', () => {
    const rows = model.valuationSensitivity!;
    expect(rows.length).toBeGreaterThanOrEqual(3);
    const keys = rows.map((r) => r.driverKey);
    expect(keys).toContain('saasSeatGrowthYoY');
    expect(keys).toContain('nrr');
    expect(keys).toContain('grossMargin');
  });

  it('każdy rząd ma 3 ValuationRange (pessimistic/base/optimistic)', () => {
    for (const row of model.valuationSensitivity!) {
      expect(row.pessimistic).toBeDefined();
      expect(row.base).toBeDefined();
      expect(row.optimistic).toBeDefined();
      expect(typeof row.pessimistic.low).toBe('number');
      expect(typeof row.base.low).toBe('number');
      expect(typeof row.optimistic.low).toBe('number');
    }
  });

  it('optimistic.high > pessimistic.high dla growth driver (pozytywna korelacja)', () => {
    const growthRow = model.valuationSensitivity!.find((r) => r.driverKey === 'saasSeatGrowthYoY')!;
    expect(growthRow.optimistic.high).toBeGreaterThan(growthRow.pessimistic.high);
  });

  it('base ValuationRange zgadza się z model.valuation', () => {
    const row = model.valuationSensitivity![0];
    // base to buildValuation z tymi samymi driverami → identyczne jak model.valuation
    expect(row.base.dcf).toBeCloseTo(model.valuation.dcf, 0);
    expect(row.base.comparablesMultiple).toBeCloseTo(model.valuation.comparablesMultiple, 0);
  });

  it('fail-soft: nawet przy granicznych driverach nie rzuca', () => {
    expect(() => computeFinancialModel({
      ...BASE_DRIVERS,
      nrr: 0.5,   // skrajnie niski NRR
      grossMargin: 0.10,
    })).not.toThrow();
  });
});

// ─── W2.3: section chips w PPTX ─────────────────────────────────────────────

const mockAddShape = vi.fn().mockReturnValue(undefined);
const mockAddText = vi.fn().mockReturnValue(undefined);
const mockAddChart = vi.fn().mockReturnValue(undefined);
const mockSlide = {
  background: {},
  addText: mockAddText,
  addShape: mockAddShape,
  addChart: mockAddChart,
};
const mockPptx: any = {
  layout: '',
  author: '',
  company: '',
  title: '',
  addSlide: vi.fn(() => mockSlide),
  ShapeType: { rect: 'rect' },
  write: vi.fn().mockResolvedValue(Buffer.from('pptx')),
};

vi.mock('node:module', () => ({
  createRequire: () => (_module: string) => function() { return mockPptx; },
}));

import { deckPlansToPptxBuffer } from '../../../server/src/services/deliverables/bundlePptxRuntime.js';

describe('W2.3 — section chips renderowane w PPTX', () => {
  beforeEach(() => {
    mockAddShape.mockClear();
    mockAddText.mockClear();
    mockPptx.addSlide.mockClear();
    mockPptx.addSlide.mockReturnValue(mockSlide);
    mockPptx.write.mockResolvedValue(Buffer.from('pptx'));
  });

  it('slajd executive_summary → addShape + addText z etykietą EXEC SUMMARY', async () => {
    await deckPlansToPptxBuffer([{
      slideIndex: 0,
      layoutIntent: 'executive_summary',
      title: 'Nasza teza',
      keyMessage: 'Revenue 3×',
    }]);
    // addShape wywoływane co najmniej 2× (pasek akcentowy + chip)
    const shapeCalls = mockAddShape.mock.calls;
    expect(shapeCalls.length).toBeGreaterThanOrEqual(2);
    // addText dla chipu powinno zawierać 'EXEC SUMMARY'
    const textCalls = mockAddText.mock.calls.map((c) => c[0]);
    expect(textCalls.some((t: string) => typeof t === 'string' && t.includes('EXEC SUMMARY'))).toBe(true);
  });

  it('slajd risk_management → chip RYZYKO / RISK', async () => {
    await deckPlansToPptxBuffer([{
      slideIndex: 0,
      layoutIntent: 'risk_management',
      title: 'Ryzyka',
      keyMessage: 'Mamy plan',
    }], { language: 'en' });
    const textCalls = mockAddText.mock.calls.map((c) => c[0]);
    expect(textCalls.some((t: string) => typeof t === 'string' && t.includes('RISK'))).toBe(true);
  });

  it('slajd bez pasującego layoutIntent → brak chipa (nie crashuje)', async () => {
    await deckPlansToPptxBuffer([{
      slideIndex: 0,
      layoutIntent: 'unknown_intent_xyz',
      title: 'Slajd',
      keyMessage: 'Treść',
    }]);
    // Brak chipa = żadna etykieta sekcji (EXEC SUMMARY / RISK / …) nie trafia do addText.
    // Uwaga: DeckStyler (Fala 6) dodaje gwarantowaną warstwę wizualną (siatka/chrome),
    // więc liczba kształtów > 1 — kontraktem jest BRAK CHIPA, nie dokładna liczba shape'ów.
    const CHIP_LABELS = [
      'EXEC SUMMARY', 'PROBLEM', 'ROZWIĄZANIE', 'SOLUTION', 'FINANSE', 'FINANCIALS',
      'KPI', 'KPIs', 'RYNEK', 'MARKET', 'GTM', 'ASK', 'UNIT ECONOMICS',
      'ROADMAPA', 'ROADMAP', 'RYZYKO', 'RISK',
    ];
    const textCalls = mockAddText.mock.calls.map((c) => c[0]);
    const chipRendered = textCalls.some(
      (t: unknown) => typeof t === 'string' && CHIP_LABELS.some((lbl) => t.includes(lbl)),
    );
    expect(chipRendered).toBe(false);
  });

  it('slajd recommendation_single → chip ASK', async () => {
    await deckPlansToPptxBuffer([{
      slideIndex: 0,
      layoutIntent: 'recommendation_single',
      title: 'Zbieramy 500k EUR',
      keyMessage: '500k EUR seed',
    }], { language: 'pl' });
    const textCalls = mockAddText.mock.calls.map((c) => c[0]);
    expect(textCalls.some((t: string) => typeof t === 'string' && t === 'ASK')).toBe(true);
  });
});
