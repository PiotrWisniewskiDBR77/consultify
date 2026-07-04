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
 *
 * Deterministyczny i fail-open, jak deckDesignCritic. Werdykt „passed" = brak CRITICAL.
 */

import { createP23Error, type P23ErrorCode } from '../v8/exceleCanon.js';
import type { WorkbookSchema, Sheet, Row, ColumnDef } from './WorkbookSchema.js';
import logger from '../../utils/Logger.js';

// ── Typy ─────────────────────────────────────────────────────────────────────

export type WorkbookIssueSeverity = 'CRITICAL' | 'MAJOR' | 'MINOR';

/** Deterministyczne reguły krytyka (stabilne kody dla telemetrii). */
export type WorkbookRuleCode =
  | 'WQ-01-MAGIC-NUMBER'
  | 'WQ-02-SUM-COVERAGE'
  | 'WQ-03-ASSUMPTIONS-DUP'
  | 'WQ-04-FORMAT-MIX'
  | 'WQ-05-PERCENT-FORMAT'
  | 'WQ-06-BROKEN-FORMULA-REF';

export interface WorkbookIssue {
  /** Stabilny kod reguły krytyka. */
  code: WorkbookRuleCode;
  /** Kod z kanonu P23 (spójna klasyfikacja z resztą silnika). */
  canonCode: P23ErrorCode;
  severity: WorkbookIssueSeverity;
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

/** Excel-owy numer wiersza dla wiersza danych o indeksie 0-based (header=1). */
function dataRowNumber(rowIdx: number): number {
  return rowIdx + 2;
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
  extra?: { cell?: string | null; col?: string | null; fix?: string },
): WorkbookIssue {
  return {
    code,
    canonCode,
    severity,
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
  const computedCols = new Set(
    sheet.columns.filter(isComputedColumn).map((c) => c.key),
  );

  sheet.rows.forEach((row, rowIdx) => {
    const summary = isSummaryRow(row, sheet.columns);
    sheet.columns.forEach((col, colIdx) => {
      const c = row.cells[col.key];
      if (!c) return;
      const isConstNumber =
        !c.formula && typeof c.value === 'number' && Number.isFinite(c.value);
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
            },
          ),
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
            },
          ),
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
            },
          ),
        );
      }
    });
  });
  return out;
}

// ── Reguła 3: separacja Assumptions ──────────────────────────────────────────

function checkAssumptionsSeparation(workbook: WorkbookSchema): WorkbookIssue[] {
  const out: WorkbookIssue[] = [];
  const assumptionsSheet = workbook.sheets.find((s) => matchesAny(s.name, ASSUMPTIONS_SHEET_HINTS));
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
              },
            ),
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
            },
          ),
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
          },
        ),
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
          },
        ),
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
    const maxCol = sheet.columns.length; // liczba kolumn (A..)
    const maxRow = sheet.rows.length + 1; // +1 nagłówek

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
                },
              ),
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
            // litera → indeks
            let idx = 0;
            for (let k = 0; k < letter.length; k++) {
              idx = idx * 26 + (letter.charCodeAt(k) - 64);
            }
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
                  },
                ),
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

// ── Główna funkcja ───────────────────────────────────────────────────────────

/**
 * Ocenia CAŁY workbook (schema przed buildem) wg 6 deterministycznych reguł.
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
    }
    issues.push(...checkAssumptionsSeparation(workbook));
    issues.push(...checkBrokenFormulaRefs(workbook));
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
