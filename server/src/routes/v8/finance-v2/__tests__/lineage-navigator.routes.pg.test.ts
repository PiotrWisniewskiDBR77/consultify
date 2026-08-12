/**
 * Finance v3 canonical adapter — Pakiet ROUTES_EXPOSURE, Lineage Navigator
 * (`GET /versions/:businessVersionId/lineage-navigator`), real PostgreSQL +
 * real HTTP.
 *
 * Covers, per this package's evidentiary mandate:
 *   1. Mount proof — 404 WITH {code:'NOT_FOUND'} (route exists, resource
 *      doesn't) vs 404 WITHOUT a code field (no route matches at all).
 *   2. A real 3-node chain (Statement Pack -> Baseline Model -> Prediction
 *      Scenario) proving the compact trail, the Related panel's
 *      parents/indirectAncestors groups, the `finance_prediction_scenarios.
 *      name` variant-label join, and `createNew` (allowed downstream type).
 *   3. Cross-tenant matrix — org B reading org A's business_version_id via
 *      this NEW route -> 404, independently confirmed by a direct SQL read
 *      that org A's edge is untouched and org B owns zero lineage edges.
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

describe.skipIf(!REAL_PG)('Finance v2 ROUTES_EXPOSURE — Lineage Navigator (real HTTP + real PostgreSQL)', () => {
  let withPinnedPostgresTransaction: typeof import('../../../../database/PostgresDatabase.js').withPinnedPostgresTransaction;
  let av: typeof import('../../../../services/finance/canonical/artifactVersionService.js');
  let lineageService: typeof import('../../../../services/finance/canonical/lineageService.js');
  let financeV2Router: express.Router;

  const orgA = `org-lineagenav-a-${randomUUID()}`;
  const orgB = `org-lineagenav-b-${randomUUID()}`;
  const userA = `user-lineagenav-a-${randomUUID()}`;
  const userB = `user-lineagenav-b-${randomUUID()}`;

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

  let stmtBvId = '';
  let baselineBvId = '';
  let scenarioBvId = '';

  beforeAll(async () => {
    ({ withPinnedPostgresTransaction } = await import('../../../../database/PostgresDatabase.js'));
    av = await import('../../../../services/finance/canonical/artifactVersionService.js');
    lineageService = await import('../../../../services/finance/canonical/lineageService.js');
    financeV2Router = (await import('../index.js')).default;

    await withPinnedPostgresTransaction((tx) =>
      tx.queryRun(`INSERT INTO organizations (id, name) VALUES (?, ?), (?, ?)`, [orgA, 'LineageNav Tenant A', orgB, 'LineageNav Tenant B'])
    );

    appA = appAsOrg(orgA, userA);
    appB = appAsOrg(orgB, userB);

    // Statement Pack -> Baseline Model -> Prediction Scenario chain, org A only.
    const stmt = await av.createArtifact({ organizationId: orgA, artifactType: 'STATEMENT_PACK', createdBy: userA });
    const baseline = await av.createArtifact({ organizationId: orgA, artifactType: 'BASELINE_MODEL', createdBy: userA });
    const scenario = await av.createArtifact({ organizationId: orgA, artifactType: 'PREDICTION_SCENARIO', createdBy: userA });
    stmtBvId = stmt.businessVersion.business_version_id;
    baselineBvId = baseline.businessVersion.business_version_id;
    scenarioBvId = scenario.businessVersion.business_version_id;

    // finance_prediction_scenarios.name is the ONLY source this route's
    // metadata join reads for a PREDICTION_SCENARIO's `variantLabel`.
    await withPinnedPostgresTransaction((tx) =>
      tx.queryRun(
        `INSERT INTO finance_prediction_scenarios (id, organization_id, business_version_id, name, scenario_mode, created_by)
         VALUES (?, ?, ?, 'Bull', 'STANDARD_UPSIDE', ?)`,
        [randomUUID(), orgA, scenarioBvId, userA]
      )
    );

    const edge1 = await lineageService.insertEdge({
      organizationId: orgA,
      sourceVersionId: stmtBvId,
      sourceArtifactType: 'STATEMENT_PACK',
      targetVersionId: baselineBvId,
      targetArtifactType: 'BASELINE_MODEL',
      edgeType: 'STATEMENT_TO_MODEL',
      transformationKind: 'MANUAL_LINK',
      authorId: userA,
    });
    expect(edge1.ok).toBe(true);

    const edge2 = await lineageService.insertEdge({
      organizationId: orgA,
      sourceVersionId: baselineBvId,
      sourceArtifactType: 'BASELINE_MODEL',
      targetVersionId: scenarioBvId,
      targetArtifactType: 'PREDICTION_SCENARIO',
      edgeType: 'MODEL_TO_SCENARIO',
      transformationKind: 'MANUAL_LINK',
      authorId: userA,
      assumptionSnapshotHash: `lineagenav-hash-${randomUUID()}`,
    });
    expect(edge2.ok).toBe(true);
  });

  // -----------------------------------------------------------------
  // Mount proof
  // -----------------------------------------------------------------

  it('MOUNT PROOF: valid context + REAL router, random business_version_id -> 404 WITH {code:"NOT_FOUND"}', async () => {
    const res = await request(appA).get(`/api/v8/finance-v2/versions/${randomUUID()}/lineage-navigator`);
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('code', 'NOT_FOUND');
  });

  it('MOUNT PROOF: valid context, path no router in this tree handles -> 404 WITHOUT a code field', async () => {
    const res = await request(appA).get('/api/v8/finance-v2/this-path-truly-does-not-exist-anywhere');
    expect(res.status).toBe(404);
    expect(res.body).not.toHaveProperty('code');
  });

  // -----------------------------------------------------------------
  // Real chain — trail + related panel + variant-label join + createNew
  // -----------------------------------------------------------------

  it('GET /versions/:scenarioBvId/lineage-navigator — full 3-node trail, related panel, variant label, createNew', async () => {
    const res = await request(appA).get(`/api/v8/finance-v2/versions/${scenarioBvId}/lineage-navigator`);
    expect(res.status).toBe(200);
    const { trail, relatedPanel } = res.body.data;

    // Trail: ROOT (Statement Pack) -> Baseline Model -> FOCUS (Prediction Scenario), no collapsing (3 <= default max 5).
    expect(trail.items).toHaveLength(3);
    expect(trail.items[0].kind).toBe('node');
    expect(trail.items[0].metadata.versionId).toBe(stmtBvId);
    expect(trail.items[0].isFocus).toBe(false);
    expect(trail.items[1].metadata.versionId).toBe(baselineBvId);
    expect(trail.items[2].metadata.versionId).toBe(scenarioBvId);
    expect(trail.items[2].isFocus).toBe(true);
    // name falls back to the Polish artifact-type label (no natural_key set on this fixture);
    // variantLabel comes from finance_prediction_scenarios.name = 'Bull'.
    expect(trail.items[2].metadata.variantLabel).toBe('Bull');
    expect(trail.items[2].displayName).toBe('Scenariusz Bull v1');
    expect(trail.unresolvedVersionIds).toEqual([]);
    expect(trail.tenant.foreignVersionIds).toEqual([]);
    expect(trail.cycleVersionIds).toEqual([]);

    // Related panel: direct parent = Baseline Model, indirect ancestor = Statement Pack.
    expect(relatedPanel.focus.versionId).toBe(scenarioBvId);
    expect(relatedPanel.focus.variantLabel).toBe('Bull');
    const parentTypes = relatedPanel.parents.map((g: any) => g.artifactType);
    expect(parentTypes).toEqual(['BASELINE_MODEL']);
    expect(relatedPanel.parents[0].entries[0].metadata.versionId).toBe(baselineBvId);
    const indirectTypes = relatedPanel.indirectAncestors.map((g: any) => g.artifactType);
    expect(indirectTypes).toEqual(['STATEMENT_PACK']);
    expect(relatedPanel.indirectAncestors[0].entries[0].metadata.versionId).toBe(stmtBvId);
    expect(relatedPanel.children).toEqual([]);
    // DRAFT is not terminal -> createNew is populated. Two edge types have PREDICTION_SCENARIO
    // (stage rank 3) as an eligible source: SCENARIO_TO_VALUATION (-> VALUATION_CASE, rank 4) and
    // the 'any-upstream' VERSION_TO_REPORT (-> REPORT_EXPORT, rank 5) — so createNew has BOTH.
    expect(relatedPanel.createNewBlockedReason).toBeNull();
    const createNewTypes = relatedPanel.createNew.map((c: any) => c.targetArtifactType).sort();
    expect(createNewTypes).toEqual(['REPORT_EXPORT', 'VALUATION_CASE']);
    for (const action of relatedPanel.createNew) {
      expect(action.preselectedSource).toEqual({
        artifactId: relatedPanel.focus.artifactId,
        artifactType: 'PREDICTION_SCENARIO',
        businessVersionId: scenarioBvId,
      });
    }
    expect(relatedPanel.tenant.foreignVersionIds).toEqual([]);
    expect(relatedPanel.cycleVersionIds).toEqual([]);
  });

  it('GET /versions/:baselineBvId/lineage-navigator — mid-chain node has both a parent AND a child group', async () => {
    const res = await request(appA).get(`/api/v8/finance-v2/versions/${baselineBvId}/lineage-navigator`);
    expect(res.status).toBe(200);
    const { relatedPanel } = res.body.data;
    expect(relatedPanel.parents.map((g: any) => g.artifactType)).toEqual(['STATEMENT_PACK']);
    expect(relatedPanel.children.map((g: any) => g.artifactType)).toEqual(['PREDICTION_SCENARIO']);
  });

  // -----------------------------------------------------------------
  // Cross-tenant matrix — HTTP refusal AND independent SQL confirmation
  // -----------------------------------------------------------------

  it('CROSS-TENANT: org B reading org A scenario via lineage-navigator -> 404 {code:"NOT_FOUND"}, SQL confirms org A edge untouched and org B owns zero edges', async () => {
    const crossRead = await request(appB).get(`/api/v8/finance-v2/versions/${scenarioBvId}/lineage-navigator`);
    expect(crossRead.status).toBe(404);
    expect(crossRead.body).toHaveProperty('code', 'NOT_FOUND');

    const orgAEdges = await withPinnedPostgresTransaction((tx) =>
      tx.queryAll<{ id: string; organization_id: string }>(
        `SELECT id, organization_id FROM finance_lineage_edges WHERE organization_id = ? AND (source_version_id = ? OR target_version_id = ?)`,
        [orgA, scenarioBvId, scenarioBvId]
      )
    );
    expect(orgAEdges.length).toBe(1);
    expect(orgAEdges[0].organization_id).toBe(orgA);

    const orgBEdges = await withPinnedPostgresTransaction((tx) =>
      tx.queryAll<{ id: string }>(`SELECT id FROM finance_lineage_edges WHERE organization_id = ?`, [orgB])
    );
    expect(orgBEdges.length).toBe(0);
  });

  it('CROSS-TENANT: org B reading org A baseline (mid-chain) via lineage-navigator -> 404, org A row count for that version unaffected', async () => {
    const crossRead = await request(appB).get(`/api/v8/finance-v2/versions/${baselineBvId}/lineage-navigator`);
    expect(crossRead.status).toBe(404);
    expect(crossRead.body).toHaveProperty('code', 'NOT_FOUND');

    const legitRead = await request(appA).get(`/api/v8/finance-v2/versions/${baselineBvId}/lineage-navigator`);
    expect(legitRead.status).toBe(200);
  });

  // -----------------------------------------------------------------
  // POST /versions/lineage-edges — the write half of the same gap
  // (flagged mid-package by an independent verifier: insertEdge() had ZERO
  // production callers, only test fixtures, so the whole DAG this file's
  // read side displays could not be built through the API at all).
  // -----------------------------------------------------------------

  it('MOUNT PROOF: valid context + REAL router, unknown sourceVersionId -> 404 WITH {code:"NOT_FOUND"}', async () => {
    const res = await request(appA)
      .post('/api/v8/finance-v2/versions/lineage-edges')
      .send({
        sourceVersionId: randomUUID(),
        sourceArtifactType: 'STATEMENT_PACK',
        targetVersionId: baselineBvId,
        targetArtifactType: 'BASELINE_MODEL',
        edgeType: 'STATEMENT_TO_MODEL',
        transformationKind: 'MANUAL_LINK',
      });
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('code', 'NOT_FOUND');
  });

  it('END-TO-END: create an edge via HTTP, confirm by independent SQL, then read it back through the lineage-navigator route (closes the write->read loop)', async () => {
    const analysis = await av.createArtifact({ organizationId: orgA, artifactType: 'HISTORICAL_ANALYSIS', createdBy: userA });
    const analysisBvId = analysis.businessVersion.business_version_id;

    const createRes = await request(appA)
      .post('/api/v8/finance-v2/versions/lineage-edges')
      .send({
        sourceVersionId: stmtBvId,
        sourceArtifactType: 'STATEMENT_PACK',
        targetVersionId: analysisBvId,
        targetArtifactType: 'HISTORICAL_ANALYSIS',
        edgeType: 'STATEMENT_TO_ANALYSIS',
        transformationKind: 'MANUAL_LINK',
      });
    expect(createRes.status).toBe(201);
    expect(createRes.body.data.sourceVersionId).toBe(stmtBvId);
    expect(createRes.body.data.targetVersionId).toBe(analysisBvId);
    expect(createRes.body.data.edgeType).toBe('STATEMENT_TO_ANALYSIS');
    expect(createRes.body.data.authorId).toBe(userA);
    expect(createRes.body.data.createdAt).toBeTruthy();
    const edgeId = createRes.body.data.edgeId;

    // Independent SQL confirmation — not just "the HTTP response looked right".
    const sqlRow = await withPinnedPostgresTransaction((tx) =>
      tx.queryOne<{
        id: string;
        organization_id: string;
        source_version_id: string;
        target_version_id: string;
        edge_type: string;
        transformation_kind: string;
        author_id: string;
      }>(`SELECT * FROM finance_lineage_edges WHERE id = ?`, [edgeId])
    );
    expect(sqlRow).toBeTruthy();
    expect(sqlRow!.organization_id).toBe(orgA);
    expect(sqlRow!.source_version_id).toBe(stmtBvId);
    expect(sqlRow!.target_version_id).toBe(analysisBvId);
    expect(sqlRow!.edge_type).toBe('STATEMENT_TO_ANALYSIS');
    expect(sqlRow!.author_id).toBe(userA);

    // Read it back through the lineage-navigator route — the new edge must appear as a direct
    // child of the Statement Pack and a direct (indirect from focus's perspective) ancestor of
    // the new Analysis version's own related panel.
    const readBack = await request(appA).get(`/api/v8/finance-v2/versions/${analysisBvId}/lineage-navigator`);
    expect(readBack.status).toBe(200);
    const parentTypes = readBack.body.data.relatedPanel.parents.map((g: any) => g.artifactType);
    expect(parentTypes).toEqual(['STATEMENT_PACK']);
    expect(readBack.body.data.relatedPanel.parents[0].entries[0].metadata.versionId).toBe(stmtBvId);
  });

  it('APPEND-ONLY / DUPLICATE: re-creating the exact same edge (source, target, edgeType) already inserted in beforeAll -> 409 DUPLICATE_EDGE', async () => {
    const res = await request(appA)
      .post('/api/v8/finance-v2/versions/lineage-edges')
      .send({
        sourceVersionId: stmtBvId,
        sourceArtifactType: 'STATEMENT_PACK',
        targetVersionId: baselineBvId,
        targetArtifactType: 'BASELINE_MODEL',
        edgeType: 'STATEMENT_TO_MODEL',
        transformationKind: 'MANUAL_LINK',
      });
    expect(res.status).toBe(409);
    expect(res.body).toHaveProperty('code', 'DUPLICATE_EDGE');
  });

  it('CYCLE REJECTION: a backward edge (Baseline Model -> Statement Pack, rank 2 -> rank 0) is rejected with 409 LINEAGE_CYCLE_REJECTED, no row inserted', async () => {
    const before = await withPinnedPostgresTransaction((tx) =>
      tx.queryAll<{ id: string }>(`SELECT id FROM finance_lineage_edges WHERE organization_id = ?`, [orgA])
    );

    const res = await request(appA)
      .post('/api/v8/finance-v2/versions/lineage-edges')
      .send({
        sourceVersionId: baselineBvId,
        sourceArtifactType: 'BASELINE_MODEL',
        targetVersionId: stmtBvId,
        targetArtifactType: 'STATEMENT_PACK',
        edgeType: 'STATEMENT_TO_MODEL', // rank check runs regardless of edge_type semantics
        transformationKind: 'MANUAL_LINK',
      });
    expect(res.status).toBe(409);
    expect(res.body).toHaveProperty('code', 'LINEAGE_CYCLE_REJECTED');

    const after = await withPinnedPostgresTransaction((tx) =>
      tx.queryAll<{ id: string }>(`SELECT id FROM finance_lineage_edges WHERE organization_id = ?`, [orgA])
    );
    expect(after.length).toBe(before.length); // rejected, not silently inserted
  });

  it('CROSS-TENANT EDGE CREATION: org B tries to link org A\'s own two business_version_id -> 404 NOT_FOUND, SQL confirms zero new edges for org B and org A edge count unchanged', async () => {
    const beforeA = await withPinnedPostgresTransaction((tx) =>
      tx.queryAll<{ id: string }>(`SELECT id FROM finance_lineage_edges WHERE organization_id = ?`, [orgA])
    );

    const res = await request(appB)
      .post('/api/v8/finance-v2/versions/lineage-edges')
      .send({
        sourceVersionId: stmtBvId, // org A's real version
        sourceArtifactType: 'STATEMENT_PACK',
        targetVersionId: baselineBvId, // org A's real version
        targetArtifactType: 'BASELINE_MODEL',
        edgeType: 'STATEMENT_TO_MODEL',
        transformationKind: 'MANUAL_LINK',
      });
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('code', 'NOT_FOUND');

    const orgBEdges = await withPinnedPostgresTransaction((tx) =>
      tx.queryAll<{ id: string }>(`SELECT id FROM finance_lineage_edges WHERE organization_id = ?`, [orgB])
    );
    expect(orgBEdges.length).toBe(0);

    const afterA = await withPinnedPostgresTransaction((tx) =>
      tx.queryAll<{ id: string }>(`SELECT id FROM finance_lineage_edges WHERE organization_id = ?`, [orgA])
    );
    expect(afterA.length).toBe(beforeA.length);
  });
});
