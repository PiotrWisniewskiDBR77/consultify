/**
 * H6.4 — Standard fail-soft: sanity tests for the 3 handlers unified in this pass.
 *
 * Proves the degrade-not-crash contract from docs/standards/ERROR_HANDLING_STANDARD.md:
 *   - enrichment reads (smart-followup suggestions, pinned-insights list) degrade to
 *     200 + `degraded: true` with a safe empty default when the underlying subsystem
 *     (LLM pipeline / DB) throws — never a bare 500.
 *   - writes (pin/update/unpin, megatrend custom create/update) stay fail-closed:
 *     real 5xx, but with a stable `code` and WITHOUT leaking `err.message` to the client.
 *   - the megatrend read panel (baseline/radar/detail) also stays fail-closed (it is
 *     primary page content, not a side enrichment) but must carry a `code` and must not
 *     leak `err.message` either — that was the actual H6.4 violation on this file.
 *
 * Services are mocked (subsystem-down simulation) — this is a fast unit test, not the
 * tests/acceptance/ real-DB parity harness.
 */
import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: any) => {
    req.userId = 'test-user-id';
    req.organizationId = 'test-org-id';
    req.user = { id: 'test-user-id', organizationId: 'test-org-id' };
    next();
  },
}));

vi.mock('../../../../server/src/middleware/rateLimiting.middleware.js', () => ({
  aiRateLimiter: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../../../server/src/utils/Logger.js', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

afterEach(() => {
  vi.clearAllMocks();
});

// ============================================================================
// 1. smart-followup — content-generation enrichment ("podpowiedzi AI")
// ============================================================================
describe('POST /api/ai/smart-followup — fail-soft (H6.4)', () => {
  const generateSuggestions = vi.fn();

  beforeEach(() => {
    vi.doMock('../../../../server/src/services/ai/smartFollowupService.js', () => ({
      smartFollowupService: { setLLMClient: vi.fn(), generateSuggestions },
    }));
  });

  afterEach(() => vi.resetModules());

  async function loadApp() {
    const router = (await import('../../../../server/src/routes/ai/smart-followup.routes.ts'))
      .default;
    const app = express();
    app.use(express.json());
    app.use('/api/ai/smart-followup', router);
    return app;
  }

  it('degrades to 200 + empty suggestions when the LLM/service subsystem throws (no 500)', async () => {
    generateSuggestions.mockRejectedValue(new Error('AIPipeline: provider timeout'));
    const app = await loadApp();

    const res = await request(app)
      .post('/api/ai/smart-followup')
      .send({ question: 'q', response: 'a'.repeat(60) });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ suggestions: [], degraded: true });
    // No leak of the raw error message anywhere in the body.
    expect(JSON.stringify(res.body)).not.toContain('provider timeout');
  });

  it('returns the real suggestions on the happy path (contract unchanged)', async () => {
    generateSuggestions.mockResolvedValue([
      { text: 'Next step?', type: 'action', confidence: 0.6 },
    ]);
    const app = await loadApp();

    const res = await request(app)
      .post('/api/ai/smart-followup')
      .send({ question: 'q', response: 'a'.repeat(60) });

    expect(res.status).toBe(200);
    expect(res.body.suggestions).toHaveLength(1);
    expect(res.body.degraded).toBeUndefined();
  });
});

// ============================================================================
// 2. pinned-insights — GET (side panel) fail-soft; POST/PATCH/DELETE fail-closed
// ============================================================================
describe('/api/ai/pinned-insights — fail-soft read + fail-closed writes (H6.4)', () => {
  const pinInsight = vi.fn();
  const listInsights = vi.fn();
  const updateInsight = vi.fn();
  const unpinInsight = vi.fn();

  beforeEach(() => {
    vi.doMock('../../../../server/src/services/ai/pinnedInsightsService.js', () => ({
      pinnedInsightsService: { pinInsight, listInsights, updateInsight, unpinInsight },
    }));
  });

  afterEach(() => vi.resetModules());

  async function loadApp() {
    const router = (await import('../../../../server/src/routes/ai/pinned-insights.routes.ts'))
      .default;
    const app = express();
    app.use(express.json());
    app.use('/api/ai/pinned-insights', router);
    return app;
  }

  it('GET degrades to 200 + empty list when the DB subsystem throws (no 500)', async () => {
    listInsights.mockRejectedValue(new Error('relation "pinned_insights" does not exist'));
    const app = await loadApp();

    const res = await request(app).get('/api/ai/pinned-insights');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ insights: [], total: 0, degraded: true });
    expect(JSON.stringify(res.body)).not.toContain('does not exist');
  });

  it('GET returns real data on the happy path (contract unchanged)', async () => {
    listInsights.mockResolvedValue([{ id: 'i1' }]);
    const app = await loadApp();

    const res = await request(app).get('/api/ai/pinned-insights');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ insights: [{ id: 'i1' }], total: 1 });
  });

  it('POST (write) stays fail-closed: 500 + code, no err.message leak', async () => {
    pinInsight.mockRejectedValue(new Error('insert failed: constraint violation xyz'));
    const app = await loadApp();

    const res = await request(app)
      .post('/api/ai/pinned-insights')
      .send({ content: 'insight text' });

    expect(res.status).toBe(500);
    expect(res.body.code).toBe('PINNED_INSIGHTS_PIN_FAILED');
    expect(JSON.stringify(res.body)).not.toContain('constraint violation xyz');
  });

  it('DELETE (write) stays fail-closed: 500 + code, no err.message leak', async () => {
    unpinInsight.mockRejectedValue(new Error('db unreachable at 10.0.0.5'));
    const app = await loadApp();

    const res = await request(app).delete(
      '/api/ai/pinned-insights/11111111-1111-4111-8111-111111111111'
    );

    expect(res.status).toBe(500);
    expect(res.body.code).toBe('PINNED_INSIGHTS_UNPIN_FAILED');
    expect(JSON.stringify(res.body)).not.toContain('10.0.0.5');
  });
});

// ============================================================================
// 3. megatrend — GET panel reads stay fail-closed (primary content, not enrichment)
//    but must carry a code and must not leak err.message (the actual H6.4 violation).
// ============================================================================
describe('/api/megatrends — fail-closed reads + writes carry code, no message leak (H6.4)', () => {
  const getBaselineTrends = vi.fn();
  const getRadarData = vi.fn();
  const getTrendDetail = vi.fn();
  const createCustomTrend = vi.fn();

  beforeEach(() => {
    vi.doMock('../../../../server/src/models/megatrend.js', () => ({
      default: { getBaselineTrends, getRadarData, getTrendDetail, createCustomTrend },
    }));
  });

  afterEach(() => vi.resetModules());

  async function loadApp() {
    const router = (await import('../../../../server/src/routes/megatrend.routes.ts')).default;
    const app = express();
    app.use(express.json());
    app.use('/api/megatrends', router);
    return app;
  }

  it('GET /baseline: unexpected error -> 500 + code, no err.message leak', async () => {
    getBaselineTrends.mockRejectedValue(new Error('ECONNREFUSED 127.0.0.1:5432'));
    const app = await loadApp();

    const res = await request(app).get('/api/megatrends/baseline');

    expect(res.status).toBe(500);
    expect(res.body.code).toBe('MEGATREND_BASELINE_FAILED');
    expect(JSON.stringify(res.body)).not.toContain('ECONNREFUSED');
  });

  it('GET /radar: unexpected error -> 500 + code, no err.message leak', async () => {
    getRadarData.mockRejectedValue(new Error('ECONNREFUSED 127.0.0.1:5432'));
    const app = await loadApp();

    const res = await request(app).get('/api/megatrends/radar');

    expect(res.status).toBe(500);
    expect(res.body.code).toBe('MEGATREND_RADAR_FAILED');
    expect(JSON.stringify(res.body)).not.toContain('ECONNREFUSED');
  });

  it('POST /custom (write): unexpected error -> 500 + code, no err.message leak', async () => {
    createCustomTrend.mockRejectedValue(new Error('duplicate key value violates unique xyz'));
    const app = await loadApp();

    const res = await request(app)
      .post('/api/megatrends/custom')
      .send({ label: 'Custom trend' });

    expect(res.status).toBe(500);
    expect(res.body.code).toBe('MEGATREND_CUSTOM_CREATE_FAILED');
    expect(JSON.stringify(res.body)).not.toContain('duplicate key');
  });

  it('GET /baseline happy path unchanged', async () => {
    getBaselineTrends.mockResolvedValue([{ id: 't1' }]);
    const app = await loadApp();

    const res = await request(app).get('/api/megatrends/baseline');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ id: 't1' }]);
  });
});
