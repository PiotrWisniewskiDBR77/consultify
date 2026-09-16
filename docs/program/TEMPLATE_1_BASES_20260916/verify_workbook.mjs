import fs from 'node:fs/promises';
import { FileBlob, SpreadsheetFile } from '@oai/artifact-tool';

const [inputPath, outputDir] = process.argv.slice(2);
if (!inputPath || !outputDir) throw new Error('usage: verify_workbook.mjs INPUT_XLSX OUTPUT_DIR');

const input = await FileBlob.load(inputPath);
const workbook = await SpreadsheetFile.importXlsx(input);
workbook.recalculate();

const scorecard = await workbook.inspect({
  kind: 'table',
  range: 'Supplier scorecard!A1:K14',
  include: 'values,formulas',
  tableMaxRows: 14,
  tableMaxCols: 11,
});
const fieldMap = await workbook.inspect({
  kind: 'table',
  range: "'Template fields'!A1:D9",
  include: 'values,formulas',
  tableMaxRows: 9,
  tableMaxCols: 4,
});
const errors = await workbook.inspect({
  kind: 'match',
  searchTerm: '#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!',
  options: { useRegex: true, maxResults: 100 },
  summary: 'TEMPLATE-1 final formula error scan',
});

await fs.mkdir(outputDir, { recursive: true });
const scorecardPng = await workbook.render({
  sheetName: 'Supplier scorecard',
  range: 'A1:K14',
  scale: 1.5,
  format: 'png',
});
await fs.writeFile(`${outputDir}/sheet-scorecard.png`, new Uint8Array(await scorecardPng.arrayBuffer()));
const fieldMapPng = await workbook.render({
  sheetName: 'Template fields',
  range: 'A1:D9',
  scale: 1.5,
  format: 'png',
});
await fs.writeFile(`${outputDir}/sheet-field-map.png`, new Uint8Array(await fieldMapPng.arrayBuffer()));
await fs.writeFile(
  `${outputDir}/workbook-inspect.ndjson`,
  [scorecard.ndjson, fieldMap.ndjson, errors.ndjson].join('\n'),
);
console.log(scorecard.ndjson);
console.log(errors.ndjson);
