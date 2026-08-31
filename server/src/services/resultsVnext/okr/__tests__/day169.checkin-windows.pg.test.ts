/** @vitest-environment node */

import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';

import express, { type Express } from 'express';
import jwt from 'jsonwebtoken';
import { Client } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import config from '../../../../config/Config.js';
import { ApiGateway } from '../../../../Gateway.js';
import { assertRealPostgresTestEnvironment } from '../../../../../../tests/integration/_helpers/assertRealPostgres.js';

const NO_RETRY = { retry: 0 } as const;
const ARTIFACT = '/private/tmp/cx-day169-cele-checkin-artefakty/day169-http-db-evidence.json';
const API = '/api/vnext/results/okr';

type Evidence = {
  scenario: string;
  step: string;
  status: number;
  response?: unknown;
  database?: unknown;
};

describe('Day 169 check-in windows through real ApiGateway and PostgreSQL', NO_RETRY, () => {
  let app: Express;
  let sql: Client;
  const evidence: Evidence[] = [];
  const ownedOrganizationIds: string[] = [];

  beforeAll(async () => {
    process.env.DB_TYPE = 'postgres';
    expect(process.env.DB_TYPE).toBe('postgres');
    expect(process.env.MOCK_DB).toBe('false');
    expect(process.env.ENABLE_TEST_AUTH_BYPASS).toBe('false');
    expect(process.env.RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE).toBe('enforce');
    await assertRealPostgresTestEnvironment();
    sql = new Client({ connectionString: String(process.env.DATABASE_URL) });
    await sql.connect();
    const target = await sql.query<{ database: string; port: number }>(
      'SELECT current_database() AS database, inet_server_port() AS port'
    );
    expect(target.rows[0]).toEqual({ database: 'cx169', port: 5432 });
    app = express();
    app.use(express.json());
    ApiGateway.getInstance().initializeRoutes(app);
  }, 30_000);

  afterAll(async () => {
    writeFileSync(ARTIFACT, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
    if (sql) await sql.end();
  });

  const authHeader = (userId: string, organizationId: string, role: 'ADMIN' | 'OWNER') =>
    `Bearer ${jwt.sign(
      {
        id: userId,
        userId,
        email: `${userId}@day169.test`,
        organizationId,
        organization_id: organizationId,
        role,
      },
      config.JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '1h' }
    )}`;

  const post = async (
    token: string,
    organizationId: string,
    path: string,
    body: Record<string, unknown>,
    expectedStatus: number | number[] = [200, 201]
  ) => {
    const response = await request(app)
      .post(`${API}${path}`)
      .set('Authorization', token)
      .set('x-org-context', organizationId)
      .send(body);
    const expected = Array.isArray(expectedStatus) ? expectedStatus : [expectedStatus];
    expect(expected, JSON.stringify(response.body)).toContain(response.status);
    return response;
  };

  async function buildScenario(scenario: 'set-before-cycle' | 'set-after-cycle') {
    const organizationId = randomUUID();
    const adminId = randomUUID();
    const ownerId = randomUUID();
    ownedOrganizationIds.push(organizationId);
    await sql.query(
      `INSERT INTO organizations (id, name, plan, status, is_active, created_at)
       VALUES ($1, $2, 'enterprise', 'active', 1, now())`,
      [organizationId, `Day169 ${scenario}`]
    );
    for (const [userId, role] of [
      [adminId, 'ADMIN'],
      [ownerId, 'OWNER'],
    ] as const) {
      await sql.query(
        `INSERT INTO users
           (id, organization_id, email, password, first_name, last_name, role, status, created_at)
         VALUES ($1, $2, $3, 'x', 'Day', '169', $4, 'active', now())`,
        [userId, organizationId, `${userId}@day169.test`, role]
      );
      await sql.query(
        `INSERT INTO organization_members
           (id, organization_id, user_id, role, status, created_at)
         VALUES ($1, $2, $3, $4, 'ACTIVE', now())`,
        [randomUUID(), organizationId, userId, role]
      );
    }
    const admin = authHeader(adminId, organizationId, 'ADMIN');
    const owner = authHeader(ownerId, organizationId, 'OWNER');

    const programResponse = await post(admin, organizationId, '/programs', {
      name: `Day169 ${scenario}`,
      cycleModel: 'quarterly',
      annualDirectionEnabled: false,
      objectiveMinRecommended: null,
      objectiveMaxRecommended: null,
      krMinRequired: 2,
      krMaxRecommended: null,
      checkinFrequency: 'weekly',
      approvalRequired: true,
      scoringModel: 'zero_to_one',
      objectiveRollupModel: 'equal_average',
      confidenceEnabled: true,
      confidenceModel: 'high_medium_low',
      objectiveConfidenceModel: 'lowest_kr',
      visibilityDefault: 'OPEN_ORG',
      committedVsAspirationalEnabled: true,
      managerReviewRequired: true,
      selfReviewRequired: false,
      reflectionRequiredForClose: false,
      recognitionEnabled: true,
      idempotencyKey: randomUUID(),
    });
    const program = programResponse.body.program;
    await post(admin, organizationId, `/programs/${program.programId}/publish`, {
      expectedVersion: program.rowVersion,
      idempotencyKey: randomUUID(),
    });
    const cycleResponse = await post(admin, organizationId, '/cycles', {
      programId: program.programId,
      name: `Cycle ${scenario}`,
      startDate: '2026-08-01T00:00:00.000Z',
      endDate: '2026-10-01T00:00:00.000Z',
      draftOpenAt: '2026-07-01T00:00:00.000Z',
      submissionDueAt: '2026-07-20T00:00:00.000Z',
      activeStartAt: '2026-08-01T00:00:00.000Z',
      finalUpdateDueAt: '2026-09-20T00:00:00.000Z',
      reviewOpenAt: '2026-09-21T00:00:00.000Z',
      reflectionDueAt: '2026-09-25T00:00:00.000Z',
      closeAt: '2026-10-01T00:00:00.000Z',
      idempotencyKey: randomUUID(),
    });
    const cycle = cycleResponse.body.cycle;
    const drafting = await post(admin, organizationId, `/cycles/${cycle.cycleId}/open-drafting`, {
      expectedVersion: cycle.rowVersion,
      idempotencyKey: randomUUID(),
    });
    const cycleActivationVersion = drafting.body.resultingVersion;
    const setResponse = await post(owner, organizationId, '/sets', {
      programId: program.programId,
      cycleId: cycle.cycleId,
      scopeType: 'individual',
      scopeId: ownerId,
      ownerUserId: ownerId,
      reviewerUserId: adminId,
      title: `Set ${scenario}`,
      idempotencyKey: randomUUID(),
    });
    const set = setResponse.body.set;
    const objectiveResponse = await post(owner, organizationId, `/sets/${set.setId}/objectives`, {
      ownerUserId: ownerId,
      title: `Objective ${scenario}`,
      idempotencyKey: randomUUID(),
    });
    const objective = objectiveResponse.body.objective;
    const keyResultIds: string[] = [];
    for (const index of [1, 2]) {
      const krResponse = await post(owner, organizationId, `/objectives/${objective.objectiveId}/key-results`, {
        ownerUserId: ownerId,
        title: `KR ${scenario} ${index}`,
        measurementType: 'numeric',
        direction: 'increase',
        baselineValue: 0,
        targetValue: 100,
        currentValue: 0,
        idempotencyKey: randomUUID(),
      });
      keyResultIds.push(krResponse.body.keyResult.keyResultId);
    }
    const submitted = await post(owner, organizationId, `/sets/${set.setId}/submit`, {
      expectedVersion: set.rowVersion,
      idempotencyKey: randomUUID(),
    });
    const approved = await post(admin, organizationId, `/sets/${set.setId}/approve`, {
      expectedVersion: submitted.body.resultingVersion,
      idempotencyKey: randomUUID(),
    });

    const before = await sql.query(
      `SELECT
         (SELECT count(*)::int FROM okr_vnext_checkin_occurrences WHERE cycle_id = $1) AS occurrences,
         (SELECT count(*)::int FROM rvn_platform_obligations WHERE organization_id = $2 AND obligation_type = 'check_in') AS obligations`,
      [cycle.cycleId, organizationId]
    );
    expect(before.rows[0]).toEqual({ occurrences: 0, obligations: 0 });
    evidence.push({ scenario, step: 'before activation', status: 200, database: before.rows[0] });

    let occurrenceIds: string[];
    if (scenario === 'set-before-cycle') {
      const setActivated = await post(admin, organizationId, `/sets/${set.setId}/activate`, {
        expectedVersion: approved.body.resultingVersion,
        idempotencyKey: randomUUID(),
      });
      expect(setActivated.body.checkInSeeding).not.toBeNull();
      expect(setActivated.body.checkInSeeding.cadenceOccurrenceIds).toEqual([]);
      const cycleActivated = await post(admin, organizationId, `/cycles/${cycle.cycleId}/activate`, {
        expectedVersion: cycleActivationVersion,
        idempotencyKey: randomUUID(),
      });
      occurrenceIds = cycleActivated.body.checkInSeeding.cadenceOccurrenceIds;
      evidence.push({ scenario, step: 'cycle activation', status: cycleActivated.status, response: cycleActivated.body });
    } else {
      const cycleActivated = await post(admin, organizationId, `/cycles/${cycle.cycleId}/activate`, {
        expectedVersion: cycleActivationVersion,
        idempotencyKey: randomUUID(),
      });
      expect(cycleActivated.body.checkInSeeding.obligationsSeeded).toBe(0);
      const setActivated = await post(admin, organizationId, `/sets/${set.setId}/activate`, {
        expectedVersion: approved.body.resultingVersion,
        idempotencyKey: randomUUID(),
      });
      expect(setActivated.body.checkInSeeding).not.toBeNull();
      occurrenceIds = setActivated.body.checkInSeeding.cadenceOccurrenceIds;
      evidence.push({ scenario, step: 'late set activation', status: setActivated.status, response: setActivated.body });
    }
    expect(occurrenceIds.length).toBeGreaterThan(0);

    const seeded = await sql.query(
      `SELECT
         (SELECT count(*)::int FROM okr_vnext_checkin_occurrences WHERE cycle_id = $1) AS occurrences,
         (SELECT count(*)::int FROM rvn_platform_obligations WHERE organization_id = $2 AND obligation_type = 'check_in') AS obligations`,
      [cycle.cycleId, organizationId]
    );
    expect(seeded.rows[0].occurrences).toBe(occurrenceIds.length);
    expect(seeded.rows[0].obligations).toBe(occurrenceIds.length * 2);
    evidence.push({ scenario, step: 'after activation', status: 200, database: seeded.rows[0] });

    const checkIn = await post(owner, organizationId, `/key-results/${keyResultIds[0]}/check-ins`, {
      cadenceOccurrenceId: occurrenceIds[0],
      newValue: 50,
      note: `Day169 ${scenario} HTTP check-in`,
      idempotencyKey: randomUUID(),
    });
    const readback = await sql.query(
      `SELECT kr.current_value, kr.progress, obj.progress AS objective_progress,
              s.overall_progress AS set_progress
         FROM okr_vnext_key_results kr
         JOIN okr_vnext_objectives obj ON obj.objective_id = kr.objective_id
         JOIN okr_vnext_sets s ON s.set_id = kr.set_id
        WHERE kr.key_result_id = $1`,
      [keyResultIds[0]]
    );
    expect(Number(readback.rows[0].current_value)).toBe(50);
    expect(Number(readback.rows[0].progress)).toBe(0.5);
    expect(Number(readback.rows[0].objective_progress)).toBe(0.25);
    expect(Number(readback.rows[0].set_progress)).toBe(0.25);
    evidence.push({
      scenario,
      step: 'check-in and automatic rollup',
      status: checkIn.status,
      response: checkIn.body,
      database: readback.rows[0],
    });
  }

  it('R3: Set active before Cycle gets windows, obligations, HTTP check-in and rollup', async () => {
    await buildScenario('set-before-cycle');
  }, 60_000);

  it('R3/T4: Set active after Cycle gets obligations for existing windows and HTTP check-in', async () => {
    await buildScenario('set-after-cycle');
  }, 60_000);
});
