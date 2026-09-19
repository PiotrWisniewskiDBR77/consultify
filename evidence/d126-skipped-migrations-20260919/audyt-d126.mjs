// D-126 — audyt 7 migracji 'skipped' (klasa 6XX_* zarchiwizowana w server/migrations/never-ran/).
//
// Co mierzy, bez zgadywania:
//  1. czy plik w never-ran/ to TEN SAM plik, ktory staging zapisal jako 'skipped'
//     (checksum = sha256 zawartosci utf-8, dokladnie jak migrate.postgres.ts:146-149,
//      w ledgerze w postaci 'skipped:<sha256>'),
//  2. jakie OBIEKTY deklaruje kazdy plik (CREATE TABLE / CREATE INDEX / ALTER TABLE ADD COLUMN)
//     z numerem linii,
//  3. czy kazdy z tych obiektow ISTNIEJE na zywym stagingu (odczyt katalogu, zero zapisow).
//
// DML (INSERT/UPDATE) nie jest weryfikowany obiektowo — raportowany jako liczba z instrukcja,
// bo "czy dane sa wlasciwe" to inne pytanie niz "czy obiekt istnieje".
//
// Uzycie (sekret tylko w srodowisku, REGULA 10 — zero sekretow w plikach evidence):
//   D126_DBURL_FILE=/Users/piotrwisniewski/Developer/kopie/.dburl-staging node audyt-d126.mjs
// Wymaga: node_modules/pg (symlink repo).

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire('/Users/piotrwisniewski/Developer/qoder-wt/consultify-d/server/');
const { Client } = require('pg');

const ROOT = '/Users/piotrwisniewski/Developer/qoder-wt/consultify-d';
/* D126_SRC_DIR pozwala przepuścić przez ten sam przyrząd treść HISTORYCZNĄ
   (wersje, których sha256 zgadza się z ledgerem — patrz historia-ledger.sh).
   Bez zmiennej: domyślnie obecna treść server/migrations/never-ran/. */
const NEVER_RAN = process.env.D126_SRC_DIR || path.join(ROOT, 'server/migrations/never-ran');
const OUT = process.env.D126_OUT_DIR || path.join(ROOT, 'evidence/d126-skipped-migrations-20260919');

const PLIKI = [
  '604_tools_missing_known_tools_library.sql',
  '617_generic_assessment_reports_pathc_patch.sql',
  '618_tools_missing_12_consulting_tools.sql',
  '625_v4_task_hierarchy_unified.sql',
  '656_v4_scim_enhanced.sql',
  '665_v6_interview_templates_foundation.sql',
  '666_v6_interview_runtime_answers.sql',
];

// --- 1. checksum pliku vs ledger -------------------------------------------
const sha256Pliku = (p) => crypto.createHash('sha256').update(fs.readFileSync(p, 'utf-8')).digest('hex');

// --- 2. parser: instrukcja po instrukcji (nie linia po linii) --------------
// Migracje w never-ran/ maja instrukcje wielolinijkowe (ALTER TABLE ... ADD COLUMN a, ADD COLUMN b),
// wiec buforujemy do srednika i dopiero wtedy dopasowujemy. Komentarze -- i /* */ sa odcinane,
// zeby nie liczyc obiektow z zakomentowanych blokow (osobno raportuje zakomentowane jako UWAGA).
function usunKomentarze(src) {
  const lines = src.split('\n');
  let inBlock = false;
  return lines.map((line) => {
    let out = '';
    let i = 0;
    while (i < line.length) {
      if (inBlock) {
        const end = line.indexOf('*/', i);
        if (end === -1) { i = line.length; } else { inBlock = false; i = end + 2; }
        continue;
      }
      if (line.startsWith('/*', i)) { inBlock = true; i += 2; continue; }
      if (line.startsWith('--', i)) { i = line.length; continue; }
      if (line[i] === "'") { // literal — zostawiamy w calosci, zeby ';' w srodku nie ciął instrukcji
        const close = line.indexOf("'", i + 1);
        if (close === -1) { out += line.slice(i); i = line.length; } else { out += line.slice(i, close + 1); i = close + 1; }
        continue;
      }
      out += line[i];
      i += 1;
    }
    return out;
  });
}

function parseObiekty(plik) {
  const src = fs.readFileSync(plik, 'utf-8');
  const czyste = usunKomentarze(src);
  const obiekty = [];
  let buf = '';
  let startLine = 1;
  czyste.forEach((line, idx) => {
    const nr = idx + 1;
    if (!buf.trim()) startLine = nr;
    buf += (buf ? '\n' : '') + line;
    if (!/;\s*$/.test(line)) return;
    const s = buf.replace(/\s+/g, ' ').trim();
    buf = '';
    if (!s) return;
    const S = s.toUpperCase();
    let m;
    if ((m = s.match(/^CREATE TABLE (?:IF NOT EXISTS )?"?([A-Za-z0-9_]+)"?/i))) {
      obiekty.push({ typ: 'TABLE', obiekt: m[1], tabela: m[1], linia: startLine, instrukcja: S.slice(0, 40) });
    } else if ((m = s.match(/^CREATE (?:UNIQUE )?INDEX (?:CONCURRENTLY )?(?:IF NOT EXISTS )?"?([A-Za-z0-9_]+)"? ON (?:TABLE )?"?([A-Za-z0-9_]+)"?/i))) {
      obiekty.push({ typ: 'INDEX', obiekt: m[1], tabela: m[2], linia: startLine, instrukcja: S.slice(0, 40) });
    } else if (/^ALTER TABLE/i.test(s)) {
      const tm = s.match(/^ALTER TABLE (?:IF EXISTS )?(?:ONLY )?"?([A-Za-z0-9_]+)"?/i);
      const tabela = tm ? tm[1] : null;
      const re = /ADD COLUMN (?:IF NOT EXISTS )?"?([A-Za-z0-9_]+)"?/gi;
      let cm;
      let pierwszy = true;
      while ((cm = re.exec(s))) {
        obiekty.push({ typ: 'COLUMN', obiekt: `${tabela}.${cm[1]}`, tabela, kolumna: cm[1], linia: pierwszy ? startLine : startLine, instrukcja: S.slice(0, 40) });
        pierwszy = false;
      }
    } else if ((m = s.match(/^(INSERT INTO|UPDATE|DELETE FROM) "?([A-Za-z0-9_]+)"?/i))) {
      obiekty.push({ typ: 'DML', obiekt: `${m[1].toUpperCase()} ${m[2]}`, tabela: m[2], linia: startLine, instrukcja: S.slice(0, 40) });
    }
  });
  return { obiekty, zakomentowaneBloki: (src.match(/\/\*[\s\S]*?\*\//g) || []).length };
}

// --- 3. odczyt zywego stagingu (TYLKO SELECT) ------------------------------
const urlFile = process.env.D126_DBURL_FILE;
if (!urlFile || !fs.existsSync(urlFile)) {
  console.error('D126_DBURL_FILE musi wskazywac plik z URL bazy (sekret zostaje w srodowisku, nie w evidence).');
  process.exit(1);
}
const connectionString = fs.readFileSync(urlFile, 'utf-8').trim();

const client = new Client({ connectionString, statement_timeout: 60000 });
await client.connect();
const wersja = (await client.query('SELECT version() AS v')).rows[0].v;
const ledger = (await client.query(
  `SELECT filename, status, checksum, applied_at FROM schema_migrations WHERE filename = ANY($1) ORDER BY filename`,
  [PLIKI],
)).rows;

const wszystkie = [];
for (const f of PLIKI) {
  const p = path.join(NEVER_RAN, f);
  const { obiekty, zakomentowaneBloki } = parseObiekty(p);
  for (const o of obiekty) wszystkie.push({ plik: f, ...o });
  const l = ledger.find((r) => r.filename === f);
  const sha = sha256Pliku(p);
  console.error(`[d126] ${f}: obiektow=${obiekty.length} zakomentowane_bloki=${zakomentowaneBloki} sha=${sha.slice(0, 12)}… ledger=${l ? l.status : 'BRAK_WIERSZA'} checksum_zgodny=${l ? String(l.checksum === `skipped:${sha}`) : 'n/d'}`);
}

// zbiorcze zapytania o istnienie (jedno na typ, zeby nie strzelac setkami zapytan)
const tabele = [...new Set(wszystkie.filter((o) => o.typ === 'TABLE').map((o) => o.obiekt))];
const indeksy = [...new Set(wszystkie.filter((o) => o.typ === 'INDEX').map((o) => o.obiekt))];
const kolumny = wszystkie.filter((o) => o.typ === 'COLUMN').map((o) => [o.tabela, o.kolumna]);

const istniejaceTabele = new Set(tabele.length
  ? (await client.query(`SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p') AND c.relname = ANY($1)`, [tabele])).rows.map((r) => r.relname)
  : []);
const istniejaceIndeksy = new Set(indeksy.length
  ? (await client.query(`SELECT indexname FROM pg_indexes WHERE schemaname='public' AND indexname = ANY($1)`, [indeksy])).rows.map((r) => r.indexname)
  : []);
const paraKolumn = new Set();
if (kolumny.length) {
  const values = kolumny.map((_, i) => `($${i * 2 + 1},$${i * 2 + 2})`).join(',');
  const flat = kolumny.flat();
  const r = await client.query(
    `SELECT table_name, column_name FROM information_schema.columns WHERE table_schema='public' AND (table_name, column_name) IN (${values})`,
    flat,
  );
  for (const row of r.rows) paraKolumn.add(`${row.table_name}.${row.column_name}`);
}
await client.end();

// --- wynik -----------------------------------------------------------------
const istnieje = (o) => {
  if (o.typ === 'TABLE') return istniejaceTabele.has(o.obiekt);
  if (o.typ === 'INDEX') return istniejaceIndeksy.has(o.obiekt);
  if (o.typ === 'COLUMN') return paraKolumn.has(`${o.tabela}.${o.kolumna}`);
  return null; // DML — nie weryfikujemy obiektowo
};

const linie = ['plik|linia|typ|obiekt|istnieje_na_stagingu'];
const brak = [];
let liczniki = { TABLE: [0, 0], INDEX: [0, 0], COLUMN: [0, 0], DML: [0, 0] }; // [istnieje, razem]
for (const o of wszystkie) {
  const e = istnieje(o);
  const v = e === null ? 'n/d(DML)' : e ? 'TAK' : 'NIE';
  linie.push(`${o.plik}|${o.linia}|${o.typ}|${o.obiekt}|${v}`);
  if (e === true) liczniki[o.typ][0] += 1;
  liczniki[o.typ][1] += 1;
  if (e === false) brak.push(o);
}

fs.writeFileSync(path.join(OUT, 'obiekty-vs-staging.tsv'), linie.join('\n') + '\n');

const checksumRows = ledger.map((l) => {
  const sha = sha256Pliku(path.join(NEVER_RAN, l.filename));
  return `${l.filename}|${l.status}|applied_at=${l.applied_at ? l.applied_at.toISOString() : 'n/d'}|ledger=${l.checksum}|obecna=${sha}|${l.checksum === `skipped:${sha}` ? 'ZGODNY' : 'ROZJECHANY'}`;
});
fs.writeFileSync(path.join(OUT, 'checksum-ledger.tsv'), checksumRows.join('\n') + '\n');

const podsumowanie = [
  `# D-126 — podsumowanie (${new Date().toISOString()})`,
  `baza: staging, ${wersja}`,
  `plikow_zbadanych: ${PLIKI.length}`,
  `wierszy_ledgera_znalezionych: ${ledger.length}`,
  ...checksumRows.map((r) => `checksum: ${r}`),
  `TABLE istnieje ${liczniki.TABLE[0]}/${liczniki.TABLE[1]}`,
  `INDEX istnieje ${liczniki.INDEX[0]}/${liczniki.INDEX[1]}`,
  `COLUMN istnieje ${liczniki.COLUMN[0]}/${liczniki.COLUMN[1]}`,
  `DML (nie weryfikowane obiektowo): ${liczniki.DML[1]}`,
  `BRAKOW_lacznie: ${brak.length}`,
  ...brak.map((o) => `BRAK: ${o.plik}:${o.linia} ${o.typ} ${o.obiekt}`),
];
fs.writeFileSync(path.join(OUT, 'podsumowanie.txt'), podsumowanie.join('\n') + '\n');
console.log(podsumowanie.join('\n'));
