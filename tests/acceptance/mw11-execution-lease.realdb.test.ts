import { mintToken, pgClient } from './harness.js';
import { SEED, seed } from './seed.mjs';

import express, { type Express } from 'express';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { ExecutionLease } from '../../server/src/services/ai/agentPlannerService.js';

const PREFIX = 'odbior--mw11-lease--';
const planIds: string[] = [];
const identityIds = [`${PREFIX}member`, `${PREFIX}admin`, `${PREFIX}foreign`];
const foreignOrgId = `${PREFIX}foreign-org`;
let app: Express;
let ownerToken: string;
const testDir = path.dirname(fileURLToPath(import.meta.url));

async function expireLease(planId: string): Promise<void> {
  const client = pgClient();
  await client.connect();
  try {
    await client.query(
      `UPDATE ai_agent_plans SET execution_lease_expires_at = CURRENT_TIMESTAMP - INTERVAL '1 second'
       WHERE id = $1`,
      [planId]
    );
  } finally {
    await client.end();
  }
}

async function createPlan(
  title: string,
  options: { requiresApproval?: boolean } = {}
) {
  const { agentPlannerService } = await import(
    '../../server/src/services/ai/agentPlannerService.js'
  );
  const plan = await agentPlannerService.createPlan({
    organizationId: SEED.ORG_ID,
    userId: SEED.USER_ID,
    title: `${PREFIX}${title}`,
    steps: [
      {
        toolName: 'acceptance_side_effect',
        toolInput: { payload: title },
        requiresApproval: options.requiresApproval ?? false,
      },
    ],
  });
  planIds.push(plan.id);
  return plan;
}

async function seedIdentity(
  id: string,
  organizationId: string,
  role: 'OWNER' | 'ADMIN' | 'MEMBER'
): Promise<void> {
  const client = pgClient();
  await client.connect();
  try {
    const now = new Date().toISOString();
    if (organizationId === foreignOrgId) {
      await client.query(
        `INSERT INTO organizations (id, name, plan, status, is_active, created_at)
         VALUES ($1, $2, 'enterprise', 'active', 1, $3)
         ON CONFLICT (id) DO NOTHING`,
        [organizationId, 'MW11 foreign tenant', now]
      );
    }
    await client.query(
      `INSERT INTO users
         (id, organization_id, email, password, role, status, first_name, last_name, created_at)
       VALUES ($1, $2, $3, 'not-used-in-acceptance', $4, 'active', 'MW11', 'Fixture', $5)
       ON CONFLICT (id) DO NOTHING`,
      [id, organizationId, `${id}@example.test`, role === 'MEMBER' ? 'USER' : role, now]
    );
    await client.query(
      `INSERT INTO organization_members
         (id, organization_id, user_id, role, status, created_at)
       VALUES ($1, $2, $3, $4, 'ACTIVE', $5)
       ON CONFLICT DO NOTHING`,
      [`${id}-membership`, organizationId, id, role, now]
    );
  } finally {
    await client.end();
  }
}

beforeAll(async () => {
  await seed();
  await seedIdentity(`${PREFIX}member`, SEED.ORG_ID, 'MEMBER');
  await seedIdentity(`${PREFIX}admin`, SEED.ORG_ID, 'ADMIN');
  await seedIdentity(`${PREFIX}foreign`, foreignOrgId, 'OWNER');
  const router = (await import('../../server/src/routes/ai/agent-plan.routes.js')).default;
  app = express();
  app.use(express.json());
  app.use('/api/ai/agent-plan', router);
  ownerToken = mintToken();
});

afterAll(async () => {
  const client = pgClient();
  await client.connect();
  try {
    await client.query('DROP TRIGGER IF EXISTS mw11_fail_result_write ON ai_agent_plan_steps');
    await client.query('DROP FUNCTION IF EXISTS mw11_fail_result_write()');
    await client.query('DROP TABLE IF EXISTS mw11_result_write_failures');
    if (planIds.length) {
      await client.query('DELETE FROM ai_agent_plan_steps WHERE plan_id = ANY($1::text[])', [
        planIds,
      ]);
      await client.query('DELETE FROM ai_agent_plans WHERE id = ANY($1::text[])', [planIds]);
    }
    await client.query('DELETE FROM organization_members WHERE user_id = ANY($1::text[])', [identityIds]);
    await client.query('DELETE FROM users WHERE id = ANY($1::text[])', [identityIds]);
    await client.query('DELETE FROM organizations WHERE id = $1', [foreignOrgId]);
  } finally {
    await client.end();
  }
});

describe('MW-11 durable execution lease and fencing — real PostgreSQL', () => {
  it('MW11-A concurrency: two executes produce one active owner and one side effect', async () => {
    const { agentPlannerService } = await import(
      '../../server/src/services/ai/agentPlannerService.js'
    );
    const plan = await createPlan('A-concurrency');
    let calls = 0;
    const executor = async () => {
      calls += 1;
      await new Promise((resolve) => setTimeout(resolve, 50));
      return { receipt: 'A' };
    };

    const [a, b] = await Promise.all([
      agentPlannerService.executePlan(plan.id, executor),
      agentPlannerService.executePlan(plan.id, executor),
    ]);
    expect(calls).toBe(1);
    expect([a.status, b.status]).toContain('completed');

    const client = pgClient();
    await client.connect();
    try {
      const row = await client.query(
        `SELECT status, execution_fencing_token, execution_owner_token
         FROM ai_agent_plans WHERE id = $1`,
        [plan.id]
      );
      expect(row.rows[0]).toMatchObject({
        status: 'completed',
        execution_fencing_token: '1',
        execution_owner_token: null,
      });
    } finally {
      await client.end();
    }
  });

  it('MW11-B crash before tool: live lease blocks B, expired lease is reclaimed', async () => {
    const { agentPlannerService } = await import(
      '../../server/src/services/ai/agentPlannerService.js'
    );
    const plan = await createPlan('B-crash-before-tool');
    const leaseA = await agentPlannerService.claimExecution(plan.id, 'worker-A');
    expect(leaseA?.fencingToken).toBe(1);
    expect(await agentPlannerService.claimExecution(plan.id, 'worker-B-early')).toBeNull();

    await expireLease(plan.id);
    const result = await agentPlannerService.executePlan(plan.id, async () => ({ recovered: true }));
    expect(result.status).toBe('completed');

    const client = pgClient();
    await client.connect();
    try {
      const row = await client.query(
        'SELECT execution_fencing_token FROM ai_agent_plans WHERE id = $1',
        [plan.id]
      );
      expect(Number(row.rows[0].execution_fencing_token)).toBe(2);
    } finally {
      await client.end();
    }
  });

  it('MW11-C crash after tool: stable operation key lets an idempotent owner suppress replay', async () => {
    const { agentPlannerService } = await import(
      '../../server/src/services/ai/agentPlannerService.js'
    );
    const plan = await createPlan('C-crash-after-tool');
    await agentPlannerService.claimExecution(plan.id, 'worker-A');
    const operationKey = `agent-plan:${plan.id}:step:${plan.steps[0].id}`;
    const durableExternalReceipts = new Map<string, { externalId: string }>();
    durableExternalReceipts.set(operationKey, { externalId: 'external-once' });
    let externalMutations = 1; // worker A performed it, then died before result_json

    await expireLease(plan.id);
    const recovered = await agentPlannerService.executePlan(
      plan.id,
      async (_tool, _input, execution) => {
        const existing = durableExternalReceipts.get(execution!.operationKey);
        if (existing) return existing;
        externalMutations += 1;
        const receipt = { externalId: `external-${externalMutations}` };
        durableExternalReceipts.set(execution!.operationKey, receipt);
        return receipt;
      }
    );

    expect(externalMutations).toBe(1);
    expect(recovered.status).toBe('completed');
    expect(recovered.steps[0].result).toEqual({ externalId: 'external-once' });
  });

  it('MW11-D stale-owner fencing: reclaimed worker wins and A cannot persist result', async () => {
    const { AgentExecutionLeaseLostError, agentPlannerService } = await import(
      '../../server/src/services/ai/agentPlannerService.js'
    );
    const plan = await createPlan('D-stale-owner');
    let releaseA!: () => void;
    const waitA = new Promise<void>((resolve) => {
      releaseA = resolve;
    });
    const workerA = agentPlannerService.executePlan(plan.id, async () => {
      await waitA;
      return { worker: 'A-stale' };
    });

    const client = pgClient();
    await client.connect();
    try {
      await expect
        .poll(async () => {
          const row = await client.query(
            'SELECT execution_fencing_token FROM ai_agent_plans WHERE id = $1',
            [plan.id]
          );
          return Number(row.rows[0]?.execution_fencing_token || 0);
        })
        .toBe(1);
    } finally {
      await client.end();
    }

    await expireLease(plan.id);
    let releaseB!: () => void;
    const waitB = new Promise<void>((resolve) => {
      releaseB = resolve;
    });
    const workerB = agentPlannerService.executePlan(plan.id, async () => {
      await waitB;
      return { worker: 'B' };
    });
    const observer = pgClient();
    await observer.connect();
    try {
      await expect
        .poll(async () => {
          const row = await observer.query(
            'SELECT execution_fencing_token FROM ai_agent_plans WHERE id = $1',
            [plan.id]
          );
          return Number(row.rows[0]?.execution_fencing_token || 0);
        })
        .toBe(2);
    } finally {
      await observer.end();
    }
    releaseA();
    await expect(workerA).rejects.toBeInstanceOf(AgentExecutionLeaseLostError);

    const fenced = await agentPlannerService.getPlan(plan.id);
    expect(fenced?.steps[0].result).toBeUndefined();
    releaseB();
    expect((await workerB).status).toBe('completed');

    const fresh = await agentPlannerService.getPlan(plan.id);
    expect(fresh?.steps[0].result).toEqual({ worker: 'B' });
  });

  it('MW11-E heartbeat: renew blocks takeover and stale token cannot renew after reclaim', async () => {
    const { AgentExecutionLeaseLostError, agentPlannerService } = await import(
      '../../server/src/services/ai/agentPlannerService.js'
    );
    const plan = await createPlan('E-heartbeat');
    const leaseA = (await agentPlannerService.claimExecution(plan.id, 'heartbeat-A'))!;
    await agentPlannerService.renewExecutionLease(leaseA);
    expect(await agentPlannerService.claimExecution(plan.id, 'heartbeat-B-early')).toBeNull();

    await expireLease(plan.id);
    const leaseB = (await agentPlannerService.claimExecution(plan.id, 'heartbeat-B'))!;
    expect(leaseB.fencingToken).toBe(leaseA.fencingToken + 1);
    await expect(agentPlannerService.renewExecutionLease(leaseA)).rejects.toBeInstanceOf(
      AgentExecutionLeaseLostError
    );
    await agentPlannerService.renewExecutionLease(leaseB);
  });

  it('MW11-F durable read-back: approval actor, payload and result survive a new connection', async () => {
    const { agentPlannerService } = await import(
      '../../server/src/services/ai/agentPlannerService.js'
    );
    const plan = await createPlan('F-durable', { requiresApproval: true });
    const beforeApproval = await agentPlannerService.executePlan(plan.id, async () => {
      throw new Error('must not execute before approval');
    });
    expect(beforeApproval.status).toBe('awaiting_approval');
    await agentPlannerService.approveStep(plan.id, 0, SEED.USER_ID);
    const completed = await agentPlannerService.executePlan(plan.id, async (_tool, input) => ({
      acceptedPayload: input,
    }));
    expect(completed.status).toBe('completed');

    const client = pgClient();
    await client.connect();
    try {
      const row = await client.query(
        `SELECT approved_by, approved_at, tool_input_json, result_json
         FROM ai_agent_plan_steps WHERE plan_id = $1 AND step_index = 0`,
        [plan.id]
      );
      expect(row.rows[0].approved_by).toBe(SEED.USER_ID);
      expect(row.rows[0].approved_at).toBeTruthy();
      expect(JSON.parse(row.rows[0].tool_input_json)).toEqual({ payload: 'F-durable' });
      expect(JSON.parse(row.rows[0].result_json)).toEqual({
        acceptedPayload: { payload: 'F-durable' },
      });
    } finally {
      await client.end();
    }
    const reopened = await agentPlannerService.getPlan(plan.id);
    expect(reopened?.steps[0]).toMatchObject({
      approvedBy: SEED.USER_ID,
      result: { acceptedPayload: { payload: 'F-durable' } },
    });
  });

  it('MW11-G result-write failure: no terminal success and retry remains recoverable', async () => {
    const { AgentExecutionLeaseLostError, agentPlannerService } = await import(
      '../../server/src/services/ai/agentPlannerService.js'
    );
    const plan = await createPlan('G-result-failure');
    const client = pgClient();
    await client.connect();
    try {
      await client.query('CREATE TABLE IF NOT EXISTS mw11_result_write_failures(plan_id TEXT PRIMARY KEY)');
      await client.query(`
        CREATE OR REPLACE FUNCTION mw11_fail_result_write() RETURNS trigger AS $$
        BEGIN
          IF NEW.result_json IS NOT NULL AND EXISTS (
            SELECT 1 FROM mw11_result_write_failures f WHERE f.plan_id = NEW.plan_id
          ) THEN
            RAISE EXCEPTION 'injected result write failure';
          END IF;
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql`);
      await client.query('DROP TRIGGER IF EXISTS mw11_fail_result_write ON ai_agent_plan_steps');
      await client.query(`CREATE TRIGGER mw11_fail_result_write BEFORE UPDATE ON ai_agent_plan_steps
                          FOR EACH ROW EXECUTE FUNCTION mw11_fail_result_write()`);
      await client.query('INSERT INTO mw11_result_write_failures(plan_id) VALUES ($1)', [plan.id]);
    } finally {
      await client.end();
    }

    await expect(
      agentPlannerService.executePlan(plan.id, async () => ({ shouldPersist: true }))
    ).rejects.toBeInstanceOf(AgentExecutionLeaseLostError);
    const afterFailure = await agentPlannerService.getPlan(plan.id);
    expect(afterFailure?.status).toBe('executing');
    expect(afterFailure?.steps[0].status).toBe('running');
    expect(afterFailure?.steps[0].result).toBeUndefined();

    const cleanup = pgClient();
    await cleanup.connect();
    try {
      await cleanup.query('DELETE FROM mw11_result_write_failures WHERE plan_id = $1', [plan.id]);
    } finally {
      await cleanup.end();
    }
    await expireLease(plan.id);
    const recovered = await agentPlannerService.executePlan(plan.id, async () => ({
      persistedAfterRecovery: true,
    }));
    expect(recovered.status).toBe('completed');
  });

  it('MW11-H ownership: member and cross-tenant fail closed; owner/admin policy remains explicit', async () => {
    const { agentPlannerService } = await import(
      '../../server/src/services/ai/agentPlannerService.js'
    );
    const planning = await createPlan('H-planning');
    const approval = await createPlan('H-approval', { requiresApproval: true });
    await agentPlannerService.executePlan(approval.id, async () => ({ impossible: true }));

    const member = mintToken({
      id: `${PREFIX}member`,
      email: `${PREFIX}member@example.test`,
      role: 'MEMBER',
    });
    const admin = mintToken({ id: `${PREFIX}admin`, role: 'ADMIN' });
    const foreign = mintToken({
      id: `${PREFIX}foreign`,
      organizationId: `${PREFIX}foreign-org`,
      organization_id: `${PREFIX}foreign-org`,
      role: 'OWNER',
    });

    for (const token of [member, foreign]) {
      expect(
        (await request(app).get(`/api/ai/agent-plan/${planning.id}`).set('Authorization', `Bearer ${token}`)).status
      ).toBe(404);
      expect(
        (
          await request(app)
            .post(`/api/ai/agent-plan/${planning.id}/run`)
            .set('Authorization', `Bearer ${token}`)
            .send({})
        ).status
      ).toBe(404);
      expect(
        (
          await request(app)
            .post(`/api/ai/agent-plan/${approval.id}/approve-step`)
            .set('Authorization', `Bearer ${token}`)
            .send({ stepIndex: 0 })
        ).status
      ).toBe(404);
    }

    expect(
      (await request(app).get(`/api/ai/agent-plan/${planning.id}`).set('Authorization', `Bearer ${ownerToken}`)).status
    ).toBe(200);
    expect(
      (await request(app).get(`/api/ai/agent-plan/${planning.id}`).set('Authorization', `Bearer ${admin}`)).status
    ).toBe(200);
  });
});

describe('MW-11 migration 939', () => {
  it('is fresh-schema compatible and replay-safe', async () => {
    const client = pgClient();
    await client.connect();
    const schema = `mw11_migration_${Date.now()}`;
    try {
      await client.query('BEGIN');
      await client.query(`CREATE SCHEMA ${schema}`);
      await client.query(`SET LOCAL search_path TO ${schema}`);
      await client.query('CREATE TABLE ai_agent_plans (id TEXT PRIMARY KEY, status TEXT NOT NULL)');
      const migration = readFileSync(
        path.resolve(testDir, '../../server/migrations/939_ai_agent_plan_execution_lease.sql'),
        'utf8'
      );
      await client.query(migration);
      await client.query(migration);
      const columns = await client.query(
        `SELECT column_name FROM information_schema.columns
         WHERE table_schema = $1 AND table_name = 'ai_agent_plans'`,
        [schema]
      );
      expect(columns.rows.map((row) => row.column_name)).toEqual(
        expect.arrayContaining([
          'execution_owner_token',
          'execution_fencing_token',
          'execution_lease_expires_at',
          'execution_heartbeat_at',
        ])
      );
    } finally {
      await client.query('ROLLBACK');
      await client.end();
    }
  });
});
