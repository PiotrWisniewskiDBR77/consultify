/**
 * F-P4 — `analysisDefinitionService`: producent definicji analizy i wierszy SELEKCJI wskaźników.
 * Test na REALNYM PostgreSQL (`RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres DATABASE_URL=…`),
 * ten sam kontrakt bramki co reszta suit `.pg.test.ts` w tym katalogu.
 *
 * Dlaczego TYLKO Postgres: `finance_analysis_kpi_values` ma CHECK-i, których sqlite nie zna
 * (`chk_finance_analysis_kpi_values_value_shape`, `quality_flag` z zamkniętą listą 4 wartości)
 * — na atrapie bazy zieleń nic by nie znaczyła.
 *
 * Co jest tu zabezpieczeniem (a nie mechanizmem):
 *   „analiza bez wierszy selekcji jest bezużyteczna — `compute` policzy 0 wskaźników".
 * Dowód mutacyjny (opisany w raporcie paczki): usunięcie `INSERT`-a selekcji z
 * `createAnalysisDefinitionWithSelection` wywraca testy 1, 2 i 5 — nie dlatego, że artefakt nie
 * powstaje (powstaje), tylko dlatego, że nie ma czego liczyć.
 */
import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const CONNECTION_STRING = process.env.DATABASE_URL ?? '';
const REAL_PG_REQUESTED =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  CONNECTION_STRING.startsWith('postgres');
if (REAL_PG_REQUESTED) {
  process.env.DB_TYPE = 'postgres';
}
const REAL_PG = REAL_PG_REQUESTED;

describe.skipIf(!REAL_PG)('F-P4 analysisDefinitionService — realny PostgreSQL', () => {
  let withPinnedPostgresTransaction: typeof import('../../../../database/PostgresDatabase.js').withPinnedPostgresTransaction;
  let artifactVersionService: typeof import('../artifactVersionService.js');
  let lineageService: typeof import('../lineageService.js');
  let kpiComputeService: typeof import('../kpiComputeService.js');
  let analysisDefinitionService: typeof import('../analysisDefinitionService.js');

  const orgId = `org-fp4-${randomUUID()}`;
  const preparerId = `user-fp4-${randomUUID()}`;
  let calendarId = '';
  let fy2024PeriodId = '';
  let fy2025PeriodId = '';
  let activeCatalogCount = 0;

  async function makePack() {
    return artifactVersionService.createArtifact({
      organizationId: orgId,
      artifactType: 'STATEMENT_PACK',
      createdBy: preparerId,
    });
  }

  async function makeAnalysis() {
    return artifactVersionService.createArtifact({
      organizationId: orgId,
      artifactType: 'HISTORICAL_ANALYSIS',
      createdBy: preparerId,
    });
  }

  async function makeEntity(businessVersionId: string, entityCode: string) {
    const row = await withPinnedPostgresTransaction((tx) =>
      tx.queryOne<{ id: string }>(
        `INSERT INTO finance_stmt_entities (
           organization_id, business_version_id, entity_code, legal_name, role,
           consolidation_method, ownership_pct, functional_currency, created_by
         ) VALUES (?, ?, ?, ?, 'GROUP_PARENT', 'NOT_CONSOLIDATED', NULL, 'PLN', ?)
         RETURNING id`,
        [orgId, businessVersionId, entityCode, `${entityCode} sp. z o.o.`, preparerId]
      )
    );
    if (!row) throw new Error('finance_stmt_entities fixture insert returned no row');
    return row.id;
  }

  async function writeLine(
    businessVersionId: string,
    entityId: string,
    periodId: string,
    lineCode: string,
    statementType: 'P&L' | 'BS' | 'CF',
    value: number
  ) {
    const line = await withPinnedPostgresTransaction((tx) =>
      tx.queryOne<{ id: string }>(
        `SELECT id FROM financial_statement_lines WHERE line_code = ? AND organization_id IS NULL LIMIT 1`,
        [lineCode]
      )
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

  /** Pakiet DBR77-podobny: 2 okresy (FY2024, FY2025), jedna jednostka, komplet linii pod P0. */
  async function makeReadyPack() {
    const pack = await makePack();
    const packBvId = pack.businessVersion.business_version_id;
    const entityId = await makeEntity(packBvId, `PARENT-${randomUUID().slice(0, 8)}`);
    for (const [periodId, scale] of [
      [fy2024PeriodId, 0.9],
      [fy2025PeriodId, 1],
    ] as Array<[string, number]>) {
      await writeLine(packBvId, entityId, periodId, 'REVENUE', 'P&L', 182_000_000 * scale);
      await writeLine(packBvId, entityId, periodId, 'GROSS_MARGIN', 'P&L', 64_000_000 * scale);
      await writeLine(packBvId, entityId, periodId, 'NET_INCOME', 'P&L', 17_010_000 * scale);
      await writeLine(packBvId, entityId, periodId, 'CFO', 'CF', 15_000_000 * scale);
      await writeLine(packBvId, entityId, periodId, 'CURRENT_ASSETS', 'BS', 56_500_000 * scale);
      await writeLine(packBvId, entityId, periodId, 'CURRENT_LIABILITIES', 'BS', 17_500_000 * scale);
      await writeLine(packBvId, entityId, periodId, 'LONG_TERM_DEBT', 'BS', 40_500_000 * scale);
      await writeLine(packBvId, entityId, periodId, 'EQUITY', 'BS', 100_000_000 * scale);
      await writeLine(packBvId, entityId, periodId, 'AR', 'BS', 26_000_000 * scale);
    }
    return { packBvId, entityId };
  }

  async function linkAnalysis(packBvId: string, analysisBvId: string) {
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
  }

  /** Odczyt „na zimno" — osobne zapytanie po fakcie, nie wartość zwrócona przez serwis. */
  async function countSelectionRows(analysisBvId: string): Promise<number> {
    const row = await withPinnedPostgresTransaction((tx) =>
      tx.queryOne<{ count: string }>(
        `SELECT COUNT(*) AS count FROM finance_analysis_kpi_values WHERE business_version_id = ?`,
        [analysisBvId]
      )
    );
    return Number(row?.count ?? 0);
  }

  async function countDefinitions(analysisBvId: string): Promise<number> {
    const row = await withPinnedPostgresTransaction((tx) =>
      tx.queryOne<{ count: string }>(
        `SELECT COUNT(*) AS count FROM finance_analysis_definitions WHERE business_version_id = ?`,
        [analysisBvId]
      )
    );
    return Number(row?.count ?? 0);
  }

  beforeAll(async () => {
    ({ withPinnedPostgresTransaction } = await import('../../../../database/PostgresDatabase.js'));
    artifactVersionService = await import('../artifactVersionService.js');
    lineageService = await import('../lineageService.js');
    kpiComputeService = await import('../kpiComputeService.js');
    analysisDefinitionService = await import('../analysisDefinitionService.js');

    await withPinnedPostgresTransaction((tx) =>
      tx.queryRun(`INSERT INTO organizations (id, name) VALUES (?, ?)`, [orgId, 'F-P4 Test Org'])
    );

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

    // Katalog do selekcji = seed P0 (UNIVERSAL, bez organizacji) + ORG_CUSTOM tej organizacji.
    // Ta organizacja jest świeża, więc ORG_CUSTOM = 0 i liczba = 18 wierszy seeda WP-D03b.
    const catalog = await withPinnedPostgresTransaction((tx) =>
      tx.queryAll<{ id: string }>(
        `SELECT id FROM finance_analysis_kpi_catalog
          WHERE status = 'ACTIVE' AND tier = 'UNIVERSAL' AND organization_id IS NULL`
      )
    );
    activeCatalogCount = catalog.length;
    expect(activeCatalogCount).toBe(18);
  });

  afterAll(async () => {
    // Sprzątanie po sobie — dane demo są twarzą produktu (CLAUDE.md, higiena wykonania).
    await withPinnedPostgresTransaction(async (tx) => {
      await tx.queryRun(`DELETE FROM finance_analysis_kpi_values WHERE organization_id = ?`, [orgId]);
      await tx.queryRun(`DELETE FROM finance_analysis_definitions WHERE organization_id = ?`, [orgId]);
      await tx.queryRun(`DELETE FROM finance_stmt_lines WHERE organization_id = ?`, [orgId]);
      await tx.queryRun(`DELETE FROM finance_stmt_entities WHERE organization_id = ?`, [orgId]);
      await tx.queryRun(`DELETE FROM finance_stmt_periods WHERE organization_id = ?`, [orgId]);
      await tx.queryRun(`DELETE FROM finance_stmt_calendars WHERE organization_id = ?`, [orgId]);
    });
  });

  it('1. zakłada |katalog P0| × |okresy| wierszy selekcji dla pakietu z dwoma okresami', async () => {
    const { packBvId } = await makeReadyPack();
    const analysis = await makeAnalysis();
    const analysisBvId = analysis.businessVersion.business_version_id;
    await linkAnalysis(packBvId, analysisBvId);

    const result = await analysisDefinitionService.createAnalysisDefinitionWithSelection({
      organizationId: orgId,
      analysisBusinessVersionId: analysisBvId,
      sourceStatementPackVersionId: packBvId,
      createdBy: preparerId,
      analysisName: 'Analiza historyczna 2024–2025',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.summary.periodIds).toHaveLength(2);
    expect(result.summary.kpiCodes).toHaveLength(activeCatalogCount);
    expect(result.summary.selectionRowsInserted).toBe(activeCatalogCount * 2);

    // Odczyt na zimno, osobnym zapytaniem — nie ufamy liczbie zwróconej przez serwis.
    expect(await countSelectionRows(analysisBvId)).toBe(activeCatalogCount * 2);
    expect(await countDefinitions(analysisBvId)).toBe(1);

    const def = await withPinnedPostgresTransaction((tx) =>
      tx.queryOne<{ analysis_name: string | null; presentation_currency: string; unit: string }>(
        `SELECT analysis_name, presentation_currency, unit FROM finance_analysis_definitions WHERE business_version_id = ?`,
        [analysisBvId]
      )
    );
    expect(def?.analysis_name).toBe('Analiza historyczna 2024–2025');
    expect(def?.presentation_currency).toBe('PLN');
    expect(def?.unit).toBe('UNITS');
  });

  it('2. po selekcji `compute` wypełnia finance_analysis_kpi_values (NIE zero wierszy)', async () => {
    const { packBvId } = await makeReadyPack();
    const analysis = await makeAnalysis();
    const analysisBvId = analysis.businessVersion.business_version_id;
    await linkAnalysis(packBvId, analysisBvId);

    const created = await analysisDefinitionService.createAnalysisDefinitionWithSelection({
      organizationId: orgId,
      analysisBusinessVersionId: analysisBvId,
      sourceStatementPackVersionId: packBvId,
      createdBy: preparerId,
    });
    expect(created.ok).toBe(true);

    const computed = await kpiComputeService.computeAnalysisKpis({
      organizationId: orgId,
      businessVersionId: analysisBvId,
      requestedByUserId: preparerId,
    });
    expect(computed.ok).toBe(true);
    if (!computed.ok) throw new Error('unreachable');
    expect(computed.results.length).toBe(activeCatalogCount * 2);

    // Odczyt na zimno: ile komórek ma REALNĄ wartość (a nie tylko istnieje).
    const filled = await withPinnedPostgresTransaction((tx) =>
      tx.queryOne<{ count: string }>(
        `SELECT COUNT(*) AS count FROM finance_analysis_kpi_values
          WHERE business_version_id = ? AND value_status = 'PRESENT_NONZERO' AND value_decimal IS NOT NULL`,
        [analysisBvId]
      )
    );
    expect(Number(filled?.count ?? 0)).toBeGreaterThan(0);

    // Znany wynik: CURRENT_RATIO FY2025 = 56 500 000 / 17 500 000 (arytmetyka wprost, bez evaluatora).
    const currentRatio = await withPinnedPostgresTransaction((tx) =>
      tx.queryOne<{ value_decimal: string }>(
        `SELECT v.value_decimal FROM finance_analysis_kpi_values v
           JOIN finance_analysis_kpi_catalog c ON c.id = v.kpi_catalog_id
          WHERE v.business_version_id = ? AND c.kpi_code = 'CURRENT_RATIO' AND v.period_id = ?`,
        [analysisBvId, fy2025PeriodId]
      )
    );
    expect(Number(currentRatio?.value_decimal)).toBeCloseTo(56_500_000 / 17_500_000, 6);
  });

  it('3. KONTROLA NEGATYWNA — pakiet bez okresów: odmowa i ZERO zapisu', async () => {
    const pack = await makePack();
    const packBvId = pack.businessVersion.business_version_id;
    await makeEntity(packBvId, `PARENT-${randomUUID().slice(0, 8)}`); // jednostka jest, linii/okresów nie ma
    const analysis = await makeAnalysis();
    const analysisBvId = analysis.businessVersion.business_version_id;
    await linkAnalysis(packBvId, analysisBvId);

    const result = await analysisDefinitionService.createAnalysisDefinitionWithSelection({
      organizationId: orgId,
      analysisBusinessVersionId: analysisBvId,
      sourceStatementPackVersionId: packBvId,
      createdBy: preparerId,
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.code).toBe('SOURCE_PACK_HAS_NO_PERIODS');
    expect(await countSelectionRows(analysisBvId)).toBe(0);
    expect(await countDefinitions(analysisBvId)).toBe(0);
  });

  it('4. KONTROLA NEGATYWNA — pakiet bez jednostek: odmowa i ZERO zapisu', async () => {
    const pack = await makePack();
    const packBvId = pack.businessVersion.business_version_id;
    const analysis = await makeAnalysis();
    const analysisBvId = analysis.businessVersion.business_version_id;
    await linkAnalysis(packBvId, analysisBvId);

    const result = await analysisDefinitionService.createAnalysisDefinitionWithSelection({
      organizationId: orgId,
      analysisBusinessVersionId: analysisBvId,
      sourceStatementPackVersionId: packBvId,
      createdBy: preparerId,
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.code).toBe('SOURCE_PACK_HAS_NO_ENTITIES');
    expect(await countSelectionRows(analysisBvId)).toBe(0);
    expect(await countDefinitions(analysisBvId)).toBe(0);
  });

  it('5. zawężenie z kreatora: |wybrane wskaźniki| × |wybrane okresy|', async () => {
    const { packBvId } = await makeReadyPack();
    const analysis = await makeAnalysis();
    const analysisBvId = analysis.businessVersion.business_version_id;
    await linkAnalysis(packBvId, analysisBvId);

    const result = await analysisDefinitionService.createAnalysisDefinitionWithSelection({
      organizationId: orgId,
      analysisBusinessVersionId: analysisBvId,
      sourceStatementPackVersionId: packBvId,
      createdBy: preparerId,
      periodIds: [fy2025PeriodId],
      kpiCodes: ['CURRENT_RATIO', 'DEBT_TO_EQUITY', 'ROE'],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.summary.selectionRowsInserted).toBe(3);
    expect(await countSelectionRows(analysisBvId)).toBe(3);
  });

  it('6. powtórne wywołanie jest idempotentne — zero nowych wierszy, jedna definicja', async () => {
    const { packBvId } = await makeReadyPack();
    const analysis = await makeAnalysis();
    const analysisBvId = analysis.businessVersion.business_version_id;
    await linkAnalysis(packBvId, analysisBvId);

    const first = await analysisDefinitionService.createAnalysisDefinitionWithSelection({
      organizationId: orgId,
      analysisBusinessVersionId: analysisBvId,
      sourceStatementPackVersionId: packBvId,
      createdBy: preparerId,
    });
    const second = await analysisDefinitionService.createAnalysisDefinitionWithSelection({
      organizationId: orgId,
      analysisBusinessVersionId: analysisBvId,
      sourceStatementPackVersionId: packBvId,
      createdBy: preparerId,
    });

    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) throw new Error('unreachable');
    expect(second.summary.selectionRowsInserted).toBe(0);
    expect(second.summary.selectionRowsTotal).toBe(first.summary.selectionRowsTotal);
    expect(await countDefinitions(analysisBvId)).toBe(1);
  });
});
