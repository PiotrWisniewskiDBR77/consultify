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
const HIGH_INIT = '6e41f39e-f296-56ae-b454-f183ef65e766'; // "Data Analytics Platform"
const MID_INIT = 'b3ce5329-b9db-49d1-bf63-c8a6ade13688'; // "F3 Rich Card Initiative"

// Stable seed ids so re-running is idempotent.
const FIN_MAP_ID = 'seed-m15-finmap-oee';
const ASSUM_ID = 'seed-m15-assum-warn';
const REAL_ID = 'seed-m15-realized-warn';
// D4 ADKAR adoption seed (sentiment + champions) — varied so adoption/DICE differ.
// Stable UUID literals (these tables use uuid PKs).
const SENT_IDS = [
  'a15d0000-0000-4000-8000-000000000001',
  'a15d0000-0000-4000-8000-000000000002',
  'a15d0000-0000-4000-8000-000000000003',
];
const CHAMP_IDS = [
  'a15c0000-0000-4000-8000-000000000001',
  'a15c0000-0000-4000-8000-000000000002',
  'a15c0000-0000-4000-8000-000000000003',
];

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

  // 3) D4 — ADKAR adoption signals (change_sentiment_snapshots + change_champions).
  //    Varied so adoptionScore/DICE/at-risk differ across initiatives.
  for (const id of SENT_IDS) await pool.query('DELETE FROM change_sentiment_snapshots WHERE id = $1', [id]);
  for (const id of CHAMP_IDS) await pool.query('DELETE FROM change_champions WHERE id = $1', [id]);

  const pStart = '2026-04-01T00:00:00Z';
  const pEnd = '2026-06-01T00:00:00Z';
  // HIGH: avg 4.6/5 → adoption ~0.90, improving, 2 champions → win zone
  await pool.query(
    `INSERT INTO change_sentiment_snapshots (id, organization_id, initiative_id, period_start, period_end, avg_rating, total_responses, trend, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [SENT_IDS[0], ORG, HIGH_INIT, pStart, pEnd, 4.6, 24, 'improving', now]
  );
  await pool.query(
    `INSERT INTO change_champions (id, organization_id, initiative_id, role, status, created_at)
     VALUES ($1,$2,$3,$4,$5,$6), ($7,$2,$3,$8,$5,$6)`,
    [CHAMP_IDS[0], ORG, HIGH_INIT, 'lead', 'active', now, CHAMP_IDS[1], 'sponsor']
  );
  // LOW: avg 1.8/5 → adoption ~0.20, declining, 0 champions → woe + at-risk
  await pool.query(
    `INSERT INTO change_sentiment_snapshots (id, organization_id, initiative_id, period_start, period_end, avg_rating, total_responses, trend, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [SENT_IDS[1], ORG, WARN_INIT, pStart, pEnd, 1.8, 18, 'declining', now]
  );
  // MID: avg 3.2/5 → adoption ~0.55, stable, 1 champion → worry
  await pool.query(
    `INSERT INTO change_sentiment_snapshots (id, organization_id, initiative_id, period_start, period_end, avg_rating, total_responses, trend, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [SENT_IDS[2], ORG, MID_INIT, pStart, pEnd, 3.2, 15, 'stable', now]
  );
  await pool.query(
    `INSERT INTO change_champions (id, organization_id, initiative_id, role, status, created_at)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [CHAMP_IDS[2], ORG, MID_INIT, 'lead', 'active', now]
  );

  // 4) D10 — OKR cascade (objectives → key results). Create tables if absent
  //    (mirrors the route's lazy-DDL) so the seed is self-contained.
  await pool.query(`CREATE TABLE IF NOT EXISTS okr_objectives (
    id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, project_id TEXT,
    label TEXT NOT NULL, parent_id TEXT, created_at TIMESTAMPTZ DEFAULT now())`);
  await pool.query(`CREATE TABLE IF NOT EXISTS okr_key_results (
    id TEXT PRIMARY KEY, objective_id TEXT NOT NULL, organization_id TEXT NOT NULL,
    label TEXT NOT NULL, baseline DOUBLE PRECISION, target DOUBLE PRECISION,
    current DOUBLE PRECISION, weight DOUBLE PRECISION, created_at TIMESTAMPTZ DEFAULT now())`);
  await pool.query('DELETE FROM okr_key_results WHERE organization_id=$1 AND id LIKE $2', [ORG, 'seed-m15-kr-%']);
  await pool.query('DELETE FROM okr_objectives WHERE organization_id=$1 AND id LIKE $2', [ORG, 'seed-m15-obj-%']);

  const OBJ_PARENT = 'seed-m15-obj-parent';
  const OBJ_C1 = 'seed-m15-obj-c1';
  const OBJ_C2 = 'seed-m15-obj-c2';
  await pool.query(
    `INSERT INTO okr_objectives (id, organization_id, label, parent_id) VALUES
       ($1,$2,'Transformacja cyfrowa 2026',NULL),
       ($3,$2,'Zwiększyć efektywność operacyjną',$1),
       ($4,$2,'Poprawić doświadczenie klienta',$1)`,
    [OBJ_PARENT, ORG, OBJ_C1, OBJ_C2]
  );
  // Child 1 KRs (strong progress), Child 2 KRs (weak → at-risk)
  await pool.query(
    `INSERT INTO okr_key_results (id, objective_id, organization_id, label, baseline, target, current, weight) VALUES
       ('seed-m15-kr-1',$1,$3,'OEE z 68% do 85%',68,85,79,1),
       ('seed-m15-kr-2',$1,$3,'On-Time Delivery do 95%',80,95,93,1),
       ('seed-m15-kr-3',$2,$3,'NPS z 20 do 50',20,50,28,1),
       ('seed-m15-kr-4',$2,$3,'Czas obsługi -30%',100,70,95,1)`,
    [OBJ_C1, OBJ_C2, ORG]
  );

  // Verify
  const fin = await pool.query('SELECT COUNT(*) c FROM kpi_financial_mappings WHERE organization_id=$1', [ORG]);
  const okr = await pool.query('SELECT COUNT(*) c FROM okr_objectives WHERE organization_id=$1', [ORG]);
  const sent = await pool.query('SELECT COUNT(*) c FROM change_sentiment_snapshots WHERE organization_id=$1', [ORG]);
  const champ = await pool.query('SELECT COUNT(*) c FROM change_champions WHERE organization_id=$1', [ORG]);
  const warnNet = 15000 - (-5000) + 5000;
  const warnExpected = 50000;
  console.log('✓ finance mappings now:', fin.rows[0].c);
  console.log('✓ warning init realized net:', warnNet, '/', warnExpected, '=', (warnNet / warnExpected).toFixed(2));
  console.log('✓ ADKAR sentiment rows:', sent.rows[0].c, '· champions:', champ.rows[0].c);
  console.log('✓ OKR objectives:', okr.rows[0].c, '(1 parent + 2 children, 4 KRs)');
  await pool.end();
}

main().catch((e) => { console.error('SEED FAILED:', e.message); process.exit(1); });
