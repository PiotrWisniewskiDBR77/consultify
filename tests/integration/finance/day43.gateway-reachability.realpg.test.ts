/** @vitest-environment node */
import { randomUUID } from 'node:crypto';

import express from 'express';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';

import { ApiGateway } from '../../../server/src/Gateway.js';

const databaseUrl = process.env.DATABASE_URL ?? '';
const realPg =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  databaseUrl.startsWith('postgresql://postgres:cx@127.0.0.1:5810/cx_day43');
const jwtSecret = 'test-jwt-secret-key-min-32-chars-long-for-validation';

const unknownReads = [
  ['Statements', '/api/v8/finance-v2/statements/missing/lines'],
  ['Analysis', '/api/v8/finance-v2/analysis/missing/kpi-values'],
  ['Models/Baseline', '/api/v8/finance-v2/baseline/missing/assumptions'],
  ['Prediction', '/api/v8/finance-v2/prediction/missing/authoring'],
  ['Enterprise Valuation', '/api/v8/finance-v2/valuation/cases/missing'],
] as const;

function gatewayApp() {
  const app = express();
  app.use(express.json());
  ApiGateway.getInstance().initializeRoutes(app);
  return app;
}

describe.skipIf(!realPg)('day43 A.1 — real ApiGateway reachability', () => {
  const organizationId = `day43-org-${randomUUID()}`;
  const userId = randomUUID();
  const app = gatewayApp();
  const pool = new Pool({ connectionString: databaseUrl });
  let token = '';
  const existingReads: Array<readonly [string, string]> = [];

  beforeAll(async () => {
    process.env.JWT_SECRET = jwtSecret;
    await pool.query(`INSERT INTO organizations(id,name) VALUES($1,$1)`, [organizationId]);
    await pool.query(
      `INSERT INTO users(id,email,password,role,organization_id) VALUES($1,$2,'test','ADMIN',$3)`,
      [userId, `${userId}@test.invalid`, organizationId]
    );
    await pool.query(
      `INSERT INTO organization_members(id,organization_id,user_id,role,status) VALUES($1,$2,$3,'ADMIN','ACTIVE')`,
      [randomUUID(), organizationId, userId]
    );
    token = jwt.sign(
      { id: userId, userId, organizationId, organization_id: organizationId, role: 'ADMIN' },
      jwtSecret,
      { algorithm: 'HS256', expiresIn: '1h' }
    );
    process.env.ENABLE_V8_GLOBAL = 'true';
    const types = [
      ['Statements', 'STATEMENT_PACK', (id: string) => `/api/v8/finance-v2/statements/${id}/lines`],
      [
        'Analysis',
        'HISTORICAL_ANALYSIS',
        (id: string) => `/api/v8/finance-v2/analysis/${id}/kpi-values`,
      ],
      [
        'Models/Baseline',
        'BASELINE_MODEL',
        (id: string) => `/api/v8/finance-v2/baseline/${id}/assumptions`,
      ],
      [
        'Prediction',
        'PREDICTION_SCENARIO',
        (id: string) => `/api/v8/finance-v2/prediction/${id}/authoring`,
      ],
    ] as const;
    for (const [card, artifactType, path] of types) {
      const created = await request(app)
        .post('/api/v8/finance-v2/artifacts')
        .set('Authorization', `Bearer ${token}`)
        .send({ artifactType, naturalKey: `day43-${artifactType}` });
      expect(created.status, `${card} fixture`).toBe(201);
      existingReads.push([card, path(created.body.data.currentBusinessVersion.businessVersionId)]);
    }
    const valuation = await request(app)
      .post('/api/v8/finance-v2/valuation/cases')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Day 43 reachability case' });
    expect(valuation.status).toBe(201);
    existingReads.push([
      'Enterprise Valuation',
      `/api/v8/finance-v2/valuation/cases/${valuation.body.data.caseId}`,
    ]);
  }, 30_000);

  it.each(unknownReads)('%s: gate OFF returns V8_DISABLED', async (_card, path) => {
    delete process.env.ENABLE_V8_GLOBAL;
    const response = await request(app).get(path);
    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: 'V8 features not available',
      code: 'V8_DISABLED',
    });
  });

  it.each(unknownReads)('%s: gate ON reaches authentication', async (_card, path) => {
    process.env.ENABLE_V8_GLOBAL = 'true';
    const response = await request(app).get(path);
    expect([401, 403]).toContain(response.status);
    expect(response.body.code).not.toBe('V8_DISABLED');
  });

  it.each([0, 1, 2, 3, 4])('gate ON reaches persisted card %s', async (index) => {
    process.env.ENABLE_V8_GLOBAL = 'true';
    expect(existingReads).toHaveLength(5);
    const [card, path] = existingReads[index];
    const existing = await request(app).get(path).set('Authorization', `Bearer ${token}`);
    expect(existing.status, `${card} existing`).toBe(200);
  });

  it.each(unknownReads)(
    '%s: gate ON returns an honest handler 404 for a missing row',
    async (_card, path) => {
      process.env.ENABLE_V8_GLOBAL = 'true';
      const missing = await request(app).get(path).set('Authorization', `Bearer ${token}`);
      expect(missing.status).toBe(404);
      expect(missing.body.code).not.toBe('V8_DISABLED');
    }
  );
});
