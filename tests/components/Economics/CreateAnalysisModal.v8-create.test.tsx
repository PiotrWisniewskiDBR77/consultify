/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

vi.mock('@/services/api', () => ({
  Api: {
    post: vi.fn(),
  },
}));

vi.mock('@/services/api/v8/finance', () => ({
  V8FinanceApi: {
    createAnalysis: vi.fn(),
  },
  shouldFallbackToLegacyFinance: (error: any) => {
    const status = Number(error?.status);
    return [400, 404, 405, 501].includes(status);
  },
}));

import { CreateAnalysisModal } from '@/components/Economics/modals/CreateAnalysisModal';
import { Api } from '@/services/api';
import { V8FinanceApi } from '@/services/api/v8/finance';

const statements = [
  {
    id: 'pack-1',
    entityName: 'Atelier',
    title: 'Atelier FY25',
    currency: 'PLN',
    periodLabel: 'FY 2025',
    completenessLabel: 'P&L / BS / CF',
    statementIds: ['statement-1'],
  },
] as any;

describe('CreateAnalysisModal V8 create seam', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses governed analysis creation', async () => {
    const onCreated = vi.fn();
    vi.mocked(V8FinanceApi.createAnalysis).mockResolvedValue({
      analysis: {
        id: 'analysis-1',
        title: 'Created analysis',
        status: 'DRAFT',
        analysisType: 'comprehensive',
        periods: [],
        currency: 'PLN',
        sourceStatementIds: ['statement-1'],
        sourceStatementPackId: 'pack-1',
        updatedAt: '2026-03-26T10:00:00.000Z',
      },
    } as any);

    render(
      <CreateAnalysisModal
        onCreated={onCreated}
        onClose={vi.fn()}
        availableStatements={statements}
        initialTitle="Created analysis"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Atelier/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => {
      expect(V8FinanceApi.createAnalysis).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Created analysis',
          sourceStatementPackId: 'pack-1',
        }),
      );
    });

    expect(Api.post).not.toHaveBeenCalledWith('/api/economics/financial-analyses', expect.anything());
    expect(onCreated).toHaveBeenCalled();
  });

  it('fails closed without reopening legacy analysis creation', async () => {
    const onCreated = vi.fn();
    vi.mocked(V8FinanceApi.createAnalysis).mockRejectedValue({ status: 404 });

    render(
      <CreateAnalysisModal
        onCreated={onCreated}
        onClose={vi.fn()}
        availableStatements={statements}
        initialTitle="Legacy analysis"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Atelier/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => {
      expect(V8FinanceApi.createAnalysis).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Legacy analysis', sourceStatementPackId: 'pack-1' }),
      );
    });
    expect(Api.post).not.toHaveBeenCalledWith(
      '/api/economics/financial-analyses',
      expect.anything(),
    );
    expect(onCreated).not.toHaveBeenCalled();
  });
});
