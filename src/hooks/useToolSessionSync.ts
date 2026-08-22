/**
 * useToolSessionSync — server-is-source-of-truth sync for a tool session.
 *
 * Replaces "keep it in the zustand store + zustand `persist` localStorage"
 * as the runtime contract for tool session working state (e.g. Dynamic
 * SWOT). The server (`tool_sessions` in PostgreSQL, via `toolSessionApi`)
 * is authoritative. This hook:
 *   - loads a session from the server (`load`);
 *   - creates a new session over HTTP (`create`);
 *   - accepts optimistic local edits (`setData`) and autosaves them to the
 *     server after a debounce (`debounceMs`, default 2000ms — matches the
 *     autosave cadence ToolDocumentView already used before this adapter
 *     existed);
 *   - tracks the server's `updatedAt`/`version` and sends the required
 *     `expectedVersion` on every PUT; stale writers receive a real 409 and
 *     must reconcile with the authoritative server version;
 *   - detects offline saves (network unreachable, not an HTTP error) and
 *     retries automatically once the browser reports `online`;
 *   - keeps a localStorage "recovery draft" that is NEVER the source of
 *     truth (see `toolSessionRecoveryDraft.ts`): on every `load()`, the
 *     server wins; a draft is either discarded (server moved on — the
 *     caller is told via `onRecoveryDiscarded`) or offered back to the
 *     user (server didn't move on and the draft differs — via
 *     `onRecoveryAvailable` / `recoveryAvailable` / `applyRecoveryDraft`).
 *
 * This hook is intentionally data-shape-agnostic (`TData` is the tool's
 * `answers` blob) so it does not duplicate the SWOT-specific
 * normalization that already lives in `src/store/useToolStore.ts`. The
 * expected wiring (see `ToolDocumentView.tsx`) is: this hook owns
 * transport/persistence; the zustand store keeps owning the
 * editable/derived UI state, and a small effect forwards
 * `currentSession.inputData` into `setData()` whenever it changes.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  type CreateToolSessionInput,
  isConflictError,
  isNotFoundError,
  isOfflineError,
  toolSessionApi,
  type ToolSessionApiRecord,
  type UpdateToolSessionInput,
} from '@/services/toolSessionApi';
import {
  clearRecoveryDraft,
  evaluateRecoveryDraft,
  readRecoveryDraft,
  writeRecoveryDraft,
} from '@/services/toolSessionRecoveryDraft';

export type ToolSessionSyncStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'saving'
  | 'dirty'
  | 'saved'
  | 'error'
  | 'offline'
  | 'conflict';

/** Legacy 4-value save-state contract consumed by `NModeHeader` (see
 * `src/components/shared/NModeLayout/types.ts`). The shell is governed by
 * the SPEC-A/TRIADA canon and out of this stream's scope to redesign, so
 * `offline`/`conflict` map onto `error` for that single display prop —
 * the richer status (and the reason) stays available via this hook's own
 * `status`/`error`/`isOffline` for anything that wants it (toasts,
 * tests). */
export function mapToolSessionSyncStatusToLegacySaveState(
  status: ToolSessionSyncStatus
): 'saved' | 'saving' | 'dirty' | 'error' {
  switch (status) {
    case 'saving':
      return 'saving';
    case 'dirty':
      return 'dirty';
    case 'error':
    case 'offline':
    case 'conflict':
      return 'error';
    default:
      return 'saved';
  }
}

export interface UseToolSessionSyncOptions<TData> {
  /** null/undefined = no session yet (e.g. still creating one). */
  toolId: string | null | undefined;
  /** ms to wait after the last local change before autosaving. Default 2000. */
  debounceMs?: number;
  /** Extra PUT payload fields (completionPercent, confidenceAvg, wizardState, ...)
   * computed fresh at save time — called once per save, not cached. */
  getExtraPayload?: () => Omit<UpdateToolSessionInput, 'answers' | 'expectedVersion'>;
  /** Fired once after a `load()` finds a local draft the server has already
   * superseded, right after it is silently discarded. */
  onRecoveryDiscarded?: () => void;
  /** Fired once after a `load()` finds a local draft that looks like
   * genuine unsynced work (server hasn't moved on, data differs). */
  onRecoveryAvailable?: (draftData: TData, draftSavedAt: string) => void;
}

export interface UseToolSessionSyncResult<TData> {
  status: ToolSessionSyncStatus;
  session: ToolSessionApiRecord | null;
  data: TData | null;
  error: string | null;
  isOffline: boolean;
  lastSyncedAt: string | null;
  recoveryAvailable: boolean;
  /** Returns the freshly loaded record (or null on failure) — do not rely
   * on the `session`/`data` state fields being updated synchronously right
   * after this resolves; React state updates are not visible in the same
   * closure until the next render. */
  load: () => Promise<ToolSessionApiRecord | null>;
  create: (input: CreateToolSessionInput) => Promise<string>;
  setData: (updater: TData | ((prev: TData | null) => TData)) => void;
  /** Immediately saves, bypassing the debounce, and resolves with the
   * definitive outcome (not the `status` state field — see note above
   * `performSave`). No-op returning 'conflict' while unresolved. */
  flush: () => Promise<ToolSessionSyncStatus>;
  /** Discard any local/unsynced state and refetch from the server — the
   * conflict-recovery action. */
  reconcile: () => Promise<void>;
  applyRecoveryDraft: () => void;
  discardRecoveryDraft: () => void;
}

function deepEqualJson(a: unknown, b: unknown): boolean {
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

export function useToolSessionSync<TData = Record<string, unknown>>(
  options: UseToolSessionSyncOptions<TData>
): UseToolSessionSyncResult<TData> {
  const { toolId, debounceMs = 2000 } = options;

  const [status, setStatus] = useState<ToolSessionSyncStatus>('idle');
  const [session, setSession] = useState<ToolSessionApiRecord | null>(null);
  const [data, setDataState] = useState<TData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [recoveryAvailable, setRecoveryAvailable] = useState(false);

  const toolIdRef = useRef(toolId);
  toolIdRef.current = toolId;
  const sessionRef = useRef<ToolSessionApiRecord | null>(null);
  const dataRef = useRef<TData | null>(null);
  const statusRef = useRef<ToolSessionSyncStatus>('idle');
  statusRef.current = status;
  const pendingRecoveryDraftRef = useRef<TData | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onlineListenerRef = useRef<(() => void) | null>(null);

  const getExtraPayloadRef = useRef(options.getExtraPayload);
  getExtraPayloadRef.current = options.getExtraPayload;
  const onRecoveryDiscardedRef = useRef(options.onRecoveryDiscarded);
  onRecoveryDiscardedRef.current = options.onRecoveryDiscarded;
  const onRecoveryAvailableRef = useRef(options.onRecoveryAvailable);
  onRecoveryAvailableRef.current = options.onRecoveryAvailable;

  const clearSaveTimer = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
  }, []);

  const clearOnlineListener = useCallback(() => {
    if (onlineListenerRef.current && typeof window !== 'undefined') {
      window.removeEventListener('online', onlineListenerRef.current);
      onlineListenerRef.current = null;
    }
  }, []);

  // Resolves with the definitive outcome of this save attempt. Callers
  // that `await flush()` right after a click need this return value, not
  // the `status` state field — a React state update scheduled inside this
  // same async function is not visible in a closure captured by an
  // earlier render (see ToolDocumentView.tsx's handleSave).
  const performSaveRef = useRef<() => Promise<ToolSessionSyncStatus>>(async () => 'idle');

  const performSave = useCallback(async (): Promise<ToolSessionSyncStatus> => {
    const id = toolIdRef.current;
    if (!id || dataRef.current === null) return statusRef.current;
    clearSaveTimer();
    setStatus('saving');
    try {
      const extra = getExtraPayloadRef.current ? getExtraPayloadRef.current() : {};
      let expectedVersion = sessionRef.current?.version;
      if (!Number.isInteger(expectedVersion)) {
        const fresh = await toolSessionApi.get(id);
        sessionRef.current = fresh;
        setSession(fresh);
        expectedVersion = fresh.version;
      }
      const result = await toolSessionApi.update(id, {
        answers: dataRef.current as Record<string, unknown>,
        expectedVersion: expectedVersion as number,
        ...extra,
      });
      sessionRef.current = {
        ...(sessionRef.current || ({ id } as ToolSessionApiRecord)),
        id: result.id,
        status: result.status,
        updatedAt: result.updatedAt,
        version: result.version,
      };
      setSession(sessionRef.current);
      setLastSyncedAt(result.updatedAt);
      setError(null);
      setIsOffline(false);
      setStatus('saved');
      // Successfully synced -- no unsynced work remains, the recovery
      // draft's job is done until the next edit rewrites it.
      clearRecoveryDraft(id);
      clearOnlineListener();
      return 'saved';
    } catch (err) {
      if (isOfflineError(err)) {
        setIsOffline(true);
        setStatus('offline');
        setError('offline');
        if (!onlineListenerRef.current && typeof window !== 'undefined') {
          const retry = () => {
            clearOnlineListener();
            void performSaveRef.current();
          };
          onlineListenerRef.current = retry;
          window.addEventListener('online', retry);
        }
        return 'offline';
      }
      if (isConflictError(err)) {
        setStatus('conflict');
        setError(err instanceof Error ? err.message : 'Save conflict — server state has moved on');
        return 'conflict';
      }
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Save failed');
      return 'error';
    }
  }, [clearOnlineListener, clearSaveTimer]);
  performSaveRef.current = performSave;

  const scheduleSave = useCallback(() => {
    // A live conflict must be resolved via reconcile() before any more
    // autosaves fire -- otherwise every debounce tick would just retry
    // straight into the same 409 and thrash the "conflict" state.
    if (statusRef.current === 'conflict') return;
    clearSaveTimer();
    saveTimerRef.current = setTimeout(() => {
      void performSaveRef.current();
    }, debounceMs);
  }, [clearSaveTimer, debounceMs]);

  const setData = useCallback(
    (updater: TData | ((prev: TData | null) => TData)) => {
      const next =
        typeof updater === 'function'
          ? (updater as (prev: TData | null) => TData)(dataRef.current)
          : updater;
      if (deepEqualJson(next, dataRef.current)) return;
      dataRef.current = next;
      setDataState(next);
      writeRecoveryDraft(toolIdRef.current, {
        baseUpdatedAt: sessionRef.current?.updatedAt ?? null,
        baseVersion: sessionRef.current?.version,
        data: next,
      });
      if (statusRef.current !== 'conflict') setStatus('dirty');
      scheduleSave();
    },
    [scheduleSave]
  );

  const flush = useCallback(async (): Promise<ToolSessionSyncStatus> => {
    if (statusRef.current === 'conflict') return 'conflict';
    clearSaveTimer();
    return performSaveRef.current();
  }, [clearSaveTimer]);

  const load = useCallback(async (): Promise<ToolSessionApiRecord | null> => {
    const id = toolIdRef.current;
    if (!id) return null;
    clearSaveTimer();
    clearOnlineListener();
    setStatus('loading');
    setError(null);
    try {
      const record = await toolSessionApi.get(id);
      sessionRef.current = record;
      setSession(record);
      const loadedData = (record.answers ?? {}) as TData;
      dataRef.current = loadedData;
      setDataState(loadedData);
      setLastSyncedAt(record.updatedAt ?? null);
      setIsOffline(false);
      setStatus('ready');

      const draft = readRecoveryDraft<TData>(id);
      const decision = evaluateRecoveryDraft(draft, {
        updatedAt: record.updatedAt ?? null,
        data: loadedData,
      });
      if (decision === 'discard-stale') {
        clearRecoveryDraft(id);
        setRecoveryAvailable(false);
        pendingRecoveryDraftRef.current = null;
        onRecoveryDiscardedRef.current?.();
      } else if (decision === 'offer-recovery' && draft) {
        pendingRecoveryDraftRef.current = draft.data;
        setRecoveryAvailable(true);
        onRecoveryAvailableRef.current?.(draft.data, draft.savedAt);
      } else {
        setRecoveryAvailable(false);
        pendingRecoveryDraftRef.current = null;
      }
      return record;
    } catch (err) {
      if (isOfflineError(err)) {
        setIsOffline(true);
        setStatus('offline');
        setError('offline');
        return null;
      }
      setStatus('error');
      setError(
        isNotFoundError(err)
          ? 'Tool session not found'
          : err instanceof Error
            ? err.message
            : 'Failed to load session'
      );
      return null;
    }
  }, [clearOnlineListener, clearSaveTimer]);

  const create = useCallback(async (input: CreateToolSessionInput): Promise<string> => {
    const result = await toolSessionApi.create(input);
    return result.id;
  }, []);

  const reconcile = useCallback(async () => {
    clearRecoveryDraft(toolIdRef.current);
    setRecoveryAvailable(false);
    pendingRecoveryDraftRef.current = null;
    await load();
  }, [load]);

  const applyRecoveryDraft = useCallback(() => {
    if (pendingRecoveryDraftRef.current === null) return;
    const draftData = pendingRecoveryDraftRef.current;
    pendingRecoveryDraftRef.current = null;
    setRecoveryAvailable(false);
    // Applying the draft is itself a local edit that must be resynced.
    setData(draftData);
  }, [setData]);

  const discardRecoveryDraft = useCallback(() => {
    clearRecoveryDraft(toolIdRef.current);
    pendingRecoveryDraftRef.current = null;
    setRecoveryAvailable(false);
  }, []);

  // Flush a still-pending (debounced-but-not-yet-fired) autosave on real
  // unmount only — empty deps, mirrors the pattern this hook replaces in
  // ToolDocumentView.tsx (TLS-03).
  useEffect(() => {
    return () => {
      clearOnlineListener();
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
        void performSaveRef.current();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    status,
    session,
    data,
    error,
    isOffline,
    lastSyncedAt,
    recoveryAvailable,
    load,
    create,
    setData,
    flush,
    reconcile,
    applyRecoveryDraft,
    discardRecoveryDraft,
  };
}
