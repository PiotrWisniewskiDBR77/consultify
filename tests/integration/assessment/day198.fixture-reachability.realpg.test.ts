/** @vitest-environment node */

import express from 'express';
import jwt from 'jsonwebtoken';
import { Client } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ApiGateway } from '../../../server/src/Gateway.js';
import { assertRealPostgresTestEnvironment } from '../_helpers/assertRealPostgres.js';

const NO_RETRY = { retry: 0 } as const;
const organizationId = '04000000-0000-4000-8000-000000000001';
const userId = '04000000-0000-4000-8000-000000000011';
const databaseUrl = process.env.DATABASE_URL ?? '';
const jwtSecret = process.env.JWT_SECRET ?? '';

describe('Day198 assessment owner fixture reachability through real ApiGateway', NO_RETRY, () => {
  const app = express();
  const sql = new Client({ connectionString: databaseUrl });
  let token = '';

  beforeAll(async () => {
    await assertRealPostgresTestEnvironment();
    expect(process.env.DB_TYPE).toBe('postgres');
    expect(process.env.MOCK_DB).toBe('false');
    expect(process.env.RUN_DB_TESTS).toBe('1');
    expect(process.env.ENABLE_TEST_AUTH_BYPASS).toBe('false');
    await sql.connect();
    app.use(express.json());
    ApiGateway.getInstance().initializeRoutes(app);
    token = jwt.sign(
      {
        id: userId,
        userId,
        organizationId,
        role: 'OWNER',
        email: 'w3.assessment.owner@local.test',
      },
      jwtSecret,
      { algorithm: 'HS256', expiresIn: '10m' }
    );
  }, 60_000);

  afterAll(async () => {
    await sql.end();
  });

  const auth = () => ({ Authorization: `Bearer ${token}`, 'x-org-context': organizationId });

  it('exposes the seeded legacy report through the Reports consumer path', async () => {
    const response = await request(app).get('/api/assessment-reports').set(auth());

    expect(response.status).toBe(200);
    expect(response.body.reports).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Raport gotowości klienta — fixture właściciela' }),
      ])
    );
    const readback = await sql.query(
      `SELECT count(*)::int AS count
       FROM assessment_reports
       WHERE organization_id=$1 AND name=$2`,
      [organizationId, 'Raport gotowości klienta — fixture właściciela']
    );
    expect(readback.rows[0].count).toBe(1);
  });

  it('keeps Initiatives full honestly unreachable because the fixture seeds no registered initiative', async () => {
    const readback = await sql.query(
      `SELECT count(*)::int AS count
       FROM initiatives
       WHERE organization_id=$1 AND source_type='assessment'`,
      [organizationId]
    );
    expect(readback.rows[0].count).toBe(0);

    const response = await request(app).get('/api/initiatives?source=assessment').set(auth());
    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });
});
