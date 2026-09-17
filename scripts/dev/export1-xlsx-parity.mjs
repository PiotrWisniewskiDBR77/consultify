#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import sharp from 'sharp';

const [acceptedPath, generatedPath] = process.argv.slice(2);
if (!acceptedPath || !generatedPath) {
  console.error('Usage: node scripts/dev/export1-xlsx-parity.mjs ACCEPTED.xlsx GENERATED.xlsx');
  process.exit(2);
}

const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'export1-xlsx-parity-'));
let candidatePath = generatedPath;

try {
  if (process.env.EXPORT1_XLSX_PARITY_MUTATION === 'drop-trend-cf') {
    const archive = await JSZip.loadAsync(await fs.readFile(generatedPath));
    const worksheet = archive.file('xl/worksheets/sheet1.xml');
    if (!worksheet) throw new Error('Mutation target sheet1.xml is missing');
    const xml = await worksheet.async('string');
    const mutated = xml.replace(
      /<conditionalFormatting sqref="J[^\"]+">[\s\S]*?<\/conditionalFormatting>/,
      ''
    );
    if (mutated === xml) throw new Error('Mutation did not find the Trend conditional format');
    archive.file('xl/worksheets/sheet1.xml', mutated);
    candidatePath = path.join(tempDir, 'mutated-drop-trend-cf.xlsx');
    await fs.writeFile(candidatePath, await archive.generateAsync({ type: 'nodebuffer' }));
  }

  const load = async (file) => {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await fs.readFile(file));
    return workbook;
  };
  const [accepted, generated] = await Promise.all([load(acceptedPath), load(candidatePath)]);
  const acceptedData = accepted.worksheets[0];
  const generatedData = generated.getWorksheet('Supplier scorecard');
  const generatedFieldMap = generated.getWorksheet('Template fields');
  const acceptedFieldMap = accepted.getWorksheet('Template fields');
  if (!generatedData || !generatedFieldMap || !acceptedFieldMap) {
    throw new Error('Expected scorecard worksheets are missing');
  }

  const header = (sheet) =>
    Array.from({ length: 11 }, (_, index) => sheet.getCell(6, index + 1).value);
  const formulaRefs = ['E7', 'H7', 'I7', 'J7'];
  const candidateBytes = await fs.readFile(candidatePath);
  const archive = await JSZip.loadAsync(candidateBytes);
  const stylesXml = await archive.file('xl/styles.xml').async('string');
  const sheetXml = await archive.file('xl/worksheets/sheet1.xml').async('string');

  const pdfDir = path.join(tempDir, 'pdf');
  await fs.mkdir(pdfDir);
  execFileSync(
    'soffice',
    [
      '--headless',
      `-env:UserInstallation=${pathToFileURL(path.join(tempDir, 'lo-profile')).href}`,
      '--convert-to',
      'pdf',
      '--outdir',
      pdfDir,
      candidatePath,
    ],
    { stdio: 'pipe' }
  );
  const pdfPath = path.join(pdfDir, `${path.parse(candidatePath).name}.pdf`);
  const pngPrefix = path.join(tempDir, 'render');
  execFileSync('pdftoppm', ['-f', '1', '-singlefile', '-png', '-r', '150', pdfPath, pngPrefix], {
    stdio: 'pipe',
  });
  const { data: pixels, info } = await sharp(`${pngPrefix}.png`)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let redPixels = 0;
  let greenPixels = 0;
  for (let index = 0; index < pixels.length; index += info.channels) {
    const red = pixels[index];
    const green = pixels[index + 1];
    const blue = pixels[index + 2];
    if (
      red >= 240 &&
      green >= 210 &&
      green <= 245 &&
      blue >= 210 &&
      blue <= 242 &&
      red - green >= 8
    ) {
      redPixels += 1;
    }
    if (
      red >= 205 &&
      red <= 242 &&
      green >= 232 &&
      blue >= 215 &&
      blue <= 247 &&
      green - red >= 8
    ) {
      greenPixels += 1;
    }
  }

  const checks = {
    sheetCount: generated.worksheets.length === accepted.worksheets.length,
    sheetNames:
      generated.worksheets.map((sheet) => sheet.name).join('|') ===
      accepted.worksheets.map((sheet) => sheet.name).join('|'),
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
    templateFieldMap:
      generatedFieldMap.actualRowCount === acceptedFieldMap.actualRowCount &&
      JSON.stringify(generatedFieldMap.getSheetValues()) ===
        JSON.stringify(acceptedFieldMap.getSheetValues()),
    freeze:
      generatedData.views[0]?.state === 'frozen' &&
      generatedData.views[0]?.xSplit === 2 &&
      generatedData.views[0]?.ySplit === 6,
    portableFont: generatedData.getCell('A6').font.name === 'Arial',
    coBranding:
      generatedData.headerFooter.oddHeader?.includes('Consultify') &&
      generatedData.headerFooter.oddHeader?.includes('Northwind'),
    noLegacyCrimson: !stylesXml.toUpperCase().includes('85182F'),
    conditionalFormatting:
      generatedData.conditionalFormattings.map(({ ref }) => ref).join('|') ===
      'H7:H11|J7:J12|I7:I11',
    validTrendRules:
      sheetXml.includes('NOT(ISERROR(SEARCH(&quot;Worsening&quot;,J7)))') &&
      sheetXml.includes('NOT(ISERROR(SEARCH(&quot;Improving&quot;,J7)))'),
    libreOfficeDxf:
      stylesXml.includes('<bgColor rgb="FFFCE8E6"/>') &&
      stylesXml.includes('<bgColor rgb="FFE3F5E9"/>') &&
      !stylesXml.includes('<fgColor rgb="FFFCE8E6"/>'),
    libreOfficeTrendRedPixels: redPixels >= 500,
    libreOfficeTrendGreenPixels: greenPixels >= 500,
  };
  console.log(JSON.stringify({ checks, render: { redPixels, greenPixels } }, null, 2));
  if (Object.values(checks).some((value) => !value)) process.exitCode = 1;
} finally {
  await fs.rm(tempDir, { recursive: true, force: true });
}
