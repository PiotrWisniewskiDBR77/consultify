import { readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import JSZip from 'jszip';

const generatedPath = path.resolve(
  'docs/program/EXPORT_1_DOCX_20260916/dowody/northwind-client-final-report.docx'
);
const referencePath =
  process.env.EXPORT1_DOCX_REFERENCE ||
  path.join(
    os.homedir(),
    'Developer/cto-codex/template-1-makiety-20260916/pliki/client-final-report.docx'
  );

async function part(zip: JSZip, name: string): Promise<string> {
  const file = zip.file(name);
  if (!file) throw new Error(`missing OOXML part: ${name}`);
  return file.async('string');
}

function requireMatch(label: string, value: string, pattern: RegExp): void {
  if (!pattern.test(value)) throw new Error(`${label}: FAIL (${pattern})`);
}

const [generated, reference] = await Promise.all([
  JSZip.loadAsync(await readFile(generatedPath)),
  JSZip.loadAsync(await readFile(referencePath)),
]);
const [documentXml, stylesXml, fontTableXml, themeXml, referenceDocumentXml] = await Promise.all([
  part(generated, 'word/document.xml'),
  part(generated, 'word/styles.xml'),
  part(generated, 'word/fontTable.xml'),
  part(generated, 'word/theme/theme1.xml'),
  part(reference, 'word/document.xml'),
]);

const sectionTitles = [
  'Executive summary',
  'Context and scope',
  'Methodology',
  'Findings by axis',
  'Maturity matrix',
  'Recommendations',
  'Roadmap',
  'Appendix',
];
for (const title of sectionTitles) {
  requireMatch(`generated section ${title}`, documentXml, new RegExp(title));
  requireMatch(`reference section ${title}`, referenceDocumentXml, new RegExp(title));
}

requireMatch('A4 page', documentXml, /w:pgSz w:w="11906" w:h="16838"/);
requireMatch(
  'DOC-BASE margins',
  documentXml,
  /w:pgMar w:top="1134" w:right="1304" w:bottom="1134" w:left="1304"/
);
requireMatch('first-page header/footer contract', documentXml, /w:titlePg/);
requireMatch('first header', documentXml, /w:headerReference w:type="first"/);
requireMatch('first footer', documentXml, /w:footerReference w:type="first"/);
requireMatch('static TOC', documentXml, /Table of Contents/);
requireMatch('repeating table header', documentXml, /w:tblHeader/);
requireMatch('non-splitting table rows', documentXml, /w:cantSplit/);
requireMatch('accepted navy', documentXml + stylesXml, /1B2A41/);
requireMatch('accepted accent', documentXml + stylesXml, /2563EB/);
requireMatch('Aptos body', stylesXml + themeXml, /Aptos/);
requireMatch('Aptos Display heading', stylesXml + themeXml, /Aptos Display/);
requireMatch('minorHAnsi default', stylesXml, /minorHAnsi/);
requireMatch('Arial fallback', fontTableXml, /w:altName w:val="Arial"/);
requireMatch('co-branding', documentXml, /Consultify · DBR77/);
requireMatch('source traceability', documentXml, /northwind-steering-snapshot/);
if (/85182F/i.test(documentXml + stylesXml + themeXml)) {
  throw new Error('zero-crimson chrome: FAIL (#85182F found)');
}

console.log(
  JSON.stringify(
    {
      status: 'PASS',
      generated: path.relative(process.cwd(), generatedPath),
      reference: referencePath,
      sectionCount: sectionTitles.length,
      page: 'A4 20mm/23mm',
      palette: ['1B2A41', '2563EB', 'F1F4F8', 'D8DEE8'],
      fontContract: 'theme Aptos + minorHAnsi + Arial altName',
      tableContract: 'repeating header + cantSplit',
      zeroCrimson: true,
    },
    null,
    2
  )
);
