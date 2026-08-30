/**
 * ILE DANYCH JEST NA EKRANIE — pomiar, nie wrażenie.
 *
 * POWÓD ISTNIENIA (odbiór właściciela 2026-08-30, dosłownie):
 *   „Nie możemy wystawiać do akceptacji kart, które są puste, bez danych, bo wtedy
 *    nie umiem ocenić, jak to wygląda. (…) mogę tylko zgadywać."
 *
 * Ekran bez danych wygląda na zrzucie poprawnie — i właśnie dlatego jest groźny:
 * przechodzi odbiór, bo nie ma czym się zepsuć. Ale odbiór pustego ekranu nic nie
 * znaczy, a właściciel podpisuje coś, czego nie widział.
 *
 * Ten skrypt NIE ocenia wyglądu. Liczy, ile treści realnie się wyrenderowało:
 * znaki tekstu, wiersze tabel, elementy list, pola wartości — i osobno zlicza
 * frazy pustego stanu („Brak", „Nie ma", „Nie znaleziono"). Rozstrzygnięcie,
 * czy pustka jest ZAMIERZONA (ekran błędu, stan pusty) czy PRZYPADKOWA (chuda
 * atrapa), zostaje dla człowieka — skrypt tylko zawęża listę do obejrzenia.
 *
 * Użycie:
 *   node scripts/dev/grafika-ile-danych.mjs                 # wszystkie z rejestru (A i B)
 *   node scripts/dev/grafika-ile-danych.mjs --ekrany=a,b    # wybrane
 *   node scripts/dev/grafika-ile-danych.mjs --json=plik.json
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const arg = (n, d) => {
  const m = process.argv.find((a) => a.startsWith(`--${n}=`));
  return m ? m.split('=').slice(1).join('=') : d;
};
const BASE = arg('base', 'http://127.0.0.1:3020');
const OSIAD = Number(arg('osiad', '2200'));
const WYJ = arg('json', '');

const status = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/program/grafika/status.json'), 'utf8'));
const zRejestru = status.moduly.flatMap((m) =>
  m.ekrany.filter((e) => e.ocena === 'A' || e.ocena === 'B').map((e) => ({ id: e.id, modul: m.nazwa, nazwa: e.nazwa }))
);
const wybrane = arg('ekrany', '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const lista = wybrane.length ? zRejestru.filter((e) => wybrane.includes(e.id)) : zRejestru;

const PUSTE_FRAZY = [
  'Brak danych',
  'Brak wyników',
  'Brak pozycji',
  'Nie znaleziono',
  'Nie ma jeszcze',
  'Jeszcze nic',
  'Pusto',
  'No data',
  'No results',
  'Nothing here',
  'Empty',
];

const przegladarka = await chromium.launch();
const wyniki = [];

for (const e of lista) {
  const kontekst = await przegladarka.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const karta = await kontekst.newPage();
  try {
    await karta.goto(`${BASE}/?screen=${encodeURIComponent(e.id)}&lang=pl&theme=light`, {
      waitUntil: 'networkidle',
      timeout: 30000,
    });
    await karta.waitForTimeout(OSIAD);
    const m = await karta.evaluate((frazy) => {
      const tekst = (document.body.innerText || '').replace(/\s+/g, ' ').trim();
      const ile = (sel) => document.querySelectorAll(sel).length;
      return {
        znaki: tekst.length,
        // Wiersze danych — pomijamy nagłówki, liczy się treść.
        wierszeTabel: ile('tbody tr'),
        elementyList: ile('ul li, ol li'),
        // Pola wartości: to, co w kartach obiektów niesie liczby i teksty.
        polaWartosci: ile('dd, [data-pole], input:not([type=hidden]), textarea, select'),
        naglowki: ile('h1, h2, h3, h4'),
        przyciski: ile('button, [role=button]'),
        frazyPustego: frazy.filter((f) => tekst.toLowerCase().includes(f.toLowerCase())),
        // „Lista awaryjna" harnessu — inaczej policzylibyśmy ją jako bogaty ekran.
        listaAwaryjna: tekst.startsWith('Dev Render Harness Unknown'),
      };
    }, PUSTE_FRAZY);
    m.danych = m.wierszeTabel + m.elementyList + m.polaWartosci;
    wyniki.push({ ...e, ...m });
  } catch (err) {
    wyniki.push({ ...e, blad: String(err && err.message).slice(0, 120) });
  }
  await kontekst.close();
}
await przegladarka.close();

wyniki.sort((a, b) => (a.danych ?? -1) - (b.danych ?? -1));

const kolumna = (s, n) => String(s).padEnd(n).slice(0, n);
console.log(
  `${'jednostek'.padStart(9)} ${'znaki'.padStart(6)} ${'wiersze'.padStart(7)} ${'listy'.padStart(5)} ${'pola'.padStart(4)}  ekran`
);
for (const w of wyniki) {
  if (w.blad) {
    console.log(`${'BŁĄD'.padStart(9)} ${' '.repeat(25)} ${kolumna(w.id, 40)} ${w.blad}`);
    continue;
  }
  const flaga = w.listaAwaryjna ? ' ← LISTA AWARYJNA' : w.frazyPustego.length ? ` ← ${w.frazyPustego[0]}` : '';
  console.log(
    `${String(w.danych).padStart(9)} ${String(w.znaki).padStart(6)} ${String(w.wierszeTabel).padStart(7)} ${String(
      w.elementyList
    ).padStart(5)} ${String(w.polaWartosci).padStart(4)}  ${kolumna(w.id, 40)}${flaga}`
  );
}

const ok = wyniki.filter((w) => !w.blad);
const mediana = ok.length ? ok[Math.floor(ok.length / 2)].danych : 0;
console.log(`\nzmierzonych: ${ok.length} · mediana jednostek danych: ${mediana}`);
console.log('Jednostka danych = wiersz tabeli + element listy + pole wartości.');
console.log('To NIE jest ocena wyglądu — to zawężenie listy ekranów do obejrzenia okiem.');

if (WYJ) {
  fs.writeFileSync(path.resolve(ROOT, WYJ), JSON.stringify(wyniki, null, 1), 'utf8');
  console.log(`Zapisano → ${WYJ}`);
}
