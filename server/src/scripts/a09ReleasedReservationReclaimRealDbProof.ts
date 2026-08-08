import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Pool } from 'pg';
import { adaptQuery } from '../database/PostgresDatabase.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required');
const pool = new Pool({ connectionString: databaseUrl });
const proofDb = {
  query: (text: string, params: unknown[] = []) => pool.query(adaptQuery(text), params),
  get(text: string, params: unknown[], cb: (error: Error | null, row: unknown) => void) { void pool.query(adaptQuery(text), params).then((r) => cb(null, r.rows[0] ?? null), cb); },
  all(text: string, params: unknown[], cb: (error: Error | null, rows: unknown[]) => void) { void pool.query(adaptQuery(text), params).then((r) => cb(null, r.rows), cb); },
  run(text: string, params: unknown[], cb: (error: Error | null) => void) { void pool.query(adaptQuery(text), params).then((r) => cb.call({ changes: r.rowCount ?? 0 }, null), (e) => cb.call({ changes: 0 }, e)); },
  serialize(cb: () => void) { cb(); },
};
(globalThis as any).__CONSULTIFY_GLOBAL_DB_INSTANCE__ = proofDb;
(process as any).__CONSULTIFY_GLOBAL_DB_INSTANCE__ = proofDb;

async function main() {
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await pool.query(adaptQuery(fs.readFileSync(new URL('../../migrations/20260808_v8_agent_resource_governance.sql', import.meta.url), 'utf8')));
  await pool.query(`CREATE TABLE v8_agent_adapter_invocations (invocation_id TEXT PRIMARY KEY, canonical_run_id TEXT NOT NULL, organization_id TEXT NOT NULL, adapter_key TEXT NOT NULL, idempotency_key TEXT NOT NULL, input_digest TEXT NOT NULL, status TEXT NOT NULL);`);
  await pool.query(`INSERT INTO v8_agent_resource_policies(policy_id,organization_id,project_id,max_concurrent_executions,max_estimated_cost_usd_per_run,lease_seconds) VALUES ('policy','org','project',1,1,300)`);
  await pool.query(`INSERT INTO v8_agent_adapter_invocations VALUES ('invocation','run','org','interviews','materialize','digest','failed')`);
  await pool.query(`INSERT INTO v8_agent_resource_reservations(reservation_id,organization_id,project_id,run_id,user_id,agent_id,tool_name,idempotency_key,policy_id,status,decision_reason,estimated_cost_usd) VALUES ('reservation','org','project','run','user','agent','tool','a06:run:interviews:materialize','policy','released','resource_released_after_execution_failure',0.6)`);
  const { reserveAgentResource } = await import('../services/v8/agentResourceGovernanceService.js');
  const retry = () => reserveAgentResource({ organizationId: 'org', projectId: 'project', runId: 'run', userId: 'user', agentId: 'agent', toolName: 'tool', idempotencyKey: 'a06:run:interviews:materialize', estimatedCostUsd: 0.6, releasedRetry: { adapterKey: 'interviews', invocationIdempotencyKey: 'materialize', inputDigest: 'digest' } });
  const concurrent = await Promise.all([retry(), retry()]);
  assert.equal(concurrent.filter((item) => !item.idempotentReplay && item.status === 'reserved').length, 1);
  assert.equal(concurrent.filter((item) => item.idempotentReplay && item.status === 'reserved').length, 1);
  const readback = (await pool.query(`SELECT COUNT(*)::int rows, SUM(estimated_cost_usd)::float cost, MIN(status) status FROM v8_agent_resource_reservations`)).rows[0];
  assert.deepEqual(readback, { rows: 1, cost: 0.6, status: 'reserved' });
  await pool.query(`UPDATE v8_agent_resource_reservations SET status='released' WHERE reservation_id='reservation'`);
  await assert.rejects(() => reserveAgentResource({ organizationId: 'org', projectId: 'project', runId: 'run', userId: 'user', agentId: 'agent', toolName: 'tool', idempotencyKey: 'a06:run:interviews:materialize', estimatedCostUsd: 0.6, releasedRetry: { adapterKey: 'interviews', invocationIdempotencyKey: 'materialize', inputDigest: 'different' } }), /resource_reclaim_payload_conflict/);
  await pool.query(`UPDATE v8_agent_resource_reservations SET status='settled' WHERE reservation_id='reservation'`);
  const settled = await retry();
  assert.equal(settled.status, 'settled');
  assert.equal(settled.idempotentReplay, true);
  console.log(JSON.stringify({ proof: 'A09_RELEASED_RECLAIM_REALDB_GREEN', concurrentRetryExactlyOne: true, oneReservationRow: true, estimatedCostChargedOnce: 0.6, differentPayloadBlocked: true, settledNotReclaimed: true }));
}

main().finally(() => pool.end());
