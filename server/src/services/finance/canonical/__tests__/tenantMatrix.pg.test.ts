/**
 * W9 FAULT/CONCURRENCY/TENANT MATRIX — part C: TENANT ISOLATION, as a MATRIX
 * across every main Finance table family, not a single spot check.
 *
 * Gate FC-01 (tenant isolation) / Fala 9. Source of requirements:
 * `docs/validation/finance-v3/FINANCE_COMPLETE_PROGRAM_CLAUDE_HANDOFF_2026-08-09.md` §16/§18.
 *
 * METHOD. Two organizations, A and B, are seeded with a MIRRORED data set (same
 * shape, different values, so a leak is recognisable by its value, not only by
 * its id). Every family is then probed on two levels:
 *
 *   (i)  QUERY level — the representative SELECT/UPDATE the services issue,
 *        with `organization_id = A` and B's row id. Zero rows is the pass.
 *        This proves the DATA MODEL can express isolation.
 *   (ii) SERVICE level — the real public entry point, called with
 *        `organizationId: A` and an id belonging to B. Refusal is the pass;
 *        returning B's data, or mutating B's rows, is a FINDING.
 *
 * Level (ii) is the one that matters: a tenant boundary that only holds
 * because every caller remembered to add a predicate is not a boundary. Where
 * a leak was found it was asserted here AS a leak — a red test would have
 * been deleted by the next person; a green test that pins the defective
 * behaviour with a `DEFECT W9-C-n` label cannot be lost, and turns red the
 * moment the defect is fixed (which is exactly when someone should come back
 * to it).
 *
 * STATUS (P0_TENANT_ISOLATION_FIX, this same work package, 2026-08-10): every
 * `DEFECT W9-C-n` assertion below that pinned a real leak or a signal-quality
 * gap (W9-C-1 through W9-C-6, plus the structural W9-C-7 table list) has been
 * INVERTED to assert the fix instead — tests now labelled `FIXED W9-C-n`,
 * still describing what they used to prove in a comment, per the same
 * "cannot be lost" discipline: a red test here means the boundary
 * regressed, not that a defect reappeared.
 *
 * There are no RLS policies and no `SET LOCAL app.current_org` in this schema
 * (0 policies exist), so nothing below can be delegated to the database's own
 * row filtering. Isolation is application-level by construction.
 *
 * HOW TO RUN (own throwaway ephemeral cluster only — NEVER shared/demo/staging/prod):
 *
 *   DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *   DATABASE_URL=postgresql://postgres@127.0.0.1:<port>/<db> \
 *   npx vitest run --config vitest.config.ts \
 *     src/services/finance/canonical/__tests__/tenantMatrix.pg.test.ts \
 *     --no-file-parallelism
 *   (run from `server/`)
 */
import { randomUUID } from 'node:crypto';

import { beforeAll, describe, expect, it } from 'vitest';

const CONNECTION_STRING = process.env.DATABASE_URL ?? '';
const REAL_PG_REQUESTED =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  CONNECTION_STRING.startsWith('postgres');
if (REAL_PG_REQUESTED) {
  process.env.DB_TYPE = 'postgres';
}
const REAL_PG = REAL_PG_REQUESTED;

interface SeededOrg {
  orgId: string;
  userId: string;
  stmtArtifactId: string;
  stmtBvId: string;
  periodId: string;
  entityId: string;
  anaBvId: string;
  baselineArtifactId: string;
  baselineBvId: string;
  valuationBvId: string;
  methodId: string;
  predictionBvId: string;
  jobId: string;
  exceptionGroupId: string;
  /** Sentinel numeric value written into every family's rows for this org. */
  marker: number;
}

describe.skipIf(!REAL_PG)('W9-C — tenant isolation matrix (real PostgreSQL)', () => {
  let withPinnedPostgresTransaction: typeof import('../../../../database/PostgresDatabase.js').withPinnedPostgresTransaction;
  let av: typeof import('../artifactVersionService.js');
  let baseline: typeof import('../baselineComputeService.js');
  let kpi: typeof import('../kpiComputeService.js');
  let preflight: typeof import('../predictionPreflightService.js');
  let valc: typeof import('../valuationComputeService.js');
  let wacc: typeof import('../valuationWaccService.js');
  let sens: typeof import('../valuationSensitivityService.js');
  let advisor: typeof import('../valuationAdvisorService.js');
  let exceptions: typeof import('../exceptionLedgerService.js');
  let jobsSvc: typeof import('../computeJobService.js');

  let A: SeededOrg;
  let B: SeededOrg;

  const t = <T>(fn: (tx: any) => Promise<T>): Promise<T> => withPinnedPostgresTransaction(fn as never) as Promise<T>;

  async function seedOrg(tag: 'A' | 'B', marker: number): Promise<SeededOrg> {
    const orgId = `org-w9c-${tag}-${randomUUID()}`;
    const userId = `user-w9c-${tag}-${randomUUID()}`;
    await t((tx) => tx.queryRun(`INSERT INTO organizations (id, name) VALUES (?, ?)`, [orgId, `W9C Org ${tag}`]));

    // --- STATEMENT family ---------------------------------------------------
    const stmt = await av.createArtifact({ organizationId: orgId, artifactType: 'STATEMENT_PACK', createdBy: userId });
    const stmtBvId = stmt.businessVersion.business_version_id;
    const calendarId = `cal-${randomUUID()}`;
    await t((tx) =>
      tx.queryRun(
        `INSERT INTO finance_stmt_calendars (fiscal_calendar_id, organization_id, calendar_type, fiscal_year_end_month,
           fiscal_year_end_reference, effective_from, created_by) VALUES (?, ?, 'STANDARD', 12, 'LAST_DAY_OF_MONTH', ?, ?)`,
        [calendarId, orgId, '2024-01-01', userId]
      )
    );
    const periodId = `per-${randomUUID()}`;
    await t((tx) =>
      tx.queryRun(
        `INSERT INTO finance_stmt_periods (period_id, organization_id, fiscal_calendar_id, period_type, fiscal_year,
           fiscal_month, period_start, period_end, label, created_by)
         VALUES (?, ?, ?, 'MONTH', 2025, 1, ?, ?, ?, ?)`,
        [periodId, orgId, calendarId, '2025-01-01', '2025-01-31', `Jan 2025 ${tag}`, userId]
      )
    );
    const entityId = `ent-${randomUUID()}`;
    await t((tx) =>
      tx.queryRun(
        `INSERT INTO finance_stmt_entities (id, organization_id, business_version_id, entity_code, legal_name, role,
           consolidation_method, ownership_pct, functional_currency, created_by)
         VALUES (?, ?, ?, 'PARENT', ?, 'GROUP_PARENT', 'FULL', 100, 'PLN', ?)`,
        [entityId, orgId, stmtBvId, `${tag} Manufacturing S.A.`, userId]
      )
    );
    const revenueLine = await t((tx) =>
      tx.queryOne<{ id: string }>(`SELECT id FROM financial_statement_lines WHERE line_code = 'REVENUE' LIMIT 1`)
    );
    await t((tx) =>
      tx.queryRun(
        `INSERT INTO finance_stmt_lines (id, organization_id, business_version_id, statement_type, canonical_line_id,
           entity_id, period_id, value_status, value_decimal, native_currency, presentation_currency, unit,
           accounting_policy, created_by)
         VALUES (?, ?, ?, 'P&L', ?, ?, ?, 'PRESENT_NONZERO', ?, 'PLN', 'PLN', 'UNITS', 'IFRS', ?)`,
        [randomUUID(), orgId, stmtBvId, revenueLine!.id, entityId, periodId, marker, userId]
      )
    );

    // --- ANALYSIS family ----------------------------------------------------
    const analysis = await av.createArtifact({ organizationId: orgId, artifactType: 'HISTORICAL_ANALYSIS', createdBy: userId });
    const anaBvId = analysis.businessVersion.business_version_id;
    await t((tx) =>
      tx.queryRun(
        `INSERT INTO finance_lineage_edges (id, organization_id, source_version_id, source_artifact_type, target_version_id,
           target_artifact_type, edge_type, transformation_kind, author_id)
         VALUES (?, ?, ?, 'STATEMENT_PACK', ?, 'HISTORICAL_ANALYSIS', 'STATEMENT_TO_ANALYSIS', 'COMPUTE', ?)`,
        [randomUUID(), orgId, stmtBvId, anaBvId, userId]
      )
    );
    const catalogRow = await t((tx) =>
      tx.queryOne<{ id: string }>(`SELECT id FROM finance_analysis_kpi_catalog WHERE kpi_code = 'GROSS_MARGIN_PCT' LIMIT 1`)
    );
    await t((tx) =>
      tx.queryRun(
        `INSERT INTO finance_analysis_kpi_values (id, organization_id, business_version_id, kpi_catalog_id, entity_id,
           period_id, value_status, value_decimal)
         VALUES (?, ?, ?, ?, ?, ?, 'PRESENT_NONZERO', ?)`,
        [randomUUID(), orgId, anaBvId, catalogRow!.id, entityId, periodId, marker]
      )
    );

    // --- BASELINE family ----------------------------------------------------
    const baselineArtifact = await av.createArtifact({ organizationId: orgId, artifactType: 'BASELINE_MODEL', createdBy: userId });
    const baselineBvId = baselineArtifact.businessVersion.business_version_id;
    await t((tx) =>
      tx.queryRun(
        `INSERT INTO finance_lineage_edges (id, organization_id, source_version_id, source_artifact_type, target_version_id,
           target_artifact_type, edge_type, transformation_kind, author_id)
         VALUES (?, ?, ?, 'STATEMENT_PACK', ?, 'BASELINE_MODEL', 'STATEMENT_TO_MODEL', 'COMPUTE', ?)`,
        [randomUUID(), orgId, stmtBvId, baselineBvId, userId]
      )
    );
    await t((tx) =>
      tx.queryRun(
        `INSERT INTO finance_baseline_models (id, organization_id, business_version_id, horizon_months, horizon_rationale,
           horizon_rationale_note, created_by) VALUES (?, ?, ?, 12, 'DEBT_MATURITY', ?, ?)`,
        [randomUUID(), orgId, baselineBvId, `${tag} horizon rationale`, userId]
      )
    );
    await t((tx) =>
      tx.queryRun(
        `INSERT INTO finance_baseline_assumptions (id, organization_id, business_version_id, schedule_type, driver_code,
           entity_id, period_id, rule, unit, value_status, value_decimal, created_by)
         VALUES (?, ?, ?, 'revenue_pvm', 'REVENUE_GROWTH_YOY', ?, ?, 'GROWTH_RATE', 'PCT', 'PRESENT_NONZERO', ?, ?)`,
        [randomUUID(), orgId, baselineBvId, entityId, periodId, marker / 100000, userId]
      )
    );
    await t((tx) =>
      tx.queryRun(
        `INSERT INTO finance_baseline_schedules (id, organization_id, business_version_id, schedule_type, entity_id,
           schedule_item_code, effective_from_period_id, payload, created_by)
         VALUES (?, ?, ?, 'debt_maturity', ?, 'FACILITY_A', ?, ?, ?)`,
        [
          randomUUID(),
          orgId,
          baselineBvId,
          entityId,
          periodId,
          JSON.stringify({ principal_opening: marker, contractual_rate: 0.05, amortization_schedule: Array(12).fill(1) }),
          userId,
        ]
      )
    );

    // --- VALUATION family ---------------------------------------------------
    const valuation = await av.createArtifact({ organizationId: orgId, artifactType: 'VALUATION_CASE', createdBy: userId });
    const valuationBvId = valuation.businessVersion.business_version_id;
    const methodResult = await valc.findOrCreateMethod({
      organizationId: orgId,
      businessVersionId: valuationBvId,
      methodType: 'DCF_FCFF',
      createdBy: userId,
    });
    if (!methodResult.ok) throw new Error(`seed: findOrCreateMethod failed ${methodResult.code}`);
    const method = methodResult.method;
    await t((tx) =>
      tx.queryRun(
        `INSERT INTO finance_valuation_wacc_inputs (id, organization_id, business_version_id, currency, nominal_or_real,
           pre_or_post_tax, created_by) VALUES (?, ?, ?, 'PLN', 'NOMINAL', 'POST_TAX', ?)`,
        [randomUUID(), orgId, valuationBvId, userId]
      )
    );

    // --- PREDICTION family --------------------------------------------------
    const prediction = await av.createArtifact({ organizationId: orgId, artifactType: 'PREDICTION_SCENARIO', createdBy: userId });
    const predictionBvId = prediction.businessVersion.business_version_id;
    await t((tx) =>
      tx.queryRun(
        `INSERT INTO finance_prediction_scenarios (id, organization_id, business_version_id, name, scenario_mode, created_by)
         VALUES (?, ?, ?, ?, 'STANDARD_BASE', ?)`,
        [randomUUID(), orgId, predictionBvId, `${tag} scenario`, userId]
      )
    );
    await t((tx) =>
      tx.queryRun(
        `INSERT INTO finance_lineage_edges (id, organization_id, source_version_id, source_artifact_type, target_version_id,
           target_artifact_type, edge_type, transformation_kind, assumption_snapshot_hash, author_id)
         VALUES (?, ?, ?, 'BASELINE_MODEL', ?, 'PREDICTION_SCENARIO', 'MODEL_TO_SCENARIO', 'COMPUTE', ?, ?)`,
        [randomUUID(), orgId, baselineBvId, predictionBvId, `snapshot-${tag}`, userId]
      )
    );

    // --- EXCEPTIONS family --------------------------------------------------
    const raised = await exceptions.raise({
      organizationId: orgId,
      artifactId: baselineArtifact.artifact.artifact_id,
      businessVersionId: baselineBvId,
      severity: 'WARNING',
      sourceRef: { tag, marker },
      raisedBy: userId,
    });
    if (!raised.ok) throw new Error(`seed: exception raise failed ${raised.code}`);

    // --- COMPUTE JOBS family ------------------------------------------------
    const job = await jobsSvc.enqueue({
      organizationId: orgId,
      jobType: 'w9c_probe_job',
      inputArtifactId: baselineArtifact.artifact.artifact_id,
      inputRevisionHash: `hash-${tag}`,
      engineManifestId: baselineArtifact.businessVersion.engine_manifest_id,
      idempotencyKey: `w9c-${tag}-${randomUUID()}`,
      requestedByUserId: userId,
    });

    return {
      orgId,
      userId,
      stmtArtifactId: stmt.artifact.artifact_id,
      stmtBvId,
      periodId,
      entityId,
      anaBvId,
      baselineArtifactId: baselineArtifact.artifact.artifact_id,
      baselineBvId,
      valuationBvId,
      methodId: method.id,
      predictionBvId,
      jobId: job.job.id,
      exceptionGroupId: raised.exception.exception_group_id,
      marker,
    };
  }

  beforeAll(async () => {
    ({ withPinnedPostgresTransaction } = await import('../../../../database/PostgresDatabase.js'));
    av = await import('../artifactVersionService.js');
    baseline = await import('../baselineComputeService.js');
    kpi = await import('../kpiComputeService.js');
    preflight = await import('../predictionPreflightService.js');
    valc = await import('../valuationComputeService.js');
    wacc = await import('../valuationWaccService.js');
    sens = await import('../valuationSensitivityService.js');
    advisor = await import('../valuationAdvisorService.js');
    exceptions = await import('../exceptionLedgerService.js');
    jobsSvc = await import('../computeJobService.js');

    A = await seedOrg('A', 1000);
    B = await seedOrg('B', 9999);
  }, 120_000);

  /** Physical proof that both orgs really do hold their own mirrored row. */
  it('precondition: both orgs hold a full mirrored data set with distinct marker values', async () => {
    for (const org of [A, B]) {
      const counts = await t((tx) =>
        tx.queryOne<Record<string, string>>(
          `SELECT
             (SELECT count(*) FROM finance_artifacts WHERE organization_id = $1)::text AS artifacts,
             (SELECT count(*) FROM finance_stmt_lines WHERE organization_id = $1)::text AS stmt_lines,
             (SELECT count(*) FROM finance_analysis_kpi_values WHERE organization_id = $1)::text AS kpi_values,
             (SELECT count(*) FROM finance_baseline_assumptions WHERE organization_id = $1)::text AS baseline_assumptions,
             (SELECT count(*) FROM finance_prediction_scenarios WHERE organization_id = $1)::text AS scenarios,
             (SELECT count(*) FROM finance_valuation_methods WHERE organization_id = $1)::text AS methods,
             (SELECT count(*) FROM finance_exceptions WHERE organization_id = $1)::text AS exceptions,
             (SELECT count(*) FROM compute_jobs WHERE organization_id = $1)::text AS jobs`,
          [org.orgId]
        )
      );
      expect(Number(counts!.artifacts)).toBe(5);
      expect(Number(counts!.stmt_lines)).toBe(1);
      expect(Number(counts!.kpi_values)).toBe(1);
      expect(Number(counts!.baseline_assumptions)).toBe(1);
      expect(Number(counts!.scenarios)).toBe(1);
      expect(Number(counts!.methods)).toBe(1);
      expect(Number(counts!.exceptions)).toBe(1);
      expect(Number(counts!.jobs)).toBe(1);
    }
    expect(A.marker).not.toBe(B.marker);
  });

  // =========================================================================
  // FAMILY 1 — finance_artifacts / finance_business_versions
  // =========================================================================
  describe('family 1 — finance_artifacts / finance_business_versions', () => {
    it('query level: A-scoped SELECT cannot see B rows', async () => {
      const rows = await t((tx) =>
        tx.queryAll<{ business_version_id: string }>(
          `SELECT business_version_id FROM finance_business_versions WHERE organization_id = ? AND business_version_id = ?`,
          [A.orgId, B.baselineBvId]
        )
      );
      expect(rows).toHaveLength(0);
    });

    it('service level READ: getArtifact / getBusinessVersion / listBusinessVersions all refuse', async () => {
      expect(await av.getArtifact(A.orgId, B.baselineArtifactId)).toBeNull();
      expect(await av.getBusinessVersion(A.orgId, B.baselineBvId)).toBeNull();
      expect(await av.listBusinessVersions(A.orgId, B.baselineArtifactId)).toEqual([]);
    });

    it('service level MUTATION: transition / approveVersion / reopenVersion refuse, B row byte-identical', async () => {
      const before = await t((tx) =>
        tx.queryOne<{ status: string; version: number; updated_at: string }>(
          `SELECT status, version, updated_at FROM finance_business_versions WHERE business_version_id = ?`,
          [B.baselineBvId]
        )
      );

      const transitioned = await av.transition({
        organizationId: A.orgId,
        businessVersionId: B.baselineBvId,
        action: 'submit_for_review',
        actorId: A.userId,
        role: 'preparer',
        expectedVersion: before!.version,
      });
      expect(transitioned.ok).toBe(false);
      if (transitioned.ok) throw new Error('unreachable');
      expect(transitioned.code).toBe('NOT_FOUND');

      const approved = await av.approveVersion({
        organizationId: A.orgId,
        businessVersionId: B.baselineBvId,
        actorId: A.userId,
        role: 'approver',
        expectedVersion: before!.version,
      });
      expect(approved.ok).toBe(false);
      if (approved.ok) throw new Error('unreachable');
      expect(approved.code).toBe('NOT_FOUND');

      const reopened = await av.reopenVersion({
        organizationId: A.orgId,
        businessVersionId: B.baselineBvId,
        actorId: A.userId,
        role: 'approver',
        expectedVersion: before!.version,
        reason: 'cross-tenant reopen attempt',
      });
      expect(reopened.ok).toBe(false);
      if (reopened.ok) throw new Error('unreachable');
      expect(reopened.code).toBe('NOT_FOUND');

      const after = await t((tx) =>
        tx.queryOne<{ status: string; version: number; updated_at: string }>(
          `SELECT status, version, updated_at FROM finance_business_versions WHERE business_version_id = ?`,
          [B.baselineBvId]
        )
      );
      expect(after!.status).toBe(before!.status);
      expect(after!.version).toBe(before!.version);
      expect(new Date(after!.updated_at).getTime()).toBe(new Date(before!.updated_at).getTime());
    });
  });

  // =========================================================================
  // FAMILY 2 — finance_stmt_*
  // =========================================================================
  describe('family 2 — finance_stmt_* (entities / periods / lines)', () => {
    it('query level: A-scoped SELECT and UPDATE touch zero B rows', async () => {
      const lines = await t((tx) =>
        tx.queryAll<{ id: string }>(
          `SELECT id FROM finance_stmt_lines WHERE organization_id = ? AND business_version_id = ?`,
          [A.orgId, B.stmtBvId]
        )
      );
      expect(lines).toHaveLength(0);

      const entities = await t((tx) =>
        tx.queryAll<{ id: string }>(
          `SELECT id FROM finance_stmt_entities WHERE organization_id = ? AND business_version_id = ?`,
          [A.orgId, B.stmtBvId]
        )
      );
      expect(entities).toHaveLength(0);

      const updated = await t((tx) =>
        tx.queryRun(
          `UPDATE finance_stmt_lines SET value_decimal = 0 WHERE organization_id = ? AND business_version_id = ?`,
          [A.orgId, B.stmtBvId]
        )
      );
      expect(updated.changes).toBe(0);

      // B's value is untouched and still B's marker.
      const bValue = await t((tx) =>
        tx.queryOne<{ value_decimal: string }>(
          `SELECT value_decimal FROM finance_stmt_lines WHERE business_version_id = ?`,
          [B.stmtBvId]
        )
      );
      expect(Number(bValue!.value_decimal)).toBe(B.marker);
    });

    it('FIXED W9-C-1: baselineComputeService.loadContext() refuses ANOTHER ORG\'s statement cells and model (was: DEFECT — returned B\'s data)', async () => {
      // BEFORE the fix this asserted `loaded.ok === true` and that org A,
      // calling with org B's baseline businessVersionId, received B's
      // model/assumptions/schedules (identified by B's marker) — a full
      // cross-tenant model-data read. `loadContext()` now predicates every
      // one of those reads (finance_baseline_models, finance_business_versions,
      // finance_stmt_lines, finance_baseline_schedules,
      // finance_baseline_assumptions) on organization_id, so the FIRST one
      // (finance_baseline_models) refuses and the typed NOT_FOUND-shaped
      // result propagates — never another org's data, never a raw error.
      const loaded = await baseline.loadContext({
        organizationId: A.orgId,
        businessVersionId: B.baselineBvId,
        requestedByUserId: A.userId,
        engineManifestId: 'irrelevant-for-load',
        entityId: B.entityId,
        forecastPeriodIds: [B.periodId],
        openingBalanceSheetPeriodId: B.periodId,
      });

      expect(loaded.ok).toBe(false);
      if (loaded.ok) throw new Error('unreachable');
      expect(loaded.code).toBe('NO_BASELINE_MODEL_ROW');

      // Independent physical read: B's own baseline model row is untouched —
      // this was a read-only attempt, and it never even reached B's data.
      const bModel = await t((tx) =>
        tx.queryOne<{ organization_id: string }>(`SELECT organization_id FROM finance_baseline_models WHERE business_version_id = ?`, [
          B.baselineBvId,
        ])
      );
      expect(bModel!.organization_id).toBe(B.orgId);
    });

    it('the same call from B\'s OWN context returns the same data — proving the leak is not an artefact of a broken fixture', async () => {
      const loaded = await baseline.loadContext({
        organizationId: B.orgId,
        businessVersionId: B.baselineBvId,
        requestedByUserId: B.userId,
        engineManifestId: 'irrelevant-for-load',
        entityId: B.entityId,
        forecastPeriodIds: [B.periodId],
        openingBalanceSheetPeriodId: B.periodId,
      });
      expect(loaded.ok).toBe(true);
      if (!loaded.ok) throw new Error('unreachable');
      expect(loaded.ctx.model.organization_id).toBe(B.orgId);
    });
  });

  // =========================================================================
  // FAMILY 3 — finance_analysis_*
  // =========================================================================
  describe('family 3 — finance_analysis_* (definitions / kpi values / variance)', () => {
    it('query level: A-scoped SELECT cannot see B KPI values', async () => {
      const rows = await t((tx) =>
        tx.queryAll<{ id: string }>(
          `SELECT id FROM finance_analysis_kpi_values WHERE organization_id = ? AND business_version_id = ?`,
          [A.orgId, B.anaBvId]
        )
      );
      expect(rows).toHaveLength(0);
    });

    it('FIXED W9-C-6 (P2): computeAnalysisKpis(orgA, bvB) fails closed with a TYPED result (was: DEFECT — untyped throw)', async () => {
      // `computeAnalysisKpis` guards on `getBusinessVersion(organizationId, ...)`
      // returning null, which IS org-scoped — isolation held even before this
      // fix. BEFORE the fix it threw a bare `Error` instead of returning a
      // typed `{ok:false}` like every other failure mode of the same
      // function, so an HTTP layer mapped a tenant-boundary refusal to a 500
      // rather than a 404. Now returns `{ok:false, code:'BUSINESS_VERSION_NOT_FOUND'}`
      // — a resolved Promise, not a rejection.
      const result = await kpi.computeAnalysisKpis({
        organizationId: A.orgId,
        businessVersionId: B.anaBvId,
        requestedByUserId: A.userId,
      });
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error('unreachable');
      expect(result.code).toBe('BUSINESS_VERSION_NOT_FOUND');

      // No KPI value of B's was recomputed or overwritten.
      const bValue = await t((tx) =>
        tx.queryOne<{ value_decimal: string }>(
          `SELECT value_decimal FROM finance_analysis_kpi_values WHERE business_version_id = ?`,
          [B.anaBvId]
        )
      );
      expect(Number(bValue!.value_decimal)).toBe(B.marker);
    });
  });

  // =========================================================================
  // FAMILY 4 — finance_baseline_*
  // =========================================================================
  describe('family 4 — finance_baseline_* (models / assumptions / schedules / outputs)', () => {
    it('query level: A-scoped SELECT/UPDATE touch zero B rows', async () => {
      const models = await t((tx) =>
        tx.queryAll<{ id: string }>(
          `SELECT id FROM finance_baseline_models WHERE organization_id = ? AND business_version_id = ?`,
          [A.orgId, B.baselineBvId]
        )
      );
      expect(models).toHaveLength(0);

      const touched = await t((tx) =>
        tx.queryRun(
          `UPDATE finance_baseline_assumptions SET value_decimal = 0
            WHERE organization_id = ? AND business_version_id = ?`,
          [A.orgId, B.baselineBvId]
        )
      );
      expect(touched.changes).toBe(0);
    });

    it('the composite FK (business_version_id, organization_id) blocks a mis-attributed WRITE at the DB', async () => {
      // This is what actually stops DEFECT W9-C-1 from becoming a cross-tenant
      // WRITE: `fk_finance_baseline_outputs_bv_org` requires the pair to exist
      // in `uq_finance_bv_id_org`. Org A cannot write an output row against
      // B's business version. Raw 23503, not a typed service error.
      const revenueLine = await t((tx) =>
        tx.queryOne<{ id: string }>(`SELECT id FROM financial_statement_lines WHERE line_code = 'REVENUE' LIMIT 1`)
      );
      await expect(
        t((tx) =>
          tx.queryRun(
            `INSERT INTO finance_baseline_outputs (
               id, organization_id, business_version_id, statement_type, canonical_line_id, entity_id, period_id,
               value_status, value_decimal, native_currency, presentation_currency, unit, value_kind, created_by)
             VALUES (?, ?, ?, 'P&L', ?, ?, ?, 'PRESENT_NONZERO', 1, 'PLN', 'PLN', 'UNITS', 'FORECAST', ?)`,
            [randomUUID(), A.orgId, B.baselineBvId, revenueLine!.id, B.entityId, B.periodId, A.userId]
          )
        )
      ).rejects.toThrow(/foreign key constraint|violates/i);
    });
  });

  // =========================================================================
  // FAMILY 5 — finance_prediction_*
  // =========================================================================
  describe('family 5 — finance_prediction_* (scenarios / overrides / preflight)', () => {
    it('query level: A-scoped SELECT cannot see B scenarios', async () => {
      const rows = await t((tx) =>
        tx.queryAll<{ id: string }>(
          `SELECT id FROM finance_prediction_scenarios WHERE organization_id = ? AND business_version_id = ?`,
          [A.orgId, B.predictionBvId]
        )
      );
      expect(rows).toHaveLength(0);
    });

    it('FIXED W9-C-2: runPreflight(orgA, bvB) refuses TYPED, never reaches B\'s scenario data (was: DEFECT — raw FK error after reading B)', async () => {
      // BEFORE the fix this asserted the call THREW a raw Postgres foreign-key
      // error (`fk_finance_prediction_preflight_runs_bv_org`) — proof the
      // service had already read B's scenario/assumption data and only the
      // DB's own defense-in-depth stopped the eventual write. `runPreflight()`
      // now predicates its very first read (finance_prediction_scenarios) on
      // organization_id, so it refuses immediately with the same typed
      // NO_SCENARIO_ROW shape it already used for a genuinely unknown
      // scenario — a resolved Promise, not a rejection, and never a raw DB
      // error surfacing to the caller.
      const result = await preflight.runPreflight({
        organizationId: A.orgId,
        businessVersionId: B.predictionBvId,
        runBy: A.userId,
      });
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error('unreachable');
      expect(result.code).toBe('NO_SCENARIO_ROW');

      // Nothing was persisted under either org.
      const runs = await t((tx) =>
        tx.queryAll<{ id: string }>(`SELECT id FROM finance_prediction_preflight_runs WHERE business_version_id = ?`, [
          B.predictionBvId,
        ])
      );
      expect(runs).toHaveLength(0);

      // Independent physical read: B's scenario row is untouched.
      const bScenario = await t((tx) =>
        tx.queryOne<{ organization_id: string }>(`SELECT organization_id FROM finance_prediction_scenarios WHERE business_version_id = ?`, [
          B.predictionBvId,
        ])
      );
      expect(bScenario!.organization_id).toBe(B.orgId);
    });
  });

  // =========================================================================
  // FAMILY 6 — finance_valuation_*
  // =========================================================================
  describe('family 6 — finance_valuation_* (cases / methods / wacc / sensitivity / advisor)', () => {
    it('query level: A-scoped SELECT cannot see B methods or WACC inputs', async () => {
      const methods = await t((tx) =>
        tx.queryAll<{ id: string }>(
          `SELECT id FROM finance_valuation_methods WHERE organization_id = ? AND business_version_id = ?`,
          [A.orgId, B.valuationBvId]
        )
      );
      expect(methods).toHaveLength(0);
      expect(await wacc.loadWaccInputs(A.orgId, B.valuationBvId)).toBeNull();
      expect(await advisor.listAdvisorOutputs(A.orgId, B.valuationBvId)).toEqual([]);
    });

    it('FIXED W9-C-3: findOrCreateMethod(orgA, bvB) refuses TYPED (was: DEFECT — returned B\'s method row)', async () => {
      // BEFORE the fix this asserted `method.id === B.methodId` — org A got
      // org B's method row back (organization_id included), which was then
      // the vector into W9-C-4. `findOrCreateMethod()` now verifies the
      // business_version_id belongs to organizationId FIRST and refuses with
      // a typed BUSINESS_VERSION_NOT_FOUND — never another org's row, never
      // a raw FK error from the fallback INSERT path.
      const result = await valc.findOrCreateMethod({
        organizationId: A.orgId,
        businessVersionId: B.valuationBvId,
        methodType: 'DCF_FCFF',
        createdBy: A.userId,
      });
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error('unreachable');
      expect(result.code).toBe('BUSINESS_VERSION_NOT_FOUND');

      // Independent physical read: no new finance_valuation_methods row was
      // created for A against B's business version, and B's own method row
      // (seeded once, DCF_FCFF) is still exactly one row, still B's.
      const methodsForBv = await t((tx) =>
        tx.queryAll<{ id: string; organization_id: string }>(
          `SELECT id, organization_id FROM finance_valuation_methods WHERE business_version_id = ? AND method_type = 'DCF_FCFF'`,
          [B.valuationBvId]
        )
      );
      expect(methodsForBv).toHaveLength(1);
      expect(methodsForBv[0].id).toBe(B.methodId);
      expect(methodsForBv[0].organization_id).toBe(B.orgId);
    });

    it('FIXED W9-C-4: writeSensitivityGrid() refuses to touch org B\'s grid (was: DEFECT — destroyed and replaced B\'s 25 cells)', async () => {
      // BEFORE the fix this proved org A could upsert against B's methodId
      // and DELETE+replace B's 25 cells with its own — the single worst
      // finding in the matrix, a cross-tenant DESTRUCTIVE write with no audit
      // trail (the sensitivity tables are not append-only). Now
      // `writeSensitivityGrid()` verifies methodId belongs to organizationId
      // BEFORE touching the grid/cells tables (typed SensitivityGridAccessError),
      // backstopped by the W9-C-7 structural migration's composite FK on both
      // finance_valuation_sensitivity_grids and `..._cells`.
      const cells = Array.from({ length: 25 }, (_, i) => ({
        rowIndex: Math.floor(i / 5) + 1,
        colIndex: (i % 5) + 1,
        rowAxisValue: 0.1 + i * 0.001,
        columnAxisValue: 0.02,
        cellValueDecimal: 100 + i,
        isBaseCell: i === 12,
      }));

      // B writes its own grid, legitimately.
      await sens.writeSensitivityGrid({
        organizationId: B.orgId,
        methodId: B.methodId,
        gridLabel: 'W9C_WACC_X_G',
        rowAxisVariable: 'WACC',
        columnAxisVariable: 'TERMINAL_G',
        cells,
        createdBy: B.userId,
      });

      const ownedByBBefore = await t((tx) =>
        tx.queryAll<{ id: string }>(
          `SELECT c.id FROM finance_valuation_sensitivity_cells c
             JOIN finance_valuation_sensitivity_grids g ON g.id = c.grid_id
            WHERE g.method_id = ? AND g.grid_label = 'W9C_WACC_X_G' AND c.organization_id = ?`,
          [B.methodId, B.orgId]
        )
      );
      expect(ownedByBBefore).toHaveLength(25); // physical pre-state

      // A attempts to write the SAME grid label against B's method — must be refused.
      await expect(
        sens.writeSensitivityGrid({
          organizationId: A.orgId,
          methodId: B.methodId,
          gridLabel: 'W9C_WACC_X_G',
          rowAxisVariable: 'WACC',
          columnAxisVariable: 'TERMINAL_G',
          cells: cells.map((c) => ({ ...c, cellValueDecimal: c.cellValueDecimal + 1_000_000 })),
          createdBy: A.userId,
        })
      ).rejects.toThrow(/method .* not found for organization/i);

      // Independent physical read: B's 25 cells are UNTOUCHED, and no cell of
      // A's ever landed on B's grid.
      const ownership = await t((tx) =>
        tx.queryAll<{ organization_id: string; n: string }>(
          `SELECT c.organization_id, count(*)::text AS n FROM finance_valuation_sensitivity_cells c
             JOIN finance_valuation_sensitivity_grids g ON g.id = c.grid_id
            WHERE g.method_id = ? AND g.grid_label = 'W9C_WACC_X_G'
            GROUP BY c.organization_id`,
          [B.methodId]
        )
      );
      expect(ownership).toHaveLength(1);
      expect(ownership[0].organization_id).toBe(B.orgId);
      expect(Number(ownership[0].n)).toBe(25);

      const bCellsAfter = await t((tx) =>
        tx.queryAll<{ id: string; cell_value_decimal: string }>(
          `SELECT c.id, c.cell_value_decimal FROM finance_valuation_sensitivity_cells c
             JOIN finance_valuation_sensitivity_grids g ON g.id = c.grid_id
            WHERE g.method_id = ? AND g.grid_label = 'W9C_WACC_X_G' AND c.organization_id = ?`,
          [B.methodId, B.orgId]
        )
      );
      expect(bCellsAfter).toHaveLength(25); // still B's original 25 rows
      const ids = new Set(ownedByBBefore.map((r) => r.id));
      expect(bCellsAfter.every((r) => ids.has(r.id))).toBe(true); // same rows, not recreated
    });

    it('STRUCTURAL W9-C-7 FIXED: every valuation child table with a real parent now has a composite tenant FK (was: DEFECT — 6 unguarded)', async () => {
      // BEFORE the fix this pinned exactly 6 unguarded tables (cases, comps,
      // ev_equity_bridge_components, sensitivity_cells, sensitivity_grids,
      // terminal) as PROOF of the structural gap behind W9-C-4. The
      // W9-C-7 migration (20260825_finance_v3_w9c7_valuation_child_tenant_fk.sql)
      // now adds a composite (parent, organization_id) FK to five of those six
      // real CHILD tables (comps, ev_equity_bridge_components,
      // sensitivity_cells, sensitivity_grids, terminal).
      //
      // `finance_valuation_cases` DELIBERATELY remains in the "no composite
      // FK" list — not because it was missed, but because it structurally
      // CANNOT have one: it is a ROOT table (case_id PK, organization_id
      // REFERENCES organizations(id) directly, no business_version_id /
      // method_id / grid_id of its own — see
      // `20260809_finance_v3_d09_valuation_01_tables.sql` section 1). Same
      // class as finance_stmt_calendars/finance_stmt_periods, which the
      // source W9 report itself calls "skalowane tylko org FK — poprawnie".
      // Confirmed by grep over server/src: zero production services read or
      // write finance_valuation_cases, so there is no live leak vector here
      // either — this SQL heuristic (composite FK exists?) simply cannot
      // distinguish "root table, correctly scoped" from "child table,
      // leaking", and finance_valuation_cases is the former.
      const unguarded = await t((tx) =>
        tx.queryAll<{ tbl: string }>(
          `WITH t AS (
             SELECT c.relname AS tbl FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
              WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname LIKE 'finance_valuation%'
           ), hasorg AS (
             SELECT t.tbl FROM t
              WHERE EXISTS (SELECT 1 FROM information_schema.columns col
                             WHERE col.table_name = t.tbl AND col.column_name = 'organization_id')
           ), composite AS (
             SELECT DISTINCT conrelid::regclass::text AS tbl FROM pg_constraint
              WHERE contype = 'f' AND array_length(conkey, 1) > 1
                AND pg_get_constraintdef(oid) LIKE '%organization_id%'
           )
           SELECT h.tbl FROM hasorg h LEFT JOIN composite c ON c.tbl = h.tbl
            WHERE c.tbl IS NULL ORDER BY 1`
        )
      );
      const names = unguarded.map((r) => r.tbl);
      // Pinned so that (a) accidentally dropping the migration's FK turns
      // this red immediately, and (b) a NEW unguarded child table is caught
      // immediately too — only the documented, justified root-table
      // exception remains.
      expect(names).toEqual(['finance_valuation_cases']);
    });
  });

  // =========================================================================
  // FAMILY 7 — finance_exceptions
  // =========================================================================
  describe('family 7 — finance_exceptions', () => {
    it('query level: A-scoped SELECT cannot see B exceptions', async () => {
      const rows = await t((tx) =>
        tx.queryAll<{ id: string }>(
          `SELECT id FROM finance_exceptions_current WHERE organization_id = ? AND exception_group_id = ?`,
          [A.orgId, B.exceptionGroupId]
        )
      );
      expect(rows).toHaveLength(0);
    });

    it('service level: getCurrent / listOpen / accept / waive / resolve all refuse across tenants', async () => {
      expect(await exceptions.getCurrent(A.orgId, B.exceptionGroupId)).toBeNull();
      const openForA = await exceptions.listOpen(A.orgId);
      expect(openForA.every((e) => e.organization_id === A.orgId)).toBe(true);
      expect(openForA.some((e) => e.exception_group_id === B.exceptionGroupId)).toBe(false);

      for (const mutate of [exceptions.accept, exceptions.waive, exceptions.resolve]) {
        const result = await mutate({
          organizationId: A.orgId,
          exceptionGroupId: B.exceptionGroupId,
          actorId: A.userId,
          reason: 'cross-tenant attempt',
          expiry: '2030-01-01',
        });
        expect(result.ok).toBe(false);
        if (result.ok) throw new Error('unreachable');
        expect(result.code).toBe('GROUP_NOT_FOUND');
      }

      // B's exception is still exactly one RAISED event, still OPEN.
      const bEvents = await t((tx) =>
        tx.queryAll<{ event_type: string }>(`SELECT event_type FROM finance_exceptions WHERE exception_group_id = ?`, [
          B.exceptionGroupId,
        ])
      );
      expect(bEvents.map((e) => e.event_type)).toEqual(['RAISED']);
    });
  });

  // =========================================================================
  // FAMILY 8 — compute_jobs
  // =========================================================================
  describe('family 8 — compute_jobs / compute_job_runs / compute_job_outputs', () => {
    it('query level: A-scoped SELECT cannot see B jobs', async () => {
      const rows = await t((tx) =>
        tx.queryAll<{ id: string }>(`SELECT id FROM compute_jobs WHERE organization_id = ? AND id = ?`, [A.orgId, B.jobId])
      );
      expect(rows).toHaveLength(0);
    });

    it('FIXED W9-C-5 (P0): computeJobService.getJob() now REQUIRES organizationId and refuses cross-tenant (was: DEFECT — any job readable)', async () => {
      // BEFORE the fix `getJob(jobId)` took no organizationId at all and
      // `getJob(B.jobId)` returned B's full job row, payload included. The
      // signature is now `getJob(organizationId, jobId)`; calling it with A's
      // org and B's jobId returns null — same NOT_FOUND convention as an
      // unknown id, never another tenant's row.
      const crossTenant = await jobsSvc.getJob(A.orgId, B.jobId);
      expect(crossTenant).toBeNull();

      // Sanity: B reading its OWN job still works — this is a refusal of the
      // cross-tenant call, not a general breakage of getJob().
      const ownRead = await jobsSvc.getJob(B.orgId, B.jobId);
      expect(ownRead).not.toBeNull();
      expect(ownRead!.input_revision_hash).toBe('hash-B');
    });

    it('FIXED W9-C-5 (P0): cancelJob() / failJob() now REQUIRE organizationId and refuse cross-tenant MUTATION (was: DEFECT)', async () => {
      const before = await t((tx) =>
        tx.queryOne<{ status: string }>(`SELECT status FROM compute_jobs WHERE id = ?`, [B.jobId])
      );
      expect(before!.status).toBe('queued'); // physical pre-state

      // BEFORE the fix `cancelJob(B.jobId, reason)` succeeded from org A's
      // context — cross-tenant CANCELLATION, a mutation, not just a read.
      // Signature is now `cancelJob(organizationId, jobId, reason)`.
      const cancelled = await jobsSvc.cancelJob(A.orgId, B.jobId, 'cancelled by an actor from another tenant');
      expect(cancelled).toBeNull();

      // Independent physical read: B's job is completely untouched — still
      // `queued`, no cancel_reason, no cancel_requested_at.
      const after = await t((tx) =>
        tx.queryOne<{ status: string; cancel_reason: string | null; cancel_requested_at: string | null }>(
          `SELECT status, cancel_reason, cancel_requested_at FROM compute_jobs WHERE id = ?`,
          [B.jobId]
        )
      );
      expect(after!.status).toBe('queued');
      expect(after!.cancel_reason).toBeNull();
      expect(after!.cancel_requested_at).toBeNull();

      // Sanity: B cancelling its OWN job still works.
      const ownCancel = await jobsSvc.cancelJob(B.orgId, B.jobId, 'cancelled by its own org');
      expect(ownCancel).not.toBeNull();
      expect(ownCancel!.status).toBe('cancelled');
    });

    it('the output table IS guarded: A cannot commit an output against B\'s artifact', async () => {
      // `fk_compute_job_outputs_artifact_org` is the composite (artifact_id,
      // organization_id) FK — the one guard the jobs family does have.
      await expect(
        t((tx) =>
          tx.queryRun(
            `INSERT INTO compute_job_outputs (id, job_id, organization_id, output_artifact_id,
               output_working_revision_id, committed_by_attempt_number, content_semantic_hash)
             VALUES (?, ?, ?, ?, (SELECT working_revision_id FROM finance_working_revisions WHERE artifact_id = ? LIMIT 1), 1, ?)`,
            [randomUUID(), B.jobId, A.orgId, B.baselineArtifactId, B.baselineArtifactId, `cross-${randomUUID()}`]
          )
        )
      ).rejects.toThrow(/foreign key constraint|violates/i);
    });
  });

  // =========================================================================
  // Cross-cutting: RLS exists ONLY on the W2 pilot's three tables; the rest
  // of the finance*/compute* schema is still application-level only.
  //
  // UPDATED by 20260826_finance_v3_w2_rls_pilot_policies.sql (W2 RLS PILOT,
  // EM-9). This test used to assert ZERO RLS policies anywhere in
  // finance*/compute* — that was true until this migration. It is rewritten
  // here, not deleted, per this file's own "cannot be lost" discipline: it
  // now pins the NARROW scope of the pilot (three tables, and three tables
  // only) so that a future migration silently widening RLS coverage — or
  // silently regressing it back to zero — turns this test red either way.
  //
  // IMPORTANT — this assertion is about POLICY EXISTENCE, not about whether
  // isolation is actually enforced for real traffic. See
  // W2_RLS_TENANT_ENFORCEMENT_report.md and
  // rlsPilotEnforcement.pg.test.ts's STATE 3: the role this very test
  // connects as (and the role production/migrations connect as) is a
  // superuser, which bypasses RLS unconditionally. The application-level
  // guards this file spends its other ~20 tests proving (FIXED W9-C-1
  // through W9-C-7) remain the ONLY enforcement that matters for real
  // traffic today.
  // =========================================================================
  it('cross-cutting: row-level-security policies exist on exactly the W2 pilot\'s three tables, nowhere else in finance*/compute*', async () => {
    const PILOT_TABLES = [
      'compute_jobs',
      'finance_valuation_sensitivity_grids',
      'finance_valuation_sensitivity_cells',
    ].sort();

    const policies = await t((tx) =>
      tx.queryAll<{ tablename: string }>(
        `SELECT tablename FROM pg_policies WHERE schemaname = 'public'
          AND (tablename LIKE 'finance%' OR tablename LIKE 'compute%')`
      )
    );
    expect(policies.map((p) => p.tablename).sort()).toEqual(PILOT_TABLES);

    const rlsEnabled = await t((tx) =>
      tx.queryAll<{ relname: string }>(
        `SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public' AND c.relrowsecurity = true
            AND (c.relname LIKE 'finance%' OR c.relname LIKE 'compute%')`
      )
    );
    expect(rlsEnabled.map((r) => r.relname).sort()).toEqual(PILOT_TABLES);
  });
});
