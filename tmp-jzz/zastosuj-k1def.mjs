/**
 * Zamiana polskich `defaultValue` w `t('klucz','Polski')` na angielskie.
 * Przed podmianą upewnia się, że klucz ma polską wartość w pl/translation.json
 * (inaczej Polak zobaczyłby angielski) i angielską w en/translation.json.
 */
import fs from 'node:fs';

const mapa = JSON.parse(fs.readFileSync('tmp-jzz/mapa-en.json', 'utf8'));
const wpisy = JSON.parse(fs.readFileSync('tmp-jzz/k1def.json', 'utf8'));

const wczytaj = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const pl = wczytaj('public/locales/pl/translation.json');
const en = wczytaj('public/locales/en/translation.json');

const get = (obj, klucz) => klucz.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
const set = (obj, klucz, wart) => {
  const czesci = klucz.split('.');
  let cur = obj;
  for (const k of czesci.slice(0, -1)) {
    if (typeof cur[k] !== 'object' || cur[k] === null) cur[k] = {};
    cur = cur[k];
  }
  cur[czesci[czesci.length - 1]] = wart;
};

const raport = { dodanePl: [], dodaneEn: [], podmienione: 0, pominiete: [], kolizje: [] };
const perPlik = new Map();

for (const w of wpisy) {
  const enTekst = mapa[w.pl];
  if (!enTekst) {
    raport.pominiete.push(`${w.klucz} :: ${w.pl}`);
    continue;
  }
  const istniejacyPl = get(pl, w.klucz);
  if (typeof istniejacyPl !== 'string') {
    set(pl, w.klucz, w.pl);
    raport.dodanePl.push(w.klucz);
  } else if (istniejacyPl !== w.pl) {
    // klucz ma juz inna polska wartosc — to wygrywa nad defaultem, nie ruszam
    raport.kolizje.push(`${w.klucz}: json="${istniejacyPl}" vs default="${w.pl}"`);
  }
  const istniejacyEn = get(en, w.klucz);
  if (typeof istniejacyEn !== 'string') {
    set(en, w.klucz, enTekst);
    raport.dodaneEn.push(w.klucz);
  }
  if (!perPlik.has(w.plik)) perPlik.set(w.plik, []);
  perPlik.get(w.plik).push([w.pl, enTekst]);
}

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
for (const [plik, pary] of perPlik) {
  let tresc = fs.readFileSync(plik, 'utf8');
  for (const [plTekst, enTekst] of pary) {
    // podmieniamy WYLACZNIE caly literal drugiego argumentu t(), nigdy fragment
    const wz = new RegExp(`(\\bt\\(\\s*(["'\`])[A-Za-z0-9_$]+(?:\\.[A-Za-z0-9_$\\[\\]]+)+\\2\\s*,\\s*)(["'])${esc(plTekst)}\\3`, 'g');
    const przed = tresc;
    tresc = tresc.replace(wz, (m, glowa, _q1, q) => `${glowa}${q}${enTekst}${q}`);
    if (tresc !== przed) raport.podmienione += 1;
  }
  fs.writeFileSync(plik, tresc);
}

fs.writeFileSync('public/locales/pl/translation.json', JSON.stringify(pl, null, 2));
fs.writeFileSync('public/locales/en/translation.json', JSON.stringify(en, null, 2));
console.log(JSON.stringify(raport, null, 1).slice(0, 4000));
