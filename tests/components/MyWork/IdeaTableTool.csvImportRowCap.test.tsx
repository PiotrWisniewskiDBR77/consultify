/**
 * @vitest-environment jsdom
 *
 * G4-TABLE-SCALE — proves `IdeaTableTool.handleCSVImport` is actually wired
 * to the `applyCsvImportCap` guard (src/components/MyWork/table/
 * tableRowLimits.ts) and surfaces the right toast in both outcomes:
 *   - import truncated because it would cross MAX_TABLE_ROWS
 *   - import blocked entirely because the table is already at/over the cap
 *
 * `tableRowLimits` is mocked here so this test stays fast and does not mount
 * hundreds of real `<tr>` rows — the cap MATH itself (500, truncation count,
 * blocked boundary) is covered separately and exhaustively by
 * tests/unit/components/MyWork/table/tableRowLimits.test.ts. This file only
 * proves the wiring: IdeaTableTool calls the guard with the real current row
 * count and the real parsed CSV rows, and reacts correctly to its decision.
 */
import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react';
import { toast } from 'react-hot-toast';
import { describe, expect, it, vi, beforeEach } from 'vitest';

const refreshMock = vi.fn();
const useTablePersistenceMock = vi.fn();
const applyCsvImportCapMock = vi.fn();

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
    viewLayout: 'grid',
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

vi.mock('../../../src/components/MyWork/table/useTableRows', () => ({
  useTableRows: () => ({
    nodes: [],
    processedRows: [],
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

// The guard under test: mocked so this file stays fast/deterministic. Its
// real math is covered by tests/unit/components/MyWork/table/
// tableRowLimits.test.ts — this file only proves IdeaTableTool calls it and
// reacts to it correctly.
vi.mock('../../../src/components/MyWork/table/tableRowLimits', () => ({
  MAX_TABLE_ROWS: 500,
  applyCsvImportCap: (...args: any[]) => applyCsvImportCapMock(...args),
  computeRowRenderCap: (rows: any[], grouped: any) =>
    grouped
      ? { groups: Object.entries(grouped), rows: null, totalCount: 0, shownCount: 0 }
      : { groups: null, rows, totalCount: rows.length, shownCount: rows.length },
}));

import { IdeaTableTool } from '../../../src/components/MyWork/IdeaTableTool';

function csvFile(rowCount: number): File {
  const lines = ['label'];
  for (let i = 0; i < rowCount; i++) lines.push(`row-${i}`);
  return new File([lines.join('\n')], 'import.csv', { type: 'text/csv' });
}

describe('IdeaTableTool CSV import row cap (wiring)', () => {
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

  it('shows the truncation toast (not the plain success toast) when the guard reports rows were skipped', async () => {
    // Table currently has 0 rows (real nodes:[] from the mocked useTableRows);
    // guard says "took 3, skipped 2" for a 5-row CSV.
    applyCsvImportCapMock.mockReturnValue({
      rowsToImport: [['row-0'], ['row-1'], ['row-2']],
      truncatedCount: 2,
      blocked: false,
    });

    const { container } = render(<IdeaTableTool open ideaId="idea-1" />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).toBeTruthy();

    fireEvent.change(input, { target: { files: [csvFile(5)] } });

    await waitFor(() => {
      expect(applyCsvImportCapMock).toHaveBeenCalledTimes(1);
    });
    // Called with (current row count, parsed CSV rows[]) — current count is 0
    // from the mocked useTableRows/nodes:[].
    expect(applyCsvImportCapMock).toHaveBeenCalledWith(0, expect.arrayContaining([['row-0']]));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        'Imported {{imported}} of {{total}} rows — table limit is {{max}} rows. {{skipped}} rows were not imported.'
      );
    });
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('shows the blocked toast and imports nothing when the guard reports the table is already at the cap', async () => {
    applyCsvImportCapMock.mockReturnValue({
      rowsToImport: [],
      truncatedCount: 5,
      blocked: true,
    });

    const { container } = render(<IdeaTableTool open ideaId="idea-1" />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(input, { target: { files: [csvFile(5)] } });

    await waitFor(() => {
      expect(applyCsvImportCapMock).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        'Table has reached the {{max}}-row limit — remove rows before importing more.'
      );
    });
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('shows the plain success toast when the guard reports nothing was truncated', async () => {
    applyCsvImportCapMock.mockReturnValue({
      rowsToImport: [['row-0'], ['row-1']],
      truncatedCount: 0,
      blocked: false,
    });

    const { container } = render(<IdeaTableTool open ideaId="idea-1" />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(input, { target: { files: [csvFile(2)] } });

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Imported {{count}} rows');
    });
    expect(toast.error).not.toHaveBeenCalled();
  });
});
