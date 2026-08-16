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
 * Restore is intentionally **v2** — `restoreBackup()` throws a typed
 * NotImplemented error and the route surfaces an honest 501 (never a 503 crash).
 * A read-only `getRestoreInfo()` describes what a restore *would* do.
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from 'crypto';
import type { Readable } from 'stream';

import { Client as PgClient } from 'pg';

import { all as dbAll, columnExists, run as dbRun, tableExists } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';
import { getStorage } from './storage/index.js';

// ==========================================
// CONFIG
// ==========================================

/**
 * Default critical tables. Verified to exist on the demo/parity schema
 * (1226 tables total — this is the curated, high-value core). Non-existent
 * tables are skipped at runtime, so this list is safe to extend.
 * Override with env `BACKUP_TABLES` (comma-separated).
 */
const DEFAULT_CRITICAL_TABLES = [
  'organizations',
  'users',
  'organization_members',
  'projects',
  'initiatives',
  'initiative_kpis',
  'tasks',
  'assessments',
  'tool_sessions',
  'deliverables',
  'meetings',
  'ideas',
  'decisions',
  'notebooks',
  'activity_logs',
  'audit_logs',
];

/** Backups older than this are eligible for retention cleanup. */
function retentionDays(): number {
  const raw = Number.parseInt(process.env.BACKUP_RETENTION_DAYS || '30', 10);
  return Number.isFinite(raw) && raw > 0 ? raw : 30;
}

/** Only simple, allow-list-shaped identifiers may be interpolated into SQL. */
const SAFE_IDENT = /^[a-z_][a-z0-9_]*$/;

function criticalTables(explicit?: string[]): string[] {
  if (explicit && explicit.length) return explicit.filter((t) => SAFE_IDENT.test(t));
  const fromEnv = (process.env.BACKUP_TABLES || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const list = fromEnv.length ? fromEnv : DEFAULT_CRITICAL_TABLES;
  return list.filter((t) => SAFE_IDENT.test(t));
}

// ==========================================
// TYPES
// ==========================================

export type BackupType = 'full' | 'incremental';
export type BackupScope = 'system' | 'organization';

export interface BackupTableEntry {
  name: string;
  rowCount: number;
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
  format: 'consultify-json-v1';
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
  format: 'consultify-encrypted-json-v1';
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

async function ensureTable(): Promise<void> {
  if (!tableReady) {
    tableReady = (async () => {
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

function sha256(value: Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

function encryptPayload(plaintext: Buffer): { body: Buffer; checksumSha256: string } {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const checksumSha256 = sha256(ciphertext);
  const envelope: EncryptedBackupEnvelope = {
    format: 'consultify-encrypted-json-v1',
    algorithm: 'aes-256-gcm',
    iv: iv.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64'),
    ciphertext: ciphertext.toString('base64'),
    checksumSha256,
  };
  return { body: Buffer.from(JSON.stringify(envelope), 'utf8'), checksumSha256 };
}

function decryptPayload(body: Buffer, expectedChecksum: string): Buffer {
  const envelope = JSON.parse(body.toString('utf8')) as EncryptedBackupEnvelope;
  if (envelope.format !== 'consultify-encrypted-json-v1' || envelope.algorithm !== 'aes-256-gcm') {
    throw new Error('Unsupported or unencrypted backup format');
  }
  const ciphertext = Buffer.from(envelope.ciphertext, 'base64');
  const actual = sha256(ciphertext);
  if (actual !== envelope.checksumSha256 || actual !== expectedChecksum) {
    throw new Error('BACKUP_CHECKSUM_MISMATCH');
  }
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(envelope.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(envelope.authTag, 'base64'));
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
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

    const id = `backup-${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`;
    const organizationId = options.organizationId?.trim() || null;
    const scope: BackupScope = organizationId ? 'organization' : 'system';
    const createdAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + retentionDays() * 86_400_000).toISOString();

    const storage = getStorage();
    const provider = storage.provider;
    const storageKey = `backups/${organizationId || 'system'}/${id}.json`;

    const tables: BackupTableEntry[] = [];
    const data: Record<string, unknown[]> = {};
    let totalRows = 0;

    for (const table of criticalTables(options.tables)) {
      try {
        if (!(await tableExists(table))) {
          tables.push({ name: table, rowCount: 0, skipped: true, reason: 'table_missing' });
          continue;
        }

        let rows: unknown[];
        if (scope === 'organization') {
          // `organizations` is keyed by `id`; everything else by `organization_id`.
          if (table === 'organizations') {
            rows = await dbAll(`SELECT * FROM ${table} WHERE id = ?`, [organizationId]);
          } else if (await columnExists(table, 'organization_id')) {
            rows = await dbAll(`SELECT * FROM ${table} WHERE organization_id = ?`, [
              organizationId,
            ]);
          } else {
            // No org boundary → skip in org scope to avoid cross-tenant leakage.
            tables.push({ name: table, rowCount: 0, skipped: true, reason: 'not_org_scoped' });
            continue;
          }
        } else {
          rows = await dbAll(`SELECT * FROM ${table}`, []);
        }

        data[table] = rows;
        tables.push({ name: table, rowCount: rows.length });
        totalRows += rows.length;
      } catch (err: any) {
        logger.warn(`[BackupService] table "${table}" export failed: ${err?.message || err}`);
        tables.push({ name: table, rowCount: 0, skipped: true, reason: 'export_error' });
      }
    }

    const includedTables = tables.filter((t) => !t.skipped);

    const manifest: BackupManifest = {
      id,
      type,
      scope,
      organizationId,
      reason,
      createdAt,
      format: 'consultify-json-v1',
      tables,
      tableCount: includedTables.length,
      totalRows,
      storageKey,
      provider,
      encrypted: true,
      encryptionAlgorithm: 'aes-256-gcm',
    };

    const plaintext = Buffer.from(JSON.stringify({ manifest, data }), 'utf8');
    const { body, checksumSha256 } = encryptPayload(plaintext);
    const sizeBytes = body.byteLength;

    // Persist the object first; only record a row once the bytes are durable.
    await storage.putObject({ key: storageKey, body, contentType: 'application/json' });

    await dbRun(
      `INSERT INTO backup_manifests
        (id, type, scope, organization_id, reason, status, storage_key, provider,
         table_count, row_count, size_bytes, manifest_json, created_at, expires_at,
         checksum_sha256, encrypted)
       VALUES (?, ?, ?, ?, ?, 'completed', ?, ?, ?, ?, ?, ?, ?, ?, ?, true)`,
      [
        id,
        type,
        scope,
        organizationId,
        reason,
        storageKey,
        provider,
        includedTables.length,
        totalRows,
        sizeBytes,
        JSON.stringify(manifest),
        createdAt,
        expiresAt,
        checksumSha256,
      ],
      { fallback: false }
    );

    logger.info(
      `[BackupService] backup ${id} created (scope=${scope}, tables=${includedTables.length}, rows=${totalRows}, ${sizeBytes}B, provider=${provider})`
    );
    await writeAccessAudit({
      backupId: id,
      actorId: options.actorId || 'system',
      action: 'BACKUP_CREATED',
      outcome: 'SUCCESS',
      organizationId,
      details: { checksumSha256, encrypted: true, tableCount: includedTables.length, totalRows },
    });

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
      failed,
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

  /**
   * Read-only description of a restore. Restore execution itself is v2.
   */
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
    const isolatedName = /(restore|recovery|test)/i.test(targetDatabase);
    if ((!localHost && process.env.BACKUP_ALLOW_REMOTE_RESTORE !== 'true') || !isolatedName || targetDatabase === sourceDatabase) {
      await writeAccessAudit({ backupId, actorId: options.actorId, action: 'RESTORE', outcome: 'ACCESS_DENIED', targetDatabase });
      throw new Error('RESTORE_TARGET_NOT_ISOLATED');
    }

    const rows = await dbAll<any>(`SELECT * FROM backup_manifests WHERE id = ?`, [backupId]);
    if (!rows.length) throw new Error('BACKUP_NOT_FOUND');
    const record = rowToRecord(rows[0]);
    if (!record.storageKey || !record.checksumSha256 || !record.encrypted) {
      throw new Error('BACKUP_NOT_RESTORABLE_ENCRYPTED_FORMAT');
    }

    await writeAccessAudit({ backupId, actorId: options.actorId, action: 'RESTORE_STARTED', outcome: 'STARTED', targetDatabase, organizationId: record.organizationId });
    let client: PgClient | null = null;
    try {
      const object = await getStorage().getObject(record.storageKey);
      const plaintext = decryptPayload(await streamToBuffer(object.stream), record.checksumSha256);
      const payload = JSON.parse(plaintext.toString('utf8')) as { manifest: BackupManifest; data: Record<string, Array<Record<string, unknown>>> };
      if (payload.manifest.id !== backupId || payload.manifest.organizationId !== record.organizationId) {
        throw new Error('BACKUP_MANIFEST_MISMATCH');
      }
      if (options.expectedOrganizationId && payload.manifest.organizationId !== options.expectedOrganizationId) {
        throw new Error('RESTORE_ORGANIZATION_MISMATCH');
      }

      // Validate every row before opening the transaction: a tenant backup may
      // never contain a row belonging to another organization.
      if (payload.manifest.scope === 'organization' && payload.manifest.organizationId) {
        const orgId = payload.manifest.organizationId;
        for (const [table, tableRows] of Object.entries(payload.data)) {
          for (const row of tableRows) {
            const rowOrg = table === 'organizations' ? row.id : row.organization_id;
            if (String(rowOrg ?? '') !== orgId) throw new Error('BACKUP_CROSS_TENANT_ROW');
          }
        }
      }

      client = new PgClient({ connectionString: options.targetDatabaseUrl });
      client.on('error', (error) => logger.error('[BackupService] restore target client error:', error));
      await client.connect();
      await client.query('BEGIN');
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
          await client.query(
            `INSERT INTO "${table}" (${quoted}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
            columns.map((column) => row[column])
          );
          restoredRows += 1;
        }
        restoredTables += 1;
      }
      await client.query('COMMIT');
      const result: RestoreResult = { backupId, targetDatabase, restoredTables, restoredRows, checksumVerified: true, organizationId: record.organizationId };
      await writeAccessAudit({ backupId, actorId: options.actorId, action: 'RESTORE_COMPLETED', outcome: 'SUCCESS', targetDatabase, organizationId: record.organizationId, details: { ...result } });
      return result;
    } catch (error) {
      if (client) await client.query('ROLLBACK').catch(() => undefined);
      const message = error instanceof Error ? error.message : String(error);
      await writeAccessAudit({ backupId, actorId: options.actorId, action: 'RESTORE_FAILED', outcome: 'FAILED', targetDatabase, organizationId: record.organizationId, details: { message } });
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
