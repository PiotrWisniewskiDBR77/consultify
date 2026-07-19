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

/**
 * KNOWN RED — confirmed real 500s (parity pg18, 2026-07-19) that are OUT of
 * safe-migration scope (missing tables / type-mismatch column / wrong
 * column names referenced by code — see RAPORT RED in the handoff). These
 * are asserted to their current status/message so a change here is a
 * visible signal (fixed, or regressed differently) rather than silent scope
 * creep in this sweep. Do NOT add new entries here without a matching
 * RAPORT RED writeup — this list is a tracked debt ledger, not a rug.
 */
const KNOWN_RED: Record<string, { status: number; messageIncludes: string }> = {
  [`GET /api/assessment-workflow/${ASSESSMENT_ID}/status`]: {
    status: 500,
    messageIncludes: 'invalid input syntax for type integer',
  },
  [`GET /api/assessment-workflow/${ASSESSMENT_ID}/versions`]: {
    status: 500,
    messageIncludes: 'assessment_versions',
  },
  [`GET /api/assessment-workflow/${ASSESSMENT_ID}/history`]: {
    status: 500,
    messageIncludes: 'invalid input syntax for type integer',
  },
  ['GET /api/assessment-workflow/pending-reviews']: {
    status: 500,
    messageIncludes: 'assessment_reviews',
  },
  [`POST /api/assessment-workflow/${ASSESSMENT_ID}/initialize`]: {
    status: 500,
    messageIncludes: 'invalid input syntax for type integer',
  },
  [`GET /api/assessment-workflow-v2/${ASSESSMENT_ID}/initiative-batches`]: {
    status: 500,
    messageIncludes: 'generated_by',
  },
  [`GET /api/assessments-v4/assessments/${ASSESSMENT_ID}/versions/1/diff/2`]: {
    status: 500,
    messageIncludes: '', // raw HTML (no error-middleware in the narrow test app) — status is the signal
  },
  [`GET /api/assessment-evidence/${ASSESSMENT_ID}/report`]: {
    status: 500,
    messageIncludes: '', // raw HTML — root cause: assessment_questions relation missing (42P01)
  },
};

/** Assert a sweep result: KNOWN_RED entries stay pinned, everything else must not 5xx/HANG. */
function assertNotRegressed(r: { label: string; status: number | 'HANG'; body?: any; error?: string }) {
  const known = KNOWN_RED[r.label];
  if (known) {
    expect(r.status, `${r.label} — expected pinned KNOWN RED status`).toBe(known.status);
    if (known.messageIncludes) {
      const msg = JSON.stringify(r.body || '');
      expect(msg, `${r.label} — KNOWN RED message drifted`).toContain(known.messageIncludes);
    }
    return;
  }
  expect(r.status, `${r.label} — NEW regression (not in KNOWN_RED)`).not.toBe('HANG');
  expect(
    typeof r.status === 'number' ? r.status : 999,
    `${r.label} — NEW regression (not in KNOWN_RED): ${JSON.stringify(r.body)}`
  ).toBeLessThan(500);
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
  paths: string[],
  extraMiddleware: any[] = []
) {
  describe(describeLabel, () => {
    for (const p of paths) {
      it(`GET ${prefix}${p}`, async () => {
        const app = await mountRouter(prefix, routerPath, { extraMiddleware });
        const r = await tryReq(`GET ${prefix}${p}`, () =>
          request(app).get(`${prefix}${p}`).set('Authorization', `Bearer ${token}`)
        );
        RESULTS.push(r);
        assertNotRegressed(r);
      }, 20_000);
    }
  });
}

// ============================================================================
// 1. Assessment Hub — /api/assessments
// ============================================================================
sweepGet('RED-ASSESS: assessment-hub /api/assessments', '/api/assessments', '../../server/src/routes/assessment/assessment-hub.routes.js', [
  '/my-assessments',
  '/',
  '/canonical-index',
  `/${ASSESSMENT_ID}`,
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
    assertNotRegressed(r);
  }, 20_000);
});

// ============================================================================
// 2. Assessment level attachments — /api/assessment-level-attachments
// ============================================================================
sweepGet(
  'RED-ASSESS: assessment-level-attachments',
  '/api/assessment-level-attachments',
  '../../server/src/routes/assessment/assessment-level-attachments.routes.js',
  [`/level/${ASSESSMENT_ID}/axis1/1`, `/download/${RANDOM_UUID}`]
);

// ============================================================================
// 3. Assessment workflow (DEPRECATED but LIVE) — /api/assessment-workflow
// ============================================================================
sweepGet(
  'RED-ASSESS: assessment-workflow (deprecated, live) /api/assessment-workflow',
  '/api/assessment-workflow',
  '../../server/src/routes/assessment/assessment-workflow.routes.js',
  [
    `/${ASSESSMENT_ID}/status`,
    `/${ASSESSMENT_ID}/versions`,
    `/${ASSESSMENT_ID}/history`,
    '/pending-reviews',
    `/${ASSESSMENT_ID}/activity-logs`,
    `/${ASSESSMENT_ID}/my-role`,
    `/${ASSESSMENT_ID}/roles`,
    `/${ASSESSMENT_ID}/access-requests`,
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
    assertNotRegressed(r);
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
    '/',
    '/sessions',
    `/${ASSESSMENT_ID}/users`,
    `/${ASSESSMENT_ID}`,
    `/${ASSESSMENT_ID}/user-state`,
    `/${ASSESSMENT_ID}/assignments`,
    `/${ASSESSMENT_ID}/report/versions`,
    `/${ASSESSMENT_ID}/my-role`,
    `/${ASSESSMENT_ID}/roles`,
    `/${ASSESSMENT_ID}/eligibility`,
    `/${ASSESSMENT_ID}/access-requests`,
    `/${ASSESSMENT_ID}/generated-initiatives`,
    `/${ASSESSMENT_ID}/initiative-generation-runs`,
    `/${ASSESSMENT_ID}/initiative-batches`,
    `/${ASSESSMENT_ID}/gate-decisions`,
    `/${ASSESSMENT_ID}/benchmark-comparison`,
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
    `/assessments/${ASSESSMENT_ID}/findings`,
    `/findings/${RANDOM_UUID}`,
    `/findings/${RANDOM_UUID}/capa`,
    '/evidence/clause-map',
    `/evidence/clause-coverage/${RANDOM_UUID}`,
    '/evidence/access-log',
    `/assessments/${ASSESSMENT_ID}/scoring-proposals`,
    '/eval/datasets',
    `/eval/datasets/${RANDOM_UUID}/runs`,
    `/eval/runs/${RANDOM_UUID}/compare/${RANDOM_UUID}`,
    `/assessments/${ASSESSMENT_ID}/reviews`,
    `/assessments/${ASSESSMENT_ID}/versions/1/diff/2`,
  ]
);

// ============================================================================
// 6. Assessment evidence — /api/assessment-evidence
// ============================================================================
sweepGet(
  'RED-ASSESS: assessment-evidence',
  '/api/assessment-evidence',
  '../../server/src/routes/assessmentEvidence.routes.js',
  [`/${ASSESSMENT_ID}`, `/${ASSESSMENT_ID}/report`]
);

// ============================================================================
// 7. Reports — /api/reports
// ============================================================================
sweepGet('RED-ASSESS: reports /api/reports', '/api/reports', '../../server/src/routes/reports.routes.js', [
  '/executive-overview',
  '/org-overview',
  `/project/${PROJECT_ID}`,
]);

// ============================================================================
// 8. Finance statements — /api/finance-statements
// ============================================================================
sweepGet(
  'RED-ASSESS: finance-statements /api/finance-statements',
  '/api/finance-statements',
  '../../server/src/routes/finance-statements.routes.js',
  [
    '/',
    '/packs',
    `/packs/${FIN_PACK_ID}`,
    `/packs/${FIN_PACK_ID}/reconcile-summary`,
    `/packs/${FIN_PACK_ID}/report-section/lineage`,
    `/aggregate-scope/initiatives/${RANDOM_UUID}/delta`,
    `/packs/${FIN_PACK_ID}/aggregate-scope/portfolio`,
    '/canonical-lines',
    `/${FIN_STMT_ID}/analytics`,
    `/${FIN_STMT_ID}/values/${RANDOM_UUID}/explain`,
    `/${FIN_STMT_ID}`,
    `/${FIN_STMT_ID}/document-intelligence/search`,
    '/ratios/catalog',
    `/${FIN_STMT_ID}/ratios`,
    '/benchmarks',
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
    `/models/${RANDOM_UUID}/versions`,
    `/versions/${RANDOM_UUID}/compare/${RANDOM_UUID}`,
    '/dimensions',
    `/models/${RANDOM_UUID}/allocations`,
    '/consolidations',
    `/models/${RANDOM_UUID}/budgets`,
    `/budgets/${RANDOM_UUID}/variance-alerts`,
    '/connectors',
    `/connectors/${RANDOM_UUID}/sync-log`,
    `/models/${RANDOM_UUID}/valuations`,
    `/valuations/${RANDOM_UUID}/audit`,
    `/models/${RANDOM_UUID}/ai-assumptions`,
    `/models/${RANDOM_UUID}/roi-links`,
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
    '/history',
    '/templates',
    '/schedules',
    '/pending-approvals',
    `/${RANDOM_UUID}`,
    `/${RANDOM_UUID}/approval-status`,
    `/${RANDOM_UUID}/versions`,
    `/${RANDOM_UUID}/versions/compare`,
    `/${RANDOM_UUID}/comments`,
    `/${RANDOM_UUID}/audit-log`,
    '/analytics/usage',
    '/analytics/types',
  ]
);

// ============================================================================
// 11. Management reports analytics — /api/management-reports/analytics
// ============================================================================
sweepGet(
  'RED-ASSESS: management-reports-analytics',
  '/api/management-reports/analytics',
  '../../server/src/routes/managementReportsAnalytics.routes.js',
  ['/usage', '/types']
);
