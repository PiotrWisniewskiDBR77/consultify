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

import { normalizeLanguageCode, type SupportedLanguage } from '@/i18n';
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
// chat-history fix 2026-04-18 (feedback #3a41921c CRIT "infinite Loading conversations…"):
// Without a hard deadline, a hung backend or stalled proxy leaves isLoading=true
// forever. Give fetches a 20s ceiling; on timeout we release the loader and
// surface an error so the UI can recover (and the user can retry / refresh).
const FETCH_HARD_TIMEOUT_MS = 20000;
let _inflightFetchConversations: Promise<void> | null = null;
let _lastFetchConversationsAt = 0;
const _inflightFetchConversationById: Record<string, Promise<void> | undefined> = {};
const _lastFetchConversationAt: Record<string, number> = {};
const _conversationMessagesCache: Record<string, ConversationMessage[]> = {};
const MISSING_CONVERSATIONS_STORAGE_KEY = 'consultify-missing-conversations';

function readMissingConversationIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(MISSING_CONVERSATIONS_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(
      parsed.map((value) => String(value || '').trim()).filter((value) => value.length > 0)
    );
  } catch {
    return new Set();
  }
}

function writeMissingConversationIds(ids: Set<string>) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(MISSING_CONVERSATIONS_STORAGE_KEY, JSON.stringify(Array.from(ids)));
  } catch {
    // no-op
  }
}

export function markConversationAsMissing(conversationId: string) {
  const normalized = String(conversationId || '').trim();
  if (!normalized) return;
  const ids = readMissingConversationIds();
  ids.add(normalized);
  writeMissingConversationIds(ids);
}

export function clearMissingConversationMark(conversationId: string) {
  const normalized = String(conversationId || '').trim();
  if (!normalized) return;
  const ids = readMissingConversationIds();
  if (!ids.delete(normalized)) return;
  writeMissingConversationIds(ids);
}

export function isConversationMarkedMissing(conversationId: string): boolean {
  const normalized = String(conversationId || '').trim();
  if (!normalized) return false;
  return readMissingConversationIds().has(normalized);
}

function isChatRootPath(): boolean {
  if (typeof window === 'undefined') return false;
  const normalized = window.location.pathname.replace(/\/+$/, '') || '/';
  return normalized === '/chat';
}

function getChatRouteConversationId(): string | null {
  if (typeof window === 'undefined') return null;
  const normalized = window.location.pathname.replace(/\/+$/, '') || '/';
  const match = normalized.match(/^\/chat\/([^/]+)$/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

function logConversationStabilityMarker(marker: string, details: Record<string, unknown> = {}) {
  if (typeof console === 'undefined') return;
  console.info('[stability:conversation]', { marker, ...details });
}

function replaceChatRoute() {
  if (typeof window === 'undefined') return;
  try {
    window.history.replaceState(null, '', '/chat');
    window.dispatchEvent(new PopStateEvent('popstate', { state: null }));
    window.dispatchEvent(new CustomEvent('consultify:chat-route-replaced'));
  } catch {
    // ignore navigation failures
  }
}

function quarantineMissingConversationPointer(conversationId: string, reason: string) {
  const normalized = String(conversationId || '').trim();
  if (!normalized) return;
  markConversationAsMissing(normalized);
  delete _conversationMessagesCache[normalized];
  logConversationStabilityMarker('session_quarantine', {
    conversationId: normalized,
    reason,
  });
  replaceChatRoute();
}

function applyMissingConversationState(state: ConversationState) {
  state.activeConversationId = null;
  state.activeMessages = [];
  state.isLoading = false;
  state._activeConversationState = 'not_found';
  state._activeConversationStateMessage = 'This conversation does not exist.';
}

function normalizePersistedMessages(
  rawMessages: any,
  conversationId: string
): ConversationMessage[] {
  if (!Array.isArray(rawMessages)) return [];
  return rawMessages
    .filter((message) => message?.conversationId === conversationId && message?.content)
    .map((message) => ({
      ...message,
      metadata: normalizeApiMetadata(message.metadata),
      createdAt: message.createdAt ? new Date(message.createdAt) : new Date(),
    }));
}

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

// ---------------------------------------------------------------------------
// Title generation de-dupe / retry
// ---------------------------------------------------------------------------
const TITLE_DEDUPE_WINDOW_MS = 5000;
const TITLE_MAX_RETRIES = 3;
const _lastTitleAttemptAt: Record<string, number> = {};
// In-flight guard (#23): collapse rapid duplicate generateTitle calls for the
// same conversation into a single HTTP request instead of firing 4x.
const _titleGenerationInFlight: Record<string, Promise<void>> = {};

function getAppLanguageFallback(): SupportedLanguage {
  try {
    // Prefer the i18n-selected language stored in localStorage (set when user changes app language)
    if (typeof localStorage !== 'undefined') {
      const i18nLng = localStorage.getItem('i18nextLng');
      if (i18nLng) {
        const i18nBase = String(i18nLng).split('-')[0].toLowerCase();
        // normalizeLanguageCode resolves the legacy 'jp' alias to 'ja' too.
        const i18nMapped = normalizeLanguageCode(i18nBase);
        if (i18nMapped) return i18nMapped;
      }
    }
    // Fall back to browser language
    const nav =
      (typeof navigator !== 'undefined' && (navigator.languages?.[0] || navigator.language)) ||
      'pl';
    const base = String(nav).split('-')[0].toLowerCase();
    const mapped = normalizeLanguageCode(base);
    return mapped || 'pl';
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
    kpiId?: string;
  };
  messageCount: number;
  lastMessagePreview?: string;
  lastMessageAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  /** Optimistic concurrency version (§2.3.5 E9) */
  version?: number;
  /** Soft-delete timestamp */
  deletedAt?: string | null;
  /** Deep-link state from backend */
  _state?: 'active' | 'archived' | 'deleted' | 'not_found';
  _stateMessage?: string;
  /** Search results only: the message that matched, for deep-linking (M01-P02). */
  matchedMessageId?: string;
  /**
   * Search results only: the matching excerpt as inert {text, mark} segments.
   * The server strips its own highlight delimiters before this ever leaves
   * the API, so this can never carry markup to render (M01-P02).
   */
  matchedSnippet?: ConversationSnippetSegment[];
}

/** A search-result excerpt segment. `mark: true` = part of the matched term. */
export interface ConversationSnippetSegment {
  text: string;
  mark: boolean;
}

export interface ConversationMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'ai';
  content: string;
  messageType:
    | 'text'
    | 'action_request'
    | 'summary'
    | 'file'
    | 'tool_call'
    | 'voice'
    // V8: governed proposal + execution message family (CHAT_V8_ACTIONS_AND_APPROVALS)
    | 'execution_proposal'
    | 'execution_progress'
    | 'execution_result';
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
    canvasCommand?: {
      starterId?: string;
      cleanPrompt?: string;
    };
    /** Attachment pointers carried on the message (§2.3.1) */
    attachments?: Array<{
      kind?: string;
      filename?: string;
      name?: string;
      docId?: string;
      sourceUrl?: string;
      url?: string;
      mimeType?: string;
      size?: number;
    }>;
    /**
     * Optional diagnostics for persisted AI/system messages.
     * Useful for debugging stream failures without polluting message content.
     */
    error?: string;
    /**
     * B2 (deliverables light): chat-generated deliverable reference (deck/doc).
     * Persisted server-side with the final generation note, so the ArtifactChip
     * in the transcript survives reloads. `generationId` = deckId/draftId.
     */
    deliverable?: {
      kind: 'deck' | 'doc' | 'sheet';
      generationId: string;
      title?: string;
    };
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

type ConversationGroup = 'pinned' | 'today' | 'thisWeek' | 'thisMonth' | 'older' | 'archived';

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
): 'assessment' | 'initiative' | 'roadmap' | 'task' | 'decision' | 'kpi' | null {
  const ctx = conv.pmoContext;
  if (ctx?.assessmentId) return 'assessment';
  if (ctx?.initiativeIds && ctx.initiativeIds.length > 0) return 'initiative';
  if (ctx?.roadmapId) return 'roadmap';
  if (ctx?.taskId) return 'task';
  if (ctx?.decisionId) return 'decision';
  if (ctx?.kpiId) return 'kpi';
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

  // Deep-link / lifecycle state for the active conversation (§2.3.5)
  _activeConversationState:
    | 'active'
    | 'archived'
    | 'deleted'
    | 'not_found'
    | 'permission_denied'
    | null;
  _activeConversationStateMessage: string | null;

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
    /** bypass local fetch de-dupe/throttle window */
    force?: boolean;
  }) => Promise<void>;
  fetchConversation: (id: string) => Promise<void>;

  // Actions - CRUD
  createConversation: (options?: {
    title?: string;
    projectId?: string;
    chatProjectId?: string;
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
   * Deliverables light (L1): ephemeral, local-only AI message (np. checklista
   * Task-Progress generacji). NIE jest persystowana na serwerze — znika po
   * przeładowaniu rozmowy; trwały zapis końcowy idzie przez addMessage.
   * Zwraca id wiadomości do późniejszych updateMessageContent().
   */
  appendLocalMessage: (message: {
    role: 'user' | 'ai';
    content: string;
    messageType?: ConversationMessage['messageType'];
  }) => string;
  /** Aktualizuje treść wiadomości po id (lokalnie, bez serwera). */
  updateMessageContent: (messageId: string, content: string) => void;
  /** Usuwa wiadomość ephemeral po id (tylko lokalne, oznaczone metadata.ephemeral). */
  removeLocalMessage: (messageId: string) => void;
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

  /**
   * Notify the store that the AI model/preset changed mid-conversation.
   * Creates a new session on the backend to track the runtime snapshot (§2.3.1).
   */
  notifyModelChange: (params: {
    modelId?: string;
    presetId?: string;
    locale?: string;
    toolsEnabled?: string[];
  }) => Promise<void>;

  /**
   * Export a conversation (§2.3.5 E10).
   */
  exportConversation: (
    id: string,
    params?: {
      from?: string;
      to?: string;
      format?: 'json' | 'markdown' | 'text';
    }
  ) => Promise<any>;

  /**
   * Purge own data — hard-delete a conversation (§2.3.3 delete-my-data).
   */
  purgeConversation: (id: string) => Promise<void>;

  /**
   * Server-side search with cursor pagination and filters.
   * Returns results from the backend search endpoint.
   */
  serverSearch: (params: {
    q: string;
    folderId?: string;
    pinned?: boolean;
    archived?: boolean;
    from?: string;
    to?: string;
    cursor?: string;
    limit?: number;
  }) => Promise<{
    conversations: Conversation[];
    nextCursor: string | null;
    hasMore: boolean;
    /**
     * The search could not be run at all (network/5xx/etc). `conversations`
     * is empty because nothing was retrieved — this is NOT the same as "no
     * matches" and must not be rendered as an empty result set (M01-P02).
     */
    failed?: boolean;
    /** Results are a genuine subset (throttled). */
    partial?: boolean;
    rateLimited?: boolean;
    /**
     * The caller lacks team-read permission, so some matches may have been
     * withheld. Deliberately not a count — see server-side comment in
     * conversations.routes.ts for why a count is itself a disclosure.
     */
    scopeLimited?: boolean;
  }>;

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
      _activeConversationState: null,
      _activeConversationStateMessage: null,
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
        const force = Boolean(options?.force);
        if (!force && _inflightFetchConversations) return _inflightFetchConversations;
        if (!force && now - _lastFetchConversationsAt < FETCH_DEDUPE_WINDOW_MS) return;
        _lastFetchConversationsAt = now;

        set({ isLoading: true });
        _inflightFetchConversations = (async () => {
          try {
            const result = await withDeadline(
              Api.getConversations({
                archived: options?.archived,
                projectId: options?.projectId,
              }),
              FETCH_HARD_TIMEOUT_MS,
              'fetchConversations'
            );

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
            // Always release the loader so the sidebar never sits in an
            // "infinite Loading conversations…" state (feedback #3a41921c).
            set({ isLoading: false });
          }
        })().finally(() => {
          _inflightFetchConversations = null;
        });

        return _inflightFetchConversations;
      },

      fetchConversation: async (id: string) => {
        if (isConversationMarkedMissing(id)) {
          set({
            activeConversationId: null,
            activeMessages: [],
            isLoading: false,
            _activeConversationState: 'not_found',
            _activeConversationStateMessage: 'This conversation does not exist.',
          });
          return;
        }

        const now = Date.now();

        // Feedback #2ee998d3 / #53cc607e — always sync activeConversationId to the
        // requested id up-front, even when we dedupe or reuse an inflight promise.
        // Without this, clicking a historical conversation within the dedupe window
        // (or while another fetch is already inflight) returned silently and the
        // UI kept showing whatever was previously active, so users experienced
        // "click does nothing" on conversation items.
        const current = get().activeConversationId;
        if (current !== id) {
          // Preserve not-yet-persisted optimistic messages belonging to THIS id even on the
          // up-front sync wipe — otherwise a fetch fired mid-send (route-sync / polling) drops
          // the user's just-sent bubble before the full-fetch merge path can run.
          const carriedLocal = get().activeMessages.filter(
            (m) => String(m.id || '').startsWith('local-') && m.conversationId === id
          );
          set({
            activeConversationId: id,
            activeMessages: carriedLocal,
            _activeConversationState: null,
            _activeConversationStateMessage: null,
          });
        }

        if (_inflightFetchConversationById[id]) return _inflightFetchConversationById[id];
        if (now - (_lastFetchConversationAt[id] || 0) < FETCH_DEDUPE_WINDOW_MS) {
          // Dedupe: a recent successful fetch for this id is in cache. Make the
          // terminal state explicit so setActiveConversation cannot leave the UI
          // stuck in "Loading conversation…" after it eagerly set isLoading=true.
          const cachedMessages = _conversationMessagesCache[id];
          if (cachedMessages && get().activeConversationId === id) {
            // Merge any pending optimistic (local-*) messages on top of the cached snapshot,
            // so the dedupe shortcut cannot drop a just-sent user bubble that the cache (taken
            // before the send) doesn't yet contain.
            const cachedKeys = new Set(
              cachedMessages.map(
                (m: ConversationMessage) => `${m.role}|${String(m.content || '').trim()}`
              )
            );
            const pendingLocal = get().activeMessages.filter(
              (m) =>
                String(m.id || '').startsWith('local-') &&
                m.conversationId === id &&
                !cachedKeys.has(`${m.role}|${String(m.content || '').trim()}`)
            );
            set({
              activeMessages:
                pendingLocal.length > 0 ? [...cachedMessages, ...pendingLocal] : cachedMessages,
              isLoading: false,
            });
          } else {
            set({ isLoading: false });
          }
          return;
        }
        _lastFetchConversationAt[id] = now;

        set({ isLoading: true });
        _inflightFetchConversationById[id] = (async () => {
          try {
            const result = await withDeadline(
              Api.getConversation(id),
              FETCH_HARD_TIMEOUT_MS,
              'fetchConversation'
            );
            clearMissingConversationMark(id);

            // Handle deep-link states: deleted conversation
            if (result?._state === 'deleted') {
              set({
                activeConversationId: id,
                activeMessages: [],
                isLoading: false,
                _activeConversationState: 'deleted',
                _activeConversationStateMessage:
                  result?._stateMessage || 'This conversation has been deleted.',
              });
              return;
            }

            // Handle deep-link states: archived conversation (accessible but flagged)
            if (result?._state === 'archived') {
              // Store state so UI can show archived banner
              set((prev) => ({
                ...prev,
                _activeConversationState: 'archived',
                _activeConversationStateMessage: null,
              }));
            } else {
              set((prev) => ({
                ...prev,
                _activeConversationState: 'active',
                _activeConversationStateMessage: null,
              }));
            }

            const messages = (result?.messages || []).map(mapApiMessage);
            const existingActiveMessages = get().activeMessages.filter(
              (message) => message.conversationId === id
            );
            // Preserve NOT-YET-PERSISTED optimistic messages (local-* ids) that the server
            // snapshot doesn't include yet. Previously a fetch mid-send blindly replaced
            // activeMessages with the server list, DROPPING the user's just-sent bubble
            // whenever the conversation already had prior messages (server list non-empty).
            // The store replaces a local-* id with the real id once the POST is acked, so any
            // remaining local-* message is genuinely pending and must survive the merge.
            const serverKeys = new Set(
              messages.map(
                (m: ConversationMessage) => `${m.role}|${String(m.content || '').trim()}`
              )
            );
            const pendingLocal = existingActiveMessages.filter(
              (m: ConversationMessage) =>
                String(m.id || '').startsWith('local-') &&
                !serverKeys.has(`${m.role}|${String(m.content || '').trim()}`)
            );
            const nextMessages =
              pendingLocal.length > 0 ? [...messages, ...pendingLocal] : messages;
            _conversationMessagesCache[id] = nextMessages;
            set((state) => {
              const fromApiRaw = result?.language;
              const fromApiBase = fromApiRaw ? String(fromApiRaw).split('-')[0] : null;
              // normalizeLanguageCode (not a raw isValidLanguage check) so a
              // conversation persisted with the legacy 'jp' code still resolves
              // instead of silently falling through to the app default.
              const fromApi = fromApiBase ? normalizeLanguageCode(fromApiBase) : null;
              const existing = state.chatLanguageByConversationId[id];
              const resolved =
                (fromApi as any) || existing || state.draftChatLanguage || getAppLanguageFallback();
              return {
                activeConversationId: id,
                activeMessages: nextMessages,
                isLoading: false,
                draftChatLanguage: resolved,
                chatLanguageByConversationId: {
                  ...state.chatLanguageByConversationId,
                  [id]: resolved,
                },
              };
            });
          } catch (err: any) {
            console.error('[ConversationStore] Fetch conversation error:', err);
            const status = err?.response?.status || err?.status;
            if (status === 401 || status === 403) {
              const reason = err?.response?.data?.reason || err?.data?.reason || '';
              logConversationStabilityMarker('rehydrate_hard_stop', {
                conversationId: id,
                status,
              });
              set({
                activeConversationId: null,
                activeMessages: [],
                isLoading: false,
                _activeConversationState: 'permission_denied',
                _activeConversationStateMessage:
                  reason ||
                  (status === 401
                    ? 'Your session is no longer authorized for this conversation.'
                    : 'You do not have access to this conversation.'),
              });
              // Preserve the denied deep link. A cold reload must re-run the
              // mounted membership check instead of silently falling back to
              // a writable blank `/chat` composer.
              return;
            }
            if (status === 404) {
              quarantineMissingConversationPointer(id, 'fetch_404');
              logConversationStabilityMarker('rehydrate_hard_stop', {
                conversationId: id,
                status,
              });
              set((state) => {
                const nextConversations = state.conversations.filter(
                  (conversation) => conversation.id !== id
                );
                return {
                  conversations: nextConversations,
                  groupedConversations: groupConversations(nextConversations),
                  activeConversationId: null,
                  activeMessages: [],
                  isLoading: false,
                  _activeConversationState: 'not_found',
                  _activeConversationStateMessage: 'This conversation does not exist.',
                };
              });
              return;
            }
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
            chatProjectId: options?.chatProjectId,
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
          // Send expectedVersion for optimistic concurrency control (§2.3.5 E9)
          const current = get().conversations.find((c) => c.id === id);
          const payload = current?.version
            ? { ...updates, expectedVersion: current.version }
            : updates;

          const updated = await Api.updateConversation(id, payload);
          const mappedUpdated = updated?.id ? mapApiConversation(updated) : null;

          set((state) => {
            const newConversations = state.conversations.map((c) =>
              c.id === id
                ? mappedUpdated
                  ? { ...c, ...mappedUpdated }
                  : { ...c, ...updates, updatedAt: new Date(), version: (c.version || 1) + 1 }
                : c
            );
            return {
              conversations: newConversations,
              groupedConversations: groupConversations(newConversations),
            };
          });
        } catch (err: any) {
          // Write conflict detection (§2.3.5 E9)
          const status = err?.response?.status || err?.status;
          if (status === 409) {
            console.warn('[ConversationStore] Write conflict on', id, '— refreshing from server');
            // Refresh conversation from server to get latest version
            try {
              const fresh = await Api.getConversation(id);
              if (fresh) {
                const mapped = mapApiConversation(fresh);
                set((state) => {
                  const newConversations = state.conversations.map((c) =>
                    c.id === id ? mapped : c
                  );
                  return {
                    conversations: newConversations,
                    groupedConversations: groupConversations(newConversations),
                  };
                });
              }
            } catch {
              /* best effort refresh */
            }
          }
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
        const messageMetadata = normalizeApiMetadata(message.metadata);
        const optimisticMessage: ConversationMessage = {
          id: optimisticId,
          conversationId,
          role: message.role,
          content: message.content,
          messageType: message.messageType || 'text',
          metadata: { ...messageMetadata, local: true } as any,
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
          // Persist with bounded retry. Safe because the server dedupes on clientMessageId,
          // so a retried POST never creates a duplicate row — it just returns the existing one.
          const persistMessage = async () => {
            const maxAttempts = 3;
            let lastErr: unknown;
            for (let attempt = 1; attempt <= maxAttempts; attempt++) {
              try {
                return await Api.addConversationMessage(conversationId, {
                  role: message.role,
                  content: message.content,
                  messageType: message.messageType,
                  metadata: messageMetadata,
                  tokenCount: message.tokenCount,
                  modelUsed: message.modelUsed,
                  // Reuse the optimistic id as the idempotency key so a network-retried POST
                  // (fetchWithRetry) or a double-trigger collapses to a single server row.
                  clientMessageId: optimisticId,
                });
              } catch (e) {
                lastErr = e;
                if (attempt < maxAttempts) {
                  await new Promise((r) => setTimeout(r, 600 * attempt));
                }
              }
            }
            throw lastErr;
          };
          const result = await persistMessage();

          const newMessage =
            result && typeof result === 'object'
              ? mapApiMessage(result)
              : ({
                  ...optimisticMessage,
                  metadata: {
                    ...optimisticMessage.metadata,
                    local: true,
                    serverAckMissing: true,
                  },
                } as ConversationMessage);

          const cachedForConversation = _conversationMessagesCache[conversationId] || [];
          const optimisticIndex = cachedForConversation.findIndex((m) => m.id === optimisticId);
          if (optimisticIndex >= 0) {
            _conversationMessagesCache[conversationId] = cachedForConversation.map((m) =>
              m.id === optimisticId ? newMessage : m
            );
          } else {
            _conversationMessagesCache[conversationId] = [...cachedForConversation, newMessage];
          }

          // Persist attachment pointers if message had attachments in metadata (§2.3.1)
          const msgAttachments = message.metadata?.attachments;
          if (Array.isArray(msgAttachments) && msgAttachments.length > 0 && newMessage.id) {
            for (const att of msgAttachments) {
              try {
                await Api.post(
                  `/conversations/${conversationId}/messages/${newMessage.id}/attachments`,
                  {
                    kind: att.kind || 'file',
                    displayName: att.filename || att.name || 'attachment',
                    targetId: att.docId || null,
                    targetUrl: att.sourceUrl || att.url || null,
                    mime: att.mimeType || null,
                    sizeBytes: att.size || null,
                  }
                );
              } catch {
                // Non-blocking: attachment pointer persistence is best-effort
              }
            }
          }

          set((state) => {
            const isActive = state.activeConversationId === conversationId;
            const nextActiveMessages = isActive
              ? state.activeMessages.some((m) => m.id === optimisticId)
                ? state.activeMessages.map((m) => (m.id === optimisticId ? newMessage : m))
                : [...state.activeMessages, newMessage]
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
          // No activeConversationId gate here: an AI reply may legitimately land in a
          // conversation the user has already navigated away from (stream finishing
          // after a new-chat switch — feedback f9fba1e0, conversations stuck at
          // "New conversation"). Auto-title follows the conversation that received
          // the reply; the dedupe window below still prevents bursts.
          const shouldTryTitle = message.role === 'ai' && defaultTitle && canAutoTitle;

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

      appendLocalMessage: (message) => {
        const id = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        set((state) => ({
          activeMessages: [
            ...state.activeMessages,
            {
              id,
              conversationId: state.activeConversationId || 'local',
              role: message.role,
              content: message.content,
              messageType: message.messageType || 'text',
              metadata: { local: true, ephemeral: true } as any,
              createdAt: new Date(),
            } as ConversationMessage,
          ],
        }));
        return id;
      },

      updateMessageContent: (messageId, content) => {
        set((state) => ({
          activeMessages: state.activeMessages.map((m) =>
            m.id === messageId ? { ...m, content } : m
          ),
        }));
      },

      removeLocalMessage: (messageId) => {
        set((state) => ({
          activeMessages: state.activeMessages.filter(
            (m) => m.id !== messageId || !(m.metadata as any)?.ephemeral
          ),
        }));
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
          if (isConversationMarkedMissing(id)) {
            quarantineMissingConversationPointer(id, 'set_active_missing');
            set({
              activeConversationId: null,
              activeMessages: [],
              isLoading: false,
              _activeConversationState: 'not_found',
              _activeConversationStateMessage: 'This conversation does not exist.',
            });
            return;
          }
          const existing = get().chatLanguageByConversationId[id];
          if (existing) {
            set({ draftChatLanguage: existing });
          }
          // Feedback #2ee998d3 — sync the id eagerly so the UI immediately
          // reflects the selection even before fetchConversation resolves.
          // fetchConversation also performs this sync (see above) as a safety
          // net, but doing it here avoids a one-frame delay on every click.
          const prev = get().activeConversationId;
          if (prev !== id) {
            // Chat P0-3 — abort any in-flight stream on the previous
            // conversation before swapping. Without this the SSE keeps
            // running and the streamed content (hook-state) leaks into the
            // new conversation's view. useAIStream listens for this event
            // and calls abortStream() when in flight.
            if (typeof window !== 'undefined') {
              try {
                window.dispatchEvent(new CustomEvent('chat:abort-stream'));
              } catch {
                /* SSR / older WebView — non-fatal */
              }
            }
            const cachedMessages = _conversationMessagesCache[id] || [];
            set({
              activeConversationId: id,
              activeMessages: cachedMessages,
              isLoading: cachedMessages.length === 0,
              _activeConversationState: null,
              _activeConversationStateMessage: null,
            });
          }
          void get().fetchConversation(id);
        } else {
          set({
            activeConversationId: null,
            activeMessages: [],
            _activeConversationState: null,
            _activeConversationStateMessage: null,
          });
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
        set({
          activeConversationId: null,
          activeMessages: [],
          _activeConversationState: null,
          _activeConversationStateMessage: null,
        });
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
        // If a title generation for this conversation is already running, reuse it
        // rather than issuing a parallel duplicate request.
        const inFlight = _titleGenerationInFlight[id];
        if (inFlight) return inFlight;

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
              const titleLower = String(activeConv?.title || '')
                .trim()
                .toLowerCase();
              const isStillDefault =
                !activeConv?.title ||
                titleLower === '' ||
                titleLower === 'new conversation' ||
                titleLower === 'nowa rozmowa';
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

        const run = attempt(0).finally(() => {
          delete _titleGenerationInFlight[id];
        });
        _titleGenerationInFlight[id] = run;
        return run;
      },

      renameConversation: async (id, title) => {
        // Mark titleSource as 'user' so auto-title generation won't overwrite
        const previous = get().conversations.find((c) => c.id === id) || null;
        set((state) => {
          const next = state.conversations.map((c) =>
            c.id === id ? { ...c, title, titleSource: 'user' as const } : c
          );
          return {
            conversations: next,
            groupedConversations: groupConversations(next),
          };
        });
        try {
          await get().updateConversation(id, { title, titleSource: 'user' } as any);
        } catch (err) {
          if (previous) {
            set((state) => {
              const next = state.conversations.map((c) => (c.id === id ? previous : c));
              return {
                conversations: next,
                groupedConversations: groupConversations(next),
              };
            });
          }
          throw err;
        }
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
          const storageData = localStorage.getItem('consultify-storage');
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
                role: String(m.role),
                content: m.content,
                timestamp: m.timestamp ? new Date(m.timestamp) : undefined,
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
        return conversations.filter((c) => c.chatProjectId === projectId);
      },

      serverSearch: async (params) => {
        try {
          const qs = new URLSearchParams();
          qs.set('q', params.q);
          if (params.folderId) qs.set('folderId', params.folderId);
          if (params.pinned !== undefined) qs.set('pinned', String(params.pinned));
          if (params.archived !== undefined) qs.set('archived', String(params.archived));
          if (params.from) qs.set('from', params.from);
          if (params.to) qs.set('to', params.to);
          if (params.cursor) qs.set('cursor', params.cursor);
          if (params.limit) qs.set('limit', String(params.limit));

          const result = await Api.get(`/conversations/search?${qs.toString()}`);
          return {
            conversations: (result?.conversations || []).map(mapApiConversation),
            nextCursor: result?.nextCursor || null,
            hasMore: result?.hasMore || false,
            failed: false,
            // A 200 response is a complete answer to "what can you see",
            // never `partial` — ACL scoping is a distinct, always-on
            // condition (scopeLimited), not a transient/degraded one, so it
            // gets its own flag instead of overloading `partial`.
            partial: false,
            scopeLimited: Boolean(result?.scopeLimited),
          };
        } catch (err: any) {
          console.error('[ConversationStore] Server search error:', err);
          const status = err?.response?.status || err?.status;
          if (status === 429) {
            // Genuinely degraded: the search index answered, the caller was
            // just throttled — distinct from a hard failure below.
            return {
              conversations: [],
              nextCursor: null,
              hasMore: false,
              failed: false,
              partial: true,
              rateLimited: true,
              scopeLimited: false,
            };
          }
          // Any other error (4xx/5xx/network) is a hard failure: the search
          // did not run at all. Reporting this as `partial` over an empty
          // list previously made a totally broken search look like "a few
          // matches, maybe more" (M01-P02 §3.6 — a hard failure must be
          // reported as a failure, not softened into "may be incomplete").
          return {
            conversations: [],
            nextCursor: null,
            hasMore: false,
            failed: true,
            partial: false,
            scopeLimited: false,
          };
        }
      },

      notifyModelChange: async (params) => {
        const { activeConversationId } = get();
        if (!activeConversationId) return;
        try {
          await Api.post(`/conversations/${activeConversationId}/sessions`, params);
        } catch (err) {
          console.warn('[ConversationStore] Failed to create session on model change:', err);
        }
      },

      exportConversation: async (id, params) => {
        try {
          const qs = new URLSearchParams();
          if (params?.from) qs.set('from', params.from);
          if (params?.to) qs.set('to', params.to);
          if (params?.format) qs.set('format', params.format);
          const queryStr = qs.toString();
          const url = `/conversations/${id}/export${queryStr ? `?${queryStr}` : ''}`;
          return await Api.get(url);
        } catch (err: any) {
          console.error('[ConversationStore] Export error:', err);
          throw err;
        }
      },

      purgeConversation: async (id) => {
        try {
          await Api.delete(`/conversations/${id}?force=true`);
          set((state) => {
            const newConversations = state.conversations.filter((c) => c.id !== id);
            return {
              conversations: newConversations,
              groupedConversations: groupConversations(newConversations),
              activeConversationId:
                state.activeConversationId === id ? null : state.activeConversationId,
              activeMessages: state.activeConversationId === id ? [] : state.activeMessages,
              _activeConversationState:
                state.activeConversationId === id ? null : state._activeConversationState,
            };
          });
        } catch (err) {
          console.error('[ConversationStore] Purge error:', err);
          throw err;
        }
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
      name: 'consultify-conversations',
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
            localStorage.setItem('consultify-preferred-chat-lang', 'pl');
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
        activeMessages: state.activeConversationId
          ? state.activeMessages
              .filter((message) => message.conversationId === state.activeConversationId)
              .slice(-50)
          : [],
        draftChatLanguage: state.draftChatLanguage,
        chatLanguageByConversationId: state.chatLanguageByConversationId,
      }),
      merge: (persistedState: any, currentState) => {
        const persisted = persistedState?.state || persistedState || {};
        const chatRouteConversationId = getChatRouteConversationId();
        if (chatRouteConversationId) {
          if (isConversationMarkedMissing(chatRouteConversationId)) {
            quarantineMissingConversationPointer(chatRouteConversationId, 'merge_missing_route');
            return {
              ...currentState,
              ...persisted,
              activeConversationId: null,
              activeMessages: [],
              _activeConversationState: 'not_found',
              _activeConversationStateMessage: 'This conversation does not exist.',
              isLoading: false,
            };
          }
          const activeMessages = normalizePersistedMessages(
            persisted.activeMessages,
            chatRouteConversationId
          );
          _conversationMessagesCache[chatRouteConversationId] = activeMessages;
          return {
            ...currentState,
            ...persisted,
            activeConversationId: chatRouteConversationId,
            activeMessages,
            _activeConversationState: null,
            _activeConversationStateMessage: null,
            isLoading: false,
          };
        }

        if (!isChatRootPath()) {
          return {
            ...currentState,
            ...persisted,
            activeConversationId: null,
            activeMessages: [],
            _activeConversationState: null,
            _activeConversationStateMessage: null,
            isLoading: false,
          };
        }

        return {
          ...currentState,
          ...persisted,
          activeConversationId: null,
          activeMessages: [],
          _activeConversationState: null,
          _activeConversationStateMessage: null,
          isLoading: false,
        };
      },
      onRehydrateStorage: () => {
        // When store rehydrates, we need to fetch messages for active conversation
        return (state) => {
          // Migration: Reset isSidebarOpen to false to prevent blocking main content
          // This fixes an issue where the chat history sidebar was blocking clicks
          if (state) {
            state.isSidebarOpen = false;
          }

          const chatRouteConversationId = getChatRouteConversationId();
          if (state && isChatRootPath()) {
            state.clearActiveChat();
            return;
          }

          if (chatRouteConversationId && state) {
            if (isConversationMarkedMissing(chatRouteConversationId)) {
              quarantineMissingConversationPointer(
                chatRouteConversationId,
                'rehydrate_missing_route'
              );
              applyMissingConversationState(state);
              return;
            }
            state.activeConversationId = chatRouteConversationId;
          }

          if (state?.activeConversationId) {
            // Wait for auth to be ready instead of using a magic timeout.
            // Poll every 200ms up to 5 seconds for auth token availability.
            const convId = state.activeConversationId;
            if (isConversationMarkedMissing(convId)) {
              quarantineMissingConversationPointer(convId, 'rehydrate_missing_active');
              applyMissingConversationState(state);
              return;
            }
            const maxAttempts = 25;
            let attempt = 0;

            const tryFetch = () => {
              attempt++;
              const token = localStorage.getItem('token');

              if (token) {
                if (isConversationMarkedMissing(convId)) {
                  quarantineMissingConversationPointer(convId, 'rehydrate_missing_before_fetch');
                  applyMissingConversationState(state);
                  return;
                }
                void state.fetchConversation(convId);
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
    // normalizeLanguageCode (not a raw isValidLanguage check) so a
    // conversation persisted with the legacy 'jp' code still resolves.
    language: (languageBase ? normalizeLanguageCode(languageBase) : null) || undefined,
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
    version: api.version || 1,
    deletedAt: api.deleted_at || null,
    _state: api._state || undefined,
    _stateMessage: api._stateMessage || undefined,
    // Present only on search results: which message matched, and its
    // snippet as inert {text, mark} segments — the server never sends
    // markup (M01-P02).
    matchedMessageId: api.matched_message_id || undefined,
    matchedSnippet: Array.isArray(api.matched_snippet) ? api.matched_snippet : undefined,
  };
}

function normalizeApiMetadata(rawMetadata: any): Record<string, any> {
  if (typeof rawMetadata === 'string') {
    try {
      const parsed = JSON.parse(rawMetadata);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  return rawMetadata && typeof rawMetadata === 'object' ? rawMetadata : {};
}

function mapApiMessage(api: any): ConversationMessage {
  if (!api || typeof api !== 'object') {
    throw new Error('Invalid conversation message response');
  }

  const metadata = normalizeApiMetadata(api.metadata);

  return {
    id: api.id,
    conversationId: api.conversation_id,
    role: api.role,
    content: api.content,
    messageType: api.message_type || 'text',
    metadata,
    tokenCount: api.token_count,
    modelUsed: api.model_used,
    authorUserId: api.author_user_id || null,
    authorName: api.author_name || null,
    authorEmail: api.author_email || null,
    createdAt: new Date(api.created_at),
  };
}

export default useConversationStore;
