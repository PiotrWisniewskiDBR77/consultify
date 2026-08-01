#!/usr/bin/env node
/**
 * FIN-005 — THE one sanctioned way to run the real-PostgreSQL Atelier Finance
 * suites (`server/src/services/demo/__tests__/*.pg.test.ts`).
 *
 * ===========================================================================
 * WHY THIS EXISTS
 * ===========================================================================
 * Those suites share ONE database and install triggers on `financial_statements`
 * for the whole of it; per-organization tenancy isolates the DATA, not the schema
 * objects. Run in parallel they interleave, and the failures read like adapter
 * bugs while being pure harness interference — a reviewer chases a phantom.
 * Retries hide the same thing behind a green second attempt.
 *
 * Until now that requirement lived only in a comment in each file header, i.e.
 * one careless `npx vitest run server/src/services/demo` away from false red.
 * This runner makes it structural:
 *
 *   - `--retry=0` and `--fileParallelism=false` are FORCED, not requested;
 *   - the env that actually reaches Postgres is set here, not by the operator
 *     (`NODE_ENV=test` ALONE is a trap: it silently yields a MOCK database and
 *     every write becomes a no-op — DB_TYPE/RUN_DB_TESTS/MOCK_DB are what force
 *     the real driver);
 *   - the suite list is DISCOVERED, so a new `*.pg.test.ts` file is picked up
 *     without editing anything here;
 *   - the run reports the REAL database identity it hit (`current_database()`,
 *     `pg_control_system().system_identifier`, host, port);
 *   - and — the important one — ALL-SKIPPED WHILE `DATABASE_URL` IS DECLARED IS
 *     A FAILURE. An unreachable or misconfigured database used to turn the whole
 *     matrix into "skipped", which reads like success. If the operator declared a
 *     database, the suites must actually execute.
 *
 * ===========================================================================
 * USAGE (non-interactive; safe for an external integration harness)
 * ===========================================================================
 *   DATABASE_URL=postgresql://<user>@<host>:<port>/<db> npm run test:fin005:pg
 *
 * Optional:
 *   --summary-json=<path>   write the machine-readable summary to a file
 *   any other argument      forwarded verbatim to vitest (e.g. -t "pattern"),
 *                           except arguments that would contradict the two
 *                           forced flags — those are refused.
 *
 * A single line `FIN005_PG_SUMMARY_JSON=<json>` is always printed to stdout as
 * the last line, for harnesses that would rather parse than scrape.
 *
 * EXIT CODES
 *   0  every executed test passed and at least one test executed
 *   1  at least one test failed (or vitest itself exited non-zero)
 *   2  precondition not met: no/!postgres DATABASE_URL, database unreachable,
 *      or a contradicting CLI flag
 *   3  ALL SKIPPED while DATABASE_URL was declared  ← the silent-green case
 *   4  no `*.pg.test.ts` suite files found (renamed/moved/deleted)
 */

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

/** Repo root — this file lives at `<root>/scripts/testing/`. */
export const REPO_ROOT = path.resolve(HERE, '..', '..');

/** Where the real-PostgreSQL suites live, and how they are recognised. */
export const SUITE_DIR = path.join('server', 'src', 'services', 'demo', '__tests__');
export const SUITE_FILE_PATTERN = /\.pg\.test\.ts$/;

/** The name of the ONE sanctioned npm script. The ratchet test asserts on it. */
export const PACKAGE_SCRIPT_NAME = 'test:fin005:pg';

/**
 * The two flags whose removal would re-open the interleaving/flake hole.
 * They are injected here unconditionally, so the guarantee does not depend on
 * how the runner was invoked; `package.json` repeats them for visibility and
 * the ratchet test asserts on BOTH places.
 */
export const REQUIRED_VITEST_FLAGS = Object.freeze(['--retry=0', '--fileParallelism=false']);

/**
 * The env that actually reaches Postgres. `NODE_ENV=test` on its own returns a
 * MOCK database and every write is a no-op — that trap is closed here.
 * `DATABASE_URL` is deliberately NOT in this list: the operator declares it.
 */
export const FORCED_ENV = Object.freeze({
  DB_TYPE: 'postgres',
  NODE_ENV: 'test',
  RUN_DB_TESTS: '1',
  MOCK_DB: 'false',
});

export const EXIT_CODES = Object.freeze({
  OK: 0,
  TESTS_FAILED: 1,
  PRECONDITION: 2,
  ALL_SKIPPED: 3,
  NO_SUITES: 4,
});

const VITEST_ENTRY = path.join('node_modules', 'vitest', 'vitest.mjs');
const DEFAULT_JSON_REPORT = path.join('test-results', 'fin005-pg-report.json');

// ---------------------------------------------------------------------------
// Pure pieces — imported by `server/src/scripts/__tests__/fin005PgTestCommand.test.ts`
// ---------------------------------------------------------------------------

/**
 * Discover the suite files. NEVER hard-code the list: a fourth `*.pg.test.ts`
 * must be run by this command the moment it lands, or the command becomes a
 * partial run wearing a full-run badge.
 *
 * @param {string} [repoRoot]
 * @returns {string[]} repo-root-relative paths, sorted, POSIX separators
 */
export function discoverSuiteFiles(repoRoot = REPO_ROOT) {
  const absoluteDir = path.join(repoRoot, SUITE_DIR);
  if (!existsSync(absoluteDir)) return [];
  return readdirSync(absoluteDir)
    .filter((name) => SUITE_FILE_PATTERN.test(name))
    .sort()
    .map((name) => path.posix.join(...SUITE_DIR.split(path.sep), name));
}

/**
 * Build the exact argv handed to `node`. The first element is the vitest entry
 * point, so this is the complete, inspectable description of the run.
 *
 * @param {{ suiteFiles: string[], jsonReportPath: string, passthrough?: string[] }} input
 * @returns {string[]}
 */
export function buildVitestArgv({ suiteFiles, jsonReportPath, passthrough = [] }) {
  return [
    VITEST_ENTRY,
    'run',
    ...REQUIRED_VITEST_FLAGS,
    '--reporter=default',
    '--reporter=json',
    `--outputFile=${jsonReportPath}`,
    ...passthrough,
    ...suiteFiles,
  ];
}

/**
 * Split the operator's arguments into "ours" and "vitest's", and refuse any
 * argument that would contradict a forced flag. Silently dropping such an
 * argument would be worse: the operator would believe it took effect.
 *
 * @param {string[]} argv
 * @returns {{ passthrough: string[], summaryJsonPath: string|null, conflicts: string[] }}
 */
export function partitionArgs(argv) {
  const passthrough = [];
  const conflicts = [];
  let summaryJsonPath = null;

  for (const arg of argv) {
    if (arg.startsWith('--summary-json=')) {
      summaryJsonPath = arg.slice('--summary-json='.length);
      continue;
    }
    if (REQUIRED_VITEST_FLAGS.includes(arg)) continue; // already forced — do not duplicate
    if (arg === '--no-file-parallelism') continue; // same meaning as the forced flag
    if (/^--retry(=|$)/.test(arg) || /^--fileParallelism(=|$)/.test(arg) || arg === '--file-parallelism') {
      conflicts.push(arg);
      continue;
    }
    passthrough.push(arg);
  }

  return { passthrough, summaryJsonPath, conflicts };
}

/**
 * The verdict. `executed === 0` while a database was declared is a FAILURE —
 * that is the case this whole runner exists to stop reading as success.
 *
 * @param {{ vitestExitCode: number, passed: number, failed: number, skipped: number, databaseUrlDeclared: boolean }} input
 * @returns {{ ok: boolean, exitCode: number, executed: number, reasons: string[] }}
 */
export function evaluateRun({ vitestExitCode, passed, failed, skipped, databaseUrlDeclared }) {
  const executed = passed + failed;
  const reasons = [];
  let exitCode = EXIT_CODES.OK;

  if (failed > 0) {
    reasons.push(`${failed} test(s) failed`);
    exitCode = EXIT_CODES.TESTS_FAILED;
  } else if (vitestExitCode !== 0) {
    reasons.push(`vitest exited ${vitestExitCode} without reporting a failed test`);
    exitCode = EXIT_CODES.TESTS_FAILED;
  }

  if (executed === 0 && databaseUrlDeclared) {
    reasons.push(
      `ALL ${skipped} test(s) SKIPPED while DATABASE_URL was declared — a declared database ` +
        `must actually be exercised; this is a failure, not a clean skip`
    );
    if (exitCode === EXIT_CODES.OK) exitCode = EXIT_CODES.ALL_SKIPPED;
  }

  return { ok: exitCode === EXIT_CODES.OK, exitCode, executed, reasons };
}

/**
 * Read the counts out of vitest's JSON report.
 *
 * @param {string} reportPath
 * @returns {{ passed: number, failed: number, skipped: number, todo: number, files: number }}
 */
export function readVitestJsonReport(reportPath) {
  const raw = JSON.parse(readFileSync(reportPath, 'utf8'));
  return {
    passed: Number(raw.numPassedTests ?? 0),
    failed: Number(raw.numFailedTests ?? 0),
    skipped: Number(raw.numPendingTests ?? 0),
    todo: Number(raw.numTodoTests ?? 0),
    files: Number(raw.numTotalTestSuites ?? (raw.testResults?.length ?? 0)),
  };
}

// ---------------------------------------------------------------------------
// Database identity — `pg` directly, on purpose
// ---------------------------------------------------------------------------

/**
 * Ask the database who it actually is. Deliberately uses `pg` directly and
 * imports nothing from the seed: the seed's own modules are what the suites are
 * arguing about, and are being edited alongside this file.
 *
 * @param {string} connectionString
 */
export async function probeDatabaseIdentity(connectionString) {
  const { Client } = await import('pg');
  const client = new Client({ connectionString, connectionTimeoutMillis: 5000 });
  await client.connect();
  try {
    const identity = await client.query(
      `SELECT current_database()                                        AS database,
              current_user                                              AS db_user,
              (SELECT system_identifier::text FROM pg_control_system())  AS system_identifier,
              coalesce(inet_server_addr()::text, 'unix-socket')          AS server_addr,
              coalesce(inet_server_port()::text, '')                     AS server_port,
              version()                                                  AS server_version`
    );
    const schema = await client.query(
      `SELECT count(*) FILTER (WHERE table_name = 'financial_statements')::int   AS financial_statements,
              count(*) FILTER (WHERE table_name = 'financial_statements'
                                 AND column_name IN ('readiness_status','readiness_score'))::int
                                                                                 AS readiness_columns
         FROM information_schema.columns
        WHERE table_schema = 'public'`
    );
    return { ...identity.rows[0], ...schema.rows[0] };
  } finally {
    await client.end().catch(() => undefined);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

/**
 * Render a connection error usefully. Node's happy-eyeballs dialer throws an
 * `AggregateError` whose own `message` is EMPTY — printed naively it produces
 * "the database is NOT reachable: ." and the operator learns nothing.
 *
 * @param {unknown} error
 * @returns {string}
 */
export function describeError(error) {
  if (!(error instanceof Error)) return String(error);
  const parts = [];
  if (error.message) parts.push(error.message);
  // @ts-expect-error - runtime shape
  if (error.code) parts.push(`code ${error.code}`);
  // @ts-expect-error - runtime shape
  const nested = Array.isArray(error.errors) ? error.errors : [];
  for (const inner of nested) {
    const innerMessage = inner instanceof Error ? inner.message : String(inner);
    if (innerMessage) parts.push(innerMessage);
  }
  if (parts.length === 0) parts.push(error.name || 'unknown connection error');
  return parts.join('; ');
}

function fail(message, exitCode) {
  process.stdout.write(`\n[FIN-005 pg] FAILED — ${message}\n`);
  emitSummary({ status: 'failed', exitCode, reasons: [message] }, null);
  return exitCode;
}

function emitSummary(summary, summaryJsonPath) {
  const line = JSON.stringify(summary);
  process.stdout.write(`FIN005_PG_SUMMARY_JSON=${line}\n`);
  if (summaryJsonPath) {
    mkdirSync(path.dirname(path.resolve(summaryJsonPath)), { recursive: true });
    writeFileSync(path.resolve(summaryJsonPath), `${line}\n`, 'utf8');
  }
}

async function main(argv) {
  const { passthrough, summaryJsonPath, conflicts } = partitionArgs(argv);

  if (conflicts.length > 0) {
    return fail(
      `refusing ${conflicts.join(' ')} — this command forces ${REQUIRED_VITEST_FLAGS.join(' ')} ` +
        `because the FIN-005 suites share one database and install global triggers on ` +
        `financial_statements; parallel or retried runs produce phantom "adapter bugs".`,
      EXIT_CODES.PRECONDITION
    );
  }

  const connectionString = process.env.DATABASE_URL ?? '';
  const databaseUrlDeclared = connectionString.trim().length > 0;

  if (!databaseUrlDeclared || !connectionString.startsWith('postgres')) {
    return fail(
      `DATABASE_URL must be set to a PostgreSQL connection string. These suites prove what ` +
        `PostgreSQL does under fault; there is nothing meaningful to run without one. ` +
        `Example: DATABASE_URL=postgresql://<user>@localhost:5432/<db> npm run ${PACKAGE_SCRIPT_NAME}`,
      EXIT_CODES.PRECONDITION
    );
  }

  const suiteFiles = discoverSuiteFiles();
  if (suiteFiles.length === 0) {
    return fail(
      `no ${SUITE_FILE_PATTERN} files under ${SUITE_DIR} — the suites were renamed, moved or ` +
        `deleted. Refusing to report a green run over an empty matrix.`,
      EXIT_CODES.NO_SUITES
    );
  }

  let identity;
  try {
    identity = await probeDatabaseIdentity(connectionString);
  } catch (error) {
    return fail(
      `DATABASE_URL is declared but the database is NOT reachable/usable: ` +
        `${describeError(error)}. ` +
        `Running anyway would skip every suite and print green — refusing.`,
      EXIT_CODES.PRECONDITION
    );
  }

  const redactedUrl = (() => {
    try {
      const url = new URL(connectionString);
      url.password = '';
      return `${url.protocol}//${url.username}@${url.hostname}:${url.port || '5432'}${url.pathname}`;
    } catch {
      return '<unparseable DATABASE_URL>';
    }
  })();

  process.stdout.write(
    [
      '',
      '=========================================================================',
      'FIN-005 — real-PostgreSQL Atelier Finance suites (sequential, no retries)',
      '=========================================================================',
      `  url ................. ${redactedUrl}`,
      `  current_database() .. ${identity.database}`,
      `  system_identifier ... ${identity.system_identifier}`,
      `  server .............. ${identity.server_addr}:${identity.server_port || 'n/a'}`,
      `  user ................ ${identity.db_user}`,
      `  version ............. ${String(identity.server_version).split(' on ')[0]}`,
      `  financial_statements  ${identity.financial_statements > 0 ? `present (${identity.financial_statements} columns, ${identity.readiness_columns}/2 readiness)` : 'MISSING — the database is not migrated'}`,
      `  suite files ......... ${suiteFiles.length}`,
      ...suiteFiles.map((file) => `      · ${file}`),
      `  forced env .......... ${Object.entries(FORCED_ENV).map(([k, v]) => `${k}=${v}`).join(' ')}`,
      `  forced flags ........ ${REQUIRED_VITEST_FLAGS.join(' ')}`,
      '',
    ].join('\n')
  );

  const jsonReportPath = path.resolve(
    REPO_ROOT,
    process.env.FIN005_PG_JSON_REPORT ?? DEFAULT_JSON_REPORT
  );
  mkdirSync(path.dirname(jsonReportPath), { recursive: true });
  const argvForNode = buildVitestArgv({ suiteFiles, jsonReportPath, passthrough });

  const startedAt = Date.now();
  const vitestExitCode = await new Promise((resolve) => {
    const child = spawn(process.execPath, argvForNode, {
      cwd: REPO_ROOT,
      stdio: 'inherit',
      env: { ...process.env, ...FORCED_ENV, DATABASE_URL: connectionString },
    });
    child.on('close', (code, signal) => resolve(signal ? 128 : (code ?? 1)));
    child.on('error', () => resolve(1));
  });
  const durationMs = Date.now() - startedAt;

  let counts;
  try {
    counts = readVitestJsonReport(jsonReportPath);
  } catch (error) {
    return fail(
      `vitest produced no readable JSON report at ${jsonReportPath} ` +
        `(${error instanceof Error ? error.message : String(error)}); vitest exit code was ` +
        `${vitestExitCode}. Without counts this run cannot be called green.`,
      EXIT_CODES.TESTS_FAILED
    );
  }

  const verdict = evaluateRun({ vitestExitCode, ...counts, databaseUrlDeclared });

  process.stdout.write(
    [
      '',
      '=========================================================================',
      `FIN-005 real-PostgreSQL result: ${verdict.ok ? 'PASSED' : 'FAILED'}`,
      '=========================================================================',
      `  passed .............. ${counts.passed}`,
      `  failed .............. ${counts.failed}`,
      `  skipped ............. ${counts.skipped}`,
      `  executed ............ ${verdict.executed}  (passed + failed)`,
      `  suite files ......... ${suiteFiles.length}`,
      `  database ............ ${identity.database} @ ${identity.server_addr}:${identity.server_port || 'n/a'} ` +
        `(system_identifier ${identity.system_identifier})`,
      `  duration ............ ${(durationMs / 1000).toFixed(1)}s`,
      `  vitest exit code .... ${vitestExitCode}`,
      ...verdict.reasons.map((reason) => `  ! ${reason}`),
      `  exit code ........... ${verdict.exitCode}`,
      '',
    ].join('\n')
  );

  emitSummary(
    {
      status: verdict.ok ? 'passed' : 'failed',
      exitCode: verdict.exitCode,
      passed: counts.passed,
      failed: counts.failed,
      skipped: counts.skipped,
      executed: verdict.executed,
      suiteFiles,
      durationMs,
      vitestExitCode,
      database: {
        name: identity.database,
        systemIdentifier: identity.system_identifier,
        host: identity.server_addr,
        port: identity.server_port || null,
        user: identity.db_user,
        url: redactedUrl,
      },
      reasons: verdict.reasons,
    },
    summaryJsonPath
  );

  return verdict.exitCode;
}

const invokedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  main(process.argv.slice(2))
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      process.stdout.write(`\n[FIN-005 pg] FAILED — unexpected runner error: ${error?.stack ?? error}\n`);
      process.exitCode = EXIT_CODES.PRECONDITION;
    });
}
