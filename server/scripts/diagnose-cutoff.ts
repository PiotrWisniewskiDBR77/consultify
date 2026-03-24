#!/usr/bin/env tsx
import PDFParserService from '../src/services/pdfParserService.js';

async function main() {
  // KGHM: what line comes right after "Aktywa niematerialne"?
  {
    const text = await PDFParserService.extractText('knowledge/Finanse/Samples/Skonsolidowane sprawozdanie finansowe KGHM SRR_2024.pdf');
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (/skonsolidowane sprawozdanie z sytuacji finansowej/i.test(lines[i]) && !/\.{4,}/.test(lines[i])) {
        console.log('=== KGHM BS start + 30 lines ===');
        for (let j = i; j < Math.min(i + 50, lines.length); j++) {
          const isNota = /(?:nota\s+\d|note\s+\d)/i.test(lines[j]);
          const isEnd = /(?:rachunek zysków|sprawozdanie z zysków|income statement|cash flow|zestawienie zmian)/i.test(lines[j]);
          const flags = [isNota ? 'NOTA' : '', isEnd ? 'END' : ''].filter(Boolean).join(',');
          console.log(`  ${j}: ${flags ? `[${flags}] ` : ''}${lines[j]}`);
        }
        break;
      }
    }
  }

  // Tesla: what comes after "Total liabilities" in the BS?
  {
    const text = await PDFParserService.extractText('knowledge/Finanse/Samples/tsla-20241231-gen.pdf');
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (/total\s+liabilities\s/i.test(lines[i]) && /48[,.]?390/i.test(lines[i])) {
        console.log('\n=== Tesla: lines around "Total liabilities" ===');
        for (let j = Math.max(0, i - 2); j < Math.min(i + 20, lines.length); j++) {
          const endMarkers = [
            /(?:consolidated\s+)?statements?\s+of\s+(?:stockholders|shareholders|changes\s+in)\s*equity/i,
            /see\s+accompanying\s+notes/i,
            /notes\s+to\s+(?:the\s+)?(?:consolidated\s+)?financial\s+statements/i,
          ];
          const matchesEnd = endMarkers.some(r => r.test(lines[j]));
          console.log(`  ${j}: ${matchesEnd ? '[END_MARKER] ' : ''}${lines[j]}`);
        }
        break;
      }
    }
  }

  // Apator: P&L extraction - check what happens with "Zysk netto, z tego przypadający"
  {
    const text = await PDFParserService.extractText('knowledge/Finanse/Grupa Apator Raport RS 2024.pdf');
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (/zysk netto/i.test(lines[i]) && /przypadając/i.test(lines[i])) {
        console.log('\n=== Apator P&L: "Zysk netto" context ===');
        for (let j = Math.max(0, i - 3); j < Math.min(i + 5, lines.length); j++) {
          console.log(`  ${j}: "${lines[j]}"`);
        }
        break;
      }
    }
  }
}

main().catch(e => { console.error(e); process.exit(1); });
