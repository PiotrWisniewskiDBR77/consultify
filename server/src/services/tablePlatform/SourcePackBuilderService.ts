/**
 * Source Pack Builder Service (Block C · EPIC-T12 · Sprint C-S6)
 *
 * Lets a curator assemble a bundle of records (and free-form notes) that the
 * AI Editor can later consume as `payload.sourcePackId` on column / record /
 * source level proposals. Every step of the workflow runs through:
 *
 *   1. ACL filter — actor must belong to the table's organization. Cross-tenant
 *      reads/writes are refused before any DB scan.
 *   2. Deterministic candidate ranking — no LLM call. Ranking signals:
 *        a. lexical match on `tp_records.data` (ILIKE across stringified data),
 *        b. record recency (updated_at decay over 30 days),
 *        c. confidence score from Block B (0..1, default 0.5),
 *        d. verified-source bonus (joined from tp_record_sources where
 *           tp_record_sources.last_verified_at IS NOT NULL).
 *      The score is a fixed weighted sum so reruns are reproducible — anything
 *      that depends on probabilistic embeddings is a follow-up (TBL-FU-C6-1).
 *   3. V8 snapshot — pack creation captures `{ records, fields, capturedAt,
 *      captureSource }`. Once written, the snapshot never mutates; if a record
 *      changes after the pack is saved, downstream consumers still see the
 *      curator-approved version. This matches the "one snapshot per artifact"
 *      pattern Block A established for templates.
 *
 * Persistence: `tp_source_packs` (see migrations/20260510_block_c_source_pack.sql).
 * The service exposes:
 *   - findCandidates(input)
 *   - createPack(input)
 *   - getPack(packId, organizationId)
 *   - listPacks(input)
 *   - markPackUsed(packId, organizationId)   — bumps used_count for analytics.
 *
 * Spec: tabele-full-product/block-C-ai-operator/epics/EPIC-T12_SOURCE_PACK_BUILDER.md
 */

import { getDatabase } from '../../database/Database.js';
import logger from '../../utils/Logger.js';

// ── Types ────────────────────────────────────────────────────────────────────

export interface SourcePackCandidate {
  recordId: string;
  tableId: string;
  /** Title-ish projection: first non-empty primary text field, or record id. */
  title: string;
  /** Single-line preview from the record data (~120 chars). */
  preview: string;
  /** ISO timestamp of last update. */
  updatedAt: string;
  /** 0..1 confidence (Block B). `null` if column unavailable. */
  confidenceScore: number | null;
  /** True when ≥1 active verified source is attached. */
  hasVerifiedSource: boolean;
  /** Validation status from RecordsService — 'verified' | 'in_review' | … */
  validationStatus: string;
  /** Composite score used for ranking. 0..1. */
  rankScore: number;
  /** Per-signal contributions for UI debug / explainability. */
  rankSignals: {
    lexical: number;
    recency: number;
    confidence: number;
    verifiedSource: number;
  };
}

export interface FindCandidatesInput {
  tableId: string;
  organizationId: string;
  query?: string;
  /** Filter by validation status. */
  verifiedOnly?: boolean;
  /** Restrict to records updated within the last N days. `null` to disable. */
  recencyDays?: number | null;
  /** Maximum candidates to return (default 25, hard cap 100). */
  limit?: number;
}

export interface CreatePackInput {
  tableId: string;
  organizationId: string;
  workspaceId: string;
  ownerUserId: string;
  name: string;
  description?: string;
  candidateRecordIds: string[];
}

export interface SourcePack {
  id: string;
  organizationId: string;
  workspaceId: string;
  ownerUserId: string;
  tableId: string | null;
  name: string;
  description: string | null;
  candidateRecordIds: string[];
  v8Snapshot: SourcePackSnapshot;
  createdAt: string;
  updatedAt: string;
  usedCount: number;
  archivedAt: string | null;
}

export interface SourcePackSnapshot {
  records: Array<{
    id: string;
    data: Record<string, unknown>;
    confidenceScore: number | null;
    validationStatus: string;
    updatedAt: string;
  }>;
  fields: Array<{
    id: string;
    name: string;
    fieldType: string;
  }>;
  capturedAt: string;
  captureSource: 'source_pack_create';
}

export interface ListPacksInput {
  organizationId: string;
  workspaceId?: string;
  tableId?: string | null;
  includeArchived?: boolean;
  limit?: number;
}

// ── Errors ───────────────────────────────────────────────────────────────────

export class SourcePackError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 400
  ) {
    super(message);
    this.name = 'SourcePackError';
  }
}

// ── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_CANDIDATE_LIMIT = 25;
const MAX_CANDIDATE_LIMIT = 100;
const MAX_PACK_RECORDS = 200;
const MAX_PACK_NAME = 200;
const MAX_PACK_DESCRIPTION = 2000;
const RECENCY_HALF_LIFE_DAYS = 30;
const PREVIEW_MAX_LEN = 120;

const RANK_WEIGHTS = {
  lexical: 0.45,
  recency: 0.2,
  confidence: 0.2,
  verifiedSource: 0.15,
} as const;

// ── Tenant resolution ────────────────────────────────────────────────────────

interface TenantRow {
  workspaceId: string;
  organizationId: string;
}

async function loadTenant(tableId: string): Promise<TenantRow | null> {
  const db = getDatabase();
  const { rows } = await db.query<{ workspace_id: string; organization_id: string }>(
    `SELECT b.workspace_id, b.organization_id
       FROM tp_tables t
       JOIN tp_bases  b ON t.base_id = b.id
      WHERE t.id = $1
      LIMIT 1`,
    [tableId]
  );
  const row = rows?.[0];
  if (!row?.workspace_id || !row?.organization_id) return null;
  return {
    workspaceId: String(row.workspace_id),
    organizationId: String(row.organization_id),
  };
}

// ── Field / record loading (kept local — TableQaService has its own loaders
// with different shape semantics; we don't share to avoid coupling). ─────────

interface FieldRow {
  id: string;
  name: string;
  fieldType: string;
  fieldOrder: number;
  primary: boolean;
}

async function loadFields(tableId: string): Promise<FieldRow[]> {
  const db = getDatabase();
  // is_primary may not exist in older schemas; coalesce defensively.
  let rows: any[];
  try {
    const r = await db.query(
      `SELECT id, name, field_type, field_order, COALESCE(is_primary, false) AS is_primary
         FROM tp_fields
        WHERE table_id = $1
        ORDER BY field_order ASC, name ASC`,
      [tableId]
    );
    rows = r.rows ?? [];
  } catch {
    const r = await db.query(
      `SELECT id, name, field_type, field_order
         FROM tp_fields
        WHERE table_id = $1
        ORDER BY field_order ASC, name ASC`,
      [tableId]
    );
    rows = r.rows ?? [];
  }
  return rows.map((r) => ({
    id: String(r.id),
    name: String(r.name),
    fieldType: String(r.field_type),
    fieldOrder: Number(r.field_order ?? 0),
    primary: Boolean(r.is_primary ?? false),
  }));
}

interface RecordRow {
  id: string;
  data: Record<string, unknown>;
  confidenceScore: number | null;
  validationStatus: string;
  updatedAt: string;
}

function safeParseObject(s: string): Record<string, unknown> {
  try {
    const v = JSON.parse(s);
    return v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function rowToRecord(r: any): RecordRow {
  return {
    id: String(r.id),
    data:
      r.data == null
        ? {}
        : typeof r.data === 'string'
          ? safeParseObject(r.data)
          : (r.data as Record<string, unknown>),
    confidenceScore:
      r.confidence_score == null || r.confidence_score === '' ? null : Number(r.confidence_score),
    validationStatus: String(r.validation_status ?? 'unverified'),
    updatedAt:
      r.updated_at instanceof Date
        ? r.updated_at.toISOString()
        : String(r.updated_at ?? new Date().toISOString()),
  };
}

async function loadCandidatesScan(
  tableId: string,
  recencyDays: number | null,
  verifiedOnly: boolean
): Promise<RecordRow[]> {
  const db = getDatabase();
  const params: any[] = [tableId];
  const wheres: string[] = ['table_id = $1'];

  if (Number.isFinite(recencyDays) && recencyDays !== null && recencyDays > 0) {
    params.push(recencyDays);
    wheres.push(`updated_at >= NOW() - ($${params.length}::int * INTERVAL '1 day')`);
  }
  if (verifiedOnly) {
    wheres.push("COALESCE(validation_status, 'unverified') = 'verified'");
  }

  // Cap raw scan to 1000 records to bound search latency. Curators almost
  // always narrow results with a query; for empty queries we rely on recency
  // ordering. Larger lookups belong in a dedicated search service (TBL-FU-C6-1).
  const sql = `
    SELECT id, data, confidence_score, validation_status, updated_at
      FROM tp_records
     WHERE ${wheres.join(' AND ')}
     ORDER BY updated_at DESC
     LIMIT 1000`;
  const { rows } = await db.query(sql, params);
  return (rows ?? []).map(rowToRecord);
}

async function loadVerifiedSet(tableId: string, recordIds: string[]): Promise<Set<string>> {
  if (recordIds.length === 0) return new Set();
  try {
    const db = getDatabase();
    const { rows } = await db.query(
      `SELECT DISTINCT s.record_id
         FROM tp_record_sources s
        WHERE s.archived_at IS NULL
          AND s.last_verified_at IS NOT NULL
          AND s.record_id = ANY($1::uuid[])`,
      [recordIds]
    );
    return new Set((rows ?? []).map((r: any) => String(r.record_id)));
  } catch (e) {
    // tp_record_sources may not exist in pre-Block-B deployments — degrade
    // gracefully so candidate search still works.
    logger.warn('[SourcePackBuilderService] tp_record_sources unavailable', {
      tableId,
      error: (e as Error)?.message,
    });
    return new Set();
  }
}

// ── Ranking ──────────────────────────────────────────────────────────────────

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function recencyScore(updatedAt: string): number {
  const t = Date.parse(updatedAt);
  if (!Number.isFinite(t)) return 0;
  const ageDays = Math.max(0, (Date.now() - t) / (1000 * 60 * 60 * 24));
  // Half-life decay: exp(-ln2 * age / halflife).
  return clamp01(Math.exp(-Math.LN2 * (ageDays / RECENCY_HALF_LIFE_DAYS)));
}

function lexicalScore(record: RecordRow, query: string): number {
  if (!query) return 0;
  const haystack = JSON.stringify(record.data).toLowerCase();
  const needle = query.toLowerCase();
  if (!haystack || !needle) return 0;
  if (haystack.includes(needle)) {
    // Exact substring hit — strong signal.
    return 1;
  }
  // Token overlap fallback. Splits on non-word; ignores empty.
  const haystackTokens = new Set(haystack.split(/[^a-z0-9]+/i).filter(Boolean));
  const needleTokens = needle.split(/[^a-z0-9]+/i).filter(Boolean);
  if (needleTokens.length === 0) return 0;
  let hits = 0;
  for (const t of needleTokens) if (haystackTokens.has(t)) hits += 1;
  return clamp01(hits / needleTokens.length);
}

function confidenceScoreSignal(record: RecordRow): number {
  return record.confidenceScore == null ? 0.5 : clamp01(record.confidenceScore);
}

function compositeRank(
  record: RecordRow,
  query: string,
  hasVerifiedSource: boolean
): { score: number; signals: SourcePackCandidate['rankSignals'] } {
  const signals = {
    lexical: lexicalScore(record, query),
    recency: recencyScore(record.updatedAt),
    confidence: confidenceScoreSignal(record),
    verifiedSource: hasVerifiedSource ? 1 : 0,
  };
  const score = clamp01(
    RANK_WEIGHTS.lexical * signals.lexical +
      RANK_WEIGHTS.recency * signals.recency +
      RANK_WEIGHTS.confidence * signals.confidence +
      RANK_WEIGHTS.verifiedSource * signals.verifiedSource
  );
  return { score, signals };
}

function buildPreview(
  record: RecordRow,
  fields: FieldRow[]
): {
  title: string;
  preview: string;
} {
  const primaryField = fields.find((f) => f.primary) ?? fields[0];
  const titleSource =
    (primaryField && asString(record.data[primaryField.id])) ||
    asString(record.data[primaryField?.name ?? '']) ||
    asFirstString(record.data) ||
    record.id;
  const previewParts: string[] = [];
  for (const f of fields.slice(0, 4)) {
    const v = asString(record.data[f.id]) ?? asString(record.data[f.name]);
    if (v) previewParts.push(`${f.name}: ${v}`);
    if (previewParts.join(' · ').length > PREVIEW_MAX_LEN) break;
  }
  let preview = previewParts.join(' · ');
  if (preview.length > PREVIEW_MAX_LEN) {
    preview = `${preview.slice(0, PREVIEW_MAX_LEN - 1)}…`;
  }
  return { title: trimTo(titleSource, 80), preview };
}

function asString(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === 'string') return v.trim() || null;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return null;
}

function asFirstString(data: Record<string, unknown>): string | null {
  for (const v of Object.values(data)) {
    const s = asString(v);
    if (s) return s;
  }
  return null;
}

function trimTo(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

// ── Service ──────────────────────────────────────────────────────────────────

const sourcePackBuilderService = {
  /**
   * Returns ranked candidates the actor can read. Cross-tenant defense:
   * refuses tables not in `organizationId`.
   */
  async findCandidates(input: FindCandidatesInput): Promise<SourcePackCandidate[]> {
    if (!input.tableId) throw new SourcePackError('TABLE_ID_REQUIRED', 'tableId is required');
    if (!input.organizationId)
      throw new SourcePackError('ORG_ID_REQUIRED', 'organizationId is required');

    const tenant = await loadTenant(input.tableId);
    if (!tenant) throw new SourcePackError('TABLE_NOT_FOUND', 'Table not found', 404);
    if (tenant.organizationId !== input.organizationId) {
      throw new SourcePackError('TENANT_VIOLATION', 'Table not in actor organization', 403);
    }

    const query = (input.query ?? '').trim();
    const recencyDays =
      input.recencyDays === undefined || input.recencyDays === null
        ? null
        : Math.max(0, Math.floor(Number(input.recencyDays))) || null;
    const verifiedOnly = Boolean(input.verifiedOnly);
    const limit = Math.max(
      1,
      Math.min(MAX_CANDIDATE_LIMIT, Math.floor(Number(input.limit ?? DEFAULT_CANDIDATE_LIMIT)))
    );

    const [fields, scan] = await Promise.all([
      loadFields(input.tableId),
      loadCandidatesScan(input.tableId, recencyDays, verifiedOnly),
    ]);

    const verifiedSet = await loadVerifiedSet(
      input.tableId,
      scan.map((r) => r.id)
    );

    const ranked: SourcePackCandidate[] = scan.map((r) => {
      const { title, preview } = buildPreview(r, fields);
      const { score, signals } = compositeRank(r, query, verifiedSet.has(r.id));
      return {
        recordId: r.id,
        tableId: input.tableId,
        title,
        preview,
        updatedAt: r.updatedAt,
        confidenceScore: r.confidenceScore,
        hasVerifiedSource: verifiedSet.has(r.id),
        validationStatus: r.validationStatus,
        rankScore: score,
        rankSignals: signals,
      };
    });

    // When the user typed a query, drop hits with zero lexical signal so
    // recency alone can't promote irrelevant rows.
    const filtered = query ? ranked.filter((c) => c.rankSignals.lexical > 0) : ranked;

    filtered.sort((a, b) => {
      if (b.rankScore !== a.rankScore) return b.rankScore - a.rankScore;
      // Tie-break on recency for determinism.
      return b.updatedAt.localeCompare(a.updatedAt);
    });

    return filtered.slice(0, limit);
  },

  /**
   * Persist a pack (V8 snapshot included). Cross-tenant defense at every
   * step. The pack inherits the table's tenant; even if the caller passes a
   * different `workspaceId` we override with the resolved tenant.
   */
  async createPack(input: CreatePackInput): Promise<SourcePack> {
    if (!input.tableId) throw new SourcePackError('TABLE_ID_REQUIRED', 'tableId is required');
    if (!input.organizationId)
      throw new SourcePackError('ORG_ID_REQUIRED', 'organizationId is required');
    if (!input.ownerUserId) throw new SourcePackError('OWNER_REQUIRED', 'ownerUserId is required');
    if (!input.name || input.name.trim().length === 0)
      throw new SourcePackError('NAME_REQUIRED', 'name is required');
    if (input.name.length > MAX_PACK_NAME)
      throw new SourcePackError('NAME_TOO_LONG', `name max ${MAX_PACK_NAME} chars`);
    if (input.description && input.description.length > MAX_PACK_DESCRIPTION)
      throw new SourcePackError(
        'DESCRIPTION_TOO_LONG',
        `description max ${MAX_PACK_DESCRIPTION} chars`
      );

    const ids = Array.from(
      new Set(
        (input.candidateRecordIds ?? []).filter(
          (id): id is string => typeof id === 'string' && id.length > 0
        )
      )
    );
    if (ids.length === 0) throw new SourcePackError('NO_CANDIDATES', 'candidateRecordIds required');
    if (ids.length > MAX_PACK_RECORDS)
      throw new SourcePackError(
        'TOO_MANY_CANDIDATES',
        `Pack can hold at most ${MAX_PACK_RECORDS} records`
      );

    const tenant = await loadTenant(input.tableId);
    if (!tenant) throw new SourcePackError('TABLE_NOT_FOUND', 'Table not found', 404);
    if (tenant.organizationId !== input.organizationId) {
      throw new SourcePackError('TENANT_VIOLATION', 'Table not in actor organization', 403);
    }

    const db = getDatabase();
    // Hard ACL: the records must belong to the same table. We don't trust the
    // client; if the request smuggles a record id from another table the
    // snapshot scope will silently drop it AND we report MIXED_TABLES so the
    // UI can show an error.
    const { rows: ownership } = await db.query(
      `SELECT id FROM tp_records WHERE id = ANY($1::uuid[]) AND table_id = $2`,
      [ids, input.tableId]
    );
    const owned = new Set((ownership ?? []).map((r: any) => String(r.id)));
    if (owned.size !== ids.length) {
      throw new SourcePackError(
        'MIXED_TABLES',
        'All candidates must belong to the requested table'
      );
    }

    const fields = await loadFields(input.tableId);
    const { rows: recordRows } = await db.query(
      `SELECT id, data, confidence_score, validation_status, updated_at
         FROM tp_records
        WHERE id = ANY($1::uuid[])`,
      [ids]
    );
    const records = (recordRows ?? []).map(rowToRecord);

    const snapshot: SourcePackSnapshot = {
      records: records.map((r) => ({
        id: r.id,
        data: r.data,
        confidenceScore: r.confidenceScore,
        validationStatus: r.validationStatus,
        updatedAt: r.updatedAt,
      })),
      fields: fields.map((f) => ({
        id: f.id,
        name: f.name,
        fieldType: f.fieldType,
      })),
      capturedAt: new Date().toISOString(),
      captureSource: 'source_pack_create',
    };

    const description = input.description?.trim() || null;

    const { rows } = await db.query(
      `INSERT INTO tp_source_packs
         (organization_id, workspace_id, owner_user_id, table_id,
          name, description, candidate_record_ids, v8_snapshot)
       VALUES ($1, $2, $3, $4, $5, $6, $7::uuid[], $8::jsonb)
       RETURNING id, organization_id, workspace_id, owner_user_id, table_id,
                 name, description, candidate_record_ids, v8_snapshot,
                 created_at, updated_at, used_count, archived_at`,
      [
        tenant.organizationId,
        tenant.workspaceId,
        input.ownerUserId,
        input.tableId,
        input.name.trim(),
        description,
        ids,
        JSON.stringify(snapshot),
      ]
    );
    const row = rows?.[0];
    if (!row) throw new SourcePackError('PERSIST_FAILED', 'Pack persist failed', 500);
    return rowToPack(row);
  },

  /**
   * Returns a single pack by id, refusing cross-tenant reads. Returns `null`
   * when the pack does not exist OR is in another tenant — we deliberately
   * collapse those cases so the response cannot be used to enumerate packs
   * across organizations.
   */
  async getPack(packId: string, organizationId: string): Promise<SourcePack | null> {
    if (!packId) throw new SourcePackError('PACK_ID_REQUIRED', 'packId is required');
    if (!organizationId) throw new SourcePackError('ORG_ID_REQUIRED', 'organizationId is required');
    const db = getDatabase();
    const { rows } = await db.query<Record<string, unknown> & { organization_id: string }>(
      `SELECT id, organization_id, workspace_id, owner_user_id, table_id,
              name, description, candidate_record_ids, v8_snapshot,
              created_at, updated_at, used_count, archived_at
         FROM tp_source_packs
        WHERE id = $1
        LIMIT 1`,
      [packId]
    );
    const row = rows?.[0];
    if (!row) return null;
    if (String(row.organization_id) !== organizationId) return null;
    return rowToPack(row);
  },

  /**
   * Lists packs in the actor's tenant. Always scoped to organizationId; can
   * additionally filter by workspaceId or tableId. Hides archived rows by
   * default.
   */
  async listPacks(input: ListPacksInput): Promise<SourcePack[]> {
    if (!input.organizationId)
      throw new SourcePackError('ORG_ID_REQUIRED', 'organizationId is required');

    const limit = Math.max(1, Math.min(100, Math.floor(Number(input.limit ?? 50))));
    const params: any[] = [input.organizationId];
    const wheres: string[] = ['organization_id = $1'];

    if (input.workspaceId) {
      params.push(input.workspaceId);
      wheres.push(`workspace_id = $${params.length}`);
    }
    if (input.tableId !== undefined) {
      if (input.tableId === null) {
        wheres.push('table_id IS NULL');
      } else {
        params.push(input.tableId);
        wheres.push(`table_id = $${params.length}`);
      }
    }
    if (!input.includeArchived) {
      wheres.push('archived_at IS NULL');
    }
    params.push(limit);

    const db = getDatabase();
    const { rows } = await db.query(
      `SELECT id, organization_id, workspace_id, owner_user_id, table_id,
              name, description, candidate_record_ids, v8_snapshot,
              created_at, updated_at, used_count, archived_at
         FROM tp_source_packs
        WHERE ${wheres.join(' AND ')}
        ORDER BY created_at DESC
        LIMIT $${params.length}`,
      params
    );
    return (rows ?? []).map(rowToPack);
  },

  /**
   * Increments `used_count`. Idempotent in the sense that repeated calls
   * monotonically increase the counter — analytics deduplication is the
   * caller's responsibility (AI Editor records `proposalId` already).
   */
  async markPackUsed(
    packId: string,
    organizationId: string
  ): Promise<{ packId: string; usedCount: number }> {
    if (!packId) throw new SourcePackError('PACK_ID_REQUIRED', 'packId is required');
    if (!organizationId) throw new SourcePackError('ORG_ID_REQUIRED', 'organizationId is required');
    const db = getDatabase();
    const { rows } = await db.query<{ id: string; used_count: number }>(
      `UPDATE tp_source_packs
          SET used_count = used_count + 1,
              updated_at = NOW()
        WHERE id = $1 AND organization_id = $2
        RETURNING id, used_count`,
      [packId, organizationId]
    );
    const row = rows?.[0];
    if (!row) throw new SourcePackError('PACK_NOT_FOUND', 'Pack not found', 404);
    return { packId: String(row.id), usedCount: Number(row.used_count) };
  },
};

function rowToPack(row: any): SourcePack {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    workspaceId: String(row.workspace_id),
    ownerUserId: String(row.owner_user_id),
    tableId: row.table_id ? String(row.table_id) : null,
    name: String(row.name),
    description: row.description == null ? null : String(row.description),
    candidateRecordIds: Array.isArray(row.candidate_record_ids)
      ? row.candidate_record_ids.map((r: any) => String(r))
      : [],
    v8Snapshot:
      typeof row.v8_snapshot === 'string'
        ? (JSON.parse(row.v8_snapshot) as SourcePackSnapshot)
        : (row.v8_snapshot as SourcePackSnapshot),
    createdAt:
      row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    updatedAt:
      row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
    usedCount: Number(row.used_count ?? 0),
    archivedAt:
      row.archived_at == null
        ? null
        : row.archived_at instanceof Date
          ? row.archived_at.toISOString()
          : String(row.archived_at),
  };
}

export default sourcePackBuilderService;
