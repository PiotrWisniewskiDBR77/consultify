import { v4 as uuidv4 } from 'uuid';

import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';

export type AdminIamJobStatus = 'queued' | 'running' | 'succeeded' | 'failed';

export interface AdminIamJob {
  id: string;
  organizationId: string;
  jobType: string;
  idempotencyKey: string;
  payload: Record<string, unknown>;
  status: AdminIamJobStatus;
  attemptCount: number;
  maxAttempts: number;
  lastError: string | null;
  leaseToken: string | null;
}

function mapJob(row: any): AdminIamJob {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    jobType: String(row.job_type),
    idempotencyKey: String(row.idempotency_key),
    payload: JSON.parse(String(row.payload_json || '{}')),
    status: row.status as AdminIamJobStatus,
    attemptCount: Number(row.attempt_count),
    maxAttempts: Number(row.max_attempts),
    lastError: row.last_error == null ? null : String(row.last_error),
    leaseToken: row.lease_token == null ? null : String(row.lease_token),
  };
}

async function event(params: {
  organizationId: string;
  jobId: string;
  actorId: string;
  type: string;
  details?: unknown;
}) {
  const result = await dbRun(
    `INSERT INTO admin_iam_job_events
       (id, organization_id, job_id, actor_id, event_type, details_json)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      uuidv4(),
      params.organizationId,
      params.jobId,
      params.actorId,
      params.type,
      params.details === undefined ? null : JSON.stringify(params.details),
    ],
    { fallback: false }
  );
  if (Number(result?.changes || 0) !== 1) throw new Error('IAM job audit was not persisted');
}

export async function enqueueAdminIamJob(params: {
  organizationId: string;
  actorId: string;
  jobType: string;
  idempotencyKey: string;
  payload: Record<string, unknown>;
  maxAttempts?: number;
}): Promise<AdminIamJob> {
  const id = uuidv4();
  const maxAttempts = Math.min(10, Math.max(1, params.maxAttempts ?? 3));
  await dbRun(
    `INSERT INTO admin_iam_jobs
       (id, organization_id, job_type, idempotency_key, payload_json, max_attempts, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (organization_id, idempotency_key) DO NOTHING`,
    [
      id,
      params.organizationId,
      params.jobType,
      params.idempotencyKey,
      JSON.stringify(params.payload),
      maxAttempts,
      params.actorId,
    ],
    { fallback: false }
  );
  const row = await dbGet<any>(
    `SELECT * FROM admin_iam_jobs WHERE organization_id = ? AND idempotency_key = ?`,
    [params.organizationId, params.idempotencyKey],
    { fallback: false }
  );
  if (!row) throw new Error('IAM job could not be read back');
  if (String(row.id) === id)
    await event({
      organizationId: params.organizationId,
      jobId: id,
      actorId: params.actorId,
      type: 'enqueued',
    });
  return mapJob(row);
}

export async function claimAdminIamJob(params: {
  organizationId: string;
  workerId: string;
  leaseSeconds?: number;
}): Promise<AdminIamJob | null> {
  const leaseToken = uuidv4();
  const leaseSeconds = Math.min(300, Math.max(10, params.leaseSeconds ?? 60));
  const row = await dbGet<any>(
    `UPDATE admin_iam_jobs SET status = 'running', attempt_count = attempt_count + 1,
       lease_token = ?, lease_expires_at = CURRENT_TIMESTAMP + (? * INTERVAL '1 second'), updated_at = CURRENT_TIMESTAMP
     WHERE id = (
       SELECT id FROM admin_iam_jobs
       WHERE organization_id = ? AND status = 'queued' AND available_at <= CURRENT_TIMESTAMP
       ORDER BY created_at ASC FOR UPDATE SKIP LOCKED LIMIT 1
     ) AND organization_id = ? AND status = 'queued'
     RETURNING *`,
    [leaseToken, leaseSeconds, params.organizationId, params.organizationId],
    { fallback: false }
  );
  if (!row) return null;
  await event({
    organizationId: params.organizationId,
    jobId: row.id,
    actorId: params.workerId,
    type: 'claimed',
    details: { leaseToken },
  });
  return mapJob(row);
}

export async function completeAdminIamJob(params: {
  organizationId: string;
  jobId: string;
  leaseToken: string;
  workerId: string;
}): Promise<AdminIamJob> {
  const row = await dbGet<any>(
    `UPDATE admin_iam_jobs SET status = 'succeeded', lease_token = NULL, lease_expires_at = NULL, updated_at = CURRENT_TIMESTAMP
     WHERE id = ? AND organization_id = ? AND status = 'running' AND lease_token = ? RETURNING *`,
    [params.jobId, params.organizationId, params.leaseToken],
    { fallback: false }
  );
  if (!row) throw new Error('IAM job lease is stale or outside tenant scope');
  await event({
    organizationId: params.organizationId,
    jobId: params.jobId,
    actorId: params.workerId,
    type: 'succeeded',
  });
  return mapJob(row);
}

export async function failAdminIamJob(params: {
  organizationId: string;
  jobId: string;
  leaseToken: string;
  workerId: string;
  error: string;
}): Promise<AdminIamJob> {
  const current = await dbGet<any>(
    `SELECT * FROM admin_iam_jobs WHERE id = ? AND organization_id = ? AND status = 'running' AND lease_token = ?`,
    [params.jobId, params.organizationId, params.leaseToken],
    { fallback: false }
  );
  if (!current) throw new Error('IAM job lease is stale or outside tenant scope');
  const retry = Number(current.attempt_count) < Number(current.max_attempts);
  const row = await dbGet<any>(
    `UPDATE admin_iam_jobs SET status = ?, last_error = ?, available_at = CURRENT_TIMESTAMP,
       lease_token = NULL, lease_expires_at = NULL, updated_at = CURRENT_TIMESTAMP
     WHERE id = ? AND organization_id = ? AND status = 'running' AND lease_token = ? RETURNING *`,
    [
      retry ? 'queued' : 'failed',
      params.error.slice(0, 1000),
      params.jobId,
      params.organizationId,
      params.leaseToken,
    ],
    { fallback: false }
  );
  if (!row) throw new Error('IAM job transition lost its lease');
  await event({
    organizationId: params.organizationId,
    jobId: params.jobId,
    actorId: params.workerId,
    type: retry ? 'retry_scheduled' : 'failed',
    details: { error: params.error.slice(0, 1000) },
  });
  return mapJob(row);
}

export async function getAdminIamJobMetrics(organizationId: string) {
  const rows = await dbAll<{ status: AdminIamJobStatus; count: number | string }>(
    `SELECT status, COUNT(*) AS count FROM admin_iam_jobs WHERE organization_id = ? GROUP BY status`,
    [organizationId],
    { fallback: false }
  );
  const counts: Record<AdminIamJobStatus, number> = {
    queued: 0,
    running: 0,
    succeeded: 0,
    failed: 0,
  };
  for (const row of rows || []) counts[row.status] = Number(row.count);
  return counts;
}
