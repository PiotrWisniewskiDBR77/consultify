/**
 * @vitest-environment jsdom
 *
 * Realtime record sync — TablePlatform Fala 2.
 *
 * Verifies that `useTablePlatformBridge`'s realtime broadcast appliers fold peer
 * mutations into local record state, with echo-protection (version gating) so a
 * client's own optimistic update is never clobbered by the stale echo of its own
 * change, and with table-scoping so foreign-table broadcasts are ignored.
 *
 * The realtime transport (Socket.IO) is exercised end-to-end elsewhere; here we
 * test the pure state-application contract that the socket callbacks invoke.
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────────────

const TABLE_ID = 'tbl-1';

vi.mock('@/contexts/FeatureFlagsContext', () => ({
  useFeatureFlagsContext: () => ({
    isEnabled: (flag: string) => flag === 'tablePlatformMetadataFirst',
  }),
}));

vi.mock('@/services/api/tablePlatform.api', () => ({
  listBases: vi.fn(async () => [{ id: 'base-1' }]),
  getBase: vi.fn(async () => ({ id: 'base-1', tables: [{ id: TABLE_ID, name: 'T' }] })),
  createBase: vi.fn(async () => ({ id: 'base-1' })),
  createTable: vi.fn(async () => ({ id: TABLE_ID, name: 'T' })),
  getTable: vi.fn(async () => ({
    id: TABLE_ID,
    fields: [{ id: 'f-name', name: 'Name', field_type: 'singleLineText', field_order: 0 }],
    views: [],
  })),
  listRecords: vi.fn(async () => ({
    records: [
      { id: 'rec-1', table_id: TABLE_ID, data: { 'f-name': 'Alpha' }, version: 3 },
      { id: 'rec-2', table_id: TABLE_ID, data: { 'f-name': 'Beta' }, version: 1 },
    ],
    total: 2,
    hasMore: false,
    cursor: undefined,
  })),
  createRecord: vi.fn(),
  updateRecord: vi.fn(),
  deleteRecord: vi.fn(),
  createField: vi.fn(),
  updateField: vi.fn(),
  deleteField: vi.fn(),
  createView: vi.fn(),
  updateView: vi.fn(),
}));

import * as TablePlatformApi from '@/services/api/tablePlatform.api';

import { useTablePlatformBridge } from '../useTablePlatformBridge';

function dataOf(nodes: { id: string; data?: Record<string, unknown> }[], id: string) {
  return nodes.find((n) => n.id === id)?.data;
}

async function mountLoaded() {
  const hook = renderHook(() =>
    useTablePlatformBridge({ ideaId: 'idea-1', enabled: true, preferredTableId: null })
  );
  await waitFor(() => expect(hook.result.current.records.length).toBe(2));
  expect(hook.result.current.loadedTableId).toBe(TABLE_ID);
  return hook;
}

describe('useTablePlatformBridge realtime sync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('applies record:created from a peer (adds a new node)', async () => {
    const { result } = await mountLoaded();
    act(() => {
      result.current.applyRealtimeCreated({
        id: 'rec-3',
        table_id: TABLE_ID,
        data: { 'f-name': 'Gamma' },
        version: 1,
      });
    });
    await waitFor(() => expect(result.current.records.length).toBe(3));
    expect(dataOf(result.current.nodes, 'rec-3')?.['f-name']).toBe('Gamma');
    expect(result.current.totalRecords).toBe(3);
  });

  it('applies record:updated from a peer (merges data by recordId)', async () => {
    const { result } = await mountLoaded();
    act(() => {
      result.current.applyRealtimeUpdated('rec-2', {
        id: 'rec-2',
        table_id: TABLE_ID,
        data: { 'f-name': 'Beta-EDITED' },
        version: 2, // newer than local (1)
      });
    });
    await waitFor(() =>
      expect(dataOf(result.current.nodes, 'rec-2')?.['f-name']).toBe('Beta-EDITED')
    );
    // Untouched record unchanged
    expect(dataOf(result.current.nodes, 'rec-1')?.['f-name']).toBe('Alpha');
  });

  it('applies record:deleted from a peer (removes the node)', async () => {
    const { result } = await mountLoaded();
    act(() => {
      result.current.applyRealtimeDeleted('rec-1');
    });
    await waitFor(() => expect(result.current.records.length).toBe(1));
    expect(result.current.nodes.some((n) => n.id === 'rec-1')).toBe(false);
    expect(result.current.totalRecords).toBe(1);
  });

  it('ECHO PROTECTION: a stale echo (version <= known) does NOT overwrite newer local state', async () => {
    const { result } = await mountLoaded();
    // rec-1 loaded at version 3. A peer/own echo arrives with version 3 (equal)
    // carrying an older value — must be dropped.
    act(() => {
      result.current.applyRealtimeUpdated('rec-1', {
        id: 'rec-1',
        table_id: TABLE_ID,
        data: { 'f-name': 'STALE-ECHO' },
        version: 3,
      });
    });
    // And an even older version.
    act(() => {
      result.current.applyRealtimeUpdated('rec-1', {
        id: 'rec-1',
        table_id: TABLE_ID,
        data: { 'f-name': 'OLDER-ECHO' },
        version: 2,
      });
    });
    // Value stays at the loaded 'Alpha'.
    expect(dataOf(result.current.nodes, 'rec-1')?.['f-name']).toBe('Alpha');
  });

  it('ECHO PROTECTION: a strictly-newer update after a stale echo still applies', async () => {
    const { result } = await mountLoaded();
    act(() => {
      // stale — dropped
      result.current.applyRealtimeUpdated('rec-1', {
        id: 'rec-1',
        table_id: TABLE_ID,
        data: { 'f-name': 'STALE' },
        version: 3,
      });
    });
    act(() => {
      // genuinely newer — applied
      result.current.applyRealtimeUpdated('rec-1', {
        id: 'rec-1',
        table_id: TABLE_ID,
        data: { 'f-name': 'REAL-NEXT' },
        version: 4,
      });
    });
    await waitFor(() =>
      expect(dataOf(result.current.nodes, 'rec-1')?.['f-name']).toBe('REAL-NEXT')
    );
  });

  it('TABLE SCOPING: a broadcast for a different table is ignored', async () => {
    const { result } = await mountLoaded();
    act(() => {
      result.current.applyRealtimeCreated({
        id: 'rec-foreign',
        table_id: 'tbl-OTHER',
        data: { 'f-name': 'Nope' },
        version: 1,
      });
    });
    act(() => {
      result.current.applyRealtimeUpdated('rec-1', {
        id: 'rec-1',
        table_id: 'tbl-OTHER',
        data: { 'f-name': 'ForeignEdit' },
        version: 99,
      });
    });
    // Neither the create nor the foreign-table update touched local state.
    expect(result.current.records.length).toBe(2);
    expect(result.current.nodes.some((n) => n.id === 'rec-foreign')).toBe(false);
    expect(dataOf(result.current.nodes, 'rec-1')?.['f-name']).toBe('Alpha');
  });

  it('DEFENSIVE: deleting an absent record is a no-op (no crash, count unchanged)', async () => {
    const { result } = await mountLoaded();
    act(() => {
      result.current.applyRealtimeDeleted('does-not-exist');
    });
    expect(result.current.records.length).toBe(2);
    expect(result.current.totalRecords).toBe(2);
  });

  it('DEFENSIVE: updating an absent record adopts it rather than crashing', async () => {
    const { result } = await mountLoaded();
    act(() => {
      result.current.applyRealtimeUpdated('rec-late', {
        id: 'rec-late',
        table_id: TABLE_ID,
        data: { 'f-name': 'LateJoiner' },
        version: 5,
      });
    });
    await waitFor(() =>
      expect(dataOf(result.current.nodes, 'rec-late')?.['f-name']).toBe('LateJoiner')
    );
  });

  it('schema:changed triggers a re-fetch (loadData) without unmounting', async () => {
    const { result } = await mountLoaded();
    const getTableCalls = (TablePlatformApi.getTable as ReturnType<typeof vi.fn>).mock.calls.length;
    act(() => {
      result.current.applyRealtimeSchemaChanged();
    });
    await waitFor(() =>
      expect(
        (TablePlatformApi.getTable as ReturnType<typeof vi.fn>).mock.calls.length
      ).toBeGreaterThan(getTableCalls)
    );
  });
});
