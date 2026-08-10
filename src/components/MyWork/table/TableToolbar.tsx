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
  Redo2,
  Rocket,
  Save,
  Send,
  Sparkles,
  Table2,
  Trash2,
  Trophy,
  Undo2,
  Upload,
  Webhook,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/primitives/Button';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import * as TablePlatformApi from '@/services/api/tablePlatform.api';

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
  } = ctx;

  // Local UI toggles scoped to toolbar
  const [showSaveViewDialog, setShowSaveViewDialog] = useState(false);
  const [saveViewName, setSaveViewName] = useState('');
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
  const [showToolsMenu, setShowToolsMenu] = useState(false);
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
                onClick={() => applyView(v)}
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
          onClick={() => setShowSaveViewDialog(false)}
        >
          <div
            className="bg-c-surface rounded-xl shadow-xl border border-slate-200/60 dark:border-white/[0.03] p-4 w-72"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-semibold mb-2 text-c-text">
              {t('ideas.table.saveView', 'Save view')}
            </h3>
            <input
              autoFocus
              value={saveViewName}
              onChange={(e) => setSaveViewName(e.target.value)}
              placeholder={t('ideas.table.viewName', 'View name…')}
              className="w-full h-8 px-3 rounded-lg text-xs bg-c-surface-raised border border-c-border-subtle outline-none focus:ring-2 focus:ring-blue-500/30 mb-3"
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
                onClick={() => handleSaveView(saveViewName.trim())}
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
              onClick={() => {
                const v = savedViews.find((sv) => sv.id === viewContextMenu.viewId);
                if (v) {
                  setRenamingViewId(v.id);
                  setRenamingViewName(v.name);
                }
                setViewContextMenu(null);
              }}
            >
              {t('ideas.table.rename', 'Rename')}
            </button>
            <button
              className="w-full px-3 py-1.5 text-xs text-left hover:bg-c-surface-raised text-c-text"
              onClick={() => {
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
              }}
            >
              {t('ideas.table.update', 'Update')}
            </button>
            <button
              className="w-full px-3 py-1.5 text-xs text-left hover:bg-danger-50 dark:hover:bg-danger-900/20 text-danger-600"
              onClick={() => {
                deleteSavedView(viewContextMenu.viewId);
                toast.success(t('ideas.table.viewDeleted', 'View deleted'));
                setViewContextMenu(null);
              }}
            >
              {t('ideas.table.delete', 'Delete')}
            </button>
          </div>
        </div>
      )}

      <div className="w-px h-5 bg-c-border-subtle" />

      {/* Quick filter */}
      <div className="relative flex-1 max-w-[200px]">
        <Filter
          size={12}
          className="absolute left-2 top-1/2 -translate-y-1/2 text-c-text-secondary"
        />
        <input
          value={props.filterInput}
          onChange={(e) => props.onFilterInputChange(e.target.value)}
          placeholder={t('ideas.table.filter', 'Filter…')}
          className="w-full h-7 pl-7 pr-2 rounded-lg text-[11px] bg-c-surface border border-slate-200/60 dark:border-white/[0.03] text-c-text outline-none focus:ring-2 focus:ring-blue-500/30"
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
              };
              const items: MoreItem[] = [
                {
                  icon: Layers,
                  label: t('ideas.table.aiCategorize', 'AI Categorize'),
                  onClick: props.onShowAICategorize,
                  show: !locked,
                },
                {
                  icon: Trophy,
                  label: t('ideas.table.scoringModel', 'Scoring Model'),
                  onClick: props.onShowScoringModel,
                },
                {
                  icon: Presentation,
                  label: t('ideas.table.exportToPresentation', 'Export to Presentation'),
                  onClick: props.onShowExportPresentation,
                },
                {
                  icon: Rocket,
                  label: t('ideas.table.ideaPipeline', 'Idea Pipeline'),
                  onClick: props.onShowPipeline,
                },
                {
                  icon: Brain,
                  label: t('ideas.table.aiCopilot.label', 'AI Copilot'),
                  onClick: props.onShowCopilot,
                },
                {
                  icon: Mic,
                  label: t('ideas.table.voiceImage', 'Voice / Image'),
                  onClick: props.onShowVoiceInput,
                },
                {
                  icon: Network,
                  label: t('ideas.table.crossTableRelations', 'Cross-table Relations'),
                  onClick: props.onShowCrossRelations,
                },
                {
                  icon: Flame,
                  label: t('ideas.table.heatmap', 'Heatmap'),
                  onClick: props.onToggleHeatmap,
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
                  icon: Send,
                  label: t('ideas.table.distribute', 'Distribute'),
                  onClick: () => uiDispatch({ type: 'TOGGLE_PANEL', panel: 'showDistribution' }),
                  show: !locked,
                },
                {
                  icon: LayoutGrid,
                  label: t('ideas.table.frameworkGenerator', 'Framework Generator'),
                  onClick: props.onShowFrameworkGen,
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
              ];
              return items
                .filter((it) => it.show !== false)
                .map((it, i) => {
                  const Icon = it.icon;
                  return (
                    <button
                      key={i}
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
                  );
                });
            })()}
          </div>
        )}
      </div>

      {/* Desktop platform-only secondary actions */}
      <div className="hidden md:contents">
        {/* Platform tab switcher */}
        {usePlatform && (
          <div className="flex items-center rounded-lg bg-c-surface-raised p-0.5">
            {(['data', 'forms', 'interfaces', 'models', 'workflow'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => uiDispatch({ type: 'SET_PLATFORM_TAB', tab })}
                className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                  ui.platformTab === tab
                    ? 'bg-c-surface text-c-text shadow-sm'
                    : 'text-c-text-muted hover:text-c-text'
                }`}
              >
                {tab === 'data'
                  ? t('ideas.table.data', 'Data')
                  : tab === 'forms'
                    ? t('ideas.table.forms', 'Forms')
                    : tab === 'interfaces'
                      ? t('ideas.table.interfaces', 'Interfaces')
                      : tab === 'models'
                        ? t('ideas.table.models', 'Models')
                        : t('ideas.table.workflow', 'Workflow')}
              </button>
            ))}
          </div>
        )}

        {usePlatform && (
          <ToolbarIconButton
            onClick={() =>
              uiDispatch({ type: 'SET_PANEL', panel: 'showInterfaceDesigner', value: true })
            }
            active={ui.showInterfaceDesigner}
            title={t('ideas.table.interfaceDesigner.label', 'Interface Designer')}
          >
            <Layout size={12} />
          </ToolbarIconButton>
        )}
        {usePlatform && !locked && (
          <ToolbarIconButton
            onClick={() => uiDispatch({ type: 'SET_PANEL', panel: 'showFormBuilder', value: true })}
            title={t('ideas.table.formBuilder.label', 'Form Builder')}
          >
            <FileText size={12} />
          </ToolbarIconButton>
        )}

        {/* Tools dropdown */}
        {usePlatform && (
          <div className="relative">
            <button
              onClick={() => setShowToolsMenu((p) => !p)}
              className={`inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-medium transition-colors ${
                showToolsMenu
                  ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-500/10'
                  : 'text-c-text-secondary hover:bg-c-surface-raised'
              }`}
              title={t('ideas.table.tools', 'Tools')}
            >
              <Grid3X3 size={12} />
              <span className="hidden lg:inline">{t('ideas.table.tools', 'Tools')}</span>
              <ChevronDown size={10} />
            </button>
            {showToolsMenu && (
              <div className="absolute left-0 top-full mt-1 z-50 w-56 rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface shadow-xl py-1 max-h-[70vh] overflow-y-auto">
                <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-c-text-secondary">
                  {t('ideas.table.workflow', 'Workflow')}
                </div>
                {[
                  {
                    onClick: props.onShowAutomationsManager,
                    icon: <Rocket size={14} className="text-amber-500" />,
                    label: t('ideas.table.automations', 'Automations'),
                  },
                  {
                    onClick: props.onShowSyncManager,
                    icon: <Link2 size={14} className="text-blue-500" />,
                    label: t('ideas.table.dataSync', 'Data Sync'),
                  },
                  {
                    onClick: props.onShowWebhookRelays,
                    icon: <Webhook size={14} className="text-indigo-500" />,
                    label: t('ideas.table.webhookRelays', 'Webhook Relays'),
                  },
                  {
                    onClick: props.onShowSharingManager,
                    icon: <Network size={14} className="text-green-500" />,
                    label: t('ideas.table.sharingPermissions', 'Sharing & Permissions'),
                  },
                  {
                    onClick: props.onShowDistributionManager,
                    icon: <Send size={14} className="text-pink-500" />,
                    label: t('ideas.table.distribution', 'Distribution'),
                  },
                ].map((item, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      item.onClick();
                      setShowToolsMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-c-surface-raised text-c-text"
                  >
                    {item.icon} {item.label}
                  </button>
                ))}
                <div className="border-t border-c-border-subtle my-1" />
                <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-c-text-secondary">
                  {t('ideas.table.build', 'Build')}
                </div>
                {[
                  {
                    onClick: () =>
                      uiDispatch({ type: 'SET_PANEL', panel: 'showFormBuilder', value: true }),
                    icon: <FileText size={14} className="text-blue-500" />,
                    label: t('ideas.table.forms', 'Forms'),
                  },
                  {
                    onClick: () =>
                      uiDispatch({
                        type: 'SET_PANEL',
                        panel: 'showInterfaceDesigner',
                        value: true,
                      }),
                    icon: <Layout size={14} className="text-blue-500" />,
                    label: t('ideas.table.interfaces', 'Interfaces'),
                  },
                  {
                    onClick: () =>
                      uiDispatch({ type: 'SET_PANEL', panel: 'showTemplateGallery', value: true }),
                    icon: <LayoutTemplate size={14} className="text-emerald-500" />,
                    label: t('ideas.table.templates', 'Templates'),
                  },
                ].map((item, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      item.onClick();
                      setShowToolsMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-c-surface-raised text-c-text"
                  >
                    {item.icon} {item.label}
                  </button>
                ))}
                <div className="border-t border-c-border-subtle my-1" />
                <button
                  onClick={() => {
                    props.onShowConsultifyLink();
                    setShowToolsMenu(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-c-surface-raised text-c-text"
                >
                  <Layers size={14} className="text-indigo-500" />{' '}
                  {t('ideas.table.consultifyLink', 'Consultify Link')}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Mobile overflow menu */}
      <MobileToolbarMenuComponent>
        {!locked && (
          <button
            onClick={props.onShowAICategorize}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-c-text hover:bg-c-surface-raised min-h-[44px]"
          >
            <Layers size={14} /> {t('ideas.table.aiCategorize', 'AI Categorize')}
          </button>
        )}
        <button
          onClick={props.onShowScoringModel}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-c-text hover:bg-c-surface-raised min-h-[44px]"
        >
          <Trophy size={14} /> {t('ideas.table.scoring', 'Scoring')}
        </button>
        <button
          onClick={props.onShowExportPresentation}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-c-text hover:bg-c-surface-raised min-h-[44px]"
        >
          <Presentation size={14} /> {t('ideas.table.presentation', 'Presentation')}
        </button>
        <button
          onClick={props.onShowPipeline}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-c-text hover:bg-c-surface-raised min-h-[44px]"
        >
          <Rocket size={14} /> {t('ideas.table.pipeline', 'Pipeline')}
        </button>
        <button
          onClick={props.onShowCopilot}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-c-text hover:bg-c-surface-raised min-h-[44px]"
        >
          <Brain size={14} /> AI Copilot
        </button>
        <button
          onClick={props.onShowVoiceInput}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-c-text hover:bg-c-surface-raised min-h-[44px]"
        >
          <Mic size={14} /> {t('ideas.table.voiceImage', 'Voice / Image')}
        </button>
        <button
          onClick={props.onShowCrossRelations}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-c-text hover:bg-c-surface-raised min-h-[44px]"
        >
          <Network size={14} /> {t('ideas.table.relations', 'Relations')}
        </button>
        <button
          onClick={props.onToggleHeatmap}
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
            onClick={props.onShowFrameworkGen}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-c-text hover:bg-c-surface-raised min-h-[44px]"
          >
            <LayoutGrid size={14} /> Framework
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
        {usePlatform && (
          <ToolbarIconButton
            onClick={props.onShowWebhookRelays}
            title={t('ideas.table.webhookRelaysZapierMake', 'Webhook Relays (Zapier/Make)')}
          >
            <Webhook size={12} />
          </ToolbarIconButton>
        )}
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
              <button
                onClick={() => {
                  setShowColumnConfig(false);
                  uiDispatch({ type: 'SET_PANEL', panel: 'showAddColumn', value: true });
                }}
                data-testid="table-toolbar-add-field"
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[11px] font-semibold text-c-text hover:bg-c-surface transition-colors"
              >
                <Plus size={12} /> {t('ideas.table.newColumn', 'Add field')}
              </button>
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

      {/* Undo / Redo */}
      <div className="flex items-center gap-0.5">
        <button
          onClick={props.onPlatformUndo}
          disabled={!usePlatform && !props.nodesUndo.canUndo}
          className="p-1.5 rounded-lg text-c-text-secondary hover:text-c-text-secondary disabled:opacity-30 transition-colors"
          title="Undo (Ctrl+Z)"
        >
          <Undo2 size={13} />
        </button>
        <button
          onClick={props.nodesUndo.redo}
          disabled={!props.nodesUndo.canRedo}
          className="p-1.5 rounded-lg text-c-text-secondary hover:text-c-text-secondary disabled:opacity-30 transition-colors"
          title="Redo (Ctrl+Y)"
        >
          <Redo2 size={13} />
        </button>
      </div>

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
                        onClick={() => props.onBulkConvert(convertType)}
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
              <Button variant="danger" size="sm" onClick={handleBulkDelete} icon={<Trash2 />}>
                {t('ideas.table.delete', 'Delete')}
              </Button>
            </>
          )}
        </div>
      )}

      {/* Add row */}
      {!locked && (
        <div className="flex items-center rounded-lg border border-c-border-subtle overflow-hidden">
          <button
            onClick={() => handleAddRow()}
            data-testid="table-add-row"
            className="inline-flex items-center gap-1 px-2 py-1.5 text-[11px] font-medium text-c-text-secondary hover:bg-c-surface-raised transition-colors"
            title={t('ideas.table.addBlankRow', 'Add blank row')}
          >
            <Plus size={12} /> {t('ideas.table.row', 'Row')}
          </button>
          <button
            onClick={props.onAddRowWithTemplate}
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
          onClick={() => void handleSave()}
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
