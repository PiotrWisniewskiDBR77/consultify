#!/usr/bin/env tsx
import pg from 'pg';
import { v4 as uuidv4 } from 'uuid';
import PDFParserService from '../src/services/pdfParserService.js';
import {
  autoMapLines,
  classifyStatementDocument,
  detectStatementType,
  evaluateStatementReadiness,
  extractFinancialLines,
  locateStatementSections,
  resolveDuplicateSuggestedMappings,
  resolveStatementColumnSelection,
  validateStatement,
} from '../src/services/financialStatementService.js';

const DB_URL = process.env.DATABASE_URL!;
const ORG_ID = 'a3e05d4a-5397-419d-b486-8e44366c0063';

async function main() {
  const client = new pg.Client(DB_URL);
  await client.connect();

  const file = 'knowledge/Finanse/Samples/nyse-ko-2025-10K-25644916.pdf';
  const text = await PDFParserService.extractText(file);

  const detection = detectStatementType(text);
  console.log(`detection.currency = "${detection.currency}"`);
  console.log(`detection.scaling = "${detection.scaling}"`);
  console.log(`detection.periodLabel = "${detection.periodLabel}"`);

  const documentProfile = classifyStatementDocument({
    fileName: file.split('/').pop()!,
    parseMethod: 'text_extraction',
    text,
  });
  console.log(`documentProfile.documentClass = "${documentProfile.documentClass}"`);

  // Delete any existing Coca-Cola statements
  const del = await client.query(`DELETE FROM financial_statement_values WHERE statement_id IN (SELECT id FROM financial_statements WHERE source_file_name LIKE '%ko%')`);
  console.log(`Deleted ${del.rowCount} values`);
  const del2 = await client.query(`DELETE FROM financial_statements WHERE source_file_name LIKE '%ko%'`);
  console.log(`Deleted ${del2.rowCount} statements`);

  const stType = 'BS';
  const statementId = uuidv4();
  const packId = uuidv4();
  const sections = locateStatementSections(text, stType);
  const scopedText = sections[0]?.text || text;
  const columnSelection = resolveStatementColumnSelection(scopedText, {
    ...detection,
    statementType: stType,
  });
  const currentPeriod = columnSelection.selectedPeriodLabel || detection.periodLabel || 'Current';

  // Build params array exactly as reimport does
  const params = [
    statementId,                               // $1
    ORG_ID,                                    // $2
    stType,                                    // $3
    detection.periodStart || '2024-01-01',     // $4
    detection.periodEnd || '2024-12-31',       // $5
    currentPeriod,                             // $6
    detection.currency || 'PLN',               // $7 = CURRENCY
    detection.scaling || 'thousands',          // $8
    file.split('/').pop()!,                    // $9
    file,                                      // $10
    'text_extraction',                         // $11
    'mapped',                                  // $12
    null,                                      // $13
    detection.confidence,                      // $14
    'pending',                                 // $15 = readiness_status
    documentProfile.documentClass,             // $16
    'local_parser',                            // $17
    documentProfile.templateFamily,            // $18
    packId,                                    // $19
    'debug-test',                              // $20
  ];

  console.log(`\n=== INSERT PARAMS ===`);
  console.log(`$7 (currency) = "${params[6]}"`);
  console.log(`$8 (scaling) = "${params[7]}"`);
  console.log(`$15 (readiness) = "${params[14]}"`);
  console.log(`$16 (doc_class) = "${params[15]}"`);

  // First insert pack (simplified)
  await client.query(
    `INSERT INTO financial_statement_packs (id, organization_id, entity_name, period_start, period_end, period_label, currency, scaling, metadata_json, created_at) 
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,CURRENT_TIMESTAMP) ON CONFLICT (id) DO NOTHING`,
    [packId, ORG_ID, 'Coca-Cola Test', detection.periodStart || '2024-01-01', detection.periodEnd || '2024-12-31', detection.periodLabel, detection.currency || 'PLN', detection.scaling || 'thousands', '{}']
  );

  try {
    await client.query(
      `INSERT INTO financial_statements (
        id, organization_id, statement_type, period_start, period_end, period_label,
        currency, scaling, source_file_name, source_file_path, parse_method, status,
        notes, overall_confidence, readiness_status, document_class, extraction_strategy,
        template_family, statement_pack_id,
        created_by, created_at, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
      ON CONFLICT (id) DO NOTHING`,
      params
    );
    console.log(`\nINSERT succeeded!`);
  } catch (e: any) {
    console.log(`\nINSERT FAILED: ${e.message}`);
  }

  // Read back
  const check = await client.query(
    `SELECT id, currency, scaling, period_label, document_class FROM financial_statements WHERE id = $1`,
    [statementId]
  );
  if (check.rows.length > 0) {
    console.log(`Read back: currency=${check.rows[0].currency}, scaling=${check.rows[0].scaling}, period=${check.rows[0].period_label}, doc_class=${check.rows[0].document_class}`);
  } else {
    console.log(`No row found with id ${statementId}!`);
  }

  // Clean up
  await client.query(`DELETE FROM financial_statement_values WHERE statement_id = $1`, [statementId]);
  await client.query(`DELETE FROM financial_statements WHERE id = $1`, [statementId]);
  await client.query(`DELETE FROM financial_statement_packs WHERE id = $1`, [packId]);
  console.log('Cleaned up test data.');

  await client.end();
}

main().catch((e) => { console.error(e.message); process.exit(1); });
