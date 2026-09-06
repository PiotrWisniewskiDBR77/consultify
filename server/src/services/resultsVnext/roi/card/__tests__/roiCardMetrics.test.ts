/**
 * ROI (P7K C) — PRZELICZENIA KARTY na przykładach WPROST Z METODYKI
 * właściciela (`docs/program/grafika/ROI_METODYKA_WLASCICIELA_20260905.md`)
 * i z danych, które seed DBR77 naprawdę zapisał do bazy.
 *
 * DLACZEGO TE, A NIE INNE LICZBY: analiza „Robotyzacja gniazda spawalniczego"
 * ma w bazie CAPEX 1 000 000 zł (909 000 + 91 000 rezerwy), roczną korzyść
 * 400 000 zł, horyzont 5 lat i zapisany przez silnik wynik NPV 516 315 zł,
 * IRR 28,7 %, Payback 2,5 roku, BCR 2,0. Ten zestaw daje się odtworzyć TYLKO
 * przy stopie 10 % — dlatego test jest jednocześnie dowodem, że polityka
 * wyliczeń tej analizy (10 %) opisuje ten sam rachunek, który zapisał przebieg.
 *
 * DOWÓD MUTACYJNY (wymagany przez paczkę P7K §16): asercje niżej są przypięte
 * do STOPY DYSKONTOWEJ. Zmiana `DISCOUNT_RATE_PCT` z 10 na 8 (albo usunięcie
 * przekazania stopy do `computeRoiIndicators`) wywraca `NPV`, `PI` i
 * `discountedPayback` — sprawdzone ręcznie: przy 8 % NPV wychodzi 597 084 zł
 * zamiast 516 315 zł, czyli test PADA. Test wprost to sprawdza (patrz
 * „dowód mutacyjny" na końcu pliku): przelicza ten sam model przy 8 % i
 * wymaga, żeby wynik BYŁ INNY niż zapisany — gdyby stopa przestała mieć
 * wpływ (np. ktoś zahardkodował ją albo zignorował), ta asercja padnie.
 */
import { describe, expect, it } from 'vitest';

import {
  buildCashFlowRows,
  computeRoiIndicators,
  computeSensitivity,
  deriveRoiCardPhase,
  horizonYears,
  periodsPerYear,
  sumOneTime,
  sumRecurringPerYear,
} from '../roiCardMetrics.js';

// Dane analizy DBR77 „Robotyzacja gniazda spawalniczego" (seed-wyniki-dbr77.ts).
const CAPEX = 1_000_000;
const ANNUAL_NET_BENEFIT = 400_000;
const HORIZON = 5;
const DISCOUNT_RATE_PCT = 10;

// Liczby ZAPISANE przez silnik w `rvn_roi_calculation_runs` dla tej analizy.
const STORED_NPV = 516_315;
const STORED_IRR_PCT = 28.65;
const STORED_PAYBACK = 2.5;
const STORED_BCR = 2;

describe('roiCardMetrics — składniki modelu', () => {
  it('nakład początkowy to suma pozycji jednorazowych (CAPEX + rezerwa)', () => {
    expect(
      sumOneTime([
        { amount: 909_000, timingType: 'one_time', recurrenceCadence: null },
        { amount: 91_000, timingType: 'one_time', recurrenceCadence: null },
        { amount: 45_000, timingType: 'recurring', recurrenceCadence: 'annual' },
      ])
    ).toBe(CAPEX);
  });

  it('brak pozycji daje null, a nie zero — „—" w UI, nie fałszywe 0 zł', () => {
    expect(sumOneTime([])).toBeNull();
    expect(sumRecurringPerYear([])).toBeNull();
  });

  it('kwota cykliczna jest annualizowana wg kadencji', () => {
    expect(periodsPerYear('monthly')).toBe(12);
    expect(periodsPerYear('quarterly')).toBe(4);
    expect(periodsPerYear('annual')).toBe(1);
    expect(periodsPerYear(null)).toBe(1);
    expect(
      sumRecurringPerYear([
        { amount: 10_000, timingType: 'recurring', recurrenceCadence: 'monthly' },
        { amount: 5_000, timingType: 'recurring', recurrenceCadence: 'quarterly' },
      ])
    ).toBe(140_000);
  });

  it('pozycja niefinansowa (Soft/Strategic) nie wchodzi do przepływów', () => {
    expect(
      sumRecurringPerYear([
        { amount: 100_000, timingType: 'recurring', recurrenceCadence: 'annual', isFinancial: true },
        { amount: null, timingType: 'recurring', recurrenceCadence: 'annual', isFinancial: false },
      ])
    ).toBe(100_000);
  });

  it('horyzont liczony z dat analizy, nie z okresu amortyzacji', () => {
    expect(horizonYears('2026-01-01', '2030-12-31')).toBe(5);
    expect(horizonYears('2026-01-01', '2028-12-31')).toBe(3);
    expect(horizonYears(null, '2030-12-31')).toBeNull();
  });
});

describe('roiCardMetrics — wskaźniki na przykładzie DBR77 (metodyka §16-25)', () => {
  const indicators = computeRoiIndicators({
    initialInvestment: CAPEX,
    annualNetBenefit: ANNUAL_NET_BENEFIT,
    horizon: HORIZON,
    discountRatePct: DISCOUNT_RATE_PCT,
  });

  it('ROI za horyzont = (suma korzyści − nakład) / nakład — 100 % dla 5 lat', () => {
    expect(indicators.roiPct).toBeCloseTo(100, 6);
  });

  it('Payback: 1 000 000 / 400 000 = 2,5 roku (przykład z metodyki §18)', () => {
    expect(indicators.paybackYears).toBeCloseTo(STORED_PAYBACK, 6);
  });

  it('NPV przy 10 % odtwarza liczbę zapisaną przez silnik (516 315 zł)', () => {
    expect(indicators.npv).toBeCloseTo(STORED_NPV, 0);
  });

  it('IRR to stopa, przy której NPV = 0 — i zgadza się z zapisanym 28,65 %', () => {
    expect(indicators.irrPct).not.toBeNull();
    expect(indicators.irrPct as number).toBeCloseTo(STORED_IRR_PCT, 1);
    // Definicja IRR sprawdzona wprost: NPV przy stopie IRR musi wynosić zero.
    const atIrr = computeRoiIndicators({
      initialInvestment: CAPEX,
      annualNetBenefit: ANNUAL_NET_BENEFIT,
      horizon: HORIZON,
      discountRatePct: indicators.irrPct as number,
    });
    expect(Math.abs(atIrr.npv as number)).toBeLessThan(1);
  });

  it('PI = PV(przyszłych przepływów) / nakład, powyżej 1 dla opłacalnej inwestycji', () => {
    expect(indicators.profitabilityIndex).toBeCloseTo(1.5163, 3);
    expect(indicators.profitabilityIndex as number).toBeGreaterThan(1);
  });

  it('BCR (nominalne korzyści / nakład) = 2,0 — jak zapisał przebieg', () => {
    expect(indicators.benefitCostRatio).toBeCloseTo(STORED_BCR, 6);
  });

  it('Discounted Payback jest DŁUŻSZY niż zwykły — dyskontowanie spowalnia zwrot', () => {
    expect(indicators.discountedPaybackYears as number).toBeGreaterThan(
      indicators.paybackYears as number
    );
  });

  it('bez stopy dyskontowej wskaźniki dyskontowe są null („—"), a nie zerowe', () => {
    const bez = computeRoiIndicators({
      initialInvestment: CAPEX,
      annualNetBenefit: ANNUAL_NET_BENEFIT,
      horizon: HORIZON,
      discountRatePct: null,
    });
    expect(bez.npv).toBeNull();
    expect(bez.profitabilityIndex).toBeNull();
    expect(bez.discountedPaybackYears).toBeNull();
    // ROI i Payback nie potrzebują stopy — zostają policzone.
    expect(bez.roiPct).toBeCloseTo(100, 6);
    expect(bez.paybackYears).toBeCloseTo(2.5, 6);
  });

  it('brak składnika = null w KAŻDYM wskaźniku, nigdy zero', () => {
    const pusty = computeRoiIndicators({
      initialInvestment: null,
      annualNetBenefit: null,
      horizon: null,
      discountRatePct: 10,
    });
    expect(pusty.roiPct).toBeNull();
    expect(pusty.npv).toBeNull();
    expect(pusty.irrPct).toBeNull();
    expect(pusty.paybackYears).toBeNull();
    expect(pusty.benefitCostRatio).toBeNull();
  });
});

describe('roiCardMetrics — przepływy rok 0–n (metodyka §15)', () => {
  const rows = buildCashFlowRows({
    analysisStart: '2026-01-01',
    horizon: HORIZON,
    initialInvestment: CAPEX,
    annualCosts: null,
    annualBenefits: ANNUAL_NET_BENEFIT,
    discountRatePct: DISCOUNT_RATE_PCT,
  });

  it('rok 0 niesie wyłącznie nakład, lata 1..n korzyść netto', () => {
    expect(rows).toHaveLength(HORIZON + 1);
    expect(rows[0]).toMatchObject({ year: 0, label: '2026', costs: CAPEX, benefits: 0, net: -CAPEX });
    expect(rows[1]).toMatchObject({ year: 1, label: '2027', net: ANNUAL_NET_BENEFIT });
    expect(rows[HORIZON]!.label).toBe('2031');
  });

  it('narastająco przechodzi przez zero między rokiem 2 a 3 — zgodnie z Payback 2,5', () => {
    expect(rows[2]!.cumulative).toBe(-200_000);
    expect(rows[3]!.cumulative).toBe(200_000);
  });

  it('suma zdyskontowanych przepływów minus nakład = NPV z kafla', () => {
    const last = rows[HORIZON]!;
    expect(last.cumulativeDiscounted as number).toBeCloseTo(STORED_NPV, 0);
  });

  it('bez stopy kolumny dyskontowe są null, a nie zerowe', () => {
    const bez = buildCashFlowRows({
      analysisStart: '2026-01-01',
      horizon: 3,
      initialInvestment: 620_000,
      annualCosts: null,
      annualBenefits: 238_000,
      discountRatePct: null,
    });
    expect(bez.every((r) => r.discounted === null && r.cumulativeDiscounted === null)).toBe(true);
  });
});

describe('roiCardMetrics — wrażliwość ±20 % (metodyka §28)', () => {
  const rows = computeSensitivity({
    initialInvestment: CAPEX,
    annualBenefits: ANNUAL_NET_BENEFIT,
    annualCosts: null,
    horizon: HORIZON,
    discountRatePct: DISCOUNT_RATE_PCT,
  });

  it('wychyla CAPEX, roczną korzyść i stopę — OPEX pomija, gdy go nie ma', () => {
    expect(rows.map((r) => r.driverId)).toEqual(['capex', 'annual_benefit', 'discount_rate']);
  });

  it('CAPEX −20 % podnosi NPV, +20 % je obniża', () => {
    const capex = rows.find((r) => r.driverId === 'capex')!;
    expect(capex.minusNpv as number).toBeGreaterThan(STORED_NPV);
    expect(capex.plusNpv as number).toBeLessThan(STORED_NPV);
  });

  it('roczna korzyść jest silniejszym value driverem niż stopa dyskontowa', () => {
    const benefit = rows.find((r) => r.driverId === 'annual_benefit')!;
    const rate = rows.find((r) => r.driverId === 'discount_rate')!;
    const swing = (r: typeof benefit) => Math.abs((r.plusNpv as number) - (r.minusNpv as number));
    expect(swing(benefit)).toBeGreaterThan(swing(rate));
  });
});

describe('roiCardMetrics — faza karty (SSOT §4)', () => {
  it('najdalsza WYPEŁNIONA część wygrywa', () => {
    expect(deriveRoiCardPhase({ hasCompletedRun: false, hasRealizationData: false })).toBe('assumptions');
    expect(deriveRoiCardPhase({ hasCompletedRun: true, hasRealizationData: false })).toBe('calculations');
    expect(deriveRoiCardPhase({ hasCompletedRun: true, hasRealizationData: true })).toBe('realization');
    // Dane realizacji bez przebiegu też są „najdalszą wypełnioną" częścią.
    expect(deriveRoiCardPhase({ hasCompletedRun: false, hasRealizationData: true })).toBe('realization');
  });
});

describe('DOWÓD MUTACYJNY — stopa dyskontowa naprawdę wpływa na wynik', () => {
  /**
   * Gdyby ktoś zahardkodował stopę, zignorował parametr albo policzył NPV
   * bez dyskontowania, poniższe asercje przestaną być prawdziwe — a to jest
   * dokładnie ta klasa błędu, przez którą wiersz polityki w seedzie mówił
   * 8 %, a zapisany wynik był policzony przy 10 %.
   */
  it('przy 8 % zamiast 10 % NPV, PI i DPP są INNE niż zapisane przez silnik', () => {
    const przy8 = computeRoiIndicators({
      initialInvestment: CAPEX,
      annualNetBenefit: ANNUAL_NET_BENEFIT,
      horizon: HORIZON,
      discountRatePct: 8,
    });
    expect(przy8.npv as number).not.toBeCloseTo(STORED_NPV, 0);
    expect(przy8.npv as number).toBeCloseTo(597_084, 0);
    expect(przy8.profitabilityIndex as number).not.toBeCloseTo(1.5163, 3);
  });

  it('ROI i Payback są NIEZALEŻNE od stopy — mutacja stopy ich nie rusza', () => {
    const przy8 = computeRoiIndicators({
      initialInvestment: CAPEX,
      annualNetBenefit: ANNUAL_NET_BENEFIT,
      horizon: HORIZON,
      discountRatePct: 8,
    });
    expect(przy8.roiPct).toBeCloseTo(100, 6);
    expect(przy8.paybackYears).toBeCloseTo(2.5, 6);
  });
});
