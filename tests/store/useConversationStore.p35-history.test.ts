/**
 * P35-B: Historia czatów — Store Tests
 *
 * Tests the conversation store's lifecycle actions, grouping, search,
 * and state management for the chat history library.
 * All tests import and exercise real store code from src/store/useConversationStore.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockApi = {
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
};

vi.mock('@/services/api', () => ({ Api: mockApi }));

vi.mock('@/i18n', () => ({
  isValidLanguage: (lang: string) => ['pl', 'en', 'de'].includes(lang),
}));

describe('P35-B: useConversationStore — History Library', () => {
  let useConversationStore: any;
  let groupConversations: any;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    const mod = await import('../../src/store/useConversationStore');
    useConversationStore = mod.useConversationStore;
    groupConversations = mod.groupConversations;
  });

  describe('Grouping (real groupConversations function)', () => {
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

    it('empty input produces empty groups', () => {
      const groups = groupConversations([]);
      expect(groups.pinned).toHaveLength(0);
      expect(groups.today).toHaveLength(0);
      expect(groups.archived).toHaveLength(0);
    });
  });

  describe('Store Lifecycle Actions (real store)', () => {
    it('has all required lifecycle actions as functions', () => {
      const state = useConversationStore.getState();
      const requiredActions = [
        'createConversation', 'updateConversation', 'deleteConversation',
        'starConversation', 'unstarConversation',
        'archiveConversation', 'unarchiveConversation',
        'renameConversation', 'bulkOperation',
        'serverSearch', 'searchConversations',
        'fetchConversations', 'fetchConversation',
        'clearActiveChat', 'addMessage',
      ];
      for (const action of requiredActions) {
        expect(typeof state[action]).toBe('function');
      }
    });

    it('clearActiveChat resets conversation state', () => {
      const state = useConversationStore.getState();
      state.clearActiveChat();
      const after = useConversationStore.getState();
      expect(after.activeConversationId).toBeNull();
      expect(after.activeMessages).toEqual([]);
    });

    it('serverSearch calls API with correct params and returns structured result', async () => {
      mockApi.get.mockResolvedValueOnce({
        conversations: [{ id: 'found-1', title: 'Match', created_at: '2026-01-01' }],
        nextCursor: 'ts|id',
        hasMore: true,
      });

      const state = useConversationStore.getState();
      const result = await state.serverSearch({ q: 'test query', limit: 10 });

      expect(mockApi.get).toHaveBeenCalledWith(
        expect.stringContaining('/conversations/search?q=test+query')
      );
      expect(result).toHaveProperty('conversations');
      expect(result).toHaveProperty('nextCursor', 'ts|id');
      expect(result).toHaveProperty('hasMore', true);
      expect(result.partial).toBe(false);
    });

    it('serverSearch returns failed=true (not partial) on a hard API error (M01-P02 2026-08-04)', async () => {
      // Re-pointed at the corrected contract: this previously asserted
      // `partial: true`, which rendered a totally broken search as
      // "Results may be incomplete" over an empty list — indistinguishable
      // from a genuine "no matches" answer. A hard failure (network error,
      // 4xx, 5xx) must be reported as `failed`, not softened into
      // `partial` (M01-P02 packet §3.6). `partial` is now reserved for a
      // genuine subset of a response that DID come back (e.g. throttling).
      mockApi.get.mockRejectedValueOnce(new Error('Network error'));

      const state = useConversationStore.getState();
      const result = await state.serverSearch({ q: 'failing query' });

      expect(result.conversations).toEqual([]);
      expect((result as any).failed).toBe(true);
      expect(result.partial).toBe(false);
    });

    it('serverSearch returns partial=true + rateLimited=true on a 429 (genuinely degraded, not failed)', async () => {
      const rateLimitErr: any = new Error('Too Many Requests');
      rateLimitErr.status = 429;
      mockApi.get.mockRejectedValueOnce(rateLimitErr);

      const state = useConversationStore.getState();
      const result = await state.serverSearch({ q: 'throttled query' });

      expect(result.conversations).toEqual([]);
      expect((result as any).failed).toBe(false);
      expect(result.partial).toBe(true);
      expect((result as any).rateLimited).toBe(true);
    });

    it('searchConversations filters locally by title', () => {
      const state = useConversationStore.getState();
      useConversationStore.setState({
        conversations: [
          { id: '1', title: 'Alpha project', starred: false, archived: false },
          { id: '2', title: 'Beta work', starred: false, archived: false },
          { id: '3', title: 'Alpha chat', starred: false, archived: false },
        ] as any[],
      });

      const results = useConversationStore.getState().searchConversations('alpha');
      expect(results.length).toBe(2);
      expect(results.every((c: any) => c.title.toLowerCase().includes('alpha'))).toBe(true);
    });
  });

  describe('Archive vs Delete Semantics', () => {
    it('archive calls updateConversation with archived=true', async () => {
      mockApi.updateConversation.mockResolvedValueOnce({});
      useConversationStore.setState({
        conversations: [{ id: 'c1', title: 'Test', archived: false, starred: false }] as any[],
      });

      const state = useConversationStore.getState();
      await state.archiveConversation('c1');
      expect(mockApi.updateConversation).toHaveBeenCalledWith('c1', { archived: true });
    });

    it('unarchive calls updateConversation with archived=false', async () => {
      mockApi.updateConversation.mockResolvedValueOnce({});
      useConversationStore.setState({
        conversations: [{ id: 'c1', title: 'Test', archived: true, starred: false }] as any[],
      });

      const state = useConversationStore.getState();
      await state.unarchiveConversation('c1');
      expect(mockApi.updateConversation).toHaveBeenCalledWith('c1', { archived: false });
    });

    it('delete calls deleteConversation and removes from local state', async () => {
      mockApi.deleteConversation.mockResolvedValueOnce({});
      useConversationStore.setState({
        conversations: [
          { id: 'c1', title: 'Keep', archived: false, starred: false },
          { id: 'c2', title: 'Delete me', archived: false, starred: false },
        ] as any[],
      });

      const state = useConversationStore.getState();
      await state.deleteConversation('c2');
      expect(mockApi.deleteConversation).toHaveBeenCalledWith('c2');
      const after = useConversationStore.getState();
      expect(after.conversations.find((c: any) => c.id === 'c2')).toBeUndefined();
    });
  });

  describe('Write Conflict Detection (§2.3.5 E9)', () => {
    it('updateConversation sends expectedVersion from local state', async () => {
      mockApi.updateConversation.mockResolvedValueOnce({});
      useConversationStore.setState({
        conversations: [{ id: 'c1', title: 'Test', version: 5, archived: false, starred: false }] as any[],
      });

      const state = useConversationStore.getState();
      await state.updateConversation('c1', { title: 'New title' });
      expect(mockApi.updateConversation).toHaveBeenCalledWith('c1', {
        title: 'New title',
        expectedVersion: 5,
      });
    });

    it('renameConversation keeps the server-confirmed title and user title source', async () => {
      mockApi.updateConversation.mockResolvedValueOnce({
        id: 'c1',
        title: 'Renamed by user',
        title_source: 'user',
        version: 6,
        archived: false,
        starred: false,
        created_at: '2026-01-01',
        updated_at: '2026-01-02',
      });
      useConversationStore.setState({
        conversations: [
          { id: 'c1', title: 'New conversation', version: 5, archived: false, starred: false },
        ] as any[],
      });

      await useConversationStore.getState().renameConversation('c1', 'Renamed by user');

      const renamed = useConversationStore.getState().conversations.find((c: any) => c.id === 'c1');
      expect(mockApi.updateConversation).toHaveBeenCalledWith('c1', {
        title: 'Renamed by user',
        titleSource: 'user',
        expectedVersion: 5,
      });
      expect(renamed.title).toBe('Renamed by user');
      expect(renamed.titleSource).toBe('user');
      expect(renamed.version).toBe(6);
    });

    it('renameConversation rolls back optimistic title when the API update fails', async () => {
      mockApi.updateConversation.mockRejectedValueOnce(new Error('rename failed'));
      useConversationStore.setState({
        conversations: [
          { id: 'c1', title: 'Original title', version: 5, archived: false, starred: false },
        ] as any[],
      });

      await expect(
        useConversationStore.getState().renameConversation('c1', 'Broken rename')
      ).rejects.toThrow('rename failed');

      const current = useConversationStore.getState().conversations.find((c: any) => c.id === 'c1');
      expect(current.title).toBe('Original title');
    });

    it('updateConversation handles 409 conflict by refreshing', async () => {
      const conflictError: any = new Error('Conflict');
      conflictError.response = { status: 409 };
      mockApi.updateConversation.mockRejectedValueOnce(conflictError);
      mockApi.getConversation.mockResolvedValueOnce({
        id: 'c1', title: 'Server title', version: 6, created_at: '2026-01-01', updated_at: '2026-01-01',
      });

      useConversationStore.setState({
        conversations: [{ id: 'c1', title: 'Old', version: 5, archived: false, starred: false }] as any[],
      });

      const state = useConversationStore.getState();
      await expect(state.updateConversation('c1', { title: 'Conflict' })).rejects.toThrow();
      // Should have attempted to refresh from server
      expect(mockApi.getConversation).toHaveBeenCalledWith('c1');
    });
  });

  describe('Deep-Link State Management (§2.3.5)', () => {
    it('initial state has null conversation state', () => {
      const state = useConversationStore.getState();
      expect(state._activeConversationState).toBeNull();
      expect(state._activeConversationStateMessage).toBeNull();
    });

    it('clearActiveChat resets conversation state', () => {
      useConversationStore.setState({
        _activeConversationState: 'archived',
        _activeConversationStateMessage: 'test',
      });
      useConversationStore.getState().clearActiveChat();
      const after = useConversationStore.getState();
      expect(after._activeConversationState).toBeNull();
      expect(after._activeConversationStateMessage).toBeNull();
    });
  });

  describe('New Actions (notifyModelChange, exportConversation, purgeConversation)', () => {
    it('has notifyModelChange action', () => {
      const state = useConversationStore.getState();
      expect(typeof state.notifyModelChange).toBe('function');
    });

    it('has exportConversation action', () => {
      const state = useConversationStore.getState();
      expect(typeof state.exportConversation).toBe('function');
    });

    it('purgeConversation removes from local state', async () => {
      const mockDelete = vi.fn().mockResolvedValueOnce({});
      const { Api } = await import('../../src/services/api');
      (Api as any).delete = mockDelete;

      useConversationStore.setState({
        conversations: [
          { id: 'c1', title: 'Keep', archived: false, starred: false },
          { id: 'c2', title: 'Purge me', archived: false, starred: false, deletedAt: '2026-01-01' },
        ] as any[],
        activeConversationId: 'c2',
      });

      const state = useConversationStore.getState();
      await state.purgeConversation('c2');
      const after = useConversationStore.getState();
      expect(after.conversations.find((c: any) => c.id === 'c2')).toBeUndefined();
      expect(after.activeConversationId).toBeNull();
    });

    it('serverSearch carries scopeLimited through as a boolean, never a count (M01-P02 2026-08-04)', async () => {
      // Re-pointed at the corrected contract: the server used to return
      // `scopeBlocked` — a COUNT(*) of team conversations matching the
      // caller's own search term, computed and returned even when the
      // caller lacked team-read permission. That count is itself a
      // disclosure about content the caller cannot read. Replaced with
      // `scopeLimited`, a boolean reflecting only the caller's own
      // permission state.
      mockApi.get.mockResolvedValueOnce({
        conversations: [],
        nextCursor: null,
        hasMore: false,
        scopeLimited: true,
      });

      const state = useConversationStore.getState();
      const result = await state.serverSearch({ q: 'test' });
      expect((result as any).scopeLimited).toBe(true);
      expect((result as any).scopeBlocked).toBeUndefined();
    });
  });

  describe('chatFolderId vs projectId Separation', () => {
    it('Conversation type has both chatProjectId and projectId (distinct fields)', () => {
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

    it('createConversation sends active chat folder as chatProjectId, not PMO projectId', async () => {
      mockApi.createConversation.mockResolvedValueOnce({
        id: 'folder-conv',
        title: 'Folder conversation',
        chat_project_id: 'folder-1',
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
      });

      const state = useConversationStore.getState();
      await state.createConversation({ chatProjectId: 'folder-1' });

      expect(mockApi.createConversation).toHaveBeenCalledWith(
        expect.objectContaining({
          chatProjectId: 'folder-1',
          projectId: undefined,
        })
      );
      expect(useConversationStore.getState().conversations[0].chatProjectId).toBe('folder-1');
    });

    it('folder helper filters by chatProjectId instead of PMO projectId', () => {
      useConversationStore.setState({
        conversations: [
          { id: 'folder-match', title: 'In folder', chatProjectId: 'folder-1', projectId: 'pmo-1' },
          { id: 'pmo-only', title: 'PMO only', chatProjectId: null, projectId: 'folder-1' },
        ] as any[],
      });

      const result = useConversationStore.getState().getConversationsByProject('folder-1');

      expect(result.map((c: any) => c.id)).toEqual(['folder-match']);
    });
  });

  describe('Conversation loader dedupe', () => {
    it('reuses cached messages and releases loader inside the fetch dedupe window', async () => {
      mockApi.getConversation.mockResolvedValueOnce({
        id: 'c-cache',
        title: 'Cached conversation',
        language: 'pl',
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
        messages: [
          {
            id: 'm1',
            conversation_id: 'c-cache',
            role: 'ai',
            content: 'Cached reply',
            message_type: 'text',
            created_at: '2026-01-01',
          },
        ],
      });

      const state = useConversationStore.getState();
      await state.fetchConversation('c-cache');

      useConversationStore.setState({
        activeConversationId: 'other-conv',
        activeMessages: [],
        isLoading: false,
      });

      useConversationStore.getState().setActiveConversation('c-cache');

      const after = useConversationStore.getState();
      expect(after.isLoading).toBe(false);
      expect(after.activeMessages.map((m: any) => m.id)).toEqual(['m1']);
      expect(mockApi.getConversation).toHaveBeenCalledTimes(1);
    });
  });
});
