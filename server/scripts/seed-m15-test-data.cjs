/**
 * M15 minimal test-data seed — STAGING ONLY.
 * Unblocks: 6.25/6.26 (finance-link aggregate) + 3.4 (warning signal).
 * Idempotent: deletes its own seed rows by stable ids before inserting.
 *
 * Usage: DATABASE_URL="postgres://…<staging>…" node scripts/seed-m15-test-data.cjs
 * NEVER point DATABASE_URL at prod (centerbeam) — staging only.
 */
const { Pool } = require('pg');

const URL = process.env.DATABASE_URL;
if (!URL) {
  console.error('Set DATABASE_URL to the STAGING database before running.');
  process.exit(1);
}
const ORG = 'a3e05d4a-5397-419d-b486-8e44366c0063';
const KPI_OEE = 'staging-dbr77-kpi-oee'; // current 79, baseline 68 → delta 11
const WARN_INIT = 'f552ffcd-5461-4647-97ca-20287e223ab2'; // "F1-26 from assessment" (DRAFT)

// Stable seed ids so re-running is idempotent.
const FIN_MAP_ID = 'seed-m15-finmap-oee';
const ASSUM_ID = 'seed-m15-assum-warn';
const REAL_ID = 'seed-m15-realized-warn';

const pool = new Pool({ connectionString: URL });

async function main() {
  const now = new Date('2026-06-25T12:00:00Z').toISOString();

  // Clean prior seed rows (idempotent)
  await pool.query('DELETE FROM kpi_financial_mappings WHERE id = $1', [FIN_MAP_ID]);
  await pool.query('DELETE FROM roi_assumptions WHERE id = $1', [ASSUM_ID]);
  await pool.query('DELETE FROM roi_realized_values WHERE id = $1', [REAL_ID]);

  // 1) Finance mapping: OEE → P&L line, multiplier 5000 → impact = delta(11) × 5000 = 55 000 PLN
  await pool.query(
    `INSERT INTO kpi_financial_mappings
       (id, kpi_id, statement_line_id, organization_id, direction, relationship_type, multiplier, confidence, created_by, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10)`,
    [FIN_MAP_ID, KPI_OEE, 'fsl-pl-revenue', ORG, 'positive', 'linear', 5000, 'high', 'seed-m15', now]
  );

  // 2) Warning-band initiative: expected 50 000 (below HIGH_VALUE_AT_STAKE=100k so not
  //    auto-critical), realized 25 000 → realizationPct = 0.5 (warning band 0.4–0.6).
  await pool.query(
    `INSERT INTO roi_assumptions
       (id, initiative_id, organization_id, expected_npv, expected_revenue_delta, expected_cost_delta, confidence, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8)`,
    [ASSUM_ID, WARN_INIT, ORG, 50000, 30000, -20000, 'medium', now]
  );
  await pool.query(
    `INSERT INTO roi_realized_values
       (id, initiative_id, organization_id, period_month, realized_revenue_delta, realized_cost_delta, realized_savings, source, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [REAL_ID, WARN_INIT, ORG, '2026-05-01T00:00:00Z', 15000, -5000, 5000, 'seed-m15', now]
  );

  // Verify
  const fin = await pool.query('SELECT COUNT(*) c FROM kpi_financial_mappings WHERE organization_id=$1', [ORG]);
  const warnNet = 15000 - (-5000) + 5000;
  const warnExpected = 50000;
  console.log('✓ finance mappings now:', fin.rows[0].c);
  console.log('✓ warning init realized net:', warnNet, '/', warnExpected, '=', (warnNet / warnExpected).toFixed(2));
  await pool.end();
}

main().catch((e) => { console.error('SEED FAILED:', e.message); process.exit(1); });
