#!/usr/bin/env node
/**
 * BRAMKA JĘZYKA KART (REGUŁA NR 22 + REGUŁA NR 15)
 *
 * Sprawdza mechanicznie, czy NASZE zdania „co to domyka" na kartach modułowych
 * są napisane do właściciela: w drugiej osobie, po polsku, bez żargonu i ścieżek.
 *
 * CYTATU WŁAŚCICIELA NIE SPRAWDZA I SPRAWDZAĆ NIE MOŻE — jest nietykalny,
 * także z literówkami i bez diakrytyków, bo to jego słowa.
 *
 * Uzasadnienie istnienia: uważność jako lekarstwo zawodzi zawsze (REGUŁA NR 15).
 * Bramka ma podłogę liczebności — „zero zdań" to BŁĄD, nie zaliczenie
 * (pamięć: brak pomiaru nie jest wynikiem).
 */
import { czytajMape, korpus, coDomyka } from './lib/kartyModulow.mjs';

const ROOT = process.cwd();
const DIAKRYTYKI = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/;

const WADY = [
  { kod: 'TRZECIA_OSOBA', re: /\bwłaścicie|\bWłaścicie|\bwlascicie|\bWlascicie/,
    rada: 'napisz do niego w drugiej osobie („Prosiłeś…", „Masz rację…"), nie o nim' },
  { kod: 'SCIEZKA',       re: /evidence\/|docs\/|scripts\/|\.json\b|\.mjs\b|\.tsx?\b|\.md\b/,
    rada: 'zamień na „sprawdzone na zdjęciu z <data słownie>"' },
  { kod: 'FLAGA',         re: /\bflag[aęioóy]/i,
    rada: 'zamień na „gotowy, ale jeszcze nie włączony dla użytkowników"' },
  { kod: 'ZARGON',        re: /\bi18n\b|\bwołacz|\bwolacz|\bharness|\bgrep\b|\bcommit\b|\bSHA\b|\bkanon(?:ie|u|em)?\b|\bmontow|\bbundle\b|\bstatus\.json/i,
    rada: 'powiedz to słowami konsultanta, nie inżyniera' },
  { kod: 'DATA_SKROTEM',  re: /\b\d{2}\.\d{2}\b(?!\s*(?:zł|%))/,
    rada: 'datę pisz słownie: „z 30 sierpnia"' },
];

const mapa = czytajMape(ROOT).filter((m) => /^\d/.test(m.kod));
const kor = korpus(ROOT);
const domyka = coDomyka(ROOT);
const wModule = {};
for (const m of mapa) for (const e of m.ekrany) wModule[e.id] = m;

const zdania = [];
for (const [id, pozycje] of Object.entries(kor.wg)) {
  if (!wModule[id]) continue;
  for (const k of pozycje) {
    const tekst = domyka[id] || k.domyka || '';
    if (tekst.trim()) zdania.push({ id, modul: wModule[id], tekst, zWarstwy: Boolean(domyka[id]) });
  }
}

// Podłoga liczebności — pusty pomiar to awaria narzędzia, nie czysty wynik.
if (zdania.length < 50) {
  console.error(`✗ BRAMKA NIE ZMIERZYŁA: znaleziono ${zdania.length} zdań, spodziewane ≥50.`);
  console.error('  To awaria odczytu, nie zaliczenie. Sprawdź korpus i mapę modułów.');
  process.exit(2);
}

const brudne = [];
for (const z of zdania) {
  const wady = WADY.filter((w) => w.re.test(z.tekst)).map((w) => w.kod);
  if (!DIAKRYTYKI.test(z.tekst) && z.tekst.length > 40) wady.push('BEZ_POLSKICH_ZNAKOW');
  if (wady.length) brudne.push({ ...z, wady });
}

const wgModulu = new Map();
for (const b of brudne) {
  const k = `${b.modul.kod} ${b.modul.nazwa}`;
  wgModulu.set(k, (wgModulu.get(k) || []).concat(b));
}

console.log(`Zdań „co domyka" na kartach: ${zdania.length} (z warstwy dla właściciela: ${zdania.filter((z) => z.zWarstwy).length})`);
console.log(`Modułów z brudnym tekstem: ${wgModulu.size} z ${mapa.length}\n`);

for (const [modul, poz] of [...wgModulu].sort()) {
  console.log(`${modul} — ${poz.length}`);
  for (const p of poz) {
    console.log(`   [${p.wady.join(',')}] ${p.id}`);
    console.log(`      ${p.tekst.slice(0, 150)}`);
    for (const w of WADY.filter((w) => p.wady.includes(w.kod))) console.log(`      → ${w.rada}`);
  }
  console.log('');
}

if (brudne.length) {
  console.error(`✗ BRAMKA ZAMKNIĘTA: ${brudne.length} z ${zdania.length} zdań nie mówi językiem właściciela.`);
  process.exit(1);
}
console.log(`✓ BRAMKA OTWARTA: wszystkie ${zdania.length} zdań mówi do właściciela w drugiej osobie, po polsku, bez żargonu i ścieżek.`);
