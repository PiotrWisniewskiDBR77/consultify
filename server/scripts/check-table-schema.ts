#!/usr/bin/env tsx
import pg from 'pg';

const DB_URL = process.env.DATABASE_URL || '';

async function main() {
  const client = new pg.Client(DB_URL);
  await client.connect();

  for (const table of ['financial_statement_packs', 'financial_statements', 'financial_statement_values']) {
    const cols = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = $1
      ORDER BY ordinal_position
    `, [table]);
    console.log(`\n=== ${table} (${cols.rows.length} columns) ===`);
    for (const c of cols.rows) {
      console.log(`  ${c.column_name} ${c.data_type} ${c.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'} ${c.column_default ? `DEFAULT ${c.column_default}` : ''}`);
    }
  }

  // Try a simple pack insert
  console.log('\n--- Test pack insert ---');
  try {
    await client.query(`
      INSERT INTO financial_statement_packs (id, organization_id, source_file_name, created_at)
      VALUES ('test-pack-xyz', 'a3e05d4a-5397-419d-b486-8e44366c0063', 'test.pdf', CURRENT_TIMESTAMP)
    `);
    console.log('Pack insert OK');
    await client.query(`DELETE FROM financial_statement_packs WHERE id = 'test-pack-xyz'`);
    console.log('Pack cleanup OK');
  } catch (e: any) {
    console.log('Pack insert FAILED:', e.message);
  }

  await client.end();
}

main().catch((e) => console.error(e.message));
