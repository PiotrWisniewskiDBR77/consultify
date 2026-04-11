/**
 * useProcessFlowCRUD — Optional V8 API CRUD wiring for process flow nodes/edges.
 *
 * Wraps the 12 backend CRUD endpoints that are not covered by existing hooks.
 * Designed to run alongside workspace sync — calls are fire-and-forget to avoid
 * blocking the UI. Enable via the `enabled` option.
 */
import { useCallback, useRef } from 'react';
import { Api } from '@/services/api';

interface UseProcessFlowCRUDOpts {
  processId: string;
  enabled?: boolean;
}

export function useProcessFlowCRUD({ processId, enabled = false }: UseProcessFlowCRUDOpts) {
  const abortRef = useRef<AbortController | null>(null);

  const callApi = useCallback(
    async (method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, body?: unknown) => {
      if (!enabled || !processId) return null;
      try {
        abortRef.current?.abort();
        abortRef.current = new AbortController();
        const url = `/api/v8/process-flow/${path}`;
        const opts: RequestInit = {
          method,
          headers: { 'Content-Type': 'application/json' },
          signal: abortRef.current.signal,
          body: body ? JSON.stringify(body) : undefined,
        };
        const res = await Api.raw(url, opts);
        return res;
      } catch {
        return null;
      }
    },
    [enabled, processId],
  );

  const fetchContract = useCallback(
    () => callApi('GET', 'contract'),
    [callApi],
  );

  const fetchObjects = useCallback(
    () => callApi('GET', `${processId}/objects`),
    [callApi, processId],
  );

  const createNode = useCallback(
    (data: { type: string; label: string; position?: { x: number; y: number }; laneId?: string }) =>
      callApi('POST', `${processId}/nodes`, data),
    [callApi, processId],
  );

  const updateNodeLabel = useCallback(
    (nodeId: string, label: string) =>
      callApi('PUT', `nodes/${nodeId}/label`, { label }),
    [callApi],
  );

  const moveNode = useCallback(
    (nodeId: string, position: { x: number; y: number }) =>
      callApi('PUT', `nodes/${nodeId}/move`, position),
    [callApi],
  );

  const updateGatewayKind = useCallback(
    (nodeId: string, gatewayKind: 'xor' | 'and') =>
      callApi('PUT', `nodes/${nodeId}/gateway-kind`, { gatewayKind }),
    [callApi],
  );

  const updateNodeLane = useCallback(
    (nodeId: string, laneId: string) =>
      callApi('PUT', `nodes/${nodeId}/lane`, { laneId }),
    [callApi],
  );

  const deleteNode = useCallback(
    (nodeId: string) => callApi('DELETE', `nodes/${nodeId}`),
    [callApi],
  );

  const createEdge = useCallback(
    (data: { source: string; target: string; label?: string }) =>
      callApi('POST', `${processId}/edges`, data),
    [callApi, processId],
  );

  const updateEdgeLabel = useCallback(
    (edgeId: string, label: string) =>
      callApi('PUT', `edges/${edgeId}/label`, { label }),
    [callApi],
  );

  const deleteEdge = useCallback(
    (edgeId: string) => callApi('DELETE', `edges/${edgeId}`),
    [callApi],
  );

  const fetchProposal = useCallback(
    (proposalId: string) => callApi('GET', `ai-proposals/${proposalId}`),
    [callApi],
  );

  return {
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
  };
}
