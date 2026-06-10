// Precise: which test files import a file in the admin-orphan set?
// Reuses reachability to compute orphans, then resolves each test file's
// imports and matches by RESOLVED PATH (not by symbol name).
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SRC = path.join(ROOT, 'src');
const ENTRIES = [path.join(SRC, 'index.tsx')];
const EXTS = ['.tsx', '.ts', '.jsx', '.js'];

function resolveImport(spec, fromFile) {
  if (!spec.startsWith('.') && !spec.startsWith('@/')) return null;
  let base = spec.startsWith('@/') ? path.join(SRC, spec.slice(2)) : path.resolve(path.dirname(fromFile), spec);
  base = base.split('?')[0];
  const cands = [];
  if (EXTS.some((e) => base.endsWith(e))) cands.push(base);
  if (base.endsWith('.js')) { const n = base.slice(0, -3); for (const e of EXTS) cands.push(n + e); }
  for (const e of EXTS) cands.push(base + e);
  for (const e of EXTS) cands.push(path.join(base, 'index' + e));
  for (const c of cands) { try { if (fs.existsSync(c) && fs.statSync(c).isFile()) return c; } catch {} }
  return null;
}
const IMPORT_RE = /(?:import|export)\s+(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
function imports(content) { const o = []; let m; while ((m = IMPORT_RE.exec(content))) { const s = m[1] || m[2]; if (s) o.push(s); } return o; }

// reachability
const visited = new Set(); const q = [...ENTRIES];
while (q.length) { const f = q.pop(); if (visited.has(f)) continue; visited.add(f);
  let c; try { c = fs.readFileSync(f, 'utf8'); } catch { continue; }
  for (const s of imports(c)) { const r = resolveImport(s, f); if (r && !visited.has(r)) q.push(r); } }

function walk(dir, pred) { const out = []; if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p, pred)); else if (pred(p)) out.push(p); } return out; }

// orphan set = admin candidates not reached
const candDirs = [path.join(SRC, 'views/admin'), path.join(SRC, 'components/Admin')];
const orphans = new Set();
for (const d of candDirs) for (const f of walk(d, (p) => /\.(tsx|ts)$/.test(p) && !/\.(test|spec|d)\./.test(p) && !p.includes('__tests__'))) if (!visited.has(f)) orphans.add(f);

// all test files
const testPred = (p) => /\.(test|spec)\.(tsx|ts)$/.test(p);
const testFiles = [...walk(path.join(ROOT, 'tests'), testPred), ...walk(SRC, testPred)];

const orphanTests = [];
for (const tf of testFiles) {
  let c; try { c = fs.readFileSync(tf, 'utf8'); } catch { continue; }
  const hit = imports(c).map((s) => resolveImport(s, tf)).filter(Boolean).filter((r) => orphans.has(r));
  if (hit.length) orphanTests.push({ test: tf, importsOrphans: [...new Set(hit)] });
}

const rel = (f) => path.relative(ROOT, f);
console.log(`orphans: ${orphans.size}, test files scanned: ${testFiles.length}`);
console.log(`\n=== TESTS importing an orphan (${orphanTests.length}) ===`);
for (const ot of orphanTests.sort((a, b) => a.test.localeCompare(b.test))) {
  console.log(rel(ot.test));
  for (const o of ot.importsOrphans) console.log('      -> ' + rel(o));
}
