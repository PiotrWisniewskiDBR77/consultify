// CZERWONY Z ZAŁOŻENIA — nie regresja tego dyżuru
/** @vitest-environment node */
import express from 'express';
import jwt from 'jsonwebtoken';
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

const BUSINESS_VERSION_ID = 'e2ac7ef3-d27e-464f-8aef-af3f4721fbf1';
const ENTITY_ID = '03441613-c363-45d8-a82b-8b6d2f0f9876';
const ORGANIZATION_ID = 'wave3-finance-owner-org-v1';
const USER_ID = 'wave3-finance-owner-user-v1';
const PERIOD_IDS = [
  '41b50123-4d0e-4d4d-90ce-aac63ce90565',
  '42b6f6ec-178f-438b-a6a6-7602a11e63a2',
  '7415db0b-3063-4fec-a373-c3fc672dd2c4',
  'd4573fd1-577b-47bb-b55e-750683333647',
  'b12722ca-f265-4aa8-96fc-635a82c53a30',
  '3d0905f5-a40e-4fbc-acaa-a72b094866f9',
  '5ed5b738-6a21-4216-a446-959d8f966dab',
  '92e31c8a-4a98-45b9-82ea-6035c8280238',
  '0258605a-8370-4ead-b712-5dc715a1b2d7',
  'c7e422e3-cd37-49f9-8ab7-a9d7ad004d2b',
  'e9f862f8-3626-40c9-b65a-e04d24ae9d8c',
  '2fccc7df-9ec0-447e-a470-ceb1ba1d9dd1',
];

describe('Dyżur 102 — realna trasa wyceny przez ApiGateway', { retry: 0 }, () => {
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
  });

  it('KONTRAKT DLA DYŻURU 102 — trzy realne żądania DCF nie mogą kończyć się HTTP 500', async () => {
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
      console.log(`DAY102_ATTEMPT_${attempt}`, JSON.stringify(attempts.at(-1)));
    }
    expect(attempts).toEqual(
      attempts.map(({ body }) => ({
        status: 200,
        body: expect.objectContaining({ data: expect.any(Object) }),
      }))
    );
  });
});
