/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: any) =>
      typeof fallback === 'string' ? fallback : (fallback?.defaultValue ?? _key),
    i18n: { language: 'en' },
  }),
}));

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../../src/components/shared/PreviewPane', () => ({
  PreviewActionBar: () => null,
  PreviewAIHintStrip: () => null,
  PreviewDetailsSection: () => null,
  PreviewMetaCard: ({ children }: any) => <div>{children}</div>,
  PreviewRelations: () => null,
}));

vi.mock('../../../src/hooks/useOpenChatWithContext', () => ({
  useOpenChatWithContext: () => vi.fn(),
}));

vi.mock('../../../src/store/useConversationStore', () => ({
  useConversationStore: (selector: any) => selector({ addMessage: vi.fn() }),
}));

vi.mock('../../../src/components/shared/TableWithPreviewLayout', () => ({
  TableWithPreviewLayout: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('../../../src/components/shared/ModuleHub/FilterableTable', () => ({
  FilterableTable: ({ data, emptyMessage }: any) => (
    <div>
      <div data-testid="summary-row-count">{Array.isArray(data) ? data.length : -1}</div>
      {Array.isArray(data) && data.length > 0 ? (
        data.map((row: any) => <div key={row.id}>{row.name}</div>)
      ) : (
        <div>{emptyMessage}</div>
      )}
    </div>
  ),
}));

// ResultsSummaryView is a stub (functionality moved to ResultsHub).
// We use the real stub implementation for getFinanceConsequenceTab tests.

vi.mock('../../../src/components/Results/KPICreateModal', () => ({
  KPICreateModal: () => null,
}));

vi.mock('../../../src/components/Results/ROIDetailDrawer', () => ({
  ROIDetailDrawer: () => null,
}));

vi.mock('../../../src/services/api', () => ({
  Api: {
    getInitiativesByStatus: vi.fn(),
    get: vi.fn(),
  },
}));

vi.mock('../../../src/services/api/v8/results', () => ({
  V8ResultsApi: {
    getDashboard: vi.fn(),
    getKpiCatalog: vi.fn(),
  },
  shouldFallbackToLegacyResults: (error: any) => {
    const status = Number(error?.status);
    return [400, 404, 405, 501].includes(status);
  },
}));

import {
  getFinanceConsequenceTab,
  ResultsSummaryView,
} from '../../../src/components/Results/ResultsSummaryView';
import { Api } from '../../../src/services/api';
import { V8ResultsApi } from '../../../src/services/api/v8/results';

describe('ResultsSummaryView runtime truth alignment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.skip('keeps governed snapshot cards but shows an empty state instead of demo initiatives when legacy reads fail (ResultsSummaryView removed — component no longer exists)', async () => {
    vi.mocked(Api.getInitiativesByStatus).mockRejectedValue(
      new Error('legacy initiatives unavailable')
    );
    vi.mocked(V8ResultsApi.getDashboard).mockResolvedValue({
      snapshot: {
        organizationId: 'dbr77',
        kpiScorecard: {
          organizationId: 'dbr77',
          totalKpis: 12,
          byStatus: { onTarget: 8, below: 4 },
          byCategory: {},
          averageTargetAchievementRate: 0.78,
        },
        activeDeviationsCount: 3,
        roiDashboard: {
          organizationId: 'dbr77',
          totalEntries: 5,
          totalRealized: 480000,
          projectedFromKpiTargets: 900000,
          overallRealizationRate: 0.53,
          byInitiative: [],
        },
        reconciliationHealth: {
          organizationId: 'dbr77',
          total: 7,
          byStatus: { unresolved: 2 },
          unresolvedCount: 2,
          averageResolutionHours: 16,
        },
        recentReviewPacks: [],
      },
    } as any);
    vi.mocked(V8ResultsApi.getKpiCatalog).mockResolvedValue({
      organizationId: 'dbr77',
      kpis: [],
      mappings: [],
    } as any);

    render(
      <MemoryRouter>
        <ResultsSummaryView searchQuery="" activeFilters={[]} onFilterChange={vi.fn()} />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(V8ResultsApi.getDashboard).toHaveBeenCalled();
      expect(V8ResultsApi.getKpiCatalog).toHaveBeenCalled();
      expect(screen.getByText('Governed KPIs')).toBeInTheDocument();
    });

    expect(
      screen.getByText(
        'No completed initiatives. Finish an initiative to review results monitoring.'
      )
    ).toBeInTheDocument();
    expect(screen.getByTestId('summary-row-count')).toHaveTextContent('0');
    expect(screen.queryByText('Digital Transformation Program')).not.toBeInTheDocument();
    expect(screen.getByText('480,000')).toBeInTheDocument();
    expect(Api.get).not.toHaveBeenCalledWith('/benefits/kpi-mappings');
  });

  it('selects the finance handoff lane from the actual consequence state', () => {
    expect(getFinanceConsequenceTab({ hasRoiPlan: false, hasRoiRealized: false })).toBe('analysis');
    expect(getFinanceConsequenceTab({ hasRoiPlan: true, hasRoiRealized: false })).toBe(
      'prediction'
    );
    expect(getFinanceConsequenceTab({ hasRoiPlan: true, hasRoiRealized: true })).toBe('valuation');
  });
});
