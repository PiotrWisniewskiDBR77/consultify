/**
 * WP-D02 — Statement Pack mapping/reconciliation services, real PostgreSQL
 * integration test.
 *
 * Exercises `statementMappingService.mapStatementLines()` and
 * `statementReconciliationService.runReconciliation()` against the ACTUAL
 * migrated schema (`server/migrations/20260809_finance_v3_d01_statements_*.sql`
 * + the Gate C `..._b0*.sql` files these build on), not a hand-rolled schema —
 * the whole point of this work package is the DB triggers/constraints those
 * migrations installed (balance / cash / retained-earnings / elimination
 * roll-forward, the `uq_finance_stmt_lines_cell` uniqueness, the readiness
 * gate function), which a mocked schema cannot prove.
 *
 * Same env-var contract as this repo's other `.pg.test.ts` suites
 * (`RUN_DB_TESTS=1`, `MOCK_DB=false`, `DATABASE_URL=postgresql://...`) —
 * `describe.skipIf`-gated so a run with no real database reachable reports
 * SKIPPED, never a false green.
 *
 * Isolation: every test uses a freshly generated organization id and its own
 * artifact/business-version chain, so this file never disturbs another
 * file's rows (same convention as `canonicalServices.pg.test.ts` in this
 * directory).
 *
 * HOW TO RUN (against your own throwaway/ephemeral cluster — see
 * `docs/validation/finance-v3/generated/gate-d/WP-D01b_statements_migration_report.md`
 * section 1 for the isolation procedure; NEVER against the shared local
 * Postgres or any demo/staging/prod host):
 *
 *   DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *   DATABASE_URL=postgresql://postgres@127.0.0.1:<port>/<db> \
 *   npx vitest run --config server/vitest.config.ts \
 *     server/src/services/finance/canonical/__tests__/statementServices.pg.test.ts \
 *     --no-file-parallelism
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

describe.skipIf(!REAL_PG)('WP-D02 Statement Pack mapping/reconciliation — real PostgreSQL', () => {
  let withPinnedPostgresTransaction: typeof import('../../../../database/PostgresDatabase.js').withPinnedPostgresTransaction;
  let artifactVersionService: typeof import('../artifactVersionService.js');
  let statementMappingService: typeof import('../statementMappingService.js');
  let statementReconciliationService: typeof import('../statementReconciliationService.js');

  const orgId = `org-finv3-d02-${randomUUID()}`;
  const preparerId = `user-preparer-${randomUUID()}`;
  let calendarId = '';
  let periodId = '';

  async function makeStatementPack() {
    const created = await artifactVersionService.createArtifact({
      organizationId: orgId,
      artifactType: 'STATEMENT_PACK',
      createdBy: preparerId,
    });
    return created;
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

  beforeAll(async () => {
    ({ withPinnedPostgresTransaction } = await import('../../../../database/PostgresDatabase.js'));
    artifactVersionService = await import('../artifactVersionService.js');
    statementMappingService = await import('../statementMappingService.js');
    statementReconciliationService = await import('../statementReconciliationService.js');

    await withPinnedPostgresTransaction((tx) => tx.queryRun(`INSERT INTO organizations (id, name) VALUES (?, ?)`, [orgId, 'FinV3 D02 Test Org']));

    // Calendar/periods are organization-scoped (not business-version-scoped), so one fixture
    // pair is reused across every business version this file creates.
    const cal = await withPinnedPostgresTransaction((tx) =>
      tx.queryOne<{ fiscal_calendar_id: string }>(
        `INSERT INTO finance_stmt_calendars (organization_id, calendar_type, fiscal_year_end_month, effective_from, created_by)
         VALUES (?, 'STANDARD', 12, '2020-01-01', ?) RETURNING fiscal_calendar_id`,
        [orgId, preparerId]
      )
    );
    if (!cal) throw new Error('finance_stmt_calendars fixture insert returned no row');
    calendarId = cal.fiscal_calendar_id;

    const per = await withPinnedPostgresTransaction((tx) =>
      tx.queryOne<{ period_id: string }>(
        `INSERT INTO finance_stmt_periods (organization_id, fiscal_calendar_id, period_type, fiscal_year, period_start, period_end, label, created_by)
         VALUES (?, ?, 'FY', 2025, '2025-01-01', '2025-12-31', 'FY2025', ?) RETURNING period_id`,
        [orgId, calendarId, preparerId]
      )
    );
    if (!per) throw new Error('finance_stmt_periods fixture insert returned no row');
    periodId = per.period_id;
  });

  afterAll(async () => {
    // Best-effort only, same convention as canonicalServices.pg.test.ts: append-only/deny-delete
    // triggers on finance_exceptions/artifact_lifecycle_events/finance_reconciliation_runs'
    // FK chain make the parent rows this suite created transitively undeletable via DML — that
    // is this schema's append-only guarantee working as intended, not a test bug.
  });

  describe('happy path — fully mapped balanced pack reconciles CLEAN and reaches READY_FOR_REVIEW', () => {
    it('maps 6 lines, reconciles with zero residual, and the readiness gate approves DRAFT -> READY_FOR_REVIEW', async () => {
      const created = await makeStatementPack();
      const bvId = created.businessVersion.business_version_id;
      const entityId = await makeEntity(bvId, 'PARENT');
      expect(entityId).toBeTruthy();

      const rules: import('../statementMappingService.js').MappingRule[] = [
        { sourceLabel: 'Total assets', statementType: 'BS', lineCode: 'TOTAL_ASSETS' },
        { sourceLabel: 'Total liabilities and equity', statementType: 'BS', lineCode: 'TOTAL_LIABILITIES_EQUITY' },
        { sourceLabel: 'Cash and cash equivalents', statementType: 'BS', lineCode: 'CASH' },
        { sourceLabel: 'Net income', statementType: 'P&L', lineCode: 'NET_INCOME' },
        { sourceLabel: 'Retained earnings', statementType: 'BS', lineCode: 'RETAINED_EARNINGS' },
        { sourceLabel: 'Dividends declared', statementType: 'BS', lineCode: 'DIVIDENDS_DECLARED' },
      ];
      const rawLines: import('../statementMappingService.js').RawStatementLine[] = [
        { lineItem: 'Total assets', periodId, entityCode: 'PARENT', currency: 'PLN', value: 1_000_000, sourceRef: { page: 3, row: 1 } },
        { lineItem: 'Total liabilities and equity', periodId, entityCode: 'PARENT', currency: 'PLN', value: 1_000_000, sourceRef: { page: 3, row: 20 } },
        { lineItem: 'Cash and cash equivalents', periodId, entityCode: 'PARENT', currency: 'PLN', value: 200_000, sourceRef: { page: 3, row: 2 } },
        { lineItem: 'Net income', periodId, entityCode: 'PARENT', currency: 'PLN', value: 150_000, sourceRef: { page: 2, row: 12 } },
        { lineItem: 'Retained earnings', periodId, entityCode: 'PARENT', currency: 'PLN', value: 300_000, sourceRef: { page: 3, row: 15 } },
        { lineItem: 'Dividends declared', periodId, entityCode: 'PARENT', currency: 'PLN', value: 0, sourceRef: { page: 3, row: 16 } },
      ];

      const mapped = await statementMappingService.mapStatementLines({
        organizationId: orgId,
        businessVersionId: bvId,
        unit: 'UNITS',
        presentationCurrency: 'PLN',
        createdBy: preparerId,
        rawLines,
        rules,
      });
      expect(mapped).toHaveLength(6);
      expect(mapped.every((r) => r.bucket === 'MAPPED')).toBe(true);
      expect(mapped.every((r) => r.stmtLineId !== null)).toBe(true);

      const result = await statementReconciliationService.runReconciliation({
        organizationId: orgId,
        artifactId: created.artifact.artifact_id,
        businessVersionId: bvId,
        sourceSystem: 'mock:parsed_upload',
        mappingResults: mapped,
        createdBy: preparerId,
        attemptReadinessTransition: true,
        actorId: preparerId,
        role: 'preparer',
        expectedVersion: created.businessVersion.version,
      });

      expect(result.totals.sourceTotal).toBe(2_650_000);
      expect(result.totals.canonicalTotal).toBe(2_650_000);
      expect(result.totals.residual).toBe(0);
      expect(result.run.status).toBe('CLEAN');
      expect(result.exception).toBeNull();

      expect(result.readiness.checked).toBe(true);
      const failedChecks = result.readiness.checks.filter((c) => !c.passed);
      expect(failedChecks).toEqual([]);
      expect(result.readiness.ready).toBe(true);
      expect(result.readiness.transitionAttempted).toBe(true);
      expect(result.readiness.transitionResult?.ok).toBe(true);
      expect(result.readiness.businessVersion?.status).toBe('READY_FOR_REVIEW');

      // Confirm directly against the DB — not just the service's own return value.
      const bvRow = await withPinnedPostgresTransaction((tx) =>
        tx.queryOne<{ status: string }>(`SELECT status FROM finance_business_versions WHERE business_version_id = ?`, [bvId])
      );
      expect(bvRow?.status).toBe('READY_FOR_REVIEW');
    });
  });

  describe('CD Projekt regression — two mapping rules for the same source position landing on the same cell', () => {
    it('is caught as a DUPLICATE reconciliation row + an EXCEEDS_MATERIALITY exception, and blocks the readiness gate — never silently passes', async () => {
      // Replicates the audit finding (memory: p4-apator-realny-upload-2026-08-06 / the program
      // handoff's section 3 problem #1): "Statement" and "Analysis" reported radically different
      // margins for the same period because two different source labels for what should be the
      // same line landed on two different totals with no reconciliation catching it. Here: two
      // raw source rows ("Operating profit" from one page, "EBIT (reported)" from another) both
      // map to the SAME canonical cell (entity/EBIT/period) with two DIFFERENT values.
      const created = await makeStatementPack();
      const bvId = created.businessVersion.business_version_id;
      await makeEntity(bvId, 'CDP');

      const rules: import('../statementMappingService.js').MappingRule[] = [
        { sourceLabel: 'Operating profit', statementType: 'P&L', lineCode: 'EBIT' },
        { sourceLabel: 'EBIT (reported)', statementType: 'P&L', lineCode: 'EBIT' },
      ];
      const rawLines: import('../statementMappingService.js').RawStatementLine[] = [
        { lineItem: 'Operating profit', periodId, entityCode: 'CDP', currency: 'PLN', value: 500_000, sourceRef: { source: 'Statement', page: 2 } },
        { lineItem: 'EBIT (reported)', periodId, entityCode: 'CDP', currency: 'PLN', value: 620_000, sourceRef: { source: 'Analysis', page: 7 } },
      ];

      const mapped = await statementMappingService.mapStatementLines({
        organizationId: orgId,
        businessVersionId: bvId,
        unit: 'UNITS',
        presentationCurrency: 'PLN',
        createdBy: preparerId,
        rawLines,
        rules,
      });

      expect(mapped[0].bucket).toBe('MAPPED');
      expect(mapped[0].stmtLineId).not.toBeNull();
      expect(mapped[1].bucket).toBe('DUPLICATE');
      expect(mapped[1].stmtLineId).toBeNull();
      expect(mapped[1].duplicateOfRowIndex).toBe(0);

      const result = await statementReconciliationService.runReconciliation({
        organizationId: orgId,
        artifactId: created.artifact.artifact_id,
        businessVersionId: bvId,
        sourceSystem: 'mock:parsed_upload',
        mappingResults: mapped,
        createdBy: preparerId,
        attemptReadinessTransition: true,
        actorId: preparerId,
        role: 'preparer',
        expectedVersion: created.businessVersion.version,
      });

      expect(result.totals.sourceTotal).toBe(1_120_000);
      expect(result.totals.canonicalTotal).toBe(500_000);
      expect(result.totals.duplicateTotal).toBe(620_000);
      // The whole point: the 620,000 duplicate is NEVER netted out of the residual formula.
      expect(result.totals.residual).toBe(620_000);
      expect(result.run.status).toBe('EXCEEDS_MATERIALITY');

      // An exception was raised — not silently passed through.
      expect(result.exception).not.toBeNull();
      expect(result.exception?.severity).toBe('CRITICAL_DATA'); // 620,000/1,120,000 ≈ 55% >> 5x the 5% threshold
      expect(result.exception?.reason_code).toBe('RECONCILIATION_RESIDUAL_EXCEEDS_MATERIALITY');
      expect(result.run.linked_exception_id).toBe(result.exception?.id);

      // Confirm the exception is really in the DB, not just in the service's return value.
      const exceptionRow = await withPinnedPostgresTransaction((tx) =>
        tx.queryOne<{ severity: string; state: string }>(
          `SELECT severity, state FROM finance_exceptions_current WHERE organization_id = ? AND exception_group_id = ?`,
          [orgId, result.exception!.id]
        )
      );
      expect(exceptionRow?.severity).toBe('CRITICAL_DATA');
      expect(exceptionRow?.state).toBe('OPEN');

      // Readiness gate: BOTH the unresolved-duplicate check and the residual-tolerance check
      // must fail — this is caught on two independent axes, not one.
      const byName = new Map(result.readiness.checks.map((c) => [c.check_name, c]));
      expect(byName.get('RECONCILIATION_NO_OPEN_UNMAPPED_DUPLICATE')?.passed).toBe(false);
      expect(byName.get('RECONCILIATION_RESIDUAL_WITHIN_TOLERANCE')?.passed).toBe(false);
      expect(result.readiness.ready).toBe(false);
      expect(result.readiness.transitionAttempted).toBe(false);

      // The business version must still be DRAFT — no silent progression.
      const bvRow = await withPinnedPostgresTransaction((tx) =>
        tx.queryOne<{ status: string }>(`SELECT status FROM finance_business_versions WHERE business_version_id = ?`, [bvId])
      );
      expect(bvRow?.status).toBe('DRAFT');
    });
  });

  describe('MISSING values never become a silent zero', () => {
    it('a raw row with value=null is written as value_status=MISSING/value_decimal=NULL, contributes 0 (not a fabricated PRESENT_ZERO), and blocks readiness on the mapping-completeness check specifically', async () => {
      const created = await makeStatementPack();
      const bvId = created.businessVersion.business_version_id;
      await makeEntity(bvId, 'MISS');

      const rules: import('../statementMappingService.js').MappingRule[] = [{ sourceLabel: 'Inventory', statementType: 'BS', lineCode: 'INVENTORY' }];
      const rawLines: import('../statementMappingService.js').RawStatementLine[] = [
        { lineItem: 'Inventory', periodId, entityCode: 'MISS', currency: 'PLN', value: null, sourceRef: { note: 'source page illegible' } },
      ];

      const mapped = await statementMappingService.mapStatementLines({
        organizationId: orgId,
        businessVersionId: bvId,
        unit: 'UNITS',
        presentationCurrency: 'PLN',
        createdBy: preparerId,
        rawLines,
        rules,
      });

      expect(mapped[0].bucket).toBe('MAPPED'); // successfully mapped to a real cell — just no source value
      expect(mapped[0].stmtLineId).not.toBeNull();
      expect(mapped[0].mappedAmount).toBeNull();
      expect(mapped[0].sourceAmount).toBe(0);

      const stmtLineRow = await withPinnedPostgresTransaction((tx) =>
        tx.queryOne<{ value_status: string; value_decimal: string | null }>(
          `SELECT value_status, value_decimal FROM finance_stmt_lines WHERE id = ?`,
          [mapped[0].stmtLineId]
        )
      );
      expect(stmtLineRow?.value_status).toBe('MISSING');
      expect(stmtLineRow?.value_decimal).toBeNull(); // never a fabricated 0

      const result = await statementReconciliationService.runReconciliation({
        organizationId: orgId,
        artifactId: created.artifact.artifact_id,
        businessVersionId: bvId,
        sourceSystem: 'mock:parsed_upload',
        mappingResults: mapped,
        createdBy: preparerId,
        attemptReadinessTransition: true,
        actorId: preparerId,
        role: 'preparer',
        expectedVersion: created.businessVersion.version,
      });

      // No fabricated discrepancy: a MISSING cell contributes 0 to both source and canonical.
      expect(result.totals.residual).toBe(0);
      expect(result.run.status).toBe('CLEAN');
      expect(result.exception).toBeNull();

      const byName = new Map(result.readiness.checks.map((c) => [c.check_name, c]));
      expect(byName.get('MAPPING_COMPLETE_NO_MISSING')?.passed).toBe(false);
      expect(byName.get('MAPPING_COMPLETE_NO_MISSING')?.detail).toContain('1 cell(s) with value_status=MISSING');
      // Every OTHER check passes — this is a targeted, single-axis block, not a blanket failure.
      expect(byName.get('RECONCILIATION_RESIDUAL_WITHIN_TOLERANCE')?.passed).toBe(true);
      expect(result.readiness.ready).toBe(false);
      expect(result.readiness.transitionAttempted).toBe(false);
    });
  });

  describe('EXCLUDED bucket — explicitly skipped rows are subtracted out, not silently dropped', () => {
    it('an EXCLUDE-action row keeps its reason code, is never written to finance_stmt_lines, and still reconciles CLEAN', async () => {
      const created = await makeStatementPack();
      const bvId = created.businessVersion.business_version_id;
      await makeEntity(bvId, 'EXCL');

      const rules: import('../statementMappingService.js').MappingRule[] = [
        { sourceLabel: 'Total assets', statementType: 'BS', lineCode: 'TOTAL_ASSETS' },
        { sourceLabel: 'Total liabilities and equity', statementType: 'BS', lineCode: 'TOTAL_LIABILITIES_EQUITY' },
        {
          sourceLabel: 'One-time non-recurring gain',
          statementType: 'P&L',
          lineCode: 'REVENUE',
          action: 'EXCLUDE',
          excludeReasonCode: 'NON_RECURRING',
        },
      ];
      const rawLines: import('../statementMappingService.js').RawStatementLine[] = [
        { lineItem: 'Total assets', periodId, entityCode: 'EXCL', currency: 'PLN', value: 1_000_000, sourceRef: {} },
        { lineItem: 'Total liabilities and equity', periodId, entityCode: 'EXCL', currency: 'PLN', value: 1_000_000, sourceRef: {} },
        { lineItem: 'One-time non-recurring gain', periodId, entityCode: 'EXCL', currency: 'PLN', value: 75_000, sourceRef: {} },
      ];

      const mapped = await statementMappingService.mapStatementLines({
        organizationId: orgId,
        businessVersionId: bvId,
        unit: 'UNITS',
        presentationCurrency: 'PLN',
        createdBy: preparerId,
        rawLines,
        rules,
      });

      const excludedRow = mapped.find((r) => r.bucket === 'EXCLUDED');
      expect(excludedRow).toBeDefined();
      expect(excludedRow?.stmtLineId).toBeNull();
      expect(excludedRow?.reasonCode).toBe('NON_RECURRING');
      expect(excludedRow?.canonicalLineId).not.toBeNull(); // rule matched, just chose to exclude

      const result = await statementReconciliationService.runReconciliation({
        organizationId: orgId,
        artifactId: created.artifact.artifact_id,
        businessVersionId: bvId,
        sourceSystem: 'mock:parsed_upload',
        mappingResults: mapped,
        createdBy: preparerId,
      });

      expect(result.totals.sourceTotal).toBe(2_075_000);
      expect(result.totals.excludedTotal).toBe(75_000);
      expect(result.totals.canonicalTotal).toBe(2_000_000);
      expect(result.totals.residual).toBe(0);
      expect(result.run.status).toBe('CLEAN');
      expect(result.exception).toBeNull();

      const reconRow = result.reconciliationRows.find((r) => r.bucket === 'EXCLUDED');
      expect(reconRow?.reason_code).toBe('NON_RECURRING');
    });
  });

  // BUG-GOLDCO-02 regression (docs/validation/finance-v3/generated/gate-d/
  // GOLDCO_STATEMENTS_VERTICAL_SLICE_REPORT.md §6): finance_stmt_check_balance()
  // (and the cash/retained-earnings roll-forward triggers, same code pattern)
  // used to hardcode `consolidation_scope = 'CONSOLIDATED'` in their lookups,
  // so a Statement Pack mapped at consolidation_scope='STANDALONE' (the
  // schema's own documented scope for a genuine single-entity, non-group
  // pack — WP-D01 ADR §4.5) never triggered the Assets=Liabilities+Equity
  // check at all. Fixed by the additive migration
  // 20260809_finance_v3_d01b_statements_02b_integrity_scope_fix.sql, which
  // CREATE OR REPLACEs the three trigger functions to check NEW.consolidation_scope
  // instead. This suite requires that migration to have been applied to the
  // target cluster (same as every other check in this file — real DDL, not a
  // mocked schema).
  describe('BUG-GOLDCO-02 fix — balance check now fires for STANDALONE scope, not just CONSOLIDATED', () => {
    const UNBALANCED_DELTA = 50_000_000;

    async function unbalancedProbe(scope: 'STANDALONE' | 'CONSOLIDATED') {
      const pack = await makeStatementPack();
      const bvId = pack.businessVersion.business_version_id;
      await makeEntity(bvId, `PROBE-${scope}`);
      const rawLines: import('../statementMappingService.js').RawStatementLine[] = [
        { lineItem: 'Total assets', periodId, entityCode: `PROBE-${scope}`, currency: 'PLN', value: 100_000_000, sourceRef: {} },
        { lineItem: 'Total liabilities and equity', periodId, entityCode: `PROBE-${scope}`, currency: 'PLN', value: 100_000_000 - UNBALANCED_DELTA, sourceRef: {} },
      ];
      const rules: import('../statementMappingService.js').MappingRule[] = [
        { sourceLabel: 'Total assets', statementType: 'BS', lineCode: 'TOTAL_ASSETS', consolidationScope: scope },
        { sourceLabel: 'Total liabilities and equity', statementType: 'BS', lineCode: 'TOTAL_LIABILITIES_EQUITY', consolidationScope: scope },
      ];
      return statementMappingService.mapStatementLines({
        organizationId: orgId,
        businessVersionId: bvId,
        unit: 'UNITS',
        presentationCurrency: 'PLN',
        createdBy: preparerId,
        rawLines,
        rules,
      });
    }

    it('a PLN 50,000,000 imbalance at consolidationScope=STANDALONE is now rejected (was silently accepted pre-fix)', async () => {
      await expect(unbalancedProbe('STANDALONE')).rejects.toThrow(/balance check failed/);
    });

    it('a PLN 50,000,000 imbalance at consolidationScope=CONSOLIDATED is still rejected (no regression on the already-checked scope)', async () => {
      await expect(unbalancedProbe('CONSOLIDATED')).rejects.toThrow(/balance check failed/);
    });

    it('a balanced pack at consolidationScope=STANDALONE still commits cleanly (fix does not over-reject)', async () => {
      const pack = await makeStatementPack();
      const bvId = pack.businessVersion.business_version_id;
      await makeEntity(bvId, 'PROBE-BALANCED');
      const rawLines: import('../statementMappingService.js').RawStatementLine[] = [
        { lineItem: 'Total assets', periodId, entityCode: 'PROBE-BALANCED', currency: 'PLN', value: 500_000, sourceRef: {} },
        { lineItem: 'Total liabilities and equity', periodId, entityCode: 'PROBE-BALANCED', currency: 'PLN', value: 500_000, sourceRef: {} },
      ];
      const rules: import('../statementMappingService.js').MappingRule[] = [
        { sourceLabel: 'Total assets', statementType: 'BS', lineCode: 'TOTAL_ASSETS', consolidationScope: 'STANDALONE' },
        { sourceLabel: 'Total liabilities and equity', statementType: 'BS', lineCode: 'TOTAL_LIABILITIES_EQUITY', consolidationScope: 'STANDALONE' },
      ];
      const mapped = await statementMappingService.mapStatementLines({
        organizationId: orgId,
        businessVersionId: bvId,
        unit: 'UNITS',
        presentationCurrency: 'PLN',
        createdBy: preparerId,
        rawLines,
        rules,
      });
      expect(mapped).toHaveLength(2);
      expect(mapped.every((r) => r.bucket === 'MAPPED')).toBe(true);
    });
  });

  /**
   * RC-02 / RC-03 regressions — both require the additive migration
   * `20260810_finance_v3_d01c_real_company_integrity_fix.sql` to be applied to the target cluster.
   *
   * REAL DATA: Grupa Apator's filed consolidated IFRS statements, thousand PLN, `unit='THOUSANDS'`,
   * transcribed verbatim from
   * `docs/validation/finance-v3/generated/STATEMENT_IMPORT_SAMPLE_AUDIT_2026-03-15.json` and
   * cross-checked against `docs/validation/finance-v3/generated/gate-d/REAL_COMPANY_PROOF_report.md`
   * §3/§5 (RC-02, RC-03).
   */
  describe('RC-02 / RC-03 fixes — real Apator IFRS pack (unit=THOUSANDS)', () => {
    /** FY2024 balance-sheet total, as filed: PLN 965 357 thousand (REAL_COMPANY_PROOF §3). */
    const APATOR_TOTAL_ASSETS_FY2024 = 965_357;
    /** Retained-earnings bridge, as filed (REAL_COMPANY_PROOF §5 RC-02). */
    const APATOR_RE = {
      openingFy2023: -29_215,
      netIncomeFy2023: 8_504,
      dividendsFy2023: 14_612,
      closingFy2023: -72_699,
    } as const;
    /** −29 215 + 8 504 − 14 612 = −35 323 vs reported −72 699 -> 37 376 thousand PLN unexplained. */
    const APATOR_RE_GAP =
      Math.abs(
        APATOR_RE.openingFy2023 + APATOR_RE.netIncomeFy2023 - APATOR_RE.dividendsFy2023 - APATOR_RE.closingFy2023
      );

    let thousandsCalendarId = '';
    let fy2022Id = '';
    let fy2023Id = '';
    let fy2024Id = '';

    beforeAll(async () => {
      // Dedicated calendar: `uq_finance_stmt_period_fy` is unique per (calendar, fiscal_year) and
      // the shared fixture calendar in this file already owns FY2025.
      const cal = await withPinnedPostgresTransaction((tx) =>
        tx.queryOne<{ fiscal_calendar_id: string }>(
          `INSERT INTO finance_stmt_calendars (organization_id, calendar_type, fiscal_year_end_month, effective_from, created_by)
           VALUES (?, 'STANDARD', 12, '2019-01-01', ?) RETURNING fiscal_calendar_id`,
          [orgId, preparerId]
        )
      );
      if (!cal) throw new Error('Apator fixture calendar insert returned no row');
      thousandsCalendarId = cal.fiscal_calendar_id;

      const mkPeriod = async (fiscalYear: number, previous: string | null) => {
        const row = await withPinnedPostgresTransaction((tx) =>
          tx.queryOne<{ period_id: string }>(
            `INSERT INTO finance_stmt_periods (organization_id, fiscal_calendar_id, period_type, fiscal_year, period_start, period_end, label, previous_period_id, created_by)
             VALUES (?, ?, 'FY', ?, ?, ?, ?, ?, ?) RETURNING period_id`,
            [
              orgId, thousandsCalendarId, fiscalYear,
              `${fiscalYear}-01-01`, `${fiscalYear}-12-31`, `FY${fiscalYear}`, previous, preparerId,
            ]
          )
        );
        if (!row) throw new Error(`FY${fiscalYear} period insert returned no row`);
        return row.period_id;
      };
      fy2022Id = await mkPeriod(2022, null);
      fy2023Id = await mkPeriod(2023, fy2022Id);
      fy2024Id = await mkPeriod(2024, fy2023Id);
    });

    // -----------------------------------------------------------------------------------
    // RC-03 — the balance tolerance used to scale 1000x with the declared unit.
    // -----------------------------------------------------------------------------------
    describe('RC-03 — balance tolerance is compared in the same scale as the value', () => {
      /** Files the real Apator FY2024 total assets and a Liabilities+Equity side that is
       *  `imbalanceThousands` thousand PLN short of it. */
      async function apatorBalanceProbe(imbalanceThousands: number) {
        const pack = await makeStatementPack();
        const bvId = pack.businessVersion.business_version_id;
        const entityCode = `APATOR-BS-${imbalanceThousands}`;
        await makeEntity(bvId, entityCode);
        const rawLines: import('../statementMappingService.js').RawStatementLine[] = [
          { lineItem: 'AKTYWA RAZEM', periodId: fy2024Id, entityCode, currency: 'PLN', value: APATOR_TOTAL_ASSETS_FY2024, sourceRef: {} },
          {
            lineItem: 'PASYWA RAZEM', periodId: fy2024Id, entityCode, currency: 'PLN',
            value: APATOR_TOTAL_ASSETS_FY2024 - imbalanceThousands, sourceRef: {},
          },
        ];
        const rules: import('../statementMappingService.js').MappingRule[] = [
          { sourceLabel: 'AKTYWA RAZEM', statementType: 'BS', lineCode: 'TOTAL_ASSETS' },
          { sourceLabel: 'PASYWA RAZEM', statementType: 'BS', lineCode: 'TOTAL_LIABILITIES_EQUITY' },
        ];
        return statementMappingService.mapStatementLines({
          organizationId: orgId,
          businessVersionId: bvId,
          unit: 'THOUSANDS',
          presentationCurrency: 'PLN',
          createdBy: preparerId,
          rawLines,
          rules,
        });
      }

      it('a 500-thousand (PLN 500 000) imbalance at unit=THOUSANDS is rejected (pre-fix: silently ACCEPTED — tolerance was 1000 thousand = PLN 1 000 000)', async () => {
        await expect(apatorBalanceProbe(500)).rejects.toThrow(/balance check failed/);
      });

      it('the tolerance reported by the trigger is 1 presentation unit, not 1000', async () => {
        await expect(apatorBalanceProbe(500)).rejects.toThrow(/diff=500 tolerance=1(\D|$)/);
      });

      it('a 1 500-thousand imbalance is still rejected (no regression on what already failed)', async () => {
        await expect(apatorBalanceProbe(1_500)).rejects.toThrow(/balance check failed/);
      });

      it('the genuinely balanced Apator FY2024 balance sheet still commits (fix does not over-reject)', async () => {
        const mapped = await apatorBalanceProbe(0);
        expect(mapped).toHaveLength(2);
        expect(mapped.every((r) => r.bucket === 'MAPPED')).toBe(true);
      });

      it('a 1-unit rounding difference is still tolerated at THOUSANDS (two independently rounded subtotals)', async () => {
        const mapped = await apatorBalanceProbe(1);
        expect(mapped).toHaveLength(2);
        expect(mapped.every((r) => r.bucket === 'MAPPED')).toBe(true);
      });
    });

    // -----------------------------------------------------------------------------------
    // RC-02 — the retained-earnings roll-forward used to abort the whole import.
    // -----------------------------------------------------------------------------------
    describe('RC-02 — an unexplained retained-earnings roll-forward raises an exception instead of destroying the import', () => {
      /** Files the real Apator FY2022->FY2023 retained-earnings bridge. `otherEquityMovements`
       *  null = the pack does not disclose the bridge (what the extractor actually produced). */
      async function apatorRollForwardImport(otherEquityMovements: number | null) {
        const pack = await makeStatementPack();
        const bvId = pack.businessVersion.business_version_id;
        const entityCode = `APATOR-RE-${otherEquityMovements ?? 'none'}`;
        await makeEntity(bvId, entityCode);

        const rawLines: import('../statementMappingService.js').RawStatementLine[] = [
          { lineItem: 'Niepodzielony wynik finansowy 2022', periodId: fy2022Id, entityCode, currency: 'PLN', value: APATOR_RE.openingFy2023, sourceRef: {} },
          { lineItem: 'Niepodzielony wynik finansowy 2023', periodId: fy2023Id, entityCode, currency: 'PLN', value: APATOR_RE.closingFy2023, sourceRef: {} },
          { lineItem: 'Zysk netto 2023', periodId: fy2023Id, entityCode, currency: 'PLN', value: APATOR_RE.netIncomeFy2023, sourceRef: {} },
          { lineItem: 'Wyplacona dywidenda 2023', periodId: fy2023Id, entityCode, currency: 'PLN', value: APATOR_RE.dividendsFy2023, sourceRef: {} },
        ];
        const rules: import('../statementMappingService.js').MappingRule[] = [
          { sourceLabel: 'Niepodzielony wynik finansowy 2022', statementType: 'BS', lineCode: 'RETAINED_EARNINGS' },
          { sourceLabel: 'Niepodzielony wynik finansowy 2023', statementType: 'BS', lineCode: 'RETAINED_EARNINGS' },
          { sourceLabel: 'Zysk netto 2023', statementType: 'P&L', lineCode: 'NET_INCOME' },
          { sourceLabel: 'Wyplacona dywidenda 2023', statementType: 'BS', lineCode: 'DIVIDENDS_DECLARED' },
        ];
        if (otherEquityMovements !== null) {
          rawLines.push({ lineItem: 'Pozostale zmiany kapitalu 2023', periodId: fy2023Id, entityCode, currency: 'PLN', value: otherEquityMovements, sourceRef: {} });
          rules.push({ sourceLabel: 'Pozostale zmiany kapitalu 2023', statementType: 'BS', lineCode: 'OTHER_EQUITY_MOVEMENTS' });
        }

        const mapped = await statementMappingService.mapStatementLines({
          organizationId: orgId,
          businessVersionId: bvId,
          unit: 'THOUSANDS',
          presentationCurrency: 'PLN',
          createdBy: preparerId,
          rawLines,
          rules,
        });
        return { bvId, mapped };
      }

      it('the import COMMITS (pre-fix: the whole transaction was aborted by a RAISE EXCEPTION)', async () => {
        const { bvId, mapped } = await apatorRollForwardImport(null);
        expect(mapped).toHaveLength(4);
        expect(mapped.every((r) => r.bucket === 'MAPPED')).toBe(true);

        // The rows really are in the table after COMMIT — not just returned by the service.
        const persisted = await withPinnedPostgresTransaction((tx) =>
          tx.queryOne<{ n: string }>(`SELECT COUNT(*)::text AS n FROM finance_stmt_lines WHERE business_version_id = ?`, [bvId])
        );
        expect(Number(persisted?.n)).toBe(4);
      });

      it('a MATERIAL finance_exceptions row is raised carrying the real 37 376 thousand PLN gap', async () => {
        const { bvId } = await apatorRollForwardImport(null);

        const exc = await withPinnedPostgresTransaction((tx) =>
          tx.queryOne<{
            event_type: string; severity: string; reason_code: string; state: string;
            expected: string; observed: string; delta: string; unit: string; evidence: Record<string, unknown>;
          }>(
            `SELECT event_type, severity, reason_code, state, expected, observed, delta, unit, evidence
               FROM finance_exceptions_current WHERE business_version_id = ?`,
            [bvId]
          )
        );
        expect(exc, 'no exception raised for the unexplained roll-forward').toBeTruthy();
        expect(exc?.event_type).toBe('RAISED');
        expect(exc?.state).toBe('OPEN');
        expect(exc?.reason_code).toBe('RE_ROLLFORWARD_UNEXPLAINED');
        // 37 376 / 72 699 = 51.4% of closing RE -> far above the 5%
        // PROVISIONAL_PENDING_OWNER_DECISION placeholder threshold.
        expect(exc?.severity).toBe('MATERIAL');
        expect(exc?.unit).toBe('THOUSANDS');
        expect(Number(exc?.expected)).toBe(
          APATOR_RE.openingFy2023 + APATOR_RE.netIncomeFy2023 - APATOR_RE.dividendsFy2023
        ); // -35 323 implied
        expect(Number(exc?.observed)).toBe(APATOR_RE.closingFy2023); // -72 699 reported
        expect(Math.abs(Number(exc?.delta))).toBe(APATOR_RE_GAP); // 37 376
        expect(Number((exc?.evidence as { gap?: number })?.gap)).toBe(APATOR_RE_GAP);
      });

      it('exactly ONE exception is logged for the cell, not one per row of the batch', async () => {
        const { bvId } = await apatorRollForwardImport(null);
        const row = await withPinnedPostgresTransaction((tx) =>
          tx.queryOne<{ n: string }>(`SELECT COUNT(*)::text AS n FROM finance_exceptions WHERE business_version_id = ?`, [bvId])
        );
        expect(Number(row?.n)).toBe(1);
      });

      it('the business version is marked PROVISIONAL, so downstream work continues under a declared quality (DEC-FIN-009)', async () => {
        const { bvId } = await apatorRollForwardImport(null);
        const bv = await withPinnedPostgresTransaction((tx) =>
          tx.queryOne<{ result_quality: string | null; status: string }>(
            `SELECT result_quality, status FROM finance_business_versions WHERE business_version_id = ?`,
            [bvId]
          )
        );
        expect(bv?.result_quality).toBe('PROVISIONAL');
        expect(bv?.status).toBe('DRAFT'); // import is alive, not rolled back
      });

      it('when the pack DOES disclose the bridge (OTHER_EQUITY_MOVEMENTS = −37 376), the identity closes and nothing is raised', async () => {
        const { bvId, mapped } = await apatorRollForwardImport(-APATOR_RE_GAP);
        expect(mapped).toHaveLength(5);
        expect(mapped.every((r) => r.bucket === 'MAPPED')).toBe(true);

        const row = await withPinnedPostgresTransaction((tx) =>
          tx.queryOne<{ n: string }>(`SELECT COUNT(*)::text AS n FROM finance_exceptions WHERE business_version_id = ?`, [bvId])
        );
        expect(Number(row?.n)).toBe(0);

        const bv = await withPinnedPostgresTransaction((tx) =>
          tx.queryOne<{ result_quality: string | null }>(
            `SELECT result_quality FROM finance_business_versions WHERE business_version_id = ?`,
            [bvId]
          )
        );
        expect(bv?.result_quality).toBeNull();
      });

      it('Assets = Liabilities + Equity still HARD-rejects — RC-02 relaxes the roll-forward, not the accounting identity', async () => {
        const pack = await makeStatementPack();
        const bvId = pack.businessVersion.business_version_id;
        await makeEntity(bvId, 'APATOR-IDENTITY-GUARD');
        const rawLines: import('../statementMappingService.js').RawStatementLine[] = [
          { lineItem: 'AKTYWA RAZEM', periodId: fy2024Id, entityCode: 'APATOR-IDENTITY-GUARD', currency: 'PLN', value: APATOR_TOTAL_ASSETS_FY2024, sourceRef: {} },
          { lineItem: 'PASYWA RAZEM', periodId: fy2024Id, entityCode: 'APATOR-IDENTITY-GUARD', currency: 'PLN', value: APATOR_TOTAL_ASSETS_FY2024 - 10_000, sourceRef: {} },
        ];
        const rules: import('../statementMappingService.js').MappingRule[] = [
          { sourceLabel: 'AKTYWA RAZEM', statementType: 'BS', lineCode: 'TOTAL_ASSETS' },
          { sourceLabel: 'PASYWA RAZEM', statementType: 'BS', lineCode: 'TOTAL_LIABILITIES_EQUITY' },
        ];
        await expect(
          statementMappingService.mapStatementLines({
            organizationId: orgId, businessVersionId: bvId, unit: 'THOUSANDS',
            presentationCurrency: 'PLN', createdBy: preparerId, rawLines, rules,
          })
        ).rejects.toThrow(/balance check failed/);
      });
    });
  });
});
