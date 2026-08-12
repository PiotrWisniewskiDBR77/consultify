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

import { AlertTriangle, Check, Loader2 } from 'lucide-react';
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

export interface SpreadsheetCellSelection {
  rowIndex: number;
  colIndex: number;
  endRowIndex?: number;
  endColIndex?: number;
  kind?: 'cell' | 'range' | 'row' | 'column';
  address: string;
  rawValue: string;
}

interface Selection {
  rowIndex: number;
  colIndex: number;
  endRowIndex?: number;
  endColIndex?: number;
  kind?: 'cell' | 'range' | 'row' | 'column';
}

export type SpreadsheetSaveState = 'idle' | 'saving' | 'saved' | 'error';

export interface EditableSpreadsheetGridHandle {
  editSelectedCell: () => void;
  clearSelectedCell: () => void;
  copySelection: () => Promise<void>;
  cutSelection: () => Promise<void>;
  pasteSelection: () => Promise<void>;
  undo: () => void;
  redo: () => void;
  selectCell: (rowIndex: number, colIndex: number) => void;
}

export interface SpreadsheetHistoryState {
  canUndo: boolean;
  canRedo: boolean;
}

interface CellChange {
  rowIndex: number;
  colIndex: number;
  before: string;
  after: string;
}

interface Props {
  workbookId: string;
  /** WSZYSTKIE arkusze skoroszytu (formuły cross-sheet muszą widzieć każdy). */
  sheets: FormulaSheet[];
  activeSheetIndex: number;
  /** Maks. liczba wierszy renderowanych naraz — spójne z resztą podglądu
   *  (GRID_ROW_CAP w KimiWorkspaceShell), niezależny toggle "pokaż wszystkie". */
  rowCap?: number;
  onSelectionChange?: (selection: SpreadsheetCellSelection | null) => void;
  onSelectionContextMenu?: (payload: {
    x: number;
    y: number;
    selection: SpreadsheetCellSelection;
  }) => void;
  onSaveStateChange?: (state: SpreadsheetSaveState) => void;
  onHistoryStateChange?: (state: SpreadsheetHistoryState) => void;
  onSheetsChange?: (sheets: FormulaSheet[]) => void;
  freezeFirstColumn?: boolean;
  /** New shell injects versioned command persistence; legacy callers keep PATCH compatibility. */
  persistCell?: (payload: {
    sheetIndex: number;
    rowIndex: number;
    columnKey: string;
    value?: string | number | boolean | null;
    formula?: string;
  }) => Promise<void>;
  persistCells?: (payloads: Array<{
    sheetIndex: number;
    rowIndex: number;
    columnKey: string;
    value?: string | number | boolean | null;
    formula?: string;
  }>) => Promise<void>;
}

function cloneSheets(sheets: FormulaSheet[]): FormulaSheet[] {
  // Głęboka kopia robocza — JSON round-trip jest tu wystarczający (schemat to
  // czyste dane: liczby/stringi/booleany/null, bez dat czy funkcji).
  return JSON.parse(JSON.stringify(sheets));
}

export const EditableSpreadsheetGrid = React.forwardRef<EditableSpreadsheetGridHandle, Props>(
  (
    {
      workbookId,
      sheets,
      activeSheetIndex,
      rowCap = 100,
      freezeFirstColumn = false,
      onSelectionChange,
      onSelectionContextMenu,
      onSaveStateChange,
      onHistoryStateChange,
      onSheetsChange,
      persistCell,
      persistCells,
    },
    ref
  ) => {
    const { t } = useTranslation();
    const [localSheets, setLocalSheets] = useState<FormulaSheet[]>(() => cloneSheets(sheets));
    const [selected, setSelected] = useState<Selection | null>(null);
    const [editingValue, setEditingValue] = useState<string | null>(null);
    const [showAllRows, setShowAllRows] = useState(false);
    const [saveState, setSaveState] = useState<SpreadsheetSaveState>('idle');
    const inputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const undoStackRef = useRef<CellChange[][]>([]);
    const redoStackRef = useRef<CellChange[][]>([]);

    const publishHistoryState = useCallback(() => {
      onHistoryStateChange?.({
        canUndo: undoStackRef.current.length > 0,
        canRedo: redoStackRef.current.length > 0,
      });
    }, [onHistoryStateChange]);

    // Nowy skoroszyt (reopen na inny id) → zacznij od świeżych danych serwera;
    // edycje w toku dla POPRZEDNIEGO workbookId nigdy nie mieszają się z nowym.
    useEffect(() => {
      setLocalSheets(cloneSheets(sheets));
      setSelected(null);
      setEditingValue(null);
      setSaveState('idle');
      undoStackRef.current = [];
      redoStackRef.current = [];
      publishHistoryState();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [workbookId, publishHistoryState]);

    // The Artifact Studio adapter owns the authoritative workbook snapshot.
    // Keep the renderer current after structural/version restores without
    // conflating that synchronization with a new workbook session.
    useEffect(() => {
      setLocalSheets(cloneSheets(sheets));
    }, [sheets]);

    // Zmiana zakładki arkusza → zaznaczenie z poprzedniego arkusza nie ma sensu.
    useEffect(() => {
      setSelected(null);
      setEditingValue(null);
      undoStackRef.current = [];
      redoStackRef.current = [];
      publishHistoryState();
    }, [activeSheetIndex, publishHistoryState]);

    const computedSheets = useMemo(() => recalcWorkbook(localSheets), [localSheets]);
    const activeRaw = localSheets[activeSheetIndex];
    const activeComputed = computedSheets[activeSheetIndex];

    const describeSelection = useCallback((candidate: Selection): SpreadsheetCellSelection | null => {
      if (!activeRaw?.columns?.length) return null;
      const column = activeRaw.columns[candidate.colIndex];
      const endRowIndex = candidate.endRowIndex ?? candidate.rowIndex;
      const endColIndex = candidate.endColIndex ?? candidate.colIndex;
      const startRef = `${colIndexToLetter(candidate.colIndex)}${excelRowForDataRowIndex(candidate.rowIndex)}`;
      const endRef = `${colIndexToLetter(endColIndex)}${excelRowForDataRowIndex(endRowIndex)}`;
      const isRange = startRef !== endRef;
      const address = candidate.kind === 'row'
        ? `${activeRaw.name || ''}!${excelRowForDataRowIndex(candidate.rowIndex)}:${excelRowForDataRowIndex(endRowIndex)}`
        : candidate.kind === 'column'
          ? `${activeRaw.name || ''}!${colIndexToLetter(candidate.colIndex)}:${colIndexToLetter(endColIndex)}`
          : `${activeRaw.name || ''}!${startRef}${isRange ? `:${endRef}` : ''}`;
      return {
        ...candidate,
        kind: candidate.kind ?? (isRange ? 'range' : 'cell'),
        address,
        rawValue: isRange || candidate.kind === 'row' || candidate.kind === 'column'
          ? ''
          : rawCellToEditText(activeRaw.rows?.[candidate.rowIndex]?.cells?.[column?.key ?? '']),
      };
    }, [activeRaw]);

    useEffect(() => {
      if (editingValue !== null) inputRef.current?.focus();
    }, [editingValue]);

    useEffect(() => {
      onSaveStateChange?.(saveState);
    }, [onSaveStateChange, saveState]);

    useEffect(() => {
      if (!selected || !activeRaw?.columns?.length) {
        onSelectionChange?.(null);
        return;
      }
      const described = describeSelection(selected);
      if (described) onSelectionChange?.(described);
    }, [activeRaw, describeSelection, onSelectionChange, selected]);

    // Po Escape/zatwierdzeniu edycji przywracamy fokus do aktywnej komórki.
    // Dzięki temu siatka ma jeden spójny kontrakt roving-focus: kliknięcie,
    // klawiatura i menu kontekstowe mają ten sam element wywołujący.
    useEffect(() => {
      if (editingValue === null && selected) {
        containerRef.current
          ?.querySelector<HTMLElement>('[role="gridcell"][tabindex="0"]')
          ?.focus();
      }
    }, [editingValue, selected]);

    const applyRawChanges = useCallback(
      (changes: CellChange[], direction: 'before' | 'after') => {
        if (changes.length === 0) return;
        const payloads = changes.flatMap((change) => {
          const col = localSheets[activeSheetIndex]?.columns?.[change.colIndex];
          if (!col) return [];
          return [{
            sheetIndex: activeSheetIndex,
            rowIndex: change.rowIndex,
            columnKey: col.key,
            ...parseCellInput(change[direction]),
          }];
        });
        if (payloads.length === 0) return;
        setLocalSheets((prev) => {
          const clone = cloneSheets(prev);
          const sheet = clone[activeSheetIndex];
          if (!sheet.rows) sheet.rows = [];
          for (const change of changes) {
            const col = sheet.columns?.[change.colIndex];
            const targetRow = sheet.rows[change.rowIndex];
            if (!col || !targetRow) continue;
            if (!targetRow.cells) targetRow.cells = {};
            const oldCell = targetRow.cells[col.key] ?? {};
            targetRow.cells[col.key] = {
              style: (oldCell as Record<string, unknown>).style,
              comment: (oldCell as Record<string, unknown>).comment,
              validation: (oldCell as Record<string, unknown>).validation,
              ...parseCellInput(change[direction]),
            };
          }
          onSheetsChange?.(clone);
          return clone;
        });

        setSaveState('saving');
        const persistence = persistCells
          ? persistCells(payloads)
          : Promise.all(
              payloads.map((payload) =>
                persistCell
                  ? persistCell(payload)
                  : Api.updateWorkbookCell(workbookId, payload).then(() => undefined)
              )
            ).then(() => undefined);
        persistence
          .then(() => setSaveState('saved'))
          .catch(() => setSaveState('error'));
      },
      [activeSheetIndex, localSheets, onSheetsChange, persistCell, persistCells, workbookId]
    );

    const commit = useCallback(
      (nextRaw: string, move: 'down' | 'right' | 'none') => {
        if (!selected || !activeRaw?.columns) return;
        const col = activeRaw.columns[selected.colIndex];
        if (!col) return;
        const before = rawCellToEditText(activeRaw.rows?.[selected.rowIndex]?.cells?.[col.key]);
        if (before !== nextRaw) {
          const change = { rowIndex: selected.rowIndex, colIndex: selected.colIndex, before, after: nextRaw };
          undoStackRef.current.push([change]);
          redoStackRef.current = [];
          applyRawChanges([change], 'after');
          publishHistoryState();
        }

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
      [selected, activeRaw, applyRawChanges, publishHistoryState]
    );

    const clearSelection = useCallback(() => {
      if (!selected || !activeRaw?.columns) return;
      const rowStart = Math.min(selected.rowIndex, selected.endRowIndex ?? selected.rowIndex);
      const rowEnd = Math.max(selected.rowIndex, selected.endRowIndex ?? selected.rowIndex);
      const colStart = Math.min(selected.colIndex, selected.endColIndex ?? selected.colIndex);
      const colEnd = Math.max(selected.colIndex, selected.endColIndex ?? selected.colIndex);
      const changes: CellChange[] = [];
      for (let rowIndex = rowStart; rowIndex <= rowEnd; rowIndex += 1) {
        for (let colIndex = colStart; colIndex <= colEnd; colIndex += 1) {
          const col = activeRaw.columns[colIndex];
          if (!col) continue;
          const before = rawCellToEditText(activeRaw.rows?.[rowIndex]?.cells?.[col.key]);
          if (before !== '') changes.push({ rowIndex, colIndex, before, after: '' });
        }
      }
      if (changes.length === 0) return;
      undoStackRef.current.push(changes);
      redoStackRef.current = [];
      applyRawChanges(changes, 'after');
      publishHistoryState();
    }, [activeRaw, applyRawChanges, publishHistoryState, selected]);

    const undo = useCallback(() => {
      const entry = undoStackRef.current.pop();
      if (!entry) return;
      redoStackRef.current.push(entry);
      setSelected({ rowIndex: entry[0].rowIndex, colIndex: entry[0].colIndex });
      applyRawChanges(entry, 'before');
      publishHistoryState();
    }, [applyRawChanges, publishHistoryState]);

    const redo = useCallback(() => {
      const entry = redoStackRef.current.pop();
      if (!entry) return;
      undoStackRef.current.push(entry);
      setSelected({ rowIndex: entry[0].rowIndex, colIndex: entry[0].colIndex });
      applyRawChanges(entry, 'after');
      publishHistoryState();
    }, [applyRawChanges, publishHistoryState]);

    const startEditing = useCallback(
      (rowIndex: number, colIndex: number, initial?: string) => {
        setSelected({ rowIndex, colIndex });
        const col = activeRaw?.columns?.[colIndex];
        const rawCell = col ? activeRaw?.rows?.[rowIndex]?.cells?.[col.key] : undefined;
        setEditingValue(initial ?? rawCellToEditText(rawCell));
      },
      [activeRaw]
    );

    const copySelection = useCallback(async (): Promise<void> => {
      if (!selected || !activeRaw?.columns?.length || !navigator.clipboard?.writeText) return;
      const rowStart = Math.min(selected.rowIndex, selected.endRowIndex ?? selected.rowIndex);
      const rowEnd = Math.max(selected.rowIndex, selected.endRowIndex ?? selected.rowIndex);
      const colStart = Math.min(selected.colIndex, selected.endColIndex ?? selected.colIndex);
      const colEnd = Math.max(selected.colIndex, selected.endColIndex ?? selected.colIndex);
      const columns = activeRaw.columns;
      const text = Array.from({ length: rowEnd - rowStart + 1 }, (_, rowOffset) =>
        Array.from({ length: colEnd - colStart + 1 }, (_, colOffset) => {
          const column = columns[colStart + colOffset];
          return column
            ? rawCellToEditText(activeRaw.rows?.[rowStart + rowOffset]?.cells?.[column.key])
            : '';
        }).join('\t')
      ).join('\n');
      await navigator.clipboard.writeText(text);
    }, [activeRaw, selected]);

    const cutSelection = useCallback(async (): Promise<void> => {
      await copySelection();
      clearSelection();
    }, [clearSelection, copySelection]);

    const pasteSelection = useCallback(async (): Promise<void> => {
      if (!selected || !activeRaw?.columns?.length || !navigator.clipboard?.readText) return;
      const text = await navigator.clipboard.readText();
      if (!text) return;
      const columns = activeRaw.columns;
      const matrix = text.replace(/\r\n/g, '\n').split('\n').map((row) => row.split('\t'));
      const changes: CellChange[] = [];
      matrix.forEach((row, rowOffset) => {
        row.forEach((after, colOffset) => {
          const rowIndex = selected.rowIndex + rowOffset;
          const colIndex = selected.colIndex + colOffset;
          const column = columns[colIndex];
          if (!column || !activeRaw.rows?.[rowIndex]) return;
          const before = rawCellToEditText(activeRaw.rows[rowIndex]?.cells?.[column.key]);
          if (before !== after) changes.push({ rowIndex, colIndex, before, after });
        });
      });
      if (changes.length === 0) return;
      undoStackRef.current.push(changes);
      redoStackRef.current = [];
      applyRawChanges(changes, 'after');
      publishHistoryState();
    }, [activeRaw, applyRawChanges, publishHistoryState, selected]);

    React.useImperativeHandle(
      ref,
      () => ({
        editSelectedCell: () => {
          if (selected) startEditing(selected.rowIndex, selected.colIndex);
        },
        clearSelectedCell: clearSelection,
        copySelection,
        cutSelection,
        pasteSelection,
        undo,
        redo,
        selectCell: (rowIndex: number, colIndex: number) => {
          const rowCount = activeRaw?.rows?.length ?? 0;
          const colCount = activeRaw?.columns?.length ?? 0;
          if (rowIndex < 0 || colIndex < 0 || rowIndex >= rowCount || colIndex >= colCount) return;
          setSelected({ rowIndex, colIndex, kind: 'cell' });
          setEditingValue(null);
          containerRef.current?.focus();
        },
      }),
      [activeRaw, clearSelection, copySelection, cutSelection, pasteSelection, redo, selected, startEditing, undo]
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
      (
        key: string,
        modifiers: { ctrlKey: boolean; metaKey: boolean; altKey: boolean; shiftKey: boolean }
      ): boolean => {
        if (editingValue !== null || !selected) return false;
        if ((modifiers.ctrlKey || modifiers.metaKey) && key.toLowerCase() === 'z') {
          if (modifiers.shiftKey) redo();
          else undo();
          return true;
        }
        if ((modifiers.ctrlKey || modifiers.metaKey) && key.toLowerCase() === 'c') {
          void copySelection();
          return true;
        }
        if ((modifiers.ctrlKey || modifiers.metaKey) && key.toLowerCase() === 'x') {
          void cutSelection();
          return true;
        }
        if ((modifiers.ctrlKey || modifiers.metaKey) && key.toLowerCase() === 'v') {
          void pasteSelection();
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
            clearSelection();
            return true;
          default:
            if (key.length === 1 && !modifiers.ctrlKey && !modifiers.metaKey && !modifiers.altKey) {
              startEditing(selected.rowIndex, selected.colIndex, key);
              return true;
            }
            return false;
        }
      },
      [editingValue, selected, moveSelection, startEditing, clearSelection, copySelection, cutSelection, pasteSelection, redo, undo]
    );

    const handleContainerKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (
          selected &&
          onSelectionContextMenu &&
          (e.key === 'ContextMenu' || (e.key === 'F10' && e.shiftKey))
        ) {
          const described = describeSelection(selected);
          if (described) {
            e.preventDefault();
            const selectedCell = containerRef.current?.querySelector<HTMLElement>(
              '[role="gridcell"][tabindex="0"]'
            );
            const rect = selectedCell?.getBoundingClientRect();
            onSelectionContextMenu({
              x: rect ? rect.left + Math.min(rect.width, 24) : 24,
              y: rect ? rect.top + Math.min(rect.height, 24) : 24,
              selection: described,
            });
            return;
          }
        }
        const handled = handleNavigationKey(e.key, {
          ctrlKey: e.ctrlKey,
          metaKey: e.metaKey,
          altKey: e.altKey,
          shiftKey: e.shiftKey,
        });
        if (handled) e.preventDefault();
      },
      [describeSelection, handleNavigationKey, onSelectionContextMenu, selected]
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
        // Gdy fokus jest na kontenerze, jego własny onKeyDown obsłuży zdarzenie.
        // Globalny fallback działa tylko dla utraconego fokusu, inaczej jedna
        // akcja (np. Delete/Undo) zostałaby wykonana dwukrotnie.
        const safeTarget = active === document.body || active === null;
        if (!safeTarget) return;
        const handled = handleNavigationKey(e.key, {
          ctrlKey: e.ctrlKey,
          metaKey: e.metaKey,
          altKey: e.altKey,
          shiftKey: e.shiftKey,
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
        // Input ma własny onKeyDown. Ten listener jest wyłącznie awaryjnym
        // fallbackiem dla body/null, aby Enter nie zapisywał komórki dwa razy.
        const safeTarget = active === document.body || active === null;
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
      ? `${activeRaw.name || ''}!${colIndexToLetter(selected.colIndex)}${excelRowForDataRowIndex(selected.rowIndex)}${
          selected.endRowIndex !== undefined && selected.endColIndex !== undefined
            ? `:${colIndexToLetter(selected.endColIndex)}${excelRowForDataRowIndex(selected.endRowIndex)}`
            : ''
        }`
      : '';

    return (
      <div className="bg-c-surface rounded-hig-md border border-c-border-subtle overflow-hidden">
        {/* Pasek formuły — pokazuje, co REALNIE siedzi w komórce (wartość vs
          formuła), nie wynik. To jest sedno dla właściciela — patrz nagłówek
          pliku i specyfikacja zadania. */}
        <div className="flex items-center gap-2 px-3 py-1.5 border-b border-c-border-subtle bg-c-surface-raised">
          <span className="shrink-0 min-w-[64px] text-[11px] font-mono text-c-text-secondary text-center px-1.5 py-0.5 rounded bg-c-surface border border-c-border-subtle">
            {formulaBarAddress || '—'}
          </span>
          <input
            type="text"
            value={formulaBarText}
            readOnly={!selected}
            onFocus={() => {
              if (selected && editingValue === null) {
                startEditing(selected.rowIndex, selected.colIndex);
              }
            }}
            onChange={(e) => setEditingValue(e.target.value)}
            onKeyDown={handleInputKeyDown}
            onBlur={() => {
              if (editingValue !== null) commit(editingValue, 'none');
            }}
            placeholder={t(
              'kimi.excele.formulaBarEmpty',
              'Zaznacz komórkę, aby zobaczyć jej treść'
            )}
              className="flex-1 min-w-0 bg-transparent text-xs font-mono text-c-text focus:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
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
                {t('kimi.excele.saveFailed', 'Błąd zapisu')}
              </>
            )}
          </span>
        </div>

        <div
          ref={containerRef}
          className="overflow-x-auto max-h-[520px] overflow-y-auto focus:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
          onKeyDown={handleContainerKeyDown}
          tabIndex={0}
        >
          <table /* §27-exempt: macierz/komorki kalkulacyjne, osobny spec matrix-editor */ className="w-full text-xs">
            <thead className="sticky top-0 z-10">
              <tr className="bg-c-surface-raised">
                <th
                  aria-label="Zaznacz wszystko"
                  className="sticky left-0 z-20 w-10 border-b border-r border-c-border-subtle bg-c-surface-raised"
                />
                {columns.map((col, ci) => (
                  <th
                    key={`${col.key}-${ci}`}
                    onClick={() => {
                      setSelected({
                        rowIndex: 0,
                        colIndex: ci,
                        endRowIndex: Math.max((activeRaw.rows?.length ?? 1) - 1, 0),
                        endColIndex: ci,
                        kind: 'column',
                      });
                      containerRef.current?.focus();
                    }}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      const candidate: Selection = {
                        rowIndex: 0,
                        colIndex: ci,
                        endRowIndex: Math.max((activeRaw.rows?.length ?? 1) - 1, 0),
                        endColIndex: ci,
                        kind: 'column',
                      };
                      setSelected(candidate);
                      const described = describeSelection(candidate);
                      if (described) onSelectionContextMenu?.({ x: event.clientX, y: event.clientY, selection: described });
                    }}
                    className="px-3 py-2 text-left font-medium text-c-text-secondary border-b border-c-border-subtle whitespace-nowrap"
                  >
                    {col.header || col.key}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row, ri) => (
                <tr key={ri} className="border-b border-c-border-subtle hover:bg-c-surface-raised">
                  <th
                    scope="row"
                    onClick={() => {
                      setSelected({
                        rowIndex: ri,
                        colIndex: 0,
                        endRowIndex: ri,
                        endColIndex: Math.max(columns.length - 1, 0),
                        kind: 'row',
                      });
                      containerRef.current?.focus();
                    }}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      const candidate: Selection = {
                        rowIndex: ri,
                        colIndex: 0,
                        endRowIndex: ri,
                        endColIndex: Math.max(columns.length - 1, 0),
                        kind: 'row',
                      };
                      setSelected(candidate);
                      const described = describeSelection(candidate);
                      if (described) onSelectionContextMenu?.({ x: event.clientX, y: event.clientY, selection: described });
                    }}
                    className="sticky left-0 z-[5] w-10 cursor-pointer border-r border-c-border-subtle bg-c-surface-raised px-2 py-1.5 text-center font-mono text-[10px] font-normal text-c-text-secondary"
                  >
                    {excelRowForDataRowIndex(ri)}
                  </th>
                  {columns.map((col, ci) => {
                    const cell: ComputedCell | undefined = row.cells[col.key];
                    const rawStyle = activeRaw.rows?.[ri]?.cells?.[col.key]?.style as {
                      bold?: boolean;
                      italic?: boolean;
                      fontColor?: string;
                      bgColor?: string;
                      alignment?: 'left' | 'center' | 'right';
                      wrapText?: boolean;
                      border?: string;
                      numberFormat?: string;
                    } | undefined;
                    const normalizedColor = (value?: string) => value
                      ? `#${value.replace(/^#/, '').slice(-6)}`
                      : undefined;
                    const rowStart = Math.min(selected?.rowIndex ?? -1, selected?.endRowIndex ?? selected?.rowIndex ?? -1);
                    const rowEnd = Math.max(selected?.rowIndex ?? -1, selected?.endRowIndex ?? selected?.rowIndex ?? -1);
                    const colStart = Math.min(selected?.colIndex ?? -1, selected?.endColIndex ?? selected?.colIndex ?? -1);
                    const colEnd = Math.max(selected?.colIndex ?? -1, selected?.endColIndex ?? selected?.colIndex ?? -1);
                    const isSelected = ri >= rowStart && ri <= rowEnd && ci >= colStart && ci <= colEnd;
                    const isEditingThis =
                      selected?.rowIndex === ri &&
                      selected?.colIndex === ci &&
                      editingValue !== null;
                    return (
                      <td
                        key={`${col.key}-${ci}`}
                        role="gridcell"
                        tabIndex={isSelected ? 0 : -1}
                        onClick={(event) => {
                          setSelected((current) =>
                            event.shiftKey && current
                              ? { ...current, endRowIndex: ri, endColIndex: ci }
                              : { rowIndex: ri, colIndex: ci }
                          );
                          // Fokus pozostaje na konkretnej komórce. Zdarzenia
                          // nawigacyjne bąbelkują do kontenera siatki, natomiast
                          // Escape z menu kontekstowego może wrócić dokładnie do
                          // elementu, który je otworzył.
                          event.currentTarget.focus();
                        }}
                        onContextMenu={(event) => {
                          event.preventDefault();
                          const candidate: Selection = { rowIndex: ri, colIndex: ci };
                          setSelected(candidate);
                          const described = describeSelection(candidate);
                          if (described) onSelectionContextMenu?.({ x: event.clientX, y: event.clientY, selection: described });
                        }}
                        onKeyDown={(event) => {
                          if (event.key !== 'Enter' && event.key !== ' ') return;
                          event.preventDefault();
                          setSelected({ rowIndex: ri, colIndex: ci });
                          if (event.key === 'Enter') startEditing(ri, ci);
                        }}
                        onDoubleClick={() => startEditing(ri, ci)}
                        className={`relative px-3 py-1.5 whitespace-nowrap max-w-[220px] truncate cursor-cell ${
                          freezeFirstColumn && ci === 0 ? 'sticky left-10 z-[4] bg-c-surface' : ''
                        } ${
                          cell?.error
                            ? 'text-c-danger font-mono'
                            : cell?.isFormula
                              ? 'font-mono text-c-text-secondary'
                              : 'text-c-text'
                        } ${isSelected ? 'outline outline-2 outline-c-focus outline-offset-[-2px]' : ''}`}
                        style={{
                          fontWeight: rawStyle?.bold ? 700 : undefined,
                          fontStyle: rawStyle?.italic ? 'italic' : undefined,
                          color: normalizedColor(rawStyle?.fontColor),
                          backgroundColor: normalizedColor(rawStyle?.bgColor),
                          textAlign: rawStyle?.alignment,
                          whiteSpace: rawStyle?.wrapText ? 'normal' : undefined,
                          border: rawStyle?.border && rawStyle.border !== 'none'
                            ? `${rawStyle.border === 'thick' ? 3 : rawStyle.border === 'medium' ? 2 : 1}px solid var(--c-border)`
                            : undefined,
                        }}
                      >
                        {isEditingThis ? (
                          <input
                            ref={inputRef}
                            type="text"
                            value={editingValue ?? ''}
                            onChange={(e) => setEditingValue(e.target.value)}
                            onKeyDown={handleInputKeyDown}
                            onBlur={() => commit(editingValue ?? '', 'none')}
                            className="absolute inset-0 w-full h-full px-3 bg-c-surface text-c-text text-xs font-mono focus:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                          />
                        ) : (
                          formatComputedForDisplay(cell, rawStyle?.numberFormat)
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
  }
);

EditableSpreadsheetGrid.displayName = 'EditableSpreadsheetGrid';

export default EditableSpreadsheetGrid;
