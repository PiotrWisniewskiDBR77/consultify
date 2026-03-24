#!/usr/bin/env tsx
import {
  extractFinancialLines,
  autoMapLines,
  locateStatementSections,
  resolveStatementColumnSelection,
  detectStatementType,
  classifyStatementDocument,
} from '../src/services/financialStatementService.js';
import PDFParserService from '../src/services/pdfParserService.js';

const ORG_ID = 'a3e05d4a-5397-419d-b486-8e44366c0063';

async function main() {
  const file = 'knowledge/Finanse/Samples/BMW-Group-Financial-Statements-2024-en.pdf';
  const text = await PDFParserService.extractText(file);
  const detection = detectStatementType(text);
  const profile = classifyStatementDocument({ fileName: file, text });

  for (const stType of ['BS', 'P&L', 'CF'] as const) {
    const sections = locateStatementSections(text, stType);
    const scopedText = sections[0]?.text || text;
    const colSel = resolveStatementColumnSelection(scopedText, { ...detection, statementType: stType });
    const extraction = extractFinancialLines(scopedText, stType, {
      selectedPeriodLabel: colSel.selectedPeriodLabel,
      comparisonPeriodLabel: colSel.comparisonPeriodLabel,
    });

    const mapped = await autoMapLines(extraction.lines, stType, {
      organizationId: ORG_ID,
      templateFamily: profile.templateFamily,
    });

    const unmapped = mapped.filter((l) => !l.isNonFinancial && !l.suggestedCanonicalId);
    if (unmapped.length > 0) {
      console.log(`\n${stType} — ${unmapped.length} unmapped:`);
      for (const l of unmapped) {
        console.log(`  "${l.originalLabel}" → value=${l.value} reason=${l.mappingReason || 'none'}`);
      }
    }
  }
}

main().catch((e) => { console.error(e.message); process.exit(1); });
