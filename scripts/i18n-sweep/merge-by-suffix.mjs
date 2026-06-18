// Fill bare-missing (and pl-debt) i18n keys by matching used keys to patch entries by SUFFIX.
// For each key actually USED in src but missing from locale, find a patch entry
// (keys_*.json, format {key:{pl,en}}) whose key equals or is a suffix-match, then
// merge {pl,en} at the USED full path in BOTH pl + en. Never overwrites existing values.
// Usage: node merge-by-suffix.mjs [--write]
import fs from 'fs';
import path from 'path';

const WRITE = process.argv.includes('--write');
const DIR = 'scripts/i18n-sweep';

// 1. Load all patch files → index by full key and by last-segment.
const patchFiles = fs
  .readdirSync(DIR)
  .filter((f) => /^keys_.*\.json$/.test(f))
  .map((f) => path.join(DIR, f));
const byFull = new Map(); // exact patch key -> {pl,en}
const byLeaf = new Map(); // last segment -> [{key,pl,en}]
for (const pf of patchFiles) {
  let json;
  try { json = JSON.parse(fs.readFileSync(pf, 'utf8')); } catch { continue; }
  for (const [k, v] of Object.entries(json)) {
    if (!v || typeof v !== 'object') continue;
    const pl = typeof v.pl === 'string' ? v.pl : undefined;
    const en = typeof v.en === 'string' ? v.en : undefined;
    if (pl === undefined && en === undefined) continue;
    const entry = { key: k, pl, en, src: path.basename(pf) };
    if (!byFull.has(k)) byFull.set(k, entry);
    const leaf = k.split('.').pop();
    if (!byLeaf.has(leaf)) byLeaf.set(leaf, []);
    byLeaf.get(leaf).push(entry);
  }
}

// 2. Used-but-missing keys (from the global checker's outputs).
const bare = JSON.parse(fs.readFileSync(path.join(DIR, '_bare_missing.json'), 'utf8')).map((x) => x[0]);
const plDebt = JSON.parse(fs.readFileSync(path.join(DIR, '_pl_debt.json'), 'utf8')).map((x) => x[0]);
const targets = [...new Set([...bare, ...plDebt])];

// 3. Locale files.
const enFp = 'public/locales/en/translation.json';
const plFp = 'public/locales/pl/translation.json';
const en = JSON.parse(fs.readFileSync(enFp, 'utf8'));
const pl = JSON.parse(fs.readFileSync(plFp, 'utf8'));

function getDeep(o, dotted) {
  let cur = o;
  for (const p of dotted.split('.')) { if (cur && typeof cur === 'object' && p in cur) cur = cur[p]; else return undefined; }
  return cur;
}
function setDeep(o, dotted, val) {
  const parts = dotted.split('.');
  let cur = o;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (cur[p] === undefined) cur[p] = {};
    if (typeof cur[p] !== 'object' || Array.isArray(cur[p])) return false; // structural conflict
    cur = cur[p];
  }
  const leaf = parts[parts.length - 1];
  if (typeof cur[leaf] === 'object') return false;
  if (typeof cur[leaf] !== 'string') cur[leaf] = val;
  return true;
}

function matchFor(fullKey) {
  if (byFull.has(fullKey)) return byFull.get(fullKey);
  // suffix match: patch key whose full key is a suffix of the used key (dot-aligned), or shares leaf
  const leaf = fullKey.split('.').pop();
  const cands = byLeaf.get(leaf) || [];
  // prefer the candidate whose key is the longest dot-suffix of fullKey
  let best = null, bestLen = 0;
  for (const c of cands) {
    if (fullKey === c.key || fullKey.endsWith('.' + c.key)) {
      const len = c.key.split('.').length;
      if (len > bestLen) { best = c; bestLen = len; }
    }
  }
  if (best) return best;
  // No risky unique-leaf fallback: only exact-key or dot-aligned suffix matches are
  // trusted, to avoid cross-namespace mis-fills (e.g. a bare 'close' into settings.*).
  return null;
}

let filledEn = 0, filledPl = 0, conflicts = 0, unmatched = [];
for (const key of targets) {
  const m = matchFor(key);
  if (!m) { unmatched.push(key); continue; }
  if (getDeep(en, key) === undefined && m.en !== undefined) { if (setDeep(en, key, m.en)) filledEn++; else conflicts++; }
  if (getDeep(pl, key) === undefined && (m.pl ?? m.en) !== undefined) { if (setDeep(pl, key, m.pl ?? m.en)) filledPl++; else conflicts++; }
}

console.log(JSON.stringify({
  patchFiles: patchFiles.length, patchKeys: byFull.size,
  targets: targets.length, filledEn, filledPl, conflicts, unmatched: unmatched.length,
}, null, 2));
fs.writeFileSync(path.join(DIR, '_unmatched.json'), JSON.stringify(unmatched, null, 2));
if (WRITE) {
  fs.writeFileSync(enFp, JSON.stringify(en, null, 2) + '\n');
  fs.writeFileSync(plFp, JSON.stringify(pl, null, 2) + '\n');
}
