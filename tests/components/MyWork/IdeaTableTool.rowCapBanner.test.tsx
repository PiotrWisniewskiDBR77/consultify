/**
 * @vitest-environment jsdom
 *
 * G4-TABLE-SCALE — proves the plain-table view shows the honest "Showing
 * first N of M rows" banner (never silent truncation) when the row-render
 * cap (src/components/MyWork/table/tableRowLimits.ts, `computeRowRenderCap`)
 * reports hidden rows, and shows nothing extra when it doesn't.
 *
 * `computeRowRenderCap` is mocked here to keep this test fast/deterministic
 * (it mounts only the 2 rows the mock actually returns, never the hundreds
 * that would be needed to hit the real 500-row cap) — the cap MATH itself is
 * covered by tests/unit/components/MyWork/table/tableRowLimits.test.ts.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

const refreshMock = vi.fn();
const useTablePersistenceMock = vi.fn();
const computeRowRenderCapMock = vi.fn();

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'en' },
    t: (_key: string, fallback?: any, options?: Record<string, unknown>) => {
      if (typeof fallback !== 'string') return fallback?.defaultValue ?? _key;
      if (!options) return fallback;
      // Real interpolation here (unlike the other table test files) because
      // this test asserts on the fully-rendered banner text.
      return Object.keys(options).reduce(
        (acc, k) => acc.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String((options as any)[k])),
        fallback
      );
    },
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
      currentUser: {
        id: 'user-1',
        firstName: 'Piotr',
        lastName: 'W',
        email: 'piotr@example.com',
      },
      currentOrganization: {
        id: 'org-1',
      },
    }),
}));

vi.mock('../../../src/components/MyWork/table/connectors/useConnectors', () => ({
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

vi.mock('../../../src/components/MyWork/table/useTablePlatformIntegration', () => ({
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
    viewLayout: 'table',
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

vi.mock('../../../src/components/MyWork/table/useTableRealtime', () => ({
  useTableRealtime: () => ({
    presence: [],
    connectionState: 'idle',
  }),
}));

vi.mock('../../../src/components/MyWork/table/useTableSchema', () => ({
  useTableSchema: () => ({
    columns: [],
    setColumns: vi.fn(),
    visibleColumns: [],
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

vi.mock('../../../src/components/MyWork/table/useTableViews', () => ({
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

vi.mock('../../../src/components/MyWork/table/useUndoRedo', () => ({
  useUndoRedo: () => ({
    state: [],
    push: vi.fn(),
    set: vi.fn(),
    undo: vi.fn(),
    redo: vi.fn(),
    canUndo: false,
    canRedo: false,
  }),
}));

// Two fake rows are enough to exercise the real renderRow path — the point
// of this test is the banner, not row content, so processedRows stays tiny
// regardless of what the (mocked) cap decision claims the true total is.
const fakeNodes = [
  { id: 'row-1', type: 'idea', data: { label: 'Row one' } },
  { id: 'row-2', type: 'idea', data: { label: 'Row two' } },
];

vi.mock('../../../src/components/MyWork/table/useTableRows', () => ({
  useTableRows: () => ({
    nodes: fakeNodes,
    processedRows: fakeNodes,
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

vi.mock('../../../src/components/MyWork/table/useRollupComputation', () => ({
  useRollupComputation: (rows: any[]) => rows,
}));

vi.mock('../../../src/components/MyWork/table/useTablePersistence', () => ({
  useTablePersistence: (...args: any[]) => useTablePersistenceMock(...args),
}));

vi.mock('../../../src/components/MyWork/table/useTableQuickActions', () => ({
  useTableQuickActions: vi.fn(),
}));

vi.mock('../../../src/components/MyWork/table/useTableKeyboard', () => ({
  useTableKeyboard: vi.fn(),
}));

vi.mock('../../../src/components/MyWork/table/CollaborationPresence', () => ({
  CellCursor: () => null,
  CollaborationPresence: () => null,
  WorkspaceLockIndicator: () => null,
  WorkspacePresenceIndicator: () => null,
}));

vi.mock('../../../src/components/MyWork/table/PresenceIndicators', () => ({
  PresenceIndicators: () => null,
  TableRealtimeStatusIndicator: () => null,
}));

vi.mock('../../../src/components/MyWork/table/views/ViewRouter', () => ({
  ViewRouter: () => <div data-testid="view-router" />,
}));

vi.mock('../../../src/components/MyWork/table/GridView', () => ({
  GridView: () => <div data-testid="grid-view" />,
}));

vi.mock('../../../src/components/MyWork/table/tableRowLimits', () => ({
  MAX_TABLE_ROWS: 500,
  applyCsvImportCap: vi.fn(() => ({ rowsToImport: [], truncatedCount: 0, blocked: false })),
  computeRowRenderCap: (...args: any[]) => computeRowRenderCapMock(...args),
}));

import { IdeaTableTool } from '../../../src/components/MyWork/IdeaTableTool';

describe('IdeaTableTool row-render-cap banner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useTablePersistenceMock.mockReturnValue({
      loading: false,
      saving: false,
      saveStatusLabel: 'Saved just now',
      handleSave: vi.fn(),
      loadError: null,
      refresh: refreshMock,
    });
  });

  it('shows the honest "showing first N of M" banner when the cap hid rows', () => {
    computeRowRenderCapMock.mockReturnValue({
      groups: null,
      rows: fakeNodes,
      totalCount: 5000,
      shownCount: 2,
    });

    render(<IdeaTableTool open ideaId="idea-1" />);

    const banner = screen.getByTestId('idea-table-row-cap-banner');
    expect(banner).toHaveTextContent(
      'Showing first 2 of 5000 rows — 4998 more are not rendered to keep the table responsive. Export or filter to see the rest.'
    );
  });

  it('shows no banner at all when nothing was hidden by the cap', () => {
    computeRowRenderCapMock.mockReturnValue({
      groups: null,
      rows: fakeNodes,
      totalCount: 2,
      shownCount: 2,
    });

    render(<IdeaTableTool open ideaId="idea-1" />);

    expect(screen.queryByTestId('idea-table-row-cap-banner')).not.toBeInTheDocument();
  });
});
