#!/usr/bin/env tsx
/**
 * Direct import of Apator financial statements into the local database.
 * Uses service functions directly + pg client for DB writes.
 * Bypasses the HTTP API to avoid schema compatibility issues.
 */
import pg from 'pg';
import { v4 as uuidv4 } from 'uuid';
import {
  resolveFinanceImportDatabaseUrl,
  resolveFinanceImportOrgId,
} from './lib/financeImportTarget.js';
import PDFParserService from '../src/services/pdfParserService.js';
import {
  autoMapLines,
  classifyStatementDocument,
  detectStatementType,
  detectContainedStatementTypes,
  evaluateStatementReadiness,
  extractFinancialLines,
  locateStatementSections,
  resolveDuplicateSuggestedMappings,
  resolveStatementColumnSelection,
  validateStatement,
} from '../src/services/financialStatementService.js';

const DB_URL = resolveFinanceImportDatabaseUrl();
const ORG_ID = resolveFinanceImportOrgId();

const DOCUMENTS = [
  { label: 'Apator SA Raport R 2024', file: 'knowledge/Finanse/Apator SA Raport R 2024.pdf' },
  { label: 'Grupa Apator Raport RS 2023', file: 'knowledge/Finanse/Grupa Apator Raport RS 2023.pdf' },
  { label: 'Grupa Apator Raport RS 2024', file: 'knowledge/Finanse/Grupa Apator Raport RS 2024.pdf' },
  { label: 'Raport skonsolidowany Apator RS 2022', file: 'knowledge/Finanse/Raport-skonsolidowany-Apator.pdf' },
];

const TYPES: Array<'BS' | 'P&L' | 'CF'> = ['BS', 'P&L', 'CF'];

interface ImportResult {
  document: string;
  type: string;
  statementId: string;
  eligible: number;
  mapped: number;
  coverage: number;
  readiness: string;
}

async function main(): Promise<void> {
  const client = new pg.Client(DB_URL);
  await client.connect();
  console.log(`Connected to database for org=${ORG_ID}.\n`);

  const results: ImportResult[] = [];

  for (const doc of DOCUMENTS) {
    console.log(`\n=== ${doc.label} ===`);
    const text = await PDFParserService.extractText(doc.file);
    const detection = detectStatementType(text);
    const documentProfile = classifyStatementDocument({
      fileName: doc.file.split('/').pop()!,
      parseMethod: 'text_extraction',
      text,
    });

    for (const stType of TYPES) {
      const tag = `  [${stType}]`;
      const statementId = uuidv4();
      const packId = uuidv4();

      // Extract
      const sections = locateStatementSections(text, stType);
      const scopedText = sections[0]?.text || text;
      const columnSelection = resolveStatementColumnSelection(scopedText, {
        ...detection,
        statementType: stType,
      });
      const extraction = extractFinancialLines(text, stType, {
        selectedPeriodLabel: columnSelection.selectedPeriodLabel,
        comparisonPeriodLabel: columnSelection.comparisonPeriodLabel,
      });

      // Map
      const mapped = resolveDuplicateSuggestedMappings(
        await autoMapLines(extraction.lines, stType, {
          organizationId: ORG_ID,
          templateFamily: documentProfile.templateFamily,
        }),
      );

      const eligible = mapped.filter((l) => !l.isNonFinancial);
      const mappedLines = eligible.filter((l) => l.suggestedCanonicalId);
      const coverage = eligible.length > 0 ? Math.round((mappedLines.length / eligible.length) * 100) : 0;

      // Validate
      const validation = validateStatement(
        mapped.map((l) => ({
          canonicalLineId: l.suggestedCanonicalId || null,
          value: Number(l.value || 0),
          originalLabel: l.originalLabel,
          mappingStatus: l.suggestedCanonicalId ? 'auto' : 'unmapped',
          isNonFinancial: !!l.isNonFinancial,
        })),
        stType,
      );
      const readiness = evaluateStatementReadiness({
        rawStatus: 'mapped',
        statementType: stType,
        validationStatus: validation.status,
        currency: detection.currency,
        scaling: detection.scaling,
        validationMessages: validation.messages,
        values: mapped.map((l) => ({
          canonicalLineId: l.suggestedCanonicalId || null,
          value: Number(l.value || 0),
          isNonFinancial: !!l.isNonFinancial,
        })),
      });

      console.log(
        `${tag} ${mappedLines.length}/${eligible.length} mapped (${coverage}%) readiness=${readiness.readinessStatus}`,
      );

      // Insert statement record
      try {
        await client.query(
          `INSERT INTO financial_statements (
            id, organization_id, statement_type, period_start, period_end, period_label,
            currency, scaling, source_file_name, source_file_path, parse_method, status,
            notes, overall_confidence, readiness_status, document_class, extraction_strategy, template_family,
            created_by, created_at, updated_at
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
          ON CONFLICT (id) DO NOTHING`,
          [
            statementId,
            ORG_ID,
            stType,
            detection.periodStart || `${new Date().getFullYear()}-01-01`,
            detection.periodEnd || `${new Date().getFullYear()}-12-31`,
            detection.periodLabel || null,
            detection.currency || 'PLN',
            detection.scaling || 'thousands',
            doc.file.split('/').pop()!,
            doc.file,
            'text_extraction',
            readiness.isReady ? 'confirmed' : 'mapped',
            text.substring(0, 100000),
            detection.confidence,
            readiness.readinessStatus,
            documentProfile.documentClass,
            'local_parser',
            documentProfile.templateFamily,
            'auto-import',
          ],
        );
      } catch (e: any) {
        console.log(`${tag}   ⚠ Statement insert: ${e.message?.slice(0, 80)}`);
      }

      // Insert statement pack
      try {
        await client.query(
          `INSERT INTO financial_statement_packs (
            id, organization_id, source_file_name, document_class, template_family, created_at
          ) VALUES ($1,$2,$3,$4,$5,CURRENT_TIMESTAMP)
          ON CONFLICT (id) DO NOTHING`,
          [packId, ORG_ID, doc.file.split('/').pop()!, documentProfile.documentClass, documentProfile.templateFamily],
        );
      } catch {}

      // Insert values
      let savedCount = 0;
      for (const line of eligible) {
        const valueId = uuidv4();
        try {
          await client.query(
            `INSERT INTO financial_statement_values (
              id, statement_id, canonical_line_id, original_label, value, confidence,
              source_row, mapping_status, is_non_financial, created_at
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,CURRENT_TIMESTAMP)`,
            [
              valueId,
              statementId,
              line.suggestedCanonicalId || null,
              line.originalLabel,
              Number(line.value || 0),
              Number(line.confidence || 0),
              line.sourceRow || null,
              line.suggestedCanonicalId ? 'auto' : 'unmapped',
              false,
            ],
          );
          savedCount++;
        } catch (e: any) {
          if (savedCount === 0) console.log(`${tag}   ⚠ Value insert: ${e.message?.slice(0, 80)}`);
        }
      }

      console.log(`${tag}   → saved ${savedCount} values, status: ${readiness.isReady ? 'confirmed' : 'mapped'}`);

      results.push({
        document: doc.label,
        type: stType,
        statementId,
        eligible: eligible.length,
        mapped: mappedLines.length,
        coverage,
        readiness: readiness.readinessStatus,
      });
    }
  }

  await client.end();

  console.log('\n\n========================================');
  console.log('       IMPORT SUMMARY');
  console.log('========================================\n');

  console.log(
    'Document'.padEnd(45) + 'Type'.padEnd(6) + 'Lines'.padEnd(8) + 'Mapped'.padEnd(8) + 'Coverage'.padEnd(10) + 'Readiness',
  );
  console.log('-'.repeat(95));

  let totalMapped = 0;
  let totalEligible = 0;
  for (const r of results) {
    totalMapped += r.mapped;
    totalEligible += r.eligible;
    const icon = r.coverage >= 95 ? '✅' : r.coverage >= 80 ? '⚠️' : '❌';
    console.log(
      `${icon} ${r.document.padEnd(42)} ${r.type.padEnd(6)}${String(r.eligible).padEnd(8)}${String(r.mapped).padEnd(8)}${(r.coverage + '%').padEnd(10)}${r.readiness}`,
    );
  }
  console.log('-'.repeat(95));
  const totalCoverage = totalEligible > 0 ? Math.round((totalMapped / totalEligible) * 100) : 0;
  console.log(`   TOTAL: ${totalMapped}/${totalEligible} (${totalCoverage}%)`);
}

main().catch((error) => {
  console.error('Fatal:', (error as Error).message);
  process.exit(1);
});
