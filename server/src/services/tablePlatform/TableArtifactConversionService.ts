/**
 * Table Artifact Conversion Service (Block D · EPIC-T13 · Sprint D-S1)
 *
 * Bridges Tabele (tp_tables + tp_records, optionally bundled into a Block C
 * source pack) into the existing artifact runtime — Document Studio v1 for
 * the document target, DeckBuilder for the presentation target.
 *
 * The service is intentionally thin:
 *
 *   1. ACL filter — actor must belong to the table's organization. Cross-tenant
 *      reads/writes are refused before any DB scan.
 *   2. Snapshot capture — either reuses a Block C source pack snapshot
 *      (immutable per Block C contract) OR captures a fresh snapshot from the
 *      live records. Either way the snapshot lives in
 *      `tp_table_conversions.v8_snapshot` so the conversion is replayable
 *      after the source records mutate.
 *   3. Materialize hand-off — calls an injectable `ArtifactMaterializer`
 *      (default: log-only stub). The real implementation is wired up in
 *      D-S2/D-S3 when the lane UI lands; the stub keeps Block D shippable
 *      while the artifact runtime team integrates `materializeArtifactRun`.
 *   4. Audit row — every conversion writes a `tp_table_conversions` row whose
 *      lifecycle is `queued → running → succeeded|failed|cancelled`.
 *
 * What this service is NOT:
 *
 *   - It does NOT generate PDF / PPTX bytes. Those are the responsibility of
 *     Document Studio / DeckBuilder export pipelines. We hand them a
 *     `sourceType + sourceId` they already understand and let the existing
 *     export route do its job.
 *   - It does NOT introduce a new V8 snapshot kind. The snapshot we carry is
 *     either the Block C source pack snapshot or a freshly captured one with
 *     `captureSource = 'table_conversion'` — same shape, different label.
 *
 * Cross-tenant safety: every public method requires the actor's
 * `organizationId`. The service refuses to read or write a row whose tenant
 * does not match — even if a request smuggles a `tableId` or `sourcePackId`
 * from another tenant.
 *
 * Persistence: `tp_table_conversions` (see migrations/20260512_block_d_table_conversions.sql).
 *
 * Spec:
 *   - 00_CTO_DECISIONS.md Q11 (reuse Document Studio v1 + DeckBuilder; no new
 *     doctrine), Q15 (right-rail share panel hosts the trigger), Q16 (this
 *     service owns the adapter from source-pack snapshot to materialize
 *     params; we do NOT extend the SNAPSHOT_SOURCE_KIND_TO_* registries).
 *   - block-D-integration-evidence/audit-findings/V8_CONTRACT_AUDIT_2026-05-08.md
 */

import { getDatabase } from '../../database/Database.js';
import logger from '../../utils/Logger.js';
import sourcePackBuilderService, {
  type SourcePack,
  type SourcePackSnapshot,
} from './SourcePackBuilderService.js';

// ── Types ────────────────────────────────────────────────────────────────────

export type ConversionTarget = 'document' | 'presentation';

export type ConversionStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';

export type ConversionFailureStage = 'snapshot' | 'materialize' | 'register' | 'retry';

export interface ConversionOutlineHint {
  heading: string;
  bodyHint?: string;
}

export interface ConvertTableInput {
  tableId: string;
  organizationId: string;
  workspaceId: string;
  initiatedBy: string;
  target: ConversionTarget;
  /** Optional Block C source pack ID. When omitted, we snapshot live records. */
  sourcePackId?: string;
  title?: string;
  outline?: ConversionOutlineHint[];
  /** Hard cap on records pulled when no source pack is supplied. */
  liveRecordCap?: number;
}

export interface ConversionRecord {
  id: string;
  organizationId: string;
  workspaceId: string;
  tableId: string;
  sourcePackId: string | null;
  target: ConversionTarget;
  title: string | null;
  outline: ConversionOutlineHint[] | null;
  v8Snapshot: ConversionSnapshot;
  status: ConversionStatus;
  artifactRunId: string | null;
  artifactDeepLink: string | null;
  initiatedBy: string;
  initiatedAt: string;
  completedAt: string | null;
  failureReason: string | null;
  failureStage: ConversionFailureStage | null;
}

/**
 * Same shape as `SourcePackSnapshot` to keep adapter logic boring. The only
 * difference is `captureSource`: a snapshot built from live records is
 * tagged `'table_conversion'`, a snapshot inherited from Block C keeps the
 * pack's original `'source_pack_create'` value.
 */
export interface ConversionSnapshot extends Omit<SourcePackSnapshot, 'captureSource'> {
  captureSource: 'source_pack_create' | 'table_conversion';
}

export interface ConversionMaterializeRequest {
  conversionId: string;
  organizationId: string;
  workspaceId: string;
  tableId: string;
  target: ConversionTarget;
  sourcePackId: string | null;
  title: string | null;
  outline: ConversionOutlineHint[] | null;
  snapshot: ConversionSnapshot;
  initiatedBy: string;
}

export interface ConversionMaterializeResult {
  artifactRunId: string;
  artifactDeepLink: string | null;
}

/**
 * Pluggable bridge to the V8 artifact runtime. The default stub returns a
 * deterministic fake run id so the conversion lifecycle is exercisable
 * without the full materialize stack. D-S3 swaps this for the real wiring.
 */
export interface ArtifactMaterializer {
  materialize(req: ConversionMaterializeRequest): Promise<ConversionMaterializeResult>;
}

export interface ConvertTableResult {
  conversionId: string;
  status: ConversionStatus;
  artifactRunId: string | null;
  artifactDeepLink: string | null;
  sourcePackId: string | null;
}

export interface ListConversionsInput {
  organizationId: string;
  workspaceId?: string;
  tableId?: string;
  status?: ConversionStatus;
  limit?: number;
}

// ── Errors ───────────────────────────────────────────────────────────────────

export class TableConversionError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 400
  ) {
    super(message);
    this.name = 'TableConversionError';
  }
}

// ── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_LIVE_RECORD_CAP = 200;
const HARD_LIVE_RECORD_CAP = 500;
const MAX_TITLE_CHARS = 200;
const MAX_OUTLINE_ITEMS = 50;
const MAX_OUTLINE_HEADING_CHARS = 200;
const MAX_OUTLINE_BODY_CHARS = 2000;
const VALID_TARGETS: ReadonlySet<ConversionTarget> = new Set(['document', 'presentation']);

// ── Tenant resolution (mirrors SourcePackBuilderService.loadTenant) ──────────

interface TenantRow {
  workspaceId: string;
  organizationId: string;
}

async function loadTenant(tableId: string): Promise<TenantRow | null> {
  const db = getDatabase();
  const { rows } = await db.query(
    `SELECT b.workspace_id, b.organization_id
       FROM tp_tables t
       JOIN tp_bases  b ON t.base_id = b.id
      WHERE t.id = $1
      LIMIT 1`,
    [tableId]
  );
  const row = rows?.[0] as { workspace_id?: unknown; organization_id?: unknown } | undefined;
  if (!row?.workspace_id || !row?.organization_id) return null;
  return {
    workspaceId: String(row.workspace_id),
    organizationId: String(row.organization_id),
  };
}

// ── Field / record loading (kept local to avoid coupling with Block C) ──────

interface FieldRow {
  id: string;
  name: string;
  fieldType: string;
}

async function loadFields(tableId: string): Promise<FieldRow[]> {
  const db = getDatabase();
  const { rows } = await db.query(
    `SELECT id, name, field_type, field_order
       FROM tp_fields
      WHERE table_id = $1
      ORDER BY field_order ASC, name ASC`,
    [tableId]
  );
  return (rows ?? []).map((r: any) => ({
    id: String(r.id),
    name: String(r.name),
    fieldType: String(r.field_type),
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

async function loadLiveRecords(tableId: string, cap: number): Promise<RecordRow[]> {
  const db = getDatabase();
  const { rows } = await db.query(
    `SELECT id, data, confidence_score, validation_status, updated_at
       FROM tp_records
      WHERE table_id = $1
      ORDER BY updated_at DESC
      LIMIT $2`,
    [tableId, cap]
  );
  return (rows ?? []).map(rowToRecord);
}

// ── Validation helpers ──────────────────────────────────────────────────────

function validateTarget(target: unknown): ConversionTarget {
  if (typeof target !== 'string' || !VALID_TARGETS.has(target as ConversionTarget)) {
    throw new TableConversionError(
      'INVALID_TARGET',
      `target must be one of: ${Array.from(VALID_TARGETS).join(', ')}`
    );
  }
  return target as ConversionTarget;
}

function validateOutline(outline: unknown): ConversionOutlineHint[] | null {
  if (outline == null) return null;
  if (!Array.isArray(outline)) {
    throw new TableConversionError('INVALID_OUTLINE', 'outline must be an array');
  }
  if (outline.length > MAX_OUTLINE_ITEMS) {
    throw new TableConversionError(
      'OUTLINE_TOO_LONG',
      `outline can hold at most ${MAX_OUTLINE_ITEMS} items`
    );
  }
  return outline.map((item, idx) => {
    if (!item || typeof item !== 'object') {
      throw new TableConversionError('INVALID_OUTLINE_ITEM', `outline[${idx}] must be an object`);
    }
    const heading = (item as Record<string, unknown>).heading;
    if (typeof heading !== 'string' || heading.trim().length === 0) {
      throw new TableConversionError(
        'INVALID_OUTLINE_HEADING',
        `outline[${idx}].heading is required`
      );
    }
    if (heading.length > MAX_OUTLINE_HEADING_CHARS) {
      throw new TableConversionError(
        'OUTLINE_HEADING_TOO_LONG',
        `outline[${idx}].heading max ${MAX_OUTLINE_HEADING_CHARS} chars`
      );
    }
    const bodyHint = (item as Record<string, unknown>).bodyHint;
    if (bodyHint != null && typeof bodyHint !== 'string') {
      throw new TableConversionError(
        'INVALID_OUTLINE_BODY',
        `outline[${idx}].bodyHint must be a string`
      );
    }
    if (typeof bodyHint === 'string' && bodyHint.length > MAX_OUTLINE_BODY_CHARS) {
      throw new TableConversionError(
        'OUTLINE_BODY_TOO_LONG',
        `outline[${idx}].bodyHint max ${MAX_OUTLINE_BODY_CHARS} chars`
      );
    }
    return {
      heading: heading.trim(),
      bodyHint: typeof bodyHint === 'string' ? bodyHint.trim() : undefined,
    };
  });
}

function validateTitle(title: unknown): string | null {
  if (title == null) return null;
  if (typeof title !== 'string') {
    throw new TableConversionError('INVALID_TITLE', 'title must be a string');
  }
  const trimmed = title.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > MAX_TITLE_CHARS) {
    throw new TableConversionError('TITLE_TOO_LONG', `title max ${MAX_TITLE_CHARS} chars`);
  }
  return trimmed;
}

function clampLiveRecordCap(value: number | undefined): number {
  if (value == null || !Number.isFinite(value)) return DEFAULT_LIVE_RECORD_CAP;
  return Math.max(1, Math.min(HARD_LIVE_RECORD_CAP, Math.floor(value)));
}

// ── Snapshot adapter ─────────────────────────────────────────────────────────

/**
 * The Block C → Block D adapter (CTO Q16). Translates a `SourcePackSnapshot`
 * into a `ConversionSnapshot`. Both shapes are intentionally identical except
 * for the `captureSource` discriminator; the adapter exists so any future
 * divergence is contained in one place.
 */
function adaptSourcePackSnapshot(snapshot: SourcePackSnapshot): ConversionSnapshot {
  return {
    records: snapshot.records,
    fields: snapshot.fields,
    capturedAt: snapshot.capturedAt,
    captureSource: snapshot.captureSource,
  };
}

async function captureLiveSnapshot(tableId: string, cap: number): Promise<ConversionSnapshot> {
  const [fields, records] = await Promise.all([loadFields(tableId), loadLiveRecords(tableId, cap)]);
  return {
    records: records.map((r) => ({
      id: r.id,
      data: r.data,
      confidenceScore: r.confidenceScore,
      validationStatus: r.validationStatus,
      updatedAt: r.updatedAt,
    })),
    fields: fields.map((f) => ({ id: f.id, name: f.name, fieldType: f.fieldType })),
    capturedAt: new Date().toISOString(),
    captureSource: 'table_conversion',
  };
}

// ── Default materializer ─────────────────────────────────────────────────────

/**
 * The default production materializer (D-S3). Bridges a conversion into the
 * canonical V8 artifact runtime via `registerArtifactOrigin` and returns a
 * real `artifactRunId` (the canonical artifactId) + deep link into the
 * Report Builder / Presentations editor.
 *
 * Loaded lazily on first use to avoid a static import cycle between this
 * service and `conversionMaterializer` (which depends on this module's types).
 */
let defaultMaterializerPromise: Promise<ArtifactMaterializer> | null = null;

const lazyDefaultMaterializer: ArtifactMaterializer = {
  async materialize(req) {
    if (!defaultMaterializerPromise) {
      defaultMaterializerPromise = import('./conversionMaterializer.js').then(
        (m) => m.realArtifactMaterializer
      );
    }
    const real = await defaultMaterializerPromise;
    return real.materialize(req);
  },
};

let activeMaterializer: ArtifactMaterializer = lazyDefaultMaterializer;

/**
 * Replaces the active materializer. Tests use this to assert the request
 * envelope; passing `null` restores the production default.
 */
export function __setMaterializerForTesting(m: ArtifactMaterializer | null): void {
  activeMaterializer = m ?? lazyDefaultMaterializer;
}

// ── Persistence helpers ──────────────────────────────────────────────────────

function rowToConversion(row: any): ConversionRecord {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    workspaceId: String(row.workspace_id),
    tableId: String(row.table_id),
    sourcePackId: row.source_pack_id ? String(row.source_pack_id) : null,
    target: row.target as ConversionTarget,
    title: row.title == null ? null : String(row.title),
    outline:
      row.outline == null
        ? null
        : typeof row.outline === 'string'
          ? (JSON.parse(row.outline) as ConversionOutlineHint[])
          : (row.outline as ConversionOutlineHint[]),
    v8Snapshot:
      typeof row.v8_snapshot === 'string'
        ? (JSON.parse(row.v8_snapshot) as ConversionSnapshot)
        : (row.v8_snapshot as ConversionSnapshot),
    status: row.status as ConversionStatus,
    artifactRunId: row.artifact_run_id ? String(row.artifact_run_id) : null,
    artifactDeepLink: row.artifact_deep_link == null ? null : String(row.artifact_deep_link),
    initiatedBy: String(row.initiated_by),
    initiatedAt:
      row.initiated_at instanceof Date ? row.initiated_at.toISOString() : String(row.initiated_at),
    completedAt:
      row.completed_at == null
        ? null
        : row.completed_at instanceof Date
          ? row.completed_at.toISOString()
          : String(row.completed_at),
    failureReason: row.failure_reason == null ? null : String(row.failure_reason),
    failureStage: row.failure_stage == null ? null : (row.failure_stage as ConversionFailureStage),
  };
}

async function insertQueuedConversion(params: {
  organizationId: string;
  workspaceId: string;
  tableId: string;
  sourcePackId: string | null;
  target: ConversionTarget;
  title: string | null;
  outline: ConversionOutlineHint[] | null;
  v8Snapshot: ConversionSnapshot;
  initiatedBy: string;
}): Promise<ConversionRecord> {
  const db = getDatabase();
  const { rows } = await db.query(
    `INSERT INTO tp_table_conversions
       (organization_id, workspace_id, table_id, source_pack_id, target,
        title, outline, v8_snapshot, status, initiated_by)
     VALUES ($1, $2, $3, $4, $5,
             $6, $7::jsonb, $8::jsonb, 'queued', $9)
     RETURNING id, organization_id, workspace_id, table_id, source_pack_id,
               target, title, outline, v8_snapshot, status, artifact_run_id,
               artifact_deep_link, initiated_by, initiated_at, completed_at,
               failure_reason, failure_stage`,
    [
      params.organizationId,
      params.workspaceId,
      params.tableId,
      params.sourcePackId,
      params.target,
      params.title,
      params.outline === null ? null : JSON.stringify(params.outline),
      JSON.stringify(params.v8Snapshot),
      params.initiatedBy,
    ]
  );
  const row = rows?.[0];
  if (!row) throw new TableConversionError('PERSIST_FAILED', 'Conversion persist failed', 500);
  return rowToConversion(row);
}

async function markRunning(conversionId: string): Promise<void> {
  const db = getDatabase();
  await db.query(
    `UPDATE tp_table_conversions
        SET status = 'running'
      WHERE id = $1 AND status = 'queued'`,
    [conversionId]
  );
}

async function markSucceeded(
  conversionId: string,
  artifactRunId: string,
  artifactDeepLink: string | null
): Promise<ConversionRecord> {
  const db = getDatabase();
  const { rows } = await db.query(
    `UPDATE tp_table_conversions
        SET status = 'succeeded',
            artifact_run_id = $2::uuid,
            artifact_deep_link = $3,
            completed_at = NOW()
      WHERE id = $1
      RETURNING id, organization_id, workspace_id, table_id, source_pack_id,
                target, title, outline, v8_snapshot, status, artifact_run_id,
                artifact_deep_link, initiated_by, initiated_at, completed_at,
                failure_reason, failure_stage`,
    [conversionId, artifactRunId, artifactDeepLink]
  );
  const row = rows?.[0];
  if (!row) throw new TableConversionError('PERSIST_FAILED', 'Mark succeeded failed', 500);
  return rowToConversion(row);
}

async function markFailed(
  conversionId: string,
  stage: ConversionFailureStage,
  reason: string
): Promise<ConversionRecord> {
  const db = getDatabase();
  const { rows } = await db.query(
    `UPDATE tp_table_conversions
        SET status = 'failed',
            failure_stage = $2,
            failure_reason = $3,
            completed_at = NOW()
      WHERE id = $1
      RETURNING id, organization_id, workspace_id, table_id, source_pack_id,
                target, title, outline, v8_snapshot, status, artifact_run_id,
                artifact_deep_link, initiated_by, initiated_at, completed_at,
                failure_reason, failure_stage`,
    [conversionId, stage, reason.slice(0, 4000)]
  );
  const row = rows?.[0];
  if (!row) throw new TableConversionError('PERSIST_FAILED', 'Mark failed failed', 500);
  return rowToConversion(row);
}

// ── Service ──────────────────────────────────────────────────────────────────

const tableArtifactConversionService = {
  /**
   * Convert a Tabele table into a Wordy document or Prezentacje deck. The
   * lifecycle is `queued → running → succeeded|failed`. When a `sourcePackId`
   * is supplied, the conversion piggy-backs on the pack's immutable snapshot;
   * otherwise we capture a fresh snapshot from live records.
   */
  async convertTable(input: ConvertTableInput): Promise<ConvertTableResult> {
    if (!input.tableId) {
      throw new TableConversionError('TABLE_ID_REQUIRED', 'tableId is required');
    }
    if (!input.organizationId) {
      throw new TableConversionError('ORG_ID_REQUIRED', 'organizationId is required');
    }
    if (!input.workspaceId) {
      throw new TableConversionError('WS_ID_REQUIRED', 'workspaceId is required');
    }
    if (!input.initiatedBy) {
      throw new TableConversionError('INITIATED_BY_REQUIRED', 'initiatedBy is required');
    }

    const target = validateTarget(input.target);
    const title = validateTitle(input.title);
    const outline = validateOutline(input.outline);

    const tenant = await loadTenant(input.tableId);
    if (!tenant) {
      throw new TableConversionError('TABLE_NOT_FOUND', 'Table not found', 404);
    }
    if (tenant.organizationId !== input.organizationId) {
      throw new TableConversionError('TENANT_VIOLATION', 'Table not in actor organization', 403);
    }
    if (tenant.workspaceId !== input.workspaceId) {
      throw new TableConversionError(
        'WORKSPACE_VIOLATION',
        'Table workspace does not match request',
        403
      );
    }

    let sourcePack: SourcePack | null = null;
    if (input.sourcePackId) {
      sourcePack = await sourcePackBuilderService.getPack(input.sourcePackId, input.organizationId);
      if (!sourcePack) {
        throw new TableConversionError('SOURCE_PACK_NOT_FOUND', 'Source pack not found', 404);
      }
      // Cross-tenant + cross-table guards. getPack already enforces org; we
      // additionally require the pack to belong to the requested table so
      // the materialize path cannot be tricked into mixing data.
      if (sourcePack.tableId && sourcePack.tableId !== input.tableId) {
        throw new TableConversionError(
          'SOURCE_PACK_TABLE_MISMATCH',
          'Source pack belongs to a different table',
          400
        );
      }
    }

    let snapshot: ConversionSnapshot;
    let conversion: ConversionRecord;

    try {
      snapshot = sourcePack
        ? adaptSourcePackSnapshot(sourcePack.v8Snapshot)
        : await captureLiveSnapshot(input.tableId, clampLiveRecordCap(input.liveRecordCap));
    } catch (e) {
      logger.error('[TableArtifactConversionService] snapshot capture failed', {
        tableId: input.tableId,
        sourcePackId: input.sourcePackId ?? null,
        error: (e as Error)?.message,
      });
      throw new TableConversionError(
        'SNAPSHOT_FAILED',
        (e as Error)?.message ?? 'snapshot capture failed',
        500
      );
    }

    if (snapshot.records.length === 0) {
      throw new TableConversionError('NO_RECORDS', 'Cannot convert a table with zero records', 400);
    }

    try {
      conversion = await insertQueuedConversion({
        organizationId: tenant.organizationId,
        workspaceId: tenant.workspaceId,
        tableId: input.tableId,
        sourcePackId: sourcePack?.id ?? null,
        target,
        title,
        outline,
        v8Snapshot: snapshot,
        initiatedBy: input.initiatedBy,
      });
    } catch (e) {
      if (e instanceof TableConversionError) throw e;
      logger.error('[TableArtifactConversionService] insert queued conversion failed', {
        tableId: input.tableId,
        error: (e as Error)?.message,
      });
      throw new TableConversionError(
        'PERSIST_FAILED',
        (e as Error)?.message ?? 'persist failed',
        500
      );
    }

    await markRunning(conversion.id);

    let materialized: ConversionMaterializeResult;
    try {
      materialized = await activeMaterializer.materialize({
        conversionId: conversion.id,
        organizationId: conversion.organizationId,
        workspaceId: conversion.workspaceId,
        tableId: conversion.tableId,
        target: conversion.target,
        sourcePackId: conversion.sourcePackId,
        title: conversion.title,
        outline: conversion.outline,
        snapshot,
        initiatedBy: conversion.initiatedBy,
      });
    } catch (e) {
      const reason = (e as Error)?.message ?? 'materialize failed';
      logger.error('[TableArtifactConversionService] materialize failed', {
        conversionId: conversion.id,
        error: reason,
      });
      const failed = await markFailed(conversion.id, 'materialize', reason);
      return {
        conversionId: failed.id,
        status: failed.status,
        artifactRunId: null,
        artifactDeepLink: null,
        sourcePackId: failed.sourcePackId,
      };
    }

    if (!materialized.artifactRunId) {
      const failed = await markFailed(
        conversion.id,
        'materialize',
        'materializer returned no run id'
      );
      return {
        conversionId: failed.id,
        status: failed.status,
        artifactRunId: null,
        artifactDeepLink: null,
        sourcePackId: failed.sourcePackId,
      };
    }

    const succeeded = await markSucceeded(
      conversion.id,
      materialized.artifactRunId,
      materialized.artifactDeepLink ?? null
    );

    // If the conversion came from a source pack, bump its analytics counter so
    // curators can see which packs convert best. We swallow errors — a counter
    // miss is not worth failing a successful conversion.
    if (sourcePack) {
      try {
        await sourcePackBuilderService.markPackUsed(sourcePack.id, sourcePack.organizationId);
      } catch (e) {
        logger.warn('[TableArtifactConversionService] markPackUsed failed', {
          packId: sourcePack.id,
          error: (e as Error)?.message,
        });
      }
    }

    return {
      conversionId: succeeded.id,
      status: succeeded.status,
      artifactRunId: succeeded.artifactRunId,
      artifactDeepLink: succeeded.artifactDeepLink,
      sourcePackId: succeeded.sourcePackId,
    };
  },

  /**
   * Returns a single conversion by id, refusing cross-tenant reads.
   */
  async getConversion(
    conversionId: string,
    organizationId: string
  ): Promise<ConversionRecord | null> {
    if (!conversionId) {
      throw new TableConversionError('CONVERSION_ID_REQUIRED', 'conversionId is required');
    }
    if (!organizationId) {
      throw new TableConversionError('ORG_ID_REQUIRED', 'organizationId is required');
    }
    const db = getDatabase();
    const { rows } = await db.query(
      `SELECT id, organization_id, workspace_id, table_id, source_pack_id,
              target, title, outline, v8_snapshot, status, artifact_run_id,
              artifact_deep_link, initiated_by, initiated_at, completed_at,
              failure_reason, failure_stage
         FROM tp_table_conversions
        WHERE id = $1
        LIMIT 1`,
      [conversionId]
    );
    const row = rows?.[0] as { organization_id?: unknown } | undefined;
    if (!row) return null;
    if (String(row.organization_id) !== organizationId) return null;
    return rowToConversion(row);
  },

  /**
   * Lists conversions in the actor's tenant. Always scoped to organizationId;
   * can additionally filter by workspaceId / tableId / status.
   */
  async listConversions(input: ListConversionsInput): Promise<ConversionRecord[]> {
    if (!input.organizationId) {
      throw new TableConversionError('ORG_ID_REQUIRED', 'organizationId is required');
    }

    const limit = Math.max(1, Math.min(100, Math.floor(Number(input.limit ?? 50))));
    const params: unknown[] = [input.organizationId];
    const wheres: string[] = ['organization_id = $1'];

    if (input.workspaceId) {
      params.push(input.workspaceId);
      wheres.push(`workspace_id = $${params.length}`);
    }
    if (input.tableId) {
      params.push(input.tableId);
      wheres.push(`table_id = $${params.length}`);
    }
    if (input.status) {
      params.push(input.status);
      wheres.push(`status = $${params.length}`);
    }
    params.push(limit);

    const db = getDatabase();
    const { rows } = await db.query(
      `SELECT id, organization_id, workspace_id, table_id, source_pack_id,
              target, title, outline, v8_snapshot, status, artifact_run_id,
              artifact_deep_link, initiated_by, initiated_at, completed_at,
              failure_reason, failure_stage
         FROM tp_table_conversions
        WHERE ${wheres.join(' AND ')}
        ORDER BY initiated_at DESC
        LIMIT $${params.length}`,
      params
    );
    return (rows ?? []).map(rowToConversion);
  },
};

export default tableArtifactConversionService;
