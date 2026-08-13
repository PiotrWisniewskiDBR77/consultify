/**
 * D2 — Mind Map silently rendering an empty/starter skeleton when GET /map
 * fails, instead of an explicit, accessible error state.
 *
 * Root cause (confirmed by reading the real production wiring):
 *   - `IdeaMapWorkspace.tsx` (the ONLY production caller of
 *     `IdeaRecommendationMap`) mounts `useWorkspaceGraphRuntime`
 *     (canvas/workspaceGraphRuntime.ts) and threads its state through the
 *     `externalRuntime` prop into `useMindMapPersistence` (this file's
 *     subject) and `IdeaRecommendationMap`.
 *   - `useWorkspaceGraphRuntime.refresh()` used to have NO catch clause
 *     around `Api.getMyIdeaMap(...)`. On failure, `loading` still flipped
 *     back to false (via `finally`), but `graph` stayed at its untouched
 *     initial `{ nodes: [], edges: [], version: 1 }` — indistinguishable
 *     from a genuinely brand-new, never-saved idea.
 *   - `useMindMapPersistence.hydrate()`'s `externalRuntime` branch treats
 *     that exact shape (`version <= 1`, zero nodes/edges) as "brand-new
 *     idea" via `shouldBootstrapStarterGraph()`, and used to unconditionally
 *     build the 6-node starter template (`buildLocalDefaultIdeaMap`), render
 *     it via `setNodes`/`setEdges`, AND persist it back to the server via
 *     `externalRuntime.captureGraph(...)` — a false "success" on top of a
 *     real fetch failure, with no error shown anywhere (fixed 2026-08-12,
 *     D2).
 *
 * Fix: `workspaceGraphRuntime.refresh()` now records the failure in a new
 * `loadError` field (threaded through `externalRuntime.loadError`).
 * `hydrate()` checks it: when the load failed AND there is no real graph to
 * fall back on, it sets `mapLoadError` (new hook return value, consumed by
 * `IdeaRecommendationMap` to render an explicit `role="alert"` banner with a
 * retry button instead of the canvas) and does NOT build or persist the fake
 * starter template. `retryLoadMap()` calls `externalRuntime.refresh()` — the
 * real GET /map — not just a stale re-hydrate of already-failed data.
 */
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/api', () => ({
  Api: {
    getMyIdeaMap: vi.fn(),
    syncMyIdeaMap: vi.fn(),
  },
}));

vi.mock('react-hot-toast', () => ({
  default: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));

import { useMindMapPersistence } from '@/components/MyWork/mindmap/useMindMapPersistence';

function makeExternalRuntime(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    version: 1,
    loading: false,
    loadError: null as string | null,
    saving: false,
    lastSavedAt: null,
    syncState: 'idle' as const,
    nodes: [] as any[],
    edges: [] as any[],
    extensions: {},
    captureGraph: vi.fn(),
    flushGraph: vi.fn().mockResolvedValue(undefined),
    refresh: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function renderPersistence(externalRuntime: ReturnType<typeof makeExternalRuntime>) {
  const setNodes = vi.fn();
  const setEdges = vi.fn();
  const hook = renderHook(() =>
    useMindMapPersistence({
      ideaId: 'idea-d2-load-error',
      ideaTitle: 'Test idea',
      isPolish: false,
      locked: false,
      i18nLanguage: 'en',
      nodes: [],
      edges: [],
      setNodes: setNodes as any,
      setEdges: setEdges as any,
      setCollapsedNodeIds: vi.fn() as any,
      collapsedNodeIds: new Set(),
      fitView: vi.fn(),
      setViewport: vi.fn(),
      getViewport: () => ({ x: 0, y: 0, zoom: 1 }),
      clearUndoHistory: vi.fn(),
      externalRuntime: externalRuntime as any,
    })
  );
  return { ...hook, setNodes, setEdges };
}

describe('useMindMapPersistence — D2 map load error (workspace runtime path)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('a failed load with no real data does NOT render/persist the fake starter skeleton, and reports mapLoadError', async () => {
    const externalRuntime = makeExternalRuntime({ loadError: 'network error' });
    const { result, setNodes, setEdges } = renderPersistence(externalRuntime);

    await act(async () => {
      await result.current.hydrate();
    });

    // (b) NIE renderuje się pusty szkielet jako stan normalny: `hydrate()`
    // must never build the 6-node starter template and push it into
    // ReactFlow state as if it were the real map. A separate, unrelated
    // effect (keeping the root node's label in sync with `ideaTitle`) always
    // calls `setNodes` with an UPDATER FUNCTION on mount regardless of
    // hydrate — that's harmless (a no-op over an empty array) and not what
    // this assertion is about, so check specifically for hydrate's own call
    // shape: `setNodes(<plain node array>)`.
    const arrayNodeCalls = setNodes.mock.calls.filter(([arg]) => Array.isArray(arg));
    expect(arrayNodeCalls).toHaveLength(0);
    const arrayEdgeCalls = setEdges.mock.calls.filter(([arg]) => Array.isArray(arg));
    expect(arrayEdgeCalls).toHaveLength(0);
    // ...and, critically, it must never be captured/persisted back to the
    // server either — a failed GET must not masquerade as a saved graph.
    expect(externalRuntime.captureGraph).not.toHaveBeenCalled();

    // (a) pojawia się komunikat błędu: the hook surfaces an explicit error
    // the component renders instead of the canvas.
    expect(result.current.mapLoadError).toBe('network error');
  });

  it('retryLoadMap() re-runs the real GET /map (externalRuntime.refresh), not a no-op re-hydrate of the same failed state', async () => {
    const externalRuntime = makeExternalRuntime({ loadError: 'network error' });
    const { result } = renderPersistence(externalRuntime);

    await act(async () => {
      await result.current.hydrate();
    });
    expect(result.current.mapLoadError).toBe('network error');

    // (c) retry wywołuje ponowne pobranie.
    await act(async () => {
      await result.current.retryLoadMap();
    });
    expect(externalRuntime.refresh).toHaveBeenCalledTimes(1);
  });

  it('control: a genuinely new idea (no load error) still gets the normal starter template — the fix does not break legitimate bootstrap', async () => {
    const externalRuntime = makeExternalRuntime({ loadError: null });
    const { result, setNodes, setEdges } = renderPersistence(externalRuntime);

    await act(async () => {
      await result.current.hydrate();
    });

    expect(setNodes).toHaveBeenCalled();
    expect(setEdges).toHaveBeenCalled();
    expect(result.current.mapLoadError).toBeNull();
  });
});
