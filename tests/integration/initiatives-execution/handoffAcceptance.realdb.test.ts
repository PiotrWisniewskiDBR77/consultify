import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { cleanupInitiativesExecutionOrg } from '../../support/initiativesExecutionOrgCleanup';
import {
  decideHandoffAcceptance,
  requestHandoffAcceptance,
} from '../../../server/src/domain/initiatives-execution/handoffAcceptance';
import { PostgresMaterialCommandUnitOfWork } from '../../../server/src/domain/initiatives-execution/postgresMaterialCommandUnitOfWork';
import { PostgresInitiativeReader } from '../../../server/src/domain/initiatives-execution/postgresInitiativeReader';
const url = process.env.IE_TEST_DATABASE_URL?.trim();
const real = url ? describe : describe.skip;
real('Handoff Acceptance and canonical Execution Case realDB', () => {
  const pool = new Pool({ connectionString: url, max: 6 }),
    uow = new PostgresMaterialCommandUnitOfWork(pool),
    reader = new PostgresInitiativeReader(pool);
  const org = 'org-ie070',
    initiativeId = 'initiative-ie070',
    handoffId = 'handoff-ie070';
  const env = (actor: string, version: number, key: string, type: string, payload: any) => ({
    organizationId: org,
    actorId: actor,
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
  const request = (decisionId: string, caseId: string) => ({
    decisionId,
    handoffPackageId: handoffId,
    handoffPackageVersion: 1,
    executionCaseId: caseId,
    authorityId: 'execution-manager',
    dueAt: '2026-08-20T12:00:00Z',
    rolloutChildren: { pilot: [{ childId: 'pilot-1' }], waves: [{ childId: 'wave-1' }] },
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
      `INSERT INTO ie_aggregate_state(organization_id,aggregate_type,aggregate_id,version,payload_json)VALUES($1,'initiative',$2,12,$3::jsonb),($1,'handoff_package',$4,1,$5::jsonb)`,
      [
        org,
        initiativeId,
        JSON.stringify({
          initiativeId,
          projectId: 'p1',
          lifecycleState: 'SCHEDULED',
          handoffPackageId: handoffId,
          executionState: 'HANDOFF_PENDING',
        }),
        handoffId,
        JSON.stringify({
          handoffPackageId: handoffId,
          version: 1,
          initiativeId,
          decisionId: 'schedule-1',
          executionManagerId: 'execution-manager',
          snapshot: {
            scope: {},
            selectedOptions: {},
            success: {},
            baseline: {},
            openWork: [],
            raid: [],
            outcomeRefs: [],
            sourceVersions: {},
          },
          portfolio: { id: 'p', version: 1 },
          plan: { id: 'pl', version: 1 },
          capacity: { id: 'c', version: 1 },
          commitmentVersions: {},
          createdAt: '2026-08-09T20:00:00Z',
        }),
      ]
    );
  });
  afterAll(async () => {
    await cleanupInitiativesExecutionOrg(pool, org);
    await pool.end();
  });
  it('RETURN creates no case and keeps SCHEDULED/HANDOFF_PENDING', async () => {
    await requestHandoffAcceptance(
      uow,
      env(
        'project-lead',
        12,
        'return-request',
        'initiative.handoff.request',
        request('return-decision', 'case-return')
      )
    );
    await decideHandoffAcceptance(
      uow,
      env('execution-manager', 13, 'return-decide', 'initiative.handoff.decide', {
        decisionId: 'return-decision',
        outcome: 'RETURN_WITH_BLOCKERS',
        gaps: [],
        blockers: [
          {
            itemId: 'b1',
            description: 'Baseline missing',
            ownerId: 'project-lead',
            dueAt: '2026-08-15T12:00:00Z',
          },
        ],
        rationale: 'Return',
      })
    );
    const i = await pool.query(
      `SELECT payload_json FROM ie_aggregate_state WHERE organization_id=$1 AND aggregate_type='initiative'`,
      [org]
    );
    expect(i.rows[0].payload_json).toMatchObject({
      lifecycleState: 'SCHEDULED',
      executionState: 'HANDOFF_PENDING',
    });
    expect(await reader.listExecutionCases(org)).toEqual([]);
  });
  it('under concurrent accepts creates exactly one stable case and retry replays it', async () => {
    await requestHandoffAcceptance(
      uow,
      env('project-lead', 12, 'r1', 'initiative.handoff.request', request('d1', 'case-1'))
    );
    await requestHandoffAcceptance(
      uow,
      env('project-lead', 13, 'r2', 'initiative.handoff.request', request('d2', 'case-2'))
    );
    const payload = (decisionId: string) => ({
      decisionId,
      outcome: 'ACCEPT' as const,
      gaps: [],
      blockers: [],
      rationale: 'Accepted',
    });
    const attempts = await Promise.allSettled([
      decideHandoffAcceptance(
        uow,
        env('execution-manager', 14, 'a1', 'initiative.handoff.decide', payload('d1'))
      ),
      decideHandoffAcceptance(
        uow,
        env('execution-manager', 14, 'a2', 'initiative.handoff.decide', payload('d2'))
      ),
    ]);
    expect(attempts.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
    expect(attempts.filter((x) => x.status === 'rejected')).toHaveLength(1);
    const winner =
      attempts[0].status === 'fulfilled'
        ? { key: 'a1', decision: 'd1', caseId: 'case-1' }
        : { key: 'a2', decision: 'd2', caseId: 'case-2' };
    const replay = await decideHandoffAcceptance(
      uow,
      env(
        'execution-manager',
        14,
        winner.key,
        'initiative.handoff.decide',
        payload(winner.decision)
      )
    );
    expect(replay.status).toBe('REPLAYED');
    const cases = await reader.listExecutionCases(org);
    expect(cases).toEqual([
      expect.objectContaining({ executionCaseId: winner.caseId, initiativeId, state: 'ACTIVE' }),
    ]);
    expect(await reader.listExecutionCases('foreign-org')).toEqual([]);
    expect(await reader.findExecutionCaseByInitiative('foreign-org', initiativeId)).toBeNull();
    expect(await reader.findExecutionCaseByInitiative(org, initiativeId)).toEqual(
      expect.objectContaining({ executionCaseId: winner.caseId })
    );
    const i = await pool.query(
      `SELECT payload_json FROM ie_aggregate_state WHERE organization_id=$1 AND aggregate_type='initiative'`,
      [org]
    );
    expect(i.rows[0].payload_json).toMatchObject({
      lifecycleState: 'IN_EXECUTION',
      executionState: 'ACTIVE',
      executionCaseId: winner.caseId,
    });
    expect(
      (
        await pool.query(
          `SELECT count(*)::int n FROM ie_aggregate_relations WHERE organization_id=$1 AND relation_type='INITIATIVE_EXECUTION_CASE'`,
          [org]
        )
      ).rows[0].n
    ).toBe(1);
  });
});
