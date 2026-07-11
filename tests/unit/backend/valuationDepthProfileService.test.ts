/**
 * EV — GŁĘBOKOŚĆ WYCENY (F-4, D-2) · testy przełącznika managerial↔banking.
 *
 * Sprawdza REGUŁY warstwy konfiguracji NAD valuationService/valuationBasketService
 * (SSOT _KONCEPT_FINANCE_2026-07-10.md §5, decyzja D-2):
 *  - managerial: uproszczony WACC (beta=1, ERP=7%), JEDNA metoda dominująca
 *    (M1 DCF > M4 majątkowo-dochodowa > M2 mnożniki), M3 nigdy nie wchodzi;
 *  - banking: DOKŁADNIE `buildBasketFromResults` bez modyfikacji (pełny koszyk
 *    M1-M4, peers, premie) — przełącznik na banking NIE zmienia istniejącego
 *    silnika koszyka;
 *  - przełącznik nie psuje istniejącej ścieżki: `buildBasketFromResults` wołane
 *    bezpośrednio (bez depth) daje identyczny wynik jak dziś, niezależnie od
 *    istnienia tej warstwy.
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

import { get as dbGet, run as dbRun } from '../../../server/src/utils/DbPromise.ts';
import { buildBasketFromResults } from '../../../server/src/services/valuationBasketService.ts';
import { computeWaccFromBreakdown } from '../../../server/src/services/valuationService.ts';
import {
  buildBasketForDepth,
  DEFAULT_VALUATION_DEPTH,
  depthNarrative,
  getAssumptionsPatchForDepth,
  getValuationDepth,
  getWaccBreakdownForDepth,
  isValidDepth,
  MANAGERIAL_WACC_BREAKDOWN,
  normalizeDepth,
  pickDominantMethod,
  reduceToDominantMethod,
  resolveStoredDepth,
  setValuationDepth,
} from '../../../server/src/services/valuationDepthProfileService.ts';

// ── normalizeDepth / isValidDepth / resolveStoredDepth ──────────────────────

describe('normalizeDepth', () => {
  it('domyślna głębokość (D-2) = managerial', () => {
    expect(DEFAULT_VALUATION_DEPTH).toBe('managerial');
    expect(normalizeDepth(undefined)).toBe('managerial');
  });

  it('rozpoznaje banking (case-insensitive, trim)', () => {
    expect(normalizeDepth('banking')).toBe('banking');
    expect(normalizeDepth('  BANKING  ')).toBe('banking');
  });

  it('nierozpoznana wartość → fallback (domyślnie managerial, konfigurowalny)', () => {
    expect(normalizeDepth('nonsense')).toBe('managerial');
    expect(normalizeDepth('nonsense', 'banking')).toBe('banking');
  });
});

describe('isValidDepth / resolveStoredDepth', () => {
  it('isValidDepth akceptuje tylko managerial/banking', () => {
    expect(isValidDepth('managerial')).toBe(true);
    expect(isValidDepth('banking')).toBe(true);
    expect(isValidDepth('other')).toBe(false);
    expect(isValidDepth(undefined)).toBe(false);
  });

  it('resolveStoredDepth: brak/niepoprawna wartość → null (NIE managerial!)', () => {
    // Kluczowe dla wstecznej zgodności — brak zapisanej depth NIE ma domyślnie
    // stawać się "managerial", bo to zmieniłoby zachowanie istniejących wycen.
    expect(resolveStoredDepth({})).toBeNull();
    expect(resolveStoredDepth({ depth: 'bogus' })).toBeNull();
    expect(resolveStoredDepth(null)).toBeNull();
  });

  it('resolveStoredDepth: poprawna wartość → zwrócona wprost', () => {
    expect(resolveStoredDepth({ depth: 'managerial' })).toBe('managerial');
    expect(resolveStoredDepth({ depth: 'banking' })).toBe('banking');
  });
});

// ── WACC presety ──────────────────────────────────────────────────────────

describe('WACC presety per depth', () => {
  it('managerial: beta=1, ERP=7% (wyższe niż bankowy default 5% — premia SME)', () => {
    expect(MANAGERIAL_WACC_BREAKDOWN.beta).toBe(1);
    expect(MANAGERIAL_WACC_BREAKDOWN.equityRiskPremium).toBe(7);
    expect(getWaccBreakdownForDepth('managerial')).toEqual(MANAGERIAL_WACC_BREAKDOWN);
  });

  it('banking: REUSE istniejącego pełnego CAPM defaultu z valuationService (nie duplikat)', () => {
    // valuationService.defaultAssumptions().waccBreakdown = rf4/erp5/beta1.2/kd8/tax19/30-70
    const banking = getWaccBreakdownForDepth('banking');
    expect(banking).toEqual({
      riskFreeRate: 4,
      equityRiskPremium: 5,
      beta: 1.2,
      costOfDebt: 8,
      taxRate: 19,
      debtWeight: 30,
      equityWeight: 70,
    });
  });

  it('getAssumptionsPatchForDepth(managerial) — uproszczony WACC policzony z tego samego wzoru co silnik', () => {
    const patch = getAssumptionsPatchForDepth('managerial');
    expect(patch.depth).toBe('managerial');
    expect(patch.waccBreakdown).toEqual(MANAGERIAL_WACC_BREAKDOWN);
    // ke = 4 + 1*7 = 11; kd_after_tax = 8*(1-0.19) = 6.48; wacc = 0.7*11 + 0.3*6.48 = 9.644 → 9.64
    expect(patch.waccPercent).toBeCloseTo(computeWaccFromBreakdown(MANAGERIAL_WACC_BREAKDOWN), 6);
    expect(patch.waccPercent).toBe(9.64);
  });

  it('getAssumptionsPatchForDepth(banking) — TYLKO znacznik depth; WACC istniejącej wyceny nietknięty', () => {
    const patch = getAssumptionsPatchForDepth('banking');
    expect(patch).toEqual({ depth: 'banking' });
    expect(Object.keys(patch)).toEqual(['depth']);
  });

  it('getAssumptionsPatchForDepth(managerial, {orgWacc}) — orgWacc nadpisuje policzony WACC', () => {
    const patch = getAssumptionsPatchForDepth('managerial', { orgWacc: 15 });
    expect(patch.waccPercent).toBe(15);
    expect(patch.waccBreakdown).toEqual(MANAGERIAL_WACC_BREAKDOWN);
  });
});

// ── Metoda dominująca (managerial) ──────────────────────────────────────────

describe('pickDominantMethod — priorytet M1 > M4 > M2, M3 nigdy dominująca', () => {
  it('M1 wygrywa gdy obecna', () => {
    const m = pickDominantMethod([
      { key: 'M2', label: 'Mnożniki', low: 1, mid: 2, high: 3, weight: 1 },
      { key: 'M1', label: 'DCF', low: 1, mid: 2, high: 3, weight: 1 },
      { key: 'M4', label: 'Majątkowa', low: 1, mid: 2, high: 3, weight: 1 },
    ]);
    expect(m?.key).toBe('M1');
  });

  it('brak M1 → M4 wygrywa nad M2', () => {
    const m = pickDominantMethod([
      { key: 'M2', label: 'Mnożniki', low: 1, mid: 2, high: 3, weight: 1 },
      { key: 'M4', label: 'Majątkowa', low: 1, mid: 2, high: 3, weight: 1 },
    ]);
    expect(m?.key).toBe('M4');
  });

  it('tylko M2 → M2 (ostatni w kolejności, ale jedyny obecny)', () => {
    const m = pickDominantMethod([
      { key: 'M2', label: 'Mnożniki', low: 1, mid: 2, high: 3, weight: 1 },
    ]);
    expect(m?.key).toBe('M2');
  });

  it('pusta lista → null', () => {
    expect(pickDominantMethod([])).toBeNull();
  });
});

describe('reduceToDominantMethod', () => {
  it('koszyk M1+M2+M3 → zredukowany do 1 metody (M1), waga=1, brak flagi spójności', () => {
    const full = buildBasketFromResults({
      dcf: { enterpriseValue: 100 },
      comps: { impliedEnterpriseValue: { min: 90, median: 100, max: 110 } },
    });
    expect(full.methods.map((m) => m.key)).toEqual(['M1', 'M2', 'M3']);

    const reduced = reduceToDominantMethod(full);
    expect(reduced.methods).toHaveLength(1);
    expect(reduced.methods[0].key).toBe('M1');
    expect(reduced.methods[0].weight).toBe(1);
    expect(reduced.consistencyFlag.triggered).toBe(false);
  });

  it('pusty koszyk → zwrócony bez zmian (nic do zawężenia)', () => {
    const empty = buildBasketFromResults({ dcf: null, comps: null });
    expect(empty.methods).toHaveLength(0);
    const reduced = reduceToDominantMethod(empty);
    expect(reduced.methods).toHaveLength(0);
    expect(reduced.recommended).toEqual({ low: 0, mid: 0, high: 0 });
  });
});

// ── buildBasketForDepth: rdzeń przełącznika ─────────────────────────────────

describe('buildBasketForDepth — banking = dzisiejsze zachowanie, bez zmian', () => {
  it('banking zwraca DOKŁADNIE buildBasketFromResults(results, config) (deep-equal)', () => {
    const results = {
      dcf: { enterpriseValue: 100 },
      comps: { impliedEnterpriseValue: { min: 90, median: 100, max: 110 } },
      scenarioComparison: [
        { scenario: 'conservative', dcf: { enterpriseValue: 85 } },
        { scenario: 'optimistic', dcf: { enterpriseValue: 120 } },
      ],
    };
    const config = {};
    const direct = buildBasketFromResults(results, config);
    const view = buildBasketForDepth(results, config, 'banking');

    expect(view.depth).toBe('banking');
    expect(view.basket).toEqual(direct);
    expect(view.basket.methods.map((m) => m.key)).toEqual(['M1', 'M2', 'M3']);
    expect(view.dominantMethodKey).toBeUndefined();
  });

  it('banking odblokowuje pełny koszyk M1-M4 gdy skonfigurowany assetIncome + peers (alwaysIncludeAssetIncome)', () => {
    const results = {
      dcf: { enterpriseValue: 100 },
      comps: { impliedEnterpriseValue: { min: 90, median: 100, max: 110 } },
    };
    const config = { alwaysIncludeAssetIncome: true, assetIncome: { adjustedNetAssets: 100 } };
    const view = buildBasketForDepth(results, config, 'banking');
    expect(view.basket.methods.map((m) => m.key)).toEqual(['M1', 'M2', 'M3', 'M4']);
  });
});

describe('buildBasketForDepth — managerial = jedna metoda dominująca, M3 nigdy obecna', () => {
  it('gdy jest DCF i peers → managerial zawęża do M1 (DCF), M2/M3 wykluczone', () => {
    const results = {
      dcf: { enterpriseValue: 100 },
      comps: { impliedEnterpriseValue: { min: 90, median: 100, max: 110 } },
    };
    const view = buildBasketForDepth(results, {}, 'managerial');
    expect(view.depth).toBe('managerial');
    expect(view.dominantMethodKey).toBe('M1');
    expect(view.basket.methods).toHaveLength(1);
    expect(view.basket.methods[0].key).toBe('M1');
  });

  it('brak DCF, brak peers, jest assetIncome → managerial wybiera M4 (fallback MŚP)', () => {
    const results = { dcf: null, comps: null };
    const view = buildBasketForDepth(results, { assetIncome: { adjustedNetAssets: 120 } }, 'managerial');
    expect(view.dominantMethodKey).toBe('M4');
    expect(view.basket.methods[0].key).toBe('M4');
    expect([view.basket.methods[0].low, view.basket.methods[0].mid, view.basket.methods[0].high]).toEqual([
      108, 120, 132,
    ]);
  });

  it('brak DCF, tylko peers → managerial wybiera M2 (mnożniki), M3 mimo peers NIE wchodzi', () => {
    const results = { dcf: null, comps: { impliedEnterpriseValue: { min: 90, median: 100, max: 110 } } };
    const view = buildBasketForDepth(results, {}, 'managerial');
    expect(view.dominantMethodKey).toBe('M2');
    expect(view.basket.methods[0].key).toBe('M2');
  });

  it('domyślna głębokość funkcji (bez 3-go argumentu) = managerial', () => {
    const results = { dcf: { enterpriseValue: 100 }, comps: null };
    const view = buildBasketForDepth(results, {});
    expect(view.depth).toBe('managerial');
  });

  it('brak metod wejściowych → koszyk pusty, dominantMethodKey undefined', () => {
    const view = buildBasketForDepth({ dcf: null, comps: null }, {}, 'managerial');
    expect(view.basket.methods).toHaveLength(0);
    expect(view.dominantMethodKey).toBeUndefined();
  });
});

// ── depthNarrative ───────────────────────────────────────────────────────────

describe('depthNarrative', () => {
  it('managerial: narracja jednej metody z pasmem i środkiem', () => {
    const view = buildBasketForDepth(
      { dcf: { enterpriseValue: 1000000 }, comps: null },
      {},
      'managerial'
    );
    const text = depthNarrative(view, 'PLN');
    expect(text).toContain('Szacowana wartość firmy');
    expect(text).toContain('PLN');
    expect(text).toContain('DCF');
  });

  it('banking: narracja koszyka z przedziałem rekomendowanym', () => {
    const view = buildBasketForDepth(
      {
        dcf: { enterpriseValue: 100 },
        comps: { impliedEnterpriseValue: { min: 90, median: 100, max: 110 } },
      },
      {},
      'banking'
    );
    const text = depthNarrative(view, 'PLN');
    expect(text).toContain('koszyk');
    expect(text).toContain('PLN');
  });

  it('brak metod → komunikat o braku danych, nic więcej', () => {
    const view = buildBasketForDepth({ dcf: null, comps: null }, {}, 'managerial');
    expect(depthNarrative(view)).toBe('Brak wystarczających danych do oszacowania wartości firmy.');
  });
});

// ── Orkiestracja DB: setValuationDepth / getValuationDepth ──────────────────

describe('setValuationDepth / getValuationDepth — thin wrapper nad valuationService', () => {
  it('setValuationDepth(managerial) zapisuje depth + uproszczony WACC przez updateAssumptions', async () => {
    (dbGet as any).mockReset();
    (dbRun as any).mockReset();
    (dbGet as any).mockResolvedValue({
      id: 'val-1',
      organization_id: 'org-1',
      status: 'DRAFT',
      horizon_years: 5,
      assumptions: JSON.stringify({ horizonYears: 5, waccPercent: 12, terminalMethod: 'gordon' }),
      peers: '[]',
      results: '{}',
      currency: 'PLN',
    });
    (dbRun as any).mockResolvedValue(undefined);

    await setValuationDepth('org-1', 'val-1', 'managerial');

    expect(dbRun).toHaveBeenCalled();
    const call = (dbRun as any).mock.calls.find((c: any[]) =>
      String(c[0]).includes('UPDATE valuations SET assumptions')
    );
    expect(call).toBeTruthy();
    const savedJson = JSON.parse(call[1][0]);
    expect(savedJson.depth).toBe('managerial');
    expect(savedJson.waccBreakdown).toEqual(MANAGERIAL_WACC_BREAKDOWN);
    expect(savedJson.waccPercent).toBe(9.64);
  });

  it('setValuationDepth(banking) NIE nadpisuje istniejącego WACC — tylko znacznik depth', async () => {
    (dbGet as any).mockReset();
    (dbRun as any).mockReset();
    (dbGet as any).mockResolvedValue({
      id: 'val-2',
      organization_id: 'org-1',
      status: 'DRAFT',
      horizon_years: 5,
      assumptions: JSON.stringify({
        horizonYears: 5,
        waccPercent: 42,
        waccBreakdown: { riskFreeRate: 1, equityRiskPremium: 2, beta: 3, costOfDebt: 4, taxRate: 5, debtWeight: 6, equityWeight: 94 },
        terminalMethod: 'gordon',
      }),
      peers: '[]',
      results: '{}',
      currency: 'PLN',
    });
    (dbRun as any).mockResolvedValue(undefined);

    await setValuationDepth('org-1', 'val-2', 'banking');

    const call = (dbRun as any).mock.calls.find((c: any[]) =>
      String(c[0]).includes('UPDATE valuations SET assumptions')
    );
    const savedJson = JSON.parse(call[1][0]);
    expect(savedJson.depth).toBe('banking');
    // WACC pozostaje TYM SAMYM co przed przełączeniem — banking "na żądanie" nie kasuje edycji.
    expect(savedJson.waccPercent).toBe(42);
  });

  it('getValuationDepth czyta zapisaną depth z assumptions', async () => {
    (dbGet as any).mockReset();
    (dbGet as any).mockResolvedValueOnce({
      id: 'val-3',
      organization_id: 'org-1',
      status: 'DRAFT',
      horizon_years: 5,
      assumptions: JSON.stringify({ depth: 'banking' }),
      peers: '[]',
      results: '{}',
      currency: 'PLN',
    });
    const depth = await getValuationDepth('org-1', 'val-3');
    expect(depth).toBe('banking');
  });

  it('getValuationDepth: wycena nieznaleziona → null', async () => {
    (dbGet as any).mockReset();
    (dbGet as any).mockResolvedValueOnce(undefined);
    const depth = await getValuationDepth('org-1', 'missing');
    expect(depth).toBeNull();
  });
});
