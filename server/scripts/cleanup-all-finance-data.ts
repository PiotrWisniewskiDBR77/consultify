#!/usr/bin/env tsx
/**
 * Clean up ALL financial statement data from the target database.
 * Pass database URLs as arguments or use env vars.
 */
import pg from 'pg';

const TABLES_TO_CLEAN = [
  'financial_statement_values',
  'financial_statement_mapping_candidates',
  'financial_statement_candidate_rows',
  'financial_statement_extracted_sections',
  'financial_statement_validations',
  'financial_statement_versions',
  'financial_statement_source_artifacts',
  'financial_statement_quality_runs',
  'financial_statement_repair_sessions',
  'financial_statement_ingest_runs',
  'financial_statement_packs',
  'financial_statements',
];

async function cleanDatabase(dbUrl: string, label: string): Promise<void> {
  console.log(`\n=== Cleaning: ${label} ===`);
  const client = new pg.Client(dbUrl);
  await client.connect();

  const before = await client.query('SELECT COUNT(*) as cnt FROM financial_statements');
  console.log(`  Before: ${before.rows[0].cnt} statements`);

  for (const table of TABLES_TO_CLEAN) {
    try {
      const result = await client.query(`DELETE FROM ${table}`);
      if (result.rowCount && result.rowCount > 0) {
        console.log(`  ${table}: ${result.rowCount} rows deleted`);
      }
    } catch (e: any) {
      if (!e.message?.includes('does not exist')) {
        console.log(`  ${table}: ⚠ ${e.message?.slice(0, 80)}`);
      }
    }
  }

  const after = await client.query('SELECT COUNT(*) as cnt FROM financial_statements');
  console.log(`  After: ${after.rows[0].cnt} statements`);
  await client.end();
}

async function main() {
  const trolley = 'postgresql://postgres:2evh7mlls1n00vmwhzm180ner3xndjo3@trolley.proxy.rlwy.net:28146/railway';
  const caboose = 'postgresql://postgres:l5jjc8wrhxmkuxlsuvc7ic1j998gbp5l@caboose.proxy.rlwy.net:15646/railway';

  await cleanDatabase(trolley, 'trolley (staging)');
  await cleanDatabase(caboose, 'caboose (.env.local)');
  console.log('\n✓ Both databases cleaned.');
}

main().catch((e) => console.error('Fatal:', e.message));
