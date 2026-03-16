#!/usr/bin/env tsx
import PDFParserService from '../src/services/pdfParserService.js';
import {
  extractFinancialLines,
  locateStatementSections,
  detectStatementType,
} from '../src/services/financialStatementService.js';

async function main() {
  // 1. Check Apator P&L for "zysk netto" in section text
  {
    const text = await PDFParserService.extractText('knowledge/Finanse/Grupa Apator Raport RS 2024.pdf');
    const sections = locateStatementSections(text, 'P&L');
    const sect = sections[0];
    if (sect) {
      const lower = sect.text.toLowerCase();
      console.log('=== Apator RS 2024 P&L section ===');
      console.log(`Section length: ${sect.text.length} chars`);
      console.log(`Contains "zysk netto": ${lower.includes('zysk netto')}`);
      console.log(`Contains "wynik netto": ${lower.includes('wynik netto')}`);
      console.log(`Contains "zysk (strata) netto": ${lower.includes('zysk (strata) netto')}`);
      
      // Search in full text
      const fullLower = text.toLowerCase();
      const zyskNettoIdx = fullLower.indexOf('zysk netto');
      if (zyskNettoIdx >= 0) {
        const lineNo = text.substring(0, zyskNettoIdx).split('\n').length;
        const ctx = text.substring(zyskNettoIdx, zyskNettoIdx + 200).replace(/\n/g, '\\n');
        console.log(`Full text: "zysk netto" at line ${lineNo}, char ${zyskNettoIdx}`);
        console.log(`Context: "${ctx}"`);
      } else {
        console.log('Full text: "zysk netto" NOT FOUND');
        // Check for alternative labels
        const altLabels = ['zysk (strata) netto', 'wynik netto', 'zysk/strata netto', 'zysk (strata) przypadający'];
        for (const alt of altLabels) {
          const idx = fullLower.indexOf(alt);
          if (idx >= 0) {
            const ctx = text.substring(idx, idx + 150).replace(/\n/g, '\\n');
            console.log(`Found "${alt}" at char ${idx}: "${ctx}"`);
          }
        }
      }
    }
  }

  // 2. Check Apator CF operating total
  {
    const text = await PDFParserService.extractText('knowledge/Finanse/Grupa Apator Raport RS 2024.pdf');
    const sections = locateStatementSections(text, 'CF');
    const sect = sections[0];
    if (sect) {
      console.log('\n=== Apator RS 2024 CF section ===');
      const lower = sect.text.toLowerCase();
      // Search for operating total label
      const patterns = [
        'przepływy pieniężne netto z działalności operacyjnej',
        'środki pieniężne netto z działalności operacyjnej',
        'przepływy z działalności operacyjnej',
        'działalność operacyjna',
      ];
      for (const p of patterns) {
        const idx = lower.indexOf(p);
        if (idx >= 0) {
          const ctx = sect.text.substring(idx, idx + 200).replace(/\n/g, '\\n');
          console.log(`Found "${p}" at offset ${idx}: "${ctx}"`);
        }
      }
      
      // Extract and check what the extraction finds
      const extracted = extractFinancialLines(sect.text, 'CF', {});
      const opLines = extracted.lines.filter(l => 
        /operacyjn|operating/i.test(l.originalLabel) && /przepływ|środki|cash/i.test(l.originalLabel)
      );
      console.log(`Operating total candidates in extraction:`);
      for (const l of opLines) {
        console.log(`  "${l.originalLabel}" = ${l.value} [isNonFin: ${l.isNonFinancial}]`);
      }
    }
  }

  // 3. Check KGHM BS - why section is too short
  {
    const text = await PDFParserService.extractText('knowledge/Finanse/Samples/Skonsolidowane sprawozdanie finansowe KGHM SRR_2024.pdf');
    const sections = locateStatementSections(text, 'BS');
    console.log('\n=== KGHM BS sections ===');
    console.log(`Number of sections found: ${sections.length}`);
    for (let i = 0; i < sections.length; i++) {
      const s = sections[i];
      console.log(`Section ${i}: score=${s.score}, ${s.text.length} chars, lines ${s.startLine}-${s.endLine}`);
    }
    
    // Find BS location in text
    const lower = text.toLowerCase();
    const bsHeaders = [
      'skonsolidowane sprawozdanie z sytuacji finansowej',
      'bilans',
      'sprawozdanie z sytuacji finansowej',
    ];
    for (const h of bsHeaders) {
      const idx = lower.indexOf(h);
      if (idx >= 0) {
        const lineNo = text.substring(0, idx).split('\n').length;
        console.log(`"${h}" at line ${lineNo}, char ${idx}`);
        const ctx = text.substring(idx, idx + 500).replace(/\n/g, '\\n');
        console.log(`Context: "${ctx.substring(0, 300)}"`);
      }
    }
    
    // Check how many lines the actual BS spans
    const bsStart = lower.indexOf('skonsolidowane sprawozdanie z sytuacji finansowej');
    if (bsStart >= 0) {
      const afterBs = text.substring(bsStart, bsStart + 5000);
      const aktRazem = afterBs.toLowerCase().indexOf('aktywa razem');
      const kapWlasny = afterBs.toLowerCase().indexOf('kapitał własny');
      const zobRazem = afterBs.toLowerCase().indexOf('zobowiązania razem') !== -1 
        ? afterBs.toLowerCase().indexOf('zobowiązania razem') 
        : afterBs.toLowerCase().indexOf('pasywa razem');
      console.log(`BS span: aktRazem at +${aktRazem}, kapWlasny at +${kapWlasny}, zobRazem/pasywaRazem at +${zobRazem}`);
      console.log(`Full BS text (first 2000 chars):\n${afterBs.substring(0, 2000)}`);
    }
  }

  // 4. Tesla equity line context
  {
    const text = await PDFParserService.extractText('knowledge/Finanse/Samples/tsla-20241231-gen.pdf');
    const sections = locateStatementSections(text, 'BS');
    const sect = sections[0];
    if (sect) {
      console.log('\n=== Tesla BS section ===');
      console.log(`Section: ${sect.text.length} chars`);
      const lower = sect.text.toLowerCase();
      console.log(`Contains "total stockholders": ${lower.includes('total stockholders')}`);
      console.log(`Contains "total equity": ${lower.includes('total equity')}`);
      // Show last 20 lines
      const lastLines = sect.text.split('\n').slice(-20);
      console.log('Last 20 lines:');
      for (const l of lastLines) console.log(`  | ${l}`);
    }
  }
}

main().catch(e => { console.error(e); process.exit(1); });
