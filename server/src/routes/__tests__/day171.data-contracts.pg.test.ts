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
  const originalEnableV8Global = process.env.ENABLE_V8_GLOBAL;

  beforeAll(async () => {
    expect(process.env.DB_TYPE).toBe('postgres');
    await assertRealPostgresTestEnvironment();
    // The `/api/v8/finance-v2/*` surface (used below for the valuation results HTTP
    // proof) sits behind a pre-auth global gate that 404s unless explicitly enabled —
    // set it for this suite's real Gateway instance and restore it in afterAll.
    process.env.ENABLE_V8_GLOBAL = 'true';

    sql = new Client({ connectionString: String(process.env.DATABASE_URL) });
    await sql.connect();
    const target = await sql.query('SELECT current_database() AS database, inet_server_port() AS port');
    // Portable: this must pass against ANY local Postgres, not just a database literally
    // named "cx171" — pinning the database name here breaks the test on every other
    // developer's / worker's fixture database. We still prove a REAL server connection
    // (not a mock) by asserting a real database name and a real numeric server port came back.
    expect(typeof target.rows[0].database).toBe('string');
    expect(target.rows[0].database.length).toBeGreaterThan(0);
    expect(Number.isInteger(target.rows[0].port)).toBe(true);
    expect(target.rows[0].port).toBeGreaterThan(0);

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
    if (originalEnableV8Global === undefined) delete process.env.ENABLE_V8_GLOBAL;
    else process.env.ENABLE_V8_GLOBAL = originalEnableV8Global;
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

  it('GET /api/v8/finance-v2/valuation/variants/:businessVersionId/results carries organization_profiles.currency, and null when the profile has none', async () => {
    async function seedOrgWithMember(label: string) {
      const orgId = randomUUID();
      const uid = randomUUID();
      const email = `day171_${label}_${suffix}@example.test`;
      await sql.query(
        `INSERT INTO organizations (id, name, plan, status, is_active, created_at)
         VALUES ($1, $2, 'enterprise', 'active', 1, now())`,
        [orgId, `day171_${label}_${suffix}`]
      );
      await sql.query(
        `INSERT INTO users
           (id, organization_id, email, password, first_name, last_name, role, status, created_at)
         VALUES ($1, $2, $3, 'x', 'Piotr', 'Kontraktowy', 'ADMIN', 'active', now())`,
        [uid, orgId, email]
      );
      await sql.query(
        `INSERT INTO organization_members
           (id, organization_id, user_id, role, status, created_at)
         VALUES ($1, $2, $3, 'ADMIN', 'ACTIVE', now())`,
        [randomUUID(), orgId, uid]
      );
      const orgAuthorization = `Bearer ${jwt.sign(
        { id: uid, userId: uid, email, organizationId: orgId, organization_id: orgId, role: 'ADMIN' },
        config.JWT_SECRET,
        { algorithm: 'HS256', expiresIn: '1h' }
      )}`;
      return { orgId, orgAuthorization };
    }

    async function makeValuationBusinessVersionId(orgAuthorization: string) {
      const created = await request(app)
        .post('/api/v8/finance-v2/artifacts')
        .set('Authorization', orgAuthorization)
        .send({ artifactType: 'VALUATION_CASE' });
      expect(created.status, JSON.stringify(created.body)).toBe(201);
      return created.body.data.currentBusinessVersion.businessVersionId as string;
    }

    const withCurrency = await seedOrgWithMember('val-cur');
    await sql.query(
      `INSERT INTO organization_profiles (id, organization_id, currency) VALUES ($1, $2, 'EUR')`,
      [randomUUID(), withCurrency.orgId]
    );
    const bvWithCurrency = await makeValuationBusinessVersionId(withCurrency.orgAuthorization);
    const withCurrencyResponse = await request(app)
      .get(`/api/v8/finance-v2/valuation/variants/${bvWithCurrency}/results`)
      .set('Authorization', withCurrency.orgAuthorization);
    expect(withCurrencyResponse.status, JSON.stringify(withCurrencyResponse.body)).toBe(200);
    expect(withCurrencyResponse.body.data.currency).toBe('EUR');

    const withoutCurrency = await seedOrgWithMember('val-nocur');
    const bvWithoutCurrency = await makeValuationBusinessVersionId(withoutCurrency.orgAuthorization);
    const withoutCurrencyResponse = await request(app)
      .get(`/api/v8/finance-v2/valuation/variants/${bvWithoutCurrency}/results`)
      .set('Authorization', withoutCurrency.orgAuthorization);
    expect(withoutCurrencyResponse.status, JSON.stringify(withoutCurrencyResponse.body)).toBe(200);
    expect(withoutCurrencyResponse.body.data.currency).toBeNull();
  });
});
