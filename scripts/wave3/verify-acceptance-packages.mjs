#!/usr/bin/env node

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const WAVE = join(ROOT, 'docs/program/waves/WAVE_03_ACCEPTANCE');
const MODULES = join(WAVE, 'modules');
const MASTER = join(WAVE, 'MASTER_STATUS_REGISTER.md');

const EXPECTED = [
  ['01_ORGANIZATION', 'ORG'],
  ['02_INTERVIEW', 'INT'],
  ['03_TOOLS', 'TLS'],
  ['04_ASSESSMENT', 'ASM'],
  ['05_INITIATIVES', 'INI'],
  ['06_EXECUTION', 'EXE'],
  ['07_MY_WORK_AGENT', 'MYW'],
  ['08_MEETINGS', 'MTG'],
  ['09_RESULTS', 'RES'],
  ['10_FINANCE', 'FIN'],
  ['11_MATERIALS', 'MAT'],
  ['12_AUDITS', 'AUD'],
  ['13_CHAT', 'CHAT'],
  ['14_ADMIN', 'ADM'],
  ['15_SETTINGS', 'SET'],
  ['16_PARTNER', 'PRT'],
];

const REQUIRED_SECTIONS = [
  '## Contract',
  '## G00–G20 checklist',
  '## Piotr review card',
  '## Persona and fixture ledger',
  '## Owner UI/UX/CX register',
  '## Implementation/regression ledger',
  '## Owner verdict',
];

const errors = [];
const fail = (message) => errors.push(message);
const count = (text, pattern) => [...text.matchAll(pattern)].length;

const actualDirectories = readdirSync(MODULES)
  .filter((name) => statSync(join(MODULES, name)).isDirectory())
  .sort();
const expectedDirectories = EXPECTED.map(([directory]) => directory);
if (JSON.stringify(actualDirectories) !== JSON.stringify(expectedDirectories)) {
  fail(`module directories differ: expected ${expectedDirectories.join(', ')}, found ${actualDirectories.join(', ')}`);
}

for (const [directory, id] of EXPECTED) {
  const packagePath = join(MODULES, directory, 'MODULE_ACCEPTANCE.md');
  let text;
  try {
    text = readFileSync(packagePath, 'utf8');
  } catch (error) {
    fail(`${directory}: missing MODULE_ACCEPTANCE.md (${error.message})`);
    continue;
  }

  if (!text.includes(`ID: \`${id}\``)) fail(`${directory}: expected ID ${id}`);
  if (!text.includes('Mobile: `DEFERRED_NON_GATING`')) {
    fail(`${directory}: mobile must be DEFERRED_NON_GATING`);
  }
  for (const section of REQUIRED_SECTIONS) {
    if (!text.includes(section)) fail(`${directory}: missing section ${section}`);
  }
  for (let gate = 0; gate <= 20; gate += 1) {
    const gateId = `G${String(gate).padStart(2, '0')}`;
    const occurrences = count(text, new RegExp(`^\\|\\s*${gateId}\\s*\\|`, 'gm'));
    if (occurrences !== 1) fail(`${directory}: ${gateId} occurs ${occurrences} times, expected 1`);
  }
}

const master = readFileSync(MASTER, 'utf8');
for (const [directory, id] of EXPECTED) {
  const order = Number(directory.slice(0, 2));
  const occurrences = count(master, new RegExp(`^\\|\\s*${order}\\s*\\|\\s*\\\`${id}\\\`\\s*\\|`, 'gm'));
  if (occurrences !== 1) fail(`master: ${id} row occurs ${occurrences} times, expected 1`);
}

if (errors.length) {
  for (const error of errors) process.stderr.write(`WAVE3_PACKAGE_ERROR: ${error}\n`);
  process.exit(1);
}

process.stdout.write(
  JSON.stringify(
    {
      ok: true,
      modules: EXPECTED.length,
      gatesPerModule: 21,
      mobile: 'DEFERRED_NON_GATING',
      masterRows: EXPECTED.length,
    },
    null,
    2
  ) + '\n'
);
