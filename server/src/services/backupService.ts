/**
 * Backup Service — REAL implementation (T7b-2).
 *
 * WHY THIS EXISTS
 * ---------------
 * Historically `backupService` was a dead self-import wrapper (`import service from
 * './backupService.js'` — resolved to itself, default `undefined`), so every caller
 * — routes/admin/backup.routes.ts (6 endpoints), routes/superadmin.routes.ts
 * (/system/backup) and cron/BackupCron.ts — fell through to a 503 / crash path.
 * See MEMORY: finding_42_self_import_wrappers_services_2026-07-15.
 *
 * DESIGN (v1)
 * -----------
 * The Railway app container has NO `pg_dump` binary, so a native dump is not an
 * option here. Instead this service performs a **logical JSON export** of a
 * configurable list of critical tables through the app's own DB seam
 * (`utils/DbPromise` → Postgres in prod/parity, SQLite locally), writes a single
 * self-describing JSON object to the durable storage seam (`services/storage`,
 * S3/R2 when configured, local disk otherwise), and records metadata + a manifest
 * row in `backup_manifests`.
 *
 * Scope:
 *   - superadmin / cron  → whole DB (all critical tables, unfiltered)
 *   - admin (org)        → org-scoped (only rows for that organization_id)
 *
 * Restore is restricted to an explicitly isolated PostgreSQL target and runs
 * transactionally after checksum, manifest and tenant-boundary validation.
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from 'crypto';
import type { Readable } from 'stream';

import { Client as PgClient } from 'pg';

import { all as dbAll, columnExists, get as dbGet, run as dbRun, tableExists } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';
import { withPgTransaction } from '../utils/queryHelpers.js';
import { getStorage } from './storage/index.js';

// ==========================================
// CONFIG
// ==========================================

/**
 * Canonical v2 acceptance registry. Required owner tables are never replaced,
 * reordered or duplicated by caller/env input. Optional tables require an
 * explicit reviewed entry in OPTIONAL_SAFE_TABLES.
 */
const REQUIRED_OWNER_TABLES = new Set(['organizations', 'users', 'organization_members']);
const CANONICAL_V2_TABLES = ['organizations', 'users', 'organization_members'] as const;
const CANONICAL_V2_TABLE_SET = new Set<string>(CANONICAL_V2_TABLES);
const OPTIONAL_SAFE_TABLES = new Set<string>();
const CANONICAL_SCHEMA_VERSION = 2;
const RPO_THRESHOLD_SECONDS = 15 * 60;

/** Backups older than this are eligible for retention cleanup. */
function retentionDays(): number {
  const raw = Number.parseInt(process.env.BACKUP_RETENTION_DAYS || '30', 10);
  return Number.isFinite(raw) && raw > 0 ? raw : 30;
}

/** Only simple, allow-list-shaped identifiers may be interpolated into SQL. */
const SAFE_IDENT = /^[a-z_][a-z0-9_]*$/;

function criticalTables(explicit?: string[]): string[] {
  const requested = explicit ?? (process.env.BACKUP_TABLES || '').split(',').map((s) => s.trim()).filter(Boolean);
  const optional: string[] = [];
  for (const table of requested) {
    if (!SAFE_IDENT.test(table)) throw new Error(`BACKUP_UNSAFE_TABLE:${table}`);
    if (CANONICAL_V2_TABLE_SET.has(table)) continue;
    if (!OPTIONAL_SAFE_TABLES.has(table)) throw new Error(`BACKUP_OPTIONAL_TABLE_NOT_APPROVED:${table}`);
    if (!optional.includes(table)) optional.push(table);
  }
  return [...CANONICAL_V2_TABLES, ...optional];
}

// ==========================================
// TYPES
// ==========================================

export type BackupType = 'full' | 'incremental';
export type BackupScope = 'system' | 'organization';

export interface BackupTableEntry {
  name: string;
  rowCount: number;
  sha256?: string;
  skipped?: boolean;
  reason?: string;
}

export interface BackupManifest {
  id: string;
  type: BackupType;
  scope: BackupScope;
  organizationId: string | null;
  reason: string;
  createdAt: string;
  format: 'consultify-logical-backup-v2' | 'consultify-json-v1';
  sourceWatermark?: string;
  sourceObservedAt?: string;
  sourceChangeVersion?: number;
  sourceDatabase?: string;
  sourceSha256?: string;
  payloadSha256?: string;
  schemaVersion?: number;
  keyId?: string;
  tables: BackupTableEntry[];
  tableCount: number;
  totalRows: number;
  storageKey: string;
  provider: string;
  encrypted: true;
  encryptionAlgorithm: 'aes-256-gcm';
}

export interface BackupRecord {
  id: string;
  type: BackupType;
  scope: BackupScope;
  organizationId: string | null;
  reason: string;
  status: 'completed' | 'failed';
  storageKey: string | null;
  provider: string | null;
  tableCount: number;
  rowCount: number;
  sizeBytes: number;
  createdAt: string;
  expiresAt: string | null;
  tables: BackupTableEntry[];
  error?: string | null;
  checksumSha256: string | null;
  encrypted: boolean;
  /** Cloud-presence flags read by backup.routes.ts. */
  hasS3: boolean;
  hasGCS: boolean;
}

export interface CreateBackupOptions {
  /** When set, produces an ORG-SCOPED backup (only that org's rows). */
  organizationId?: string;
  /** Override the critical-tables list for this backup. */
  tables?: string[];
  actorId?: string;
}

export interface RestoreBackupOptions {
  targetDatabaseUrl: string;
  actorId: string;
  expectedOrganizationId?: string;
}

export interface RestoreResult {
  backupId: string;
  targetDatabase: string;
  restoredTables: number;
  restoredRows: number;
  checksumVerified: true;
  organizationId: string | null;
}

interface EncryptedBackupEnvelope {
  format: 'consultify-logical-backup-v2' | 'consultify-encrypted-json-v1';
  algorithm: 'aes-256-gcm';
  iv: string;
  authTag: string;
  ciphertext: string;
  checksumSha256: string;
}

export class BackupNotImplementedError extends Error {
  readonly code = 'RESTORE_NOT_IMPLEMENTED';
  constructor(message: string) {
    super(message);
    this.name = 'BackupNotImplementedError';
  }
}

// ==========================================
// SCHEMA
// ==========================================

let tableReady: Promise<void> | null = null;
let tableReadyDatabaseKey = '';

async function ensureTable(): Promise<void> {
  const databaseKey = `${process.env.DB_TYPE || ''}:${process.env.DATABASE_URL || 'sqlite'}`;
  if (tableReadyDatabaseKey !== databaseKey) {
    tableReady = null;
    tableReadyDatabaseKey = databaseKey;
  }
  if (!tableReady) {
    tableReady = (async () => {
      const postgres = process.env.DB_TYPE === 'postgres' || /^postgres/.test(process.env.DATABASE_URL || '');
      if (postgres) {
        for (const table of ['backup_manifests', 'backup_access_audit', 'backup_run_receipts', 'backup_restore_receipts', 'backup_source_change_clock']) {
          if (!(await tableExists(table))) throw new Error(`BACKUP_SCHEMA_NOT_MIGRATED:${table}`);
        }
        return;
      }
      await dbRun(
        `CREATE TABLE IF NOT EXISTS backup_manifests (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL,
          scope TEXT NOT NULL,
          organization_id TEXT,
          reason TEXT,
          status TEXT NOT NULL,
          storage_key TEXT,
          provider TEXT,
          table_count INTEGER DEFAULT 0,
          row_count INTEGER DEFAULT 0,
          size_bytes INTEGER DEFAULT 0,
          manifest_json TEXT,
          checksum_sha256 TEXT,
          encrypted BOOLEAN NOT NULL DEFAULT false,
          error TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          expires_at TIMESTAMP
        )`,
        [],
        { fallback: false }
      );
      await dbRun(`ALTER TABLE backup_manifests ADD COLUMN IF NOT EXISTS checksum_sha256 TEXT`, [], {
        fallback: false,
      });
      await dbRun(
        `ALTER TABLE backup_manifests ADD COLUMN IF NOT EXISTS encrypted BOOLEAN NOT NULL DEFAULT false`,
        [],
        { fallback: false }
      );
      await dbRun(
        `CREATE TABLE IF NOT EXISTS backup_access_audit (
          id TEXT PRIMARY KEY,
          backup_id TEXT,
          actor_id TEXT NOT NULL,
          action TEXT NOT NULL,
          outcome TEXT NOT NULL,
          target_database TEXT,
          organization_id TEXT,
          details_json TEXT,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )`,
        [],
        { fallback: false }
      );
      await dbRun(
        `CREATE TABLE IF NOT EXISTS backup_run_receipts (
          id TEXT PRIMARY KEY, schedule_name TEXT NOT NULL, scheduled_for TIMESTAMP NOT NULL,
          lease_token TEXT NOT NULL, fence INTEGER NOT NULL DEFAULT 1, lease_expires_at TIMESTAMP NOT NULL,
          status TEXT NOT NULL, backup_id TEXT, source_watermark TIMESTAMP, source_observed_at TIMESTAMP,
          rpo_seconds INTEGER, rpo_threshold_seconds INTEGER NOT NULL DEFAULT 900,
          artifact_sha256 TEXT, plaintext_sha256 TEXT, source_sha256 TEXT, key_id TEXT NOT NULL, error_code TEXT,
          claimed_at TIMESTAMP NOT NULL, completed_at TIMESTAMP,
          UNIQUE(schedule_name, scheduled_for)
        )`,
        [],
        { fallback: false }
      );
      await dbRun(
        `CREATE TABLE IF NOT EXISTS backup_restore_receipts (
          id TEXT PRIMARY KEY, backup_id TEXT NOT NULL, actor_id TEXT NOT NULL,
          source_database TEXT NOT NULL, target_database TEXT NOT NULL, status TEXT NOT NULL,
          started_at TIMESTAMP NOT NULL, completed_at TIMESTAMP, rto_seconds INTEGER,
          rto_threshold_seconds INTEGER NOT NULL DEFAULT 3600, rto_met BOOLEAN,
          restored_rows INTEGER, source_sha256 TEXT, error_code TEXT
        )`,
        [],
        { fallback: false }
      );
      await dbRun(
        `CREATE TABLE IF NOT EXISTS backup_source_change_clock (
          id TEXT PRIMARY KEY, version INTEGER NOT NULL DEFAULT 0, changed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )`, [], { fallback: false }
      );
      await dbRun(
        `INSERT INTO backup_source_change_clock(id,version,changed_at) VALUES('canonical-owner-graph',0,CURRENT_TIMESTAMP)
         ON CONFLICT(id) DO NOTHING`, [], { fallback: false }
      );
    })().catch((err) => {
      // Reset so a later call can retry (e.g. transient DB unavailability).
      tableReady = null;
      throw err;
    });
  }
  return tableReady;
}

// ==========================================
// HELPERS
// ==========================================

function toIso(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function rowToRecord(row: any): BackupRecord {
  let tables: BackupTableEntry[] = [];
  try {
    const parsed = row.manifest_json ? JSON.parse(row.manifest_json) : null;
    if (parsed && Array.isArray(parsed.tables)) tables = parsed.tables;
  } catch {
    /* tolerate a corrupt manifest — metadata row is still authoritative */
  }
  const provider = row.provider ?? null;
  return {
    id: row.id,
    type: row.type,
    scope: row.scope,
    organizationId: row.organization_id ?? null,
    reason: row.reason ?? '',
    status: row.status,
    storageKey: row.storage_key ?? null,
    provider,
    tableCount: Number(row.table_count) || 0,
    rowCount: Number(row.row_count) || 0,
    sizeBytes: Number(row.size_bytes) || 0,
    createdAt: toIso(row.created_at) ?? '',
    expiresAt: toIso(row.expires_at),
    tables,
    error: row.error ?? null,
    checksumSha256: row.checksum_sha256 ?? null,
    encrypted: row.encrypted === true || row.encrypted === 1,
    hasS3: provider === 's3' || provider === 'r2',
    hasGCS: provider === 'gcs',
  };
}

function encryptionKey(): Buffer {
  const raw = process.env.BACKUP_ENCRYPTION_KEY?.trim();
  if (!raw) throw new Error('BACKUP_ENCRYPTION_KEY is required; unencrypted backups are forbidden');
  const key = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64');
  if (key.length !== 32) throw new Error('BACKUP_ENCRYPTION_KEY must decode to exactly 32 bytes');
  return key;
}

function encryptionKeyId(): string {
  const configured = process.env.BACKUP_ENCRYPTION_KEY_ID?.trim();
  return configured || `sha256:${sha256(encryptionKey()).slice(0, 16)}`;
}

function sha256(value: Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

function encryptPayload(plaintext: Buffer): { body: Buffer; checksumSha256: string } {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const checksumSha256 = sha256(ciphertext);
  const envelope: EncryptedBackupEnvelope = {
    format: 'consultify-logical-backup-v2',
    algorithm: 'aes-256-gcm',
    iv: iv.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64'),
    ciphertext: ciphertext.toString('base64'),
    checksumSha256,
  };
  return { body: Buffer.from(JSON.stringify(envelope), 'utf8'), checksumSha256 };
}

function decryptPayload(body: Buffer, expectedChecksum: string): {
  plaintext: Buffer;
  format: EncryptedBackupEnvelope['format'];
} {
  const envelope = JSON.parse(body.toString('utf8')) as EncryptedBackupEnvelope;
  if (
    !['consultify-logical-backup-v2', 'consultify-encrypted-json-v1'].includes(envelope.format) ||
    envelope.algorithm !== 'aes-256-gcm'
  ) {
    throw new Error('Unsupported or unencrypted backup format');
  }
  const ciphertext = Buffer.from(envelope.ciphertext, 'base64');
  const actual = sha256(ciphertext);
  if (actual !== envelope.checksumSha256 || actual !== expectedChecksum) {
    throw new Error('BACKUP_CHECKSUM_MISMATCH');
  }
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(envelope.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(envelope.authTag, 'base64'));
  return {
    plaintext: Buffer.concat([decipher.update(ciphertext), decipher.final()]),
    format: envelope.format,
  };
}

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}

async function writeAccessAudit(input: {
  backupId?: string;
  actorId: string;
  action: string;
  outcome: string;
  targetDatabase?: string;
  organizationId?: string | null;
  details?: Record<string, unknown>;
}): Promise<void> {
  await dbRun(
    `INSERT INTO backup_access_audit
      (id, backup_id, actor_id, action, outcome, target_database, organization_id, details_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [randomUUID(), input.backupId ?? null, input.actorId, input.action, input.outcome,
      input.targetDatabase ?? null, input.organizationId ?? null, JSON.stringify(input.details ?? {})],
    { fallback: false }
  );
}

// ==========================================
// SERVICE
// ==========================================

class BackupService {
  async reconcileUnboundBackup(backupId: string, error: string): Promise<void> {
    await ensureTable();
    const row = await dbGet<{ storage_key?: string; status?: string }>(
      `SELECT storage_key,status FROM backup_manifests WHERE id=?`, [backupId], { fallback: false }
    );
    if (!row) return;
    const objectCompensated = row.storage_key
      ? await getStorage().delete(row.storage_key).then(() => true).catch(() => false)
      : true;
    const updated = await dbRun(
      `UPDATE backup_manifests SET status='failed',error=? WHERE id=? AND status IN ('creating','completed')`,
      [`UNBOUND_RECEIPT:${error.slice(0, 120)};object_compensated=${objectCompensated}`, backupId],
      { fallback: false }
    );
    if (updated.changes !== 1) throw new Error('BACKUP_UNBOUND_RECONCILIATION_FAILED');
    await writeAccessAudit({
      backupId, actorId: 'backup-coordinator', action: 'BACKUP_RECONCILED_UNBOUND', outcome: 'FAILED',
      details: { error: error.slice(0, 120), objectCompensated },
    }).catch((auditError) => logger.error('[BackupService] unbound reconciliation audit failed', auditError));
  }

  async claimBackupRun(input: {
    scheduleName: string;
    scheduledFor: string;
  }): Promise<{ claimed: boolean; receiptId?: string; leaseToken?: string; fence?: number }> {
    await ensureTable();
    const receiptId = randomUUID();
    const leaseToken = randomUUID();
    const result = await dbGet<{ id: string; lease_token: string; fence: number }>(
      `INSERT INTO backup_run_receipts
        (id,schedule_name,scheduled_for,lease_token,fence,lease_expires_at,status,key_id,claimed_at)
       VALUES (?,?,?,?,1,?,'CLAIMED',?,CURRENT_TIMESTAMP)
       ON CONFLICT(schedule_name,scheduled_for) DO UPDATE SET
         lease_token=excluded.lease_token,
         fence=backup_run_receipts.fence+1,
         lease_expires_at=excluded.lease_expires_at,
         claimed_at=excluded.claimed_at,
         error_code='LEASE_RECLAIMED'
       WHERE backup_run_receipts.status='CLAIMED' AND backup_run_receipts.lease_expires_at<CURRENT_TIMESTAMP
       RETURNING id,lease_token,fence`,
      [receiptId, input.scheduleName, input.scheduledFor, leaseToken, new Date(Date.now() + 20 * 60_000).toISOString(), encryptionKeyId()],
      { fallback: false }
    );
    if (!result) return { claimed: false };
    return { claimed: true, receiptId: result.id, leaseToken: result.lease_token, fence: Number(result.fence) };
  }

  async finishBackupRun(input: {
    receiptId: string;
    leaseToken: string;
    fence: number;
    status: 'COMPLETED' | 'FAILED';
    backupId?: string;
    error?: string;
  }): Promise<{ status: 'COMPLETED' | 'FAILED' | 'MISSED'; rpoSeconds: number | null }> {
    await ensureTable();
    const manifest = input.backupId
      ? await dbGet<{ checksum_sha256?: string; manifest_json?: string }>(
          `SELECT checksum_sha256,manifest_json FROM backup_manifests WHERE id=?`,
          [input.backupId],
          { fallback: false }
        )
      : undefined;
    const sourceWatermark = (() => {
      try {
        return manifest?.manifest_json
          ? (JSON.parse(manifest.manifest_json) as BackupManifest).sourceWatermark || null
          : null;
      } catch {
        return null;
      }
    })();
    const manifestFacts = (() => {
      try {
        return manifest?.manifest_json ? JSON.parse(manifest.manifest_json) as BackupManifest : null;
      } catch {
        return null;
      }
    })();
    const sourceObservedAt = manifestFacts?.sourceObservedAt || null;
    const rpoSeconds = sourceWatermark && sourceObservedAt
      ? Math.max(0, Math.floor((Date.now() - new Date(sourceWatermark).getTime()) / 1000))
      : null;
    const effectiveStatus = input.status === 'COMPLETED' && rpoSeconds !== null && rpoSeconds > RPO_THRESHOLD_SECONDS
      ? 'MISSED'
      : input.status;
    const result = await dbRun(
      `UPDATE backup_run_receipts
          SET status=?, backup_id=?, source_watermark=?, source_observed_at=?, rpo_seconds=?,
              artifact_sha256=?, plaintext_sha256=?, source_sha256=?, error_code=?, completed_at=CURRENT_TIMESTAMP
        WHERE id=? AND lease_token=? AND fence=? AND status='CLAIMED'`,
      [
        effectiveStatus,
        input.backupId ?? null,
        sourceWatermark,
        sourceObservedAt,
        rpoSeconds,
        manifest?.checksum_sha256 ?? null,
        manifestFacts?.payloadSha256 ?? null,
        manifestFacts?.sourceSha256 ?? null,
        (effectiveStatus === 'MISSED' ? 'RPO_THRESHOLD_EXCEEDED' : input.error)?.slice(0, 200) ?? null,
        input.receiptId,
        input.leaseToken,
        input.fence,
      ],
      { fallback: false }
    );
    if (result.changes !== 1) throw new Error('BACKUP_RUN_FENCE_LOST');
    return { status: effectiveStatus, rpoSeconds };
  }

  async recordScheduledAttempt(input: {
    outcome: 'STARTED' | 'SUCCESS' | 'FAILED' | 'SKIPPED_OVERLAP';
    backupId?: string;
    error?: string;
    durationMs?: number;
  }): Promise<void> {
    await ensureTable();
    await writeAccessAudit({
      backupId: input.backupId,
      actorId: 'backup-cron',
      action: 'SCHEDULED_BACKUP',
      outcome: input.outcome,
      details: { error: input.error ?? null, durationMs: input.durationMs ?? null },
    });
  }

  /**
   * Create a logical JSON backup of the critical tables and persist it to the
   * storage seam + a `backup_manifests` manifest row.
   */
  async createBackup(
    type: BackupType = 'full',
    reason = 'manual',
    options: CreateBackupOptions = {}
  ): Promise<BackupRecord> {
    await ensureTable();
    if (type !== 'full') throw new Error('BACKUP_INCREMENTAL_NOT_IMPLEMENTED');

    const id = `backup-${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`;
    const organizationId = options.organizationId?.trim() || null;
    const scope: BackupScope = organizationId ? 'organization' : 'system';
    const createdAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + retentionDays() * 86_400_000).toISOString();

    const storage = getStorage();
    const provider = storage.provider;
    const storageKey = `backups/${organizationId || 'system'}/${id}.json`;

    const selectedTables = criticalTables(options.tables);
    const snapshot = await withPgTransaction(async (tx) => {
      await tx.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
      const sourceIdentity = await dbGet<{ database_name: string; version_num: string }>(
        `SELECT current_database() database_name, current_setting('server_version_num') version_num`,
        [],
        { fallback: false }
      );
      if (!sourceIdentity?.database_name) throw new Error('BACKUP_SOURCE_IDENTITY_UNAVAILABLE');
      if (!String(sourceIdentity.version_num).startsWith('16')) throw new Error('BACKUP_SOURCE_PG16_REQUIRED');
      const tables: BackupTableEntry[] = [];
      const data: Record<string, unknown[]> = {};
      let totalRows = 0;
      for (const table of selectedTables) {
        try {
          if (!(await tableExists(table))) {
            if (REQUIRED_OWNER_TABLES.has(table)) throw new Error(`BACKUP_REQUIRED_TABLE_MISSING:${table}`);
            tables.push({ name: table, rowCount: 0, skipped: true, reason: 'table_missing' });
            continue;
          }
          let rows: unknown[];
          if (scope === 'organization') {
            if (table === 'organizations') {
              rows = (await dbAll<{ row: Record<string, unknown> }>(
                `SELECT to_jsonb(owner_row) AS row FROM ${table} owner_row WHERE id = ? ORDER BY id`,
                [organizationId]
              )).map(({ row }) => row);
            } else if (table === 'users') {
              rows = (await dbAll<{ row: Record<string, unknown> }>(
                `SELECT to_jsonb(u) AS row FROM users u
                  WHERE EXISTS (
                    SELECT 1 FROM organization_members om
                     WHERE om.organization_id = ? AND om.user_id = u.id
                  ) ORDER BY u.id`,
                [organizationId]
              )).map(({ row }) => row);
            } else if (table === 'organization_members') {
              rows = (await dbAll<{ row: Record<string, unknown> }>(
                `SELECT to_jsonb(owner_row) AS row FROM organization_members owner_row WHERE organization_id = ? ORDER BY id`,
                [organizationId]
              )).map(({ row }) => row);
            } else if (await columnExists(table, 'organization_id')) {
              rows = (await dbAll<{ row: Record<string, unknown> }>(
                `SELECT to_jsonb(owner_row) AS row FROM ${table} owner_row WHERE organization_id = ? ORDER BY id`,
                [organizationId]
              )).map(({ row }) => row);
            } else {
              throw new Error(`BACKUP_OPTIONAL_TABLE_NOT_ORG_SCOPED:${table}`);
            }
          } else {
            rows = (await dbAll<{ row: Record<string, unknown> }>(
              `SELECT to_jsonb(owner_row) AS row FROM ${table} owner_row ORDER BY id`,
              []
            )).map(({ row }) => row);
          }
          data[table] = rows;
          const tableSha = sha256(Buffer.from(JSON.stringify(rows)));
          tables.push({ name: table, rowCount: rows.length, sha256: tableSha });
          totalRows += rows.length;
        } catch (err: any) {
          if (REQUIRED_OWNER_TABLES.has(table)) {
            throw new Error(`BACKUP_REQUIRED_TABLE_EXPORT_FAILED:${table}:${err?.message || err}`);
          }
          throw err;
        }
      }
      const sourceChange = await this.resolveSourceWatermark();
      return { data, tables, totalRows, ...sourceChange, sourceDatabase: sourceIdentity.database_name };
    });
    const { data, tables, totalRows, sourceWatermark, sourceChangeVersion, sourceDatabase } = snapshot;
    const includedTables = tables.filter((t) => !t.skipped);
    const sourceObservedAt = new Date().toISOString();
    const sourceSha256 = sha256(Buffer.from(JSON.stringify({
      schemaVersion: CANONICAL_SCHEMA_VERSION,
      organizationId,
      sourceWatermark,
      sourceChangeVersion,
      tables: includedTables.map(({ name, rowCount, sha256: tableSha }) => ({ name, rowCount, sha256: tableSha })),
    })));
    const manifest: BackupManifest = {
      id,
      type,
      scope,
      organizationId,
      reason,
      createdAt,
      format: 'consultify-logical-backup-v2',
      sourceWatermark,
      sourceObservedAt,
      sourceChangeVersion,
      sourceDatabase,
      sourceSha256,
      schemaVersion: CANONICAL_SCHEMA_VERSION,
      keyId: encryptionKeyId(),
      tables,
      tableCount: includedTables.length,
      totalRows,
      storageKey,
      provider,
      encrypted: true,
      encryptionAlgorithm: 'aes-256-gcm',
    };

    manifest.payloadSha256 = sha256(Buffer.from(JSON.stringify({ manifest, data })));

    const plaintext = Buffer.from(JSON.stringify({ manifest, data }), 'utf8');
    const { body, checksumSha256 } = encryptPayload(plaintext);
    const sizeBytes = body.byteLength;

    // The manifest is the durable reconciliation authority. A failure never
    // disappears into an orphan object or an ambiguous "completed" row.
    await dbRun(
      `INSERT INTO backup_manifests
        (id,type,scope,organization_id,reason,status,storage_key,provider,table_count,row_count,
         size_bytes,manifest_json,created_at,expires_at,checksum_sha256,encrypted)
       VALUES (?,?,?,?,?,'creating',?,?,?,?,?,?,?,?,?,true)`,
      [id,type,scope,organizationId,reason,storageKey,provider,includedTables.length,totalRows,
        sizeBytes,JSON.stringify(manifest),createdAt,expiresAt,checksumSha256],
      { fallback: false }
    );
    try {
      await storage.putObject({ key: storageKey, body, contentType: 'application/json' });
      await writeAccessAudit({
        backupId: id,
        actorId: options.actorId || 'system',
        action: 'BACKUP_CREATED',
        outcome: 'SUCCESS',
        organizationId,
        details: { checksumSha256, encrypted: true, tableCount: includedTables.length, totalRows },
      });
      const finalized = await dbRun(
        `UPDATE backup_manifests SET status='completed',error=NULL WHERE id=? AND status='creating'`,
        [id],
        { fallback: false }
      );
      if (finalized.changes !== 1) throw new Error('BACKUP_MANIFEST_FINALIZE_CONFLICT');
      logger.info(
        `[BackupService] backup ${id} created (scope=${scope}, tables=${includedTables.length}, rows=${totalRows}, ${sizeBytes}B, provider=${provider})`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const objectCompensated = await storage.delete(storageKey).then(() => true).catch(() => false);
      const reconciled = await dbRun(
        `UPDATE backup_manifests SET status='failed',error=? WHERE id=? AND status<>'completed'`,
        [`${message.slice(0, 160)};object_compensated=${objectCompensated}`, id],
        { fallback: false }
      ).catch(() => null);
      if (!reconciled || reconciled.changes !== 1) {
        throw new Error(`BACKUP_RECONCILIATION_PERSIST_FAILED:${message}`);
      }
      throw error;
    }

    return {
      id,
      type,
      scope,
      organizationId,
      reason,
      status: 'completed',
      storageKey,
      provider,
      tableCount: includedTables.length,
      rowCount: totalRows,
      sizeBytes,
      createdAt,
      expiresAt,
      tables,
      error: null,
      checksumSha256,
      encrypted: true,
      hasS3: provider === 's3' || provider === 'r2',
      hasGCS: provider === 'gcs',
    };
  }

  private async resolveSourceWatermark(): Promise<{ sourceWatermark: string; sourceChangeVersion: number }> {
    const row = await dbGet<{ changed_at?: string; version?: number }>(
      `SELECT changed_at,version FROM backup_source_change_clock WHERE id='canonical-owner-graph'`,
      [], { fallback: false }
    );
    if (!row?.changed_at || !Number.isFinite(Number(row.version))) throw new Error('BACKUP_SOURCE_WATERMARK_UNAVAILABLE');
    return { sourceWatermark: new Date(row.changed_at).toISOString(), sourceChangeVersion: Number(row.version) };
  }

  /** List backup records, newest first. Excludes expired unless asked. */
  async listBackups(opts: { includeExpired?: boolean } = {}): Promise<BackupRecord[]> {
    await ensureTable();
    const rows = await dbAll<any>(`SELECT * FROM backup_manifests ORDER BY created_at DESC`, [], {
      fallback: true,
    });
    const now = Date.now();
    return rows.map(rowToRecord).filter((r) => {
      if (opts.includeExpired) return true;
      if (!r.expiresAt) return true;
      return new Date(r.expiresAt).getTime() > now;
    });
  }

  /** System status/metrics consumed by the admin status endpoint + cron. */
  async getBackupStatus(): Promise<{
    total: number;
    lastBackup: string | null;
    nextBackup: string | null;
    failed: number;
    expired: number;
  }> {
    await ensureTable();
    const rows = await dbAll<any>(`SELECT * FROM backup_manifests`, [], { fallback: true });
    const runHealth = await dbGet<{ failed: number }>(
      `SELECT count(*) AS failed FROM backup_run_receipts WHERE status IN ('FAILED','MISSED')`,
      [],
      { fallback: false }
    );
    const now = Date.now();
    let lastBackup: number | null = null;
    let failed = 0;
    let expired = 0;
    for (const row of rows) {
      const created = toIso(row.created_at);
      if (created) {
        const t = new Date(created).getTime();
        if (lastBackup === null || t > lastBackup) lastBackup = t;
      }
      if (row.status === 'failed') failed++;
      const exp = toIso(row.expires_at);
      if (exp && new Date(exp).getTime() <= now) expired++;
    }
    return {
      total: rows.length,
      lastBackup: lastBackup === null ? null : new Date(lastBackup).toISOString(),
      nextBackup: nextQuarterHourUtc(),
      failed: failed + Number(runHealth?.failed || 0),
      expired,
    };
  }

  /** Delete a single backup (storage object + metadata row). Idempotent. */
  async deleteBackup(id: string): Promise<{ deleted: boolean }> {
    await ensureTable();
    const rows = await dbAll<any>(`SELECT * FROM backup_manifests WHERE id = ?`, [id], {
      fallback: true,
    });
    if (!rows.length) return { deleted: false };
    const rec = rows[0];
    if (rec.storage_key) {
      try {
        await getStorage().delete(rec.storage_key);
      } catch (err: any) {
        logger.warn(`[BackupService] object delete failed for ${id}: ${err?.message || err}`);
      }
    }
    await dbRun(`DELETE FROM backup_manifests WHERE id = ?`, [id], { fallback: false });
    return { deleted: true };
  }

  /** Delete backups whose expires_at is in the past. Returns count removed. */
  async runRetentionPolicy(): Promise<{ deleted: number }> {
    await ensureTable();
    const nowIso = new Date().toISOString();
    const expired = await dbAll<any>(
      `SELECT id, storage_key FROM backup_manifests WHERE expires_at IS NOT NULL AND expires_at <= ?`,
      [nowIso],
      { fallback: true }
    );
    let deleted = 0;
    for (const rec of expired) {
      if (rec.storage_key) {
        try {
          await getStorage().delete(rec.storage_key);
        } catch {
          /* best-effort object cleanup */
        }
      }
      const res = await dbRun(`DELETE FROM backup_manifests WHERE id = ?`, [rec.id], {
        fallback: false,
      });
      if (res?.success !== false) deleted++;
    }
    if (deleted) logger.info(`[BackupService] retention removed ${deleted} expired backup(s)`);
    return { deleted };
  }

  /** Read-only description of the supervised isolated restore. */
  async getRestoreInfo(backupId: string): Promise<{
    backupId: string;
    implemented: true;
    found: boolean;
    manifest: BackupManifest | null;
    message: string;
  }> {
    await ensureTable();
    const rows = await dbAll<any>(`SELECT * FROM backup_manifests WHERE id = ?`, [backupId], {
      fallback: true,
    });
    let manifest: BackupManifest | null = null;
    if (rows.length && rows[0].manifest_json) {
      try {
        manifest = JSON.parse(rows[0].manifest_json);
      } catch {
        manifest = null;
      }
    }
    return {
      backupId,
      implemented: true,
      found: rows.length > 0,
      manifest,
      message: 'Restore is available only to a supervised, explicitly isolated recovery/test PostgreSQL target.',
    };
  }

  /** Restore a verified encrypted backup into an explicitly isolated PostgreSQL database. */
  async restoreBackup(backupId: string, options: RestoreBackupOptions): Promise<RestoreResult> {
    await ensureTable();
    if (!options.actorId?.trim()) throw new Error('RESTORE_ACTOR_REQUIRED');

    const target = new URL(options.targetDatabaseUrl);
    const targetDatabase = target.pathname.replace(/^\//, '');
    const sourceDatabase = (() => {
      try { return new URL(process.env.DATABASE_URL || '').pathname.replace(/^\//, ''); } catch { return ''; }
    })();
    const localHost = ['127.0.0.1', 'localhost', '::1'].includes(target.hostname);
    const isolatedName = /^consultify_(?:adm_backup_restore|data_dr_restore)_[a-z0-9_]+$/.test(targetDatabase);
    if ((!localHost && process.env.BACKUP_ALLOW_REMOTE_RESTORE !== 'true') || !isolatedName || targetDatabase === sourceDatabase) {
      await writeAccessAudit({ backupId, actorId: options.actorId, action: 'RESTORE', outcome: 'ACCESS_DENIED', targetDatabase });
      throw new Error('RESTORE_TARGET_NOT_ISOLATED');
    }

    let liveSourceDatabase = '';
    const sourceIdentityClient = new PgClient({ connectionString: process.env.DATABASE_URL });
    await sourceIdentityClient.connect();
    try {
      const identity = await sourceIdentityClient.query<{ database_name: string; version_num: string }>(
        `SELECT current_database() database_name, current_setting('server_version_num') version_num`
      );
      if (identity.rows[0]?.database_name !== sourceDatabase) throw new Error('BACKUP_SOURCE_IDENTITY_MISMATCH');
      if (!String(identity.rows[0]?.version_num || '').startsWith('16')) throw new Error('BACKUP_SOURCE_PG16_REQUIRED');
      liveSourceDatabase = identity.rows[0].database_name;
    } finally {
      await sourceIdentityClient.end();
    }

    const rows = await dbAll<any>(`SELECT * FROM backup_manifests WHERE id = ?`, [backupId]);
    if (!rows.length) throw new Error('BACKUP_NOT_FOUND');
    const record = rowToRecord(rows[0]);
    if (!record.storageKey || !record.checksumSha256 || !record.encrypted) {
      throw new Error('BACKUP_NOT_RESTORABLE_ENCRYPTED_FORMAT');
    }

    const restoreReceiptId = randomUUID();
    const restoreStartedMs = Date.now();
    await dbRun(
      `INSERT INTO backup_restore_receipts
        (id,backup_id,actor_id,source_database,target_database,status,started_at)
       VALUES (?,?,?,?,?,'STARTED',CURRENT_TIMESTAMP)`,
      [restoreReceiptId, backupId, options.actorId, liveSourceDatabase, targetDatabase],
      { fallback: false }
    );
    try {
      await writeAccessAudit({ backupId, actorId: options.actorId, action: 'RESTORE_STARTED', outcome: 'STARTED', targetDatabase, organizationId: record.organizationId });
    } catch (error) {
      await dbRun(
        `UPDATE backup_restore_receipts SET status='FAILED',completed_at=CURRENT_TIMESTAMP,error_code=? WHERE id=? AND status='STARTED'`,
        ['RESTORE_START_AUDIT_FAILED', restoreReceiptId],
        { fallback: false }
      );
      throw error;
    }
    let client: PgClient | null = null;
    let targetCommitted = false;
    try {
      const object = await getStorage().getObject(record.storageKey);
      const decrypted = decryptPayload(await streamToBuffer(object.stream), record.checksumSha256);
      const payload = JSON.parse(decrypted.plaintext.toString('utf8')) as { manifest: BackupManifest; data: Record<string, Array<Record<string, unknown>>> };
      const restoreSourceSha = payload.manifest?.sourceSha256 || sha256(decrypted.plaintext);
      const compatibleFormat =
        (decrypted.format === 'consultify-logical-backup-v2' && payload.manifest.format === 'consultify-logical-backup-v2') ||
        (decrypted.format === 'consultify-encrypted-json-v1' && payload.manifest.format === 'consultify-json-v1');
      if (!compatibleFormat) throw new Error('BACKUP_FORMAT_MISMATCH');
      if (payload.manifest.id !== backupId || payload.manifest.organizationId !== record.organizationId) {
        throw new Error('BACKUP_MANIFEST_MISMATCH');
      }
      if (options.expectedOrganizationId && payload.manifest.organizationId !== options.expectedOrganizationId) {
        throw new Error('RESTORE_ORGANIZATION_MISMATCH');
      }
      if (decrypted.format === 'consultify-logical-backup-v2' && payload.manifest.sourceDatabase !== liveSourceDatabase) {
        throw new Error('BACKUP_SOURCE_DATABASE_MISMATCH');
      }

      if (!payload.manifest || !payload.data || !Array.isArray(payload.manifest.tables)) {
        throw new Error('BACKUP_PAYLOAD_INVALID');
      }
      const includedEntries = payload.manifest.tables.filter((entry) => !entry.skipped);
      if (decrypted.format === 'consultify-logical-backup-v2') {
        const names = includedEntries.map((entry) => entry.name);
        if (
          names.length !== CANONICAL_V2_TABLES.length ||
          names.some((name, index) => name !== CANONICAL_V2_TABLES[index]) ||
          payload.manifest.tableCount !== CANONICAL_V2_TABLES.length ||
          Object.keys(payload.data).some((name) => !CANONICAL_V2_TABLES.includes(name as any))
        ) {
          throw new Error('BACKUP_V2_TABLE_CONTRACT_MISMATCH');
        }
        if (
          payload.manifest.schemaVersion !== CANONICAL_SCHEMA_VERSION ||
          !payload.manifest.sourceDatabase ||
          !payload.manifest.sourceWatermark ||
          !payload.manifest.sourceObservedAt ||
          !Number.isFinite(Number(payload.manifest.sourceChangeVersion)) ||
          !payload.manifest.keyId ||
          !/^[0-9a-f]{64}$/.test(payload.manifest.sourceSha256 || '') ||
          !/^[0-9a-f]{64}$/.test(payload.manifest.payloadSha256 || '')
        ) {
          throw new Error('BACKUP_V2_MANIFEST_INTEGRITY_MISSING');
        }
      }
      let validatedTotalRows = 0;
      for (const entry of includedEntries) {
        if (!SAFE_IDENT.test(entry.name) || !Array.isArray(payload.data[entry.name])) {
          throw new Error('BACKUP_PAYLOAD_INVALID');
        }
        if (payload.data[entry.name].length !== entry.rowCount) {
          throw new Error(`BACKUP_TABLE_ROW_COUNT_MISMATCH:${entry.name}`);
        }
        const tableSha = sha256(Buffer.from(JSON.stringify(payload.data[entry.name])));
        if (decrypted.format === 'consultify-logical-backup-v2' && entry.sha256 !== tableSha) {
          throw new Error(`BACKUP_TABLE_HASH_MISMATCH:${entry.name}`);
        }
        validatedTotalRows += entry.rowCount;
      }
      if (validatedTotalRows !== payload.manifest.totalRows) {
        throw new Error('BACKUP_TOTAL_ROW_COUNT_MISMATCH');
      }
      if (decrypted.format === 'consultify-logical-backup-v2') {
        const { payloadSha256, ...manifestWithoutPayloadSha } = payload.manifest;
        const actualPayloadSha = sha256(Buffer.from(JSON.stringify({ manifest: manifestWithoutPayloadSha, data: payload.data })));
        if (actualPayloadSha !== payloadSha256) throw new Error('BACKUP_PLAINTEXT_HASH_MISMATCH');
        const sourceSha = sha256(Buffer.from(JSON.stringify({
          schemaVersion: payload.manifest.schemaVersion,
          organizationId: payload.manifest.organizationId,
          sourceWatermark: payload.manifest.sourceWatermark,
          sourceChangeVersion: payload.manifest.sourceChangeVersion,
          tables: includedEntries.map(({ name, rowCount, sha256: tableSha }) => ({ name, rowCount, sha256: tableSha })),
        })));
        if (sourceSha !== payload.manifest.sourceSha256) throw new Error('BACKUP_SOURCE_HASH_MISMATCH');
      }

      // Validate every row before opening the transaction: a tenant backup may
      // never contain a row belonging to another organization.
      if (payload.manifest.scope === 'organization' && payload.manifest.organizationId) {
        const orgId = payload.manifest.organizationId;
        const organizations = payload.data.organizations || [];
        const users = payload.data.users || [];
        const memberships = payload.data.organization_members || [];
        if (organizations.length !== 1 || String(organizations[0]?.id || '') !== orgId) {
          throw new Error('BACKUP_CROSS_TENANT_ORGANIZATION');
        }
        const memberUserIds = new Set<string>();
        for (const membership of memberships) {
          if (String(membership.organization_id || '') !== orgId || !membership.user_id) {
            throw new Error('BACKUP_CROSS_TENANT_MEMBERSHIP');
          }
          memberUserIds.add(String(membership.user_id));
        }
        if (decrypted.format === 'consultify-logical-backup-v2') {
          if (users.some((user) => !memberUserIds.has(String(user.id || '')))) {
            throw new Error('BACKUP_USER_WITHOUT_MEMBERSHIP');
          }
          if (memberUserIds.size !== users.length) throw new Error('BACKUP_MEMBERSHIP_USER_MISMATCH');
        } else if (users.some((user) => String(user.organization_id || '') !== orgId)) {
          throw new Error('BACKUP_CROSS_TENANT_USER');
        }
        for (const [table, tableRows] of Object.entries(payload.data)) {
          if (CANONICAL_V2_TABLE_SET.has(table)) continue;
          if (tableRows.some((row) => String(row.organization_id || '') !== orgId)) {
            throw new Error('BACKUP_CROSS_TENANT_ROW');
          }
        }
      }

      client = new PgClient({ connectionString: options.targetDatabaseUrl });
      client.on('error', (error) => logger.error('[BackupService] restore target client error:', error));
      await client.connect();
      const targetIdentity = await client.query<{ database_name: string; version_num: string }>(
        `SELECT current_database() database_name, current_setting('server_version_num') version_num`
      );
      if (targetIdentity.rows[0]?.database_name !== targetDatabase) throw new Error('RESTORE_TARGET_IDENTITY_MISMATCH');
      if (!String(targetIdentity.rows[0]?.version_num || '').startsWith('16')) throw new Error('RESTORE_TARGET_PG16_REQUIRED');
      await client.query('BEGIN');
      for (const ownerTable of ['organizations', 'users', 'organization_members']) {
        const existing = await client.query<{ n: number }>(`SELECT count(*)::int n FROM "${ownerTable}"`);
        if ((existing.rows[0]?.n || 0) !== 0) throw new Error(`RESTORE_TARGET_NOT_PRISTINE:${ownerTable}`);
      }
      let restoredTables = 0;
      let restoredRows = 0;
      for (const tableEntry of payload.manifest.tables.filter((entry) => !entry.skipped)) {
        const table = tableEntry.name;
        if (!SAFE_IDENT.test(table)) throw new Error('BACKUP_UNSAFE_TABLE');
        const tableRows = payload.data[table] || [];
        const exists = await client.query(`SELECT to_regclass($1) AS name`, [`public.${table}`]);
        if (!exists.rows[0]?.name) throw new Error(`RESTORE_TARGET_TABLE_MISSING:${table}`);
        const columnsResult = await client.query<{ column_name: string }>(
          `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1`,
          [table]
        );
        const allowedColumns = new Set(columnsResult.rows.map((r) => r.column_name));
        for (const row of tableRows) {
          const columns = Object.keys(row).filter((column) => allowedColumns.has(column) && SAFE_IDENT.test(column));
          if (!columns.length) continue;
          const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ');
          const quoted = columns.map((column) => `"${column}"`).join(', ');
          const inserted = await client.query(
            `INSERT INTO "${table}" (${quoted}) VALUES (${placeholders})`,
            columns.map((column) => row[column])
          );
          if (inserted.rowCount !== 1) throw new Error('RESTORE_ROW_COUNT_MISMATCH');
          restoredRows += inserted.rowCount;
        }
        restoredTables += 1;
      }
      for (const ownerTable of ['organizations', 'users', 'organization_members']) {
        const expected = payload.data[ownerTable];
        if (!expected) continue;
        const ids = expected.map((row) => String(row.id || ''));
        if (ids.some((id) => !id)) throw new Error(`BACKUP_OWNER_ID_MISSING:${ownerTable}`);
        const actual = await client.query<{ row: Record<string, unknown> }>(
          `SELECT to_jsonb(owner_row) AS row FROM "${ownerTable}" owner_row WHERE id = ANY($1::text[]) ORDER BY id`,
          [ids]
        );
        if (actual.rows.length !== expected.length) throw new Error(`RESTORE_OWNER_COUNT_MISMATCH:${ownerTable}`);
        const projected = actual.rows.map(({ row }) => {
          const source = expected.find((candidate) => String(candidate.id) === String(row.id))!;
          return Object.fromEntries(Object.keys(source).sort().map((key) => [key, row[key]]));
        });
        const normalizedExpected = expected
          .map((row) => Object.fromEntries(Object.keys(row).sort().map((key) => [key, row[key]])))
          .sort((a, b) => String(a.id).localeCompare(String(b.id)));
        if (sha256(Buffer.from(JSON.stringify(projected))) !== sha256(Buffer.from(JSON.stringify(normalizedExpected)))) {
          throw new Error(`RESTORE_OWNER_HASH_MISMATCH:${ownerTable}`);
        }
      }
      await client.query('COMMIT');
      targetCommitted = true;
      const result: RestoreResult = { backupId, targetDatabase, restoredTables, restoredRows, checksumVerified: true, organizationId: record.organizationId };
      const cold = new PgClient({ connectionString: options.targetDatabaseUrl });
      await cold.connect();
      try {
        for (const ownerTable of CANONICAL_V2_TABLES) {
          const expected = payload.data[ownerTable] || [];
          const ids = expected.map((row) => String(row.id || ''));
          const actual = ids.length
            ? await cold.query<{ row: Record<string, unknown> }>(`SELECT to_jsonb(owner_row) AS row FROM "${ownerTable}" owner_row WHERE id=ANY($1::text[]) ORDER BY id`, [ids])
            : { rows: [] };
          if (actual.rows.length !== expected.length) throw new Error(`RESTORE_COLD_COUNT_MISMATCH:${ownerTable}`);
          const projected = actual.rows.map(({ row }) => {
            const source = expected.find((candidate) => String(candidate.id) === String(row.id))!;
            return Object.fromEntries(Object.keys(source).sort().map((key) => [key, row[key]]));
          });
          const normalizedExpected = expected
            .map((row) => Object.fromEntries(Object.keys(row).sort().map((key) => [key, row[key]])))
            .sort((a, b) => String(a.id).localeCompare(String(b.id)));
          if (sha256(Buffer.from(JSON.stringify(projected))) !== sha256(Buffer.from(JSON.stringify(normalizedExpected)))) {
            throw new Error(`RESTORE_COLD_HASH_MISMATCH:${ownerTable}`);
          }
        }
      } finally {
        await cold.end();
      }
      const rtoSeconds = Math.max(0, Math.floor((Date.now() - restoreStartedMs) / 1000));
      const completedReceipt = await dbRun(
        `UPDATE backup_restore_receipts
            SET status='COMPLETED',completed_at=CURRENT_TIMESTAMP,rto_seconds=?,rto_met=?,restored_rows=?,source_sha256=?
          WHERE id=? AND status='STARTED'`,
        [rtoSeconds, rtoSeconds <= 3600, restoredRows, restoreSourceSha, restoreReceiptId],
        { fallback: false }
      );
      if (completedReceipt.changes !== 1) throw new Error('RESTORE_RECEIPT_FINALIZE_CONFLICT');
      await writeAccessAudit({ backupId, actorId: options.actorId, action: 'RESTORE_COMPLETED', outcome: 'SUCCESS', targetDatabase, organizationId: record.organizationId, details: { ...result, rtoSeconds } })
        .catch((error) => logger.error('[BackupService] restore committed but completion audit failed', error));
      return result;
    } catch (error) {
      if (client && !targetCommitted) await client.query('ROLLBACK').catch(() => undefined);
      const message = error instanceof Error ? error.message : String(error);
      await dbRun(
        `UPDATE backup_restore_receipts SET status=?,completed_at=CURRENT_TIMESTAMP,error_code=? WHERE id=? AND status='STARTED'`,
        [targetCommitted ? 'COMMITTED_UNVERIFIED' : 'FAILED', message.slice(0, 200), restoreReceiptId],
        { fallback: false }
      ).catch((receiptError) => logger.error('[BackupService] restore failure receipt could not be finalized', receiptError));
      await writeAccessAudit({ backupId, actorId: options.actorId, action: 'RESTORE_FAILED', outcome: 'FAILED', targetDatabase, organizationId: record.organizationId, details: { message } })
        .catch((auditError) => logger.error('[BackupService] restore failure audit could not be persisted', auditError));
      throw error;
    } finally {
      if (client) await client.end().catch(() => undefined);
    }
  }
}

/** Next 15-minute boundary (mirrors cron/BackupCron.ts schedule). */
function nextQuarterHourUtc(): string {
  const now = new Date();
  const next = new Date(now);
  next.setUTCSeconds(0, 0);
  next.setUTCMinutes(Math.floor(now.getUTCMinutes() / 15) * 15 + 15);
  return next.toISOString();
}

const service = new BackupService();

export { BackupService };
export default service;
