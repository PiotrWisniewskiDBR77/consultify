import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import ExcelJS from 'exceljs';

const SCORECARD_SHEET = 'Supplier scorecard';
const FIELD_MAP_SHEET = 'Template fields';

function compactFormulae(worksheet) {
  const formulas = {};
  worksheet.eachRow({ includeEmpty: false }, (row) => {
    row.eachCell({ includeEmpty: false }, (cell) => {
      if (cell.type === ExcelJS.ValueType.Formula) formulas[cell.address] = cell.formula;
    });
  });
  return formulas;
}

function compactConditionalFormats(worksheet) {
  return worksheet.conditionalFormattings.map((format) => ({
    range: format.ref,
    rules: format.rules.map((rule) => ({
      type: rule.type,
      operator: rule.operator ?? null,
      formulas: rule.formulae ?? [],
    })),
  }));
}

function columnNumber(label) {
  return [...label].reduce((value, character) => value * 26 + character.charCodeAt(0) - 64, 0);
}

function columnLabel(number) {
  let value = number;
  let label = '';
  while (value > 0) {
    value -= 1;
    label = String.fromCharCode(65 + (value % 26)) + label;
    value = Math.floor(value / 26);
  }
  return label;
}

function rangeBounds(range) {
  const match = /^([A-Z]+)(\d+):([A-Z]+)(\d+)$/.exec(range);
  if (!match) throw new Error(`TEMPLATE1_RANGE_INVALID:${range}`);
  return {
    startColumn: columnNumber(match[1]),
    startRow: Number(match[2]),
    endColumn: columnNumber(match[3]),
    endRow: Number(match[4]),
  };
}

function values(worksheet, range) {
  const bounds = rangeBounds(range);
  return Array.from({ length: bounds.endRow - bounds.startRow + 1 }, (_, rowOffset) =>
    Array.from(
      { length: bounds.endColumn - bounds.startColumn + 1 },
      (_, columnOffset) =>
        worksheet.getCell(bounds.startRow + rowOffset, bounds.startColumn + columnOffset).value
    )
  );
}

function usedDimension(worksheet) {
  const model = worksheet.dimensions.model;
  return `${columnLabel(model.left)}${model.top}:${columnLabel(model.right)}${model.bottom}`;
}

function dimensions(worksheet) {
  return {
    columns: Object.fromEntries(
      worksheet.columns
        .filter((column) => column.width)
        .map((column) => [column.letter, column.width])
    ),
    rows: Object.fromEntries(
      [...Array(worksheet.rowCount)]
        .map((_, index) => index + 1)
        .filter((number) => worksheet.getRow(number).height)
        .map((number) => [String(number), worksheet.getRow(number).height])
    ),
  };
}

function freeze(worksheet) {
  const view = worksheet.views.find((candidate) => candidate.state === 'frozen');
  return view
    ? { xSplit: view.xSplit ?? 0, ySplit: view.ySplit ?? 0, topLeftCell: view.topLeftCell }
    : null;
}

export async function buildTemplate1SheetSnapshot(filePath) {
  const file = await fs.readFile(filePath);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(file);
  const scorecard = workbook.getWorksheet(SCORECARD_SHEET);
  const fieldMap = workbook.getWorksheet(FIELD_MAP_SHEET);
  if (!scorecard || !fieldMap || workbook.worksheets.length !== 2)
    throw new Error('TEMPLATE1_SHEET_WORKBOOK_SHAPE_INVALID');

  return {
    family: 'SHEET-BASE',
    contractVersion: 'template-1-v2',
    language: 'en',
    sourceSha256: createHash('sha256').update(file).digest('hex'),
    contentPolicy: 'replace-data-not-layout',
    sheets: [
      {
        key: 'scorecard',
        name: scorecard.name,
        dimension: usedDimension(scorecard),
        title: scorecard.getCell('A1').value,
        subtitle: scorecard.getCell('A2').value,
        headers: values(scorecard, 'A6:K6')[0],
        dataRange: 'A7:K11',
        totalRange: 'A12:K12',
        noteRange: 'A14:K14',
        freeze: freeze(scorecard),
        autoFilter: scorecard.autoFilter,
        printTitles: null,
        merges: [...scorecard.model.merges].sort(),
        dimensions: dimensions(scorecard),
        formulas: compactFormulae(scorecard),
        conditionalFormats: compactConditionalFormats(scorecard),
      },
      {
        key: 'field-map',
        name: fieldMap.name,
        dimension: usedDimension(fieldMap),
        freeze: freeze(fieldMap),
        autoFilter: fieldMap.autoFilter ?? null,
        printTitles: null,
        dimensions: dimensions(fieldMap),
        rows: values(fieldMap, 'A1:D9'),
      },
    ],
  };
}

export async function extractMigrationSheetSnapshot(migrationPath) {
  const sql = await fs.readFile(migrationPath, 'utf8');
  const match = /\$sheet\$([\s\S]*?)\$sheet\$::jsonb/.exec(sql);
  if (!match) throw new Error('TEMPLATE1_SHEET_SNAPSHOT_NOT_FOUND');
  return JSON.parse(match[1]);
}

if (process.argv[1] && new URL(import.meta.url).pathname === process.argv[1]) {
  const [workbookPath, migrationPath] = process.argv.slice(2);
  if (!workbookPath) throw new Error('usage: template1-sheet-snapshot.mjs XLSX [MIGRATION_SQL]');
  const generated = await buildTemplate1SheetSnapshot(workbookPath);
  if (migrationPath) {
    const stored = await extractMigrationSheetSnapshot(migrationPath);
    if (JSON.stringify(stored) !== JSON.stringify(generated)) {
      console.error(JSON.stringify({ stored, generated }, null, 2));
      process.exitCode = 1;
    } else {
      console.log('TEMPLATE1_SHEET_SNAPSHOT_PARITY_OK');
    }
  } else {
    console.log(JSON.stringify(generated, null, 2));
  }
}
