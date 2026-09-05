#!/usr/bin/env node
/**
 * MVP FINAL — PORÓWNANIE ZE WZORCEM.
 *
 * Zamrożenie plików pilnuje, żeby nikt nie ruszył kodu modułu. To nie wystarcza:
 * ekran można zepsuć zmianą we WSPÓLNYM komponencie albo w CSS. Ten skrypt robi świeże
 * zrzuty tych samych ekranów i porównuje je z wzorcami z dnia odbioru — czyli sprawdza
 * PRODUKT, nie deklarację.
 *
 * Wymaga: uruchomionej aplikacji na http://localhost:3000 oraz ODBIOR_AUTH_STATE
 * (plik stanu zalogowania — patrz scripts/dev/odbior-zywo/zaloguj.mjs).
 *
 * Użycie:
 *   ODBIOR_AUTH_STATE=/sciezka/auth.json node scripts/mvp-final/porownaj.mjs --modul=13_CHAT
 *   ... --tylko=chat-split-teresa-right     # jeden ekran
 *   ... --prog=0.1                          # próg % różniących się pikseli (domyślnie 0.1)
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { MODULY, KLUCZ_WSPOLNE, SCIEZKA_REJESTRU } from './moduly.mjs';
import { porownajObrazy, SILNIK } from './porownaj-obrazy.mjs';

const args = process.argv.slice(2);
const get = (k, d) => { const a = args.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const ROOT = path.resolve(import.meta.dirname, '../..');
const modul = get('modul');
const tylko = get('tylko');
const prog = Number(get('prog', '0.1'));

if (!modul) { console.error('Wymagane --modul=<KLUCZ> (np. 13_CHAT albo WSPOLNE).'); process.exit(2); }

const rejestrPath = path.join(ROOT, SCIEZKA_REJESTRU);
if (!fs.existsSync(rejestrPath)) { console.error(`Brak rejestru ${SCIEZKA_REJESTRU} — nic nie jest zamrożone.`); process.exit(2); }
const rejestr = JSON.parse(fs.readFileSync(rejestrPath, 'utf8'));
const wpis = modul === KLUCZ_WSPOLNE ? rejestr.wspolne : (rejestr.moduly || {})[modul];
if (!wpis) { console.error(`Moduł ${modul} nie jest zamrożony — nie ma z czym porównywać.`); process.exit(2); }
if (!wpis.wzorce || !wpis.wzorce.length) {
  console.error(`Moduł ${modul} jest zamrożony BEZ wzorców (wzorce: []). Porównanie wizualne niemożliwe.`);
  console.error('To nie jest „zgodny" — to brak pomiaru. Dorób zrzuty i zamroź ponownie z --nadpisz.');
  process.exit(2);
}

// --- silnik porównania (wydzielony: scripts/mvp-final/porownaj-obrazy.mjs) ---
const porownaj = (wzorzec, swiezy, diffOut) => porownajObrazy(wzorzec, swiezy, diffOut, { prog, root: ROOT });

// --- trasy i kliki z odbioru na żywo -----------------------------------------
const katWzorcow = path.join(ROOT, path.dirname(wpis.wzorce[0]));
const trasy = new Map(); // id -> { trasa, kliki }
for (const f of fs.existsSync(katWzorcow) ? fs.readdirSync(katWzorcow) : []) {
  if (!/^wyniki\..*\.json$/.test(f)) continue;
  for (const w of JSON.parse(fs.readFileSync(path.join(katWzorcow, f), 'utf8'))) {
    if (w.id) trasy.set(w.id, { trasa: w.trasa || '', kliki: w.kliki || [] });
  }
}

/** Klik „opisowy" (np. „wiersz pomysłu") nie jest selektorem Playwrighta. */
function selektorowy(k) { return /^(text=|css=|role=|xpath=|id=|data-testid=|internal:)/.test(k) || /[[\]#.>]/.test(k); }

const auth = process.env.ODBIOR_AUTH_STATE;
if (!auth || !fs.existsSync(auth)) {
  console.error('⛔ Brak ODBIOR_AUTH_STATE (plik stanu zalogowania). Bez niego zrzuty byłyby ekranem logowania,');
  console.error('   a porównanie meldowałoby „RÓŻNI SIĘ" z powodu przyrządu, nie produktu. Przerywam.');
  console.error('   Zaloguj: node scripts/dev/odbior-zywo/zaloguj.mjs');
  process.exit(2);
}

const katSwiezych = path.join(ROOT, path.dirname(wpis.wzorce[0]), '_swieze');
const katDiff = path.join(ROOT, path.dirname(wpis.wzorce[0]), '_diff');
fs.mkdirSync(katSwiezych, { recursive: true });

const wiersze = [];
for (const wzorzecRel of wpis.wzorce) {
  const id = path.basename(wzorzecRel, '.png');
  if (tylko && id !== tylko) continue;
  const wzorzec = path.join(ROOT, wzorzecRel);
  const przepis = trasy.get(id);
  if (!przepis || !przepis.trasa) {
    wiersze.push({ id, werdykt: 'BRAK_TRASY', opis: 'brak trasy w wyniki.json — nie umiem odtworzyć ekranu', procent: null, diff: '' });
    continue;
  }
  const opisoweKliki = przepis.kliki.filter((k) => !selektorowy(k));
  const swiezy = path.join(katSwiezych, id + '.png');
  const argv = [
    'scripts/dev/odbior-zywo/zrzut.mjs',
    `--url=${przepis.trasa}`,
    `--out=${path.relative(ROOT, swiezy)}`,
    ...przepis.kliki.map((k) => `--klik=${selektorowy(k) ? k : 'text=' + k}`),
  ];
  const r = spawnSync('node', argv, { cwd: ROOT, encoding: 'utf8', env: process.env });
  if (r.status !== 0 || !fs.existsSync(swiezy)) {
    wiersze.push({ id, werdykt: 'BLAD_ZRZUTU', opis: (r.stderr || r.stdout || '').split('\n').filter(Boolean).slice(-1)[0] || 'zrzut nie powstał', procent: null, diff: '' });
    continue;
  }
  const wynik = await porownaj(wzorzec, swiezy, path.join(katDiff, id + '.diff.png'));
  if (opisoweKliki.length) wynik.opis += ` ⚠ kliki opisowe (${opisoweKliki.join(', ')}) — odtworzenie ekranu niepewne`;
  wiersze.push({ id, ...wynik });
}

// --- tabela ------------------------------------------------------------------
console.log(`\nPORÓWNANIE ZE WZORCEM — moduł ${modul} (silnik: ${SILNIK}, próg: ${prog}%)`);
console.log('-'.repeat(110));
console.log('EKRAN'.padEnd(38) + 'WERDYKT'.padEnd(14) + 'RÓŻNICA'.padEnd(12) + 'SZCZEGÓŁY');
console.log('-'.repeat(110));
for (const w of wiersze) {
  const proc = w.procent === null || w.procent === undefined ? '—' : w.procent.toFixed(3) + '%';
  console.log(w.id.slice(0, 37).padEnd(38) + w.werdykt.padEnd(14) + proc.padEnd(12) + (w.diff ? w.diff + ' | ' : '') + (w.opis || ''));
}
console.log('-'.repeat(110));
const zgodne = wiersze.filter((w) => w.werdykt === 'ZGODNY').length;
const rozne = wiersze.filter((w) => w.werdykt === 'ROZNI_SIE').length;
const nieznane = wiersze.length - zgodne - rozne;
console.log(`ZGODNE: ${zgodne} · RÓŻNIĄ SIĘ: ${rozne} · NIE ZMIERZONO: ${nieznane} (z ${wiersze.length})`);
if (nieznane) console.log('⚠ „NIE ZMIERZONO" to NIE jest „zgodny" — te ekrany wymagają ręcznego sprawdzenia.');
process.exit(rozne > 0 ? 1 : 0);
