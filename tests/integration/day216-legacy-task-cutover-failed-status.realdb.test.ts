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
});
