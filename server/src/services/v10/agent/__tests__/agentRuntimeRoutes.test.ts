import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../middleware/auth.middleware.js', () => ({
  default: (_req: unknown, _res: unknown, next: () => void) => next(),
  requireOrganization: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock('../../../../utils/Logger.js', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
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

type RuntimeServiceStub = {
  evaluateExecutionProposal: ReturnType<typeof vi.fn>;
  planApprovalBarrier: ReturnType<typeof vi.fn>;
  resumeApprovalBarrier: ReturnType<typeof vi.fn>;
  submitInterruptVerb: ReturnType<typeof vi.fn>;
  appendRunLedger: ReturnType<typeof vi.fn>;
  queryRunLedger: ReturnType<typeof vi.fn>;
  summarizeRunLedger: ReturnType<typeof vi.fn>;
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

describe('agent-runtime.routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('delegates summarize requests to the injected service', async () => {
    const summarizeRunLedger = vi.fn().mockReturnValue({
      runId: 'run-1',
      tenantId: 'tenant-1',
      run: null,
      runtimeState: null,
      eventCount: 0,
      categories: {},
      lastRecordedAt: null,
    });

    const mod = await import('../../../../routes/v10/agent-runtime.routes.js');
    const service: RuntimeServiceStub = {
      evaluateExecutionProposal: vi.fn(),
      planApprovalBarrier: vi.fn(),
      resumeApprovalBarrier: vi.fn(),
      submitInterruptVerb: vi.fn(),
      appendRunLedger: vi.fn(),
      queryRunLedger: vi.fn(),
      summarizeRunLedger,
    };
    const router = mod.createAgentRuntimeRouter(service as never);

    const layer = router.stack.find(
      (entry: unknown) =>
        (entry as RouteLayer).route?.path === '/run-ledger/summarize' &&
        (entry as RouteLayer).route?.methods?.post
    );

    expect(layer).toBeDefined();

    const req = {
      body: {
        tenantId: 'tenant-1',
        runId: 'run-1',
      },
    };
    const res = createMockRes();

    const route = (layer as RouteLayer | undefined)?.route;
    if (!route) {
      throw new Error('Expected summarize route layer');
    }

    await runMiddlewareChain(route.stack, req, res);

    expect(summarizeRunLedger).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      runId: 'run-1',
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ runId: 'run-1' }),
        meta: expect.objectContaining({ version: 'v10' }),
      })
    );
  });
});
