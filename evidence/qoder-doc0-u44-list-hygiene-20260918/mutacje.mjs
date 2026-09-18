#!/usr/bin/env node
/**
 * Dowód mutacyjny — DOC-0 / U-44 higiena listy Materiały → Dokumenty.
 *
 * Przyrząd: jedna delta (materialsListHygiene.u44.test.tsx, 13 testów). CONTROL
 * na czystym kodzie MUSI być zielony i uruchomić DOKŁADNIE 13 testów — inaczej
 * „GREEN z 0 testów" udawałby ważny pomiar (pułapka z Wpisu 121/etap E).
 * Każda mutacja cofa JEDNĄ naprawę; oczekujemy RED z przypisywalnym licznikiem.
 * Po każdej mutacji plik jest odtwarzany z kopii i weryfikowany co do sha256.
 *
 * Uruchomienie: node evidence/qoder-doc0-u44-list-hygiene-20260918/mutacje.mjs
 */
import { execFileSync } from 'node:child_process';
import { copyFileSync, readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '../..');
const SUITE = 'src/components/ReportsAndPresentations/__tests__/materialsListHygiene.u44.test.tsx';
const EXPECTED_TESTS = 13;
const ANSI = /\u001b\[[0-9;]*m/g;

const EN = 'public/locales/en/translation.json';
const PL = 'public/locales/pl/translation.json';
const AGG = 'src/components/ReportsAndPresentations/OutputsAggregateTabContent.tsx';
const RAP = 'src/components/ReportsAndPresentations/useRapData.ts';
const PREZ = 'src/components/ReportsAndPresentations/PresentationsTabContent.tsx';

function sha(file) {
  return createHash('sha256').update(readFileSync(path.join(ROOT, file))).digest('hex');
}

function lastNumber(text, pattern) {
  let value = null;
  for (const match of text.matchAll(pattern)) value = Number(match[1]);
  return value;
}

function runSuite() {
  let raw = '';
  let crashed = false;
  try {
    raw = execFileSync(
      'npx',
      ['vitest', 'run', SUITE, '--retry=0'],
      { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' } }
    );
  } catch (err) {
    crashed = true;
    raw = `${err.stdout || ''}${err.stderr || ''}`;
  }
  const text = raw.replace(ANSI, '');
  const instrumented = /Test Files/.test(text);
  const failedTests = lastNumber(text, /Tests\s+(\d+) failed/g) ?? 0;
  const ranTests = lastNumber(text, /Tests\s+(?:\d+ failed \| )?(\d+) passed/g) ?? 0;
  const red = failedTests > 0 || (instrumented && ranTests === 0);
  return { broken: !instrumented, crashed, red, failedTests, ranTests };
}

// ── Mutacje: każda cofa dokładnie jedną naprawę ────────────────────────
const MUTACJE = [
  {
    id: 'M1',
    co: 'rap.columns.title EN z powrotem „Presentation" (zła etykieta kolumny tytułu)',
    plik: EN,
    edycje: [
      [
        `"columns": {\n      "name": "Name",\n      "title": "Title",`,
        `"columns": {\n      "name": "Name",\n      "title": "Presentation",`,
      ],
    ],
  },
  {
    id: 'M2',
    co: 'formatSourceSummary bez SOURCE_RUNTIME_LABEL_KEYS (surowy kod silnika w SOURCE)',
    plik: AGG,
    edycje: [
      [
        `    const key = SOURCE_RUNTIME_LABEL_KEYS[row.sourceType];\n    parts.push(key ? t(key, formatLabel(row.sourceType)) : formatLabel(row.sourceType));`,
        `    parts.push(formatLabel(row.sourceType));`,
      ],
    ],
  },
  {
    id: 'M3',
    co: 'gałąź dokumentowa useRapData nie niesie sourceType (SOURCE znowu „—")',
    plik: RAP,
    edycje: [[`      reportType: r.reportType,\n      sourceType: r.sourceType,\n`, `      reportType: r.reportType,\n`]],
  },
  {
    id: 'M4',
    co: 'usunięty PL klucz rap.outputs.source.runtime.native_artifact (złamany parytet EN/PL)',
    plik: PL,
    edycje: [[`          "native_artifact": "Studio Dokumentów",\n`, ``]],
  },
  {
    id: 'M5',
    co: 'PresentationsTabContent:514 z powrotem pożycza rap.columns.title jako zamienny tytuł',
    plik: PREZ,
    edycje: [
      [
        `t('rap.preview.untitledPresentation', 'Presentation')`,
        `t('rap.columns.title', 'Presentation')`,
      ],
    ],
  },
];

const TMP = mkdtempSync(path.join(tmpdir(), 'u44-mut-'));
const lines = [];
function log(s) {
  lines.push(s);
  console.log(s);
}

log(`# Dowód mutacyjny — DOC-0 / U-44 (${new Date().toISOString()})`);
log(`# delta: ${SUITE} · oczekiwane testy: ${EXPECTED_TESTS}`);

// ── CONTROL na czystym kodzie ─────────────────────────────────────────
const ctrl = runSuite();
log(`\nCONTROL: ${ctrl.broken ? 'BROKEN INSTRUMENT' : ctrl.red ? `RED ${ctrl.failedTests}/${ctrl.ranTests}` : `GREEN ${ctrl.ranTests} testów`}`);
if (ctrl.broken || ctrl.red || ctrl.ranTests !== EXPECTED_TESTS) {
  log(`# PRZERWANE: przyrząd nie dał czystego CONTROL (${EXPECTED_TESTS} green). Nie mierzę mutacji na zepsutym przyrządzie.`);
  writeFileSync(path.join(ROOT, 'evidence/qoder-doc0-u44-list-hygiene-20260918/mutacje.log'), lines.join('\n') + '\n');
  process.exit(1);
}

const suma = { RED: 0, GREEN: 0, SKIP: 0, BROKEN: 0 };
for (const m of MUTACJE) {
  const abs = path.join(ROOT, m.plik);
  const backup = path.join(TMP, path.basename(m.plik) + '.' + m.id);
  copyFileSync(abs, backup);
  const pristine = sha(m.plik);
  let tekst = readFileSync(abs, 'utf8');
  let applied = true;
  for (const [from, to] of m.edycje) {
    if (!tekst.includes(from)) {
      applied = false;
      break;
    }
    tekst = tekst.replace(from, to);
  }
  if (!applied) {
    log(`\n${m.id} [${m.plik}] — ${m.co}\n  SKIP: wzorzec nieznaleziony (mutacja niezaładowana)`);
    suma.SKIP++;
    copyFileSync(backup, abs);
    continue;
  }
  writeFileSync(abs, tekst);
  const run = runSuite();
  copyFileSync(backup, abs);
  const restored = sha(m.plik) === pristine;
  const result = run.broken
    ? 'BROKEN INSTRUMENT'
    : run.red
      ? `RED (${run.failedTests} czerwonych z ${run.ranTests} uruchomionych)`
      : `GREEN!!! (${run.ranTests} uruchomionych — mutacja NIE złapana)`;
  if (run.broken) suma.BROKEN++;
  else if (run.red) suma.RED++;
  else suma.GREEN++;
  log(`\n${m.id} [${m.plik}] — ${m.co}\n  ${result} · restored=${restored ? 'tak' : 'NIE'}`);
}

log(`\n# SUMA: RED=${suma.RED} GREEN=${suma.GREEN} SKIP=${suma.SKIP} BROKEN=${suma.BROKEN} (oczekiwane: RED=${MUTACJE.length}, reszta 0)`);
writeFileSync(path.join(ROOT, 'evidence/qoder-doc0-u44-list-hygiene-20260918/mutacje.log'), lines.join('\n') + '\n');
