/**
 * @vitest-environment jsdom
 *
 * Regression test for the missing-memoization bug in `useTablePlatformBridge`:
 * `nodes`/`columns` were computed as `fields.map(...)` / `records.map(...)`
 * directly in the hook body (no `useMemo`), so every render — including
 * renders triggered by unrelated state changes in this hook — produced a
 * brand-new array reference even when `records`/`fields` hadn't changed.
 *
 * `useTablePlatformIntegration` syncs `localNodes` from `bridge.nodes` via
 * `useEffect(() => setLocalNodes(bridge.nodes), [isActive, bridge.nodes])`.
 * A `bridge.nodes` that never stabilizes means that effect never stops
 * firing: setState → render → new `bridge.nodes` reference → effect fires
 * again → setState → ... an unbounded render loop (observed as a hanging
 * test when rendering `useTablePlatformIntegration` with the real bridge).
 *
 * This suite verifies directly on `useTablePlatformBridge`:
 *   1. `nodes`/`columns` keep the same reference across renders that don't
 *      change `records`/`fields` (fixes the loop).
 *   2. `nodes`/`columns` DO get new references when `records`/`fields`
 *      actually change (no stale data — covers realtime-applied updates and
 *      undo/redo, both of which go through the same `setRecords`/`setFields`
 *      setters).
 *   3. `useTablePlatformIntegration`, mounted with the REAL bridge (no mock),
 *      settles to a stable render count instead of looping.
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { TablePlatformField, TablePlatformRecord } from '@/types/tablePlatform';

const TABLE_ID = 'tbl-1';
const BASE_ID = 'base-1';

vi.mock('@/contexts/FeatureFlagsContext', () => ({
  useFeatureFlagsContext: () => ({
    isEnabled: (flag: string) => flag === 'tablePlatformMetadataFirst',
  }),
}));

const FIELD_ALPHA: TablePlatformField = {
  id: 'f-name',
  tableId: TABLE_ID,
  name: 'Name',
  fieldType: 'singleLineText',
  options: {},
  isComputed: false,
  order: 0,
  createdAt: '',
  updatedAt: '',
};

const RECORD_1: TablePlatformRecord = {
  id: 'rec-1',
  tableId: TABLE_ID,
  data: { 'f-name': 'Alpha' },
  createdAt: '',
  updatedAt: '',
  version: 1,
};

const RECORD_2: TablePlatformRecord = {
  id: 'rec-2',
  tableId: TABLE_ID,
  data: { 'f-name': 'Beta' },
  createdAt: '',
  updatedAt: '',
  version: 1,
};

vi.mock('@/services/api/tablePlatform.api', () => ({
  listBases: vi.fn(async () => [{ id: BASE_ID }]),
  getBase: vi.fn(async () => ({ id: BASE_ID, workspace_id: 'idea-1', tables: [{ id: TABLE_ID }] })),
  createBase: vi.fn(async () => ({ id: BASE_ID })),
  createTable: vi.fn(async () => ({ id: TABLE_ID })),
  getTable: vi.fn(async () => ({
    id: TABLE_ID,
    fields: [FIELD_ALPHA],
    views: [],
  })),
  listRecords: vi.fn(async () => ({
    records: [RECORD_1, RECORD_2],
    total: 2,
    cursor: undefined,
    hasMore: false,
  })),
  createRecord: vi.fn(async (_tableId: string, data: Record<string, unknown>) => ({
    id: 'rec-new',
    table_id: TABLE_ID,
    data,
    version: 1,
  })),
  updateRecord: vi.fn(async (recordId: string, data: Record<string, unknown>) => ({
    id: recordId,
    table_id: TABLE_ID,
    data,
    version: 2,
  })),
  deleteRecord: vi.fn(async () => undefined),
  createField: vi.fn(async () => ({ id: 'f-new', field_type: 'singleLineText' })),
  updateField: vi.fn(async () => ({})),
  createView: vi.fn(async () => ({ id: 'v-1' })),
  updateView: vi.fn(async () => ({})),
  deleteView: vi.fn(async () => undefined),
  deleteField: vi.fn(async () => undefined),
}));

import { useTablePlatformBridge } from '../useTablePlatformBridge';

describe('useTablePlatformBridge — nodes/columns memoization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('keeps stable nodes/columns references across unrelated re-renders', async () => {
    const { result, rerender } = renderHook(
      (props: { extra: number }) => {
        // `extra` forces a re-render of the hook without touching records/fields.
        void props.extra;
        return useTablePlatformBridge({ ideaId: 'idea-1', enabled: true });
      },
      { initialProps: { extra: 0 } }
    );

    await waitFor(() => expect(result.current.records.length).toBe(2));

    const nodesBefore = result.current.nodes;
    const columnsBefore = result.current.columns;

    rerender({ extra: 1 });

    expect(result.current.nodes).toBe(nodesBefore);
    expect(result.current.columns).toBe(columnsBefore);
  });

  it('produces new nodes/columns references when records/fields actually change', async () => {
    const { result } = renderHook(() =>
      useTablePlatformBridge({ ideaId: 'idea-1', enabled: true })
    );

    await waitFor(() => expect(result.current.records.length).toBe(2));

    const nodesBefore = result.current.nodes;

    await act(async () => {
      await result.current.createRecord({ 'f-name': 'Gamma' });
    });

    expect(result.current.nodes).not.toBe(nodesBefore);
    expect(result.current.nodes.length).toBe(3);
  });

  it('updates nodes reference (but not columns) on a realtime record update', async () => {
    const { result } = renderHook(() =>
      useTablePlatformBridge({ ideaId: 'idea-1', enabled: true })
    );

    await waitFor(() => expect(result.current.records.length).toBe(2));

    const nodesBefore = result.current.nodes;
    const columnsBefore = result.current.columns;

    act(() => {
      result.current.applyRealtimeUpdated('rec-1', {
        id: 'rec-1',
        table_id: TABLE_ID,
        data: { 'f-name': 'Alpha-edited' },
        version: 2,
      });
    });

    expect(result.current.nodes).not.toBe(nodesBefore);
    // fields didn't change, so columns should remain stable.
    expect(result.current.columns).toBe(columnsBefore);
  });
});

describe('useTablePlatformIntegration — real bridge does not render-loop', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('settles to a stable render count instead of looping', async () => {
    // Intentionally uses the REAL useTablePlatformBridge (only the API layer
    // and feature flags are mocked) — before the fix, this hung indefinitely
    // because bridge.nodes never stabilized.
    const { useTablePlatformIntegration } = await import('../useTablePlatformIntegration');

    let renderCount = 0;
    const { result } = renderHook(() => {
      renderCount += 1;
      return useTablePlatformIntegration({
        ideaId: 'idea-1',
        locked: false,
        isPl: false,
        open: true,
      });
    });

    await waitFor(() => expect(result.current.nodes.length).toBe(2), { timeout: 3000 });

    const countAfterLoad = renderCount;

    // Give any runaway effect loop a chance to fire a few more times; a fixed
    // bridge should NOT keep re-rendering once data has settled.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    expect(renderCount).toBeLessThanOrEqual(countAfterLoad + 2);
  });
});
