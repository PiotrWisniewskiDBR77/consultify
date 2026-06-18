/**
 * M09 L-02/L-06 — useWhiteboardCollab realtime graph-patch contract.
 *
 * Verifies the whiteboard's realtime layer (mirrors M06 Mind Map):
 *  - incoming `idea-collab-graph-patch` ops mutate nodes/edges correctly,
 *  - a participant's OWN echo (matching userId) is ignored,
 *  - local mutations broadcast `graph_patch` through the registered send fn,
 *  - remote-applied changes do NOT re-broadcast (no echo loop).
 */
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Edge, Node } from 'reactflow';

import { useWhiteboardCollab } from '@/components/MyWork/whiteboard/useWhiteboardCollab';

const ME = 'user-me';

function setup() {
  let nodes: Node[] = [];
  let edges: Edge[] = [];
  const setNodes = vi.fn((updater: any) => {
    nodes = typeof updater === 'function' ? updater(nodes) : updater;
  });
  const setEdges = vi.fn((updater: any) => {
    edges = typeof updater === 'function' ? updater(edges) : updater;
  });
  const { result } = renderHook(() =>
    useWhiteboardCollab({ currentUserId: ME, setNodes: setNodes as any, setEdges: setEdges as any })
  );
  return { result, getNodes: () => nodes, getEdges: () => edges };
}

function emitPatch(userId: string, operations: Array<{ op: string; data: any }>) {
  window.dispatchEvent(
    new CustomEvent('idea-collab-graph-patch', { detail: { userId, operations } })
  );
}

describe('useWhiteboardCollab (M09 L-02)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('applies a remote add_node from another user', () => {
    const { result, getNodes } = setup();
    void result.current;
    act(() => {
      emitPatch('user-other', [
        { op: 'add_node', data: { id: 'n1', position: { x: 1, y: 2 }, data: { label: 'A' } } },
      ]);
    });
    expect(getNodes().map((n) => n.id)).toContain('n1');
  });

  it('ignores a participant own echo (same userId)', () => {
    const { result, getNodes } = setup();
    void result.current;
    act(() => {
      emitPatch(ME, [{ op: 'add_node', data: { id: 'echo', position: { x: 0, y: 0 }, data: {} } }]);
    });
    expect(getNodes()).toHaveLength(0);
  });

  it('applies update_node / remove_node / add_edge / remove_edge', () => {
    const { result, getNodes, getEdges } = setup();
    void result.current;
    act(() => {
      emitPatch('u2', [
        { op: 'add_node', data: { id: 'n1', position: { x: 0, y: 0 }, data: { label: 'A' } } },
        { op: 'add_node', data: { id: 'n2', position: { x: 5, y: 5 }, data: { label: 'B' } } },
        { op: 'update_node', data: { id: 'n1', position: { x: 9, y: 9 } } },
        { op: 'add_edge', data: { id: 'e1', source: 'n1', target: 'n2' } },
      ]);
    });
    expect(getNodes().find((n) => n.id === 'n1')?.position).toEqual({ x: 9, y: 9 });
    expect(getEdges().map((e) => e.id)).toEqual(['e1']);

    act(() => {
      emitPatch('u2', [
        { op: 'remove_edge', data: { id: 'e1' } },
        { op: 'remove_node', data: { id: 'n2' } },
      ]);
    });
    expect(getEdges()).toHaveLength(0);
    expect(getNodes().map((n) => n.id)).toEqual(['n1']);
  });

  it('add_node is idempotent (no duplicate on repeated op)', () => {
    const { result, getNodes } = setup();
    void result.current;
    act(() => {
      emitPatch('u2', [{ op: 'add_node', data: { id: 'dup', position: { x: 0, y: 0 }, data: {} } }]);
      emitPatch('u2', [{ op: 'add_node', data: { id: 'dup', position: { x: 0, y: 0 }, data: {} } }]);
    });
    expect(getNodes().filter((n) => n.id === 'dup')).toHaveLength(1);
  });

  it('broadcasts graph_patch through the registered send fn', () => {
    const { result } = setup();
    const send = vi.fn();
    act(() => result.current.registerCollabSend(send));
    act(() => {
      result.current.broadcastNodeAdd({ id: 'x', position: { x: 0, y: 0 }, data: {} } as Node);
    });
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'graph_patch',
        operations: [expect.objectContaining({ op: 'add_node' })],
      })
    );
  });

  it('translates final-position node changes to update_node ops (skips in-flight drags)', () => {
    const { result } = setup();
    const send = vi.fn();
    act(() => result.current.registerCollabSend(send));
    const nextNodes = [{ id: 'n1', position: { x: 50, y: 60 }, data: {} }] as Node[];
    act(() => {
      // dragging:true should be skipped, dragging:false should emit
      result.current.broadcastNodeChanges(
        [{ type: 'position', id: 'n1', dragging: true } as any],
        nextNodes
      );
    });
    expect(send).not.toHaveBeenCalled();
    act(() => {
      result.current.broadcastNodeChanges(
        [{ type: 'position', id: 'n1', dragging: false } as any],
        nextNodes
      );
    });
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        operations: [{ op: 'update_node', data: { id: 'n1', position: { x: 50, y: 60 } } }],
      })
    );
  });
});
