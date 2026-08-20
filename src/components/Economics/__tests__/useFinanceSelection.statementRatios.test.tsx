/** @vitest-environment jsdom */
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  getStatementPack: vi.fn(),
  getStatementRatios: vi.fn(),
}));

vi.mock('@/services/api/v8/finance', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, any>;
  return {
    ...actual,
    V8FinanceApi: {
      ...actual.V8FinanceApi,
      getStatementPack: api.getStatementPack,
      getStatementRatios: api.getStatementRatios,
    },
  };
});

import { useFinanceSelection } from '../hooks/useFinanceSelection';

const row = {
  id: 'pack-1',
  kind: 'statements',
  title: 'Statement pack',
  status: 'DRAFT',
};

const pack = (readiness: string, status = 'imported') => ({
  pack: {
    id: 'pack-1',
    pack_status: 'draft',
    pack_readiness_status: readiness,
    statements: [
      { id: 'pl-2025', statement_type: 'P&L', period_label: '2025', readiness_status: readiness, status },
      { id: 'pl-2024', statement_type: 'P&L', period_label: '2024', readiness_status: readiness, status },
      { id: 'bs-2025', statement_type: 'BS', period_label: '2025', readiness_status: readiness, status },
      { id: 'bs-2024', statement_type: 'BS', period_label: '2024', readiness_status: readiness, status },
      { id: 'cf-2025', statement_type: 'CF', period_label: '2025', readiness_status: readiness, status },
      { id: 'cf-2024', statement_type: 'CF', period_label: '2024', readiness_status: readiness, status },
    ],
  },
});

describe('useFinanceSelection Statement ratio capability', () => {
  beforeEach(() => {
    api.getStatementPack.mockReset();
    api.getStatementRatios.mockReset();
  });

  it('cold-opens a recoverable six-sibling pack without probing unsupported ratios', async () => {
    api.getStatementPack.mockResolvedValue(pack('recoverable'));
    const { result } = renderHook(() => useFinanceSelection('statements' as any));

    act(() => result.current.onSelectRow(row as any));

    await waitFor(() => expect(result.current.statementPreviewDetail?.childStatements).toHaveLength(6));
    expect(api.getStatementRatios).not.toHaveBeenCalled();
    expect(result.current.statementPreviewRatios).toBeNull();
  });

  it('requests ratios once when every sibling is statement-ready', async () => {
    api.getStatementPack.mockResolvedValue(pack('ready', 'confirmed'));
    api.getStatementRatios.mockResolvedValue({
      ratios: { coverageSummary: { coveragePct: 0, computed: 0, total: 1 }, ratios: [] },
    });
    const { result } = renderHook(() => useFinanceSelection('statements' as any));

    act(() => result.current.onSelectRow(row as any));

    await waitFor(() => expect(api.getStatementRatios).toHaveBeenCalledWith('pl-2025'));
    expect(api.getStatementRatios).toHaveBeenCalledTimes(1);
  });
});
