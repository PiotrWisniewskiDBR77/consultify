// One-off landing-page i18n completer. Translates missing / EN-equal `landing.*`
// leaves from EN into a target locale via DeepL, preserving existing good
// translations and rebuilding the `landing` subtree in EN key order.
import fs from 'node:fs';

const KEY = process.env.DEEPL_KEY;
const ENDPOINT = 'https://api.deepl.com/v2/translate';
const BASE = 'public/locales';

const TARGETS = {
  de: { deepl: 'DE', formality: 'prefer_more' },
  es: { deepl: 'ES', formality: 'prefer_more' },
  ja: { deepl: 'JA', formality: 'prefer_more' },
  ar: { deepl: 'AR', formality: null },
};

// Brand/proper nouns to keep verbatim, plus the only interpolation token.
const PROTECT = [/\{\{[^}]+\}\}/g, /Consultify/g, /Vector AI/g, /\bAnna\b/g];

const load = (l) => JSON.parse(fs.readFileSync(`${BASE}/${l}/translation.json`, 'utf8'));

function mask(text) {
  // tag_handling=xml requires valid XML: escape entities first, then wrap
  // protected tokens (which contain no special chars) in <ph> tags.
  let out = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  for (const re of PROTECT) out = out.replace(re, (m) => `<ph>${m}</ph>`);
  return out;
}
function unmask(text) {
  return text
    .replace(/<ph>/g, '')
    .replace(/<\/ph>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

async function deeplBatch(texts, target, formality) {
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
    headers: {
      Authorization: `DeepL-Auth-Key ${KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });
  if (!res.ok) throw new Error(`DeepL ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return json.translations.map((t) => unmask(t.text));
}

async function translateUnique(strings, target, formality) {
  const uniq = [...new Set(strings)];
  const map = new Map();
  const CHUNK = 40;
  for (let i = 0; i < uniq.length; i += CHUNK) {
    const slice = uniq.slice(i, i + CHUNK);
    const out = await deeplBatch(slice, target, formality);
    slice.forEach((s, j) => map.set(s, out[j]));
    process.stderr.write(`  ${target}: ${Math.min(i + CHUNK, uniq.length)}/${uniq.length}\n`);
  }
  return map;
}

// Decide per-leaf: keep existing good translation, else mark EN string for translation.
function collectStrings(enNode, tgtNode, need) {
  if (Array.isArray(enNode)) {
    enNode.forEach((el, i) => {
      if (typeof el === 'string') {
        const cur = Array.isArray(tgtNode) ? tgtNode[i] : undefined;
        if (!(typeof cur === 'string' && cur.trim() && cur !== el)) need.add(el);
      } else {
        collectStrings(el, Array.isArray(tgtNode) ? tgtNode[i] : undefined, need);
      }
    });
  } else if (enNode && typeof enNode === 'object') {
    for (const k of Object.keys(enNode)) {
      collectStrings(enNode[k], tgtNode && typeof tgtNode === 'object' ? tgtNode[k] : undefined, need);
    }
  } else if (typeof enNode === 'string') {
    const cur = tgtNode;
    if (!(typeof cur === 'string' && cur.trim() && cur !== enNode)) need.add(enNode);
  }
}

// Rebuild target subtree in EN key order using translations + kept values.
function rebuild(enNode, tgtNode, map) {
  if (Array.isArray(enNode)) {
    return enNode.map((el, i) => {
      if (typeof el === 'string') {
        const cur = Array.isArray(tgtNode) ? tgtNode[i] : undefined;
        if (typeof cur === 'string' && cur.trim() && cur !== el) return cur;
        return map.get(el) ?? el;
      }
      return rebuild(el, Array.isArray(tgtNode) ? tgtNode[i] : undefined, map);
    });
  }
  if (enNode && typeof enNode === 'object') {
    const out = {};
    for (const k of Object.keys(enNode)) {
      out[k] = rebuild(enNode[k], tgtNode && typeof tgtNode === 'object' ? tgtNode[k] : undefined, map);
    }
    return out;
  }
  if (typeof enNode === 'string') {
    const cur = tgtNode;
    if (typeof cur === 'string' && cur.trim() && cur !== enNode) return cur;
    return map.get(enNode) ?? enNode;
  }
  return tgtNode ?? enNode;
}

async function run(only) {
  const en = load('en');
  const enLanding = en.landing;
  for (const lng of Object.keys(TARGETS)) {
    if (only && lng !== only) continue;
    const cfg = TARGETS[lng];
    const tgt = load(lng);
    const need = new Set();
    collectStrings(enLanding, tgt.landing, need);
    process.stderr.write(`\n[${lng}] strings to translate (unique): ${need.size}\n`);
    const map = await translateUnique([...need], cfg.deepl, cfg.formality);
    tgt.landing = rebuild(enLanding, tgt.landing, map);
    fs.writeFileSync(`${BASE}/${lng}/translation.json`, JSON.stringify(tgt, null, 2) + '\n');
    process.stderr.write(`[${lng}] written.\n`);
    // sample
    const sample = ['epicHero.sub', 'problemPlatform.sub', 'topBar.menu', 'hero.noCreditCard'];
    for (const s of sample) {
      const v = s.split('.').reduce((o, k) => (o ? o[k] : undefined), tgt.landing);
      if (v !== undefined) process.stderr.write(`   ${s} => ${JSON.stringify(v).slice(0, 120)}\n`);
    }
  }
}

run(process.argv[2]).catch((e) => {
  console.error(e);
  process.exit(1);
});
