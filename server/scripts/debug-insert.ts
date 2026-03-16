#!/usr/bin/env tsx
import pg from 'pg';
import { v4 as uuidv4 } from 'uuid';

async function main() {
  const client = new pg.Client(process.env.DATABASE_URL);
  await client.connect();

  // Check for triggers
  const triggers = await client.query(`
    SELECT trigger_name, event_manipulation, action_statement
    FROM information_schema.triggers
    WHERE event_object_table = 'financial_statements'
  `);
  console.log(`Triggers on financial_statements: ${triggers.rows.length}`);
  for (const t of triggers.rows) {
    console.log(`  ${t.trigger_name}: ${t.event_manipulation} → ${t.action_statement}`);
  }

  // Test insert with explicit USD
  const testId = uuidv4();
  console.log(`\nInserting test statement with currency=USD, id=${testId}`);
  
  await client.query(
    `INSERT INTO financial_statements (
      id, organization_id, statement_type, period_start, period_end, period_label,
      currency, scaling, source_file_name, source_file_path, parse_method, status,
      notes, overall_confidence, readiness_status, document_class, extraction_strategy,
      template_family, statement_pack_id,
      created_by, created_at, updated_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
    ON CONFLICT (id) DO NOTHING`,
    [
      testId,
      'a3e05d4a-5397-419d-b486-8e44366c0063',
      'BS',
      '2024-01-01',
      '2024-12-31',
      '2024',
      'USD',           // $7 = currency
      'millions',      // $8 = scaling
      'TEST-FILE.pdf',
      '/test/path',
      'text_extraction',
      'mapped',
      null,
      0.85,
      'ready',
      'sec_10k',
      'local_parser',
      'us_gaap',
      null,
      'debug-test',
    ]
  );

  // Read it back
  const check = await client.query(
    `SELECT id, currency, scaling, source_file_name FROM financial_statements WHERE id = $1`,
    [testId]
  );
  console.log(`Read back: currency=${check.rows[0]?.currency}, scaling=${check.rows[0]?.scaling}`);

  // Clean up test row
  await client.query(`DELETE FROM financial_statements WHERE id = $1`, [testId]);
  console.log('Test row deleted.');

  await client.end();
}

main().catch((e) => { console.error(e.message); process.exit(1); });
