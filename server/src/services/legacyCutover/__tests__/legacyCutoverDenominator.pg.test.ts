/** @vitest-environment node */
/**
 * CLAUDE-NEXT-LEGACY-CUTOVER / T12 — proof for `legacy_cutover_identity_denominator`
 * on fresh real PostgreSQL.
 *
 * The view (server/migrations/20260924_legacy_cutover_denominator.sql) is the
 * denominator a writer retirement decision is measured against: for every
 * tenant and every legacy Finance table it must classify each real row as
 * exactly one of resolved / quarantined / not_migrated, scoped strictly per
 * tenant, without mutating anything.
 *
 * SAME-ID TENANT ISOLATION NOTE: all four legacy tables (financial_models,
 * financial_analyses, financial_statement_packs, valuations) have a single-
 * column PRIMARY KEY on `id` with no per-organization scoping, so the exact
 * same id string cannot exist as two physical rows of the SAME table (a
 * second insert would violate the PK). The isolation proof below instead
 * plants the shared id string as a genuine row for tenant A in
 * `financial_models`, and a DECOY alias for tenant B on that same
 * (legacy_table, legacy_id) pair with no matching physical row for tenant B.
 * This exercises exactly the join condition that would leak across tenants
 * if the view's alias lookup ever dropped its `organization_id` filter: if
 * that filter were missing, tenant A's row would incorrectly resolve via
 * tenant B's decoy alias. Tenant B's own "resolved" fact is then proven
 * independently and honestly with a real physical row (in `valuations`,
 * which the PK constraint permits to reuse the same id text since it is a
 * different table) plus a genuine alias of its own.
 */
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const CONNECTION_STRING = process.env.DATABASE_URL || '';
const REAL_PG =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  /^postgres/.test(CONNECTION_STRING) &&
  /localhost|127\.0\.0\.1/.test(CONNECTION_STRING);

const prefix = `lcd-${randomUUID().slice(0, 8)}`;
const orgMain = `${prefix}-org-main`;
const orgTenantA = `${prefix}-org-a`;
const orgTenantB = `${prefix}-org-b`;
const allOrgs = [orgMain, orgTenantA, orgTenantB];

const sharedLegacyId = `${prefix}-shared-legacy-id`;

interface DenominatorRow {
  domain: string;
  legacy_table: string;
  organization_id: string;
  total_rows: string | number;
  resolved_rows: string | number;
  quarantined_rows: string | number;
  not_migrated_rows: string | number;
  resolved_pct: string | number | null;
}

function n(v: string | number): number {
  return typeof v === 'number' ? v : Number(v);
}

async function queryDenominator(pool: Pool, organizationIds: string[]): Promise<DenominatorRow[]> {
  const result = await pool.query<DenominatorRow>(
    `SELECT domain, legacy_table, organization_id, total_rows, resolved_rows,
            quarantined_rows, not_migrated_rows, resolved_pct
       FROM legacy_cutover_identity_denominator
      WHERE organization_id = ANY($1)
      ORDER BY legacy_table, organization_id`,
    [organizationIds]
  );
  return result.rows;
}

function findRow(
  rows: DenominatorRow[],
  legacyTable: string,
  organizationId: string
): DenominatorRow | undefined {
  return rows.find((r) => r.legacy_table === legacyTable && r.organization_id === organizationId);
}

describe.skipIf(!REAL_PG)('legacy_cutover_identity_denominator (fresh real PostgreSQL)', () => {
  let pool: Pool;

  const financeArtifactIds: string[] = [];

  async function insertOrganization(orgId: string): Promise<void> {
    await pool.query(
      `INSERT INTO organizations(id, name, plan, status, is_active, created_at)
       VALUES ($1, $2, 'enterprise', 'active', 1, now())
       ON CONFLICT (id) DO NOTHING`,
      [orgId, orgId]
    );
  }

  async function insertFinancialModel(id: string, organizationId: string): Promise<void> {
    await pool.query(
      `INSERT INTO financial_models(id, organization_id, name, start_date)
       VALUES ($1, $2, $3, CURRENT_DATE)`,
      [id, organizationId, `${prefix} model ${id}`]
    );
  }

  async function insertValuation(id: string, organizationId: string): Promise<void> {
    await pool.query(
      `INSERT INTO valuations(id, organization_id, title, source_type)
       VALUES ($1, $2, $3, 'manual')`,
      [id, organizationId, `${prefix} valuation ${id}`]
    );
  }

  async function insertAlias(params: {
    legacyTable: string;
    legacyId: string;
    organizationId: string;
    mappingConfidence: 'AUTO_MIGRATE' | 'MIGRATE_WITH_WARNING' | 'QUARANTINE' | 'EXCLUDE_WITH_REASON';
    mappingReason?: string;
  }): Promise<void> {
    const artifactId = `${prefix}-af-${randomUUID().slice(0, 8)}`;
    financeArtifactIds.push(artifactId);
    await pool.query(
      `INSERT INTO finance_artifacts(artifact_id, organization_id, artifact_type)
       VALUES ($1, $2, 'BASELINE_MODEL')`,
      [artifactId, params.organizationId]
    );
    await pool.query(
      `INSERT INTO finance_artifact_aliases(
          legacy_table, legacy_id, artifact_id, organization_id, mapping_confidence, mapping_reason
       ) VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        params.legacyTable,
        params.legacyId,
        artifactId,
        params.organizationId,
        params.mappingConfidence,
        params.mappingReason ?? null,
      ]
    );
  }

  beforeAll(async () => {
    pool = new Pool({ connectionString: CONNECTION_STRING });

    for (const orgId of allOrgs) {
      await insertOrganization(orgId);
    }

    // --- orgMain / financial_models: one of each classification ---------
    await insertFinancialModel(`${prefix}-fm-resolved`, orgMain);
    await insertAlias({
      legacyTable: 'financial_models',
      legacyId: `${prefix}-fm-resolved`,
      organizationId: orgMain,
      mappingConfidence: 'AUTO_MIGRATE',
    });

    await insertFinancialModel(`${prefix}-fm-quarantine`, orgMain);
    await insertAlias({
      legacyTable: 'financial_models',
      legacyId: `${prefix}-fm-quarantine`,
      organizationId: orgMain,
      mappingConfidence: 'QUARANTINE',
      mappingReason: 'flagged by backfill review',
    });

    await insertFinancialModel(`${prefix}-fm-exclude`, orgMain);
    await insertAlias({
      legacyTable: 'financial_models',
      legacyId: `${prefix}-fm-exclude`,
      organizationId: orgMain,
      mappingConfidence: 'EXCLUDE_WITH_REASON',
      mappingReason: 'duplicate of another legacy record',
    });

    await insertFinancialModel(`${prefix}-fm-notmigrated`, orgMain);
    // deliberately no alias

    // --- orgMain / valuations: exercise a non-financial_models branch ---
    await insertValuation(`${prefix}-val-resolved`, orgMain);
    await insertAlias({
      legacyTable: 'valuations',
      legacyId: `${prefix}-val-resolved`,
      organizationId: orgMain,
      mappingConfidence: 'AUTO_MIGRATE',
    });

    await insertValuation(`${prefix}-val-notmigrated`, orgMain);
    // deliberately no alias

    // --- Tenant isolation: same legacy id string, aliased only for B ----
    await insertFinancialModel(sharedLegacyId, orgTenantA);
    // orgTenantA gets NO alias of its own.

    // Decoy: an alias for orgTenantB pointing at the exact (legacy_table,
    // legacy_id) pair that physically belongs to orgTenantA. There is no
    // physical financial_models row for orgTenantB with this id — this row
    // exists purely to try to trick an unscoped join.
    await insertAlias({
      legacyTable: 'financial_models',
      legacyId: sharedLegacyId,
      organizationId: orgTenantB,
      mappingConfidence: 'AUTO_MIGRATE',
    });

    // orgTenantB's genuine "resolved" fact, proven honestly: a real physical
    // row (in a different legacy table, since the PK forbids reusing the id
    // in financial_models) plus its own real alias.
    await insertValuation(sharedLegacyId, orgTenantB);
    await insertAlias({
      legacyTable: 'valuations',
      legacyId: sharedLegacyId,
      organizationId: orgTenantB,
      mappingConfidence: 'AUTO_MIGRATE',
    });
  }, 90_000);

  afterAll(async () => {
    if (!pool) return;
    await pool.query(`DELETE FROM finance_artifact_aliases WHERE organization_id = ANY($1)`, [
      allOrgs,
    ]);
    await pool.query(`DELETE FROM finance_artifacts WHERE organization_id = ANY($1)`, [allOrgs]);
    await pool.query(`DELETE FROM valuations WHERE organization_id = ANY($1)`, [allOrgs]);
    await pool.query(`DELETE FROM financial_models WHERE organization_id = ANY($1)`, [allOrgs]);
    await pool.query(`DELETE FROM organizations WHERE id = ANY($1)`, [allOrgs]);
    await pool.end();
  });

  it('counts an AUTO_MIGRATE alias as resolved, and not as not_migrated', async () => {
    const rows = await queryDenominator(pool, [orgMain]);
    const fm = findRow(rows, 'financial_models', orgMain);
    expect(fm).toBeDefined();
    expect(n(fm!.resolved_rows)).toBeGreaterThanOrEqual(1);
    // Exactly one financial_models row in orgMain is AUTO_MIGRATE-resolved.
    expect(n(fm!.resolved_rows)).toBe(1);
  });

  it('counts QUARANTINE and EXCLUDE_WITH_REASON aliases as quarantined, never resolved or not_migrated', async () => {
    const rows = await queryDenominator(pool, [orgMain]);
    const fm = findRow(rows, 'financial_models', orgMain);
    expect(fm).toBeDefined();
    // fm-quarantine (QUARANTINE) + fm-exclude (EXCLUDE_WITH_REASON) = 2.
    expect(n(fm!.quarantined_rows)).toBe(2);
  });

  it('counts a legacy record with no alias at all as not_migrated', async () => {
    const rows = await queryDenominator(pool, [orgMain]);
    const fm = findRow(rows, 'financial_models', orgMain);
    expect(fm).toBeDefined();
    // Only fm-notmigrated has no alias.
    expect(n(fm!.not_migrated_rows)).toBe(1);
  });

  it('scopes classification strictly per tenant: identical legacy id, aliased only for B', async () => {
    const rows = await queryDenominator(pool, [orgTenantA, orgTenantB]);

    const aFm = findRow(rows, 'financial_models', orgTenantA);
    expect(aFm).toBeDefined();
    expect(n(aFm!.not_migrated_rows)).toBe(1);
    expect(n(aFm!.resolved_rows)).toBe(0);
    expect(n(aFm!.quarantined_rows)).toBe(0);

    // orgTenantB has no physical financial_models row at all, so it must not
    // appear as a group for that table — the decoy alias must not fabricate
    // a phantom row.
    const bFm = findRow(rows, 'financial_models', orgTenantB);
    expect(bFm).toBeUndefined();

    // orgTenantB's own, honestly-earned resolved fact (different table).
    const bVal = findRow(rows, 'valuations', orgTenantB);
    expect(bVal).toBeDefined();
    expect(n(bVal!.resolved_rows)).toBe(1);
    expect(n(bVal!.not_migrated_rows)).toBe(0);
    expect(n(bVal!.quarantined_rows)).toBe(0);
  });

  it('keeps total_rows equal to resolved+quarantined+not_migrated and resolved_pct consistent, for every row', async () => {
    const rows = await queryDenominator(pool, allOrgs);
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      const total = n(row.total_rows);
      const resolved = n(row.resolved_rows);
      const quarantined = n(row.quarantined_rows);
      const notMigrated = n(row.not_migrated_rows);
      expect(resolved + quarantined + notMigrated).toBe(total);

      if (total === 0) {
        expect(row.resolved_pct).toBeNull();
      } else {
        const expectedPct = Math.round(((100 * resolved) / total) * 100) / 100;
        expect(Number(row.resolved_pct)).toBeCloseTo(expectedPct, 2);
      }
    }

    // Spot-check the two orgMain rows explicitly.
    const fm = findRow(rows, 'financial_models', orgMain);
    expect(fm).toBeDefined();
    expect(n(fm!.total_rows)).toBe(4);
    expect(Number(fm!.resolved_pct)).toBeCloseTo(25.0, 2);

    const val = findRow(rows, 'valuations', orgMain);
    expect(val).toBeDefined();
    expect(n(val!.total_rows)).toBe(2);
    expect(Number(val!.resolved_pct)).toBeCloseTo(50.0, 2);
  });

  it('is read-only: querying the view mutates nothing in the underlying tables', async () => {
    async function snapshot() {
      const [fm, fa, fsp, val, aliases] = await Promise.all([
        pool.query(`SELECT count(*)::int AS n FROM financial_models`),
        pool.query(`SELECT count(*)::int AS n FROM financial_analyses`),
        pool.query(`SELECT count(*)::int AS n FROM financial_statement_packs`),
        pool.query(`SELECT count(*)::int AS n FROM valuations`),
        pool.query(`SELECT count(*)::int AS n FROM finance_artifact_aliases`),
      ]);
      return {
        financial_models: fm.rows[0].n,
        financial_analyses: fa.rows[0].n,
        financial_statement_packs: fsp.rows[0].n,
        valuations: val.rows[0].n,
        finance_artifact_aliases: aliases.rows[0].n,
      };
    }

    const before = await snapshot();
    // Query the view a few times, including with different filters, to make
    // sure no execution path has a side effect.
    await queryDenominator(pool, allOrgs);
    await pool.query(`SELECT * FROM legacy_cutover_identity_denominator`);
    await queryDenominator(pool, [orgMain]);
    const after = await snapshot();

    expect(after).toEqual(before);
  });

  it('survives a cold connection: a brand new pool sees the same numbers', async () => {
    const cold = new Pool({ connectionString: CONNECTION_STRING });
    try {
      const rows = await queryDenominator(cold, [orgMain]);
      const fm = findRow(rows, 'financial_models', orgMain);
      const val = findRow(rows, 'valuations', orgMain);
      expect(fm).toBeDefined();
      expect(val).toBeDefined();
      expect(n(fm!.total_rows)).toBe(4);
      expect(n(fm!.resolved_rows)).toBe(1);
      expect(n(fm!.quarantined_rows)).toBe(2);
      expect(n(fm!.not_migrated_rows)).toBe(1);
      expect(n(val!.total_rows)).toBe(2);
      expect(n(val!.resolved_rows)).toBe(1);
      expect(n(val!.not_migrated_rows)).toBe(1);
    } finally {
      await cold.end();
    }
  });
});
