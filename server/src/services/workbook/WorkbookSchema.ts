/**
 * WorkbookSchema — universal schema for AI-generated multi-sheet Excel workbooks.
 *
 * The LLM produces a WorkbookSchema JSON describing sheets, columns, rows,
 * formulas, formatting, and metadata. The WorkbookBuilder then materializes
 * it into a real .xlsx file via ExcelJS.
 *
 * This is intentionally domain-agnostic: budgets, project plans, risk matrices,
 * competitive analyses, recruitment plans — all use the same schema.
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Cell-level
// ---------------------------------------------------------------------------

export const CellStyleSchema = z.object({
  bold: z.boolean().optional(),
  italic: z.boolean().optional(),
  fontSize: z.number().optional(),
  fontColor: z.string().optional(),
  bgColor: z.string().optional(),
  numberFormat: z.string().optional(),
  alignment: z.enum(['left', 'center', 'right']).optional(),
  wrapText: z.boolean().optional(),
  border: z.enum(['thin', 'medium', 'thick', 'none']).optional(),
});

// ---------------------------------------------------------------------------
// Data validation (Excel dropdowns / numeric bounds on input cells)
//
// Applied to Assumptions-style input cells so a reviewer can only enter valid
// values. Two kinds cover the finance-model needs:
//   - list    → dropdown of allowed string values (e.g. scenario names)
//   - decimal → numeric bound (e.g. tax rate between 0 and 1)
// ---------------------------------------------------------------------------

export const DataValidationSchema = z.object({
  type: z.enum(['list', 'decimal', 'whole']),
  /** For `list`: the allowed values shown in the dropdown. */
  values: z.array(z.string()).optional(),
  /** For `decimal`/`whole`: comparison operator (default 'between'). */
  operator: z
    .enum([
      'between',
      'notBetween',
      'equal',
      'notEqual',
      'greaterThan',
      'lessThan',
      'greaterThanOrEqual',
      'lessThanOrEqual',
    ])
    .optional(),
  /** For `decimal`/`whole`: lower / single bound. */
  min: z.number().optional(),
  /** For `decimal`/`whole`: upper bound (used with between/notBetween). */
  max: z.number().optional(),
  /** Show a red error stop on invalid entry (default true). */
  allowBlank: z.boolean().optional(),
  /** Prompt tooltip title/text shown when the cell is selected. */
  promptTitle: z.string().optional(),
  prompt: z.string().optional(),
  /** Error-box title/text shown on an invalid entry. */
  errorTitle: z.string().optional(),
  error: z.string().optional(),
});

export const CellSchema = z.object({
  value: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional(),
  formula: z.string().optional(),
  style: CellStyleSchema.optional(),
  comment: z.string().optional(),
  /** Data validation (dropdown / numeric bound) — used on input cells. */
  validation: DataValidationSchema.optional(),
});

// ---------------------------------------------------------------------------
// Column definition
// ---------------------------------------------------------------------------

export const ColumnDefSchema = z.object({
  key: z.string(),
  header: z.string(),
  width: z.number().optional(),
  type: z.enum(['text', 'number', 'currency', 'percent', 'date', 'boolean', 'rating']).optional(),
  numberFormat: z.string().optional(),
  style: CellStyleSchema.optional(),
  /** Column-wide data validation applied to every data cell in the column
   *  (cell-level `validation` still wins for a specific cell). */
  validation: DataValidationSchema.optional(),
});

// ---------------------------------------------------------------------------
// Row
// ---------------------------------------------------------------------------

export const RowSchema = z.object({
  cells: z.record(z.string(), CellSchema),
  style: CellStyleSchema.optional(),
  height: z.number().optional(),
  isHeader: z.boolean().optional(),
  isSummary: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// Merge range
// ---------------------------------------------------------------------------

export const MergeRangeSchema = z.object({
  start: z.string(),
  end: z.string(),
});

// ---------------------------------------------------------------------------
// Conditional Formatting (X2 — exceljs addConditionalFormatting)
//
// 4 typy rules wspierane przez WorkbookBuilder (podzbiór ExcelJS):
//   - dataBar    → kolorowy pasek w komórce (jak Airtable)
//   - colorScale → 2- lub 3-color gradient (red↔yellow↔green)
//   - iconSet    → ikony 3-poziomowe (3Arrows/3Lights/3Traffic)
//   - cellIs     → klasyczny warunek (cell >= X → kolor)
// ---------------------------------------------------------------------------

export const CfDataBarRuleSchema = z.object({
  type: z.literal('dataBar'),
  color: z.string(), // hex #RRGGBB
  /** Optional: hide value text, show only the bar. */
  showValue: z.boolean().optional(),
});

export const CfColorScaleRuleSchema = z.object({
  type: z.literal('colorScale'),
  /** 2-color = [min, max]; 3-color = [min, mid, max]. */
  colors: z.array(z.string()).min(2).max(3),
});

export const CfIconSetRuleSchema = z.object({
  type: z.literal('iconSet'),
  /** Common ExcelJS-supported icon set names. */
  iconSet: z.enum(['3Arrows', '3Lights', '3TrafficLights1', '3Symbols', '4Arrows', '5Arrows']),
  /** Whether to show the value alongside the icon. */
  showValue: z.boolean().optional(),
});

export const CfCellIsRuleSchema = z.object({
  type: z.literal('cellIs'),
  operator: z.enum([
    'equal',
    'notEqual',
    'lessThan',
    'lessThanOrEqual',
    'greaterThan',
    'greaterThanOrEqual',
    'between',
    'notBetween',
  ]),
  /** Numeric or string formula(s). For "between" pass two. */
  formulae: z.array(z.string()).min(1).max(2),
  /** Style applied when condition holds. */
  style: CellStyleSchema,
});

export const ConditionalFormattingRuleSchema = z.discriminatedUnion('type', [
  CfDataBarRuleSchema,
  CfColorScaleRuleSchema,
  CfIconSetRuleSchema,
  CfCellIsRuleSchema,
]);

export const ConditionalFormattingBlockSchema = z.object({
  /** A1-range e.g. "B2:B11". */
  ref: z.string(),
  rules: z.array(ConditionalFormattingRuleSchema).min(1),
});

// ---------------------------------------------------------------------------
// Sheet
// ---------------------------------------------------------------------------

export const SheetSchema = z.object({
  name: z.string(),
  purpose: z.string().optional(),
  columns: z.array(ColumnDefSchema),
  rows: z.array(RowSchema),
  freezeRow: z.number().optional(),
  freezeCol: z.number().optional(),
  merges: z.array(MergeRangeSchema).optional(),
  headerStyle: CellStyleSchema.optional(),
  alternateRowColor: z.string().optional(),
  showGridLines: z.boolean().optional(),
  tabColor: z.string().optional(),
  /** X2 — Conditional formatting blocks (per range). */
  conditionalFormatting: z.array(ConditionalFormattingBlockSchema).optional(),
  /**
   * P3 — mark this sheet as the workbook's assumptions/input sheet. When true
   * (or when the sheet name reads as "Assumptions"/"Założenia"), the builder
   * emits workbook-level named ranges for each input row so formulas elsewhere
   * can reference `TaxRate` instead of `Assumptions!$B$5`. Purely additive —
   * existing A1/cross-sheet formulas are never rewritten.
   */
  isAssumptions: z.boolean().optional(),
  /**
   * P3 — which column key holds the row's stable name/key (defaults to the
   * first column) and which holds the value the name should point at (defaults
   * to the first numeric/currency/percent column, else the 2nd column).
   */
  nameKeyColumn: z.string().optional(),
  nameValueColumn: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Workbook (top-level)
// ---------------------------------------------------------------------------

export const WorkbookSchemaValidator = z.object({
  title: z.string(),
  description: z.string().optional(),
  author: z.string().optional(),
  sheets: z.array(SheetSchema).min(1),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

// ---------------------------------------------------------------------------
// TypeScript types
// ---------------------------------------------------------------------------

export type CellStyle = z.infer<typeof CellStyleSchema>;
export type DataValidation = z.infer<typeof DataValidationSchema>;
export type Cell = z.infer<typeof CellSchema>;
export type ColumnDef = z.infer<typeof ColumnDefSchema>;
export type Row = z.infer<typeof RowSchema>;
export type MergeRange = z.infer<typeof MergeRangeSchema>;
export type Sheet = z.infer<typeof SheetSchema>;
export type WorkbookSchema = z.infer<typeof WorkbookSchemaValidator>;

export type CfDataBarRule = z.infer<typeof CfDataBarRuleSchema>;
export type CfColorScaleRule = z.infer<typeof CfColorScaleRuleSchema>;
export type CfIconSetRule = z.infer<typeof CfIconSetRuleSchema>;
export type CfCellIsRule = z.infer<typeof CfCellIsRuleSchema>;
export type ConditionalFormattingRule = z.infer<typeof ConditionalFormattingRuleSchema>;
export type ConditionalFormattingBlock = z.infer<typeof ConditionalFormattingBlockSchema>;
