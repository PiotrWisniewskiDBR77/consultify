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
  type ComputedCell,
  type FormulaSheet,
  colIndexToLetter,
  excelRowForDataRowIndex,
  formatComputedForDisplay,
  parseCellInput,
  rawCellToEditText,
  recalcWorkbook,
} from '@/utils/workbookFormulaEngine';

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
    if (editingValue !== null) inputRef.current?.focus();
  }, [editingValue]);

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
    (rowIndex: number, colIndex: number, initial?: string) => {
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

  const handleContainerKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (editingValue !== null) return; // input's own onKeyDown handles this
      if (!selected) return;
      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          moveSelection(-1, 0);
          break;
        case 'ArrowDown':
          e.preventDefault();
          moveSelection(1, 0);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          moveSelection(0, -1);
          break;
        case 'ArrowRight':
          e.preventDefault();
          moveSelection(0, 1);
          break;
        case 'Enter':
        case 'F2':
          e.preventDefault();
          startEditing(selected.rowIndex, selected.colIndex);
          break;
        case 'Delete':
        case 'Backspace':
          e.preventDefault();
          commit('', 'none');
          break;
        default:
          if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
            startEditing(selected.rowIndex, selected.colIndex, e.key);
          }
      }
    },
    [editingValue, selected, moveSelection, startEditing, commit]
  );

  const handleInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        commit(editingValue ?? '', 'down');
      } else if (e.key === 'Tab') {
        e.preventDefault();
        commit(editingValue ?? '', 'right');
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setEditingValue(null);
      }
    },
    [commit, editingValue]
  );

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
          placeholder={t('kimi.excele.formulaBarEmpty', 'Zaznacz komórkę, aby zobaczyć jej treść')}
          className="flex-1 min-w-0 bg-transparent text-xs font-mono text-c-text focus:outline-none"
        />
        <span className="shrink-0 flex items-center gap-1 text-[11px] text-c-text-secondary" aria-live="polite">
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
        className="overflow-x-auto max-h-[520px] overflow-y-auto"
        onKeyDown={handleContainerKeyDown}
        tabIndex={0}
      >
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
                  return (
                    <td
                      key={`${col.key}-${ci}`}
                      onClick={() => setSelected({ rowIndex: ri, colIndex: ci })}
                      onDoubleClick={() => startEditing(ri, ci)}
                      className={`relative px-3 py-1.5 whitespace-nowrap max-w-[220px] truncate cursor-cell ${
                        cell?.error
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
