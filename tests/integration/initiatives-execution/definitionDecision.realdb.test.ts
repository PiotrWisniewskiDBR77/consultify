import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  decideDefinition,
  requestDefinitionDecision,
} from '../../../server/src/domain/initiatives-execution/definitionDecision';
import { PostgresMaterialCommandUnitOfWork } from '../../../server/src/domain/initiatives-execution/postgresMaterialCommandUnitOfWork';

const databaseUrl = process.env.DATABASE_URL?.trim();
const describeRealDb = databaseUrl ? describe : describe.skip;

describeRealDb('Definition Decision PostgreSQL vertical', () => {
  const pool = new Pool({ connectionString: databaseUrl, max: 3 });
  const unitOfWork = new PostgresMaterialCommandUnitOfWork(pool);

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
      await pool.query(
        await readFile(path.resolve('server/migrations', migrationName), 'utf8')
      );
    }
  });

  beforeEach(async () => {
    await pool.query(
      'TRUNCATE initiative_candidates, ie_initiative_card_versions, ie_aggregate_relations, ie_command_receipts, ie_audit_events, ie_outbox_delivery_receipts, ie_outbox_events, ie_aggregate_state RESTART IDENTITY'
    );
    await pool.query(`INSERT INTO initiative_candidates
      (id, organization_id, source_type, source_id, source_version, title, problem,
       proposed_outcome, project_id, initiative_owner_id, visibility, evidence_state,
       duplicate_state, status, version, registered_initiative_id)
      VALUES ('proposal-definition-1','org-definition','assessment','finding-1',3,
       'Definition Initiative','Problem','Outcome','project-definition','owner-1',
       'PROJECT','READY','CLEAR','accepted',2,'initiative-definition-1')`);
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
       VALUES ('org-definition','initiative','initiative-definition-1',1,$1::jsonb)`,
      [
        JSON.stringify({
          initiativeId: 'initiative-definition-1',
          projectId: 'project-definition',
          lifecycleState: 'REGISTERED_DRAFT',
          source: {
            proposalId: 'proposal-definition-1',
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
      ['roles-raci', { accountableOwnerId: 'owner-1', roles: ['Engineer'] }],
      ['stakeholders', { ownerId: 'owner-1', sponsorId: 'sponsor-1' }],
    ] as const;
    for (const [cardKey, content] of cards) {
      await pool.query(
        `INSERT INTO ie_initiative_card_versions
          (organization_id, initiative_id, card_key, card_version, aggregate_version,
           applicability, completion, quality, freshness, review_state, content_json,
           evidence_refs_json, published_by, reviewed_by, review_decision_id, review_rationale)
         VALUES ('org-definition','initiative-definition-1',$1,1,1,
          'REQUIRED','COMPLETE','SUFFICIENT','CURRENT','ACCEPTED',$2::jsonb,
          $3::jsonb,'owner-1','reviewer-1',$4,'Sufficient')`,
        [cardKey, JSON.stringify(content), JSON.stringify([`evidence:${cardKey}:v1`]), `review:${cardKey}`]
      );
    }
  });

  const requestCommand = {
    organizationId: 'org-definition',
    actorId: 'owner-1',
    aggregateType: 'initiative',
    aggregateId: 'initiative-definition-1',
    expectedVersion: 1,
    clientRequestId: 'definition-request-1',
    correlationId: 'definition-request-correlation-1',
    policyId: 'standard-definition',
    policyVersion: 2,
    commandType: 'initiative.definition.request',
    payload: {
      decisionId: 'definition-decision-1',
      authorityId: 'definition-authority-1',
      dueAt: '2026-08-20T12:00:00.000Z',
      selfApprovalAllowed: false,
    },
  };

  it('requests then approves Definition with one Decision and exact evidence snapshot', async () => {
    const requested = await requestDefinitionDecision(unitOfWork, requestCommand);
    expect(requested.response.status).toBe('PENDING');
    expect(requested.response.cardVersions).toEqual({
      'summary-scope': 1,
      'strategic-fit': 1,
      'success-criteria': 1,
      'outcomes-benefits': 1,
      options: 1,
      'people-team': 1,
      'roles-raci': 1,
      stakeholders: 1,
    });
    const approved = await decideDefinition(unitOfWork, {
      organizationId: 'org-definition',
      actorId: 'definition-authority-1',
      aggregateType: 'initiative',
      aggregateId: 'initiative-definition-1',
      expectedVersion: 2,
      clientRequestId: 'definition-approve-1',
      correlationId: 'definition-approve-correlation-1',
      policyId: 'standard-definition',
      policyVersion: 2,
      commandType: 'initiative.definition.decide',
      payload: {
        decisionId: 'definition-decision-1',
        outcome: 'APPROVED',
        rationale: 'The Definition is complete and independently reviewed.',
        selfApprovalAllowed: false,
      },
    });
    expect(approved.response.status).toBe('APPROVED');
    const initiative = await pool.query(
      `SELECT version, payload_json->>'lifecycleState' lifecycle,
              payload_json->>'gateState' gate_state
         FROM ie_aggregate_state
        WHERE aggregate_type = 'initiative' AND aggregate_id = 'initiative-definition-1'`
    );
    expect(initiative.rows[0]).toEqual({ version: 3, lifecycle: 'DEFINED', gate_state: 'APPROVED' });
    const decision = await pool.query(
      `SELECT version, payload_json->>'status' status
         FROM ie_aggregate_state
        WHERE aggregate_type = 'decision' AND aggregate_id = 'definition-decision-1'`
    );
    expect(decision.rows[0]).toEqual({ version: 2, status: 'APPROVED' });
  });

  it('rejects a request that names the requester as authority under standard policy', async () => {
    await expect(
      requestDefinitionDecision(unitOfWork, {
        ...requestCommand,
        clientRequestId: 'definition-self-request',
        payload: { ...requestCommand.payload, authorityId: 'owner-1' },
      })
    ).rejects.toThrow('Independent Definition authority is required');
    expect((await pool.query("SELECT 1 FROM ie_aggregate_state WHERE aggregate_type = 'decision'")).rowCount).toBe(0);
  });

  afterAll(async () => pool.end());
});
