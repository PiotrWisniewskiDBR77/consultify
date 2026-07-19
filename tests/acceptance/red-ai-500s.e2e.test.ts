/**
 * RED-AI-500s — schema-500 sweep for the AI routers rewir (ŁOWCA RED, 2026-07-19).
 *
 * Rewir: server/src/routes/ai/* + chat-projects / v10-teresa / agents.
 * Excluded (already fixed in W4): smart-followup.routes.ts, pinned-insights.routes.ts.
 *
 * Pattern: 1:1 with red-assess-500s / smoke-500 — REAL router + REAL verifyToken +
 * REAL local Postgres (parity :5443). Each request classified by HTTP status +
 * (if 5xx) Postgres error code.
 *
 * Seed prefix: odbior--redai-- (reversible, cleaned in afterAll).
 *
 * FIXED here (additive migration 20260719_red_ai_audit_logs_success_columns.sql):
 *   ai_audit_logs was missing `success` + `metadata_json` — columns the
 *   AITrainingController itself writes and reads. GET /api/ai/training/stats
 *   (and the POST submitFeedback write-path) 500'd on 42703. Migration adds the
 *   two columns; these endpoints are asserted < 500 below.
 *
 * KNOWN_RED (confirmed real 500s, OUT of safe-additive-migration scope — code
 * bugs, see RAPORT RED in the handoff): ai_request_log missing table + SQLite
 * date funcs (6 ai-operations endpoints), deep-thinking/metrics SQLite-isms,
 * ai_playbook_runs untyped `$2 IS NULL` param (42P18). Pinned so a change here
 * is a visible signal, not silent scope creep.
 */
import { appendFileSync, writeFileSync } from 'node:fs';

import express, { type Express } from 'express';
import pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { mintToken, requireLocalDbUrl } from './harness.js';
import { seed, SEED } from './seed.mjs';

const RESULTS_FILE = process.env.REDAI_RESULTS_FILE || '/tmp/red-ai-results.log';
writeFileSync(RESULTS_FILE, '');
const evidence = (line: string) => appendFileSync(RESULTS_FILE, line + '\n');

const PROJECT_ID = 'odbior--redai--project-0001';
const ASSESSMENT_ID = 'odbior--redai--assessment-0001';

/**
 * KNOWN RED — confirmed real 500s (parity pg18, 2026-07-19) that are OUT of the
 * safe additive-migration lane (missing table + SQLite date functions, or an
 * untyped bind param — all require a code rewrite, not an additive column).
 * Do NOT add entries without a matching RAPORT RED writeup.
 */
const KNOWN_RED: Record<string, { status: number; messageIncludes: string }> = {
  // ai-operations: all query `FROM ai_request_log` (relation missing) AND use
  // SQLite `datetime('now', …)` — creating the table alone will NOT fix them
  // (42883 on datetime). DbPromise fallback masks the SQL error into null →
  // controller null-derefs → HTTP 500.
  ['GET /api/ai/operations/mission-control/status']: { status: 500, messageIncludes: 'total' },
  ['GET /api/ai/operations/performance/metrics']: { status: 500, messageIncludes: 'total_requests' },
  ['GET /api/ai/operations/costs/summary']: { status: 500, messageIncludes: 'total_tokens' },
  ['GET /api/ai/operations/sla/status']: { status: 500, messageIncludes: 'total' },
  ['GET /api/ai/operations/analytics/insights']: { status: 500, messageIncludes: 'rate' },
  ['GET /api/ai/operations/summary']: { status: 500, messageIncludes: 'requests_today' },
  // aiPlaybooks.getRuns: `WHERE apr.organization_id = $1 OR $2 IS NULL` — $2 has
  // no inferable type → 42P18. (Dead-logic smell: $2 is bound the same org value.)
  ['GET /api/ai/playbooks/runs']: { status: 500, messageIncludes: 'could not determine data type' },
  // deep-thinking/metrics: SQLite-isms json_extract() + datetime() + `= 1` on
  // jsonb-text → "operator does not exist: text = integer". Raw 500, empty body.
  ['GET /api/ai/deep-thinking/metrics']: { status: 500, messageIncludes: '' },
};

function assertNotRegressed(r: { label: string; status: number | 'HANG'; body?: any }) {
  const known = KNOWN_RED[r.label];
  if (known) {
    expect(r.status, `${r.label} — expected pinned KNOWN RED status`).toBe(known.status);
    if (known.messageIncludes) {
      expect(JSON.stringify(r.body || ''), `${r.label} — KNOWN RED message drifted`).toContain(
        known.messageIncludes
      );
    }
    return;
  }
  expect(r.status, `${r.label} — NEW regression (not in KNOWN_RED)`).not.toBe('HANG');
  expect(
    typeof r.status === 'number' ? r.status : 999,
    `${r.label} — NEW regression: ${JSON.stringify(r.body)}`
  ).toBeLessThan(500);
}

let token: string;

async function seedRedAiFixtures(): Promise<void> {
  const client = new pg.Client({ connectionString: requireLocalDbUrl() });
  await client.connect();
  try {
    const now = new Date().toISOString();
    await client.query(
      `INSERT INTO projects (id, organization_id, name, status, owner_id, created_at)
       VALUES ($1,$2,'RED-AI Harness Project','active',$3,$4) ON CONFLICT (id) DO NOTHING`,
      [PROJECT_ID, SEED.ORG_ID, SEED.USER_ID, now]
    );
    await client.query(
      `INSERT INTO assessments (id, organization_id, project_id, status, name, created_at, updated_at, created_by)
       VALUES ($1,$2,$3,'DRAFT','RED-AI Harness Assessment',$4,$4,$5) ON CONFLICT (id) DO NOTHING`,
      [ASSESSMENT_ID, SEED.ORG_ID, PROJECT_ID, now, SEED.USER_ID]
    );
    evidence('[seed] red-ai fixtures OK');
  } catch (e: any) {
    evidence(`[seed] red-ai fixtures FAILED: ${e?.message || e}`);
  } finally {
    await client.end();
  }
}

async function cleanupRedAiFixtures(): Promise<void> {
  const client = new pg.Client({ connectionString: requireLocalDbUrl() });
  await client.connect();
  try {
    // Remove any feedback rows the training write-path assertion created.
    await client.query(`DELETE FROM ai_audit_logs WHERE action_type LIKE 'odbior--redai--%'`).catch(() => {});
    await client.query(`DELETE FROM assessments WHERE id = $1`, [ASSESSMENT_ID]).catch(() => {});
    await client.query(`DELETE FROM projects WHERE id = $1`, [PROJECT_ID]).catch(() => {});
  } finally {
    await client.end();
  }
}

async function mountRouter(prefix: string, routerImportPath: string): Promise<Express> {
  const { default: verifyToken } = await import('../../server/src/middleware/auth.middleware.js');
  const { default: router } = await import(routerImportPath);
  const app = express();
  app.use(express.json({ limit: '5mb' }));
  app.use(prefix, verifyToken as any, router);
  return app;
}

async function tryReq(
  label: string,
  fn: () => Promise<{ status: number; body: any; text?: string }>
): Promise<{ label: string; status: number | 'HANG'; body?: any }> {
  try {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('TIMEOUT_10s')), 10_000)
    );
    const res = await Promise.race([fn(), timeout]);
    const out = { label, status: res.status, body: res.body };
    evidence(`LIVE ${String(out.status).padEnd(6)} ${label}  ${JSON.stringify(res.body).slice(0, 300)}`);
    return out;
  } catch (e: any) {
    evidence(`LIVE HANG   ${label}  ${String(e?.message)}`);
    return { label, status: 'HANG' as const };
  }
}

const RESULTS: Array<{ label: string; status: number | 'HANG'; body?: any }> = [];

beforeAll(async () => {
  await seed();
  await seedRedAiFixtures();
  token = mintToken();
}, 60_000);

afterAll(async () => {
  evidence('===== RED-AI-500 SUMMARY =====');
  const fail = RESULTS.filter((r) => r.status === 'HANG' || (typeof r.status === 'number' && r.status >= 500));
  for (const r of RESULTS) evidence(`${String(r.status).padEnd(6)} ${r.label}`);
  evidence(`===== END: ${fail.length} still-5xx (pinned KNOWN_RED) of ${RESULTS.length} total =====`);
  await cleanupRedAiFixtures();
}, 30_000);

function sweepGet(describeLabel: string, prefix: string, routerPath: string, paths: string[]) {
  describe(describeLabel, () => {
    for (const p of paths) {
      it(`GET ${prefix}${p}`, async () => {
        const app = await mountRouter(prefix, routerPath);
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
// FIXED — ai-training (additive migration adds ai_audit_logs.success + metadata_json)
// ============================================================================
sweepGet('RED-AI FIXED: ai-training reads', '/api/ai/training', '../../server/src/routes/ai/ai-training.routes.js', [
  '/stats',
  '/',
  '/?helpful=true',
]);

describe('RED-AI FIXED: ai-training submitFeedback write-path (was latent 42703)', () => {
  it('POST /api/ai/training', async () => {
    const app = await mountRouter('/api/ai/training', '../../server/src/routes/ai/ai-training.routes.js');
    const r = await tryReq('POST /api/ai/training', () =>
      request(app)
        .post('/api/ai/training')
        .set('Authorization', `Bearer ${token}`)
        .send({ helpful: true, context: 'odbior--redai--fb', response: 'ok' })
    );
    RESULTS.push({ ...r, label: 'POST /api/ai/training' });
    // Not in KNOWN_RED → must be < 500.
    assertNotRegressed({ label: 'POST /api/ai/training', status: r.status, body: r.body });
  }, 20_000);
});

// ============================================================================
// KNOWN_RED — ai-operations (ai_request_log missing table + SQLite datetime())
// ============================================================================
sweepGet('RED-AI KNOWN_RED: ai-operations', '/api/ai/operations', '../../server/src/routes/ai/ai-operations.routes.js', [
  '/mission-control/status',
  '/performance/metrics',
  '/costs/summary',
  '/sla/status',
  '/analytics/insights',
  '/summary',
]);

// ============================================================================
// KNOWN_RED — playbooks getRuns (42P18) + deep-thinking metrics (SQLite-isms)
// ============================================================================
sweepGet('RED-AI KNOWN_RED: playbooks runs', '/api/ai/playbooks', '../../server/src/routes/ai/aiPlaybooks.routes.js', [
  '/runs',
]);

sweepGet('RED-AI KNOWN_RED: deep-thinking metrics', '/api/ai/deep-thinking', '../../server/src/routes/ai/deep-thinking.routes.js', [
  '/metrics',
]);
