/**
 * T2.2 (sweep L1) — M08 Table rail Undo/Redo wiring.
 *
 * The canvas rail (CanvasLeftToolbar) now emits `tbl_undo`/`tbl_redo` for the
 * Table tool (was `mm_*` → routed to the unmounted mind map = dead). This test
 * locks the routing: dispatching the rail action runs the table's onUndo/onRedo
 * handlers, and existing toggle actions keep working (regression guard).
 */
import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  useTableQuickActions,
  type QuickActionHandlers,
} from '../../../src/components/MyWork/table/useTableQuickActions';

vi.mock('@/services/api', () => ({ Api: { generateIdeaAI: vi.fn() } }));
vi.mock('@/services/funnelAnalytics', () => ({ trackFunnelEvent: vi.fn() }));
vi.mock('../../../src/components/MyWork/table/csvUtils', () => ({
  downloadCSV: vi.fn(),
  exportToCSV: vi.fn(() => ''),
}));

function makeHandlers(over: Partial<QuickActionHandlers> = {}): QuickActionHandlers {
  const noop = vi.fn();
  return {
    handleAddRow: vi.fn(),
    setShowRowTemplatePicker: noop,
    setAddRowBtnRect: noop,
    setShowAddColumn: noop,
    setSort: noop as any,
    setShowFilterPanel: noop,
    setShowAIAssistant: noop,
    setShowFrameworkGen: noop,
    setViewLayout: noop as any,
    setShowSummaryDashboard: noop,
    setShowColorPalette: noop,
    setShowAICategorize: noop,
    setShowScoringModel: noop,
    setShowExportPresentation: noop,
    setShowPipeline: noop,
    setShowCopilot: noop,
    setShowVoiceInput: noop,
    setShowCrossRelations: noop,
    setShowHeatmap: noop,
    onUndo: vi.fn(),
    onRedo: vi.fn(),
    // N8 (2026-08-10) — saved-view menu (tbl_view_rename/update/delete).
    updateSavedView: vi.fn(),
    deleteSavedView: vi.fn(),
    // N10 (2026-08-10) — PLATFORM saved-view menu (TableToolbar.tsx,
    // tbl_view_rename_platform/tbl_view_delete_platform). Separate mocks —
    // real code passes `platformIntegration.updateSavedView`/
    // `.deleteSavedView` here, not the legacy pair above.
    platformUpdateSavedView: vi.fn(),
    platformDeleteSavedView: vi.fn(),
    // N8.2 (2026-08-10) — column menu (tbl_column_rename/sort/hide/delete).
    cycleSort: vi.fn(),
    toggleColumn: vi.fn(),
    deleteColumn: vi.fn(),
    renameColumn: vi.fn(),
    // N8.2 (2026-08-10) — row context menu (tbl_row_edit/note/duplicate/delete).
    openRowEditPanel: vi.fn(),
    openRowNotePanel: vi.fn(),
    duplicateRow: vi.fn(),
    deleteRow: vi.fn(),
    // N9 (2026-08-10) — cell menu (tbl_cell_clear). In the real component this
    // is `_fieldChange`, the SAME dual-path (legacy vs platform) callback the
    // human "Clear cell" click uses.
    fieldChange: vi.fn(),
    ...over,
  };
}

const nodesUndo = {
  state: [],
  push: vi.fn(),
  set: vi.fn(),
  undo: vi.fn(),
  redo: vi.fn(),
  canUndo: false,
  canRedo: false,
} as any;

const DEFAULT_SAVED_VIEWS = [
  { id: 'default', name: 'Default' },
  { id: 'triage', name: 'Triage', groupBy: 'status' },
];

function render(
  handlers: QuickActionHandlers,
  viewOpts: {
    savedViews?: typeof DEFAULT_SAVED_VIEWS;
    sort?: { key: string; direction: 'asc' | 'desc' } | null;
    filters?: { logic: 'and' | 'or'; rules: unknown[] };
    groupBy?: string | null;
    viewLayout?: 'table' | 'kanban' | 'timeline' | 'calendar' | 'matrix' | 'grid' | 'sticky';
    /**
     * N8.2 — menu kolumny waliduje `colKey` po tej liście (domyślnie pusta).
     * N9 (2026-08-10) — `type` i `locked` dołożone dla guardu
     * `tbl_cell_clear`; wszystkie pola opcjonalne poza `key`, żeby oba
     * zestawy literałów testowych (kolumnowy i komórkowy) typowały się bez
     * zmian.
     */
    columns?: Array<{ key: string; header?: string; visible?: boolean; width?: number; type?: string }>;
    locked?: boolean;
    /** N10 (2026-08-10) — separate list, defaults to the same fixture. */
    platformSavedViews?: typeof DEFAULT_SAVED_VIEWS;
  } = {}
) {
  return renderHook(() =>
    useTableQuickActions({
      ideaId: 'idea-1',
      isPl: true,
      columns: viewOpts.columns ?? [],
      locked: viewOpts.locked ?? false,
      nodes: [],
      nodesUndo,
      selectedRowIds: new Set<string>(),
      handlers,
      savedViews: viewOpts.savedViews ?? DEFAULT_SAVED_VIEWS,
      sort: viewOpts.sort ?? null,
      filters: viewOpts.filters ?? { logic: 'and', rules: [] },
      groupBy: viewOpts.groupBy ?? null,
      viewLayout: viewOpts.viewLayout ?? 'table',
      platformSavedViews: viewOpts.platformSavedViews ?? DEFAULT_SAVED_VIEWS,
    } as any)
  );
}

function emit(action: string, extra: Record<string, unknown> = {}) {
  window.dispatchEvent(
    new CustomEvent('idea-workspace-quick-action', { detail: { action, ...extra } })
  );
}

afterEach(() => vi.clearAllMocks());

describe('useTableQuickActions — rail undo/redo', () => {
  it('routes tbl_undo to the onUndo handler', () => {
    const handlers = makeHandlers();
    render(handlers);
    emit('tbl_undo');
    expect(handlers.onUndo).toHaveBeenCalledTimes(1);
    expect(handlers.onRedo).not.toHaveBeenCalled();
  });

  it('routes tbl_redo to the onRedo handler', () => {
    const handlers = makeHandlers();
    render(handlers);
    emit('tbl_redo');
    expect(handlers.onRedo).toHaveBeenCalledTimes(1);
    expect(handlers.onUndo).not.toHaveBeenCalled();
  });

  it('does not treat the dead mind-map prefix (mm_undo) as a table action', () => {
    const handlers = makeHandlers();
    render(handlers);
    emit('mm_undo');
    expect(handlers.onUndo).not.toHaveBeenCalled();
  });

  it('still routes existing toggle actions (regression guard)', () => {
    const handlers = makeHandlers();
    render(handlers);
    emit('tbl_add_row');
    expect(handlers.handleAddRow).toHaveBeenCalledTimes(1);
  });
});

// N8 (2026-08-10) — idea.view.saved_view_rename/update/delete Teresa bus path
// (ideaActionRegistry.ts). The UI click path (viewContextMenu's onSelect +
// inline-rename input in IdeaTableTool.tsx) is untouched and not exercised
// here — this covers only the new tbl_view_* receivers this change adds.
describe('useTableQuickActions — saved view menu (tbl_view_*)', () => {
  it('routes tbl_view_rename to updateSavedView with a name-only patch', () => {
    const handlers = makeHandlers();
    render(handlers);
    emit('tbl_view_rename', { viewId: 'triage', name: 'Renamed' });
    expect(handlers.updateSavedView).toHaveBeenCalledTimes(1);
    expect(handlers.updateSavedView).toHaveBeenCalledWith('triage', { name: 'Renamed' });
    expect(handlers.deleteSavedView).not.toHaveBeenCalled();
  });

  it('routes tbl_view_update to updateSavedView with the current view-state snapshot', () => {
    const handlers = makeHandlers();
    render(handlers, {
      sort: { key: 'score', direction: 'desc' },
      groupBy: 'status',
      viewLayout: 'kanban',
    });
    emit('tbl_view_update', { viewId: 'triage' });
    expect(handlers.updateSavedView).toHaveBeenCalledTimes(1);
    expect(handlers.updateSavedView).toHaveBeenCalledWith('triage', {
      sort: [{ key: 'score', direction: 'desc' }],
      filters: { logic: 'and', rules: [] },
      groupBy: 'status',
      layout: 'kanban',
      columns: [],
    });
  });

  it('routes tbl_view_delete to deleteSavedView', () => {
    const handlers = makeHandlers();
    render(handlers);
    emit('tbl_view_delete', { viewId: 'triage' });
    expect(handlers.deleteSavedView).toHaveBeenCalledTimes(1);
    expect(handlers.deleteSavedView).toHaveBeenCalledWith('triage');
    expect(handlers.updateSavedView).not.toHaveBeenCalled();
  });

  it('does not silently no-op: an unknown viewId calls neither mutation', () => {
    const handlers = makeHandlers();
    render(handlers);
    emit('tbl_view_rename', { viewId: 'does-not-exist', name: 'X' });
    emit('tbl_view_update', { viewId: 'does-not-exist' });
    emit('tbl_view_delete', { viewId: 'does-not-exist' });
    expect(handlers.updateSavedView).not.toHaveBeenCalled();
    expect(handlers.deleteSavedView).not.toHaveBeenCalled();
  });
});

// N10 (2026-08-10) — idea.view.table_platform_saved_view_rename/_delete
// Teresa bus path (ideaActionRegistry.ts). Separate mechanism from the
// legacy tbl_view_* above: TableToolbar.tsx's own view-context menu wires to
// `platformUpdateSavedView`/`platformDeleteSavedView` (real,
// `platformIntegration.updateSavedView`/`.deleteSavedView` in the actual
// component), checked against `platformSavedViews`, not `savedViews`.
describe('useTableQuickActions — PLATFORM saved view menu (tbl_view_*_platform)', () => {
  it('routes tbl_view_rename_platform to platformUpdateSavedView with a name-only patch', () => {
    const handlers = makeHandlers();
    render(handlers);
    emit('tbl_view_rename_platform', { viewId: 'triage', name: 'Renamed' });
    expect(handlers.platformUpdateSavedView).toHaveBeenCalledTimes(1);
    expect(handlers.platformUpdateSavedView).toHaveBeenCalledWith('triage', { name: 'Renamed' });
    expect(handlers.updateSavedView).not.toHaveBeenCalled();
  });

  it('routes tbl_view_delete_platform to platformDeleteSavedView', () => {
    const handlers = makeHandlers();
    render(handlers);
    emit('tbl_view_delete_platform', { viewId: 'triage' });
    expect(handlers.platformDeleteSavedView).toHaveBeenCalledTimes(1);
    expect(handlers.platformDeleteSavedView).toHaveBeenCalledWith('triage');
    expect(handlers.deleteSavedView).not.toHaveBeenCalled();
  });

  it('does not silently no-op: an unknown viewId calls neither platform mutation', () => {
    const handlers = makeHandlers();
    render(handlers);
    emit('tbl_view_rename_platform', { viewId: 'does-not-exist', name: 'X' });
    emit('tbl_view_delete_platform', { viewId: 'does-not-exist' });
    expect(handlers.platformUpdateSavedView).not.toHaveBeenCalled();
    expect(handlers.platformDeleteSavedView).not.toHaveBeenCalled();
  });

  it('checks against platformSavedViews, not the legacy savedViews list', () => {
    const handlers = makeHandlers();
    // "triage" exists only in the legacy fixture here, not in the platform one.
    render(handlers, { platformSavedViews: [{ id: 'default', name: 'Default' }] });
    emit('tbl_view_delete_platform', { viewId: 'triage' });
    expect(handlers.platformDeleteSavedView).not.toHaveBeenCalled();
  });
});

// N8.2 (2026-08-10) — idea.column.rename/sort/hide/delete Teresa bus path
// (ideaActionRegistry.ts). The UI click path (colContextMenu's four onSelect
// callbacks in IdeaTableTool.tsx) is untouched and not exercised here — this
// covers only the new tbl_column_* receivers this change adds.
describe('useTableQuickActions — column menu (tbl_column_*)', () => {
  const COLUMNS = [
    { key: 'label', header: 'Name', visible: true, width: 200 },
    { key: 'score', header: 'Score', visible: true, width: 120 },
  ];

  it('routes tbl_column_rename to renameColumn with the trimmed new name', () => {
    const handlers = makeHandlers();
    render(handlers, { columns: COLUMNS });
    emit('tbl_column_rename', { colKey: 'score', name: '  Priority  ' });
    expect(handlers.renameColumn).toHaveBeenCalledTimes(1);
    expect(handlers.renameColumn).toHaveBeenCalledWith('score', 'Priority');
  });

  it('routes tbl_column_sort to cycleSort (the same dual-path fn the header click uses)', () => {
    const handlers = makeHandlers();
    render(handlers, { columns: COLUMNS });
    emit('tbl_column_sort', { colKey: 'score' });
    expect(handlers.cycleSort).toHaveBeenCalledTimes(1);
    expect(handlers.cycleSort).toHaveBeenCalledWith('score');
  });

  it('routes tbl_column_hide to toggleColumn', () => {
    const handlers = makeHandlers();
    render(handlers, { columns: COLUMNS });
    emit('tbl_column_hide', { colKey: 'score' });
    expect(handlers.toggleColumn).toHaveBeenCalledTimes(1);
    expect(handlers.toggleColumn).toHaveBeenCalledWith('score');
    expect(handlers.deleteColumn).not.toHaveBeenCalled();
  });

  it('routes tbl_column_delete to deleteColumn', () => {
    const handlers = makeHandlers();
    render(handlers, { columns: COLUMNS });
    emit('tbl_column_delete', { colKey: 'score' });
    expect(handlers.deleteColumn).toHaveBeenCalledTimes(1);
    expect(handlers.deleteColumn).toHaveBeenCalledWith('score');
    expect(handlers.toggleColumn).not.toHaveBeenCalled();
  });

  it('does not silently no-op: an unknown colKey calls no column mutation', () => {
    const handlers = makeHandlers();
    render(handlers, { columns: COLUMNS });
    emit('tbl_column_rename', { colKey: 'nope', name: 'X' });
    emit('tbl_column_sort', { colKey: 'nope' });
    emit('tbl_column_hide', { colKey: 'nope' });
    emit('tbl_column_delete', { colKey: 'nope' });
    expect(handlers.renameColumn).not.toHaveBeenCalled();
    expect(handlers.cycleSort).not.toHaveBeenCalled();
    expect(handlers.toggleColumn).not.toHaveBeenCalled();
    expect(handlers.deleteColumn).not.toHaveBeenCalled();
  });

  it('declines a rename with no usable name instead of renaming to an empty header', () => {
    const handlers = makeHandlers();
    render(handlers, { columns: COLUMNS });
    emit('tbl_column_rename', { colKey: 'score' });
    emit('tbl_column_rename', { colKey: 'score', name: '   ' });
    expect(handlers.renameColumn).not.toHaveBeenCalled();
  });
});

// N8.2 (2026-08-10) — table.row.edit/note/duplicate/delete Teresa bus path
// (ideaActionRegistry.ts). The UI click path (rowContextMenu's onSelect in
// IdeaTableTool.tsx) is untouched and not exercised here — these cases cover
// only the four new tbl_row_* receivers, including the routing decision the
// registry documents as deliberate (note → Comments panel, NOT the edit panel).
describe('useTableQuickActions — row context menu (tbl_row_*)', () => {
  it('routes tbl_row_edit to openRowEditPanel with the row id', () => {
    const handlers = makeHandlers();
    render(handlers);
    emit('tbl_row_edit', { rowId: 'row-7' });
    expect(handlers.openRowEditPanel).toHaveBeenCalledTimes(1);
    expect(handlers.openRowEditPanel).toHaveBeenCalledWith('row-7');
    expect(handlers.openRowNotePanel).not.toHaveBeenCalled();
  });

  it('routes tbl_row_note to the SEPARATE note panel, not the edit panel', () => {
    const handlers = makeHandlers();
    render(handlers);
    emit('tbl_row_note', { rowId: 'row-7' });
    expect(handlers.openRowNotePanel).toHaveBeenCalledTimes(1);
    expect(handlers.openRowNotePanel).toHaveBeenCalledWith('row-7');
    // Locks the deliberate routing documented in IdeaTableTool.tsx: "Add note"
    // never lands on the edit target (RecordExpandModal has no comment thread).
    expect(handlers.openRowEditPanel).not.toHaveBeenCalled();
  });

  it('routes tbl_row_duplicate and tbl_row_delete to their own mutations', () => {
    const handlers = makeHandlers();
    render(handlers);
    emit('tbl_row_duplicate', { rowId: 'row-7' });
    expect(handlers.duplicateRow).toHaveBeenCalledTimes(1);
    expect(handlers.duplicateRow).toHaveBeenCalledWith('row-7');
    expect(handlers.deleteRow).not.toHaveBeenCalled();

    emit('tbl_row_delete', { rowId: 'row-9' });
    expect(handlers.deleteRow).toHaveBeenCalledTimes(1);
    expect(handlers.deleteRow).toHaveBeenCalledWith('row-9');
    expect(handlers.duplicateRow).toHaveBeenCalledTimes(1);
  });

  it('does not silently no-op: a missing rowId calls no row handler at all', () => {
    const handlers = makeHandlers();
    render(handlers);
    emit('tbl_row_edit');
    emit('tbl_row_note');
    emit('tbl_row_duplicate');
    emit('tbl_row_delete');
    expect(handlers.openRowEditPanel).not.toHaveBeenCalled();
    expect(handlers.openRowNotePanel).not.toHaveBeenCalled();
    expect(handlers.duplicateRow).not.toHaveBeenCalled();
    expect(handlers.deleteRow).not.toHaveBeenCalled();
  });
});

// N9 (2026-08-10) — idea.cell.clear Teresa bus path (ideaActionRegistry.ts →
// RUNTIME_TBL_CELL_CLEAR → this receiver). Only ONE of the four cell-menu items
// has a bus receiver at all; copy/paste/expand are honestly UI-only (system
// clipboard / screen-anchored popover), so there is nothing to assert for them
// here beyond the registry's decline message, which is covered by the registry's
// own shape. The human-click path (cellContextMenu's onSelect in
// IdeaTableTool.tsx) is untouched by this change and not exercised here.
//
// These cases lock the guard PARITY with what the menu item disables on:
// `locked` and the derived-column rule (`type` / formula = not editable).
const CELL_COLUMNS = [
  { key: 'label', type: 'text' },
  { key: 'type' },
  { key: 'score', type: 'formula' },
];

describe('useTableQuickActions — cell menu (tbl_cell_clear)', () => {
  it('routes tbl_cell_clear to fieldChange with an empty value for that one cell', () => {
    const handlers = makeHandlers();
    render(handlers, { columns: CELL_COLUMNS });
    emit('tbl_cell_clear', { rowId: 'row-1', colKey: 'label' });
    expect(handlers.fieldChange).toHaveBeenCalledTimes(1);
    expect(handlers.fieldChange).toHaveBeenCalledWith('row-1', 'label', '');
  });

  it('refuses without a cell target instead of clearing something arbitrary', () => {
    const handlers = makeHandlers();
    render(handlers, { columns: CELL_COLUMNS });
    emit('tbl_cell_clear', { rowId: 'row-1' });
    emit('tbl_cell_clear', { colKey: 'label' });
    emit('tbl_cell_clear');
    expect(handlers.fieldChange).not.toHaveBeenCalled();
  });

  it('refuses on a locked table (same condition the menu item disables on)', () => {
    const handlers = makeHandlers();
    render(handlers, { columns: CELL_COLUMNS, locked: true });
    emit('tbl_cell_clear', { rowId: 'row-1', colKey: 'label' });
    expect(handlers.fieldChange).not.toHaveBeenCalled();
  });

  it('refuses on derived columns ("type", formula) — the menu\'s editable rule', () => {
    const handlers = makeHandlers();
    render(handlers, { columns: CELL_COLUMNS });
    emit('tbl_cell_clear', { rowId: 'row-1', colKey: 'type' });
    emit('tbl_cell_clear', { rowId: 'row-1', colKey: 'score' });
    expect(handlers.fieldChange).not.toHaveBeenCalled();
  });

  it('refuses an unknown column instead of writing a stray field', () => {
    const handlers = makeHandlers();
    render(handlers, { columns: CELL_COLUMNS });
    emit('tbl_cell_clear', { rowId: 'row-1', colKey: 'does-not-exist' });
    expect(handlers.fieldChange).not.toHaveBeenCalled();
  });
});
