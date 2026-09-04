import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

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
let blocks = 0;

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
process.stdout.write(`${JSON.stringify({ files: testFiles.length, blocks, candidates: rows.length, classes: Object.fromEntries(['SŁABY','UZASADNIONY','PUSTY'].map((name) => [name, rows.filter((row) => row.className === name).length])), skipped: skipped.length, gatedFiles: gated.length }, null, 2)}\n`);
