/**
 * M06 Fala 2 · 2.3 — generate_deliverable(type:'mindmap').
 *
 * Weryfikuje kontrakt mapy myśli jako celu generacji Teresy:
 *  - flaga ENABLE_TERESA_MINDMAP OFF → feature_disabled (bez fejka),
 *  - flaga ON → buduje REALNY szkielet {nodes,edges} i emituje onDeliverable
 *    z kind:'mindmap' + graph (root + gałęzie z intentu),
 *  - mind map NIE woła plan()/start() serwisu generacji (nie jest DB-bound),
 *  - VIEWER nadal odrzucony (bramka uprawnień wspólna z resztą deliverable).
 *
 * Realny generator TREŚCI mapy przez LLM → [REAL-AI] nightly (nie tu).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { planMock, startMock, flags } = vi.hoisted(() => ({
  planMock: vi.fn(),
  startMock: vi.fn(),
  flags: { ENABLE_DELIVERABLES_LIGHT: true, ENABLE_TERESA_MINDMAP: true },
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

// naprawa-c1Graph: this test asserts the DETERMINISTIC skeleton mind-map path.
// Force the LLM generator to null (fail-soft) so the skeleton fallback runs.
vi.mock('../../../server/src/services/ai/canvasGraphLlm.js', async () => {
  const actual = await vi.importActual<typeof import('../../../server/src/services/ai/canvasGraphLlm.js')>(
    '../../../server/src/services/ai/canvasGraphLlm.js'
  );
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
  flags.ENABLE_DELIVERABLES_LIGHT = true;
  flags.ENABLE_TERESA_MINDMAP = true;
});

describe('generate_deliverable(type:mindmap) — M06 Fala 2 · 2.3', () => {
  it('builds a real skeleton graph and emits onDeliverable(kind:mindmap) when the flag is ON', async () => {
    const emitted: any[] = [];
    const res = await generateDeliverable(
      {
        type: 'mindmap',
        intent: 'Mapa myśli o transformacji cyfrowej: ludzie, procesy, technologia',
        title: 'Transformacja cyfrowa',
      },
      { ...baseCtx, onDeliverable: (p) => emitted.push(p) }
    );

    expect(res.ok).toBe(true);
    expect(res.kind).toBe('mindmap');
    expect(res.format).toBe('mindmap');
    expect(typeof res.generationId).toBe('string');

    // NIE przechodzi przez DB-bound runtime deck/doc/sheet.
    expect(planMock).not.toHaveBeenCalled();
    expect(startMock).not.toHaveBeenCalled();

    // Most do frontu niesie realny graf {nodes,edges}.
    expect(emitted).toHaveLength(1);
    const payload = emitted[0];
    expect(payload.kind).toBe('mindmap');
    expect(payload.format).toBe('mindmap');
    expect(payload.graph).toBeTruthy();
    expect(Array.isArray(payload.graph.nodes)).toBe(true);
    expect(Array.isArray(payload.graph.edges)).toBe(true);

    // Root (center) + 3 gałęzie z listy po dwukropku.
    const center = payload.graph.nodes.find((n: any) => n.type === 'center');
    expect(center).toBeTruthy();
    expect(center.data.label).toBe('Transformacja cyfrowa');
    const branchLabels = payload.graph.nodes
      .filter((n: any) => n.type === 'branch')
      .map((n: any) => n.data.label.toLowerCase());
    expect(branchLabels).toEqual(
      expect.arrayContaining(['ludzie', 'procesy', 'technologia'])
    );
    // Każda gałąź spięta krawędzią z centrum.
    expect(payload.graph.edges.length).toBe(branchLabels.length);
    for (const e of payload.graph.edges) {
      expect(e.source).toBe('center');
    }

    // seedText do rozwinięcia AI po stronie Ideas.
    expect(payload.seedText).toBeTruthy();
  });

  it('emits a valid root-only map when the intent has no parseable list', async () => {
    const emitted: any[] = [];
    const res = await generateDeliverable(
      { type: 'mindmap', intent: 'Pomysły na nowy produkt' },
      { ...baseCtx, onDeliverable: (p) => emitted.push(p) }
    );
    expect(res.ok).toBe(true);
    const graph = emitted[0].graph;
    expect(graph.nodes.length).toBeGreaterThanOrEqual(1);
    expect(graph.nodes.some((n: any) => n.type === 'center')).toBe(true);
  });

  it('refuses (feature_disabled) when ENABLE_TERESA_MINDMAP is OFF — no fake map', async () => {
    flags.ENABLE_TERESA_MINDMAP = false;
    const emitted: any[] = [];
    const res = await generateDeliverable(
      { type: 'mindmap', intent: 'x' },
      { ...baseCtx, onDeliverable: (p) => emitted.push(p) }
    );
    expect(res.ok).toBe(false);
    expect(res.error).toBe('feature_disabled');
    expect(emitted).toHaveLength(0);
  });

  it('still gates on ENABLE_DELIVERABLES_LIGHT (co-gate) before mindmap flag', async () => {
    flags.ENABLE_DELIVERABLES_LIGHT = false;
    const res = await generateDeliverable({ type: 'mindmap', intent: 'x' }, baseCtx);
    expect(res.ok).toBe(false);
    expect(res.error).toBe('feature_disabled');
  });

  it('refuses mindmap for VIEWER role (shared capability gate)', async () => {
    const res = await generateDeliverable(
      { type: 'mindmap', intent: 'x' },
      { ...baseCtx, role: 'VIEWER' }
    );
    expect(res.ok).toBe(false);
    expect(res.error).toBe('permission_denied');
  });
});
