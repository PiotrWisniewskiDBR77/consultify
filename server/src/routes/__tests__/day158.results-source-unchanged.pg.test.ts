/** @vitest-environment node */
import { randomUUID } from 'node:crypto';

import express from 'express';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../../../../tests/integration/_helpers/assertRealPostgres.js';
import config from '../../config/Config.js';
import { ApiGateway } from '../../Gateway.js';

const databaseUrl = process.env.DATABASE_URL || '';
const enabled =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  /^postgres(?:ql)?:/.test(databaseUrl);

describe.skipIf(!enabled)('Day 158 Results source remains initiative_kpis', () => {
  const pool = new Pool({ connectionString: databaseUrl });
  const organizationId = `day158-http-${randomUUID()}`;
  const userId = randomUUID();
  const initiativeId = randomUUID();
  const sourceId = randomUUID();
  const canonicalId = randomUUID();
  let app: express.Express;
  let token: string;

  beforeAll(async () => {
    await assertRealPostgresTestEnvironment();
    await pool.query('INSERT INTO organizations (id, name) VALUES ($1, $2)', [
      organizationId,
      'Day 158 unchanged source proof',
    ]);
    await pool.query(
      `INSERT INTO users (id, organization_id, email, role, status)
       VALUES ($1, $2, $3, 'OWNER', 'active')`,
      [userId, organizationId, `${userId}@test.invalid`]
    );
    await pool.query(
      `INSERT INTO organization_members (id, organization_id, user_id, role, status)
       VALUES ($1, $2, $3, 'OWNER', 'ACTIVE')`,
      [randomUUID(), organizationId, userId]
    );
    await pool.query(
      `INSERT INTO initiatives
         (id, organization_id, name, status, owner_business_id, created_by, updated_by,
          planned_start_date, planned_end_date)
       VALUES ($1, $2, 'Day 158 initiative', 'EXECUTING', $3, $3, $3,
               '2026-01-01', '2026-12-31')`,
      [initiativeId, organizationId, userId]
    );
    await pool.query(
      `INSERT INTO initiative_kpis
         (id, initiative_id, organization_id, name, target_value, current_value, unit,
          measurement_frequency, status)
       VALUES ($1, $2, $3, 'Day 158 HTTP KPI', 100, 40, 'percent', 'MONTHLY', 'on_track')`,
      [sourceId, initiativeId, organizationId]
    );
    await pool.query(
      `INSERT INTO rvn_kpi_definitions
         (kpi_id, organization_id, kpi_code, status, created_by)
       VALUES ($1, $2, 'DAY158-HTTP', 'active', $3)`,
      [canonicalId, organizationId, userId]
    );

    app = express();
    app.use(express.json());
    ApiGateway.getInstance().initializeRoutes(app);
    token = jwt.sign(
      { id: userId, userId, organizationId, role: 'OWNER', email: `${userId}@test.invalid` },
      config.JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '10m' }
    );
  }, 30000);

  afterAll(async () => {
    await pool.query('DELETE FROM kpi_crosswalk WHERE organization_id = $1', [organizationId]);
    await pool.query('DELETE FROM rvn_kpi_definitions WHERE organization_id = $1', [
      organizationId,
    ]);
    await pool.query('DELETE FROM initiative_kpis WHERE organization_id = $1', [organizationId]);
    await pool.query('DELETE FROM initiatives WHERE organization_id = $1', [organizationId]);
    await pool.query('DELETE FROM organization_members WHERE organization_id = $1', [
      organizationId,
    ]);
    await pool.query('DELETE FROM users WHERE id = $1', [userId]);
    await pool.query('DELETE FROM organizations WHERE id = $1', [organizationId]);
    await pool.end();
  });

  it('returns byte-equivalent JSON before mapping, after mapping, and after shadow-read', async () => {
    expect(process.env.DB_TYPE).toBe('postgres');
    const getResults = () =>
      request(app)
        .get(`/api/initiatives/${initiativeId}/kpis`)
        .set('Authorization', `Bearer ${token}`);

    const before = await getResults();
    expect(before.status).toBe(200);

    const { registerConfirmedInitiativeKpiMappings } =
      await import('../../services/resultsVnext/kpi/kpiCrosswalkService.js');
    await registerConfirmedInitiativeKpiMappings({
      organizationId,
      createdBy: userId,
      mappings: [{ sourceId, canonicalKpiId: canonicalId, matchBasis: 'manual' }],
    });
    const afterMapping = await getResults();
    expect(afterMapping.status).toBe(200);

    const { runInitiativeKpiShadowRead } =
      await import('../../services/resultsVnext/kpi/kpiShadowReadService.js');
    await runInitiativeKpiShadowRead(organizationId);
    const afterShadow = await getResults();
    expect(afterShadow.status).toBe(200);

    expect(JSON.stringify(afterMapping.body)).toBe(JSON.stringify(before.body));
    expect(JSON.stringify(afterShadow.body)).toBe(JSON.stringify(before.body));
  });
});
