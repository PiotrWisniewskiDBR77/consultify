/**
 * @vitest-environment jsdom
 *
 * Smoke tests for ResultsKpiReportsView (Module 07 — Rezultaty).
 * Mocks the Results API + KPI runtime so the view mounts deterministically
 * offline. Asserts: the view mounts with no reports, and renders a report row
 * when the backend returns one. The heavy shared table is mocked to a simple
 * list so the assertions target this view's data wiring.
 */

import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, optsOrDefault?: any, opts?: any) => {
      const def = typeof optsOrDefault === 'string' ? optsOrDefault : optsOrDefault?.defaultValue;
      const interp = typeof optsOrDefault === 'object' ? optsOrDefault : opts;
      let out = def ?? k;
      if (interp && typeof out === 'string') {
        out = out.replace(/\{\{(\w+)\}\}/g, (_m, key) =>
          interp[key] != null ? String(interp[key]) : ''
        );
      }
      return out;
    },
    i18n: { language: 'en' },
  }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

vi.mock('react-hot-toast', () => {
  const fn = vi.fn();
  return { default: Object.assign(fn, { success: vi.fn(), error: vi.fn() }) };
});

const { apiGet } = vi.hoisted(() => ({ apiGet: vi.fn() }));

vi.mock('@/services/api', () => ({
  Api: {
    get: apiGet,
    post: vi.fn(async () => ({})),
  },
}));

vi.mock('@/services/api/v8/results', () => ({
  V8ResultsApi: {
    createKpiReport: vi.fn(async () => ({})),
    refreshKpiReport: vi.fn(async () => ({})),
  },
  shouldFallbackToLegacyResults: () => false,
}));

vi.mock('@/hooks/useOpenChatWithContext', () => ({
  useOpenChatWithContext: () => vi.fn(),
}));

vi.mock('../kpiRuntime', () => ({
  loadResultsKpis: vi.fn(async () => ({ kpis: [], mappings: [] })),
}));

vi.mock('../resultsShowcaseData', () => ({
  shouldUseResultsShowcaseData: () => false,
  createResultsShowcaseReports: () => [],
}));

// Mock the shared table to a simple list so the test targets this view's wiring.
vi.mock('../../shared/TableWithPreviewLayout', () => ({
  TableWithPreviewLayout: ({ itemIds, getItemById }: any) => (
    <div data-testid="reports-table">
      {(itemIds || []).map((id: string) => {
        const item = getItemById?.(id);
        return (
          <div key={id} data-testid="report-row">
            {item?.name ?? id}
          </div>
        );
      })}
    </div>
  ),
  default: () => null,
}));

import { ResultsKpiReportsView } from '../ResultsKpiReportsView';

const renderView = () =>
  render(
    <MemoryRouter>
      <ResultsKpiReportsView activeFilters={[]} onFilterChange={vi.fn()} />
    </MemoryRouter>
  );

describe('ResultsKpiReportsView smoke', () => {
  it('mounts and renders the table shell when there are no reports', async () => {
    apiGet.mockResolvedValue({ data: [] });
    renderView();
    await waitFor(() => {
      expect(screen.getByTestId('reports-table')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('report-row')).toBeNull();
  });

  it('renders a report row when the backend returns one report', async () => {
    apiGet.mockResolvedValue({
      data: [
        {
          reportId: 'rep-1',
          snapshotId: 'snap-1',
          title: 'Weekly rollout control pack',
          periodStart: '2026-02-01',
          periodEnd: '2026-02-28',
          status: 'DRAFT',
        },
      ],
    });
    renderView();
    await waitFor(() => {
      expect(screen.getByText('Weekly rollout control pack')).toBeInTheDocument();
    });
  });
});
