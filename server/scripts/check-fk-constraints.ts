#!/usr/bin/env tsx
import pg from 'pg';

const DB_URL = process.env.DATABASE_URL || '';

async function main() {
  const client = new pg.Client(DB_URL);
  await client.connect();

  const fks = await client.query(`
    SELECT tc.constraint_name, kcu.column_name,
           ccu.table_name AS foreign_table_name,
           ccu.column_name AS foreign_column_name
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name
    WHERE tc.table_name = 'financial_statements' AND tc.constraint_type = 'FOREIGN KEY'
  `);
  console.log('FK constraints on financial_statements:');
  for (const r of fks.rows) console.log('  ', r.column_name, '->', r.foreign_table_name + '.' + r.foreign_column_name, `(${r.constraint_name})`);

  const fkvs = await client.query(`
    SELECT tc.constraint_name, kcu.column_name,
           ccu.table_name AS foreign_table_name,
           ccu.column_name AS foreign_column_name
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name
    WHERE tc.table_name = 'financial_statement_values' AND tc.constraint_type = 'FOREIGN KEY'
  `);
  console.log('\nFK constraints on financial_statement_values:');
  for (const r of fkvs.rows) console.log('  ', r.column_name, '->', r.foreign_table_name + '.' + r.foreign_column_name, `(${r.constraint_name})`);

  const counts = await client.query(`
    SELECT
      (SELECT COUNT(*) FROM financial_statement_packs) AS packs,
      (SELECT COUNT(*) FROM financial_statements) AS stmts,
      (SELECT COUNT(*) FROM financial_statement_values) AS vals
  `);
  console.log('\nCurrent counts:', counts.rows[0]);

  await client.end();
}

main().catch((e) => console.error(e.message));
