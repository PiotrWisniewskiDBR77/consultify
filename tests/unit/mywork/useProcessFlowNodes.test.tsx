import React, { useState } from 'react';
import { renderHook, act } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Edge, Node } from 'reactflow';

import { useProcessFlowNodes } from '../../../src/components/MyWork/processflow/useProcessFlowNodes';
import { useProcessFlowUndoRedo } from '../../../src/components/MyWork/processflow/useProcessFlowUndoRedo';

describe('useProcessFlowNodes', () => {
  it('duplicates selected nodes together with internal edges', () => {
    const onNodeDetail = vi.fn();

    const { result } = renderHook(() => {
      const [nodes, setNodes] = useState<Node[]>([
        {
          id: 'n-1',
          type: 'flowNode',
          selected: true,
          position: { x: 0, y: 0 },
          data: { label: 'Start', laneId: 'lane-1', laneColor: '#abc' },
        },
        {
          id: 'n-2',
          type: 'flowNode',
          selected: true,
          position: { x: 120, y: 0 },
          data: { label: 'Next', laneId: 'lane-1', laneColor: '#abc' },
        },
      ]);
      const [edges, setEdges] = useState<Edge[]>([
        {
          id: 'e-1',
          source: 'n-1',
          target: 'n-2',
          type: 'flowEdge',
          selected: false,
        },
      ]);

      const hook = useProcessFlowNodes({
        nodes,
        edges,
        setNodes,
        setEdges,
        lanes: [{ id: 'lane-1', label: 'Lane 1', color: '#abc' }],
        setLanes: vi.fn(),
        locked: false,
        isPl: false,
        pushUndo: vi.fn(),
        onNodeDetail,
      });

      return { ...hook, nodes, edges };
    });

    act(() => {
      result.current.duplicateSelected();
    });

    expect(result.current.nodes).toHaveLength(4);
    expect(result.current.edges).toHaveLength(2);

    const duplicatedNodes = result.current.nodes.filter((node) => !['n-1', 'n-2'].includes(node.id));
    const duplicatedIds = new Set(duplicatedNodes.map((node) => node.id));
    const duplicatedEdge = result.current.edges.find((edge) => edge.id !== 'e-1');

    expect(duplicatedNodes).toHaveLength(2);
    expect(duplicatedEdge).toBeDefined();
    expect(duplicatedIds.has(duplicatedEdge!.source)).toBe(true);
    expect(duplicatedIds.has(duplicatedEdge!.target)).toBe(true);
  });

  // G4-LANE-DELETE: `handleLaneDelete` used to silently no-op on the last
  // remaining lane (`if (locked || lanes.length <= 1) return;`, no signal at
  // all — the exact "looks like it worked, did nothing" defect class this
  // program has been burned by before). These two tests pin BOTH halves of
  // the fix: a legitimate delete (>1 lane) actually removes the lane and
  // moves its nodes to a defined fallback lane, and a refused delete (the
  // only lane) changes NOTHING and fires the injected `onLaneDeleteBlocked`
  // callback instead of returning silently.
  describe('handleLaneDelete', () => {
    it('deletes a lane when another lane remains, and reassigns its nodes to the fallback lane (never orphaned)', () => {
      const pushUndo = vi.fn();
      const onLaneDeleteBlocked = vi.fn();
      const broadcastLanes = vi.fn();

      const { result } = renderHook(() => {
        const [nodes, setNodes] = useState<Node[]>([
          {
            id: 'n-1',
            type: 'flowNode',
            position: { x: 0, y: 0 },
            data: { label: 'Step A', laneId: 'lane-1', laneColor: '#e0e7ff' },
          },
        ]);
        const [lanes, setLanes] = useState([
          { id: 'lane-1', label: 'Intake', color: '#e0e7ff' },
          { id: 'lane-2', label: 'Fulfilment', color: '#dbeafe' },
        ]);

        const hook = useProcessFlowNodes({
          nodes,
          edges: [],
          setNodes,
          setEdges: vi.fn(),
          lanes,
          setLanes,
          locked: false,
          isPl: false,
          pushUndo,
          onLaneDeleteBlocked,
          collab: { broadcastLanes },
        });

        return { ...hook, nodes, lanes };
      });

      act(() => {
        result.current.handleLaneDelete('lane-1');
      });

      // The lane is gone — this is a REAL deletion, not a no-op.
      expect(result.current.lanes).toHaveLength(1);
      expect(result.current.lanes.map((l) => l.id)).toEqual(['lane-2']);

      // Its node is NOT orphaned/dropped — it moved to the fallback lane.
      expect(result.current.nodes).toHaveLength(1);
      expect(result.current.nodes[0].data?.laneId).toBe('lane-2');
      expect(result.current.nodes[0].data?.laneColor).toBe('#dbeafe');

      expect(pushUndo).toHaveBeenCalledTimes(1);
      expect(broadcastLanes).toHaveBeenCalledTimes(1);
      expect(onLaneDeleteBlocked).not.toHaveBeenCalled();
    });

    it('refuses to delete the only remaining lane — no lane/node change, visible refusal via onLaneDeleteBlocked, no undo snapshot', () => {
      const pushUndo = vi.fn();
      const onLaneDeleteBlocked = vi.fn();
      const broadcastLanes = vi.fn();

      const { result } = renderHook(() => {
        const [nodes, setNodes] = useState<Node[]>([
          {
            id: 'n-1',
            type: 'flowNode',
            position: { x: 0, y: 0 },
            data: { label: 'Only step', laneId: 'lane-1', laneColor: '#e0e7ff' },
          },
        ]);
        const [lanes, setLanes] = useState([{ id: 'lane-1', label: 'Only lane', color: '#e0e7ff' }]);

        const hook = useProcessFlowNodes({
          nodes,
          edges: [],
          setNodes,
          setEdges: vi.fn(),
          lanes,
          setLanes,
          locked: false,
          isPl: false,
          pushUndo,
          onLaneDeleteBlocked,
          collab: { broadcastLanes },
        });

        return { ...hook, nodes, lanes };
      });

      act(() => {
        result.current.handleLaneDelete('lane-1');
      });

      // Nothing changed — this is a REFUSAL, not a disguised success.
      expect(result.current.lanes).toHaveLength(1);
      expect(result.current.lanes[0].id).toBe('lane-1');
      expect(result.current.nodes).toHaveLength(1);
      expect(result.current.nodes[0].data?.laneId).toBe('lane-1');

      // The refusal is VISIBLE to the caller (which turns it into a toast —
      // see IdeaProcessFlowTool.tsx's onLaneDeleteBlocked wiring).
      expect(onLaneDeleteBlocked).toHaveBeenCalledTimes(1);
      expect(onLaneDeleteBlocked).toHaveBeenCalledWith('lane-1');

      // No mutation happened, so there is nothing to snapshot for undo and
      // nothing to broadcast to collaborators.
      expect(pushUndo).not.toHaveBeenCalled();
      expect(broadcastLanes).not.toHaveBeenCalled();
    });

    // G4-LANE-DELETE step 4 ("Undo"): a real Ctrl+Z (`useProcessFlowUndoRedo`,
    // not a mocked `pushUndo`) must bring back BOTH the deleted lane and the
    // node it reassigned — proving the fix didn't touch the pre-existing
    // undo wiring (`pushUndo()` still fires before the mutation, same call
    // site as before).
    it('Ctrl+Z (real useProcessFlowUndoRedo) restores the deleted lane and its node to their pre-delete lane', () => {
      const { result } = renderHook(() => {
        const [nodes, setNodes] = useState<Node[]>([
          {
            id: 'n-1',
            type: 'flowNode',
            position: { x: 0, y: 0 },
            data: { label: 'Step A', laneId: 'lane-1', laneColor: '#e0e7ff' },
          },
        ]);
        const [lanes, setLanes] = useState([
          { id: 'lane-1', label: 'Intake', color: '#e0e7ff' },
          { id: 'lane-2', label: 'Fulfilment', color: '#dbeafe' },
        ]);

        const undoRedo = useProcessFlowUndoRedo({
          nodes,
          edges: [],
          lanes,
          setNodes,
          setEdges: vi.fn(),
          setLanes,
        });

        const hook = useProcessFlowNodes({
          nodes,
          edges: [],
          setNodes,
          setEdges: vi.fn(),
          lanes,
          setLanes,
          locked: false,
          isPl: false,
          pushUndo: undoRedo.pushUndo,
        });

        return { ...hook, undo: undoRedo.undo, canUndo: undoRedo.canUndo, nodes, lanes };
      });

      act(() => {
        result.current.handleLaneDelete('lane-1');
      });
      expect(result.current.lanes).toHaveLength(1);
      expect(result.current.nodes[0].data?.laneId).toBe('lane-2');
      expect(result.current.canUndo).toBe(true);

      act(() => {
        result.current.undo();
      });

      expect(result.current.lanes).toHaveLength(2);
      expect(result.current.lanes.map((l) => l.id).sort()).toEqual(['lane-1', 'lane-2']);
      expect(result.current.nodes[0].data?.laneId).toBe('lane-1');
      expect(result.current.nodes[0].data?.laneColor).toBe('#e0e7ff');
    });
  });
});
