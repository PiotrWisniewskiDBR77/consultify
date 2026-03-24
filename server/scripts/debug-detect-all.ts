#!/usr/bin/env tsx
import PDFParserService from '../src/services/pdfParserService.js';

const FILES = [
  { label: 'BP', file: 'knowledge/Finanse/Samples/bp-annual-report-and-form-20f-2025.pdf' },
  { label: 'Coca-Cola', file: 'knowledge/Finanse/Samples/nyse-ko-2025-10K-25644916.pdf' },
  { label: 'Tesla', file: 'knowledge/Finanse/Samples/tsla-20241231-gen.pdf' },
  { label: 'BMW', file: 'knowledge/Finanse/Samples/BMW-Group-Financial-Statements-2024-en.pdf' },
  { label: 'KGHM', file: 'knowledge/Finanse/Samples/Skonsolidowane sprawozdanie finansowe KGHM SRR_2024.pdf' },
];

async function main() {
  for (const f of FILES) {
    console.log(`\n${'='.repeat(60)}\n  ${f.label}\n${'='.repeat(60)}`);
    const text = await PDFParserService.extractText(f.file);
    const header = text.substring(0, 30000).toLowerCase();
    
    // Scaling phrases
    const scalingTests: [string, RegExp][] = [
      ['millions', /(?:in\s+millions?|w\s+milionach|mln\s*(?:zł|pln|eur|usd|€|\$)?|in\s+mio\.?\s*(?:eur|€)?|\(\s*000\s*000\s*\)|en\s+millions|millions?\s+d[''e]?\s*(?:euros|dollars|pounds))\b/],
      ['thousands', /(?:in\s+thousands?|w\s+tysiącach|tys\.?\s*(?:zł|pln)?|in\s+tsd\.?\s*(?:eur|€)?|in\s+tausend|\(\s*000\s*\)|en\s+milliers|milliers\s+d[''e]?\s*(?:euros|dollars))\b/],
      ['billions', /(?:in\s+billions?|w\s+miliardach|in\s+mrd\.?|mld|en\s+milliards|milliards\s+d[''e]?\s*(?:euros|dollars))\b/],
    ];
    
    for (const [name, regex] of scalingTests) {
      const m = header.match(regex);
      if (m) console.log(`  scaling=${name}: matched "${m[0]}" at index ${m.index}`);
    }
    
    // Look for common scaling phrases in first 5000 chars
    const shortHeader = text.substring(0, 5000);
    const scalingHints = shortHeader.match(/\(.*?(million|thousand|billion|mln|tys|000).*?\)/gi);
    if (scalingHints) {
      for (const h of scalingHints) {
        console.log(`  Parenthetical hint: "${h}"`);
      }
    }
    
    // Search deeper for "in millions" patterns
    const deepSearch = text.substring(0, 50000).toLowerCase();
    const millionsMatches = [...deepSearch.matchAll(/in\s+millions/gi)];
    const thousandsMatches = [...deepSearch.matchAll(/in\s+thousands/gi)];
    console.log(`  "in millions" occurrences in first 50K: ${millionsMatches.length}`);
    console.log(`  "in thousands" occurrences in first 50K: ${thousandsMatches.length}`);
    
    // Find actual phrasing around scaling
    for (const m of millionsMatches.slice(0, 3)) {
      const ctx = deepSearch.substring(Math.max(0, m.index! - 30), m.index! + 40);
      console.log(`    context: "...${ctx}..."`);
    }
    for (const m of thousandsMatches.slice(0, 3)) {
      const ctx = deepSearch.substring(Math.max(0, m.index! - 30), m.index! + 40);
      console.log(`    context: "...${ctx}..."`);
    }
    
    // Period detection for BP
    if (f.label === 'BP') {
      const yearEndedMatches = [...text.substring(0, 10000).matchAll(/(?:year|period)\s+ended?\s+(?:\w+\s+\d{1,2},?\s*)?(20\d{2})/gi)];
      console.log(`  "year/period ended" matches:`, yearEndedMatches.map(m => `${m[0]} [year=${m[1]}]`));
      
      const asOfMatches = [...text.substring(0, 10000).matchAll(/as\s+of\s+(?:december|january)\s+\d{1,2},?\s*(20\d{2})/gi)];
      console.log(`  "as of" matches:`, asOfMatches.map(m => `${m[0]} [year=${m[1]}]`));
    }
  }
}

main().catch(e => { console.error(e); process.exit(1); });
