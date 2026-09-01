/**
 * FIX-206 (pkt 3) — test BEHAWIORALNY pętli narzędziowej Teresy.
 *
 * Kontrakt dyżuru 206 był mierzony `readFileSync` + `toContain`: taki test
 * przechodzi także wtedy, gdy narzędzie nigdy się nie wykona. Tutaj jedzie
 * REALNY `AIPipeline.process`; udawany jest wyłącznie dostawca LLM (mock
 * `llmService.callStream`), który zachowuje się jak model zwracający tool-call:
 * bierze definicje narzędzi z `params.readTools` i woła je przez ten sam
 * `context.executeReadTool`, który w produkcji ustawia `ai.routes.ts`.
 *
 * Test jest bramką dla DWÓCH mutacji (obie MUSZĄ dać czerwony):
 *   1) `readToolDefs = []` w AIPipeline  → model nie dostaje narzędzi,
 *   2) `if (true)` zamiast warunku flagi → narzędzia jadą mimo flagi OFF.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const flags = vi.hoisted(() => ({ ENABLE_TERESA_TOOL_LOOP: false }));
const llmCalls = vi.hoisted(() => [] as any[]);

vi.mock('../../../../server/src/config/FeatureFlags.js', async () => {
  const actual = (await vi.importActual(
    '../../../../server/src/config/FeatureFlags.js'
  )) as any;
  return {
    ...actual,
    featureFlags: new Proxy(
      {},
      {
        get(_t, prop: string) {
          if (prop === 'ENABLE_TERESA_TOOL_LOOP') return flags.ENABLE_TERESA_TOOL_LOOP;
          return (actual.featureFlags as any)[prop];
        },
      }
    ),
  };
});

vi.mock('../../../../server/src/services/ai/llmService.js', () => ({
  llmService: {
    callStream: vi.fn(async (params: any) => {
      const record: any = { params, executed: [] as any[] };
      llmCalls.push(record);
      const defs = Array.isArray(params?.readTools) ? params.readTools : [];
      const executeReadTool = params?.context?.executeReadTool;
      const wanted = defs.find((d: any) => d?.name === 'get_initiative_status');
      if (wanted && typeof executeReadTool === 'function') {
        // Model "wywołuje narzędzie" — dokładnie tym kanałem, którym robi to
        // dostawca w llmService.callStream (tool.execute → executeReadTool).
        const result = await executeReadTool(wanted.name, { status: 'EXECUTING' });
        record.executed.push({ name: wanted.name, result });
      }
      return {
        stream: (async function* () {
          yield 'odpowiedz-modelu';
        })(),
      };
    }),
  },
}));

vi.mock('../../../../server/src/services/ai/modelRouter.js', () => {
  const router = {
    async select() {
      return { id: 'p-standard', tier: 'STANDARD', provider: 'openai', apiKey: 'k', endpoint: null };
    },
    async getProviderConfig() {
      return { id: 'gpt-4o-mini', provider: 'openai', apiKey: 'k', endpoint: null };
    },
    getFallbackChain() {
      return [];
    },
    async getModelsForTier() {
      return [];
    },
    async selectFallback() {
      return null;
    },
  };
  return { default: router, modelRouter: router };
});

vi.mock('../../../../server/src/database/Database.js', () => ({
  getDatabase: () => null,
  getDatabaseAsync: () => Promise.resolve(null),
}));

vi.mock('../../../../server/src/utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

async function runTurn(toolResult: string) {
  const { AIPipeline } = await import('../../../../server/src/services/ai/AIPipeline.js');
  const pipeline = AIPipeline.getInstance();
  const executeReadTool = vi.fn(async () => toolResult);
  const response = await pipeline.process({
    type: 'chat',
    capability: 'chat',
    userId: 'fix206-user',
    organizationId: 'fix206-org',
    prompt: 'Jaki jest status inicjatyw?',
    messages: [{ role: 'user', content: 'Jaki jest status inicjatyw?' }],
    stream: true,
    options: {
      readTools: { enabled: true, context: { executeReadTool } },
    },
  } as any);
  return { response, executeReadTool, call: llmCalls[llmCalls.length - 1] };
}

describe('FIX-206 pkt 3 — pętla narzędziowa wykonuje się naprawdę', () => {
  beforeEach(() => {
    llmCalls.length = 0;
    flags.ENABLE_TERESA_TOOL_LOOP = false;
    process.env.AI_BUDGETS_ENABLED = 'false';
  });

  it('flaga ON: model dostaje READ-narzędzia, wywołuje je i dostaje ich wynik z powrotem', async () => {
    flags.ENABLE_TERESA_TOOL_LOOP = true;

    const { response, executeReadTool, call } = await runTurn('{"total":2,"initiatives":[]}');

    expect(response.success).toBe(true);
    // 1. Narzędzia REALNIE dojechały do dostawcy…
    const names = (call?.params?.readTools || []).map((d: any) => d.name);
    expect(names).toContain('get_initiative_status');
    expect(names).toContain('search_knowledge_base');
    // …i to nadal jest podzbiór READ (żadnego narzędzia zapisującego).
    expect(names).not.toContain('create_task');
    // 2. Narzędzie SIĘ WYKONAŁO…
    expect(executeReadTool).toHaveBeenCalledTimes(1);
    expect(executeReadTool).toHaveBeenCalledWith('get_initiative_status', { status: 'EXECUTING' });
    // 3. …a jego wynik wrócił do modelu.
    expect(call?.executed).toEqual([
      { name: 'get_initiative_status', result: '{"total":2,"initiatives":[]}' },
    ]);
  });

  it('flaga OFF: ZERO wywołań narzędzi, mimo że trasa poprosiła o pętlę', async () => {
    flags.ENABLE_TERESA_TOOL_LOOP = false;

    const { response, executeReadTool, call } = await runTurn('{"total":2}');

    expect(response.success).toBe(true);
    expect(call?.params?.readTools).toBeUndefined();
    expect(executeReadTool).not.toHaveBeenCalled();
    expect(call?.executed).toEqual([]);
  });
});
