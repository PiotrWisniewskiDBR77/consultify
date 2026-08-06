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
import { isNegativeVarianceCell } from '@/utils/workbookGridPreview';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

interface Selection {
  rowIndex: number;
  colIndex: number;
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

export const EditableSpreadsheetGrid: React.FC<Props> = ({
  workbookId,
  sheets,
  activeSheetIndex,
  rowCap = 100,
}) => {
  const { t } = useTranslation();
  const [localSheets, setLocalSheets] = useState<FormulaSheet[]>(() => cloneSheets(sheets));
  const [selected, setSelected] = useState<Selection | null>(null);
  const [editingValue, setEditingValue] = useState<string | null>(null);
  const [showAllRows, setShowAllRows] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const editFocusTargetRef = useRef<'cell' | 'formula'>('cell');

  // Nowy skoroszyt (reopen na inny id) → zacznij od świeżych danych serwera;
  // edycje w toku dla POPRZEDNIEGO workbookId nigdy nie mieszają się z nowym.
  useEffect(() => {
    setLocalSheets(cloneSheets(sheets));
    setSelected(null);
    setEditingValue(null);
    setSaveState('idle');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workbookId]);

  // Zmiana zakładki arkusza → zaznaczenie z poprzedniego arkusza nie ma sensu.
  useEffect(() => {
    setSelected(null);
    setEditingValue(null);
  }, [activeSheetIndex]);

  const computedSheets = useMemo(() => recalcWorkbook(localSheets), [localSheets]);
  const activeRaw = localSheets[activeSheetIndex];
  const activeComputed = computedSheets[activeSheetIndex];

  useEffect(() => {
    // Starting an edit from the formula bar must not steal focus into the
    // transient cell input. Doing so fires formula-bar blur immediately and
    // used to persist an empty value before the user's text was entered.
    if (editingValue !== null && editFocusTargetRef.current === 'cell') {
      inputRef.current?.focus();
    }
  }, [editingValue]);

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

      setLocalSheets((prev) => {
        const clone = cloneSheets(prev);
        const sheet = clone[activeSheetIndex];
        if (!sheet.rows) sheet.rows = [];
        const targetRow = sheet.rows[selected.rowIndex];
        if (!targetRow) return prev;
        if (!targetRow.cells) targetRow.cells = {};
        const oldCell = targetRow.cells[col.key] ?? {};
        targetRow.cells[col.key] = {
          style: (oldCell as Record<string, unknown>).style,
          comment: (oldCell as Record<string, unknown>).comment,
          validation: (oldCell as Record<string, unknown>).validation,
          ...parsed,
        };
        return clone;
      });

      setSaveState('saving');
      Api.updateWorkbookCell(workbookId, {
        sheetIndex: activeSheetIndex,
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
    [selected, activeRaw, activeSheetIndex, workbookId]
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
    [editingValue, selected, moveSelection, startEditing, commit]
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
              {t('kimi.excele.saveFailed', 'Błąd zapisu')}
            </>
          )}
        </span>
      </div>

      <div
        data-testid="editable-spreadsheet-grid"
        ref={containerRef}
        className="overflow-x-auto max-h-[520px] overflow-y-auto focus:outline-none"
        onKeyDown={handleContainerKeyDown}
        tabIndex={0}
      >
        {/* prettier-ignore */}
        <table className="w-full text-xs" /* §27-exempt: edytor komorkowy/arkusz, edycja cell-by-cell — docs/ui-standards/DOKTRYNA_TABELA_NIE_EXCEL.md */>
          <thead className="sticky top-0 z-10">
            <tr className="bg-c-surface-raised">
              {columns.map((col, ci) => (
                <th
                  key={`${col.key}-${ci}`}
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
                {columns.map((col, ci) => {
                  const cell: ComputedCell | undefined = row.cells[col.key];
                  const isSelected = selected?.rowIndex === ri && selected?.colIndex === ci;
                  const isEditingThis = isSelected && editingValue !== null;
                  const isNegativeVariance = isNegativeVarianceCell(
                    activeRaw.name || '',
                    col.header || col.key,
                    cell?.computed
                  );
                  return (
                    <td
                      data-testid={`workbook-cell-${ri}-${col.key}`}
                      key={`${col.key}-${ci}`}
                      onClick={() => {
                        setSelected({ rowIndex: ri, colIndex: ci });
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
                      } ${isSelected ? 'outline outline-2 outline-c-focus outline-offset-[-2px]' : ''}`}
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
                        formatComputedForDisplay(cell)
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
