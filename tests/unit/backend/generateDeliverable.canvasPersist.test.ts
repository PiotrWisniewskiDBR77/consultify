/**
 * Canvas persistence fix (2026-07-08) — generate_deliverable(mindmap /
 * process_flow / table / whiteboard) must materialize a REAL my_ideas /
 * my_idea_maps row server-side (canvasMaterialize.ts, target:'idea') and hand
 * the frontend that real id, instead of the old `chat-<kind>-<ts>`
 * placeholder that depended entirely on IdeaMapWorkspace's mount effect to
 * ever persist anything.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

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

vi.mock('../../../server/src/services/ai/canvasGraphLlm.js', () => ({
  generateMindmapGraph: vi.fn().mockResolvedValue(null),
  generateProcessFlowGraph: vi.fn().mockResolvedValue(null),
  generateWhiteboardGraph: vi.fn().mockResolvedValue(null),
  generateTableGraph: vi.fn().mockResolvedValue(null),
  generateNoteContent: vi.fn().mockResolvedValue(null),
}));

const materializeOrThrowMock = vi.fn();
vi.mock('../../../server/src/services/canvasMaterialize.js', () => ({
  materializeOrThrow: (...args: unknown[]) => materializeOrThrowMock(...args),
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
  flags.ENABLE_DELIVERABLES_LIGHT = true;
  flags.ENABLE_TERESA_MINDMAP = true;
  flags.ENABLE_TERESA_CANVAS_TOOLS = true;
});

describe('generate_deliverable — canvas tools persist via canvasMaterialize (server-side, not FE-contingent)', () => {
  it('mindmap: uses the real materialized idea id as draftId/generationId, not chat-mindmap-<ts>', async () => {
    materializeOrThrowMock.mockResolvedValue({ type: 'idea', id: 'idea-1720000000000-abc12345', title: 'X' });
    const emitted: any[] = [];

    const res = await generateDeliverable(
      { type: 'mindmap', intent: 'Plan: ludzie, procesy, technologia', title: 'Plan' },
      { ...baseCtx, onDeliverable: (p) => emitted.push(p) }
    );

    expect(res.ok).toBe(true);
    expect(res.draftId).toBe('idea-1720000000000-abc12345');
    expect(res.generationId).toBe('idea-1720000000000-abc12345');
    expect(emitted[0].draftId).toBe('idea-1720000000000-abc12345');

    expect(materializeOrThrowMock).toHaveBeenCalledTimes(1);
    const [input, ctx] = materializeOrThrowMock.mock.calls[0];
    expect(input.target).toBe('idea');
    expect(input.organizationId).toBe('org-1');
    expect(input.actorUserId).toBe('user-1');
    expect(input.preferredTool).toBe('mindmap');
    expect(input.sourceType).toBe('teresa_chat');
    expect(Array.isArray(input.graph.nodes)).toBe(true);
    expect(ctx).toEqual({ writer: 'chat_deliverable' });
  });

  it('mindmap: falls back to the old chat-mindmap-<ts> placeholder id when materialize throws (fail-soft, chat turn still succeeds)', async () => {
    materializeOrThrowMock.mockRejectedValue(new Error('db unavailable'));
    const emitted: any[] = [];

    const res = await generateDeliverable(
      { type: 'mindmap', intent: 'Plan: ludzie, procesy', title: 'Plan' },
      { ...baseCtx, onDeliverable: (p) => emitted.push(p) }
    );

    expect(res.ok).toBe(true);
    expect(String(res.draftId)).toMatch(/^chat-mindmap-\d+$/);
    expect(emitted).toHaveLength(1);
  });

  it.each(['process_flow', 'table', 'whiteboard'] as const)(
    '%s: uses the real materialized idea id, with preferredTool set to the tool kind',
    async (kind) => {
      materializeOrThrowMock.mockResolvedValue({
        type: 'idea',
        id: 'idea-1720000000001-def67890',
        title: 'X',
      });
      const emitted: any[] = [];

      const res = await generateDeliverable(
        { type: kind, intent: 'Zbuduj to od zera', title: 'Tytuł' },
        { ...baseCtx, onDeliverable: (p) => emitted.push(p) }
      );

      expect(res.ok).toBe(true);
      expect(res.draftId).toBe('idea-1720000000001-def67890');
      const [input] = materializeOrThrowMock.mock.calls[0];
      expect(input.preferredTool).toBe(kind);
      expect(input.target).toBe('idea');
    }
  );

  it('process_flow: falls back to the old chat-<kind>-<ts> id when materialize throws', async () => {
    materializeOrThrowMock.mockRejectedValue(new Error('constraint violation'));
    const res = await generateDeliverable(
      { type: 'process_flow', intent: 'Zbuduj proces', title: 'Proces' },
      baseCtx
    );
    expect(res.ok).toBe(true);
    expect(String(res.draftId)).toMatch(/^chat-process_flow-\d+$/);
  });
});
