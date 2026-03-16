#!/usr/bin/env tsx
import PDFParserService from '../src/services/pdfParserService.js';
import {
  extractFinancialLines,
  locateStatementSections,
} from '../src/services/financialStatementService.js';

async function main() {
  const text = await PDFParserService.extractText('knowledge/Finanse/Grupa Apator Raport RS 2024.pdf');
  const sections = locateStatementSections(text, 'P&L');
  const sect = sections[0];
  if (!sect) { console.log('No section'); return; }

  // Extract ALL lines
  const extracted = extractFinancialLines(sect.text, 'P&L', {});
  
  console.log(`Total extracted: ${extracted.lines.length} lines\n`);
  console.log('=== ALL extracted P&L lines ===');
  for (const l of extracted.lines) {
    console.log(`  [${l.isNonFinancial ? 'NON' : 'FIN'}] "${l.originalLabel}" = ${l.value} (conf=${l.confidence})`);
  }

  // Also check: is line 27 "Podatek dochodowy 7.24 -8 604 -19 040" being processed?
  // Check line 28 "Zysk netto, z tego przypadający: - 73 214 8 504"
  console.log('\n=== Direct numeric extraction test ===');
  const testLines = [
    'Podatek dochodowy 7.24 -8 604 -19 040',
    'Zysk netto, z tego przypadający: - 73 214 8 504',
    'akcjonariuszom spółki - 73 060 8 138',
  ];
  const baseNumericTokenRegex = /\(?-?\d[\d.,]*\)?/g;
  for (const tl of testLines) {
    const tokens = Array.from(tl.matchAll(baseNumericTokenRegex)).map(m => m[0]);
    console.log(`  "${tl}"`);
    console.log(`    Tokens: ${JSON.stringify(tokens)}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
