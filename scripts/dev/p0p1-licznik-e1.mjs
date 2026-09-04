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

// Audyt R6 dyżuru 320 rozstrzyga wyłącznie dwanaście zastanych pozycji
// BRAK_SHA_DLA_NAPRAWIONE. Źródła właściciela pozostają bez zmian; tabela
// utrwala znaleziony commit albo uczciwy brak jednoznacznego SHA naprawy.
export const DAY320_RESOLUTIONS = Object.freeze({
  'ASM-OWN-001': { type: 'UNRESOLVED', detail: 'DEC-2026-09-03-367 nakazuje realizację TERAZ, ale brak SHA wykonania biblioteki metodyk' },
  'ASM-OWN-002': { type: 'UNRESOLVED', detail: 'DEC-2026-09-03-367 nakazuje realizację TERAZ, ale brak SHA zmiany kolumn katalogu' },
  'ASM-OWN-003': { type: 'DECISION', decision: 'DEC-2026-09-03-364' },
  'ASM-OWN-024[OF]': { type: 'DECISION', decision: 'DEC-2026-08-28-151' },
  'EXE-OWN-001': { type: 'DECISION', decision: 'DEC-2026-08-24-03' },
  'EXE-OWN-003': { type: 'UNRESOLVED', detail: 'brak odzyskanego lokalnego seeda i SHA danych przeglądowych Execution' },
  'EXE-OWN-005': { type: 'UNRESOLVED', detail: 'brak SHA pending checkpoint z nawigacją Menu 3 i powrotem do listy' },
  'EXE-OWN-006': { type: 'SHA', sha: 'b470536a91' },
  'EXE-OWN-007': { type: 'SHA', sha: 'b470536a91' },
  'FIN-OWN-001': { type: 'UNRESOLVED', detail: 'runtime d8561ed5c2 nie jest jednoznacznym SHA naprawy' },
  'INI-OWN-001': { type: 'UNRESOLVED', detail: 'brak kompletnej fikstury 11 inicjatyw i dowodu przeglądarkowego jej pól lifecycle' },
  'INT-INIT-AI-OBS-001': { type: 'UNRESOLVED', detail: 'brak osiągalnego wołacza fill-section i dowodu z realnym providerem AI' },
  'MYW-CAL-REC-002': { type: 'UNRESOLVED', detail: 'decyzje wyznaczają kierunek, ale brak SHA rozszerzenia schematu spotkania' },
  'MYW-CAL-REC-003': { type: 'UNRESOLVED', detail: 'DEC-222 pozostawia wdrożenie otwarte; brak SHA UI dołączania artefaktu' },
  'MYW-CV-REC-001': { type: 'SHA', sha: 'af75a84e37' },
  'MYW-CV-REC-002': { type: 'UNRESOLVED', detail: 'źródło opisuje stan istniejący bez SHA naprawy' },
  'MYW-DEC-REC-001': { type: 'SHA', sha: '4a36e8a745' },
  'MYW-IDEA-REC-001': { type: 'SHA', sha: '655d629675' },
  'MYW-IDEAS-010': { type: 'SHA', sha: 'a995ca4c20' },
  'MYWORK-DEC-OWN-001': { type: 'SHA', sha: '4a36e8a745' },
  'RES-OWN-004': { type: 'UNRESOLVED', detail: 'źródło mówi pre-existing bez SHA naprawy' },
  'RES-OWN-003': { type: 'UNRESOLVED', detail: 'brak licencjonowanego writera i cold readbacku 4 KPI / 3 OKR / 3 ROI z PostgreSQL' },
  'TLS-CHAIN-OWN-001': { type: 'DECISION', decision: 'DEC-2026-08-28-238' },
  'TLS-MENU-OWN-001': { type: 'DECISION', decision: 'DEC-2026-08-28-238' },
  'TLS-REC-OWN-001': { type: 'DECISION', decision: 'DEC-2026-08-28-238' },
});

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
    for (const id of expandIds(cell)) positions.set(id, { id, evidence: [line], directEvidence: [line], inheritedDecisions: [], origins: ['settlement'] });
  }
  const r1c = decisions.split(/^## R1c/m)[1]?.split(/^## /m)[0] || '';
  for (const line of r1c.split('\n')) {
    const cell = tableFirstCell(line);
    for (const id of expandIds(cell)) {
      if (!id.endsWith('[OF]') && !id.startsWith('TLS-')) continue;
      positions.set(id, { id, evidence: [line], directEvidence: [line], inheritedDecisions: [], origins: ['decisions-r1c'] });
    }
  }
  return positions;
}

function ledgerDecisions(ledger) {
  return new Set([...ledger.matchAll(/^\|\s*(DEC-\d{4}-\d{2}-\d{2}-\d+)\s*\|/gm)].map((m) => m[1]));
}

function evidenceId(positions, id, origin) {
  if ((origin === 'owner' || origin === 'wave2') && id.startsWith('ASM-OWN-') && positions.has(`${id}[OF]`)) {
    return `${id}[OF]`;
  }
  return id;
}

function addEvidence(positions, text, origin, inheritance = null) {
  for (const line of text.split('\n')) {
    const ids = expandIds(line);
    for (const rawId of ids) {
      const id = evidenceId(positions, rawId, origin);
      const position = positions.get(id);
      if (!position) continue;
      position.evidence.push(line);
      position.directEvidence.push(inheritance ? inheritance.originalLine : line);
      if (inheritance && !/DEC-\d{4}-\d{2}-\d{2}-\d+/.test(inheritance.originalLine)) {
        position.inheritedDecisions.push({ family: inheritance.family, decision: inheritance.decision });
      }
      position.origins.push(origin);
    }
  }
}

// Pozycja bez własnego cytatu DEC dziedziczy decyzję rodziny `## R-N.`.
// Pakiet właściciela ustanawia decyzję na poziomie rodziny, a kolejne wiersze
// wyliczają obiekty objęte tą decyzją; dziedziczenie zachowuje tę jawną relację.
function addOwnerEvidence(positions, owner) {
  const familyDec = new Map();
  for (const line of owner.split('\n')) {
    const family = line.match(/^\|\s*(R-\d+)\b/);
    const dec = line.match(/DEC-\d{4}-\d{2}-\d{2}-\d+/);
    if (family && dec) familyDec.set(family[1], dec[0]);
  }
  let activeFamily = '';
  for (const line of owner.split('\n')) {
    const heading = line.match(/^##\s+(R-\d+)\./);
    if (heading) activeFamily = heading[1];
    const inherited = familyDec.get(activeFamily);
    addEvidence(
      positions,
      inherited ? `${line} ${inherited}` : line,
      'owner',
      inherited ? { family: activeFamily, decision: inherited, originalLine: line } : null,
    );
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

  const resolution = DAY320_RESOLUTIONS[position.id];
  if (resolution?.type === 'DECISION') {
    if (!ledgerSet.has(resolution.decision)) {
      return { verdict: 'BLOKUJE', reason: `DEC_NIEISTNIEJACY:${resolution.decision}`, proof: resolution.decision };
    }
    return { verdict: 'ZAMKNIETE_DEC', reason: 'DEC_OK', proof: resolution.decision };
  }
  if (resolution?.type === 'SHA') {
    const state = shaCheck(root, resolution.sha);
    return state === 'OK'
      ? { verdict: 'NAPRAWIONE', reason: 'SHA_OK', proof: resolution.sha }
      : { verdict: 'BLOKUJE', reason: state, proof: `${resolution.sha}:${state}` };
  }
  if (resolution?.type === 'UNRESOLVED') {
    return { verdict: 'BLOKUJE', reason: 'NIEROZSTRZYGNIETE', proof: resolution.detail };
  }

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
  addOwnerEvidence(positions, owner);
  addEvidence(positions, wave2, 'wave2');
  const ledgerSet = ledgerDecisions(ledger);
  return [...positions.values()].sort((a, b) => a.id.localeCompare(b.id, 'en')).map((position) => {
    const classification = classify(position, ledgerSet, root, options.shaCheck);
    const directDecisions = existingDecs(position.directEvidence.join('\n'), ledgerSet).cited;
    const inherited = position.inheritedDecisions.find(({ decision }) => classification.proof.includes(decision));
    return {
      id: position.id,
      ...classification,
      inheritance: directDecisions.length === 0 && inherited ? `${inherited.family} → ${inherited.decision}` : '—',
      origins: [...new Set(position.origins)].join(', '),
    };
  });
}

export function defaultSnapshotMetadata(root = defaultRoot) {
  return {
    marker: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
    snapshotDate: new Date().toISOString().slice(0, 10),
  };
}

export function parseCliArgs(args) {
  const options = { informational: false };
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--informational') {
      options.informational = true;
    } else if (argument === '--marker' || argument === '--snapshot-date') {
      const value = args[index + 1];
      if (!value || value.startsWith('--')) throw new Error(`brak wartości dla ${argument}`);
      options[argument === '--marker' ? 'marker' : 'snapshotDate'] = value;
      index += 1;
    } else {
      throw new Error(`nieznany argument: ${argument}`);
    }
  }
  return options;
}

export function renderRegister(rows, metadata) {
  const blockers = rows.filter((row) => row.verdict === 'BLOKUJE').length;
  const counts = Object.fromEntries(VERDICTS.map((verdict) => [verdict, rows.filter((row) => row.verdict === verdict).length]));
  const lines = [
    '# Rejestr P0/P1 blokujących G20 — E1',
    '',
    `Data migawki: ${metadata.snapshotDate}`,
    `Marker: \`${metadata.marker}\``,
    `Odtworzenie: \`node scripts/dev/p0p1-licznik-e1.mjs --marker ${metadata.marker} --snapshot-date ${metadata.snapshotDate}\``,
    '',
    `Mianownik: ${rows.length}. NAPRAWIONE: ${counts.NAPRAWIONE}; ZAMKNIETE_DEC: ${counts.ZAMKNIETE_DEC}; ODLOZONE_DEC: ${counts.ODLOZONE_DEC}; W_BUDOWIE: ${counts.W_BUDOWIE}.`,
    '',
    `**BLOKUJE: ${blockers}**`,
    '',
    '| ID | Werdykt | Powód | Dowód | Dziedziczenie DEC | Źródła |',
    '|---|---|---|---|---|---|',
    ...rows.map((row) => `| \`${row.id}\` | ${row.verdict} | ${row.reason} | ${row.proof.replaceAll('|', '\\|')} | ${row.inheritance || '—'} | ${row.origins} |`),
    '',
  ];
  return lines.join('\n');
}

export function run(root = defaultRoot, options = {}) {
  const paths = pathsFor(root);
  const corpus = Object.fromEntries(['settlement', 'decisions', 'owner', 'wave2', 'ledger'].map((key) => [key, readFileSync(paths[key], 'utf8')]));
  const rows = evaluateCorpus(corpus, { ...options, root });
  const defaults = defaultSnapshotMetadata(root);
  const metadata = {
    marker: options.marker ?? defaults.marker,
    snapshotDate: options.snapshotDate ?? defaults.snapshotDate,
  };
  const markdown = renderRegister(rows, metadata);
  if (options.write !== false) writeFileSync(paths.output, markdown);
  return { rows, markdown, output: paths.output };
}

export function gateResult(rows, output, { informational = false } = {}) {
  const blockers = rows.filter((row) => row.verdict === 'BLOKUJE').length;
  return {
    exitCode: blockers > 0 && !informational ? 1 : 0,
    message: blockers > 0
      ? `BLOKUJE: ${blockers}. Rejestr: ${output}\n`
      : `BLOKUJE: 0. Rejestr: ${output}\n`,
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const cliOptions = parseCliArgs(process.argv.slice(2));
  const result = run(defaultRoot, cliOptions);
  process.stdout.write(result.markdown);
  const gate = gateResult(result.rows, result.output, { informational: cliOptions.informational });
  process.stderr.write(gate.message);
  process.exitCode = gate.exitCode;
}
