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
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { MODULY, KLUCZ_WSPOLNE, SCIEZKA_REJESTRU } from './moduly.mjs';

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

// --- silnik porównania -------------------------------------------------------
const require_ = createRequire(import.meta.url);
function zaladuj(nazwa) { try { return require_(nazwa); } catch { return null; } }
const pixelmatch = zaladuj('pixelmatch')?.default || zaladuj('pixelmatch');
const pngjs = zaladuj('pngjs');
const sharp = zaladuj('sharp');

let SILNIK = 'sha';
if (pngjs && pixelmatch) SILNIK = 'pixelmatch';
else if (pngjs) SILNIK = 'pngjs';
else if (sharp) SILNIK = 'sharp';

function sha(p) { return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex').slice(0, 16); }

/** Wymiary PNG z nagłówka IHDR — działa bez żadnej biblioteki. */
function wymiaryPng(p) {
  const b = fs.readFileSync(p).subarray(0, 33);
  if (b.length < 24) return null;
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

async function porownaj(wzorzec, swiezy, diffOut) {
  const aW = wymiaryPng(wzorzec), bW = wymiaryPng(swiezy);
  if (!aW || !bW) return { werdykt: 'BLAD', opis: 'nie da się odczytać PNG' };
  if (aW.w !== bW.w || aW.h !== bW.h) {
    return { werdykt: 'ROZNI_SIE', procent: 100, opis: `inne wymiary ${aW.w}x${aW.h} vs ${bW.w}x${bW.h}`, diff: '' };
  }
  if (SILNIK === 'sha') {
    const rowne = sha(wzorzec) === sha(swiezy);
    return {
      werdykt: rowne ? 'ZGODNY' : 'ROZNI_SIE',
      procent: rowne ? 0 : null,
      opis: rowne ? 'identyczne bajty (porównanie SHA — brak pixelmatch/pngjs/sharp)'
                  : 'RÓŻNE BAJTY, ale bez pixelmatch/pngjs/sharp NIE WIEM ILE pikseli — zainstaluj pngjs',
      diff: '',
    };
  }

  let a, b, szer, wys;
  if (SILNIK === 'sharp') {
    const ra = await sharp(wzorzec).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const rb = await sharp(swiezy).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    a = ra.data; b = rb.data; szer = ra.info.width; wys = ra.info.height;
  } else {
    const { PNG } = pngjs;
    const pa = PNG.sync.read(fs.readFileSync(wzorzec));
    const pb = PNG.sync.read(fs.readFileSync(swiezy));
    a = pa.data; b = pb.data; szer = pa.width; wys = pa.height;
  }

  const razem = szer * wys;
  let rozne = 0;
  let diffBuf = null;
  if (SILNIK === 'pixelmatch' || pngjs) diffBuf = Buffer.alloc(razem * 4);

  if (SILNIK === 'pixelmatch') {
    rozne = pixelmatch(a, b, diffBuf, szer, wys, { threshold: 0.1 });
  } else {
    for (let i = 0; i < razem; i++) {
      const o = i * 4;
      const d = Math.max(Math.abs(a[o] - b[o]), Math.abs(a[o + 1] - b[o + 1]), Math.abs(a[o + 2] - b[o + 2]));
      const inny = d > 12;
      if (inny) rozne++;
      if (diffBuf) {
        if (inny) { diffBuf[o] = 255; diffBuf[o + 1] = 0; diffBuf[o + 2] = 0; diffBuf[o + 3] = 255; }
        else {
          const szary = Math.round((a[o] + a[o + 1] + a[o + 2]) / 3 * 0.25 + 190);
          diffBuf[o] = diffBuf[o + 1] = diffBuf[o + 2] = Math.min(255, szary);
          diffBuf[o + 3] = 255;
        }
      }
    }
  }
  let diffSciezka = '';
  if (diffBuf && pngjs && rozne > 0) {
    const { PNG } = pngjs;
    const png = new PNG({ width: szer, height: wys });
    diffBuf.copy(png.data);
    fs.mkdirSync(path.dirname(diffOut), { recursive: true });
    fs.writeFileSync(diffOut, PNG.sync.write(png));
    diffSciezka = path.relative(ROOT, diffOut);
  }
  const procent = (rozne / razem) * 100;
  return {
    werdykt: procent <= prog ? 'ZGODNY' : 'ROZNI_SIE',
    procent,
    opis: `${rozne} / ${razem} pikseli (silnik: ${SILNIK})`,
    diff: diffSciezka,
  };
}

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
