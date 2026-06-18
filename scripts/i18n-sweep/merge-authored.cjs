#!/usr/bin/env node
/**
 * Merge authored full-key → {pl,en} maps (from per-namespace sub-agents) into
 * pl+en translation.json at the EXACT dot-path. Never overwrites existing values.
 * Usage: node scripts/i18n-sweep/merge-authored.cjs <authored.json> [more.json ...] [--write]
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const PL = path.join(ROOT, 'public/locales/pl/translation.json');
const EN = path.join(ROOT, 'public/locales/en/translation.json');
const WRITE = process.argv.includes('--write');
const files = process.argv.slice(2).filter((a) => a.endsWith('.json'));

function setNested(root, dotted, value) {
  const parts = dotted.split('.');
  let cur = root;
  for (let i = 0; i < parts.length - 1; i++) {
    const seg = parts[i];
    if (cur[seg] == null) cur[seg] = {};
    else if (typeof cur[seg] !== 'object' || Array.isArray(cur[seg])) return false;
    cur = cur[seg];
  }
  const leaf = parts[parts.length - 1];
  if (cur[leaf] != null) return false;
  cur[leaf] = value;
  return true;
}

const plJson = JSON.parse(fs.readFileSync(PL, 'utf8'));
const enJson = JSON.parse(fs.readFileSync(EN, 'utf8'));
let injPl = 0, injEn = 0, skipped = 0, total = 0;
for (const f of files) {
  const obj = JSON.parse(fs.readFileSync(f, 'utf8'));
  for (const [k, v] of Object.entries(obj)) {
    total++;
    const pl = (v && typeof v === 'object') ? (v.pl ?? v.en) : v;
    const en = (v && typeof v === 'object') ? (v.en ?? v.pl) : v;
    if (pl == null || en == null) { skipped++; continue; }
    if (setNested(plJson, k, String(pl))) injPl++;
    if (setNested(enJson, k, String(en))) injEn++;
  }
}
if (WRITE) {
  fs.writeFileSync(PL, JSON.stringify(plJson, null, 2) + '\n');
  fs.writeFileSync(EN, JSON.stringify(enJson, null, 2) + '\n');
}
console.log(JSON.stringify({ write: WRITE, files: files.length, total, injectedPl: injPl, injectedEn: injEn, skipped }, null, 2));
