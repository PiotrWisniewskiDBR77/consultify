/**
 * useProcessFlowCollab — M07 F3: realtime graph sync for the Process Flow canvas.
 *
 * Mirrors the ONLY proven E2E model — the whiteboard (`useWhiteboardCollab`) —
 * which itself mirrors M06 Mind Map + CollaborationOverlay: the tool joins the
 * org-scoped WS room `/ws/collab/:ideaId`, emits `graph_patch` operations on
 * local mutations, and applies remote patches so a change by user A appears for
 * user B in < 1s. Persistence stays per-user (REST `/map`).
 *
 * Process-Flow extensions over the whiteboard model:
 *  - `update_lanes` — full Lane[] replacement (lanes are small; full swap gives
 *    idempotence and avoids order conflicts). Node laneId reassignment (e.g. on
 *    lane delete) rides in the SAME patch as `update_node[]` — one batch = one
 *    consistent state.
 *  - `graph_snapshot` — full nodes/edges/lanes replacement for MASS operations
 *    (undo/redo, dagre auto-layout, AI-apply). Received snapshots are pushed to
 *    the local undo stack as a single step so the recipient can consciously undo
 *    a peer's mass change.
 *
 * Echo-guard (`applyingRemoteRef`) prevents re-broadcasting remote-applied ops.
 * Autosave styk: the receive handler flags `lastChangeOriginRef = 'remote'`
 * before mutating so the host's `queueSync` effect can skip persisting a change
 * it did not author (the author persists it via its own `useIdeaMapSync`).
 *
 * Server relay: `ideaCollabWs.gateway.ts` forwards `operations` 1:1 with no
 * validation, so the two new op kinds pass through untouched — the only
 * consumer is Process Flow (the room is per-ideaId and a PF idea renders only
 * in PF).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Edge, EdgeChange, Node, NodeChange } from 'reactflow';

import type { Lane } from './LaneSystem';

type GraphOp = { op: string; data: any };

export type ChangeOrigin = 'local' | 'remote';

interface UseProcessFlowCollabArgs {
  currentUserId: string;
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
  setLanes: React.Dispatch<React.SetStateAction<Lane[]>>;
  /**
   * Called when a remote mass change (`graph_snapshot`) is applied, so the host
   * can push the pre-change state onto its undo stack as one step. Passed the
   * snapshot that is about to be applied (host decides how to record it).
   */
  onRemoteSnapshot?: (snapshot: { nodes: Node[]; edges: Edge[]; lanes: Lane[] }) => void;
  /**
   * Flips to `'remote'` immediately before a remote patch mutates state so the
   * autosave effect can skip persisting a peer's change. Host resets to
   * `'local'` after its queueSync check runs. See lastChangeOriginRef below.
   */
  lastChangeOriginRef: React.MutableRefObject<ChangeOrigin>;
}

export function useProcessFlowCollab({
  currentUserId,
  setNodes,
  setEdges,
  setLanes,
  onRemoteSnapshot,
  lastChangeOriginRef,
}: UseProcessFlowCollabArgs) {
  const collabSendRef = useRef<((msg: any) => void) | null>(null);
  // True while applying a remote patch — prevents re-broadcasting the same ops.
  const applyingRemoteRef = useRef(false);
  // Soft locks: nodes locked by OTHER users (from CollaborationOverlay session).
  const [lockedByOthers, setLockedByOthers] = useState<Set<string>>(() => new Set());

  const registerCollabSend = useCallback((sendFn: (msg: any) => void) => {
    collabSendRef.current = sendFn;
  }, []);

  const broadcast = useCallback((operations: GraphOp[]) => {
    if (applyingRemoteRef.current) return;
    if (collabSendRef.current && operations.length > 0) {
      collabSendRef.current({ type: 'graph_patch', operations });
    }
  }, []);

  // React Flow node changes → ops. Only final positions (drag end) and removals
  // are broadcast; selection churn and in-flight drag frames are skipped. When a
  // cross-lane drag ends the recomputed laneId lives in the node's data, so the
  // update_node payload carries {position, data} for the moved node.
  const broadcastNodeChanges = useCallback(
    (changes: NodeChange[], nextNodes: Node[]) => {
      if (applyingRemoteRef.current) return;
      const ops: GraphOp[] = [];
      for (const change of changes) {
        if (change.type === 'position' && (change as any).dragging === false && change.id) {
          const node = nextNodes.find((n) => n.id === change.id);
          if (node)
            ops.push({
              op: 'update_node',
              data: { id: node.id, position: node.position, data: node.data },
            });
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
      broadcast(arr.map((n) => ({ op: 'add_node', data: sanitizeNode(n) })));
    },
    [broadcast]
  );

  const broadcastNodeUpdate = useCallback(
    (node: Node) => broadcast([{ op: 'update_node', data: sanitizeNode(node) }]),
    [broadcast]
  );

  const broadcastEdgeAdd = useCallback(
    (edge: Edge | Edge[]) => {
      const arr = Array.isArray(edge) ? edge : [edge];
      broadcast(arr.map((e) => ({ op: 'add_edge', data: sanitizeEdge(e) })));
    },
    [broadcast]
  );

  const broadcastEdgeUpdate = useCallback(
    (edge: Edge) => broadcast([{ op: 'update_edge', data: sanitizeEdge(edge) }]),
    [broadcast]
  );

  const broadcastEdgeRemove = useCallback(
    (edgeIds: string | string[]) => {
      const arr = Array.isArray(edgeIds) ? edgeIds : [edgeIds];
      broadcast(arr.map((id) => ({ op: 'remove_edge', data: { id } })));
    },
    [broadcast]
  );

  const broadcastNodeRemove = useCallback(
    (nodeIds: string | string[]) => {
      const arr = Array.isArray(nodeIds) ? nodeIds : [nodeIds];
      broadcast(arr.map((id) => ({ op: 'remove_node', data: { id } })));
    },
    [broadcast]
  );

  /**
   * Emit a batch of arbitrary ops (e.g. insertBetween: add_node + remove_edge +
   * add_edge[]). Callers pass already-sanitized data for add ops.
   */
  const broadcastOps = useCallback((operations: GraphOp[]) => broadcast(operations), [broadcast]);

  // PF-only: full Lane[] replacement, optionally with node laneId reassignment.
  const broadcastLanes = useCallback(
    (lanes: Lane[], nodeUpdates?: Node[]) => {
      const ops: GraphOp[] = [{ op: 'update_lanes', data: { lanes } }];
      if (nodeUpdates && nodeUpdates.length > 0) {
        for (const n of nodeUpdates) {
          ops.push({ op: 'update_node', data: sanitizeNode(n) });
        }
      }
      broadcast(ops);
    },
    [broadcast]
  );

  // PF-only: full state snapshot for mass ops (undo/redo, auto-layout, AI-apply).
  const broadcastSnapshot = useCallback(
    (snapshot: { nodes: Node[]; edges: Edge[]; lanes: Lane[] }) => {
      broadcast([
        {
          op: 'graph_snapshot',
          data: {
            nodes: snapshot.nodes.map(sanitizeNode),
            edges: snapshot.edges.map(sanitizeEdge),
            lanes: snapshot.lanes,
          },
        },
      ]);
    },
    [broadcast]
  );

  // Soft locks: derive the set of nodes locked by OTHER users from the session
  // state surfaced by CollaborationOverlay's onSessionStateChange.
  const onSessionState = useCallback(
    (state: { lockedNodes?: Record<string, string> } | null) => {
      if (!state?.lockedNodes) {
        setLockedByOthers((prev) => (prev.size === 0 ? prev : new Set()));
        return;
      }
      const next = new Set<string>();
      for (const [nodeId, uid] of Object.entries(state.lockedNodes)) {
        if (uid && uid !== currentUserId) next.add(nodeId);
      }
      setLockedByOthers((prev) => (setsEqual(prev, next) ? prev : next));
    },
    [currentUserId]
  );

  // Apply incoming patches from collaborators (skip our own echo).
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail?.operations || detail.userId === currentUserId) return;
      applyingRemoteRef.current = true;
      // Autosave styk: mark origin remote so the host's queueSync effect skips
      // persisting a change it did not author.
      lastChangeOriginRef.current = 'remote';
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
                prev.map((n) => (n.id === op.data.id ? mergeNode(n, op.data) : n))
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
            case 'update_lanes':
              if (Array.isArray(op.data?.lanes)) setLanes(op.data.lanes as Lane[]);
              break;
            case 'graph_snapshot': {
              const snap = op.data as { nodes: Node[]; edges: Edge[]; lanes: Lane[] };
              if (!snap) break;
              // Let the host push the CURRENT state onto its undo stack as one
              // step before we overwrite it (so a peer's mass change is undoable).
              onRemoteSnapshot?.(snap);
              if (Array.isArray(snap.nodes)) setNodes(snap.nodes);
              if (Array.isArray(snap.edges)) setEdges(snap.edges);
              if (Array.isArray(snap.lanes)) setLanes(snap.lanes);
              break;
            }
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
  }, [currentUserId, lastChangeOriginRef, onRemoteSnapshot, setEdges, setLanes, setNodes]);

  return useMemo(
    () => ({
      registerCollabSend,
      applyingRemoteRef,
      broadcastNodeChanges,
      broadcastEdgeChanges,
      broadcastNodeAdd,
      broadcastNodeUpdate,
      broadcastNodeRemove,
      broadcastEdgeAdd,
      broadcastEdgeUpdate,
      broadcastEdgeRemove,
      broadcastOps,
      broadcastLanes,
      broadcastSnapshot,
      onSessionState,
      lockedByOthers,
    }),
    [
      registerCollabSend,
      broadcastNodeChanges,
      broadcastEdgeChanges,
      broadcastNodeAdd,
      broadcastNodeUpdate,
      broadcastNodeRemove,
      broadcastEdgeAdd,
      broadcastEdgeUpdate,
      broadcastEdgeRemove,
      broadcastOps,
      broadcastLanes,
      broadcastSnapshot,
      onSessionState,
      lockedByOthers,
    ]
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Strip non-serializable node.data callbacks (onLabelChange, onNodeDetail, …)
 * before sending over the wire. The receiver re-hydrates its own callbacks via
 * update_node merge / next local render; sending functions would JSON-drop them
 * anyway, so we drop them explicitly to keep the payload clean.
 */
function sanitizeNode(node: Node): Node {
  const data = node.data && typeof node.data === 'object' ? stripFunctions(node.data) : node.data;
  return { ...node, data };
}

function sanitizeEdge(edge: Edge): Edge {
  const data = edge.data && typeof edge.data === 'object' ? stripFunctions(edge.data) : edge.data;
  return { ...edge, data };
}

function stripFunctions(obj: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'function') continue;
    out[k] = v;
  }
  return out;
}

/**
 * Merge a remote update_node onto the local node WITHOUT clobbering local-only
 * data callbacks: the incoming data is shallow-merged into the existing data so
 * the recipient keeps its own onLabelChange/onNodeDetail handlers.
 */
function mergeNode(local: Node, incoming: Partial<Node> & { data?: any }): Node {
  const merged: Node = { ...local, ...incoming } as Node;
  if (incoming.data && typeof incoming.data === 'object') {
    merged.data = { ...local.data, ...incoming.data };
  }
  return merged;
}

function setsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

export default useProcessFlowCollab;
