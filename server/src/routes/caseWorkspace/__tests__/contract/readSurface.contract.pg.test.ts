/**
 * CONTRACT (real PostgreSQL) — the READ surface of the case-workspace API
 * executes its SQL and answers the statuses openapi.yaml declares.
 *
 * ===========================================================================
 * WHY THIS SUITE EXISTS
 * ===========================================================================
 * The three sibling contract suites drive the *write* paths (create a Case,
 * publish a plan, bind a run, decide a proposal). Between them and the golden
 * cases they touch 40 of the 92 documented paths. The remaining 52 are almost
 * all GETs — list projections and by-id lookups.
 *
 * A GET endpoint is exactly where a mocked-service route test is blindest: the
 * 11 suites in the parent directory stub the service out, so a list handler
 * whose SQL references a dropped column, a renamed table, or a parameter it
 * never binds still returns the stub's array and goes green. The failure only
 * appears when real SQL meets a real schema — which is what this file does.
 *
 * The assertion that carries the weight here is therefore deliberately blunt:
 *
 *     NO endpoint on this surface may answer 500.
 *
 * A 200 with an empty array and a documented 404 are both fine. A 500 means
 * the query did not survive contact with Postgres. Every case in this file
 * records the observed status into `observed` so the final test can assert
 * that property across the whole surface at once, rather than leaving it
 * implicit in a hundred individual `expect(res.status)` calls.
 *
 * ---------------------------------------------------------------------------
 * Fresh-org semantics
 * ---------------------------------------------------------------------------
 * Each fixture org is brand new, so every list read legitimately returns `[]`.
 * That is not a weak assertion: reaching `{ data: [] }` proves the handler
 * parsed its params, passed authorization, built the statement, and that
 * Postgres accepted and executed it. The write suites already prove non-empty
 * projections for the paths they cover.
 *
 * See ./contractHarness.ts's header for what is and is not substituted, and
 * for the RUN_DB_TESTS gate that makes this suite skip loudly rather than pass
 * silently on a mock database.
 */

import { randomUUID } from 'node:crypto';

import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  CONNECTION_STRING,
  ContractFixtures,
  createContractApp,
  isContractDbReachable,
  minimalGraph,
  warnSkipped,
} from './contractHarness.js';

const REACHABLE = await isContractDbReachable();
warnSkipped('caseWorkspace read-surface contract', REACHABLE);

const suite = REACHABLE ? describe.sequential : describe.skip;
const BASE = '/api/v8/case-workspace';

/** Every (method, path, status) this suite observed, for the final sweep. */
const observed: Array<{ endpoint: string; status: number }> = [];

function record(endpoint: string, status: number): number {
  observed.push({ endpoint, status });
  return status;
}

suite('CONTRACT — read surface over the real router and real Postgres', () => {
  let control: Pool;
  let fx: ContractFixtures;

  // Seeded once: a real org with a real Case, plan version and run binding, so
  // the case-scoped and run-scoped reads below address rows that genuinely
  // exist and that the actor genuinely has access to.
  let orgId: string;
  let projectId: string;
  let memberUserId: string;
  let adminUserId: string;
  let caseId: string;
  let planVersionId: string;
  let runId: string;
  let memberApp: ReturnType<typeof createContractApp>;
  let adminApp: ReturnType<typeof createContractApp>;

  beforeAll(async () => {
    control = new Pool({ connectionString: CONNECTION_STRING, max: 8 });
    fx = new ContractFixtures(control);

    const f = await fx.seedFixture('readsurface');
    orgId = f.orgId;
    projectId = f.projectId;
    memberUserId = f.memberUserId;
    adminUserId = f.adminUserId;

    memberApp = createContractApp({
      organizationId: orgId,
      userId: memberUserId,
      userRole: 'MEMBER',
      isSuperAdmin: false,
    });
    adminApp = createContractApp({
      organizationId: orgId,
      userId: adminUserId,
      userRole: 'ADMIN',
      isSuperAdmin: false,
    });

    // Real Case, through the real API.
    const created = await request(memberApp)
      .post(`${BASE}/cases`)
      .send({ projectId, caseProfile: 'LIGHT', contractedClosureType: 'DECISION_COMPLETED' });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    caseId = created.body.data.caseId;

    const draft = await request(memberApp)
      .post(`${BASE}/cases/${caseId}/plan-versions`)
      .send({ semanticGraph: minimalGraph(), changeReason: 'read surface fixture' });
    expect(draft.status, JSON.stringify(draft.body)).toBe(201);
    planVersionId = draft.body.data.casePlanVersionId;

    // A run binding needs a published plan version and a real execution run.
    await request(memberApp).post(`${BASE}/plan-versions/${planVersionId}/propose`).send({ expectedVersion: 1 });
    await request(adminApp).post(`${BASE}/plan-versions/${planVersionId}/publish`).send({ expectedVersion: 2 });
    runId = await fx.seedExecutionRun(orgId, memberUserId, 'readsurface');
    const bound = await request(memberApp)
      .post(`${BASE}/run-bindings`)
      .send({ runId, casePlanVersionId: planVersionId });
    expect(bound.status, JSON.stringify(bound.body)).toBe(201);
  }, 120_000);

  afterAll(async () => {
    await fx?.teardown().catch(() => undefined);
    await control?.end().catch(() => undefined);
  }, 60_000);

  // =========================================================================
  // A. Org-scoped list reads — the registry / flag projections
  // =========================================================================
  it('org-scoped list reads execute their SQL and return the documented { data: [] } envelope', async () => {
    const endpoints = [
      '/capabilities/active',
      '/capabilities?lifecycle=ACTIVE',
      '/flags/org-state',
      // NOTE (real, observed behaviour — not a wish): for a flag key that has
      // no definition, `children` and `descendants` answer 200 with `[]`,
      // whereas `smallest-enabled-descendant` answers 404
      // `FLAG_DEFINITION_NOT_FOUND` (asserted in the 404 sweep below). The
      // three sit on the same flag tree, so that is an inconsistency in the
      // read surface; it is recorded here and in
      // API_EVENT_SCHEMA_COVERAGE.csv rather than silently normalised, since
      // migrationReadiness.routes.ts is outside this stream's allowlist.
      '/flags/definitions/cw.unknown.flag/children',
      '/flags/definitions/cw.unknown.flag/descendants',
    ];

    for (const endpoint of endpoints) {
      const res = await request(memberApp).get(`${BASE}${endpoint}`);
      record(`GET ${endpoint}`, res.status);
      expect(res.status, `GET ${endpoint} -> ${res.status} ${JSON.stringify(res.body)}`).toBe(200);
      expect(Array.isArray(res.body.data), `GET ${endpoint} data is not an array`).toBe(true);
    }
  }, 60_000);

  // =========================================================================
  // B. Case-scoped reads against a REAL case the actor can access
  // =========================================================================
  it('case-scoped list reads execute against a real accessible case', async () => {
    const endpoints = [
      `/cases/${caseId}/gateway-evaluations`,
      `/cases/${caseId}/node-result-acceptances`,
      `/cases/${caseId}/artifact-links`,
      `/cases/${caseId}/value-measurements`,
      `/cases/${caseId}/value-measurements/metric/time_to_decision`,
      `/cases/${caseId}/history-events`,
      `/cases/${caseId}/waits`,
      `/cases/${caseId}/proposals`,
      `/cases/${caseId}/plan-versions`,
      `/run-bindings/by-case/${caseId}`,
      `/run-bindings/by-plan-version/${planVersionId}`,
      `/case-intake/cases/${caseId}/work-orders`,
    ];

    for (const endpoint of endpoints) {
      const res = await request(memberApp).get(`${BASE}${endpoint}`);
      record(`GET ${endpoint}`, res.status);
      expect(res.status, `GET ${endpoint} -> ${res.status} ${JSON.stringify(res.body)}`).toBe(200);
      expect(Array.isArray(res.body.data), `GET ${endpoint} data is not an array`).toBe(true);
    }
  }, 60_000);

  it('case-scoped scalar reads (digest, graph, by-project) execute and return objects', async () => {
    const digest = await request(memberApp).get(`${BASE}/cases/${caseId}/artifact-links/digest`);
    record('GET /cases/{caseId}/artifact-links/digest', digest.status);
    expect(digest.status).toBe(200);
    expect(digest.body.data).toBeTruthy();

    const graph = await request(memberApp).get(`${BASE}/plan-versions/${planVersionId}/graph`);
    record('GET /plan-versions/{planVersionId}/graph', graph.status);
    expect(graph.status).toBe(200);
    expect(graph.body.data).toBeTruthy();

    const byProject = await request(memberApp).get(`${BASE}/cases/by-project/${projectId}`);
    record('GET /cases/by-project/{projectId}', byProject.status);
    expect(byProject.status).toBe(200);
    expect(byProject.body.data.caseId).toBe(caseId);

    // A plan diffed against itself is the degenerate-but-legal case; it proves
    // the diff query runs, which is all this suite claims.
    const diff = await request(memberApp).get(
      `${BASE}/cases/${caseId}/plan-versions/${planVersionId}/diff?against=${planVersionId}`
    );
    record('GET /cases/{caseId}/plan-versions/{planVersionId}/diff', diff.status);
    expect(diff.status, `diff -> ${diff.status} ${JSON.stringify(diff.body)}`).toBe(200);
  }, 60_000);

  // =========================================================================
  // C. Run-scoped reads against a REAL bound run
  // =========================================================================
  it('run-scoped list reads execute against a real bound run', async () => {
    const endpoints = [
      `/runs/${runId}/gateway-evaluations`,
      `/runs/${runId}/node-result-acceptances`,
      `/runs/${runId}/waits`,
      `/runs/${runId}/proposals`,
    ];

    for (const endpoint of endpoints) {
      const res = await request(memberApp).get(`${BASE}${endpoint}`);
      record(`GET ${endpoint}`, res.status);
      expect(res.status, `GET ${endpoint} -> ${res.status} ${JSON.stringify(res.body)}`).toBe(200);
      expect(Array.isArray(res.body.data), `GET ${endpoint} data is not an array`).toBe(true);
    }

    const binding = await request(memberApp).get(`${BASE}/run-bindings/${runId}`);
    record('GET /run-bindings/{runId}', binding.status);
    expect(binding.status).toBe(200);
    expect(binding.body.data.runId).toBe(runId);
  }, 60_000);

  // =========================================================================
  // D. ADMIN-gated legacy-quarantine reads
  // =========================================================================
  it('legacy-quarantine reads execute for an ADMIN and stay empty for a fresh org', async () => {
    const rehearsalRunId = `cw-rehearsal-${randomUUID()}`;
    const endpoints = [
      `/legacy-quarantine/rehearsal-runs/${rehearsalRunId}`,
      `/legacy-quarantine/rehearsal-runs/${rehearsalRunId}/counts`,
      `/legacy-quarantine/source/case_core/${randomUUID()}`,
    ];

    for (const endpoint of endpoints) {
      const res = await request(adminApp).get(`${BASE}${endpoint}`);
      record(`GET ${endpoint}`, res.status);
      expect(res.status, `GET ${endpoint} -> ${res.status} ${JSON.stringify(res.body)}`).toBe(200);
      expect(res.body).toHaveProperty('data');
    }
  }, 60_000);

  it('a MEMBER is refused the ADMIN-gated quarantine reads', async () => {
    const res = await request(memberApp).get(
      `${BASE}/legacy-quarantine/rehearsal-runs/cw-rehearsal-${randomUUID()}`
    );
    record('GET /legacy-quarantine/rehearsal-runs/{id} (as MEMBER)', res.status);
    expect(res.status).toBe(403);
  }, 60_000);

  // =========================================================================
  // E. Unknown-id detail reads — a stable 404, never a 500 and never a leak
  // =========================================================================
  it('by-id reads for ids that do not exist answer a stable 404, not a 500', async () => {
    const unknown = `cw-absent-${randomUUID()}`;
    const cases: Array<{ app: ReturnType<typeof createContractApp>; endpoint: string }> = [
      { app: memberApp, endpoint: `/cases/${unknown}` },
      { app: memberApp, endpoint: `/cases/by-project/${unknown}` },
      { app: memberApp, endpoint: `/plan-versions/${unknown}` },
      { app: memberApp, endpoint: `/plan-versions/${unknown}/graph` },
      { app: memberApp, endpoint: `/capabilities/by-id/${unknown}` },
      { app: memberApp, endpoint: `/capabilities/${unknown}/versions/1.0.0` },
      { app: memberApp, endpoint: `/flags/definitions/${unknown}` },
      { app: memberApp, endpoint: `/flags/org-state/${unknown}` },
      { app: memberApp, endpoint: `/flags/org-state/${unknown}/smallest-enabled-descendant` },
      { app: memberApp, endpoint: `/run-bindings/${unknown}` },
      { app: memberApp, endpoint: `/run-bindings/by-plan-version/${unknown}` },
      { app: memberApp, endpoint: `/proposals/${unknown}` },
      { app: memberApp, endpoint: `/proposals/${unknown}/decisions` },
      { app: memberApp, endpoint: `/artifact-links/${unknown}` },
      { app: memberApp, endpoint: `/waits/${unknown}` },
      { app: memberApp, endpoint: `/history-events/${unknown}` },
      { app: memberApp, endpoint: `/value-measurements/${unknown}` },
      { app: memberApp, endpoint: `/gateway-evaluations/${unknown}` },
      { app: memberApp, endpoint: `/node-result-acceptances/${unknown}` },
      { app: memberApp, endpoint: `/process-definitions/${unknown}` },
      { app: memberApp, endpoint: `/process-definitions/${unknown}/publisher-check` },
      { app: memberApp, endpoint: `/process-versions/${unknown}` },
      { app: adminApp, endpoint: `/legacy-quarantine/${unknown}` },
    ];

    for (const { app, endpoint } of cases) {
      const res = await request(app).get(`${BASE}${endpoint}`);
      record(`GET ${endpoint} (absent)`, res.status);
      expect(res.status, `GET ${endpoint} -> ${res.status} ${JSON.stringify(res.body)}`).toBe(404);

      // The error envelope is the documented one, and it never carries SQL
      // text or a stack trace outward (SEC: no internals in a client error).
      const serialized = JSON.stringify(res.body);
      expect(res.body?.error?.code, `GET ${endpoint} has no error.code`).toBeTruthy();
      expect(serialized).not.toMatch(/SELECT |INSERT |relation "|at Object\.|node_modules/i);
    }
  }, 120_000);

  // =========================================================================
  // F. The property this whole suite exists to assert
  // =========================================================================
  it('no endpoint on the read surface answered 500', () => {
    // Guards against this file quietly becoming a no-op: if the cases above
    // stop executing, `observed` empties and this fails rather than passing
    // vacuously.
    expect(observed.length).toBeGreaterThanOrEqual(45);

    const failures = observed.filter((o) => o.status >= 500);
    expect(failures).toEqual([]);
  });
});
