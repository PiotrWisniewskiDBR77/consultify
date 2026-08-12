// Adds landing.* keys that components reference with hardcoded English defaults
// but that are absent from the locale JSON (so every language renders English).
// Seeds EN from the component defaults, then DeepL-translates the gaps per locale.
import fs from 'node:fs';

const KEY = process.env.DEEPL_KEY;
const ENDPOINT = 'https://api.deepl.com/v2/translate';
const BASE = 'public/locales';
const PAIRS = JSON.parse(fs.readFileSync('/tmp/true_missing.json', 'utf8')); // [[key, englishDefault], ...]

const TARGETS = {
  pl: { deepl: 'PL', formality: 'prefer_more' },
  de: { deepl: 'DE', formality: 'prefer_more' },
  es: { deepl: 'ES', formality: 'prefer_more' },
  ja: { deepl: 'JA', formality: 'prefer_more' },
  ar: { deepl: 'AR', formality: null },
};

const PROTECT = [/\{\{[^}]+\}\}/g, /Consultify/g, /Vector AI/g, /DBR77/g, /\bAnna\b/g];
const mask = (t) => {
  let o = t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  for (const re of PROTECT) o = o.replace(re, (m) => `<ph>${m}</ph>`);
  return o;
};
const unmask = (t) =>
  t
    .replace(/<ph>/g, '').replace(/<\/ph>/g, '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');

const load = (l) => JSON.parse(fs.readFileSync(`${BASE}/${l}/translation.json`, 'utf8'));
const save = (l, o) => fs.writeFileSync(`${BASE}/${l}/translation.json`, JSON.stringify(o, null, 2) + '\n');
const hasPath = (o, path) => path.split('.').reduce((n, k) => (n && typeof n === 'object' ? n[k] : undefined), o) !== undefined;
const setPath = (o, path, val) => {
  const ks = path.split('.');
  let n = o;
  for (let i = 0; i < ks.length - 1; i++) {
    if (typeof n[ks[i]] !== 'object' || n[ks[i]] === null) n[ks[i]] = {};
    n = n[ks[i]];
  }
  n[ks[ks.length - 1]] = val;
};

async function deepl(texts, target, formality) {
  const body = new URLSearchParams();
  body.append('source_lang', 'EN');
  body.append('target_lang', target);
  body.append('tag_handling', 'xml');
  body.append('ignore_tags', 'ph');
  body.append('preserve_formatting', '1');
  if (formality) body.append('formality', formality);
  for (const t of texts) body.append('text', mask(t));
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `DeepL-Auth-Key ${KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) throw new Error(`DeepL ${res.status}: ${await res.text()}`);
  return (await res.json()).translations.map((t) => unmask(t.text));
}

// 1. Seed EN with the English defaults (only where missing).
const en = load('en');
let enAdded = 0;
for (const [k, def] of PAIRS) if (!hasPath(en, k)) { setPath(en, k, def); enAdded++; }
save('en', en);
console.log(`EN: seeded ${enAdded} keys`);

// 2. For each target, translate + insert only the keys it lacks.
for (const lng of Object.keys(TARGETS)) {
  const cfg = TARGETS[lng];
  const o = load(lng);
  const todo = PAIRS.filter(([k]) => !hasPath(o, k));
  if (!todo.length) { console.log(`${lng}: nothing missing`); continue; }
  const translated = await deepl(todo.map(([, def]) => def), cfg.deepl, cfg.formality);
  todo.forEach(([k], i) => setPath(o, k, translated[i]));
  save(lng, o);
  console.log(`${lng}: added ${todo.length} keys`);
  for (let i = 0; i < Math.min(4, todo.length); i++) console.log(`   ${todo[i][0]} => ${translated[i]}`);
}
