/**
 * Smoke: Teresa function-calling is on the ai-SDK v6 contract.
 *
 * Two invariants that silently broke Teresa's generate_deliverable /
 * generate_initiative tool loop when the repo moved to `ai` v6:
 *
 *  1. tool() definitions MUST use `inputSchema:` (v6) — v6 removed `parameters:`.
 *     A tool built with `parameters` is registered but never invocable.
 *  2. The multi-step tool loop MUST be driven by `stopWhen: stepCountIs(n)` (v6)
 *     — v6 removed `maxSteps:`. With `maxSteps` (ignored in v6) the SDK stops
 *     after the tool call and never streams the confirmation turn → EMPTY_STREAM,
 *     which the pipeline misreads as a failure and retries → duplicate drafts.
 *
 * We assert BOTH by mocking the `ai` package to capture what llmService actually
 * passes to streamText/tool, then driving LLMService.callWithToolsStream. This
 * fails loudly if anyone reintroduces `maxSteps` or `parameters` on this path.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---- capture buckets (populated by the ai mock during the call) ------------
const captured: {
  toolArgs: any[];
  streamTextArgs: any[];
} = { toolArgs: [], streamTextArgs: [] };

// Mock the `ai` package so we can inspect the tool + streamText config without
// hitting a provider. tool() records its config; jsonSchema/stepCountIs are
// passthrough markers; streamText records its args and returns a tiny stream.
vi.mock('ai', () => ({
  tool: (cfg: any) => {
    captured.toolArgs.push(cfg);
    return cfg;
  },
  jsonSchema: (s: any) => ({ __jsonSchema: s }),
  stepCountIs: (n: number) => ({ __stepCountIs: n }),
  streamText: (args: any) => {
    captured.streamTextArgs.push(args);
    return {
      textStream: (async function* () {
        yield 'ok';
      })(),
      usage: Promise.resolve({ inputTokens: 1, outputTokens: 1, totalTokens: 2 }),
      totalUsage: Promise.resolve({ inputTokens: 1, outputTokens: 1, totalTokens: 2 }),
      steps: Promise.resolve([]),
      finishReason: Promise.resolve('stop'),
    };
  },
  generateText: (args: any) => {
    captured.streamTextArgs.push(args);
    return Promise.resolve({ text: 'ok', usage: {}, steps: [] });
  },
  generateObject: () => Promise.resolve({ object: {} }),
  asSchema: (s: any) => s,
}));

// getModel() touches provider SDKs — stub it to a plain sentinel.
vi.mock('../../../../server/src/services/ai/llmService.js', async (importOriginal) => {
  // no-op: we import the real module below; this placeholder keeps the shape.
  return importOriginal();
});

// Circuit breaker must allow execution and not touch a real store.
vi.mock('../../../../server/src/services/ai/circuitBreaker.js', () => ({
  default: {
    canExecute: vi.fn(async () => ({ allowed: true, state: 'CLOSED' })),
    recordSuccess: vi.fn(async () => {}),
    recordFailure: vi.fn(async () => {}),
    execute: vi.fn(async (_id: string, fn: () => Promise<unknown>) => fn()),
  },
}));

// A minimal mcpServer whose getToolDefinitions() returns the two Teresa tools in
// the same {name, description, parameters(JSON schema)} shape the real registry
// emits, and whose execute() records tool-call → result.
const execCalls: Array<{ name: string; args: unknown }> = [];
vi.mock('../../../../server/src/services/ai/mcpServer.js', () => {
  const server = {
    getToolDefinitions: () => [
      {
        name: 'generate_deliverable',
        description: 'Create a deliverable draft and open it in the canvas.',
        parameters: { type: 'object', properties: { intent: { type: 'string' } } },
      },
      {
        name: 'generate_initiative',
        description: 'Create a draft initiative from chat.',
        parameters: { type: 'object', properties: { title: { type: 'string' } } },
      },
    ],
    execute: vi.fn(async (name: string, args: unknown) => {
      execCalls.push({ name, args });
      return { status: 'SUCCESS', data: { ok: true, message: `did ${name}` } };
    }),
  };
  return { mcpServer: server, default: server };
});

// tools/index.js self-registers handlers on import — stub to a no-op so the
// dynamic import inside llmService resolves without side effects.
vi.mock('../../../../server/src/services/ai/tools/index.js', () => ({
  registerAllTools: () => {},
  default: { registerAllTools: () => {} },
}));

// Provider SDKs pulled in by getModel — stub so import doesn't need real keys.
vi.mock('@ai-sdk/anthropic', () => ({ createAnthropic: () => () => ({}) }));
vi.mock('@ai-sdk/google', () => ({ createGoogleGenerativeAI: () => () => ({}) }));
vi.mock('@ai-sdk/openai', () => ({ createOpenAI: () => () => ({}) }));

describe('Teresa function-calling — ai v6 contract', () => {
  beforeEach(() => {
    captured.toolArgs.length = 0;
    captured.streamTextArgs.length = 0;
    execCalls.length = 0;
  });

  it('builds tools with inputSchema (v6) and drives the loop with stopWhen: stepCountIs — never maxSteps', async () => {
    const { LLMService } = await import(
      '../../../../server/src/services/ai/llmService.js'
    );
    const svc = new LLMService();

    const res = await svc.callWithToolsStream({
      modelConfig: { provider: 'openai', model_id: 'gpt-4o', apiKey: 'x' } as any,
      systemPrompt: 'You are Teresa.',
      messages: [{ role: 'user', content: 'stwórz dokument' }],
      maxIterations: 4,
      context: { organizationId: 'org1', userId: 'u1' },
    } as any);

    // A stream came back (init path did not throw).
    expect(res).toBeTruthy();

    // --- Invariant 1: every tool() uses inputSchema, none uses parameters -----
    expect(captured.toolArgs.length).toBeGreaterThanOrEqual(2);
    for (const t of captured.toolArgs) {
      expect(t).toHaveProperty('inputSchema');
      expect(t).not.toHaveProperty('parameters');
      expect(typeof t.execute).toBe('function');
    }

    // --- Invariant 2: streamText got stopWhen (a stepCountIs marker), no maxSteps
    expect(captured.streamTextArgs.length).toBeGreaterThanOrEqual(1);
    const st = captured.streamTextArgs[captured.streamTextArgs.length - 1];
    expect(st).not.toHaveProperty('maxSteps');
    expect(st).toHaveProperty('stopWhen');
    expect(st.stopWhen).toMatchObject({ __stepCountIs: 4 });
    expect(st).toHaveProperty('tools');
  });

  it('tool.execute bridges to mcpServer.execute (tool-call → result)', async () => {
    const { LLMService } = await import(
      '../../../../server/src/services/ai/llmService.js'
    );
    const svc = new LLMService();

    await svc.callWithToolsStream({
      modelConfig: { provider: 'openai', model_id: 'gpt-4o', apiKey: 'x' } as any,
      systemPrompt: 'You are Teresa.',
      messages: [{ role: 'user', content: 'stwórz inicjatywę' }],
      maxIterations: 4,
      context: { organizationId: 'org1', userId: 'u1' },
    } as any);

    const deliverableTool = captured.toolArgs.find((t) =>
      String(t.description).toLowerCase().includes('deliverable')
    );
    expect(deliverableTool).toBeTruthy();

    // Invoke the tool the way the SDK would; it must reach mcpServer.execute and
    // return the wrapped SUCCESS result (the SSE onDeliverable emit lives inside).
    const out = await deliverableTool!.execute({ intent: 'plan' });
    expect(out).toMatchObject({ status: 'SUCCESS' });
    expect(execCalls.some((c) => c.name === 'generate_deliverable')).toBe(true);
  });
});
