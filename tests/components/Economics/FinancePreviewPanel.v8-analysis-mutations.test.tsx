/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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
}));

vi.mock('@/components/shared/PreviewPane', () => ({
  PreviewActionBar: ({ rows }: any) => (
    <div>
      {rows.flatMap((row: any) => row.buttons).map((button: any) => (
        <button key={button.label} type="button" onClick={button.onClick}>
          {button.label}
        </button>
      ))}
    </div>
  ),
  PreviewAIHintStrip: () => <div>ai-hints</div>,
  PreviewDetailsSection: () => <div>details</div>,
  PreviewMetaCard: () => <div>meta</div>,
  PreviewRelations: ({ emptyLabel }: any) => <div>{emptyLabel || 'relations'}</div>,
}));

vi.mock('@/services/api', () => ({
  Api: {
    post: vi.fn(),
  },
}));

vi.mock('@/services/api/v8/finance', () => ({
  V8FinanceApi: {
    runAnalysis: vi.fn(),
    approveAnalysis: vi.fn(),
    approveModel: vi.fn(),
    computeModel: vi.fn(),
  },
  shouldFallbackToLegacyFinance: (error: any) => {
    const status = Number(error?.status);
    return [400, 404, 405, 501].includes(status);
  },
}));

vi.mock('@/services/api/financeV2.api', () => ({
  runCanonicalFinancialAnalysis: vi.fn(),
  approveCanonicalFinancialAnalysis: vi.fn(),
  resolveLegacyFinanceArtifact: vi.fn(),
  approveFinanceModel: vi.fn(),
}));

import { useFinancePreview } from '@/components/Economics/FinancePreviewPanel';
import { Api } from '@/services/api';
import {
  approveCanonicalFinancialAnalysis,
  approveFinanceModel,
  resolveLegacyFinanceArtifact,
  runCanonicalFinancialAnalysis,
} from '@/services/api/financeV2.api';
import { V8FinanceApi } from '@/services/api/v8/finance';

const previewParams = {
  statementPreviewDetail: null,
  statementPreviewRatios: null,
  modelPreviewDetail: null,
  predictionValidations: null,
  analysisPreviewRatios: [],
  budgetPreviewScenarios: null,
  valuationPreviewResults: null,
  valuationPreviewDetail: null,
  handleOpenFull: vi.fn(),
  handleExport: vi.fn(),
  handleCreateModelFromStatement: vi.fn(),
  handleCreateAnalysisFromStatements: vi.fn(),
  loadStatements: vi.fn(),
  loadModels: vi.fn(),
  loadAnalyses: vi.fn().mockResolvedValue(undefined),
  loadAnalysisPreviewRatios: vi.fn().mockResolvedValue(undefined),
  loadBudgets: vi.fn(),
  loadBudgetPreviewScenarios: vi.fn(),
  loadPredictionPreview: vi.fn(),
  loadValuations: vi.fn(),
  loadValuationPreviewResults: vi.fn(),
  getBudgetRawId: vi.fn((id: string) => id),
};

const analysisRow = {
  id: 'analysis-1',
  kind: 'analysis',
  title: 'Working capital analysis',
  status: 'DRAFT',
  analysisType: 'financial',
  updatedAt: '2026-03-26T10:00:00.000Z',
} as any;

const predictionRow = {
  id: 'model-1',
  kind: 'prediction',
  title: 'Revenue forecast',
  status: 'DRAFT',
  predictionType: 'model',
  updatedAt: '2026-03-26T10:00:00.000Z',
} as any;

const modelRow = {
  id: 'model-1',
  kind: 'models',
  title: 'Revenue forecast',
  status: 'DRAFT',
  updatedAt: '2026-03-26T10:00:00.000Z',
} as any;

const canonicalValuationRow = {
  id: 'valuation-1',
  kind: 'valuation',
  title: 'Canonical DCF valuation',
  status: 'APPROVED',
  updatedAt: '2026-08-21T10:00:00.000Z',
  sourceType: 'manual',
  canonicalArtifactId: 'artifact-1',
  canonicalBusinessVersionId: 'version-1',
  canonicalArtifactType: 'VALUATION_CASE',
} as any;

function FooterHarness() {
  const { renderPreviewFooter } = useFinancePreview(previewParams as any);
  return <>{renderPreviewFooter(analysisRow)}</>;
}

function PredictionFooterHarness() {
  const { renderPreviewFooter } = useFinancePreview(previewParams as any);
  return <>{renderPreviewFooter(predictionRow)}</>;
}

function ModelFooterHarness() {
  const { renderPreviewFooter } = useFinancePreview(previewParams as any);
  return <>{renderPreviewFooter(modelRow)}</>;
}

function CanonicalValuationPreviewHarness() {
  const { renderPreviewBody, renderPreviewFooter } = useFinancePreview(previewParams as any);
  return (
    <>
      {renderPreviewBody(canonicalValuationRow)}
      {renderPreviewFooter(canonicalValuationRow)}
    </>
  );
}

describe('FinancePreviewPanel V8 analysis mutations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses only canonical preview run and approval actions', async () => {
    vi.mocked(runCanonicalFinancialAnalysis).mockResolvedValue({ results: [] } as any);
    vi.mocked(approveCanonicalFinancialAnalysis).mockResolvedValue({ success: true } as any);

    render(<FooterHarness />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Przelicz ponownie' }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Zatwierdź' }));
    });

    await waitFor(() => {
      expect(runCanonicalFinancialAnalysis).toHaveBeenCalledWith('analysis-1');
      expect(approveCanonicalFinancialAnalysis).toHaveBeenCalledWith('analysis-1');
    });

    expect(Api.post).not.toHaveBeenCalledWith('/api/economics/financial-analyses/analysis-1/run', {});
    expect(Api.post).not.toHaveBeenCalledWith('/api/economics/financial-analyses/analysis-1/approve', {});
  });

  it('fails closed when canonical preview identity is unavailable', async () => {
    vi.mocked(runCanonicalFinancialAnalysis).mockRejectedValue({ code: 'LEGACY_IDENTITY_QUARANTINED' });
    vi.mocked(approveCanonicalFinancialAnalysis).mockRejectedValue({ code: 'LEGACY_IDENTITY_QUARANTINED' });

    render(<FooterHarness />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Przelicz ponownie' }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Zatwierdź' }));
    });

    await waitFor(() => expect(runCanonicalFinancialAnalysis).toHaveBeenCalled());
    expect(Api.post).not.toHaveBeenCalledWith('/api/economics/financial-analyses/analysis-1/run', {});
    expect(Api.post).not.toHaveBeenCalledWith('/api/economics/financial-analyses/analysis-1/approve', {});
  });

  it('prefers governed preview compute action before legacy fallback', async () => {
    vi.mocked(V8FinanceApi.computeModel).mockResolvedValue({ success: true } as any);

    render(<PredictionFooterHarness />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Przelicz' }));
    });

    await waitFor(() => {
      expect(V8FinanceApi.computeModel).toHaveBeenCalledWith('model-1');
      expect(previewParams.loadPredictionPreview).toHaveBeenCalledWith('model-1');
    });

    expect(Api.post).not.toHaveBeenCalledWith('/api/financial-modeling/models/model-1/compute', {});
  });

  it('falls back to legacy preview compute action on bounded compatibility statuses', async () => {
    vi.mocked(V8FinanceApi.computeModel).mockRejectedValue({ status: 404 });
    vi.mocked(Api.post).mockResolvedValue({ success: true } as any);

    render(<PredictionFooterHarness />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Przelicz' }));
    });

    await waitFor(() => {
      expect(Api.post).toHaveBeenCalledWith('/api/financial-modeling/models/model-1/compute', {});
      expect(previewParams.loadPredictionPreview).toHaveBeenCalledWith('model-1');
    });
  });

  it('uses the canonical identity bridge for model approval', async () => {
    vi.mocked(resolveLegacyFinanceArtifact).mockResolvedValue({
      status: 'RESOLVED',
      artifactId: 'canonical-model-1',
    } as any);
    vi.mocked(approveFinanceModel).mockResolvedValue({ success: true } as any);

    render(<ModelFooterHarness />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Zatwierdź' }));
    });

    await waitFor(() => {
      expect(resolveLegacyFinanceArtifact).toHaveBeenCalledWith('financial_models', 'model-1');
      expect(approveFinanceModel).toHaveBeenCalledWith({
        modelArtifactId: 'canonical-model-1',
        idempotencyKey: expect.any(String),
      });
      expect(previewParams.loadModels).toHaveBeenCalled();
    });

    expect(V8FinanceApi.approveModel).not.toHaveBeenCalled();
    expect(Api.post).not.toHaveBeenCalled();
  });

  it('fails closed when a model has no canonical identity', async () => {
    vi.mocked(resolveLegacyFinanceArtifact).mockResolvedValue({ status: 'MISSING' } as any);

    render(<ModelFooterHarness />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Zatwierdź' }));
    });

    await waitFor(() => expect(resolveLegacyFinanceArtifact).toHaveBeenCalled());
    expect(approveFinanceModel).not.toHaveBeenCalled();
    expect(previewParams.loadModels).not.toHaveBeenCalled();
    expect(Api.post).not.toHaveBeenCalled();
  });

  it('does not describe a computed canonical valuation as uncomputed or unrelated', () => {
    render(<CanonicalValuationPreviewHarness />);

    expect(screen.getByText('Computed canonical result')).toBeInTheDocument();
    expect(
      screen.getByText('Open the workspace to inspect the verified result and its source lineage.')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Verified lineage is available in the canonical workspace')
    ).toBeInTheDocument();
    expect(screen.queryByText('Not computed yet — click "Compute DCF"')).toBeNull();
    expect(screen.queryByText('No relations')).toBeNull();
  });
});
