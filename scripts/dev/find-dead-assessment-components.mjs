// One-off dead-code finder for src/components/assessment/** — 2026-08-26
// assessment cleanup batch. Builds the whole repo's import graph once (no
// per-file grep subprocess), then computes TRUE reachability for every
// candidate: a file is ALIVE if something OUTSIDE src/components/assessment
// imports it (an "anchor" — a route, another module, a test, a dev-render
// harness), or if something else INSIDE the tree that is itself alive
// imports it (transitive closure, fixpoint). This catches chains a naive
// single-hop check misses — e.g. file B has one importer A, but A itself
// has zero importers anywhere: B is not really alive just because A still
// mentions it.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const TARGET_DIR = 'src/components/assessment';
const SEARCH_DIRS = ['src', 'dev-render', 'scripts', 'server/src', 'tests'];
const SOURCE_EXT = /\.(tsx|ts|mjs|js|cjs)$/;

function walk(dir, out) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'build') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (SOURCE_EXT.test(entry.name)) out.push(full);
  }
}

function listCandidates(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__') continue;
      out.push(...listCandidates(full));
    } else if (/\.(tsx|ts)$/.test(entry.name) && !entry.name.endsWith('.test.tsx') && !entry.name.endsWith('.test.ts')) {
      out.push(full);
    }
  }
  return out;
}

const allFiles = [];
for (const d of SEARCH_DIRS) walk(path.join(ROOT, d), allFiles);

const IMPORT_RE = /(?:from\s+|require\(\s*|import\(\s*)['"]([^'"]+)['"]/g;
// specifier's last path segment -> Set(relative importer file paths)
const importersByBasename = new Map();

for (const file of allFiles) {
  let content;
  try {
    content = fs.readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  const relImporter = path.relative(ROOT, file);
  let m;
  IMPORT_RE.lastIndex = 0;
  while ((m = IMPORT_RE.exec(content))) {
    const lastSeg = m[1].split('/').pop();
    if (!importersByBasename.has(lastSeg)) importersByBasename.set(lastSeg, new Set());
    importersByBasename.get(lastSeg).add(relImporter);
  }
}

const candidateFiles = listCandidates(TARGET_DIR);
const candidateByRel = new Map(); // rel path -> { basename, importers: [rel...] }
for (const file of candidateFiles) {
  const rel = path.relative(ROOT, file);
  const basename = path.basename(file).replace(/\.(tsx|ts)$/, '');
  const importerSet = importersByBasename.get(basename) ?? new Set();
  const importers = [...importerSet].filter((f) => f !== rel);
  candidateByRel.set(rel, { basename, importers });
}

const candidateRelSet = new Set(candidateByRel.keys());
const TARGET_PREFIX = TARGET_DIR + '/';

function isTestFile(rel) {
  return rel.includes('__tests__') || /\.test\.(tsx|ts|mjs|js)$/.test(rel) || rel.startsWith('tests/');
}

// An anchor is real PRODUCTION usage: something outside the assessment tree
// AND not itself a test file. A dedicated test file for an otherwise-unused
// component (e.g. RapidLeanWorkspace.test.tsx testing RapidLeanWorkspace.tsx,
// which the task's own ground truth lists as dead) does not make the
// component alive — orphaned coverage for orphaned code, both get removed
// together. dev-render/** harness screens DO count (maintained, checked-in
// render entry points used for real evidence screenshots, not test doubles).
function isProductionAnchor(rel) {
  return !rel.startsWith(TARGET_PREFIX) && !isTestFile(rel);
}

const alive = new Set();
for (const [rel, info] of candidateByRel) {
  if (info.importers.some(isProductionAnchor)) alive.add(rel);
}

// Fixpoint propagation: a candidate is alive if imported by an alive
// candidate (inside the tree) too.
let changed = true;
while (changed) {
  changed = false;
  for (const [rel, info] of candidateByRel) {
    if (alive.has(rel)) continue;
    for (const importer of info.importers) {
      if (candidateRelSet.has(importer) && alive.has(importer)) {
        alive.add(rel);
        changed = true;
        break;
      }
    }
  }
}

const dead = [...candidateByRel.keys()].filter((rel) => !alive.has(rel)).sort();
const aliveList = [...alive].sort();

console.log(`\n=== DEAD (unreachable from any real entry point) — ${dead.length} files ===`);
for (const rel of dead) {
  const info = candidateByRel.get(rel);
  const note = info.importers.length > 0 ? `  (only referenced by other dead file(s): ${info.importers.join(', ')})` : '';
  console.log(rel + note);
}

console.log(`\n=== ALIVE — ${aliveList.length} files ===`);
for (const rel of aliveList) {
  const info = candidateByRel.get(rel);
  const outside = info.importers.filter(isProductionAnchor);
  const anchor = outside.length > 0 ? outside.slice(0, 2).join(', ') : '(transitive only)';
  console.log(`${rel}  <-  ${anchor}`);
}
