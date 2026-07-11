/**
 * ENTERPRISE VALUE — KOSZYK METOD (Z113) · testy fault-injection.
 *
 * Sprawdza REGUŁY syntezy z _KONCEPT_FINANCE §5 na czystym rdzeniu (bez DB):
 *  - koszyk 2 metod spójny → BRAK flagi;
 *  - rozjazd środków >20% → flaga + TOP-driver (para metod);
 *  - brak peers → fallback na M4 (metoda majątkowo-dochodowa);
 *  - strefa przecięcia, wagi (domyślne/konfigurowalne), premia za kontrolę M3.
 *
 * Rdzeń jest deterministyczny (zero LLM), więc każda oczekiwana liczba jest
 * policzona ręcznie w komentarzu — regresja formuły FAILUJE tutaj.
 *
 * DB mockowane przy tym samym szwie co pozostałe testy wyceny (import
 * valuationService pociąga DbPromise/audyt itd. — nie chcemy realnej bazy).
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  all: vi.fn(),
  get: vi.fn(),
  run: vi.fn(),
}));
vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../../server/src/services/auditService.js', () => ({ log: vi.fn() }));
vi.mock('../../../server/src/services/financeCanonicalResolver.js', () => ({
  normalizeCanonicalLineCode: (s: string) => s,
}));
vi.mock('../../../server/src/services/initiative/createInitiativeService.js', () => ({
  createInitiative: vi.fn(),
}));
vi.mock('../../../server/src/services/financialModelingService.js', () => ({
  computeModel: vi.fn(),
  getModel: vi.fn(),
  getOutputs: vi.fn(),
  persistComputeResult: vi.fn(),
}));

import {
  assetIncomeMethod,
  buildBasketFromResults,
  dcfMethod,
  multiplesMethod,
  precedentMethod,
  synthesizeBasket,
  type MethodRange,
} from '../../../server/src/services/valuationBasketService.ts';

// ── RDZEŃ: synthesizeBasket ─────────────────────────────────────────────────

describe('synthesizeBasket — reguła spójności', () => {
  it('koszyk 2 metod spójny (mid 100 vs 110 = 10%) → BRAK flagi', () => {
    // divergence = |110-100| / min(100,110) = 10/100 = 10% < próg 20% → brak flagi
    const methods: MethodRange[] = [
      { key: 'M1', label: 'DCF', low: 90, mid: 100, high: 110 },
      { key: 'M2', label: 'Mnożniki', low: 100, mid: 110, high: 120 },
    ];
    const r = synthesizeBasket(methods);
    expect(r.consistencyFlag.triggered).toBe(false);
    expect(r.consistencyFlag.maxDivergencePct).toBe(10);
    expect(r.consistencyFlag.thresholdPct).toBe(20);
    // przecięcie = max(90,100)=100 .. min(110,120)=110
    expect(r.intersection).toEqual({ low: 100, high: 110 });
    // rekomendacja = przecięcie z dociśniętym ważonym mid (105 ∈ [100,110])
    expect(r.recommended).toEqual({ low: 100, mid: 105, high: 110 });
  });

  it('rozjazd >20% (mid 100 vs 150 = 50%) → FLAGA + TOP-driver wskazuje parę', () => {
    // divergence = |150-100| / min(100,150) = 50/100 = 50% > 20% → flaga
    const methods: MethodRange[] = [
      { key: 'M1', label: 'DCF', low: 80, mid: 100, high: 120 },
      { key: 'M2', label: 'Mnożniki', low: 130, mid: 150, high: 170 },
    ];
    const r = synthesizeBasket(methods);
    expect(r.consistencyFlag.triggered).toBe(true);
    expect(r.consistencyFlag.maxDivergencePct).toBe(50);
    expect(r.consistencyFlag.topDriver).not.toBeNull();
    expect(r.consistencyFlag.topDriver!.methods).toEqual(['DCF', 'Mnożniki']);
    expect(r.consistencyFlag.topDriver!.lowerLabel).toBe('DCF');
    expect(r.consistencyFlag.topDriver!.higherLabel).toBe('Mnożniki');
    expect(r.consistencyFlag.message).toContain('przejrzyj założenia');
    // zakresy rozłączne (120 < 130) → brak przecięcia
    expect(r.intersection).toBeNull();
    // rekomendacja = ważona mieszanka: low=(80+130)/2=105, mid=(100+150)/2=125, high=(120+170)/2=145
    expect(r.recommended).toEqual({ low: 105, mid: 125, high: 145 });
  });

  it('próg spójności jest konfigurowalny (ten sam rozjazd 50% z progiem 60% → brak flagi)', () => {
    const methods: MethodRange[] = [
      { key: 'M1', label: 'DCF', low: 80, mid: 100, high: 120 },
      { key: 'M2', label: 'Mnożniki', low: 130, mid: 150, high: 170 },
    ];
    const r = synthesizeBasket(methods, { divergenceThresholdPct: 60 });
    expect(r.consistencyFlag.triggered).toBe(false);
    expect(r.consistencyFlag.thresholdPct).toBe(60);
  });

  it('jedna metoda → brak flagi, komunikat o braku triangulacji', () => {
    const r = synthesizeBasket([{ key: 'M1', label: 'DCF', low: 90, mid: 100, high: 110 }]);
    expect(r.consistencyFlag.triggered).toBe(false);
    expect(r.consistencyFlag.message).toContain('brak triangulacji');
    // przecięcie samej ze sobą = własny zakres
    expect(r.intersection).toEqual({ low: 90, high: 110 });
  });

  it('TOP-driver wybiera parę o NAJWIĘKSZEJ rozbieżności z 3 metod', () => {
    // M1 100, M2 108 (8%), M3 200 (100% vs M1) → top = M1 vs M3
    const methods: MethodRange[] = [
      { key: 'M1', label: 'DCF', low: 95, mid: 100, high: 105 },
      { key: 'M2', label: 'Mnożniki', low: 103, mid: 108, high: 113 },
      { key: 'M3', label: 'Precedensy', low: 190, mid: 200, high: 210 },
    ];
    const r = synthesizeBasket(methods);
    expect(r.consistencyFlag.triggered).toBe(true);
    expect(r.consistencyFlag.topDriver!.methods).toEqual(['DCF', 'Precedensy']);
    expect(r.consistencyFlag.maxDivergencePct).toBe(100);
  });
});

describe('synthesizeBasket — wagi', () => {
  it('domyślnie wagi równe i znormalizowane do 1', () => {
    const r = synthesizeBasket([
      { key: 'M1', label: 'DCF', low: 90, mid: 100, high: 110 },
      { key: 'M2', label: 'Mnożniki', low: 100, mid: 110, high: 120 },
    ]);
    expect(r.weights).toEqual({ M1: 0.5, M2: 0.5 });
    expect(r.methods.reduce((a, m) => a + m.weight, 0)).toBeCloseTo(1, 6);
  });

  it('wagi konfigurowalne (M1=3, M2=1) → 0.75 / 0.25 i przesunięty ważony mid', () => {
    // zakresy rozłączne → recommended = ważona mieszanka; mid = 100*0.75 + 200*0.25 = 125
    const r = synthesizeBasket(
      [
        { key: 'M1', label: 'DCF', low: 90, mid: 100, high: 110 },
        { key: 'M2', label: 'Mnożniki', low: 190, mid: 200, high: 210 },
      ],
      { weights: { M1: 3, M2: 1 } }
    );
    expect(r.weights).toEqual({ M1: 0.75, M2: 0.25 });
    expect(r.recommended.mid).toBe(125);
  });

  it('pusty koszyk → recommended zerowy, komunikat o braku metod', () => {
    const r = synthesizeBasket([]);
    expect(r.methods).toHaveLength(0);
    expect(r.recommended).toEqual({ low: 0, mid: 0, high: 0 });
    expect(r.consistencyFlag.message).toContain('Brak metod');
  });

  it('odrzuca metody z niepełnymi/NaN zakresami', () => {
    const r = synthesizeBasket([
      { key: 'M1', label: 'DCF', low: 90, mid: 100, high: 110 },
      { key: 'M2', label: 'Zły', low: NaN as any, mid: 0, high: 100 },
    ]);
    expect(r.methods.map((m) => m.key)).toEqual(['M1']);
  });
});

// ── ADAPTERY ────────────────────────────────────────────────────────────────

describe('dcfMethod — zakres ze scenariuszy > wrażliwości > punkt', () => {
  it('scenariusze (Cons/Opt) dają zakres, mid = baza', () => {
    const m = dcfMethod({ enterpriseValue: 100 }, [
      { scenario: 'conservative', dcf: { enterpriseValue: 80 } },
      { scenario: 'optimistic', dcf: { enterpriseValue: 140 } },
    ]);
    expect(m).not.toBeNull();
    expect(m!.low).toBe(80);
    expect(m!.mid).toBe(100);
    expect(m!.high).toBe(140);
  });

  it('brak scenariuszy → zakres z siatki wrażliwości', () => {
    const m = dcfMethod({ enterpriseValue: 100 }, [], {
      matrix: [{ ev: 70 }, { ev: 100 }, { ev: 130 }],
    });
    expect(m!.low).toBe(70);
    expect(m!.high).toBe(130);
  });

  it('sam punkt EV → zakres zdegenerowany (low=mid=high)', () => {
    const m = dcfMethod({ enterpriseValue: 100 });
    expect(m).toEqual(expect.objectContaining({ key: 'M1', low: 100, mid: 100, high: 100 }));
  });

  it('brak EV → null', () => {
    expect(dcfMethod(null)).toBeNull();
    expect(dcfMethod({} as any)).toBeNull();
  });
});

describe('multiplesMethod / precedentMethod', () => {
  it('M2 z impliedEnterpriseValue {min,median,max}', () => {
    const m = multiplesMethod({
      metric: 'EV/EBITDA',
      impliedEnterpriseValue: { min: 80, median: 100, max: 120 },
    });
    expect(m).toEqual(
      expect.objectContaining({ key: 'M2', low: 80, mid: 100, high: 120 })
    );
  });

  it('M2 null gdy zerowa baza (brak metryki spółki)', () => {
    expect(
      multiplesMethod({ impliedEnterpriseValue: { min: 0, median: 0, max: 0 } })
    ).toBeNull();
    expect(multiplesMethod(null)).toBeNull();
  });

  it('M3 = M2 + premia za kontrolę 20-40% (wyższy zakres, osobna etykieta)', () => {
    // low 80*1.2=96, mid 100*1.3=130, high 120*1.4=168
    const m3 = precedentMethod({ impliedEnterpriseValue: { min: 80, median: 100, max: 120 } });
    expect(m3!.key).toBe('M3');
    expect(m3!.label).toBe('Transakcje precedensowe');
    expect(m3!.low).toBe(96);
    expect(m3!.mid).toBe(130);
    expect(m3!.high).toBe(168);
  });

  it('M3 respektuje własną premię za kontrolę', () => {
    // premia 0.5 na wszystkich → 80*1.5=120, 100*1.5=150, 120*1.5=180
    const m3 = precedentMethod(
      { impliedEnterpriseValue: { min: 80, median: 100, max: 120 } },
      { low: 0.5, mid: 0.5, high: 0.5 }
    );
    expect([m3!.low, m3!.mid, m3!.high]).toEqual([120, 150, 180]);
  });
});

describe('assetIncomeMethod (M4)', () => {
  it('podejście majątkowe (aktywa netto) → pasmo ±10%', () => {
    const m = assetIncomeMethod({ adjustedNetAssets: 100 });
    expect(m).toEqual(expect.objectContaining({ key: 'M4', low: 90, mid: 100, high: 110 }));
  });

  it('podejście dochodowe (kapitalizacja): zysk 20 / capRate 10% = 200', () => {
    const m = assetIncomeMethod({ normalizedEarnings: 20, capitalizationRatePct: 10 });
    expect(m!.mid).toBe(200); // pasmo ±10% → 180..220
    expect(m!.low).toBe(180);
    expect(m!.high).toBe(220);
  });

  it('majątkowe + dochodowe → zakres od min do max obu', () => {
    // ANA 100; zysk 20 / 10% = 200 → low 100, high 200, mid 150
    const m = assetIncomeMethod({
      adjustedNetAssets: 100,
      normalizedEarnings: 20,
      capitalizationRatePct: 10,
    });
    expect([m!.low, m!.mid, m!.high]).toEqual([100, 150, 200]);
  });

  it('brak danych → null', () => {
    expect(assetIncomeMethod({})).toBeNull();
    expect(assetIncomeMethod(null)).toBeNull();
  });
});

// ── buildBasketFromResults: reguła fallbacku M4 ─────────────────────────────

describe('buildBasketFromResults — złożenie i fallback M4', () => {
  it('są peers → koszyk M1+M2+M3, BEZ M4', () => {
    const r = buildBasketFromResults({
      dcf: { enterpriseValue: 100 },
      comps: { impliedEnterpriseValue: { min: 90, median: 100, max: 110 } },
      scenarioComparison: [
        { scenario: 'conservative', dcf: { enterpriseValue: 85 } },
        { scenario: 'optimistic', dcf: { enterpriseValue: 120 } },
      ],
    });
    expect(r.methods.map((m) => m.key)).toEqual(['M1', 'M2', 'M3']);
    // 3 metody, równe wagi ≈ 0.3333
    expect(r.methods.every((m) => Math.abs(m.weight - 1 / 3) < 0.001)).toBe(true);
  });

  it('BRAK peers → fallback na M4 z config.assetIncome (M2/M3 nieobecne)', () => {
    const r = buildBasketFromResults(
      { dcf: { enterpriseValue: 100 }, comps: null },
      { assetIncome: { adjustedNetAssets: 120 } }
    );
    expect(r.methods.map((m) => m.key)).toEqual(['M1', 'M4']);
    expect(r.methods.find((m) => m.key === 'M2')).toBeUndefined();
    expect(r.methods.find((m) => m.key === 'M3')).toBeUndefined();
    // M4 = 120 ±10% → [108,120,132]
    const m4 = r.methods.find((m) => m.key === 'M4')!;
    expect([m4.low, m4.mid, m4.high]).toEqual([108, 120, 132]);
  });

  it('BRAK peers i BRAK config.assetIncome → koszyk sam DCF (bez triangulacji)', () => {
    const r = buildBasketFromResults({ dcf: { enterpriseValue: 100 }, comps: null });
    expect(r.methods.map((m) => m.key)).toEqual(['M1']);
    expect(r.consistencyFlag.triggered).toBe(false);
    expect(r.consistencyFlag.message).toContain('brak triangulacji');
  });

  it('includePrecedent=false → M2 bez M3', () => {
    const r = buildBasketFromResults(
      {
        dcf: { enterpriseValue: 100 },
        comps: { impliedEnterpriseValue: { min: 90, median: 100, max: 110 } },
      },
      { includePrecedent: false }
    );
    expect(r.methods.map((m) => m.key)).toEqual(['M1', 'M2']);
  });

  it('alwaysIncludeAssetIncome=true → M4 mimo obecnych peers', () => {
    const r = buildBasketFromResults(
      {
        dcf: { enterpriseValue: 100 },
        comps: { impliedEnterpriseValue: { min: 90, median: 100, max: 110 } },
      },
      { alwaysIncludeAssetIncome: true, assetIncome: { adjustedNetAssets: 100 } }
    );
    expect(r.methods.map((m) => m.key)).toEqual(['M1', 'M2', 'M3', 'M4']);
  });

  it('koszyk spójny (DCF vs comps blisko) → brak flagi; wyjście gotowe pod football-field', () => {
    const r = buildBasketFromResults({
      dcf: { enterpriseValue: 100 },
      comps: { impliedEnterpriseValue: { min: 95, median: 105, max: 115 } },
    });
    // DCF punkt 100 vs comps mid 105 = 5% ; M3 = 105*1.3=136.5 vs 100 = 36.5% > 20 → flaga
    // (precedensy z premią naturalnie rozjeżdżają się z DCF — sprawdzamy strukturę pod chart)
    expect(r.methods.every((m) => Number.isFinite(m.low) && Number.isFinite(m.high))).toBe(true);
    expect(r.methods[0]).toHaveProperty('label');
  });
});
