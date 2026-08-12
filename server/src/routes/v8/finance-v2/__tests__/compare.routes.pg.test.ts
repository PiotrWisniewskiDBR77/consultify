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
  process.env.RUN_DB_TESTS === '1' && process.env.MOCK_DB === 'false' && CONNECTION_STRING.startsWith('postgres');
if (REAL_PG_REQUESTED) {
  process.env.DB_TYPE = 'postgres';
}
const REAL_PG = REAL_PG_REQUESTED;

describe.skipIf(!REAL_PG)('Finance v2 ROUTES_EXPOSURE — Compare engine (real HTTP + real PostgreSQL)', () => {
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
    a.use((err: any, _req: any, res: any, _next: any) => res.status(500).json({ error: String(err?.message || err) }));
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
    ({ withPinnedPostgresTransaction } = await import('../../../../database/PostgresDatabase.js'));
    av = await import('../../../../services/finance/canonical/artifactVersionService.js');
    financeV2Router = (await import('../index.js')).default;

    await withPinnedPostgresTransaction((tx) =>
      tx.queryRun(`INSERT INTO organizations (id, name) VALUES (?, ?), (?, ?)`, [orgA, 'Compare Tenant A', orgB, 'Compare Tenant B'])
    );

    appA = appAsOrg(orgA, userA);
    appB = appAsOrg(orgB, userB);

    const stmt = await av.createArtifact({ organizationId: orgA, artifactType: 'STATEMENT_PACK', createdBy: userA });
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
    if (!canonicalRow) throw new Error('fixture setup: no seeded financial_statement_lines row found (statement_type=BS)');
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
    return { organizationId, artifactId: stmtArtifactId, businessVersionId: stmtBvId, artifactType: 'STATEMENT_PACK', naturalKey: null };
  }

  // -----------------------------------------------------------------
  // Mount proof
  // -----------------------------------------------------------------

  it('MOUNT PROOF: valid context + REAL router, artifactRef pointing at a random business_version_id -> 404 WITH {code:"ARTIFACT_NOT_FOUND"}', async () => {
    const res = await request(appA)
      .post('/api/v8/finance-v2/compare/periods')
      .send({
        artifactRef: { organizationId: orgA, artifactId: randomUUID(), businessVersionId: randomUUID(), artifactType: 'STATEMENT_PACK', naturalKey: null },
        periodIdA: randomUUID(),
        periodIdB: randomUUID(),
      });
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('code', 'ARTIFACT_NOT_FOUND');
  });

  it('MOUNT PROOF: valid context, path no router in this tree handles -> 404 WITHOUT a code field', async () => {
    const res = await request(appA).get('/api/v8/finance-v2/this-path-truly-does-not-exist-anywhere');
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
      .send({ artifactRef: artifactRefFor(orgA), periodIdA, periodIdB, entityId, materialityThresholdPct: 0.1 });
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
      .send({ artifactRef: artifactRefFor(orgA), periodIdA, periodIdB, entityId, materialityThresholdPct: 5, onlyMaterial: true });
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

  it('CROSS-TENANT (b): org B supplies its OWN organizationId but org A\'s real businessVersionId -> 404 ARTIFACT_NOT_FOUND, SQL confirms org A\'s finance_stmt_lines rows are untouched', async () => {
    const res = await request(appB)
      .post('/api/v8/finance-v2/compare/periods')
      .send({ artifactRef: artifactRefFor(orgB), periodIdA, periodIdB });
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('code', 'ARTIFACT_NOT_FOUND');

    const orgALines = await withPinnedPostgresTransaction((tx) =>
      tx.queryAll<{ id: string }>(`SELECT id FROM finance_stmt_lines WHERE organization_id = ? AND business_version_id = ?`, [orgA, stmtBvId])
    );
    expect(orgALines.length).toBe(2);

    const orgBLines = await withPinnedPostgresTransaction((tx) =>
      tx.queryAll<{ id: string }>(`SELECT id FROM finance_stmt_lines WHERE organization_id = ?`, [orgB])
    );
    expect(orgBLines.length).toBe(0);

    // Same request, legitimately as org A -> succeeds (proves the 404 above is the tenant
    // boundary, not a bug in the endpoint itself).
    const legit = await request(appA)
      .post('/api/v8/finance-v2/compare/periods')
      .send({ artifactRef: artifactRefFor(orgA), periodIdA, periodIdB });
    expect(legit.status).toBe(200);
  });
});
