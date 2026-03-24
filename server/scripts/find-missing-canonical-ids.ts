#!/usr/bin/env tsx
import pg from 'pg';
import { resolveReachableDatabaseUrl } from '../src/config/databaseTargetResolver.js';
import PDFParserService from '../src/services/pdfParserService.js';
import {
  autoMapLines,
  extractFinancialLines,
  detectStatementType,
  resolveStatementColumnSelection,
  locateStatementSections,
  resolveDuplicateSuggestedMappings,
} from '../src/services/financialStatementService.js';

const DB_URL = (() => {
  const resolved = resolveReachableDatabaseUrl({
    databaseUrl: process.env.DATABASE_URL,
    publicDatabaseUrl: process.env.DATABASE_PUBLIC_URL,
  });
  if (!resolved.databaseUrl) {
    throw new Error('DATABASE_URL or DATABASE_PUBLIC_URL is required.');
  }
  return resolved.databaseUrl;
})();

const FILES = [
  'knowledge/Finanse/Grupa Apator Raport RS 2023.pdf',
  'knowledge/Finanse/Grupa Apator Raport RS 2024.pdf',
  'knowledge/Finanse/Raport-skonsolidowany-Apator.pdf',
];

async function main(): Promise<void> {
  const client = new pg.Client(DB_URL);
  await client.connect();
  const result = await client.query<{ id: string }>('SELECT id FROM financial_statement_lines ORDER BY id');
  const dbIds = new Set(result.rows.map((r) => r.id));
  await client.end();
  console.log(`DB has ${dbIds.size} canonical line IDs`);

  const missingIds = new Set<string>();

  for (const filePath of FILES) {
    for (const stType of ['BS', 'P&L'] as const) {
      const text = await PDFParserService.extractText(filePath);
      const detection = detectStatementType(text);
      const sections = locateStatementSections(text, stType);
      const scopedText = sections[0]?.text || text;
      const columnSelection = resolveStatementColumnSelection(scopedText, { ...detection, statementType: stType });
      const extraction = extractFinancialLines(text, stType, {
        selectedPeriodLabel: columnSelection.selectedPeriodLabel,
        comparisonPeriodLabel: columnSelection.comparisonPeriodLabel,
      });
      const mapped = resolveDuplicateSuggestedMappings(
        await autoMapLines(extraction.lines, stType, { organizationId: '', templateFamily: '' }),
      );

      for (const line of mapped) {
        if (line.suggestedCanonicalId && !dbIds.has(line.suggestedCanonicalId)) {
          missingIds.add(line.suggestedCanonicalId);
        }
        if (line.mappingCandidates) {
          for (const c of line.mappingCandidates as any[]) {
            if (c.canonicalId && !dbIds.has(c.canonicalId)) {
              missingIds.add(c.canonicalId);
            }
          }
        }
      }
    }
  }

  console.log('\nMissing canonical IDs (in mapping candidates but not in DB):');
  const sorted = [...missingIds].sort();
  sorted.forEach((id) => console.log('  ', id));
  console.log(`\nTotal missing: ${sorted.length}`);
}

main().catch((error) => {
  console.error('Failed:', (error as Error).message);
  process.exit(1);
});
