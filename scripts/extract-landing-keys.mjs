import fs from 'node:fs';
import path from 'node:path';

const files = [];
const walk = (d) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(tsx|ts)$/.test(e.name) && !/\.test\./.test(e.name)) files.push(p);
  }
};
walk('src/components/Landing');
files.push('src/views/PublicLandingPage.tsx');

// t( "key" [, "default"] ) — tolerant of whitespace/newlines
const re = /\bt\(\s*['"]([a-zA-Z0-9_.]+)['"]\s*(?:,\s*['"]((?:[^'"\\]|\\.)*)['"])?/g;
const map = new Map();
for (const f of files) {
  const s = fs.readFileSync(f, 'utf8');
  let m;
  while ((m = re.exec(s))) {
    const k = m[1];
    const d = m[2] != null ? m[2].replace(/\\(.)/g, '$1') : null;
    if (!map.has(k)) map.set(k, d);
    else if (map.get(k) == null && d != null) map.set(k, d);
  }
}
const all = [...map.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
const ns = {};
for (const [k] of all) {
  const n = k.split('.')[0];
  ns[n] = (ns[n] || 0) + 1;
}
console.log('total distinct t() keys on landing surface:', all.length);
console.log('by namespace:', JSON.stringify(ns));
fs.writeFileSync('/tmp/landing_keys.json', JSON.stringify(all, null, 2));
