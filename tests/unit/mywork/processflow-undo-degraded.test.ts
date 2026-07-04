import { describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { Node, Edge } from 'reactflow';

import { useProcessFlowUndoRedo } from '../../../src/components/MyWork/processflow/useProcessFlowUndoRedo';

describe('useProcessFlowUndoRedo', () => {
  const makeOpts = () => {
    const state = {
      nodes: [{ id: 'n1', position: { x: 0, y: 0 }, data: { label: 'A' } }] as Node[],
      edges: [] as Edge[],
      lanes: [{ id: 'l1', label: 'Lane 1', color: '#e0e7ff' }],
    };
    const setNodes = vi.fn((update: any) => {
      state.nodes = typeof update === 'function' ? update(state.nodes) : update;
    });
    const setEdges = vi.fn((update: any) => {
      state.edges = typeof update === 'function' ? update(state.edges) : update;
    });
    const setLanes = vi.fn((update: any) => {
      state.lanes = typeof update === 'function' ? update(state.lanes) : update;
    });
    return { state, setNodes, setEdges, setLanes };
  };

  it('pushUndo and undo restores previous state', () => {
    const { state, setNodes, setEdges, setLanes } = makeOpts();
    const { result, rerender } = renderHook(() =>
      useProcessFlowUndoRedo({
        nodes: state.nodes,
        edges: state.edges,
        lanes: state.lanes,
        setNodes,
        setEdges,
        setLanes,
      })
    );

    act(() => result.current.pushUndo());
    expect(result.current.canUndo).toBe(true);

    act(() => result.current.undo());
    expect(setNodes).toHaveBeenCalled();
  });

  it('redo restores after undo', () => {
    const { state, setNodes, setEdges, setLanes } = makeOpts();
    const { result } = renderHook(() =>
      useProcessFlowUndoRedo({
        nodes: state.nodes,
        edges: state.edges,
        lanes: state.lanes,
        setNodes,
        setEdges,
        setLanes,
      })
    );

    act(() => result.current.pushUndo());
    act(() => result.current.undo());
    expect(result.current.canRedo).toBe(true);

    act(() => result.current.redo());
    expect(setNodes).toHaveBeenCalledTimes(2);
  });

  it('resetUndo clears both stacks', () => {
    const { state, setNodes, setEdges, setLanes } = makeOpts();
    const { result } = renderHook(() =>
      useProcessFlowUndoRedo({
        nodes: state.nodes,
        edges: state.edges,
        lanes: state.lanes,
        setNodes,
        setEdges,
        setLanes,
      })
    );

    act(() => result.current.pushUndo());
    expect(result.current.canUndo).toBe(true);

    act(() => result.current.resetUndo());
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it('caps undo stack at MAX_UNDO_STEPS (30)', () => {
    const { state, setNodes, setEdges, setLanes } = makeOpts();
    const { result } = renderHook(() =>
      useProcessFlowUndoRedo({
        nodes: state.nodes,
        edges: state.edges,
        lanes: state.lanes,
        setNodes,
        setEdges,
        setLanes,
      })
    );

    for (let i = 0; i < 35; i++) {
      act(() => result.current.pushUndo());
    }
    expect(result.current.undoRedoTick).toBeGreaterThan(30);
  });
});

// Note: useProcessFlowDegraded (V8 health-poll no-op) was removed as dead code
// (M07/F1, DP-7) — the canonical persistence path is blob-sync (my_idea_maps)
// with no V8 mirror to be "degraded" from. Its degraded-mode banner in
// IdeaProcessFlowTool.tsx was removed alongside it.
