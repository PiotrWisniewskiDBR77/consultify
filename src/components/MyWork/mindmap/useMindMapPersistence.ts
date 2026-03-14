/**
 * useMindMapPersistence — Extracted hydrate/save logic for the Mind Map.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import type { Edge, Node } from 'reactflow';

import { Api } from '@/services/api';

import type { CanvasToolType } from '../ideaSelectionTypes';
import type { IdeaMapSyncState } from '../canvas/useIdeaMapSync';
import { normalizeMindMapNodes } from './mindMapNodeModel';

type PersistenceStatus = 'online' | 'no_route' | 'missing_table' | 'offline';

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
  return { nodes: [rootNode], edges: [] };
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
  const runtimeVersion = externalRuntime?.version ?? null;
  const runtimeLoading = externalRuntime?.loading ?? false;
  const runtimeSaving = externalRuntime?.saving ?? false;
  const runtimeLastSavedAt = externalRuntime?.lastSavedAt ?? null;
  const runtimeSyncState = externalRuntime?.syncState ?? null;
  const runtimeNodes = externalRuntime?.nodes ?? null;
  const runtimeEdges = externalRuntime?.edges ?? null;
  const runtimeExtensions = externalRuntime?.extensions ?? null;
  const runtimeCaptureGraph = externalRuntime?.captureGraph;

  useEffect(() => {
    if (runtimeVersion === null) return;
    setLoading(runtimeLoading);
    setSaving(runtimeSaving);
    setLastSavedAt(runtimeLastSavedAt);
    setPersistence(runtimeSyncState === 'offline' ? 'offline' : 'online');
  }, [runtimeLastSavedAt, runtimeLoading, runtimeSaving, runtimeSyncState, runtimeVersion]);

  const hydrate = useCallback(async () => {
    if (externalRuntime) {
      const nextNodes = Array.isArray(runtimeNodes) ? runtimeNodes : [];
      const nextEdges = Array.isArray(runtimeEdges) ? runtimeEdges : [];
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
      isHydratingRef.current = true;
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
      isHydratingRef.current = true;
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
    setNodes((prev: Node[]) =>
      (prev || []).map((n: any) => {
        if (String(n?.id) !== 'root') return n;
        return {
          ...n,
          data: {
            ...(n.data || {}),
            label,
            hint: isPolish ? 'Kliknij, aby edytować' : 'Click to edit',
          },
        };
      })
    );
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
      if (locked) return;
      if (externalRuntime) {
        const currentViewport = getViewport();
        onViewportReport?.(currentViewport);
        const ext = {
          ...(extensions || {}),
          mindmap: {
            ...((extensions as any)?.mindmap || {}),
            viewState: {
              collapsedNodeIds: Array.from(collapsedNodeIds),
              viewport: currentViewport,
            },
          },
        };
        const cleanNodes = nextNodes.map((n: any) => {
          if (!n.data?._interactionMode && !n.data?._canAddSibling) return n;
          const { _interactionMode, _canAddSibling, ...cleanData } = n.data || {};
          return { ...n, data: cleanData };
        });
        runtimeCaptureGraph?.(
          {
            nodes: cleanNodes as Node[],
            edges: nextEdges,
            extensions: ext,
          },
          { reason: 'draft' }
        );
        return;
      }
      if (persistence !== 'online') return;
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = window.setTimeout(async () => {
        setSaving(true);
        try {
          const currentViewport = getViewport();
          onViewportReport?.(currentViewport);
          const ext = {
            ...(extensions || {}),
            mindmap: {
              ...((extensions as any)?.mindmap || {}),
              viewState: {
                collapsedNodeIds: Array.from(collapsedNodeIds),
                viewport: currentViewport,
              },
            },
          };
          const cleanNodes = nextNodes.map((n: any) => {
            if (!n.data?._interactionMode && !n.data?._canAddSibling) return n;
            const { _interactionMode, _canAddSibling, ...cleanData } = n.data || {};
            return { ...n, data: cleanData };
          });
          await Api.saveMyIdeaMap(ideaId, {
            nodes: cleanNodes,
            edges: nextEdges,
            preferredTool: preferredTool || undefined,
            extensions: ext,
          });
          setLastSavedAt(Date.now());
        } catch (err: any) {
          toast.error(
            err?.message || (isPolish ? 'Nie udało się zapisać mapy' : 'Failed to save map')
          );
        } finally {
          setSaving(false);
        }
      }, 700);
    },
    [
      collapsedNodeIds,
      extensions,
      getViewport,
      ideaId,
      isPolish,
      locked,
      onViewportReport,
      persistence,
      preferredTool,
      runtimeCaptureGraph,
    ]
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
  };
}
