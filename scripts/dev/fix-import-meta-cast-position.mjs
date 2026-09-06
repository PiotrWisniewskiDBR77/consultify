#!/usr/bin/env node
/**
 * Jednorazowy codemod (zlecenie Z5, 2026-09-06).
 *
 * KONTEKST: naprawa 05.09 (`fix-split-import-meta-env.mjs`,
 * `check-flags-env-static.mjs`) skleila `import.meta` i `.env` w JEDNO
 * wyrazenie: `(import.meta as unknown as { env?: ... }).env?.[KEY]`. To
 * naprawilo `vite build` i przegladarkowy `vite dev` (esbuild zdejmuje TS
 * PRZED podstawieniem `import.meta.env`), ale zmierzone 06.09: TEN SAM
 * ksztalt zwraca `undefined` w Vitest przy `vi.stubEnv` (Vitest/vite-node
 * decyduje o wstrzyknieciu preambuly na podstawie SUROWEGO zrodla, gdzie
 * cast fizycznie rozdziela "import.meta" od ".env" — dowod w
 * evidence/z5/05-vitest-cast-vs-literal-dowod.txt).
 *
 * NAPRAWA: przenosi cast na WYNIK `.env` zamiast na `import.meta` PRZED
 * `.env` —
 *   (import.meta as unknown as { env?: X }).env   ->   (import.meta.env as unknown as X)
 * Literalny token `import.meta.env` zostaje SPOJNY w zrodle -> dziala w
 * `vite build`, przegladarkowym `vite dev` I w Vitest jednoczesnie.
 * Semantyka (kolejnosc query>localStorage>env>default, wartosci domyslne)
 * NIE jest ruszana — to czysto skladniowe przesuniecie castu.
 *
 * Uzycie: node scripts/dev/fix-import-meta-cast-position.mjs <plik...>
 *   (bez argumentow: nic nie robi — celowo, zeby nie ryzykowac przypadkowego
 *   uruchomienia na calym repo bez jawnej listy plikow)
 */
import fs from 'node:fs';

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error('usage: node fix-import-meta-cast-position.mjs <plik1> <plik2> ...');
  process.exit(1);
}

// Kolejnosc ma znaczenie: warianty bardziej specyficzne pierwsze.
const RULES = [
  {
    name: 'unknown-as-record-string-undefined',
    re: /\(import\.meta as unknown as \{ env\?: Record<string, string \| undefined> \}\)\.env/g,
    to: '(import.meta.env as unknown as Record<string, string | undefined>)',
  },
  {
    name: 'unknown-as-record-string',
    re: /\(import\.meta as unknown as \{ env\?: Record<string, string> \}\)\.env/g,
    to: '(import.meta.env as unknown as Record<string, string>)',
  },
  {
    name: 'as-record-string',
    re: /\(import\.meta as \{ env\?: Record<string, string> \}\)\.env/g,
    to: '(import.meta.env as Record<string, string>)',
  },
  {
    name: 'as-any',
    re: /\(import\.meta as any\)\.env/g,
    to: '(import.meta.env as any)',
  },
  {
    name: 'as-any-optional-chain',
    re: /\(import\.meta as any\)\?\.env/g,
    to: '(import.meta.env as any)',
  },
  {
    name: 'importmeta-intersection-dev-boolean',
    re: /\(import\.meta as ImportMeta & \{ env\?: \{ DEV\?: boolean \} \}\)\.env/g,
    to: '(import.meta.env as unknown as { DEV?: boolean })',
  },
];

let totalChanged = 0;
const changedFiles = [];
for (const file of files) {
  const before = fs.readFileSync(file, 'utf8');
  let after = before;
  let fileHits = 0;
  for (const rule of RULES) {
    after = after.replace(rule.re, () => {
      fileHits++;
      return rule.to;
    });
  }
  if (after !== before) {
    fs.writeFileSync(file, after, 'utf8');
    totalChanged += fileHits;
    changedFiles.push({ file, hits: fileHits });
  }
}

console.log(`Zmienione pliki: ${changedFiles.length}`);
console.log(`Zamienione wystapienia: ${totalChanged}`);
for (const c of changedFiles) console.log(`  ${c.hits}\t${c.file}`);
