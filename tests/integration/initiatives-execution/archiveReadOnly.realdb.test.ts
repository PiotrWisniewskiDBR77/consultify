import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { cleanupInitiativesExecutionOrg } from '../../support/initiativesExecutionOrgCleanup';

import { archiveClosedInitiative } from '../../../server/src/domain/initiatives-execution/effectivenessClosure';
import { updateExecutionTask } from '../../../server/src/domain/initiatives-execution/executionWork';
import { executeMaterialCommand } from '../../../server/src/domain/initiatives-execution/materialCommand';
import { transitionOperationalAllocation } from '../../../server/src/domain/initiatives-execution/operationalAllocation';
import { PostgresMaterialCommandUnitOfWork } from '../../../server/src/domain/initiatives-execution/postgresMaterialCommandUnitOfWork';
import { publishInitiativeCard } from '../../../server/src/domain/initiatives-execution/publishInitiativeCard';

const url = process.env.IE_TEST_DATABASE_URL?.trim();
const real = url ? describe : describe.skip;

real('ACO-59 archived Initiative read-only boundary realDB', () => {
  const pool = new Pool({ connectionString: url, max: 1 });
  const uow = new PostgresMaterialCommandUnitOfWork(pool);
  const org = 'org-aco59';
  const initiativeId = 'initiative-aco59';
  const env = (
    aggregateType: string,
    aggregateId: string,
    expectedVersion: number,
    clientRequestId: string,
    commandType: string,
    payload: any,
    createIfMissing = false
  ) => ({
    organizationId: org,
    actorId: 'actor-aco59',
    aggregateType,
    aggregateId,
    expectedVersion,
    clientRequestId,
    correlationId: clientRequestId,
    policyId: 'aco59-policy',
    policyVersion: 1,
    commandType,
    createIfMissing,
    payload,
  });

  beforeAll(async () => {
    for (const migration of [
      '932_initiatives_execution_material_commands.sql',
      '933_initiative_card_versions.sql',
    ]) {
      await pool.query(await readFile(path.resolve('server/migrations', migration), 'utf8'));
    }
  });
  beforeEach(async () => {
    await pool.query(`DELETE FROM ie_initiative_card_versions WHERE organization_id=$1`, [org]);
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
      `INSERT INTO ie_aggregate_state
       (organization_id,aggregate_type,aggregate_id,version,payload_json)
       VALUES
       ($1,'initiative',$2,1,$3::jsonb),
       ($1,'closure_snapshot','closure-aco59',1,$4::jsonb),
       ($1,'execution_case','case-aco59',3,$5::jsonb),
       ($1,'execution_task','task-aco59',2,$6::jsonb),
       ($1,'operational_allocation','allocation-aco59',1,$7::jsonb)`,
      [
        org,
        initiativeId,
        JSON.stringify({ initiativeId, lifecycleState: 'CLOSED', title: 'Immutable truth' }),
        JSON.stringify({ snapshotId: 'closure-aco59', initiativeId }),
        JSON.stringify({ executionCaseId: 'case-aco59', initiativeId, state: 'CLOSED' }),
        JSON.stringify({
          taskId: 'task-aco59',
          executionCaseId: 'case-aco59',
          initiativeId,
          title: 'Preserved task',
          status: 'OPEN',
          assigneeId: 'actor-aco59',
          ownerId: 'actor-aco59',
          blockerDecisionIds: [],
          dependencyTaskIds: [],
          evidenceRefs: [],
        }),
        JSON.stringify({
          allocationId: 'allocation-aco59',
          executionCaseId: 'case-aco59',
          initiativeId,
          taskId: 'task-aco59',
          assigneeId: 'actor-aco59',
          resourceManagerId: 'rm-aco59',
          status: 'PROPOSED',
          timeBasis: { windowUnit: 'WEEK', timezone: 'UTC', periods: [] },
          demand: { unit: 'HOURS', low: 1, base: 2, high: 3, knowledgeState: 'KNOWN' },
          availabilityRef: {},
          calendarRef: {},
          remainingEstimateRef: {},
          skillRequirements: [],
          costRef: null,
          conditions: [],
          rationale: null,
        }),
      ]
    );
    await pool.query(
      `INSERT INTO ie_initiative_card_versions
       (organization_id,initiative_id,card_key,card_version,aggregate_version,applicability,
        completion,quality,freshness,review_state,content_json,evidence_refs_json,published_by)
       VALUES($1,$2,'summary-scope',1,1,'REQUIRED','COMPLETE','SUFFICIENT','CURRENT',
              'NOT_REQUESTED',$3::jsonb,'[]'::jsonb,'author')`,
      [org, initiativeId, JSON.stringify({ title: 'Frozen card' })]
    );
  });
  afterAll(async () => {
    await cleanupInitiativesExecutionOrg(pool, org);
    await pool.end();
  });

  const digest = async () => {
    const result = await pool.query(
      `SELECT
        (SELECT md5(COALESCE(string_agg(aggregate_type||':'||aggregate_id||':'||version||':'||payload_json::text,'|' ORDER BY aggregate_type,aggregate_id),'')) FROM ie_aggregate_state WHERE organization_id=$1) state_hash,
        (SELECT md5(COALESCE(string_agg(card_key||':'||card_version||':'||content_json::text,'|' ORDER BY card_key,card_version),'')) FROM ie_initiative_card_versions WHERE organization_id=$1) card_hash,
        (SELECT count(*)::int FROM ie_audit_events WHERE organization_id=$1) audit_count,
        (SELECT count(*)::int FROM ie_outbox_events WHERE organization_id=$1) outbox_count,
        (SELECT count(*)::int FROM ie_command_receipts WHERE organization_id=$1) receipt_count,
        (SELECT count(*)::int FROM ie_aggregate_relations WHERE organization_id=$1) relation_count`,
      [org]
    );
    return result.rows[0];
  };

  it('archives once, then rejects Card, Task, Allocation and forged restore without data loss', async () => {
    await archiveClosedInitiative(
      uow,
      env(
        'archive_manifest',
        'archive-aco59',
        0,
        'archive-aco59',
        'initiative.archive',
        {
          initiativeId,
          expectedInitiativeVersion: 1,
          closureSnapshotRef: { snapshotId: 'closure-aco59', version: 1 },
          retentionPolicyRef: { ref: 'retention-policy', version: 1 },
          legalHold: false,
          exportRefs: [{ ref: 'closure-export', version: 1 }],
        },
        true
      )
    );
    const before = await digest();

    const forbidden = [
      () =>
        publishInitiativeCard(
          uow,
          env('initiative', initiativeId, 2, 'card-change', 'initiative.card.publish', {
            cardKey: 'summary-scope',
            expectedCardVersion: 1,
            applicability: 'REQUIRED',
            completion: 'COMPLETE',
            quality: 'SUFFICIENT',
            freshness: 'CURRENT',
            reviewState: 'NOT_REQUESTED',
            content: { title: 'Mutated' },
            evidenceRefs: [],
            waiverDecisionId: null,
          })
        ),
      () =>
        updateExecutionTask(
          uow,
          env('execution_task', 'task-aco59', 2, 'task-change', 'execution.task.update', {
            expectedCaseVersion: 3,
            patch: { title: 'Mutated' },
          })
        ),
      () =>
        transitionOperationalAllocation(
          uow,
          env(
            'operational_allocation',
            'allocation-aco59',
            1,
            'allocation-change',
            'operational-allocation.transition',
            {
              expectedCaseVersion: 3,
              expectedTaskVersion: 2,
              action: 'REQUEST',
              rationale: 'forged',
              conditions: [],
              expectedTimeBasis: { windowUnit: 'WEEK', timezone: 'UTC', periods: [] },
            }
          )
        ),
      () =>
        executeMaterialCommand(
          uow,
          env('initiative', initiativeId, 2, 'forged-restore', 'initiative.restore', {}),
          async () => ({
            mutation: { lifecycleState: 'CLOSED' },
            response: {},
            eventType: 'initiative.restored',
            eventPayload: {},
            auditPayload: {},
          })
        ),
    ];
    for (const attempt of forbidden) {
      await expect(attempt()).rejects.toThrow('Archived Initiative is read-only');
    }

    expect(await digest()).toEqual(before);
    const initiative = await pool.query(
      `SELECT version,payload_json FROM ie_aggregate_state WHERE organization_id=$1 AND aggregate_type='initiative' AND aggregate_id=$2`,
      [org, initiativeId]
    );
    expect(initiative.rows[0]).toMatchObject({
      version: 2,
      payload_json: { lifecycleState: 'ARCHIVED' },
    });
  });
});
