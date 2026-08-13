/**
 * WB-FRAME-02 (drag containment, 2026-08-10) — `reparentNodeOnDrag`, wired
 * to `onNodeDragStop`. WB-FRAME-01 gave frames real `parentNode` containment
 * through explicit menu commands only ("Add selection to frame" / "Remove
 * from frame"); this closes the physical-drag gap. See the function's own
 * header comment in `useWhiteboardNodes.ts` for the exact position math
 * being exercised here (join / release / direct A→B reparent).
 */
import { useState } from 'react';
import { renderHook, act } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Edge, Node } from 'reactflow';

import { useWhiteboardNodes } from '../../../src/components/MyWork/whiteboard/useWhiteboardNodes';

function renderFrameHook(initialNodes: Node[], initialEdges: Edge[] = []) {
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

describe('useWhiteboardNodes — reparentNodeOnDrag (WB-FRAME-02)', () => {
  it('dragging an unparented node so its center lands inside a frame makes it a real ReactFlow child (parentNode set, position becomes frame-relative)', () => {
    const frame: Node = {
      id: 'frame-1',
      type: 'frameNode',
      position: { x: 0, y: 0 },
      style: { width: 400, height: 300 },
      data: { label: 'Frame' },
    };
    // Absolute center at (200, 150) — squarely inside the frame's 0..400 x 0..300 box.
    const dragged: Node = {
      id: 'node-1',
      type: 'stickyNote',
      position: { x: 100, y: 90 },
      data: { label: 'Sticky' },
    };
    const { result, pushSnapshot } = renderFrameHook([frame, dragged]);

    act(() => {
      result.current.reparentNodeOnDrag('node-1');
    });

    expect(pushSnapshot).toHaveBeenCalledTimes(1);
    const child = result.current.nodes.find((n) => n.id === 'node-1')! as Node & {
      parentNode?: string;
      parentId?: string;
    };
    expect(child.parentNode).toBe('frame-1');
    expect(child.parentId).toBe('frame-1');
    // Position converted to frame-relative (frame origin is 0,0, so unchanged here).
    expect(child.position).toEqual({ x: 100, y: 90 });
  });

  it('dragging a frame child out past every frame boundary releases it back to absolute position, without deleting it', () => {
    const frame: Node = {
      id: 'frame-1',
      type: 'frameNode',
      position: { x: 0, y: 0 },
      style: { width: 400, height: 300 },
      data: { label: 'Frame' },
    };
    const child: Node = {
      id: 'node-1',
      type: 'stickyNote',
      // Native ReactFlow containment already established — position is
      // relative to the frame, dragged far outside its 400x300 box.
      parentNode: 'frame-1',
      parentId: 'frame-1',
      position: { x: 900, y: 900 },
      data: { label: 'Sticky' },
    } as unknown as Node;
    const { result, pushSnapshot } = renderFrameHook([frame, child]);

    act(() => {
      result.current.reparentNodeOnDrag('node-1');
    });

    expect(pushSnapshot).toHaveBeenCalledTimes(1);
    const released = result.current.nodes.find((n) => n.id === 'node-1')! as Node & {
      parentNode?: string;
      parentId?: string;
    };
    expect(released.parentNode).toBeUndefined();
    expect(released.parentId).toBeUndefined();
    expect(released.data?.parentId).toBeUndefined();
    // Absolute position = old relative position + frame's own position.
    expect(released.position).toEqual({ x: 900, y: 900 });
    // Still present on the board — never deleted by a release.
    expect(result.current.nodes.some((n) => n.id === 'node-1')).toBe(true);
  });

  it('dragging a child from one frame directly into a different frame reparents it there, with position relative to the NEW frame', () => {
    const frameA: Node = {
      id: 'frame-a',
      type: 'frameNode',
      position: { x: 0, y: 0 },
      style: { width: 200, height: 200 },
      data: { label: 'A' },
    };
    const frameB: Node = {
      id: 'frame-b',
      type: 'frameNode',
      position: { x: 500, y: 500 },
      style: { width: 400, height: 300 },
      data: { label: 'B' },
    };
    // Currently a child of frame-a; its relative position (60,60) plus
    // frame-a's origin (0,0) puts its absolute center inside frame-b's box
    // (500..900 x 500..800) — simulating a drag that crossed from A into B.
    const child: Node = {
      id: 'node-1',
      type: 'stickyNote',
      parentNode: 'frame-a',
      parentId: 'frame-a',
      position: { x: 560, y: 560 },
      data: { label: 'Sticky' },
    } as unknown as Node;
    const { result, pushSnapshot } = renderFrameHook([frameA, frameB, child]);

    act(() => {
      result.current.reparentNodeOnDrag('node-1');
    });

    expect(pushSnapshot).toHaveBeenCalledTimes(1);
    const moved = result.current.nodes.find((n) => n.id === 'node-1')! as Node & {
      parentNode?: string;
    };
    expect(moved.parentNode).toBe('frame-b');
    // Absolute (560,560) minus frame-b's origin (500,500) = relative (60,60).
    expect(moved.position).toEqual({ x: 60, y: 60 });
  });

  it('is a silent no-op when the node did not visually enter or leave any frame', () => {
    const frame: Node = {
      id: 'frame-1',
      type: 'frameNode',
      position: { x: 0, y: 0 },
      style: { width: 400, height: 300 },
      data: { label: 'Frame' },
    };
    // Absolute center far outside the frame, no parent before or after.
    const dragged: Node = {
      id: 'node-1',
      type: 'stickyNote',
      position: { x: 900, y: 900 },
      data: { label: 'Sticky' },
    };
    const { result, pushSnapshot } = renderFrameHook([frame, dragged]);

    act(() => {
      result.current.reparentNodeOnDrag('node-1');
    });

    expect(pushSnapshot).not.toHaveBeenCalled();
    expect(result.current.nodes.find((n) => n.id === 'node-1')!.position).toEqual({
      x: 900,
      y: 900,
    });
  });

  it('never reparents a locked node, and never treats a frame itself as drag-into-frame content', () => {
    const frame: Node = {
      id: 'frame-1',
      type: 'frameNode',
      position: { x: 0, y: 0 },
      style: { width: 400, height: 300 },
      data: { label: 'Frame' },
    };
    const lockedNode: Node = {
      id: 'locked-1',
      type: 'stickyNote',
      position: { x: 100, y: 90 },
      data: { label: 'Locked', locked: true },
    };
    const otherFrame: Node = {
      id: 'frame-2',
      type: 'frameNode',
      position: { x: 40, y: 40 },
      style: { width: 100, height: 80 },
      data: { label: 'Inner-ish' },
    };
    const { result, pushSnapshot } = renderFrameHook([frame, lockedNode, otherFrame]);

    act(() => {
      result.current.reparentNodeOnDrag('locked-1');
      result.current.reparentNodeOnDrag('frame-2');
    });

    expect(pushSnapshot).not.toHaveBeenCalled();
    const stillLocked = result.current.nodes.find((n) => n.id === 'locked-1')! as Node & {
      parentNode?: string;
    };
    expect(stillLocked.parentNode).toBeUndefined();
    const stillFrame2 = result.current.nodes.find((n) => n.id === 'frame-2')! as Node & {
      parentNode?: string;
    };
    expect(stillFrame2.parentNode).toBeUndefined();
  });

  it('does nothing while the whiteboard is locked', () => {
    const frame: Node = {
      id: 'frame-1',
      type: 'frameNode',
      position: { x: 0, y: 0 },
      style: { width: 400, height: 300 },
      data: { label: 'Frame' },
    };
    const dragged: Node = {
      id: 'node-1',
      type: 'stickyNote',
      position: { x: 100, y: 90 },
      data: { label: 'Sticky' },
    };
    const pushSnapshot = vi.fn();
    const { result } = renderHook(() => {
      const [nodes, setNodes] = useState<Node[]>([frame, dragged]);
      const [edges, setEdges] = useState<Edge[]>([]);
      const hook = useWhiteboardNodes({
        nodes,
        edges,
        setNodes,
        setEdges,
        locked: true,
        isPl: false,
        pushSnapshot,
      });
      return { ...hook, nodes, edges };
    });

    act(() => {
      result.current.reparentNodeOnDrag('node-1');
    });

    expect(pushSnapshot).not.toHaveBeenCalled();
    const untouched = result.current.nodes.find((n) => n.id === 'node-1')! as Node & {
      parentNode?: string;
    };
    expect(untouched.parentNode).toBeUndefined();
  });
});
