import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from './_helpers/assertRealPostgres';
import { registerInitiative } from '../../server/src/domain/initiatives-execution/registerInitiative';
import { requestScheduleDecision } from '../../server/src/domain/initiatives-execution/scheduleDecision';
import { PostgresMaterialCommandUnitOfWork } from '../../server/src/domain/initiatives-execution/postgresMaterialCommandUnitOfWork';

const databaseUrl = process.env.DATABASE_URL || '';
const organizationId = 'day197-red-contract-org';
const proposalId = 'day197-red-contract-proposal';
const initiativeId = 'day197-red-contract-initiative';

describe('Day197 legacy task cutover stage 1 realDB', () => {
  const pool = new Pool({ connectionString: databaseUrl, max: 3 });
  const uow = new PostgresMaterialCommandUnitOfWork(pool);

  beforeAll(async () => {
    await assertRealPostgresTestEnvironment();
    await pool.query('DELETE FROM initiative_candidates WHERE organization_id=$1', [
      organizationId,
    ]);
    for (const table of [
      'legacy_task_cutover_ledger',
      'ie_aggregate_relations',
      'ie_command_receipts',
      'ie_audit_events',
      'ie_outbox_events',
      'ie_aggregate_state',
    ]) {
      await pool.query(`DELETE FROM ${table} WHERE organization_id=$1`, [organizationId]);
    }
  });

  afterAll(async () => {
    await pool.query('DELETE FROM initiative_candidates WHERE organization_id=$1', [
      organizationId,
    ]);
    for (const table of [
      'legacy_task_cutover_ledger',
      'ie_aggregate_relations',
      'ie_command_receipts',
      'ie_audit_events',
      'ie_outbox_events',
      'ie_aggregate_state',
    ]) {
      await pool.query(`DELETE FROM ${table} WHERE organization_id=$1`, [organizationId]);
    }
    await pool.end();
  });

  it('uses PostgreSQL and exposes the additive ledger contract', async () => {
    expect(process.env.DB_TYPE).toBe('postgres');
    const columns = await pool.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema='public' AND table_name='legacy_task_cutover_ledger'`
    );
    expect(columns.rows.map((row) => row.column_name)).toEqual(
      expect.arrayContaining([
        'organization_id',
        'legacy_task_id',
        'batch_id',
        'status',
        'reason_code',
        'client_request_id',
        'canonical_id',
        'case_version_before',
        'case_version_after',
        'created_at',
        'updated_at',
        'checksum',
      ])
    );
  });

  it('proves the instructed five-command chain has a missing lifecycle transition', async () => {
    await pool.query(
      `INSERT INTO initiative_candidates
        (id, organization_id, source_type, source_id, source_version, title, problem,
         proposed_outcome, project_id, initiative_owner_id, visibility, evidence_state,
         duplicate_state, status, version)
       VALUES ($1,$2,'day197','legacy-task-source',1,'Day197 pilot','Prove chain gap',
         'One canonical pilot','day197-project','day197-owner','PROJECT','READY','CLEAR','pending',1)`,
      [proposalId, organizationId]
    );

    const registered = await registerInitiative(uow, {
      organizationId,
      actorId: 'day197-owner',
      aggregateType: 'initiative',
      aggregateId: initiativeId,
      expectedVersion: 0,
      clientRequestId: 'day197-register',
      correlationId: 'day197-batch',
      policyId: 'standard',
      policyVersion: 1,
      commandType: 'initiative.register',
      createIfMissing: true,
      payload: {
        proposalId,
        proposalVersion: 1,
        sourceType: 'day197',
        sourceId: 'legacy-task-source',
        sourceVersion: 1,
        title: 'Day197 pilot',
        problem: 'Prove chain gap',
        proposedOutcome: 'One canonical pilot',
        projectId: 'day197-project',
        visibility: 'PROJECT',
        initiativeOwnerId: 'day197-owner',
        validatorCapability: 'INITIATIVE_REGISTER',
      },
    });
    expect(registered.response.lifecycleState).toBe('REGISTERED_DRAFT');

    await expect(
      requestScheduleDecision(uow, {
        organizationId,
        actorId: 'day197-owner',
        aggregateType: 'initiative',
        aggregateId: initiativeId,
        expectedVersion: 1,
        clientRequestId: 'day197-schedule-request',
        correlationId: 'day197-batch',
        policyId: 'standard',
        policyVersion: 1,
        commandType: 'initiative.schedule.request',
        payload: {
          decisionId: 'day197-schedule-decision',
          authorityId: 'day197-independent-authority',
          executionManagerId: 'day197-owner',
          dueAt: '2026-09-01T12:00:00Z',
          portfolioScenarioId: 'not-reached',
          portfolioScenarioVersion: 1,
          planScenarioId: 'not-reached',
          planScenarioVersion: 1,
          capacityScenarioId: 'not-reached',
          capacityScenarioVersion: 1,
          commitmentIds: [],
          criticalPeriodIds: [],
          criticalDependencies: [],
          handoff: {
            scope: {},
            selectedOptions: {},
            success: {},
            baseline: {},
            openWork: [],
            raid: [],
            outcomeRefs: [],
            sourceVersions: { initiative: 1, portfolio: 1, plan: 1, capacity: 1 },
          },
          selfApprovalAllowed: false,
        },
      })
    ).rejects.toThrow('Initiative is not APPROVED_BACKLOG');

    const state = await pool.query<{ lifecycle_state: string }>(
      `SELECT payload_json->>'lifecycleState' AS lifecycle_state
       FROM ie_aggregate_state
       WHERE organization_id=$1 AND aggregate_type='initiative' AND aggregate_id=$2`,
      [organizationId, initiativeId]
    );
    expect(state.rows[0]?.lifecycle_state).toBe('REGISTERED_DRAFT');
  });
});
