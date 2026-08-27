/** @vitest-environment node */

import { randomUUID } from 'node:crypto';

import express from 'express';
import jwt from 'jsonwebtoken';
import { Client } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import config from '../../../config/Config.js';
import initiativesRoutes from '../initiatives.routes.js';

const DATABASE_URL = process.env.DATABASE_URL || '';
const REAL_PG =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  DATABASE_URL.startsWith('postgres');

describe.skipIf(!REAL_PG)('Day 35 KPI policy authoring through the mounted router', () => {
  const tag = randomUUID();
  const organizationA = `day35-policy-a-${tag}`;
  const organizationB = `day35-policy-b-${tag}`;
  const ownerA = `day35-policy-owner-a-${tag}`;
  const ownerB = `day35-policy-owner-b-${tag}`;
  const viewerA = `day35-policy-viewer-a-${tag}`;
  const tokens: Record<string, string> = {};
  let client: Client;
  let app: express.Express;

  const auth = (key: string) => ({ Authorization: `Bearer ${tokens[key]}` });
  const path = (policyId: string) =>
    `/api/initiatives/runtime-v1/execution-control-kpi-policies/${policyId}`;
  const completeParameters = {
    impactWeights: { CRITICAL: 4, IMPORTANT: 2, SUPPORTING: 1 },
    atRiskThresholdDays: 3,
    capacitySaturationThreshold: { normalUpper: 0.6, saturatedUpper: 0.9 },
    capacityBuffer: 0.2,
    decisionSlaDays: { value: 4, unit: 'CALENDAR_DAYS' },
  };

  beforeAll(async () => {
    client = new Client({ connectionString: DATABASE_URL });
    await client.connect();
    await client.query(`INSERT INTO organizations(id,name) VALUES($1,$1),($2,$2)`, [
      organizationA,
      organizationB,
    ]);
    await client.query(
      `INSERT INTO users(id,organization_id,email,role,status)
       VALUES($1,$2,$3,'OWNER','active'),($4,$5,$6,'OWNER','active'),
             ($7,$2,$8,'USER','active')`,
      [
        ownerA,
        organizationA,
        `${ownerA}@example.test`,
        ownerB,
        organizationB,
        `${ownerB}@example.test`,
        viewerA,
        `${viewerA}@example.test`,
      ]
    );
    await client.query(
      `INSERT INTO organization_members(id,organization_id,user_id,role,status)
       VALUES($1,$2,$3,'OWNER','ACTIVE'),($4,$5,$6,'OWNER','ACTIVE'),
             ($7,$2,$8,'USER','ACTIVE')`,
      [
        `membership-${ownerA}`,
        organizationA,
        ownerA,
        `membership-${ownerB}`,
        organizationB,
        ownerB,
        `membership-${viewerA}`,
        viewerA,
      ]
    );

    for (const [key, id, organizationId, role] of [
      ['ownerA', ownerA, organizationA, 'OWNER'],
      ['ownerB', ownerB, organizationB, 'OWNER'],
      ['viewerA', viewerA, organizationA, 'USER'],
    ]) {
      tokens[key] = jwt.sign({ id, organizationId, role }, config.JWT_SECRET, {
        algorithm: 'HS256',
        expiresIn: '10m',
      });
    }

    app = express();
    app.use(express.json());
    app.use('/api/initiatives', initiativesRoutes);
  });

  afterAll(async () => {
    if (!client) return;
    for (const table of [
      'ie_command_receipts',
      'ie_audit_events',
      'ie_outbox_events',
      'ie_aggregate_state',
      'execution_control_kpi_policies',
    ]) {
      await client.query(`DELETE FROM ${table} WHERE organization_id = ANY($1)`, [
        [organizationA, organizationB],
      ]);
    }
    await client.query(`DELETE FROM organization_members WHERE organization_id = ANY($1)`, [
      [organizationA, organizationB],
    ]);
    await client.query(`DELETE FROM users WHERE organization_id = ANY($1)`, [
      [organizationA, organizationB],
    ]);
    await client.query(`DELETE FROM organizations WHERE id = ANY($1)`, [
      [organizationA, organizationB],
    ]);
    await client.end();
  });

  it('persists an incomplete policy and keeps dependent families decision-required', async () => {
    const policyId = `incomplete-${tag}`;
    const response = await request(app)
      .post(path(policyId))
      .set(auth('ownerA'))
      .send({
        expectedVersion: 0,
        clientRequestId: `incomplete-request-${tag}`,
        name: 'Incomplete fixture policy',
        parameters: { fixtureOnly: true },
      });
    expect(response.status, JSON.stringify(response.body)).toBe(201);

    const read = await request(app)
      .get(`/api/initiatives/runtime-v1/control-kpis?weekStart=2026-08-24&policyId=${policyId}`)
      .set(auth('ownerA'));
    expect(read.status).toBe(200);
    expect(read.body.policy.resolved).toBe(false);
    expect(read.body.policy.missingParameters).toHaveLength(5);
    expect(
      read.body.families
        .filter((family: any) => family.valueReason === 'DECISION_REQUIRED')
        .map((family: any) => family.family)
        .sort()
    ).toEqual(['capacity', 'decision-latency', 'initiative-risk']);
  });

  it('keeps CAS, audit and the policy row in one transaction', async () => {
    const policyId = `parallel-${tag}`;
    const attempts = await Promise.all(
      ['left', 'right'].map((side) =>
        request(app)
          .post(path(policyId))
          .set(auth('ownerA'))
          .send({
            expectedVersion: 0,
            clientRequestId: `parallel-${side}-${tag}`,
            name: `Parallel ${side}`,
            parameters: completeParameters,
          })
      )
    );
    expect(attempts.map((attempt) => attempt.status).sort()).toEqual([201, 409]);
    const readback = await client.query(
      `SELECT
         (SELECT COUNT(*)::int FROM ie_aggregate_state
           WHERE organization_id=$1 AND aggregate_type='execution_control_kpi_policy' AND aggregate_id=$2) states,
         (SELECT COUNT(*)::int FROM ie_audit_events
           WHERE organization_id=$1 AND aggregate_type='execution_control_kpi_policy' AND aggregate_id=$2) audits,
         (SELECT COUNT(*)::int FROM execution_control_kpi_policies
           WHERE organization_id=$1 AND policy_id=$2) policies,
         (SELECT row_version FROM execution_control_kpi_policies
           WHERE organization_id=$1 AND policy_id=$2) row_version`,
      [organizationA, policyId]
    );
    expect(readback.rows).toEqual([{ states: 1, audits: 1, policies: 1, row_version: 1 }]);
  });

  it('replays idempotently and advances both versions on a new request', async () => {
    const policyId = `versioned-${tag}`;
    const initial = {
      expectedVersion: 0,
      clientRequestId: `versioned-create-${tag}`,
      name: 'Versioned fixture policy',
      parameters: completeParameters,
    };
    const created = await request(app).post(path(policyId)).set(auth('ownerA')).send(initial);
    expect(created.status).toBe(201);
    const replayed = await request(app).post(path(policyId)).set(auth('ownerA')).send(initial);
    expect(replayed.status).toBe(200);
    expect(replayed.body).toMatchObject({
      status: 'REPLAYED',
      aggregateVersion: created.body.aggregateVersion,
      response: created.body.response,
    });
    const updated = await request(app)
      .post(path(policyId))
      .set(auth('ownerA'))
      .send({
        ...initial,
        expectedVersion: 1,
        clientRequestId: `versioned-update-${tag}`,
        name: 'Updated fixture policy',
      });
    expect(updated.status).toBe(201);
    expect(
      await client.query(
        `SELECT p.row_version,p.name,s.version,
                (SELECT COUNT(*)::int FROM ie_command_receipts
                  WHERE organization_id=$1 AND client_request_id=$3) receipts
           FROM execution_control_kpi_policies p
           JOIN ie_aggregate_state s
             ON s.organization_id=p.organization_id
            AND s.aggregate_type='execution_control_kpi_policy'
            AND s.aggregate_id=p.policy_id
          WHERE p.organization_id=$1 AND p.policy_id=$2`,
        [organizationA, policyId, initial.clientRequestId]
      )
    ).toMatchObject({
      rows: [{ row_version: 2, name: 'Updated fixture policy', version: 2, receipts: 1 }],
    });
  });

  it('rolls structural validation back without policy or audit residue', async () => {
    const policyId = `invalid-${tag}`;
    const invalid = await request(app)
      .post(path(policyId))
      .set(auth('ownerA'))
      .send({
        expectedVersion: 0,
        clientRequestId: `invalid-${tag}`,
        name: '',
        parameters: {},
      });
    expect(invalid.status).toBe(400);
    expect(
      await client.query(
        `SELECT
          (SELECT COUNT(*)::int FROM ie_audit_events WHERE aggregate_id=$1) audits,
          (SELECT COUNT(*)::int FROM execution_control_kpi_policies WHERE policy_id=$1) policies`,
        [policyId]
      )
    ).toMatchObject({ rows: [{ audits: 0, policies: 0 }] });
  });

  it('lets two organizations author the same complete policy identity', async () => {
    for (const owner of ['ownerA', 'ownerB']) {
      const response = await request(app)
        .post(path('execution-control'))
        .set(auth(owner))
        .send({
          expectedVersion: 0,
          clientRequestId: `complete-${owner}-${tag}`,
          name: 'Complete fixture policy',
          parameters: completeParameters,
        });
      expect(response.status, JSON.stringify(response.body)).toBe(201);
      const read = await request(app)
        .get(
          '/api/initiatives/runtime-v1/control-kpis?weekStart=2026-08-24&policyId=execution-control'
        )
        .set(auth(owner));
      expect(read.status).toBe(200);
      expect(read.body.policy).toMatchObject({ resolved: true, missingParameters: [] });
    }
    expect(
      await client.query(
        `SELECT COUNT(*)::int count FROM execution_control_kpi_policies
          WHERE policy_id='execution-control'`
      )
    ).toMatchObject({ rows: [{ count: 2 }] });
  });

  it('enters and reads back the DEC-169 starting values without production defaults', async () => {
    const policyId = `dec-169-${tag}`;
    const parameters = {
      impactWeights: { CRITICAL: 3, IMPORTANT: 2, SUPPORTING: 1 },
      atRiskThresholdDays: 7,
      decisionSlaDays: { value: 5, unit: 'BUSINESS_DAYS' },
      capacitySaturationThreshold: { normalUpper: 0.8, saturatedUpper: 0.95 },
      capacityBuffer: 0.15,
    };
    const created = await request(app)
      .post(path(policyId))
      .set(auth('ownerA'))
      .send({
        expectedVersion: 0,
        clientRequestId: `dec-169-${tag}`,
        name: 'DEC-169 entered by consultant',
        parameters,
      });
    expect(created.status, JSON.stringify(created.body)).toBe(201);

    const read = await request(app)
      .get(`/api/initiatives/runtime-v1/control-kpis?weekStart=2026-08-24&policyId=${policyId}`)
      .set(auth('ownerA'));
    expect(read.status).toBe(200);
    expect(read.body.policy).toMatchObject({
      policyId,
      resolved: true,
      missingParameters: [],
      invalidParameters: [],
    });
    expect(read.body.capacitySaturation).toMatchObject({
      knowledgeState: 'UNKNOWN',
      valueReason: 'AVAILABILITY_SOURCE_UNAVAILABLE',
      saturationRange: null,
      missingAvailabilityComponents: ['ABSENCE', 'FIXED_DUTIES', 'ACCEPTED_RESERVATIONS'],
      configuredPolicy: {
        thresholds: { normalUpper: 0.8, saturatedUpper: 0.95 },
        capacityBuffer: 0.15,
        bufferApplication: 'SUBTRACT_FROM_AVAILABILITY_BEFORE_SATURATION',
      },
    });

    const independent = new Client({ connectionString: DATABASE_URL });
    await independent.connect();
    try {
      const stored = await independent.query(
        `SELECT parameters FROM execution_control_kpi_policies
          WHERE organization_id=$1 AND policy_id=$2`,
        [organizationA, policyId]
      );
      expect(stored.rows[0]?.parameters).toEqual(parameters);
    } finally {
      await independent.end();
    }
  });

  it('keeps saturation bands and buffer tenant-editable for two organizations', async () => {
    const policyId = `tenant-capacity-${tag}`;
    const policies = {
      ownerA: {
        ...completeParameters,
        capacitySaturationThreshold: { normalUpper: 0.55, saturatedUpper: 0.75 },
        capacityBuffer: 0.1,
      },
      ownerB: {
        ...completeParameters,
        capacitySaturationThreshold: { normalUpper: 0.7, saturatedUpper: 0.9 },
        capacityBuffer: 0.25,
      },
    };
    for (const owner of ['ownerA', 'ownerB'] as const) {
      const created = await request(app)
        .post(path(policyId))
        .set(auth(owner))
        .send({
          expectedVersion: 0,
          clientRequestId: `${policyId}-${owner}`,
          name: `Capacity ${owner}`,
          parameters: policies[owner],
        });
      expect(created.status).toBe(201);
      const read = await request(app)
        .get(`/api/initiatives/runtime-v1/control-kpis?weekStart=2026-08-24&policyId=${policyId}`)
        .set(auth(owner));
      expect(read.body.capacitySaturation.configuredPolicy).toEqual({
        thresholds: policies[owner].capacitySaturationThreshold,
        capacityBuffer: policies[owner].capacityBuffer,
        bufferApplication: 'SUBTRACT_FROM_AVAILABILITY_BEFORE_SATURATION',
      });
      expect(read.body.capacitySaturation.saturationRange).toBeNull();
    }
  });

  it('fails closed for a foreign organization and an actor without capability', async () => {
    const deniedId = `denied-${tag}`;
    const foreign = await request(app)
      .post(path(deniedId))
      .set({ ...auth('ownerB'), 'X-Organization-Id': organizationA })
      .send({
        expectedVersion: 0,
        clientRequestId: `foreign-${tag}`,
        organizationId: organizationA,
        name: 'Foreign attempt',
        parameters: {},
      });
    expect(foreign.status).toBe(404);
    const denied = await request(app)
      .post(path(deniedId))
      .set(auth('viewerA'))
      .send({
        expectedVersion: 0,
        clientRequestId: `viewer-${tag}`,
        name: 'Viewer attempt',
        parameters: {},
      });
    expect(denied.status).toBe(404);
    expect(
      await client.query(
        `SELECT
          (SELECT COUNT(*)::int FROM ie_aggregate_state WHERE aggregate_id=$1) states,
          (SELECT COUNT(*)::int FROM ie_audit_events WHERE aggregate_id=$1) audits,
          (SELECT COUNT(*)::int FROM execution_control_kpi_policies WHERE policy_id=$1) policies`,
        [deniedId]
      )
    ).toMatchObject({ rows: [{ states: 0, audits: 0, policies: 0 }] });
  });
});
