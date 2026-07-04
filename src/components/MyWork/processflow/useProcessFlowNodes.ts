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
  /**
   * M07 F3 realtime emission. Optional so this hook stays usable without a
   * collab layer (tests, single-user). Each fires AFTER local state is set.
   */
  collab?: {
    broadcastNodeRemove?: (ids: string[]) => void;
    broadcastEdgeRemove?: (ids: string[]) => void;
    broadcastOps?: (ops: Array<{ op: string; data: any }>) => void;
    broadcastLanes?: (lanes: Lane[], nodeUpdates?: Node[]) => void;
  };
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
    collab,
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
    const removedEdgeIds: string[] = [];
    setEdges((prev: Edge[]) =>
      prev.filter((e: Edge) => {
        const keep =
          !e.selected && !removedNodeIds!.has(e.source) && !removedNodeIds!.has(e.target);
        if (!keep) removedEdgeIds.push(e.id);
        return keep;
      })
    );
    // F3: emit removed edges then nodes as one batch (edges first so peers drop
    // dangling connectors before their endpoints disappear).
    const removedNodeIdList = Array.from(removedNodeIds!);
    if (removedEdgeIds.length > 0 || removedNodeIdList.length > 0) {
      collab?.broadcastOps?.([
        ...removedEdgeIds.map((id) => ({ op: 'remove_edge', data: { id } })),
        ...removedNodeIdList.map((id) => ({ op: 'remove_node', data: { id } })),
      ]);
    }
  }, [locked, nodes, confirmBulkDelete, onNodesDeleted, pushUndo, setEdges, setNodes, collab]);

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
    // F3: emit the duplicated nodes + edges as one batch.
    collab?.broadcastOps?.([
      ...newNodes.map((n) => ({ op: 'add_node', data: n })),
      ...newEdges.map((e) => ({ op: 'add_edge', data: e })),
    ]);
  }, [edges, locked, nodes, onNodeDetail, pushUndo, setEdges, setNodes, collab]);

  const handleLaneRename = useCallback(
    (laneId: string, next: string) => {
      if (locked) return;
      pushUndo();
      setLanes((prev: Lane[]) => {
        const nextLanes = prev.map((l: Lane) => (l.id === laneId ? { ...l, label: next } : l));
        collab?.broadcastLanes?.(nextLanes);
        return nextLanes;
      });
    },
    [locked, pushUndo, setLanes, collab]
  );

  const handleLaneDelete = useCallback(
    (laneId: string) => {
      if (locked || lanes.length <= 1) return;
      pushUndo();
      const fallbackLane = lanes.find((l) => l.id !== laneId) || lanes[0];
      const reassigned: Node[] = [];
      setNodes((prev) =>
        prev.map((n) => {
          if (n.data?.laneId !== laneId) return n;
          const nextNode = {
            ...n,
            data: {
              ...n.data,
              laneId: fallbackLane.id,
              laneColor: fallbackLane.color,
            },
          };
          reassigned.push(nextNode);
          return nextNode;
        })
      );
      const nextLanes = lanes.filter((l) => l.id !== laneId);
      setLanes(nextLanes);
      // F3: lane removal + node reassignment as ONE batch (update_lanes carries
      // the new Lane[]; the reassigned nodes ride as update_node[]).
      collab?.broadcastLanes?.(nextLanes, reassigned);
    },
    [locked, lanes, pushUndo, setLanes, setNodes, collab]
  );

  const handleLaneColorChange = useCallback(
    (laneId: string, color: string) => {
      if (locked) return;
      pushUndo();
      const recolored: Node[] = [];
      let nextLanes: Lane[] = lanes;
      setLanes((prev) => {
        nextLanes = prev.map((l) => (l.id === laneId ? { ...l, color } : l));
        return nextLanes;
      });
      setNodes((prev) =>
        prev.map((n) => {
          if (n.data?.laneId !== laneId) return n;
          const nextNode = { ...n, data: { ...n.data, laneColor: color } };
          recolored.push(nextNode);
          return nextNode;
        })
      );
      // F3: lane color + affected node laneColor as one batch.
      collab?.broadcastLanes?.(nextLanes, recolored);
    },
    [locked, lanes, pushUndo, setLanes, setNodes, collab]
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
        collab?.broadcastLanes?.(next);
        return next;
      });
    },
    [locked, pushUndo, setLanes, collab]
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
        collab?.broadcastLanes?.(next);
        return next;
      });
    },
    [locked, pushUndo, setLanes, collab]
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
