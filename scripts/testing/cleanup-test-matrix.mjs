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

const run = (args) => {
  const result = spawnSync('npx', ['vitest', 'run', ...args], {
    cwd: root,
    env: process.env,
    stdio: 'inherit'
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
    '--no-file-parallelism', '--retry=0', '--bail=5',
    ...matrix.standard.excludePatterns.flatMap((pattern) => ['--exclude', pattern]),
    ...matrix.standard.excludeFiles.flatMap((file) => ['--exclude', file])
  ];
  console.log(args.map((value) => JSON.stringify(value)).join(' '));
} else if (command === 'run-standard') {
  const args = [
    '--no-file-parallelism', '--retry=0', '--bail=5',
    ...matrix.standard.excludePatterns.flatMap((pattern) => ['--exclude', pattern]),
    ...matrix.standard.excludeFiles.flatMap((file) => ['--exclude', file])
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
