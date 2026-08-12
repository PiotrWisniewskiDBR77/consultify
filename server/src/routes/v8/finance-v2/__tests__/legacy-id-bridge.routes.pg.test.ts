/**
 * Finance v3 — ID BRIDGE (Gate E). Proves `GET /artifacts/resolve-legacy/:legacyTable/:legacyId`
 * (`artifacts.routes.ts`) actually reads `finance_artifact_aliases` and returns the three
 * distinguishable outcomes: RESOLVED / NOT_MIGRATED / QUARANTINED — never collapsing the two
 * "nothing to open yet" states into one (CLAUDE.md §2.3).
 *
 * Same real-Postgres gate convention as every other `finance-v2/__tests__/*.pg.test.ts` file
 * (`mount-proof.pg.test.ts` header): requires RUN_DB_TESTS=1 + MOCK_DB=false + NODE_ENV=test +
 * an explicit postgres DATABASE_URL, else the whole suite is skipped (not silently mocked).
 *
 * ══════════════════════════════════════════════════════════════════════════════════════════
 * Gate E FIX-B (proof-gaps pass, 2026-08-12) — LUKA 1: cross-tenant test #4 below only exercises
 * the RESOLVED branch of `resolveLegacyFinanceArtifact()` (`legacyIdBridgeService.ts`), which has
 * TWO organization_id filters in series: the alias SELECT (query #1), then — only for
 * AUTO_MIGRATE/MIGRATE_WITH_WARNING — a second `finance_artifacts` SELECT (query #2). In test #4's
 * unmutated run, query #1's own filter already excludes the other org's alias row, so query #2 is
 * NEVER REACHED — the QUARANTINE/EXCLUDE_WITH_REASON branch, which returns immediately after query
 * #1 with NO second query at all, gets the SAME single-filter protection but ZERO test coverage of
 * it. Test #6 below closes that: a QUARANTINE alias belonging to another org must still resolve as
 * NOT_MIGRATED, verified via an independent `pg.Client` (own TCP socket, never the app's
 * `PostgresDatabase` pool — same convention `approveRbacGate.pg.test.ts` established) that confirms
 * the fixture row genuinely exists and genuinely belongs to the other org before trusting the HTTP
 * response.
 *
 * NEGATIVE CONTROL (performed manually this session, see the FIX-B report for the full transcript):
 * removed `AND organization_id = ?` from query #1 only. Result — exactly reproducing the original
 * mutation-tester's finding: test #4 (RESOLVED) stayed GREEN, because query #2's own untouched
 * filter alone still blocks it; test #6 (QUARANTINED, added by this pass) went RED, leaking the
 * other org's alias row (including its `mapping_reason`) — because that branch has no second query
 * to fall back on. This simultaneously proves test #6 catches what test #4 structurally cannot, and
 * that query #2's filter is a real, currently load-bearing second layer for the RESOLVED branch
 * specifically in the "query #1 broken" scenario. Reverted; both tests GREEN again.
 *
 * MULTI-LAYER DEFENSE, reported per the brief's instruction to name how many layers actually hold:
 * a THIRD, DB-level layer also exists and was not previously documented anywhere in this file —
 * `finance_artifact_aliases` carries `CONSTRAINT fk_finance_alias_artifact_org FOREIGN KEY
 * (artifact_id, organization_id) REFERENCES finance_artifacts (artifact_id, organization_id)`
 * (`20260809_finance_v3_b01_core_artifacts.sql`). This makes it IMPOSSIBLE, via any ordinary
 * INSERT, for an alias row's own `organization_id` to disagree with the real organization_id of the
 * artifact it points at — confirmed empirically: an attempt to insert an alias with
 * `organization_id = orgId` pointing at an artifact actually owned by `otherOrgId` was rejected by
 * Postgres with `fk_finance_alias_artifact_org` violation before this test file could even reach
 * the HTTP call. Consequence for query #2's filter specifically: mutating query #2 ALONE (removing
 * `AND organization_id = ?` from the `finance_artifacts` SELECT) while leaving query #1 intact is
 * NOT reachable by any legitimate cross-tenant request today — query #1's own filter, backed by
 * this FK, already excludes any alias row whose linked artifact belongs to another org before query
 * #2 ever runs with mismatched data. So for the RESOLVED branch specifically: query #1's filter +
 * the FK is what protects the ordinary case; query #2's filter is the load-bearing THIRD line only
 * in the narrower "query #1 already broken" scenario the negative control above exercises — it is
 * not, today, independently reachable on its own via valid data. Not a defect: documented here so a
 * future reader does not assume query #2's filter is pulling weight it structurally cannot exercise
 * in isolation while the FK stands.
 * ══════════════════════════════════════════════════════════════════════════════════════════
 */
import { randomUUID } from 'node:crypto';

import express from 'express';
import { Client } from 'pg';
import request from 'supertest';
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

describe.skipIf(!REAL_PG)('ID BRIDGE — GET /artifacts/resolve-legacy/:legacyTable/:legacyId', () => {
  let withPinnedPostgresTransaction: typeof import('../../../../database/PostgresDatabase.js').withPinnedPostgresTransaction;
  let createArtifact: typeof import('../../../../services/finance/canonical/artifactVersionService.js').createArtifact;
  let financeV2Router: express.Router;

  const orgId = `org-idbridge-${randomUUID()}`;
  const otherOrgId = `org-idbridge-other-${randomUUID()}`;
  const userId = `user-idbridge-${randomUUID()}`;

  /** Independent verification connection — own TCP socket, never the app's `PostgresDatabase` pool. */
  let verifyClient: Client;

  beforeAll(async () => {
    ({ withPinnedPostgresTransaction } = await import('../../../../database/PostgresDatabase.js'));
    ({ createArtifact } = await import('../../../../services/finance/canonical/artifactVersionService.js'));
    financeV2Router = (await import('../index.js')).default;

    await withPinnedPostgresTransaction((tx) =>
      tx.queryRun(`INSERT INTO organizations (id, name) VALUES (?, ?)`, [orgId, 'ID Bridge Org'])
    );
    await withPinnedPostgresTransaction((tx) =>
      tx.queryRun(`INSERT INTO organizations (id, name) VALUES (?, ?)`, [otherOrgId, 'ID Bridge Other Org'])
    );

    verifyClient = new Client({ connectionString: CONNECTION_STRING, statement_timeout: 15000, query_timeout: 15000 });
    await verifyClient.connect();
  }, 120000);

  afterAll(async () => {
    if (verifyClient) await verifyClient.end();
  });

  function appWithContext(organizationId: string) {
    const app = express();
    app.use(express.json());
    app.use((req: any, _res, next) => {
      req.user = { id: userId, organizationId, role: 'finance_admin' };
      req.v8Context = { organizationId, userId, userRole: 'finance_admin' };
      next();
    });
    app.use('/api/v8/finance-v2', financeV2Router);
    return app;
  }

  async function insertAlias(params: {
    legacyTable: string;
    legacyId: string;
    organizationId: string;
    artifactId: string;
    businessVersionId: string | null;
    mappingConfidence: 'AUTO_MIGRATE' | 'MIGRATE_WITH_WARNING' | 'QUARANTINE' | 'EXCLUDE_WITH_REASON';
    mappingReason?: string | null;
  }) {
    await withPinnedPostgresTransaction((tx) =>
      tx.queryRun(
        `INSERT INTO finance_artifact_aliases
           (legacy_table, legacy_id, legacy_version, artifact_id, organization_id, business_version_id, mapping_confidence, mapping_reason)
         VALUES (?, ?, NULL, ?, ?, ?, ?, ?)`,
        [
          params.legacyTable,
          params.legacyId,
          params.artifactId,
          params.organizationId,
          params.businessVersionId,
          params.mappingConfidence,
          params.mappingReason ?? null,
        ]
      )
    );
  }

  // -----------------------------------------------------------------
  // 1. RESOLVED — the happy path: alias exists, AUTO_MIGRATE, real artifact.
  // -----------------------------------------------------------------

  it('1) RESOLVED: an AUTO_MIGRATE alias for a real artifact returns canonical artifactId + businessVersionId', async () => {
    const created = await createArtifact({
      organizationId: orgId,
      artifactType: 'BASELINE_MODEL',
      naturalKey: null,
      createdBy: userId,
    });
    const legacyId = `financial_models-${randomUUID()}`;
    await insertAlias({
      legacyTable: 'financial_models',
      legacyId,
      organizationId: orgId,
      artifactId: created.artifact.artifact_id,
      businessVersionId: created.businessVersion.business_version_id,
      mappingConfidence: 'AUTO_MIGRATE',
    });

    const app = appWithContext(orgId);
    const res = await request(app).get(`/api/v8/finance-v2/artifacts/resolve-legacy/financial_models/${legacyId}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      status: 'RESOLVED',
      artifactId: created.artifact.artifact_id,
      businessVersionId: created.businessVersion.business_version_id,
      artifactType: 'BASELINE_MODEL',
      mappingConfidence: 'AUTO_MIGRATE',
    });
  });

  // -----------------------------------------------------------------
  // 2. NOT_MIGRATED — anti-silent-emptiness: this is the state Prediction
  //    must surface EXPLICITLY instead of quietly rendering an empty draft.
  // -----------------------------------------------------------------

  it('2) NOT_MIGRATED: a legacy id with no alias row at all — the exact "never backfilled" case', async () => {
    const app = appWithContext(orgId);
    const res = await request(app).get(
      `/api/v8/finance-v2/artifacts/resolve-legacy/financial_models/${randomUUID()}`
    );

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ status: 'NOT_MIGRATED' });
  });

  // -----------------------------------------------------------------
  // 3. QUARANTINED — a DIFFERENT "nothing to open" state from NOT_MIGRATED:
  //    the backfill looked at this row and deliberately excluded it, with a
  //    reason. Must not collapse into the same machine state as #2.
  // -----------------------------------------------------------------

  it('3) QUARANTINED: an alias with mapping_confidence=QUARANTINE surfaces the reason, distinct from NOT_MIGRATED', async () => {
    const created = await createArtifact({
      organizationId: orgId,
      artifactType: 'VALUATION_CASE',
      naturalKey: null,
      createdBy: userId,
    });
    const legacyId = `valuations-${randomUUID()}`;
    await insertAlias({
      legacyTable: 'valuations',
      legacyId,
      organizationId: orgId,
      artifactId: created.artifact.artifact_id,
      businessVersionId: null,
      mappingConfidence: 'QUARANTINE',
      mappingReason: 'approved_without_snapshot',
    });

    const app = appWithContext(orgId);
    const res = await request(app).get(`/api/v8/finance-v2/artifacts/resolve-legacy/valuations/${legacyId}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      status: 'QUARANTINED',
      mappingConfidence: 'QUARANTINE',
      reason: 'approved_without_snapshot',
    });
    // Different machine-readable status than #2 — the whole point of this test.
    expect(res.body.data.status).not.toBe('NOT_MIGRATED');
  });

  // -----------------------------------------------------------------
  // 4. Cross-tenant: an alias that exists but belongs to ANOTHER org must
  //    resolve as NOT_MIGRATED for this org, never leak the other org's ids.
  // -----------------------------------------------------------------

  it('4) cross-tenant: an alias belonging to another organization is invisible (NOT_MIGRATED, not a leak)', async () => {
    const created = await createArtifact({
      organizationId: otherOrgId,
      artifactType: 'HISTORICAL_ANALYSIS',
      naturalKey: null,
      createdBy: userId,
    });
    const legacyId = `financial_analyses-${randomUUID()}`;
    await insertAlias({
      legacyTable: 'financial_analyses',
      legacyId,
      organizationId: otherOrgId,
      artifactId: created.artifact.artifact_id,
      businessVersionId: created.businessVersion.business_version_id,
      mappingConfidence: 'AUTO_MIGRATE',
    });

    // Same legacyId, queried from the FIRST org's context.
    const app = appWithContext(orgId);
    const res = await request(app).get(`/api/v8/finance-v2/artifacts/resolve-legacy/financial_analyses/${legacyId}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ status: 'NOT_MIGRATED' });
  });

  // -----------------------------------------------------------------
  // 5. Bad legacyTable -> 400, not a silent 200 NOT_MIGRATED (fail loud on
  //    a genuinely malformed request, distinct from "legitimately unknown").
  // -----------------------------------------------------------------

  it('5) unknown legacyTable -> 400 INVALID_LEGACY_TABLE', async () => {
    const app = appWithContext(orgId);
    const res = await request(app).get(`/api/v8/finance-v2/artifacts/resolve-legacy/not_a_real_table/${randomUUID()}`);

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('code', 'INVALID_LEGACY_TABLE');
  });

  // -----------------------------------------------------------------
  // 6. Cross-tenant, QUARANTINED branch — this branch returns immediately
  //    after the FIRST query (no second, `finance_artifacts`-scoped query
  //    runs for QUARANTINE/EXCLUDE_WITH_REASON). Test #4 above never touches
  //    this branch at all (it uses AUTO_MIGRATE), so it gives this branch's
  //    organization_id filter zero coverage — this is the FIX-B LUKA-1 gap.
  // -----------------------------------------------------------------

  it('6) cross-tenant QUARANTINED: an alias belonging to another org with mapping_confidence=QUARANTINE is invisible (NOT_MIGRATED, never leaks the reason) — single-filter branch, no second query to fall back on', async () => {
    const created = await createArtifact({
      organizationId: otherOrgId,
      artifactType: 'VALUATION_CASE',
      naturalKey: null,
      createdBy: userId,
    });
    const legacyId = `valuations-xt-quarantine-${randomUUID()}`;
    await insertAlias({
      legacyTable: 'valuations',
      legacyId,
      organizationId: otherOrgId,
      artifactId: created.artifact.artifact_id,
      businessVersionId: null,
      mappingConfidence: 'QUARANTINE',
      mappingReason: 'other-org-secret-quarantine-reason',
    });

    // Independent verification, own pg.Client (never the app's PostgresDatabase pool): the fixture
    // row genuinely exists and genuinely belongs to otherOrgId, before trusting anything the HTTP
    // response says about it.
    const fixtureCheck = await verifyClient.query(
      `SELECT organization_id, mapping_confidence FROM finance_artifact_aliases WHERE legacy_table = $1 AND legacy_id = $2`,
      ['valuations', legacyId]
    );
    expect(fixtureCheck.rows).toHaveLength(1);
    expect(fixtureCheck.rows[0].organization_id).toBe(otherOrgId);
    expect(fixtureCheck.rows[0].mapping_confidence).toBe('QUARANTINE');

    // Same legacyId, queried from the FIRST org's context (not the owner).
    const app = appWithContext(orgId);
    const res = await request(app).get(`/api/v8/finance-v2/artifacts/resolve-legacy/valuations/${legacyId}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ status: 'NOT_MIGRATED' });
  });

  // -----------------------------------------------------------------
  // 7. THIRD defense layer, discovered this pass while designing #6: a
  //    "dangling alias" (own organization_id correct, but artifact_id
  //    points at another org's artifact) is not just unexploited — it is
  //    UNCONSTRUCTIBLE via any ordinary INSERT, because
  //    `fk_finance_alias_artifact_org` is a COMPOSITE foreign key on
  //    (artifact_id, organization_id) referencing
  //    `finance_artifacts (artifact_id, organization_id)`
  //    (`20260809_finance_v3_b01_core_artifacts.sql`). This test locks that
  //    constraint in as a regression guard — proven with an independent
  //    `pg.Client` INSERT (never through `resolveLegacyFinanceArtifact`'s
  //    own read path, and never through the app's `PostgresDatabase` pool),
  //    so a future migration that weakens/drops this FK fails here loudly
  //    instead of silently making query #2's org filter (see the file-header
  //    "MULTI-LAYER DEFENSE" note) the ONLY thing standing between a stale
  //    alias and a cross-tenant artifactId leak.
  // -----------------------------------------------------------------

  it('7) DB-level third layer: fk_finance_alias_artifact_org rejects an alias row whose organization_id disagrees with its artifact_id\'s real owning org', async () => {
    const foreignArtifact = await createArtifact({
      organizationId: otherOrgId,
      artifactType: 'BASELINE_MODEL',
      naturalKey: null,
      createdBy: userId,
    });
    const legacyId = `financial_models-xt-fk-${randomUUID()}`;

    // Deliberately inconsistent insert attempt, via the INDEPENDENT client (not the app's
    // withPinnedPostgresTransaction pool, not insertAlias()'s own helper): organization_id = orgId
    // (this test's "own" org) but artifact_id belongs to otherOrgId. Must be REJECTED by Postgres,
    // not silently accepted.
    await expect(
      verifyClient.query(
        `INSERT INTO finance_artifact_aliases
           (legacy_table, legacy_id, legacy_version, artifact_id, organization_id, business_version_id, mapping_confidence, mapping_reason)
         VALUES ($1, $2, NULL, $3, $4, $5, $6, NULL)`,
        ['financial_models', legacyId, foreignArtifact.artifact.artifact_id, orgId, foreignArtifact.businessVersion.business_version_id, 'AUTO_MIGRATE']
      )
    ).rejects.toThrow(/fk_finance_alias_artifact_org/);

    // Confirm independently: no row was left behind by the rejected INSERT (Postgres rolls back a
    // failed single-statement INSERT automatically, but this is the "never trust, always verify"
    // convention this whole file follows).
    const rows = await verifyClient.query(
      `SELECT alias_id FROM finance_artifact_aliases WHERE legacy_table = $1 AND legacy_id = $2`,
      ['financial_models', legacyId]
    );
    expect(rows.rows).toHaveLength(0);
  });
});
