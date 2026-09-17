/**
 * TPL-1a v4 / W214: real workbook router + real auth + real PostgreSQL.
 *
 * Run against a disposable local copy only:
 * RUN_DB_TESTS=1 DATABASE_URL=postgresql://... npx vitest run <this file>
 */

import express, { type Express } from 'express';
import { writeFileSync } from 'node:fs';
import jwt from 'jsonwebtoken';
import pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const { Pool } = pg;
const realDb = process.env.RUN_DB_TESTS === '1';
const databaseUrl = process.env.DATABASE_URL || '';
const jwtSecret = process.env.JWT_SECRET || 'tpl1a-v4-local-proof-secret-at-least-32-characters';
process.env.JWT_SECRET = jwtSecret;

const SHEET_BASE_ID = '2ccf6ff1-258e-4509-a163-6cd1a1fdfcd1';

describe.skipIf(!realDb).sequential('TPL-1a SHEET-BASE duplicate through live HTTP', () => {
  let app: Express;
  let pool: pg.Pool;
  let user: { id: string; email: string; organization_id: string; role: string };

  beforeAll(async () => {
    if (!/localhost|127\.0\.0\.1/.test(databaseUrl)) {
      throw new Error(`TPL-1a proof requires a local DATABASE_URL, got: ${databaseUrl}`);
    }
    process.env.DB_TYPE = 'postgres';
    process.env.DB_MANAGED_SCHEMA = 'off';
    pool = new Pool({ connectionString: databaseUrl });
    const result = await pool.query<{
      id: string;
      email: string;
      organization_id: string;
      role: string;
    }>(
      `SELECT u.id, u.email, om.organization_id, om.role
         FROM organization_members om
         JOIN users u ON u.id = om.user_id
        WHERE om.status = 'ACTIVE'
          AND u.status = 'active'
          AND om.organization_id <> '__system__'
        ORDER BY CASE WHEN om.role = 'OWNER' THEN 0 ELSE 1 END, u.created_at
        LIMIT 1`
    );
    user = result.rows[0];
    if (!user) throw new Error('No active organization member found in the copied database');

    const workbookRouter = (await import('../../server/src/routes/workbook.routes.js')).default;
    app = express();
    app.use(express.json());
    app.use('/api/workbook', workbookRouter);
  }, 120_000);

  afterAll(async () => {
    await pool?.end();
  });

  it('returns 201 and a fresh workbook id for the staging SHEET-BASE', async () => {
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        organizationId: user.organization_id,
        organization_id: user.organization_id,
        role: user.role,
      },
      jwtSecret,
      { algorithm: 'HS256', expiresIn: '10m' }
    );

    const response = await request(app)
      .post(`/api/workbook/templates/${SHEET_BASE_ID}/build`)
      .set('Authorization', `Bearer ${token}`)
      .send({ params: {} });

    console.info(
      JSON.stringify({
        httpStatus: response.status,
        sourceTemplateId: SHEET_BASE_ID,
        newWorkbookId: response.body.id,
      })
    );
    if (process.env.TPL1A_HTTP_EVIDENCE_PATH) {
      writeFileSync(
        process.env.TPL1A_HTTP_EVIDENCE_PATH,
        `${JSON.stringify(
          {
            httpStatus: response.status,
            sourceTemplateId: SHEET_BASE_ID,
            newWorkbookId: response.body.id,
          },
          null,
          2
        )}\n`
      );
    }
    expect(response.status, JSON.stringify(response.body)).toBe(201);
    expect(response.body.id).toEqual(expect.any(String));
    expect(response.body.id).not.toBe(SHEET_BASE_ID);
  }, 120_000);
});
