import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { assertRealPostgresTestEnvironment } from './_helpers/assertRealPostgres';
import {
  parseRunnerOptions,
  runLegacyTaskCutover,
} from '../../server/scripts/legacy-task-cutover-runner';

const url = process.env.DATABASE_URL || '';
const org = 'day216-failed-org';

describe('Day216 FAILED ledger continuation', { retry: 0 }, () => {
  const pool = new Pool({ connectionString: url });
  beforeAll(async () => {
    await assertRealPostgresTestEnvironment();
    expect(process.env.DB_TYPE).toBe('postgres');
    await pool.query(
      `INSERT INTO organizations(id,name,status) VALUES($1,'Day216 failed','active')`,
      [org]
    );
    for (const id of ['owner', 'assignee', 'reporter'])
      await pool.query(
        `INSERT INTO users(id,organization_id,email,first_name,last_name,role,status) VALUES($1,$2,$3,'D','216','USER','active')`,
        [`${org}-${id}`, org, `${id}@failed.invalid`]
      );
    await pool.query(
      `INSERT INTO projects(id,organization_id,name,status,owner_id) VALUES($1,$2,'P','active',$3)`,
      [`${org}-project`, org, `${org}-owner`]
    );
    for (const initiative of ['a-missing', 'b-good'])
      await pool.query(
        `INSERT INTO initiatives(id,organization_id,project_id,name,status,owner_business_id,owner_execution_id) VALUES($1,$2,$3,$1,'DRAFT',$4,$4)`,
        [initiative, org, `${org}-project`, `${org}-owner`]
      );
    await pool.query(
      `INSERT INTO ie_aggregate_state(organization_id,aggregate_type,aggregate_id,version,payload_json) VALUES($1,'execution_case','case-good',1,$2::jsonb)`,
      [
        org,
        JSON.stringify({ executionCaseId: 'case-good', initiativeId: 'b-good', state: 'ACTIVE' }),
      ]
    );
    for (const [id, initiative] of [
      ['a-bad-task', 'a-missing'],
      ['b-good-task', 'b-good'],
    ])
      await pool.query(
        `INSERT INTO tasks(id,project_id,organization_id,title,status,assignee_id,reporter_id,owner_id,created_by,due_date,sla_due_at,initiative_id)
       VALUES($1,$2,$3,$1,'todo',$4,$5,$6,$5,'2026-09-10Z','2026-09-12Z',$7)`,
        [
          id,
          `${org}-project`,
          org,
          `${org}-assignee`,
          `${org}-reporter`,
          `${org}-owner`,
          initiative,
        ]
      );
  });
  afterAll(async () => {
    for (const table of [
      'legacy_task_cutover_ledger',
      'tasks',
      'ie_aggregate_relations',
      'ie_command_receipts',
      'ie_audit_events',
      'ie_outbox_events',
      'ie_aggregate_state',
      'initiatives',
      'projects',
      'users',
    ])
      await pool.query(`DELETE FROM ${table} WHERE organization_id=$1`, [org]);
    await pool.query('DELETE FROM organizations WHERE id=$1', [org]);
    await pool.end();
  });
  it('records one stable FAILED reason and continues to migrate the next task', async () => {
    const result = await runLegacyTaskCutover(pool, {
      ...parseRunnerOptions([
        `--organization-id=${org}`,
        '--confirm-batch',
        '--batch-size=2',
        '--max-tasks=2',
        '--write',
      ]),
      batchId: 'day216-failed-batch',
    });
    expect(result.outcomes).toEqual(['FAILED', 'MIGRATED']);
    const ledger = await pool.query(
      `SELECT legacy_task_id,status,reason_code FROM legacy_task_cutover_ledger WHERE organization_id=$1 ORDER BY legacy_task_id`,
      [org]
    );
    expect(ledger.rows).toEqual([
      { legacy_task_id: 'a-bad-task', status: 'FAILED', reason_code: 'CANONICAL_HOME_MISSING' },
      { legacy_task_id: 'b-good-task', status: 'MIGRATED', reason_code: null },
    ]);
  });
  // FIX-216-1 (blocking, pilot gate): before this fix, a FAILED row
  // permanently parked the task — the selector's NOT EXISTS excluded it
  // forever and migrateOneTask returned NOOP (the exact same outcome as
  // "already safely migrated"), so the only way out was a destructive
  // manual DELETE from the ledger. This proves the cycle end to end on a
  // live DB: fail -> FAILED row -> fix the cause (create the missing
  // execution_case) -> the SAME command actually MIGRATES the task instead
  // of going silent -> the row ends as MIGRATED, not NOOP.
  it('retries and migrates a FAILED task once its cause is fixed, instead of parking it forever', async () => {
    await pool.query(
      `INSERT INTO ie_aggregate_state(organization_id,aggregate_type,aggregate_id,version,payload_json)
       VALUES($1,'execution_case','case-a-missing',3,$2::jsonb)`,
      [
        org,
        JSON.stringify({
          executionCaseId: 'case-a-missing',
          initiativeId: 'a-missing',
          state: 'ACTIVE',
        }),
      ]
    );
    const retry = await runLegacyTaskCutover(pool, {
      ...parseRunnerOptions([
        `--organization-id=${org}`,
        '--confirm-batch',
        '--batch-size=2',
        '--max-tasks=2',
        '--write',
      ]),
      batchId: 'day216-failed-retry-batch',
    });
    // Not NOOP, not silence (outcomes=[]) — an actual migration.
    expect(retry.outcomes).toEqual(['MIGRATED']);
    const ledger = await pool.query(
      `SELECT legacy_task_id,status,reason_code,case_version_before,case_version_after
         FROM legacy_task_cutover_ledger WHERE organization_id=$1 AND legacy_task_id='a-bad-task'`,
      [org]
    );
    expect(ledger.rows).toEqual([
      {
        legacy_task_id: 'a-bad-task',
        status: 'MIGRATED',
        reason_code: null,
        case_version_before: 3,
        // FIX-216-2: the recorded "after" version is the CASE's version
        // (before + 1), not the task's own expectedVersion+1 (which would
        // always be 1 for a create).
        case_version_after: 4,
      },
    ]);
    const aggregate = await pool.query(
      `SELECT count(*)::int n FROM ie_aggregate_state
        WHERE organization_id=$1 AND aggregate_type='execution_task' AND aggregate_id='legacy-task:a-bad-task'`,
      [org]
    );
    expect(aggregate.rows[0].n).toBe(1);
  });
});
