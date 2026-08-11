import { readFile } from 'node:fs/promises';
import path from 'node:path';

import express from 'express';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

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
      'TRUNCATE initiative_candidates, ie_initiative_card_versions, ie_initiative_card_selection, ie_aggregate_relations, ie_command_receipts, ie_audit_events, ie_outbox_events, ie_aggregate_state RESTART IDENTITY'
    );
    await pool.query(`INSERT INTO initiative_candidates
      (id, organization_id, source_type, source_id, source_version, title, problem,
       proposed_outcome, project_id, initiative_owner_id, visibility, evidence_state,
       duplicate_state, status, version)
      VALUES ('proposal-aco-001','nordwerk-e2e','assessment-finding','ASM-F-ACO-001',3,
       'Automated Changeover Optimization','Median changeover is 95 minutes.',
       'Reduce median changeover time.','operations-transformation-2027','iwona-owner',
       'PROJECT','READY','CLEAR','pending',2)`);
  });
  afterAll(async () => pool.end());

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
