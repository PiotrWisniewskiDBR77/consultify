#!/usr/bin/env node
/**
 * Jednorazowy codemod (dyzur 2026-09-05): naprawia rozdzielony wzorzec
 * `const meta = import.meta as unknown as { env?: ... }; ... meta?.env?.[KEY]`
 * na doslowny `(import.meta as unknown as { env?: ... }).env?.[KEY]` w JEDNYM
 * wyrazeniu -- Vite/esbuild podstawia obiekt `import.meta.env` TYLKO gdy
 * `import.meta` i `.env` wystepuja w tym samym lancuchu MemberExpression.
 *
 * Uzycie: node scripts/dev/fix-split-import-meta-env.mjs [--check]
 *   --check  nie modyfikuje plikow, tylko zwraca kod 1 gdy cokolwiek trzeba
 *            naprawic (uzywane przez scripts/check-flags-env-static.mjs).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const CHECK_ONLY = process.argv.includes('--check');

const DECL_LINE_RE =
  /^[ \t]*const meta = import\.meta as unknown as \{ env\?: Record<string, string \| undefined> \};[ \t]*\r?\n/m;

const REPLACEMENT_EXPR =
  '(import.meta as unknown as { env?: Record<string, string | undefined> })';

function findCandidateFiles() {
  const result = spawnSync(
    'grep',
    ['-rl', '--include=*.ts', '--include=*.tsx', '= import\\.meta as', 'src'],
    { cwd: process.cwd(), encoding: 'utf8' }
  );
  if (result.status !== 0 && result.status !== 1) {
    throw new Error(`grep failed: ${result.stderr}`);
  }
  return (result.stdout || '').split('\n').filter(Boolean).sort();
}

function fixContent(content) {
  if (!DECL_LINE_RE.test(content)) return null;
  let next = content.replace(DECL_LINE_RE, '');
  // meta?.env  ->  (import.meta as unknown as {...}).env
  // Negative lookbehind excludes the ALREADY-correct literal `import.meta.env`
  // elsewhere in the same file (that `meta` is part of `import.meta`, not the
  // local `meta` variable this codemod is removing).
  next = next.replace(/(?<!import\.)\bmeta\?\.env\b/g, `${REPLACEMENT_EXPR}.env`);
  // meta.env (no optional chaining before .env) -> same, kept non-optional
  next = next.replace(/(?<!import\.)\bmeta\.env\b/g, `${REPLACEMENT_EXPR}.env`);
  return next;
}

const files = findCandidateFiles();
let changed = 0;
const touched = [];

for (const file of files) {
  const original = readFileSync(file, 'utf8');
  const fixed = fixContent(original);
  if (fixed === null || fixed === original) continue;
  touched.push(file);
  changed++;
  if (!CHECK_ONLY) {
    writeFileSync(file, fixed, 'utf8');
  }
}

if (CHECK_ONLY) {
  if (changed > 0) {
    console.error(`[fix-split-import-meta-env] ${changed} plik(ow) ma rozdzielony wzorzec import.meta/.env:`);
    for (const f of touched) console.error(`  - ${f}`);
    process.exit(1);
  }
  console.log('[fix-split-import-meta-env] OK — zero rozdzielonych wzorcow.');
  process.exit(0);
}

console.log(`[fix-split-import-meta-env] Naprawiono ${changed} plik(ow):`);
for (const f of touched) console.log(`  - ${f}`);
