import fs from 'node:fs';
import { wykryjPolski } from '../scripts/i18n/pomiar-jezyka.mjs';

const PLIKI = process.argv.slice(2);
const WZ = /\bt\(\s*(["'`])([A-Za-z0-9_$]+(?:\.[A-Za-z0-9_$[\]]+)+)\1\s*,\s*(["'])((?:[^"'\\]|\\.){3,200})\3/g;
const out = [];
for (const p of PLIKI) {
  const tresc = fs.readFileSync(p, 'utf8');
  for (const m of tresc.matchAll(WZ)) {
    const klucz = m[2];
    const tekst = m[4];
    if (!wykryjPolski(tekst)) continue;
    out.push({ plik: p, klucz, pl: tekst });
  }
}
fs.writeFileSync('tmp-jzz/k1def.json', JSON.stringify(out, null, 1));
console.log('zebrane:', out.length);
