#!/usr/bin/env tsx
import PDFParserService from '../src/services/pdfParserService.js';

const FILES = [
  { label: 'BP', file: 'knowledge/Finanse/Samples/bp-annual-report-and-form-20f-2025.pdf' },
  { label: 'Coca-Cola', file: 'knowledge/Finanse/Samples/nyse-ko-2025-10K-25644916.pdf' },
  { label: 'Tesla', file: 'knowledge/Finanse/Samples/tsla-20241231-gen.pdf' },
  { label: 'BMW', file: 'knowledge/Finanse/Samples/BMW-Group-Financial-Statements-2024-en.pdf' },
];

async function main() {
  for (const f of FILES) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`  ${f.label}`);
    console.log(`${'='.repeat(60)}`);

    const text = await PDFParserService.extractText(f.file);
    const lower = text.toLowerCase();
    const headerArea = lower.substring(0, 30000);

    console.log(`  Text length: ${text.length}, headerArea: ${headerArea.length}`);

    const reportingPhrases: [RegExp, string, number][] = [
      [/in\s+millions?\s+of\s+(?:u\.?s\.?\s*)?dollars/i, 'USD', 10],
      [/in\s+thousands?\s+of\s+(?:u\.?s\.?\s*)?dollars/i, 'USD', 10],
      [/(?:amounts?\s+(?:are\s+)?in|expressed\s+in|denominated\s+in|reported\s+in)\s+(?:u\.?s\.?\s*)?dollars/i, 'USD', 10],
      [/\(\s*in\s+(?:millions?|thousands?|billions?)(?:\s*,\s*except)?\s*\)/i, 'USD', 6],
      [/form\s+10-k/i, 'USD', 4],
      [/form\s+20-f/i, 'USD', 3],
      [/\bsec\s+filing\b/i, 'USD', 3],
      [/\bnasdaq|nyse\b/i, 'USD', 3],
      [/in\s+millions?\s+of\s+euros/i, 'EUR', 10],
      [/in\s+thousands?\s+of\s+euros/i, 'EUR', 10],
      [/(?:amounts?\s+(?:are\s+)?in|expressed\s+in|reported\s+in)\s+euros/i, 'EUR', 10],
      [/in\s+millions?\s+of\s+pounds/i, 'GBP', 10],
      [/\bw\s+(?:tysiącach|milionach)\s+(?:złotych|pln|zł)\b/i, 'PLN', 10],
      [/waluta\s+sprawozdawcza:\s*pln/i, 'PLN', 10],
      [/waluta\s+sprawozdawcza:\s*eur/i, 'EUR', 10],
      [/waluta\s+sprawozdawcza:\s*usd/i, 'USD', 10],
      [/\b(tys\.?\s*zł|mln\s*zł|zł|złot)\b/i, 'PLN', 8],
    ];

    const scores = new Map<string, number>();
    for (const [re, code, weight] of reportingPhrases) {
      if (re.test(headerArea)) {
        scores.set(code, (scores.get(code) || 0) + weight);
        console.log(`  ✓ MATCH [${code} +${weight}]: ${re.source.slice(0, 60)}`);
      }
    }

    console.log(`  Phase 1 scores: ${JSON.stringify(Object.fromEntries(scores))}`);

    if (scores.size > 0) {
      const winner = [...scores.entries()].sort((a, b) => b[1] - a[1])[0];
      console.log(`  → Phase 1 winner: ${winner[0]} (score=${winner[1]})`);
    } else {
      console.log(`  → Phase 1: no matches, falling to keyword count`);
      const sample = lower.substring(0, 50000);
      const fallback: [RegExp, string][] = [
        [/\b(pln|złot|zł)\b/gi, 'PLN'],
        [/\b(usd|us\s*dollar(?:s)?)\b/gi, 'USD'],
        [/\$\s*\d/g, 'USD'],
        [/\b(eur(?:o)?)\b/gi, 'EUR'],
        [/€\s*\d/g, 'EUR'],
        [/\b(gbp|£)\b/gi, 'GBP'],
      ];
      const counts = new Map<string, number>();
      for (const [re, code] of fallback) {
        const matches = sample.match(re);
        if (matches) {
          counts.set(code, (counts.get(code) || 0) + matches.length);
          console.log(`  Fallback [${code}]: ${matches.length} matches`);
        }
      }
      if (counts.size > 0) {
        const winner = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
        console.log(`  → Fallback winner: ${winner[0]} (count=${winner[1]})`);
      }
    }

    // Also show what detectStatementType returns
    const { detectStatementType } = await import('../src/services/financialStatementService.js');
    const detection = detectStatementType(text);
    console.log(`  detectStatementType → currency=${detection.currency}, period=${detection.periodLabel}, scaling=${detection.scaling}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
