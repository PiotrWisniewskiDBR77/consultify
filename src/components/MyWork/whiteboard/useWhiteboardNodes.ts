/**
 * useWhiteboardNodes — Extracted node CRUD, grouping, and distribution
 * for the Whiteboard component.
 */
import { useCallback } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import type { Edge, Node } from 'reactflow';

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

  return {
    deleteSelected,
    duplicateSelected,
    groupSelected,
    ungroupSelected,
    distributeNodes,
  };
}
