#!/usr/bin/env node
/**
 * Merge harvested key patches into translation.json by SUFFIX-matching the FULL keys
 * the code actually calls (authoritative). For each bare-missing `t('full.key')` in src,
 * find the patch entry whose key === full.key OR full.key endsWith ('.'+patchKey) — longest
 * (most specific) wins — and inject {pl,en} at the FULL path in pl+en translation.json.
 * Never overwrites an existing value. This guarantees the gate count drops by what it resolves.
 *
 * Usage: node scripts/i18n-sweep/merge-by-suffix.cjs [--write] [--filter substr]
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const SRC = path.join(ROOT, 'src');
const SWEEP = __dirname;
const PL = path.join(ROOT, 'public/locales/pl/translation.json');
const EN = path.join(ROOT, 'public/locales/en/translation.json');
const LOCALE_DIRS = [path.join(ROOT, 'public/locales/pl'), path.join(ROOT, 'public/locales/en')];
const WRITE = process.argv.includes('--write');
const filter = process.argv.includes('--filter') ? process.argv[process.argv.indexOf('--filter') + 1] : null;

// ── known keys (union of all locale files) ────────────────────────────────────
const known = new Set();
const flat = (o, p) => { for (const [k, v] of Object.entries(o || {})) { const d = p ? `${p}.${k}` : k; (v && typeof v === 'object' && !Array.isArray(v)) ? flat(v, d) : known.add(d); } };
for (const dir of LOCALE_DIRS) for (const f of fs.readdirSync(dir)) if (f.endsWith('.json')) flat(JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')), '');

// ── scan src for bare-missing full keys ───────────────────────────────────────
const CALL = /\bt\(\s*(['"])((?:\\.|(?!\1).)*)\1\s*(,|\))/g;
const walk = (d, a) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) { if (['node_modules', '__tests__', '__mocks__'].includes(e.name)) continue; walk(p, a); } else if (/\.(ts|tsx)$/.test(e.name) && !/\.(test|spec|d)\.tsx?$/.test(e.name)) a.push(p); } return a; };
const missing = new Set();
for (const file of walk(SRC, [])) {
  const text = fs.readFileSync(file, 'utf8');
  let m;
  while ((m = CALL.exec(text)) !== null) {
    const key = m[2];
    if (m[3] === ',' && /^\s*['"`]/.test(text.slice(CALL.lastIndex))) continue; // string fallback
    if (!key || key.includes('${') || /\s/.test(key)) continue;
    const p = key.includes(':') ? key.split(':').slice(1).join(':') : key;
    if (!known.has(p)) missing.add(p);
  }
}

// ── load all patch files → patchMap ───────────────────────────────────────────
const patchMap = new Map(); // patchKey -> {pl,en}
for (const f of fs.readdirSync(SWEEP)) {
  if (!/^keys_.*\.json$/.test(f)) continue;
  let obj;
  try { obj = JSON.parse(fs.readFileSync(path.join(SWEEP, f), 'utf8')); } catch { continue; }
  for (const [k, v] of Object.entries(obj)) {
    if (patchMap.has(k)) continue;
    let pl, en;
    if (v && typeof v === 'object') { pl = v.pl ?? v.PL ?? v.en ?? v.EN; en = v.en ?? v.EN ?? v.pl ?? v.PL; }
    else { pl = en = String(v); }
    if (pl == null || en == null) continue;
    patchMap.set(k, { pl: String(pl), en: String(en) });
  }
}
const patchKeys = [...patchMap.keys()].sort((a, b) => b.length - a.length); // longest first

// ── resolve each missing full key to a patch value ───────────────────────────
const resolutions = []; // {full, pl, en}
const unresolved = [];
for (const full of missing) {
  if (filter && !full.includes(filter)) continue;
  let hit = null;
  if (patchMap.has(full)) hit = full;
  else hit = patchKeys.find((pk) => full.endsWith('.' + pk));
  if (hit) resolutions.push({ full, ...patchMap.get(hit) });
  else unresolved.push(full);
}

// ── inject into pl + en (no overwrite) ────────────────────────────────────────
function setNested(root, dotted, value) {
  const parts = dotted.split('.');
  let cur = root;
  for (let i = 0; i < parts.length - 1; i++) {
    const seg = parts[i];
    if (cur[seg] == null || typeof cur[seg] !== 'object' || Array.isArray(cur[seg])) {
      if (cur[seg] != null) return false; // collision with a leaf — skip
      cur[seg] = {};
    }
    cur = cur[seg];
  }
  const leaf = parts[parts.length - 1];
  if (cur[leaf] != null) return false; // exists — never overwrite
  cur[leaf] = value;
  return true;
}

const plJson = JSON.parse(fs.readFileSync(PL, 'utf8'));
const enJson = JSON.parse(fs.readFileSync(EN, 'utf8'));
let injPl = 0, injEn = 0;
for (const r of resolutions) {
  if (setNested(plJson, r.full, r.pl)) injPl++;
  if (setNested(enJson, r.full, r.en)) injEn++;
}

if (WRITE) {
  fs.writeFileSync(PL, JSON.stringify(plJson, null, 2) + '\n');
  fs.writeFileSync(EN, JSON.stringify(enJson, null, 2) + '\n');
}

console.log(JSON.stringify({
  write: WRITE, filter,
  missingFull: missing.size,
  resolved: resolutions.length,
  unresolved: unresolved.length,
  injectedPl: injPl, injectedEn: injEn,
}, null, 2));
if (process.argv.includes('--list-unresolved')) unresolved.slice(0, 80).forEach((k) => console.log('UNRESOLVED', k));
