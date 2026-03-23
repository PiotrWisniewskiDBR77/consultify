import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ZodError } from 'zod';

import type {
  AssignTrustClassParams,
  CreateProvenanceLedgerEntryParams,
  CreateSupportTraceParams,
  RecordDegradedConditionParams,
  RecordHealthSignalParams,
  EvidenceRef,
  CitationBinding,
  TrustSummary,
  RoutingExplanation,
  DegradedCondition,
  TrustClass,
} from '../../../types/trustAudit.js';
import {
  TrustClassValues,
  BindingStrengthValues,
  VerificationStateValues,
  DegradedConditionTypeValues,
  HealthSignalTypeValues,
  HealthStatusValues,
  EvidenceRefSchema,
  CitationBindingSchema,
  TrustSummarySchema,
  ProvenanceLedgerEntrySchema,
  DegradedConditionSchema,
  RoutingExplanationSchema,
  SupportTraceSchema,
  HealthSignalSchema,
  AssignTrustClassParamsSchema,
  CreateProvenanceLedgerEntryParamsSchema,
  CreateSupportTraceParamsSchema,
  RecordDegradedConditionParamsSchema,
  RecordHealthSignalParamsSchema,
  TRUST_CLASS_RANK,
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
  assignTrustClass,
  createProvenanceLedgerEntry,
  getProvenanceByOutput,
  createSupportTrace,
  getSupportTrace,
  getSupportTracesByRun,
  getRoutingExplanation,
  recordDegradedCondition,
  recordHealthSignal,
} from '../trustAuditService.js';

// ==========================================
// FIXTURES
// ==========================================

const ORG_ID = '00000000-0000-4000-8000-000000000001';
const OTHER_ORG_ID = '00000000-0000-4000-8000-000000000099';
const SNAPSHOT_ID = '00000000-0000-4000-8000-000000000010';
const RUN_ID = '00000000-0000-4000-8000-000000000020';
const OUTPUT_ID = 'output-abc-123';
const USER_ID = '00000000-0000-4000-8000-000000000003';
const TRACE_ID = '00000000-0000-4000-8000-000000000050';

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

function makeProvenanceParams(
  overrides?: Partial<CreateProvenanceLedgerEntryParams>,
): CreateProvenanceLedgerEntryParams {
  return {
    organizationId: ORG_ID,
    outputId: OUTPUT_ID,
    outputType: 'chat_response',
    trustClass: 'grounded_fact',
    citationBindings: [makeCitationBinding()],
    contextSnapshotId: SNAPSHOT_ID,
    retrievalTraceId: null,
    executionRunId: null,
    routingExplanationId: null,
    trustSummary: makeTrustSummary(),
    createdBy: USER_ID,
    ...overrides,
  };
}

function makeSupportTraceParams(
  overrides?: Partial<CreateSupportTraceParams>,
): CreateSupportTraceParams {
  return {
    organizationId: ORG_ID,
    contextSnapshotId: SNAPSHOT_ID,
    executionRunId: RUN_ID,
    retrievalRequestId: null,
    routingExplanationId: null,
    trustClass: 'grounded_fact',
    routingExplanation: makeRoutingExplanation(),
    degradedConditions: [],
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
    execution_run_id: null,
    routing_explanation_id: null,
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

function makeFakeDegradedConditionRow(overrides?: Partial<Record<string, unknown>>) {
  return {
    condition_id: '00000000-0000-4000-8000-dddddddddd01',
    organization_id: ORG_ID,
    condition_type: 'provider_fallback',
    severity: 'medium',
    user_message: 'An alternative model was used.',
    operator_detail: 'Primary gpt-4o unavailable, fell back to gpt-4o-mini.',
    support_trace_id: TRACE_ID,
    created_at: '2026-03-23T10:00:00.000Z',
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
// Trust class assignment (Decision 23: hybrid)
// ------------------------------------------

describe('assignTrustClass', () => {
  it('returns degraded when degradedModeFlag is true', async () => {
    const result = await assignTrustClass({
      evidenceRefs: [makeEvidenceRef()],
      modelDeclaredClass: 'grounded_fact',
      degradedModeFlag: true,
      uncertaintyClass: null,
    });
    expect(result).toBe('degraded');
  });

  it('returns uncertain_inference when no evidence refs', async () => {
    const result = await assignTrustClass({
      evidenceRefs: [],
      modelDeclaredClass: 'synthesis',
      degradedModeFlag: false,
      uncertaintyClass: null,
    });
    expect(result).toBe('uncertain_inference');
  });

  it('returns grounded_fact with single strong+verified evidence', async () => {
    const result = await assignTrustClass({
      evidenceRefs: [makeEvidenceRef({ bindingStrength: 'strong', verificationState: 'verified' })],
      modelDeclaredClass: null,
      degradedModeFlag: false,
      uncertaintyClass: null,
    });
    expect(result).toBe('grounded_fact');
  });

  it('returns synthesis with multiple moderate evidence refs', async () => {
    const result = await assignTrustClass({
      evidenceRefs: [
        makeEvidenceRef({ evidenceRefId: '00000000-0000-4000-8000-eeeeeeeeee01', bindingStrength: 'moderate', verificationState: 'partially_verified' }),
        makeEvidenceRef({ evidenceRefId: '00000000-0000-4000-8000-eeeeeeeeee02', bindingStrength: 'moderate', verificationState: 'partially_verified' }),
      ],
      modelDeclaredClass: null,
      degradedModeFlag: false,
      uncertaintyClass: null,
    });
    expect(result).toBe('synthesis');
  });

  it('downgrades model-declared grounded_fact when evidence is insufficient (Decision 23)', async () => {
    const result = await assignTrustClass({
      evidenceRefs: [makeEvidenceRef({ bindingStrength: 'weak', verificationState: 'unverified' })],
      modelDeclaredClass: 'grounded_fact',
      degradedModeFlag: false,
      uncertaintyClass: null,
    });
    expect(result).toBe('uncertain_inference');
  });

  it('downgrades model-declared grounded_fact to synthesis with 2+ weak refs', async () => {
    const result = await assignTrustClass({
      evidenceRefs: [
        makeEvidenceRef({ evidenceRefId: '00000000-0000-4000-8000-eeeeeeeeee01', bindingStrength: 'weak', verificationState: 'unverified' }),
        makeEvidenceRef({ evidenceRefId: '00000000-0000-4000-8000-eeeeeeeeee02', bindingStrength: 'weak', verificationState: 'unverified' }),
      ],
      modelDeclaredClass: 'grounded_fact',
      degradedModeFlag: false,
      uncertaintyClass: null,
    });
    expect(result).toBe('synthesis');
  });

  it('returns grounded_fact with multiple refs including strong+verified', async () => {
    const result = await assignTrustClass({
      evidenceRefs: [
        makeEvidenceRef({ evidenceRefId: '00000000-0000-4000-8000-eeeeeeeeee01', bindingStrength: 'strong', verificationState: 'verified' }),
        makeEvidenceRef({ evidenceRefId: '00000000-0000-4000-8000-eeeeeeeeee02', bindingStrength: 'moderate', verificationState: 'partially_verified' }),
      ],
      modelDeclaredClass: null,
      degradedModeFlag: false,
      uncertaintyClass: null,
    });
    expect(result).toBe('grounded_fact');
  });

  it('rejects invalid params via Zod', async () => {
    await expect(
      assignTrustClass({ evidenceRefs: 'bad' } as any),
    ).rejects.toThrow(ZodError);
  });
});

// ------------------------------------------
// Provenance ledger
// ------------------------------------------

describe('createProvenanceLedgerEntry', () => {
  it('creates a provenance entry with all required fields', async () => {
    const result = await createProvenanceLedgerEntry(makeProvenanceParams());

    expect(result.entryId).toBeDefined();
    expect(result.organizationId).toBe(ORG_ID);
    expect(result.outputId).toBe(OUTPUT_ID);
    expect(result.outputType).toBe('chat_response');
    expect(result.trustClass).toBe('grounded_fact');
    expect(result.citationBindings).toHaveLength(1);
    expect(result.contextSnapshotId).toBe(SNAPSHOT_ID);
    expect(result.createdBy).toBe(USER_ID);

    expect(mockDbRun).toHaveBeenCalledOnce();
    const sql = mockDbRun.mock.calls[0][0] as string;
    expect(sql).toContain('INSERT INTO v8_provenance_ledger');
  });

  it('stores trust summary correctly', async () => {
    const result = await createProvenanceLedgerEntry(makeProvenanceParams());

    expect(result.trustSummary.groundedFactCount).toBe(1);
    expect(result.trustSummary.lowestTrustClass).toBe('grounded_fact');
    expect(result.trustSummary.degradedFlag).toBe(false);
  });

  it('supports all output types', async () => {
    const types = [
      'chat_response', 'execution_output', 'report_section',
      'presentation_slide', 'background_job_result',
    ] as const;

    for (const outputType of types) {
      vi.clearAllMocks();
      const result = await createProvenanceLedgerEntry(
        makeProvenanceParams({ outputType }),
      );
      expect(result.outputType).toBe(outputType);
    }
  });

  it('rejects invalid organizationId via Zod', async () => {
    await expect(
      createProvenanceLedgerEntry(makeProvenanceParams({ organizationId: 'not-uuid' })),
    ).rejects.toThrow(ZodError);
  });

  it('rejects invalid trust class via Zod', async () => {
    await expect(
      createProvenanceLedgerEntry(makeProvenanceParams({ trustClass: 'invalid' as any })),
    ).rejects.toThrow(ZodError);
  });
});

describe('getProvenanceByOutput', () => {
  it('returns provenance entries scoped to organization', async () => {
    mockDbAll.mockResolvedValueOnce([makeFakeProvenanceRow()]);

    const results = await getProvenanceByOutput(OUTPUT_ID, ORG_ID);

    expect(results).toHaveLength(1);
    expect(results[0].entryId).toBe('00000000-0000-4000-8000-aaaaaaaaaaaa');
    expect(results[0].organizationId).toBe(ORG_ID);
    expect(results[0].citationBindings).toHaveLength(1);

    const query = mockDbAll.mock.calls[0][0] as string;
    expect(query).toContain('organization_id');
  });

  it('returns empty array when no entries exist', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    const results = await getProvenanceByOutput(OUTPUT_ID, ORG_ID);
    expect(results).toEqual([]);
  });

  it('enforces org isolation — different org returns empty', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    const results = await getProvenanceByOutput(OUTPUT_ID, OTHER_ORG_ID);
    expect(results).toEqual([]);
  });
});

// ------------------------------------------
// Support traces
// ------------------------------------------

describe('createSupportTrace', () => {
  it('creates a support trace with context binding', async () => {
    const result = await createSupportTrace(makeSupportTraceParams());

    expect(result.traceId).toBeDefined();
    expect(result.organizationId).toBe(ORG_ID);
    expect(result.contextSnapshotId).toBe(SNAPSHOT_ID);
    expect(result.executionRunId).toBe(RUN_ID);
    expect(result.trustClass).toBe('grounded_fact');
    expect(result.routingExplanation).not.toBeNull();
    expect(result.routingExplanation!.modelSelected).toBe('gpt-4o');
    expect(result.degradedConditions).toEqual([]);

    expect(mockDbRun).toHaveBeenCalledOnce();
    const sql = mockDbRun.mock.calls[0][0] as string;
    expect(sql).toContain('INSERT INTO v8_support_traces');
  });

  it('creates a trace without routing explanation', async () => {
    const result = await createSupportTrace(
      makeSupportTraceParams({ routingExplanation: null }),
    );
    expect(result.routingExplanation).toBeNull();
  });

  it('creates a trace with degraded conditions', async () => {
    const degraded: DegradedCondition = {
      conditionId: '00000000-0000-4000-8000-dddddddddd01',
      organizationId: ORG_ID,
      conditionType: 'provider_fallback',
      severity: 'medium',
      userMessage: 'An alternative model was used.',
      operatorDetail: 'Primary unavailable.',
      supportTraceId: null,
      createdAt: '2026-03-23T10:00:00.000Z',
    };

    const result = await createSupportTrace(
      makeSupportTraceParams({ degradedConditions: [degraded], trustClass: 'degraded' }),
    );

    expect(result.degradedConditions).toHaveLength(1);
    expect(result.degradedConditions[0].conditionType).toBe('provider_fallback');
    expect(result.trustClass).toBe('degraded');
  });

  it('rejects invalid params via Zod', async () => {
    await expect(
      createSupportTrace({ organizationId: 'bad' } as any),
    ).rejects.toThrow(ZodError);
  });
});

describe('getSupportTrace', () => {
  it('returns a trace with org isolation', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeSupportTraceRow());

    const result = await getSupportTrace(TRACE_ID, ORG_ID);

    expect(result).not.toBeNull();
    expect(result!.traceId).toBe(TRACE_ID);
    expect(result!.organizationId).toBe(ORG_ID);
    expect(result!.routingExplanation).not.toBeNull();

    const query = mockDbGet.mock.calls[0][0] as string;
    expect(query).toContain('organization_id');
  });

  it('returns null when trace not found', async () => {
    mockDbGet.mockResolvedValueOnce(null);
    const result = await getSupportTrace('nonexistent', ORG_ID);
    expect(result).toBeNull();
  });

  it('enforces org isolation — different org returns null', async () => {
    mockDbGet.mockResolvedValueOnce(null);
    const result = await getSupportTrace(TRACE_ID, OTHER_ORG_ID);
    expect(result).toBeNull();
  });
});

describe('getSupportTracesByRun', () => {
  it('returns traces for a run scoped to org', async () => {
    mockDbAll.mockResolvedValueOnce([
      makeFakeSupportTraceRow(),
      makeFakeSupportTraceRow({ trace_id: '00000000-0000-4000-8000-000000000051' }),
    ]);

    const results = await getSupportTracesByRun(RUN_ID, ORG_ID);

    expect(results).toHaveLength(2);

    const query = mockDbAll.mock.calls[0][0] as string;
    expect(query).toContain('execution_run_id');
    expect(query).toContain('organization_id');
  });

  it('returns empty array when no traces exist', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    const results = await getSupportTracesByRun(RUN_ID, ORG_ID);
    expect(results).toEqual([]);
  });
});

// ------------------------------------------
// Routing explanation audience levels (Decision 25)
// ------------------------------------------

describe('getRoutingExplanation', () => {
  it('returns concise explanation for user audience', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeSupportTraceRow());

    const result = await getRoutingExplanation(TRACE_ID, ORG_ID, 'user');

    expect(result).not.toBeNull();
    expect(result).toContain('Purpose:');
    expect(result).not.toContain('gpt-4o');
    expect(result).not.toContain('Workload class');
    expect(result).not.toContain('Cost tier');
  });

  it('returns concise explanation with fallback note for user', async () => {
    mockDbGet.mockResolvedValueOnce(
      makeFakeSupportTraceRow({
        routing_explanation: JSON.stringify(
          makeRoutingExplanation({
            fallbackOccurred: true,
            fallbackReason: 'Provider timeout',
            fallbackFrom: 'gpt-4o',
          }),
        ),
      }),
    );

    const result = await getRoutingExplanation(TRACE_ID, ORG_ID, 'user');

    expect(result).toContain('alternative model');
    expect(result).not.toContain('gpt-4o');
    expect(result).not.toContain('Provider timeout');
  });

  it('returns full trace for operator audience', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeSupportTraceRow());

    const result = await getRoutingExplanation(TRACE_ID, ORG_ID, 'operator');

    expect(result).not.toBeNull();
    expect(result).toContain('gpt-4o');
    expect(result).toContain('Workload class: analysis');
    expect(result).toContain('Cost tier: standard');
    expect(result).toContain('Latency: 1200ms');
  });

  it('returns full trace for admin audience', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeSupportTraceRow());

    const result = await getRoutingExplanation(TRACE_ID, ORG_ID, 'admin');

    expect(result).not.toBeNull();
    expect(result).toContain('gpt-4o');
    expect(result).toContain('Reason:');
  });

  it('includes fallback details for operator audience', async () => {
    mockDbGet.mockResolvedValueOnce(
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
    );

    const result = await getRoutingExplanation(TRACE_ID, ORG_ID, 'operator');

    expect(result).toContain('Fallback from gpt-4o');
    expect(result).toContain('Provider timeout');
  });

  it('returns null when trace not found', async () => {
    mockDbGet.mockResolvedValueOnce(null);
    const result = await getRoutingExplanation('nonexistent', ORG_ID, 'operator');
    expect(result).toBeNull();
  });

  it('returns null when trace has no routing explanation', async () => {
    mockDbGet.mockResolvedValueOnce(
      makeFakeSupportTraceRow({ routing_explanation: null }),
    );
    const result = await getRoutingExplanation(TRACE_ID, ORG_ID, 'operator');
    expect(result).toBeNull();
  });
});

// ------------------------------------------
// Degraded conditions (Decision 26)
// ------------------------------------------

describe('recordDegradedCondition', () => {
  it('records a provider_fallback condition', async () => {
    const result = await recordDegradedCondition({
      organizationId: ORG_ID,
      conditionType: 'provider_fallback',
      severity: 'medium',
      userMessage: 'An alternative model was used.',
      operatorDetail: 'Primary gpt-4o unavailable, fell back to gpt-4o-mini.',
      supportTraceId: TRACE_ID,
    });

    expect(result.conditionId).toBeDefined();
    expect(result.conditionType).toBe('provider_fallback');
    expect(result.severity).toBe('medium');
    expect(result.supportTraceId).toBe(TRACE_ID);

    expect(mockDbRun).toHaveBeenCalledOnce();
    const sql = mockDbRun.mock.calls[0][0] as string;
    expect(sql).toContain('INSERT INTO v8_degraded_conditions');
  });

  it('records voice_transcript_partial condition (Decision 26)', async () => {
    const result = await recordDegradedCondition({
      organizationId: ORG_ID,
      conditionType: 'voice_transcript_partial',
      severity: 'high',
      userMessage: 'Your voice input may have been partially captured.',
      operatorDetail: 'Teresa voice transcript incomplete — 40% confidence on last segment.',
      supportTraceId: null,
    });

    expect(result.conditionType).toBe('voice_transcript_partial');
    expect(result.severity).toBe('high');
    expect(result.supportTraceId).toBeNull();
  });

  it('supports all degraded condition types', async () => {
    for (const conditionType of DegradedConditionTypeValues) {
      vi.clearAllMocks();
      const result = await recordDegradedCondition({
        organizationId: ORG_ID,
        conditionType,
        severity: 'low',
        userMessage: `User message for ${conditionType}`,
        operatorDetail: `Operator detail for ${conditionType}`,
      });
      expect(result.conditionType).toBe(conditionType);
    }
  });

  it('rejects invalid condition type via Zod', async () => {
    await expect(
      recordDegradedCondition({
        organizationId: ORG_ID,
        conditionType: 'invalid_type' as any,
        severity: 'low',
        userMessage: 'msg',
        operatorDetail: 'detail',
      }),
    ).rejects.toThrow(ZodError);
  });

  it('rejects empty userMessage via Zod', async () => {
    await expect(
      recordDegradedCondition({
        organizationId: ORG_ID,
        conditionType: 'provider_fallback',
        severity: 'low',
        userMessage: '',
        operatorDetail: 'detail',
      }),
    ).rejects.toThrow(ZodError);
  });
});

// ------------------------------------------
// Health signals
// ------------------------------------------

describe('recordHealthSignal', () => {
  it('records a health signal with all fields', async () => {
    const result = await recordHealthSignal({
      organizationId: ORG_ID,
      signalType: 'model_availability',
      componentId: 'gpt-4o',
      status: 'healthy',
      value: 99.5,
      threshold: 99.0,
      metadata: { region: 'eu-west-1' },
    });

    expect(result.signalId).toBeDefined();
    expect(result.signalType).toBe('model_availability');
    expect(result.componentId).toBe('gpt-4o');
    expect(result.status).toBe('healthy');
    expect(result.value).toBe(99.5);
    expect(result.threshold).toBe(99.0);
    expect(result.metadata).toEqual({ region: 'eu-west-1' });

    expect(mockDbRun).toHaveBeenCalledOnce();
    const sql = mockDbRun.mock.calls[0][0] as string;
    expect(sql).toContain('INSERT INTO v8_health_signals');
  });

  it('defaults metadata to empty object', async () => {
    const result = await recordHealthSignal({
      organizationId: ORG_ID,
      signalType: 'retrieval_success_rate',
      componentId: 'retrieval-service',
      status: 'warning',
      value: 85.0,
      threshold: 90.0,
    });

    expect(result.metadata).toEqual({});
  });

  it('supports all signal types', async () => {
    for (const signalType of HealthSignalTypeValues) {
      vi.clearAllMocks();
      const result = await recordHealthSignal({
        organizationId: ORG_ID,
        signalType,
        componentId: 'test-component',
        status: 'healthy',
      });
      expect(result.signalType).toBe(signalType);
    }
  });

  it('supports all health statuses', async () => {
    for (const status of HealthStatusValues) {
      vi.clearAllMocks();
      const result = await recordHealthSignal({
        organizationId: ORG_ID,
        signalType: 'model_availability',
        componentId: 'test',
        status,
      });
      expect(result.status).toBe(status);
    }
  });

  it('rejects invalid signal type via Zod', async () => {
    await expect(
      recordHealthSignal({
        organizationId: ORG_ID,
        signalType: 'invalid_signal' as any,
        componentId: 'test',
        status: 'healthy',
      }),
    ).rejects.toThrow(ZodError);
  });

  it('rejects invalid organizationId via Zod', async () => {
    await expect(
      recordHealthSignal({
        organizationId: 'not-uuid',
        signalType: 'model_availability',
        componentId: 'test',
        status: 'healthy',
      }),
    ).rejects.toThrow(ZodError);
  });
});

// ------------------------------------------
// Org isolation
// ------------------------------------------

describe('organization isolation', () => {
  it('getProvenanceByOutput includes org in query', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    await getProvenanceByOutput(OUTPUT_ID, ORG_ID);

    const query = mockDbAll.mock.calls[0][0] as string;
    const params = mockDbAll.mock.calls[0][1] as unknown[];
    expect(query).toContain('organization_id');
    expect(params).toContain(ORG_ID);
  });

  it('getSupportTrace includes org in query', async () => {
    mockDbGet.mockResolvedValueOnce(null);
    await getSupportTrace(TRACE_ID, ORG_ID);

    const query = mockDbGet.mock.calls[0][0] as string;
    const params = mockDbGet.mock.calls[0][1] as unknown[];
    expect(query).toContain('organization_id');
    expect(params).toContain(ORG_ID);
  });

  it('getSupportTracesByRun includes org in query', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    await getSupportTracesByRun(RUN_ID, ORG_ID);

    const query = mockDbAll.mock.calls[0][0] as string;
    const params = mockDbAll.mock.calls[0][1] as unknown[];
    expect(query).toContain('organization_id');
    expect(params).toContain(ORG_ID);
  });
});

// ------------------------------------------
// Zod schema validation
// ------------------------------------------

describe('Zod schema validation', () => {
  it('validates EvidenceRef', () => {
    expect(() => EvidenceRefSchema.parse(makeEvidenceRef())).not.toThrow();
  });

  it('rejects EvidenceRef with confidence > 1', () => {
    expect(() =>
      EvidenceRefSchema.parse(makeEvidenceRef({ confidence: 1.5 })),
    ).toThrow(ZodError);
  });

  it('rejects EvidenceRef with confidence < 0', () => {
    expect(() =>
      EvidenceRefSchema.parse(makeEvidenceRef({ confidence: -0.1 })),
    ).toThrow(ZodError);
  });

  it('validates CitationBinding', () => {
    expect(() => CitationBindingSchema.parse(makeCitationBinding())).not.toThrow();
  });

  it('validates TrustSummary', () => {
    expect(() => TrustSummarySchema.parse(makeTrustSummary())).not.toThrow();
  });

  it('validates ProvenanceLedgerEntry', () => {
    const entry = {
      entryId: '00000000-0000-4000-8000-aaaaaaaaaaaa',
      organizationId: ORG_ID,
      outputId: OUTPUT_ID,
      outputType: 'chat_response' as const,
      trustClass: 'grounded_fact' as const,
      citationBindings: [makeCitationBinding()],
      contextSnapshotId: SNAPSHOT_ID,
      retrievalTraceId: null,
      executionRunId: null,
      routingExplanationId: null,
      trustSummary: makeTrustSummary(),
      createdAt: '2026-03-23T10:00:00.000Z',
      createdBy: USER_ID,
    };
    expect(() => ProvenanceLedgerEntrySchema.parse(entry)).not.toThrow();
  });

  it('validates RoutingExplanation', () => {
    expect(() => RoutingExplanationSchema.parse(makeRoutingExplanation())).not.toThrow();
  });

  it('validates SupportTrace', () => {
    const trace = {
      traceId: TRACE_ID,
      organizationId: ORG_ID,
      contextSnapshotId: SNAPSHOT_ID,
      executionRunId: RUN_ID,
      retrievalRequestId: null,
      routingExplanationId: null,
      trustClass: 'grounded_fact' as const,
      routingExplanation: makeRoutingExplanation(),
      degradedConditions: [],
      createdAt: '2026-03-23T10:00:00.000Z',
    };
    expect(() => SupportTraceSchema.parse(trace)).not.toThrow();
  });

  it('validates DegradedCondition', () => {
    const condition = {
      conditionId: '00000000-0000-4000-8000-dddddddddd01',
      organizationId: ORG_ID,
      conditionType: 'voice_transcript_partial' as const,
      severity: 'high' as const,
      userMessage: 'Partial transcript.',
      operatorDetail: 'Confidence below threshold.',
      supportTraceId: null,
      createdAt: '2026-03-23T10:00:00.000Z',
    };
    expect(() => DegradedConditionSchema.parse(condition)).not.toThrow();
  });

  it('validates HealthSignal', () => {
    const signal = {
      signalId: '00000000-0000-4000-8000-b00000000001',
      organizationId: ORG_ID,
      signalType: 'model_availability' as const,
      componentId: 'gpt-4o',
      status: 'healthy' as const,
      value: 99.5,
      threshold: 99.0,
      metadata: {},
      timestamp: '2026-03-23T10:00:00.000Z',
    };
    expect(() => HealthSignalSchema.parse(signal)).not.toThrow();
  });

  it('rejects invalid trust class in schema', () => {
    expect(() =>
      ProvenanceLedgerEntrySchema.parse({
        entryId: '00000000-0000-4000-8000-aaaaaaaaaaaa',
        organizationId: ORG_ID,
        outputId: OUTPUT_ID,
        outputType: 'chat_response',
        trustClass: 'invalid_class',
        citationBindings: [],
        contextSnapshotId: SNAPSHOT_ID,
        retrievalTraceId: null,
        executionRunId: null,
        routingExplanationId: null,
        trustSummary: makeTrustSummary(),
        createdAt: '2026-03-23T10:00:00.000Z',
        createdBy: USER_ID,
      }),
    ).toThrow(ZodError);
  });

  it('validates AssignTrustClassParams', () => {
    expect(() =>
      AssignTrustClassParamsSchema.parse({
        evidenceRefs: [makeEvidenceRef()],
        modelDeclaredClass: 'synthesis',
        degradedModeFlag: false,
        uncertaintyClass: 'stale_source',
      }),
    ).not.toThrow();
  });

  it('validates CreateProvenanceLedgerEntryParams', () => {
    expect(() =>
      CreateProvenanceLedgerEntryParamsSchema.parse(makeProvenanceParams()),
    ).not.toThrow();
  });

  it('validates CreateSupportTraceParams', () => {
    expect(() =>
      CreateSupportTraceParamsSchema.parse(makeSupportTraceParams()),
    ).not.toThrow();
  });

  it('validates RecordDegradedConditionParams', () => {
    expect(() =>
      RecordDegradedConditionParamsSchema.parse({
        organizationId: ORG_ID,
        conditionType: 'retrieval_failure',
        severity: 'high',
        userMessage: 'Sources unavailable.',
        operatorDetail: 'Connector timeout after 5s.',
      }),
    ).not.toThrow();
  });

  it('validates RecordHealthSignalParams', () => {
    expect(() =>
      RecordHealthSignalParamsSchema.parse({
        organizationId: ORG_ID,
        signalType: 'fallback_rate',
        componentId: 'routing-service',
        status: 'warning',
        value: 6.5,
        threshold: 5.0,
      }),
    ).not.toThrow();
  });
});

// ------------------------------------------
// Trust class ranking
// ------------------------------------------

describe('TRUST_CLASS_RANK', () => {
  it('ranks grounded_fact highest', () => {
    expect(TRUST_CLASS_RANK.grounded_fact).toBeGreaterThan(TRUST_CLASS_RANK.synthesis);
    expect(TRUST_CLASS_RANK.grounded_fact).toBeGreaterThan(TRUST_CLASS_RANK.uncertain_inference);
    expect(TRUST_CLASS_RANK.grounded_fact).toBeGreaterThan(TRUST_CLASS_RANK.degraded);
  });

  it('ranks degraded lowest', () => {
    expect(TRUST_CLASS_RANK.degraded).toBeLessThan(TRUST_CLASS_RANK.uncertain_inference);
  });

  it('covers all trust classes', () => {
    for (const tc of TrustClassValues) {
      expect(TRUST_CLASS_RANK).toHaveProperty(tc);
    }
  });
});
