/** @vitest-environment node */
import { randomUUID } from 'node:crypto';

import { QueueEvents } from 'bullmq';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const enabled = process.env.RUN_DB_TESTS === '1' && process.env.RUN_REDIS_TESTS === '1';

describe.skipIf(!enabled)('DAY174 cancellation — real PG + Redis', () => {
  const tag = randomUUID();
  const organizationId = `day174-cancel-org-${tag}`;
  const userId = `day174-cancel-user-${tag}`;
  let pool: Pool;

  beforeAll(async () => {
    expect(process.env.DB_TYPE).toBe('postgres');
    expect(process.env.MOCK_REDIS).toBe('false');
    expect(process.env.ENABLE_AI_TASKS_WORKER).toBe('true');
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    await pool.query(
      `INSERT INTO organizations (id,name,plan,status,is_active) VALUES ($1,$2,'enterprise','active',1)`,
      [organizationId, 'Day 174 cancellation']
    );
    await pool.query(
      `INSERT INTO users (id,organization_id,email,password,role,status,first_name,last_name)
       VALUES ($1,$2,$3,'not-used','OWNER','active','Day','174')`,
      [userId, organizationId, `${userId}@example.test`]
    );
  });

  afterAll(async () => {
    const { default: queue } = await import('../../../queues/aiQueue.js');
    await queue.obliterate({ force: true });
    await queue.close();
    await pool?.end();
  });

  it('stops after step one, preserves cancelled, and closes the receipt', async () => {
    const { agentPlannerService } = await import('../agentPlannerService.js');
    const { tryDispatchBackgroundExecution } =
      await import('../../../routes/ai/agent-plan.routes.js');
    const { redriveAgentTask } = await import('../agentTaskDispatchService.js');
    const { default: queue } = await import('../../../queues/aiQueue.js');
    const { initWorker } = await import('../../../workers/aiWorker.js');
    const plan = await agentPlannerService.createPlan({
      organizationId,
      userId,
      title: 'Day 174 cancel after first step',
      isBackground: true,
      steps: [1, 2, 3].map((number) => ({
        toolName: 'generate_report_section',
        toolInput: { number },
        requiresApproval: false,
      })),
    });
    const effects: number[] = [];
    const execution = vi
      .spyOn(agentPlannerService, 'executeBackgroundPlan')
      .mockImplementation(async (payload) =>
        agentPlannerService.executePlan(payload.planId, async (_tool, input) => {
          const number = Number(input.number);
          effects.push(number);
          if (number === 1) await agentPlannerService.cancelPlan(payload.planId);
          return { number };
        })
      );
    const queueEvents = new QueueEvents('ai-tasks', { connection: queue.opts.connection as never });
    await queueEvents.waitUntilReady();
    const worker = initWorker();
    try {
      expect(await tryDispatchBackgroundExecution({ planId: plan.id, organizationId, userId })).toBe(
        'enqueued'
      );
      const receipt = (
        await pool.query(
          `SELECT receipt_id,bull_job_id FROM ai_agent_job_receipts WHERE plan_id=$1`,
          [plan.id]
        )
      ).rows[0];
      await (await queue.getJob(receipt.bull_job_id))!.waitUntilFinished(queueEvents, 30_000);
      expect(effects).toEqual([1]);
      expect((await agentPlannerService.getPlan(plan.id))?.status).toBe('cancelled');
      const readback = (
        await pool.query(
          `SELECT status,execution_owner_token,execution_lease_expires_at
             FROM ai_agent_plans WHERE id=$1`,
          [plan.id]
        )
      ).rows[0];
      expect(readback).toMatchObject({
        status: 'cancelled',
        execution_owner_token: null,
        execution_lease_expires_at: null,
      });
      expect(
        (
          await pool.query(`SELECT status FROM ai_agent_job_receipts WHERE receipt_id=$1`, [
            receipt.receipt_id,
          ])
        ).rows[0].status
      ).toBe('SUCCEEDED');
      await expect(redriveAgentTask(receipt.receipt_id, userId)).rejects.toThrow(
        'AGENT_DISPATCH_NOT_REDRIVABLE'
      );
    } finally {
      execution.mockRestore();
      await worker?.close();
      await queueEvents.close();
    }
  }, 60_000);

  // FIX-174 / ERRATA ODBIOR_174 pkt 1 ("okno a2"): the test above cancels
  // BETWEEN steps 1 and 2 of a 3-step plan — executePlan's loop still gets a
  // chance to observe `status = 'cancelled'` at the top of the NEXT
  // iteration. This test instead cancels DURING the plan's only (= last)
  // step, so there is no next iteration: the loop falls straight through to
  // `finalizePlan`, which is the only place left that can see the
  // cancellation. Before the fix, `finalizePlan`'s
  // `WHERE status = 'executing'` matched zero rows (already 'cancelled'),
  // threw `AgentExecutionLeaseLostError`, and left the lease
  // (execution_owner_token/execution_lease_expires_at) leaking for ~5
  // minutes while the receipt closed FAILED with a "lease lost" reason that
  // lied about an ordinary, already-recorded cancellation.
  it('cancels during the LAST step (okno a2), clears the lease, closes the receipt (not FAILED)', async () => {
    const { agentPlannerService } = await import('../agentPlannerService.js');
    const { tryDispatchBackgroundExecution } = await import(
      '../../../routes/ai/agent-plan.routes.js'
    );
    const { redriveAgentTask } = await import('../agentTaskDispatchService.js');
    const { default: queue } = await import('../../../queues/aiQueue.js');
    const { initWorker } = await import('../../../workers/aiWorker.js');
    const plan = await agentPlannerService.createPlan({
      organizationId,
      userId,
      title: 'Day 174 FIX-174 cancel during last (only) step',
      isBackground: true,
      steps: [1].map((number) => ({
        toolName: 'generate_report_section',
        toolInput: { number },
        requiresApproval: false,
      })),
    });
    const effects: number[] = [];
    const execution = vi
      .spyOn(agentPlannerService, 'executeBackgroundPlan')
      .mockImplementation(async (payload) =>
        agentPlannerService.executePlan(payload.planId, async (_tool, input) => {
          const number = Number(input.number);
          effects.push(number);
          // Cancellation lands while this (last) step is still "in flight"
          // from the loop's perspective — by the time the tool result comes
          // back, executePlan has nothing left to iterate and heads straight
          // for finalizePlan with the row already `cancelled`.
          await agentPlannerService.cancelPlan(payload.planId);
          return { number };
        })
      );
    const queueEvents = new QueueEvents('ai-tasks', { connection: queue.opts.connection as never });
    await queueEvents.waitUntilReady();
    const worker = initWorker();
    try {
      expect(
        await tryDispatchBackgroundExecution({ planId: plan.id, organizationId, userId })
      ).toBe('enqueued');
      const receipt = (
        await pool.query(
          `SELECT receipt_id,bull_job_id FROM ai_agent_job_receipts WHERE plan_id=$1`,
          [plan.id]
        )
      ).rows[0];
      await (await queue.getJob(receipt.bull_job_id))!.waitUntilFinished(queueEvents, 30_000);
      expect(effects).toEqual([1]);
      const readback = (
        await pool.query(
          `SELECT status,execution_owner_token,execution_lease_expires_at
             FROM ai_agent_plans WHERE id=$1`,
          [plan.id]
        )
      ).rows[0];
      expect(readback).toMatchObject({
        status: 'cancelled',
        execution_owner_token: null,
        execution_lease_expires_at: null,
      });
      expect(readback.status).not.toBe('executing');
      expect(readback.status).not.toBe('failed');
      const receiptRow = (
        await pool.query(`SELECT status,last_error_code FROM ai_agent_job_receipts WHERE receipt_id=$1`, [
          receipt.receipt_id,
        ])
      ).rows[0];
      expect(receiptRow.status).toBe('SUCCEEDED');
      expect(receiptRow.status).not.toBe('RUNNING');
      expect(receiptRow.status).not.toBe('FAILED');
      await expect(redriveAgentTask(receipt.receipt_id, userId)).rejects.toThrow(
        'AGENT_DISPATCH_NOT_REDRIVABLE'
      );
    } finally {
      execution.mockRestore();
      await worker?.close();
      await queueEvents.close();
    }
  }, 60_000);
});
