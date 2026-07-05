/**
 * useIdeaCollab — DP-3 (T6): shared realtime collaboration hook for Ideas
 * canvases, parametrised by tool (mind map + whiteboard today; process flow
 * and table can adopt the same hook without further gateway changes).
 *
 * Extracted from the proven whiteboard pattern (useWhiteboardCollab, M09
 * L-02). The canvas joins the org-scoped WS room `/ws/collab/:ideaId` through
 * CollaborationOverlay, emits `graph_patch` operations on local mutations and
 * applies collaborators' patches arriving back as the window event
 * `idea-collab-graph-patch`.
 *
 * Invariants (hard lesson 26a2a896ef — the canvas must NEVER remount on an
 * edit):
 *  - remote ops are applied exclusively through FUNCTIONAL setNodes/setEdges
 *    updates on the live canvas state — no re-hydration, no key= changes;
 *  - `applyingRemoteRef` is held while a remote patch is applied so the
 *    resulting change handlers do not echo the same ops back onto the wire;
 *  - when `ideaId` is given, events tagged with a different `detail.ideaId`
 *    are ignored (multi-canvas safety); untagged events apply as before.
 */
import { useCallback, useEffect, useRef } from 'react';
import type { Edge, EdgeChange, Node, NodeChange } from 'reactflow';

export type IdeaCollabGraphOp = { op: string; data: any };

export interface UseIdeaCollabArgs {
  /** Room id — used to ignore events dispatched for another idea's canvas. */
  ideaId?: string;
  /** Which Ideas tool this canvas renders (metadata on outbound patches). */
  tool?: string;
  currentUserId: string;
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
}

export function useIdeaCollab({
  ideaId,
  tool,
  currentUserId,
  setNodes,
  setEdges,
}: UseIdeaCollabArgs) {
  const collabSendRef = useRef<((msg: any) => void) | null>(null);
  // True while applying a remote patch — prevents re-broadcasting the same ops.
  const applyingRemoteRef = useRef(false);

  const registerCollabSend = useCallback((sendFn: (msg: any) => void) => {
    collabSendRef.current = sendFn;
  }, []);

  const broadcast = useCallback(
    (operations: IdeaCollabGraphOp[]) => {
      if (applyingRemoteRef.current) return;
      if (collabSendRef.current && operations.length > 0) {
        collabSendRef.current({ type: 'graph_patch', operations, ...(tool ? { tool } : {}) });
      }
    },
    [tool]
  );

  /** Raw op broadcast — for tools that build their own graph ops. */
  const broadcastGraphPatch = useCallback(
    (operations: IdeaCollabGraphOp[]) => broadcast(operations),
    [broadcast]
  );

  // Translate React Flow node changes → graph ops. Only final positions (drag end),
  // final resize dimensions (resize end), and removals are broadcast — selection churn
  // and in-flight drag/resize frames are skipped to avoid flooding the wire.
  const broadcastNodeChanges = useCallback(
    (changes: NodeChange[], nextNodes: Node[]) => {
      if (applyingRemoteRef.current) return;
      const ops: IdeaCollabGraphOp[] = [];
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
      const ops: IdeaCollabGraphOp[] = [];
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
      if (ideaId && detail.ideaId && detail.ideaId !== ideaId) return;
      applyingRemoteRef.current = true;
      try {
        for (const op of detail.operations as IdeaCollabGraphOp[]) {
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
  }, [currentUserId, ideaId, setNodes, setEdges]);

  return {
    registerCollabSend,
    applyingRemoteRef,
    broadcastGraphPatch,
    broadcastNodeChanges,
    broadcastEdgeChanges,
    broadcastNodeAdd,
    broadcastNodeUpdate,
    broadcastEdgeAdd,
  };
}

export default useIdeaCollab;
