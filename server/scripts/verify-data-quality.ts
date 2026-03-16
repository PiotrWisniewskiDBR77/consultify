#!/usr/bin/env tsx
import pg from 'pg';

const DB_URL = process.env.DATABASE_URL!;

async function main() {
  const client = new pg.Client(DB_URL);
  await client.connect();

  // Key sanity checks a CFO would verify
  const checks = [
    {
      label: 'Coca-Cola 2024 Revenue (should be ~47B)',
      sql: `SELECT fsv.value, fsv.original_label, fs.currency, fs.scaling
            FROM financial_statement_values fsv
            JOIN financial_statements fs ON fsv.statement_id = fs.id
            WHERE fs.source_file_name LIKE '%ko-2025%' AND fs.statement_type = 'P&L'
              AND fsv.canonical_line_id = 'fsl-pl-revenue'
              AND (fsv.evidence_json::jsonb->>'periodIndex')::int = 0`,
    },
    {
      label: 'Coca-Cola 2024 Net Income (should be ~10.6B)',
      sql: `SELECT fsv.value, fsv.original_label, fs.currency, fs.scaling
            FROM financial_statement_values fsv
            JOIN financial_statements fs ON fsv.statement_id = fs.id
            WHERE fs.source_file_name LIKE '%ko-2025%' AND fs.statement_type = 'P&L'
              AND fsv.canonical_line_id = 'fsl-pl-net'
              AND (fsv.evidence_json::jsonb->>'periodIndex')::int = 0`,
    },
    {
      label: 'Coca-Cola 2024 Total Assets (should be ~100B)',
      sql: `SELECT fsv.value, fsv.original_label, fs.currency, fs.scaling
            FROM financial_statement_values fsv
            JOIN financial_statements fs ON fsv.statement_id = fs.id
            WHERE fs.source_file_name LIKE '%ko-2025%' AND fs.statement_type = 'BS'
              AND fsv.canonical_line_id = 'fsl-bs-total-assets'
              AND (fsv.evidence_json::jsonb->>'periodIndex')::int = 0`,
    },
    {
      label: 'Tesla 2024 Revenue (should be ~97.7B)',
      sql: `SELECT fsv.value, fsv.original_label, fs.currency, fs.scaling
            FROM financial_statement_values fsv
            JOIN financial_statements fs ON fsv.statement_id = fs.id
            WHERE fs.source_file_name LIKE '%tsla%' AND fs.statement_type = 'P&L'
              AND fsv.canonical_line_id = 'fsl-pl-revenue'
              AND (fsv.evidence_json::jsonb->>'periodIndex')::int = 0`,
    },
    {
      label: 'BMW 2024 Revenue (should be ~142.4B EUR)',
      sql: `SELECT fsv.value, fsv.original_label, fs.currency, fs.scaling
            FROM financial_statement_values fsv
            JOIN financial_statements fs ON fsv.statement_id = fs.id
            WHERE fs.source_file_name LIKE '%BMW%' AND fs.statement_type = 'P&L'
              AND fsv.canonical_line_id = 'fsl-pl-revenue'
              AND (fsv.evidence_json::jsonb->>'periodIndex')::int = 0`,
    },
    {
      label: 'Apator RS 2024 Revenue (should be in PLN thousands)',
      sql: `SELECT fsv.value, fsv.original_label, fs.currency, fs.scaling
            FROM financial_statement_values fsv
            JOIN financial_statements fs ON fsv.statement_id = fs.id
            WHERE fs.source_file_name LIKE '%Grupa Apator Raport RS 2024%' AND fs.statement_type = 'P&L'
              AND fsv.canonical_line_id = 'fsl-pl-revenue'
              AND (fsv.evidence_json::jsonb->>'periodIndex')::int = 0`,
    },
    {
      label: 'Period detection check (all documents)',
      sql: `SELECT DISTINCT fs.source_file_name, fs.period_label, fs.currency, fs.scaling
            FROM financial_statements fs
            ORDER BY fs.source_file_name`,
    },
    {
      label: 'BS equation check: Assets = Liabilities+Equity',
      sql: `WITH bs_totals AS (
              SELECT fs.source_file_name,
                     MAX(CASE WHEN fsv.canonical_line_id = 'fsl-bs-total-assets' THEN fsv.value END) as total_assets,
                     MAX(CASE WHEN fsv.canonical_line_id = 'fsl-bs-total-liabilities-equity' THEN fsv.value END) as total_le,
                     MAX(CASE WHEN fsv.canonical_line_id = 'fsl-bs-equity' THEN fsv.value END) as equity,
                     MAX(CASE WHEN fsv.canonical_line_id = 'fsl-bs-total-liabilities' THEN fsv.value END) as liabilities
              FROM financial_statement_values fsv
              JOIN financial_statements fs ON fsv.statement_id = fs.id
              WHERE fs.statement_type = 'BS' AND (fsv.evidence_json::jsonb->>'periodIndex')::int = 0
              GROUP BY fs.source_file_name
            )
            SELECT source_file_name, total_assets, total_le, equity, liabilities,
                   CASE
                     WHEN total_assets IS NOT NULL AND total_le IS NOT NULL THEN
                       CASE WHEN ABS(total_assets - total_le) / GREATEST(ABS(total_assets), 1) < 0.01 THEN 'OK' ELSE 'MISMATCH' END
                     ELSE 'INCOMPLETE'
                   END as balance_check
            FROM bs_totals
            ORDER BY source_file_name`,
    },
  ];

  for (const check of checks) {
    console.log(`\n═══ ${check.label} ═══`);
    const res = await client.query(check.sql);
    for (const row of res.rows) {
      const parts = Object.entries(row).map(([k, v]) => `${k}=${v}`);
      console.log(`  ${parts.join(' | ')}`);
    }
    if (res.rows.length === 0) console.log('  (no data)');
  }

  await client.end();
}

main().catch((e) => { console.error(e.message); process.exit(1); });
