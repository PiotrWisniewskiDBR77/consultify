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

function render(handlers: QuickActionHandlers) {
  return renderHook(() =>
    useTableQuickActions({
      ideaId: 'idea-1',
      isPl: true,
      columns: [],
      nodes: [],
      nodesUndo,
      selectedRowIds: new Set<string>(),
      handlers,
    })
  );
}

function emit(action: string) {
  window.dispatchEvent(new CustomEvent('idea-workspace-quick-action', { detail: { action } }));
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
