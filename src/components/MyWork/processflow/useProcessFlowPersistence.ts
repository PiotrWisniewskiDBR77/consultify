/**
 * useProcessFlowPersistence — dual-mode persistence adapter for Process Flow.
 *
 * ## Graph ownership model (PF-01)
 *
 * The single canonical runtime owner of the process-flow graph is the ReactFlow
 * local state (`nodes`, `edges`, `lanes`, `extensions`) held inside
 * `IdeaProcessFlowTool`. This adapter does NOT own the graph — it only persists
 * a payload the host builds (`buildPersistPayload()`).
 *
 * ## Dual mode (PF-02 — M07 F4 unification, mirrors useMindMapPersistence)
 *
 * - `externalRuntime` supplied  → delegate ALL persistence to the shared
 *   workspace graph runtime (`useWorkspaceGraphRuntime`). One runtime per
 *   `ideaId` across Mind Map / Table / Process Flow — no split-brain.
 *     scheduleSave(payload) → externalRuntime.captureGraph(...)   (reason 'draft')
 *     save()                → externalRuntime.flushGraph(...)     (reason 'manual', snapshot)
 *     refresh()             → externalRuntime.refresh()
 *   `saving/syncState/lastSavedAt` mirror the runtime.
 *
 * - `externalRuntime` absent → fallback to the legacy per-tool `useIdeaMapSync`
 *   (queueSync / flushNow / primeServerVersion). Kept alive because the
 *   fallback path and other tools (whiteboard) still use the hook.
 *
 * ## Conflict re-hydration (PF-03)
 *
 * In runtime mode, when the shared runtime enters `syncState === 'conflict'`,
 * the adapter triggers `externalRuntime.refresh()` once (the workspace-level
 * onConflict handler shows the toast; the refresh pulls the server version into
 * the shared graph, which flows back into the tool via `onGraphChange` mirror /
 * hydrate). It also asks the host to re-hydrate when the runtime version JUMPS
 * by more than 1 (an external peer change) — NOT on the normal +1 that our own
 * save produces (that would reset the canvas).
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  type IdeaMapSyncState,
  useIdeaMapSync,
} from '@/components/MyWork/canvas/useIdeaMapSync';
import type { Edge, Node } from 'reactflow';

/**
 * Payload the host (`IdeaProcessFlowTool.buildPersistPayload`) produces. Kept
 * loose on purpose — the adapter forwards it as-is to the sync layer / runtime.
 */
export interface ProcessFlowPersistPayload {
  nodes: Node[] | any[];
  edges: Edge[] | any[];
  preferredTool?: string;
  extensions?: Record<string, unknown>;
}

/**
 * External runtime contract — duplicated inline (per F4 dec: do NOT export a new
 * type from workspaceGraphRuntime.ts to avoid touching the shared file). This is
 * the exact block `IdeaMapWorkspace` builds from `graphRuntime.*` for Mind Map.
 */
export interface ProcessFlowExternalRuntime {
  version: number;
  loading: boolean;
  saving: boolean;
  lastSavedAt: number | null;
  syncState: IdeaMapSyncState;
  nodes: Node[];
  edges: Edge[];
  extensions: Record<string, unknown>;
  captureGraph: (
    graph: { nodes: Node[]; edges: Edge[]; extensions?: Record<string, unknown> },
    opts?: { reason?: 'draft' | 'manual' | 'semantic' | 'ai'; immediate?: boolean }
  ) => void;
  flushGraph: (opts?: {
    reason?: 'draft' | 'manual' | 'semantic' | 'ai';
    createSnapshot?: boolean;
    snapshotLabel?: string;
  }) => Promise<unknown>;
  refresh: () => Promise<void>;
}

export interface UseProcessFlowPersistenceOpts {
  ideaId: string;
  open: boolean;
  locked: boolean;
  externalRuntime?: ProcessFlowExternalRuntime;
  /** Called when an EXTERNAL runtime change (peer save / conflict) needs the
   *  host to re-hydrate its local ReactFlow state. Never called for our own
   *  +1 version bump. */
  onExternalChange?: () => void;
}

export interface UseProcessFlowPersistenceReturn {
  saving: boolean;
  syncState: IdeaMapSyncState;
  lastSavedAt: number | null;
  /** Ctrl+S / explicit save — flush + snapshot. */
  save: (
    payload: ProcessFlowPersistPayload,
    opts?: { reason?: 'manual'; createSnapshot?: boolean; snapshotLabel?: string }
  ) => Promise<unknown>;
  /** Autosave path (draft). Debounced/deduped downstream. */
  scheduleSave: (payload: ProcessFlowPersistPayload, opts?: { reason?: 'draft' }) => void;
  /** Prime the fallback sync layer with the server version after hydrate.
   *  No-op in runtime mode (the shared runtime owns the version). */
  primeServerVersion: (version: number) => void;
  refresh: () => Promise<void>;
}

export function useProcessFlowPersistence(
  opts: UseProcessFlowPersistenceOpts
): UseProcessFlowPersistenceReturn {
  const { ideaId, open, locked, externalRuntime, onExternalChange } = opts;

  // Fallback sync layer — always instantiated (hooks can't be conditional).
  // Ignored when externalRuntime is present.
  const fallback = useIdeaMapSync({
    ideaId,
    tool: 'process_flow',
    open,
    locked,
  });

  const runtimeVersion = externalRuntime?.version ?? null;
  const runtimeSaving = externalRuntime?.saving ?? false;
  const runtimeLastSavedAt = externalRuntime?.lastSavedAt ?? null;
  const runtimeSyncState = externalRuntime?.syncState ?? null;

  // Mirror runtime status into local state so consumers re-render on change.
  const [runtimeStatus, setRuntimeStatus] = useState<{
    saving: boolean;
    lastSavedAt: number | null;
    syncState: IdeaMapSyncState;
  }>({ saving: false, lastSavedAt: null, syncState: 'idle' });

  const prevSyncStateRef = useRef<IdeaMapSyncState | null>(null);
  const lastSeenRuntimeVersionRef = useRef<number | null>(null);
  // Keep a stable ref to the runtime so effects don't re-fire on every save
  // cycle (the runtime object identity changes as its graph state updates).
  const externalRuntimeRef = useRef(externalRuntime);
  externalRuntimeRef.current = externalRuntime;
  const onExternalChangeRef = useRef(onExternalChange);
  onExternalChangeRef.current = onExternalChange;

  useEffect(() => {
    if (runtimeVersion === null) return;
    setRuntimeStatus({
      saving: runtimeSaving,
      lastSavedAt: runtimeLastSavedAt,
      syncState: (runtimeSyncState ?? 'idle') as IdeaMapSyncState,
    });

    // PF-03: on conflict, pull the latest server version into the shared graph.
    if (runtimeSyncState === 'conflict' && prevSyncStateRef.current !== 'conflict') {
      externalRuntimeRef.current?.refresh?.();
    }
    prevSyncStateRef.current = runtimeSyncState;
  }, [runtimeLastSavedAt, runtimeSaving, runtimeSyncState, runtimeVersion]);

  // PF-03: ask the host to re-hydrate only when the runtime version jumps by
  // more than 1 (external peer change / conflict resolution). A +1 bump is the
  // normal result of our own scheduleSave — re-hydrating on that would reset the
  // canvas viewport / selection.
  useEffect(() => {
    if (runtimeVersion === null) return;
    const prev = lastSeenRuntimeVersionRef.current;
    if (prev === runtimeVersion) return;
    // First observation (prev === null) is just the initial hydrate — the host
    // already hydrates from the runtime on mount, so don't double-fire.
    if (prev !== null && runtimeVersion > prev + 1) {
      onExternalChangeRef.current?.();
    }
    lastSeenRuntimeVersionRef.current = runtimeVersion;
  }, [runtimeVersion]);

  const scheduleSave = useCallback(
    (payload: ProcessFlowPersistPayload, saveOpts?: { reason?: 'draft' }) => {
      if (locked) return;
      const runtime = externalRuntimeRef.current;
      if (runtime) {
        runtime.captureGraph(
          {
            nodes: payload.nodes as Node[],
            edges: payload.edges as Edge[],
            extensions: payload.extensions,
          },
          { reason: saveOpts?.reason || 'draft' }
        );
        return;
      }
      fallback.queueSync(payload as any, { reason: saveOpts?.reason || 'draft' });
    },
    [fallback, locked]
  );

  const save = useCallback(
    async (
      payload: ProcessFlowPersistPayload,
      saveOpts?: { reason?: 'manual'; createSnapshot?: boolean; snapshotLabel?: string }
    ) => {
      const runtime = externalRuntimeRef.current;
      if (runtime) {
        // The runtime persists whatever is in its shared graph. The host has
        // already pushed the current graph via scheduleSave→captureGraph (the
        // autosave effect fires before Ctrl+S resolves), but push once more to
        // guarantee the latest state is captured before the flush snapshot.
        runtime.captureGraph(
          {
            nodes: payload.nodes as Node[],
            edges: payload.edges as Edge[],
            extensions: payload.extensions,
          },
          { reason: 'draft' }
        );
        return runtime.flushGraph({
          reason: saveOpts?.reason || 'manual',
          createSnapshot: saveOpts?.createSnapshot ?? true,
          snapshotLabel: saveOpts?.snapshotLabel,
        });
      }
      return fallback.flushNow(payload as any, {
        reason: saveOpts?.reason || 'manual',
        createSnapshot: saveOpts?.createSnapshot ?? true,
        snapshotLabel: saveOpts?.snapshotLabel,
      });
    },
    [fallback]
  );

  const primeServerVersion = useCallback(
    (version: number) => {
      // Runtime mode: the shared runtime owns the version — no-op.
      if (externalRuntimeRef.current) return;
      fallback.primeServerVersion(version);
    },
    [fallback]
  );

  const refresh = useCallback(async () => {
    const runtime = externalRuntimeRef.current;
    if (runtime) {
      await runtime.refresh();
    }
  }, []);

  if (externalRuntime) {
    return {
      saving: runtimeStatus.saving,
      syncState: runtimeStatus.syncState,
      lastSavedAt: runtimeStatus.lastSavedAt,
      save,
      scheduleSave,
      primeServerVersion,
      refresh,
    };
  }

  return {
    saving: fallback.saving,
    syncState: fallback.syncState,
    lastSavedAt: fallback.lastSavedAt,
    save,
    scheduleSave,
    primeServerVersion,
    refresh,
  };
}
