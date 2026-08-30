/** @vitest-environment node */

import { randomUUID } from 'node:crypto';

import express, { type Express } from 'express';
import jwt from 'jsonwebtoken';
import { Client } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { formatAnalysisKpiValueForDisplay } from '../../../../src/services/api/financeV2.types.js';
import config from '../../config/Config.js';
import { ApiGateway } from '../../Gateway.js';
import { loadValuationCurrency } from '../../services/finance/canonical/valuationAdvisorService.js';
import { assertRealPostgresTestEnvironment } from '../../../../tests/integration/_helpers/assertRealPostgres.js';

const NO_RETRY = { retry: 0 } as const;

describe('Day 171 data contracts on real ApiGateway and PostgreSQL', NO_RETRY, () => {
  const suffix = randomUUID().replaceAll('-', '');
  const organizationId = randomUUID();
  const userId = randomUUID();
  let app: Express;
  let sql: Client;
  let authorization: string;

  beforeAll(async () => {
    expect(process.env.DB_TYPE).toBe('postgres');
    await assertRealPostgresTestEnvironment();

    sql = new Client({ connectionString: String(process.env.DATABASE_URL) });
    await sql.connect();
    const target = await sql.query('SELECT current_database() AS database, inet_server_port() AS port');
    expect(target.rows[0]).toEqual({ database: 'cx171', port: 5432 });

    await sql.query(
      `INSERT INTO organizations (id, name, plan, status, is_active, created_at)
       VALUES ($1, $2, 'enterprise', 'active', 1, now())`,
      [organizationId, `day171_${suffix}`]
    );
    await sql.query(
      `INSERT INTO users
         (id, organization_id, email, password, first_name, last_name, role, status, created_at)
       VALUES ($1, $2, $3, 'x', 'Piotr', 'Kontraktowy', 'ADMIN', 'active', now())`,
      [userId, organizationId, `day171_${suffix}@example.test`]
    );
    await sql.query(
      `INSERT INTO organization_members
         (id, organization_id, user_id, role, status, created_at)
       VALUES ($1, $2, $3, 'ADMIN', 'ACTIVE', now())`,
      [randomUUID(), organizationId, userId]
    );

    authorization = `Bearer ${jwt.sign(
      { id: userId, userId, email: `day171_${suffix}@example.test`, organizationId, organization_id: organizationId, role: 'ADMIN' },
      config.JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '1h' }
    )}`;
    app = express();
    app.use(express.json());
    ApiGateway.getInstance().initializeRoutes(app);
  });

  afterAll(async () => {
    if (sql) await sql.end();
  });

  it('returns joined KPI and person names from GET scorecard items', async () => {
    const createKpi = await request(app)
      .post('/api/vnext/results/kpi')
      .set('Authorization', authorization)
      .send({
        kpiCode: `D171-${suffix.slice(0, 8)}`,
        name: 'Efektywność całkowita urządzeń',
        targetGeometry: 'threshold_min',
        targetValue: 90,
        measurementFrequencyDays: 30,
        idempotencyKey: `day171-kpi-${suffix}`,
      });
    expect(createKpi.status, JSON.stringify(createKpi.body)).toBe(201);
    const kpiId = createKpi.body.kpi.kpiId as string;

    const createScorecard = await request(app)
      .post('/api/vnext/results/kpi/scorecards')
      .set('Authorization', authorization)
      .send({ name: 'Day 171 Scorecard', scopeType: 'organization', reviewFrequency: 'monthly' });
    expect(createScorecard.status, JSON.stringify(createScorecard.body)).toBe(201);
    const scorecardId = createScorecard.body.scorecard.scorecardId as string;

    const add = await request(app)
      .post(`/api/vnext/results/kpi/scorecards/${scorecardId}/items`)
      .set('Authorization', authorization)
      .send({ expectedVersion: 1, kpiId });
    expect(add.status, JSON.stringify(add.body)).toBe(201);

    const response = await request(app)
      .get(`/api/vnext/results/kpi/scorecards/${scorecardId}/items`)
      .set('Authorization', authorization);
    expect(response.status, JSON.stringify(response.body)).toBe(200);
    expect(response.body.items[0]).toMatchObject({
      kpiId,
      kpiName: 'Efektywność całkowita urządzeń',
      addedByName: 'Piotr Kontraktowy',
    });

    const raw = await sql.query(
      `SELECT si.kpi_id, dv.name AS kpi_name
         FROM rvn_kpi_scorecard_items si
         JOIN rvn_kpi_definitions kd ON kd.kpi_id = si.kpi_id AND kd.organization_id = si.organization_id
         JOIN rvn_kpi_definition_versions dv ON dv.definition_version_id = kd.current_definition_version_id
        WHERE si.organization_id = $1 AND si.scorecard_id = $2`,
      [organizationId, scorecardId]
    );
    expect(raw.rows[0]).toEqual({ kpi_id: kpiId, kpi_name: 'Efektywność całkowita urządzeń' });
  });

  it('reads nullable valuation currency only from organization_profiles', async () => {
    expect(await loadValuationCurrency(organizationId)).toBeNull();
    await sql.query(
      `INSERT INTO organization_profiles (id, organization_id, currency) VALUES ($1, $2, 'PLN')`,
      [randomUUID(), organizationId]
    );
    const raw = await sql.query(
      `SELECT currency FROM organization_profiles WHERE organization_id = $1`,
      [organizationId]
    );
    expect(raw.rows[0].currency).toBe('PLN');
    expect(await loadValuationCurrency(organizationId)).toBe('PLN');
  });

  it('proves PERCENT metadata is NOT NULL in PG and renders 0.12 as 12%', async () => {
    const raw = await sql.query(
      `SELECT unit_type FROM finance_analysis_kpi_catalog WHERE unit_type = 'PERCENT' ORDER BY kpi_code LIMIT 1`
    );
    expect(raw.rows[0].unit_type).toBe('PERCENT');
    expect(
      formatAnalysisKpiValueForDisplay({
        unitType: raw.rows[0].unit_type,
        value: {
          status: 'PRESENT_NONZERO',
          valueDecimal: '0.12',
          nativeCurrency: 'PLN',
          presentationCurrency: 'PLN',
          unit: 'UNITS',
          multiplier: '1',
        },
      }).text
    ).toBe('12%');
  });
});
