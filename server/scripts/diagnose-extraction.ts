#!/usr/bin/env tsx
/**
 * Diagnose extraction issues for P&L net income, CF operating total,
 * KGHM BS, Tesla equity, BMW total liabilities.
 */
import PDFParserService from '../src/services/pdfParserService.js';
import {
  extractFinancialLines,
  locateStatementSections,
  resolveStatementColumnSelection,
  detectStatementType,
} from '../src/services/financialStatementService.js';

const DOCS = [
  { label: 'Apator RS 2024', file: 'knowledge/Finanse/Grupa Apator Raport RS 2024.pdf' },
  { label: 'Apator SA 2024', file: 'knowledge/Finanse/Apator SA Raport R 2024.pdf' },
  { label: 'KGHM', file: 'knowledge/Finanse/Samples/Skonsolidowane sprawozdanie finansowe KGHM SRR_2024.pdf' },
  { label: 'Tesla', file: 'knowledge/Finanse/Samples/tsla-20241231-gen.pdf' },
  { label: 'BMW', file: 'knowledge/Finanse/Samples/BMW-Group-Financial-Statements-2024-en.pdf' },
  { label: 'Coca-Cola', file: 'knowledge/Finanse/Samples/nyse-ko-2025-10K-25644916.pdf' },
];

async function main() {
  for (const doc of DOCS) {
    console.log(`\n${'═'.repeat(70)}\n  ${doc.label}\n${'═'.repeat(70)}`);
    const text = await PDFParserService.extractText(doc.file);
    const detection = detectStatementType(text);

    // P&L: check for net income in text near P&L section end
    if (['Apator RS 2024', 'Apator SA 2024'].includes(doc.label)) {
      const plSections = locateStatementSections(text, 'P&L');
      const plScope = plSections[0];
      if (plScope) {
        console.log(`  [P&L] Section: lines ${plScope.startLine}-${plScope.endLine}, score=${plScope.score}, ${plScope.text.length} chars`);
        const lastLines = plScope.text.split('\n').slice(-15);
        console.log(`  [P&L] Last 15 lines of section:`);
        for (const l of lastLines) console.log(`    | ${l}`);

        // Search for net income AFTER the section end
        const fullLines = text.split('\n');
        const afterSection = fullLines.slice(plScope.endLine, plScope.endLine + 20).join('\n');
        const netIncomeMatch = afterSection.match(/zysk.*netto|wynik.*netto|net income/i);
        if (netIncomeMatch) {
          console.log(`  [P&L] ⚠ NET INCOME found AFTER section end: "${netIncomeMatch[0]}" in lines ${plScope.endLine}-${plScope.endLine + 20}`);
          const contextLines = fullLines.slice(plScope.endLine, plScope.endLine + 10);
          for (const l of contextLines) console.log(`    >> ${l}`);
        }
      }

      // CF: check for operating total
      const cfSections = locateStatementSections(text, 'CF');
      const cfScope = cfSections[0];
      if (cfScope) {
        const cfText = cfScope.text.toLowerCase();
        const opMatch = cfText.match(/przepływ.*operacyjn|net.*operating/i);
        console.log(`  [CF] Section: ${cfScope.text.length} chars, operating total in scope: ${!!opMatch}`);
        if (!opMatch) {
          // Search broader text
          const lc = text.toLowerCase();
          const allMatches = [...lc.matchAll(/przepływy?\s+(?:pieniężne\s+)?(?:netto\s+)?(?:z\s+)?działalności\s+operacyjnej/gi)];
          console.log(`  [CF] "przepływy...operacyjnej" in full text: ${allMatches.length} occurrences`);
          for (const m of allMatches.slice(0, 3)) {
            const ctx = text.substring(m.index!, m.index! + 80).replace(/\n/g, '\\n');
            console.log(`    @${m.index}: "${ctx}"`);
          }
        }
      }
    }

    // KGHM BS
    if (doc.label === 'KGHM') {
      const bsSections = locateStatementSections(text, 'BS');
      const bsScope = bsSections[0];
      if (bsScope) {
        console.log(`  [BS] Section: lines ${bsScope.startLine}-${bsScope.endLine}, score=${bsScope.score}, ${bsScope.text.length} chars`);
        console.log(`  [BS] First 20 lines:`);
        const bsLines = bsScope.text.split('\n').slice(0, 20);
        for (const l of bsLines) console.log(`    | ${l}`);
      } else {
        console.log(`  [BS] NO SECTION FOUND!`);
      }

      // Search for BS keywords in full text
      const lower = text.toLowerCase();
      const bsKeywords = ['aktywa razem', 'suma aktywów', 'total assets', 'aktywa trwałe', 'aktywa obrotowe', 'kapitał własny', 'zobowiązania'];
      for (const kw of bsKeywords) {
        const idx = lower.indexOf(kw);
        if (idx >= 0) {
          const lineNo = text.substring(0, idx).split('\n').length;
          console.log(`  [BS] "${kw}" found at line ~${lineNo}, char ${idx}`);
        }
      }
    }

    // Tesla equity
    if (doc.label === 'Tesla') {
      const bsSections = locateStatementSections(text, 'BS');
      const bsScope = bsSections[0];
      if (bsScope) {
        const extracted = extractFinancialLines(bsScope.text, 'BS', {});
        const equityLines = extracted.lines.filter(l =>
          /equity|stockholder|shareowner|kapitał/i.test(l.originalLabel)
        );
        console.log(`  [BS] Equity-related extracted lines:`);
        for (const l of equityLines) {
          console.log(`    "${l.originalLabel}" = ${l.value}`);
        }
        // Search for total equity in section text
        const eqMatch = bsScope.text.match(/total.*(?:stockholders|shareowners).*equity|total equity/i);
        if (eqMatch) {
          console.log(`  [BS] Total equity phrase in section: "${eqMatch[0]}"`);
        } else {
          console.log(`  [BS] ⚠ No "Total equity" phrase found in BS section`);
          // Check broader
          const fullMatch = text.match(/total.*(?:stockholders|shareowners).*equity/i);
          if (fullMatch) {
            const idx = text.indexOf(fullMatch[0]);
            console.log(`  [BS] Found in full text at char ${idx}: "${fullMatch[0]}"`);
          }
        }
      }
    }

    // BMW & Coca-Cola total liabilities
    if (['BMW', 'Coca-Cola'].includes(doc.label)) {
      const bsSections = locateStatementSections(text, 'BS');
      const bsScope = bsSections[0];
      if (bsScope) {
        const extracted = extractFinancialLines(bsScope.text, 'BS', {});
        const liabLines = extracted.lines.filter(l =>
          /total.*liabilit|zobowiązania.*razem|zobowiązania.*ogółem/i.test(l.originalLabel)
        );
        console.log(`  [BS] Liability-related extracted lines:`);
        for (const l of liabLines) {
          console.log(`    "${l.originalLabel}" = ${l.value}`);
        }
        // Search for the actual label
        const allLines = extracted.lines.filter(l => /liabilit|zobowiąz|passiv/i.test(l.originalLabel));
        console.log(`  [BS] All liability mentions:`);
        for (const l of allLines) {
          console.log(`    "${l.originalLabel}" = ${l.value} [mapped: ${l.suggestedCanonicalId || 'no'}]`);
        }
      }
    }
  }
}

main().catch(e => { console.error(e); process.exit(1); });
