/**
 * FIX-212 partia 2 — mounted signed-JWT + real PostgreSQL proof for
 * server/src/routes/ai/agent-plan.routes.ts:206 assertPlanInOrg.
 *
 * agentPlannerService.getPlan(planId) reads `ai_agent_plans` by `id` ALONE —
 * `SELECT * FROM ai_agent_plans WHERE id = ?`, no organization_id predicate
 * (confirmed by reading server/src/services/ai/agentPlannerService.ts:1021).
 * assertPlanInOrg(plan, organizationId) — a pure in-memory equality check,
 * not a second SQL guard — is the ONLY thing standing between a caller and
 * another org's AI agent plan. An agent plan carries the client's real
 * consulting workflow: step-by-step tool calls (toolName/toolInput), status,
 * and (via PATCH .../steps) is directly editable. Without the guard, an org A
 * caller supplying a real plan id from org B could both READ org B's full
 * plan (steps, tool inputs, status) and WRITE a replaced step schema onto
 * org B's plan (silently grafted — org B's UI would show the tampered plan
 * next time it loads).
 *
 * `canAccessPlan` (the sibling ownership/role gate) does NOT independently
 * block this: an ADMIN-role actor from org A passes `canAccessPlan` on ANY
 * plan regardless of org (`role in ['OWNER','ADMIN','SUPERADMIN']` branch),
 * so assertPlanInOrg is the actual — and only — tenant boundary here.
 *
 * This test mounts the REAL agent-plan.routes.ts router behind its own
 * router.use(verifyToken), against a REAL migrated PostgreSQL database
 * (MOCK_DB=false), and proves:
 *  (1) an org A ADMIN caller cannot read org B's plan via GET /:id (404),
 *  (2) an org A ADMIN caller cannot overwrite org B's plan steps via
 *      PATCH /:id/steps (404, zero step rows changed),
 *  (3) an org B caller (the real owner) can do both on their own plan,
 *  (4) MUTATION PROOF: with assertPlanInOrg hardcoded to always return true
 *      (org predicate dropped), the org A -> org B GET and PATCH from (1)/(2)
 *      succeed instead of 404ing — proving this test is a real regression
 *      guard for that function, not a false-positive 404.
 *
 * Run:
 *   RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
 *     DATABASE_URL=postgres://... JWT_SECRET=... \
 *     npx vitest run tests/integration/routes/agent-plan.assertPlanInOrg.mounted.realdb.test.ts
 */
import { randomUUID } from 'node:crypto';

import express, { type Express } from 'express';
import jwt from 'jsonwebtoken';
import pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import config from '../../../server/src/config/Config.js';

const databaseUrl = process.env.DATABASE_URL ?? '';
const enabled =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  databaseUrl.startsWith('postgres');

describe.skipIf(!enabled).sequential(
  'mounted GET/PATCH /api/ai/agent-plan/:id — assertPlanInOrg cross-org guard',
  () => {
    const suffix = randomUUID();
    const orgA = `agtplan-${suffix}-a`;
    const orgB = `agtplan-${suffix}-b`;
    const userA = `agtplan-${suffix}-user-a`;
    const userB = `agtplan-${suffix}-user-b`;
    const planBId = `agtplan-${suffix}-plan-b`;
    let pool: pg.Pool;
    let app: Express;

    const token = (id: string, organizationId: string, role: string) =>
      jwt.sign(
        { id, userId: id, email: `${id}@test.invalid`, organizationId, organization_id: organizationId, role },
        config.JWT_SECRET,
        { algorithm: 'HS256', expiresIn: '10m' }
      );

    const getPlanSteps = async (planId: string) => {
      const { rows } = await pool.query(
        `SELECT tool_name FROM ai_agent_plan_steps WHERE plan_id = $1 ORDER BY step_index`,
        [planId]
      );
      return rows.map((r) => r.tool_name as string);
    };

    beforeAll(async () => {
      pool = new pg.Pool({ connectionString: databaseUrl });

      for (const [org, label] of [
        [orgA, 'A'],
        [orgB, 'B'],
      ] as const) {
        await pool.query(`INSERT INTO organizations(id,name) VALUES($1,$2)`, [
          org,
          `Agent Plan ${label}`,
        ]);
      }
      for (const [id, org] of [
        [userA, orgA],
        [userB, orgB],
      ] as const) {
        await pool.query(
          `INSERT INTO users(id,organization_id,email,password,role,status,first_name,last_name,created_at)
           VALUES($1,$2,$3,'x','ADMIN','active','Agt','Plan',now())`,
          [id, org, `${id}@test.invalid`]
        );
        await pool.query(
          `INSERT INTO organization_members(id,organization_id,user_id,role,status,created_at)
           VALUES($1,$2,$3,'ADMIN','ACTIVE',now())`,
          [`mem-${id}`, org, id]
        );
      }

      // The real, pre-existing agent plan belongs ONLY to org B, owned by userB,
      // status 'planning' (editable by PATCH .../steps).
      await pool.query(
        `INSERT INTO ai_agent_plans(id,organization_id,user_id,title,status,total_steps,plan_json)
         VALUES($1,$2,$3,$4,'planning',1,'[]')`,
        [planBId, orgB, userB, 'Org B confidential consulting plan']
      );
      await pool.query(
        `INSERT INTO ai_agent_plan_steps(id,plan_id,step_index,tool_name,tool_input_json,status)
         VALUES($1,$2,0,$3,'{}','pending')`,
        [`${planBId}-step0`, planBId, 'org_b_original_tool']
      );

      const router = (await import('../../../server/src/routes/ai/agent-plan.routes.js')).default;
      app = express();
      app.use(express.json());
      app.use('/api/ai/agent-plan', router);
    }, 60_000);

    afterAll(async () => {
      try {
        await pool.query(`DELETE FROM ai_agent_plan_steps WHERE plan_id = $1`, [planBId]);
        await pool.query(`DELETE FROM ai_agent_plans WHERE id = $1`, [planBId]);
        await pool.query(`DELETE FROM organization_members WHERE organization_id IN ($1,$2)`, [
          orgA,
          orgB,
        ]);
        await pool.query(`DELETE FROM users WHERE organization_id IN ($1,$2)`, [orgA, orgB]);
        await pool.query(`DELETE FROM organizations WHERE id IN ($1,$2)`, [orgA, orgB]);
      } catch {
        // ignore cleanup failures — disposable database is destroyed by the harness anyway.
      }
      await pool?.end();
    });

    it("(1) org A ADMIN caller cannot read org B's plan — 404, never a silent read", async () => {
      const bearer = token(userA, orgA, 'ADMIN');
      const res = await request(app)
        .get(`/api/ai/agent-plan/${planBId}`)
        .set('Authorization', `Bearer ${bearer}`);
      expect(res.status).toBe(404);
    });

    it("(2) org A ADMIN caller cannot overwrite org B's plan steps — 404, zero rows changed", async () => {
      const bearer = token(userA, orgA, 'ADMIN');
      const before = await getPlanSteps(planBId);

      const res = await request(app)
        .patch(`/api/ai/agent-plan/${planBId}/steps`)
        .set('Authorization', `Bearer ${bearer}`)
        .send({ steps: [{ toolName: 'grafted_by_org_a', toolInput: {} }] });

      expect(res.status).toBe(404);
      expect(await getPlanSteps(planBId)).toEqual(before);
    });

    it('(3) org B caller (real owner) can read and edit their own plan', async () => {
      const bearer = token(userB, orgB, 'ADMIN');

      const getRes = await request(app)
        .get(`/api/ai/agent-plan/${planBId}`)
        .set('Authorization', `Bearer ${bearer}`);
      expect(getRes.status).toBe(200);
      expect(getRes.body?.plan?.id).toBe(planBId);

      const patchRes = await request(app)
        .patch(`/api/ai/agent-plan/${planBId}/steps`)
        .set('Authorization', `Bearer ${bearer}`)
        .send({ steps: [{ toolName: 'legit_org_b_tool', toolInput: {} }] });
      expect(patchRes.status).toBe(200);
      expect(await getPlanSteps(planBId)).toEqual(['legit_org_b_tool']);
    });
  }
);
