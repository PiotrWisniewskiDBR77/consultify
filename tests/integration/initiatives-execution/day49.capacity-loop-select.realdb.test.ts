/** @vitest-environment node */
// FIX-3 (Day 49, §A.4 — backend-only): proves the propose -> select governed-input
// contract through the REAL ApiGateway, asserting on data shape only. Does not
// touch anything under src/components/Execution/**.
//
// The shape this proves is exactly what
// src/components/Execution/ExecutionControlSurface.tsx:529-536 depends on:
//   comparison.options.find(o => o.optionId === comparison.selectedOptionId && o.kind === 'RESEQUENCE')
//   comparison.planRef.scenarioId
import { randomUUID } from 'node:crypto';

import express from 'express';
import jwt from 'jsonwebtoken';
import { Client } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ApiGateway } from '../../../server/src/Gateway.js';
import { assertRealPostgresTestEnvironment } from '../_helpers/assertRealPostgres.js';

const databaseUrl = process.env.DATABASE_URL ?? '';
const jwtSecret = process.env.JWT_SECRET || 'test-jwt-secret-key-min-32-chars-long-for-validation';
const NO_RETRY = { retry: 0 } as const;

describe('Day 49 §A.4 capacity-options select through the real ApiGateway', NO_RETRY, () => {
  const suffix = randomUUID();
  const organizationId = `day49-a4-${suffix}`;
  const foreignOrganizationId = `day49-a4-foreign-${suffix}`;
  const userId = randomUUID();
  const foreignUserId = randomUUID();
  const planId = `plan-a4-${suffix}`;
  const capacityId = `capacity-a4-${suffix}`;
  const app = express();
  const sql = new Client({ connectionString: databaseUrl });

  const signToken = (uid: string, orgId: string) =>
    jwt.sign(
      { id: uid, userId: uid, organizationId: orgId, organization_id: orgId, role: 'OWNER' },
      jwtSecret,
      { algorithm: 'HS256', expiresIn: '1h' }
    );
  const auth = {
    Authorization: `Bearer ${signToken(userId, organizationId)}`,
    'x-org-context': organizationId,
  };
  const foreignAuth = {
    Authorization: `Bearer ${signToken(foreignUserId, foreignOrganizationId)}`,
    'x-org-context': foreignOrganizationId,
  };

  const planPeriod = { periodId: '2026-W36', start: '2026-08-31', end: '2026-09-07' };
  const publishedPlan = (scenarioId: string) => ({
    scenarioId,
    status: 'PUBLISHED',
    scenarioVersion: 4,
    windowUnit: 'WEEK',
    timezone: 'Europe/Warsaw',
    periods: [planPeriod],
    windows: [
      {
        initiativeId: `initiative-${suffix}`,
        initiativeVersion: 1,
        earliest: '2026-08-31',
        target: '2026-09-02',
        latest: '2026-09-07',
        confidence: 'HIGH',
        rationale: 'Okno z opublikowanego planu',
        dependencySnapshot: [],
        constraintSnapshot: [],
      },
    ],
    assumptions: [],
    createdBy: userId,
    updatedBy: userId,
    publishedBy: userId,
    publishedAt: '2026-08-28T00:00:00.000Z',
  });
  const knownRange = (value: number) => ({
    knowledgeState: 'KNOWN',
    low: value,
    base: value,
    high: value,
    sourceRef: 'demand-ledger',
    sourceVersion: 1,
    asOf: '2026-08-28T00:00:00.000Z',
    confidence: 'HIGH',
    ownerId: userId,
    reason: null,
  });
  const publishedCapacity = (scenarioId: string, planScenarioId: string) => ({
    scenarioId,
    status: 'PUBLISHED',
    scenarioVersion: 3,
    planScenarioId,
    planScenarioVersion: 4,
    windowUnit: 'WEEK',
    timezone: 'Europe/Warsaw',
    periods: [
      { periodId: planPeriod.periodId, start: planPeriod.start, end: planPeriod.end, demand: knownRange(8), supply: knownRange(4) },
    ],
    constraints: [],
    proposedAssignments: [
      {
        assignmentId: `assignment-${suffix}`,
        initiativeId: `initiative-${suffix}`,
        resourceOrRoleId: `team-${suffix}`,
        periodIds: [planPeriod.periodId],
        demand: knownRange(8),
        rationale: 'Przypisanie opublikowanego scenariusza',
      },
    ],
    createdBy: userId,
    updatedBy: userId,
    publishedBy: userId,
    publishedAt: '2026-08-28T00:00:00.000Z',
  });

  const propose = (comparisonId: string, planRef = { scenarioId: planId, version: 4 }) =>
    request(app)
      .post(`/api/initiatives/runtime-v1/capacity-options/${comparisonId}/propose`)
      .set(auth)
      .send({
        expectedVersion: 0,
        clientRequestId: randomUUID(),
        planRef,
        capacityRef: { scenarioId: capacityId, version: 3 },
      });

  const getComparison = async (comparisonId: string) => {
    const res = await request(app).get('/api/initiatives/runtime-v1/capacity-options').set(auth);
    expect(res.status).toBe(200);
    const item = res.body.items.find((i: { comparisonId: string }) => i.comparisonId === comparisonId);
    expect(item, `comparison ${comparisonId} must exist in GET /capacity-options`).toBeDefined();
    return item;
  };

  beforeAll(async () => {
    await assertRealPostgresTestEnvironment();
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
      `INSERT INTO users(id,email,password,role,organization_id,status)
       VALUES($1,$2,'test','OWNER',$3,'active')`,
      [foreignUserId, `${foreignUserId}@day49.invalid`, foreignOrganizationId]
    );
    await sql.query(
      `INSERT INTO organization_members(id,organization_id,user_id,role,status)
       VALUES($1,$2,$3,'OWNER','ACTIVE')`,
      [randomUUID(), organizationId, userId]
    );
    await sql.query(
      `INSERT INTO organization_members(id,organization_id,user_id,role,status)
       VALUES($1,$2,$3,'OWNER','ACTIVE')`,
      [randomUUID(), foreignOrganizationId, foreignUserId]
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
        JSON.stringify(publishedPlan(planId)),
        capacityId,
        JSON.stringify(publishedCapacity(capacityId, planId)),
      ]
    );
  }, 30_000);

  afterAll(async () => {
    await sql.query(`DELETE FROM ie_aggregate_state WHERE organization_id=ANY($1)`, [
      [organizationId, foreignOrganizationId],
    ]);
    await sql.query(`DELETE FROM organization_members WHERE organization_id=ANY($1)`, [
      [organizationId, foreignOrganizationId],
    ]);
    await sql.query(`DELETE FROM users WHERE id=ANY($1)`, [[userId, foreignUserId]]);
    await sql.query(`DELETE FROM organizations WHERE id=ANY($1)`, [
      [organizationId, foreignOrganizationId],
    ]);
    await sql.end();
  });

  it('1) happy path: propose -> GET DRAFT -> select RESEQUENCE -> GET SELECTED with governed input', async () => {
    const comparisonId = `select-happy-${suffix}`;

    const proposed = await propose(comparisonId);
    expect(proposed.status, JSON.stringify(proposed.body)).toBe(200);

    const draft = await getComparison(comparisonId);
    expect(draft.status).toBe('DRAFT');
    expect(draft.options).toHaveLength(3);
    expect(draft.options.map((o: { kind: string }) => o.kind).sort()).toEqual([
      'ADD_CAPACITY',
      'RESEQUENCE',
      'SCOPE_SPLIT',
    ]);

    const resequenceOption = draft.options.find((o: { kind: string }) => o.kind === 'RESEQUENCE');
    expect(resequenceOption).toBeDefined();

    const selected = await request(app)
      .post(`/api/initiatives/runtime-v1/capacity-options/${comparisonId}/select`)
      .set(auth)
      .send({
        expectedVersion: draft.version,
        clientRequestId: randomUUID(),
        optionId: resequenceOption.optionId,
        nextKind: 'MATERIAL_CHANGE',
      });
    expect(selected.status, JSON.stringify(selected.body)).toBe(200);

    const afterSelect = await getComparison(comparisonId);
    expect(afterSelect.status).toBe('SELECTED');
    expect(afterSelect.selectedOptionId).toBe(resequenceOption.optionId);
    const selectedOption = afterSelect.options.find(
      (o: { optionId: string }) => o.optionId === afterSelect.selectedOptionId
    );
    expect(selectedOption?.kind).toBe('RESEQUENCE');
    expect(afterSelect.planRef?.scenarioId).toBe(planId);
    expect(afterSelect.nextGovernedInput).not.toBeNull();
    expect(afterSelect.nextGovernedInput.kind).toBe('MATERIAL_CHANGE');
    expect(afterSelect.nextGovernedInput.optionId).toBe(resequenceOption.optionId);
  });

  it('2) refuses select against an optionId that is not part of the draft comparison', async () => {
    const comparisonId = `select-badoption-${suffix}`;
    const proposed = await propose(comparisonId);
    expect(proposed.status, JSON.stringify(proposed.body)).toBe(200);
    const draft = await getComparison(comparisonId);

    const response = await request(app)
      .post(`/api/initiatives/runtime-v1/capacity-options/${comparisonId}/select`)
      .set(auth)
      .send({
        expectedVersion: draft.version,
        clientRequestId: randomUUID(),
        optionId: 'not-a-real-option-id',
        nextKind: 'MATERIAL_CHANGE',
      });
    expect(response.status).not.toBe(200);
    expect(response.status).toBeGreaterThanOrEqual(400);

    const stillDraft = await getComparison(comparisonId);
    expect(stillDraft.status).toBe('DRAFT');
    expect(stillDraft.selectedOptionId).toBeNull();
  });

  it('3) refuses propose whose planRef does not match the published plan version', async () => {
    const comparisonId = `select-badplanref-${suffix}`;
    const response = await propose(comparisonId, { scenarioId: planId, version: 999 });
    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: { code: 'EXACT_PUBLISHED_SCENARIOS_REQUIRED' } });

    const check = await request(app).get('/api/initiatives/runtime-v1/capacity-options').set(auth);
    expect(
      check.body.items.some((i: { comparisonId: string }) => i.comparisonId === comparisonId)
    ).toBe(false);
  });

  it('4) refuses a foreign tenant selecting against this organization comparison', async () => {
    const comparisonId = `select-foreign-${suffix}`;
    const proposed = await propose(comparisonId);
    expect(proposed.status, JSON.stringify(proposed.body)).toBe(200);
    const draft = await getComparison(comparisonId);
    const resequenceOption = draft.options.find((o: { kind: string }) => o.kind === 'RESEQUENCE');

    const response = await request(app)
      .post(`/api/initiatives/runtime-v1/capacity-options/${comparisonId}/select`)
      .set(foreignAuth)
      .send({
        expectedVersion: draft.version,
        clientRequestId: randomUUID(),
        optionId: resequenceOption.optionId,
        nextKind: 'MATERIAL_CHANGE',
      });
    expect(response.status).not.toBe(200);
    expect(response.status).toBeGreaterThanOrEqual(400);

    const stillDraft = await getComparison(comparisonId);
    expect(stillDraft.status).toBe('DRAFT');
    expect(stillDraft.selectedOptionId).toBeNull();
  });

  it('5) refuses an unauthenticated select with 401', async () => {
    const comparisonId = `select-unauth-${suffix}`;
    const proposed = await propose(comparisonId);
    expect(proposed.status, JSON.stringify(proposed.body)).toBe(200);
    const draft = await getComparison(comparisonId);
    const resequenceOption = draft.options.find((o: { kind: string }) => o.kind === 'RESEQUENCE');

    const response = await request(app)
      .post(`/api/initiatives/runtime-v1/capacity-options/${comparisonId}/select`)
      .send({
        expectedVersion: draft.version,
        clientRequestId: randomUUID(),
        optionId: resequenceOption.optionId,
        nextKind: 'MATERIAL_CHANGE',
      });
    expect(response.status).toBe(401);
  });
});
