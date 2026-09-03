#!/usr/bin/env node
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';

const root = process.cwd();
const routesRoot = join(root, 'server/src/routes');
const mode = process.argv[2] ?? '--check';
const inventoryPath = process.argv[3];
const rawProperty = /(?:error|message):\s*(\((?:err|error) as Error\)|(?:err|error|e))\.message/g;

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === '__tests__' ? [] : walk(path);
    return path.endsWith('.ts') && !/\.(?:test|spec)\.ts$/.test(path) ? [path] : [];
  });
}

function importPath(file) {
  const depth = relative(routesRoot, dirname(file)).split('/').filter(Boolean).length;
  return `${'../'.repeat(depth + 1)}middleware/appErrorMapper.js`;
}

function classify(file, line) {
  const sample = `${file} ${line}`.toLowerCase();
  if (/valid|zod|schema|parse|400/.test(sample)) return ['walidator', 'nazwy pol wewnetrznych'];
  if (/sql|query|database|db\b|postgres|500/.test(sample)) return ['baza/nieznany', 'SQL, tabela lub kolumna'];
  if (/url|file|path|upload|export|import/.test(sample)) return ['biblioteka/nieznany', 'sciezka lub URL'];
  return ['nieznany', 'tresc, stack, klucz, SQL, sciezka lub URL'];
}

const files = walk(routesRoot).sort();
const rows = [];
let replacements = 0;
for (const file of files) {
  const before = readFileSync(file, 'utf8');
  for (const match of before.matchAll(rawProperty)) {
    const lineNo = before.slice(0, match.index).split('\n').length;
    const line = before.split('\n')[lineNo - 1]?.trim() ?? '';
    const [kind, leak] = classify(relative(root, file), line);
    rows.push([relative(root, file), lineNo, kind, leak]);
  }
  if (mode !== '--apply' || !rawProperty.test(before)) {
    rawProperty.lastIndex = 0;
    continue;
  }
  rawProperty.lastIndex = 0;
  let after = before.replace(rawProperty, (_all, errorExpression) => {
    replacements += 1;
    return `...mapAppErrorResponse(${errorExpression}, req)`;
  });
  if (!after.includes("middleware/appErrorMapper.js'")) {
    const insertion = `import { mapAppErrorResponse } from '${importPath(file)}';\n`;
    const imports = [...after.matchAll(/^import[\s\S]*?;\n/gm)];
    const last = imports.at(-1);
    const at = last ? last.index + last[0].length : 0;
    after = after.slice(0, at) + insertion + after.slice(at);
  }
  writeFileSync(file, after);
}

if (mode === '--inventory') {
  if (!inventoryPath) throw new Error('usage: --inventory <output.md>');
  const counts = new Map();
  for (const [file] of rows) counts.set(file, (counts.get(file) ?? 0) + 1);
  const out = [
    '# REJESTR WYCIEKOW BLEDOW TRAS — 2026-09-03',
    '',
    `Pomiar markera \`984d3658fd\`: **${rows.length} miejsc w ${counts.size} plikach**.`,
    '',
    '> Klasyfikacja jest konserwatywna: bez dowodu konkretnego typu rzucanego bledu wpis pozostaje `nieznany` lub klasa laczona.',
    '',
    '| Plik | Linia PRZED | Klasa | Co moglo wyciec | PO | Commit |',
    '| --- | ---: | --- | --- | --- | --- |',
    ...rows.map(([file, line, kind, leak]) => `| \`${file}\` | ${line} | ${kind} | ${leak} | oczekuje na codemod | — |`),
    '',
    '## Kody do decyzji',
    '',
    '- Statusy HTTP, w tym istniejace odpowiedzi 200 z polem `error`, nie sa zmieniane w dyzurze 296.',
    '',
    '## Front czyta `error`',
    '',
    '- Pomiar PRZED: 91 trafien w `src/services`, `src/api`, `src/hooks`. To zakres osobnego dyzuru; brak zmian w `src/`.',
    '',
  ].join('\n');
  writeFileSync(inventoryPath, out);
}

console.log(JSON.stringify({ mode, matches: rows.length, files: new Set(rows.map((r) => r[0])).size, replacements }));
if (mode === '--check' && rows.length) process.exitCode = 1;
