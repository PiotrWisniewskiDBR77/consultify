/**
 * INI-005 follow-up — two more closed bypasses, lighter coverage:
 *
 *  1. `InitiativeController.unblockInitiative` (POST /:id/unblock) — commit
 *     9239ef96a5. Previously a raw `UPDATE initiatives SET status='executing'`
 *     with NO transition validation, NO GO/NO-GO check, NO row lock, NO
 *     audit-history row, and — critically — NO check that the initiative was
 *     even BLOCKED to begin with. Now a thin adapter over the canonical
 *     `executeInitiativeTransition` engine with `expectedCurrentStatus:
 *     'BLOCKED'` (the disambiguation guard, since EXECUTING is reachable from
 *     both SCHEDULED-via-START and BLOCKED-via-UNBLOCK) plus the same
 *     GOVERNANCE_DECISION_MAKING currency check used everywhere else.
 *
 *  2. `/timeline-update` on BOTH `executionControl.routes.ts` (legacy,
 *     mounted at /api/execution-control) and `v8/execution-control.routes.ts`
 *     (mounted at /api/v8/execution-control) — commit 8d19f0678a. Previously
 *     `{field:'status', value:'EXECUTING'}` was accepted and did a raw
 *     `UPDATE initiatives SET status = ?` with zero transition/gate/audit
 *     enforcement. Both now reject `field:'status'` with 400
 *     TIMELINE_UPDATE_STATUS_FORBIDDEN before ever touching the DB.
 *
 * Real router + real auth + real Postgres. Fixtures use the reversible
 * `odbior--ini005--` prefix; cleaned up in `afterAll`.
 */
import express, { type Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { mintToken, pgClient } from './harness.js';
import { SEED, seed } from './seed.mjs';

const PREFIX = 'odbior--ini005--unblk--';
const ORG_A = SEED.ORG_ID;
const PROJECT_ID = `${PREFIX}project`;
const USER_SPONSOR = `${PREFIX}user-sponsor`;

async function withDb<T>(fn: (c: any) => Promise<T>): Promise<T> {
  const c = pgClient();
  await c.connect();
  try {
    return await fn(c);
  } finally {
    await c.end();
  }
}

async function insertInitiative(id: string, status: string): Promise<void> {
  await withDb(async (c) => {
    await c.query(
      `INSERT INTO initiatives (id, organization_id, project_id, name, title, status, owner_business_id, created_by, planned_start_date, planned_end_date, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $4, $5, $6, $6, '2026-01-01', '2026-12-01', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, execution_started_at = NULL`,
      [id, ORG_A, PROJECT_ID, `${PREFIX}${id}`, status, SEED.USER_ID]
    );
  });
}

async function insertDecision(id: string, initiativeId: string, status: string): Promise<void> {
  await withDb(async (c) => {
    await c.query(
      `INSERT INTO decisions (id, organization_id, initiative_id, title, type, decision_maker_id, created_by, status, pmo_domain, deadline, decided_at, created_at)
       VALUES ($1, $2, $3, $4, 'GOVERNANCE', $5, $5, $6, 'GOVERNANCE_DECISION_MAKING', '2026-12-31T00:00:00.000Z', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status`,
      [id, ORG_A, initiativeId, `${PREFIX}decision ${id}`, SEED.USER_ID, status]
    );
  });
}

async function getInitiative(id: string): Promise<{ status: string } | null> {
  return withDb(async (c) => {
    const r = await c.query(`SELECT status FROM initiatives WHERE id = $1`, [id]);
    return r.rows[0] ?? null;
  });
}

async function countStatusHistory(initiativeId: string): Promise<number> {
  return withDb(async (c) => {
    const r = await c.query(
      `SELECT COUNT(*)::int AS n FROM initiative_status_history WHERE initiative_id = $1`,
      [initiativeId]
    );
    return r.rows[0]?.n ?? 0;
  });
}

let unblockApp: Express;
let legacyTimelineApp: Express;
let v8TimelineApp: Express;
let sponsorToken: string;
let adminToken: string;

beforeAll(async () => {
  await seed();
  adminToken = mintToken();
  sponsorToken = mintToken({ id: USER_SPONSOR, email: `${PREFIX}sponsor@acceptance.local` });

  await withDb(async (c) => {
    await c.query(
      `INSERT INTO projects (id, organization_id, name, status, created_at, updated_at)
       VALUES ($1, $2, $3, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT (id) DO NOTHING`,
      [PROJECT_ID, ORG_A, `${PREFIX}project`]
    );
    await c.query(
      `INSERT INTO users (id, organization_id, email, password, role, status, first_name, last_name, created_at)
       VALUES ($1, $2, $3, 'x', 'TEAM_MEMBER', 'active', 'Odbior', 'INI005', CURRENT_TIMESTAMP)
       ON CONFLICT (id) DO NOTHING`,
      [USER_SPONSOR, ORG_A, `${PREFIX}sponsor@acceptance.local`]
    );
    await c.query(
      `INSERT INTO organization_members (id, organization_id, user_id, role, status, created_at)
       VALUES ($1, $2, $3, 'MEMBER', 'ACTIVE', CURRENT_TIMESTAMP)
       ON CONFLICT (organization_id, user_id) DO NOTHING`,
      [`${PREFIX}mem-sponsor`, ORG_A, USER_SPONSOR]
    );
    await c.query(
      `INSERT INTO project_members (id, project_id, user_id, project_role)
       VALUES ($1, $2, $3, 'SPONSOR')
       ON CONFLICT DO NOTHING`,
      [`${PREFIX}pm-sponsor`, PROJECT_ID, USER_SPONSOR]
    );
  });

  // App 1: real initiatives router (unblock endpoint), same mount as canonical suite.
  const { verifyToken } = await import('../../server/src/middleware/auth.middleware.js');
  const initiativesRouter = (await import('../../server/src/routes/pmo/initiatives.routes.js'))
    .default;
  unblockApp = express();
  unblockApp.use(express.json({ limit: '5mb' }));
  unblockApp.use('/api/initiatives', verifyToken as any, initiativesRouter);

  // App 2: legacy executionControl.routes.ts — mounts its OWN verifyToken/
  // isAuthenticated/requireOrgRole('admin') per-route (see Gateway.ts mount:
  // `app.use('/api/execution-control', deprecationHeader(...), executionControlRoutes)`
  // — no external verifyToken wrapper), so mount it bare here too.
  const legacyExecutionControlRoutes = (await import('../../server/src/routes/executionControl.routes.js'))
    .default;
  legacyTimelineApp = express();
  legacyTimelineApp.use(express.json({ limit: '5mb' }));
  legacyTimelineApp.use('/api/execution-control', legacyExecutionControlRoutes);

  // App 3: v8/execution-control.routes.ts — this router's own handlers call
  // getV8Context(req), populated by attachV8Context; requireV8OrgContext
  // mirrors the real v8Router chain (server/src/routes/v8/index.ts) minus
  // v8OrgGate (per-org V8 feature-flag gate — not needed to prove the
  // TIMELINE_UPDATE_STATUS_FORBIDDEN lockdown itself, and would otherwise
  // require seeding a v8 feature-flag row unrelated to this fix).
  const { requireV8OrgContext, attachV8Context } = await import(
    '../../server/src/middleware/v8Auth.middleware.js'
  );
  const v8ExecutionControlRoutes = (await import('../../server/src/routes/v8/execution-control.routes.js'))
    .default;
  v8TimelineApp = express();
  v8TimelineApp.use(express.json({ limit: '5mb' }));
  v8TimelineApp.use(
    '/api/v8/execution-control',
    verifyToken as any,
    requireV8OrgContext,
    attachV8Context,
    v8ExecutionControlRoutes
  );
}, 60_000);

afterAll(async () => {
  await withDb(async (c) => {
    await c.query(`DELETE FROM initiative_status_history WHERE initiative_id LIKE $1`, [`${PREFIX}%`]);
    await c.query(`DELETE FROM initiative_history WHERE initiative_id LIKE $1`, [`${PREFIX}%`]);
    await c.query(`DELETE FROM decisions WHERE initiative_id LIKE $1`, [`${PREFIX}%`]);
    await c.query(`DELETE FROM execution_audit_log WHERE initiative_id LIKE $1`, [`${PREFIX}%`]);
    await c.query(`DELETE FROM initiatives WHERE id LIKE $1`, [`${PREFIX}%`]);
    await c.query(`DELETE FROM project_members WHERE id LIKE $1`, [`${PREFIX}%`]);
    await c.query(`DELETE FROM organization_members WHERE id LIKE $1`, [`${PREFIX}%`]);
    await c.query(`DELETE FROM users WHERE id LIKE $1`, [`${PREFIX}%`]);
    await c.query(`DELETE FROM projects WHERE id = $1`, [PROJECT_ID]);
  });
});

describe('INI-005 — unblockInitiative (POST /:id/unblock)', () => {
  it('BLOCKED + current approved GO decision + PROJECT_SPONSOR role → 200 EXECUTING with audit rows', async () => {
    const id = `${PREFIX}unblock-happy`;
    await insertInitiative(id, 'BLOCKED');
    await insertDecision(`${id}-decision`, id, 'approved');

    const res = await request(unblockApp)
      .post(`/api/initiatives/${id}/unblock`)
      .set('Authorization', `Bearer ${sponsorToken}`)
      .send({ reason: 'rework complete' });

    expect(res.status).toBe(200);
    expect(res.body.newStatus).toBe('EXECUTING');
    const row = await getInitiative(id);
    expect(row?.status).toBe('EXECUTING');
    expect(await countStatusHistory(id)).toBe(1);
  });

  it('BLOCKED but no current GO decision → 400 GATE_DECISION_REQUIRED, not the old unconditional bypass', async () => {
    const id = `${PREFIX}unblock-nodecision`;
    await insertInitiative(id, 'BLOCKED');
    const res = await request(unblockApp)
      .post(`/api/initiatives/${id}/unblock`)
      .set('Authorization', `Bearer ${sponsorToken}`)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.rule).toBe('GATE_DECISION_REQUIRED');
    const row = await getInitiative(id);
    expect(row?.status).toBe('BLOCKED');
  });

  it('SCHEDULED (not BLOCKED) → 400 UNEXPECTED_CURRENT_STATUS — old bypass let ANY status jump straight to EXECUTING', async () => {
    const id = `${PREFIX}unblock-notblocked`;
    await insertInitiative(id, 'SCHEDULED');
    await insertDecision(`${id}-decision`, id, 'approved');
    const res = await request(unblockApp)
      .post(`/api/initiatives/${id}/unblock`)
      .set('Authorization', `Bearer ${sponsorToken}`)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.rule).toBe('UNEXPECTED_CURRENT_STATUS');
    const row = await getInitiative(id);
    expect(row?.status).toBe('SCHEDULED');
    expect(await countStatusHistory(id)).toBe(0);
  });
});

describe('INI-005 — /timeline-update lockdown (legacy executionControl.routes.ts, /api/execution-control)', () => {
  it('field:"status" → 400 TIMELINE_UPDATE_STATUS_FORBIDDEN, status genuinely unchanged in DB', async () => {
    const id = `${PREFIX}timeline-legacy`;
    await insertInitiative(id, 'SCHEDULED');

    const res = await request(legacyTimelineApp)
      .post('/api/execution-control/timeline-update')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ initiativeId: id, field: 'status', value: 'EXECUTING' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('TIMELINE_UPDATE_STATUS_FORBIDDEN');

    const row = await getInitiative(id);
    expect(row?.status).toBe('SCHEDULED'); // verified via direct DB query, not just the HTTP code
  });

  it('a genuinely allowed field (progress) still works — lockdown is scoped to status only', async () => {
    const id = `${PREFIX}timeline-legacy-allowed`;
    await insertInitiative(id, 'SCHEDULED');
    const res = await request(legacyTimelineApp)
      .post('/api/execution-control/timeline-update')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ initiativeId: id, field: 'progress', value: '42' });
    expect(res.status).toBe(200);
  });
});

describe('INI-005 — /timeline-update lockdown (v8 execution-control.routes.ts, /api/v8/execution-control)', () => {
  it('field:"status" → 400 TIMELINE_UPDATE_STATUS_FORBIDDEN, status genuinely unchanged in DB', async () => {
    const id = `${PREFIX}timeline-v8`;
    await insertInitiative(id, 'SCHEDULED');

    const res = await request(v8TimelineApp)
      .post('/api/v8/execution-control/timeline-update')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ initiativeId: id, field: 'status', value: 'EXECUTING' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('TIMELINE_UPDATE_STATUS_FORBIDDEN');

    const row = await getInitiative(id);
    expect(row?.status).toBe('SCHEDULED');
  });
});
