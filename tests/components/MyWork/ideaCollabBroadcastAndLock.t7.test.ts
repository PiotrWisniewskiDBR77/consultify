/**
 * @vitest-environment jsdom
 *
 * DP-3 (T7) — Part A (broadcast on local edit) + Part B (lock-UI) contract.
 *
 * Part A background: IdeaRecommendationMap defined `broadcastGraphPatch` (via
 * useIdeaCollab) but never called it — local mind-map edits never reached
 * collaborators. T7 wires useMindMapNodes' CRUD ops (addChildNode,
 * addSiblingNode, deleteSelected, duplicateSelected, reparentNode,
 * moveBetweenSiblings, pasteNodes, addRootTopic, cutSelected) to call the
 * shared broadcast() so peers see them live, while remote-applied patches
 * (applyingRemoteRef held by useIdeaCollab) must NOT be re-broadcast (no
 * echo/loop).
 *
 * Part B: nodes locked by another collaborator (remoteLockedNodeIds, driven
 * by CollaborationOverlay's session_state) must be visually greyed out and
 * blocked from entering the inline text editor — mirrored here via the same
 * `_remoteLocked` data flag IdeaRecommendationMap injects into enrichedNodes.
 */
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useIdeaCollab } from '@/components/MyWork/canvas/useIdeaCollab';
import { useMindMapNodes } from '@/components/MyWork/mindmap/useMindMapNodes';

function makeStatefulNodesEdges(initialNodes: any[] = [], initialEdges: any[] = []) {
  let nodes = initialNodes;
  let edges = initialEdges;
  const setNodes = vi.fn((updater: any) => {
    nodes = typeof updater === 'function' ? updater(nodes) : updater;
  });
  const setEdges = vi.fn((updater: any) => {
    edges = typeof updater === 'function' ? updater(edges) : updater;
  });
  return {
    get nodes() {
      return nodes;
    },
    get edges() {
      return edges;
    },
    setNodes,
    setEdges,
  };
}

function emitRemotePatch(operations: Array<{ op: string; data: any }>, ideaId = 'idea-1') {
  window.dispatchEvent(
    new CustomEvent('idea-collab-graph-patch', {
      detail: { userId: 'peer', operations, ideaId },
    })
  );
}

describe('DP-3 T7 Part A — useMindMapNodes broadcasts local CRUD via useIdeaCollab', () => {
  it('addChildNode emits add_node + add_edge ops over the wire', () => {
    const store = makeStatefulNodesEdges([
      { id: 'root', type: 'center', selected: false, position: { x: 0, y: 0 }, data: {} },
      {
        id: 'branch-options',
        type: 'branch',
        selected: true,
        position: { x: 100, y: 0 },
        data: { branchKey: 'options' },
      },
    ]);
    const send = vi.fn();

    const { result: collabResult } = renderHook(() =>
      useIdeaCollab({
        ideaId: 'idea-1',
        tool: 'mindmap',
        currentUserId: 'me',
        setNodes: store.setNodes,
        setEdges: store.setEdges,
      })
    );
    act(() => collabResult.current.registerCollabSend(send));

    const { result: nodesResult } = renderHook(() =>
      useMindMapNodes({
        nodes: store.nodes,
        edges: store.edges,
        setNodes: store.setNodes,
        setEdges: store.setEdges,
        locked: false,
        isPolish: false,
        pushUndo: vi.fn(),
        fitView: vi.fn(),
        remoteLockedNodeIds: new Set(),
        broadcastGraphPatch: collabResult.current.broadcastGraphPatch,
      })
    );

    act(() => {
      nodesResult.current.addChildNode('branch-options');
    });

    expect(send).toHaveBeenCalledTimes(1);
    const payload = send.mock.calls[0][0];
    expect(payload.type).toBe('graph_patch');
    const ops = payload.operations.map((o: any) => o.op);
    expect(ops).toEqual(['add_node', 'add_edge']);
  });

  it('deleteSelected emits remove_node + remove_edge ops', () => {
    const store = makeStatefulNodesEdges(
      [
        { id: 'root', type: 'center', selected: false, position: { x: 0, y: 0 }, data: {} },
        {
          id: 'node-a',
          type: 'idea',
          selected: true,
          position: { x: 100, y: 0 },
          data: { branchKey: 'options' },
        },
      ],
      [{ id: 'edge-1', source: 'root', target: 'node-a', data: { edgeRole: 'structural' } }]
    );
    const send = vi.fn();
    const { result: collabResult } = renderHook(() =>
      useIdeaCollab({
        ideaId: 'idea-1',
        tool: 'mindmap',
        currentUserId: 'me',
        setNodes: store.setNodes,
        setEdges: store.setEdges,
      })
    );
    act(() => collabResult.current.registerCollabSend(send));

    const { result: nodesResult } = renderHook(() =>
      useMindMapNodes({
        nodes: store.nodes,
        edges: store.edges,
        setNodes: store.setNodes,
        setEdges: store.setEdges,
        locked: false,
        isPolish: false,
        pushUndo: vi.fn(),
        fitView: vi.fn(),
        remoteLockedNodeIds: new Set(),
        broadcastGraphPatch: collabResult.current.broadcastGraphPatch,
      })
    );

    act(() => {
      nodesResult.current.deleteSelected({ confirmed: true });
    });

    expect(send).toHaveBeenCalledTimes(1);
    const ops = send.mock.calls[0][0].operations.map((o: any) => o.op);
    expect(ops.sort()).toEqual(['remove_edge', 'remove_node']);
  });

  it('does NOT re-broadcast a remote-applied patch (no echo/loop)', () => {
    const store = makeStatefulNodesEdges([
      { id: 'root', type: 'center', selected: false, position: { x: 0, y: 0 }, data: {} },
    ]);
    const send = vi.fn();
    const { result: collabResult } = renderHook(() =>
      useIdeaCollab({
        ideaId: 'idea-1',
        tool: 'mindmap',
        currentUserId: 'me',
        setNodes: store.setNodes,
        setEdges: store.setEdges,
      })
    );
    act(() => collabResult.current.registerCollabSend(send));

    // Simulate a remote patch arriving (applyingRemoteRef held during apply).
    act(() => {
      emitRemotePatch([{ op: 'add_node', data: { id: 'remote-node', position: { x: 1, y: 1 } } }]);
      // A broadcast attempted WHILE the remote patch is being applied must be
      // swallowed by the applyingRemoteRef guard inside useIdeaCollab.
      collabResult.current.broadcastGraphPatch([
        { op: 'add_node', data: { id: 'remote-node', position: { x: 1, y: 1 } } },
      ]);
    });
    expect(send).not.toHaveBeenCalled();
  });

  it('broadcast is a safe no-op when the collaboration hook is not wired (flag/off path)', () => {
    const store = makeStatefulNodesEdges([
      { id: 'root', type: 'center', selected: false, position: { x: 0, y: 0 } },
      {
        id: 'branch-options',
        type: 'branch',
        selected: true,
        position: { x: 100, y: 0 },
        data: { branchKey: 'options' },
      },
    ]);
    const { result } = renderHook(() =>
      useMindMapNodes({
        nodes: store.nodes,
        edges: store.edges,
        setNodes: store.setNodes,
        setEdges: store.setEdges,
        locked: false,
        isPolish: false,
        pushUndo: vi.fn(),
        fitView: vi.fn(),
        remoteLockedNodeIds: new Set(),
        // no broadcastGraphPatch passed at all
      })
    );
    expect(() => {
      act(() => {
        result.current.addChildNode('branch-options');
      });
    }).not.toThrow();
  });
});

describe('DP-3 T7 Part B — lock-UI: remote-locked node data flag', () => {
  it('isNodeLockedByPeer reports true for ids present in remoteLockedNodeIds', () => {
    const store = makeStatefulNodesEdges([
      { id: 'node-a', type: 'idea', selected: false, position: { x: 0, y: 0 }, data: {} },
    ]);
    const { result } = renderHook(() =>
      useMindMapNodes({
        nodes: store.nodes,
        edges: store.edges,
        setNodes: store.setNodes,
        setEdges: store.setEdges,
        locked: false,
        isPolish: false,
        pushUndo: vi.fn(),
        fitView: vi.fn(),
        remoteLockedNodeIds: new Set(['node-a']),
      })
    );
    expect(result.current.isNodeLockedByPeer('node-a')).toBe(true);
    expect(result.current.isNodeLockedByPeer('node-b')).toBe(false);
  });

  it('isReparentable returns false for a remote-locked node (drag/reparent blocked)', () => {
    const store = makeStatefulNodesEdges([
      { id: 'node-a', type: 'idea', selected: false, position: { x: 0, y: 0 }, data: {} },
    ]);
    const { result } = renderHook(() =>
      useMindMapNodes({
        nodes: store.nodes,
        edges: store.edges,
        setNodes: store.setNodes,
        setEdges: store.setEdges,
        locked: false,
        isPolish: false,
        pushUndo: vi.fn(),
        fitView: vi.fn(),
        remoteLockedNodeIds: new Set(['node-a']),
      })
    );
    expect(result.current.isReparentable('node-a')).toBe(false);
  });

  it('getSelectedNode/getNodeById exclude remote-locked nodes (no stale selection ops)', () => {
    const store = makeStatefulNodesEdges([
      { id: 'node-a', type: 'idea', selected: true, position: { x: 0, y: 0 }, data: {} },
    ]);
    const { result } = renderHook(() =>
      useMindMapNodes({
        nodes: store.nodes,
        edges: store.edges,
        setNodes: store.setNodes,
        setEdges: store.setEdges,
        locked: false,
        isPolish: false,
        pushUndo: vi.fn(),
        fitView: vi.fn(),
        remoteLockedNodeIds: new Set(['node-a']),
      })
    );
    expect(result.current.getSelectedNode()).toBeUndefined();
    expect(result.current.getNodeById('node-a')).toBeUndefined();
  });
});
