#!/usr/bin/env node
/**
 * i18n gate — counts "bare t() without fallback whose key is missing from locales".
 * Such calls render the raw key path in the UI. Target: 0.
 *
 * Bare = t('key')  OR  t('key', { ...options })   (no STRING fallback as 2nd arg).
 * Not bare = t('key', 'Fallback text')            (renders the fallback even if missing).
 *
 * A key is "present" if its dot-path (minus any `ns:` prefix) exists, nested, in ANY
 * public/locales/{pl,en}/*.json (keySeparator '.'), per the brief.
 *
 * Usage: node scripts/i18n/check-bare-missing.cjs [--list] [--filter substr]
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const SRC = path.join(ROOT, 'src');
const LOCALE_DIRS = [
  path.join(ROOT, 'public/locales/pl'),
  path.join(ROOT, 'public/locales/en'),
];

// ── Build the union of known dot-paths from all locale files ──────────────────
const known = new Set();
function flatten(obj, prefix) {
  for (const [k, v] of Object.entries(obj || {})) {
    const dot = prefix ? `${prefix}.${k}` : k;
    // Add EVERY path — leaves AND object parents — so `t('ns.obj', {returnObjects:true})`
    // calls that resolve to an existing object are not falsely flagged as missing.
    known.add(dot);
    if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, dot);
  }
}
for (const dir of LOCALE_DIRS) {
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.json')) continue;
    try {
      flatten(JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')), '');
    } catch (e) {
      console.error(`Failed to parse ${dir}/${f}: ${e.message}`);
      process.exit(2);
    }
  }
}

// ── Walk src for t() calls ────────────────────────────────────────────────────
function walk(dir, acc) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '__tests__' || entry.name === '__mocks__') continue;
      walk(p, acc);
    } else if (/\.(ts|tsx)$/.test(entry.name) && !/\.(test|spec|d)\.tsx?$/.test(entry.name)) {
      acc.push(p);
    }
  }
  return acc;
}

// Capture t('key' <next>) — next is the char right after the first string arg.
const CALL = /\bt\(\s*(['"])((?:\\.|(?!\1).)*)\1\s*(,|\))/g;

const missing = [];
const files = walk(SRC, []);
for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  let m;
  while ((m = CALL.exec(text)) !== null) {
    const rawKey = m[2];
    const after = m[3];
    // Determine if a STRING fallback follows (2nd positional arg).
    let hasStringFallback = false;
    if (after === ',') {
      const rest = text.slice(CALL.lastIndex);
      hasStringFallback = /^\s*['"`]/.test(rest); // string literal → fallback present
    }
    if (hasStringFallback) continue;
    if (!rawKey || rawKey.includes('${') || /\s/.test(rawKey)) continue; // skip dynamic/templated
    const keyPath = rawKey.includes(':') ? rawKey.split(':').slice(1).join(':') : rawKey;
    if (!known.has(keyPath)) {
      missing.push({ file: path.relative(ROOT, file), key: rawKey });
    }
  }
}

const args = process.argv.slice(2);
const filter = args.includes('--filter') ? args[args.indexOf('--filter') + 1] : null;
const shown = filter ? missing.filter((x) => x.file.includes(filter) || x.key.includes(filter)) : missing;

if (args.includes('--list')) {
  for (const x of shown) console.log(`${x.key}\t${x.file}`);
}
console.log(`\nBARE-MISSING (bare t() with no string fallback + key absent from locales): ${shown.length}${filter ? ` [filter: ${filter}]` : ''}`);
console.log(`(scanned ${files.length} files; ${known.size} known locale keys)`);
process.exit(shown.length === 0 ? 0 : 1);
