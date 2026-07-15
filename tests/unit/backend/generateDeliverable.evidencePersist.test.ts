/**
 * HP-17 bridge — canvas (mindmap / process_flow) must persist its inline HP-16
 * `EvidenceContract` as an `EvidenceEnvelope` via `evidenceEnvelopeService.
 * upsertEnvelope` (artifactType='canvas'), not just ride along in
 * `my_idea_maps.extensions_json`. Before this bridge, the contract survived a
 * reload (extensions_json) but was invisible to the evidence panel (fala 9,
 * ArtifactRightPanel), which fetches from the polymorphic `artifact_evidence`
 * table via `/evidence/:type/:id`.
 *
 * Mirrors the mocking pattern of `generateDeliverable.canvasPersist.test.ts`
 * (canvasMaterialize + real HP-16 evidence builders), adding a mock for
 * `evidenceEnvelopeService.js` (the real `evidenceContractBridge.ts` is left
 * unmocked so the mapping + fire-and-forget call is exercised for real).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { flags } = vi.hoisted(() => ({
  flags: {
    ENABLE_DELIVERABLES_LIGHT: true,
    ENABLE_TERESA_MINDMAP: true,
    ENABLE_TERESA_CANVAS_TOOLS: true,
  },
}));

vi.mock('../../../server/src/config/FeatureFlags.js', () => ({
  featureFlags: flags,
}));

vi.mock('../../../server/src/services/presentationAccessPolicyService.js', () => ({
  hasPresentationCapability: (role: string) =>
    ['ADMIN', 'OWNER', 'EDITOR', 'MEMBER', 'SUPERADMIN'].includes(String(role).toUpperCase()),
}));

vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

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
    // Real (unmocked) pure evidence builders — deterministic, zero I/O.
    buildMindmapEvidenceContract: actual.buildMindmapEvidenceContract,
    buildProcessFlowEvidenceContract: actual.buildProcessFlowEvidenceContract,
  };
});

const materializeOrThrowMock = vi.fn();
vi.mock('../../../server/src/services/canvasMaterialize.js', () => ({
  materializeOrThrow: (...args: unknown[]) => materializeOrThrowMock(...args),
}));

const upsertEnvelope = vi.fn().mockResolvedValue({ id: 'envelope-1' });
vi.mock('../../../server/src/services/evidence/evidenceEnvelopeService.js', () => ({
  default: { upsertEnvelope, getEnvelope: vi.fn().mockResolvedValue(null) },
  upsertEnvelope,
  getEnvelope: vi.fn().mockResolvedValue(null),
}));

import { generateDeliverable } from '../../../server/src/services/ai/tools/generateDeliverable.js';

const baseCtx = {
  organizationId: 'org-1',
  userId: 'user-1',
  conversationId: 'conv-1',
  language: 'pl' as const,
  role: 'ADMIN',
};

beforeEach(() => {
  materializeOrThrowMock.mockReset();
  upsertEnvelope.mockClear();
  flags.ENABLE_DELIVERABLES_LIGHT = true;
  flags.ENABLE_TERESA_MINDMAP = true;
  flags.ENABLE_TERESA_CANVAS_TOOLS = true;
});

describe('generate_deliverable — HP-17 evidence persist (canvas)', () => {
  it('mindmap: persists the EvidenceContract as an EvidenceEnvelope (artifactType=canvas) after materialize', async () => {
    materializeOrThrowMock.mockResolvedValue({
      type: 'idea',
      id: 'idea-mindmap-1',
      title: 'X',
    });

    const res = await generateDeliverable(
      { type: 'mindmap', intent: 'Plan: ludzie, procesy, technologia', title: 'Plan' },
      baseCtx
    );

    expect(res.ok).toBe(true);
    await vi.waitFor(() => expect(upsertEnvelope).toHaveBeenCalledTimes(1));
    const input = upsertEnvelope.mock.calls[0][0];
    expect(input.artifactType).toBe('canvas');
    expect(input.artifactId).toBe('idea-mindmap-1');
    expect(input.organizationId).toBe('org-1');
    expect(input.createdBy).toBe('user-1');
    expect(input.computedBy.service).toBe('canvasGraphLlm.generateMindmapGraph');
  });

  it('mindmap: does NOT persist when materialize fails (fail-soft placeholder id has no real artifact to attach evidence to)', async () => {
    materializeOrThrowMock.mockRejectedValue(new Error('db unavailable'));

    const res = await generateDeliverable(
      { type: 'mindmap', intent: 'Plan: ludzie, procesy', title: 'Plan' },
      baseCtx
    );

    expect(res.ok).toBe(true);
    // Give any stray microtask a chance to run, then assert it never fired.
    await new Promise((r) => setTimeout(r, 10));
    expect(upsertEnvelope).not.toHaveBeenCalled();
  });

  it('process_flow: persists the EvidenceContract as an EvidenceEnvelope (artifactType=canvas)', async () => {
    materializeOrThrowMock.mockResolvedValue({
      type: 'idea',
      id: 'idea-flow-1',
      title: 'X',
    });

    const res = await generateDeliverable(
      { type: 'process_flow', intent: 'Zbuduj proces od zera', title: 'Proces' },
      baseCtx
    );

    expect(res.ok).toBe(true);
    await vi.waitFor(() => expect(upsertEnvelope).toHaveBeenCalledTimes(1));
    const input = upsertEnvelope.mock.calls[0][0];
    expect(input.artifactType).toBe('canvas');
    expect(input.artifactId).toBe('idea-flow-1');
    expect(input.computedBy.service).toBe('canvasGraphLlm.generateProcessFlowGraph');
  });

  it('table/whiteboard: never persist an envelope (HP-16 only built a real contract for process_flow)', async () => {
    materializeOrThrowMock.mockResolvedValue({
      type: 'idea',
      id: 'idea-table-1',
      title: 'X',
    });

    const res = await generateDeliverable(
      { type: 'table', intent: 'Zbuduj tabelę', title: 'Tabela' },
      baseCtx
    );

    expect(res.ok).toBe(true);
    await new Promise((r) => setTimeout(r, 10));
    expect(upsertEnvelope).not.toHaveBeenCalled();
  });
});
