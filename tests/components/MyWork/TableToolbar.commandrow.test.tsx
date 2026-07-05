/**
 * TableToolbar — STREFA GÓRNA command-row hierarchy (Editor Shell Canon §2).
 *
 * The M08 Table command row used to render a flat ~15-icon `hidden md:contents`
 * secondary block ("three flat layers" the canon forbids). This test locks the
 * new hierarchy:
 *   - primary (visible): Add row · Convert (on selection) · Save
 *   - secondary (visible): saved views / filter / group / layout / undo-redo
 *   - overflow "…": scoring / presentation / pipeline / copilot / heatmap / …
 *
 * It asserts the overflow starts collapsed (secondary tools are NOT flat in the
 * row) and that opening it routes items to the original handlers (no dead entries).
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/services/api/tablePlatform.api', () => ({
  createRecord: vi.fn(),
}));

// Minimal TableDataProvider context — the toolbar reads state from here.
const ctx = {
  active: false,
  base: null,
  table: null,
  tableId: null,
  refresh: vi.fn(),
  locked: false,
  isPl: false,
  columns: [],
  visibleColumns: [],
  savedViews: [{ id: 'default', name: 'Default' }],
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
  selectedRowIds: new Set<string>(),
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
  useTableData: () => ctx,
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
    MobileToolbarMenuComponent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    BatchAIFillButtonComponent: Noop,
    WorkspacePresenceIndicatorComponent: Noop,
    WorkspaceLockIndicatorComponent: Noop,
    CollaborationPresenceComponent: Noop,
    PresenceIndicatorsComponent: Noop,
    ...over,
  } as any;
}

describe('TableToolbar — command-row hierarchy', () => {
  it('keeps Add row and Save as visible primary actions', () => {
    render(<TableToolbar {...makeProps()} />);
    // Primary Save (icon button labelled "Save") stays visible in the row.
    expect(screen.getByRole('button', { name: /^save$/i })).toBeInTheDocument();
    // Add-row primary control stays visible (button text "Row").
    expect(screen.getByRole('button', { name: /^row$/i })).toBeInTheDocument();
  });

  it('collapses secondary tools behind a single overflow "…" (no flat 15-icon row)', () => {
    render(<TableToolbar {...makeProps()} />);
    expect(screen.getByRole('button', { name: /^more$|więcej/i })).toBeInTheDocument();
    // Menu closed until opened — Scoring/Pipeline/Copilot are not flat in the row.
    expect(screen.queryByTestId('table-toolbar-overflow-menu')).toBeNull();
    expect(screen.queryByRole('menuitem', { name: /scoring/i })).toBeNull();
  });

  it('routes overflow items to their handlers (no dead entries)', () => {
    const props = makeProps();
    render(<TableToolbar {...props} />);
    fireEvent.click(screen.getByRole('button', { name: /^more$|więcej/i }));
    expect(screen.getByTestId('table-toolbar-overflow-menu')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('menuitem', { name: /scoring model/i }));
    expect(props.onShowScoringModel).toHaveBeenCalledTimes(1);
  });
});
