/**
 * TableToolbar — Program B (E02), N10 (2026-08-10): platform-surface toolbar
 * handlers now route through the Action Registry (`runAction` → `runIdeaAction`,
 * same dual-path contract as `WhiteboardToolbar.tsx`). This locks the
 * behavioural contract the wiring pass promised: a human click still calls
 * the EXACT SAME prop/context function it called before the migration
 * (`ctx.params.run` executed synchronously by the registry's UI-path
 * handlers), just traceable through `runIdeaAction` now.
 *
 * Does NOT re-assert everything `TableToolbar.commandrow.test.tsx` /
 * `TableToolbar.moreToolsAndAi.test.tsx` already cover (Scoring Model routing,
 * overflow collapse, More-only platform tools) — only the paths newly wired
 * in this pass: Save / Add row / Bulk delete / Heatmap toggle / bulk Convert
 * / saved-view context menu (platform path).
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/services/api/tablePlatform.api', () => ({
  createRecord: vi.fn(),
}));

const baseCtx = {
  active: true,
  base: null,
  table: null,
  tableId: null,
  refresh: vi.fn(),
  locked: false,
  isPl: false,
  columns: [],
  visibleColumns: [],
  savedViews: [
    { id: 'default', name: 'Default' },
    { id: 'view-1', name: 'My view' },
  ],
  activeViewId: 'default',
  applyView: vi.fn(),
  saveCurrentView: vi.fn(),
  updateSavedView: vi.fn(),
  deleteSavedView: vi.fn(),
  filters: { logic: 'and', rules: [] },
  setFilters: vi.fn(),
  sort: null,
  setSort: vi.fn(),
  groupBy: null,
  setGroupBy: vi.fn(),
  viewLayout: 'table',
  setViewLayout: vi.fn(),
  selectedRowIds: new Set<string>(['row-1']),
  handleAddRow: vi.fn(),
  handleAddColumn: vi.fn(),
  handleBulkDelete: vi.fn(),
  handleSave: vi.fn(),
  saving: false,
  loading: false,
  saveStatusLabel: '',
  toggleColumn: vi.fn(),
  platformFields: [],
  applyPlatformFilters: vi.fn(),
  ui: { showFilters: false, showAuditTrail: false, showActivityFeed: false, platformTab: 'data' },
  uiDispatch: vi.fn(),
  processedRows: [],
  handleFieldChange: vi.fn(),
};

vi.mock('../../../src/components/MyWork/table/TableDataProvider', () => ({
  useTableData: () => baseCtx,
}));

import { TableToolbar } from '../../../src/components/MyWork/table/TableToolbar';

const Noop = () => null;

function makeProps(over: Record<string, unknown> = {}) {
  return {
    ideaId: 'idea-1',
    nodesUndo: { canUndo: true, canRedo: true, undo: vi.fn(), redo: vi.fn() },
    onPlatformUndo: vi.fn(),
    onCSVImport: vi.fn(),
    onExportCSV: vi.fn(),
    onCopyToClipboard: vi.fn(),
    onAddRowWithTemplate: vi.fn(),
    onBulkConvert: vi.fn(),
    onShowAIAssistant: vi.fn(),
    onShowAICategorize: vi.fn(),
    onShowScoringModel: vi.fn(),
    onShowExportPresentation: vi.fn(),
    onShowPipeline: vi.fn(),
    onShowCopilot: vi.fn(),
    onShowVoiceInput: vi.fn(),
    onShowCrossRelations: vi.fn(),
    onShowFrameworkGen: vi.fn(),
    onShowConditionalFmt: vi.fn(),
    onShowKeyboardShortcuts: vi.fn(),
    connectors: { connectors: [] },
    onShowConnectorWizard: vi.fn(),
    onShowConnectorList: vi.fn(),
    onShowWebhookRelays: vi.fn(),
    onShowAutomationsManager: vi.fn(),
    onShowSyncManager: vi.fn(),
    onShowSharingManager: vi.fn(),
    onShowDistributionManager: vi.fn(),
    onShowConsultifyLink: vi.fn(),
    heatmapColumns: new Set<string>(),
    showHeatmap: false,
    onToggleHeatmap: vi.fn(),
    onToggleHeatmapColumn: vi.fn(),
    heatmapPalette: 'default',
    onHeatmapPaletteChange: vi.fn(),
    activePalette: 'default',
    onAutoAssignColors: vi.fn(),
    onPaletteChange: vi.fn(),
    formatRules: [],
    realtime: { presence: [], connectionState: 'connected' },
    isV8MultiplayerEnabled: false,
    currentUserId: 'u1',
    currentUserName: 'User',
    workspaceId: 'ws1',
    remotePresenceUsers: [],
    onPresenceUpdate: vi.fn(),
    filterInput: '',
    onFilterInputChange: vi.fn(),
    FilterBuilderComponent: Noop,
    FilterPanelComponent: Noop,
    HeatmapControlsComponent: Noop,
    ColorPaletteComponent: Noop,
    MobileToolbarMenuComponent: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    ),
    BatchAIFillButtonComponent: Noop,
    WorkspacePresenceIndicatorComponent: Noop,
    WorkspaceLockIndicatorComponent: Noop,
    CollaborationPresenceComponent: Noop,
    PresenceIndicatorsComponent: Noop,
    ...over,
  } as any;
}

describe('TableToolbar — Action Registry wiring (N10, 2026-08-10)', () => {
  it('Save button still calls handleSave (idea.canvas.tbl_save, toolbar surface)', () => {
    render(<TableToolbar {...makeProps()} />);
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    expect(baseCtx.handleSave).toHaveBeenCalledTimes(1);
  });

  it('Row button still calls handleAddRow (table.rows.add_row, toolbar surface)', () => {
    render(<TableToolbar {...makeProps()} />);
    fireEvent.click(screen.getByRole('button', { name: /^row$/i }));
    expect(baseCtx.handleAddRow).toHaveBeenCalledTimes(1);
  });

  it('bulk-selection Delete button still calls handleBulkDelete (table.rows.bulk_delete, toolbar surface)', () => {
    render(<TableToolbar {...makeProps()} />);
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }));
    expect(baseCtx.handleBulkDelete).toHaveBeenCalledTimes(1);
  });

  it('bulk Convert menu still calls props.onBulkConvert with the picked target', () => {
    const props = makeProps();
    render(<TableToolbar {...props} />);
    fireEvent.click(screen.getByRole('button', { name: /convert/i }));
    fireEvent.click(screen.getByText(/initiative/i));
    expect(props.onBulkConvert).toHaveBeenCalledWith('initiative');
  });

  it('overflow Heatmap item still calls props.onToggleHeatmap (idea.view.table_heatmap)', () => {
    const props = makeProps();
    render(<TableToolbar {...props} />);
    fireEvent.click(screen.getByRole('button', { name: /^more$|więcej/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: /heatmap/i }));
    expect(props.onToggleHeatmap).toHaveBeenCalledTimes(1);
  });

  it('overflow AI Categorize item still calls props.onShowAICategorize (idea.ai.table_categorize, toolbar surface added)', () => {
    const props = makeProps();
    render(<TableToolbar {...props} />);
    fireEvent.click(screen.getByRole('button', { name: /^more$|więcej/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: /ai categorize/i }));
    expect(props.onShowAICategorize).toHaveBeenCalledTimes(1);
  });

  it('overflow Framework Generator item still calls props.onShowFrameworkGen (idea.ai.table_framework, toolbar surface added)', () => {
    const props = makeProps();
    render(<TableToolbar {...props} />);
    fireEvent.click(screen.getByRole('button', { name: /^more$|więcej/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: /framework generator/i }));
    expect(props.onShowFrameworkGen).toHaveBeenCalledTimes(1);
  });

  it('view tab click still calls applyView (idea.view.table_apply_view, UI-only)', () => {
    render(<TableToolbar {...makeProps()} />);
    fireEvent.click(screen.getByRole('button', { name: /^my view$/i }));
    expect(baseCtx.applyView).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'view-1', name: 'My view' })
    );
  });

  it('saved-view context menu "Rename" still opens the inline editor (idea.view.table_platform_saved_view_rename, real Teresa receiver for the click)', () => {
    render(<TableToolbar {...makeProps()} />);
    fireEvent.contextMenu(screen.getByRole('button', { name: /^my view$/i }));
    fireEvent.click(screen.getByText(/^rename$/i));
    // Inline rename input appears, pre-filled with the current name.
    expect(screen.getByDisplayValue('My view')).toBeInTheDocument();
  });

  it('saved-view context menu "Delete" still calls ctx.deleteSavedView (idea.view.table_platform_saved_view_delete, real Teresa receiver)', () => {
    render(<TableToolbar {...makeProps()} />);
    fireEvent.contextMenu(screen.getByRole('button', { name: /^my view$/i }));
    // `selectedRowIds` (fixture) is non-empty, so the bulk-actions "Delete"
    // button also renders with the exact same text — the context menu's
    // "Delete" is the FIRST match (it renders earlier in the JSX tree).
    const [contextMenuDelete] = screen.getAllByText(/^delete$/i);
    fireEvent.click(contextMenuDelete);
    expect(baseCtx.deleteSavedView).toHaveBeenCalledWith('view-1');
  });

  it('Add-from-template chevron still calls props.onAddRowWithTemplate (idea.view.table_add_row_with_template, UI-only)', () => {
    const props = makeProps();
    render(<TableToolbar {...props} />);
    fireEvent.click(screen.getByTitle('Add from template'));
    expect(props.onAddRowWithTemplate).toHaveBeenCalledTimes(1);
  });
});
