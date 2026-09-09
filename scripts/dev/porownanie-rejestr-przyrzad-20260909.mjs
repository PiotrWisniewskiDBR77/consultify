#!/usr/bin/env node
// Jednorazowy skrypt PORZĄDKI-1 / ZADANIE B (09.09.2026).
//
// PO CO: rejestr zamrożenia MVP (docs/program/MVP_FINAL_ZAMROZONE.json) i mapa
// modułów przyrządu językowego (scripts/i18n/pomiar-jezyka.mjs, MAPA_SCIEZEK
// ok. linii 99) rozjechały się — przyrząd liczy pliki do modułu na podstawie
// ścieżki (regex), rejestr trzyma ręczną listę plików per moduł spisaną przy
// odbiorze 05.09. Ten skrypt NIE zmienia przyrządu: tworzy EFEMERYCZNĄ kopię
// scripts/i18n/pomiar-jezyka.mjs w os.tmpdir() z dopisanym eksportem
// wewnętrznych funkcji (modulZeSciezki/listujPliki są w oryginale prywatne),
// importuje ją, i kasuje zaraz po użyciu — logika jest bajt-w-bajt ta sama,
// na dysku repo nie zostaje żaden trwały duplikat.
//
// METODA: dla KAŻDEGO pliku src/**/*.{ts,tsx} (z tymi samymi wykluczeniami co
// przyrząd: __tests__/__mocks__/.test./.spec./.stories./dev-render//scripts//
// tests//demo/.d.ts — patrz scripts/i18n/pomiar-jezyka.wyjatki.json) policz:
//   - modul_wg_przyrzadu = modulZeSciezki(path), zmapowany na nazwę-klucz
//     rejestru przez KORESPONDENCJĘ (zweryfikowaną empirycznie: dla każdego
//     modułu rejestru policzono, jaki moduł-wg-przyrządu mają jego pliki;
//     wygrywa zdecydowana większość — patrz tabela niżej).
//   - modul_wg_rejestru = który klucz rejestru wymienia dokładnie tę ścieżkę
//     w swoim "pliki" (albo BRAK, gdy żaden).
// ROZJAZD = modul_wg_przyrzadu ma odpowiednik w rejestrze (nie "ZZ wspólne",
// nie "08 Results"/"09 Finance" — te dwa moduły nie są jeszcze zamrożone) ORAZ
// modul_wg_rejestru != ten odpowiednik (czyli: albo plik jest pod INNYM
// modułem rejestru — przeniesienie, albo pod ŻADNYM — dopisanie).

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

// Kopia efemeryczna przyrządu (patrz komentarz wyżej) — musi leżeć W TYM SAMYM
// katalogu co oryginał (scripts/i18n/), bo pomiar-jezyka.mjs czyta
// pomiar-jezyka.wyjatki.json po __dirname względnym.
const ORYGINAL = path.join(ROOT, 'scripts/i18n/pomiar-jezyka.mjs');
const SHIM = path.join(ROOT, 'scripts/i18n', `_shim-tmp-${process.pid}.mjs`);
fs.copyFileSync(ORYGINAL, SHIM);
fs.appendFileSync(
  SHIM,
  '\nexport { modulZeSciezki, MAPA_SCIEZEK, KLUCZ_DO_MODULU, modulZKlucza, WSPOLNE, MODULY, listujPliki, pominSciezkeRaw };\n'
);
let modulZeSciezki, listujPliki;
try {
  ({ modulZeSciezki, listujPliki } = await import(SHIM));
} finally {
  fs.unlinkSync(SHIM);
}

// KORESPONDENCJA nazwa-wg-przyrządu -> klucz rejestru (zweryfikowana 09.09
// przez policzenie większościowego modul_wg_przyrzadu dla KAŻDEGO klucza
// rejestru osobno — patrz evidence w treści commita/raportu).
const KORESPONDENCJA = {
  '01 Chat': '13_CHAT',
  '02 My Work': '07_MY_WORK_AGENT',
  '03 Interview': '02_INTERVIEW',
  '04 Tools': '03_TOOLS',
  '05 Assessment': '04_ASSESSMENT',
  '06 Initiatives': '05_INITIATIVES',
  '07 Execution': '06_EXECUTION',
  '10 Materials': '11_MATERIALS',
  '11 Audits': '12_AUDITS',
  '12 Meeting': '08_MEETINGS',
  '13 Organization': '01_ORGANIZATION',
  '14 Admin Panel': '14_ADMIN',
  '15 Settings': '15_SETTINGS',
  '16 Partner Portal': '16_PARTNER',
  // '08 Results', '09 Finance', 'ZZ wspólne' — BEZ odpowiednika (moduły
  // Results/Finance nie są jeszcze zamrożone; "ZZ wspólne" to nie moduł).
};

const REJESTR_SCIEZKA = path.join(ROOT, 'docs/program/MVP_FINAL_ZAMROZONE.json');
const rejestr = JSON.parse(fs.readFileSync(REJESTR_SCIEZKA, 'utf8'));

// path -> klucz rejestru (który go dziś wymienia); wykrywa też duplikaty
// (ten sam plik w dwóch modułach na raz — byłby to osobny, gorszy błąd).
const modulWgRejestru = new Map();
const duplikaty = [];
for (const [klucz, wpis] of Object.entries(rejestr.moduly)) {
  for (const p of wpis.pliki || []) {
    if (modulWgRejestru.has(p)) {
      duplikaty.push([p, modulWgRejestru.get(p), klucz]);
    } else {
      modulWgRejestru.set(p, klucz);
    }
  }
}

const wszystkiePliki = listujPliki(path.join(ROOT, 'src'), (n) => /\.(ts|tsx)$/.test(n));

const rozjazdy = []; // { plik, wgPrzyrzadu(nazwa), oczekiwanyKlucz, aktualnyKlucz }
for (const rel of wszystkiePliki) {
  const nazwaPrzyrzad = modulZeSciezki(rel);
  const oczekiwanyKlucz = KORESPONDENCJA[nazwaPrzyrzad];
  if (!oczekiwanyKlucz) continue; // ZZ wspólne / Results / Finance — poza zakresem
  const aktualnyKlucz = modulWgRejestru.get(rel) || null;
  if (aktualnyKlucz !== oczekiwanyKlucz) {
    rozjazdy.push({ plik: rel, wgPrzyrzadu: nazwaPrzyrzad, oczekiwanyKlucz, aktualnyKlucz });
  }
}

// Podsumowanie per para (aktualny -> oczekiwany), żeby raport był czytelny.
const grupy = new Map();
for (const r of rozjazdy) {
  const klucz = `${r.aktualnyKlucz || 'BRAK'} -> ${r.oczekiwanyKlucz}`;
  if (!grupy.has(klucz)) grupy.set(klucz, []);
  grupy.get(klucz).push(r.plik);
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ liczbaRozjazdow: rozjazdy.length, rozjazdy, duplikaty }, null, 2));
} else {
  console.log(`Zbadano plikow: ${wszystkiePliki.length}`);
  console.log(`Rozjazdow: ${rozjazdy.length}`);
  console.log(`Duplikatow (plik w >=2 modulach rejestru na raz): ${duplikaty.length}`);
  for (const [para, pliki] of [...grupy.entries()].sort((a, b) => b[1].length - a[1].length)) {
    console.log(`\n=== ${para} (${pliki.length}) ===`);
    for (const p of pliki) console.log(`  ${p}`);
  }
  if (duplikaty.length) {
    console.log(`\n=== DUPLIKATY ===`);
    for (const [p, a, b] of duplikaty) console.log(`  ${p}  [${a}] i [${b}]`);
  }
}
