#!/usr/bin/env node

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const WAVE = join(ROOT, 'docs/program/waves/WAVE_03_ACCEPTANCE');
const MODULES = join(WAVE, 'modules');
const MASTER = join(WAVE, 'MASTER_STATUS_REGISTER.md');

export const EXPECTED = [
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

export const REQUIRED_SECTIONS = [
  '## Contract',
  '## G00–G20 checklist',
  '## Piotr review card',
  '## Persona and fixture ledger',
  '## Owner UI/UX/CX register',
  '## Implementation/regression ledger',
  '## Owner verdict',
];

const OWNER_REGISTER_SECTION = '## Owner UI/UX/CX register';
// A row whose Finding ID column is a condensed span such as `MYW-IDEAS-003..015`
// silently swallows every atom in the span (015-003+1 = 13 owner findings collapsed
// into one row). scripts/wave3/verify-acceptance-packages.mjs previously validated
// only document structure (headers/gates), so a condensation like this passed the
// gate while quietly dropping atoms out of the register denominator. A range row is
// still permitted, but only carrying the literal token `RANGE_ROW_ACKNOWLEDGED`
// somewhere on the same row, so the condensation is a visible, deliberate choice
// rather than a silent loss.
const RANGE_ROW_ID = /^\|\s*`([A-Za-z][A-Za-z0-9_-]*)-(\d+)\.\.(\d+)`/;
const RANGE_ROW_ACK_TOKEN = 'RANGE_ROW_ACKNOWLEDGED';

/**
 * Scan a module's MODULE_ACCEPTANCE.md text for range-style Finding ID rows
 * inside the "## Owner UI/UX/CX register" table that lack an explicit
 * acknowledgement token. Exported so this can be unit tested against
 * synthetic fixtures without spawning the CLI or touching the real docs tree.
 *
 * @param {string} text full MODULE_ACCEPTANCE.md contents
 * @returns {Array<{id: string, from: number, to: number, count: number}>}
 */
export function findUnannotatedRangeRows(text) {
  const lines = text.split('\n');
  const offenders = [];
  let inSection = false;

  for (const line of lines) {
    if (line.startsWith('## ')) {
      inSection = line.trim() === OWNER_REGISTER_SECTION;
      continue;
    }
    if (!inSection) continue;

    const match = line.match(RANGE_ROW_ID);
    if (!match) continue;

    const [, prefix, fromRaw, toRaw] = match;
    const from = Number(fromRaw);
    const to = Number(toRaw);
    if (line.includes(RANGE_ROW_ACK_TOKEN)) continue;

    offenders.push({
      id: `${prefix}-${fromRaw}..${toRaw}`,
      from,
      to,
      count: to - from + 1,
    });
  }

  return offenders;
}

function runVerification() {
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

    for (const offender of findUnannotatedRangeRows(text)) {
      fail(
        `${directory}: Owner UI/UX/CX register row \`${offender.id}\` condenses ${offender.count} owner findings ` +
          `into one row without a \`${RANGE_ROW_ACK_TOKEN}\` annotation; spell out each atom as its own row or add ` +
          'the explicit annotation to the row'
      );
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
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  runVerification();
}
