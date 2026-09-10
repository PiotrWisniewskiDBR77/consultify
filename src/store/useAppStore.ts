import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { createDebouncedLocalStorage } from './debouncedLocalStorage';
import { AuthSlice, createAuthSlice } from './slices/authSlice';
import { ChatSlice, createChatSlice } from './slices/chatSlice';
import { createDemoSlice, DemoSlice } from './slices/demoSlice';
import { createProjectSlice, ProjectSlice } from './slices/projectSlice';
import { createUISlice, UISlice } from './slices/uiSlice';

/**
 * Store Ownership Map (all Zustand stores in the app):
 *
 * COMPOSED (this store):
 *   authSlice       — Auth & org (currentUser, sessionMode, org)
 *   uiSlice         — Shell UI (currentView, theme, sidebar, chat panel)
 *   chatSlice       — Legacy chat messages + AI config       ⚠ OVERLAP: useConversationStore
 *   projectSlice    — PMO workspace (projectId, session data) ⚠ OVERLAP: usePMOStore
 *   demoSlice       — Demo mode flags
 *
 * STANDALONE:
 *   useConversationStore (52k) — Unified AI conversations     ⚠ HIGH overlap with chatSlice
 *   useToolStore         (81k) — Strategic tool sessions       ⚠ MEDIUM overlap with useDiscoveryStore
 *   useDiscoveryStore    (25k) — Discovery canvas/sessions
 *   useMultiFrameworkStore(19k)— Assessment frameworks
 *   useContextBuilderStore(13k)— Context Builder wizard
 *   useAIActionsStore    (12k) — AI action approval queue
 *   useChatProjectStore  (11k) — Chat folders (NOT PMO projects)
 *   useArtifactsStore    (10k) — AI artifacts panel
 *   useOpenDocumentsStore (5k) — Module tab strip
 *   usePMOStore           (5k) — PMO phase/gate context        ⚠ MEDIUM overlap with projectSlice
 *   usePortfolioStore     (3k) — Portfolio/roadmap view
 *   useMegatrendStore     (3k) — Megatrend baseline cache
 *
 * CONSOLIDATION PRIORITIES:
 *   1. chatSlice ↔ useConversationStore — merge chat messages into conversation store
 *   2. projectSlice ↔ usePMOStore — unify PMO project context
 *   3. useToolStore ↔ useDiscoveryStore — clarify discovery tool boundary
 */
export type AppState = AuthSlice & UISlice & ChatSlice & ProjectSlice & DemoSlice;

// Perf: this store updates very frequently (chat streaming, UI state, etc.).
// Persisting large blobs on every update can freeze the UI (localStorage + JSON stringify are sync).
// We (a) persist only the minimal state needed across reloads and (b) debounce/skip redundant writes
// (see ./debouncedLocalStorage.ts).
//
// F3a (pomiar A2, POMIAR_S1_5_JEDEN_PANEL_20260910.md §4 defekt 2): the debounce in
// createDebouncedLocalStorage coalesces fast updates, but it also means a write can be sitting
// unflushed when the tab reloads or closes. `isChatCollapsed` (the one global Teresa dock,
// DEC-404) is exactly this shape — closing the dock's X calls `toggleChatCollapse()` once; if the
// user reloads inside the debounce window, the pending "collapsed:true" write used to be
// discarded and localStorage still held the OLD "collapsed:false" — so the dock silently reopened
// on reload, looking like the close never happened. createDebouncedLocalStorage now flushes any
// pending write synchronously on `pagehide`/`visibilitychange:hidden`, so a reload or tab-close
// never loses the last toggle. Pure persistence-layer fix — no layout/visual change.
const APP_STORE_KEY = 'consultify-storage';
const appStoreStorage = createJSONStorage(() => createDebouncedLocalStorage());

export const useAppStore = create<AppState>()(
  persist(
    (...a) => ({
      ...createAuthSlice(...a),
      ...createUISlice(...a),
      ...createChatSlice(...a),
      ...createProjectSlice(...a),
      ...createDemoSlice(...a),
    }),
    {
      name: APP_STORE_KEY, // unique name for localStorage
      storage: appStoreStorage,
      version: 2,
      migrate: (persisted: any, fromVersion) => {
        // Migration: make sure chat panel defaults to collapsed after upgrade
        // to avoid global UI lag on machines with weaker GPU/CPU.
        if (!persisted || typeof persisted !== 'object') return persisted;
        const next = { ...persisted };
        if (fromVersion < 2) {
          next.isChatCollapsed = true;
          // aiConfig was absent from partialize in v1; re-added in v2 to persist
          // AI mode toggles across reloads — only strip it for pre-v2 stores.
          delete (next as any).aiConfig;
        }
        // Clean up legacy persisted blobs that cause jank on rehydrate.
        // (Older builds persisted large chat/session payloads.)
        delete (next as any).activeChatMessages;
        delete (next as any).projectChatMessages;
        delete (next as any).freeSessionData;
        delete (next as any).fullSessionData;
        delete (next as any).notifications;
        return next;
      },
      partialize: (state) => ({
        // AuthSlice
        sessionMode: state.sessionMode,
        currentUser: state.currentUser,
        currentOrganization: state.currentOrganization,

        // UISlice
        currentView: state.currentView,
        isSidebarCollapsed: state.isSidebarCollapsed,
        isChatCollapsed: state.isChatCollapsed,
        chatPanelWidth: state.chatPanelWidth,
        isChatSlidingPanelOpen: state.isChatSlidingPanelOpen,
        previousView: state.previousView,
        theme: state.theme,
        notebookRailOpen: state.notebookRailOpen,
        notebookRailTab: state.notebookRailTab,

        // ProjectSlice
        currentProjectId: state.currentProjectId,
        // NOTE: We intentionally do NOT persist large/fast-changing blobs like:
        // - chat messages (activeChatMessages, projectChatMessages)
        // - session data (freeSessionData, fullSessionData)
        // - notifications list
        // These should be fetched from the API and keeping them persisted causes UI jank.

        // ChatSlice - persist AI configuration toggles across reloads
        aiConfig: state.aiConfig,

        // DemoSlice - persist demo mode state
        isDemoMode: state.isDemoMode,
        demoSessionOrgId: state.demoSessionOrgId,
        demoLocale: state.demoLocale,
        demoOrganization: state.demoOrganization,
      }),
    }
  )
);
