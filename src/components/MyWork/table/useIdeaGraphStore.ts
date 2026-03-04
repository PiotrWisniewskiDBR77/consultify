/**
 * useIdeaGraphStore — Shared reactive state for the Idea Workspace graph.
 *
 * All canvas tools (MindMap, Table, ProcessFlow, Whiteboard) can read/write
 * through this store. Changes are immediately visible when switching tools
 * without re-fetching from the server.
 *
 * Uses a simple event-based approach (CustomEvent) since the tools are siblings
 * rendered by IdeaMapWorkspace and don't share React context directly.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import { Api } from '@/services/api';

interface GraphState {
  nodes: any[];
  edges: any[];
  extensions: Record<string, unknown>;
  preferredTool?: string;
  lastUpdatedBy?: string;
  lastUpdatedAt?: number;
}

const GRAPH_UPDATE_EVENT = 'idea-graph-updated';
const GRAPH_SAVE_EVENT = 'idea-graph-save-requested';

let sharedCache: Record<string, GraphState> = {};

export function useIdeaGraphStore(ideaId: string, toolName: string) {
  const [state, setState] = useState<GraphState | null>(sharedCache[ideaId] || null);
  const [loading, setLoading] = useState(false);
  const toolNameRef = useRef(toolName);
  toolNameRef.current = toolName;

  const load = useCallback(async (language: string) => {
    if (sharedCache[ideaId]) {
      setState(sharedCache[ideaId]);
      return sharedCache[ideaId];
    }

    setLoading(true);
    try {
      const res = await Api.getMyIdeaMap(ideaId, { language });
      const map = res?.map || {};
      const graphState: GraphState = {
        nodes: Array.isArray(map.nodes) ? map.nodes : [],
        edges: Array.isArray(map.edges) ? map.edges : [],
        extensions: map?.extensions && typeof map.extensions === 'object' ? map.extensions as Record<string, unknown> : {},
        preferredTool: map?.preferredTool ? String(map.preferredTool) : undefined,
        lastUpdatedAt: Date.now(),
      };
      sharedCache[ideaId] = graphState;
      setState(graphState);

      window.dispatchEvent(new CustomEvent(GRAPH_UPDATE_EVENT, {
        detail: { ideaId, state: graphState, source: toolNameRef.current },
      }));

      return graphState;
    } catch (err) {
      console.error('[useIdeaGraphStore] load failed:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, [ideaId]);

  const update = useCallback((partial: Partial<GraphState>) => {
    const current = sharedCache[ideaId] || { nodes: [], edges: [], extensions: {} };
    const next: GraphState = {
      ...current,
      ...partial,
      lastUpdatedBy: toolNameRef.current,
      lastUpdatedAt: Date.now(),
    };
    sharedCache[ideaId] = next;
    setState(next);

    window.dispatchEvent(new CustomEvent(GRAPH_UPDATE_EVENT, {
      detail: { ideaId, state: next, source: toolNameRef.current },
    }));
  }, [ideaId]);

  const save = useCallback(async () => {
    const current = sharedCache[ideaId];
    if (!current) return;

    try {
      await Api.saveMyIdeaMap(ideaId, {
        nodes: current.nodes as any,
        edges: current.edges as any,
        extensions: current.extensions,
        preferredTool: current.preferredTool,
      });

      window.dispatchEvent(new CustomEvent(GRAPH_SAVE_EVENT, {
        detail: { ideaId, source: toolNameRef.current },
      }));
    } catch (err) {
      console.error('[useIdeaGraphStore] save failed:', err);
      throw err;
    }
  }, [ideaId]);

  const invalidate = useCallback(() => {
    delete sharedCache[ideaId];
    setState(null);
  }, [ideaId]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.ideaId !== ideaId) return;
      if (detail?.source === toolNameRef.current) return;
      setState(detail.state);
    };

    window.addEventListener(GRAPH_UPDATE_EVENT, handler);
    return () => window.removeEventListener(GRAPH_UPDATE_EVENT, handler);
  }, [ideaId]);

  return {
    state,
    loading,
    load,
    update,
    save,
    invalidate,
  };
}

export function clearIdeaGraphCache(ideaId?: string) {
  if (ideaId) {
    delete sharedCache[ideaId];
  } else {
    sharedCache = {};
  }
}
