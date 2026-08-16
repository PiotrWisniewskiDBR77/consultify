#!/usr/bin/env node

import { readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const suite = process.argv[2];
if (!['consumer', 'provider'].includes(suite)) {
  console.error('Usage: node scripts/testing/run-contract-tests.mjs <consumer|provider>');
  process.exit(2);
}

const root = resolve(process.cwd());
const searchRoot = resolve(root, suite === 'consumer' ? 'tests/unit' : 'tests/integration');
const matchesContractFile = (name) =>
  /(?:\.contract|-contract|contract[^/]*)\.test\.[cm]?[jt]sx?$/.test(name);

function walk(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolute = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walk(absolute));
    else if (entry.isFile() && matchesContractFile(entry.name))
      files.push(relative(root, absolute));
  }
  return files;
}

const files = walk(searchRoot).sort();
if (files.length === 0) {
  console.error(`[contract:${suite}] discovery denominator is zero`);
  process.exit(1);
}

console.log(`[contract:${suite}] discovered ${files.length} files`);
const vitest = resolve(root, 'node_modules/vitest/vitest.mjs');
const failures = [];
const mountedServerContracts = new Set([
  'tests/integration/authMeDemoTtl.contract.test.ts',
  'tests/integration/buildSurfaceRemoved.contract.test.ts',
  'tests/integration/demoPublicEntry.contract.test.ts',
  'tests/integration/demoRealtimeDenial.contract.test.ts',
  'tests/integration/publicSystemSurface.contract.test.ts',
  'tests/integration/spaCatchAllDisclosure.contract.test.ts',
  'tests/integration/system/health.noChildProcess.contract.test.ts',
  'tests/integration/systemHealthRepairRemoved.contract.test.ts',
]);

// Contract tests frequently replace process.env, module mocks and singleton
// state.  A single Vitest process made later files depend on discovery order.
// Run every contract file in its own process so the published denominator is
// reproducible and a failure points at an actual contract, not leaked state.
for (const [index, file] of files.entries()) {
  console.log(`[contract:${suite}] ${index + 1}/${files.length} ${file}`);
  const env = { ...process.env };
  if (mountedServerContracts.has(file)) {
    // These contracts import the real mounted server, whose readiness path
    // intentionally touches PostgreSQL. Never let tests/setup.ts silently
    // invent the historical iris@localhost fallback: require an operator-owned
    // isolated database and make the real-DB intent explicit.
    if (!process.env.CONTRACT_DATABASE_URL) {
      console.error(
        `[contract:${suite}] ${file} requires CONTRACT_DATABASE_URL for its mounted-server fixture`
      );
      failures.push({ file, status: 2, error: 'CONTRACT_DATABASE_URL is not set' });
      continue;
    }
    env.DATABASE_URL = process.env.CONTRACT_DATABASE_URL;
    env.DB_TYPE = 'postgres';
    env.MOCK_DB = 'false';
    env.RUN_DB_TESTS = '1';
  }
  const result = spawnSync(
    process.execPath,
    [vitest, 'run', file, '--no-file-parallelism', '--maxWorkers=1', '--reporter=dot'],
    { cwd: root, env, stdio: 'inherit' }
  );

  if (result.error || result.status !== 0) {
    failures.push({ file, status: result.status ?? 1, error: result.error?.message });
  }
}

console.log(
  `[contract:${suite}] completed ${files.length - failures.length}/${files.length} files successfully`
);
if (failures.length > 0) {
  console.error(`[contract:${suite}] failed ${failures.length}/${files.length} files:`);
  for (const failure of failures) {
    console.error(`- ${failure.file} (exit ${failure.status})${failure.error ? `: ${failure.error}` : ''}`);
  }
  process.exit(1);
}
