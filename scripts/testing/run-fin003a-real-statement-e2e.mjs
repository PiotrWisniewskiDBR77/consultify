#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import dotenv from 'dotenv';

const repoRoot = resolve(import.meta.dirname, '../..');
const envFile = resolve(repoRoot, 'server/.env.test');
const parsed = dotenv.parse(readFileSync(envFile));
const databaseUrl = parsed.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('[FIN-003A] server/.env.test does not define DATABASE_URL');
}

const target = new URL(databaseUrl);
const localHosts = new Set(['localhost', '127.0.0.1', '::1']);
const databaseName = decodeURIComponent(target.pathname.replace(/^\//, ''));
if (!localHosts.has(target.hostname) || databaseName !== 'consultinity_test') {
  throw new Error(
    `[FIN-003A] REFUSING database target host=${target.hostname} db=${databaseName || '(empty)'}`
  );
}

const safeEnv = {
  ...process.env,
  ...parsed,
  DATABASE_URL: databaseUrl,
  ENV_FILE: envFile,
  DOTENV_IGNORE_LOCAL: '1',
  DOTENV_OVERRIDE: '1',
  NODE_ENV: 'test',
  DB_TYPE: 'postgres',
  MOCK_DB: 'false',
  RUN_DB_TESTS: '1',
  POSTGRES_SKIP_INIT_IN_TEST: 'true',
  DISABLE_SCHEDULER: 'true',
};

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    env: safeEnv,
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log(`[FIN-003A] guarded local target: ${target.hostname}/${databaseName}`);
run('npx', ['tsx', 'server/scripts/migrate.postgres.ts']);
run('npx', [
  'vitest',
  'run',
  'tests/acceptance/odbior--fin003a--statement-import.e2e.test.ts',
  '--no-file-parallelism',
]);
