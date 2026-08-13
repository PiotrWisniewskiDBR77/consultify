import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createExecutionTask } from '../../../server/src/domain/initiatives-execution/executionWork';
import {
  createReportRun,
  transitionReportRun,
} from '../../../server/src/domain/initiatives-execution/reportRun';
import { PostgresMaterialCommandUnitOfWork } from '../../../server/src/domain/initiatives-execution/postgresMaterialCommandUnitOfWork';
import { PostgresInitiativeReader } from '../../../server/src/domain/initiatives-execution/postgresInitiativeReader';
const url = process.env.IE_TEST_DATABASE_URL?.trim(),
  real = url ? describe : describe.skip;
real('Persisted Report Run realDB', () => {
  const pool = new Pool({ connectionString: url, max: 2 }),
    uow = new PostgresMaterialCommandUnitOfWork(pool),
    reader = new PostgresInitiativeReader(pool),
    org = 'org-ie075',
    definitionId = 'definition-1',
    runId = 'run-1',
    caseId = 'case-ie075',
    initiativeId = 'initiative-ie075';
  const env = (
    type: string,
    id: string,
    actor: string,
    v: number,
    key: string,
    commandType: string,
    payload: any,
    create = false
  ) => ({
    organizationId: org,
    actorId: actor,
    aggregateType: type,
    aggregateId: id,
    expectedVersion: v,
    clientRequestId: key,
    correlationId: key,
    policyId: 'report-run',
    policyVersion: 1,
    commandType,
    createIfMissing: create,
    payload,
  });
  beforeAll(async () => {
    for (const f of [
      '932_initiatives_execution_material_commands.sql',
      '933_initiative_card_versions.sql',
    ])
      await pool.query(await readFile(path.resolve('server/migrations', f), 'utf8'));
  });
  beforeEach(async () => {
    for (const t of [
      'ie_aggregate_relations',
      'ie_command_receipts',
      'ie_audit_events',
      'ie_outbox_events',
      'ie_aggregate_state',
    ])
      await pool.query(`DELETE FROM ${t} WHERE organization_id=$1`, [org]);
    await pool.query(
      `INSERT INTO ie_aggregate_state(organization_id,aggregate_type,aggregate_id,version,payload_json)VALUES($1,'report_definition',$2,3,$3::jsonb),($1,'execution_case',$4,1,$5::jsonb)`,
      [
        org,
        definitionId,
        JSON.stringify({
          definitionId,
          tenantId: org,
          currentVersion: 3,
          versions: [
            {
              definitionVersion: 3,
              state: 'PUBLISHED',
              name: 'Weekly execution',
              sections: [{ sectionId: 'health', title: 'Health', mandatory: true }],
            },
          ],
        }),
        caseId,
        JSON.stringify({ executionCaseId: caseId, initiativeId, state: 'ACTIVE' }),
      ]
    );
  });
  afterAll(async () => pool.end());
  const source = (freshness: 'CURRENT' | 'STALE' = 'CURRENT') => ({
    sourceType: 'execution_case',
    sourceId: caseId,
    version: 1,
    capturedAt: '2026-08-10T10:00:00.000Z',
    freshness,
    formula: 'blocked / total',
    unit: 'ratio',
    currency: null,
    window: { start: '2026-08-03T00:00:00.000Z', end: '2026-08-10T00:00:00.000Z' },
    confidence: 'HIGH' as const,
    accessState: 'REDACTED' as const,
    redactions: ['personal-data'],
  });
  const draft = (sources: any[], parentRunRef: any = null) => ({
    definitionRef: { definitionId, version: 3 },
    parentRunRef,
    audience: ['Steering Committee'],
    scopeRefs: [`case:${caseId}`],
    period: { start: '2026-08-03T00:00:00.000Z', end: '2026-08-10T00:00:00.000Z' },
    asOf: '2026-08-10T10:00:00.000Z',
    sources,
    ownerId: 'owner',
    approverId: 'approver',
  });
  it('freezes immutable snapshot, publishes reproducible package once, links canonical follow-up and refreshes into new DRAFT', async () => {
    await createReportRun(
      uow,
      env('report_run', runId, 'owner', 0, 'draft', 'report-run.create', draft([source()]), true)
    );
    const action = (id: string, actor: string, v: number, key: string, payload: any) =>
      transitionReportRun(
        uow,
        env('report_run', id, actor, v, key, 'report-run.transition', payload)
      );
    await action(runId, 'owner', 1, 'validate', { action: 'VALIDATE' });
    const frozen = await action(runId, 'owner', 2, 'freeze', { action: 'FREEZE' });
    await action(runId, 'approver', 3, 'approve', {
      action: 'DECIDE',
      outcome: 'APPROVED',
      rationale: 'Sources accepted',
    });
    const pubPayload = {
      action: 'PUBLISH',
      distribution: {
        receiptId: 'dist-1',
        audience: 'Steering Committee',
        distributedAt: '2026-08-10T12:00:00.000Z',
      },
    };
    await expect(action(runId, 'publisher', 4, 'publish-denied', pubPayload)).rejects.toThrow(
      'Authorized Report Approver'
    );
    const published = await action(runId, 'approver', 4, 'publish', pubPayload),
      replay = await action(runId, 'approver', 4, 'publish', pubPayload);
    expect(replay.status).toBe('REPLAYED');
    expect((published.response as any).exportPackage.contentHash).toBe(
      (frozen.response as any).contentHash
    );
    await createExecutionTask(
      uow,
      env(
        'execution_task',
        'follow-task',
        'owner',
        0,
        'follow-task-create',
        'execution.task.create',
        {
          expectedCaseVersion: 1,
          executionCaseId: caseId,
          initiativeId,
          title: 'Follow report finding',
          description: 'Canonical follow-up',
          assigneeId: 'worker',
          ownerId: 'owner',
          dueAt: '2026-08-15T12:00:00.000Z',
          slaAt: '2026-08-14T12:00:00.000Z',
          evidenceRefs: [],
          blockerDecisionIds: [],
          dependencyTaskIds: [],
        },
        true
      )
    );
    await action(runId, 'owner', 5, 'link', {
      action: 'LINK_FOLLOW_UP',
      taskReceiptClientRequestId: 'follow-task-create',
      taskId: 'follow-task',
      taskVersion: 1,
    });
    await createReportRun(
      uow,
      env(
        'report_run',
        'run-2',
        'owner',
        0,
        'refresh',
        'report-run.create',
        draft([source()], { reportRunId: runId, version: 6 }),
        true
      )
    );
    const runs = await reader.listReportRuns(org);
    expect(runs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          reportRunId: runId,
          status: 'PUBLISHED',
          contentHash: (frozen.response as any).contentHash,
          distributionReceipts: [expect.objectContaining({ receiptId: 'dist-1' })],
          followUpTaskRef: expect.objectContaining({ taskId: 'follow-task' }),
        }),
        expect.objectContaining({
          reportRunId: 'run-2',
          status: 'DRAFT',
          parentRunRef: { reportRunId: runId, version: 6 },
        }),
      ])
    );
    expect(await reader.listReportRuns('foreign')).toEqual([]);
    expect(await reader.findReportDefinition(org, definitionId)).toEqual(
      expect.objectContaining({ definitionId, version: 3 })
    );
    expect(await reader.findReportDefinition('foreign', definitionId)).toBeNull();
    const evidence = await pool.query(
      `SELECT (SELECT count(*)::int FROM ie_command_receipts WHERE organization_id=$1) receipts,(SELECT count(*)::int FROM ie_audit_events WHERE organization_id=$1) audits,(SELECT count(*)::int FROM ie_outbox_events WHERE organization_id=$1) outbox,(SELECT count(*)::int FROM ie_aggregate_relations WHERE organization_id=$1) relations`,
      [org]
    );
    expect(evidence.rows[0]).toMatchObject({ receipts: 8, audits: 8, outbox: 8, relations: 3 });
  });
  it('fails validation closed for stale source and cannot use a foreign definition', async () => {
    await createReportRun(
      uow,
      env(
        'report_run',
        runId,
        'owner',
        0,
        'stale-draft',
        'report-run.create',
        draft([source('STALE')]),
        true
      )
    );
    await expect(
      transitionReportRun(
        uow,
        env('report_run', runId, 'owner', 1, 'stale-validate', 'report-run.transition', {
          action: 'VALIDATE',
        })
      )
    ).rejects.toThrow('STALE_OR_UNKNOWN_SOURCE');
    await expect(
      createReportRun(uow, {
        ...env(
          'report_run',
          'foreign-definition-run',
          'owner',
          0,
          'foreign-def',
          'report-run.create',
          { ...draft([source()]), definitionRef: { definitionId: 'missing', version: 1 } },
          true
        ),
      })
    ).rejects.toThrow('tenant-scoped');
  });
});
