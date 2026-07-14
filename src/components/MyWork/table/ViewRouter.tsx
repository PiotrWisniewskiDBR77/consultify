/**
 * ViewRouter — Central view dispatcher for the Table Platform (P15 Tabele).
 *
 * Reads layout and data from `TableDataProvider` via `useTableData()`, renders the
 * spreadsheet grid with platform cell renderers/editors, alternate layouts
 * (Kanban, Calendar, Timeline, Matrix, Gallery, Sticky notes), saved-view switching,
 * and the Field Manager slide-over.
 */
import {
  AlertTriangle,
  Calendar,
  ChevronRight,
  Filter,
  GanttChart,
  Grid3X3,
  KanbanSquare,
  Layout,
  LayoutGrid,
  Plus,
  StickyNote,
  Table2,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { FieldType, LinkedRecordFieldOptions, TablePlatformView } from '@/types/tablePlatform';

import { CalendarView } from './CalendarView';
import { CellEditor } from './CellEditor';
import { ChatToSchemaPanel } from './ChatToSchemaPanel';
import { type FormatRule, getConditionalStyle } from './ConditionalFormatting';
import { EmptyStateView } from './EmptyStateView';
import { FieldManager } from './FieldManager';
import { GridView, isMissingField } from './GridView';
import { KanbanView } from './KanbanView';
import { LinkedRecordDisplay } from './LinkedRecordDisplay';
import { MatrixView } from './MatrixView';
import { PlatformCellRenderer } from './PlatformCellRenderer';
import { StickyNoteView } from './StickyNoteView';
import { useTableData } from './TableDataProvider';
import { tpViewToLegacy } from './tablePlatformMappers';
import type { ColumnDef, TableEdge, TableNode } from './tableTypes';
import { TimelineView } from './TimelineView';
import type { ViewLayout } from './useTableViews';
import ViewErrorBoundary from './ViewErrorBoundary';
import { ViewSwitcher } from './ViewSwitcher';

// ── Types ────────────────────────────────────────────────────────────────────

export interface ViewRouterProps {
  /** Optional CSV import handler (same contract as `TableToolbar` hidden file input). */
  onCSVImport?: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function platformViewTypeToViewLayout(vt: TablePlatformView['viewType']): ViewLayout {
  switch (vt) {
    case 'grid':
      return 'table';
    case 'gallery':
      return 'grid';
    case 'kanban':
      return 'kanban';
    case 'calendar':
      return 'calendar';
    case 'timeline':
      return 'timeline';
    case 'form':
    default:
      return 'table';
  }
}

function cellId(rowId: string, fieldId: string): string {
  return `${rowId}:${fieldId}`;
}

// ── Platform grid (table layout) ─────────────────────────────────────────────

interface PlatformGridViewProps {
  processedRows: TableNode[];
  groupedRows: Record<string, TableNode[]> | null;
  visibleColumns: ColumnDef[];
  platformFieldById: Map<
    string,
    { fieldType: FieldType; options: Record<string, unknown>; isComputed: boolean }
  >;
  locked: boolean;
  selectedRowIds: Set<string>;
  toggleRowSelection: (id: string) => void;
  handleFieldChange: (nodeId: string, field: string, value: unknown) => void;
  editingCellId: string | null;
  setEditingCellId: (id: string | null) => void;
  onOpenLinkedRecord: (recordId: string, tableId: string) => void;
  viewConfig?: { missing_fields?: string[]; missing_field_names?: Record<string, string> };
  onRemoveMissingField?: (fieldId: string) => void;
  isPl: boolean;
  /** R5: conditional-formatting rules applied per-cell. */
  formatRules: FormatRule[];
}

const PlatformGridView: React.FC<PlatformGridViewProps> = ({
  processedRows,
  groupedRows,
  visibleColumns,
  platformFieldById,
  locked,
  selectedRowIds,
  toggleRowSelection,
  handleFieldChange,
  editingCellId,
  setEditingCellId,
  onOpenLinkedRecord,
  viewConfig,
  onRemoveMissingField,
  isPl,
  formatRules,
}) => {
  const renderCell = (row: TableNode, col: ColumnDef) => {
    if (isMissingField(col.key, viewConfig)) {
      return (
        <div className="px-1 py-1 text-xs text-c-warning italic select-none" aria-hidden>
          —
        </div>
      );
    }
    const id = cellId(row.id, col.key);
    const isEditing = !locked && editingCellId === id;
    const pf = platformFieldById.get(col.key);
    const fieldType = (pf?.fieldType ?? 'singleLineText') as FieldType;
    const fieldOptions = (pf?.options ?? {}) as Record<string, unknown>;
    const rawValue = row.data?.[col.key];
    const isLinked = fieldType === 'linkedRecord';
    const linkedTableId =
      (fieldOptions as unknown as LinkedRecordFieldOptions)?.linkedTableId ?? '';

    if (isEditing) {
      return (
        <div className="min-w-0 p-1" onClick={(e) => e.stopPropagation()}>
          <CellEditor
            value={rawValue}
            fieldType={fieldType}
            fieldOptions={fieldOptions}
            linkedRecordContext={
              isLinked ? { recordId: row.id, fieldId: col.key, linkedTableId } : undefined
            }
            onSave={(v) => {
              handleFieldChange(row.id, col.key, v);
              setEditingCellId(null);
            }}
            onCancel={() => setEditingCellId(null)}
          />
        </div>
      );
    }

    const readOnly =
      isLinked && linkedTableId ? (
        <LinkedRecordDisplay
          recordId={row.id}
          fieldId={col.key}
          linkedTableId={linkedTableId}
          locked={locked}
          onOpenRecord={(rid, tid) => onOpenLinkedRecord(rid, tid)}
          onOpenPicker={() => {
            if (!locked) setEditingCellId(id);
          }}
        />
      ) : (
        <PlatformCellRenderer
          value={rawValue}
          fieldType={fieldType}
          fieldOptions={fieldOptions}
          record={{ data: row.data as Record<string, unknown> | undefined }}
        />
      );

    return (
      <div
        role="gridcell"
        tabIndex={0}
        className="min-w-0 min-h-[36px] flex items-stretch outline-none focus-visible:ring-1 focus-visible:ring-c-focus cursor-text"
        onDoubleClick={(e) => {
          e.stopPropagation();
          if (locked || pf?.isComputed) return;
          setEditingCellId(id);
        }}
        onKeyDown={(e) => {
          if (locked || pf?.isComputed) return;
          if (e.key === 'Enter') {
            e.preventDefault();
            setEditingCellId(id);
          }
        }}
      >
        {readOnly}
      </div>
    );
  };

  const renderRow = (row: TableNode) => (
    <tr key={row.id} className="hover:bg-c-surface-raised">
      <td className="w-10 border-b border-r border-c-border-subtle px-1 py-1 align-middle text-center">
        <input
          type="checkbox"
          className="rounded border-c-border-subtle"
          checked={selectedRowIds.has(row.id)}
          disabled={locked}
          onChange={() => toggleRowSelection(row.id)}
          aria-label="Select row"
        />
      </td>
      {visibleColumns.map((col) => {
        const missing = isMissingField(col.key, viewConfig);
        // R5: conditional formatting — only on real (non-missing) cells.
        const cfStyle = missing
          ? undefined
          : getConditionalStyle(formatRules, col.key, row.data?.[col.key]);
        return (
          <td
            key={col.key}
            style={cfStyle}
            className={
              missing
                ? 'border-b border-r border-[color-mix(in_srgb,var(--c-warning)_20%,transparent)] bg-[color-mix(in_srgb,var(--c-warning)_8%,transparent)] align-top min-w-[120px] max-w-[280px] px-3 py-2 text-xs text-c-warning italic'
                : 'border-b border-r border-c-border-subtle align-top min-w-[120px] max-w-[280px]'
            }
          >
            {renderCell(row, col)}
          </td>
        );
      })}
    </tr>
  );

  const body =
    groupedRows && Object.keys(groupedRows).length > 0
      ? Object.entries(groupedRows).map(([groupLabel, rows]) => (
          <React.Fragment key={groupLabel}>
            <tr className="bg-c-surface-raised">
              <td
                colSpan={visibleColumns.length + 1}
                className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-c-text-muted border-b border-c-border-subtle"
              >
                {groupLabel}
              </td>
            </tr>
            {rows.map((row) => renderRow(row))}
          </React.Fragment>
        ))
      : processedRows.map((row) => renderRow(row));

  return (
    <div className="flex-1 min-h-0 overflow-auto rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface">
      <table
        /* §27-exempt: layout specjalizowany/read-only/data-viz, nie kanoniczna lista przegladana */ className="w-full border-collapse text-left text-[11px]"
      >
        <thead className="sticky top-0 z-10 bg-c-surface-raised backdrop-blur-sm">
          <tr>
            <th className="w-10 border-b border-r border-c-border-subtle" />
            {visibleColumns.map((col) => {
              const missing = isMissingField(col.key, viewConfig);
              const missingFieldName =
                viewConfig?.missing_field_names?.[col.key] ?? col.header ?? 'Unknown';
              if (missing) {
                return (
                  <th
                    key={col.key}
                    className="border-b border-r border-[color-mix(in_srgb,var(--c-warning)_35%,transparent)] bg-[color-mix(in_srgb,var(--c-warning)_12%,transparent)] text-c-warning text-xs px-3 py-2 font-semibold text-left whitespace-nowrap"
                  >
                    <div className="flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      <span className="min-w-0 truncate">[Missing: {missingFieldName}]</span>
                      <button
                        type="button"
                        onClick={() => onRemoveMissingField?.(col.key)}
                        className="ml-auto shrink-0 text-c-warning hover:brightness-110"
                        title={isPl ? 'Usuń z widoku' : 'Remove from view'}
                        aria-label={isPl ? 'Usuń z widoku' : 'Remove from view'}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  </th>
                );
              }
              return (
                <th
                  key={col.key}
                  className="border-b border-r border-c-border-subtle px-2 py-2 font-semibold text-c-text-secondary whitespace-nowrap"
                >
                  {col.header}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>{body}</tbody>
      </table>
    </div>
  );
};

// ── Empty state (delegated to shared EmptyStateView) ────────────────────────

// ── Main router ──────────────────────────────────────────────────────────────

export const ViewRouter: React.FC<ViewRouterProps> = ({ onCSVImport }) => {
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');
  const csvInputRef = useRef<HTMLInputElement>(null);

  const {
    loading,
    nodes,
    viewLayout,
    setViewLayout,
    processedRows,
    groupedRows,
    columns,
    visibleColumns,
    handleFieldChange,
    handleAddRow,
    selectedRowIds,
    toggleRowSelection,
    sort: _sort,
    setSort: _setSort,
    filters: _filters,
    groupBy,
    platformFields,
    ui,
    uiDispatch,
    locked,
    tableId,
    base,
    table,
    refresh,
    platformViews,
    activeViewId,
    setActiveViewId,
    applyView,
    createPlatformView,
    activeViewConfig,
    removeMissingFieldFromView,
    savedViews,
    formatRules,
  } = useTableData();

  const activeViewName = useMemo(() => {
    if (!activeViewId) return null;
    const view =
      savedViews.find((v) => v.id === activeViewId) ||
      platformViews?.find((v: any) => v.id === activeViewId);
    return view?.name || null;
  }, [activeViewId, savedViews, platformViews]);

  useEffect(() => {
    if (!activeViewId) return;
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('tpView', activeViewId);
      window.history.replaceState({}, '', url.toString());
    } catch {}
  }, [activeViewId]);

  const handleRemoveMissingField = useCallback(
    async (fieldId: string) => {
      if (!activeViewId) return;
      try {
        await removeMissingFieldFromView(fieldId);
      } catch (e) {
        console.error('Failed to remove missing field', e);
      }
    },
    [activeViewId, removeMissingFieldFromView]
  );

  const platformFieldById = useMemo(() => {
    const m = new Map<
      string,
      { fieldType: FieldType; options: Record<string, unknown>; isComputed: boolean }
    >();
    for (const f of platformFields) {
      m.set(f.id, {
        fieldType: f.fieldType,
        options: (f.options ?? {}) as Record<string, unknown>,
        isComputed: Boolean(f.isComputed),
      });
    }
    return m;
  }, [platformFields]);

  const setEditingCellId = useCallback(
    (id: string | null) => {
      uiDispatch({ type: 'SET_EDITING_CELL', id });
    },
    [uiDispatch]
  );

  const onOpenLinkedRecord = useCallback(
    (recordId: string, _tableId: string) => {
      void _tableId;
      uiDispatch({ type: 'SET_EXPANDED_RECORD', id: recordId });
    },
    [uiDispatch]
  );

  const handlePlatformViewChange = useCallback(
    (viewId: string) => {
      const tpView = platformViews.find((v) => v.id === viewId);
      if (tpView) {
        const sv = tpViewToLegacy(tpView, platformFields);
        applyView({
          ...sv,
          layout: platformViewTypeToViewLayout(tpView.viewType),
        });
      } else {
        setActiveViewId(viewId);
      }
    },
    [platformViews, platformFields, applyView, setActiveViewId]
  );

  const handleCreatePlatformView = useCallback(
    async (name: string, type: TablePlatformView['viewType'], isPersonal?: boolean) => {
      const created = await createPlatformView(
        name,
        type,
        isPersonal ? { isPersonal: true } : undefined
      );
      if (created?.id) {
        setActiveViewId(created.id);
        setViewLayout(platformViewTypeToViewLayout(type));
        await refresh();
      }
    },
    [createPlatformView, setActiveViewId, setViewLayout, refresh]
  );

  const kanbanGroupColumn = useMemo(() => {
    const byGroup = groupBy ? visibleColumns.find((c) => c.key === groupBy) : undefined;
    return (
      byGroup ||
      visibleColumns.find((c) => c.type === 'select' || c.type === 'status') ||
      visibleColumns[0] ||
      columns[0]
    );
  }, [columns, groupBy, visibleColumns]);

  const matrixAxes = useMemo(() => {
    const numeric = visibleColumns.filter((c) => c.type === 'number' || c.type === 'rating');
    const x = numeric[0] ?? visibleColumns[0] ?? columns[0];
    const y = numeric[1] ?? numeric[0] ?? visibleColumns[1] ?? visibleColumns[0] ?? columns[0];
    return { x, y };
  }, [columns, visibleColumns]);

  const timelineEdges = useMemo<TableEdge[]>(() => [], []);

  const [matrixX, setMatrixX] = useState<ColumnDef | null>(null);
  const [matrixY, setMatrixY] = useState<ColumnDef | null>(null);
  const [mobileViewPickerOpen, setMobileViewPickerOpen] = useState(false);
  useEffect(() => {
    if (!matrixAxes.x || !matrixAxes.y) return;
    setMatrixX((prev) => {
      if (!prev) return matrixAxes.x;
      const still = visibleColumns.some((c) => c.key === prev.key);
      return still ? prev : matrixAxes.x;
    });
    setMatrixY((prev) => {
      if (!prev) return matrixAxes.y;
      const still = visibleColumns.some((c) => c.key === prev.key);
      return still ? prev : matrixAxes.y;
    });
  }, [matrixAxes, visibleColumns]);

  const mxX = matrixX ?? matrixAxes.x;
  const mxY = matrixY ?? matrixAxes.y;

  const onMatrixAxisChange = useCallback((axis: 'x' | 'y', col: ColumnDef) => {
    if (axis === 'x') setMatrixX(col);
    else setMatrixY(col);
  }, []);

  const alternateView = useMemo(() => {
    switch (viewLayout) {
      case 'kanban':
        if (!kanbanGroupColumn) {
          return (
            <div className="flex flex-1 items-center justify-center text-sm text-c-text-muted">
              {isPl ? 'Brak kolumny grupującej' : 'No grouping column'}
            </div>
          );
        }
        return (
          <KanbanView
            nodes={processedRows}
            groupByColumn={kanbanGroupColumn}
            columns={columns}
            locked={locked}
            onFieldChange={handleFieldChange}
            onAddRow={handleAddRow}
            onNodeClick={(id) => uiDispatch({ type: 'SET_DETAIL_RECORD', id })}
          />
        );
      case 'calendar':
        return (
          <CalendarView
            rows={processedRows}
            columns={columns}
            locked={locked}
            onNodeClick={(id) => uiDispatch({ type: 'SET_DETAIL_RECORD', id })}
            onFieldChange={handleFieldChange}
            onAddEventAtDate={() => {
              if (!locked) handleAddRow();
            }}
          />
        );
      case 'timeline':
        return (
          <TimelineView
            nodes={processedRows}
            edges={timelineEdges}
            columns={columns}
            locked={locked}
            onFieldChange={handleFieldChange}
            onNodeClick={(id) => uiDispatch({ type: 'SET_DETAIL_RECORD', id })}
          />
        );
      case 'matrix':
        if (!mxX || !mxY) {
          return (
            <div className="flex flex-1 items-center justify-center text-sm text-c-text-muted">
              {isPl ? 'Brak kolumn' : 'No columns'}
            </div>
          );
        }
        return (
          <MatrixView
            nodes={processedRows}
            xAxis={mxX}
            yAxis={mxY}
            columns={columns}
            locked={locked}
            onFieldChange={handleFieldChange}
            onNodeClick={(id) => uiDispatch({ type: 'SET_DETAIL_RECORD', id })}
            onAxisChange={onMatrixAxisChange}
          />
        );
      case 'grid':
        return <GridView />;
      case 'sticky':
        return (
          <StickyNoteView
            nodes={processedRows}
            columns={columns}
            groupBy={groupBy}
            onNodeClick={(id) => uiDispatch({ type: 'SET_DETAIL_RECORD', id })}
            onFieldChange={handleFieldChange}
          />
        );
      case 'table':
      default:
        return null;
    }
  }, [
    viewLayout,
    processedRows,
    columns,
    locked,
    handleFieldChange,
    handleAddRow,
    uiDispatch,
    kanbanGroupColumn,
    timelineEdges,
    mxX,
    mxY,
    onMatrixAxisChange,
    isPl,
  ]);

  const mobileLayoutItems: { id: ViewLayout; icon: typeof Table2; label: string }[] = [
    { id: 'table', icon: Table2, label: isPl ? 'Tabela' : 'Table' },
    { id: 'kanban', icon: KanbanSquare, label: 'Kanban' },
    { id: 'timeline', icon: GanttChart, label: 'Timeline' },
    { id: 'calendar', icon: Calendar, label: isPl ? 'Kalendarz' : 'Calendar' },
    { id: 'matrix', icon: LayoutGrid, label: 'Matrix' },
    { id: 'grid', icon: Grid3X3, label: isPl ? 'Galeria' : 'Gallery' },
    { id: 'sticky', icon: StickyNote, label: isPl ? 'Notatki' : 'Notes' },
  ];

  const switchToGrid = useCallback(() => setViewLayout('grid'), [setViewLayout]);

  const mainContent =
    loading && !nodes.length ? (
      <div className="flex flex-1 items-center justify-center p-12">
        <div className="space-y-3 w-full max-w-2xl">
          <div className="h-10 bg-c-surface-raised rounded-xl animate-pulse" />
          <div className="h-8 bg-c-surface-raised rounded-lg animate-pulse" />
          <div className="h-8 bg-c-surface-raised rounded-lg animate-pulse w-3/4" />
          <div className="h-8 bg-c-surface-raised rounded-lg animate-pulse w-1/2" />
          <div className="h-8 bg-c-surface-raised rounded-lg animate-pulse w-5/6" />
        </div>
      </div>
    ) : processedRows.length === 0 ? (
      <ViewErrorBoundary viewName={viewLayout} onSwitchToGrid={switchToGrid} locale={i18n.language}>
        <EmptyStateView
          viewType={viewLayout}
          onAddRow={handleAddRow}
          onImportCSV={() => csvInputRef.current?.click()}
          onUseAI={() => uiDispatch({ type: 'TOGGLE_PANEL', panel: 'showChatToSchema' })}
        />
      </ViewErrorBoundary>
    ) : viewLayout === 'table' ? (
      <ViewErrorBoundary viewName={viewLayout} onSwitchToGrid={switchToGrid} locale={i18n.language}>
        <PlatformGridView
          processedRows={processedRows}
          groupedRows={groupedRows}
          visibleColumns={visibleColumns}
          platformFieldById={platformFieldById}
          locked={locked}
          selectedRowIds={selectedRowIds}
          toggleRowSelection={toggleRowSelection}
          handleFieldChange={handleFieldChange}
          editingCellId={ui.editingCellId}
          setEditingCellId={setEditingCellId}
          onOpenLinkedRecord={onOpenLinkedRecord}
          viewConfig={activeViewConfig}
          onRemoveMissingField={handleRemoveMissingField}
          isPl={isPl}
          formatRules={formatRules}
        />
      </ViewErrorBoundary>
    ) : (
      <ViewErrorBoundary viewName={viewLayout} onSwitchToGrid={switchToGrid} locale={i18n.language}>
        <div className="flex min-h-0 flex-1 flex-col">{alternateView}</div>
      </ViewErrorBoundary>
    );

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <input
        ref={csvInputRef}
        type="file"
        accept=".csv,.tsv,.txt"
        className="hidden"
        onChange={(e) => {
          onCSVImport?.(e);
          e.target.value = '';
        }}
      />

      {base && table && (
        <nav className="flex items-center gap-1.5 px-4 py-2 text-xs text-c-text-muted border-b border-c-border-subtle shrink-0">
          <span
            className="font-medium text-c-text-secondary truncate max-w-[120px]"
            title={base.name}
          >
            {base.name}
          </span>
          <ChevronRight className="h-3 w-3 shrink-0" />
          <span
            className="font-medium text-c-text-secondary truncate max-w-[160px]"
            title={table.name}
          >
            {table.name}
          </span>
          {activeViewName && (
            <>
              <ChevronRight className="h-3 w-3 shrink-0" />
              <span className="text-c-accent truncate max-w-[140px]" title={activeViewName}>
                {activeViewName}
              </span>
            </>
          )}
        </nav>
      )}

      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-c-border-subtle pb-2">
        <div className="inline-flex items-center gap-2 text-[11px] font-semibold text-c-text-muted">
          <Table2 className="h-3.5 w-3.5" />
          <span>{isPl ? 'Widok' : 'View'}</span>
        </div>
        <ViewSwitcher
          views={platformViews}
          activeViewId={activeViewId}
          onViewChange={handlePlatformViewChange}
          onCreateView={(name, type, isPersonal) => {
            void handleCreatePlatformView(name, type, isPersonal);
          }}
        />
      </div>

      {mobileViewPickerOpen && (
        <div
          className="md:hidden fixed inset-x-2 z-[45] rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface p-2 shadow-xl backdrop-blur-sm"
          style={{ bottom: 'calc(3.75rem + env(safe-area-inset-bottom, 0px))' }}
        >
          <div className="mb-1 text-center text-[10px] font-semibold uppercase tracking-wide text-c-text-muted">
            {isPl ? 'Układ widoku' : 'View layout'}
          </div>
          <div className="flex flex-wrap justify-center gap-1">
            {mobileLayoutItems.map((item) => {
              const Icon = item.icon;
              const active = viewLayout === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  title={item.label}
                  onClick={() => {
                    setViewLayout(item.id);
                    setMobileViewPickerOpen(false);
                  }}
                  className={`flex h-10 w-10 items-center justify-center rounded-lg border text-c-text-muted transition-colors ${
                    active
                      ? 'border-c-accent bg-c-accent-soft text-c-accent'
                      : 'border-c-border-subtle bg-c-surface hover:bg-c-surface-raised'
                  }`}
                >
                  <Icon className="h-4 w-4" strokeWidth={1.75} />
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex min-h-0 flex-1 touch-manipulation flex-col overflow-hidden pb-[calc(3.75rem+env(safe-area-inset-bottom,0px))] md:pb-0">
        {mainContent}
      </div>

      <div
        className="md:hidden fixed inset-x-0 bottom-0 z-40 flex items-stretch justify-around gap-1 border-t border-c-border-subtle bg-c-surface px-2 pt-2 shadow-[0_-4px_24px_rgba(15,23,42,0.08)] backdrop-blur-md dark:shadow-[0_-4px_24px_rgba(0,0,0,0.35)]"
        style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom, 0px))' }}
      >
        <button
          type="button"
          disabled={locked}
          onClick={() => {
            if (!locked) handleAddRow();
          }}
          className="flex min-h-[48px] min-w-[56px] flex-1 flex-col items-center justify-center gap-0.5 rounded-lg text-[10px] font-medium text-c-text-secondary disabled:opacity-40"
        >
          <Plus className="h-5 w-5 text-c-accent" />
          {isPl ? 'Rekord' : 'Record'}
        </button>
        <button
          type="button"
          onClick={() => {
            uiDispatch({ type: 'SET_PANEL', panel: 'showFilters', value: true });
            setMobileViewPickerOpen(false);
          }}
          className="flex min-h-[48px] min-w-[56px] flex-1 flex-col items-center justify-center gap-0.5 rounded-lg text-[10px] font-medium text-c-text-secondary"
        >
          <Filter className="h-5 w-5 text-c-text-muted" />
          {isPl ? 'Filtr' : 'Filter'}
        </button>
        <button
          type="button"
          onClick={() => setMobileViewPickerOpen((o) => !o)}
          className={`flex min-h-[48px] min-w-[56px] flex-1 flex-col items-center justify-center gap-0.5 rounded-lg text-[10px] font-medium ${
            mobileViewPickerOpen ? 'text-c-accent' : 'text-c-text-secondary'
          }`}
        >
          <Layout className="h-5 w-5" />
          {isPl ? 'Widok' : 'View'}
        </button>
      </div>

      {tableId ? (
        <FieldManager
          open={ui.showFieldManager}
          onClose={() => uiDispatch({ type: 'SET_PANEL', panel: 'showFieldManager', value: false })}
          tableId={tableId}
          fields={platformFields}
          primaryFieldId={table?.primaryFieldId}
          onFieldsChanged={() => {
            void refresh();
          }}
          locked={locked}
        />
      ) : null}

      {ui.showChatToSchema && (
        <div className="fixed inset-y-0 right-0 z-50 w-[480px] max-w-[90vw] shadow-2xl">
          <ChatToSchemaPanel
            workspaceId={tableId || ''}
            onClose={() =>
              uiDispatch({ type: 'SET_PANEL', panel: 'showChatToSchema', value: false })
            }
            onExecuted={async () => {
              await refresh();
              uiDispatch({ type: 'SET_PANEL', panel: 'showChatToSchema', value: false });
            }}
          />
        </div>
      )}
    </div>
  );
};

ViewRouter.displayName = 'ViewRouter';

export default ViewRouter;
