/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const financeDataState = vi.hoisted(() => ({
  statements: [] as any[],
  models: [] as any[],
  analyses: [] as any[],
  valuations: [] as any[],
  budgets: [] as any[],
  loadStatements: vi.fn().mockResolvedValue(undefined),
  loadModels: vi.fn().mockResolvedValue(undefined),
  loadAnalyses: vi.fn().mockResolvedValue(undefined),
  loadValuations: vi.fn().mockResolvedValue(undefined),
  loadBudgets: vi.fn().mockResolvedValue(undefined),
  rowsForActiveTab: [] as any[],
  filteredRows: [] as any[],
  statusCounts: { all: 0, draft: 0, review: 0, approved: 0 },
  lastActiveTab: '' as string,
  lastSearchQuery: '' as string,
}));

const financeLaneState = vi.hoisted(() => ({
  startRun: vi.fn(),
  advanceStep: vi.fn(),
  refreshLane: vi.fn(),
  refreshCoherence: vi.fn(),
}));

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: any) => (typeof fallback === 'string' ? fallback : (fallback?.defaultValue ?? _key)),
    i18n: { language: 'en' },
  }),
  initReactI18next: {
    type: '3rdParty',
    init: () => {},
  },
}));

vi.mock('../../../src/components/shared/ModuleHub', () => ({
  ModuleHub: ({ tabs, activeTab, onTabChange, primaryCta, commandRowContent, children }: any) => (
    <div>
      <div data-testid="active-tab">{activeTab}</div>
      <div>
        {tabs.map((tab: any) => (
          <button key={tab.id} type="button" onClick={() => onTabChange(tab.id)}>
            {tab.label}
          </button>
        ))}
      </div>
      <div data-testid="primary-cta">{primaryCta}</div>
      <div data-testid="command-row">{commandRowContent}</div>
      <div>{children}</div>
    </div>
  ),
  FilterableTable: () => <div>filterable-table</div>,
  GridView: () => <div>grid-view</div>,
}));

vi.mock('../../../src/components/shared/TableWithPreviewLayout', () => ({
  TableWithPreviewLayout: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('../../../src/components/Economics/hooks/useFinanceData', () => ({
  useFinanceData: (activeTab: string, searchQuery: string) => {
    financeDataState.lastActiveTab = activeTab;
    financeDataState.lastSearchQuery = searchQuery;
    return {
      statements: financeDataState.statements,
      models: financeDataState.models,
      analyses: financeDataState.analyses,
      valuations: financeDataState.valuations,
      budgets: financeDataState.budgets,
      loadingTab: false,
      loadError: null,
      loadStatements: financeDataState.loadStatements,
      loadModels: financeDataState.loadModels,
      loadAnalyses: financeDataState.loadAnalyses,
      loadValuations: financeDataState.loadValuations,
      loadBudgets: financeDataState.loadBudgets,
      rowsForActiveTab: financeDataState.rowsForActiveTab,
      filteredRows: financeDataState.filteredRows,
      statusCounts: financeDataState.statusCounts,
    };
  },
}));

vi.mock('../../../src/components/Economics/hooks/useFinanceSelection', () => ({
  useFinanceSelection: () => ({
    selectedId: null,
    selectedItem: null,
    statementPreviewDetail: null,
    statementPreviewRatios: [],
    modelPreviewDetail: null,
    predictionValidations: [],
    analysisPreviewRatios: [],
    budgetPreviewScenarios: [],
    valuationPreviewResults: [],
    valuationPreviewDetail: null,
    getBudgetRawId: vi.fn(),
    loadModelPreview: vi.fn().mockResolvedValue(undefined),
    loadPredictionPreview: vi.fn().mockResolvedValue(undefined),
    loadBudgetPreviewScenarios: vi.fn().mockResolvedValue(undefined),
    loadAnalysisPreviewRatios: vi.fn().mockResolvedValue(undefined),
    loadValuationPreviewResults: vi.fn().mockResolvedValue(undefined),
    onSelectRow: vi.fn(),
    deselectRow: vi.fn(),
  }),
}));

vi.mock('../../../src/components/Economics/hooks/useFinanceRowActions', () => ({
  useFinanceRowActions: () => ({
    getRowActions: () => [],
  }),
}));

vi.mock('../../../src/components/Economics/FinancePreviewPanel', () => ({
  useFinancePreview: () => ({
    renderPreviewBody: () => <div>finance-preview-body</div>,
    renderPreviewFooter: () => <div>finance-preview-footer</div>,
  }),
}));

vi.mock('../../../src/components/Economics/hooks/useFinanceLane', () => ({
  useFinanceLane: () => ({
    activeLaneRun: null,
    laneHistory: [],
    mutationAudits: [],
    kpiCoherence: null,
    versionSnapshots: [],
    degradedAlerts: [],
    isRunInProgress: false,
    loading: false,
    error: null,
    startRun: financeLaneState.startRun,
    advanceStep: financeLaneState.advanceStep,
    refreshLane: financeLaneState.refreshLane,
    refreshCoherence: financeLaneState.refreshCoherence,
  }),
}));

vi.mock('../../../src/hooks/useV8FeatureFlag', () => ({
  useV8FeatureFlag: () => ({
    isEnabled: true,
    isLoading: false,
    error: null,
    flags: { finance: true },
  }),
}));

vi.mock('../../../src/components/Benefits/BudgetWorkspace', () => ({
  BudgetWorkspace: () => <div>budget-workspace</div>,
}));
vi.mock('../../../src/components/Benefits/FinancialAnalysisWorkspace', () => ({
  FinancialAnalysisWorkspace: () => <div>analysis-workspace</div>,
}));
vi.mock('../../../src/components/Benefits/ValuationWorkspace', () => ({
  ValuationWorkspace: () => <div>valuation-workspace</div>,
}));
vi.mock('../../../src/components/Finance/ExportToOutputDialog', () => ({
  ExportToOutputDialog: () => null,
}));
vi.mock('../../../src/components/Finance/FinancialStatementImportWizard', () => ({
  FinancialStatementImportWizard: ({ onComplete }: any) => (
    <button type="button" onClick={() => onComplete?.('statement-1')}>
      complete-import
    </button>
  ),
}));
vi.mock('../../../src/components/Finance/FinancialModelWorkspace', () => ({
  FinancialModelWorkspace: () => <div>financial-model-workspace</div>,
}));
vi.mock('../../../src/components/Economics/modals/CreateAnalysisModal', () => ({
  CreateAnalysisModal: () => null,
}));
vi.mock('../../../src/components/Economics/modals/CreateBudgetModal', () => ({
  CreateBudgetModal: () => null,
}));
vi.mock('../../../src/components/Economics/modals/CreateModelModal', () => ({
  CreateModelModal: () => null,
}));
vi.mock('../../../src/components/Economics/modals/CreateValuationModal', () => ({
  CreateValuationModal: () => null,
}));

vi.mock('../../../src/contexts/AccessPolicyContext', () => ({
  usePolicySnapshot: () => ({
    isFeatureBlocked: () => false,
  }),
}));

vi.mock('../../../src/services/api/v8/finance', () => ({
  V8FinanceApi: {
    getDashboard: vi.fn(),
    getStatementPacks: vi.fn(),
    getStatement: vi.fn(),
  },
  shouldFallbackToLegacyFinance: (error: any) => {
    const status = Number(error?.status);
    return [400, 404, 405, 501].includes(status);
  },
}));

vi.mock('../../../src/services/api', () => ({
  Api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import { FinanceHub } from '../../../src/components/Economics/FinanceHub';
import { Api } from '../../../src/services/api';
import { V8FinanceApi } from '../../../src/services/api/v8/finance';

const LocationProbe = () => {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
};

function renderWithProviders(children: React.ReactNode, initialEntries = ['/']) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe('FinanceHub V8 runtime strip', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockReset();
    financeDataState.statements = [];
    financeDataState.models = [];
    financeDataState.analyses = [];
    financeDataState.valuations = [];
    financeDataState.budgets = [];
    financeDataState.rowsForActiveTab = [];
    financeDataState.filteredRows = [];
    financeDataState.statusCounts = { all: 0, draft: 0, review: 0, approved: 0 };
    financeDataState.lastActiveTab = '';
    financeDataState.lastSearchQuery = '';
    financeDataState.loadStatements.mockResolvedValue(undefined);
    financeDataState.loadModels.mockResolvedValue(undefined);
    financeDataState.loadAnalyses.mockResolvedValue(undefined);
    financeDataState.loadValuations.mockResolvedValue(undefined);
    financeDataState.loadBudgets.mockResolvedValue(undefined);

    vi.mocked(V8FinanceApi.getDashboard).mockResolvedValue({
      dashboard: {
        ingestionPipeline: {
          totalCount: 8,
          byState: { ready: 5, review_required: 3 },
          confidenceBands: { high: 4, medium: 2, low: 1, unknown: 1 },
          averageConfidence: 0.82,
        },
        linkageHealth: {
          totalLinkages: 11,
          byLinkageType: { initiative: 6, statement_pack: 5 },
          unlinkedInitiativesCount: 2,
        },
        unresolvedEscalationsCount: 3,
        staleSourceRefreshesCount: 1,
        promotionGatePassRate: 0.75,
      },
    } as any);
    vi.mocked(V8FinanceApi.getStatementPacks).mockResolvedValue({
      statementPacks: [],
      count: 0,
    } as any);
    vi.mocked(V8FinanceApi.getStatement).mockResolvedValue({
      statement: { statement_pack_id: 'pack-1' },
    } as any);
  });

  it('shows governed runtime pills and keeps them after switching tabs', async () => {
    renderWithProviders(<FinanceHub />);

    await waitFor(() => {
      expect(V8FinanceApi.getDashboard).toHaveBeenCalled();
      expect(screen.getByText('V8 Ingestion')).toBeInTheDocument();
    });

    expect(screen.getByText('Escalations')).toBeInTheDocument();
    expect(screen.getByText('Linkages')).toBeInTheDocument();
    expect(screen.getByText('Gate pass')).toBeInTheDocument();
    expect(screen.getByText('75%')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Prediction' }));

    await waitFor(() => {
      expect(screen.getByTestId('active-tab')).toHaveTextContent('prediction');
    });

    expect(screen.getByText('V8 Ingestion')).toBeInTheDocument();
    expect(screen.getByText('Linkages')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Enterprise valuation' }));

    await waitFor(() => {
      expect(screen.getByTestId('active-tab')).toHaveTextContent('valuation');
    });

    expect(screen.getByText('Escalations')).toBeInTheDocument();
    expect(screen.getByText('75%')).toBeInTheDocument();
  });

  it('keeps the finance runtime strip visible with unavailable markers when the dashboard fails', async () => {
    vi.mocked(V8FinanceApi.getDashboard).mockRejectedValue(new Error('dashboard down'));

    renderWithProviders(<FinanceHub />);

    await waitFor(() => {
      expect(V8FinanceApi.getDashboard).toHaveBeenCalled();
      expect(screen.getByText('V8 Ingestion')).toBeInTheDocument();
    });

    expect(screen.getByText('Escalations')).toBeInTheDocument();
    expect(screen.getByText('Linkages')).toBeInTheDocument();
    expect(screen.getByText('Gate pass')).toBeInTheDocument();
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(4);
  });

  it('routes import-complete statement-pack lookup through the governed V8 seam first', async () => {
    financeDataState.statements = [
      {
        id: 'pack-1',
        entity_name: 'Acme Sp. z o.o.',
        period_start: '2026-01-01',
        period_end: '2026-03-31',
        period_label: 'Q1 2026',
        currency: 'PLN',
        scaling: 'units',
        pack_status: 'pending',
        pack_readiness_status: 'recoverable',
        source_statement_count: 2,
        updated_at: '2026-03-27T12:00:00.000Z',
      },
    ];
    vi.mocked(V8FinanceApi.getStatementPacks).mockResolvedValue({
      statementPacks: financeDataState.statements,
      count: 1,
    } as any);

    renderWithProviders(<FinanceHub />);

    fireEvent.click(screen.getByRole('button', { name: 'Statements' }));
    fireEvent.click(screen.getByRole('button', { name: 'Import statement' }));
    fireEvent.click(screen.getByRole('button', { name: 'complete-import' }));

    await waitFor(() => {
      expect(V8FinanceApi.getStatementPacks).toHaveBeenCalled();
    });

    expect(V8FinanceApi.getStatement).toHaveBeenCalledWith('statement-1');
    expect(V8FinanceApi.getDashboard).toHaveBeenCalledTimes(2);
    expect(Api.get).not.toHaveBeenCalledWith('/api/finance-statements/statement-1');
    expect(Api.get).not.toHaveBeenCalledWith('/api/finance-statements/packs');
    expect(financeDataState.loadStatements).toHaveBeenCalled();
  });

  it('falls back to legacy child statement detail during import-complete on bounded compatibility statuses', async () => {
    financeDataState.statements = [
      {
        id: 'pack-1',
        entity_name: 'Acme Sp. z o.o.',
        period_start: '2026-01-01',
        period_end: '2026-03-31',
        period_label: 'Q1 2026',
        currency: 'PLN',
        scaling: 'units',
        pack_status: 'pending',
        pack_readiness_status: 'recoverable',
        source_statement_count: 2,
        updated_at: '2026-03-27T12:00:00.000Z',
      },
    ];
    vi.mocked(V8FinanceApi.getStatement).mockRejectedValue({ status: 404 });
    vi.mocked(Api.get).mockImplementation(async (url: string) => {
      if (url === '/api/finance-statements/statement-1') {
        return { statement_pack_id: 'pack-1' } as any;
      }
      throw new Error(`Unexpected GET ${url}`);
    });
    vi.mocked(V8FinanceApi.getStatementPacks).mockResolvedValue({
      statementPacks: financeDataState.statements,
      count: 1,
    } as any);

    renderWithProviders(<FinanceHub />);

    fireEvent.click(screen.getByRole('button', { name: 'Statements' }));
    fireEvent.click(screen.getByRole('button', { name: 'Import statement' }));
    fireEvent.click(screen.getByRole('button', { name: 'complete-import' }));

    await waitFor(() => {
      expect(V8FinanceApi.getStatementPacks).toHaveBeenCalled();
    });

    expect(V8FinanceApi.getStatement).toHaveBeenCalledWith('statement-1');
    expect(Api.get).toHaveBeenCalledWith('/api/finance-statements/statement-1');
  });

  it('canonicalizes economics deep links to finance and preserves valuation context', async () => {
    renderWithProviders(
      <FinanceHub />,
      ['/economics?tab=valuation&initiativeId=init-1&initiativeName=Initiative%20Alpha']
    );

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(
        expect.objectContaining({
          pathname: expect.stringMatching(/finance/),
          search: expect.stringContaining('tab=valuation'),
        }),
        expect.objectContaining({ replace: true })
      );
      expect(screen.getByTestId('active-tab')).toHaveTextContent('valuation');
    });

    expect(financeDataState.lastSearchQuery).toBe('Initiative Alpha');
  });

  it('syncs the active finance tab back into the url', async () => {
    renderWithProviders(
      <>
        <LocationProbe />
        <FinanceHub />
      </>,
      ['/finance?tab=statements']
    );

    fireEvent.click(screen.getByRole('button', { name: 'Prediction' }));

    await waitFor(() => {
      expect(screen.getByTestId('active-tab')).toHaveTextContent('prediction');
      expect(screen.getByTestId('location')).toHaveTextContent('/finance?tab=prediction');
    });
  });
});
