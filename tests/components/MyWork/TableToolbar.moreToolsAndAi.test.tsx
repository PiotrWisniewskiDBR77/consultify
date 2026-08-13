/**
 * TableToolbar — TB-P2-01 / TB-P2-02 regression lock (2026-08-10).
 *
 * TB-P2-01: Forms/Interfaces/Models/Workflow/Webhook Relays/Automations/
 * Data Sync/Sharing/Distribution/Consultify Link must live under "More" only
 * (the standalone platform-tab switcher, Interface Designer/Form Builder
 * buttons, and the separate "Tools" dropdown are gone).
 * TB-P2-02: the toolbar's own Undo/Redo buttons and the Columns dropdown's
 * "Add field" trigger are gone (rail owns creation/undo-redo); the split
 * "Row" add button stays (documented as non-duplicate: template picker has
 * no rail equivalent).
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/services/api/tablePlatform.api', () => ({
  createRecord: vi.fn(),
}));

const ctx = {
  active: true,
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

describe('TableToolbar — TB-P2-01 platform tools under More only', () => {
  it('has no standalone platform-tab switcher, Interface Designer/Form Builder buttons, or "Tools" dropdown in the row', () => {
    render(<TableToolbar {...makeProps()} />);
    expect(screen.queryByTitle('Interface Designer')).toBeNull();
    expect(screen.queryByTitle('Form Builder')).toBeNull();
    expect(screen.queryByRole('button', { name: /^tools$/i })).toBeNull();
    // The 5-way Data/Forms/Interfaces/Models/Workflow tab row is gone.
    expect(screen.queryByRole('button', { name: /^forms$/i })).toBeNull();
  });

  it('surfaces Forms/Interfaces/Models/Workflow/Webhook Relays/Automations/Distribution only inside "More"', () => {
    const props = makeProps();
    render(<TableToolbar {...props} />);
    fireEvent.click(screen.getByRole('button', { name: /^more$|więcej/i }));
    expect(screen.getByRole('menuitem', { name: /^forms$/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /^interfaces$/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /^models$/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /^workflow$/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /webhook relays/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /automations/i })).toBeInTheDocument();
    // Real "Distribution" (props.onShowDistributionManager) present; dead
    // ctx-based "Distribute" duplicate is not.
    fireEvent.click(screen.getByRole('menuitem', { name: /^distribution$/i }));
    expect(props.onShowDistributionManager).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menuitem', { name: /^distribute$/i })).toBeNull();
  });
});

describe('TableToolbar — TB-P2-02 Row/Columns/Undo duplicates resolved', () => {
  it('has no toolbar Undo/Redo buttons (rail owns undo/redo)', () => {
    render(<TableToolbar {...makeProps()} />);
    expect(screen.queryByTitle(/Undo \(Ctrl\+Z\)/i)).toBeNull();
    expect(screen.queryByTitle(/Redo \(Ctrl\+Y\)/i)).toBeNull();
  });

  it('keeps the Row add control (documented non-duplicate: template picker)', () => {
    render(<TableToolbar {...makeProps()} />);
    expect(screen.getByRole('button', { name: /^row$/i })).toBeInTheDocument();
    expect(screen.getByTitle('Add from template')).toBeInTheDocument();
  });

  it('Columns dropdown has no "Add field" trigger (rail owns column creation)', () => {
    render(<TableToolbar {...makeProps()} />);
    fireEvent.click(screen.getByTitle('Columns'));
    expect(screen.queryByTestId('table-toolbar-add-field')).toBeNull();
    expect(screen.queryByRole('button', { name: /add field/i })).toBeNull();
  });
});
