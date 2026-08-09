/**
 * WP-D04 — `kpiComputeService` known-answer + negative-denominator test,
 * real PostgreSQL integration test.
 *
 * Same env-var / isolation contract as this repo's other `.pg.test.ts`
 * suites (`RUN_DB_TESTS=1`, `MOCK_DB=false`, `DATABASE_URL=postgresql://...`,
 * `describe.skipIf`-gated) — see `statementServices.pg.test.ts` in this same
 * directory for the pattern this file follows.
 *
 * KNOWN-ANSWER DATA: GoldCo Manufacturing S.A. ("PARENT") standalone FY2025,
 * taken verbatim from `docs/validation/finance-v3/generated/gate-d/goldco/
 * goldco_oracle.ts` (the Fala 3 gold-vertical-slice INDEPENDENT oracle —
 * that file does its own arithmetic by hand, imports zero pipeline/service
 * code). This test does NOT import `goldco_oracle.ts` or run
 * `formulaAstEvaluator` to produce the "expected" numbers — per this work
 * package's own brief ("NIE używaj tego samego formulaAstEvaluator do
 * wyliczenia oczekiwanej wartości, to byłoby testowanie kodu samym sobą"),
 * the expected values below are transcribed as plain arithmetic in this
 * file's own comments, independently of both the oracle file and the
 * production code under test:
 *
 *   PARENT FY2025 (raw, from goldco_oracle.ts `parent.FY2025`):
 *     revenue=182,000,000  cogs=118,000,000  cfo=15,000,000
 *     cash=11,000,000  ar=26,000,000  inventory=19,500,000  ap=17,500,000
 *     longTermDebt=40,500,000
 *   PARENT FY2024_restated (from goldco_oracle.ts, restated inventory/cogs):
 *     ar=24,000,000
 *
 *   Derived (oracle's own `derivePL`/`deriveBS`/`withEquityPlug` formulas,
 *   re-derived here independently, same arithmetic, no shared code):
 *     grossMargin(FY2025)      = revenue - cogs = 182,000,000 - 118,000,000 = 64,000,000
 *     currentAssets(FY2025)    = cash+ar+inventory = 11,000,000+26,000,000+19,500,000 = 56,500,000
 *     currentLiabilities(FY2025) = ap = 17,500,000
 *     totalAssets(FY2025)      = currentAssets + fixedAssets(101,500,000) = 158,000,000
 *     totalLiabilities(FY2025) = currentLiabilities + longTermDebt = 17,500,000+40,500,000 = 58,000,000
 *     equity(FY2025)           = totalAssets - totalLiabilities (plug) = 158,000,000-58,000,000 = 100,000,000
 *     netIncome(FY2025)        = ((( revenue-cogs-opex(34,000,000) )-depreciation(7,000,000) )-interest(2,000,000))-taxExpense(3,990,000)
 *                               = ((64,000,000-34,000,000)-7,000,000-2,000,000)-3,990,000
 *                               = (30,000,000-7,000,000-2,000,000)-3,990,000 = 21,000,000-3,990,000 = 17,010,000
 *     equity(FY2024_restated)  = 89,500,000 (oracle's own restated totalAssets 148,000,000 - totalLiabilities 58,500,000)
 *
 *   The 6 P0 KPI this test computes (by hand, NOT via formulaAstEvaluator):
 *     CURRENT_RATIO            = 56,500,000 / 17,500,000            = 3.2285714285714286
 *     GROSS_MARGIN_PCT         = 64,000,000 / 182,000,000            = 0.35164835164835167
 *     DEBT_TO_EQUITY           = 40,500,000 / 100,000,000            = 0.405
 *     DSO                      = AR_avg*DAYS/REVENUE, AR_avg=(26,000,000+24,000,000)/2=25,000,000,
 *                                 DAYS=365 (FY2025 non-leap) -> 25,000,000*365/182,000,000 = 50.13736263736264
 *     OPERATING_CASH_FLOW_MARGIN = 15,000,000 / 182,000,000          = 0.08241758241758242
 *     ROE                      = 17,010,000 / EQUITY_avg, EQUITY_avg=(100,000,000+89,500,000)/2=94,750,000
 *                                 -> 17,010,000/94,750,000 = 0.17952770448549075
 */
import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const CONNECTION_STRING = process.env.DATABASE_URL ?? '';
const REAL_PG_REQUESTED =
  process.env.RUN_DB_TESTS === '1' && process.env.MOCK_DB === 'false' && CONNECTION_STRING.startsWith('postgres');
if (REAL_PG_REQUESTED) {
  process.env.DB_TYPE = 'postgres';
}
const REAL_PG = REAL_PG_REQUESTED;

describe.skipIf(!REAL_PG)('WP-D04 kpiComputeService — real PostgreSQL known-answer test', () => {
  let withPinnedPostgresTransaction: typeof import('../../../../database/PostgresDatabase.js').withPinnedPostgresTransaction;
  let artifactVersionService: typeof import('../artifactVersionService.js');
  let lineageService: typeof import('../lineageService.js');
  let kpiComputeService: typeof import('../kpiComputeService.js');

  const orgId = `org-finv3-d04-${randomUUID()}`;
  const preparerId = `user-preparer-${randomUUID()}`;
  const approverId = `user-approver-${randomUUID()}`;
  let calendarId = '';
  let fy2024PeriodId = '';
  let fy2025PeriodId = '';
  let catalogIdByCode: Map<string, string>;

  async function makeStatementPack() {
    return artifactVersionService.createArtifact({ organizationId: orgId, artifactType: 'STATEMENT_PACK', createdBy: preparerId });
  }

  async function makeAnalysis() {
    return artifactVersionService.createArtifact({ organizationId: orgId, artifactType: 'HISTORICAL_ANALYSIS', createdBy: preparerId });
  }

  async function makeEntity(businessVersionId: string, entityCode: string) {
    const row = await withPinnedPostgresTransaction((tx) =>
      tx.queryOne<{ id: string }>(
        `INSERT INTO finance_stmt_entities (
           organization_id, business_version_id, entity_code, legal_name, role,
           consolidation_method, ownership_pct, functional_currency, created_by
         ) VALUES (?, ?, ?, ?, 'GROUP_PARENT', 'NOT_CONSOLIDATED', NULL, 'PLN', ?)
         RETURNING id`,
        [orgId, businessVersionId, entityCode, `${entityCode} legal name`, preparerId]
      )
    );
    if (!row) throw new Error('finance_stmt_entities fixture insert returned no row');
    return row.id;
  }

  /** Writes one canonical-line cell directly into `finance_stmt_lines` — this test does not go
   *  through `statementMappingService` (no raw-label mapping concern here), same shortcut
   *  `statementServices.pg.test.ts`'s sibling suites use when only the cell matters. Every P0 KPI
   *  seed formula uses `consolidationScope: 'CONSOLIDATED'` on every `cell_ref` operand (see
   *  `20260809_finance_v3_d03_analysis_03_kpi_p0_catalog.sql`) even for a single-entity,
   *  standalone-only Statement Pack Version like this one — there is no "group" to consolidate,
   *  but the schema's `consolidation_scope` still has to say `'CONSOLIDATED'` for the P0 formulas
   *  to find the cell at all, so every row below is written with that scope. */
  async function writeLine(businessVersionId: string, entityId: string, periodId: string, lineCode: string, statementType: 'P&L' | 'BS' | 'CF', value: number) {
    const line = await withPinnedPostgresTransaction((tx) =>
      tx.queryOne<{ id: string }>(`SELECT id FROM financial_statement_lines WHERE line_code = ? AND organization_id IS NULL LIMIT 1`, [lineCode])
    );
    if (!line) throw new Error(`financial_statement_lines seed row not found for line_code=${lineCode}`);
    await withPinnedPostgresTransaction((tx) =>
      tx.queryRun(
        `INSERT INTO finance_stmt_lines (
           organization_id, business_version_id, statement_type, canonical_line_id, entity_id, period_id,
           accumulation_basis, consolidation_scope, value_status, value_decimal, native_currency,
           presentation_currency, unit, sign_convention, accounting_policy, created_by
         ) VALUES (?, ?, ?, ?, ?, ?, 'FULL_YEAR', 'CONSOLIDATED', 'PRESENT_NONZERO', ?, 'PLN', 'PLN', 'UNITS', 'NATURAL', 'IFRS', ?)`,
        [orgId, businessVersionId, statementType, line.id, entityId, periodId, value, preparerId]
      )
    );
  }

  beforeAll(async () => {
    ({ withPinnedPostgresTransaction } = await import('../../../../database/PostgresDatabase.js'));
    artifactVersionService = await import('../artifactVersionService.js');
    lineageService = await import('../lineageService.js');
    kpiComputeService = await import('../kpiComputeService.js');

    await withPinnedPostgresTransaction((tx) => tx.queryRun(`INSERT INTO organizations (id, name) VALUES (?, ?)`, [orgId, 'FinV3 D04 Test Org']));

    const cal = await withPinnedPostgresTransaction((tx) =>
      tx.queryOne<{ fiscal_calendar_id: string }>(
        `INSERT INTO finance_stmt_calendars (organization_id, calendar_type, fiscal_year_end_month, effective_from, created_by)
         VALUES (?, 'STANDARD', 12, '2020-01-01', ?) RETURNING fiscal_calendar_id`,
        [orgId, preparerId]
      )
    );
    if (!cal) throw new Error('finance_stmt_calendars fixture insert returned no row');
    calendarId = cal.fiscal_calendar_id;

    const per2024 = await withPinnedPostgresTransaction((tx) =>
      tx.queryOne<{ period_id: string }>(
        `INSERT INTO finance_stmt_periods (organization_id, fiscal_calendar_id, period_type, fiscal_year, period_start, period_end, label, created_by)
         VALUES (?, ?, 'FY', 2024, '2024-01-01', '2024-12-31', 'FY2024', ?) RETURNING period_id`,
        [orgId, calendarId, preparerId]
      )
    );
    if (!per2024) throw new Error('finance_stmt_periods FY2024 insert returned no row');
    fy2024PeriodId = per2024.period_id;

    const per2025 = await withPinnedPostgresTransaction((tx) =>
      tx.queryOne<{ period_id: string }>(
        `INSERT INTO finance_stmt_periods (organization_id, fiscal_calendar_id, period_type, fiscal_year, period_start, period_end, label, previous_period_id, created_by)
         VALUES (?, ?, 'FY', 2025, '2025-01-01', '2025-12-31', 'FY2025', ?, ?) RETURNING period_id`,
        [orgId, calendarId, fy2024PeriodId, preparerId]
      )
    );
    if (!per2025) throw new Error('finance_stmt_periods FY2025 insert returned no row');
    fy2025PeriodId = per2025.period_id;

    const catalogRows = await withPinnedPostgresTransaction((tx) =>
      tx.queryAll<{ id: string; kpi_code: string }>(`SELECT id, kpi_code FROM finance_analysis_kpi_catalog WHERE status = 'ACTIVE'`)
    );
    catalogIdByCode = new Map(catalogRows.map((r) => [r.kpi_code, r.id]));
    expect(catalogIdByCode.size).toBe(18); // sanity: WP-D03b's 18 P0 seed rows are present
  });

  describe('6 KPI across 6 different categories, GoldCo PARENT standalone FY2025', () => {
    it('CURRENT_RATIO / GROSS_MARGIN_PCT / DEBT_TO_EQUITY / DSO / OPERATING_CASH_FLOW_MARGIN / ROE match hand-computed oracle values', async () => {
      const pack = await makeStatementPack();
      const packBvId = pack.businessVersion.business_version_id;
      const entityId = await makeEntity(packBvId, 'PARENT');

      // FY2025 raw + subtotal lines (see file header for the oracle arithmetic these come from).
      await writeLine(packBvId, entityId, fy2025PeriodId, 'REVENUE', 'P&L', 182_000_000);
      await writeLine(packBvId, entityId, fy2025PeriodId, 'GROSS_MARGIN', 'P&L', 64_000_000);
      await writeLine(packBvId, entityId, fy2025PeriodId, 'NET_INCOME', 'P&L', 17_010_000);
      await writeLine(packBvId, entityId, fy2025PeriodId, 'CFO', 'CF', 15_000_000);
      await writeLine(packBvId, entityId, fy2025PeriodId, 'CURRENT_ASSETS', 'BS', 56_500_000);
      await writeLine(packBvId, entityId, fy2025PeriodId, 'CURRENT_LIABILITIES', 'BS', 17_500_000);
      await writeLine(packBvId, entityId, fy2025PeriodId, 'LONG_TERM_DEBT', 'BS', 40_500_000);
      await writeLine(packBvId, entityId, fy2025PeriodId, 'EQUITY', 'BS', 100_000_000);
      await writeLine(packBvId, entityId, fy2025PeriodId, 'AR', 'BS', 26_000_000);
      // FY2024 (restated) prior-period lines needed only for AVERAGE_BALANCE KPI (DSO, ROE).
      await writeLine(packBvId, entityId, fy2024PeriodId, 'AR', 'BS', 24_000_000);
      await writeLine(packBvId, entityId, fy2024PeriodId, 'EQUITY', 'BS', 89_500_000);

      const analysis = await makeAnalysis();
      const analysisBvId = analysis.businessVersion.business_version_id;

      await withPinnedPostgresTransaction((tx) =>
        tx.queryRun(
          `INSERT INTO finance_analysis_definitions (
             organization_id, business_version_id, purpose, analysis_type, entity_scope_mode, presentation_currency, unit, created_by
           ) VALUES (?, ?, 'INTERNAL_REVIEW', 'STANDARD', 'GROUP_CONSOLIDATED', 'PLN', 'UNITS', ?)`,
          [orgId, analysisBvId, preparerId]
        )
      );

      const edge = await lineageService.insertEdge({
        organizationId: orgId,
        sourceVersionId: packBvId,
        sourceArtifactType: 'STATEMENT_PACK',
        targetVersionId: analysisBvId,
        targetArtifactType: 'HISTORICAL_ANALYSIS',
        edgeType: 'STATEMENT_TO_ANALYSIS',
        transformationKind: 'MANUAL_LINK',
        authorId: preparerId,
      });
      expect(edge.ok).toBe(true);

      const kpiCodes = ['CURRENT_RATIO', 'GROSS_MARGIN_PCT', 'DEBT_TO_EQUITY', 'DSO', 'OPERATING_CASH_FLOW_MARGIN', 'ROE'];
      for (const code of kpiCodes) {
        const catalogId = catalogIdByCode.get(code);
        if (!catalogId) throw new Error(`catalog row not found for ${code}`);
        await withPinnedPostgresTransaction((tx) =>
          tx.queryRun(
            `INSERT INTO finance_analysis_kpi_values (organization_id, business_version_id, kpi_catalog_id, entity_id, period_id)
             VALUES (?, ?, ?, ?, ?)`,
            [orgId, analysisBvId, catalogId, entityId, fy2025PeriodId]
          )
        );
      }

      const computed = await kpiComputeService.computeAnalysisKpis({
        organizationId: orgId,
        businessVersionId: analysisBvId,
        requestedByUserId: preparerId,
      });
      expect(computed.ok).toBe(true);
      if (!computed.ok) throw new Error('unreachable');
      expect(computed.results).toHaveLength(6);

      const byCode = new Map(computed.results.map((r) => [r.kpiCode, r]));

      const EXPECTED: Record<string, number> = {
        CURRENT_RATIO: 56_500_000 / 17_500_000,
        GROSS_MARGIN_PCT: 64_000_000 / 182_000_000,
        DEBT_TO_EQUITY: 40_500_000 / 100_000_000,
        DSO: ((26_000_000 + 24_000_000) / 2) * 365 / 182_000_000,
        OPERATING_CASH_FLOW_MARGIN: 15_000_000 / 182_000_000,
        ROE: 17_010_000 / ((100_000_000 + 89_500_000) / 2),
      };

      for (const code of kpiCodes) {
        const result = byCode.get(code);
        expect(result, `no compute result for ${code}`).toBeTruthy();
        expect(result!.status).toBe('PRESENT_NONZERO');
        expect(result!.qualityFlag).toBeNull();
        expect(result!.value).toBeCloseTo(EXPECTED[code], 6);
      }

      // Confirm the DB rows themselves, not just the service's in-memory return value.
      for (const code of kpiCodes) {
        const catalogId = catalogIdByCode.get(code)!;
        const row = await withPinnedPostgresTransaction((tx) =>
          tx.queryOne<{ value_status: string; value_decimal: string; quality_flag: string | null }>(
            `SELECT value_status, value_decimal, quality_flag FROM finance_analysis_kpi_values
              WHERE business_version_id = ? AND kpi_catalog_id = ?`,
            [analysisBvId, catalogId]
          )
        );
        expect(row?.value_status).toBe('PRESENT_NONZERO');
        expect(row?.quality_flag).toBeNull();
        expect(Number(row?.value_decimal)).toBeCloseTo(EXPECTED[code], 6);
      }
    });
  });

  describe('negative denominator — explicit quality_flag, never a misleading bare number', () => {
    it('DEBT_TO_EQUITY (SHOW_WITH_FLAG) with negative equity: keeps the correctly-signed value AND sets quality_flag=NEGATIVE_DENOMINATOR', async () => {
      const pack = await makeStatementPack();
      const packBvId = pack.businessVersion.business_version_id;
      const entityId = await makeEntity(packBvId, 'DISTRESSED');

      // A distressed company: liabilities exceed assets -> equity is negative. LONG_TERM_DEBT=10M,
      // EQUITY=-5M -> a naive DEBT_TO_EQUITY=10M/-5M=-2 is arithmetically correct but MISLEADING
      // if shown bare (looks like "low leverage", the opposite of reality) — the whole point of
      // ADR section 6.5 / addendum's "canonical negative-denominator trap".
      await writeLine(packBvId, entityId, fy2025PeriodId, 'LONG_TERM_DEBT', 'BS', 10_000_000);
      await writeLine(packBvId, entityId, fy2025PeriodId, 'EQUITY', 'BS', -5_000_000);

      const analysis = await makeAnalysis();
      const analysisBvId = analysis.businessVersion.business_version_id;
      await withPinnedPostgresTransaction((tx) =>
        tx.queryRun(
          `INSERT INTO finance_analysis_definitions (
             organization_id, business_version_id, purpose, analysis_type, entity_scope_mode, presentation_currency, unit, created_by
           ) VALUES (?, ?, 'INTERNAL_REVIEW', 'STANDARD', 'GROUP_CONSOLIDATED', 'PLN', 'UNITS', ?)`,
          [orgId, analysisBvId, preparerId]
        )
      );
      const edge = await lineageService.insertEdge({
        organizationId: orgId,
        sourceVersionId: packBvId,
        sourceArtifactType: 'STATEMENT_PACK',
        targetVersionId: analysisBvId,
        targetArtifactType: 'HISTORICAL_ANALYSIS',
        edgeType: 'STATEMENT_TO_ANALYSIS',
        transformationKind: 'MANUAL_LINK',
        authorId: preparerId,
      });
      expect(edge.ok).toBe(true);

      const catalogId = catalogIdByCode.get('DEBT_TO_EQUITY')!;
      await withPinnedPostgresTransaction((tx) =>
        tx.queryRun(
          `INSERT INTO finance_analysis_kpi_values (organization_id, business_version_id, kpi_catalog_id, entity_id, period_id)
           VALUES (?, ?, ?, ?, ?)`,
          [orgId, analysisBvId, catalogId, entityId, fy2025PeriodId]
        )
      );

      const computed = await kpiComputeService.computeAnalysisKpis({
        organizationId: orgId,
        businessVersionId: analysisBvId,
        requestedByUserId: preparerId,
      });
      expect(computed.ok).toBe(true);
      if (!computed.ok) throw new Error('unreachable');

      const result = computed.results[0];
      expect(result.kpiCode).toBe('DEBT_TO_EQUITY');
      expect(result.status).toBe('PRESENT_NONZERO'); // NOT hidden as NOT_APPLICABLE — SHOW_WITH_FLAG keeps the number
      expect(result.value).toBeCloseTo(-2, 9); // 10,000,000 / -5,000,000
      expect(result.qualityFlag).toBe('NEGATIVE_DENOMINATOR'); // but the caller is explicitly warned

      const row = await withPinnedPostgresTransaction((tx) =>
        tx.queryOne<{ value_status: string; value_decimal: string; quality_flag: string | null }>(
          `SELECT value_status, value_decimal, quality_flag FROM finance_analysis_kpi_values WHERE business_version_id = ? AND kpi_catalog_id = ?`,
          [analysisBvId, catalogId]
        )
      );
      expect(row?.value_status).toBe('PRESENT_NONZERO');
      expect(Number(row?.value_decimal)).toBeCloseTo(-2, 9);
      expect(row?.quality_flag).toBe('NEGATIVE_DENOMINATOR');
    });

    it('GROSS_MARGIN_PCT (FORCE_NA) with negative revenue: NOT_APPLICABLE, quality_flag stays NULL (a policy decision, not a computed error)', async () => {
      const pack = await makeStatementPack();
      const packBvId = pack.businessVersion.business_version_id;
      const entityId = await makeEntity(packBvId, 'BADDATA');

      // Negative revenue is a data error, not a legal business state (ADR section 5.3) -> FORCE_NA.
      await writeLine(packBvId, entityId, fy2025PeriodId, 'GROSS_MARGIN', 'P&L', 5_000_000);
      await writeLine(packBvId, entityId, fy2025PeriodId, 'REVENUE', 'P&L', -1_000_000);

      const analysis = await makeAnalysis();
      const analysisBvId = analysis.businessVersion.business_version_id;
      await withPinnedPostgresTransaction((tx) =>
        tx.queryRun(
          `INSERT INTO finance_analysis_definitions (
             organization_id, business_version_id, purpose, analysis_type, entity_scope_mode, presentation_currency, unit, created_by
           ) VALUES (?, ?, 'INTERNAL_REVIEW', 'STANDARD', 'GROUP_CONSOLIDATED', 'PLN', 'UNITS', ?)`,
          [orgId, analysisBvId, preparerId]
        )
      );
      const edge = await lineageService.insertEdge({
        organizationId: orgId,
        sourceVersionId: packBvId,
        sourceArtifactType: 'STATEMENT_PACK',
        targetVersionId: analysisBvId,
        targetArtifactType: 'HISTORICAL_ANALYSIS',
        edgeType: 'STATEMENT_TO_ANALYSIS',
        transformationKind: 'MANUAL_LINK',
        authorId: preparerId,
      });
      expect(edge.ok).toBe(true);

      const catalogId = catalogIdByCode.get('GROSS_MARGIN_PCT')!;
      await withPinnedPostgresTransaction((tx) =>
        tx.queryRun(
          `INSERT INTO finance_analysis_kpi_values (organization_id, business_version_id, kpi_catalog_id, entity_id, period_id)
           VALUES (?, ?, ?, ?, ?)`,
          [orgId, analysisBvId, catalogId, entityId, fy2025PeriodId]
        )
      );

      const computed = await kpiComputeService.computeAnalysisKpis({
        organizationId: orgId,
        businessVersionId: analysisBvId,
        requestedByUserId: preparerId,
      });
      expect(computed.ok).toBe(true);
      if (!computed.ok) throw new Error('unreachable');

      const result = computed.results[0];
      expect(result.status).toBe('NOT_APPLICABLE');
      expect(result.value).toBeNull();
      expect(result.qualityFlag).toBeNull(); // FORCE_NA: no misleading number, but also no flag — a clean N/A
    });
  });

  describe('readiness gate + DRAFT -> READY_FOR_REVIEW after a successful compute', () => {
    it('once the source Statement Pack is APPROVED and every selected KPI computed, the Analysis reaches READY_FOR_REVIEW', async () => {
      const pack = await makeStatementPack();
      const packBvId = pack.businessVersion.business_version_id;
      const entityId = await makeEntity(packBvId, 'PARENT');
      await writeLine(packBvId, entityId, fy2025PeriodId, 'CURRENT_ASSETS', 'BS', 56_500_000);
      await writeLine(packBvId, entityId, fy2025PeriodId, 'CURRENT_LIABILITIES', 'BS', 17_500_000);

      // Take the source Statement Pack Version to APPROVED (T2->T4->approve), same sequence
      // `canonicalServices.pg.test.ts` already exercises for HISTORICAL_ANALYSIS artifacts.
      let packVersion = pack.businessVersion.version;
      const submitted = await artifactVersionService.transition({
        organizationId: orgId, businessVersionId: packBvId, action: 'submit_for_review', actorId: preparerId, role: 'preparer', expectedVersion: packVersion,
      });
      if (!submitted.ok) throw new Error(`submit_for_review failed: ${submitted.message}`);
      packVersion = submitted.businessVersion.version;
      const started = await artifactVersionService.transition({
        organizationId: orgId, businessVersionId: packBvId, action: 'start_review', actorId: preparerId, role: 'finance_admin', expectedVersion: packVersion,
      });
      if (!started.ok) throw new Error(`start_review failed: ${started.message}`);
      packVersion = started.businessVersion.version;
      await withPinnedPostgresTransaction((tx) => tx.queryRun(`UPDATE finance_business_versions SET freshness = 'CURRENT' WHERE business_version_id = ?`, [packBvId]));
      // STATEMENT_PACK defaults to MATERIAL risk tier (lifecycleService.defaultRiskTierForArtifactType)
      // -> self-approval (approver === submitted_by/editor) is forbidden, hence a distinct approverId.
      const approved = await artifactVersionService.approveVersion({
        organizationId: orgId, businessVersionId: packBvId, actorId: approverId, role: 'approver', expectedVersion: packVersion, idempotencyKey: `idem-${packBvId}`,
      });
      if (!approved.ok) throw new Error(`approveVersion failed: ${approved.code}`);

      const analysis = await makeAnalysis();
      const analysisBvId = analysis.businessVersion.business_version_id;
      await withPinnedPostgresTransaction((tx) =>
        tx.queryRun(
          `INSERT INTO finance_analysis_definitions (
             organization_id, business_version_id, purpose, analysis_type, entity_scope_mode, presentation_currency, unit, created_by
           ) VALUES (?, ?, 'INTERNAL_REVIEW', 'STANDARD', 'GROUP_CONSOLIDATED', 'PLN', 'UNITS', ?)`,
          [orgId, analysisBvId, preparerId]
        )
      );
      const edge = await lineageService.insertEdge({
        organizationId: orgId, sourceVersionId: packBvId, sourceArtifactType: 'STATEMENT_PACK',
        targetVersionId: analysisBvId, targetArtifactType: 'HISTORICAL_ANALYSIS', edgeType: 'STATEMENT_TO_ANALYSIS',
        transformationKind: 'MANUAL_LINK', authorId: preparerId,
      });
      expect(edge.ok).toBe(true);

      const catalogId = catalogIdByCode.get('CURRENT_RATIO')!;
      await withPinnedPostgresTransaction((tx) =>
        tx.queryRun(
          `INSERT INTO finance_analysis_kpi_values (organization_id, business_version_id, kpi_catalog_id, entity_id, period_id)
           VALUES (?, ?, ?, ?, ?)`,
          [orgId, analysisBvId, catalogId, entityId, fy2025PeriodId]
        )
      );

      const computed = await kpiComputeService.computeAnalysisKpis({
        organizationId: orgId,
        businessVersionId: analysisBvId,
        requestedByUserId: preparerId,
        attemptReadinessTransition: true,
        actorId: preparerId,
        role: 'preparer',
        expectedVersion: analysis.businessVersion.version,
      });
      expect(computed.ok).toBe(true);
      if (!computed.ok) throw new Error('unreachable');

      expect(computed.readiness.checked).toBe(true);
      const failedChecks = computed.readiness.checks.filter((c) => !c.passed);
      expect(failedChecks).toEqual([]);
      expect(computed.readiness.ready).toBe(true);
      expect(computed.readiness.transitionAttempted).toBe(true);
      expect(computed.readiness.transitionResult?.ok).toBe(true);
      expect(computed.readiness.businessVersion?.status).toBe('READY_FOR_REVIEW');

      const bvRow = await withPinnedPostgresTransaction((tx) =>
        tx.queryOne<{ status: string }>(`SELECT status FROM finance_business_versions WHERE business_version_id = ?`, [analysisBvId])
      );
      expect(bvRow?.status).toBe('READY_FOR_REVIEW');
    });
  });

  afterAll(async () => {
    // Best-effort only, same convention as the sibling .pg.test.ts suites in this directory:
    // append-only/deny-delete triggers on this schema's FK chain make the fixture rows this suite
    // created transitively undeletable via DML — that is the schema's append-only guarantee
    // working as intended, not a test bug.
  });
});
