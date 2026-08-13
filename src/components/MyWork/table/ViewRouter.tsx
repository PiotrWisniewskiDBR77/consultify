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
  AlignJustify,
  Calendar,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Filter,
  GanttChart,
  Grid3X3,
  KanbanSquare,
  Layout,
  LayoutGrid,
  Maximize2,
  Minimize2,
  Plus,
  StickyNote,
  Table2,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { useDialogA11y } from '@/components/ui/primitives/useDialogA11y';
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
import { EmptyFilterStateView } from './EmptyFilterStateView';
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
import type { ColumnDef, FilterGroup, SortConfig, TableEdge, TableNode } from './tableTypes';
import { TimelineView } from './TimelineView';
import type { ViewLayout } from './useTableViews';
import ViewErrorBoundary from './ViewErrorBoundary';
import { buildDateColumnSeedPlan } from './ViewSetupEmptyState';
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

// Fala 7 — id prefix for the per-column "quick filter" rule under the header,
// kept distinct from ids the advanced FilterBuilder assigns (`${fieldId}-${operator}`)
// so both UIs can add rules for the same column without clobbering each other.
const QUICK_FILTER_PREFIX = 'quick-filter:';
const quickFilterRuleId = (colKey: string): string => `${QUICK_FILTER_PREFIX}${colKey}`;
const EMPTY_FILTER_GROUP: FilterGroup = { logic: 'and', rules: [] };

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
  /**
   * Fala 7 — sortowanie/filtr po kolumnie (parytet Airtable). Optional: the
   * client-side sort/filter machinery already lives in
   * `useTablePlatformIntegration`/`useTablePlatformViews` (single-column
   * `SortConfig`, `FilterGroup` with the shared `evaluateFilterRule`) and
   * flows into `processedRows` before it ever reaches this component — these
   * props just let the header UI drive that existing state. Optional so
   * existing dev-render harnesses that don't pass them keep compiling.
   */
  sort?: SortConfig | null;
  setSort?: (sort: SortConfig | null) => void;
  filters?: FilterGroup;
  setFilters?: (filters: FilterGroup) => void;
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
  sort = null,
  setSort,
  filters = EMPTY_FILTER_GROUP,
  setFilters,
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
  const noteEditorDialogRef = useRef<HTMLDivElement>(null);
  const noteEditorTextareaRef = useRef<HTMLTextAreaElement>(null);
  const closeNoteEditor = useCallback(() => setNoteEditor(null), []);
  useDialogA11y({
    open: !!noteEditor,
    onClose: closeNoteEditor,
    containerRef: noteEditorDialogRef,
    initialFocusRef: noteEditorTextareaRef,
  });

  // Fala 8 (parytet Airtable) — szerokości kolumn przez drag na uchwycie w
  // prawej krawędzi nagłówka. Trzymane per-sesję w stanie komponentu (bez
  // trwałego zapisu) — `useTablePlatformViews`/`ViewConfig` niosą kolejność i
  // widoczność kolumn, ale nie ich szerokość w px, więc nie ma dokąd tego
  // dopisać bez zmiany kontraktu widoku; patrz DOWODY zadania.
  const MIN_COL_WIDTH = 60;
  const [colWidths, setColWidths] = useState<Record<string, number>>({});
  const resizingRef = useRef<{ colKey: string; startX: number; startWidth: number } | null>(null);

  const beginColumnResize = useCallback(
    (colKey: string) => (e: React.MouseEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      const thEl = e.currentTarget.closest('th');
      const startWidth = thEl?.getBoundingClientRect().width ?? 150;
      resizingRef.current = { colKey, startX: e.clientX, startWidth };

      const onMouseMove = (ev: MouseEvent) => {
        const active = resizingRef.current;
        if (!active) return;
        const delta = ev.clientX - active.startX;
        const next = Math.max(MIN_COL_WIDTH, Math.round(active.startWidth + delta));
        setColWidths((prev) => ({ ...prev, [active.colKey]: next }));
      };
      const onMouseUp = () => {
        resizingRef.current = null;
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    },
    []
  );

  // Fala 8 (parytet Airtable) — gęstość wierszy: kompakt/normalny/luźny.
  // Zmienia tylko wysokość/padding komórek — czysto prezentacyjne, nie rusza
  // sortu/filtra/zaznaczania/kopiuj-wklej.
  type RowDensity = 'compact' | 'normal' | 'comfortable';
  const [density, setDensity] = useState<RowDensity>('normal');
  const densityCellMinH =
    density === 'compact'
      ? 'min-h-[24px]'
      : density === 'comfortable'
        ? 'min-h-[48px]'
        : 'min-h-[36px]';
  const densityRowPadY =
    density === 'compact' ? 'py-0.5' : density === 'comfortable' ? 'py-2' : 'py-1';

  // Fala 10 (parytet Airtable) — zwijanie/rozwijanie grup po grupowaniu.
  // Czysto prezentacyjne (per-sesję, bez trwałego zapisu): nie rusza
  // sortu/filtra/zaznaczania/paste/resize/gęstości. Domyślnie wszystkie
  // grupy rozwinięte (pusty zbiór).
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const toggleGroupCollapsed = useCallback((groupLabel: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupLabel)) next.delete(groupLabel);
      else next.add(groupLabel);
      return next;
    });
  }, []);

  // "Dodaj notatkę" reuses the first non-computed long-text field as the note
  // target (falls back to a single-line text field); disabled with a note
  // when the table has no text field to hold one (Aneks #4 — never hidden).
  const noteField = useMemo(
    () =>
      platformFields.find((f) => f.fieldType === 'longText' && !f.isComputed) ??
      platformFields.find((f) => f.fieldType === 'singleLineText' && !f.isComputed),
    [platformFields]
  );

  // Z16 — keyboard navigation (Airtable parity): roving tabindex over gridcells.
  // Only one cell is ever tabIndex=0; arrows/Tab move both the logical focus
  // state and the real DOM focus. `pendingDomFocusRef` distinguishes
  // programmatic navigation (must call .focus()) from the initial default
  // (must not steal page focus on mount/data refresh).
  const rowsInRenderOrder = useMemo<TableNode[]>(
    () =>
      groupedRows && Object.keys(groupedRows).length > 0
        ? Object.values(groupedRows).flat()
        : processedRows,
    [groupedRows, processedRows]
  );
  const flatRowIds = useMemo(() => rowsInRenderOrder.map((r) => r.id), [rowsInRenderOrder]);
  const rowById = useMemo(() => {
    const m = new Map<string, TableNode>();
    for (const r of rowsInRenderOrder) m.set(r.id, r);
    return m;
  }, [rowsInRenderOrder]);
  const colKeys = useMemo(() => visibleColumns.map((c) => c.key), [visibleColumns]);

  // Fala 7 — klik w nagłówek: cykl asc → desc → brak (natywna kolejność).
  // Sort stanu jest scentralizowany w useTablePlatformIntegration (SortConfig
  // pojedynczej kolumny) — to tylko UI trigger, patrz komentarz przy propsach.
  const handleHeaderSortClick = useCallback(
    (colKey: string) => {
      if (!setSort) return;
      if (!sort || sort.key !== colKey) {
        setSort({ key: colKey, direction: 'asc' });
      } else if (sort.direction === 'asc') {
        setSort({ key: colKey, direction: 'desc' });
      } else {
        setSort(null);
      }
    },
    [sort, setSort]
  );

  // Fala 7 — prosty filtr tekstowy "zawiera" pod nagłówkiem, per kolumna.
  // Pusty input = brak reguły dla tej kolumny (usuwa ją z FilterGroup zamiast
  // trzymać regułę z pustą wartością).
  const quickFilterValue = useCallback(
    (colKey: string): string => {
      const rule = filters.rules.find((r) => r.id === quickFilterRuleId(colKey));
      return typeof rule?.value === 'string' ? rule.value : '';
    },
    [filters]
  );

  const handleQuickFilterChange = useCallback(
    (colKey: string, value: string) => {
      if (!setFilters) return;
      const id = quickFilterRuleId(colKey);
      const rest = filters.rules.filter((r) => r.id !== id);
      const rules =
        value.trim().length > 0
          ? [...rest, { id, column: colKey, operator: 'contains' as const, value }]
          : rest;
      setFilters({ logic: filters.logic ?? 'and', rules });
    },
    [filters, setFilters]
  );

  const [focusedRowId, setFocusedRowId] = useState<string | null>(null);
  const [focusedColKey, setFocusedColKey] = useState<string | null>(null);
  const cellRefs = useRef(new Map<string, HTMLDivElement>());
  const pendingDomFocusRef = useRef(false);

  // Z16 follow-up: {anchor, focus} rectangle for multi-cell selection.
  // anchor = where the drag/shift-range started, focus = current end. A plain
  // (non-shift) move always collapses this to anchor===focus (single cell).
  type CellCoord = { rowId: string; colKey: string };
  const [selRange, setSelRange] = useState<{ anchor: CellCoord; focus: CellCoord } | null>(null);

  // Default focus target: first cell, or re-clamp when the previously
  // focused row/column disappears (row deleted, column hidden, ...).
  useEffect(() => {
    if (flatRowIds.length === 0 || colKeys.length === 0) return;
    setFocusedRowId((prev) => (prev && flatRowIds.includes(prev) ? prev : flatRowIds[0]));
    setFocusedColKey((prev) => (prev && colKeys.includes(prev) ? prev : colKeys[0]));
  }, [flatRowIds, colKeys]);

  useEffect(() => {
    if (!focusedRowId || !focusedColKey || !pendingDomFocusRef.current) return;
    pendingDomFocusRef.current = false;
    cellRefs.current.get(cellId(focusedRowId, focusedColKey))?.focus();
  }, [focusedRowId, focusedColKey]);

  const focusCell = useCallback((rowId: string, colKey: string, moveDom?: boolean) => {
    if (moveDom) pendingDomFocusRef.current = true;
    setFocusedRowId(rowId);
    setFocusedColKey(colKey);
    // Any plain (non-extending) focus move collapses a prior range selection —
    // Airtable parity: arrows/click/tab/enter always narrow back to one cell.
    setSelRange({ anchor: { rowId, colKey }, focus: { rowId, colKey } });
  }, []);

  // Shift+arrow: extend the selection rectangle from the existing anchor
  // (or the currently focused cell, if no range is active yet) to the new
  // clamped focus cell. Does not enter edit mode.
  const extendSelection = useCallback(
    (dRow: number, dCol: number) => {
      if (!focusedRowId || !focusedColKey) return;
      const ri = flatRowIds.indexOf(focusedRowId);
      const ci = colKeys.indexOf(focusedColKey);
      if (ri < 0 || ci < 0) return;
      const nri = Math.min(Math.max(ri + dRow, 0), flatRowIds.length - 1);
      const nci = Math.min(Math.max(ci + dCol, 0), colKeys.length - 1);
      const newFocus: CellCoord = { rowId: flatRowIds[nri], colKey: colKeys[nci] };
      setSelRange((prev) => ({
        anchor: prev?.anchor ?? { rowId: focusedRowId, colKey: focusedColKey },
        focus: newFocus,
      }));
      pendingDomFocusRef.current = true;
      setFocusedRowId(newFocus.rowId);
      setFocusedColKey(newFocus.colKey);
    },
    [focusedRowId, focusedColKey, flatRowIds, colKeys]
  );

  // Shift+click: same rectangle extension, from mouse input. Handled on
  // mousedown (with preventDefault) so the native focus event that would
  // otherwise fire first doesn't collapse the range via focusCell.
  const extendSelectionTo = useCallback(
    (rowId: string, colKey: string) => {
      setSelRange((prev) => ({
        anchor:
          prev?.anchor ??
          (focusedRowId && focusedColKey
            ? { rowId: focusedRowId, colKey: focusedColKey }
            : { rowId, colKey }),
        focus: { rowId, colKey },
      }));
      pendingDomFocusRef.current = true;
      setFocusedRowId(rowId);
      setFocusedColKey(colKey);
    },
    [focusedRowId, focusedColKey]
  );

  // Rectangle bounds (row/col index range) for the active selection — null
  // when there's no range or it's a single cell (focus ring already covers
  // that case, no extra background needed).
  const rangeBounds = useMemo(() => {
    if (!selRange) return null;
    const anchorRi = flatRowIds.indexOf(selRange.anchor.rowId);
    const anchorCi = colKeys.indexOf(selRange.anchor.colKey);
    const focusRi = flatRowIds.indexOf(selRange.focus.rowId);
    const focusCi = colKeys.indexOf(selRange.focus.colKey);
    if (anchorRi < 0 || anchorCi < 0 || focusRi < 0 || focusCi < 0) return null;
    const minRi = Math.min(anchorRi, focusRi);
    const maxRi = Math.max(anchorRi, focusRi);
    const minCi = Math.min(anchorCi, focusCi);
    const maxCi = Math.max(anchorCi, focusCi);
    if (minRi === maxRi && minCi === maxCi) return null;
    return { minRi, maxRi, minCi, maxCi };
  }, [selRange, flatRowIds, colKeys]);

  // Set of `cellId` strings inside the rectangle — built once per range
  // change, sized to the range (not the whole grid), so per-cell lookup in
  // renderCell stays O(1).
  const rangeCellIds = useMemo(() => {
    if (!rangeBounds) return null;
    const ids = new Set<string>();
    for (let r = rangeBounds.minRi; r <= rangeBounds.maxRi; r++) {
      const rid = flatRowIds[r];
      for (let c = rangeBounds.minCi; c <= rangeBounds.maxCi; c++) {
        ids.add(cellId(rid, colKeys[c]));
      }
    }
    return ids;
  }, [rangeBounds, flatRowIds, colKeys]);

  const moveFocus = useCallback(
    (dRow: number, dCol: number) => {
      if (!focusedRowId || !focusedColKey) return;
      const ri = flatRowIds.indexOf(focusedRowId);
      const ci = colKeys.indexOf(focusedColKey);
      if (ri < 0 || ci < 0) return;
      const nri = Math.min(Math.max(ri + dRow, 0), flatRowIds.length - 1);
      const nci = Math.min(Math.max(ci + dCol, 0), colKeys.length - 1);
      focusCell(flatRowIds[nri], colKeys[nci], true);
    },
    [focusedRowId, focusedColKey, flatRowIds, colKeys, focusCell]
  );

  const moveFocusTab = useCallback(
    (forward: boolean) => {
      if (!focusedRowId || !focusedColKey) return;
      const ri = flatRowIds.indexOf(focusedRowId);
      const ci = colKeys.indexOf(focusedColKey);
      if (ri < 0 || ci < 0) return;
      let nri = ri;
      let nci = ci + (forward ? 1 : -1);
      if (nci >= colKeys.length) {
        nci = 0;
        nri = Math.min(ri + 1, flatRowIds.length - 1);
      } else if (nci < 0) {
        nci = colKeys.length - 1;
        nri = Math.max(ri - 1, 0);
      }
      focusCell(flatRowIds[nri], colKeys[nci], true);
    },
    [focusedRowId, focusedColKey, flatRowIds, colKeys, focusCell]
  );

  // Ctrl/Cmd+C on a focused (non-editing) cell — copies its raw value.
  const copyCellValue = useCallback(
    (rowId: string, colKey: string) => {
      const row = rowById.get(rowId);
      const text = String(row?.data?.[colKey] ?? '');
      void navigator.clipboard
        ?.writeText(text)
        .then(() => toast.success(isPl ? 'Skopiowano komórkę' : 'Cell copied'))
        .catch(() => {});
    },
    [rowById, isPl]
  );

  // Ctrl/Cmd+C dispatcher: when a multi-cell range is active, copy the whole
  // rectangle as TSV (rows \n, columns \t), walking flatRowIds/colKeys in
  // grid render order — reuses rowById + rangeBounds, no new row ordering.
  // Falls back to single-cell copy otherwise (unchanged prior behaviour).
  const copySelectionOrCell = useCallback(
    (rowId: string, colKey: string) => {
      if (rangeBounds) {
        const cols = colKeys.slice(rangeBounds.minCi, rangeBounds.maxCi + 1);
        const tsv = flatRowIds
          .slice(rangeBounds.minRi, rangeBounds.maxRi + 1)
          .map((rid) => {
            const r = rowById.get(rid);
            return cols.map((ck) => String(r?.data?.[ck] ?? '')).join('\t');
          })
          .join('\n');
        void navigator.clipboard
          ?.writeText(tsv)
          .then(() => toast.success(isPl ? 'Skopiowano zakres' : 'Range copied'))
          .catch(() => {});
        return;
      }
      copyCellValue(rowId, colKey);
    },
    [rangeBounds, flatRowIds, colKeys, rowById, isPl, copyCellValue]
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

  // Z16b follow-up: Ctrl/Cmd+V mirrors copySelectionOrCell's TSV shape —
  // rows split on \n, columns on \t. Pastes from the focused (anchor) cell
  // down/right, writing through the same handleFieldChange path a single
  // cell edit uses (CellEditor's onSave, line ~410). Never grows the grid —
  // any cell the pasted rectangle would land outside of, or that maps to a
  // computed field, is skipped and counted (logged via console.debug, not
  // surfaced as an error toast — parity with copy's silent .catch()).
  // A clipboard payload with no \t/\n (a single value) instead fills the
  // whole active rangeBounds rectangle, spreadsheet-style; with no active
  // range it just writes the one focused cell.
  const pasteFromClipboard = useCallback(
    (rowId: string, colKey: string) => {
      if (locked) return;
      void navigator.clipboard
        ?.readText()
        .then((text) => {
          if (!text) return;
          const rawRows = text.replace(/\r\n/g, '\n').split('\n');
          // Drop one trailing empty row from a clipboard payload that ends
          // in a newline (common with copies out of spreadsheet apps).
          if (rawRows.length > 1 && rawRows[rawRows.length - 1] === '') rawRows.pop();
          const grid = rawRows.map((r) => r.split('\t'));

          const anchorRi = flatRowIds.indexOf(rowId);
          const anchorCi = colKeys.indexOf(colKey);
          if (anchorRi < 0 || anchorCi < 0) return;

          const isSingleValue = grid.length === 1 && grid[0].length === 1;
          let written = 0;
          let skipped = 0;

          const writeCell = (ri: number, ci: number, value: string) => {
            if (ri >= flatRowIds.length || ci >= colKeys.length) {
              skipped++;
              return;
            }
            const targetColKey = colKeys[ci];
            const pf = platformFieldById.get(targetColKey);
            if (pf?.isComputed) {
              skipped++;
              return;
            }
            handleFieldChange(flatRowIds[ri], targetColKey, value);
            written++;
          };

          if (isSingleValue && rangeBounds) {
            const value = grid[0][0];
            for (let ri = rangeBounds.minRi; ri <= rangeBounds.maxRi; ri++) {
              for (let ci = rangeBounds.minCi; ci <= rangeBounds.maxCi; ci++) {
                writeCell(ri, ci, value);
              }
            }
          } else {
            grid.forEach((rowValues, rOffset) => {
              rowValues.forEach((value, cOffset) => {
                writeCell(anchorRi + rOffset, anchorCi + cOffset, value);
              });
            });
          }

          if (skipped > 0) {
            console.debug(
              `[table-paste] pominięto ${skipped} komórek — poza siatką lub pole obliczane (nie tworzę nowych wierszy/kolumn)`
            );
          }
          if (written > 0) {
            toast.success(isPl ? 'Wklejono' : 'Pasted');
          }
        })
        .catch(() => {});
    },
    [locked, flatRowIds, colKeys, platformFieldById, handleFieldChange, rangeBounds, isPl]
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
              // Airtable parity: Enter-to-save moves focus one cell down;
              // on the last row it just re-focuses the cell it left.
              const ri = flatRowIds.indexOf(row.id);
              const nextRowId = ri >= 0 && ri < flatRowIds.length - 1 ? flatRowIds[ri + 1] : row.id;
              focusCell(nextRowId, col.key, true);
            }}
            onCancel={() => {
              setEditingCellId(null);
              focusCell(row.id, col.key, true);
            }}
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

    const isFocused = focusedRowId === row.id && focusedColKey === col.key;
    const inRange = !!rangeCellIds?.has(id);

    return (
      <div
        ref={(el) => {
          if (el) cellRefs.current.set(id, el);
          else cellRefs.current.delete(id);
        }}
        role="gridcell"
        tabIndex={isFocused ? 0 : -1}
        className={`min-w-0 ${densityCellMinH} flex items-stretch outline-none focus-visible:ring-1 focus-visible:ring-c-focus cursor-text ${
          isFocused ? 'ring-1 ring-c-focus' : ''
        } ${inRange ? 'bg-c-info/10' : ''}`}
        onFocus={() => focusCell(row.id, col.key)}
        onMouseDown={(e) => {
          // Shift+click extends the range like shift+arrow; prevent the
          // element's native focus (which would otherwise fire onFocus and
          // collapse the range back to one cell before we can extend it).
          if (e.shiftKey) {
            e.preventDefault();
            extendSelectionTo(row.id, col.key);
          }
        }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          if (locked || pf?.isComputed) return;
          setEditingCellId(id);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            if (!locked && !pf?.isComputed) setEditingCellId(id);
            return;
          }
          if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
            e.preventDefault();
            copySelectionOrCell(row.id, col.key);
            return;
          }
          if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
            e.preventDefault();
            pasteFromClipboard(row.id, col.key);
            return;
          }
          switch (e.key) {
            case 'ArrowUp':
              e.preventDefault();
              if (e.shiftKey) extendSelection(-1, 0);
              else moveFocus(-1, 0);
              break;
            case 'ArrowDown':
              e.preventDefault();
              if (e.shiftKey) extendSelection(1, 0);
              else moveFocus(1, 0);
              break;
            case 'ArrowLeft':
              e.preventDefault();
              if (e.shiftKey) extendSelection(0, -1);
              else moveFocus(0, -1);
              break;
            case 'ArrowRight':
              e.preventDefault();
              if (e.shiftKey) extendSelection(0, 1);
              else moveFocus(0, 1);
              break;
            case 'Tab':
              e.preventDefault();
              moveFocusTab(!e.shiftKey);
              break;
            default:
              break;
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
      <td
        className={`w-10 border-b border-r border-c-border-subtle px-1 ${densityRowPadY} align-middle text-center`}
      >
        <input
          type="checkbox"
          className="rounded border-c-border-subtle"
          checked={selectedRowIds.has(row.id)}
          disabled={locked}
          onChange={() => toggleRowSelection(row.id)}
          aria-label={t('myWorkTable.gridView.selectRow', 'Select row')}
        />
      </td>
      {visibleColumns.map((col) => {
        const missing = isMissingField(col.key, viewConfig);
        // R5: conditional formatting — only on real (non-missing) cells.
        const cfStyle = missing
          ? undefined
          : getConditionalStyle(formatRules, col.key, row.data?.[col.key]);
        const customWidth = colWidths[col.key];
        const widthStyle: React.CSSProperties | undefined = customWidth
          ? { width: customWidth, minWidth: customWidth, maxWidth: customWidth }
          : undefined;
        return (
          <td
            key={col.key}
            style={{ ...cfStyle, ...widthStyle }}
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
      ? Object.entries(groupedRows).map(([groupLabel, rows]) => {
          const isCollapsed = collapsedGroups.has(groupLabel);
          return (
            <React.Fragment key={groupLabel}>
              <tr className="bg-c-surface-raised">
                <td
                  colSpan={visibleColumns.length + 1}
                  className="p-0 border-b border-c-border-subtle"
                >
                  <button
                    type="button"
                    onClick={() => toggleGroupCollapsed(groupLabel)}
                    aria-expanded={!isCollapsed}
                    className="w-full flex items-center gap-1.5 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-c-text-muted hover:text-c-text transition-colors outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                  >
                    {isCollapsed ? (
                      <ChevronRight className="h-3 w-3 shrink-0" aria-hidden />
                    ) : (
                      <ChevronDown className="h-3 w-3 shrink-0" aria-hidden />
                    )}
                    <span>
                      {groupLabel} · {rows.length}
                    </span>
                  </button>
                </td>
              </tr>
              {!isCollapsed && rows.map((row) => renderRow(row))}
            </React.Fragment>
          );
        })
      : processedRows.map((row) => renderRow(row));

  const densityOptions: { id: RowDensity; icon: typeof Minimize2; label: string }[] = [
    {
      id: 'compact',
      icon: Minimize2,
      label: t('ideas.table.viewRouter.densityCompact', 'Kompakt'),
    },
    {
      id: 'normal',
      icon: AlignJustify,
      label: t('ideas.table.viewRouter.densityNormal', 'Normalny'),
    },
    {
      id: 'comfortable',
      icon: Maximize2,
      label: t('ideas.table.viewRouter.densityComfortable', 'Luźny'),
    },
  ];

  return (
    <>
      {/* Fala 8 (parytet Airtable) — przełącznik gęstości wierszy: kompakt/
          normalny/luźny. Czysto prezentacyjne, domyślnie normalny. */}
      <div className="flex items-center justify-end gap-1.5 px-0.5 pb-1">
        <span className="text-[10px] text-c-text-muted">
          {t('ideas.table.viewRouter.rowDensity', 'Gęstość wierszy')}
        </span>
        <div className="inline-flex items-center gap-0.5 rounded-lg border border-c-border-subtle bg-c-surface p-0.5">
          {densityOptions.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setDensity(id)}
              title={label}
              aria-label={label}
              aria-pressed={density === id}
              className={`flex h-6 w-6 items-center justify-center rounded outline-none focus-visible:ring-2 focus-visible:ring-c-focus ${
                density === id
                  ? 'bg-c-surface-raised text-c-text'
                  : 'text-c-text-muted hover:text-c-text-secondary'
              }`}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden />
            </button>
          ))}
        </div>
      </div>
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
                const activeSortDir = sort?.key === col.key ? sort.direction : null;
                const filterValue = quickFilterValue(col.key);
                const customWidth = colWidths[col.key];
                const widthStyle: React.CSSProperties | undefined = customWidth
                  ? { width: customWidth, minWidth: customWidth, maxWidth: customWidth }
                  : undefined;
                return (
                  <th
                    key={col.key}
                    style={widthStyle}
                    className="relative border-b border-r border-c-border-subtle px-2 py-1.5 align-top font-semibold text-c-text-secondary whitespace-nowrap"
                  >
                    <button
                      type="button"
                      onClick={() => handleHeaderSortClick(col.key)}
                      title={t('ideas.table.viewRouter.sortColumn', 'Sortuj wg {{name}}', {
                        name: col.header,
                      })}
                      className="flex w-full items-center gap-1 rounded px-0.5 py-0.5 text-left outline-none hover:text-c-text focus-visible:ring-2 focus-visible:ring-c-focus"
                    >
                      <span className="truncate">{col.header}</span>
                      {activeSortDir === 'asc' && (
                        <ChevronUp className="h-3 w-3 shrink-0 text-c-text-muted" aria-hidden />
                      )}
                      {activeSortDir === 'desc' && (
                        <ChevronDown className="h-3 w-3 shrink-0 text-c-text-muted" aria-hidden />
                      )}
                    </button>
                    <input
                      type="text"
                      value={filterValue}
                      onChange={(e) => handleQuickFilterChange(col.key, e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      placeholder={t('ideas.table.viewRouter.filterColumn', 'Filtruj…')}
                      aria-label={`${t('ideas.table.viewRouter.filterColumnAria', 'Filtruj wg')} ${col.header}`}
                      className="mt-1 w-full rounded border border-c-border-subtle bg-c-surface px-1.5 py-0.5 text-[10px] font-normal normal-case tracking-normal text-c-text outline-none placeholder:text-c-text-muted focus-visible:ring-2 focus-visible:ring-c-focus"
                    />
                    {/* Fala 8 — uchwyt zmiany szerokości kolumny (drag, min 60px). */}
                    <div
                      role="separator"
                      aria-orientation="vertical"
                      aria-label={t(
                        'ideas.table.viewRouter.resizeColumn',
                        'Zmień szerokość kolumny'
                      )}
                      onMouseDown={beginColumnResize(col.key)}
                      className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize select-none hover:bg-c-info/40 active:bg-c-info/60"
                    />
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
          onClick={closeNoteEditor}
        >
          <div
            ref={noteEditorDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="note-editor-dialog-title"
            tabIndex={-1}
            className="bg-c-surface rounded-xl shadow-xl border border-c-border p-4 w-80 outline-none"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="note-editor-dialog-title" className="text-sm font-semibold mb-2 text-c-text">
              {isPl ? 'Notatka' : 'Note'}
            </h3>
            <textarea
              ref={noteEditorTextareaRef}
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
    handleAddColumn,
    toggleColumn,
    handleDuplicateRow,
    handleDeleteRow,
    handleInsertRow,
    selectedRowIds,
    toggleRowSelection,
    sort,
    setSort,
    filters,
    setFilters,
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

  // ── Puste stany widoków zależnych od dat: realne wyjścia ─────────────────
  // Timeline/Kalendarz bez kolumny typu `date` potrafiły tylko opisać brak.
  // Te trzy callbacki zamieniają opis w akcję (incydent właściciela 07-27).
  const handleAddDateColumnForView = useCallback(() => {
    if (locked) return;
    const plan = buildDateColumnSeedPlan({
      existingKeys: columns.map((c) => c.key),
      rowIds: processedRows.map((r) => r.id),
      // Adapter: `TFunction` i18nexta ma przeciążenia, których nie da się
      // przypisać wprost do wąskiego `(key, fallback?) => string`.
      // `IdeaTableTool` ma własny `t` o tym kształcie i dlatego nie wymaga adaptera.
      t: (key: string, fallback?: string) => (fallback === undefined ? t(key) : t(key, fallback)),
    });
    for (const col of plan.columns) handleAddColumn(col as unknown as ColumnDef);
    for (const v of plan.values) handleFieldChange(v.rowId, v.key, v.value);
  }, [columns, handleAddColumn, handleFieldChange, locked, processedRows, t]);

  const handleShowDateColumnForView = useCallback(
    (columnKey: string) => toggleColumn(columnKey),
    [toggleColumn]
  );

  const handleBackToTableView = useCallback(() => setViewLayout('table'), [setViewLayout]);

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
            onAddDateColumn={handleAddDateColumnForView}
            onBackToTable={handleBackToTableView}
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
            onAddDateColumn={handleAddDateColumnForView}
            onShowDateColumn={handleShowDateColumnForView}
            onBackToTable={handleBackToTableView}
            onAddRow={handleAddRow}
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
    handleAddDateColumnForView,
    handleShowDateColumnForView,
    handleBackToTableView,
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

  // Fala 8 (parytet Airtable) — "0 wyników" ma dwie zupełnie różne przyczyny:
  // (a) tabela naprawdę jest pusta → "Dodaj pierwszy rekord" ma sens; (b) są
  // rekordy (`nodes.length > 0`) albo aktywne filtry, a mimo to wynik po
  // filtrze/grupowaniu to zero → "Dodaj rekord" jest mylące, bo rekordy już
  // istnieją, tylko filtr je ukrywa. Rozróżniamy po źródle (`nodes`), nie po
  // samym `processedRows`, żeby złapać też przypadek pustego filtra z pustym
  // inputem, ale niezerowym `nodes`.
  const hasActiveFilters = (filters?.rules?.length ?? 0) > 0;
  const isEmptyDueToFilter = processedRows.length === 0 && (hasActiveFilters || nodes.length > 0);
  const clearAllFilters = useCallback(() => {
    setFilters?.({ logic: filters?.logic ?? 'and', rules: [] });
  }, [setFilters, filters?.logic]);

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
    ) : isEmptyDueToFilter ? (
      <ViewErrorBoundary viewName={viewLayout} onSwitchToGrid={switchToGrid} locale={i18n.language}>
        <EmptyFilterStateView onClearFilters={clearAllFilters} />
      </ViewErrorBoundary>
    ) : processedRows.length === 0 ? (
      <ViewErrorBoundary viewName={viewLayout} onSwitchToGrid={switchToGrid} locale={i18n.language}>
        <EmptyStateView
          viewType={viewLayout}
          onAddRow={handleAddRow}
          onImportCSV={() => csvInputRef.current?.click()}
          onUseAI={() => uiDispatch({ type: 'TOGGLE_PANEL', panel: 'showChatToSchema' })}
          onAddField={
            locked
              ? undefined
              : () => uiDispatch({ type: 'SET_PANEL', panel: 'showAddColumn', value: true })
          }
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
          sort={sort}
          setSort={setSort}
          filters={filters}
          setFilters={setFilters}
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
              <span className="text-c-text truncate max-w-[140px]" title={activeViewName}>
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
                      ? 'border-c-border bg-c-surface-raised text-c-text'
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
          <Plus className="h-5 w-5 text-c-text-secondary" />
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
            mobileViewPickerOpen ? 'text-c-text' : 'text-c-text-secondary'
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
