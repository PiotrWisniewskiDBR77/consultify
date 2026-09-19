import fs from 'node:fs';
import { execSync } from 'node:child_process';

const RANGE = 'e05ea74752..adea785c97';
const deployed = JSON.parse(fs.readFileSync('/tmp/qd17-en.json', 'utf8'));
const deployedPl = JSON.parse(fs.readFileSync('/tmp/qd17-pl.json', 'utf8'));
const flat = new Map();
const flatPl = new Map();
(function walk(node, prefix, target) {
  for (const [k, v] of Object.entries(node)) {
    const p = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) walk(v, p, target);
    else target.set(p, Array.isArray(v) ? JSON.stringify(v) : String(v));
  }
})(deployed, '', flat);
(function walkPl(node, prefix) {
  for (const [k, v] of Object.entries(node)) {
    const p = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) walkPl(v, p);
    else flatPl.set(p, Array.isArray(v) ? JSON.stringify(v) : String(v));
  }
})(deployedPl, '');

const byLastSegment = new Map();
for (const [p, v] of flat) {
  const last = p.split('.').pop();
  if (!byLastSegment.has(last)) byLastSegment.set(last, []);
  byLastSegment.get(last).push({ p, v });
}

const shas = execSync(`git log --format=%H ${RANGE}`, { encoding: 'utf8' }).trim().split('\n');
const rows = [];
for (const sha of shas) {
  const subj = execSync(`git log -1 --format=%s ${sha}`, { encoding: 'utf8' }).trim().replace(/ \[ODMROZENIE[^\]]*\]/g, '');
  let diff;
  try {
    diff = execSync(`git show ${sha} --format= -- public/locales/en/translation.json`, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  } catch { continue; }
  const pairs = [];
  for (const line of diff.split('\n')) {
    if (!line.startsWith('+') || line.startsWith('+++')) continue;
    const m = line.slice(1).match(/^\s*"?([A-Za-z0-9_.\-]+)"?\s*:\s*"(.*)"\s*,?\s*$/);
    if (m) pairs.push({ key: m[1], value: m[2] });
  }
  if (!pairs.length) continue;
  const seen = new Set();
  const uniq = pairs.filter((p) => (seen.has(p.key + '|' + p.value) ? false : (seen.add(p.key + '|' + p.value), true)));
  const missing = [];
  const valueDrift = [];
  const plMissing = [];
  let found = 0;
  for (const { key, value } of uniq) {
    const literal = flat.has(key) ? [{ p: key, v: flat.get(key) }] : [];
    const cands = literal.length ? literal : (byLastSegment.get(key) || []);
    if (!cands.length) { missing.push(key); continue; }
    if (!flatPl.has(cands[0].p)) plMissing.push(cands[0].p);
    if (cands.some((c) => c.v === value)) { found++; continue; }
    found++;
    valueDrift.push(`${key}: wdrożona="${cands[0].v}" | w-commicie="${value}"`);
  }
  rows.push({ sha: sha.slice(0, 10), subj, dodanych: uniq.length, obecnych: found, brak: missing, drift: valueDrift, plMissing });
}

const totalAdded = rows.reduce((s, r) => s + r.dodanych, 0);
const totalFound = rows.reduce((s, r) => s + r.obecnych, 0);
const totalPlMissing = rows.reduce((s, r) => s + r.plMissing.length, 0);
console.log(`DEPLOYED_EN=/locales/en/translation.json  HTTP=200  spłaszczonych-ścieżek=${flat.size}`);
console.log(`DEPLOYED_PL=/locales/pl/translation.json  HTTP=200  spłaszczonych-ścieżek=${flatPl.size}`);
console.log(`commitow=${rows.length}  kluczy-dodanych=${totalAdded}  obecnych-na-zywo=${totalFound}  brak=${totalAdded - totalFound}  bez-pary-PL=${totalPlMissing}`);
for (const r of rows) {
  console.log(`\n${r.sha} | ${r.subj}`);
  console.log(`  dodanych=${r.dodanych} obecnych=${r.obecnych} brak=${r.brak.length} bez-pary-PL=${r.plMissing.length}${r.drift.length ? ` drift-wartosci=${r.drift.length}` : ''}`);
  if (r.brak.length) console.log(`  BRAKUJACE: ${r.brak.slice(0, 20).join(', ')}${r.brak.length > 20 ? ` …(+${r.brak.length - 20})` : ''}`);
  if (r.plMissing.length) console.log(`  BEZ_PARY_PL: ${r.plMissing.slice(0, 20).join(', ')}${r.plMissing.length > 20 ? ` …(+${r.plMissing.length - 20})` : ''}`);
  if (r.drift.length) console.log(`  DRIFT: ${r.drift.slice(0, 10).join('; ')}`);
}
