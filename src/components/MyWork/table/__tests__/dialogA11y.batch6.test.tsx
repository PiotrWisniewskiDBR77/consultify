/**
 * @vitest-environment jsdom
 *
 * A11Y-BACKLOG (table) batch 6 — TableToolbar's "Save view" dialog converted
 * onto the shared `useDialogA11y` contract (G4-MODALS-REST).
 *
 * `TableToolbar` reads its data from `TableDataProvider` via `useTableData()`
 * and takes ~40 callback/component props; the module is mocked wholesale
 * here (context + a dozen `ComponentType` slots as `() => null`) so the test
 * can target the one thing this stream changed — the save-view dialog —
 * without needing a live table/base/realtime backend.
 *
 * The row-rename input (`renamingViewId`) and the view right-click context
 * menu (`viewContextMenu`) are deliberately NOT converted — the rename input
 * is an inline text field with no overlay, and the context menu is an
 * anchored, single-click-action popover (same class as `ViewRouter`'s row
 * kebab, already excluded from this program).
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
    get() {
      return document.body;
    },
    configurable: true,
  });
});

vi.mock('react-hot-toast', () => {
  const fn = vi.fn();
  return { default: Object.assign(fn, { success: vi.fn(), error: vi.fn() }) };
});

const saveCurrentView = vi.fn();

vi.mock('../TableDataProvider', () => ({
  useTableData: () => ({
    active: false,
    base: null,
    table: null,
    tableId: 'tbl-1',
    refresh: vi.fn(),
    locked: false,
    columns: [],
    visibleColumns: [],
    savedViews: [{ id: 'default', name: 'Default' }],
    activeViewId: 'default',
    applyView: vi.fn(),
    saveCurrentView,
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
    selectedRowIds: new Set(),
    handleAddRow: vi.fn(),
    handleAddColumn: vi.fn(),
    deleteColumn: vi.fn(),
    handleBulkDelete: vi.fn(),
    handleSave: vi.fn(),
    saving: false,
    loading: false,
    saveStatusLabel: '',
    toggleColumn: vi.fn(),
    platformFields: [],
    applyPlatformFilters: vi.fn(),
    ui: {
      showFilters: false,
      showAuditTrail: false,
      showActivityFeed: false,
      showAddColumn: false,
      showTemplateGallery: false,
      showDistribution: false,
      platformTab: 'data',
    },
    uiDispatch: vi.fn(),
    isPl: false,
    processedRows: [],
    handleFieldChange: vi.fn(),
  }),
}));

const Null = () => null;

import { TableToolbar, type TableToolbarProps } from '../TableToolbar';

function baseProps(): TableToolbarProps {
  return {
    ideaId: 'idea-1',
    nodesUndo: { canUndo: false, canRedo: false, undo: vi.fn(), redo: vi.fn() },
    onPlatformUndo: vi.fn(),
    // RISK-06 (integration fix, 2026-08-12): `onShowRecordTemplateManager` became a
    // REQUIRED prop when the dead `RecordTemplateManager` mount was wired into the
    // real platform toolbar. Deliberately kept required rather than optional — an
    // optional handler would let a future consumer drop the wiring silently, which
    // is exactly the dead-mount failure RISK-06 was filed for. Caught only by the
    // full client type-check; the stream that added it ran targeted vitest, which
    // passes regardless because JS does not enforce the prop contract at runtime.
    onShowRecordTemplateManager: vi.fn(),
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
    heatmapColumns: new Set(),
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
    currentUserId: 'user-1',
    currentUserName: 'Tester',
    workspaceId: 'ws-1',
    remotePresenceUsers: [],
    onPresenceUpdate: vi.fn(),
    filterInput: '',
    onFilterInputChange: vi.fn(),
    FilterBuilderComponent: Null,
    FilterPanelComponent: Null,
    HeatmapControlsComponent: Null,
    ColorPaletteComponent: Null,
    MobileToolbarMenuComponent: ({ children }: { children: React.ReactNode }) => (
      <>{children}</>
    ),
    BatchAIFillButtonComponent: Null,
    WorkspacePresenceIndicatorComponent: Null,
    WorkspaceLockIndicatorComponent: Null,
    CollaborationPresenceComponent: Null,
    PresenceIndicatorsComponent: Null,
  };
}

describe('TableToolbar — save view dialog a11y contract', () => {
  it('has role=dialog, aria-modal, and an accessible name; focuses the view-name input; Escape closes and restores focus', async () => {
    render(<TableToolbar {...baseProps()} />);

    const trigger = screen.getByTitle('Save view');
    trigger.focus();
    fireEvent.click(trigger);

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleName('Save view');

    await waitFor(() => {
      expect(document.activeElement?.tagName).toBe('INPUT');
    });

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it('Save commits the current view name via saveCurrentView and closes the dialog', async () => {
    saveCurrentView.mockClear();
    render(<TableToolbar {...baseProps()} />);

    fireEvent.click(screen.getByTitle('Save view'));
    const dialog = await screen.findByRole('dialog');

    fireEvent.change(screen.getByPlaceholderText('View name…'), {
      target: { value: 'My View' },
    });
    fireEvent.click(within(dialog).getByText('Save'));

    await waitFor(() => expect(saveCurrentView).toHaveBeenCalledWith('My View', []));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});
