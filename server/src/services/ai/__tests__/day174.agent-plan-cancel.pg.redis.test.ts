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
});
