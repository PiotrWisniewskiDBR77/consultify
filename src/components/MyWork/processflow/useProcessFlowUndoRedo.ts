/**
 * useProcessFlowUndoRedo — Extracted undo/redo stack management
 * for the Process Flow component.
 */
import { useCallback, useRef, useState } from 'react';
import type { Edge, Node } from 'reactflow';

import type { Lane } from './LaneSystem';

const MAX_UNDO_STEPS = 30;

interface UndoEntry {
  nodes: Node[];
  edges: Edge[];
  lanes: Lane[];
}

export interface UseProcessFlowUndoRedoOpts {
  nodes: Node[];
  edges: Edge[];
  lanes: Lane[];
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
  setLanes: React.Dispatch<React.SetStateAction<Lane[]>>;
}

export interface UseProcessFlowUndoRedoReturn {
  pushUndo: () => void;
  undo: () => void;
  redo: () => void;
  resetUndo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  undoRedoTick: number;
}

export function useProcessFlowUndoRedo({
  nodes,
  edges,
  lanes,
  setNodes,
  setEdges,
  setLanes,
}: UseProcessFlowUndoRedoOpts): UseProcessFlowUndoRedoReturn {
  const undoStackRef = useRef<UndoEntry[]>([]);
  const redoStackRef = useRef<UndoEntry[]>([]);
  const [undoRedoTick, setUndoRedoTick] = useState(0);

  const pushUndo = useCallback(() => {
    undoStackRef.current.push({
      nodes: JSON.parse(JSON.stringify(nodes)),
      edges: JSON.parse(JSON.stringify(edges)),
      lanes: JSON.parse(JSON.stringify(lanes)),
    });
    if (undoStackRef.current.length > MAX_UNDO_STEPS) {
      undoStackRef.current.shift();
    }
    redoStackRef.current = [];
    setUndoRedoTick((v) => v + 1);
  }, [nodes, edges, lanes]);

  const undo = useCallback(() => {
    if (undoStackRef.current.length === 0) return;
    const entry = undoStackRef.current.pop()!;
    redoStackRef.current.push({
      nodes: JSON.parse(JSON.stringify(nodes)),
      edges: JSON.parse(JSON.stringify(edges)),
      lanes: JSON.parse(JSON.stringify(lanes)),
    });
    setNodes(entry.nodes);
    setEdges(entry.edges);
    setLanes(entry.lanes);
    setUndoRedoTick((v) => v + 1);
  }, [nodes, edges, lanes, setNodes, setEdges, setLanes]);

  const redo = useCallback(() => {
    if (redoStackRef.current.length === 0) return;
    const entry = redoStackRef.current.pop()!;
    undoStackRef.current.push({
      nodes: JSON.parse(JSON.stringify(nodes)),
      edges: JSON.parse(JSON.stringify(edges)),
      lanes: JSON.parse(JSON.stringify(lanes)),
    });
    setNodes(entry.nodes);
    setEdges(entry.edges);
    setLanes(entry.lanes);
    setUndoRedoTick((v) => v + 1);
  }, [nodes, edges, lanes, setNodes, setEdges, setLanes]);

  const resetUndo = useCallback(() => {
    undoStackRef.current = [];
    redoStackRef.current = [];
    setUndoRedoTick(0);
  }, []);

  const canUndo = undoStackRef.current.length > 0;
  const canRedo = redoStackRef.current.length > 0;

  return { pushUndo, undo, redo, resetUndo, canUndo, canRedo, undoRedoTick };
}
