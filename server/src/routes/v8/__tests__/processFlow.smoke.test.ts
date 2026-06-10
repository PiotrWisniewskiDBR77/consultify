/**
 * Process Flow — smoke round-trip (WS-02 unification).
 *
 * Verifies the production-critical path that was previously dead:
 *   createNode → getProcessObjects returns the node;
 *   createEdge → edge present; deleteNode removes it.
 *
 * The DB layer is mocked with an in-memory store that mirrors the
 * INSERT/SELECT/DELETE shapes used by processFlowService.ts, so this exercises
 * the real service logic (validation, table-ready guard, mapping) end-to-end
 * without a live Postgres. With the 20260603_v8_process_flow.sql migration in
 * place, tableExists() resolves truthy in production and the same path runs.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

interface Row {
  [k: string]: unknown;
}

// In-memory tables keyed by table name fragment.
const store: { nodes: Row[]; edges: Row[] } = { nodes: [], edges: [] };

const tableOf = (sql: string): 'nodes' | 'edges' =>
  /process_flow_edges/i.test(sql) ? 'edges' : 'nodes';

const mockDbRun = vi.fn(async (sql: string, params: unknown[]) => {
  const table = tableOf(sql);
  if (/^\s*INSERT/i.test(sql)) {
    // Column order mirrors the INSERT in processFlowService.ts.
    if (table === 'nodes') {
      store.nodes.push({
        id: params[0],
        process_id: params[1],
        organization_id: params[2],
        object_type: params[3],
        label: params[4],
        lane_id: params[5] ?? null,
        pool_id: params[6] ?? null,
        parent_subprocess_id: params[7] ?? null,
        position_x: params[8] ?? 0,
        position_y: params[9] ?? 0,
        gateway_kind: params[10] ?? null,
        metadata: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    } else {
      store.edges.push({
        id: params[0],
        process_id: params[1],
        organization_id: params[2],
        edge_type: params[3],
        source_node_id: params[4],
        target_node_id: params[5],
        label: params[6] ?? null,
        metadata: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }
  } else if (/^\s*DELETE/i.test(sql)) {
    const id = params[0];
    store[table] = store[table].filter((r) => r.id !== id);
    if (table === 'nodes') {
      // Service also clears edges touching the node.
      store.edges = store.edges.filter((e) => e.source_node_id !== id && e.target_node_id !== id);
    }
  }
  return { success: true, changes: 1 };
});

const mockDbAll = vi.fn(async (sql: string, params: unknown[]) => {
  const table = tableOf(sql);
  const [processId, orgId] = params as string[];
  return store[table].filter((r) => r.process_id === processId && r.organization_id === orgId);
});

const mockDbGet = vi.fn(async () => null);
const mockTableExists = vi.fn(async () => true);

vi.mock('../../../utils/DbPromise.js', () => ({
  run: (...args: unknown[]) => mockDbRun(args[0] as string, (args[1] as unknown[]) ?? []),
  all: (...args: unknown[]) => mockDbAll(args[0] as string, (args[1] as unknown[]) ?? []),
  get: (...args: unknown[]) => mockDbGet(),
  tableExists: (...args: unknown[]) => mockTableExists(),
}));

vi.mock('../../../utils/Logger.js', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

const { createNode, createEdge, deleteNode, getProcessObjects } =
  await import('../../../services/v8/processFlowService.js');

const ORG = 'org-smoke-01';
const PROCESS = 'proc-smoke-01';

describe('Process Flow — smoke round-trip', () => {
  beforeEach(() => {
    store.nodes = [];
    store.edges = [];
    mockTableExists.mockResolvedValue(true);
  });

  it('createNode → getProcessObjects returns the node', async () => {
    const res = await createNode(PROCESS, ORG, { object_type: 'task', label: 'Review order' });
    expect(res.success).toBe(true);
    expect(res.node_id).toBeTruthy();

    const objects = await getProcessObjects(PROCESS, ORG);
    expect(objects.degraded).toBe(false);
    expect(objects.nodes).toHaveLength(1);
    expect(objects.nodes[0].label).toBe('Review order');
    expect(objects.nodes[0].object_type).toBe('task');
  });

  it('createEdge persists between two nodes; deleteNode cleans up edges', async () => {
    const a = await createNode(PROCESS, ORG, { object_type: 'start_event', label: '' });
    const b = await createNode(PROCESS, ORG, { object_type: 'task', label: 'Pack' });
    const edge = await createEdge(PROCESS, ORG, {
      edge_type: 'sequence_flow',
      source_node_id: a.node_id!,
      target_node_id: b.node_id!,
    });
    expect(edge.success).toBe(true);

    let objects = await getProcessObjects(PROCESS, ORG);
    expect(objects.nodes).toHaveLength(2);
    expect(objects.edges).toHaveLength(1);

    await deleteNode(b.node_id!, ORG);
    objects = await getProcessObjects(PROCESS, ORG);
    expect(objects.nodes).toHaveLength(1);
    // Edge touching the deleted node is gone.
    expect(objects.edges).toHaveLength(0);
  });

  it('degrades (no throw) when the table is missing', async () => {
    mockTableExists.mockResolvedValue(false);
    const res = await createNode(PROCESS, ORG, { object_type: 'task', label: 'x' });
    expect(res.success).toBe(false);
    expect(res.error_code).toBe('TABLE_MISSING');

    const objects = await getProcessObjects(PROCESS, ORG);
    expect(objects.degraded).toBe(true);
    expect(objects.nodes).toHaveLength(0);
  });
});
