#!/usr/bin/env tsx
import PDFParserService from '../src/services/pdfParserService.js';
import { detectStatementType } from '../src/services/financialStatementService.js';

const FILES = [
  { label: 'BP', file: 'knowledge/Finanse/Samples/bp-annual-report-and-form-20f-2025.pdf' },
  { label: 'Coca-Cola', file: 'knowledge/Finanse/Samples/nyse-ko-2025-10K-25644916.pdf' },
  { label: 'Tesla', file: 'knowledge/Finanse/Samples/tsla-20241231-gen.pdf' },
  { label: 'BMW', file: 'knowledge/Finanse/Samples/BMW-Group-Financial-Statements-2024-en.pdf' },
  { label: 'KGHM', file: 'knowledge/Finanse/Samples/Skonsolidowane sprawozdanie finansowe KGHM SRR_2024.pdf' },
  { label: 'Apator SA', file: 'knowledge/Finanse/Apator SA Raport R 2024.pdf' },
];

async function main() {
  for (const f of FILES) {
    const text = await PDFParserService.extractText(f.file);
    const det = detectStatementType(text);
    console.log(`${f.label.padEnd(20)} currency=${det.currency.padEnd(5)} scaling=${det.scaling.padEnd(12)} period=${det.periodLabel}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
