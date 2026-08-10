/**
 * AP-05 — `financeCompareService.ts`, real PostgreSQL integration test.
 *
 * Same env-var / isolation contract as this repo's other `.pg.test.ts`
 * suites (`RUN_DB_TESTS=1`, `MOCK_DB=false`, `DATABASE_URL=postgresql://...`,
 * `describe.skipIf`-gated) — pattern copied from `statementServices.pg.test.ts`
 * / `kpiComputeService.pg.test.ts` in this same directory.
 *
 * HOW TO RUN (against your own throwaway/ephemeral cluster — NEVER against
 * the shared local Postgres on 5432/PID 911 or any demo/staging/prod host):
 *
 *   DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *   DATABASE_URL=postgresql://postgres@127.0.0.1:<port>/<db> \
 *   npx vitest run --config server/vitest.config.ts \
 *     server/src/services/finance/canonical/__tests__/financeCompareService.pg.test.ts \
 *     --no-file-parallelism
 *
 * Two real-data scenarios (task's explicit test requirement):
 *
 * 1. `compareVersions` — GoldCo FY2024 Statement Pack, ORIGINAL vs RESTATED
 *    (real oracle numbers, `docs/validation/finance-v3/generated/gate-d/
 *    goldco/goldco_oracle.json` `parent.FY2024_original`/`FY2024_restated`).
 *    Proves: (a) only the lines the restatement actually touched
 *    (COGS/INVENTORY/GROSS_MARGIN/EBITDA/EBIT/NET_INCOME/TOTAL_ASSETS) show a
 *    nonzero diff, REVENUE/OPEX show exactly 0; (b) `entity_id` differs
 *    between v1/v2 (copy-on-write — see `financeCompareService.ts`'s
 *    `RawRow.entity_code` doc) yet rows still pair correctly via
 *    `entity_code`; (c) both MISSING flavors round-trip through the real
 *    schema: a line entirely absent from v2 (`CASH`, structural `NO_ROW`) and
 *    a line present in v2 with an explicit `value_status='MISSING'` row
 *    (`WORKING_CAPITAL`) both surface as `MISSING_IN_B` with a null diff,
 *    never a false 0.
 *
 * 2. `compareScenarios` — Base vs Downside Prediction, real WP-D08 Jan-2026
 *    REVENUE figures (`docs/validation/finance-v3/generated/gate-d/
 *    WP-D08_prediction_compute_engine_report.md` section 6). The "Base" side
 *    is a REAL `scenario_mode='STANDARD_BASE'` scenario wired to a Baseline
 *    Model via a `MODEL_TO_SCENARIO` lineage edge, so `compareScenarios`
 *    reads it through the real `finance_prediction_outputs_effective`
 *    passthrough (WP-D07 ADR section 8.3), not a hand-substituted row —
 *    proving the view's `entity_code` JOIN (this module's own fix) resolves
 *    correctly even when the row's `entity_id` belongs to the BASELINE's
 *    business_version_id, not the scenario's own.
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

describe.skipIf(!REAL_PG)('AP-05 financeCompareService — real PostgreSQL', () => {
  let withPinnedPostgresTransaction: typeof import('../../../../database/PostgresDatabase.js').withPinnedPostgresTransaction;
  let artifactVersionService: typeof import('../artifactVersionService.js');
  let lineageService: typeof import('../lineageService.js');
  let compareService: typeof import('../financeCompareService.js');

  const orgId = `org-finv3-ap05-${randomUUID()}`;
  const preparerId = `user-preparer-${randomUUID()}`;
  let calendarId = '';
  let periodFY2024 = '';
  let periodJan2026 = '';
  const lineIds = new Map<string, string>();

  async function lineId(code: string): Promise<string> {
    const cached = lineIds.get(code);
    if (cached) return cached;
    const row = await withPinnedPostgresTransaction((tx) => tx.queryOne<{ id: string }>(`SELECT id FROM financial_statement_lines WHERE line_code = ?`, [code]));
    if (!row) throw new Error(`financial_statement_lines has no line_code=${code}`);
    lineIds.set(code, row.id);
    return row.id;
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

  async function insertStmtLine(businessVersionId: string, entityId: string, canonicalLineId: string, periodId: string, opts: { value: number | null; status?: 'PRESENT_NONZERO' | 'MISSING' }) {
    const status = opts.status ?? (opts.value === null ? 'MISSING' : 'PRESENT_NONZERO');
    await withPinnedPostgresTransaction((tx) =>
      tx.queryRun(
        `INSERT INTO finance_stmt_lines (
           organization_id, business_version_id, statement_type, canonical_line_id, entity_id, period_id,
           accumulation_basis, consolidation_scope, value_status, value_decimal, native_currency,
           presentation_currency, unit, multiplier, accounting_policy, created_by
         ) VALUES (?, ?, 'P&L', ?, ?, ?, 'FULL_YEAR', 'STANDALONE', ?, ?, 'PLN', 'PLN', 'UNITS', 1, 'IFRS', ?)`,
        [orgId, businessVersionId, canonicalLineId, entityId, periodId, status, status === 'MISSING' ? null : opts.value, preparerId]
      )
    );
  }

  beforeAll(async () => {
    ({ withPinnedPostgresTransaction } = await import('../../../../database/PostgresDatabase.js'));
    artifactVersionService = await import('../artifactVersionService.js');
    lineageService = await import('../lineageService.js');
    compareService = await import('../financeCompareService.js');

    await withPinnedPostgresTransaction((tx) => tx.queryRun(`INSERT INTO organizations (id, name) VALUES (?, ?)`, [orgId, 'FinV3 AP-05 Test Org']));

    const cal = await withPinnedPostgresTransaction((tx) =>
      tx.queryOne<{ fiscal_calendar_id: string }>(
        `INSERT INTO finance_stmt_calendars (organization_id, calendar_type, fiscal_year_end_month, effective_from, created_by)
         VALUES (?, 'STANDARD', 12, '2020-01-01', ?) RETURNING fiscal_calendar_id`,
        [orgId, preparerId]
      )
    );
    if (!cal) throw new Error('finance_stmt_calendars fixture insert returned no row');
    calendarId = cal.fiscal_calendar_id;

    const perFY = await withPinnedPostgresTransaction((tx) =>
      tx.queryOne<{ period_id: string }>(
        `INSERT INTO finance_stmt_periods (organization_id, fiscal_calendar_id, period_type, fiscal_year, period_start, period_end, label, created_by)
         VALUES (?, ?, 'FY', 2024, '2024-01-01', '2024-12-31', 'FY2024', ?) RETURNING period_id`,
        [orgId, calendarId, preparerId]
      )
    );
    if (!perFY) throw new Error('finance_stmt_periods FY2024 fixture insert returned no row');
    periodFY2024 = perFY.period_id;

    const perMonth = await withPinnedPostgresTransaction((tx) =>
      tx.queryOne<{ period_id: string }>(
        `INSERT INTO finance_stmt_periods (organization_id, fiscal_calendar_id, period_type, fiscal_year, fiscal_month, period_start, period_end, label, created_by)
         VALUES (?, ?, 'MONTH', 2026, 1, '2026-01-01', '2026-01-31', 'Jan-2026', ?) RETURNING period_id`,
        [orgId, calendarId, preparerId]
      )
    );
    if (!perMonth) throw new Error('finance_stmt_periods Jan-2026 fixture insert returned no row');
    periodJan2026 = perMonth.period_id;
  });

  describe('compareVersions — GoldCo FY2024 Statement Pack, ORIGINAL vs RESTATED', () => {
    it('diffs exactly the restated lines, matches entity_id-varying rows via entity_code, and surfaces both MISSING flavors as null-diff (never false 0)', async () => {
      const created = await artifactVersionService.createArtifact({ organizationId: orgId, artifactType: 'STATEMENT_PACK', createdBy: preparerId });
      const bv1 = created.businessVersion.business_version_id;
      const entity1 = await makeEntity(bv1, 'PARENT');

      // v1 ORIGINAL — real goldco_oracle.json parent.FY2024_original.pl / .bs figures.
      await insertStmtLine(bv1, entity1, await lineId('REVENUE'), periodFY2024, { value: 165_000_000 });
      await insertStmtLine(bv1, entity1, await lineId('COGS'), periodFY2024, { value: 106_000_000 });
      await insertStmtLine(bv1, entity1, await lineId('OPEX'), periodFY2024, { value: 32_000_000 });
      await insertStmtLine(bv1, entity1, await lineId('GROSS_MARGIN'), periodFY2024, { value: 59_000_000 });
      await insertStmtLine(bv1, entity1, await lineId('EBITDA'), periodFY2024, { value: 27_000_000 });
      await insertStmtLine(bv1, entity1, await lineId('EBIT'), periodFY2024, { value: 20_500_000 });
      await insertStmtLine(bv1, entity1, await lineId('NET_INCOME'), periodFY2024, { value: 14_823_000 });
      await insertStmtLine(bv1, entity1, await lineId('INVENTORY'), periodFY2024, { value: 21_000_000 });
      await insertStmtLine(bv1, entity1, await lineId('TOTAL_ASSETS'), periodFY2024, { value: 151_000_000 });
      await insertStmtLine(bv1, entity1, await lineId('WORKING_CAPITAL'), periodFY2024, { value: 38_000_000 });
      await insertStmtLine(bv1, entity1, await lineId('CASH'), periodFY2024, { value: 9_500_000 }); // deliberately NOT carried into v2 -> structural MISSING_IN_B

      // v2 RESTATED — manual sibling row (this suite tests Compare, not the reopen/approve
      // lifecycle machinery already covered by canonicalServices.pg.test.ts; parent_version_id is
      // the one field compareVersions actually reuses per task point 2).
      const engineManifestId = created.businessVersion.engine_manifest_id;
      const bv2Row = await withPinnedPostgresTransaction((tx) =>
        tx.queryOne<{ business_version_id: string }>(
          `INSERT INTO finance_business_versions (
             artifact_id, organization_id, version_no, engine_manifest_id, parent_version_id,
             version_kind, restatement_reason, restatement_class, created_by
           ) VALUES (?, ?, 2, ?, ?, 'RESTATED', 'FY2024 inventory write-down correction', 'ERROR_CORRECTION', ?)
           RETURNING business_version_id`,
          [created.artifact.artifact_id, orgId, engineManifestId, bv1, preparerId]
        )
      );
      if (!bv2Row) throw new Error('manual v2 finance_business_versions insert returned no row');
      const bv2 = bv2Row.business_version_id;
      const entity2 = await makeEntity(bv2, 'PARENT');
      expect(entity2).not.toBe(entity1); // copy-on-write per business_version_id, confirmed live

      // v2 RESTATED — real goldco_oracle.json parent.FY2024_restated figures.
      await insertStmtLine(bv2, entity2, await lineId('REVENUE'), periodFY2024, { value: 165_000_000 }); // unchanged
      await insertStmtLine(bv2, entity2, await lineId('COGS'), periodFY2024, { value: 109_000_000 }); // +3,000,000
      await insertStmtLine(bv2, entity2, await lineId('OPEX'), periodFY2024, { value: 32_000_000 }); // unchanged
      await insertStmtLine(bv2, entity2, await lineId('GROSS_MARGIN'), periodFY2024, { value: 56_000_000 }); // -3,000,000
      await insertStmtLine(bv2, entity2, await lineId('EBITDA'), periodFY2024, { value: 24_000_000 }); // -3,000,000
      await insertStmtLine(bv2, entity2, await lineId('EBIT'), periodFY2024, { value: 17_500_000 }); // -3,000,000
      await insertStmtLine(bv2, entity2, await lineId('NET_INCOME'), periodFY2024, { value: 11_823_000 }); // -3,000,000, matches oracle restatementDeltaNetIncome
      await insertStmtLine(bv2, entity2, await lineId('INVENTORY'), periodFY2024, { value: 18_000_000 }); // -3,000,000
      await insertStmtLine(bv2, entity2, await lineId('TOTAL_ASSETS'), periodFY2024, { value: 148_000_000 }); // -3,000,000
      await insertStmtLine(bv2, entity2, await lineId('WORKING_CAPITAL'), periodFY2024, { value: null, status: 'MISSING' }); // explicit MISSING row
      // CASH: deliberately not inserted at all -> structural NO_ROW on side B.

      const result = await compareService.compareVersions({
        organizationId: orgId,
        artifactType: 'STATEMENT_PACK',
        artifactId: created.artifact.artifact_id,
        businessVersionIdA: bv1,
        businessVersionIdB: bv2,
        consolidationScope: 'STANDALONE',
        accumulationBasis: 'FULL_YEAR',
      });

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('unreachable');
      expect(result.relationship).toBe('B_IS_DIRECT_CHILD_OF_A');
      expect(result.result.summary.totalRows).toBe(11);
      expect(result.result.summary.bothPresent).toBe(9);
      expect(result.result.summary.missingInB).toBe(2);
      expect(result.result.summary.missingInA).toBe(0);
      expect(result.result.summary.currencyMismatch).toBe(0);

      const byLine = new Map(result.result.rows.map((r) => [r.dimensions.canonicalLineId, r]));
      const revenueRow = byLine.get(await lineId('REVENUE'))!;
      expect(revenueRow.diffKind).toBe('BOTH_PRESENT');
      expect(revenueRow.absoluteDiff).toBe(0);
      expect(revenueRow.materialityFlag).toBe(false);

      const opexRow = byLine.get(await lineId('OPEX'))!;
      expect(opexRow.absoluteDiff).toBe(0);

      const cogsRow = byLine.get(await lineId('COGS'))!;
      expect(cogsRow.absoluteDiff).toBe(3_000_000);
      expect(cogsRow.pctDiff).toBeCloseTo(3_000_000 / 106_000_000, 8);

      const inventoryRow = byLine.get(await lineId('INVENTORY'))!;
      expect(inventoryRow.absoluteDiff).toBe(-3_000_000);
      expect(inventoryRow.materialityFlag).toBe(true); // ~-14.3%, over the 5% placeholder

      const netIncomeRow = byLine.get(await lineId('NET_INCOME'))!;
      expect(netIncomeRow.absoluteDiff).toBe(-3_000_000); // matches oracle's own restatementDeltaNetIncome
      expect(netIncomeRow.materialityFlag).toBe(true);

      const totalAssetsRow = byLine.get(await lineId('TOTAL_ASSETS'))!;
      expect(totalAssetsRow.absoluteDiff).toBe(-3_000_000);
      expect(totalAssetsRow.materialityFlag).toBe(false); // ~-1.99%, under 5% despite being a big absolute number

      const wcRow = byLine.get(await lineId('WORKING_CAPITAL'))!;
      expect(wcRow.diffKind).toBe('MISSING_IN_B');
      expect(wcRow.absoluteDiff).toBeNull();
      expect(wcRow.b.presence).toBe('MISSING'); // explicit value_status='MISSING' row, not absent
      expect(wcRow.b.valueStatus).toBe('MISSING');

      const cashRow = byLine.get(await lineId('CASH'))!;
      expect(cashRow.diffKind).toBe('MISSING_IN_B');
      expect(cashRow.absoluteDiff).toBeNull();
      expect(cashRow.b.presence).toBe('NO_ROW'); // structurally absent, distinct from an explicit MISSING row
      expect(cashRow.b.valueStatus).toBeNull();

      // entity_code, not the raw per-version entity_id UUID, is what paired these rows.
      expect(revenueRow.dimensions.entityId).toBe('PARENT');
      expect(revenueRow.a.cellRef?.rowKey.tableName === 'finance_stmt_lines' ? (revenueRow.a.cellRef.rowKey as any).entityId : null).toBe(entity1);
      expect(revenueRow.b.cellRef?.rowKey.tableName === 'finance_stmt_lines' ? (revenueRow.b.cellRef.rowKey as any).entityId : null).toBe(entity2);
    });
  });

  describe('compareScenarios — Base vs Downside Prediction (real WP-D08 Jan-2026 REVENUE)', () => {
    it('Base reads through the real STANDARD_BASE -> finance_baseline_outputs passthrough; direction and magnitude match the published delta', async () => {
      const revenueLineId = await lineId('REVENUE');

      const baselineArtifact = await artifactVersionService.createArtifact({ organizationId: orgId, artifactType: 'BASELINE_MODEL', createdBy: preparerId });
      const baselineBv = baselineArtifact.businessVersion.business_version_id;
      const baselineEntity = await makeEntity(baselineBv, 'PARENT');
      await withPinnedPostgresTransaction((tx) =>
        tx.queryRun(
          `INSERT INTO finance_baseline_outputs (
             organization_id, business_version_id, statement_type, canonical_line_id, entity_id, period_id,
             consolidation_scope, value_status, value_decimal, native_currency, presentation_currency, unit,
             multiplier, value_kind, created_by
           ) VALUES (?, ?, 'P&L', ?, ?, ?, 'CONSOLIDATED', 'PRESENT_NONZERO', ?, 'PLN', 'PLN', 'UNITS', 1, 'FORECAST', ?)`,
          [orgId, baselineBv, revenueLineId, baselineEntity, periodJan2026, 11_943_750.0, preparerId]
        )
      );

      const baseScenarioArtifact = await artifactVersionService.createArtifact({ organizationId: orgId, artifactType: 'PREDICTION_SCENARIO', createdBy: preparerId });
      const baseScenarioBv = baseScenarioArtifact.businessVersion.business_version_id;
      await withPinnedPostgresTransaction((tx) =>
        tx.queryRun(
          `INSERT INTO finance_prediction_scenarios (organization_id, business_version_id, name, scenario_mode, created_by) VALUES (?, ?, 'Base', 'STANDARD_BASE', ?)`,
          [orgId, baseScenarioBv, preparerId]
        )
      );
      const edge = await lineageService.insertEdge({
        organizationId: orgId,
        sourceVersionId: baselineBv,
        sourceArtifactType: 'BASELINE_MODEL',
        targetVersionId: baseScenarioBv,
        targetArtifactType: 'PREDICTION_SCENARIO',
        edgeType: 'MODEL_TO_SCENARIO',
        transformationKind: 'COMPUTE',
        authorId: preparerId,
        assumptionSnapshotHash: 'test-hash-ap05-model-to-scenario',
      });
      expect(edge.ok).toBe(true);

      const downsideArtifact = await artifactVersionService.createArtifact({ organizationId: orgId, artifactType: 'PREDICTION_SCENARIO', createdBy: preparerId });
      const downsideBv = downsideArtifact.businessVersion.business_version_id;
      await withPinnedPostgresTransaction((tx) =>
        tx.queryRun(
          `INSERT INTO finance_prediction_scenarios (organization_id, business_version_id, name, scenario_mode, created_by) VALUES (?, ?, 'Downside', 'STANDARD_DOWNSIDE', ?)`,
          [orgId, downsideBv, preparerId]
        )
      );
      const downsideEntity = await makeEntity(downsideBv, 'PARENT');
      await withPinnedPostgresTransaction((tx) =>
        tx.queryRun(
          `INSERT INTO finance_prediction_outputs (
             organization_id, business_version_id, statement_type, canonical_line_id, entity_id, period_id,
             consolidation_scope, value_status, value_decimal, native_currency, presentation_currency, unit,
             multiplier, created_by
           ) VALUES (?, ?, 'P&L', ?, ?, ?, 'CONSOLIDATED', 'PRESENT_NONZERO', ?, 'PLN', 'PLN', 'UNITS', 1, ?)`,
          [orgId, downsideBv, revenueLineId, downsideEntity, periodJan2026, 11_602_500.0, preparerId]
        )
      );

      const result = await compareService.compareScenarios({
        organizationId: orgId,
        businessVersionIdBase: baseScenarioBv,
        businessVersionIdOther: downsideBv,
        canonicalLineIds: [revenueLineId],
        consolidationScope: 'CONSOLIDATED',
      });

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('unreachable');
      expect(result.result.summary.bothPresent).toBe(1);
      const row = result.result.rows[0];
      expect(row.a.fullUnitValue).toBeCloseTo(11_943_750.0, 4);
      expect(row.b.fullUnitValue).toBeCloseTo(11_602_500.0, 4);
      expect(row.absoluteDiff).toBeCloseTo(-341_250.0, 4); // WP-D08's own published "Downside Δ"
      expect(row.absoluteDiff!).toBeLessThan(0);
      expect(row.pctDiff).toBeCloseTo(-341_250.0 / 11_943_750.0, 8);
      expect(row.dimensions.entityId).toBe('PARENT'); // resolved via the view's finance_stmt_entities JOIN even though the row's real entity_id belongs to the BASELINE's business_version_id, not the scenario's own
    });
  });

  afterAll(async () => {
    // Best-effort only, same convention as this directory's other .pg.test.ts files: append-only
    // triggers on artifact_lifecycle_events/finance_lineage_edges make the parent rows this suite
    // created transitively undeletable via DML — this schema's append-only guarantee, not a bug.
  });
});
