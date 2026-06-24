import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Api } from '@/services/api';

import type { CanvasToolType } from '../ideaSelectionTypes';

export type IdeaMapSyncState = 'idle' | 'queued' | 'saving' | 'saved' | 'offline' | 'conflict';

export interface IdeaMapSyncPayload {
  nodes: any[];
  edges: any[];
  preferredTool?: CanvasToolType;
  extensions?: Record<string, unknown>;
  fromAI?: boolean;
}

export interface IdeaMapDraftRecord {
  tool: CanvasToolType;
  payload: IdeaMapSyncPayload;
  baseVersion: number;
  pending: boolean;
  updatedAt: number;
  lastSavedAt: number | null;
}

export interface IdeaMapHydrationPayload {
  nodes: any[];
  edges: any[];
  preferredTool?: string | null;
  extensions?: Record<string, unknown>;
  version?: number;
}

interface UseIdeaMapSyncOpts {
  ideaId: string;
  tool: CanvasToolType;
  open: boolean;
  locked?: boolean;
  idleMs?: number;
  draftMs?: number;
  onConflict?: (serverVersion: number, serverMap?: IdeaMapHydrationPayload | null) => void;
}

interface QueueSyncOpts {
  immediate?: boolean;
  localOnly?: boolean;
  reason?: 'draft' | 'manual' | 'semantic' | 'ai';
}

interface FlushSyncOpts {
  reason?: 'draft' | 'manual' | 'semantic' | 'ai';
  createSnapshot?: boolean;
  snapshotLabel?: string;
  /** M06 L-05: send with fetch keepalive so the flush survives page teardown. */
  keepalive?: boolean;
}

// Autosave debounce: flush to the server this long after the user stops editing.
// Was 60_000 (60s) — far too long: any idea-canvas edit (add node, move, label,
// lane…) was lost on reload/navigation within a minute because the server sync
// never fired (the beforeunload keepalive is an unreliable backup). 2.5s gives
// snappy autosave while still batching bursts (the timer resets on each edit, so
// it only fires once editing pauses). Shared by M06/M07/M08/M09 idea tools.
const DEFAULT_IDLE_MS = 2_500;
const DEFAULT_DRAFT_MS = 800;

function getDraftStorageKey(ideaId: string) {
  return `consultify.idea-map-sync.${ideaId}`;
}

function hasWindow() {
  return typeof window !== 'undefined';
}

function scheduleIdleTask(cb: () => void): number {
  if (!hasWindow()) return 0;
  const w = window as Window & {
    requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
  };
  if (typeof w.requestIdleCallback === 'function') {
    return w.requestIdleCallback(cb, { timeout: 1200 });
  }
  return window.setTimeout(cb, 16);
}

function cancelIdleTask(handle: number | null) {
  if (!hasWindow() || handle == null) return;
  const w = window as Window & {
    cancelIdleCallback?: (id: number) => void;
  };
  if (typeof w.cancelIdleCallback === 'function') {
    w.cancelIdleCallback(handle);
    return;
  }
  window.clearTimeout(handle);
}

export function readIdeaMapDraft(ideaId: string): IdeaMapDraftRecord | null {
  if (!hasWindow()) return null;
  try {
    const raw = window.localStorage.getItem(getDraftStorageKey(ideaId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as IdeaMapDraftRecord;
    if (!parsed || typeof parsed !== 'object') return null;
    if (
      !parsed.payload ||
      !Array.isArray(parsed.payload.nodes) ||
      !Array.isArray(parsed.payload.edges)
    ) {
      return null;
    }
    return {
      tool: parsed.tool,
      payload: parsed.payload,
      baseVersion: Number(parsed.baseVersion || 1),
      pending: parsed.pending === true,
      updatedAt: Number(parsed.updatedAt || 0),
      lastSavedAt: parsed.lastSavedAt == null ? null : Number(parsed.lastSavedAt),
    };
  } catch {
    return null;
  }
}

export function writeIdeaMapDraft(ideaId: string, draft: IdeaMapDraftRecord) {
  if (!hasWindow()) return;
  try {
    window.localStorage.setItem(getDraftStorageKey(ideaId), JSON.stringify(draft));
  } catch {
    /* ignore quota / privacy failures */
  }
}

export function clearIdeaMapDraft(ideaId: string) {
  if (!hasWindow()) return;
  try {
    window.localStorage.removeItem(getDraftStorageKey(ideaId));
  } catch {
    /* ignore */
  }
}

export function resolveIdeaMapHydration(
  ideaId: string,
  serverMap: IdeaMapHydrationPayload
): { map: IdeaMapHydrationPayload; draft: IdeaMapDraftRecord | null; usedDraft: boolean } {
  const draft = readIdeaMapDraft(ideaId);
  if (
    draft?.pending &&
    Array.isArray(draft.payload.nodes) &&
    Array.isArray(draft.payload.edges) &&
    draft.updatedAt > 0
  ) {
    const serverVersion = Math.max(1, Number(serverMap.version || 1));
    const draftBaseVersion = Math.max(1, Number(draft.baseVersion || 1));
    if (draftBaseVersion < serverVersion) {
      clearIdeaMapDraft(ideaId);
      return { map: serverMap, draft: null, usedDraft: false };
    }
    const serverNodeCount = Array.isArray(serverMap.nodes) ? serverMap.nodes.length : 0;
    const draftNodeCount = draft.payload.nodes.length;
    if (draftNodeCount === 0 && serverNodeCount > 0) {
      clearIdeaMapDraft(ideaId);
      return { map: serverMap, draft: null, usedDraft: false };
    }
    return {
      map: {
        ...serverMap,
        nodes: draft.payload.nodes,
        edges: draft.payload.edges,
        preferredTool: draft.payload.preferredTool ?? serverMap.preferredTool ?? null,
        extensions: draft.payload.extensions ?? serverMap.extensions ?? {},
        version: serverMap.version,
      },
      draft,
      usedDraft: true,
    };
  }
  return { map: serverMap, draft, usedDraft: false };
}

export function formatIdeaMapSyncLabel(
  state: IdeaMapSyncState,
  lastSavedAt: number | null,
  isPolish: boolean
) {
  if (state === 'conflict') {
    return isPolish ? 'Konflikt zmian' : 'Change conflict';
  }
  if (state === 'offline') {
    return isPolish ? 'Offline - zapis w kolejce' : 'Offline - queued locally';
  }
  if (state === 'queued') {
    return isPolish ? 'Zmiany w kolejce' : 'Changes queued';
  }
  if (state === 'saving') {
    return isPolish ? 'Zapisuję…' : 'Saving…';
  }
  if (!lastSavedAt) {
    return isPolish ? 'Draft lokalny' : 'Local draft';
  }
  const sec = Math.max(1, Math.round((Date.now() - lastSavedAt) / 1000));
  return isPolish ? `Zapisano ${sec}s temu` : `Saved ${sec}s ago`;
}

// L-03: module-level version registry — shared across all tool instances for the same ideaId
// so switching from Table→Whiteboard starts from the current server version, not v=1.
const globalIdeaVersions = new Map<string, number>();

export function useIdeaMapSync({
  ideaId,
  tool,
  open,
  locked = false,
  idleMs = DEFAULT_IDLE_MS,
  draftMs = DEFAULT_DRAFT_MS,
  onConflict,
}: UseIdeaMapSyncOpts) {
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAtState] = useState<number | null>(null);
  const [syncState, setSyncState] = useState<IdeaMapSyncState>('idle');

  // lastSavedAt is also mirrored to a ref so persistDraft/flushNow/queueSync can
  // read it WITHOUT depending on the state value. Depending on the state caused
  // those callbacks to be recreated on every save, which re-fired the autosave
  // effect → an endless re-save loop (a save storm once the idle debounce was
  // shortened from 60s). Always set both via setLastSavedAt(). (M07 fix 2026-06-20)
  const lastSavedAtRef = useRef<number | null>(null);
  const setLastSavedAt = useCallback((value: number | null) => {
    lastSavedAtRef.current = value;
    setLastSavedAtState(value);
  }, []);

  const serverVersionRef = useRef(globalIdeaVersions.get(ideaId) ?? 1);
  const queuedPayloadRef = useRef<IdeaMapSyncPayload | null>(null);
  const draftTimerRef = useRef<number | null>(null);
  const syncTimerRef = useRef<number | null>(null);
  const idleWriteRef = useRef<number | null>(null);
  // Serialize POST /map/sync. When the first flush is slow (staging DB latency), the next
  // autosave fires WHILE it is in flight — both read the same baseVersion, so the first wins
  // (200, version++) and the second is stale → 409, dropping its payload (the user's latest
  // nodes) → data loss after reload (M07 §3/§6, 2026-06-21). An in-flight guard defers the
  // overlapping flush; it re-runs from the finally block once the current flush bumps the
  // version, so the deferred (newest) payload saves cleanly instead of racing.
  const inFlightRef = useRef(false);
  const conflictRetryRef = useRef(0);
  const flushNowRef = useRef<((p?: IdeaMapSyncPayload | null, o?: FlushSyncOpts) => Promise<any>) | null>(
    null
  );

  const persistDraft = useCallback(
    (payload: IdeaMapSyncPayload, pending: boolean) => {
      const nextRecord: IdeaMapDraftRecord = {
        tool,
        payload,
        baseVersion: serverVersionRef.current,
        pending,
        updatedAt: Date.now(),
        lastSavedAt: pending ? lastSavedAtRef.current : Date.now(),
      };
      writeIdeaMapDraft(ideaId, nextRecord);
    },
    [ideaId, tool]
  );

  const flushNow = useCallback(
    async (payloadOverride?: IdeaMapSyncPayload | null, opts?: FlushSyncOpts) => {
      if (!open || locked) return null;
      const payload = payloadOverride || queuedPayloadRef.current;
      if (!payload) return null;
      // A sync is already in flight — defer this one. It re-runs from the finally block once the
      // current flush resolves (and bumps serverVersionRef), so it saves with the correct
      // baseVersion instead of racing into a 409 that would drop its payload.
      if (inFlightRef.current) {
        queuedPayloadRef.current = payload;
        return null;
      }
      if (syncTimerRef.current) {
        window.clearTimeout(syncTimerRef.current);
        syncTimerRef.current = null;
      }
      inFlightRef.current = true;
      setSaving(true);
      setSyncState('saving');
      try {
        const response = await Api.syncMyIdeaMap(ideaId, {
          ...payload,
          baseVersion: serverVersionRef.current,
          reason: opts?.reason || 'draft',
          ...(opts?.keepalive ? { keepalive: true } : {}),
        });
        const nextVersion = Number(response?.version || serverVersionRef.current || 1);
        serverVersionRef.current = nextVersion;
        globalIdeaVersions.set(ideaId, nextVersion); // L-03
        // Only clear the queue if no NEWER payload was enqueued while this fetch was in-flight.
        // If call-2 stored P2 in queuedPayloadRef during the await, we must NOT wipe it here —
        // the finally block needs to see P2 and flush it. Clearing unconditionally was the root
        // cause of the M07 §3 data-loss bug (2026-06-21): P2 set by the deferred caller was
        // silently overwritten by the in-flight caller's success path before finally ran.
        if (queuedPayloadRef.current === payload) {
          queuedPayloadRef.current = null;
        }
        conflictRetryRef.current = 0;
        setLastSavedAt(Date.now());
        setSyncState('saved');
        persistDraft(payload, false);
        if (opts?.createSnapshot) {
          await Api.createMyIdeaMapSnapshot(ideaId, {
            label: opts.snapshotLabel || `${tool} checkpoint`,
            nodes: payload.nodes,
            edges: payload.edges,
          }).catch(() => null);
        }
        return response;
      } catch (err: any) {
        if (err?.status === 409) {
          const serverVersion = Number(err?.data?.currentVersion || serverVersionRef.current || 1);
          serverVersionRef.current = serverVersion;
          globalIdeaVersions.set(ideaId, serverVersion); // L-03
          setSyncState('conflict');
          onConflict?.(serverVersion, err?.data?.map || null);
          // Self-heal: re-flush this payload once (bounded) with the now-corrected baseVersion,
          // so a lost-race 409 no longer drops the user's nodes permanently.
          if (conflictRetryRef.current < 2) {
            conflictRetryRef.current += 1;
            queuedPayloadRef.current = payload;
          } else {
            queuedPayloadRef.current = null;
          }
        } else if (typeof navigator !== 'undefined' && navigator.onLine === false) {
          setSyncState('offline');
        } else {
          setSyncState('queued');
        }
        persistDraft(payload, true);
        throw err;
      } finally {
        setSaving(false);
        inFlightRef.current = false;
        // Flush a deferred / conflict-retry payload now that the version is corrected and the
        // channel is free. Cleared first to avoid re-entrancy on the same payload.
        const pending = queuedPayloadRef.current;
        if (pending && flushNowRef.current) {
          queuedPayloadRef.current = null;
          void flushNowRef.current(pending, opts);
        }
      }
    },
    [ideaId, locked, onConflict, open, persistDraft, tool]
  );
  flushNowRef.current = flushNow;

  const queueSync = useCallback(
    (payload: IdeaMapSyncPayload, opts?: QueueSyncOpts) => {
      if (!open || locked) return;
      queuedPayloadRef.current = payload;
      setSyncState((prev) => (prev === 'conflict' ? prev : 'queued'));

      if (draftTimerRef.current) {
        window.clearTimeout(draftTimerRef.current);
      }
      if (idleWriteRef.current) {
        cancelIdleTask(idleWriteRef.current);
      }
      draftTimerRef.current = window.setTimeout(() => {
        idleWriteRef.current = scheduleIdleTask(() => {
          persistDraft(payload, true);
          idleWriteRef.current = null;
        });
      }, draftMs);

      if (opts?.localOnly) return;
      if (syncTimerRef.current) {
        window.clearTimeout(syncTimerRef.current);
      }
      syncTimerRef.current = window.setTimeout(
        () => {
          void flushNow(null, { reason: opts?.reason || 'draft' });
        },
        opts?.immediate ? 0 : idleMs
      );
    },
    [draftMs, flushNow, idleMs, locked, open, persistDraft]
  );

  const primeServerVersion = useCallback(
    (version: number | null | undefined) => {
      serverVersionRef.current = Math.max(1, Number(version || 1));
      globalIdeaVersions.set(ideaId, serverVersionRef.current); // L-03
      const draft = readIdeaMapDraft(ideaId);
      if (draft?.pending) {
        queuedPayloadRef.current = draft.payload;
        setSyncState('queued');
      } else {
        setSyncState('idle');
        if (draft?.lastSavedAt) {
          setLastSavedAt(draft.lastSavedAt);
        }
      }
    },
    [ideaId]
  );

  const clearLocalDraft = useCallback(() => {
    queuedPayloadRef.current = null;
    clearIdeaMapDraft(ideaId);
  }, [ideaId]);

  useEffect(() => {
    if (!open) return;
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && queuedPayloadRef.current) {
        // M07 reload-race fix (2026-06-24): persist the draft SYNCHRONOUSLY first.
        // The keepalive POST below is best-effort and can be dropped under load; a
        // synchronous localStorage write always survives teardown, so the next mount
        // recovers the latest nodes via resolveIdeaMapHydration even if the POST never
        // lands. Without this, edits made <draftMs before backgrounding were lost.
        persistDraft(queuedPayloadRef.current, true);
        // M06 L-05: page may be backgrounded/closed — keepalive so the flush lands.
        void flushNow(null, { reason: 'draft', keepalive: true }).catch(() => null);
      }
    };
    const handleOnline = () => {
      if (queuedPayloadRef.current) {
        void flushNow(null, { reason: 'draft' }).catch(() => null);
      }
    };
    const handleBeforeUnload = () => {
      if (queuedPayloadRef.current) {
        // M07 reload-race fix (2026-06-24): synchronous draft write BEFORE the keepalive
        // POST. On a hard reload (F5) the React unmount cleanup does NOT run, and the
        // keepalive flush can be dropped under load — so without this the user's most
        // recent nodes (added <draftMs before reload) were gone after the reload. The
        // localStorage write is synchronous and completes before navigation; the next
        // mount recovers them via resolveIdeaMapHydration.
        persistDraft(queuedPayloadRef.current, true);
        // M06 L-05: document is unloading — a plain fetch would be cancelled; keepalive survives.
        void flushNow(null, { reason: 'draft', keepalive: true }).catch(() => null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (queuedPayloadRef.current) {
          void flushNow(null, { reason: 'manual' }).catch(() => null);
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', handleOnline);
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [flushNow, open, persistDraft]);

  useEffect(() => {
    return () => {
      if (draftTimerRef.current) window.clearTimeout(draftTimerRef.current);
      if (syncTimerRef.current) window.clearTimeout(syncTimerRef.current);
      if (idleWriteRef.current) cancelIdleTask(idleWriteRef.current);
      // L-04: persist queued changes to localStorage on unmount so next mount recovers them.
      // ideaId/tool are stable for the hook's lifetime; refs always hold current values.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      const payload = queuedPayloadRef.current;
      if (payload) {
        writeIdeaMapDraft(ideaId, {
          tool,
          payload,
          baseVersion: serverVersionRef.current,
          pending: true,
          updatedAt: Date.now(),
          lastSavedAt: null,
        });
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const syncLabel = useMemo(
    () => formatIdeaMapSyncLabel(syncState, lastSavedAt, false),
    [lastSavedAt, syncState]
  );

  return {
    saving,
    lastSavedAt,
    setLastSavedAt,
    setSaving,
    syncState,
    syncLabel,
    queueSync,
    flushNow,
    primeServerVersion,
    clearLocalDraft,
    currentVersionRef: serverVersionRef,
  };
}
