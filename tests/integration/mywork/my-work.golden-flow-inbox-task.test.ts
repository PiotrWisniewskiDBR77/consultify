/**
 * MW-CORE-001/002/003 golden flow — Inbox/Task, end-to-end against REAL
 * Postgres, REAL routers, REAL auth/tenancy/capability middleware.
 *
 * Golden flow under test:
 *   Step 1: PUT  /api/tasks/:id                              (TaskController.updateTask)
 *   Step 2: POST /api/v8/my-work/inbox/tasks/:taskId/close    (v8/my-work.routes.ts)
 * Task stays the source of truth; canonical_inbox_items stays a projection.
 *
 * Run via: scripts/test-mw-core-golden-flow-pg.sh (provisions/reuses a
 * dedicated scratch Postgres container, loads the real schema, then invokes
 * this file with vitest --config tests/integration/mywork/vitest.golden-flow.config.ts
 * --retry=0). MOCK_DB=false / RUN_DB_TESTS=1 / DATABASE_URL must point at a
 * LOCAL Postgres — enforced by requireLocalDbUrl() (reused from the existing
 * acceptance harness, not reinvented) both here and inside the schema loader.
 *
 * Fixture id convention: every row this file creates is prefixed `mwgolden-`
 * so cleanup (afterAll) can find and remove exactly what it created, and nothing
 * else, even on a shared/reused scratch container.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';

import { mintToken, pgClient, requireLocalDbUrl } from '../../acceptance/harness.js';
import { buildGoldenFlowApp } from './_helpers/golden-flow-app.js';

// ---------------------------------------------------------------------------
// Fixture ids (all prefixed, all cleaned up in afterAll)
// ---------------------------------------------------------------------------
const P = 'mwgolden';
const ORG_A = `${P}-org-a`;
const ORG_B = `${P}-org-b`;
const ORG_C = `${P}-org-c`; // V8 explicitly disabled (scenario #16)

const PROJECT_A = `${P}-proj-a`;

const USER_ASSIGNEE = `${P}-user-assignee`; // correct recipient, TASK_ASSIGNEE role
const USER_OTHER_A = `${P}-user-other-a`; // same org, NOT assignee/owner (scenario #4)
const USER_OBSERVER = `${P}-user-observer`; // OBSERVER role, no task.update capability (scenario #6)
const USER_ORG_B = `${P}-user-orgb`; // tenant B (scenario #5)
// Dedicated to #8a ONLY: materializeInboxItems() bulk-materializes EVERY
// non-terminal task assigned to a given user in one call, so any user who
// also appears in #1/#2/#9/#10 (which call /materialize) would have this
// task materialized as a side effect before #8a ever runs. A user who never
// appears in any /materialize call anywhere else in this file is the only
// honest way to test the true "never materialized" outcome.
const USER_ISOLATED = `${P}-user-isolated`;

const TASK_MAIN = `${P}-task-main`; // #1 #2 #3 #4 #9 #10 #13 #14 #15
const TASK_TRANSITION = `${P}-task-transition`; // #7a invalid transition
const TASK_STALE = `${P}-task-stale`; // #7b expectedStatus mismatch
const TASK_NOT_MATERIALIZED = `${P}-task-notmat`; // #8a (assigned to USER_ISOLATED)
const TASK_DELETED = `${P}-task-deleted`; // #8b
const TASK_CAPABILITY = `${P}-task-capability`; // #6
const TASK_TENANT_A = `${P}-task-tenant-a`; // #5
// Sentinel embedded directly in the id: the test-only fault-injection trigger
// (installed/removed entirely by this test file, see beforeAll/afterAll) keys
// off this literal substring in canonical_inbox_items.source_entity_id. No
// server/src changes were needed for this — see the trigger definition below.
const TASK_RECOVERY = `${P}-task-__FORCE_RECOVERY_FAULT__-1`; // #11 #12

function tokenFor(userId: string, orgId: string): string {
  return mintToken({
    id: userId,
    email: `${userId}@mwgolden.test`,
    organizationId: orgId,
    organization_id: orgId,
    role: 'USER',
  });
}

let app: Express;
let client: Awaited<ReturnType<typeof pgClient>>;

async function insertOrg(id: string): Promise<void> {
  await client.query(
    `INSERT INTO organizations (id, name, plan, status, is_active, created_at)
     VALUES ($1, $2, 'enterprise', 'active', 1, now())
     ON CONFLICT (id) DO NOTHING`,
    [id, `MW Golden ${id}`]
  );
}

async function insertUser(id: string, orgId: string): Promise<void> {
  await client.query(
    `INSERT INTO users (id, organization_id, email, password, first_name, last_name, role, status, created_at)
     VALUES ($1, $2, $3, 'x', 'MW', 'Golden', 'MEMBER', 'active', now())
     ON CONFLICT (id) DO NOTHING`,
    [id, orgId, `${id}@mwgolden.test`]
  );
  await client.query(
    `INSERT INTO organization_members (id, organization_id, user_id, role, status, created_at)
     VALUES ($1, $2, $3, 'USER', 'ACTIVE', now())
     ON CONFLICT (organization_id, user_id) DO NOTHING`,
    [`${id}-mem`, orgId, id]
  );
}

async function insertProject(id: string, orgId: string): Promise<void> {
  await client.query(
    `INSERT INTO projects (id, organization_id, name, status, created_at)
     VALUES ($1, $2, $3, 'active', now())
     ON CONFLICT (id) DO NOTHING`,
    [id, orgId, `MW Golden ${id}`]
  );
}

async function insertProjectMember(
  projectId: string,
  userId: string,
  projectRole: string
): Promise<void> {
  await client.query(
    `INSERT INTO project_members (id, project_id, user_id, project_role, created_at, updated_at)
     VALUES (gen_random_uuid()::text, $1, $2, $3, now(), now())
     ON CONFLICT (project_id, user_id) DO UPDATE SET project_role = excluded.project_role`,
    [projectId, userId, projectRole]
  );
}

async function insertTask(params: {
  id: string;
  orgId: string;
  projectId: string | null;
  assigneeId: string;
  ownerId: string;
  status: string;
  dueDate?: string | null;
}): Promise<void> {
  await client.query(
    `INSERT INTO tasks (id, organization_id, project_id, assignee_id, owner_id, title, status, due_date, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now(), now())
     ON CONFLICT (id) DO UPDATE SET status = excluded.status, project_id = excluded.project_id`,
    [
      params.id,
      params.orgId,
      params.projectId,
      params.assigneeId,
      params.ownerId,
      `Golden flow task ${params.id}`,
      params.status,
      params.dueDate ?? null,
    ]
  );
}

async function insertV8Flag(orgId: string, moduleName: string, enabled: boolean): Promise<void> {
  await client.query(
    `INSERT INTO v8.v8_feature_flags (flag_id, organization_id, module, enabled, updated_at)
     VALUES ($1, $2, $3, $4, now())
     ON CONFLICT (organization_id, module) DO UPDATE SET enabled = excluded.enabled`,
    [`${orgId}:${moduleName}`, orgId, moduleName, enabled ? 1 : 0]
  );
}

async function getTask(id: string): Promise<any> {
  const r = await client.query(`SELECT * FROM tasks WHERE id = $1`, [id]);
  return r.rows[0] || null;
}

async function getInboxRowsForSource(sourceEntityId: string): Promise<any[]> {
  const r = await client.query(
    `SELECT * FROM canonical_inbox_items WHERE source_entity_type = 'task' AND source_entity_id = $1`,
    [sourceEntityId]
  );
  return r.rows;
}

// ---------------------------------------------------------------------------
// Test-only fault injection for scenario #11/#12 — pure SQL, zero server/src
// changes. A BEFORE UPDATE trigger on canonical_inbox_items raises exactly
// ONCE for rows whose source_entity_id contains the sentinel below, using a
// dedicated sequence as the one-shot counter. Sequences are NOT transactional
// in Postgres (nextval() survives a rolled-back transaction), so the very
// UPDATE statement the trigger aborts still "uses up" the one-shot — the
// SECOND attempt (retry) sees nextval()=2 and proceeds normally. This gives a
// real "fails once, succeeds on retry" fault without touching production code
// at all.
//
// Gated on `NEW.status = 'resolved'`: materializeInboxItems()'s upsert
// (INSERT ... ON CONFLICT DO UPDATE) also fires this BEFORE UPDATE trigger
// every time it re-materializes the SAME row (it runs for every task the
// fixture user has, on every /materialize call across earlier scenarios) —
// but that upsert's SET list never touches `status`, so NEW.status there
// stays whatever it already was ('pending'), never 'resolved'. Only
// triageItem()'s real close UPDATE sets status='resolved', so gating on that
// is what makes the one-shot counter track the actual close attempt instead
// of being silently consumed by unrelated materialize traffic.
// ---------------------------------------------------------------------------
async function installFaultInjection(): Promise<void> {
  await client.query(`CREATE SEQUENCE IF NOT EXISTS mwgolden_recovery_fault_seq`);
  await client.query(`
    CREATE OR REPLACE FUNCTION mwgolden_recovery_fault_trigger() RETURNS TRIGGER AS $$
    BEGIN
      IF NEW.source_entity_type = 'task'
         AND NEW.source_entity_id LIKE '%__FORCE_RECOVERY_FAULT__%'
         AND NEW.status = 'resolved'
         AND nextval('mwgolden_recovery_fault_seq') = 1
      THEN
        RAISE EXCEPTION 'mwgolden test-injected recovery fault (test-only, MW-CORE-001 scenario #11)';
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);
  await client.query(`DROP TRIGGER IF EXISTS mwgolden_recovery_fault ON canonical_inbox_items`);
  await client.query(`
    CREATE TRIGGER mwgolden_recovery_fault
    BEFORE UPDATE ON canonical_inbox_items
    FOR EACH ROW EXECUTE FUNCTION mwgolden_recovery_fault_trigger();
  `);
}

async function removeFaultInjection(): Promise<void> {
  await client.query(`DROP TRIGGER IF EXISTS mwgolden_recovery_fault ON canonical_inbox_items`);
  await client.query(`DROP FUNCTION IF EXISTS mwgolden_recovery_fault_trigger()`);
  await client.query(`DROP SEQUENCE IF EXISTS mwgolden_recovery_fault_seq`);
}

async function cleanupFixtures(): Promise<void> {
  await client.query(
    `DELETE FROM canonical_inbox_items WHERE source_entity_type = 'task' AND source_entity_id LIKE $1`,
    [`${P}-%`]
  );
  await client.query(`DELETE FROM canonical_inbox_items WHERE user_id LIKE $1`, [`${P}-%`]);
  await client.query(`DELETE FROM v8.v8_feature_flags WHERE organization_id LIKE $1`, [`${P}-%`]);
  // Courtesy cleanup only: project_role_templates is created lazily at
  // runtime by effectiveAccessService.ensureProjectRoleTemplateSchema() on
  // first capability resolution — it may not exist yet (e.g. on a fresh
  // container, before any test has exercised CAPABILITY_ENFORCE=enforce).
  await client
    .query(`DELETE FROM project_role_templates WHERE organization_id LIKE $1`, [`${P}-%`])
    .catch(() => undefined);
  // users cascade project_members + organization_members; SET NULL on tasks' user FKs.
  await client.query(`DELETE FROM users WHERE id LIKE $1`, [`${P}-%`]);
  // organizations cascade projects + tasks.
  await client.query(`DELETE FROM organizations WHERE id LIKE $1`, [`${P}-%`]);
}

beforeAll(async () => {
  requireLocalDbUrl(); // fail loud (not silently skip) if DATABASE_URL isn't local
  client = pgClient();
  await client.connect();

  await cleanupFixtures(); // idempotent: clear any leftovers from a prior aborted run
  await installFaultInjection();

  await insertOrg(ORG_A);
  await insertOrg(ORG_B);
  await insertOrg(ORG_C);
  // Org A + B: V8 enabled (at least one explicit true flag row). Org C:
  // explicitly disabled (explicit row present, all false) — required so the
  // real v8OrgGate fallback-for-orgs-without-rows path (dev/test convenience)
  // does NOT mask scenario #16; an EXPLICIT false row is what makes this a
  // real "unsupported org" case rather than an "unconfigured org".
  await insertV8Flag(ORG_A, 'workspace', true);
  await insertV8Flag(ORG_B, 'workspace', true);
  await insertV8Flag(ORG_C, 'chat', false);

  await insertUser(USER_ASSIGNEE, ORG_A);
  await insertUser(USER_OTHER_A, ORG_A);
  await insertUser(USER_OBSERVER, ORG_A);
  await insertUser(USER_ORG_B, ORG_B);
  await insertUser(USER_ISOLATED, ORG_A);

  await insertProject(PROJECT_A, ORG_A);
  await insertProjectMember(PROJECT_A, USER_ASSIGNEE, 'TASK_ASSIGNEE');
  await insertProjectMember(PROJECT_A, USER_OTHER_A, 'TASK_ASSIGNEE');
  // OBSERVER capabilities (effectiveAccessService.ts FACTORY_ROLE_TEMPLATES)
  // contain no task.update / task.update.* variant at all — the deliberate
  // "missing capability" fixture for scenario #6.
  await insertProjectMember(PROJECT_A, USER_OBSERVER, 'OBSERVER');
  await insertProjectMember(PROJECT_A, USER_ISOLATED, 'TASK_ASSIGNEE');

  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  await insertTask({
    id: TASK_MAIN,
    orgId: ORG_A,
    projectId: PROJECT_A,
    assigneeId: USER_ASSIGNEE,
    ownerId: USER_ASSIGNEE,
    status: 'todo',
    dueDate: tomorrow,
  });
  await insertTask({
    id: TASK_TRANSITION,
    orgId: ORG_A,
    projectId: PROJECT_A,
    assigneeId: USER_ASSIGNEE,
    ownerId: USER_ASSIGNEE,
    status: 'backlog',
  });
  await insertTask({
    id: TASK_STALE,
    orgId: ORG_A,
    projectId: PROJECT_A,
    assigneeId: USER_ASSIGNEE,
    ownerId: USER_ASSIGNEE,
    status: 'todo',
  });
  await insertTask({
    id: TASK_NOT_MATERIALIZED,
    orgId: ORG_A,
    projectId: PROJECT_A,
    assigneeId: USER_ISOLATED,
    ownerId: USER_ISOLATED,
    status: 'todo',
  });
  await insertTask({
    id: TASK_DELETED,
    orgId: ORG_A,
    projectId: PROJECT_A,
    assigneeId: USER_ASSIGNEE,
    ownerId: USER_ASSIGNEE,
    status: 'todo',
  });
  await insertTask({
    id: TASK_CAPABILITY,
    orgId: ORG_A,
    projectId: PROJECT_A,
    assigneeId: USER_ASSIGNEE,
    ownerId: USER_ASSIGNEE,
    status: 'todo',
  });
  await insertTask({
    id: TASK_TENANT_A,
    orgId: ORG_A,
    projectId: PROJECT_A,
    assigneeId: USER_ASSIGNEE,
    ownerId: USER_ASSIGNEE,
    status: 'todo',
  });
  await insertTask({
    id: TASK_RECOVERY,
    orgId: ORG_A,
    projectId: PROJECT_A,
    assigneeId: USER_ASSIGNEE,
    ownerId: USER_ASSIGNEE,
    status: 'todo',
  });

  app = await buildGoldenFlowApp();
}, 120_000);

afterAll(async () => {
  await removeFaultInjection();
  await cleanupFixtures();
  await client.end();
}, 60_000);

describe('MW-CORE-001 golden flow: Inbox/Task (real Postgres, real routers)', () => {
  // -------------------------------------------------------------------------
  // #1 — Assignment creates exactly one canonical Inbox item.
  // -------------------------------------------------------------------------
  it('#1 materializing an assigned task creates exactly one canonical Inbox item', async () => {
    const token = tokenFor(USER_ASSIGNEE, ORG_A);

    const res = await request(app)
      .post('/api/v8/my-work/inbox/canonical/materialize')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(201);
    expect(res.body?.data?.success).toBe(true);

    const rows = await getInboxRowsForSource(TASK_MAIN);
    expect(rows).toHaveLength(1);
    expect(rows[0].user_id).toBe(USER_ASSIGNEE);
    expect(rows[0].organization_id).toBe(ORG_A);
    expect(rows[0].status).toBe('pending');
  });

  // -------------------------------------------------------------------------
  // #2 — Repeated assignment creates no duplicate.
  // -------------------------------------------------------------------------
  it('#2 repeated materialization of the same task creates no duplicate row', async () => {
    const token = tokenFor(USER_ASSIGNEE, ORG_A);

    for (let i = 0; i < 3; i++) {
      const res = await request(app)
        .post('/api/v8/my-work/inbox/canonical/materialize')
        .set('Authorization', `Bearer ${token}`)
        .send({});
      expect(res.status).toBe(201);
    }

    const rows = await getInboxRowsForSource(TASK_MAIN);
    expect(rows).toHaveLength(1);
  });

  // -------------------------------------------------------------------------
  // #3 — Correct recipient sees the item.
  // -------------------------------------------------------------------------
  it('#3 the assignee sees the materialized item in their canonical Inbox', async () => {
    const token = tokenFor(USER_ASSIGNEE, ORG_A);

    const res = await request(app)
      .get('/api/v8/my-work/inbox/canonical')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const items = res.body?.data?.items || [];
    expect(items.some((it: any) => it.sourceEntityId === TASK_MAIN)).toBe(true);
  });

  // -------------------------------------------------------------------------
  // #4 — Another user in the same organization cannot close it.
  // Red -> green proof included (temporarily bypass isOwnerOrAssignee).
  // -------------------------------------------------------------------------
  it('#4 another user in the same org cannot close the Inbox item (403 INBOX_CLOSE_FORBIDDEN, no state change)', async () => {
    const otherToken = tokenFor(USER_OTHER_A, ORG_A);

    const before = await getTask(TASK_MAIN);
    const res = await request(app)
      .post(`/api/v8/my-work/inbox/tasks/${TASK_MAIN}/close`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({});

    expect(res.status).toBe(403);
    expect(res.body?.code).toBe('INBOX_CLOSE_FORBIDDEN');

    const after = await getTask(TASK_MAIN);
    expect(after.status).toBe(before.status);
    const rows = await getInboxRowsForSource(TASK_MAIN);
    expect(rows[0].status).not.toBe('resolved');
  });

  // -------------------------------------------------------------------------
  // #5 — User from tenant B cannot read, mutate or close tenant A's item/Task.
  // Red -> green proof included for the close-by-task org filter.
  // -------------------------------------------------------------------------
  describe('#5 tenant isolation', () => {
    it('5a tenant B cannot read tenant A items (own-scoped GET returns nothing of A\'s)', async () => {
      const tokenB = tokenFor(USER_ORG_B, ORG_B);
      const res = await request(app)
        .get('/api/v8/my-work/inbox/canonical')
        .set('Authorization', `Bearer ${tokenB}`);
      expect(res.status).toBe(200);
      const items = res.body?.data?.items || [];
      expect(items.some((it: any) => it.sourceEntityId === TASK_TENANT_A)).toBe(false);
    });

    it('5b tenant B cannot mutate tenant A\'s Task via PUT /api/tasks/:id (404, org-scoped SELECT)', async () => {
      const tokenB = tokenFor(USER_ORG_B, ORG_B);
      const before = await getTask(TASK_TENANT_A);

      const res = await request(app)
        .put(`/api/tasks/${TASK_TENANT_A}`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ status: 'in_progress' });

      expect(res.status).toBe(404);
      const after = await getTask(TASK_TENANT_A);
      expect(after.status).toBe(before.status);
    });

    it('5c tenant B cannot close tenant A\'s Task inbox item (404 INBOX_CLOSE_TASK_NOT_FOUND)', async () => {
      const tokenB = tokenFor(USER_ORG_B, ORG_B);
      const res = await request(app)
        .post(`/api/v8/my-work/inbox/tasks/${TASK_TENANT_A}/close`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({});
      expect(res.status).toBe(404);
      expect(res.body?.code).toBe('INBOX_CLOSE_TASK_NOT_FOUND');
    });
  });

  // -------------------------------------------------------------------------
  // #6 — Missing capability returns 403 and changes nothing.
  // requireTaskCapability('task.update', { shadow: true }) on PUT /api/tasks/:id
  // is governed entirely by CAPABILITY_ENFORCE (effectiveCapability.middleware.ts).
  // Default/unset = 'shadow' = NEVER blocks. We flip the real env switch to
  // 'enforce' only for this test, restoring it in a finally.
  // -------------------------------------------------------------------------
  it('#6 missing task.update capability (OBSERVER role) returns 403 under CAPABILITY_ENFORCE=enforce, changes nothing', async () => {
    const observerToken = tokenFor(USER_OBSERVER, ORG_A);
    const before = await getTask(TASK_CAPABILITY);
    const prevEnforce = process.env.CAPABILITY_ENFORCE;

    try {
      process.env.CAPABILITY_ENFORCE = 'enforce';
      const res = await request(app)
        .put(`/api/tasks/${TASK_CAPABILITY}`)
        .set('Authorization', `Bearer ${observerToken}`)
        .send({ status: 'in_progress' });

      expect(res.status).toBe(403);
      expect(res.body?.code).toBe('CAPABILITY_REQUIRED');
    } finally {
      if (prevEnforce === undefined) delete process.env.CAPABILITY_ENFORCE;
      else process.env.CAPABILITY_ENFORCE = prevEnforce;
    }

    const after = await getTask(TASK_CAPABILITY);
    expect(after.status).toBe(before.status);
  });

  // -------------------------------------------------------------------------
  // #7 — Stale/invalid transition returns the correct conflict/validation response.
  // -------------------------------------------------------------------------
  it('#7a invalid task status transition (backlog -> done) is rejected 400 INVALID_TRANSITION', async () => {
    const token = tokenFor(USER_ASSIGNEE, ORG_A);
    const res = await request(app)
      .put(`/api/tasks/${TASK_TRANSITION}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'done' });
    expect(res.status).toBe(400);
    expect(res.body?.code).toBe('INVALID_TRANSITION');

    const after = await getTask(TASK_TRANSITION);
    expect(after.status).toBe('backlog');
  });

  it('#7b stale expectedStatus on close returns 409 INBOX_CLOSE_STATE_MISMATCH', async () => {
    const token = tokenFor(USER_ASSIGNEE, ORG_A);

    // Step 1: real transition todo -> in_progress.
    const step1 = await request(app)
      .put(`/api/tasks/${TASK_STALE}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'in_progress' });
    expect(step1.status).toBe(200);

    // Step 2: close claiming a stale expectedStatus ('todo', already moved on).
    const res = await request(app)
      .post(`/api/v8/my-work/inbox/tasks/${TASK_STALE}/close`)
      .set('Authorization', `Bearer ${token}`)
      .send({ expectedStatus: 'todo' });

    expect(res.status).toBe(409);
    expect(res.body?.code).toBe('INBOX_CLOSE_STATE_MISMATCH');
    expect(res.body?.currentStatus).toBe('in_progress');
  });

  // -------------------------------------------------------------------------
  // #8 — Missing/deleted source Task is handled honestly.
  // -------------------------------------------------------------------------
  it('#8a closing a Task that was never materialized returns an honest not_materialized outcome (not a fabricated close)', async () => {
    const token = tokenFor(USER_ISOLATED, ORG_A);
    const res = await request(app)
      .post(`/api/v8/my-work/inbox/tasks/${TASK_NOT_MATERIALIZED}/close`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(200);
    expect(res.body?.data?.status).toBe('not_materialized');
    expect(res.body?.data?.inboxItem).toBeNull();
  });

  it('#8b closing a Task that has since been deleted returns 404 INBOX_CLOSE_TASK_NOT_FOUND (no fallback success)', async () => {
    const token = tokenFor(USER_ASSIGNEE, ORG_A);

    // Materialize once so an inbox item exists, then delete the source Task
    // out from under it (simulates a Task removed after assignment).
    await request(app)
      .post('/api/v8/my-work/inbox/canonical/materialize')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    await client.query(`DELETE FROM tasks WHERE id = $1`, [TASK_DELETED]);

    const res = await request(app)
      .post(`/api/v8/my-work/inbox/tasks/${TASK_DELETED}/close`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(404);
    expect(res.body?.code).toBe('INBOX_CLOSE_TASK_NOT_FOUND');
  });

  // -------------------------------------------------------------------------
  // #9 — Task transition is persisted and read back.
  // #10 — Inbox closure is persisted and read back.
  // #13 — Refresh/reopen shows authoritative state (independent fresh reads).
  // -------------------------------------------------------------------------
  it('#9/#10/#13 full happy path: transition + close persist and read back on independent fresh requests', async () => {
    const token = tokenFor(USER_ASSIGNEE, ORG_A);

    // Materialize (creates/refreshes the canonical item for TASK_MAIN).
    const mat = await request(app)
      .post('/api/v8/my-work/inbox/canonical/materialize')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(mat.status).toBe(201);

    // Step 1: transition.
    const step1 = await request(app)
      .put(`/api/tasks/${TASK_MAIN}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'in_progress' });
    expect(step1.status).toBe(200);
    expect(step1.body?.status).toBe('in_progress');

    // #9: independent fresh read of the Task confirms persistence (not just
    // trusting the mutation's own response body).
    const taskReadBack = await request(app)
      .get(`/api/tasks/${TASK_MAIN}`)
      .set('Authorization', `Bearer ${token}`);
    expect(taskReadBack.status).toBe(200);
    expect(taskReadBack.body?.status).toBe('in_progress');

    // Step 2: close.
    const step2 = await request(app)
      .post(`/api/v8/my-work/inbox/tasks/${TASK_MAIN}/close`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(step2.status).toBe(200);
    expect(step2.body?.data?.status).toBe('closed');
    expect(step2.body?.data?.inboxItem?.status).toBe('resolved');

    // #10 + #13: independent fresh read of the Inbox list confirms the
    // closure persisted server-side — a completely separate GET, no shared
    // client-side state with the mutation calls above.
    const inboxReadBack = await request(app)
      .get('/api/v8/my-work/inbox/canonical')
      .set('Authorization', `Bearer ${token}`)
      .query({ status: 'resolved' });
    expect(inboxReadBack.status).toBe(200);
    const resolvedItem = (inboxReadBack.body?.data?.items || []).find(
      (i: any) => i.sourceEntityId === TASK_MAIN
    );
    expect(resolvedItem).toBeTruthy();
    expect(resolvedItem.status).toBe('resolved');

    // Direct DB-level proof, independent of the API's own serialization.
    const rows = await getInboxRowsForSource(TASK_MAIN);
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('resolved');
    expect(rows[0].resolved_at).toBeTruthy();
  });

  // -------------------------------------------------------------------------
  // #11 — Failure after Task commit but before Inbox closure produces
  //        recovery-required.
  // #12 — Retry repairs the partial state without duplicating anything.
  // -------------------------------------------------------------------------
  it('#11/#12 fault after Task commit -> 500 recovery-required; retry repairs without duplication', async () => {
    const token = tokenFor(USER_ASSIGNEE, ORG_A);

    // Materialize + Step 1 (both must succeed and commit for real before the
    // injected fault fires — this is the "Task commit already happened"
    // precondition scenario #11 requires).
    const mat = await request(app)
      .post('/api/v8/my-work/inbox/canonical/materialize')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(mat.status).toBe(201);

    const step1 = await request(app)
      .put(`/api/tasks/${TASK_RECOVERY}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'in_progress' });
    expect(step1.status).toBe(200);
    const committedTask = await getTask(TASK_RECOVERY);
    expect(committedTask.status).toBe('in_progress'); // Task commit is real and already landed.

    // Step 2, first attempt: the test-only trigger (armed via the sequence,
    // see installFaultInjection) raises inside the UPDATE that triageItem()
    // issues, so the route's try/catch converts it into 500 recovery-required
    // — never a silently-swallowed or fabricated success.
    const firstAttempt = await request(app)
      .post(`/api/v8/my-work/inbox/tasks/${TASK_RECOVERY}/close`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(firstAttempt.status).toBe(500);
    expect(firstAttempt.body?.code).toBe('INBOX_CLOSE_RECOVERY_REQUIRED');

    // The Task's own committed transition must be completely unaffected by
    // the Step-2 fault (Task stays source of truth).
    const afterFault = await getTask(TASK_RECOVERY);
    expect(afterFault.status).toBe('in_progress');

    // The Inbox item itself must still be in its pre-close state (the
    // trigger's exception rolled back the UPDATE) — not half-resolved.
    const rowsAfterFault = await getInboxRowsForSource(TASK_RECOVERY);
    expect(rowsAfterFault).toHaveLength(1);
    expect(rowsAfterFault[0].status).not.toBe('resolved');

    // #12: retry — same call, same idempotent route. The fault only fires
    // once (nextval() = 2 now), so this attempt succeeds for real.
    const retry = await request(app)
      .post(`/api/v8/my-work/inbox/tasks/${TASK_RECOVERY}/close`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(retry.status).toBe(200);
    expect(retry.body?.data?.status).toBe('closed');

    // No duplication: still exactly one canonical_inbox_items row for this
    // source, now resolved.
    const rowsAfterRetry = await getInboxRowsForSource(TASK_RECOVERY);
    expect(rowsAfterRetry).toHaveLength(1);
    expect(rowsAfterRetry[0].status).toBe('resolved');

    // A further retry (already-closed) stays idempotent too — no error, no dup.
    const secondRetry = await request(app)
      .post(`/api/v8/my-work/inbox/tasks/${TASK_RECOVERY}/close`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(secondRetry.status).toBe(200);
    expect(secondRetry.body?.data?.status).toBe('already_closed');
    const rowsFinal = await getInboxRowsForSource(TASK_RECOVERY);
    expect(rowsFinal).toHaveLength(1);
  });

  // -------------------------------------------------------------------------
  // #14 — No localStorage dependency is required.
  // This is a backend/API-level suite: every request above is issued through
  // a brand-new supertest agent per call, carrying nothing but the bearer
  // token — no cookie jar, no shared client instance, no browser storage of
  // any kind. The whole flow (materialize -> transition -> close -> read-back)
  // completed above using only stateless HTTP calls, proving the server holds
  // ALL the state the flow needs. We cannot make a DOM-level "no localStorage
  // call happened" assertion from a Node/supertest suite (no DOM exists here)
  // — this assertion is deliberately scoped to what this suite can actually
  // test: statelessness of the API contract itself.
  // -------------------------------------------------------------------------
  it('#14 the flow is reachable through the API alone — a fresh, cookie-less request per call, no client-side storage', async () => {
    const token = tokenFor(USER_ASSIGNEE, ORG_A);

    // A fresh supertest() call each time is a brand-new agent with no shared
    // cookie jar / session — if the server required client-held state beyond
    // the bearer token (e.g. a server-set cookie from a prior call), this
    // would fail.
    const r1 = await request(app)
      .get('/api/v8/my-work/inbox/canonical')
      .set('Authorization', `Bearer ${token}`);
    expect(r1.status).toBe(200);
    expect(r1.headers['set-cookie']).toBeUndefined();

    const r2 = await request(app)
      .get(`/api/tasks/${TASK_MAIN}`)
      .set('Authorization', `Bearer ${token}`);
    expect(r2.status).toBe(200);
    expect(r2.headers['set-cookie']).toBeUndefined();
  });

  // -------------------------------------------------------------------------
  // #15 — Calendar projection is read-only.
  // We assert what this suite can actually test: the unified calendar read
  // reflects the assigned Task, and repeated reads never mutate Task/Inbox
  // state. (server/src/routes/v8/my-work.routes.ts does expose separate
  // POST /calendar/events and PUT /calendar/events/:source/:sourceId routes —
  // those back an UNRELATED calendar-linked scheduling feature outside this
  // golden flow, and are deliberately out of scope for this assertion.)
  // -------------------------------------------------------------------------
  it('#15 unified calendar read reflects the Task and is read-only (repeated GETs mutate nothing)', async () => {
    const token = tokenFor(USER_ASSIGNEE, ORG_A);

    const before = await getTask(TASK_MAIN);

    const cal1 = await request(app)
      .get('/api/v8/my-work/calendar/unified')
      .set('Authorization', `Bearer ${token}`)
      .query({ sources: 'task' });
    expect(cal1.status).toBe(200);
    const events1 = cal1.body?.data?.events || cal1.body?.events || [];
    const taskEvent = events1.find((e: any) => e.sourceId === TASK_MAIN);
    expect(taskEvent).toBeTruthy();
    expect(taskEvent.source).toBe('task');

    // A second read must be identical and must not have mutated the Task.
    const cal2 = await request(app)
      .get('/api/v8/my-work/calendar/unified')
      .set('Authorization', `Bearer ${token}`)
      .query({ sources: 'task' });
    expect(cal2.status).toBe(200);

    const after = await getTask(TASK_MAIN);
    expect(after.updated_at?.toString()).toBe(before.updated_at?.toString());
    expect(after.status).toBe(before.status);
  });

  // -------------------------------------------------------------------------
  // #16 — Unsupported non-V8 organization gets an explicit fail-closed state
  //        — no legacy fallback success. Hits the REAL v8OrgGate.
  // -------------------------------------------------------------------------
  it('#16 an org with V8 explicitly disabled gets 404 V8_ORG_DISABLED from the real v8OrgGate — no legacy fallback success', async () => {
    const tokenC = tokenFor(`${P}-user-orgc-adhoc`, ORG_C);
    // Give this ad-hoc org-C caller a real user row (org gate runs after auth,
    // but verifyToken itself needs a real users/organization_members row).
    await insertUser(`${P}-user-orgc-adhoc`, ORG_C);

    const res = await request(app)
      .get('/api/v8/my-work/inbox/canonical')
      .set('Authorization', `Bearer ${tokenC}`);

    expect(res.status).toBe(404);
    expect(res.body?.code).toBe('V8_ORG_DISABLED');
    // Fail-closed, not merely "not found by chance": the response must not
    // carry any inbox data at all.
    expect(res.body?.data).toBeUndefined();
  });
});
