#!/usr/bin/env tsx
import PDFParserService from '../src/services/pdfParserService.js';
import {
  extractFinancialLines,
  locateStatementSections,
} from '../src/services/financialStatementService.js';

async function main() {
  // 1. Tesla BS: why equity = 0.001?
  {
    const text = await PDFParserService.extractText('knowledge/Finanse/Samples/tsla-20241231-gen.pdf');
    const sections = locateStatementSections(text, 'BS');
    const sect = sections[0];
    if (sect) {
      const extracted = extractFinancialLines(sect.text, 'BS', {});
      console.log('=== Tesla BS: All equity-related lines ===');
      for (const l of extracted.lines) {
        if (/equity|stockholder|stock|capital/i.test(l.originalLabel)) {
          console.log(`  "${l.originalLabel}" = ${l.value} [mapped: ${l.suggestedCanonicalId || 'NONE'}]`);
        }
      }
      console.log('\n=== Tesla BS: Lines mapped to fsl-bs-* ===');
      for (const l of extracted.lines.filter(l => l.suggestedCanonicalId?.startsWith('fsl-bs-'))) {
        console.log(`  [${l.suggestedCanonicalId}] "${l.originalLabel}" = ${l.value}`);
      }
    }
  }

  // 2. Apator RS 2024: P&L net income
  {
    const text = await PDFParserService.extractText('knowledge/Finanse/Grupa Apator Raport RS 2024.pdf');
    const sections = locateStatementSections(text, 'P&L');
    const sect = sections[0];
    if (sect) {
      const extracted = extractFinancialLines(sect.text, 'P&L', {});
      console.log('\n=== Apator RS 2024 P&L: All lines ===');
      for (const l of extracted.lines) {
        if (/zysk|net|netto|wynik/i.test(l.originalLabel)) {
          console.log(`  "${l.originalLabel}" = ${l.value} [mapped: ${l.suggestedCanonicalId || 'NONE'}]`);
        }
      }
    }
  }

  // 3. BMW BS: total liabilities
  {
    const text = await PDFParserService.extractText('knowledge/Finanse/Samples/BMW-Group-Financial-Statements-2024-en.pdf');
    const sections = locateStatementSections(text, 'BS');
    const sect = sections[0];
    if (sect) {
      const extracted = extractFinancialLines(sect.text, 'BS', {});
      console.log('\n=== BMW BS: Liability and equity lines ===');
      for (const l of extracted.lines) {
        if (/liabilit|equity|provisions|zobowiąz|passiv/i.test(l.originalLabel)) {
          console.log(`  "${l.originalLabel}" = ${l.value} [mapped: ${l.suggestedCanonicalId || 'NONE'}]`);
        }
      }
    }
  }

  // 4. Apator SA 2024 BS section check
  {
    const text = await PDFParserService.extractText('knowledge/Finanse/Apator SA Raport R 2024.pdf');
    const sections = locateStatementSections(text, 'BS');
    console.log('\n=== Apator SA 2024 BS sections ===');
    console.log(`Sections found: ${sections.length}`);
    for (const s of sections) {
      console.log(`  Length: ${s.text.length} chars, score=${(s as any).metadata?.score}`);
      const lower = s.text.toLowerCase();
      const keywords = ['aktywa razem', 'aktywa trwałe', 'kapitał własny', 'zobowiązania'];
      for (const kw of keywords) {
        console.log(`    "${kw}": ${lower.includes(kw)}`);
      }
    }
    // Search full text for BS keywords
    const lower = text.toLowerCase();
    const aktywaRazem = lower.indexOf('aktywa razem');
    if (aktywaRazem >= 0) {
      const ctx = text.substring(aktywaRazem, aktywaRazem + 200).replace(/\n/g, '\\n');
      console.log(`  Full text "aktywa razem" at char ${aktywaRazem}: "${ctx.substring(0, 150)}"`);
    }
    
    // Check the extracted lines from the best BS section
    const sect = sections[0];
    if (sect) {
      const extracted = extractFinancialLines(sect.text, 'BS', {});
      console.log(`  Extracted lines: ${extracted.lines.length}`);
      for (const l of extracted.lines) {
        console.log(`    "${l.originalLabel}" = ${l.value} [mapped: ${l.suggestedCanonicalId || 'NONE'}]`);
      }
    }
  }

  // 5. Apator SA P&L: where is net income?
  {
    const text = await PDFParserService.extractText('knowledge/Finanse/Apator SA Raport R 2024.pdf');
    const sections = locateStatementSections(text, 'P&L');
    const sect = sections[0];
    if (sect) {
      const extracted = extractFinancialLines(sect.text, 'P&L', {});
      console.log('\n=== Apator SA 2024 P&L: net income lines ===');
      for (const l of extracted.lines) {
        if (/zysk|netto|wynik|net/i.test(l.originalLabel)) {
          console.log(`  "${l.originalLabel}" = ${l.value} [mapped: ${l.suggestedCanonicalId || 'NONE'}]`);
        }
      }
    }
    // Search for "zysk netto" in full text
    const lower = text.toLowerCase();
    const netIdx = lower.indexOf('zysk netto');
    if (netIdx >= 0) {
      const ctx = text.substring(netIdx, netIdx + 200).replace(/\n/g, '\\n');
      console.log(`  Full text "zysk netto" at char ${netIdx}: "${ctx.substring(0, 150)}"`);
    }
  }
}

main().catch(e => { console.error(e); process.exit(1); });
