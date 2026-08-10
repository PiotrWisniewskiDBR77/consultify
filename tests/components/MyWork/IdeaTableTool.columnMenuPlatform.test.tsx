/**
 * @vitest-environment jsdom
 *
 * IdeaTableTool — column-menu Hide/Delete/Rename must be platform-aware
 * (defect fix, 2026-08-10).
 *
 * Root cause (documented in ideaActionRegistry.ts's N8.2 column-menu block
 * and 02_EXECUTION_LEDGER.csv row E02-N8.2-COLUMN-MENU): the column
 * context-menu's Hide/Delete items and the header's inline-rename input
 * called the LEGACY toggleColumn/deleteColumn/renameColumn unconditionally,
 * ignoring this file's own `usePlatform ? platformIntegration.X : X`
 * convention that the rendered headers (`_visCols`) already follow.
 *
 * VERIFIED REACHABILITY CORRECTION (2026-08-10, found while building this
 * test — the original draft tried to render `colContextMenu` with
 * `usePlatform: true` and it never appeared): the ledger's "same `<table>`
 * renders in BOTH modes" premise does NOT hold on this HEAD. `IdeaTableTool`'s
 * content-area ternary checks `usePlatform ? <P15ViewRouter .../> : ...`
 * BEFORE it ever reaches the legacy `<table>` branch that owns
 * `colContextMenu`/inline-rename (git blame: that branch predates this
 * program by months, commit 2291c6c8b47). So whenever `usePlatform` is true,
 * `P15ViewRouter` replaces the WHOLE content pane and the legacy
 * `colContextMenu` cannot be opened by a human click — the click-side of
 * this defect is dead code today, not a live bug a user can trigger.
 *
 * The bug WAS live on a different, always-mounted path: Teresa's
 * `idea-workspace-quick-action` bus (`tbl_column_hide`/`_delete`/`_rename` in
 * `useTableQuickActions.ts`), which `IdeaTableTool` wires up unconditionally
 * via `useTableQuickActions({ ..., handlers: { toggleColumn: ..., ... } })`
 * regardless of which content branch renders. Before the fix, that call site
 * passed the bare legacy functions even when `usePlatform` was true, so
 * Teresa's `idea.column.hide/delete/rename` (colKey-addressed, not
 * click-addressed) silently hit dead legacy state — Delete additionally
 * fired a "Column deleted" toast for a deletion that never reached the
 * server. THIS is the reachable defect the fix closes.
 *
 * Test A proves the fix on the reachable path: the object `IdeaTableTool`
 * hands to `useTableQuickActions` carries the PLATFORM toggleColumn/
 * deleteColumn/renameColumn (not legacy) whenever `usePlatform` is true.
 * Test B is a regression guard on the one UI mode where `colContextMenu`
 * IS reachable (`usePlatform: false`, i.e. no platform table configured):
 * Hide/Delete/Rename still call the (correct, LEGACY) functions there, and
 * Delete now asks for confirmation first (previously it deleted immediately).
 */
import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

const refreshMock = vi.fn();
const useTablePersistenceMock = vi.fn();
const legacyToggleColumn = vi.fn();
const legacyRenameColumn = vi.fn();
const legacyDeleteColumn = vi.fn();
const platformToggleColumn = vi.fn();
const platformRenameColumn = vi.fn();
const platformDeleteColumn = vi.fn();

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'en' },
    t: (_key: string, fallback?: any) =>
      typeof fallback === 'string' ? fallback : (fallback?.defaultValue ?? _key),
  }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

vi.mock('react-hot-toast', () => ({
  default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
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

const platformColumns = [
  { key: 'score', header: 'Score', type: 'text', visible: true, width: 160 },
];
const platformNode = { id: 'row-1', data: { score: 'x' } };

// `active` is mutable per-test (see Test A vs Test B below): `usePlatform`
// in IdeaTableTool.tsx is `platformActive && !(platformLooksEmpty &&
// legacyLooksPopulated)`, so toggling `active` here toggles `usePlatform`.
let platformActiveForTest = true;
const platformIntegrationMock = vi.fn(() => ({
  active: platformActiveForTest,
  loading: false,
  saving: false,
  saveStatusLabel: '',
  error: null,
  columns: platformColumns,
  setColumns: vi.fn(),
  visibleColumns: platformColumns,
  toggleColumn: platformToggleColumn,
  handleAddColumn: vi.fn(),
  renameColumn: platformRenameColumn,
  deleteColumn: platformDeleteColumn,
  nodes: [platformNode],
  processedRows: [platformNode],
  groupedRows: null,
  selectedRowIds: new Set(),
  setSelectedRowIds: vi.fn(),
  toggleRowSelection: vi.fn(),
  handleFieldChange: vi.fn(),
  handleAddRow: vi.fn(),
  handleBulkDelete: vi.fn(),
  handleDeleteRow: vi.fn(),
  handleDuplicateRow: vi.fn(),
  // 'table' (not 'grid'/'kanban'/'calendar'): those three route to
  // LegacyViewRouter in platform mode — irrelevant to Test A, which never
  // depends on what the content pane renders (see file-header comment).
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
}));

vi.mock('../../../src/components/MyWork/table/useTablePlatformIntegration', () => ({
  useTablePlatformIntegration: () => platformIntegrationMock(),
}));

vi.mock('../../../src/components/MyWork/table/useTableRealtime', () => ({
  useTableRealtime: () => ({ presence: [], connectionState: 'idle' }),
}));

// Legacy schema hook. In Test A (usePlatform: true) these spies must stay
// UNCALLED by the fixed column-menu actions — if any fires, the bug is back
// (routing fell through to legacy instead of platformIntegration). In Test B
// (usePlatform: false — the one UI mode where the legacy `<table>` and its
// `colContextMenu`/inline-rename actually render) these ARE the correct,
// expected functions to be called.
const legacyColumns = [
  { key: 'score', header: 'Score', type: 'text', visible: true, width: 160 },
];
vi.mock('../../../src/components/MyWork/table/useTableSchema', () => ({
  useTableSchema: () => ({
    columns: legacyColumns,
    setColumns: vi.fn(),
    visibleColumns: legacyColumns,
    toggleColumn: legacyToggleColumn,
    handleAddColumn: vi.fn(),
    renameColumn: legacyRenameColumn,
    updateColumnConfig: vi.fn(),
    deleteColumn: legacyDeleteColumn,
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
    set: vi.fn(),
    push: vi.fn(),
    undo: vi.fn(),
    redo: vi.fn(),
    canUndo: false,
    canRedo: false,
  }),
}));

const legacyNode = { id: 'legacy-row-1', data: { score: 'x' } };
vi.mock('../../../src/components/MyWork/table/useTableRows', () => ({
  useTableRows: () => ({
    nodes: [legacyNode],
    processedRows: [legacyNode],
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

import { IdeaTableTool } from '../../../src/components/MyWork/IdeaTableTool';
import { useTableQuickActions } from '../../../src/components/MyWork/table/useTableQuickActions';

const useTableQuickActionsMock = vi.mocked(useTableQuickActions);

describe('IdeaTableTool — column menu is platform-aware (defect fix, 2026-08-10)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    platformActiveForTest = true;
    useTablePersistenceMock.mockReturnValue({
      loading: false,
      saving: false,
      saveStatusLabel: 'Saved just now',
      handleSave: vi.fn(),
      loadError: null,
      refresh: refreshMock,
    });
  });

  describe('Test A — Teresa dispatch path (usePlatform: true, the actually-reachable mode)', () => {
    // `usePlatform` is true here (platformIntegration.active), which means
    // P15ViewRouter owns the whole content pane and the legacy
    // colContextMenu/inline-rename JSX cannot be opened by a click (see
    // file-header comment). `useTableQuickActions` is mounted unconditionally
    // regardless of that render branch, so this proves the fix on the path a
    // real Teresa call actually takes: `colKey`-addressed, click-independent.
    it('wires useTableQuickActions with the PLATFORM toggleColumn/deleteColumn/renameColumn, never legacy', () => {
      render(<IdeaTableTool open ideaId="idea-1" />);

      expect(useTableQuickActionsMock).toHaveBeenCalled();
      const { handlers } = useTableQuickActionsMock.mock.calls[0][0] as {
        handlers: Record<string, unknown>;
      };

      expect(handlers.toggleColumn).toBe(platformToggleColumn);
      expect(handlers.deleteColumn).toBe(platformDeleteColumn);
      expect(handlers.renameColumn).toBe(platformRenameColumn);
      expect(handlers.toggleColumn).not.toBe(legacyToggleColumn);
      expect(handlers.deleteColumn).not.toBe(legacyDeleteColumn);
      expect(handlers.renameColumn).not.toBe(legacyRenameColumn);
    });
  });

  describe('Test B — human-click regression guard (usePlatform: false, the only mode colContextMenu renders in)', () => {
    beforeEach(() => {
      platformActiveForTest = false;
    });

    function openColumnMenu() {
      render(<IdeaTableTool open ideaId="idea-1" />);
      const header = screen.getByText('Score');
      fireEvent.contextMenu(header);
      return within(screen.getByTestId('idea-table-column-context-menu'));
    }

    it('Hide column calls the (correct, legacy) toggleColumn', () => {
      const menu = openColumnMenu();
      fireEvent.click(menu.getByRole('menuitem', { name: 'Hide column' }));

      expect(legacyToggleColumn).toHaveBeenCalledTimes(1);
      expect(legacyToggleColumn).toHaveBeenCalledWith('score');
      expect(platformToggleColumn).not.toHaveBeenCalled();
    });

    it('Delete column now asks for confirmation before calling deleteColumn (previously deleted immediately)', () => {
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
      const menu = openColumnMenu();
      fireEvent.click(menu.getByRole('menuitem', { name: 'Delete column' }));

      expect(confirmSpy).toHaveBeenCalledTimes(1);
      expect(legacyDeleteColumn).toHaveBeenCalledTimes(1);
      expect(legacyDeleteColumn).toHaveBeenCalledWith('score');
      expect(platformDeleteColumn).not.toHaveBeenCalled();
      confirmSpy.mockRestore();
    });

    it('Delete column does nothing (no toast, no mutation) when the confirmation is declined', () => {
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
      const menu = openColumnMenu();
      fireEvent.click(menu.getByRole('menuitem', { name: 'Delete column' }));

      expect(confirmSpy).toHaveBeenCalledTimes(1);
      expect(legacyDeleteColumn).not.toHaveBeenCalled();
      expect(platformDeleteColumn).not.toHaveBeenCalled();
      confirmSpy.mockRestore();
    });

    it('inline header rename (double-click → type → Enter) calls the (correct, legacy) renameColumn', async () => {
      render(<IdeaTableTool open ideaId="idea-1" />);
      fireEvent.doubleClick(screen.getByText('Score'));

      const input = await screen.findByRole('textbox', {
        name: /New column name/i,
      });
      fireEvent.change(input, { target: { value: 'Priority' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      await waitFor(() => {
        expect(legacyRenameColumn).toHaveBeenCalledTimes(1);
      });
      expect(legacyRenameColumn).toHaveBeenCalledWith('score', 'Priority');
      expect(platformRenameColumn).not.toHaveBeenCalled();
    });
  });
});
