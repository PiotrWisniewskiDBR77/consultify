import { beforeEach, describe, expect, it, vi } from 'vitest';

const getPublicAnnaFunnelSummary = vi.fn();
const dbAll = vi.fn();
const dbGet = vi.fn();
const dbRun = vi.fn();

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
  all: dbAll,
  get: dbGet,
  run: dbRun,
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

describe('Analytics Superadmin Routes — degraded failures are explicit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET /dashboards returns 500 with degraded payload when the query fails', async () => {
    dbAll.mockRejectedValueOnce(new Error('db down'));

    const router = await importRouter();
    const layer = router.stack.find(
      (entry: any) => entry.route?.path === '/dashboards' && entry.route?.methods?.get
    );
    expect(layer).toBeDefined();

    const req = createMockReq();
    const res = createMockRes();
    const handlers = layer!.route!.stack;
    await handlers[handlers.length - 1].handle(req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Failed to fetch dashboards',
      degraded: true,
      dashboards: [],
    });
  });
});

describe('Analytics Superadmin Routes — report executions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET /executions returns recent executions across reports', async () => {
    dbAll.mockResolvedValueOnce([
      {
        id: 'exec-1',
        report_id: 'report-1',
        report_name: 'Weekly Metrics',
        report_type: 'system',
      },
    ]);

    const router = await importRouter();
    const layer = router.stack.find(
      (entry: any) => entry.route?.path === '/executions' && entry.route?.methods?.get
    );
    expect(layer).toBeDefined();

    const req = createMockReq({ query: { limit: '25' } });
    const res = createMockRes();
    const handlers = layer!.route!.stack;
    await handlers[handlers.length - 1].handle(req, res, vi.fn());

    expect(dbAll).toHaveBeenCalledWith(
      expect.stringContaining('analytics_report_executions'),
      [25]
    );
    expect(res.json).toHaveBeenCalledWith({
      executions: [
        {
          id: 'exec-1',
          report_id: 'report-1',
          report_name: 'Weekly Metrics',
          report_type: 'system',
        },
      ],
    });
  });
});

describe('Analytics Superadmin Routes — deterministic predictions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('POST /models/:id/predict projects revenue without random growth', async () => {
    dbGet.mockResolvedValueOnce({ id: 'model-1', model_type: 'revenue' }).mockResolvedValueOnce({
      accuracy_score: 0.81,
      parameters_json: JSON.stringify({
        currentMRR: 10000,
        activeSubscriptions: 20,
        avgRevenuePerSubscription: 500,
      }),
    });
    dbRun.mockResolvedValueOnce({ changes: 1 });

    const router = await importRouter();
    const layer = router.stack.find(
      (entry: any) => entry.route?.path === '/models/:id/predict' && entry.route?.methods?.post
    );
    expect(layer).toBeDefined();

    const req = createMockReq({ params: { id: 'model-1' }, body: { input: {} } });
    const res = createMockRes();
    const handlers = layer!.route!.stack;
    await handlers[handlers.length - 1].handle(req, res, vi.fn());

    expect(dbRun).toHaveBeenCalledWith(
      expect.stringContaining('predictive_model_predictions'),
      expect.arrayContaining([
        'model-1',
        'revenue',
        JSON.stringify({}),
        JSON.stringify({
          predictedValue: '$10,020 projected MRR',
          factors: {
            currentMRR: 10000,
            projectedMRR: 10020,
            activeSubs: 20,
            avgRevenuePerSubscription: 500,
          },
        }),
        0.81,
      ])
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        predictedValue: '$10,020 projected MRR',
        confidence: 0.81,
      })
    );
  });
});
