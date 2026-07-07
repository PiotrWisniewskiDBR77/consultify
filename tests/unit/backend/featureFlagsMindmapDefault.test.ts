/**
 * Regression guard for the ENABLE_TERESA_MINDMAP default-OFF gap (audyt sterty
 * 2026-07-06). The flag must default ON, consistent with its siblings
 * ENABLE_TERESA_CANVAS_TOOLS / ENABLE_TERESA_NOTE_CREATE, so the
 * generate_deliverable enum includes 'mindmap' without requiring an env
 * override — mirrored in server/src/services/ai/mcpServer.ts DELIVERABLE_TYPES.
 */

import { describe, it, expect, afterEach, vi } from 'vitest';

const ENV_KEY = 'ENABLE_TERESA_MINDMAP';

describe('ENABLE_TERESA_MINDMAP default', () => {
  const prev = process.env[ENV_KEY];

  afterEach(() => {
    if (prev === undefined) delete process.env[ENV_KEY];
    else process.env[ENV_KEY] = prev;
    vi.resetModules();
  });

  it('loadFeatureFlags() defaults to true when the env var is unset', async () => {
    delete process.env[ENV_KEY];
    vi.resetModules();
    const { loadFeatureFlags } = await import('../../../server/src/config/FeatureFlags.js');
    const flags = loadFeatureFlags();
    expect(flags.ENABLE_TERESA_MINDMAP).toBe(true);
  });

  it('mcpServer DELIVERABLE_TYPES enum includes mindmap with no env override', async () => {
    delete process.env[ENV_KEY];
    vi.resetModules();
    const mod = await import('../../../server/src/services/ai/mcpServer.js');
    const schema = (mod as any).ToolSchemas.generate_deliverable.parameters;
    const typeSchema = schema.shape.type;
    const values: string[] =
      typeSchema.options ?? typeSchema._def?.values ?? typeSchema._def?.entries ?? [];
    const list = Array.isArray(values) ? values : Object.values(values);
    expect(list).toContain('mindmap');
  });

  it('can still be explicitly disabled via ENABLE_TERESA_MINDMAP=false', async () => {
    process.env[ENV_KEY] = 'false';
    vi.resetModules();
    const { loadFeatureFlags } = await import('../../../server/src/config/FeatureFlags.js');
    const flags = loadFeatureFlags();
    expect(flags.ENABLE_TERESA_MINDMAP).toBe(false);
  });
});
