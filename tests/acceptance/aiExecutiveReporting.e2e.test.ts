/**
 * Acceptance: AI Executive Reporting — real LLM enhancement (REJESTR T7b-3/4).
 *
 * `aiExecutiveReporting.ts` used to be a self-import wrapper
 * (`import service from './aiExecutiveReporting.js'` inside itself — resolves to itself
 * under tsx's extensionless resolution, so `service` was always undefined at runtime).
 * managementReportsService.generateAiNarrative() dynamic-imports it and fails soft on any
 * throw, so the phantom implementation was invisible: every "AI-enhanced" report silently
 * became the plain mechanical summary. No LLM mocking anywhere in this file — proving the
 * fix means proving a real model call happens and returns a grounded narrative.
 *
 * Two tests, two different things proven:
 *  1. Service-level, rich input: aiExecutiveReporting.generateReport() is called directly
 *     with a multi-fact summary. Proves genuine LLM transformation (the output must differ
 *     from the input) — a real model call, tier STANDARD, Anthropic.
 *  2. HTTP+DB, real pipeline: exercises the REAL `/api/management-reports/generate` router
 *     behind REAL auth, all the way to Postgres persistence. Proves the wiring
 *     (managementReportsService -> aiExecutiveReporting -> llmService -> DB) is intact
 *     end-to-end, not just the isolated function.
 *
 * Costs two real Anthropic calls per run — deliberate, per REJESTR instruction
 * ("mock LLM niedozwolony — realny call 1×" per surface tested).
 */
import express, { type Express } from 'express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';

import { mintToken, pgClient } from './harness.js';
import { SEED, seed } from './seed.mjs';

/**
 * Builds an Express app mounting the REAL management-reports router.
 * Mirrors the Gateway.ts mount: app.use('/api/management-reports', managementReportsRoutes).
 * verifyToken + demoContextMiddleware are applied INSIDE the router itself
 * (see server/src/routes/managementReports.routes.ts: `router.use(verifyToken)`),
 * so real auth is exercised here exactly as in production.
 */
async function buildManagementReportsApp(): Promise<Express> {
  const managementReportsRouter = (
    await import('../../server/src/routes/managementReports.routes.js')
  ).default;

  const app = express();
  app.use(express.json({ limit: '5mb' }));
  app.use('/api/management-reports', managementReportsRouter as unknown as express.RequestHandler);
  return app;
}

let app: Express;
let token: string;

beforeAll(async () => {
  await seed(); // idempotent — safe if runner already seeded
  app = await buildManagementReportsApp();
  token = mintToken();
}, 60_000);

const createdReportIds: string[] = [];

afterAll(async () => {
  if (createdReportIds.length === 0) return;
  const client = pgClient();
  await client.connect();
  try {
    // ON DELETE CASCADE on management_report_versions / management_report_audit_log
    // handles the child rows.
    await client.query('DELETE FROM management_reports WHERE id = ANY($1)', [createdReportIds]);
  } finally {
    await client.end();
  }
});

describe('Acceptance: AI-enhanced executive report (real runtime, real LLM)', () => {
  it(
    'odbior--t7b3--aiExecutiveReporting.generateReport() genuinely transforms a grounded summary',
    async () => {
      const { default: aiExecutiveReporting } = await import(
        '../../server/src/services/aiExecutiveReporting.js'
      );

      const summary =
        'Portfel odbior--t7b3-- Q3: 4 initiatives on track, 1 at risk (budget overrun 12%), ' +
        '2 decisions pending board approval, next milestone due in 9 days.';

      const result = await aiExecutiveReporting.generateReport({
        type: 'STEERING_COMMITTEE',
        scope: 'PORTFOLIO',
        summary,
      });

      // No fallback warnings — proves the real LLM call succeeded (not the fail-soft catch,
      // not the old always-undefined self-import).
      expect(result.warnings).toEqual([]);

      // Genuine transformation: the model must have rephrased/synthesized, not echoed the
      // input verbatim — proves an actual model call happened, not a passthrough shortcut.
      expect(typeof result.narrative).toBe('string');
      expect(result.narrative.trim().length).toBeGreaterThan(0);
      expect(result.narrative.trim()).not.toBe(summary);

      // Grounding check: the model was told to use ONLY the numbers given — the concrete
      // budget-overrun fact should still be traceable in its narrative (allow digit or
      // spelled-out form — "4"/"four" — since prose rewrites legitimately do either).
      expect(result.narrative).toMatch(/4|four/i);
      expect(result.narrative).toMatch(/12%|12 ?percent/i);
    },
    60_000
  );

  it(
    'odbior--t7b3--generates a STEERING_COMMITTEE/PORTFOLIO report end-to-end and persists the AI narrative',
    async () => {
      // reportType/scope choice is deliberate and NOT arbitrary:
      //  - STEERING_COMMITTEE is one of only two values the live `management_reports`
      //    CHECK constraint (management_reports_report_type_check) currently allows
      //    (ARRAY['TEAM_MEETING','STEERING_COMMITTEE']) — PORTFOLIO_HEALTH/RAID/TEAM_WEEKLY
      //    all 500 on INSERT against the real parity schema. That CHECK-constraint drift
      //    (service supports 5 report types, DB schema allows 2) is a pre-existing,
      //    UNRELATED bug — out of scope for T7b-3/4, left as-is, flagged in the handoff.
      //  - scope=PORTFOLIO skips the per-project task-metrics query
      //    (managementReportRepository.getBasicTaskMetrics), which independently 500s on
      //    the shared parity DB because `tasks.progress` is TEXT there and the query does
      //    `AVG(progress)` — also pre-existing/unrelated, avoided rather than fixed here.
      const res = await request(app)
        .post('/api/management-reports/generate')
        .set('Authorization', `Bearer ${token}`)
        .send({
          reportType: 'STEERING_COMMITTEE',
          scope: 'PORTFOLIO',
          organizationId: SEED.ORG_ID,
          aiEnhancement: true,
        });

      expect(res.status).toBe(200);
      expect(res.body?.success).toBe(true);

      const report = res.body?.report;
      expect(report?.id).toBeTruthy();
      createdReportIds.push(report.id);

      // No fallback warnings — proves the real LLM call succeeded (not caught by
      // aiExecutiveReporting's fail-soft catch block, and not the empty-registry gap).
      expect(report.aiWarnings).toEqual([]);
      expect(typeof report.aiNarrative).toBe('string');
      expect(report.aiNarrative.trim().length).toBeGreaterThan(0);

      // Hard proof of persistence — read the row straight from Postgres.
      const client = pgClient();
      await client.connect();
      try {
        const { rows } = await client.query(
          `SELECT ai_narrative, ai_warnings, organization_id, report_type
           FROM management_reports WHERE id = $1`,
          [report.id]
        );
        expect(rows).toHaveLength(1);
        expect(rows[0].organization_id).toBe(SEED.ORG_ID);
        expect(rows[0].report_type).toBe('STEERING_COMMITTEE');
        expect(rows[0].ai_narrative).toBe(report.aiNarrative);
        expect(JSON.parse(rows[0].ai_warnings || '[]')).toEqual([]);
      } finally {
        await client.end();
      }
    },
    60_000
  );
});
