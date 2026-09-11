/** @vitest-environment node */
import { randomUUID } from 'node:crypto';

import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../../../../../../tests/integration/_helpers/assertRealPostgres.js';

const connectionString = process.env.DATABASE_URL ?? '';
const realPg = process.env.RUN_DB_TESTS === '1' && process.env.MOCK_DB === 'false' && connectionString.startsWith('postgresql://');
if (realPg) process.env.DB_TYPE = 'postgres';

describe.skipIf(!realPg)('CODEX3 E3 — bulk lineage through real ApiGateway', { retry: 0 }, () => {
  const organizationId = `codex3-lineage-${randomUUID()}`;
  const otherOrganizationId = `codex3-lineage-other-${randomUUID()}`;
  const ownerId = `codex3-lineage-owner-${randomUUID()}`;
  const otherOwnerId = `codex3-lineage-other-owner-${randomUUID()}`;
  let app: express.Express;
  let sourceVersionId: string;
  let targetVersionId: string;
  // Przewód E3 do listy (97_ODBIOR_W1_W2.md §6 STOP3/§9b, WZNOWIENIE 2026-09-11):
  // `legacyIdWithAlias` ma wiersz w `finance_artifact_aliases` -> `sourceVersionId`;
  // `legacyIdWithoutAlias` celowo NIE ma aliasu (honest gap, `unresolvedIds`).
  const legacyIdWithAlias = `financial_statement_packs:${randomUUID()}`;
  const legacyIdWithoutAlias = `financial_statement_packs:${randomUUID()}`;

  const bearer = (userId: string, orgId: string) => ({
    Authorization: `Bearer ${jwt.sign({ id: userId, userId, organizationId: orgId, organization_id: orgId, role: 'OWNER' }, process.env.JWT_SECRET!, { algorithm: 'HS256', expiresIn: '1h' })}`,
  });

  beforeAll(async () => {
    expect(process.env.DB_TYPE).toBe('postgres');
    expect(process.env.ENABLE_TEST_AUTH_BYPASS).toBe('false');
    await assertRealPostgresTestEnvironment();
    const { withPinnedPostgresTransaction } = await import('../../../../database/PostgresDatabase.js');
    const { createArtifact } = await import('../../../../services/finance/canonical/artifactVersionService.js');
    const { insertEdge } = await import('../../../../services/finance/canonical/lineageService.js');
    await withPinnedPostgresTransaction(async (tx) => {
      for (const [orgId, userId] of [[organizationId, ownerId], [otherOrganizationId, otherOwnerId]] as const) {
        await tx.queryRun('INSERT INTO organizations (id, name) VALUES (?, ?)', [orgId, `CODEX3 ${orgId}`]);
        await tx.queryRun("INSERT INTO users (id, organization_id, email, password, role, status) VALUES (?, ?, ?, 'unused', 'OWNER', 'active')", [userId, orgId, `${userId}@test.invalid`]);
        await tx.queryRun("INSERT INTO organization_members (id, organization_id, user_id, role, status) VALUES (?, ?, ?, 'OWNER', 'ACTIVE')", [`membership-${userId}`, orgId, userId]);
      }
    });
    const source = await createArtifact({ organizationId, artifactType: 'STATEMENT_PACK', naturalKey: `source-${randomUUID()}`, createdBy: ownerId });
    const target = await createArtifact({ organizationId, artifactType: 'HISTORICAL_ANALYSIS', naturalKey: `target-${randomUUID()}`, createdBy: ownerId });
    sourceVersionId = source.businessVersion.business_version_id;
    targetVersionId = target.businessVersion.business_version_id;
    await withPinnedPostgresTransaction(async (tx) => {
      await tx.queryRun("UPDATE finance_artifacts SET display_name = 'CD PROJEKT source statement' WHERE artifact_id = ?", [source.artifact.artifact_id]);
      await tx.queryRun("UPDATE finance_artifacts SET display_name = 'CD PROJEKT analysis' WHERE artifact_id = ?", [target.artifact.artifact_id]);
    });
    const inserted = await insertEdge({ organizationId, sourceVersionId, sourceArtifactType: 'STATEMENT_PACK', targetVersionId, targetArtifactType: 'HISTORICAL_ANALYSIS', edgeType: 'STATEMENT_TO_ANALYSIS', transformationKind: 'COMPUTE', authorId: ownerId });
    expect(inserted.ok).toBe(true);
    // Most legacy→kanon (WP-C03, `finance_artifact_aliases`, 13 wierszy na kopii
    // sztabowej `consultify_kopia_fe3`) — jeden wiersz per organizację, tak jak
    // pisze go `statementPackRegistrationService.ts:287-295`.
    await withPinnedPostgresTransaction(async (tx) => {
      await tx.queryRun(
        `INSERT INTO finance_artifact_aliases
         (legacy_table, legacy_id, legacy_version, artifact_id, organization_id,
          business_version_id, mapping_confidence, mapping_reason, created_by)
         VALUES ('financial_statement_packs', ?, '', ?, ?, ?, 'AUTO_MIGRATE', 'CODEX3 E3 test fixture', ?)`,
        [legacyIdWithAlias, source.artifact.artifact_id, organizationId, sourceVersionId, ownerId]
      );
    });
    const { ApiGateway } = await import('../../../../Gateway.js');
    app = express();
    app.use(express.json());
    ApiGateway.getInstance().initializeRoutes(app);
  }, 120_000);

  const post = (ids: unknown, userId = ownerId, orgId = organizationId) => request(app)
    .post('/api/v8/finance-v2/versions/lineage-edges/bulk-read')
    .set(bearer(userId, orgId))
    .send({ businessVersionIds: ids });

  it('uses PostgreSQL and an authenticated production route', async () => {
    expect((await request(app).post('/api/v8/finance-v2/versions/lineage-edges/bulk-read').send({ businessVersionIds: [] })).status).toBe(401);
  });

  it('returns one organization-scoped response for several version ids', async () => {
    const response = await post([sourceVersionId, targetVersionId]);
    expect(response.status).toBe(200);
    expect(response.body.data.businessVersionIds).toEqual([sourceVersionId, targetVersionId]);
    expect(response.body.data.edges).toHaveLength(1);
    // (a) kanoniczne BV id -> jak dotąd, plus pola addytywne: id rozwiązuje się na siebie.
    expect(response.body.data.resolvedVersionIds).toMatchObject({
      [sourceVersionId]: sourceVersionId,
      [targetVersionId]: targetVersionId,
    });
    expect(response.body.data.unresolvedIds).toEqual([]);
  });

  it('(b) resolves a legacy id through finance_artifact_aliases to the canonical edge', async () => {
    const response = await post([legacyIdWithAlias, targetVersionId]);
    expect(response.status).toBe(200);
    expect(response.body.data.businessVersionIds).toEqual([legacyIdWithAlias, targetVersionId]);
    expect(response.body.data.edges).toHaveLength(1);
    expect(response.body.data.edges[0]).toMatchObject({ sourceVersionId, targetVersionId });
    expect(response.body.data.resolvedVersionIds).toMatchObject({
      [legacyIdWithAlias]: sourceVersionId,
      [targetVersionId]: targetVersionId,
    });
    expect(response.body.data.unresolvedIds).toEqual([]);
  });

  it('(c) returns the honest NO_LINEAGE contract for a legacy id without an alias', async () => {
    const response = await post([legacyIdWithoutAlias]);
    expect(response.status).toBe(200);
    expect(response.body.data.edges).toEqual([]);
    expect(response.body.data.resolvedVersionIds).toEqual({});
    expect(response.body.data.unresolvedIds).toEqual([legacyIdWithoutAlias]);
  });

  it('(d) does not resolve another organization alias — no cross-tenant leak', async () => {
    const response = await post([legacyIdWithAlias], otherOwnerId, otherOrganizationId);
    expect(response.status).toBe(200);
    expect(response.body.data.edges).toEqual([]);
    expect(response.body.data.resolvedVersionIds).toEqual({});
    expect(response.body.data.unresolvedIds).toEqual([legacyIdWithAlias]);
  });

  it('returns display names rather than hashes', async () => {
    const response = await post([targetVersionId]);
    expect(response.body.data.edges[0]).toMatchObject({ sourceDisplayName: 'CD PROJEKT source statement', targetDisplayName: 'CD PROJEKT analysis' });
  });

  it('deduplicates repeated business version ids before querying', async () => {
    const response = await post([targetVersionId, targetVersionId]);
    expect(response.status).toBe(200);
    expect(response.body.data.businessVersionIds).toEqual([targetVersionId]);
    expect(response.body.data.edges).toHaveLength(1);
  });

  it('does not disclose another organization lineage', async () => {
    const response = await post([sourceVersionId, targetVersionId], otherOwnerId, otherOrganizationId);
    expect(response.status).toBe(200);
    expect(response.body.data.edges).toEqual([]);
  });

  it('returns an honest empty collection when no edge exists', async () => {
    const response = await post([randomUUID()]);
    expect(response.status).toBe(200);
    expect(response.body.data.edges).toEqual([]);
  });

  it('rejects more than 100 unique ids', async () => {
    const response = await post(Array.from({ length: 101 }, () => randomUUID()));
    expect(response.status).toBe(400);
    expect(response.body.code).toBe('BUSINESS_VERSION_IDS_LIMIT_EXCEEDED');
  });

  it('(e) enforces the 100-id limit on the requested surface even when ids would resolve to far fewer canonical versions', async () => {
    // 101 unikatowych legacy id, WSZYSTKIE bez aliasu — gdyby limit liczył po
    // rozwiązaniu (0 kanonicznych trafień), request przeszedłby cicho. Limit
    // musi paść na wejściu, zanim `resolveLineageRequestIds` w ogóle odpali.
    const response = await post(Array.from({ length: 101 }, () => `financial_statement_packs:${randomUUID()}`));
    expect(response.status).toBe(400);
    expect(response.body.code).toBe('BUSINESS_VERSION_IDS_LIMIT_EXCEEDED');
  });

  it('rejects malformed input instead of returning a false empty result', async () => {
    const response = await post(['valid', '']);
    expect(response.status).toBe(400);
    expect(response.body.code).toBe('INVALID_BUSINESS_VERSION_IDS');
  });
});
