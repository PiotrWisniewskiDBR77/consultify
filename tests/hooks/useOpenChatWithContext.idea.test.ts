/**
 * @vitest-environment jsdom
 *
 * useOpenChatWithContext — Ideas / Mind Map sidekick bridge (M06 Fala 2 §2.1)
 *
 * Verifies (without any LLM call):
 * 1. `idea-mindmap-sidekick-context` events populate a ref the hook reads on open,
 *    so the kickoff prompt carries the sidekick's promptHint and pmoContext gets
 *    `ideaId` — behind flag `ENABLE_TERESA_MINDMAP`.
 * 2. Opening chat twice for the SAME ideaId reuses the existing conversation
 *    (alreadyHasContext matches on pmoContext.ideaId) instead of creating a new one.
 * 3. Flag OFF preserves today's behavior: no `ideaId` in pmoContext, and
 *    `alreadyHasContext` never matches on idea entities (matches pre-Fala-2 gap).
 */
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useOpenChatWithContext } from '@/hooks/useOpenChatWithContext';

// ---------------------------------------------------------------------------
// Mock stores
// ---------------------------------------------------------------------------
const createConversation = vi.fn();
const setWorkspaceContext = vi.fn();
const setActiveConversation = vi.fn();

let mockConversations: any[] = [];
let mockActiveConversationId: string | null = null;

vi.mock('@/store/useConversationStore', () => {
  const storeFn: any = (selector?: any) => {
    const state = {
      activeConversationId: mockActiveConversationId,
      conversations: mockConversations,
      createConversation,
      setWorkspaceContext,
      setActiveConversation,
    };
    return selector ? selector(state) : state;
  };
  storeFn.getState = () => ({
    activeConversationId: mockActiveConversationId,
    conversations: mockConversations,
    createConversation,
    setWorkspaceContext,
    setActiveConversation,
  });
  return { useConversationStore: storeFn };
});

vi.mock('@/store/useAppStore', () => {
  const state = {
    isChatCollapsed: true,
    toggleChatCollapse: vi.fn(),
    setCurrentViewState: vi.fn(),
    navigateFn: vi.fn(),
  };
  const storeFn: any = (selector?: any) => (selector ? selector(state) : state);
  storeFn.getState = () => state;
  return { useAppStore: storeFn };
});

vi.mock('@/hooks/useDeviceType', () => ({
  useDeviceType: () => ({ isMobile: false, isTablet: false, isDesktop: true }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

// Feature flag toggle for this test file — overrides the global setup.ts mock.
let mindmapFlagEnabled = false;
vi.mock('@/contexts/FeatureFlagsContext', () => ({
  useFeatureFlagsContext: () => ({
    isEnabled: (id: string) => (id === 'ENABLE_TERESA_MINDMAP' ? mindmapFlagEnabled : false),
  }),
}));

describe('useOpenChatWithContext — mindmap sidekick bridge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConversations = [];
    mockActiveConversationId = null;
    mindmapFlagEnabled = false;
    window.sessionStorage.clear();
  });

  it('flag ON: sidekick event enriches kickoff prompt + pmoContext carries ideaId', async () => {
    mindmapFlagEnabled = true;
    createConversation.mockResolvedValue({ id: 'conv-1' });

    const { result } = renderHook(() => useOpenChatWithContext());

    // Simulate the mind map dispatching its latest sidekick context.
    act(() => {
      window.dispatchEvent(
        new CustomEvent('idea-mindmap-sidekick-context', {
          detail: {
            intent: 'expanding_branch',
            promptHint: 'Expand this branch with more ideas',
            promptHintPl: 'Rozwiń tę gałąź o więcej pomysłów',
            suggestedActions: ['mm_ai_expand_node'],
            ideaId: 'idea-42',
            ideaTitle: 'Growth strategy',
          },
        })
      );
    });

    await act(async () => {
      await result.current({
        entityType: 'idea',
        entityId: 'idea-42',
        entityName: 'Growth strategy',
        contextData: { teresaPrompt: 'Here is the mind map outline...' },
      });
    });

    expect(createConversation).toHaveBeenCalledTimes(1);
    const createArgs = createConversation.mock.calls[0][0];
    expect(createArgs.pmoContext.ideaId).toBe('idea-42');

    const pending = JSON.parse(
      window.sessionStorage.getItem('consultify.teresa.pendingPrompt') || '{}'
    );
    expect(pending.prompt).toContain('Here is the mind map outline...');
    expect(pending.prompt).toContain('Expand this branch with more ideas');
    expect(pending.entityId).toBe('idea-42');
  });

  it('flag ON: second click on the SAME ideaId reuses the conversation (no new create)', async () => {
    mindmapFlagEnabled = true;
    createConversation.mockResolvedValue({ id: 'conv-reuse' });

    const { result } = renderHook(() => useOpenChatWithContext());

    await act(async () => {
      await result.current({ entityType: 'idea', entityId: 'idea-99', entityName: 'Map A' });
    });
    expect(createConversation).toHaveBeenCalledTimes(1);

    // Now the active conversation already carries pmoContext.ideaId === 'idea-99'.
    mockActiveConversationId = 'conv-reuse';
    mockConversations = [{ id: 'conv-reuse', pmoContext: { ideaId: 'idea-99' } }];

    await act(async () => {
      await result.current({ entityType: 'idea', entityId: 'idea-99', entityName: 'Map A' });
    });

    // Still only one creation — the second call matched alreadyHasContext and reused it.
    expect(createConversation).toHaveBeenCalledTimes(1);
    expect(setWorkspaceContext).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: 'idea', entityId: 'idea-99' })
    );
  });

  it('flag OFF: pmoContext has no ideaId', async () => {
    mindmapFlagEnabled = false;
    createConversation.mockResolvedValue({ id: 'conv-legacy' });

    const { result } = renderHook(() => useOpenChatWithContext());

    await act(async () => {
      await result.current({ entityType: 'idea', entityId: 'idea-1', entityName: 'Map B' });
    });

    const createArgs = createConversation.mock.calls[0][0];
    expect(createArgs.pmoContext.ideaId).toBeUndefined();
  });

  it('flag OFF: idea entities never match alreadyHasContext even if pmoContext.ideaId is set', async () => {
    mindmapFlagEnabled = false;

    // A conversation already exists carrying pmoContext.ideaId (e.g. written
    // while the flag was ON, then toggled OFF, or via some other path) — with
    // the flag OFF the hook must NOT treat this as "already has context" for
    // ideas, preserving the legacy pre-Fala-2 gap intentionally (§0.2 of the
    // plan): every click creates a fresh conversation when the flag is off.
    mockActiveConversationId = 'conv-existing';
    mockConversations = [{ id: 'conv-existing', pmoContext: { ideaId: 'idea-legacy-check' } }];
    createConversation.mockResolvedValue({ id: 'conv-new' });

    const { result } = renderHook(() => useOpenChatWithContext());

    await act(async () => {
      await result.current({
        entityType: 'idea',
        entityId: 'idea-legacy-check',
        entityName: 'Map C',
      });
    });

    expect(createConversation).toHaveBeenCalledTimes(1);
  });

  it('reuses the active Teresa conversation across Artifact Studio contexts when requested', async () => {
    mockActiveConversationId = 'conv-artifact-studio';
    mockConversations = [
      { id: 'conv-artifact-studio', pmoContext: { reportId: 'document-previous' } },
    ];

    const { result } = renderHook(() => useOpenChatWithContext());

    await act(async () => {
      await result.current({
        entityType: 'presentation',
        entityId: 'deck-next',
        entityName: 'Board deck',
        reuseActiveConversation: true,
        contextData: { activeSlideId: 'slide-2' },
      });
    });

    expect(createConversation).not.toHaveBeenCalled();
    expect(setWorkspaceContext).toHaveBeenLastCalledWith({
      type: 'presentation',
      entityId: 'deck-next',
      entityName: 'Board deck',
      entityData: { activeSlideId: 'slide-2' },
    });
  });

  it('keeps the default new-conversation behavior for a different entity', async () => {
    mockActiveConversationId = 'conv-existing';
    mockConversations = [{ id: 'conv-existing', pmoContext: { reportId: 'document-1' } }];
    createConversation.mockResolvedValue({ id: 'conv-new' });

    const { result } = renderHook(() => useOpenChatWithContext());

    await act(async () => {
      await result.current({
        entityType: 'presentation',
        entityId: 'deck-2',
        entityName: 'Another deck',
      });
    });

    expect(createConversation).toHaveBeenCalledTimes(1);
  });
});
