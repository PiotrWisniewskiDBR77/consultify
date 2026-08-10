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

/**
 * WB-FRAME-01 (frame context menu, 2026-08-10) — a node's containing frame
 * id, if any. Data model check performed BEFORE writing the functions below
 * (see report): a whiteboard node can carry containment on TWO different
 * fields, which mean two DIFFERENT position semantics —
 *   • `parentNode` — ReactFlow v11's own containment field, set ONLY by the
 *     hydrate/normalize step in `IdeaWhiteboardTool.tsx` (loaded/reloaded
 *     boards). ReactFlow reads it natively: once set, `position` is
 *     RELATIVE to the parent frame's own `position`.
 *   • `parentId` — this app's OWN bookkeeping field (read by `tidyBoard`/
 *     collapse/visibility above), also set by `groupSelected` below, which
 *     does NOT set `parentNode` — so a frame grouped in the CURRENT session
 *     (not yet round-tripped through save/reload) has children whose
 *     `position` is still ABSOLUTE, even though they already carry
 *     `parentId`. This is a pre-existing inconsistency, not introduced here
 *     — every function below reads `hasNativeParent = Boolean(node.parentNode)`
 *     before treating a position as relative, rather than assuming either.
 */
function containingFrameId(node: Node): string | undefined {
  return (
    (node as { parentNode?: string }).parentNode ||
    (node as { parentId?: string }).parentId ||
    (node.data as { parentId?: string } | undefined)?.parentId
  );
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

  /**
   * WB-FRAME-01 — "Select contents": selects every node currently contained
   * by `frameId` (the frame itself stays unselected, matching "select the
   * things inside", not "select the frame too").
   */
  const selectFrameContents = useCallback(
    (frameId: string) => {
      const all = nodes as Node[];
      const childIds = new Set(
        all.filter((n) => containingFrameId(n) === frameId).map((n) => n.id)
      );
      if (childIds.size === 0) {
        toast(t('myWork.whiteboard.toast.frameEmpty'), { duration: 900 });
        return;
      }
      setNodes((prev: Node[]) => prev.map((n) => ({ ...n, selected: childIds.has(n.id) })));
    },
    [nodes, setNodes, t]
  );

  /**
   * WB-FRAME-01 — "Add selection to frame": assigns every currently
   * selected, unlocked, currently-UNPARENTED, non-frame node as a child of
   * `frameId`. Scoped down deliberately: moving a node that ALREADY belongs
   * to a different frame, or nesting one frame inside another, is excluded
   * rather than guessed at — neither has an established, tested position
   * semantics elsewhere in this file (see `containingFrameId` header
   * comment), so silently attempting either would risk a wrong visual jump.
   * Sets BOTH `parentNode` (real ReactFlow containment — position becomes
   * frame-relative) AND `parentId` (this app's own bookkeeping field), so
   * the result behaves identically to a hydrated frame child, not just the
   * same-session-only shape `groupSelected` above produces.
   */
  const addSelectionToFrame = useCallback(
    (frameId: string) => {
      if (locked) return;
      const all = nodes as Node[];
      const frame = all.find((n) => n.id === frameId);
      if (!frame || isNodeLocked(frame)) return;
      const toAdd = all.filter(
        (n) =>
          n.selected &&
          n.id !== frameId &&
          !isNodeLocked(n) &&
          !containingFrameId(n) &&
          n.type !== 'frameNode' &&
          n.type !== 'groupNode'
      );
      if (toAdd.length === 0) {
        toast(t('myWork.whiteboard.toast.frameNoSelection'), { duration: 900 });
        return;
      }
      const addIds = new Set(toAdd.map((n) => n.id));
      pushSnapshot?.();
      setNodes((prev: Node[]) => {
        const next = prev.map((n) => {
          if (!addIds.has(n.id)) return n;
          return {
            ...n,
            parentNode: frameId,
            parentId: frameId,
            position: { x: n.position.x - frame.position.x, y: n.position.y - frame.position.y },
            selected: false,
          };
        });
        // ReactFlow requires a parent node to precede its children in the
        // array — move the frame to the front, the same convention
        // `groupSelected` above already uses for brand-new frames.
        const frameIdx = next.findIndex((n) => n.id === frameId);
        if (frameIdx > 0) {
          const [frameNode] = next.splice(frameIdx, 1);
          next.unshift(frameNode);
        }
        return next;
      });
      toast.success(t('myWork.whiteboard.toast.frameAdded'), { duration: 600 });
    },
    [locked, nodes, pushSnapshot, setNodes, t]
  );

  /**
   * WB-FRAME-01 — "Remove from frame": releases ONE child from its
   * containing frame, converting its position back to absolute canvas
   * coordinates so it doesn't visually jump (see `containingFrameId`
   * header comment for why the conversion is conditional on
   * `parentNode`/`hasNativeParent`).
   */
  const removeFromFrame = useCallback(
    (nodeId: string) => {
      if (locked) return;
      const all = nodes as Node[];
      const node = all.find((n) => n.id === nodeId);
      if (!node || isNodeLocked(node)) return;
      const frameId = containingFrameId(node);
      if (!frameId) return;
      const frame = all.find((n) => n.id === frameId);
      const hasNativeParent = Boolean((node as { parentNode?: string }).parentNode);
      const absolutePosition =
        hasNativeParent && frame
          ? { x: node.position.x + frame.position.x, y: node.position.y + frame.position.y }
          : node.position;
      pushSnapshot?.();
      setNodes((prev: Node[]) =>
        prev.map((n) => {
          if (n.id !== nodeId) return n;
          const { parentNode: _pn, parentId: _pid, ...rest } = n as Node & {
            parentNode?: string;
            parentId?: string;
          };
          const nextData = { ...(n.data as Record<string, unknown>) };
          delete nextData.parentId;
          return { ...rest, data: nextData, position: absolutePosition } as Node;
        })
      );
      toast.success(t('myWork.whiteboard.toast.frameReleaseOne'), { duration: 600 });
    },
    [locked, nodes, pushSnapshot, setNodes, t]
  );

  /**
   * WB-FRAME-01 — "Resize to fit contents": grows (never shrinks, never
   * moves the frame's own top-left corner) the frame so every child's
   * bottom-right extent fits inside it. Deliberately scoped down to
   * grow-only: a child sitting above/left of the frame's own origin would
   * need the frame's position AND every sibling's position renegotiated
   * together to fit without the frame jumping — out of scope here, so such
   * a child just stays partly outside after this runs (honest limitation,
   * not silently "fixed").
   */
  const resizeFrameToFit = useCallback(
    (frameId: string) => {
      if (locked) return;
      const all = nodes as Node[];
      const frame = all.find((n) => n.id === frameId);
      if (!frame || isNodeLocked(frame)) return;
      const children = all.filter((n) => containingFrameId(n) === frameId);
      if (children.length === 0) {
        toast(t('myWork.whiteboard.toast.frameEmpty'), { duration: 900 });
        return;
      }
      const PADDING = 24;
      const HEADER = 40;
      let maxX = 0;
      let maxY = 0;
      for (const child of children) {
        const hasNativeParent = Boolean((child as { parentNode?: string }).parentNode);
        const rel = hasNativeParent
          ? child.position
          : { x: child.position.x - frame.position.x, y: child.position.y - frame.position.y };
        const rect = rectOfWhiteboardNode({ ...child, position: rel });
        maxX = Math.max(maxX, rel.x + rect.width);
        maxY = Math.max(maxY, rel.y + rect.height);
      }
      const currentWidth = Number((frame.data as any)?.width ?? (frame.style as any)?.width ?? 400);
      const currentHeight = Number(
        (frame.data as any)?.height ?? (frame.style as any)?.height ?? 300
      );
      const newWidth = Math.max(currentWidth, Math.ceil(maxX + PADDING));
      const newHeight = Math.max(currentHeight, Math.ceil(maxY + PADDING + HEADER));
      if (newWidth === currentWidth && newHeight === currentHeight) {
        toast(t('myWork.whiteboard.toast.frameAlreadyFits'), { duration: 900 });
        return;
      }
      pushSnapshot?.();
      setNodes((prev: Node[]) =>
        prev.map((n) =>
          n.id === frameId
            ? {
                ...n,
                data: { ...n.data, width: newWidth, height: newHeight },
                style: { ...(n.style as Record<string, unknown>), width: newWidth, height: newHeight },
              }
            : n
        )
      );
      toast.success(t('myWork.whiteboard.toast.frameResized'), { duration: 600 });
    },
    [locked, nodes, pushSnapshot, setNodes, t]
  );

  /**
   * WB-FRAME-01 — "Delete frame": explicit choice between deleting the
   * frame's contents along with it, or releasing the contents (converted
   * back to absolute position, same conversion as `removeFromFrame`) and
   * deleting only the frame node itself. Replaces the previous silent
   * behavior of the generic `deleteSelected` on a frame, which removed the
   * frame and left children with a dangling `parentId`/`parentNode`
   * pointing at a node that no longer exists.
   */
  const deleteFrame = useCallback(
    (frameId: string, releaseContents: boolean) => {
      if (locked) return;
      const all = nodes as Node[];
      const frame = all.find((n) => n.id === frameId);
      if (!frame || isNodeLocked(frame)) return;
      const children = all.filter((n) => containingFrameId(n) === frameId);
      pushSnapshot?.();
      if (releaseContents) {
        setNodes((prev: Node[]) =>
          prev
            .filter((n) => n.id !== frameId)
            .map((n) => {
              if (containingFrameId(n) !== frameId) return n;
              const hasNativeParent = Boolean((n as { parentNode?: string }).parentNode);
              const absolutePosition = hasNativeParent
                ? { x: n.position.x + frame.position.x, y: n.position.y + frame.position.y }
                : n.position;
              const { parentNode: _pn, parentId: _pid, ...rest } = n as Node & {
                parentNode?: string;
                parentId?: string;
              };
              const nextData = { ...(n.data as Record<string, unknown>) };
              delete nextData.parentId;
              return { ...rest, data: nextData, position: absolutePosition } as Node;
            })
        );
        toast.success(t('myWork.whiteboard.toast.frameDeletedReleased'), { duration: 700 });
      } else {
        const removedIds = new Set([frameId, ...children.map((c) => c.id)]);
        setNodes((prev: Node[]) => prev.filter((n) => !removedIds.has(n.id)));
        setEdges((prev: Edge[]) =>
          prev.filter((e) => !removedIds.has(e.source) && !removedIds.has(e.target))
        );
        toast.success(t('myWork.whiteboard.toast.frameDeletedWithContents'), { duration: 700 });
      }
    },
    [locked, nodes, pushSnapshot, setNodes, setEdges, t]
  );

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
    selectFrameContents,
    addSelectionToFrame,
    removeFromFrame,
    resizeFrameToFit,
    deleteFrame,
  };
}
