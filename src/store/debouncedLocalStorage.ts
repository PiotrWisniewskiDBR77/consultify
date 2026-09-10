// store/debouncedLocalStorage.ts
//
// F3a (pomiar A2, POMIAR_S1_5_JEDEN_PANEL_20260910.md §4 defekt 2): factored
// out of useAppStore.ts so the debounce + flush-on-hide logic can be unit
// tested directly — `useAppStore` itself is globally mocked in
// tests/setup.ts (every test file gets a plain stub for it), so a test
// importing `useAppStore` can never exercise its real persistence layer.
// This module has no such mock and is safe to import for real.
//
// Perf: the app's zustand store updates very frequently (chat streaming, UI
// state, etc.). Persisting large blobs on every update can freeze the UI
// (localStorage + JSON.stringify are sync), so writes are coalesced with a
// short debounce and no-op writes are skipped.
//
// That debounce, though, means a write can be sitting in `pending`,
// unflushed, when the tab reloads or closes. `isChatCollapsed` (the one
// global Teresa dock, DEC-404) is exactly this shape — closing the dock's X
// calls `toggleChatCollapse()` once; if the user reloads inside the debounce
// window, the pending "collapsed:true" write is discarded and localStorage
// still holds the OLD "collapsed:false" — so the dock silently reopens on
// reload, looking like the close never happened. `flushPending` writes any
// pending key synchronously; it runs on `pagehide`/`visibilitychange:hidden`
// so a reload or tab-close never loses the last toggle.
export const DEBOUNCE_MS = 300;

export interface JSONStorageLike {
  getItem: (name: string) => string | null;
  setItem: (name: string, value: string) => void;
  removeItem: (name: string) => void;
}

/**
 * Build a localStorage-backed storage object that debounces writes and
 * flushes any pending one synchronously when the page is about to disappear.
 * Each call creates its own independent `pending`/`timers` state and its own
 * event listeners — callers (tests included) get a fresh, isolated instance.
 */
export function createDebouncedLocalStorage(debounceMs: number = DEBOUNCE_MS): JSONStorageLike {
  const pending = new Map<string, string>();
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const lastWritten = new Map<string, string | null>();

  const commitWrite = (key: string) => {
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
  };

  const scheduleWrite = (key: string) => {
    const existingTimer = timers.get(key);
    if (existingTimer) clearTimeout(existingTimer);

    const t = setTimeout(() => commitWrite(key), debounceMs);
    timers.set(key, t);
  };

  // Flush every debounced write immediately, bypassing the coalescing window.
  // Called right before the page can disappear (reload, tab close,
  // backgrounding) so a just-toggled value is never lost to the debounce race.
  const flushPending = () => {
    for (const key of Array.from(timers.keys())) {
      clearTimeout(timers.get(key));
      timers.delete(key);
      commitWrite(key);
    }
  };

  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    // pagehide covers reload/navigation/close on both desktop and mobile browsers
    // (more reliable than beforeunload on iOS Safari); visibilitychange covers
    // backgrounding (app switch, tab switch) where pagehide may not fire.
    window.addEventListener('pagehide', flushPending);
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') flushPending();
      });
    }
  }

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
      if (t) clearTimeout(t);
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
}
