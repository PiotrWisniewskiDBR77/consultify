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

export const CellSchema = z.object({
  value: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional(),
  formula: z.string().optional(),
  style: CellStyleSchema.optional(),
  comment: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Column definition
// ---------------------------------------------------------------------------

export const ColumnDefSchema = z.object({
  key: z.string(),
  header: z.string(),
  width: z.number().optional(),
  type: z.enum(['text', 'number', 'currency', 'percent', 'date', 'boolean']).optional(),
  numberFormat: z.string().optional(),
  style: CellStyleSchema.optional(),
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
export type Cell = z.infer<typeof CellSchema>;
export type ColumnDef = z.infer<typeof ColumnDefSchema>;
export type Row = z.infer<typeof RowSchema>;
export type MergeRange = z.infer<typeof MergeRangeSchema>;
export type Sheet = z.infer<typeof SheetSchema>;
export type WorkbookSchema = z.infer<typeof WorkbookSchemaValidator>;
