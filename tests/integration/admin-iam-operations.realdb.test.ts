import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  claimAdminIamJob,
  completeAdminIamJob,
  enqueueAdminIamJob,
  failAdminIamJob,
  getAdminIamJobMetrics,
} from '../../server/src/services/adminIamOperationsService.js';
import { all as dbAll, run as dbRun } from '../../server/src/utils/DbPromise.js';

const enabled = process.env.RUN_DB_TESTS === '1' && Boolean(process.env.DATABASE_URL);
const suite = enabled ? describe : describe.skip;
const prefix = `adm-iam-${Date.now()}`;
const orgA = `${prefix}-org-a`;
const orgB = `${prefix}-org-b`;
const actor = `${prefix}-actor`;

suite('ADM-MVP-OPS-001 real PostgreSQL job lifecycle', () => {
  beforeAll(async () => {
    process.env.DB_TYPE = 'postgres';
    process.env.MOCK_DB = 'false';
  });

  afterAll(async () => {
    await dbRun(`DELETE FROM admin_iam_job_events WHERE organization_id IN (?, ?)`, [orgA, orgB], {
      fallback: false,
    });
    await dbRun(`DELETE FROM admin_iam_jobs WHERE organization_id IN (?, ?)`, [orgA, orgB], {
      fallback: false,
    });
  });

  it('deduplicates enqueue, isolates tenants, retries once and completes under the current lease', async () => {
    const first = await enqueueAdminIamJob({
      organizationId: orgA,
      actorId: actor,
      jobType: 'membership_sync',
      idempotencyKey: `${prefix}-same`,
      payload: { source: 'scim' },
      maxAttempts: 2,
    });
    const replay = await enqueueAdminIamJob({
      organizationId: orgA,
      actorId: actor,
      jobType: 'membership_sync',
      idempotencyKey: `${prefix}-same`,
      payload: { source: 'forged' },
      maxAttempts: 2,
    });
    expect(replay.id).toBe(first.id);
    expect(replay.payload).toEqual({ source: 'scim' });

    expect(await claimAdminIamJob({ organizationId: orgB, workerId: 'worker-b' })).toBeNull();
    const claimed1 = await claimAdminIamJob({ organizationId: orgA, workerId: 'worker-a' });
    expect(claimed1?.attemptCount).toBe(1);
    const retry = await failAdminIamJob({
      organizationId: orgA,
      jobId: first.id,
      leaseToken: claimed1!.leaseToken!,
      workerId: 'worker-a',
      error: 'provider timeout',
    });
    expect(retry.status).toBe('queued');

    await expect(
      completeAdminIamJob({
        organizationId: orgA,
        jobId: first.id,
        leaseToken: claimed1!.leaseToken!,
        workerId: 'stale-worker',
      })
    ).rejects.toThrow('stale or outside tenant');
    const claimed2 = await claimAdminIamJob({ organizationId: orgA, workerId: 'worker-a' });
    const complete = await completeAdminIamJob({
      organizationId: orgA,
      jobId: first.id,
      leaseToken: claimed2!.leaseToken!,
      workerId: 'worker-a',
    });
    expect(complete.status).toBe('succeeded');

    expect(await getAdminIamJobMetrics(orgA)).toEqual({
      queued: 0,
      running: 0,
      succeeded: 1,
      failed: 0,
    });
    const events = await dbAll<{ event_type: string }>(
      `SELECT event_type FROM admin_iam_job_events WHERE organization_id = ? AND job_id = ? ORDER BY created_at, id`,
      [orgA, first.id],
      { fallback: false }
    );
    expect(events.map((row) => row.event_type)).toEqual([
      'enqueued',
      'claimed',
      'retry_scheduled',
      'claimed',
      'succeeded',
    ]);
  });

  it('moves an exhausted job to failed without creating an orphan event', async () => {
    const job = await enqueueAdminIamJob({
      organizationId: orgA,
      actorId: actor,
      jobType: 'role_reconcile',
      idempotencyKey: `${prefix}-terminal`,
      payload: {},
      maxAttempts: 1,
    });
    const claimed = await claimAdminIamJob({ organizationId: orgA, workerId: 'worker-a' });
    expect(claimed?.id).toBe(job.id);
    const failed = await failAdminIamJob({
      organizationId: orgA,
      jobId: job.id,
      leaseToken: claimed!.leaseToken!,
      workerId: 'worker-a',
      error: 'invalid directory response',
    });
    expect(failed.status).toBe('failed');
    const orphans = await dbAll<{ count: number | string }>(
      `SELECT COUNT(*) AS count FROM admin_iam_job_events e LEFT JOIN admin_iam_jobs j ON j.id = e.job_id WHERE e.organization_id = ? AND j.id IS NULL`,
      [orgA],
      { fallback: false }
    );
    expect(Number(orphans[0]?.count)).toBe(0);
  });
});
