// Reachability-based orphan finder for admin code.
// BFS over the import graph from the app entry point; reports files under
// src/views/admin and src/components/Admin that are never reached.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SRC = path.join(ROOT, 'src');
const ENTRIES = [path.join(SRC, 'index.tsx')];
const EXTS = ['.tsx', '.ts', '.jsx', '.js'];

function resolveImport(spec, fromFile) {
  if (!spec.startsWith('.') && !spec.startsWith('@/')) return null; // external pkg
  let base;
  if (spec.startsWith('@/')) base = path.join(SRC, spec.slice(2));
  else base = path.resolve(path.dirname(fromFile), spec);
  // strip query
  base = base.split('?')[0];
  const candidates = [];
  // exact with ext already
  if (EXTS.some((e) => base.endsWith(e))) candidates.push(base);
  // map .js -> .ts/.tsx (TS ESM style)
  if (base.endsWith('.js')) {
    const noext = base.slice(0, -3);
    for (const e of EXTS) candidates.push(noext + e);
  }
  for (const e of EXTS) candidates.push(base + e);
  for (const e of EXTS) candidates.push(path.join(base, 'index' + e));
  for (const c of candidates) {
    try {
      if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
    } catch {}
  }
  return null;
}

const IMPORT_RE =
  /(?:import|export)\s+(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

function extractImports(content) {
  const out = [];
  let m;
  while ((m = IMPORT_RE.exec(content))) {
    const spec = m[1] || m[2];
    if (spec) out.push(spec);
  }
  return out;
}

const visited = new Set();
const queue = [...ENTRIES];
while (queue.length) {
  const file = queue.pop();
  if (visited.has(file)) continue;
  visited.add(file);
  let content;
  try {
    content = fs.readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  for (const spec of extractImports(content)) {
    const resolved = resolveImport(spec, file);
    if (resolved && !visited.has(resolved)) queue.push(resolved);
  }
}

function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === '__tests__') continue;
      out.push(...walk(p));
    } else if (/\.(tsx|ts)$/.test(e.name) && !/\.(test|spec|d)\./.test(e.name)) {
      out.push(p);
    }
  }
  return out;
}

const candidateDirs = [path.join(SRC, 'views/admin'), path.join(SRC, 'components/Admin')];
const orphans = [];
const live = [];
for (const dir of candidateDirs) {
  if (!fs.existsSync(dir)) continue;
  for (const f of walk(dir)) {
    if (visited.has(f)) live.push(f);
    else orphans.push(f);
  }
}

const rel = (f) => path.relative(ROOT, f);
console.log(`Reachable files total: ${visited.size}`);
console.log(`\n=== LIVE admin files (${live.length}) ===`);
live.sort().forEach((f) => console.log('  LIVE  ' + rel(f)));
console.log(`\n=== ORPHAN admin files (${orphans.length}) ===`);
orphans.sort().forEach((f) => console.log('  ORPHAN ' + rel(f)));
