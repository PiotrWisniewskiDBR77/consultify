/**
 * Teresa "all 8 tools" rollout — generate_deliverable(type: process_flow |
 * table | whiteboard | note).
 *
 * Mirrors generateDeliverable.mindmap.test.ts contract:
 *  - flag OFF → feature_disabled (no fake artifact),
 *  - flag ON  → canvas tools build a REAL skeleton {nodes,edges} and emit
 *    onDeliverable(kind, preferredSystem, graph) — NOT DB-bound (no plan/start),
 *  - note ON  → calls notebookService.createNote and emits onDeliverable with
 *    the real notebook_pages id (noteId), no graph,
 *  - VIEWER is rejected on both (shared capability gate).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { planMock, startMock, createNoteMock, flags } = vi.hoisted(() => ({
  planMock: vi.fn(),
  startMock: vi.fn(),
  createNoteMock: vi.fn(),
  flags: {
    ENABLE_DELIVERABLES_LIGHT: true,
    ENABLE_TERESA_MINDMAP: false,
    ENABLE_TERESA_CANVAS_TOOLS: true,
    ENABLE_TERESA_NOTE_CREATE: true,
  },
}));

vi.mock('../../../server/src/services/deliverables/deliverablesGenerationService.js', () => ({
  plan: (...args: unknown[]) => planMock(...args),
  start: (...args: unknown[]) => startMock(...args),
}));

vi.mock('../../../server/src/config/FeatureFlags.js', () => ({
  featureFlags: flags,
}));

vi.mock('../../../server/src/services/presentationAccessPolicyService.js', () => ({
  hasPresentationCapability: (role: string, _cap: string) =>
    ['ADMIN', 'OWNER', 'EDITOR', 'MEMBER', 'SUPERADMIN'].includes(String(role).toUpperCase()),
}));

vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../../server/src/services/notebookService.js', () => ({
  createNote: (...args: unknown[]) => createNoteMock(...args),
}));

// naprawa-c1Graph: these tests assert the DETERMINISTIC skeleton path. Force the
// LLM generators to the null (fail-soft) branch so the skeleton fallback + raw
// intent body run deterministically, without any network call.
vi.mock('../../../server/src/services/ai/canvasGraphLlm.js', async () => {
  const actual = await vi.importActual<
    typeof import('../../../server/src/services/ai/canvasGraphLlm.js')
  >('../../../server/src/services/ai/canvasGraphLlm.js');
  return {
    generateMindmapGraph: vi.fn().mockResolvedValue(null),
    generateProcessFlowGraph: vi.fn().mockResolvedValue(null),
    generateWhiteboardGraph: vi.fn().mockResolvedValue(null),
    generateTableGraph: vi.fn().mockResolvedValue(null),
    generateNoteContent: vi.fn().mockResolvedValue(null),
    // HP-16 (7/8, 8/8) — real (unmocked) pure evidence builders: deterministic,
    // zero I/O, safe to run for real in tests (mirrors how the other 6 wired
    // tools' builders are exercised directly, not stubbed).
    buildMindmapEvidenceContract: actual.buildMindmapEvidenceContract,
    buildNoteEvidenceContract: actual.buildNoteEvidenceContract,
    buildProcessFlowEvidenceContract: actual.buildProcessFlowEvidenceContract,
  };
});

import { generateDeliverable } from '../../../server/src/services/ai/tools/generateDeliverable.js';

const baseCtx = {
  organizationId: 'org-1',
  userId: 'user-1',
  conversationId: 'conv-1',
  language: 'pl' as const,
  role: 'ADMIN',
};

beforeEach(() => {
  planMock.mockReset();
  startMock.mockReset();
  createNoteMock.mockReset();
  flags.ENABLE_DELIVERABLES_LIGHT = true;
  flags.ENABLE_TERESA_CANVAS_TOOLS = true;
  flags.ENABLE_TERESA_NOTE_CREATE = true;
});

describe.each([
  ['process_flow', 'przepływ procesu' /* not asserted, just for readability */],
  ['table', 'tabelę pomysłów'],
  ['whiteboard', 'tablicę'],
] as const)('generate_deliverable(type:%s) — canvas tools', (type) => {
  it('builds a real skeleton graph and emits onDeliverable when the flag is ON', async () => {
    const emitted: any[] = [];
    const res = await generateDeliverable(
      { type, intent: 'Temat: pierwszy, drugi, trzeci', title: 'Tytuł testowy' },
      { ...baseCtx, onDeliverable: (p) => emitted.push(p) }
    );

    expect(res.ok).toBe(true);
    expect(res.kind).toBe(type);
    expect(res.format).toBe(type);
    expect(typeof res.generationId).toBe('string');

    // NIE przechodzi przez DB-bound runtime deck/doc/sheet.
    expect(planMock).not.toHaveBeenCalled();
    expect(startMock).not.toHaveBeenCalled();

    expect(emitted).toHaveLength(1);
    const payload = emitted[0];
    expect(payload.kind).toBe(type);
    expect(payload.preferredSystem).toBe(type);
    expect(payload.graph).toBeTruthy();
    expect(Array.isArray(payload.graph.nodes)).toBe(true);
    expect(Array.isArray(payload.graph.edges)).toBe(true);
    expect(payload.graph.nodes.length).toBeGreaterThan(0);
    expect(payload.seedText).toBeTruthy();
  });

  it('refuses (feature_disabled) when ENABLE_TERESA_CANVAS_TOOLS is OFF — no fake artifact', async () => {
    flags.ENABLE_TERESA_CANVAS_TOOLS = false;
    const emitted: any[] = [];
    const res = await generateDeliverable(
      { type, intent: 'x' },
      { ...baseCtx, onDeliverable: (p) => emitted.push(p) }
    );
    expect(res.ok).toBe(false);
    expect(res.error).toBe('feature_disabled');
    expect(emitted).toHaveLength(0);
  });

  it('still gates on ENABLE_DELIVERABLES_LIGHT (co-gate) before the canvas-tools flag', async () => {
    flags.ENABLE_DELIVERABLES_LIGHT = false;
    const res = await generateDeliverable({ type, intent: 'x' }, baseCtx);
    expect(res.ok).toBe(false);
    expect(res.error).toBe('feature_disabled');
  });

  it('refuses for VIEWER role (shared capability gate)', async () => {
    const res = await generateDeliverable({ type, intent: 'x' }, { ...baseCtx, role: 'VIEWER' });
    expect(res.ok).toBe(false);
    expect(res.error).toBe('permission_denied');
  });
});

describe('generate_deliverable(type:note)', () => {
  it('creates a real notebook page and emits onDeliverable with the DB id when the flag is ON', async () => {
    createNoteMock.mockResolvedValue({ id: 'note-123', noteId: 'note-123', title: 'Moja notatka' });
    const emitted: any[] = [];
    const res = await generateDeliverable(
      { type: 'note', intent: 'Trzeba zapamiętać X', title: 'Moja notatka' },
      { ...baseCtx, onDeliverable: (p) => emitted.push(p) }
    );

    expect(res.ok).toBe(true);
    expect(res.kind).toBe('note');
    expect(res.generationId).toBe('note-123');
    expect(createNoteMock).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-1',
        userId: 'user-1',
        title: 'Moja notatka',
        body: 'Trzeba zapamiętać X',
      })
    );

    expect(emitted).toHaveLength(1);
    expect(emitted[0].kind).toBe('note');
    expect(emitted[0].noteId).toBe('note-123');
    expect(emitted[0].graph).toBeUndefined();
  });

  it('refuses (feature_disabled) when ENABLE_TERESA_NOTE_CREATE is OFF — no fake note, no DB write', async () => {
    flags.ENABLE_TERESA_NOTE_CREATE = false;
    const res = await generateDeliverable({ type: 'note', intent: 'x' }, baseCtx);
    expect(res.ok).toBe(false);
    expect(res.error).toBe('feature_disabled');
    expect(createNoteMock).not.toHaveBeenCalled();
  });

  it('refuses for VIEWER role (shared capability gate)', async () => {
    const res = await generateDeliverable(
      { type: 'note', intent: 'x' },
      { ...baseCtx, role: 'VIEWER' }
    );
    expect(res.ok).toBe(false);
    expect(res.error).toBe('permission_denied');
    expect(createNoteMock).not.toHaveBeenCalled();
  });

  it('surfaces generation_failed when notebookService.createNote throws', async () => {
    createNoteMock.mockRejectedValue(new Error('db down'));
    const res = await generateDeliverable({ type: 'note', intent: 'x' }, baseCtx);
    expect(res.ok).toBe(false);
    expect(res.error).toBe('generation_failed');
  });
});
