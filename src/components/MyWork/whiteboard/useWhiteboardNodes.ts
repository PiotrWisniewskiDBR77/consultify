/**
 * useWhiteboardNodes — Extracted node CRUD, grouping, and distribution
 * for the Whiteboard component.
 */
import { useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import type { Edge, Node } from 'reactflow';

import {
  computeTidyLayout,
  rectOfWhiteboardNode,
  type WhiteboardRect,
} from './whiteboardPlacement';

export interface UseWhiteboardNodesOpts {
  nodes: Node[];
  edges: Edge[];
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
  locked: boolean;
  isPl: boolean;
  pushSnapshot?: () => void;
}

function isNodeLocked(node: Node): boolean {
  return Boolean(node.data?.locked);
}

function cloneNodeData(node: Node, newId: string): Record<string, unknown> {
  const data = { ...(node.data || {}) } as Record<string, unknown>;
  if (typeof data.onLabelChange === 'function') {
    delete data.onLabelChange;
  }
  return {
    ...data,
    parentId: data.parentId,
    _duplicatedFrom: node.id,
    locked: false,
    sourceNodeId: String(data.sourceNodeId || node.id),
    duplicateNodeId: newId,
  };
}

export function buildDuplicateSelection(nodes: Node[], edges: Edge[]) {
  const selected = nodes.filter((node) => node.selected && !isNodeLocked(node));
  if (selected.length === 0) {
    return {
      nodes: [] as Node[],
      edges: [] as Edge[],
      duplicatedIds: new Set<string>(),
    };
  }

  const idMap = new Map<string, string>();
  const duplicatedNodes = selected.map((node, index) => {
    const newId = `${node.id}-dup-${Date.now()}-${index}`;
    idMap.set(node.id, newId);
    return {
      ...node,
      id: newId,
      position: { x: node.position.x + 30, y: node.position.y + 30 },
      selected: false,
      data: cloneNodeData(node, newId),
    };
  });

  const duplicatedEdges = edges
    .filter((edge) => idMap.has(edge.source) && idMap.has(edge.target))
    .map((edge, index) => ({
      ...edge,
      id: `${edge.id}-dup-${Date.now()}-${index}`,
      source: idMap.get(edge.source) as string,
      target: idMap.get(edge.target) as string,
      selected: false,
      data: {
        ...(edge.data || {}),
        duplicatedFrom: edge.id,
      },
    }));

  return {
    nodes: duplicatedNodes,
    edges: duplicatedEdges,
    duplicatedIds: new Set(duplicatedNodes.map((node) => node.id)),
  };
}

function buildDuplicatedEdgesFromSelection(
  edges: Edge[],
  idMap: Map<string, string>,
  duplicateStamp: number
) {
  return edges
    .filter((edge) => idMap.has(edge.source) && idMap.has(edge.target))
    .map((edge, index) => ({
      ...edge,
      id: `${edge.id}-dup-${duplicateStamp}-${index}`,
      source: idMap.get(edge.source) as string,
      target: idMap.get(edge.target) as string,
      selected: false,
      data: {
        ...(edge.data || {}),
        duplicatedFrom: edge.id,
      },
    }));
}

export function useWhiteboardNodes(opts: UseWhiteboardNodesOpts) {
  const { nodes, edges, setNodes, setEdges, locked, isPl, pushSnapshot } = opts;
  const { t } = useTranslation();

  const deleteSelected = useCallback(() => {
    if (locked) return;
    const removedIds = new Set(
      nodes
        .filter((node: Node) => node.selected && !isNodeLocked(node))
        .map((node: Node) => node.id)
    );
    // Fala 8: a lone selected connector (no node selected) must still delete
    // on Delete/Backspace — previously this bailed out here before the edges
    // filter below ever ran, so an edge-only selection was a silent no-op.
    const hasSelectedEdge = edges.some((edge: Edge) => edge.selected);
    if (removedIds.size === 0 && !hasSelectedEdge) return;
    pushSnapshot?.();
    setNodes((prev: Node[]) =>
      prev.filter((node: Node) => !(node.selected && removedIds.has(node.id)))
    );
    setEdges((prev: Edge[]) =>
      prev.filter(
        (edge: Edge) =>
          !edge.selected && !removedIds.has(edge.source) && !removedIds.has(edge.target)
      )
    );
  }, [edges, locked, nodes, pushSnapshot, setEdges, setNodes]);

  const duplicateSelected = useCallback(() => {
    if (locked) return;
    const selected = nodes.filter((node: Node) => node.selected && !isNodeLocked(node));
    if (selected.length === 0) {
      toast(t('myWork.whiteboard.toast.noUnlockedSelection'), { duration: 900 });
      return;
    }
    const duplicateStamp = Date.now();
    const idMap = new Map<string, string>();
    const duplicatedNodes = selected.map((node, index) => {
      const newId = `${node.id}-dup-${duplicateStamp}-${index}`;
      idMap.set(node.id, newId);
      return {
        ...node,
        id: newId,
        position: { x: node.position.x + 30, y: node.position.y + 30 },
        selected: false,
        data: cloneNodeData(node, newId),
      };
    });

    pushSnapshot?.();
    setNodes((prev: Node[]) => {
      return [...prev.map((node: Node) => ({ ...node, selected: false })), ...duplicatedNodes];
    });
    setEdges((prev: Edge[]) => {
      const duplicatedEdges = buildDuplicatedEdgesFromSelection(prev, idMap, duplicateStamp);
      return [...prev, ...duplicatedEdges];
    });
    toast.success(t('myWork.whiteboard.toast.duplicated'), { duration: 600 });
  }, [locked, nodes, pushSnapshot, setEdges, setNodes, t]);

  /**
   * WB-CLIPBOARD-01 fix (2026-08-10): real object clipboard — mirrors Process
   * Flow's proven `schowekRef`/`kopiujWezly`/`pasteClipboard` pattern in
   * `processflow/useProcessFlowNodes.ts`. A `useRef` (not state — its change
   * shouldn't rerender) holds the copied node(s) plus the edges BETWEEN them;
   * this is the tool's OWN clipboard, separate from `handlePaste` in
   * `IdeaWhiteboardTool.tsx` (OS-clipboard image/text drop-paste — untouched).
   */
  const clipboardRef = useRef<{ nodes: Node[]; edges: Edge[] }>({ nodes: [], edges: [] });

  const copyNodesToClipboard = useCallback(
    (toCopy: Node[]) => {
      if (toCopy.length === 0) return 0;
      const ids = new Set(toCopy.map((node) => node.id));
      clipboardRef.current = {
        nodes: toCopy.map((node) => ({ ...node, selected: false })),
        // Only edges with BOTH endpoints inside the copied set travel along —
        // an edge to a node outside the selection would dangle after paste.
        edges: edges.filter((edge) => ids.has(edge.source) && ids.has(edge.target)),
      };
      return toCopy.length;
    },
    [edges]
  );

  /** Ctrl+C / context-menu "Copy" — copies the current selection. */
  const copySelected = useCallback(
    () => copyNodesToClipboard(nodes.filter((node) => node.selected && !isNodeLocked(node))),
    [copyNodesToClipboard, nodes]
  );

  /**
   * Copies a single node by id, for callers outside the selection flow.
   * Whiteboard's right-click handler (`handleCanvasContextMenu` in
   * IdeaWhiteboardTool.tsx) already re-selects the clicked node before the
   * context menu opens, so `copySelected()` also covers that path — this is
   * kept as an explicit, selection-independent entry point.
   */
  const copyNodeById = useCallback(
    (nodeId: string) => {
      const node = nodes.find((n: Node) => n.id === nodeId);
      return node ? copyNodesToClipboard([node]) : 0;
    },
    [copyNodesToClipboard, nodes]
  );

  /** Surfaces query this to grey out "Paste" when the clipboard is empty. */
  const clipboardCount = useCallback(() => clipboardRef.current.nodes.length, []);

  /**
   * Pastes the clipboard contents as NEW elements (new ids, offset from the
   * originals so they don't land exactly on top). Edges between copied nodes
   * are recreated between their pasted counterparts; nothing outside the
   * copied set is touched.
   */
  const pasteClipboard = useCallback(() => {
    if (locked) return 0;
    const { nodes: copiedNodes, edges: copiedEdges } = clipboardRef.current;
    if (copiedNodes.length === 0) return 0;

    const pasteStamp = Date.now();
    const idMap = new Map<string, string>();
    const newNodes: Node[] = copiedNodes.map((node, index) => {
      const newId = `${node.id}-paste-${pasteStamp}-${index}`;
      idMap.set(node.id, newId);
      return {
        ...node,
        id: newId,
        position: { x: node.position.x + 40, y: node.position.y + 40 },
        selected: false,
        data: cloneNodeData(node, newId),
      };
    });
    const newEdges: Edge[] = copiedEdges.map((edge, index) => ({
      ...edge,
      id: `${edge.id}-paste-${pasteStamp}-${index}`,
      source: idMap.get(edge.source) as string,
      target: idMap.get(edge.target) as string,
      selected: false,
      data: {
        ...(edge.data || {}),
        duplicatedFrom: edge.id,
      },
    }));

    pushSnapshot?.();
    setNodes((prev: Node[]) => [...prev, ...newNodes]);
    if (newEdges.length > 0) {
      setEdges((prev: Edge[]) => [...prev, ...newEdges]);
    }
    toast.success(t('myWork.whiteboard.toast.pasted'), { duration: 600 });
    return newNodes.length;
  }, [locked, pushSnapshot, setEdges, setNodes, t]);

  const groupSelected = useCallback(() => {
    if (locked) return;
    const selected = (nodes as Node[]).filter((n: Node) => n.selected && !isNodeLocked(n));
    if (selected.length < 2) {
      toast.error(t('myWork.whiteboard.errors.selectAtLeastTwo'));
      return;
    }
    const xs = selected.map((n) => n.position.x);
    const ys = selected.map((n) => n.position.y);
    const minX = Math.min(...xs) - 20;
    const minY = Math.min(...ys) - 40;
    const maxX = Math.max(...xs) + 200;
    const maxY = Math.max(...ys) + 160;

    const groupId = `group-${Date.now()}`;
    const groupNode: Node = {
      id: groupId,
      type: 'frameNode',
      position: { x: minX, y: minY },
      data: {
        label: t('myWork.whiteboard.nodes.groupLabel'),
        width: maxX - minX,
        height: maxY - minY,
      },
      style: { width: maxX - minX, height: maxY - minY },
    };

    pushSnapshot?.();
    setNodes((prev: Node[]) => {
      const updated = prev.map((n: Node) => {
        if (!n.selected || isNodeLocked(n)) return n;
        return { ...n, parentId: groupId, selected: false };
      });
      return [groupNode, ...updated];
    });
    toast.success(t('myWork.whiteboard.toast.grouped'), { duration: 600 });
  }, [isPl, locked, nodes, pushSnapshot, setNodes, t]);

  const ungroupSelected = useCallback(() => {
    if (locked) return;
    const selected = (nodes as Node[]).filter((n: Node) => n.selected);
    const frameIds = new Set(
      selected
        .filter((n) => (n.type === 'frameNode' || n.type === 'groupNode') && !isNodeLocked(n))
        .map((n) => n.id)
    );
    if (frameIds.size === 0) return;

    pushSnapshot?.();
    setNodes((prev: Node[]) =>
      prev
        .filter((n: Node) => !frameIds.has(n.id))
        .map((n: Node) => {
          if (n.parentId && frameIds.has(n.parentId)) {
            const { parentId: _, ...rest } = n as any;
            return rest as Node;
          }
          return n;
        })
    );
    toast.success(t('myWork.whiteboard.toast.ungrouped'), { duration: 600 });
  }, [isPl, locked, nodes, pushSnapshot, setNodes, t]);

  const distributeNodes = useCallback(
    (axis: 'horizontal' | 'vertical') => {
      setNodes((nds: Node[]) => {
        const selected = nds.filter((n: Node) => n.selected && !isNodeLocked(n));
        if (selected.length < 3) return nds;
        pushSnapshot?.();

        const sorted = [...selected].sort((a, b) =>
          axis === 'horizontal' ? a.position.x - b.position.x : a.position.y - b.position.y
        );
        const first = sorted[0].position;
        const last = sorted[sorted.length - 1].position;
        const total = axis === 'horizontal' ? last.x - first.x : last.y - first.y;
        const step = total / (sorted.length - 1);

        const posMap = new Map<string, number>();
        sorted.forEach((n, i) => {
          posMap.set(n.id, (axis === 'horizontal' ? first.x : first.y) + step * i);
        });

        const ids = new Set(selected.map((n: Node) => n.id));
        return nds.map((n: Node) => {
          if (!ids.has(n.id)) return n;
          const val = posMap.get(n.id)!;
          return {
            ...n,
            position: axis === 'horizontal' ? { ...n.position, x: val } : { ...n.position, y: val },
          };
        });
      });
    },
    [pushSnapshot, setNodes]
  );

  /**
   * WB-P2 "Tidy board" / "Auto arrange selection" (08_P1_P3_EXECUTION_PLAN
   * §6 Whiteboard). One command, two names depending on context: 2+
   * unlocked nodes selected → arranges only the selection ("Auto arrange
   * selection"); otherwise arranges the whole board ("Tidy board"). Reuses
   * `computeTidyLayout`/`resolveWhiteboardPlacement` (whiteboardPlacement.ts)
   * for the actual math — see that file's header comment for why this is an
   * explicit opt-in call pattern that does NOT weaken `createNode`'s default
   * "automatic insertion never moves an existing object" guarantee.
   *
   * Grouping/frames: a `frameNode` and all of its current children always
   * move together as ONE unit (same delta), so their relative arrangement
   * inside the frame is preserved. A child whose parent frame is NOT part of
   * this tidy pass (frame unselected during an "Auto arrange selection", or
   * the frame itself locked) is left untouched rather than drifting out of
   * its (unmoved) frame — it still counts as a fixed obstacle so tidied
   * items route around it.
   */
  const tidyBoard = useCallback(() => {
    if (locked) return;
    const all = nodes as Node[];
    const selected = all.filter((n) => n.selected && !isNodeLocked(n));
    const pool = selected.length >= 2 ? selected : all;

    const childrenByParent = new Map<string, Node[]>();
    for (const n of all) {
      const pid = (n as { parentId?: string }).parentId;
      if (pid) {
        const list = childrenByParent.get(pid) || [];
        list.push(n);
        childrenByParent.set(pid, list);
      }
    }

    interface TidyUnit {
      rect: WhiteboardRect;
      memberIds: string[];
    }
    const units: TidyUnit[] = [];
    const movingIds = new Set<string>();

    for (const n of pool) {
      if (isNodeLocked(n)) continue;
      const pid = (n as { parentId?: string }).parentId;
      // Children are folded into their parent frame's unit below (if that
      // frame is itself eligible) — never placed as independent units.
      if (pid) continue;
      const memberIds = [n.id];
      if (n.type === 'frameNode') {
        for (const child of childrenByParent.get(n.id) || []) memberIds.push(child.id);
      }
      units.push({ rect: rectOfWhiteboardNode(n), memberIds });
      memberIds.forEach((id) => movingIds.add(id));
    }

    // Nothing meaningful to reorganize — mirrors distributeNodes' silent
    // no-op below its own minimum-selection threshold.
    if (units.length < 2) return;

    const fixedRects: WhiteboardRect[] = all
      .filter((n) => !movingIds.has(n.id))
      .map((n) => rectOfWhiteboardNode(n));

    const sortedUnits = [...units].sort(
      (a, b) => a.rect.y - b.rect.y || a.rect.x - b.rect.x || a.memberIds[0].localeCompare(b.memberIds[0])
    );
    const anchor = {
      x: Math.min(...sortedUnits.map((u) => u.rect.x)),
      y: Math.min(...sortedUnits.map((u) => u.rect.y)),
    };

    const layout = computeTidyLayout({
      items: sortedUnits.map((u) => ({ id: u.memberIds[0], rect: u.rect })),
      anchor,
      fixedRects,
      grid: 8,
    });

    const deltaByNodeId = new Map<string, { dx: number; dy: number }>();
    for (const unit of sortedUnits) {
      const newPos = layout.get(unit.memberIds[0]);
      if (!newPos) continue;
      const dx = newPos.x - unit.rect.x;
      const dy = newPos.y - unit.rect.y;
      if (dx === 0 && dy === 0) continue;
      for (const id of unit.memberIds) deltaByNodeId.set(id, { dx, dy });
    }
    if (deltaByNodeId.size === 0) return; // already tidy — no undo entry, no toast

    pushSnapshot?.();
    setNodes((prev: Node[]) =>
      prev.map((n) => {
        const delta = deltaByNodeId.get(n.id);
        if (!delta) return n;
        return { ...n, position: { x: n.position.x + delta.dx, y: n.position.y + delta.dy } };
      })
    );
    toast.success(
      t(
        selected.length >= 2
          ? 'myWork.whiteboard.toast.tidiedSelection'
          : 'myWork.whiteboard.toast.tidiedBoard'
      ),
      { duration: 600 }
    );
  }, [locked, nodes, pushSnapshot, setNodes, t]);

  return {
    deleteSelected,
    duplicateSelected,
    groupSelected,
    ungroupSelected,
    distributeNodes,
    tidyBoard,
    copySelected,
    copyNodeById,
    pasteClipboard,
    clipboardCount,
  };
}
