/**
 * Table Platform Export Service
 * CSV and XLSX export with streaming support and field-type-aware formatting.
 */

import { getDatabase } from '../../database/Database.js';
import logger from '../../utils/Logger.js';
import viewQueryEngine, { type QueryOptions } from './ViewQueryEngine.js';

// ---------------------------------------------------------------------------
// CSV Value Formatting
// ---------------------------------------------------------------------------

export function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

export function formatFieldValue(
  value: unknown,
  field: { type: string; options?: Record<string, unknown> }
): string {
  if (value === null || value === undefined) return '';

  switch (field.type) {
    case 'checkbox':
      return value === true || value === 'true' || value === 1 ? 'true' : 'false';

    case 'multiSelect':
    case 'multi_select':
      return Array.isArray(value) ? value.join(', ') : String(value);

    case 'linkedRecord':
    case 'linked_record':
      if (Array.isArray(value)) {
        return value
          .map((v) =>
            typeof v === 'object' && v !== null
              ? ((v as any).displayName ?? (v as any).id ?? '')
              : String(v)
          )
          .join(', ');
      }
      return String(value);

    case 'attachment':
      if (Array.isArray(value)) {
        return value
          .map((v) =>
            typeof v === 'object' && v !== null
              ? ((v as any).filename ?? (v as any).file_name ?? '')
              : String(v)
          )
          .join(', ');
      }
      return String(value);

    case 'date':
    case 'createdTime':
    case 'lastModifiedTime':
    case 'created_time':
    case 'last_modified_time': {
      if (!value) return '';
      const fmt = field.options?.dateFormat as string | undefined;
      if (fmt) return String(value);
      return String(value);
    }

    default:
      return String(value);
  }
}

// ---------------------------------------------------------------------------
// Field Loading
// ---------------------------------------------------------------------------

interface ExportField {
  id: string;
  name: string;
  type: string;
  options?: Record<string, unknown>;
}

async function loadFields(tableId: string, fieldIds?: string[]): Promise<ExportField[]> {
  const db = getDatabase();
  let result;
  if (fieldIds?.length) {
    result = await db.query(
      `SELECT id, name, field_type AS type, options
       FROM tp_fields WHERE table_id = $1 AND id = ANY($2)
       ORDER BY field_order ASC, created_at ASC`,
      [tableId, fieldIds]
    );
  } else {
    result = await db.query(
      `SELECT id, name, field_type AS type, options
       FROM tp_fields WHERE table_id = $1
       ORDER BY field_order ASC, created_at ASC`,
      [tableId]
    );
  }
  return result.rows as ExportField[];
}

async function getTableName(tableId: string): Promise<string> {
  const db = getDatabase();
  const result = await db.query('SELECT name FROM tp_tables WHERE id = $1', [tableId]);
  return (result.rows[0] as { name?: string })?.name ?? 'export';
}

// ---------------------------------------------------------------------------
// CSV Export (streaming)
// ---------------------------------------------------------------------------

const EXPORT_BATCH_SIZE = 500;

export interface CsvExportOptions {
  tableId: string;
  viewId?: string;
  fieldIds?: string[];
}

async function streamCsvExport(
  options: CsvExportOptions,
  writer: { write: (chunk: string) => boolean; end: () => void }
): Promise<void> {
  const { tableId, viewId, fieldIds } = options;

  const fields = await loadFields(tableId, fieldIds);
  if (fields.length === 0) {
    writer.end();
    return;
  }

  const headerRow = fields.map((f) => escapeCsvValue(f.name)).join(',') + '\n';
  writer.write(headerRow);

  let cursor: string | undefined;
  let hasMore = true;

  while (hasMore) {
    const queryOpts: QueryOptions = {
      tableId,
      viewId,
      pageSize: EXPORT_BATCH_SIZE,
      cursor,
    };

    const batch = await viewQueryEngine.executeQuery(queryOpts);

    for (const record of batch.records) {
      const data = (record as any).data ?? record;
      const row =
        fields.map((f) => escapeCsvValue(formatFieldValue(data[f.id], f))).join(',') + '\n';
      writer.write(row);
    }

    cursor = batch.cursor;
    hasMore = batch.hasMore;
  }

  writer.end();
}

// ---------------------------------------------------------------------------
// XLSX Export
// ---------------------------------------------------------------------------

const XLSX_COLUMN_WIDTHS: Record<string, number> = {
  singleLineText: 20,
  single_line_text: 20,
  longText: 30,
  long_text: 30,
  number: 12,
  currency: 14,
  percent: 10,
  date: 15,
  createdTime: 18,
  lastModifiedTime: 18,
  created_time: 18,
  last_modified_time: 18,
  checkbox: 8,
  singleSelect: 16,
  single_select: 16,
  multiSelect: 22,
  multi_select: 22,
  email: 22,
  url: 25,
  phone: 14,
  linkedRecord: 22,
  linked_record: 22,
  attachment: 20,
};

async function buildXlsxBuffer(options: CsvExportOptions): Promise<Buffer> {
  let XLSX: any;
  try {
    XLSX = await import('xlsx');
  } catch {
    throw new Error('xlsx package is not available');
  }

  const { tableId, viewId, fieldIds } = options;
  const fields = await loadFields(tableId, fieldIds);

  const rows: unknown[][] = [];
  rows.push(fields.map((f) => f.name));

  let cursor: string | undefined;
  let hasMore = true;

  while (hasMore) {
    const queryOpts: QueryOptions = {
      tableId,
      viewId,
      pageSize: EXPORT_BATCH_SIZE,
      cursor,
    };

    const batch = await viewQueryEngine.executeQuery(queryOpts);

    for (const record of batch.records) {
      const data = (record as any).data ?? record;
      rows.push(fields.map((f) => formatFieldValue(data[f.id], f)));
    }

    cursor = batch.cursor;
    hasMore = batch.hasMore;
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);

  ws['!cols'] = fields.map((f) => ({
    wch: XLSX_COLUMN_WIDTHS[f.type] ?? 16,
  }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Data');

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

const exportService = {
  escapeCsvValue,
  formatFieldValue,
  getTableName,
  streamCsvExport,
  buildXlsxBuffer,
};

export default exportService;
