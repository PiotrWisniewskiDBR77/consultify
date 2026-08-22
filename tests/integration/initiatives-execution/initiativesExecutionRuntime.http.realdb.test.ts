import { readFile } from 'node:fs/promises';
import path from 'node:path';

import express from 'express';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { cleanupInitiativesExecutionOrg } from '../../support/initiativesExecutionOrgCleanup';

import { PostgresInitiativeReader } from '../../../server/src/domain/initiatives-execution/postgresInitiativeReader';
import { PostgresMaterialCommandUnitOfWork } from '../../../server/src/domain/initiatives-execution/postgresMaterialCommandUnitOfWork';
import { createInitiativesExecutionRuntimeRouter } from '../../../server/src/routes/pmo/initiativesExecutionRuntime.routes';
import { INITIATIVE_CARD_KEYS } from '../../../src/contracts/initiatives-execution/cardRegistry';

const databaseUrl = process.env.DATABASE_URL?.trim();
const describeRealDb = databaseUrl ? describe : describe.skip;

describeRealDb('Initiatives Execution runtime HTTP realDB', () => {
  const pool = new Pool({ connectionString: databaseUrl, max: 5 });
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    const userId = req.header('x-test-user') || 'validator';
    const organizationId = req.header('x-test-org') || 'nordwerk-e2e';
    (req as any).user = { id: userId, organizationId, role: 'USER' };
    next();
  });
  app.use(
    '/runtime-v1',
    createInitiativesExecutionRuntimeRouter({
      unitOfWork: new PostgresMaterialCommandUnitOfWork(pool),
      reader: new PostgresInitiativeReader(pool),
      authorize: async (actor, projectId) =>
        actor.organizationId === 'nordwerk-e2e' &&
        ['validator', 'definition-reviewer', 'initiative-owner', 'definition-authority'].includes(
          actor.userId
        ) &&
        projectId === 'operations-transformation-2027',
      resolvePolicy: async () => ({
        policyId: 'standard-industrial',
        version: 3,
        baseline: 'STANDARD',
        strictness: 3,
        source: 'PROJECT',
        config: { selfApproval: false },
      }),
    })
  );

  beforeAll(async () => {
    await pool.query(`CREATE TABLE IF NOT EXISTS initiative_candidates (
      id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, source_type TEXT NOT NULL,
      source_id TEXT, title TEXT NOT NULL, rationale TEXT, fit_score REAL,
      status TEXT NOT NULL DEFAULT 'pending', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_by TEXT
    )`);
    for (const migrationName of [
      '932_initiatives_execution_material_commands.sql',
      '933_initiative_card_versions.sql',
    ]) {
      const migration = await readFile(
        path.resolve('server/migrations', migrationName),
        'utf8'
      );
      await pool.query(migration);
    }
  });
  beforeEach(async () => {
    await pool.query(
      'TRUNCATE initiative_candidates, ie_initiative_card_versions, ie_initiative_card_selection, ie_aggregate_relations, ie_command_receipts, ie_audit_events, ie_outbox_delivery_receipts, ie_outbox_events, ie_aggregate_state RESTART IDENTITY'
    );
    await pool.query(`INSERT INTO initiative_candidates
      (id, organization_id, source_type, source_id, source_version, title, problem,
       proposed_outcome, project_id, initiative_owner_id, visibility, evidence_state,
       duplicate_state, status, version)
      VALUES ('proposal-aco-001','nordwerk-e2e','assessment-finding','ASM-F-ACO-001',3,
       'Automated Changeover Optimization','Median changeover is 95 minutes.',
       'Reduce median changeover time.','operations-transformation-2027','iwona-owner',
       'PROJECT','READY','CLEAR','pending',2)`);
    await pool.query(`
      INSERT INTO organizations (id,name) VALUES ('nordwerk-e2e','Nordwerk'),('foreign-tenant','Foreign') ON CONFLICT (id) DO NOTHING;
      INSERT INTO projects (id,organization_id,name) VALUES ('operations-transformation-2027','nordwerk-e2e','Operations') ON CONFLICT (id) DO NOTHING;
      INSERT INTO users (id,email,organization_id,status) VALUES
        ('validator','validator@local.test','nordwerk-e2e','active'),
        ('definition-reviewer','reviewer@local.test','nordwerk-e2e','active'),
        ('initiative-owner','owner@local.test','nordwerk-e2e','active'),
        ('definition-authority','authority@local.test','nordwerk-e2e','active'),
        ('iwona-owner','iwona@local.test','nordwerk-e2e','active'),
        ('revoked-owner','revoked@local.test','nordwerk-e2e','active'),
        ('foreign-owner','foreign@local.test','foreign-tenant','active')
      ON CONFLICT (id) DO NOTHING;
      INSERT INTO organization_members (id,organization_id,user_id,role,status) VALUES
        ('om-validator','nordwerk-e2e','validator','MEMBER','ACTIVE'),
        ('om-reviewer','nordwerk-e2e','definition-reviewer','MEMBER','ACTIVE'),
        ('om-owner','nordwerk-e2e','initiative-owner','MEMBER','ACTIVE'),
        ('om-authority','nordwerk-e2e','definition-authority','MEMBER','ACTIVE'),
        ('om-iwona','nordwerk-e2e','iwona-owner','MEMBER','ACTIVE'),
        ('om-revoked','nordwerk-e2e','revoked-owner','MEMBER','REVOKED'),
        ('om-foreign','foreign-tenant','foreign-owner','MEMBER','ACTIVE')
      ON CONFLICT (organization_id,user_id) DO UPDATE SET status=EXCLUDED.status;
      INSERT INTO project_members (id,project_id,user_id,project_role) VALUES
        ('pm-validator','operations-transformation-2027','validator','PROJECT_MANAGER'),
        ('pm-reviewer','operations-transformation-2027','definition-reviewer','PROJECT_MANAGER'),
        ('pm-owner','operations-transformation-2027','initiative-owner','INITIATIVE_OWNER'),
        ('pm-authority','operations-transformation-2027','definition-authority','STEERING_COMMITTEE'),
        ('pm-iwona','operations-transformation-2027','iwona-owner','INITIATIVE_OWNER'),
        ('pm-revoked','operations-transformation-2027','revoked-owner','INITIATIVE_OWNER'),
        ('pm-foreign','operations-transformation-2027','foreign-owner','INITIATIVE_OWNER')
      ON CONFLICT (project_id,user_id) DO NOTHING;
    `);
  });
  afterAll(async () => {
    await cleanupInitiativesExecutionOrg(pool, 'nordwerk-e2e');
    await pool.end();
  });

  const body = {
    initiativeId: 'aco-initiative-http-001',
    expectedVersion: 0,
    clientRequestId: 'aco-register-http-001',
    policyId: 'client-forged-lite-policy',
    policyVersion: 999,
    proposalId: 'proposal-aco-001',
    proposalVersion: 2,
    sourceType: 'assessment-finding',
    sourceId: 'ASM-F-ACO-001',
    sourceVersion: 3,
    title: 'Automated Changeover Optimization',
    problem: 'Median changeover is 95 minutes.',
    proposedOutcome: 'Reduce median changeover time.',
    projectId: 'operations-transformation-2027',
    visibility: 'PROJECT',
    initiativeOwnerId: 'iwona-owner',
  };

  const insertInitiative = async (organizationId = 'nordwerk-e2e', lifecycleState = 'REGISTERED_DRAFT') => {
    await pool.query(
      `INSERT INTO ie_aggregate_state (organization_id, aggregate_type, aggregate_id, version, payload_json)
       VALUES ($1, 'initiative', 'hub-command-initiative', 1, $2::jsonb)`,
      [organizationId, JSON.stringify({
        initiativeId: 'hub-command-initiative', lifecycleState, title: 'Hub initiative', problem: 'Hub problem', proposedOutcome: null,
        projectId: 'operations-transformation-2027', initiativeOwnerId: 'initiative-owner', readiness: 'NOT_EVALUATED',
        source: { proposalId: 'proposal-hub', proposalVersion: 1, sourceType: 'MANUAL_HUB', sourceId: 'manual-hub', sourceVersion: 1 },
      })]
    );
  };

  it('amends metadata with exact cold readback, CAS, replay, collision, auth and tenant isolation', async () => {
    await insertInitiative();
    await insertInitiative('foreign-tenant');
    for (const ownerId of ['foreign-owner', 'revoked-owner', 'missing-owner']) {
      await request(app).patch('/runtime-v1/initiatives/hub-command-initiative/metadata').send({ expectedVersion: 1, clientRequestId: `hub-owner-denied-${ownerId}`, initiativeOwnerId: ownerId }).expect(422);
    }
    expect((await pool.query(`SELECT version FROM ie_aggregate_state WHERE organization_id='nordwerk-e2e' AND aggregate_id='hub-command-initiative'`)).rows).toEqual([{ version: 1 }]);
    const command = { expectedVersion: 1, clientRequestId: 'hub-amend-1', title: 'Hub amended', initiativeOwnerId: 'definition-reviewer' };
    const first = await request(app).patch('/runtime-v1/initiatives/hub-command-initiative/metadata').send(command).expect(200);
    expect(first.body).toMatchObject({ status: 'APPLIED', aggregateVersion: 2, initiative: { version: 2, initiative: { title: 'Hub amended', initiativeOwnerId: 'definition-reviewer' } } });
    const cold = await request(app).get('/runtime-v1/initiatives/hub-command-initiative').expect(200);
    expect(first.body.initiative).toEqual(cold.body);

    const replay = await request(app).patch('/runtime-v1/initiatives/hub-command-initiative/metadata').send(command).expect(200);
    expect(replay.body).toMatchObject({ status: 'REPLAYED', aggregateVersion: 2 });
    await request(app).patch('/runtime-v1/initiatives/hub-command-initiative/metadata').send({ ...command, title: 'Collision' }).expect(409);
    await request(app).patch('/runtime-v1/initiatives/hub-command-initiative/metadata').send({ ...command, clientRequestId: 'hub-amend-stale', title: 'Stale' }).expect(409);
    await request(app).patch('/runtime-v1/initiatives/hub-command-initiative/metadata').set('x-test-user', 'unrelated-user').send({ ...command, expectedVersion: 2, clientRequestId: 'hub-amend-denied' }).expect(403);
    await request(app).patch('/runtime-v1/initiatives/hub-command-initiative/metadata').set('x-test-org', 'foreign-tenant').send({ ...command, expectedVersion: 1, clientRequestId: 'hub-amend-foreign' }).expect(403);
    const versions = await pool.query(`SELECT organization_id, version FROM ie_aggregate_state WHERE aggregate_id='hub-command-initiative' ORDER BY organization_id`);
    expect(versions.rows).toEqual([{ organization_id: 'foreign-tenant', version: 1 }, { organization_id: 'nordwerk-e2e', version: 2 }]);
  });

  it('rejects ineligible owners before proposal or registration creates any canonical write', async () => {
    const proposal = {
      proposalId: 'owner-invalid-proposal', expectedVersion: 0, clientRequestId: 'owner-invalid-submit', sourceType: 'MANUAL_HUB', sourceId: 'owner-invalid-source', sourceVersion: 1,
      provenance: { system: 'test', recordType: 'manual', capturedAt: '2026-08-21T10:00:00.000Z', evidenceRefs: ['evidence:test'] },
      title: 'Invalid owner', problem: 'Owner must be eligible', proposedOutcome: null, projectId: 'operations-transformation-2027', initiativeOwnerId: 'revoked-owner', visibility: 'PROJECT',
    };
    await request(app).post('/runtime-v1/source-proposals').send(proposal).expect(422);
    expect((await pool.query(`SELECT count(*)::int count FROM ie_aggregate_state WHERE aggregate_id='owner-invalid-proposal'`)).rows[0].count).toBe(0);
    expect((await pool.query(`SELECT count(*)::int count FROM initiative_candidates WHERE id='owner-invalid-proposal'`)).rows[0].count).toBe(0);

    await request(app).post('/runtime-v1/registrations').send({ ...body, initiativeId: 'owner-invalid-initiative', clientRequestId: 'owner-invalid-register', initiativeOwnerId: 'foreign-owner' }).expect(422);
    expect((await pool.query(`SELECT count(*)::int count FROM ie_aggregate_state WHERE aggregate_id='owner-invalid-initiative'`)).rows[0].count).toBe(0);
  });

  it('governed cancel rejects locked lifecycle and rolls back atomically when outbox fails', async () => {
    await insertInitiative('nordwerk-e2e', 'SCHEDULED');
    await request(app).post('/runtime-v1/initiatives/hub-command-initiative/cancel').send({ expectedVersion: 1, clientRequestId: 'hub-cancel-locked', reason: 'Too late' }).expect(400);
    await pool.query(`UPDATE ie_aggregate_state SET payload_json=jsonb_set(payload_json, '{lifecycleState}', '"REGISTERED_DRAFT"') WHERE organization_id='nordwerk-e2e' AND aggregate_id='hub-command-initiative'`);
    await pool.query(`CREATE OR REPLACE FUNCTION wave3_hub_fail_outbox() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'forced outbox failure'; END $$`);
    await pool.query(`CREATE TRIGGER wave3_hub_fail_outbox BEFORE INSERT ON ie_outbox_events FOR EACH ROW EXECUTE FUNCTION wave3_hub_fail_outbox()`);
    try {
      await request(app).post('/runtime-v1/initiatives/hub-command-initiative/cancel').send({ expectedVersion: 1, clientRequestId: 'hub-cancel-rollback', reason: 'Rollback proof' }).expect(500);
    } finally {
      await pool.query('DROP TRIGGER IF EXISTS wave3_hub_fail_outbox ON ie_outbox_events');
      await pool.query('DROP FUNCTION IF EXISTS wave3_hub_fail_outbox()');
    }
    const state = await pool.query(`SELECT version, payload_json->>'lifecycleState' lifecycle FROM ie_aggregate_state WHERE organization_id='nordwerk-e2e' AND aggregate_id='hub-command-initiative'`);
    expect(state.rows).toEqual([{ version: 1, lifecycle: 'REGISTERED_DRAFT' }]);
    expect((await pool.query(`SELECT 1 FROM ie_command_receipts WHERE organization_id='nordwerk-e2e' AND client_request_id='hub-cancel-rollback'`)).rowCount).toBe(0);

    const command = { expectedVersion: 1, clientRequestId: 'hub-cancel-success', reason: 'No longer aligned' };
    const success = await request(app).post('/runtime-v1/initiatives/hub-command-initiative/cancel').send(command).expect(200);
    expect(success.body).toMatchObject({ status: 'APPLIED', aggregateVersion: 2, initiative: { version: 2, initiative: { lifecycleState: 'CANCELLED', cancellation: { reason: 'No longer aligned', cancelledBy: 'validator' } } } });
    const cold = await request(app).get('/runtime-v1/initiatives/hub-command-initiative').expect(200);
    expect(success.body.initiative).toEqual(cold.body);
    await request(app).post('/runtime-v1/initiatives/hub-command-initiative/cancel').send(command).expect(200).expect((res) => expect(res.body.status).toBe('REPLAYED'));
    await request(app).post('/runtime-v1/initiatives/hub-command-initiative/cancel').send({ ...command, reason: 'Changed collision' }).expect(409);
    await request(app).post('/runtime-v1/initiatives/hub-command-initiative/cancel').send({ ...command, clientRequestId: 'hub-cancel-stale', reason: 'Stale' }).expect(409);
    await request(app).post('/runtime-v1/initiatives/hub-command-initiative/cancel').set('x-test-user', 'unrelated-user').send({ expectedVersion: 2, clientRequestId: 'hub-cancel-denied', reason: 'Denied' }).expect(403);
    await request(app).post('/runtime-v1/initiatives/hub-command-initiative/cancel').set('x-test-org', 'foreign-tenant').send({ expectedVersion: 1, clientRequestId: 'hub-cancel-foreign', reason: 'Foreign' }).expect(404);
    const versions = await pool.query(`SELECT organization_id,version FROM ie_aggregate_state WHERE aggregate_id='hub-command-initiative' ORDER BY organization_id`);
    expect(versions.rows).toEqual([{ organization_id: 'nordwerk-e2e', version: 2 }]);
  });

  it('returns 201 then the same 200 read-back for an idempotent retry', async () => {
    const before = await request(app).get('/runtime-v1/source-proposals').expect(200);
    expect(before.body.proposals).toHaveLength(1);
    expect(before.body.proposals[0]).toMatchObject({
      id: 'proposal-aco-001',
      proposalVersion: 2,
      evidenceState: 'READY',
      duplicateState: 'CLEAR',
      policy: { policyId: 'standard-industrial', version: 3, source: 'PROJECT' },
    });
    const first = await request(app).post('/runtime-v1/registrations').send(body).expect(201);
    const retry = await request(app).post('/runtime-v1/registrations').send(body).expect(200);
    expect(first.body.status).toBe('APPLIED');
    expect(first.body.response.governance).toEqual({
      policyId: 'standard-industrial',
      policyVersion: 3,
    });
    expect(retry.body).toEqual({ ...first.body, status: 'REPLAYED' });

    const byId = await request(app)
      .get(`/runtime-v1/initiatives/${body.initiativeId}`)
      .expect(200);
    const bySource = await request(app)
      .get('/runtime-v1/source-read-back')
      .query({ sourceType: body.sourceType, sourceId: body.sourceId })
      .expect(200);
    expect(byId.body).toEqual(bySource.body);
    expect(byId.body.initiative.lifecycleState).toBe('REGISTERED_DRAFT');
    await request(app).get('/runtime-v1/source-proposals').expect(200, { proposals: [] });
    const historical = await request(app)
      .get('/runtime-v1/source-proposals/proposal-aco-001')
      .expect(200);
    expect(historical.body.proposal).toMatchObject({
      id: 'proposal-aco-001',
      proposalVersion: 3,
      status: 'accepted',
      disposition: 'REGISTER',
      registeredInitiativeId: body.initiativeId,
      provenance: {},
      policyRef: { policyId: 'UNKNOWN', policyVersion: 0 },
      policy: { policyId: 'standard-industrial', version: 3 },
      capabilities: { canRegister: false },
    });
    await request(app)
      .get('/runtime-v1/source-proposals/proposal-aco-001')
      .set('x-test-user', 'unrelated-user')
      .expect(404);
    await request(app)
      .get('/runtime-v1/source-proposals/proposal-aco-001')
      .set('x-test-org', 'foreign-tenant')
      .expect(404);
  });

  it('returns a newly created Execution Decision on the immediate authoritative work read-back', async () => {
    const executionCaseId = 'aco-http-read-after-write-case';
    const initiativeId = 'aco-http-read-after-write-initiative';
    const decisionId = 'aco-http-read-after-write-decision';
    await pool.query(
      `INSERT INTO ie_aggregate_state
         (organization_id, aggregate_type, aggregate_id, version, payload_json)
       VALUES ($1, 'execution_case', $2, 1, $3::jsonb)`,
      [
        'nordwerk-e2e',
        executionCaseId,
        JSON.stringify({
          executionCaseId,
          initiativeId,
          projectId: 'operations-transformation-2027',
          state: 'ACTIVE',
          rollup: {},
        }),
      ]
    );
    const before = await request(app)
      .get(`/runtime-v1/execution-cases/${executionCaseId}/work`)
      .set('x-test-user', 'initiative-owner')
      .expect(200);
    expect(before.body.decisions).toEqual([]);

    const command = await request(app)
      .post(`/runtime-v1/execution-cases/${executionCaseId}/decisions/${decisionId}`)
      .set('x-test-user', 'initiative-owner')
      .send({
        expectedVersion: 0,
        expectedCaseVersion: 1,
        clientRequestId: 'aco-http-read-after-write-create',
        executionCaseId,
        initiativeId,
        title: 'Approve controls commissioning window',
        options: [
          { optionId: 'approve', label: 'Approve' },
          { optionId: 'return', label: 'Return' },
        ],
        authorityId: 'definition-authority',
        dueAt: '2026-10-15T10:00:00.000Z',
      })
      .expect(201);
    expect(command.body).toMatchObject({
      receiptId: 'aco-http-read-after-write-create',
      readBackState: 'PENDING',
    });

    const receipt = await request(app)
      .get(command.body.readBackUrl)
      .set('x-test-user', 'initiative-owner')
      .expect(200);
    expect(receipt.body).toMatchObject({
      receiptId: 'aco-http-read-after-write-create',
      aggregateType: 'execution_decision',
      aggregateId: decisionId,
      aggregateVersion: 1,
      currentVersion: 1,
      readBackState: 'CONFIRMED',
    });
    await request(app)
      .get(command.body.readBackUrl)
      .set('x-test-user', 'unrelated-user')
      .expect(404);

    const after = await request(app)
      .get(`/runtime-v1/execution-cases/${executionCaseId}/work`)
      .set('x-test-user', 'initiative-owner')
      .expect(200);
    expect(after.body.decisions).toEqual([
      expect.objectContaining({
        decisionId,
        executionCaseId,
        initiativeId,
        version: 1,
        status: 'DRAFT',
      }),
    ]);
    if (before.headers.etag && after.headers.etag) {
      expect(after.headers.etag).not.toBe(before.headers.etag);
    }
  });

  it('fails closed for an actor without capability and creates no evidence rows', async () => {
    await request(app)
      .post('/runtime-v1/registrations')
      .set('x-test-user', 'viewer')
      .send(body)
      .expect(403, { error: { code: 'CAPABILITY_REQUIRED' } });
    const counts = await pool.query(`SELECT
      (SELECT count(*)::int FROM ie_aggregate_state) aggregates,
      (SELECT count(*)::int FROM ie_audit_events) audits,
      (SELECT count(*)::int FROM ie_outbox_events) outbox`);
    expect(counts.rows[0]).toEqual({ aggregates: 0, audits: 0, outbox: 0 });
  });

  it('uses authenticated tenant context and does not disclose another tenant on reads', async () => {
    await request(app)
      .post('/runtime-v1/registrations')
      .send({ ...body, organizationId: 'foreign-tenant' })
      .expect(201);
    await request(app)
      .get(`/runtime-v1/initiatives/${body.initiativeId}`)
      .set('x-test-org', 'foreign-tenant')
      .expect(404, { error: { code: 'NOT_FOUND' } });
    const stored = await pool.query<{ organization_id: string }>(
      'SELECT organization_id FROM ie_aggregate_state'
    );
    expect(stored.rows).toEqual([{ organization_id: 'nordwerk-e2e' }]);
  });

  it('returns sanitized 409 for changed content under the same request id', async () => {
    await request(app).post('/runtime-v1/registrations').send(body).expect(201);
    const conflict = await request(app)
      .post('/runtime-v1/registrations')
      .send({ ...body, title: 'Changed title' })
      .expect(409);
    expect(conflict.body).toEqual({
      error: {
        code: 'VERSION_OR_IDEMPOTENCY_CONFLICT',
        expectedVersion: 0,
        currentVersion: 1,
      },
    });
    expect(JSON.stringify(conflict.body)).not.toContain('duplicate key');
  });

  it('applies a governed non-register disposition and replays it without duplicate evidence', async () => {
    const decision = {
      decisionId: 'source-decision-dismiss-http-001',
      expectedProposalVersion: 2,
      clientRequestId: 'source-decision-dismiss-request-http-001',
      disposition: 'DISMISS',
      targetInitiativeId: null,
      reasonCode: 'OUT_OF_SCOPE',
      rationale: 'The finding is not an Initiative candidate for this project.',
      evidenceSnapshot: { reviewedSourceVersion: 3 },
      resolverId: null,
      dueAt: null,
      reviewTrigger: null,
    };
    const first = await request(app)
      .post('/runtime-v1/source-proposals/proposal-aco-001/decisions')
      .send(decision)
      .expect(201);
    const replay = await request(app)
      .post('/runtime-v1/source-proposals/proposal-aco-001/decisions')
      .send(decision)
      .expect(200);

    expect(first.body.response).toMatchObject({
      disposition: 'DISMISS',
      governance: { policyId: 'standard-industrial', policyVersion: 3 },
    });
    expect(replay.body).toEqual({ ...first.body, status: 'REPLAYED' });
    const persisted = await pool.query(
      `SELECT status, disposition, version FROM initiative_candidates
        WHERE organization_id = 'nordwerk-e2e' AND id = 'proposal-aco-001'`
    );
    expect(persisted.rows[0]).toEqual({ status: 'dismissed', disposition: 'DISMISS', version: 3 });
    expect((await pool.query('SELECT 1 FROM ie_audit_events')).rowCount).toBe(1);
    expect((await pool.query('SELECT 1 FROM ie_outbox_events')).rowCount).toBe(1);
    expect((await pool.query('SELECT 1 FROM ie_command_receipts')).rowCount).toBe(1);
    await request(app).get('/runtime-v1/source-proposals').expect(200, { proposals: [] });
  });

  it('publishes and reads back one immutable canonical Initiative Card version', async () => {
    await request(app).post('/runtime-v1/registrations').send(body).expect(201);
    const publication = {
      expectedVersion: 1,
      expectedCardVersion: 0,
      clientRequestId: 'publish-card-http-001',
      applicability: 'REQUIRED',
      completion: 'COMPLETE',
      quality: 'SUFFICIENT',
      freshness: 'CURRENT',
      reviewState: 'REQUESTED',
      content: {
        problem: 'Median changeover is 95 minutes.',
        outcome: 'Reduce median changeover time.',
        inScope: ['Line 4'],
        outOfScope: ['Line 5'],
      },
      evidenceRefs: ['assessment:ASM-F-ACO-001:v3'],
      waiverDecisionId: null,
    };
    const first = await request(app)
      .post(`/runtime-v1/initiatives/${body.initiativeId}/cards/summary-scope/publications`)
      .send(publication)
      .expect(201);
    const replay = await request(app)
      .post(`/runtime-v1/initiatives/${body.initiativeId}/cards/summary-scope/publications`)
      .send(publication)
      .expect(200);
    expect(replay.body).toEqual({ ...first.body, status: 'REPLAYED' });
    await request(app)
      .post(`/runtime-v1/initiatives/${body.initiativeId}/cards/summary-scope/reviews`)
      .set('x-test-user', 'definition-reviewer')
      .send({
        expectedVersion: 2,
        expectedCardVersion: 1,
        clientRequestId: 'review-card-http-001',
        outcome: 'ACCEPTED',
        rationale: 'The problem, outcome and scope are sufficient for Definition.',
      })
      .expect(201);
    const readBack = await request(app)
      .get(`/runtime-v1/initiatives/${body.initiativeId}/cards`)
      .expect(200);
    expect(readBack.body).toMatchObject({
      initiativeVersion: 3,
      cards: [
        {
          cardKey: 'summary-scope',
          cardVersion: 2,
          content: { problem: 'Median changeover is 95 minutes.' },
        },
      ],
    });
    const readiness = await request(app)
      .get(`/runtime-v1/initiatives/${body.initiativeId}/gates/definition/readiness`)
      .expect(200);
    expect(readiness.body).toMatchObject({
      initiativeVersion: 3,
      lifecycleState: 'REGISTERED_DRAFT',
      readiness: 'NOT_READY',
    });
    expect(readiness.body.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          findingId: 'definition:options:PUBLISHED_CARD_MISSING',
          cardKey: 'options',
        }),
      ])
    );
  });

  it('configures exactly the canonical card catalog and preserves an omitted optional card', async () => {
    await request(app).post('/runtime-v1/registrations').send(body).expect(201);
    const cards = INITIATIVE_CARD_KEYS.map((cardKey, position) => ({
      cardKey,
      included: cardKey !== 'communication-engagement',
      position,
      requiredness: cardKey === 'communication-engagement' ? 'OPTIONAL' : 'REQUIRED',
      waiverDecisionId: null,
    }));
    const command = {
      expectedVersion: 1,
      clientRequestId: 'configure-cards-http-001',
      registryVersion: 1,
      cards,
    };
    const first = await request(app)
      .post(`/runtime-v1/initiatives/${body.initiativeId}/card-selection`)
      .send(command)
      .expect(201);
    const replay = await request(app)
      .post(`/runtime-v1/initiatives/${body.initiativeId}/card-selection`)
      .send(command)
      .expect(200);
    expect(replay.body).toEqual({ ...first.body, status: 'REPLAYED' });
    const readBack = await request(app)
      .get(`/runtime-v1/initiatives/${body.initiativeId}/card-selection`)
      .expect(200);
    expect(readBack.body).toEqual({
      initiativeVersion: 2,
      registryVersion: 1,
      cards,
    });
  });

  it('creates one Definition remediation Task and Decision and projects the same IDs to My Work', async () => {
    await request(app).post('/runtime-v1/registrations').send(body).expect(201);
    const command = {
      expectedVersion: 1,
      clientRequestId: 'definition-remediation-http-001',
      findingId: 'definition:financial-analysis:EVIDENCE_REQUIRED',
      financeTask: {
        taskId: 'finance-task-http-001',
        title: 'Provide reconciled Finance evidence',
        assigneeId: 'finance-owner',
        dueAt: '2026-08-20T12:00:00.000Z',
      },
      technicalDecision: {
        decisionId: 'technical-decision-http-001',
        title: 'Select technical option',
        authorityId: 'technical-authority',
        dueAt: '2026-08-21T12:00:00.000Z',
        options: ['Do nothing', 'SMED automation'],
      },
    };
    const created = await request(app)
      .post(`/runtime-v1/initiatives/${body.initiativeId}/definition-remediation`)
      .set('x-test-user', 'initiative-owner')
      .send(command)
      .expect(201);
    expect(created.body.response).toMatchObject({
      taskId: command.financeTask.taskId,
      decisionId: command.technicalDecision.decisionId,
    });
    const financeWork = await request(app)
      .get('/runtime-v1/my-work/definition-remediation')
      .set('x-test-user', 'finance-owner')
      .expect(200);
    const technicalWork = await request(app)
      .get('/runtime-v1/my-work/definition-remediation')
      .set('x-test-user', 'technical-authority')
      .expect(200);
    expect(financeWork.body.items[0]).toMatchObject({
      aggregateId: command.financeTask.taskId,
      initiativeId: body.initiativeId,
      workType: 'FINANCE_EVIDENCE',
    });
    expect(technicalWork.body.items[0]).toMatchObject({
      aggregateId: command.technicalDecision.decisionId,
      initiativeId: body.initiativeId,
      workType: 'TECHNICAL_OPTION',
    });
    await request(app)
      .post(`/runtime-v1/my-work/definition-remediation/task/${command.financeTask.taskId}/resolve`)
      .set('x-test-user', 'finance-owner')
      .send({
        expectedVersion: 1,
        clientRequestId: 'resolve-finance-http-001',
        workType: 'FINANCE_EVIDENCE',
        evidenceRefs: ['finance:reconciliation:v1'],
      })
      .expect(200);
    await request(app)
      .post(
        `/runtime-v1/my-work/definition-remediation/decision/${command.technicalDecision.decisionId}/resolve`
      )
      .set('x-test-user', 'technical-authority')
      .send({
        expectedVersion: 1,
        clientRequestId: 'resolve-technical-http-001',
        workType: 'TECHNICAL_OPTION',
        selectedOption: 'SMED automation',
        rationale: 'Best balance of risk and value.',
      })
      .expect(200);
    await request(app)
      .get('/runtime-v1/my-work/definition-remediation')
      .set('x-test-user', 'finance-owner')
      .expect(200, { items: [] });
  });

  it('blocks Definition on a newer source version and refreshes the exact snapshot idempotently', async () => {
    await request(app).post('/runtime-v1/registrations').send(body).expect(201);
    await request(app)
      .post(`/runtime-v1/initiatives/${body.initiativeId}/cards/summary-scope/publications`)
      .set('x-test-user', 'initiative-owner')
      .send({
        expectedVersion: 1,
        expectedCardVersion: 0,
        clientRequestId: 'source-refresh-card-http-001',
        applicability: 'REQUIRED',
        completion: 'COMPLETE',
        quality: 'SUFFICIENT',
        freshness: 'CURRENT',
        reviewState: 'REQUESTED',
        content: { problem: 'Problem', outcome: 'Outcome', inScope: ['A'], outOfScope: ['B'] },
        evidenceRefs: ['assessment:ASM-F-ACO-001:v3'],
        waiverDecisionId: null,
      })
      .expect(201);
    await pool.query(
      `UPDATE initiative_candidates
          SET source_version = 4, version = 4, evidence_state = 'READY', updated_at = NOW()
        WHERE organization_id = 'nordwerk-e2e' AND id = 'proposal-aco-001'`
    );
    const stale = await request(app)
      .get(`/runtime-v1/initiatives/${body.initiativeId}/gates/definition/readiness`)
      .expect(200);
    expect(stale.body.findings).toEqual(
      expect.arrayContaining([expect.objectContaining({ rule: 'SOURCE_SNAPSHOT_STALE' })])
    );
    const command = {
      expectedVersion: 2,
      clientRequestId: 'source-refresh-http-001',
      expectedProposalVersion: 4,
      expectedSourceVersion: 4,
    };
    const first = await request(app)
      .post(`/runtime-v1/initiatives/${body.initiativeId}/source-refresh`)
      .set('x-test-user', 'initiative-owner')
      .send(command)
      .expect(201);
    const replay = await request(app)
      .post(`/runtime-v1/initiatives/${body.initiativeId}/source-refresh`)
      .set('x-test-user', 'initiative-owner')
      .send(command)
      .expect(200);
    expect(replay.body).toEqual({ ...first.body, status: 'REPLAYED' });
    const refreshed = await request(app)
      .get(`/runtime-v1/initiatives/${body.initiativeId}/gates/definition/readiness`)
      .expect(200);
    expect(refreshed.body.sourceStatus.freshness).toBe('CURRENT');
    expect(refreshed.body.findings).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ rule: 'SOURCE_SNAPSHOT_STALE' })])
    );
    const initiative = await request(app)
      .get(`/runtime-v1/initiatives/${body.initiativeId}`)
      .expect(200);
    expect(initiative.body.initiative.source).toMatchObject({
      proposalVersion: 4,
      sourceVersion: 4,
      freshness: 'CURRENT',
    });
    const cards = await request(app)
      .get(`/runtime-v1/initiatives/${body.initiativeId}/cards`)
      .expect(200);
    expect(cards.body.cards[0]).toMatchObject({
      cardKey: 'summary-scope',
      cardVersion: 2,
      freshness: 'STALE',
      reviewState: 'CHANGES_REQUESTED',
    });
    expect(
      (
        await pool.query(
          `SELECT 1 FROM ie_initiative_card_versions
            WHERE organization_id = 'nordwerk-e2e' AND initiative_id = $1
              AND card_key = 'summary-scope'`,
          [body.initiativeId]
        )
      ).rowCount
    ).toBe(2);
  });

  it('projects one pending Definition Decision to the named authority My Work and reads back approval', async () => {
    const definitionInitiativeId = 'initiative-definition-http';
    await pool.query(`INSERT INTO initiative_candidates
      (id, organization_id, source_type, source_id, source_version, title, problem,
       proposed_outcome, project_id, initiative_owner_id, visibility, evidence_state,
       duplicate_state, status, version, registered_initiative_id)
      VALUES ('proposal-definition-http','nordwerk-e2e','assessment','finding-definition',1,
       'Definition Initiative','Problem','Outcome','operations-transformation-2027',
       'initiative-owner','PROJECT','READY','CLEAR','accepted',1,$1)`,
      [definitionInitiativeId]);
    const cardKeys = [
      'summary-scope',
      'strategic-fit',
      'success-criteria',
      'outcomes-benefits',
      'options',
      'people-team',
      'roles-raci',
      'stakeholders',
    ];
    const cardContent = {
      'summary-scope': {
        problem: 'Problem',
        outcome: 'Outcome',
        inScope: ['Line 4'],
        outOfScope: ['Line 5'],
      },
      'strategic-fit': { objectives: ['OEE'], rationale: 'Strategic alignment' },
      'success-criteria': { successCriteria: ['Lead time'], measurementPlan: 'Weekly' },
      'outcomes-benefits': { outcomes: ['Faster changeover'], benefits: ['Capacity'] },
      options: { doNothing: 'No change', alternatives: ['SMED'] },
      'people-team': { team: ['Operations'], capacityAssumptions: 'Part-time' },
      'roles-raci': { accountableOwnerId: 'initiative-owner', roles: ['Engineer'] },
      stakeholders: { ownerId: 'initiative-owner', sponsorId: 'sponsor-1' },
    } as const;
    await pool.query(
      `INSERT INTO ie_aggregate_state
        (organization_id, aggregate_type, aggregate_id, version, payload_json)
       VALUES ('nordwerk-e2e','initiative',$1,1,$2::jsonb)`,
      [
        definitionInitiativeId,
        JSON.stringify({
          initiativeId: definitionInitiativeId,
          projectId: 'operations-transformation-2027',
          lifecycleState: 'REGISTERED_DRAFT',
          source: {
            proposalId: 'proposal-definition-http',
            proposalVersion: 1,
            sourceType: 'assessment',
            sourceId: 'finding-definition',
            sourceVersion: 1,
          },
          cardRefs: Object.fromEntries(
            cardKeys.map((cardKey) => [cardKey, { cardVersion: 1, aggregateVersion: 1 }])
          ),
        }),
      ]
    );
    for (const cardKey of cardKeys) {
      await pool.query(
        `INSERT INTO ie_initiative_card_versions
          (organization_id, initiative_id, card_key, card_version, aggregate_version,
           applicability, completion, quality, freshness, review_state, content_json,
           evidence_refs_json, published_by, reviewed_by, review_decision_id, review_rationale)
         VALUES ('nordwerk-e2e',$1,$2,1,1,'REQUIRED','COMPLETE','SUFFICIENT','CURRENT',
          'ACCEPTED',$3::jsonb,'["evidence:v1"]'::jsonb,'initiative-owner',
          'definition-reviewer',$4,'Accepted')`,
        [
          definitionInitiativeId,
          cardKey,
          JSON.stringify(cardContent[cardKey as keyof typeof cardContent]),
          `review:${cardKey}`,
        ]
      );
    }
    const decisionId = 'definition-decision-http';
    await request(app)
      .post(`/runtime-v1/initiatives/${definitionInitiativeId}/gates/definition/requests`)
      .set('x-test-user', 'initiative-owner')
      .send({
        expectedVersion: 1,
        clientRequestId: 'definition-request-http',
        decisionId,
        authorityId: 'definition-authority',
        dueAt: '2026-08-20T12:00:00.000Z',
      })
      .expect(201);
    const authorityQueue = await request(app)
      .get('/runtime-v1/my-work/definition-decisions')
      .set('x-test-user', 'definition-authority')
      .expect(200);
    expect(authorityQueue.body.decisions).toEqual([
      expect.objectContaining({ decisionId, initiativeId: definitionInitiativeId }),
    ]);
    await request(app)
      .get('/runtime-v1/my-work/definition-decisions')
      .set('x-test-user', 'initiative-owner')
      .expect(200, { decisions: [] });
    await request(app)
      .post(`/runtime-v1/initiatives/${definitionInitiativeId}/gates/definition/decisions`)
      .set('x-test-user', 'definition-authority')
      .send({
        expectedVersion: 2,
        clientRequestId: 'definition-approve-http',
        decisionId,
        outcome: 'APPROVED',
        rationale: 'The Definition is complete and independently reviewed.',
      })
      .expect(201);
    await request(app)
      .get('/runtime-v1/my-work/definition-decisions')
      .set('x-test-user', 'definition-authority')
      .expect(200, { decisions: [] });
    const readBack = await request(app)
      .get(`/runtime-v1/initiatives/${definitionInitiativeId}`)
      .set('x-test-user', 'definition-authority')
      .expect(200);
    expect(readBack.body.initiative).toMatchObject({
      lifecycleState: 'DEFINED',
      gateState: 'APPROVED',
    });
  });

  it('executes the complete ACO source-to-approved-Definition vertical with reload evidence', async () => {
    const initiativeId = 'aco-definition-vertical-001';
    const registration = {
      ...body,
      initiativeId,
      clientRequestId: 'aco-definition-register-001',
    };
    const registered = await request(app)
      .post('/runtime-v1/registrations')
      .send(registration)
      .expect(201);
    const replay = await request(app)
      .post('/runtime-v1/registrations')
      .send(registration)
      .expect(200);
    expect(replay.body).toEqual({ ...registered.body, status: 'REPLAYED' });

    let initiativeVersion = 1;
    const selection = INITIATIVE_CARD_KEYS.map((cardKey, position) => ({
      cardKey,
      included: cardKey !== 'communication-engagement',
      position,
      requiredness: cardKey === 'communication-engagement' ? 'OPTIONAL' : 'REQUIRED',
      waiverDecisionId: null,
    }));
    await request(app)
      .post(`/runtime-v1/initiatives/${initiativeId}/card-selection`)
      .set('x-test-user', 'initiative-owner')
      .send({
        expectedVersion: initiativeVersion,
        clientRequestId: 'aco-definition-card-selection-001',
        registryVersion: 1,
        cards: selection,
      })
      .expect(201);
    initiativeVersion += 1;

    const definitionContent = {
      'summary-scope': {
        problem: 'Median changeover is 95 minutes.',
        outcome: 'Reduce median changeover time.',
        inScope: ['Line 4'],
        outOfScope: ['Line 5'],
      },
      'strategic-fit': { objectives: ['OEE'], rationale: 'Supports the operating model.' },
      'success-criteria': { successCriteria: ['Median <= 60 minutes'], measurementPlan: 'Weekly' },
      'outcomes-benefits': { outcomes: ['Faster changeovers'], benefits: ['Recovered capacity'] },
      options: { doNothing: 'Remain at 95 minutes', alternatives: ['SMED automation'] },
      'people-team': { team: ['Operations', 'Engineering'], capacityAssumptions: 'Part-time' },
      'roles-raci': { accountableOwnerId: 'initiative-owner', roles: ['Controls Engineer'] },
      stakeholders: { ownerId: 'initiative-owner', sponsorId: 'sponsor-1' },
    } as const;
    const definitionKeys = Object.keys(definitionContent) as Array<keyof typeof definitionContent>;

    const publishAndReview = async (sourceVersion: number, expectedCardVersion: number) => {
      for (const cardKey of definitionKeys) {
        await request(app)
          .post(`/runtime-v1/initiatives/${initiativeId}/cards/${cardKey}/publications`)
          .set('x-test-user', 'initiative-owner')
          .send({
            expectedVersion: initiativeVersion,
            expectedCardVersion,
            clientRequestId: `aco-${cardKey}-publish-source-${sourceVersion}`,
            applicability: 'REQUIRED',
            completion: 'COMPLETE',
            quality: 'SUFFICIENT',
            freshness: 'CURRENT',
            reviewState: 'REQUESTED',
            content: definitionContent[cardKey],
            evidenceRefs: [`assessment:ASM-F-ACO-001:v${sourceVersion}`],
            waiverDecisionId: null,
          })
          .expect(201);
        initiativeVersion += 1;
        await request(app)
          .post(`/runtime-v1/initiatives/${initiativeId}/cards/${cardKey}/reviews`)
          .set('x-test-user', 'definition-reviewer')
          .send({
            expectedVersion: initiativeVersion,
            expectedCardVersion: expectedCardVersion + 1,
            clientRequestId: `aco-${cardKey}-review-source-${sourceVersion}`,
            outcome: 'ACCEPTED',
            rationale: `Reviewed against source version ${sourceVersion}.`,
          })
          .expect(201);
        initiativeVersion += 1;
      }
    };

    await publishAndReview(3, 0);
    expect(initiativeVersion).toBe(18);

    const remediation = {
      expectedVersion: initiativeVersion,
      clientRequestId: 'aco-definition-remediation-001',
      findingId: 'definition:financial-analysis:EVIDENCE_REQUIRED',
      financeTask: {
        taskId: 'aco-finance-task-001',
        title: 'Provide reconciled Finance evidence',
        assigneeId: 'finance-owner',
        dueAt: '2026-08-20T12:00:00.000Z',
      },
      technicalDecision: {
        decisionId: 'aco-technical-decision-001',
        title: 'Select technical option',
        authorityId: 'technical-authority',
        dueAt: '2026-08-21T12:00:00.000Z',
        options: ['Do nothing', 'SMED automation'],
      },
    };
    await request(app)
      .post(`/runtime-v1/initiatives/${initiativeId}/definition-remediation`)
      .set('x-test-user', 'initiative-owner')
      .send(remediation)
      .expect(201);
    initiativeVersion += 1;
    await request(app)
      .post(`/runtime-v1/my-work/definition-remediation/task/${remediation.financeTask.taskId}/resolve`)
      .set('x-test-user', 'finance-owner')
      .send({
        expectedVersion: 1,
        clientRequestId: 'aco-finance-task-complete-001',
        workType: 'FINANCE_EVIDENCE',
        evidenceRefs: ['finance:reconciliation:v1'],
      })
      .expect(200);
    await request(app)
      .post(
        `/runtime-v1/my-work/definition-remediation/decision/${remediation.technicalDecision.decisionId}/resolve`
      )
      .set('x-test-user', 'technical-authority')
      .send({
        expectedVersion: 1,
        clientRequestId: 'aco-technical-decision-resolve-001',
        workType: 'TECHNICAL_OPTION',
        selectedOption: 'SMED automation',
        rationale: 'Best balance of value, time and delivery risk.',
      })
      .expect(200);

    await pool.query(
      `UPDATE initiative_candidates SET source_version = 4, version = 4,
        evidence_state = 'READY', updated_at = NOW()
       WHERE organization_id = 'nordwerk-e2e' AND id = 'proposal-aco-001'`
    );
    const stale = await request(app)
      .get(`/runtime-v1/initiatives/${initiativeId}/gates/definition/readiness`)
      .expect(200);
    expect(stale.body.findings).toEqual(
      expect.arrayContaining([expect.objectContaining({ rule: 'SOURCE_SNAPSHOT_STALE' })])
    );

    await request(app)
      .post(`/runtime-v1/initiatives/${initiativeId}/source-refresh`)
      .set('x-test-user', 'initiative-owner')
      .send({
        expectedVersion: initiativeVersion,
        clientRequestId: 'aco-source-refresh-001',
        expectedProposalVersion: 4,
        expectedSourceVersion: 4,
      })
      .expect(201);
    initiativeVersion += 1;
    const invalidated = await request(app)
      .get(`/runtime-v1/initiatives/${initiativeId}/gates/definition/readiness`)
      .expect(200);
    expect(invalidated.body.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ rule: 'SOURCE_STALE' }),
        expect.objectContaining({ rule: 'REVIEW_NOT_ACCEPTED' }),
      ])
    );

    await publishAndReview(4, 3);
    expect(initiativeVersion).toBe(36);
    const ready = await request(app)
      .get(`/runtime-v1/initiatives/${initiativeId}/gates/definition/readiness`)
      .expect(200);
    expect(ready.body).toMatchObject({ readiness: 'READY', initiativeVersion: 36 });
    expect(ready.body.findings).toEqual([]);

    const definitionDecisionId = 'aco-definition-decision-001';
    await request(app)
      .post(`/runtime-v1/initiatives/${initiativeId}/gates/definition/requests`)
      .set('x-test-user', 'initiative-owner')
      .send({
        expectedVersion: initiativeVersion,
        clientRequestId: 'aco-definition-request-001',
        decisionId: definitionDecisionId,
        authorityId: 'definition-authority',
        dueAt: '2026-08-22T12:00:00.000Z',
      })
      .expect(201);
    initiativeVersion += 1;
    const myWork = await request(app)
      .get('/runtime-v1/my-work/definition-decisions')
      .set('x-test-user', 'definition-authority')
      .expect(200);
    expect(myWork.body.decisions[0]).toMatchObject({
      decisionId: definitionDecisionId,
      initiativeId,
      cardVersions: Object.fromEntries(definitionKeys.map((key) => [key, 5])),
    });
    await request(app)
      .post(`/runtime-v1/initiatives/${initiativeId}/gates/definition/decisions`)
      .set('x-test-user', 'definition-authority')
      .send({
        expectedVersion: initiativeVersion,
        clientRequestId: 'aco-definition-approve-001',
        decisionId: definitionDecisionId,
        outcome: 'APPROVED',
        rationale: 'Definition is complete, current and independently reviewed.',
      })
      .expect(201);
    initiativeVersion += 1;

    const reloaded = await request(app).get(`/runtime-v1/initiatives/${initiativeId}`).expect(200);
    expect(reloaded.body).toMatchObject({
      version: initiativeVersion,
      initiative: {
        initiativeId,
        lifecycleState: 'DEFINED',
        gateState: 'APPROVED',
        gateReadiness: 'READY',
        definitionDecisionId,
      },
    });
    expect(
      await pool.query(
        `SELECT
          (SELECT count(*)::int FROM ie_command_receipts WHERE organization_id = 'nordwerk-e2e') receipts,
          (SELECT count(*)::int FROM ie_audit_events WHERE organization_id = 'nordwerk-e2e') audits,
          (SELECT count(*)::int FROM ie_outbox_events WHERE organization_id = 'nordwerk-e2e') outbox`
      )
    ).toMatchObject({ rows: [{ receipts: 40, audits: 40, outbox: 40 }] });
  });
});
