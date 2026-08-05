/**
 * M02-P13 — `PUT /api/v8/notebook/pages/:noteId/content` (the P07-B "canon"
 * surface in `server/src/routes/v8/notebook.routes.ts`, distinct from the
 * production write path `server/src/routes/v8/my-work.routes.ts` — no
 * frontend caller reaches this endpoint today; it is contract/acceptance
 * scaffolding for the P07-B checklist's degraded-scenario-9 contract).
 *
 * Found while auditing M02-018 (Notebook optimistic concurrency): the atomic
 * `UPDATE ... WHERE id = $3 AND updated_at = $4` predicate correctly stops a
 * losing concurrent writer from CORRUPTING the row (only one writer's UPDATE
 * can match), but the handler never checked whether the UPDATE actually
 * matched a row. A losing writer's zero-row UPDATE fell through to the same
 * 200 "success" response as the winner — reporting success on a write that
 * silently did nothing, which is worse than a silent overwrite: the caller
 * believes their edit persisted when it did not. Fixed by checking
 * `update.changes` and returning the documented `P07_CONCURRENT_EDIT_CONFLICT`
 * 409 (same code as the pre-write version-mismatch branch) when it is zero.
 *
 * REAL Postgres, REAL router, REAL verifyToken + v8Auth, zero mocks — mirrors
 * tests/acceptance/notebook-tenant-isolation.e2e.test.ts and
 * tests/acceptance/v8-notebook-content-decode.e2e.test.ts.
 */
import express, { type Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { mintToken, pgClient } from './harness.js';
import { SEED } from './seed.mjs';
import { seed } from './seed.mjs';

const PREFIX = 'odbior--p13-v8content--';
const PAGE_ID = `${PREFIX}page-0001`;
const COLLEAGUE_ID = `${PREFIX}colleague-0001`;
const FOREIGN_ORG_ID = `${PREFIX}foreign-org-0001`;
const FOREIGN_USER_ID = `${PREFIX}foreign-user-0001`;

let app: Express;
let ownerToken: string;
let colleagueToken: string;
let foreignToken: string;

async function buildApp(): Promise<Express> {
  const { verifyToken } = await import('../../server/src/middleware/auth.middleware.js');
  const { requireV8OrgContext, attachV8Context } = await import(
    '../../server/src/middleware/v8Auth.middleware.js'
  );
  const notebookV8Router = (await import('../../server/src/routes/v8/notebook.routes.js')).default;

  const expressApp = express();
  expressApp.use(express.json());
  expressApp.use(
    '/api/v8/notebook',
    verifyToken as any,
    requireV8OrgContext as any,
    attachV8Context as any,
    notebookV8Router
  );
  return expressApp;
}

async function readVersion(): Promise<string> {
  const c = pgClient();
  await c.connect();
  try {
    const r = await c.query(`SELECT updated_at FROM notebook_pages WHERE id = $1`, [PAGE_ID]);
    return r.rows[0].updated_at;
  } finally {
    await c.end();
  }
}

async function readContentText(): Promise<string> {
  const c = pgClient();
  await c.connect();
  try {
    const r = await c.query(`SELECT content_text FROM notebook_pages WHERE id = $1`, [PAGE_ID]);
    return r.rows[0].content_text;
  } finally {
    await c.end();
  }
}

beforeAll(async () => {
  await seed(); // idempotent — SEED.ORG_ID / SEED.USER_ID foundation

  const c = pgClient();
  await c.connect();
  try {
    const now = new Date().toISOString();
    // A real second member of the SAME org — proves owner-only, not just
    // tenant-only, scoping on this endpoint too.
    await c.query(
      `INSERT INTO users (id, organization_id, email, password, role, status, first_name, last_name, created_at)
       VALUES ($1,$2,$3,'not-used','MEMBER','active','P13','Colleague',$4) ON CONFLICT (id) DO NOTHING`,
      [COLLEAGUE_ID, SEED.ORG_ID, `${COLLEAGUE_ID}@acceptance.local`, now]
    );
    await c.query(
      `INSERT INTO organization_members (id, organization_id, user_id, role, status, created_at)
       SELECT $4,$1,$2,'MEMBER','ACTIVE',$3
        WHERE NOT EXISTS (SELECT 1 FROM organization_members WHERE organization_id=$1 AND user_id=$2)`,
      [SEED.ORG_ID, COLLEAGUE_ID, now, `${PREFIX}colleague-member-0001`]
    );
    // A real foreign tenant.
    await c.query(
      `INSERT INTO organizations (id, name, plan, status, is_active, created_at)
       VALUES ($1,$2,'enterprise','active',1,$3) ON CONFLICT (id) DO NOTHING`,
      [FOREIGN_ORG_ID, 'P13 foreign org', now]
    );
    await c.query(
      `INSERT INTO users (id, organization_id, email, password, role, status, first_name, last_name, created_at)
       VALUES ($1,$2,$3,'not-used','ADMIN','active','P13','Foreign',$4) ON CONFLICT (id) DO NOTHING`,
      [FOREIGN_USER_ID, FOREIGN_ORG_ID, `${FOREIGN_USER_ID}@acceptance.local`, now]
    );
    await c.query(
      `INSERT INTO organization_members (id, organization_id, user_id, role, status, created_at)
       SELECT $4,$1,$2,'OWNER','ACTIVE',$3
        WHERE NOT EXISTS (SELECT 1 FROM organization_members WHERE organization_id=$1 AND user_id=$2)`,
      [FOREIGN_ORG_ID, FOREIGN_USER_ID, now, `${PREFIX}foreign-member-0001`]
    );

    await c.query(
      `INSERT INTO notebook_pages
         (id, owner_user_id, organization_id, visibility, title, content_json, content_text,
          tags_json, created_at, updated_at)
       VALUES ($1,$2,$3,'private','P13 content-endpoint original','{}','original body','[]',NOW(),NOW())
       ON CONFLICT (id) DO UPDATE SET content_text=EXCLUDED.content_text, updated_at=NOW()`,
      [PAGE_ID, SEED.USER_ID, SEED.ORG_ID]
    );
  } finally {
    await c.end();
  }

  app = await buildApp();
  ownerToken = mintToken();
  colleagueToken = mintToken({ id: COLLEAGUE_ID, organizationId: SEED.ORG_ID, organization_id: SEED.ORG_ID, role: 'MEMBER' });
  foreignToken = mintToken({
    id: FOREIGN_USER_ID,
    email: `${FOREIGN_USER_ID}@acceptance.local`,
    organizationId: FOREIGN_ORG_ID,
    organization_id: FOREIGN_ORG_ID,
    role: 'OWNER',
  });
});

afterAll(async () => {
  const c = pgClient();
  await c.connect();
  try {
    await c.query(`DELETE FROM notebook_pages WHERE id = $1`, [PAGE_ID]);
    await c.query(`DELETE FROM organization_members WHERE user_id IN ($1, $2)`, [
      COLLEAGUE_ID,
      FOREIGN_USER_ID,
    ]);
    await c.query(`DELETE FROM users WHERE id IN ($1, $2)`, [COLLEAGUE_ID, FOREIGN_USER_ID]);
    await c.query(`DELETE FROM organizations WHERE id = $1`, [FOREIGN_ORG_ID]);
  } finally {
    await c.end();
  }
});

describe('v8/notebook.routes.ts PUT /pages/:noteId/content — M02-018 atomic guard', () => {
  it('CONCURRENT writers on the same version: exactly one 200, exactly one 409 (not a silent no-op 200)', async () => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const version = await readVersion();
      const send = (text: string) =>
        request(app)
          .put(`/api/v8/notebook/pages/${PAGE_ID}/content`)
          .set('Authorization', `Bearer ${ownerToken}`)
          .send({ content: text, expectedVersion: version });

      const [resA, resB] = await Promise.all([
        send(`P13 v8-content concurrent A#${attempt}`),
        send(`P13 v8-content concurrent B#${attempt}`),
      ]);

      const statuses = [resA.status, resB.status].sort();
      expect(statuses, `attempt ${attempt}: expected exactly one 200 and one 409`).toEqual([
        200, 409,
      ]);
      const loser = resA.status === 409 ? resA : resB;
      expect(loser.body?.code).toBe('P07_CONCURRENT_EDIT_CONFLICT');
      expect(loser.body?.degraded).toBe(true);

      // The loser must not have silently changed the stored content.
      const winnerText =
        resA.status === 200
          ? `P13 v8-content concurrent A#${attempt}`
          : `P13 v8-content concurrent B#${attempt}`;
      expect(await readContentText()).toBe(winnerText);
    }
  });

  it('a foreign OWNER in the SAME tenant cannot write (owner-only, not just tenant-scoped)', async () => {
    const version = await readVersion();
    const before = await readContentText();
    const res = await request(app)
      .put(`/api/v8/notebook/pages/${PAGE_ID}/content`)
      .set('Authorization', `Bearer ${colleagueToken}`)
      .send({ content: 'P13 colleague should not land', expectedVersion: version });
    expect(res.status).toBe(403);
    expect(res.body?.code).toBe('NOTEBOOK_PAGE_OWNER_ONLY');
    expect(await readContentText()).toBe(before);
  });

  it('a foreign TENANT cannot write and does not leak content', async () => {
    const version = await readVersion();
    const before = await readContentText();
    const res = await request(app)
      .put(`/api/v8/notebook/pages/${PAGE_ID}/content`)
      .set('Authorization', `Bearer ${foreignToken}`)
      .send({ content: 'P13 foreign tenant should not land', expectedVersion: version });
    expect(res.status).toBe(403);
    expect(res.body?.code).toBe('NOTEBOOK_PAGE_FORBIDDEN');
    expect(await readContentText()).toBe(before);
  });
});
