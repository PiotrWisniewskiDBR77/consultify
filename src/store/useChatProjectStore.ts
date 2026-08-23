/**
 * Chat Folder Store (historically named "Chat Project Store")
 *
 * Zustand store for managing chat folders/categories.
 * Allows organizing conversations into folders like Claude AI's project feature.
 *
 * IMPORTANT DISTINCTION:
 * - ChatProject/ChatFolder: ORGANIZATIONAL folders for grouping conversations
 * - PMO Project (projectId): BUSINESS projects with assessments, initiatives, tasks
 *
 * A conversation can be:
 * - In a ChatFolder (for organization): chatProjectId/chatFolderId
 * - Related to a PMO Project (for AI context): projectId
 *
 * These are INDEPENDENT - a conversation can be in a folder AND have PMO context.
 *
 * @alias useChatFolderStore
 */

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { Api } from '../services/api';
import { Conversation, useConversationStore } from './useConversationStore';

// ---------------------------------------------------------------------------
// Fetch de-dupe / throttle
// ---------------------------------------------------------------------------
// Prevent request storms when components remount in dev (StrictMode / refresh),
// which can otherwise cascade into "TypeError: Failed to fetch" and freeze the UI.
const FETCH_DEDUPE_WINDOW_MS = 1500;
// chat-history fix 2026-04-18 (feedback #3a41921c): hard deadline so a hung
// backend can't leave the sidebar stuck in "Loading…" forever.
const FETCH_HARD_TIMEOUT_MS = 20000;
let _inflightFetchProjects: Promise<void> | null = null;
let _lastFetchProjectsAt = 0;

function withDeadline<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      const err = new Error(`${label} timed out after ${ms}ms`);
      (err as any).code = 'FETCH_TIMEOUT';
      reject(err);
    }, ms);
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      }
    );
  });
}

// ==================== TYPES ====================

/**
 * ChatProject (alias: ChatFolder)
 *
 * Organizational folder for grouping chat conversations.
 * NOT the same as PMO Project - this is just for user organization.
 */
export type ChatProjectScope = 'personal' | 'team';

export interface ChatProject {
  id: string;
  name: string;
  description?: string;
  color: string;
  icon: string;
  /** 'personal' (default) or 'team' - team projects are shared with org members */
  scope: ChatProjectScope;
  conversationCount: number;
  /** Per-project brief injected into Teresa's system prompt (composer #5). */
  customInstructions?: string;
  /** F2: team-project visibility ('org' whole-org | 'private' invited-only). */
  visibility?: 'org' | 'private';
  /** F2: the current user's role on this project, if a team project. */
  myRole?: 'owner' | 'editor' | 'viewer' | null;
  /** F4c: parent folder id for nesting (null = top level). */
  parentId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Alias for ChatProject - prefer using ChatFolder in new code
 * to avoid confusion with PMO Projects
 */
export type ChatFolder = ChatProject;

export interface ChatProjectWithConversations extends ChatProject {
  conversations: Conversation[];
}

// ==================== STORE INTERFACE ====================

interface ChatProjectState {
  // Data
  projects: ChatProject[];
  activeProjectId: string | null;
  expandedProjectIds: string[];

  // UI State
  isLoading: boolean;
  error: string | null;

  // Actions - Fetch
  fetchProjects: (options?: { force?: boolean }) => Promise<void>;
  fetchProjectWithConversations: (id: string) => Promise<ChatProjectWithConversations | null>;

  // Actions - CRUD
  createProject: (data: {
    name: string;
    description?: string;
    color?: string;
    icon?: string;
    scope?: ChatProjectScope;
    visibility?: 'org' | 'private';
  }) => Promise<ChatProject>;
  updateProject: (
    id: string,
    updates: Partial<
      Pick<
        ChatProject,
        'name' | 'description' | 'color' | 'icon' | 'customInstructions' | 'visibility' | 'parentId'
      >
    >
  ) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;

  // Actions - Conversation Management
  moveConversationToProject: (
    conversationId: string,
    projectId: string | null,
    options?: { visibilityConsent?: boolean }
  ) => Promise<{ visibilityReceiptId?: string | null }>;

  // Actions - UI
  setActiveProject: (id: string | null) => void;
  toggleProjectExpanded: (id: string) => void;
  setExpandedProjects: (ids: string[]) => void;
  clearError: () => void;

  // Helpers
  getProjectById: (id: string) => ChatProject | undefined;
  getConversationsByProjectId: (projectId: string) => Conversation[];
  getPersonalProjects: () => ChatProject[];
  getTeamProjects: () => ChatProject[];
}

// ==================== STORE IMPLEMENTATION ====================

export const useChatProjectStore = create<ChatProjectState>()(
  persist(
    (set, get) => ({
      // Initial state
      projects: [],
      activeProjectId: null,
      expandedProjectIds: [],
      isLoading: false,
      error: null,

      // ==================== FETCH ====================

      fetchProjects: async (options) => {
        const now = Date.now();
        const force = Boolean(options?.force);
        if (!force && _inflightFetchProjects) return _inflightFetchProjects;
        if (!force && now - _lastFetchProjectsAt < FETCH_DEDUPE_WINDOW_MS) return;
        _lastFetchProjectsAt = now;

        set({ isLoading: true, error: null });
        _inflightFetchProjects = (async () => {
          try {
            const result = await withDeadline(
              Api.getChatProjects(),
              FETCH_HARD_TIMEOUT_MS,
              'fetchProjects'
            );
            // Backend may return either:
            // - { projects: [...] }
            // - { projects: { rows: [...] } } (SQLite shim)
            const rawProjects = (result as any)?.projects;
            const projectRows = Array.isArray(rawProjects)
              ? rawProjects
              : (rawProjects as any)?.rows && Array.isArray((rawProjects as any).rows)
                ? (rawProjects as any).rows
                : [];

            const projects = projectRows.map(mapApiProject);
            set({ projects, isLoading: false });
          } catch (err: any) {
            console.error('[ChatProjectStore] Fetch error:', err);
            set({ error: err.message || 'Failed to fetch projects', isLoading: false });
          }
        })().finally(() => {
          _inflightFetchProjects = null;
        });

        return _inflightFetchProjects;
      },

      fetchProjectWithConversations: async (id: string) => {
        set({ isLoading: true, error: null });
        try {
          const result = await Api.getChatProject(id);
          set({ isLoading: false });
          return {
            ...mapApiProject(result),
            conversations: result.conversations?.map(mapApiConversation) || [],
          };
        } catch (err: any) {
          console.error('[ChatProjectStore] Fetch project error:', err);
          set({ error: err.message || 'Failed to fetch project', isLoading: false });
          return null;
        }
      },

      // ==================== CRUD ====================

      createProject: async (data) => {
        set({ isLoading: true, error: null });
        try {
          const result = await Api.createChatProject(data);
          const project = mapApiProject(result);

          set((state) => ({
            projects: [project, ...state.projects],
            isLoading: false,
          }));

          return project;
        } catch (err: any) {
          console.error('[ChatProjectStore] Create error:', err);
          set({ error: err.message || 'Failed to create project', isLoading: false });
          throw err;
        }
      },

      updateProject: async (id, updates) => {
        try {
          await Api.updateChatProject(id, updates);

          set((state) => ({
            projects: state.projects.map((p) =>
              p.id === id ? { ...p, ...updates, updatedAt: new Date() } : p
            ),
          }));
        } catch (err: any) {
          console.error('[ChatProjectStore] Update error:', err);
          set({ error: err.message || 'Failed to update project' });
          throw err;
        }
      },

      deleteProject: async (id) => {
        try {
          await Api.deleteChatProject(id);

          set((state) => ({
            projects: state.projects.filter((p) => p.id !== id),
            activeProjectId: state.activeProjectId === id ? null : state.activeProjectId,
            expandedProjectIds: state.expandedProjectIds.filter((eid) => eid !== id),
          }));

          // chat-history fix 2026-04-18 (feedback #407a17df): folder delete must
          // trigger a FORCED conversation refresh so the sidebar reflects the new
          // chat_project_id=null state immediately. Without `force:true` the
          // fetch-dedupe window could swallow this call and leave ghost entries.
          useConversationStore.getState().fetchConversations({ force: true });
        } catch (err: any) {
          console.error('[ChatProjectStore] Delete error:', err);
          set({ error: err.message || 'Failed to delete folder' });
          throw err;
        }
      },

      // ==================== CONVERSATION MANAGEMENT ====================

      moveConversationToProject: async (conversationId, projectId, options) => {
        try {
          let result: { visibilityReceiptId?: string | null } = {};
          if (projectId) {
            result = await Api.moveConversationToProject(projectId, conversationId, options);
          } else {
            // Update conversation to remove from project
            await Api.updateConversation(conversationId, { chatProjectId: null });
          }

          // Update conversation counts
          set((state) => {
            const updatedProjects = state.projects.map((p) => {
              // Decrease count for old project (we don't track which one it was, so refresh will fix this)
              return p;
            });
            return { projects: updatedProjects };
          });

          // Refresh both stores before closing the modal so folder membership is
          // visible immediately in the sidebar.
          await Promise.all([
            get().fetchProjects({ force: true }),
            useConversationStore.getState().fetchConversations({ force: true }),
          ]);
          return result;
        } catch (err: any) {
          console.error('[ChatProjectStore] Move conversation error:', err);
          set({ error: err.message || 'Failed to move conversation' });
          throw err;
        }
      },

      // ==================== UI ====================

      setActiveProject: (id) => {
        set({ activeProjectId: id });
      },

      toggleProjectExpanded: (id) => {
        set((state) => ({
          expandedProjectIds: state.expandedProjectIds.includes(id)
            ? state.expandedProjectIds.filter((eid) => eid !== id)
            : [...state.expandedProjectIds, id],
        }));
      },

      setExpandedProjects: (ids) => {
        set({ expandedProjectIds: ids });
      },

      clearError: () => {
        set({ error: null });
      },

      // ==================== HELPERS ====================

      getProjectById: (id) => {
        return get().projects.find((p) => p.id === id);
      },

      getConversationsByProjectId: (projectId) => {
        // This requires the conversation store to have chat_project_id
        const conversations = useConversationStore.getState().conversations;
        return conversations.filter((c: any) => c.chatProjectId === projectId);
      },

      getPersonalProjects: () => {
        return get().projects.filter((p) => p.scope === 'personal' || !p.scope);
      },

      getTeamProjects: () => {
        return get().projects.filter((p) => p.scope === 'team');
      },
    }),
    {
      name: 'consultify-chat-projects',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        activeProjectId: state.activeProjectId,
        expandedProjectIds: state.expandedProjectIds,
      }),
    }
  )
);

// ==================== API MAPPERS ====================

function mapApiProject(api: any): ChatProject {
  return {
    id: api.id,
    name: api.name,
    description: api.description,
    color: api.color || '#6366f1',
    icon: api.icon || 'folder',
    scope: api.scope || 'personal',
    conversationCount: api.conversation_count || api.conversationCount || 0,
    customInstructions: api.custom_instructions ?? api.customInstructions ?? undefined,
    visibility: api.visibility ?? undefined,
    myRole: api.my_role ?? api.myRole ?? undefined,
    parentId: api.parent_id ?? api.parentId ?? null,
    createdAt: new Date(api.created_at || api.createdAt),
    updatedAt: new Date(api.updated_at || api.updatedAt),
  };
}

function mapApiConversation(api: any): Conversation {
  return {
    id: api.id,
    title: api.title,
    titleSource: api.title_source || 'auto',
    projectId: api.project_id,
    organizationId: api.organization_id,
    starred: api.starred || false,
    archived: api.archived || false,
    tags: api.tags ? (typeof api.tags === 'string' ? JSON.parse(api.tags) : api.tags) : [],
    pmoContext: api.pmo_context,
    messageCount: api.message_count || 0,
    lastMessagePreview: api.last_message_preview,
    lastMessageAt: api.last_message_at ? new Date(api.last_message_at) : undefined,
    createdAt: new Date(api.created_at),
    updatedAt: new Date(api.updated_at),
  };
}

export default useChatProjectStore;

/**
 * Alias for useChatProjectStore - prefer using useChatFolderStore in new code
 * to avoid confusion with PMO Projects
 */
export const useChatFolderStore = useChatProjectStore;
