/**
 * @vitest-environment jsdom
 *
 * P0 regression — Process Flow toolbar "add shape" node never reached
 * POST /api/my-work/my-ideas/:id/map/sync (data loss on reload). Autosave
 * (not Ctrl+S/manual save) is the affected path — a manual flush rebuilds its
 * payload straight from the live graph state, so it happens to still send the
 * node even under the buggy wiring; only the debounced autosave depends on
 * something having actually been queued via queueSync().
 *
 * Root cause (file:line):
 *   src/components/MyWork/IdeaMapWorkspace.tsx:2969 (pre-fix) passed
 *   `onGraphChange={replaceRuntimeGraph}` to <IdeaProcessFlowTool>. That prop
 *   fires an effect inside IdeaProcessFlowTool (IdeaProcessFlowTool.tsx:349-363,
 *   declared BEFORE the autosave effect at :1856-1871) that calls
 *   graphRuntime.replaceGraph(...) with the tool's CURRENT nodes/edges on every
 *   change — including a toolbar addNode() call. replaceGraph is a plain
 *   setGraph() with no queueSync side effect
 *   (src/components/MyWork/canvas/workspaceGraphRuntime.ts:263-286).
 *
 *   Process Flow ALSO persists itself THROUGH the same shared runtime via
 *   externalRuntime.captureGraph = graphRuntime.captureToolGraph
 *   (IdeaMapWorkspace.tsx:2986), which dedupes against the runtime's current
 *   `prev` graph before calling queueSync
 *   (workspaceGraphRuntime.ts:342-347: if serialize(prev) === serialize(merged)
 *   return prev — i.e. SKIP queueSync).
 *
 *   Because the onGraphChange-triggered replaceGraph() effect commits first
 *   (React flushes a component's passive effects in declaration order — the
 *   onGraphChange effect at :349 is declared before the autosave effect at
 *   :1856) and already writes the new node into the runtime's `graph` state,
 *   captureToolGraph's `prev` already matches `merged` by the time it runs —
 *   so its dedup guard swallows queueSync, and the added node is NEVER queued
 *   for the debounced autosave. It exists in local ReactFlow state and in
 *   graphRuntime.graph (so the canvas visually shows it and other readers like
 *   node-count/ghost-cards see it), but the autosave timer that would normally
 *   POST it to the server fires with nothing queued. A reload re-fetches the
 *   server graph, which never received it.
 *
 * Fix: IdeaMapWorkspace no longer passes onGraphChange to IdeaProcessFlowTool
 * (Table/Whiteboard keep it — they own persistence via the legacy per-tool
 * useIdeaMapSync fallback, so mirroring into the runtime is a harmless,
 * non-authoritative side channel for them).
 *
 * This test exercises the REAL useWorkspaceGraphRuntime (not a mock) and
 * reproduces the effect sequence an "add shape" toolbar click used to
 * trigger, then advances real autosave timers to observe whether
 * Api.syncMyIdeaMap actually fires.
 */
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const getMyIdeaMap = vi.fn();
const syncMyIdeaMap = vi.fn().mockResolvedValue({ version: 2 });

vi.mock('@/services/api', () => ({
  Api: {
    getMyIdeaMap: (...a: unknown[]) => getMyIdeaMap(...a),
    syncMyIdeaMap: (...a: unknown[]) => syncMyIdeaMap(...a),
    createMyIdeaMapSnapshot: vi.fn().mockResolvedValue(null),
  },
}));

import { useWorkspaceGraphRuntime } from '@/components/MyWork/canvas/workspaceGraphRuntime';

describe('Process Flow toolbar add-node -> /map/sync (P0 data-loss regression)', () => {
  beforeEach(() => {
    getMyIdeaMap.mockReset();
    syncMyIdeaMap.mockReset().mockResolvedValue({ version: 2 });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('autosave (debounced, no explicit save) sends a node added via addNode() when only captureGraph runs — fixed wiring', async () => {
    getMyIdeaMap.mockResolvedValue({
      map: {
        nodes: [{ id: 'root', type: 'flowNode', position: { x: 0, y: 0 }, data: { shape: 'start' } }],
        edges: [],
        extensions: {},
        version: 1,
      },
    });

    const { result } = renderHook(() =>
      useWorkspaceGraphRuntime({
        ideaId: 'idea-pf-race',
        open: true,
        preferredTool: 'process_flow' as any,
        language: 'en',
      })
    );

    // Settle initial hydrate.
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(result.current.graph.nodes.map((n: any) => n.id)).toEqual(['root']);

    // Simulate IdeaProcessFlowTool.addNode(): local ReactFlow state gains a new
    // node, which is the ONLY thing the fixed IdeaMapWorkspace wiring forwards
    // to the runtime — via captureGraph (== captureToolGraph), never
    // replaceGraph. (Table/Whiteboard still call replaceGraph for their own
    // mirror-only purposes; Process Flow must not, since it also captures.)
    const newNode = {
      id: 'pf-toolbar-added-node',
      type: 'flowNode',
      position: { x: 100, y: 60 },
      data: { shape: 'action', label: 'Task' },
    };
    const nextNodes = [...result.current.graph.nodes, newNode];

    act(() => {
      result.current.captureToolGraph(
        { nodes: nextNodes as any, edges: result.current.graph.edges as any },
        { reason: 'draft' }
      );
    });

    // The runtime's own state must include the new node (canvas would show it).
    expect(result.current.graph.nodes.map((n: any) => n.id)).toEqual([
      'root',
      'pf-toolbar-added-node',
    ]);

    // Let the REAL autosave debounce (queueSync's syncTimerRef, idleMs=2500ms
    // window.setTimeout) fire naturally — this is what a reload-without-Ctrl+S
    // depends on. No explicit flushGraph()/handleSave() call: a manual flush
    // rebuilds its payload straight from live graph state and would mask this
    // bug (see the sibling "does NOT" test below for the same manual-flush
    // path). Only the debounced path depends on captureToolGraph having
    // actually called queueSync().
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    // The critical assertion: the new node MUST have reached the debounced
    // autosave's server sync call. Under the pre-fix wiring (replaceGraph
    // mirror firing first and pre-syncing the runtime's `prev` graph to
    // already match `merged`), captureToolGraph's dedup guard swallows
    // queueSync entirely, so queuedPayloadRef stays null and the autosave
    // timer's flushNow(null, ...) no-ops WITHOUT ever calling
    // Api.syncMyIdeaMap — this assertion would fail in that scenario.
    expect(syncMyIdeaMap).toHaveBeenCalled();
    const sentNodeIds = (syncMyIdeaMap.mock.calls[0][1].nodes as any[]).map((n) => n.id);
    expect(sentNodeIds).toContain('pf-toolbar-added-node');
    expect(sentNodeIds).toEqual(['root', 'pf-toolbar-added-node']);
  });

  it('demonstrates the bug mechanism: a replaceGraph() mirror committed BEFORE captureToolGraph() with the same data suppresses queueSync, so autosave never fires (dedup false-positive)', async () => {
    getMyIdeaMap.mockResolvedValue({
      map: {
        nodes: [{ id: 'root', type: 'flowNode', position: { x: 0, y: 0 }, data: { shape: 'start' } }],
        edges: [],
        extensions: {},
        version: 1,
      },
    });

    const { result } = renderHook(() =>
      useWorkspaceGraphRuntime({
        ideaId: 'idea-pf-race-2',
        open: true,
        preferredTool: 'process_flow' as any,
        language: 'en',
      })
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const newNode = {
      id: 'pf-toolbar-added-node-2',
      type: 'flowNode',
      position: { x: 100, y: 60 },
      data: { shape: 'action', label: 'Task' },
    };
    const nextNodes = [...result.current.graph.nodes, newNode];

    // Reproduce the OLD wiring's effect order within IdeaProcessFlowTool: the
    // onGraphChange effect (replaceGraph, IdeaProcessFlowTool.tsx:349-363) is
    // declared BEFORE the autosave effect (captureGraph, :1856-1871). React
    // flushes passive effects for a component in declaration order, committing
    // each setState before the next effect runs — so replaceGraph's setGraph
    // is fully committed (prev updated) before captureToolGraph's setGraph
    // updater executes. Two separate act() calls model that commit boundary
    // (a single act() batches both updater calls before either commits, which
    // does not reproduce the real effect-then-effect sequencing).
    act(() => {
      result.current.replaceGraph({
        nodes: nextNodes as any,
        edges: result.current.graph.edges as any,
      });
    });
    act(() => {
      result.current.captureToolGraph(
        { nodes: nextNodes as any, edges: result.current.graph.edges as any },
        { reason: 'draft' }
      );
    });

    // Canvas still shows the node (local/mirrored state has it) ...
    expect(result.current.graph.nodes.map((n: any) => n.id)).toEqual([
      'root',
      'pf-toolbar-added-node-2',
    ]);

    // ... but the debounced autosave that would normally persist it never
    // fires a sync call, because captureToolGraph's dedup guard saw the
    // runtime already matching (via replaceGraph) and skipped queueSync.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(syncMyIdeaMap).not.toHaveBeenCalled();
  });
});
