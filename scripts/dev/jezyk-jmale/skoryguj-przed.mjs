/**
 * KOREKTA liczb PRZED tym samym przyrządem, którym zmierzono PO.
 *
 * Powód (lekcja J7b): pomiar PRZED szedł WCZEŚNIEJSZĄ wersją `zrzuty-jmale.mjs`.
 * W trakcie paczki przyrząd poprawiono cztery razy — „problem"/„model"/„mar" jako
 * słowa identyczne w obu językach, i wiadro DANE rozszerzone o tabele Wyników,
 * Spotkań, Audytów oraz o payload agregatu inicjatyw. Porównanie „653 → 0" liczone
 * DWOMA różnymi przyrządami nie jest dowodem, tylko złudzeniem.
 *
 * Ten skrypt bierze linie zapisane w plikach `<zrzut>.png.json` z fazy PRZED
 * (pole `ui`) i przepuszcza je przez AKTUALNY klasyfikator — ten sam, którym
 * policzono PO. Wynik ląduje w `_podsumowanie_skorygowane.json` obok oryginału;
 * oryginał zostaje, żeby było widać, co i o ile się zmieniło.
 *
 * Uruchomienie: node scripts/dev/jezyk-jmale/skoryguj-przed.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

import { ZAPYTANIA_DANE } from './dane-zapytania.mjs';

const KORZEN = path.resolve(process.cwd(), 'evidence/jezyk-jmale');
const ZRZUTY = path.resolve(process.cwd(), 'scripts/dev/jezyk-jmale/zrzuty-jmale.mjs');

// Wyciągamy z przyrządu DOKŁADNIE te same listy, których użył do fazy PO —
// czytamy je z pliku, zamiast przepisywać (przepisana kopia rozjedzie się przy
// pierwszej poprawce i znowu będziemy porównywać dwa różne przyrządy).
const zrodlo = fs.readFileSync(ZRZUTY, 'utf8');
function wytnijSet(nazwa) {
  const start = zrodlo.indexOf(`const ${nazwa} = new Set([`);
  if (start < 0) throw new Error(`nie znalazłem ${nazwa} w ${ZRZUTY}`);
  const koniec = zrodlo.indexOf(']);', start);
  const cialo = zrodlo.slice(start + `const ${nazwa} = new Set([`.length, koniec);
  return new Set(
    [...cialo.matchAll(/'([^']*)'/g)].map((m) => m[1]).filter(Boolean)
  );
}
const PL_SLOWA = wytnijSet('PL_SLOWA');
const EN_SLOWA = wytnijSet('EN_SLOWA');
const NEUTRALNE = wytnijSet('NEUTRALNE');
const DIAKRYTYKI = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/;

// Wiadro DANE — te same zapytania co w przyrządzie, wycięte z jego źródła.
const sql = (q) =>
  execSync(
    `docker exec consultify-pg18 psql -U postgres -d consultify_kopia_final -Atc "${q.replace(/"/g, '\\"')}"`,
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
  ).trim();
const DANE = new Set();
for (const q of ZAPYTANIA_DANE) {
  try {
    for (const v of sql(q).split('\n')) {
      const s = v.trim();
      if (s) DANE.add(s.toLowerCase());
    }
  } catch {
    /* tabela może nie istnieć — tak samo jak w przyrządzie */
  }
}
const DANE_LISTA = [...DANE];
function czyDane(linia) {
  const l = linia.toLowerCase().trim();
  if (!l) return false;
  if (DANE.has(l)) return true;
  const ucieta = l.replace(/(\.\.\.|…)$/, '').trim();
  if (ucieta.length >= 8 && DANE_LISTA.some((d) => d.startsWith(ucieta))) return true;
  return DANE_LISTA.some((d) => d.length >= 12 && l.includes(d));
}

function obceSlowa(linia, lang) {
  const czysty = linia.replace(/https?:\/\/\S+/g, ' ');
  const slowa = czysty.split(/[^A-Za-zĄąĆćĘęŁłŃńÓóŚśŹźŻż]+/).filter(Boolean);
  const trafienia = [];
  if (lang === 'en') {
    for (const w of slowa) {
      const l = w.toLowerCase();
      if (NEUTRALNE.has(l)) continue;
      if (DIAKRYTYKI.test(w) || PL_SLOWA.has(l)) trafienia.push(w);
    }
  } else {
    if (DIAKRYTYKI.test(czysty)) return [];
    for (const w of slowa) {
      const l = w.toLowerCase();
      if (NEUTRALNE.has(l)) continue;
      if (EN_SLOWA.has(l)) trafienia.push(w);
    }
  }
  return [...new Set(trafienia)];
}

const raport = {};
for (const modul of fs.readdirSync(KORZEN)) {
  const katalog = path.join(KORZEN, modul, 'przed');
  if (!fs.existsSync(katalog)) continue;
  raport[modul] = { en: 0, pl: 0, enOryginal: 0, plOryginal: 0, ekrany: {} };
  for (const plik of fs.readdirSync(katalog)) {
    if (!plik.endsWith('.png.json')) continue;
    const meta = JSON.parse(fs.readFileSync(path.join(katalog, plik), 'utf8'));
    const lang = meta.jezyk;
    let obce = 0;
    let przeniesioneDoDanych = 0;
    for (const wiersz of meta.ui || []) {
      if (czyDane(wiersz.linia)) {
        przeniesioneDoDanych += 1;
        continue;
      }
      obce += obceSlowa(wiersz.linia, lang).length;
    }
    raport[modul][lang] += obce;
    raport[modul][lang === 'en' ? 'enOryginal' : 'plOryginal'] += meta.obcychSlowUI || 0;
    raport[modul].ekrany[plik.replace('.png.json', '')] = {
      obceSkorygowane: obce,
      obceOryginal: meta.obcychSlowUI || 0,
      liniiPrzeniesionychDoDanych: przeniesioneDoDanych,
    };
  }
  fs.writeFileSync(
    path.join(katalog, '_podsumowanie_skorygowane.json'),
    JSON.stringify(raport[modul], null, 1)
  );
  console.log(
    `${modul}: EN ${raport[modul].enOryginal} -> ${raport[modul].en}, PL ${raport[modul].plOryginal} -> ${raport[modul].pl}`
  );
}
