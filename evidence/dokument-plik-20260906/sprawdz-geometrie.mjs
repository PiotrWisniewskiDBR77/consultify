#!/usr/bin/env node
/**
 * sprawdz-geometrie.mjs — mechaniczna kontrola układu slajdów w GOTOWYM .pptx.
 *
 * Czyta `ppt/slides/slideN.xml` prosto z pliku (a nie model, z którego plik
 * powstał) — bo dowodem ma być plik, który dostanie klient, nie intencja
 * renderera. Sprawdza dwie rzeczy:
 *   1. żadne pole NIOSĄCE TEKST nie wychodzi poza krawędź slajdu,
 *   2. żadne dwa pola niosące tekst nie przecinają się.
 * Pola bez tekstu (linie włoskowe, prostokąt tła pod liczbą KPI) są celowo
 * pomijane — one MAJĄ leżeć pod tekstem; sprawdzanie ich jako „nachodzenia"
 * dałoby fałszywy alarm i niczego nie broniło.
 *
 * Użycie: node sprawdz-geometrie.mjs <plik.pptx>
 * Wyjście: 0 = zero naruszeń; 1 = naruszenia (wypisane).
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const EMU = 914400; // EMU na cal
const TOLERANCJA = 0.01; // cal — margines na zaokrąglenia renderera

const plik = process.argv[2];
if (!plik || !existsSync(plik)) {
  console.error('Użycie: node sprawdz-geometrie.mjs <plik.pptx>');
  process.exit(2);
}

const lista = execFileSync('unzip', ['-Z1', plik], { encoding: 'utf8' })
  .split('\n')
  .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
  .sort((a, b) => Number(a.match(/(\d+)/)[1]) - Number(b.match(/(\d+)/)[1]));

if (lista.length === 0) {
  console.error('BŁĄD: w pliku nie ma ani jednego slajdu.');
  process.exit(1);
}

// Rozmiar slajdu z presentation.xml — nie zakładamy 16:9 „bo tak".
const prezentacja = execFileSync('unzip', ['-p', plik, 'ppt/presentation.xml'], {
  encoding: 'utf8',
});
const rozmiar = prezentacja.match(/<p:sldSz[^>]*cx="(\d+)"[^>]*cy="(\d+)"/);
const SZER = Number(rozmiar[1]) / EMU;
const WYS = Number(rozmiar[2]) / EMU;

/** Wycina bloki najwyższego poziomu o podanych nazwach z drzewa spTree. */
function bloki(xml, nazwy) {
  const wynik = [];
  for (const nazwa of nazwy) {
    const otwarcie = new RegExp(`<${nazwa}(?:\\s|>)`, 'g');
    let m;
    while ((m = otwarcie.exec(xml))) {
      let poziom = 0;
      let i = m.index;
      let koniec = -1;
      const tagOtw = new RegExp(`<${nazwa}(?:\\s|>)`, 'g');
      const tagZam = new RegExp(`</${nazwa}>`, 'g');
      tagOtw.lastIndex = m.index;
      tagZam.lastIndex = m.index;
      let nOtw = tagOtw.exec(xml);
      let nZam = tagZam.exec(xml);
      while (nZam) {
        if (nOtw && nOtw.index < nZam.index) {
          poziom += 1;
          nOtw = tagOtw.exec(xml);
          continue;
        }
        poziom -= 1;
        if (poziom === 0) {
          koniec = nZam.index + nZam[0].length;
          break;
        }
        nZam = tagZam.exec(xml);
      }
      if (koniec > i) {
        wynik.push(xml.slice(i, koniec));
        otwarcie.lastIndex = koniec;
      }
    }
  }
  return wynik;
}

function ramka(blok) {
  const off = blok.match(/<a:off x="(-?\d+)" y="(-?\d+)"\/>/);
  const ext = blok.match(/<a:ext cx="(\d+)" cy="(\d+)"\/>/);
  if (!off || !ext) return null;
  return {
    x: Number(off[1]) / EMU,
    y: Number(off[2]) / EMU,
    w: Number(ext[1]) / EMU,
    h: Number(ext[2]) / EMU,
  };
}

function tekst(blok) {
  return [...blok.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map((m) => m[1]).join('').trim();
}

const naruszenia = [];
let policzonePola = 0;

for (const nazwa of lista) {
  const xml = execFileSync('unzip', ['-p', plik, nazwa], { encoding: 'utf8' });
  const numer = Number(nazwa.match(/(\d+)/)[1]);
  const pola = [];

  for (const blok of bloki(xml, ['p:sp'])) {
    const r = ramka(blok);
    if (!r) continue;
    const t = tekst(blok);
    if (!t) continue; // linia/tło — celowo pod tekstem
    pola.push({ r, opis: `tekst „${t.slice(0, 40)}"` });
  }
  for (const blok of bloki(xml, ['p:graphicFrame'])) {
    const r = ramka(blok);
    if (!r) continue;
    const rodzaj = blok.includes('<a:tbl') ? 'tabela' : 'wykres';
    pola.push({ r, opis: rodzaj });
  }

  policzonePola += pola.length;

  for (const pole of pola) {
    const { r } = pole;
    if (
      r.x < -TOLERANCJA ||
      r.y < -TOLERANCJA ||
      r.x + r.w > SZER + TOLERANCJA ||
      r.y + r.h > WYS + TOLERANCJA
    ) {
      naruszenia.push(
        `slajd ${numer}: ${pole.opis} wychodzi poza krawędź — x=${r.x.toFixed(2)} y=${r.y.toFixed(2)} w=${r.w.toFixed(2)} h=${r.h.toFixed(2)} (slajd ${SZER}×${WYS})`
      );
    }
  }

  for (let i = 0; i < pola.length; i += 1) {
    for (let j = i + 1; j < pola.length; j += 1) {
      const a = pola[i].r;
      const b = pola[j].r;
      const dx = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      const dy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      if (dx > TOLERANCJA && dy > TOLERANCJA) {
        naruszenia.push(
          `slajd ${numer}: ${pola[i].opis} przecina ${pola[j].opis} — wspólny obszar ${dx.toFixed(2)}×${dy.toFixed(2)} cala`
        );
      }
    }
  }
}

console.log(`plik: ${plik}`);
console.log(`slajdy: ${lista.length}, slajd: ${SZER}" × ${WYS}", zbadane pola z tekstem: ${policzonePola}`);
if (naruszenia.length === 0) {
  console.log('GEOMETRIA OK: 0 naruszeń (brak nachodzeń, nic poza krawędzią).');
  process.exit(0);
}
console.log(`GEOMETRIA FAIL: ${naruszenia.length} naruszeń`);
for (const n of naruszenia) console.log(`  - ${n}`);
process.exit(1);
