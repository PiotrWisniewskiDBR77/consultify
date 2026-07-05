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

import i18n from '@/i18n';
import { Api } from '@/services/api';

import type { IdeaMapSyncState } from '../canvas/useIdeaMapSync';
import { mergeWorkspaceExtensions } from '../canvas/workspaceGraphRuntime';
import type { CanvasToolType } from '../ideaSelectionTypes';
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
  if (runtimeVersion !== null && runtimeVersion > 1) return false;
  if (runtimeNodes.length === 0 && runtimeEdges.length === 0) return true;
  if (runtimeEdges.length > 0) return false;
  if (runtimeNodes.length !== 1) return false;
  return String(runtimeNodes[0]?.id || '') === 'root';
}

function buildLocalDefaultIdeaMap(
  ideaId: string,
  ideaTitle: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- kept for call-site compatibility (molochs pass this positionally)
  isPolish: boolean
): { nodes: Node[]; edges: Edge[] } {
  const rootNode: Node = {
    id: 'root',
    type: 'center',
    position: { x: 0, y: 0 },
    data: {
      label: ideaTitle || i18n.t('mindmap.persistence.myIdea'),
      hint: i18n.t('mindmap.persistence.clickToEdit'),
    },
  };
  const branchSpecs = [
    {
      id: 'branch-problem',
      branchKey: 'problem',
      label: i18n.t('mindmap.persistence.branchProblem'),
      position: { x: -320, y: -180 },
      selected: false,
    },
    {
      id: 'branch-options',
      branchKey: 'options',
      label: i18n.t('mindmap.persistence.branchOptions'),
      position: { x: 320, y: -180 },
      selected: true,
    },
    {
      id: 'branch-evidence',
      branchKey: 'evidence',
      label: i18n.t('mindmap.persistence.branchEvidence'),
      position: { x: -320, y: 20 },
      selected: false,
    },
    {
      id: 'branch-risks',
      branchKey: 'risks',
      label: i18n.t('mindmap.persistence.branchRisks'),
      position: { x: 320, y: 20 },
      selected: false,
    },
    {
      id: 'branch-experiments',
      branchKey: 'experiments',
      label: i18n.t('mindmap.persistence.branchExperiments'),
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
      hint: i18n.t('mindmap.persistence.selectBranchHint'),
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
  structureType?: string;
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
    structureType,
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
    structureType,
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
      structureType,
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
    structureType,
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
    if (runtimeSyncState === 'conflict' && prevSyncStateRef.current !== 'conflict') {
      externalRuntime?.refresh?.();
    }
    prevSyncStateRef.current = runtimeSyncState;
  }, [
    runtimeLastSavedAt,
    runtimeLoading,
    runtimeSaving,
    runtimeSyncState,
    runtimeVersion,
    externalRuntime,
  ]);

  // Keep a stable ref to runtime data so `hydrate` doesn't get a new identity
  // on every save cycle (which would cascade into effect re-runs).
  const runtimeDataRef = useRef({ runtimeNodes, runtimeEdges, runtimeExtensions, runtimeVersion });
  useEffect(() => {
    runtimeDataRef.current = { runtimeNodes, runtimeEdges, runtimeExtensions, runtimeVersion };
  }, [runtimeNodes, runtimeEdges, runtimeExtensions, runtimeVersion]);

  const hydrate = useCallback(async () => {
    const {
      runtimeNodes: rtNodes,
      runtimeEdges: rtEdges,
      runtimeExtensions: rtExt,
      runtimeVersion: rtVer,
    } = runtimeDataRef.current;
    if (externalRuntime) {
      localVersionRef.current = Math.max(1, Number(rtVer || 1));
      const runtimeNodesSafe = Array.isArray(rtNodes) ? rtNodes : [];
      const runtimeEdgesSafe = Array.isArray(rtEdges) ? rtEdges : [];
      const defaultGraph = shouldBootstrapStarterGraph(
        runtimeNodesSafe as Node[],
        runtimeEdgesSafe as Edge[],
        rtVer
      )
        ? buildLocalDefaultIdeaMap(ideaId, ideaTitle, isPolish)
        : null;
      const nextNodes = defaultGraph ? defaultGraph.nodes : runtimeNodesSafe;
      const nextEdges = defaultGraph ? defaultGraph.edges : runtimeEdgesSafe;
      const safeRuntimeExtensions = rtExt && typeof rtExt === 'object' ? rtExt : {};
      const viewState = (safeRuntimeExtensions as any)?.mindmap?.viewState;
      const savedCollapsed = viewState?.collapsedNodeIds;
      if (Array.isArray(savedCollapsed)) setCollapsedNodeIds(new Set(savedCollapsed));
      let savedViewport = viewState?.viewport;
      // Fallback: if server has no viewport, try localStorage
      if (!savedViewport || typeof savedViewport.zoom !== 'number' || savedViewport.zoom <= 0) {
        try {
          const local = localStorage.getItem(`mm-viewport-${ideaId}`);
          if (local) savedViewport = JSON.parse(local);
        } catch {
          /* ignore */
        }
      }
      const patchedNodes = nextNodes.map((n: any) => {
        if (String(n?.id) !== 'root') return n;
        return {
          ...n,
          data: {
            ...(n.data || {}),
            label: ideaTitle || i18n.t('mindmap.persistence.myIdeaAccented'),
            hint: i18n.t('mindmap.persistence.clickToEditAccented'),
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
          const hasRealViewport =
            savedViewport &&
            typeof savedViewport.x === 'number' &&
            typeof savedViewport.zoom === 'number' &&
            savedViewport.zoom > 0;
          if (hasRealViewport) {
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
            label: ideaTitle || i18n.t('mindmap.persistence.myIdeaAccented'),
            hint: i18n.t('mindmap.persistence.clickToEditAccented'),
          },
        };
      });

      const viewState = (map.extensions as any)?.mindmap?.viewState;
      const savedCollapsed = viewState?.collapsedNodeIds;
      if (Array.isArray(savedCollapsed)) setCollapsedNodeIds(new Set(savedCollapsed));

      let savedViewport = viewState?.viewport;
      if (!savedViewport || typeof savedViewport.zoom !== 'number' || savedViewport.zoom <= 0) {
        try {
          const local = localStorage.getItem(`mm-viewport-${ideaId}`);
          if (local) savedViewport = JSON.parse(local);
        } catch {
          /* ignore */
        }
      }

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
          const hasRealViewport =
            savedViewport &&
            typeof savedViewport.x === 'number' &&
            typeof savedViewport.zoom === 'number' &&
            savedViewport.zoom > 0;
          if (hasRealViewport) {
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
        toast(i18n.t('mindmap.persistence.backendNeedsRestart') as any);
      } else if (isMissingTable) {
        setPersistence('missing_table');
        toast(i18n.t('mindmap.persistence.mapTableMissing') as any);
      } else {
        setPersistence('offline');
        toast.error(msg || i18n.t('mindmap.persistence.failedToLoadMap'));
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
    // runtimeNodes/runtimeEdges/runtimeExtensions are read from runtimeDataRef
    // to keep hydrate's identity stable across save cycles.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    fitView,
    i18nLanguage,
    ideaId,
    ideaTitle,
    isPolish,
    onPreferredToolLoaded,
    setEdges,
    setNodes,
  ]);

  useEffect(() => {
    hydrate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ideaId]);

  // Re-hydrate ONLY when the runtime version jumps by more than 1 (external
  // change, e.g. conflict resolution or another user's save).  A +1 bump is
  // the normal result of our own scheduleSave — re-hydrating on that would
  // reset the viewport to the saved position, causing the "jump to top-left"
  // bug the user reported.
  useEffect(() => {
    if (runtimeVersion === null) return;
    const prev = lastHydratedRuntimeVersionRef.current;
    if (prev === runtimeVersion) return;
    // First hydration (prev === null) always runs.
    // Subsequent: only when version jumps by >1 (external change).
    if (prev !== null && runtimeVersion <= prev + 1) {
      lastHydratedRuntimeVersionRef.current = runtimeVersion;
      return;
    }
    lastHydratedRuntimeVersionRef.current = runtimeVersion;
    hydrate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runtimeVersion]);

  // DP-3 (T6): `graph_version` = the WS gateway persisted a live graph_patch
  // we have ALREADY applied to the canvas (the patch relay precedes the
  // version broadcast; our own edits are in local state anyway). Treat it
  // exactly like our own +1 save bumps: advance localVersionRef and mark the
  // version as already-hydrated, so a later runtimeVersion jump caused by
  // accumulated live versions does NOT re-trigger hydrate(). Ref-only —
  // never a re-hydration, never a canvas remount (hard lesson 26a2a896ef).
  // First hydration is untouched (lastHydratedRuntimeVersionRef === null),
  // and versions never seen live (WS down ⇒ no graph_version) still
  // re-hydrate through the >1-jump path above — today's conflict recovery.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail) return;
      if (detail.ideaId && detail.ideaId !== ideaId) return;
      const version = Number(detail.version || 0);
      if (!Number.isFinite(version) || version <= 0) return;
      if (version > localVersionRef.current) {
        localVersionRef.current = version;
      }
      if (
        lastHydratedRuntimeVersionRef.current !== null &&
        version > lastHydratedRuntimeVersionRef.current
      ) {
        lastHydratedRuntimeVersionRef.current = version;
      }
    };
    window.addEventListener('idea-collab-graph-version', handler);
    return () => window.removeEventListener('idea-collab-graph-version', handler);
  }, [ideaId]);

  useEffect(() => {
    const label = ideaTitle || i18n.t('mindmap.persistence.myIdeaAccented');
    const hint = i18n.t('mindmap.persistence.clickToEditAccented');
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
        structureType: latestStructureType,
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
            ...(latestStructureType ? { structureType: latestStructureType } : {}),
            viewState: {
              collapsedNodeIds: Array.from(latestCollapsedNodeIds),
              viewport: currentViewport,
            },
          },
        };
        const ext = mergeWorkspaceExtensions(
          (latestExtensions || {}) as Record<string, unknown>,
          mindmapViewStatePatch
        );
        const cleanNodes = nextNodes.map((n: any) => {
          const { selected: _sel, dragging: _drag, ...rest } = n;
          const {
            _interactionMode,
            _canAddSibling,
            _startEditing,
            _collapsed,
            _dropTarget,
            _isNew,
            _justMoved,
            _childCount,
            count,
            ...cleanData
          } = rest.data || {};
          return { ...rest, data: cleanData };
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
          mindmapViewStatePatch
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
            }
          );
          const cleanNodes = nextNodes.map((n: any) => {
            const { selected: _sel, dragging: _drag, ...rest } = n;
            const {
              _interactionMode,
              _canAddSibling,
              _startEditing,
              _collapsed,
              _dropTarget,
              _isNew,
              _justMoved,
              _childCount,
              count,
              ...cleanData
            } = rest.data || {};
            return { ...rest, data: cleanData };
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
          localVersionRef.current = Math.max(
            1,
            Number(response?.version || localVersionRef.current || 1)
          );
          setLastSavedAt(Date.now());
        } catch (err: any) {
          if (err?.status === 409) {
            toast(i18n.t('mindmap.persistence.conflictDetected'), { icon: '⚠️' });
            await hydrate();
            return;
          }
          toast.error(err?.message || i18n.t('mindmap.persistence.failedToSaveMap'));
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

  // Persist viewport position independently of node/edge changes so that
  // pan/zoom is restored after page reload even when the graph didn't change.
  const viewportSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveViewportOnly = useCallback(() => {
    if (isHydratingRef.current) return;
    if (viewportSaveTimerRef.current) clearTimeout(viewportSaveTimerRef.current);
    viewportSaveTimerRef.current = setTimeout(() => {
      const {
        collapsedNodeIds: latestCollapsedNodeIds,
        externalRuntime: latestExternalRuntime,
        locked: latestLocked,
        structureType: latestStructureType,
        runtimeCaptureGraph: latestRuntimeCaptureGraph,
        extensions: latestExtensions,
        runtimeExtensions: latestRuntimeExtensions,
      } = scheduleSaveStateRef.current;
      if (latestLocked) return;
      const currentViewport = getViewport();
      const mindmapViewStatePatch = {
        mindmap: {
          ...(latestStructureType ? { structureType: latestStructureType } : {}),
          viewState: {
            collapsedNodeIds: Array.from(latestCollapsedNodeIds),
            viewport: currentViewport,
          },
        },
      };
      if (latestExternalRuntime && latestRuntimeCaptureGraph) {
        const ext = mergeWorkspaceExtensions(
          (latestExtensions || {}) as Record<string, unknown>,
          mindmapViewStatePatch
        );
        const runtimeExt = mergeWorkspaceExtensions(
          (latestRuntimeExtensions && typeof latestRuntimeExtensions === 'object'
            ? latestRuntimeExtensions
            : {}) as Record<string, unknown>,
          mindmapViewStatePatch
        );
        if (stableSerialize(ext) === stableSerialize(runtimeExt)) return;
        const { runtimeNodes: rtNodes, runtimeEdges: rtEdges } = runtimeDataRef.current;
        const cleanNodes = (Array.isArray(rtNodes) ? rtNodes : []).map((n: any) => {
          const { selected: _sel, dragging: _drag, ...rest } = n;
          const {
            _interactionMode,
            _canAddSibling,
            _startEditing,
            _collapsed,
            _dropTarget,
            _isNew,
            _justMoved,
            _childCount,
            count,
            ...cleanData
          } = rest.data || {};
          return { ...rest, data: cleanData };
        });
        latestRuntimeCaptureGraph(
          {
            nodes: cleanNodes as Node[],
            edges: (Array.isArray(rtEdges) ? rtEdges : []) as Edge[],
            extensions: ext,
          },
          { reason: 'draft' }
        );
      }
    }, 1500);
  }, [getViewport]);

  useEffect(() => {
    return () => {
      if (viewportSaveTimerRef.current) clearTimeout(viewportSaveTimerRef.current);
    };
  }, []);

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
    saveViewportOnly,
    localVersionRef,
  };
}
