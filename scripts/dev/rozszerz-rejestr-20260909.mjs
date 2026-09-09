#!/usr/bin/env node
// Jednorazowy skrypt PORZĄDKI-1 / ZADANIE B (09.09.2026) — MUTACJA rejestru.
//
// Stosuje rozjazdy wyliczone przez porownanie-rejestr-przyrzad-20260909.mjs:
// dla każdego pliku, którego "moduł wg przyrządu" (pomiar-jezyka.mjs) różni się
// od "modułu wg rejestru" (docs/program/MVP_FINAL_ZAMROZONE.json), przenosi go
// do właściwego klucza "pliki" (usuwa ze starego, jeśli tam był).
//
// UWAGA: docs/program/MVP_FINAL_ZAMROZONE.json niesie komentarz „Zapis robi
// WYŁĄCZNIE scripts/mvp-final/zamroz.mjs — nie edytuj tego pliku ręcznie."
// zamroz.mjs liczy członkostwo modułu WŁASNYM algorytmem (moduly.mjs:
// terytorium+osiągalność, reguły R1/R2/R3) — to inny system niż regex
// pomiar-jezyka.mjs i tu NIE jest używany do przeliczenia całości. Ten skrypt
// dotyka WYŁĄCZNIE pola "pliki" każdego modułu (członkostwo wg przyrządu
// językowego, decyzja właściciela z 09.09: "mapa przyrządu = prawda") —
// zamrozono/decyzja/tag/commit/wzorce/katalogi_zrzutow zostają nietknięte.
// Format zapisu identyczny jak zamroz.mjs: JSON.stringify(rejestr, null, 1).

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const REJESTR_SCIEZKA = path.join(ROOT, 'docs/program/MVP_FINAL_ZAMROZONE.json');
const ROZJAZDY_SCIEZKA = process.argv[2] || '/tmp/rozjazdy.json';

const dane = JSON.parse(fs.readFileSync(ROZJAZDY_SCIEZKA, 'utf8'));
const rejestr = JSON.parse(fs.readFileSync(REJESTR_SCIEZKA, 'utf8'));

let przeniesienia = 0;
let dopisania = 0;

for (const r of dane.rozjazdy) {
  const { plik, aktualnyKlucz, oczekiwanyKlucz } = r;
  if (aktualnyKlucz) {
    const stara = rejestr.moduly[aktualnyKlucz].pliki;
    const idx = stara.indexOf(plik);
    if (idx !== -1) stara.splice(idx, 1);
    przeniesienia++;
  } else {
    dopisania++;
  }
  const nowa = rejestr.moduly[oczekiwanyKlucz].pliki;
  if (!nowa.includes(plik)) nowa.push(plik);
}

for (const klucz of Object.keys(rejestr.moduly)) {
  rejestr.moduly[klucz].pliki.sort();
}

rejestr._zaktualizowano = new Date().toISOString().slice(0, 10);

fs.writeFileSync(REJESTR_SCIEZKA, JSON.stringify(rejestr, null, 1) + '\n');

console.log(`Zastosowano ${dane.rozjazdy.length} zmian (${przeniesienia} przeniesień z innego modułu, ${dopisania} zupełnie nowych wpisów).`);
