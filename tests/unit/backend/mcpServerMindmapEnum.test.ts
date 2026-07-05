/**
 * M06 Fala 2 · 2.3 — generate_deliverable enum gating (blocker #1).
 *
 * The `type` enum on generate_deliverable is built once at module load from
 * ENABLE_TERESA_MINDMAP:
 *  - flag OFF → ['document','sheet','presentation'] (today's behavior; the model
 *    can never request a mind map),
 *  - flag ON  → includes 'mindmap'.
 *
 * We assert both by resetting the module registry with the env toggled.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';

async function loadEnumValues(flagOn: boolean): Promise<string[]> {
  vi.resetModules();
  const prev = process.env.ENABLE_TERESA_MINDMAP;
  process.env.ENABLE_TERESA_MINDMAP = flagOn ? 'true' : 'false';
  try {
    const mod = await import('../../../server/src/services/ai/mcpServer.js');
    const schema = (mod as any).ToolSchemas.generate_deliverable.parameters;
    // z.object → shape.type is a z.enum; read its options.
    const typeSchema = schema.shape.type;
    // zod stores enum values under .options (array) or ._def.values.
    const values: string[] =
      typeSchema.options ?? typeSchema._def?.values ?? typeSchema._def?.entries ?? [];
    return Array.isArray(values) ? values : Object.values(values);
  } finally {
    process.env.ENABLE_TERESA_MINDMAP = prev;
  }
}

afterEach(() => {
  vi.resetModules();
});

describe('generate_deliverable type enum (ENABLE_TERESA_MINDMAP gate)', () => {
  it('does NOT include mindmap when the flag is OFF', async () => {
    const values = await loadEnumValues(false);
    expect(values).toEqual(expect.arrayContaining(['document', 'sheet', 'presentation']));
    expect(values).not.toContain('mindmap');
  });

  it('includes mindmap when the flag is ON', async () => {
    const values = await loadEnumValues(true);
    expect(values).toEqual(
      expect.arrayContaining(['document', 'sheet', 'presentation', 'mindmap'])
    );
  });
});
