/**
 * G4-PF-GUARDRAIL — wiring test for the Process Flow node-count cap.
 *
 * tests/unit/mywork/processFlowNodeCap.test.ts already covers the pure
 * decision function (`checkProcessFlowNodeCap`) in isolation. This file
 * proves the cap is actually WIRED into the real add paths inside
 * `useProcessFlowNodes` (paste/duplicate) — a removed `if
 * (!guardAddNodes(...)) return;` call site would leave the pure function
 * green while the product regresses, so this is the test that actually
 * catches that regression (see the negative control in the stream's report:
 * these tests were re-run with the guard removed and confirmed RED).
 */
import React, { useState } from 'react';
import { renderHook, act } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import toast from 'react-hot-toast';
import type { Edge, Node } from 'reactflow';

import { useProcessFlowNodes } from '../../../src/components/MyWork/processflow/useProcessFlowNodes';
import {
  PROCESS_FLOW_NODE_LIMIT,
  PROCESS_FLOW_NODE_WARN_THRESHOLD,
} from '../../../src/components/MyWork/processflow/nodeCap';

function buildNodes(n: number, selectedCount = 0): Node[] {
  const out: Node[] = [];
  for (let i = 0; i < n; i++) {
    out.push({
      id: `n-${i}`,
      type: 'flowNode',
      selected: i < selectedCount,
      position: { x: i * 10, y: 0 },
      data: { label: `Step ${i}`, laneId: 'lane-1', laneColor: '#abc' },
    });
  }
  return out;
}

function setupHook(initialNodes: Node[]) {
  return renderHook(() => {
    const [nodes, setNodes] = useState<Node[]>(initialNodes);
    const [edges, setEdges] = useState<Edge[]>([]);

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
      onNodeDetail: vi.fn(),
    });

    return { ...hook, nodes, edges };
  });
}

describe('useProcessFlowNodes — G4-PF-GUARDRAIL node cap wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('duplicateSelected is BLOCKED once the resulting count would exceed the ceiling — no nodes added, error toast fired', () => {
    // 499 existing + 2 selected duplicated = 501 > 500 ceiling.
    const { result } = setupHook(buildNodes(PROCESS_FLOW_NODE_LIMIT - 1, 2));

    act(() => {
      result.current.duplicateSelected();
    });

    expect(result.current.nodes).toHaveLength(PROCESS_FLOW_NODE_LIMIT - 1);
    expect(toast.error).toHaveBeenCalledTimes(1);
    expect((toast.error as any).mock.calls[0][0]).toMatch(/500/);
  });

  it('pasteClipboard (wstawKopie) is BLOCKED once the resulting count would exceed the ceiling — no nodes added, error toast fired', () => {
    // 499 existing nodes, 2 of them selected and copied to the clipboard,
    // then pasted back into the SAME graph: 499 + 2 = 501 > 500 ceiling.
    const { result } = setupHook(buildNodes(PROCESS_FLOW_NODE_LIMIT - 1, 2));

    act(() => {
      result.current.copySelected();
    });
    expect(result.current.clipboardCount()).toBe(2);

    act(() => {
      result.current.pasteClipboard();
    });

    expect(result.current.nodes).toHaveLength(PROCESS_FLOW_NODE_LIMIT - 1);
    expect(toast.error).toHaveBeenCalledTimes(1);
  });

  it('allows the add and shows only a WARNING toast once the resulting count crosses the warn threshold but stays under the ceiling', () => {
    // 150 existing + 60 duplicated = 210, which is >= 200 (warn) and <= 500 (ceiling).
    const { result } = setupHook(buildNodes(150, 60));

    act(() => {
      result.current.duplicateSelected();
    });

    expect(result.current.nodes).toHaveLength(150 + 60);
    expect(toast.error).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledTimes(1);
    expect((toast as any).mock.calls[0][0]).toMatch(new RegExp(String(PROCESS_FLOW_NODE_WARN_THRESHOLD)));
  });

  it('allows the add silently (no toast at all) when well under the warn threshold', () => {
    const { result } = setupHook(buildNodes(10, 2));

    act(() => {
      result.current.duplicateSelected();
    });

    expect(result.current.nodes).toHaveLength(12);
    expect(toast.error).not.toHaveBeenCalled();
    expect(toast).not.toHaveBeenCalled();
  });
});
