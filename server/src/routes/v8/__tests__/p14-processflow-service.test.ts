/**
 * P14-B — Process Flow Service integration tests.
 *
 * Tests the full CRUD lifecycle (nodes + edges), 2-layer validation,
 * semantic readback, export, AI proposal lifecycle, degraded scenarios,
 * and all contract requirements from §2.3 and §8.1 P14-B.
 *
 * All tests exercise real production code from processFlowService.ts
 * and processFlowCanon.ts with mocked DB layer.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock DB layer
const mockDbRun = vi.fn().mockResolvedValue({ success: true, changes: 1 });
const mockDbGet = vi.fn().mockResolvedValue(null);
const mockDbAll = vi.fn().mockResolvedValue([]);
const mockTableExists = vi.fn().mockResolvedValue(true);

vi.mock('../../../utils/DbPromise.js', () => ({
  run: (...args: unknown[]) => mockDbRun(...args),
  get: (...args: unknown[]) => mockDbGet(...args),
  all: (...args: unknown[]) => mockDbAll(...args),
  tableExists: (...args: unknown[]) => mockTableExists(...args),
}));

vi.mock('../../../utils/Logger.js', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

const {
  getProcessObjects,
  createNode,
  updateNodeLabel,
  moveNode,
  deleteNode,
  createEdge,
  deleteEdge,
  updateEdgeLabel,
  validateProcess,
  semanticReadback,
  exportProcess,
  createAIProposal,
  getAIProposal,
  resolveAIProposal,
  getDegradedState,
  setGatewayKind,
  setLane,
} = await import('../../../services/v8/processFlowService.js');

const {
  P14_SEMANTIC_OBJECTS,
  P14_VALIDATION_LAYERS,
  P14_VALIDATION_RULES,
  P14_TOOLBELT,
  P14_AI_PROPOSAL_RULES,
  P14_ANTI_DUPLICATE_RULES,
  P14_DEGRADED_SCENARIOS,
  P14_ACCEPTANCE_CHECKLIST,
  P14_BPMN_INTEROP_POSTURE,
  validateSemanticRule,
  isValidSemanticObject,
  isValidProcessFlowTool,
  isValidMessageFlow,
} = await import('../../../services/v8/processFlowCanon.js');

const ORG = 'org-test-001';
const PROCESS = 'proc-test-001';

describe('P14-B Process Flow Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTableExists.mockResolvedValue(true);
    mockDbRun.mockResolvedValue({ success: true, changes: 1 });
    mockDbAll.mockResolvedValue([]);
    mockDbGet.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─── §1 — CRUD: createNode ──────────────────────────────────

  describe('§1 — createNode', () => {
    it('creates a task node with valid params', async () => {
      const result = await createNode(PROCESS, ORG, {
        object_type: 'task',
        label: 'Review document',
        position_x: 100,
        position_y: 200,
      });
      expect(result.success).toBe(true);
      expect(result.operation).toBe('create_node');
      expect(result.node_id).toBeTruthy();
    });

    it('creates a start_event without label', async () => {
      const result = await createNode(PROCESS, ORG, {
        object_type: 'start_event',
        label: '',
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid object_type', async () => {
      const result = await createNode(PROCESS, ORG, {
        object_type: 'timer_event',
        label: 'Invalid',
      });
      expect(result.success).toBe(false);
      expect(result.error_code).toBe('INVALID_TYPE');
    });

    it('rejects task without label', async () => {
      const result = await createNode(PROCESS, ORG, {
        object_type: 'task',
        label: '',
      });
      expect(result.success).toBe(false);
      expect(result.error_code).toBe('INVALID_LABEL');
    });

    it('rejects when table missing', async () => {
      mockTableExists.mockResolvedValue(false);
      const result = await createNode(PROCESS, ORG, {
        object_type: 'task',
        label: 'Test',
      });
      expect(result.success).toBe(false);
      expect(result.error_code).toBe('TABLE_MISSING');
    });

    it('rejects when exceeding MAX_OBJECTS (200)', async () => {
      mockDbAll.mockResolvedValue(
        Array.from({ length: 200 }, (_, i) => ({
          id: `n-${i}`,
          process_id: PROCESS,
          organization_id: ORG,
          object_type: 'task',
          label: `Task ${i}`,
          lane_id: null,
          pool_id: null,
          parent_subprocess_id: null,
          position_x: 0,
          position_y: 0,
          gateway_kind: null,
          metadata: null,
          created_at: '2026-01-01',
          updated_at: '2026-01-01',
        }))
      );
      const result = await createNode(PROCESS, ORG, {
        object_type: 'task',
        label: 'Overflow',
      });
      expect(result.success).toBe(false);
      expect(result.error_code).toBe('SIZE_LIMIT');
    });

    it('rejects when subprocess nesting exceeds depth 3', async () => {
      mockDbAll.mockResolvedValue([
        {
          id: 'sp1',
          process_id: PROCESS,
          organization_id: ORG,
          object_type: 'subprocess',
          label: 'L1',
          lane_id: null,
          pool_id: null,
          parent_subprocess_id: null,
          position_x: 0,
          position_y: 0,
          gateway_kind: null,
          metadata: null,
          created_at: '2026-01-01',
          updated_at: '2026-01-01',
        },
        {
          id: 'sp2',
          process_id: PROCESS,
          organization_id: ORG,
          object_type: 'subprocess',
          label: 'L2',
          lane_id: null,
          pool_id: null,
          parent_subprocess_id: 'sp1',
          position_x: 0,
          position_y: 0,
          gateway_kind: null,
          metadata: null,
          created_at: '2026-01-01',
          updated_at: '2026-01-01',
        },
        {
          id: 'sp3',
          process_id: PROCESS,
          organization_id: ORG,
          object_type: 'subprocess',
          label: 'L3',
          lane_id: null,
          pool_id: null,
          parent_subprocess_id: 'sp2',
          position_x: 0,
          position_y: 0,
          gateway_kind: null,
          metadata: null,
          created_at: '2026-01-01',
          updated_at: '2026-01-01',
        },
      ]);
      const result = await createNode(PROCESS, ORG, {
        object_type: 'task',
        label: 'Deep',
        parent_subprocess_id: 'sp3',
      });
      expect(result.success).toBe(false);
      expect(result.error_code).toBe('NESTING_LIMIT');
    });

    it('creates node with gateway_kind xor', async () => {
      const result = await createNode(PROCESS, ORG, {
        object_type: 'decision_gateway',
        label: 'Check approval',
        gateway_kind: 'xor',
      });
      expect(result.success).toBe(true);
      expect(mockDbRun).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO'),
        expect.arrayContaining(['xor']),
        expect.any(Object)
      );
    });
  });

  // ─── §2 — CRUD: updateNodeLabel ─────────────────────────────

  describe('§2 — updateNodeLabel', () => {
    it('updates label successfully', async () => {
      const result = await updateNodeLabel('node-1', ORG, 'New label');
      expect(result.success).toBe(true);
      expect(result.operation).toBe('update_label');
    });

    it('rejects empty label', async () => {
      const result = await updateNodeLabel('node-1', ORG, '');
      expect(result.success).toBe(false);
      expect(result.error_code).toBe('INVALID_LABEL');
    });

    it('returns NOT_FOUND when node missing', async () => {
      mockDbRun.mockResolvedValue({ success: true, changes: 0 });
      const result = await updateNodeLabel('missing', ORG, 'Label');
      expect(result.success).toBe(false);
    });
  });

  // ─── §3 — CRUD: moveNode ───────────────────────────────────

  describe('§3 — moveNode', () => {
    it('moves node to new position', async () => {
      const result = await moveNode('node-1', ORG, { x: 300, y: 400 });
      expect(result.success).toBe(true);
      expect(result.operation).toBe('move_node');
    });

    it('returns NOT_FOUND when node missing', async () => {
      mockDbRun.mockResolvedValue({ success: true, changes: 0 });
      const result = await moveNode('missing', ORG, { x: 0, y: 0 });
      expect(result.success).toBe(false);
    });
  });

  // ─── §4 — CRUD: deleteNode ─────────────────────────────────

  describe('§4 — deleteNode', () => {
    it('deletes node and connected edges', async () => {
      const result = await deleteNode('node-1', ORG);
      expect(result.success).toBe(true);
      expect(result.operation).toBe('delete_node');
      expect(mockDbRun).toHaveBeenCalledTimes(2);
    });

    it('returns NOT_FOUND when node missing', async () => {
      mockDbRun
        .mockResolvedValueOnce({ success: true, changes: 0 })
        .mockResolvedValueOnce({ success: true, changes: 0 });
      const result = await deleteNode('missing', ORG);
      expect(result.success).toBe(false);
    });
  });

  // ─── §5 — CRUD: createEdge (connect) ───────────────────────

  describe('§5 — createEdge', () => {
    it('creates a sequence_flow edge', async () => {
      const result = await createEdge(PROCESS, ORG, {
        edge_type: 'sequence_flow',
        source_node_id: 'n1',
        target_node_id: 'n2',
        label: 'Yes',
      });
      expect(result.success).toBe(true);
      expect(result.operation).toBe('connect');
      expect(result.edge_id).toBeTruthy();
    });

    it('rejects message_flow within same pool', async () => {
      mockDbGet
        .mockResolvedValueOnce({ pool_id: 'pool-a' })
        .mockResolvedValueOnce({ pool_id: 'pool-a' });
      const result = await createEdge(PROCESS, ORG, {
        edge_type: 'message_flow',
        source_node_id: 'n1',
        target_node_id: 'n2',
      });
      expect(result.success).toBe(false);
      expect(result.error_code).toBe('INVALID_MESSAGE_FLOW');
    });

    it('allows message_flow between different pools', async () => {
      mockDbGet
        .mockResolvedValueOnce({ pool_id: 'pool-a' })
        .mockResolvedValueOnce({ pool_id: 'pool-b' });
      const result = await createEdge(PROCESS, ORG, {
        edge_type: 'message_flow',
        source_node_id: 'n1',
        target_node_id: 'n2',
      });
      expect(result.success).toBe(true);
    });

    it('rejects when table missing', async () => {
      mockTableExists.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
      const result = await createEdge(PROCESS, ORG, {
        edge_type: 'sequence_flow',
        source_node_id: 'n1',
        target_node_id: 'n2',
      });
      expect(result.success).toBe(false);
      expect(result.error_code).toBe('TABLE_MISSING');
    });
  });

  // ─── §6 — CRUD: deleteEdge + updateEdgeLabel ───────────────

  describe('§6 — deleteEdge + updateEdgeLabel', () => {
    it('deletes edge', async () => {
      const result = await deleteEdge('edge-1', ORG);
      expect(result.success).toBe(true);
    });

    it('updates edge label', async () => {
      const result = await updateEdgeLabel('edge-1', ORG, 'Condition A');
      expect(result.success).toBe(true);
    });

    it('returns NOT_FOUND for missing edge', async () => {
      mockDbRun.mockResolvedValue({ success: true, changes: 0 });
      const result = await deleteEdge('missing', ORG);
      expect(result.success).toBe(false);
    });
  });

  // ─── §7 — 2-layer validation ───────────────────────────────

  describe('§7 — validateProcess (2-layer)', () => {
    it('returns valid for correct process', async () => {
      mockDbAll
        .mockResolvedValueOnce([
          {
            id: 's1',
            process_id: PROCESS,
            organization_id: ORG,
            object_type: 'start_event',
            label: 'Start',
            lane_id: null,
            pool_id: null,
            parent_subprocess_id: null,
            position_x: 0,
            position_y: 0,
            gateway_kind: null,
            metadata: null,
            created_at: '2026-01-01',
            updated_at: '2026-01-01',
          },
          {
            id: 't1',
            process_id: PROCESS,
            organization_id: ORG,
            object_type: 'task',
            label: 'Do work',
            lane_id: null,
            pool_id: null,
            parent_subprocess_id: null,
            position_x: 100,
            position_y: 0,
            gateway_kind: null,
            metadata: null,
            created_at: '2026-01-01',
            updated_at: '2026-01-01',
          },
          {
            id: 'e1',
            process_id: PROCESS,
            organization_id: ORG,
            object_type: 'end_event',
            label: 'End',
            lane_id: null,
            pool_id: null,
            parent_subprocess_id: null,
            position_x: 200,
            position_y: 0,
            gateway_kind: null,
            metadata: null,
            created_at: '2026-01-01',
            updated_at: '2026-01-01',
          },
        ])
        .mockResolvedValueOnce([
          {
            id: 'sf1',
            process_id: PROCESS,
            organization_id: ORG,
            edge_type: 'sequence_flow',
            source_node_id: 's1',
            target_node_id: 't1',
            label: null,
            metadata: null,
            created_at: '2026-01-01',
            updated_at: '2026-01-01',
          },
          {
            id: 'sf2',
            process_id: PROCESS,
            organization_id: ORG,
            edge_type: 'sequence_flow',
            source_node_id: 't1',
            target_node_id: 'e1',
            label: null,
            metadata: null,
            created_at: '2026-01-01',
            updated_at: '2026-01-01',
          },
        ]);

      const result = await validateProcess(PROCESS, ORG);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('detects missing Start event', async () => {
      mockDbAll
        .mockResolvedValueOnce([
          {
            id: 't1',
            process_id: PROCESS,
            organization_id: ORG,
            object_type: 'task',
            label: 'Work',
            lane_id: null,
            pool_id: null,
            parent_subprocess_id: null,
            position_x: 0,
            position_y: 0,
            gateway_kind: null,
            metadata: null,
            created_at: '2026-01-01',
            updated_at: '2026-01-01',
          },
        ])
        .mockResolvedValueOnce([]);

      const result = await validateProcess(PROCESS, ORG);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.message.includes('Start'))).toBe(true);
    });

    it('detects missing End event', async () => {
      mockDbAll
        .mockResolvedValueOnce([
          {
            id: 's1',
            process_id: PROCESS,
            organization_id: ORG,
            object_type: 'start_event',
            label: 'Start',
            lane_id: null,
            pool_id: null,
            parent_subprocess_id: null,
            position_x: 0,
            position_y: 0,
            gateway_kind: null,
            metadata: null,
            created_at: '2026-01-01',
            updated_at: '2026-01-01',
          },
        ])
        .mockResolvedValueOnce([]);

      const result = await validateProcess(PROCESS, ORG);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.message.includes('End'))).toBe(true);
    });

    it('detects start_event with incoming flows (semantic layer)', async () => {
      mockDbAll
        .mockResolvedValueOnce([
          {
            id: 's1',
            process_id: PROCESS,
            organization_id: ORG,
            object_type: 'start_event',
            label: 'Start',
            lane_id: null,
            pool_id: null,
            parent_subprocess_id: null,
            position_x: 0,
            position_y: 0,
            gateway_kind: null,
            metadata: null,
            created_at: '2026-01-01',
            updated_at: '2026-01-01',
          },
          {
            id: 'e1',
            process_id: PROCESS,
            organization_id: ORG,
            object_type: 'end_event',
            label: 'End',
            lane_id: null,
            pool_id: null,
            parent_subprocess_id: null,
            position_x: 200,
            position_y: 0,
            gateway_kind: null,
            metadata: null,
            created_at: '2026-01-01',
            updated_at: '2026-01-01',
          },
        ])
        .mockResolvedValueOnce([
          {
            id: 'sf1',
            process_id: PROCESS,
            organization_id: ORG,
            edge_type: 'sequence_flow',
            source_node_id: 'e1',
            target_node_id: 's1',
            label: null,
            metadata: null,
            created_at: '2026-01-01',
            updated_at: '2026-01-01',
          },
        ]);

      const result = await validateProcess(PROCESS, ORG);
      expect(result.valid).toBe(false);
      expect(
        result.errors.some((e) => e.layer === 'semantic_first' && e.message.includes('start_event'))
      ).toBe(true);
    });

    it('detects decision_gateway with <2 outgoing flows', async () => {
      mockDbAll
        .mockResolvedValueOnce([
          {
            id: 's1',
            process_id: PROCESS,
            organization_id: ORG,
            object_type: 'start_event',
            label: 'Start',
            lane_id: null,
            pool_id: null,
            parent_subprocess_id: null,
            position_x: 0,
            position_y: 0,
            gateway_kind: null,
            metadata: null,
            created_at: '2026-01-01',
            updated_at: '2026-01-01',
          },
          {
            id: 'g1',
            process_id: PROCESS,
            organization_id: ORG,
            object_type: 'decision_gateway',
            label: 'Check',
            lane_id: null,
            pool_id: null,
            parent_subprocess_id: null,
            position_x: 100,
            position_y: 0,
            gateway_kind: 'xor',
            metadata: null,
            created_at: '2026-01-01',
            updated_at: '2026-01-01',
          },
          {
            id: 'e1',
            process_id: PROCESS,
            organization_id: ORG,
            object_type: 'end_event',
            label: 'End',
            lane_id: null,
            pool_id: null,
            parent_subprocess_id: null,
            position_x: 200,
            position_y: 0,
            gateway_kind: null,
            metadata: null,
            created_at: '2026-01-01',
            updated_at: '2026-01-01',
          },
        ])
        .mockResolvedValueOnce([
          {
            id: 'sf1',
            process_id: PROCESS,
            organization_id: ORG,
            edge_type: 'sequence_flow',
            source_node_id: 's1',
            target_node_id: 'g1',
            label: null,
            metadata: null,
            created_at: '2026-01-01',
            updated_at: '2026-01-01',
          },
          {
            id: 'sf2',
            process_id: PROCESS,
            organization_id: ORG,
            edge_type: 'sequence_flow',
            source_node_id: 'g1',
            target_node_id: 'e1',
            label: null,
            metadata: null,
            created_at: '2026-01-01',
            updated_at: '2026-01-01',
          },
        ]);

      const result = await validateProcess(PROCESS, ORG);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.message.includes('decision_gateway'))).toBe(true);
    });

    it('detects orphan nodes (structural layer)', async () => {
      mockDbAll
        .mockResolvedValueOnce([
          {
            id: 's1',
            process_id: PROCESS,
            organization_id: ORG,
            object_type: 'start_event',
            label: 'Start',
            lane_id: null,
            pool_id: null,
            parent_subprocess_id: null,
            position_x: 0,
            position_y: 0,
            gateway_kind: null,
            metadata: null,
            created_at: '2026-01-01',
            updated_at: '2026-01-01',
          },
          {
            id: 't1',
            process_id: PROCESS,
            organization_id: ORG,
            object_type: 'task',
            label: 'Orphan',
            lane_id: null,
            pool_id: null,
            parent_subprocess_id: null,
            position_x: 100,
            position_y: 100,
            gateway_kind: null,
            metadata: null,
            created_at: '2026-01-01',
            updated_at: '2026-01-01',
          },
          {
            id: 'e1',
            process_id: PROCESS,
            organization_id: ORG,
            object_type: 'end_event',
            label: 'End',
            lane_id: null,
            pool_id: null,
            parent_subprocess_id: null,
            position_x: 200,
            position_y: 0,
            gateway_kind: null,
            metadata: null,
            created_at: '2026-01-01',
            updated_at: '2026-01-01',
          },
        ])
        .mockResolvedValueOnce([
          {
            id: 'sf1',
            process_id: PROCESS,
            organization_id: ORG,
            edge_type: 'sequence_flow',
            source_node_id: 's1',
            target_node_id: 'e1',
            label: null,
            metadata: null,
            created_at: '2026-01-01',
            updated_at: '2026-01-01',
          },
        ]);

      const result = await validateProcess(PROCESS, ORG);
      expect(result.warnings.some((w) => w.message.includes('disconnected'))).toBe(true);
    });

    it('detects message_flow within same pool', async () => {
      mockDbAll
        .mockResolvedValueOnce([
          {
            id: 's1',
            process_id: PROCESS,
            organization_id: ORG,
            object_type: 'start_event',
            label: 'Start',
            lane_id: null,
            pool_id: 'pool-a',
            parent_subprocess_id: null,
            position_x: 0,
            position_y: 0,
            gateway_kind: null,
            metadata: null,
            created_at: '2026-01-01',
            updated_at: '2026-01-01',
          },
          {
            id: 'e1',
            process_id: PROCESS,
            organization_id: ORG,
            object_type: 'end_event',
            label: 'End',
            lane_id: null,
            pool_id: 'pool-a',
            parent_subprocess_id: null,
            position_x: 200,
            position_y: 0,
            gateway_kind: null,
            metadata: null,
            created_at: '2026-01-01',
            updated_at: '2026-01-01',
          },
        ])
        .mockResolvedValueOnce([
          {
            id: 'mf1',
            process_id: PROCESS,
            organization_id: ORG,
            edge_type: 'message_flow',
            source_node_id: 's1',
            target_node_id: 'e1',
            label: null,
            metadata: null,
            created_at: '2026-01-01',
            updated_at: '2026-01-01',
          },
        ]);

      const result = await validateProcess(PROCESS, ORG);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.message.includes('same pool'))).toBe(true);
    });
  });

  // ─── §8 — Semantic readback ─────────────────────────────────

  describe('§8 — semanticReadback', () => {
    it('produces deterministic readback for linear process', async () => {
      mockDbAll
        .mockResolvedValueOnce([
          {
            id: 's1',
            process_id: PROCESS,
            organization_id: ORG,
            object_type: 'start_event',
            label: 'Begin',
            lane_id: null,
            pool_id: null,
            parent_subprocess_id: null,
            position_x: 0,
            position_y: 0,
            gateway_kind: null,
            metadata: null,
            created_at: '2026-01-01',
            updated_at: '2026-01-01',
          },
          {
            id: 't1',
            process_id: PROCESS,
            organization_id: ORG,
            object_type: 'task',
            label: 'Do work',
            lane_id: null,
            pool_id: null,
            parent_subprocess_id: null,
            position_x: 100,
            position_y: 0,
            gateway_kind: null,
            metadata: null,
            created_at: '2026-01-01',
            updated_at: '2026-01-01',
          },
          {
            id: 'e1',
            process_id: PROCESS,
            organization_id: ORG,
            object_type: 'end_event',
            label: 'Done',
            lane_id: null,
            pool_id: null,
            parent_subprocess_id: null,
            position_x: 200,
            position_y: 0,
            gateway_kind: null,
            metadata: null,
            created_at: '2026-01-01',
            updated_at: '2026-01-01',
          },
        ])
        .mockResolvedValueOnce([
          {
            id: 'sf1',
            process_id: PROCESS,
            organization_id: ORG,
            edge_type: 'sequence_flow',
            source_node_id: 's1',
            target_node_id: 't1',
            label: null,
            metadata: null,
            created_at: '2026-01-01',
            updated_at: '2026-01-01',
          },
          {
            id: 'sf2',
            process_id: PROCESS,
            organization_id: ORG,
            edge_type: 'sequence_flow',
            source_node_id: 't1',
            target_node_id: 'e1',
            label: null,
            metadata: null,
            created_at: '2026-01-01',
            updated_at: '2026-01-01',
          },
        ]);

      const result = await semanticReadback(PROCESS, ORG);
      expect(result.paths).toHaveLength(1);
      expect(result.paths[0]!.type).toBe('start');
      expect(result.paths[0]!.label).toBe('Begin');
      expect(result.warnings).toHaveLength(0);
    });

    it('warns when no Start event', async () => {
      mockDbAll.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
      const result = await semanticReadback(PROCESS, ORG);
      expect(result.paths).toHaveLength(0);
      expect(result.warnings.some((w) => w.includes('Start'))).toBe(true);
    });

    it('warns when no End event', async () => {
      mockDbAll
        .mockResolvedValueOnce([
          {
            id: 's1',
            process_id: PROCESS,
            organization_id: ORG,
            object_type: 'start_event',
            label: 'Start',
            lane_id: null,
            pool_id: null,
            parent_subprocess_id: null,
            position_x: 0,
            position_y: 0,
            gateway_kind: null,
            metadata: null,
            created_at: '2026-01-01',
            updated_at: '2026-01-01',
          },
        ])
        .mockResolvedValueOnce([]);

      const result = await semanticReadback(PROCESS, ORG);
      expect(result.warnings.some((w) => w.includes('End'))).toBe(true);
    });

    it('handles decision gateway branching', async () => {
      mockDbAll
        .mockResolvedValueOnce([
          {
            id: 's1',
            process_id: PROCESS,
            organization_id: ORG,
            object_type: 'start_event',
            label: 'Start',
            lane_id: null,
            pool_id: null,
            parent_subprocess_id: null,
            position_x: 0,
            position_y: 0,
            gateway_kind: null,
            metadata: null,
            created_at: '2026-01-01',
            updated_at: '2026-01-01',
          },
          {
            id: 'g1',
            process_id: PROCESS,
            organization_id: ORG,
            object_type: 'decision_gateway',
            label: 'Approved?',
            lane_id: null,
            pool_id: null,
            parent_subprocess_id: null,
            position_x: 100,
            position_y: 0,
            gateway_kind: 'xor',
            metadata: null,
            created_at: '2026-01-01',
            updated_at: '2026-01-01',
          },
          {
            id: 'e1',
            process_id: PROCESS,
            organization_id: ORG,
            object_type: 'end_event',
            label: 'End Yes',
            lane_id: null,
            pool_id: null,
            parent_subprocess_id: null,
            position_x: 200,
            position_y: -50,
            gateway_kind: null,
            metadata: null,
            created_at: '2026-01-01',
            updated_at: '2026-01-01',
          },
          {
            id: 'e2',
            process_id: PROCESS,
            organization_id: ORG,
            object_type: 'end_event',
            label: 'End No',
            lane_id: null,
            pool_id: null,
            parent_subprocess_id: null,
            position_x: 200,
            position_y: 50,
            gateway_kind: null,
            metadata: null,
            created_at: '2026-01-01',
            updated_at: '2026-01-01',
          },
        ])
        .mockResolvedValueOnce([
          {
            id: 'sf1',
            process_id: PROCESS,
            organization_id: ORG,
            edge_type: 'sequence_flow',
            source_node_id: 's1',
            target_node_id: 'g1',
            label: null,
            metadata: null,
            created_at: '2026-01-01',
            updated_at: '2026-01-01',
          },
          {
            id: 'sf2',
            process_id: PROCESS,
            organization_id: ORG,
            edge_type: 'sequence_flow',
            source_node_id: 'g1',
            target_node_id: 'e1',
            label: 'Yes',
            metadata: null,
            created_at: '2026-01-01',
            updated_at: '2026-01-01',
          },
          {
            id: 'sf3',
            process_id: PROCESS,
            organization_id: ORG,
            edge_type: 'sequence_flow',
            source_node_id: 'g1',
            target_node_id: 'e2',
            label: 'No',
            metadata: null,
            created_at: '2026-01-01',
            updated_at: '2026-01-01',
          },
        ]);

      const result = await semanticReadback(PROCESS, ORG);
      expect(result.paths).toHaveLength(1);
      const start = result.paths[0]!;
      expect(start.branches).toBeTruthy();
    });

    it('flags unlabeled activity', async () => {
      mockDbAll
        .mockResolvedValueOnce([
          {
            id: 's1',
            process_id: PROCESS,
            organization_id: ORG,
            object_type: 'start_event',
            label: 'Start',
            lane_id: null,
            pool_id: null,
            parent_subprocess_id: null,
            position_x: 0,
            position_y: 0,
            gateway_kind: null,
            metadata: null,
            created_at: '2026-01-01',
            updated_at: '2026-01-01',
          },
          {
            id: 't1',
            process_id: PROCESS,
            organization_id: ORG,
            object_type: 'task',
            label: '',
            lane_id: null,
            pool_id: null,
            parent_subprocess_id: null,
            position_x: 100,
            position_y: 0,
            gateway_kind: null,
            metadata: null,
            created_at: '2026-01-01',
            updated_at: '2026-01-01',
          },
          {
            id: 'e1',
            process_id: PROCESS,
            organization_id: ORG,
            object_type: 'end_event',
            label: 'End',
            lane_id: null,
            pool_id: null,
            parent_subprocess_id: null,
            position_x: 200,
            position_y: 0,
            gateway_kind: null,
            metadata: null,
            created_at: '2026-01-01',
            updated_at: '2026-01-01',
          },
        ])
        .mockResolvedValueOnce([
          {
            id: 'sf1',
            process_id: PROCESS,
            organization_id: ORG,
            edge_type: 'sequence_flow',
            source_node_id: 's1',
            target_node_id: 't1',
            label: null,
            metadata: null,
            created_at: '2026-01-01',
            updated_at: '2026-01-01',
          },
          {
            id: 'sf2',
            process_id: PROCESS,
            organization_id: ORG,
            edge_type: 'sequence_flow',
            source_node_id: 't1',
            target_node_id: 'e1',
            label: null,
            metadata: null,
            created_at: '2026-01-01',
            updated_at: '2026-01-01',
          },
        ]);

      const result = await semanticReadback(PROCESS, ORG);
      expect(result.warnings.some((w) => w.includes('Unlabeled'))).toBe(true);
    });
  });

  // ─── §9 — Export ────────────────────────────────────────────

  describe('§9 — exportProcess', () => {
    it('exports as JSON with nodes and edges', async () => {
      mockDbAll
        .mockResolvedValueOnce([
          {
            id: 's1',
            process_id: PROCESS,
            organization_id: ORG,
            object_type: 'start_event',
            label: 'Start',
            lane_id: null,
            pool_id: null,
            parent_subprocess_id: null,
            position_x: 0,
            position_y: 0,
            gateway_kind: null,
            metadata: null,
            created_at: '2026-01-01',
            updated_at: '2026-01-01',
          },
        ])
        .mockResolvedValueOnce([]);

      const result = await exportProcess(PROCESS, ORG, 'json');
      expect(result.format).toBe('json');
      expect(result.node_count).toBe(1);
      const parsed = JSON.parse(result.content);
      expect(parsed.nodes).toHaveLength(1);
      expect(parsed.edges).toHaveLength(0);
    });

    it('exports as readback text', async () => {
      mockDbAll
        .mockResolvedValueOnce([
          {
            id: 's1',
            process_id: PROCESS,
            organization_id: ORG,
            object_type: 'start_event',
            label: 'Start',
            lane_id: null,
            pool_id: null,
            parent_subprocess_id: null,
            position_x: 0,
            position_y: 0,
            gateway_kind: null,
            metadata: null,
            created_at: '2026-01-01',
            updated_at: '2026-01-01',
          },
          {
            id: 'e1',
            process_id: PROCESS,
            organization_id: ORG,
            object_type: 'end_event',
            label: 'End',
            lane_id: null,
            pool_id: null,
            parent_subprocess_id: null,
            position_x: 200,
            position_y: 0,
            gateway_kind: null,
            metadata: null,
            created_at: '2026-01-01',
            updated_at: '2026-01-01',
          },
        ])
        .mockResolvedValueOnce([
          {
            id: 'sf1',
            process_id: PROCESS,
            organization_id: ORG,
            edge_type: 'sequence_flow',
            source_node_id: 's1',
            target_node_id: 'e1',
            label: null,
            metadata: null,
            created_at: '2026-01-01',
            updated_at: '2026-01-01',
          },
        ])
        .mockResolvedValueOnce([
          {
            id: 's1',
            process_id: PROCESS,
            organization_id: ORG,
            object_type: 'start_event',
            label: 'Start',
            lane_id: null,
            pool_id: null,
            parent_subprocess_id: null,
            position_x: 0,
            position_y: 0,
            gateway_kind: null,
            metadata: null,
            created_at: '2026-01-01',
            updated_at: '2026-01-01',
          },
          {
            id: 'e1',
            process_id: PROCESS,
            organization_id: ORG,
            object_type: 'end_event',
            label: 'End',
            lane_id: null,
            pool_id: null,
            parent_subprocess_id: null,
            position_x: 200,
            position_y: 0,
            gateway_kind: null,
            metadata: null,
            created_at: '2026-01-01',
            updated_at: '2026-01-01',
          },
        ])
        .mockResolvedValueOnce([
          {
            id: 'sf1',
            process_id: PROCESS,
            organization_id: ORG,
            edge_type: 'sequence_flow',
            source_node_id: 's1',
            target_node_id: 'e1',
            label: null,
            metadata: null,
            created_at: '2026-01-01',
            updated_at: '2026-01-01',
          },
        ]);

      const result = await exportProcess(PROCESS, ORG, 'readback');
      expect(result.format).toBe('readback');
      expect(result.content).toContain('START');
      expect(result.content).toContain('END');
    });
  });

  // ─── §10 — AI proposal lifecycle ────────────────────────────

  describe('§10 — AI proposal lifecycle', () => {
    it('creates AI proposal in pending state', () => {
      const proposal = createAIProposal(PROCESS, ORG, {
        summary: 'Add approval step',
        operations: [{ op: 'create_node', params: { object_type: 'task', label: 'Approve' } }],
        before_readback: 'Start → End',
        after_readback: 'Start → Approve → End',
        validation_report: { valid: true, layer: 'both', errors: [], warnings: [] },
        risk_flags: { destructive_count: 0, branch_changes: 0 },
      });
      expect(proposal.status).toBe('pending');
      expect(proposal.id).toBeTruthy();
      expect(proposal.operations).toHaveLength(1);
    });

    it('retrieves proposal by ID', () => {
      const proposal = createAIProposal(PROCESS, ORG, {
        summary: 'Test',
        operations: [],
        before_readback: '',
        after_readback: '',
        validation_report: { valid: true, layer: 'both', errors: [], warnings: [] },
        risk_flags: { destructive_count: 0, branch_changes: 0 },
      });
      const fetched = getAIProposal(proposal.id, ORG);
      expect(fetched).toBeTruthy();
      expect(fetched!.id).toBe(proposal.id);
    });

    it('returns null for unknown proposal', () => {
      expect(getAIProposal('nonexistent', ORG)).toBeNull();
    });

    it('returns null for proposal from another organization', () => {
      const proposal = createAIProposal(PROCESS, 'org-other', {
        summary: 'Cross tenant',
        operations: [],
        before_readback: '',
        after_readback: '',
        validation_report: { valid: true, layer: 'both', errors: [], warnings: [] },
        risk_flags: { destructive_count: 0, branch_changes: 0 },
      });
      expect(getAIProposal(proposal.id, ORG)).toBeNull();
    });

    it('rejects proposal (no silent changes)', async () => {
      const proposal = createAIProposal(PROCESS, ORG, {
        summary: 'Rejected',
        operations: [{ op: 'delete_node', target_id: 'n1' }],
        before_readback: '',
        after_readback: '',
        validation_report: { valid: true, layer: 'both', errors: [], warnings: [] },
        risk_flags: { destructive_count: 1, branch_changes: 0 },
      });
      const result = await resolveAIProposal(proposal.id, 'reject', ORG);
      expect(result.success).toBe(true);
      expect(result.proposal!.status).toBe('rejected');
      expect(result.applied_count).toBe(0);
    });

    it('accepts proposal and applies operations', async () => {
      const proposal = createAIProposal(PROCESS, ORG, {
        summary: 'Add node',
        operations: [{ op: 'create_node', params: { object_type: 'task', label: 'New step' } }],
        before_readback: '',
        after_readback: '',
        validation_report: { valid: true, layer: 'both', errors: [], warnings: [] },
        risk_flags: { destructive_count: 0, branch_changes: 0 },
      });
      const result = await resolveAIProposal(proposal.id, 'accept', ORG);
      expect(result.success).toBe(true);
      expect(result.proposal!.status).toBe('accepted');
      expect(result.applied_count).toBeGreaterThanOrEqual(1);
    });

    it('rejects resolve of already resolved proposal', async () => {
      const proposal = createAIProposal(PROCESS, ORG, {
        summary: 'Done',
        operations: [],
        before_readback: '',
        after_readback: '',
        validation_report: { valid: true, layer: 'both', errors: [], warnings: [] },
        risk_flags: { destructive_count: 0, branch_changes: 0 },
      });
      await resolveAIProposal(proposal.id, 'reject', ORG);
      const result = await resolveAIProposal(proposal.id, 'accept', ORG);
      expect(result.success).toBe(false);
      expect(result.error_code).toBe('INVALID_STATE');
    });

    it('returns PROPOSAL_NOT_FOUND for unknown ID', async () => {
      const result = await resolveAIProposal('unknown', 'accept', ORG);
      expect(result.success).toBe(false);
      expect(result.error_code).toBe('PROPOSAL_NOT_FOUND');
    });

    it('returns PROPOSAL_NOT_FOUND when resolving proposal from another organization', async () => {
      const proposal = createAIProposal(PROCESS, 'org-other', {
        summary: 'Cross tenant',
        operations: [],
        before_readback: '',
        after_readback: '',
        validation_report: { valid: true, layer: 'both', errors: [], warnings: [] },
        risk_flags: { destructive_count: 0, branch_changes: 0 },
      });
      const result = await resolveAIProposal(proposal.id, 'accept', ORG);
      expect(result.success).toBe(false);
      expect(result.error_code).toBe('PROPOSAL_NOT_FOUND');
    });
  });

  // ─── §11 — Degraded state ──────────────────────────────────

  describe('§11 — getDegradedState', () => {
    it('returns non-degraded for healthy process', async () => {
      const state = await getDegradedState(PROCESS, ORG);
      expect(state.degraded).toBe(false);
    });

    it('returns degraded when table missing', async () => {
      mockTableExists.mockResolvedValue(false);
      const state = await getDegradedState(PROCESS, ORG);
      expect(state.degraded).toBe(true);
      expect(state.scenario).toBeTruthy();
      expect(state.recovery).toBeTruthy();
    });

    it('returns degraded when exceeding object limit', async () => {
      mockDbAll.mockResolvedValue(
        Array.from({ length: 201 }, (_, i) => ({
          id: `n-${i}`,
          process_id: PROCESS,
          organization_id: ORG,
          object_type: 'task',
          label: `Task ${i}`,
          lane_id: null,
          pool_id: null,
          parent_subprocess_id: null,
          position_x: 0,
          position_y: 0,
          gateway_kind: null,
          metadata: null,
          created_at: '2026-01-01',
          updated_at: '2026-01-01',
        }))
      );
      const state = await getDegradedState(PROCESS, ORG);
      expect(state.degraded).toBe(true);
      expect(state.scenario).toContain('object limit');
    });
  });

  // ─── §12 — setGatewayKind + setLane ────────────────────────

  describe('§12 — setGatewayKind + setLane', () => {
    it('sets gateway kind to xor', async () => {
      const result = await setGatewayKind('g1', ORG, 'xor');
      expect(result.success).toBe(true);
      expect(result.operation).toBe('set_gateway_kind');
    });

    it('sets gateway kind to and', async () => {
      const result = await setGatewayKind('g1', ORG, 'and');
      expect(result.success).toBe(true);
    });

    it('sets lane assignment', async () => {
      const result = await setLane('n1', ORG, 'lane-ops');
      expect(result.success).toBe(true);
      expect(result.operation).toBe('set_lane');
    });

    it('clears lane assignment', async () => {
      const result = await setLane('n1', ORG, null);
      expect(result.success).toBe(true);
    });
  });

  // ─── §13 — getProcessObjects ───────────────────────────────

  describe('§13 — getProcessObjects', () => {
    it('returns empty graph when table missing', async () => {
      mockTableExists.mockResolvedValue(false);
      const result = await getProcessObjects(PROCESS, ORG);
      expect(result.nodes).toHaveLength(0);
      expect(result.edges).toHaveLength(0);
      expect(result.degraded).toBe(true);
    });

    it('returns nodes and edges for healthy process', async () => {
      mockDbAll
        .mockResolvedValueOnce([
          {
            id: 's1',
            process_id: PROCESS,
            organization_id: ORG,
            object_type: 'start_event',
            label: 'Start',
            lane_id: null,
            pool_id: null,
            parent_subprocess_id: null,
            position_x: 0,
            position_y: 0,
            gateway_kind: null,
            metadata: null,
            created_at: '2026-01-01',
            updated_at: '2026-01-01',
          },
        ])
        .mockResolvedValueOnce([
          {
            id: 'sf1',
            process_id: PROCESS,
            organization_id: ORG,
            edge_type: 'sequence_flow',
            source_node_id: 's1',
            target_node_id: 's1',
            label: null,
            metadata: null,
            created_at: '2026-01-01',
            updated_at: '2026-01-01',
          },
        ]);

      const result = await getProcessObjects(PROCESS, ORG);
      expect(result.nodes).toHaveLength(1);
      expect(result.edges).toHaveLength(1);
      expect(result.degraded).toBe(false);
    });
  });

  // ─── §14 — Canon helpers (integration) ─────────────────────

  describe('§14 — Canon helpers (integration with service)', () => {
    it('validateSemanticRule rejects start_event with incoming flows', () => {
      const result = validateSemanticRule('start_event', 2, 1);
      expect(result.valid).toBe(false);
    });

    it('isValidSemanticObject accepts all P14 types', () => {
      for (const obj of P14_SEMANTIC_OBJECTS) {
        expect(isValidSemanticObject(obj)).toBe(true);
      }
    });

    it('isValidProcessFlowTool accepts all P14 tools', () => {
      for (const tool of P14_TOOLBELT) {
        expect(isValidProcessFlowTool(tool)).toBe(true);
      }
    });

    it('isValidMessageFlow rejects same-pool flow', () => {
      expect(isValidMessageFlow('p1', 'p1').valid).toBe(false);
    });

    it('isValidMessageFlow accepts cross-pool flow', () => {
      expect(isValidMessageFlow('p1', 'p2').valid).toBe(true);
    });
  });
});
