/**
 * Finance v3 — ID BRIDGE (Gate E). Proves `GET /artifacts/resolve-legacy/:legacyTable/:legacyId`
 * (`artifacts.routes.ts`) actually reads `finance_artifact_aliases` and returns the three
 * distinguishable outcomes: RESOLVED / NOT_MIGRATED / QUARANTINED — never collapsing the two
 * "nothing to open yet" states into one (CLAUDE.md §2.3).
 *
 * Same real-Postgres gate convention as every other `finance-v2/__tests__/*.pg.test.ts` file
 * (`mount-proof.pg.test.ts` header): requires RUN_DB_TESTS=1 + MOCK_DB=false + NODE_ENV=test +
 * an explicit postgres DATABASE_URL, else the whole suite is skipped (not silently mocked).
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

describe.skipIf(!REAL_PG)('ID BRIDGE — GET /artifacts/resolve-legacy/:legacyTable/:legacyId', () => {
  let withPinnedPostgresTransaction: typeof import('../../../../database/PostgresDatabase.js').withPinnedPostgresTransaction;
  let createArtifact: typeof import('../../../../services/finance/canonical/artifactVersionService.js').createArtifact;
  let financeV2Router: express.Router;

  const orgId = `org-idbridge-${randomUUID()}`;
  const otherOrgId = `org-idbridge-other-${randomUUID()}`;
  const userId = `user-idbridge-${randomUUID()}`;

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
  }, 120000);

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
});
