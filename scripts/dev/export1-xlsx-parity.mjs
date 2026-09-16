#!/usr/bin/env node
import fs from 'node:fs/promises';
import process from 'node:process';

import ExcelJS from 'exceljs';

const [acceptedPath, generatedPath] = process.argv.slice(2);
if (!acceptedPath || !generatedPath) {
  console.error('Usage: node scripts/dev/export1-xlsx-parity.mjs ACCEPTED.xlsx GENERATED.xlsx');
  process.exit(2);
}

const load = async (file) => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await fs.readFile(file));
  return workbook;
};
const [accepted, generated] = await Promise.all([load(acceptedPath), load(generatedPath)]);
const acceptedData = accepted.worksheets[0];
const generatedData = generated.getWorksheet('Data');
const generatedSummary = generated.getWorksheet('Summary');
const header = (sheet) =>
  Array.from({ length: 11 }, (_, index) => sheet.getCell(6, index + 1).value);
const formulaRefs = ['E7', 'H7', 'I7', 'J7'];
const checks = {
  sheetCount: generated.worksheets.length === accepted.worksheets.length,
  sheetNames: generated.worksheets.map((sheet) => sheet.name).join('|') === 'Data|Summary',
  headers: JSON.stringify(header(generatedData)) === JSON.stringify(header(acceptedData)),
  formats:
    generatedData.getCell('C7').numFmt === acceptedData.getCell('C7').numFmt &&
    generatedData.getCell('E7').numFmt === acceptedData.getCell('E7').numFmt &&
    generatedData.getCell('I7').numFmt === acceptedData.getCell('I7').numFmt,
  dataFormulas: formulaRefs.every(
    (ref) => generatedData.getCell(ref).type === ExcelJS.ValueType.Formula
  ),
  totalFormulas: ['C12', 'D12', 'E12', 'F12', 'G12', 'H12', 'I12', 'J12'].every(
    (ref) => generatedData.getCell(ref).type === ExcelJS.ValueType.Formula
  ),
  summaryFormulas: Array.from({ length: 6 }, (_, index) => index + 4).every(
    (row) => generatedSummary.getCell(row, 2).type === ExcelJS.ValueType.Formula
  ),
  freeze:
    generatedData.views[0]?.state === 'frozen' &&
    generatedData.views[0]?.xSplit === 2 &&
    generatedData.views[0]?.ySplit === 6,
  aptos: generatedData.getCell('A6').font.name === 'Aptos',
  coBranding:
    generatedData.headerFooter.oddHeader?.includes('Consultify') &&
    generatedData.headerFooter.oddHeader?.includes('Northwind'),
  zeroCrimson: !JSON.stringify(generated.model).toUpperCase().includes('A50034'),
};
console.log(JSON.stringify(checks, null, 2));
if (Object.values(checks).some((value) => !value)) process.exit(1);
