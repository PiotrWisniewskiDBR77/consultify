#!/usr/bin/env tsx
/**
 * J2 — CROSS-TENANT MATRIX probe for Finance v3 (`/api/v8/finance-v2/*`).
 *
 * Gate J, agent J2. This is NOT a vitest file (deliberately) — it is a standalone script so that
 * "negative control" runs (temporarily breaking a route's organizationId source, one file at a
 * time) are simple: edit the .ts file on disk, run `npx tsx` again (fresh process = fresh module
 * graph, no import-cache tricks needed), observe the result, `git checkout` the file back.
 *
 * Every verification read in here goes through a RAW, independent `pg.Client` — its own TCP
 * socket — never through `withPinnedPostgresTransaction` (the application's own DB layer, which
 * the routes under test also use). That is the literal "niezależny odczyt SQL" requirement: if the
 * app's own DB abstraction were ever the thing lying to us, reusing it for verification would prove
 * nothing.
 *
 * Usage:
 *   DATABASE_URL=postgresql://...  RUN_DB_TESTS=1 MOCK_DB=false NODE_ENV=test \
 *     npx tsx server/scripts/finance-v3-audit/j2-crosstenant-probe.ts [--only=<family>]
 *
 * Prints a human-readable matrix to stdout AND writes JSON results to
 * /tmp/j2-crosstenant-results.json for report assembly.
 */
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';

import express from 'express';
import request from 'supertest';
import pg from 'pg';

const DATABASE_URL = process.env.DATABASE_URL || '';
if (!process.env.RUN_DB_TESTS || process.env.RUN_DB_TESTS !== '1' || process.env.MOCK_DB !== 'false' || !DATABASE_URL.startsWith('postgres')) {
  console.error('REFUSING TO RUN: requires RUN_DB_TESTS=1 MOCK_DB=false NODE_ENV=test and an explicit postgres DATABASE_URL.');
  process.exit(2);
}
if (!/127\.0\.0\.1|localhost/.test(DATABASE_URL)) {
  console.error(`REFUSING TO RUN: DATABASE_URL does not point at 127.0.0.1/localhost (${DATABASE_URL}). Zero tolerance for demo/staging/prod.`);
  process.exit(2);
}
process.env.DB_TYPE = 'postgres';

type Verdict = 'BLOCKED' | 'LEAK' | 'NOT_APPLICABLE' | 'ERROR';

interface ProbeResult {
  family: string;
  endpoint: string;
  operation: string;
  identifierType: string;
  httpMethod: string;
  httpStatus: number;
  httpCode?: string;
  sqlIndependentCheck: string;
  mutationDetected: boolean;
  bodyLeakCheck?: string;
  verdict: Verdict;
  notes?: string;
}

const results: ProbeResult[] = [];

function record(r: ProbeResult) {
  results.push(r);
  const mark = r.verdict === 'BLOCKED' ? 'PASS' : r.verdict === 'NOT_APPLICABLE' ? 'N/A ' : r.verdict === 'ERROR' ? 'ERR ' : '*** LEAK ***';
  console.log(`[${mark}] ${r.family} :: ${r.operation} (${r.identifierType}) -> HTTP ${r.httpStatus}${r.httpCode ? ' ' + r.httpCode : ''} | sql: ${r.sqlIndependentCheck} | mutated=${r.mutationDetected}`);
}

// ---------------------------------------------------------------------------
// Independent raw pg.Client — separate TCP socket, never the app's own pool.
// ---------------------------------------------------------------------------
const sql = new pg.Client({ connectionString: DATABASE_URL });

async function sqlOne<T = any>(text: string, params: unknown[] = []): Promise<T | null> {
  const r = await sql.query(text, params);
  return (r.rows[0] as T) ?? null;
}
async function sqlAll<T = any>(text: string, params: unknown[] = []): Promise<T[]> {
  const r = await sql.query(text, params);
  return r.rows as T[];
}

async function main() {
  await sql.connect();

  const { withPinnedPostgresTransaction } = await import('../../src/database/PostgresDatabase.js');
  const financeV2Router = (await import('../../src/routes/v8/finance-v2/index.js')).default;
  const av = await import('../../src/services/finance/canonical/artifactVersionService.js');
  const lineageService = await import('../../src/services/finance/canonical/lineageService.js');

  const orgA = `org-j2-a-${randomUUID()}`;
  const orgB = `org-j2-b-${randomUUID()}`;
  const userA = `user-j2-a-${randomUUID()}`;
  const userA2 = `user-j2-a2-${randomUUID()}`; // second org-A user — SoD forbids self-approval, so the "legit control" approve needs a different actor than the submitter
  const userB = `user-j2-b-${randomUUID()}`;

  function appAsOrg(orgId: string, userId: string) {
    const a = express();
    a.use(express.json());
    a.use((req: any, _res, next) => {
      req.user = { id: userId, organizationId: orgId, role: 'finance_admin' };
      req.v8Context = { organizationId: orgId, userId, userRole: 'finance_admin' };
      next();
    });
    a.use('/api/v8/finance-v2', financeV2Router);
    a.use((err: any, _req: any, res: any, _next: any) => res.status(err?.status || 500).json({ error: String(err?.message || err), stack: err?.stack }));
    return a;
  }

  const appA = appAsOrg(orgA, userA);
  const appA2 = appAsOrg(orgA, userA2);
  const appB = appAsOrg(orgB, userB);

  await sql.query(`INSERT INTO organizations (id, name) VALUES ($1,$2),($3,$4)`, [orgA, 'J2 Tenant A', orgB, 'J2 Tenant B']);

  const engineManifestId = (await sqlOne<{ engine_manifest_id: string }>(
    `SELECT engine_manifest_id FROM finance_engine_manifests WHERE engine_name = 'LEGACY_UNKNOWN' LIMIT 1`
  ))?.engine_manifest_id;

  // --- fixtures created by org A -------------------------------------------------------------
  const artifactHA = await request(appA).post('/api/v8/finance-v2/artifacts').send({ artifactType: 'HISTORICAL_ANALYSIS' });
  const haArtifactId = artifactHA.body.data.artifactId as string;
  const haBvId = artifactHA.body.data.currentBusinessVersion.businessVersionId as string;

  const artifactBM = await request(appA).post('/api/v8/finance-v2/artifacts').send({ artifactType: 'BASELINE_MODEL' });
  const bmArtifactId = artifactBM.body.data.artifactId as string;
  const bmBvId = artifactBM.body.data.currentBusinessVersion.businessVersionId as string;

  const artifactSP = await request(appA).post('/api/v8/finance-v2/artifacts').send({ artifactType: 'STATEMENT_PACK' });
  const spArtifactId = artifactSP.body.data.artifactId as string;
  const spBvId = artifactSP.body.data.currentBusinessVersion.businessVersionId as string;

  // ===========================================================================================
  // NEGATIVE CONTROL MODE — J2_NEGCTRL=<target>. Exercises ONE specific attack request whose
  // shape matches exactly what the corresponding route's organizationId-source line would need to
  // be tricked by if it read from req.body.organizationId instead of getV8Context(req). The bash
  // driver patches that one line on disk (git show ee5736a5a6:<file> > <file> to revert), runs this
  // script with J2_NEGCTRL set, and expects LEAK — proving the probe is sensitive to a real
  // regression, not just rubber-stamping 404s. Skips the full matrix below for speed.
  // ===========================================================================================
  const negctrlTarget = process.env.J2_NEGCTRL;
  if (negctrlTarget) {
    let res: request.Response;
    let check: { leak: boolean; detail: string };
    switch (negctrlTarget) {
      case 'compare': {
        res = await request(appB)
          .post('/api/v8/finance-v2/compare/periods')
          .send({ organizationId: orgA, artifactRef: { organizationId: orgA, artifactId: haArtifactId, businessVersionId: haBvId, artifactType: 'HISTORICAL_ANALYSIS', naturalKey: null }, periodIdA: 'p1', periodIdB: 'p2' });
        check = { leak: res.status !== 403 && res.status !== 404, detail: `status=${res.status} code=${res.body?.code}` };
        break;
      }
      case 'comments': {
        res = await request(appB).post('/api/v8/finance-v2/comments').send({ organizationId: orgA, artifactId: haArtifactId, businessVersionId: haBvId, body: 'negctrl hijack' });
        const orgBRows = await sqlAll<{ id: string }>(`SELECT id FROM finance_comments WHERE business_version_id=$1`, [haBvId]);
        check = { leak: res.status === 201 || orgBRows.length > 0, detail: `status=${res.status} orgA-scoped-comment-rows-now=${orgBRows.length}` };
        break;
      }
      case 'saved-views': {
        const validGridViewState = { schemaVersion: 1, freezeRowsCount: 0, freezeColumnsCount: 0, columns: [], rows: [], groups: [] };
        res = await request(appB).post('/api/v8/finance-v2/saved-views').send({ organizationId: orgA, artifactId: haArtifactId, scope: 'PERSONAL', name: 'negctrl hijack', gridViewState: validGridViewState });
        check = { leak: res.status === 201, detail: `status=${res.status} code=${res.body?.code}` };
        break;
      }
      case 'lineage-navigator': {
        // Both source AND target are genuine org-A resources — org B (real JWT/session org) forges
        // organizationId=orgA in the body to impersonate org A end-to-end for this one write. If the
        // patched line trusts the body, source+target both resolve (both really belong to orgA) and
        // the edge is written under organizationId=orgA despite the actual caller being org B.
        const orgAScenario = await request(appA).post('/api/v8/finance-v2/artifacts').send({ artifactType: 'PREDICTION_SCENARIO' });
        const orgAScenarioBvId = orgAScenario.body?.data?.currentBusinessVersion?.businessVersionId;
        res = await request(appB).post('/api/v8/finance-v2/versions/lineage-edges').send({
          organizationId: orgA,
          sourceVersionId: bmBvId,
          sourceArtifactType: 'BASELINE_MODEL',
          targetVersionId: orgAScenarioBvId,
          targetArtifactType: 'PREDICTION_SCENARIO',
          edgeType: 'MODEL_TO_SCENARIO',
          transformationKind: 'MANUAL_LINK',
          assumptionSnapshotHash: `negctrl-${randomUUID()}`,
        });
        const orgAEdgesWithNegctrlHash = await sqlAll<{ id: string }>(`SELECT id FROM finance_lineage_edges WHERE organization_id=$1 AND assumption_snapshot_hash LIKE 'negctrl-%'`, [orgA]);
        check = { leak: res.status === 201 || orgAEdgesWithNegctrlHash.length > 0, detail: `status=${res.status} code=${res.body?.code} orgA-edges-written-by-orgB-caller=${orgAEdgesWithNegctrlHash.length}` };
        break;
      }
      case 'export-import': {
        res = await request(appB).get(`/api/v8/finance-v2/export/statement-pack/${spArtifactId}/${spBvId}?organizationId=${orgA}`);
        check = { leak: res.status === 200, detail: `status=${res.status} content-type=${res.headers?.['content-type']}` };
        break;
      }
      case 'models': {
        const versionRow = await sqlOne<{ version: number }>(`SELECT version FROM finance_business_versions WHERE business_version_id=$1`, [bmBvId]);
        await request(appA).post(`/api/v8/finance-v2/versions/${bmBvId}/transitions`).send({ action: 'submit_for_review', expectedVersion: versionRow!.version });
        res = await request(appB).post(`/api/v8/finance-v2/models/${bmArtifactId}/approve`).send({ organizationId: orgA });
        check = { leak: res.status !== 404, detail: `status=${res.status} code=${res.body?.code}` };
        break;
      }
      case 'crosscutting': {
        const exceptionLedgerService = await import('../../src/services/finance/canonical/exceptionLedgerService.js');
        const raised = await exceptionLedgerService.raise({ organizationId: orgA, artifactId: haArtifactId, businessVersionId: haBvId, severity: 'MATERIAL', sourceRef: { negctrl: true }, reasonCode: 'NEGCTRL', raisedBy: userA });
        const excId = raised.ok ? raised.exception.id : 'RAISE_FAILED';
        res = await request(appB).get(`/api/v8/finance-v2/exceptions/open?artifactId=${haArtifactId}&organizationId=${orgA}`);
        const bodyHasIt = JSON.stringify(res.body).includes(excId);
        check = { leak: bodyHasIt, detail: `status=${res.status} bodyContainsOrgAException=${bodyHasIt}` };
        break;
      }
      case 'versions': {
        res = await request(appB).get(`/api/v8/finance-v2/versions/${haBvId}?organizationId=${orgA}`);
        check = { leak: res.status === 200, detail: `status=${res.status}` };
        break;
      }
      case 'valuation': {
        const caseRes = await request(appA).post('/api/v8/finance-v2/valuation/cases').send({ name: `negctrl case ${randomUUID().slice(0, 8)}` });
        const caseId = caseRes.body?.data?.caseId;
        res = await request(appB).get(`/api/v8/finance-v2/valuation/cases/${caseId}?organizationId=${orgA}`);
        check = { leak: res.status === 200, detail: `status=${res.status} caseId=${caseId}` };
        break;
      }
      case 'baseline': {
        res = await request(appB).get(`/api/v8/finance-v2/baseline/${bmBvId}/assumptions?organizationId=${orgA}`);
        check = { leak: res.status === 200, detail: `status=${res.status}` };
        break;
      }
      default:
        console.error(`Unknown J2_NEGCTRL target: ${negctrlTarget}`);
        await sql.end();
        process.exit(2);
        return;
    }
    console.log(`NEGCTRL[${negctrlTarget}] leak=${check.leak} :: ${check.detail}`);
    await sql.end();
    process.exit(check.leak ? 1 : 0); // exit 1 = attack succeeded (expected RED when defense is broken)
  }

  // ===========================================================================================
  // FAMILY: models.routes.ts — approve / reopen (NOT covered by any existing pg test file)
  // ===========================================================================================
  {
    // Get bmBvId into IN_REVIEW so approve is meaningful, then have org B attempt to approve it.
    const versionRow = await sqlOne<{ version: number }>(`SELECT version FROM finance_business_versions WHERE business_version_id=$1`, [bmBvId]);
    const submit = await request(appA)
      .post(`/api/v8/finance-v2/versions/${bmBvId}/transitions`)
      .send({ action: 'submit_for_review', expectedVersion: versionRow!.version });
    // models.routes.ts's approve precondition looks for status IN_REVIEW specifically —
    // submit_for_review only reaches READY_FOR_REVIEW; start_review is the second hop.
    const startReview =
      submit.status === 200
        ? await request(appA).post(`/api/v8/finance-v2/versions/${bmBvId}/transitions`).send({ action: 'start_review', expectedVersion: submit.body?.data?.version })
        : null;
    const okSubmit = submit.status === 200 && startReview?.status === 200;

    const before = await sqlOne<{ status: string; version: number; approved_by: string | null }>(
      `SELECT status, version, approved_by FROM finance_business_versions WHERE business_version_id=$1`,
      [bmBvId]
    );

    const crossApprove = await request(appB).post(`/api/v8/finance-v2/models/${bmArtifactId}/approve`).send({});
    const after = await sqlOne<{ status: string; version: number; approved_by: string | null }>(
      `SELECT status, version, approved_by FROM finance_business_versions WHERE business_version_id=$1`,
      [bmBvId]
    );
    const mutated = before!.status !== after!.status || before!.approved_by !== after!.approved_by;
    record({
      family: 'models',
      endpoint: 'POST /models/:modelId/approve',
      operation: 'approve',
      identifierType: 'source(artifactId)',
      httpMethod: 'POST',
      httpStatus: crossApprove.status,
      httpCode: crossApprove.body?.code,
      sqlIndependentCheck: `finance_business_versions.status/approved_by unchanged (before=${before?.status}, after=${after?.status})`,
      mutationDetected: mutated,
      verdict: crossApprove.status === 404 && !mutated ? 'BLOCKED' : 'LEAK',
      notes: okSubmit ? undefined : `same-org submit_for_review as precondition returned ${submit.status} (fixture setup, not the attack itself)`,
    });

    // legit approve still works afterward (proves cross-tenant attempt did not corrupt row).
    // Must be a DIFFERENT org-A user than the submitter — SoD forbids self-approval (SELF_APPROVAL_FORBIDDEN).
    const legit = await request(appA2).post(`/api/v8/finance-v2/models/${bmArtifactId}/approve`).send({});
    record({
      family: 'models',
      endpoint: 'POST /models/:modelId/approve',
      operation: 'approve (legit control, same org, different approver)',
      identifierType: 'source(artifactId)',
      httpMethod: 'POST',
      httpStatus: legit.status,
      httpCode: legit.body?.code,
      sqlIndependentCheck: 'n/a — control',
      mutationDetected: legit.status === 200,
      verdict: legit.status === 200 ? 'BLOCKED' : 'ERROR',
      notes: 'sanity control: same-org approve (by a 2nd user, SoD requires a different approver than submitter) must still succeed after the cross-tenant attempt above',
    });
  }

  {
    // reopen: needs an APPROVED version. Use the HA artifact instead (independent of bmBvId's state above).
    const submit1 = await request(appA)
      .post(`/api/v8/finance-v2/versions/${haBvId}/transitions`)
      .send({ action: 'submit_for_review', expectedVersion: 1 });
    let approvedOk = false;
    if (submit1.status === 200) {
      const approveOwn = await request(appA).post(`/api/v8/finance-v2/models/${haArtifactId}/approve`).send({});
      approvedOk = approveOwn.status === 200;
    }
    const before = await sqlOne<{ status: string }>(`SELECT status FROM finance_business_versions WHERE business_version_id=$1`, [haBvId]);
    const crossReopen = await request(appB)
      .post(`/api/v8/finance-v2/models/${haArtifactId}/reopen`)
      .set('Idempotency-Key', `j2-reopen-${randomUUID()}`)
      .send({ reason: 'hijack attempt' });
    const after = await sqlOne<{ status: string }>(`SELECT status FROM finance_business_versions WHERE business_version_id=$1`, [haBvId]);
    const orgBDraftRows = await sqlAll<{ business_version_id: string }>(
      `SELECT business_version_id FROM finance_business_versions WHERE artifact_id=$1 AND organization_id=$2`,
      [haArtifactId, orgB]
    );
    record({
      family: 'models',
      endpoint: 'POST /models/:modelId/reopen',
      operation: 'approve-adjacent(reopen)',
      identifierType: 'source(artifactId)',
      httpMethod: 'POST',
      httpStatus: crossReopen.status,
      httpCode: crossReopen.body?.code,
      sqlIndependentCheck: `status unchanged (before=${before?.status}, after=${after?.status}); zero org-B rows for this artifact (${orgBDraftRows.length})`,
      mutationDetected: before?.status !== after?.status || orgBDraftRows.length > 0,
      verdict: crossReopen.status === 404 && before?.status === after?.status && orgBDraftRows.length === 0 ? 'BLOCKED' : 'LEAK',
      notes: approvedOk ? undefined : `fixture precondition (own-org submit+approve) did not reach APPROVED (submit=${submit1.status})`,
    });
  }

  // ===========================================================================================
  // FAMILY: versions.routes.ts — GET /versions/:id direct read (not explicitly named in existing suite)
  // ===========================================================================================
  {
    const res = await request(appB).get(`/api/v8/finance-v2/versions/${haBvId}`);
    const bodyStr = JSON.stringify(res.body);
    record({
      family: 'versions',
      endpoint: 'GET /versions/:businessVersionId',
      operation: 'read',
      identifierType: 'version',
      httpMethod: 'GET',
      httpStatus: res.status,
      httpCode: res.body?.code,
      sqlIndependentCheck: 'n/a (pure read, no mutation possible)',
      mutationDetected: false,
      bodyLeakCheck: bodyStr.includes(haBvId) ? 'BODY CONTAINS ORG-A businessVersionId' : 'clean',
      verdict: res.status === 404 && !bodyStr.includes(haArtifactId) ? 'BLOCKED' : 'LEAK',
    });
  }

  // ===========================================================================================
  // FAMILY: crosscutting.routes.ts — lineage / freshness-events / exceptions (identifier: edge, exception)
  // ===========================================================================================
  {
    const lineageRes = await request(appB).get(`/api/v8/finance-v2/versions/${haBvId}/lineage`);
    const clean = lineageRes.status === 200 && Array.isArray(lineageRes.body?.data?.ancestors) && lineageRes.body.data.ancestors.length === 0 && lineageRes.body.data.descendants.length === 0;
    record({
      family: 'crosscutting',
      endpoint: 'GET /versions/:id/lineage',
      operation: 'read',
      identifierType: 'edge',
      httpMethod: 'GET',
      httpStatus: lineageRes.status,
      sqlIndependentCheck: 'response ancestors/descendants arrays must be empty for a foreign version id',
      mutationDetected: false,
      verdict: clean ? 'BLOCKED' : 'LEAK',
    });

    const freshRes = await request(appB).get(`/api/v8/finance-v2/versions/${haBvId}/freshness-events`);
    record({
      family: 'crosscutting',
      endpoint: 'GET /versions/:id/freshness-events',
      operation: 'read',
      identifierType: 'edge',
      httpMethod: 'GET',
      httpStatus: freshRes.status,
      sqlIndependentCheck: 'response data array must be empty',
      mutationDetected: false,
      verdict: freshRes.status === 200 && Array.isArray(freshRes.body?.data) && freshRes.body.data.length === 0 ? 'BLOCKED' : 'LEAK',
    });

    // Seed an exception row for org A via the real service (finance_exceptions is event-sourced,
    // append-only, DB-trigger-enforced — not something to hand-roll with a raw INSERT), then have
    // org B query the exceptions endpoints scoped by that artifactId.
    const exceptionLedgerService = await import('../../src/services/finance/canonical/exceptionLedgerService.js');
    const raised = await exceptionLedgerService.raise({
      organizationId: orgA,
      artifactId: haArtifactId,
      businessVersionId: haBvId,
      severity: 'MATERIAL',
      sourceRef: { probe: 'j2' },
      expected: 1,
      observed: 2,
      delta: 1,
      unit: 'UNITS',
      reasonCode: 'J2_PROBE',
      raisedBy: userA,
    });
    const excId = raised.ok ? raised.exception.id : (() => { throw new Error(`fixture: raise() failed: ${JSON.stringify(raised)}`); })();

    const excOpenRes = await request(appB).get(`/api/v8/finance-v2/exceptions/open?artifactId=${haArtifactId}`);
    const excOpenLeak = excOpenRes.status === 200 && Array.isArray(excOpenRes.body?.data) && excOpenRes.body.data.some((e: any) => e.exceptionGroupId === excId);
    record({
      family: 'crosscutting',
      endpoint: 'GET /exceptions/open',
      operation: 'read',
      identifierType: 'exception',
      httpMethod: 'GET',
      httpStatus: excOpenRes.status,
      sqlIndependentCheck: `org-A exception row (id=${excId}) present in DB; response for org B must not include it`,
      mutationDetected: false,
      bodyLeakCheck: excOpenLeak ? 'LEAKED org-A exception into org-B response' : 'clean',
      verdict: !excOpenLeak ? 'BLOCKED' : 'LEAK',
    });

    const excInboxRes = await request(appB).get(`/api/v8/finance-v2/exceptions/inbox?artifactId=${haArtifactId}`);
    const excInboxBody = JSON.stringify(excInboxRes.body);
    record({
      family: 'crosscutting',
      endpoint: 'GET /exceptions/inbox',
      operation: 'read',
      identifierType: 'exception',
      httpMethod: 'GET',
      httpStatus: excInboxRes.status,
      sqlIndependentCheck: 'response body must not reference org-A exception id',
      mutationDetected: false,
      bodyLeakCheck: excInboxBody.includes(excId) ? 'LEAK' : 'clean',
      verdict: !excInboxBody.includes(excId) ? 'BLOCKED' : 'LEAK',
    });
  }

  // ===========================================================================================
  // FAMILY: compare.routes.ts — all 6 axes, direct HTTP hit with genuine independent pg.Client verification
  // (already has its own pg test file; this re-verifies with a RAW client + adds the forged
  // artifactRef.organizationId attack explicitly).
  // ===========================================================================================
  {
    // (a) forged artifactRef.organizationId = orgA (attacker's own, real org) while authenticated as
    // org B, businessVersionId pointing at org A's real data -> must be blocked by the SECOND,
    // trusted-context-scoped lookup even though the body-supplied org matches the JWT-less body itself.
    const forged = await request(appB)
      .post('/api/v8/finance-v2/compare/periods')
      .send({ artifactRef: { organizationId: orgB, artifactId: haArtifactId, businessVersionId: haBvId, artifactType: 'HISTORICAL_ANALYSIS', naturalKey: null }, periodIdA: 'p1', periodIdB: 'p2' });
    record({
      family: 'compare',
      endpoint: 'POST /compare/periods',
      operation: 'read/compute',
      identifierType: 'source+target(businessVersionId via artifactRef)',
      httpMethod: 'POST',
      httpStatus: forged.status,
      httpCode: forged.body?.code,
      sqlIndependentCheck: 'no SQL side effect possible (read-only compare); checked HTTP+body only',
      mutationDetected: false,
      bodyLeakCheck: JSON.stringify(forged.body).includes(haArtifactId) ? 'body echoes org-A artifactId (expected in error message only, not data)' : 'clean',
      verdict: forged.status === 403 || forged.status === 404 ? 'BLOCKED' : 'LEAK',
      notes: `org B supplies artifactRef.organizationId=own(orgB) but businessVersionId=org-A's real id -> code=${forged.body?.code}`,
    });

    const versionsCompare = await request(appB)
      .post('/api/v8/finance-v2/compare/versions')
      .send({ artifactType: 'HISTORICAL_ANALYSIS', artifactId: haArtifactId, businessVersionIdA: haBvId, businessVersionIdB: haBvId });
    record({
      family: 'compare',
      endpoint: 'POST /compare/versions',
      operation: 'read/compute',
      identifierType: 'source+target(businessVersionId)',
      httpMethod: 'POST',
      httpStatus: versionsCompare.status,
      httpCode: versionsCompare.body?.code,
      sqlIndependentCheck: 'read-only; body must not contain org-A cell values',
      mutationDetected: false,
      verdict: versionsCompare.status === 404 || versionsCompare.status === 403 ? 'BLOCKED' : 'LEAK',
    });

    const entitiesCompare = await request(appB)
      .post('/api/v8/finance-v2/compare/entities')
      .send({ artifactRef: { organizationId: orgB, artifactId: spArtifactId, businessVersionId: spBvId, artifactType: 'STATEMENT_PACK', naturalKey: null }, periodId: 'p1', entityIdA: 'eA', entityIdB: 'eB' });
    record({
      family: 'compare',
      endpoint: 'POST /compare/entities',
      operation: 'read/compute',
      identifierType: 'source(businessVersionId via artifactRef)',
      httpMethod: 'POST',
      httpStatus: entitiesCompare.status,
      httpCode: entitiesCompare.body?.code,
      sqlIndependentCheck: 'read-only',
      mutationDetected: false,
      verdict: entitiesCompare.status === 404 || entitiesCompare.status === 403 ? 'BLOCKED' : 'LEAK',
    });

    const scenariosCompare = await request(appB)
      .post('/api/v8/finance-v2/compare/scenarios')
      .send({ businessVersionIdBase: haBvId, businessVersionIdOther: haBvId });
    record({
      family: 'compare',
      endpoint: 'POST /compare/scenarios',
      operation: 'read/compute',
      identifierType: 'source+target(businessVersionId)',
      httpMethod: 'POST',
      httpStatus: scenariosCompare.status,
      httpCode: scenariosCompare.body?.code,
      sqlIndependentCheck: 'read-only',
      mutationDetected: false,
      verdict: scenariosCompare.status === 404 || scenariosCompare.status === 403 ? 'BLOCKED' : 'LEAK',
    });

    const methodsCompare = await request(appB)
      .post('/api/v8/finance-v2/compare/valuation-methods')
      .send({ businessVersionId: haBvId, methodTypeA: 'DCF_FCFF', methodTypeB: 'DCF_FCFF' });
    record({
      family: 'compare',
      endpoint: 'POST /compare/valuation-methods',
      operation: 'read/compute',
      identifierType: 'source(businessVersionId)',
      httpMethod: 'POST',
      httpStatus: methodsCompare.status,
      httpCode: methodsCompare.body?.code,
      sqlIndependentCheck: 'read-only',
      mutationDetected: false,
      verdict: methodsCompare.status === 404 || methodsCompare.status === 403 ? 'BLOCKED' : 'LEAK',
    });

    const avfCompare = await request(appB)
      .post('/api/v8/finance-v2/compare/actual-vs-forecast')
      .send({
        actualArtifactRef: { organizationId: orgB, artifactId: spArtifactId, businessVersionId: spBvId, artifactType: 'STATEMENT_PACK', naturalKey: null },
        forecastArtifactRef: { organizationId: orgB, artifactId: bmArtifactId, businessVersionId: bmBvId, artifactType: 'BASELINE_MODEL', naturalKey: null },
        entityCode: 'E1',
        periodIds: ['p1'],
        accumulationBasis: 'PERIODIC',
      });
    record({
      family: 'compare',
      endpoint: 'POST /compare/actual-vs-forecast',
      operation: 'read/compute',
      identifierType: 'source+target(businessVersionId via artifactRef)',
      httpMethod: 'POST',
      httpStatus: avfCompare.status,
      httpCode: avfCompare.body?.code,
      sqlIndependentCheck: 'read-only',
      mutationDetected: false,
      verdict: avfCompare.status === 404 || avfCompare.status === 403 ? 'BLOCKED' : 'LEAK',
    });
  }

  // ===========================================================================================
  // FAMILY: comments.routes.ts — spot check with genuine pg.Client (indirect path: comment
  // anchored on a cell of org A's artifact)
  // ===========================================================================================
  {
    const createCross = await request(appB).post('/api/v8/finance-v2/comments').send({
      artifactId: haArtifactId,
      businessVersionId: haBvId,
      anchor: { table: 'finance_stmt_lines', businessVersionId: haBvId, rowKey: 'CASH', colKey: 'p1' },
      body: 'cross-tenant hijack comment',
    });
    const orgBComments = await sqlAll<{ id: string }>(`SELECT id FROM finance_comments WHERE organization_id=$1`, [orgB]);
    record({
      family: 'comments',
      endpoint: 'POST /comments',
      operation: 'create',
      identifierType: 'comment (indirect: anchored on org-A cell)',
      httpMethod: 'POST',
      httpStatus: createCross.status,
      httpCode: createCross.body?.code,
      sqlIndependentCheck: `zero finance_comments rows for org B (found ${orgBComments.length})`,
      mutationDetected: orgBComments.length > 0,
      verdict: createCross.status === 404 && orgBComments.length === 0 ? 'BLOCKED' : 'LEAK',
    });

    // create a legit comment as org A, then have org B try resolve/reopen/read it (approve-adjacent op)
    const legitComment = await request(appA).post('/api/v8/finance-v2/comments').send({
      artifactId: haArtifactId,
      businessVersionId: haBvId,
      body: 'legit org-A comment',
    });
    const commentId = legitComment.body?.data?.id;
    if (commentId) {
      const before = await sqlOne<{ resolved_by: string | null }>(`SELECT resolved_by FROM finance_comments WHERE id=$1`, [commentId]);
      const crossResolve = await request(appB).post(`/api/v8/finance-v2/comments/${commentId}/resolve`).send({});
      const after = await sqlOne<{ resolved_by: string | null }>(`SELECT resolved_by FROM finance_comments WHERE id=$1`, [commentId]);
      record({
        family: 'comments',
        endpoint: 'POST /comments/:commentId/resolve',
        operation: 'approve-adjacent(resolve)',
        identifierType: 'comment',
        httpMethod: 'POST',
        httpStatus: crossResolve.status,
        httpCode: crossResolve.body?.code,
        sqlIndependentCheck: `resolved_by unchanged (before=${before?.resolved_by}, after=${after?.resolved_by})`,
        mutationDetected: before?.resolved_by !== after?.resolved_by,
        verdict: crossResolve.status === 404 && before?.resolved_by === after?.resolved_by ? 'BLOCKED' : 'LEAK',
      });

      const crossRead = await request(appB).get(`/api/v8/finance-v2/comments/${commentId}`);
      record({
        family: 'comments',
        endpoint: 'GET /comments/:commentId',
        operation: 'read',
        identifierType: 'comment',
        httpMethod: 'GET',
        httpStatus: crossRead.status,
        sqlIndependentCheck: 'n/a (read)',
        mutationDetected: false,
        bodyLeakCheck: JSON.stringify(crossRead.body).includes('legit org-A comment') ? 'LEAK: body content' : 'clean',
        verdict: crossRead.status === 404 ? 'BLOCKED' : 'LEAK',
      });
    }
  }

  // ===========================================================================================
  // FAMILY: saved-views.routes.ts — indirect path: saved view referencing org-A artifact
  // ===========================================================================================
  {
    const validGridViewState = { schemaVersion: 1, freezeRowsCount: 0, freezeColumnsCount: 0, columns: [], rows: [], groups: [] };
    const crossCreate = await request(appB).post('/api/v8/finance-v2/saved-views').send({
      artifactId: haArtifactId,
      scope: 'PERSONAL',
      name: 'hijack view',
      gridViewState: validGridViewState,
    });
    const orgBViews = await sqlAll<{ id: string }>(`SELECT id FROM finance_saved_views WHERE organization_id=$1`, [orgB]);
    record({
      family: 'saved-views',
      endpoint: 'POST /saved-views',
      operation: 'create',
      identifierType: 'target (indirect: view referencing org-A artifact)',
      httpMethod: 'POST',
      httpStatus: crossCreate.status,
      httpCode: crossCreate.body?.code,
      sqlIndependentCheck: `zero finance_saved_views rows for org B (found ${orgBViews.length})`,
      mutationDetected: orgBViews.length > 0,
      verdict: crossCreate.status === 404 && orgBViews.length === 0 ? 'BLOCKED' : 'LEAK',
    });

    const legitView = await request(appA).post('/api/v8/finance-v2/saved-views').send({
      artifactId: haArtifactId,
      scope: 'TEAM',
      name: 'org-A team view',
      gridViewState: validGridViewState,
    });
    const viewId = legitView.body?.data?.id;
    if (viewId) {
      const crossDelete = await request(appB).delete(`/api/v8/finance-v2/saved-views/${viewId}`);
      const stillThere = await sqlOne<{ id: string }>(`SELECT id FROM finance_saved_views WHERE id=$1`, [viewId]);
      record({
        family: 'saved-views',
        endpoint: 'DELETE /saved-views/:viewId',
        operation: 'delete',
        identifierType: 'target',
        httpMethod: 'DELETE',
        httpStatus: crossDelete.status,
        sqlIndependentCheck: `row still exists after cross-tenant delete attempt: ${!!stillThere}`,
        mutationDetected: !stillThere,
        verdict: crossDelete.status === 404 && !!stillThere ? 'BLOCKED' : 'LEAK',
      });
    }
  }

  // ===========================================================================================
  // FAMILY: lineage-navigator.routes.ts — indirect path: edge pointing at org-A artifact
  // ===========================================================================================
  {
    // org B tries to create its own artifact but link it to org A's baseline as source (cross-tenant edge)
    const ownArtifactForB = await request(appB).post('/api/v8/finance-v2/artifacts').send({ artifactType: 'PREDICTION_SCENARIO' });
    const bBvId = ownArtifactForB.body?.data?.currentBusinessVersion?.businessVersionId;
    const beforeEdges = await sqlAll<{ id: string }>(`SELECT id FROM finance_lineage_edges WHERE organization_id=$1`, [orgB]);
    const crossEdge = await request(appB).post('/api/v8/finance-v2/versions/lineage-edges').send({
      sourceVersionId: bmBvId, // org A's baseline
      sourceArtifactType: 'BASELINE_MODEL',
      targetVersionId: bBvId, // org B's own scenario
      targetArtifactType: 'PREDICTION_SCENARIO',
      edgeType: 'MODEL_TO_SCENARIO',
      transformationKind: 'MANUAL_LINK',
      assumptionSnapshotHash: `j2-hijack-${randomUUID()}`,
    });
    const afterEdges = await sqlAll<{ id: string }>(`SELECT id FROM finance_lineage_edges WHERE organization_id=$1`, [orgB]);
    record({
      family: 'lineage-navigator',
      endpoint: 'POST /versions/lineage-edges',
      operation: 'create',
      identifierType: 'edge (indirect: source=org-A artifact)',
      httpMethod: 'POST',
      httpStatus: crossEdge.status,
      httpCode: crossEdge.body?.code,
      sqlIndependentCheck: `org-B edge count before=${beforeEdges.length} after=${afterEdges.length}`,
      mutationDetected: afterEdges.length > beforeEdges.length,
      verdict: crossEdge.status === 404 && afterEdges.length === beforeEdges.length ? 'BLOCKED' : 'LEAK',
    });

    const navRead = await request(appB).get(`/api/v8/finance-v2/versions/${bmBvId}/lineage-navigator`);
    record({
      family: 'lineage-navigator',
      endpoint: 'GET /versions/:id/lineage-navigator',
      operation: 'read',
      identifierType: 'version',
      httpMethod: 'GET',
      httpStatus: navRead.status,
      sqlIndependentCheck: 'n/a (read)',
      mutationDetected: false,
      verdict: navRead.status === 404 ? 'BLOCKED' : 'LEAK',
    });
  }

  // ===========================================================================================
  // FAMILY: export-import.routes.ts — export identifier, indirect path (export of org-A artifact)
  // ===========================================================================================
  {
    const exportCross = await request(appB).get(`/api/v8/finance-v2/export/statement-pack/${spArtifactId}/${spBvId}`);
    record({
      family: 'export-import',
      endpoint: 'GET /export/statement-pack/:artifactId/:businessVersionId',
      operation: 'export',
      identifierType: 'export (indirect: exporting org-A artifact)',
      httpMethod: 'GET',
      httpStatus: exportCross.status,
      httpCode: exportCross.body?.code,
      sqlIndependentCheck: 'n/a (file stream read; verified via response status/body only)',
      mutationDetected: false,
      bodyLeakCheck: exportCross.headers?.['content-type']?.includes('spreadsheetml') ? 'LEAK: xlsx bytes returned' : 'clean',
      verdict: exportCross.status === 404 ? 'BLOCKED' : 'LEAK',
    });

    const previewCross = await request(appB)
      .post('/api/v8/finance-v2/import/preview')
      .send({ artifactId: spArtifactId, businessVersionId: spBvId, manifest: { organizationId: orgA, artifactId: spArtifactId, businessVersionId: spBvId, businessVersionNo: 1, artifactType: 'STATEMENT_PACK', unit: 'UNITS', presentationCurrency: 'PLN', exportedAt: new Date().toISOString() }, rows: [] });
    const previewLeak = previewCross.status === 200 && previewCross.body?.data?.ok === true;
    record({
      family: 'export-import',
      endpoint: 'POST /import/preview',
      operation: 'preview (indirect: manifest targets org-A version)',
      identifierType: 'export',
      httpMethod: 'POST',
      httpStatus: previewCross.status,
      httpCode: previewCross.body?.code,
      sqlIndependentCheck: 'n/a (read-only diff)',
      mutationDetected: false,
      bodyLeakCheck: previewLeak ? 'LEAK: preview returned ok:true for cross-tenant manifest' : 'clean/blocked',
      verdict: !previewLeak && (previewCross.status === 404 || (previewCross.status === 200 && previewCross.body?.data?.ok === false)) ? 'BLOCKED' : previewLeak ? 'LEAK' : 'BLOCKED',
    });
  }

  // ===========================================================================================
  // FAMILY: baseline.routes.ts — spot check with genuine pg.Client (identifier: revision-ish/version)
  // ===========================================================================================
  {
    const before = await sqlAll<{ id: string }>(`SELECT id FROM finance_baseline_assumptions WHERE business_version_id=$1`, [bmBvId]);
    const crossWrite = await request(appB)
      .post(`/api/v8/finance-v2/baseline/${bmBvId}/assumptions`)
      .send({ assumptions: [{ scheduleType: 'revenue_pvm', driverCode: 'HIJACK', entityId: randomUUID(), periodId: randomUUID(), rule: 'FIXED_VALUE', valueStatus: 'MISSING', unit: 'PCT' }] });
    const after = await sqlAll<{ id: string }>(`SELECT id FROM finance_baseline_assumptions WHERE business_version_id=$1`, [bmBvId]);
    record({
      family: 'baseline',
      endpoint: 'POST /baseline/:businessVersionId/assumptions',
      operation: 'create',
      identifierType: 'version',
      httpMethod: 'POST',
      httpStatus: crossWrite.status,
      httpCode: crossWrite.body?.code,
      sqlIndependentCheck: `assumption row count before=${before.length} after=${after.length}`,
      mutationDetected: after.length !== before.length,
      verdict: crossWrite.status === 404 && after.length === before.length ? 'BLOCKED' : 'LEAK',
    });
  }

  // ===========================================================================================
  // FAMILY: compute.routes.ts — job / output identifiers, genuine pg.Client re-verification
  // ===========================================================================================
  {
    const enqueue = await request(appA)
      .post('/api/v8/finance-v2/compute/jobs')
      .set('Idempotency-Key', `j2-enqueue-${randomUUID()}`)
      .send({ jobType: 'BASELINE_COMPUTE', inputArtifactId: bmArtifactId, inputRevisionHash: 'j2-hash', engineManifestId });
    const jobId = enqueue.body?.data?.jobId;
    if (jobId) {
      const before = await sqlOne<{ status: string }>(`SELECT status FROM compute_jobs WHERE id=$1`, [jobId]);
      const crossCancel = await request(appB).post(`/api/v8/finance-v2/compute/jobs/${jobId}/cancel`).send({ reason: 'hijack cancel' });
      const after = await sqlOne<{ status: string }>(`SELECT status FROM compute_jobs WHERE id=$1`, [jobId]);
      record({
        family: 'compute',
        endpoint: 'POST /compute/jobs/:jobId/cancel',
        operation: 'delete-adjacent(cancel)',
        identifierType: 'job',
        httpMethod: 'POST',
        httpStatus: crossCancel.status,
        httpCode: crossCancel.body?.code,
        sqlIndependentCheck: `status unchanged (before=${before?.status}, after=${after?.status})`,
        mutationDetected: before?.status !== after?.status,
        verdict: crossCancel.status === 404 && before?.status === after?.status ? 'BLOCKED' : 'LEAK',
      });

      const crossOutput = await request(appB).get(`/api/v8/finance-v2/compute/jobs/${jobId}/output`);
      record({
        family: 'compute',
        endpoint: 'GET /compute/jobs/:jobId/output',
        operation: 'read',
        identifierType: 'output',
        httpMethod: 'GET',
        httpStatus: crossOutput.status,
        sqlIndependentCheck: 'n/a (read)',
        mutationDetected: false,
        verdict: crossOutput.status === 404 ? 'BLOCKED' : 'LEAK',
      });
    }
  }

  // ===========================================================================================
  // FAMILY: statements.routes.ts — reconciliationRunId as a standalone identifier
  // (GET /statements/reconciliation-runs/:reconciliationRunId is NOT scoped by businessVersionId
  // in the URL — the org check has to happen purely from the id itself)
  // ===========================================================================================
  {
    const runId = randomUUID();
    await sql.query(
      `INSERT INTO finance_reconciliation_runs
         (id, organization_id, artifact_id, business_version_id, source_system, source_total, mapped_total, canonical_total, materiality_threshold_applied, status, created_by)
       VALUES ($1,$2,$3,$4,'J2_PROBE',100,100,100,0.01,'CLEAN',$5)`,
      [runId, orgA, spArtifactId, spBvId, userA]
    ).catch((e) => console.log(`  (seed reconciliation run skipped: ${e.message})`));

    const crossRead = await request(appB).get(`/api/v8/finance-v2/statements/reconciliation-runs/${runId}`);
    const bodyStr = JSON.stringify(crossRead.body);
    record({
      family: 'statements',
      endpoint: 'GET /statements/reconciliation-runs/:reconciliationRunId',
      operation: 'read',
      identifierType: 'revision (reconciliationRunId, not URL-scoped by businessVersionId)',
      httpMethod: 'GET',
      httpStatus: crossRead.status,
      httpCode: crossRead.body?.code,
      sqlIndependentCheck: 'org-A reconciliation run row exists in DB; response for org B must be 404, not the row',
      mutationDetected: false,
      bodyLeakCheck: bodyStr.includes('J2_PROBE') ? 'LEAK: reconciliation run data present' : 'clean',
      verdict: crossRead.status === 404 ? 'BLOCKED' : 'LEAK',
    });
  }

  // ===========================================================================================
  // FAMILY: valuation.routes.ts — sensitivity/:gridLabel standalone lookup
  // ===========================================================================================
  {
    const caseRes = await request(appA).post('/api/v8/finance-v2/valuation/cases').send({ name: `J2 case ${randomUUID().slice(0, 8)}` });
    const caseId = caseRes.body?.data?.caseId;
    const artifactVC = await request(appA).post('/api/v8/finance-v2/artifacts').send({ artifactType: 'VALUATION_CASE' });
    const vcBvId = artifactVC.body?.data?.currentBusinessVersion?.businessVersionId;
    await request(appA).post(`/api/v8/finance-v2/valuation/cases/${caseId}/variants`).send({ businessVersionId: vcBvId, name: 'J2 variant' });
    const methodRes = await request(appA).post(`/api/v8/finance-v2/valuation/variants/${vcBvId}/methods`).send({ methodType: 'DCF_FCFF' });
    const methodId = methodRes.body?.data?.methodId;

    if (methodId) {
      const crossGrid = await request(appB).get(`/api/v8/finance-v2/valuation/methods/${methodId}/sensitivity/whatever-label`);
      record({
        family: 'valuation',
        endpoint: 'GET /valuation/methods/:methodId/sensitivity/:gridLabel',
        operation: 'read',
        identifierType: 'source(methodId)',
        httpMethod: 'GET',
        httpStatus: crossGrid.status,
        httpCode: crossGrid.body?.code,
        sqlIndependentCheck: 'n/a (read)',
        mutationDetected: false,
        verdict: crossGrid.status === 404 ? 'BLOCKED' : 'LEAK',
      });
    }
  }

  // ===========================================================================================
  // FAMILY: analysis.routes.ts, prediction.routes.ts, artifacts.routes.ts — spot re-verification
  // ===========================================================================================
  {
    const rename = await request(appB).post(`/api/v8/finance-v2/artifacts/${haArtifactId}/rename`).send({ naturalKey: 'j2 hijacked name' });
    const row = await sqlOne<{ natural_key: string | null }>(`SELECT natural_key FROM finance_artifacts WHERE artifact_id=$1`, [haArtifactId]);
    record({
      family: 'artifacts',
      endpoint: 'POST /artifacts/:artifactId/rename',
      operation: 'update',
      identifierType: 'source(artifactId)',
      httpMethod: 'POST',
      httpStatus: rename.status,
      httpCode: rename.body?.code,
      sqlIndependentCheck: `natural_key='${row?.natural_key}' (must not be 'j2 hijacked name')`,
      mutationDetected: row?.natural_key === 'j2 hijacked name',
      verdict: rename.status === 404 && row?.natural_key !== 'j2 hijacked name' ? 'BLOCKED' : 'LEAK',
    });

    const analysisCompute = await request(appB).post(`/api/v8/finance-v2/analysis/${haBvId}/compute`).send({});
    const orgBJobs = await sqlAll<{ id: string }>(`SELECT id FROM compute_jobs WHERE organization_id=$1`, [orgB]);
    record({
      family: 'analysis',
      endpoint: 'POST /analysis/:businessVersionId/compute',
      operation: 'compute',
      identifierType: 'version',
      httpMethod: 'POST',
      httpStatus: analysisCompute.status,
      httpCode: analysisCompute.body?.code,
      sqlIndependentCheck: `org-B compute_jobs count=${orgBJobs.length} (must be 0)`,
      mutationDetected: orgBJobs.length > 0,
      verdict: analysisCompute.status === 404 && orgBJobs.length === 0 ? 'BLOCKED' : 'LEAK',
    });

    const predictionPreflight = await request(appB).post(`/api/v8/finance-v2/prediction/${haBvId}/preflight`).send({});
    record({
      family: 'prediction',
      endpoint: 'POST /prediction/:businessVersionId/preflight',
      operation: 'compute',
      identifierType: 'version',
      httpMethod: 'POST',
      httpStatus: predictionPreflight.status,
      httpCode: predictionPreflight.body?.code,
      sqlIndependentCheck: 'n/a (spot check, full coverage in pkg-b2-cross-tenant.routes.pg.test.ts)',
      mutationDetected: false,
      verdict: predictionPreflight.status === 404 ? 'BLOCKED' : 'LEAK',
    });
  }

  // ===========================================================================================
  // Write results
  // ===========================================================================================
  const leaks = results.filter((r) => r.verdict === 'LEAK');
  const errors = results.filter((r) => r.verdict === 'ERROR');
  console.log(`\n=== SUMMARY: ${results.length} probes, ${leaks.length} LEAKS, ${errors.length} ERRORS ===`);
  if (leaks.length > 0) {
    console.log('*** P0 CANDIDATES ***');
    for (const l of leaks) console.log(JSON.stringify(l, null, 2));
  }

  fs.writeFileSync('/tmp/j2-crosstenant-results.json', JSON.stringify({ orgA, orgB, haArtifactId, haBvId, bmArtifactId, bmBvId, spArtifactId, spBvId, results }, null, 2));
  console.log('\nResults written to /tmp/j2-crosstenant-results.json');

  // cleanup fixtures this script created (best-effort; the whole DB gets dropped anyway)
  await withPinnedPostgresTransaction((tx) => tx.queryRun(`DELETE FROM compute_jobs WHERE organization_id IN (?, ?)`, [orgA, orgB])).catch(() => {});

  await sql.end();
  process.exit(leaks.length > 0 ? 1 : 0);
}

main().catch(async (e) => {
  console.error('FATAL:', e);
  try {
    await sql.end();
  } catch {}
  process.exit(2);
});
