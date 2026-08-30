/** @vitest-environment node */
import { randomUUID } from 'node:crypto';

import { QueueEvents } from 'bullmq';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const enabled = process.env.RUN_DB_TESTS === '1' && process.env.RUN_REDIS_TESTS === '1';

describe.skipIf(!enabled)('DAY180 noncanonical plan resource limit — real PG + Redis', () => {
  const tag = randomUUID();
  const organizationId = `day180-limit-org-${tag}`;
  const userId = `day180-limit-user-${tag}`;
  let pool: Pool;

  beforeAll(async () => {
    expect(process.env.DB_TYPE).toBe('postgres');
    expect(process.env.MOCK_REDIS).toBe('false');
    expect(process.env.ENABLE_AI_TASKS_WORKER).toBe('true');
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    await pool.query(
      `INSERT INTO organizations (id,name,plan,status,is_active) VALUES ($1,$2,'enterprise','active',1)`,
      [organizationId, 'Day 180 resource limit']
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

  it('denies a route-shaped plan without canonicalRunId before its write tool executes', async () => {
    const { agentPlannerService } = await import('../agentPlannerService.js');
    const { tryDispatchBackgroundExecution } = await import(
      '../../../routes/ai/agent-plan.routes.js'
    );
    const { default: queue } = await import('../../../queues/aiQueue.js');
    const { initWorker } = await import('../../../workers/aiWorker.js');
    const taskTitle = `day180-denied-task-${tag}`;
    const plan = await agentPlannerService.createPlan({
      organizationId,
      userId,
      title: 'Day 180 noncanonical resource limit',
      isBackground: true,
      steps: [
        {
          toolName: 'create_task',
          toolInput: { title: taskTitle },
          requiresApproval: false,
        },
      ],
    });
    expect(plan.canonicalRunId).toBeNull();
    const policyId = randomUUID();
    await pool.query(
      `INSERT INTO v8_agent_resource_policies
       (policy_id,organization_id,project_id,max_concurrent_executions,max_estimated_cost_usd_per_run,lease_seconds,enabled)
       VALUES ($1,$2,'agent-plan-chat:v1',4,0.005,300,1)`,
      [policyId, organizationId]
    );
    await pool.query(
      `INSERT INTO v8_agent_resource_reservations
       (reservation_id,organization_id,project_id,run_id,user_id,agent_id,tool_name,idempotency_key,
        policy_id,status,decision_reason,estimated_cost_usd,actual_cost_usd,settled_at)
       VALUES ($1,$2,'agent-plan-chat:v1',$3,$4,'day180-seed','create_task',$5,$6,'settled',
        'day180_seeded_prior_cost',0.01,0,now())`,
      [randomUUID(), organizationId, plan.id, userId, `day180-seed:${plan.id}`, policyId]
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
      const planRow = (
        await pool.query(`SELECT canonical_run_id,status FROM ai_agent_plans WHERE id=$1`, [plan.id])
      ).rows[0];
      expect(planRow.canonical_run_id).toBeNull();
      expect(planRow.status).toBe('completed_with_errors');
      const step = (
        await pool.query(
          `SELECT status,error_message FROM ai_agent_plan_steps WHERE plan_id=$1`,
          [plan.id]
        )
      ).rows[0];
      expect(step.status).toBe('failed');
      expect(step.error_message).toContain('resource_estimated_cost_limit_exceeded');
      const denied = (
        await pool.query(
          `SELECT status,decision_reason,project_id,run_id,idempotency_key
             FROM v8_agent_resource_reservations
            WHERE organization_id=$1 AND run_id=$2 AND status='denied'`,
          [organizationId, plan.id]
        )
      ).rows[0];
      expect(denied).toMatchObject({
        status: 'denied',
        decision_reason: 'resource_estimated_cost_limit_exceeded',
        project_id: 'agent-plan-chat:v1',
        run_id: plan.id,
      });
      expect(denied.idempotency_key).toContain(`planner-chat:${plan.id}:`);
      expect(
        Number((await pool.query(`SELECT COUNT(*) AS count FROM tasks WHERE title=$1`, [taskTitle])).rows[0].count)
      ).toBe(0);
    } finally {
      await worker?.close();
      await queueEvents.close();
    }
  }, 60_000);
});
