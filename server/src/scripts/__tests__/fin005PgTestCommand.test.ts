/**
 * FIN-005 — the RATCHET over the one sanctioned way to run the real-PostgreSQL
 * Atelier Finance suites.
 *
 * ===========================================================================
 * WHAT THIS FILE PROTECTS
 * ===========================================================================
 * `server/src/services/demo/__tests__/*.pg.test.ts` share ONE database and
 * install triggers on `financial_statements` for the whole of it. Run in
 * parallel, or retried, they interleave and fail in ways that look like adapter
 * bugs — a reviewer chases a phantom. The requirement used to live only in a
 * comment in each file header: one careless invocation away from false red.
 *
 * So this file asserts, against the LIVE definitions rather than against copies
 * of strings kept here:
 *
 *   1. `package.json` still defines the command, and it still carries BOTH
 *      `--retry=0` and `--fileParallelism=false`;
 *   2. the runner the command points at exists, and the argv it actually builds
 *      carries both flags too (so the guarantee cannot drift out of the code
 *      while the package.json string keeps saying it does);
 *   3. the suite list is DISCOVERED from disk — a fourth `*.pg.test.ts` file is
 *      picked up automatically, and a stale hard-coded list cannot come back;
 *   4. ALL-SKIPPED while `DATABASE_URL` is declared is a FAILURE. That is the
 *      single most valuable assertion here: an unreachable or misconfigured
 *      database used to turn the whole matrix into "skipped", which reads like
 *      success;
 *   5. the env the runner forces is the env that actually reaches Postgres —
 *      `NODE_ENV=test` ALONE silently yields a MOCK database where every write
 *      is a no-op.
 *
 * ===========================================================================
 * WHY IT CANNOT PASS VACUOUSLY
 * ===========================================================================
 * Nothing here is hard-coded to a path that could quietly stop existing. The
 * script name is looked up in `package.json` and its absence FAILS; the runner
 * module is resolved FROM the script string and its absence FAILS; the suite
 * directory is read from disk and an empty (or shrinking) result FAILS. Rename
 * or delete the command and this file goes red rather than silent.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { describe, expect, it } from 'vitest';

const HERE = path.dirname(fileURLToPath(import.meta.url));
// server/src/scripts/__tests__ -> repo root
const REPO_ROOT = path.resolve(HERE, '..', '..', '..', '..');

const SCRIPT_NAME = 'test:fin005:pg';
const REQUIRED_FLAGS = ['--retry=0', '--fileParallelism=false'] as const;
const SUITE_DIR = path.join('server', 'src', 'services', 'demo', '__tests__');

function readRootPackageJson(): { scripts?: Record<string, string> } {
  const packageJsonPath = path.join(REPO_ROOT, 'package.json');
  expect(
    existsSync(packageJsonPath),
    `the repo-root package.json was not found at ${packageJsonPath} — this test resolved the ` +
      `repo root incorrectly and would otherwise pass vacuously`
  ).toBe(true);
  return JSON.parse(readFileSync(packageJsonPath, 'utf8'));
}

function readCommandDefinition(): string {
  const scripts = readRootPackageJson().scripts ?? {};
  const definition = scripts[SCRIPT_NAME];
  expect(
    typeof definition === 'string' && definition.trim().length > 0,
    `package.json no longer defines "${SCRIPT_NAME}". It is the ONLY sanctioned way to run the ` +
      `FIN-005 real-PostgreSQL suites (they share one database and install global triggers). ` +
      `If it was renamed, rename it here too — do not delete this assertion.`
  ).toBe(true);
  return definition as string;
}

function resolveRunnerFromCommand(): string {
  const definition = readCommandDefinition();
  const match = definition.match(/(?:^|\s)((?:[\w./@-]+\/)*[\w.-]+\.(?:mjs|cjs|[jt]s))(?:\s|$)/);
  expect(
    match?.[1],
    `"${SCRIPT_NAME}" no longer names a runner script file: ${definition}`
  ).toBeTruthy();
  const runnerRelativePath = match?.[1] ?? '';
  const runnerPath = path.resolve(REPO_ROOT, runnerRelativePath);
  expect(
    existsSync(runnerPath),
    `"${SCRIPT_NAME}" points at ${runnerRelativePath}, which does not exist`
  ).toBe(true);
  return runnerPath;
}

/**
 * The runner's public surface, described structurally rather than through a
 * `typeof import(...)` of the `.mjs` file: the runner lives outside this
 * package's `rootDir`, and pulling it into the type graph would drag it into
 * `tsc --noEmit`. The shape is asserted at RUNTIME below, which is the only
 * assertion that could keep the flags honest anyway.
 */
interface Runner {
  REQUIRED_VITEST_FLAGS: readonly string[];
  FORCED_ENV: Readonly<Record<string, string>>;
  EXIT_CODES: Readonly<Record<string, number>>;
  discoverSuiteFiles(repoRoot?: string): string[];
  buildVitestArgv(input: {
    suiteFiles: string[];
    jsonReportPath: string;
    passthrough?: string[];
  }): string[];
  partitionArgs(argv: string[]): {
    passthrough: string[];
    summaryJsonPath: string | null;
    conflicts: string[];
  };
  evaluateRun(input: {
    vitestExitCode: number;
    passed: number;
    failed: number;
    skipped: number;
    databaseUrlDeclared: boolean;
  }): { ok: boolean; exitCode: number; executed: number; reasons: string[] };
}

async function importRunner(): Promise<Runner> {
  // Imported through the path the COMMAND names, never a path hard-coded here:
  // if the command starts pointing somewhere else, this test follows it.
  return (await import(
    /* @vite-ignore */ pathToFileURL(resolveRunnerFromCommand()).href
  )) as Runner;
}

describe('FIN-005 — the sanctioned real-PostgreSQL test command', () => {
  it('is defined in the repo-root package.json (not server/package.json)', () => {
    // Repo root is correct on purpose: these suites are collected by the ROOT
    // vitest.config.ts (its alias table is what maps their relative `.js`
    // imports onto `.ts` sources), and vitest + pg are root dependencies.
    // Running them from server/ would collect them with no aliases at all.
    const definition = readCommandDefinition();
    expect(definition).toContain('run-fin005-pg-tests');

    const serverPackageJsonPath = path.join(REPO_ROOT, 'server', 'package.json');
    if (existsSync(serverPackageJsonPath)) {
      const serverScripts: Record<string, string> =
        JSON.parse(readFileSync(serverPackageJsonPath, 'utf8')).scripts ?? {};
      const strays = Object.entries(serverScripts).filter(([, value]) => value.includes('pg.test'));
      expect(
        strays,
        `server/package.json must not offer a second, unsanctioned way to run the pg suites`
      ).toEqual([]);
    }
  });

  it.each(REQUIRED_FLAGS)('forces %s in the package.json command definition', (flag) => {
    const definition = readCommandDefinition();
    expect(
      definition,
      `"${SCRIPT_NAME}" lost ${flag}. The FIN-005 pg suites share one database and install ` +
        `triggers on financial_statements; without ${flag} they interleave / get retried and the ` +
        `failures read as adapter bugs. Put it back.`
    ).toContain(flag);
  });

  it.each(REQUIRED_FLAGS)('actually passes %s to vitest (exactly once)', async (flag) => {
    const runner = await importRunner();
    const argv = runner.buildVitestArgv({
      suiteFiles: ['server/src/services/demo/__tests__/example.pg.test.ts'],
      jsonReportPath: '/tmp/fin005-report.json',
      passthrough: [],
    });
    expect(
      argv.filter((arg) => arg === flag),
      `the runner's own vitest argv no longer carries ${flag}: ${argv.join(' ')}`
    ).toEqual([flag]);
    expect(runner.REQUIRED_VITEST_FLAGS).toContain(flag);
  });

  it('builds a `vitest run` argv that reports counts and ends with the suite files', async () => {
    const runner = await importRunner();
    const argv = runner.buildVitestArgv({
      suiteFiles: ['a.pg.test.ts', 'b.pg.test.ts'],
      jsonReportPath: '/tmp/fin005-report.json',
    });
    expect(argv[0]).toContain(path.join('vitest', 'vitest.mjs'));
    expect(argv[1]).toBe('run');
    expect(argv).toContain('--reporter=json');
    expect(argv).toContain('--outputFile=/tmp/fin005-report.json');
    expect(argv.slice(-2)).toEqual(['a.pg.test.ts', 'b.pg.test.ts']);
  });

  it('refuses arguments that would contradict the forced flags', async () => {
    const runner = await importRunner();
    expect(runner.partitionArgs(['--retry=2']).conflicts).toEqual(['--retry=2']);
    expect(runner.partitionArgs(['--fileParallelism=true']).conflicts).toEqual([
      '--fileParallelism=true',
    ]);
    // The flags the package.json script itself passes must not be duplicated
    // into the vitest argv, and must not be treated as conflicts.
    const fromPackageJson = runner.partitionArgs([...REQUIRED_FLAGS, '-t', 'GREEN']);
    expect(fromPackageJson.conflicts).toEqual([]);
    expect(fromPackageJson.passthrough).toEqual(['-t', 'GREEN']);
  });

  it('discovers every *.pg.test.ts on disk instead of carrying a stale list', async () => {
    const runner = await importRunner();
    const onDisk = readdirSync(path.join(REPO_ROOT, SUITE_DIR))
      .filter((name) => name.endsWith('.pg.test.ts'))
      .sort();

    expect(
      onDisk.length,
      `no *.pg.test.ts suites found under ${SUITE_DIR} — either they moved (fix this test AND the ` +
        `runner) or this assertion is about to start passing over an empty matrix`
    ).toBeGreaterThanOrEqual(3);

    const discovered = runner.discoverSuiteFiles(REPO_ROOT);
    expect(discovered.map((file: string) => path.posix.basename(file))).toEqual(onDisk);
  });

  it('forces the env that actually reaches Postgres (NODE_ENV=test alone is a mock)', async () => {
    const runner = await importRunner();
    expect(runner.FORCED_ENV).toMatchObject({
      DB_TYPE: 'postgres',
      NODE_ENV: 'test',
      RUN_DB_TESTS: '1',
      MOCK_DB: 'false',
    });
    // DATABASE_URL stays the operator's declaration — the runner must never
    // invent one, or "which database did this prove anything about?" is lost.
    expect(Object.keys(runner.FORCED_ENV)).not.toContain('DATABASE_URL');
  });

  describe('the verdict', () => {
    it('FAILS when everything was skipped although DATABASE_URL was declared', async () => {
      const runner = await importRunner();
      const verdict = runner.evaluateRun({
        vitestExitCode: 0,
        passed: 0,
        failed: 0,
        skipped: 28,
        databaseUrlDeclared: true,
      });
      expect(
        verdict.ok,
        `an all-skipped run against a DECLARED database must never be green — that is exactly the ` +
          `silent failure this command exists to remove`
      ).toBe(false);
      expect(verdict.exitCode).toBe(runner.EXIT_CODES.ALL_SKIPPED);
      expect(verdict.exitCode).not.toBe(0);
      expect(verdict.reasons.join(' ')).toMatch(/SKIPPED/i);
    });

    it('FAILS on a failed test, and on a non-zero vitest exit with no failure counted', async () => {
      const runner = await importRunner();
      const failed = runner.evaluateRun({
        vitestExitCode: 1,
        passed: 27,
        failed: 1,
        skipped: 0,
        databaseUrlDeclared: true,
      });
      expect(failed.ok).toBe(false);
      expect(failed.exitCode).toBe(runner.EXIT_CODES.TESTS_FAILED);

      const crashed = runner.evaluateRun({
        vitestExitCode: 137,
        passed: 3,
        failed: 0,
        skipped: 0,
        databaseUrlDeclared: true,
      });
      expect(crashed.ok).toBe(false);
      expect(crashed.exitCode).not.toBe(0);
    });

    it('PASSES only when tests actually executed', async () => {
      const runner = await importRunner();
      const green = runner.evaluateRun({
        vitestExitCode: 0,
        passed: 28,
        failed: 0,
        skipped: 2,
        databaseUrlDeclared: true,
      });
      expect(green.ok).toBe(true);
      expect(green.exitCode).toBe(0);
      expect(green.executed).toBe(28);
    });
  });
});
