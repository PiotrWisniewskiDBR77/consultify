// Wstawia pary klucz -> {pl,en} do public/locales/{pl,en}/translation.json.
// Wejście: plik JSON [{k, pl, en}] podany argumentem.
import fs from 'node:fs';
const wpisy = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
for (const [lang, pole] of [['pl','pl'],['en','en']]) {
  const sciezka = `public/locales/${lang}/translation.json`;
  const dane = JSON.parse(fs.readFileSync(sciezka, 'utf8'));
  let dodane = 0, nadpisane = 0;
  for (const w of wpisy) {
    const czesci = w.k.split('.');
    let cur = dane;
    let ok = true;
    for (const c of czesci.slice(0, -1)) {
      if (cur[c] === undefined) cur[c] = {};
      if (typeof cur[c] !== 'object' || cur[c] === null) { console.error('KOLIZJA', w.k, 'na', c); ok = false; break; }
      cur = cur[c];
    }
    if (!ok) continue;
    const last = czesci[czesci.length - 1];
    if (cur[last] === undefined) dodane++;
    else if (cur[last] !== w[pole]) { nadpisane++; }
    cur[last] = w[pole];
  }
  fs.writeFileSync(sciezka, JSON.stringify(dane, null, 2) + '\n');
  console.log(`${lang}: dodane ${dodane}, nadpisane ${nadpisane}`);
}
