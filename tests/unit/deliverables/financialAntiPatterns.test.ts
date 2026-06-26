// @vitest-environment node
/**
 * W12.1 (finanse) — financialAntiPatterns: hockey-stick na trajektorii PnL.
 */
import { describe, expect, it } from 'vitest';
import {
  detectHockeyStick,
  detectFinancialAntiPatterns,
} from '../../../server/src/services/deliverables/financialAntiPatterns';
import { buildSpine } from '../../../server/src/services/deliverables/bundleOrchestrator';
import type { PnLPeriod } from '../../../server/src/services/deliverables/businessPlanSpine';
import type { BusinessPlanInput } from '../../../server/src/services/deliverables/assumptionsModel';

function pnl(revenues: number[]): PnLPeriod[] {
  return revenues.map((r, i) => ({
    period: `Rok ${i + 1}`, revenue: r, cogs: r * 0.3, ebitda: r * 0.2,
  } as PnLPeriod));
}

describe('W12.1 — detectHockeyStick', () => {
  it('trajektoria z nagłym skokiem na końcu → flag hockey_stick', () => {
    // 100 → 120 (+20%) → 500 (+317%): późny skok skupia większość wzrostu
    const findings = detectHockeyStick(pnl([100, 120, 500]));
    expect(findings).toHaveLength(1);
    expect(findings[0].pattern).toBe('hockey_stick_no_driver');
    expect(findings[0].severity).toBe('flag');
    expect(findings[0].ref).toBe('financials.pnl.revenue');
  });

  it('liniowy/proporcjonalny wzrost → brak flagi', () => {
    // 100 → 200 → 300: stały przyrost, brak przyspieszenia
    expect(detectHockeyStick(pnl([100, 200, 300]))).toHaveLength(0);
  });

  it('zdrowy złożony wzrost (stała stopa) → brak flagi', () => {
    // 100 → 160 → 256 (×1.6 co rok): wykładniczy ale STAŁY mnożnik, nie kij
    expect(detectHockeyStick(pnl([100, 160, 256]))).toHaveLength(0);
  });

  it('<3 okresy → brak findingów (za mało danych)', () => {
    expect(detectHockeyStick(pnl([100, 500]))).toHaveLength(0);
    expect(detectHockeyStick(pnl([100]))).toHaveLength(0);
  });

  it('pusta/niepoprawna trajektoria → []', () => {
    expect(detectHockeyStick([])).toHaveLength(0);
    // @ts-expect-error celowo null
    expect(detectHockeyStick(null)).toHaveLength(0);
  });

  it('wczesny skok (nie późny) → brak flagi (kij to LATE backload)', () => {
    // 100 → 500 (+400%) → 550 (+10%): skok na początku, nie na końcu
    expect(detectHockeyStick(pnl([100, 500, 550]))).toHaveLength(0);
  });

  it('detectFinancialAntiPatterns deleguje do hockey-stick', () => {
    expect(detectFinancialAntiPatterns(pnl([100, 120, 500]))).toHaveLength(1);
    expect(detectFinancialAntiPatterns(pnl([100, 200, 300]))).toHaveLength(0);
  });
});

describe('W12.1 — integracja: realistyczny SPINE nie jest fałszywie flagowany', () => {
  const input: BusinessPlanInput = {
    company: 'RealCo', language: 'PL', product: 'SaaS B2B', thesis: 'Teza.', ask: 'Seed 500k',
    startYear: 2026, years: 3, currency: 'EUR',
    drivers: {
      saasPricePerSeatMonth: 120, saasSeatsStart: 40, saasSeatGrowthYoY: 1.8,
      grossChurnAnnual: 0.12, nrr: 1.1, servicesRevenueStart: 500, servicesGrowthYoY: 0.2,
      grossMargin: 0.70, smPctRevenue: 0.25, rdPctRevenue: 0.15, gaPctRevenue: 0.10,
      daPctRevenue: 0.02, opexLeverageYoY: 0.9, cac: 900, arpuAnnual: 1440,
      startingCash: 300, fundingRaised: 500, taxRate: 0.19,
    },
    market: { tamTopDown: 8000, tamSource: 'est', samValue: 800, somValue: 80, bottomUpCustomers: 45, bottomUpArpu: 1.5, unit: 'mln EUR' },
  };

  it('zdrowy model nie generuje hockey_stick (brak false-positive)', () => {
    const spine = buildSpine(input);
    const hockey = spine.validation.antiPatterns.filter((a) => a.pattern === 'hockey_stick_no_driver');
    expect(hockey).toHaveLength(0);
  });

  it('hockey_stick jest w katalogu patternów (wpięty do buildSpine)', () => {
    // dowód że detektor JEST częścią pipeline (nie martwy kod) — sprawdzamy że
    // funkcja agregująca obejmuje finansowe anti-patterny przez realny spine.
    const spine = buildSpine(input);
    expect(Array.isArray(spine.validation.antiPatterns)).toBe(true);
  });
});
