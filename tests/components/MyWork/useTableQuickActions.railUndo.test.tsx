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
  } = {}
) {
  return renderHook(() =>
    useTableQuickActions({
      ideaId: 'idea-1',
      isPl: true,
      columns: [],
      nodes: [],
      nodesUndo,
      selectedRowIds: new Set<string>(),
      handlers,
      savedViews: viewOpts.savedViews ?? DEFAULT_SAVED_VIEWS,
      sort: viewOpts.sort ?? null,
      filters: viewOpts.filters ?? { logic: 'and', rules: [] },
      groupBy: viewOpts.groupBy ?? null,
      viewLayout: viewOpts.viewLayout ?? 'table',
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
