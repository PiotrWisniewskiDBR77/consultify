import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ZodError } from 'zod';

import type {
  EmitSignalParams,
  EmitResultsHandoffEventParams,
  CreateRebaselineProposalParams,
  AssessForecastConfidenceParams,
} from '../../../types/executionVisibility.js';
import {
  ExecutionSignalSchema,
  SignalAggregationSchema,
  ResultsHandoffEventSchema,
  RebaselineProposalSchema,
  ForecastConfidenceSchema,
  EmitSignalParamsSchema,
  EmitResultsHandoffEventParamsSchema,
  CreateRebaselineProposalParamsSchema,
  AssessForecastConfidenceParamsSchema,
  ExecutionSignalTypeValues,
  SourceObjectTypeValues,
  SignalSeverityValues,
  AggregationLevelValues,
  ResultsHandoffEventTypeValues,
  ForecastConfidenceLevelValues,
  ConfidenceCapReasonValues,
  SIGNAL_SEVERITY_RANK,
} from '../../../types/executionVisibility.js';

// ==========================================
// MOCK DB LAYER
// ==========================================

const mockDbRun = vi.fn().mockResolvedValue({ success: true });
const mockDbAll = vi.fn().mockResolvedValue([]);

vi.mock('../../../utils/DbPromise.js', () => ({
  run: (...args: unknown[]) => mockDbRun(...args),
  get: (...args: unknown[]) => mockDbAll(...args),
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
  emitSignal,
  getSignalsBySource,
  aggregateSignals,
  emitResultsHandoffEvent,
  getHandoffEventsByInitiative,
  createRebaselineProposal,
  getRebaselineProposalsByInitiative,
  assessForecastConfidence,
} from '../executionVisibilityService.js';

// ==========================================
// FIXTURES
// ==========================================

const ORG_ID = '00000000-0000-4000-8000-000000000001';
const OTHER_ORG_ID = '00000000-0000-4000-8000-000000000099';
const INITIATIVE_ID = 'init-001';
const RUN_ID = '00000000-0000-4000-8000-aaaaaaaaaaaa';

function makeSignalParams(overrides?: Partial<EmitSignalParams>): EmitSignalParams {
  return {
    signalType: 'overdue_tasks_count',
    sourceObjectType: 'initiative',
    sourceObjectId: INITIATIVE_ID,
    organizationId: ORG_ID,
    severity: 'warning',
    payload: { count: 5 },
    ...overrides,
  };
}

function makeFakeSignalRow(overrides?: Partial<Record<string, unknown>>) {
  return {
    signal_id: '00000000-0000-4000-8000-111111111111',
    signal_type: 'overdue_tasks_count',
    source_object_type: 'initiative',
    source_object_id: INITIATIVE_ID,
    organization_id: ORG_ID,
    severity: 'warning',
    payload: JSON.stringify({ count: 5 }),
    timestamp: '2026-03-23T10:00:00.000Z',
    ...overrides,
  };
}

function makeHandoffParams(
  overrides?: Partial<EmitResultsHandoffEventParams>,
): EmitResultsHandoffEventParams {
  return {
    eventType: 'milestone_completed',
    initiativeId: INITIATIVE_ID,
    organizationId: ORG_ID,
    payload: { milestoneId: 'ms-1' },
    ...overrides,
  };
}

function makeFakeHandoffRow(overrides?: Partial<Record<string, unknown>>) {
  return {
    event_id: '00000000-0000-4000-8000-222222222222',
    event_type: 'milestone_completed',
    initiative_id: INITIATIVE_ID,
    organization_id: ORG_ID,
    payload: JSON.stringify({ milestoneId: 'ms-1' }),
    timestamp: '2026-03-23T10:00:00.000Z',
    ...overrides,
  };
}

function makeRebaselineParams(
  overrides?: Partial<CreateRebaselineProposalParams>,
): CreateRebaselineProposalParams {
  return {
    initiativeId: INITIATIVE_ID,
    organizationId: ORG_ID,
    executionRunId: RUN_ID,
    reason: 'Scope change after vendor delay',
    baselineBefore: { endDate: '2026-06-01', effort: 200 },
    baselineAfter: { endDate: '2026-07-15', effort: 250 },
    ...overrides,
  };
}

function makeFakeRebaselineRow(overrides?: Partial<Record<string, unknown>>) {
  return {
    proposal_id: '00000000-0000-4000-8000-333333333333',
    initiative_id: INITIATIVE_ID,
    organization_id: ORG_ID,
    execution_run_id: RUN_ID,
    reason: 'Scope change after vendor delay',
    baseline_before: JSON.stringify({ endDate: '2026-06-01', effort: 200 }),
    baseline_after: JSON.stringify({ endDate: '2026-07-15', effort: 250 }),
    status: 'draft',
    created_at: '2026-03-23T10:00:00.000Z',
    resolved_at: null,
    ...overrides,
  };
}

// ==========================================
// TESTS
// ==========================================

beforeEach(() => {
  vi.clearAllMocks();
});

// ------------------------------------------
// A. SIGNAL EMISSION
// ------------------------------------------

describe('emitSignal', () => {
  it('emits a signal with all required fields', async () => {
    const result = await emitSignal(makeSignalParams());

    expect(result.signalId).toBeDefined();
    expect(result.signalType).toBe('overdue_tasks_count');
    expect(result.sourceObjectType).toBe('initiative');
    expect(result.sourceObjectId).toBe(INITIATIVE_ID);
    expect(result.organizationId).toBe(ORG_ID);
    expect(result.severity).toBe('warning');
    expect(result.payload).toEqual({ count: 5 });
    expect(result.timestamp).toBeDefined();

    expect(mockDbRun).toHaveBeenCalledTimes(1);
    const sql = mockDbRun.mock.calls[0][0] as string;
    expect(sql).toContain('INSERT INTO v8_execution_signals');
  });

  it('defaults payload to empty object when omitted', async () => {
    const result = await emitSignal(makeSignalParams({ payload: undefined }));
    expect(result.payload).toEqual({});
  });

  it('accepts all 13 canonical signal types', async () => {
    for (const signalType of ExecutionSignalTypeValues) {
      vi.clearAllMocks();
      const result = await emitSignal(makeSignalParams({ signalType }));
      expect(result.signalType).toBe(signalType);
    }
  });

  it('accepts all source object types', async () => {
    for (const sourceObjectType of SourceObjectTypeValues) {
      vi.clearAllMocks();
      const result = await emitSignal(makeSignalParams({ sourceObjectType }));
      expect(result.sourceObjectType).toBe(sourceObjectType);
    }
  });

  it('accepts all severity levels', async () => {
    for (const severity of SignalSeverityValues) {
      vi.clearAllMocks();
      const result = await emitSignal(makeSignalParams({ severity }));
      expect(result.severity).toBe(severity);
    }
  });

  it('rejects invalid signal type via Zod', async () => {
    await expect(
      emitSignal(makeSignalParams({ signalType: 'invalid_type' as any })),
    ).rejects.toThrow(ZodError);
  });

  it('rejects invalid severity via Zod', async () => {
    await expect(
      emitSignal(makeSignalParams({ severity: 'mega_bad' as any })),
    ).rejects.toThrow(ZodError);
  });

  it('rejects invalid UUID for organizationId', async () => {
    await expect(
      emitSignal(makeSignalParams({ organizationId: 'not-a-uuid' })),
    ).rejects.toThrow(ZodError);
  });

  it('rejects empty sourceObjectId', async () => {
    await expect(
      emitSignal(makeSignalParams({ sourceObjectId: '' })),
    ).rejects.toThrow(ZodError);
  });

  it('rejects missing required fields', async () => {
    await expect(
      emitSignal({ signalType: 'overdue_tasks_count' } as any),
    ).rejects.toThrow(ZodError);
  });
});

// ------------------------------------------
// B. GET SIGNALS BY SOURCE
// ------------------------------------------

describe('getSignalsBySource', () => {
  it('returns signals for a source with org isolation', async () => {
    mockDbAll.mockResolvedValueOnce([
      makeFakeSignalRow(),
      makeFakeSignalRow({
        signal_id: '00000000-0000-4000-8000-111111111112',
        signal_type: 'blocked_tasks_count',
        severity: 'critical',
      }),
    ]);

    const results = await getSignalsBySource('initiative', INITIATIVE_ID, ORG_ID);

    expect(results).toHaveLength(2);
    expect(results[0].signalType).toBe('overdue_tasks_count');
    expect(results[1].signalType).toBe('blocked_tasks_count');

    const sql = mockDbAll.mock.calls[0][0] as string;
    expect(sql).toContain('organization_id');
  });

  it('returns empty array when no signals exist', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    const results = await getSignalsBySource('initiative', INITIATIVE_ID, ORG_ID);
    expect(results).toEqual([]);
  });

  it('enforces org isolation — different org returns no results', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    const results = await getSignalsBySource('initiative', INITIATIVE_ID, OTHER_ORG_ID);
    expect(results).toEqual([]);
    const params = mockDbAll.mock.calls[0][1] as string[];
    expect(params[2]).toBe(OTHER_ORG_ID);
  });
});

// ------------------------------------------
// C. HIERARCHICAL SIGNAL AGGREGATION (Decision W3-8)
// ------------------------------------------

describe('aggregateSignals', () => {
  it('aggregates signals at initiative level', async () => {
    mockDbAll.mockResolvedValueOnce([
      makeFakeSignalRow({ severity: 'warning' }),
      makeFakeSignalRow({
        signal_id: '00000000-0000-4000-8000-111111111112',
        severity: 'info',
      }),
    ]);

    const result = await aggregateSignals('initiative', INITIATIVE_ID, ORG_ID);

    expect(result.aggregationId).toBeDefined();
    expect(result.level).toBe('initiative');
    expect(result.sourceObjectId).toBe(INITIATIVE_ID);
    expect(result.organizationId).toBe(ORG_ID);
    expect(result.sourceSignals).toHaveLength(2);
    expect(result.aggregatedSeverity).toBe('warning');
    expect(result.preservesLineage).toBe(true);
  });

  it('blocker severity rolls up explicitly — never averaged away (W3-8)', async () => {
    mockDbAll.mockResolvedValueOnce([
      makeFakeSignalRow({ severity: 'info' }),
      makeFakeSignalRow({
        signal_id: '00000000-0000-4000-8000-111111111112',
        severity: 'blocker',
      }),
      makeFakeSignalRow({
        signal_id: '00000000-0000-4000-8000-111111111113',
        severity: 'warning',
      }),
    ]);

    const result = await aggregateSignals('initiative', INITIATIVE_ID, ORG_ID);

    expect(result.aggregatedSeverity).toBe('blocker');
    expect(result.sourceSignals).toHaveLength(3);
  });

  it('critical severity rolls up when no blockers present', async () => {
    mockDbAll.mockResolvedValueOnce([
      makeFakeSignalRow({ severity: 'info' }),
      makeFakeSignalRow({
        signal_id: '00000000-0000-4000-8000-111111111112',
        severity: 'critical',
      }),
    ]);

    const result = await aggregateSignals('initiative', INITIATIVE_ID, ORG_ID);
    expect(result.aggregatedSeverity).toBe('critical');
  });

  it('returns info severity when all signals are info', async () => {
    mockDbAll.mockResolvedValueOnce([
      makeFakeSignalRow({ severity: 'info' }),
      makeFakeSignalRow({
        signal_id: '00000000-0000-4000-8000-111111111112',
        severity: 'info',
      }),
    ]);

    const result = await aggregateSignals('initiative', INITIATIVE_ID, ORG_ID);
    expect(result.aggregatedSeverity).toBe('info');
  });

  it('returns info severity when no signals exist (empty aggregation)', async () => {
    mockDbAll.mockResolvedValueOnce([]);

    const result = await aggregateSignals('initiative', INITIATIVE_ID, ORG_ID);

    expect(result.aggregatedSeverity).toBe('info');
    expect(result.sourceSignals).toEqual([]);
    expect(result.preservesLineage).toBe(true);
  });

  it('preserves lineage — stores all source signal IDs', async () => {
    const id1 = '00000000-0000-4000-8000-111111111111';
    const id2 = '00000000-0000-4000-8000-111111111112';
    mockDbAll.mockResolvedValueOnce([
      makeFakeSignalRow({ signal_id: id1 }),
      makeFakeSignalRow({ signal_id: id2 }),
    ]);

    const result = await aggregateSignals('initiative', INITIATIVE_ID, ORG_ID);
    expect(result.sourceSignals).toContain(id1);
    expect(result.sourceSignals).toContain(id2);
  });

  it('persists aggregation to database', async () => {
    mockDbAll.mockResolvedValueOnce([makeFakeSignalRow()]);

    await aggregateSignals('initiative', INITIATIVE_ID, ORG_ID);

    const insertCalls = mockDbRun.mock.calls.filter((c: unknown[]) =>
      (c[0] as string).includes('INSERT INTO v8_signal_aggregations'),
    );
    expect(insertCalls).toHaveLength(1);
  });

  it('works at project level', async () => {
    mockDbAll.mockResolvedValueOnce([
      makeFakeSignalRow({ source_object_type: 'project', severity: 'critical' }),
    ]);

    const result = await aggregateSignals('project', 'proj-1', ORG_ID);
    expect(result.level).toBe('project');
    expect(result.aggregatedSeverity).toBe('critical');
  });

  it('works at pmo level', async () => {
    mockDbAll.mockResolvedValueOnce([
      makeFakeSignalRow({ source_object_type: 'program', severity: 'blocker' }),
    ]);

    const result = await aggregateSignals('pmo', 'program-1', ORG_ID);
    expect(result.level).toBe('pmo');
    expect(result.aggregatedSeverity).toBe('blocker');
  });

  it('enforces org isolation in aggregation query', async () => {
    mockDbAll.mockResolvedValueOnce([]);

    await aggregateSignals('initiative', INITIATIVE_ID, OTHER_ORG_ID);

    const params = mockDbAll.mock.calls[0][1] as string[];
    expect(params[2]).toBe(OTHER_ORG_ID);
  });
});

// ------------------------------------------
// D. RESULTS HANDOFF EVENTS (Decision W3-9)
// ------------------------------------------

describe('emitResultsHandoffEvent', () => {
  it('emits a handoff event with all required fields', async () => {
    const result = await emitResultsHandoffEvent(makeHandoffParams());

    expect(result.eventId).toBeDefined();
    expect(result.eventType).toBe('milestone_completed');
    expect(result.initiativeId).toBe(INITIATIVE_ID);
    expect(result.organizationId).toBe(ORG_ID);
    expect(result.payload).toEqual({ milestoneId: 'ms-1' });
    expect(result.timestamp).toBeDefined();

    expect(mockDbRun).toHaveBeenCalledTimes(1);
    const sql = mockDbRun.mock.calls[0][0] as string;
    expect(sql).toContain('INSERT INTO v8_results_handoff_events');
  });

  it('accepts all 7 canonical handoff event types', async () => {
    for (const eventType of ResultsHandoffEventTypeValues) {
      vi.clearAllMocks();
      const result = await emitResultsHandoffEvent(makeHandoffParams({ eventType }));
      expect(result.eventType).toBe(eventType);
    }
  });

  it('defaults payload to empty object when omitted', async () => {
    const result = await emitResultsHandoffEvent(makeHandoffParams({ payload: undefined }));
    expect(result.payload).toEqual({});
  });

  it('rejects invalid event type via Zod', async () => {
    await expect(
      emitResultsHandoffEvent(makeHandoffParams({ eventType: 'invalid' as any })),
    ).rejects.toThrow(ZodError);
  });

  it('rejects invalid UUID for organizationId', async () => {
    await expect(
      emitResultsHandoffEvent(makeHandoffParams({ organizationId: 'bad' })),
    ).rejects.toThrow(ZodError);
  });

  it('rejects empty initiativeId', async () => {
    await expect(
      emitResultsHandoffEvent(makeHandoffParams({ initiativeId: '' })),
    ).rejects.toThrow(ZodError);
  });
});

describe('getHandoffEventsByInitiative', () => {
  it('returns events for an initiative with org isolation', async () => {
    mockDbAll.mockResolvedValueOnce([
      makeFakeHandoffRow(),
      makeFakeHandoffRow({
        event_id: '00000000-0000-4000-8000-222222222223',
        event_type: 'execution_progress_updated',
      }),
    ]);

    const results = await getHandoffEventsByInitiative(INITIATIVE_ID, ORG_ID);

    expect(results).toHaveLength(2);
    expect(results[0].eventType).toBe('milestone_completed');
    expect(results[1].eventType).toBe('execution_progress_updated');
  });

  it('returns empty array when no events exist', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    const results = await getHandoffEventsByInitiative(INITIATIVE_ID, ORG_ID);
    expect(results).toEqual([]);
  });

  it('enforces org isolation', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    await getHandoffEventsByInitiative(INITIATIVE_ID, OTHER_ORG_ID);
    const params = mockDbAll.mock.calls[0][1] as string[];
    expect(params[1]).toBe(OTHER_ORG_ID);
  });
});

// ------------------------------------------
// E. REBASELINE PROPOSALS (Decision W3-10)
// ------------------------------------------

describe('createRebaselineProposal', () => {
  it('creates a rebaseline proposal in draft status linked to approval spine', async () => {
    const result = await createRebaselineProposal(makeRebaselineParams());

    expect(result.proposalId).toBeDefined();
    expect(result.initiativeId).toBe(INITIATIVE_ID);
    expect(result.organizationId).toBe(ORG_ID);
    expect(result.executionRunId).toBe(RUN_ID);
    expect(result.reason).toBe('Scope change after vendor delay');
    expect(result.baselineBefore).toEqual({ endDate: '2026-06-01', effort: 200 });
    expect(result.baselineAfter).toEqual({ endDate: '2026-07-15', effort: 250 });
    expect(result.status).toBe('draft');
    expect(result.createdAt).toBeDefined();
    expect(result.resolvedAt).toBeNull();

    expect(mockDbRun).toHaveBeenCalledTimes(1);
    const sql = mockDbRun.mock.calls[0][0] as string;
    expect(sql).toContain('INSERT INTO v8_rebaseline_proposals');
  });

  it('stores executionRunId linking to shared approval spine (W3-10)', async () => {
    const result = await createRebaselineProposal(makeRebaselineParams());
    expect(result.executionRunId).toBe(RUN_ID);

    const insertParams = mockDbRun.mock.calls[0][1] as string[];
    expect(insertParams).toContain(RUN_ID);
  });

  it('rejects invalid UUID for executionRunId', async () => {
    await expect(
      createRebaselineProposal(makeRebaselineParams({ executionRunId: 'bad' })),
    ).rejects.toThrow(ZodError);
  });

  it('rejects invalid UUID for organizationId', async () => {
    await expect(
      createRebaselineProposal(makeRebaselineParams({ organizationId: 'bad' })),
    ).rejects.toThrow(ZodError);
  });

  it('rejects empty reason', async () => {
    await expect(
      createRebaselineProposal(makeRebaselineParams({ reason: '' })),
    ).rejects.toThrow(ZodError);
  });

  it('rejects empty initiativeId', async () => {
    await expect(
      createRebaselineProposal(makeRebaselineParams({ initiativeId: '' })),
    ).rejects.toThrow(ZodError);
  });
});

describe('getRebaselineProposalsByInitiative', () => {
  it('returns proposals for an initiative with org isolation', async () => {
    mockDbAll.mockResolvedValueOnce([
      makeFakeRebaselineRow(),
      makeFakeRebaselineRow({
        proposal_id: '00000000-0000-4000-8000-333333333334',
        status: 'approved',
        resolved_at: '2026-03-23T12:00:00.000Z',
      }),
    ]);

    const results = await getRebaselineProposalsByInitiative(INITIATIVE_ID, ORG_ID);

    expect(results).toHaveLength(2);
    expect(results[0].status).toBe('draft');
    expect(results[1].status).toBe('approved');
    expect(results[1].resolvedAt).toBe('2026-03-23T12:00:00.000Z');
  });

  it('returns empty array when no proposals exist', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    const results = await getRebaselineProposalsByInitiative(INITIATIVE_ID, ORG_ID);
    expect(results).toEqual([]);
  });

  it('enforces org isolation', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    await getRebaselineProposalsByInitiative(INITIATIVE_ID, OTHER_ORG_ID);
    const params = mockDbAll.mock.calls[0][1] as string[];
    expect(params[1]).toBe(OTHER_ORG_ID);
  });
});

// ------------------------------------------
// F. FORECAST CONFIDENCE (Decision W3-11)
// ------------------------------------------

describe('assessForecastConfidence', () => {
  it('returns insufficient_data when dataReliabilityScore < 0.3', async () => {
    const result = await assessForecastConfidence({
      dataReliabilityScore: 0.2,
      hasCapacityGap: false,
      criticalPathKnown: true,
    });

    expect(result.confidenceLevel).toBe('insufficient_data');
    expect(result.cappedBy).toBe('data_reliability');
    expect(result.dataReliabilityScore).toBe(0.2);
  });

  it('returns insufficient_data at score 0.0', async () => {
    const result = await assessForecastConfidence({
      dataReliabilityScore: 0.0,
      hasCapacityGap: false,
      criticalPathKnown: true,
    });
    expect(result.confidenceLevel).toBe('insufficient_data');
    expect(result.cappedBy).toBe('data_reliability');
  });

  it('returns low_confidence when dataReliabilityScore < 0.6', async () => {
    const result = await assessForecastConfidence({
      dataReliabilityScore: 0.5,
      hasCapacityGap: false,
      criticalPathKnown: true,
    });

    expect(result.confidenceLevel).toBe('low_confidence');
    expect(result.cappedBy).toBe('data_reliability');
  });

  it('caps at low_confidence when hasCapacityGap is true (W3-11)', async () => {
    const result = await assessForecastConfidence({
      dataReliabilityScore: 0.9,
      hasCapacityGap: true,
      criticalPathKnown: true,
    });

    expect(result.confidenceLevel).toBe('low_confidence');
    expect(result.cappedBy).toBe('capacity_gap');
  });

  it('caps at low_confidence when criticalPathKnown is false (W3-11)', async () => {
    const result = await assessForecastConfidence({
      dataReliabilityScore: 0.85,
      hasCapacityGap: false,
      criticalPathKnown: false,
    });

    expect(result.confidenceLevel).toBe('low_confidence');
    expect(result.cappedBy).toBe('critical_path_unknown');
  });

  it('returns high_confidence when score >= 0.8 and no caps', async () => {
    const result = await assessForecastConfidence({
      dataReliabilityScore: 0.9,
      hasCapacityGap: false,
      criticalPathKnown: true,
    });

    expect(result.confidenceLevel).toBe('high_confidence');
    expect(result.cappedBy).toBeNull();
    expect(result.dataReliabilityScore).toBe(0.9);
  });

  it('returns medium_confidence when 0.6 <= score < 0.8 and no caps', async () => {
    const result = await assessForecastConfidence({
      dataReliabilityScore: 0.7,
      hasCapacityGap: false,
      criticalPathKnown: true,
    });

    expect(result.confidenceLevel).toBe('medium_confidence');
    expect(result.cappedBy).toBeNull();
  });

  it('returns high_confidence at exactly 0.8', async () => {
    const result = await assessForecastConfidence({
      dataReliabilityScore: 0.8,
      hasCapacityGap: false,
      criticalPathKnown: true,
    });
    expect(result.confidenceLevel).toBe('high_confidence');
  });

  it('returns medium_confidence at exactly 0.6', async () => {
    const result = await assessForecastConfidence({
      dataReliabilityScore: 0.6,
      hasCapacityGap: false,
      criticalPathKnown: true,
    });
    expect(result.confidenceLevel).toBe('medium_confidence');
  });

  it('data_reliability cap takes precedence over capacity_gap', async () => {
    const result = await assessForecastConfidence({
      dataReliabilityScore: 0.2,
      hasCapacityGap: true,
      criticalPathKnown: false,
    });
    expect(result.confidenceLevel).toBe('insufficient_data');
    expect(result.cappedBy).toBe('data_reliability');
  });

  it('capacity_gap cap takes precedence over critical_path_unknown', async () => {
    const result = await assessForecastConfidence({
      dataReliabilityScore: 0.9,
      hasCapacityGap: true,
      criticalPathKnown: false,
    });
    expect(result.confidenceLevel).toBe('low_confidence');
    expect(result.cappedBy).toBe('capacity_gap');
  });

  it('rejects dataReliabilityScore > 1', async () => {
    await expect(
      assessForecastConfidence({
        dataReliabilityScore: 1.5,
        hasCapacityGap: false,
        criticalPathKnown: true,
      }),
    ).rejects.toThrow(ZodError);
  });

  it('rejects dataReliabilityScore < 0', async () => {
    await expect(
      assessForecastConfidence({
        dataReliabilityScore: -0.1,
        hasCapacityGap: false,
        criticalPathKnown: true,
      }),
    ).rejects.toThrow(ZodError);
  });

  it('rejects missing required fields', async () => {
    await expect(
      assessForecastConfidence({ dataReliabilityScore: 0.5 } as any),
    ).rejects.toThrow(ZodError);
  });
});

// ------------------------------------------
// G. ZOD SCHEMA VALIDATION
// ------------------------------------------

describe('Zod schemas — output validation', () => {
  it('ExecutionSignalSchema validates a well-formed signal', () => {
    const signal = {
      signalId: '00000000-0000-4000-8000-111111111111',
      signalType: 'overdue_tasks_count',
      sourceObjectType: 'initiative',
      sourceObjectId: 'init-001',
      organizationId: ORG_ID,
      severity: 'warning',
      payload: { count: 5 },
      timestamp: '2026-03-23T10:00:00.000Z',
    };
    expect(() => ExecutionSignalSchema.parse(signal)).not.toThrow();
  });

  it('SignalAggregationSchema validates a well-formed aggregation', () => {
    const agg = {
      aggregationId: '00000000-0000-4000-8000-111111111111',
      level: 'initiative',
      sourceObjectId: 'init-001',
      organizationId: ORG_ID,
      sourceSignals: ['s1', 's2'],
      aggregatedSeverity: 'blocker',
      preservesLineage: true,
      timestamp: '2026-03-23T10:00:00.000Z',
    };
    expect(() => SignalAggregationSchema.parse(agg)).not.toThrow();
  });

  it('ResultsHandoffEventSchema validates a well-formed event', () => {
    const event = {
      eventId: '00000000-0000-4000-8000-111111111111',
      eventType: 'milestone_completed',
      initiativeId: 'init-001',
      organizationId: ORG_ID,
      payload: {},
      timestamp: '2026-03-23T10:00:00.000Z',
    };
    expect(() => ResultsHandoffEventSchema.parse(event)).not.toThrow();
  });

  it('RebaselineProposalSchema validates a well-formed proposal', () => {
    const proposal = {
      proposalId: '00000000-0000-4000-8000-111111111111',
      initiativeId: 'init-001',
      organizationId: ORG_ID,
      executionRunId: RUN_ID,
      reason: 'Scope change',
      baselineBefore: {},
      baselineAfter: {},
      status: 'draft',
      createdAt: '2026-03-23T10:00:00.000Z',
      resolvedAt: null,
    };
    expect(() => RebaselineProposalSchema.parse(proposal)).not.toThrow();
  });

  it('ForecastConfidenceSchema validates a well-formed confidence', () => {
    const fc = {
      confidenceLevel: 'high_confidence',
      cappedBy: null,
      dataReliabilityScore: 0.9,
    };
    expect(() => ForecastConfidenceSchema.parse(fc)).not.toThrow();
  });

  it('ForecastConfidenceSchema validates with cap reason', () => {
    const fc = {
      confidenceLevel: 'low_confidence',
      cappedBy: 'capacity_gap',
      dataReliabilityScore: 0.4,
    };
    expect(() => ForecastConfidenceSchema.parse(fc)).not.toThrow();
  });
});

// ------------------------------------------
// H. SEVERITY RANKING
// ------------------------------------------

describe('SIGNAL_SEVERITY_RANK', () => {
  it('ranks info < warning < critical < blocker', () => {
    expect(SIGNAL_SEVERITY_RANK.info).toBeLessThan(SIGNAL_SEVERITY_RANK.warning);
    expect(SIGNAL_SEVERITY_RANK.warning).toBeLessThan(SIGNAL_SEVERITY_RANK.critical);
    expect(SIGNAL_SEVERITY_RANK.critical).toBeLessThan(SIGNAL_SEVERITY_RANK.blocker);
  });

  it('covers all severity values', () => {
    for (const sev of SignalSeverityValues) {
      expect(SIGNAL_SEVERITY_RANK[sev]).toBeDefined();
    }
  });
});

// ------------------------------------------
// I. ENUM COMPLETENESS
// ------------------------------------------

describe('enum completeness', () => {
  it('has exactly 13 canonical execution signal types', () => {
    expect(ExecutionSignalTypeValues).toHaveLength(13);
  });

  it('has exactly 7 canonical results handoff event types (W3-9)', () => {
    expect(ResultsHandoffEventTypeValues).toHaveLength(7);
  });

  it('has 4 aggregation levels', () => {
    expect(AggregationLevelValues).toHaveLength(4);
  });

  it('has 4 forecast confidence levels', () => {
    expect(ForecastConfidenceLevelValues).toHaveLength(4);
  });

  it('has 3 confidence cap reasons', () => {
    expect(ConfidenceCapReasonValues).toHaveLength(3);
  });

  it('has 5 source object types', () => {
    expect(SourceObjectTypeValues).toHaveLength(5);
  });

  it('has 4 signal severity levels', () => {
    expect(SignalSeverityValues).toHaveLength(4);
  });
});
