import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Edge, Node } from 'reactflow';

import { Api } from '@/services/api';

import type { CanvasToolType } from '../ideaSelectionTypes';
import {
  formatIdeaMapSyncLabel,
  resolveIdeaMapHydration,
  type IdeaMapHydrationPayload,
  type IdeaMapSyncPayload,
  type IdeaMapSyncState,
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

const EXTENSION_BUCKETS = new Set([
  'mindmap',
  'whiteboard',
  'processFlow',
  'table',
  'surfaceState',
  'canvasGovernance',
  'interop',
]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function mergeWorkspaceExtensions(
  existing: Record<string, unknown>,
  patch?: Record<string, unknown> | null
): Record<string, unknown> {
  if (!patch) return existing;
  const next: Record<string, unknown> = { ...existing };
  for (const [key, value] of Object.entries(patch)) {
    if (!Object.prototype.hasOwnProperty.call(patch, key)) continue;
    if (value === undefined) continue;
    if (EXTENSION_BUCKETS.has(key) && isPlainObject(existing[key]) && isPlainObject(value)) {
      next[key] = mergeWorkspaceExtensions(existing[key] as Record<string, unknown>, value);
      continue;
    }
    next[key] = value as unknown;
  }
  return next;
}

function sanitizeNodes(nodes: Node[]) {
  return nodes.map((node: any) => {
    const data = isPlainObject(node?.data) ? { ...(node.data as Record<string, unknown>) } : undefined;
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

function buildComparableGraph(
  state: Pick<WorkspaceGraphState, 'nodes' | 'edges' | 'extensions'>
): { nodes: Node[]; edges: Edge[]; extensions: Record<string, unknown> } {
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

  const refresh = useCallback(async () => {
    if (!open || !ideaId) return;
    setLoading(true);
    try {
      const res = await Api.getMyIdeaMap(ideaId, { language });
      const hydration = resolveIdeaMapHydration(ideaId, res?.map || {});
      const map = hydration.map || {};
      const nextGraph: WorkspaceGraphState = {
        nodes: Array.isArray(map.nodes) ? (map.nodes as Node[]) : [],
        edges: Array.isArray(map.edges) ? (map.edges as Edge[]) : [],
        extensions: isPlainObject(map.extensions) ? map.extensions : {},
        version: Number(map.version || 1),
      };
      setGraph(nextGraph);
      primeServerVersion(nextGraph.version);
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
    } finally {
      setLoading(false);
    }
  }, [ideaId, language, open, primeServerVersion]);

  useEffect(() => {
    if (!open) return;
    void refresh();
  }, [open, refresh]);

  const replaceGraph = useCallback(
    (next: Partial<WorkspaceGraphState>) => {
      setGraph((prev) => ({
        nodes: Array.isArray(next.nodes) ? (next.nodes as Node[]) : prev.nodes,
        edges: Array.isArray(next.edges) ? (next.edges as Edge[]) : prev.edges,
        extensions: isPlainObject(next.extensions)
          ? mergeWorkspaceExtensions(prev.extensions || {}, next.extensions)
          : prev.extensions,
        version: typeof next.version === 'number' ? next.version : prev.version,
      }));
    },
    []
  );

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
          stableSerialize(buildComparableGraph(prev)) === stableSerialize(buildComparableGraph(next))
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
          stableSerialize(buildComparableGraph(prev)) === stableSerialize(buildComparableGraph(merged))
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
