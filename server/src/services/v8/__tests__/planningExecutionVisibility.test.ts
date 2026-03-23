import { describe, expect, it, vi, beforeEach } from 'vitest';

const mockDbRun = vi.fn().mockResolvedValue({ success: true });
const mockDbGet = vi.fn().mockResolvedValue(null);
const mockDbAll = vi.fn().mockResolvedValue([]);

vi.mock('../../../utils/DbPromise.js', () => ({
  run: (...args: unknown[]) => mockDbRun(...args),
  get: (...args: unknown[]) => mockDbGet(...args),
  all: (...args: unknown[]) => mockDbAll(...args),
}));

vi.mock('../../../utils/Logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import {
  getWBSByInitiative,
  validateWBSCompleteness,
  getCriticalPath,
  getPendingDecisions,
} from '../planningContinuityService.js';
import {
  getExecutionDashboard,
  detectBlockers,
  getRebaselineHistory,
  rollupSignals,
} from '../executionVisibilityService.js';

const ORG_ID = '10000000-0000-4000-8000-000000000001';
const INITIATIVE_ID = '20000000-0000-4000-8000-000000000010';
const RUN_ID = '30000000-0000-4000-8000-000000000020';

function decompRow(overrides: Record<string, unknown>) {
  return {
    decomposition_id: '40000000-0000-4000-8000-000000000001',
    organization_id: ORG_ID,
    initiative_id: INITIATIVE_ID,
    parent_id: null,
    wbs_level: 'initiative',
    object_type: 'workstream',
    object_id: 'obj-1',
    approval_inherited: 1,
    created_at: '2026-03-23T10:00:00.000Z',
    updated_at: '2026-03-23T10:00:00.000Z',
    metadata: '{}',
    ...overrides,
  };
}

describe('Wave 11 — planning continuity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbRun.mockResolvedValue({ success: true });
    mockDbGet.mockResolvedValue(null);
    mockDbAll.mockResolvedValue([]);
  });

  it('getWBSByInitiative loads decomposition tree for initiative + org', async () => {
    const rows = [
      decompRow({
        decomposition_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0001',
        parent_id: null,
        wbs_level: 'initiative',
        object_id: 'root',
      }),
    ];
    mockDbAll.mockResolvedValueOnce(rows);

    const tree = await getWBSByInitiative(INITIATIVE_ID, ORG_ID);

    expect(mockDbAll).toHaveBeenCalledWith(
      expect.stringContaining('v8_initiative_decompositions'),
      [INITIATIVE_ID, ORG_ID],
      { fallback: true },
    );
    expect(tree).toHaveLength(1);
    expect(tree[0]!.decompositionId).toBe('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0001');
    expect(tree[0]!.wbsLevel).toBe('initiative');
  });

  it('validateWBSCompleteness flags non-leaf nodes without children', async () => {
    const rows = [
      decompRow({
        decomposition_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0001',
        parent_id: null,
        wbs_level: 'initiative',
        object_id: 'root',
      }),
      decompRow({
        decomposition_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb002',
        parent_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0001',
        wbs_level: 'workstream_phase',
        object_id: 'ws-1',
      }),
      decompRow({
        decomposition_id: 'cccccccc-cccc-4ccc-8ccc-cccccccc0003',
        parent_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb002',
        wbs_level: 'task',
        object_id: 'task-orphan',
      }),
    ];
    mockDbAll.mockResolvedValueOnce(rows);

    const result = await validateWBSCompleteness(INITIATIVE_ID, ORG_ID);

    expect(result.complete).toBe(false);
    expect(result.gaps).toEqual([
      expect.objectContaining({
        nodeId: 'cccccccc-cccc-4ccc-8ccc-cccccccc0003',
        level: 'task',
        reason: 'non_leaf_without_children',
      }),
    ]);
  });

  it('validateWBSCompleteness returns complete when chain reaches subtasks', async () => {
    const rows = [
      decompRow({
        decomposition_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0001',
        parent_id: null,
        wbs_level: 'initiative',
        object_id: 'root',
      }),
      decompRow({
        decomposition_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb002',
        parent_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0001',
        wbs_level: 'workstream_phase',
        object_id: 'ws-1',
      }),
      decompRow({
        decomposition_id: 'cccccccc-cccc-4ccc-8ccc-cccccccc0003',
        parent_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb002',
        wbs_level: 'task',
        object_id: 'task-1',
      }),
      decompRow({
        decomposition_id: 'dddddddd-dddd-4ddd-8ddd-dddddddd0004',
        parent_id: 'cccccccc-cccc-4ccc-8ccc-cccccccc0003',
        wbs_level: 'subtask',
        object_id: 'st-1',
      }),
    ];
    mockDbAll.mockResolvedValueOnce(rows);

    const result = await validateWBSCompleteness(INITIATIVE_ID, ORG_ID);
    expect(result.complete).toBe(true);
    expect(result.gaps).toHaveLength(0);
  });

  it('getCriticalPath returns longest root-to-leaf decomposition chain', async () => {
    const rows = [
      decompRow({
        decomposition_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0001',
        parent_id: null,
        wbs_level: 'initiative',
        object_id: 'root',
      }),
      decompRow({
        decomposition_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb002',
        parent_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0001',
        wbs_level: 'workstream_phase',
        object_id: 'ws-1',
      }),
      decompRow({
        decomposition_id: 'cccccccc-cccc-4ccc-8ccc-cccccccc0003',
        parent_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb002',
        wbs_level: 'task',
        object_id: 'task-1',
      }),
      decompRow({
        decomposition_id: 'dddddddd-dddd-4ddd-8ddd-dddddddd0004',
        parent_id: 'cccccccc-cccc-4ccc-8ccc-cccccccc0003',
        wbs_level: 'subtask',
        object_id: 'st-1',
      }),
    ];
    mockDbAll.mockResolvedValueOnce(rows);

    const path = await getCriticalPath(INITIATIVE_ID, ORG_ID);

    expect(path.map((n) => n.decompositionId)).toEqual([
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0001',
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb002',
      'cccccccc-cccc-4ccc-8ccc-cccccccc0003',
      'dddddddd-dddd-4ddd-8ddd-dddddddd0004',
    ]);
  });

  it('getPendingDecisions returns chains that include a pending decision entry', async () => {
    const decisionsOpen = JSON.stringify([
      { decisionId: 'd1', order: 0, status: 'pending', decidedBy: null, decidedAt: null },
    ]);
    const decisionsDone = JSON.stringify([
      { decisionId: 'd2', order: 0, status: 'approved', decidedBy: ORG_ID, decidedAt: '2026-03-23T12:00:00.000Z' },
    ]);
    mockDbAll.mockResolvedValueOnce([
      {
        chain_id: '50000000-0000-4000-8000-0000000000aa',
        organization_id: ORG_ID,
        initiative_id: INITIATIVE_ID,
        chain_type: 'sequential',
        decisions: decisionsOpen,
        status: 'open',
        created_at: '2026-03-23T10:00:00.000Z',
        updated_at: '2026-03-23T10:00:00.000Z',
        metadata: '{}',
      },
      {
        chain_id: '60000000-0000-4000-8000-0000000000bb',
        organization_id: ORG_ID,
        initiative_id: INITIATIVE_ID,
        chain_type: 'parallel',
        decisions: decisionsDone,
        status: 'completed',
        created_at: '2026-03-23T09:00:00.000Z',
        updated_at: '2026-03-23T11:00:00.000Z',
        metadata: '{}',
      },
    ]);

    const pending = await getPendingDecisions(ORG_ID);

    expect(mockDbAll).toHaveBeenCalledWith(
      expect.stringContaining('v8_decision_chains'),
      [ORG_ID],
      { fallback: true },
    );
    expect(pending).toHaveLength(1);
    expect(pending[0]!.chainId).toBe('50000000-0000-4000-8000-0000000000aa');
  });
});

describe('Wave 11 — execution visibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbRun.mockResolvedValue({ success: true });
    mockDbGet.mockResolvedValue(null);
    mockDbAll.mockResolvedValue([]);
  });

  it('getExecutionDashboard aggregates signals, handoffs, forecast, and health', async () => {
    mockDbAll
      .mockResolvedValueOnce([
        {
          signal_id: '70000000-0000-4000-8000-0000000000c1',
          signal_type: 'overdue_tasks_count',
          source_object_type: 'initiative',
          source_object_id: INITIATIVE_ID,
          organization_id: ORG_ID,
          severity: 'warning',
          payload: '{}',
          timestamp: '2026-03-23T10:00:00.000Z',
        },
      ])
      .mockResolvedValueOnce([
        {
          event_id: '80000000-0000-4000-8000-0000000000d1',
          event_type: 'milestone_completed',
          initiative_id: INITIATIVE_ID,
          organization_id: ORG_ID,
          payload: '{}',
          timestamp: '2026-03-23T11:00:00.000Z',
        },
      ]);

    const dash = await getExecutionDashboard(INITIATIVE_ID, ORG_ID);

    expect(dash.signals).toHaveLength(1);
    expect(dash.handoffs).toHaveLength(1);
    expect(dash.forecasts.dataReliabilityScore).toBeGreaterThan(0);
    expect(dash.forecasts.dataReliabilityScore).toBeLessThanOrEqual(1);
    expect(['healthy', 'at_risk', 'blocked']).toContain(dash.overallHealth);
    expect(dash.overallHealth).toBe('at_risk');
  });

  it('detectBlockers includes severity blocker signals and very low forecast reliability', async () => {
    mockDbAll
      .mockResolvedValueOnce([
        {
          signal_id: '70000000-0000-4000-8000-0000000000c1',
          signal_type: 'blocked_tasks_count',
          source_object_type: 'initiative',
          source_object_id: INITIATIVE_ID,
          organization_id: ORG_ID,
          severity: 'blocker',
          payload: '{}',
          timestamp: '2026-03-23T10:00:00.000Z',
        },
        {
          signal_id: '70000000-0000-4000-8000-0000000000c2',
          signal_type: 'forecast_low_confidence_count',
          source_object_type: 'initiative',
          source_object_id: INITIATIVE_ID,
          organization_id: ORG_ID,
          severity: 'critical',
          payload: '{}',
          timestamp: '2026-03-23T10:01:00.000Z',
        },
      ])
      .mockResolvedValueOnce([]);

    const blockers = await detectBlockers(INITIATIVE_ID, ORG_ID);

    expect(blockers.some((b) => b.kind === 'signal_severity_blocker')).toBe(true);
    expect(blockers.some((b) => b.kind === 'low_forecast_confidence')).toBe(true);
  });

  it('getRebaselineHistory orders proposals by created_at descending', async () => {
    mockDbAll.mockResolvedValueOnce([
      {
        proposal_id: '90000000-0000-4000-8000-0000000000e2',
        initiative_id: INITIATIVE_ID,
        organization_id: ORG_ID,
        execution_run_id: RUN_ID,
        reason: 'newer',
        baseline_before: '{}',
        baseline_after: '{}',
        status: 'draft',
        created_at: '2026-03-24T10:00:00.000Z',
        resolved_at: null,
      },
      {
        proposal_id: '90000000-0000-4000-8000-0000000000e1',
        initiative_id: INITIATIVE_ID,
        organization_id: ORG_ID,
        execution_run_id: RUN_ID,
        reason: 'older',
        baseline_before: '{}',
        baseline_after: '{}',
        status: 'approved',
        created_at: '2026-03-20T10:00:00.000Z',
        resolved_at: '2026-03-21T10:00:00.000Z',
      },
    ]);

    const hist = await getRebaselineHistory(INITIATIVE_ID, ORG_ID);

    expect(mockDbAll).toHaveBeenCalledWith(
      expect.stringContaining('ORDER BY created_at DESC'),
      [INITIATIVE_ID, ORG_ID],
      { fallback: true },
    );
    expect(hist[0]!.proposalId).toBe('90000000-0000-4000-8000-0000000000e2');
    expect(hist[1]!.proposalId).toBe('90000000-0000-4000-8000-0000000000e1');
  });

  it('rollupSignals counts by signal type and initiative vs non-initiative sources', async () => {
    mockDbAll.mockResolvedValueOnce([
      {
        signal_id: 'a0000000-0000-4000-8000-0000000000f1',
        signal_type: 'overdue_tasks_count',
        source_object_type: 'initiative',
        source_object_id: INITIATIVE_ID,
        organization_id: ORG_ID,
        severity: 'info',
        payload: '{}',
        timestamp: '2026-03-23T12:00:00.000Z',
      },
      {
        signal_id: 'a0000000-0000-4000-8000-0000000000f2',
        signal_type: 'overdue_tasks_count',
        source_object_type: 'initiative',
        source_object_id: INITIATIVE_ID,
        organization_id: ORG_ID,
        severity: 'info',
        payload: '{}',
        timestamp: '2026-03-23T12:30:00.000Z',
      },
      {
        signal_id: 'a0000000-0000-4000-8000-0000000000f3',
        signal_type: 'stale_items_count',
        source_object_type: 'task',
        source_object_id: 'task-xyz',
        organization_id: ORG_ID,
        severity: 'warning',
        payload: '{}',
        timestamp: '2026-03-23T13:00:00.000Z',
      },
    ]);

    const rollup = await rollupSignals(ORG_ID, '2026-03-23T00:00:00.000Z', '2026-03-23T23:59:59.999Z');

    expect(rollup.total).toBe(3);
    expect(rollup.byType.get('overdue_tasks_count')).toBe(2);
    expect(rollup.byType.get('stale_items_count')).toBe(1);
    expect(rollup.byInitiative.get(INITIATIVE_ID)).toBe(2);
    expect(rollup.byInitiative.get('__non_initiative__')).toBe(1);

    expect(mockDbAll).toHaveBeenCalledWith(
      expect.stringContaining('v8_execution_signals'),
      [ORG_ID, '2026-03-23T00:00:00.000Z', '2026-03-23T23:59:59.999Z'],
      { fallback: true },
    );
  });
});
