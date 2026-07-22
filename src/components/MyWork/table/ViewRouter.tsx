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
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import type {
  FieldType,
  LinkedRecordFieldOptions,
  TablePlatformField,
  TablePlatformView,
} from '@/types/tablePlatform';

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
  /**
   * K1/Airtable parity — row kebab "Rozwiń rekord": opens the full record modal
   * (RecordExpandModal, rendered by the parent IdeaTableTool). Optional — the
   * menu item disables itself (with a note) when not wired.
   */
  onExpandRecord?: (id: string) => void;
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

export interface PlatformGridViewProps {
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
  /** R5: conditional-formatting rules applied per-cell. */
  formatRules: FormatRule[];
  /** K1/Airtable parity — row kebab actions. */
  platformFields: TablePlatformField[];
  handleDuplicateRow: (id: string) => void;
  handleDeleteRow: (id: string) => void;
  handleInsertRow: (referenceId: string, direction: 'above' | 'below') => void;
  onExpandRecord?: (id: string) => void;
}

// Exported as a dev-render/visual-test seam (K1 Airtable-parity row kebab is
// only reachable in-app when tablePlatformMetadataFirst has a live platform
// base; the harness mounts this pure-presentational component with mock props).
export const PlatformGridView: React.FC<PlatformGridViewProps> = ({
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
  formatRules,
  platformFields,
  handleDuplicateRow,
  handleDeleteRow,
  handleInsertRow,
  onExpandRecord,
}) => {
  const { t, i18n } = useTranslation();
  // The kebab + note editor render inline pl/en strings via `isPl` (same
  // convention as the ViewRouter parent below). Without this the component
  // throws `isPl is not defined` the moment it mounts — latent because in-app
  // PlatformGridView only renders when tablePlatformMetadataFirst resolves a
  // live base (none exist yet), so it was never exercised until the dev-render
  // harness mounted it directly (audyt-idee-2026-07-22, CLAUDE.md #7 catch).
  const isPl = i18n.language?.startsWith('pl');

  // K1/Airtable parity — row kebab (right-click on a row).
  const [rowMenu, setRowMenu] = useState<{ rowId: string; x: number; y: number } | null>(null);
  const [noteEditor, setNoteEditor] = useState<{
    rowId: string;
    fieldKey: string;
    value: string;
  } | null>(null);

  // "Dodaj notatkę" reuses the first non-computed long-text field as the note
  // target (falls back to a single-line text field); disabled with a note
  // when the table has no text field to hold one (Aneks #4 — never hidden).
  const noteField = useMemo(
    () =>
      platformFields.find((f) => f.fieldType === 'longText' && !f.isComputed) ??
      platformFields.find((f) => f.fieldType === 'singleLineText' && !f.isComputed),
    [platformFields]
  );

  const copyRowToClipboard = useCallback(
    (row: TableNode) => {
      const line = visibleColumns.map((c) => String(row.data?.[c.key] ?? '')).join('\t');
      void navigator.clipboard
        ?.writeText(line)
        .then(() => toast.success(isPl ? 'Skopiowano wiersz' : 'Row copied'))
        .catch(() => {});
    },
    [visibleColumns, isPl]
  );

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
    <tr
      key={row.id}
      className="hover:bg-c-surface-raised"
      onContextMenu={(e) => {
        e.preventDefault();
        if (locked) return;
        setRowMenu({ rowId: row.id, x: e.clientX, y: e.clientY });
      }}
    >
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
    <>
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
                  viewConfig?.missing_field_names?.[col.key] ??
                  col.header ??
                  t('ideas.table.viewRouter.unknown', 'Unknown');
                if (missing) {
                  return (
                    <th
                      key={col.key}
                      className="border-b border-r border-[color-mix(in_srgb,var(--c-warning)_35%,transparent)] bg-[color-mix(in_srgb,var(--c-warning)_12%,transparent)] text-c-warning text-xs px-3 py-2 font-semibold text-left whitespace-nowrap"
                    >
                      <div className="flex items-center gap-1.5">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        <span className="min-w-0 truncate">
                          {t('ideas.table.viewRouter.missingField', '[Missing: {{name}}]', {
                            name: missingFieldName,
                          })}
                        </span>
                        <button
                          type="button"
                          onClick={() => onRemoveMissingField?.(col.key)}
                          className="ml-auto shrink-0 text-c-warning hover:brightness-110"
                          title={t('ideas.table.viewRouter.removeFromView', 'Remove from view')}
                          aria-label={t(
                            'ideas.table.viewRouter.removeFromView',
                            'Remove from view'
                          )}
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

      {/* K1/Airtable parity — row kebab (right-click menu). Kontrakt Aneks #4:
          brak handlera ⇒ pozycja disabled z dopiskiem, nigdy ukryta. */}
      {rowMenu && (
        <div className="fixed inset-0 z-[60]" onClick={() => setRowMenu(null)}>
          <div
            className="absolute bg-c-surface rounded-lg shadow-xl border border-c-border py-1 min-w-[180px]"
            style={{ left: rowMenu.x, top: rowMenu.y }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="w-full px-3 py-1.5 text-xs text-left hover:bg-c-surface-raised text-c-text-secondary"
              onClick={() => {
                const editableCol =
                  visibleColumns.find((c) => !platformFieldById.get(c.key)?.isComputed) ??
                  visibleColumns[0];
                if (editableCol) setEditingCellId(cellId(rowMenu.rowId, editableCol.key));
                setRowMenu(null);
              }}
            >
              {isPl ? 'Edytuj' : 'Edit'}
            </button>
            <button
              type="button"
              disabled={!noteField}
              className={`w-full px-3 py-1.5 text-xs text-left ${
                noteField
                  ? 'hover:bg-c-surface-raised text-c-text-secondary'
                  : 'text-c-text-muted cursor-not-allowed'
              }`}
              title={
                noteField
                  ? undefined
                  : isPl
                    ? 'Brak pola tekstowego w tej tabeli'
                    : 'No text field in this table'
              }
              onClick={() => {
                if (!noteField) return;
                const target = processedRows.find((r) => r.id === rowMenu.rowId);
                setNoteEditor({
                  rowId: rowMenu.rowId,
                  fieldKey: noteField.id,
                  value: String(target?.data?.[noteField.id] ?? ''),
                });
                setRowMenu(null);
              }}
            >
              {isPl ? 'Dodaj notatkę' : 'Add note'}
            </button>

            <div className="h-px bg-c-surface-raised my-1" />

            <button
              type="button"
              className="w-full px-3 py-1.5 text-xs text-left hover:bg-c-surface-raised text-c-text-secondary"
              onClick={() => {
                handleInsertRow(rowMenu.rowId, 'above');
                setRowMenu(null);
              }}
            >
              {isPl ? 'Wstaw wiersz nad' : 'Insert row above'}
            </button>
            <button
              type="button"
              className="w-full px-3 py-1.5 text-xs text-left hover:bg-c-surface-raised text-c-text-secondary"
              onClick={() => {
                handleInsertRow(rowMenu.rowId, 'below');
                setRowMenu(null);
              }}
            >
              {isPl ? 'Wstaw wiersz pod' : 'Insert row below'}
            </button>

            <div className="h-px bg-c-surface-raised my-1" />

            <button
              type="button"
              className="w-full px-3 py-1.5 text-xs text-left hover:bg-c-surface-raised text-c-text-secondary"
              onClick={() => {
                handleDuplicateRow(rowMenu.rowId);
                toast.success(isPl ? 'Zduplikowano wiersz' : 'Row duplicated');
                setRowMenu(null);
              }}
            >
              {isPl ? 'Duplikuj wiersz' : 'Duplicate row'}
            </button>
            <button
              type="button"
              className="w-full px-3 py-1.5 text-xs text-left hover:bg-c-surface-raised text-c-text-secondary"
              onClick={() => {
                const target = processedRows.find((r) => r.id === rowMenu.rowId);
                if (target) copyRowToClipboard(target);
                setRowMenu(null);
              }}
            >
              {isPl ? 'Kopiuj wiersz' : 'Copy row'}
            </button>

            <div className="h-px bg-c-surface-raised my-1" />

            <button
              type="button"
              disabled={!onExpandRecord}
              className={`w-full px-3 py-1.5 text-xs text-left ${
                onExpandRecord
                  ? 'hover:bg-c-surface-raised text-c-text-secondary'
                  : 'text-c-text-muted cursor-not-allowed'
              }`}
              title={
                onExpandRecord
                  ? undefined
                  : isPl
                    ? 'Panel szczegółów niedostępny'
                    : 'Record detail panel unavailable'
              }
              onClick={() => {
                onExpandRecord?.(rowMenu.rowId);
                setRowMenu(null);
              }}
            >
              {isPl ? 'Rozwiń rekord' : 'Expand record'}
            </button>

            <div className="h-px bg-c-surface-raised my-1" />

            <button
              type="button"
              className="w-full px-3 py-1.5 text-xs text-left hover:bg-[color-mix(in_srgb,var(--c-danger)_12%,transparent)] text-c-danger"
              onClick={() => {
                handleDeleteRow(rowMenu.rowId);
                toast.success(isPl ? 'Usunięto wiersz' : 'Row deleted');
                setRowMenu(null);
              }}
            >
              {isPl ? 'Usuń wiersz' : 'Delete row'}
            </button>
          </div>
        </div>
      )}

      {/* "Dodaj notatkę" — inline editor for the row's designated text field. */}
      {noteEditor && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-[color-mix(in_srgb,var(--c-text)_20%,transparent)]"
          onClick={() => setNoteEditor(null)}
        >
          <div
            className="bg-c-surface rounded-xl shadow-xl border border-c-border p-4 w-80"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-semibold mb-2 text-c-text">
              {isPl ? 'Notatka' : 'Note'}
            </h3>
            <textarea
              autoFocus
              value={noteEditor.value}
              onChange={(e) =>
                setNoteEditor((prev) => (prev ? { ...prev, value: e.target.value } : prev))
              }
              placeholder={isPl ? 'Dodaj notatkę...' : 'Add a note...'}
              className="w-full h-24 px-3 py-2 rounded-lg text-xs bg-c-surface-raised border border-c-border outline-none focus:ring-2 focus:ring-c-focus mb-3 resize-none"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setNoteEditor(null)}
                className="px-3 py-1.5 text-xs rounded-lg text-c-text-muted hover:bg-c-surface-raised"
              >
                {isPl ? 'Anuluj' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={() => {
                  handleFieldChange(noteEditor.rowId, noteEditor.fieldKey, noteEditor.value);
                  setNoteEditor(null);
                }}
                className="px-3 py-1.5 text-xs rounded-lg bg-navy-900 text-white hover:brightness-95 dark:bg-[#F4F7FB] dark:text-navy-900"
              >
                {isPl ? 'Zapisz' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// ── Empty state (delegated to shared EmptyStateView) ────────────────────────

// ── Main router ──────────────────────────────────────────────────────────────

export const ViewRouter: React.FC<ViewRouterProps> = ({ onCSVImport, onExpandRecord }) => {
  const { t, i18n } = useTranslation();
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
    handleDuplicateRow,
    handleDeleteRow,
    handleInsertRow,
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
              {t('ideas.table.viewRouter.noGroupingColumn', 'No grouping column')}
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
              {t('ideas.table.viewRouter.noColumns', 'No columns')}
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
    t,
  ]);

  const mobileLayoutItems: { id: ViewLayout; icon: typeof Table2; label: string }[] = [
    { id: 'table', icon: Table2, label: t('ideas.table.table', 'Table') },
    { id: 'kanban', icon: KanbanSquare, label: 'Kanban' },
    { id: 'timeline', icon: GanttChart, label: 'Timeline' },
    { id: 'calendar', icon: Calendar, label: t('ideas.table.calendar', 'Calendar') },
    { id: 'matrix', icon: LayoutGrid, label: 'Matrix' },
    { id: 'grid', icon: Grid3X3, label: t('ideas.table.gallery', 'Gallery') },
    { id: 'sticky', icon: StickyNote, label: t('ideas.table.viewRouter.notes', 'Notes') },
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
          formatRules={formatRules}
          platformFields={platformFields}
          handleDuplicateRow={handleDuplicateRow}
          handleDeleteRow={handleDeleteRow}
          handleInsertRow={handleInsertRow}
          onExpandRecord={onExpandRecord}
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
          <span>{t('ideas.table.view', 'View')}</span>
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
            {t('ideas.table.viewRouter.viewLayout', 'View layout')}
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
          {t('ideas.table.viewRouter.record', 'Record')}
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
          {t('ideas.table.viewRouter.filter', 'Filter')}
        </button>
        <button
          type="button"
          onClick={() => setMobileViewPickerOpen((o) => !o)}
          className={`flex min-h-[48px] min-w-[56px] flex-1 flex-col items-center justify-center gap-0.5 rounded-lg text-[10px] font-medium ${
            mobileViewPickerOpen ? 'text-c-accent' : 'text-c-text-secondary'
          }`}
        >
          <Layout className="h-5 w-5" />
          {t('ideas.table.view', 'View')}
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
