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
  trail: {
    items: [],
    totalNodeCount: 0,
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
    parents: [],
    indirectAncestors: [],
    children: [],
    indirectDescendants: [],
    siblings: [],
    createNew: [],
    createNewBlockedReason: null,
    createNewBlockedLabel: null,
    focusBadges: [],
    terminalVisibility: 'show',
    hiddenTerminalCount: 0,
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
  window.localStorage.setItem(
    'consultify_feature_flags',
    JSON.stringify({ financeLineageNavigatorV1: true })
  );
});
afterEach(() => {
  window.localStorage.clear();
  vi.clearAllMocks();
});

describe('FinanceLineageNavigator — ogłaszanie stanów dynamicznych (a11y, Pakiet I)', () => {
  it('podczas ładowania jest zamontowany role="status" z tekstem "Loading lineage…"', async () => {
    mockGetFinanceLineageNavigator.mockReturnValueOnce(new Promise(() => {}));
    render(<FinanceLineageNavigator businessVersionId="bv-focus" />);
    const status = await screen.findByTestId('finance-status-announcer');
    expect(status).toHaveTextContent('Loading lineage…');
  });

  it('po sukcesie role="status" ogłasza liczbę elementów łańcucha', async () => {
    mockGetFinanceLineageNavigator.mockResolvedValueOnce(MINIMAL_RESULT);
    render(<FinanceLineageNavigator businessVersionId="bv-focus" />);
    // NAPRAWA (dług 11.09): plik NIE ma lokalnego mocka react-i18next — czyta
    // globalny (tests/setup.ts:122), który ma `i18n.language:'en'` na stałe i
    // ZAWSZE zwraca angielski fallback niezależnie od klucza (tak samo jak
    // sąsiedni test „podczas ładowania…", którego własny tytuł już nazywa
    // oczekiwany tekst „Loading lineage…" — ten sam język). Asercja szukała
    // polskiego tłumaczenia, którego globalny mock nigdy nie odda; dogonione
    // do tego, co realnie ogłasza `role="status"` pod tym przyrządem.
    await waitFor(() =>
      expect(screen.getByTestId('finance-status-announcer')).toHaveTextContent(
        'Lineage chain loaded: 0 items.'
      )
    );
  });

  it('błąd → role="status" priority=assertive', async () => {
    mockGetFinanceLineageNavigator.mockRejectedValueOnce(new Error('boom'));
    render(<FinanceLineageNavigator businessVersionId="bv-focus" />);
    await waitFor(() =>
      expect(screen.getByTestId('finance-status-announcer')).toHaveAttribute(
        'aria-live',
        'assertive'
      )
    );
  });

  it('KONTROLA NEGATYWNA: przy fladze OFF brak jakiegokolwiek role="status"', () => {
    // DEC-2026-09-03-348 (A2): financeLineageNavigatorV1 domyślnie ON —
    // clear() już nie wyłącza panelu, trzeba jawnie wymusić override OFF.
    window.localStorage.setItem(
      'consultify_feature_flags',
      JSON.stringify({ financeLineageNavigatorV1: false })
    );
    const { container } = render(<FinanceLineageNavigator businessVersionId="bv-focus" />);
    expect(container.firstChild).toBeNull();
    expect(screen.queryByTestId('finance-status-announcer')).not.toBeInTheDocument();
  });
});

describe('FinanceLineageNavigator — struktura role="list" (a11y, Pakiet I)', () => {
  it('każde dziecko bezpośrednie role="list" jest role="listitem" (axe: "aria-required-children" critical, PRZED naprawą — <button> był bezpośrednim dzieckiem)', async () => {
    const result = {
      ...MINIMAL_RESULT,
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
            staleBadge: null,
            stateBadge: null,
            isDimmed: false,
          },
        ],
        totalNodeCount: 2,
        hasAlternatePaths: false,
        unresolvedVersionIds: [],
        cycleVersionIds: [],
      },
    };
    mockGetFinanceLineageNavigator.mockResolvedValueOnce(result);
    render(<FinanceLineageNavigator businessVersionId="bv-focus" />);

    const list = await screen.findByTestId('lineage-trail');
    expect(list).toHaveAttribute('role', 'list');
    // Dzieci NIE ukryte przed AT (aria-hidden) muszą być role=listitem — to
    // dokładnie to, co sprawdza axe (`aria-required-children`): aria-hidden
    // dzieci są wyjęte z drzewa dostępności, więc nie liczą się do wymogu.
    const visibleChildren = Array.from(list.children).filter(
      (c) => c.getAttribute('aria-hidden') !== 'true'
    );
    expect(visibleChildren.length).toBeGreaterThan(0);
    for (const child of visibleChildren) {
      expect(child).toHaveAttribute('role', 'listitem');
    }
    const separator = screen.getByText('→');
    expect(separator).toHaveAttribute('aria-hidden', 'true');
  });
});
