#!/usr/bin/env node

import {
  createWriteStream,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { basename, join, relative, resolve, sep } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const manifestPath = resolve(import.meta.dirname, 'cleanup-test-matrix.json');
const matrix = JSON.parse(readFileSync(manifestPath, 'utf8'));
const command = process.argv[2] ?? 'validate';

const fail = (message) => {
  console.error(`[cleanup-test-matrix] ${message}`);
  process.exitCode = 1;
};

const gateEntries = Object.entries(matrix.gates);
const classified = new Map();

for (const [gate, config] of gateEntries) {
  for (const file of config.files) {
    if (!existsSync(resolve(root, file))) fail(`missing file in ${gate}: ${file}`);
    if (classified.has(file)) {
      fail(`file occurs in multiple gates (${classified.get(file)}, ${gate}): ${file}`);
    } else {
      classified.set(file, gate);
    }
  }
}

const excluded = new Set(matrix.standard.excludeFiles);
for (const file of excluded) {
  if (!existsSync(resolve(root, file))) fail(`missing standard exclusion: ${file}`);
  if (!classified.has(file)) fail(`standard exclusion has no explicit gate: ${file}`);
}
for (const file of classified.keys()) {
  if (!excluded.has(file)) fail(`classified file is not excluded from standard: ${file}`);
}

if (process.exitCode) process.exit(process.exitCode);

const AMBIENT_DATABASE_KEYS = [
  'DATABASE_URL',
  'DATABASE_PUBLIC_URL',
  'DB_TYPE',
  'MOCK_DB',
  'RUN_DB_TESTS',
  'PGHOST',
  'PGPORT',
  'PGDATABASE',
  'PGUSER',
  'PGPASSWORD',
];

const sanitizedTestEnv = () => {
  const env = { ...process.env };
  for (const key of AMBIENT_DATABASE_KEYS) delete env[key];
  // Vite and server entrypoints both load `.env` during test discovery. Use a
  // non-empty, deliberately unreachable sentinel so neither loader can restore
  // a developer or hosted DATABASE_URL. Database tests are excluded into the
  // explicit fresh-postgres gate; any accidental standard-gate connection must
  // fail closed against port 1 instead of touching shared state.
  env.DATABASE_URL = 'postgresql://cleanup_disabled:cleanup_disabled@127.0.0.1:1/cleanup_disabled';
  env.DATABASE_PUBLIC_URL = env.DATABASE_URL;
  env.DB_TYPE = 'postgres';
  env.PGHOST = '127.0.0.1';
  env.PGPORT = '1';
  env.PGDATABASE = 'cleanup_disabled';
  env.PGUSER = 'cleanup_disabled';
  env.PGPASSWORD = 'cleanup_disabled';
  env.DOTENV_IGNORE_LOCAL = '1';
  return env;
};

const run = (args) => {
  const result = spawnSync('npx', ['vitest', 'run', ...args], {
    cwd: root,
    // Standard and isolated gates must never inherit a developer or hosted
    // database target. Tests that need a database belong in the explicit
    // realDB gate, whose runner supplies a freshly migrated disposable URL.
    env: sanitizedTestEnv(),
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  return result.status ?? 1;
};

const standardExclusionArgs = () => [
  ...matrix.standard.excludePatterns.flatMap((pattern) => ['--exclude', pattern]),
  ...matrix.standard.excludeFiles.flatMap((file) => ['--exclude', file]),
];

const positiveInteger = (raw, fallback, label) => {
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${label} must be a positive integer, received: ${raw}`);
  }
  return value;
};

const relativeTestPath = (absolutePath) => {
  const path = relative(root, absolutePath);
  if (path === '..' || path.startsWith(`..${sep}`)) {
    throw new Error(`discovery returned a path outside the repository: ${absolutePath}`);
  }
  return path.split(sep).join('/');
};

const runCaptured = (args, { logPath, env = sanitizedTestEnv() }) =>
  new Promise((resolveRun, rejectRun) => {
    const child = spawn('npx', ['vitest', ...args], {
      cwd: root,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const log = createWriteStream(logPath, { flags: 'wx' });
    child.stdout.pipe(log);
    child.stderr.pipe(log);
    child.on('error', rejectRun);
    child.on('close', (status, signal) => {
      log.end(() => resolveRun({ status: status ?? 1, signal: signal ?? null }));
    });
  });

const runStandardSharded = async () => {
  const shardCount = positiveInteger(process.env.CLEANUP_TEST_SHARDS, 12, 'CLEANUP_TEST_SHARDS');
  const concurrency = Math.min(
    shardCount,
    positiveInteger(process.env.CLEANUP_TEST_CONCURRENCY, 3, 'CLEANUP_TEST_CONCURRENCY'),
  );
  const gitSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  const reportDir = process.env.CLEANUP_TEST_REPORT_DIR
    ? resolve(root, process.env.CLEANUP_TEST_REPORT_DIR)
    : mkdtempSync(join(tmpdir(), `consultify-standard-sharded-${gitSha.slice(0, 12)}-`));
  if (process.env.CLEANUP_TEST_REPORT_DIR) {
    if (existsSync(reportDir)) {
      throw new Error(`CLEANUP_TEST_REPORT_DIR already exists; refusing to overwrite evidence: ${reportDir}`);
    }
    mkdirSync(reportDir, { recursive: true });
  }

  const discoveryPath = join(reportDir, 'discovery.json');
  const discoveryLogPath = join(reportDir, 'discovery.log');
  console.log(`[cleanup-test-matrix] sharded standard discovery at ${gitSha}`);
  console.log(`[cleanup-test-matrix] evidence: ${reportDir}`);

  const discovery = await runCaptured(
    [
      'list',
      '--filesOnly',
      `--json=${discoveryPath}`,
      '--retry=0',
      ...standardExclusionArgs(),
    ],
    { logPath: discoveryLogPath },
  );
  if (discovery.status !== 0 || !existsSync(discoveryPath)) {
    throw new Error(
      `standard discovery failed (exit=${discovery.status}, signal=${discovery.signal ?? 'none'}); see ${discoveryLogPath}`,
    );
  }

  const discovered = JSON.parse(readFileSync(discoveryPath, 'utf8'))
    .map((entry) => relativeTestPath(entry.file))
    .sort((a, b) => a.localeCompare(b));
  if (discovered.length === 0) throw new Error('standard discovery returned zero test files');
  if (new Set(discovered).size !== discovered.length) {
    throw new Error('standard discovery returned duplicate test files');
  }

  // Deterministic size-balanced assignment: same SHA + same shard count always
  // produces the same manifest, while every discovered standard file appears
  // exactly once. Explicit file filters make coverage independently auditable.
  const shards = Array.from({ length: shardCount }, (_, index) => ({
    index: index + 1,
    files: [],
    sourceBytes: 0,
  }));
  const bySize = discovered
    .map((file) => ({ file, bytes: statSync(resolve(root, file)).size }))
    .sort((a, b) => b.bytes - a.bytes || a.file.localeCompare(b.file));
  for (const entry of bySize) {
    const target = shards.reduce((best, candidate) =>
      candidate.sourceBytes < best.sourceBytes ||
      (candidate.sourceBytes === best.sourceBytes && candidate.index < best.index)
        ? candidate
        : best,
    );
    target.files.push(entry.file);
    target.sourceBytes += entry.bytes;
  }
  for (const shard of shards) shard.files.sort((a, b) => a.localeCompare(b));

  const assigned = shards.flatMap((shard) => shard.files);
  if (assigned.length !== discovered.length || new Set(assigned).size !== discovered.length) {
    throw new Error('shard manifest does not form a one-to-one partition of standard discovery');
  }
  const matrixSha256 = createHash('sha256').update(readFileSync(manifestPath)).digest('hex');
  const manifest = {
    schemaVersion: 1,
    gitSha,
    matrixPath: relative(root, manifestPath),
    matrixSha256,
    standardFileCount: discovered.length,
    shardCount,
    concurrency,
    exclusions: matrix.standard,
    shards,
  };
  writeFileSync(join(reportDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, {
    flag: 'wx',
  });
  console.log(
    `[cleanup-test-matrix] discovered ${discovered.length} standard files; ${shardCount} fresh processes; concurrency ${concurrency}`,
  );

  let nextShard = 0;
  const results = [];
  const worker = async () => {
    while (true) {
      const position = nextShard;
      nextShard += 1;
      if (position >= shards.length) return;
      const shard = shards[position];
      const label = String(shard.index).padStart(String(shardCount).length, '0');
      const resultPath = join(reportDir, `shard-${label}.json`);
      const logPath = join(reportDir, `shard-${label}.log`);
      console.log(
        `[cleanup-test-matrix] shard ${shard.index}/${shardCount} START files=${shard.files.length} bytes=${shard.sourceBytes}`,
      );
      const startedAt = Date.now();
      const processResult = await runCaptured(
        [
          'run',
          // Vitest treats relative CLI filters as substrings. An entry such as
          // `src/.../supersession.test.ts` would therefore also select
          // `server/src/.../supersession.test.ts` from another shard. Absolute
          // paths make each filter exact for this checkout and preserve the
          // manifest's one-file-one-shard invariant.
          ...shard.files.map((file) => resolve(root, file)),
          '--no-file-parallelism',
          '--retry=0',
          '--bail=0',
          '--reporter=default',
          '--reporter=json',
          `--outputFile=${resultPath}`,
          ...standardExclusionArgs(),
        ],
        { logPath },
      );
      const elapsedMs = Date.now() - startedAt;
      const report = existsSync(resultPath) ? JSON.parse(readFileSync(resultPath, 'utf8')) : null;
      const reportedFiles = new Map(
        (report?.testResults ?? []).map((entry) => [relativeTestPath(entry.name), entry.status]),
      );
      const missingResultFiles = shard.files.filter((file) => !reportedFiles.has(file));
      const unexpectedResultFiles = [...reportedFiles.keys()].filter((file) => !shard.files.includes(file));
      const nonGreenFiles = [...reportedFiles.entries()]
        .filter(([, status]) => status !== 'passed')
        .map(([file]) => file)
        .sort((a, b) => a.localeCompare(b));
      const result = {
        shard: shard.index,
        expectedFiles: shard.files.length,
        reportedFiles: reportedFiles.size,
        exitCode: processResult.status,
        signal: processResult.signal,
        elapsedMs,
        tests: {
          total: report?.numTotalTests ?? null,
          passed: report?.numPassedTests ?? null,
          failed: report?.numFailedTests ?? null,
          pending: report?.numPendingTests ?? null,
          todo: report?.numTodoTests ?? null,
        },
        nonGreenFiles,
        missingResultFiles,
        unexpectedResultFiles,
        resultPath: basename(resultPath),
        logPath: basename(logPath),
      };
      results.push(result);
      console.log(
        `[cleanup-test-matrix] shard ${shard.index}/${shardCount} END exit=${result.exitCode} files=${result.reportedFiles}/${result.expectedFiles} tests=${result.tests.passed}/${result.tests.total} failed=${result.tests.failed} missing=${missingResultFiles.length} duration=${Math.round(elapsedMs / 1000)}s`,
      );
    }
  };
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  results.sort((a, b) => a.shard - b.shard);

  const nonGreenFiles = [...new Set(results.flatMap((result) => result.nonGreenFiles))].sort();
  const missingResultFiles = [...new Set(results.flatMap((result) => result.missingResultFiles))].sort();
  const unexpectedResultFiles = [...new Set(results.flatMap((result) => result.unexpectedResultFiles))].sort();
  const totals = results.reduce(
    (sum, result) => {
      for (const key of ['total', 'passed', 'failed', 'pending', 'todo']) {
        if (typeof result.tests[key] === 'number') sum[key] += result.tests[key];
      }
      return sum;
    },
    { total: 0, passed: 0, failed: 0, pending: 0, todo: 0 },
  );
  const green =
    results.every((result) => result.exitCode === 0 && result.signal === null) &&
    nonGreenFiles.length === 0 &&
    missingResultFiles.length === 0 &&
    unexpectedResultFiles.length === 0;
  const summary = {
    schemaVersion: 1,
    gitSha,
    matrixSha256,
    green,
    standardFileCount: discovered.length,
    shardCount,
    concurrency,
    totals,
    nonGreenFiles,
    missingResultFiles,
    unexpectedResultFiles,
    shards: results,
  };
  writeFileSync(join(reportDir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`, {
    flag: 'wx',
  });

  console.log('\n[cleanup-test-matrix] SHARDED STANDARD SUMMARY');
  console.log(`- git SHA: ${gitSha}`);
  console.log(`- files: ${discovered.length}`);
  console.log(
    `- tests: ${totals.passed} passed, ${totals.failed} failed, ${totals.pending} pending, ${totals.todo} todo, ${totals.total} total`,
  );
  console.log(`- gate: ${green ? 'PASS' : 'FAIL'}`);
  console.log(`- evidence: ${reportDir}`);
  if (nonGreenFiles.length) {
    console.log('- non-green files:');
    nonGreenFiles.forEach((file) => console.log(`  - ${file}`));
  }
  if (missingResultFiles.length) {
    console.log('- files missing from Vitest result:');
    missingResultFiles.forEach((file) => console.log(`  - ${file}`));
  }
  if (unexpectedResultFiles.length) {
    console.log('- unexpected files in Vitest result:');
    unexpectedResultFiles.forEach((file) => console.log(`  - ${file}`));
  }
  return green ? 0 : 1;
};

if (command === 'validate') {
  console.log(`[cleanup-test-matrix] valid: ${classified.size} explicitly classified files`);
  for (const [gate, config] of gateEntries) {
    console.log(`- ${gate}: ${config.files.length} (${config.execution})`);
  }
} else if (command === 'standard-args') {
  const args = [
    '--no-file-parallelism',
    '--retry=0',
    '--bail=5',
    ...standardExclusionArgs(),
  ];
  console.log(args.map((value) => JSON.stringify(value)).join(' '));
} else if (command === 'run-standard') {
  const args = [
    '--no-file-parallelism',
    '--retry=0',
    '--bail=5',
    ...standardExclusionArgs(),
  ];
  process.exit(run(args));
} else if (command === 'run-standard-sharded') {
  process.exit(await runStandardSharded());
} else if (command === 'run-isolated') {
  for (const file of matrix.gates.isolated.files) {
    console.log(`\n[cleanup-test-matrix] isolated: ${file}`);
    const status = run(['--no-file-parallelism', '--retry=0', file]);
    if (status !== 0) process.exit(status);
  }
} else if (command === 'list') {
  for (const [gate, config] of gateEntries) {
    console.log(`\n${gate} (${config.execution})\n${config.reason}`);
    config.files.forEach((file) => console.log(`- ${file}`));
  }
} else {
  fail(`unknown command: ${command}`);
}
