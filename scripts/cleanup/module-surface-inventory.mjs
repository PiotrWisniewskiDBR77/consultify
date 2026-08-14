#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const root = path.resolve(import.meta.dirname, '../..');
const generatedDir = path.join(root, 'docs/cleanup/generated');
const reachability = JSON.parse(fs.readFileSync(path.join(generatedDir, 'source-reachability.json'), 'utf8'));
const rel = (file) => path.relative(root, file).split(path.sep).join('/');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const modules = [
  ['agent-hub', /agent.?hub|transformation.?case|agent.?plan|mywork\/agent/i],
  ['artifact-studio', /artifact.?studio|document.?studio|deck.?builder|spreadsheet|workbook|presentation/i],
  ['assessment', /assessment/i],
  ['audits', /audit/i],
  ['case-workspace', /case.?workspace|\/cases?\//i],
  ['chat', /\/chat|ai.?chat|conversation/i],
  ['execution', /execution|implementation/i],
  ['finance', /finance|economics|financial/i],
  ['ideas', /idea|mindmap|whiteboard|processflow/i],
  ['initiatives', /initiative/i],
  ['interview', /interview/i],
  ['my-work', /my.?work|decision|notebook|inbox|calendar|client.?vault/i],
  ['results', /results.?v?next|\bkpi\b|\bokr\b|\broi\b|scorecard/i],
  ['tools', /discovery.?tools|tool.?catalog|tool.?pack|tool.?output/i],
  ['admin-platform', /superadmin|admin.?panel|organization|settings|partner/i],
];

function moduleFor(value) {
  return modules.find(([, pattern]) => pattern.test(value))?.[0] ?? 'cross-cutting-or-unclassified';
}

function walk(directory, result = []) {
  if (!fs.existsSync(directory)) return result;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (['node_modules', 'dist', 'coverage', '.git', '.tmp', '_backup', '_quarantine'].includes(entry.name)) continue;
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(full, result);
    else result.push(full);
  }
  return result;
}

const cards = Object.fromEntries([...modules.map(([name]) => name), 'cross-cutting-or-unclassified'].map((name) => [name, {
  source: { RUNTIME_REACHABLE: [], SUPPORT_ONLY: [], ORPHAN_CANDIDATE: [] },
  frontendRoutes: [],
  backendMounts: [],
  featureFlags: [],
  migrations: [],
  seeds: [],
  tests: [],
}]));

for (const record of reachability.records) {
  cards[moduleFor(record.file)].source[record.classification].push(record.file);
}

const appRoutesFile = 'src/routes/AppRoutes.tsx';
const appRoutesText = read(appRoutesFile);
const appRoutesSource = ts.createSourceFile(appRoutesFile, appRoutesText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const visitRoutes = (node) => {
  if (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) {
    if (node.tagName.getText(appRoutesSource) === 'Route') {
      const attribute = node.attributes.properties.find((item) => ts.isJsxAttribute(item) && item.name.getText(appRoutesSource) === 'path');
      if (attribute?.initializer) {
        const route = ts.isStringLiteral(attribute.initializer)
          ? attribute.initializer.text
          : attribute.initializer.getText(appRoutesSource).replace(/^\{?|\}?$/g, '');
        const line = appRoutesSource.getLineAndCharacterOfPosition(attribute.getStart(appRoutesSource)).line + 1;
        cards[moduleFor(route)].frontendRoutes.push({ route, file: appRoutesFile, line });
      }
    }
  }
  ts.forEachChild(node, visitRoutes);
};
visitRoutes(appRoutesSource);

for (const serverMountFile of ['server/src/index.ts', 'server/src/Gateway.ts']) {
  const serverText = read(serverMountFile);
  const serverSource = ts.createSourceFile(serverMountFile, serverText, ts.ScriptTarget.Latest, true);
  const visitServer = (node) => {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'use') {
      const first = node.arguments[0];
      if (first) {
        const mount = first.getText(serverSource);
        if (mount.startsWith("'") || mount.startsWith('"') || mount.includes('API_PREFIX')) {
          const line = serverSource.getLineAndCharacterOfPosition(node.getStart(serverSource)).line + 1;
          const raw = node.getText(serverSource).slice(0, 300).replace(/\s+/g, ' ');
          cards[moduleFor(raw)].backendMounts.push({ mount, file: serverMountFile, line, raw });
        }
      }
    }
    ts.forEachChild(node, visitServer);
  };
  visitServer(serverSource);
}

const runtimeFiles = reachability.records.filter((record) => record.classification === 'RUNTIME_REACHABLE');
for (const record of runtimeFiles) {
  const text = read(record.file);
  const flags = text.match(/\b(?:VITE_[A-Z0-9_]+|FF_[A-Z0-9_]+|FEATURE_[A-Z0-9_]+)\b/g) ?? [];
  const card = cards[moduleFor(record.file)];
  for (const flag of flags) card.featureFlags.push({ flag, file: record.file });
}

const migrationDirs = ['server/migrations', 'server/src/database/migrations', 'migrations'];
const migrationFiles = migrationDirs.flatMap((directory) => walk(path.join(root, directory)))
  .filter((file) => /\.(sql|ts|js)$/.test(file));
for (const file of migrationFiles) {
  const relative = rel(file);
  cards[moduleFor(relative)].migrations.push(relative);
}

const seedFiles = [walk(path.join(root, 'scripts')), walk(path.join(root, 'server/scripts')), walk(path.join(root, 'server/src/scripts'))]
  .flat().filter((file) => /seed|fixture/i.test(path.basename(file)) && /\.[cm]?[jt]s$/.test(file));
for (const file of seedFiles) {
  const relative = rel(file);
  cards[moduleFor(relative)].seeds.push(relative);
}

const testFiles = [walk(path.join(root, 'tests')), walk(path.join(root, 'src')), walk(path.join(root, 'server/src'))]
  .flat().filter((file) => /\.(test|spec)\.[cm]?[jt]sx?$/.test(file));
for (const file of testFiles) {
  const relative = rel(file);
  cards[moduleFor(relative)].tests.push(relative);
}

for (const card of Object.values(cards)) {
  card.frontendRoutes = [...new Map(card.frontendRoutes.map((item) => [`${item.route}:${item.line}`, item])).values()];
  card.backendMounts = [...new Map(card.backendMounts.map((item) => [`${item.mount}:${item.line}`, item])).values()];
  card.featureFlags = [...new Map(card.featureFlags.map((item) => [`${item.flag}:${item.file}`, item])).values()];
  for (const key of Object.keys(card.source)) card.source[key].sort();
  for (const key of ['migrations', 'seeds', 'tests']) card[key] = [...new Set(card[key])].sort();
}

const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  gitSha: process.env.GIT_SHA ?? null,
  classification: 'HEURISTIC_MODULE_ATTRIBUTION_REQUIRES_REVIEW',
  warnings: [
    'Module attribution is path/name based and may place cross-module adapters in the wrong card.',
    'Counts prove inventory coverage, not functional completeness or demo readiness.',
    'Every ORPHAN_CANDIDATE still requires reverse-reference, dynamic-registry and Git-history review before deletion.',
  ],
  cards,
};

fs.mkdirSync(generatedDir, { recursive: true });
fs.writeFileSync(path.join(generatedDir, 'module-surface-inventory.json'), JSON.stringify(report, null, 2) + '\n');
const rows = Object.entries(cards).map(([name, card]) => {
  const s = card.source;
  return `| ${name} | ${s.RUNTIME_REACHABLE.length} | ${s.SUPPORT_ONLY.length} | ${s.ORPHAN_CANDIDATE.length} | ${card.frontendRoutes.length} | ${card.backendMounts.length} | ${card.featureFlags.length} | ${card.migrations.length} | ${card.seeds.length} | ${card.tests.length} |`;
});
const markdown = [
  '# Module surface inventory', '',
  `Generated from \`${report.gitSha ?? 'working-tree'}\` at ${report.generatedAt}.`, '',
  '> This is a coverage ledger, not a readiness verdict. Module attribution is heuristic and must be reviewed.', '',
  '| Module | Runtime | Support only | Orphan candidates | FE routes | BE mounts | Flag refs | Migrations | Seeds | Tests |',
  '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|',
  ...rows, '',
  'The machine-readable file `module-surface-inventory.json` contains the exact file lists and source locations.', '',
];
fs.writeFileSync(path.join(generatedDir, 'module-surface-inventory.md'), markdown.join('\n'));
console.log(markdown.slice(5, -2).join('\n'));
