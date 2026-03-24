#!/usr/bin/env tsx
import pg from 'pg';

async function main() {
  const client = new pg.Client(process.env.DATABASE_URL);
  await client.connect();

  // Check constraints
  const constraints = await client.query(`
    SELECT conname, pg_get_constraintdef(oid) as def
    FROM pg_constraint
    WHERE conrelid = 'financial_statements'::regclass
      AND contype = 'c'
  `);
  console.log('CHECK constraints on financial_statements:');
  for (const r of constraints.rows) {
    console.log(`  ${r.conname}: ${r.def}`);
  }

  // Check what document_class values exist
  const dcValues = await client.query(`SELECT DISTINCT document_class FROM financial_statements`);
  console.log('\nExisting document_class values:');
  for (const r of dcValues.rows) {
    console.log(`  "${r.document_class}"`);
  }

  // Check created_at timestamps to see when records were created
  const times = await client.query(`
    SELECT source_file_name, statement_type, currency, created_at, created_by
    FROM financial_statements
    WHERE source_file_name LIKE '%ko%' OR source_file_name LIKE '%tsla%'
    ORDER BY created_at DESC
    LIMIT 5
  `);
  console.log('\nRecent US filing records with timestamps:');
  for (const r of times.rows) {
    console.log(`  ${r.source_file_name} | ${r.statement_type} | currency=${r.currency} | created=${r.created_at} | by=${r.created_by}`);
  }

  await client.end();
}

main().catch((e) => { console.error(e.message); process.exit(1); });
