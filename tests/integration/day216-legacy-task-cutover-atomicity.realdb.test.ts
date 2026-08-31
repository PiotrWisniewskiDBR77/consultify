import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from './_helpers/assertRealPostgres';
import {
  parseRunnerOptions,
  runLegacyTaskCutover,
} from '../../server/scripts/legacy-task-cutover-runner';

const url = process.env.DATABASE_URL || '';
const org = 'day216-atomic-org';
const initiative = 'day216-atomic-initiative';
const task = 'day216-atomic-task';

describe('Day216 atomic legacy task cutover', { retry: 0 }, () => {
  const pool = new Pool({ connectionString: url });
  beforeAll(async () => {
    await assertRealPostgresTestEnvironment();
    expect(process.env.DB_TYPE).toBe('postgres');
    await pool.query(`INSERT INTO organizations(id,name,status) VALUES($1,'Day216','active')`, [
      org,
    ]);
    for (const id of ['owner', 'assignee', 'reporter'])
      await pool.query(
        `INSERT INTO users(id,organization_id,email,first_name,last_name,role,status)
         VALUES($1,$2,$3,'D','216','USER','active')`,
        [`${org}-${id}`, org, `${id}@day216.invalid`]
      );
    await pool.query(
      `INSERT INTO projects(id,organization_id,name,status,owner_id) VALUES($1,$2,'P','active',$3)`,
      [`${org}-project`, org, `${org}-owner`]
    );
    await pool.query(
      `INSERT INTO initiatives(id,organization_id,project_id,name,status,owner_business_id,owner_execution_id)
       VALUES($1,$2,$3,'I','DRAFT',$4,$4)`,
      [initiative, org, `${org}-project`, `${org}-owner`]
    );
    await pool.query(
      `INSERT INTO ie_aggregate_state(organization_id,aggregate_type,aggregate_id,version,payload_json)
       VALUES($1,'execution_case',$2,1,$3::jsonb)`,
      [
        org,
        `${org}-case`,
        JSON.stringify({
          executionCaseId: `${org}-case`,
          initiativeId: initiative,
          state: 'ACTIVE',
        }),
      ]
    );
    await pool.query(
      `INSERT INTO tasks(id,project_id,organization_id,title,status,assignee_id,reporter_id,owner_id,created_by,due_date,sla_due_at,initiative_id)
       VALUES($1,$2,$3,'T','todo',$4,$5,$6,$5,'2026-09-10Z','2026-09-12Z',$7)`,
      [
        task,
        `${org}-project`,
        org,
        `${org}-assignee`,
        `${org}-reporter`,
        `${org}-owner`,
        initiative,
      ]
    );
    await pool.query(
      `INSERT INTO legacy_task_cutover_ledger
       (organization_id,legacy_task_id,batch_id,status,client_request_id,actor_id,checksum)
       VALUES($1,'collision','old','FAILED',$2,'actor','checksum')`,
      [org, `tasks-canonical-v1:${org}:${task}`]
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
  it('rolls back all canonical writes when the ledger insert fails inside the transaction', async () => {
    const before = await pool.query(
      `SELECT version,payload_json FROM ie_aggregate_state WHERE organization_id=$1 AND aggregate_type='execution_case'`,
      [org]
    );
    const result = await runLegacyTaskCutover(pool, {
      ...parseRunnerOptions([`--organization-id=${org}`, '--write']),
      initiativeId: initiative,
      batchId: 'day216-atomic-batch',
    });
    expect(result.outcomes).toEqual(['FAILED']);
    const after = await pool.query(
      `SELECT version,payload_json FROM ie_aggregate_state WHERE organization_id=$1 AND aggregate_type='execution_case'`,
      [org]
    );
    expect(after.rows).toEqual(before.rows);
    for (const table of [
      'ie_aggregate_relations',
      'ie_command_receipts',
      'ie_audit_events',
      'ie_outbox_events',
    ]) {
      const count = await pool.query(
        `SELECT count(*)::int n FROM ${table} WHERE organization_id=$1`,
        [org]
      );
      expect(count.rows[0].n).toBe(0);
    }
    const aggregate = await pool.query(
      `SELECT count(*)::int n FROM ie_aggregate_state WHERE organization_id=$1 AND aggregate_type='execution_task'`,
      [org]
    );
    expect(aggregate.rows[0].n).toBe(0);
  });
});
