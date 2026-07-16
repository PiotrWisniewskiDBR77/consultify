/**
 * SMOKE-500 — sweep real endpoints against the PARITY pg18 DB (:5443, schema =
 * demo/production) to find genuine SQL-schema 500s (undefined_column 42703 /
 * undefined_table 42P01), as opposed to the ~286-hit STATIC grep noise.
 *
 * Pattern: 1:1 with tests/acceptance/parity-3areas.e2e.test.ts — REAL router +
 * REAL verifyToken + REAL local Postgres. Each module gets its own tiny Express
 * app mounting ONE router file, so a hang/crash in one module doesn't take down
 * the sweep. NEVER mount Gateway.ts or any v8/index.ts aggregator (46
 * self-resolving lazy AI wrappers deadlock on await — see MEMORY finding
 * lazyloader_46_self_resolving_hang).
 *
 * This file is exploratory/scrappy by design (per orchestrator instructions),
 * not a permanent regression suite — but it is committed for provenance.
 *
 * Results (status + body/text preview) are appended to SMOKE500_RESULTS_FILE
 * (default /tmp/smoke500-results.log) as each request completes, not just at
 * afterAll, so a hard crash mid-sweep still leaves partial evidence on disk.
 */
import { appendFileSync, writeFileSync } from 'node:fs';

import express, { type Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, it } from 'vitest';

import { mintToken } from './harness.js';
import { seed } from './seed.mjs';

const RANDOM_UUID = '00000000-0000-4000-8000-000000000000';
const RESULTS_FILE = process.env.SMOKE500_RESULTS_FILE || '/tmp/smoke500-results.log';
writeFileSync(RESULTS_FILE, '');
const evidence = (line: string) => appendFileSync(RESULTS_FILE, line + '\n');

let token: string;

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
    evidence(`LIVE   ${String(out.status).padEnd(6)} ${label}  ${preview.slice(0, 500)}`);
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
  token = mintToken();
}, 60_000);

afterAll(() => {
  evidence('===== SMOKE-500 SUMMARY =====');
  for (const r of RESULTS) {
    const bodyPreview =
      r.status !== 'HANG' && r.body ? JSON.stringify(r.body).slice(0, 300) : r.error || '';
    evidence(`${String(r.status).padEnd(6)} ${r.label}  ${bodyPreview}`);
  }
  evidence('===== END SMOKE-500 SUMMARY =====');
});

// ============================================================================
// 1. Execution — already fixed; confirm 200.
// ============================================================================
describe('SMOKE-500: Execution /api/execution', () => {
  it('GET /:projectId/summary — confirm 200 (progress fix already applied)', async () => {
    const app = await mountRouter('/api/execution', '../../server/src/routes/pmo/execution.routes.js');
    const r = await tryReq('GET /api/execution/:projectId/summary', () =>
      request(app)
        .get(`/api/execution/${RANDOM_UUID}/summary`)
        .set('Authorization', `Bearer ${token}`)
    );
    RESULTS.push(r);
  }, 20_000);
});

// ============================================================================
// 2. Execution-modules + execution-analytics
// ============================================================================
describe('SMOKE-500: execution-modules / execution-analytics', () => {
  it('GET /api/execution-modules/standard', async () => {
    const app = await mountRouter(
      '/api/execution-modules',
      '../../server/src/routes/execution-modules.routes.js'
    );
    const r = await tryReq('GET /api/execution-modules/standard', () =>
      request(app).get('/api/execution-modules/standard').set('Authorization', `Bearer ${token}`)
    );
    RESULTS.push(r);
  }, 20_000);

  it('GET /api/execution-analytics/:projectId/intelligence', async () => {
    const app = await mountRouter(
      '/api/execution-analytics',
      '../../server/src/routes/executionAnalytics.routes.js'
    );
    const r = await tryReq('GET /api/execution-analytics/:projectId/intelligence', () =>
      request(app)
        .get(`/api/execution-analytics/${RANDOM_UUID}/intelligence`)
        .set('Authorization', `Bearer ${token}`)
    );
    RESULTS.push(r);
  }, 20_000);
});

// ============================================================================
// 3. Results family
// ============================================================================
describe('SMOKE-500: Results family', () => {
  it('GET /api/results/kpi-definitions', async () => {
    const app = await mountRouter('/api/results', '../../server/src/routes/results-kpi-reports.routes.js');
    const r = await tryReq('GET /api/results/kpi-definitions', () =>
      request(app).get('/api/results/kpi-definitions').set('Authorization', `Bearer ${token}`)
    );
    RESULTS.push(r);
  }, 20_000);

  it('GET /api/results/metrics-semantic-layer', async () => {
    const app = await mountRouter('/api/results', '../../server/src/routes/results-kpi-reports.routes.js');
    const r = await tryReq('GET /api/results/metrics-semantic-layer', () =>
      request(app).get('/api/results/metrics-semantic-layer').set('Authorization', `Bearer ${token}`)
    );
    RESULTS.push(r);
  }, 20_000);

  it('GET /api/results-v4/kpi-connectors', async () => {
    const app = await mountRouter('/api/results-v4', '../../server/src/routes/results-enterprise.routes.js');
    const r = await tryReq('GET /api/results-v4/kpi-connectors', () =>
      request(app).get('/api/results-v4/kpi-connectors').set('Authorization', `Bearer ${token}`)
    );
    RESULTS.push(r);
  }, 20_000);

  it('GET /api/results-value/:projectId/value-intelligence', async () => {
    const app = await mountRouter(
      '/api/results-value',
      '../../server/src/routes/resultsValueIntelligence.routes.js'
    );
    const r = await tryReq('GET /api/results-value/:projectId/value-intelligence', () =>
      request(app)
        .get(`/api/results-value/${RANDOM_UUID}/value-intelligence`)
        .set('Authorization', `Bearer ${token}`)
    );
    RESULTS.push(r);
  }, 20_000);

  it('GET /api/results-strategic/:projectId/strategic', async () => {
    const app = await mountRouter('/api/results-strategic', '../../server/src/routes/resultsStrategic.routes.js');
    const r = await tryReq('GET /api/results-strategic/:projectId/strategic', () =>
      request(app)
        .get(`/api/results-strategic/${RANDOM_UUID}/strategic`)
        .set('Authorization', `Bearer ${token}`)
    );
    RESULTS.push(r);
  }, 20_000);

  it('GET /api/results-driver-tree/:projectId/driver-tree', async () => {
    const app = await mountRouter(
      '/api/results-driver-tree',
      '../../server/src/routes/resultsDriverTree.routes.js'
    );
    const r = await tryReq('GET /api/results-driver-tree/:projectId/driver-tree', () =>
      request(app)
        .get(`/api/results-driver-tree/${RANDOM_UUID}/driver-tree`)
        .set('Authorization', `Bearer ${token}`)
    );
    RESULTS.push(r);
  }, 20_000);

  it('GET /api/results-extended/:projectId/signals', async () => {
    const app = await mountRouter('/api/results-extended', '../../server/src/routes/resultsExtended.routes.js');
    const r = await tryReq('GET /api/results-extended/:projectId/signals', () =>
      request(app)
        .get(`/api/results-extended/${RANDOM_UUID}/signals`)
        .set('Authorization', `Bearer ${token}`)
    );
    RESULTS.push(r);
  }, 20_000);
});

// ============================================================================
// 4. Initiatives family
// ============================================================================
describe('SMOKE-500: Initiatives family', () => {
  it('GET /api/initiatives (list)', async () => {
    const app = await mountRouter('/api/initiatives', '../../server/src/routes/pmo/initiatives.routes.js');
    const r = await tryReq('GET /api/initiatives', () =>
      request(app).get('/api/initiatives').set('Authorization', `Bearer ${token}`)
    );
    RESULTS.push(r);
  }, 20_000);

  it('GET /api/initiatives/portfolio', async () => {
    const app = await mountRouter('/api/initiatives', '../../server/src/routes/pmo/initiatives.routes.js');
    const r = await tryReq('GET /api/initiatives/portfolio', () =>
      request(app).get('/api/initiatives/portfolio').set('Authorization', `Bearer ${token}`)
    );
    RESULTS.push(r);
  }, 20_000);

  it('GET /api/initiatives/portfolio-health (initiativeBackbone)', async () => {
    const app = await mountRouter('/api/initiatives', '../../server/src/routes/initiativeBackbone.routes.js');
    const r = await tryReq('GET /api/initiatives/portfolio-health', () =>
      request(app).get('/api/initiatives/portfolio-health').set('Authorization', `Bearer ${token}`)
    );
    RESULTS.push(r);
  }, 20_000);

  it('GET /api/initiatives/:initiativeId/suggested-changes (initiatives-additive)', async () => {
    const app = await mountRouter(
      '/api/initiatives',
      '../../server/src/routes/initiatives-additive.routes.js'
    );
    const r = await tryReq('GET /api/initiatives/:id/suggested-changes', () =>
      request(app)
        .get(`/api/initiatives/${RANDOM_UUID}/suggested-changes`)
        .set('Authorization', `Bearer ${token}`)
    );
    RESULTS.push(r);
  }, 20_000);
});

// ============================================================================
// 5. Finance dashboard (v8) — mount financeRoutes ONLY, not v8Router aggregator.
// ============================================================================
describe('SMOKE-500: Finance /api/v8/finance', () => {
  it('GET /api/v8/finance/dashboard', async () => {
    const { requireV8OrgContext, attachV8Context } = await import(
      '../../server/src/middleware/v8Auth.middleware.js'
    );
    const app = await mountRouter('/api/v8/finance', '../../server/src/routes/v8/finance.routes.js', {
      extraMiddleware: [requireV8OrgContext as any, attachV8Context as any],
    });
    const r = await tryReq('GET /api/v8/finance/dashboard', () =>
      request(app).get('/api/v8/finance/dashboard').set('Authorization', `Bearer ${token}`)
    );
    RESULTS.push(r);
  }, 20_000);
});

// ============================================================================
// 6. Assessment family
// ============================================================================
describe('SMOKE-500: Assessment family', () => {
  it('GET /api/assessments/my-assessments (assessment-hub)', async () => {
    const app = await mountRouter(
      '/api/assessments',
      '../../server/src/routes/assessment/assessment-hub.routes.js'
    );
    const r = await tryReq('GET /api/assessments/my-assessments', () =>
      request(app).get('/api/assessments/my-assessments').set('Authorization', `Bearer ${token}`)
    );
    RESULTS.push(r);
  }, 20_000);

  it('GET /api/assessments/ (root list)', async () => {
    const app = await mountRouter(
      '/api/assessments',
      '../../server/src/routes/assessment/assessment-hub.routes.js'
    );
    const r = await tryReq('GET /api/assessments/', () =>
      request(app).get('/api/assessments/').set('Authorization', `Bearer ${token}`)
    );
    RESULTS.push(r);
  }, 20_000);
});

// ============================================================================
// 7. Interview list
// ============================================================================
describe('SMOKE-500: Interview /api/interview', () => {
  it('GET /api/interview/sessions (list)', async () => {
    const app = await mountRouter('/api/interview', '../../server/src/routes/interview.routes.js');
    const r = await tryReq('GET /api/interview/sessions', () =>
      request(app).get('/api/interview/sessions').set('Authorization', `Bearer ${token}`)
    );
    RESULTS.push(r);
  }, 20_000);
});

// ============================================================================
// 8. Reports
// ============================================================================
describe('SMOKE-500: Reports /api/reports', () => {
  it('GET /api/reports/executive-overview', async () => {
    const app = await mountRouter('/api/reports', '../../server/src/routes/reports.routes.js');
    const r = await tryReq('GET /api/reports/executive-overview', () =>
      request(app).get('/api/reports/executive-overview').set('Authorization', `Bearer ${token}`)
    );
    RESULTS.push(r);
  }, 20_000);
});

// ============================================================================
// 9. Admin-data
// ============================================================================
describe('SMOKE-500: Admin-data /api/admin-data', () => {
  it('GET /api/admin-data/user-tiers/:orgId', async () => {
    const app = await mountRouter('/api/admin-data', '../../server/src/routes/admin-data.routes.js');
    const { SEED } = await import('./seed.mjs');
    const r = await tryReq('GET /api/admin-data/user-tiers/:orgId', () =>
      request(app)
        .get(`/api/admin-data/user-tiers/${SEED.ORG_ID}`)
        .set('Authorization', `Bearer ${token}`)
    );
    RESULTS.push(r);
  }, 20_000);
});

// ============================================================================
// 10. My-Work (whole file — self-mounts sub-routers, not a lazy aggregator)
// ============================================================================
describe('SMOKE-500: My-Work /api/my-work', () => {
  it('GET /api/my-work/inbox', async () => {
    const app = await mountRouter('/api/my-work', '../../server/src/routes/my-work.routes.js');
    const r = await tryReq('GET /api/my-work/inbox', () =>
      request(app).get('/api/my-work/inbox').set('Authorization', `Bearer ${token}`)
    );
    RESULTS.push(r);
  }, 20_000);

  it('GET /api/my-work/tasks', async () => {
    const app = await mountRouter('/api/my-work', '../../server/src/routes/my-work.routes.js');
    const r = await tryReq('GET /api/my-work/tasks', () =>
      request(app).get('/api/my-work/tasks').set('Authorization', `Bearer ${token}`)
    );
    RESULTS.push(r);
  }, 20_000);

  it('GET /api/my-work/morning-brief', async () => {
    const app = await mountRouter('/api/my-work', '../../server/src/routes/my-work.routes.js');
    const r = await tryReq('GET /api/my-work/morning-brief', () =>
      request(app).get('/api/my-work/morning-brief').set('Authorization', `Bearer ${token}`)
    );
    RESULTS.push(r);
  }, 20_000);
});

// ============================================================================
// 11. Meeting
// ============================================================================
describe('SMOKE-500: Meeting /api/meeting', () => {
  it('GET /api/meeting/', async () => {
    const app = await mountRouter('/api/meeting', '../../server/src/routes/meeting.routes.js');
    const r = await tryReq('GET /api/meeting/', () =>
      request(app).get('/api/meeting/').set('Authorization', `Bearer ${token}`)
    );
    RESULTS.push(r);
  }, 20_000);
});

// ============================================================================
// 12. Audit (programs + events, both mounted at /api/audit)
// ============================================================================
describe('SMOKE-500: Audit /api/audit', () => {
  it('GET /api/audit/programs', async () => {
    const app = await mountRouter('/api/audit', '../../server/src/routes/audit-programs.routes.js');
    const r = await tryReq('GET /api/audit/programs', () =>
      request(app).get('/api/audit/programs').set('Authorization', `Bearer ${token}`)
    );
    RESULTS.push(r);
  }, 20_000);

  it('GET /api/audit/events', async () => {
    const app = await mountRouter('/api/audit', '../../server/src/routes/audit-events.routes.js');
    const r = await tryReq('GET /api/audit/events', () =>
      request(app).get('/api/audit/events').set('Authorization', `Bearer ${token}`)
    );
    RESULTS.push(r);
  }, 20_000);
});

// ============================================================================
// 13. Knowledge graph / knowledge base (Materiały)
// ============================================================================
describe('SMOKE-500: Materiały (knowledge-graph / kb)', () => {
  it('GET /api/knowledge-graph/entities', async () => {
    const app = await mountRouter('/api/knowledge-graph', '../../server/src/routes/knowledge-graph.routes.js');
    const r = await tryReq('GET /api/knowledge-graph/entities', () =>
      request(app).get('/api/knowledge-graph/entities').set('Authorization', `Bearer ${token}`)
    );
    RESULTS.push(r);
  }, 20_000);

  it('GET /api/kb/categories', async () => {
    const app = await mountRouter('/api/kb', '../../server/src/routes/knowledgeBase.routes.js');
    const r = await tryReq('GET /api/kb/categories', () =>
      request(app).get('/api/kb/categories').set('Authorization', `Bearer ${token}`)
    );
    RESULTS.push(r);
  }, 20_000);
});
