/**
 * WorkbookBuilder — materializes a WorkbookSchema into a real .xlsx buffer via ExcelJS.
 *
 * Supports: multi-sheet, Excel formulas, rich formatting, freeze panes,
 * merged cells, alternating row colors, number formats, column widths.
 */

import ExcelJS from 'exceljs';

import logger from '../../utils/Logger.js';
import { createP23Error, type P23ClassifiedError } from '../v8/exceleCanon.js';
import { sanitizeSpreadsheetCellText } from './workbookExportSanitizer.js';
import type {
  CellStyle,
  ChartImage,
  ColumnDef,
  ConditionalFormattingBlock,
  ConditionalFormattingRule,
  DataValidation,
  ScenarioSwitch,
  SensitivityTable,
  WorkbookSchema,
} from './WorkbookSchema.js';
import {
  accountingCurrencyFormat,
  addAutoFilter,
  addInfoSheet,
  addSubtleColorScale,
  alignmentForType,
  applyPrintSetup,
  classifyStatus,
  colLetter as colLetterLocal,
  colorScaleColumns,
  FONT_FAMILY,
  FONT_SIZE_BODY,
  FONT_SIZE_HEADER,
  HEADER_NAVY_HEX,
  inferCurrency,
  looksLikeStatusColumn,
  type StyleContext,
  ZEBRA_HEX,
} from './WorkbookStyler.js';

/** Brand teal (ARGB) for the header underline rule. */
const HEADER_RULE_ARGB = 'FF1D9E75';

// ---------------------------------------------------------------------------
// D3 — financial-model font-color convention (market standard, doctrine §10 L5).
//
// Before this: the generator PROMPT talked about "blue-input / black-formula"
// but the builder only ever painted a background fill on input cells — the
// FONT color (the part that actually signals "you may type here" vs. "do not
// touch, this is calculated") was never set, and cross-sheet references had
// no visual signal at all. This block closes that gap for every model,
// existing and new:
//   • blue  → a raw input/assumption (a literal value living on an
//             `isAssumptions` sheet)
//   • black → a formula computed from cells on the SAME sheet
//   • green → a formula that reaches into ANOTHER sheet (cross-sheet ref)
// Applied automatically, but an explicit `style.fontColor` on the cell or
// column always wins — this never overrides deliberate schema intent.
// ---------------------------------------------------------------------------

const FONT_COLOR_INPUT_HEX = '0000FF'; // blue — editable assumption
const FONT_COLOR_FORMULA_HEX = '000000'; // black — local formula
const FONT_COLOR_CROSS_SHEET_HEX = '008000'; // green — formula referencing another sheet

/** A formula references another sheet iff it contains an Excel sheet-qualifier
 *  `!`. Every cross-sheet reference emitted by this codebase quotes the sheet
 *  name (`'Sheet Name'!B2`) and Excel formulas never use `!` for anything
 *  else, so a plain substring check is exact here (see templates/*.ts). */
function formulaReferencesOtherSheet(formula: string): boolean {
  return formula.includes('!');
}

// ---------------------------------------------------------------------------
// Style mapping
// ---------------------------------------------------------------------------

function mapAlignment(align?: string): Partial<ExcelJS.Alignment> {
  const result: Partial<ExcelJS.Alignment> = { vertical: 'middle' };
  if (align === 'center') result.horizontal = 'center';
  else if (align === 'right') result.horizontal = 'right';
  else result.horizontal = 'left';
  return result;
}

function hexToArgb(hex?: string): string | undefined {
  if (!hex) return undefined;
  const clean = hex.replace('#', '');
  if (clean.length === 6) return `FF${clean.toUpperCase()}`;
  if (clean.length === 8) return clean.toUpperCase();
  return undefined;
}

/** Normalize a #RRGGBB / RRGGBB theme color to a bare 6-char hex (no alpha).
 *  headerStyle.bgColor expects 6-char hex (hexToArgb adds the FF later). */
function normalizeHexForArgb(hex?: string): string | undefined {
  if (!hex) return undefined;
  const clean = hex.replace('#', '').toUpperCase();
  return /^[0-9A-F]{6}$/.test(clean) ? clean : undefined;
}

function mapBorder(style?: string): Partial<ExcelJS.Borders> | undefined {
  if (!style || style === 'none') return undefined;
  const s = style as ExcelJS.BorderStyle;
  return {
    top: { style: s },
    bottom: { style: s },
    left: { style: s },
    right: { style: s },
  };
}

function applyStyle(cell: ExcelJS.Cell, style?: CellStyle): void {
  if (!style) return;

  const font: Partial<ExcelJS.Font> = {};
  if (style.bold) font.bold = true;
  if (style.italic) font.italic = true;
  if (style.underline) font.underline = true;
  if (style.fontSize) font.size = style.fontSize;
  if (style.fontColor) font.color = { argb: hexToArgb(style.fontColor) };
  if (Object.keys(font).length > 0) cell.font = { ...cell.font, ...font };

  if (style.bgColor) {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: hexToArgb(style.bgColor) },
    };
  }

  if (style.alignment || style.wrapText) {
    cell.alignment = {
      ...mapAlignment(style.alignment),
      wrapText: style.wrapText ?? false,
    };
  }

  if (style.numberFormat) {
    cell.numFmt = style.numberFormat;
  }

  const border = mapBorder(style.border);
  if (border) cell.border = border;
}

// ---------------------------------------------------------------------------
// P4 — Data validation → ExcelJS cell.dataValidation
// ---------------------------------------------------------------------------

/**
 * Map our DataValidation schema to an ExcelJS DataValidation object. `list`
 * becomes a dropdown (comma-joined quoted formula, Excel's inline-list form);
 * `decimal`/`whole` become numeric bounds. Returns null for an unusable spec
 * (e.g. a list with no values) so the caller can skip it.
 */
function mapDataValidation(v: DataValidation): ExcelJS.DataValidation | null {
  const allowBlank = v.allowBlank ?? true;
  if (v.type === 'list') {
    if (!v.values || v.values.length === 0) return null;
    // Excel inline list: "\"A,B,C\"" — escape any embedded quotes/commas by
    // trusting Excel's quoted-list convention (commas inside are separators).
    const joined = v.values.map((s) => String(s).replace(/"/g, '')).join(',');
    return {
      type: 'list',
      allowBlank,
      formulae: [`"${joined}"`],
      showErrorMessage: true,
      showInputMessage: Boolean(v.prompt || v.promptTitle),
      ...(v.promptTitle ? { promptTitle: v.promptTitle } : {}),
      ...(v.prompt ? { prompt: v.prompt } : {}),
      ...(v.errorTitle ? { errorTitle: v.errorTitle } : {}),
      ...(v.error ? { error: v.error } : {}),
    };
  }
  // decimal | whole
  const operator = v.operator ?? 'between';
  const formulae: string[] = [];
  if (operator === 'between' || operator === 'notBetween') {
    if (v.min === undefined || v.max === undefined) return null;
    formulae.push(String(v.min), String(v.max));
  } else {
    if (v.min === undefined) return null;
    formulae.push(String(v.min));
  }
  return {
    type: v.type,
    operator,
    allowBlank,
    formulae,
    showErrorMessage: true,
    showInputMessage: Boolean(v.prompt || v.promptTitle),
    ...(v.promptTitle ? { promptTitle: v.promptTitle } : {}),
    ...(v.prompt ? { prompt: v.prompt } : {}),
    ...(v.errorTitle ? { errorTitle: v.errorTitle } : {}),
    ...(v.error ? { error: v.error } : {}),
  } as ExcelJS.DataValidation;
}

// ---------------------------------------------------------------------------
// Number format defaults by column type
// ---------------------------------------------------------------------------

const TYPE_FORMATS: Record<string, string> = {
  currency: '#,##0.00',
  percent: '0.00%',
  number: '#,##0.##',
  date: 'YYYY-MM-DD',
  rating: '0',
};

// ---------------------------------------------------------------------------
// X2 — Conditional Formatting → ExcelJS rules
// ---------------------------------------------------------------------------

/**
 * Mapuje CfRule (nasz schemat) na ExcelJS rule object. ExcelJS przyjmuje
 * pojedyncze `rule` per Object — multi-rule per range trzeba zrobić jako
 * osobne `addConditionalFormatting` calls (lub jedno z `rules: [...]`).
 */
function mapCfRule(rule: ConditionalFormattingRule, ruleIndex: number): any {
  switch (rule.type) {
    case 'dataBar':
      return {
        type: 'dataBar',
        priority: ruleIndex + 1,
        color: { argb: hexToArgb(rule.color) },
        showValue: rule.showValue ?? true,
        cfvo: [{ type: 'min' }, { type: 'max' }],
      };

    case 'colorScale':
      if (rule.colors.length === 2) {
        return {
          type: 'colorScale',
          priority: ruleIndex + 1,
          cfvo: [{ type: 'min' }, { type: 'max' }],
          color: [{ argb: hexToArgb(rule.colors[0]) }, { argb: hexToArgb(rule.colors[1]) }],
        };
      }
      // 3-color
      return {
        type: 'colorScale',
        priority: ruleIndex + 1,
        cfvo: [{ type: 'min' }, { type: 'percentile', value: 50 }, { type: 'max' }],
        color: [
          { argb: hexToArgb(rule.colors[0]) },
          { argb: hexToArgb(rule.colors[1]) },
          { argb: hexToArgb(rule.colors[2]) },
        ],
      };

    case 'iconSet':
      return {
        type: 'iconSet',
        priority: ruleIndex + 1,
        iconSet: rule.iconSet,
        showValue: rule.showValue ?? true,
        cfvo: [
          { type: 'percent', value: 0 },
          { type: 'percent', value: 33 },
          { type: 'percent', value: 67 },
        ],
      };

    case 'cellIs': {
      const style: any = {};
      if (rule.style.bold !== undefined) style.font = { bold: rule.style.bold };
      if (rule.style.fontColor) {
        style.font = { ...(style.font ?? {}), color: { argb: hexToArgb(rule.style.fontColor) } };
      }
      if (rule.style.bgColor) {
        style.fill = {
          type: 'pattern',
          pattern: 'solid',
          bgColor: { argb: hexToArgb(rule.style.bgColor) },
        };
      }
      return {
        type: 'cellIs',
        priority: ruleIndex + 1,
        operator: rule.operator,
        formulae: rule.formulae,
        style,
      };
    }

    default:
      // Discriminated union exhaustively handled above; defensive return.
      return null;
  }
}

function applyConditionalFormatting(
  ws: ExcelJS.Worksheet,
  blocks: ConditionalFormattingBlock[]
): void {
  for (const block of blocks) {
    const rules = block.rules.map((r, i) => mapCfRule(r, i)).filter(Boolean);
    if (rules.length === 0) continue;
    try {
      ws.addConditionalFormatting({
        ref: block.ref,
        rules,
      });
    } catch (e) {
      logger.warn(`[WorkbookBuilder] CF apply failed for ref=${block.ref}`, e);
    }
  }
}

// ---------------------------------------------------------------------------
// W7.7 — Auto-width helpers
// ---------------------------------------------------------------------------

/** Total-row sentinel labels (case-sensitive match on trimmed first-cell text). */
const TOTAL_ROW_LABELS = new Set(['TOTAL', 'Razem', 'Total', 'SUMA', 'Ogółem', 'Grand Total']);

/** Detect whether a row is a "total/summary" row by its first non-empty cell value. */
function isTotalRow(cells: Record<string, { value?: any; formula?: string }>): boolean {
  for (const key of Object.keys(cells)) {
    const raw = cells[key]?.value;
    if (raw !== undefined && raw !== null) {
      const str = String(raw).trim();
      if (TOTAL_ROW_LABELS.has(str)) return true;
      break; // only inspect first-present cell
    }
  }
  return false;
}

/** Return character-width estimate for a cell value (used for auto-width). */
function cellTextWidth(value: unknown): number {
  if (value === undefined || value === null) return 0;
  return String(value).length;
}

/**
 * Defensive formula sanitizer — ExcelJS writes the formula string VERBATIM into
 * the worksheet XML `<f>` element, and Excel requires that element WITHOUT a
 * leading `=` (a valid formula in XML is `SUM(A1:A2)`, not `=SUM(A1:A2)`). Our
 * generator prompt and schema convention emit `=`-prefixed formulas, so a raw
 * passthrough produces `<f>=SUM(...)</f>` → Excel treats the file as corrupt /
 * renders `#NAME?`. This strips any leading `=`/`==`(+) (after trimming) so the
 * real file is always valid regardless of how many `=` the input carries.
 *
 * Correctness-only: a formula that is already `=`-free is returned unchanged
 * (aside from trimming). This never alters the meaning of a valid formula.
 */
function sanitizeFormula(raw: string): string {
  return raw.trim().replace(/^=+/, '');
}

// ---------------------------------------------------------------------------
// P1 — Cached formula results for TRIVIAL, same-sheet, constant-input formulas
//
// ExcelJS writes `{ formula }` with no cached `<v>` result, so viewers that do
// not recalculate (Google Sheets preview, quick-look, some server renderers)
// show blanks for every formula cell. We set `workbook.calcProperties
// .fullCalcOnLoad = true` so Excel recomputes on open, AND — for a safe subset
// of formulas whose value we can compute deterministically from literal numeric
// constants on the SAME sheet — we attach the cached `result` so previews are
// correct immediately. We NEVER guess: cross-sheet refs, non-constant inputs,
// or any unsupported construct fall back to a bare `{ formula }` (no result).
// ---------------------------------------------------------------------------

/** Literal-numeric grid for one sheet: "B2" → 100000. Only cells whose schema
 *  value is a finite number are indexed; formula cells & text are excluded so
 *  we never fold a formula whose inputs are themselves formulas or strings. */
type NumericGrid = Map<string, number>;

/** A1 ref parser: "B2" → { col: 2, row: 2 }. Returns null on anything with a
 *  sheet qualifier (contains "!") or absolute markers we don't need here. */
function parseA1(ref: string): { col: number; row: number } | null {
  const m = /^([A-Z]+)(\d+)$/.exec(ref.trim().toUpperCase());
  if (!m) return null;
  let col = 0;
  for (const ch of m[1]) col = col * 26 + (ch.charCodeAt(0) - 64);
  return { col, row: parseInt(m[2], 10) };
}

/** Expand an A1 range "B2:B4" into the list of contained refs (row-major). */
function expandRange(a: string, b: string): string[] | null {
  const pa = parseA1(a);
  const pb = parseA1(b);
  if (!pa || !pb) return null;
  const refs: string[] = [];
  const r1 = Math.min(pa.row, pb.row);
  const r2 = Math.max(pa.row, pb.row);
  const c1 = Math.min(pa.col, pb.col);
  const c2 = Math.max(pa.col, pb.col);
  for (let r = r1; r <= r2; r++) {
    for (let c = c1; c <= c2; c++) {
      let col = '';
      let n = c;
      while (n > 0) {
        const rem = (n - 1) % 26;
        col = String.fromCharCode(65 + rem) + col;
        n = Math.floor((n - 1) / 26);
      }
      refs.push(`${col}${r}`);
    }
  }
  return refs;
}

/** Look up every cell ref in a numeric grid; return the resolved numbers or
 *  null if ANY ref is missing (i.e. not a literal number). */
function resolveRefs(refs: string[], grid: NumericGrid): number[] | null {
  const out: number[] = [];
  for (const ref of refs) {
    const v = grid.get(ref.toUpperCase());
    if (v === undefined || !Number.isFinite(v)) return null;
    out.push(v);
  }
  return out;
}

/**
 * Attempt to compute the numeric result of a TRIVIAL formula against a
 * same-sheet literal-number grid. Returns the number, or null when the formula
 * is anything we can't be 100% certain about (cross-sheet, functions we don't
 * whitelist, non-constant inputs, division by zero, etc.). Correctness over
 * coverage: a wrong cache is worse than no cache.
 */
function tryComputeFormula(rawFormula: string, grid: NumericGrid): number | null {
  let f = rawFormula.trim();
  if (f.startsWith('=')) f = f.slice(1);
  f = f.trim();
  if (!f) return null;

  // Reject anything touching another sheet (has "!") outright.
  if (f.includes('!')) return null;

  const upper = f.toUpperCase();

  // --- Aggregate form: SUM/AVERAGE/MIN/MAX/PRODUCT/COUNT( <range|list> ) ---
  const aggMatch = /^(SUM|AVERAGE|AVG|MIN|MAX|PRODUCT|COUNT)\(([^()]*)\)$/.exec(upper);
  if (aggMatch) {
    const fn = aggMatch[1];
    const inner = aggMatch[2].trim();
    if (!inner) return null;
    // Collect operands: comma-separated, each either a range A:B or a single ref
    // or a literal number.
    const nums: number[] = [];
    for (const partRaw of inner.split(',')) {
      const part = partRaw.trim();
      if (!part) return null;
      if (part.includes(':')) {
        const [a, b] = part.split(':');
        const refs = expandRange(a, b);
        if (!refs) return null;
        const vals = resolveRefs(refs, grid);
        if (!vals) return null;
        nums.push(...vals);
      } else if (/^-?\d+(\.\d+)?$/.test(part)) {
        nums.push(parseFloat(part));
      } else {
        const single = resolveRefs([part], grid);
        if (!single) return null;
        nums.push(single[0]);
      }
    }
    if (nums.length === 0) return null;
    switch (fn) {
      case 'SUM':
        return nums.reduce((a, b) => a + b, 0);
      case 'AVERAGE':
      case 'AVG':
        return nums.reduce((a, b) => a + b, 0) / nums.length;
      case 'MIN':
        return Math.min(...nums);
      case 'MAX':
        return Math.max(...nums);
      case 'PRODUCT':
        return nums.reduce((a, b) => a * b, 1);
      case 'COUNT':
        return nums.length;
      default:
        return null;
    }
  }

  // --- Arithmetic form: only cell refs, numbers, + - * / ( ) and spaces ---
  // (e.g. "B2-B3", "B2+B3+B4", "(B2-B3)/B2"). No function calls, no text.
  if (!/^[A-Z0-9.+\-*/()\s]+$/.test(upper)) return null;
  // Must reference at least one cell (pure-number formulas are pointless here
  // but harmless — allow them too). Substitute each A1 ref with its literal.
  const refTokens = upper.match(/[A-Z]+\d+/g) ?? [];
  let expr = upper;
  for (const token of refTokens) {
    const val = grid.get(token);
    if (val === undefined || !Number.isFinite(val)) return null;
    // Replace the whole token; wrap negatives in parens to preserve precedence.
    expr = expr.replace(new RegExp(`\\b${token}\\b`, 'g'), val < 0 ? `(${val})` : String(val));
  }
  // After substitution only numbers/operators/parens/spaces may remain.
  if (!/^[0-9.+\-*/()\s]+$/.test(expr)) return null;
  try {
    // eslint-disable-next-line no-new-func
    const result = Function(`"use strict"; return (${expr});`)() as unknown;
    if (typeof result === 'number' && Number.isFinite(result)) return result;
    return null;
  } catch {
    return null;
  }
}

/** Build the literal-numeric grid for a single sheet from its schema rows.
 *  Header is row 1, so schema row index i maps to Excel row i+2. Only cells
 *  whose resolved value is a finite number are indexed. */
function buildNumericGrid(sheetDef: WorkbookSchema['sheets'][number]): NumericGrid {
  const grid: NumericGrid = new Map();
  const colLetters = sheetDef.columns.map((_, i) => colLetterLocal(i + 1));
  for (let rowIdx = 0; rowIdx < sheetDef.rows.length; rowIdx++) {
    const rowDef = sheetDef.rows[rowIdx];
    const excelRow = rowIdx + 2;
    sheetDef.columns.forEach((col, colIdx) => {
      const cellDef = rowDef.cells[col.key];
      if (!cellDef || cellDef.formula) return; // exclude formula cells
      const raw = cellDef.value;
      if (raw === undefined || raw === null) return;
      const num = typeof raw === 'number' ? raw : parseFloat(String(raw));
      if (!Number.isFinite(num)) return;
      // Guard: only treat as numeric if the source really was numeric-ish
      // (avoid indexing "10 units" → 10). parseFloat on a pure number string
      // or a number is fine; reject strings with trailing non-numeric chars.
      if (typeof raw === 'string' && !/^\s*-?\d+(\.\d+)?\s*$/.test(raw)) return;
      grid.set(`${colLetters[colIdx]}${excelRow}`, num);
    });
  }
  return grid;
}

// ---------------------------------------------------------------------------
// P3 — Named ranges for Assumptions inputs
//
// Emits workbook-level defined names (e.g. `TaxRate` → 'Assumptions'!$B$5) for
// each input row of an assumptions sheet. ADDITIVE: it never rewrites existing
// formulas — a formula author *may* now use the friendly name, but every
// existing A1/cross-sheet reference stays valid. We only create a name when the
// label sanitizes to a valid, unique Excel name.
// ---------------------------------------------------------------------------

/** Does this sheet read as the assumptions/input sheet? */
const ASSUMPTIONS_HINT = /assumption|założen|zalozen|inputs?|dane\s?wej|parametr/i;

function isAssumptionsSheet(sheetDef: WorkbookSchema['sheets'][number]): boolean {
  if (sheetDef.isAssumptions) return true;
  return ASSUMPTIONS_HINT.test(sheetDef.name);
}

/**
 * Turn an arbitrary label ("Tax rate (%)", "Stopa podatku") into a valid Excel
 * defined-name: letters/digits/underscore only, must not start with a digit,
 * cannot look like a cell reference. Returns null when nothing usable remains.
 */
function sanitizeDefinedName(label: string): string | null {
  // Strip diacritics, then keep word chars, collapse the rest to underscores.
  const ascii = label
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (!ascii) return null;
  let name = ascii;
  // Excel names may not start with a digit and may not equal a cell ref.
  if (/^\d/.test(name)) name = `_${name}`;
  if (/^[A-Za-z]{1,3}\d+$/.test(name)) name = `${name}_`;
  // Reserved single letters R and C are illegal defined names in Excel.
  if (/^[RC]$/i.test(name)) name = `${name}_`;
  if (name.length > 255) name = name.slice(0, 255);
  return name;
}

/**
 * Build the [name, ref] pairs for an assumptions sheet. `ref` is a fully
 * qualified, absolute, quoted reference: 'Sheet Name'!$B$5. Uses the configured
 * (or inferred) key/value columns. Deduplicates names within the sheet.
 */
function assumptionNameRefs(
  sheetDef: WorkbookSchema['sheets'][number]
): Array<{ name: string; ref: string }> {
  const cols = sheetDef.columns;
  if (cols.length < 2) return [];

  const keyColKey = sheetDef.nameKeyColumn ?? cols[0].key;
  // Default value column: first numeric-ish column, else the 2nd column.
  const numericCol = cols.find(
    (c) =>
      c.type === 'number' || c.type === 'currency' || c.type === 'percent' || c.type === 'rating'
  );
  const valueColKey = sheetDef.nameValueColumn ?? numericCol?.key ?? cols[1].key;

  const valueColIdx = cols.findIndex((c) => c.key === valueColKey);
  if (valueColIdx < 0) return [];
  const valueColLetter = colLetterLocal(valueColIdx + 1);

  const quotedSheet = `'${sheetDef.name.replace(/'/g, "''")}'`;
  const seen = new Set<string>();
  const out: Array<{ name: string; ref: string }> = [];

  for (let rowIdx = 0; rowIdx < sheetDef.rows.length; rowIdx++) {
    const rowDef = sheetDef.rows[rowIdx];
    // Skip summary/total rows — they aren't inputs.
    if (rowDef.isSummary) continue;
    const keyCell = rowDef.cells[keyColKey];
    const valCell = rowDef.cells[valueColKey];
    if (!keyCell || valCell === undefined) continue;
    const label = keyCell.value;
    if (label === undefined || label === null || String(label).trim() === '') continue;

    const name = sanitizeDefinedName(String(label));
    if (!name) continue;
    const nameKey = name.toLowerCase();
    if (seen.has(nameKey)) continue; // first wins, keep it deterministic
    seen.add(nameKey);

    const excelRow = rowIdx + 2; // header on row 1
    const ref = `${quotedSheet}!$${valueColLetter}$${excelRow}`;
    out.push({ name, ref });
  }
  return out;
}

// ---------------------------------------------------------------------------
// EQ — A1 helpers shared by the equity-research primitives
// ---------------------------------------------------------------------------

/** A1 address from 1-based col/row (e.g. 2,3 → "B3"). */
function a1(col: number, row: number): string {
  return `${colLetterLocal(col)}${row}`;
}

/** Excel-safe string literal for a formula (double up any embedded quotes). */
function xlStr(s: string): string {
  return `"${String(s).replace(/"/g, '""')}"`;
}

/** Sanitize a scenario/driver label into a valid Excel defined-name fragment. */
function sanitizeNameFragment(label: string): string {
  const ascii = label
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return ascii || 'Item';
}

// ---------------------------------------------------------------------------
// EQ-A — Scenario switch: dropdown selector + CHOOSE/MATCH driver selection
//
// Layout (relative to the sheet's data area, appended BELOW existing rows so no
// data row is shifted and every prior A1/formula reference stays valid):
//
//   [selectorLabel] [selector cell ▼ Base/Bull/Bear]
//   [Driver]  [Active]                       [Base] [Bull] [Bear]
//   Revenue   =CHOOSE(MATCH($sel,{...},0),F,G,H)  0.05  0.08  0.02
//   ...
//
// The scenario band columns (Base/Bull/Bear) each get a workbook-level named
// range so the active formula reads `CHOOSE(MATCH(sel, ...), Rev_Base, Rev_Bull,
// Rev_Bear)` semantics via absolute refs, and the named ranges themselves cover
// the 3 distinct columns (proof: 3 columns, not 1).
// ---------------------------------------------------------------------------

function emitScenarioSwitch(
  wb: ExcelJS.Workbook,
  ws: ExcelJS.Worksheet,
  sheetDef: WorkbookSchema['sheets'][number],
  sw: ScenarioSwitch,
  startRow: number
): number {
  const nScen = sw.scenarios.length;
  // Validate column wiring; fail-soft on a malformed spec.
  const colKeys = sheetDef.columns.map((c) => c.key);
  const labelIdx = colKeys.indexOf(sw.labelColumn);
  const activeIdx = colKeys.indexOf(sw.activeColumn);
  const scenIdxs = sw.scenarioColumns.map((k) => colKeys.indexOf(k));
  if (
    labelIdx < 0 ||
    activeIdx < 0 ||
    sw.scenarioColumns.length !== nScen ||
    scenIdxs.some((i) => i < 0)
  ) {
    logger.warn('[WorkbookBuilder] scenarioSwitch skipped — column wiring invalid', {
      sheet: sheetDef.name,
    });
    return startRow;
  }

  const labelCol = labelIdx + 1;
  const activeCol = activeIdx + 1;
  const scenCols = scenIdxs.map((i) => i + 1);

  // 1) Selector row: label + dropdown cell.
  const selRow = startRow;
  const selectorA1 = sw.selectorCell ?? a1(activeCol, selRow);
  const selParsed = parseA1(selectorA1) ?? { col: activeCol, row: selRow };
  const selLabelCell = ws.getCell(a1(labelCol, selParsed.row));
  selLabelCell.value = sw.selectorLabel ?? 'Scenario';
  selLabelCell.font = { ...(selLabelCell.font ?? {}), bold: true };

  const selCell = ws.getCell(selectorA1);
  const active = sw.active && sw.scenarios.includes(sw.active) ? sw.active : sw.scenarios[0];
  selCell.value = active;
  selCell.dataValidation = {
    type: 'list',
    allowBlank: false,
    formulae: [`"${sw.scenarios.map((s) => s.replace(/"/g, '')).join(',')}"`],
    showErrorMessage: true,
  };
  selCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEAF2FB' } };
  selCell.font = { ...(selCell.font ?? {}), bold: true };
  selCell.border = {
    top: { style: 'thin' },
    bottom: { style: 'thin' },
    left: { style: 'thin' },
    right: { style: 'thin' },
  };

  // 2) Header row for the driver block.
  const headRow = selParsed.row + 2;
  ws.getCell(a1(labelCol, headRow)).value = 'Driver';
  ws.getCell(a1(activeCol, headRow)).value = 'Active';
  sw.scenarios.forEach((name, i) => {
    ws.getCell(a1(scenCols[i], headRow)).value = name;
  });
  [labelCol, activeCol, ...scenCols].forEach((c) => {
    const cell = ws.getCell(a1(c, headRow));
    cell.font = { ...(cell.font ?? {}), bold: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF2F7' } };
  });

  // 3) Driver rows: literals in the scenario band + CHOOSE(MATCH(...)) active cell.
  const seenNames = new Set<string>();
  let r = headRow + 1;
  const firstDriverRow = r;
  for (const driver of sw.drivers) {
    if (driver.values.length !== nScen) {
      logger.warn('[WorkbookBuilder] scenarioSwitch driver skipped — values/scenario mismatch', {
        sheet: sheetDef.name,
        driver: driver.label,
      });
      continue;
    }
    ws.getCell(a1(labelCol, r)).value = driver.label;

    // Scenario band: one literal per scenario column.
    scenCols.forEach((c, i) => {
      const cell = ws.getCell(a1(c, r));
      cell.value = driver.values[i];
      if (driver.numberFormat) cell.numFmt = driver.numberFormat;
    });

    // Active = CHOOSE(MATCH(selector, {scenarios}, 0), <scen1>, <scen2>, ...).
    const scenList = sw.scenarios.map(xlStr).join(',');
    const bandRefs = scenCols.map((c) => `$${colLetterLocal(c)}$${r}`).join(',');
    const activeFormula = `CHOOSE(MATCH($${colLetterLocal(selParsed.col)}$${selParsed.row},{${scenList}},0),${bandRefs})`;
    const activeCell = ws.getCell(a1(activeCol, r));
    activeCell.value = { formula: activeFormula } as ExcelJS.CellFormulaValue;
    if (driver.numberFormat) activeCell.numFmt = driver.numberFormat;
    activeCell.font = { ...(activeCell.font ?? {}), bold: true };

    // Per-driver named ranges over the 3 (or N) scenario columns — proof that
    // the band spans distinct columns, not one.
    const base = sanitizeNameFragment(driver.namePrefix ?? driver.label);
    sw.scenarios.forEach((name, i) => {
      let nm = `${base}_${sanitizeNameFragment(name)}`;
      if (/^\d/.test(nm)) nm = `_${nm}`;
      let uniq = nm;
      let k = 2;
      while (seenNames.has(uniq.toLowerCase())) uniq = `${nm}_${k++}`;
      seenNames.add(uniq.toLowerCase());
      const ref = `'${sheetDef.name.replace(/'/g, "''")}'!$${colLetterLocal(scenCols[i])}$${r}`;
      try {
        wb.definedNames.add(ref, uniq);
      } catch (e) {
        logger.warn(`[WorkbookBuilder] scenario definedName failed: ${uniq}`, e);
      }
    });
    r++;
  }
  void firstDriverRow;
  return r; // next free row
}

// ---------------------------------------------------------------------------
// EQ-B — Sensitivity table: N×M grid of output formulas + color-scale
//
// Corner cell at anchor; column inputs across the top; row inputs down the left;
// interior cells recompute `outputFormulaTemplate` with {col}/{row} substituted
// by the A1 of the header cell above / left of each interior cell. A subtle
// color-scale is applied over the interior for equity-research readability.
// Supports 1-D (no rowInputs → single output row) and 2-D grids.
// ---------------------------------------------------------------------------

function emitSensitivityTable(ws: ExcelJS.Worksheet, st: SensitivityTable): void {
  const anchor = parseA1(st.anchorCell);
  if (!anchor) {
    logger.warn('[WorkbookBuilder] sensitivityTable skipped — bad anchorCell', {
      anchor: st.anchorCell,
    });
    return;
  }
  const c0 = anchor.col;
  const r0 = anchor.row;
  const cols = st.colInputs;
  const rows = st.rowInputs && st.rowInputs.length > 0 ? st.rowInputs : [];
  const is2D = rows.length > 0;
  const headerFmt = st.headerNumberFormat ?? st.numberFormat;

  // Optional title banner one row above the corner.
  if (st.title) {
    const titleCell = ws.getCell(a1(c0, r0 - 1 >= 1 ? r0 - 1 : r0));
    if (r0 - 1 >= 1) {
      titleCell.value = st.title;
      titleCell.font = { ...(titleCell.font ?? {}), bold: true, size: 11 };
    }
  }

  // Corner label.
  const corner = ws.getCell(a1(c0, r0));
  corner.value = st.cornerLabel ?? '';
  corner.font = { ...(corner.font ?? {}), bold: true, italic: true };
  corner.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF2F7' } };

  // Column-input headers across the top (row r0, cols c0+1 ..).
  // D3 — these headers are the table's editable input variants, so they get
  // the blue "input" font color, same convention as the Assumptions sheet.
  cols.forEach((cv, j) => {
    const cell = ws.getCell(a1(c0 + 1 + j, r0));
    cell.value = cv;
    if (headerFmt) cell.numFmt = headerFmt;
    cell.font = {
      ...(cell.font ?? {}),
      bold: true,
      color: { argb: hexToArgb(FONT_COLOR_INPUT_HEX) },
    };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF2F7' } };
    cell.alignment = { horizontal: 'center' };
  });

  const interiorRows = is2D ? rows : [null];
  interiorRows.forEach((rv, i) => {
    const rowNum = r0 + 1 + i;
    // Row-input header down the left column (only for 2-D grids).
    if (is2D) {
      const rc = ws.getCell(a1(c0, rowNum));
      rc.value = rv as number;
      if (headerFmt) rc.numFmt = headerFmt;
      rc.font = {
        ...(rc.font ?? {}),
        bold: true,
        color: { argb: hexToArgb(FONT_COLOR_INPUT_HEX) },
      };
      rc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF2F7' } };
      rc.alignment = { horizontal: 'center' };
    }
    cols.forEach((_cv, j) => {
      const colNum = c0 + 1 + j;
      const colHeaderA1 = a1(colNum, r0);
      const rowHeaderA1 = is2D ? a1(c0, rowNum) : '';
      let formula = st.outputFormulaTemplate.trim().replace(/^=+/, '');
      formula = formula.replace(/\{col\}/g, colHeaderA1);
      if (is2D) formula = formula.replace(/\{row\}/g, rowHeaderA1);
      const cell = ws.getCell(a1(colNum, rowNum));
      cell.value = { formula } as ExcelJS.CellFormulaValue;
      if (st.numberFormat) cell.numFmt = st.numberFormat;
      // D3 — interior cells are formulas: green when they reach into another
      // sheet (the usual case — they recompute from Assumptions), else black.
      cell.font = {
        ...(cell.font ?? {}),
        color: {
          argb: hexToArgb(
            formulaReferencesOtherSheet(formula)
              ? FONT_COLOR_CROSS_SHEET_HEX
              : FONT_COLOR_FORMULA_HEX
          ),
        },
      };
      cell.alignment = { horizontal: 'right' };
    });
  });

  // Color-scale over the interior grid.
  const lastCol = c0 + cols.length;
  const lastRow = r0 + interiorRows.length;
  const interiorRef = `${a1(c0 + 1, r0 + 1)}:${a1(lastCol, lastRow)}`;
  const scaleColors = st.colorScale ?? ['FCE4E4', 'FFF3CD', 'E4F4EC'];
  const cfvo =
    scaleColors.length === 2
      ? [{ type: 'min' }, { type: 'max' }]
      : [{ type: 'min' }, { type: 'percentile', value: 50 }, { type: 'max' }];
  try {
    ws.addConditionalFormatting({
      ref: interiorRef,
      rules: [
        {
          type: 'colorScale',
          priority: 1,
          cfvo: cfvo as any,
          color: scaleColors.map((c) => ({ argb: hexToArgb(c) })),
        } as any,
      ],
    });
  } catch (e) {
    logger.warn('[WorkbookBuilder] sensitivity color-scale failed', e);
  }
}

// ---------------------------------------------------------------------------
// EQ-C — Chart image mount (exceljs has NO native chart write API; a
// pre-rendered PNG via worksheet.addImage is the realistic alternative).
// ---------------------------------------------------------------------------

function emitChartImages(wb: ExcelJS.Workbook, ws: ExcelJS.Worksheet, images: ChartImage[]): void {
  for (const img of images) {
    try {
      const base64 = img.pngBase64.replace(/^data:image\/png;base64,/, '');
      const imageId = wb.addImage({ base64, extension: 'png' });
      const anchor = parseA1(img.anchorCell) ?? { col: 1, row: 1 };
      ws.addImage(imageId, {
        tl: { col: anchor.col - 1, row: anchor.row - 1 } as any,
        ext: { width: img.width ?? 480, height: img.height ?? 300 },
      });
    } catch (e) {
      logger.warn('[WorkbookBuilder] chart image mount failed', e);
    }
  }
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

export interface BuildOptions {
  /**
   * Consultant styling layer (default true): navy header default, locale-aware
   * currency (zł/€/$), per-type alignment (numbers/dates right), default banded
   * rows, subtle color scales on %/score columns, and a leading "Info"
   * metadata sheet. Set false for raw schema-only rendering (e.g. golden-file
   * tests of the builder core).
   */
  applyConsultantStyling?: boolean;
  /** Metadata surfaced on the Info sheet. */
  meta?: {
    organizationName?: string;
    source?: string;
    generatedAt?: string;
  };
}

export async function buildWorkbookBuffer(
  schema: WorkbookSchema,
  options: BuildOptions = {}
): Promise<Buffer> {
  const applyStyling = options.applyConsultantStyling !== false;
  const styleCtx: StyleContext = { currency: inferCurrency(schema) };

  const wb = new ExcelJS.Workbook();
  wb.creator = schema.author || 'Consultify';
  wb.created = new Date();

  // P1 — force Excel to recalculate every formula on open, so cells whose
  // cached result we could not compute still render (never blank) in Excel.
  // Additive & harmless for viewers that ignore it.
  wb.calcProperties = { ...(wb.calcProperties ?? {}), fullCalcOnLoad: true };

  for (const sheetDef of schema.sheets) {
    // P1 — literal-number grid for THIS sheet, used to fold trivial formulas
    // into a cached numeric result (same-sheet, constant inputs only).
    const numericGrid = buildNumericGrid(sheetDef);
    const ws = wb.addWorksheet(sheetDef.name, {
      views: [
        {
          state: 'frozen',
          xSplit: sheetDef.freezeCol ?? 0,
          ySplit: sheetDef.freezeRow ?? 1,
        },
      ],
      properties: {
        showGridLines: sheetDef.showGridLines !== false,
        tabColor: sheetDef.tabColor ? { argb: hexToArgb(sheetDef.tabColor) } : undefined,
      },
    });

    // W7.7 — track max content width per column key for auto-width pass
    const colWidths = new Map<string, number>();
    for (const col of sheetDef.columns) {
      // Seed with header label length
      colWidths.set(col.key, cellTextWidth(col.header));
    }

    // Column definitions — use explicit width if provided, otherwise placeholder (overridden later)
    ws.columns = sheetDef.columns.map((col) => ({
      key: col.key,
      header: col.header,
      width: col.width ?? 16,
    }));
    if (sheetDef.autoFilter && sheetDef.columns.length > 0) {
      ws.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: Math.max(sheetDef.rows.length + 1, 1), column: sheetDef.columns.length },
      };
    }

    // Style header row — brand navy default (crimson NEVER as a fill).
    const headerRow = ws.getRow(1);
    const defaultHeaderStyle: CellStyle = sheetDef.headerStyle ?? {
      bold: true,
      fontColor: 'FFFFFF',
      bgColor: applyStyling ? HEADER_NAVY_HEX : '4472C4',
      alignment: 'center',
      border: 'thin',
    };
    headerRow.eachCell((cell) => applyStyle(cell, { wrapText: true, ...defaultHeaderStyle }));
    headerRow.height = 26;

    // Consistent header typography — one font family, one size. Preserves any
    // color/bold the header style already set; only pins name+size.
    if (applyStyling) {
      headerRow.eachCell((cell) => {
        cell.font = {
          ...(cell.font ?? {}),
          name: FONT_FAMILY,
          size: (cell.font && cell.font.size) || FONT_SIZE_HEADER,
        };
      });
    }

    // Consultant depth: a brand-teal underline rule under the header row — the
    // crisp "table starts here" line a designed sheet has and a raw grid lacks.
    if (applyStyling && !sheetDef.headerStyle) {
      headerRow.eachCell((cell) => {
        cell.border = {
          ...(cell.border ?? {}),
          bottom: { style: 'medium', color: { argb: HEADER_RULE_ARGB } },
        };
      });
    }

    // Default banded rows (zebra) when the schema didn't specify one — this is
    // exactly the "brak formatowania" gap the LLM leaves.
    const effectiveAlternate = sheetDef.alternateRowColor ?? (applyStyling ? ZEBRA_HEX : undefined);

    // Consultant depth: which text columns read as status/health columns and
    // should get auto RAG semaphores? Only when styling is on AND the schema did
    // not already decorate that column with an explicit CF block (respect intent).
    const explicitCfLetters = new Set<string>();
    for (const b of sheetDef.conditionalFormatting ?? []) {
      const m = b.ref.match(/^([A-Z]+)/i);
      if (m) explicitCfLetters.add(m[1].toUpperCase());
    }
    const semaphoreCols = applyStyling
      ? sheetDef.columns
          .map((c, i) => ({ col: c, letter: colLetterLocal(i + 1) }))
          .filter(({ col, letter }) => looksLikeStatusColumn(col) && !explicitCfLetters.has(letter))
          .map(({ col }) => col.key)
      : [];
    const semaphoreColSet = new Set(semaphoreCols);

    // Data rows
    for (let rowIdx = 0; rowIdx < sheetDef.rows.length; rowIdx++) {
      const rowDef = sheetDef.rows[rowIdx];
      const excelRow = ws.getRow(rowIdx + 2); // +2 because row 1 is header

      // W7.7 — detect total rows for bold styling
      const isTotal = isTotalRow(rowDef.cells);

      for (const col of sheetDef.columns) {
        const cellDef = rowDef.cells[col.key];
        if (!cellDef) continue;

        const cell = excelRow.getCell(col.key);

        if (cellDef.formula) {
          // P1 — try to fold a cached numeric result for trivial, same-sheet,
          // constant-input formulas. Correctness over coverage: only attach a
          // `result` when we can compute it deterministically; otherwise leave a
          // bare `{ formula }` (fullCalcOnLoad will make Excel fill it on open).
          const cached = tryComputeFormula(cellDef.formula, numericGrid);
          // Strip any leading `=` so the worksheet XML `<f>` element is valid
          // (Excel corrupts on `<f>=…</f>`). tryComputeFormula already trims `=`
          // internally, so the cached result is unaffected.
          const safeFormula = sanitizeFormula(cellDef.formula);
          cell.value =
            cached !== null
              ? ({ formula: safeFormula, result: cached } as ExcelJS.CellFormulaValue)
              : ({ formula: safeFormula } as ExcelJS.CellFormulaValue);
          // W7.7 — track formula width estimate
          const fw = cellTextWidth(safeFormula);
          const prev = colWidths.get(col.key) ?? 0;
          if (fw > prev) colWidths.set(col.key, fw);
        } else if (cellDef.value !== undefined && cellDef.value !== null) {
          if (
            col.type === 'number' ||
            col.type === 'currency' ||
            col.type === 'percent' ||
            col.type === 'rating'
          ) {
            const num =
              typeof cellDef.value === 'number' ? cellDef.value : parseFloat(String(cellDef.value));
            // MAT-006: a non-numeric string in a numeric column (e.g. a
            // literal "=cmd|'/c calc'!A1" typed as data) falls through to the
            // raw string below — neutralize it the same way as the text
            // branch so it can never be mistaken for a live formula/DDE
            // command by a spreadsheet application on re-open.
            cell.value = isNaN(num) ? sanitizeSpreadsheetCellText(cellDef.value) : num;
          } else if (col.type === 'boolean') {
            cell.value = cellDef.value === true || cellDef.value === 'true';
          } else {
            // MAT-006 — plain-text DATA cell (never a real formula, those are
            // handled by the `cellDef.formula` branch above): neutralize
            // formula/DDE-injection risk (leading =, +, -, @) at this export
            // boundary only, so the stored schema_json keeps the user's exact
            // typed text untouched. See workbookExportSanitizer.ts header.
            cell.value = sanitizeSpreadsheetCellText(cellDef.value);
          }
          // W7.7 — track content width
          const vw = cellTextWidth(cellDef.value);
          const prev = colWidths.get(col.key) ?? 0;
          if (vw > prev) colWidths.set(col.key, vw);
        }

        // Number format: cell-level > column-level > (locale-aware) type default.
        // When styling is on, currency columns get the ACCOUNTING locale format
        // (McKinsey-grade: negatives in red parentheses, zero as an en-dash) —
        // this connects WorkbookStyler.accountingCurrencyFormat(). Off → plain.
        const typeDefaultFmt =
          applyStyling && col.type === 'currency'
            ? accountingCurrencyFormat(styleCtx.currency)
            : col.type
              ? TYPE_FORMATS[col.type]
              : undefined;
        const numFmt = cellDef.style?.numberFormat || col.numberFormat || typeDefaultFmt;
        if (numFmt) cell.numFmt = numFmt;

        // Cell style
        applyStyle(cell, cellDef.style);

        // Column-level style (if no cell style)
        if (!cellDef.style && col.style) {
          applyStyle(cell, col.style);
        }

        // D3 — financial-model font-color convention: blue = input, black =
        // local formula, green = cross-sheet formula. Only fills the gap when
        // neither the cell nor the column already asked for an explicit
        // fontColor (deliberate schema intent always wins).
        if (applyStyling && !cellDef.style?.fontColor && !col.style?.fontColor) {
          let conventionHex: string | undefined;
          if (cellDef.formula) {
            conventionHex = formulaReferencesOtherSheet(cellDef.formula)
              ? FONT_COLOR_CROSS_SHEET_HEX
              : FONT_COLOR_FORMULA_HEX;
          } else if (typeof cellDef.value === 'number' && sheetDef.isAssumptions) {
            conventionHex = FONT_COLOR_INPUT_HEX;
          }
          if (conventionHex) {
            cell.font = { ...(cell.font ?? {}), color: { argb: hexToArgb(conventionHex) } };
          }
        }

        // Per-type alignment (numbers/dates right, text left) — only fills the
        // gap where neither cell nor column style set an explicit alignment.
        if (applyStyling && !cellDef.style?.alignment && !col.style?.alignment) {
          cell.alignment = {
            vertical: 'middle',
            ...(cell.alignment ?? {}),
            horizontal: cell.alignment?.horizontal ?? alignmentForType(col.type),
          };
        }

        // Consultant depth: auto RAG semaphore on status columns, ONLY where the
        // schema left the cell/column unstyled (never clobber an explicit fill or
        // a select chip). Fills the "raw status text" gap the LLM leaves.
        if (semaphoreColSet.has(col.key) && !cellDef.style?.bgColor && !col.style?.bgColor) {
          const sem = classifyStatus(cellDef.value);
          if (sem) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: sem.fill } };
            cell.font = {
              ...(cell.font ?? {}),
              color: { argb: sem.font },
              ...(sem.bold ? { bold: true } : {}),
            };
            cell.alignment = {
              vertical: 'middle',
              ...(cell.alignment ?? {}),
              horizontal: 'center',
            };
          }
        }

        // Consistent body typography — pin the font family everywhere and a
        // default body size where the schema didn't ask for a specific one.
        // Preserves bold/italic/color already resolved above.
        if (applyStyling) {
          cell.font = {
            ...(cell.font ?? {}),
            name: FONT_FAMILY,
            size: (cell.font && cell.font.size) || FONT_SIZE_BODY,
          };
        }

        if (cellDef.comment) {
          cell.note = cellDef.comment;
        }

        // P4 — Data validation (dropdown / numeric bound). Cell-level wins over
        // column-level. Fail-soft: a bad spec never breaks the export.
        const valSpec = cellDef.validation ?? col.validation;
        if (valSpec) {
          try {
            const dv = mapDataValidation(valSpec);
            if (dv) cell.dataValidation = dv;
          } catch (e) {
            logger.warn(`[WorkbookBuilder] dataValidation failed for ${col.key}`, e);
          }
        }
      }

      // Row-level style
      if (rowDef.style) {
        excelRow.eachCell((cell) => applyStyle(cell, rowDef.style));
      }
      if (rowDef.height) excelRow.height = rowDef.height;

      // Summary row styling
      if (rowDef.isSummary) {
        excelRow.eachCell((cell) => {
          applyStyle(cell, { bold: true, border: 'medium', bgColor: 'E2EFDA' });
        });
      }

      // W7.7 — Bold total rows (TOTAL / Razem / Total / etc.) + accounting rule.
      if (isTotal && !rowDef.isSummary) {
        try {
          excelRow.eachCell((cell) => {
            cell.font = { ...(cell.font ?? {}), bold: true };
            // Accounting convention: a top border separates the total from data.
            if (applyStyling) {
              cell.border = {
                ...(cell.border ?? {}),
                top: { style: 'thin', color: { argb: 'FF64748B' } },
              };
            }
          });
        } catch {
          // fail-soft: skip if cell iteration errors
        }
      }

      // Alternating row colors (banded rows). Uses the schema's color when set,
      // otherwise the consultant default (fills the "brak formatowania" gap).
      // Bands every column in the row (not only populated cells) for a clean grid.
      if (effectiveAlternate && rowIdx % 2 === 1 && !rowDef.isHeader && !rowDef.isSummary) {
        for (const col of sheetDef.columns) {
          const cell = excelRow.getCell(col.key);
          if (!cell.fill || (cell.fill as any).pattern === 'none') {
            applyStyle(cell, { bgColor: effectiveAlternate });
          }
        }
      }

      excelRow.commit();
    }

    // W7.7 — Apply auto-width to columns that have no explicit width defined
    try {
      for (const col of sheetDef.columns) {
        if (col.width == null) {
          const maxLen = colWidths.get(col.key) ?? 8;
          // clamp to [8, 30], add padding of 2
          const autoWidth = Math.min(30, Math.max(8, maxLen + 2));
          ws.getColumn(col.key).width = autoWidth;
        }
      }
    } catch {
      // fail-soft: auto-width is cosmetic, don't break export
    }

    // Merged cells
    if (sheetDef.merges) {
      for (const merge of sheetDef.merges) {
        try {
          ws.mergeCells(merge.start, merge.end);
        } catch (e) {
          logger.warn(`[WorkbookBuilder] Merge failed: ${merge.start}:${merge.end}`, e);
        }
      }
    }

    // X2 — Conditional Formatting (dataBar/colorScale/iconSet/cellIs)
    if (sheetDef.conditionalFormatting && sheetDef.conditionalFormatting.length > 0) {
      applyConditionalFormatting(ws, sheetDef.conditionalFormatting);
    }

    // Consultant default: subtle teal color scale on %/score columns that the
    // schema didn't already decorate with its own CF. Skips columns whose A1
    // range already appears in an explicit CF block.
    if (applyStyling) {
      const explicitCfRefs = (sheetDef.conditionalFormatting ?? [])
        .map((b) => b.ref.toUpperCase())
        .join(' ');
      for (const colIdx of colorScaleColumns(sheetDef)) {
        const colL = colLetterLocal(colIdx);
        // Cheap guard: if any explicit CF ref mentions this column letter, skip.
        if (explicitCfRefs.includes(`${colL}2`) || explicitCfRefs.includes(`${colL}$`)) continue;
        addSubtleColorScale(ws, colIdx, sheetDef.rows.length);
      }
    }

    // Consultant depth: make the header a real, filterable table header and set
    // up print so the sheet survives Ctrl+P. Both are additive and fail-soft —
    // they never touch cell values or formula references.
    if (applyStyling) {
      addAutoFilter(ws, sheetDef.columns.length, sheetDef.rows.length);
      applyPrintSetup(ws, sheetDef.name);
    }

    // P3 — Named ranges for assumptions inputs. Additive: never rewrites an
    // existing formula. Fail-soft: a bad name never breaks the export.
    if (isAssumptionsSheet(sheetDef)) {
      for (const { name, ref } of assumptionNameRefs(sheetDef)) {
        try {
          wb.definedNames.add(ref, name);
        } catch (e) {
          logger.warn(`[WorkbookBuilder] definedName failed: ${name} → ${ref}`, e);
        }
      }
    }

    // EQ-A — Scenario switch (dropdown + CHOOSE/MATCH driver selection). Appended
    // BELOW existing data rows so no A1/formula reference is shifted. Fail-soft.
    if (sheetDef.scenarioSwitch) {
      try {
        const startRow = sheetDef.rows.length + 3; // header row 1 + data + spacer
        emitScenarioSwitch(wb, ws, sheetDef, sheetDef.scenarioSwitch, startRow);
      } catch (e) {
        logger.warn('[WorkbookBuilder] scenarioSwitch emit failed', e);
      }
    }

    // EQ-B — Sensitivity table(s): N×M grid of output formulas + color-scale.
    if (sheetDef.sensitivityTables && sheetDef.sensitivityTables.length > 0) {
      for (const st of sheetDef.sensitivityTables) {
        try {
          emitSensitivityTable(ws, st);
        } catch (e) {
          logger.warn('[WorkbookBuilder] sensitivityTable emit failed', e);
        }
      }
    }

    // EQ-C — Pre-rendered chart image(s) via worksheet.addImage.
    if (sheetDef.chartImages && sheetDef.chartImages.length > 0) {
      emitChartImages(wb, ws, sheetDef.chartImages);
    }
  }

  // Trailing "Info" metadata sheet (branding band + source/date/org + sheet
  // inventory). Appended LAST so data sheets keep their sheet1..N file order
  // (existing golden tests + formula/cross-sheet references are unaffected).
  // Fully additive — never shifts data rows.
  if (applyStyling) {
    try {
      addInfoSheet(wb, {
        title: schema.title || 'Workbook',
        description: schema.description,
        organizationName: options.meta?.organizationName,
        source: options.meta?.source,
        generatedAt: options.meta?.generatedAt || new Date().toISOString().slice(0, 10),
        author: schema.author || 'Consultify',
        sheetNames: schema.sheets.map((s) => s.name),
      });
    } catch (infoErr) {
      logger.warn('[WorkbookBuilder] Info sheet creation failed', infoErr);
    }
  }

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

// ---------------------------------------------------------------------------
// B4 — Premium TableSchema → WorkbookSchema mapper (full-fidelity bridge)
//
// The premium table generator (tableSchemaGeneratorService) emits a
// `GeneratedTableSchema`: typed `fields[]` (singleSelect with hex `options[]`,
// number/currency/percent/date/rating), `seedRows[]` keyed by field.key,
// `conditionalFormatting[]` (already A1-resolved by-fieldKey), `hasFormulas`,
// and optionally `sheets[]` (multi-sheet workbook).
//
// This mapper turns that into a `WorkbookSchema` with NO loss of fidelity:
//   • field.type            → column.type (Airtable types collapsed to the
//                             6 Excel-native value kinds; see TABLE_TYPE_MAP)
//   • field.options[].color → per-CELL solid fill (Airtable-style colored
//                             single/multi-select chips), matched by label
//   • seed value "=…"        → cell.formula (Excel formula, not a literal)
//   • conditionalFormatting → sheet.conditionalFormatting (dataBar/colorScale/
//                             iconSet/cellIs survive verbatim into the .xlsx)
//   • sheets[]              → one WorkbookSchema sheet per table sheet
//
// Without this bridge each premium table would be flattened to plain text
// (the legacy SheetJS facade) — colors, types, and CF stripped.
// ---------------------------------------------------------------------------

/** A subset of the GeneratedTableSchema contract the mapper consumes. */
export interface TableFieldOption {
  label: string;
  color?: string;
}
export interface TableField {
  key: string;
  header: string;
  type: string;
  options?: TableFieldOption[];
}
export interface TableCfBlock {
  ref: string;
  rules: Array<{ type: string; [k: string]: unknown }>;
}
export interface TableSchemaLike {
  fields: TableField[];
  seedRows: Record<string, unknown>[];
  conditionalFormatting?: TableCfBlock[];
  hasFormulas?: boolean;
  sheets?: Array<{
    name?: string;
    fields: TableField[];
    seedRows: Record<string, unknown>[];
    conditionalFormatting?: TableCfBlock[];
    hasFormulas?: boolean;
  }>;
}

/**
 * Table Platform field type → WorkbookSchema column type. Excel has no first
 * class select/url/email/phone, so those collapse to the nearest native value
 * kind. The colored-chip semantics of a select are preserved separately, as a
 * per-cell fill (see resolveSelectFill), so collapsing the *type* to text is
 * lossless for the value, and the color is carried by the fill.
 */
const TABLE_TYPE_MAP: Record<string, NonNullable<ColumnDef['type']>> = {
  singleLineText: 'text',
  longText: 'text',
  url: 'text',
  email: 'text',
  phone: 'text',
  singleSelect: 'text',
  multiSelect: 'text',
  number: 'number',
  currency: 'currency',
  percent: 'percent',
  date: 'date',
  checkbox: 'boolean',
  rating: 'rating',
};

function mapTableColumnType(fieldType: string): NonNullable<ColumnDef['type']> {
  return TABLE_TYPE_MAP[fieldType] ?? 'text';
}

/** Normalize a label for tolerant select-option matching. */
function normalizeLabel(v: unknown): string {
  return String(v ?? '')
    .trim()
    .toLowerCase();
}

/**
 * Build a label→hex lookup for select-type fields so each seed cell whose value
 * matches an option gets that option's color as its cell fill.
 */
function buildSelectColorIndex(fields: TableField[]): Map<string, Map<string, string>> {
  const idx = new Map<string, Map<string, string>>();
  for (const f of fields) {
    if ((f.type === 'singleSelect' || f.type === 'multiSelect') && f.options?.length) {
      const m = new Map<string, string>();
      for (const opt of f.options) {
        if (opt.color) m.set(normalizeLabel(opt.label), opt.color);
      }
      if (m.size > 0) idx.set(f.key, m);
    }
  }
  return idx;
}

/**
 * Map a single GeneratedTableSchema sheet (fields + rows + CF) to a
 * WorkbookSchema `Sheet`. Exposed for unit tests; not domain-specific.
 */
function mapTableSheet(
  name: string,
  fields: TableField[],
  seedRows: Record<string, unknown>[],
  conditionalFormatting?: TableCfBlock[],
  headerColor?: string
): WorkbookSchema['sheets'][number] {
  const selectColors = buildSelectColorIndex(fields);

  const columns = fields.map((f) => ({
    key: f.key,
    header: f.header,
    type: mapTableColumnType(f.type),
  }));

  const rows = seedRows.map((rawRow) => {
    const cells: Record<string, { value?: any; formula?: string; style?: CellStyle }> = {};
    for (const f of fields) {
      const raw = rawRow[f.key];
      if (raw === undefined || raw === null) continue;

      const cell: { value?: any; formula?: string; style?: CellStyle } = {};

      // Excel formula passthrough (calculated columns).
      if (typeof raw === 'string' && raw.trim().startsWith('=')) {
        cell.formula = raw.trim();
      } else {
        cell.value = raw as any;
      }

      // Airtable-style colored chip: select value → solid cell fill.
      const colorMap = selectColors.get(f.key);
      if (colorMap && cell.value !== undefined) {
        const hex = colorMap.get(normalizeLabel(cell.value));
        if (hex) {
          // White text reads on the saturated default palette; keep it simple
          // and contrast-safe.
          cell.style = { bgColor: hex, fontColor: 'FFFFFF', bold: true, alignment: 'center' };
        }
      }

      cells[f.key] = cell;
    }
    return { cells };
  });

  // CF blocks pass through verbatim — they are already A1-resolved and shaped
  // exactly like ConditionalFormattingRule (dataBar/colorScale/iconSet/cellIs).
  const cf = (conditionalFormatting ?? []).map((b) => ({
    ref: b.ref,
    rules: b.rules as any,
  }));

  return {
    name: name.slice(0, 31),
    columns,
    rows,
    freezeRow: 1,
    alternateRowColor: 'F2F7FB',
    headerStyle: {
      bold: true,
      fontColor: 'FFFFFF',
      bgColor: normalizeHexForArgb(headerColor) ?? '4472C4',
      alignment: 'center',
      border: 'thin',
    },
    ...(cf.length > 0 ? { conditionalFormatting: cf } : {}),
  };
}

/**
 * Convert a premium GeneratedTableSchema (B4) into a full-fidelity
 * WorkbookSchema ready for `buildWorkbookBuffer`. Honors multi-sheet output.
 */
export function tableSchemaToWorkbook(
  table: TableSchemaLike,
  meta: { title: string; author?: string; headerColor?: string } = { title: 'Table' }
): WorkbookSchema {
  let sheets: WorkbookSchema['sheets'];

  if (table.sheets && table.sheets.length > 0) {
    const seenNames = new Set<string>();
    sheets = table.sheets.map((s, i) => {
      let name = (s.name?.trim() || `Sheet ${i + 1}`).slice(0, 31);
      // ExcelJS rejects duplicate sheet names — disambiguate defensively.
      let n = 2;
      while (seenNames.has(name.toLowerCase())) {
        name = `${name.slice(0, 28)} ${n++}`;
      }
      seenNames.add(name.toLowerCase());
      return mapTableSheet(name, s.fields, s.seedRows, s.conditionalFormatting, meta.headerColor);
    });
  } else {
    sheets = [
      mapTableSheet(
        'Sheet1',
        table.fields,
        table.seedRows,
        table.conditionalFormatting,
        meta.headerColor
      ),
    ];
  }

  return {
    title: meta.title,
    author: meta.author ?? 'Consultify',
    sheets,
  };
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export function validateWorkbookSchema(schema: WorkbookSchema): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!schema.sheets || schema.sheets.length === 0) {
    errors.push('Workbook must have at least one sheet');
  }

  const sheetNames = new Set<string>();
  for (const sheet of schema.sheets) {
    if (sheetNames.has(sheet.name)) {
      errors.push(`Duplicate sheet name: "${sheet.name}"`);
    }
    sheetNames.add(sheet.name);

    if (sheet.name.length > 31) {
      errors.push(`Sheet name too long (max 31): "${sheet.name}"`);
    }

    if (!sheet.columns || sheet.columns.length === 0) {
      errors.push(`Sheet "${sheet.name}" has no columns`);
    }

    const colKeys = new Set<string>();
    for (const col of sheet.columns) {
      if (colKeys.has(col.key)) {
        errors.push(`Duplicate column key "${col.key}" in sheet "${sheet.name}"`);
      }
      colKeys.add(col.key);
    }

    for (let i = 0; i < sheet.rows.length; i++) {
      const row = sheet.rows[i];
      for (const key of Object.keys(row.cells)) {
        if (!colKeys.has(key)) {
          errors.push(`Row ${i} in "${sheet.name}" references unknown column "${key}"`);
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

// ---------------------------------------------------------------------------
// §7.1 — Classified error helpers (P23 canon integration)
// ---------------------------------------------------------------------------

export function classifyBuildError(error: unknown): P23ClassifiedError {
  const msg = error instanceof Error ? error.message : String(error);

  if (msg.includes('circular') || msg.includes('cycle')) {
    return createP23Error('formula_cycle_detected', msg);
  }
  if (msg.includes('formula') || msg.includes('#DIV') || msg.includes('#REF')) {
    return createP23Error('formula_error', msg);
  }
  if (msg.includes('merge') || msg.includes('column') || msg.includes('schema')) {
    return createP23Error('validation_failed', msg);
  }
  return createP23Error('export_failed', msg);
}

export type { P23ClassifiedError } from '../v8/exceleCanon.js';
