/**
 * @vitest-environment jsdom
 *
 * `FinanceLineageNavigator` — Pakiet AP-CLIENT (Gate J), priorytet #1.
 *
 * Dowodzi: (1) flaga OFF → `null`, ZERO wywołań `getFinanceLineageNavigator` (żaden
 * `fetchWithRetry`), (2) flaga ON → realny fetch, render breadcrumbu i panelu „Powiązane"
 * bez surowych tokenów enum, (3) błąd serwera → honest-UI komunikat, nie surowy JSON.
 */
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetFinanceLineageNavigator = vi.fn();
vi.mock('@/services/api/financeV2.api', () => ({
  getFinanceLineageNavigator: (...args: unknown[]) => mockGetFinanceLineageNavigator(...args),
}));

import { FinanceLineageNavigator } from '../FinanceLineageNavigator';

const SAMPLE: any = {
  businessVersionId: 'bv-focus',
  trail: {
    items: [
      {
        kind: 'node',
        metadata: {
          versionId: 'bv-root',
          artifactId: 'art-root',
          artifactType: 'STATEMENT_PACK',
          name: 'Statement pack v3',
          versionLabel: 'v3',
          periodLabel: null,
          status: 'APPROVED',
          freshness: 'CURRENT',
          variantLabel: null,
        },
        displayName: 'Statement pack v3',
        isFocus: false,
        outgoingEdgeType: 'STATEMENT_TO_ANALYSIS',
        staleBadge: null,
        stateBadge: null,
        isDimmed: false,
      },
      { kind: 'collapsed', hiddenCount: 2, hiddenVersionIds: ['bv-x', 'bv-y'] },
      {
        kind: 'node',
        metadata: {
          versionId: 'bv-focus',
          artifactId: 'art-focus',
          artifactType: 'VALUATION_CASE',
          name: 'Valuation v1',
          versionLabel: 'v1',
          periodLabel: null,
          status: 'DRAFT',
          freshness: 'STALE_SOURCE',
          variantLabel: null,
        },
        displayName: 'Valuation v1',
        isFocus: true,
        outgoingEdgeType: null,
        staleBadge: {
          kind: 'SOURCE_CHANGED',
          label: { key: 'x', pl: 'Źródło się zmieniło' },
          severity: 'warning',
        },
        stateBadge: null,
        isDimmed: false,
      },
    ],
    totalNodeCount: 4,
    hasAlternatePaths: false,
    unresolvedVersionIds: [],
    cycleVersionIds: [],
  },
  relatedPanel: {
    focus: {
      versionId: 'bv-focus',
      artifactId: 'art-focus',
      artifactType: 'VALUATION_CASE',
      name: 'Valuation v1',
      versionLabel: 'v1',
      periodLabel: null,
      status: 'DRAFT',
      freshness: 'STALE_SOURCE',
      variantLabel: null,
    },
    parents: [{ artifactType: 'PREDICTION_SCENARIO', count: 1, entries: [] }],
    indirectAncestors: [],
    children: [],
    indirectDescendants: [],
    siblings: [],
    createNew: [],
    createNewBlockedReason: 'NO_DOWNSTREAM_TYPE',
    createNewBlockedLabel: {
      key: 'finance.lineage.createNew.blocked.noDownstream',
      pl: 'Brak typu docelowego, który można utworzyć stąd.',
    },
    focusBadges: [
      {
        kind: 'SOURCE_CHANGED',
        label: { key: 'x', pl: 'Źródło się zmieniło' },
        severity: 'warning',
      },
    ],
    terminalVisibility: 'dim',
    hiddenTerminalCount: 1,
    cycleVersionIds: [],
  },
  fullGraphView: {
    id: 'finance.lineage.fullGraph',
    label: { key: 'x', pl: 'Pełny graf powiązań' },
    auxiliary: true,
    defaultVisible: false,
  },
};

beforeEach(() => {
  window.localStorage.clear();
  mockGetFinanceLineageNavigator.mockReset();
});
afterEach(() => {
  window.localStorage.clear();
  vi.clearAllMocks();
});

describe('FinanceLineageNavigator', () => {
  it('flaga domyślnie OFF → renderuje null, ZERO wywołań getFinanceLineageNavigator', () => {
    const { container } = render(<FinanceLineageNavigator businessVersionId="bv-focus" />);
    expect(container.firstChild).toBeNull();
    expect(mockGetFinanceLineageNavigator).not.toHaveBeenCalled();
  });

  it('flaga ON → woła getFinanceLineageNavigator(businessVersionId, opts) i renderuje trail + panel Powiązane', async () => {
    window.localStorage.setItem(
      'consultify_feature_flags',
      JSON.stringify({ financeLineageNavigatorV1: true })
    );
    mockGetFinanceLineageNavigator.mockResolvedValueOnce(SAMPLE);

    render(<FinanceLineageNavigator businessVersionId="bv-focus" maxDepth={4} />);

    await waitFor(() =>
      expect(screen.getByTestId('finance-lineage-navigator')).toBeInTheDocument()
    );
    expect(mockGetFinanceLineageNavigator).toHaveBeenCalledWith(
      'bv-focus',
      expect.objectContaining({ maxDepth: 4 })
    );

    // Breadcrumb: oba realne węzły + jeden zwinięty.
    expect(screen.getAllByTestId('lineage-trail-node')).toHaveLength(2);
    expect(screen.getByTestId('lineage-trail-collapsed')).toHaveTextContent('+2');
    expect(screen.getByText('Statement pack v3')).toBeInTheDocument();
    expect(screen.getByText('Valuation v1')).toBeInTheDocument();

    // Panel Powiązane: licznik rodziców, blokada „+ Nowy" z ludzkim tekstem (nie surowy kod).
    expect(screen.getByTestId('lineage-related-panel')).toBeInTheDocument();
    expect(
      screen.getByText('Brak typu docelowego, który można utworzyć stąd.')
    ).toBeInTheDocument();
    expect(screen.queryByText('NO_DOWNSTREAM_TYPE')).not.toBeInTheDocument();

    // Status/freshness renderują się jako etykieta PL, nigdy surowy token enum.
    expect(screen.getByText('Wersja robocza')).toBeInTheDocument(); // status DRAFT
    expect(screen.queryByText('DRAFT')).not.toBeInTheDocument();
    expect(screen.getByText(/Nieaktualne \(źródło się zmieniło\)/)).toBeInTheDocument();
    expect(screen.queryByText('STALE_SOURCE')).not.toBeInTheDocument();
  });

  it('błąd serwera (404 NOT_FOUND) → honest-UI komunikat, nie surowy JSON', async () => {
    window.localStorage.setItem(
      'consultify_feature_flags',
      JSON.stringify({ financeLineageNavigatorV1: true })
    );
    const err = new Error('Business version not found') as Error & {
      status?: number;
      data?: unknown;
    };
    err.status = 404;
    err.data = { code: 'NOT_FOUND' };
    mockGetFinanceLineageNavigator.mockRejectedValueOnce(err);

    render(<FinanceLineageNavigator businessVersionId="bv-missing" />);

    await waitFor(() => expect(screen.getByTestId('lineage-navigator-error')).toBeInTheDocument());
    expect(screen.getByText('Nie znaleziono')).toBeInTheDocument();
    expect(screen.queryByText('NOT_FOUND')).not.toBeInTheDocument();
  });

  it('KONTROLA NEGATYWNA: klik węzła wywołuje onNavigate z prawdziwym versionId/artifactType, zwinięty węzeł jest disabled i nic nie woła', async () => {
    window.localStorage.setItem(
      'consultify_feature_flags',
      JSON.stringify({ financeLineageNavigatorV1: true })
    );
    mockGetFinanceLineageNavigator.mockResolvedValueOnce(SAMPLE);
    const onNavigate = vi.fn();
    render(<FinanceLineageNavigator businessVersionId="bv-focus" onNavigate={onNavigate} />);
    await waitFor(() =>
      expect(screen.getByTestId('finance-lineage-navigator')).toBeInTheDocument()
    );

    const nodes = screen.getAllByTestId('lineage-trail-node');
    nodes[0].closest('button')!.click();
    expect(onNavigate).toHaveBeenCalledWith('bv-root', 'STATEMENT_PACK');

    const collapsedButton = screen.getByTestId('lineage-trail-collapsed').closest('button')!;
    expect(collapsedButton).toBeDisabled();
  });
});
