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

// Contract tests frequently replace process.env, module mocks and singleton
// state.  A single Vitest process made later files depend on discovery order.
// Run every contract file in its own process so the published denominator is
// reproducible and a failure points at an actual contract, not leaked state.
for (const [index, file] of files.entries()) {
  console.log(`[contract:${suite}] ${index + 1}/${files.length} ${file}`);
  const result = spawnSync(
    process.execPath,
    [vitest, 'run', file, '--no-file-parallelism', '--maxWorkers=1', '--reporter=dot'],
    { cwd: root, env: process.env, stdio: 'inherit' }
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
