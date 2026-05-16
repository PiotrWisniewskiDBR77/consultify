import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../middleware/auth.middleware.js', () => ({
  verifyToken: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock('../../middleware/rbac.middleware.js', () => ({
  requireRole: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock('../../middleware/validation.middleware.js', () => ({
  validateBody: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock('../../services/ai/agentAudit/agentAuditStore.js', () => ({
  AgentAuditPersistenceError: class AgentAuditPersistenceError extends Error {},
  acceptAgentAuditRun: vi.fn(),
  createAgentAuditRun: vi.fn(),
  getAgentAuditRun: vi.fn(),
  listAgentAuditRuns: vi.fn(),
}));

vi.mock('../../services/ai/agentAudit/agentRegistry.js', () => ({
  AGENTS: [],
}));

vi.mock('../../services/ai/agentAudit/orchestratorService.js', () => ({
  runAgentAudit: vi.fn(),
  suggestAgents: vi.fn(),
}));

vi.mock('../../utils/DbPromise.js', () => ({
  all: vi.fn(),
  get: vi.fn(),
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

describe('agent-audit.routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists audit runs with normalized filters', async () => {
    const store = await import('../../services/ai/agentAudit/agentAuditStore.js');
    (store.listAgentAuditRuns as any).mockResolvedValue([
      { id: 'audit-1', acceptedAt: null },
      { id: 'audit-2', acceptedAt: '2026-04-18T10:00:00.000Z' },
    ]);

    const mod = await import('../ai/agent-audit.routes.js');
    const router = mod.default;
    const layer = router.stack.find(
      (entry: unknown) =>
        (entry as RouteLayer).route?.path === '/runs' && (entry as RouteLayer).route?.methods?.get
    );

    expect(layer).toBeDefined();

    const req = {
      organizationId: 'org-1',
      query: {
        conversationId: 'conv-1',
        dtSessionId: 'dt-9',
        acceptedOnly: 'TRUE',
        limit: '8',
      },
    };
    const res = createMockRes();

    const route = (layer as RouteLayer | undefined)?.route;
    if (!route) throw new Error('Expected list runs route layer');

    await runMiddlewareChain(route.stack, req, res);

    expect(store.listAgentAuditRuns).toHaveBeenCalledWith({
      organizationId: 'org-1',
      conversationId: 'conv-1',
      dtSessionId: 'dt-9',
      acceptedOnly: true,
      limit: 8,
    });
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        runs: expect.arrayContaining([expect.objectContaining({ id: 'audit-1' })]),
      })
    );
  });
});
