// Global i18n completeness gate: every t('ns.key') / i18n.t('ns.key') used in src/
// must resolve in BOTH en and pl. Reports bare-missing (neither) and PL-debt (en, not pl).
import fs from 'fs';
import path from 'path';

function walk(d, out = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) {
      if (['node_modules', '__tests__', 'dist', 'build'].includes(e.name)) continue;
      walk(p, out);
    } else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) && !/\.d\.ts$/.test(e.name)) {
      out.push(p);
    }
  }
  return out;
}
function deep(obj, dotted) {
  let cur = obj;
  for (const part of dotted.split('.')) {
    if (cur && typeof cur === 'object' && part in cur) cur = cur[part];
    else return undefined;
  }
  return typeof cur === 'string' ? cur : undefined;
}

const en = JSON.parse(fs.readFileSync('public/locales/en/translation.json', 'utf8'));
const pl = JSON.parse(fs.readFileSync('public/locales/pl/translation.json', 'utf8'));

const used = new Map(); // key -> first file
const re = /\bt\(\s*'([a-zA-Z][a-zA-Z0-9]*(?:\.[a-zA-Z0-9_]+)+)'/g;
const reI = /\bi18n\.t\(\s*'([a-zA-Z][a-zA-Z0-9]*(?:\.[a-zA-Z0-9_]+)+)'/g;
for (const f of walk('src')) {
  const txt = fs.readFileSync(f, 'utf8');
  for (const m of txt.matchAll(re)) if (!used.has(m[1])) used.set(m[1], f);
  for (const m of txt.matchAll(reI)) if (!used.has(m[1])) used.set(m[1], f);
}

const bareMissing = []; // in neither
const plDebt = []; // in en, not pl
for (const [k, f] of used) {
  const e = deep(en, k) !== undefined;
  const p = deep(pl, k) !== undefined;
  if (!e && !p) bareMissing.push([k, f]);
  else if (e && !p) plDebt.push([k, f]);
}

const byNs = (arr) => {
  const m = {};
  for (const [k] of arr) {
    const ns = k.split('.')[0];
    m[ns] = (m[ns] || 0) + 1;
  }
  return Object.entries(m).sort((a, b) => b[1] - a[1]);
};

console.log('total distinct keys used:', used.size);
console.log('BARE-MISSING (neither en nor pl):', bareMissing.length);
console.log('  by ns:', JSON.stringify(byNs(bareMissing)));
console.log('PL-DEBT (en present, pl missing):', plDebt.length);
console.log('  by ns:', JSON.stringify(byNs(plDebt)));
fs.writeFileSync('scripts/i18n-sweep/_bare_missing.json', JSON.stringify(bareMissing, null, 2));
fs.writeFileSync('scripts/i18n-sweep/_pl_debt.json', JSON.stringify(plDebt, null, 2));
