/**
 * FilterableTable
 * Table with filterable column headers and row actions
 */

import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  Columns,
  Copy,
  Edit,
  Eye,
  Maximize2,
  Trash2,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { type ColumnConfig, ColumnSelector } from '@/components/Admin/shared/ColumnSelector';
import { EntityStatusChip } from '@/components/ui/primitives/chips';

import { type RowAction, type RowActionSection, RowActionsMenu } from '../RowActionsMenu';
import { FilterChip } from './ActiveFilters';
import { TableSettingsPopover } from './TableSettingsPopover';

// Column definition
export interface TableColumn {
  id: string;
  label: string;
  width?: string;
  /**
   * Opt-in leading selection column. When set to 'select', the HEADER renders a
   * select-all checkbox (driven by the `selection` prop) instead of the plain
   * `label` text, and the filter/resizer affordances are suppressed for it.
   * Existing tables that don't set this are completely unaffected.
   */
  type?: 'select';
  filterable?: boolean;
  filterOptions?: { value: string; label: string; color?: string }[];
  sortable?: boolean;
  /**
   * Optional accessor used for sorting (Triada standard). Defaults to
   * `row[column.id]`. Return a string / number / Date-parsable value.
   */
  sortAccessor?: (row: any) => unknown;
  /**
   * Canon §3.3 cell alignment by role: title/text = left (default),
   * counts/metrics = right, rare centered badges = center. Applied to both
   * the header cell and body cells so header and data never desync.
   */
  align?: 'left' | 'center' | 'right';
  render?: (row: any) => React.ReactNode;
}

// Canon §3.3 — map column.align to a Tailwind text-align utility (left = default).
const alignToClass = (align?: TableColumn['align']): string =>
  align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';

// Row data
export interface TableRow {
  id: string;
  [key: string]: any;
}

interface FilterableTableProps {
  columns: TableColumn[];
  data: TableRow[];
  /** Optional: highlight a selected row (for Table+Preview layouts). */
  selectedRowId?: string | null;
  onRowClick?: (row: TableRow) => void;
  onRowDoubleClick?: (row: TableRow) => void;
  onRowAction?: (action: string, row: TableRow) => void;
  /** Optional: override the row actions menu contents. */
  getRowActions?: (row: TableRow) => RowAction[];
  /**
   * Triada standard: LONG contextual kebab as SECTIONS (status actions on top,
   * Delete at the bottom — wzór: menu Decisions). Takes precedence over
   * `getRowActions` when provided.
   */
  getRowActionSections?: (row: TableRow) => RowActionSection[];
  /** Optional: hide the row actions menu column. */
  hideRowActions?: boolean;
  activeFilters: FilterChip[];
  onFilterChange: (filters: FilterChip[]) => void;
  /**
   * R04-2C: `ReactNode`, nie `string` — fasada `StandardTable` przekazuje tu
   * bogaty stan pusty (ikona + tytuł + opis + CTA). Wcześniej typ `string`
   * zmuszał ją do renderowania `EmptyState` ZAMIAST tabeli, przez co nagłówek
   * i geometria znikały — wprost wbrew §5 („empty state zachowuje nagłówek
   * i geometrię tabeli"). Zwykły string nadal działa bez zmian.
   */
  emptyMessage?: React.ReactNode;
  /**
   * Komunikat dla stanu „filtry nie dały wyniku" (§5 Stany). Odrębny od
   * `emptyMessage`, który opisuje brak danych w ogóle. Opcjonalny — bez niego
   * używany jest kanoniczny fallback i przycisk resetu filtrów.
   */
  emptyFilteredMessage?: React.ReactNode;
  /** Outer padding of the table canvas (not the surface). */
  canvasClassName?: string;
  /** Controls row/header density. */
  density?: 'comfortable' | 'compact';
  /** Show the table header settings (columns) button. */
  enableColumnSettings?: boolean;
  /**
   * Opt-in localStorage persistence of column widths + visibility/order. When
   * set, resizing / hiding / reordering columns survives reload. Default off,
   * so existing callers are unaffected. (V-B — the canonical fix for the
   * module-wide "resize lost on reload" bug; one place instead of per-table.)
   */
  persistKey?: string;
  /**
   * Opt-in row selection. Drives the leading `type: 'select'` column: the header
   * renders a select-all checkbox (indeterminate when partial) and each row
   * renders a row checkbox. Omit to leave existing tables unaffected (canon §3.5).
   */
  selection?: {
    selectedIds: Set<string> | string[];
    onToggleRow: (id: string) => void;
    onToggleAll: () => void;
    isAllSelected: boolean;
    isIndeterminate: boolean;
    selectRowLabel?: string;
    selectAllLabel?: string;
  };
  /** Initial sort applied when columns declare `sortable` (Triada standard). */
  defaultSort?: { columnId: string; direction: 'asc' | 'desc' } | null;
  /**
   * Triada standard: optional per-row description line rendered under the
   * primary (first data) column, toggled via the canonical Settings2 →
   * TableSettingsPopover ("Show row description"). Providing this prop also
   * switches the column settings trigger from the legacy ColumnSelector to
   * TableSettingsPopover.
   */
  rowDescription?: {
    render: (row: TableRow) => React.ReactNode;
    show: boolean;
    onToggle: (value: boolean) => void;
    label?: string;
    columnsHeading?: string;
    settingsLabel?: string;
  };
  /**
   * Opt-in extra class(es) appended to a row's `<tr>` — e.g. group-header
   * styling for grouped-rows layouts (Inbox). Purely additive: the base
   * selected/hover classes are always applied first, this is appended after.
   * Omit for zero visual change (default undefined → no-op).
   */
  rowClassName?: string | ((row: TableRow) => string);
  /**
   * ── Minimalna szerokość elementu `table` (opt-in) ─────────────────────────
   *
   * (W komentarzach tego pliku NIE piszemy znacznika `table` w ostrych
   * nawiasach — `scripts/check-list-canon.sh` szuka go tekstowo i uznałby
   * wzmiankę w prozie za drugą, nieoznaczoną tabelę, przez co znacznik
   * §27-exempt przestałby obejmować `thead`/`tbody` niżej.)
   *
   * Do tej pory element `table` miał ZAHARDKODOWANE `min-width: 980px` bez żadnego
   * wyjścia. Na telefonie (kontener ~244 px przy oknie 320 px) oznaczało to
   * 736 px poziomego przewijania UKRYTEGO wewnątrz `overflow-x-auto` — metryka
   * strony zostawała czysta (`documentElement.scrollWidth === innerWidth`),
   * a treść wiersza i tak była ucięta. Moduł, który świadomie deklaruje na
   * wąskim ekranie JEDNĄ kolumnę, nie miał jak tego wyłączyć.
   *
   * Prop jest ADDYTYWNY. Domyślna wartość odtwarza dotychczasowe 980 px
   * co do piksela, więc ~100 istniejących list (My Work, Audits, Interview,
   * Initiatives, Execution, Results, Finance, Materiały, Meeting, Admin…)
   * zachowuje się identycznie jak przed zmianą.
   *
   *  · `number`    → dokładnie ta wartość w px (domyślnie `DEFAULT_MIN_TABLE_WIDTH`),
   *  · `'auto'`    → BEZ `min-width`; tabela zwęża się do kontenera,
   *  · `'columns'` → wariant wyliczany: gdy widocznych kolumn danych jest
   *                  ≤ `AUTO_MIN_WIDTH_COLUMN_THRESHOLD`, `min-width` znika;
   *                  powyżej — wraca `DEFAULT_MIN_TABLE_WIDTH`. Kolumna
   *                  zaznaczenia (`type: 'select'`) i strukturalna kolumna
   *                  akcji NIE liczą się jako kolumny danych.
   */
  minTableWidth?: number | 'auto' | 'columns';
}

/**
 * Dotychczasowa, zahardkodowana wartość — teraz jawna domyślka propa
 * `minTableWidth`. Zmiana tej stałej zmienia KAŻDĄ listę w produkcie.
 */
export const DEFAULT_MIN_TABLE_WIDTH = 980;

/**
 * Próg dla `minTableWidth="columns"`: przy jednej lub dwóch kolumnach danych
 * wymuszanie 980 px nie daje nic poza ukrytym przewijaniem.
 */
export const AUTO_MIN_WIDTH_COLUMN_THRESHOLD = 2;

// True when a regular cell value should render as an em-dash placeholder
// (null / undefined / empty-or-whitespace string).
const isEmptyCell = (value: unknown): boolean =>
  value === null || value === undefined || (typeof value === 'string' && value.trim() === '');

// Progress bar component
// Per Table+Preview canon §4.0/§4.3: progress is NEVER red/crimson. Generic
// progress uses an info/neutral fill while in-progress and transitions to
// success (HBS green) at 100%. `warning` (amber) is reserved for modules that
// explicitly compute an at-risk state — this shared component does not.
const ProgressBar: React.FC<{ progress: number }> = ({ progress }) => (
  <div className="flex items-center gap-2">
    <div className="flex-1 h-1.5 bg-c-border-subtle rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all ${
          progress === 100 ? 'bg-c-success' : 'bg-c-info'
        }`}
        style={{ width: `${progress}%` }}
      />
    </div>
    <span className="text-xs text-slate-500 dark:text-slate-400 w-8">{progress}%</span>
  </div>
);

// Filter dropdown component
const FilterDropdown: React.FC<{
  column: TableColumn;
  activeValues: string[];
  onApply: (values: string[]) => void;
}> = ({ column, activeValues, onApply }) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>(activeValues);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const handleToggle = (value: string) => {
    setSelected((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  };

  const handleApply = () => {
    onApply(selected);
    setIsOpen(false);
  };

  const handleClear = () => {
    setSelected([]);
    onApply([]);
    setIsOpen(false);
  };

  const closeAndReturnFocus = useCallback(() => {
    setIsOpen(false);
    triggerRef.current?.focus();
  }, []);

  // A11y (RV-009/RB decision #4, CODEX pass 2): this is a non-modal
  // disclosure popover, NOT a dialog — it must never trap Tab. Escape closes
  // it and returns focus to the trigger; Tab is left completely alone so it
  // moves focus in the normal document order (which, once it leaves the
  // panel, closes the popover via the blur handler below instead of leaving
  // a stale open panel with focus elsewhere on the page).
  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        closeAndReturnFocus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, closeAndReturnFocus]);

  // Closing on blur-out (Tab leaving the panel) — focus is left wherever the
  // browser's normal Tab order sends it; only the popover's open state is
  // cleared, so this never fights the trigger's Escape/click focus-return.
  const handlePanelBlur = useCallback((event: React.FocusEvent<HTMLDivElement>) => {
    const nextFocusTarget = event.relatedTarget as Node | null;
    if (nextFocusTarget && event.currentTarget.contains(nextFocusTarget)) return;
    setIsOpen(false);
  }, []);

  if (!column.filterable || !column.filterOptions) return null;

  const activeCount = activeValues.length;
  const filterButtonLabel =
    activeCount > 0
      ? t('common.filterColumnActive', 'Filter {{column}} (active: {{count}})', {
          column: column.label,
          count: activeCount,
        })
      : t('common.filterColumnInactive', 'Filter {{column}}, no filter applied', {
          column: column.label,
        });
  const panelHeadingId = `filter-panel-${column.id}`;

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={filterButtonLabel}
        aria-haspopup="true"
        aria-expanded={isOpen}
        className={`p-1 rounded-md hover:bg-state-hover transition-colors ${
          activeValues.length > 0 ? 'text-slate-900 dark:text-slate-100' : 'text-slate-500'
        }`}
      >
        <ChevronDown size={14} aria-hidden="true" />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={closeAndReturnFocus} />
          <div
            ref={panelRef}
            role="group"
            aria-labelledby={panelHeadingId}
            onBlur={handlePanelBlur}
            className="absolute top-full left-0 mt-1 z-50 min-w-[180px] bg-white dark:bg-navy-900 border border-slate-200/70 dark:border-white/[0.08] rounded-xl shadow-xl overflow-hidden"
          >
            <h3 id={panelHeadingId} className="sr-only">
              {t('common.filterByColumn', 'Filter by {{column}}', { column: column.label })}
            </h3>
            <div className="max-h-[200px] overflow-y-auto p-2">
              {column.filterOptions.map((option) => (
                <label
                  key={option.value}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-state-hover cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(option.value)}
                    onChange={() => handleToggle(option.value)}
                    // TRIADA_KANON B.38/B.39 — jw.: lejek filtra kolumny miał
                    // crimsonowy checkbox i crimsonowy ring fokusa.
                    className="rounded border-navy-600 bg-slate-200 dark:bg-navy-700 text-c-info focus:ring-c-focus"
                  />
                  {option.color && <span className={`w-2 h-2 rounded-full ${option.color}`} />}
                  <span className="text-sm text-slate-700 dark:text-slate-200">{option.label}</span>
                </label>
              ))}
            </div>
            <div className="flex items-center justify-between p-2 border-t border-slate-200/70 dark:border-white/[0.08]">
              <button
                type="button"
                onClick={handleClear}
                className="text-xs font-medium text-slate-500 dark:text-slate-300 hover:text-slate-700 dark:hover:text-white transition-colors rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
              >
                {t('common.clear', 'Clear')}
              </button>
              <button
                type="button"
                onClick={handleApply}
                className="px-3 py-1 text-xs font-medium bg-c-text text-c-bg rounded-lg hover:bg-c-text-secondary transition-colors"
              >
                {t('common.apply', 'Apply')}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// ── Accessible column resize handle (R6-P1b a11y fix) ──────────────────────
// The shared `ColumnResizer` (`@/components/ui/ResizableTable/ColumnResizer.tsx`)
// renders a bare `<div onMouseDown>` with no `tabIndex`/keyboard handling —
// mouse users can resize columns, keyboard users cannot reach the handle at
// all. This is a LOCAL replacement scoped to `FilterableTable` (the canon
// list shell every `StandardTable` consumer renders through), not an edit to
// the shared `ColumnResizer` file — so the fix cannot regress the other four
// direct consumers of that file (MyTasksListContent/InboxContent/
// NotificationsContent/IdeasTableContent), which keep using the original,
// unmodified `ColumnResizer`.
//
// Pattern: WAI-ARIA APG "Window Splitter" (role="separator", resizable):
// https://www.w3.org/WAI/ARIA/apg/patterns/windowsplitter/
//   Tab             → focus the handle.
//   ArrowLeft/Right → shrink/grow by RESIZE_STEP px (Shift = large step).
//   Home / End      → jump to minWidth / maxWidth.
//   Escape          → revert to the width the column had when the handle
//                      received focus (keyboard equivalent of releasing a
//                      drag without committing).
//
// Declared at MODULE scope, not inside FilterableTable's render body — an
// inline component definition there would get a NEW type identity on every
// FilterableTable re-render (e.g. the very next render after an ArrowRight
// keypress changes columnWidths), which unmounts/remounts the DOM node and
// silently drops keyboard focus after a single keystroke.
const RESIZE_STEP = 12;
const RESIZE_STEP_LARGE = 48;

const ColumnResizeHandle: React.FC<{
  columnId: string;
  columnLabel: string;
  currentWidth: number;
  minWidth: number;
  maxWidth: number;
  onResize: (columnId: string, newWidth: number) => void;
}> = ({ columnId, columnLabel, currentWidth, minWidth, maxWidth, onResize }) => {
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);
  const focusStartWidthRef = useRef(currentWidth);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(true);
      startXRef.current = e.clientX;
      startWidthRef.current = currentWidth;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    },
    [currentWidth]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return;
      const delta = e.clientX - startXRef.current;
      const clamped = Math.max(minWidth, Math.min(maxWidth, startWidthRef.current + delta));
      onResize(columnId, clamped);
    },
    [isDragging, columnId, minWidth, maxWidth, onResize]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
    return undefined;
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const step = e.shiftKey ? RESIZE_STEP_LARGE : RESIZE_STEP;
      // stopPropagation on every handled key: proven necessary, not
      // defensive boilerplate — the app shell has a GLOBAL Escape listener
      // (return focus to the main content landmark on Escape, likely meant
      // for closing modals/dropdowns). Without stopPropagation, our
      // Escape correctly reverted the width but the global handler then
      // yanked focus off the handle onto that landmark right after —
      // confirmed via a live Playwright probe (`document.activeElement`
      // became the `<main>`-level wrapper, not the separator) before this
      // line was added. Same guard applied to the arrow/Home/End cases so a
      // future global arrow-key handler (e.g. row navigation) can't do the
      // same thing to those.
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          e.stopPropagation();
          onResize(columnId, Math.max(minWidth, currentWidth - step));
          break;
        case 'ArrowRight':
          e.preventDefault();
          e.stopPropagation();
          onResize(columnId, Math.min(maxWidth, currentWidth + step));
          break;
        case 'Home':
          e.preventDefault();
          e.stopPropagation();
          onResize(columnId, minWidth);
          break;
        case 'End':
          e.preventDefault();
          e.stopPropagation();
          onResize(columnId, maxWidth);
          break;
        case 'Escape':
          e.preventDefault();
          e.stopPropagation();
          onResize(columnId, focusStartWidthRef.current);
          break;
        default:
          break;
      }
    },
    [columnId, currentWidth, minWidth, maxWidth, onResize]
  );

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={`Resize ${columnLabel} column`}
      aria-valuenow={Math.round(currentWidth)}
      aria-valuemin={Math.round(minWidth)}
      aria-valuemax={Math.round(maxWidth)}
      tabIndex={0}
      onMouseDown={handleMouseDown}
      onKeyDown={handleKeyDown}
      onFocus={() => {
        focusStartWidthRef.current = currentWidth;
      }}
      className={`
        absolute -right-1.5 top-0 h-full w-3 cursor-col-resize
        touch-none select-none
        group/resizer
        outline-none focus-visible:ring-2 focus-visible:ring-c-focus focus-visible:ring-inset rounded-sm
        ${isDragging ? 'z-50' : 'z-10'}
      `}
      title={`Resize ${columnLabel} column`}
    >
      {/* Excel-like: grip sits exactly on the column boundary. */}
      <div
        className={[
          'absolute left-1/2 top-2 bottom-2 w-[2px] -translate-x-1/2 rounded-full transition-colors duration-150',
          // TRIADA_KANON B.38 — uchwyt resize to STAN UI, nie semantyka
          // krytyczna, więc nie może być crimsonem. Hover/drag/focus na
          // niebieskim `--c-focus-solid` (ten sam sygnał co fokus klawiatury).
          isDragging
            ? 'bg-[color:var(--c-focus-solid)]'
            : 'bg-slate-300/80 dark:bg-white/[0.10] group-hover/resizer:bg-[color:var(--c-focus-solid)] dark:group-hover/resizer:bg-[color:var(--c-focus-solid)] group-focus-visible/resizer:bg-[color:var(--c-focus-solid)]',
        ].join(' ')}
      />
    </div>
  );
};

export const FilterableTable: React.FC<FilterableTableProps> = ({
  columns,
  data,
  selectedRowId,
  onRowClick,
  onRowDoubleClick,
  onRowAction,
  getRowActions,
  getRowActionSections,
  hideRowActions = false,
  activeFilters,
  onFilterChange,
  emptyMessage = 'No items found',
  emptyFilteredMessage,
  canvasClassName = 'p-4',
  density = 'comfortable',
  enableColumnSettings = true,
  persistKey,
  selection,
  defaultSort = null,
  rowDescription,
  rowClassName,
  minTableWidth = DEFAULT_MIN_TABLE_WIDTH,
}) => {
  const { t } = useTranslation();
  /**
   * ── R04-2A · wysokość rejestru ────────────────────────────────────────────
   *
   * Decyzja kanoniczna (2026-08-06): `CANON_TABLE.headerHeight` i `rowHeight`
   * = 56 px są NADRZĘDNE; padding jest wyłącznie wskazówką i nie wyznacza
   * wysokości końcowej. Do R04-2A wysokość była wypadkową paddingu i fontu
   * (≈44 px w `comfortable`, ≈36 px w `compact`) — czyli różna w dwóch trybach
   * i niemierzalna żadnym testem, bo nie istniała liczba do porównania.
   *
   * `h-14` = 56 px. W tabeli CSS `height` na komórce działa jak MINIMUM, więc
   * wiersz bazowy ma dokładnie 56 px, a wiersz z włączonym opisem może urosnąć —
   * to jest wymagane, bo slot opisu (`min-h-8`, cudza konsolidacja) sam w sobie
   * przekracza pozostałą przestrzeń. Zgodne z §5: wysokość jest STABILNA dla
   * danego trybu, a nie „identyczna niezależnie od treści".
   *
   * `density` zostaje w publicznym API i nadal steruje paddingiem — zmienia się
   * tylko to, że nie steruje już wysokością.
   *
   * Wiązanie `h-14` ↔ `CANON_TABLE.rowHeight` (56 px) egzekwuje test R04-2A,
   * a nie import — klasa jest STATYCZNA (`h-14`), nie budowana z `CANON_TABLE` szablonem —
   * Tailwind skanuje źródło tekstowo i klasy sklejanej w runtime nigdy by nie
   * wygenerował. Powiązanie `h-14` ↔ 56 px pilnuje test R04-2A.
   */
  const cellPadding = density === 'compact' ? 'px-4 py-2' : 'px-4 py-3';
  const ROW_HEIGHT_CLASS = 'h-14';

  // PPM-mirror (ANEKS #3b): right-click on a row opens the SAME
  // RowActionsMenu popover as its kebab, anchored at the cursor instead of
  // the button. One row can have an active context-menu point at a time.
  const [contextMenuRow, setContextMenuRow] = useState<{
    rowId: string;
    point: { x: number; y: number };
  } | null>(null);

  // Opt-in selection (canon §3.5). Normalize selectedIds to a Set for O(1) lookup.
  const selectedIdSet = useMemo(() => {
    if (!selection) return null;
    return selection.selectedIds instanceof Set
      ? selection.selectedIds
      : new Set(selection.selectedIds);
  }, [selection]);

  // V-B — persisted column layout (widths + visibility/order). Read on mount,
  // written on change. Keyed by `persistKey`; no-op when unset.
  const storageKey = persistKey ? `filterableTable.cols.${persistKey}` : null;
  const readPersisted = useCallback((): {
    widths?: Record<string, number>;
    visibility?: Record<string, boolean>;
    order?: Record<string, number>;
  } | null => {
    if (!storageKey || typeof window === 'undefined') return null;
    try {
      const raw = window.localStorage.getItem(storageKey);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, [storageKey]);

  const parsePx = useCallback((value?: string, fallback = 140) => {
    if (!value) return fallback;
    const m = String(value).match(/(\d+)\s*px/i);
    if (m?.[1]) return Number(m[1]);
    const n = Number(String(value).replace(/[^\d.]/g, ''));
    return Number.isFinite(n) && n > 0 ? n : fallback;
  }, []);

  const defaultColumnConfigs = useMemo<ColumnConfig[]>(() => {
    return columns.map((c, idx) => ({
      id: c.id,
      label: c.label,
      visible: true,
      order: idx,
      width: parsePx(c.width, c.id === 'title' || c.id === 'name' ? 260 : 140),
      minWidth: c.id === 'title' || c.id === 'name' ? 200 : 90,
      maxWidth: c.id === 'title' || c.id === 'name' ? 520 : 320,
      required: c.id === 'title' || c.id === 'name',
    }));
  }, [columns, parsePx]);

  // Merge persisted layout onto the column defaults (V-B).
  const mergePersisted = useCallback(
    (configs: ColumnConfig[]): { configs: ColumnConfig[]; widths: Record<string, number> } => {
      const persisted = readPersisted();
      const widths: Record<string, number> = {};
      const merged = configs.map((c) => {
        const w = persisted?.widths?.[c.id];
        const vis = persisted?.visibility?.[c.id];
        const ord = persisted?.order?.[c.id];
        const width = typeof w === 'number' && w > 0 ? w : (c.width ?? 140);
        widths[c.id] = width;
        return {
          ...c,
          width,
          visible: typeof vis === 'boolean' ? vis : c.visible,
          order: typeof ord === 'number' ? ord : c.order,
        };
      });
      return { configs: merged, widths };
    },
    [readPersisted]
  );

  const [columnConfigs, setColumnConfigs] = useState<ColumnConfig[]>(
    () => mergePersisted(defaultColumnConfigs).configs
  );
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(
    () => mergePersisted(defaultColumnConfigs).widths
  );

  // Keep column settings in sync when columns change (e.g., tab switch),
  // re-applying any persisted layout.
  useEffect(() => {
    const { configs, widths } = mergePersisted(defaultColumnConfigs);
    setColumnConfigs(configs);
    setColumnWidths(widths);
  }, [defaultColumnConfigs, mergePersisted]);

  // Persist layout whenever it changes (V-B).
  useEffect(() => {
    if (!storageKey || typeof window === 'undefined') return;
    try {
      const widths: Record<string, number> = {};
      const visibility: Record<string, boolean> = {};
      const order: Record<string, number> = {};
      for (const c of columnConfigs) {
        widths[c.id] = columnWidths[c.id] ?? c.width ?? 140;
        visibility[c.id] = c.visible !== false;
        order[c.id] = c.order ?? 0;
      }
      window.localStorage.setItem(storageKey, JSON.stringify({ widths, visibility, order }));
    } catch {
      /* quota / SSR — non-fatal */
    }
  }, [columnConfigs, columnWidths, storageKey]);

  const visibleColumns = useMemo(() => {
    const byId = new Map(columnConfigs.map((c) => [c.id, c]));
    return columns
      .filter((c) => byId.get(c.id)?.visible !== false)
      .sort((a, b) => (byId.get(a.id)?.order ?? 0) - (byId.get(b.id)?.order ?? 0));
  }, [columns, columnConfigs]);

  /**
   * Rozwiązanie `minTableWidth` → konkretna wartość `style.minWidth` albo
   * `undefined` (brak wymuszenia). `undefined` jest tu ZAMIERZONE: React
   * pomija właściwość, więc tabela (`w-full table-fixed`) zwęża się do
   * kontenera i poziome przewijanie wewnątrz `overflow-x-auto` znika.
   */
  const resolvedMinTableWidth = useMemo<number | undefined>(() => {
    if (minTableWidth === 'auto') return undefined;
    if (minTableWidth === 'columns') {
      const dataColumnCount = visibleColumns.filter((c) => c.type !== 'select').length;
      return dataColumnCount <= AUTO_MIN_WIDTH_COLUMN_THRESHOLD
        ? undefined
        : DEFAULT_MIN_TABLE_WIDTH;
    }
    return minTableWidth;
  }, [minTableWidth, visibleColumns]);

  // First data (non-select) column hosts the optional row-description line.
  const firstDataColumnId = useMemo(
    () => visibleColumns.find((c) => c.type !== 'select')?.id ?? null,
    [visibleColumns]
  );

  /**
   * Zero-sum resize (Triada standard, wzór MyTasksListContent): powiększenie
   * kolumny zabiera szerokość SĄSIEDNIEJ (następnej widocznej) kolumnie, z
   * klamrami min/max po obu stronach — całkowita szerokość tabeli stała.
   */
  const handleColumnResize = useCallback(
    (columnId: string, newWidth: number) => {
      const byId = new Map(columnConfigs.map((c) => [c.id, c]));
      const cfg = byId.get(columnId);
      const idx = visibleColumns.findIndex((c) => c.id === columnId);
      const nextCol = idx >= 0 ? visibleColumns[idx + 1] : undefined;
      // Last visible column or unknown → plain resize (legacy behaviour).
      if (!cfg || !nextCol || nextCol.type === 'select') {
        setColumnWidths((prev) => ({ ...prev, [columnId]: newWidth }));
        setColumnConfigs((prev) =>
          prev.map((c) => (c.id === columnId ? { ...c, width: newWidth } : c))
        );
        return;
      }

      const nextCfg = byId.get(nextCol.id);
      const min = cfg.minWidth ?? 90;
      const max = cfg.maxWidth ?? 520;
      const nextMin = nextCfg?.minWidth ?? 90;
      const nextMax = nextCfg?.maxWidth ?? 520;

      const currentWidth = columnWidths[columnId] ?? cfg.width ?? 140;
      const nextWidth = columnWidths[nextCol.id] ?? nextCfg?.width ?? 140;
      const clampedWidth = Math.max(min, Math.min(max, newWidth));
      const requestedDelta = clampedWidth - currentWidth;
      const requestedNextWidth = nextWidth - requestedDelta;
      const clampedNextWidth = Math.max(nextMin, Math.min(nextMax, requestedNextWidth));
      const appliedDelta = nextWidth - clampedNextWidth;
      const applied: Record<string, number> = {
        ...columnWidths,
        [columnId]: currentWidth + appliedDelta,
        [nextCol.id]: clampedNextWidth,
      };
      setColumnWidths(applied);
      setColumnConfigs((cfgs) =>
        cfgs.map((c) => (applied[c.id] !== undefined ? { ...c, width: applied[c.id] } : c))
      );
    },
    [columnConfigs, columnWidths, visibleColumns]
  );

  const resetColumns = useCallback(() => {
    setColumnConfigs(defaultColumnConfigs);
    setColumnWidths(() => {
      const widths: Record<string, number> = {};
      for (const c of defaultColumnConfigs) widths[c.id] = c.width ?? 140;
      return widths;
    });
  }, [defaultColumnConfigs]);

  // Get active filter values for a column
  const getActiveFilterValues = useCallback(
    (columnId: string) => {
      return activeFilters.filter((f) => f.column === columnId).map((f) => f.value);
    },
    [activeFilters]
  );

  // Handle filter change for a column
  const handleColumnFilter = useCallback(
    (column: TableColumn, values: string[]) => {
      // Remove existing filters for this column
      const otherFilters = activeFilters.filter((f) => f.column !== column.id);

      // Add new filters
      const newFilters = values.map((value) => {
        const option = column.filterOptions?.find((o) => o.value === value);
        return {
          id: `${column.id}-${value}`,
          column: column.id,
          value,
          label: option?.label || value,
          color: option?.color,
        };
      });

      onFilterChange([...otherFilters, ...newFilters]);
    },
    [activeFilters, onFilterChange]
  );

  // Filter data based on active filters
  const filteredData = useMemo(() => {
    if (activeFilters.length === 0) return data;

    return data.filter((row) => {
      // Group filters by column
      const filtersByColumn = activeFilters.reduce(
        (acc, filter) => {
          if (!acc[filter.column]) acc[filter.column] = [];
          acc[filter.column].push(filter.value);
          return acc;
        },
        {} as Record<string, string[]>
      );

      // Check each column's filters (OR within column, AND between columns)
      return Object.entries(filtersByColumn).every(([column, values]) => {
        const rowValue = row[column];
        // Kolumny wielowartościowe (np. `tags: string[]`) — dopasowanie „którykolwiek
        // z tagów wiersza jest wybrany". Bez tego lejek na takiej kolumnie zawsze
        // zwracał 0 wierszy (`values.includes(tablica)` nigdy nie jest prawdą).
        if (Array.isArray(rowValue)) {
          return rowValue.some((entry) => values.includes(String(entry)));
        }
        return values.includes(rowValue);
      });
    });
  }, [data, activeFilters]);

  // ── Sorting (Triada standard) — click on a `sortable` header toggles asc/desc.
  const [sort, setSort] = useState<{ columnId: string; direction: 'asc' | 'desc' } | null>(
    defaultSort ?? null
  );

  // Mechanika 1:1 z MyWork (MyTasksListContent.handleSort): asc → desc → none.
  const handleSort = useCallback((columnId: string) => {
    setSort((prev) => {
      if (prev?.columnId !== columnId) return { columnId, direction: 'asc' };
      if (prev.direction === 'asc') return { columnId, direction: 'desc' };
      return null;
    });
  }, []);

  const sortedData = useMemo(() => {
    if (!sort) return filteredData;
    const column = columns.find((c) => c.id === sort.columnId);
    if (!column) return filteredData;
    const accessor = column.sortAccessor ?? ((row: TableRow) => row[column.id]);
    const dir = sort.direction === 'asc' ? 1 : -1;
    return [...filteredData].sort((a, b) => {
      const av = accessor(a);
      const bv = accessor(b);
      if (av == null && bv == null) return 0;
      if (av == null) return 1; // empty values sink to the bottom
      if (bv == null) return -1;
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
      const as = String(av);
      const bs = String(bv);
      // Date-like strings sort chronologically.
      const ad = Date.parse(as);
      const bd = Date.parse(bs);
      if (!Number.isNaN(ad) && !Number.isNaN(bd) && /\d{4}-\d{2}/.test(as)) {
        return (ad - bd) * dir;
      }
      return as.localeCompare(bs, undefined, { numeric: true, sensitivity: 'base' }) * dir;
    });
  }, [filteredData, sort, columns]);

  const SortIcon: React.FC<{ columnId: string }> = ({ columnId }) =>
    sort?.columnId === columnId ? (
      sort.direction === 'asc' ? (
        <ArrowUp size={12} className="shrink-0" />
      ) : (
        <ArrowDown size={12} className="shrink-0" />
      )
    ) : (
      <ArrowUpDown size={12} className="shrink-0 opacity-40" />
    );

  // Format relative time
  const formatRelativeTime = (date: Date | string) => {
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (hours < 1) return t('sharedComponents.filterableTable.justNow');
    if (hours < 24) return t('sharedComponents.filterableTable.hoursAgo', { count: hours });
    if (days < 7) return t('sharedComponents.filterableTable.daysAgo', { count: days });
    return d.toLocaleDateString();
  };

  return (
    <div className={canvasClassName}>
      <div className="bg-white/70 dark:bg-navy-900/70 backdrop-blur border border-slate-200/70 dark:border-white/[0.03] rounded-xl overflow-hidden">
        <div className="w-full overflow-x-auto">
          <table
            /* §27-exempt: to JEST kanoniczny komponent FilterableTable (§2 SSOT) — surowy <table> tutaj to jego implementacja, nie luka */ className="w-full table-fixed"
            data-min-table-width={resolvedMinTableWidth ?? 'auto'}
            style={{ minWidth: resolvedMinTableWidth }}
          >
            <thead className="sticky top-0 z-10 bg-slate-50/80 dark:bg-navy-900/50 backdrop-blur-hig">
              <tr>
                {visibleColumns.map((column, idx) => {
                  const cfg = columnConfigs.find((c) => c.id === column.id);
                  const width = columnWidths[column.id] ?? parsePx(column.width, 140);
                  const minWidth =
                    cfg?.minWidth ?? (column.id === 'title' || column.id === 'name' ? 200 : 90);
                  const maxWidth =
                    cfg?.maxWidth ?? (column.id === 'title' || column.id === 'name' ? 520 : 320);
                  const isLastDataCol = idx === visibleColumns.length - 1;
                  const isSelectCol = column.type === 'select' && !!selection;
                  return (
                    <th
                      key={column.id}
                      className={`${ROW_HEIGHT_CLASS} ${cellPadding} relative ${alignToClass(column.align)} text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider`}
                      style={{
                        width: `${width}px`,
                        minWidth: `${minWidth}px`,
                        maxWidth: `${maxWidth}px`,
                      }}
                    >
                      {isSelectCol ? (
                        // Canon §3.5 — select-all lives in the header column.
                        <div className="flex items-center">
                          <input
                            type="checkbox"
                            checked={selection!.isAllSelected}
                            ref={(el) => {
                              if (el) el.indeterminate = selection!.isIndeterminate;
                            }}
                            onChange={(e) => {
                              e.stopPropagation();
                              selection!.onToggleAll();
                            }}
                            aria-label={selection!.selectAllLabel ?? t('common.selectAll')}
                            // TRIADA_KANON B.38/B.39 — checkbox „zaznacz wszystko"
                            // był jedynym crimsonowym (`primary-500`) w tabeli, z
                            // crimsonowym ringiem fokusa. Wyrównane do checkboxa
                            // wiersza (niżej): akcent `c-info`, fokus `c-focus`.
                            className="h-4 w-4 rounded border-slate-300 dark:border-navy-600 text-c-info focus:ring-c-focus cursor-pointer"
                          />
                        </div>
                      ) : (
                        <div
                          className={`flex items-center gap-1 ${
                            column.align === 'right'
                              ? 'justify-end'
                              : column.align === 'center'
                                ? 'justify-center'
                                : ''
                          }`}
                        >
                          {column.sortable ? (
                            <button
                              type="button"
                              onClick={() => handleSort(column.id)}
                              // Fokus MUSI być niebieski (`c-focus`). Bez tej klasy
                              // przeglądarka rysuje własny outline — na tym motywie
                              // bursztynowy rgb(229,151,0) — i łamie kanon na KAŻDYM
                              // ekranie listowym, bo to wspólny nagłówek sortowania.
                              className="inline-flex items-center gap-1 uppercase tracking-wider transition-colors hover:text-c-text-secondary rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                              aria-label={`Sort by ${column.label}`}
                            >
                              <span>{column.label}</span>
                              <SortIcon columnId={column.id} />
                            </button>
                          ) : (
                            <span>{column.label}</span>
                          )}
                          {column.filterable && (
                            <FilterDropdown
                              column={column}
                              activeValues={getActiveFilterValues(column.id)}
                              onApply={(values) => handleColumnFilter(column, values)}
                            />
                          )}
                        </div>
                      )}
                      {!isLastDataCol && !isSelectCol ? (
                        <ColumnResizeHandle
                          columnId={column.id}
                          columnLabel={column.label}
                          currentWidth={width}
                          minWidth={minWidth}
                          maxWidth={maxWidth}
                          onResize={handleColumnResize}
                        />
                      ) : null}
                    </th>
                  );
                })}
                {!hideRowActions ? (
                  // R09-1a (2026-08-10): `sticky right-0` — na wąskim obszarze tabeli
                  // (np. otwarty panel podglądu obok, TRIADA §C9) `table-fixed` NIE
                  // kurczy kolumn (szerokości z pierwszego wiersza są sztywne, patrz
                  // ColumnResizer — zmiana tylko ręczna), więc kolumna z Settings2
                  // po prostu wypadała poza widoczny obszar bez paska przewijania w
                  // linii wzroku. Ikona TRIADA B.16 jest OBOWIĄZKOWA na każdym
                  // odbiorze — przypinamy ją do prawej krawędzi widocznego obszaru,
                  // żeby nigdy nie wymagała przewijania. `bg-slate-50 dark:bg-navy-900`
                  // (pełne, nie tłumaczone przez `thead`'s `/80` + blur) zapobiega
                  // przebijaniu przewijanej treści spod przypiętej kolumny. Cień
                  // po lewej krawędzi sygnalizuje, że to przypięty fragment, nie
                  // zwykła kolumna — czytelne domknięcie zamiast twardej krawędzi.
                  <th
                    className={`${ROW_HEIGHT_CLASS} ${cellPadding} text-right text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-20 sticky right-0 z-[11] bg-slate-50 dark:bg-navy-900 shadow-[-6px_0_6px_-6px_rgba(0,0,0,0.12)]`}
                  >
                    {enableColumnSettings && rowDescription ? (
                      /* Triada standard: Settings2 → TableSettingsPopover
                       * (kolumny + „Show row description") w prawym górnym rogu. */
                      <div className="flex justify-end normal-case tracking-normal">
                        <TableSettingsPopover
                          columns={[
                            ...columnConfigs
                              .filter((c) => c.id !== '__select')
                              .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                              .map((c) => ({
                                id: c.id,
                                label: c.label,
                                required: !!c.required,
                                visible: c.visible !== false,
                              })),
                            // Actions column is structural — shown as LOCKED (wzór My Work).
                            {
                              id: '__actions',
                              label: t('common.actions'),
                              required: true,
                              visible: true,
                            },
                          ]}
                          onToggle={(columnId, visible) =>
                            setColumnConfigs((prev) =>
                              prev.map((c) => (c.id === columnId ? { ...c, visible } : c))
                            )
                          }
                          onMove={(columnId, direction) => {
                            if (columnId === '__actions') return;
                            // Swap kolejności 1:1 z ColumnSelector.moveColumn (My Work).
                            setColumnConfigs((prev) => {
                              const sorted = [...prev].sort(
                                (a, b) => (a.order ?? 0) - (b.order ?? 0)
                              );
                              const idx = sorted.findIndex((c) => c.id === columnId);
                              const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
                              if (idx < 0 || targetIdx < 0 || targetIdx >= sorted.length)
                                return prev;
                              const current = sorted[idx];
                              const target = sorted[targetIdx];
                              return prev.map((c) => {
                                if (c.id === current.id) return { ...c, order: target.order };
                                if (c.id === target.id) return { ...c, order: current.order };
                                return c;
                              });
                            });
                          }}
                          onReset={resetColumns}
                          resetLabel={t('common.resetColumns')}
                          showDescription={rowDescription.show}
                          onToggleDescription={rowDescription.onToggle}
                          label={
                            rowDescription.settingsLabel ??
                            t('common.viewSettings', 'View settings')
                          }
                          columnsHeading={
                            rowDescription.columnsHeading ?? t('common.visibleColumns')
                          }
                          descriptionLabel={rowDescription.label ?? t('common.showRowDescription')}
                        />
                      </div>
                    ) : enableColumnSettings ? (
                      <div className="flex justify-end">
                        <ColumnSelector
                          columns={columnConfigs}
                          onChange={setColumnConfigs}
                          onReset={resetColumns}
                          trigger={
                            <button
                              type="button"
                              className="inline-flex items-center justify-center h-7 w-7 rounded-full text-slate-500 dark:text-slate-400 hover:bg-state-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                              title={t('common.columns')}
                              aria-label={t('common.columns')}
                            >
                              <Columns size={14} />
                            </button>
                          }
                        />
                      </div>
                    ) : null}
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/60 dark:divide-white/[0.03]">
              {sortedData.length === 0 ? (
                <tr>
                  <td
                    colSpan={visibleColumns.length + (hideRowActions ? 0 : 1)}
                    className="px-4 py-14 text-center text-slate-500 dark:text-slate-400"
                    data-empty-reason={data.length === 0 ? 'no-data' : 'no-filter-results'}
                  >
                    {/*
                      R04-2A — §5 Stany: „empty rozróżnia brak danych od braku
                      wyniku filtra i ma sensowne CTA/reset". Do tej pory obie
                      sytuacje pokazywały ten sam `emptyMessage`, więc użytkownik
                      po odfiltrowaniu wszystkiego widział „No items found" i nie
                      miał jak się dowiedzieć, że wystarczy zdjąć filtr.
                      Rozróżnienie jest lokalne i pewne: `data` to wejście,
                      `sortedData` to wynik po filtrach.
                    */}
                    <div className="mx-auto max-w-2xl rounded-2xl border border-slate-200/60 dark:border-white/[0.03] bg-slate-50/70 dark:bg-white/[0.03] px-6 py-8 text-sm">
                      {data.length === 0 ? (
                        emptyMessage
                      ) : (
                        <div className="flex flex-col items-center gap-3">
                          <span>
                            {emptyFilteredMessage ??
                              t('common.noFilterResults', 'No items match the active filters')}
                          </span>
                          <button
                            type="button"
                            onClick={() => onFilterChange([])}
                            className="inline-flex h-8 items-center gap-1.5 rounded-full border border-c-border-subtle px-3 text-xs font-medium text-c-text transition-colors hover:bg-state-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                          >
                            {t('common.clearFilters', 'Clear filters')}
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                sortedData.map((row) => (
                  <tr
                    key={row.id}
                    // DOSTĘPNOŚĆ KLAWIATURY — wiersz jest interaktywny, więc musi
                    // być osiągalny Tabem i obsługiwać Enter/Spację.
                    //
                    // Do tej pory `<tr>` miał wyłącznie `onClick`: otwarcie
                    // podglądu było możliwe TYLKO myszą, w każdym module tej
                    // aplikacji naraz. Kanon TRIADA (część B, punkty 41-43)
                    // wymaga pełnego cyklu Tab przez wszystkie interaktywne
                    // elementy — to nie jest rozszerzenie standardu, tylko
                    // doprowadzenie kodu do niego.
                    //
                    // `tabIndex` dostają wyłącznie wiersze, które faktycznie coś
                    // robią. Wiersz bez handlera zostaje nieinteraktywny, żeby
                    // nie zaśmiecać kolejności fokusa pustymi przystankami.
                    tabIndex={onRowClick || onRowDoubleClick ? 0 : undefined}
                    onKeyDown={(event) => {
                      if ((onRowClick || onRowDoubleClick) && (event.key === 'Enter' || event.key === ' ')) {
                        // Spacja przewija stronę, jeśli jej nie zatrzymać.
                        // Klawisz na kontrolce wewnątrz wiersza (przycisk,
                        // checkbox, kebab) należy do niej, nie do wiersza.
                        if (event.target !== event.currentTarget) return;
                        event.preventDefault();
                        onRowClick?.(row);
                        return;
                      }

                      if (
                        !(
                          !hideRowActions &&
                          (event.key === 'ContextMenu' ||
                            (event.shiftKey && event.key === 'F10'))
                        )
                      )
                        return;
                      const sections = getRowActionSections?.(row);
                      const hasMenu = sections
                        ? sections.length > 0
                        : getRowActions
                          ? (getRowActions(row)?.length ?? 0) > 0
                          : true;
                      if (!hasMenu) return;
                      event.preventDefault();
                      event.stopPropagation();
                      const rect = event.currentTarget.getBoundingClientRect();
                      setContextMenuRow({
                        rowId: String(row.id),
                        point: { x: Math.max(rect.left + 24, rect.right - 40), y: rect.top + 28 },
                      });
                    }}
                    // `aria-selected` przyszło z demo — czytnik ekranu musi
                    // wiedzieć, który wiersz jest wybrany, niezależnie od tego,
                    // że wizualnie widać to po tle.
                    aria-selected={row.id === selectedRowId}
                    onClick={() => onRowClick?.(row)}
                    onDoubleClick={() => onRowDoubleClick?.(row)}
                    onContextMenu={
                      hideRowActions
                        ? undefined
                        : (e) => {
                            // ANEKS #3b — PPM-mirror: this row's menu content
                            // mirrors exactly what the kebab column below
                            // would compute. If it's genuinely empty, don't
                            // swallow the native browser menu for nothing.
                            const sections = getRowActionSections?.(row);
                            const hasMenu = sections
                              ? sections.length > 0
                              : getRowActions
                                ? (getRowActions(row)?.length ?? 0) > 0
                                : true; // default hard-coded 5-action fallback
                            if (!hasMenu) return;
                            e.preventDefault();
                            e.stopPropagation();
                            setContextMenuRow({
                              rowId: String(row.id),
                              point: { x: e.clientX, y: e.clientY },
                            });
                          }
                    }
                    className={[
                      'group cursor-pointer transition-colors',
                      // Wiersz jest fokusowalny, więc musi mieć WŁASNY, widoczny
                      // wskaźnik fokusa w kolorze kanonu. Bez tego przeglądarka
                      // rysuje swój domyślny bursztynowy outline — zmierzony
                      // rgb(229,151,0). Demo doszło do tej samej poprawki
                      // niezależnie; treść klas jest identyczna.
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-c-focus',
                      row.id === selectedRowId ? 'bg-state-selected' : 'hover:bg-state-hover',
                      typeof rowClassName === 'function' ? rowClassName(row) : rowClassName,
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    {visibleColumns.map((column) => (
                      <td
                        key={column.id}
                        className={`${ROW_HEIGHT_CLASS} ${cellPadding} ${column.align ? alignToClass(column.align) : ''}`}
                      >
                        {column.type === 'select' && selection ? (
                          <input
                            type="checkbox"
                            checked={selectedIdSet?.has(String(row.id)) ?? false}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => {
                              e.stopPropagation();
                              selection.onToggleRow(String(row.id));
                            }}
                            aria-label={selection.selectRowLabel ?? t('common.selectRow')}
                            className="h-3.5 w-3.5 rounded border-c-border-subtle text-c-info focus:ring-c-focus cursor-pointer"
                          />
                        ) : column.render ? (
                          column.render(row)
                        ) : column.id === 'status' ? (
                          <EntityStatusChip status={row.status} />
                        ) : column.id === 'progress' ? (
                          <ProgressBar progress={row.progress} />
                        ) : column.id === 'updatedAt' ? (
                          <span className="text-sm text-slate-500 dark:text-slate-400">
                            {formatRelativeTime(row.updatedAt)}
                          </span>
                        ) : isEmptyCell(row[column.id]) ? (
                          <span className="text-sm text-slate-400">—</span>
                        ) : (
                          <div className="min-w-0">
                            <span
                              className={[
                                'text-sm text-slate-700 dark:text-slate-200',
                                column.id === 'title' || column.id === 'name'
                                  ? 'block truncate'
                                  : '',
                              ].join(' ')}
                              title={
                                typeof row[column.id] === 'string' ? row[column.id] : undefined
                              }
                            >
                              {row[column.id]}
                            </span>
                          </div>
                        )}
                        {rowDescription?.show &&
                        column.type !== 'select' &&
                        column.id === firstDataColumnId
                          ? (() => {
                              const desc = rowDescription.render(row);
                              return (
                                <div
                                  data-row-description-slot
                                  className="mt-0.5 min-h-8 text-xs text-c-text-muted line-clamp-2"
                                >
                                  {desc ?? null}
                                </div>
                              );
                            })()
                          : null}
                      </td>
                    ))}
                    {!hideRowActions ? (
                      // R09-1a — sam mirror nagłówka: kebab przypięty do prawej
                      // krawędzi, żeby nie wypadał poza widoczny obszar razem z
                      // Settings2 (patrz komentarz przy `<th>` powyżej).
                      // sticky-defect1a (2026-08-11): baza `bg-white dark:bg-navy-900`
                      // zostaje (musi być nieprzezroczysta — jedyna ochrona przed
                      // przebijaniem przewiniętej treści spod przypiętej kolumny).
                      // `background-color: inherit` z wiersza NIE działa tutaj: wiersz
                      // w stanie domyślnym nie ma WŁASNEGO tła (przezroczysty, pokazuje
                      // rozmyte tło karty przez `bg-white/70 backdrop-blur`), więc
                      // odziedziczona wartość byłaby `transparent` — zniosłoby to
                      // ochronę przed przewijaniem właśnie w stanie domyślnym.
                      // Zamiast tego: stan wiersza (`--state-selected`/`--state-hover`,
                      // te same tokeny co `bg-state-selected`/`hover:bg-state-hover`
                      // na `<tr>`) nakładamy jako `box-shadow: inset` — to INNA
                      // właściwość CSS niż `background-color`, więc nie ma konfliktu
                      // "dwóch klas Tailwind na jednej właściwości" i tło + cień
                      // przewijania + odcień stanu współistnieją bez wyliczania kolejnych
                      // wariantów. Mirror warunku z `<tr>` (linia ~941) 1:1 — UWAGA:
                      // musi być `group-hover:`, NIE `hover:` — hover trafia myszą
                      // gdziekolwiek w wierszu (tekst tytułu po lewej), rzadko
                      // bezpośrednio nad przypiętą komórką; `<tr>` już niesie klasę
                      // `group` (patrz linia ~940), więc `group-hover:` na tej
                      // komórce reaguje na hover CAŁEGO wiersza, tak jak `hover:` na
                      // `<tr>` reaguje na siebie.
                      <td
                        className={`${ROW_HEIGHT_CLASS} ${cellPadding} text-right sticky right-0 z-[11] bg-white dark:bg-navy-900 ${
                          row.id === selectedRowId
                            ? 'shadow-[-6px_0_6px_-6px_rgba(0,0,0,0.12),inset_0_0_0_999px_var(--state-selected)]'
                            : 'shadow-[-6px_0_6px_-6px_rgba(0,0,0,0.12)] group-hover:shadow-[-6px_0_6px_-6px_rgba(0,0,0,0.12),inset_0_0_0_999px_var(--state-hover)]'
                        }`}
                      >
                        <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
                          {(() => {
                            // PPM-mirror (ANEKS #3b): this row's context-menu
                            // anchor, if the last right-click landed here.
                            const contextMenuAnchor =
                              contextMenuRow?.rowId === String(row.id)
                                ? contextMenuRow.point
                                : null;
                            const closeContextMenu = () => setContextMenuRow(null);
                            // Triada standard: LONG contextual kebab as sections.
                            const sections = getRowActionSections?.(row);
                            if (sections) {
                              if (!sections.length) return null;
                              return (
                                <RowActionsMenu
                                  iconVariant="vertical"
                                  sections={sections}
                                  contextMenuAnchor={contextMenuAnchor}
                                  onContextMenuClose={closeContextMenu}
                                />
                              );
                            }
                            const actions: RowAction[] =
                              getRowActions?.(row) ??
                              ([
                                {
                                  id: 'open',
                                  label: t('common.open', 'Open'),
                                  icon: Maximize2,
                                  variant: 'primary',
                                  onClick: () => onRowAction?.('edit', row),
                                },
                                {
                                  id: 'preview',
                                  label: t('common.preview', 'Preview'),
                                  icon: Eye,
                                  onClick: () => onRowAction?.('preview', row),
                                },
                                {
                                  id: 'duplicate',
                                  label: t('common.duplicate', 'Duplicate'),
                                  icon: Copy,
                                  onClick: () => onRowAction?.('duplicate', row),
                                },
                                {
                                  id: 'rename',
                                  label: t('common.edit', 'Edit'),
                                  icon: Edit,
                                  onClick: () => onRowAction?.('rename', row),
                                },
                                {
                                  id: 'delete',
                                  label: t('common.delete', 'Delete'),
                                  icon: Trash2,
                                  divider: true,
                                  variant: 'danger',
                                  onClick: () => onRowAction?.('delete', row),
                                },
                              ] as RowAction[]);

                            // #40 — pure-wiring bridge onto the sectional kebab contract
                            // (RowActionsMenu.sections), same contract every other table
                            // uses.
                            //
                            // R01 (wąskie przekazanie ownershipu, 2026-08-06): fallback
                            // NIE odsiewa już realnych pozycji `disabled`. Kanon §1/§7/§10
                            // wymaga odwrotnie — funkcja ograniczona uprawnieniem albo
                            // regułą biznesową ZOSTAJE widoczna, wyraźnie jaśniejsza.
                            // Atrapy („Coming soon"/„Wkrótce") odsiewa niżej sam renderer
                            // (`czyAtrapa` w `normalizeZones`), więc przepuszczenie ich
                            // tutaj niczego użytkownikowi nie obiecuje, a menu złożone
                            // wyłącznie z atrap nadal nie wyrenderuje nawet triggera.
                            const legacySectionActions = actions;

                            if (!legacySectionActions.length) return null;

                            return (
                              <RowActionsMenu
                                iconVariant="vertical"
                                sections={[{ id: 'legacy', actions: legacySectionActions }]}
                                contextMenuAnchor={contextMenuAnchor}
                                onContextMenuClose={closeContextMenu}
                              />
                            );
                          })()}
                        </div>
                      </td>
                    ) : null}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default FilterableTable;
