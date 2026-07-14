/**
 * WorkbookBuilder — materializes a WorkbookSchema into a real .xlsx buffer via ExcelJS.
 *
 * Supports: multi-sheet, Excel formulas, rich formatting, freeze panes,
 * merged cells, alternating row colors, number formats, column widths.
 */

import ExcelJS from 'exceljs';

import logger from '../../utils/Logger.js';
import { createP23Error, type P23ClassifiedError } from '../v8/exceleCanon.js';
import type {
  CellStyle,
  ColumnDef,
  ConditionalFormattingBlock,
  ConditionalFormattingRule,
  WorkbookSchema,
} from './WorkbookSchema.js';
import {
  addAutoFilter,
  addInfoSheet,
  addSubtleColorScale,
  alignmentForType,
  applyPrintSetup,
  classifyStatus,
  colLetter as colLetterLocal,
  colorScaleColumns,
  currencyFormat,
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

  for (const sheetDef of schema.sheets) {
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
          cell.value = { formula: cellDef.formula } as ExcelJS.CellFormulaValue;
          // W7.7 — track formula width estimate
          const fw = cellTextWidth(cellDef.formula);
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
            cell.value = isNaN(num) ? cellDef.value : num;
          } else if (col.type === 'boolean') {
            cell.value = cellDef.value === true || cellDef.value === 'true';
          } else {
            cell.value = cellDef.value;
          }
          // W7.7 — track content width
          const vw = cellTextWidth(cellDef.value);
          const prev = colWidths.get(col.key) ?? 0;
          if (vw > prev) colWidths.set(col.key, vw);
        }

        // Number format: cell-level > column-level > (locale-aware) type default.
        // When styling is on, currency columns get the locale format (zł/€/$).
        const typeDefaultFmt =
          applyStyling && col.type === 'currency'
            ? currencyFormat(styleCtx.currency)
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
