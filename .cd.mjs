import fs from 'fs';
import { czytajMape } from '/private/tmp/m03/scripts/dev/lib/kartyModulow.mjs';
const s = JSON.parse(fs.readFileSync('docs/program/grafika/status.json','utf8'));
const po = {}; for (const m of s.moduly) for (const e of m.ekrany) po[e.id] = e;
const mapa = czytajMape('/private/tmp/m03').filter(x=>/^[0-9]/.test(x.kod));
let n=0;
for (const mo of mapa) {
  const cd = mo.ekrany.filter(e=>e.ocena==='C'||e.ocena==='D');
  if(!cd.length) continue;
  console.log('\n### '+mo.kod+' ('+cd.length+')');
  for (const e of cd) { n++;
    const x = po[e.id] || {};
    const w = (x.wyjatki||[])[0] || '';
    console.log('  ['+e.ocena+'] '+e.id.padEnd(42)+' | '+(x.nazwa||'').slice(0,44));
    console.log('        wyjatek: '+w.slice(0,150).replace(/\n/g,' '));
  }
}
console.log('\nRAZEM na kartach 16 modulow:', n);
