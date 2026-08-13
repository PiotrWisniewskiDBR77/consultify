/**
 * WB-CLIPBOARD-01 (docs/qa/ideas-complete-transformation-2026-08-09/
 * 02_EXECUTION_LEDGER.csv): Whiteboard's node "Copy" used to write the node's
 * text LABEL to the OS clipboard, with no matching "paste object" anywhere.
 * These tests prove the real object clipboard added to `useWhiteboardNodes`
 * (mirrors Process Flow's proven `schowekRef`/`pasteClipboard` pattern in
 * `processflow/useProcessFlowNodes.ts`): copy-then-paste produces NEW,
 * DISTINCT ids, preserves edges BETWEEN copied nodes, and drops edges to
 * nodes outside the copied set instead of leaving them dangling.
 */
import { useState } from 'react';
import { renderHook, act } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Edge, Node } from 'reactflow';

import { useWhiteboardNodes } from '../../../src/components/MyWork/whiteboard/useWhiteboardNodes';

function makeNode(id: string, x: number, selected = false): Node {
  return {
    id,
    type: 'stickyNode',
    selected,
    position: { x, y: 0 },
    data: { label: `Node ${id}` },
  };
}

describe('useWhiteboardNodes — object clipboard (WB-CLIPBOARD-01)', () => {
  it('copies selected node(s) + internal edges, pastes as new elements with distinct ids, preserves inter-node edges, and drops dangling ones', () => {
    const pushSnapshot = vi.fn();

    const { result } = renderHook(() => {
      const [nodes, setNodes] = useState<Node[]>([
        makeNode('n-1', 0, true),
        makeNode('n-2', 120, true),
        // n-3 is NOT selected/copied — its edge to n-2 must be dropped, not
        // dangle onto a pasted node that doesn't exist yet.
        makeNode('n-3', 240, false),
      ]);
      const [edges, setEdges] = useState<Edge[]>([
        // Between the two copied nodes — must survive the copy+paste as a
        // NEW edge between the two NEW pasted nodes.
        { id: 'e-1-2', source: 'n-1', target: 'n-2', type: 'default', selected: false },
        // From a copied node to an UNCOPIED node — must be dropped on paste.
        { id: 'e-2-3', source: 'n-2', target: 'n-3', type: 'default', selected: false },
      ]);

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

    // Copy the current selection (n-1, n-2) into the tool clipboard.
    act(() => {
      const copiedCount = result.current.copySelected();
      expect(copiedCount).toBe(2);
    });
    expect(result.current.clipboardCount()).toBe(2);

    // Paste — must push an undo snapshot and add NEW nodes/edges.
    act(() => {
      result.current.pasteClipboard();
    });

    expect(pushSnapshot).toHaveBeenCalledTimes(1);
    expect(result.current.nodes).toHaveLength(5); // 3 original + 2 pasted
    // Both ORIGINAL edges stay untouched by paste (paste only ADDS elements)
    // + exactly ONE new edge for the pasted pair — the dangling n-2→n-3 edge
    // must NOT have been cloned onto the pasted nodes.
    expect(result.current.edges).toHaveLength(3);

    const originalIds = new Set(['n-1', 'n-2', 'n-3']);
    const pastedNodes = result.current.nodes.filter((n) => !originalIds.has(n.id));
    expect(pastedNodes).toHaveLength(2);

    // Distinct new ids — not equal to originals, not equal to each other.
    const pastedIds = pastedNodes.map((n) => n.id);
    expect(new Set(pastedIds).size).toBe(2);
    for (const id of pastedIds) {
      expect(originalIds.has(id)).toBe(false);
    }

    // Exactly one NEW edge was added by the paste (the clipboard only ever
    // held the one edge between the two copied nodes).
    const originalEdgeIds = new Set(['e-1-2', 'e-2-3']);
    const newEdges = result.current.edges.filter((e) => !originalEdgeIds.has(e.id));
    expect(newEdges).toHaveLength(1);

    // The new edge connects the two PASTED nodes (inter-node edge preserved
    // with remapped endpoints) — not the originals, not n-3.
    const pastedEdge = newEdges[0];
    const pastedIdSet = new Set(pastedIds);
    expect(pastedIdSet.has(pastedEdge.source)).toBe(true);
    expect(pastedIdSet.has(pastedEdge.target)).toBe(true);

    // The ORIGINAL n-2→n-3 edge is still there (untouched)...
    expect(result.current.edges.some((e) => e.id === 'e-2-3')).toBe(true);
    // ...but NO edge connects n-3 to any PASTED node (dangling edge dropped
    // from the clipboard/paste, not carried over onto the new elements).
    expect(
      result.current.edges.some(
        (e) =>
          (e.source === 'n-3' && pastedIdSet.has(e.target)) ||
          (e.target === 'n-3' && pastedIdSet.has(e.source))
      )
    ).toBe(false);

    // Pasted nodes are offset from their originals, not stacked exactly on
    // top of them.
    const n1 = result.current.nodes.find((n) => n.id === 'n-1')!;
    const pastedFromN1 = pastedNodes.find((n) => n.data?._duplicatedFrom === 'n-1');
    expect(pastedFromN1).toBeDefined();
    expect(pastedFromN1!.position.x).not.toBe(n1.position.x);
    expect(pastedFromN1!.position.y).not.toBe(n1.position.y);
  });

  it('copyNodeById copies a single node by id independent of selection state', () => {
    const pushSnapshot = vi.fn();

    const { result } = renderHook(() => {
      const [nodes, setNodes] = useState<Node[]>([
        makeNode('a', 0, false),
        makeNode('b', 100, false),
      ]);
      const [edges, setEdges] = useState<Edge[]>([]);

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

    expect(result.current.clipboardCount()).toBe(0);

    act(() => {
      const count = result.current.copyNodeById('a');
      expect(count).toBe(1);
    });
    expect(result.current.clipboardCount()).toBe(1);

    act(() => {
      result.current.pasteClipboard();
    });

    expect(result.current.nodes).toHaveLength(3);
    const pasted = result.current.nodes.find((n) => n.data?._duplicatedFrom === 'a');
    expect(pasted).toBeDefined();
  });

  it('pasteClipboard is a no-op when the clipboard is empty or the board is locked', () => {
    const pushSnapshot = vi.fn();

    const { result, rerender } = renderHook(
      ({ locked }: { locked: boolean }) => {
        const [nodes, setNodes] = useState<Node[]>([makeNode('n-1', 0, true)]);
        const [edges, setEdges] = useState<Edge[]>([]);

        const hook = useWhiteboardNodes({
          nodes,
          edges,
          setNodes,
          setEdges,
          locked,
          isPl: false,
          pushSnapshot,
        });

        return { ...hook, nodes, edges };
      },
      { initialProps: { locked: false } }
    );

    // Empty clipboard — paste does nothing, no undo snapshot pushed.
    act(() => {
      const pasted = result.current.pasteClipboard();
      expect(pasted).toBe(0);
    });
    expect(result.current.nodes).toHaveLength(1);
    expect(pushSnapshot).not.toHaveBeenCalled();

    // Copy while unlocked, then lock, then attempt paste — must still no-op.
    act(() => {
      result.current.copySelected();
    });
    rerender({ locked: true });
    act(() => {
      const pasted = result.current.pasteClipboard();
      expect(pasted).toBe(0);
    });
    expect(result.current.nodes).toHaveLength(1);
    expect(pushSnapshot).not.toHaveBeenCalled();
  });
});
