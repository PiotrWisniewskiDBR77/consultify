import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const sourceRoot = path.join(root, 'server/src');
const migrationRoot = path.join(root, 'server/migrations');
const reportPath = path.join(
  root,
  'docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_SCHEMAT_POZA_MIGRACJAMI_20260903.md'
);

function files(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(dir, entry.name);
    return entry.isDirectory() ? files(target) : [target];
  });
}

const migrations = files(migrationRoot)
  .filter((file) => file.endsWith('.sql'))
  .map((file) => ({ file, text: fs.readFileSync(file, 'utf8') }));

const rows = [];
for (const file of files(sourceRoot)) {
  const text = fs.readFileSync(file, 'utf8');
  if (!text.includes('CREATE TABLE IF NOT EXISTS')) continue;
  const lines = text.split('\n');
  for (let index = 0; index < lines.length; index += 1) {
    if (!lines[index].includes('CREATE TABLE IF NOT EXISTS')) continue;
    const fragment = lines.slice(index, Math.min(index + 4, lines.length)).join(' ');
    const match = fragment.match(/CREATE TABLE IF NOT EXISTS\s+["'`]?([A-Za-z0-9_.$\-{}]+)["'`]?/i);
    const table = match?.[1] ?? 'NIE_ROZPOZNANO';
    const migration = table === 'NIE_ROZPOZNANO'
      ? null
      : migrations.find((candidate) => new RegExp(`CREATE\\s+TABLE(?:\\s+IF\\s+NOT\\s+EXISTS)?\\s+["']?${table.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']?`, 'i').test(candidate.text));
    const window = lines.slice(Math.max(0, index - 20), Math.min(lines.length, index + 25)).join('\n');
    const catchNearby = /catch\s*(?:\([^)]*\))?\s*\{/.test(window);
    const dialect = /AUTOINCREMENT|PRAGMA\s|strftime\(|INTEGER\s+PRIMARY\s+KEY\s+AUTOINCREMENT/i.test(fragment)
      ? 'SQLITE'
      : /SERIAL|JSONB|TIMESTAMPTZ|gen_random_uuid\(|::/i.test(fragment)
        ? 'POSTGRES'
        : 'NIEJEDNOZNACZNY';
    const relative = path.relative(root, file);
    const omitted = /(?:^|\/)__tests__(?:\/)|\.test\.|\.spec\./.test(relative);
    const action = omitted
      ? 'POMINIĘTE_TEST'
      : table === 'NIE_ROZPOZNANO'
        ? 'DO_DECYZJI_PARSER'
        : migration
          ? 'USUN_DDL_W_LOCIE'
          : 'DODAJ_MIGRACJE';
    rows.push({ file: relative, line: index + 1, table, migration: migration ? path.relative(root, migration.file) : null, catchNearby, dialect, action });
  }
}

const counts = Object.fromEntries([...new Set(rows.map((row) => row.action))].sort().map((key) => [key, rows.filter((row) => row.action === key).length]));
const md = (value) => String(value ?? 'BRAK').replace(/\|/g, '\\|').replace(/[\r\n]+/g, ' ');
const output = [
  '# Rejestr schematu poza migracjami — dyżur 310',
  '',
  '## Metoda i liczby',
  '',
  `- Wystąpienia: ${rows.length}.`,
  `- Pliki: ${new Set(rows.map((row) => row.file)).size}.`,
  `- Pliki w \`server/src/services\`: ${new Set(rows.filter((row) => row.file.startsWith('server/src/services/')).map((row) => row.file)).size}.`,
  `- Rozstrzygnięcia pomiarowe: ${Object.entries(counts).map(([key, value]) => `${key}=${value}`).join(', ')}.`,
  '- „Cichy błąd” jest konserwatywnym sygnałem statycznym: blok `catch` w oknie 20 linii przed/24 po DDL. Wymaga ręcznego potwierdzenia przed zmianą.',
  '',
  '## Pozycje',
  '',
  '| Plik | Linia | Tabela | Migracja | Catch blisko | Dialekt | Działanie | Commit |',
  '|---|---:|---|---|---|---|---|---|',
  ...rows.map((row) => `| ${md(row.file)} | ${row.line} | ${md(row.table)} | ${md(row.migration)} | ${row.catchNearby ? 'TAK' : 'NIE'} | ${row.dialect} | ${row.action} | NIEZREALIZOWANE |`),
  '',
  '## Funkcje, które nigdy nie działały na czystej bazie',
  '',
  '- Do ustalenia w linii bazowej R2 i końcowym dowodzie R6.',
  '',
  '## Pominięte i dlaczego',
  '',
  `- ${counts.POMINIĘTE_TEST ?? 0} wystąpień w testach pozostawiono bez zmian; nie są runtime produkcyjnym.`,
  `- ${counts.DO_DECYZJI_PARSER ?? 0} dynamicznych nazw nie rozstrzygnięto automatycznie; wymagają ręcznej analizy, bez zgadywania.`,
  '',
  '## Twierdzenia niezweryfikowane',
  '',
  '- Samo dopasowanie tekstowe migracji nie dowodzi zgodności pełnego kształtu tabeli.',
  '- Sygnał catch nie dowodzi, że konkretny błąd DDL jest połykany.',
  '- Działania oznaczone NIEZREALIZOWANE nie są naprawą ani zgodą na zmianę.',
  '',
];
fs.writeFileSync(reportPath, output.join('\n'));
process.stdout.write(`${JSON.stringify({ rows: rows.length, files: new Set(rows.map((row) => row.file)).size, serviceFiles: new Set(rows.filter((row) => row.file.startsWith('server/src/services/')).map((row) => row.file)).size, counts }, null, 2)}\n`);
