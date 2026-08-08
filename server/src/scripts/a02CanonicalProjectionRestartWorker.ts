import assert from 'node:assert/strict';

import { Pool } from 'pg';
import { adaptQuery } from '../database/PostgresDatabase.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required');
const pool = new Pool({ connectionString: databaseUrl });
const proofDb = {
  query: (text: string, params: unknown[] = []) => pool.query(adaptQuery(text), params),
  get(
    text: string,
    params: unknown[] = [],
    callback?: (error: Error | null, row: unknown) => void
  ) {
    const promise = pool.query(adaptQuery(text), params).then((result) => result.rows[0] ?? null);
    if (callback)
      void promise.then(
        (row) => callback(null, row),
        (error) => callback(error as Error, null)
      );
    return callback ? proofDb : promise;
  },
  all(
    text: string,
    params: unknown[] = [],
    callback?: (error: Error | null, rows: unknown[]) => void
  ) {
    const promise = pool.query(adaptQuery(text), params).then((result) => result.rows);
    if (callback)
      void promise.then(
        (rows) => callback(null, rows),
        (error) => callback(error as Error, [])
      );
    return callback ? proofDb : promise;
  },
  run(text: string, params: unknown[] = [], callback?: (error: Error | null) => void) {
    const promise = pool
      .query(adaptQuery(text), params)
      .then((result) => ({ changes: result.rowCount ?? 0 }));
    if (callback)
      void promise.then(
        (result) => callback.call({ changes: result.changes }, null),
        (error) => callback.call({ changes: 0 }, error as Error)
      );
    return callback ? proofDb : promise;
  },
  exec: (text: string) => pool.query(text).then(() => undefined),
  serialize(callback: () => void) {
    callback();
  },
  close: () => Promise.resolve(),
};
(globalThis as Record<string, unknown>).__CONSULTIFY_GLOBAL_DB_INSTANCE__ = proofDb;
(process as unknown as Record<string, unknown>).__CONSULTIFY_GLOBAL_DB_INSTANCE__ = proofDb;

async function main(): Promise<void> {
  const service = await import('../services/v8/agentCanonicalRunService.js');
  const aliases = [
    { aliasType: 'wave8_run' as const, externalId: 'agent8-restart-proof' },
    { aliasType: 'agent_plan' as const, externalId: process.env.A02_AGENT_PLAN_ID || '' },
    { aliasType: 'work_graph' as const, externalId: process.env.A02_WORK_GRAPH_ID || '' },
  ];
  for (const alias of aliases) {
    const retry = await service.projectCanonicalRunAfterExternalTransition({
      canonicalRunId: '00000000-0000-4000-8000-000000000102',
      organizationId: 'org-a02',
      ...alias,
      actorUserId: 'restart-worker-a02',
      reason: 'Independent process restart replay.',
    });
    assert.equal(retry.stateDrift, false);
  }
  const counts = await pool.query(
    `
    SELECT
      (SELECT COUNT(*)::int FROM v8_agent_run_aliases
        WHERE external_id IN ('agent8-restart-proof', $1, $2)) AS aliases,
      (SELECT COUNT(*)::int FROM v8_agent_run_reconciliation_events WHERE reason = 'Independent process restart replay.') AS reconciliations
  `,
    [process.env.A02_AGENT_PLAN_ID, process.env.A02_WORK_GRAPH_ID]
  );
  assert.equal(counts.rows[0].aliases, 3);
  assert.equal(counts.rows[0].reconciliations, 0);
  console.log(JSON.stringify({ restartReplay: true, aliasCount: 3, duplicateTransitions: 0 }));
}

main().finally(() => pool.end());
