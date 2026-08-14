#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const root = path.resolve(import.meta.dirname, '../..');
const outputDir = path.join(root, 'docs/cleanup/generated');
const extensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mts', '.cts', '.mjs', '.cjs']);
const sourceRoots = ['src', 'server/src', 'packages/shared/src', 'apps/new-app/frontend/src', 'apps/new-app/backend/src'];
const runtimeEntries = {
  frontend: ['src/index.tsx'],
  backend: ['server/src/index.ts'],
  newAppFrontend: ['apps/new-app/frontend/src/index.tsx'],
  newAppBackend: ['apps/new-app/backend/src/index.ts'],
};

const rel = (file) => path.relative(root, file).split(path.sep).join('/');
const absolute = (file) => path.resolve(root, file);
const isIgnoredDirectory = (name) =>
  ['node_modules', 'dist', 'coverage', '.git', '.tmp', '_backup', '_quarantine'].includes(name);
const isTestLike = (file) =>
  /(^|\/)(__tests__|tests?|test-utils|__mocks__)(\/|$)|\.(test|spec)\.[cm]?[jt]sx?$/.test(file);
const isDuplicateLike = (file) => /(^|\/)[^/]+ (copy|\([0-9]+\)|[0-9]+)\.[^/]+$/.test(file);

function walk(directory, result = []) {
  if (!fs.existsSync(directory)) return result;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && isIgnoredDirectory(entry.name)) continue;
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(full, result);
    else if (extensions.has(path.extname(entry.name))) result.push(full);
  }
  return result;
}

const productionFiles = sourceRoots.flatMap((dir) => walk(absolute(dir)))
  .filter((file) => !isTestLike(rel(file)) && !isDuplicateLike(rel(file)));
const allAnalysisFiles = [
  ...new Set([
    ...sourceRoots.flatMap((dir) => walk(absolute(dir))),
    ...walk(absolute('scripts')),
    ...walk(absolute('tests')),
  ]),
];
const knownFiles = new Set(allAnalysisFiles.map((file) => path.normalize(file)));

const compilerOptions = {
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  module: ts.ModuleKind.ESNext,
  target: ts.ScriptTarget.ES2022,
  jsx: ts.JsxEmit.ReactJSX,
  allowJs: true,
  resolveJsonModule: true,
  baseUrl: root,
  paths: { '@/*': ['src/*'] },
};
const host = ts.createCompilerHost(compilerOptions, true);

function localFallback(specifier, importer) {
  specifier = specifier.split('?')[0].split('#')[0];
  let base;
  if (specifier.startsWith('@/')) base = absolute(path.join('src', specifier.slice(2)));
  else if (specifier.startsWith('.')) base = path.resolve(path.dirname(importer), specifier);
  else return null;
  const stem = base.replace(/\.(mjs|cjs|js|jsx|ts|tsx|mts|cts)$/, '');
  for (const candidate of [
    base,
    ...['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs'].map((ext) => stem + ext),
    ...['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs'].map((ext) => path.join(base, 'index' + ext)),
  ]) {
    if (knownFiles.has(path.normalize(candidate))) return path.normalize(candidate);
  }
  return null;
}

function resolveImport(specifier, importer) {
  const cleanSpecifier = specifier.split('?')[0].split('#')[0];
  const resolved = ts.resolveModuleName(cleanSpecifier, importer, compilerOptions, host).resolvedModule?.resolvedFileName;
  if (resolved && !resolved.includes('/node_modules/') && knownFiles.has(path.normalize(resolved))) {
    return path.normalize(resolved);
  }
  return localFallback(cleanSpecifier, importer);
}

function isCodeSpecifier(specifier) {
  const clean = specifier.split('?')[0].split('#')[0];
  const extension = path.extname(clean);
  return extension === '' || extensions.has(extension);
}

const graph = new Map();
const unresolvedLocal = [];
for (const file of allAnalysisFiles) {
  const text = fs.readFileSync(file, 'utf8');
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const imports = [];
  const visit = (node) => {
    let specifier = null;
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      specifier = node.moduleSpecifier.text;
    } else if (ts.isCallExpression(node) && node.arguments.length > 0 && ts.isStringLiteral(node.arguments[0])) {
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === 'require')) {
        specifier = node.arguments[0].text;
      }
    }
    if (specifier) {
      const target = resolveImport(specifier, file);
      if (target) imports.push(target);
      else if ((specifier.startsWith('.') || specifier.startsWith('@/')) && isCodeSpecifier(specifier)) {
        unresolvedLocal.push({ importer: rel(file), specifier });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  graph.set(path.normalize(file), [...new Set(imports)]);
}

function reachableFrom(entries) {
  const seen = new Set();
  const stack = entries.map(absolute).map(path.normalize).filter((file) => knownFiles.has(file));
  while (stack.length) {
    const current = stack.pop();
    if (!current || seen.has(current)) continue;
    seen.add(current);
    for (const dependency of graph.get(current) ?? []) if (!seen.has(dependency)) stack.push(dependency);
  }
  return seen;
}

const reachability = Object.fromEntries(
  Object.entries(runtimeEntries).map(([name, entries]) => [name, reachableFrom(entries)])
);
const runtimeReachable = new Set(Object.values(reachability).flatMap((set) => [...set]));
const supportRoots = allAnalysisFiles.filter((file) => {
  const relative = rel(file);
  return isTestLike(relative) || relative.startsWith('scripts/') || relative.includes('/scripts/');
});
const supportReachable = reachableFrom(supportRoots.map(rel));
const reverseGraph = new Map();
for (const [importer, dependencies] of graph) for (const dependency of dependencies) {
  if (!reverseGraph.has(dependency)) reverseGraph.set(dependency, []);
  reverseGraph.get(dependency).push(importer);
}

const records = productionFiles.map((file) => {
  const relative = rel(file);
  const reachedBy = Object.entries(reachability).filter(([, files]) => files.has(file)).map(([name]) => name);
  let classification = 'ORPHAN_CANDIDATE';
  if (relative.endsWith('.d.ts')) classification = 'BUILD_SUPPORT';
  else if (runtimeReachable.has(file)) classification = 'RUNTIME_REACHABLE';
  else if (supportReachable.has(file)) classification = 'SUPPORT_ONLY';
  return {
    file: relative,
    classification,
    reachedBy,
    importedBy: (reverseGraph.get(file) ?? []).map(rel).sort(),
  };
}).sort((a, b) => a.file.localeCompare(b.file));

const counts = records.reduce((acc, record) => {
  acc[record.classification] = (acc[record.classification] ?? 0) + 1;
  return acc;
}, {});
const uniqueUnresolved = [...new Map(unresolvedLocal.map((item) => [`${item.importer}\0${item.specifier}`, item])).values()]
  .map((item) => {
    const importer = absolute(item.importer);
    const importerClassification = runtimeReachable.has(importer)
      ? 'RUNTIME_REACHABLE'
      : supportReachable.has(importer)
        ? 'SUPPORT_ONLY'
        : 'ORPHAN_CANDIDATE';
    return { ...item, importerClassification };
  });
const areaCounts = records.reduce((acc, record) => {
  const parts = record.file.split('/');
  const depth = parts[0] === 'server' || parts[0] === 'packages' || parts[0] === 'apps' ? 3 : 2;
  const area = parts.slice(0, depth).join('/');
  acc[area] ??= {};
  acc[area][record.classification] = (acc[area][record.classification] ?? 0) + 1;
  return acc;
}, {});
const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  gitSha: process.env.GIT_SHA ?? null,
  limitations: [
    'ORPHAN_CANDIDATE is never deletion authority; dynamic registries, filesystem loading and runtime strings require manual review.',
    'SUPPORT_ONLY means reachable from tests or scripts but not from a configured runtime entrypoint.',
    'Only configured source roots are classified; migrations, assets and documentation are inventoried separately.',
  ],
  runtimeEntries,
  counts,
  areaCounts,
  unresolvedLocalImports: uniqueUnresolved,
  runtimeUnresolvedLocalImports: uniqueUnresolved.filter((item) => item.importerClassification === 'RUNTIME_REACHABLE'),
  records,
};

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(path.join(outputDir, 'source-reachability.json'), JSON.stringify(report, null, 2) + '\n');
const markdown = [
  '# Source reachability inventory',
  '',
  `Generated from \`${report.gitSha ?? 'working-tree'}\` at ${report.generatedAt}.`,
  '',
  'This is a conservative inventory. `ORPHAN_CANDIDATE` means manual review is required; it never authorizes deletion.',
  '',
  '## Counts',
  '',
  '| Classification | Files |',
  '|---|---:|',
  ...Object.entries(counts).sort().map(([name, count]) => `| ${name} | ${count} |`),
  `| Unresolved local imports (all analyzed sources) | ${report.unresolvedLocalImports.length} |`,
  `| Unresolved local imports (runtime reachable) | ${report.runtimeUnresolvedLocalImports.length} |`,
  '',
  '## Runtime roots',
  '',
  ...Object.entries(runtimeEntries).map(([name, entries]) => `- ${name}: ${entries.map((entry) => `\`${entry}\``).join(', ')}`),
  '',
  'Detailed, machine-readable classifications are in `source-reachability.json`.',
  '',
  '## Limitations',
  '',
  ...report.limitations.map((item) => `- ${item}`),
  '',
];
fs.writeFileSync(path.join(outputDir, 'source-reachability.md'), markdown.join('\n'));
console.log(JSON.stringify({
  counts,
  unresolvedLocalImports: report.unresolvedLocalImports.length,
  runtimeUnresolvedLocalImports: report.runtimeUnresolvedLocalImports.length,
  outputDir: rel(outputDir),
}, null, 2));
