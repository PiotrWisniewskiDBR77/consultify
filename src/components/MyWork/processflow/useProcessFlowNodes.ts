/**
 * useProcessFlowNodes — Extracted node CRUD, lane management, and selection
 * for the Process Flow component.
 */
import { useCallback } from 'react';
import toast from 'react-hot-toast';
import type { Edge, Node } from 'reactflow';

export interface Lane {
  id: string;
  label: string;
  color: string;
}

export interface UseProcessFlowNodesOpts {
  nodes: Node[];
  edges: Edge[];
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
  lanes: Lane[];
  setLanes: React.Dispatch<React.SetStateAction<Lane[]>>;
  locked: boolean;
  isPl: boolean;
  pushUndo: () => void;
  onNodeDetail?: ((nodeId: string, data: any) => void) | undefined;
  /**
   * Optional callback fired with the ids of deleted nodes. Previously wired
   * to useProcessFlowCRUD (V8 mirror persistence); that hook was removed as
   * dead code (M07/F1, DP-7) since the V8 process-flow routes were cut. Kept
   * as a generic extension point — no current caller passes it.
   */
  onNodesDeleted?: ((nodeIds: string[]) => void) | undefined;
  /** Injected confirm for bulk deletes (≥2 nodes). Returns true = proceed. */
  confirmBulkDelete?: (count: number) => Promise<boolean>;
}

export function useProcessFlowNodes(opts: UseProcessFlowNodesOpts) {
  const {
    nodes,
    edges,
    setNodes,
    setEdges,
    lanes,
    setLanes,
    locked,
    isPl,
    pushUndo,
    onNodeDetail,
    onNodesDeleted,
    confirmBulkDelete,
  } = opts;

  const deleteSelected = useCallback(async () => {
    if (locked) return;
    const selectedCount = nodes.filter((n: Node) => n.selected).length;
    if (selectedCount === 0) return;
    if (selectedCount >= 2 && confirmBulkDelete) {
      const ok = await confirmBulkDelete(selectedCount);
      if (!ok) return;
    }
    pushUndo();
    let removedNodeIds: Set<string>;
    setNodes((prev: Node[]) => {
      removedNodeIds = new Set(prev.filter((n: Node) => n.selected).map((n: Node) => n.id));
      if (removedNodeIds.size) onNodesDeleted?.(Array.from(removedNodeIds));
      return prev.filter((n: Node) => !n.selected);
    });
    setEdges((prev: Edge[]) =>
      prev.filter(
        (e: Edge) => !e.selected && !removedNodeIds!.has(e.source) && !removedNodeIds!.has(e.target)
      )
    );
  }, [locked, nodes, confirmBulkDelete, onNodesDeleted, pushUndo, setEdges, setNodes]);

  const duplicateSelected = useCallback(() => {
    if (locked) return;
    const selected = nodes.filter((n) => n.selected);
    if (selected.length === 0) return;
    pushUndo();

    const idMap = new Map<string, string>();
    const selectedIds = new Set(selected.map((node) => node.id));

    const newNodes: Node[] = selected.map((n) => {
      const newId = `pf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      idMap.set(n.id, newId);
      return {
        ...n,
        id: newId,
        position: { x: n.position.x + 40, y: n.position.y + 40 },
        selected: false,
        data: {
          ...n.data,
          onLabelChange: (next: string) => {
            setNodes((nds: Node[]) =>
              nds.map((nd: Node) =>
                nd.id === newId ? { ...nd, data: { ...nd.data, label: next } } : nd
              )
            );
          },
          onNodeDetail: onNodeDetail || undefined,
        },
      };
    });
    const newEdges: Edge[] = edges
      .filter((edge) => selectedIds.has(edge.source) && selectedIds.has(edge.target))
      .map((edge) => ({
        ...edge,
        id: `pf-edge-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        source: idMap.get(edge.source) || edge.source,
        target: idMap.get(edge.target) || edge.target,
        selected: false,
      }));

    setNodes((prev) => [...prev, ...newNodes]);
    if (newEdges.length > 0) {
      setEdges((prev) => [...prev, ...newEdges]);
    }
  }, [edges, locked, nodes, onNodeDetail, pushUndo, setEdges, setNodes]);

  const handleLaneRename = useCallback(
    (laneId: string, next: string) => {
      if (locked) return;
      pushUndo();
      setLanes((prev: Lane[]) =>
        prev.map((l: Lane) => (l.id === laneId ? { ...l, label: next } : l))
      );
    },
    [locked, pushUndo, setLanes]
  );

  const handleLaneDelete = useCallback(
    (laneId: string) => {
      if (locked || lanes.length <= 1) return;
      pushUndo();
      const fallbackLane = lanes.find((l) => l.id !== laneId) || lanes[0];
      setNodes((prev) =>
        prev.map((n) =>
          n.data?.laneId === laneId
            ? {
                ...n,
                data: {
                  ...n.data,
                  laneId: fallbackLane.id,
                  laneColor: fallbackLane.color,
                },
              }
            : n
        )
      );
      setLanes((prev) => prev.filter((l) => l.id !== laneId));
    },
    [locked, lanes, pushUndo, setLanes, setNodes]
  );

  const handleLaneColorChange = useCallback(
    (laneId: string, color: string) => {
      if (locked) return;
      pushUndo();
      setLanes((prev) => prev.map((l) => (l.id === laneId ? { ...l, color } : l)));
      setNodes((prev) =>
        prev.map((n) =>
          n.data?.laneId === laneId ? { ...n, data: { ...n.data, laneColor: color } } : n
        )
      );
    },
    [locked, pushUndo, setLanes, setNodes]
  );

  const handleLaneMoveUp = useCallback(
    (laneId: string) => {
      if (locked) return;
      pushUndo();
      setLanes((prev) => {
        const idx = prev.findIndex((l) => l.id === laneId);
        if (idx <= 0) return prev;
        const next = [...prev];
        [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
        return next;
      });
    },
    [locked, pushUndo, setLanes]
  );

  const handleLaneMoveDown = useCallback(
    (laneId: string) => {
      if (locked) return;
      pushUndo();
      setLanes((prev) => {
        const idx = prev.findIndex((l) => l.id === laneId);
        if (idx < 0 || idx >= prev.length - 1) return prev;
        const next = [...prev];
        [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
        return next;
      });
    },
    [locked, pushUndo, setLanes]
  );

  return {
    deleteSelected,
    duplicateSelected,
    handleLaneRename,
    handleLaneDelete,
    handleLaneColorChange,
    handleLaneMoveUp,
    handleLaneMoveDown,
  };
}
