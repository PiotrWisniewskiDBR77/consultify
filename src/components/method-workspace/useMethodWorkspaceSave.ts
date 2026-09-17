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
  /** Cancel an armed autosave when another action persists the same draft. */
  cancelPending: () => void;
  /** After SAVE_FAILED: try the same save again. */
  retry: () => Promise<void>;
  /** "Zostań" — after SAVE_FAILED, stay and let autosave retry quietly (see impl). */
  acknowledgeFailure: () => void;
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
  const activeSaveRef = useRef<Promise<void> | null>(null);
  const queuedReasonRef = useRef<'autosave' | 'manual' | null>(null);
  const dirtyRevisionRef = useRef(0);
  const saveRef = useRef(save);
  const isOnlineRef = useRef(isOnline);
  const stateRef = useRef<MethodSaveState>('CLEAN');
  stateRef.current = state;
  saveRef.current = save;
  isOnlineRef.current = isOnline;

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const runSave = useCallback(
    async (reason: 'autosave' | 'manual') => {
      if (savingRef.current) {
        // Never drop an edit/save request that arrives while an older payload
        // is in flight. Manual intent wins over an already queued autosave.
        queuedReasonRef.current =
          reason === 'manual' ? 'manual' : (queuedReasonRef.current ?? 'autosave');
        await activeSaveRef.current;
        return;
      }
      if (!isOnlineRef.current) {
        setState('OFFLINE_PENDING');
        return;
      }

      const drain = (async () => {
        savingRef.current = true;
        let nextReason: 'autosave' | 'manual' | null = reason;
        try {
          while (nextReason) {
            const currentReason = nextReason;
            nextReason = null;
            queuedReasonRef.current = null;
            const revisionAtStart = dirtyRevisionRef.current;

            setState('SAVING');
            setErrorMessage(null);

            let result: { ok: true } | { ok: false; error: string };
            try {
              // Read through a ref so a timer armed by the previous render
              // persists the newest payload after React commits the edit.
              result = await saveRef.current(currentReason);
            } catch (err) {
              result = {
                ok: false,
                error: err instanceof Error ? err.message : 'Nieznany błąd zapisu',
              };
            }

            const queuedReason = queuedReasonRef.current;
            if (queuedReason) {
              nextReason = queuedReason;
              continue;
            }

            // A newer edit exists but its debounce has not fired yet. Do not
            // let the older response paint a false SAVED state; the armed
            // timer will perform the follow-up write.
            if (dirtyRevisionRef.current > revisionAtStart) {
              setState('DIRTY');
              continue;
            }

            if (result.ok) {
              setState('SAVED');
              setLastSavedAt(new Date().toISOString());
            } else {
              setState('SAVE_FAILED');
              setErrorMessage(result.error);
            }
          }
        } finally {
          savingRef.current = false;
        }
      })();

      activeSaveRef.current = drain;
      try {
        await drain;
      } finally {
        if (activeSaveRef.current === drain) activeSaveRef.current = null;
      }
    },
    []
  );

  const markDirty = useCallback(() => {
    dirtyRevisionRef.current += 1;
    setState('DIRTY');
    setErrorMessage(null);
    clearTimer();
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
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

  /**
   * "Zostań" (`SaveStateIndicator`'s `onStay`) — the operator explicitly
   * chooses not to retry immediately but to keep working here. Distinct from
   * `retry`: it does not force a save attempt now, it re-arms the normal
   * autosave debounce (SAVE_FAILED -> DIRTY) so the next edit — or the
   * existing debounce window — tries again quietly instead of leaving the
   * failed banner stuck forever.
   */
  const acknowledgeFailure = useCallback(() => {
    if (stateRef.current !== 'SAVE_FAILED') return;
    setErrorMessage(null);
    markDirty();
  }, [markDirty]);

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

  return {
    state,
    lastSavedAt,
    errorMessage,
    markDirty,
    saveNow,
    cancelPending: clearTimer,
    retry,
    acknowledgeFailure,
    attemptLeave,
  };
}

export default useMethodWorkspaceSave;
