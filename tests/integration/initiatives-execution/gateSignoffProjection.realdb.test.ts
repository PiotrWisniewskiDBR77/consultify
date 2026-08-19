import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { cleanupInitiativesExecutionOrg } from '../../support/initiativesExecutionOrgCleanup';

import { PostgresInitiativeReader } from '../../../server/src/domain/initiatives-execution/postgresInitiativeReader';

const url = process.env.IE_TEST_DATABASE_URL?.trim();
const real = url ? describe : describe.skip;

real('GateSignoff My Work projection realDB', () => {
  const pool = new Pool({ connectionString: url, max: 1 });
  const reader = new PostgresInitiativeReader(pool);
  const org = 'org-gate-projection';

  beforeAll(async () => {
    for (const migration of [
      '932_initiatives_execution_material_commands.sql',
      '934_organization_governance_profiles.sql',
    ]) {
      await pool.query(await readFile(path.resolve('server/migrations', migration), 'utf8'));
    }
  });
  beforeEach(async () => {
    await pool.query(`DELETE FROM ie_governance_role_bindings WHERE organization_id=$1`, [org]);
    await pool.query(`DELETE FROM ie_governance_policies WHERE organization_id=$1`, [org]);
    for (const table of [
      'ie_aggregate_relations',
      'ie_command_receipts',
      'ie_audit_events',
      'ie_outbox_events',
      'ie_aggregate_state',
    ]) {
      await pool.query(`DELETE FROM ${table} WHERE organization_id=$1`, [org]);
    }
    await pool.query(
      `INSERT INTO ie_governance_policies
       (organization_id,scope_type,scope_id,policy_id,version,baseline,strictness,config_json,status)
       VALUES($1,'ORGANIZATION',$1,'policy-gate',3,'STANDARD',2,$2::jsonb,'ACTIVE')`,
      [
        org,
        JSON.stringify({
          enforceGateGovernance: true,
          gates: {
            DEFINITION: {
              quorum: 1,
              requiredRoles: ['GATE_AUTHORITY'],
              separation: true,
              slaHours: 36,
            },
            CLOSURE: {
              quorum: 1,
              requiredRoles: ['GATE_AUTHORITY'],
              separation: true,
              slaHours: 24,
            },
          },
        }),
      ]
    );
    await pool.query(
      `INSERT INTO ie_governance_role_bindings
       (organization_id,policy_id,policy_version,role_key,principal_id,project_id)
       VALUES($1,'policy-gate',3,'GATE_AUTHORITY','reviewer-a','project-a')`,
      [org]
    );
    const decision = {
      decisionId: 'decision-a',
      initiativeId: 'initiative-a',
      gate: 'DEFINITION',
      status: 'PENDING',
      requesterId: 'requester-a',
      authorityId: 'reviewer-a',
      requestedAt: '2026-08-10T00:00:00.000Z',
      dueAt: '2026-08-11T12:00:00.000Z',
    };
    await pool.query(
      `INSERT INTO ie_aggregate_state
       (organization_id,aggregate_type,aggregate_id,version,payload_json)
       VALUES($1,'initiative','initiative-a',5,$2::jsonb),($1,'decision','decision-a',1,$3::jsonb)`,
      [
        org,
        JSON.stringify({ initiativeId: 'initiative-a', projectId: 'project-a' }),
        JSON.stringify(decision),
      ]
    );
    await pool.query(
      `INSERT INTO ie_aggregate_relations
       (organization_id,relation_type,source_type,source_id,source_version,target_type,target_id,payload_json)
       VALUES($1,'INITIATIVE_DEFINITION_DECISION:decision-a','initiative','initiative-a',5,'decision','decision-a','{}')`,
      [org]
    );
    await pool.query(
      `INSERT INTO ie_audit_events
       (organization_id,actor_id,aggregate_type,aggregate_id,aggregate_version,command_type,
        client_request_id,correlation_id,policy_id,policy_version,payload_json)
       VALUES($1,'requester-a','initiative','initiative-a',5,'initiative.definition.request',
              'request-a','request-a','policy-gate',3,$2::jsonb)`,
      [org, JSON.stringify(decision)]
    );
  });
  afterAll(async () => {
    await cleanupInitiativesExecutionOrg(pool, org);
    await pool.end();
  });

  it('returns exact pending context, policy/rule, direct eligibility and zero-version quorum', async () => {
    const [item] = await reader.listMyGateSignoffs(org, 'reviewer-a');
    expect(item).toMatchObject({
      gate: 'DEFINITION',
      decisionId: 'decision-a',
      decisionVersion: 1,
      initiativeId: 'initiative-a',
      projectId: 'project-a',
      requesterId: 'requester-a',
      actorEligible: true,
      effectivePolicy: {
        policyId: 'policy-gate',
        policyVersion: 3,
        profile: 'STANDARD',
        policyEnforced: true,
        rule: {
          quorum: 1,
          requiredRoles: ['GATE_AUTHORITY'],
          separation: true,
          slaHours: 36,
        },
      },
      actorBindings: [{ roleKey: 'GATE_AUTHORITY', mode: 'DIRECT', eligible: true }],
      quorum: {
        quorumId: 'DEFINITION:decision-a',
        version: 0,
        status: 'COLLECTING',
        signoffs: [],
        receiptId: null,
      },
    });
    expect(await reader.listMyGateSignoffs('foreign-org', 'reviewer-a')).toEqual([]);
    expect((await reader.listMyGateSignoffs(org, 'requester-a'))[0].actorEligible).toBe(false);

    await pool.query(
      `INSERT INTO ie_aggregate_state
       (organization_id,aggregate_type,aggregate_id,version,payload_json)
       VALUES($1,'gate_quorum','DEFINITION:decision-a',1,$2::jsonb)`,
      [
        org,
        JSON.stringify({
          quorumId: 'DEFINITION:decision-a',
          gate: 'DEFINITION',
          decisionId: 'decision-a',
          initiativeId: 'initiative-a',
          requesterId: 'requester-a',
          policyId: 'policy-gate',
          policyVersion: 3,
          status: 'SATISFIED',
          receiptId: 'receipt-a',
          signoffs: [
            {
              signoffId: 'signoff-a',
              signerId: 'reviewer-a',
              roleKey: 'GATE_AUTHORITY',
              outcome: 'APPROVE',
            },
          ],
          updatedAt: '2026-08-10T01:00:00.000Z',
        }),
      ]
    );
    expect((await reader.listMyGateSignoffs(org, 'reviewer-a'))[0].quorum).toMatchObject({
      version: 1,
      status: 'SATISFIED',
      receiptId: 'receipt-a',
      signoffs: [{ signoffId: 'signoff-a' }],
    });
    expect((await reader.listMyGateSignoffs(org, 'reviewer-a'))[0]).toMatchObject({
      actorEligible: false,
      actorAuthorized: true,
      actorCanDecide: true,
      actorAlreadySigned: true,
    });
  });

  it('projects a pending Closure case with its request policy and a zero-version quorum', async () => {
    const closure = {
      closureCaseId: 'closure-a',
      initiativeId: 'initiative-a',
      executionCaseId: 'execution-a',
      requesterId: 'requester-a',
      authorityId: 'reviewer-a',
      status: 'PENDING',
      requestedAt: '2026-08-10T02:00:00.000Z',
    };
    await pool.query(
      `INSERT INTO ie_aggregate_state
       (organization_id,aggregate_type,aggregate_id,version,payload_json)
       VALUES($1,'closure_case','closure-a',1,$2::jsonb)`,
      [org, JSON.stringify(closure)]
    );
    await pool.query(
      `INSERT INTO ie_aggregate_relations
       (organization_id,relation_type,source_type,source_id,source_version,target_type,target_id,payload_json)
       VALUES($1,'INITIATIVE_CLOSURE_CASE:closure-a','initiative','initiative-a',5,'closure_case','closure-a','{}')`,
      [org]
    );
    await pool.query(
      `INSERT INTO ie_audit_events
       (organization_id,actor_id,aggregate_type,aggregate_id,aggregate_version,command_type,
        client_request_id,correlation_id,policy_id,policy_version,payload_json)
       VALUES($1,'requester-a','closure_case','closure-a',1,'closure.request',
              'closure-request-a','closure-request-a','policy-gate',3,$2::jsonb)`,
      [org, JSON.stringify(closure)]
    );

    const item = (await reader.listMyGateSignoffs(org, 'reviewer-a')).find(
      (candidate) => candidate.decisionId === 'closure-a'
    );
    expect(item).toMatchObject({
      gate: 'CLOSURE',
      decisionId: 'closure-a',
      decisionVersion: 1,
      initiativeId: 'initiative-a',
      projectId: 'project-a',
      requesterId: 'requester-a',
      authorityId: 'reviewer-a',
      actorEligible: true,
      actorCanDecide: true,
      effectivePolicy: {
        policyId: 'policy-gate',
        policyVersion: 3,
        rule: { quorum: 1, separation: true, slaHours: 24 },
      },
      quorum: {
        quorumId: 'CLOSURE:closure-a',
        version: 0,
        status: 'COLLECTING',
        signoffs: [],
        receiptId: null,
      },
    });
  });
});
