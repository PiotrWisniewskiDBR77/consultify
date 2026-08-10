#!/usr/bin/env node
/**
 * ledger-report.mjs
 *
 * Parser rejestrow odbioru Case Workspace (docs/product/case-workspace/acceptance/*.csv).
 *
 * Co robi:
 *   1. Wczytuje WSZYSTKIE pliki *.csv w docs/product/case-workspace/acceptance/.
 *   2. Dla kazdego pliku liczy: liczbe wierszy, surowy rozklad statusow,
 *      oraz rozklad statusow liczony WYLACZNIE po wierszach EFEKTYWNYCH
 *      (append-only: wiersz, ktory zostal wskazany jako "supersedes_row_id"
 *      przez inny wiersz, jest STARA wersja i nie liczy sie do rozkladu;
 *      rozwiazywanie lancucha dziala dla dowolnej glebokosci, np. X -> X-U1 -> X-U3,
 *      bo efektywny jest kazdy wiersz, ktorego row_id NIE pojawia sie jako
 *      cel supersedes_row_id zadnego innego wiersza w tym samym pliku).
 *   3. Liczy laczny (cross-file) rozklad statusow po wierszach efektywnych.
 *   4. Wypisuje liste wierszy efektywnych bez dowodu (pusty test_ref LUB pusty
 *      evidence_ref) — takie wiersze nie moga byc PASS/IMPLEMENTED_AND_PROVEN.
 *   5. Wykrywa niespojnosc: wiersz oznaczony jako udowodniony
 *      (status IMPLEMENTED_AND_PROVEN lub PASS), ktorego test_ref:
 *        a) jest pusty,
 *        b) jest sentinelem/opisem bez konkretnej sciezki (np. literalne "PENDING",
 *           albo tekst opisowy typu "LIVE-U4 browser run (...)" bez sciezki pliku),
 *        c) wskazuje na plik, ktory FIZYCZNIE NIE ISTNIEJE w repo (sprawdzone
 *           wzgledem korzenia repo; dla golych nazw plikow bez "/" dodatkowo
 *           przeszukuje repo po basename, zeby nie dawac falszywych alarmow).
 *
 * Uzycie:
 *   node scripts/case-workspace/ledger-report.mjs
 *   node scripts/case-workspace/ledger-report.mjs --out docs/product/case-workspace/acceptance/LEDGER_SNAPSHOT.md
 *   node scripts/case-workspace/ledger-report.mjs --json   (dodatkowo wypisuje pelny JSON na stdout)
 *
 * Domyslnie zapisuje raport Markdown do
 *   docs/product/case-workspace/acceptance/LEDGER_SNAPSHOT.md
 * i drukuje skrocone podsumowanie na stdout.
 *
 * WAZNE: liczby w tym narzedziu wynikaja WYLACZNIE z parsowania CSV i sprawdzania
 * systemu plikow — zero recznego wpisywania liczb. Skrypt nie modyfikuje zadnego
 * pliku *.csv (rejestry naleza do innych agentow — ten skrypt tylko czyta).
 */

import { readFileSync, writeFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { join, relative, resolve, basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..', '..');
const args = process.argv.slice(2);
const dirIdx = args.indexOf('--dir');
const ACCEPTANCE_DIR = dirIdx !== -1 && args[dirIdx + 1]
  ? resolve(process.cwd(), args[dirIdx + 1])
  : join(REPO_ROOT, 'docs', 'product', 'case-workspace', 'acceptance');

const outIdx = args.indexOf('--out');
const OUT_PATH = outIdx !== -1 && args[outIdx + 1]
  ? resolve(process.cwd(), args[outIdx + 1])
  : join(ACCEPTANCE_DIR, 'LEDGER_SNAPSHOT.md');
const EMIT_JSON = args.includes('--json');

const PROVEN_STATUSES = new Set(['IMPLEMENTED_AND_PROVEN', 'PASS']);

// ---------------------------------------------------------------------------
// RFC4180-ish CSV parser (handles quoted fields, embedded commas/newlines,
// "" escaped quotes). No external dependency on purpose (dev-only tool).
// ---------------------------------------------------------------------------
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  const n = text.length;

  function pushField() {
    row.push(field);
    field = '';
  }
  function pushRow() {
    pushField();
    rows.push(row);
    row = [];
  }

  while (i < n) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += c;
      i += 1;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (c === ',') {
      pushField();
      i += 1;
      continue;
    }
    if (c === '\r') {
      // handle \r\n and lone \r
      if (text[i + 1] === '\n') {
        i += 1;
      }
      pushRow();
      i += 1;
      continue;
    }
    if (c === '\n') {
      pushRow();
      i += 1;
      continue;
    }
    field += c;
    i += 1;
  }
  // last field/row (avoid trailing phantom row from trailing newline)
  if (field.length > 0 || row.length > 0) {
    pushRow();
  }
  // drop a fully-empty trailing row (common with trailing newline at EOF)
  while (rows.length && rows[rows.length - 1].length === 1 && rows[rows.length - 1][0] === '') {
    rows.pop();
  }
  return rows;
}

function parseCsvFile(path) {
  const text = readFileSync(path, 'utf8');
  const rawRows = parseCsv(text);
  if (rawRows.length === 0) return { fields: [], rows: [] };
  const fields = rawRows[0];
  const rows = rawRows.slice(1).map((r) => {
    const obj = {};
    fields.forEach((f, idx) => {
      obj[f] = r[idx] !== undefined ? r[idx] : '';
    });
    return obj;
  });
  return { fields, rows };
}

// ---------------------------------------------------------------------------
// Filesystem basename index (built lazily, only if needed for a bare filename
// test_ref). Excludes heavy/irrelevant dirs.
// ---------------------------------------------------------------------------
const EXCLUDED_DIRS = new Set(['.git', 'node_modules', 'dist', 'build', '.next', 'coverage']);
let basenameIndex = null;
function buildBasenameIndex() {
  const index = new Map();
  function walk(dir) {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (EXCLUDED_DIRS.has(entry.name)) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile()) {
        const rel = relative(REPO_ROOT, full);
        const list = index.get(entry.name) || [];
        list.push(rel);
        index.set(entry.name, list);
      }
    }
  }
  walk(REPO_ROOT);
  return index;
}
function getBasenameIndex() {
  if (!basenameIndex) basenameIndex = buildBasenameIndex();
  return basenameIndex;
}

// ---------------------------------------------------------------------------
// test_ref candidate extraction + classification
// ---------------------------------------------------------------------------
// Split on '|' but ONLY at paren-depth 0 — a "|" can legitimately occur
// *inside* a parenthetical annotation, e.g.
//   "foo.pg.test.ts (branch(es) NOT yet asserted: a.x|a.y)"
// splitting that naively on every '|' would fabricate a bogus second
// candidate "a.y)". Track paren depth instead.
function splitTopLevel(rawTestRef) {
  const segments = [];
  let depth = 0;
  let cur = '';
  for (const ch of rawTestRef) {
    if (ch === '(') depth += 1;
    if (ch === ')') depth = Math.max(0, depth - 1);
    if (ch === '|' && depth === 0) {
      segments.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  segments.push(cur);
  return segments;
}

function stripAnnotation(raw) {
  let p = raw.trim();
  const parenIdx = p.indexOf(' (');
  if (parenIdx !== -1) p = p.slice(0, parenIdx);
  p = p.replace(/:\d+(:\d+)?$/, '').trim();
  return p;
}

function looksLikeFileToken(s) {
  return /\.[A-Za-z0-9]{1,8}$/.test(s) || s.includes('/');
}

function splitCandidates(rawTestRef) {
  const out = [];
  for (const seg0 of splitTopLevel(rawTestRef)) {
    const seg = stripAnnotation(seg0);
    if (!seg) continue;
    if (seg.includes(', ')) {
      const subparts = seg.split(',').map((s) => s.trim()).filter(Boolean);
      if (subparts.length > 1 && subparts.every(looksLikeFileToken)) {
        out.push(...subparts);
        continue;
      }
    }
    out.push(seg);
  }
  return out;
}

// classify one candidate token -> { kind, resolvedPath }
// kind one of: sentinel_pending | descriptive_note | path_exists | path_missing
//              | basename_found | basename_missing
function classifyCandidate(token) {
  if (!token) return { kind: 'empty' };
  if (token.toUpperCase() === 'PENDING') return { kind: 'sentinel_pending' };
  const hasSlash = token.includes('/');
  const hasExt = /\.[A-Za-z0-9]{1,8}$/.test(token);
  if (!hasSlash && !hasExt) return { kind: 'descriptive_note' };
  if (hasSlash) {
    const full = resolve(REPO_ROOT, token);
    return existsSync(full)
      ? { kind: 'path_exists', resolvedPath: token }
      : { kind: 'path_missing', resolvedPath: token };
  }
  // bare filename, has extension, no slash -> basename search
  const idx = getBasenameIndex();
  const matches = idx.get(token) || [];
  return matches.length > 0
    ? { kind: 'basename_found', resolvedPath: matches[0] }
    : { kind: 'basename_missing', resolvedPath: token };
}

// ---------------------------------------------------------------------------
// Per-file analysis
// ---------------------------------------------------------------------------
function analyzeFile(csvPath) {
  const name = basename(csvPath);
  const { fields, rows } = parseCsvFile(csvPath);

  const hasStatus = fields.includes('status');
  const idField = fields.includes('row_id') ? 'row_id' : (fields.includes('requirement_id') ? 'requirement_id' : null);
  const hasSupersedes = fields.includes('supersedes_row_id');
  const hasTestRef = fields.includes('test_ref');
  const hasEvidenceRef = fields.includes('evidence_ref');

  const totalRows = rows.length;

  const rawStatusDist = {};
  if (hasStatus) {
    for (const row of rows) {
      const s = row.status && row.status.trim() ? row.status.trim() : '(brak statusu)';
      rawStatusDist[s] = (rawStatusDist[s] || 0) + 1;
    }
  }

  // resolve supersede chains: effective = row_id NOT referenced by any other
  // row's supersedes_row_id in this file. Works for any chain depth because
  // only the terminal (nobody-supersedes-me) node of each chain qualifies.
  let effectiveRows = rows;
  let supersededCount = 0;
  if (idField && hasSupersedes) {
    const supersededTargets = new Set(
      rows.map((r) => (r.supersedes_row_id || '').trim()).filter(Boolean)
    );
    effectiveRows = rows.filter((r) => !supersededTargets.has((r[idField] || '').trim()));
    supersededCount = totalRows - effectiveRows.length;
  }

  const effectiveStatusDist = {};
  if (hasStatus) {
    for (const row of effectiveRows) {
      const s = row.status && row.status.trim() ? row.status.trim() : '(brak statusu)';
      effectiveStatusDist[s] = (effectiveStatusDist[s] || 0) + 1;
    }
  }

  // rows without evidence (effective only): empty test_ref OR empty evidence_ref
  const noEvidenceRows = [];
  if (hasTestRef || hasEvidenceRef) {
    for (const row of effectiveRows) {
      const te = hasTestRef ? (row.test_ref || '').trim() : '';
      const ev = hasEvidenceRef ? (row.evidence_ref || '').trim() : '';
      const missingTest = hasTestRef ? te === '' : false;
      const missingEvidence = hasEvidenceRef ? ev === '' : false;
      if (missingTest || missingEvidence) {
        noEvidenceRows.push({
          id: idField ? row[idField] : '(brak id)',
          status: hasStatus ? row.status : '(brak statusu)',
          missingTest,
          missingEvidence,
        });
      }
    }
  }
  const provenNoEvidence = noEvidenceRows.filter((r) => PROVEN_STATUSES.has((r.status || '').trim()));

  // inconsistency check: PROVEN/PASS rows whose test_ref does not resolve to
  // a real, existing file on disk.
  const provenBrokenTestRef = [];
  if (hasStatus && hasTestRef) {
    for (const row of effectiveRows) {
      const status = (row.status || '').trim();
      if (!PROVEN_STATUSES.has(status)) continue;
      const raw = (row.test_ref || '').trim();
      const id = idField ? row[idField] : '(brak id)';
      if (!raw) {
        provenBrokenTestRef.push({ id, reason: 'test_ref pusty', rawTestRef: raw });
        continue;
      }
      const candidates = splitCandidates(raw);
      if (candidates.length === 0) {
        provenBrokenTestRef.push({ id, reason: 'test_ref pusty po normalizacji', rawTestRef: raw });
        continue;
      }
      for (const cand of candidates) {
        const cls = classifyCandidate(cand);
        if (cls.kind === 'sentinel_pending') {
          provenBrokenTestRef.push({ id, reason: 'test_ref = "PENDING" (sentinel, nie plik)', rawTestRef: raw });
        } else if (cls.kind === 'descriptive_note') {
          provenBrokenTestRef.push({ id, reason: `test_ref to opis, nie sciezka pliku: "${cand}"`, rawTestRef: raw });
        } else if (cls.kind === 'path_missing') {
          provenBrokenTestRef.push({ id, reason: `plik nie istnieje w repo: ${cand}`, rawTestRef: raw });
        } else if (cls.kind === 'basename_missing') {
          provenBrokenTestRef.push({ id, reason: `plik o nazwie "${cand}" nie znaleziony nigdzie w repo`, rawTestRef: raw });
        }
      }
    }
  }

  return {
    file: name,
    fields,
    totalRows,
    hasStatus,
    idField,
    hasSupersedes,
    hasTestRef,
    hasEvidenceRef,
    rawStatusDist,
    effectiveStatusDist,
    effectiveRowCount: effectiveRows.length,
    supersededCount,
    noEvidenceCount: noEvidenceRows.length,
    provenNoEvidence,
    provenBrokenTestRef,
  };
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------
function listCsvFiles() {
  return readdirSync(ACCEPTANCE_DIR)
    .filter((f) => f.endsWith('.csv'))
    .sort()
    .map((f) => join(ACCEPTANCE_DIR, f));
}

const csvFiles = listCsvFiles();
const perFile = csvFiles.map(analyzeFile);

const grand = {
  totalRowsAllFiles: 0,
  totalEffectiveRows: 0,
  rawStatusDist: {},
  effectiveStatusDist: {},
  noEvidenceCount: 0,
  provenNoEvidence: [],
  provenBrokenTestRef: [],
};

for (const f of perFile) {
  grand.totalRowsAllFiles += f.totalRows;
  if (f.hasStatus) {
    grand.totalEffectiveRows += f.effectiveRowCount;
  }
  for (const [k, v] of Object.entries(f.rawStatusDist)) {
    grand.rawStatusDist[k] = (grand.rawStatusDist[k] || 0) + v;
  }
  for (const [k, v] of Object.entries(f.effectiveStatusDist)) {
    grand.effectiveStatusDist[k] = (grand.effectiveStatusDist[k] || 0) + v;
  }
  grand.noEvidenceCount += f.noEvidenceCount;
  for (const r of f.provenNoEvidence) grand.provenNoEvidence.push({ file: f.file, ...r });
  for (const r of f.provenBrokenTestRef) grand.provenBrokenTestRef.push({ file: f.file, ...r });
}

// ---------------------------------------------------------------------------
// Render Markdown
// ---------------------------------------------------------------------------
function fmtDist(dist) {
  const entries = Object.entries(dist).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return '_(brak kolumny status)_';
  return entries.map(([k, v]) => `${k}: **${v}**`).join(', ');
}

function nowIso() {
  return new Date().toISOString();
}

const lines = [];
lines.push('# LEDGER_SNAPSHOT — parser rejestrow Case Workspace');
lines.push('');
lines.push('> Wygenerowane automatycznie przez `scripts/case-workspace/ledger-report.mjs`.');
lines.push('> NIE edytowac recznie — kazdy przebieg nadpisuje ten plik od zera.');
lines.push(`> Wygenerowano: ${nowIso()}`);
lines.push('');
lines.push('## Jak uruchomic');
lines.push('');
lines.push('```bash');
lines.push('node scripts/case-workspace/ledger-report.mjs');
lines.push('# zapis do innej sciezki:');
lines.push('node scripts/case-workspace/ledger-report.mjs --out /tmp/snapshot.md');
lines.push('# plus pelny JSON na stdout:');
lines.push('node scripts/case-workspace/ledger-report.mjs --json');
lines.push('```');
lines.push('');
lines.push('Skrypt czyta WSZYSTKIE `docs/product/case-workspace/acceptance/*.csv`, rozwiazuje');
lines.push('lancuchy `supersedes_row_id` (append-only — stary wiersz zastapiony przez nowszy nie');
lines.push('jest liczony podwojnie) i liczy rozklad statusow po wierszach **efektywnych**.');
lines.push('');
lines.push('## Zrodla (pliki wejsciowe)');
lines.push('');
lines.push('| Plik | Wiersze (surowe) | Kolumna status | row_id/requirement_id | supersedes_row_id |');
lines.push('|---|---:|:---:|:---:|:---:|');
for (const f of perFile) {
  lines.push(`| ${f.file} | ${f.totalRows} | ${f.hasStatus ? 'tak' : 'BRAK'} | ${f.idField || 'brak'} | ${f.hasSupersedes ? 'tak' : 'brak'} |`);
}
lines.push('');

lines.push('## LACZNY rozklad statusow — WIERSZE EFEKTYWNE (po rozwiazaniu supersedes_row_id)');
lines.push('');
lines.push(`Suma wierszy surowych (wszystkie pliki, wliczajac te bez kolumny status): **${grand.totalRowsAllFiles}**`);
lines.push('');
lines.push(`Suma wierszy efektywnych (po deduplikacji lancuchow supersedes, tylko pliki z kolumna status): **${grand.totalEffectiveRows}**`);
lines.push('');
lines.push(fmtDist(grand.effectiveStatusDist));
lines.push('');
const gapStatuses = ['PARTIAL', 'BLOCKED', 'BLOCKED_ON_UI', 'EVIDENCE_MISSING', 'NOT_IMPLEMENTED'];
const gapPresent = gapStatuses.filter((s) => (grand.effectiveStatusDist[s] || 0) > 0);
if (gapPresent.length > 0) {
  const gapSum = gapPresent.reduce((acc, s) => acc + (grand.effectiveStatusDist[s] || 0), 0);
  lines.push(`**GAP != 0.** Statusy niedomkniete obecne w wierszach efektywnych: ${gapPresent.map((s) => `${s}=${grand.effectiveStatusDist[s]}`).join(', ')} (razem **${gapSum}** wierszy). Nie mozna deklarowac "zero GAP".`);
} else {
  lines.push('Brak statusow PARTIAL/BLOCKED*/EVIDENCE_MISSING/NOT_IMPLEMENTED w wierszach efektywnych (sprawdzone parserem, nie recznie).');
}
lines.push('');

lines.push('### (dla porownania) rozklad surowy — WSZYSTKIE wiersze, bez dedup supersedes');
lines.push('');
lines.push(fmtDist(grand.rawStatusDist));
lines.push('');

lines.push('## Rozbicie per plik');
lines.push('');
for (const f of perFile) {
  lines.push(`### ${f.file}`);
  lines.push('');
  lines.push(`- Wiersze surowe: **${f.totalRows}**`);
  if (f.hasSupersedes) {
    lines.push(`- Z tego zastapione przez nowszy wiersz (supersedes_row_id, wylaczone z rozkladu efektywnego): **${f.supersededCount}**`);
  } else {
    lines.push('- Kolumna `supersedes_row_id`: brak w tym pliku — wszystkie wiersze traktowane jako efektywne.');
  }
  lines.push(`- Wiersze efektywne: **${f.effectiveRowCount}**`);
  if (f.hasStatus) {
    lines.push(`- Rozklad statusow (efektywne): ${fmtDist(f.effectiveStatusDist)}`);
    if (f.supersededCount > 0) {
      lines.push(`- Rozklad statusow (surowe, przed dedup): ${fmtDist(f.rawStatusDist)}`);
    }
  } else {
    lines.push('- Kolumna `status`: BRAK w tym pliku — rozklad statusow nieliczony (patrz `docs/FUNCTIONAL_DOCUMENTATION.md` / wlasciciel rejestru co do sensu tego pliku).');
  }
  if (f.hasTestRef || f.hasEvidenceRef) {
    lines.push(`- Wiersze efektywne bez dowodu (pusty test_ref lub pusty evidence_ref): **${f.noEvidenceCount}**`);
  } else {
    lines.push('- Kolumny `test_ref`/`evidence_ref`: brak w tym pliku.');
  }
  lines.push('');
}

lines.push('## Wiersze bez dowodu, ktore NIE MOGA byc PASS/IMPLEMENTED_AND_PROVEN');
lines.push('');
lines.push(`Laczna liczba wierszy efektywnych z pustym \`test_ref\` LUB pustym \`evidence_ref\`: **${grand.noEvidenceCount}**.`);
lines.push('');
lines.push('Rozklad tej liczby jest zdominowany przez wiersze o statusie `NOT_IMPLEMENTED` (naturalne — nic');
lines.push('nie zostalo zaimplementowane, wiec nie ma dowodu). Kluczowe pytanie kontrolne to: czy ktorys z tych');
lines.push('wierszy jest mimo to oznaczony jako `IMPLEMENTED_AND_PROVEN`/`PASS`?');
lines.push('');
if (grand.provenNoEvidence.length === 0) {
  lines.push('**Sprawdzone: ZERO.** Zaden wiersz efektywny o statusie IMPLEMENTED_AND_PROVEN/PASS nie ma');
  lines.push('calkowicie pustego `test_ref` ani calkowicie pustego `evidence_ref`. To NIE jest to samo co');
  lines.push('"dowod jest realny" — patrz nastepna sekcja: czesc `test_ref` niepustych jest sentinelem `PENDING`');
  lines.push('albo tekstem opisowym bez wskazanego pliku.');
} else {
  lines.push(`**Znaleziono ${grand.provenNoEvidence.length}** wiersz(y) IMPLEMENTED_AND_PROVEN/PASS bez dowodu:`);
  lines.push('');
  lines.push('| Plik | ID | brak test_ref | brak evidence_ref |');
  lines.push('|---|---|:---:|:---:|');
  for (const r of grand.provenNoEvidence) {
    lines.push(`| ${r.file} | ${r.id} | ${r.missingTest ? 'TAK' : ''} | ${r.missingEvidence ? 'TAK' : ''} |`);
  }
}
lines.push('');

lines.push('## Niespojnosc: wiersze "udowodnione" (IMPLEMENTED_AND_PROVEN/PASS), ktorych test_ref');
lines.push('## nie wskazuje na realnie istniejacy plik testu');
lines.push('');
lines.push('Dla kazdego wiersza efektywnego ze statusem IMPLEMENTED_AND_PROVEN/PASS skrypt rozklada');
lines.push('`test_ref` na kandydatow-sciezki (separator `|`, opcjonalny sufiks `:linia`, opcjonalny dopisek');
lines.push('w nawiasie) i sprawdza kazdy wzgledem systemu plikow (dla golych nazw plikow — dodatkowo');
lines.push('przeszukuje cale repo po nazwie, zeby nie dawac falszywych alarmow na skrocone referencje).');
lines.push('');
if (grand.provenBrokenTestRef.length === 0) {
  lines.push('**Sprawdzone: ZERO niespojnosci.** Kazdy `test_ref` na wierszu IMPLEMENTED_AND_PROVEN/PASS');
  lines.push('wskazuje na plik, ktory realnie istnieje w repo.');
} else {
  lines.push(`**Znaleziono ${grand.provenBrokenTestRef.length}** wpis(y) niespojne — to realne znalezisko, nie szum:`);
  lines.push('');
  lines.push('| Plik rejestru | ID wiersza | Powod | Surowy test_ref |');
  lines.push('|---|---|---|---|');
  for (const r of grand.provenBrokenTestRef) {
    const rawShort = r.rawTestRef && r.rawTestRef.length > 140 ? r.rawTestRef.slice(0, 140) + '…' : r.rawTestRef;
    lines.push(`| ${r.file} | ${r.id} | ${r.reason} | \`${(rawShort || '').replace(/\|/g, '\\|')}\` |`);
  }
}
lines.push('');

lines.push('## Uwagi metodologiczne');
lines.push('');
lines.push('- "Efektywny" wiersz = taki, ktorego `row_id`/`requirement_id` NIE wystepuje jako cel');
lines.push('  `supersedes_row_id` zadnego innego wiersza w tym samym pliku. Dziala to poprawnie dla');
lines.push('  lancuchow dowolnej dlugosci (np. `X` -> `X-U1` -> `X-U3`), bo efektywny jest zawsze i tylko');
lines.push('  wezel koncowy lancucha — nie trzeba go jawnie przechodzic.');
lines.push('- Pliki `CODEBASE_CONVERGENCE_MAP.csv` i `CARTESIAN_UX_COVERAGE.csv` nie maja uzytecznej');
lines.push('  kolumny `status` (pierwszy: brak kolumny w ogole; drugi: 0 wierszy) — wylaczone z rozkladu');
lines.push('  statusow, ale ich liczba wierszy jest wliczona w tabele zrodel powyzej.');
lines.push('- `TRACEABILITY_AUTH_ROUTES.csv` nie ma kolumny `supersedes_row_id` — wszystkie jego wiersze');
lines.push('  sa traktowane jako efektywne wprost.');
lines.push('- Ten plik i skrypt, ktory go generuje, NIE modyfikuja zadnego pliku CSV — rejestry naleza');
lines.push('  do innych agentow rownoleglej pracy.');
lines.push('');

writeFileSync(OUT_PATH, lines.join('\n') + '\n', 'utf8');

// ---------------------------------------------------------------------------
// stdout summary
// ---------------------------------------------------------------------------
console.log(`Zapisano: ${relative(REPO_ROOT, OUT_PATH)}`);
console.log('');
console.log(`Pliki CSV: ${csvFiles.length}`);
console.log(`Wiersze surowe (wszystkie pliki): ${grand.totalRowsAllFiles}`);
console.log(`Wiersze efektywne (po dedup supersedes, pliki z kolumna status): ${grand.totalEffectiveRows}`);
console.log('Rozklad statusow (EFEKTYWNE):', JSON.stringify(grand.effectiveStatusDist));
console.log(`Wiersze efektywne bez dowodu (test_ref lub evidence_ref puste): ${grand.noEvidenceCount}`);
console.log(`  z tego IMPLEMENTED_AND_PROVEN/PASS bez dowodu: ${grand.provenNoEvidence.length}`);
console.log(`Niespojnosc PROVEN + test_ref nie wskazujacy na istniejacy plik: ${grand.provenBrokenTestRef.length}`);

if (EMIT_JSON) {
  console.log('');
  console.log(JSON.stringify({ perFile, grand }, null, 2));
}
