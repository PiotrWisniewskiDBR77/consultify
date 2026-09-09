#!/usr/bin/env node
// Jednorazowy skrypt: BFS grafu importów od korzeni aplikacji (src/index.tsx),
// żeby zmierzyć czy dany plik jest osiągalny (żywy) czy nie (martwy).
// Obsługuje: import ... from '...', dynamic import('...'), React.lazy(() => import('...')),
// aliasy @/ -> src/, rozszerzenia .ts/.tsx/.js/.jsx, index.ts(x) w katalogach.

import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';

const ROOT = process.cwd();
const SRC = resolve(ROOT, 'src');

const ENTRY_POINTS = [
  'src/index.tsx',
  'src/App.tsx',
  'src/routes/AppRoutes.tsx',
];

const IMPORT_RE = /import\s*(?:type\s+)?(?:[\w*{}\s,]+from\s*)?["']([^"']+)["']/g;
const DYNAMIC_IMPORT_RE = /import\s*\(\s*["']([^"']+)["']\s*\)/g;
const EXPORT_FROM_RE = /export\s*(?:type\s+)?(?:[\w*{}\s,]+from\s*)?["']([^"']+)["']/g;
const REQUIRE_RE = /require\(\s*["']([^"']+)["']\s*\)/g;

const EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];

function resolveModule(spec, fromFile) {
  let base;
  if (spec.startsWith('@/')) {
    base = join(SRC, spec.slice(2));
  } else if (spec.startsWith('.')) {
    base = resolve(dirname(fromFile), spec);
  } else {
    return null; // pakiet zewnętrzny (node_modules) — pomijamy
  }
  // dokładna ścieżka z rozszerzeniem
  if (existsSync(base) && statSync(base).isFile()) return base;
  for (const ext of EXTENSIONS) {
    if (existsSync(base + ext)) return base + ext;
  }
  // katalog -> index
  if (existsSync(base) && statSync(base).isDirectory()) {
    for (const ext of EXTENSIONS) {
      const idx = join(base, 'index' + ext);
      if (existsSync(idx)) return idx;
    }
  }
  return null;
}

function extractImports(filePath) {
  const content = readFileSync(filePath, 'utf8');
  const specs = new Set();
  for (const re of [IMPORT_RE, DYNAMIC_IMPORT_RE, EXPORT_FROM_RE, REQUIRE_RE]) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(content))) {
      specs.add(m[1]);
    }
  }
  return specs;
}

function bfs(entryPoints) {
  const visited = new Set();
  const queue = [];
  for (const e of entryPoints) {
    const abs = resolve(ROOT, e);
    if (existsSync(abs)) queue.push(abs);
  }
  while (queue.length) {
    const file = queue.shift();
    if (visited.has(file)) continue;
    visited.add(file);
    let specs;
    try {
      specs = extractImports(file);
    } catch {
      continue;
    }
    for (const spec of specs) {
      const resolved = resolveModule(spec, file);
      if (resolved && !visited.has(resolved)) {
        queue.push(resolved);
      }
    }
  }
  return visited;
}

const reachable = bfs(ENTRY_POINTS);

// CLI: node reachability-check.mjs <plik1> <plik2> ...
const targets = process.argv.slice(2);
if (targets.length === 0) {
  console.log(`Łącznie osiągalnych plików: ${reachable.size}`);
  process.exit(0);
}
for (const t of targets) {
  const abs = resolve(ROOT, t);
  const isLive = reachable.has(abs);
  console.log(`${isLive ? 'ŻYWY' : 'MARTWY'}  ${t}`);
}
