#!/usr/bin/env node
/**
 * MVP FINAL — ZAMROŻENIE MODUŁU.
 *
 * Właściciel odbiera MVP moduł po module. Po jego „tak" moduł ma zostać zamrożony:
 * od tej chwili commit dotykający jego plików jest ODRZUCANY, chyba że w komunikacie
 * commita jest świadomy znacznik odmrożenia. To zamienia obietnicę „już tego nie tykamy"
 * w mechanikę, która nie zależy od pamięci nikogo.
 *
 * Użycie:
 *   node scripts/mvp-final/zamroz.mjs --modul=13_CHAT --decyzja="Odbiór 05.09: tak, tak zostaje" [--dry-run]
 *   node scripts/mvp-final/zamroz.mjs --modul=WSPOLNE --decyzja="..."     # kanon/komponenty wspólne
 *
 * Flagi:
 *   --dry-run     nic nie zapisuje; drukuje listę plików i ile z nich jest wspólnych
 *   --data=YYYYMMDD   data w nazwie tagu (domyślnie dziś)
 *   --bez-tagu    nie zakłada tagu git (np. gdy HEAD to jeszcze nie ten commit)
 *   --zrodlo-zrzutow=<kat>  katalog ze zrzutami odbioru na żywo (gdy leżą w innym worktree)
 *   --nadpisz     pozwala nadpisać istniejący wpis modułu w rejestrze
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  MODULY,
  KLUCZ_WSPOLNE,
  KATALOGI_WSPOLNE,
  SCIEZKA_REJESTRU,
  KATALOG_WZORCOW,
  KATALOG_ZRZUTOW_ZYWO,
  policzOsiagalnosc,
} from './moduly.mjs';

const args = process.argv.slice(2);
const get = (k, d) => { const a = args.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const ma = (k) => args.includes(`--${k}`);

const modul = get('modul');
const decyzja = get('decyzja', '');
const dryRun = ma('dry-run');
const bezTagu = ma('bez-tagu');
const nadpisz = ma('nadpisz');
// Zrzuty odbioru na żywo bywają jeszcze nieścommitowane w innym worktree — można wskazać
// ich katalog wprost (ścieżka bezwzględna albo względna do roota repo).
const zrodloZrzutow = get('zrodlo-zrzutow', KATALOG_ZRZUTOW_ZYWO);

const ROOT = path.resolve(import.meta.dirname, '../..');

function dzisiaj() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}
const data = get('data', dzisiaj());

if (!modul || (modul !== KLUCZ_WSPOLNE && !MODULY[modul])) {
  console.error('Wymagane --modul=<KLUCZ>. Dostępne:');
  console.error('  ' + [...Object.keys(MODULY), KLUCZ_WSPOLNE].join('\n  '));
  process.exit(2);
}
if (!dryRun && !decyzja.trim()) {
  console.error('Wymagane --decyzja="słowa właściciela" (bez tego zamrożenie nie ma źródła).');
  process.exit(2);
}

const wynik = policzOsiagalnosc(ROOT);
const jestWspolne = modul === KLUCZ_WSPOLNE;
const pliki = jestWspolne ? wynik.wspolne : wynik.wlasne[modul];
const katalogi = jestWspolne ? KATALOGI_WSPOLNE : MODULY[modul].katalogi;
const nazwa = jestWspolne ? 'Kanon i komponenty wspólne' : MODULY[modul].nazwa;

// Ile plików osiągalnych z tego modułu NIE jest chronionych jego zamrożeniem,
// bo należą do wspólnych albo do innego modułu — to trzeba powiedzieć wprost.
const osiagalne = jestWspolne ? wynik.wspolne : wynik.perModul[modul];
const zbior = new Set(pliki);
const poza = osiagalne.filter((p) => !zbior.has(p));
const pozaWspolne = poza.filter((p) => wynik.wspolne.includes(p));

// --- zrzuty-wzorce -----------------------------------------------------------
function zbierzWzorce() {
  const out = [];
  const brakujaceKatalogi = [];
  for (const kat of katalogi) {
    const zrodlo = path.isAbsolute(zrodloZrzutow)
      ? path.join(zrodloZrzutow, kat)
      : path.join(ROOT, zrodloZrzutow, kat);
    if (!fs.existsSync(zrodlo)) { brakujaceKatalogi.push(kat); continue; }
    for (const f of fs.readdirSync(zrodlo).sort()) {
      if (!f.endsWith('.png')) continue;
      out.push({ kat, plik: f, zrodlo: path.join(zrodlo, f) });
    }
  }
  return { out, brakujaceKatalogi };
}
const { out: znalezione, brakujaceKatalogi } = zbierzWzorce();

console.log(`\nMODUŁ: ${modul} — ${nazwa}`);
console.log(`  plików własnych (zamrażanych): ${pliki.length}`);
console.log(`  plików osiągalnych razem:      ${osiagalne.length}`);
console.log(`  z tego POZA zamrożeniem:       ${poza.length} (w tym wspólnych: ${pozaWspolne.length})`);
console.log(`  katalogi zrzutów:              ${katalogi.length ? katalogi.join(', ') : '(brak — moduł nie ma katalogu w odbiorze na żywo)'}`);
console.log(`  znalezionych zrzutów-wzorców:  ${znalezione.length}`);
if (brakujaceKatalogi.length) {
  console.log(`  ⚠ brak katalogu zrzutów: ${brakujaceKatalogi.join(', ')} (${zrodloZrzutow}/)`);
  console.log('    Jeśli zrzuty leżą w innym worktree, wskaż je: --zrodlo-zrzutow=/sciezka/evidence/odbior-zywo-20260905');
}
if (!znalezione.length) {
  console.log('  ⚠ OSTRZEŻENIE: zero wzorców. Zamrożenie zadziała na plikach, ale porównanie');
  console.log('    wizualne (porownaj.mjs) nie będzie miało z czym porównywać.');
}

if (dryRun) {
  console.log('\n--- PLIKI (dry-run, nic nie zapisano) ---');
  for (const p of pliki) console.log('  ' + p);
  if (poza.length) {
    console.log(`\n--- POZA ZAMROŻENIEM MODUŁU (${poza.length}) — pierwsze 20 ---`);
    for (const p of poza.slice(0, 20)) console.log('  ' + p + (wynik.wspolne.includes(p) ? '   [WSPOLNE]' : '   [inny moduł]'));
    console.log(`\n  Te pliki chroni dopiero: node scripts/mvp-final/zamroz.mjs --modul=WSPOLNE ...`);
    console.log('  albo zamrożenie modułu, do którego należą.');
  }
  process.exit(0);
}

// --- kopiowanie wzorców ------------------------------------------------------
const celWzorcow = path.join(ROOT, KATALOG_WZORCOW, modul);
const wzorce = [];
if (znalezione.length) {
  fs.mkdirSync(celWzorcow, { recursive: true });
  for (const z of znalezione) {
    const cel = path.join(celWzorcow, z.plik);
    fs.copyFileSync(z.zrodlo, cel);
    // metadanych ze zrzutu (adres, błędy konsoli) też nie tracimy — jeśli są.
    const meta = z.zrodlo + '.json';
    if (fs.existsSync(meta)) fs.copyFileSync(meta, cel + '.json');
    wzorce.push(path.posix.join(KATALOG_WZORCOW, modul, z.plik));
  }
  // wyniki.json odbioru na żywo = źródło tras/klików dla porownaj.mjs
  for (const kat of katalogi) {
    const w = path.isAbsolute(zrodloZrzutow)
      ? path.join(zrodloZrzutow, kat, 'wyniki.json')
      : path.join(ROOT, zrodloZrzutow, kat, 'wyniki.json');
    if (fs.existsSync(w)) fs.copyFileSync(w, path.join(celWzorcow, `wyniki.${kat}.json`));
  }
}

// --- rejestr -----------------------------------------------------------------
const sciezkaRejestru = path.join(ROOT, SCIEZKA_REJESTRU);
let rejestr = { moduly: {}, wspolne: null };
if (fs.existsSync(sciezkaRejestru)) rejestr = JSON.parse(fs.readFileSync(sciezkaRejestru, 'utf8'));
rejestr.moduly = rejestr.moduly || {};

const istniejacy = jestWspolne ? rejestr.wspolne : rejestr.moduly[modul];
if (istniejacy && !nadpisz) {
  console.error(`\n⛔ ${modul} jest już zamrożony (${istniejacy.zamrozono}). Użyj --nadpisz, jeśli świadomie odświeżasz wpis.`);
  process.exit(1);
}

let commit = '';
try { commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim(); } catch {}

const tag = `mvp-final-${modul}-${data}`;
const wpis = {
  nazwa,
  zamrozono: new Date().toISOString(),
  decyzja,
  tag,
  commit,
  pliki,
  wzorce,
  katalogi_zrzutow: katalogi,
  poza_zamrozeniem_modulu: poza.length,
  poza_zamrozeniem_wspolne: pozaWspolne.length,
};
if (jestWspolne) rejestr.wspolne = wpis;
else rejestr.moduly[modul] = wpis;

rejestr._opis =
  rejestr._opis ||
  'Rejestr modułów zamrożonych jako MVP final. Wpis = zgoda właściciela + lista plików + wzorce zrzutów. ' +
    'Bezpiecznik scripts/mvp-final/check-freeze.sh odrzuca commit dotykający tych plików bez znacznika ' +
    '[ODMROZENIE <MODUL> DEC-<numer>] w komunikacie. Procedura: docs/program/MVP_FINAL_PROCEDURA.md';
rejestr._zaktualizowano = new Date().toISOString().slice(0, 10);

fs.mkdirSync(path.dirname(sciezkaRejestru), { recursive: true });
fs.writeFileSync(sciezkaRejestru, JSON.stringify(rejestr, null, 1) + '\n');
console.log(`\n✅ Rejestr zaktualizowany: ${SCIEZKA_REJESTRU} (${pliki.length} plików, ${wzorce.length} wzorców)`);

// --- tag ---------------------------------------------------------------------
if (bezTagu) {
  console.log(`ℹ Tag pominięty (--bez-tagu). Załóż ręcznie: git tag ${tag}`);
} else {
  try {
    execFileSync('git', ['tag', '-a', tag, '-m', `MVP final ${modul} — ${decyzja}`], { cwd: ROOT });
    console.log(`✅ Tag: ${tag} (bez push — wypycha nadzorca sesji głównej)`);
  } catch (e) {
    console.log(`⚠ Tag ${tag} nie powstał: ${String(e.message).split('\n')[0]}`);
  }
}
console.log('\nNastępny krok: zacommituj rejestr i wzorce (commit rejestru jest dozwolony —');
console.log('bezpiecznik pilnuje src/, nie docs/ i nie evidence/).');
