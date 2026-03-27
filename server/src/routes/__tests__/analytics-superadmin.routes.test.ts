import { beforeEach, describe, expect, it, vi } from 'vitest';

const getPublicAnnaFunnelSummary = vi.fn();

vi.mock('../../middleware/auth.middleware.js', () => ({
  verifyToken: (_req: any, _res: any, next: () => void) => next(),
  requireSuperAdmin: (_req: any, _res: any, next: () => void) => next(),
}));

vi.mock('../../middleware/rateLimiting.middleware.js', () => ({
  defaultRateLimiter: (_req: any, _res: any, next: () => void) => next(),
}));

vi.mock('../../services/annaAnalyticsService.js', () => ({
  getPublicAnnaFunnelSummary,
}));

vi.mock('../../utils/DbPromise.js', () => ({
  all: vi.fn(),
  get: vi.fn(),
  run: vi.fn(),
}));

vi.mock('../../utils/Logger.js', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

function createMockReq(overrides: Record<string, unknown> = {}): any {
  return {
    params: {},
    body: {},
    query: {},
    user: { id: 'superadmin-1' },
    ...overrides,
  };
}

function createMockRes(): any {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

async function importRouter() {
  const mod = await import('../../routes/analytics-superadmin.routes.js');
  return mod.default;
}

describe('Analytics Superadmin Routes — Anna funnel summary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET /anna-funnel returns the bounded public Anna summary', async () => {
    getPublicAnnaFunnelSummary.mockResolvedValue({
      summary: {
        totalEvents: 4,
        byEvent: {
          landing_anna_widget_opened: 2,
          landing_anna_handoff_clicked: 2,
        },
        localeDistribution: { en: 3, pl: 1 },
        fallbackReasons: {},
        handoffTargets: { demo: 2 },
      },
      recentEvents: [
        {
          id: 'anna-event-1',
          eventType: 'landing_anna_handoff_clicked',
          source: 'landing_anna',
          metadata: { target: 'demo', locale: 'en' },
          createdAt: '2026-03-27T00:00:00.000Z',
        },
      ],
    });

    const router = await importRouter();
    const layer = router.stack.find(
      (entry: any) => entry.route?.path === '/anna-funnel' && entry.route?.methods?.get
    );
    expect(layer).toBeDefined();

    const req = createMockReq();
    const res = createMockRes();
    const handlers = layer!.route!.stack;
    await handlers[handlers.length - 1].handle(req, res, vi.fn());

    expect(getPublicAnnaFunnelSummary).toHaveBeenCalledWith(30);
    expect(res.json).toHaveBeenCalledWith({
      summary: {
        totalEvents: 4,
        byEvent: {
          landing_anna_widget_opened: 2,
          landing_anna_handoff_clicked: 2,
        },
        localeDistribution: { en: 3, pl: 1 },
        fallbackReasons: {},
        handoffTargets: { demo: 2 },
      },
      recentEvents: [
        {
          id: 'anna-event-1',
          eventType: 'landing_anna_handoff_clicked',
          source: 'landing_anna',
          metadata: { target: 'demo', locale: 'en' },
          createdAt: '2026-03-27T00:00:00.000Z',
        },
      ],
    });
  });
});
