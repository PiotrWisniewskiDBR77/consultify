/**
 * Teresa "all 8 tools" rollout — generate_deliverable enum gating for the 4
 * new deliverable types (process_flow, table, whiteboard, note).
 *
 * Mirrors mcpServerMindmapEnum.test.ts: the `type` enum on generate_deliverable
 * is built once at module load from env flags —
 *  - ENABLE_TERESA_CANVAS_TOOLS OFF → enum omits process_flow/table/whiteboard,
 *  - ENABLE_TERESA_CANVAS_TOOLS ON  → enum includes all three,
 *  - ENABLE_TERESA_NOTE_CREATE OFF → enum omits note,
 *  - ENABLE_TERESA_NOTE_CREATE ON  → enum includes note,
 * and the two flags are independent of each other and of ENABLE_TERESA_MINDMAP.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { vi } from 'vitest';

async function loadEnumValues(flags: {
  canvasTools?: boolean;
  noteCreate?: boolean;
  mindmap?: boolean;
}): Promise<string[]> {
  vi.resetModules();
  const prevCanvas = process.env.ENABLE_TERESA_CANVAS_TOOLS;
  const prevNote = process.env.ENABLE_TERESA_NOTE_CREATE;
  const prevMindmap = process.env.ENABLE_TERESA_MINDMAP;
  process.env.ENABLE_TERESA_CANVAS_TOOLS = flags.canvasTools ? 'true' : 'false';
  process.env.ENABLE_TERESA_NOTE_CREATE = flags.noteCreate ? 'true' : 'false';
  process.env.ENABLE_TERESA_MINDMAP = flags.mindmap ? 'true' : 'false';
  try {
    const mod = await import('../../../server/src/services/ai/mcpServer.js');
    const schema = (mod as any).ToolSchemas.generate_deliverable.parameters;
    const typeSchema = schema.shape.type;
    const values: string[] =
      typeSchema.options ?? typeSchema._def?.values ?? typeSchema._def?.entries ?? [];
    return Array.isArray(values) ? values : Object.values(values);
  } finally {
    process.env.ENABLE_TERESA_CANVAS_TOOLS = prevCanvas;
    process.env.ENABLE_TERESA_NOTE_CREATE = prevNote;
    process.env.ENABLE_TERESA_MINDMAP = prevMindmap;
  }
}

afterEach(() => {
  vi.resetModules();
});

describe('generate_deliverable type enum — canvas tools + note gates', () => {
  it('omits process_flow/table/whiteboard/note when all new flags are OFF', async () => {
    const values = await loadEnumValues({});
    expect(values).toEqual(expect.arrayContaining(['document', 'sheet', 'presentation']));
    expect(values).not.toContain('process_flow');
    expect(values).not.toContain('table');
    expect(values).not.toContain('whiteboard');
    expect(values).not.toContain('note');
  });

  it('includes process_flow/table/whiteboard when ENABLE_TERESA_CANVAS_TOOLS is ON', async () => {
    const values = await loadEnumValues({ canvasTools: true });
    expect(values).toEqual(
      expect.arrayContaining(['process_flow', 'table', 'whiteboard'])
    );
    expect(values).not.toContain('note');
  });

  it('includes note when ENABLE_TERESA_NOTE_CREATE is ON (independent of canvas tools)', async () => {
    const values = await loadEnumValues({ noteCreate: true });
    expect(values).toContain('note');
    expect(values).not.toContain('process_flow');
  });

  it('composes all gates independently (mindmap + canvas tools + note all ON)', async () => {
    const values = await loadEnumValues({ canvasTools: true, noteCreate: true, mindmap: true });
    expect(values).toEqual(
      expect.arrayContaining([
        'document',
        'sheet',
        'presentation',
        'mindmap',
        'process_flow',
        'table',
        'whiteboard',
        'note',
      ])
    );
  });
});
