/** @vitest-environment node */
import express, { type Express } from 'express';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import request from 'supertest';
import { beforeAll, beforeEach, afterAll, describe, expect, it } from 'vitest';
import { assertRealPostgresTestEnvironment } from '../../../../../tests/integration/_helpers/assertRealPostgres.js';

describe('IE00 active Definition canonical contract', { sequential: true, retry: 0 }, () => {
  let pool: Pool;
  let app: Express;
  const tokens: Record<string, string> = {};
  const base = '/api/initiatives/runtime-v1';
  const id = 'initiative-ie00-contract-1';
  const org = 'org-ie00-contract';
  const resetFixture = async () => {
    for (const table of [
      'ie_command_receipts',
      'ie_audit_events',
      'ie_outbox_events',
      'ie_aggregate_relations',
      'ie_initiative_card_versions',
      'ie_aggregate_state',
    ])
      await pool.query(`DELETE FROM ${table} WHERE organization_id=$1`, [org]);
    await pool.query('DELETE FROM initiative_candidates WHERE organization_id=$1', [org]);
    await pool.query(
      `INSERT INTO initiative_candidates(id,organization_id,source_type,source_id,source_version,title,problem,proposed_outcome,project_id,initiative_owner_id,visibility,evidence_state,duplicate_state,status,version,registered_initiative_id) VALUES('proposal-ie00-contract-1','org-ie00-contract','assessment','finding-1',3,'Definition Initiative','Problem','Outcome','project-ie00-contract','owner-contract-1','PROJECT','READY','CLEAR','accepted',2,'initiative-ie00-contract-1')`
    );
    const cardRefs = Object.fromEntries(
      [
        'summary-scope',
        'strategic-fit',
        'success-criteria',
        'outcomes-benefits',
        'options',
        'people-team',
        'roles-raci',
        'stakeholders',
      ].map((cardKey) => [cardKey, { cardVersion: 1, aggregateVersion: 1 }])
    );
    await pool.query(
      `INSERT INTO ie_aggregate_state
        (organization_id, aggregate_type, aggregate_id, version, payload_json)
       VALUES ('org-ie00-contract','initiative','initiative-ie00-contract-1',1,$1::jsonb)`,
      [
        JSON.stringify({
          initiativeId: 'initiative-ie00-contract-1',
          projectId: 'project-ie00-contract',
          initiativeOwnerId: 'owner-contract-1',
          title: 'Definition Initiative',
          lifecycleState: 'REGISTERED_DRAFT',
          source: {
            proposalId: 'proposal-ie00-contract-1',
            proposalVersion: 2,
            sourceType: 'assessment',
            sourceId: 'finding-1',
            sourceVersion: 3,
          },
          cardRefs,
        }),
      ]
    );
    const cards = [
      [
        'summary-scope',
        { problem: 'Problem', outcome: 'Outcome', inScope: ['Line 4'], outOfScope: ['Line 5'] },
      ],
      ['strategic-fit', { objectives: ['OEE'], rationale: 'Strategic alignment' }],
      ['success-criteria', { successCriteria: ['Lead time'], measurementPlan: 'Weekly' }],
      ['outcomes-benefits', { outcomes: ['Faster changeover'], benefits: ['Capacity'] }],
      ['options', { doNothing: 'No change', alternatives: ['SMED'] }],
      ['people-team', { team: ['Operations'], capacityAssumptions: 'Part-time' }],
      ['roles-raci', { accountableOwnerId: 'owner-contract-1', roles: ['Engineer'] }],
      ['stakeholders', { ownerId: 'owner-contract-1', sponsorId: 'sponsor-1' }],
    ] as const;
    for (const [cardKey, content] of cards) {
      await pool.query(
        `INSERT INTO ie_initiative_card_versions
          (organization_id, initiative_id, card_key, card_version, aggregate_version,
           applicability, completion, quality, freshness, review_state, content_json,
           evidence_refs_json, published_by, reviewed_by, review_decision_id, review_rationale)
         VALUES ('org-ie00-contract','initiative-ie00-contract-1',$1,1,1,
          'REQUIRED','COMPLETE','SUFFICIENT','CURRENT','ACCEPTED',$2::jsonb,
          $3::jsonb,'owner-contract-1','reviewer-contract-1',$4,'Sufficient')`,
        [
          cardKey,
          JSON.stringify(content),
          JSON.stringify([`evidence:${cardKey}:v1`]),
          `review:${cardKey}`,
        ]
      );
    }
  };
  beforeEach(async () => {
    await resetFixture();
  });
  beforeAll(async () => {
    await assertRealPostgresTestEnvironment();
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    await pool.query(
      "INSERT INTO organizations(id,name) VALUES($1,'IE00 local proof') ON CONFLICT DO NOTHING",
      [org]
    );
    for (const user of ['owner-contract-1', 'authority-contract-1', 'viewer-contract-1']) {
      await pool.query(
        "INSERT INTO users(id,organization_id,email,password,role,status) VALUES($1,$2,$3,'unused','ADMIN','active') ON CONFLICT DO NOTHING",
        [user, org, user + '@ie00.invalid']
      );
      await pool.query(
        "INSERT INTO organization_members(id,organization_id,user_id,role,status) VALUES($1,$2,$3,'ADMIN','ACTIVE') ON CONFLICT DO NOTHING",
        ['membership-' + user, org, user]
      );
    }
    await pool.query(
      "INSERT INTO projects(id,organization_id,name) VALUES('project-ie00-contract',$1,'Definition proof') ON CONFLICT DO NOTHING",
      [org]
    );
    for (const user of ['owner-contract-1', 'authority-contract-1', 'viewer-contract-1'])
      await pool.query(
        "INSERT INTO project_members(id,project_id,user_id,project_role) VALUES($1,'project-ie00-contract',$2,'PROJECT_LEADER') ON CONFLICT DO NOTHING",
        ['project-member-' + user, user]
      );
    await pool.query(
      "INSERT INTO ie_governance_policies(organization_id,scope_type,scope_id,policy_id,version,baseline,strictness,config_json) VALUES($1,'PROJECT','project-ie00-contract','ie00-policy',1,'STANDARD',2,$2) ON CONFLICT DO NOTHING",
      [
        org,
        JSON.stringify({
          selfApproval: false,
          gates: {
            DEFINITION: {
              quorum: 1,
              requiredRoles: ['GATE_AUTHORITY'],
              separation: true,
              slaHours: 48,
            },
          },
        }),
      ]
    );
    await pool.query(
      "INSERT INTO ie_governance_role_bindings(organization_id,policy_id,policy_version,role_key,principal_id,project_id) VALUES($1,'ie00-policy',1,'GATE_AUTHORITY','authority-contract-1','project-ie00-contract') ON CONFLICT DO NOTHING",
      [org]
    );
    await pool.query(
      "INSERT INTO organizations(id,name) VALUES('org-ie00-foreign','Foreign proof') ON CONFLICT DO NOTHING"
    );
    await pool.query(
      "INSERT INTO users(id,organization_id,email,password,role,status) VALUES('foreign-1','org-ie00-foreign','foreign@ie00.invalid','unused','ADMIN','active') ON CONFLICT DO NOTHING"
    );
    await pool.query(
      "INSERT INTO organization_members(id,organization_id,user_id,role,status) VALUES('membership-foreign','org-ie00-foreign','foreign-1','ADMIN','ACTIVE') ON CONFLICT DO NOTHING"
    );
    const { default: config } = await import('../../../config/Config.js');
    tokens['foreign-1'] = jwt.sign(
      { id: 'foreign-1', organizationId: 'org-ie00-foreign', role: 'ADMIN' },
      config.JWT_SECRET,
      { expiresIn: '30m' }
    );
    for (const actor of ['owner-contract-1', 'authority-contract-1', 'viewer-contract-1'])
      tokens[actor] = jwt.sign(
        { id: actor, organizationId: org, role: 'ADMIN' },
        config.JWT_SECRET,
        { expiresIn: '30m' }
      );
    const { ApiGateway } = await import('../../../Gateway.js');
    app = express();
    app.use(express.json());
    ApiGateway.getInstance().initializeRoutes(app);
  }, 180000);
  afterAll(async () => {
    await pool?.end();
    delete process.env.ENABLE_INITIATIVE_APPROVAL_V2;
  });
  const auth = (actor: string) => ({
    Authorization: `Bearer ${tokens[actor]}`,
    'x-organization-id': org,
  });
  const read = () =>
    pool.query(
      "SELECT version,payload_json FROM ie_aggregate_state WHERE organization_id=$1 AND aggregate_type='initiative' AND aggregate_id=$2",
      [org, id]
    );
  it('ON exposes typed canonical Definition receipt and named policy authority through real gateway', async () => {
    process.env.ENABLE_INITIATIVE_APPROVAL_V2 = 'true';
    const r = await request(app)
      .get(`${base}/initiatives/${id}/definition-approval`)
      .set(auth('owner-contract-1'));
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body).toMatchObject({
      enabled: true,
      sourceContract: 'RUNTIME_INITIATIVE_GATE',
      initiativeId: id,
      lifecycleState: 'REGISTERED_DRAFT',
    });
    expect(r.body.authorities.map((a: any) => a.id)).toEqual(['authority-contract-1']);
  });
  it('ON tenant boundary and named authority deny writes without changing the aggregate', async () => {
    process.env.ENABLE_INITIATIVE_APPROVAL_V2 = 'true';
    const foreign = {
      Authorization: `Bearer ${tokens['foreign-1']}`,
      'x-organization-id': 'org-ie00-foreign',
    };
    const a = await request(app).get(`${base}/initiatives/${id}/definition-approval`).set(foreign);
    const b = await request(app)
      .get(`${base}/initiatives/missing-ie00/definition-approval`)
      .set(foreign);
    expect(a.status).toBe(404);
    expect(b.status).toBe(404);
    expect(a.body).toEqual(b.body);
    const denied = await request(app)
      .post(`${base}/initiatives/${id}/gates/definition/requests`)
      .set(auth('owner-contract-1'))
      .send({
        expectedVersion: 1,
        clientRequestId: 'unbound-authority',
        decisionId: 'denied-id',
        authorityId: 'viewer-contract-1',
        dueAt: '2027-01-01T12:00:00Z',
      });
    expect(denied.status, JSON.stringify(denied.body)).toBe(403);
    expect((await read()).rows[0].version).toBe(1);
  });
  it('OFF hides the additive adapter without exposing canonical decision data', async () => {
    delete process.env.ENABLE_INITIATIVE_APPROVAL_V2;
    const r = await request(app)
      .get(`${base}/initiatives/${id}/definition-approval`)
      .set(auth('owner-contract-1'));
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ enabled: false });
  });
  it('OFF preserves the existing legal Definition request and approval writer through real gateway', async () => {
    delete process.env.ENABLE_INITIATIVE_APPROVAL_V2;
    const requested = await request(app)
      .post(`${base}/initiatives/${id}/gates/definition/requests`)
      .set(auth('owner-contract-1'))
      .send({
        expectedVersion: 1,
        clientRequestId: 'ie00-off-request',
        decisionId: 'ie00-off-decision',
        authorityId: 'authority-contract-1',
        dueAt: '2027-01-01T12:00:00Z',
      });
    expect(requested.status, JSON.stringify(requested.body)).toBe(201);
    const approved = await request(app)
      .post(`${base}/initiatives/${id}/gates/definition/decisions`)
      .set(auth('authority-contract-1'))
      .send({
        expectedVersion: 2,
        clientRequestId: 'ie00-off-approve',
        decisionId: 'ie00-off-decision',
        outcome: 'APPROVED',
        rationale: 'Existing legal Definition approval.',
      });
    expect(approved.status, JSON.stringify(approved.body)).toBe(201);
    expect((await read()).rows[0]).toMatchObject({
      version: 3,
      payload_json: { lifecycleState: 'DEFINED', definitionDecisionId: 'ie00-off-decision' },
    });
  });
  it('ON return edit resubmit approves the SAME Decision ID with durable versions and readback', async () => {
    process.env.ENABLE_INITIATIVE_APPROVAL_V2 = 'true';
    const post = async (action: string, actor: string, data: any) =>
      request(app)
        .post(`${base}/initiatives/${id}/gates/definition/${action}`)
        .set(auth(actor))
        .send(data);
    const decisionId = 'ie00-definition-same-id';
    const req = {
      expectedVersion: 1,
      clientRequestId: 'ie00-request-1',
      decisionId,
      authorityId: 'authority-contract-1',
      dueAt: '2027-01-01T12:00:00Z',
    };
    const requested = await post('requests', 'owner-contract-1', req);
    expect(requested.status, JSON.stringify(requested.body)).toBe(201);
    const denied = await post('decisions', 'viewer-contract-1', {
      expectedVersion: 2,
      clientRequestId: 'ie00-unbound-decide',
      decisionId,
      outcome: 'APPROVED',
      rationale: 'Admin is not the assigned authority.',
    });
    expect(denied.status, JSON.stringify(denied.body)).toBe(403);
    const returned = await post('decisions', 'authority-contract-1', {
      expectedVersion: 2,
      clientRequestId: 'ie00-return-1',
      decisionId,
      outcome: 'RETURNED',
      rationale: 'Clarify the scope.',
    });
    expect(returned.status, JSON.stringify(returned.body)).toBe(201);
    const edited = await request(app)
      .post(`${base}/initiatives/${id}/cards/summary-scope/publications`)
      .set(auth('owner-contract-1'))
      .send({
        expectedVersion: 3,
        expectedCardVersion: 1,
        clientRequestId: 'ie00-edit-scope',
        applicability: 'REQUIRED',
        completion: 'COMPLETE',
        quality: 'SUFFICIENT',
        freshness: 'CURRENT',
        reviewState: 'REQUESTED',
        content: {
          problem: 'Problem',
          outcome: 'Outcome clarified',
          inScope: ['Line 4 only'],
          outOfScope: ['Line 5'],
        },
        evidenceRefs: ['evidence:scope:clarified'],
        waiverDecisionId: null,
      });
    expect(edited.status, JSON.stringify(edited.body)).toBe(201);
    const reviewed = await request(app)
      .post(`${base}/initiatives/${id}/cards/summary-scope/reviews`)
      .set(auth('authority-contract-1'))
      .send({
        expectedVersion: 4,
        expectedCardVersion: 2,
        clientRequestId: 'ie00-review-scope',
        outcome: 'ACCEPTED',
        rationale: 'The requested scope clarification is sufficient.',
      });
    expect(reviewed.status, JSON.stringify(reviewed.body)).toBe(201);
    const stale = await post('requests', 'owner-contract-1', {
      ...req,
      expectedVersion: 3,
      clientRequestId: 'ie00-resubmit-stale',
    });
    expect(stale.status, JSON.stringify(stale.body)).toBe(409);
    const concurrent = await Promise.all(
      ['a', 'b'].map((suffix) =>
        post('requests', 'owner-contract-1', {
          ...req,
          expectedVersion: 5,
          clientRequestId: 'ie00-resubmit-' + suffix,
        })
      )
    );
    expect(concurrent.map((r) => r.status).sort()).toEqual([201, 409]);
    const pending = await request(app)
      .get(`${base}/initiatives/${id}/definition-approval`)
      .set(auth('owner-contract-1'));
    expect(pending.body.decision).toMatchObject({
      decisionId,
      status: 'PENDING',
      version: 3,
      cardVersions: { 'summary-scope': 3 },
    });
    const history = await pool.query(
      "SELECT payload_json->>'status' AS status FROM ie_audit_events WHERE organization_id=$1 AND aggregate_id=$2 AND command_type IN ('initiative.definition.request','initiative.definition.decide') ORDER BY aggregate_version",
      [org, id]
    );
    expect(history.rows.map((r) => r.status)).toEqual(['PENDING', 'RETURNED', 'PENDING']);
    const approved = await post('decisions', 'authority-contract-1', {
      expectedVersion: 6,
      clientRequestId: 'ie00-approve-1',
      decisionId,
      outcome: 'APPROVED',
      rationale: 'Definition evidence accepted.',
    });
    expect(approved.status, JSON.stringify(approved.body)).toBe(201);
    expect((await read()).rows[0]).toMatchObject({
      version: 7,
      payload_json: { lifecycleState: 'DEFINED', definitionDecisionId: decisionId },
    });
    const rows = await pool.query(
      "SELECT version,payload_json FROM ie_aggregate_state WHERE organization_id=$1 AND aggregate_type='decision'",
      [org]
    );
    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0]).toMatchObject({
      version: 4,
      payload_json: { decisionId, status: 'APPROVED' },
    });
    const cold = await request(app)
      .get(`${base}/initiatives/${id}/definition-approval`)
      .set(auth('owner-contract-1'));
    expect(cold.body.decision).toMatchObject({ decisionId, status: 'APPROVED', version: 4 });
  });
});
