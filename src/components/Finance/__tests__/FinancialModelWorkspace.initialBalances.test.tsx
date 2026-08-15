/**
 * @vitest-environment jsdom
 *
 * Stary ekran „Models" (`FinancialModelWorkspace`) — siedem pól „Initial …"
 * (Cash/Equity/Debt/PPE/AR/Inventory/AP) nie może zmyślać danych.
 *
 * Defekt, który ten plik zamyka (dwa niezależne kłamstwa składające się na
 * jeden ekran):
 *   1. `seededInputKeys` oznaczało WSZYSTKIE siedem pól jako „Imported from
 *      statement" na podstawie samego model-level `isGrounded` (czy model MA
 *      jakikolwiek seed) — bez sprawdzenia per klucz, czy dana wartość w ogóle
 *      istnieje w `assumptions_json`.
 *   2. Input renderował `assumptions[key] ?? 0`, więc brak danych wyglądał
 *      identycznie jak realne zero.
 *
 * Razem: konsultant widział „Gotówka: 0 · IMPORTED FROM STATEMENT" i miał pełne
 * prawo uznać, że to liczba wyciągnięta ze sprawozdania klienta.
 *
 * MOCK = KSZTAŁT SERWERA: `MOCK_MODEL.assumptions_json` jest skopiowany z
 * fixture'a `dev-render/screens/finance-model-workspace.tsx` (ten sam, który
 * zasila zrzut „PRZED" w `docs/validation/finance-v3/generated/gate-e/visual/
 * pkg-f/`) — zawiera WYŁĄCZNIE `baseline.*` (drivery P&L) i `seedSource`,
 * ZERO z siedmiu kluczy bilansowych. To nie jest wymyślony przypadek brzegowy,
 * tylko dane, na których ekran realnie stoi.
 *
 * Kanon stanu wartości: PRESENT_ZERO ≠ MISSING — ta sama zasada, którą nowy
 * Baseline Workspace realizuje przez `formatFinanceValueForDisplay`
 * (`src/services/api/financeV2.types.ts`).
 */
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock('../../../services/funnelAnalytics', () => ({
  trackFunnelEvent: vi.fn(),
}));

// Kształt odpowiedzi jest kopią kontraktu, który komponent realnie czyta
// (`getModelDetailWithFallback` bierze `data.model`, `getModelsListWithFallback`
// bierze `data.models`) — mock z innym kształtem cicho przechodziłby w pustkę.
const getModel = vi.fn();

vi.mock('../../../services/api/v8/finance', () => ({
  shouldFallbackToLegacyFinance: () => false,
  V8FinanceApi: {
    getModels: vi.fn().mockResolvedValue({ models: [] }),
    getModel: (...args: unknown[]) => getModel(...args),
    getModelOutputs: vi.fn().mockResolvedValue({ grouped: {} }),
    getModelValidations: vi
      .fn()
      .mockResolvedValue({ validations: [], summary: { total: 0, pass: 0, fail: 0, warning: 0 } }),
    getCaseScenarios: vi.fn().mockResolvedValue({ scenarios: [] }),
    // Wołane przez `ModelVersionHistory` (montowany za flagą `modelVersioning`).
    getModelVersions: vi.fn().mockResolvedValue({ versions: [] }),
  },
}));

// `GET …/assumptions-status` nie ma wariantu v8 — komponent woła je wprost
// przez `Api.get`.
vi.mock('../../../services/api', () => ({
  Api: { get: vi.fn().mockResolvedValue({ assumptions: [] }) },
  default: { get: vi.fn().mockResolvedValue({ assumptions: [] }) },
}));

import {
  computeSeededInputKeys,
  FinancialModelWorkspace,
  INITIAL_BALANCE_FIELDS,
  initialBalanceValueStatus,
} from '../FinancialModelWorkspace';

/**
 * Skopiowane 1:1 z `dev-render/screens/finance-model-workspace.tsx` (MOCK_MODEL
 * .assumptions_json) — celowo BEZ żadnego `initial*`.
 */
const FIXTURE_ASSUMPTIONS_JSON = {
  baseline: {
    revenue: 12_400_000,
    cogs: 7_100_000,
    opex: 3_050_000,
    depreciation: 430_000,
    interest: 180_000,
    tax: 410_000,
    capex: 560_000,
  },
  seedSource: {
    type: 'statement',
    statement_type: 'PL',
    currency: 'PLN',
    status: 'approved',
    periodLabel: 'FY2025',
  },
};

function mockModel(assumptionsJson: Record<string, unknown>) {
  return {
    id: 'model-dbr77-demo-1',
    name: 'DBR77 — Model bazowy FY2026',
    currency: 'PLN',
    horizon_months: 36,
    start_date: '2026-01-01',
    granularity: 'quarterly',
    scenario: 'base',
    status: 'draft',
    version: 1,
    // Model JEST ugruntowany — to właśnie ta flaga fałszywie „importowała"
    // wszystkie siedem pól bilansowych.
    source_statement_id: 'stmt-dbr77-fy2025',
    source_statement: { id: 'stmt-dbr77-fy2025', period_label: 'FY2025' },
    assumptions_json: assumptionsJson,
    events: [],
  };
}

const BALANCE_KEYS = INITIAL_BALANCE_FIELDS.map((f) => f.key);

// ───────────────────────────────────────────────────────────────────────────
// Warstwa czysta — orzekanie o stanie wartości bez renderu
// ───────────────────────────────────────────────────────────────────────────
describe('initialBalanceValueStatus — brak danych ≠ zero', () => {
  it('odróżnia PRESENT_ZERO od MISSING', () => {
    expect(initialBalanceValueStatus(0)).toBe('PRESENT_ZERO');
    expect(initialBalanceValueStatus('0')).toBe('PRESENT_ZERO');
    expect(initialBalanceValueStatus(1_500_000)).toBe('PRESENT_NONZERO');
    expect(initialBalanceValueStatus(-42)).toBe('PRESENT_NONZERO');
  });

  it('traktuje undefined/null/pusty string/NaN jako MISSING, nie jako zero', () => {
    expect(initialBalanceValueStatus(undefined)).toBe('MISSING');
    expect(initialBalanceValueStatus(null)).toBe('MISSING');
    expect(initialBalanceValueStatus('')).toBe('MISSING');
    expect(initialBalanceValueStatus('nie-liczba')).toBe('MISSING');
    expect(initialBalanceValueStatus(Number.NaN)).toBe('MISSING');
  });
});

describe('computeSeededInputKeys — dowód per klucz, nie per model', () => {
  it('na danych fixture’a (grounded, ale ZERO kluczy bilansowych) nie oznacza NICZEGO jako zaimportowane', () => {
    expect([...computeSeededInputKeys(FIXTURE_ASSUMPTIONS_JSON, true)]).toEqual([]);
  });

  it('oznacza wyłącznie te klucze, które faktycznie mają wartość w assumptions_json', () => {
    const seeded = computeSeededInputKeys(
      { ...FIXTURE_ASSUMPTIONS_JSON, initialCash: 1_200_000, initialEquity: 0 },
      true
    );
    // initialEquity = 0 to PRESENT_ZERO (realne zero ze sprawozdania), więc
    // liczy się jako zaimportowane — w odróżnieniu od pięciu pozostałych,
    // których w danych nie ma wcale.
    expect([...seeded].sort()).toEqual(['initialCash', 'initialEquity']);
  });

  it('model bez seeda nie importuje niczego, nawet gdy wartości są obecne', () => {
    expect([...computeSeededInputKeys({ initialCash: 999 }, false)]).toEqual([]);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Warstwa renderu — to, co realnie widzi konsultant
// ───────────────────────────────────────────────────────────────────────────
describe('FinancialModelWorkspace — siedem pól „Initial …" na danych fixture’a', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function renderWorkspace(assumptionsJson: Record<string, unknown>) {
    getModel.mockResolvedValue({ model: mockModel(assumptionsJson) });
    render(<FinancialModelWorkspace initialModelId="model-dbr77-demo-1" hideSidebar />);
    await waitFor(() =>
      expect(screen.getByTestId('initial-balance-input-initialCash')).toBeTruthy()
    );
  }

  it('ŻADNE z siedmiu pól nie pokazuje „0" ani etykiety „Imported from statement", gdy danych nie ma', async () => {
    await renderWorkspace(FIXTURE_ASSUMPTIONS_JSON);

    for (const key of BALANCE_KEYS) {
      const input = screen.getByTestId(`initial-balance-input-${key}`) as HTMLInputElement;
      expect(input.value, `${key} nie może zmyślać zera`).toBe('');
      expect(input.getAttribute('data-value-status')).toBe('MISSING');

      const status = screen.getByTestId(`initial-balance-status-${key}`);
      expect(status.getAttribute('data-value-status')).toBe('MISSING');
      expect(status.textContent).toBe('Missing');
    }

    // Regresja wprost: etykieta pochodzenia nie pada ani razu na ekranie,
    // na którym żadna wartość bilansowa nie istnieje.
    expect(screen.queryAllByText('Imported from statement')).toHaveLength(0);
  });

  it('realne zero ze sprawozdania renderuje „0" + „Imported from statement" — odróżnialne od braku', async () => {
    await renderWorkspace({ ...FIXTURE_ASSUMPTIONS_JSON, initialCash: 0, initialDebt: 4_000_000 });

    const cash = screen.getByTestId('initial-balance-input-initialCash') as HTMLInputElement;
    expect(cash.value).toBe('0');
    expect(cash.getAttribute('data-value-status')).toBe('PRESENT_ZERO');
    expect(screen.getByTestId('initial-balance-status-initialCash').textContent).toBe(
      'Imported from statement'
    );

    const debt = screen.getByTestId('initial-balance-input-initialDebt') as HTMLInputElement;
    expect(debt.value).toBe('4000000');
    expect(debt.getAttribute('data-value-status')).toBe('PRESENT_NONZERO');

    // Pola, których w danych nadal nie ma, zostają puste i oznaczone jako brak.
    const ppe = screen.getByTestId('initial-balance-input-initialPPE') as HTMLInputElement;
    expect(ppe.value).toBe('');
    expect(screen.getByTestId('initial-balance-status-initialPPE').textContent).toBe('Missing');
  });
});
