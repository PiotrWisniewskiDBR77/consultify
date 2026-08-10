/**
 * @vitest-environment jsdom
 *
 * Performance measurement — IdeaTableTool mount time vs row count.
 *
 * Context (docs/qa/ideas-complete-transformation-2026-08-09/17_PERFORMANCE_MEASUREMENT.md):
 * a prior audit claimed "Table tool: no virtualization — every row rendered"
 * as a code-level risk but measured nothing. Code inspection confirms the
 * claim: src/components/MyWork/IdeaTableTool.tsx renders
 * `processedRowsWithRollups.map((row, idx) => renderRow(row, idx))` (line
 * ~4180) straight into a plain <table>/<tbody> — no react-window, no
 * react-virtual, no windowing of any kind (`grep -c
 * 'react-window|react-virtual|FixedSizeList|Virtuoso'` over the file = 0).
 *
 * This benchmark mounts the REAL IdeaTableTool component (not a
 * reimplementation of its render loop) with the same heavy-mock scaffolding
 * proven to work in tests/components/MyWork/IdeaTableTool.honesty.test.tsx,
 * and varies the row count fed through the `useTableRows` mock. Every other
 * hook is mocked exactly as in the honesty test (platform integration off,
 * legacy `nodes`/`processedRows` path). `useRollupComputation` is mocked to
 * identity here so this measures pure row/cell render cost — the rollup
 * O(n * (edges + allNodes)) cost is measured separately in
 * tests/performance/rollupComputation.bench.test.ts.
 *
 * Columns: 8 realistic mixed-type columns (text/select/number/date) so each
 * row renders 8 real <td> cells, not an empty shell.
 */
import React from 'react';
import { render, cleanup } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'en' },
    t: (_key: string, fallback?: any) =>
      typeof fallback === 'string' ? fallback : (fallback?.defaultValue ?? _key),
  }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

vi.mock('@/hooks/useV8FeatureFlag', () => ({
  useV8FeatureFlag: () => ({ isEnabled: false }),
}));

vi.mock('@/services/api', () => ({
  Api: {},
}));

vi.mock('@/services/api/tablePlatform.api', () => ({
  deleteTable: vi.fn(),
}));

vi.mock('@/services/funnelAnalytics', () => ({
  trackFunnelEvent: vi.fn(),
}));

vi.mock('@/store/useAppStore', () => ({
  useAppStore: (selector: (state: any) => any) =>
    selector({
      currentUser: { id: 'user-1', firstName: 'Piotr', lastName: 'W', email: 'piotr@example.com' },
      currentOrganization: { id: 'org-1' },
    }),
}));

vi.mock('../../src/components/MyWork/table/connectors/useConnectors', () => ({
  useConnectors: () => ({
    refetch: vi.fn(),
    testConnection: vi.fn(),
    autoMap: vi.fn(),
    create: vi.fn(),
    isCreating: false,
    isLoading: false,
    connectors: [],
  }),
}));

vi.mock('../../src/components/MyWork/table/useTablePlatformIntegration', () => ({
  useTablePlatformIntegration: () => ({
    active: false,
    loading: false,
    saving: false,
    saveStatusLabel: '',
    error: null,
    columns: [],
    setColumns: vi.fn(),
    visibleColumns: [],
    toggleColumn: vi.fn(),
    handleAddColumn: vi.fn(),
    renameColumn: vi.fn(),
    deleteColumn: vi.fn(),
    nodes: [],
    processedRows: [],
    groupedRows: null,
    selectedRowIds: new Set(),
    setSelectedRowIds: vi.fn(),
    toggleRowSelection: vi.fn(),
    handleFieldChange: vi.fn(),
    handleAddRow: vi.fn(),
    handleBulkDelete: vi.fn(),
    viewLayout: 'grid',
    setViewLayout: vi.fn(),
    savedViews: [],
    activeViewId: '',
    setActiveViewId: vi.fn(),
    sort: null,
    setSort: vi.fn(),
    filters: { logic: 'and', rules: [] },
    setFilters: vi.fn(),
    groupBy: null,
    setGroupBy: vi.fn(),
    applyView: vi.fn(),
    saveCurrentView: vi.fn(),
    updateSavedView: vi.fn(),
    deleteSavedView: vi.fn(),
    handleSave: vi.fn(),
    refresh: vi.fn(),
    loadMore: vi.fn(),
    hasMore: false,
    totalRecords: 0,
    platformFields: [],
    platformViews: [],
    applyPlatformFilters: vi.fn(),
    createPlatformView: vi.fn(),
  }),
}));

vi.mock('../../src/components/MyWork/table/useTableRealtime', () => ({
  useTableRealtime: () => ({ presence: [], connectionState: 'idle' }),
}));

const COLS: any[] = [
  { key: 'title', header: 'Title', type: 'text', visible: true, width: 220 },
  { key: 'status', header: 'Status', type: 'select', visible: true, width: 120, options: ['open', 'in_progress', 'done'] },
  { key: 'owner', header: 'Owner', type: 'text', visible: true, width: 140 },
  { key: 'score', header: 'Score', type: 'number', visible: true, width: 90 },
  { key: 'dueDate', header: 'Due date', type: 'date', visible: true, width: 120 },
  { key: 'priority', header: 'Priority', type: 'select', visible: true, width: 100, options: ['low', 'medium', 'high'] },
  { key: 'category', header: 'Category', type: 'text', visible: true, width: 140 },
  { key: 'notes', header: 'Notes', type: 'text', visible: true, width: 240 },
];

vi.mock('../../src/components/MyWork/table/useTableSchema', () => ({
  useTableSchema: () => ({
    columns: COLS,
    setColumns: vi.fn(),
    visibleColumns: COLS,
    toggleColumn: vi.fn(),
    handleAddColumn: vi.fn(),
    renameColumn: vi.fn(),
    updateColumnConfig: vi.fn(),
    deleteColumn: vi.fn(),
    handleResizeStart: vi.fn(),
    handleColDragStart: vi.fn(),
    handleColDragOver: vi.fn(),
    handleColDragEnd: vi.fn(),
    resizingCol: null,
    dragColKey: null,
    mergePersistedColumns: vi.fn(),
  }),
}));

vi.mock('../../src/components/MyWork/table/useTableViews', () => ({
  useTableViews: () => ({
    viewLayout: 'table',
    setViewLayout: vi.fn(),
    savedViews: [],
    setSavedViews: vi.fn(),
    activeViewId: '',
    setActiveViewId: vi.fn(),
    sort: null,
    setSort: vi.fn(),
    filters: { logic: 'and', rules: [] },
    setFilters: vi.fn(),
    groupBy: null,
    setGroupBy: vi.fn(),
    filterInput: '',
    setFilterInput: vi.fn(),
    applyView: vi.fn(),
    saveCurrentView: vi.fn(),
    updateSavedView: vi.fn(),
    deleteSavedView: vi.fn(),
    cycleSort: vi.fn(),
  }),
}));

vi.mock('../../src/components/MyWork/table/useUndoRedo', () => ({
  useUndoRedo: () => ({
    set: vi.fn(),
    push: vi.fn(),
    undo: vi.fn(),
    redo: vi.fn(),
    canUndo: false,
    canRedo: false,
  }),
}));

function buildRows(n: number) {
  const rows: any[] = [];
  for (let i = 0; i < n; i++) {
    rows.push({
      id: `row-${i}`,
      type: 'idea',
      position: { x: 0, y: 0 },
      data: {
        title: `Row title ${i}`,
        status: i % 3 === 0 ? 'open' : i % 3 === 1 ? 'in_progress' : 'done',
        owner: `Owner ${i % 25}`,
        score: (i % 100) + 1,
        dueDate: '2026-08-10',
        priority: i % 3 === 0 ? 'low' : i % 3 === 1 ? 'medium' : 'high',
        category: `Category ${i % 12}`,
        notes: `Some notes for row ${i} describing the item in a bit more detail.`,
      },
    });
  }
  return rows;
}

// N is set per-test via this mutable holder so useTableRows (mocked once,
// module-level) can read the "current" row count without re-mocking per test.
let currentRows: any[] = [];

vi.mock('../../src/components/MyWork/table/useTableRows', () => ({
  useTableRows: () => ({
    nodes: currentRows,
    processedRows: currentRows,
    groupedRows: null,
    selectedRowIds: new Set(),
    setSelectedRowIds: vi.fn(),
    toggleRowSelection: vi.fn(),
    handleFieldChange: vi.fn(),
    handleAddRow: vi.fn(),
    handleAddRowWithTemplate: vi.fn(),
    handleTemplateSelect: vi.fn(),
    handleBulkDelete: vi.fn(),
    handleReorderNode: vi.fn(),
    handleAddSubItem: vi.fn(),
    showRowTemplatePicker: false,
    setShowRowTemplatePicker: vi.fn(),
    addRowBtnRect: null,
    setAddRowBtnRect: vi.fn(),
  }),
}));

vi.mock('../../src/components/MyWork/table/useRollupComputation', () => ({
  useRollupComputation: (rows: any[]) => rows,
}));

const useTablePersistenceMock = vi.fn();
vi.mock('../../src/components/MyWork/table/useTablePersistence', () => ({
  useTablePersistence: (...args: any[]) => useTablePersistenceMock(...args),
}));

vi.mock('../../src/components/MyWork/table/useTableQuickActions', () => ({
  useTableQuickActions: vi.fn(),
}));

vi.mock('../../src/components/MyWork/table/useTableKeyboard', () => ({
  useTableKeyboard: vi.fn(),
}));

vi.mock('../../src/components/MyWork/table/CollaborationPresence', () => ({
  CellCursor: () => null,
  CollaborationPresence: () => null,
  WorkspaceLockIndicator: () => null,
  WorkspacePresenceIndicator: () => null,
}));

vi.mock('../../src/components/MyWork/table/PresenceIndicators', () => ({
  PresenceIndicators: () => null,
  TableRealtimeStatusIndicator: () => null,
}));

vi.mock('../../src/components/MyWork/table/views/ViewRouter', () => ({
  ViewRouter: () => <div data-testid="view-router" />,
}));

vi.mock('../../src/components/MyWork/table/GridView', () => ({
  GridView: () => <div data-testid="grid-view" />,
}));

import { IdeaTableTool } from '../../src/components/MyWork/IdeaTableTool';

const SIZES = [100, 1000, 5000, 10000];
const REPS = 5;

describe('perf: IdeaTableTool mount time vs row count (no virtualization)', () => {
  beforeEach(() => {
    useTablePersistenceMock.mockReturnValue({
      loading: false,
      saving: false,
      saveStatusLabel: 'Saved just now',
      handleSave: vi.fn(),
      loadError: null,
      refresh: vi.fn(),
    });
  });

  afterEach(() => {
    cleanup();
  });

  const results: Array<{ n: number; meanMs: number; minMs: number; maxMs: number; domRows: number }> = [];

  for (const n of SIZES) {
    it(`N=${n}: mounts IdeaTableTool with ${n} real rows, ${REPS} repetitions`, () => {
      currentRows = buildRows(n);
      const timings: number[] = [];
      let domRows = 0;
      for (let r = 0; r < REPS; r++) {
        const t0 = performance.now();
        const { container, unmount } = render(<IdeaTableTool open ideaId="idea-1" />);
        const t1 = performance.now();
        timings.push(t1 - t0);
        if (r === REPS - 1) {
          domRows = container.querySelectorAll('tbody tr').length;
        }
        unmount();
      }
      const meanMs = timings.reduce((a, b) => a + b, 0) / timings.length;
      const minMs = Math.min(...timings);
      const maxMs = Math.max(...timings);
      results.push({ n, meanMs, minMs, maxMs, domRows });

      // eslint-disable-next-line no-console
      console.log(
        `[table-mount-bench] N=${n} reps=${REPS} mean=${meanMs.toFixed(2)}ms min=${minMs.toFixed(2)}ms ` +
          `max=${maxMs.toFixed(2)}ms domRows=${domRows} all=[${timings.map((t) => t.toFixed(2)).join(', ')}]`
      );
      // Sanity: confirms every row really is in the DOM — proves "no virtualization"
      // empirically (a windowed table would cap this near viewport size regardless of N).
      expect(domRows).toBe(n);
    }, 120000);
  }

  it('prints the final N vs ms table', () => {
    // eslint-disable-next-line no-console
    console.log('\n[table-mount-bench] SUMMARY TABLE');
    // eslint-disable-next-line no-console
    console.log('N\tmean_ms\tmin_ms\tmax_ms\tdomRows');
    for (const r of results) {
      // eslint-disable-next-line no-console
      console.log(`${r.n}\t${r.meanMs.toFixed(2)}\t${r.minMs.toFixed(2)}\t${r.maxMs.toFixed(2)}\t${r.domRows}`);
    }
    expect(results.length).toBeGreaterThan(0);
  });
});
