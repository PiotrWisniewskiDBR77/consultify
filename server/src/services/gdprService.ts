import { v4 as uuidv4 } from 'uuid';

import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

export type ExportRequestStatus =
  | 'pending'
  | 'processing'
  | 'ready'
  | 'completed'
  | 'failed'
  | 'expired'
  | 'scheduled'
  | 'cancelled';

export type ExportRequestResponse = {
  id: string;
  status: ExportRequestStatus;
  requestedAt: string;
  expiresAt?: string;
  downloadUrl?: string;
};

export type DeletionRequestResponse = {
  id: string;
  status: ExportRequestStatus;
  requestedAt: string;
  scheduledFor?: string;
};

function pickFirstDefined<T>(...values: Array<T | undefined | null>): T | undefined {
  for (const v of values) {
    if (v !== undefined && v !== null) return v as T;
  }
  return undefined;
}

const columnsCache = new Map<string, Set<string>>();

async function getTableColumns(tableName: string): Promise<Set<string>> {
  const cached = columnsCache.get(tableName);
  if (cached) return cached;

  // SQLite
  const pragma = await dbAll<{ name?: string }>(`PRAGMA table_info(${tableName})`, []);
  const pragmaCols = pragma.map((r) => r.name).filter((v): v is string => typeof v === 'string');
  if (pragmaCols.length > 0) {
    const set = new Set(pragmaCols);
    columnsCache.set(tableName, set);
    return set;
  }

  // Postgres
  const info = await dbAll<{ column_name?: string }>(
    `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = ?`,
    [tableName]
  );
  const pgCols = info.map((r) => r.column_name).filter((v): v is string => typeof v === 'string');

  const set = new Set(pgCols);
  columnsCache.set(tableName, set);
  return set;
}

function buildInsert(
  tableName: string,
  columns: Set<string>,
  values: Record<string, unknown>
): { sql: string; params: unknown[] } {
  const cols: string[] = [];
  const params: unknown[] = [];

  for (const [key, value] of Object.entries(values)) {
    if (!columns.has(key)) continue;
    cols.push(key);
    params.push(value);
  }

  if (cols.length === 0) {
    throw new Error(`[GDPR] Cannot build INSERT for ${tableName}: no matching columns`);
  }

  const placeholders = cols.map(() => '?').join(', ');
  return {
    sql: `INSERT INTO ${tableName} (${cols.join(', ')}) VALUES (${placeholders})`,
    params,
  };
}

async function getOneOf<T>(
  statements: Array<{ sql: string; params: unknown[] }>
): Promise<T | null> {
  for (const stmt of statements) {
    try {
      const row = await dbGet<T>(stmt.sql, stmt.params, { fallback: false });
      return row;
    } catch {
      // try next variant
    }
  }
  return null;
}

function buildSelect(tableName: string, columns: Set<string>, wanted: string[]): string {
  const cols = wanted.filter((c) => columns.has(c));
  if (cols.length === 0) throw new Error(`[GDPR] Cannot build SELECT for ${tableName}`);
  return cols.join(', ');
}

export async function createDataExportRequest(input: {
  userId: string;
  organizationId?: string;
  format?: string;
  include?: unknown;
}): Promise<ExportRequestResponse> {
  const requestId = uuidv4();
  const requestedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const downloadUrl = `/api/gdpr/download-export/${requestId}`;

  const columns = await getTableColumns('data_export_requests');
  if (columns.size === 0) {
    throw new Error('[GDPR] data_export_requests table missing (run migrations)');
  }

  const includeJson = input.include ? JSON.stringify(input.include) : null;
  const orgId = input.organizationId;

  if (columns.has('organization_id') && !orgId) {
    throw new Error('[GDPR] organizationId is required for org-scoped export requests');
  }

  const values: Record<string, unknown> = {
    id: requestId,
    organization_id: orgId,
    user_id: input.userId,
    export_type: 'gdpr',
    format: (input.format || 'json').toLowerCase(),
    status: 'pending',
    requested_at: 'CURRENT_TIMESTAMP',
    created_at: 'CURRENT_TIMESTAMP',
    expires_at: expiresAt,
    file_expires_at: expiresAt,
    download_url: downloadUrl,
    file_url: downloadUrl,
    include_data: includeJson,
    include_data_types: includeJson,
  };

  // Use SQL functions for timestamps when columns exist (SQLite + Postgres compatible).
  // We can't bind CURRENT_TIMESTAMP as a param; replace with raw SQL if present.
  const insertValues: Record<string, unknown> = { ...values };
  if (columns.has('requested_at')) delete insertValues.requested_at;
  if (columns.has('created_at')) delete insertValues.created_at;

  const built = buildInsert('data_export_requests', columns, insertValues);
  const r = await dbRun(built.sql, built.params, { fallback: false });
  if (!r.success) throw new Error(r.error || 'Failed to create export request');

  // Best-effort timestamp columns
  if (columns.has('requested_at')) {
    await dbRun(`UPDATE data_export_requests SET requested_at = CURRENT_TIMESTAMP WHERE id = ?`, [
      requestId,
    ]);
  }
  if (columns.has('created_at')) {
    await dbRun(`UPDATE data_export_requests SET created_at = CURRENT_TIMESTAMP WHERE id = ?`, [
      requestId,
    ]);
  }

  return { id: requestId, status: 'pending', requestedAt, expiresAt, downloadUrl };
}

export async function createAccountDeletionRequest(input: {
  userId: string;
  reason?: string;
}): Promise<DeletionRequestResponse> {
  const requestId = uuidv4();
  const requestedAt = new Date().toISOString();
  const scheduledFor = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const columns = await getTableColumns('account_deletion_requests');
  if (columns.size === 0) {
    throw new Error('[GDPR] account_deletion_requests table missing (run migrations)');
  }

  const values: Record<string, unknown> = {
    id: requestId,
    user_id: input.userId,
    status: 'scheduled',
    requested_at: 'CURRENT_TIMESTAMP',
    scheduled_for: scheduledFor,
    reason: input.reason || null,
    notes: input.reason || null,
  };

  const insertValues: Record<string, unknown> = { ...values };
  if (columns.has('requested_at')) delete insertValues.requested_at;

  const built = buildInsert('account_deletion_requests', columns, insertValues);
  const r = await dbRun(built.sql, built.params, { fallback: false });
  if (!r.success) throw new Error(r.error || 'Failed to create deletion request');

  if (columns.has('requested_at')) {
    await dbRun(
      `UPDATE account_deletion_requests SET requested_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [requestId]
    );
  }

  return { id: requestId, status: 'scheduled', requestedAt, scheduledFor };
}

export async function getLatestDataExportRequest(
  userId: string
): Promise<ExportRequestResponse | null> {
  const columns = await getTableColumns('data_export_requests');
  if (columns.size === 0) return null;

  const select = buildSelect('data_export_requests', columns, [
    'id',
    'status',
    'requested_at',
    'created_at',
    'expires_at',
    'file_expires_at',
    'download_url',
    'file_url',
  ]);

  const orderBy = columns.has('requested_at')
    ? 'requested_at'
    : columns.has('created_at')
      ? 'created_at'
      : '';

  const sql = `SELECT ${select} FROM data_export_requests WHERE user_id = ?${
    orderBy ? ` ORDER BY ${orderBy} DESC` : ''
  } LIMIT 1`;

  const row = await dbGet<any>(sql, [userId]);

  if (!row) return null;
  return {
    id: String(row.id),
    status: String(row.status || 'pending') as ExportRequestStatus,
    requestedAt: String(
      pickFirstDefined(row.requestedAt, row.requested_at, row.created_at) ||
        new Date().toISOString()
    ),
    expiresAt: pickFirstDefined(row.expiresAt, row.expires_at, row.file_expires_at) as
      | string
      | undefined,
    downloadUrl: pickFirstDefined(row.downloadUrl, row.download_url, row.file_url) as
      | string
      | undefined,
  };
}

export async function getLatestDeletionRequest(
  userId: string
): Promise<DeletionRequestResponse | null> {
  const columns = await getTableColumns('account_deletion_requests');
  if (columns.size === 0) return null;

  const select = buildSelect('account_deletion_requests', columns, [
    'id',
    'status',
    'requested_at',
    'scheduled_for',
  ]);

  const orderBy = columns.has('requested_at') ? 'requested_at' : '';
  const sql = `SELECT ${select} FROM account_deletion_requests WHERE user_id = ?${
    orderBy ? ` ORDER BY ${orderBy} DESC` : ''
  } LIMIT 1`;

  const row = await dbGet<any>(sql, [userId]);

  if (!row) return null;
  return {
    id: String(row.id),
    status: String(row.status || 'scheduled') as ExportRequestStatus,
    requestedAt: String(
      pickFirstDefined(row.requestedAt, row.requested_at) || new Date().toISOString()
    ),
    scheduledFor: pickFirstDefined(row.scheduledFor, row.scheduled_for) as string | undefined,
  };
}

export type UserDataExport = {
  exportDate: string;
  user: any | null;
  profile: unknown | null;
  preferences: unknown | null;
  projects: any[];
  tasks: any[];
  assessments: unknown[];
  notifications: unknown[];
  securityEvents: any[];
};

export async function collectUserData(userId: string): Promise<UserDataExport> {
  const data: UserDataExport = {
    exportDate: new Date().toISOString(),
    user: null,
    profile: null,
    preferences: null,
    projects: [],
    tasks: [],
    assessments: [],
    notifications: [],
    securityEvents: [],
  };

  const userColumns = await getTableColumns('users');
  const userSelect = buildSelect('users', userColumns, [
    'id',
    'email',
    'first_name',
    'last_name',
    'phone',
    'role',
    'created_at',
    'last_login_at',
  ]);
  data.user = await dbGet(`SELECT ${userSelect} FROM users WHERE id = ?`, [userId]);

  const prefsRow = userColumns.has('extended_preferences')
    ? await dbGet<{ extended_preferences?: string }>(
        `SELECT extended_preferences FROM users WHERE id = ?`,
        [userId]
      )
    : null;
  data.preferences = prefsRow?.extended_preferences
    ? JSON.parse(prefsRow.extended_preferences)
    : null;

  data.projects = await dbAll(
    `SELECT id, name, description, status, created_at, updated_at
     FROM projects WHERE owner_id = ? OR id IN (
       SELECT project_id FROM project_members WHERE user_id = ?
     )`,
    [userId, userId]
  );

  data.tasks = await dbAll(
    `SELECT id, title, description, status, priority, due_date, created_at
     FROM tasks WHERE assignee_id = ? OR created_by = ?`,
    [userId, userId]
  );

  data.securityEvents = await dbAll(
    `SELECT type, title, description, ip_address, created_at
     FROM security_events WHERE user_id = ? ORDER BY created_at DESC LIMIT 100`,
    [userId]
  );

  try {
    data.notifications = await dbAll(
      `SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 100`,
      [userId]
    );
  } catch (err: any) {
    logger.debug('[GDPR] Notifications export skipped:', err?.message || err);
  }

  try {
    data.assessments = await dbAll(
      `SELECT * FROM assessments WHERE user_id = ? ORDER BY created_at DESC LIMIT 100`,
      [userId]
    );
  } catch (err: any) {
    logger.debug('[GDPR] Assessments export skipped:', err?.message || err);
  }

  return data;
}
