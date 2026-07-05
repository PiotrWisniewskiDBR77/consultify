/**
 * generate_initiative registry wiring (M13 Depth · Seria C · C2).
 *
 * Two guarantees that keep Teresa's "create a DRAFT initiative" path live:
 *   1. The tool DEFINITION exists in the exported ToolSchemas with the correct
 *      shape — READ type (a DRAFT is reversible → no approval gate), title
 *      required, optional problem.
 *   2. The HANDLER is actually registered: importing the production tool
 *      registry (tools/index.ts → registerAllTools()) wires a handler onto the
 *      mcpServer entry, and the tool surfaces in getToolDefinitions().
 *
 * The leaf services pulled in transitively by tools/index.ts are stubbed so this
 * stays a pure registry-wiring unit test (no DB / no real generation).
 */
import { beforeAll, describe, expect, it, vi } from 'vitest';

// Silence logging.
vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// Stub every DB / service module the handler chain imports so importing the
// registry has no side effects (no pg pool, no real generation).
vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  all: vi.fn(async () => []),
  get: vi.fn(async () => undefined),
  run: vi.fn(async () => ({})),
}));
vi.mock('../../../server/src/services/initiativeGenerationService.js', () => ({
  createInitiative: vi.fn(async () => ({ id: 'stub' })),
}));
vi.mock('../../../server/src/services/InterviewInsightService.js', () => ({
  default: {},
}));
vi.mock('../../../server/src/services/initiativeService.js', () => ({ default: {} }));
vi.mock('../../../server/src/services/notebookService.js', () => ({ default: {} }));
vi.mock('../../../server/src/services/presentationAccessPolicyService.js', () => ({
  hasPresentationCapability: vi.fn(async () => true),
}));
vi.mock('../../../server/src/services/deliverables/deliverablesGenerationService.js', () => ({
  planDeliverableGeneration: vi.fn(),
  startDeliverableGeneration: vi.fn(),
}));

import { ToolSchemas, TOOL_TYPE, mcpServer } from '../../../server/src/services/ai/mcpServer.js';

describe('generate_initiative — registry wiring (C2)', () => {
  beforeAll(async () => {
    // Importing the registry runs registerAllTools() as a module side effect.
    await import('../../../server/src/services/ai/tools/index.js');
  });

  it('exposes the generate_initiative DEFINITION as a READ tool', () => {
    const def = ToolSchemas.generate_initiative;
    expect(def).toBeDefined();
    expect(def.name).toBe('generate_initiative');
    expect(def.type).toBe(TOOL_TYPE.READ);
    expect(typeof def.description).toBe('string');
  });

  it('declares title (required) and problem (optional) in the parameters schema', () => {
    const schema: any = mcpServer.tools.get('generate_initiative')?.parameters;
    expect(schema).toBeDefined();
    const parsed = schema.safeParse({ title: 'Robotic picking' });
    expect(parsed.success).toBe(true); // problem is optional
    const missing = schema.safeParse({ problem: 'no title' });
    expect(missing.success).toBe(false); // title is required
  });

  it('registers a handler for generate_initiative', () => {
    const entry = mcpServer.tools.get('generate_initiative');
    expect(entry).toBeDefined();
    expect(typeof entry?.handler).toBe('function');
  });

  it('surfaces generate_initiative in getToolDefinitions()', () => {
    const names = mcpServer.getToolDefinitions().map((d) => d.name);
    expect(names).toContain('generate_initiative');
  });
});
