/**
 * Table Platform Export Service
 * CSV and XLSX export with streaming support and field-type-aware formatting.
 */

import { getDatabase } from '../../database/Database.js';
import logger from '../../utils/Logger.js';
import {
  CONSULTIFY_SUPPLIER_SCORECARD_PROFILE,
  type XlsxExportProfile,
} from '../export/XlsxExportProfile.js';
import viewQueryEngine, { type QueryOptions } from './ViewQueryEngine.js';

export const SHEET_BASE_TEMPLATE_ID = '2ccf6ff1-258e-4509-a163-6cd1a1fdfcd1';

// ---------------------------------------------------------------------------
// CSV Value Formatting
// ---------------------------------------------------------------------------

/**
 * CSV/formula-injection neutralization. A cell that begins with = + - @ (or a
 * tab / carriage return) is interpreted as a formula by Excel/Google Sheets when
 * the exported file is opened — `=HYPERLINK(...)`, `=cmd|...`, `+SUM(...)` etc.
 * Prefix such cells with an apostrophe to force text, while leaving genuine
 * numbers (e.g. "-5", "+3.2e1") untouched.
 */
export function neutralizeFormula(value: string): string {
  if (!value) return value;
  if (/^[=+\-@\t\r]/.test(value) && !Number.isFinite(Number(value))) {
    return "'" + value;
  }
  return value;
}

export function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = neutralizeFormula(String(value));
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
  organizationName?: string;
  profile?: XlsxExportProfile;
}

export async function resolveXlsxProfile(tableId: string): Promise<XlsxExportProfile | undefined> {
  const db = getDatabase();
  const result = await db.query(
    `SELECT b.metadata
       FROM tp_tables t
       JOIN tp_bases b ON b.id = t.base_id
      WHERE t.id = $1`,
    [tableId]
  );
  const metadata = (result.rows[0] as { metadata?: unknown } | undefined)?.metadata;
  const parsed =
    typeof metadata === 'string'
      ? (() => {
          try {
            return JSON.parse(metadata) as Record<string, unknown>;
          } catch {
            return {};
          }
        })()
      : metadata && typeof metadata === 'object'
        ? (metadata as Record<string, unknown>)
        : {};
  const family = String(parsed.template_family_ref ?? parsed.templateFamilyRef ?? '');
  const templateId = String(
    parsed.originTemplateId ?? parsed.template_id ?? parsed.templateId ?? ''
  );
  return family === 'SHEET-BASE' || templateId === SHEET_BASE_TEMPLATE_ID
    ? CONSULTIFY_SUPPLIER_SCORECARD_PROFILE
    : undefined;
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
        fields
          .map((f) => escapeCsvValue(formatFieldValue(data[f.id] ?? data[f.name], f)))
          .join(',') + '\n';
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

async function buildXlsxBuffer(options: CsvExportOptions): Promise<Buffer> {
  const { tableId, viewId, fieldIds, organizationName = 'Organization', profile } = options;
  const fields = await loadFields(tableId, fieldIds);
  const rows: Record<string, { value?: unknown; formula?: string }>[] = [];
  let cursor: string | undefined;
  let hasMore = true;
  while (hasMore) {
    const batch = await viewQueryEngine.executeQuery({
      tableId,
      viewId,
      pageSize: EXPORT_BATCH_SIZE,
      cursor,
    });
    for (const record of batch.records) {
      const data = (record as any).data ?? record;
      const row: Record<string, { value?: unknown; formula?: string }> = {};
      for (const field of fields) {
        const raw = data[field.id] ?? data[field.name] ?? null;
        row[field.id] = { value: formatFieldValue(raw, field) };
      }
      rows.push(row);
    }
    cursor = batch.cursor;
    hasMore = batch.hasMore;
  }
  const { buildCanonicalXlsxBuffer } = await import('../export/CanonicalXlsxExportService.js');
  const tableName = await getTableName(tableId);
  return buildCanonicalXlsxBuffer({
    title: tableName,
    organizationName,
    source: 'Consultify → Table Studio',
    profile,
    sheets: [
      {
        name: 'Data',
        columns: fields.map((field) => ({
          key: field.id,
          header: field.name,
          type: field.type,
        })),
        rows,
      },
    ],
  });
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
  resolveXlsxProfile,
};

export default exportService;
