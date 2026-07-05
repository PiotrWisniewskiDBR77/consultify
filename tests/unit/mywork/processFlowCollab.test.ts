/**
 * M07 F3 — useProcessFlowCollab realtime edit-sync contract.
 *
 * Mirrors the whiteboard collab test (the only proven E2E model) and adds the
 * Process-Flow extensions:
 *  - incoming graph_patch ops mutate nodes/edges/lanes correctly,
 *  - a participant's OWN echo (matching userId) is ignored,
 *  - add ops are idempotent (dedup by id),
 *  - local mutations broadcast graph_patch through the registered send fn,
 *  - update_lanes replaces the whole Lane[]; lane delete carries node laneId
 *    reassignment in the SAME patch,
 *  - graph_snapshot replaces full state AND fires onRemoteSnapshot (undo step),
 *  - a remote patch flips lastChangeOriginRef to 'remote' (autosave suppression).
 */
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Edge, Node } from 'reactflow';

import {
  type ChangeOrigin,
  useProcessFlowCollab,
} from '@/components/MyWork/processflow/useProcessFlowCollab';
import type { Lane } from '@/components/MyWork/processflow/LaneSystem';

const ME = 'user-me';

function setup(opts?: { onRemoteSnapshot?: (snap: any) => void }) {
  let nodes: Node[] = [];
  let edges: Edge[] = [];
  let lanes: Lane[] = [];
  const originRef = { current: 'local' as ChangeOrigin };
  const setNodes = vi.fn((updater: any) => {
    nodes = typeof updater === 'function' ? updater(nodes) : updater;
  });
  const setEdges = vi.fn((updater: any) => {
    edges = typeof updater === 'function' ? updater(edges) : updater;
  });
  const setLanes = vi.fn((updater: any) => {
    lanes = typeof updater === 'function' ? updater(lanes) : updater;
  });
  const { result } = renderHook(() =>
    useProcessFlowCollab({
      currentUserId: ME,
      setNodes: setNodes as any,
      setEdges: setEdges as any,
      setLanes: setLanes as any,
      lastChangeOriginRef: originRef,
      onRemoteSnapshot: opts?.onRemoteSnapshot,
    })
  );
  return {
    result,
    originRef,
    getNodes: () => nodes,
    getEdges: () => edges,
    getLanes: () => lanes,
  };
}

function emitPatch(userId: string, operations: Array<{ op: string; data: any }>) {
  window.dispatchEvent(
    new CustomEvent('idea-collab-graph-patch', { detail: { userId, operations } })
  );
}

describe('useProcessFlowCollab (M07 F3) — receive', () => {
  beforeEach(() => vi.clearAllMocks());

  it('applies a remote add_node from another user', () => {
    const { getNodes } = setup();
    act(() => {
      emitPatch('u2', [
        { op: 'add_node', data: { id: 'n1', position: { x: 1, y: 2 }, data: { label: 'A' } } },
      ]);
    });
    expect(getNodes().map((n) => n.id)).toContain('n1');
  });

  it('ignores a participant own echo (same userId)', () => {
    const { getNodes } = setup();
    act(() => {
      emitPatch(ME, [{ op: 'add_node', data: { id: 'echo', position: { x: 0, y: 0 }, data: {} } }]);
    });
    expect(getNodes()).toHaveLength(0);
  });

  it('applies update_node / remove_node / add_edge / remove_edge', () => {
    const { getNodes, getEdges } = setup();
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

  it('update_node shallow-merges data without clobbering local callbacks', () => {
    const { getNodes } = setup();
    const localCb = vi.fn();
    act(() => {
      emitPatch('u2', [
        {
          op: 'add_node',
          data: { id: 'n1', position: { x: 0, y: 0 }, data: { label: 'A' } },
        },
      ]);
    });
    // Simulate a local callback that a remote update must not drop.
    getNodes()[0].data.onLabelChange = localCb;
    act(() => {
      emitPatch('u2', [{ op: 'update_node', data: { id: 'n1', data: { label: 'B' } } }]);
    });
    const n1 = getNodes().find((n) => n.id === 'n1')!;
    expect(n1.data.label).toBe('B');
    expect(n1.data.onLabelChange).toBe(localCb);
  });

  it('add_node is idempotent (no duplicate on repeated op)', () => {
    const { getNodes } = setup();
    act(() => {
      emitPatch('u2', [{ op: 'add_node', data: { id: 'dup', position: { x: 0, y: 0 }, data: {} } }]);
      emitPatch('u2', [{ op: 'add_node', data: { id: 'dup', position: { x: 0, y: 0 }, data: {} } }]);
    });
    expect(getNodes().filter((n) => n.id === 'dup')).toHaveLength(1);
  });

  it('update_lanes replaces the whole Lane[]', () => {
    const { getLanes } = setup();
    const newLanes: Lane[] = [
      { id: 'l1', label: 'Sales', color: '#111' },
      { id: 'l2', label: 'Ops', color: '#222' },
    ];
    act(() => {
      emitPatch('u2', [{ op: 'update_lanes', data: { lanes: newLanes } }]);
    });
    expect(getLanes()).toEqual(newLanes);
  });

  it('lane-delete batch: update_lanes + update_node reassigns node laneId', () => {
    const { getNodes, getLanes } = setup();
    act(() => {
      emitPatch('u2', [
        { op: 'add_node', data: { id: 'n1', position: { x: 0, y: 0 }, data: { laneId: 'l2' } } },
      ]);
    });
    const survivingLanes: Lane[] = [{ id: 'l1', label: 'Sales', color: '#111' }];
    act(() => {
      emitPatch('u2', [
        { op: 'update_lanes', data: { lanes: survivingLanes } },
        { op: 'update_node', data: { id: 'n1', data: { laneId: 'l1', laneColor: '#111' } } },
      ]);
    });
    expect(getLanes()).toEqual(survivingLanes);
    expect(getNodes()[0].data.laneId).toBe('l1');
  });

  it('graph_snapshot replaces full state and fires onRemoteSnapshot as one undo step', () => {
    const onRemoteSnapshot = vi.fn();
    const { getNodes, getEdges, getLanes } = setup({ onRemoteSnapshot });
    const snap = {
      nodes: [{ id: 'sn1', position: { x: 0, y: 0 }, data: {} }] as Node[],
      edges: [{ id: 'se1', source: 'sn1', target: 'sn1' }] as Edge[],
      lanes: [{ id: 'sl1', label: 'L', color: '#333' }] as Lane[],
    };
    act(() => {
      emitPatch('u2', [{ op: 'graph_snapshot', data: snap }]);
    });
    expect(onRemoteSnapshot).toHaveBeenCalledTimes(1);
    expect(getNodes().map((n) => n.id)).toEqual(['sn1']);
    expect(getEdges().map((e) => e.id)).toEqual(['se1']);
    expect(getLanes().map((l) => l.id)).toEqual(['sl1']);
  });

  it('a remote patch flips lastChangeOriginRef to "remote" (autosave suppression)', () => {
    const { originRef } = setup();
    expect(originRef.current).toBe('local');
    act(() => {
      emitPatch('u2', [{ op: 'add_node', data: { id: 'n1', position: { x: 0, y: 0 }, data: {} } }]);
    });
    expect(originRef.current).toBe('remote');
  });
});

describe('useProcessFlowCollab (M07 F3) — broadcast', () => {
  beforeEach(() => vi.clearAllMocks());

  it('broadcasts add_node through the registered send fn (data callbacks stripped)', () => {
    const { result } = setup();
    const send = vi.fn();
    act(() => result.current.registerCollabSend(send));
    act(() => {
      result.current.broadcastNodeAdd({
        id: 'x',
        position: { x: 0, y: 0 },
        data: { label: 'L', onLabelChange: () => {} },
      } as any);
    });
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'graph_patch',
        operations: [expect.objectContaining({ op: 'add_node' })],
      })
    );
    const sentNode = send.mock.calls[0][0].operations[0].data;
    expect(sentNode.data.label).toBe('L');
    expect(sentNode.data.onLabelChange).toBeUndefined(); // function stripped
  });

  it('translates final-position node changes to update_node (skips in-flight drags)', () => {
    const { result } = setup();
    const send = vi.fn();
    act(() => result.current.registerCollabSend(send));
    const nextNodes = [{ id: 'n1', position: { x: 50, y: 60 }, data: { laneId: 'l1' } }] as Node[];
    act(() => {
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
        operations: [
          { op: 'update_node', data: { id: 'n1', position: { x: 50, y: 60 }, data: { laneId: 'l1' } } },
        ],
      })
    );
  });

  it('broadcastLanes emits update_lanes plus update_node[] for reassigned nodes', () => {
    const { result } = setup();
    const send = vi.fn();
    act(() => result.current.registerCollabSend(send));
    const lanes: Lane[] = [{ id: 'l1', label: 'Sales', color: '#111' }];
    const reassigned = [
      { id: 'n1', position: { x: 0, y: 0 }, data: { laneId: 'l1', laneColor: '#111' } },
    ] as Node[];
    act(() => result.current.broadcastLanes(lanes, reassigned));
    const ops = send.mock.calls[0][0].operations;
    expect(ops[0]).toEqual({ op: 'update_lanes', data: { lanes } });
    expect(ops[1].op).toBe('update_node');
    expect(ops[1].data.id).toBe('n1');
  });

  it('broadcastSnapshot emits a single graph_snapshot op', () => {
    const { result } = setup();
    const send = vi.fn();
    act(() => result.current.registerCollabSend(send));
    act(() =>
      result.current.broadcastSnapshot({
        nodes: [{ id: 'n1', position: { x: 0, y: 0 }, data: {} }] as Node[],
        edges: [],
        lanes: [{ id: 'l1', label: 'L', color: '#111' }] as Lane[],
      })
    );
    const ops = send.mock.calls[0][0].operations;
    expect(ops).toHaveLength(1);
    expect(ops[0].op).toBe('graph_snapshot');
    expect(ops[0].data.nodes.map((n: Node) => n.id)).toEqual(['n1']);
  });

  it('broadcastOps forwards an arbitrary batch (insertBetween shape)', () => {
    const { result } = setup();
    const send = vi.fn();
    act(() => result.current.registerCollabSend(send));
    const batch = [
      { op: 'add_node', data: { id: 'mid', position: { x: 0, y: 0 }, data: {} } },
      { op: 'remove_edge', data: { id: 'e-old' } },
      { op: 'add_edge', data: { id: 'e-a', source: 's', target: 'mid' } },
      { op: 'add_edge', data: { id: 'e-b', source: 'mid', target: 't' } },
    ];
    act(() => result.current.broadcastOps(batch));
    expect(send.mock.calls[0][0].operations.map((o: any) => o.op)).toEqual([
      'add_node',
      'remove_edge',
      'add_edge',
      'add_edge',
    ]);
  });

  it('does not broadcast while applying a remote patch (no echo loop)', () => {
    const { result } = setup();
    const send = vi.fn();
    act(() => result.current.registerCollabSend(send));
    // While applyingRemoteRef is true (set synchronously during receive), a
    // broadcast triggered by the resulting setState must be suppressed.
    act(() => {
      // Emit a remote add — the receive handler sets applyingRemoteRef=true and
      // only releases it on the next tick. A broadcast in the same tick is a no-op.
      window.dispatchEvent(
        new CustomEvent('idea-collab-graph-patch', {
          detail: {
            userId: 'u2',
            operations: [{ op: 'add_node', data: { id: 'r1', position: { x: 0, y: 0 }, data: {} } }],
          },
        })
      );
      result.current.broadcastNodeAdd({ id: 'echo', position: { x: 0, y: 0 }, data: {} } as Node);
    });
    expect(send).not.toHaveBeenCalled();
  });

  it('onSessionState computes lockedByOthers excluding my own locks', () => {
    const { result } = setup();
    act(() =>
      result.current.onSessionState({
        lockedNodes: { n1: 'u2', n2: ME, n3: 'u3' },
      } as any)
    );
    expect(Array.from(result.current.lockedByOthers).sort()).toEqual(['n1', 'n3']);
  });
});
