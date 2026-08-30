/** @vitest-environment node */
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';

import { QueueEvents } from 'bullmq';
import express from 'express';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const enabled = process.env.RUN_DB_TESTS === '1' && process.env.RUN_REDIS_TESTS === '1';

describe.skipIf(!enabled)('DAY165 agent plan resumes after approval — real PG + Redis', () => {
  const tag = randomUUID();
  const organizationId = `day165-org-${tag}`;
  const userId = `day165-user-${tag}`;
  let pool: Pool;
  let planId: string;

  beforeAll(async () => {
    expect(process.env.DB_TYPE).toBe('postgres');
    expect(process.env.MOCK_REDIS).toBe('false');
    expect(process.env.ENABLE_AI_TASKS_WORKER).toBe('true');
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    await pool.query(
      `INSERT INTO organizations (id,name,plan,status,is_active) VALUES ($1,$2,'enterprise','active',1)`,
      [organizationId, 'Day 165 fixture']
    );
    await pool.query(
      `INSERT INTO users (id,organization_id,email,password,role,status,first_name,last_name)
       VALUES ($1,$2,$3,'not-used','OWNER','active','Day','165')`,
      [userId, organizationId, `${userId}@example.test`]
    );
  });

  afterAll(async () => {
    const { default: queue } = await import('../../../queues/aiQueue.js');
    await queue.obliterate({ force: true });
    await queue.close();
    if (pool) {
      await pool.end();
    }
  });

  it('keeps checkpoint receipt non-SUCCEEDED and enqueues a distinct approval generation', async () => {
    const { agentPlannerService } = await import('../agentPlannerService.js');
    const { tryDispatchBackgroundExecution } =
      await import('../../../routes/ai/agent-plan.routes.js');
    const { default: queue } = await import('../../../queues/aiQueue.js');
    const { initWorker } = await import('../../../workers/aiWorker.js');
    const plan = await agentPlannerService.createPlan({
      organizationId,
      userId,
      title: 'Day 165 approval checkpoint',
      isBackground: true,
      steps: [
        {
          toolName: 'create_task',
          toolInput: { title: 'Day 165 local fixture' },
          requiresApproval: true,
        },
      ],
    });
    planId = plan.id;

    const queueEvents = new QueueEvents('ai-tasks', { connection: queue.opts.connection as never });
    await queueEvents.waitUntilReady();
    const worker = initWorker();
    expect(worker).not.toBeNull();
    let executedApprovedStep = 0;
    const original = agentPlannerService.executeBackgroundPlan.bind(agentPlannerService);
    const execution = vi
      .spyOn(agentPlannerService, 'executeBackgroundPlan')
      .mockImplementation(async (payload) => {
        const current = await agentPlannerService.getPlan(payload.planId);
        if (current?.steps[0]?.approvedAt) {
          return agentPlannerService.executePlan(payload.planId, async () => {
            executedApprovedStep += 1;
            return { createdLocally: true };
          });
        }
        return original(payload);
      });

    try {
      expect(await tryDispatchBackgroundExecution({ planId, organizationId, userId })).toBe(
        'enqueued'
      );
      const first = (
        await pool.query(
          `SELECT receipt_id,dispatch_key,bull_job_id FROM ai_agent_job_receipts WHERE plan_id=$1 ORDER BY created_at`,
          [planId]
        )
      ).rows[0];
      const firstJob = await queue.getJob(first.bull_job_id);
      await firstJob!.waitUntilFinished(queueEvents, 30_000);
      const checkpoint = (
        await pool.query(`SELECT status FROM ai_agent_job_receipts WHERE receipt_id=$1`, [
          first.receipt_id,
        ])
      ).rows[0];
      expect(checkpoint.status).not.toBe('SUCCEEDED');
      expect((await agentPlannerService.getPlan(planId))?.status).toBe('awaiting_approval');

      await agentPlannerService.approveStep(planId, 0, userId);
      expect(await tryDispatchBackgroundExecution({ planId, organizationId, userId })).toBe(
        'enqueued'
      );
      const receipts = (
        await pool.query(
          `SELECT receipt_id,dispatch_key,bull_job_id,status FROM ai_agent_job_receipts WHERE plan_id=$1 ORDER BY created_at`,
          [planId]
        )
      ).rows;
      expect(receipts).toHaveLength(2);
      expect(receipts[1].dispatch_key).not.toBe(receipts[0].dispatch_key);
      const secondJob = await queue.getJob(receipts[1].bull_job_id);
      await secondJob!.waitUntilFinished(queueEvents, 30_000);
      expect(executedApprovedStep).toBe(1);
      expect((await agentPlannerService.getPlan(planId))?.status).toBe('completed');
      expect(
        (
          await pool.query(`SELECT status FROM ai_agent_job_receipts WHERE receipt_id=$1`, [
            receipts[1].receipt_id,
          ])
        ).rows[0].status
      ).toBe('SUCCEEDED');

      expect(await tryDispatchBackgroundExecution({ planId, organizationId, userId })).toBe(
        'replayed'
      );
      expect(
        (
          await pool.query(`SELECT count(*)::int n FROM ai_agent_job_receipts WHERE plan_id=$1`, [
            planId,
          ])
        ).rows[0].n
      ).toBe(2);
    } finally {
      execution.mockRestore();
      await worker?.close();
      await queueEvents.close();
    }
  }, 60_000);

  it('resumes through real ApiGateway HTTP and records the escape paths', async () => {
    const { ApiGateway } = await import('../../../Gateway.js');
    const { agentPlannerService } = await import('../agentPlannerService.js');
    const { redriveAgentTask } = await import('../agentTaskDispatchService.js');
    const { default: queue } = await import('../../../queues/aiQueue.js');
    const { initWorker } = await import('../../../workers/aiWorker.js');
    const app = express();
    app.use(express.json());
    ApiGateway.getInstance().initializeRoutes(app);
    const token = jwt.sign(
      {
        id: userId,
        email: `${userId}@example.test`,
        organizationId,
        organization_id: organizationId,
        role: 'OWNER',
      },
      process.env.JWT_SECRET!,
      { algorithm: 'HS256' }
    );
    const auth = { Authorization: `Bearer ${token}` };
    const create = await request(app)
      .post('/api/ai/agent-plan')
      .set(auth)
      .send({
        title: 'Day 165 HTTP fixture',
        draft: true,
        steps: [
          {
            toolName: 'create_task',
            toolInput: { title: 'Day 165 HTTP local fixture' },
            requiresApproval: true,
          },
        ],
      });
    expect(create.status).toBe(201);
    planId = create.body.plan.id;

    const queueEvents = new QueueEvents('ai-tasks', { connection: queue.opts.connection as never });
    await queueEvents.waitUntilReady();
    const worker = initWorker();
    const original = agentPlannerService.executeBackgroundPlan.bind(agentPlannerService);
    const execution = vi
      .spyOn(agentPlannerService, 'executeBackgroundPlan')
      .mockImplementation(async (payload) => {
        const current = await agentPlannerService.getPlan(payload.planId);
        if (current?.steps[0]?.approvedAt) {
          return agentPlannerService.executePlan(payload.planId, async () => ({
            createdLocally: true,
          }));
        }
        return original(payload);
      });
    try {
      const run = await request(app)
        .post(`/api/ai/agent-plan/${planId}/run`)
        .set(auth)
        .send({ idempotencyKey: `run-${tag}` });
      expect(run.status).toBe(200);
      expect(run.body.dispatch).toBe('enqueued');
      let receipts = (
        await pool.query(
          `SELECT receipt_id,status,dispatch_key,bull_job_id FROM ai_agent_job_receipts WHERE plan_id=$1 ORDER BY created_at`,
          [planId]
        )
      ).rows;
      await (await queue.getJob(receipts[0].bull_job_id))!.waitUntilFinished(queueEvents, 30_000);
      const checkpointPlan = await agentPlannerService.getPlan(planId);
      const checkpointStep = (
        await pool.query(
          `SELECT step_index,status FROM ai_agent_plan_steps WHERE plan_id=$1 ORDER BY step_index`,
          [planId]
        )
      ).rows;
      receipts = (
        await pool.query(
          `SELECT receipt_id,status,dispatch_key,bull_job_id FROM ai_agent_job_receipts WHERE plan_id=$1 ORDER BY created_at`,
          [planId]
        )
      ).rows;
      expect(checkpointPlan?.status).toBe('awaiting_approval');
      expect(receipts[0].status).not.toBe('SUCCEEDED');

      const approve = await request(app)
        .post(`/api/ai/agent-plan/${planId}/approve-step`)
        .set(auth)
        .send({ stepIndex: 0 });
      expect(approve.status).toBe(200);
      expect(approve.body.dispatch).toBe('enqueued');
      receipts = (
        await pool.query(
          `SELECT receipt_id,status,dispatch_key,bull_job_id FROM ai_agent_job_receipts WHERE plan_id=$1 ORDER BY created_at`,
          [planId]
        )
      ).rows;
      expect(receipts).toHaveLength(2);
      await (await queue.getJob(receipts[1].bull_job_id))!.waitUntilFinished(queueEvents, 30_000);

      const runAgain = await request(app)
        .post(`/api/ai/agent-plan/${planId}/run`)
        .set(auth)
        .send({});
      const approveAgain = await request(app)
        .post(`/api/ai/agent-plan/${planId}/approve-step`)
        .set(auth)
        .send({ stepIndex: 0 });
      expect(runAgain.status).toBe(409);
      expect(approveAgain.status).toBe(409);
      await expect(redriveAgentTask(receipts[0].receipt_id, userId)).rejects.toThrow(
        'AGENT_DISPATCH_NOT_REDRIVABLE'
      );
      if (process.env.DAY165_HTTP_EVIDENCE_FILE) {
        writeFileSync(
          process.env.DAY165_HTTP_EVIDENCE_FILE,
          JSON.stringify(
            {
              create: { status: create.status, body: create.body },
              run: { status: run.status, body: run.body },
              checkpoint: {
                plan: checkpointPlan && {
                  status: checkpointPlan.status,
                  currentStepIndex: checkpointPlan.currentStepIndex,
                },
                steps: checkpointStep,
                receipts: [receipts[0]],
              },
              approve: { status: approve.status, body: approve.body, receipts },
              runAgain: { status: runAgain.status, body: runAgain.body },
              approveAgain: { status: approveAgain.status, body: approveAgain.body },
            },
            null,
            2
          )
        );
      }
    } finally {
      execution.mockRestore();
      await worker?.close();
      await queueEvents.close();
    }
  }, 60_000);
});
