/** @vitest-environment node */

import { randomUUID } from 'node:crypto';

import express from 'express';
import jwt from 'jsonwebtoken';
import { Client, Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import verifyToken, { validateOrgMembership } from '../../middleware/auth.middleware.js';
import { attachV8Context, requireV8OrgContext } from '../../middleware/v8Auth.middleware.js';
import executionBvpRoutes from '../../routes/caseWorkspace/executionBvp.routes.js';
import {
  decideHandoffAcceptance,
  requestHandoffAcceptance,
} from '../../domain/initiatives-execution/handoffAcceptance.js';
import { PostgresMaterialCommandUnitOfWork } from '../../domain/initiatives-execution/postgresMaterialCommandUnitOfWork.js';

const DATABASE_URL = process.env.DATABASE_URL || '';
const REAL_PG =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  DATABASE_URL.startsWith('postgres');

describe.skipIf(!REAL_PG)('INI-BVP-001 runtime-v1 Initiative -> Execution mounted seam', () => {
  const tag = randomUUID();
  const org = `ini-exe-${tag}`;
  const foreignOrg = `ini-exe-foreign-${tag}`;
  const owner = `ini-exe-owner-${tag}`;
  const foreignOwner = `ini-exe-foreign-owner-${tag}`;
  const initiativeId = `ini-exe-initiative-${tag}`;
  const handoffId = `ini-exe-handoff-${tag}`;
  const caseId = `ini-exe-case-${tag}`;
  const projectId = `ini-exe-project-${tag}`;
  const intakeKey = `ini-exe-intake-${tag}`;
  let client: Client;
  let pool: Pool;
  let app: express.Express;
  let ownerToken = '';
  let foreignToken = '';

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    client = new Client({ connectionString: DATABASE_URL });
    pool = new Pool({ connectionString: DATABASE_URL, max: 8 });
    await client.connect();
    await client.query(`INSERT INTO organizations(id,name) VALUES($1,$1),($2,$2)`, [org, foreignOrg]);
    await client.query(
      `INSERT INTO users(id,organization_id,email,role,status)
       VALUES($1,$2,$3,'OWNER','active'),($4,$5,$6,'OWNER','active')`,
      [owner, org, `${owner}@example.test`, foreignOwner, foreignOrg, `${foreignOwner}@example.test`]
    );
    await client.query(
      `INSERT INTO organization_members(id,organization_id,user_id,role,status)
       VALUES($1,$2,$3,'OWNER','ACTIVE'),($4,$5,$6,'OWNER','ACTIVE')`,
      [`membership-${owner}`, org, owner, `membership-${foreignOwner}`, foreignOrg, foreignOwner]
    );
    await client.query(
      `INSERT INTO ie_aggregate_state(organization_id,aggregate_type,aggregate_id,version,payload_json)
       VALUES($1,'initiative',$2,12,$3::jsonb),($1,'handoff_package',$4,1,$5::jsonb)`,
      [
        org,
        initiativeId,
        JSON.stringify({
          initiativeId,
          projectId,
          lifecycleState: 'SCHEDULED',
          handoffPackageId: handoffId,
          executionState: 'HANDOFF_PENDING',
        }),
        handoffId,
        JSON.stringify({
          handoffPackageId: handoffId,
          version: 1,
          initiativeId,
          decisionId: `schedule-${tag}`,
          executionManagerId: owner,
          snapshot: {
            scope: {}, selectedOptions: {}, success: {}, baseline: {}, openWork: [], raid: [],
            outcomeRefs: [], sourceVersions: {},
          },
          portfolio: { id: `portfolio-${tag}`, version: 1 },
          plan: { id: `plan-${tag}`, version: 1 },
          capacity: { id: `capacity-${tag}`, version: 1 },
          commitmentVersions: {},
          createdAt: new Date().toISOString(),
        }),
      ]
    );

    const uow = new PostgresMaterialCommandUnitOfWork(pool);
    const envelope = (version: number, key: string, type: string, payload: unknown) => ({
      organizationId: org,
      actorId: owner,
      aggregateType: 'initiative',
      aggregateId: initiativeId,
      expectedVersion: version,
      clientRequestId: key,
      correlationId: key,
      policyId: 'standard',
      policyVersion: 1,
      commandType: type,
      payload,
    });
    await requestHandoffAcceptance(
      uow,
      envelope(12, `request-${tag}`, 'initiative.handoff.request', {
        decisionId: `decision-${tag}`,
        handoffPackageId: handoffId,
        handoffPackageVersion: 1,
        executionCaseId: caseId,
        authorityId: owner,
        dueAt: '2026-09-01T12:00:00Z',
        rolloutChildren: { pilot: [], waves: [] },
      }) as never
    );
    await decideHandoffAcceptance(
      uow,
      envelope(13, `accept-${tag}`, 'initiative.handoff.decide', {
        decisionId: `decision-${tag}`,
        outcome: 'ACCEPT',
        gaps: [],
        blockers: [],
        rationale: 'Accepted for exact runtime seam proof',
      }) as never
    );

    const { default: config } = await import('../../config/Config.js');
    const sign = (userId: string, organizationId: string) =>
      jwt.sign(
        { id: userId, organizationId, role: 'OWNER', email: `${userId}@example.test` },
        config.JWT_SECRET,
        { algorithm: 'HS256', expiresIn: '10m' }
      );
    ownerToken = sign(owner, org);
    foreignToken = sign(foreignOwner, foreignOrg);

    app = express();
    app.use(express.json());
    app.use(verifyToken);
    app.use(validateOrgMembership);
    app.use(requireV8OrgContext);
    app.use(attachV8Context);
    app.use('/api/v8/case-workspace', executionBvpRoutes);
    app.use((error: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      res.status(error?.statusCode || error?.status || 500).json({ code: error?.code || 'ERROR' });
    });
  });

  afterAll(async () => {
    if (client) {
      await client.query('BEGIN');
      try {
        await client.query(`DELETE FROM execution_case_links WHERE organization_id = ANY($1)`, [[org, foreignOrg]]);
        for (const table of ['ie_aggregate_relations', 'ie_command_receipts', 'ie_audit_events', 'ie_outbox_events', 'ie_aggregate_state']) {
          await client.query(`DELETE FROM ${table} WHERE organization_id = ANY($1)`, [[org, foreignOrg]]);
        }
        await client.query(`DELETE FROM organization_members WHERE organization_id = ANY($1)`, [[org, foreignOrg]]);
        await client.query(`DELETE FROM users WHERE organization_id = ANY($1)`, [[org, foreignOrg]]);
        await client.query(`DELETE FROM organizations WHERE id = ANY($1)`, [[org, foreignOrg]]);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        await client.end();
        await pool.end();
      }
    }
  });

  it('converges 8 mounted signed-JWT requests on one versioned runtime link and CAS spine', async () => {
    const path = '/api/v8/case-workspace/execution-bvp/links';
    const payload = {
      sourceKind: 'RUNTIME_V1',
      initiativeId,
      caseId,
      sourceVersion: 14,
      organizationId: foreignOrg,
    };
    const attempts = await Promise.all(
      Array.from({ length: 8 }, () =>
        request(app).post(path).set(auth(ownerToken)).set('Idempotency-Key', intakeKey).send(payload)
      )
    );
    expect(attempts.map((response) => response.status)).toEqual(Array(8).fill(201));
    const linkIds = new Set(attempts.map((response) => response.body.data.link_id));
    expect(linkIds.size).toBe(1);
    const linkId = [...linkIds][0] as string;
    expect(attempts[0].body.data).toMatchObject({
      organization_id: org,
      source_kind: 'RUNTIME_V1',
      runtime_initiative_id: initiativeId,
      runtime_execution_case_id: caseId,
      source_version: 14,
      source_project_id: projectId,
      initiative_id: null,
      case_id: null,
      project_id: null,
    });

    const collision = await request(app)
      .post(path)
      .set(auth(ownerToken))
      .set('Idempotency-Key', intakeKey)
      .send({ ...payload, caseId: `wrong-${caseId}` });
    expect(collision.status).toBe(409);

    const foreign = await request(app)
      .post(path)
      .set(auth(foreignToken))
      .set('Idempotency-Key', `foreign-${tag}`)
      .send(payload);
    expect(foreign.status).toBe(404);

    const stale = await request(app)
      .post(path)
      .set(auth(ownerToken))
      .set('Idempotency-Key', `stale-${tag}`)
      .send({ ...payload, sourceVersion: 13 });
    expect(stale.status).toBe(404);

    const spinePayload = {
      workRef: `runtime-work:${tag}`,
      resourceRef: `runtime-resource:${initiativeId}`,
      controlRef: `runtime-control:${caseId}`,
      reportRef: `runtime-report:${tag}@v1`,
      expectedVersion: 1,
    };
    const spine = await request(app)
      .post(`/api/v8/case-workspace/execution-bvp/links/${linkId}/spine`)
      .set(auth(ownerToken))
      .send(spinePayload)
      .expect(200);
    expect(spine.body.data.version).toBe(2);
    const staleSpine = await request(app)
      .post(`/api/v8/case-workspace/execution-bvp/links/${linkId}/spine`)
      .set(auth(ownerToken))
      .send(spinePayload);
    expect(staleSpine.status).toBe(404);

    const cold = new Client({ connectionString: DATABASE_URL });
    await cold.connect();
    const readback = await cold.query(
      `SELECT source_kind,runtime_initiative_id,runtime_execution_case_id,source_version,
              source_project_id,initiative_id,case_id,project_id,version
         FROM execution_case_links WHERE link_id=$1 AND organization_id=$2`,
      [linkId, org]
    );
    const legacyShadow = await cold.query(
      `SELECT
         (SELECT count(*)::int FROM initiatives WHERE id=$1 OR organization_id=$2) initiatives,
         (SELECT count(*)::int FROM case_core WHERE case_id=$3 OR organization_id=$2) cases`,
      [initiativeId, org, caseId]
    );
    await cold.end();
    expect(readback.rows[0]).toMatchObject({
      source_kind: 'RUNTIME_V1',
      runtime_initiative_id: initiativeId,
      runtime_execution_case_id: caseId,
      source_version: 14,
      source_project_id: projectId,
      initiative_id: null,
      case_id: null,
      project_id: null,
      version: 2,
    });
    expect(legacyShadow.rows[0]).toEqual({ initiatives: 0, cases: 0 });
  });
});
