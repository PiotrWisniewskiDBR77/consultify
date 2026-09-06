/**
 * @vitest-environment jsdom
 *
 * Menu 2 modułu Wyniki po DEC-422b/e (06.09) — „Raporty zarządcze" zamiast
 * „Wyszukiwarki".
 *
 * Słowa właściciela: „Raporty zarządcze przenieś do menu drugiego — we
 * wszystkich miejscach menu drugiego. […] Po otwarciu tabela z raportami.
 * […] Ten wyszukiwak wywalamy, tutaj robimy raporty zarządcze."
 *
 * Test broni DWÓCH rzeczy, które właściciel zobaczy na ekranie:
 *  1. Menu 2 ma DOKŁADNIE cztery zakładki i żadna z nich nie jest
 *     „Wyszukiwarką" (mutacja: przywrócenie zakładki `search` → RED).
 *  2. CTA „Nowy raport" otwiera generator, a generator zaczyna się od kroku
 *     ŹRÓDŁA z realnymi rekordami z `/api/projects` (mutacja: usunięcie
 *     `onClick` z `primaryCta` → RED).
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: unknown) =>
      typeof fallback === 'string'
        ? fallback
        : ((fallback as { defaultValue?: string })?.defaultValue ?? _key),
    i18n: { language: 'pl' },
  }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

const apiGet = vi.fn(async (url: string) => {
  if (url.startsWith('/api/management-reports/history')) {
    return {
      data: {
        reports: [
          {
            id: 'rep-1',
            title: 'Raport dla komitetu sterującego — wrzesień',
            reportType: 'STEERING_COMMITTEE',
            scope: 'PORTFOLIO',
            status: 'FINAL',
            generatedBy: 'u1',
            generatedByName: 'Piotr Wiśniewski',
            projectName: null,
            createdAt: '2026-09-01T10:00:00.000Z',
            updatedAt: '2026-09-04T10:00:00.000Z',
          },
        ],
        total: 1,
      },
    };
  }
  if (url === '/api/projects') {
    return { data: [{ id: 'proj-1', name: 'Transformacja produkcji' }] };
  }
  return { data: {} };
});

vi.mock('@/services/api', () => ({
  Api: { get: (...args: any[]) => apiGet(args[0]), post: vi.fn(), put: vi.fn() },
}));

import { getResultsDomainTabs } from '../resultsDomainNavigation';
import { ResultsManagementReportsRegistry } from '../reports/ResultsManagementReportsRegistry';

describe('Wyniki — Menu 2 po DEC-422b/e', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it('Menu 2 ma dokładnie 4 zakładki: KPI · OKR · ROI · Raporty zarządcze (zero „Wyszukiwarki")', () => {
    const tabs = getResultsDomainTabs();
    expect(tabs).toHaveLength(4);
    expect(tabs.map((tab) => tab.id)).toEqual(['kpi', 'okr', 'roi', 'reports']);
    expect(tabs.map((tab) => tab.label)).toEqual(['KPI', 'OKR', 'ROI', 'Raporty zarządcze']);
    expect(tabs.some((tab) => tab.id === 'search')).toBe(false);
    expect(tabs.some((tab) => /wyszukiwar|search/i.test(tab.label))).toBe(false);
  });

  it('zakładka pokazuje tabelę realnych raportów zarządczych z /history', async () => {
    render(
      <MemoryRouter>
        <ResultsManagementReportsRegistry />
      </MemoryRouter>
    );

    await waitFor(() =>
      expect(
        screen.getByText('Raport dla komitetu sterującego — wrzesień')
      ).toBeInTheDocument()
    );
    expect(apiGet).toHaveBeenCalledWith(
      expect.stringContaining('/api/management-reports/history')
    );
    // Status i typ nigdy jako surowy enum serwera.
    expect(screen.queryByText('STEERING_COMMITTEE')).not.toBeInTheDocument();
    expect(screen.getByText('Raport dla komitetu sterującego')).toBeInTheDocument();
    expect(screen.getByText('Finalny')).toBeInTheDocument();
  });

  it('CTA „Nowy raport" otwiera generator na kroku ŹRÓDŁA z realnymi projektami', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ResultsManagementReportsRegistry />
      </MemoryRouter>
    );

    expect(screen.queryByTestId('results-report-generator')).not.toBeInTheDocument();

    await user.click(await screen.findByText('Nowy raport'));

    const generator = await screen.findByTestId('results-report-generator');
    expect(generator).toBeInTheDocument();
    expect(screen.getByTestId('results-report-generator-step-source')).toHaveTextContent(
      '1. Źródło'
    );
    expect(screen.getByTestId('results-report-generator-step-type')).toHaveTextContent(
      '2. Typ raportu'
    );

    // Źródła bez generatora są widoczne i WYŁĄCZONE, z dosłownym powodem.
    const kpiSource = screen.getByTestId('results-report-source-kpi_scorecard');
    expect(kpiSource).toBeDisabled();
    expect(kpiSource).toHaveTextContent('Brak generatora dla tego źródła');

    // Źródło „Projekt" karmi się realnymi rekordami z /api/projects.
    await user.click(screen.getByTestId('results-report-source-project'));
    await waitFor(() => expect(apiGet).toHaveBeenCalledWith('/api/projects'));
    await waitFor(() =>
      expect(screen.getByRole('option', { name: 'Transformacja produkcji' })).toBeInTheDocument()
    );

    // Bez wybranego typu raportu generowanie jest niemożliwe.
    expect(screen.getByTestId('results-report-generator-submit')).toBeDisabled();
  });
});
