#!/usr/bin/env tsx
import PDFParserService from '../src/services/pdfParserService.js';
import {
  extractFinancialLines,
  locateStatementSections,
} from '../src/services/financialStatementService.js';

async function main() {
  const text = await PDFParserService.extractText('knowledge/Finanse/Samples/Skonsolidowane sprawozdanie finansowe KGHM SRR_2024.pdf');
  const sections = locateStatementSections(text, 'BS');
  const sect = sections[0];
  if (!sect) { console.log('No BS section found'); return; }

  console.log(`BS section: ${sect.text.length} chars`);
  const lower = sect.text.toLowerCase();
  
  const checks = [
    'aktywa razem', 'razem aktywa', 'aktywa trwałe', 'aktywa obrotowe',
    'kapitał własny', 'zobowiązania długoterminowe', 'zobowiązania krótkoterminowe',
    'pasywa razem', 'suma pasywów'
  ];
  for (const c of checks) {
    console.log(`  "${c}": ${lower.includes(c) ? '✅' : '❌'}`);
  }

  // Extract financial lines
  const extracted = extractFinancialLines(sect.text, 'BS', {});
  console.log(`\nExtracted lines: ${extracted.lines.length}`);
  console.log(`Non-financial: ${extracted.lines.filter(l => l.isNonFinancial).length}`);
  
  // Show key BS lines
  const keyLabels = /razem|total|aktywa|pasywa|kapitał|zobowiąz/i;
  console.log('\nKey BS lines:');
  for (const l of extracted.lines.filter(l => keyLabels.test(l.originalLabel))) {
    console.log(`  "${l.originalLabel}" = ${l.value}`);
  }

  // Show last 10 lines of section
  const sLines = sect.text.split('\n');
  console.log(`\nLast 15 lines of section:`);
  for (const l of sLines.slice(-15)) {
    console.log(`  | ${l}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
