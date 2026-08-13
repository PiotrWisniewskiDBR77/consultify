import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Edge, Node } from 'reactflow';

import { Api } from '@/services/api';

import type { CanvasToolType } from '../ideaSelectionTypes';
import {
  formatIdeaMapSyncLabel,
  type IdeaMapHydrationPayload,
  type IdeaMapSyncPayload,
  type IdeaMapSyncState,
  resolveIdeaMapHydration,
  useIdeaMapSync,
} from './useIdeaMapSync';

export interface WorkspaceGraphState {
  nodes: Node[];
  edges: Edge[];
  extensions: Record<string, unknown>;
  version: number;
}

interface WorkspaceGraphRuntimeOptions {
  ideaId: string;
  open: boolean;
  locked?: boolean;
  preferredTool: CanvasToolType;
  language: string;
  initialViewport?: { x: number; y: number; zoom: number } | null;
  onConflict?: (serverVersion: number, serverMap?: IdeaMapHydrationPayload | null) => void;
}

interface QueueGraphSyncOptions {
  reason?: 'draft' | 'manual' | 'semantic' | 'ai';
  immediate?: boolean;
  createSnapshot?: boolean;
  snapshotLabel?: string;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Recursively deep-merges extension objects so that no tool-specific key
 * clobbers another tool's nested state.  Arrays are treated as atomic values
 * (replaced, not concatenated) to keep collapse-id lists and replay logs
 * deterministic.
 */
export function mergeWorkspaceExtensions(
  existing: Record<string, unknown>,
  patch?: Record<string, unknown> | null
): Record<string, unknown> {
  if (!patch) return existing;
  const next: Record<string, unknown> = { ...existing };
  for (const [key, value] of Object.entries(patch)) {
    if (!Object.prototype.hasOwnProperty.call(patch, key)) continue;
    if (value === undefined) continue;
    if (isPlainObject(existing[key]) && isPlainObject(value)) {
      next[key] = mergeWorkspaceExtensions(
        existing[key] as Record<string, unknown>,
        value as Record<string, unknown>
      );
      continue;
    }
    next[key] = value as unknown;
  }
  return next;
}

function sanitizeNodes(nodes: Node[]) {
  return nodes.map((node: any) => {
    const data = isPlainObject(node?.data)
      ? { ...(node.data as Record<string, unknown>) }
      : undefined;
    if (data) {
      delete data._interactionMode;
      delete data._canAddSibling;
    }
    return data ? { ...node, data } : node;
  });
}

function stableSerialize(value: unknown): string {
  try {
    return JSON.stringify(value ?? null);
  } catch {
    return '';
  }
}

function buildComparableGraph(state: Pick<WorkspaceGraphState, 'nodes' | 'edges' | 'extensions'>): {
  nodes: Node[];
  edges: Edge[];
  extensions: Record<string, unknown>;
} {
  return {
    nodes: sanitizeNodes(state.nodes || []),
    edges: state.edges || [],
    extensions: state.extensions || {},
  };
}

export function useWorkspaceGraphRuntime({
  ideaId,
  open,
  locked = false,
  preferredTool,
  language,
  initialViewport = null,
  onConflict,
}: WorkspaceGraphRuntimeOptions) {
  const [graph, setGraph] = useState<WorkspaceGraphState>({
    nodes: [],
    edges: [],
    extensions: {},
    version: 1,
  });
  const [loading, setLoading] = useState(true);
  // D2: GET /map failures used to vanish silently — `refresh()` had no catch,
  // so `loading` still flipped to false (via `finally`) but nothing recorded
  // that the fetch actually failed. Callers then read the untouched initial
  // empty graph as "brand new idea, nothing saved yet" and rendered/persisted
  // a starter template over it. `loadError` lets consumers tell "empty
  // because new" apart from "empty because the load blew up" and show a real
  // error + retry instead.
  const [loadError, setLoadError] = useState<string | null>(null);
  const [viewport, setViewport] = useState<{ x: number; y: number; zoom: number } | null>(
    initialViewport
  );
  const graphRef = useRef(graph);
  const viewportRef = useRef(viewport);

  useEffect(() => {
    graphRef.current = graph;
  }, [graph]);

  useEffect(() => {
    viewportRef.current = viewport;
  }, [viewport]);

  const {
    saving,
    lastSavedAt,
    syncState,
    queueSync,
    flushNow,
    primeServerVersion,
    getQueuedPayload,
    currentVersionRef,
  } = useIdeaMapSync({
    ideaId,
    tool: preferredTool,
    open,
    locked,
    onConflict,
  });

  const buildPayload = useCallback(
    (state: WorkspaceGraphState, extensionPatch?: Record<string, unknown>): IdeaMapSyncPayload => {
      const surfaceState = {
        activeTool: preferredTool,
        ...(viewportRef.current ? { viewport: viewportRef.current } : {}),
      };
      const extensions = mergeWorkspaceExtensions(state.extensions || {}, {
        ...extensionPatch,
        surfaceState,
      });
      return {
        nodes: sanitizeNodes(state.nodes),
        edges: state.edges,
        preferredTool,
        extensions,
      };
    },
    [preferredTool]
  );

  // Guard against re-entrant refreshes. The load effect re-runs whenever `refresh`'s identity
  // changes; if the GET /map response is slow (or the connection pool is saturated) a new
  // refresh could fire before the previous one resolves, piling up hundreds of pending
  // requests and wedging the board on "Loading" forever. One fetch in flight at a time.
  const refreshInFlightRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!open || !ideaId) return;
    if (refreshInFlightRef.current) return;
    refreshInFlightRef.current = true;
    setLoading(true);
    try {
      const res = await Api.getMyIdeaMap(ideaId, { language });
      setLoadError(null);
      const serverMap = res?.map || {};
      const serverVersion = Math.max(1, Number(serverMap.version || 1));
      // eslint-disable-next-line no-console
      // DP-3 (T7 Part C): degraded→online soft-merge. A hard reconnect
      // (WS conflict, or a manual refresh after a version rejection) used to
      // unconditionally overwrite local state with the canonical GET,
      // silently dropping any edit that hadn't round-tripped through
      // POST /map/sync yet. Prefer the freshest in-memory queued payload —
      // it is always this client's OWN latest unsaved edit (queuedPayloadRef
      // is cleared the instant a flush succeeds), so it is never stale
      // relative to our own work; the same trust model resolveIdeaMapHydration
      // already applies to the localStorage draft, just without the ~800ms
      // debounce lag. Falls back to that localStorage-draft path for the
      // normal cold-hydration path (nothing queued in memory yet), and to the
      // plain canonical graph when there is no pending local work at all —
      // i.e. today's behavior is preserved whenever there is nothing to merge.
      const queued = getQueuedPayload();
      const serverNodeCount = Array.isArray(serverMap.nodes) ? serverMap.nodes.length : 0;
      const queuedNodeCount = queued && Array.isArray(queued.nodes) ? queued.nodes.length : -1;
      let map: IdeaMapHydrationPayload = serverMap;
      // Anti-wipe (M06): a 0-node queued payload must NEVER clobber a non-empty
      // server map on hydration. The queued payload is an unsaved local edit and
      // is normally trusted over the canonical GET (DP-3 soft-merge) — but an
      // empty payload here is never a legitimate edit: it is the empty initial
      // ReactFlow/tool state captured before the GET resolved (mind/idea maps
      // always carry a non-deletable root). Trusting it made refresh() overwrite
      // the real graph with nodes:[], which then bootstrapped the 6-node starter
      // and synced it back — silently destroying the user's map. Fall through to
      // the canonical server graph instead. resolveIdeaMapHydration applies the
      // same guard to the localStorage-draft path (draftNodeCount===0 branch).
      if (
        queued &&
        Array.isArray(queued.nodes) &&
        Array.isArray(queued.edges) &&
        !(queuedNodeCount === 0 && serverNodeCount > 0)
      ) {
        map = {
          ...serverMap,
          nodes: queued.nodes,
          edges: queued.edges,
          preferredTool: queued.preferredTool ?? serverMap.preferredTool ?? null,
          extensions: queued.extensions ?? serverMap.extensions ?? {},
          version: serverVersion,
        };
      } else {
        const hydration = resolveIdeaMapHydration(ideaId, serverMap);
        map = hydration.map || serverMap;
      }
      const nextGraph: WorkspaceGraphState = {
        nodes: Array.isArray(map.nodes) ? (map.nodes as Node[]) : [],
        edges: Array.isArray(map.edges) ? (map.edges as Edge[]) : [],
        extensions: isPlainObject(map.extensions) ? map.extensions : {},
        version: Number(map.version || serverVersion),
      };
      setGraph(nextGraph);
      // Pass the hydrated node count so the sync-layer anti-wipe guard has a
      // baseline immediately after hydration (before the first captured edit).
      primeServerVersion(nextGraph.version, nextGraph.nodes.length);
      const storedViewport =
        isPlainObject(nextGraph.extensions?.surfaceState) &&
        isPlainObject((nextGraph.extensions.surfaceState as Record<string, unknown>)?.viewport)
          ? ((nextGraph.extensions.surfaceState as Record<string, unknown>).viewport as {
              x: number;
              y: number;
              zoom: number;
            })
          : null;
      if (storedViewport) setViewport(storedViewport);
    } catch (err: any) {
      // Deliberately do NOT touch `graph` here: on a first-ever failed load it
      // is still the untouched empty initial state (handled by the D2 fix in
      // useMindMapPersistence), and on a later failed refresh it still holds
      // the last successfully loaded map — either way, clobbering it here
      // would destroy real data on a transient network blip.
      setLoadError(err?.message ? String(err.message) : 'idea-map-load-failed');
      throw err;
    } finally {
      setLoading(false);
      refreshInFlightRef.current = false;
    }
  }, [getQueuedPayload, ideaId, language, open, primeServerVersion]);

  useEffect(() => {
    if (!open) return;
    // `refresh()` now rethrows on failure (so awaiting callers elsewhere still
    // see the rejection) — this mount-triggered call has no caller to await
    // it, so swallow here. The failure is already recorded in `loadError`.
    void refresh().catch(() => {});
  }, [open, refresh]);

  const replaceGraph = useCallback((next: Partial<WorkspaceGraphState>) => {
    setGraph((prev) => {
      const nextNodes = Array.isArray(next.nodes) ? (next.nodes as Node[]) : prev.nodes;
      const nextEdges = Array.isArray(next.edges) ? (next.edges as Edge[]) : prev.edges;
      const nextExtensions = isPlainObject(next.extensions)
        ? mergeWorkspaceExtensions(prev.extensions || {}, next.extensions)
        : prev.extensions;
      const nextVersion = typeof next.version === 'number' ? next.version : prev.version;
      if (
        nextNodes === prev.nodes &&
        nextEdges === prev.edges &&
        nextExtensions === prev.extensions &&
        nextVersion === prev.version
      ) {
        return prev;
      }
      return {
        nodes: nextNodes,
        edges: nextEdges,
        extensions: nextExtensions,
        version: nextVersion,
      };
    });
  }, []);

  const applyGraphMutation = useCallback(
    (
      mutator: (draft: WorkspaceGraphState) => WorkspaceGraphState,
      opts?: QueueGraphSyncOptions & { extensionPatch?: Record<string, unknown> }
    ) => {
      const next = mutator(graphRef.current);
      setGraph(next);
      queueSync(buildPayload(next, opts?.extensionPatch), {
        reason: opts?.reason || 'draft',
        immediate: opts?.immediate,
      });
    },
    [buildPayload, queueSync]
  );

  const applyExtensionsPatch = useCallback(
    (patch: Record<string, unknown>, opts?: QueueGraphSyncOptions) => {
      setGraph((prev) => {
        const next = {
          ...prev,
          extensions: mergeWorkspaceExtensions(prev.extensions || {}, patch),
        };
        if (
          stableSerialize(buildComparableGraph(prev)) ===
          stableSerialize(buildComparableGraph(next))
        ) {
          return prev;
        }
        queueSync(buildPayload(next), {
          reason: opts?.reason || 'draft',
          immediate: opts?.immediate,
        });
        return next;
      });
    },
    [buildPayload, queueSync]
  );

  const captureToolGraph = useCallback(
    (
      next: {
        nodes: Node[];
        edges: Edge[];
        extensions?: Record<string, unknown>;
      },
      opts?: QueueGraphSyncOptions
    ) => {
      setGraph((prev) => {
        const merged: WorkspaceGraphState = {
          nodes: next.nodes,
          edges: next.edges,
          extensions: mergeWorkspaceExtensions(prev.extensions || {}, next.extensions || {}),
          version: prev.version,
        };
        if (
          stableSerialize(buildComparableGraph(prev)) ===
          stableSerialize(buildComparableGraph(merged))
        ) {
          return prev;
        }
        queueSync(buildPayload(merged), {
          reason: opts?.reason || 'draft',
          immediate: opts?.immediate,
        });
        return merged;
      });
    },
    [buildPayload, queueSync]
  );

  const flushGraph = useCallback(
    async (opts?: QueueGraphSyncOptions) => {
      const payload = buildPayload(graphRef.current);
      const response = await flushNow(payload, {
        reason: opts?.reason || 'manual',
        createSnapshot: opts?.createSnapshot,
        snapshotLabel: opts?.snapshotLabel,
      });
      if (response?.version) {
        const nextVersion = Number(response.version || currentVersionRef.current || 1);
        setGraph((prev) => ({ ...prev, version: nextVersion }));
      }
      return response;
    },
    [buildPayload, currentVersionRef, flushNow]
  );

  const syncLabel = useMemo(
    () => formatIdeaMapSyncLabel(syncState, lastSavedAt, language.startsWith('pl')),
    [language, lastSavedAt, syncState]
  );

  return {
    graph,
    loading,
    loadError,
    saving,
    lastSavedAt,
    syncState: syncState as IdeaMapSyncState,
    syncLabel,
    viewport,
    setViewport,
    refresh,
    replaceGraph,
    captureToolGraph,
    applyGraphMutation,
    applyExtensionsPatch,
    flushGraph,
  };
}
