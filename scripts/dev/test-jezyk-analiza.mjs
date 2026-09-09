/**
 * TEST-JEZYK — ANALIZA A1-A7 nad zrzutami tekstu z test-jezyk-master-zrzuty.mjs.
 *
 * Czyta evidence/test-jezyk-dane-0909/jezyk/{en,pl}/<modul>/*.txt (innerText)
 * + captures-manifest.json, liczy:
 *   A1 polskie słowa w EN (diakrytyki + słownik pomiar-jezyka.mjs + polski-bez-ogonkow.mjs)
 *   A2 surowe klucze i18n / undefined|null|[object w EN
 *   A3 wzorce dat/liczb PL w EN (i odwrotnie) — heurystyka regexowa, do potwierdzenia okiem
 *   A4 surowe enumy (SNAKE_CASE / snake_case) w EN
 *   A5 angielskie słowa chrome w PL (lista słów z KRYTERIA.md)
 *   A6 liczba linii tekstu EN vs PL per ekran (proxy „ten sam układ")
 *   A7 potwierdzenie zrzutem po przełączeniu (osobny plik 00-przelaczenie)
 *
 * WYJŚCIE: evidence/test-jezyk-dane-0909/jezyk/analiza-A1-A7.json (surowe liczby + przykłady)
 * Użycie: node scripts/dev/test-jezyk-analiza.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { wykryjPolski, wykryjAngielski } from '../i18n/pomiar-jezyka.mjs';
import { wykryjPolskiBezOgonkow } from '../i18n/polski-bez-ogonkow.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const OUT = path.join(ROOT, 'evidence/test-jezyk-dane-0909/jezyk');

const manifest = JSON.parse(fs.readFileSync(path.join(OUT, 'captures-manifest.json'), 'utf8'));

// A2: surowe klucze i18n — moduł.sekcja.klucz (min. 2 kropki) + undefined/null/[object
const RE_KLUCZ = /\b[a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9_-]+){2,}\b/g;
const RE_UNDEF = /\b(undefined|null|\[object)\b/g;

// A4: surowe enumy
const RE_ENUM_UPPER = /\b[A-Z]{3,}(_[A-Z]+)+\b/g;
const RE_ENUM_SNAKE = /\b[a-z]+(_[a-z]+)+\b/g;

// A3: daty/liczby
const RE_DATA_PL = /\b\d{1,2}\.\d{1,2}\.\d{4}\b/g;
const RE_MIESIAC_PL = /\b(sty|lut|mar|kwi|maj|cze|lip|sie|wrz|paź|paz|lis|gru)\b/gi;
const RE_KWOTA_PL = /\b\d+,\d{2}\s?(zł|PLN)\b/gi;
const RE_MIESIAC_EN = /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/g;

// A5: słowa chrome EN (z KRYTERIA.md) — sprawdzane w PL
const CHROME_EN_SLOWA =
  /\b(Save|Cancel|Add|Delete|Edit|Search|Filter|Loading|Settings|Dashboard|Overview|Details|Status|Owner|Name|Description|Actions|Close|Back|Next|Submit|Create|New|Export|Import|Preview|Report|Reports|Tasks|Task|Initiative|Initiatives|Meeting|Meetings|Members|Team|Profile|Security|Notifications|Language|Sign out|Log in)\b/g;

// Wyjątki: identyfikatory/kody, nazwy własne, skróty tożsame PL/EN — nie liczymy jako trafienie.
const NEUTRALNE = new Set([
  'consultify', 'dbr77', 'teresa', 'northwind', 'pdf', 'ai', 'qa', 'kpi', 'roi', 'crm', 'id',
  'url', 'api', 'nda', 'vat', 'eur', 'pln', 'gbp', 'okr', 'jw', 'stm',
]);

function linie(tekst) {
  return String(tekst)
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length >= 2);
}

function policzA1(tekst) {
  const trafienia = [];
  for (const linia of linie(tekst)) {
    const p1 = wykryjPolski(linia);
    const p2 = !p1 ? wykryjPolskiBezOgonkow(linia) : null;
    if (p1 || p2) {
      trafienia.push({ tekst: linia.slice(0, 140), dowod: (p1 || p2).dowod?.join(',') || 'bezOgonkow' });
    }
  }
  return dedupe(trafienia);
}

function policzA5(tekst) {
  const trafienia = [];
  for (const linia of linie(tekst)) {
    // Pomijamy komórki danych (linie z northwind/@ - adresy email danych) - najlepszy wysiłek.
    const m = [...linia.matchAll(CHROME_EN_SLOWA)].map((x) => x[0]);
    if (m.length) trafienia.push({ tekst: linia.slice(0, 140), slowa: [...new Set(m)] });
  }
  return dedupe(trafienia);
}

function policzRegex(tekst, re) {
  const wynik = new Set();
  for (const m of tekst.matchAll(re)) {
    const val = m[0];
    if (NEUTRALNE.has(val.toLowerCase())) continue;
    wynik.add(val);
  }
  return [...wynik];
}

function dedupe(arr) {
  const widziane = new Set();
  const out = [];
  for (const t of arr) {
    const key = t.tekst;
    if (widziane.has(key)) continue;
    widziane.add(key);
    out.push(t);
  }
  return out;
}

function znajdzPliki(lang) {
  const dir = path.join(OUT, lang);
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const modDir of fs.readdirSync(dir)) {
    const modPath = path.join(dir, modDir);
    if (!fs.statSync(modPath).isDirectory()) continue;
    for (const f of fs.readdirSync(modPath)) {
      if (f.endsWith('.txt')) {
        out.push({ modul: modDir, ekran: f.replace('.txt', ''), plik: path.join(modPath, f) });
      }
    }
  }
  return out;
}

const wynik = { data: new Date().toISOString(), en: {}, pl: {}, porownanieA6: [] };

for (const lang of ['en', 'pl']) {
  const pliki = znajdzPliki(lang);
  for (const { modul, ekran, plik } of pliki) {
    const tekst = fs.readFileSync(plik, 'utf8');
    wynik[lang][modul] = wynik[lang][modul] || {};
    const a1 = lang === 'en' ? policzA1(tekst) : [];
    const a2klucze = lang === 'en' ? policzRegex(tekst, RE_KLUCZ) : [];
    const a2undef = lang === 'en' ? policzRegex(tekst, RE_UNDEF) : [];
    const a3dataPl = lang === 'en' ? policzRegex(tekst, RE_DATA_PL) : [];
    const a3miesiacPl = lang === 'en' ? policzRegex(tekst, RE_MIESIAC_PL) : [];
    const a3kwotaPl = lang === 'en' ? policzRegex(tekst, RE_KWOTA_PL) : [];
    const a3miesiacEnWPl = lang === 'pl' ? policzRegex(tekst, RE_MIESIAC_EN) : [];
    const a4upper = policzRegex(tekst, RE_ENUM_UPPER);
    const a4snake = policzRegex(tekst, RE_ENUM_SNAKE);
    const a5 = lang === 'pl' ? policzA5(tekst) : [];
    wynik[lang][modul][ekran] = {
      dlugosc: tekst.length,
      linieOgolem: linie(tekst).length,
      A1_polskieWEN: a1.length,
      A1_przyklady: a1.slice(0, 15),
      A2_surowyKlucz: a2klucze.length,
      A2_przykladyKlucz: a2klucze.slice(0, 15),
      A2_undefinedNull: a2undef.length,
      A3_dataPlWEN: a3dataPl.length,
      A3_miesiacPlWEN: a3miesiacPl.length,
      A3_kwotaPlWEN: a3kwotaPl.length,
      A3_miesiacEnWPL: a3miesiacEnWPl.length,
      A4_enumUpper: a4upper.length,
      A4_enumUpperPrzyklady: a4upper.slice(0, 10),
      A4_enumSnake: a4snake.length,
      A4_enumSnakePrzyklady: a4snake.slice(0, 10),
      A5_angielskieWPL: a5.length,
      A5_przyklady: a5.slice(0, 15),
    };
  }
}

// A6: porównanie liczby linii EN vs PL dla tych samych ekranów (proxy identyczności układu)
const enEkrany = new Set();
for (const modul of Object.keys(wynik.en)) {
  for (const ekran of Object.keys(wynik.en[modul])) enEkrany.add(`${modul}/${ekran}`);
}
for (const modul of Object.keys(wynik.pl)) {
  for (const ekran of Object.keys(wynik.pl[modul])) {
    const key = `${modul}/${ekran}`;
    if (wynik.en[modul] && wynik.en[modul][ekran]) {
      const enL = wynik.en[modul][ekran].linieOgolem;
      const plL = wynik.pl[modul][ekran].linieOgolem;
      const delta = Math.abs(enL - plL);
      wynik.porownanieA6.push({
        modul,
        ekran,
        linieEN: enL,
        liniePL: plL,
        delta,
        podejrzane: delta > Math.max(3, enL * 0.15),
      });
    } else {
      wynik.porownanieA6.push({ modul, ekran, uwaga: 'brak odpowiednika EN — ekran tylko w PL' });
    }
  }
}
for (const key of enEkrany) {
  const [modul, ekran] = key.split('/');
  if (!(wynik.pl[modul] && wynik.pl[modul][ekran])) {
    wynik.porownanieA6.push({ modul, ekran, uwaga: 'brak odpowiednika PL — ekran tylko w EN (podejrzenie: zniknął po przełączeniu)' });
  }
}

fs.writeFileSync(path.join(OUT, 'analiza-A1-A7.json'), JSON.stringify(wynik, null, 1));

// Podsumowanie konsolowe
let sumaA1 = 0, sumaA2 = 0, sumaA4en = 0, sumaA5 = 0;
for (const modul of Object.keys(wynik.en)) {
  for (const ekran of Object.keys(wynik.en[modul])) {
    const e = wynik.en[modul][ekran];
    sumaA1 += e.A1_polskieWEN;
    sumaA2 += e.A2_surowyKlucz + e.A2_undefinedNull;
    sumaA4en += e.A4_enumUpper + e.A4_enumSnake;
  }
}
for (const modul of Object.keys(wynik.pl)) {
  for (const ekran of Object.keys(wynik.pl[modul])) {
    sumaA5 += wynik.pl[modul][ekran].A5_angielskieWPL;
  }
}
console.log(`RAZEM EN: A1(polskie)=${sumaA1} A2(klucze+undef)=${sumaA2} A4(enumy)=${sumaA4en}`);
console.log(`RAZEM PL: A5(angielskie chrome)=${sumaA5}`);
const podejrzaneA6 = wynik.porownanieA6.filter((x) => x.podejrzane || x.uwaga);
console.log(`A6 podejrzanych rozjazdów: ${podejrzaneA6.length}`);
console.log(JSON.stringify(podejrzaneA6.slice(0, 20), null, 1));
