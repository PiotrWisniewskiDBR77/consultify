/**
 * EditableSpreadsheetGrid — "najmniejszy arkusz, który jest naprawdę
 * arkuszem" (2026-07-28).
 *
 * PRZED tym komponentem: `KimiWorkspaceShell`'s xlsx-grid (linia ~668 tego
 * pliku sprzed zmiany) była zwykłą, tylko-do-odczytu tabelą HTML — komórka z
 * formułą pokazywała surowy tekst formuły ("=SUM(...)"), nie wynik, i nic nie
 * dało się kliknąć. Ten komponent zastępuje ją — ale TYLKO za flagą
 * `ff_excele_edit` (domyślnie OFF, `src/utils/exceleEditFlag.ts`) i tylko gdy
 * mamy `workbookId` + surowe arkusze (`rawSheets`) — inaczej stary, czysto
 * odczytowy render zostaje bez zmian (zero regresji, reguła #7 projektu).
 *
 * Zakres (dosłownie z zadania): klik → zaznaczenie, dwuklik/Enter/F2 →
 * edycja, Enter zatwierdza i schodzi w dół, Tab zatwierdza i idzie w prawo,
 * Escape anuluje, strzałki nawigują po niezaznaczonej siatce, pasek formuły
 * pokazuje SUROWĄ zawartość komórki (formułę z "=" albo wartość) — nie wynik.
 * Przeliczanie: `workbookFormulaEngine.recalcWorkbook` nad WSZYSTKIMI
 * arkuszami na każdą zmianę (formuły cross-sheet są normą — projectViability.ts
 * referuje 'Założenia'!$B$n z arkusza 'Wyniki'), więc edycja komórki wejściowej
 * na jednym arkuszu natychmiast przelicza formuły na innym. Trwałość:
 * `Api.updateWorkbookCell` → `PATCH /api/workbook/:id/cell` (fire-and-forget
 * z widocznym statusem zapisu — patrz `saveState` niżej), więc zmiana
 * przeżywa odświeżenie strony (GET /workbook/:id czyta zaktualizowany
 * schema_json).
 *
 * CELOWO POZA ZAKRESEM (patrz zadanie): wstążka, formatowanie komórek,
 * wykresy, tabele przestawne, dodawanie/usuwanie wierszy/kolumn, kopiuj-wklej
 * zakresów. Nawigacja i edycja działają WYŁĄCZNIE na istniejących
 * wierszach/kolumnach wygenerowanego skoroszytu.
 */

import {
  AlignLeft,
  AlertTriangle,
  ArrowDownAZ,
  ArrowUpAZ,
  Bold,
  Check,
  ChevronsDown,
  Columns3,
  Copy,
  Filter,
  HelpCircle,
  Italic,
  ListChecks,
  Loader2,
  MessageSquare,
  PaintBucket,
  Plus,
  Rows3,
  Ruler,
  Search,
  Snowflake,
  Trash2,
  Underline,
  WrapText,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';
import {
  colIndexToLetter,
  type ComputedCell,
  excelRowForDataRowIndex,
  formatComputedForDisplay,
  type FormulaSheet,
  parseCellInput,
  rawCellToEditText,
  recalcWorkbook,
} from '@/utils/workbookFormulaEngine';
import { isNegativeVarianceCell } from '@/utils/workbookGridPreview';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

interface Selection {
  rowIndex: number;
  colIndex: number;
}

interface CellChange {
  rowIndex: number;
  colIndex: number;
  before: import('@/utils/workbookFormulaEngine').FormulaCellRaw;
  after: import('@/utils/workbookFormulaEngine').FormulaCellRaw;
}

interface Props {
  workbookId: string;
  /** WSZYSTKIE arkusze skoroszytu (formuły cross-sheet muszą widzieć każdy). */
  sheets: FormulaSheet[];
  activeSheetIndex: number;
  /** Maks. liczba wierszy renderowanych naraz — spójne z resztą podglądu
   *  (GRID_ROW_CAP w KimiWorkspaceShell), niezależny toggle "pokaż wszystkie". */
  rowCap?: number;
}

function cloneSheets(sheets: FormulaSheet[]): FormulaSheet[] {
  // Głęboka kopia robocza — JSON round-trip jest tu wystarczający (schemat to
  // czyste dane: liczby/stringi/booleany/null, bez dat czy funkcji).
  return JSON.parse(JSON.stringify(sheets));
}

function cssColor(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  const normalized = value.trim();
  return normalized.startsWith('#') ? normalized : `#${normalized}`;
}

function cellPresentationStyle(cell: import('@/utils/workbookFormulaEngine').FormulaCellRaw | undefined): React.CSSProperties {
  const style = cell?.style as Record<string, unknown> | undefined;
  if (!style) return {};
  const borderWidth = style.border === 'thick' ? 3 : style.border === 'medium' ? 2 : style.border === 'thin' ? 1 : 0;
  return {
    backgroundColor: cssColor(style.bgColor),
    color: cssColor(style.fontColor),
    fontWeight: style.bold ? 700 : undefined,
    fontStyle: style.italic ? 'italic' : undefined,
    textDecoration: style.underline ? 'underline' : undefined,
    fontSize: typeof style.fontSize === 'number' ? `${style.fontSize}px` : undefined,
    textAlign: style.alignment === 'center' || style.alignment === 'right' ? style.alignment : style.alignment === 'left' ? 'left' : undefined,
    whiteSpace: style.wrapText ? 'normal' : undefined,
    overflowWrap: style.wrapText ? 'anywhere' : undefined,
    border: borderWidth ? `${borderWidth}px solid var(--color-border-subtle, #cbd5e1)` : undefined,
  };
}

export const EditableSpreadsheetGrid: React.FC<Props> = ({
  workbookId,
  sheets,
  activeSheetIndex,
  rowCap = 100,
}) => {
  const { t } = useTranslation();
  const [localSheets, setLocalSheets] = useState<FormulaSheet[]>(() => cloneSheets(sheets));
  const [selected, setSelected] = useState<Selection | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<Selection | null>(null);
  const [editingValue, setEditingValue] = useState<string | null>(null);
  const [showAllRows, setShowAllRows] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [dialogMode, setDialogMode] = useState<
    | 'rename'
    | 'renameWorkbook'
    | 'delete'
    | 'validation'
    | 'findReplace'
    | 'resize'
    | 'comment'
    | 'help'
    | null
  >(null);
  const [dialogValue, setDialogValue] = useState('');
  const [dialogValue2, setDialogValue2] = useState('');
  const [workingSheetIndex, setWorkingSheetIndex] = useState(activeSheetIndex);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const editFocusTargetRef = useRef<'cell' | 'formula'>('cell');
  const undoStackRef = useRef<CellChange[][]>([]);
  const redoStackRef = useRef<CellChange[][]>([]);
  const lastSchemaCommandRef = useRef<Record<string, unknown> | null>(null);

  // Nowy skoroszyt (reopen na inny id) → zacznij od świeżych danych serwera;
  // edycje w toku dla POPRZEDNIEGO workbookId nigdy nie mieszają się z nowym.
  useEffect(() => {
    setLocalSheets(cloneSheets(sheets));
    setSelected(null);
    setSelectionEnd(null);
    setEditingValue(null);
    setSaveState('idle');
    setSaveError(null);
    setWorkingSheetIndex(activeSheetIndex);
    undoStackRef.current = [];
    redoStackRef.current = [];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workbookId]);

  // Zmiana zakładki arkusza → zaznaczenie z poprzedniego arkusza nie ma sensu.
  useEffect(() => {
    setWorkingSheetIndex(activeSheetIndex);
    setSelected(null);
    setSelectionEnd(null);
    setEditingValue(null);
  }, [activeSheetIndex]);

  const computedSheets = useMemo(() => recalcWorkbook(localSheets), [localSheets]);
  const activeRaw = localSheets[workingSheetIndex];
  const activeComputed = computedSheets[workingSheetIndex];
  const selectionRange = useMemo(() => {
    if (!selected) return null;
    const end = selectionEnd || selected;
    return {
      rowStart: Math.min(selected.rowIndex, end.rowIndex),
      rowEnd: Math.max(selected.rowIndex, end.rowIndex),
      colStart: Math.min(selected.colIndex, end.colIndex),
      colEnd: Math.max(selected.colIndex, end.colIndex),
    };
  }, [selected, selectionEnd]);

  useEffect(() => {
    // Starting an edit from the formula bar must not steal focus into the
    // transient cell input. Doing so fires formula-bar blur immediately and
    // used to persist an empty value before the user's text was entered.
    if (editingValue !== null && editFocusTargetRef.current === 'cell') {
      inputRef.current?.focus();
    }
  }, [editingValue]);

  const persistChanges = useCallback(
    async (changes: CellChange[], direction: 'after' | 'before') => {
      setSaveState('saving');
      setSaveError(null);
      try {
        // Cell updates are versioned server-side. Keep them sequential so a
        // multi-cell paste cannot create avoidable compare-and-swap races.
        for (const change of changes) {
          const col = localSheets[workingSheetIndex]?.columns?.[change.colIndex];
          if (!col) continue;
          const cell = change[direction];
          await Api.updateWorkbookCell(workbookId, {
            sheetIndex: workingSheetIndex,
            rowIndex: change.rowIndex,
            columnKey: col.key,
            value: cell.value,
            formula: cell.formula,
          });
        }
        setSaveState('saved');
      } catch (error) {
        setSaveState('error');
        setSaveError(
          error instanceof Error ? error.message : t('kimi.excele.saveFailed', 'Save failed')
        );
      }
    },
    [localSheets, t, workbookId, workingSheetIndex]
  );

  const applyChanges = useCallback(
    (changes: CellChange[], direction: 'after' | 'before') => {
      setLocalSheets((prev) => {
        const clone = cloneSheets(prev);
        const sheet = clone[workingSheetIndex];
        if (!sheet) return prev;
        for (const change of changes) {
          const col = sheet.columns?.[change.colIndex];
          const row = sheet.rows?.[change.rowIndex];
          if (!col || !row) continue;
          if (!row.cells) row.cells = {};
          row.cells[col.key] = { ...change[direction] };
        }
        return clone;
      });
      void persistChanges(changes, direction);
    },
    [persistChanges, workingSheetIndex]
  );

  const runSchemaCommand = useCallback(
    async (command: Record<string, unknown>) => {
      lastSchemaCommandRef.current = command;
      setSaveState('saving');
      setSaveError(null);
      try {
        const result = await Api.updateWorkbookSchema(workbookId, command);
        const nextSheets = result?.schema?.sheets;
        if (Array.isArray(nextSheets) && nextSheets.length) {
          setLocalSheets(cloneSheets(nextSheets));
          setWorkingSheetIndex((current) => Math.min(current, nextSheets.length - 1));
          setSelected(null);
          setSelectionEnd(null);
        }
        undoStackRef.current = [];
        redoStackRef.current = [];
        setSaveState('saved');
      } catch (error) {
        setSaveState('error');
        const message =
          error instanceof Error ? error.message : t('kimi.excele.saveFailed', 'Save failed');
        setSaveError(
          message.includes('409') || /conflict/i.test(message)
            ? t(
                'kimi.excele.conflict',
                'This workbook changed in another session. Reload, then retry your edit.'
              )
            : message
        );
      }
    },
    [t, workbookId]
  );

  // Naprawa odkryta w render-verify (2026-07-28): po Escape/zatwierdzeniu
  // edycji React odmontowuje `<input>` komórki, ale fokus NIE wraca sam do
  // kontenera siatki — kolejne strzałki/Enter/Delete lądowały donikąd (klawiatura
  // "martwa" po pierwszym Escape). Kontener musi przejąć fokus z powrotem,
  // żeby nawigacja klawiaturą działała przez całą sesję edycji, nie tylko do
  // pierwszego anulowania.
  useEffect(() => {
    if (editingValue === null && selected) {
      containerRef.current?.focus();
    }
  }, [editingValue, selected]);

  const commit = useCallback(
    (nextRaw: string, move: 'down' | 'right' | 'none') => {
      if (!selected || !activeRaw?.columns) return;
      const col = activeRaw.columns[selected.colIndex];
      if (!col) return;
      const parsed = parseCellInput(nextRaw);
      const oldCell = activeRaw.rows?.[selected.rowIndex]?.cells?.[col.key] ?? {};
      const afterCell = {
        style: (oldCell as Record<string, unknown>).style,
        comment: (oldCell as Record<string, unknown>).comment,
        validation: (oldCell as Record<string, unknown>).validation,
        ...parsed,
      };
      undoStackRef.current.push([
        {
          rowIndex: selected.rowIndex,
          colIndex: selected.colIndex,
          before: { ...oldCell },
          after: afterCell,
        },
      ]);
      redoStackRef.current = [];

      setLocalSheets((prev) => {
        const clone = cloneSheets(prev);
        const sheet = clone[workingSheetIndex];
        if (!sheet.rows) sheet.rows = [];
        const targetRow = sheet.rows[selected.rowIndex];
        if (!targetRow) return prev;
        if (!targetRow.cells) targetRow.cells = {};
        targetRow.cells[col.key] = afterCell;
        return clone;
      });

      setSaveState('saving');
      Api.updateWorkbookCell(workbookId, {
        sheetIndex: workingSheetIndex,
        rowIndex: selected.rowIndex,
        columnKey: col.key,
        ...parsed,
      })
        .then(() => setSaveState('saved'))
        .catch(() => setSaveState('error'));

      setEditingValue(null);

      const rowCount = activeRaw.rows?.length ?? 0;
      const colCount = activeRaw.columns?.length ?? 0;
      if (move === 'down') {
        setSelected({
          rowIndex: Math.min(selected.rowIndex + 1, Math.max(rowCount - 1, 0)),
          colIndex: selected.colIndex,
        });
      } else if (move === 'right') {
        setSelected({
          rowIndex: selected.rowIndex,
          colIndex: Math.min(selected.colIndex + 1, Math.max(colCount - 1, 0)),
        });
      }
    },
    [selected, activeRaw, workbookId, workingSheetIndex]
  );

  const startEditing = useCallback(
    (
      rowIndex: number,
      colIndex: number,
      initial?: string,
      focusTarget: 'cell' | 'formula' = 'cell'
    ) => {
      editFocusTargetRef.current = focusTarget;
      setSelected({ rowIndex, colIndex });
      const col = activeRaw?.columns?.[colIndex];
      const rawCell = col ? activeRaw?.rows?.[rowIndex]?.cells?.[col.key] : undefined;
      setEditingValue(initial ?? rawCellToEditText(rawCell));
    },
    [activeRaw]
  );

  const moveSelection = useCallback(
    (dRow: number, dCol: number) => {
      setSelected((prev) => {
        const rowCount = activeRaw?.rows?.length ?? 0;
        const colCount = activeRaw?.columns?.length ?? 0;
        if (rowCount === 0 || colCount === 0) return prev;
        const base = prev ?? { rowIndex: 0, colIndex: 0 };
        return {
          rowIndex: Math.max(0, Math.min(rowCount - 1, base.rowIndex + dRow)),
          colIndex: Math.max(0, Math.min(colCount - 1, base.colIndex + dCol)),
        };
      });
    },
    [activeRaw]
  );

  // Rdzeń nawigacji klawiaturowej — wydzielony z onKeyDown, żeby móc go wołać
  // z DWÓCH źródeł zdarzeń (patrz `useEffect` niżej i komentarz tam). Zwraca
  // `true`, gdy klawisz został obsłużony (caller wtedy robi preventDefault).
  const handleNavigationKey = useCallback(
    (key: string, modifiers: { ctrlKey: boolean; metaKey: boolean; altKey: boolean }): boolean => {
      if (editingValue !== null || !selected) return false;
      const command = modifiers.ctrlKey || modifiers.metaKey;
      if (command && key.toLowerCase() === 'z') {
        const changes = undoStackRef.current.pop();
        if (changes) {
          redoStackRef.current.push(changes);
          applyChanges(changes, 'before');
        }
        return true;
      }
      if (command && key.toLowerCase() === 'y') {
        const changes = redoStackRef.current.pop();
        if (changes) {
          undoStackRef.current.push(changes);
          applyChanges(changes, 'after');
        }
        return true;
      }
      switch (key) {
        case 'ArrowUp':
          moveSelection(-1, 0);
          return true;
        case 'ArrowDown':
          moveSelection(1, 0);
          return true;
        case 'ArrowLeft':
          moveSelection(0, -1);
          return true;
        case 'ArrowRight':
          moveSelection(0, 1);
          return true;
        case 'Enter':
        case 'F2':
          startEditing(selected.rowIndex, selected.colIndex);
          return true;
        case 'Delete':
        case 'Backspace':
          commit('', 'none');
          return true;
        default:
          if (key.length === 1 && !modifiers.ctrlKey && !modifiers.metaKey && !modifiers.altKey) {
            startEditing(selected.rowIndex, selected.colIndex, key);
            return true;
          }
          return false;
      }
    },
    [editingValue, selected, moveSelection, startEditing, commit, applyChanges]
  );

  const handleCopy = useCallback(
    (e: React.ClipboardEvent<HTMLDivElement>) => {
      if (!selectionRange) return;
      const lines: string[] = [];
      for (let ri = selectionRange.rowStart; ri <= selectionRange.rowEnd; ri += 1) {
        const values: string[] = [];
        for (let ci = selectionRange.colStart; ci <= selectionRange.colEnd; ci += 1) {
          const col = activeRaw?.columns?.[ci];
          values.push(rawCellToEditText(col ? activeRaw?.rows?.[ri]?.cells?.[col.key] : undefined));
        }
        lines.push(values.join('\t'));
      }
      e.clipboardData.setData('text/plain', lines.join('\n'));
      e.preventDefault();
    },
    [activeRaw, selectionRange]
  );

  const fillDown = useCallback(() => {
    if (!selectionRange || selectionRange.rowEnd <= selectionRange.rowStart || !activeRaw) return;
    const changes: CellChange[] = [];
    for (let ci = selectionRange.colStart; ci <= selectionRange.colEnd; ci += 1) {
      const col = activeRaw.columns?.[ci];
      if (!col) continue;
      const source = activeRaw.rows?.[selectionRange.rowStart]?.cells?.[col.key] ?? {};
      for (let ri = selectionRange.rowStart + 1; ri <= selectionRange.rowEnd; ri += 1) {
        const before = activeRaw.rows?.[ri]?.cells?.[col.key] ?? {};
        const delta = ri - selectionRange.rowStart;
        const after = { ...source };
        if (typeof after.formula === 'string') {
          after.formula = after.formula.replace(
            /(\$?[A-Z]+)(\$?)(\d+)/g,
            (_match, letters: string, absoluteRow: string, row: string) =>
              `${letters}${absoluteRow}${absoluteRow ? row : Number(row) + delta}`
          );
        }
        changes.push({ rowIndex: ri, colIndex: ci, before: { ...before }, after });
      }
    }
    if (!changes.length) return;
    undoStackRef.current.push(changes);
    redoStackRef.current = [];
    applyChanges(changes, 'after');
  }, [activeRaw, applyChanges, selectionRange]);

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLDivElement>) => {
      if (!selected || editingValue !== null || !activeRaw?.columns?.length) return;
      const matrix = e.clipboardData
        .getData('text/plain')
        .replace(/\r/g, '')
        .split('\n')
        .map((line) => line.split('\t'));
      const changes: CellChange[] = [];
      matrix.forEach((values, rowOffset) =>
        values.forEach((raw, colOffset) => {
          const rowIndex = selected.rowIndex + rowOffset;
          const colIndex = selected.colIndex + colOffset;
          const col = activeRaw.columns?.[colIndex];
          const row = activeRaw.rows?.[rowIndex];
          if (!col || !row) return;
          const before = row.cells?.[col.key] ?? {};
          changes.push({
            rowIndex,
            colIndex,
            before: { ...before },
            after: { ...before, ...parseCellInput(raw) },
          });
        })
      );
      if (!changes.length) return;
      undoStackRef.current.push(changes);
      redoStackRef.current = [];
      applyChanges(changes, 'after');
      e.preventDefault();
    },
    [activeRaw, applyChanges, editingValue, selected]
  );

  const handleContainerKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const handled = handleNavigationKey(e.key, {
        ctrlKey: e.ctrlKey,
        metaKey: e.metaKey,
        altKey: e.altKey,
      });
      if (handled) e.preventDefault();
    },
    [handleNavigationKey]
  );

  // Zabezpieczenie skupienia (odkryte w render-verify 2026-07-28): klik na
  // `<td>` (element nie-fokusowalny) w niektórych ścieżkach zdarzeń NIE
  // przenosi fokusu DOM na kontener nawet po `containerRef.current?.focus()`
  // (np. gdy zdarzenie klawiatury zostało wygenerowane programowo i trafia w
  // `document.body`, nie w aktualnie "aktywny" element). Nasłuch na poziomie
  // dokumentu jest DODATKOWĄ siecią bezpieczeństwa obok `onKeyDown` na
  // kontenerze (który obsługuje normalne, w pełni zogniskowane wpisywanie z
  // klawiatury) — działa WYŁĄCZNIE gdy jest zaznaczona komórka i fokus leży
  // na samym kontenerze/na `<body>` (nigdy gdy fokus jest w innym polu
  // edytowalnym, np. czacie Teresy obok — to by ukradło mu klawisze).
  useEffect(() => {
    if (!selected || editingValue !== null) return undefined;
    const onDocKeyDown = (e: KeyboardEvent) => {
      const active = document.activeElement;
      const safeTarget =
        active === containerRef.current || active === document.body || active === null;
      if (!safeTarget) return;
      const handled = handleNavigationKey(e.key, {
        ctrlKey: e.ctrlKey,
        metaKey: e.metaKey,
        altKey: e.altKey,
      });
      if (handled) e.preventDefault();
    };
    document.addEventListener('keydown', onDocKeyDown, true);
    return () => document.removeEventListener('keydown', onDocKeyDown, true);
  }, [selected, editingValue, handleNavigationKey]);

  const handleEditingKey = useCallback(
    (key: string): boolean => {
      if (key === 'Enter') {
        commit(editingValue ?? '', 'down');
        return true;
      }
      if (key === 'Tab') {
        commit(editingValue ?? '', 'right');
        return true;
      }
      if (key === 'Escape') {
        setEditingValue(null);
        return true;
      }
      return false;
    },
    [commit, editingValue]
  );

  const handleInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (handleEditingKey(e.key)) e.preventDefault();
    },
    [handleEditingKey]
  );

  // Ta sama siec bezpieczenstwa co dla nawigacji (patrz komentarz wyzej) -
  // Enter/Tab/Escape podczas edycji tez musza dzialac, gdy zdarzenie
  // klawiatury trafia w `document.body` zamiast w realnie zogniskowany
  // `<input>` (obserwowane w harnessie render-verify).
  useEffect(() => {
    if (editingValue === null) return undefined;
    const onDocKeyDown = (e: KeyboardEvent) => {
      const active = document.activeElement;
      const safeTarget = active === inputRef.current || active === document.body || active === null;
      if (!safeTarget) return;
      if (handleEditingKey(e.key)) e.preventDefault();
    };
    document.addEventListener('keydown', onDocKeyDown, true);
    return () => document.removeEventListener('keydown', onDocKeyDown, true);
  }, [editingValue, handleEditingKey]);

  if (!activeRaw?.columns?.length) return null;

  const columns = activeRaw.columns;
  const rows = activeComputed?.rows ?? [];
  const visibleRows = showAllRows ? rows : rows.slice(0, rowCap);

  const formulaBarText =
    selected && editingValue !== null
      ? editingValue
      : selected
        ? rawCellToEditText(
            activeRaw.rows?.[selected.rowIndex]?.cells?.[columns[selected.colIndex]?.key ?? '']
          )
        : '';
  const formulaBarAddress = selected
    ? `${activeRaw.name || ''}!${colIndexToLetter(selected.colIndex)}${excelRowForDataRowIndex(selected.rowIndex)}`
    : '';

  return (
    <div className="bg-c-surface rounded-hig-md border border-c-border-subtle overflow-hidden">
      <div
        className="flex flex-wrap items-center gap-1.5 px-3 py-2 border-b border-c-border-subtle bg-c-surface-raised"
        role="toolbar"
        aria-label={t('kimi.excele.structureToolbar', 'Workbook editing tools')}
      >
        <button
          type="button"
          onClick={() => {
            setDialogValue('');
            setDialogMode('renameWorkbook');
          }}
          className="h-8 px-2 rounded-hig-xs hover:bg-c-border-subtle text-xs"
        >
          {t('kimi.excele.renameWorkbook', 'Rename workbook')}
        </button>
        <button
          type="button"
          onClick={() => {
            setDialogValue('');
            setDialogValue2('');
            setDialogMode('findReplace');
          }}
          className="h-8 px-2 rounded-hig-xs hover:bg-c-border-subtle"
          aria-label={t('kimi.excele.findReplace', 'Find and replace')}
        >
          <Search size={14} />
        </button>
        <label className="sr-only" htmlFor={`workbook-sheet-${workbookId}`}>
          {t('kimi.excele.activeSheet', 'Active sheet')}
        </label>
        <select
          id={`workbook-sheet-${workbookId}`}
          value={workingSheetIndex}
          onChange={(e) => {
            setWorkingSheetIndex(Number(e.target.value));
            setSelected(null);
          }}
          className="h-8 max-w-44 rounded-hig-xs border border-c-border-subtle bg-c-surface px-2 text-xs text-c-text"
        >
          {localSheets.map((sheet, index) => (
            <option key={`${sheet.name}-${index}`} value={index}>
              {sheet.name || `Sheet ${index + 1}`}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() =>
            void runSchemaCommand({ type: 'addSheet', name: `Sheet ${localSheets.length + 1}` })
          }
          className="h-8 px-2 rounded-hig-xs hover:bg-c-border-subtle text-xs"
          aria-label={t('kimi.excele.addSheet', 'Add sheet')}
        >
          <Plus size={14} />
        </button>
        <button
          type="button"
          onClick={() => {
            setDialogValue(activeRaw?.name || '');
            setDialogMode('rename');
          }}
          className="h-8 px-2 rounded-hig-xs hover:bg-c-border-subtle text-xs"
        >
          {t('kimi.excele.rename', 'Rename')}
        </button>
        <button
          type="button"
          onClick={() =>
            void runSchemaCommand({ type: 'duplicateSheet', sheetIndex: workingSheetIndex })
          }
          className="h-8 px-2 rounded-hig-xs hover:bg-c-border-subtle"
          aria-label={t('kimi.excele.duplicateSheet', 'Duplicate sheet')}
        >
          <Copy size={14} />
        </button>
        <button
          type="button"
          disabled={localSheets.length <= 1}
          onClick={() => setDialogMode('delete')}
          className="h-8 px-2 rounded-hig-xs hover:bg-c-danger/10 disabled:opacity-40"
          aria-label={t('kimi.excele.deleteSheet', 'Delete sheet')}
        >
          <Trash2 size={14} />
        </button>
        <span className="mx-1 h-5 w-px bg-c-border-subtle" aria-hidden="true" />
        <button
          type="button"
          onClick={() =>
            void runSchemaCommand({
              type: 'insertRow',
              sheetIndex: workingSheetIndex,
              rowIndex: selected?.rowIndex ?? activeRaw.rows?.length ?? 0,
            })
          }
          className="h-8 px-2 rounded-hig-xs hover:bg-c-border-subtle"
          aria-label={t('kimi.excele.insertRow', 'Insert row')}
        >
          <Rows3 size={14} />
          <Plus size={9} className="inline" />
        </button>
        <button
          type="button"
          disabled={!selected}
          onClick={() =>
            selected &&
            void runSchemaCommand({
              type: 'deleteRow',
              sheetIndex: workingSheetIndex,
              rowIndex: selected.rowIndex,
            })
          }
          className="h-8 px-2 rounded-hig-xs hover:bg-c-danger/10 disabled:opacity-40"
          aria-label={t('kimi.excele.deleteRow', 'Delete selected row')}
        >
          <Rows3 size={14} />
          <Trash2 size={9} className="inline" />
        </button>
        <button
          type="button"
          onClick={() =>
            void runSchemaCommand({
              type: 'insertColumn',
              sheetIndex: workingSheetIndex,
              colIndex: selected?.colIndex ?? activeRaw.columns?.length ?? 0,
              header: t('kimi.excele.newColumn', 'New column'),
            })
          }
          className="h-8 px-2 rounded-hig-xs hover:bg-c-border-subtle"
          aria-label={t('kimi.excele.insertColumn', 'Insert column')}
        >
          <Columns3 size={14} />
          <Plus size={9} className="inline" />
        </button>
        <button
          type="button"
          disabled={!selected || (activeRaw.columns?.length ?? 0) <= 1}
          onClick={() =>
            selected &&
            void runSchemaCommand({
              type: 'deleteColumn',
              sheetIndex: workingSheetIndex,
              colIndex: selected.colIndex,
            })
          }
          className="h-8 px-2 rounded-hig-xs hover:bg-c-danger/10 disabled:opacity-40"
          aria-label={t('kimi.excele.deleteColumn', 'Delete selected column')}
        >
          <Columns3 size={14} />
          <Trash2 size={9} className="inline" />
        </button>
        <button
          type="button"
          disabled={!selected}
          onClick={() => {
            setDialogValue(String(activeRaw.columns?.[selected?.colIndex || 0]?.width || 16));
            setDialogValue2(String(activeRaw.rows?.[selected?.rowIndex || 0]?.height || 20));
            setDialogMode('resize');
          }}
          className="h-8 px-2 rounded-hig-xs hover:bg-c-border-subtle disabled:opacity-40"
          aria-label={t('kimi.excele.resize', 'Resize selected row and column')}
        >
          <Ruler size={14} />
        </button>
        <span className="mx-1 h-5 w-px bg-c-border-subtle" aria-hidden="true" />
        <button
          type="button"
          disabled={!selected}
          onClick={() =>
            selected &&
            void runSchemaCommand({
              type: 'formatCells',
              sheetIndex: workingSheetIndex,
              rowIndexes: [selected.rowIndex],
              colIndexes: [selected.colIndex],
              style: {
                bold: !Boolean(
                  activeRaw.rows?.[selected.rowIndex]?.cells?.[
                    activeRaw.columns?.[selected.colIndex]?.key || ''
                  ]?.style?.bold
                ),
              },
            })
          }
          className="h-8 px-2 rounded-hig-xs hover:bg-c-border-subtle disabled:opacity-40"
          aria-label={t('kimi.excele.bold', 'Toggle bold')}
        >
          <Bold size={14} />
        </button>
        <button
          type="button"
          disabled={!selected}
          onClick={() =>
            selected &&
            void runSchemaCommand({
              type: 'formatCells',
              sheetIndex: workingSheetIndex,
              rowIndexes: [selected.rowIndex],
              colIndexes: [selected.colIndex],
              style: { italic: true },
            })
          }
          className="h-8 px-2 rounded-hig-xs hover:bg-c-border-subtle disabled:opacity-40"
          aria-label={t('kimi.excele.italic', 'Toggle italic')}
        >
          <Italic size={14} />
        </button>
        <button
          type="button"
          disabled={!selected}
          onClick={() =>
            selected &&
            void runSchemaCommand({
              type: 'formatCells',
              sheetIndex: workingSheetIndex,
              rowIndexes: [selected.rowIndex],
              colIndexes: [selected.colIndex],
              style: { underline: true },
            })
          }
          className="h-8 px-2 rounded-hig-xs hover:bg-c-border-subtle disabled:opacity-40"
          aria-label={t('kimi.excele.underline', 'Toggle underline')}
        >
          <Underline size={14} />
        </button>
        <button
          type="button"
          disabled={!selected}
          onClick={() =>
            selected &&
            void runSchemaCommand({
              type: 'formatCells',
              sheetIndex: workingSheetIndex,
              rowIndexes: [selected.rowIndex],
              colIndexes: [selected.colIndex],
              style: { bgColor: 'FFF2CC' },
            })
          }
          className="h-8 px-2 rounded-hig-xs hover:bg-c-border-subtle disabled:opacity-40"
          aria-label={t('kimi.excele.fillColor', 'Apply highlight fill')}
        >
          <PaintBucket size={14} />
        </button>
        <button
          type="button"
          disabled={!selected}
          onClick={() =>
            selected &&
            void runSchemaCommand({
              type: 'formatCells',
              sheetIndex: workingSheetIndex,
              rowIndexes: [selected.rowIndex],
              colIndexes: [selected.colIndex],
              style: { wrapText: true, border: 'thin' },
            })
          }
          className="h-8 px-2 rounded-hig-xs hover:bg-c-border-subtle disabled:opacity-40"
          aria-label={t('kimi.excele.wrapBorder', 'Wrap text and apply border')}
        >
          <WrapText size={14} />
        </button>
        <select
          aria-label={t('kimi.excele.alignment', 'Text alignment')}
          disabled={!selected}
          defaultValue=""
          onChange={(e) => {
            if (selected && e.target.value)
              void runSchemaCommand({
                type: 'formatCells',
                sheetIndex: workingSheetIndex,
                rowIndexes: [selected.rowIndex],
                colIndexes: [selected.colIndex],
                style: { alignment: e.target.value },
              });
            e.target.value = '';
          }}
          className="h-8 rounded-hig-xs border border-c-border-subtle bg-c-surface px-2 text-xs disabled:opacity-40"
        >
          <option value="">{t('kimi.excele.align', 'Align')}</option>
          <option value="left">Left</option>
          <option value="center">Center</option>
          <option value="right">Right</option>
        </select>
        <select
          aria-label={t('kimi.excele.numberFormat', 'Number format')}
          disabled={!selected}
          defaultValue=""
          onChange={(e) => {
            if (selected && e.target.value)
              void runSchemaCommand({
                type: 'formatCells',
                sheetIndex: workingSheetIndex,
                rowIndexes: [selected.rowIndex],
                colIndexes: [selected.colIndex],
                style: { numberFormat: e.target.value },
              });
            e.target.value = '';
          }}
          className="h-8 rounded-hig-xs border border-c-border-subtle bg-c-surface px-2 text-xs disabled:opacity-40"
        >
          <option value="">{t('kimi.excele.format', 'Format')}</option>
          <option value="# ##0.00">Number</option>
          <option value="# ##0.00 [$EUR]">EUR</option>
          <option value="0.0%">%</option>
          <option value="yyyy-mm-dd">Date</option>
        </select>
        <span className="mx-1 h-5 w-px bg-c-border-subtle" aria-hidden="true" />
        <button
          type="button"
          disabled={!selected}
          onClick={() =>
            selected &&
            void runSchemaCommand({
              type: 'sortRows',
              sheetIndex: workingSheetIndex,
              colIndex: selected.colIndex,
              direction: 'asc',
            })
          }
          className="h-8 px-2 rounded-hig-xs hover:bg-c-border-subtle disabled:opacity-40"
          aria-label={t('kimi.excele.sortAsc', 'Sort ascending')}
        >
          <ArrowDownAZ size={14} />
        </button>
        <button
          type="button"
          disabled={!selected}
          onClick={() =>
            selected &&
            void runSchemaCommand({
              type: 'sortRows',
              sheetIndex: workingSheetIndex,
              colIndex: selected.colIndex,
              direction: 'desc',
            })
          }
          className="h-8 px-2 rounded-hig-xs hover:bg-c-border-subtle disabled:opacity-40"
          aria-label={t('kimi.excele.sortDesc', 'Sort descending')}
        >
          <ArrowUpAZ size={14} />
        </button>
        <button
          type="button"
          onClick={() =>
            void runSchemaCommand({
              type: 'setAutoFilter',
              sheetIndex: workingSheetIndex,
              enabled: !Boolean((activeRaw as any).autoFilter),
            })
          }
          className="h-8 px-2 rounded-hig-xs hover:bg-c-border-subtle"
          aria-label={t('kimi.excele.toggleFilter', 'Toggle header filters')}
          aria-pressed={Boolean((activeRaw as any).autoFilter)}
        >
          <Filter size={14} />
        </button>
        <button
          type="button"
          onClick={() =>
            void runSchemaCommand({
              type: 'setFreeze',
              sheetIndex: workingSheetIndex,
              freezeRow: (activeRaw as any).freezeRow ? 0 : 1,
              freezeCol: Number((activeRaw as any).freezeCol || 0),
            })
          }
          className="h-8 px-2 rounded-hig-xs hover:bg-c-border-subtle"
          aria-label={t('kimi.excele.toggleFreeze', 'Toggle frozen header')}
          aria-pressed={Boolean((activeRaw as any).freezeRow)}
        >
          <Snowflake size={14} />
        </button>
        <button
          type="button"
          disabled={!selected}
          onClick={() => {
            setDialogValue('Yes,No');
            setDialogMode('validation');
          }}
          className="h-8 px-2 rounded-hig-xs hover:bg-c-border-subtle disabled:opacity-40"
          aria-label={t('kimi.excele.validation', 'Set dropdown validation')}
        >
          <ListChecks size={14} />
        </button>
        <button
          type="button"
          disabled={!selected}
          onClick={() => {
            const col = selected ? activeRaw.columns?.[selected.colIndex] : null;
            setDialogValue(
              col && selected
                ? String(activeRaw.rows?.[selected.rowIndex]?.cells?.[col.key]?.comment || '')
                : ''
            );
            setDialogMode('comment');
          }}
          className="h-8 px-2 rounded-hig-xs hover:bg-c-border-subtle disabled:opacity-40"
          aria-label={t('kimi.excele.comment', 'Add or edit comment')}
        >
          <MessageSquare size={14} />
        </button>
        <button
          type="button"
          disabled={!selectionRange || selectionRange.rowEnd <= selectionRange.rowStart}
          onClick={fillDown}
          className="h-8 px-2 rounded-hig-xs hover:bg-c-border-subtle disabled:opacity-40"
          aria-label={t('kimi.excele.fillDown', 'Fill selected range down')}
        >
          <ChevronsDown size={14} />
        </button>
        <button
          type="button"
          onClick={() => setDialogMode('help')}
          className="h-8 px-2 rounded-hig-xs hover:bg-c-border-subtle"
          aria-label={t('kimi.excele.shortcutHelp', 'Keyboard shortcuts')}
        >
          <HelpCircle size={14} />
        </button>
      </div>
      {dialogMode && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="workbook-command-title"
          className="border-b border-c-border-subtle bg-c-surface px-4 py-3"
        >
          <h3 id="workbook-command-title" className="text-sm font-semibold text-c-text">
            {dialogMode === 'rename'
              ? t('kimi.excele.renameSheet', 'Rename sheet')
              : dialogMode === 'renameWorkbook'
                ? t('kimi.excele.renameWorkbook', 'Rename workbook')
                : dialogMode === 'delete'
                  ? t('kimi.excele.deleteSheet', 'Delete sheet')
                  : dialogMode === 'findReplace'
                    ? t('kimi.excele.findReplace', 'Find and replace')
                    : dialogMode === 'resize'
                      ? t('kimi.excele.resize', 'Resize selected row and column')
                      : dialogMode === 'comment'
                        ? t('kimi.excele.comment', 'Add or edit comment')
                        : dialogMode === 'help'
                          ? t('kimi.excele.shortcutHelp', 'Keyboard shortcuts')
                          : t('kimi.excele.validation', 'Set dropdown validation')}
          </h3>
          {dialogMode === 'help' ? (
            <ul className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-c-text-secondary">
              <li>Enter / F2 — Edit cell</li>
              <li>Esc — Cancel edit</li>
              <li>Arrow keys — Move selection</li>
              <li>Shift+click — Select range</li>
              <li>Cmd/Ctrl+C — Copy</li>
              <li>Cmd/Ctrl+V — Paste</li>
              <li>Cmd/Ctrl+Z — Undo</li>
              <li>Cmd/Ctrl+Y — Redo</li>
              <li>Delete — Clear cell</li>
              <li>Tab — Save and move right</li>
            </ul>
          ) : dialogMode === 'delete' ? (
            <p className="mt-1 text-xs text-c-text-secondary">
              {t(
                'kimi.excele.deleteSheetConfirm',
                'Delete this sheet? This action can be restored from version history.'
              )}
            </p>
          ) : (
            <label className="mt-2 block text-xs text-c-text-secondary">
              {dialogMode === 'rename'
                ? t('kimi.excele.sheetName', 'Sheet name')
                : dialogMode === 'renameWorkbook'
                  ? t('kimi.excele.workbookName', 'Workbook name')
                  : dialogMode === 'findReplace'
                    ? t('kimi.excele.find', 'Find')
                    : dialogMode === 'resize'
                      ? t('kimi.excele.columnWidth', 'Column width')
                      : dialogMode === 'comment'
                        ? t('kimi.excele.commentText', 'Comment')
                        : t('kimi.excele.allowedValues', 'Allowed values, separated by commas')}
              <input
                autoFocus
                aria-label={
                  dialogMode === 'rename'
                    ? t('kimi.excele.sheetName', 'Sheet name')
                    : dialogMode === 'renameWorkbook'
                      ? t('kimi.excele.workbookName', 'Workbook name')
                      : dialogMode === 'findReplace'
                        ? t('kimi.excele.find', 'Find')
                        : dialogMode === 'resize'
                          ? t('kimi.excele.columnWidth', 'Column width')
                          : dialogMode === 'comment'
                            ? t('kimi.excele.commentText', 'Comment')
                            : t('kimi.excele.allowedValues', 'Allowed values, separated by commas')
                }
                value={dialogValue}
                onChange={(e) => setDialogValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setDialogMode(null);
                }}
                className="mt-1 h-8 w-full rounded-hig-xs border border-c-border-subtle bg-c-surface-raised px-2 text-sm text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus"
              />
              {(dialogMode === 'findReplace' || dialogMode === 'resize') && (
                <>
                  <span className="mt-2 block">
                    {dialogMode === 'findReplace'
                      ? t('kimi.excele.replaceWith', 'Replace with')
                      : t('kimi.excele.rowHeight', 'Row height')}
                  </span>
                  <input
                    aria-label={
                      dialogMode === 'findReplace'
                        ? t('kimi.excele.replaceWith', 'Replace with')
                        : t('kimi.excele.rowHeight', 'Row height')
                    }
                    value={dialogValue2}
                    onChange={(e) => setDialogValue2(e.target.value)}
                    className="mt-1 h-8 w-full rounded-hig-xs border border-c-border-subtle bg-c-surface-raised px-2 text-sm text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus"
                  />
                </>
              )}
            </label>
          )}
          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setDialogMode(null)}
              className="h-8 rounded-hig-xs px-3 text-xs hover:bg-c-border-subtle"
            >
              {t('common.cancel', 'Cancel')}
            </button>
            {dialogMode !== 'help' && (
              <button
                type="button"
                disabled={
                  dialogMode !== 'delete' && dialogMode !== 'comment' && !dialogValue.trim()
                }
                onClick={() => {
                  if (dialogMode === 'rename')
                    void runSchemaCommand({
                      type: 'renameSheet',
                      sheetIndex: workingSheetIndex,
                      name: dialogValue.trim(),
                    });
                  else if (dialogMode === 'renameWorkbook')
                    void runSchemaCommand({ type: 'renameWorkbook', title: dialogValue.trim() });
                  else if (dialogMode === 'delete')
                    void runSchemaCommand({ type: 'deleteSheet', sheetIndex: workingSheetIndex });
                  else if (dialogMode === 'validation' && selected)
                    void runSchemaCommand({
                      type: 'setValidation',
                      sheetIndex: workingSheetIndex,
                      rowIndex: selected.rowIndex,
                      colIndex: selected.colIndex,
                      validation: {
                        type: 'list',
                        values: dialogValue
                          .split(',')
                          .map((v) => v.trim())
                          .filter(Boolean),
                      },
                    });
                  else if (dialogMode === 'findReplace')
                    void runSchemaCommand({
                      type: 'findReplace',
                      find: dialogValue,
                      replacement: dialogValue2,
                    });
                  else if (dialogMode === 'resize' && selected) {
                    void runSchemaCommand({
                      type: 'resizeRowAndColumn',
                      sheetIndex: workingSheetIndex,
                      colIndex: selected.colIndex,
                      rowIndex: selected.rowIndex,
                      width: Number(dialogValue),
                      height: Number(dialogValue2),
                    });
                  } else if (dialogMode === 'comment' && selected)
                    void runSchemaCommand({
                      type: 'setComment',
                      sheetIndex: workingSheetIndex,
                      rowIndex: selected.rowIndex,
                      colIndex: selected.colIndex,
                      comment: dialogValue,
                    });
                  setDialogMode(null);
                }}
                className="h-8 rounded-hig-xs bg-c-primary px-3 text-xs font-medium text-white disabled:opacity-40"
              >
                {dialogMode === 'delete' ? t('common.delete', 'Delete') : t('common.save', 'Save')}
              </button>
            )}
          </div>
        </div>
      )}
      {/* Pasek formuły — pokazuje, co REALNIE siedzi w komórce (wartość vs
          formuła), nie wynik. To jest sedno dla właściciela — patrz nagłówek
          pliku i specyfikacja zadania. */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-c-border-subtle bg-c-surface-raised">
        <span className="shrink-0 min-w-[64px] text-[11px] font-mono text-c-text-secondary text-center px-1.5 py-0.5 rounded bg-c-surface border border-c-border-subtle">
          {formulaBarAddress || '—'}
        </span>
        <input
          data-testid="workbook-formula-bar"
          type="text"
          value={formulaBarText}
          readOnly={!selected}
          onFocus={() => {
            if (selected && editingValue === null) {
              startEditing(selected.rowIndex, selected.colIndex, undefined, 'formula');
            }
          }}
          onChange={(e) => setEditingValue(e.target.value)}
          onKeyDown={handleInputKeyDown}
          onBlur={() => {
            if (editingValue !== null) commit(editingValue, 'none');
          }}
          placeholder={t('kimi.excele.formulaBarEmpty', 'Zaznacz komórkę, aby zobaczyć jej treść')}
          className="flex-1 min-w-0 bg-transparent text-xs font-mono text-c-text focus:outline-none"
        />
        <span
          className="shrink-0 flex items-center gap-1 text-[11px] text-c-text-secondary"
          aria-live="polite"
        >
          {saveState === 'saving' && (
            <>
              <Loader2 size={11} className="animate-spin" />
              {t('kimi.excele.saving', 'Zapisywanie…')}
            </>
          )}
          {saveState === 'saved' && (
            <>
              <Check size={11} className="text-c-success" />
              {t('kimi.excele.saved', 'Zapisano')}
            </>
          )}
          {saveState === 'error' && (
            <>
              <AlertTriangle size={11} className="text-c-danger" />
              <span title={saveError || undefined}>
                {saveError || t('kimi.excele.saveFailed', 'Błąd zapisu')}
              </span>
              {lastSchemaCommandRef.current && (
                <button
                  type="button"
                  onClick={() => void runSchemaCommand(lastSchemaCommandRef.current!)}
                  className="underline font-medium"
                >
                  {t('kimi.excele.retry', 'Retry')}
                </button>
              )}
            </>
          )}
        </span>
      </div>

      <div
        data-testid="editable-spreadsheet-grid"
        ref={containerRef}
        role="grid"
        aria-label={t('kimi.excele.grid', 'Editable spreadsheet grid')}
        aria-rowcount={(activeRaw.rows?.length ?? 0) + 1}
        aria-colcount={columns.length}
        className="overflow-x-auto max-h-[520px] overflow-y-auto focus:outline-none"
        onKeyDown={handleContainerKeyDown}
        onCopy={handleCopy}
        onPaste={handlePaste}
        tabIndex={0}
      >
        {/* prettier-ignore */}
        <table role="presentation" className="w-full text-xs" /* §27-exempt: edytor komorkowy/arkusz, edycja cell-by-cell — docs/ui-standards/DOKTRYNA_TABELA_NIE_EXCEL.md */>
          <thead className="sticky top-0 z-10">
            <tr className="bg-c-surface-raised">
              {columns.map((col, ci) => (
                <th
                  key={`${col.key}-${ci}`}
                  style={{ width: typeof col.width === 'number' ? `${col.width * 8}px` : undefined }}
                  className="px-3 py-2 text-left font-medium text-c-text-secondary border-b border-c-border-subtle whitespace-nowrap"
                >
                  {col.header || col.key}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row, ri) => (
              <tr key={ri} style={{ height: typeof row.height === 'number' ? `${row.height}px` : undefined }} className="border-b border-c-border-subtle hover:bg-c-surface-raised">
                {columns.map((col, ci) => {
                  const cell: ComputedCell | undefined = row.cells[col.key];
                  const rawCell = activeRaw.rows?.[ri]?.cells?.[col.key];
                  const isSelected = selected?.rowIndex === ri && selected?.colIndex === ci;
                  const isEditingThis = isSelected && editingValue !== null;
                  const isNegativeVariance = isNegativeVarianceCell(
                    activeRaw.name || '',
                    col.header || col.key,
                    cell?.computed
                  );
                  return (
                    <td
                      role="gridcell"
                      aria-rowindex={ri + 2}
                      aria-colindex={ci + 1}
                      aria-selected={selectionRange ? ri >= selectionRange.rowStart && ri <= selectionRange.rowEnd && ci >= selectionRange.colStart && ci <= selectionRange.colEnd : false}
                      aria-label={`${colIndexToLetter(ci)}${excelRowForDataRowIndex(ri)} ${formatComputedForDisplay(cell)}`}
                      data-testid={`workbook-cell-${ri}-${col.key}`}
                      style={{
                        width: typeof col.width === 'number' ? `${col.width * 8}px` : undefined,
                        ...cellPresentationStyle(rawCell),
                      }}
                      key={`${col.key}-${ci}`}
                      onClick={(event) => {
                        if (event.shiftKey && selected) setSelectionEnd({ rowIndex: ri, colIndex: ci });
                        else { setSelected({ rowIndex: ri, colIndex: ci }); setSelectionEnd(null); }
                        // Fokus SYNCHRONICZNIE w momencie kliknięcia (nie
                        // czekając na useEffect po renderze) — <td> nie jest
                        // fokusowalny, więc bez tego strzałka/Enter naciśnięte
                        // od razu po kliknięciu mogą trafić w domyślny fokus
                        // przeglądarki (body) zamiast w kontener siatki.
                        containerRef.current?.focus();
                      }}
                      onDoubleClick={() => startEditing(ri, ci)}
                      className={`relative px-3 py-1.5 whitespace-nowrap max-w-[220px] truncate cursor-cell ${
                        isNegativeVariance
                          ? 'bg-c-danger/10 text-c-danger font-semibold'
                          : cell?.error
                          ? 'text-c-danger font-mono'
                          : cell?.isFormula
                            ? 'font-mono text-c-text-secondary'
                            : 'text-c-text'
                      } ${selectionRange && ri >= selectionRange.rowStart && ri <= selectionRange.rowEnd && ci >= selectionRange.colStart && ci <= selectionRange.colEnd ? 'outline outline-2 outline-c-focus outline-offset-[-2px]' : ''}`}
                    >
                      {isEditingThis ? (
                        <input
                          ref={inputRef}
                          type="text"
                          value={editingValue ?? ''}
                          onChange={(e) => setEditingValue(e.target.value)}
                          onKeyDown={handleInputKeyDown}
                          onBlur={() => commit(editingValue ?? '', 'none')}
                          className="absolute inset-0 w-full h-full px-3 bg-c-surface text-c-text text-xs font-mono focus:outline-none"
                        />
                      ) : (
                        <>
                          {formatComputedForDisplay(cell)}
                          {rawCell?.comment ? (
                            <span
                              aria-label={t('kimi.excele.hasComment', 'Has comment')}
                              title={String(rawCell.comment)}
                              className="absolute right-0 top-0 h-0 w-0 border-l-[7px] border-l-transparent border-t-[7px] border-t-c-focus"
                            />
                          ) : null}
                        </>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rows.length > rowCap && (
        <div className="px-3 py-2 flex items-center justify-center gap-3 text-xs text-c-text-secondary border-t border-c-border-subtle">
          <span>
            {showAllRows
              ? t('kimi.showingAllRows', 'Showing all {{total}} rows', { total: rows.length })
              : t('kimi.showingRows', 'Showing first {{cap}} of {{total}} rows', {
                  cap: rowCap,
                  total: rows.length,
                })}
          </span>
          {!showAllRows && (
            <button
              type="button"
              onClick={() => setShowAllRows(true)}
              className="px-2 py-0.5 rounded-hig-xs font-medium text-c-text hover:bg-c-border-subtle transition-colors"
            >
              {t('kimi.showAllRows', 'Show all')}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default EditableSpreadsheetGrid;
