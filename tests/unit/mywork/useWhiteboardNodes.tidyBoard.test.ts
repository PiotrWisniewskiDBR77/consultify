/**
 * WB-P2-03 (docs/qa/ideas-manual-audit-2026-08-09/08_P1_P3_EXECUTION_PLAN_
 * FOR_CLAUDE.md §6 Whiteboard) — "Tidy board" / "Auto arrange selection".
 *
 * `tidyBoard()` reuses `computeTidyLayout`/`resolveWhiteboardPlacement`
 * (whiteboardPlacement.ts) — these tests check the STATEFUL wiring around
 * it: undo snapshot, selection-vs-whole-board scoping, frame/group
 * preservation, and the locked-object guarantee — not the placement math
 * itself (covered by whiteboardPlacement.test.ts).
 */
import { useState } from 'react';
import { renderHook, act } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Edge, Node } from 'reactflow';

import { useWhiteboardNodes } from '../../../src/components/MyWork/whiteboard/useWhiteboardNodes';

function overlaps(a: Node, b: Node, w = 200, h = 120) {
  return (
    a.position.x < b.position.x + w &&
    a.position.x + w > b.position.x &&
    a.position.y < b.position.y + h &&
    a.position.y + h > b.position.y
  );
}

function renderTidyHook(initialNodes: Node[], initialEdges: Edge[] = []) {
  const pushSnapshot = vi.fn();
  const { result } = renderHook(() => {
    const [nodes, setNodes] = useState<Node[]>(initialNodes);
    const [edges, setEdges] = useState<Edge[]>(initialEdges);
    const hook = useWhiteboardNodes({
      nodes,
      edges,
      setNodes,
      setEdges,
      locked: false,
      isPl: false,
      pushSnapshot,
    });
    return { ...hook, nodes, edges };
  });
  return { result, pushSnapshot };
}

describe('useWhiteboardNodes — tidyBoard (WB-P2-03)', () => {
  it('arranges the whole board (no selection) into non-overlapping positions and pushes ONE undo snapshot', () => {
    const stacked: Node[] = [
      { id: 'a', type: 'stickyNote', position: { x: 100, y: 100 }, data: { label: 'A' } },
      { id: 'b', type: 'stickyNote', position: { x: 100, y: 100 }, data: { label: 'B' } },
      { id: 'c', type: 'stickyNote', position: { x: 100, y: 100 }, data: { label: 'C' } },
    ];
    const { result, pushSnapshot } = renderTidyHook(stacked);

    act(() => {
      result.current.tidyBoard();
    });

    expect(pushSnapshot).toHaveBeenCalledTimes(1);
    const [a, b, c] = result.current.nodes;
    expect(overlaps(a, b)).toBe(false);
    expect(overlaps(a, c)).toBe(false);
    expect(overlaps(b, c)).toBe(false);
  });

  it('is a silent no-op (no undo entry) when there is nothing meaningful to arrange', () => {
    const single: Node[] = [
      { id: 'a', type: 'stickyNote', position: { x: 40, y: 40 }, data: { label: 'A' } },
    ];
    const { result, pushSnapshot } = renderTidyHook(single);

    act(() => {
      result.current.tidyBoard();
    });

    expect(pushSnapshot).not.toHaveBeenCalled();
    expect(result.current.nodes[0].position).toEqual({ x: 40, y: 40 });
  });

  it('with 2+ selected, arranges ONLY the selection — untouched nodes keep their exact original position', () => {
    const nodes: Node[] = [
      { id: 'sel-1', type: 'stickyNote', selected: true, position: { x: 300, y: 300 }, data: { label: 'S1' } },
      { id: 'sel-2', type: 'stickyNote', selected: true, position: { x: 300, y: 300 }, data: { label: 'S2' } },
      // Not selected — must not move even though tidy is running.
      { id: 'bystander', type: 'stickyNote', selected: false, position: { x: 900, y: 900 }, data: { label: 'X' } },
    ];
    const { result, pushSnapshot } = renderTidyHook(nodes);

    act(() => {
      result.current.tidyBoard();
    });

    expect(pushSnapshot).toHaveBeenCalledTimes(1);
    const bystander = result.current.nodes.find((n) => n.id === 'bystander')!;
    expect(bystander.position).toEqual({ x: 900, y: 900 });
    const [s1, s2] = result.current.nodes.filter((n) => n.id !== 'bystander');
    expect(overlaps(s1, s2)).toBe(false);
  });

  it('moves a frame and its children together, preserving their relative offset', () => {
    const nodes: Node[] = [
      {
        id: 'frame-1',
        type: 'frameNode',
        position: { x: 200, y: 200 },
        style: { width: 300, height: 220 },
        data: { label: 'Frame' },
      },
      {
        id: 'child-1',
        type: 'stickyNote',
        // `parentId` (not a recognized ReactFlow prop in this codebase — see
        // useWhiteboardNodes groupSelected) — positions stay in the SAME
        // absolute flow-coordinate space as the frame, not relative to it.
        parentId: 'frame-1',
        position: { x: 240, y: 250 },
        data: { label: 'Child' },
      } as unknown as Node,
      // A second, unrelated overlapping node forces an actual reposition.
      { id: 'other', type: 'stickyNote', position: { x: 200, y: 200 }, data: { label: 'Other' } },
    ];
    const { result, pushSnapshot } = renderTidyHook(nodes);

    act(() => {
      result.current.tidyBoard();
    });

    expect(pushSnapshot).toHaveBeenCalledTimes(1);
    const frame = result.current.nodes.find((n) => n.id === 'frame-1')!;
    const child = result.current.nodes.find((n) => n.id === 'child-1')!;
    // Relative offset preserved exactly, regardless of where the frame ended up.
    expect(child.position.x - frame.position.x).toBe(40);
    expect(child.position.y - frame.position.y).toBe(50);
  });

  it('never moves a locked node, but tidies unlocked ones around it', () => {
    const nodes: Node[] = [
      {
        id: 'locked-1',
        type: 'stickyNote',
        position: { x: 100, y: 100 },
        data: { label: 'Locked', locked: true },
      },
      { id: 'free-1', type: 'stickyNote', position: { x: 100, y: 100 }, data: { label: 'Free 1' } },
      { id: 'free-2', type: 'stickyNote', position: { x: 100, y: 100 }, data: { label: 'Free 2' } },
    ];
    const { result, pushSnapshot } = renderTidyHook(nodes);

    act(() => {
      result.current.tidyBoard();
    });

    expect(pushSnapshot).toHaveBeenCalledTimes(1);
    const locked = result.current.nodes.find((n) => n.id === 'locked-1')!;
    expect(locked.position).toEqual({ x: 100, y: 100 });
    const free1 = result.current.nodes.find((n) => n.id === 'free-1')!;
    const free2 = result.current.nodes.find((n) => n.id === 'free-2')!;
    expect(overlaps(locked, free1)).toBe(false);
    expect(overlaps(locked, free2)).toBe(false);
    expect(overlaps(free1, free2)).toBe(false);
  });

  it('does nothing while locked', () => {
    const nodes: Node[] = [
      { id: 'a', type: 'stickyNote', position: { x: 100, y: 100 }, data: { label: 'A' } },
      { id: 'b', type: 'stickyNote', position: { x: 100, y: 100 }, data: { label: 'B' } },
    ];
    const pushSnapshot = vi.fn();
    const { result } = renderHook(() => {
      const [n, setNodes] = useState<Node[]>(nodes);
      const [e, setEdges] = useState<Edge[]>([]);
      const hook = useWhiteboardNodes({
        nodes: n,
        edges: e,
        setNodes,
        setEdges,
        locked: true,
        isPl: false,
        pushSnapshot,
      });
      return { ...hook, nodes: n, edges: e };
    });

    act(() => {
      result.current.tidyBoard();
    });

    expect(pushSnapshot).not.toHaveBeenCalled();
    expect(result.current.nodes[0].position).toEqual({ x: 100, y: 100 });
    expect(result.current.nodes[1].position).toEqual({ x: 100, y: 100 });
  });
});
