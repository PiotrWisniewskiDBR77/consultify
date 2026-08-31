import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from './_helpers/assertRealPostgres';
import {
  migrateOneTask,
  parseRunnerOptions,
  runLegacyTaskCutover,
  selectCandidateTasks,
  type RunnerOptions,
} from '../../server/scripts/legacy-task-cutover-runner';
import { PostgresMaterialCommandUnitOfWork } from '../../server/src/domain/initiatives-execution/postgresMaterialCommandUnitOfWork';

// FIX-204-3 (ODBIOR_204 gate): before this file, idempotency worked in code
// (PK (organization_id, legacy_task_id) + checksum, "Guard B") but had ZERO
// test coverage — deleting BOTH guards at once left 11/11 tests green. This
// file proves each guard is independently load-bearing:
//
//   - selectCandidateTasks's `NOT EXISTS` clause on the final tasks query
//     ("Guard A") is what stops an already-migrated task from starving a
//     pending one under `--max-tasks`. Delete it and
//     "two full runs progress to the second task" goes RED.
//   - migrateOneTask's `existing.rows[0]` checksum check ("Guard B") is what
//     stops a re-selected task from crashing on
//     `createExecutionTask`'s `expectedVersion: 0` against an
//     already-version-1 aggregate. Delete it and
//     "migrateOneTask is a safe no-op on replay" goes RED
//     (`aggregate version conflict`, uncaught).
//
// Mutation-gate evidence for both removals is recorded in the FIX-204
// handoff report, not here — this file is what makes the removal observable.

const databaseUrl = process.env.DATABASE_URL || '';
const organizationId = 'day204-idem-org';
const projectId = 'day204-idem-project';
const users = ['day204-idem-owner', 'day204-idem-assignee', 'day204-idem-reporter'];
const soloInitiativeId = 'day204-idem-initiative-solo';
const pairInitiativeId = 'day204-idem-initiative-pair';
const guardBInitiativeId = 'day204-idem-initiative-guardb';
const soloTaskId = 'day204-idem-task-solo';
const taskAId = 'day204-idem-task-a';
const taskBId = 'day204-idem-task-b';
const guardBTaskId = 'day204-idem-task-guardb';

function baseOptions(overrides: Partial<RunnerOptions> = {}): RunnerOptions {
  return {
    ...parseRunnerOptions([`--organization-id=${organizationId}`, '--write']),
    batchId: 'day204-idem-batch',
    actorId: 'day204-idem-actor',
    ...overrides,
  };
}

describe('Day204 legacy task cutover idempotency (realDB, mutation-gated)', { retry: 0 }, () => {
  const pool = new Pool({ connectionString: databaseUrl, max: 3 });
  const uow = new PostgresMaterialCommandUnitOfWork(pool);

  async function resetFixture() {
    await pool.query('DELETE FROM legacy_task_cutover_ledger WHERE organization_id=$1', [
      organizationId,
    ]);
    await pool.query('DELETE FROM tasks WHERE organization_id=$1', [organizationId]);
    for (const table of [
      'ie_aggregate_relations',
      'ie_command_receipts',
      'ie_audit_events',
      'ie_outbox_events',
      'ie_aggregate_state',
    ]) {
      await pool.query(`DELETE FROM ${table} WHERE organization_id=$1`, [organizationId]);
    }
    await pool.query('DELETE FROM initiatives WHERE organization_id=$1', [organizationId]);
    await pool.query('DELETE FROM projects WHERE organization_id=$1', [organizationId]);
    await pool.query('DELETE FROM users WHERE organization_id=$1', [organizationId]);
    await pool.query('DELETE FROM organizations WHERE id=$1', [organizationId]);
  }

  beforeAll(async () => {
    await assertRealPostgresTestEnvironment();
    expect(process.env.DB_TYPE).toBe('postgres');
    await resetFixture();

    await pool.query(`INSERT INTO organizations(id,name,status) VALUES($1,'Day204 idempotency fixture','active')`, [
      organizationId,
    ]);
    for (const userId of users) {
      await pool.query(
        `INSERT INTO users(id,organization_id,email,first_name,last_name,role,status)
         VALUES($1,$2,$3,'Day204','Fixture','USER','active')`,
        [userId, organizationId, `${userId}@example.invalid`]
      );
    }
    await pool.query(
      `INSERT INTO projects(id,organization_id,name,status,owner_id)
       VALUES($1,$2,'Day204 idempotency project','active',$3)`,
      [projectId, organizationId, users[0]]
    );
    for (const initiativeId of [soloInitiativeId, pairInitiativeId, guardBInitiativeId]) {
      await pool.query(
        `INSERT INTO initiatives(id,organization_id,project_id,name,status,owner_business_id,owner_execution_id)
         VALUES($1,$2,$3,$4,'DRAFT',$5,$5)`,
        [initiativeId, organizationId, projectId, `Legacy ${initiativeId}`, users[0]]
      );
      // execution_case ACTIVE for this initiative — the canonical home
      // createExecutionTask looks up (see legacy-task-cutover-runner.ts
      // migrateOneTask). Mirrors the shape used across the
      // initiatives-execution realDB suite (e.g. executionWork.realdb.test.ts).
      await pool.query(
        `INSERT INTO ie_aggregate_state(organization_id,aggregate_type,aggregate_id,version,payload_json)
         VALUES($1,'execution_case',$2,1,$3::jsonb)`,
        [
          organizationId,
          `case-${initiativeId}`,
          JSON.stringify({
            executionCaseId: `case-${initiativeId}`,
            initiativeId,
            state: 'ACTIVE',
          }),
        ]
      );
    }
    const taskRows: Array<[string, string]> = [
      [soloTaskId, soloInitiativeId],
      [taskAId, pairInitiativeId],
      [taskBId, pairInitiativeId],
      [guardBTaskId, guardBInitiativeId],
    ];
    for (const [taskId, initiativeId] of taskRows) {
      await pool.query(
        `INSERT INTO tasks
         (id,project_id,organization_id,title,status,assignee_id,reporter_id,owner_id,
          created_by,due_date,sla_due_at,initiative_id)
         VALUES($1,$2,$3,$4,'todo',$5,$6,$5,$6,'2026-09-10T12:00:00Z','2026-09-12T12:00:00Z',$7)`,
        [taskId, projectId, organizationId, `Legacy ${taskId}`, users[1], users[2], initiativeId]
      );
    }
  });

  afterAll(async () => {
    await resetFixture();
    await pool.end();
  });

  it('end-to-end: two full runLegacyTaskCutover writes on the same single-task pilot produce exactly one canonical row and one ledger row', async () => {
    const options = baseOptions({ initiativeId: soloInitiativeId, batchId: 'day204-idem-solo' });

    const run1 = await runLegacyTaskCutover(pool, options);
    expect(run1.outcomes).toEqual(['MIGRATED']);

    // Same command, same target, run again — this is the literal D-13
    // pilot-replay scenario ("dwa przebiegi na tym samym rekordzie").
    const run2 = await runLegacyTaskCutover(pool, options);
    expect(run2.outcomes).toEqual([]); // task already ledgered — selector excludes it, nothing to do

    const ledger = await pool.query(
      `SELECT status FROM legacy_task_cutover_ledger WHERE organization_id=$1 AND legacy_task_id=$2`,
      [organizationId, soloTaskId]
    );
    expect(ledger.rowCount).toBe(1);
    expect(ledger.rows[0].status).toBe('MIGRATED');

    const aggregate = await pool.query(
      `SELECT count(*)::int AS n FROM ie_aggregate_state
        WHERE organization_id=$1 AND aggregate_type='execution_task' AND aggregate_id=$2`,
      [organizationId, `legacy-task:${soloTaskId}`]
    );
    expect(aggregate.rows[0].n).toBe(1);
  });

  it('FIX-204-3 Guard A (selector NOT EXISTS): two runs with --max-tasks=1 make forward progress instead of starving the pending task', async () => {
    const options = baseOptions({ maxTasks: 1, batchId: 'day204-idem-pair' });

    const run1 = await runLegacyTaskCutover(pool, options);
    expect(run1.plan.map((p) => p.task.id)).toEqual([taskAId]);
    expect(run1.outcomes).toEqual(['MIGRATED']);

    // Re-run the SAME command. If the selector still counted task-a (already
    // ledgered) toward the --max-tasks=1 budget, it would win the ORDER BY
    // slot again and task-b would never be picked — this is exactly the
    // starvation bug this guard prevents.
    const run2 = await runLegacyTaskCutover(pool, options);
    expect(run2.plan.map((p) => p.task.id)).toEqual([taskBId]);
    expect(run2.outcomes).toEqual(['MIGRATED']);

    const ledger = await pool.query(
      `SELECT legacy_task_id, status FROM legacy_task_cutover_ledger
        WHERE organization_id=$1 AND legacy_task_id = ANY($2::text[])
        ORDER BY legacy_task_id`,
      [organizationId, [taskAId, taskBId]]
    );
    expect(ledger.rows).toEqual([
      { legacy_task_id: taskAId, status: 'MIGRATED' },
      { legacy_task_id: taskBId, status: 'MIGRATED' },
    ]);

    // Confirms selectCandidateTasks itself now returns nothing further.
    const { plan: exhausted } = await selectCandidateTasks(pool, options);
    expect(exhausted).toEqual([]);
  });

  it('FIX-204-3 Guard B (checksum continue): migrateOneTask called twice on the identical task is a safe no-op, not a version-conflict crash', async () => {
    const options = baseOptions({ initiativeId: guardBInitiativeId, batchId: 'day204-idem-guardb' });
    const { plan } = await selectCandidateTasks(pool, options);
    expect(plan).toHaveLength(1);
    const { task, mapping } = plan[0];
    expect(task.id).toBe(guardBTaskId);

    const first = await migrateOneTask(pool, uow, task, mapping, options);
    expect(first).toBe('MIGRATED');

    // Call it again directly, BYPASSING the SQL selector entirely — this is
    // what isolates Guard B: without it, this second call would attempt
    // createExecutionTask with expectedVersion:0 against an aggregate that
    // is already at version 1, throwing "aggregate version conflict".
    const second = await migrateOneTask(pool, uow, task, mapping, options);
    expect(second).toBe('NOOP');

    const ledger = await pool.query(
      `SELECT count(*)::int AS n FROM legacy_task_cutover_ledger WHERE organization_id=$1 AND legacy_task_id=$2`,
      [organizationId, guardBTaskId]
    );
    expect(ledger.rows[0].n).toBe(1);

    const aggregate = await pool.query(
      `SELECT count(*)::int AS n FROM ie_aggregate_state
        WHERE organization_id=$1 AND aggregate_type='execution_task' AND aggregate_id=$2`,
      [organizationId, `legacy-task:${guardBTaskId}`]
    );
    expect(aggregate.rows[0].n).toBe(1);
  });
});
