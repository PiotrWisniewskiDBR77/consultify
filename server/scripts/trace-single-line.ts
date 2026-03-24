#!/usr/bin/env tsx
import PDFParserService from '../src/services/pdfParserService.js';
import { locateStatementSections, extractFinancialLines } from '../src/services/financialStatementService.js';

async function main() {
  const text = await PDFParserService.extractText('knowledge/Finanse/Grupa Apator Raport RS 2024.pdf');
  const sections = locateStatementSections(text, 'P&L');
  const sect = sections[0];
  if (!sect) return;

  const sectionLines = sect.text.split('\n');
  
  // Find and display raw lines 26-35 with hex dump for invisible chars
  console.log('=== Raw section lines 26-35 ===');
  for (let i = 26; i < Math.min(35, sectionLines.length); i++) {
    const line = sectionLines[i];
    const hasInvisible = /[^\x20-\x7E\u00C0-\u024F\u0100-\u017F]/.test(line);
    console.log(`  [${i}] (${line.length} chars) "${line}"`);
    if (hasInvisible) {
      const hex = [...line].map(c => {
        const code = c.charCodeAt(0);
        return code > 127 ? `\\u${code.toString(16).padStart(4, '0')}` : c;
      }).join('');
      console.log(`       HEX: ${hex}`);
    }
  }

  // Extract with a MINIMAL section: just lines 26-30
  const miniSection = sectionLines.slice(26, 30).join('\n');
  console.log(`\n=== Mini extraction (lines 26-30) ===`);
  console.log(`Text: "${miniSection}"`);
  const miniResult = extractFinancialLines(miniSection, 'P&L', {});
  console.log(`Lines: ${miniResult.lines.length}`);
  for (const l of miniResult.lines) {
    console.log(`  "${l.originalLabel}" = ${l.value}`);
  }

  // Extract with just line 28
  const singleLine = sectionLines[28];
  console.log(`\n=== Single line extraction (line 28) ===`);
  console.log(`Text: "${singleLine}"`);
  const singleResult = extractFinancialLines(singleLine, 'P&L', {});
  console.log(`Lines: ${singleResult.lines.length}`);
  for (const l of singleResult.lines) {
    console.log(`  "${l.originalLabel}" = ${l.value}`);
  }
  
  // Also try with just 2 lines: 27 + 28
  const twoLines = sectionLines.slice(27, 29).join('\n');
  console.log(`\n=== Two lines extraction (27-28) ===`);
  console.log(`Text: "${twoLines}"`);
  const twoResult = extractFinancialLines(twoLines, 'P&L', {});
  console.log(`Lines: ${twoResult.lines.length}`);
  for (const l of twoResult.lines) {
    console.log(`  "${l.originalLabel}" = ${l.value}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
