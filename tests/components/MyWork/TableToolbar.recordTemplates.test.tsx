/**
 * TableToolbar — RISK-06 reachability lock (2026-08-12).
 *
 * `RecordTemplateManager` (src/components/MyWork/table/RecordTemplateManager.tsx)
 * had a real backend (server/src/routes/table-platform.routes.ts
 * `/tables/:tableId/record-templates`) and two registered actions
 * (`table.record_template.*`) but ZERO UI imports — `grep -rln
 * RecordTemplateManager src/` only ever found the file itself and the action
 * registry's `source:` comment strings, never a component that renders it.
 *
 * Wired here: a "Record Templates" entry inside TableToolbar's "More" menu
 * (same usePlatform-only section as Automations/Data Sync/Sharing/
 * Distribution/Consultify Link — see TableToolbar.moreToolsAndAi.test.tsx for
 * the sibling regression lock on that same menu). This test is the
 * reachability proof: it fails red if the mount is ever removed.
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
    onShowRecordTemplateManager: vi.fn(),
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

describe('TableToolbar — RISK-06 Record Templates reachability', () => {
  it('surfaces "Record Templates" inside "More" and calls onShowRecordTemplateManager on click', () => {
    const props = makeProps();
    render(<TableToolbar {...props} />);
    fireEvent.click(screen.getByRole('button', { name: /^more$|więcej/i }));
    const item = screen.getByRole('menuitem', { name: /record templates/i });
    expect(item).toBeInTheDocument();
    fireEvent.click(item);
    expect(props.onShowRecordTemplateManager).toHaveBeenCalledTimes(1);
  });

  it('does not surface Record Templates when not in platform mode (usePlatform=false)', () => {
    // ctx.active drives `usePlatform` inside TableToolbar; TableToolbar itself
    // only ever mounts when `usePlatform` is true (IdeaTableTool.tsx's
    // `{usePlatform ? <P15TableToolbar/> : …}` branch), but this locks the
    // item's own `show: usePlatform` guard so it can't regress independently.
    ctx.active = false;
    try {
      const props = makeProps();
      render(<TableToolbar {...props} />);
      fireEvent.click(screen.getByRole('button', { name: /^more$|więcej/i }));
      expect(screen.queryByRole('menuitem', { name: /record templates/i })).toBeNull();
    } finally {
      ctx.active = true;
    }
  });
});
