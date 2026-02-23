// @ts-nocheck
/**
 * Conversation Store
 *
 * Zustand store for managing AI Chat conversation history.
 * Handles conversation CRUD, message management, and UI state.
 *
 * Extended for Unified AI Chat System:
 * - displayMode: Manages full/split/collapsed chat modes
 * - workspaceContext: Tracks what's displayed in split-screen workspace
 */

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { isValidLanguage, type SupportedLanguage } from '@/i18n';
import { Api } from '@/services/api';

import { AppView, ChatMessage } from '../types';
import {
  ChatDisplayMode,
  createWorkspaceContext,
  getDefaultWorkspaceType,
  WorkspaceContext,
  WorkspaceType,
} from '../types/workspace';

const STORE_DEBUG = import.meta.env.VITE_STORE_DEBUG === 'true';

// ---------------------------------------------------------------------------
// Fetch de-dupe / throttle
// ---------------------------------------------------------------------------
// In React 18/19 dev (StrictMode + refresh), effects can mount more than once.
// If the network is transiently unavailable, repeated mounts can spam /api and
// cascade into "TypeError: Failed to fetch" + UI freeze.
const FETCH_DEDUPE_WINDOW_MS = 1500;
let _inflightFetchConversations: Promise<void> | null = null;
let _lastFetchConversationsAt = 0;
const _inflightFetchConversationById: Record<string, Promise<void>> = {};
const _lastFetchConversationAt: Record<string, number> = {};

// ---------------------------------------------------------------------------
// Title generation de-dupe / retry
// ---------------------------------------------------------------------------
const TITLE_DEDUPE_WINDOW_MS = 5000;
const TITLE_MAX_RETRIES = 3;
const _lastTitleAttemptAt: Record<string, number> = {};

function getAppLanguageFallback(): SupportedLanguage {
  try {
    const nav =
      (typeof navigator !== 'undefined' && (navigator.languages?.[0] || navigator.language)) ||
      'pl';
    const base = String(nav).split('-')[0].toLowerCase();
    const mapped = base === 'ja' ? 'jp' : base;
    return (isValidLanguage(mapped) ? mapped : 'pl') as SupportedLanguage;
  } catch {
    return 'pl';
  }
}

// ==================== TYPES ====================

export interface Conversation {
  id: string;
  title: string;
  titleSource: 'auto' | 'user';
  /**
   * Per-conversation language (independent from UI language).
   * Stored in backend as `conversations.language`.
   */
  language?: SupportedLanguage;

  /**
   * PMO Project ID - Reference to business transformation project
   * This provides CONTEXT to AI (project data, initiatives, tasks)
   * @example "Digital Transformation 2026", "Lean Manufacturing"
   */
  projectId?: string;

  /**
   * Chat Folder ID - Organizational folder for conversations (like Claude Projects)
   * This is for USER ORGANIZATION only, NOT business context
   * @example "Marketing discussions", "Budget planning chats"
   * @alias chatFolderId
   */
  chatProjectId?: string | null;

  organizationId?: string;
  /**
   * User ID who created this conversation.
   * Particularly important for team conversations where multiple users can add messages.
   */
  createdBy?: string;
  /**
   * Scope of the chat project this conversation belongs to ('personal' | 'team').
   * Returned by the API via LEFT JOIN.
   */
  chatProjectScope?: 'personal' | 'team' | null;
  starred: boolean;
  isPinned?: boolean; // Alias for starred
  archived: boolean;
  tags: string[];
  pmoContext?: {
    assessmentId?: string;
    initiativeIds?: string[];
    roadmapId?: string;
    taskId?: string;
    decisionId?: string;
    reportId?: string;
  };
  messageCount: number;
  lastMessagePreview?: string;
  lastMessageAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConversationMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'ai';
  content: string;
  messageType: 'text' | 'action_request' | 'summary' | 'file' | 'tool_call' | 'voice';
  metadata?: {
    citations?: Citation[];
    actions?: ResponseAction[];
    toolCalls?: any[];
    // AI reasoning and artifacts
    thinkingSteps?: Array<{
      id: string;
      title: string;
      content: string;
      status: 'pending' | 'active' | 'completed';
    }>;
    artifacts?: Array<{
      id: string;
      type: string;
      title: string;
      content: string;
      language?: string;
    }>;
    // Voice-specific metadata
    audioUrl?: string;
    audioDuration?: number;
    voiceProvider?: string;
    voiceId?: string;
    transcribedFrom?: 'whisper' | 'web';
    // Interactive options
    options?: Array<{ id: string; label: string; value: string }>;
    multiSelect?: boolean;
    /**
     * Optional diagnostics for persisted AI/system messages.
     * Useful for debugging stream failures without polluting message content.
     */
    error?: string;
  };
  tokenCount?: number;
  modelUsed?: string;
  /** User who wrote this message (null for AI messages) */
  authorUserId?: string | null;
  /** Display name of the author (resolved from users table) */
  authorName?: string | null;
  /** Email of the author (resolved from users table) */
  authorEmail?: string | null;
  createdAt: Date;
}

export interface Citation {
  id: string;
  type: 'assessment' | 'initiative' | 'report' | 'external';
  title: string;
  reference: string;
  link?: string;
  excerpt?: string;
}

export interface ResponseAction {
  id: string;
  type: 'navigate' | 'execute' | 'expand';
  label: string;
  icon: string;
  payload: {
    view?: string;
    apiCall?: string;
    data?: Record<string, unknown>;
  };
}

// ==================== GROUPING HELPERS ====================

type ConversationGroup =
  | 'pinned'
  | 'today'
  | 'thisWeek'
  | 'thisMonth'
  | 'older'
  | 'archived';

function getConversationGroup(conv: Conversation): ConversationGroup {
  if (conv.archived) return 'archived';
  if (conv.starred) return 'pinned';

  const now = new Date();
  const convDate = new Date(conv.lastMessageAt || conv.updatedAt);
  const diffDays = Math.floor((now.getTime() - convDate.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'today';
  if (diffDays <= 7) return 'thisWeek';
  if (diffDays <= 30) return 'thisMonth';
  return 'older';
}

export function groupConversations(
  conversations: Conversation[]
): Record<ConversationGroup, Conversation[]> {
  const groups: Record<ConversationGroup, Conversation[]> = {
    pinned: [],
    today: [],
    thisWeek: [],
    thisMonth: [],
    older: [],
    archived: [],
  };

  for (const conv of conversations) {
    const group = getConversationGroup(conv);
    groups[group].push(conv);
  }

  // Sort each group by last activity (newest first)
  for (const key of Object.keys(groups) as ConversationGroup[]) {
    groups[key].sort((a, b) => {
      const dateA = new Date(a.lastMessageAt || a.updatedAt).getTime();
      const dateB = new Date(b.lastMessageAt || b.updatedAt).getTime();
      return dateB - dateA;
    });
  }

  return groups;
}

// ==================== HELPERS ====================

/**
 * Determine entity type from conversation pmoContext and title.
 * Used to show dynamic icons and tags in the sidebar.
 */
export function getConversationEntityType(
  conv: Conversation
): 'assessment' | 'initiative' | 'roadmap' | 'task' | 'decision' | null {
  const ctx = conv.pmoContext;
  if (ctx?.assessmentId) return 'assessment';
  if (ctx?.initiativeIds && ctx.initiativeIds.length > 0) return 'initiative';
  if (ctx?.roadmapId) return 'roadmap';
  if (ctx?.taskId) return 'task';
  if (ctx?.decisionId) return 'decision';
  // Fallback: check title prefix (set by useOpenChatWithContext)
  const title = (conv.title || '').toLowerCase();
  if (title.startsWith('task:') || title.startsWith('task ')) return 'task';
  if (
    title.startsWith('decision:') ||
    title.startsWith('decision ') ||
    title.startsWith('decyzja:')
  )
    return 'decision';
  return null;
}

// ==================== STORE INTERFACE ====================

interface ConversationState {
  // Data
  conversations: Conversation[];
  activeConversationId: string | null;
  activeMessages: ConversationMessage[];

  /**
   * Language used for the chat conversation.
   *
   * - UI language is managed by i18n (settings).
   * - Chat language is chosen by the user per conversation.
   * - If a conversation has no explicit language yet, we fall back to draftChatLanguage.
   * - draftChatLanguage defaults to current app language (i18nextLng) but can be changed by the user
   *   before starting a new conversation.
   */
  draftChatLanguage: SupportedLanguage;
  chatLanguageByConversationId: Record<string, SupportedLanguage>;

  // UI State
  isLoading: boolean;
  isSidebarOpen: boolean;
  searchQuery: string;
  showArchived: boolean;
  /** T002: Collapsed state for conversation list groups (today, thisWeek, etc.). true = collapsed (hidden) */
  collapsedConversationGroups: Record<string, boolean>;

  // Derived data (computed)
  groupedConversations: Record<ConversationGroup, Conversation[]>;

  // ==================== UNIFIED CHAT SYSTEM ====================
  // Display mode for chat interface (full-screen vs split-screen)
  displayMode: ChatDisplayMode;

  // Context about what's displayed in workspace (for split mode)
  workspaceContext: WorkspaceContext | null;

  // Previous view for "back" functionality
  previousView: AppView | null;

  // Actions - Fetch
  fetchConversations: (options?: {
    archived?: boolean;
    projectId?: string;
    scope?: 'personal' | 'team' | 'all';
  }) => Promise<void>;
  fetchConversation: (id: string) => Promise<void>;

  // Actions - CRUD
  createConversation: (options?: {
    title?: string;
    projectId?: string;
    pmoContext?: {
      assessmentId?: string;
      initiativeIds?: string[];
      roadmapId?: string;
      taskId?: string;
      decisionId?: string;
      reportId?: string;
    };
  }) => Promise<Conversation>;
  updateConversation: (id: string, updates: Partial<Conversation>) => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;

  // Actions - Messages
  addMessage: (
    message: Omit<ConversationMessage, 'id' | 'createdAt'>
  ) => Promise<ConversationMessage>;
  updateLastMessage: (content: string) => void;
  /**
   * Truncate conversation after a message (inclusive) and optionally edit it.
   * Used for "edit & regenerate" UX.
   */
  truncateFromMessage: (messageId: string, editedContent?: string) => Promise<void>;

  // Actions - Organization
  starConversation: (id: string) => Promise<void>;
  unstarConversation: (id: string) => Promise<void>;
  archiveConversation: (id: string) => Promise<void>;
  unarchiveConversation: (id: string) => Promise<void>;

  // Actions - UI
  setActiveConversation: (id: string | null) => void;
  toggleSidebar: () => void;
  setSearchQuery: (query: string) => void;
  toggleShowArchived: () => void;
  toggleConversationGroupCollapsed: (groupKey: string) => void;
  clearActiveChat: () => void;

  // Actions - Language
  setDraftChatLanguage: (lang: SupportedLanguage) => void;
  setConversationChatLanguage: (conversationId: string, lang: SupportedLanguage) => void;

  // Actions - Title
  generateTitle: (id: string) => Promise<void>;
  renameConversation: (id: string, title: string) => Promise<void>;

  // Actions - Bulk
  bulkOperation: (
    ids: string[],
    action: 'archive' | 'unarchive' | 'delete' | 'star' | 'unstar'
  ) => Promise<void>;

  // Actions - Migration
  migrateFromLocalStorage: () => Promise<void>;

  // Helpers
  searchConversations: (query: string) => Conversation[];
  getConversationsByProject: (projectId: string) => Conversation[];

  // ==================== UNIFIED CHAT ACTIONS ====================
  /**
   * Set the display mode (full/split/collapsed)
   */
  setDisplayMode: (mode: ChatDisplayMode) => void;

  /**
   * Set workspace context for split mode
   */
  setWorkspaceContext: (context: WorkspaceContext | null) => void;

  /**
   * Update workspace context with view info (convenience method)
   */
  updateWorkspaceFromView: (
    view: AppView,
    entityId?: string,
    entityData?: Record<string, unknown>
  ) => void;

  /**
   * Expand chat to full screen mode
   */
  expandToFullScreen: () => void;

  /**
   * Collapse to split screen with given workspace context
   */
  collapseToSplit: (workspaceContext?: Partial<WorkspaceContext>) => void;

  /**
   * Store previous view for navigation back
   */
  setPreviousView: (view: AppView | null) => void;

  /**
   * Check if we're in a split-screen view
   */
  isSplitMode: () => boolean;
}

// ==================== STORE IMPLEMENTATION ====================

export const useConversationStore = create<ConversationState>()(
  persist(
    (set, get) => ({
      // Initial state
      conversations: [],
      activeConversationId: null,
      activeMessages: [],
      draftChatLanguage: getAppLanguageFallback(),
      chatLanguageByConversationId: {},
      isLoading: false,
      isSidebarOpen: false,
      searchQuery: '',
      showArchived: false,
      collapsedConversationGroups: {},
      groupedConversations: {
        pinned: [],
        today: [],
        thisWeek: [],
        thisMonth: [],
        older: [],
        archived: [],
      },

      // Unified Chat System state
      displayMode: 'full' as ChatDisplayMode,
      workspaceContext: null,
      previousView: null,

      // ==================== FETCH ====================

      fetchConversations: async (options) => {
        const now = Date.now();
        if (_inflightFetchConversations) return _inflightFetchConversations;
        if (now - _lastFetchConversationsAt < FETCH_DEDUPE_WINDOW_MS) return;
        _lastFetchConversationsAt = now;

        set({ isLoading: true });
        _inflightFetchConversations = (async () => {
          try {
            const result = await Api.getConversations({
              archived: options?.archived,
              projectId: options?.projectId,
            });

            const conversations = (result?.conversations || []).map(mapApiConversation);
            set((state) => {
              const nextMap = { ...state.chatLanguageByConversationId };
              for (const c of conversations) {
                if (c.language) nextMap[c.id] = c.language;
              }
              return {
                conversations,
                groupedConversations: groupConversations(conversations),
                chatLanguageByConversationId: nextMap,
                isLoading: false,
              };
            });
          } catch (err) {
            console.error('[ConversationStore] Fetch error:', err);
            set({ isLoading: false });
          }
        })().finally(() => {
          _inflightFetchConversations = null;
        });

        return _inflightFetchConversations;
      },

      fetchConversation: async (id: string) => {
        const now = Date.now();
        if (_inflightFetchConversationById[id]) return _inflightFetchConversationById[id];
        if (now - (_lastFetchConversationAt[id] || 0) < FETCH_DEDUPE_WINDOW_MS) return;
        _lastFetchConversationAt[id] = now;

        set({ isLoading: true });
        _inflightFetchConversationById[id] = (async () => {
          try {
            const result = await Api.getConversation(id);
            const messages = (result?.messages || []).map(mapApiMessage);
            set((state) => {
              const fromApiRaw = result?.language;
              const fromApiBase = fromApiRaw ? String(fromApiRaw).split('-')[0] : null;
              const fromApi = fromApiBase && isValidLanguage(fromApiBase) ? fromApiBase : null;
              const existing = state.chatLanguageByConversationId[id];
              const resolved =
                (fromApi as any) || existing || state.draftChatLanguage || getAppLanguageFallback();
              return {
                activeConversationId: id,
                activeMessages: messages,
                isLoading: false,
                // Ensure we always have a language for the selected conversation
                draftChatLanguage: resolved,
                chatLanguageByConversationId: {
                  ...state.chatLanguageByConversationId,
                  [id]: resolved,
                },
              };
            });
          } catch (err) {
            console.error('[ConversationStore] Fetch conversation error:', err);
            set({ isLoading: false });
          }
        })().finally(() => {
          delete _inflightFetchConversationById[id];
        });

        return _inflightFetchConversationById[id];
      },

      // ==================== CRUD ====================

      createConversation: async (options) => {
        try {
          const language = get().draftChatLanguage || getAppLanguageFallback();
          const result = await Api.createConversation({
            title: options?.title,
            projectId: options?.projectId,
            pmoContext: options?.pmoContext,
            language,
          });

          const conversation = mapApiConversation(result);
          const conversationLanguage = conversation.language || language;

          set((state) => {
            const newConversations = [conversation, ...state.conversations];
            return {
              conversations: newConversations,
              groupedConversations: groupConversations(newConversations),
              activeConversationId: conversation.id,
              activeMessages: [],
              chatLanguageByConversationId: {
                ...state.chatLanguageByConversationId,
                [conversation.id]: conversationLanguage,
              },
            };
          });

          return conversation;
        } catch (err) {
          console.error('[ConversationStore] Create error:', err);
          throw err;
        }
      },

      updateConversation: async (id, updates) => {
        try {
          await Api.updateConversation(id, updates);

          set((state) => {
            const newConversations = state.conversations.map((c) =>
              c.id === id ? { ...c, ...updates, updatedAt: new Date() } : c
            );
            return {
              conversations: newConversations,
              groupedConversations: groupConversations(newConversations),
            };
          });
        } catch (err) {
          console.error('[ConversationStore] Update error:', err);
          throw err;
        }
      },

      deleteConversation: async (id) => {
        try {
          await Api.deleteConversation(id);

          set((state) => {
            const newConversations = state.conversations.filter((c) => c.id !== id);
            return {
              conversations: newConversations,
              groupedConversations: groupConversations(newConversations),
              activeConversationId:
                state.activeConversationId === id ? null : state.activeConversationId,
              activeMessages: state.activeConversationId === id ? [] : state.activeMessages,
            };
          });
        } catch (err) {
          console.error('[ConversationStore] Delete error:', err);
          throw err;
        }
      },

      // ==================== MESSAGES ====================

      addMessage: async (message) => {
        const { activeConversationId } = get();
        const conversationId = message.conversationId || activeConversationId;
        if (!conversationId) throw new Error('No active conversation');

        // Optimistic UI: append immediately so chat feels responsive (especially in split mode).
        const optimisticId = `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
        const optimisticMessage: ConversationMessage = {
          id: optimisticId,
          conversationId,
          role: message.role,
          content: message.content,
          messageType: message.messageType || 'text',
          metadata: { ...(message.metadata || {}), local: true } as any,
          tokenCount: message.tokenCount,
          modelUsed: message.modelUsed,
          createdAt: new Date(),
        };

        set((state) => {
          // Only append to activeMessages if this conversation is currently active
          const shouldAppend = state.activeConversationId === conversationId;
          return {
            activeMessages: shouldAppend
              ? [...state.activeMessages, optimisticMessage]
              : state.activeMessages,
            conversations: state.conversations.map((c) =>
              c.id === conversationId
                ? {
                    ...c,
                    messageCount: (c.messageCount || 0) + 1,
                    lastMessagePreview: message.content.slice(0, 200),
                    lastMessageAt: new Date(),
                    updatedAt: new Date(),
                  }
                : c
            ),
          };
        });

        try {
          const result = await Api.addConversationMessage(conversationId, {
            role: message.role,
            content: message.content,
            messageType: message.messageType,
            metadata: message.metadata,
            tokenCount: message.tokenCount,
            modelUsed: message.modelUsed,
          });

          const newMessage = mapApiMessage(result);

          set((state) => {
            const isActive = state.activeConversationId === conversationId;
            const nextActiveMessages = isActive
              ? state.activeMessages.map((m) => (m.id === optimisticId ? newMessage : m))
              : state.activeMessages;
            return {
              activeMessages: nextActiveMessages,
            };
          });

          // Trigger title generation after first exchange (user + AI = 2 messages)
          const activeConv = get().conversations.find((c) => c.id === conversationId);
          const titleLower = String(activeConv?.title || '')
            .trim()
            .toLowerCase();
          const defaultTitle =
            !activeConv?.title ||
            titleLower === '' ||
            titleLower === 'new conversation' ||
            titleLower === 'nowa rozmowa';
          const canAutoTitle = activeConv?.titleSource !== 'user';
          const shouldTryTitle =
            message.role === 'ai' &&
            get().activeConversationId === conversationId &&
            defaultTitle &&
            canAutoTitle;

          if (shouldTryTitle) {
            const now = Date.now();
            const last = _lastTitleAttemptAt[conversationId] || 0;
            if (now - last > TITLE_DEDUPE_WINDOW_MS) {
              _lastTitleAttemptAt[conversationId] = now;
              // Small delay to ensure backend has persisted the messages/message_count
              setTimeout(() => {
                void get().generateTitle(conversationId);
              }, 1200);
            }
          }

          return newMessage;
        } catch (err) {
          console.error('[ConversationStore] Add message error:', err);
          // Keep optimistic message but mark it as failed so UI can show it if needed.
          set((state) => {
            if (state.activeConversationId !== conversationId) return {};
            return {
              activeMessages: state.activeMessages.map((m) =>
                m.id === optimisticId
                  ? ({ ...m, metadata: { ...(m.metadata || {}), localError: true } } as any)
                  : m
              ),
            };
          });
          throw err;
        }
      },

      updateLastMessage: (content: string) => {
        set((state) => {
          const messages = [...state.activeMessages];
          if (messages.length > 0) {
            const lastMsg = messages[messages.length - 1];
            if (lastMsg.role === 'ai') {
              messages[messages.length - 1] = { ...lastMsg, content };
            }
          }
          return { activeMessages: messages };
        });
      },

      truncateFromMessage: async (messageId: string, editedContent?: string) => {
        const conversationId = get().activeConversationId;
        if (!conversationId) return;
        await Api.truncateConversation(conversationId, messageId, editedContent);
        await get().fetchConversation(conversationId);
      },

      // ==================== ORGANIZATION ====================

      starConversation: async (id) => {
        await get().updateConversation(id, { starred: true });
      },

      unstarConversation: async (id) => {
        await get().updateConversation(id, { starred: false });
      },

      archiveConversation: async (id) => {
        await get().updateConversation(id, { archived: true });
      },

      unarchiveConversation: async (id) => {
        await get().updateConversation(id, { archived: false });
      },

      // ==================== UI ====================

      setActiveConversation: (id) => {
        if (id) {
          const existing = get().chatLanguageByConversationId[id];
          if (existing) {
            set({ draftChatLanguage: existing });
          }
          get().fetchConversation(id);
        } else {
          set({ activeConversationId: null, activeMessages: [] });
        }
      },

      toggleSidebar: () => {
        set((state) => ({ isSidebarOpen: !state.isSidebarOpen }));
      },

      setSearchQuery: (query) => {
        set({ searchQuery: query });
      },

      toggleShowArchived: () => {
        set((state) => ({ showArchived: !state.showArchived }));
      },

      toggleConversationGroupCollapsed: (groupKey) => {
        set((state) => {
          const current = state.collapsedConversationGroups[groupKey] ?? false;
          return {
            collapsedConversationGroups: {
              ...state.collapsedConversationGroups,
              [groupKey]: !current,
            },
          };
        });
      },

      clearActiveChat: () => {
        set({ activeConversationId: null, activeMessages: [] });
      },

      // ==================== LANGUAGE ====================

      setDraftChatLanguage: (lang) => {
        set({ draftChatLanguage: lang });
      },

      setConversationChatLanguage: (conversationId, lang) => {
        set((state) => ({
          draftChatLanguage: lang,
          chatLanguageByConversationId: {
            ...state.chatLanguageByConversationId,
            [conversationId]: lang,
          },
        }));
        // Persist to backend (best-effort)
        void get().updateConversation(conversationId, { language: lang } as any);
      },

      // ==================== TITLE ====================

      generateTitle: async (id) => {
        const attempt = async (tryNo: number) => {
          try {
            const result = await Api.generateConversationTitle(id);

            // Success: backend returned a real title
            const resultTitleLower = String(result?.title || '')
              .trim()
              .toLowerCase();
            if (
              result?.title &&
              resultTitleLower !== 'new conversation' &&
              resultTitleLower !== 'nowa rozmowa'
            ) {
              set((state) => {
                const next = state.conversations.map((c) =>
                  c.id === id ? { ...c, title: result.title!, titleSource: 'auto' as const } : c
                );
                return {
                  conversations: next,
                  groupedConversations: groupConversations(next),
                };
              });
              return;
            }

            // Skipped because DB isn't ready yet (race on message_count / messages persistence)
            const skippedReason = String(result?.reason || '');
            const shouldRetryBecauseNotEnough =
              result?.skipped === true && skippedReason.toLowerCase().includes('not enough');

            if (shouldRetryBecauseNotEnough && tryNo < TITLE_MAX_RETRIES) {
              const delay = 1200 * (tryNo + 1);
              setTimeout(() => void attempt(tryNo + 1), delay);
              return;
            }

            // All retries exhausted or skipped for another reason — use heuristic fallback
            if (result?.skipped) {
              const activeConv = get().conversations.find((c) => c.id === id);
              const firstUserContent = get().activeMessages.find((m) => m.role === 'user')?.content;
              let fallback: string;
              if (firstUserContent) {
                const cleaned = firstUserContent.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
                fallback = cleaned.length > 50 ? cleaned.slice(0, 47) + '...' : cleaned;
              } else {
                fallback = `New chat (${new Date().toISOString().slice(0, 10)})`;
              }
              const titleLower = String(activeConv?.title || '').trim().toLowerCase();
              const isStillDefault = !activeConv?.title || titleLower === '' || titleLower === 'new conversation' || titleLower === 'nowa rozmowa';
              if (isStillDefault) {
                set((state) => {
                  const next = state.conversations.map((c) =>
                    c.id === id ? { ...c, title: fallback, titleSource: 'auto' as const } : c
                  );
                  return { conversations: next, groupedConversations: groupConversations(next) };
                });
                void get().updateConversation(id, { title: fallback, titleSource: 'auto' });
              }
            }
          } catch (err) {
            // Network / backend error: retry a few times with backoff
            if (tryNo < TITLE_MAX_RETRIES) {
              const delay = 1500 * (tryNo + 1);
              setTimeout(() => void attempt(tryNo + 1), delay);
              return;
            }
            if (STORE_DEBUG) console.warn('[ConversationStore] Title generation failed:', err);
            // T001: Fallback when AI unavailable — "New chat (YYYY-MM-DD)"
            const fallbackTitle = `New chat (${new Date().toISOString().slice(0, 10)})`;
            set((state) => {
              const next = state.conversations.map((c) =>
                c.id === id ? { ...c, title: fallbackTitle, titleSource: 'auto' as const } : c
              );
              return {
                conversations: next,
                groupedConversations: groupConversations(next),
              };
            });
            void get().updateConversation(id, { title: fallbackTitle, titleSource: 'auto' });
          }
        };

        // De-dupe: prevent repeated manual calls from spamming
        const now = Date.now();
        const last = _lastTitleAttemptAt[id] || 0;
        if (now - last < 1000) return;
        _lastTitleAttemptAt[id] = now;

        await attempt(0);
      },

      renameConversation: async (id, title) => {
        // Mark titleSource as 'user' so auto-title generation won't overwrite
        set((state) => {
          const next = state.conversations.map((c) =>
            c.id === id ? { ...c, title, titleSource: 'user' as const } : c
          );
          return {
            conversations: next,
            groupedConversations: groupConversations(next),
          };
        });
        await get().updateConversation(id, { title, titleSource: 'user' } as any);
      },

      // ==================== BULK ====================

      bulkOperation: async (ids, action) => {
        try {
          await Api.bulkConversationOperation(ids, action);

          set((state) => {
            let newConversations = [...state.conversations];

            switch (action) {
              case 'delete':
                newConversations = newConversations.filter((c) => !ids.includes(c.id));
                break;
              case 'archive':
                newConversations = newConversations.map((c) =>
                  ids.includes(c.id) ? { ...c, archived: true } : c
                );
                break;
              case 'unarchive':
                newConversations = newConversations.map((c) =>
                  ids.includes(c.id) ? { ...c, archived: false } : c
                );
                break;
              case 'star':
                newConversations = newConversations.map((c) =>
                  ids.includes(c.id) ? { ...c, starred: true } : c
                );
                break;
              case 'unstar':
                newConversations = newConversations.map((c) =>
                  ids.includes(c.id) ? { ...c, starred: false } : c
                );
                break;
            }

            return {
              conversations: newConversations,
              groupedConversations: groupConversations(newConversations),
            };
          });
        } catch (err) {
          console.error('[ConversationStore] Bulk operation error:', err);
          throw err;
        }
      },

      // ==================== MIGRATION ====================

      migrateFromLocalStorage: async () => {
        try {
          // Get old chat messages from useAppStore
          const storageData = localStorage.getItem('consultinity-storage');
          if (!storageData) return;

          const parsed = JSON.parse(storageData);
          const { projectChatMessages } = parsed.state || {};

          if (!projectChatMessages || Object.keys(projectChatMessages).length === 0) {
            console.log('[ConversationStore] No messages to migrate');
            return;
          }

          const conversations = Object.entries(projectChatMessages)
            .filter(([_, messages]) => Array.isArray(messages) && messages.length > 0)
            .map(([projectId, messages]) => ({
              projectId: projectId === 'global' ? undefined : projectId,
              messages: (messages as ChatMessage[]).map((m) => ({
                role: m.role,
                content: m.content,
                timestamp: m.timestamp,
              })),
            }));

          if (conversations.length > 0) {
            await Api.migrateConversations(conversations);
            console.log(
              '[ConversationStore] Migration complete:',
              conversations.length,
              'conversations'
            );

            // Refresh conversations
            await get().fetchConversations();
          }
        } catch (err) {
          console.error('[ConversationStore] Migration error:', err);
        }
      },

      // ==================== HELPERS ====================

      searchConversations: (query) => {
        const { conversations } = get();
        const lowerQuery = query.toLowerCase();
        return conversations.filter(
          (c) =>
            c.title.toLowerCase().includes(lowerQuery) ||
            c.lastMessagePreview?.toLowerCase().includes(lowerQuery)
        );
      },

      getConversationsByProject: (projectId) => {
        const { conversations } = get();
        return conversations.filter((c) => c.projectId === projectId);
      },

      // ==================== UNIFIED CHAT ACTIONS ====================

      setDisplayMode: (mode: ChatDisplayMode) => {
        if (STORE_DEBUG) console.log('[ConversationStore] setDisplayMode:', mode);
        set({ displayMode: mode });
      },

      setWorkspaceContext: (context: WorkspaceContext | null) => {
        if (STORE_DEBUG)
          console.log('[ConversationStore] setWorkspaceContext:', context?.type, context?.entityId);
        set({ workspaceContext: context });
      },

      updateWorkspaceFromView: (
        view: AppView,
        entityId?: string,
        entityData?: Record<string, unknown>
      ) => {
        const workspaceType = getDefaultWorkspaceType(view);
        const context = createWorkspaceContext(view, workspaceType, {
          entityId,
          entityData,
        });
        set({
          workspaceContext: context,
          displayMode: 'split',
        });
        if (STORE_DEBUG)
          console.log('[ConversationStore] updateWorkspaceFromView:', view, workspaceType);
      },

      expandToFullScreen: () => {
        const { workspaceContext } = get();
        if (STORE_DEBUG)
          console.log('[ConversationStore] expandToFullScreen from:', workspaceContext?.view);
        set({
          displayMode: 'full',
          previousView: workspaceContext?.view || null,
        });
      },

      collapseToSplit: (partialContext?: Partial<WorkspaceContext>) => {
        const current = get().workspaceContext;
        let newContext: WorkspaceContext | null = null;

        if (partialContext) {
          newContext = {
            view: partialContext.view || current?.view || AppView.MY_WORK,
            type: partialContext.type || current?.type || 'empty',
            timestamp: new Date(),
            entityId: partialContext.entityId || current?.entityId,
            entityName: partialContext.entityName || current?.entityName,
            entityData: partialContext.entityData || current?.entityData,
            projectId: partialContext.projectId || current?.projectId,
            projectName: partialContext.projectName || current?.projectName,
          };
        } else if (current) {
          newContext = { ...current, timestamp: new Date() };
        }

        console.log('[ConversationStore] collapseToSplit:', newContext?.view);
        set({
          displayMode: 'split',
          workspaceContext: newContext,
        });
      },

      setPreviousView: (view: AppView | null) => {
        set({ previousView: view });
      },

      isSplitMode: () => {
        return get().displayMode === 'split';
      },
    }),
    {
      name: 'consultinity-conversations',
      storage: createJSONStorage(() => localStorage),
      // Version 2: migrates default language from 'en' to 'pl' for Polish product
      version: 2,
      migrate: (persistedState: any, version: number) => {
        if (version < 2) {
          // Migration to v2: Fix language for users whose browser auto-detected 'en'
          // but the app's primary audience is Polish. Force draftChatLanguage to 'pl'
          // and set explicit preference key.
          persistedState.draftChatLanguage = 'pl';
          // Fix conversations that were auto-assigned 'en'
          if (persistedState.chatLanguageByConversationId) {
            const fixed: Record<string, string> = {};
            for (const [id, lang] of Object.entries(persistedState.chatLanguageByConversationId)) {
              fixed[id] = lang === 'en' ? 'pl' : (lang as string);
            }
            persistedState.chatLanguageByConversationId = fixed;
          }
          // Set the explicit user preference so chatLanguage resolution picks it up
          try {
            localStorage.setItem('consultinity-preferred-chat-lang', 'pl');
          } catch {
            // ignore storage errors
          }
        }
        return persistedState;
      },
      partialize: (state) => ({
        // Note: isSidebarOpen is NOT persisted - always start with sidebar closed to avoid blocking main content
        showArchived: state.showArchived,
        collapsedConversationGroups: state.collapsedConversationGroups,
        displayMode: state.displayMode,
        activeConversationId: state.activeConversationId, // Persist active conversation across screens
        draftChatLanguage: state.draftChatLanguage,
        chatLanguageByConversationId: state.chatLanguageByConversationId,
      }),
      onRehydrate: () => {
        // When store rehydrates, we need to fetch messages for active conversation
        return (state) => {
          // Migration: Reset isSidebarOpen to false to prevent blocking main content
          // This fixes an issue where the chat history sidebar was blocking clicks
          if (state) {
            state.isSidebarOpen = false;
          }

          if (state?.activeConversationId) {
            console.log(
              '[ConversationStore] Rehydrating active conversation:',
              state.activeConversationId
            );

            // Wait for auth to be ready instead of using a magic timeout.
            // Poll every 200ms up to 5 seconds for auth token availability.
            const convId = state.activeConversationId;
            const maxAttempts = 25;
            let attempt = 0;

            const tryFetch = () => {
              attempt++;
              const token = localStorage.getItem('token');

              if (token) {
                state.fetchConversation(convId);
              } else if (attempt < maxAttempts) {
                setTimeout(tryFetch, 200);
              } else {
                console.warn(
                  '[ConversationStore] Auth not ready after 5s, skipping rehydration fetch'
                );
              }
            };

            // Start checking after a brief initial delay
            setTimeout(tryFetch, 50);
          }
        };
      },
    }
  )
);

// ==================== API MAPPERS ====================

function mapApiConversation(api: any): Conversation {
  const languageBase = api.language ? String(api.language).split('-')[0] : null;
  return {
    id: api.id,
    title: api.title,
    titleSource: api.title_source || 'auto',
    language:
      languageBase && isValidLanguage(languageBase)
        ? (languageBase as SupportedLanguage)
        : undefined,
    projectId: api.project_id,
    chatProjectId: api.chat_project_id || null,
    organizationId: api.organization_id,
    createdBy: api.created_by || null,
    chatProjectScope: api.chat_project_scope || null,
    starred: api.starred || false,
    archived: api.archived || false,
    tags: api.tags || [],
    pmoContext: api.pmo_context,
    messageCount: api.message_count || 0,
    lastMessagePreview: api.last_message_preview,
    lastMessageAt: api.last_message_at ? new Date(api.last_message_at) : undefined,
    createdAt: new Date(api.created_at),
    updatedAt: new Date(api.updated_at),
  };
}

function mapApiMessage(api: any): ConversationMessage {
  return {
    id: api.id,
    conversationId: api.conversation_id,
    role: api.role,
    content: api.content,
    messageType: api.message_type || 'text',
    metadata: api.metadata,
    tokenCount: api.token_count,
    modelUsed: api.model_used,
    authorUserId: api.author_user_id || null,
    authorName: api.author_name || null,
    authorEmail: api.author_email || null,
    createdAt: new Date(api.created_at),
  };
}

export default useConversationStore;
