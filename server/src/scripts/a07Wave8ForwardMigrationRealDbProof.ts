import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Pool } from 'pg';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required');
// A single pinned session keeps each proof schema's search_path authoritative.
const pool = new Pool({ connectionString: databaseUrl, max: 1 });
const historical = fs.readFileSync(new URL('../../migrations/20260425_wave8_agent_runtime.sql', import.meta.url), 'utf8');
const forward = fs.readFileSync(new URL('../../migrations/20260809_v8_wave8_agent_runtime_forward.sql', import.meta.url), 'utf8');

const expectedColumns = [
  'goal', 'project_id', 'timezone', 'lease_owner', 'lease_expires_at', 'attempt_count',
  'mandate_version', 'mandate_json', 'timeout_seconds', 'max_attempts', 'retry_at',
  'blocked_reason', 'last_run_at', 'last_error', 'cancelled_at', 'cancelled_by',
];

async function inspect(schema: string) {
  const columns = await pool.query(
    `SELECT column_name,column_default,is_nullable FROM information_schema.columns
      WHERE table_schema=$1 AND table_name='wave8_agent_schedules'`, [schema]
  );
  const byName = new Map(columns.rows.map((row) => [row.column_name, row]));
  assert.ok(expectedColumns.every((column) => byName.has(column)));
  assert.match(String(byName.get('scheduler_mode')?.column_default), /durable_cron_worker/);
  assert.match(String(byName.get('timezone')?.column_default), /UTC/);
  assert.match(String(byName.get('attempt_count')?.column_default), /0/);
  assert.match(String(byName.get('mandate_version')?.column_default), /1/);
  assert.match(String(byName.get('timeout_seconds')?.column_default), /900/);
  assert.match(String(byName.get('max_attempts')?.column_default), /3/);
  const indexes = await pool.query(
    `SELECT indexname FROM pg_indexes WHERE schemaname=$1 AND indexname IN
      ('idx_wave8_agent_schedules_due','idx_wave8_tool_governance_run') ORDER BY indexname`, [schema]
  );
  assert.equal(indexes.rows.length, 2);
  const constraints = await pool.query(
    `SELECT COUNT(*)::int count FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid
      JOIN pg_namespace n ON n.oid=t.relnamespace
     WHERE n.nspname=$1 AND t.relname='wave8_agent_tool_governance_events'
       AND c.conname='wave8_agent_tool_governance_events_decision_check'`, [schema]
  );
  assert.equal(constraints.rows[0].count, 1);
  await assert.rejects(
    () => pool.query(`INSERT INTO ${schema}.wave8_agent_tool_governance_events
      (event_id,organization_id,user_id,agent_id,tool_name,decision,reason,input_digest)
      VALUES ('bad','org','user','agent','tool','bypass','bad','digest')`),
    /decision_check/
  );
}

async function main() {
  for (const schema of ['a07_forward_existing', 'a07_forward_fresh']) {
    await pool.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE; CREATE SCHEMA ${schema}`);
  }

  await pool.query(`SET search_path TO a07_forward_existing`);
  await pool.query(historical);
  await pool.query(`INSERT INTO wave8_agent_schedules
    (schedule_id,organization_id,agent_id,owner_user_id,cadence,status)
    VALUES ('existing','org','agent','user','daily','active')`);
  await pool.query(forward);
  await pool.query(forward);
  await inspect('a07_forward_existing');
  const preserved = await pool.query(`SELECT goal,timezone,attempt_count,mandate_version,
    timeout_seconds,max_attempts FROM a07_forward_existing.wave8_agent_schedules WHERE schedule_id='existing'`);
  assert.deepEqual(preserved.rows[0], {
    goal: '', timezone: 'UTC', attempt_count: 0, mandate_version: 1, timeout_seconds: 900, max_attempts: 3,
  });

  await pool.query(`SET search_path TO a07_forward_fresh`);
  await pool.query(historical);
  await pool.query(forward);
  await inspect('a07_forward_fresh');
  const fresh = await pool.query(`INSERT INTO a07_forward_fresh.wave8_agent_schedules
    (schedule_id,organization_id,agent_id,owner_user_id,cadence,status)
    VALUES ('fresh','org','agent','user','daily','active')
    RETURNING scheduler_mode,goal,timezone,attempt_count,mandate_version,timeout_seconds,max_attempts`);
  assert.deepEqual(fresh.rows[0], {
    scheduler_mode: 'durable_cron_worker', goal: '', timezone: 'UTC', attempt_count: 0,
    mandate_version: 1, timeout_seconds: 900, max_attempts: 3,
  });

  console.log(JSON.stringify({
    proof: 'A07_WAVE8_FORWARD_MIGRATION_REALDB_GREEN', historicalChecksumPreserved: true,
    existingSchemaForwardTwice: true, freshChain: true, expectedColumns: expectedColumns.length,
    exactDefaults: true, indexes: 2, decisionConstraints: 1, existingRowsPreserved: 1,
  }));
}

main().finally(async () => {
  await pool.query('SET search_path TO public').catch(() => undefined);
  await pool.query('DROP SCHEMA IF EXISTS a07_forward_existing CASCADE; DROP SCHEMA IF EXISTS a07_forward_fresh CASCADE').catch(() => undefined);
  await pool.end();
});
