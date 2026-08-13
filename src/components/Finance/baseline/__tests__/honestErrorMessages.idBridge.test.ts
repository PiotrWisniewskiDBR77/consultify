/**
 * @vitest-environment jsdom
 *
 * ID_BRIDGE (Gate E) — "raw string leak" fix for Baseline.
 *
 * Before this fix, `useBaselineAssumptionsEditor.reload()`/`.save()` and
 * `useBaselineOutputs.reload()` put the RAW `Error.message` straight into UI
 * state (`e instanceof Error ? e.message : String(e)`) — CLAUDE.md task
 * brief: "Baseline i Valuation pokazują dziś surowy nieprzetłumaczony
 * string". These tests prove the fix: the error surfaced to the UI is now
 * `describeFinanceV2Error(err).detail` — a Polish, honest message — never
 * the raw backend/network string.
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/api/financeV2.api', () => ({
  listBaselineAssumptions: vi.fn(),
  upsertBaselineAssumptions: vi.fn(),
  listBaselineOutputs: vi.fn(),
}));

import {
  listBaselineAssumptions,
  listBaselineOutputs,
  upsertBaselineAssumptions,
} from '@/services/api/financeV2.api';

import { useBaselineAssumptionsEditor } from '../useBaselineAssumptionsEditor';
import { useBaselineOutputs } from '../useBaselineOutputs';

const mockedListAssumptions = listBaselineAssumptions as unknown as ReturnType<typeof vi.fn>;
const mockedUpsertAssumptions = upsertBaselineAssumptions as unknown as ReturnType<typeof vi.fn>;
const mockedListOutputs = listBaselineOutputs as unknown as ReturnType<typeof vi.fn>;

/** A raw, ugly, definitely-not-Polish string — the exact shape of what a bare `fetch`/network failure produces. */
const RAW_UGLY_MESSAGE = 'TypeError: Failed to fetch';

afterEach(() => {
  vi.clearAllMocks();
});

describe('useBaselineAssumptionsEditor — honest PL error message (ID_BRIDGE, Gate E)', () => {
  it('reload() failure surfaces a Polish honest message, NEVER the raw Error.message', async () => {
    mockedListAssumptions.mockRejectedValue(new Error(RAW_UGLY_MESSAGE));
    const { result } = renderHook(() =>
      useBaselineAssumptionsEditor('bv-1', { entityId: 'ent-1' })
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).not.toBe(RAW_UGLY_MESSAGE);
    expect(result.current.error).not.toContain('TypeError');
    expect(result.current.error).toBe('Spróbuj ponownie za chwilę.');
  });

  it('save() failure surfaces a Polish honest message, NEVER the raw Error.message', async () => {
    mockedListAssumptions.mockResolvedValue([]);
    mockedUpsertAssumptions.mockRejectedValue(new Error(RAW_UGLY_MESSAGE));
    const { result } = renderHook(() =>
      useBaselineAssumptionsEditor('bv-1', { entityId: 'ent-1' })
    );
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.setCellValue(
        {
          scheduleType: 'revenue_pvm',
          driverCode: 'REVENUE_GROWTH_YOY',
          entityId: 'ent-1',
          periodId: 'p-1',
        },
        {
          rule: 'FIXED_VALUE',
          valueStatus: 'PRESENT_NONZERO',
          valueDecimal: 0.1,
          quality: 'CONFIRMED',
        }
      );
    });

    let saveResult: { ok: boolean; message?: string } | undefined;
    await act(async () => {
      saveResult = await result.current.save();
    });

    expect(saveResult?.ok).toBe(false);
    expect(saveResult && 'message' in saveResult ? saveResult.message : undefined).not.toBe(
      RAW_UGLY_MESSAGE
    );
    expect(result.current.saveError).toBe('Spróbuj ponownie za chwilę.');
  });
});

describe('useBaselineOutputs — honest PL error message (ID_BRIDGE, Gate E)', () => {
  it('reload() failure surfaces a Polish honest message, NEVER the raw Error.message', async () => {
    mockedListOutputs.mockRejectedValue(new Error(RAW_UGLY_MESSAGE));
    const { result } = renderHook(() => useBaselineOutputs('bv-1', { entityId: 'ent-1' }));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).not.toBe(RAW_UGLY_MESSAGE);
    expect(result.current.error).toBe('Spróbuj ponownie za chwilę.');
  });
});
