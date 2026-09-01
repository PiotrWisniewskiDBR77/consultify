/** @vitest-environment node */
import express from 'express';
import jwt from 'jsonwebtoken';
import pg from 'pg';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../../../../../tests/integration/_helpers/assertRealPostgres.js';

if (
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  process.env.DATABASE_URL?.startsWith('postgresql://')
) {
  process.env.DB_TYPE = 'postgres';
}

const ORGANIZATION_ID = 'wave3-finance-owner-org-v1';
const USER_ID = 'wave3-finance-owner-user-v1';

describe('Dyżur 129 — fixture Finansów ma zmapowaną tożsamość wyceny', { retry: 0 }, () => {
  let app: express.Express;
  let token: string;
  let valuationArtifactId: string;

  beforeAll(async () => {
    expect(process.env.DB_TYPE).toBe('postgres');
    await assertRealPostgresTestEnvironment();
    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    const valuation = await pool.query(
      `SELECT artifact_id
         FROM finance_artifacts
        WHERE organization_id=$1 AND artifact_type='VALUATION_CASE' AND archived_at IS NULL`,
      [ORGANIZATION_ID]
    );
    await pool.end();
    expect(valuation.rowCount).toBe(1);
    valuationArtifactId = valuation.rows[0].artifact_id;

    const { ApiGateway } = await import('../../../Gateway.js');
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

  it('wiąże artifactId używany przez UI i usuwa stan FINANCE_LEGACY_IDENTITY_UNMAPPED', async () => {
    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    const alias = await pool.query(
      `SELECT artifact_id, business_version_id, mapping_confidence
         FROM finance_artifact_aliases
        WHERE organization_id=$1 AND legacy_table='valuations'
          AND legacy_id=$2 AND legacy_version=''`,
      [ORGANIZATION_ID, valuationArtifactId]
    );
    await pool.end();
    expect(alias.rowCount).toBe(1);
    expect(alias.rows[0]).toMatchObject({
      artifact_id: valuationArtifactId,
      mapping_confidence: 'AUTO_MIGRATE',
    });
    expect(alias.rows[0].business_version_id).toEqual(expect.any(String));

    const response = await request(app)
      .post(`/api/economics/valuations/${valuationArtifactId}/compute`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    console.log(
      'DAY129_LEGACY_COMPUTE',
      JSON.stringify({ status: response.status, body: response.body })
    );
    expect(response.status).toBe(410);
    expect(response.body).toMatchObject({
      code: 'FINANCE_LEGACY_WRITER_DISABLED',
      writerId: 'ECO-W26',
      canonicalArtifactId: valuationArtifactId,
    });
    expect(response.body.code).not.toBe('FINANCE_LEGACY_IDENTITY_UNMAPPED');
  });
});
