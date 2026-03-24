#!/usr/bin/env tsx
import PDFParserService from '../src/services/pdfParserService.js';

async function main() {
  const text = await PDFParserService.extractText('knowledge/Finanse/Samples/bp-annual-report-and-form-20f-2025.pdf');
  
  console.log('=== First 6000 chars (detectPeriod headerArea) ===');
  console.log(text.substring(0, 6000));
  
  console.log('\n\n=== Searching for year-related patterns ===');
  
  // Find "year ended" in full text
  const yearEndedAll = [...text.matchAll(/(?:year|period)\s+ended?\s+(?:december|january|june|march)\s+\d{1,2},?\s*(20\d{2})/gi)];
  console.log(`\n"year/period ended" in full text: ${yearEndedAll.length} matches`);
  for (const m of yearEndedAll.slice(0, 10)) {
    console.log(`  @${m.index}: "${m[0]}" → year=${m[1]}`);
  }
  
  // Find "for the year" patterns
  const forYearAll = [...text.matchAll(/for\s+the\s+(?:fiscal\s+)?year\s+(?:ended?\s+)?(?:december\s+\d{1,2},?\s*)?(20\d{2})/gi)];
  console.log(`\n"for the year" in full text: ${forYearAll.length} matches`);
  for (const m of forYearAll.slice(0, 10)) {
    console.log(`  @${m.index}: "${m[0]}" → year=${m[1]}`);
  }
  
  // Find the financial statements section to check period labels there
  const fsIdx = text.toLowerCase().indexOf('group income statement');
  if (fsIdx >= 0) {
    console.log(`\n=== Group Income Statement section @${fsIdx} ===`);
    console.log(text.substring(fsIdx, fsIdx + 600));
  }
  
  const bsIdx = text.toLowerCase().indexOf('group balance sheet');
  if (bsIdx >= 0) {
    console.log(`\n=== Group Balance Sheet section @${bsIdx} ===`);
    console.log(text.substring(bsIdx, bsIdx + 600));
  }
  
  // Check specific BP pattern: "$ million except per share"
  const bpScaling = text.indexOf('million except per share');
  if (bpScaling >= 0) {
    console.log(`\n=== BP scaling indicator @${bpScaling} ===`);
    console.log(text.substring(Math.max(0, bpScaling - 100), bpScaling + 100));
  }
}

main().catch(e => { console.error(e); process.exit(1); });
