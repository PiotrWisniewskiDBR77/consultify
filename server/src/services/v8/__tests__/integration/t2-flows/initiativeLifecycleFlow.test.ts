/**
 * F04 — Initiative lifecycle end-to-end flow integration test
 *
 * Flow: recordSourceMaterialization() → recordDecomposition() (WBS) →
 *       emitSignal() → aggregateSignals() → emitResultsHandoffEvent() →
 *       verify signal aggregation preserves lineage from source through to handoff
 *
 * Services: sourceTruthService, planningContinuityService, executionVisibilityService
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';

// ==========================================
// MOCK DB LAYER
// ==========================================

const mockDbRun = vi.fn().mockResolvedValue({ success: true });
const mockDbGet = vi.fn().mockResolvedValue(null);
const mockDbAll = vi.fn().mockResolvedValue([]);

vi.mock('../../../../../utils/DbPromise.js', () => ({
  run: (...args: unknown[]) => mockDbRun(...args),
  get: (...args: unknown[]) => mockDbGet(...args),
  all: (...args: unknown[]) => mockDbAll(...args),
}));

vi.mock('../../../../../utils/Logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { recordSourceMaterialization } from '../../../sourceTruthService.js';
import { recordDecomposition } from '../../../planningContinuityService.js';
import {
  emitSignal,
  aggregateSignals,
  emitResultsHandoffEvent,
} from '../../../executionVisibilityService.js';

// ==========================================
// FIXTURES
// ==========================================

const ORG_ID = '00000000-0000-4000-8000-000000000001';
const INITIATIVE_ID = '00000000-0000-4000-8000-000000000060';
const SOURCE_ARTIFACT_ID = '00000000-0000-4000-8000-000000000070';
const SNAPSHOT_ID = '00000000-0000-4000-8000-000000000010';
const USER_ID = '00000000-0000-4000-8000-000000000003';

// ==========================================
// TESTS
// ==========================================

beforeEach(() => {
  vi.clearAllMocks();
  mockDbRun.mockResolvedValue({ success: true });
  mockDbGet.mockResolvedValue(null);
  mockDbAll.mockResolvedValue([]);
});

describe('F04 — Initiative lifecycle end-to-end flow', () => {
  it('canonical flow completes end-to-end', async () => {
    // Step 1: Record source materialization — how an artifact became an initiative
    const materialization = await recordSourceMaterialization({
      initiativeId: INITIATIVE_ID,
      organizationId: ORG_ID,
      entrypoint: 'idea',
      sourceArtifactId: SOURCE_ARTIFACT_ID,
      sourceArtifactType: 'idea',
      contextSnapshotId: SNAPSHOT_ID,
      materializationMode: 'invisible',
      evidenceClass: 'strong',
      promotedBy: USER_ID,
    });
    expect(materialization.recordId).toBeDefined();
    expect(materialization.initiativeId).toBe(INITIATIVE_ID);
    expect(materialization.entrypointClass).toBeDefined();
    expect(materialization.evidenceClass).toBe('strong');

    // Step 2: Record WBS decomposition — initiative level
    const decomposition = await recordDecomposition({
      organizationId: ORG_ID,
      initiativeId: INITIATIVE_ID,
      wbsLevel: 'initiative',
      objectType: 'workstream',
      objectId: INITIATIVE_ID,
      approvalInherited: false,
      metadata: { name: 'Digital Transformation Program' },
    });
    expect(decomposition.decompositionId).toBeDefined();
    expect(decomposition.wbsLevel).toBe('initiative');
    expect(decomposition.initiativeId).toBe(INITIATIVE_ID);

    // Step 3: Emit execution signals for the initiative
    const signal1 = await emitSignal({
      signalType: 'overdue_tasks_count',
      sourceObjectType: 'initiative',
      sourceObjectId: INITIATIVE_ID,
      organizationId: ORG_ID,
      severity: 'info',
      payload: { completion: 0.25, phase: 'planning' },
    });
    expect(signal1.signalId).toBeDefined();
    expect(signal1.sourceObjectId).toBe(INITIATIVE_ID);

    const signal2 = await emitSignal({
      signalType: 'blocked_tasks_count',
      sourceObjectType: 'initiative',
      sourceObjectId: INITIATIVE_ID,
      organizationId: ORG_ID,
      severity: 'critical',
      payload: { blocker: 'Resource allocation pending', blockerType: 'resource' },
    });
    expect(signal2.signalId).toBeDefined();
    expect(signal2.severity).toBe('critical');

    // Step 4: Aggregate signals — should roll up to highest severity
    mockDbAll.mockImplementation(
      (sql: string) => {
        if (typeof sql === 'string' && sql.includes('v8_execution_signals')) {
          return Promise.resolve([
            {
              signal_id: signal1.signalId,
              signal_type: 'overdue_tasks_count',
              source_object_type: 'initiative',
              source_object_id: INITIATIVE_ID,
              organization_id: ORG_ID,
              severity: 'info',
              payload: JSON.stringify({ completion: 0.25 }),
              timestamp: signal1.timestamp,
            },
            {
              signal_id: signal2.signalId,
              signal_type: 'blocked_tasks_count',
              source_object_type: 'initiative',
              source_object_id: INITIATIVE_ID,
              organization_id: ORG_ID,
              severity: 'critical',
              payload: JSON.stringify({ blocker: 'Resource allocation pending' }),
              timestamp: signal2.timestamp,
            },
          ]);
        }
        return Promise.resolve([]);
      },
    );

    const aggregation = await aggregateSignals(
      'initiative',
      INITIATIVE_ID,
      ORG_ID,
    );
    expect(aggregation.aggregationId).toBeDefined();
    expect(aggregation.level).toBe('initiative');
    expect(aggregation.sourceSignals).toHaveLength(2);
    expect(aggregation.sourceSignals).toContain(signal1.signalId);
    expect(aggregation.sourceSignals).toContain(signal2.signalId);
    expect(aggregation.aggregatedSeverity).toBe('critical');
    expect(aggregation.preservesLineage).toBe(true);

    // Step 5: Emit results handoff event
    mockDbAll.mockResolvedValue([]);
    const handoffEvent = await emitResultsHandoffEvent({
      eventType: 'handover_completed',
      initiativeId: INITIATIVE_ID,
      organizationId: ORG_ID,
      payload: {
        sourceRecordId: materialization.recordId,
        decompositionId: decomposition.decompositionId,
        aggregationId: aggregation.aggregationId,
        finalSeverity: aggregation.aggregatedSeverity,
      },
    });
    expect(handoffEvent.eventId).toBeDefined();
    expect(handoffEvent.eventType).toBe('handover_completed');
    expect(handoffEvent.initiativeId).toBe(INITIATIVE_ID);

    // Verify lineage: source → decomposition → signals → aggregation → handoff
    expect(materialization.initiativeId).toBe(INITIATIVE_ID);
    expect(decomposition.initiativeId).toBe(INITIATIVE_ID);
    expect(aggregation.sourceSignals).toContain(signal1.signalId);
    expect(aggregation.sourceSignals).toContain(signal2.signalId);
    expect(handoffEvent.payload.sourceRecordId).toBe(materialization.recordId);
    expect(handoffEvent.payload.aggregationId).toBe(aggregation.aggregationId);
  });

  it('intermediate outputs satisfy downstream contracts', async () => {
    // recordSourceMaterialization output has recordId and initiativeId
    const mat = await recordSourceMaterialization({
      initiativeId: INITIATIVE_ID,
      organizationId: ORG_ID,
      entrypoint: 'chat',
      sourceArtifactId: SOURCE_ARTIFACT_ID,
      sourceArtifactType: 'conversation',
      materializationMode: 'explicit_confirmation',
      evidenceClass: 'moderate',
      promotedBy: USER_ID,
    });
    expect(mat).toHaveProperty('recordId');
    expect(mat).toHaveProperty('initiativeId');
    expect(mat).toHaveProperty('entrypointClass');
    expect(mat).toHaveProperty('evidenceClass');
    expect(typeof mat.recordId).toBe('string');

    // recordDecomposition output has decompositionId and initiativeId
    const decomp = await recordDecomposition({
      organizationId: ORG_ID,
      initiativeId: INITIATIVE_ID,
      wbsLevel: 'initiative',
      objectType: 'workstream',
      objectId: INITIATIVE_ID,
      approvalInherited: false,
      metadata: {},
    });
    expect(decomp).toHaveProperty('decompositionId');
    expect(decomp).toHaveProperty('initiativeId');
    expect(decomp).toHaveProperty('wbsLevel');
    expect(decomp.initiativeId).toBe(INITIATIVE_ID);

    // emitSignal output has signalId needed by aggregateSignals
    const sig = await emitSignal({
      signalType: 'critical_risks_count',
      sourceObjectType: 'initiative',
      sourceObjectId: INITIATIVE_ID,
      organizationId: ORG_ID,
      severity: 'warning',
      payload: { from: 'active', to: 'at_risk' },
    });
    expect(sig).toHaveProperty('signalId');
    expect(sig).toHaveProperty('signalType');
    expect(sig).toHaveProperty('severity');
    expect(sig).toHaveProperty('timestamp');
    expect(typeof sig.signalId).toBe('string');

    // aggregateSignals output has aggregationId, sourceSignals, preservesLineage
    mockDbAll.mockResolvedValue([
      {
        signal_id: sig.signalId,
        signal_type: 'critical_risks_count',
        source_object_type: 'initiative',
        source_object_id: INITIATIVE_ID,
        organization_id: ORG_ID,
        severity: 'warning',
        payload: JSON.stringify({}),
        timestamp: sig.timestamp,
      },
    ]);
    const agg = await aggregateSignals('initiative', INITIATIVE_ID, ORG_ID);
    expect(agg).toHaveProperty('aggregationId');
    expect(agg).toHaveProperty('sourceSignals');
    expect(agg).toHaveProperty('aggregatedSeverity');
    expect(agg).toHaveProperty('preservesLineage');
    expect(agg.preservesLineage).toBe(true);
    expect(Array.isArray(agg.sourceSignals)).toBe(true);

    // emitResultsHandoffEvent output has eventId and initiativeId
    mockDbAll.mockResolvedValue([]);
    const event = await emitResultsHandoffEvent({
      eventType: 'execution_progress_updated',
      initiativeId: INITIATIVE_ID,
      organizationId: ORG_ID,
      payload: { test: true },
    });
    expect(event).toHaveProperty('eventId');
    expect(event).toHaveProperty('eventType');
    expect(event).toHaveProperty('initiativeId');
    expect(event).toHaveProperty('timestamp');
    expect(event.initiativeId).toBe(INITIATIVE_ID);
  });
});
