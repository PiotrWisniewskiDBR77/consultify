/**
 * @vitest-environment jsdom
 *
 * Pakiet I (Dostępność), wymaganie #7 „ogłaszanie stanów dynamicznych" —
 * `FinanceComparePanel.tsx`. PRZED naprawą: przejście loading→error/loaded
 * zmieniało WYŁĄCZNIE widoczny DOM — czytnik ekranu nie miał żadnego sygnału,
 * że porównanie się skończyło (ani że się nie udało), poza ponownym
 * przejrzeniem strony.
 */
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockComparePeriods = vi.fn();
vi.mock('@/services/api/financeV2.api', () => ({
  compareFinancePeriods: (...args: unknown[]) => mockComparePeriods(...args),
  compareFinanceVersions: vi.fn(),
  compareFinanceEntities: vi.fn(),
  compareFinanceScenarios: vi.fn(),
  compareFinanceValuationMethods: vi.fn(),
  compareFinanceActualVsForecast: vi.fn(),
}));

import { FinanceComparePanel, type FinanceCompareRequest } from '../FinanceComparePanel';

const REQUEST: FinanceCompareRequest = {
  kind: 'periods',
  params: {
    artifactRef: { artifactType: 'STATEMENT_PACK', artifactId: 'art-1', businessVersionId: 'bv-1' },
    periodIdA: 'p1',
    periodIdB: 'p2',
  },
};

function sampleResult() {
  return {
    comparisonType: 'PERIOD',
    generatedAt: 't',
    sourceA: { artifactType: 'STATEMENT_PACK', businessVersionId: 'bv-1', label: 'Styczeń' },
    sourceB: { artifactType: 'STATEMENT_PACK', businessVersionId: 'bv-1', label: 'Luty' },
    ignoreDimensions: ['periodId'],
    materialityThresholdPct: 5,
    onlyMaterial: false,
    summary: {
      totalRows: 1,
      bothPresent: 1,
      missingInA: 0,
      missingInB: 0,
      missingInBoth: 0,
      currencyMismatch: 0,
      materialCount: 0,
    },
    rows: [],
  };
}

beforeEach(() => {
  window.localStorage.clear();
  mockComparePeriods.mockReset();
  window.localStorage.setItem(
    'consultify_feature_flags',
    JSON.stringify({ financeCompareV1: true })
  );
});
afterEach(() => {
  window.localStorage.clear();
  vi.clearAllMocks();
});

describe('FinanceComparePanel — ogłaszanie stanów dynamicznych (a11y, Pakiet I)', () => {
  it('podczas ładowania jest zamontowany role="status" z tekstem "Liczenie porównania…"', async () => {
    mockComparePeriods.mockReturnValueOnce(new Promise(() => {})); // nigdy się nie rozwiązuje — zostajemy w loading
    render(<FinanceComparePanel request={REQUEST} />);
    const status = await screen.findByTestId('finance-status-announcer');
    expect(status).toHaveAttribute('role', 'status');
    expect(status).toHaveTextContent('Liczenie porównania…');
  });

  it('po sukcesie treść role="status" zmienia się na komunikat gotowości', async () => {
    mockComparePeriods.mockResolvedValueOnce(sampleResult());
    render(<FinanceComparePanel request={REQUEST} />);
    await waitFor(() =>
      expect(screen.getByTestId('finance-status-announcer')).toHaveTextContent('Porównanie gotowe.')
    );
  });

  it('po błędzie role="status" ma priority=assertive i niesie komunikat błędu', async () => {
    mockComparePeriods.mockRejectedValueOnce(new Error('boom'));
    render(<FinanceComparePanel request={REQUEST} />);
    await waitFor(() => {
      const status = screen.getByTestId('finance-status-announcer');
      expect(status).toHaveAttribute('aria-live', 'assertive');
      expect(status).toHaveTextContent(/Błąd porównania/);
    });
  });

  it('KONTROLA NEGATYWNA: przy fladze OFF nie ma ŻADNEGO role="status" (panel nie renderuje nic)', () => {
    window.localStorage.clear();
    const { container } = render(<FinanceComparePanel request={REQUEST} />);
    expect(container.firstChild).toBeNull();
    expect(screen.queryByTestId('finance-status-announcer')).not.toBeInTheDocument();
  });
});
