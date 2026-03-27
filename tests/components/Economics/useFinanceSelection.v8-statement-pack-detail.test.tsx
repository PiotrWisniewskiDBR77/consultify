/**
 * @vitest-environment jsdom
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/api', () => ({
  Api: {
    get: vi.fn(),
  },
}));

vi.mock('@/services/api/v8/finance', () => ({
  V8FinanceApi: {
    getStatementPack: vi.fn(),
  },
  shouldFallbackToLegacyFinance: (error: any) => {
    const status = Number(error?.status);
    return [400, 404, 405, 501].includes(status);
  },
}));

import { useFinanceSelection } from '@/components/Economics/hooks/useFinanceSelection';
import { Api } from '@/services/api';
import { V8FinanceApi } from '@/services/api/v8/finance';

describe('useFinanceSelection V8 statement-pack detail seam', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('prefers governed statement-pack detail before legacy fallback for statement preview', async () => {
    vi.mocked(V8FinanceApi.getStatementPack).mockResolvedValue({
      pack: {
        id: 'pack-1',
        entity_name: 'Acme Sp. z o.o.',
        period_label: 'Q1 2026',
        period_start: '2026-01-01',
        period_end: '2026-03-31',
        currency: 'PLN',
        scaling: 'units',
        pack_status: 'pending',
        pack_readiness_status: 'recoverable',
        source_statement_count: 1,
        statements: [
          {
            id: 'statement-1',
            statement_type: 'P&L',
            status: 'draft',
            readiness_status: 'recoverable',
            validation_status: 'pending',
            source_file_name: 'acme-q1.csv',
          },
        ],
        validations: [],
      },
    } as any);

    const { result } = renderHook(() => useFinanceSelection('statements'));

    await act(async () => {
      await result.current.loadStatementPreview('pack-1');
    });

    await waitFor(() => {
      expect(result.current.statementPreviewDetail?.entityName).toBe('Acme Sp. z o.o.');
    });

    expect(V8FinanceApi.getStatementPack).toHaveBeenCalledWith('pack-1');
    expect(Api.get).not.toHaveBeenCalledWith('/api/finance-statements/packs/pack-1');
    expect(result.current.statementPreviewDetail?.childStatements).toHaveLength(1);
  });

  it('falls back to legacy statement-pack detail on bounded compatibility statuses', async () => {
    vi.mocked(V8FinanceApi.getStatementPack).mockRejectedValue({ status: 404 });
    vi.mocked(Api.get).mockResolvedValue({
      id: 'pack-legacy-1',
      entity_name: 'Legacy Co.',
      period_label: 'Q1 2026',
      period_start: '2026-01-01',
      period_end: '2026-03-31',
      currency: 'PLN',
      scaling: 'units',
      pack_status: 'pending',
      pack_readiness_status: 'recoverable',
      source_statement_count: 0,
      statements: [],
      validations: [],
    } as any);

    const { result } = renderHook(() => useFinanceSelection('statements'));

    await act(async () => {
      await result.current.loadStatementPreview('pack-legacy-1');
    });

    await waitFor(() => {
      expect(result.current.statementPreviewDetail?.entityName).toBe('Legacy Co.');
    });

    expect(V8FinanceApi.getStatementPack).toHaveBeenCalledWith('pack-legacy-1');
    expect(Api.get).toHaveBeenCalledWith('/api/finance-statements/packs/pack-legacy-1');
  });

  it('uses the governed statement-pack detail seam for model preview pack hydration', async () => {
    vi.mocked(V8FinanceApi.getStatementPack).mockResolvedValue({
      pack: {
        id: 'pack-1',
        entity_name: 'Acme Sp. z o.o.',
        period_label: 'Q1 2026',
        statements: [{ id: 'statement-1' }],
        validations: [],
      },
    } as any);
    vi.mocked(Api.get).mockImplementation(async (url: string) => {
      if (url === '/api/financial-modeling/models/model-1') {
        return {
          id: 'model-1',
          name: 'Working capital model',
          source_statement_pack_id: 'pack-1',
        } as any;
      }
      if (url === '/api/finance-statements/statement-1') {
        return {
          id: 'statement-1',
          statement_type: 'P&L',
          period_label: 'Q1 2026',
          values: [],
        } as any;
      }
      throw new Error(`Unexpected GET ${url}`);
    });

    const { result } = renderHook(() => useFinanceSelection('models'));

    await act(async () => {
      await result.current.loadModelPreview({
        id: 'model-1',
        title: 'Working capital model',
        sourceStatementPackId: 'pack-1',
      } as any);
    });

    await waitFor(() => {
      expect(result.current.modelPreviewDetail?.sourceDocumentTitle).toBe('Acme Sp. z o.o.');
    });

    expect(V8FinanceApi.getStatementPack).toHaveBeenCalledWith('pack-1');
    expect(Api.get).not.toHaveBeenCalledWith('/api/finance-statements/packs/pack-1');
  });
});
