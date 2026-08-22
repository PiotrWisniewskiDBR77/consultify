import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockApi = {
  getConversation: vi.fn().mockResolvedValue({ messages: [] }),
  getConversations: vi.fn().mockResolvedValue({ conversations: [] }),
  addConversationMessage: vi.fn(),
};

vi.mock('@/services/api', () => ({ Api: mockApi }));

vi.mock('@/i18n', () => ({
  isValidLanguage: (lang: string) => ['pl', 'en', 'de'].includes(lang),
  normalizeLanguageCode: (lang: string) => lang,
}));

const setTestPath = (path: string) => {
  (window.location as Location & { pathname: string }).pathname = path;
};

describe('useConversationStore chat root rehydration', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.useRealTimers();
    localStorage.clear();
    setTestPath('/');
  });

  it('does not restore a stale active conversation on /chat', async () => {
    setTestPath('/chat');
    expect(window.location.pathname).toBe('/chat');
    vi.useFakeTimers();
    localStorage.setItem('token', 'test-token');
    localStorage.setItem(
      'consultify-conversations',
      JSON.stringify({
        state: {
          activeConversationId: 'stale-conversation-id',
          displayMode: 'full',
          draftChatLanguage: 'pl',
          chatLanguageByConversationId: {},
        },
        version: 2,
      })
    );

    const { useConversationStore } = await import('../../src/store/useConversationStore');

    expect(useConversationStore.getState().activeConversationId).toBeNull();

    await vi.runAllTimersAsync();

    expect(mockApi.getConversation).not.toHaveBeenCalled();
    expect(useConversationStore.getState().activeConversationId).toBeNull();
  });

  it('still restores a deep-linked conversation on /chat/:id', async () => {
    setTestPath('/chat/deep-linked-id');
    vi.useFakeTimers();
    localStorage.setItem('token', 'test-token');
    localStorage.setItem(
      'consultify-conversations',
      JSON.stringify({
        state: {
          activeConversationId: 'deep-linked-id',
          displayMode: 'full',
          draftChatLanguage: 'pl',
          chatLanguageByConversationId: {},
        },
        version: 2,
      })
    );

    const { useConversationStore } = await import('../../src/store/useConversationStore');

    expect(useConversationStore.getState().activeConversationId).toBe('deep-linked-id');

    await vi.runAllTimersAsync();

    expect(mockApi.getConversation).toHaveBeenCalledWith('deep-linked-id');
  });

  it('quarantines a deep-linked conversation after a 404 and stops rehydration', async () => {
    setTestPath('/chat/missing-id');
    const replaceStateSpy = vi.spyOn(window.history, 'replaceState');
    const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent');
    vi.useFakeTimers();
    localStorage.setItem('token', 'test-token');
    mockApi.getConversation.mockRejectedValueOnce({ status: 404 });
    localStorage.setItem(
      'consultify-conversations',
      JSON.stringify({
        state: {
          activeConversationId: 'missing-id',
          conversations: [
            {
              id: 'missing-id',
              title: 'Missing',
              titleSource: 'auto',
              messageCount: 0,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ],
          displayMode: 'full',
          draftChatLanguage: 'pl',
          chatLanguageByConversationId: {},
        },
        version: 2,
      })
    );

    const { useConversationStore } = await import('../../src/store/useConversationStore');

    await vi.runAllTimersAsync();

    expect(mockApi.getConversation).toHaveBeenCalledTimes(1);
    expect(mockApi.getConversation).toHaveBeenCalledWith('missing-id');
    expect(replaceStateSpy).toHaveBeenCalledWith(null, '', '/chat');
    expect(dispatchEventSpy).toHaveBeenCalledWith(expect.any(PopStateEvent));
    expect(useConversationStore.getState().activeConversationId).toBeNull();
    expect(useConversationStore.getState().isLoading).toBe(false);
    expect(useConversationStore.getState()._activeConversationState).toBe('not_found');
    expect(JSON.parse(localStorage.getItem('consultify-missing-conversations') || '[]')).toContain(
      'missing-id'
    );
  });

  it('hard-stops a deep-linked conversation after a 401 without keeping it active', async () => {
    setTestPath('/chat/unauthorized-id');
    const replaceStateSpy = vi.spyOn(window.history, 'replaceState');
    vi.useFakeTimers();
    localStorage.setItem('token', 'test-token');
    mockApi.getConversation.mockRejectedValueOnce({ status: 401 });
    localStorage.setItem(
      'consultify-conversations',
      JSON.stringify({
        state: {
          activeConversationId: 'unauthorized-id',
          displayMode: 'full',
          draftChatLanguage: 'pl',
          chatLanguageByConversationId: {},
        },
        version: 2,
      })
    );

    const { useConversationStore } = await import('../../src/store/useConversationStore');

    await vi.runAllTimersAsync();

    expect(mockApi.getConversation).toHaveBeenCalledTimes(1);
    expect(replaceStateSpy).not.toHaveBeenCalled();
    expect(window.location.pathname).toBe('/chat/unauthorized-id');
    expect(useConversationStore.getState().activeConversationId).toBeNull();
    expect(useConversationStore.getState().isLoading).toBe(false);
    expect(useConversationStore.getState()._activeConversationState).toBe('permission_denied');
  });

  it('retries a pre-login 401 immediately after authentication instead of deduping it', async () => {
    setTestPath('/chat/auth-race-id');
    vi.useFakeTimers();
    localStorage.setItem('token', 'pre-login-token');
    mockApi.getConversation
      .mockRejectedValueOnce({ status: 401 })
      .mockResolvedValueOnce({
        id: 'auth-race-id',
        language: 'en',
        messages: [
          {
            id: 'server-message',
            conversation_id: 'auth-race-id',
            role: 'ai',
            content: 'Durable conversation restored',
            message_type: 'text',
            created_at: '2026-08-21T08:00:00.000Z',
          },
        ],
      });
    localStorage.setItem(
      'consultify-conversations',
      JSON.stringify({
        state: {
          activeConversationId: 'auth-race-id',
          displayMode: 'full',
          draftChatLanguage: 'en',
          chatLanguageByConversationId: {},
        },
        version: 2,
      })
    );

    const { useConversationStore } = await import('../../src/store/useConversationStore');
    await vi.runAllTimersAsync();

    expect(useConversationStore.getState()._activeConversationState).toBe('permission_denied');
    await useConversationStore.getState().fetchConversation('auth-race-id');

    expect(mockApi.getConversation).toHaveBeenCalledTimes(2);
    expect(useConversationStore.getState().activeConversationId).toBe('auth-race-id');
    expect(useConversationStore.getState().activeMessages.map((message) => message.id)).toEqual([
      'server-message',
    ]);
  });

  it('does not fetch a deep-linked conversation already marked missing', async () => {
    setTestPath('/chat/already-missing');
    const replaceStateSpy = vi.spyOn(window.history, 'replaceState');
    vi.useFakeTimers();
    localStorage.setItem('token', 'test-token');
    localStorage.setItem('consultify-missing-conversations', JSON.stringify(['already-missing']));
    localStorage.setItem(
      'consultify-conversations',
      JSON.stringify({
        state: {
          activeConversationId: 'already-missing',
          displayMode: 'full',
          draftChatLanguage: 'pl',
          chatLanguageByConversationId: {},
        },
        version: 2,
      })
    );

    const { useConversationStore } = await import('../../src/store/useConversationStore');

    await vi.runAllTimersAsync();

    expect(mockApi.getConversation).not.toHaveBeenCalled();
    expect(replaceStateSpy).toHaveBeenCalledWith(null, '', '/chat');
    expect(useConversationStore.getState().activeConversationId).toBeNull();
    expect(useConversationStore.getState()._activeConversationState).toBe('not_found');
  });

  it('restores persisted messages for the deep-linked conversation while backend hydration runs', async () => {
    setTestPath('/chat/deep-linked-id');
    vi.useFakeTimers();
    localStorage.setItem('token', 'test-token');
    localStorage.setItem(
      'consultify-conversations',
      JSON.stringify({
        state: {
          activeMessages: [
            {
              id: 'persisted-message-id',
              conversationId: 'deep-linked-id',
              role: 'user',
              content: 'Persisted refresh fallback',
              messageType: 'text',
              metadata: null,
              createdAt: new Date().toISOString(),
            },
            {
              id: 'other-message-id',
              conversationId: 'other-id',
              role: 'user',
              content: 'Wrong conversation',
              messageType: 'text',
              metadata: null,
              createdAt: new Date().toISOString(),
            },
          ],
          displayMode: 'full',
          draftChatLanguage: 'pl',
          chatLanguageByConversationId: {},
        },
        version: 2,
      })
    );

    const { useConversationStore } = await import('../../src/store/useConversationStore');

    expect(useConversationStore.getState().activeConversationId).toBe('deep-linked-id');
    expect(useConversationStore.getState().activeMessages).toHaveLength(1);
    expect(useConversationStore.getState().activeMessages[0].content).toBe(
      'Persisted refresh fallback'
    );

    await vi.runAllTimersAsync();

    expect(mockApi.getConversation).toHaveBeenCalledWith('deep-linked-id');
  });

  it('does not restore a stale active conversation on non-chat routes', async () => {
    setTestPath('/ai/artifacts');
    vi.useFakeTimers();
    localStorage.setItem('token', 'test-token');
    localStorage.setItem(
      'consultify-conversations',
      JSON.stringify({
        state: {
          activeConversationId: 'stale-conversation-id',
          displayMode: 'full',
          draftChatLanguage: 'pl',
          chatLanguageByConversationId: {},
        },
        version: 2,
      })
    );

    const { useConversationStore } = await import('../../src/store/useConversationStore');

    expect(useConversationStore.getState().activeConversationId).toBeNull();

    await vi.runAllTimersAsync();

    expect(mockApi.getConversation).not.toHaveBeenCalled();
  });

  it('keeps the optimistic message when message persistence returns null', async () => {
    mockApi.addConversationMessage.mockResolvedValueOnce(null);
    const { useConversationStore } = await import('../../src/store/useConversationStore');

    useConversationStore.setState({
      activeConversationId: 'conversation-id',
      activeMessages: [],
      conversations: [
        {
          id: 'conversation-id',
          title: 'New conversation',
          titleSource: 'auto',
          messageCount: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any,
      ],
    });

    const saved = await useConversationStore.getState().addMessage({
      conversationId: 'conversation-id',
      role: 'user',
      content: 'QA TEST chat persistence',
      messageType: 'text',
      metadata: null as any,
    });

    expect(saved.content).toBe('QA TEST chat persistence');
    expect(saved.metadata).toMatchObject({ local: true, serverAckMissing: true });
    expect(useConversationStore.getState().activeMessages).toHaveLength(1);
    expect(useConversationStore.getState().activeMessages[0].content).toBe(
      'QA TEST chat persistence'
    );
    expect(mockApi.addConversationMessage).toHaveBeenCalledWith(
      'conversation-id',
      expect.objectContaining({ metadata: {} })
    );
  });
});
