/**
 * Finance v3 canonical adapter — Pakiet ROUTES_EXPOSURE, Compare engine
 * (`POST /compare/periods` et al.), real PostgreSQL + real HTTP.
 *
 * Covers:
 *   1. Mount proof — 404 WITH {code:'NOT_FOUND'-shaped ARTIFACT_NOT_FOUND}
 *      vs 404 WITHOUT a code field on an unmounted path.
 *   2. A real period/period diff on `finance_stmt_lines` (BOTH_PRESENT +
 *      materiality), proving the wiring actually reaches the DB, not just
 *      the validation branch.
 *   3. Cross-tenant matrix, TWO distinct attack shapes:
 *      (a) org B forges `artifactRef.organizationId = orgA` while
 *          authenticated as org B -> `ORGANIZATION_MISMATCH` (403) — the
 *          service's own explicit check, this router never overrides it;
 *      (b) org B supplies its OWN organizationId but org A's real
 *          `businessVersionId` -> `ARTIFACT_NOT_FOUND` (404) — the
 *          `finance_business_versions` org-scoped WHERE clause, confirmed
 *          independently by direct SQL that org A's row is untouched.
 */
import { randomUUID } from 'node:crypto';

import express from 'express';
import request from 'supertest';
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

describe.skipIf(!REAL_PG)(
  'Finance v2 ROUTES_EXPOSURE — Compare engine (real HTTP + real PostgreSQL)',
  () => {
    let withPinnedPostgresTransaction: typeof import('../../../../database/PostgresDatabase.js').withPinnedPostgresTransaction;
    let av: typeof import('../../../../services/finance/canonical/artifactVersionService.js');
    let financeV2Router: express.Router;

    const orgA = `org-compare-a-${randomUUID()}`;
    const orgB = `org-compare-b-${randomUUID()}`;
    const userA = `user-compare-a-${randomUUID()}`;
    const userB = `user-compare-b-${randomUUID()}`;

    function appAsOrg(orgId: string, userId: string) {
      const a = express();
      a.use(express.json());
      a.use((req: any, _res, next) => {
        req.user = { id: userId, organizationId: orgId, role: 'finance_admin' };
        req.v8Context = { organizationId: orgId, userId, userRole: 'finance_admin' };
        next();
      });
      a.use('/api/v8/finance-v2', financeV2Router);
      a.use((err: any, _req: any, res: any, _next: any) =>
        res.status(500).json({ error: String(err?.message || err) })
      );
      return a;
    }
    let appA: express.Express;
    let appB: express.Express;

    let stmtArtifactId = '';
    let stmtBvId = '';
    let entityId = '';
    let canonicalLineId = '';
    let periodIdA = '';
    let periodIdB = '';

    beforeAll(async () => {
      ({ withPinnedPostgresTransaction } =
        await import('../../../../database/PostgresDatabase.js'));
      av = await import('../../../../services/finance/canonical/artifactVersionService.js');
      financeV2Router = (await import('../index.js')).default;

      await withPinnedPostgresTransaction((tx) =>
        tx.queryRun(`INSERT INTO organizations (id, name) VALUES (?, ?), (?, ?)`, [
          orgA,
          'Compare Tenant A',
          orgB,
          'Compare Tenant B',
        ])
      );

      appA = appAsOrg(orgA, userA);
      appB = appAsOrg(orgB, userB);

      const stmt = await av.createArtifact({
        organizationId: orgA,
        artifactType: 'STATEMENT_PACK',
        createdBy: userA,
      });
      stmtArtifactId = stmt.artifact.artifact_id;
      stmtBvId = stmt.businessVersion.business_version_id;

      const entityRow = await withPinnedPostgresTransaction((tx) =>
        tx.queryOne<{ id: string }>(
          `INSERT INTO finance_stmt_entities (
           organization_id, business_version_id, entity_code, legal_name, role,
           consolidation_method, ownership_pct, functional_currency, created_by
         ) VALUES (?, ?, ?, ?, 'GROUP_PARENT', 'NOT_CONSOLIDATED', NULL, 'PLN', ?)
         RETURNING id`,
          [orgA, stmtBvId, `PARENT-${randomUUID().slice(0, 8)}`, 'Compare Fixture Co', userA]
        )
      );
      entityId = entityRow!.id;

      const canonicalRow = await withPinnedPostgresTransaction((tx) =>
        tx.queryOne<{ id: string }>(
          `SELECT id FROM financial_statement_lines WHERE statement_type = 'BS' AND is_system = true ORDER BY sort_order ASC LIMIT 1`
        )
      );
      if (!canonicalRow)
        throw new Error(
          'fixture setup: no seeded financial_statement_lines row found (statement_type=BS)'
        );
      canonicalLineId = canonicalRow.id;

      const cal = await withPinnedPostgresTransaction((tx) =>
        tx.queryOne<{ fiscal_calendar_id: string }>(
          `INSERT INTO finance_stmt_calendars (organization_id, calendar_type, fiscal_year_end_month, effective_from, created_by)
         VALUES (?, 'STANDARD', 12, '2020-01-01', ?) RETURNING fiscal_calendar_id`,
          [orgA, userA]
        )
      );
      const perA = await withPinnedPostgresTransaction((tx) =>
        tx.queryOne<{ period_id: string }>(
          `INSERT INTO finance_stmt_periods (organization_id, fiscal_calendar_id, period_type, fiscal_year, period_start, period_end, label, created_by)
         VALUES (?, ?, 'FY', 2024, '2024-01-01', '2024-12-31', 'FY2024', ?) RETURNING period_id`,
          [orgA, cal!.fiscal_calendar_id, userA]
        )
      );
      const perB = await withPinnedPostgresTransaction((tx) =>
        tx.queryOne<{ period_id: string }>(
          `INSERT INTO finance_stmt_periods (organization_id, fiscal_calendar_id, period_type, fiscal_year, period_start, period_end, label, created_by)
         VALUES (?, ?, 'FY', 2025, '2025-01-01', '2025-12-31', 'FY2025', ?) RETURNING period_id`,
          [orgA, cal!.fiscal_calendar_id, userA]
        )
      );
      periodIdA = perA!.period_id;
      periodIdB = perB!.period_id;

      async function insertLine(periodId: string, valueDecimal: string) {
        await withPinnedPostgresTransaction((tx) =>
          tx.queryRun(
            `INSERT INTO finance_stmt_lines (
             id, organization_id, business_version_id, statement_type, canonical_line_id, entity_id, period_id,
             accumulation_basis, consolidation_scope, value_status, value_decimal, native_currency,
             presentation_currency, unit, multiplier, is_adjustment, sign_convention, accounting_policy, created_by
           ) VALUES (?, ?, ?, 'BS', ?, ?, ?, 'FULL_YEAR', 'STANDALONE', 'PRESENT_NONZERO', ?, 'PLN', 'PLN', 'UNITS', '1', false, 'NATURAL', 'IFRS', ?)`,
            [randomUUID(), orgA, stmtBvId, canonicalLineId, entityId, periodId, valueDecimal, userA]
          )
        );
      }
      await insertLine(periodIdA, '100');
      await insertLine(periodIdB, '150');
    });

    function artifactRefFor(organizationId: string) {
      return {
        organizationId,
        artifactId: stmtArtifactId,
        businessVersionId: stmtBvId,
        artifactType: 'STATEMENT_PACK',
        naturalKey: null,
      };
    }

    // -----------------------------------------------------------------
    // Mount proof
    // -----------------------------------------------------------------

    it('MOUNT PROOF: valid context + REAL router, artifactRef pointing at a random business_version_id -> 404 WITH {code:"ARTIFACT_NOT_FOUND"}', async () => {
      const res = await request(appA)
        .post('/api/v8/finance-v2/compare/periods')
        .send({
          artifactRef: {
            organizationId: orgA,
            artifactId: randomUUID(),
            businessVersionId: randomUUID(),
            artifactType: 'STATEMENT_PACK',
            naturalKey: null,
          },
          periodIdA: randomUUID(),
          periodIdB: randomUUID(),
        });
      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('code', 'ARTIFACT_NOT_FOUND');
    });

    it('MOUNT PROOF: valid context, path no router in this tree handles -> 404 WITHOUT a code field', async () => {
      const res = await request(appA).get(
        '/api/v8/finance-v2/this-path-truly-does-not-exist-anywhere'
      );
      expect(res.status).toBe(404);
      expect(res.body).not.toHaveProperty('code');
    });

    it('VALIDATION: missing periodIdA/B -> 400 INVALID_BODY (proves body validation runs before any DB call)', async () => {
      const res = await request(appA)
        .post('/api/v8/finance-v2/compare/periods')
        .send({ artifactRef: artifactRefFor(orgA) });
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('code', 'INVALID_BODY');
    });

    // -----------------------------------------------------------------
    // Real period/period diff
    // -----------------------------------------------------------------

    it('POST /compare/periods — real finance_stmt_lines diff, BOTH_PRESENT + materiality', async () => {
      const res = await request(appA)
        .post('/api/v8/finance-v2/compare/periods')
        .send({
          artifactRef: artifactRefFor(orgA),
          periodIdA,
          periodIdB,
          entityId,
          materialityThresholdPct: 0.1,
        });
      expect(res.status).toBe(200);
      const { data } = res.body;
      expect(data.comparisonType).toBe('PERIOD');
      expect(data.summary.bothPresent).toBe(1);
      expect(data.summary.missingInA).toBe(0);
      expect(data.summary.missingInB).toBe(0);
      expect(data.rows).toHaveLength(1);
      const row = data.rows[0];
      expect(row.diffKind).toBe('BOTH_PRESENT');
      expect(row.a.fullUnitValue).toBe(100);
      expect(row.b.fullUnitValue).toBe(150);
      expect(row.absoluteDiff).toBe(50);
      expect(row.materialityFlag).toBe(true); // 50% change > 10% threshold
    });

    it('POST /compare/periods — onlyMaterial=true with a threshold above the real delta -> rows filtered but summary stays full', async () => {
      const res = await request(appA)
        .post('/api/v8/finance-v2/compare/periods')
        .send({
          artifactRef: artifactRefFor(orgA),
          periodIdA,
          periodIdB,
          entityId,
          materialityThresholdPct: 5,
          onlyMaterial: true,
        });
      expect(res.status).toBe(200);
      const { data } = res.body;
      expect(data.summary.totalRows).toBe(1);
      expect(data.summary.bothPresent).toBe(1);
      expect(data.rows).toHaveLength(0); // 50% < 500% threshold -> not material -> filtered out of rows, not out of summary
    });

    // -----------------------------------------------------------------
    // Cross-tenant matrix
    // -----------------------------------------------------------------

    it('CROSS-TENANT (a): org B forges artifactRef.organizationId=orgA while authenticated as org B -> 403 ORGANIZATION_MISMATCH', async () => {
      const res = await request(appB)
        .post('/api/v8/finance-v2/compare/periods')
        .send({ artifactRef: artifactRefFor(orgA), periodIdA, periodIdB });
      expect(res.status).toBe(403);
      expect(res.body).toHaveProperty('code', 'ORGANIZATION_MISMATCH');
    });

    it("CROSS-TENANT (b): org B supplies its OWN organizationId but org A's real businessVersionId -> 404 ARTIFACT_NOT_FOUND, SQL confirms org A's finance_stmt_lines rows are untouched", async () => {
      const res = await request(appB)
        .post('/api/v8/finance-v2/compare/periods')
        .send({ artifactRef: artifactRefFor(orgB), periodIdA, periodIdB });
      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('code', 'ARTIFACT_NOT_FOUND');

      const orgALines = await withPinnedPostgresTransaction((tx) =>
        tx.queryAll<{ id: string }>(
          `SELECT id FROM finance_stmt_lines WHERE organization_id = ? AND business_version_id = ?`,
          [orgA, stmtBvId]
        )
      );
      expect(orgALines.length).toBe(2);

      const orgBLines = await withPinnedPostgresTransaction((tx) =>
        tx.queryAll<{ id: string }>(`SELECT id FROM finance_stmt_lines WHERE organization_id = ?`, [
          orgB,
        ])
      );
      expect(orgBLines.length).toBe(0);

      // Same request, legitimately as org A -> succeeds (proves the 404 above is the tenant
      // boundary, not a bug in the endpoint itself).
      const legit = await request(appA)
        .post('/api/v8/finance-v2/compare/periods')
        .send({ artifactRef: artifactRefFor(orgA), periodIdA, periodIdB });
      expect(legit.status).toBe(200);
    });

    // -----------------------------------------------------------------
    // Gate J1 LUKA 1 — the other five Compare axes. `compare.routes.pg.test.ts`
    // (this file) previously exercised ONLY `/compare/periods`; the other five
    // `POST /compare/*` routes (`versions`, `entities`, `scenarios`,
    // `valuation-methods`, `actual-vs-forecast`) had ZERO test calls despite
    // this file's name suggesting full-module coverage — see
    // `docs/validation/finance-v3/generated/gate-e/J1_ENDPOINT_INVENTORY_report.md`
    // section 5.1. Each of the five below hits real Postgres, asserts response
    // BODY content (not just status), independently confirms the underlying
    // row via SQL, and includes a cross-tenant check.
    // -----------------------------------------------------------------

    describe('the other five Compare axes — versions / entities / scenarios / valuation-methods / actual-vs-forecast', () => {
      let lineageService: typeof import('../../../../services/finance/canonical/lineageService.js');
      let entityCode = '';

      // compareVersions fixture — bv2, a RESTATED child of stmtBvId, same entity_code as entity1.
      let bv2 = '';
      let entity2Id = '';

      // compareEntities fixture — a second entity within the SAME business version (stmtBvId).
      let entity3Id = '';

      // compareScenarios fixture — Baseline -> STANDARD_BASE scenario -> Downside scenario.
      let baseScenarioBv = '';
      let downsideBv = '';
      let scenarioPeriodId = '';

      // compareValuationMethods fixture — one variant, two methods with concrete EV values.
      let valuationBvId = '';

      // compareActualVsForecast fixture — a second BASELINE_MODEL forecast, same entity_code/period.
      let forecastBvId = '';

      beforeAll(async () => {
        lineageService = await import('../../../../services/finance/canonical/lineageService.js');

        const entityRow = await withPinnedPostgresTransaction((tx) =>
          tx.queryOne<{ entity_code: string }>(
            `SELECT entity_code FROM finance_stmt_entities WHERE id = ?`,
            [entityId]
          )
        );
        if (!entityRow) throw new Error('fixture setup: entity1 not found');
        entityCode = entityRow.entity_code;

        // --- compareVersions: bv2 = RESTATED child of stmtBvId ------------------
        const engineManifestRow = await withPinnedPostgresTransaction((tx) =>
          tx.queryOne<{ engine_manifest_id: string }>(
            `SELECT engine_manifest_id FROM finance_business_versions WHERE business_version_id = ?`,
            [stmtBvId]
          )
        );
        if (!engineManifestRow)
          throw new Error('fixture setup: stmtBvId engine_manifest_id not found');
        const bv2Row = await withPinnedPostgresTransaction((tx) =>
          tx.queryOne<{ business_version_id: string }>(
            `INSERT INTO finance_business_versions (
             artifact_id, organization_id, version_no, engine_manifest_id, parent_version_id,
             version_kind, restatement_reason, restatement_class, created_by
           ) VALUES (?, ?, 2, ?, ?, 'RESTATED', 'J1 compare/versions fixture', 'ERROR_CORRECTION', ?)
           RETURNING business_version_id`,
            [stmtArtifactId, orgA, engineManifestRow.engine_manifest_id, stmtBvId, userA]
          )
        );
        if (!bv2Row) throw new Error('fixture setup: bv2 insert returned no row');
        bv2 = bv2Row.business_version_id;
        const entity2Row = await withPinnedPostgresTransaction((tx) =>
          tx.queryOne<{ id: string }>(
            `INSERT INTO finance_stmt_entities (
             organization_id, business_version_id, entity_code, legal_name, role,
             consolidation_method, ownership_pct, functional_currency, created_by
           ) VALUES (?, ?, ?, 'Compare Fixture Co v2', 'GROUP_PARENT', 'NOT_CONSOLIDATED', NULL, 'PLN', ?)
           RETURNING id`,
            [orgA, bv2, entityCode, userA]
          )
        );
        if (!entity2Row) throw new Error('fixture setup: entity2 insert returned no row');
        entity2Id = entity2Row.id;
        await withPinnedPostgresTransaction((tx) =>
          tx.queryRun(
            `INSERT INTO finance_stmt_lines (
             id, organization_id, business_version_id, statement_type, canonical_line_id, entity_id, period_id,
             accumulation_basis, consolidation_scope, value_status, value_decimal, native_currency,
             presentation_currency, unit, multiplier, is_adjustment, sign_convention, accounting_policy, created_by
           ) VALUES (?, ?, ?, 'BS', ?, ?, ?, 'FULL_YEAR', 'STANDALONE', 'PRESENT_NONZERO', '130', 'PLN', 'PLN', 'UNITS', '1', false, 'NATURAL', 'IFRS', ?)`,
            [randomUUID(), orgA, bv2, canonicalLineId, entity2Id, periodIdA, userA]
          )
        );

        // --- compareEntities: a second entity WITHIN stmtBvId, same period/line -
        const entity3Row = await withPinnedPostgresTransaction((tx) =>
          tx.queryOne<{ id: string }>(
            `INSERT INTO finance_stmt_entities (
             organization_id, business_version_id, entity_code, legal_name, role,
             consolidation_method, ownership_pct, functional_currency, created_by
           ) VALUES (?, ?, ?, ?, 'GROUP_PARENT', 'NOT_CONSOLIDATED', NULL, 'PLN', ?)
           RETURNING id`,
            [orgA, stmtBvId, `SUB-${randomUUID().slice(0, 8)}`, 'Compare Fixture Subsidiary', userA]
          )
        );
        if (!entity3Row) throw new Error('fixture setup: entity3 insert returned no row');
        entity3Id = entity3Row.id;
        await withPinnedPostgresTransaction((tx) =>
          tx.queryRun(
            `INSERT INTO finance_stmt_lines (
             id, organization_id, business_version_id, statement_type, canonical_line_id, entity_id, period_id,
             accumulation_basis, consolidation_scope, value_status, value_decimal, native_currency,
             presentation_currency, unit, multiplier, is_adjustment, sign_convention, accounting_policy, created_by
           ) VALUES (?, ?, ?, 'BS', ?, ?, ?, 'FULL_YEAR', 'STANDALONE', 'PRESENT_NONZERO', '40', 'PLN', 'PLN', 'UNITS', '1', false, 'NATURAL', 'IFRS', ?)`,
            [randomUUID(), orgA, stmtBvId, canonicalLineId, entity3Id, periodIdA, userA]
          )
        );

        // --- compareScenarios: Baseline (11,943,750) -> STANDARD_BASE scenario (passthrough)
        //     vs a Downside scenario (11,602,500) -- real WP-D08 Jan-2026 REVENUE figures, same as
        //     financeCompareService.pg.test.ts's own compareScenarios fixture.
        const calRow = await withPinnedPostgresTransaction((tx) =>
          tx.queryOne<{ fiscal_calendar_id: string }>(
            `INSERT INTO finance_stmt_calendars (organization_id, calendar_type, fiscal_year_end_month, effective_from, created_by)
           VALUES (?, 'STANDARD', 12, '2020-01-01', ?) RETURNING fiscal_calendar_id`,
            [orgA, userA]
          )
        );
        if (!calRow) throw new Error('fixture setup: calendar insert returned no row');
        const janRow = await withPinnedPostgresTransaction((tx) =>
          tx.queryOne<{ period_id: string }>(
            `INSERT INTO finance_stmt_periods (organization_id, fiscal_calendar_id, period_type, fiscal_year, fiscal_month, period_start, period_end, label, created_by)
           VALUES (?, ?, 'MONTH', 2026, 1, '2026-01-01', '2026-01-31', 'Jan-2026', ?) RETURNING period_id`,
            [orgA, calRow.fiscal_calendar_id, userA]
          )
        );
        if (!janRow) throw new Error('fixture setup: Jan-2026 period insert returned no row');
        scenarioPeriodId = janRow.period_id;

        const revenueLineRow = await withPinnedPostgresTransaction((tx) =>
          tx.queryOne<{ id: string }>(
            `SELECT id FROM financial_statement_lines WHERE line_code = 'REVENUE' AND organization_id IS NULL LIMIT 1`
          )
        );
        if (!revenueLineRow) throw new Error('fixture setup: no seeded REVENUE line');
        const revenueLineId = revenueLineRow.id;

        const baselineArtifact = await av.createArtifact({
          organizationId: orgA,
          artifactType: 'BASELINE_MODEL',
          createdBy: userA,
        });
        const baselineBv = baselineArtifact.businessVersion.business_version_id;
        const baselineEntityRow = await withPinnedPostgresTransaction((tx) =>
          tx.queryOne<{ id: string }>(
            `INSERT INTO finance_stmt_entities (
             organization_id, business_version_id, entity_code, legal_name, role,
             consolidation_method, ownership_pct, functional_currency, created_by
           ) VALUES (?, ?, ?, 'Baseline Fixture Co', 'GROUP_PARENT', 'NOT_CONSOLIDATED', NULL, 'PLN', ?)
           RETURNING id`,
            [orgA, baselineBv, entityCode, userA]
          )
        );
        if (!baselineEntityRow)
          throw new Error('fixture setup: baseline entity insert returned no row');
        await withPinnedPostgresTransaction((tx) =>
          tx.queryRun(
            `INSERT INTO finance_baseline_outputs (
             organization_id, business_version_id, statement_type, canonical_line_id, entity_id, period_id,
             consolidation_scope, value_status, value_decimal, native_currency, presentation_currency, unit,
             multiplier, value_kind, created_by
           ) VALUES (?, ?, 'P&L', ?, ?, ?, 'CONSOLIDATED', 'PRESENT_NONZERO', ?, 'PLN', 'PLN', 'UNITS', 1, 'FORECAST', ?)`,
            [
              orgA,
              baselineBv,
              revenueLineId,
              baselineEntityRow.id,
              scenarioPeriodId,
              11_943_750.0,
              userA,
            ]
          )
        );

        const baseScenarioArtifact = await av.createArtifact({
          organizationId: orgA,
          artifactType: 'PREDICTION_SCENARIO',
          createdBy: userA,
        });
        baseScenarioBv = baseScenarioArtifact.businessVersion.business_version_id;
        await withPinnedPostgresTransaction((tx) =>
          tx.queryRun(
            `INSERT INTO finance_prediction_scenarios (organization_id, business_version_id, name, scenario_mode, created_by) VALUES (?, ?, 'Base', 'STANDARD_BASE', ?)`,
            [orgA, baseScenarioBv, userA]
          )
        );
        const edge = await lineageService.insertEdge({
          organizationId: orgA,
          sourceVersionId: baselineBv,
          sourceArtifactType: 'BASELINE_MODEL',
          targetVersionId: baseScenarioBv,
          targetArtifactType: 'PREDICTION_SCENARIO',
          edgeType: 'MODEL_TO_SCENARIO',
          transformationKind: 'COMPUTE',
          authorId: userA,
          assumptionSnapshotHash: `j1-compare-scenarios-${randomUUID()}`,
        });
        if (!edge.ok)
          throw new Error(`fixture setup: MODEL_TO_SCENARIO edge insert failed: ${edge.code}`);

        const downsideArtifact = await av.createArtifact({
          organizationId: orgA,
          artifactType: 'PREDICTION_SCENARIO',
          createdBy: userA,
        });
        downsideBv = downsideArtifact.businessVersion.business_version_id;
        await withPinnedPostgresTransaction((tx) =>
          tx.queryRun(
            `INSERT INTO finance_prediction_scenarios (organization_id, business_version_id, name, scenario_mode, created_by) VALUES (?, ?, 'Downside', 'STANDARD_DOWNSIDE', ?)`,
            [orgA, downsideBv, userA]
          )
        );
        const downsideEntityRow = await withPinnedPostgresTransaction((tx) =>
          tx.queryOne<{ id: string }>(
            `INSERT INTO finance_stmt_entities (
             organization_id, business_version_id, entity_code, legal_name, role,
             consolidation_method, ownership_pct, functional_currency, created_by
           ) VALUES (?, ?, ?, 'Downside Fixture Co', 'GROUP_PARENT', 'NOT_CONSOLIDATED', NULL, 'PLN', ?)
           RETURNING id`,
            [orgA, downsideBv, entityCode, userA]
          )
        );
        if (!downsideEntityRow)
          throw new Error('fixture setup: downside entity insert returned no row');
        await withPinnedPostgresTransaction((tx) =>
          tx.queryRun(
            `INSERT INTO finance_prediction_outputs (
             organization_id, business_version_id, statement_type, canonical_line_id, entity_id, period_id,
             consolidation_scope, value_status, value_decimal, native_currency, presentation_currency, unit,
             multiplier, created_by
           ) VALUES (?, ?, 'P&L', ?, ?, ?, 'CONSOLIDATED', 'PRESENT_NONZERO', ?, 'PLN', 'PLN', 'UNITS', 1, ?)`,
            [
              orgA,
              downsideBv,
              revenueLineId,
              downsideEntityRow.id,
              scenarioPeriodId,
              11_602_500.0,
              userA,
            ]
          )
        );

        // --- compareValuationMethods: one variant, two methods, real EV values --
        const caseRes = await request(appA)
          .post('/api/v8/finance-v2/valuation/cases')
          .send({ name: `J1 compare fixture ${randomUUID().slice(0, 8)}` });
        if (caseRes.status !== 201)
          throw new Error(
            `fixture setup: POST /valuation/cases failed: ${caseRes.status} ${JSON.stringify(caseRes.body)}`
          );
        const caseId = caseRes.body.data.caseId as string;
        const valuationArtifact = await request(appA)
          .post('/api/v8/finance-v2/artifacts')
          .send({ artifactType: 'VALUATION_CASE' });
        valuationBvId = valuationArtifact.body.data.currentBusinessVersion
          .businessVersionId as string;
        const variantRes = await request(appA)
          .post(`/api/v8/finance-v2/valuation/cases/${caseId}/variants`)
          .send({ businessVersionId: valuationBvId, name: 'J1 compare fixture variant' });
        if (variantRes.status !== 201)
          throw new Error(
            `fixture setup: POST .../variants failed: ${variantRes.status} ${JSON.stringify(variantRes.body)}`
          );

        const methodARes = await request(appA)
          .post(`/api/v8/finance-v2/valuation/variants/${valuationBvId}/methods`)
          .send({ methodType: 'DCF_FCFF' });
        const methodAId = methodARes.body.data.methodId as string;
        const methodBRes = await request(appA)
          .post(`/api/v8/finance-v2/valuation/variants/${valuationBvId}/methods`)
          .send({ methodType: 'ASSET_BASED' });
        const methodBId = methodBRes.body.data.methodId as string;
        // POST .../methods creates a MISSING result by default (no compute run) — set concrete EV
        // figures directly, same as this program's other method-level fixtures do when the point of
        // the test is Compare's own diff math, not re-proving the DCF/comps solvers.
        await withPinnedPostgresTransaction((tx) =>
          tx.queryRun(
            `UPDATE finance_valuation_methods SET readiness = 'READY', result_value_status = 'PRESENT_NONZERO', result_ev_decimal = '50000000' WHERE id = ?`,
            [methodAId]
          )
        );
        await withPinnedPostgresTransaction((tx) =>
          tx.queryRun(
            `UPDATE finance_valuation_methods SET readiness = 'READY', result_value_status = 'PRESENT_NONZERO', result_ev_decimal = '47000000' WHERE id = ?`,
            [methodBId]
          )
        );

        // --- compareActualVsForecast: actual = entity1's periodIdA row (100, STANDALONE);
        //     forecast = a fresh BASELINE_MODEL, same entity_code, same period, same canonical line.
        const forecastArtifact = await av.createArtifact({
          organizationId: orgA,
          artifactType: 'BASELINE_MODEL',
          createdBy: userA,
        });
        forecastBvId = forecastArtifact.businessVersion.business_version_id;
        const forecastEntityRow = await withPinnedPostgresTransaction((tx) =>
          tx.queryOne<{ id: string }>(
            `INSERT INTO finance_stmt_entities (
             organization_id, business_version_id, entity_code, legal_name, role,
             consolidation_method, ownership_pct, functional_currency, created_by
           ) VALUES (?, ?, ?, 'AvF Forecast Co', 'GROUP_PARENT', 'NOT_CONSOLIDATED', NULL, 'PLN', ?)
           RETURNING id`,
            [orgA, forecastBvId, entityCode, userA]
          )
        );
        if (!forecastEntityRow)
          throw new Error('fixture setup: AvF forecast entity insert returned no row');
        await withPinnedPostgresTransaction((tx) =>
          tx.queryRun(
            `INSERT INTO finance_baseline_outputs (
             organization_id, business_version_id, statement_type, canonical_line_id, entity_id, period_id,
             consolidation_scope, value_status, value_decimal, native_currency, presentation_currency, unit,
             multiplier, value_kind, created_by
           ) VALUES (?, ?, 'BS', ?, ?, ?, 'STANDALONE', 'PRESENT_NONZERO', '80', 'PLN', 'PLN', 'UNITS', 1, 'FORECAST', ?)`,
            [orgA, forecastBvId, canonicalLineId, forecastEntityRow.id, periodIdA, userA]
          )
        );
      }, 60_000);

      it('POST /compare/versions — bv1(100) vs bv2(130) of the SAME artifact, matched via entity_code, relationship=B_IS_DIRECT_CHILD_OF_A; SQL confirms bv2 really holds 130', async () => {
        const res = await request(appA).post('/api/v8/finance-v2/compare/versions').send({
          artifactType: 'STATEMENT_PACK',
          artifactId: stmtArtifactId,
          businessVersionIdA: stmtBvId,
          businessVersionIdB: bv2,
          entityCode,
          consolidationScope: 'STANDALONE',
          accumulationBasis: 'FULL_YEAR',
        });
        expect(res.status).toBe(200);
        const { data } = res.body;
        expect(data.comparisonType).toBe('VERSION');
        expect(data.relationship).toBe('B_IS_DIRECT_CHILD_OF_A');
        expect(data.summary.bothPresent).toBe(1);
        // Side A (entity1, filtered by entityCode) has TWO periods in scope (periodIdA=100,
        // periodIdB=150, from the outer beforeAll fixture); side B (bv2) only has periodIdA=130 ->
        // periodIdA pairs BOTH_PRESENT, periodIdB is MISSING_IN_B. Find the paired row explicitly
        // rather than assuming rows.length===1.
        expect(data.rows).toHaveLength(2);
        const pairedRow = data.rows.find((r: any) => r.diffKind === 'BOTH_PRESENT');
        expect(pairedRow).toBeTruthy();
        expect(pairedRow.a.fullUnitValue).toBe(100);
        expect(pairedRow.b.fullUnitValue).toBe(130);
        expect(pairedRow.absoluteDiff).toBe(30);
        const missingRow = data.rows.find((r: any) => r.diffKind === 'MISSING_IN_B');
        expect(missingRow.a.fullUnitValue).toBe(150);

        const sqlRow = await withPinnedPostgresTransaction((tx) =>
          tx.queryOne<{ value_decimal: string }>(
            `SELECT value_decimal FROM finance_stmt_lines WHERE business_version_id = ? AND entity_id = ?`,
            [bv2, entity2Id]
          )
        );
        expect(sqlRow?.value_decimal).toBe('130');
      });

      it("CROSS-TENANT compare/versions: org B claims its OWN organizationId but org A's real businessVersionIdA -> 404 ARTIFACT_NOT_FOUND", async () => {
        const res = await request(appB).post('/api/v8/finance-v2/compare/versions').send({
          artifactType: 'STATEMENT_PACK',
          artifactId: stmtArtifactId,
          businessVersionIdA: stmtBvId,
          businessVersionIdB: bv2,
          entityCode,
        });
        expect(res.status).toBe(404);
        expect(res.body).toHaveProperty('code', 'ARTIFACT_NOT_FOUND');
      });

      it('POST /compare/entities — entity1(100) vs entity3(40) SAME period/line within stmtBvId; SQL confirms entity3 really holds 40', async () => {
        const res = await request(appA)
          .post('/api/v8/finance-v2/compare/entities')
          .send({
            artifactRef: artifactRefFor(orgA),
            periodId: periodIdA,
            entityIdA: entityId,
            entityIdB: entity3Id,
            consolidationScope: 'STANDALONE',
            accumulationBasis: 'FULL_YEAR',
          });
        expect(res.status).toBe(200);
        const { data } = res.body;
        expect(data.comparisonType).toBe('ENTITY');
        expect(data.summary.bothPresent).toBe(1);
        expect(data.rows[0].a.fullUnitValue).toBe(100);
        expect(data.rows[0].b.fullUnitValue).toBe(40);
        expect(data.rows[0].absoluteDiff).toBe(-60);

        const sqlRow = await withPinnedPostgresTransaction((tx) =>
          tx.queryOne<{ value_decimal: string }>(
            `SELECT value_decimal FROM finance_stmt_lines WHERE business_version_id = ? AND entity_id = ?`,
            [stmtBvId, entity3Id]
          )
        );
        expect(sqlRow?.value_decimal).toBe('40');
      });

      it('CROSS-TENANT compare/entities: org B forging artifactRef.organizationId=orgA -> 403 ORGANIZATION_MISMATCH', async () => {
        const res = await request(appB)
          .post('/api/v8/finance-v2/compare/entities')
          .send({
            artifactRef: artifactRefFor(orgA),
            periodId: periodIdA,
            entityIdA: entityId,
            entityIdB: entity3Id,
          });
        expect(res.status).toBe(403);
        expect(res.body).toHaveProperty('code', 'ORGANIZATION_MISMATCH');
      });

      it("POST /compare/scenarios — Base (11,943,750 via STANDARD_BASE -> finance_baseline_outputs passthrough) vs Downside (11,602,500), matches WP-D08's published delta exactly", async () => {
        // entityCode is deliberately OMITTED here — `resolveEntityIdByCode` looks up
        // `finance_stmt_entities WHERE business_version_id = <the SCENARIO's own bv>`, and no such
        // row exists for a PREDICTION_SCENARIO artifact in this fixture (only the underlying
        // BASELINE_MODEL/downside scenario got their own entity rows); the view's own entity_code
        // JOIN still resolves `dimensions.entityId` for display without it (matches
        // `financeCompareService.pg.test.ts`'s own compareScenarios fixture, which omits it too).
        const res = await request(appA).post('/api/v8/finance-v2/compare/scenarios').send({
          businessVersionIdBase: baseScenarioBv,
          businessVersionIdOther: downsideBv,
          consolidationScope: 'CONSOLIDATED',
        });
        expect(res.status).toBe(200);
        const { data } = res.body;
        expect(data.comparisonType).toBe('SCENARIO');
        expect(data.summary.bothPresent).toBe(1);
        const row = data.rows[0];
        expect(row.a.fullUnitValue).toBeCloseTo(11_943_750.0, 4);
        expect(row.b.fullUnitValue).toBeCloseTo(11_602_500.0, 4);
        expect(row.absoluteDiff).toBeCloseTo(-341_250.0, 4);

        const sqlRow = await withPinnedPostgresTransaction((tx) =>
          tx.queryOne<{ value_decimal: string }>(
            `SELECT value_decimal FROM finance_prediction_outputs WHERE business_version_id = ?`,
            [downsideBv]
          )
        );
        expect(Number(sqlRow?.value_decimal)).toBeCloseTo(11_602_500.0, 4);
      });

      it("CROSS-TENANT compare/scenarios: org B supplying org A's real businessVersionIdBase -> 404 ARTIFACT_NOT_FOUND (compareScenarios builds its own artifactRef with the CALLER's organizationId, so `getBusinessVersionViaTx` org-scopes to org B and finds nothing)", async () => {
        const res = await request(appB)
          .post('/api/v8/finance-v2/compare/scenarios')
          .send({ businessVersionIdBase: baseScenarioBv, businessVersionIdOther: downsideBv });
        expect(res.status).toBe(404);
        expect(res.body).toHaveProperty('code', 'ARTIFACT_NOT_FOUND');
        expect(JSON.stringify(res.body)).not.toContain('11943750');
      });

      it('POST /compare/valuation-methods — DCF_FCFF(50,000,000) vs ASSET_BASED(47,000,000) within the SAME variant; SQL confirms both result_ev_decimal values', async () => {
        const res = await request(appA).post('/api/v8/finance-v2/compare/valuation-methods').send({
          businessVersionId: valuationBvId,
          methodTypeA: 'DCF_FCFF',
          methodTypeB: 'ASSET_BASED',
        });
        expect(res.status).toBe(200);
        const { data } = res.body;
        expect(data.comparisonType).toBe('VALUATION_METHOD');
        expect(data.summary.bothPresent).toBe(1);
        expect(data.rows[0].a.fullUnitValue).toBe(50_000_000);
        expect(data.rows[0].b.fullUnitValue).toBe(47_000_000);
        expect(data.rows[0].absoluteDiff).toBe(-3_000_000);

        const sqlRows = await withPinnedPostgresTransaction((tx) =>
          tx.queryAll<{ method_type: string; result_ev_decimal: string }>(
            `SELECT method_type, result_ev_decimal FROM finance_valuation_methods WHERE business_version_id = ? ORDER BY method_type`,
            [valuationBvId]
          )
        );
        expect(sqlRows.find((r) => r.method_type === 'DCF_FCFF')?.result_ev_decimal).toBe(
          '50000000'
        );
        expect(sqlRows.find((r) => r.method_type === 'ASSET_BASED')?.result_ev_decimal).toBe(
          '47000000'
        );
      });

      it("CROSS-TENANT compare/valuation-methods: org B supplying org A's real businessVersionId -> 404 ARTIFACT_NOT_FOUND (org-scoped finance_business_versions lookup), org A's real EV figures never leak", async () => {
        const res = await request(appB).post('/api/v8/finance-v2/compare/valuation-methods').send({
          businessVersionId: valuationBvId,
          methodTypeA: 'DCF_FCFF',
          methodTypeB: 'ASSET_BASED',
        });
        expect(res.status).toBe(404);
        expect(res.body).toHaveProperty('code', 'ARTIFACT_NOT_FOUND');
        expect(JSON.stringify(res.body)).not.toContain('50000000');
        expect(JSON.stringify(res.body)).not.toContain('47000000');
      });

      it('POST /compare/actual-vs-forecast — Actual STATEMENT_PACK(100) vs Forecast BASELINE_MODEL(80), same entity_code/period, accumulationBasis ignored on match; SQL confirms the forecast row', async () => {
        const res = await request(appA)
          .post('/api/v8/finance-v2/compare/actual-vs-forecast')
          .send({
            actualArtifactRef: artifactRefFor(orgA),
            forecastArtifactRef: {
              organizationId: orgA,
              artifactId: forecastBvId,
              businessVersionId: forecastBvId,
              artifactType: 'BASELINE_MODEL',
              naturalKey: null,
            },
            entityCode,
            periodIds: [periodIdA],
            accumulationBasis: 'FULL_YEAR',
            consolidationScope: 'STANDALONE',
          });
        expect(res.status).toBe(200);
        const { data } = res.body;
        expect(data.comparisonType).toBe('ACTUAL_VS_FORECAST');
        expect(data.summary.bothPresent).toBe(1);
        expect(data.rows[0].a.fullUnitValue).toBe(100);
        expect(data.rows[0].b.fullUnitValue).toBe(80);
        expect(data.rows[0].absoluteDiff).toBe(-20);

        const sqlRow = await withPinnedPostgresTransaction((tx) =>
          tx.queryOne<{ value_decimal: string }>(
            `SELECT value_decimal FROM finance_baseline_outputs WHERE business_version_id = ?`,
            [forecastBvId]
          )
        );
        expect(sqlRow?.value_decimal).toBe('80');
      });

      it("CROSS-TENANT compare/actual-vs-forecast: org B, real entityCode/businessVersionId belonging to org A -> 404 ENTITY_CODE_NOT_FOUND (resolveEntityIdByCode is org-scoped and runs BEFORE compareValues' own ORGANIZATION_MISMATCH check ever gets a chance to fire), org A's real figures never leak", async () => {
        const res = await request(appB)
          .post('/api/v8/finance-v2/compare/actual-vs-forecast')
          .send({
            actualArtifactRef: artifactRefFor(orgA),
            forecastArtifactRef: {
              organizationId: orgA,
              artifactId: forecastBvId,
              businessVersionId: forecastBvId,
              artifactType: 'BASELINE_MODEL',
              naturalKey: null,
            },
            entityCode,
            periodIds: [periodIdA],
            accumulationBasis: 'FULL_YEAR',
          });
        expect(res.status).toBe(404);
        expect(res.body).toHaveProperty('code', 'ENTITY_CODE_NOT_FOUND');
      });
    });
  }
);
