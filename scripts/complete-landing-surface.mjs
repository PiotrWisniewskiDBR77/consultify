// Completes EVERY t() key rendered on the landing surface (all namespaces) for
// pl/de/es/ja/ar. Seeds EN from component defaults where the key is absent, then
// DeepL-translates any target value that is missing or still equal to EN.
import fs from 'node:fs';

const KEY = process.env.DEEPL_KEY;
const ENDPOINT = 'https://api.deepl.com/v2/translate';
const BASE = 'public/locales';
const PAIRS = JSON.parse(fs.readFileSync('/tmp/landing_keys.json', 'utf8')); // [[key, default|null], ...]

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
const getPath = (o, path) => path.split('.').reduce((n, k) => (n && typeof n === 'object' ? n[k] : undefined), o);
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
  const out = [];
  const CHUNK = 40;
  for (let i = 0; i < texts.length; i += CHUNK) {
    const body = new URLSearchParams();
    body.append('source_lang', 'EN');
    body.append('target_lang', target);
    body.append('tag_handling', 'xml');
    body.append('ignore_tags', 'ph');
    body.append('preserve_formatting', '1');
    if (formality) body.append('formality', formality);
    for (const t of texts.slice(i, i + CHUNK)) body.append('text', mask(t));
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `DeepL-Auth-Key ${KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!res.ok) throw new Error(`DeepL ${res.status}: ${await res.text()}`);
    (await res.json()).translations.forEach((t) => out.push(unmask(t.text)));
  }
  return out;
}

// 1. Seed EN with component defaults where the key is absent.
const en = load('en');
let seeded = 0;
for (const [k, def] of PAIRS) {
  if (def != null && getPath(en, k) === undefined) { setPath(en, k, def); seeded++; }
}
if (seeded) save('en', en);
console.log(`EN: seeded ${seeded} keys from component defaults`);

// 2. Per target: translate keys that are missing or still equal to EN.
const isTranslatable = (v) => typeof v === 'string' && v.trim().length > 0;
for (const lng of Object.keys(TARGETS)) {
  const cfg = TARGETS[lng];
  const o = load(lng);
  const todo = [];
  for (const [k] of PAIRS) {
    const enVal = getPath(en, k);
    if (!isTranslatable(enVal)) continue; // skip non-string / array / object leaves (handled elsewhere)
    const cur = getPath(o, k);
    const needs = cur === undefined || (typeof cur === 'string' && cur === enVal);
    if (needs) todo.push([k, enVal]);
  }
  if (!todo.length) { console.log(`${lng}: complete (0 gaps)`); continue; }
  const translated = await deepl(todo.map(([, v]) => v), cfg.deepl, cfg.formality);
  todo.forEach(([k], i) => setPath(o, k, translated[i]));
  save(lng, o);
  console.log(`${lng}: filled ${todo.length} keys`);
  for (let i = 0; i < Math.min(6, todo.length); i++) console.log(`   ${todo[i][0]} => ${translated[i]}`);
}
