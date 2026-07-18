/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: any) => (typeof fallback === 'string' ? fallback : (fallback?.defaultValue ?? _key)),
    i18n: { language: 'en' },
  }),
}));

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: any) => <>{children}</>,
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
}));

vi.mock('../../../src/services/api', () => ({
  Api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock('../../../src/services/api/v8/finance', () => ({
  V8FinanceApi: {
    getInitiativeProposals: vi.fn(),
    createInitiativesFromAnalysis: vi.fn(),
  },
  shouldFallbackToLegacyFinance: (error: any) => {
    const status = Number(error?.status);
    return [400, 404, 405, 501].includes(status);
  },
}));

vi.mock('../../../src/services/financeExportService', () => ({
  exportFinancialAnalysis: vi.fn(),
}));

vi.mock('../../../src/services/funnelAnalytics', () => ({
  trackFunnelEvent: vi.fn(),
}));

import { ExportToOutputDialog } from '../../../src/components/Finance/ExportToOutputDialog';
import { Api } from '../../../src/services/api';
import { V8FinanceApi } from '../../../src/services/api/v8/finance';

describe('ExportToOutputDialog V8 proposals seam', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('prefers governed initiative proposals before legacy fallback', async () => {
    vi.mocked(V8FinanceApi.getInitiativeProposals).mockResolvedValue({
      proposals: [
        {
          id: 'proposal-1',
          title: 'Reduce overdue receivables',
          summary: 'Shorten DSO with collections sprint',
          kind: 'action',
          priority: 9,
        },
      ],
    } as any);

    render(
      <ExportToOutputDialog
        open
        onClose={vi.fn()}
        analysisId="analysis-1"
        analysisTitle="Working capital analysis"
        analysisType="financial"
        onExportComplete={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Initiatives/i }));

    await waitFor(() => {
      expect(screen.getByText('Reduce overdue receivables')).toBeInTheDocument();
    });

    expect(V8FinanceApi.getInitiativeProposals).toHaveBeenCalledWith('analysis-1');
    expect(Api.get).not.toHaveBeenCalledWith('/economics/financial-analyses/analysis-1/initiative-proposals');
  });

  it('falls back to legacy initiative proposals when V8 seam returns a bounded compatibility status', async () => {
    vi.mocked(V8FinanceApi.getInitiativeProposals).mockRejectedValue({ status: 404 });
    vi.mocked(Api.get).mockResolvedValue({
      proposals: [
        {
          id: 'proposal-legacy-1',
          title: 'Protect EBITDA',
          summary: 'Cut low-margin scope',
          kind: 'risk',
          priority: 7,
        },
      ],
    } as any);

    render(
      <ExportToOutputDialog
        open
        onClose={vi.fn()}
        analysisId="analysis-1"
        analysisTitle="Working capital analysis"
        analysisType="financial"
        onExportComplete={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Initiatives/i }));

    await waitFor(() => {
      expect(screen.getByText('Protect EBITDA')).toBeInTheDocument();
    });

    expect(Api.get).toHaveBeenCalledWith('/economics/financial-analyses/analysis-1/initiative-proposals');
  });

  it('prefers governed initiative creation before legacy fallback', async () => {
    const onClose = vi.fn();
    const onExportComplete = vi.fn();
    vi.mocked(V8FinanceApi.getInitiativeProposals).mockResolvedValue({
      proposals: [
        {
          id: 'proposal-1',
          title: 'Reduce overdue receivables',
          summary: 'Shorten DSO with collections sprint',
          kind: 'action',
          priority: 9,
        },
      ],
    } as any);
    vi.mocked(V8FinanceApi.createInitiativesFromAnalysis).mockResolvedValue({
      success: true,
      initiativeIds: ['initiative-1'],
    } as any);

    render(
      <ExportToOutputDialog
        open
        onClose={onClose}
        analysisId="analysis-1"
        analysisTitle="Working capital analysis"
        analysisType="financial"
        onExportComplete={onExportComplete}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Initiatives/i }));

    await waitFor(() => {
      expect(screen.getByText('Reduce overdue receivables')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Create Initiatives' }));

    await waitFor(() => {
      expect(V8FinanceApi.createInitiativesFromAnalysis).toHaveBeenCalledWith('analysis-1', {
        acceptedProposalIds: ['proposal-1'],
      });
    });

    expect(Api.post).not.toHaveBeenCalledWith('/economics/financial-analyses/analysis-1/initiatives', {
      acceptedProposalIds: ['proposal-1'],
    });
    expect(onExportComplete).toHaveBeenCalledWith(
      expect.objectContaining({ outputId: 'initiative-1' }),
    );
    expect(onClose).toHaveBeenCalled();
  });

  it('falls back to legacy initiative creation when V8 seam returns a bounded compatibility status', async () => {
    vi.mocked(V8FinanceApi.getInitiativeProposals).mockResolvedValue({
      proposals: [
        {
          id: 'proposal-1',
          title: 'Reduce overdue receivables',
          summary: 'Shorten DSO with collections sprint',
          kind: 'action',
          priority: 9,
        },
      ],
    } as any);
    vi.mocked(V8FinanceApi.createInitiativesFromAnalysis).mockRejectedValue({ status: 404 });
    vi.mocked(Api.post).mockResolvedValue({
      initiativeIds: ['initiative-legacy-1'],
    } as any);

    render(
      <ExportToOutputDialog
        open
        onClose={vi.fn()}
        analysisId="analysis-1"
        analysisTitle="Working capital analysis"
        analysisType="financial"
        onExportComplete={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Initiatives/i }));

    await waitFor(() => {
      expect(screen.getByText('Reduce overdue receivables')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Create Initiatives' }));

    await waitFor(() => {
      expect(Api.post).toHaveBeenCalledWith('/economics/financial-analyses/analysis-1/initiatives', {
        acceptedProposalIds: ['proposal-1'],
      });
    });
  });
});
