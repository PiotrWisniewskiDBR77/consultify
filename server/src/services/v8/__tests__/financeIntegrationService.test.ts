import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ZodError } from 'zod';

import type {
  CreateEconomicsLinkageParams,
  EvaluatePromotionGateParams,
  RecordDeltaEscalationParams,
  RecordIngestionParams,
  RecordSourceRefreshParams,
} from '../../../types/financeIntegrationPromotion.js';
import {
  CloudLinkedSourceRefreshSchema,
  computeOverallGateResult,
  CreateEconomicsLinkageParamsSchema,
  DEFAULT_ESCALATION_THRESHOLDS,
  evaluateEscalationThreshold,
  EvaluatePromotionGateParamsSchema,
  FinanceDocumentIngestionSchema,
  INGESTION_STATE_TRANSITIONS,
  IngestionReadinessStateValues,
  InitiativeEconomicsLinkageSchema,
  LinkageStatusValues,
  LinkageTypeValues,
  MaterialityLevelValues,
  PromotionGateResultValues,
  PromotionGateSchema,
  RecordDeltaEscalationParamsSchema,
  RecordIngestionParamsSchema,
  RecordSourceRefreshParamsSchema,
  UnreconciledDeltaEscalationSchema,
} from '../../../types/financeIntegrationPromotion.js';

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
  createEconomicsLinkage,
  evaluatePromotionGate,
  getEscalationsByInitiative,
  getIngestion,
  getLinkagesByInitiative,
  getSourceRefreshes,
  isValidIngestionTransition,
  recordDeltaEscalation,
  recordIngestion,
  recordSourceRefresh,
  transitionIngestionState,
} from '../financeIntegrationService.js';

// ==========================================
// FIXTURES
// ==========================================

const ORG_ID = '00000000-0000-4000-8000-000000000001';
const ORG_ID_2 = '00000000-0000-4000-8000-000000000099';
const INGESTION_ID = '00000000-0000-4000-8000-000000000010';
const INITIATIVE_ID = 'initiative-001';
const FINANCE_MODEL_REF = 'finance-model-001';
const DOCUMENT_REF = 'doc-upload-001.pdf';
const SOURCE_ARTIFACT_REF = 'artifact-finance-001';
const FINANCE_REF = 'finance-ref-001';
const PROMOTED_ARTIFACT_REF = 'promoted-report-001';
const SOURCE_MODEL_REF = 'source-model-001';

function makeIngestionParams(overrides?: Partial<RecordIngestionParams>): RecordIngestionParams {
  return {
    organizationId: ORG_ID,
    documentRef: DOCUMENT_REF,
    recognitionConfidence: null,
    firstModelRef: null,
    ...overrides,
  };
}

function makeLinkageParams(
  overrides?: Partial<CreateEconomicsLinkageParams>
): CreateEconomicsLinkageParams {
  return {
    organizationId: ORG_ID,
    financeModelRef: FINANCE_MODEL_REF,
    initiativeId: INITIATIVE_ID,
    linkageType: 'budget',
    ...overrides,
  };
}

function makePromotionGateParams(
  overrides?: Partial<EvaluatePromotionGateParams>
): EvaluatePromotionGateParams {
  return {
    organizationId: ORG_ID,
    sourceArtifactRef: SOURCE_ARTIFACT_REF,
    targetInitiativeId: INITIATIVE_ID,
    permissionGateResult: 'approved',
    qualityGateResult: 'approved',
    provenancePreserved: true,
    staleStateChecked: true,
    ...overrides,
  };
}

function makeEscalationParams(
  overrides?: Partial<RecordDeltaEscalationParams>
): RecordDeltaEscalationParams {
  return {
    organizationId: ORG_ID,
    initiativeId: INITIATIVE_ID,
    financeRef: FINANCE_REF,
    deltaMagnitude: 0.15,
    deltaDuration: 45,
    materialityLevel: 'high',
    ...overrides,
  };
}

function makeSourceRefreshParams(
  overrides?: Partial<RecordSourceRefreshParams>
): RecordSourceRefreshParams {
  return {
    organizationId: ORG_ID,
    promotedArtifactRef: PROMOTED_ARTIFACT_REF,
    sourceModelRef: SOURCE_MODEL_REF,
    sourceUpdatedAt: '2026-03-23T12:00:00.000Z',
    reReviewPath: null,
    ...overrides,
  };
}

function makeIngestionRow(overrides?: Partial<Record<string, unknown>>) {
  return {
    ingestion_id: INGESTION_ID,
    organization_id: ORG_ID,
    document_ref: DOCUMENT_REF,
    recognition_confidence: null,
    readiness_state: 'uploaded',
    first_model_ref: null,
    created_at: '2026-03-23T10:00:00.000Z',
    updated_at: '2026-03-23T10:00:00.000Z',
    ...overrides,
  };
}

function makeLinkageRow(overrides?: Partial<Record<string, unknown>>) {
  return {
    linkage_id: '00000000-0000-4000-8000-000000000020',
    organization_id: ORG_ID,
    finance_model_ref: FINANCE_MODEL_REF,
    initiative_id: INITIATIVE_ID,
    linkage_type: 'budget',
    status: 'not_started',
    created_at: '2026-03-23T10:00:00.000Z',
    updated_at: '2026-03-23T10:00:00.000Z',
    ...overrides,
  };
}

function makeEscalationRow(overrides?: Partial<Record<string, unknown>>) {
  return {
    escalation_id: '00000000-0000-4000-8000-000000000030',
    organization_id: ORG_ID,
    initiative_id: INITIATIVE_ID,
    finance_ref: FINANCE_REF,
    delta_magnitude: 0.15,
    delta_duration: 45,
    materiality_level: 'high',
    escalated_to_cfo: 1,
    threshold_breached: 1,
    created_at: '2026-03-23T10:00:00.000Z',
    ...overrides,
  };
}

function makeSourceRefreshRow(overrides?: Partial<Record<string, unknown>>) {
  return {
    refresh_id: '00000000-0000-4000-8000-000000000040',
    organization_id: ORG_ID,
    promoted_artifact_ref: PROMOTED_ARTIFACT_REF,
    source_model_ref: SOURCE_MODEL_REF,
    source_updated_at: '2026-03-23T12:00:00.000Z',
    stale_warning_shown: 1,
    re_review_path: null,
    created_at: '2026-03-23T10:00:00.000Z',
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
// INGESTION STATE MACHINE
// ------------------------------------------

describe('isValidIngestionTransition', () => {
  it('allows uploaded → recognized', () => {
    expect(isValidIngestionTransition('uploaded', 'recognized')).toBe(true);
  });

  it('allows uploaded → review_required', () => {
    expect(isValidIngestionTransition('uploaded', 'review_required')).toBe(true);
  });

  it('allows recognized → confidence_assessed', () => {
    expect(isValidIngestionTransition('recognized', 'confidence_assessed')).toBe(true);
  });

  it('allows confidence_assessed → ready', () => {
    expect(isValidIngestionTransition('confidence_assessed', 'ready')).toBe(true);
  });

  it('allows review_required → recognized (re-process)', () => {
    expect(isValidIngestionTransition('review_required', 'recognized')).toBe(true);
  });

  it('allows review_required → ready (manual override)', () => {
    expect(isValidIngestionTransition('review_required', 'ready')).toBe(true);
  });

  it('rejects uploaded → ready (skips recognition)', () => {
    expect(isValidIngestionTransition('uploaded', 'ready')).toBe(false);
  });

  it('rejects ready → uploaded (backward)', () => {
    expect(isValidIngestionTransition('ready', 'uploaded')).toBe(false);
  });

  it('rejects recognized → uploaded (backward)', () => {
    expect(isValidIngestionTransition('recognized', 'uploaded')).toBe(false);
  });

  it('rejects uploaded → confidence_assessed (skips recognized)', () => {
    expect(isValidIngestionTransition('uploaded', 'confidence_assessed')).toBe(false);
  });
});

describe('INGESTION_STATE_TRANSITIONS completeness', () => {
  it('defines transitions for all readiness states', () => {
    for (const state of IngestionReadinessStateValues) {
      expect(INGESTION_STATE_TRANSITIONS).toHaveProperty(state);
    }
  });

  it('uploaded allows recognized, review, and terminal failure paths', () => {
    expect(INGESTION_STATE_TRANSITIONS.uploaded).toEqual([
      'recognized',
      'review_required',
      'failed',
      'rejected',
    ]);
  });

  it('ready allows review_required and terminal failure paths', () => {
    expect(INGESTION_STATE_TRANSITIONS.ready).toContain('review_required');
    expect(INGESTION_STATE_TRANSITIONS.ready).toContain('failed');
    expect(INGESTION_STATE_TRANSITIONS.ready).toContain('rejected');
  });

  it('review_required allows re-processing and terminal failure paths', () => {
    expect(INGESTION_STATE_TRANSITIONS.review_required).toContain('recognized');
    expect(INGESTION_STATE_TRANSITIONS.review_required).toContain('failed');
    expect(INGESTION_STATE_TRANSITIONS.review_required).toContain('rejected');
  });

  it('failed and rejected are terminal for the state machine', () => {
    expect(INGESTION_STATE_TRANSITIONS.failed).toHaveLength(0);
    expect(INGESTION_STATE_TRANSITIONS.rejected).toHaveLength(0);
  });
});

// ------------------------------------------
// recordIngestion
// ------------------------------------------

describe('recordIngestion', () => {
  it('creates an ingestion record in uploaded state', async () => {
    const result = await recordIngestion(makeIngestionParams());

    expect(result.readinessState).toBe('uploaded');
    expect(result.documentRef).toBe(DOCUMENT_REF);
    expect(result.organizationId).toBe(ORG_ID);
    expect(result.ingestionId).toBeDefined();
    expect(result.recognitionConfidence).toBeNull();
    expect(result.firstModelRef).toBeNull();
    expect(mockDbRun).toHaveBeenCalledOnce();
  });

  it('accepts optional recognitionConfidence', async () => {
    const result = await recordIngestion(makeIngestionParams({ recognitionConfidence: 0.85 }));

    expect(result.recognitionConfidence).toBe(0.85);
  });

  it('accepts optional firstModelRef', async () => {
    const result = await recordIngestion(makeIngestionParams({ firstModelRef: 'model-ref-1' }));

    expect(result.firstModelRef).toBe('model-ref-1');
  });

  it('rejects invalid organizationId via Zod', async () => {
    await expect(
      recordIngestion({ organizationId: 'not-uuid', documentRef: 'doc.pdf' })
    ).rejects.toThrow(ZodError);
  });

  it('rejects empty documentRef via Zod', async () => {
    await expect(recordIngestion({ organizationId: ORG_ID, documentRef: '' })).rejects.toThrow(
      ZodError
    );
  });

  it('rejects recognitionConfidence > 1 via Zod', () => {
    expect(() =>
      RecordIngestionParamsSchema.parse(makeIngestionParams({ recognitionConfidence: 1.5 }))
    ).toThrow(ZodError);
  });

  it('rejects recognitionConfidence < 0 via Zod', () => {
    expect(() =>
      RecordIngestionParamsSchema.parse(makeIngestionParams({ recognitionConfidence: -0.1 }))
    ).toThrow(ZodError);
  });
});

// ------------------------------------------
// getIngestion
// ------------------------------------------

describe('getIngestion', () => {
  it('returns ingestion record by id and org', async () => {
    mockDbGet.mockResolvedValueOnce(makeIngestionRow());

    const result = await getIngestion(INGESTION_ID, ORG_ID);

    expect(result).not.toBeNull();
    expect(result!.ingestionId).toBe(INGESTION_ID);
    expect(result!.readinessState).toBe('uploaded');
    expect(result!.organizationId).toBe(ORG_ID);
  });

  it('returns null when not found', async () => {
    mockDbGet.mockResolvedValueOnce(null);

    const result = await getIngestion('nonexistent', ORG_ID);
    expect(result).toBeNull();
  });

  it('includes organization_id in query (org isolation)', async () => {
    mockDbGet.mockResolvedValueOnce(null);
    await getIngestion(INGESTION_ID, ORG_ID);

    const query = mockDbGet.mock.calls[0][0] as string;
    expect(query).toContain('organization_id');
    expect(mockDbGet.mock.calls[0][1]).toContain(ORG_ID);
  });
});

// ------------------------------------------
// transitionIngestionState
// ------------------------------------------

describe('transitionIngestionState', () => {
  it('transitions from uploaded to recognized', async () => {
    mockDbGet.mockResolvedValueOnce(makeIngestionRow({ readiness_state: 'uploaded' }));

    const result = await transitionIngestionState({
      ingestionId: INGESTION_ID,
      organizationId: ORG_ID,
      newState: 'recognized',
    });

    expect(result.readinessState).toBe('recognized');
    expect(mockDbRun).toHaveBeenCalledOnce();
  });

  it('rejects invalid transition', async () => {
    mockDbGet.mockResolvedValueOnce(makeIngestionRow({ readiness_state: 'uploaded' }));

    await expect(
      transitionIngestionState({
        ingestionId: INGESTION_ID,
        organizationId: ORG_ID,
        newState: 'ready',
      })
    ).rejects.toThrow('Invalid ingestion state transition');
  });

  it('throws when ingestion not found', async () => {
    mockDbGet.mockResolvedValueOnce(null);

    await expect(
      transitionIngestionState({
        ingestionId: '00000000-0000-4000-8000-ffffffffffff',
        organizationId: ORG_ID,
        newState: 'recognized',
      })
    ).rejects.toThrow('not found');
  });

  it('rejects invalid params via Zod', async () => {
    await expect(
      transitionIngestionState({
        ingestionId: 'not-uuid',
        organizationId: ORG_ID,
        newState: 'invalid_state' as any,
      })
    ).rejects.toThrow(ZodError);
  });
});

// ------------------------------------------
// createEconomicsLinkage
// ------------------------------------------

describe('createEconomicsLinkage', () => {
  it('creates a linkage with default not_started status', async () => {
    const result = await createEconomicsLinkage(makeLinkageParams());

    expect(result.linkageType).toBe('budget');
    expect(result.status).toBe('not_started');
    expect(result.initiativeId).toBe(INITIATIVE_ID);
    expect(result.financeModelRef).toBe(FINANCE_MODEL_REF);
    expect(result.linkageId).toBeDefined();
    expect(mockDbRun).toHaveBeenCalledOnce();
  });

  it('accepts explicit status override', async () => {
    const result = await createEconomicsLinkage(
      makeLinkageParams({ status: 'linked_to_finance_model' })
    );

    expect(result.status).toBe('linked_to_finance_model');
  });

  it('supports all 4 linkage types', () => {
    for (const type of LinkageTypeValues) {
      expect(() =>
        CreateEconomicsLinkageParamsSchema.parse(makeLinkageParams({ linkageType: type }))
      ).not.toThrow();
    }
  });

  it('supports all 6 linkage statuses', () => {
    for (const status of LinkageStatusValues) {
      expect(() =>
        CreateEconomicsLinkageParamsSchema.parse(makeLinkageParams({ status }))
      ).not.toThrow();
    }
  });

  it('rejects invalid linkageType via Zod', () => {
    expect(() =>
      CreateEconomicsLinkageParamsSchema.parse(makeLinkageParams({ linkageType: 'invalid' as any }))
    ).toThrow(ZodError);
  });

  it('rejects empty initiativeId via Zod', () => {
    expect(() =>
      CreateEconomicsLinkageParamsSchema.parse(makeLinkageParams({ initiativeId: '' }))
    ).toThrow(ZodError);
  });
});

// ------------------------------------------
// getLinkagesByInitiative
// ------------------------------------------

describe('getLinkagesByInitiative', () => {
  it('returns linkages for an initiative', async () => {
    mockDbAll.mockResolvedValueOnce([
      makeLinkageRow(),
      makeLinkageRow({ linkage_id: 'linkage-2', linkage_type: 'forecast' }),
    ]);

    const results = await getLinkagesByInitiative(INITIATIVE_ID, ORG_ID);

    expect(results).toHaveLength(2);
    expect(results[0].linkageType).toBe('budget');
    expect(results[1].linkageType).toBe('forecast');
  });

  it('returns empty array when no linkages exist', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    const results = await getLinkagesByInitiative(INITIATIVE_ID, ORG_ID);
    expect(results).toEqual([]);
  });

  it('includes organization_id in query (org isolation)', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    await getLinkagesByInitiative(INITIATIVE_ID, ORG_ID);

    const query = mockDbAll.mock.calls[0][0] as string;
    expect(query).toContain('organization_id');
    expect(mockDbAll.mock.calls[0][1]).toContain(ORG_ID);
  });
});

// ------------------------------------------
// PROMOTION GATE (Decision W6-8)
// ------------------------------------------

describe('computeOverallGateResult', () => {
  it('approves when both gates approve and provenance+stale are ok', () => {
    expect(computeOverallGateResult('approved', 'approved', true, true)).toBe('approved');
  });

  it('rejects when permission gate rejects', () => {
    expect(computeOverallGateResult('rejected', 'approved', true, true)).toBe('rejected');
  });

  it('rejects when quality gate rejects', () => {
    expect(computeOverallGateResult('approved', 'rejected', true, true)).toBe('rejected');
  });

  it('rejects when both gates reject', () => {
    expect(computeOverallGateResult('rejected', 'rejected', true, true)).toBe('rejected');
  });

  it('returns review_required when provenance not preserved', () => {
    expect(computeOverallGateResult('approved', 'approved', false, true)).toBe('review_required');
  });

  it('returns review_required when stale state not checked', () => {
    expect(computeOverallGateResult('approved', 'approved', true, false)).toBe('review_required');
  });

  it('returns review_required when permission is review_required', () => {
    expect(computeOverallGateResult('review_required', 'approved', true, true)).toBe(
      'review_required'
    );
  });

  it('returns review_required when quality is review_required', () => {
    expect(computeOverallGateResult('approved', 'review_required', true, true)).toBe(
      'review_required'
    );
  });

  it('rejects over review_required when one gate rejects', () => {
    expect(computeOverallGateResult('rejected', 'review_required', true, true)).toBe('rejected');
  });
});

describe('evaluatePromotionGate', () => {
  it('creates an approved gate record when both gates pass', async () => {
    const result = await evaluatePromotionGate(makePromotionGateParams());

    expect(result.overallResult).toBe('approved');
    expect(result.permissionGateResult).toBe('approved');
    expect(result.qualityGateResult).toBe('approved');
    expect(result.provenancePreserved).toBe(true);
    expect(result.staleStateChecked).toBe(true);
    expect(result.gateId).toBeDefined();
    expect(mockDbRun).toHaveBeenCalledOnce();
  });

  it('creates a rejected gate record when quality fails', async () => {
    const result = await evaluatePromotionGate(
      makePromotionGateParams({ qualityGateResult: 'rejected' })
    );

    expect(result.overallResult).toBe('rejected');
  });

  it('creates review_required when provenance not preserved', async () => {
    const result = await evaluatePromotionGate(
      makePromotionGateParams({ provenancePreserved: false })
    );

    expect(result.overallResult).toBe('review_required');
  });

  it('stores boolean fields as integers in DB', async () => {
    await evaluatePromotionGate(makePromotionGateParams());

    const dbArgs = mockDbRun.mock.calls[0][1] as unknown[];
    const provenanceIdx = 6;
    const staleIdx = 7;
    expect(dbArgs[provenanceIdx]).toBe(1);
    expect(dbArgs[staleIdx]).toBe(1);
  });

  it('rejects invalid params via Zod', async () => {
    await expect(
      evaluatePromotionGate({
        organizationId: 'not-uuid',
        sourceArtifactRef: '',
        targetInitiativeId: '',
        permissionGateResult: 'invalid' as any,
        qualityGateResult: 'approved',
        provenancePreserved: true,
        staleStateChecked: true,
      })
    ).rejects.toThrow(ZodError);
  });

  it('supports all 3 gate result values', () => {
    for (const result of PromotionGateResultValues) {
      expect(() =>
        EvaluatePromotionGateParamsSchema.parse(
          makePromotionGateParams({ permissionGateResult: result })
        )
      ).not.toThrow();
    }
  });
});

// ------------------------------------------
// DELTA ESCALATION (Decision W6-9)
// ------------------------------------------

describe('evaluateEscalationThreshold', () => {
  it('breaches threshold when magnitude and duration exceed defaults', () => {
    const result = evaluateEscalationThreshold(0.15, 45, 'high');
    expect(result.thresholdBreached).toBe(true);
    expect(result.escalatedToCFO).toBe(true);
  });

  it('does not breach when magnitude is below threshold', () => {
    const result = evaluateEscalationThreshold(0.05, 45, 'high');
    expect(result.thresholdBreached).toBe(false);
    expect(result.escalatedToCFO).toBe(false);
  });

  it('does not breach when duration is below threshold', () => {
    const result = evaluateEscalationThreshold(0.15, 10, 'high');
    expect(result.thresholdBreached).toBe(false);
    expect(result.escalatedToCFO).toBe(false);
  });

  it('breaches but does not escalate to CFO for low materiality', () => {
    const result = evaluateEscalationThreshold(0.15, 45, 'low');
    expect(result.thresholdBreached).toBe(true);
    expect(result.escalatedToCFO).toBe(false);
  });

  it('breaches but does not escalate to CFO for medium materiality', () => {
    const result = evaluateEscalationThreshold(0.15, 45, 'medium');
    expect(result.thresholdBreached).toBe(true);
    expect(result.escalatedToCFO).toBe(false);
  });

  it('escalates to CFO for critical materiality', () => {
    const result = evaluateEscalationThreshold(0.15, 45, 'critical');
    expect(result.thresholdBreached).toBe(true);
    expect(result.escalatedToCFO).toBe(true);
  });

  it('respects custom thresholds', () => {
    const result = evaluateEscalationThreshold(0.05, 10, 'low', {
      deltaMagnitude: 0.01,
      deltaDuration: 5,
      materialityCFOLevel: 'low',
    });
    expect(result.thresholdBreached).toBe(true);
    expect(result.escalatedToCFO).toBe(true);
  });

  it('boundary: exact threshold values breach', () => {
    const result = evaluateEscalationThreshold(
      DEFAULT_ESCALATION_THRESHOLDS.deltaMagnitude,
      DEFAULT_ESCALATION_THRESHOLDS.deltaDuration,
      'high'
    );
    expect(result.thresholdBreached).toBe(true);
  });
});

describe('recordDeltaEscalation', () => {
  it('records escalation with computed threshold and CFO flag', async () => {
    const result = await recordDeltaEscalation(makeEscalationParams());

    expect(result.deltaMagnitude).toBe(0.15);
    expect(result.deltaDuration).toBe(45);
    expect(result.materialityLevel).toBe('high');
    expect(result.thresholdBreached).toBe(true);
    expect(result.escalatedToCFO).toBe(true);
    expect(result.escalationId).toBeDefined();
    expect(mockDbRun).toHaveBeenCalledOnce();
  });

  it('records non-escalated delta for low magnitude', async () => {
    const result = await recordDeltaEscalation(
      makeEscalationParams({ deltaMagnitude: 0.01, deltaDuration: 5 })
    );

    expect(result.thresholdBreached).toBe(false);
    expect(result.escalatedToCFO).toBe(false);
  });

  it('supports all 4 materiality levels', () => {
    for (const level of MaterialityLevelValues) {
      expect(() =>
        RecordDeltaEscalationParamsSchema.parse(makeEscalationParams({ materialityLevel: level }))
      ).not.toThrow();
    }
  });

  it('rejects negative deltaMagnitude via Zod', () => {
    expect(() =>
      RecordDeltaEscalationParamsSchema.parse(makeEscalationParams({ deltaMagnitude: -1 }))
    ).toThrow(ZodError);
  });

  it('rejects negative deltaDuration via Zod', () => {
    expect(() =>
      RecordDeltaEscalationParamsSchema.parse(makeEscalationParams({ deltaDuration: -1 }))
    ).toThrow(ZodError);
  });

  it('rejects non-integer deltaDuration via Zod', () => {
    expect(() =>
      RecordDeltaEscalationParamsSchema.parse(makeEscalationParams({ deltaDuration: 1.5 }))
    ).toThrow(ZodError);
  });

  it('rejects invalid materialityLevel via Zod', () => {
    expect(() =>
      RecordDeltaEscalationParamsSchema.parse(
        makeEscalationParams({ materialityLevel: 'extreme' as any })
      )
    ).toThrow(ZodError);
  });
});

describe('getEscalationsByInitiative', () => {
  it('returns escalations for an initiative', async () => {
    mockDbAll.mockResolvedValueOnce([
      makeEscalationRow(),
      makeEscalationRow({ escalation_id: 'esc-2', escalated_to_cfo: 0, threshold_breached: 0 }),
    ]);

    const results = await getEscalationsByInitiative(INITIATIVE_ID, ORG_ID);

    expect(results).toHaveLength(2);
    expect(results[0].escalatedToCFO).toBe(true);
    expect(results[1].escalatedToCFO).toBe(false);
  });

  it('returns empty array when no escalations exist', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    const results = await getEscalationsByInitiative(INITIATIVE_ID, ORG_ID);
    expect(results).toEqual([]);
  });

  it('includes organization_id in query (org isolation)', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    await getEscalationsByInitiative(INITIATIVE_ID, ORG_ID);

    const query = mockDbAll.mock.calls[0][0] as string;
    expect(query).toContain('organization_id');
    expect(mockDbAll.mock.calls[0][1]).toContain(ORG_ID);
  });
});

// ------------------------------------------
// CLOUD-LINKED SOURCE REFRESH (Decision W6-10)
// ------------------------------------------

describe('recordSourceRefresh', () => {
  it('records a source refresh with stale warning shown', async () => {
    const result = await recordSourceRefresh(makeSourceRefreshParams());

    expect(result.promotedArtifactRef).toBe(PROMOTED_ARTIFACT_REF);
    expect(result.sourceModelRef).toBe(SOURCE_MODEL_REF);
    expect(result.staleWarningShown).toBe(true);
    expect(result.reReviewPath).toBeNull();
    expect(result.refreshId).toBeDefined();
    expect(mockDbRun).toHaveBeenCalledOnce();
  });

  it('accepts optional reReviewPath', async () => {
    const result = await recordSourceRefresh(
      makeSourceRefreshParams({ reReviewPath: '/review/finance/123' })
    );

    expect(result.reReviewPath).toBe('/review/finance/123');
  });

  it('rejects invalid organizationId via Zod', () => {
    expect(() =>
      RecordSourceRefreshParamsSchema.parse(makeSourceRefreshParams({ organizationId: 'not-uuid' }))
    ).toThrow(ZodError);
  });

  it('rejects empty promotedArtifactRef via Zod', () => {
    expect(() =>
      RecordSourceRefreshParamsSchema.parse(makeSourceRefreshParams({ promotedArtifactRef: '' }))
    ).toThrow(ZodError);
  });

  it('rejects empty sourceModelRef via Zod', () => {
    expect(() =>
      RecordSourceRefreshParamsSchema.parse(makeSourceRefreshParams({ sourceModelRef: '' }))
    ).toThrow(ZodError);
  });
});

describe('getSourceRefreshes', () => {
  it('returns refreshes for a promoted artifact', async () => {
    mockDbAll.mockResolvedValueOnce([
      makeSourceRefreshRow(),
      makeSourceRefreshRow({ refresh_id: 'refresh-2', re_review_path: '/review/2' }),
    ]);

    const results = await getSourceRefreshes(PROMOTED_ARTIFACT_REF, ORG_ID);

    expect(results).toHaveLength(2);
    expect(results[0].staleWarningShown).toBe(true);
    expect(results[1].reReviewPath).toBe('/review/2');
  });

  it('returns empty array when no refreshes exist', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    const results = await getSourceRefreshes(PROMOTED_ARTIFACT_REF, ORG_ID);
    expect(results).toEqual([]);
  });

  it('includes organization_id in query (org isolation)', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    await getSourceRefreshes(PROMOTED_ARTIFACT_REF, ORG_ID);

    const query = mockDbAll.mock.calls[0][0] as string;
    expect(query).toContain('organization_id');
    expect(mockDbAll.mock.calls[0][1]).toContain(ORG_ID);
  });
});

// ------------------------------------------
// ORG ISOLATION
// ------------------------------------------

describe('org isolation', () => {
  it('ingestion queries include organization_id', async () => {
    mockDbGet.mockResolvedValueOnce(null);
    await getIngestion(INGESTION_ID, ORG_ID);

    const query = mockDbGet.mock.calls[0][0] as string;
    expect(query).toContain('organization_id');
  });

  it('linkage queries include organization_id', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    await getLinkagesByInitiative(INITIATIVE_ID, ORG_ID);

    const query = mockDbAll.mock.calls[0][0] as string;
    expect(query).toContain('organization_id');
  });

  it('escalation queries include organization_id', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    await getEscalationsByInitiative(INITIATIVE_ID, ORG_ID);

    const query = mockDbAll.mock.calls[0][0] as string;
    expect(query).toContain('organization_id');
  });

  it('source refresh queries include organization_id', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    await getSourceRefreshes(PROMOTED_ARTIFACT_REF, ORG_ID);

    const query = mockDbAll.mock.calls[0][0] as string;
    expect(query).toContain('organization_id');
  });

  it('recordIngestion writes org to DB', async () => {
    await recordIngestion(makeIngestionParams());

    const dbArgs = mockDbRun.mock.calls[0][1] as unknown[];
    expect(dbArgs).toContain(ORG_ID);
  });

  it('evaluatePromotionGate writes org to DB', async () => {
    await evaluatePromotionGate(makePromotionGateParams());

    const dbArgs = mockDbRun.mock.calls[0][1] as unknown[];
    expect(dbArgs).toContain(ORG_ID);
  });
});

// ------------------------------------------
// ZOD SCHEMA VALIDATION
// ------------------------------------------

describe('Zod schema validation', () => {
  it('validates FinanceDocumentIngestion', () => {
    expect(() =>
      FinanceDocumentIngestionSchema.parse({
        ingestionId: INGESTION_ID,
        organizationId: ORG_ID,
        documentRef: DOCUMENT_REF,
        recognitionConfidence: 0.92,
        readinessState: 'ready',
        firstModelRef: 'model-1',
        createdAt: '2026-03-23T10:00:00.000Z',
        updatedAt: '2026-03-23T10:00:00.000Z',
      })
    ).not.toThrow();
  });

  it('validates InitiativeEconomicsLinkage', () => {
    expect(() =>
      InitiativeEconomicsLinkageSchema.parse({
        linkageId: '00000000-0000-4000-8000-000000000020',
        organizationId: ORG_ID,
        financeModelRef: FINANCE_MODEL_REF,
        initiativeId: INITIATIVE_ID,
        linkageType: 'budget',
        status: 'linked_to_finance_model',
        createdAt: '2026-03-23T10:00:00.000Z',
        updatedAt: '2026-03-23T10:00:00.000Z',
      })
    ).not.toThrow();
  });

  it('validates PromotionGate', () => {
    expect(() =>
      PromotionGateSchema.parse({
        gateId: '00000000-0000-4000-8000-000000000030',
        organizationId: ORG_ID,
        sourceArtifactRef: SOURCE_ARTIFACT_REF,
        targetInitiativeId: INITIATIVE_ID,
        permissionGateResult: 'approved',
        qualityGateResult: 'approved',
        provenancePreserved: true,
        staleStateChecked: true,
        overallResult: 'approved',
        createdAt: '2026-03-23T10:00:00.000Z',
      })
    ).not.toThrow();
  });

  it('validates UnreconciledDeltaEscalation', () => {
    expect(() =>
      UnreconciledDeltaEscalationSchema.parse({
        escalationId: '00000000-0000-4000-8000-000000000040',
        organizationId: ORG_ID,
        initiativeId: INITIATIVE_ID,
        financeRef: FINANCE_REF,
        deltaMagnitude: 0.15,
        deltaDuration: 45,
        materialityLevel: 'high',
        escalatedToCFO: true,
        thresholdBreached: true,
        createdAt: '2026-03-23T10:00:00.000Z',
      })
    ).not.toThrow();
  });

  it('validates CloudLinkedSourceRefresh', () => {
    expect(() =>
      CloudLinkedSourceRefreshSchema.parse({
        refreshId: '00000000-0000-4000-8000-000000000050',
        organizationId: ORG_ID,
        promotedArtifactRef: PROMOTED_ARTIFACT_REF,
        sourceModelRef: SOURCE_MODEL_REF,
        sourceUpdatedAt: '2026-03-23T12:00:00.000Z',
        staleWarningShown: true,
        reReviewPath: null,
        createdAt: '2026-03-23T10:00:00.000Z',
      })
    ).not.toThrow();
  });

  it('rejects invalid readinessState in FinanceDocumentIngestion', () => {
    expect(() =>
      FinanceDocumentIngestionSchema.parse({
        ingestionId: INGESTION_ID,
        organizationId: ORG_ID,
        documentRef: DOCUMENT_REF,
        recognitionConfidence: null,
        readinessState: 'invalid_state',
        firstModelRef: null,
        createdAt: '2026-03-23T10:00:00.000Z',
        updatedAt: '2026-03-23T10:00:00.000Z',
      })
    ).toThrow(ZodError);
  });

  it('validates all ingestion readiness states are defined', () => {
    expect(IngestionReadinessStateValues).toHaveLength(7);
  });

  it('validates all 4 linkage types are defined', () => {
    expect(LinkageTypeValues).toHaveLength(4);
  });

  it('validates all 6 linkage statuses are defined', () => {
    expect(LinkageStatusValues).toHaveLength(6);
  });

  it('validates all 3 promotion gate results are defined', () => {
    expect(PromotionGateResultValues).toHaveLength(3);
  });

  it('validates all 4 materiality levels are defined', () => {
    expect(MaterialityLevelValues).toHaveLength(4);
  });

  it('validates DEFAULT_ESCALATION_THRESHOLDS structure', () => {
    expect(DEFAULT_ESCALATION_THRESHOLDS.deltaMagnitude).toBeGreaterThan(0);
    expect(DEFAULT_ESCALATION_THRESHOLDS.deltaDuration).toBeGreaterThan(0);
    expect(MaterialityLevelValues).toContain(DEFAULT_ESCALATION_THRESHOLDS.materialityCFOLevel);
  });
});
