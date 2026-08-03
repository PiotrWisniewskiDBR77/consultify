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

import { randomUUID } from 'crypto';

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
  /** Cloud-presence flags read by backup.routes.ts. */
  hasS3: boolean;
  hasGCS: boolean;
}

export interface CreateBackupOptions {
  /** When set, produces an ORG-SCOPED backup (only that org's rows). */
  organizationId?: string;
  /** Override the critical-tables list for this backup. */
  tables?: string[];
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
          error TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          expires_at TIMESTAMP
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
    hasS3: provider === 's3' || provider === 'r2',
    hasGCS: provider === 'gcs',
  };
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
    };

    const body = Buffer.from(JSON.stringify({ manifest, data }), 'utf8');
    const sizeBytes = body.byteLength;

    // Persist the object first; only record a row once the bytes are durable.
    await storage.putObject({ key: storageKey, body, contentType: 'application/json' });

    await dbRun(
      `INSERT INTO backup_manifests
        (id, type, scope, organization_id, reason, status, storage_key, provider,
         table_count, row_count, size_bytes, manifest_json, created_at, expires_at)
       VALUES (?, ?, ?, ?, ?, 'completed', ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      ],
      { fallback: false }
    );

    logger.info(
      `[BackupService] backup ${id} created (scope=${scope}, tables=${includedTables.length}, rows=${totalRows}, ${sizeBytes}B, provider=${provider})`
    );

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
      // Cron runs daily at 03:00 UTC — surface the next occurrence for the UI.
      nextBackup: nextDailyBackupUtc(),
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
    implemented: false;
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
      implemented: false,
      found: rows.length > 0,
      manifest,
      message:
        'Restore is not yet implemented (v2). This backup is a logical JSON export; ' +
        'restoring it into a live database requires a supervised, schema-aware import that ' +
        'is out of scope for v1. Use the export for manual/offline recovery.',
    };
  }

  /**
   * Not implemented in v1 — throws a typed error so the route can answer 501
   * (honest) instead of the historic 503 crash.
   */
  async restoreBackup(backupId: string): Promise<never> {
    await this.getRestoreInfo(backupId);
    throw new BackupNotImplementedError(
      `Restore of backup "${backupId}" is not implemented (v2). See getRestoreInfo() for details.`
    );
  }
}

/** Next 03:00 UTC occurrence (mirrors cron/BackupCron.ts schedule). */
function nextDailyBackupUtc(): string {
  const now = new Date();
  const next = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 3, 0, 0, 0)
  );
  if (next.getTime() <= now.getTime()) next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString();
}

const service = new BackupService();

export { BackupService };
export default service;
