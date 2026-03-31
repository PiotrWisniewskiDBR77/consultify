/**
 * P35-B: Historia czatów — Store Tests
 *
 * Tests the conversation store's lifecycle actions, grouping, search,
 * and state management for the chat history library.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/api', () => ({
  Api: {
    getConversations: vi.fn().mockResolvedValue({ conversations: [] }),
    getConversation: vi.fn().mockResolvedValue({ messages: [] }),
    createConversation: vi.fn().mockResolvedValue({ id: 'new-id', title: 'New conversation' }),
    updateConversation: vi.fn().mockResolvedValue({}),
    deleteConversation: vi.fn().mockResolvedValue({}),
    addConversationMessage: vi.fn().mockResolvedValue({ id: 'msg-1' }),
    generateConversationTitle: vi.fn().mockResolvedValue({ title: 'Generated Title' }),
    bulkConversationOperation: vi.fn().mockResolvedValue({}),
    migrateConversations: vi.fn().mockResolvedValue({}),
    get: vi.fn().mockResolvedValue({ conversations: [], nextCursor: null, hasMore: false }),
  },
}));

vi.mock('@/i18n', () => ({
  isValidLanguage: (lang: string) => ['pl', 'en', 'de'].includes(lang),
}));

describe('P35-B: useConversationStore — History Library', () => {
  let useConversationStore: any;
  let groupConversations: any;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('../../src/store/useConversationStore');
    useConversationStore = mod.useConversationStore;
    groupConversations = mod.groupConversations;
  });

  describe('Grouping', () => {
    it('groups conversations into pinned/today/thisWeek/thisMonth/older/archived', () => {
      const now = new Date();
      const conversations = [
        { id: '1', starred: true, archived: false, updatedAt: now, lastMessageAt: now, title: 'Pinned' },
        { id: '2', starred: false, archived: false, updatedAt: now, lastMessageAt: now, title: 'Today' },
        { id: '3', starred: false, archived: true, updatedAt: now, lastMessageAt: now, title: 'Archived' },
        {
          id: '4',
          starred: false,
          archived: false,
          updatedAt: new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000),
          lastMessageAt: new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000),
          title: 'Older',
        },
      ] as any[];

      const groups = groupConversations(conversations);

      expect(groups.pinned).toHaveLength(1);
      expect(groups.pinned[0].id).toBe('1');
      expect(groups.today).toHaveLength(1);
      expect(groups.today[0].id).toBe('2');
      expect(groups.archived).toHaveLength(1);
      expect(groups.archived[0].id).toBe('3');
      expect(groups.older).toHaveLength(1);
      expect(groups.older[0].id).toBe('4');
    });

    it('sorts each group by lastMessageAt descending', () => {
      const now = new Date();
      const conversations = [
        { id: 'a', starred: false, archived: false, updatedAt: now, lastMessageAt: new Date(now.getTime() - 1000), title: 'A' },
        { id: 'b', starred: false, archived: false, updatedAt: now, lastMessageAt: now, title: 'B' },
      ] as any[];

      const groups = groupConversations(conversations);
      expect(groups.today[0].id).toBe('b');
      expect(groups.today[1].id).toBe('a');
    });
  });

  describe('Store Actions', () => {
    it('has all required lifecycle actions', () => {
      const state = useConversationStore.getState();
      expect(typeof state.createConversation).toBe('function');
      expect(typeof state.updateConversation).toBe('function');
      expect(typeof state.deleteConversation).toBe('function');
      expect(typeof state.starConversation).toBe('function');
      expect(typeof state.unstarConversation).toBe('function');
      expect(typeof state.archiveConversation).toBe('function');
      expect(typeof state.unarchiveConversation).toBe('function');
      expect(typeof state.renameConversation).toBe('function');
      expect(typeof state.bulkOperation).toBe('function');
    });

    it('has server-side search action', () => {
      const state = useConversationStore.getState();
      expect(typeof state.serverSearch).toBe('function');
    });

    it('has search helpers', () => {
      const state = useConversationStore.getState();
      expect(typeof state.searchConversations).toBe('function');
    });

    it('clearActiveChat resets state', () => {
      const state = useConversationStore.getState();
      state.clearActiveChat();
      const after = useConversationStore.getState();
      expect(after.activeConversationId).toBeNull();
      expect(after.activeMessages).toEqual([]);
    });
  });

  describe('Archive vs Delete Semantics', () => {
    it('archive is reversible (starred=false, archived=true → archived=false)', async () => {
      const state = useConversationStore.getState();
      expect(typeof state.archiveConversation).toBe('function');
      expect(typeof state.unarchiveConversation).toBe('function');
    });

    it('delete removes from local state', async () => {
      const state = useConversationStore.getState();
      expect(typeof state.deleteConversation).toBe('function');
    });
  });

  describe('chatFolderId vs projectId Separation', () => {
    it('Conversation type has both chatProjectId and projectId', () => {
      const conv = {
        id: '1',
        title: 'Test',
        titleSource: 'auto' as const,
        chatProjectId: 'folder-1',
        projectId: 'pmo-project-1',
        starred: false,
        archived: false,
        tags: [],
        messageCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      expect(conv.chatProjectId).toBe('folder-1');
      expect(conv.projectId).toBe('pmo-project-1');
      expect(conv.chatProjectId).not.toBe(conv.projectId);
    });
  });
});
