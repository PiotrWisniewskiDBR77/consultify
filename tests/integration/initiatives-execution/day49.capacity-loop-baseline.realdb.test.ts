/** @vitest-environment node */
import { randomUUID } from 'node:crypto';

import express from 'express';
import jwt from 'jsonwebtoken';
import { Client } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ApiGateway } from '../../../server/src/Gateway.js';
import { assertRealPostgresTestEnvironment } from '../_helpers/assertRealPostgres.js';

const databaseUrl = process.env.DATABASE_URL ?? '';
const jwtSecret = 'day49-test-jwt-secret-key-min-32-chars';
const NO_RETRY = { retry: 0 } as const;

describe('Day 49 A.1 capacity loop baseline through the real ApiGateway', NO_RETRY, () => {
  const suffix = randomUUID();
  const organizationId = `day49-a1-${suffix}`;
  const foreignOrganizationId = `day49-a1-foreign-${suffix}`;
  const userId = randomUUID();
  const planId = `plan-${suffix}`;
  const capacityId = `capacity-${suffix}`;
  const app = express();
  const sql = new Client({ connectionString: databaseUrl });

  const token = jwt.sign(
    { id: userId, userId, organizationId, organization_id: organizationId, role: 'OWNER' },
    jwtSecret,
    { algorithm: 'HS256', expiresIn: '1h' }
  );
  const auth = {
    Authorization: `Bearer ${token}`,
    'x-org-context': organizationId,
  };

  const range = (unit: string, value: number | null, knowledgeState = 'ESTIMATED') => ({
    low: value === null ? null : value - 1,
    base: value,
    high: value === null ? null : value + 1,
    unit,
    knowledgeState: value === null ? 'UNKNOWN' : knowledgeState,
    confidence: value === null ? 'UNKNOWN' : 'MEDIUM',
    sourceRefs: value === null ? [] : [{ ref: `capacity:${capacityId}`, version: 3 }],
  });
  const option = (kind: 'RESEQUENCE' | 'SCOPE_SPLIT' | 'ADD_CAPACITY') => ({
    optionId: `${kind.toLowerCase()}-${suffix}`,
    kind,
    assumptions: [
      {
        assumption: 'Założenie oparte na opublikowanych scenariuszach',
        ownerId: userId,
        sourceRef: { ref: `plan:${planId}`, version: 4 },
        knowledgeState: 'ESTIMATED',
      },
    ],
    affectedMemberships: [{ initiativeId: `initiative-${suffix}`, membershipVersion: 1 }],
    affectedPeriods: ['2026-W35'],
    affectedResources: [{ resourceRef: `team-${suffix}`, version: 1 }],
    impact: {
      date: range('days', kind === 'RESEQUENCE' ? 5 : null),
      scope: range('items', kind === 'SCOPE_SPLIT' ? 2 : null),
      cost: range('PLN', kind === 'ADD_CAPACITY' ? 100 : null),
      risk: range('score', null),
    },
    rationale: `Opcja ${kind} dla okresu 2026-W35 i zespołu ${suffix}`,
  });
  const command = (options: unknown[]) => ({
    expectedVersion: 0,
    clientRequestId: randomUUID(),
    planRef: { scenarioId: planId, version: 4 },
    capacityRef: { scenarioId: capacityId, version: 3 },
    options,
  });

  beforeAll(async () => {
    await assertRealPostgresTestEnvironment();
    process.env.JWT_SECRET = jwtSecret;
    await sql.connect();
    app.use(express.json());
    ApiGateway.getInstance().initializeRoutes(app);
    for (const orgId of [organizationId, foreignOrganizationId]) {
      await sql.query(`INSERT INTO organizations(id,name,status) VALUES($1,$1,'active')`, [orgId]);
    }
    await sql.query(
      `INSERT INTO users(id,email,password,role,organization_id,status)
       VALUES($1,$2,'test','OWNER',$3,'active')`,
      [userId, `${userId}@day49.invalid`, organizationId]
    );
    await sql.query(
      `INSERT INTO organization_members(id,organization_id,user_id,role,status)
       VALUES($1,$2,$3,'OWNER','ACTIVE')`,
      [randomUUID(), organizationId, userId]
    );
    await sql.query(
      `INSERT INTO ie_aggregate_state
         (organization_id,aggregate_type,aggregate_id,version,payload_json)
       VALUES
         ($1,'plan_scenario',$2,4,$3::jsonb),
         ($1,'capacity_scenario',$4,3,$5::jsonb)`,
      [
        organizationId,
        planId,
        JSON.stringify({
          scenarioId: planId,
          status: 'PUBLISHED',
          scenarioVersion: 4,
          windowUnit: 'WEEK',
          timezone: 'Europe/Warsaw',
          periods: [{ periodId: '2026-W35', start: '2026-08-24', end: '2026-08-31' }],
          memberships: [{ initiativeId: `initiative-${suffix}`, initiativeVersion: 1 }],
        }),
        capacityId,
        JSON.stringify({
          scenarioId: capacityId,
          status: 'PUBLISHED',
          scenarioVersion: 3,
          planScenarioId: planId,
          planScenarioVersion: 4,
          windowUnit: 'WEEK',
          timezone: 'Europe/Warsaw',
          periods: [{ periodId: '2026-W35', start: '2026-08-24', end: '2026-08-31' }],
          commitments: [],
        }),
      ]
    );
  }, 30_000);

  afterAll(async () => {
    await sql.query(`DELETE FROM ie_aggregate_state WHERE organization_id=$1`, [organizationId]);
    await sql.query(`DELETE FROM organization_members WHERE organization_id=$1`, [organizationId]);
    await sql.query(`DELETE FROM users WHERE id=$1`, [userId]);
    await sql.query(`DELETE FROM organizations WHERE id=ANY($1)`, [
      [organizationId, foreignOrganizationId],
    ]);
    await sql.end();
  });

  it('returns an honest empty list for a fresh organization', async () => {
    const response = await request(app)
      .get('/api/initiatives/runtime-v1/capacity-options')
      .set(auth);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ items: [] });
  });

  it('rejects an unauthenticated read', async () => {
    const response = await request(app).get('/api/initiatives/runtime-v1/capacity-options');
    expect(response.status).toBe(401);
  });

  it('rejects a command without the three canonical options', async () => {
    const response = await request(app)
      .post(`/api/initiatives/runtime-v1/capacity-options/missing-${suffix}`)
      .set(auth)
      .send(command([option('RESEQUENCE')]));
    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: { code: 'COMMAND_VALIDATION_FAILED' } });
  });

  it('rejects UNKNOWN carrying numeric zero', async () => {
    const options = [option('RESEQUENCE'), option('SCOPE_SPLIT'), option('ADD_CAPACITY')];
    options[0].impact.cost = {
      ...options[0].impact.cost,
      low: 0,
      base: 0,
      high: 0,
    };
    const response = await request(app)
      .post(`/api/initiatives/runtime-v1/capacity-options/unknown-zero-${suffix}`)
      .set(auth)
      .send(command(options));
    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: { code: 'COMMAND_VALIDATION_FAILED' } });
  });

  it('persists the canonical three and reads them back through a fresh GET', async () => {
    const comparisonId = `comparison-${suffix}`;
    const created = await request(app)
      .post(`/api/initiatives/runtime-v1/capacity-options/${comparisonId}`)
      .set(auth)
      .send(command([option('RESEQUENCE'), option('SCOPE_SPLIT'), option('ADD_CAPACITY')]));
    expect(created.status).toBe(200);
    const independent = new Client({ connectionString: databaseUrl });
    await independent.connect();
    const stored = await independent.query(
      `SELECT aggregate_id FROM ie_aggregate_state
       WHERE organization_id=$1 AND aggregate_type='capacity_options' AND aggregate_id=$2`,
      [organizationId, comparisonId]
    );
    await independent.end();
    expect(stored.rows).toEqual([{ aggregate_id: comparisonId }]);
    const readback = await request(app)
      .get('/api/initiatives/runtime-v1/capacity-options')
      .set(auth);
    expect(readback.status).toBe(200);
    expect(
      readback.body.items[0].options.map((item: { kind: string }) => item.kind).sort()
    ).toEqual(['ADD_CAPACITY', 'RESEQUENCE', 'SCOPE_SPLIT']);
  });

  it('ignores foreign organization hints and leaves the foreign tenant unchanged', async () => {
    const before = await sql.query(
      `SELECT count(*)::int AS count FROM ie_aggregate_state WHERE organization_id=$1`,
      [foreignOrganizationId]
    );
    const response = await request(app)
      .post(`/api/initiatives/runtime-v1/capacity-options/foreign-hint-${suffix}`)
      .set(auth)
      .set('x-org-context', foreignOrganizationId)
      .send({ ...command([]), organizationId: foreignOrganizationId });
    expect(response.status).not.toBe(200);
    const after = await sql.query(
      `SELECT count(*)::int AS count FROM ie_aggregate_state WHERE organization_id=$1`,
      [foreignOrganizationId]
    );
    expect(after.rows).toEqual(before.rows);
  });
});
