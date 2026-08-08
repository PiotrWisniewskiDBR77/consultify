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

/** #6c — humanize the raw seconds-since-save into "just now" / "2 min ago" / "1h ago" etc. */
function humanizeSecondsAgo(sec: number, isPolish: boolean): string {
  if (sec < 10) return isPolish ? 'przed chwilą' : 'just now';
  if (sec < 60) return isPolish ? `${sec}s temu` : `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return isPolish ? `${min} min temu` : `${min} min ago`;
  const hours = Math.round(min / 60);
  if (hours < 24) return isPolish ? `${hours} godz. temu` : `${hours}h ago`;
  const days = Math.round(hours / 24);
  return isPolish ? `${days} dni temu` : `${days}d ago`;
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
  const humanized = humanizeSecondsAgo(sec, isPolish);
  return isPolish ? `Zapisano ${humanized}` : `Saved ${humanized}`;
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
  // Anti-wipe guard state (shared by every sync path that funnels through
  // flushNow — the workspace runtime capture/flush AND any direct caller). A
  // mind/idea map always carries at least the non-deletable root node, so a
  // 0-node payload is never a legitimate user state (26a2a896ef class bug).
  // `hydratedRef` flips true the first time the server version is primed
  // (primeServerVersion runs at the end of the GET /map hydration); before that
  // the local graph is still the empty bootstrap and MUST NOT be flushed —
  // that empty-before-hydrate POST is exactly the wipe captured in the live
  // repro (baseVersion 63, nodes:[]). `lastKnownNodeCountRef` remembers the
  // largest legitimate node count we have seen so a later 0-node payload is
  // refused even after hydration.
  const hydratedRef = useRef(false);
  const lastKnownNodeCountRef = useRef(0);
  const flushNowRef = useRef<
    ((p?: IdeaMapSyncPayload | null, o?: FlushSyncOpts) => Promise<any>) | null
  >(null);

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
      // Anti-wipe guard (26a2a896ef class). A 0-node payload is only ever
      // legitimate before the map has hydrated for the very first time (a truly
      // brand-new idea that has never been saved) — and even then we have no
      // non-empty baseline to protect, so blocking is harmless. Refuse to POST
      // an empty graph when EITHER (a) hydration has not completed yet (the
      // GET /map result has not primed the version — the local graph is still
      // the empty bootstrap, so this flush would clobber the real server map)
      // or (b) we have previously accepted a non-empty graph. This is the flush
      // path the live repro wiped through (canvas/useIdeaMapSync → syncMyIdeaMap
      // with nodes:[], baseVersion:63) — the scheduleSave guard does not cover
      // it because the workspace runtime captures/flushes here directly.
      const payloadNodeCount = Array.isArray(payload.nodes) ? payload.nodes.length : 0;
      if (payloadNodeCount === 0 && (!hydratedRef.current || lastKnownNodeCountRef.current > 0)) {
        // eslint-disable-next-line no-console
        console.warn(
          `[idea-map-sync] anti-wipe guard: refusing to flush 0 nodes ` +
            `(hydrated=${hydratedRef.current}, last known ${lastKnownNodeCountRef.current}). ` +
            'Likely a pre-hydration flush or hydration/remount defect — map preserved on server.'
        );
        // Drop this poisoned payload so a deferred re-flush from the finally
        // block does not resurrect it; the next legitimate change re-queues.
        if (queuedPayloadRef.current === payload) queuedPayloadRef.current = null;
        return null;
      }
      if (payloadNodeCount > 0) lastKnownNodeCountRef.current = payloadNodeCount;
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
      // CB-05/RV-006 — shared version invariant, not a toast mask.
      // Mind Map and Process Flow share ONE `useWorkspaceGraphRuntime` instance
      // that stays mounted (and `open`) for the whole workspace session,
      // independent of which representation is on screen. Whiteboard and Table
      // each own a SEPARATE `useIdeaMapSync` instance that is only open while
      // their own component is mounted. `globalIdeaVersions` (module-level,
      // above) is the one thing every instance writes to on every successful
      // save/conflict — but each instance's own `serverVersionRef` is a plain
      // ref that does NOT react when a SIBLING instance bumps that map. So the
      // always-mounted shared instance can sit there with a version that is
      // now behind whatever Whiteboard/Table just wrote while the user was on
      // that tab, and its next flush (e.g. triggered by switching back) races
      // a stale baseVersion into a spurious same-tab 409 — the repeated
      // "Change conflict" notifications on plain representation switching.
      // Catching up to the freshest KNOWN version right before every network
      // write closes that gap: it only ever moves the version forward (never
      // regresses it, so it cannot cause a data-loss reorder), and it changes
      // nothing about how a REAL conflict (a different browser tab/user, whose
      // write this tab's `globalIdeaVersions` map never saw) is detected or
      // recovered — that still 409s and still runs the existing self-heal
      // retry / onConflict path below untouched.
      const knownVersion = globalIdeaVersions.get(ideaId);
      if (typeof knownVersion === 'number' && knownVersion > serverVersionRef.current) {
        serverVersionRef.current = knownVersion;
      }
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
          // Fire-and-forget re-flush (draft timers / conflict self-heal already surface
          // failures via syncState); swallow here so a rejected retry (e.g. repeated 409)
          // doesn't escape as an unhandled promise rejection.
          void flushNowRef.current(pending, opts).catch(() => null);
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
          // Swallow here so a rejected background autosave (e.g. a transient
          // server 500, or a read-only render harness blocking the write) never
          // escapes as an unhandled promise rejection — which in Vite dev pops
          // the full-screen error overlay ("Something went very wrong!") and
          // masquerades as a hard crash. The failure is already surfaced to the
          // UI via syncState ('queued'/'conflict'/'offline'); flushNow keeps
          // re-throwing for awaiting callers (flushGraph) that react to it.
          // Mirrors the finally-block re-flush guard below (conflict self-heal).
          void flushNow(null, { reason: opts?.reason || 'draft' }).catch(() => null);
        },
        opts?.immediate ? 0 : idleMs
      );
    },
    [draftMs, flushNow, idleMs, locked, open, persistDraft]
  );

  // DP-3 (T6): `graph_version` — the WS gateway persisted a graph_patch into
  // the canonical row and broadcast the new version to the whole room (author
  // included). Adopt it SILENTLY, refs only: our canvas already carries the
  // corresponding live patch, so the next POST /map/sync must send the fresh
  // baseVersion instead of tripping a spurious 409. No state updates here —
  // this must never re-render, re-hydrate, or remount the canvas (26a2a896ef).
  // Flag OFF ⇒ the server never emits graph_version ⇒ exactly today's behavior.
  useEffect(() => {
    if (!hasWindow()) return;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail) return;
      if (detail.ideaId && detail.ideaId !== ideaId) return;
      const version = Number(detail.version || 0);
      if (!Number.isFinite(version) || version <= serverVersionRef.current) return;
      serverVersionRef.current = version;
      globalIdeaVersions.set(ideaId, version); // L-03
    };
    window.addEventListener('idea-collab-graph-version', handler);
    return () => window.removeEventListener('idea-collab-graph-version', handler);
  }, [ideaId]);

  const primeServerVersion = useCallback(
    (version: number | null | undefined, hydratedNodeCount?: number) => {
      serverVersionRef.current = Math.max(1, Number(version || 1));
      globalIdeaVersions.set(ideaId, serverVersionRef.current); // L-03
      // Hydration has completed (the GET /map result is priming the version).
      // From now on the anti-wipe guard only blocks 0-node payloads that would
      // clobber a non-empty graph; a genuinely empty brand-new map can still be
      // seeded on its first real edit.
      hydratedRef.current = true;
      // Seed the anti-wipe baseline with the just-hydrated server node count so
      // a spurious 0-node flush is refused even before the first user edit has
      // captured a payload (closes the window right after a non-empty hydrate).
      if (typeof hydratedNodeCount === 'number' && hydratedNodeCount > 0) {
        lastKnownNodeCountRef.current = Math.max(lastKnownNodeCountRef.current, hydratedNodeCount);
      }
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
        // M07 reload-race fix (2026-06-24, re-pinned DP-3 T7 2026-07-04): persist the
        // draft SYNCHRONOUSLY first. The keepalive POST below is best-effort and can be
        // dropped under load (or never settle at all); a synchronous localStorage write
        // always survives teardown, so the next mount recovers the latest nodes via
        // resolveIdeaMapHydration even if the POST never lands. Without this, edits made
        // <draftMs before backgrounding/reload were lost — flushNow only calls
        // persistDraft from its own async catch block, which never runs if the request
        // is still in flight when the page unloads.
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
        // M07 reload-race fix (2026-06-24, re-pinned DP-3 T7 2026-07-04): synchronous
        // draft write BEFORE the keepalive POST — see handleVisibilityChange above.
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

  // DP-3 (T7 Part C): expose the freshest in-memory pending payload (updated
  // synchronously on every queueSync — up to draftMs/800ms fresher than the
  // localStorage draft) so a degraded→online reconnect can soft-merge it on
  // top of the canonical GET instead of discarding it outright.
  const getQueuedPayload = useCallback(() => queuedPayloadRef.current, []);

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
    getQueuedPayload,
    currentVersionRef: serverVersionRef,
  };
}
