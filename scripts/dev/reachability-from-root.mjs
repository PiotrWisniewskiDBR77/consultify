#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const repo = process.cwd();
const requireFromRepo = createRequire(path.join(repo, 'package.json'));
const ts = requireFromRepo('typescript');
const extensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(absolute);
    return extensions.includes(path.extname(entry.name)) && !entry.name.endsWith('.d.ts') ? [absolute] : [];
  });
}

function canonical(file) {
  return path.relative(repo, fs.realpathSync(file)).split(path.sep).join('/');
}

function resolveLocal(fromFile, specifier) {
  let stem;
  if (specifier.startsWith('@/')) stem = path.join(repo, 'src', specifier.slice(2));
  else if (specifier.startsWith('.')) stem = path.resolve(path.dirname(fromFile), specifier);
  else return null;
  const candidates = [stem, ...extensions.map((ext) => stem + ext), ...extensions.map((ext) => path.join(stem, 'index' + ext))];
  const found = candidates.find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
  return found ? canonical(found) : null;
}

function dependencies(file) {
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  const specs = new Set();
  function visit(node) {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteralLike(node.moduleSpecifier)) {
      specs.add(node.moduleSpecifier.text);
    }
    if (ts.isCallExpression(node) && node.arguments.length === 1 && ts.isStringLiteralLike(node.arguments[0])) {
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === 'require')) {
        specs.add(node.arguments[0].text);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return [...specs].map((specifier) => resolveLocal(file, specifier)).filter(Boolean);
}

const sourceFiles = walk(path.join(repo, 'src'));
const harnessFiles = walk(path.join(repo, 'dev-render'));
const testFiles = [...walk(path.join(repo, 'tests')), ...sourceFiles.filter((file) => file.includes('/__tests__/') || /\.(test|spec)\.[^.]+$/.test(file))];
const allFiles = [...new Set([...sourceFiles, ...harnessFiles, ...testFiles])];
const absoluteByCanonical = new Map(allFiles.map((file) => [canonical(file), file]));
const graph = new Map(allFiles.map((file) => [canonical(file), dependencies(file)]));

function reachable(roots) {
  const seen = new Set();
  const stack = roots.filter((root) => absoluteByCanonical.has(root));
  while (stack.length) {
    const current = stack.pop();
    if (seen.has(current)) continue;
    seen.add(current);
    for (const dependency of graph.get(current) || []) if (!seen.has(dependency)) stack.push(dependency);
  }
  return seen;
}

const app = reachable(['src/index.tsx']);
const harness = reachable(['dev-render/main.tsx']);
const tests = reachable(testFiles.map(canonical));
const rows = sourceFiles.map(canonical).sort().map((file) => ({
  file,
  app: app.has(file),
  harness: harness.has(file),
  tests: tests.has(file),
  classification: app.has(file) ? 'app' : harness.has(file) ? 'harness-only' : tests.has(file) ? 'test-only' : 'unreachable',
}));
const result = {
  schemaVersion: 1,
  roots: { app: ['src/index.tsx'], harness: ['dev-render/main.tsx'], tests: testFiles.length },
  totals: Object.fromEntries(['app', 'harness-only', 'test-only', 'unreachable'].map((name) => [name, rows.filter((row) => row.classification === name).length])),
  files: rows,
};

const baselinePath = path.join(repo, 'docs/program/waves/WAVE_03_ACCEPTANCE/reachability.baseline.json');
if (process.argv.includes('--update-baseline')) {
  const unreachable = rows.filter((item) => item.classification === 'unreachable').map((item) => item.file);
  const previous = fs.existsSync(baselinePath) ? JSON.parse(fs.readFileSync(baselinePath, 'utf8')).files : null;
  if (previous && unreachable.some((file) => !previous.includes(file))) {
    throw new Error('Baseline update refused: the unreachable set grew');
  }
  fs.writeFileSync(baselinePath, JSON.stringify({ schemaVersion: 1, files: unreachable }, null, 2) + '\n');
  console.log(`Updated ${path.relative(repo, baselinePath)} (${unreachable.length} files)`);
  process.exit(0);
}

if (process.argv.includes('--check-baseline')) {
  if (!fs.existsSync(baselinePath)) throw new Error(`Missing baseline: ${path.relative(repo, baselinePath)}`);
  const baseline = new Set(JSON.parse(fs.readFileSync(baselinePath, 'utf8')).files);
  const additions = rows.filter((item) => item.classification === 'unreachable' && !baseline.has(item.file)).map((item) => item.file);
  if (additions.length) {
    console.error(`New unreachable files (${additions.length}):\n${additions.join('\n')}`);
    process.exit(1);
  }
  console.log(`Reachability baseline OK (${baseline.size} accepted unreachable files)`);
  process.exit(0);
}

if (process.argv.includes('--unreachable-only')) {
  for (const row of rows.filter((item) => item.classification === 'unreachable')) console.log(row.file);
} else {
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}
