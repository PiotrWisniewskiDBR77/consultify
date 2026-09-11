/**
 * Module 04 (Narzędzia) — Megatrend route tests.
 *
 * Verifies the baseline route returns 200 with data when the service is present,
 * and a clean 503 with a user-facing message when the data is unavailable.
 * DB/model and auth are mocked.
 */
import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetBaselineTrends = vi.fn();
const mockGetRadarData = vi.fn();
const mockGetTrendDetail = vi.fn();
const mockCreateCustomTrend = vi.fn();
const mockUpdateCustomTrend = vi.fn();

// The startup service statically imports and validates every required model export.
vi.mock('../../models/megatrend.js', () => ({
  default: {
    getBaselineTrends: (...args: unknown[]) => mockGetBaselineTrends(...args),
    getRadarData: (...args: unknown[]) => mockGetRadarData(...args),
    getTrendDetail: (...args: unknown[]) => mockGetTrendDetail(...args),
    createCustomTrend: (...args: unknown[]) => mockCreateCustomTrend(...args),
    updateCustomTrend: (...args: unknown[]) => mockUpdateCustomTrend(...args),
  },
  getBaselineTrends: (...args: unknown[]) => mockGetBaselineTrends(...args),
  getRadarData: (...args: unknown[]) => mockGetRadarData(...args),
  getTrendDetail: (...args: unknown[]) => mockGetTrendDetail(...args),
  createCustomTrend: (...args: unknown[]) => mockCreateCustomTrend(...args),
  updateCustomTrend: (...args: unknown[]) => mockUpdateCustomTrend(...args),
}));

vi.mock('../../middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: () => void) => {
    req.user = { id: 'u-1', organizationId: 'org-1' };
    next();
  },
}));

vi.mock('../../middleware/rateLimiting.middleware.js', () => ({
  apiAuthRateLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

const megatrendRoutes = (await import('../megatrend.routes.js')).default;

function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/megatrends', megatrendRoutes);
  return app;
}

beforeEach(() => {
  mockGetBaselineTrends.mockReset();
});

describe('GET /api/megatrends/baseline', () => {
  it('returns 200 with the baseline trends when the service is present', async () => {
    mockGetBaselineTrends.mockResolvedValue([
      { id: 'mg-1', label: 'Industrial AI', type: 'Technology', initialRing: 'Now' },
    ]);

    const res = await request(createApp()).get('/api/megatrends/baseline?industry=Manufacturing');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0].label).toBe('Industrial AI');
  });

  it('returns a clean 503 with a userMessage when data is unavailable', async () => {
    const err: any = new Error('Megatrends data unavailable');
    err.statusCode = 503;
    err.code = 'FEATURE_UNAVAILABLE';
    mockGetBaselineTrends.mockRejectedValue(err);

    const res = await request(createApp()).get('/api/megatrends/baseline');

    expect(res.status).toBe(503);
    expect(res.body.type).toBe('not_configured');
    expect(res.body.userMessage).toMatch(/not yet configured/i);
  });
});
