import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../middleware/auth.middleware.js', () => ({
  default: (_req: unknown, _res: unknown, next: () => void) => next(),
  requireOrganization: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock('../../../services/organizationService.js', () => ({
  getAISettings: vi.fn(),
}));

vi.mock('../../../services/v10/agent-schedules/agentScheduleRegistryService.js', () => ({
  agentScheduleRegistryService: {
    listSchedules: vi.fn(),
    planSchedule: vi.fn(),
    previewSchedule: vi.fn(),
    createSchedule: vi.fn(),
    getNotificationPreferences: vi.fn(),
    updateNotificationPreferences: vi.fn(),
    getRunTimelineSummary: vi.fn(),
    triggerSchedule: vi.fn(),
  },
}));

function createMockRes() {
  const res: Record<string, unknown> = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res as {
    status: ReturnType<typeof vi.fn>;
    json: ReturnType<typeof vi.fn>;
  };
}

type MiddlewareHandler = {
  handle: (req: unknown, res: unknown, next: () => void) => unknown | Promise<unknown>;
};

type RouteLayer = {
  route?: {
    path?: string;
    methods?: Record<string, boolean>;
    stack: MiddlewareHandler[];
  };
};

async function runMiddlewareChain(handlers: MiddlewareHandler[], req: unknown, res: unknown) {
  for (const handler of handlers) {
    let nextCalled = false;
    await handler.handle(req, res, () => {
      nextCalled = true;
    });
    if (!nextCalled) return;
  }
}

describe('agent-schedules.routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('triggers a schedule with org autonomy settings and actor context', async () => {
    const org = await import('../../../services/organizationService.js');
    const schedules =
      await import('../../../services/v10/agent-schedules/agentScheduleRegistryService.js');

    vi.mocked(org.getAISettings).mockResolvedValue({
      ai_autonomy_level: 'SUPERVISED',
    } as never);
    vi.mocked(schedules.agentScheduleRegistryService.triggerSchedule).mockResolvedValue({
      runId: 'run-42',
      gateDecision: 'requires_approval',
      timeline: {
        scheduleId: 'schedule-1',
        latestRunId: 'run-42',
        totalRuns: 1,
        runs: [],
      },
    } as never);

    const mod = await import('../../../routes/v10/agent-schedules.routes.js');
    const router = mod.default;
    const layer = router.stack.find(
      (entry: unknown) =>
        (entry as RouteLayer).route?.path === '/:scheduleId/trigger' &&
        (entry as RouteLayer).route?.methods?.post
    );

    expect(layer).toBeDefined();

    const req = {
      organizationId: 'org-1',
      params: { scheduleId: 'schedule-1' },
      query: {},
      body: {},
      userId: 'user-7',
      user: { id: 'user-7', organizationId: 'org-1' },
    };
    const res = createMockRes();

    const route = (layer as RouteLayer | undefined)?.route;
    if (!route) throw new Error('Expected trigger route layer');

    await runMiddlewareChain(route.stack, req, res);

    expect(org.getAISettings).toHaveBeenCalledWith('org-1');
    expect(schedules.agentScheduleRegistryService.triggerSchedule).toHaveBeenCalledWith(
      'org-1',
      'schedule-1',
      {
        requestedBy: 'user-7',
        autonomyLevel: 'SUPERVISED',
      }
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ runId: 'run-42', gateDecision: 'requires_approval' }),
        meta: expect.objectContaining({ version: 'v10', contract: 'agent_schedules_v1' }),
      })
    );
  });

  it('ignores tenant overrides from request payloads', async () => {
    const schedules =
      await import('../../../services/v10/agent-schedules/agentScheduleRegistryService.js');
    vi.mocked(schedules.agentScheduleRegistryService.listSchedules).mockResolvedValue([] as never);

    const mod = await import('../../../routes/v10/agent-schedules.routes.js');
    const router = mod.default;
    const layer = router.stack.find(
      (entry: unknown) =>
        (entry as RouteLayer).route?.path === '/' && (entry as RouteLayer).route?.methods?.get
    );

    expect(layer).toBeDefined();

    const req = {
      organizationId: 'org-auth',
      params: {},
      query: { tenantId: 'org-query' },
      body: { tenantId: 'org-body' },
      userId: 'user-7',
      user: { id: 'user-7', organizationId: 'org-auth' },
    };
    const res = createMockRes();

    const route = (layer as RouteLayer | undefined)?.route;
    if (!route) throw new Error('Expected list route layer');

    await runMiddlewareChain(route.stack, req, res);

    expect(schedules.agentScheduleRegistryService.listSchedules).toHaveBeenCalledWith('org-auth');
  });
});
