#!/usr/bin/env tsx
import PDFParserService from '../src/services/pdfParserService.js';

const FILES = [
  { label: 'Coca-Cola', file: 'knowledge/Finanse/Samples/nyse-ko-2025-10K-25644916.pdf' },
  { label: 'Tesla', file: 'knowledge/Finanse/Samples/tsla-20241231-gen.pdf' },
  { label: 'BP', file: 'knowledge/Finanse/Samples/bp-annual-report-and-form-20f-2025.pdf' },
];

async function main() {
  for (const f of FILES) {
    console.log(`\n${'='.repeat(60)}\n  ${f.label}\n${'='.repeat(60)}`);
    const text = await PDFParserService.extractText(f.file);
    const lower = text.toLowerCase();

    // Search all text for scaling-related words
    const patterns: [string, RegExp][] = [
      ['million', /million/gi],
      ['thousand', /thousand/gi],
      ['billion', /billion/gi],
      ['(in m', /\(in\s+m/gi],
      ['($ in', /\(\$?\s*in/gi],
      ['except per share', /except\s+per\s+share/gi],
      ['$', /\$\s*\d/g],
    ];

    for (const [name, regex] of patterns) {
      const matches = [...lower.matchAll(regex)];
      console.log(`  "${name}": ${matches.length} occurrences`);
      for (const m of matches.slice(0, 5)) {
        const start = Math.max(0, m.index! - 40);
        const end = Math.min(lower.length, m.index! + m[0].length + 40);
        const ctx = lower.substring(start, end).replace(/\n/g, '\\n');
        console.log(`    @${m.index}: "...${ctx}..."`);
      }
    }

    // Look for table header areas that might contain scaling
    const bsStart = lower.indexOf('balance sheet');
    const plStart = lower.indexOf('income statement') !== -1 ? lower.indexOf('income statement') : lower.indexOf('statement of income');
    const cfStart = lower.indexOf('cash flow');

    for (const [name, idx] of [['BS', bsStart], ['P&L', plStart], ['CF', cfStart]] as const) {
      if (idx >= 0) {
        const ctx = text.substring(Math.max(0, idx - 200), Math.min(text.length, idx + 500)).replace(/\n/g, '\\n');
        console.log(`\n  ${name} header area (@${idx}):\n    "${ctx.substring(0, 400)}"`);
      }
    }
  }
}

main().catch(e => { console.error(e); process.exit(1); });
