/**
 * CW-PERF — top-level orchestrator for the frozen performance profile
 * (document 14 DoD-I: 1,000 Cases / Plan 250 nodes-500 edges / 10,000
 * events / p95 + heap / three deterministic fresh runs / failure injection).
 *
 * For EACH of three runs:
 *   1. CREATE a fresh `cwperfprofile_<runId>` database (never
 *      `case_workspace_test` — that DB is shared with five other
 *      concurrently running agents per this task's own warning);
 *   2. migrate it with `server/scripts/migrate.postgres.ts` (no --safe —
 *      a migration failure must fail this run loudly);
 *   3. spawn `runProfileMain.ts` as its OWN child process against that
 *      database (own process = own databaseConfig binding, see that file's
 *      header);
 *   4. read back its JSON result;
 *   5. DROP the database — always, even on failure (try/finally).
 *
 * Then writes one combined `perf-summary.json` (three raw runs + a
 * determinism comparison) to the path in `CW_PERF_SUMMARY_OUT`
 * (default: alongside this file, `perf-summary.json` — gitignored by
 * convention, this is a run artifact, not source).
 *
 * Usage (repo root):
 *   DB_TYPE=postgres LC_ALL=C NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *   CW_PERF_ADMIN_DATABASE_URL="postgresql://case_workspace:case_workspace@127.0.0.1:55432/case_workspace_test" \
 *   npx tsx server/src/services/caseWorkspace/__tests__/performance/orchestrate.ts
 */

import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createFreshDatabase, dropDatabase, runMigrations, verifySchemaPresent, withDatabase } from './lib/dbLifecycle.js';
import { percentile, round2 } from './lib/stats.js';
import type { ProfileResult } from './lib/runProfile.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../../../../../');

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

interface RunSpawnResult {
  ok: boolean;
  exitCode: number | null;
  stdout: string;
  stderr: string;
}

function runChildProfile(
  databaseUrl: string,
  runId: string,
  outFile: string,
  extraEnv: Record<string, string>
): Promise<RunSpawnResult> {
  return new Promise((resolve) => {
    const child = spawn(
      path.join(REPO_ROOT, 'node_modules', '.bin', 'tsx'),
      [path.join(__dirname, 'runProfileMain.ts')],
      {
        cwd: REPO_ROOT,
        env: {
          ...process.env,
          DB_TYPE: 'postgres',
          NODE_ENV: 'test',
          RUN_DB_TESTS: '1',
          MOCK_DB: 'false',
          LC_ALL: 'C',
          DATABASE_URL: databaseUrl,
          CW_PERF_RUN_ID: runId,
          CW_PERF_OUT_FILE: outFile,
          NODE_OPTIONS: '--expose-gc',
          ...extraEnv,
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    );
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d.toString()));
    child.stderr.on('data', (d) => (stderr += d.toString()));
    child.on('close', (code) => resolve({ ok: code === 0, exitCode: code, stdout, stderr }));
  });
}

async function runOneProfile(
  adminDatabaseUrl: string,
  runIndex: number,
  outDir: string,
  extraEnv: Record<string, string>
): Promise<{ runId: string; dbName: string; ok: boolean; resultPath: string; migration: unknown; spawnLog: RunSpawnResult; schemaCheck: unknown }> {
  const runId = `r${runIndex}_${Date.now()}_${randomUUID().slice(0, 8)}`;
  const dbName = `cwperfprofile_${runId}`;
  const dbUrl = withDatabase(adminDatabaseUrl, dbName);
  const resultPath = path.join(outDir, `perf-run-${runId}.json`);

  console.log(`[orchestrate] run ${runIndex}: creating ${dbName}`);
  await createFreshDatabase(adminDatabaseUrl, dbName);

  try {
    const migration = await runMigrations(REPO_ROOT, dbUrl);
    if (!migration.ok) {
      throw new Error(`migration failed (exit ${migration.exitCode}):\n${migration.stderr.slice(-4000)}`);
    }
    const schemaCheck = await verifySchemaPresent(dbUrl);
    if (!schemaCheck.ok) {
      throw new Error(`post-migration schema check failed, missing tables: ${schemaCheck.missing.join(', ')}`);
    }

    console.log(`[orchestrate] run ${runIndex}: migrated + schema verified, spawning profile workload`);
    const spawnLog = await runChildProfile(dbUrl, runId, resultPath, extraEnv);
    if (!spawnLog.ok) {
      console.error(`[orchestrate] run ${runIndex} profile process exited ${spawnLog.exitCode}\nSTDERR:\n${spawnLog.stderr.slice(-4000)}`);
    }
    return { runId, dbName, ok: spawnLog.ok, resultPath, migration, spawnLog, schemaCheck };
  } finally {
    console.log(`[orchestrate] run ${runIndex}: dropping ${dbName}`);
    await dropDatabase(adminDatabaseUrl, dbName);
  }
}

function compareDeterminism(runs: ProfileResult[]): Record<string, unknown> {
  const listP95 = runs.map((r) => r.queryLatency.listCasesForOrganization.p95Ms);
  const graphP95 = runs.map((r) => r.queryLatency.getPlanVersionGraph.p95Ms);
  const historyP95 = runs.map((r) => r.queryLatency.listCaseHistoryEventsForCase.p95Ms);
  const dispatchP95 = runs.map((r) => r.dispatch.batchLatency.p95Ms);
  const heapGrowth = runs.map((r) => r.heap.growthPctBaselineToPostGc);
  const outboxTotals = runs.map((r) => r.counts.outboxRowsTotalAfterSeed);

  function spread(values: number[]): { min: number; max: number; spreadPct: number } {
    const min = Math.min(...values);
    const max = Math.max(...values);
    const spreadPct = min > 0 ? round2(((max - min) / min) * 100) : 0;
    return { min, max, spreadPct };
  }

  return {
    listCasesP95PerRun: listP95,
    listCasesP95Spread: spread(listP95),
    getGraphP95PerRun: graphP95,
    getGraphP95Spread: spread(graphP95),
    historyP95PerRun: historyP95,
    historyP95Spread: spread(historyP95),
    dispatchBatchP95PerRun: dispatchP95,
    dispatchBatchP95Spread: spread(dispatchP95),
    heapGrowthPctPerRun: heapGrowth,
    outboxRowsTotalPerRun: outboxTotals,
    outboxRowsTotalIdentical: new Set(outboxTotals).size === 1,
  };
}

async function main(): Promise<void> {
  const adminDatabaseUrl = process.env.CW_PERF_ADMIN_DATABASE_URL;
  if (!adminDatabaseUrl) {
    console.error('[orchestrate] CW_PERF_ADMIN_DATABASE_URL is required (an already-reachable postgres database to issue CREATE/DROP DATABASE from)');
    process.exit(2);
  }

  const outDir = process.env.CW_PERF_OUT_DIR ?? __dirname;
  fs.mkdirSync(outDir, { recursive: true });

  const runCount = envInt('CW_PERF_RUN_COUNT', 3);
  const extraEnv: Record<string, string> = {
    CW_PERF_CASE_COUNT: process.env.CW_PERF_CASE_COUNT ?? '1000',
    CW_PERF_NODE_COUNT: process.env.CW_PERF_NODE_COUNT ?? '250',
    CW_PERF_EDGE_COUNT: process.env.CW_PERF_EDGE_COUNT ?? '500',
    CW_PERF_EVENTS_PER_CASE: process.env.CW_PERF_EVENTS_PER_CASE ?? '9',
    CW_PERF_CASE_CONCURRENCY: process.env.CW_PERF_CASE_CONCURRENCY ?? '15',
    CW_PERF_EVENT_CONCURRENCY: process.env.CW_PERF_EVENT_CONCURRENCY ?? '15',
    CW_PERF_DISPATCH_BATCH_SIZE: process.env.CW_PERF_DISPATCH_BATCH_SIZE ?? '200',
    CW_PERF_QUERY_REPS: process.env.CW_PERF_QUERY_REPS ?? '25',
    CW_PERF_FAILURE_INJECTION: process.env.CW_PERF_FAILURE_INJECTION ?? '1',
    CW_PERF_SOAK_MS: process.env.CW_PERF_SOAK_MS ?? '0',
  };

  const runSummaries: Array<Awaited<ReturnType<typeof runOneProfile>>> = [];
  for (let i = 1; i <= runCount; i += 1) {
    // Sequential on purpose — three runs sharing one cluster concurrently
    // would contaminate each other's latency measurements even on separate
    // databases (shared shared_buffers/CPU/IO), and would defeat the
    // "compare three runs for determinism" goal.
    // eslint-disable-next-line no-await-in-loop
    const summary = await runOneProfile(adminDatabaseUrl, i, outDir, extraEnv);
    runSummaries.push(summary);
  }

  const okResults: ProfileResult[] = [];
  for (const s of runSummaries) {
    if (s.ok && fs.existsSync(s.resultPath)) {
      okResults.push(JSON.parse(fs.readFileSync(s.resultPath, 'utf8')) as ProfileResult);
    }
  }

  const summaryPath = process.env.CW_PERF_SUMMARY_OUT ?? path.join(outDir, 'perf-summary.json');
  const summary = {
    generatedAt: new Date().toISOString(),
    requestedRunCount: runCount,
    successfulRunCount: okResults.length,
    runs: runSummaries.map((s) => ({
      runId: s.runId,
      dbName: s.dbName,
      ok: s.ok,
      resultPath: s.resultPath,
      migrationOk: (s.migration as { ok: boolean }).ok,
      migrationDurationMs: (s.migration as { durationMs: number }).durationMs,
      schemaCheck: s.schemaCheck,
      spawnExitCode: s.spawnLog.exitCode,
      spawnStderrTail: s.spawnLog.ok ? null : s.spawnLog.stderr.slice(-4000),
    })),
    determinism: okResults.length >= 2 ? compareDeterminism(okResults) : 'EVIDENCE_MISSING: fewer than 2 successful runs to compare',
  };

  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), 'utf8');
  console.log(`[orchestrate] wrote ${summaryPath}`);
  console.log(`[orchestrate] ${okResults.length}/${runCount} runs succeeded`);
  process.exit(okResults.length === runCount ? 0 : 1);
}

main().catch((err) => {
  console.error('[orchestrate] FATAL', err);
  process.exit(1);
});
