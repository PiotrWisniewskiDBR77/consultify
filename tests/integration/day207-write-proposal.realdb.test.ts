/** @vitest-environment node */
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';

import express from 'express';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from './_helpers/assertRealPostgres.js';

const NO_RETRY = { retry: 0 } as const;
const databaseUrl = process.env.DATABASE_URL ?? '';
const artifactPath =
  process.env.DAY207_REALDB_ARTIFACT ||
  '/private/tmp/cx-day207-write-proposal-artefakty/day207-realdb.json';

describe('Day207 WRITE proposal — ApiGateway/JWT/Postgres', NO_RETRY, () => {
  const organizationId = randomUUID();
  const userId = randomUUID();
  // FIX-207b (decyzja właściciela 2026-08-31): drugi użytkownik, DLA którego
  // czat prosi o zadanie (`assignee_id` w narzędziu `create_task`) —
  // odróżnia "kto zatwierdza" (userId, autor/reporter) od "kto jest
  // właścicielem zadania" (assigneeUserId), żeby bramka punktu 4 mogła
  // dowieść, że atrybucja właściciela faktycznie dociera do wiersza i do
  // widoku My Work tej drugiej osoby, a nie tylko do autora.
  const assigneeUserId = randomUUID();
  const projectId = randomUUID();
  const pool = new Pool({ connectionString: databaseUrl });
  const app = express();
  let authorization = '';
  let assigneeAuthorization = '';
  let actionId = '';

  beforeAll(async () => {
    await assertRealPostgresTestEnvironment();
    process.env.INTERNAL_TOOLS_ENABLED = 'true';
    process.env.INTERNAL_TOOLS_ALLOWED_EMAIL_DOMAINS = 'test.invalid';
    const [{ ApiGateway }, { default: config }] = await Promise.all([
      import('../../server/src/Gateway.js'),
      import('../../server/src/config/Config.js'),
    ]);
    app.use(express.json());
    ApiGateway.getInstance().initializeRoutes(app);
    // Fresh Day207 migration replay exposes a pre-existing schema drift: the
    // policy engine reads this column but the baseline does not create it.
    // Keep the product guard untouched (Z12); make the disposable fixture
    // explicit and report the drift instead of silently mocking the policy.
    await pool.query(
      `ALTER TABLE projects ADD COLUMN IF NOT EXISTS governance_settings TEXT DEFAULT '{}'`
    );
    await pool.query(`INSERT INTO organizations(id,name,status) VALUES($1,$1,'active')`, [
      organizationId,
    ]);
    await pool.query(
      `INSERT INTO users(id,organization_id,email,password,role,status,email_verified)
       VALUES($1,$2,$3,'unused','OWNER','active',1)`,
      [userId, organizationId, `day207-${userId}@test.invalid`]
    );
    await pool.query(
      `INSERT INTO users(id,organization_id,email,password,role,status,email_verified)
       VALUES($1,$2,$3,'unused','MEMBER','active',1)`,
      [assigneeUserId, organizationId, `day207-assignee-${assigneeUserId}@test.invalid`]
    );
    await pool.query(
      `INSERT INTO organization_members(id,organization_id,user_id,role,status)
       VALUES($1,$2,$3,'OWNER','ACTIVE')`,
      [randomUUID(), organizationId, userId]
    );
    await pool.query(
      `INSERT INTO organization_members(id,organization_id,user_id,role,status)
       VALUES($1,$2,$3,'MEMBER','ACTIVE')`,
      [randomUUID(), organizationId, assigneeUserId]
    );
    await pool.query(
      `INSERT INTO projects(id,organization_id,name,status,owner_id)
       VALUES($1,$2,'Day207 proposal project','active',$3)`,
      [projectId, organizationId, userId]
    );
    await pool.query(
      `INSERT INTO project_ai_settings(project_id,ai_role) VALUES($1,'OPERATOR')`,
      [projectId]
    );
    await pool.query(
      `INSERT INTO ai_policies(id,organization_id,name,policy_level,max_policy_level)
       VALUES($1,$2,'Day207 policy','ASSISTED','ASSISTED')`,
      [randomUUID(), organizationId]
    );
    authorization = `Bearer ${jwt.sign(
      {
        id: userId,
        userId,
        organizationId,
        organization_id: organizationId,
        role: 'OWNER',
        email: `day207-${userId}@test.invalid`,
      },
      config.JWT_SECRET,
      { expiresIn: '10m', jwtid: randomUUID() }
    )}`;
    assigneeAuthorization = `Bearer ${jwt.sign(
      {
        id: assigneeUserId,
        userId: assigneeUserId,
        organizationId,
        organization_id: organizationId,
        role: 'MEMBER',
        email: `day207-assignee-${assigneeUserId}@test.invalid`,
      },
      config.JWT_SECRET,
      { expiresIn: '10m', jwtid: randomUUID() }
    )}`;
  }, 30_000);

  afterAll(async () => {
    await pool.query(
      `DELETE FROM ai_run_events WHERE run_id IN
       (SELECT run_id FROM ai_run_ledger WHERE organization_id=$1)`,
      [organizationId]
    );
    await pool.query(`DELETE FROM ai_run_ledger WHERE organization_id=$1`, [organizationId]);
    await pool.query(`DELETE FROM tasks WHERE organization_id=$1`, [organizationId]);
    await pool.query(`DELETE FROM decision_impacts WHERE decision_id IN (SELECT id FROM decisions WHERE organization_id=$1)`, [organizationId]);
    await pool.query(`DELETE FROM decision_history WHERE decision_id IN (SELECT id FROM decisions WHERE organization_id=$1)`, [organizationId]);
    await pool.query(`DELETE FROM decisions WHERE organization_id=$1`, [organizationId]);
    await pool.query(`DELETE FROM ai_actions WHERE organization_id=$1`, [organizationId]);
    await pool.query(`DELETE FROM project_ai_settings WHERE project_id=$1`, [projectId]);
    await pool.query(`DELETE FROM ai_policies WHERE organization_id=$1`, [organizationId]);
    await pool.query(`DELETE FROM projects WHERE organization_id=$1`, [organizationId]);
    await pool.query(`DELETE FROM organization_members WHERE organization_id=$1`, [organizationId]);
    await pool.query(`DELETE FROM users WHERE organization_id=$1`, [organizationId]);
    await pool.query(`DELETE FROM organizations WHERE id=$1`, [organizationId]);
    await pool.end();
    const pgModule = await import('../../server/src/database/PostgresDatabase.js');
    await (pgModule as unknown as { closePool?: () => Promise<void> }).closePool?.();
  });

  it('injected create_task call persists only a pending proposal', async () => {
    const { default: executor } = await import('../../server/src/services/aiActionExecutor.js');
    const before = await pool.query(
      `SELECT count(*)::int AS count FROM tasks WHERE organization_id=$1`,
      [organizationId]
    );
    const proposal = await executor.requestChatToolProposal({
      toolName: 'create_task',
      // FIX-207b: assignee_id (snake_case — matches the real chat tool's
      // declared JSON schema, services/ai/toolDefinitions.ts:482) requests a
      // DIFFERENT owner than the requester, so pkt 4 below can prove
      // attribution reaches the actual assignee, not just the approver.
      args: {
        title: 'Day207 approved task, assigned',
        description: 'RealPG proof',
        assignee_id: assigneeUserId,
      },
      userId,
      organizationId,
      projectId,
    });
    actionId = proposal.actionId;
    const action = await pool.query(
      `SELECT id,status,action_type,draft_content FROM ai_actions WHERE id=$1`,
      [actionId]
    );
    const afterProposal = await pool.query(
      `SELECT count(*)::int AS count FROM tasks WHERE organization_id=$1`,
      [organizationId]
    );
    expect(proposal).toMatchObject({ success: true, requiresApproval: true, status: 'PENDING' });
    expect(action.rows[0]).toMatchObject({ status: 'PENDING', action_type: 'CREATE_DRAFT_TASK' });
    expect(afterProposal.rows[0].count).toBe(before.rows[0].count);
  });

  // FIX-207 pkt 1 (ODBIOR_207.md) + FIX-207b (decyzja właściciela 2026-08-31):
  // pierwsza runda failowała tu jawnie (brak kanonicznego Runtime-v1 writera
  // dla zadania spoza inicjatywy). Właściciel rozstrzygnął: to ten sam obiekt
  // biznesowy co ręczne zadanie w My Work, więc idzie TĄ SAMĄ drogą —
  // `createPersonalTask()` (server/src/services/personalTask/
  // createPersonalTaskService.ts), wyodrębnioną z jedynego dotąd wołającego,
  // `POST /api/my-work/personal-tasks`. Ten test dowodzi realnym Postgresem/
  // HTTP/JWT, że zatwierdzone zadanie z czatu FIZYCZNIE POWSTAJE, z pełną
  // atrybucją (organizacja/autor=reporter_id/właściciel=assignee_id/projekt/
  // prowieniencja), a nie że po prostu "coś" zostało zapisane.
  it('real HTTP approval and execution creates the task via the shared My Work writer, fully attributed', async () => {
    const approve = await request(app)
      .patch(`/api/ai/actions/${actionId}/approve`)
      .set('Authorization', authorization)
      .send({});
    expect(approve.status).toBe(200);
    expect(approve.body).toMatchObject({ success: true, status: 'APPROVED' });

    const execute = await request(app)
      .post(`/api/ai/actions/${actionId}/execute`)
      .set('Authorization', authorization)
      .send({});
    expect(execute.status).toBe(200);
    expect(execute.body).toMatchObject({ success: true, status: 'EXECUTED' });

    const taskReadback = await pool.query(
      `SELECT id,title,status,source,assignee_id,reporter_id,organization_id,project_id,
              source_type,source_id
       FROM tasks WHERE organization_id=$1 AND source_id=$2`,
      [organizationId, actionId]
    );
    const actionReadback = await pool.query(
      `SELECT id,status,approved_by,approved_at,executed_at FROM ai_actions WHERE id=$1`,
      [actionId]
    );
    const ledgerReadback = await pool.query(
      `SELECT event_type,status FROM ai_run_events WHERE action_id=$1 ORDER BY created_at,id`,
      [actionId]
    );
    expect(taskReadback.rows).toHaveLength(1);
    // `source` (distinct from `source_type`/`source_id`) is a plain My Work
    // column with a schema DEFAULT of 'manual' — createPersonalTask() never
    // writes it (neither does the manual /personal-tasks route, its only
    // other caller), so it stays at the default even for an AI-originated
    // task. That is the correct, intended effect of "same writer, same
    // contract": provenance now lives in source_type/source_id
    // ('ai_chat_proposal'/<actionId>, asserted below), a strictly more
    // precise signal than the old writer's blunt source='ai' literal.
    expect(taskReadback.rows[0]).toMatchObject({
      title: 'Day207 approved task, assigned',
      source: 'manual',
      assignee_id: assigneeUserId,
      reporter_id: userId,
      organization_id: organizationId,
      project_id: projectId,
      source_type: 'ai_chat_proposal',
      source_id: actionId,
    });
    expect(actionReadback.rows[0]).toMatchObject({ status: 'EXECUTED', approved_by: userId });
    expect(ledgerReadback.rows.map((row) => row.event_type)).toEqual(
      expect.arrayContaining([
        'proposal_pending_review',
        'proposal_approved',
        'execution_started',
        'execution_succeeded',
      ])
    );
    writeFileSync(
      artifactPath,
      JSON.stringify(
        {
          coordinates: { database: `127.0.0.1:${new URL(databaseUrl).port}`, gateway: 'in-process ApiGateway', jwt: true },
          note: 'FIX-207b: execution now succeeds via the shared My Work writer (createPersonalTask) — same writer as manual My Work task creation.',
          http: {
            approve: { method: 'PATCH', path: `/api/ai/actions/${actionId}/approve`, status: approve.status },
            execute: { method: 'POST', path: `/api/ai/actions/${actionId}/execute`, status: execute.status },
          },
          action: actionReadback.rows[0],
          tasks: taskReadback.rows,
          ledger: ledgerReadback.rows,
        },
        null,
        2
      )
    );
  });

  // FIX-207b pkt 4 (NOWA BRAMKA): nie wystarczy, że wiersz istnieje w bazie —
  // musi być widoczny DOKŁADNIE tą samą drogą, którą My Work pokazuje własne
  // zadania (GET /api/my-work/personal-tasks, uwierzytelniony jako
  // WŁAŚCICIEL zadania — buildPersonalTaskOwnerScope filtruje po
  // `assignee_id = <zalogowany użytkownik>`, my-work.routes.ts:715). Jeśli
  // atrybucja właściciela się zepsuje (np. zadanie zawsze trafia do autora
  // zamiast do poproszonego assignee), ten test nie znajdzie zadania na
  // liście — czerwień, nie tylko brak wiersza w `tasks`.
  it("the created task is visible to its owner through My Work's own list endpoint", async () => {
    const list = await request(app)
      .get('/api/my-work/personal-tasks')
      .set('Authorization', assigneeAuthorization)
      .send();
    expect(list.status).toBe(200);
    const match = (list.body as any[]).find((t) => t.title === 'Day207 approved task, assigned');
    expect(match).toBeTruthy();
    expect(match).toMatchObject({ title: 'Day207 approved task, assigned' });
  });

  // FIX-207b (decyzja właściciela 2026-08-31) — analogiczny dowód dla
  // create_decision: zatwierdzona propozycja idzie przez DecisionController.
  // createDecision WYWOŁANY BEZPOŚREDNIO (server/src/services/
  // aiActionExecutor.ts:_executeCreateDecision, callExpressHandler) — dosłownie
  // ten sam kod, który POST /api/decisions uruchamia dla ręcznego tworzenia
  // decyzji w My Work (DecisionsPanel.tsx i inne, przez Api.createDecision).
  it('real HTTP approval and execution creates the decision via DecisionController.createDecision directly', async () => {
    const { default: executor } = await import('../../server/src/services/aiActionExecutor.js');
    const decisionProposal = await executor.requestChatToolProposal({
      toolName: 'create_decision',
      args: { title: 'Day207b approved decision', description: 'RealPG decision proof' },
      userId,
      organizationId,
      projectId,
    });
    expect(decisionProposal).toMatchObject({ success: true, status: 'PENDING' });

    const approve = await request(app)
      .patch(`/api/ai/actions/${decisionProposal.actionId}/approve`)
      .set('Authorization', authorization)
      .send({});
    expect(approve.status).toBe(200);
    expect(approve.body).toMatchObject({ success: true, status: 'APPROVED' });

    const execute = await request(app)
      .post(`/api/ai/actions/${decisionProposal.actionId}/execute`)
      .set('Authorization', authorization)
      .send({});
    expect(execute.status).toBe(200);
    expect(execute.body).toMatchObject({ success: true, status: 'EXECUTED' });

    const decisionReadback = await pool.query(
      `SELECT id,title,status,organization_id,project_id,decision_maker_id,created_by,
              source_type,source_id
       FROM decisions WHERE organization_id=$1 AND source_id=$2`,
      [organizationId, decisionProposal.actionId]
    );
    expect(decisionReadback.rows).toHaveLength(1);
    expect(decisionReadback.rows[0]).toMatchObject({
      title: 'Day207b approved decision',
      status: 'pending',
      organization_id: organizationId,
      project_id: projectId,
      decision_maker_id: userId,
      created_by: userId,
      source_type: 'ai_chat_proposal',
      source_id: decisionProposal.actionId,
    });
  });
});
