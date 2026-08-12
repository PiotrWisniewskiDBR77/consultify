/**
 * @vitest-environment jsdom
 *
 * Pakiet I (Dostępność), wymaganie #7 — `FinanceLineageNavigator.tsx`. PRZED
 * naprawą: przejście loading→error/loaded zmieniało wyłącznie widoczny DOM.
 */
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetFinanceLineageNavigator = vi.fn();
vi.mock('@/services/api/financeV2.api', () => ({
  getFinanceLineageNavigator: (...args: unknown[]) => mockGetFinanceLineageNavigator(...args),
}));

import { FinanceLineageNavigator } from '../FinanceLineageNavigator';

const MINIMAL_RESULT = {
  businessVersionId: 'bv-focus',
  trail: { items: [], totalNodeCount: 0, hasAlternatePaths: false, unresolvedVersionIds: [], cycleVersionIds: [] },
  relatedPanel: {
    focus: {
      versionId: 'bv-focus', artifactId: 'art-focus', artifactType: 'VALUATION_CASE', name: 'Valuation v1',
      versionLabel: 'v1', periodLabel: null, status: 'DRAFT', freshness: 'STALE_SOURCE', variantLabel: null,
    },
    parents: [], indirectAncestors: [], children: [], indirectDescendants: [], siblings: [], createNew: [],
    createNewBlockedReason: null, createNewBlockedLabel: null, focusBadges: [], terminalVisibility: 'show', hiddenTerminalCount: 0,
    cycleVersionIds: [],
  },
  fullGraphView: { id: 'finance.lineage.fullGraph', label: { key: 'x', pl: 'Pełny graf powiązań' }, auxiliary: true, defaultVisible: false },
};

beforeEach(() => {
  window.localStorage.clear();
  mockGetFinanceLineageNavigator.mockReset();
  window.localStorage.setItem('consultify_feature_flags', JSON.stringify({ financeLineageNavigatorV1: true }));
});
afterEach(() => {
  window.localStorage.clear();
  vi.clearAllMocks();
});

describe('FinanceLineageNavigator — ogłaszanie stanów dynamicznych (a11y, Pakiet I)', () => {
  it('podczas ładowania jest zamontowany role="status" z tekstem "Ładowanie powiązań…"', async () => {
    mockGetFinanceLineageNavigator.mockReturnValueOnce(new Promise(() => {}));
    render(<FinanceLineageNavigator businessVersionId="bv-focus" />);
    const status = await screen.findByTestId('finance-status-announcer');
    expect(status).toHaveTextContent('Ładowanie powiązań…');
  });

  it('po sukcesie role="status" ogłasza liczbę elementów łańcucha', async () => {
    mockGetFinanceLineageNavigator.mockResolvedValueOnce(MINIMAL_RESULT);
    render(<FinanceLineageNavigator businessVersionId="bv-focus" />);
    await waitFor(() =>
      expect(screen.getByTestId('finance-status-announcer')).toHaveTextContent('Łańcuch powiązań wczytany: 0 elementów.')
    );
  });

  it('błąd → role="status" priority=assertive', async () => {
    mockGetFinanceLineageNavigator.mockRejectedValueOnce(new Error('boom'));
    render(<FinanceLineageNavigator businessVersionId="bv-focus" />);
    await waitFor(() => expect(screen.getByTestId('finance-status-announcer')).toHaveAttribute('aria-live', 'assertive'));
  });

  it('KONTROLA NEGATYWNA: przy fladze OFF brak jakiegokolwiek role="status"', () => {
    window.localStorage.clear();
    const { container } = render(<FinanceLineageNavigator businessVersionId="bv-focus" />);
    expect(container.firstChild).toBeNull();
    expect(screen.queryByTestId('finance-status-announcer')).not.toBeInTheDocument();
  });
});
