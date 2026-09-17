import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../redis/CacheService.js', () => ({
  appCache: {
    get: vi.fn(async () => null),
    set: vi.fn(async () => undefined),
    delPattern: vi.fn(async () => undefined),
    subscribe: vi.fn(async () => undefined),
  },
}));

vi.mock('../circuitBreaker.js', () => ({
  default: {
    canExecute: vi.fn(async () => ({ allowed: true, state: 'CLOSED' })),
  },
}));

vi.mock('../llmConfigService.js', () => ({
  llmConfigService: {
    getFallbackChain: vi.fn(async () => []),
    getProviderConfig: vi.fn(async () => null),
  },
}));

vi.mock('../logger.js', () => ({
  aiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { ModelRouter } from '../modelRouter.js';

describe('CHAT-IMG P2 v2 — database default vision routing', () => {
  const previousOpenRouterKey = process.env.OPENROUTER_API_KEY;

  beforeEach(() => {
    delete process.env.OPENROUTER_API_KEY;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (previousOpenRouterKey === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = previousOpenRouterKey;
  });

  async function selectDatabaseDefault(options: { envKey?: string }) {
    if (options.envKey) process.env.OPENROUTER_API_KEY = options.envKey;
    const router = new ModelRouter();
    vi.spyOn(router, 'getOrgOverride').mockResolvedValue(null);
    vi.spyOn(router, 'getModelsForTier').mockResolvedValue([]);
    vi.spyOn(router, 'getDefaultProvider').mockResolvedValue({
      id: 'org-vision-default',
      provider: 'openrouter',
      model_id: 'openai/gpt-4o-mini',
      api_key: 'db-only-key',
      health_status: 'healthy',
      is_active: 1,
    });

    return router.select({ capability: 'chat_with_image', requirements: { vision: true } });
  }

  it('selects the organization database default when OpenRouter also has an env key', async () => {
    const selected = await selectDatabaseDefault({ envKey: 'env-key' });

    expect(selected).toMatchObject({
      id: 'openai/gpt-4o-mini',
      provider: 'openrouter',
      source: 'database_default',
      apiKey: 'db-only-key',
    });
  });

  it('selects the organization database default when its key exists only in the database', async () => {
    const selected = await selectDatabaseDefault({});

    expect(process.env.OPENROUTER_API_KEY).toBeUndefined();
    expect(selected).toMatchObject({
      id: 'openai/gpt-4o-mini',
      provider: 'openrouter',
      source: 'database_default',
      apiKey: 'db-only-key',
    });
  });
});
