/**
 * TableToolbar — extracted from IdeaTableTool monolith.
 *
 * Unified toolbar for the Table Platform surface. Reads all state from
 * TableDataProvider context, eliminating prop-drilling and platform/legacy
 * branching. Renders: presence, saved views, filters, layout switcher,
 * secondary tools, bulk actions, add row, and save.
 */

import {
  Activity,
  ArrowRight,
  Brain,
  Calendar,
  Check,
  ChevronDown,
  ClipboardCopy,
  Columns3,
  Download,
  Eye,
  EyeOff,
  FileText,
  Filter,
  Flame,
  GanttChart,
  Grid3X3,
  Group,
  History,
  KanbanSquare,
  Keyboard,
  Layers,
  Layout,
  LayoutGrid,
  LayoutTemplate,
  Link2,
  Loader2,
  Mic,
  MoreHorizontal,
  Network,
  Paintbrush,
  Palette,
  Plus,
  Presentation,
  Rocket,
  Save,
  Send,
  Sparkles,
  Table2,
  Trash2,
  Trophy,
  Upload,
  Webhook,
  Workflow,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { type ActionContext, getActionsForSurface, runIdeaAction } from '@/actions/ideaActionRegistry';
import { Button } from '@/components/ui/primitives/Button';
import { useDialogA11y } from '@/components/ui/primitives/useDialogA11y';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import * as TablePlatformApi from '@/services/api/tablePlatform.api';

import { EMPTY_SELECTION } from '../ideaSelectionTypes';
import { AddColumnDialog } from './AddColumnDialog';
import { AITableAssistant } from './AITableAssistant';
import { AITableProposal, type TableProposal } from './AITableProposal';
import { useTableData } from './TableDataProvider';
import type { ColumnDef, FilterGroup, SavedView, SortConfig, TableNode } from './tableTypes';
import type { ViewLayout } from './useTableViews';

// ---------------------------------------------------------------------------
// Sub-components kept inline to minimise file count at this stage.
// They can be extracted later when the toolbar stabilises.
// ---------------------------------------------------------------------------

interface ToolbarIconButtonProps {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
  className?: string;
}

function ToolbarIconButton({
  onClick,
  active,
  disabled,
  title,
  children,
  className,
}: ToolbarIconButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`p-1.5 rounded-lg transition-colors ${
        active ? 'text-c-text bg-c-surface' : 'text-c-text-secondary hover:text-c-text-secondary'
      } ${disabled ? 'opacity-30 cursor-not-allowed' : ''} ${className ?? ''}`}
      title={title}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Props — external callbacks that still live in IdeaTableTool
// ---------------------------------------------------------------------------

export interface TableToolbarProps {
  ideaId: string;
  /** When true (Menu 1 owns the save indicator in the mels canvas shell), the
   *  toolbar hides its own Save button to avoid duplicating the identity-row
   *  save state. Save mechanics (autosave + handleSave from useTableData) are
   *  untouched. Default OFF → legacy layout renders exactly as before. */
  hideSaveIndicator?: boolean;
  /** Legacy undo hook — kept until full platform migration */
  nodesUndo: { canUndo: boolean; canRedo: boolean; undo: () => void; redo: () => void };
  onPlatformUndo: () => void;
  onCSVImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onExportCSV: () => void;
  onCopyToClipboard: () => void;
  onAddRowWithTemplate: () => void;
  onBulkConvert: (type: 'initiative' | 'task' | 'decision') => void;
  onShowAIAssistant: () => void;
  onShowAICategorize: () => void;
  onShowScoringModel: () => void;
  onShowExportPresentation: () => void;
  onShowPipeline: () => void;
  onShowCopilot: () => void;
  onShowVoiceInput: () => void;
  onShowCrossRelations: () => void;
  onShowFrameworkGen: () => void;
  onShowConditionalFmt: () => void;
  onShowKeyboardShortcuts: () => void;
  /** Connectors state (from useConnectors) */
  connectors: { connectors: Array<{ id: string; lastRunStatus?: string }> };
  onShowConnectorWizard: () => void;
  onShowConnectorList: () => void;
  onShowWebhookRelays: () => void;
  onShowAutomationsManager: () => void;
  onShowSyncManager: () => void;
  onShowSharingManager: () => void;
  onShowDistributionManager: () => void;
  onShowConsultifyLink: () => void;
  /** Heatmap state */
  heatmapColumns: Set<string>;
  showHeatmap: boolean;
  onToggleHeatmap: () => void;
  onToggleHeatmapColumn: (key: string) => void;
  heatmapPalette: string;
  onHeatmapPaletteChange: (id: string) => void;
  /** Color palette state */
  activePalette: string;
  onAutoAssignColors: () => void;
  onPaletteChange: (id: string) => void;
  /** Format rules */
  formatRules: unknown[];
  /** Presence (from realtime hook) */
  realtime: { presence: unknown[]; connectionState: string };
  isV8MultiplayerEnabled: boolean;
  currentUserId: string;
  currentUserName: string;
  workspaceId: string;
  remotePresenceUsers: unknown[];
  onPresenceUpdate: (users: unknown[]) => void;
  /** Quick filter input */
  filterInput: string;
  onFilterInputChange: (value: string) => void;
  /** Platform filter components */
  FilterBuilderComponent: React.ComponentType<any>;
  FilterPanelComponent: React.ComponentType<any>;
  HeatmapControlsComponent: React.ComponentType<any>;
  ColorPaletteComponent: React.ComponentType<any>;
  MobileToolbarMenuComponent: React.ComponentType<{ children: React.ReactNode }>;
  BatchAIFillButtonComponent: React.ComponentType<any>;
  /** Collaboration presence components */
  WorkspacePresenceIndicatorComponent: React.ComponentType<any>;
  WorkspaceLockIndicatorComponent: React.ComponentType<any>;
  CollaborationPresenceComponent: React.ComponentType<any>;
  PresenceIndicatorsComponent: React.ComponentType<any>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const TableToolbar: React.FC<TableToolbarProps> = (props) => {
  const { t } = useTranslation();
  const ctx = useTableData();
  const {
    active: usePlatform,
    base,
    table,
    tableId,
    refresh,
    locked,
    columns,
    visibleColumns,
    savedViews,
    activeViewId,
    applyView,
    saveCurrentView,
    updateSavedView,
    deleteSavedView,
    filters,
    setFilters,
    sort,
    setSort,
    groupBy,
    setGroupBy,
    viewLayout,
    setViewLayout,
    selectedRowIds,
    handleAddRow,
    handleAddColumn,
    deleteColumn,
    handleBulkDelete,
    handleSave,
    saving,
    loading,
    saveStatusLabel,
    toggleColumn,
    platformFields,
    applyPlatformFilters,
    ui,
    uiDispatch,
    isPl,
  } = ctx;

  /**
   * N10 (2026-08-10) — same shape as `WhiteboardToolbar.tsx`'s `runAction`
   * (Program B / E02, N7 kontynuacja): routes a TableToolbar click through
   * the Action Registry (`ideaActionRegistry.ts`) with the standard
   * dual-path contract (`ctx.source: 'ui'` + `ctx.params.run` → the
   * registry's handler calls `run` directly, byte-identical to the
   * pre-wiring behaviour — no prop or state-setter call is skipped).
   * `registryActionsById` guard mirrors the Whiteboard precedent: an id
   * missing from the registry (typo, or an entry not yet declared for the
   * `'toolbar'` surface) falls back to running the original callback instead
   * of silently swallowing the click — a signal to fix the registry, not the
   * intended path. This component only renders when `usePlatform` is `true`
   * (`IdeaTableTool.tsx` `{usePlatform ? <P15TableToolbar …/> : …}`), so
   * `tool: 'table'` and the platform-only mechanisms documented per registry
   * entry always apply.
   */
  // Two surfaces, not one: this file hosts both flat toolbar buttons
  // (`surfaces: ['toolbar']`) and its own right-click view-context menu
  // (`surfaces: ['context']`, e.g. `idea.view.table_platform_saved_view_*`).
  const registryActionsById = React.useMemo(() => {
    const map = new Map<string, ReturnType<typeof getActionsForSurface>[number]>();
    for (const entry of getActionsForSurface('toolbar', { tool: 'table' })) {
      map.set(entry.def.id, entry);
    }
    for (const entry of getActionsForSurface('context', { tool: 'table' })) {
      map.set(entry.def.id, entry);
    }
    return map;
  }, []);

  const runAction = useCallback(
    (id: string, run: () => void) => {
      if (!registryActionsById.has(id)) {
        run();
        return;
      }
      const actionCtx: ActionContext = {
        ideaId: props.ideaId,
        tool: 'table',
        selection: EMPTY_SELECTION,
        surface: 'toolbar',
        source: 'ui',
        language: isPl ? 'pl' : 'en',
        params: { run },
      };
      void runIdeaAction(id, actionCtx);
    },
    [registryActionsById, props.ideaId, isPl]
  );

  // Local UI toggles scoped to toolbar
  const [showSaveViewDialog, setShowSaveViewDialog] = useState(false);
  const [saveViewName, setSaveViewName] = useState('');
  const saveViewDialogRef = useRef<HTMLDivElement>(null);
  const saveViewNameInputRef = useRef<HTMLInputElement>(null);
  const closeSaveViewDialog = useCallback(() => setShowSaveViewDialog(false), []);
  useDialogA11y({
    open: showSaveViewDialog,
    onClose: closeSaveViewDialog,
    containerRef: saveViewDialogRef,
    initialFocusRef: saveViewNameInputRef,
  });
  const [viewContextMenu, setViewContextMenu] = useState<{
    viewId: string;
    x: number;
    y: number;
  } | null>(null);
  const [renamingViewId, setRenamingViewId] = useState<string | null>(null);
  const [renamingViewName, setRenamingViewName] = useState('');
  const [showColumnConfig, setShowColumnConfig] = useState(false);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  // Fala 10 (parytet Airtable) — dropdown wyboru kolumny grupującej.
  const [showGroupMenu, setShowGroupMenu] = useState(false);
  const groupMenuRef = useRef<HTMLDivElement>(null);
  const [showColorPalette, setShowColorPalette] = useState(false);
  const [showBulkConvertMenu, setShowBulkConvertMenu] = useState(false);
  // TB-P2-01: the standalone "Tools" dropdown (Grid3X3, Automations/Data Sync/
  // Webhook Relays/Sharing/Distribution/Forms/Interfaces/Templates/Consultify
  // Link) is gone — its live items moved into the "More" overflow below;
  // dead duplicates of Forms/Interfaces/Webhook Relays/Templates were dropped
  // rather than tripled across three menus. `showToolsMenu` state removed
  // with it.
  // Editor Shell Canon §2 GÓRNA: the desktop secondary tools collapse under a
  // single overflow "…" (MoreHorizontal) button instead of a flat 15-icon row.
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const [aiSchemaSheetOpen, setAiSchemaSheetOpen] = useState(false);
  const [aiProposal, setAiProposal] = useState<TableProposal | null>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  const {
    WorkspacePresenceIndicatorComponent,
    WorkspaceLockIndicatorComponent,
    CollaborationPresenceComponent,
    PresenceIndicatorsComponent,
    FilterBuilderComponent,
    FilterPanelComponent,
    HeatmapControlsComponent,
    ColorPaletteComponent,
    MobileToolbarMenuComponent,
    BatchAIFillButtonComponent,
    hideSaveIndicator = false,
  } = props;

  const handleSaveView = useCallback(
    (name: string) => {
      saveCurrentView(name, columns);
      setShowSaveViewDialog(false);
    },
    [saveCurrentView, columns]
  );

  /** Mobile ViewRouter requests filter UI via context flag */
  useEffect(() => {
    if (ui.showFilters) {
      setShowFilterPanel(true);
      uiDispatch({ type: 'SET_PANEL', panel: 'showFilters', value: false });
    }
  }, [ui.showFilters, uiDispatch]);

  /** Overflow "…" menu closes on outside click. */
  useEffect(() => {
    if (!showMoreMenu) return;
    const handler = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setShowMoreMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showMoreMenu]);

  /** Group-by menu closes on outside click. */
  useEffect(() => {
    if (!showGroupMenu) return;
    const handler = (e: MouseEvent) => {
      if (groupMenuRef.current && !groupMenuRef.current.contains(e.target as Node)) {
        setShowGroupMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showGroupMenu]);

  const onProposalApproved = useCallback(
    async (accepted: { columns?: ColumnDef[]; views?: SavedView[]; rows?: TableNode[] }) => {
      try {
        if (accepted.columns?.length) {
          for (const col of accepted.columns) {
            handleAddColumn(col);
          }
        }
        if (accepted.views?.length) {
          for (const v of accepted.views) {
            if (v.layout) setViewLayout(v.layout as ViewLayout);
            await saveCurrentView(
              v.name || t('ideas.table.toolbar.aiViewName', 'AI view'),
              columns
            );
          }
        }
        if (accepted.rows?.length && tableId) {
          for (const row of accepted.rows) {
            const data = (row.data ?? {}) as Record<string, unknown>;
            await TablePlatformApi.createRecord(tableId, data);
          }
        }
        await refresh();
        setAiProposal(null);
        setAiSchemaSheetOpen(false);
        toast.success(t('ideas.table.toolbar.proposalApplied', 'Proposal applied'));
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        toast.error(msg || t('ideas.table.toolbar.applyFailed', 'Apply failed'));
      }
    },
    [columns, handleAddColumn, refresh, saveCurrentView, setViewLayout, t, tableId]
  );

  // Layout items — FROZEN order per V5-IDEA-24
  const layoutItems = [
    { id: 'table' as const, icon: Table2, label: t('ideas.table.table', 'Table') },
    { id: 'kanban' as const, icon: KanbanSquare, label: 'Kanban' },
    { id: 'timeline' as const, icon: GanttChart, label: 'Timeline / Gantt' },
    { id: 'calendar' as const, icon: Calendar, label: t('ideas.table.calendar', 'Calendar') },
    { id: 'matrix' as const, icon: LayoutGrid, label: 'Matrix' },
    { id: 'grid' as const, icon: Grid3X3, label: t('ideas.table.gallery', 'Gallery') },
  ];

  return (
    <div className="flex flex-wrap items-center gap-1 md:gap-2 bg-c-surface backdrop-blur-sm rounded-2xl shadow-xl border border-slate-200/60 dark:border-white/[0.03] mx-3 my-2 px-4 py-2 flex-shrink-0">
      <div className="text-xs font-semibold text-c-text mr-2">
        {t('ideas.table.table', 'Table')}
      </div>

      {/* Collaboration Presence */}
      <WorkspacePresenceIndicatorComponent
        workspaceId={props.workspaceId}
        currentUserId={props.currentUserId}
        enabled={props.isV8MultiplayerEnabled}
      />
      <WorkspaceLockIndicatorComponent
        workspaceId={props.workspaceId}
        currentUserId={props.currentUserId}
        enabled={props.isV8MultiplayerEnabled}
      />
      <CollaborationPresenceComponent
        ideaId={props.ideaId}
        currentUserId={props.currentUserId}
        currentUserName={props.currentUserName}
        enabled={true}
        renderIndicator={!props.isV8MultiplayerEnabled}
        onPresenceUpdate={props.onPresenceUpdate}
      />
      {usePlatform && (
        <PresenceIndicatorsComponent
          presence={props.realtime.presence}
          currentUserId={props.currentUserId}
          connectionState={props.realtime.connectionState}
          enabled={usePlatform}
        />
      )}

      {/* Saved view tabs */}
      <div className="flex items-center gap-0.5 mr-2">
        {savedViews.map((v) => (
          <div key={v.id} className="relative">
            {renamingViewId === v.id ? (
              <input
                autoFocus
                value={renamingViewName}
                onChange={(e) => setRenamingViewName(e.target.value)}
                onBlur={() => {
                  if (renamingViewName.trim())
                    updateSavedView(v.id, { name: renamingViewName.trim() });
                  setRenamingViewId(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    if (renamingViewName.trim())
                      updateSavedView(v.id, { name: renamingViewName.trim() });
                    setRenamingViewId(null);
                  } else if (e.key === 'Escape') {
                    setRenamingViewId(null);
                  }
                }}
                className="px-2 py-1 rounded-lg text-[10px] font-bold bg-c-surface border border-c-focus outline-none w-20"
              />
            ) : (
              <button
                onClick={() => runAction('idea.view.table_apply_view', () => applyView(v))}
                onContextMenu={(e) => {
                  e.preventDefault();
                  if (v.id !== 'default')
                    setViewContextMenu({ viewId: v.id, x: e.clientX, y: e.clientY });
                }}
                className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-colors ${
                  activeViewId === v.id
                    ? 'bg-c-surface text-c-text'
                    : 'text-c-text-secondary hover:text-c-text-secondary'
                }`}
              >
                {v.name}
              </button>
            )}
          </div>
        ))}
        {!locked && (
          <button
            onClick={() => {
              setSaveViewName('');
              setShowSaveViewDialog(true);
            }}
            className="p-1 rounded-lg text-c-text-secondary hover:text-c-text-muted hover:bg-c-surface transition-colors"
            title={t('ideas.table.saveView', 'Save view')}
          >
            <Plus size={12} />
          </button>
        )}
      </div>

      {/* Save view dialog */}
      {showSaveViewDialog && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/20"
          onClick={closeSaveViewDialog}
        >
          <div
            ref={saveViewDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="table-save-view-dialog-title"
            tabIndex={-1}
            className="bg-c-surface rounded-xl shadow-xl border border-slate-200/60 dark:border-white/[0.03] p-4 w-72 outline-none"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="table-save-view-dialog-title" className="text-sm font-semibold mb-2 text-c-text">
              {t('ideas.table.saveView', 'Save view')}
            </h3>
            <input
              ref={saveViewNameInputRef}
              value={saveViewName}
              onChange={(e) => setSaveViewName(e.target.value)}
              placeholder={t('ideas.table.viewName', 'View name…')}
              className="w-full h-8 px-3 rounded-lg text-xs bg-c-surface-raised border border-c-border-subtle outline-none focus:ring-2 focus:ring-c-focus mb-3"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && saveViewName.trim()) handleSaveView(saveViewName.trim());
              }}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowSaveViewDialog(false)}
                className="px-3 py-1.5 text-xs rounded-lg text-c-text-muted hover:bg-c-surface-raised"
              >
                {t('ideas.table.cancel', 'Cancel')}
              </button>
              <button
                disabled={!saveViewName.trim()}
                onClick={() =>
                  runAction('idea.view.table_save_view', () => handleSaveView(saveViewName.trim()))
                }
                className="px-3 py-1.5 text-xs rounded-lg bg-c-text text-c-surface hover:opacity-90 disabled:opacity-40"
              >
                {t('ideas.table.save', 'Save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View context menu */}
      {viewContextMenu && (
        <div className="fixed inset-0 z-[60]" onClick={() => setViewContextMenu(null)}>
          <div
            className="absolute bg-c-surface rounded-lg shadow-xl border border-slate-200/60 dark:border-white/[0.03] py-1 min-w-[140px]"
            style={{ left: viewContextMenu.x, top: viewContextMenu.y }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="w-full px-3 py-1.5 text-xs text-left hover:bg-c-surface-raised text-c-text"
              onClick={() =>
                runAction('idea.view.table_platform_saved_view_rename', () => {
                  const v = savedViews.find((sv) => sv.id === viewContextMenu.viewId);
                  if (v) {
                    setRenamingViewId(v.id);
                    setRenamingViewName(v.name);
                  }
                  setViewContextMenu(null);
                })
              }
            >
              {t('ideas.table.rename', 'Rename')}
            </button>
            <button
              className="w-full px-3 py-1.5 text-xs text-left hover:bg-c-surface-raised text-c-text"
              onClick={() =>
                runAction('idea.view.table_platform_saved_view_update', () => {
                  updateSavedView(viewContextMenu.viewId, {
                    sort: sort ? [sort] : undefined,
                    filters,
                    groupBy: groupBy ?? undefined,
                    layout: viewLayout,
                    columns: columns.map((c) => ({
                      key: c.key,
                      visible: c.visible !== false,
                      width: c.width,
                    })),
                  });
                  toast.success(t('ideas.table.viewUpdated', 'View updated'));
                  setViewContextMenu(null);
                })
              }
            >
              {t('ideas.table.update', 'Update')}
            </button>
            <button
              className="w-full px-3 py-1.5 text-xs text-left hover:bg-danger-50 dark:hover:bg-danger-900/20 text-danger-600"
              onClick={() =>
                runAction('idea.view.table_platform_saved_view_delete', () => {
                  deleteSavedView(viewContextMenu.viewId);
                  toast.success(t('ideas.table.viewDeleted', 'View deleted'));
                  setViewContextMenu(null);
                })
              }
            >
              {t('ideas.table.delete', 'Delete')}
            </button>
          </div>
        </div>
      )}

      <div className="w-px h-5 bg-c-border-subtle" />

      {/* Quick filter.
          2026-08-10 (E13 visual audit, HARD VISUAL FAIL "clipped essential
          control"): `flex-1` with no `min-width` let this input shrink to
          ~47px in the crowded view-tabs row (only "Fi" of "Filtruj…"
          legible). `min-w-[120px]` keeps it usable — the shared flex-wrap
          row now wraps this control to its own line instead of crushing it. */}
      <div className="relative flex-1 min-w-[120px] max-w-[200px]">
        <Filter
          size={12}
          className="absolute left-2 top-1/2 -translate-y-1/2 text-c-text-secondary"
        />
        <input
          value={props.filterInput}
          onChange={(e) => props.onFilterInputChange(e.target.value)}
          placeholder={t('ideas.table.filter', 'Filter…')}
          className="w-full h-7 pl-7 pr-2 rounded-lg text-[11px] bg-c-surface border border-slate-200/60 dark:border-white/[0.03] text-c-text outline-none focus:ring-2 focus:ring-c-focus"
        />
        {props.filterInput && (
          <button
            onClick={() => props.onFilterInputChange('')}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 text-c-text-secondary hover:text-c-text-secondary"
            title={t('ideas.table.clearFilter', 'Clear filter')}
            aria-label={t('ideas.table.clearFilter', 'Clear filter')}
          >
            <X size={10} aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Advanced filter */}
      <div className="relative">
        <button
          onClick={() => setShowFilterPanel(!showFilterPanel)}
          className={`inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-medium transition-colors ${
            filters.rules.length > 0
              ? 'bg-c-surface text-c-text'
              : 'text-c-text-secondary hover:bg-c-surface-raised'
          }`}
        >
          <Filter size={12} />
          {filters.rules.length > 0 && <span className="text-[9px]">({filters.rules.length})</span>}
        </button>
        {usePlatform ? (
          <FilterBuilderComponent
            open={showFilterPanel}
            onClose={() => {
              setShowFilterPanel(false);
            }}
            filters={{
              logic: filters.logic,
              rules: filters.rules.map((r: any) => ({
                fieldId: r.fieldId ?? r.column,
                operator: r.operator,
                value: r.value,
              })),
            }}
            onChange={(pf: any) => {
              setFilters({
                logic: pf.logic,
                rules: pf.rules.map((r: any) => ({
                  id: `${r.fieldId}-${r.operator}`,
                  column: r.fieldId,
                  operator: r.operator,
                  value: r.value ?? '',
                })),
              });
              void applyPlatformFilters(pf);
            }}
            fields={platformFields}
          />
        ) : (
          <FilterPanelComponent
            open={showFilterPanel}
            onClose={() => {
              setShowFilterPanel(false);
            }}
            filters={filters}
            onChange={setFilters}
            columns={visibleColumns}
          />
        )}
      </div>

      {/* Group by — Fala 10 (parytet Airtable): wybór dowolnej kolumny grupującej. */}
      <div className="relative" ref={groupMenuRef}>
        <button
          onClick={() => setShowGroupMenu((p) => !p)}
          className={`inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-medium transition-colors ${
            groupBy ? 'bg-c-surface text-c-text' : 'text-c-text-secondary hover:bg-c-surface-raised'
          }`}
          title={t('ideas.table.group', 'Group')}
        >
          <Group size={12} />
          <span className="hidden sm:inline">
            {groupBy
              ? (columns.find((c) => c.key === groupBy)?.header ?? t('ideas.table.group', 'Group'))
              : t('ideas.table.group', 'Group')}
          </span>
          <ChevronDown size={10} className="text-c-text-muted" />
        </button>
        {showGroupMenu && (
          <div className="absolute left-0 top-full mt-1 z-50 w-52 rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface shadow-xl p-2">
            <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-c-text-muted">
              {t('ideas.table.groupBy', 'Grupuj wg')}
            </div>
            <button
              onClick={() => {
                setGroupBy(null);
                setShowGroupMenu(false);
              }}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[11px] text-c-text hover:bg-c-surface-raised transition-colors"
            >
              <span className="w-3">{!groupBy && <Check size={12} />}</span>
              {t('ideas.table.noGrouping', 'Bez grupowania')}
            </button>
            <div className="max-h-64 overflow-auto">
              {columns.map((col) => (
                <button
                  key={col.key}
                  onClick={() => {
                    setGroupBy(col.key);
                    setShowGroupMenu(false);
                  }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[11px] text-c-text hover:bg-c-surface-raised transition-colors"
                >
                  <span className="w-3">{groupBy === col.key && <Check size={12} />}</span>
                  <span className="truncate">{col.header}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* View layout switcher — FROZEN order */}
      <div className="flex items-center rounded-lg border border-c-border-subtle overflow-hidden">
        {layoutItems.map((v) => (
          <button
            key={v.id}
            onClick={() => setViewLayout(v.id)}
            className={`relative p-1.5 transition-colors ${viewLayout === v.id ? 'bg-c-surface text-c-text' : 'text-c-text-secondary hover:text-c-text-secondary'}`}
            title={v.label}
          >
            <v.icon size={12} />
            {viewLayout === v.id && (
              <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3 h-0.5 rounded-full bg-c-surface dark:bg-c-surface" />
            )}
          </button>
        ))}
      </div>

      {/* AI schema assistant (slide-over) */}
      {/* data-testid on a plain wrapper div — motion.button does not forward data-* */}
      <div data-testid="ai-schema-btn">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setAiProposal(null);
            setAiSchemaSheetOpen(true);
          }}
          icon={<Sparkles />}
          title={t('ideas.table.toolbar.aiSchemaAssistant', 'AI schema assistant')}
        >
          AI
        </Button>
      </div>

      {/* Batch AI Fill */}
      {!locked && (
        <BatchAIFillButtonComponent
          nodes={ctx.processedRows}
          columns={columns}
          ideaId={props.ideaId}
          onFill={ctx.handleFieldChange}
          selectedIds={selectedRowIds}
        />
      )}

      {/* Heatmap + Color palette anchors (panels stay wired; triggers moved to overflow) */}
      <HeatmapControlsComponent
        open={props.showHeatmap}
        onClose={props.onToggleHeatmap}
        columns={columns}
        enabledColumns={props.heatmapColumns}
        onToggleColumn={props.onToggleHeatmapColumn}
        palette={props.heatmapPalette}
        onPaletteChange={props.onHeatmapPaletteChange}
      />
      <div className="relative">
        <ColorPaletteComponent
          open={showColorPalette}
          onClose={() => setShowColorPalette(false)}
          activePalette={props.activePalette}
          onPaletteChange={(id: string) => {
            props.onPaletteChange(id);
            setShowColorPalette(false);
          }}
          onAutoAssign={props.onAutoAssignColors}
        />
      </div>

      {/*
       * Editor Shell Canon §2 GÓRNA — secondary tools collapse under a single
       * overflow "…" button (was a flat ~15-icon `hidden md:contents` row =
       * the "three flat layers" the canon forbids). Primary actions (Add row /
       * Convert / Save) stay visible below; this menu holds the rest.
       */}
      <div className="hidden md:block relative" ref={moreMenuRef}>
        <ToolbarIconButton
          onClick={() => setShowMoreMenu((p) => !p)}
          active={showMoreMenu}
          title={t('ideas.table.toolbar.more', 'More')}
          className="!px-2"
        >
          <MoreHorizontal size={14} />
        </ToolbarIconButton>
        {showMoreMenu && (
          <div
            data-testid="table-toolbar-overflow-menu"
            className="absolute right-0 top-full mt-1 z-50 w-56 rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface shadow-xl py-1 max-h-[70vh] overflow-y-auto"
            role="menu"
          >
            {(() => {
              type MoreItem = {
                icon: React.ComponentType<{ size?: number; className?: string }>;
                label: string;
                onClick: () => void;
                show?: boolean;
                active?: boolean;
                /**
                 * TB-P2-01 (2026-08-10): items relocated here from the removed
                 * platform-tab switcher / Interface Designer / Form Builder
                 * buttons / standalone "Tools" dropdown get a small heading
                 * divider so they read as a distinct group, not a random tail
                 * on the AI/view tools above. Set on the FIRST item of a group.
                 */
                sectionHeading?: string;
              };
              const items: MoreItem[] = [
                {
                  icon: Layers,
                  label: t('ideas.table.aiCategorize', 'AI Categorize'),
                  onClick: () => runAction('idea.ai.table_categorize', props.onShowAICategorize),
                  show: !locked,
                },
                {
                  icon: Trophy,
                  label: t('ideas.table.scoringModel', 'Scoring Model'),
                  onClick: () => runAction('idea.view.table_scoring', props.onShowScoringModel),
                },
                {
                  icon: Presentation,
                  label: t('ideas.table.exportToPresentation', 'Export to Presentation'),
                  onClick: () =>
                    runAction('idea.view.table_export_presentation', props.onShowExportPresentation),
                },
                {
                  icon: Rocket,
                  label: t('ideas.table.ideaPipeline', 'Idea Pipeline'),
                  onClick: () => runAction('idea.view.table_pipeline', props.onShowPipeline),
                },
                {
                  icon: Brain,
                  label: t('ideas.table.aiCopilot.label', 'AI Copilot'),
                  onClick: () => runAction('idea.ai.table_copilot', props.onShowCopilot),
                },
                {
                  icon: Mic,
                  label: t('ideas.table.voiceImage', 'Voice / Image'),
                  onClick: () => runAction('idea.view.table_voice_input', props.onShowVoiceInput),
                },
                {
                  icon: Network,
                  label: t('ideas.table.crossTableRelations', 'Cross-table Relations'),
                  onClick: () =>
                    runAction('idea.view.table_cross_relations', props.onShowCrossRelations),
                },
                {
                  icon: Flame,
                  label: t('ideas.table.heatmap', 'Heatmap'),
                  onClick: () => runAction('idea.view.table_heatmap', props.onToggleHeatmap),
                  active: props.heatmapColumns.size > 0,
                },
                {
                  icon: History,
                  label: t('ideas.table.history', 'History'),
                  onClick: () => uiDispatch({ type: 'TOGGLE_PANEL', panel: 'showAuditTrail' }),
                  active: ui.showAuditTrail,
                },
                {
                  icon: Activity,
                  label: t('ideas.table.activity', 'Activity'),
                  onClick: () => uiDispatch({ type: 'TOGGLE_PANEL', panel: 'showActivityFeed' }),
                  active: ui.showActivityFeed,
                },
                {
                  icon: Keyboard,
                  label: t('ideas.table.keyboardShortcuts', 'Keyboard shortcuts (?)'),
                  onClick: props.onShowKeyboardShortcuts,
                },
                {
                  icon: LayoutTemplate,
                  label: t('ideas.table.templates', 'Templates'),
                  onClick: () => uiDispatch({ type: 'TOGGLE_PANEL', panel: 'showTemplateGallery' }),
                  show: !locked,
                },
                {
                  icon: LayoutGrid,
                  label: t('ideas.table.frameworkGenerator', 'Framework Generator'),
                  onClick: () => runAction('idea.ai.table_framework', props.onShowFrameworkGen),
                  show: !locked,
                },
                {
                  icon: Paintbrush,
                  label: t('ideas.table.conditionalFormatting', 'Conditional Formatting'),
                  onClick: props.onShowConditionalFmt,
                  active: props.formatRules.length > 0,
                },
                {
                  icon: Palette,
                  label: t('ideas.table.colorPalette', 'Color Palette'),
                  onClick: () => setShowColorPalette(true),
                },
                // TB-P2-01 — moved out of the always-visible row: the platform
                // tab switcher (Data/Forms/Interfaces/Models/Workflow), the
                // standalone Interface Designer / Form Builder icon buttons,
                // and the separate "Tools" dropdown all lived in a
                // `usePlatform`-only block that most users never saw as
                // decluttered — now folded into this one menu instead of
                // three different homes for the same handful of platform
                // features. Dispatch mechanisms are UNCHANGED, only relocated.
                //
                // HONEST CAVEAT (verified by reading the render tree, not
                // guessed): `ui.platformTab` / `SET_PLATFORM_TAB` is written
                // here and by nothing else — `IdeaTableTool.tsx`'s actual
                // Forms/Interfaces/Models/Workflow content switch reads its
                // OWN, separate local `platformTab` state (a same-name,
                // different variable), whose only setters live in a branch
                // that is unreachable while this toolbar renders. So today,
                // clicking these four items highlights itself in this menu
                // but does not change what the canvas shows — pre-existing,
                // not introduced by this move. Flagged for a human decision
                // in the P2 report; out of scope to rewire here (would mean
                // threading new props through `IdeaTableTool.tsx`).
                {
                  sectionHeading: t('ideas.table.overflow.sectionPlatform', 'Platform'),
                  icon: FileText,
                  label: t('ideas.table.forms', 'Forms'),
                  onClick: () => uiDispatch({ type: 'SET_PLATFORM_TAB', tab: 'forms' }),
                  active: ui.platformTab === 'forms',
                  show: usePlatform,
                },
                {
                  icon: Layout,
                  label: t('ideas.table.interfaces', 'Interfaces'),
                  onClick: () => uiDispatch({ type: 'SET_PLATFORM_TAB', tab: 'interfaces' }),
                  active: ui.platformTab === 'interfaces',
                  show: usePlatform,
                },
                {
                  icon: Grid3X3,
                  label: t('ideas.table.models', 'Models'),
                  onClick: () => uiDispatch({ type: 'SET_PLATFORM_TAB', tab: 'models' }),
                  active: ui.platformTab === 'models',
                  show: usePlatform,
                },
                {
                  icon: Workflow,
                  label: t('ideas.table.workflow', 'Workflow'),
                  onClick: () => uiDispatch({ type: 'SET_PLATFORM_TAB', tab: 'workflow' }),
                  active: ui.platformTab === 'workflow',
                  show: usePlatform,
                },
                // Rest of the former "Tools" dropdown — Webhook Relays also
                // used to have its OWN standalone icon button next to
                // CSV import/export (removed, same `onShowWebhookRelays`
                // handler, one entry instead of two).
                {
                  sectionHeading: t('ideas.table.tools', 'Tools'),
                  icon: Webhook,
                  label: t('ideas.table.webhookRelaysZapierMake', 'Webhook Relays (Zapier/Make)'),
                  onClick: props.onShowWebhookRelays,
                  show: usePlatform,
                },
                {
                  icon: Rocket,
                  label: t('ideas.table.automations', 'Automations'),
                  onClick: props.onShowAutomationsManager,
                  show: usePlatform,
                },
                {
                  icon: Link2,
                  label: t('ideas.table.dataSync', 'Data Sync'),
                  onClick: props.onShowSyncManager,
                  show: usePlatform,
                },
                {
                  icon: Network,
                  label: t('ideas.table.sharingPermissions', 'Sharing & Permissions'),
                  onClick: props.onShowSharingManager,
                  show: usePlatform,
                },
                // Replaces the removed "Distribute" item that used to live in
                // this same menu: that one dispatched `ctx.ui.showDistribution`,
                // which — verified — nothing reads (dead, same family as the
                // platform-tab caveat above). This "Distribution" is the real,
                // working one from the old Tools dropdown (`onShowDistributionManager`
                // prop, opens an actual manager). Keeping both would have put a
                // dead and a live control side by side under near-identical PL
                // labels ("Dystrybucja" for both) — removed the dead one.
                {
                  icon: Send,
                  label: t('ideas.table.distribution', 'Distribution'),
                  onClick: props.onShowDistributionManager,
                  show: usePlatform,
                },
                {
                  icon: Layers,
                  label: t('ideas.table.consultifyLink', 'Consultify Link'),
                  onClick: props.onShowConsultifyLink,
                  show: usePlatform,
                },
              ];
              return items
                .filter((it) => it.show !== false)
                .map((it, i) => {
                  const Icon = it.icon;
                  return (
                    <React.Fragment key={i}>
                      {it.sectionHeading && (
                        <div
                          className={`px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-c-text-secondary ${i === 0 ? 'pt-1' : 'mt-1 border-t border-c-border-subtle pt-2'}`}
                        >
                          {it.sectionHeading}
                        </div>
                      )}
                      <button
                        role="menuitem"
                        onClick={() => {
                          it.onClick();
                          setShowMoreMenu(false);
                        }}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-xs text-left transition-colors ${
                          it.active
                            ? 'text-c-text bg-c-surface-raised'
                            : 'text-c-text hover:bg-c-surface-raised'
                        }`}
                      >
                        <Icon size={14} /> {it.label}
                      </button>
                    </React.Fragment>
                  );
                });
            })()}
          </div>
        )}
      </div>

      {/* Mobile overflow menu */}
      <MobileToolbarMenuComponent>
        {!locked && (
          <button
            onClick={() => runAction('idea.ai.table_categorize', props.onShowAICategorize)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-c-text hover:bg-c-surface-raised min-h-[44px]"
          >
            <Layers size={14} /> {t('ideas.table.aiCategorize', 'AI Categorize')}
          </button>
        )}
        <button
          onClick={() => runAction('idea.view.table_scoring', props.onShowScoringModel)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-c-text hover:bg-c-surface-raised min-h-[44px]"
        >
          <Trophy size={14} /> {t('ideas.table.scoring', 'Scoring')}
        </button>
        <button
          onClick={() =>
            runAction('idea.view.table_export_presentation', props.onShowExportPresentation)
          }
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-c-text hover:bg-c-surface-raised min-h-[44px]"
        >
          <Presentation size={14} /> {t('ideas.table.presentation', 'Presentation')}
        </button>
        <button
          onClick={() => runAction('idea.view.table_pipeline', props.onShowPipeline)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-c-text hover:bg-c-surface-raised min-h-[44px]"
        >
          <Rocket size={14} /> {t('ideas.table.pipeline', 'Pipeline')}
        </button>
        <button
          onClick={() => runAction('idea.ai.table_copilot', props.onShowCopilot)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-c-text hover:bg-c-surface-raised min-h-[44px]"
        >
          <Brain size={14} /> {t('ideas.table.aiCopilot.label', 'AI Copilot')}
        </button>
        <button
          onClick={() => runAction('idea.view.table_voice_input', props.onShowVoiceInput)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-c-text hover:bg-c-surface-raised min-h-[44px]"
        >
          <Mic size={14} /> {t('ideas.table.voiceImage', 'Voice / Image')}
        </button>
        <button
          onClick={() => runAction('idea.view.table_cross_relations', props.onShowCrossRelations)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-c-text hover:bg-c-surface-raised min-h-[44px]"
        >
          <Network size={14} /> {t('ideas.table.relations', 'Relations')}
        </button>
        <button
          onClick={() => runAction('idea.view.table_heatmap', props.onToggleHeatmap)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-c-text hover:bg-c-surface-raised min-h-[44px]"
        >
          <Flame size={14} /> {t('ideas.table.heatmap', 'Heatmap')}
        </button>
        <button
          onClick={() => uiDispatch({ type: 'TOGGLE_PANEL', panel: 'showAuditTrail' })}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-c-text hover:bg-c-surface-raised min-h-[44px]"
        >
          <History size={14} /> {t('ideas.table.history', 'History')}
        </button>
        <button
          onClick={() => uiDispatch({ type: 'TOGGLE_PANEL', panel: 'showActivityFeed' })}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-c-text hover:bg-c-surface-raised min-h-[44px]"
        >
          <Activity size={14} /> {t('ideas.table.activity', 'Activity')}
        </button>
        <button
          onClick={props.onShowConditionalFmt}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-c-text hover:bg-c-surface-raised min-h-[44px]"
        >
          <Paintbrush size={14} /> {t('ideas.table.formatting', 'Formatting')}
        </button>
        {!locked && (
          <button
            onClick={() => runAction('idea.ai.table_framework', props.onShowFrameworkGen)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-c-text hover:bg-c-surface-raised min-h-[44px]"
          >
            <LayoutGrid size={14} /> {t('ideas.table.framework', 'Framework')}
          </button>
        )}
        {!locked && (
          <button
            onClick={() => uiDispatch({ type: 'TOGGLE_PANEL', panel: 'showTemplateGallery' })}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-c-text hover:bg-c-surface-raised min-h-[44px]"
          >
            <LayoutTemplate size={14} /> {t('ideas.table.templates', 'Templates')}
          </button>
        )}
      </MobileToolbarMenuComponent>

      {/* CSV import/export + Connectors */}
      <div className="flex items-center gap-0.5">
        {props.connectors.connectors.length > 0 && (
          <button
            onClick={props.onShowConnectorList}
            className="relative p-1.5 rounded-lg text-c-text-secondary hover:text-c-text-secondary transition-colors"
            title={t('ideas.table.connectors', 'Connectors')}
          >
            <Layers size={12} />
            {props.connectors.connectors.some((c) => c.lastRunStatus === 'running') && (
              <span className="absolute top-0.5 right-0.5 h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
            )}
            {props.connectors.connectors.some((c) => c.lastRunStatus === 'failed') && (
              <span className="absolute top-0.5 right-0.5 h-1.5 w-1.5 rounded-full bg-danger-500" />
            )}
          </button>
        )}
        {/* TB-P2-01: moved into the "More" menu (Tools section) — was a
            standalone icon here AND a duplicate entry in the now-removed
            "Tools" dropdown, both calling this exact same handler. */}
        <input
          ref={csvInputRef}
          type="file"
          accept=".csv,.tsv,.txt"
          className="hidden"
          onChange={props.onCSVImport}
        />
        {!locked && (
          <ToolbarIconButton
            onClick={() => csvInputRef.current?.click()}
            title={t('ideas.table.importCsv', 'Import CSV')}
          >
            <Upload size={12} />
          </ToolbarIconButton>
        )}
        <ToolbarIconButton
          onClick={props.onExportCSV}
          title={t('ideas.table.exportCsv', 'Export CSV')}
        >
          <Download size={12} />
        </ToolbarIconButton>
        <ToolbarIconButton
          onClick={props.onCopyToClipboard}
          title={t('ideas.table.copyToClipboard', 'Copy to clipboard')}
        >
          <ClipboardCopy size={12} />
        </ToolbarIconButton>
      </div>

      {/* Column config */}
      <div className="relative">
        <button
          onClick={() => setShowColumnConfig(!showColumnConfig)}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-medium text-c-text-secondary hover:bg-c-surface-raised transition-colors"
          title={t('ideas.table.columns', 'Columns')}
        >
          <Columns3 size={12} />
        </button>
        {showColumnConfig && (
          <div className="absolute right-0 top-full mt-1 z-50 w-52 rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface shadow-xl p-2">
            {columns.map((col) => (
              <button
                key={col.key}
                onClick={() => toggleColumn(col.key)}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[11px] text-c-text hover:bg-c-surface-raised transition-colors"
              >
                {col.visible ? (
                  <Eye size={12} className="text-c-text-muted" />
                ) : (
                  <EyeOff size={12} className="text-c-text-secondary" />
                )}
                {col.header}
                <span className="ml-auto text-[9px] text-c-text-secondary">{col.type}</span>
              </button>
            ))}
            <div className="border-t border-c-border-subtle mt-1 pt-1">
              {/* TB-P2-02: this dropdown's own "Add field" trigger was removed
                  — it duplicated the rail's Columns slot (`tbl_add_column`,
                  same result: opens a column-add dialog). Ownership model:
                  rail = creation, toolbar = current-view editing, so this
                  dropdown keeps show/hide + Manage Fields (editing the
                  existing schema/visibility) and creation moves to the rail
                  only. The `ui.showAddColumn` dialog mounted below stays —
                  ViewRouter's empty-state "Add field" CTA still opens it. */}
              {/* Field Manager button — wires the orphaned FieldManager component */}
              {usePlatform && (
                <button
                  onClick={() => {
                    setShowColumnConfig(false);
                    uiDispatch({ type: 'SET_PANEL', panel: 'showFieldManager', value: true });
                  }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10 transition-colors"
                >
                  <Columns3 size={12} /> {t('ideas.table.toolbar.manageFields', 'Manage Fields')}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* TB-P2-02: the toolbar's own Undo/Redo buttons were a plain duplicate
          of the canvas rail's Undo/Redo (CanvasLeftToolbar, present for all
          four Idea representations — chapter 14 draft §3 lists undo/redo as
          a Table rail feature) — same icons, same keyboard shortcuts, no
          differentiation. Per the rail = creation/navigation, toolbar =
          current-mode/selection editing ownership model, undo/redo is
          history navigation, so the rail keeps it and this toolbar copy is
          removed. `nodesUndo`/`onPlatformUndo` stay in TableToolbarProps
          (the parent still passes them; this file just no longer renders
          buttons for them) to avoid touching IdeaTableTool.tsx's call site
          in a pass scoped to this file. */}

      <div className="flex-1" />

      {/* Bulk actions */}
      {selectedRowIds.size > 0 && (
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold text-c-text bg-c-surface px-2 py-0.5 rounded-lg">
            {selectedRowIds.size} {t('ideas.table.selected', 'selected')}
          </span>
          {!locked && (
            <>
              <div className="relative">
                <button
                  onClick={() => setShowBulkConvertMenu((p) => !p)}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold text-emerald-600 bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors"
                >
                  <ArrowRight size={11} /> {t('ideas.table.convert', 'Convert')}{' '}
                  <ChevronDown size={9} />
                </button>
                {showBulkConvertMenu && (
                  <div className="absolute right-0 top-full mt-1 z-50 w-44 rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface shadow-xl p-1">
                    {(['initiative', 'task', 'decision'] as const).map((convertType) => (
                      <button
                        key={convertType}
                        onClick={() =>
                          runAction('idea.workspace.table_bulk_convert', () =>
                            props.onBulkConvert(convertType)
                          )
                        }
                        className="w-full text-left px-3 py-1.5 rounded-lg text-[11px] font-medium text-c-text hover:bg-c-surface-raised transition-colors capitalize"
                      >
                        →{' '}
                        {convertType === 'initiative'
                          ? t('ideas.table.initiative', 'Initiative')
                          : convertType === 'task'
                            ? t('ideas.table.task', 'Task')
                            : t('ideas.table.decision', 'Decision')}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <Button
                variant="danger"
                size="sm"
                onClick={() => runAction('table.rows.bulk_delete', handleBulkDelete)}
                icon={<Trash2 />}
              >
                {t('ideas.table.delete', 'Delete')}
              </Button>
            </>
          )}
        </div>
      )}

      {/* TB-P2-02: kept, not removed, despite the rail also having an "Add
          row" slot (`tbl_add_row`) — this is NOT a plain duplicate. The
          chevron opens a template picker (`onAddRowWithTemplate`) that the
          rail's row slot has no equivalent for (no popover configured on
          that slot), so removing this would delete the only reachable path
          to "add row from a template", not just tidy a copy. The plain
          "Row" click IS the same end result as the rail's row slot — kept
          alongside it for the split-button structure (one control, one
          click target for both actions) rather than to duplicate creation
          on two surfaces. Verified but NOT touched (would need editing
          `IdeaTableTool.tsx`, out of this file's scope): the rail's plain
          row-add path is wired to a bare, non-platform-aware row-creation
          function distinct from what this button calls — a discovered,
          pre-existing mismatch flagged in the P2 report for a human call,
          not something to paper over by deleting the button that works. */}
      {/* Add row */}
      {!locked && (
        <div className="flex items-center rounded-lg border border-c-border-subtle overflow-hidden">
          <button
            onClick={() => runAction('table.rows.add_row', () => handleAddRow())}
            data-testid="table-add-row"
            className="inline-flex items-center gap-1 px-2 py-1.5 text-[11px] font-medium text-c-text-secondary hover:bg-c-surface-raised transition-colors"
            title={t('ideas.table.addBlankRow', 'Add blank row')}
          >
            <Plus size={12} /> {t('ideas.table.row', 'Row')}
          </button>
          <button
            onClick={() =>
              runAction('idea.view.table_add_row_with_template', props.onAddRowWithTemplate)
            }
            className="px-1 py-1.5 text-c-text-secondary hover:text-c-text-secondary hover:bg-c-surface-raised transition-colors border-l border-c-border-subtle"
            title={t('ideas.table.addFromTemplate', 'Add from template')}
          >
            <ChevronDown size={10} />
          </button>
        </div>
      )}

      {/* Save button — #6c: "Saved Xs ago" tekst usunięty, autosave ma być cichy
          (dublet z Mind Map #6b/#6c). Mechanika sync (saveStatusLabel prop) zostaje.
          Z9: gdy Menu 1 (mels canvas shell) niesie własny wskaźnik zapisu
          (IdeaSaveIndicator), toolbar chowa WŁASNY przycisk Zapisz — zero dubli.
          hideSaveIndicator=false (legacy) → renderuje jak dotąd. Mechanika zapisu
          (autosave + handleSave) bez zmian. */}
      {!hideSaveIndicator && (
        <Button
          variant="primary"
          size="sm"
          onClick={() => runAction('idea.canvas.tbl_save', () => void handleSave())}
          disabled={saving || loading || locked}
          loading={saving}
          icon={<Save />}
        >
          {saving ? t('ideas.table.saving', 'Saving…') : t('ideas.table.save', 'Save')}
        </Button>
      )}

      <Sheet
        open={aiSchemaSheetOpen}
        onOpenChange={(open) => {
          setAiSchemaSheetOpen(open);
          if (!open) setAiProposal(null);
        }}
      >
        <SheetContent side="right" className="flex w-full max-w-md flex-col p-0 sm:max-w-lg">
          <SheetHeader className="relative border-b border-c-border-subtle pr-12">
            <SheetTitle>
              {t('ideas.table.toolbar.tableSchemaAssistant', 'Table schema assistant')}
            </SheetTitle>
            <SheetDescription>
              {[base?.name, table?.name].filter(Boolean).join(' · ') ||
                t('ideas.table.toolbar.draftSchemaChangesWithAi', 'Draft schema changes with AI.')}
            </SheetDescription>
            <div className="absolute right-4 top-4">
              <SheetClose className="relative text-c-text-muted hover:text-c-text" />
            </div>
          </SheetHeader>
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
            {!aiProposal ? (
              <AITableAssistant
                open
                onClose={() => {
                  setAiSchemaSheetOpen(false);
                  setAiProposal(null);
                }}
                ideaId={props.ideaId}
                columns={columns}
                artifactContext={ctx.processedRows
                  .filter((n) => n.data?.label)
                  .slice(0, 20)
                  .map((n) => ({
                    id: n.id,
                    type: String(n.type || 'idea'),
                    title: String(n.data?.label || ''),
                    snippet: String(n.data?.description || n.data?.bodyMarkdown || '').slice(
                      0,
                      200
                    ),
                  }))}
                onSort={(s) => setSort(s)}
                onFilter={(f) => setFilters(f)}
                onGroup={(g) => setGroupBy(g)}
                onAddColumn={handleAddColumn}
                onAddRows={(rows) => {
                  if (!tableId || !rows.length) {
                    toast(
                      t(
                        'ideas.table.toolbar.rowInsertRequiresPlatformTable',
                        'Row insert is available once the platform table is loaded.'
                      )
                    );
                    return;
                  }
                  void (async () => {
                    try {
                      for (const row of rows) {
                        await TablePlatformApi.createRecord(
                          tableId,
                          (row.data ?? {}) as Record<string, unknown>
                        );
                      }
                      await refresh();
                      toast.success(
                        t('ideas.table.toolbar.addedRows', 'Added {{count}} rows', {
                          count: rows.length,
                        })
                      );
                    } catch (e: unknown) {
                      const msg = e instanceof Error ? e.message : String(e);
                      toast.error(
                        msg || t('ideas.table.toolbar.couldNotAddRows', 'Could not add rows')
                      );
                    }
                  })();
                }}
                onProposal={(p) => {
                  setAiProposal(p);
                }}
                usePlatform={usePlatform}
                workspaceId={base?.workspaceId ?? props.ideaId}
              />
            ) : (
              <AITableProposal
                proposal={aiProposal}
                onAccept={onProposalApproved}
                onReject={() => setAiProposal(null)}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* TB-P1-02: the ONLY AddColumnDialog mount for the Table Platform
          surface — the "New column" trigger above and EmptyStateView's
          "Add field" (ViewRouter) both just flip `ui.showAddColumn` on this
          shared context, so there is one dialog, one open path, no fork. */}
      <AddColumnDialog
        open={ui.showAddColumn}
        onClose={() => uiDispatch({ type: 'SET_PANEL', panel: 'showAddColumn', value: false })}
        onAdd={handleAddColumn}
        onUndo={deleteColumn}
        existingKeys={columns.map((c) => c.key)}
        tableId={tableId ?? undefined}
        tableFields={columns.map((c) => ({ id: c.key, name: c.header, fieldType: c.type }))}
      />
    </div>
  );
};

export default TableToolbar;
