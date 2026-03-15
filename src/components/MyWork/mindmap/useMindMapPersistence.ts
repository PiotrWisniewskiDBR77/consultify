/**
 * useMindMapPersistence — Hydrate/save logic for the Mind Map.
 *
 * ## Graph ownership model (MM-01)
 *
 * The single canonical runtime owner of mindmap graph state is the ReactFlow
 * local state (`nodes`, `edges`) held inside `IdeaRecommendationMap`.
 *
 * Data flow:
 *   ReactFlow state (canonical owner)
 *     → useMindMapPersistence.scheduleSave()
 *       → externalRuntime.captureGraph() (workspace graph runtime)
 *         → useIdeaMapSync.queueSync()
 *           → POST /map/sync (conflict-safe, version-based)
 *
 * `IdeaMapWorkspace` exposes `graphNodes` / `graphEdges` / `mapExtensions`
 * derived from `workspaceGraphRuntime.graph` — these are READ-ONLY mirrors
 * used by panels (Tools, Context, AI Suggestions) and cross-tool transforms.
 * They are NOT competing write owners.
 *
 * ## Persistence model (MM-02)
 *
 * All mindmap saves go through `POST /map/sync` with version-based conflict
 * detection (same path as whiteboard, process_flow, and table).
 * On version conflict (HTTP 409): toast notification + reload from server.
 * No silent overwrites.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import type { Edge, Node } from 'reactflow';

import { Api } from '@/services/api';

import type { CanvasToolType } from '../ideaSelectionTypes';
import type { IdeaMapSyncState } from '../canvas/useIdeaMapSync';
import { mergeWorkspaceExtensions } from '../canvas/workspaceGraphRuntime';
import { normalizeMindMapNodes } from './mindMapNodeModel';

type PersistenceStatus = 'online' | 'no_route' | 'missing_table' | 'offline';

function stableSerialize(value: unknown): string {
  try {
    return JSON.stringify(value ?? null);
  } catch {
    return '';
  }
}

function shouldBootstrapStarterGraph(
  runtimeNodes: Node[],
  runtimeEdges: Edge[],
  runtimeVersion: number | null
) {
  if (runtimeNodes.length === 0 && runtimeEdges.length === 0) return true;
  if (runtimeVersion !== null && runtimeVersion > 1) return false;
  if (runtimeEdges.length > 0) return false;
  if (runtimeNodes.length !== 1) return false;
  return String(runtimeNodes[0]?.id || '') === 'root';
}

function buildLocalDefaultIdeaMap(
  ideaId: string,
  ideaTitle: string,
  isPolish: boolean
): { nodes: Node[]; edges: Edge[] } {
  const rootNode: Node = {
    id: 'root',
    type: 'center',
    position: { x: 0, y: 0 },
    data: {
      label: ideaTitle || (isPolish ? 'Mój pomysł' : 'My idea'),
      hint: isPolish ? 'Kliknij, aby edytować' : 'Click to edit',
    },
  };
  const branchSpecs = [
    {
      id: 'branch-problem',
      branchKey: 'problem',
      label: isPolish ? 'Problem' : 'Problem',
      position: { x: -320, y: -180 },
      selected: false,
    },
    {
      id: 'branch-options',
      branchKey: 'options',
      label: isPolish ? 'Opcje' : 'Options',
      position: { x: 320, y: -180 },
      selected: true,
    },
    {
      id: 'branch-evidence',
      branchKey: 'evidence',
      label: isPolish ? 'Dowody' : 'Evidence',
      position: { x: -320, y: 20 },
      selected: false,
    },
    {
      id: 'branch-risks',
      branchKey: 'risks',
      label: isPolish ? 'Ryzyka' : 'Risks',
      position: { x: 320, y: 20 },
      selected: false,
    },
    {
      id: 'branch-experiments',
      branchKey: 'experiments',
      label: isPolish ? 'Eksperymenty' : 'Experiments',
      position: { x: 0, y: 240 },
      selected: false,
    },
  ] as const;

  const branchNodes: Node[] = branchSpecs.map((branch) => ({
    id: branch.id,
    type: 'branch',
    position: branch.position,
    selected: branch.selected === true,
    data: {
      label: branch.label,
      branchKey: branch.branchKey,
      hint: isPolish ? 'Wybierz gałąź i naciśnij Tab' : 'Select branch and press Tab',
    },
  }));

  const branchEdges: Edge[] = branchSpecs.map((branch) => ({
    id: `edge-root-${branch.branchKey}`,
    source: 'root',
    target: branch.id,
    type: 'smoothstep',
    data: { edgeRole: 'structural' },
  }));

  return { nodes: [rootNode, ...branchNodes], edges: branchEdges };
}

export interface UseMindMapPersistenceOpts {
  ideaId: string;
  ideaTitle: string;
  isPolish: boolean;
  locked: boolean;
  preferredTool?: CanvasToolType;
  extensions?: Record<string, unknown>;
  i18nLanguage: string;
  nodes: Node[];
  edges: Edge[];
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
  setCollapsedNodeIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  collapsedNodeIds: Set<string>;
  fitView: (opts?: any) => void;
  setViewport: (vp: any, opts?: any) => void;
  getViewport: () => { x: number; y: number; zoom: number };
  onPreferredToolLoaded?: (tool: CanvasToolType | null) => void;
  onViewportReport?: (viewport: { x: number; y: number; zoom: number }) => void;
  clearUndoHistory: () => void;
  externalRuntime?: {
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
  };
}

export function useMindMapPersistence(opts: UseMindMapPersistenceOpts) {
  const {
    ideaId,
    ideaTitle,
    isPolish,
    locked,
    preferredTool,
    extensions,
    i18nLanguage,
    nodes,
    edges,
    setNodes,
    setEdges,
    setCollapsedNodeIds,
    collapsedNodeIds,
    fitView,
    setViewport,
    getViewport,
    onPreferredToolLoaded,
    onViewportReport,
    clearUndoHistory,
    externalRuntime,
  } = opts;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [persistence, setPersistence] = useState<PersistenceStatus>('online');

  const saveTimerRef = useRef<number | null>(null);
  const isHydratingRef = useRef(true);
  const lastHydratedRuntimeVersionRef = useRef<number | null>(null);
  const skipNextAutoSaveRef = useRef(false);
  const lastScheduledPayloadKeyRef = useRef('');
  const localVersionRef = useRef(1);
  const runtimeVersion = externalRuntime?.version ?? null;
  const runtimeLoading = externalRuntime?.loading ?? false;
  const runtimeSaving = externalRuntime?.saving ?? false;
  const runtimeLastSavedAt = externalRuntime?.lastSavedAt ?? null;
  const runtimeSyncState = externalRuntime?.syncState ?? null;
  const runtimeNodes = externalRuntime?.nodes ?? null;
  const runtimeEdges = externalRuntime?.edges ?? null;
  const runtimeExtensions = externalRuntime?.extensions ?? null;
  const runtimeCaptureGraph = externalRuntime?.captureGraph;
  const scheduleSaveStateRef = useRef({
    collapsedNodeIds,
    extensions,
    externalRuntime,
    locked,
    onViewportReport,
    persistence,
    preferredTool,
    runtimeCaptureGraph,
    runtimeEdges,
    runtimeExtensions,
    runtimeNodes,
  });

  useEffect(() => {
    scheduleSaveStateRef.current = {
      collapsedNodeIds,
      extensions,
      externalRuntime,
      locked,
      onViewportReport,
      persistence,
      preferredTool,
      runtimeCaptureGraph,
      runtimeEdges,
      runtimeExtensions,
      runtimeNodes,
    };
  }, [
    collapsedNodeIds,
    extensions,
    externalRuntime,
    locked,
    onViewportReport,
    persistence,
    preferredTool,
    runtimeCaptureGraph,
    runtimeEdges,
    runtimeExtensions,
    runtimeNodes,
  ]);

  const prevSyncStateRef = useRef<IdeaMapSyncState | null>(null);

  useEffect(() => {
    if (runtimeVersion === null) return;
    setLoading(runtimeLoading);
    setSaving(runtimeSaving);
    setLastSavedAt(runtimeLastSavedAt);
    setPersistence(runtimeSyncState === 'offline' ? 'offline' : 'online');

    // MM-02: On version conflict, reload the latest graph from the server.
    // The workspace-level onConflict handler shows the toast; here we trigger
    // the actual data refresh so ReactFlow state gets the server version.
    if (
      runtimeSyncState === 'conflict' &&
      prevSyncStateRef.current !== 'conflict'
    ) {
      externalRuntime?.refresh?.();
    }
    prevSyncStateRef.current = runtimeSyncState;
  }, [runtimeLastSavedAt, runtimeLoading, runtimeSaving, runtimeSyncState, runtimeVersion, externalRuntime]);

  const hydrate = useCallback(async () => {
    if (externalRuntime) {
      localVersionRef.current = Math.max(1, Number(runtimeVersion || 1));
      const runtimeNodesSafe = Array.isArray(runtimeNodes) ? runtimeNodes : [];
      const runtimeEdgesSafe = Array.isArray(runtimeEdges) ? runtimeEdges : [];
      const defaultGraph = shouldBootstrapStarterGraph(
        runtimeNodesSafe as Node[],
        runtimeEdgesSafe as Edge[],
        runtimeVersion
      )
        ? buildLocalDefaultIdeaMap(ideaId, ideaTitle, isPolish)
        : null;
      const nextNodes = defaultGraph ? defaultGraph.nodes : runtimeNodesSafe;
      const nextEdges = defaultGraph ? defaultGraph.edges : runtimeEdgesSafe;
      const safeRuntimeExtensions =
        runtimeExtensions && typeof runtimeExtensions === 'object' ? runtimeExtensions : {};
      const viewState = (safeRuntimeExtensions as any)?.mindmap?.viewState;
      const savedCollapsed = viewState?.collapsedNodeIds;
      if (Array.isArray(savedCollapsed)) setCollapsedNodeIds(new Set(savedCollapsed));
      const savedViewport = viewState?.viewport;
      const patchedNodes = nextNodes.map((n: any) => {
        if (String(n?.id) !== 'root') return n;
        return {
          ...n,
          data: {
            ...(n.data || {}),
            label: ideaTitle || (isPolish ? 'Mój pomysł' : 'My idea'),
            hint: isPolish ? 'Kliknij, aby edytować' : 'Click to edit',
          },
        };
      });
      const depthPatchedNodes = normalizeMindMapNodes(
        patchedNodes,
        nextEdges as Edge[],
        ideaTitle,
        isPolish
      );
      if (defaultGraph) {
        runtimeCaptureGraph?.(
          {
            nodes: depthPatchedNodes,
            edges: nextEdges,
            extensions: safeRuntimeExtensions,
          },
          { reason: 'draft' }
        );
      }
      isHydratingRef.current = true;
      skipNextAutoSaveRef.current = true;
      lastScheduledPayloadKeyRef.current = '';
      setNodes(depthPatchedNodes);
      setEdges(nextEdges);
      clearUndoHistory();
      setTimeout(() => {
        isHydratingRef.current = false;
        try {
          if (
            savedViewport &&
            typeof savedViewport.x === 'number' &&
            typeof savedViewport.zoom === 'number'
          ) {
            setViewport(savedViewport, { duration: 300 });
          } else {
            fitView({ padding: 0.3, duration: 300 });
          }
        } catch {
          /* ignore */
        }
      }, 50);
      return;
    }
    setLoading(true);
    try {
      setPersistence('online');
      const res = await Api.getMyIdeaMap(ideaId, { language: i18nLanguage });
      const map = res?.map || {};
      localVersionRef.current = Math.max(1, Number(map?.version || 1));
      const nextNodes = Array.isArray(map.nodes) ? map.nodes : [];
      const nextEdges = Array.isArray(map.edges) ? map.edges : [];
      const loadedPreferred = map?.preferredTool ? String(map.preferredTool) : null;
      const loadedPreferredSafe =
        loadedPreferred &&
        ['mindmap', 'process_flow', 'table', 'whiteboard'].includes(loadedPreferred)
          ? (loadedPreferred as CanvasToolType)
          : null;
      onPreferredToolLoaded?.(loadedPreferredSafe);

      const patchedNodes = nextNodes.map((n: any) => {
        if (String(n?.id) !== 'root') return n;
        return {
          ...n,
          data: {
            ...(n.data || {}),
            label: ideaTitle || (isPolish ? 'Mój pomysł' : 'My idea'),
            hint: isPolish ? 'Kliknij, aby edytować' : 'Click to edit',
          },
        };
      });

      const viewState = (map.extensions as any)?.mindmap?.viewState;
      const savedCollapsed = viewState?.collapsedNodeIds;
      if (Array.isArray(savedCollapsed)) setCollapsedNodeIds(new Set(savedCollapsed));

      const savedViewport = viewState?.viewport;

      const depthPatchedNodes = normalizeMindMapNodes(
        patchedNodes,
        nextEdges as Edge[],
        ideaTitle,
        isPolish
      );

      isHydratingRef.current = true;
      skipNextAutoSaveRef.current = true;
      lastScheduledPayloadKeyRef.current = '';
      setNodes(depthPatchedNodes);
      setEdges(nextEdges);
      clearUndoHistory();
      setTimeout(() => {
        isHydratingRef.current = false;
        try {
          if (
            savedViewport &&
            typeof savedViewport.x === 'number' &&
            typeof savedViewport.zoom === 'number'
          ) {
            setViewport(savedViewport, { duration: 300 });
          } else {
            fitView({ padding: 0.3, duration: 300 });
          }
        } catch {
          /* ignore */
        }
      }, 50);
    } catch (err: any) {
      const msg = String(err?.message || '');
      const isNoRoute =
        msg.toLowerCase().includes('route get') &&
        msg.toLowerCase().includes('/my-work/my-ideas') &&
        msg.toLowerCase().includes('/map');
      const isMissingTable =
        msg.toLowerCase().includes('database table missing') &&
        msg.toLowerCase().includes('my_idea_maps');

      if (isNoRoute) {
        setPersistence('no_route');
        toast(
          (isPolish
            ? 'Backend wymaga restartu (route mapy jeszcze nie działa).'
            : 'Backend needs restart (map route not active).') as any
        );
      } else if (isMissingTable) {
        setPersistence('missing_table');
        toast(
          (isPolish
            ? 'Brakuje tabeli mapy — uruchom migracje DB.'
            : 'Map table missing — run DB migrations.') as any
        );
      } else {
        setPersistence('offline');
        toast.error(msg || (isPolish ? 'Nie udało się wczytać mapy' : 'Failed to load map'));
      }

      const def = buildLocalDefaultIdeaMap(ideaId, ideaTitle, isPolish);
      localVersionRef.current = 1;
      isHydratingRef.current = true;
      skipNextAutoSaveRef.current = true;
      lastScheduledPayloadKeyRef.current = '';
      setNodes(def.nodes);
      setEdges(def.edges);
      setTimeout(() => {
        isHydratingRef.current = false;
        try {
          fitView({ padding: 0.3, duration: 250 });
        } catch {
          /* ignore */
        }
      }, 30);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    fitView,
    i18nLanguage,
    ideaId,
    ideaTitle,
    isPolish,
    onPreferredToolLoaded,
    runtimeEdges,
    runtimeExtensions,
    runtimeNodes,
    setEdges,
    setNodes,
  ]);

  useEffect(() => {
    hydrate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ideaId]);

  useEffect(() => {
    if (runtimeVersion === null) return;
    if (lastHydratedRuntimeVersionRef.current === runtimeVersion) return;
    lastHydratedRuntimeVersionRef.current = runtimeVersion;
    hydrate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runtimeVersion]);

  useEffect(() => {
    const label = ideaTitle || (isPolish ? 'Mój pomysł' : 'My idea');
    const hint = isPolish ? 'Kliknij, aby edytować' : 'Click to edit';
    setNodes((prev: Node[]) => {
      let hasChanges = false;
      const next = (prev || []).map((n: any) => {
        if (String(n?.id) !== 'root') return n;
        const currentLabel = String(n?.data?.label || '');
        const currentHint = String(n?.data?.hint || '');
        if (currentLabel === label && currentHint === hint) {
          return n;
        }
        hasChanges = true;
        return {
          ...n,
          data: {
            ...(n.data || {}),
            label,
            hint,
          },
        };
      });
      return hasChanges ? next : prev;
    });
  }, [ideaTitle, isPolish, setNodes]);

  useEffect(() => {
    if (loading) return;
    const params = new URLSearchParams(window.location.search);
    const focusId = params.get('focusNode');
    if (!focusId) return;
    const target = nodes.find((n) => n.id === focusId);
    if (target) {
      setNodes((prev: Node[]) => prev.map((n) => ({ ...n, selected: n.id === focusId })));
      setTimeout(() => {
        try {
          fitView({ nodes: [{ id: focusId } as any], padding: 0.5, duration: 400 });
        } catch {
          /* ignore */
        }
      }, 100);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  const scheduleSave = useCallback(
    (nextNodes: Node[], nextEdges: Edge[]) => {
      if (isHydratingRef.current) return;
      if (skipNextAutoSaveRef.current) {
        skipNextAutoSaveRef.current = false;
        return;
      }
      const {
        collapsedNodeIds: latestCollapsedNodeIds,
        extensions: latestExtensions,
        externalRuntime: latestExternalRuntime,
        locked: latestLocked,
        onViewportReport: latestOnViewportReport,
        persistence: latestPersistence,
        preferredTool: latestPreferredTool,
        runtimeCaptureGraph: latestRuntimeCaptureGraph,
        runtimeEdges: latestRuntimeEdges,
        runtimeExtensions: latestRuntimeExtensions,
        runtimeNodes: latestRuntimeNodes,
      } = scheduleSaveStateRef.current;

      if (latestLocked) return;
      if (latestExternalRuntime) {
        const currentViewport = getViewport();
        const mindmapViewStatePatch = {
          mindmap: {
            viewState: {
              collapsedNodeIds: Array.from(latestCollapsedNodeIds),
              viewport: currentViewport,
            },
          },
        };
        const ext = mergeWorkspaceExtensions(
          (latestExtensions || {}) as Record<string, unknown>,
          mindmapViewStatePatch,
        );
        const cleanNodes = nextNodes.map((n: any) => {
          if (!n.data?._interactionMode && !n.data?._canAddSibling) return n;
          const { _interactionMode, _canAddSibling, ...cleanData } = n.data || {};
          return { ...n, data: cleanData };
        });
        const payloadKey = stableSerialize({
          nodes: cleanNodes,
          edges: nextEdges,
          extensions: ext,
        });
        const runtimeExt = mergeWorkspaceExtensions(
          (latestRuntimeExtensions && typeof latestRuntimeExtensions === 'object'
            ? latestRuntimeExtensions
            : {}) as Record<string, unknown>,
          mindmapViewStatePatch,
        );
        if (
          stableSerialize(cleanNodes) === stableSerialize(latestRuntimeNodes || []) &&
          stableSerialize(nextEdges) === stableSerialize(latestRuntimeEdges || []) &&
          stableSerialize(ext) === stableSerialize(runtimeExt)
        ) {
          return;
        }
        if (payloadKey === lastScheduledPayloadKeyRef.current) {
          return;
        }
        lastScheduledPayloadKeyRef.current = payloadKey;
        latestOnViewportReport?.(currentViewport);
        latestRuntimeCaptureGraph?.(
          {
            nodes: cleanNodes as Node[],
            edges: nextEdges,
            extensions: ext,
          },
          { reason: 'draft' }
        );
        return;
      }
      if (latestPersistence !== 'online') return;
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = window.setTimeout(async () => {
        setSaving(true);
        try {
          const currentViewport = getViewport();
          latestOnViewportReport?.(currentViewport);
          const ext = mergeWorkspaceExtensions(
            (latestExtensions || {}) as Record<string, unknown>,
            {
              mindmap: {
                viewState: {
                  collapsedNodeIds: Array.from(latestCollapsedNodeIds),
                  viewport: currentViewport,
                },
              },
            },
          );
          const cleanNodes = nextNodes.map((n: any) => {
            if (!n.data?._interactionMode && !n.data?._canAddSibling) return n;
            const { _interactionMode, _canAddSibling, ...cleanData } = n.data || {};
            return { ...n, data: cleanData };
          });
          const payloadKey = stableSerialize({
            nodes: cleanNodes,
            edges: nextEdges,
            extensions: ext,
          });
          if (payloadKey === lastScheduledPayloadKeyRef.current) {
            setSaving(false);
            return;
          }
          lastScheduledPayloadKeyRef.current = payloadKey;
          const response = await Api.syncMyIdeaMap(ideaId, {
            nodes: cleanNodes,
            edges: nextEdges,
            baseVersion: localVersionRef.current,
            preferredTool: latestPreferredTool || undefined,
            extensions: ext,
            reason: 'draft',
          });
          localVersionRef.current = Math.max(1, Number(response?.version || localVersionRef.current || 1));
          setLastSavedAt(Date.now());
        } catch (err: any) {
          if (err?.status === 409) {
            toast(
              isPolish
                ? 'Wykryto konflikt zmian. Odświeżam mapę z serwera.'
                : 'Change conflict detected. Refreshing map from server.',
              { icon: '⚠️' }
            );
            await hydrate();
            return;
          }
          toast.error(
            err?.message || (isPolish ? 'Nie udało się zapisać mapy' : 'Failed to save map')
          );
        } finally {
          setSaving(false);
        }
      }, 700);
    },
    [getViewport, hydrate, ideaId, isPolish]
  );

  useEffect(() => {
    scheduleSave(nodes as any, edges as any);
  }, [nodes, edges, scheduleSave]);

  return {
    loading,
    saving,
    lastSavedAt,
    persistence,
    setSaving,
    setLastSavedAt,
    isHydratingRef,
    hydrate,
    scheduleSave,
    localVersionRef,
  };
}
