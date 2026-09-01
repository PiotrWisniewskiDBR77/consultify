/** @vitest-environment node */

import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';

import express, { type Express } from 'express';
import jwt from 'jsonwebtoken';
import { Client } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../../../../tests/integration/_helpers/assertRealPostgres.js';
import config from '../../config/Config.js';
import { ApiGateway } from '../../Gateway.js';

const NO_RETRY = { retry: 0 } as const;
const ARTIFACT = '/private/tmp/cx-day168-wskaznik-bootstrap-artefakty/day168-http-db-evidence.json';

describe('Day 168 KPI bootstrap through the real ApiGateway and PostgreSQL', NO_RETRY, () => {
  const suffix = randomUUID().replaceAll('-', '');
  const organizationId = randomUUID();
  const userId = randomUUID();
  const evidence: Record<string, unknown> = {};
  let app: Express;
  let sql: Client;
  let authorization: string;
  let kpiId: string;

  beforeAll(async () => {
    process.env.DB_TYPE = 'postgres';
    expect(process.env.DB_TYPE).toBe('postgres');
    await assertRealPostgresTestEnvironment();

    sql = new Client({ connectionString: String(process.env.DATABASE_URL) });
    await sql.connect();
    const target = await sql.query(
      'SELECT current_database() AS database, inet_server_port() AS port'
    );
    expect(target.rows[0].database.length).toBeGreaterThan(0);
    expect(target.rows[0].port).toBeGreaterThan(0);

    await sql.query(
      `INSERT INTO organizations (id, name, plan, status, is_active, created_at)
       VALUES ($1, $2, 'enterprise', 'active', 1, now())`,
      [organizationId, `day168_${suffix}`]
    );
    await sql.query(
      `INSERT INTO users
         (id, organization_id, email, password, first_name, last_name, role, status, created_at)
       VALUES ($1, $2, $3, 'x', 'Day', 'One Sixty Eight', 'ADMIN', 'active', now())`,
      [userId, organizationId, `day168_${suffix}@example.test`]
    );
    await sql.query(
      `INSERT INTO organization_members
         (id, organization_id, user_id, role, status, created_at)
       VALUES ($1, $2, $3, 'ADMIN', 'ACTIVE', now())`,
      [randomUUID(), organizationId, userId]
    );

    authorization = `Bearer ${jwt.sign(
      {
        id: userId,
        userId,
        email: `day168_${suffix}@example.test`,
        organizationId,
        organization_id: organizationId,
        role: 'ADMIN',
      },
      config.JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '1h' }
    )}`;
    app = express();
    app.use(express.json());
    ApiGateway.getInstance().initializeRoutes(app);
  });

  afterAll(async () => {
    writeFileSync(ARTIFACT, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
    if (sql) await sql.end();
  });

  it('creates the first KPI, persists cadence, edits it, and round-trips a measurement', async () => {
    const policyBefore = await sql.query(
      `SELECT organization_id, domain, visibility_mode, is_active
         FROM rvn_platform_visibility_policies
        WHERE organization_id = $1 AND domain = 'kpi'`,
      [organizationId]
    );
    expect(policyBefore.rows).toEqual([]);

    const create = await request(app)
      .post('/api/vnext/results/kpi')
      .set('Authorization', authorization)
      .send({
        kpiCode: `D168-${suffix.slice(0, 8)}`,
        name: 'Day 168 first KPI',
        targetGeometry: 'threshold_min',
        targetValue: 100,
        measurementFrequencyDays: 30,
        idempotencyKey: `day168-create-${suffix}`,
      });
    expect(create.status, JSON.stringify(create.body)).toBe(201);
    expect(create.body).toMatchObject({ outcome: 'applied' });
    kpiId = create.body.kpi.kpiId;

    const createReadback = await sql.query(
      `SELECT kd.kpi_id, dv.definition_version_id, dv.measurement_frequency_days, dv.row_version
         FROM rvn_kpi_definitions kd
         JOIN rvn_kpi_definition_versions dv
           ON dv.definition_version_id = kd.current_definition_version_id
        WHERE kd.organization_id = $1 AND kd.kpi_id = $2`,
      [organizationId, kpiId]
    );
    expect(createReadback.rows[0].measurement_frequency_days).toBe(30);

    const edit = await request(app)
      .put(`/api/vnext/results/kpi/${kpiId}/draft`)
      .set('Authorization', authorization)
      .send({
        expectedVersion: createReadback.rows[0].row_version,
        measurementFrequencyDays: 14,
        idempotencyKey: `day168-edit-${suffix}`,
      });
    expect(edit.status, JSON.stringify(edit.body)).toBe(200);
    const editReadback = await sql.query(
      `SELECT measurement_frequency_days FROM rvn_kpi_definition_versions
        WHERE definition_version_id = $1`,
      [createReadback.rows[0].definition_version_id]
    );
    expect(editReadback.rows[0].measurement_frequency_days).toBe(14);

    const measurementBody = {
      periodStart: '2026-08-01T00:00:00.000Z',
      periodEnd: '2026-08-31T00:00:00.000Z',
      actualValue: 73.5,
      source: 'day168-runtime-proof',
      idempotencyKey: `day168-measure-${suffix}`,
    };
    const measurement = await request(app)
      .post(`/api/vnext/results/kpi/${kpiId}/measurements`)
      .set('Authorization', authorization)
      .send(measurementBody);
    expect(measurement.status, JSON.stringify(measurement.body)).toBe(201);

    const refresh = await request(app)
      .get(`/api/vnext/results/kpi/${kpiId}/measurements`)
      .set('Authorization', authorization);
    expect(refresh.status, JSON.stringify(refresh.body)).toBe(200);
    expect(refresh.body.measurements[0].actualValue).toBe(73.5);

    const policyAfter = await sql.query(
      `SELECT organization_id, domain, visibility_mode, is_active
         FROM rvn_platform_visibility_policies
        WHERE organization_id = $1 AND domain = 'kpi'`,
      [organizationId]
    );
    const measurementAfter = await sql.query(
      `SELECT * FROM rvn_kpi_measurements WHERE organization_id = $1 AND kpi_id = $2`,
      [organizationId, kpiId]
    );
    expect(policyAfter.rows).toHaveLength(1);
    expect(policyAfter.rows[0]).toMatchObject({
      domain: 'kpi',
      visibility_mode: 'OPEN_ORG',
      is_active: true,
    });
    expect(Number(measurementAfter.rows[0].actual_value)).toBe(73.5);

    Object.assign(evidence, {
      organizationId,
      create: { status: create.status, body: create.body },
      createReadback: createReadback.rows,
      edit: { status: edit.status, body: edit.body },
      editReadback: editReadback.rows,
      measurement: { status: measurement.status, body: measurement.body },
      refresh: { status: refresh.status, body: refresh.body },
      policyBefore: policyBefore.rows,
      policyAfter: policyAfter.rows,
      measurementAfter: measurementAfter.rows,
    });
  });

  it('proves OKR fails before Program publication and succeeds after its bootstrap path', async () => {
    const noPolicySet = await request(app)
      .post('/api/vnext/results/okr/sets')
      .set('Authorization', authorization)
      .send({
        programId: randomUUID(),
        cycleId: randomUUID(),
        scopeType: 'company',
        scopeId: organizationId,
        ownerUserId: userId,
        title: 'Day 168 pre-policy set',
        idempotencyKey: `day168-okr-pre-${suffix}`,
      });
    expect(noPolicySet.status, JSON.stringify(noPolicySet.body)).toBe(409);
    expect(noPolicySet.body).toMatchObject({ code: 'NO_ACTIVE_VISIBILITY_POLICY' });

    const program = await request(app)
      .post('/api/vnext/results/okr/programs')
      .set('Authorization', authorization)
      .send({
        name: 'Day 168 Program',
        cycleModel: 'quarterly',
        annualDirectionEnabled: false,
        objectiveMinRecommended: null,
        objectiveMaxRecommended: null,
        krMinRequired: 2,
        krMaxRecommended: null,
        checkinFrequency: 'biweekly',
        approvalRequired: true,
        scoringModel: 'zero_to_one',
        objectiveRollupModel: 'none',
        confidenceEnabled: true,
        confidenceModel: 'high_medium_low',
        objectiveConfidenceModel: 'lowest_kr',
        visibilityDefault: 'OPEN_ORG',
        committedVsAspirationalEnabled: true,
        managerReviewRequired: true,
        selfReviewRequired: false,
        reflectionRequiredForClose: false,
        recognitionEnabled: true,
        idempotencyKey: `day168-program-${suffix}`,
      });
    expect(program.status, JSON.stringify(program.body)).toBe(201);
    const programId = program.body.program.programId;

    const publish = await request(app)
      .post(`/api/vnext/results/okr/programs/${programId}/publish`)
      .set('Authorization', authorization)
      .send({
        expectedVersion: program.body.resultingVersion,
        idempotencyKey: `day168-publish-${suffix}`,
      });
    expect(publish.status, JSON.stringify(publish.body)).toBe(200);

    const cycle = await request(app)
      .post('/api/vnext/results/okr/cycles')
      .set('Authorization', authorization)
      .send({
        programId,
        name: 'Day 168 Cycle',
        startDate: '2026-09-01T00:00:00.000Z',
        endDate: '2026-12-31T00:00:00.000Z',
        draftOpenAt: '2026-08-31T00:00:00.000Z',
        submissionDueAt: '2026-09-05T00:00:00.000Z',
        activeStartAt: '2026-09-06T00:00:00.000Z',
        finalUpdateDueAt: '2026-12-20T00:00:00.000Z',
        reviewOpenAt: '2026-12-21T00:00:00.000Z',
        reflectionDueAt: '2026-12-27T00:00:00.000Z',
        closeAt: '2026-12-31T00:00:00.000Z',
        idempotencyKey: `day168-cycle-${suffix}`,
      });
    expect(cycle.status, JSON.stringify(cycle.body)).toBe(201);

    const set = await request(app)
      .post('/api/vnext/results/okr/sets')
      .set('Authorization', authorization)
      .send({
        programId,
        cycleId: cycle.body.cycle.cycleId,
        scopeType: 'company',
        scopeId: organizationId,
        ownerUserId: userId,
        title: 'Day 168 post-policy set',
        idempotencyKey: `day168-okr-post-${suffix}`,
      });
    expect(set.status, JSON.stringify(set.body)).toBe(201);

    evidence.okr = {
      noPolicySet: { status: noPolicySet.status, body: noPolicySet.body },
      program: { status: program.status, body: program.body },
      publish: { status: publish.status, body: publish.body },
      cycle: { status: cycle.status, body: cycle.body },
      set: { status: set.status, body: set.body },
    };
  });
});
