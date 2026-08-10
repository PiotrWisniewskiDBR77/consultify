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

    // W10 test-isolation fix — scoped to the WP-D03b P0 SEED SET ONLY
    // (`tier = 'UNIVERSAL' AND organization_id IS NULL`).
    //
    // The previous read was unscoped (`WHERE status = 'ACTIVE'` and nothing else), so it
    // returned whatever the shared test database held at that instant. A sibling suite that
    // legitimately owns an ACTIVE `ORG_CUSTOM` catalog row for the length of its own run
    // (`savedViewService.pg.test.ts` — it creates one under a unique random `kpi_code` and
    // deletes it in `afterAll`) overlaps this `beforeAll` whenever vitest runs the files in
    // parallel. Result: `expected 19 to be 18`, red in the full suite, green when this file
    // ran alone. No `afterAll` anywhere can close that window — the row is supposed to exist
    // while its owning suite runs — so the reader has to say what it actually means.
    //
    // This is NOT a loosened assertion: the expected count stays an exact 18, and the check
    // becomes strictly stronger. Unscoped, "17 seed rows + 1 foreign ORG_CUSTOM row" also
    // counted as 18 and would have hidden a genuinely missing P0 seed row; scoped, it cannot.
    const catalogRows = await withPinnedPostgresTransaction((tx) =>
      tx.queryAll<{ id: string; kpi_code: string }>(
        `SELECT id, kpi_code FROM finance_analysis_kpi_catalog
          WHERE status = 'ACTIVE' AND tier = 'UNIVERSAL' AND organization_id IS NULL`
      )
    );
    catalogIdByCode = new Map(catalogRows.map((r) => [r.kpi_code, r.id]));
    expect(catalogRows).toHaveLength(18); // sanity: WP-D03b's 18 P0 seed rows are present…
    expect(catalogIdByCode.size).toBe(18); // …and their kpi_codes are all distinct
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

  /**
   * W10 — KNOWN-ANSWER KPI, gate FC-04.3: bringing coverage from 6/18 (WP-D04) + 2/18
   * (DIO/DPO, RC-04, added later on real Apator data) to the remaining 9 P0 KPI that
   * compute a real number on GoldCo PARENT standalone FY2025/FY2024(restated) data, plus
   * `DEBT_TO_EBITDA` (documented as structurally unavailable for an annual-only report, RC-09
   * — see the module comment, `periodConventionResolver.ts`'s `LTM_SUM_4Q` branch: it requires
   * `period_type='Q'`, and this fixture (like GoldCo's whole oracle) only has `FY` periods).
   *
   * Per this task's own discipline ("NIE używaj tego samego formulaAstEvaluator do wyliczenia
   * oczekiwanej wartości"), every EXPECTED value below is plain arithmetic on the SAME raw
   * PARENT FY2025 / FY2024_restated figures the existing "6 KPI" block above already transcribes
   * from `goldco_oracle.ts` (see this file's header comment) — not a second call into
   * `formulaAstEvaluator`/`kpiComputeService`, and not copied from any prior engine run.
   *
   *   PARENT FY2025 (raw, from goldco_oracle.ts `parent.FY2025`, restated where noted):
   *     revenue=182,000,000  cogs=118,000,000  opex=34,000,000  depreciation=7,000,000
   *     interest=2,000,000  taxExpense=3,990,000  cash=11,000,000  ar=26,000,000
   *     inventory=19,500,000  fixedAssets=101,500,000  ap=17,500,000  longTermDebt=40,500,000
   *     cfo=15,000,000  cfi=-9,000,000
   *   PARENT FY2024_restated (revenue is UNCHANGED by the restatement — only cogs/inventory move):
   *     revenue=165,000,000  inventory=18,000,000 (21,000,000 orig - 3,000,000 write-down)
   *     ap=16,500,000  fixedAssets=96,500,000  cash=9,500,000  ar=24,000,000
   *
   *   Derived FY2025 (same `derivePL`/`deriveBS`/`withEquityPlug` oracle formulas, re-derived
   *   here independently — identical to the existing "6 KPI" block's own header, repeated for
   *   this block's self-containedness):
   *     grossMargin  = revenue-cogs                          = 182,000,000-118,000,000 = 64,000,000
   *     ebitda       = grossMargin-opex                      = 64,000,000-34,000,000   = 30,000,000
   *     ebit         = ebitda-depreciation                   = 30,000,000-7,000,000    = 23,000,000
   *     netIncome    = ((ebit-interest)-taxExpense)          = (23,000,000-2,000,000)-3,990,000 = 17,010,000
   *     currentAssets= cash+ar+inventory                     = 11,000,000+26,000,000+19,500,000 = 56,500,000
   *     totalAssets  = currentAssets+fixedAssets              = 56,500,000+101,500,000 = 158,000,000
   *   Derived FY2024_restated:
   *     totalAssets(restated) = (9,500,000+24,000,000+18,000,000)+96,500,000 = 148,000,000
   *     (cross-checks the existing "6 KPI" block's own independently-stated equity(FY2024_restated)
   *     = 89,500,000 = totalAssets(148,000,000) - totalLiabilities(58,500,000; ap 16,500,000 +
   *     longTermDebt 42,000,000) — not re-derived here, only totalAssets is needed for ROA)
   *
   *   A DOCUMENTED SCOPE DECISION, flagged for reviewer awareness (not silently assumed):
   *   `goldco_oracle.ts` does not model a `FCF`/`CAPEX` line at all (the oracle's own `parent.*`
   *   objects carry `cfo`/`cfi`/`cff` only — see the file's own field list). `FCF_MARGIN`'s
   *   formula (`..._03_kpi_p0_catalog.sql` row 15) reads `FCF` as a plain `cell_ref`, i.e. FCF is
   *   a RAW reported statement line in this schema, not something the compute engine derives from
   *   CFO/CAPEX — exactly the same way `OPERATING_CASH_FLOW_MARGIN`'s `CFO` is a raw given cell in
   *   the existing "6 KPI" block above, not derived by this evaluator either. Since the oracle
   *   gives no independent FCF figure, this test uses the standard identity FCF = CFO - CAPEX,
   *   and — because GoldCo's oracle books no investing activity other than CAPEX (no M&A, no
   *   securities) — CFI stands in for -CAPEX exactly: FCF = CFO + CFI = 15,000,000 + (-9,000,000)
   *   = 6,000,000. This is an assumption ABOUT THE FIXTURE'S OWN INPUT DATA, not about the KPI
   *   formula itself (which stays a plain `FCF / REVENUE` cell-ratio, verified byte-for-byte
   *   against the DB-persisted `FCF` cell this test writes).
   *
   *   The 9 KPI this test computes (by hand, NOT via formulaAstEvaluator):
   *     QUICK_RATIO       = (currentAssets-inventory)/currentLiabilities
   *                        = (56,500,000-19,500,000)/17,500,000            = 2.1142857142857143
   *     CASH_RATIO        = cash/currentLiabilities = 11,000,000/17,500,000 = 0.6285714285714286
   *     EBITDA_MARGIN_PCT = ebitda/revenue = 30,000,000/182,000,000        = 0.16483516483516483
   *     NET_MARGIN_PCT    = netIncome/revenue = 17,010,000/182,000,000     = 0.09346153846153846
   *     INTEREST_COVERAGE = ebit/interest = 23,000,000/2,000,000           = 11.5
   *     ROA               = netIncome/TOTAL_ASSETS_avg, TOTAL_ASSETS_avg=(158,000,000+148,000,000)/2=153,000,000
   *                        -> 17,010,000/153,000,000                       = 0.1111764705882353
   *     REVENUE_GROWTH_YOY= (revenue(FY2025)-revenue(FY2024))/revenue(FY2024)
   *                        = (182,000,000-165,000,000)/165,000,000         = 0.10303030303030303
   *     FCF_MARGIN        = FCF/revenue = 6,000,000/182,000,000            = 0.03296703296703297
   *     CASH_CONVERSION_CYCLE = DSO+DIO-DPO, each AR/INVENTORY/AP_avg*365/{REVENUE|COGS}:
   *       DSO = ((26,000,000+24,000,000)/2)*365/182,000,000                = 50.13736263736264 (matches the "6 KPI" block's own DSO)
   *       DIO = ((19,500,000+18,000,000)/2)*365/118,000,000                = 57.9978813559322
   *       DPO = ((17,500,000+16,500,000)/2)*365/118,000,000                = 52.58474576271186
   *       CCC = 50.13736263736264+57.9978813559322-52.58474576271186      = 55.55049823058298
   *
   *   DEBT_TO_EBITDA (10th KPI in this block) is asserted SEPARATELY as a structural-unavailability
   *   case (`status='MISSING'`, `value=null`) — never assigned a fabricated 18th number.
   */
  describe('W10 — 9 additional P0 KPI (known-answer) + 1 structurally-unavailable (DEBT_TO_EBITDA), GoldCo PARENT FY2025', () => {
    it('QUICK_RATIO / CASH_RATIO / EBITDA_MARGIN_PCT / NET_MARGIN_PCT / INTEREST_COVERAGE / ROA / REVENUE_GROWTH_YOY / FCF_MARGIN / CASH_CONVERSION_CYCLE match hand-computed values', async () => {
      const pack = await makeStatementPack();
      const packBvId = pack.businessVersion.business_version_id;
      const entityId = await makeEntity(packBvId, 'PARENT-W10');

      // FY2025 (current) — raw + derived lines.
      await writeLine(packBvId, entityId, fy2025PeriodId, 'REVENUE', 'P&L', 182_000_000);
      await writeLine(packBvId, entityId, fy2025PeriodId, 'COGS', 'P&L', 118_000_000);
      await writeLine(packBvId, entityId, fy2025PeriodId, 'EBITDA', 'P&L', 30_000_000);
      await writeLine(packBvId, entityId, fy2025PeriodId, 'EBIT', 'P&L', 23_000_000);
      await writeLine(packBvId, entityId, fy2025PeriodId, 'NET_INCOME', 'P&L', 17_010_000);
      await writeLine(packBvId, entityId, fy2025PeriodId, 'INTEREST_EXPENSE', 'P&L', 2_000_000);
      await writeLine(packBvId, entityId, fy2025PeriodId, 'CASH', 'BS', 11_000_000);
      await writeLine(packBvId, entityId, fy2025PeriodId, 'AR', 'BS', 26_000_000);
      await writeLine(packBvId, entityId, fy2025PeriodId, 'INVENTORY', 'BS', 19_500_000);
      await writeLine(packBvId, entityId, fy2025PeriodId, 'AP', 'BS', 17_500_000);
      await writeLine(packBvId, entityId, fy2025PeriodId, 'CURRENT_ASSETS', 'BS', 56_500_000);
      await writeLine(packBvId, entityId, fy2025PeriodId, 'CURRENT_LIABILITIES', 'BS', 17_500_000);
      await writeLine(packBvId, entityId, fy2025PeriodId, 'TOTAL_ASSETS', 'BS', 158_000_000);
      await writeLine(packBvId, entityId, fy2025PeriodId, 'LONG_TERM_DEBT', 'BS', 40_500_000);
      await writeLine(packBvId, entityId, fy2025PeriodId, 'CFO', 'CF', 15_000_000);
      // FCF — see this block's header comment: FCF = CFO + CFI = 15,000,000 + (-9,000,000), since
      // goldco_oracle.ts models no other investing cash flow (documented scope decision).
      await writeLine(packBvId, entityId, fy2025PeriodId, 'FCF', 'CF', 6_000_000);

      // FY2024 (prior, restated) — needed only for AVERAGE_BALANCE (ROA, DIO, DPO -> CCC) and
      // PRIOR_YEAR_SAME_PERIOD (REVENUE_GROWTH_YOY) conventions.
      await writeLine(packBvId, entityId, fy2024PeriodId, 'REVENUE', 'P&L', 165_000_000); // unaffected by the restatement
      await writeLine(packBvId, entityId, fy2024PeriodId, 'AR', 'BS', 24_000_000);
      await writeLine(packBvId, entityId, fy2024PeriodId, 'INVENTORY', 'BS', 18_000_000); // restated (21,000,000 - 3,000,000 write-down)
      await writeLine(packBvId, entityId, fy2024PeriodId, 'AP', 'BS', 16_500_000);
      await writeLine(packBvId, entityId, fy2024PeriodId, 'TOTAL_ASSETS', 'BS', 148_000_000); // restated

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

      const kpiCodes = [
        'QUICK_RATIO',
        'CASH_RATIO',
        'EBITDA_MARGIN_PCT',
        'NET_MARGIN_PCT',
        'INTEREST_COVERAGE',
        'ROA',
        'REVENUE_GROWTH_YOY',
        'FCF_MARGIN',
        'CASH_CONVERSION_CYCLE',
        'DEBT_TO_EBITDA', // structurally unavailable — asserted separately below
      ];
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
      expect(computed.results).toHaveLength(10);

      const byCode = new Map(computed.results.map((r) => [r.kpiCode, r]));

      const EXPECTED: Record<string, number> = {
        QUICK_RATIO: (56_500_000 - 19_500_000) / 17_500_000,
        CASH_RATIO: 11_000_000 / 17_500_000,
        EBITDA_MARGIN_PCT: 30_000_000 / 182_000_000,
        NET_MARGIN_PCT: 17_010_000 / 182_000_000,
        INTEREST_COVERAGE: 23_000_000 / 2_000_000,
        ROA: 17_010_000 / ((158_000_000 + 148_000_000) / 2),
        REVENUE_GROWTH_YOY: (182_000_000 - 165_000_000) / 165_000_000,
        FCF_MARGIN: 6_000_000 / 182_000_000,
        CASH_CONVERSION_CYCLE:
          (((26_000_000 + 24_000_000) / 2) * 365) / 182_000_000 +
          (((19_500_000 + 18_000_000) / 2) * 365) / 118_000_000 -
          (((17_500_000 + 16_500_000) / 2) * 365) / 118_000_000,
      };

      for (const code of Object.keys(EXPECTED)) {
        const result = byCode.get(code);
        expect(result, `no compute result for ${code}`).toBeTruthy();
        expect(result!.status, `${code} status`).toBe('PRESENT_NONZERO');
        expect(result!.qualityFlag, `${code} qualityFlag`).toBeNull();
        expect(result!.value, `${code} value`).toBeCloseTo(EXPECTED[code], 6);
      }

      // Confirm the DB rows themselves, not just the service's in-memory return value.
      for (const code of Object.keys(EXPECTED)) {
        const catalogId = catalogIdByCode.get(code)!;
        const row = await withPinnedPostgresTransaction((tx) =>
          tx.queryOne<{ value_status: string; value_decimal: string; quality_flag: string | null }>(
            `SELECT value_status, value_decimal, quality_flag FROM finance_analysis_kpi_values
              WHERE business_version_id = ? AND kpi_catalog_id = ?`,
            [analysisBvId, catalogId]
          )
        );
        expect(row?.value_status, `${code} DB value_status`).toBe('PRESENT_NONZERO');
        expect(row?.quality_flag, `${code} DB quality_flag`).toBeNull();
        expect(Number(row?.value_decimal), `${code} DB value_decimal`).toBeCloseTo(EXPECTED[code], 6);
      }

      // RC-09 — DEBT_TO_EBITDA (LONG_TERM_DEBT / EBITDA[LTM_SUM_4Q]) is structurally unavailable
      // for an annual-only report: `periodConventionResolver.resolvePeriodOffset('LTM_SUM_4Q', ...)`
      // requires `period_type='Q'` (this fixture, like GoldCo's whole oracle, only has FY periods)
      // -> WRONG_PERIOD_TYPE_FOR_LTM -> the cell resolves to MISSING (not a DB-valid quality_flag,
      // per formulaAstEvaluator.ts's own header note) -> the whole ratio propagates MISSING. This
      // is NOT a defect: it is the correctly-documented absence of quarterly data, never a fabricated
      // 18th number. A real LONG_TERM_DEBT value (40,500,000, written above) is present and PRESENT
      // regardless — it is the EBITDA[LTM_SUM_4Q] side that cannot be resolved on FY-only data.
      const debtToEbitda = byCode.get('DEBT_TO_EBITDA');
      expect(debtToEbitda, 'no compute result for DEBT_TO_EBITDA').toBeTruthy();
      expect(debtToEbitda!.status).toBe('MISSING');
      expect(debtToEbitda!.value).toBeNull();
      expect(debtToEbitda!.qualityFlag).toBeNull();
      expect(debtToEbitda!.detail).toContain('WRONG_PERIOD_TYPE_FOR_LTM');

      const debtToEbitdaCatalogId = catalogIdByCode.get('DEBT_TO_EBITDA')!;
      const debtToEbitdaRow = await withPinnedPostgresTransaction((tx) =>
        tx.queryOne<{ value_status: string; value_decimal: string | null; quality_flag: string | null }>(
          `SELECT value_status, value_decimal, quality_flag FROM finance_analysis_kpi_values
            WHERE business_version_id = ? AND kpi_catalog_id = ?`,
          [analysisBvId, debtToEbitdaCatalogId]
        )
      );
      expect(debtToEbitdaRow?.value_status).toBe('MISSING');
      expect(debtToEbitdaRow?.value_decimal).toBeNull();
      expect(debtToEbitdaRow?.quality_flag).toBeNull();
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

  /**
   * RC-04 regression — `sign_convention='CONTRA'` is written by the mapping layer but must also be
   * APPLIED when `loadStmtLineCells()` reads the cell back.
   *
   * REAL DATA, not synthetic: Grupa Apator's filed consolidated IFRS statements, transcribed
   * verbatim from `docs/validation/finance-v3/generated/STATEMENT_IMPORT_SAMPLE_AUDIT_2026-03-15.json`
   * (`topMappedLines` of "Grupa Apator Raport RS 2023"/"RS 2024") and cross-checked against
   * `docs/validation/finance-v3/generated/gate-d/REAL_COMPANY_PROOF_report.md` §4/§5 RC-04.
   * All values in thousand PLN, `unit='THOUSANDS'`:
   *
   *   FY2023: INVENTORY = 242 296   AP = 93 591   COGS = −881 346
   *   FY2024: INVENTORY = 225 460   AP =    722   COGS = −913 065
   *
   * COGS is negative because that is how the statement is filed ("Koszt własny sprzedaży"
   * −913 065) — the pack declares `signConvention: 'CONTRA'` for it rather than mutilating the
   * as-filed value. Expected values, computed here by hand (NOT via formulaAstEvaluator), FY2024
   * being a leap year so DAYS_IN_PERIOD = 366:
   *
   *   COGS per day        = 913 065 / 366                    = 2 494.7131147540983
   *   INVENTORY average   = (225 460 + 242 296) / 2          = 233 878
   *   DIO                 = 233 878 / 2 494.7131147540983    = 93.7495…   (report: 93.749)
   *   AP average          = (722 + 93 591) / 2               = 47 156.5
   *   DPO                 = 47 156.5 / 2 494.7131147540983   = 18.9026…   (report: 18.903)
   *
   * Pre-fix, both came back `NOT_APPLICABLE`: the CONTRA convention was never applied, the
   * denominator stayed −913 065, and DIO/DPO both carry `negative_denominator_policy='FORCE_NA'`.
   * (The AP FY2024 = 722 figure is itself an extraction defect — RC-05 — but it is the real value
   * that really flowed through the pipeline, and this test is about the sign convention, not
   * about AP's plausibility.)
   */
  describe('RC-04 fix — sign_convention=CONTRA is applied on read, so DIO/DPO compute on an as-filed pack', () => {
    const APATOR = {
      inventoryFy2023: 242_296,
      inventoryFy2024: 225_460,
      apFy2023: 93_591,
      apFy2024: 722,
      cogsFy2024AsFiled: -913_065, // as filed, negative; declared CONTRA
    } as const;
    const DAYS_FY2024 = 366; // leap year
    const COGS_PER_DAY = 913_065 / DAYS_FY2024;
    const EXPECTED_DIO = ((APATOR.inventoryFy2024 + APATOR.inventoryFy2023) / 2) / COGS_PER_DAY;
    const EXPECTED_DPO = ((APATOR.apFy2024 + APATOR.apFy2023) / 2) / COGS_PER_DAY;

    let apatorCalendarId = '';
    let apatorFy2023 = '';
    let apatorFy2024 = '';

    /** Same shortcut as `writeLine` above, but keeps `unit='THOUSANDS'` (as filed) and lets the
     *  caller declare the sign convention — the two dimensions this regression is about. */
    async function writeApatorLine(
      businessVersionId: string,
      entityId: string,
      periodId: string,
      lineCode: string,
      statementType: 'P&L' | 'BS' | 'CF',
      value: number,
      signConvention: 'NATURAL' | 'CONTRA'
    ) {
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
           ) VALUES (?, ?, ?, ?, ?, ?, 'FULL_YEAR', 'CONSOLIDATED', 'PRESENT_NONZERO', ?, 'PLN', 'PLN', 'THOUSANDS', ?, 'IFRS', ?)`,
          [orgId, businessVersionId, statementType, line.id, entityId, periodId, value, signConvention, preparerId]
        )
      );
    }

    beforeAll(async () => {
      // A dedicated calendar: `uq_finance_stmt_period_fy` is unique per (calendar, fiscal_year),
      // and this org's shared fixture calendar already owns FY2024.
      const cal = await withPinnedPostgresTransaction((tx) =>
        tx.queryOne<{ fiscal_calendar_id: string }>(
          `INSERT INTO finance_stmt_calendars (organization_id, calendar_type, fiscal_year_end_month, effective_from, created_by)
           VALUES (?, 'STANDARD', 12, '2019-01-01', ?) RETURNING fiscal_calendar_id`,
          [orgId, preparerId]
        )
      );
      if (!cal) throw new Error('Apator fixture calendar insert returned no row');
      apatorCalendarId = cal.fiscal_calendar_id;

      const p2023 = await withPinnedPostgresTransaction((tx) =>
        tx.queryOne<{ period_id: string }>(
          `INSERT INTO finance_stmt_periods (organization_id, fiscal_calendar_id, period_type, fiscal_year, period_start, period_end, label, created_by)
           VALUES (?, ?, 'FY', 2023, '2023-01-01', '2023-12-31', 'FY2023', ?) RETURNING period_id`,
          [orgId, apatorCalendarId, preparerId]
        )
      );
      if (!p2023) throw new Error('Apator FY2023 period insert returned no row');
      apatorFy2023 = p2023.period_id;

      const p2024 = await withPinnedPostgresTransaction((tx) =>
        tx.queryOne<{ period_id: string }>(
          `INSERT INTO finance_stmt_periods (organization_id, fiscal_calendar_id, period_type, fiscal_year, period_start, period_end, label, previous_period_id, created_by)
           VALUES (?, ?, 'FY', 2024, '2024-01-01', '2024-12-31', 'FY2024', ?, ?) RETURNING period_id`,
          [orgId, apatorCalendarId, apatorFy2023, preparerId]
        )
      );
      if (!p2024) throw new Error('Apator FY2024 period insert returned no row');
      apatorFy2024 = p2024.period_id;
    });

    it('DIO and DPO compute from the real Apator FY2024 pack whose COGS is stored as filed (−913 065, CONTRA)', async () => {
      const pack = await makeStatementPack();
      const packBvId = pack.businessVersion.business_version_id;
      const entityId = await makeEntity(packBvId, 'GRUPA-APATOR');

      await writeApatorLine(packBvId, entityId, apatorFy2024, 'COGS', 'P&L', APATOR.cogsFy2024AsFiled, 'CONTRA');
      await writeApatorLine(packBvId, entityId, apatorFy2024, 'INVENTORY', 'BS', APATOR.inventoryFy2024, 'NATURAL');
      await writeApatorLine(packBvId, entityId, apatorFy2023, 'INVENTORY', 'BS', APATOR.inventoryFy2023, 'NATURAL');
      await writeApatorLine(packBvId, entityId, apatorFy2024, 'AP', 'BS', APATOR.apFy2024, 'NATURAL');
      await writeApatorLine(packBvId, entityId, apatorFy2023, 'AP', 'BS', APATOR.apFy2023, 'NATURAL');

      // The value really is stored negative — the fix must NOT be "rewrite the pack".
      const storedCogs = await withPinnedPostgresTransaction((tx) =>
        tx.queryOne<{ value_decimal: string; sign_convention: string }>(
          `SELECT l.value_decimal, l.sign_convention
             FROM finance_stmt_lines l
             JOIN financial_statement_lines c ON c.id = l.canonical_line_id
            WHERE l.business_version_id = ? AND c.line_code = 'COGS'`,
          [packBvId]
        )
      );
      expect(Number(storedCogs?.value_decimal)).toBe(APATOR.cogsFy2024AsFiled);
      expect(storedCogs?.sign_convention).toBe('CONTRA');

      const analysis = await makeAnalysis();
      const analysisBvId = analysis.businessVersion.business_version_id;
      await withPinnedPostgresTransaction((tx) =>
        tx.queryRun(
          `INSERT INTO finance_analysis_definitions (
             organization_id, business_version_id, purpose, analysis_type, entity_scope_mode, presentation_currency, unit, created_by
           ) VALUES (?, ?, 'INTERNAL_REVIEW', 'STANDARD', 'GROUP_CONSOLIDATED', 'PLN', 'THOUSANDS', ?)`,
          [orgId, analysisBvId, preparerId]
        )
      );
      const edge = await lineageService.insertEdge({
        organizationId: orgId, sourceVersionId: packBvId, sourceArtifactType: 'STATEMENT_PACK',
        targetVersionId: analysisBvId, targetArtifactType: 'HISTORICAL_ANALYSIS', edgeType: 'STATEMENT_TO_ANALYSIS',
        transformationKind: 'MANUAL_LINK', authorId: preparerId,
      });
      expect(edge.ok).toBe(true);

      for (const code of ['DIO', 'DPO']) {
        const catalogId = catalogIdByCode.get(code);
        if (!catalogId) throw new Error(`catalog row not found for ${code}`);
        await withPinnedPostgresTransaction((tx) =>
          tx.queryRun(
            `INSERT INTO finance_analysis_kpi_values (organization_id, business_version_id, kpi_catalog_id, entity_id, period_id)
             VALUES (?, ?, ?, ?, ?)`,
            [orgId, analysisBvId, catalogId, entityId, apatorFy2024]
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

      const byCode = new Map(computed.results.map((r) => [r.kpiCode, r]));

      const dio = byCode.get('DIO');
      expect(dio, 'no compute result for DIO').toBeTruthy();
      expect(dio!.status).toBe('PRESENT_NONZERO'); // pre-fix: 'NOT_APPLICABLE' (FORCE_NA on a negative denominator)
      expect(dio!.value).toBeCloseTo(EXPECTED_DIO, 3);
      expect(dio!.value).toBeCloseTo(93.749, 2); // the figure REAL_COMPANY_PROOF §4 reports for PASS B

      const dpo = byCode.get('DPO');
      expect(dpo, 'no compute result for DPO').toBeTruthy();
      expect(dpo!.status).toBe('PRESENT_NONZERO'); // pre-fix: 'NOT_APPLICABLE'
      expect(dpo!.value).toBeCloseTo(EXPECTED_DPO, 3);
      expect(dpo!.value).toBeCloseTo(18.903, 2);
    });

    it('a NATURAL-signed pack is unaffected: the same Apator figures with a positive COGS give identical DIO/DPO', async () => {
      const pack = await makeStatementPack();
      const packBvId = pack.businessVersion.business_version_id;
      const entityId = await makeEntity(packBvId, 'GRUPA-APATOR-NORMALIZED');

      // What the analyst had to do by hand pre-fix: physically flip the sign. Must land on the
      // exact same numbers as the as-filed CONTRA pack above — the fix changes reach, not results.
      await writeApatorLine(packBvId, entityId, apatorFy2024, 'COGS', 'P&L', -APATOR.cogsFy2024AsFiled, 'NATURAL');
      await writeApatorLine(packBvId, entityId, apatorFy2024, 'INVENTORY', 'BS', APATOR.inventoryFy2024, 'NATURAL');
      await writeApatorLine(packBvId, entityId, apatorFy2023, 'INVENTORY', 'BS', APATOR.inventoryFy2023, 'NATURAL');
      await writeApatorLine(packBvId, entityId, apatorFy2024, 'AP', 'BS', APATOR.apFy2024, 'NATURAL');
      await writeApatorLine(packBvId, entityId, apatorFy2023, 'AP', 'BS', APATOR.apFy2023, 'NATURAL');

      const analysis = await makeAnalysis();
      const analysisBvId = analysis.businessVersion.business_version_id;
      await withPinnedPostgresTransaction((tx) =>
        tx.queryRun(
          `INSERT INTO finance_analysis_definitions (
             organization_id, business_version_id, purpose, analysis_type, entity_scope_mode, presentation_currency, unit, created_by
           ) VALUES (?, ?, 'INTERNAL_REVIEW', 'STANDARD', 'GROUP_CONSOLIDATED', 'PLN', 'THOUSANDS', ?)`,
          [orgId, analysisBvId, preparerId]
        )
      );
      const edge = await lineageService.insertEdge({
        organizationId: orgId, sourceVersionId: packBvId, sourceArtifactType: 'STATEMENT_PACK',
        targetVersionId: analysisBvId, targetArtifactType: 'HISTORICAL_ANALYSIS', edgeType: 'STATEMENT_TO_ANALYSIS',
        transformationKind: 'MANUAL_LINK', authorId: preparerId,
      });
      expect(edge.ok).toBe(true);

      for (const code of ['DIO', 'DPO']) {
        await withPinnedPostgresTransaction((tx) =>
          tx.queryRun(
            `INSERT INTO finance_analysis_kpi_values (organization_id, business_version_id, kpi_catalog_id, entity_id, period_id)
             VALUES (?, ?, ?, ?, ?)`,
            [orgId, analysisBvId, catalogIdByCode.get(code)!, entityId, apatorFy2024]
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
      const byCode = new Map(computed.results.map((r) => [r.kpiCode, r]));
      expect(byCode.get('DIO')!.value).toBeCloseTo(EXPECTED_DIO, 6);
      expect(byCode.get('DPO')!.value).toBeCloseTo(EXPECTED_DPO, 6);
    });
  });

  afterAll(async () => {
    // Best-effort only, same convention as the sibling .pg.test.ts suites in this directory:
    // append-only/deny-delete triggers on this schema's FK chain make the fixture rows this suite
    // created transitively undeletable via DML — that is the schema's append-only guarantee
    // working as intended, not a test bug.
  });
});
