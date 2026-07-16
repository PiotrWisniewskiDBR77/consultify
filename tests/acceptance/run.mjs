#!/usr/bin/env node
/**
 * Consultify Acceptance Harness — one-command runner.
 *
 *   node tests/acceptance/run.mjs
 *
 * Steps: local Postgres UP (docker) -> FULL schema -> seed -> vitest E2E.
 * Writes ONLY to the local container. Never touches demo/TROLLEY/centerbeam.
 *
 * Env overrides:
 *   ACCEPTANCE_PG_PORT   host port for the container (default 5442)
 *   ACCEPTANCE_PG_NAME   container name (default consultify-acceptance-pg)
 *   SKIP_DB_UP=1         reuse an already-running container
 */
import { execSync, spawnSync } from 'node:child_process';

const PORT = process.env.ACCEPTANCE_PG_PORT || '5442';
const NAME = process.env.ACCEPTANCE_PG_NAME || 'consultify-acceptance-pg';
const DATABASE_URL = `postgres://consultinity:consultinity@localhost:${PORT}/consultinity`;

const env = {
  ...process.env,
  DATABASE_URL,
  NODE_ENV: 'test',
  RUN_DB_TESTS: '1', // force real Postgres (not the in-memory mock)
  MOCK_DB: 'false',
  POSTGRES_SKIP_INIT_IN_TEST: 'true', // schema is pre-loaded by schema.mjs
  JWT_SECRET: process.env.JWT_SECRET || 'development_secret_key_change_in_production_abc123xyz',
};

function sh(cmd, opts = {}) {
  console.log(`\n$ ${cmd}`);
  execSync(cmd, { stdio: 'inherit', env, ...opts });
}

function run(cmd, args) {
  console.log(`\n$ ${cmd} ${args.join(' ')}`);
  const r = spawnSync(cmd, args, { stdio: 'inherit', env });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

// 1) Local Postgres up.
if (process.env.SKIP_DB_UP !== '1') {
  const exists =
    execSync(`docker ps -a --filter name=^/${NAME}$ --format '{{.Names}}'`, { env })
      .toString()
      .trim() === NAME;
  if (!exists) {
    sh(
      `docker run -d --name ${NAME} -e POSTGRES_USER=consultinity -e POSTGRES_PASSWORD=consultinity -e POSTGRES_DB=consultinity -p ${PORT}:5432 pgvector/pgvector:pg16`
    );
  } else {
    sh(`docker start ${NAME}`);
  }
  // Wait for healthy.
  let ready = false;
  for (let i = 0; i < 40; i++) {
    const r = spawnSync('docker', ['exec', NAME, 'pg_isready', '-U', 'consultinity'], { env });
    if (r.status === 0) {
      ready = true;
      console.log(`[run] Postgres ready on :${PORT} after ${i}s`);
      break;
    }
    execSync('sleep 1');
  }
  if (!ready) {
    console.error('[run] Postgres did not become ready');
    process.exit(1);
  }
}

// 2) Full schema.
run('node', ['tests/acceptance/schema.mjs']);

// 3) Seed.
run('node', ['tests/acceptance/seed.mjs']);

// 4) E2E.
run('npx', ['vitest', 'run', '--config', 'vitest.acceptance.config.ts']);

console.log('\n[run] Acceptance harness complete.');
