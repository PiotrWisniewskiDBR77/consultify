/**
 * FIX-206 (pkt 2/5/6) — ZACHOWANIE pętli narzędziowej na realnej trasie
 * POST /api/ai/chat/stream.
 *
 * Handler jest prawdziwy: to on składa `executeReadTool` (koszt, zegar, SSE) i
 * to on decyduje, co jedzie do `executeToolCall`. Udawany jest tylko dostawca
 * (AIPipeline), który zachowuje się jak model wołający jedno narzędzie w
 * trakcie tury — dokładnie tak, jak robi to `llmService` w produkcji.
 */
import express from 'express';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

process.env.ENABLE_TERESA_TOOL_LOOP = 'true';
process.env.TERESA_TOOL_LOOP_TIMEOUT_MS = '60';

const toolCalls = vi.hoisted(() => [] as Array<{ name: string; ctx: any }>);
const pipelineRequests = vi.hoisted(() => [] as any[]);
const toolResults = vi.hoisted(() => [] as string[]);
const scenario = vi.hoisted(() => ({
  toolName: 'get_initiative_status',
  behaviour: 'ok' as 'ok' | 'hang',
}));

vi.mock('../../../server/src/middleware/auth.middleware.js', async () => {
  const actual = (await vi.importActual(
    '../../../server/src/middleware/auth.middleware.js'
  )) as any;
  return {
    ...actual,
    verifyToken: (req: any, _res: any, next: any) => {
      req.user = { id: 'fix206-user', organizationId: 'fix206-org', role: 'ADMIN' };
      req.userId = 'fix206-user';
      req.organizationId = 'fix206-org';
      next();
    },
  };
});

vi.mock('../../../server/src/middleware/rateLimiting.middleware.js', async () => {
  const actual = (await vi.importActual(
    '../../../server/src/middleware/rateLimiting.middleware.js'
  )) as any;
  return { ...actual, aiRateLimiter: (_req: any, _res: any, next: any) => next() };
});

vi.mock('../../../server/src/middleware/auditsStrictMembership.middleware.js', async () => {
  const actual = (await vi.importActual(
    '../../../server/src/middleware/auditsStrictMembership.middleware.js'
  )) as any;
  return { ...actual, requireActiveTenantMembership: (_req: any, _res: any, next: any) => next() };
});

vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  all: vi.fn(async () => []),
  get: vi.fn(async (sql: string) => {
    const text = String(sql);
    if (/FROM organization_members/i.test(text)) return { status: 'ACTIVE' };
    if (/FROM llm_providers/i.test(text)) return { ok: 1 };
    return undefined;
  }),
  run: vi.fn(async () => ({})),
  default: {},
}));

vi.mock('../../../server/src/services/accessPolicyService.js', async () => {
  const actual = (await vi.importActual(
    '../../../server/src/services/accessPolicyService.js'
  )) as any;
  const base = actual.default || actual;
  const patched = new Proxy(base, {
    get(target: any, prop: string | symbol) {
      if (prop === 'checkAccess') return async () => ({ allowed: true });
      return target[prop];
    },
  });
  return { ...actual, default: patched };
});

vi.mock('../../../server/src/services/ai/toolDefinitions.js', async () => {
  const actual = (await vi.importActual(
    '../../../server/src/services/ai/toolDefinitions.js'
  )) as any;
  return {
    ...actual,
    executeToolCall: vi.fn(async (name: string, _args: any, ctx: any) => {
      toolCalls.push({ name, ctx });
      if (scenario.behaviour === 'hang') return new Promise<string>(() => undefined);
      return JSON.stringify({ status: 'OK', tool: name });
    }),
  };
});

// Dostawca: zachowuje się jak model, który w trakcie tury woła JEDNO narzędzie.
vi.mock('../../../server/src/services/ai/AIPipeline.js', () => {
  class AIPipeline {
    async process(pipelineRequest: any) {
      pipelineRequests.push(pipelineRequest);
      const execute = pipelineRequest?.options?.readTools?.context?.executeReadTool;
      if (typeof execute === 'function') {
        toolResults.push(await execute(scenario.toolName, {}));
      }
      return { success: true, content: 'gotowe', metadata: {} };
    }
  }
  return { AIPipeline, default: { AIPipeline } };
});

const { default: aiRouter } = await import('../../../server/src/routes/ai.routes.ts');

function makeApp() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));
  app.use('/api/ai', aiRouter);
  return app;
}

async function turn(body: Record<string, unknown> = {}) {
  const res = await request(makeApp())
    .post('/api/ai/chat/stream')
    .send({ message: 'Jaki jest status inicjatyw?', history: [], context: {}, ...body });
  const events = String(res.text || '')
    .split('\n')
    .filter((line) => line.startsWith('data: '))
    .map((line) => {
      try {
        return JSON.parse(line.slice(6));
      } catch {
        return null;
      }
    })
    .filter(Boolean) as any[];
  return { res, events, toolSteps: events.filter((e) => e.type === 'tool_step') };
}

describe('FIX-206 — pętla narzędziowa na realnej trasie czatu', () => {
  beforeEach(() => {
    toolCalls.length = 0;
    pipelineRequests.length = 0;
    toolResults.length = 0;
    scenario.toolName = 'get_initiative_status';
    scenario.behaviour = 'ok';
  });

  afterAll(() => {
    delete process.env.ENABLE_TERESA_TOOL_LOOP;
    delete process.env.TERESA_TOOL_LOOP_TIMEOUT_MS;
  });

  it('pkt 2: tryb prywatny rozmowy dojeżdża do executora narzędzia', async () => {
    await turn({ privateMode: true });

    expect(toolCalls).toHaveLength(1);
    expect(toolCalls[0].ctx.privateMode).toBe(true);
    expect(toolCalls[0].ctx.organizationId).toBe('fix206-org');
  });

  it('pkt 2: bez trybu prywatnego executor dostaje privateMode=false (czułość)', async () => {
    await turn({});

    expect(toolCalls).toHaveLength(1);
    expect(toolCalls[0].ctx.privateMode).toBe(false);
  });

  it('pkt 5: krok, który nie odpowiedział w czasie, NIE jest raportowany jako completed', async () => {
    scenario.behaviour = 'hang';

    const { toolSteps } = await turn({});

    const statuses = toolSteps.map((step) => step.status);
    expect(statuses).toContain('running');
    expect(statuses).toContain('timeout');
    expect(statuses).not.toContain('completed');
    expect(JSON.parse(toolResults[0]).status).toBe('TIMEOUT');
  });

  it('pkt 5: krok, który odpowiedział, nadal kończy się completed (czułość)', async () => {
    const { toolSteps } = await turn({});

    expect(toolSteps.map((step) => step.status)).toContain('completed');
    expect(JSON.parse(toolResults[0]).status).toBe('OK');
  });

  it('pkt 6: narzędzie bez ceny kończy JEDEN krok błędem, tura żyje dalej', async () => {
    scenario.toolName = 'narzedzie-bez-wpisu-w-cenniku';

    const { res, toolSteps } = await turn({});

    // Wyjątek wyceny nie wychodzi z callbacku: model dostaje kopertę błędu…
    expect(JSON.parse(toolResults[0]).status).toBe('ERROR');
    expect(JSON.parse(toolResults[0]).error).toContain('unknown_tool_cost');
    expect(toolSteps.map((step) => step.status)).toEqual(['failed']);
    // …a sama tura kończy się normalnie (odpowiedź modelu dociera do klienta).
    expect(res.status).toBe(200);
    expect(String(res.text)).toContain('gotowe');
  });

  it('kroki narzędzi nigdy nie wynoszą surowego wyniku do SSE', async () => {
    const { toolSteps } = await turn({});

    for (const step of toolSteps) {
      expect(Object.keys(step).sort()).toEqual(['costUsd', 'status', 'toolName', 'type']);
    }
  });
});
