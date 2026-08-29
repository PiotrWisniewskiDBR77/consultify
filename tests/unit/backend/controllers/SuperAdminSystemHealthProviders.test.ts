import { afterEach, beforeAll, describe, expect, it } from 'vitest';

const providerEnvKeys = [
  'OPENROUTER_API_KEY',
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'GROQ_API_KEY',
  'GOOGLE_API_KEY',
  'GEMINI_API_KEY',
  'GOOGLE_AI_KEY',
  'GOOGLE_AI_API_KEY',
] as const;

let controller: typeof import('../../../../server/src/controllers/SuperAdminController.js').default;

function clearProviderEnvironment() {
  for (const key of providerEnvKeys) delete process.env[key];
}

async function readSystemHealth() {
  let body: any;
  await controller.getSystemHealth(
    {} as any,
    {
      json(payload: unknown) {
        body = payload;
      },
    } as any,
    (error: unknown) => {
      throw error;
    }
  );
  return body;
}

describe('SuperAdmin system health AI provider status', () => {
  beforeAll(async () => {
    controller = (await import('../../../../server/src/controllers/SuperAdminController.js')).default;
    controller.setDependencies({
      db: {
        get(_sql: string, _params: unknown[], callback: (error: null) => void) {
          callback(null);
        },
      } as any,
    });
  });

  afterEach(() => {
    clearProviderEnvironment();
  });

  it('reports no_keys when every supported provider key is absent', async () => {
    clearProviderEnvironment();

    const health = await readSystemHealth();

    expect(health.ai.status).toBe('no_keys');
    expect(health.ai.providers).toEqual({
      openrouter: false,
      openai: false,
      anthropic: false,
      groq: false,
      google: false,
    });
  });

  it('reports online and OpenRouter present in OpenRouter-only mode', async () => {
    clearProviderEnvironment();
    process.env.OPENROUTER_API_KEY = 'day117-openrouter-fixture';

    const health = await readSystemHealth();

    expect(health.ai.status).toBe('online');
    expect(health.ai.providers.openrouter).toBe(true);
    expect(health.ai.providers.google).toBe(false);
  });

  it.each(['OPENAI_API_KEY', 'ANTHROPIC_API_KEY'] as const)(
    'preserves online status for the existing %s provider',
    async (envKey) => {
      clearProviderEnvironment();
      process.env[envKey] = 'day117-existing-provider-fixture';

      const health = await readSystemHealth();

      expect(health.ai.status).toBe('online');
    }
  );

  it('preserves Groq presence reporting without changing the existing overall status rule', async () => {
    clearProviderEnvironment();
    process.env.GROQ_API_KEY = 'day117-existing-provider-fixture';

    const health = await readSystemHealth();

    expect(health.ai.status).toBe('no_keys');
    expect(health.ai.providers.groq).toBe(true);
  });

  it.each(['GOOGLE_API_KEY', 'GEMINI_API_KEY', 'GOOGLE_AI_KEY', 'GOOGLE_AI_API_KEY'] as const)(
    'reports online and Google present for %s',
    async (envKey) => {
      clearProviderEnvironment();
      process.env[envKey] = 'day117-google-fixture';

      const health = await readSystemHealth();

      expect(health.ai.status).toBe('online');
      expect(health.ai.providers.google).toBe(true);
      expect(health.ai.providers.openrouter).toBe(false);
    }
  );
});
