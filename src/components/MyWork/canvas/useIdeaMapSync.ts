import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Api } from '@/services/api';

import type { CanvasToolType } from '../ideaSelectionTypes';

export type IdeaMapSyncState =
  | 'idle'
  | 'queued'
  | 'saving'
  | 'saved'
  | 'offline'
  | 'conflict';

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
}

const DEFAULT_IDLE_MS = 60_000;
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
    if (!parsed.payload || !Array.isArray(parsed.payload.nodes) || !Array.isArray(parsed.payload.edges)) {
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
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [syncState, setSyncState] = useState<IdeaMapSyncState>('idle');

  const serverVersionRef = useRef(1);
  const queuedPayloadRef = useRef<IdeaMapSyncPayload | null>(null);
  const draftTimerRef = useRef<number | null>(null);
  const syncTimerRef = useRef<number | null>(null);
  const idleWriteRef = useRef<number | null>(null);

  const persistDraft = useCallback(
    (payload: IdeaMapSyncPayload, pending: boolean) => {
      const nextRecord: IdeaMapDraftRecord = {
        tool,
        payload,
        baseVersion: serverVersionRef.current,
        pending,
        updatedAt: Date.now(),
        lastSavedAt: pending ? lastSavedAt : Date.now(),
      };
      writeIdeaMapDraft(ideaId, nextRecord);
    },
    [ideaId, lastSavedAt, tool]
  );

  const flushNow = useCallback(
    async (payloadOverride?: IdeaMapSyncPayload | null, opts?: FlushSyncOpts) => {
      if (!open || locked) return null;
      const payload = payloadOverride || queuedPayloadRef.current;
      if (!payload) return null;
      if (syncTimerRef.current) {
        window.clearTimeout(syncTimerRef.current);
        syncTimerRef.current = null;
      }
      setSaving(true);
      setSyncState('saving');
      try {
        const response = await Api.syncMyIdeaMap(ideaId, {
          ...payload,
          baseVersion: serverVersionRef.current,
          reason: opts?.reason || 'draft',
        });
        const nextVersion = Number(response?.version || serverVersionRef.current || 1);
        serverVersionRef.current = nextVersion;
        queuedPayloadRef.current = null;
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
          setSyncState('conflict');
          onConflict?.(serverVersion, err?.data?.map || null);
        } else if (typeof navigator !== 'undefined' && navigator.onLine === false) {
          setSyncState('offline');
        } else {
          setSyncState('queued');
        }
        persistDraft(payload, true);
        throw err;
      } finally {
        setSaving(false);
      }
    },
    [ideaId, locked, onConflict, open, persistDraft, tool]
  );

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
      syncTimerRef.current = window.setTimeout(() => {
        void flushNow(null, { reason: opts?.reason || 'draft' });
      }, opts?.immediate ? 0 : idleMs);
    },
    [draftMs, flushNow, idleMs, locked, open, persistDraft]
  );

  const primeServerVersion = useCallback(
    (version: number | null | undefined) => {
      serverVersionRef.current = Math.max(1, Number(version || 1));
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
        void flushNow(null, { reason: 'draft' }).catch(() => null);
      }
    };
    const handleOnline = () => {
      if (queuedPayloadRef.current) {
        void flushNow(null, { reason: 'draft' }).catch(() => null);
      }
    };
    const handleBeforeUnload = () => {
      if (queuedPayloadRef.current) {
        void flushNow(null, { reason: 'draft' }).catch(() => null);
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
  }, [flushNow, open]);

  useEffect(() => {
    return () => {
      if (draftTimerRef.current) window.clearTimeout(draftTimerRef.current);
      if (syncTimerRef.current) window.clearTimeout(syncTimerRef.current);
      if (idleWriteRef.current) cancelIdleTask(idleWriteRef.current);
    };
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
