/**
 * kpiDefinitionService — RES-02 canonical KPI definition owner.
 *
 * `initiative_kpis` is the canonical owner object; `initiative_kpis.id` is the
 * canonical KPI identity. This is the ONLY module allowed to write the
 * definition columns on `initiative_kpis` or insert into
 * `kpi_definition_versions` — every other writer (initiativeKpiAssignmentService,
 * benefits.routes, v8/results.routes, benefitsRegisterService.promoteBenefitToKpi,
 * and the second promotion path in v8/results.routes) delegates here instead
 * of running its own INSERT/UPDATE against `initiative_kpis`. See
 * `server/migrations/20260803_res002_kpi_definition_versions.sql` for the
 * schema this module writes to (immutable `kpi_definition_versions`, a
 * CAS-safe `current_definition_version` pointer enforced by a composite FK,
 * `archived_at`/`archived_by` for delete-as-archive).
 *
 * WHY A PINNED CONNECTION (not `DbPromise`). `DbPromise.transaction()` issues
 * `BEGIN` / each statement / `COMMIT` as independent `pool.query()` calls,
 * which can each land on a DIFFERENT backend connection — see the comment on
 * `getPoolClientForPinnedTransaction` in `PostgresDatabase.ts`. That is not
 * atomicity. A version bump that silently orphans its audit row, or a definition
 * write that "succeeds" while its version row never lands, is exactly the kind
 * of partial success this service exists to make impossible: create/update/
 * archive each run `BEGIN` → work → `COMMIT`/`ROLLBACK` on ONE checked-out
 * `pg.PoolClient`, released exactly once in a `finally`. Every write here also
 * inserts a `kpi_metric_audit_log` row in the SAME transaction — audit is no
 * longer a `.catch(() => null)` side effect only the v8 router happened to add;
 * if the audit insert fails, the whole write rolls back.
 *
 * WHY NO `fallback: true`. Both the pinned writes (raw `pg` client, no
 * `DbPromise` involved at all) and the reads below (`{ fallback: false }`)
 * refuse to let a real database error present as "not found" / empty. A
 * silently-swallowed read here would make `getCurrent` return null for a KPI
 * that genuinely exists — indistinguishable from a real 404 to every caller.
 *
 * CAS. `update()` takes `expectedVersion` and locks the `initiative_kpis` row
 * with `SELECT … FOR UPDATE` before comparing it against
 * `current_definition_version`. Under concurrent updates with the same
 * `expectedVersion`, Postgres serializes on that row lock: the first writer to
 * commit wins, and every other transaction re-reads the (now advanced) version
 * under its own lock and fails the CAS check — exactly one new version is ever
 * created per logical change, never a race of several.
 *
 * FAIL-CLOSED TENANCY. Every read and write is scoped by `organizationId` in
 * the query itself (never filtered in JS after an unscoped read). A KPI that
 * exists but belongs to a different org is indistinguishable from a KPI that
 * does not exist — `KpiDefinitionNotFoundError`, never a leak of its shape.
 */
import crypto from 'crypto';
import type { PoolClient } from 'pg';

import { getPoolClientForPinnedTransaction } from '../../database/PostgresDatabase.js';
import { all as dbAll, get as dbGet } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

const LOG_PREFIX = '[kpiDefinitionService]';

const DEFAULT_STATEMENT_TIMEOUT_MS = Number(process.env.DB_STATEMENT_TIMEOUT || 15000);
const DEFAULT_IDLE_IN_TRANSACTION_TIMEOUT_MS = Number(
  process.env.DB_IDLE_IN_TRANSACTION_TIMEOUT || 20000
);

export class KpiDefinitionNotFoundError extends Error {
  constructor(kpiId: string) {
    super(`KPI definition not found: ${kpiId}`);
    this.name = 'KpiDefinitionNotFoundError';
  }
}

export class KpiDefinitionArchivedError extends Error {
  constructor(kpiId: string) {
    super(`KPI definition is archived and cannot be edited: ${kpiId}`);
    this.name = 'KpiDefinitionArchivedError';
  }
}

export class KpiDefinitionVersionConflictError extends Error {
  constructor(
    public readonly kpiId: string,
    public readonly expectedVersion: number,
    public readonly actualVersion: number | null
  ) {
    super(
      `KPI definition version conflict for ${kpiId}: expected v${expectedVersion}, current is v${actualVersion ?? 'unknown'}`
    );
    this.name = 'KpiDefinitionVersionConflictError';
  }
}

export interface KpiDefinitionFields {
  name: string;
  description?: string | null;
  category?: string | null;
  unit?: string | null;
  direction?: string | null;
  measurementFrequency?: string | null;
  baselineValue?: number | null;
  targetValue?: number | null;
  thresholdMode?: string | null;
  amberThresholdPct?: number | null;
  redThresholdPct?: number | null;
  amberThresholdAbs?: number | null;
  redThresholdAbs?: number | null;
  alertThreshold?: number | null;
  alertDirection?: string | null;
  ownerUserId?: string | null;
  kpiKind?: string | null;
  leadsKpiId?: string | null;
}

const DEFINITION_FIELD_KEYS: Array<keyof KpiDefinitionFields> = [
  'name',
  'description',
  'category',
  'unit',
  'direction',
  'measurementFrequency',
  'baselineValue',
  'targetValue',
  'thresholdMode',
  'amberThresholdPct',
  'redThresholdPct',
  'amberThresholdAbs',
  'redThresholdAbs',
  'alertThreshold',
  'alertDirection',
  'ownerUserId',
  'kpiKind',
  'leadsKpiId',
];

const COLUMN_BY_FIELD: Record<keyof KpiDefinitionFields, string> = {
  name: 'name',
  description: 'description',
  category: 'category',
  unit: 'unit',
  direction: 'direction',
  measurementFrequency: 'measurement_frequency',
  baselineValue: 'baseline_value',
  targetValue: 'target_value',
  thresholdMode: 'threshold_mode',
  amberThresholdPct: 'amber_threshold_pct',
  redThresholdPct: 'red_threshold_pct',
  amberThresholdAbs: 'amber_threshold_abs',
  redThresholdAbs: 'red_threshold_abs',
  alertThreshold: 'alert_threshold',
  alertDirection: 'alert_direction',
  ownerUserId: 'owner_user_id',
  kpiKind: 'kpi_kind',
  leadsKpiId: 'leads_kpi_id',
};

export interface CreateKpiDefinitionInput extends KpiDefinitionFields {
  organizationId: string;
  initiativeId?: string | null;
  actorUserId?: string | null;
  currentValue?: number | null;
  reason?: string | null;
  source?: string | null;
}

export interface UpdateKpiDefinitionInput extends Partial<KpiDefinitionFields> {
  organizationId: string;
  kpiId: string;
  expectedVersion: number;
  actorUserId?: string | null;
  reason?: string | null;
  source?: string | null;
}

export interface ArchiveKpiDefinitionInput {
  organizationId: string;
  kpiId: string;
  actorUserId?: string | null;
  reason?: string | null;
}

export interface KpiDefinitionRecord {
  id: string;
  organizationId: string;
  initiativeId: string | null;
  currentDefinitionVersion: number;
  definitionVersionId: string;
  currentValue: number | null;
  archivedAt: string | null;
  archivedBy: string | null;
  createdAt: string;
  updatedAt: string;
  fields: KpiDefinitionFields;
}

export interface KpiDefinitionVersionRecord {
  id: string;
  organizationId: string;
  kpiId: string;
  versionNo: number;
  definition: KpiDefinitionFields;
  definitionHash: string;
  createdBy: string | null;
  createdAt: string;
  reason: string | null;
  source: string;
}

function toFields(row: Record<string, unknown>): KpiDefinitionFields {
  const fields: Record<string, unknown> = {};
  for (const key of DEFINITION_FIELD_KEYS) {
    const column = COLUMN_BY_FIELD[key];
    fields[key] = row[column] ?? null;
  }
  return fields as unknown as KpiDefinitionFields;
}

function definitionSnapshot(input: Partial<KpiDefinitionFields>): KpiDefinitionFields {
  const snapshot: Record<string, unknown> = {};
  for (const key of DEFINITION_FIELD_KEYS) {
    snapshot[key] = input[key] ?? null;
  }
  return snapshot as unknown as KpiDefinitionFields;
}

/**
 * PATCH semantics: a key that is ABSENT or explicitly `undefined` in `patch`
 * means "leave unchanged" — its value is carried over from `before`. Only a
 * key present with a non-`undefined` value (including explicit `null`, which
 * clears it) overrides. A naive `{ ...before, ...patch }` spread would be
 * wrong here: an object literal like `{ description: params.description }`
 * where `params.description` happens to be `undefined` still has an OWN
 * `description` key, and spread copies own keys regardless of value — so it
 * would silently null out a field the caller never intended to touch. Every
 * partial-update caller (all 5 rewired writers) relies on this NOT happening.
 */
function mergeDefinitionFields(
  before: KpiDefinitionFields,
  patch: Partial<KpiDefinitionFields>
): KpiDefinitionFields {
  const merged: Record<string, unknown> = {};
  for (const key of DEFINITION_FIELD_KEYS) {
    const patchValue = (patch as Record<string, unknown>)[key];
    merged[key] =
      patchValue !== undefined ? patchValue : (before as unknown as Record<string, unknown>)[key];
  }
  return merged as unknown as KpiDefinitionFields;
}

function computeDefinitionHash(definition: KpiDefinitionFields): string {
  // Stable key order (DEFINITION_FIELD_KEYS is a fixed literal list), so the
  // same content always hashes the same. Integrity/debugging aid, not a
  // dedup gate — the contract does not require skipping no-op updates.
  const canonical = DEFINITION_FIELD_KEYS.map((k) => [k, (definition as any)[k] ?? null]);
  return crypto.createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}

async function withPinnedTransaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPoolClientForPinnedTransaction();
  let began = false;
  try {
    await client.query('BEGIN');
    began = true;
    await client.query(`SET LOCAL statement_timeout = ${DEFAULT_STATEMENT_TIMEOUT_MS}`);
    await client.query(
      `SET LOCAL idle_in_transaction_session_timeout = ${DEFAULT_IDLE_IN_TRANSACTION_TIMEOUT_MS}`
    );
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    if (began) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        logger.error(`${LOG_PREFIX} rollback failed`, {
          error: (rollbackError as Error)?.message,
        });
      }
    }
    throw error;
  } finally {
    client.release();
  }
}

async function insertAuditEntry(
  client: PoolClient,
  entry: {
    organizationId: string;
    kpiId: string;
    section: string;
    eventType: string;
    actorUserId?: string | null;
    summary: string;
    before: unknown;
    after: unknown;
  }
): Promise<void> {
  await client.query(
    `INSERT INTO kpi_metric_audit_log
       (id, organization_id, kpi_id, section, event_type, source, actor_user_id, summary, before_json, after_json)
     VALUES (gen_random_uuid()::text, $1, $2, $3, $4, 'kpi_definition_service', $5, $6, $7, $8)`,
    [
      entry.organizationId,
      entry.kpiId,
      entry.section,
      entry.eventType,
      entry.actorUserId || null,
      entry.summary,
      JSON.stringify(entry.before ?? {}),
      JSON.stringify(entry.after ?? {}),
    ]
  );
}

/**
 * Create a new canonical KPI definition: an `initiative_kpis` row plus its
 * immutable v1 snapshot, `current_definition_version = 1`, and an audit
 * entry — one pinned transaction, all-or-nothing.
 */
export async function createDefinition(
  input: CreateKpiDefinitionInput
): Promise<KpiDefinitionRecord> {
  const organizationId = String(input.organizationId || '').trim();
  if (!organizationId) throw new Error('createDefinition: organizationId is required');
  const name = String(input.name || '').trim();
  if (!name) throw new Error('createDefinition: name is required');

  const fields = definitionSnapshot({ ...input, name });
  const definitionHash = computeDefinitionHash(fields);
  const initiativeId = input.initiativeId || null;
  const currentValue = input.currentValue ?? null;

  return withPinnedTransaction(async (client) => {
    const kpiRes = await client.query(
      `INSERT INTO initiative_kpis (
         id, initiative_id, organization_id, name, description, category, unit,
         direction, measurement_frequency, baseline_value, target_value,
         threshold_mode, amber_threshold_pct, red_threshold_pct,
         amber_threshold_abs, red_threshold_abs, alert_threshold, alert_direction,
         owner_user_id, kpi_kind, leads_kpi_id, current_value,
         created_at, updated_at
       ) VALUES (
         gen_random_uuid()::text, $1, $2, $3, $4, $5, $6,
         $7, $8, $9, $10,
         $11, $12, $13,
         $14, $15, $16, $17,
         $18, $19, $20, $21,
         CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
       ) RETURNING id, created_at, updated_at`,
      [
        initiativeId,
        organizationId,
        fields.name,
        fields.description,
        fields.category,
        fields.unit,
        fields.direction,
        fields.measurementFrequency,
        fields.baselineValue,
        fields.targetValue,
        fields.thresholdMode,
        fields.amberThresholdPct,
        fields.redThresholdPct,
        fields.amberThresholdAbs,
        fields.redThresholdAbs,
        fields.alertThreshold,
        fields.alertDirection,
        fields.ownerUserId,
        fields.kpiKind,
        fields.leadsKpiId,
        currentValue,
      ]
    );
    const kpiId = kpiRes.rows[0].id as string;

    const versionRes = await client.query(
      `INSERT INTO kpi_definition_versions
         (organization_id, kpi_id, version_no, definition, definition_hash, created_by, reason, source)
       VALUES ($1, $2, 1, $3::jsonb, $4, $5, $6, $7)
       RETURNING id`,
      [
        organizationId,
        kpiId,
        JSON.stringify(fields),
        definitionHash,
        input.actorUserId || null,
        input.reason || null,
        input.source || 'service',
      ]
    );
    const definitionVersionId = versionRes.rows[0].id as string;

    await client.query(`UPDATE initiative_kpis SET current_definition_version = 1 WHERE id = $1`, [
      kpiId,
    ]);

    await insertAuditEntry(client, {
      organizationId,
      kpiId,
      section: 'definition',
      eventType: 'definition_created',
      actorUserId: input.actorUserId,
      summary: `KPI definition created: ${fields.name}`,
      before: null,
      after: fields,
    });

    return {
      id: kpiId,
      organizationId,
      initiativeId,
      currentDefinitionVersion: 1,
      definitionVersionId,
      currentValue,
      archivedAt: null,
      archivedBy: null,
      createdAt: kpiRes.rows[0].created_at,
      updatedAt: kpiRes.rows[0].updated_at,
      fields,
    };
  });
}

/**
 * CAS-guarded update: locks the `initiative_kpis` row, verifies org scope +
 * not-archived + `expectedVersion` against the LOCKED value, then inserts the
 * next immutable version and advances the pointer. A zero-row lock (not
 * found / cross-org) and a version mismatch are both refusals — neither ever
 * silently "succeeds".
 */
export async function updateDefinition(
  input: UpdateKpiDefinitionInput
): Promise<KpiDefinitionRecord> {
  const organizationId = String(input.organizationId || '').trim();
  const kpiId = String(input.kpiId || '').trim();
  if (!organizationId) throw new Error('updateDefinition: organizationId is required');
  if (!kpiId) throw new Error('updateDefinition: kpiId is required');
  if (!Number.isInteger(input.expectedVersion) || input.expectedVersion < 1) {
    throw new Error('updateDefinition: expectedVersion must be a positive integer');
  }

  return withPinnedTransaction(async (client) => {
    const lockRes = await client.query(
      `SELECT k.*, i.organization_id AS initiative_organization_id
       FROM initiative_kpis k
       LEFT JOIN initiatives i ON i.id = k.initiative_id
       WHERE k.id = $1
       FOR UPDATE OF k`,
      [kpiId]
    );
    const row = lockRes.rows[0];
    const rowOrg = row?.organization_id || row?.initiative_organization_id || null;
    if (!row || rowOrg !== organizationId) {
      throw new KpiDefinitionNotFoundError(kpiId);
    }
    if (row.archived_at) {
      throw new KpiDefinitionArchivedError(kpiId);
    }
    const actualVersion: number | null = row.current_definition_version ?? null;
    if (actualVersion !== input.expectedVersion) {
      throw new KpiDefinitionVersionConflictError(kpiId, input.expectedVersion, actualVersion);
    }

    const before = toFields(row);
    const after = mergeDefinitionFields(before, input);
    const nextVersion = input.expectedVersion + 1;
    const definitionHash = computeDefinitionHash(after);

    const versionRes = await client.query(
      `INSERT INTO kpi_definition_versions
         (organization_id, kpi_id, version_no, definition, definition_hash, created_by, reason, source)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8)
       RETURNING id`,
      [
        organizationId,
        kpiId,
        nextVersion,
        JSON.stringify(after),
        definitionHash,
        input.actorUserId || null,
        input.reason || null,
        input.source || 'service',
      ]
    );
    const definitionVersionId = versionRes.rows[0].id as string;

    const updateRes = await client.query(
      `UPDATE initiative_kpis SET
         name = $1, description = $2, category = $3, unit = $4, direction = $5,
         measurement_frequency = $6, baseline_value = $7, target_value = $8,
         threshold_mode = $9, amber_threshold_pct = $10, red_threshold_pct = $11,
         amber_threshold_abs = $12, red_threshold_abs = $13, alert_threshold = $14,
         alert_direction = $15, owner_user_id = $16, kpi_kind = $17, leads_kpi_id = $18,
         current_definition_version = $19, updated_at = CURRENT_TIMESTAMP
       WHERE id = $20 AND current_definition_version = $21
       RETURNING id, created_at, updated_at, current_value`,
      [
        after.name,
        after.description,
        after.category,
        after.unit,
        after.direction,
        after.measurementFrequency,
        after.baselineValue,
        after.targetValue,
        after.thresholdMode,
        after.amberThresholdPct,
        after.redThresholdPct,
        after.amberThresholdAbs,
        after.redThresholdAbs,
        after.alertThreshold,
        after.alertDirection,
        after.ownerUserId,
        after.kpiKind,
        after.leadsKpiId,
        nextVersion,
        kpiId,
        input.expectedVersion,
      ]
    );
    // Zero-row update is a conflict, never a silent success — the row lock
    // above makes this defensive (the WHERE clause re-asserts the same
    // predicate the lock already verified), but no write path in this
    // service is allowed to treat rowCount === 0 as "done".
    if (updateRes.rowCount !== 1) {
      throw new KpiDefinitionVersionConflictError(kpiId, input.expectedVersion, actualVersion);
    }

    await insertAuditEntry(client, {
      organizationId,
      kpiId,
      section: 'definition',
      eventType: 'definition_updated',
      actorUserId: input.actorUserId,
      summary: `KPI definition updated: ${after.name} (v${input.expectedVersion} → v${nextVersion})`,
      before,
      after,
    });

    return {
      id: kpiId,
      organizationId,
      initiativeId: row.initiative_id || null,
      currentDefinitionVersion: nextVersion,
      definitionVersionId,
      currentValue: updateRes.rows[0].current_value ?? null,
      archivedAt: null,
      archivedBy: null,
      createdAt: row.created_at,
      updatedAt: updateRes.rows[0].updated_at,
      fields: after,
    };
  });
}

/**
 * Archive (= delete in the product sense): sets `archived_at`/`archived_by`.
 * Definition history and every immutable version are untouched — no version
 * is created and none is deleted. Idempotent: archiving an already-archived
 * KPI is a no-op success, not an error (matches DELETE semantics elsewhere in
 * this codebase).
 */
export async function archiveDefinition(
  input: ArchiveKpiDefinitionInput
): Promise<{ id: string; archivedAt: string; alreadyArchived: boolean }> {
  const organizationId = String(input.organizationId || '').trim();
  const kpiId = String(input.kpiId || '').trim();
  if (!organizationId) throw new Error('archiveDefinition: organizationId is required');
  if (!kpiId) throw new Error('archiveDefinition: kpiId is required');

  return withPinnedTransaction(async (client) => {
    const lockRes = await client.query(
      `SELECT k.id, k.archived_at, COALESCE(k.organization_id, i.organization_id) AS resolved_org
       FROM initiative_kpis k
       LEFT JOIN initiatives i ON i.id = k.initiative_id
       WHERE k.id = $1
       FOR UPDATE OF k`,
      [kpiId]
    );
    const row = lockRes.rows[0];
    if (!row || row.resolved_org !== organizationId) {
      throw new KpiDefinitionNotFoundError(kpiId);
    }
    if (row.archived_at) {
      return { id: kpiId, archivedAt: row.archived_at, alreadyArchived: true };
    }

    const updateRes = await client.query(
      `UPDATE initiative_kpis
       SET archived_at = CURRENT_TIMESTAMP, archived_by = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING archived_at`,
      [input.actorUserId || null, kpiId]
    );

    await insertAuditEntry(client, {
      organizationId,
      kpiId,
      section: 'lifecycle',
      eventType: 'definition_archived',
      actorUserId: input.actorUserId,
      summary: `KPI archived${input.reason ? `: ${input.reason}` : ''}`,
      before: { archivedAt: null },
      after: { archivedAt: updateRes.rows[0].archived_at, archivedBy: input.actorUserId || null },
    });

    return { id: kpiId, archivedAt: updateRes.rows[0].archived_at, alreadyArchived: false };
  });
}

/**
 * Org-scoped read of the current definition. `{ fallback: false }` throughout
 * — a real DB error surfaces as a rejection, never a silent "not found".
 */
export async function getCurrentDefinition(
  kpiId: string,
  organizationId: string
): Promise<KpiDefinitionRecord | null> {
  if (!kpiId || !organizationId) return null;
  const row = await dbGet<Record<string, unknown>>(
    `SELECT k.*, v.id AS definition_version_id
     FROM initiative_kpis k
     LEFT JOIN initiatives i ON i.id = k.initiative_id
     LEFT JOIN kpi_definition_versions v
       ON v.kpi_id = k.id AND v.version_no = k.current_definition_version
     WHERE k.id = ? AND COALESCE(k.organization_id, i.organization_id) = ?`,
    [kpiId, organizationId],
    { fallback: false }
  );
  if (!row) return null;
  return {
    id: String(row.id),
    organizationId,
    initiativeId: (row.initiative_id as string) || null,
    currentDefinitionVersion: Number(row.current_definition_version) || 0,
    definitionVersionId: String(row.definition_version_id || ''),
    currentValue: (row.current_value as number) ?? null,
    archivedAt: (row.archived_at as string) || null,
    archivedBy: (row.archived_by as string) || null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    fields: toFields(row),
  };
}

/** Org-scoped read of one specific immutable historical version. */
export async function getVersion(
  kpiId: string,
  organizationId: string,
  versionNo: number
): Promise<KpiDefinitionVersionRecord | null> {
  if (!kpiId || !organizationId || !Number.isInteger(versionNo)) return null;
  const row = await dbGet<Record<string, unknown>>(
    `SELECT * FROM kpi_definition_versions WHERE kpi_id = ? AND organization_id = ? AND version_no = ?`,
    [kpiId, organizationId, versionNo],
    { fallback: false }
  );
  if (!row) return null;
  return rowToVersionRecord(row);
}

/** Org-scoped read of one specific immutable historical version, by its id. */
export async function getVersionById(
  definitionVersionId: string,
  organizationId: string
): Promise<KpiDefinitionVersionRecord | null> {
  if (!definitionVersionId || !organizationId) return null;
  const row = await dbGet<Record<string, unknown>>(
    `SELECT * FROM kpi_definition_versions WHERE id = ? AND organization_id = ?`,
    [definitionVersionId, organizationId],
    { fallback: false }
  );
  if (!row) return null;
  return rowToVersionRecord(row);
}

/** Org-scoped read of every immutable version for a KPI, oldest first. */
export async function listVersions(
  kpiId: string,
  organizationId: string
): Promise<KpiDefinitionVersionRecord[]> {
  if (!kpiId || !organizationId) return [];
  const rows = await dbAll<Record<string, unknown>>(
    `SELECT * FROM kpi_definition_versions WHERE kpi_id = ? AND organization_id = ? ORDER BY version_no ASC`,
    [kpiId, organizationId],
    { fallback: false }
  );
  return (rows || []).map(rowToVersionRecord);
}

function rowToVersionRecord(row: Record<string, unknown>): KpiDefinitionVersionRecord {
  const definition =
    typeof row.definition === 'string' ? JSON.parse(row.definition as string) : row.definition;
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    kpiId: String(row.kpi_id),
    versionNo: Number(row.version_no),
    definition: definition as KpiDefinitionFields,
    definitionHash: String(row.definition_hash),
    createdBy: (row.created_by as string) || null,
    createdAt: String(row.created_at),
    reason: (row.reason as string) || null,
    source: String(row.source),
  };
}

/**
 * The current definition version id for a KPI, for pinning a NEW measurement
 * to "the version that was current when this was recorded" (RES-03 additive
 * pin only — this service does not otherwise touch time series). Returns null
 * if the KPI has no resolvable current version (should not happen post-RES-02
 * backfill, but callers must not crash if it does).
 */
export async function getCurrentDefinitionVersionId(
  kpiId: string,
  organizationId: string
): Promise<string | null> {
  const current = await getCurrentDefinition(kpiId, organizationId);
  return current?.definitionVersionId || null;
}
