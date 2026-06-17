// Merge keys_<ns>.json into pl + en translation.json additively, under top-level <ns>.
// Detects collisions (existing key with a DIFFERENT value) and refuses to overwrite them.
// Usage: node merge.mjs <ns> [--write]
import fs from 'fs';
import path from 'path';

const args = process.argv.slice(2);
const NS = args[0];
const WRITE = args.includes('--write');
const keysArg = (args.find((a) => a.startsWith('--keys=')) || '').split('=')[1];
if (!NS) { console.error('args: <ns> [--write] [--keys=path]'); process.exit(1); }

const keysPath = keysArg || path.join('scripts/i18n-sweep', `keys_${NS}.json`);
const keys = JSON.parse(fs.readFileSync(keysPath, 'utf8'));
const report = { ns: NS, write: WRITE, langs: {} };

for (const lang of ['pl', 'en']) {
  const fp = `public/locales/${lang}/translation.json`;
  const json = JSON.parse(fs.readFileSync(fp, 'utf8'));
  if (!json[NS] || typeof json[NS] !== 'object' || Array.isArray(json[NS])) json[NS] = json[NS] && typeof json[NS] === 'object' ? json[NS] : {};
  const ns = json[NS];
  let added = 0, identical = 0;
  const collisions = [];
  for (const [k, v] of Object.entries(keys)) {
    const want = lang === 'pl' ? v.pl : v.en;
    // Nest dotted keys (e.g. "section.key" -> ns.section.key) so i18next (keySeparator='.') resolves them.
    const parts = k.split('.');
    let cur = ns; let ok = true;
    for (let i = 0; i < parts.length - 1; i++) {
      const p = parts[i];
      if (cur[p] === undefined) cur[p] = {};
      if (typeof cur[p] !== 'object' || Array.isArray(cur[p])) { collisions.push({ key: k, reason: `path '${p}' is not an object` }); ok = false; break; }
      cur = cur[p];
    }
    if (!ok) continue;
    const leaf = parts[parts.length - 1];
    if (Object.prototype.hasOwnProperty.call(cur, leaf)) {
      if (cur[leaf] === want) { identical++; }
      else if (typeof cur[leaf] === 'object') { collisions.push({ key: k, reason: 'existing is object' }); }
      else { collisions.push({ key: k, existing: cur[leaf], want }); }
      continue;
    }
    cur[leaf] = want; added++;
  }
  report.langs[lang] = { added, identical, collisions: collisions.length, collisionDetail: collisions.slice(0, 20) };
  if (WRITE) fs.writeFileSync(fp, JSON.stringify(json, null, 2) + '\n');
}

console.log(JSON.stringify(report, null, 2));
