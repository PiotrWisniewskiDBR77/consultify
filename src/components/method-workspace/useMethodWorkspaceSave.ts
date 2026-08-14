/**
 * useMethodWorkspaceSave — save-state machine for the Method Workspace shell.
 *
 * `CLEAN → DIRTY → SAVING → SAVED | SAVE_FAILED | OFFLINE_PENDING`
 * (contracts `MethodSaveState`, TOOL_SESSION_WORKSPACE_STANDARD.md §6.3).
 *
 * Rules encoded here:
 *  1. every edit sets DIRTY immediately (`markDirty`);
 *  2. autosave is debounced; `saveNow` runs immediately and cancels the timer;
 *  3. `SAVED` renders only after the backend confirms — never optimistically;
 *  4. a leave guard (beforeunload + `attemptLeave`) blocks a silent exit while
 *     DIRTY/SAVING/SAVE_FAILED and lets the caller offer Retry/Stay;
 *  5. offline is a distinct terminal state (`OFFLINE_PENDING`), not an error.
 *
 * This hook does not know what "save" means — the caller (A6/A7) supplies the
 * actual persistence call. The shell only owns the state machine and the
 * leave-guard contract.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import type { MethodSaveState } from '@/method-core/contracts';

export interface UseMethodWorkspaceSaveOptions {
  /** Persist the current draft. Resolve `{ ok: true }` only after backend read-back. */
  save: (reason: 'autosave' | 'manual') => Promise<{ ok: true } | { ok: false; error: string }>;
  /** Debounce window for autosave after `markDirty`. Default 1500ms. */
  debounceMs?: number;
  /** Report connectivity; when false, dirty edits queue as OFFLINE_PENDING instead of saving. */
  isOnline?: boolean;
}

export interface UseMethodWorkspaceSaveReturn {
  state: MethodSaveState;
  lastSavedAt: string | null;
  errorMessage: string | null;
  /** Call on every field edit. Transitions CLEAN/SAVED → DIRTY and (re)starts the autosave timer. */
  markDirty: () => void;
  /** `Zapisz teraz` — bypasses the debounce and saves immediately. */
  saveNow: () => Promise<void>;
  /** After SAVE_FAILED: try the same save again. */
  retry: () => Promise<void>;
  /**
   * Call before navigating away / closing / refreshing. Returns `true` when it is
   * safe to leave immediately (CLEAN or SAVED with no pending timer) and
   * `false` when the caller must show the Retry/Stay choice (SAVE_FAILED) or
   * has just flushed a pending autosave (DIRTY/SAVING).
   */
  attemptLeave: () => boolean;
}

export function useMethodWorkspaceSave(
  options: UseMethodWorkspaceSaveOptions
): UseMethodWorkspaceSaveReturn {
  const { save, debounceMs = 1500, isOnline = true } = options;

  const [state, setState] = useState<MethodSaveState>('CLEAN');
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savingRef = useRef(false);
  const stateRef = useRef<MethodSaveState>('CLEAN');
  stateRef.current = state;

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const runSave = useCallback(
    async (reason: 'autosave' | 'manual') => {
      if (savingRef.current) return;
      if (!isOnline) {
        setState('OFFLINE_PENDING');
        return;
      }
      savingRef.current = true;
      setState('SAVING');
      setErrorMessage(null);
      try {
        const result = await save(reason);
        if (result.ok) {
          setState('SAVED');
          setLastSavedAt(new Date().toISOString());
        } else {
          setState('SAVE_FAILED');
          setErrorMessage(result.error);
        }
      } catch (err) {
        setState('SAVE_FAILED');
        setErrorMessage(err instanceof Error ? err.message : 'Nieznany błąd zapisu');
      } finally {
        savingRef.current = false;
      }
    },
    [save, isOnline]
  );

  const markDirty = useCallback(() => {
    setState((prev) => (prev === 'SAVING' ? prev : 'DIRTY'));
    setErrorMessage(null);
    clearTimer();
    timerRef.current = setTimeout(() => {
      void runSave('autosave');
    }, debounceMs);
  }, [clearTimer, debounceMs, runSave]);

  const saveNow = useCallback(async () => {
    clearTimer();
    await runSave('manual');
  }, [clearTimer, runSave]);

  const retry = useCallback(async () => {
    clearTimer();
    await runSave('manual');
  }, [clearTimer, runSave]);

  const attemptLeave = useCallback(() => {
    const current = stateRef.current;
    if (current === 'CLEAN' || current === 'SAVED') return true;
    if (current === 'DIRTY') {
      // Flush immediately rather than losing the edit.
      clearTimer();
      void runSave('manual');
      return false;
    }
    // SAVING / SAVE_FAILED / OFFLINE_PENDING — caller must decide.
    return false;
  }, [clearTimer, runSave]);

  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      const current = stateRef.current;
      if (current === 'DIRTY' || current === 'SAVING' || current === 'SAVE_FAILED') {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => {
      window.removeEventListener('beforeunload', handler);
      clearTimer();
    };
  }, [clearTimer]);

  return { state, lastSavedAt, errorMessage, markDirty, saveNow, retry, attemptLeave };
}

export default useMethodWorkspaceSave;
