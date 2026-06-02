/**
 * Record Sources Service (Block B · EPIC-T8)
 *
 * Owns the per-record provenance ledger backed by `tp_record_sources`.
 *
 * Key invariants enforced here (route layer enforces auth + role gates):
 *   1. Tenant scoping. Every read/write filters on `organization_id`. The
 *      service resolves a record's tenant via `tp_records → tp_tables →
 *      tp_bases.organization_id` chain and rejects mismatches.
 *   2. Soft-delete. Removed sources keep their row; queries filter on
 *      `archived_at IS NULL` by default. Permanent deletion is intentionally
 *      not exposed.
 *   3. Cap. A single record may have at most `MAX_SOURCES_PER_RECORD` active
 *      sources. Exceeding the cap throws `RECORD_SOURCES_CAP_EXCEEDED`.
 *   4. Audit. Every CRUD operation emits a `tp_audit_events` row through
 *      `AuditService`. Bulk listing does NOT log (read paths are not audited).
 *   5. Confidence recompute is OUT of this service — it lives in
 *      `ConfidenceScoringService` (B-S3) and is invoked by `RecordsService`
 *      hooks. We only carry `confidence_contribution` on the source row.
 *
 * Schema reference: migrations/20260508_block_b_record_provenance.sql
 * Spec reference:   docs/product/work-packets/tabele-full-product/block-B-record-provenance/epics/EPIC-T8_SOURCE_PROVENANCE.md
 */

import { getDatabase } from '../../database/Database.js';
import logger from '../../utils/Logger.js';
import auditService from './AuditService.js';

// ── Types ────────────────────────────────────────────────────────────────────

export type SourceType =
  | 'manual'
  | 'document'
  | 'presentation'
  | 'external_api'
  | 'ai_generated'
  | 'imported';

export interface RecordSource {
  id: string;
  organization_id: string;
  record_id: string;
  source_type: SourceType;
  source_uri: string | null;
  source_metadata: Record<string, unknown>;
  confidence_contribution: number | null;
  created_by: string;
  created_at: string;
  last_verified_at: string | null;
  last_verified_by: string | null;
  archived_at: string | null;
}

export interface CreateSourceInput {
  recordId: string;
  sourceType: SourceType;
  sourceUri?: string | null;
  sourceMetadata?: Record<string, unknown>;
  confidenceContribution?: number | null;
  createdBy: string;
  organizationId: string;
}

export interface UpdateSourceInput {
  sourceUri?: string | null;
  sourceMetadata?: Record<string, unknown>;
  confidenceContribution?: number | null;
}

export interface ListSourcesOptions {
  includeArchived?: boolean;
  sourceTypes?: SourceType[];
}

// ── Constants ────────────────────────────────────────────────────────────────

const VALID_SOURCE_TYPES: readonly SourceType[] = [
  'manual',
  'document',
  'presentation',
  'external_api',
  'ai_generated',
  'imported',
] as const;

export const MAX_SOURCES_PER_RECORD = 50;

// ── Internal helpers ─────────────────────────────────────────────────────────

function isSourceType(value: unknown): value is SourceType {
  return typeof value === 'string' && (VALID_SOURCE_TYPES as readonly string[]).includes(value);
}

function parseJsonField<T>(raw: unknown, fallback: T): T {
  if (raw == null) return fallback;
  if (typeof raw === 'object') return raw as T;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }
  return fallback;
}

function toIso(raw: unknown): string {
  return raw instanceof Date ? raw.toISOString() : String(raw ?? '');
}

function toIsoOrNull(raw: unknown): string | null {
  if (raw == null) return null;
  return toIso(raw);
}

function toNumberOrNull(raw: unknown): number | null {
  if (raw == null) return null;
  const n = typeof raw === 'string' ? Number(raw) : (raw as number);
  return Number.isFinite(n) ? n : null;
}

function rowToSource(row: Record<string, unknown>): RecordSource {
  return {
    id: String(row.id),
    organization_id: String(row.organization_id),
    record_id: String(row.record_id),
    source_type: isSourceType(row.source_type) ? row.source_type : 'manual',
    source_uri: row.source_uri == null ? null : String(row.source_uri),
    source_metadata: parseJsonField<Record<string, unknown>>(row.source_metadata, {}),
    confidence_contribution: toNumberOrNull(row.confidence_contribution),
    created_by: String(row.created_by),
    created_at: toIso(row.created_at),
    last_verified_at: toIsoOrNull(row.last_verified_at),
    last_verified_by: row.last_verified_by == null ? null : String(row.last_verified_by),
    archived_at: toIsoOrNull(row.archived_at),
  };
}

function makeError(code: string, message: string): Error {
  const err = new Error(message);
  (err as { code?: string }).code = code;
  return err;
}

// ── Service ──────────────────────────────────────────────────────────────────

const recordSourcesService = {
  MAX_SOURCES_PER_RECORD,

  /**
   * Resolve a record's tenant via tp_records → tp_tables → tp_bases. Returns
   * `null` if the record does not exist. Used both internally for cap/audit
   * and to enforce tenant boundary on writes.
   */
  async resolveRecordOrganizationId(recordId: string): Promise<string | null> {
    if (!recordId || typeof recordId !== 'string') {
      throw makeError('INVALID_INPUT', 'recordId is required');
    }
    const db = getDatabase();
    const result = await db.query(
      `
      SELECT b.organization_id
      FROM   tp_records r
      JOIN   tp_tables  t ON t.id = r.table_id
      JOIN   tp_bases   b ON b.id = t.base_id
      WHERE  r.id = $1
      `,
      [recordId]
    );
    const row = result.rows[0] as { organization_id?: string } | undefined;
    return row?.organization_id ?? null;
  },

  async listSourcesForRecord(
    recordId: string,
    organizationId: string,
    options: ListSourcesOptions = {}
  ): Promise<RecordSource[]> {
    if (!recordId) throw makeError('INVALID_INPUT', 'recordId is required');
    if (!organizationId) throw makeError('INVALID_INPUT', 'organizationId is required');

    const params: unknown[] = [recordId, organizationId];
    const conditions: string[] = ['record_id = $1', 'organization_id = $2'];

    if (!options.includeArchived) {
      conditions.push('archived_at IS NULL');
    }

    if (options.sourceTypes && options.sourceTypes.length > 0) {
      const invalid = options.sourceTypes.find((s) => !isSourceType(s));
      if (invalid !== undefined) {
        throw makeError('INVALID_INPUT', `Invalid source type: ${String(invalid)}`);
      }
      params.push(options.sourceTypes);
      conditions.push(`source_type = ANY($${params.length}::text[])`);
    }

    const db = getDatabase();
    const result = await db.query(
      `
      SELECT *
      FROM   tp_record_sources
      WHERE  ${conditions.join(' AND ')}
      ORDER  BY created_at ASC
      `,
      params
    );

    return result.rows.map((row) => rowToSource(row as Record<string, unknown>));
  },

  async getSource(sourceId: string, organizationId: string): Promise<RecordSource | null> {
    if (!sourceId) throw makeError('INVALID_INPUT', 'sourceId is required');
    if (!organizationId) throw makeError('INVALID_INPUT', 'organizationId is required');

    const db = getDatabase();
    const result = await db.query(
      `SELECT * FROM tp_record_sources WHERE id = $1 AND organization_id = $2`,
      [sourceId, organizationId]
    );
    if (result.rows.length === 0) return null;
    return rowToSource(result.rows[0] as Record<string, unknown>);
  },

  async countActiveSourcesForRecord(recordId: string, organizationId: string): Promise<number> {
    const db = getDatabase();
    const result = await db.query(
      `
      SELECT COUNT(*)::int AS n
      FROM   tp_record_sources
      WHERE  record_id = $1 AND organization_id = $2 AND archived_at IS NULL
      `,
      [recordId, organizationId]
    );
    return Number((result.rows[0] as { n?: number })?.n ?? 0);
  },

  async createSource(input: CreateSourceInput): Promise<RecordSource> {
    if (!input.recordId) throw makeError('INVALID_INPUT', 'recordId is required');
    if (!input.organizationId) throw makeError('INVALID_INPUT', 'organizationId is required');
    if (!input.createdBy) throw makeError('INVALID_INPUT', 'createdBy is required');
    if (!isSourceType(input.sourceType)) {
      throw makeError('INVALID_INPUT', `Invalid source_type: ${String(input.sourceType)}`);
    }
    if (
      input.confidenceContribution != null &&
      (input.confidenceContribution < 0 || input.confidenceContribution > 1)
    ) {
      throw makeError(
        'INVALID_INPUT',
        'confidence_contribution must be between 0 and 1 (inclusive)'
      );
    }

    const recordOrgId = await this.resolveRecordOrganizationId(input.recordId);
    if (recordOrgId == null) {
      throw makeError('RECORD_NOT_FOUND', `Record not found: ${input.recordId}`);
    }
    if (recordOrgId !== input.organizationId) {
      // Cross-tenant attempt; treat as not-found to avoid leaking the record's existence.
      throw makeError('RECORD_NOT_FOUND', `Record not found: ${input.recordId}`);
    }

    const activeCount = await this.countActiveSourcesForRecord(
      input.recordId,
      input.organizationId
    );
    if (activeCount >= MAX_SOURCES_PER_RECORD) {
      throw makeError(
        'RECORD_SOURCES_CAP_EXCEEDED',
        `Record ${input.recordId} already has ${activeCount} active sources (cap ${MAX_SOURCES_PER_RECORD}). Archive an existing source before adding more.`
      );
    }

    const db = getDatabase();
    const result = await db.query(
      `
      INSERT INTO tp_record_sources (
        organization_id, record_id, source_type, source_uri,
        source_metadata, confidence_contribution, created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
      `,
      [
        input.organizationId,
        input.recordId,
        input.sourceType,
        input.sourceUri ?? null,
        JSON.stringify(input.sourceMetadata ?? {}),
        input.confidenceContribution ?? null,
        input.createdBy,
      ]
    );

    const created = rowToSource(result.rows[0] as Record<string, unknown>);

    try {
      await auditService.logEvent(
        'record_source_created',
        'record_source',
        created.id,
        input.createdBy,
        null,
        {
          source_type: created.source_type,
          source_uri: created.source_uri,
          confidence_contribution: created.confidence_contribution,
        },
        {
          record_id: created.record_id,
          organization_id: created.organization_id,
        }
      );
    } catch (auditErr) {
      logger.error('[RecordSourcesService] audit emit failed (state already mutated)', {
        sourceId: created.id,
        recordId: created.record_id,
        error: (auditErr as Error).message,
      });
    }

    return created;
  },

  async updateSource(
    sourceId: string,
    organizationId: string,
    actorUserId: string,
    patch: UpdateSourceInput
  ): Promise<RecordSource> {
    if (!sourceId) throw makeError('INVALID_INPUT', 'sourceId is required');
    if (!organizationId) throw makeError('INVALID_INPUT', 'organizationId is required');
    if (!actorUserId) throw makeError('INVALID_INPUT', 'actorUserId is required');
    if (
      patch.confidenceContribution != null &&
      (patch.confidenceContribution < 0 || patch.confidenceContribution > 1)
    ) {
      throw makeError(
        'INVALID_INPUT',
        'confidence_contribution must be between 0 and 1 (inclusive)'
      );
    }

    const before = await this.getSource(sourceId, organizationId);
    if (!before) throw makeError('SOURCE_NOT_FOUND', `Source not found: ${sourceId}`);
    if (before.archived_at != null) {
      throw makeError('SOURCE_ARCHIVED', `Source ${sourceId} is archived; cannot update`);
    }

    const setClauses: string[] = [];
    const params: unknown[] = [];

    if (Object.prototype.hasOwnProperty.call(patch, 'sourceUri')) {
      params.push(patch.sourceUri ?? null);
      setClauses.push(`source_uri = $${params.length}`);
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'sourceMetadata')) {
      params.push(JSON.stringify(patch.sourceMetadata ?? {}));
      setClauses.push(`source_metadata = $${params.length}::jsonb`);
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'confidenceContribution')) {
      params.push(patch.confidenceContribution ?? null);
      setClauses.push(`confidence_contribution = $${params.length}`);
    }

    if (setClauses.length === 0) {
      // Nothing to change; return current row without mutating audit trail.
      return before;
    }

    params.push(sourceId, organizationId);
    const sourceIdx = params.length - 1;
    const orgIdx = params.length;

    const db = getDatabase();
    const result = await db.query(
      `
      UPDATE tp_record_sources
         SET ${setClauses.join(', ')}
       WHERE id = $${sourceIdx} AND organization_id = $${orgIdx} AND archived_at IS NULL
       RETURNING *
      `,
      params
    );

    if (result.rows.length === 0) {
      // Row vanished or was archived between read and write.
      throw makeError('SOURCE_NOT_FOUND', `Source disappeared mid-update: ${sourceId}`);
    }

    const updated = rowToSource(result.rows[0] as Record<string, unknown>);

    try {
      await auditService.logEvent(
        'record_source_updated',
        'record_source',
        sourceId,
        actorUserId,
        {
          source_uri: before.source_uri,
          source_metadata: before.source_metadata,
          confidence_contribution: before.confidence_contribution,
        },
        {
          source_uri: updated.source_uri,
          source_metadata: updated.source_metadata,
          confidence_contribution: updated.confidence_contribution,
        },
        { record_id: updated.record_id, organization_id: updated.organization_id }
      );
    } catch (auditErr) {
      logger.error('[RecordSourcesService] audit emit failed (state already mutated)', {
        sourceId,
        error: (auditErr as Error).message,
      });
    }

    return updated;
  },

  async markVerified(
    sourceId: string,
    organizationId: string,
    actorUserId: string
  ): Promise<RecordSource> {
    if (!sourceId) throw makeError('INVALID_INPUT', 'sourceId is required');
    if (!organizationId) throw makeError('INVALID_INPUT', 'organizationId is required');
    if (!actorUserId) throw makeError('INVALID_INPUT', 'actorUserId is required');

    const before = await this.getSource(sourceId, organizationId);
    if (!before) throw makeError('SOURCE_NOT_FOUND', `Source not found: ${sourceId}`);
    if (before.archived_at != null) {
      throw makeError('SOURCE_ARCHIVED', `Source ${sourceId} is archived; cannot verify`);
    }

    const db = getDatabase();
    const result = await db.query(
      `
      UPDATE tp_record_sources
         SET last_verified_at = now(),
             last_verified_by = $1
       WHERE id = $2 AND organization_id = $3 AND archived_at IS NULL
       RETURNING *
      `,
      [actorUserId, sourceId, organizationId]
    );

    if (result.rows.length === 0) {
      throw makeError('SOURCE_NOT_FOUND', `Source disappeared mid-verify: ${sourceId}`);
    }

    const verified = rowToSource(result.rows[0] as Record<string, unknown>);

    try {
      await auditService.logEvent(
        'record_source_verified',
        'record_source',
        sourceId,
        actorUserId,
        {
          last_verified_at: before.last_verified_at,
          last_verified_by: before.last_verified_by,
        },
        {
          last_verified_at: verified.last_verified_at,
          last_verified_by: verified.last_verified_by,
        },
        { record_id: verified.record_id, organization_id: verified.organization_id }
      );
    } catch (auditErr) {
      logger.error('[RecordSourcesService] audit emit failed (state already mutated)', {
        sourceId,
        error: (auditErr as Error).message,
      });
    }

    return verified;
  },

  /**
   * Soft-delete: set archived_at = now(). Idempotent; calling on an already
   * archived source is a no-op (returns the existing row).
   */
  async deleteSource(
    sourceId: string,
    organizationId: string,
    actorUserId: string
  ): Promise<RecordSource> {
    if (!sourceId) throw makeError('INVALID_INPUT', 'sourceId is required');
    if (!organizationId) throw makeError('INVALID_INPUT', 'organizationId is required');
    if (!actorUserId) throw makeError('INVALID_INPUT', 'actorUserId is required');

    const before = await this.getSource(sourceId, organizationId);
    if (!before) throw makeError('SOURCE_NOT_FOUND', `Source not found: ${sourceId}`);
    if (before.archived_at != null) {
      // Idempotent — already archived; return current state without re-auditing.
      return before;
    }

    const db = getDatabase();
    const result = await db.query(
      `
      UPDATE tp_record_sources
         SET archived_at = now()
       WHERE id = $1 AND organization_id = $2 AND archived_at IS NULL
       RETURNING *
      `,
      [sourceId, organizationId]
    );

    if (result.rows.length === 0) {
      // Race: archived between read and write. Treat as idempotent no-op.
      return before;
    }

    const archived = rowToSource(result.rows[0] as Record<string, unknown>);

    try {
      await auditService.logEvent(
        'record_source_archived',
        'record_source',
        sourceId,
        actorUserId,
        { archived_at: null },
        { archived_at: archived.archived_at },
        { record_id: archived.record_id, organization_id: archived.organization_id }
      );
    } catch (auditErr) {
      logger.error('[RecordSourcesService] audit emit failed (state already mutated)', {
        sourceId,
        error: (auditErr as Error).message,
      });
    }

    return archived;
  },
};

export type RecordSourcesService = typeof recordSourcesService;
export default recordSourcesService;
