/**
 * H6.5 — RBAC / org-scope cross-tenant isolation (My Work: Inbox · Tasks · Notatnik).
 *
 * REAL-runtime E2E: local Postgres (full schema) + REAL routers + REAL verifyToken.
 * Two orgs (A, B), each with an owner and private resources. We prove that user A,
 * carrying a genuine signed token for org A, can NEVER read or write org B's
 * resources — every attempt returns 404/403 (or an empty list) and, critically,
 * B's stored rows are never mutated and B's data never leaks in a response body.
 *
 * All fixtures use the reversible `odbior--h65--` prefix and are removed in
 * afterAll. Writes ONLY to the LOCAL Postgres (harness guard enforces this).
 */
import express, { type Express } from 'express';
import jwt from 'jsonwebtoken';
import pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { getJwtSecret, requireLocalDbUrl } from './harness.js';

const P = 'odbior--h65--';

const ORG_A = `${P}org-A`;
const USER_A = `${P}user-A`;
const EMAIL_A = `${P}owner-a@acceptance.local`;

const ORG_B = `${P}org-B`;
const USER_B = `${P}user-B`;
const EMAIL_B = `${P}owner-b@acceptance.local`;

// Org B resource ids (the "foreign" resources user A must never touch).
const B_NOTEBOOK = `${P}nb-B`;
const B_PAGE = `${P}page-B`;
const B_TASK = `${P}task-B`;
const B_BOARD = `${P}board-B`;
const B_FITEM = `${P}fitem-B`;
const B_INBOX = `${P}inbox-B`;
const B_TRIAGE = `${P}triage-B`;

// Org A resource ids (positive-control: A must be able to use its own).
const A_BOARD = `${P}board-A`;
const A_FITEM = `${P}fitem-A`;

function mintTokenFor(userId: string, orgId: string, email: string): string {
  return jwt.sign(
    {
      id: userId,
      email,
      organizationId: orgId,
      organization_id: orgId,
      role: 'OWNER',
    },
    getJwtSecret(),
    { algorithm: 'HS256', expiresIn: '1h' }
  );
}

async function seedTenant(
  c: pg.Client,
  orgId: string,
  userId: string,
  email: string
): Promise<void> {
  const now = new Date().toISOString();
  await c.query(
    `INSERT INTO organizations (id, name, plan, status, is_active, created_at)
     VALUES ($1,$2,'enterprise','active',1,$3) ON CONFLICT (id) DO NOTHING`,
    [orgId, `H65 ${orgId}`, now]
  );
  await c.query(
    `INSERT INTO users (id, organization_id, email, password, role, status, first_name, last_name, created_at)
     VALUES ($1,$2,$3,'x','ADMIN','active','H65','Test',$4) ON CONFLICT (id) DO NOTHING`,
    [userId, orgId, email, now]
  );
  await c.query(
    `INSERT INTO organization_members (id, organization_id, user_id, role, status, created_at)
     SELECT $4,$1,$2,'OWNER','ACTIVE',$3
     WHERE NOT EXISTS (SELECT 1 FROM organization_members WHERE organization_id=$1 AND user_id=$2)`,
    [orgId, userId, now, `${P}mem-${userId}`]
  );
}

function buildApp(myWork: express.Router, inbox: express.Router): Express {
  const app = express();
  app.use(express.json({ limit: '5mb' }));
  // Both routers apply their OWN verifyToken internally (mirrors the real Gateway).
  app.use('/api/my-work', myWork);
  app.use('/api/inbox-v4', inbox);
  return app;
}

describe('H6.5 — cross-org isolation (Inbox · Tasks · Notatnik)', () => {
  let client: pg.Client;
  let app: Express;
  let tokenA: string;

  beforeAll(async () => {
    requireLocalDbUrl();
    client = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();

    await seedTenant(client, ORG_A, USER_A, EMAIL_A);
    await seedTenant(client, ORG_B, USER_B, EMAIL_B);

    // ── Org B resources (foreign to user A) ──
    await client.query(
      `INSERT INTO notebooks (id, owner_user_id, organization_id, title, scope, created_at, updated_at)
       VALUES ($1,$2,$3,'B secret notebook','private',NOW(),NOW()) ON CONFLICT (id) DO NOTHING`,
      [B_NOTEBOOK, USER_B, ORG_B]
    );
    await client.query(
      `INSERT INTO notebook_pages (id, owner_user_id, organization_id, notebook_id, visibility, title, content_json, content_text, tags_json, created_at, updated_at)
       VALUES ($1,$2,$3,$4,'private','B-SECRET-PAGE','{}','B confidential body','[]',NOW(),NOW())
       ON CONFLICT (id) DO NOTHING`,
      [B_PAGE, USER_B, ORG_B, B_NOTEBOOK]
    );
    await client.query(
      `INSERT INTO tasks (id, organization_id, title, status, priority, assignee_id, reporter_id, task_type, created_at, updated_at)
       VALUES ($1,$2,'B-SECRET-TASK','todo','high',$3,$3,'personal',NOW(),NOW())
       ON CONFLICT (id) DO NOTHING`,
      [B_TASK, ORG_B, USER_B]
    );
    await client.query(
      `INSERT INTO focus_boards (id, user_id, organization_id, name, capacity_limit, created_at, updated_at)
       VALUES ($1,$2,$3,'B board',5,NOW(),NOW()) ON CONFLICT (id) DO NOTHING`,
      [B_BOARD, USER_B, ORG_B]
    );
    await client.query(
      `INSERT INTO focus_board_items (id, board_id, title, priority, status, created_at)
       VALUES ($1,$2,'B-SECRET-FOCUS-ITEM','high','planned',NOW()) ON CONFLICT (id) DO NOTHING`,
      [B_FITEM, B_BOARD]
    );
    await client.query(
      `INSERT INTO canonical_inbox_items (id, user_id, organization_id, item_type, source_entity_type, source_entity_id, title, priority, section, status)
       VALUES ($1,$2,$3,'task','task',$4,'B-SECRET-INBOX','low','assigned_tasks','pending')
       ON CONFLICT (id) DO NOTHING`,
      [B_INBOX, USER_B, ORG_B, B_TASK]
    );
    await client.query(
      `INSERT INTO inbox_ai_triage_log (id, organization_id, inbox_item_id, suggested_priority, suggested_section, confidence_score, accepted)
       VALUES ($1,$2,$3,'critical','decisions_required',0.9,NULL) ON CONFLICT (id) DO NOTHING`,
      [B_TRIAGE, ORG_B, B_INBOX]
    );

    // ── Org A resources (positive-control) ──
    await client.query(
      `INSERT INTO focus_boards (id, user_id, organization_id, name, capacity_limit, created_at, updated_at)
       VALUES ($1,$2,$3,'A board',5,NOW(),NOW()) ON CONFLICT (id) DO NOTHING`,
      [A_BOARD, USER_A, ORG_A]
    );
    await client.query(
      `INSERT INTO focus_board_items (id, board_id, title, priority, status, created_at)
       VALUES ($1,$2,'A-own-item','high','planned',NOW()) ON CONFLICT (id) DO NOTHING`,
      [A_FITEM, A_BOARD]
    );

    process.env.RUN_DB_TESTS = '1';
    process.env.MOCK_DB = 'false';

    const myWork = (await import('../../server/src/routes/my-work.routes.js')).default;
    const inbox = (await import('../../server/src/routes/inbox-enterprise.routes.js')).default;
    app = buildApp(myWork as unknown as express.Router, inbox as unknown as express.Router);
    tokenA = mintTokenFor(USER_A, ORG_A, EMAIL_A);
  });

  afterAll(async () => {
    if (!client) return;
    // Reversible cleanup: everything is prefixed with `odbior--h65--`.
    await client.query(`DELETE FROM inbox_ai_triage_log WHERE id LIKE $1`, [`${P}%`]);
    await client.query(`DELETE FROM canonical_inbox_items WHERE id LIKE $1`, [`${P}%`]);
    await client.query(`DELETE FROM focus_board_items WHERE id LIKE $1`, [`${P}%`]);
    await client.query(`DELETE FROM focus_boards WHERE id LIKE $1`, [`${P}%`]);
    await client.query(`DELETE FROM notebook_pages WHERE id LIKE $1`, [`${P}%`]);
    await client.query(`DELETE FROM notebooks WHERE id LIKE $1`, [`${P}%`]);
    await client.query(`DELETE FROM tasks WHERE id LIKE $1`, [`${P}%`]);
    await client.query(`DELETE FROM organization_members WHERE user_id LIKE $1`, [`${P}%`]);
    await client.query(`DELETE FROM users WHERE id LIKE $1`, [`${P}%`]);
    await client.query(`DELETE FROM organizations WHERE id LIKE $1`, [`${P}%`]);
    await client.end();
  });

  // ─────────────────────────── NOTATNIK (M04) ───────────────────────────
  it('notebook: A cannot READ org B page → 404, no B body leaks', async () => {
    const res = await request(app)
      .get(`/api/my-work/notebook/pages/${B_PAGE}`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect([403, 404]).toContain(res.status);
    expect(JSON.stringify(res.body)).not.toContain('B confidential body');
    expect(JSON.stringify(res.body)).not.toContain('B-SECRET-PAGE');
  });

  it('notebook: A cannot WRITE org B page → 403/404, B row unchanged', async () => {
    const res = await request(app)
      .put(`/api/my-work/notebook/pages/${B_PAGE}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ title: 'HACKED-BY-A' });
    expect([403, 404]).toContain(res.status);
    const row = await client.query(`SELECT title FROM notebook_pages WHERE id=$1`, [B_PAGE]);
    expect(row.rows[0].title).toBe('B-SECRET-PAGE');
  });

  it('notebook: A cannot DELETE org B page → 403/404, B row survives', async () => {
    const res = await request(app)
      .delete(`/api/my-work/notebook/pages/${B_PAGE}`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect([403, 404]).toContain(res.status);
    const row = await client.query(`SELECT 1 FROM notebook_pages WHERE id=$1`, [B_PAGE]);
    expect(row.rowCount).toBe(1);
  });

  // ─────────────────────────── TASKS (M03) ───────────────────────────
  it('personal-task: A cannot READ org B task → 404, no B title leaks', async () => {
    const res = await request(app)
      .get(`/api/my-work/personal-tasks/${B_TASK}`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(res.status).toBe(404);
    expect(JSON.stringify(res.body)).not.toContain('B-SECRET-TASK');
  });

  it('personal-task: A cannot WRITE org B task → 404, B row unchanged', async () => {
    const res = await request(app)
      .put(`/api/my-work/personal-tasks/${B_TASK}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ title: 'HACKED', status: 'done' });
    expect(res.status).toBe(404);
    const row = await client.query(`SELECT title, status FROM tasks WHERE id=$1`, [B_TASK]);
    expect(row.rows[0].title).toBe('B-SECRET-TASK');
    expect(String(row.rows[0].status).toLowerCase()).toBe('todo');
  });

  it('personal-task: A cannot DELETE org B task → B row survives', async () => {
    await request(app)
      .delete(`/api/my-work/personal-tasks/${B_TASK}`)
      .set('Authorization', `Bearer ${tokenA}`);
    const row = await client.query(`SELECT 1 FROM tasks WHERE id=$1`, [B_TASK]);
    expect(row.rowCount).toBe(1);
  });

  // ─────────────────────────── INBOX / FOCUS (M03, inbox-v4) ───────────────────────────
  it('focus-board: A cannot READ org B board items → empty list, no B item leaks', async () => {
    const res = await request(app)
      .get(`/api/inbox-v4/focus/boards/${B_BOARD}/items`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).not.toContain('B-SECRET-FOCUS-ITEM');
    expect(res.body.items).toEqual([]);
  });

  it('focus-board: A cannot ADD item to org B board → 404, no row created', async () => {
    const before = await client.query(
      `SELECT COUNT(*)::int AS c FROM focus_board_items WHERE board_id=$1`,
      [B_BOARD]
    );
    const res = await request(app)
      .post(`/api/inbox-v4/focus/boards/${B_BOARD}/items`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ title: 'A-injected-item' });
    expect(res.status).toBe(404);
    const after = await client.query(
      `SELECT COUNT(*)::int AS c FROM focus_board_items WHERE board_id=$1`,
      [B_BOARD]
    );
    expect(after.rows[0].c).toBe(before.rows[0].c);
  });

  it('focus-item: A cannot COMPLETE org B item → B item stays planned', async () => {
    await request(app)
      .post(`/api/inbox-v4/focus/items/${B_FITEM}/complete`)
      .set('Authorization', `Bearer ${tokenA}`);
    const row = await client.query(`SELECT status FROM focus_board_items WHERE id=$1`, [B_FITEM]);
    expect(row.rows[0].status).toBe('planned');
  });

  it('focus-item: A cannot DELETE org B item → B item survives', async () => {
    await request(app)
      .delete(`/api/inbox-v4/focus/items/${B_FITEM}`)
      .set('Authorization', `Bearer ${tokenA}`);
    const row = await client.query(`SELECT 1 FROM focus_board_items WHERE id=$1`, [B_FITEM]);
    expect(row.rowCount).toBe(1);
  });

  it('triage: A cannot ACCEPT org B triage → B inbox item priority unchanged', async () => {
    const res = await request(app)
      .post(`/api/inbox-v4/triage/${B_TRIAGE}/accept`)
      .set('Authorization', `Bearer ${tokenA}`);
    // Fail-closed: service returns ok:false / not_found, never mutating B.
    expect(res.body?.ok).not.toBe(true);
    const item = await client.query(`SELECT priority FROM canonical_inbox_items WHERE id=$1`, [
      B_INBOX,
    ]);
    expect(item.rows[0].priority).toBe('low'); // NOT overwritten to 'critical'
    const triage = await client.query(`SELECT accepted FROM inbox_ai_triage_log WHERE id=$1`, [
      B_TRIAGE,
    ]);
    expect(triage.rows[0].accepted).toBeNull(); // never accepted by A
  });

  // ─────────────────────────── POSITIVE CONTROL ───────────────────────────
  it('positive-control: A CAN read + complete its OWN focus items (fix did not break legit use)', async () => {
    const list = await request(app)
      .get(`/api/inbox-v4/focus/boards/${A_BOARD}/items`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(list.status).toBe(200);
    expect(JSON.stringify(list.body)).toContain('A-own-item');

    const done = await request(app)
      .post(`/api/inbox-v4/focus/items/${A_FITEM}/complete`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(done.status).toBe(200);
    const row = await client.query(`SELECT status FROM focus_board_items WHERE id=$1`, [A_FITEM]);
    expect(row.rows[0].status).toBe('completed');
  });
});
