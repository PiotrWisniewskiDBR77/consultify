/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-hot-toast', () => ({
  default: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: any) => (typeof fallback === 'string' ? fallback : (fallback?.defaultValue ?? _key)),
    i18n: { language: 'en' },
  }),
}));

vi.mock('../../../src/services/api', () => ({
  Api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock('../../../src/services/api/v8/finance', () => ({
  V8FinanceApi: {
    getAnalyses: vi.fn(),
    getAnalysisRatios: vi.fn(),
    createAnalysis: vi.fn(),
  },
  shouldFallbackToLegacyFinance: (error: any) => {
    const status = Number(error?.status);
    return [400, 404, 405, 501].includes(status);
  },
}));

import { FinancialAnalysisWorkspace } from '../../../src/components/Benefits/FinancialAnalysisWorkspace';
import { Api } from '../../../src/services/api';
import { V8FinanceApi } from '../../../src/services/api/v8/finance';

describe('FinancialAnalysisWorkspace V8 read seam', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('prefers governed analyses and ratios before legacy fallback', async () => {
    vi.mocked(V8FinanceApi.getAnalyses).mockResolvedValue({
      analyses: [
        { id: 'analysis-1', title: 'Working capital analysis', status: 'DRAFT', currency: 'PLN' },
      ],
      count: 1,
    } as any);
    vi.mocked(V8FinanceApi.getAnalysisRatios).mockResolvedValue({
      ratios: [
        {
          id: 'ratio-1',
          ratio_code: 'current_ratio',
          ratio_name: 'Current ratio',
          value: 1.42,
          period: '2025-Q4',
        },
      ],
    } as any);

    render(<FinancialAnalysisWorkspace />);

    await waitFor(() => {
      expect(screen.getAllByText('Working capital analysis').length).toBeGreaterThan(0);
      expect(screen.getByText('Current ratio')).toBeInTheDocument();
    });

    expect(V8FinanceApi.getAnalyses).toHaveBeenCalled();
    expect(V8FinanceApi.getAnalysisRatios).toHaveBeenCalledWith('analysis-1');
    expect(Api.get).not.toHaveBeenCalledWith('/api/economics/financial-analyses');
    expect(Api.get).not.toHaveBeenCalledWith('/api/economics/financial-analyses/analysis-1/ratios');
  });

  it('falls back to legacy reads when governed workspace seams return bounded compatibility statuses', async () => {
    vi.mocked(V8FinanceApi.getAnalyses).mockRejectedValue({ status: 404 });
    vi.mocked(V8FinanceApi.getAnalysisRatios).mockRejectedValue({ status: 404 });
    vi.mocked(Api.get).mockImplementation(async (url: string) => {
      if (url === '/api/economics/financial-analyses') {
        return {
          analyses: [
            { id: 'analysis-legacy-1', title: 'Legacy analysis', status: 'DRAFT', currency: 'PLN' },
          ],
        } as any;
      }
      if (url === '/api/economics/financial-analyses/analysis-legacy-1/ratios') {
        return {
          ratios: [
            {
              id: 'ratio-legacy-1',
              ratio_code: 'quick_ratio',
              ratio_name: 'Quick ratio',
              value: 1.13,
              period: '2025-Q4',
            },
          ],
        } as any;
      }
      return {
        analyses: [
          { id: 'analysis-legacy-1', title: 'Legacy analysis', status: 'DRAFT', currency: 'PLN' },
        ],
      } as any;
    });

    render(<FinancialAnalysisWorkspace />);

    await waitFor(() => {
      expect(screen.getAllByText('Legacy analysis').length).toBeGreaterThan(0);
      expect(screen.getByText('Quick ratio')).toBeInTheDocument();
    });

    expect(Api.get).toHaveBeenCalledWith('/api/economics/financial-analyses');
    expect(Api.get).toHaveBeenCalledWith('/api/economics/financial-analyses/analysis-legacy-1/ratios');
  });

  it('uses governed analysis creation in the workspace', async () => {
    vi.mocked(V8FinanceApi.getAnalyses).mockResolvedValue({ analyses: [], count: 0 } as any);
    vi.mocked(V8FinanceApi.createAnalysis).mockResolvedValue({
      analysis: {
        id: 'analysis-created-1',
        title: 'Created analysis',
        status: 'DRAFT',
        currency: 'PLN',
      },
    } as any);

    render(<FinancialAnalysisWorkspace />);

    await waitFor(() => {
      expect(screen.getByText('No analyses yet')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTitle('New Financial Analysis'));
    fireEvent.change(screen.getByPlaceholderText('e.g., FY 2025 Financial Analysis'), {
      target: { value: 'Created analysis' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => {
      expect(V8FinanceApi.createAnalysis).toHaveBeenCalledWith({ title: 'Created analysis' });
    });
  });

  it('fails closed without reopening legacy analysis creation in the workspace', async () => {
    vi.mocked(V8FinanceApi.getAnalyses).mockResolvedValue({ analyses: [], count: 0 } as any);
    vi.mocked(V8FinanceApi.createAnalysis).mockRejectedValue({ status: 404 });

    render(<FinancialAnalysisWorkspace />);

    await waitFor(() => {
      expect(screen.getByText('No analyses yet')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTitle('New Financial Analysis'));
    fireEvent.change(screen.getByPlaceholderText('e.g., FY 2025 Financial Analysis'), {
      target: { value: 'Legacy created analysis' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => {
      expect(V8FinanceApi.createAnalysis).toHaveBeenCalledWith({
        title: 'Legacy created analysis',
      });
    });
    expect(Api.post).not.toHaveBeenCalledWith(
      '/api/economics/financial-analyses',
      expect.anything(),
    );
  });
});
