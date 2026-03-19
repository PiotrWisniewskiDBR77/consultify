#!/usr/bin/env tsx
/**
 * Clean up ALL financial statement data from the explicitly selected database target.
 *
 * Usage:
 *   DATABASE_PUBLIC_URL="<public-postgres-url>" FINANCE_CLEANUP_CONFIRM=DELETE_ALL_FINANCE_DATA npx tsx server/scripts/cleanup-all-finance-data.ts
 */
import pg from 'pg';

import {
  logSelectedDatabaseTarget,
  requireConfirmation,
  resolveScriptDatabaseTarget,
} from './lib/scriptDatabaseTarget.js';

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
  requireConfirmation(
    'FINANCE_CLEANUP_CONFIRM',
    'DELETE_ALL_FINANCE_DATA',
    'cleanup-all-finance-data'
  );
  const target = resolveScriptDatabaseTarget({
    label: 'cleanup-all-finance-data',
    databaseUrl: process.env.FINANCE_IMPORT_DATABASE_URL || process.env.DATABASE_URL,
    publicDatabaseUrl:
      process.env.FINANCE_IMPORT_DATABASE_PUBLIC_URL || process.env.DATABASE_PUBLIC_URL,
    requireExplicitTarget: true,
  });
  logSelectedDatabaseTarget('cleanup-all-finance-data', target);
  await cleanDatabase(target.connectionString, `${target.host}/${target.database}`);
  console.log('\n✓ Finance tables cleaned in selected database.');
}

main().catch((e) => console.error('Fatal:', e.message));
