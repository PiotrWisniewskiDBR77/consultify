/**
 * CW-PERF — entry point for ONE profile run. Spawned as its own child
 * process by orchestrate.ts (never imported into the orchestrator's own
 * process), so that this process's `databaseConfig` singleton binds to
 * exactly the one fresh database named in its own env — see
 * dbLifecycle.ts's runMigrations() docblock for why that isolation matters.
 *
 * Required env (all provided by orchestrate.ts's child_process.spawn call):
 *   DB_TYPE=postgres, NODE_ENV=test, RUN_DB_TESTS=1, MOCK_DB=false, LC_ALL=C,
 *   DATABASE_URL=postgresql://... (the fresh per-run database)
 *   CW_PERF_RUN_ID, CW_PERF_OUT_FILE (required)
 *   CW_PERF_CASE_COUNT, CW_PERF_NODE_COUNT, CW_PERF_EDGE_COUNT,
 *   CW_PERF_EVENTS_PER_CASE, CW_PERF_CASE_CONCURRENCY,
 *   CW_PERF_EVENT_CONCURRENCY, CW_PERF_DISPATCH_BATCH_SIZE,
 *   CW_PERF_QUERY_REPS, CW_PERF_FAILURE_INJECTION (1/0), CW_PERF_SOAK_MS
 *   (optional overrides — all have sane defaults below)
 *
 * Run with `NODE_OPTIONS=--expose-gc` (set by the orchestrator) so the
 * post-GC heap snapshot in runProfile.ts is real, not a no-op.
 */

import fs from 'node:fs';

import { runProfile } from './lib/runProfile.js';

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

async function main(): Promise<void> {
  const runId = process.env.CW_PERF_RUN_ID;
  const outFile = process.env.CW_PERF_OUT_FILE;
  const databaseUrl = process.env.DATABASE_URL;

  if (!runId || !outFile || !databaseUrl) {
    console.error('[runProfileMain] missing required env: CW_PERF_RUN_ID, CW_PERF_OUT_FILE, DATABASE_URL');
    process.exit(2);
  }
  if (process.env.RUN_DB_TESTS !== '1' || process.env.MOCK_DB !== 'false') {
    console.error('[runProfileMain] refusing to run against a possibly-mocked DB: RUN_DB_TESTS=1 and MOCK_DB=false are both required');
    process.exit(2);
  }

  const result = await runProfile({
    runId: runId as string,
    databaseUrl: databaseUrl as string,
    caseCount: envInt('CW_PERF_CASE_COUNT', 1000),
    nodeCount: envInt('CW_PERF_NODE_COUNT', 250),
    edgeCount: envInt('CW_PERF_EDGE_COUNT', 500),
    eventsPerCase: envInt('CW_PERF_EVENTS_PER_CASE', 9),
    caseConcurrency: envInt('CW_PERF_CASE_CONCURRENCY', 15),
    eventConcurrency: envInt('CW_PERF_EVENT_CONCURRENCY', 15),
    dispatchBatchSize: envInt('CW_PERF_DISPATCH_BATCH_SIZE', 200),
    queryReps: envInt('CW_PERF_QUERY_REPS', 25),
    runFailureInjection: process.env.CW_PERF_FAILURE_INJECTION === '1',
    soakMs: envInt('CW_PERF_SOAK_MS', 0),
  });

  fs.writeFileSync(outFile as string, JSON.stringify(result, null, 2), 'utf8');
  console.log(`[runProfileMain] wrote ${outFile}`);
  process.exit(result.errors.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('[runProfileMain] FATAL', err);
  process.exit(1);
});
