/** @vitest-environment node */
import { randomUUID } from 'node:crypto';
import express from 'express';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const url = process.env.DATABASE_URL || '';
if (!/localhost|127\.0\.0\.1/.test(url)) throw new Error('fresh local PostgreSQL required');
const secret = 'mat-bvp-mounted-auth-secret-at-least-32-characters';
process.env.JWT_SECRET = secret;
process.env.NODE_ENV = 'test';
process.env.DB_TYPE = 'postgres';
const p = `mat-auth-${Date.now()}-${randomUUID().slice(0, 6)}`;
const org = `${p}-org`;
const user = `${p}-user`;
const pool = new Pool({ connectionString: url });

const bearer = () => ({
  Authorization: `Bearer ${jwt.sign({ id: user, email: `${user}@example.test`, organizationId: org, role: 'ADMIN' }, secret, { algorithm: 'HS256', expiresIn: '1h' })}`,
});

describe('MAT-BVP-001 mounted material routers with real auth', () => {
  let app: express.Express;
  beforeAll(async () => {
    const now = new Date().toISOString();
    await pool.query(`INSERT INTO organizations(id,name,plan,status,is_active,created_at) VALUES($1,$2,'enterprise','active',1,$3)`, [org, p, now]);
    await pool.query(`INSERT INTO users(id,organization_id,email,password,role,status,created_at) VALUES($1,$2,$3,'unused','ADMIN','active',$4)`, [user, org, `${user}@example.test`, now]);
    await pool.query(`INSERT INTO organization_members(id,organization_id,user_id,role,status,created_at) VALUES($1,$2,$3,'ADMIN','ACTIVE',$4)`, [`${p}-membership`, org, user, now]);
    const [doc, workbook, presentations] = await Promise.all([
      import('../../../routes/document-studio.routes.js'),
      import('../../../routes/workbook.routes.js'),
      import('../../../routes/presentations.routes.js'),
    ]);
    app = express();
    app.use(express.json());
    app.use('/api/document-studio', doc.default);
    app.use('/api/workbook', workbook.default);
    app.use('/api/presentations', presentations.default);
    app.use((err: any, _req: any, res: any, _next: any) => res.status(500).json({ error: String(err?.message || err) }));
  }, 60_000);

  afterAll(async () => {
    await pool.query(`DELETE FROM organization_members WHERE organization_id=$1`, [org]);
    await pool.query(`DELETE FROM users WHERE organization_id=$1`, [org]);
    await pool.query(`DELETE FROM organizations WHERE id=$1`, [org]);
    await pool.end();
  });

  it.each([
    ['/api/document-studio/missing/export/docx'],
    ['/api/workbook/missing/download'],
    ['/api/presentations/decks/missing/download'],
  ])('rejects anonymous export at %s', async (path) => {
    expect((await request(app).get(path)).status).toBe(401);
  });

  it.each([
    ['/api/document-studio/missing/export/docx'],
    ['/api/workbook/missing/download'],
    ['/api/presentations/decks/missing/download'],
  ])('accepts real JWT/membership but reveals no foreign/nonexistent artifact at %s', async (path) => {
    const res = await request(app).get(path).set(bearer());
    expect([404, 409]).toContain(res.status);
  });
});
