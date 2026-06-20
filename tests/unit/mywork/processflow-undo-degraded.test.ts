import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { Node, Edge } from 'reactflow';

import { useProcessFlowUndoRedo } from '../../../src/components/MyWork/processflow/useProcessFlowUndoRedo';
import { useProcessFlowDegraded } from '../../../src/components/MyWork/processflow/useProcessFlowDegraded';

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

const originalFetch = global.fetch;
const mockFetch = vi.fn();

beforeEach(() => {
  mockFetch.mockReset();
  global.fetch = mockFetch as typeof fetch;
});

afterEach(() => {
  global.fetch = originalFetch;
});

describe('useProcessFlowDegraded', () => {
  it('checkHealth calls health endpoint and sets state', async () => {
    const healthData = {
      degraded: true,
      scenario: 'offline_mode',
      posture: 'offline',
      recovery: 'Server unreachable',
    };
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ data: healthData }) });

    const { result } = renderHook(() => useProcessFlowDegraded({ processId: 'p1' }));

    await act(async () => {
      await result.current.checkHealth();
    });

    expect(result.current.isDegraded).toBe(true);
    expect(result.current.activeScenarios).toHaveLength(1);
    expect(result.current.activeScenarios[0].scenario).toBe('offline_mode');
  });

  it('handles empty scenarios gracefully', async () => {
    const healthData = {
      degraded: false,
      scenario: null,
    };
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ data: healthData }) });

    const { result } = renderHook(() => useProcessFlowDegraded({ processId: 'p2' }));

    await act(async () => {
      await result.current.checkHealth();
    });

    expect(result.current.isDegraded).toBe(false);
    expect(result.current.activeScenarios).toHaveLength(0);
  });

  it('handles fetch failure gracefully', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useProcessFlowDegraded({ processId: 'p3' }));

    await act(async () => {
      await result.current.checkHealth();
    });

    expect(result.current.isDegraded).toBe(true);
  });
});
