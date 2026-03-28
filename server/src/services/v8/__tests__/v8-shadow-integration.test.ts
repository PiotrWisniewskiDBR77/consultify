import express from 'express';
import supertest from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockRecordShadowComparison = vi.fn().mockResolvedValue(undefined);
const mockIsV8ShadowMode = vi.fn().mockResolvedValue(true);

vi.mock('../../../services/v8/shadowModeService.js', () => ({
  recordShadowComparison: (...args: unknown[]) => mockRecordShadowComparison(...args),
}));

vi.mock('../../../services/v8/featureFlagService.js', () => ({
  isV8ShadowMode: (...args: unknown[]) => mockIsV8ShadowMode(...args),
  isV8Enabled: vi.fn().mockResolvedValue(true),
  getOrgFlags: vi.fn().mockResolvedValue({}),
}));

vi.mock('../../../utils/Logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { v8ShadowInterceptor } from '../../../middleware/v8ShadowInterceptor.middleware.js';
import { v8ShadowModeCheck } from '../../../middleware/v8ShadowModeCheck.middleware.js';

const originalFetch = globalThis.fetch;

function createTestApp() {
  const app = express();
  app.use(express.json());

  // Simulate auth middleware
  app.use((req: any, _res, next) => {
    req.userId = 'test-user';
    req.organizationId = 'test-org';
    next();
  });

  // Shadow mode check + interceptor on /api/ai
  app.use('/api/ai', v8ShadowModeCheck, v8ShadowInterceptor);

  // Legacy AI context endpoint
  app.get('/api/ai/context', (_req, res) => {
    res.json({ context: 'legacy-ai-context', modules: ['chat', 'tools'] });
  });

  return app;
}

describe('CP-25: Shadow Mode Integration — full interceptor flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsV8ShadowMode.mockResolvedValue(true);

    // Mock fetch for the V8 internal call
    globalThis.fetch = vi.fn().mockResolvedValue({
      status: 200,
      json: () => Promise.resolve({ data: { status: 'active' }, meta: { version: 'v8' } }),
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('records shadow comparison when shadow mode is active and route is mapped', async () => {
    const app = createTestApp();

    const res = await supertest(app)
      .get('/api/ai/context')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ context: 'legacy-ai-context', modules: ['chat', 'tools'] });

    // Give the fire-and-forget call time to complete
    await new Promise((r) => setTimeout(r, 1000));

    expect(mockRecordShadowComparison).toHaveBeenCalledTimes(1);
    const callArgs = mockRecordShadowComparison.mock.calls[0][0];
    expect(callArgs.organizationId).toBe('test-org');
    expect(callArgs.endpoint).toBe('/context');
    expect(callArgs.method).toBe('GET');
    expect(callArgs.legacyStatusCode).toBe(200);
    expect(callArgs.v8StatusCode).toBe(200);
  });

  it('does not record comparison when shadow mode is off', async () => {
    mockIsV8ShadowMode.mockResolvedValue(false);
    const app = createTestApp();

    const res = await supertest(app)
      .get('/api/ai/context')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);

    await new Promise((r) => setTimeout(r, 300));

    expect(mockRecordShadowComparison).not.toHaveBeenCalled();
  });

  it('does not affect legacy response even if V8 fetch fails', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('Connection refused')
    );
    const app = createTestApp();

    const res = await supertest(app)
      .get('/api/ai/context')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);
    expect(res.body.context).toBe('legacy-ai-context');

    await new Promise((r) => setTimeout(r, 500));

    // Should still record the comparison (with error status)
    expect(mockRecordShadowComparison).toHaveBeenCalledTimes(1);
    const callArgs = mockRecordShadowComparison.mock.calls[0][0];
    expect(callArgs.v8StatusCode).toBe(500);
  });

  it('does not intercept unmapped routes', async () => {
    const app = createTestApp();
    app.get('/api/ai/other', (_req, res) => {
      res.json({ data: 'other' });
    });

    const res = await supertest(app).get('/api/ai/other').set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);

    await new Promise((r) => setTimeout(r, 300));

    expect(mockRecordShadowComparison).not.toHaveBeenCalled();
  });

  it('legacy response body is not modified by shadow interceptor', async () => {
    const app = createTestApp();

    const res = await supertest(app)
      .get('/api/ai/context')
      .set('Authorization', 'Bearer test-token');

    expect(res.body).toStrictEqual({ context: 'legacy-ai-context', modules: ['chat', 'tools'] });
  });
});
