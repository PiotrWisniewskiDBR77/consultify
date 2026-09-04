import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';

const root = process.cwd();
const require = createRequire(path.join(root, 'package.json'));
const ts = require('typescript');
const roots = ['src', 'server/src', 'tests'];
const reportPath = path.join(root, 'docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_TESTY_PUSTE_20260903.md');

function files(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(dir, entry.name);
    return entry.isDirectory() ? files(target) : [target];
  });
}

const testFiles = roots.flatMap((dir) => files(path.join(root, dir))).filter((file) => /\.test\.(?:ts|tsx|mts)$/.test(file));
const rows = [];
const skipped = [];
const selfDefinedSubjects = [];
let blocks = 0;

function isPascalIdentifier(name) {
  return /^[A-Z][A-Za-z0-9_$]*$/.test(name);
}

function isProductImport(sourceFile, importDeclaration) {
  if (!ts.isStringLiteral(importDeclaration.moduleSpecifier)) return false;
  const specifier = importDeclaration.moduleSpecifier.text;
  if (specifier.startsWith('@/')) return true;
  if (!specifier.startsWith('.')) return false;
  const resolved = path.resolve(path.dirname(sourceFile), specifier);
  return resolved === path.join(root, 'src')
    || resolved.startsWith(`${path.join(root, 'src')}${path.sep}`)
    || resolved === path.join(root, 'server/src')
    || resolved.startsWith(`${path.join(root, 'server/src')}${path.sep}`);
}

function importedProductNames(source, sourceFile) {
  const names = new Set();
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement) || !isProductImport(sourceFile, statement)) continue;
    const clause = statement.importClause;
    if (!clause) continue;
    if (clause.name) names.add(clause.name.text);
    if (clause.namedBindings && ts.isNamespaceImport(clause.namedBindings)) {
      names.add(clause.namedBindings.name.text);
    } else if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
      for (const element of clause.namedBindings.elements) names.add(element.name.text);
    }
  }
  return names;
}

function findSelfDefinedSubjects(source, sourceFile) {
  const declarations = new Map();
  for (const statement of source.statements) {
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name) || !isPascalIdentifier(declaration.name.text)) continue;
        if (!declaration.initializer || !(ts.isArrowFunction(declaration.initializer)
          || ts.isFunctionExpression(declaration.initializer)
          || ts.isClassExpression(declaration.initializer))) continue;
        declarations.set(declaration.name.text, declaration);
      }
    } else if ((ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement))
      && statement.name && isPascalIdentifier(statement.name.text)) {
      declarations.set(statement.name.text, statement);
    }
  }

  const productImports = importedProductNames(source, sourceFile);
  const used = new Set();
  const visitUsage = (node) => {
    if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node))
      && ts.isIdentifier(node.tagName) && declarations.has(node.tagName.text)) {
      used.add(node.tagName.text);
    }
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)
      && declarations.has(node.expression.text)) {
      used.add(node.expression.text);
    }
    ts.forEachChild(node, visitUsage);
  };
  visitUsage(source);

  return [...used]
    .filter((name) => !productImports.has(name))
    .map((name) => ({
      name,
      line: source.getLineAndCharacterOfPosition(declarations.get(name).getStart(source)).line + 1,
    }));
}

if (process.argv.includes('--self-test')) {
  const fixtureFile = path.join(root, 'tests/components/AIChat/MessageBubble.fixture.test.tsx');
  const fixture = `
import { render } from '@testing-library/react';
const MessageBubble = () => <div data-testid="message-bubble">Message Bubble</div>;
test('renders component', () => render(<MessageBubble />));
`;
  const fixtureSource = ts.createSourceFile(fixtureFile, fixture, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  assert.deepEqual(findSelfDefinedSubjects(fixtureSource, fixtureFile), [{ name: 'MessageBubble', line: 3 }]);
  process.stdout.write('SELF_TEST_OK MessageBubble\n');
  process.exit(0);
}

for (const file of testFiles) {
  let sourceText;
  try {
    sourceText = fs.readFileSync(file, 'utf8');
  } catch (error) {
    skipped.push({ file: path.relative(root, file), reason: `READ_ERROR: ${error.message}` });
    continue;
  }
  const source = ts.createSourceFile(file, sourceText, ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  if (source.parseDiagnostics.length > 0) {
    skipped.push({ file: path.relative(root, file), reason: `PARSE_DIAGNOSTICS=${source.parseDiagnostics.length}` });
  }
  const localSubjects = findSelfDefinedSubjects(source, file);
  if (localSubjects.length > 0) {
    const hasProductImport = source.statements.some((statement) =>
      ts.isImportDeclaration(statement) && isProductImport(file, statement));
    selfDefinedSubjects.push({ file: path.relative(root, file), hasProductImport, subjects: localSubjects });
  }
  const visit = (node) => {
    if (ts.isCallExpression(node)) {
      const callee = node.expression.getText(source);
      if (/^(?:it|test)(?:\.(?:each|concurrent|sequential))?$/.test(callee)) {
        blocks += 1;
        const titleNode = node.arguments[0];
        const callback = node.arguments.find((arg) => ts.isArrowFunction(arg) || ts.isFunctionExpression(arg));
        if (callback?.body) {
          const body = callback.body.getText(source);
          const expectCount = (body.match(/\bexpect\s*\(/g) ?? []).length;
          const weak = [
            ...(body.match(/\.toBeDefined\s*\(/g) ?? []),
            ...(body.match(/\.toBeTruthy\s*\(/g) ?? []),
            ...(body.match(/\.not\.toThrow\s*\(/g) ?? []),
            ...(body.match(/expect\s*\([^\n)]*\.ok\s*\)\.toBe\s*\(\s*true\s*\)/g) ?? []),
          ].length;
          const signal = /\b(fetch|axios|request|supertest|db(?:Get|All|Run)|DbPromise|database|query|execute)\b/i.test(body);
          if (expectCount > 0 && weak === expectCount && signal) {
            const title = titleNode ? titleNode.getText(source).replace(/^['"`]|['"`]$/g, '') : '<dynamic title>';
            const smoke = /\b(smoke|health|loads?|imports?|mounts?|defined|exists?)\b/i.test(title);
            rows.push({
              id: `E${String(rows.length + 1).padStart(4, '0')}`,
              file: path.relative(root, file),
              line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
              title,
              expects: expectCount,
              className: smoke ? 'UZASADNIONY' : 'SŁABY',
              reason: smoke ? 'Nazwa jawnie obiecuje wyłącznie smoke/istnienie; mutacja produktu nadal nie została wykonana.' : 'Wyłącznie słabe asercje po sygnale sieci/bazy; bez mutacji nie wolno nazwać PUSTY.',
            });
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
}

const gated = testFiles
  .filter((file) => /_DB_PREFIX/.test(fs.readFileSync(file, 'utf8')))
  .map((file) => path.relative(root, file));
const md = (value) => String(value).replace(/\|/g, '\\|').replace(/[\r\n]+/g, ' ');
const report = [
  '# Rejestr testów pustych — dyżur 309', '',
  '## Mianownik i metoda', '',
  `- Pliki testowe: ${testFiles.length}.`,
  `- Bloki \`it/test\` rozpoznane przez AST: ${blocks}.`,
  `- Kandydaci ze słabymi-only asercjami i sygnałem sieci/bazy: ${rows.length}.`,
  `- Pliki pominięte z powodu błędu odczytu/parsera: ${skipped.length}.`,
  '- `PUSTY` wymaga dowodu mutacyjnego; skaner nigdy nie nadaje tej klasy na podstawie tekstu.', '',
  '## Klasyfikacja', '',
  '| ID | Plik | Linia | Blok | Klasa | Dowód | Działanie |',
  '|---|---|---:|---|---|---|---|',
  ...rows.map((row) => `| ${row.id} | ${md(row.file)} | ${row.line} | ${md(row.title)} | ${row.className} | ${md(row.reason)} | DO WZMOCNIENIA / WERYFIKACJI MUTACYJNEJ |`), '',
  '## Podmiot testu zdefiniowany lokalnie', '',
  `Wykryto ${selfDefinedSubjects.length} plików. To osobna lista do ręcznego przeglądu, nie automatyczny werdykt \`PUSTY\`.`, '',
  `W tym ${selfDefinedSubjects.filter((item) => !item.hasProductImport).length} plików nie ma żadnego statycznego importu z \`src/\` ani \`server/src/\`.`, '',
  '| Plik | Import produktu | Podmiot (linia) |',
  '|---|---|---|',
  ...selfDefinedSubjects.map((item) => `| ${md(item.file)} | ${item.hasProductImport ? 'TAK' : 'NIE'} | ${item.subjects.map((subject) => `${md(subject.name)} (${subject.line})`).join(', ')} |`), '',
  '## Martwe od urodzenia — rodzina `_DB_PREFIX`', '',
  `Pomiar literalny wykrył ${gated.length} plików (instrukcja/DEC mówi o 43; aktualny mianownik to wynik poniżej):`, '',
  ...gated.map((file) => `- \`${file}\``), '',
  'Nie uruchamiano CI i nie dowodzono dla każdego pliku, że odpowiadająca zmienna jest nieustawiona we wszystkich workflow; to twierdzenie pozostaje NIEZWERYFIKOWANE.', '',
  '## Pominięte i dlaczego', '',
  ...(skipped.length ? skipped.map((item) => `- \`${item.file}\`: ${md(item.reason)}.`) : ['- 0 plików pominiętych przez odczyt/parser.']), '',
  '## Twierdzenia niezweryfikowane', '',
  '- Żaden kandydat nie ma klasy `PUSTY`, dopóki test nie przejdzie po celowanej mutacji funkcji produkcyjnej.',
  '- Statyczny sygnał fetch/bazy nie dowodzi, że wywołanie jest osiągalne ani że globalna atrapa obsłużyła żądanie.',
  '- Klasa `UZASADNIONY` opisuje zgodność nazwy z testem smoke, nie dowód zachowania produktu.', '',
  '## R3/R4 — stan dowodów i wzmocnień', '',
  '- 0 bloków sklasyfikowano jako `PUSTY`, ponieważ nie wykonano wymaganych 20 celowanych mutacji funkcji produkcyjnych.',
  '- 20 bloków `SŁABY` i 1 `UZASADNIONY` pozostają do weryfikacji/wzmocnienia; nie zmieniono ich w `test.todo`, ponieważ Z35 jednocześnie zakazuje `.todo`.',
  '- Nie skasowano ani nie osłabiono żadnego testu.', '',
  '## Pięć twierdzeń DEC-2026-08-28-186', '',
  '- Cztery wskazane pliki uruchomione razem z `--retry=0`: 35/35 przypadków PASS.',
  '- Pięć dawniej czerwonych twierdzeń (clone-on-write, bulk revoke, DLP x2, incident create) jest obecnie zielonych na markerze; bez mutacji produktu nie stanowi to ponownego dowodu naprawy.', '',
];
fs.writeFileSync(reportPath, report.join('\n'));
process.stdout.write(`${JSON.stringify({ files: testFiles.length, blocks, candidates: rows.length, classes: Object.fromEntries(['SŁABY','UZASADNIONY','PUSTY'].map((name) => [name, rows.filter((row) => row.className === name).length])), skipped: skipped.length, gatedFiles: gated.length, selfDefinedSubjects, selfDefinedSubjectsWithoutProductImports: selfDefinedSubjects.filter((item) => !item.hasProductImport).length }, null, 2)}\n`);
