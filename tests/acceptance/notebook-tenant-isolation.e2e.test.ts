/**
 * MW-08 acceptance proof: real auth + real V8 notebook router + local Postgres.
 * A tenant must not read, mutate, or delete another tenant's note.
 */
import express, { type Express } from 'express';
import jwt from 'jsonwebtoken';
import pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { getJwtSecret, requireLocalDbUrl } from './harness.js';

const PREFIX = 'odbior--mw08--';
const ORG_A = `${PREFIX}org-a`;
const USER_A = `${PREFIX}user-a`;
const ORG_B = `${PREFIX}org-b`;
const USER_B = `${PREFIX}user-b`;
const NOTE_B = `${PREFIX}note-b`;
const NOTE_A = `${PREFIX}note-a`;

let client: pg.Client;
let app: Express;
let tokenA: string;

async function seedTenant(orgId: string, userId: string, email: string) {
  const now = new Date().toISOString();
  await client.query(
    `INSERT INTO organizations (id, name, plan, status, is_active, created_at)
     VALUES ($1,$2,'enterprise','active',1,$3) ON CONFLICT (id) DO NOTHING`,
    [orgId, `MW08 ${orgId}`, now]
  );
  await client.query(
    `INSERT INTO users (id, organization_id, email, password, role, status, first_name, last_name, created_at)
     VALUES ($1,$2,$3,'x','ADMIN','active','MW08','Test',$4) ON CONFLICT (id) DO NOTHING`,
    [userId, orgId, email, now]
  );
  await client.query(
    `INSERT INTO organization_members (id, organization_id, user_id, role, status, created_at)
     SELECT $4,$1,$2,'OWNER','ACTIVE',$3
     WHERE NOT EXISTS (SELECT 1 FROM organization_members WHERE organization_id=$1 AND user_id=$2)`,
    [orgId, userId, now, `${PREFIX}member-${userId}`]
  );
}

beforeAll(async () => {
  client = new pg.Client({ connectionString: requireLocalDbUrl() });
  await client.connect();
  await seedTenant(ORG_A, USER_A, `${PREFIX}a@acceptance.local`);
  await seedTenant(ORG_B, USER_B, `${PREFIX}b@acceptance.local`);
  await client.query(
    `INSERT INTO notebook_pages
       (id, owner_user_id, organization_id, visibility, title, content_json, content_text,
        tags_json, created_at, updated_at)
     VALUES ($1,$2,$3,'private','B secret note','{}','B confidential body','[]',NOW(),NOW())
     ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title, content_text=EXCLUDED.content_text`,
    [NOTE_B, USER_B, ORG_B]
  );
  await client.query(
    `INSERT INTO notebook_pages
       (id, owner_user_id, organization_id, visibility, title, content_json, content_text,
        tags_json, created_at, updated_at)
     VALUES ($1,$2,$3,'private','A note','{}','initial','[]',NOW(),NOW())
     ON CONFLICT (id) DO UPDATE SET content_text=EXCLUDED.content_text, updated_at=NOW()`,
    [NOTE_A, USER_A, ORG_A]
  );

  const { verifyToken } = await import('../../server/src/middleware/auth.middleware.js');
  const { requireV8OrgContext, attachV8Context } = await import(
    '../../server/src/middleware/v8Auth.middleware.js'
  );
  const router = (await import('../../server/src/routes/v8/my-work.routes.js')).default;
  app = express();
  app.use(express.json());
  app.use(
    '/api/v8/my-work',
    verifyToken as any,
    requireV8OrgContext as any,
    attachV8Context as any,
    router
  );
  tokenA = jwt.sign(
    {
      id: USER_A,
      email: `${PREFIX}a@acceptance.local`,
      organizationId: ORG_A,
      organization_id: ORG_A,
      role: 'OWNER',
    },
    getJwtSecret(),
    { algorithm: 'HS256', expiresIn: '1h' }
  );
});

afterAll(async () => {
  if (!client) return;
  await client.query(`DELETE FROM notebook_pages WHERE id LIKE $1`, [`${PREFIX}%`]);
  await client.query(`DELETE FROM organization_members WHERE user_id LIKE $1`, [`${PREFIX}%`]);
  await client.query(`DELETE FROM users WHERE id LIKE $1`, [`${PREFIX}%`]);
  await client.query(`DELETE FROM organizations WHERE id LIKE $1`, [`${PREFIX}%`]);
  await client.end();
});

describe('MW-08 notebook tenant isolation', () => {
  it('atomically rejects one of two concurrent autosaves based on the same version', async () => {
    const read = await request(app)
      .get(`/api/v8/my-work/notebook/pages/${NOTE_A}`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(read.status).toBe(200);
    const expectedUpdatedAt = read.body.data.updatedAt;
    expect(expectedUpdatedAt).toEqual(expect.any(String));

    const responses = await Promise.all(
      ['first edit', 'second edit'].map((contentText) =>
        request(app)
          .put(`/api/v8/my-work/notebook/pages/${NOTE_A}`)
          .set('Authorization', `Bearer ${tokenA}`)
          .send({ contentText, expectedUpdatedAt })
      )
    );
    expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);

    const winner = responses.find((response) => response.status === 200)?.body.data.contentText;
    const stored = await client.query(`SELECT content_text FROM notebook_pages WHERE id=$1`, [
      NOTE_A,
    ]);
    expect(stored.rows[0].content_text).toBe(winner);
  });

  it('rejects an unparseable expectedUpdatedAt with 400 and never writes — real regression, reproduced against real Postgres', async () => {
    const before = await client.query(`SELECT content_text FROM notebook_pages WHERE id=$1`, [
      NOTE_A,
    ]);

    const res = await request(app)
      .put(`/api/v8/my-work/notebook/pages/${NOTE_A}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        contentText: 'this must never be written',
        expectedUpdatedAt: 'not-a-real-timestamp-garbage',
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_EXPECTED_UPDATED_AT');

    const after = await client.query(`SELECT content_text FROM notebook_pages WHERE id=$1`, [
      NOTE_A,
    ]);
    expect(after.rows[0].content_text).toBe(before.rows[0].content_text);
  });

  it('rejects foreign read without leaking title or body', async () => {
    const res = await request(app)
      .get(`/api/v8/my-work/notebook/pages/${NOTE_B}`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect([403, 404]).toContain(res.status);
    expect(JSON.stringify(res.body)).not.toContain('B secret note');
    expect(JSON.stringify(res.body)).not.toContain('B confidential body');
  });

  it('rejects foreign update and leaves the stored row unchanged', async () => {
    const res = await request(app)
      .put(`/api/v8/my-work/notebook/pages/${NOTE_B}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ title: 'HACKED', contentText: 'HACKED' });
    expect([403, 404]).toContain(res.status);
    const row = await client.query(`SELECT title, content_text FROM notebook_pages WHERE id=$1`, [
      NOTE_B,
    ]);
    expect(row.rows[0]).toMatchObject({
      title: 'B secret note',
      content_text: 'B confidential body',
    });
  });

  it('rejects foreign delete and the stored row survives', async () => {
    const res = await request(app)
      .delete(`/api/v8/my-work/notebook/pages/${NOTE_B}`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect([403, 404]).toContain(res.status);
    const row = await client.query(`SELECT 1 FROM notebook_pages WHERE id=$1`, [NOTE_B]);
    expect(row.rowCount).toBe(1);
  });
});
