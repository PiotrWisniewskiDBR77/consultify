/**
 * O4-cluster — Oxford O4.1 (business case 5-phase) + O4.5 (WACC guidance)
 * LIVE E2E proof.
 *
 * `tests/acceptance/harvey.e2e.test.ts` already proves the route is REACHABLE
 * behind real auth+attachV8Context (400 on empty prompt) and that the
 * deterministic number-guardian (`checkNarrativeNumbers`) works — but its
 * full-generation case is `it.skip`'d with a docblock claiming the acceptance
 * DB's LLM provider registry (`llm_providers`/`llm_tier_assignments`/
 * `organization_provider_settings`) is not seeded on this parity container,
 * so PLAN phase gets an empty provider resolution and the route 502s.
 *
 * That claim no longer holds for the CURRENT parity container
 * (`consultify-parity-pg18` on :5443 — the pg16 dump was replaced 07-16,
 * see MEMORY finding_v8_flag_topology / odbior 07-16): a direct query shows
 * `llm_providers` HAS `priority`/`health_status` columns, `anthropic-parity-01`
 * is `is_active=true, is_default=true` with a real `api_key`, and
 * `llm_tier_assignments` has BUDGET/STANDARD/PREMIUM/REASONING/FREE rows all
 * pointing at it. This test un-skips the exact scenario to check whether the
 * infra gap is actually closed and O4.1/O4.5 can be proven end-to-end through
 * a REAL Anthropic call (no mocks) — not just route-reachability.
 *
 * Prefix for any DB rows this test writes: `odbior--o4c--` (evidence/agent
 * plan tables are NOT touched here — the business-case route itself performs
 * no persistence beyond the LLM call, mirroring harvey.e2e.test.ts FILAR 3).
 */
import express, { type Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { getJwtSecret, mintToken, pgClient, requireLocalDbUrl } from './harness';
import { seed } from './seed.mjs';

let app: Express;
let token: string;

describe('O4-cluster · O4.1/O4.5 Business Case LIVE generation (real router + auth + LLM)', () => {
  beforeAll(async () => {
    requireLocalDbUrl();
    process.env.JWT_SECRET = process.env.JWT_SECRET || getJwtSecret();
    process.env.RUN_DB_TESTS = '1';
    process.env.MOCK_DB = 'false';
    process.env.POSTGRES_SKIP_INIT_IN_TEST = 'true';

    await seed();

    const { verifyToken } = await import('../../server/src/middleware/auth.middleware.js');
    const { attachV8Context } = await import('../../server/src/middleware/v8Auth.middleware.js');
    const advisoryRouter = (await import('../../server/src/routes/v8/advisory.routes.js')).default;

    app = express();
    app.use(express.json({ limit: '5mb' }));
    app.use('/api/v8/advisory', verifyToken as any, attachV8Context as any, advisoryRouter);

    token = mintToken();
  }, 60_000);

  afterAll(async () => {
    // Nothing this test writes to the DB — advisory/business-case is a pure
    // compute+LLM route (no persistence). Nothing to clean up.
  });

  it(
    'POST /api/v8/advisory/business-case generates a REAL business case (NPV/ROI + narrative + WACC resolution) — no mock LLM',
    async () => {
      const res = await request(app)
        .post('/api/v8/advisory/business-case')
        .set('Authorization', `Bearer ${token}`)
        .send({
          prompt:
            'Rozważamy inwestycję 500 000 PLN w automatyzację linii pakującej. Spodziewane oszczędności ~200 000 PLN rocznie. Czy to się opłaca w horyzoncie 5 lat?',
          horizonYears: 5,
          waccPct: 14,
          currency: 'PLN',
          language: 'pl',
          sizeBand: 'mid',
        });

      // eslint-disable-next-line no-console
      console.log(
        '[o4c] business-case status',
        res.status,
        JSON.stringify(res.body).slice(0, 2000)
      );

      expect(res.status).toBe(200);
      const data = res.body?.data;
      expect(data).toBeTruthy();

      // O4.1 — deterministic NPV/ROI model, not fabricated by the LLM.
      expect(typeof data.model?.base?.npv).toBe('number');
      expect(Number.isFinite(data.model.base.npv)).toBe(true);
      expect(typeof data.model.base.roiPct).toBe('number');
      expect(Number.isFinite(data.model.base.roiPct)).toBe(true);

      // O4.1 — LLM narrative, grounded (guardian ran, consistent==true or
      // documents the specific unverified numbers — either way, PROOF the
      // guardian executed against a REAL narrative, not a stub).
      expect(typeof data.narrative).toBe('string');
      expect(data.narrative.length).toBeGreaterThan(50);
      expect(data.narrativeCheck).toBeTruthy();
      expect(typeof data.narrativeCheck.consistent).toBe('boolean');

      // O4.5 — WACC never invented by the LLM: client-supplied 14% must be
      // the resolved rate (resolveBusinessCaseWacc: client > guidance mid).
      expect(data.waccResolution?.waccPct).toBe(14);
      expect(data.waccResolution?.source).toBe('client');
    },
    180_000
  );
});
