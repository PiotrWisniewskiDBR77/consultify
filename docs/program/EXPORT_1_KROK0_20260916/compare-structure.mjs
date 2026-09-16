#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve(import.meta.dirname);
const outPath = resolve(root, 'porownanie/structure-comparison.json');

function unzipList(file) {
  const r = spawnSync('/usr/bin/unzip', ['-Z1', file], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`unzip list failed for ${file}: ${r.stderr}`);
  return r.stdout.trim().split('\n').filter(Boolean);
}
function unzipText(file, entry) {
  const r = spawnSync('/usr/bin/unzip', ['-p', file, entry], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  return r.status === 0 ? r.stdout : '';
}
function allXml(file, entries) {
  return entries.filter((e) => e.endsWith('.xml')).map((e) => unzipText(file, e)).join('\n');
}
function runXml(file, entries, ext) {
  if (ext === '.pptx') {
    return entries
      .filter((e) => /^ppt\/(?:slides|charts)\/.*\.xml$/.test(e))
      .map((e) => unzipText(file, e))
      .join('\n');
  }
  if (ext === '.docx') return unzipText(file, 'word/document.xml');
  if (ext === '.xlsx') {
    return ['xl/styles.xml', 'xl/sharedStrings.xml']
      .map((e) => unzipText(file, e))
      .join('\n');
  }
  return '';
}
function uniq(xs) { return [...new Set(xs.filter(Boolean))].sort(); }
function matchAll(text, re, group = 1) { return [...text.matchAll(re)].map((m) => m[group]); }
function inspect(file) {
  if (!existsSync(file)) return { exists: false, file };
  const ext = extname(file).toLowerCase();
  const entries = unzipList(file);
  const xml = allXml(file, entries);
  const usedXml = runXml(file, entries, ext);
  const common = {
    exists: true,
    file: file.replace(root + '/', ''),
    bytes: readFileSync(file).length,
    runFonts: uniq([
      ...matchAll(usedXml, /(?:typeface|w:ascii|w:hAnsi)="([^"]+)"/g),
      ...matchAll(usedXml, /<(?:name|rFont) val="([^"]+)"/g),
    ]).filter((x) => !x.startsWith('+')),
    brandCrimsonHits: (xml.match(/85182F/gi) || []).length,
    semanticRiskRedHits: (xml.match(/B42318/gi) || []).length,
    branding: {
      consultify: /consultify/i.test(xml),
      dbr77: /dbr77/i.test(xml),
      northwind: /northwind/i.test(xml),
      clientLogoRefs: entries.filter((e) => /media\//.test(e)).length,
    },
  };
  if (ext === '.pptx') {
    const slides = entries.filter((e) => /^ppt\/slides\/slide\d+\.xml$/.test(e));
    return { ...common, kind: 'pptx', slides: slides.length, masters: entries.filter((e) => /^ppt\/slideMasters\/slideMaster\d+\.xml$/.test(e)).length, layouts: entries.filter((e) => /^ppt\/slideLayouts\/slideLayout\d+\.xml$/.test(e)).length, charts: entries.filter((e) => /^ppt\/charts\/chart\d+\.xml$/.test(e)).length, tables: (xml.match(/<a:tbl>/g) || []).length };
  }
  if (ext === '.docx') {
    const documentXml = unzipText(file, 'word/document.xml');
    return { ...common, kind: 'docx', sections: (documentXml.match(/<w:sectPr[ >]/g) || []).length, headings: (documentXml.match(/<w:pStyle w:val="(?:Heading|Title)[^"]*"/g) || []).length, tables: (documentXml.match(/<w:tbl>/g) || []).length, tocFields: (documentXml.match(/TOC \\o/g) || []).length, headers: entries.filter((e) => /^word\/header\d+\.xml$/.test(e)).length, footers: entries.filter((e) => /^word\/footer\d+\.xml$/.test(e)).length };
  }
  if (ext === '.xlsx') {
    const workbookXml = unzipText(file, 'xl/workbook.xml');
    return { ...common, kind: 'xlsx', sheets: (workbookXml.match(/<sheet[ >]/g) || []).length, formulas: (xml.match(/<f[ >]/g) || []).length, frozenPanes: (xml.match(/<pane[^>]*(?:state="frozen"|xSplit=|ySplit=)[^>]*>/g) || []).length, conditionalFormatting: (xml.match(/<conditionalFormatting[ >]/g) || []).length, autoFilters: (xml.match(/<autoFilter[ >]/g) || []).length };
  }
  throw new Error(`Unsupported file ${file}`);
}
function compare(id, appRel, mockRel, note) {
  const app = inspect(resolve(root, appRel));
  const mock = inspect(resolve(root, mockRel));
  const numeric = {};
  for (const key of ['slides','sections','sheets','layouts','charts','tables','headings','formulas','frozenPanes','conditionalFormatting','autoFilters']) {
    if (typeof app[key] === 'number' || typeof mock[key] === 'number') numeric[key] = { app: app[key] ?? null, mock: mock[key] ?? null, delta: typeof app[key] === 'number' && typeof mock[key] === 'number' ? app[key] - mock[key] : null };
  }
  const requirements = {
    runFontsAreThemeDriven: app.exists ? app.runFonts.length === 0 : false,
    coBrandingConsultifyDbr77Client: app.exists ? app.branding.consultify && app.branding.dbr77 && app.branding.northwind : false,
    zeroBrandCrimsonFilewide: app.exists ? app.brandCrimsonHits === 0 : false,
    semanticRiskRedReported: app.exists ? app.semanticRiskRedHits : null,
  };
  return { id, note, app, mock, numeric, requirements };
}

const result = {
  generatedAt: '2026-09-16T11:07:23Z',
  contractVersion: 'export-structure-v0',
  comparisons: [
    compare('frozen-drd-b2de5832-docx', 'pliki-app/northwind-drd-route-current.docx', 'pliki-makieta/client-final-report.docx', 'Real HTTP application export versus accepted client-final report mockup.'),
    compare('steering-deck', 'pliki-app/northwind-steering-current.pptx', 'pliki-makieta/deck-board.pptx', 'Engine probe is structurally renderable, but the real HTTP route is blocked by P1 quality gate; see northwind-steering-route-422.json.'),
    compare('supplier-scorecard', 'pliki-app/MISSING-supplier-scorecard.xlsx', 'pliki-makieta/supplier-scorecard.xlsx', 'The restored Northwind dump contains no supplier scorecard; nearest live workbook is measured separately and no success is fabricated.'),
    compare('nearest-current-workbook', 'pliki-app/northwind-scrap-route-current.xlsx', 'pliki-makieta/supplier-scorecard.xlsx', 'Nearest current WorkbookBuilder path, not a semantic parity claim for supplier scorecard.'),
  ],
};
writeFileSync(outPath, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
