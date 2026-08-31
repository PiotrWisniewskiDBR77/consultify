/** @vitest-environment node */
import { randomUUID } from 'node:crypto';

import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const enabled = process.env.RUN_DB_TESTS === '1' && process.env.RUN_REDIS_TESTS === '1';

describe.skipIf(!enabled)('DAY180 long-step cancellation — real PG + Redis', () => {
  const tag = randomUUID();
  const organizationId = `day180-long-cancel-org-${tag}`;
  const userId = `day180-long-cancel-user-${tag}`;
  let pool: Pool;

  beforeAll(async () => {
    expect(process.env.DB_TYPE).toBe('postgres');
    expect(process.env.MOCK_REDIS).toBe('false');
    expect(process.env.ENABLE_AI_TASKS_WORKER).toBe('true');
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    await pool.query(
      `INSERT INTO organizations (id,name,plan,status,is_active) VALUES ($1,$2,'enterprise','active',1)`,
      [organizationId, 'Day 180 long cancellation']
    );
    await pool.query(
      `INSERT INTO users (id,organization_id,email,password,role,status,first_name,last_name)
       VALUES ($1,$2,$3,'not-used','OWNER','active','Day','180')`,
      [userId, organizationId, `${userId}@example.test`]
    );
  });

  afterAll(async () => {
    const { default: queue } = await import('../../../queues/aiQueue.js');
    await queue.obliterate({ force: true });
    await queue.close();
    await pool?.end();
  });

  it('closes window (b) on the first attempt and clears the lease after heartbeat observes cancellation', async () => {
    const { agentPlannerService } = await import('../agentPlannerService.js');
    const { tryDispatchBackgroundExecution } =
      await import('../../../routes/ai/agent-plan.routes.js');
    const { default: queue } = await import('../../../queues/aiQueue.js');
    const { claimAgentTask, finishAgentTask } = await import('../agentTaskDispatchService.js');
    const plan = await agentPlannerService.createPlan({
      organizationId,
      userId,
      title: 'Day 180 cancellation during a long step',
      isBackground: true,
      steps: [
        {
          toolName: 'create_task',
          toolInput: { title: `day180-long-step-${tag}` },
          requiresApproval: false,
        },
      ],
    });
    let heartbeatAttempts = 0;
    let heartbeatFailures = 0;
    let heartbeatObservedCancelled = 0;
    const originalRenew = agentPlannerService.renewExecutionLease.bind(agentPlannerService);
    const heartbeat = vi
      .spyOn(agentPlannerService, 'renewExecutionLease')
      .mockImplementation(async (lease) => {
        heartbeatAttempts += 1;
        const status = (
          await pool.query(`SELECT status FROM ai_agent_plans WHERE id=$1`, [plan.id])
        ).rows[0]?.status;
        if (status === 'cancelled') heartbeatObservedCancelled += 1;
        try {
          await originalRenew(lease);
        } catch (error) {
          heartbeatFailures += 1;
          throw error;
        }
      });
    try {
      expect(
        await tryDispatchBackgroundExecution({ planId: plan.id, organizationId, userId })
      ).toBe('enqueued');
      const receipt = (
        await pool.query(
          `SELECT receipt_id,bull_job_id,dispatch_key,payload_digest
             FROM ai_agent_job_receipts WHERE plan_id=$1`,
          [plan.id]
        )
      ).rows[0];
      const workerId = `day180-worker-${tag}`;
      await claimAgentTask({
        planId: plan.id,
        organizationId,
        userId,
        dispatchKey: receipt.dispatch_key,
        receiptId: receipt.receipt_id,
        payloadDigest: receipt.payload_digest,
        workerId,
      });
      const result = await agentPlannerService.executePlan(plan.id, async () => {
        await agentPlannerService.cancelPlan(plan.id);
        await new Promise((resolve) => setTimeout(resolve, 150));
        return { completed: true };
      });
      expect(result.status).toBe('cancelled');
      await finishAgentTask(receipt.receipt_id, workerId, true);
      expect(heartbeatAttempts).toBeGreaterThanOrEqual(3);
      expect(heartbeatObservedCancelled).toBeGreaterThanOrEqual(1);
      expect(heartbeatFailures).toBeGreaterThanOrEqual(1);
      const planRow = (
        await pool.query(
          `SELECT status,execution_owner_token,execution_fencing_token,execution_lease_expires_at,
                  execution_heartbeat_at
             FROM ai_agent_plans WHERE id=$1`,
          [plan.id]
        )
      ).rows[0];
      expect(planRow.status).toBe('cancelled');
      expect(planRow.execution_owner_token).toBeNull();
      expect(Number(planRow.execution_fencing_token)).toBeGreaterThan(0);
      expect(planRow.execution_lease_expires_at).toBeNull();
      expect(planRow.execution_heartbeat_at).toBeNull();
      // FIX-180 / F3: the step whose tool was in flight when the cancellation
      // landed must be TERMINAL — not "W toku" forever on the canvas.
      const stepRow = (
        await pool.query(
          `SELECT status,completed_at,duration_ms FROM ai_agent_plan_steps WHERE plan_id=$1`,
          [plan.id]
        )
      ).rows[0];
      expect(stepRow.status).not.toBe('running');
      expect(stepRow.status).toBe('skipped');
      expect(stepRow.completed_at).not.toBeNull();
      expect(Number(stepRow.duration_ms)).toBeGreaterThan(0);
      const receiptRow = (
        await pool.query(
          `SELECT status,last_error_code FROM ai_agent_job_receipts WHERE receipt_id=$1`,
          [receipt.receipt_id]
        )
      ).rows[0];
      expect(receiptRow.status).toBe('SUCCEEDED');
      expect(receiptRow.last_error_code).toBeNull();
      const attempts = (
        await pool.query(
          `SELECT event_type,error_code,attempt_no FROM ai_agent_job_attempts
            WHERE receipt_id=$1 ORDER BY created_at`,
          [receipt.receipt_id]
        )
      ).rows;
      expect(attempts).toEqual([
        expect.objectContaining({ event_type: 'CLAIMED', attempt_no: 1 }),
        expect.objectContaining({ event_type: 'SUCCEEDED', attempt_no: 1 }),
      ]);
    } finally {
      heartbeat.mockRestore();
      await (
        await queue.getJob(
          (
            await pool.query(`SELECT bull_job_id FROM ai_agent_job_receipts WHERE plan_id=$1`, [
              plan.id,
            ])
          ).rows[0]?.bull_job_id
        )
      )?.remove();
    }
  }, 60_000);

  it('warns above the long-step threshold for success and failure, but not below it', async () => {
    const { agentPlannerService } = await import('../agentPlannerService.js');
    const { default: logger } = await import('../../../utils/Logger.js');
    const warning = vi.spyOn(logger, 'warn').mockImplementation(() => logger);
    const makePlan = (title: string) =>
      agentPlannerService.createPlan({
        organizationId,
        userId,
        title,
        steps: [
          {
            toolName: 'generate_report_section',
            toolInput: {},
            requiresApproval: false,
          },
        ],
      });
    try {
      const slowSuccess = await makePlan('Day 180 slow success warning');
      await agentPlannerService.executePlan(slowSuccess.id, async () => {
        await new Promise((resolve) => setTimeout(resolve, 75));
        return { ok: true };
      });
      const slowFailure = await makePlan('Day 180 slow failure warning');
      await agentPlannerService.executePlan(slowFailure.id, async () => {
        await new Promise((resolve) => setTimeout(resolve, 75));
        throw new Error('expected-test-failure');
      });
      const fast = await makePlan('Day 180 fast no warning');
      await agentPlannerService.executePlan(fast.id, async () => ({ ok: true }));

      const longStepWarnings = warning.mock.calls.filter(
        ([message]) => message === '[AgentPlanner] long-running step completed'
      );
      expect(longStepWarnings).toHaveLength(2);
      expect(longStepWarnings.map(([, meta]) => meta)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            planId: slowSuccess.id,
            stepIndex: 0,
            durationMs: expect.any(Number),
          }),
          expect.objectContaining({
            planId: slowFailure.id,
            stepIndex: 0,
            durationMs: expect.any(Number),
          }),
        ])
      );
      expect(longStepWarnings.some(([, meta]: any[]) => meta.planId === fast.id)).toBe(false);
    } finally {
      warning.mockRestore();
    }
  }, 60_000);
});
