/**
 * @vitest-environment jsdom
 *
 * Platform-mode undo/redo — record mutations (create/update/delete).
 *
 * Table Platform mode has no client-side array to snapshot the way legacy mode's
 * `useUndoRedo<TableNode[]>` does — every row mutation is a discrete API call
 * through `useTablePlatformBridge`. This suite verifies the client-side command
 * stack added to `useTablePlatformIntegration` (see `usePlatformRecordUndoRedo`
 * in `useUndoRedo.ts`): each mutation pushes an *inverse* operation onto the
 * stack, `platformUndo()` replays it through the same bridge API functions used
 * by forward mutations, and `platformRedo()` re-applies the forward operation.
 *
 * v1 scope (per spec): single-record operations only — no batch/multi-row undo.
 *
 * `useTablePlatformBridge` itself is mocked here (rather than exercised through
 * the real API layer) because it recomputes `nodes`/`columns` as fresh array
 * references on every call with no memoization — an unrelated pre-existing bug
 * (flagged separately) that causes an infinite render loop the moment a test
 * renders `useTablePlatformIntegration` directly with the real bridge. The mock
 * below faithfully reproduces the bridge's create/update/delete contract
 * (including returning a fresh record so callers can derive nodes) while
 * keeping `nodes` referentially stable across renders that don't change
 * `records`, matching what a fixed bridge would do.
 *
 * The realtime-echo mechanism (version-gated dedup in the real bridge, see
 * useTablePlatformRealtimeSync.test.tsx) is exercised implicitly by real usage:
 * undo/redo call the exact same bridge.createRecord/updateRecord/deleteRecord
 * functions as forward mutations, so no separate dedup logic was needed in the
 * undo/redo stack itself — this suite asserts that contract (same functions,
 * same call shape) rather than re-testing echo protection itself.
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { useCallback, useMemo, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { TablePlatformField, TablePlatformRecord } from '@/types/tablePlatform';

import { fieldToColumn, recordToNode } from '../tablePlatformMappers';

const TABLE_ID = 'tbl-1';

vi.mock('@/contexts/FeatureFlagsContext', () => ({
  useFeatureFlagsContext: () => ({
    isEnabled: (flag: string) => flag === 'tablePlatformMetadataFirst',
  }),
}));

// `useTablePlatformViews` (imported for real, unmocked) calls
// TablePlatformApi.getTable to fetch its saved-views list — that endpoint is
// independent of the bridge's own node/record fetching, so it's mocked here too.
vi.mock('@/services/api/tablePlatform.api', () => ({
  getTable: vi.fn(async () => ({ id: TABLE_ID, views: [] })),
  updateView: vi.fn(async () => ({})),
}));

let nextRecordId = 100;
let idSeq = 0;

const FIELDS: TablePlatformField[] = [
  {
    id: 'f-name',
    tableId: TABLE_ID,
    name: 'Name',
    fieldType: 'singleLineText',
    options: {},
    isComputed: false,
    order: 0,
    createdAt: '',
    updatedAt: '',
  },
];

function makeRecord(data: Record<string, unknown>): TablePlatformRecord {
  idSeq += 1;
  nextRecordId += 1;
  return {
    id: `rec-created-${nextRecordId}`,
    tableId: TABLE_ID,
    data,
    createdAt: '',
    updatedAt: '',
    version: 1,
  };
}

/**
 * Minimal faithful stand-in for useTablePlatformBridge: same create/update/
 * delete contract and return shape, but with memoized nodes/columns (the real
 * hook's missing-memoization bug is tracked separately — see spawned task).
 */
function useFakeTablePlatformBridge(initialRecords: TablePlatformRecord[]) {
  const [records, setRecords] = useState<TablePlatformRecord[]>(initialRecords);

  const createRecord = useCallback(async (data: Record<string, unknown>) => {
    const created = makeRecord(data);
    setRecords((prev) => [created, ...prev]);
    return created;
  }, []);

  const updateRecord = useCallback(async (recordId: string, data: Record<string, unknown>) => {
    let updated: TablePlatformRecord | null = null;
    setRecords((prev) =>
      prev.map((r) => {
        if (r.id !== recordId) return r;
        updated = { ...r, data: { ...r.data, ...data }, version: (r.version ?? 0) + 1 };
        return updated;
      })
    );
    // setRecords is async-scheduled; recompute synchronously for the return value.
    const existing = records.find((r) => r.id === recordId);
    if (!existing) return null;
    const result: TablePlatformRecord = {
      ...existing,
      data: { ...existing.data, ...data },
      version: (existing.version ?? 0) + 1,
    };
    return result;
  }, [records]);

  const deleteRecord = useCallback(async (recordId: string) => {
    setRecords((prev) => prev.filter((r) => r.id !== recordId));
    return true;
  }, []);

  const nodes = useMemo(() => records.map((r) => recordToNode(r, FIELDS)), [records]);
  const columns = useMemo(() => FIELDS.map(fieldToColumn), []);

  return {
    isNewPlatform: true,
    loading: false,
    error: null as string | null,
    platformFailed: false,
    base: { id: 'base-1' },
    table: { id: TABLE_ID, name: 'T' },
    fields: FIELDS,
    views: [] as never[],
    records,
    totalRecords: records.length,
    hasMore: false,
    columns,
    nodes,
    createRecord,
    updateRecord,
    deleteRecord,
    addField: async () => null,
    updateField: async () => {},
    createView: async () => null,
    updateView: async () => {},
    loadMore: async () => {},
    refresh: async () => {},
    applyFilters: async () => {},
    applySorts: async () => {},
    loadedTableId: TABLE_ID,
    applyRealtimeCreated: () => {},
    applyRealtimeUpdated: () => {},
    applyRealtimeDeleted: () => {},
    applyRealtimeSchemaChanged: () => {},
  };
}

let bridgeSpy: ReturnType<typeof vi.fn>;
let currentInitialRecords: TablePlatformRecord[] = [];

vi.mock('../useTablePlatformBridge', () => ({
  useTablePlatformBridge: (...args: unknown[]) => {
    bridgeSpy(...args);
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useFakeTablePlatformBridge(currentInitialRecords);
  },
}));

import { useTablePlatformIntegration } from '../useTablePlatformIntegration';

function nodeData(
  nodes: { id: string; data?: Record<string, unknown> }[],
  id: string
): Record<string, unknown> | undefined {
  return nodes.find((n) => n.id === id)?.data;
}

function mount(initialRecords: TablePlatformRecord[], ideaId = 'idea-1') {
  currentInitialRecords = initialRecords;
  return renderHook(() =>
    useTablePlatformIntegration({
      ideaId,
      locked: false,
      isPl: false,
      open: true,
    })
  );
}

describe('useTablePlatformIntegration — platform record undo/redo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    bridgeSpy = vi.fn();
    nextRecordId = 100;
    idSeq = 0;
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  const ALPHA_RECORD: TablePlatformRecord = {
    id: 'rec-1',
    tableId: TABLE_ID,
    data: { 'f-name': 'Alpha' },
    createdAt: '',
    updatedAt: '',
    version: 1,
  };

  it('starts with nothing to undo/redo', async () => {
    const { result } = mount([ALPHA_RECORD]);
    await waitFor(() => expect(result.current.nodes.length).toBe(1));
    expect(result.current.platformCanUndo).toBe(false);
    expect(result.current.platformCanRedo).toBe(false);
  });

  describe('field update (handleFieldChange)', () => {
    it('pushes an inverse update onto the stack after a successful edit', async () => {
      const { result } = mount([ALPHA_RECORD]);
      act(() => {
        result.current.handleFieldChange('rec-1', 'f-name', 'Edited');
      });
      await waitFor(() => expect(result.current.platformCanUndo).toBe(true));
      expect(nodeData(result.current.nodes, 'rec-1')?.['f-name']).toBe('Edited');
    });

    it('undo calls updateRecord with the previous value and restores it', async () => {
      const { result } = mount([ALPHA_RECORD]);
      act(() => {
        result.current.handleFieldChange('rec-1', 'f-name', 'Edited');
      });
      await waitFor(() => expect(result.current.platformCanUndo).toBe(true));

      let undone = false;
      await act(async () => {
        undone = await result.current.platformUndo();
      });
      expect(undone).toBe(true);

      await waitFor(() =>
        expect(nodeData(result.current.nodes, 'rec-1')?.['f-name']).toBe('Alpha')
      );
      expect(result.current.platformCanRedo).toBe(true);
      expect(result.current.platformCanUndo).toBe(false);
    });

    it('redo re-applies the forward value via updateRecord', async () => {
      const { result } = mount([ALPHA_RECORD]);
      act(() => {
        result.current.handleFieldChange('rec-1', 'f-name', 'Edited');
      });
      await waitFor(() => expect(result.current.platformCanUndo).toBe(true));
      await act(async () => {
        await result.current.platformUndo();
      });
      await waitFor(() => expect(result.current.platformCanRedo).toBe(true));

      let redone = false;
      await act(async () => {
        redone = await result.current.platformRedo();
      });
      expect(redone).toBe(true);

      await waitFor(() =>
        expect(nodeData(result.current.nodes, 'rec-1')?.['f-name']).toBe('Edited')
      );
      expect(result.current.platformCanRedo).toBe(false);
      expect(result.current.platformCanUndo).toBe(true);
    });

    it('replaying undo/redo does not push additional stack entries (no duplicate growth)', async () => {
      const { result } = mount([ALPHA_RECORD]);
      act(() => {
        result.current.handleFieldChange('rec-1', 'f-name', 'Edited');
      });
      await waitFor(() => expect(result.current.platformCanUndo).toBe(true));

      await act(async () => {
        await result.current.platformUndo();
      });
      // Nothing left to undo after a single edit is undone — proves the
      // undo replay (handleFieldChange called internally) did not push a
      // second entry onto the past stack.
      expect(result.current.platformCanUndo).toBe(false);
      expect(result.current.platformCanRedo).toBe(true);

      await act(async () => {
        await result.current.platformRedo();
      });
      // Likewise, redo's internal replay must not push onto the future stack.
      expect(result.current.platformCanRedo).toBe(false);
      expect(result.current.platformCanUndo).toBe(true);
    });
  });

  describe('add row (handleAddRow)', () => {
    it('pushes an inverse delete after a successful create', async () => {
      const { result } = mount([ALPHA_RECORD]);
      act(() => {
        result.current.handleAddRow();
      });
      await waitFor(() => expect(result.current.nodes.length).toBe(2));
      expect(result.current.platformCanUndo).toBe(true);
    });

    it('undo deletes the created record', async () => {
      const { result } = mount([ALPHA_RECORD]);
      act(() => {
        result.current.handleAddRow();
      });
      await waitFor(() => expect(result.current.nodes.length).toBe(2));
      const createdId = result.current.nodes.find((n) => n.id !== 'rec-1')!.id;

      await act(async () => {
        await result.current.platformUndo();
      });

      await waitFor(() => expect(result.current.nodes.length).toBe(1));
      expect(result.current.nodes.some((n) => n.id === createdId)).toBe(false);
    });

    it('redo re-creates the record', async () => {
      const { result } = mount([ALPHA_RECORD]);
      act(() => {
        result.current.handleAddRow();
      });
      await waitFor(() => expect(result.current.nodes.length).toBe(2));

      await act(async () => {
        await result.current.platformUndo();
      });
      await waitFor(() => expect(result.current.nodes.length).toBe(1));

      await act(async () => {
        await result.current.platformRedo();
      });

      await waitFor(() => expect(result.current.nodes.length).toBe(2));
    });
  });

  describe('delete row (handleBulkDelete, single-selection = v1 scope)', () => {
    it('pushes an inverse create after deleting exactly one selected row', async () => {
      const { result } = mount([ALPHA_RECORD]);
      act(() => {
        result.current.toggleRowSelection('rec-1');
      });
      act(() => {
        result.current.handleBulkDelete();
      });
      await waitFor(() => expect(result.current.nodes.length).toBe(0));
      await waitFor(() => expect(result.current.platformCanUndo).toBe(true));
    });

    it('undo re-creates the deleted row with its prior data', async () => {
      const { result } = mount([ALPHA_RECORD]);
      act(() => {
        result.current.toggleRowSelection('rec-1');
      });
      act(() => {
        result.current.handleBulkDelete();
      });
      await waitFor(() => expect(result.current.platformCanUndo).toBe(true));

      await act(async () => {
        await result.current.platformUndo();
      });

      await waitFor(() => expect(result.current.nodes.length).toBe(1));
      expect(nodeData(result.current.nodes, result.current.nodes[0]!.id)?.['f-name']).toBe(
        'Alpha'
      );
    });

    it('redo deletes the re-created row again', async () => {
      const { result } = mount([ALPHA_RECORD]);
      act(() => {
        result.current.toggleRowSelection('rec-1');
      });
      act(() => {
        result.current.handleBulkDelete();
      });
      await waitFor(() => expect(result.current.platformCanUndo).toBe(true));
      await act(async () => {
        await result.current.platformUndo();
      });
      await waitFor(() => expect(result.current.nodes.length).toBe(1));

      await act(async () => {
        await result.current.platformRedo();
      });

      await waitFor(() => expect(result.current.nodes.length).toBe(0));
    });

    it('multi-row bulk delete does NOT push an undo entry (v1: single ops only)', async () => {
      const BETA_RECORD: TablePlatformRecord = {
        id: 'rec-2',
        tableId: TABLE_ID,
        data: { 'f-name': 'Beta' },
        createdAt: '',
        updatedAt: '',
        version: 1,
      };
      const { result } = mount([ALPHA_RECORD, BETA_RECORD], 'idea-2');
      await waitFor(() => expect(result.current.nodes.length).toBe(2));

      act(() => {
        result.current.toggleRowSelection('rec-1');
      });
      act(() => {
        result.current.toggleRowSelection('rec-2');
      });
      act(() => {
        result.current.handleBulkDelete();
      });
      await waitFor(() => expect(result.current.nodes.length).toBe(0));
      // Give any (incorrect) async push a chance to land before asserting absence.
      await act(async () => {
        await Promise.resolve();
      });
      expect(result.current.platformCanUndo).toBe(false);
    });
  });

  it('undo is a no-op (resolves false) when the stack is empty', async () => {
    const { result } = mount([ALPHA_RECORD]);
    let undone = true;
    await act(async () => {
      undone = await result.current.platformUndo();
    });
    expect(undone).toBe(false);
  });

  it('redo is a no-op (resolves false) when there is nothing to redo', async () => {
    const { result } = mount([ALPHA_RECORD]);
    let redone = true;
    await act(async () => {
      redone = await result.current.platformRedo();
    });
    expect(redone).toBe(false);
  });

  it('a fresh mutation after an undo clears the redo stack (standard undo/redo semantics)', async () => {
    const { result } = mount([ALPHA_RECORD]);
    act(() => {
      result.current.handleFieldChange('rec-1', 'f-name', 'Edited');
    });
    await waitFor(() => expect(result.current.platformCanUndo).toBe(true));
    await act(async () => {
      await result.current.platformUndo();
    });
    await waitFor(() => expect(result.current.platformCanRedo).toBe(true));

    act(() => {
      result.current.handleFieldChange('rec-1', 'f-name', 'Fresh-Edit');
    });
    await waitFor(() => expect(result.current.platformCanUndo).toBe(true));
    expect(result.current.platformCanRedo).toBe(false);
  });
});
