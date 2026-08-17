/** @vitest-environment node */
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';

const enabled = process.env.RUN_DB_TESTS === '1' && process.env.RUN_REDIS_TESTS === '1';

describe.skipIf(!enabled)('DEC-AGT-AUTONOMY durable dispatch — real PG + Redis', () => {
  const tag = randomUUID();
  const input = { planId: `plan-${tag}`, organizationId: `org-${tag}`,
    userId: `user-${tag}`, dispatchKey: `route-${tag}` };
  let pool: Pool;
  let service: typeof import('../agentTaskDispatchService.js');

  beforeAll(async () => {
    process.env.ENABLE_AI_TASKS_WORKER = 'true';
    process.env.MOCK_REDIS = 'false';
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    service = await import('../agentTaskDispatchService.js');
  });
  afterAll(async () => {
    const { default: queue } = await import('../../../queues/aiQueue.js');
    await queue.obliterate({ force: true });
    await queue.close();
    await pool.end();
  });

  it('OFF creates neither receipt nor Redis job', async () => {
    const off = await service.dispatchAgentTask({ ...input, dispatchKey: `off-${tag}` }, { env: {} as NodeJS.ProcessEnv });
    expect(off.status).toBe('DISABLED');
    const rows = await pool.query(`SELECT count(*)::int n FROM ai_agent_job_receipts WHERE dispatch_key=$1`, [`off-${tag}`]);
    expect(rows.rows[0].n).toBe(0);
  });

  it('8-way same key converges on one receipt and one stable Bull job; collision fails', async () => {
    const results = await Promise.all(Array.from({ length: 8 }, () => service.dispatchAgentTask(input)));
    expect(new Set(results.map((r) => r.receiptId)).size).toBe(1);
    const rows = await pool.query(`SELECT * FROM ai_agent_job_receipts WHERE organization_id=$1 AND dispatch_key=$2`,
      [input.organizationId,input.dispatchKey]);
    expect(rows.rows).toHaveLength(1);
    const { default: queue } = await import('../../../queues/aiQueue.js');
    expect(await queue.getJob(rows.rows[0].bull_job_id)).not.toBeNull();
    await expect(service.dispatchAgentTask({ ...input, planId: `other-${tag}` })).rejects.toThrow('AGENT_DISPATCH_PAYLOAD_COLLISION');
  });

  it('tenant identity, durable failure, explicit redrive, reclaim and cold read are fail closed', async () => {
    const receipt = await pool.query(`SELECT * FROM ai_agent_job_receipts WHERE organization_id=$1`, [input.organizationId]);
    const row = receipt.rows[0];
    const claimed = await service.claimAgentTask({ ...input, receiptId: row.receipt_id,
      payloadDigest: row.payload_digest, workerId: 'worker-a' });
    expect(claimed.replayed).toBe(false);
    await service.finishAgentTask(row.receipt_id, 'worker-a', false, new Error('PROVIDER_UNAVAILABLE'));
    expect((await service.redriveAgentTask(row.receipt_id, 'operator-1')).status).toBe('ENQUEUED');
    await expect(service.claimAgentTask({ ...input, organizationId: `foreign-${tag}`,
      receiptId: row.receipt_id, payloadDigest: row.payload_digest, workerId: 'worker-b' }))
      .rejects.toThrow();
    const second = await service.claimAgentTask({ ...input, receiptId: row.receipt_id,
      payloadDigest: row.payload_digest, workerId: 'worker-b' });
    expect(second.attemptNo).toBe(2);
    await service.finishAgentTask(row.receipt_id, 'worker-b', true);
    const cold = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
    const terminal = await cold.query(`SELECT status,attempt_count FROM ai_agent_job_receipts WHERE receipt_id=$1`, [row.receipt_id]);
    await cold.end();
    expect(terminal.rows[0]).toMatchObject({ status: 'SUCCEEDED', attempt_count: 2 });
    expect((await pool.query(`SELECT event_type FROM ai_agent_job_attempts WHERE receipt_id=$1`, [row.receipt_id])).rows.map(r=>r.event_type))
      .toEqual(['CLAIMED','FAILED','REDRIVEN','CLAIMED','SUCCEEDED']);
  });

  it('keeps enqueue failure recoverable, isolates a second tenant and reclaims an expired crash lease', async () => {
    const pending = { ...input, planId: `pending-${tag}`, dispatchKey: `pending-${tag}` };
    expect((await service.dispatchAgentTask(pending, { beforeEnqueue: async () => { throw new Error('REDIS_DOWN'); } })).status)
      .toBe('PENDING');
    const pendingRow = await pool.query(`SELECT status FROM ai_agent_job_receipts WHERE organization_id=$1 AND dispatch_key=$2`,
      [pending.organizationId,pending.dispatchKey]);
    expect(pendingRow.rows[0].status).toBe('PENDING');
    expect((await service.dispatchAgentTask(pending)).status).toBe('ENQUEUED');

    const foreign = { planId: `foreign-plan-${tag}`, organizationId: `foreign-org-${tag}`,
      userId: `foreign-user-${tag}`, dispatchKey: input.dispatchKey };
    const foreignResult = await service.dispatchAgentTask(foreign);
    expect(foreignResult.receiptId).not.toBeUndefined();
    expect(foreignResult.receiptId).not.toBe((await service.dispatchAgentTask(input)).receiptId);

    const crash = { ...input, planId: `crash-${tag}`, dispatchKey: `crash-${tag}` };
    const dispatched = await service.dispatchAgentTask(crash);
    const crashRow = await pool.query(`SELECT * FROM ai_agent_job_receipts WHERE receipt_id=$1`, [dispatched.receiptId]);
    await service.claimAgentTask({ ...crash, receiptId: crashRow.rows[0].receipt_id,
      payloadDigest: crashRow.rows[0].payload_digest, workerId: 'worker-crashed' });
    await pool.query(`UPDATE ai_agent_job_receipts SET lease_expires_at=now()-interval '1 second' WHERE receipt_id=$1`,
      [crashRow.rows[0].receipt_id]);
    const reclaimed = await service.claimAgentTask({ ...crash, receiptId: crashRow.rows[0].receipt_id,
      payloadDigest: crashRow.rows[0].payload_digest, workerId: 'worker-restarted' });
    expect(reclaimed.attemptNo).toBe(2);
    await service.finishAgentTask(crashRow.rows[0].receipt_id, 'worker-restarted', true);
  });
});
