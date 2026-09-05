/**
 * PRZEJŚCIE NA ŻYWO 2026-09-05 — ekran „Enterprise Value — przedział rekomendowany"
 * (EV football-field) nieosiągalny z REALNEGO rekordu wyceny.
 *
 * Zmierzone na stagingu (wycena `ab2dcfe8…`, „CD PROJEKT Group — Bear DCF + multiples"):
 *   GET /api/economics/valuations/:id                   → 200 (rekord + results.dcf)
 *   GET /api/economics/valuations/:id/basket            → 200 (realny koszyk metod)
 *   GET /api/v8/finance-v2/artifacts/resolve-legacy/…   → 200 { status: NOT_MIGRATED }
 *   GET /api/v8/finance-v2/valuation/legacy/:id/inputs  → 409 LEGACY_IDENTITY_UNMAPPED
 *
 * Wcześniej jedno 409 z warstwy kanonicznej wywracało CAŁE ładowanie rekordu —
 * ekran zostawał na „Select a valuation to continue", a panel EV (wymaga `dcf`)
 * nigdy się nie renderował.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const REAL_ID = 'ab2dcfe8805042efb7e3e420f1028a48';

const REAL_VALUATION = {
  id: REAL_ID,
  title: 'CD PROJEKT Group — Bear DCF + multiples',
  status: 'APPROVED',
  currency: 'PLN',
  horizon_years: 3,
  assumptions: { waccPercent: 10.2, terminalGrowthPercent: 3, horizonYears: 3 },
  peers: [{ metric: 'EV/EBITDA', min: 6.4, median: 8, max: 9.6 }],
  results: {
    dcf: {
      enterpriseValue: 4219798.26,
      equityValue: 4300756.26,
      terminalValue: 4838230.59,
      terminalMethod: 'gordon',
    },
  },
};

const REAL_BASKET = {
  methods: [
    {
      key: 'M1',
      label: 'DCF / FCFF',
      low: 2974676.65,
      mid: 4219798.26,
      high: 7241644.6,
      weight: 1,
      note: 'Zakres z siatki wrażliwości',
    },
  ],
  intersection: { low: 2974676.65, high: 7241644.6 },
  recommended: { low: 2974676.65, mid: 4219798.26, high: 7241644.6 },
  consistencyFlag: { triggered: false, thresholdPct: 20, maxDivergencePct: 0, topDriver: null },
  weights: { M1: 1 },
};

const legacyIdentityUnmapped = () => {
  const error = new Error('Legacy valuation is not mapped') as Error & { code?: string };
  error.code = 'LEGACY_IDENTITY_UNMAPPED';
  return Promise.reject(error);
};

const getCanonicalValuationInputs = vi.fn(legacyIdentityUnmapped);
const getCanonicalValuationResults = vi.fn(async () => ({}));

vi.mock('@/services/api/financeV2.api', () => ({
  getCanonicalValuationInputs: (...args: unknown[]) =>
    (getCanonicalValuationInputs as (...a: unknown[]) => Promise<unknown>)(...args),
  getCanonicalValuationResults: (...args: unknown[]) =>
    (getCanonicalValuationResults as (...a: unknown[]) => Promise<unknown>)(...args),
  saveCanonicalValuationAssumptions: vi.fn(),
  saveCanonicalValuationPeers: vi.fn(),
  computeCanonicalLegacyValuation: vi.fn(),
  confirmCanonicalLegacyValuationComputeReadback: vi.fn(),
  approveCanonicalValuation: vi.fn(),
  exportCanonicalLegacyValuationPptx: vi.fn(),
  generateCanonicalValuationAdvisor: vi.fn(),
  createCanonicalLegacyValuation: vi.fn(),
}));

vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
  toast: { success: vi.fn(), error: vi.fn() },
}));

const respond = (body: unknown, status = 200) =>
  Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response);

beforeEach(() => {
  vi.clearAllMocks();
  getCanonicalValuationInputs.mockImplementation(legacyIdentityUnmapped);
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/economics/valuations/sources')) {
        return respond({ sources: { budgets: [], financialModels: [] } });
      }
      if (url.endsWith(`/economics/valuations/${REAL_ID}/basket`)) {
        return respond({ success: true, basket: REAL_BASKET });
      }
      if (url.endsWith(`/economics/valuations/${REAL_ID}`)) {
        return respond({ success: true, valuation: REAL_VALUATION });
      }
      if (url.endsWith('/economics/valuations')) {
        return respond({ valuations: [{ id: REAL_ID, title: REAL_VALUATION.title }] });
      }
      return respond({}, 404);
    })
  );
});

const renderWorkspace = async () => {
  const { ValuationWorkspace } = await import('@/components/Benefits/ValuationWorkspace');
  return render(<ValuationWorkspace initialValuationId={REAL_ID} hideSidebar />);
};

describe('Wycena — realny rekord nieprzeniesiony do modelu kanonicznego', () => {
  it('otwiera rekord i renderuje EV football-field mimo 409 z warstwy kanonicznej', async () => {
    await renderWorkspace();

    await waitFor(() =>
      expect(screen.getByText('CD PROJEKT Group — Bear DCF + multiples')).toBeTruthy()
    );
    // Panel EV żyje na kroku „Wyniki" — to jest droga dojścia do zatwierdzonego obrazu.
    fireEvent.click(document.getElementById('valuation-tab-results') as HTMLElement);
    await waitFor(() => expect(screen.getByTestId('ev-basket-football')).toBeTruthy());
    // Uczciwość: użytkownik widzi, skąd są liczby.
    expect(screen.getByTestId('valuation-archive-only-notice')).toBeTruthy();
    expect(screen.queryByText('Select a valuation to continue')).toBeNull();
  });

  it('gdy warstwa kanoniczna działa, panel EV nadal się renderuje (bez paska archiwum)', async () => {
    getCanonicalValuationInputs.mockImplementation(
      async () => ({ businessVersionId: 'bv-1', assumptions: {}, peers: null }) as never
    );
    getCanonicalValuationResults.mockImplementation(
      async () =>
        ({
          methods: [{ methodType: 'DCF_FCFF', result: { valueDecimal: 4219798.26 } }],
          bridge: { header: { equity_value_decimal: 4300756.26 } },
          terminal: [{ is_primary: true, terminal_value_decimal: 4838230.59 }],
        }) as never
    );

    await renderWorkspace();

    await waitFor(() =>
      expect(document.getElementById('valuation-tab-results')).not.toBeNull()
    );
    fireEvent.click(document.getElementById('valuation-tab-results') as HTMLElement);
    await waitFor(() => expect(screen.getByTestId('ev-basket-football')).toBeTruthy());
    expect(screen.queryByTestId('valuation-archive-only-notice')).toBeNull();
  });
});
