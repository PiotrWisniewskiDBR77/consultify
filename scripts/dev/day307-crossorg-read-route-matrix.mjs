#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const repo = path.resolve(import.meta.dirname, '../..');
const requireFromRepo = createRequire(path.join(repo, 'package.json'));
const ts = requireFromRepo('typescript');

const routesRoot = path.join(repo, 'server/src/routes');
const gatewayPath = path.join(repo, 'server/src/Gateway.ts');
const outputPath = process.argv[2] ? path.resolve(process.argv[2]) : null;

const routeFiles = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== '__tests__') walk(full);
    } else if (/\.(?:ts|js|routes)$/.test(entry.name) && !/\.d\.ts$/.test(entry.name)) {
      routeFiles.push(full);
    }
  }
}
walk(routesRoot);

function sourceFile(file) {
  return ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
}

function resolveImport(fromFile, specifier) {
  if (!specifier.startsWith('.')) return null;
  const base = path.resolve(path.dirname(fromFile), specifier.replace(/\.js$/, ''));
  for (const candidate of [base + '.ts', base + '.js', path.join(base, 'index.ts'), path.join(base, 'index.js')]) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function literal(node) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  return null;
}

function importsFor(sf) {
  const imports = new Map();
  for (const statement of sf.statements) {
    if (!ts.isImportDeclaration(statement) || !statement.importClause) continue;
    const specifier = literal(statement.moduleSpecifier);
    if (!specifier) continue;
    const resolved = resolveImport(sf.fileName, specifier);
    if (!resolved) continue;
    if (statement.importClause.name) imports.set(statement.importClause.name.text, resolved);
    const bindings = statement.importClause.namedBindings;
    if (bindings && ts.isNamedImports(bindings)) {
      for (const element of bindings.elements) imports.set(element.name.text, resolved);
    }
  }
  return imports;
}

function callInfo(node) {
  if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression)) return null;
  return { receiver: node.expression.expression.getText(), method: node.expression.name.text };
}

const mountEdges = [];
function collectMounts(file, rootPrefix = null) {
  const sf = sourceFile(file);
  const imports = importsFor(sf);
  function visit(node) {
    const info = callInfo(node);
    if (info && ['use', 'mountStub'].includes(info.method)) {
      const prefix = literal(node.arguments[0]);
      if (prefix) {
        for (const arg of [...node.arguments].slice(1)) {
          const target = imports.get(arg.getText());
          if (target) mountEdges.push({ from: file, prefix, target });
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sf);
  if (rootPrefix !== null) mountEdges.push({ from: '__ROOT__', prefix: rootPrefix, target: file });
}

collectMounts(gatewayPath);
for (const file of routeFiles) collectMounts(file);

const prefixes = new Map();
for (const edge of mountEdges.filter((item) => item.from === gatewayPath)) {
  if (edge.prefix.startsWith('/api')) prefixes.set(edge.target, new Set([edge.prefix]));
}
let changed = true;
while (changed) {
  changed = false;
  for (const edge of mountEdges) {
    const parents = prefixes.get(edge.from);
    if (!parents) continue;
    const targets = prefixes.get(edge.target) ?? new Set();
    for (const parent of parents) {
      const joined = `${parent.replace(/\/$/, '')}/${edge.prefix.replace(/^\//, '')}`.replace(/\/$/, '');
      if (!targets.has(joined)) {
        targets.add(joined);
        changed = true;
      }
    }
    prefixes.set(edge.target, targets);
  }
}

const dbSignal = /\b(?:db(?:All|Get|Run)?|query(?:All|First|One|Run)?|pool|SELECT|FROM|JOIN)\b/i;
const orgSignal = /\b(?:organizationId|organization_id|orgId|org_id|req\.user|req\.organization)\b/i;
const publicSignal = /(?:^|\/)(?:health|ready|ping|status|auth|public|webhooks?)(?:\/|$)/i;
const guardPatterns = [
  'verifyToken',
  'requireOrganization',
  'requireOrgAccess',
  'validateOrgMembership',
  'organizationId',
  'organization_id',
  'orgId',
  'org_id',
];

const rows = [];
for (const file of routeFiles) {
  const sf = sourceFile(file);
  const fileText = sf.getFullText();
  function visit(node) {
    const info = callInfo(node);
    if (!info || info.receiver !== 'router' || info.method !== 'get') {
      ts.forEachChild(node, visit);
      return;
    }
    const localPath = literal(node.arguments[0]);
    const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
    const mounts = [...(prefixes.get(file) ?? [])];
    const callText = node.getText(sf);
    const hasDb = dbSignal.test(callText) || dbSignal.test(fileText);
    const hasOrg = orgSignal.test(callText) || orgSignal.test(fileText);
    const reasons = [];
    if (!localPath) reasons.push('dynamiczna_sciezka');
    if (mounts.length === 0) reasons.push('brak_osiagalnego_mountu_gateway');
    if (!hasDb) reasons.push('brak_sygnalu_odczytu_db');
    if (!hasOrg) reasons.push('brak_sygnalu_organizacji');
    const fullPaths = localPath
      ? mounts.map((mount) => `${mount.replace(/\/$/, '')}/${localPath.replace(/^\//, '')}`.replace(/\/$/, ''))
      : [];
    if (fullPaths.some((item) => publicSignal.test(item))) reasons.push('rodzina_publiczna_lub_systemowa');
    const guards = guardPatterns.filter((pattern) => callText.includes(pattern));
    const flags = [
      ...(fullPaths.some((item) => item.startsWith('/api/v8')) ? ['ENABLE_V8_GLOBAL'] : []),
      ...([...callText.matchAll(/process\.env\.([A-Z0-9_]+)/g)].map((match) => match[1])),
    ];
    rows.push({
      included: reasons.length === 0,
      reason: reasons.length ? reasons.join(',') : 'objeta',
      route: fullPaths.join(' | ') || localPath || '<dynamiczna>',
      file: path.relative(repo, file),
      line,
      guard: guards.join('+') || 'BRAK_JAWNEGO_STRAZNIKA_W_CALL',
      flag: [...new Set(flags)].join('+') || 'brak_wykrytej_flagi',
    });
    ts.forEachChild(node, visit);
  }
  visit(sf);
}

const parsedLocations = new Set(rows.map((row) => `${row.file}:${row.line}`));
function walkTextual(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkTextual(full);
      continue;
    }
    let text;
    try {
      text = fs.readFileSync(full, 'utf8');
    } catch {
      continue;
    }
    const relative = path.relative(repo, full);
    for (const [index, sourceLine] of text.split('\n').entries()) {
      if (!/router\.get\(/.test(sourceLine)) continue;
      const key = `${relative}:${index + 1}`;
      if (parsedLocations.has(key)) continue;
      rows.push({
        included: false,
        reason: relative.includes('/__tests__/')
          ? 'plik_testowy_poza_mianownikiem_produkcji'
          : 'tekst_lub_nieobslugiwany_skladniowo_nie_jest_procedura_AST',
        route: '<brak-procedury-AST>',
        file: relative,
        line: index + 1,
        guard: 'NIE_DOTYCZY',
        flag: 'NIE_DOTYCZY',
      });
    }
  }
}
walkTextual(routesRoot);

rows.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
const included = rows.filter((row) => row.included);
const skipped = rows.filter((row) => !row.included);
const result = {
  rule: 'Mianownik to każde tekstowe router.get( w server/src/routes, zgodnie z komenda instrukcji. Objęte są tylko rzeczywiste wywołania AST poza __tests__, z literalna sciezka, osiagalne grafem app.use/mountStub -> router.use od Gateway, gdy wywolanie lub plik ma sygnal odczytu DB i sygnal organizacji, a pelna sciezka nie nalezy do rodziny publicznej/systemowej. Trafienia tekstowe niebedace procedura AST i pliki testowe pozostaja jawnie pominiete.',
  denominator: rows.length,
  included: included.length,
  skipped: skipped.length,
  rows,
};

const json = JSON.stringify(result, null, 2) + '\n';
if (outputPath) fs.writeFileSync(outputPath, json);
process.stdout.write(json);
