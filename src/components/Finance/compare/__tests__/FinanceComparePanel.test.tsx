/**
 * @vitest-environment jsdom
 *
 * `FinanceComparePanel` — Pakiet AP-CLIENT (Gate J), priorytet #2.
 *
 * Dowodzi: (1) flaga OFF → `null`, ZERO wywołań klienta compare, (2) flaga ON → woła
 * właściwą funkcję klienta wg `request.kind`, renderuje podsumowanie i wiersze bez
 * surowych tokenów enum, (3) filtr „tylko istotne" ukrywa niematerialne wiersze bez
 * ponownego wywołania sieci.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockComparePeriods = vi.fn();
const mockCompareVersions = vi.fn();
vi.mock('@/services/api/financeV2.api', () => ({
  compareFinancePeriods: (...args: unknown[]) => mockComparePeriods(...args),
  compareFinanceVersions: (...args: unknown[]) => mockCompareVersions(...args),
  compareFinanceEntities: vi.fn(),
  compareFinanceScenarios: vi.fn(),
  compareFinanceValuationMethods: vi.fn(),
  compareFinanceActualVsForecast: vi.fn(),
}));

import { FinanceComparePanel, type FinanceCompareRequest } from '../FinanceComparePanel';

function sampleResult() {
  return {
    comparisonType: 'PERIOD',
    generatedAt: 't',
    sourceA: { artifactType: 'STATEMENT_PACK', businessVersionId: 'bv-1', label: 'Styczeń' },
    sourceB: { artifactType: 'STATEMENT_PACK', businessVersionId: 'bv-1', label: 'Luty' },
    ignoreDimensions: ['periodId'],
    materialityThresholdPct: 5,
    onlyMaterial: false,
    summary: { totalRows: 2, bothPresent: 2, missingInA: 0, missingInB: 0, missingInBoth: 0, currencyMismatch: 0, materialCount: 1 },
    rows: [
      {
        matchKey: 'REVENUE',
        dimensions: { canonicalLineId: 'REVENUE' },
        a: { presence: 'PRESENT', valueStatus: 'PRESENT_NONZERO', businessVersionId: 'bv-1', cellRef: null, fullUnitValue: 100000, rawValueDecimal: '100000', unit: 'UNITS', multiplier: '1', nativeCurrency: 'PLN', presentationCurrency: 'PLN' },
        b: { presence: 'PRESENT', valueStatus: 'PRESENT_NONZERO', businessVersionId: 'bv-1', cellRef: null, fullUnitValue: 120000, rawValueDecimal: '120000', unit: 'UNITS', multiplier: '1', nativeCurrency: 'PLN', presentationCurrency: 'PLN' },
        diffKind: 'BOTH_PRESENT',
        absoluteDiff: 20000,
        pctDiff: 0.2,
        materialityFlag: true,
        note: null,
      },
      {
        matchKey: 'COGS',
        dimensions: { canonicalLineId: 'COGS' },
        a: { presence: 'PRESENT', valueStatus: 'PRESENT_NONZERO', businessVersionId: 'bv-1', cellRef: null, fullUnitValue: -50000, rawValueDecimal: '-50000', unit: 'UNITS', multiplier: '1', nativeCurrency: 'PLN', presentationCurrency: 'PLN' },
        b: { presence: 'PRESENT', valueStatus: 'PRESENT_NONZERO', businessVersionId: 'bv-1', cellRef: null, fullUnitValue: -51000, rawValueDecimal: '-51000', unit: 'UNITS', multiplier: '1', nativeCurrency: 'PLN', presentationCurrency: 'PLN' },
        diffKind: 'BOTH_PRESENT',
        absoluteDiff: -1000,
        pctDiff: 0.02,
        materialityFlag: false,
        note: null,
      },
    ],
  };
}

const REQUEST: FinanceCompareRequest = {
  kind: 'periods',
  params: { artifactRef: { artifactType: 'STATEMENT_PACK', artifactId: 'art-1', businessVersionId: 'bv-1' }, periodIdA: 'p1', periodIdB: 'p2' },
};

beforeEach(() => {
  window.localStorage.clear();
  mockComparePeriods.mockReset();
  mockCompareVersions.mockReset();
});
afterEach(() => {
  window.localStorage.clear();
  vi.clearAllMocks();
});

describe('FinanceComparePanel', () => {
  it('flaga domyślnie OFF → renderuje null, ZERO wywołań klienta compare', () => {
    const { container } = render(<FinanceComparePanel request={REQUEST} />);
    expect(container.firstChild).toBeNull();
    expect(mockComparePeriods).not.toHaveBeenCalled();
    expect(mockCompareVersions).not.toHaveBeenCalled();
  });

  it('flaga ON + request.kind="periods" → woła compareFinancePeriods, renderuje summary + wiersze', async () => {
    window.localStorage.setItem('consultify_feature_flags', JSON.stringify({ financeCompareV1: true }));
    mockComparePeriods.mockResolvedValueOnce(sampleResult());

    render(<FinanceComparePanel request={REQUEST} />);

    await waitFor(() => expect(screen.getByTestId('finance-compare-panel')).toBeInTheDocument());
    expect(mockComparePeriods).toHaveBeenCalledWith(REQUEST.params);
    expect(mockCompareVersions).not.toHaveBeenCalled();

    expect(screen.getByText('Okres / okres')).toBeInTheDocument();
    expect(screen.queryByText('PERIOD')).not.toBeInTheDocument();
    expect(screen.getByTestId('compare-summary')).toHaveTextContent('2'); // totalRows
    expect(screen.queryAllByText(/BOTH_PRESENT/)).toHaveLength(0); // nigdy surowy diffKind
    expect(screen.getAllByText('Obie strony mają wartość').length).toBeGreaterThan(0);
  });

  it('request.kind="versions" → woła compareFinanceVersions, NIE compareFinancePeriods', async () => {
    window.localStorage.setItem('consultify_feature_flags', JSON.stringify({ financeCompareV1: true }));
    mockCompareVersions.mockResolvedValueOnce({ ...sampleResult(), comparisonType: 'VERSION' });
    const versionsRequest: FinanceCompareRequest = {
      kind: 'versions',
      params: { artifactType: 'BASELINE_MODEL', artifactId: 'art-1', businessVersionIdA: 'bv-a', businessVersionIdB: 'bv-b' },
    };
    render(<FinanceComparePanel request={versionsRequest} />);
    await waitFor(() => expect(screen.getByTestId('finance-compare-panel')).toBeInTheDocument());
    expect(mockCompareVersions).toHaveBeenCalledWith(versionsRequest.params);
    expect(mockComparePeriods).not.toHaveBeenCalled();
  });

  it('filtr „tylko istotne" ukrywa niematerialny wiersz BEZ nowego wywołania sieci', async () => {
    window.localStorage.setItem('consultify_feature_flags', JSON.stringify({ financeCompareV1: true }));
    mockComparePeriods.mockResolvedValueOnce(sampleResult());
    render(<FinanceComparePanel request={REQUEST} />);
    await waitFor(() => expect(screen.getByTestId('finance-compare-panel')).toBeInTheDocument());

    expect(screen.getByText(/REVENUE/)).toBeInTheDocument();
    expect(screen.getByText(/COGS/)).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('compare-only-material-toggle'));

    expect(screen.getByText(/REVENUE/)).toBeInTheDocument();
    expect(screen.queryByText(/COGS/)).not.toBeInTheDocument();
    expect(mockComparePeriods).toHaveBeenCalledTimes(1); // toggle nie odpytuje serwera ponownie
  });

  it('KONTROLA NEGATYWNA: błąd 403 ORGANIZATION_MISMATCH → honest-UI komunikat, nie surowy kod', async () => {
    window.localStorage.setItem('consultify_feature_flags', JSON.stringify({ financeCompareV1: true }));
    const err = new Error('cross-tenant') as Error & { status?: number; data?: unknown };
    err.status = 403;
    err.data = { code: 'ORGANIZATION_MISMATCH' };
    mockComparePeriods.mockRejectedValueOnce(err);
    render(<FinanceComparePanel request={REQUEST} />);
    await waitFor(() => expect(screen.getByTestId('compare-panel-error')).toBeInTheDocument());
    expect(screen.queryByText('ORGANIZATION_MISMATCH')).not.toBeInTheDocument();
  });
});
