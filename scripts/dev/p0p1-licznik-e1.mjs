#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const VERDICTS = Object.freeze([
  'NAPRAWIONE',
  'ZAMKNIETE_DEC',
  'ODLOZONE_DEC',
  'W_BUDOWIE',
  'BLOKUJE',
]);

export const DEFAULT_FLOOR = 100;
export const MARKER = '416432abaf';
export const SNAPSHOT_DATE = '2026-09-04';

const scriptDir = dirname(fileURLToPath(import.meta.url));
export const defaultRoot = resolve(scriptDir, '../..');

export const pathsFor = (root = defaultRoot) => ({
  settlement: resolve(root, 'docs/program/waves/WAVE_03_ACCEPTANCE/ROZLICZENIE_P0P1_20260903.md'),
  decisions: resolve(root, 'docs/program/waves/WAVE_03_ACCEPTANCE/ROZLICZENIE_P0P1_DECYZJE_20260903.md'),
  owner: resolve(root, 'docs/program/DECYZJE_WLASCICIELA_P0P1_20260904.md'),
  wave2: resolve(root, 'docs/program/FALA_2_PO_STAGINGU.md'),
  ledger: resolve(root, 'docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md'),
  output: resolve(root, 'docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_P0P1_BLOKUJACE_G20.md'),
});

function tableFirstCell(line) {
  if (!line.startsWith('|')) return '';
  return (line.split('|')[1] || '').replaceAll('`', '').replaceAll('**', '').trim();
}

export function expandIds(text) {
  const ids = new Set();
  const normalized = text.replaceAll('`', '');
  const grouped = /([A-Z][A-Z0-9-]*-)(\d{3}(?:\/\d{3})+)(\[OF\])?/g;
  for (const match of normalized.matchAll(grouped)) {
    for (const number of match[2].split('/')) ids.add(`${match[1]}${number}${match[3] || ''}`);
  }
  const direct = /\b[A-Z][A-Z0-9-]*-\d{3}(?:\[OF\])?/g;
  for (const match of normalized.matchAll(direct)) ids.add(match[0]);
  return [...ids];
}

export function collectUniverse(settlement, decisions) {
  const positions = new Map();
  for (const line of settlement.split('\n')) {
    const cell = tableFirstCell(line);
    for (const id of expandIds(cell)) positions.set(id, { id, evidence: [line], origins: ['settlement'] });
  }
  const r1c = decisions.split(/^## R1c/m)[1]?.split(/^## /m)[0] || '';
  for (const line of r1c.split('\n')) {
    const cell = tableFirstCell(line);
    for (const id of expandIds(cell)) {
      if (!id.endsWith('[OF]') && !id.startsWith('TLS-')) continue;
      positions.set(id, { id, evidence: [line], origins: ['decisions-r1c'] });
    }
  }
  return positions;
}

function ledgerDecisions(ledger) {
  return new Set([...ledger.matchAll(/^\|\s*(DEC-\d{4}-\d{2}-\d{2}-\d+)\s*\|/gm)].map((m) => m[1]));
}

function addEvidence(positions, text, origin) {
  for (const line of text.split('\n')) {
    const ids = expandIds(line);
    for (const id of ids) {
      const position = positions.get(id);
      if (!position) continue;
      position.evidence.push(line);
      position.origins.push(origin);
    }
  }
}

function existingDecs(text, ledgerSet) {
  const cited = [...new Set(text.match(/DEC-\d{4}-\d{2}-\d{2}-\d+/g) || [])];
  const missing = cited.filter((dec) => !ledgerSet.has(dec));
  return { cited, missing };
}

export function gitShaState(root, sha) {
  try {
    execFileSync('git', ['cat-file', '-e', `${sha}^{commit}`], { cwd: root, stdio: 'ignore' });
  } catch {
    return 'SHA_NIEISTNIEJACY';
  }
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', sha, 'HEAD'], { cwd: root, stdio: 'ignore' });
    return 'OK';
  } catch {
    return 'SHA_NIE_JEST_PRZODKIEM_HEAD';
  }
}

function classify(position, ledgerSet, root, shaCheck = gitShaState) {
  const text = position.evidence.join('\n');
  const { cited, missing } = existingDecs(text, ledgerSet);
  if (missing.length) return { verdict: 'BLOKUJE', reason: `DEC_NIEISTNIEJACY:${missing.join(',')}`, proof: missing.join(', ') };

  const duty = text.match(/(?:dyżur|d[yY]żuru|Codex)\s*(?:nr\s*)?(\d{2,3})/i);
  if (/W_BUDOWIE|W BUDOWIE/i.test(text) && duty) {
    return { verdict: 'W_BUDOWIE', reason: `DYZUR_${duty[1]}`, proof: `dyżur ${duty[1]}` };
  }

  if (/NAPRAWIONE|FIXED_BROWSER_VERIFIED|TECHNICAL_PASS/i.test(text)) {
    const shas = [...new Set(text.match(/\b[0-9a-f]{10,40}\b/gi) || [])];
    if (!shas.length) return { verdict: 'BLOKUJE', reason: 'BRAK_SHA_DLA_NAPRAWIONE', proof: 'brak SHA' };
    const states = shas.map((sha) => [sha, shaCheck(root, sha)]);
    const valid = states.find(([, state]) => state === 'OK');
    if (valid) return { verdict: 'NAPRAWIONE', reason: 'SHA_OK', proof: valid[0] };
    return { verdict: 'BLOKUJE', reason: states[0][1], proof: states.map(([sha, state]) => `${sha}:${state}`).join(', ') };
  }

  if (cited.length) {
    const deferred = /ODŁOŻ|ODLOZ|FALA 2|PO BRAMKACH|POZA MVP|\bNIE\b|przeniesion/i.test(text);
    return { verdict: deferred ? 'ODLOZONE_DEC' : 'ZAMKNIETE_DEC', reason: 'DEC_OK', proof: cited.join(', ') };
  }
  return { verdict: 'BLOKUJE', reason: 'NIEROZSTRZYGNIETE', proof: 'brak SHA, DEC i numeru dyżuru' };
}

export function evaluateCorpus({ settlement, decisions, owner, wave2, ledger }, options = {}) {
  const floor = options.floor ?? DEFAULT_FLOOR;
  const root = options.root ?? defaultRoot;
  const positions = collectUniverse(settlement, decisions);
  if (positions.size < floor) throw new Error(`mianownik mniejszy niż spodziewany — parser zgubił źródło: ${positions.size} < ${floor}`);
  addEvidence(positions, decisions, 'decisions');
  addEvidence(positions, owner, 'owner');
  addEvidence(positions, wave2, 'wave2');
  const ledgerSet = ledgerDecisions(ledger);
  return [...positions.values()].sort((a, b) => a.id.localeCompare(b.id, 'en')).map((position) => ({
    id: position.id,
    ...classify(position, ledgerSet, root, options.shaCheck),
    origins: [...new Set(position.origins)].join(', '),
  }));
}

export function renderRegister(rows) {
  const blockers = rows.filter((row) => row.verdict === 'BLOKUJE').length;
  const counts = Object.fromEntries(VERDICTS.map((verdict) => [verdict, rows.filter((row) => row.verdict === verdict).length]));
  const lines = [
    '# Rejestr P0/P1 blokujących G20 — E1',
    '',
    `Data migawki: ${SNAPSHOT_DATE}  `,
    `Marker: \`${MARKER}\`  `,
    'Odtworzenie: `node scripts/dev/p0p1-licznik-e1.mjs`',
    '',
    `Mianownik: ${rows.length}. NAPRAWIONE: ${counts.NAPRAWIONE}; ZAMKNIETE_DEC: ${counts.ZAMKNIETE_DEC}; ODLOZONE_DEC: ${counts.ODLOZONE_DEC}; W_BUDOWIE: ${counts.W_BUDOWIE}.`,
    '',
    `**BLOKUJE: ${blockers}**`,
    '',
    '| ID | Werdykt | Powód | Dowód | Źródła |',
    '|---|---|---|---|---|',
    ...rows.map((row) => `| \`${row.id}\` | ${row.verdict} | ${row.reason} | ${row.proof.replaceAll('|', '\\|')} | ${row.origins} |`),
    '',
  ];
  return lines.join('\n');
}

export function run(root = defaultRoot, options = {}) {
  const paths = pathsFor(root);
  const corpus = Object.fromEntries(['settlement', 'decisions', 'owner', 'wave2', 'ledger'].map((key) => [key, readFileSync(paths[key], 'utf8')]));
  const rows = evaluateCorpus(corpus, { ...options, root });
  const markdown = renderRegister(rows);
  if (options.write !== false) writeFileSync(paths.output, markdown);
  return { rows, markdown, output: paths.output };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = run();
  process.stdout.write(result.markdown);
}
