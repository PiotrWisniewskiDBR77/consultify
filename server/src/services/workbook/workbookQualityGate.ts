/**
 * workbookQualityGate — deterministyczny krytyk jakości arkusza (analog deckDesignCritic).
 *
 * deckDesignCritic ocenia POJEDYNCZY slajd wg twardych reguł kompozycji i zwraca
 * `{ score, critiques[], passed }`. Ten moduł robi to samo dla ARKUSZA: patrzy na
 * `WorkbookSchema` PRZED buildem i zwraca `{ score, issues[] }` — bez LLM, deterministycznie,
 * fail-soft (nigdy nie rzuca, nigdy nie blokuje generacji — tylko raportuje).
 *
 * Kody znalezisk pochodzą z KANONU P23 (`exceleCanon.P23_ERROR_TAXONOMY`) — nie wymyślamy
 * własnych klas błędów, klasyfikujemy spójnie z istniejącą taksonomią:
 *
 *   WQ-01  Magic-numbers   → validation_failed   — stała liczba w wierszu total/summary
 *                                                    albo w kolumnie „computed" (powinna być formuła)
 *   WQ-02  SUM-coverage    → formula_error        — =SUM(...) urwany lub za szeroki
 *                                                    (nie pokrywa dokładnie wierszy danych nad total)
 *   WQ-03  Assumptions-dup → validation_failed    — surowy input zduplikowany jako stała
 *                                                    zamiast referencji do arkusza Assumptions
 *   WQ-04  Format-mix      → type_coercion_error  — kolumna waluta/% miesza formaty
 *                                                    albo goła liczba tam gdzie sąsiedzi mają format
 *   WQ-05  Percent-format  → type_coercion_error  — kolumna typu `percent` bez formatu %
 *   WQ-06  Broken-formula-ref → formula_error     — formuła referuje kolumnę/arkusz, którego nie ma
 *   WQ-07  Bad-formula-syntax → formula_error     — formuła z uszkodzonym prefiksem `=` (`==`+, samo `=`,
 *                                                    pusta). `cellDef.formula` trafia do ExcelJS, który
 *                                                    zapisuje string VERBATIM do XML `<f>` — poprawna
 *                                                    formuła NIE może mieć wiodącego „=". `==…` → Excel
 *                                                    odrzuca plik. Pojedyncze `=` = konwencja (builder
 *                                                    sanityzuje) → NIE flaga. (Ślepa plama: krytyk nie łapał.)
 *   WQ-08  Cross-sheet-oob   → formula_error       — cross-sheet ref do EXISTUJĄCEGO arkusza, ale komórka
 *                                                    poza zapełnionym zakresem arkusza DOCELOWEGO. WQ-06
 *                                                    pomija out-of-bounds gdy formuła ma cross-sheet ref —
 *                                                    WQ-08 domyka tę lukę (MAJOR). Ref do arkusza spoza
 *                                                    workbooka nadal łapie WQ-06 (CRITICAL, bez duplikacji).
 *   WQ-09  Inconsistent-calc-col → validation_failed — kolumna, w której część komórek to formuły a część
 *                                                    to gołe stałe liczbowe (LLM „zapomniał" formuły w jednej
 *                                                    komórce). Deterministyczne, konserwatywne — patrz granica
 *                                                    heurystyki niżej.
 *
 * ── BRAMKI DOKTRYNALNE (DX) — `_DOKTRYNA_TRESCI_EXCEL_2026-07-27.md` §5.2 ────────────────────
 *
 *   DX-01  Assumptions-layer-missing → validation_failed — model BEZ warstwy Założeń (A1).
 *                                                    Luka L4 doktryny: WQ-03 milczy, gdy arkusza Założeń
 *                                                    NIE MA (`checkAssumptionsSeparation` → early return),
 *                                                    więc arkusz, którego nie da się zasymulować, dostawał
 *                                                    100/100. Decyzja CTO D4/D-6: CRITICAL (blokujący) —
 *                                                    „model bez Założeń to nie jest model" (doktryna §2 R-A1,
 *                                                    §9 AW-2). Granica — patrz `checkAssumptionsLayer`.
 *   DX-02  Formula-cycle → formula_cycle_detected     — odwołanie cykliczne w grafie formuł.
 *                                                    Luka L3 doktryny: klasa `formula_cycle_detected`
 *                                                    istnieje w taksonomii P23 (`exceleCanon.ts`), ale
 *                                                    ŻADNA reguła jej nie emitowała — zakaz B10
 *                                                    (`BUSINESS_PLAN_GENERATOR_SPEC`) był niepilnowany.
 *                                                    Decyzja CTO D4/D-6: CRITICAL (blokujący) — doktryna
 *                                                    §3.5, §9 AW-5.
 *
 * Deterministyczny i fail-open, jak deckDesignCritic. Werdykt „passed" = brak CRITICAL.
 * Każde znalezisko CRITICAL niesie `blocking: true` (nie przepuszczamy takiego arkusza dalej).
 */

import logger from '../../utils/Logger.js';
import { createP23Error, type P23ErrorCode } from '../v8/exceleCanon.js';
import type { ColumnDef, Row, Sheet, WorkbookSchema } from './WorkbookSchema.js';

// ── Typy ─────────────────────────────────────────────────────────────────────

export type WorkbookIssueSeverity = 'CRITICAL' | 'MAJOR' | 'MINOR';

/** Deterministyczne reguły krytyka (stabilne kody dla telemetrii). */
export type WorkbookRuleCode =
  | 'WQ-01-MAGIC-NUMBER'
  | 'WQ-02-SUM-COVERAGE'
  | 'WQ-03-ASSUMPTIONS-DUP'
  | 'WQ-04-FORMAT-MIX'
  | 'WQ-05-PERCENT-FORMAT'
  | 'WQ-06-BROKEN-FORMULA-REF'
  | 'WQ-07-BAD-FORMULA-SYNTAX'
  | 'WQ-08-CROSS-SHEET-OOB'
  | 'WQ-09-INCONSISTENT-CALC-COL'
  | 'DX-01-NO-ASSUMPTIONS-LAYER'
  | 'DX-02-FORMULA-CYCLE';

export interface WorkbookIssue {
  /** Stabilny kod reguły krytyka. */
  code: WorkbookRuleCode;
  /** Kod z kanonu P23 (spójna klasyfikacja z resztą silnika). */
  canonCode: P23ErrorCode;
  severity: WorkbookIssueSeverity;
  /**
   * Czy znalezisko BLOKUJE arkusz (nie wolno go oddać klientowi w tym stanie).
   * Wprost równoważne `severity === 'CRITICAL'` — pole jest jawne, żeby konsument
   * (pętla naprawcza, route, odbiór) nie musiał znać mapowania severity→werdykt.
   */
  blocking: boolean;
  /** Nazwa arkusza, którego dotyczy znalezisko. */
  sheet: string;
  /** Adres komórki (A1) gdy znane; w przeciwnym razie null. */
  cell?: string | null;
  /** Klucz kolumny gdy znaczący; w przeciwnym razie null. */
  col?: string | null;
  message: string;
  /** Konkretna sugestia naprawy. */
  fix?: string;
}

export interface WorkbookQualityReport {
  /** 0-100 — 100 = bez zastrzeżeń. CRITICAL -25, MAJOR -10, MINOR -3. */
  score: number;
  issues: WorkbookIssue[];
  /** Brak CRITICAL. */
  passed: boolean;
}

// ── Progi / heurystyki ───────────────────────────────────────────────────────

const SEVERITY_PENALTY: Record<WorkbookIssueSeverity, number> = {
  CRITICAL: 25,
  MAJOR: 10,
  MINOR: 3,
};

/** Kolumny „obliczalne" — wynik ma być formułą, nie stałą. Dopasowanie po key/header. */
const COMPUTED_HINTS = [
  'total',
  'sum',
  'subtotal',
  'suma',
  'razem',
  'grand',
  'derived',
  'computed',
  'calc',
  'percent_of_total',
  'share',
  'udzial',
  'growth',
  'variance',
  'delta',
];

/** Etykiety, po których poznajemy wiersz podsumowania (gdy brak isSummary). */
const SUMMARY_LABEL_HINTS = ['total', 'suma', 'razem', 'grand total', 'sum', 'ogółem', 'ogolem'];

/** Nazwy arkusza „założeń". */
const ASSUMPTIONS_SHEET_HINTS = ['assumption', 'założen', 'zalozen', 'inputs', 'parametry'];

// ── Helpers: adresowanie A1 ──────────────────────────────────────────────────

/** Litera kolumny wg pozycji (0→A, 25→Z, 26→AA). */
export function colIndexToLetter(index: number): string {
  let n = index + 1;
  let s = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/** Litera kolumny (A, Z, AA) → 1-based indeks (A→1). Zwraca 0 dla pustego. */
function colLetterToIndex(letter: string): number {
  let idx = 0;
  for (let k = 0; k < letter.length; k++) {
    idx = idx * 26 + (letter.charCodeAt(k) - 64);
  }
  return idx;
}

/** Excel-owy numer wiersza dla wiersza danych o indeksie 0-based (header=1). */
function dataRowNumber(rowIdx: number): number {
  return rowIdx + 2;
}

/** Granice zapełnionego zakresu arkusza w formie 1-based (kolumna, wiersz). */
function sheetBounds(sheet: Sheet): { maxCol: number; maxRow: number } {
  return { maxCol: sheet.columns.length, maxRow: sheet.rows.length + 1 };
}

function cellAddress(colIdx: number, rowIdx: number): string {
  return `${colIndexToLetter(colIdx)}${dataRowNumber(rowIdx)}`;
}

function norm(s: string | undefined | null): string {
  return (s ?? '').toLowerCase().trim();
}

function matchesAny(haystack: string, needles: string[]): boolean {
  const h = norm(haystack);
  return needles.some((n) => h.includes(n));
}

function isSummaryRow(row: Row, columns: ColumnDef[]): boolean {
  if (row.isSummary) return true;
  // Fallback: pierwsza tekstowa komórka wygląda jak etykieta total.
  for (const col of columns) {
    const c = row.cells[col.key];
    if (c && typeof c.value === 'string' && matchesAny(c.value, SUMMARY_LABEL_HINTS)) {
      return true;
    }
  }
  return false;
}

function isComputedColumn(col: ColumnDef): boolean {
  return matchesAny(col.key, COMPUTED_HINTS) || matchesAny(col.header, COMPUTED_HINTS);
}

function issue(
  code: WorkbookRuleCode,
  canonCode: P23ErrorCode,
  severity: WorkbookIssueSeverity,
  sheet: string,
  message: string,
  extra?: { cell?: string | null; col?: string | null; fix?: string }
): WorkbookIssue {
  return {
    code,
    canonCode,
    severity,
    blocking: severity === 'CRITICAL',
    sheet,
    cell: extra?.cell ?? null,
    col: extra?.col ?? null,
    message,
    fix: extra?.fix,
  };
}

// ── Parser zakresu SUM ───────────────────────────────────────────────────────

interface SumRange {
  col: string;
  fromRow: number;
  toRow: number;
}

/**
 * Wyciąga proste jednokolumnowe zakresy z `=SUM(C2:C5)` / `SUM(C2:C5, C7:C9)`.
 * Zwraca null dla wyrażeń, których nie rozumiemy deterministycznie (unikamy false-positive).
 */
export function parseSumRanges(formula: string): SumRange[] | null {
  const f = formula.replace(/^=/, '').trim();
  const m = /^SUM\(([^)]*)\)$/i.exec(f);
  if (!m) return null;
  const inner = m[1].trim();
  if (!inner) return null;
  const parts = inner.split(',').map((p) => p.trim());
  const ranges: SumRange[] = [];
  for (const p of parts) {
    // C2:C5  (bez odwołań do innych arkuszy — te pomijamy, nie oceniamy pokrycia)
    const rm = /^([A-Z]+)(\d+):([A-Z]+)(\d+)$/.exec(p);
    if (!rm) return null; // nieznany kształt → nie oceniamy (brak false-positive)
    const [, c1, r1, c2, r2] = rm;
    if (c1 !== c2) return null; // zakres wielokolumnowy — poza deterministyczną oceną
    ranges.push({ col: c1, fromRow: parseInt(r1, 10), toRow: parseInt(r2, 10) });
  }
  return ranges;
}

// ── Reguła 1: magic-numbers ──────────────────────────────────────────────────

function checkMagicNumbers(sheet: Sheet): WorkbookIssue[] {
  const out: WorkbookIssue[] = [];
  const computedCols = new Set(sheet.columns.filter(isComputedColumn).map((c) => c.key));

  sheet.rows.forEach((row, rowIdx) => {
    const summary = isSummaryRow(row, sheet.columns);
    sheet.columns.forEach((col, colIdx) => {
      const c = row.cells[col.key];
      if (!c) return;
      const isConstNumber = !c.formula && typeof c.value === 'number' && Number.isFinite(c.value);
      if (!isConstNumber) return;

      const inComputedCol = computedCols.has(col.key);
      if (summary || inComputedCol) {
        const addr = cellAddress(colIdx, rowIdx);
        const where = summary ? 'wierszu podsumowania' : `kolumnie obliczalnej „${col.header}"`;
        out.push(
          issue(
            'WQ-01-MAGIC-NUMBER',
            'validation_failed',
            summary ? 'CRITICAL' : 'MAJOR',
            sheet.name,
            `Stała liczba ${c.value} w ${where} (${addr}) — powinna być formułą, nie magic-number.`,
            {
              cell: addr,
              col: col.key,
              fix: summary
                ? 'Zastąp stałą formułą =SUM(...) obejmującą wiersze danych.'
                : 'Zastąp stałą formułą wyliczającą tę wartość z komórek źródłowych.',
            }
          )
        );
      }
    });
  });
  return out;
}

// ── Reguła 2: pokrycie SUM ───────────────────────────────────────────────────

function checkSumCoverage(sheet: Sheet): WorkbookIssue[] {
  const out: WorkbookIssue[] = [];
  const colLetterByKey = new Map<string, string>();
  sheet.columns.forEach((col, idx) => colLetterByKey.set(col.key, colIndexToLetter(idx)));

  sheet.rows.forEach((row, rowIdx) => {
    if (!isSummaryRow(row, sheet.columns)) return;
    const summaryRowNum = dataRowNumber(rowIdx);

    sheet.columns.forEach((col) => {
      const c = row.cells[col.key];
      if (!c?.formula) return;
      const ranges = parseSumRanges(c.formula);
      if (!ranges) return; // nie rozumiemy → nie oceniamy

      const letter = colLetterByKey.get(col.key);
      // Rozważamy tylko zakresy w TEJ kolumnie (jednokolumnowy total nad sobą).
      const sameCol = ranges.filter((r) => r.col === letter);
      if (sameCol.length === 0) return;

      // Oczekiwane pokrycie: wszystkie wiersze danych POWYŻEJ tego total (2..summaryRowNum-1),
      // z wyłączeniem innych wierszy-podsumowań.
      const expectedFrom = 2;
      const expectedTo = summaryRowNum - 1;
      if (expectedTo < expectedFrom) return; // brak danych nad total

      const covered = new Set<number>();
      for (const r of sameCol) {
        for (let n = Math.min(r.fromRow, r.toRow); n <= Math.max(r.fromRow, r.toRow); n++) {
          covered.add(n);
        }
      }

      const missing: number[] = [];
      for (let n = expectedFrom; n <= expectedTo; n++) {
        // Pomiń wiersze będące innym podsumowaniem (nie sumujemy total-of-total).
        const otherIdx = n - 2;
        const otherRow = sheet.rows[otherIdx];
        if (otherRow && isSummaryRow(otherRow, sheet.columns)) continue;
        if (!covered.has(n)) missing.push(n);
      }

      const overshoot = [...covered].filter((n) => n < expectedFrom || n > expectedTo);
      const addr = `${letter}${summaryRowNum}`;

      if (missing.length > 0) {
        out.push(
          issue(
            'WQ-02-SUM-COVERAGE',
            'formula_error',
            'CRITICAL',
            sheet.name,
            `SUM w ${addr} urwany — pomija wiersze danych ${missing.join(', ')}.`,
            {
              cell: addr,
              col: col.key,
              fix: `Rozszerz zakres na ${letter}${expectedFrom}:${letter}${expectedTo}.`,
            }
          )
        );
      } else if (overshoot.length > 0) {
        out.push(
          issue(
            'WQ-02-SUM-COVERAGE',
            'formula_error',
            'MAJOR',
            sheet.name,
            `SUM w ${addr} za szeroki — obejmuje wiersze ${overshoot.join(', ')} spoza danych (np. nagłówek/total).`,
            {
              cell: addr,
              col: col.key,
              fix: `Zawęź zakres do wierszy danych ${letter}${expectedFrom}:${letter}${expectedTo}.`,
            }
          )
        );
      }
    });
  });
  return out;
}

// ── Reguła 3: separacja Assumptions ──────────────────────────────────────────

/**
 * Czy arkusz jest warstwą ZAŁOŻEŃ (A1 doktryny)? Dwa równoprawne sygnały:
 *   • jawna flaga schematu `isAssumptions` (kontrakt `WorkbookSchema`, używany przez
 *     wszystkie 7 szablonów i przez builder do named-ranges),
 *   • nazwa arkusza (Assumptions / Założenia / Inputs / Parametry).
 */
function isAssumptionsSheet(sheet: Sheet): boolean {
  return sheet.isAssumptions === true || matchesAny(sheet.name, ASSUMPTIONS_SHEET_HINTS);
}

function checkAssumptionsSeparation(workbook: WorkbookSchema): WorkbookIssue[] {
  const out: WorkbookIssue[] = [];
  const assumptionsSheet = workbook.sheets.find(isAssumptionsSheet);
  if (!assumptionsSheet) return out;

  // Zbierz stałe numeryczne inputy z arkusza Assumptions (wartość → etykieta).
  const assumedValues = new Map<number, string>();
  assumptionsSheet.rows.forEach((row) => {
    let label = '';
    for (const col of assumptionsSheet.columns) {
      const c = row.cells[col.key];
      if (c && typeof c.value === 'string' && !label) label = c.value;
    }
    for (const col of assumptionsSheet.columns) {
      const c = row.cells[col.key];
      if (c && !c.formula && typeof c.value === 'number' && Number.isFinite(c.value)) {
        // Pomiń banalne stałe (0/1/-1) — zbyt częste, żeby były znaczącym inputem.
        if (Math.abs(c.value) > 1) assumedValues.set(c.value, label || String(c.value));
      }
    }
  });
  if (assumedValues.size === 0) return out;

  // W innych arkuszach: ta sama stała jako value (bez formuły) = zduplikowany input.
  for (const sheet of workbook.sheets) {
    if (sheet === assumptionsSheet) continue;
    sheet.rows.forEach((row, rowIdx) => {
      sheet.columns.forEach((col, colIdx) => {
        const c = row.cells[col.key];
        if (!c || c.formula) return;
        if (typeof c.value === 'number' && assumedValues.has(c.value)) {
          const addr = cellAddress(colIdx, rowIdx);
          out.push(
            issue(
              'WQ-03-ASSUMPTIONS-DUP',
              'validation_failed',
              'MAJOR',
              sheet.name,
              `Input „${assumedValues.get(c.value)}" (${c.value}) zduplikowany jako stała w ${addr} — powinien referować do arkusza „${assumptionsSheet.name}".`,
              {
                cell: addr,
                col: col.key,
                fix: `Zastąp stałą referencją, np. ='${assumptionsSheet.name}'!<komórka>.`,
              }
            )
          );
        }
      });
    });
  }
  return out;
}

// ── Reguła 4/5: spójność jednostek/formatów ──────────────────────────────────

function effectiveFormat(cell: Row['cells'][string] | undefined, col: ColumnDef): string | null {
  if (!cell) return null;
  return cell.style?.numberFormat ?? col.numberFormat ?? null;
}

function checkFormatConsistency(sheet: Sheet): WorkbookIssue[] {
  const out: WorkbookIssue[] = [];

  sheet.columns.forEach((col, colIdx) => {
    const isCurrency = col.type === 'currency';
    const isPercent = col.type === 'percent';
    if (!isCurrency && !isPercent) return;

    // Zbierz cell-level formaty numeryczne (constanty) w tej kolumnie.
    const formatsSeen: Array<{ fmt: string; rowIdx: number }> = [];
    let numericConstCount = 0;
    let barelNumberRowIdx = -1;

    sheet.rows.forEach((row, rowIdx) => {
      if (isSummaryRow(row, sheet.columns) || row.isHeader) return;
      const c = row.cells[col.key];
      if (!c || c.formula) return;
      if (typeof c.value !== 'number') return;
      numericConstCount++;
      const fmt = c.style?.numberFormat ?? null;
      if (fmt) {
        formatsSeen.push({ fmt, rowIdx });
      } else if (!col.numberFormat && barelNumberRowIdx < 0) {
        barelNumberRowIdx = rowIdx;
      }
    });

    // WQ-05: kolumna percent bez formatu % nigdzie (ani cell, ani column).
    if (isPercent) {
      const anyPercentFmt =
        (col.numberFormat && col.numberFormat.includes('%')) ||
        formatsSeen.some((f) => f.fmt.includes('%'));
      if (numericConstCount > 0 && !anyPercentFmt) {
        out.push(
          issue(
            'WQ-05-PERCENT-FORMAT',
            'type_coercion_error',
            'MAJOR',
            sheet.name,
            `Kolumna „${col.header}" jest typu percent, ale nie ma formatu % (ani na kolumnie, ani na komórkach).`,
            {
              col: col.key,
              fix: 'Ustaw numberFormat "0.0%" na kolumnie lub komórkach.',
            }
          )
        );
      }
    }

    // WQ-04: mieszane formaty w jednej kolumnie walutowej/%.
    const distinctFmts = new Set(formatsSeen.map((f) => f.fmt));
    if (distinctFmts.size > 1) {
      out.push(
        issue(
          'WQ-04-FORMAT-MIX',
          'type_coercion_error',
          'MAJOR',
          sheet.name,
          `Kolumna „${col.header}" miesza ${distinctFmts.size} formatów: ${[...distinctFmts].join(' | ')}.`,
          {
            col: col.key,
            fix: 'Ujednolić number format w całej kolumnie (jeden format na jednostkę).',
          }
        )
      );
    }

    // WQ-04 (goła liczba): niektóre komórki mają format, jedna go nie ma i kolumna też nie.
    if (formatsSeen.length > 0 && barelNumberRowIdx >= 0 && !col.numberFormat) {
      const addr = cellAddress(colIdx, barelNumberRowIdx);
      out.push(
        issue(
          'WQ-04-FORMAT-MIX',
          'type_coercion_error',
          'MINOR',
          sheet.name,
          `Goła liczba w ${addr} — sąsiednie komórki kolumny „${col.header}" mają format, ta nie.`,
          {
            cell: addr,
            col: col.key,
            fix: 'Nadaj tej komórce ten sam number format co reszcie kolumny.',
          }
        )
      );
    }
  });
  return out;
}

// ── Reguła 6: złamane referencje formuł ──────────────────────────────────────

function checkBrokenFormulaRefs(workbook: WorkbookSchema): WorkbookIssue[] {
  const out: WorkbookIssue[] = [];
  const sheetNames = new Set(workbook.sheets.map((s) => norm(s.name)));

  for (const sheet of workbook.sheets) {
    const { maxCol, maxRow } = sheetBounds(sheet); // 1-based granice tego arkusza

    sheet.rows.forEach((row, rowIdx) => {
      sheet.columns.forEach((col, colIdx) => {
        const c = row.cells[col.key];
        if (!c?.formula) return;
        const f = c.formula;

        // Referencje do innych arkuszy: 'Sheet'!A1 lub Sheet!A1
        const sheetRefs = f.match(/'([^']+)'!|([A-Za-z0-9_]+)!/g) ?? [];
        for (const raw of sheetRefs) {
          const name = raw.replace(/['!]/g, '').trim();
          if (name && !sheetNames.has(norm(name))) {
            const addr = cellAddress(colIdx, rowIdx);
            out.push(
              issue(
                'WQ-06-BROKEN-FORMULA-REF',
                'formula_error',
                'CRITICAL',
                sheet.name,
                `Formuła w ${addr} referuje nieistniejący arkusz „${name}".`,
                {
                  cell: addr,
                  col: col.key,
                  fix: `Popraw nazwę arkusza lub dodaj arkusz „${name}".`,
                }
              )
            );
          }
        }

        // Referencje komórkowe poza granicami TEGO arkusza (tylko dla formuł bez cross-sheet).
        if (sheetRefs.length === 0) {
          const cellRefs = f.match(/\$?([A-Z]+)\$?(\d+)/g) ?? [];
          for (const ref of cellRefs) {
            const rm = /\$?([A-Z]+)\$?(\d+)/.exec(ref);
            if (!rm) continue;
            const letter = rm[1];
            const rnum = parseInt(rm[2], 10);
            const idx = colLetterToIndex(letter);
            if (idx > maxCol || rnum > maxRow) {
              const addr = cellAddress(colIdx, rowIdx);
              out.push(
                issue(
                  'WQ-06-BROKEN-FORMULA-REF',
                  'formula_error',
                  'MAJOR',
                  sheet.name,
                  `Formuła w ${addr} referuje ${ref} poza granicami arkusza (${colIndexToLetter(maxCol - 1)}${maxRow}).`,
                  {
                    cell: addr,
                    col: col.key,
                    fix: 'Popraw referencję — wskazuje poza zakres danych arkusza.',
                  }
                )
              );
              break; // jedna flaga na formułę wystarczy
            }
          }
        }
      });
    });
  }
  return out;
}

// ── Reguła 7: składnia formuły (uszkodzony prefiks `=`) ──────────────────────
//
// KRYTYCZNA ślepa plama: `cellDef.formula` idzie do ExcelJS, który zapisuje string
// VERBATIM do elementu XML `<f>`. Poprawna formuła w XML to `SUM(A1:A2)` — BEZ
// wiodącego `=`. Weryfikacja empiryczna (unzip xl/worksheets): `=SUM(...)` →
// `<f>=SUM(...)</f>` (Excel: #NAME?/uszkodzony), `==SUM(...)` → `<f>==…</f>` (jw.).
//
// GRANICA (świadomie wąska — Prawda > szeroka reguła):
//   Konwencja generatora i schema (WorkbookGeneratorService prompt) emitują
//   formuły Z wiodącym POJEDYNCZYM `=` — to kontrakt kodu, a builder je
//   SANITYZUJE (sanitizeFormula: strip `^=+`) zanim trafią do ExcelJS. Zatem
//   pojedyncze `=` NIE psuje już pliku i flagowanie go byłoby false-positive na
//   100% legalnego outputu. Flagujemy WYŁĄCZNIE kształty, których sanityzacja
//   NIE ratuje w sensowną formułę:
//     • `==`+ (dwa lub więcej `=`)  — samo wystąpienie `==` to defekt (LLM
//       podwoił `=`), nie konwencja.
//     • samo `=`  / pusta / whitespace  — brak treści formuły (→ #NAME?).
//   Pojedyncze `=SUM(...)` (kontrakt) → NIE flagujemy.
function checkFormulaSyntax(sheet: Sheet): WorkbookIssue[] {
  const out: WorkbookIssue[] = [];

  sheet.rows.forEach((row, rowIdx) => {
    sheet.columns.forEach((col, colIdx) => {
      const c = row.cells[col.key];
      // Rozróżniamy „brak formuły" (undefined) od „formuła obecna ale pusta".
      if (typeof c?.formula !== 'string') return;
      const trimmed = c.formula.trim();
      const addr = cellAddress(colIdx, rowIdx);

      // Ile wiodących `=`? Reszta po stripie = treść formuły.
      const eqMatch = /^=+/.exec(trimmed);
      const leadingEq = eqMatch ? eqMatch[0].length : 0;
      const body = trimmed.replace(/^=+/, '').trim();

      let problem: string | null = null;
      if (body === '') {
        // "", "=", "==", "   " → brak treści formuły.
        problem = 'formuła jest pusta (brak treści po ewentualnym „=")';
      } else if (leadingEq >= 2) {
        // "==SUM(...)" — podwojony `=`; sanityzacja usuwa oba, ale to defekt LLM.
        problem = `formuła ma ${leadingEq} wiodących znaków „=" (\`${trimmed.slice(0, 14)}…\`) — poprawna formuła nie może zaczynać się od „=="`;
      }
      // Pojedyncze wiodące `=` = konwencja kodu (builder je sanityzuje) → NIE flaga.
      if (!problem) return;

      out.push(
        issue(
          'WQ-07-BAD-FORMULA-SYNTAX',
          'formula_error',
          'CRITICAL',
          sheet.name,
          `Zła składnia formuły w ${addr}: ${problem}. Werbatim do ExcelJS zepsuje plik (element <f> w XML).`,
          {
            cell: addr,
            col: col.key,
            fix: 'Zapisz czystą formułę z co najwyżej jednym wiodącym „=" i niepustą treścią (np. "SUM(B2:B4)").',
          }
        )
      );
    });
  });
  return out;
}

// ── Reguła 8: cross-sheet ref do istniejącego arkusza, ale poza zakresem ─────
//
// WQ-06 łapie cross-sheet ref do NIEISTNIEJĄCEGO arkusza (CRITICAL) i out-of-bounds
// TYLKO dla formuł BEZ cross-sheet (`sheetRefs.length === 0`). Luka: ref do
// ISTNIEJĄCEGO arkusza z komórką poza zapełnionym zakresem DOCELOWEGO arkusza
// (np. `=Data!Z999`, gdzie `Data` ma 1 kolumnę / 1 wiersz) — nie był oceniany.
// WQ-08 domyka lukę. MAJOR (nie CRITICAL): out-of-bounds ref daje 0/#REF ale nie
// psuje samego pliku. Nie duplikuje WQ-06: obsługuje wyłącznie arkusze ISTNIEJĄCE.
function checkCrossSheetOutOfBounds(workbook: WorkbookSchema): WorkbookIssue[] {
  const out: WorkbookIssue[] = [];
  const sheetByName = new Map<string, Sheet>();
  for (const s of workbook.sheets) sheetByName.set(norm(s.name), s);

  for (const sheet of workbook.sheets) {
    sheet.rows.forEach((row, rowIdx) => {
      sheet.columns.forEach((col, colIdx) => {
        const c = row.cells[col.key];
        if (!c?.formula) return;
        // Dopasuj: 'Sheet Name'!A1  albo  Sheet!A1  (z opcjonalnymi $).
        const re = /'([^']+)'!\$?([A-Z]+)\$?(\d+)|([A-Za-z0-9_]+)!\$?([A-Z]+)\$?(\d+)/g;
        let m: RegExpExecArray | null;
        while ((m = re.exec(c.formula)) !== null) {
          const name = (m[1] ?? m[4] ?? '').trim();
          const letter = m[2] ?? m[5];
          const rnumStr = m[3] ?? m[6];
          if (!name || !letter || !rnumStr) continue;
          const target = sheetByName.get(norm(name));
          if (!target) continue; // nieistniejący arkusz → domena WQ-06, nie duplikujemy
          const { maxCol, maxRow } = sheetBounds(target);
          const idx = colLetterToIndex(letter);
          const rnum = parseInt(rnumStr, 10);
          if (idx > maxCol || rnum > maxRow) {
            const addr = cellAddress(colIdx, rowIdx);
            const lastCell = `${colIndexToLetter(maxCol - 1)}${maxRow}`;
            out.push(
              issue(
                'WQ-08-CROSS-SHEET-OOB',
                'formula_error',
                'MAJOR',
                sheet.name,
                `Formuła w ${addr} referuje „${name}!${letter}${rnum}" poza zakresem danych arkusza „${target.name}" (ostatnia komórka ${lastCell}).`,
                {
                  cell: addr,
                  col: col.key,
                  fix: `Popraw referencję — „${target.name}" ma dane do ${lastCell}.`,
                }
              )
            );
            break; // jedna flaga na formułę wystarczy
          }
        }
      });
    });
  }
  return out;
}

// ── Reguła 9: kolumna mieszająca formuły ze stałymi ──────────────────────────
//
// LLM „zapomina" formuły w jednej komórce kolumny obliczeniowej: reszta kolumny
// to formuły, jedna komórka to goła stała. Deterministycznie wykrywalne, ale
// GRANICA jest kluczowa dla braku false-positive — patrz warunki niżej.
//
// GRANICA HEURYSTYKI (świadomie wąska — Prawda > szeroka reguła):
//   • Rozważamy TYLKO wiersze danych (pomijamy header i summary/total — total
//     legalnie bywa stałą lub inną formułą; WQ-01/WQ-02 zajmują się totalami).
//   • Kolumna jest „obliczeniowa" gdy ≥2 komórki danych to formuły ORAZ formuły
//     stanowią WIĘKSZOŚĆ (>50%) niepustych komórek danych. To odróżnia realną
//     kolumnę wyliczaną z jednym brakiem od legalnej kolumny mieszanej (np.
//     „Wartość": część ręczna, część liczona — tam formuły NIE są większością
//     albo jest ich <2, więc nie flagujemy).
//   • Zgłaszamy DOKŁADNIE te komórki danych, które są gołą liczbą (stałą) w takiej
//     kolumnie. Tekst/bool/pusta komórka NIE jest defektem (to nie „zapomniana
//     formuła", tylko brak danych/etykieta).
function checkInconsistentCalcColumns(sheet: Sheet): WorkbookIssue[] {
  const out: WorkbookIssue[] = [];

  sheet.columns.forEach((col, colIdx) => {
    // Zbierz komórki danych (bez header/summary) tej kolumny.
    let formulaCount = 0;
    let constNumberCount = 0;
    const constNumberRows: number[] = [];

    sheet.rows.forEach((row, rowIdx) => {
      if (row.isHeader || isSummaryRow(row, sheet.columns)) return;
      const c = row.cells[col.key];
      if (!c) return;
      if (typeof c.formula === 'string' && c.formula.trim() !== '') {
        formulaCount++;
      } else if (!c.formula && typeof c.value === 'number' && Number.isFinite(c.value)) {
        constNumberCount++;
        constNumberRows.push(rowIdx);
      }
      // tekst / bool / null / puste → ignorujemy (nie „zapomniana formuła")
    });

    const nonEmpty = formulaCount + constNumberCount;
    // Granica: ≥2 formuły, formuły są większością, i istnieje ≥1 goła stała.
    const isCalcColumn = formulaCount >= 2 && formulaCount > nonEmpty / 2;
    if (!isCalcColumn || constNumberCount === 0) return;

    for (const rowIdx of constNumberRows) {
      const addr = cellAddress(colIdx, rowIdx);
      out.push(
        issue(
          'WQ-09-INCONSISTENT-CALC-COL',
          'validation_failed',
          'MAJOR',
          sheet.name,
          `Kolumna obliczeniowa „${col.header}" ma formuły w ${formulaCount} komórkach, ale ${addr} to goła stała — prawdopodobnie zapomniana formuła.`,
          {
            cell: addr,
            col: col.key,
            fix: `Wstaw w ${addr} formułę spójną z resztą kolumny „${col.header}".`,
          }
        )
      );
    }
  });
  return out;
}

// ── DX-01: warstwa ZAŁOŻEŃ (A1) istnieje i jest jedyna ───────────────────────
//
// Doktryna treści Excela §2 (anatomia warstw) + §5.2 DX-01 + §9 AW-2.
// Luka L4: `checkAssumptionsSeparation` (WQ-03) robi early-return, gdy arkusza
// Założeń NIE MA — więc model, w którym drivery są rozsiane po arkuszach i
// którego NIE DA SIĘ zasymulować, przechodził na 100/100. Decyzja CTO D4/D-6:
// CRITICAL blokujący, bo „model bez Założeń to nie jest model".
//
// GRANICA (świadomie wąska — Prawda > szeroka reguła; doktryna §2 „minimum żywotne"):
//   • ≥2 arkusze. Arkusz z JEDNĄ zakładką to z definicji doktryny nie model, tylko
//     TABELA — podlega `DOKTRYNA_TABELA_NIE_EXCEL.md`, nie tej doktrynie (§2, koniec).
//     Eksport tabeli/listy do .xlsx nie może być karany za brak Założeń.
//   • ≥1 formuła w całym skoroszycie. Zero formuł = zrzut danych, nie model —
//     nie ma czego symulować, więc nie ma czego zakładać (§1, test symulacji).
//   Dopiero skoroszyt, który JEST modelem (wiele warstw + policzone wyniki), a
//   nie ma warstwy wejść, jest defektem doktrynalnym.
function checkAssumptionsLayer(workbook: WorkbookSchema): WorkbookIssue[] {
  const sheets = workbook.sheets;
  if (sheets.length < 2) return []; // jedna zakładka = tabela, nie model

  const hasFormula = sheets.some((s) =>
    s.rows.some((r) =>
      Object.values(r.cells).some((c) => typeof c?.formula === 'string' && c.formula.trim() !== '')
    )
  );
  if (!hasFormula) return []; // zrzut danych, nie model

  const assumptionSheets = sheets.filter(isAssumptionsSheet);

  if (assumptionSheets.length === 0) {
    return [
      issue(
        'DX-01-NO-ASSUMPTIONS-LAYER',
        'validation_failed',
        'CRITICAL',
        sheets[0].name,
        `Model (${sheets.length} arkuszy, formuły obecne) NIE MA warstwy Założeń — brak arkusza wejść ` +
          `(„Założenia"/„Assumptions"/„Inputs" albo isAssumptions: true). Bez wyodrębnionych wejść nie da się ` +
          `nic zasymulować ani zaudytować (doktryna treści Excela §2 A1, AW-2).`,
        {
          fix:
            'Dodaj arkusz „Założenia" (isAssumptions: true) ze WSZYSTKIMI surowymi wejściami ' +
            '(driver · wartość · jednostka · źródło · zakres) i podmień stałe w pozostałych arkuszach ' +
            "na referencje typu 'Założenia'!$B$3.",
        }
      ),
    ];
  }

  if (assumptionSheets.length > 1) {
    // R-A1: jeden model = jedno źródło wejść (FAST: single source of truth).
    // MAJOR, nie CRITICAL: model jest symulowalny, ale ma dwa źródła prawdy.
    return [
      issue(
        'DX-01-NO-ASSUMPTIONS-LAYER',
        'validation_failed',
        'MAJOR',
        assumptionSheets[1].name,
        `Skoroszyt ma ${assumptionSheets.length} arkusze Założeń (${assumptionSheets
          .map((s) => `„${s.name}"`)
          .join(', ')}) — jeden model = JEDNO źródło wejść (doktryna §2 R-A1).`,
        {
          fix: 'Scal wejścia do jednego arkusza Założeń; pozostałe arkusze mają referować do niego.',
        }
      ),
    ];
  }

  return [];
}

// ── DX-02: odwołania cykliczne w grafie formuł ───────────────────────────────
//
// Doktryna §3.5 („Zero odwołań cyklicznych", zakaz B10 `BUSINESS_PLAN_GENERATOR_SPEC`)
// + §5.2 DX-02 + §9 AW-5. Luka L3: klasa `formula_cycle_detected` istniała w
// taksonomii P23, ale żadna reguła jej nie emitowała.
//
// Pracujemy na `WorkbookSchema` (PRZED buildem), nie na wygenerowanym pliku:
// budujemy graf zależności komórka→komórka z formuł i szukamy cyklu (DFS z
// kolorowaniem). Krawędzie prowadzą WYŁĄCZNIE do komórek, które same są formułami
// — stała jest liściem i nie może domknąć cyklu.
//
// GRANICA (brak false-positive):
//   • Ref rozpoznajemy tylko wtedy, gdy rozwiązuje się do ISTNIEJĄCEJ komórki
//     w schemacie (arkusz + kolumna + wiersz w granicach). Nazwane zakresy,
//     funkcje i literały nie tworzą krawędzi.
//   • Token, po którym stoi „(", to NAZWA FUNKCJI (np. LOG10(...)), nie adres.
//   • Token poprzedzony literą/cyfrą/podkreśleniem to fragment identyfikatora
//     (np. named range „Scen1_B2"), nie adres.
//   • Zakresy (B2:B10) rozwijamy do komórek — `SUM(B2:B5)` w komórce B5 to
//     realny cykl w Excelu, nie artefakt heurystyki.
//   • Twardy limit węzłów (perf) — powyżej progu reguła milczy zamiast zgadywać.

/** Limit węzłów-formuł, powyżej którego rezygnujemy z analizy grafu (perf, fail-open). */
const CYCLE_MAX_FORMULA_NODES = 20000;
/** Limit komórek rozwijanych z jednego zakresu (perf). */
const CYCLE_MAX_RANGE_CELLS = 5000;

/** Wyciąga adresy komórek/zakresów z formuły. Zwraca surowe trójki (arkusz|null, kol, wiersz). */
function extractCellRefs(
  formula: string
): Array<{ sheet: string | null; c1: number; r1: number; c2: number; r2: number }> {
  const out: Array<{ sheet: string | null; c1: number; r1: number; c2: number; r2: number }> = [];
  const re =
    /(?:'([^']+)'!|([A-Za-z][A-Za-z0-9_ ]*)!)?\$?([A-Z]{1,3})\$?(\d{1,7})(?::\$?([A-Z]{1,3})\$?(\d{1,7}))?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(formula)) !== null) {
    const after = formula[re.lastIndex];
    if (after === '(') continue; // nazwa funkcji (LOG10(…)), nie adres
    const before = m.index > 0 ? formula[m.index - 1] : '';
    // Fragment identyfikatora (named range) — nie adres. Znak „!" jest częścią dopasowania,
    // więc poprzednik litera/cyfra/_ oznacza sklejkę typu „Scen1_B2".
    if (before && /[A-Za-z0-9_]/.test(before) && !m[1] && !m[2]) continue;
    const sheet = m[1] ?? m[2] ?? null;
    const c1 = colLetterToIndex(m[3]);
    const r1 = parseInt(m[4], 10);
    const c2 = m[5] ? colLetterToIndex(m[5]) : c1;
    const r2 = m[6] ? parseInt(m[6], 10) : r1;
    out.push({
      sheet: sheet ? sheet.trim() : null,
      c1: Math.min(c1, c2),
      r1: Math.min(r1, r2),
      c2: Math.max(c1, c2),
      r2: Math.max(r1, r2),
    });
  }
  return out;
}

function checkFormulaCycles(workbook: WorkbookSchema): WorkbookIssue[] {
  const out: WorkbookIssue[] = [];

  // 1. Indeks węzłów: tylko komórki Z FORMUŁĄ (stała = liść, nie domknie cyklu).
  //    id = "<norm(sheet)>!<col1based>:<excelRow>"
  const nodeId = (sheetKey: string, col: number, row: number) => `${sheetKey}!${col}:${row}`;
  const formulaOf = new Map<string, string>();
  const labelOf = new Map<string, string>();
  const sheetByKey = new Map<string, Sheet>();

  for (const sheet of workbook.sheets) {
    const key = norm(sheet.name);
    sheetByKey.set(key, sheet);
    sheet.rows.forEach((row, rowIdx) => {
      sheet.columns.forEach((col, colIdx) => {
        const c = row.cells[col.key];
        if (typeof c?.formula !== 'string' || c.formula.trim() === '') return;
        const id = nodeId(key, colIdx + 1, dataRowNumber(rowIdx));
        formulaOf.set(id, c.formula);
        labelOf.set(id, `${sheet.name}!${cellAddress(colIdx, rowIdx)}`);
      });
    });
  }
  if (formulaOf.size === 0 || formulaOf.size > CYCLE_MAX_FORMULA_NODES) return out;

  // 2. Krawędzie: formuła → referowane komórki, które SAME są formułami.
  const edges = new Map<string, string[]>();
  for (const [id, formula] of formulaOf) {
    const ownerSheetKey = id.slice(0, id.lastIndexOf('!'));
    const targets = new Set<string>();
    for (const ref of extractCellRefs(formula)) {
      const targetKey = ref.sheet ? norm(ref.sheet) : ownerSheetKey;
      const target = sheetByKey.get(targetKey);
      if (!target) continue; // nieistniejący arkusz → domena WQ-06
      const { maxCol, maxRow } = sheetBounds(target);
      if ((ref.c2 - ref.c1 + 1) * (ref.r2 - ref.r1 + 1) > CYCLE_MAX_RANGE_CELLS) continue;
      for (let c = ref.c1; c <= Math.min(ref.c2, maxCol); c++) {
        for (let r = Math.max(ref.r1, 2); r <= Math.min(ref.r2, maxRow); r++) {
          const tid = nodeId(targetKey, c, r);
          if (formulaOf.has(tid)) targets.add(tid);
        }
      }
    }
    edges.set(id, [...targets]);
  }

  // 3. DFS z kolorowaniem (0=biały, 1=szary/na stosie, 2=czarny) — pierwszy powrót
  //    do węzła szarego domyka cykl. Deduplikacja po zbiorze węzłów cyklu.
  const color = new Map<string, 0 | 1 | 2>();
  const seenCycles = new Set<string>();

  const reportCycle = (path: string[]) => {
    const fingerprint = [...path].sort().join('|');
    if (seenCycles.has(fingerprint)) return;
    seenCycles.add(fingerprint);
    const head = path[0];
    const [sheetKey] = head.split('!');
    const sheetName = sheetByKey.get(sheetKey)?.name ?? sheetKey;
    const chain = [...path, path[0]].map((n) => labelOf.get(n) ?? n).join(' → ');
    const headLabel = labelOf.get(head) ?? head;
    out.push(
      issue(
        'DX-02-FORMULA-CYCLE',
        'formula_cycle_detected',
        'CRITICAL',
        sheetName,
        `Odwołanie cykliczne w formułach: ${chain}. Excel pokaże 0 albo ostrzeżenie — model traci ` +
          `wiarygodność (doktryna treści Excela §3.5, AW-5).`,
        {
          cell: headLabel.includes('!') ? headLabel.split('!')[1] : null,
          fix:
            'Przeprojektuj łańcuch obliczeń tak, by graf był ACYKLICZNY (doktryna §4 E3) — ' +
            'np. licz odsetki od salda OTWARCIA okresu, nie od salda średniego; total nie może sumować sam siebie.',
        }
      )
    );
  };

  const visit = (start: string) => {
    // Iteracyjny DFS (bez rekurencji — arkusze bywają duże).
    const stack: Array<{ id: string; iter: number }> = [{ id: start, iter: 0 }];
    const path: string[] = [];
    const onPath = new Set<string>();
    color.set(start, 1);
    path.push(start);
    onPath.add(start);

    while (stack.length > 0) {
      const frame = stack[stack.length - 1];
      const next = (edges.get(frame.id) ?? [])[frame.iter++];
      if (next === undefined) {
        color.set(frame.id, 2);
        stack.pop();
        onPath.delete(path.pop() as string);
        continue;
      }
      if (onPath.has(next)) {
        // Cykl: wytnij fragment ścieżki od `next` do końca.
        const from = path.indexOf(next);
        reportCycle(path.slice(from));
        continue;
      }
      if ((color.get(next) ?? 0) === 2) continue;
      color.set(next, 1);
      path.push(next);
      onPath.add(next);
      stack.push({ id: next, iter: 0 });
    }
  };

  for (const id of formulaOf.keys()) {
    if ((color.get(id) ?? 0) === 0) visit(id);
  }

  return out;
}

// ── Główna funkcja ───────────────────────────────────────────────────────────

/**
 * Ocenia CAŁY workbook (schema przed buildem) wg 11 deterministycznych reguł:
 * 9 mechanicznych (WQ-01…WQ-09) + 2 doktrynalne (DX-01 warstwa Założeń, DX-02 cykle).
 * Zwraca `{ score, issues, passed }`. Fail-open: nigdy nie rzuca.
 */
export function critiqueWorkbook(workbook: WorkbookSchema): WorkbookQualityReport {
  if (!workbook || !Array.isArray(workbook.sheets) || workbook.sheets.length === 0) {
    return { score: 100, issues: [], passed: true };
  }

  const issues: WorkbookIssue[] = [];
  try {
    for (const sheet of workbook.sheets) {
      issues.push(...checkMagicNumbers(sheet));
      issues.push(...checkSumCoverage(sheet));
      issues.push(...checkFormatConsistency(sheet));
      issues.push(...checkFormulaSyntax(sheet));
      issues.push(...checkInconsistentCalcColumns(sheet));
    }
    issues.push(...checkAssumptionsSeparation(workbook));
    issues.push(...checkBrokenFormulaRefs(workbook));
    issues.push(...checkCrossSheetOutOfBounds(workbook));
    // Bramki doktrynalne (blokujące wg decyzji CTO D4): warstwa Założeń + brak cykli.
    issues.push(...checkAssumptionsLayer(workbook));
    issues.push(...checkFormulaCycles(workbook));
  } catch (err) {
    // Fail-open jak deckDesignCritic — krytyk NIGDY nie wywala generacji.
    logger.warn('[workbookQualityGate] critic threw, returning partial report', err);
  }

  const penalty = issues.reduce((sum, i) => sum + SEVERITY_PENALTY[i.severity], 0);
  const score = Math.max(0, 100 - penalty);
  const passed = !issues.some((i) => i.severity === 'CRITICAL');

  if (!passed) {
    logger.warn('[workbookQualityGate] workbook has CRITICAL issues', {
      count: issues.length,
      critical: issues.filter((i) => i.severity === 'CRITICAL').length,
      score,
    });
  }

  return { score, issues, passed };
}

/** Czy warto regenerować arkusz? (są issues CRITICAL). Analog shouldRegenerate. */
export function shouldRegenerateWorkbook(report: WorkbookQualityReport): boolean {
  return !report.passed;
}
