#!/usr/bin/env tsx
import pg from 'pg';

async function main() {
  const dbUrl = process.env.DATABASE_URL || '';
  const host = dbUrl.match(/@([^:\/]+)/)?.[1] || 'unknown';
  console.log(`Connecting to: ${host}`);
  const client = new pg.Client(dbUrl);
  await client.connect();

  const res = await client.query(`
    SELECT source_file_name, statement_type, currency, scaling, period_label, created_at
    FROM financial_statements
    ORDER BY source_file_name, statement_type
  `);

  console.log('Source File'.padEnd(50) + 'Type'.padEnd(6) + 'Curr'.padEnd(6) + 'Scale'.padEnd(12) + 'Period'.padEnd(8) + 'Created');
  console.log('-'.repeat(110));
  for (const r of res.rows) {
    console.log(
      String(r.source_file_name).padEnd(50) +
      String(r.statement_type).padEnd(6) +
      String(r.currency).padEnd(6) +
      String(r.scaling).padEnd(12) +
      String(r.period_label).padEnd(8) +
      String(r.created_at)
    );
  }
  console.log(`\nTotal: ${res.rows.length} statements`);
  await client.end();
}

main().catch((e) => { console.error(e.message); process.exit(1); });
