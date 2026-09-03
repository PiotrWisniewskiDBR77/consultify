import fs from 'fs';
const FILES = [
  ['task',        'src/components/MyWork/taskCardContract.ts'],
  ['decision',    'src/components/MyWork/decisionCardContract.ts'],
  ['initiative',  'src/components/Initiatives/sections/initiativeCardContract.ts'],
  ['insight',     'src/components/Interview/insightCardContract.ts'],
  ['notification','src/components/MyWork/notificationCardContract.ts'],
  ['interview',   'src/components/Interview/interviewCardContract.ts'],
  ['tool',        'src/components/DiscoveryTools/toolCards.contract.ts'],
];
const ROOT = '/Users/piotrwisniewski/Developer/Consultify/';

function matchFrom(src, start, open, close) {
  let d = 0, i = start, inStr = null, esc = false;
  for (; i < src.length; i++) {
    const c = src[i];
    if (inStr) { if (esc) { esc = false; continue; } if (c === '\\') { esc = true; continue; } if (c === inStr) inStr = null; continue; }
    if (c === '/' && src[i+1] === '/') { while (i < src.length && src[i] !== '\n') i++; continue; }
    if (c === '/' && src[i+1] === '*') { i = src.indexOf('*/', i + 2); if (i < 0) return ''; i++; continue; }
    if (c === "'" || c === '"' || c === '`') { inStr = c; continue; }
    if (c === open) d++;
    else if (c === close) { d--; if (d === 0) return src.slice(start, i + 1); }
  }
  return '';
}
function blocks(src) {
  const out = []; const re = /definiujKarteKanoniczna\(\{/g; let m;
  while ((m = re.exec(src))) {
    const start = m.index + m[0].length - 1;
    out.push({ text: matchFrom(src, start, '{', '}'), line: src.slice(0, m.index).split('\n').length });
  }
  return out;
}
const g = (t, re) => { const m = t && t.match(re); return m ? (m[1] ?? m[2]) : null; };
const STR = (k) => new RegExp(k + `:\\s*(?:'((?:[^'\\\\]|\\\\.)*)'|"((?:[^"\\\\]|\\\\.)*)")`);

const rows = [];
for (const [art, rel] of FILES) {
  const src = fs.readFileSync(ROOT + rel, 'utf8');
  for (const b of blocks(src)) {
    const t = b.text;
    const li = t.indexOf('label:');
    const labelBlk = li >= 0 ? matchFrom(t, t.indexOf('{', li), '{', '}') : '';
    const ki = t.indexOf('kompozycja:');
    const k = ki >= 0 ? matchFrom(t, t.indexOf('[', ki), '[', ']') : '';
    rows.push({
      art, file: rel, line: b.line,
      id: g(t, /^\s*id:\s*'([^']+)'/m),
      en: g(labelBlk, STR('en')), pl: g(labelBlk, STR('pl')),
      grupa: g(t, /^\s*grupa:\s*'([^']+)'/m),
      ikona: g(t, /^\s*ikona:\s*'([^']+)'/m),
      rolaAI: g(t, /^\s*rolaAI:\s*'([^']+)'/m),
      rola: g(k, /rola:\s*'([^']+)'/),
      klasa: g(k, /klasa:\s*'([^']+)'/),
      kolumna: g(k, /kolumna:\s*'([^']+)'/) || 'left',
      kolejnosc: g(k, /kolejnosc:\s*(\d+)/),
      alias: g(k, /idWArtefakcie:\s*'([^']+)'/),
      stan: g(t, /stan:\s*'([^']+)'/),
      arts: [...k.matchAll(/artefakt:\s*'([^']+)'/g)].map(x => x[1]),
    });
  }
}
fs.writeFileSync('/private/tmp/m03/cards.json', JSON.stringify(rows, null, 2));
const bad = rows.filter(r => !r.id || !r.rola || !r.en || !r.pl || !r.klasa);
console.log('blocks:', rows.length, '| bad:', bad.length, bad.map(b => b.art + ':' + b.line).join(','));
for (const [a] of FILES) {
  const rs = rows.filter(r => r.art === a);
  const byRola = {}; rs.forEach(r => byRola[r.rola] = (byRola[r.rola]||0)+1);
  console.log(a.padEnd(13), rs.length, JSON.stringify(byRola));
}
// multi-artefakt kompozycje
console.log('\nkarty deklarujace >1 artefakt w kompozycji:', rows.filter(r=>r.arts.length>1).map(r=>r.art+'/'+r.id+'->'+r.arts.join('+')));
// czy artefakt w kompozycji zgadza sie z plikiem
console.log('\nrozjazd plik vs artefakt:', rows.filter(r=>!r.arts.includes(r.art)).map(r=>r.art+'/'+r.id+'='+r.arts.join('+')));
