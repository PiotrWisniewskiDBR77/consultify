#!/usr/bin/env tsx
import pg from 'pg';

async function main() {
  const client = new pg.Client(process.env.DATABASE_URL);
  await client.connect();

  const res = await client.query(`
    SELECT column_name, ordinal_position, data_type, column_default, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'financial_statements'
    ORDER BY ordinal_position
  `);

  console.log('financial_statements columns:');
  console.log('Pos'.padEnd(5) + 'Column'.padEnd(35) + 'Type'.padEnd(20) + 'Default'.padEnd(20) + 'Nullable');
  console.log('-'.repeat(100));
  for (const r of res.rows) {
    console.log(
      String(r.ordinal_position).padEnd(5) +
      String(r.column_name).padEnd(35) +
      String(r.data_type).padEnd(20) +
      String(r.column_default || '').padEnd(20) +
      String(r.is_nullable)
    );
  }

  const res2 = await client.query(`
    SELECT column_name, ordinal_position, data_type, column_default
    FROM information_schema.columns
    WHERE table_name = 'financial_statement_packs'
    ORDER BY ordinal_position
  `);

  console.log('\nfinancial_statement_packs columns:');
  for (const r of res2.rows) {
    console.log(
      String(r.ordinal_position).padEnd(5) +
      String(r.column_name).padEnd(35) +
      String(r.data_type).padEnd(20) +
      String(r.column_default || '')
    );
  }

  // Check actual inserted data for a specific statement
  const koRes = await client.query(`
    SELECT id, statement_type, currency, scaling, period_label, source_file_name
    FROM financial_statements
    WHERE source_file_name LIKE '%ko%' OR source_file_name LIKE '%tsla%' OR source_file_name LIKE '%bp%'
    ORDER BY source_file_name
  `);
  console.log('\nUS filing records:');
  for (const r of koRes.rows) {
    console.log(`  ${r.source_file_name} | ${r.statement_type} | currency=${r.currency} | scaling=${r.scaling} | period=${r.period_label}`);
  }

  await client.end();
}

main().catch((e) => { console.error(e.message); process.exit(1); });
