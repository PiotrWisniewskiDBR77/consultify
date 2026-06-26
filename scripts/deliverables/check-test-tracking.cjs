/**
 * W13.8 — CI guard: wszystkie tests/unit/deliverables/*.test.ts muszą być w git.
 *
 * Chroni przed cichym pominięciem nowych testów przez .gitignore:209 (/tests/).
 * Każdy nowy plik spec MUSI być dodany przez `git add -f`.
 *
 * Użycie:
 *   node scripts/deliverables/check-test-tracking.cjs
 *   npm run test:deliverables:tracked
 */

'use strict';

const { execSync } = require('child_process');
const { readdirSync } = require('fs');
const { join } = require('path');

const ROOT = join(__dirname, '../..');
const TEST_DIR = 'tests/unit/deliverables';
const FULL_DIR = join(ROOT, TEST_DIR);

let testFiles;
try {
  testFiles = readdirSync(FULL_DIR)
    .filter((f) => f.endsWith('.test.ts') || f.endsWith('.test.js'))
    .map((f) => `${TEST_DIR}/${f}`);
} catch {
  console.error(`[check-test-tracking] Katalog ${TEST_DIR} nie istnieje.`);
  process.exit(1);
}

if (testFiles.length === 0) {
  console.warn('[check-test-tracking] Brak plików testowych w katalogu — pomiń.');
  process.exit(0);
}

const untracked = [];

for (const relPath of testFiles) {
  try {
    execSync(`git ls-files --error-unmatch "${relPath}"`, {
      cwd: ROOT,
      stdio: 'pipe',
    });
  } catch {
    untracked.push(relPath);
  }
}

if (untracked.length > 0) {
  console.error('');
  console.error('[check-test-tracking] BŁĄD — poniższe pliki testów NIE są śledzone przez git:');
  for (const f of untracked) {
    console.error(`  ✗ ${f}`);
  }
  console.error('');
  console.error('  Napraw: git add -f ' + untracked.join(' '));
  console.error('  Powód:  .gitignore:209 zawiera /tests/ i cicho pomija nowe .ts');
  console.error('');
  process.exit(1);
}

console.log(`[check-test-tracking] OK — ${testFiles.length} plików testowych w git (${TEST_DIR}).`);
process.exit(0);
