import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { cleanupInitiativesExecutionOrg } from '../../support/initiativesExecutionOrgCleanup';
import {
  createMaterialChange,
  transitionMaterialChange,
} from '../../../server/src/domain/initiatives-execution/materialChange';
import { PostgresMaterialCommandUnitOfWork } from '../../../server/src/domain/initiatives-execution/postgresMaterialCommandUnitOfWork';
import { PostgresInitiativeReader } from '../../../server/src/domain/initiatives-execution/postgresInitiativeReader';
const url = process.env.IE_TEST_DATABASE_URL?.trim(),
  real = url ? describe : describe.skip;
real('Material Change Reapproval realDB', () => {
  const pool = new Pool({ connectionString: url, max: 2 }),
    uow = new PostgresMaterialCommandUnitOfWork(pool),
    reader = new PostgresInitiativeReader(pool),
    org = 'org-ie023',
    planId = 'plan-baseline',
    oldSnapshot = {
      name: 'Plan',
      state: 'PUBLISHED',
      windowUnit: 'WEEK',
      timezone: 'Europe/Warsaw',
      periods: [{ periodId: '2026-W36', start: '2026-08-31', end: '2026-09-06' }],
      targetDate: '2026-09-01',
    };
  const env = (
    id: string,
    actor: string,
    v: number,
    key: string,
    payload: any,
    create = false
  ) => ({
    organizationId: org,
    actorId: actor,
    aggregateType: 'material_change',
    aggregateId: id,
    expectedVersion: v,
    clientRequestId: key,
    correlationId: key,
    policyId: 'material-change',
    policyVersion: 1,
    commandType: create ? 'material-change.create' : 'material-change.transition',
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
      `INSERT INTO ie_aggregate_state(organization_id,aggregate_type,aggregate_id,version,payload_json)VALUES($1,'plan_scenario',$2,1,$3::jsonb)`,
      [org, planId, JSON.stringify(oldSnapshot)]
    );
  });
  afterAll(async () => {
    await cleanupInitiativesExecutionOrg(pool, org);
    await pool.end();
  });
  const impact = { knowledgeState: 'KNOWN' as const, refs: [] },
    newSnapshot = { ...oldSnapshot, targetDate: '2026-10-01' },
    draft = {
      target: {
        kind: 'PLANNING_BASELINE' as const,
        aggregateType: 'plan_scenario' as const,
        aggregateId: planId,
        version: 1,
      },
      oldSnapshot,
      newSnapshot,
      diff: [{ path: 'targetDate', oldValue: '2026-09-01', newValue: '2026-10-01' }],
      classification: 'MATERIAL' as const,
      tolerance: {
        policyRef: 'change-policy',
        policyVersion: 2,
        withinTolerance: false,
        rationale: 'One month shift',
      },
      blastRadius: {
        tasks: impact,
        decisions: impact,
        milestones: { ...impact, refs: [{ ref: 'milestone:1', version: 1 }] },
        risks: impact,
        capacity: impact,
        approvals: impact,
        handoff: impact,
      },
      reversibility: 'REVERSIBLE' as const,
      ownerId: 'owner',
      authorityId: 'authority',
    };
  const action = (id: string, actor: string, v: number, key: string, payload: any) =>
    transitionMaterialChange(uow, env(id, actor, v, key, payload));
  it('keeps returned truth immutable, then independently approves and atomically rebaselines exact version', async () => {
    await createMaterialChange(uow, env('change-return', 'owner', 0, 'draft-return', draft, true));
    await action('change-return', 'owner', 1, 'request-return', { action: 'REQUEST' });
    await action('change-return', 'authority', 2, 'return', {
      action: 'DECIDE',
      outcome: 'RETURN',
      conditions: [],
      rationale: 'Rework impact',
    });
    let target = await pool.query(
      `SELECT version,payload_json FROM ie_aggregate_state WHERE organization_id=$1 AND aggregate_type='plan_scenario' AND aggregate_id=$2`,
      [org, planId]
    );
    expect(target.rows[0]).toMatchObject({ version: 1, payload_json: oldSnapshot });
    await createMaterialChange(
      uow,
      env('change-approve', 'owner', 0, 'draft-approve', draft, true)
    );
    await action('change-approve', 'owner', 1, 'request-approve', { action: 'REQUEST' });
    await action('change-approve', 'authority', 2, 'approve', {
      action: 'DECIDE',
      outcome: 'APPROVE',
      conditions: [],
      rationale: 'Full blast radius accepted',
    });
    const published = await action('change-approve', 'owner', 3, 'publish', { action: 'PUBLISH' }),
      replay = await action('change-approve', 'owner', 3, 'publish', { action: 'PUBLISH' });
    expect(replay.status).toBe('REPLAYED');
    expect((published.response as any).publishedTargetVersion).toBe(2);
    target = await pool.query(
      `SELECT version,payload_json FROM ie_aggregate_state WHERE organization_id=$1 AND aggregate_type='plan_scenario' AND aggregate_id=$2`,
      [org, planId]
    );
    expect(target.rows[0].version).toBe(2);
    expect(target.rows[0].payload_json).toMatchObject({
      targetDate: '2026-10-01',
      rebaseline: { materialChangeId: 'change-approve', oldVersion: 1, approvedBy: 'authority' },
    });
    expect(await reader.listMaterialChanges(org)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ proposalId: 'change-return', status: 'RETURNED', oldSnapshot }),
        expect.objectContaining({ proposalId: 'change-approve', status: 'PUBLISHED', oldSnapshot }),
      ])
    );
    expect(await reader.listMaterialChanges('foreign')).toEqual([]);
    await expect(
      createMaterialChange(uow, env('stale', 'owner', 0, 'stale', draft, true))
    ).rejects.toThrow('Stale baseline');
  });
});
