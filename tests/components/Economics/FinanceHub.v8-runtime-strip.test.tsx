/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback || _key,
    i18n: { language: 'en' },
  }),
  initReactI18next: {
    type: '3rdParty',
    init: () => {},
  },
}));

vi.mock('../../../src/components/shared/ModuleHub', () => ({
  ModuleHub: ({ tabs, activeTab, onTabChange, commandRowContent, children }: any) => (
    <div>
      <div data-testid="active-tab">{activeTab}</div>
      <div>
        {tabs.map((tab: any) => (
          <button key={tab.id} type="button" onClick={() => onTabChange(tab.id)}>
            {tab.label}
          </button>
        ))}
      </div>
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
  useFinanceData: () => ({
    statements: [],
    models: [],
    analyses: [],
    valuations: [],
    budgets: [],
    loadingTab: false,
    loadError: null,
    loadStatements: vi.fn().mockResolvedValue(undefined),
    loadModels: vi.fn().mockResolvedValue(undefined),
    loadAnalyses: vi.fn().mockResolvedValue(undefined),
    loadValuations: vi.fn().mockResolvedValue(undefined),
    loadBudgets: vi.fn().mockResolvedValue(undefined),
    rowsForActiveTab: [],
    filteredRows: [],
    statusCounts: { all: 0, draft: 0, review: 0, approved: 0 },
  }),
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
  FinancialStatementImportWizard: () => null,
}));
vi.mock('../../../src/components/Economics/FinanceModelDocumentView', () => ({
  FinanceModelDocumentView: () => <div>finance-model-document-view</div>,
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

vi.mock('../../../src/services/api/v8/finance', () => ({
  V8FinanceApi: {
    getDashboard: vi.fn(),
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
import { V8FinanceApi } from '../../../src/services/api/v8/finance';

describe('FinanceHub V8 runtime strip', () => {
  beforeEach(() => {
    vi.clearAllMocks();

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
  });

  it('shows governed runtime pills and keeps them after switching tabs', async () => {
    render(
      <MemoryRouter>
        <FinanceHub />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(V8FinanceApi.getDashboard).toHaveBeenCalled();
      expect(screen.getByText('V8 Ingestion')).toBeInTheDocument();
    });

    expect(screen.getByText('Escalations')).toBeInTheDocument();
    expect(screen.getByText('Linkages')).toBeInTheDocument();
    expect(screen.getByText('Gate pass')).toBeInTheDocument();
    expect(screen.getByText('75%')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Predykcja' }));

    await waitFor(() => {
      expect(screen.getByTestId('active-tab')).toHaveTextContent('prediction');
    });

    expect(screen.getByText('V8 Ingestion')).toBeInTheDocument();
    expect(screen.getByText('Linkages')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Wycena przedsiębiorstw' }));

    await waitFor(() => {
      expect(screen.getByTestId('active-tab')).toHaveTextContent('valuation');
    });

    expect(screen.getByText('Escalations')).toBeInTheDocument();
    expect(screen.getByText('75%')).toBeInTheDocument();
  });
});
