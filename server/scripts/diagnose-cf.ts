#!/usr/bin/env tsx
import PDFParserService from '../src/services/pdfParserService.js';
import {
  extractFinancialLines,
  locateStatementSections,
} from '../src/services/financialStatementService.js';

async function main() {
  const text = await PDFParserService.extractText('knowledge/Finanse/Grupa Apator Raport RS 2024.pdf');
  const sections = locateStatementSections(text, 'CF');
  const sect = sections[0];
  if (!sect) { console.log('No CF section found'); return; }

  console.log(`CF section: ${sect.text.length} chars`);

  // Extract all lines from the CF section
  const extracted = extractFinancialLines(sect.text, 'CF', {});
  
  console.log(`\nTotal extracted lines: ${extracted.lines.length}`);
  console.log(`Lines marked isNonFinancial: ${extracted.lines.filter(l => l.isNonFinancial).length}`);
  
  // Show all lines with value > 50000 (operating total should be ~151k)
  console.log('\n=== High-value lines (>50000): ===');
  for (const l of extracted.lines.filter(l => Math.abs(l.value) > 50000)) {
    console.log(`  "${l.originalLabel}" = ${l.value} [nonFin: ${l.isNonFinancial}, canon: ${l.suggestedCanonicalId || '-'}]`);
  }

  // Search raw text for the operating total line
  const cfLines = sect.text.split('\n');
  console.log('\n=== Lines matching "środki pieniężne netto" in CF section: ===');
  for (let i = 0; i < cfLines.length; i++) {
    if (/środki pieniężne netto/i.test(cfLines[i])) {
      console.log(`  [${i}] "${cfLines[i]}"`);
      if (i + 1 < cfLines.length) console.log(`  [${i+1}] "${cfLines[i+1]}"`);
    }
  }

  // Also search for "przepływy pieniężne netto"
  console.log('\n=== Lines matching "przepływy pieniężne netto" in CF section: ===');
  for (let i = 0; i < cfLines.length; i++) {
    if (/przepływy pieniężne netto/i.test(cfLines[i])) {
      console.log(`  [${i}] "${cfLines[i]}"`);
    }
  }

  // Show all lines with "operacyjn" in extracted results
  console.log('\n=== All extracted lines with "operacyjn" or "operating": ===');
  for (const l of extracted.lines) {
    if (/operacyjn|operating/i.test(l.originalLabel)) {
      console.log(`  "${l.originalLabel}" = ${l.value} [nonFin: ${l.isNonFinancial}, conf: ${l.confidence}]`);
    }
  }

  // Show all lines with "środki" or "przepływy" 
  console.log('\n=== All extracted lines with "środki" or "przepływy": ===');
  for (const l of extracted.lines) {
    if (/środki|przepływy/i.test(l.originalLabel)) {
      console.log(`  "${l.originalLabel}" = ${l.value} [nonFin: ${l.isNonFinancial}, conf: ${l.confidence}]`);
    }
  }

  // Let's check specific raw line around offset 1850
  console.log('\n=== Raw CF section lines 70-100: ===');
  for (let i = 70; i < Math.min(100, cfLines.length); i++) {
    console.log(`  [${i}] "${cfLines[i]}"`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
