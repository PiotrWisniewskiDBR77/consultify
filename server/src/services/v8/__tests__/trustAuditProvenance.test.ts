import { describe, expect, it, vi, beforeEach } from 'vitest';

import type {
  EvidenceRef,
  CitationBinding,
  TrustSummary,
  RoutingExplanation,
  DegradedCondition,
  ProvenanceLedgerEntry,
  HealthSignal,
} from '../../../types/trustAudit.js';

// ==========================================
// MOCK DB LAYER
// ==========================================

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
  buildProvenanceLedger,
  assessTrustClass,
  getProvenanceByOrg,
  buildUserExplanation,
  buildOperatorExplanation,
  getActiveDegradedConditions,
  resolveDegradedCondition,
  getHealthDashboard,
} from '../trustAuditService.js';

// ==========================================
// FIXTURES
// ==========================================

const ORG_ID = '00000000-0000-4000-8000-000000000001';
const SNAPSHOT_ID = '00000000-0000-4000-8000-000000000010';
const RUN_ID = '00000000-0000-4000-8000-000000000020';
const OUTPUT_ID = 'output-abc-123';
const USER_ID = '00000000-0000-4000-8000-000000000003';
const TRACE_ID = '00000000-0000-4000-8000-000000000050';
const CONDITION_ID = '00000000-0000-4000-8000-dddddddddd01';

function makeEvidenceRef(overrides?: Partial<EvidenceRef>): EvidenceRef {
  return {
    evidenceRefId: '00000000-0000-4000-8000-eeeeeeeeee01',
    sourceId: 'src-1',
    sourceType: 'document',
    confidence: 0.95,
    retrievalMethod: 'vector_search',
    bindingStrength: 'strong',
    verificationState: 'verified',
    ...overrides,
  };
}

function makeCitationBinding(overrides?: Partial<CitationBinding>): CitationBinding {
  return {
    citationBindingId: '00000000-0000-4000-8000-cccccccccc01',
    claimId: 'claim-1',
    evidenceRefs: [makeEvidenceRef()],
    bindingStrength: 'strong',
    trustClass: 'grounded_fact',
    claimSummary: 'Q3 revenue was €2.4M',
    ...overrides,
  };
}

function makeTrustSummary(overrides?: Partial<TrustSummary>): TrustSummary {
  return {
    groundedFactCount: 1,
    synthesisCount: 0,
    uncertainInferenceCount: 0,
    degradedCount: 0,
    lowestTrustClass: 'grounded_fact',
    degradedFlag: false,
    ...overrides,
  };
}

function makeRoutingExplanation(overrides?: Partial<RoutingExplanation>): RoutingExplanation {
  return {
    routingExplanationId: '00000000-0000-4000-8000-a00000000001',
    executionRunId: RUN_ID,
    conversationId: null,
    modelSelected: 'gpt-4o',
    modelSelectionReason: 'Best match for analysis workload',
    fallbackOccurred: false,
    fallbackReason: null,
    fallbackFrom: null,
    workloadClass: 'analysis',
    purpose: 'Financial KPI analysis',
    costTier: 'standard',
    latencyObservedMs: 1200,
    createdAt: '2026-03-23T10:00:00.000Z',
    ...overrides,
  };
}

function makeFakeProvenanceRow(overrides?: Partial<Record<string, unknown>>) {
  return {
    entry_id: '00000000-0000-4000-8000-aaaaaaaaaaaa',
    organization_id: ORG_ID,
    output_id: OUTPUT_ID,
    output_type: 'chat_response',
    trust_class: 'grounded_fact',
    citation_bindings: JSON.stringify([makeCitationBinding()]),
    context_snapshot_id: SNAPSHOT_ID,
    retrieval_trace_id: null,
    execution_run_id: RUN_ID,
    routing_explanation_id: '00000000-0000-4000-8000-a00000000001',
    trust_summary: JSON.stringify(makeTrustSummary()),
    created_at: '2026-03-23T10:00:00.000Z',
    created_by: USER_ID,
    ...overrides,
  };
}

function makeFakeSupportTraceRow(overrides?: Partial<Record<string, unknown>>) {
  return {
    trace_id: TRACE_ID,
    organization_id: ORG_ID,
    context_snapshot_id: SNAPSHOT_ID,
    execution_run_id: RUN_ID,
    retrieval_request_id: null,
    routing_explanation_id: null,
    trust_class: 'grounded_fact',
    routing_explanation: JSON.stringify(makeRoutingExplanation()),
    degraded_conditions: '[]',
    created_at: '2026-03-23T10:00:00.000Z',
    ...overrides,
  };
}

function makeFakeDegradedConditionRowExtended(overrides?: Partial<Record<string, unknown>>) {
  return {
    condition_id: CONDITION_ID,
    organization_id: ORG_ID,
    condition_type: 'provider_fallback',
    severity: 'medium',
    user_message: 'An alternative model was used.',
    operator_detail: 'Primary gpt-4o unavailable, fell back to gpt-4o-mini.',
    support_trace_id: TRACE_ID,
    created_at: '2026-03-23T10:00:00.000Z',
    resolved_at: null,
    resolved_by: null,
    resolution_note: null,
    ...overrides,
  };
}

function makeFakeHealthSignalRow(overrides?: Partial<Record<string, unknown>>) {
  return {
    signal_id: '00000000-0000-4000-8000-b00000000001',
    organization_id: ORG_ID,
    signal_type: 'model_availability',
    component_id: 'gpt-4o',
    status: 'healthy',
    value: 99.5,
    threshold: 99.0,
    metadata: '{}',
    timestamp: '2026-03-23T10:00:00.000Z',
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
// buildProvenanceLedger (D24)
// ------------------------------------------

describe('buildProvenanceLedger', () => {
  it('assembles full provenance chain with entries and routing explanation', async () => {
    // First call: getProvenanceByOutput
    mockDbAll.mockResolvedValueOnce([
      makeFakeProvenanceRow(),
      makeFakeProvenanceRow({
        entry_id: '00000000-0000-4000-8000-aaaaaaaaaaab',
        created_at: '2026-03-23T10:01:00.000Z',
      }),
    ]);
    // Second call: getSupportTracesByRun
    mockDbAll.mockResolvedValueOnce([makeFakeSupportTraceRow()]);

    const result = await buildProvenanceLedger(OUTPUT_ID, ORG_ID);

    expect(result.entries).toHaveLength(2);
    expect(result.entries[0].entryId).toBe('00000000-0000-4000-8000-aaaaaaaaaaaa');
    expect(result.explanation).not.toBeNull();
    expect(result.explanation!.modelSelected).toBe('gpt-4o');
    expect(result.supportTrace).not.toBeNull();
  });

  it('returns empty entries and null explanation when no provenance exists', async () => {
    mockDbAll.mockResolvedValueOnce([]);

    const result = await buildProvenanceLedger(OUTPUT_ID, ORG_ID);

    expect(result.entries).toHaveLength(0);
    expect(result.explanation).toBeNull();
    expect(result.supportTrace).toBeNull();
  });

  it('returns entries without explanation when no execution run is linked', async () => {
    mockDbAll.mockResolvedValueOnce([
      makeFakeProvenanceRow({ execution_run_id: null }),
    ]);

    const result = await buildProvenanceLedger(OUTPUT_ID, ORG_ID);

    expect(result.entries).toHaveLength(1);
    expect(result.explanation).toBeNull();
    expect(result.supportTrace).toBeNull();
  });
});

// ------------------------------------------
// assessTrustClass (D24)
// ------------------------------------------

describe('assessTrustClass', () => {
  it('returns grounded_fact for all verified/strong entries', async () => {
    mockDbAll.mockResolvedValueOnce([
      makeFakeProvenanceRow({
        citation_bindings: JSON.stringify([
          makeCitationBinding({
            evidenceRefs: [
              makeEvidenceRef({ bindingStrength: 'strong', verificationState: 'verified' }),
            ],
          }),
        ]),
      }),
    ]);

    const result = await assessTrustClass(OUTPUT_ID, ORG_ID);
    expect(result).toBe('grounded_fact');
  });

  it('returns degraded when any binding has strength none', async () => {
    mockDbAll.mockResolvedValueOnce([
      makeFakeProvenanceRow({
        citation_bindings: JSON.stringify([
          makeCitationBinding({
            evidenceRefs: [
              makeEvidenceRef({ bindingStrength: 'none', verificationState: 'verified' }),
            ],
          }),
        ]),
      }),
    ]);

    const result = await assessTrustClass(OUTPUT_ID, ORG_ID);
    expect(result).toBe('degraded');
  });

  it('returns uncertain_inference for unverified entries', async () => {
    mockDbAll.mockResolvedValueOnce([
      makeFakeProvenanceRow({
        citation_bindings: JSON.stringify([
          makeCitationBinding({
            evidenceRefs: [
              makeEvidenceRef({ bindingStrength: 'strong', verificationState: 'unverified' }),
            ],
          }),
        ]),
      }),
    ]);

    const result = await assessTrustClass(OUTPUT_ID, ORG_ID);
    expect(result).toBe('uncertain_inference');
  });

  it('returns synthesis for mixed moderate/partially_verified entries', async () => {
    mockDbAll.mockResolvedValueOnce([
      makeFakeProvenanceRow({
        citation_bindings: JSON.stringify([
          makeCitationBinding({
            evidenceRefs: [
              makeEvidenceRef({ bindingStrength: 'moderate', verificationState: 'partially_verified' }),
            ],
          }),
        ]),
      }),
    ]);

    const result = await assessTrustClass(OUTPUT_ID, ORG_ID);
    expect(result).toBe('synthesis');
  });

  it('returns uncertain_inference when no entries exist', async () => {
    mockDbAll.mockResolvedValueOnce([]);

    const result = await assessTrustClass(OUTPUT_ID, ORG_ID);
    expect(result).toBe('uncertain_inference');
  });

  it('returns uncertain_inference when entries have no citation bindings', async () => {
    mockDbAll.mockResolvedValueOnce([
      makeFakeProvenanceRow({ citation_bindings: '[]' }),
    ]);

    const result = await assessTrustClass(OUTPUT_ID, ORG_ID);
    expect(result).toBe('uncertain_inference');
  });

  it('returns degraded when at least one ref across multiple entries has none binding', async () => {
    mockDbAll.mockResolvedValueOnce([
      makeFakeProvenanceRow({
        entry_id: '00000000-0000-4000-8000-aaaaaaaaaaaa',
        citation_bindings: JSON.stringify([
          makeCitationBinding({
            evidenceRefs: [makeEvidenceRef({ bindingStrength: 'strong', verificationState: 'verified' })],
          }),
        ]),
      }),
      makeFakeProvenanceRow({
        entry_id: '00000000-0000-4000-8000-aaaaaaaaaaab',
        citation_bindings: JSON.stringify([
          makeCitationBinding({
            citationBindingId: '00000000-0000-4000-8000-cccccccccc02',
            evidenceRefs: [makeEvidenceRef({
              evidenceRefId: '00000000-0000-4000-8000-eeeeeeeeee02',
              bindingStrength: 'none',
              verificationState: 'verified',
            })],
          }),
        ]),
      }),
    ]);

    const result = await assessTrustClass(OUTPUT_ID, ORG_ID);
    expect(result).toBe('degraded');
  });
});

// ------------------------------------------
// getProvenanceByOrg (D24)
// ------------------------------------------

describe('getProvenanceByOrg', () => {
  it('queries provenance entries within date range', async () => {
    mockDbAll.mockResolvedValueOnce([makeFakeProvenanceRow()]);

    const results = await getProvenanceByOrg(
      ORG_ID,
      '2026-03-01T00:00:00.000Z',
      '2026-03-31T23:59:59.000Z',
    );

    expect(results).toHaveLength(1);
    expect(results[0].organizationId).toBe(ORG_ID);

    const sql = mockDbAll.mock.calls[0][0] as string;
    expect(sql).toContain('organization_id');
    expect(sql).toContain('created_at >=');
    expect(sql).toContain('created_at <=');
  });

  it('applies limit when provided', async () => {
    mockDbAll.mockResolvedValueOnce([makeFakeProvenanceRow()]);

    await getProvenanceByOrg(
      ORG_ID,
      '2026-03-01T00:00:00.000Z',
      '2026-03-31T23:59:59.000Z',
      10,
    );

    const sql = mockDbAll.mock.calls[0][0] as string;
    expect(sql).toContain('LIMIT');
    const params = mockDbAll.mock.calls[0][1] as unknown[];
    expect(params).toContain(10);
  });

  it('returns empty array when no entries in range', async () => {
    mockDbAll.mockResolvedValueOnce([]);

    const results = await getProvenanceByOrg(
      ORG_ID,
      '2026-01-01T00:00:00.000Z',
      '2026-01-31T23:59:59.000Z',
    );

    expect(results).toEqual([]);
  });
});

// ------------------------------------------
// buildUserExplanation (D25)
// ------------------------------------------

describe('buildUserExplanation', () => {
  it('returns concise summary for grounded_fact output', async () => {
    // assessTrustClass + buildProvenanceLedger both call getProvenanceByOutput
    // buildProvenanceLedger: getProvenanceByOutput
    mockDbAll.mockResolvedValueOnce([makeFakeProvenanceRow()]);
    // buildProvenanceLedger: getSupportTracesByRun
    mockDbAll.mockResolvedValueOnce([makeFakeSupportTraceRow()]);
    // assessTrustClass: getProvenanceByOutput
    mockDbAll.mockResolvedValueOnce([makeFakeProvenanceRow()]);

    const result = await buildUserExplanation(OUTPUT_ID, ORG_ID);

    expect(result.summary).toContain('verified');
    expect(result.trustClass).toBe('grounded_fact');
    expect(result.hasDegradedConditions).toBe(false);
    expect(result.summary).not.toContain('gpt-4o');
  });

  it('includes degraded condition user messages', async () => {
    const degradedCondition: DegradedCondition = {
      conditionId: CONDITION_ID,
      organizationId: ORG_ID,
      conditionType: 'provider_fallback',
      severity: 'medium',
      userMessage: 'An alternative model was used.',
      operatorDetail: 'Primary gpt-4o unavailable.',
      supportTraceId: TRACE_ID,
      createdAt: '2026-03-23T10:00:00.000Z',
    };

    mockDbAll.mockResolvedValueOnce([makeFakeProvenanceRow()]);
    mockDbAll.mockResolvedValueOnce([
      makeFakeSupportTraceRow({
        degraded_conditions: JSON.stringify([degradedCondition]),
        trust_class: 'degraded',
      }),
    ]);
    mockDbAll.mockResolvedValueOnce([
      makeFakeProvenanceRow({
        citation_bindings: JSON.stringify([
          makeCitationBinding({
            evidenceRefs: [makeEvidenceRef({ bindingStrength: 'none' })],
          }),
        ]),
      }),
    ]);

    const result = await buildUserExplanation(OUTPUT_ID, ORG_ID);

    expect(result.hasDegradedConditions).toBe(true);
    expect(result.summary).toContain('An alternative model was used.');
  });

  it('includes fallback note when routing had fallback', async () => {
    mockDbAll.mockResolvedValueOnce([makeFakeProvenanceRow()]);
    mockDbAll.mockResolvedValueOnce([
      makeFakeSupportTraceRow({
        routing_explanation: JSON.stringify(
          makeRoutingExplanation({ fallbackOccurred: true }),
        ),
      }),
    ]);
    mockDbAll.mockResolvedValueOnce([makeFakeProvenanceRow()]);

    const result = await buildUserExplanation(OUTPUT_ID, ORG_ID);

    expect(result.summary).toContain('alternative model');
    expect(result.summary).not.toContain('gpt-4o');
  });

  it('returns uncertain_inference summary when no entries', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    mockDbAll.mockResolvedValueOnce([]);

    const result = await buildUserExplanation(OUTPUT_ID, ORG_ID);

    expect(result.trustClass).toBe('uncertain_inference');
    expect(result.summary).toContain('could not be fully verified');
  });
});

// ------------------------------------------
// buildOperatorExplanation (D25)
// ------------------------------------------

describe('buildOperatorExplanation', () => {
  it('includes full provenance, conditions, and health signals', async () => {
    const degradedCondition: DegradedCondition = {
      conditionId: CONDITION_ID,
      organizationId: ORG_ID,
      conditionType: 'retrieval_failure',
      severity: 'high',
      userMessage: 'Sources unavailable.',
      operatorDetail: 'Connector timeout after 5s.',
      supportTraceId: TRACE_ID,
      createdAt: '2026-03-23T10:00:00.000Z',
    };

    // buildProvenanceLedger: getProvenanceByOutput
    mockDbAll.mockResolvedValueOnce([makeFakeProvenanceRow()]);
    // buildProvenanceLedger: getSupportTracesByRun
    mockDbAll.mockResolvedValueOnce([
      makeFakeSupportTraceRow({
        degraded_conditions: JSON.stringify([degradedCondition]),
      }),
    ]);
    // assessTrustClass: getProvenanceByOutput
    mockDbAll.mockResolvedValueOnce([makeFakeProvenanceRow()]);
    // getHealthSignals
    mockDbAll.mockResolvedValueOnce([makeFakeHealthSignalRow()]);

    const result = await buildOperatorExplanation(OUTPUT_ID, ORG_ID);

    expect(result.trustClass).toBe('grounded_fact');
    expect(result.provenanceEntries).toHaveLength(1);
    expect(result.degradedConditions).toHaveLength(1);
    expect(result.degradedConditions[0].conditionType).toBe('retrieval_failure');
    expect(result.healthSignals).toHaveLength(1);
    expect(result.summary).toContain('gpt-4o');
    expect(result.summary).toContain('Model:');
    expect(result.summary).toContain('Latency: 1200ms');
    expect(result.summary).toContain('retrieval_failure');
    expect(result.summary).toContain('Connector timeout after 5s.');
  });

  it('includes fallback details in summary', async () => {
    mockDbAll.mockResolvedValueOnce([makeFakeProvenanceRow()]);
    mockDbAll.mockResolvedValueOnce([
      makeFakeSupportTraceRow({
        routing_explanation: JSON.stringify(
          makeRoutingExplanation({
            fallbackOccurred: true,
            fallbackReason: 'Provider timeout',
            fallbackFrom: 'gpt-4o',
            modelSelected: 'gpt-4o-mini',
          }),
        ),
      }),
    ]);
    mockDbAll.mockResolvedValueOnce([makeFakeProvenanceRow()]);
    mockDbAll.mockResolvedValueOnce([]);

    const result = await buildOperatorExplanation(OUTPUT_ID, ORG_ID);

    expect(result.summary).toContain('Fallback from gpt-4o');
    expect(result.summary).toContain('Provider timeout');
  });

  it('works with no support trace or health signals', async () => {
    mockDbAll.mockResolvedValueOnce([
      makeFakeProvenanceRow({ execution_run_id: null }),
    ]);
    mockDbAll.mockResolvedValueOnce([
      makeFakeProvenanceRow({ execution_run_id: null }),
    ]);
    mockDbAll.mockResolvedValueOnce([]);

    const result = await buildOperatorExplanation(OUTPUT_ID, ORG_ID);

    expect(result.provenanceEntries).toHaveLength(1);
    expect(result.degradedConditions).toEqual([]);
    expect(result.healthSignals).toEqual([]);
  });
});

// ------------------------------------------
// getActiveDegradedConditions (D26)
// ------------------------------------------

describe('getActiveDegradedConditions', () => {
  it('returns only unresolved conditions', async () => {
    mockDbAll.mockResolvedValueOnce([
      makeFakeDegradedConditionRowExtended(),
      makeFakeDegradedConditionRowExtended({
        condition_id: '00000000-0000-4000-8000-dddddddddd02',
        condition_type: 'retrieval_failure',
      }),
    ]);

    const results = await getActiveDegradedConditions(ORG_ID);

    expect(results).toHaveLength(2);
    expect(results[0].resolvedAt).toBeNull();
    expect(results[1].resolvedAt).toBeNull();

    const sql = mockDbAll.mock.calls[0][0] as string;
    expect(sql).toContain('resolved_at IS NULL');
    expect(sql).toContain('organization_id');
  });

  it('returns empty array when all conditions are resolved', async () => {
    mockDbAll.mockResolvedValueOnce([]);

    const results = await getActiveDegradedConditions(ORG_ID);
    expect(results).toEqual([]);
  });

  it('maps resolved fields correctly for unresolved conditions', async () => {
    mockDbAll.mockResolvedValueOnce([makeFakeDegradedConditionRowExtended()]);

    const results = await getActiveDegradedConditions(ORG_ID);

    expect(results[0].conditionId).toBe(CONDITION_ID);
    expect(results[0].conditionType).toBe('provider_fallback');
    expect(results[0].resolvedAt).toBeNull();
    expect(results[0].resolvedBy).toBeNull();
    expect(results[0].resolutionNote).toBeNull();
  });
});

// ------------------------------------------
// resolveDegradedCondition (D26)
// ------------------------------------------

describe('resolveDegradedCondition', () => {
  it('marks a condition as resolved', async () => {
    mockDbGet.mockResolvedValueOnce(
      makeFakeDegradedConditionRowExtended({
        resolved_at: '2026-03-23T12:00:00.000Z',
        resolved_by: USER_ID,
        resolution_note: 'Provider restored, fallback no longer needed.',
      }),
    );

    const result = await resolveDegradedCondition(
      CONDITION_ID,
      USER_ID,
      'Provider restored, fallback no longer needed.',
    );

    expect(result).not.toBeNull();
    expect(result!.conditionId).toBe(CONDITION_ID);
    expect(result!.resolvedAt).toBe('2026-03-23T12:00:00.000Z');
    expect(result!.resolvedBy).toBe(USER_ID);
    expect(result!.resolutionNote).toBe('Provider restored, fallback no longer needed.');

    expect(mockDbRun).toHaveBeenCalledOnce();
    const sql = mockDbRun.mock.calls[0][0] as string;
    expect(sql).toContain('UPDATE v8_degraded_conditions');
    expect(sql).toContain('resolved_at');
    expect(sql).toContain('resolved_by');
    expect(sql).toContain('resolution_note');
  });

  it('returns null when condition not found after update', async () => {
    mockDbGet.mockResolvedValueOnce(null);

    const result = await resolveDegradedCondition(
      '00000000-0000-4000-8000-000000000099',
      USER_ID,
      'Resolved.',
    );

    expect(result).toBeNull();
  });

  it('preserves original condition fields after resolution', async () => {
    mockDbGet.mockResolvedValueOnce(
      makeFakeDegradedConditionRowExtended({
        resolved_at: '2026-03-23T12:00:00.000Z',
        resolved_by: USER_ID,
        resolution_note: 'Fixed.',
      }),
    );

    const result = await resolveDegradedCondition(CONDITION_ID, USER_ID, 'Fixed.');

    expect(result!.conditionType).toBe('provider_fallback');
    expect(result!.severity).toBe('medium');
    expect(result!.userMessage).toBe('An alternative model was used.');
    expect(result!.operatorDetail).toBe('Primary gpt-4o unavailable, fell back to gpt-4o-mini.');
  });
});

// ------------------------------------------
// getHealthDashboard (D26)
// ------------------------------------------

describe('getHealthDashboard', () => {
  it('returns latest signal per type', async () => {
    mockDbAll.mockResolvedValueOnce([
      makeFakeHealthSignalRow({
        signal_id: '00000000-0000-4000-8000-b00000000001',
        signal_type: 'model_availability',
        status: 'healthy',
        timestamp: '2026-03-23T12:00:00.000Z',
      }),
      makeFakeHealthSignalRow({
        signal_id: '00000000-0000-4000-8000-b00000000002',
        signal_type: 'retrieval_success_rate',
        component_id: 'retrieval-service',
        status: 'warning',
        value: 85.0,
        threshold: 90.0,
        timestamp: '2026-03-23T12:00:00.000Z',
      }),
      makeFakeHealthSignalRow({
        signal_id: '00000000-0000-4000-8000-b00000000003',
        signal_type: 'fallback_rate',
        component_id: 'routing-service',
        status: 'critical',
        value: 15.0,
        threshold: 5.0,
        timestamp: '2026-03-23T12:00:00.000Z',
      }),
    ]);

    const dashboard = await getHealthDashboard(ORG_ID);

    expect(dashboard.size).toBe(3);
    expect(dashboard.get('model_availability')!.status).toBe('healthy');
    expect(dashboard.get('retrieval_success_rate')!.status).toBe('warning');
    expect(dashboard.get('fallback_rate')!.status).toBe('critical');
  });

  it('returns empty map when no signals exist', async () => {
    mockDbAll.mockResolvedValueOnce([]);

    const dashboard = await getHealthDashboard(ORG_ID);

    expect(dashboard.size).toBe(0);
  });

  it('uses correct SQL with subquery for latest per type', async () => {
    mockDbAll.mockResolvedValueOnce([]);

    await getHealthDashboard(ORG_ID);

    const sql = mockDbAll.mock.calls[0][0] as string;
    expect(sql).toContain('MAX(timestamp)');
    expect(sql).toContain('GROUP BY signal_type');
    expect(sql).toContain('organization_id');
  });

  it('maps signal fields correctly', async () => {
    mockDbAll.mockResolvedValueOnce([
      makeFakeHealthSignalRow({
        value: 99.5,
        threshold: 99.0,
        metadata: JSON.stringify({ region: 'eu-west-1' }),
      }),
    ]);

    const dashboard = await getHealthDashboard(ORG_ID);
    const signal = dashboard.get('model_availability')!;

    expect(signal.signalId).toBe('00000000-0000-4000-8000-b00000000001');
    expect(signal.componentId).toBe('gpt-4o');
    expect(signal.value).toBe(99.5);
    expect(signal.threshold).toBe(99.0);
    expect(signal.metadata).toEqual({ region: 'eu-west-1' });
  });
});
