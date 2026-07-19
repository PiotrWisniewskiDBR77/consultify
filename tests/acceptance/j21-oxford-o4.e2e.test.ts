/**
 * J21 — Oxford O4.2-O4.7 REAL-runtime proof.
 *
 * Question: the six financeReportAdvisory/financeReportSectionService/
 * financeParameterGuidance/financePostMortemService engines (O4.2 scenario
 * levers, O4.3 value tree, O4.4 portfolio advisory, O4.5 WACC guidance, O4.6
 * trend, O4.7 post-mortem) are BUILT — does their output actually reach a
 * real HTTP endpoint with real numbers, and does the FE render it?
 *
 * This harness answers the FIRST half live: it seeds a real financial
 * statement pack (two periods, REVENUE+NET_INCOME lines), two initiatives
 * with capex/ROI/a dependency, mounts the REAL finance-statements router and
 * the REAL v8 results router behind REAL verifyToken + v8 org-context
 * middleware, and calls the REAL HTTP endpoints. The second half (FE
 * wiring) was traced by static analysis — recorded in the accompanying
 * report, not re-derived here.
 *
 * Prefix for all rows this test writes: `odbior--j21--`.
 */
import { createServer, type Server } from 'node:http';

import express, { type Express } from 'express';
import request from 'supertest';

import { getJwtSecret, mintToken, pgClient, requireLocalDbUrl } from './harness';
import { seed, SEED } from './seed.mjs';

const PREFIX = 'odbior--j21--';
const PACK_OLD_ID = `${PREFIX}pack-old`;
const PACK_NEW_ID = `${PREFIX}pack-new`;
const STMT_OLD_ID = `${PREFIX}stmt-old`;
const STMT_NEW_ID = `${PREFIX}stmt-new`;
const INIT_A_ID = `${PREFIX}init-a`;
const INIT_B_ID = `${PREFIX}init-b`;
const KPI_ID = `${PREFIX}kpi-1`;

let app: Express;
let server: Server;
let baseUrl: string;
let token: string;

describe('J21 — Oxford O4.2-O4.7 real-runtime wiring', () => {
  beforeAll(async () => {
    requireLocalDbUrl();
    process.env.JWT_SECRET = process.env.JWT_SECRET || getJwtSecret();
    // Harness default env expected by the real routers/services.
    process.env.RUN_DB_TESTS = '1';
    process.env.MOCK_DB = 'false';
    process.env.POSTGRES_SKIP_INIT_IN_TEST = 'true';

    await seed();

    const client = pgClient();
    await client.connect();
    try {
      // ── Pre-existing DB drift workaround (NOT part of J21 scope): migration
      // 061_initiative_lifecycle.sql fails to fully apply on this parity
      // container (a pre-existing `initiative_status_history` table without
      // `changed_at` aborts the whole multi-statement file transactionally,
      // rolling back its `ALTER TABLE initiatives ADD COLUMN archived_at/
      // cancelled_at` too) — `loadPortfolioAdvisoryInputs` (O4.4) selects
      // those columns and would silently degrade to empty without them.
      // Ensuring they exist here restores the schema the app expects.
      await client.query(
        `ALTER TABLE initiatives ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP`
      );
      await client.query(
        `ALTER TABLE initiatives ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP`
      );

      // ── Same drift class, second instance: migration 917_finance_report_section.sql
      // (the seed that gives `publishFinanceReportSectionSnapshot` a
      // `report_builder_templates` row for sourceType='FINANCE_SECTION') fails on this
      // parity container with `created_by='system'` violating the FK to `users(id)` —
      // no such user exists here. Re-insert the SAME rows (same ids, verbatim from the
      // migration) with our fixture user as `created_by` so the real compose path this
      // migration exists to unlock can actually be exercised end-to-end.
      await client.query(
        `INSERT INTO report_definitions
           (id, organization_id, key, name, kind, audience, cadence, scope, read_mode, sections_json, source_binding, is_system)
         VALUES
           ('finance-section', NULL, 'finance-section', 'Sekcja finansowa raportu (wskaźniki + reconcile + EV)',
            'FINANCE_SECTION', 'CFO, Sponsor, Steering Committee', 'On demand (per pakiet sprawozdań)',
            'Jeden pakiet sprawozdań (financial_statement_packs) + opcjonalnie powiązana wycena', 'live',
            '["Nagłówek i werdykt","Tabela wskaźników (z benchmarkiem)","Wynik reconcile (R1-R8)","Koszyk EV — football field","Narracja"]'::jsonb,
            '{"service":"financeReportSectionService"}'::jsonb, TRUE)
         ON CONFLICT (id) DO NOTHING`
      );
      await client.query(
        `INSERT INTO report_builder_templates (
           id, organization_id, name, description, source_type, report_type,
           sections_json, default_options_json, is_system, is_default, is_public,
           created_by, created_at, updated_at
         ) VALUES (
           'tpl-finance-section', NULL, 'Finance — Sekcja finansowa raportu',
           'Sekcja finansowa: wskaźniki Z111 + reconcile R1-R8 + koszyk EV.',
           'FINANCE_SECTION', NULL,
           '[
             {"key":"header","type":"cover","title":"Nagłówek i werdykt","order":0,"required":true},
             {"key":"ratio_table","type":"matrix","title":"Tabela wskaźników","order":1,"required":true},
             {"key":"reconcile_result","type":"list","title":"Wynik reconcile (R1-R8)","order":2,"required":true},
             {"key":"ev_football_field","type":"matrix","title":"Koszyk EV","order":3,"required":false},
             {"key":"narrative","type":"summary","title":"Narracja","order":4,"required":false}
           ]',
           '{"length":"medium","language":"business"}',
           true, true, false,
           $1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
         )
         ON CONFLICT (id) DO UPDATE SET created_by = EXCLUDED.created_by`,
        [SEED.USER_ID]
      );

      // ── Canonical line registry (REVENUE / NET_INCOME ids for P&L).
      const { ensureCanonicalRegistryInDatabase } = await import(
        '../../server/src/services/financeCanonicalRegistrySyncService.js'
      );
      await ensureCanonicalRegistryInDatabase();

      const lineRows = await client.query<{ id: string; line_code: string }>(
        `SELECT id, line_code FROM financial_statement_lines
         WHERE statement_type = 'P&L' AND line_code IN ('REVENUE', 'NET_INCOME')`
      );
      const lineIdByCode = new Map(lineRows.rows.map((r) => [r.line_code, r.id]));
      const revenueLineId = lineIdByCode.get('REVENUE');
      const netIncomeLineId = lineIdByCode.get('NET_INCOME');
      if (!revenueLineId || !netIncomeLineId) {
        throw new Error(
          `[j21] canonical registry missing REVENUE/NET_INCOME for P&L (got: ${[...lineIdByCode.keys()].join(',')})`
        );
      }

      // ── Cleanup any leftovers from a previous aborted run (reversible prefix).
      await client.query(
        `DELETE FROM financial_statement_values WHERE statement_id IN ($1, $2)`,
        [STMT_OLD_ID, STMT_NEW_ID]
      );
      await client.query(`DELETE FROM financial_statements WHERE id IN ($1, $2)`, [
        STMT_OLD_ID,
        STMT_NEW_ID,
      ]);
      await client.query(`DELETE FROM initiative_dependencies WHERE organization_id = $1`, [
        SEED.ORG_ID,
      ]);
      await client.query(`DELETE FROM initiatives WHERE id IN ($1, $2)`, [INIT_A_ID, INIT_B_ID]);
      await client.query(`DELETE FROM v8_roi_realization_entries WHERE kpi_id = $1`, [KPI_ID]);
      await client.query(`DELETE FROM v8_kpi_finance_reconciliations WHERE kpi_id = $1`, [
        KPI_ID,
      ]);
      await client.query(`DELETE FROM v8_kpi_definitions WHERE kpi_id = $1`, [KPI_ID]);
      await client.query(`DELETE FROM financial_statement_packs WHERE id IN ($1, $2)`, [
        PACK_OLD_ID,
        PACK_NEW_ID,
      ]);

      // ── Two packs, two periods — REVENUE/NET_INCOME both periods → O4.2/O4.3
      // computable off the NEW pack, O4.6 trend computable off BOTH (≥2 periods).
      for (const [packId, stmtId, periodStart, periodEnd, periodLabel, revenue, netIncome] of [
        [PACK_OLD_ID, STMT_OLD_ID, '2024-01-01', '2024-12-31', 'FY2024', 900000, 60000],
        [PACK_NEW_ID, STMT_NEW_ID, '2025-01-01', '2025-12-31', 'FY2025', 1000000, 100000],
      ] as const) {
        await client.query(
          `INSERT INTO financial_statement_packs
             (id, organization_id, entity_name, period_start, period_end, period_label,
              currency, pack_status, pack_readiness_status, source_statement_count)
           VALUES ($1, $2, 'Odbior J21 Sp. z o.o.', $3, $4, $5, 'PLN', 'confirmed', 'ready', 1)`,
          [packId, SEED.ORG_ID, periodStart, periodEnd, periodLabel]
        );
        await client.query(
          `INSERT INTO financial_statements
             (id, organization_id, entity_name, statement_type, period_start, period_end,
              period_label, currency, status, readiness_status, statement_pack_id)
           VALUES ($1, $2, 'Odbior J21 Sp. z o.o.', 'P&L', $3, $4, $5, 'PLN', 'confirmed', 'ready', $6)`,
          [stmtId, SEED.ORG_ID, periodStart, periodEnd, periodLabel, packId]
        );
        await client.query(
          `INSERT INTO financial_statement_values
             (id, statement_id, canonical_line_id, original_label, value, confidence, mapping_status, value_origin)
           VALUES
             ($1, $2, $3, 'Przychody', $5, 1, 'manual', 'manual'),
             ($4, $2, $6, 'Wynik netto', $7, 1, 'manual', 'manual')`,
          [
            `${stmtId}-rev`,
            stmtId,
            revenueLineId,
            `${stmtId}-ni`,
            revenue,
            netIncomeLineId,
            netIncome,
          ]
        );
      }

      // ── Two initiatives with real capex+ROI+a dependency → O4.4 portfolio advisory.
      await client.query(
        `INSERT INTO initiatives
           (id, organization_id, name, status, cost_capex, expected_roi, effort, risk_level, created_at)
         VALUES
           ($1, $2, 'Odbior J21 — Automatyzacja fakturowania', 'EXECUTING', 150000, '22', 'medium', 'low', now()),
           ($3, $2, 'Odbior J21 — Ekspansja rynkowa DACH', 'PLANNING', 400000, '35', 'high', 'medium', now() + interval '1 second')`,
        [INIT_A_ID, SEED.ORG_ID, INIT_B_ID]
      );
      await client.query(
        `INSERT INTO initiative_dependencies (id, organization_id, from_initiative_id, to_initiative_id, type)
         VALUES ($1, $2, $3, $4, 'FINISH_TO_START')`,
        [`${PREFIX}dep-1`, SEED.ORG_ID, INIT_A_ID, INIT_B_ID]
      );

      // ── One KPI + one realized entry, both sides real → O4.7 post-mortem.
      await client.query(
        `INSERT INTO v8_kpi_definitions
           (kpi_id, organization_id, name, mode, initiative_id, metric_type, target_value, current_value, measurement_cadence, status)
         VALUES ($1, $2, 'Odbior J21 — Redukcja kosztu operacyjnego', 'initiative_linked', $3, 'currency', 120000, NULL, 'quarterly', 'measurement')`,
        [KPI_ID, SEED.ORG_ID, INIT_A_ID]
      );
      await client.query(
        `INSERT INTO v8_roi_realization_entries
           (entry_id, organization_id, kpi_id, initiative_id, realized_value, period)
         VALUES ($1, $2, $3, $4, 95000, '2025-Q2')`,
        [`${PREFIX}roi-1`, SEED.ORG_ID, KPI_ID, INIT_A_ID]
      );
    } finally {
      await client.end();
    }

    // ── Build an app mounting the REAL finance-statements router (behind REAL
    // verifyToken) and the REAL v8 results router (behind REAL verifyToken +
    // requireV8OrgContext), mirroring server/src/index.ts's mount points.
    const { default: verifyToken } = await import('../../server/src/middleware/auth.middleware.js');
    const { requireV8OrgContext, attachV8Context } = await import(
      '../../server/src/middleware/v8Auth.middleware.js'
    );
    const { v8OrgGate } = await import('../../server/src/middleware/v8FeatureGate.middleware.js');
    const { default: financeStatementsRouter } = await import(
      '../../server/src/routes/finance-statements.routes.js'
    );
    const { default: resultsRoutes } = await import('../../server/src/routes/v8/results.routes.js');

    app = express();
    app.use(express.json({ limit: '5mb' }));
    app.use('/api/finance-statements', verifyToken as any, financeStatementsRouter);

    const v8App = express.Router();
    v8App.use(verifyToken as any);
    v8App.use(requireV8OrgContext as any);
    v8App.use(v8OrgGate as any);
    v8App.use(attachV8Context as any);
    v8App.use('/results', resultsRoutes);
    app.use('/api/v8', v8App);

    server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    baseUrl = `http://127.0.0.1:${port}`;

    token = mintToken();
  }, 60_000);

  afterAll(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));

    const client = pgClient();
    await client.connect();
    try {
      await client.query(
        `DELETE FROM financial_statement_values WHERE statement_id IN ($1, $2)`,
        [STMT_OLD_ID, STMT_NEW_ID]
      );
      await client.query(`DELETE FROM financial_statements WHERE id IN ($1, $2)`, [
        STMT_OLD_ID,
        STMT_NEW_ID,
      ]);
      await client.query(`DELETE FROM initiative_dependencies WHERE organization_id = $1`, [
        SEED.ORG_ID,
      ]);
      await client.query(`DELETE FROM v8_roi_realization_entries WHERE kpi_id = $1`, [KPI_ID]);
      await client.query(`DELETE FROM v8_kpi_finance_reconciliations WHERE kpi_id = $1`, [
        KPI_ID,
      ]);
      await client.query(`DELETE FROM v8_kpi_definitions WHERE kpi_id = $1`, [KPI_ID]);
      await client.query(`DELETE FROM initiatives WHERE id IN ($1, $2)`, [INIT_A_ID, INIT_B_ID]);
      // Reports created by the publish call (sourceType='FINANCE_SECTION', sourceId=pack id).
      await client.query(
        `DELETE FROM report_builder_sections WHERE report_id IN (
           SELECT id FROM report_builder_reports WHERE source_type = 'FINANCE_SECTION' AND source_id = $1
         )`,
        [PACK_NEW_ID]
      );
      await client.query(
        `DELETE FROM report_builder_reports WHERE source_type = 'FINANCE_SECTION' AND source_id = $1`,
        [PACK_NEW_ID]
      );
      await client.query(`DELETE FROM financial_statement_packs WHERE id IN ($1, $2)`, [
        PACK_OLD_ID,
        PACK_NEW_ID,
      ]);
      // Best-effort: evidence envelope + snapshot rows the publish call also writes
      // (table shapes vary by migration wave on this parity container — don't fail
      // cleanup over them).
      try {
        await client.query(`DELETE FROM artifact_evidence WHERE organization_id = $1`, [
          SEED.ORG_ID,
        ]);
      } catch {
        /* best-effort */
      }
    } finally {
      await client.end();
    }
  }, 30_000);

  it('POST /packs/:id/report-section returns REAL O4.2/O4.3/O4.4/O4.6 numbers (not empty, not fabricated)', async () => {
    const res = await request(app)
      .post(`/api/finance-statements/packs/${PACK_NEW_ID}/report-section`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Odbior J21 — sekcja finansowa' });

    // eslint-disable-next-line no-console
    console.log('[j21] report-section status', res.status, JSON.stringify(res.body).slice(0, 2000));
    expect(res.status).toBe(201);
    const section = res.body.section;
    expect(section).toBeTruthy();

    // O4.2 — named scenario levers, computed off REVENUE=1,000,000 / NET_INCOME=100,000.
    expect(section.scenarios.available).toBe(true);
    expect(Array.isArray(section.scenarios.outcomes)).toBe(true);
    expect(section.scenarios.outcomes.length).toBeGreaterThan(0);
    for (const outcome of section.scenarios.outcomes) {
      expect(Number.isFinite(outcome.metric)).toBe(true);
    }
    // The status-quo lever's metric must equal the raw NET_INCOME (no invented number).
    const statusQuo = section.scenarios.outcomes.find((o: any) => o.leverId === 'status_quo');
    if (statusQuo) expect(statusQuo.metric).toBe(100000);

    // O4.3 — value tree decomposition of the recommended lever's swing.
    expect(typeof section.valueTree.available).toBe('boolean');
    if (section.valueTree.available) {
      expect(Array.isArray(section.valueTree.tree.components)).toBe(true);
      expect(section.valueTree.tree.components.length).toBeGreaterThan(0);
      expect(Number.isFinite(section.valueTree.tree.gross)).toBe(true);
      expect(section.valueTree.tree.gross).toBeGreaterThan(0);
    }

    // O4.4 — portfolio advisory over the org's OWN initiatives (real capex/ROI).
    expect(section.portfolioAdvisory.available).toBe(true);
    expect(section.portfolioAdvisory.itemCount).toBeGreaterThanOrEqual(2);
    expect(section.portfolioAdvisory.advisory).toBeTruthy();

    // O4.6 — trend over 2 real periods (FY2024 REVENUE=900k, FY2025 REVENUE=1,000,000).
    expect(section.trend.available).toBe(true);
    const revenueTrend = section.trend.lines.find((l: any) => l.lineCode === 'REVENUE');
    expect(revenueTrend).toBeTruthy();
    expect(revenueTrend.trend.periods).toBeGreaterThanOrEqual(2);
  });

  it('GET /packs/:id/report-section/lineage does NOT surface O4.2-O4.4/O4.6 (only ratio/reconcile/valuation) — confirms FE lineage panel cannot show them', async () => {
    const res = await request(app)
      .get(`/api/finance-statements/packs/${PACK_NEW_ID}/report-section/lineage`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const categories = new Set((res.body?.lineage?.entries || []).map((e: any) => e.category));
    console.log('[j21] lineage categories present:', [...categories]);
    // The ONLY FE-called finance-report endpoint never mentions scenario/value-tree/
    // portfolio/trend — those categories simply do not exist in this contract.
    expect(categories.has('scenario')).toBe(false);
    expect(categories.has('valueTree')).toBe(false);
    expect(categories.has('portfolio')).toBe(false);
    expect(categories.has('trend')).toBe(false);
  });

  it('POST /v8/results/reconciliations/pull computes REAL O4.7 post-mortem (market-vs-execution decomposition)', async () => {
    const res = await request(app)
      .post('/api/v8/results/reconciliations/pull')
      .set('Authorization', `Bearer ${token}`)
      .send({
        initiativeId: INIT_A_ID,
        mappings: [{ kpiId: KPI_ID, driverKey: 'opex_reduction', projectedValue: 120000 }],
      });

    console.log('[j21] reconciliations/pull status', res.status, JSON.stringify(res.body).slice(0, 2000));
    expect(res.status).toBe(200);
    const items = res.body?.data?.items;
    expect(Array.isArray(items)).toBe(true);
    expect(items.length).toBeGreaterThan(0);
    const item = items[0];
    expect(item.postMortem).toBeTruthy();
    // Real projected/realized pair (120000 vs 95000) → a real, non-zero variance decomposed.
    expect(item.postMortem.projected).toBe(120000);
    expect(item.postMortem.realized).toBe(95000);
  });

  // ★ FIXED (J21-fix): `resultsROIService.getReconciliationOverview` previously selected
  // `k.unit` from `v8_kpi_definitions` — a column that DOES NOT EXIST on that table (the
  // table only has `metric_type`, verified against both this parity schema and
  // `server/migrations-v2/001_baseline_20260413.sql`). Because the read used
  // `dbAll(..., { fallback: true })`, the Postgres `column ... does not exist` error was
  // swallowed and the WHOLE overview silently degraded to `items: []`. The fix selects
  // `k.metric_type AS unit` and removes the fallback-masking on this query, so the read
  // now returns the real reconciliation the previous test wrote — including the O4.7
  // post-mortem embedded in `conclusion.postMortem`. This is the read-back that
  // ReconciliationPanel.tsx (O4.7 UI) depends on.
  it('★ FIX — GET /v8/results/reconciliations returns the just-written reconciliation with conclusion.postMortem (was always-empty via swallowed k.unit error)', async () => {
    // Ensure the reconciliation row exists (the pull test writes it; re-run pull here so
    // this case is order-independent).
    await request(app)
      .post('/api/v8/results/reconciliations/pull')
      .set('Authorization', `Bearer ${token}`)
      .send({
        initiativeId: INIT_A_ID,
        mappings: [{ kpiId: KPI_ID, driverKey: 'opex_reduction', projectedValue: 120000 }],
      });

    const res = await request(app)
      .get('/api/v8/results/reconciliations')
      .query({ initiativeId: INIT_A_ID })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const items = res.body?.data?.items || [];
    console.log('[j21] reconciliations GET items.length =', items.length, '(expected ≥1 after fix)');
    // The core assertion of the fix: the read is no longer silently empty.
    expect(items.length).toBeGreaterThan(0);

    const item = items.find((i: any) => i.kpiId === KPI_ID) || items[0];
    expect(item).toBeTruthy();
    // metric_type surfaces as `unit` (currency) — proves the corrected column resolves.
    expect(item.unit).toBe('currency');
    // Engine-persisted reconciliation → conclusion parsed, carrying the O4.7 post-mortem.
    expect(item.engineReconciled).toBe(true);
    expect(item.conclusion).toBeTruthy();
    expect(item.conclusion.postMortem).toBeTruthy();
    expect(item.conclusion.postMortem.projected).toBe(120000);
    expect(item.conclusion.postMortem.realized).toBe(95000);
    expect(typeof item.conclusion.postMortem.verdict).toBe('string');
  });
});
