import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockApi = {
  getConversation: vi.fn().mockResolvedValue({ messages: [] }),
  getConversations: vi.fn().mockResolvedValue({ conversations: [] }),
};

vi.mock('@/services/api', () => ({ Api: mockApi }));

vi.mock('@/i18n', () => ({
  isValidLanguage: (lang: string) => ['pl', 'en', 'de'].includes(lang),
}));

describe('useConversationStore chat root rehydration', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.useRealTimers();
    localStorage.clear();
    window.history.replaceState({}, '', '/');
  });

  it('does not restore a stale active conversation on /chat', async () => {
    (window.location as Location & { pathname: string }).pathname = '/chat';
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
    (window.location as Location & { pathname: string }).pathname = '/chat/deep-linked-id';
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
});
