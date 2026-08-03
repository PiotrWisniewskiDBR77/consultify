import { createHash } from 'node:crypto';

import type { ArtifactContentEnvelopeV1 } from '../../types/artifactContent.js';
import { all as dbAll, get as dbGet } from '../../utils/DbPromise.js';
import { AppError } from '../../utils/ErrorHandler.js';
import type {
  ArtifactContentAdapter,
  ArtifactContentAdapterResult,
} from './artifactContentResolverService.js';

export const SHEET_CONTENT_ERROR_CODES = {
  INVALID_CURSOR: 'ARTIFACT_CONTENT_SHEET_INVALID_CURSOR',
  RECORD_TOO_LARGE: 'ARTIFACT_CONTENT_SHEET_RECORD_TOO_LARGE',
} as const;

export const SHEET_CONTENT_LIMITS = {
  previewDefault: 50,
  previewMax: 100,
  fullDefault: 200,
  fullMax: 500,
  payloadBytes: 1024 * 1024,
} as const;

type SheetMode = 'preview' | 'full';

interface TableRow {
  id: string;
  base_id: string;
  name: string;
  description: string | null;
  schema_version: number;
}

interface FieldRow {
  id: string;
  name: string;
  field_type: string;
  options: unknown;
  is_computed: boolean;
  field_order: number;
}

interface ViewRow {
  id: string;
  name: string;
  view_type: string;
  visible_field_ids: unknown;
  config: unknown;
  is_default: boolean;
  ordinal: number | null;
}

interface RecordRow {
  id: string;
  data: unknown;
  created_at: string;
  updated_at: string;
}

interface SheetCursor {
  createdAt: string;
  id: string;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const source = value as Record<string, unknown>;
    return `{${Object.keys(source)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(source[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function parseJsonObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === 'string') {
    const parsed = JSON.parse(value) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  }
  return {};
}

function normalizeJson(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

export function encodeSheetCursor(cursor: SheetCursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

export function decodeSheetCursor(cursor: string): SheetCursor {
  try {
    const parsed = JSON.parse(
      Buffer.from(cursor, 'base64url').toString('utf8')
    ) as Partial<SheetCursor>;
    if (
      !parsed ||
      typeof parsed.createdAt !== 'string' ||
      !parsed.createdAt ||
      Number.isNaN(Date.parse(parsed.createdAt)) ||
      typeof parsed.id !== 'string' ||
      !parsed.id
    )
      throw new Error('invalid');
    return { createdAt: parsed.createdAt, id: parsed.id };
  } catch {
    throw new AppError(
      'Invalid sheet content cursor',
      400,
      SHEET_CONTENT_ERROR_CODES.INVALID_CURSOR
    );
  }
}

function markdownValue(value: unknown): string {
  if (value === null || value === undefined) return '∅';
  const raw = typeof value === 'object' ? stableJson(value) : String(value);
  return raw.replace(/\r?\n/g, '<br>').replace(/\|/g, '\\|');
}

function clampLimit(mode: SheetMode, requested?: number): number {
  const fallback =
    mode === 'preview' ? SHEET_CONTENT_LIMITS.previewDefault : SHEET_CONTENT_LIMITS.fullDefault;
  const maximum =
    mode === 'preview' ? SHEET_CONTENT_LIMITS.previewMax : SHEET_CONTENT_LIMITS.fullMax;
  if (!Number.isFinite(requested) || !requested || requested < 1) return fallback;
  return Math.min(Math.floor(requested), maximum);
}

export async function resolveSheetArtifactContent(params: {
  organizationId: string;
  artifactId: string;
  originRuntime: string;
  originRecordId: string;
  mode?: SheetMode;
  limit?: number;
  cursor?: string | null;
  payloadByteCap?: number;
}): Promise<ArtifactContentAdapterResult | null> {
  const mode = params.mode || 'preview';
  const limit = clampLimit(mode, params.limit);
  const byteCap = params.payloadByteCap ?? SHEET_CONTENT_LIMITS.payloadBytes;
  const cursor = params.cursor ? decodeSheetCursor(params.cursor) : null;

  // This ownership check must remain the first Table Platform query. A missing
  // and a foreign-tenant table intentionally produce the same null result.
  const table = await dbGet<TableRow>(
    `SELECT t.id, t.base_id, t.name, t.description, b.schema_version
       FROM tp_tables t
       JOIN tp_bases b ON b.id = t.base_id
      WHERE t.id = ? AND b.organization_id = ?`,
    [params.originRecordId, params.organizationId],
    { fallback: false }
  );
  if (!table) return null;

  const fields = await dbAll<FieldRow>(
    `SELECT id, name, field_type, options, is_computed, field_order
       FROM tp_fields
      WHERE table_id = ?
      ORDER BY field_order ASC, name ASC, id ASC`,
    [table.id],
    { fallback: false }
  );
  const views = await dbAll<ViewRow>(
    `SELECT id, name, view_type, visible_field_ids, config, is_default, ordinal
       FROM tp_views
      WHERE table_id = ?
      ORDER BY is_default DESC, ordinal ASC NULLS LAST, name ASC, id ASC`,
    [table.id],
    { fallback: false }
  );
  const records = await dbAll<RecordRow>(
    `SELECT id, data, created_at, updated_at
       FROM tp_records
      WHERE table_id = ?
        AND (? IS NULL OR (created_at, id) > (?, ?))
      ORDER BY created_at ASC, id ASC
      LIMIT ?`,
    [table.id, cursor?.createdAt ?? null, cursor?.createdAt ?? null, cursor?.id ?? null, limit + 1],
    { fallback: false }
  );

  const normalizedFields = fields.map((field) => ({
    id: field.id,
    name: field.name,
    type: field.field_type,
    options: normalizeJson(field.options),
    computed: Boolean(field.is_computed),
    order: field.field_order,
  }));
  const normalizedViews = views.map((view) => ({
    id: view.id,
    name: view.name,
    type: view.view_type,
    visibleFieldIds: normalizeJson(view.visible_field_ids),
    config: normalizeJson(view.config),
    default: Boolean(view.is_default),
    ordinal: view.ordinal,
  }));

  const selected: Array<{
    id: string;
    data: Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
  }> = [];
  let recordBytes = 0;
  let byteLimited = false;
  for (const row of records.slice(0, limit)) {
    const normalized = {
      id: row.id,
      data: parseJsonObject(row.data),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
    const bytes = Buffer.byteLength(stableJson(normalized), 'utf8');
    if (bytes > byteCap && selected.length === 0) {
      throw new AppError(
        'Sheet record exceeds the content payload limit',
        413,
        SHEET_CONTENT_ERROR_CODES.RECORD_TOO_LARGE,
        { recordId: row.id }
      );
    }
    if (recordBytes + bytes > byteCap) {
      byteLimited = true;
      break;
    }
    selected.push(normalized);
    recordBytes += bytes;
  }

  const hasMore = byteLimited || records.length > selected.length;
  const last = selected.at(-1);
  const nextCursor =
    hasMore && last ? encodeSheetCursor({ createdAt: last.createdAt, id: last.id }) : null;
  const snapshotCore = {
    table: {
      id: table.id,
      baseId: table.base_id,
      name: table.name,
      description: table.description,
      schemaVersion: table.schema_version,
    },
    fields: normalizedFields,
    views: normalizedViews,
    records: selected,
  };
  const pageHash = sha256(stableJson(snapshotCore));
  const contentJson = {
    ...snapshotCore,
    page: { mode, limit, nextCursor, hasMore, byteLimit: byteCap },
    revision: {
      strength: 'weak',
      scope: 'page-snapshot',
      datasetRevision: null,
      pageHash,
      note: 'No full consistent dataset snapshot was hashed.',
    },
  };
  const headers = ['Record ID', ...normalizedFields.map((field) => field.name)];
  const divider = headers.map(() => '---');
  const rows = selected.map((record) => [
    record.id,
    ...normalizedFields.map((field) => markdownValue(record.data[field.id])),
  ]);
  const contentMd = [
    `# ${markdownValue(table.name)}`,
    '',
    `| ${headers.map(markdownValue).join(' | ')} |`,
    `| ${divider.join(' | ')} |`,
    ...rows.map((row) => `| ${row.join(' | ')} |`),
  ].join('\n');
  const completeness = hasMore ? 'truncated' : 'full';
  const envelope: ArtifactContentEnvelopeV1 = {
    envelopeVersion: 'artifact-content/v1',
    canonicalFormat: 'json',
    canonicalKind: 'sheet',
    contentSchemaVersion: 'table-platform/sheet-snapshot-v1',
    contentMd,
    contentJson,
    projection: {
      status: 'synced',
      projectedAt: null,
      error: null,
      completeness,
      projectedFromRevision: null,
      projectedFromHash: pageHash,
    },
    provenance: { originRuntime: 'sheet', originRecordId: table.id, originRevision: null },
    artifactType: 'sheet',
    markdownProjectionStatus: 'synced',
  };
  return { envelope, originRevision: null };
}

export const sheetArtifactContentAdapter: ArtifactContentAdapter = {
  resolve: resolveSheetArtifactContent,
};
