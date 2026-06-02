/**
 * useProcessFlowCRUD — V8 API CRUD wiring for process flow nodes/edges.
 *
 * Persists the *structural* graph (semantic nodes + typed edges) to the
 * dedicated V8 process-flow tables (`v8.v8_process_flow_nodes/edges`) so the
 * BPMN-ish semantics survive a reload — the shared map-sync blob alone loses
 * object_type / gateway_kind / lane semantics.
 *
 * Runs *alongside* the shared workspace sync; every call is fire-and-forget and
 * never blocks or throws into the canvas. Enable via `enabled: true`.
 *
 * The backend contract (server/src/routes/v8/processFlow.routes.ts) uses
 * snake_case body fields: object_type, position_x/position_y, lane_id,
 * source_node_id/target_node_id, gateway_kind. This hook owns that mapping so
 * callers can pass the UI's `FlowShape` directly.
 */
import { useCallback, useMemo } from 'react';

import { API_URL, getHeaders } from '@/services/api';

interface UseProcessFlowCRUDOpts {
  processId: string;
  enabled?: boolean;
}

/** Backend semantic object types (mirror of P14_SEMANTIC_OBJECTS). */
export type ProcessFlowObjectType =
  | 'start_event'
  | 'end_event'
  | 'task'
  | 'decision_gateway'
  | 'parallel_gateway'
  | 'subprocess'
  | 'lane'
  | 'pool'
  | 'sequence_flow'
  | 'message_flow'
  | 'annotation';

/**
 * Map a UI FlowShape to a backend semantic object type. Anything not a clear
 * event/gateway/container collapses to `task` (the BPMN atomic unit), matching
 * the server-side P14_NODE_KINDS_MAPPING posture.
 */
export function shapeToObjectType(shape: string): ProcessFlowObjectType {
  switch (shape) {
    case 'start':
    case 'auto_trigger':
    case 'bpmn_event':
      return 'start_event';
    case 'end':
      return 'end_event';
    case 'decision':
    case 'bpmn_gateway':
    case 'auto_condition':
      return 'decision_gateway';
    case 'system_db':
    case 'system_service':
    case 'vsm_inventory':
    case 'vsm_supermarket':
      return 'subprocess';
    case 'org_handoff':
    case 'vsm_push_arrow':
    case 'vsm_pull_arrow':
      return 'message_flow';
    case 'org_role':
    case 'org_team':
      return 'lane';
    default:
      return 'task';
  }
}

export function useProcessFlowCRUD({ processId, enabled = false }: UseProcessFlowCRUDOpts) {
  const callApi = useCallback(
    async <T = unknown>(
      method: 'GET' | 'POST' | 'PUT' | 'DELETE',
      path: string,
      body?: unknown
    ): Promise<T | null> => {
      if (!enabled || !processId) return null;
      try {
        const res = await fetch(`${API_URL}/v8/process-flow/${path}`, {
          method,
          headers: getHeaders(),
          body: body ? JSON.stringify(body) : undefined,
        });
        if (!res.ok) return null;
        return (await res.json().catch(() => null)) as T | null;
      } catch {
        // Fire-and-forget: degraded mode is surfaced separately via the health poll.
        return null;
      }
    },
    [enabled, processId]
  );

  const fetchContract = useCallback(() => callApi('GET', 'contract'), [callApi]);

  const fetchObjects = useCallback(
    () => callApi('GET', `${processId}/objects`),
    [callApi, processId]
  );

  const createNode = useCallback(
    (data: {
      shape: string;
      label: string;
      position?: { x: number; y: number };
      laneId?: string | null;
      gatewayKind?: 'xor' | 'and' | null;
    }) =>
      callApi('POST', `${processId}/nodes`, {
        object_type: shapeToObjectType(data.shape),
        label: data.label,
        position_x: data.position?.x ?? 0,
        position_y: data.position?.y ?? 0,
        lane_id: data.laneId ?? null,
        gateway_kind: data.gatewayKind ?? null,
      }),
    [callApi, processId]
  );

  const updateNodeLabel = useCallback(
    (nodeId: string, label: string) => callApi('PUT', `nodes/${nodeId}/label`, { label }),
    [callApi]
  );

  const moveNode = useCallback(
    (nodeId: string, position: { x: number; y: number }) =>
      callApi('PUT', `nodes/${nodeId}/move`, { position_x: position.x, position_y: position.y }),
    [callApi]
  );

  const updateGatewayKind = useCallback(
    (nodeId: string, gatewayKind: 'xor' | 'and') =>
      callApi('PUT', `nodes/${nodeId}/gateway-kind`, { gateway_kind: gatewayKind }),
    [callApi]
  );

  const updateNodeLane = useCallback(
    (nodeId: string, laneId: string | null) =>
      callApi('PUT', `nodes/${nodeId}/lane`, { lane_id: laneId }),
    [callApi]
  );

  const deleteNode = useCallback(
    (nodeId: string) => callApi('DELETE', `nodes/${nodeId}`),
    [callApi]
  );

  const createEdge = useCallback(
    (data: { source: string; target: string; label?: string; type?: string }) =>
      callApi('POST', `${processId}/edges`, {
        source_node_id: data.source,
        target_node_id: data.target,
        label: data.label,
        edge_type: data.type ?? 'sequence_flow',
      }),
    [callApi, processId]
  );

  const updateEdgeLabel = useCallback(
    (edgeId: string, label: string) => callApi('PUT', `edges/${edgeId}/label`, { label }),
    [callApi]
  );

  const deleteEdge = useCallback(
    (edgeId: string) => callApi('DELETE', `edges/${edgeId}`),
    [callApi]
  );

  const fetchProposal = useCallback(
    (proposalId: string) => callApi('GET', `ai-proposals/${proposalId}`),
    [callApi]
  );

  return useMemo(
    () => ({
      enabled,
      fetchContract,
      fetchObjects,
      createNode,
      updateNodeLabel,
      moveNode,
      updateGatewayKind,
      updateNodeLane,
      deleteNode,
      createEdge,
      updateEdgeLabel,
      deleteEdge,
      fetchProposal,
    }),
    [
      enabled,
      fetchContract,
      fetchObjects,
      createNode,
      updateNodeLabel,
      moveNode,
      updateGatewayKind,
      updateNodeLane,
      deleteNode,
      createEdge,
      updateEdgeLabel,
      deleteEdge,
      fetchProposal,
    ]
  );
}
