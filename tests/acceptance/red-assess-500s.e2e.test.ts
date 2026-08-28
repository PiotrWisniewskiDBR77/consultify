/**
 * RED-ASSESS-500s — schema-500 sweep for the assessment / reports /
 * finance-statements / management-reports rewir (ŁOWCA RED task, 2026-07-19).
 *
 * Pattern: 1:1 with tests/acceptance/smoke-500.e2e.test.ts — REAL router +
 * REAL verifyToken + REAL local Postgres (parity :5443). Each request is
 * classified by HTTP status + (if 5xx) Postgres error code where available.
 *
 * Seed prefix: odbior--redas-- (reversible, cleaned in afterAll).
 *
 * Guard (per orchestrator instructions): management_reports has a CHECK
 * constraint + AVG(progress) TEXT bug under repair by a parallel agent
 * (fix-mgmt-reports). If endpoints here hit that specific bug, we only log
 * it as "w naprawie (equipe równoległa)" — we do NOT touch management_reports
 * schema/queries ourselves.
 */
import { appendFileSync, writeFileSync } from 'node:fs';

import express, { type Express } from 'express';
import pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { mintToken, requireLocalDbUrl } from './harness.js';
import { seed, SEED } from './seed.mjs';

const RANDOM_UUID = '00000000-0000-4000-8000-000000000000';
const RESULTS_FILE = process.env.REDASS_RESULTS_FILE || '/tmp/red-assess-results.log';
writeFileSync(RESULTS_FILE, '');
const evidence = (line: string) => appendFileSync(RESULTS_FILE, line + '\n');

// Fixture ids — prefix `odbior--redas--` per orchestrator instruction.
const PROJECT_ID = 'odbior--redas--project-0001';
const ASSESSMENT_ID = 'odbior--redas--assessment-0001';
const ASSESSMENT_REPORT_ID = 'odbior--redas--areport-0001';
const FIN_PACK_ID = 'odbior--redas--finpack-0001';
const FIN_STMT_ID = 'odbior--redas--finstmt-0001';

type RouteContract = {
  path: string;
  status: 200 | 201 | 400 | 404;
  state: 'success' | 'created' | 'validation' | 'not-found';
  shape: `key:${string}` | 'array' | 'empty-object' | `error:${string}`;
};

const ok = (path: string, shape: RouteContract['shape']): RouteContract => ({ path, status: 200, state: 'success', shape });
const created = (path: string, shape: RouteContract['shape']): RouteContract => ({ path, status: 201, state: 'created', shape });
const invalid = (path: string, error: string): RouteContract => ({ path, status: 400, state: 'validation', shape: `error:${error}` });
const missing = (path: string, error?: string): RouteContract => ({
  path,
  status: 404,
  state: 'not-found',
  shape: error ? `error:${error}` : 'empty-object',
});

/** Exact route contract. The imported router path is included in every failure as source justification. */
function assertRouteContract(
  r: { label: string; status: number | 'HANG'; body?: any; error?: string },
  contract: RouteContract,
  routerImportPath: string
) {
  expect(r.status, `${r.label} — ${contract.state} status from ${routerImportPath}`).toBe(contract.status);
  const body = r.body;
  if (contract.shape === 'array') {
    expect(Array.isArray(body), `${r.label} — array payload from ${routerImportPath}`).toBe(true);
  } else if (contract.shape === 'empty-object') {
    expect(body, `${r.label} — empty not-found payload from ${routerImportPath}`).toEqual({});
  } else if (contract.shape.startsWith('key:')) {
    const key = contract.shape.slice('key:'.length);
    expect(body, `${r.label} — object payload from ${routerImportPath}`).toBeTypeOf('object');
    expect(body, `${r.label} — required payload key from ${routerImportPath}`).toHaveProperty(key);
  } else {
    const message = contract.shape.slice('error:'.length);
    expect(body, `${r.label} — error payload from ${routerImportPath}`).toMatchObject({ error: message });
  }
}

let token: string;

async function seedRedAssessFixtures(): Promise<void> {
  const client = new pg.Client({ connectionString: requireLocalDbUrl() });
  await client.connect();
  try {
    const now = new Date().toISOString();
    await client.query(
      `INSERT INTO projects (id, organization_id, name, status, owner_id, created_at)
       VALUES ($1,$2,'RED-ASS Harness Project','active',$3,$4)
       ON CONFLICT (id) DO NOTHING`,
      [PROJECT_ID, SEED.ORG_ID, SEED.USER_ID, now]
    );
    await client.query(
      `INSERT INTO assessments (id, organization_id, project_id, status, name, created_at, updated_at, created_by)
       VALUES ($1,$2,$3,'DRAFT','RED-ASS Harness Assessment',$4,$4,$5)
       ON CONFLICT (id) DO NOTHING`,
      [ASSESSMENT_ID, SEED.ORG_ID, PROJECT_ID, now, SEED.USER_ID]
    );
    await client.query(
      `INSERT INTO assessment_reports (id, assessment_id, organization_id, project_id, name, status, created_at, updated_at)
       VALUES ($1,$2,$3,$4,'RED-ASS Harness Report','DRAFT',$5,$5)
       ON CONFLICT (id) DO NOTHING`,
      [ASSESSMENT_REPORT_ID, ASSESSMENT_ID, SEED.ORG_ID, PROJECT_ID, now]
    );
    await client.query(
      `INSERT INTO financial_statement_packs (id, organization_id, entity_name, period_start, period_end, pack_status, created_at, updated_at)
       VALUES ($1,$2,'RED-ASS Harness Entity','2026-01-01','2026-03-31','draft',$3,$3)
       ON CONFLICT (id) DO NOTHING`,
      [FIN_PACK_ID, SEED.ORG_ID, now]
    );
    await client.query(
      `INSERT INTO financial_statements (id, organization_id, entity_name, statement_type, period_start, period_end, status, created_at, updated_at, statement_pack_id)
       VALUES ($1,$2,'RED-ASS Harness Entity','P&L','2026-01-01','2026-03-31','draft',$3,$3,$4)
       ON CONFLICT (id) DO NOTHING`,
      [FIN_STMT_ID, SEED.ORG_ID, now, FIN_PACK_ID]
    );
    evidence('[seed] red-assess fixtures OK');
  } catch (e: any) {
    evidence(`[seed] red-assess fixtures FAILED: ${e?.message || e}`);
  } finally {
    await client.end();
  }
}

async function cleanupRedAssessFixtures(): Promise<void> {
  const client = new pg.Client({ connectionString: requireLocalDbUrl() });
  await client.connect();
  try {
    // Delete in FK-safe order; ignore errors per statement (best-effort cleanup).
    const stmts = [
      `DELETE FROM financial_statements WHERE id = $1`,
      `DELETE FROM financial_statement_packs WHERE id = $1`,
      `DELETE FROM assessment_reports WHERE id = $1`,
      `DELETE FROM assessment_workflows WHERE assessment_id = $1`,
      `DELETE FROM assessments WHERE id = $1`,
      `DELETE FROM projects WHERE id = $1`,
    ];
    const ids = [FIN_STMT_ID, FIN_PACK_ID, ASSESSMENT_REPORT_ID, ASSESSMENT_ID, ASSESSMENT_ID, PROJECT_ID];
    for (let i = 0; i < stmts.length; i++) {
      try {
        await client.query(stmts[i], [ids[i]]);
      } catch (e: any) {
        evidence(`[cleanup] ${stmts[i]} FAILED: ${e?.message || e}`);
      }
    }
  } finally {
    await client.end();
  }
}

/** Build a tiny app mounting ONE router at `prefix` behind REAL verifyToken. */
async function mountRouter(
  prefix: string,
  routerImportPath: string,
  opts: { extraMiddleware?: any[] } = {}
): Promise<Express> {
  const { default: verifyToken } = await import('../../server/src/middleware/auth.middleware.js');
  const { default: router } = await import(routerImportPath);
  const app = express();
  app.use(express.json({ limit: '5mb' }));
  const mw = [verifyToken as any, ...(opts.extraMiddleware || [])];
  app.use(prefix, ...mw, router);
  return app;
}

/** Try a request with a hard timeout so a hung import/handler doesn't block the sweep. */
async function tryReq(
  label: string,
  fn: () => Promise<{ status: number; body: any; text?: string }>
): Promise<{ label: string; status: number | 'HANG'; body?: any; error?: string }> {
  try {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('TIMEOUT_10s')), 10_000)
    );
    const res = await Promise.race([fn(), timeout]);
    const out = { label, status: res.status, body: res.body };
    const bodyStr = JSON.stringify(res.body);
    const preview = bodyStr && bodyStr !== '{}' ? bodyStr : String(res.text || '').slice(0, 500);
    evidence(`LIVE   ${String(out.status).padEnd(6)} ${label}  ${preview.slice(0, 600)}`);
    return out;
  } catch (e: any) {
    const isHang = String(e?.message).includes('TIMEOUT');
    const out = {
      label,
      status: 'HANG' as const,
      error: isHang ? 'router/handler did not respond in 10s' : String(e?.message || e),
    };
    evidence(`LIVE   HANG   ${label}  ${out.error}`);
    return out;
  }
}

const RESULTS: Array<{ label: string; status: number | 'HANG'; body?: any; error?: string }> = [];

beforeAll(async () => {
  await seed();
  await seedRedAssessFixtures();
  token = mintToken();
}, 60_000);

afterAll(async () => {
  evidence('===== RED-ASSESS-500 SUMMARY =====');
  const fail5xx = RESULTS.filter((r) => r.status === 'HANG' || (typeof r.status === 'number' && r.status >= 500));
  for (const r of RESULTS) {
    const bodyPreview =
      r.status !== 'HANG' && r.body ? JSON.stringify(r.body).slice(0, 300) : r.error || '';
    evidence(`${String(r.status).padEnd(6)} ${r.label}  ${bodyPreview}`);
  }
  evidence(`===== END SUMMARY: ${fail5xx.length} FAIL (5xx/HANG) of ${RESULTS.length} total =====`);
  await cleanupRedAssessFixtures();
}, 30_000);

// Helper to reduce boilerplate for GET sweeps within one router file.
function sweepGet(
  describeLabel: string,
  prefix: string,
  routerPath: string,
  contracts: RouteContract[],
  extraMiddleware: any[] = []
) {
  describe(describeLabel, () => {
    for (const contract of contracts) {
      const p = contract.path;
      it(`GET ${prefix}${p}`, async () => {
        const app = await mountRouter(prefix, routerPath, { extraMiddleware });
        const r = await tryReq(`GET ${prefix}${p}`, () =>
          request(app).get(`${prefix}${p}`).set('Authorization', `Bearer ${token}`)
        );
        RESULTS.push(r);
        assertRouteContract(r, contract, routerPath);
      }, 20_000);
    }
  });
}

// ============================================================================
// 1. Assessment Hub — /api/assessments
// ============================================================================
sweepGet('RED-ASSESS: assessment-hub /api/assessments', '/api/assessments', '../../server/src/routes/assessment/assessment-hub.routes.js', [
  ok('/my-assessments', 'key:assessments'),
  ok('/', 'key:assessments'),
  ok('/canonical-index', 'key:items'),
  ok(`/${ASSESSMENT_ID}`, 'key:assessment'),
]);

describe('RED-ASSESS: assessment-hub writes', () => {
  it('POST /api/assessments (create)', async () => {
    const app = await mountRouter('/api/assessments', '../../server/src/routes/assessment/assessment-hub.routes.js');
    const r = await tryReq('POST /api/assessments', () =>
      request(app)
        .post('/api/assessments')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'odbior--redas-- create test', type: 'DRD' })
    );
    RESULTS.push(r);
    assertRouteContract(r, created('/', 'key:assessment'), '../../server/src/routes/assessment/assessment-hub.routes.js');
  }, 20_000);
});

// ============================================================================
// 2. Assessment level attachments — /api/assessment-level-attachments
// ============================================================================
sweepGet(
  'RED-ASSESS: assessment-level-attachments',
  '/api/assessment-level-attachments',
  '../../server/src/routes/assessment/assessment-level-attachments.routes.js',
  [
    ok(`/level/${ASSESSMENT_ID}/axis1/1`, 'key:attachments'),
    missing(`/download/${RANDOM_UUID}`, 'Attachment not found'),
  ]
);

// ============================================================================
// 3. Assessment workflow (DEPRECATED but LIVE) — /api/assessment-workflow
// ============================================================================
sweepGet(
  'RED-ASSESS: assessment-workflow (deprecated, live) /api/assessment-workflow',
  '/api/assessment-workflow',
  '../../server/src/routes/assessment/assessment-workflow.routes.js',
  [
    ok(`/${ASSESSMENT_ID}/status`, 'key:assessmentId'),
    ok(`/${ASSESSMENT_ID}/versions`, 'key:versions'),
    ok(`/${ASSESSMENT_ID}/history`, 'key:history'),
    ok('/pending-reviews', 'key:reviews'),
    ok(`/${ASSESSMENT_ID}/activity-logs`, 'key:logs'),
    missing(`/${ASSESSMENT_ID}/my-role`),
    missing(`/${ASSESSMENT_ID}/roles`),
    ok(`/${ASSESSMENT_ID}/access-requests`, 'key:requests'),
  ]
);

describe('RED-ASSESS: assessment-workflow writes (org_id type-mismatch suspect)', () => {
  it('POST /api/assessment-workflow/:id/initialize — org_id text-into-integer column suspect', async () => {
    const app = await mountRouter(
      '/api/assessment-workflow',
      '../../server/src/routes/assessment/assessment-workflow.routes.js'
    );
    const r = await tryReq(`POST /api/assessment-workflow/${ASSESSMENT_ID}/initialize`, () =>
      request(app)
        .post(`/api/assessment-workflow/${ASSESSMENT_ID}/initialize`)
        .set('Authorization', `Bearer ${token}`)
        .send({})
    );
    RESULTS.push(r);
    assertRouteContract(r, created(`/${ASSESSMENT_ID}/initialize`, 'key:id'), '../../server/src/routes/assessment/assessment-workflow.routes.js');
  }, 20_000);
});

// ============================================================================
// 4. Assessment workflow v2 — /api/assessment-workflow-v2
// ============================================================================
sweepGet(
  'RED-ASSESS: assessment-workflow-v2',
  '/api/assessment-workflow-v2',
  '../../server/src/routes/assessment-workflow-v2.routes.js',
  [
    ok('/', 'key:items'),
    ok('/sessions', 'key:sessions'),
    ok(`/${ASSESSMENT_ID}/users`, 'key:users'),
    ok(`/${ASSESSMENT_ID}`, 'key:id'),
    ok(`/${ASSESSMENT_ID}/user-state`, 'key:assessmentId'),
    ok(`/${ASSESSMENT_ID}/assignments`, 'key:assignments'),
    ok(`/${ASSESSMENT_ID}/report/versions`, 'key:versions'),
    ok(`/${ASSESSMENT_ID}/my-role`, 'key:role'),
    ok(`/${ASSESSMENT_ID}/roles`, 'key:roles'),
    ok(`/${ASSESSMENT_ID}/eligibility`, 'key:assessment'),
    ok(`/${ASSESSMENT_ID}/access-requests`, 'key:requests'),
    ok(`/${ASSESSMENT_ID}/generated-initiatives`, 'key:initiatives'),
    ok(`/${ASSESSMENT_ID}/initiative-generation-runs`, 'key:runs'),
    ok(`/${ASSESSMENT_ID}/initiative-batches`, 'key:batches'),
    ok(`/${ASSESSMENT_ID}/gate-decisions`, 'key:decisions'),
    ok(`/${ASSESSMENT_ID}/benchmark-comparison`, 'key:benchmark'),
  ]
);

// ============================================================================
// 5. Assessment enterprise — /api/assessments-v4
// ============================================================================
sweepGet(
  'RED-ASSESS: assessment-enterprise /api/assessments-v4',
  '/api/assessments-v4',
  '../../server/src/routes/assessment-enterprise.routes.js',
  [
    ok(`/assessments/${ASSESSMENT_ID}/findings`, 'key:findings'),
    missing(`/findings/${RANDOM_UUID}`, 'Finding not found'),
    ok(`/findings/${RANDOM_UUID}/capa`, 'key:actions'),
    ok('/evidence/clause-map', 'key:mappings'),
    ok(`/evidence/clause-coverage/${RANDOM_UUID}`, 'key:coverage'),
    ok('/evidence/access-log', 'key:log'),
    ok(`/assessments/${ASSESSMENT_ID}/scoring-proposals`, 'key:proposals'),
    ok('/eval/datasets', 'key:datasets'),
    ok(`/eval/datasets/${RANDOM_UUID}/runs`, 'key:runs'),
    missing(`/eval/runs/${RANDOM_UUID}/compare/${RANDOM_UUID}`, 'One or both runs not found'),
    ok(`/assessments/${ASSESSMENT_ID}/reviews`, 'key:reviews'),
    missing(`/assessments/${ASSESSMENT_ID}/versions/1/diff/2`, 'Version(s) not found'),
  ]
);

// ============================================================================
// 6. Assessment evidence — /api/assessment-evidence
// ============================================================================
sweepGet(
  'RED-ASSESS: assessment-evidence',
  '/api/assessment-evidence',
  '../../server/src/routes/assessmentEvidence.routes.js',
  [ok(`/${ASSESSMENT_ID}`, 'key:evidence'), ok(`/${ASSESSMENT_ID}/report`, 'key:frameworkId')]
);

// ============================================================================
// 7. Reports — /api/reports
// ============================================================================
sweepGet('RED-ASSESS: reports /api/reports', '/api/reports', '../../server/src/routes/reports.routes.js', [
  ok('/executive-overview', 'key:data'),
  ok('/org-overview', 'key:data'),
  ok(`/project/${PROJECT_ID}`, 'key:data'),
]);

// ============================================================================
// 8. Finance statements — /api/finance-statements
// ============================================================================
sweepGet(
  'RED-ASSESS: finance-statements /api/finance-statements',
  '/api/finance-statements',
  '../../server/src/routes/finance-statements.routes.js',
  [
    ok('/', 'array'),
    ok('/packs', 'array'),
    ok(`/packs/${FIN_PACK_ID}`, 'key:id'),
    ok(`/packs/${FIN_PACK_ID}/reconcile-summary`, 'key:packId'),
    ok(`/packs/${FIN_PACK_ID}/report-section/lineage`, 'key:lineage'),
    ok(`/aggregate-scope/initiatives/${RANDOM_UUID}/delta`, 'key:delta'),
    ok(`/packs/${FIN_PACK_ID}/aggregate-scope/portfolio`, 'key:statements'),
    ok('/canonical-lines', 'array'),
    ok(`/${FIN_STMT_ID}/analytics`, 'key:rows'),
    missing(`/${FIN_STMT_ID}/values/${RANDOM_UUID}/explain`, 'Statement value not found'),
    ok(`/${FIN_STMT_ID}`, 'key:id'),
    invalid(`/${FIN_STMT_ID}/document-intelligence/search`, 'q is required'),
    ok('/ratios/catalog', 'array'),
    missing(`/${FIN_STMT_ID}/ratios`, 'Statement must be statement-ready before ratio computation'),
    missing('/benchmarks', 'Statement not found'),
  ]
);

// ============================================================================
// 9. Finance enterprise — /api/finance-v4
// ============================================================================
sweepGet(
  'RED-ASSESS: finance-enterprise /api/finance-v4',
  '/api/finance-v4',
  '../../server/src/routes/finance-enterprise.routes.js',
  [
    ok(`/models/${RANDOM_UUID}/versions`, 'key:versions'),
    missing(`/versions/${RANDOM_UUID}/compare/${RANDOM_UUID}`, 'Version not found'),
    ok('/dimensions', 'key:dimensions'),
    ok(`/models/${RANDOM_UUID}/allocations`, 'key:allocations'),
    ok('/consolidations', 'key:consolidations'),
    ok(`/models/${RANDOM_UUID}/budgets`, 'key:budgets'),
    ok(`/budgets/${RANDOM_UUID}/variance-alerts`, 'key:alerts'),
    ok('/connectors', 'key:connectors'),
    ok(`/connectors/${RANDOM_UUID}/sync-log`, 'key:logs'),
    ok(`/models/${RANDOM_UUID}/valuations`, 'key:snapshots'),
    ok(`/valuations/${RANDOM_UUID}/audit`, 'key:audit'),
    ok(`/models/${RANDOM_UUID}/ai-assumptions`, 'key:assumptions'),
    ok(`/models/${RANDOM_UUID}/roi-links`, 'key:links'),
  ]
);

// ============================================================================
// 10. Management reports — /api/management-reports (GUARD: parallel fix in flight)
// ============================================================================
sweepGet(
  'RED-ASSESS: management-reports /api/management-reports',
  '/api/management-reports',
  '../../server/src/routes/managementReports.routes.js',
  [
    ok('/history', 'key:reports'),
    ok('/templates', 'key:templates'),
    ok('/schedules', 'key:schedules'),
    ok('/pending-approvals', 'key:pending'),
    missing(`/${RANDOM_UUID}`, 'Report not found'),
    missing(`/${RANDOM_UUID}/approval-status`),
    missing(`/${RANDOM_UUID}/versions`),
    missing(`/${RANDOM_UUID}/versions/compare`),
    missing(`/${RANDOM_UUID}/comments`),
    missing(`/${RANDOM_UUID}/audit-log`),
    ok('/analytics/usage', 'key:data'),
    ok('/analytics/types', 'key:data'),
  ]
);

// ============================================================================
// 11. Management reports analytics — /api/management-reports/analytics
// ============================================================================
sweepGet(
  'RED-ASSESS: management-reports-analytics',
  '/api/management-reports/analytics',
  '../../server/src/routes/managementReportsAnalytics.routes.js',
  [ok('/usage', 'key:data'), ok('/types', 'key:data')]
);
