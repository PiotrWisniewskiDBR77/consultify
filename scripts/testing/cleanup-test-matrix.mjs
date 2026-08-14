#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

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
    ...matrix.standard.excludePatterns.flatMap((pattern) => ['--exclude', pattern]),
    ...matrix.standard.excludeFiles.flatMap((file) => ['--exclude', file]),
  ];
  console.log(args.map((value) => JSON.stringify(value)).join(' '));
} else if (command === 'run-standard') {
  const args = [
    '--no-file-parallelism',
    '--retry=0',
    '--bail=5',
    ...matrix.standard.excludePatterns.flatMap((pattern) => ['--exclude', pattern]),
    ...matrix.standard.excludeFiles.flatMap((file) => ['--exclude', file]),
  ];
  process.exit(run(args));
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
