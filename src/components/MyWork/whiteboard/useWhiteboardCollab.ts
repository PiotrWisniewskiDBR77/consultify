/**
 * useWhiteboardCollab — M09 L-02: realtime graph sync for the whiteboard.
 *
 * Mirrors the proven M06 Mind Map model (IdeaRecommendationMap + CollaborationOverlay):
 * the board joins the org-scoped WS room `/ws/collab/:ideaId`, emits `graph_patch`
 * operations on local mutations, and applies remote patches to the shared board so
 * a change by user A appears for user B in < 1s. Persistence stays per-user (REST
 * `/map`); the org-read fallback (L-01) gives the 2nd participant the initial board.
 *
 * `applyingRemoteRef` guards against echoing remote-applied changes back onto the wire.
 */
import { useCallback, useEffect, useRef } from 'react';
import type { Edge, EdgeChange, Node, NodeChange } from 'reactflow';

type GraphOp = { op: string; data: any };

interface UseWhiteboardCollabArgs {
  currentUserId: string;
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
}

export function useWhiteboardCollab({
  currentUserId,
  setNodes,
  setEdges,
}: UseWhiteboardCollabArgs) {
  const collabSendRef = useRef<((msg: any) => void) | null>(null);
  // True while applying a remote patch — prevents re-broadcasting the same ops.
  const applyingRemoteRef = useRef(false);

  const registerCollabSend = useCallback((sendFn: (msg: any) => void) => {
    collabSendRef.current = sendFn;
  }, []);

  const broadcast = useCallback((operations: GraphOp[]) => {
    if (applyingRemoteRef.current) return;
    if (collabSendRef.current && operations.length > 0) {
      collabSendRef.current({ type: 'graph_patch', operations });
    }
  }, []);

  // Translate React Flow node changes → graph ops. Only final positions (drag end),
  // final resize dimensions (resize end), and removals are broadcast — selection churn
  // and in-flight drag/resize frames are skipped to avoid flooding the wire.
  const broadcastNodeChanges = useCallback(
    (changes: NodeChange[], nextNodes: Node[]) => {
      if (applyingRemoteRef.current) return;
      const ops: GraphOp[] = [];
      for (const change of changes) {
        if (change.type === 'position' && change.dragging === false && change.id) {
          const node = nextNodes.find((n) => n.id === change.id);
          if (node) ops.push({ op: 'update_node', data: { id: node.id, position: node.position } });
        } else if (change.type === 'dimensions' && change.resizing === false && change.id) {
          // L-05b: propagate the final resized box (NodeResizer writes node.style).
          const node = nextNodes.find((n) => n.id === change.id);
          if (node) ops.push({ op: 'update_node', data: { id: node.id, style: node.style } });
        } else if (change.type === 'remove' && change.id) {
          ops.push({ op: 'remove_node', data: { id: change.id } });
        }
      }
      broadcast(ops);
    },
    [broadcast]
  );

  const broadcastEdgeChanges = useCallback(
    (changes: EdgeChange[]) => {
      if (applyingRemoteRef.current) return;
      const ops: GraphOp[] = [];
      for (const change of changes) {
        if (change.type === 'remove' && change.id) {
          ops.push({ op: 'remove_edge', data: { id: change.id } });
        }
      }
      broadcast(ops);
    },
    [broadcast]
  );

  const broadcastNodeAdd = useCallback(
    (node: Node | Node[]) => {
      const arr = Array.isArray(node) ? node : [node];
      broadcast(arr.map((n) => ({ op: 'add_node', data: n })));
    },
    [broadcast]
  );

  const broadcastNodeUpdate = useCallback(
    (node: Node) => broadcast([{ op: 'update_node', data: node }]),
    [broadcast]
  );

  const broadcastEdgeAdd = useCallback(
    (edge: Edge) => broadcast([{ op: 'add_edge', data: edge }]),
    [broadcast]
  );

  // Apply incoming patches from collaborators (skip our own echo).
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail?.operations || detail.userId === currentUserId) return;
      applyingRemoteRef.current = true;
      try {
        for (const op of detail.operations as GraphOp[]) {
          switch (op.op) {
            case 'add_node':
              setNodes((prev) =>
                prev.some((n) => n.id === op.data.id) ? prev : [...prev, op.data]
              );
              break;
            case 'remove_node':
              setNodes((prev) => prev.filter((n) => n.id !== op.data.id));
              break;
            case 'update_node':
              setNodes((prev) =>
                prev.map((n) => {
                  if (n.id !== op.data.id) return n;
                  // Shallow-merge the node, but DEEP-merge `data` when the patch
                  // carries a partial data slice (B4 reactions send only
                  // `{ id, data: { reactions } }`) so we don't clobber label/etc.
                  // Position/style-only patches (no `data`) keep prior behaviour.
                  const merged = { ...n, ...op.data } as Node;
                  if (op.data.data && typeof op.data.data === 'object') {
                    merged.data = { ...n.data, ...op.data.data };
                  }
                  return merged;
                })
              );
              break;
            case 'add_edge':
              setEdges((prev) =>
                prev.some((ed) => ed.id === op.data.id) ? prev : [...prev, op.data]
              );
              break;
            case 'remove_edge':
              setEdges((prev) => prev.filter((ed) => ed.id !== op.data.id));
              break;
            case 'update_edge':
              setEdges((prev) =>
                prev.map((ed) => (ed.id === op.data.id ? { ...ed, ...op.data } : ed))
              );
              break;
            default:
              break;
          }
        }
      } finally {
        // Release on the next tick so the setState batch flushes without echoing.
        setTimeout(() => {
          applyingRemoteRef.current = false;
        }, 0);
      }
    };
    window.addEventListener('idea-collab-graph-patch', handler);
    return () => window.removeEventListener('idea-collab-graph-patch', handler);
  }, [currentUserId, setNodes, setEdges]);

  return {
    registerCollabSend,
    applyingRemoteRef,
    broadcastNodeChanges,
    broadcastEdgeChanges,
    broadcastNodeAdd,
    broadcastNodeUpdate,
    broadcastEdgeAdd,
  };
}

export default useWhiteboardCollab;
