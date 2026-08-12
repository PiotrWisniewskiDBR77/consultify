/**
 * WorkbookStyler — consultant-grade, deterministic styling helpers for ExcelJS
 * workbooks.
 *
 * Rationale (Vegas Fala 6 / Harvard generators): the AI generator emits a
 * WorkbookSchema whose *styling* fields (headerStyle, alternateRowColor,
 * number formats, alignment) are frequently omitted by the LLM. The result is
 * "bardzo mało formatowania" — raw grids. These helpers let WorkbookBuilder
 * enforce a professional visual standard independent of what the LLM produced.
 *
 * IMPORTANT: nothing here inserts or shifts rows. The data-sheet header stays
 * on row 1 so every formula reference (B2, SUM(B2:B10)) and cross-sheet link
 * (='Assumptions'!B2) the LLM emitted remains valid. Branding/title/date live
 * on a dedicated leading "Info" sheet (see addInfoSheet), never inline.
 *
 * Palette doctrine: navy (#0C447C) is the brand fill for headers/branding.
 * Crimson is NEVER used as a fill (project doctrine: crimson=accent/status
 * only, not chrome).
 */

import type ExcelJS from 'exceljs';

import type { ColumnDef, Sheet, WorkbookSchema } from './WorkbookSchema.js';

// ---------------------------------------------------------------------------
// Brand palette (ARGB — ExcelJS wants a leading alpha byte)
// ---------------------------------------------------------------------------

export const PALETTE = {
  navy: 'FF0C447C',
  navySoft: 'FF1B5FA8',
  white: 'FFFFFFFF',
  ink: 'FF1F2933',
  muted: 'FF64748B',
  zebra: 'FFF3F7FB',
  summary: 'FFE8EEF6',
  gridline: 'FFD5DEE8',
  /** Subtle teal color-scale low → high for %/score columns. */
  scaleLow: 'FFDDEFF0',
  scaleMid: 'FF7FC7CB',
  scaleHigh: 'FF2E9098',
  infoTab: 'FF64748B',
} as const;

/** Navy header default as a 6-char hex (headerStyle.bgColor wants no alpha). */
export const HEADER_NAVY_HEX = '0C447C';
/** Subtle zebra fill as a 6-char hex (alternateRowColor wants no alpha). */
export const ZEBRA_HEX = 'F3F7FB';

// ---------------------------------------------------------------------------
// Typography — one consistent sans across the whole workbook
// ---------------------------------------------------------------------------

/**
 * The single font family used everywhere (header, body, Info sheet). Calibri is
 * the Office default and renders identically on the reviewer's machine — a
 * consultant workbook that mixes fonts reads as a "raw grid". Body 10.5pt /
 * header 11pt gives the calm, uniform typographic scale a designed sheet has.
 */
export const FONT_FAMILY = 'Calibri';
export const FONT_SIZE_BODY = 10.5;
export const FONT_SIZE_HEADER = 11;

// ---------------------------------------------------------------------------
// Number-format defaults by column type (locale-aware currency)
// ---------------------------------------------------------------------------

export type CurrencyHint = 'pln' | 'eur' | 'usd' | 'generic';

export interface StyleContext {
  currency?: CurrencyHint;
}

export function currencyFormat(currency: CurrencyHint | undefined): string {
  switch (currency) {
    case 'pln':
      return '# ##0.00" zł"';
    case 'eur':
      return '€#,##0.00';
    case 'usd':
      return '$#,##0.00';
    default:
      return '#,##0.00';
  }
}

/**
 * Accounting-grade currency format with NEGATIVES IN RED and parentheses — the
 * convention a finance reviewer expects. Positive uses the plain locale format;
 * negative reuses it wrapped in ( ) and coloured red via the [Red] token. Zero
 * renders as a dash (accounting blank). Used for currency columns when
 * consultant styling is on and the column can carry negatives (deltas, variance).
 */
export function accountingCurrencyFormat(currency: CurrencyHint | undefined): string {
  const pos = currencyFormat(currency);
  return `${pos};[Red](${pos});"–"`;
}

/** Per-type default number format. Returns undefined for text/boolean. */
export function defaultNumberFormat(
  type: string | undefined,
  ctx: StyleContext
): string | undefined {
  switch (type) {
    case 'currency':
      return currencyFormat(ctx.currency);
    case 'percent':
      return '0.0%';
    case 'number':
      return '#,##0.##';
    case 'date':
      return 'yyyy-mm-dd';
    case 'rating':
      return '0';
    default:
      return undefined;
  }
}

// ---------------------------------------------------------------------------
// Alignment by column type: numbers/dates right, booleans center, text left
// ---------------------------------------------------------------------------

export function alignmentForType(type: string | undefined): 'left' | 'right' | 'center' {
  if (
    type === 'number' ||
    type === 'currency' ||
    type === 'percent' ||
    type === 'date' ||
    type === 'rating'
  ) {
    return 'right';
  }
  if (type === 'boolean') return 'center';
  return 'left';
}

// ---------------------------------------------------------------------------
// Content-aware column width (min/max clamp)
// ---------------------------------------------------------------------------

export const WIDTH_MIN = 10;
export const WIDTH_MAX = 48;

/**
 * Measures the widest content in a column (header + up to `sampleRows` cells)
 * and returns a clamped character width, with a per-type floor.
 */
export function computeColumnWidth(col: ColumnDef, sheet: Sheet, sampleRows = 200): number {
  let max = String(col.header ?? '').length + 2;
  const limit = Math.min(sheet.rows.length, sampleRows);
  for (let i = 0; i < limit; i++) {
    const cell = sheet.rows[i]?.cells?.[col.key];
    if (!cell) continue;
    const raw =
      cell.formula != null ? String(cell.formula) : cell.value != null ? String(cell.value) : '';
    if (raw.length > max) max = raw.length;
  }
  const typeFloor =
    col.type === 'currency' || col.type === 'number'
      ? 12
      : col.type === 'percent' || col.type === 'rating'
        ? 9
        : col.type === 'date'
          ? 12
          : WIDTH_MIN;
  return Math.max(typeFloor, Math.min(WIDTH_MAX, max + 1));
}

// ---------------------------------------------------------------------------
// Column letter helper
// ---------------------------------------------------------------------------

/** 1-based column index → Excel column letter(s) (1→A, 27→AA). */
export function colLetter(index: number): string {
  let n = index;
  let s = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s || 'A';
}

// ---------------------------------------------------------------------------
// Color-scale conditional formatting for %/score columns (best-effort)
// ---------------------------------------------------------------------------

const SCORE_HINT =
  /score|scoring|rating|ocena|wynik|priorytet|priority|index|indeks|readiness|dojrza/i;

/**
 * Returns the 1-based column indices that should receive a subtle teal
 * color-scale: any `percent` column, or a `number`/`percent` column whose key
 * or header looks like a score/rating/index. Only when the sheet already
 * defines its own CF for that column do we skip it (caller passes those refs).
 */
export function colorScaleColumns(sheet: Sheet): number[] {
  const out: number[] = [];
  sheet.columns.forEach((col, i) => {
    const isPercent = col.type === 'percent';
    const isScore =
      (col.type === 'number' || col.type === 'percent' || col.type === 'rating') &&
      (SCORE_HINT.test(col.key) || SCORE_HINT.test(col.header ?? ''));
    if (isPercent || isScore) out.push(i + 1);
  });
  return out;
}

/**
 * Adds a subtle 3-stop teal color scale to the given data range on a worksheet.
 * Header is assumed on row 1, data rows 2..(1+rowCount). No-op if too few rows.
 */
export function addSubtleColorScale(
  ws: ExcelJS.Worksheet,
  colIndex: number,
  rowCount: number
): void {
  if (rowCount < 2) return;
  const colL = colLetter(colIndex);
  const ref = `${colL}2:${colL}${rowCount + 1}`;
  try {
    ws.addConditionalFormatting({
      ref,
      rules: [
        {
          type: 'colorScale',
          priority: 1,
          cfvo: [{ type: 'min' }, { type: 'percentile', value: 50 }, { type: 'max' }],
          color: [
            { argb: PALETTE.scaleLow },
            { argb: PALETTE.scaleMid },
            { argb: PALETTE.scaleHigh },
          ],
        } as any,
      ],
    });
  } catch {
    /* CF is cosmetic — never fail the build over it */
  }
}

// ---------------------------------------------------------------------------
// Status semaphores — auto RAG fills for status/health text columns
// ---------------------------------------------------------------------------

/** A resolved semaphore fill (ARGB fill + readable font). */
export interface SemaphoreStyle {
  fill: string;
  font: string;
  bold?: boolean;
}

/** RAG palette for status chips (soft fills + readable ink; crimson=status ok). */
const SEMAPHORE = {
  green: { fill: 'FFE4F4EC', font: 'FF1D7A54', bold: true },
  amber: { fill: 'FFFDF3E0', font: 'FF9A6A00' },
  red: { fill: 'FFFCE4E4', font: 'FF85182F', bold: true },
  neutral: { fill: 'FFEEF2F7', font: 'FF64748B' },
} as const;

const GREEN_WORDS =
  /\b(on\s?track|done|complete|completed|healthy|ready|yes|green|ok|live|zielony|gotowe|zrealizowane|tak|ukończ)/i;
const RED_WORDS =
  /\b(at\s?risk|blocked|overdue|critical|fail|failed|red|no|needs?\s?evidence|missing|czerwony|ryzyko|zablokow|krytyczn|brak|nie\b)/i;
const AMBER_WORDS =
  /\b(in\s?progress|executing|partial|pending|review|amber|yellow|warning|w\s?toku|realizacja|częściow|oczekuj|żółty|uwaga)/i;

/**
 * Classifies a status-like cell string to a semaphore, or null when it does not
 * read as a status. Order matters: red beats amber beats green so "not on track"
 * lands red. Case/locale-tolerant (EN + PL).
 */
export function classifyStatus(value: unknown): SemaphoreStyle | null {
  const s = String(value ?? '').trim();
  if (!s || s.length > 40) return null;
  // UNKNOWN is an evidence state, not a positive outcome. Keep it visually
  // neutral even when surrounding copy contains words such as "ready".
  if (/^(unknown|nieznane|brak danych|n\/a)$/i.test(s)) return SEMAPHORE.neutral;
  if (RED_WORDS.test(s)) return SEMAPHORE.red;
  if (AMBER_WORDS.test(s)) return SEMAPHORE.amber;
  if (GREEN_WORDS.test(s)) return SEMAPHORE.green;
  return null;
}

/** Does this column's key/header read as a status/health/RAG column? */
const STATUS_HINT =
  /status|health|rag|stan|readiness|gotow|ryzyk|risk|state|flag|priorytet\s?flag/i;

export function looksLikeStatusColumn(col: ColumnDef): boolean {
  if (col.type && col.type !== 'text') return false;
  return STATUS_HINT.test(col.key) || STATUS_HINT.test(col.header ?? '');
}

// ---------------------------------------------------------------------------
// Metadata "Info" sheet (source, generation date, organization, inventory)
// ---------------------------------------------------------------------------

function fillOf(argb: string): ExcelJS.Fill {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb } };
}

export interface InfoSheetOptions {
  title: string;
  description?: string;
  organizationName?: string;
  source?: string;
  generatedAt?: string;
  author?: string;
  sheetNames: string[];
  extra?: Record<string, string>;
}

/**
 * Adds a leading "Info" sheet carrying the title/branding band plus metadata
 * (description, organization, source, generation date, author, sheet
 * inventory). No-op if an "Info" sheet already exists. Moved to first position.
 */
export function addInfoSheet(wb: ExcelJS.Workbook, opts: InfoSheetOptions): void {
  const NAME = 'Info';
  if (wb.getWorksheet(NAME)) return;

  const ws = wb.addWorksheet(NAME, {
    properties: { tabColor: { argb: PALETTE.infoTab } },
    views: [{ showGridLines: false }],
  });

  ws.getColumn(1).width = 26;
  ws.getColumn(2).width = 70;

  // Branding band.
  ws.mergeCells('A1:B1');
  const titleCell = ws.getCell('A1');
  titleCell.value = opts.title;
  titleCell.fill = fillOf(PALETTE.navy);
  titleCell.font = { bold: true, size: 15, color: { argb: PALETTE.white }, name: FONT_FAMILY };
  titleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  ws.getRow(1).height = 30;

  ws.mergeCells('A2:B2');
  const subCell = ws.getCell('A2');
  subCell.value = 'Consultify · konsultingowy arkusz roboczy';
  subCell.fill = fillOf(PALETTE.navySoft);
  subCell.font = { size: 10, color: { argb: PALETTE.white }, name: FONT_FAMILY };
  subCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  ws.getRow(2).height = 18;

  // Metadata rows. The sheet inventory is rendered below as a clickable Table
  // of Contents, so we no longer duplicate it here as a flat CSV.
  const rows: Array<[string, string | undefined]> = [
    ['', undefined],
    ['Opis / Description', opts.description],
    ['Organizacja / Organization', opts.organizationName],
    ['Źródło / Source', opts.source],
    ['Wygenerowano / Generated', opts.generatedAt],
    ['Autor / Author', opts.author],
  ];
  for (const [k, v] of Object.entries(opts.extra ?? {})) {
    rows.push([k, v]);
  }

  let r = 3;
  for (const [label, value] of rows) {
    if (value === undefined) {
      r++;
      continue;
    }
    const labelCell = ws.getCell(`A${r}`);
    labelCell.value = label;
    labelCell.font = { bold: true, size: 10, color: { argb: PALETTE.muted }, name: FONT_FAMILY };
    labelCell.alignment = { vertical: 'top', horizontal: 'left' };

    const valueCell = ws.getCell(`B${r}`);
    valueCell.value = value;
    valueCell.font = { size: 10, color: { argb: PALETTE.ink }, name: FONT_FAMILY };
    valueCell.alignment = { vertical: 'top', horizontal: 'left', wrapText: true };
    r++;
  }

  // Table of Contents — a clickable index into every data sheet. Only worth a
  // section when there is more than one sheet; a single-sheet workbook needs no
  // navigation. Each row hyperlinks (internal ref) to that sheet's A1.
  const tocSheets = opts.sheetNames.filter((n) => n && n !== NAME);
  if (tocSheets.length > 1) {
    r += 1; // one blank spacer row
    ws.mergeCells(`A${r}:B${r}`);
    const tocHead = ws.getCell(`A${r}`);
    tocHead.value = 'Spis arkuszy / Table of contents';
    tocHead.fill = fillOf(PALETTE.summary);
    tocHead.font = { bold: true, size: 11, color: { argb: PALETTE.navy }, name: FONT_FAMILY };
    tocHead.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    ws.getRow(r).height = 20;
    r++;

    tocSheets.forEach((name, i) => {
      const idxCell = ws.getCell(`A${r}`);
      idxCell.value = String(i + 1).padStart(2, '0');
      idxCell.font = { bold: true, size: 10, color: { argb: PALETTE.muted }, name: FONT_FAMILY };
      idxCell.alignment = { vertical: 'middle', horizontal: 'center' };

      const linkCell = ws.getCell(`B${r}`);
      // ExcelJS internal hyperlink: quote the sheet name so names with spaces
      // resolve. A1 is a stable anchor on every sheet.
      const safeName = name.replace(/'/g, "''");
      linkCell.value = {
        text: name,
        hyperlink: `#'${safeName}'!A1`,
      } as ExcelJS.CellHyperlinkValue;
      linkCell.font = {
        size: 10,
        color: { argb: PALETTE.navySoft },
        underline: true,
        name: FONT_FAMILY,
      };
      linkCell.alignment = { vertical: 'middle', horizontal: 'left' };
      r++;
    });
  }
  // Keep the compact metadata/index sheet on one printable page. Without an
  // explicit area LibreOffice can split the two-column Info sheet vertically
  // even though the content is short, producing an orphaned second page.
  ws.pageSetup = {
    ...(ws.pageSetup ?? {}),
    orientation: 'portrait',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 1,
    printArea: `A1:B${Math.max(r - 1, 2)}`,
    margins: {
      left: 0.4,
      right: 0.4,
      top: 0.5,
      bottom: 0.5,
      header: 0.2,
      footer: 0.2,
    },
  };
  // Note: tab position is determined by creation order in ExcelJS — callers
  // should create the Info sheet first if they want it as the leading tab.
}

// ---------------------------------------------------------------------------
// Currency inference from schema (best-effort locale hint; PL default)
// ---------------------------------------------------------------------------

export function inferCurrency(schema: WorkbookSchema): CurrencyHint {
  const hay = JSON.stringify({ t: schema.title, d: schema.description }).toLowerCase();
  if (hay.includes('zł') || hay.includes('pln') || hay.includes('złot')) return 'pln';
  if (hay.includes('€') || hay.includes('eur')) return 'eur';
  if (hay.includes('$') || hay.includes('usd')) return 'usd';
  for (const sheet of schema.sheets) {
    for (const col of sheet.columns) {
      const h = (col.header ?? '').toLowerCase();
      const fmt = (col.numberFormat ?? '').toLowerCase();
      if (h.includes('zł') || fmt.includes('zł')) return 'pln';
      if (h.includes('€') || fmt.includes('€')) return 'eur';
      if (h.includes('$') || fmt.includes('$')) return 'usd';
    }
  }
  return 'pln'; // Consultify default market = PL
}

// ---------------------------------------------------------------------------
// Autofilter — turn a header row into a filterable table header
// ---------------------------------------------------------------------------

/**
 * Adds an Excel autofilter over the header row + data range so a reviewer can
 * sort/filter every column — the affordance a real "table" has and a raw dump
 * lacks. Header on row 1, data rows 2..(1+rowCount). No-op for empty sheets or
 * single-column sheets (autofilter on one column is noise). Fail-soft.
 */
export function addAutoFilter(ws: ExcelJS.Worksheet, columnCount: number, rowCount: number): void {
  if (columnCount < 2 || rowCount < 1) return;
  const lastCol = colLetter(columnCount);
  try {
    ws.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: rowCount + 1, column: columnCount },
    };
  } catch {
    // Fallback to A1-string form if the object form is rejected.
    try {
      ws.autoFilter = `A1:${lastCol}${rowCount + 1}`;
    } catch {
      /* autofilter is cosmetic — never fail the build over it */
    }
  }
}

// ---------------------------------------------------------------------------
// Print / page setup — a deliverable that survives Ctrl+P
// ---------------------------------------------------------------------------

/**
 * Applies consultant-grade print setup to a data sheet: landscape, fit-all-
 * columns-to-one-page-wide, repeat the header row on every printed page, thin
 * margins, and a footer carrying the sheet name + page numbers. Fail-soft.
 */
export function applyPrintSetup(ws: ExcelJS.Worksheet, sheetName: string): void {
  try {
    ws.pageSetup = {
      ...(ws.pageSetup ?? {}),
      // Most decision sheets are deliberately narrow (2–4 semantic columns).
      // Portrait gives those exhibits materially better scale and avoids the
      // "tiny table floating on a landscape page" failure. Wider datasets keep
      // landscape so no column is clipped.
      orientation: ws.columnCount <= 4 ? 'portrait' : 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      showRowColHeaders: false,
      showGridLines: false,
      paperSize: 9,
      // Small decision tables should read as deliberate one-page exhibits,
      // not as raw cells stranded in the upper-left corner of a large page.
      horizontalCentered: true,
      verticalCentered: false,
      margins: {
        left: 0.4,
        right: 0.4,
        top: 0.5,
        bottom: 0.55,
        header: 0.3,
        footer: 0.3,
      },
      printTitlesRow: '1:1',
    };
    ws.headerFooter = {
      ...(ws.headerFooter ?? {}),
      oddFooter: `&L&"Calibri"&8&K64748B${sheetName}&C&"Calibri"&8&K64748BConsultify&R&"Calibri"&8&K64748BStrona &P z &N`,
    };
  } catch {
    /* print setup is cosmetic — never fail the build over it */
  }
}

/**
 * Gives short operational exhibits enough physical presence on paper without
 * changing values, formulas or provenance. A5 is intentional for narrow,
 * short decision tables: it removes the large A4 void while retaining a
 * readable one-page handout. Long-text source matrices remain A4.
 */
export function applyCompactPrintDensity(
  ws: ExcelJS.Worksheet,
  rowCount: number,
  columnCount: number,
  sheetName: string
): void {
  if (rowCount < 1 || rowCount > 12 || columnCount < 1 || columnCount > 4) return;
  const isSourceMatrix = /source|evidence|provenance/i.test(sheetName);
  const dataHeight = rowCount <= 4 ? 48 : rowCount <= 7 ? 34 : 25;
  ws.getRow(1).height = 28;
  for (let row = 2; row <= rowCount + 1; row++) {
    ws.getRow(row).height = isSourceMatrix ? Math.max(dataHeight, 54) : dataHeight;
    ws.getRow(row).eachCell((cell) => {
      cell.font = { ...(cell.font ?? {}), size: Math.max(Number(cell.font?.size ?? 0), 11) };
      cell.alignment = { ...(cell.alignment ?? {}), vertical: 'middle', wrapText: true };
    });
  }
  ws.pageSetup = {
    ...(ws.pageSetup ?? {}),
    orientation: isSourceMatrix ? 'landscape' : 'portrait',
    paperSize: isSourceMatrix ? 9 : 11,
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 1,
    horizontalCentered: true,
    verticalCentered: true,
  };
}
