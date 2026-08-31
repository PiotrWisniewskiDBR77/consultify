#!/usr/bin/env node
/**
 * MECHANICZNA BRAMKA KONTROLNA KART PRZED ODBIOREM
 *
 * POWÓD ISTNIENIA (2026-08-31): oko przywyka do stałych elementów kadru.
 * Poprzednia sesja oglądała zrzuty bez wiedzy o ich starości — katalogi
 * sortowały się alfabetycznie zamiast chronologicznie, a skrypt brał
 * ostatni napotkany plik z `fs.readdirSync`, co mogło dać stan sprzed
 * napraw na 120 z 229 kart. Bramka ta czyta mtimeMs (czas modyfikacji)
 * każdego zrzutu, wybiera NAJNOWSZY, i raportuje MECHANICZNIE o brakach,
 * starości i rozmiarze — bez uważności nadzorcy, która zawodzi.
 *
 * OBSŁUGIWANE FLAGI:
 *  --modul=<katalog>      Ograniczenie do jednego modułu (np. 01-czat)
 *  --maks-wiek-godzin=N   Próg starości zrzutu w godzinach (domyślnie 24)
 *  --min-bajtow=N         Minimalny rozmiar w bajtach (domyślnie 20000)
 *  --cicho                Tylko podsumowanie, bez listy ekranów
 *
 * ZWRACANE KATEGORIE PROBLEMÓW:
 *  - BRAK ZRZUTU: ekran nie ma pliku w danym motywie (light/dark)
 *  - TYLKO PRZED: najnowszy zrzut ma fazę PRZED, czyli pokazujemy stan sprzed napraw
 *  - STARY ZRZUT: plik starszy niż podany próg
 *  - PODEJRZANIE MAŁY PLIK: rozmiar poniżej minimalnego (zwykle pusty/biały ekran)
 *
 * Kod wyjścia: 1 jeśli są problemy, 0 jeśli czysto.
 *
 * Uruchomienie:
 *   node scripts/dev/odbior-kontrola.mjs
 *   node scripts/dev/odbior-kontrola.mjs --maks-wiek-godzin=200 --cicho
 *   node scripts/dev/odbior-kontrola.mjs --modul=01-czat
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const STATUS_FILE = path.join(ROOT, 'docs/program/grafika/status.json');
const EVIDENCE_DIR = path.join(ROOT, 'evidence/grafika');

// Parsuj flagi
let modulFilter = null;
let maksWiekGodzin = 24;
let minBajtow = 20000;
let cichyTryb = false;

for (const arg of process.argv.slice(2)) {
  if (arg.startsWith('--modul=')) {
    modulFilter = arg.slice(8);
  } else if (arg.startsWith('--maks-wiek-godzin=')) {
    maksWiekGodzin = Number(arg.slice(19));
  } else if (arg.startsWith('--min-bajtow=')) {
    minBajtow = Number(arg.slice(13));
  } else if (arg === '--cicho') {
    cichyTryb = true;
  }
}

const teraz = Date.now();
const maksWiekMs = maksWiekGodzin * 60 * 60 * 1000;

// Wczytaj status.json
let status;
try {
  status = JSON.parse(fs.readFileSync(STATUS_FILE, 'utf8'));
} catch (e) {
  console.error(`Nie mogę wczytać ${STATUS_FILE}: ${e.message}`);
  process.exit(1);
}

// Zbuduj indeks zrzutów: { id → { motyw → { faza → { sciezka, mtime, rozmiar } } } }
function indeksZrzutow() {
  const out = {};
  try {
    for (const dir of fs.readdirSync(EVIDENCE_DIR)) {
      const fullDir = path.join(EVIDENCE_DIR, dir);
      let isDir = false;
      try {
        isDir = fs.statSync(fullDir).isDirectory();
      } catch {
        continue;
      }
      if (!isDir) continue;

      for (const f of fs.readdirSync(fullDir)) {
        if (!f.endsWith('.png')) continue;

        // Kanon: <id>__<FAZA>__<motyw>.png
        // Pliki spoza tego wzorca (np. ręczne zrzuty) pomijamy.
        const czesci = f.split('__');
        if (czesci.length < 3) continue;

        const [id, faza, motywPng] = czesci;
        const motyw = motywPng.replace('.png', '');

        // Sprawdzenie: czy motyw to rzeczywiście light/dark?
        // (zdywersyfikuje się, ale na razie filtrujemy sztywno)
        if (!['light', 'dark'].includes(motyw)) continue;

        const pelna = path.join(fullDir, f);
        let stat;
        try {
          stat = fs.statSync(pelna);
        } catch {
          continue;
        }

        const mtime = stat.mtimeMs;
        const rozmiar = stat.size;

        out[id] ??= {};
        out[id][motyw] ??= {};

        const obecny = out[id][motyw][faza];
        // Jeśli już mamy ten faza__motyw, wybierz NOWSZY plik po mtime
        if (!obecny || mtime > obecny.mtime) {
          out[id][motyw][faza] = { sciezka: path.join(dir, f), mtime, rozmiar };
        }
      }
    }
  } catch (e) {
    console.error(`Błąd przy czytaniu ${EVIDENCE_DIR}: ${e.message}`);
  }
  return out;
}

const zrzuty = indeksZrzutow();

// Zbierz ekrany do sprawdzenia
const ekranyAB = [];
for (const m of status.moduly) {
  if (modulFilter && m.katalog !== modulFilter) continue;
  for (const e of m.ekrany) {
    if (e.ocena === 'A' || e.ocena === 'B') {
      ekranyAB.push({ ...e, modul: m });
    }
  }
}

// Zbierz problemy
const problemy = {
  'BRAK ZRZUTU': [],
  'TYLKO PRZED': [],
  'STARY ZRZUT': [],
  'PODEJRZANIE MAŁY PLIK': [],
};

for (const ekran of ekranyAB) {
  const z = zrzuty[ekran.id] || {};

  for (const motyw of ['light', 'dark']) {
    const zrzuty_motyw = z[motyw] || {};

    // Wolę PO, ale biorę co jest — najpierw PO, potem PRZED
    const wybranyZrzut = zrzuty_motyw.PO || zrzuty_motyw.PRZED;

    if (!wybranyZrzut) {
      // Brak zrzutu w tym motywie
      problemy['BRAK ZRZUTU'].push({
        ekran: ekran.id,
        nazwa: ekran.nazwa,
        motyw,
        modul: ekran.modul.nazwa,
      });
      continue;
    }

    // Rozpoznaj fazę
    const faza = zrzuty_motyw.PO ? 'PO' : 'PRZED';

    if (faza === 'PRZED') {
      problemy['TYLKO PRZED'].push({
        ekran: ekran.id,
        nazwa: ekran.nazwa,
        motyw,
        modul: ekran.modul.nazwa,
      });
      continue;
    }

    // Sprawdź wiek
    const wiekMs = teraz - wybranyZrzut.mtime;
    if (wiekMs > maksWiekMs) {
      const wiekGodzin = Math.round(wiekMs / (60 * 60 * 1000));
      problemy['STARY ZRZUT'].push({
        ekran: ekran.id,
        nazwa: ekran.nazwa,
        motyw,
        modul: ekran.modul.nazwa,
        wiekGodzin,
        prog: maksWiekGodzin,
      });
      continue;
    }

    // Sprawdź rozmiar
    if (wybranyZrzut.rozmiar < minBajtow) {
      problemy['PODEJRZANIE MAŁY PLIK'].push({
        ekran: ekran.id,
        nazwa: ekran.nazwa,
        motyw,
        modul: ekran.modul.nazwa,
        rozmiar: wybranyZrzut.rozmiar,
        prog: minBajtow,
      });
    }
  }
}

// Raportuj
const maProblemy = Object.values(problemy).some((v) => v.length > 0);

if (!cichyTryb) {
  for (const [kategoria, lista] of Object.entries(problemy)) {
    if (lista.length === 0) continue;
    console.log(`\n${kategoria} (${lista.length}):`);
    const pokazanych = lista.slice(0, 30);
    for (const p of pokazanych) {
      const motyw_short = p.motyw === 'light' ? '☀' : '🌙';
      if (kategoria === 'STARY ZRZUT') {
        console.log(`  ${motyw_short} ${p.ekran}: ${p.wiekGodzin}h (próg ${p.prog}h)`);
      } else if (kategoria === 'PODEJRZANIE MAŁY PLIK') {
        console.log(`  ${motyw_short} ${p.ekran}: ${p.rozmiar} B (próg ${p.prog} B)`);
      } else {
        console.log(`  ${motyw_short} ${p.ekran}`);
      }
    }
    if (lista.length > 30) {
      console.log(`  … i jeszcze ${lista.length - 30} pozycji`);
    }
  }
}

// Podsumowanie
console.log('\n' + '='.repeat(60));
const sumaProblemy = Object.values(problemy).reduce((sum, v) => sum + v.length, 0);
const liczbaBezProblemy = ekranyAB.length * 2 - sumaProblemy; // każdy ekran ma light + dark

console.log(`Kart A/B: ${ekranyAB.length} (${ekranyAB.length * 2} motywy)`);
console.log(`Bez zastrzeżeń: ${liczbaBezProblemy}`);
if (maProblemy) {
  console.log(`\nPROBLEMY:`);
  for (const [kategoria, lista] of Object.entries(problemy)) {
    if (lista.length > 0) {
      console.log(`  • ${kategoria}: ${lista.length}`);
    }
  }
}

console.log('='.repeat(60));

if (maProblemy) {
  console.log('\nWynik: SĄ PROBLEMY — nie oddawaj właścicielowi.');
  process.exit(1);
} else {
  console.log('\nWynik: CZYSTO — można oddawać.');
  process.exit(0);
}
