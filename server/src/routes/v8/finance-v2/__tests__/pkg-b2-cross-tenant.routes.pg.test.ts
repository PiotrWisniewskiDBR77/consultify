/**
 * Finance v3 canonical adapter — Pakiet B2 cross-tenant matrix, real
 * PostgreSQL + real HTTP.
 *
 * ★ KONTROLA NEGATYWNA — obowiązkowa (brief §"Kontrola negatywna", same
 * pattern Pakiet B's own `cross-tenant.routes.pg.test.ts` established). For
 * every NEW endpoint family this package (B2) added — Statements, Analysis,
 * Baseline, Prediction, plus the D2/D3 additions (compute job output reader,
 * artifact rename) — organization B requests/mutates a resource created by
 * organization A and must be refused, independently confirmed by a direct
 * SQL read (never trusting only the HTTP response body).
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

describe.skipIf(!REAL_PG)('Finance v2 Pakiet B2 — cross-tenant matrix (real HTTP + real PostgreSQL)', () => {
  let withPinnedPostgresTransaction: typeof import('../../../../database/PostgresDatabase.js').withPinnedPostgresTransaction;
  let av: typeof import('../../../../services/finance/canonical/artifactVersionService.js');
  let lineageService: typeof import('../../../../services/finance/canonical/lineageService.js');
  let computeJobService: typeof import('../../../../services/finance/canonical/computeJobService.js');
  let financeV2Router: express.Router;

  const orgA = `org-pkgb2-xt-a-${randomUUID()}`;
  const orgB = `org-pkgb2-xt-b-${randomUUID()}`;
  const userA = `user-pkgb2-xt-a-${randomUUID()}`;
  const userB = `user-pkgb2-xt-b-${randomUUID()}`;
  let periodId = '';

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

  async function makeEntity(orgId: string, businessVersionId: string, entityCode: string) {
    const row = await withPinnedPostgresTransaction((tx) =>
      tx.queryOne<{ id: string }>(
        `INSERT INTO finance_stmt_entities (
           organization_id, business_version_id, entity_code, legal_name, role,
           consolidation_method, ownership_pct, functional_currency, created_by
         ) VALUES (?, ?, ?, ?, 'GROUP_PARENT', 'NOT_CONSOLIDATED', NULL, 'PLN', ?)
         RETURNING id`,
        [orgId, businessVersionId, entityCode, `${entityCode} legal name`, userA]
      )
    );
    if (!row) throw new Error('finance_stmt_entities fixture insert returned no row');
    return row.id;
  }

  beforeAll(async () => {
    ({ withPinnedPostgresTransaction } = await import('../../../../database/PostgresDatabase.js'));
    av = await import('../../../../services/finance/canonical/artifactVersionService.js');
    lineageService = await import('../../../../services/finance/canonical/lineageService.js');
    computeJobService = await import('../../../../services/finance/canonical/computeJobService.js');
    financeV2Router = (await import('../index.js')).default;

    await withPinnedPostgresTransaction((tx) =>
      tx.queryRun(`INSERT INTO organizations (id, name) VALUES (?, ?), (?, ?)`, [orgA, 'PkgB2 XT Tenant A', orgB, 'PkgB2 XT Tenant B'])
    );

    const cal = await withPinnedPostgresTransaction((tx) =>
      tx.queryOne<{ fiscal_calendar_id: string }>(
        `INSERT INTO finance_stmt_calendars (organization_id, calendar_type, fiscal_year_end_month, effective_from, created_by)
         VALUES (?, 'STANDARD', 12, '2020-01-01', ?) RETURNING fiscal_calendar_id`,
        [orgA, userA]
      )
    );
    const per = await withPinnedPostgresTransaction((tx) =>
      tx.queryOne<{ period_id: string }>(
        `INSERT INTO finance_stmt_periods (organization_id, fiscal_calendar_id, period_type, fiscal_year, period_start, period_end, label, created_by)
         VALUES (?, ?, 'FY', 2025, '2025-01-01', '2025-12-31', 'FY2025', ?) RETURNING period_id`,
        [orgA, cal!.fiscal_calendar_id, userA]
      )
    );
    periodId = per!.period_id;

    appA = appAsOrg(orgA, userA);
    appB = appAsOrg(orgB, userB);
  });

  it('GET /statements/:id/lines — org B on org A Statement Pack -> 404, SQL confirms lines still exist for org A', async () => {
    const created = await request(appA).post('/api/v8/finance-v2/artifacts').send({ artifactType: 'STATEMENT_PACK' });
    const bvId = created.body.data.currentBusinessVersion.businessVersionId;
    const entityId = await makeEntity(orgA, bvId, `PARENT-${randomUUID().slice(0, 8)}`);
    const entityCode = (
      await withPinnedPostgresTransaction((tx) => tx.queryOne<{ entity_code: string }>(`SELECT entity_code FROM finance_stmt_entities WHERE id = ?`, [entityId]))
    )?.entity_code;
    const mapRes = await request(appA)
      .post(`/api/v8/finance-v2/statements/${bvId}/map`)
      .send({
        unit: 'UNITS',
        presentationCurrency: 'PLN',
        rawLines: [{ lineItem: 'Cash', periodId, entityCode, currency: 'PLN', value: 100, sourceRef: {} }],
        rules: [{ sourceLabel: 'Cash', statementType: 'BS', lineCode: 'CASH' }],
      });
    expect(mapRes.status).toBe(201);

    const crossRead = await request(appB).get(`/api/v8/finance-v2/statements/${bvId}/lines`);
    expect(crossRead.status).toBe(404);
    expect(crossRead.body.code).toBe('NOT_FOUND');

    const rows = await withPinnedPostgresTransaction((tx) =>
      tx.queryAll<{ organization_id: string }>(`SELECT organization_id FROM finance_stmt_lines WHERE business_version_id = ?`, [bvId])
    );
    expect(rows.length).toBe(1);
    expect(rows[0].organization_id).toBe(orgA);
  });

  it('POST /statements/:id/reconcile — org B attempting to reconcile org A version -> 404, SQL confirms zero reconciliation runs for org B', async () => {
    const created = await request(appA).post('/api/v8/finance-v2/artifacts').send({ artifactType: 'STATEMENT_PACK' });
    const bvId = created.body.data.currentBusinessVersion.businessVersionId;

    const res = await request(appB).post(`/api/v8/finance-v2/statements/${bvId}/reconcile`).send({ sourceSystem: 'attack', mappingResults: [] });
    expect(res.status).toBe(404);

    const rows = await withPinnedPostgresTransaction((tx) =>
      tx.queryAll<{ id: string }>(`SELECT id FROM finance_reconciliation_runs WHERE business_version_id = ? AND organization_id = ?`, [bvId, orgB])
    );
    expect(rows.length).toBe(0);
  });

  it('GET /analysis/:id/kpi-values — org B on org A Analysis -> 404', async () => {
    const created = await request(appA).post('/api/v8/finance-v2/artifacts').send({ artifactType: 'HISTORICAL_ANALYSIS' });
    const bvId = created.body.data.currentBusinessVersion.businessVersionId;

    const res = await request(appB).get(`/api/v8/finance-v2/analysis/${bvId}/kpi-values`);
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });

  it('POST /analysis/:id/compute — org B attempting to compute org A Analysis -> 404 (NO_SOURCE_STATEMENT_PACK_EDGE, org-scoped edge lookup finds nothing), no compute_jobs row for org B', async () => {
    const created = await request(appA).post('/api/v8/finance-v2/artifacts').send({ artifactType: 'HISTORICAL_ANALYSIS' });
    const bvId = created.body.data.currentBusinessVersion.businessVersionId;

    const res = await request(appB).post(`/api/v8/finance-v2/analysis/${bvId}/compute`).send({});
    expect(res.status).toBe(404);

    const rows = await withPinnedPostgresTransaction((tx) =>
      tx.queryAll<{ id: string }>(`SELECT id FROM compute_jobs WHERE input_artifact_id = (SELECT artifact_id FROM finance_business_versions WHERE business_version_id = ?) AND organization_id = ?`, [
        bvId,
        orgB,
      ])
    );
    expect(rows.length).toBe(0);
  });

  it('GET /baseline/:id/assumptions and POST — org B on org A Baseline Model -> 404 both ways, SQL confirms zero assumption rows for org B', async () => {
    const created = await request(appA).post('/api/v8/finance-v2/artifacts').send({ artifactType: 'BASELINE_MODEL' });
    const bvId = created.body.data.currentBusinessVersion.businessVersionId;

    const readRes = await request(appB).get(`/api/v8/finance-v2/baseline/${bvId}/assumptions`);
    expect(readRes.status).toBe(404);

    const writeRes = await request(appB)
      .post(`/api/v8/finance-v2/baseline/${bvId}/assumptions`)
      .send({ assumptions: [{ scheduleType: 'revenue_pvm', driverCode: 'X', entityId: randomUUID(), periodId, rule: 'FIXED_VALUE', valueStatus: 'MISSING', unit: 'PCT' }] });
    expect(writeRes.status).toBe(404);

    const rows = await withPinnedPostgresTransaction((tx) =>
      tx.queryAll<{ id: string }>(`SELECT id FROM finance_baseline_assumptions WHERE business_version_id = ? AND organization_id = ?`, [bvId, orgB])
    );
    expect(rows.length).toBe(0);
  });

  it('POST /prediction/:id/preflight — org B on org A scenario -> 404, SQL confirms zero preflight runs for org B', async () => {
    const baseline = await av.createArtifact({ organizationId: orgA, artifactType: 'BASELINE_MODEL', createdBy: userA });
    const scenario = await av.createArtifact({ organizationId: orgA, artifactType: 'PREDICTION_SCENARIO', createdBy: userA });
    const scenarioBvId = scenario.businessVersion.business_version_id;
    await withPinnedPostgresTransaction((tx) =>
      tx.queryRun(
        `INSERT INTO finance_prediction_scenarios (id, organization_id, business_version_id, name, scenario_mode, created_by)
         VALUES (?, ?, ?, 'xt scenario', 'FUNDAMENTAL_INITIATIVE', ?)`,
        [randomUUID(), orgA, scenarioBvId, userA]
      )
    );
    const edge = await lineageService.insertEdge({
      organizationId: orgA,
      sourceVersionId: baseline.businessVersion.business_version_id,
      sourceArtifactType: 'BASELINE_MODEL',
      targetVersionId: scenarioBvId,
      targetArtifactType: 'PREDICTION_SCENARIO',
      edgeType: 'MODEL_TO_SCENARIO',
      transformationKind: 'MANUAL_LINK',
      authorId: userA,
      assumptionSnapshotHash: `xt-hash-${randomUUID()}`,
    });
    expect(edge.ok).toBe(true);

    const res = await request(appB).post(`/api/v8/finance-v2/prediction/${scenarioBvId}/preflight`).send({});
    expect(res.status).toBe(404);

    const rows = await withPinnedPostgresTransaction((tx) =>
      tx.queryAll<{ id: string }>(`SELECT id FROM finance_prediction_preflight_runs WHERE business_version_id = ? AND organization_id = ?`, [scenarioBvId, orgB])
    );
    expect(rows.length).toBe(0);
  });

  it('GET /compute/jobs/:id/output (D2) — org B on org A job -> 404, org B never sees org A output', async () => {
    const artifact = await request(appA).post('/api/v8/finance-v2/artifacts').send({ artifactType: 'BASELINE_MODEL' });
    const artifactId = artifact.body.data.artifactId;
    const engineManifestId = (
      await withPinnedPostgresTransaction((tx) =>
        tx.queryOne<{ engine_manifest_id: string }>(`SELECT engine_manifest_id FROM finance_engine_manifests WHERE engine_name = 'LEGACY_UNKNOWN' LIMIT 1`)
      )
    )?.engine_manifest_id;
    const enqueueRes = await request(appA)
      .post('/api/v8/finance-v2/compute/jobs')
      .set('Idempotency-Key', `xt-b2-output-${randomUUID()}`)
      .send({ jobType: 'BASELINE_COMPUTE', inputArtifactId: artifactId, inputRevisionHash: 'xh', engineManifestId });
    const jobId = enqueueRes.body.data.jobId;

    const crossRead = await request(appB).get(`/api/v8/finance-v2/compute/jobs/${jobId}/output`);
    expect(crossRead.status).toBe(404);
    expect(crossRead.body.code).toBe('NOT_FOUND');

    // Even a same-org call sees OUTPUT_NOT_READY (job never completed) — proves 404 above is the
    // tenant boundary, not merely "no output committed yet" leaking through as the SAME code.
    const legitRead = await request(appA).get(`/api/v8/finance-v2/compute/jobs/${jobId}/output`);
    expect(legitRead.status).toBe(404);
    expect(legitRead.body.code).toBe('OUTPUT_NOT_READY');
  });

  it('POST /artifacts/:id/rename (D3) — org B renaming org A artifact -> 404, SQL confirms natural_key unchanged', async () => {
    const created = await request(appA).post('/api/v8/finance-v2/artifacts').send({ artifactType: 'HISTORICAL_ANALYSIS', naturalKey: 'Original Name' });
    const artifactId = created.body.data.artifactId;

    const crossRename = await request(appB).post(`/api/v8/finance-v2/artifacts/${artifactId}/rename`).send({ naturalKey: 'Hijacked Name' });
    expect(crossRename.status).toBe(404);

    const row = await withPinnedPostgresTransaction((tx) =>
      tx.queryOne<{ natural_key: string; organization_id: string }>(`SELECT natural_key, organization_id FROM finance_artifacts WHERE artifact_id = ?`, [artifactId])
    );
    expect(row?.natural_key).toBe('Original Name');
    expect(row?.organization_id).toBe(orgA);

    // Legitimate same-org rename still works afterward.
    const legit = await request(appA).post(`/api/v8/finance-v2/artifacts/${artifactId}/rename`).send({ naturalKey: 'Renamed By Owner' });
    expect(legit.status).toBe(200);
    expect(legit.body.data.naturalKey).toBe('Renamed By Owner');
  });

  it('GET /versions/:id/lineage and /exceptions/open — org B never sees org A rows (empty result, not an error leak)', async () => {
    const created = await request(appA).post('/api/v8/finance-v2/artifacts').send({ artifactType: 'STATEMENT_PACK' });
    const bvId = created.body.data.currentBusinessVersion.businessVersionId;
    const artifactId = created.body.data.artifactId;

    const lineageRes = await request(appB).get(`/api/v8/finance-v2/versions/${bvId}/lineage`);
    expect(lineageRes.status).toBe(200);
    expect(lineageRes.body.data.ancestors).toEqual([]);
    expect(lineageRes.body.data.descendants).toEqual([]);

    const exceptionsRes = await request(appB).get(`/api/v8/finance-v2/exceptions/open?artifactId=${artifactId}`);
    expect(exceptionsRes.status).toBe(200);
    expect(exceptionsRes.body.data).toEqual([]);
  });
});
