import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { AuthSlice, createAuthSlice } from './slices/authSlice';
import { ChatSlice, createChatSlice } from './slices/chatSlice';
import { createDemoSlice, DemoSlice } from './slices/demoSlice';
import { createProjectSlice, ProjectSlice } from './slices/projectSlice';
import { createUISlice, UISlice } from './slices/uiSlice';

// Combine all slice types into AppState
export type AppState = AuthSlice & UISlice & ChatSlice & ProjectSlice & DemoSlice;

// Perf: this store updates very frequently (chat streaming, UI state, etc.).
// Persisting large blobs on every update can freeze the UI (localStorage + JSON stringify are sync).
// We (a) persist only the minimal state needed across reloads and (b) debounce/skip redundant writes.
const APP_STORE_KEY = 'consultify-storage';
const appStoreStorage = createJSONStorage(() => {
  const pending = new Map<string, string>();
  const timers = new Map<string, number>();
  const lastWritten = new Map<string, string | null>();

  const scheduleWrite = (key: string) => {
    const existingTimer = timers.get(key);
    if (existingTimer) window.clearTimeout(existingTimer);

    const t = window.setTimeout(() => {
      timers.delete(key);
      const value = pending.get(key);
      if (typeof value !== 'string') return;

      // Skip no-op writes (common when state changes don't affect partialized subset)
      if (lastWritten.get(key) === value) return;
      try {
        localStorage.setItem(key, value);
        lastWritten.set(key, value);
      } catch {
        // ignore quota/security errors
      } finally {
        pending.delete(key);
      }
    }, 300);
    timers.set(key, t);
  };

  return {
    getItem: (name: string) => {
      try {
        const raw = localStorage.getItem(name);
        // Safety/perf: if an old build persisted huge blobs (chat logs, sessions),
        // rehydrating can freeze the UI. Drop obviously-too-large payloads.
        if (typeof raw === 'string' && raw.length > 2_000_000) {
          try {
            localStorage.removeItem(name);
          } catch {
            // ignore
          }
          return null;
        }
        return raw;
      } catch {
        return null;
      }
    },
    setItem: (name: string, value: string) => {
      // Coalesce fast updates
      pending.set(name, value);
      scheduleWrite(name);
    },
    removeItem: (name: string) => {
      const t = timers.get(name);
      if (t) window.clearTimeout(t);
      timers.delete(name);
      pending.delete(name);
      lastWritten.delete(name);
      try {
        localStorage.removeItem(name);
      } catch {
        // ignore
      }
    },
  };
});

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
        }
        // Clean up legacy persisted blobs that cause jank on rehydrate.
        // (Older builds persisted large chat/session payloads.)
        delete (next as any).activeChatMessages;
        delete (next as any).projectChatMessages;
        delete (next as any).freeSessionData;
        delete (next as any).fullSessionData;
        delete (next as any).notifications;
        delete (next as any).aiConfig;
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

        // ProjectSlice
        currentProjectId: state.currentProjectId,
        // NOTE: We intentionally do NOT persist large/fast-changing blobs like:
        // - chat messages (activeChatMessages, projectChatMessages)
        // - session data (freeSessionData, fullSessionData)
        // - notifications list
        // These should be fetched from the API and keeping them persisted causes UI jank.

        // DemoSlice - persist demo mode state
        isDemoMode: state.isDemoMode,
        demoOrganization: state.demoOrganization,
      }),
    }
  )
);
