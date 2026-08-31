/** @vitest-environment node */
import express from 'express';
import jwt from 'jsonwebtoken';
import pg from 'pg';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../../../../../../tests/integration/_helpers/assertRealPostgres.js';

if (
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  process.env.DATABASE_URL?.startsWith('postgresql://')
) {
  process.env.DB_TYPE = 'postgres';
}

const BUSINESS_VERSION_ID = 'a4ad40a0-0902-4e9f-b712-57bfb56b6519';
const ENTITY_ID = 'fec65b41-251e-4d64-a12a-e74e1a1167e1';
const ORGANIZATION_ID = 'wave3-finance-owner-org-v1';
const USER_ID = 'wave3-finance-owner-user-v1';
const PERIOD_IDS = [
  '6c170db8-44d4-4e63-82b3-48b3d13288b2',
  'b9beda26-aa12-4ba9-bc75-88472b632681',
  '249b39f2-af24-447e-b347-2474dca0a760',
  'd2d2683b-3edd-4a6f-b140-4f2cc0ff0679',
  '34406aab-a1c5-434f-ab65-3af7ca0ceeac',
  '21aa2f21-ca6c-4517-aa8c-993115ad89d8',
  '032aaea2-71ed-4bfc-8ed1-ff919925a557',
  'd658d993-bb84-42a9-95f9-b0ec3c42f0e7',
  '0cce6151-23a5-4ffc-b2b4-03680d126975',
  'aba40b2d-9e66-4663-b6ef-8a79dade74d7',
  'd26e61ea-4548-442c-ad4d-48adcb71573b',
  '9ee7fd9c-2e6a-49a8-8358-eae5b9b4ffb3',
];

describe('Dyżur 116 — zatwierdzona wersja wyceny odmawia zapisu WACC', { retry: 0 }, () => {
  let app: express.Express;
  let token: string;

  beforeAll(async () => {
    expect(process.env.DB_TYPE).toBe('postgres');
    await assertRealPostgresTestEnvironment();
    const { ApiGateway } = await import('../../../../Gateway.js');
    app = express();
    app.use(express.json());
    ApiGateway.getInstance().initializeRoutes(app);
    token = jwt.sign(
      {
        id: USER_ID,
        userId: USER_ID,
        organizationId: ORGANIZATION_ID,
        organization_id: ORGANIZATION_ID,
        role: 'OWNER',
      },
      process.env.JWT_SECRET!,
      { algorithm: 'HS256', expiresIn: '1h' }
    );
  }, 180_000);

  it('zwraca kontrolowane 409 w 3 z 3 prób i nie zmienia zatwierdzonego WACC', async () => {
    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    const before = await pool.query(
      `SELECT wacc_computed_pct::text, beta_relevered::text, updated_at::text
         FROM finance_valuation_wacc_inputs
        WHERE organization_id=$1 AND business_version_id=$2`,
      [ORGANIZATION_ID, BUSINESS_VERSION_ID]
    );
    expect(before.rowCount).toBe(1);
    const attempts: Array<{ status: number; body: unknown }> = [];
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const response = await request(app)
        .post(`/api/v8/finance-v2/valuation/variants/${BUSINESS_VERSION_ID}/compute/dcf`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          entityId: ENTITY_ID,
          projectionYears: [{ fiscalYear: 2026, periodIds: PERIOD_IDS }],
          openingWorkingCapital: 28_000_000,
          terminal: { gPct: 2.5 },
        });
      attempts.push({ status: response.status, body: response.body });
      console.log(`DAY116_ATTEMPT_${attempt}`, JSON.stringify(attempts.at(-1)));
    }

    expect(attempts).toEqual(
      attempts.map(() => ({
        status: 409,
        body: expect.objectContaining({
          code: 'APPROVED_VERSION_IMMUTABLE',
          error: expect.stringMatching(/approved.*cannot be changed.*new version/i),
        }),
      }))
    );
    const after = await pool.query(
      `SELECT wacc_computed_pct::text, beta_relevered::text, updated_at::text
         FROM finance_valuation_wacc_inputs
        WHERE organization_id=$1 AND business_version_id=$2`,
      [ORGANIZATION_ID, BUSINESS_VERSION_ID]
    );
    await pool.end();
    expect(after.rows).toEqual(before.rows);
  });
});
