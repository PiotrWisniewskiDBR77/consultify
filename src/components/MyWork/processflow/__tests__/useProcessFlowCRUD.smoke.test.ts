/**
 * @vitest-environment jsdom
 *
 * useProcessFlowCRUD — smoke (WS-02 unification).
 *
 * The hook is the bridge that makes Process Flow saves hit the dedicated V8
 * tables. Before this wave it was dead code (`enabled=false`, never mounted) and
 * its body field names did not match the backend contract. These tests pin:
 *   1. shapeToObjectType maps every UI FlowShape to a valid semantic object;
 *   2. createNode/createEdge POST the snake_case contract the routes expect;
 *   3. disabled mode is a no-op (never touches the network).
 */
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { shapeToObjectType, useProcessFlowCRUD } from '../useProcessFlowCRUD';

const VALID_OBJECTS = new Set([
  'start_event',
  'end_event',
  'task',
  'decision_gateway',
  'parallel_gateway',
  'subprocess',
  'lane',
  'pool',
  'message_flow',
  'annotation',
]);

describe('shapeToObjectType', () => {
  it('maps known shapes to the right semantic objects', () => {
    expect(shapeToObjectType('start')).toBe('start_event');
    expect(shapeToObjectType('end')).toBe('end_event');
    expect(shapeToObjectType('decision')).toBe('decision_gateway');
    expect(shapeToObjectType('org_handoff')).toBe('message_flow');
    expect(shapeToObjectType('system_db')).toBe('subprocess');
  });

  it('collapses unknown / generic shapes to task', () => {
    expect(shapeToObjectType('action')).toBe('task');
    expect(shapeToObjectType('vsm_process')).toBe('task');
    expect(shapeToObjectType('totally-unknown')).toBe('task');
  });

  it('only ever returns a valid backend semantic object type', () => {
    const shapes = [
      'start',
      'end',
      'action',
      'decision',
      'bpmn_event',
      'bpmn_task',
      'bpmn_gateway',
      'system_service',
      'system_db',
      'system_actor',
      'org_role',
      'org_team',
      'org_handoff',
      'auto_trigger',
      'auto_api',
      'auto_condition',
      'vsm_process',
      'vsm_inventory',
      'vsm_supplier',
      'vsm_customer',
      'vsm_kaizen',
      'vsm_push_arrow',
      'vsm_pull_arrow',
      'vsm_supermarket',
      'vsm_fifo',
    ];
    for (const s of shapes) {
      expect(VALID_OBJECTS.has(shapeToObjectType(s))).toBe(true);
    }
  });
});

describe('useProcessFlowCRUD', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { node_id: 'n1' } }),
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('does nothing when disabled', async () => {
    const { result } = renderHook(() => useProcessFlowCRUD({ processId: 'p1', enabled: false }));
    await act(async () => {
      await result.current.createNode({ shape: 'action', label: 'X' });
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('createNode POSTs the snake_case contract', async () => {
    const { result } = renderHook(() => useProcessFlowCRUD({ processId: 'p1', enabled: true }));
    await act(async () => {
      await result.current.createNode({
        shape: 'decision',
        label: 'Approve?',
        position: { x: 10, y: 20 },
        laneId: 'lane-a',
      });
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/v8/process-flow/p1/nodes');
    expect(opts.method).toBe('POST');
    const body = JSON.parse(opts.body);
    expect(body).toMatchObject({
      object_type: 'decision_gateway',
      label: 'Approve?',
      position_x: 10,
      position_y: 20,
      lane_id: 'lane-a',
    });
  });

  it('createEdge POSTs source_node_id / target_node_id', async () => {
    const { result } = renderHook(() => useProcessFlowCRUD({ processId: 'p1', enabled: true }));
    await act(async () => {
      await result.current.createEdge({ source: 'a', target: 'b' });
    });
    const [url, opts] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/v8/process-flow/p1/edges');
    const body = JSON.parse(opts.body);
    expect(body).toMatchObject({
      source_node_id: 'a',
      target_node_id: 'b',
      edge_type: 'sequence_flow',
    });
  });

  it('deleteNode issues a DELETE', async () => {
    const { result } = renderHook(() => useProcessFlowCRUD({ processId: 'p1', enabled: true }));
    await act(async () => {
      await result.current.deleteNode('n9');
    });
    const [url, opts] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/v8/process-flow/nodes/n9');
    expect(opts.method).toBe('DELETE');
  });

  it('swallows network errors (fire-and-forget, never throws)', async () => {
    fetchMock.mockRejectedValueOnce(new Error('offline'));
    const { result } = renderHook(() => useProcessFlowCRUD({ processId: 'p1', enabled: true }));
    await expect(
      act(async () => {
        await result.current.createNode({ shape: 'action', label: 'X' });
      })
    ).resolves.toBeUndefined();
  });
});
