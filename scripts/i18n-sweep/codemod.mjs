// i18n codemod: convert `isPolish ? 'PL' : 'EN'` -> t('ns.key'), collect {key:{pl,en}}
// SURGICAL: replaces only the exact source span of each qualifying node (splice on the
// original string), leaving all other bytes/formatting untouched -> minimal diffs.
// Usage: node codemod.mjs <ns> <dir> [--write]
import { parse } from '@babel/parser';
import _traverse from '@babel/traverse';
import fs from 'fs';
import path from 'path';
const traverse = _traverse.default || _traverse;

const [, , NS, DIR, writeFlag] = process.argv;
const WRITE = writeFlag === '--write';
if (!NS || !DIR) { console.error('args: <ns> <dir> [--write]'); process.exit(1); }

function walk(d) {
  const out = [];
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) {
      if (e.name === '__tests__' || e.name === 'node_modules') continue;
      out.push(...walk(p));
    } else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) && !/\.d\.ts$/.test(e.name)) {
      out.push(p);
    }
  }
  return out;
}

function slug(en) {
  let s = en.replace(/[^A-Za-z0-9\s]/g, ' ').trim().split(/\s+/).slice(0, 6);
  let out = s.map((w, i) => (i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())).join('');
  out = out.replace(/[^A-Za-z0-9]/g, '');
  if (!out) out = 'k';
  if (/^[0-9]/.test(out)) out = 'n' + out;
  return out.slice(0, 40);
}

const pairToKey = new Map();
const keys = {};
const usedKeys = new Set();
// Seed with existing top-level subkeys of this namespace (en locale) so generated
// slugs never collide with hand-authored keys / nested objects.
try {
  const enJson = JSON.parse(fs.readFileSync('public/locales/en/translation.json', 'utf8'));
  const existing = enJson[NS];
  if (existing && typeof existing === 'object' && !Array.isArray(existing)) {
    for (const k of Object.keys(existing)) usedKeys.add(k);
  }
} catch { /* ns may not exist yet */ }
function keyFor(pl, en) {
  const id = pl + '' + en;
  if (pairToKey.has(id)) return pairToKey.get(id);
  let base = slug(en);
  let k = base, i = 2;
  while (usedKeys.has(k)) { k = base + i; i++; }
  usedKeys.add(k); pairToKey.set(id, k); keys[k] = { pl, en };
  return k;
}

const residue = [];
let convCount = 0, filesChanged = 0;
const filesNoT = new Set();
const files = walk(DIR);

for (const file of files) {
  const code = fs.readFileSync(file, 'utf8');
  if (!code.includes('isPolish')) continue;
  let ast;
  try { ast = parse(code, { sourceType: 'module', plugins: ['typescript', 'jsx'] }); }
  catch (e) { residue.push(`PARSE_FAIL ${file}: ${e.message}`); continue; }

  const edits = []; // {start, end, text}
  traverse(ast, {
    ConditionalExpression(p) {
      const n = p.node;
      if (!(n.test.type === 'Identifier' && n.test.name === 'isPolish')) return;
      const isStr = (x) => x.type === 'StringLiteral' || (x.type === 'TemplateLiteral' && x.expressions.length === 0);
      if (!isStr(n.consequent) || !isStr(n.alternate)) { residue.push(`${file}:${n.loc.start.line} nonStringTernary`); return; }
      const val = (x) => (x.type === 'StringLiteral' ? x.value : x.quasis.map((q) => q.value.cooked).join(''));
      const pl = val(n.consequent), en = val(n.alternate);
      if (!pl || !en) { residue.push(`${file}:${n.loc.start.line} emptyStr`); return; }
      // Skip locale-code ternaries like isPolish ? 'pl' : 'en' / 'pl-PL' : 'en-GB' — these feed Intl/formatters, keep as-is
      const isLocaleCode = (s) => /^[a-z]{2}([-_][A-Za-z]{2})?$/.test(s);
      if (isLocaleCode(pl) && isLocaleCode(en)) { residue.push(`${file}:${n.loc.start.line} localeCode(${pl}/${en})`); return; }
      // Per-SCOPE gate: only convert if `t` is bound AND that binding comes from
      // `const { t } = useTranslation()` (not a local var/param shadowing `t`).
      const binding = p.scope.getBinding('t');
      let fromUT = false;
      if (binding && binding.path) {
        let dp = binding.path;
        while (dp && !dp.isVariableDeclarator()) dp = dp.parentPath;
        if (dp && dp.node.init && dp.node.init.type === 'CallExpression'
          && dp.node.init.callee && dp.node.init.callee.name === 'useTranslation') fromUT = true;
      }
      if (!fromUT) { residue.push(`${file}:${n.loc.start.line} NO_t_fromUseTranslation`); filesNoT.add(file); return; }
      const k = keyFor(pl, en);
      edits.push({ start: n.start, end: n.end, text: `t('${NS}.${k}')` });
      convCount++;
    },
  });

  if (edits.length) {
    if (WRITE) {
      // apply descending by start so offsets stay valid; surgical splice on original source
      edits.sort((a, b) => b.start - a.start);
      let out = code;
      for (const e of edits) out = out.slice(0, e.start) + e.text + out.slice(e.end);
      fs.writeFileSync(file, out);
    }
    filesChanged++;
  }
}

console.log(JSON.stringify({ ns: NS, dir: DIR, write: WRITE, filesScanned: files.length, filesChanged, converted: convCount, uniqueKeys: Object.keys(keys).length, residueCount: residue.length, filesNeedingHook: filesNoT.size }, null, 2));
fs.writeFileSync(path.join('scripts/i18n-sweep', `keys_${NS}.json`), JSON.stringify(keys, null, 2));
fs.writeFileSync(path.join('scripts/i18n-sweep', `residue_${NS}.txt`), residue.join('\n'));
fs.writeFileSync(path.join('scripts/i18n-sweep', `missingT_${NS}.txt`), [...filesNoT].join('\n'));
