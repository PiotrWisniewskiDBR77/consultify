#!/usr/bin/env tsx
import PDFParserService from '../src/services/pdfParserService.js';
import { locateStatementSections } from '../src/services/financialStatementService.js';

async function main() {
  const text = await PDFParserService.extractText('knowledge/Finanse/Grupa Apator Raport RS 2024.pdf');
  const sections = locateStatementSections(text, 'P&L');
  const sect = sections[0];
  if (!sect) { console.log('No section'); return; }

  const lines = sect.text.split('\n');
  console.log(`P&L section: ${lines.length} lines, ${sect.text.length} chars\n`);

  // Find lines containing key keywords
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lower = line.toLowerCase();
    if (/podatek|zysk.*netto|net income|wynik.*netto|strata.*netto|z tego przypad|tax|opodatkowaniem/.test(lower)) {
      console.log(`  [${i}] "${line}"`);
    }
  }

  // Show all lines around "Zysk przed opodatkowaniem"
  console.log('\n=== Lines around "Zysk przed opodatkowaniem" ===');
  for (let i = 0; i < lines.length; i++) {
    if (/zysk przed opodatkowaniem/i.test(lines[i])) {
      for (let j = Math.max(0, i - 2); j < Math.min(lines.length, i + 10); j++) {
        const numericGroups = (lines[j].match(/\(?-?\d[\d.,]*\)?/g) || []).length;
        console.log(`  [${j}] (${numericGroups} nums) "${lines[j]}"`);
      }
      break;
    }
  }

  // Actually check if "Zysk netto" appears anywhere in section
  const lowerSection = sect.text.toLowerCase();
  const zynIdx = lowerSection.indexOf('zysk netto');
  if (zynIdx >= 0) {
    const context = sect.text.substring(zynIdx, zynIdx + 200).replace(/\n/g, '\\n');
    console.log(`\n"zysk netto" at section offset ${zynIdx}: "${context.substring(0, 150)}"`);
    // What line number is this in the section?
    const linesBefore = sect.text.substring(0, zynIdx).split('\n');
    console.log(`  → section line ${linesBefore.length - 1}`);
  }

  // Check the "Inne całkowite dochody" line
  const ociIdx = lowerSection.indexOf('inne całkowite dochody');
  if (ociIdx >= 0) {
    const linesBefore = sect.text.substring(0, ociIdx).split('\n');
    const context = sect.text.substring(ociIdx, ociIdx + 300).replace(/\n/g, '\\n');
    console.log(`\n"inne całkowite dochody" at section line ${linesBefore.length - 1}`);
    console.log(`  Context: "${context.substring(0, 200)}"`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
