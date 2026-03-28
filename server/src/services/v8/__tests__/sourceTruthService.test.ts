import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ZodError } from 'zod';

import type {
  AddSyncedSourceRefParams,
  RecordMaterializationParams,
  SourceMaterializationRecord,
  SyncedSourceRef,
  ValidatePromotionParams,
} from '../../../types/sourceTruthPreservation.js';
import {
  AddSyncedSourceRefParamsSchema,
  ENTRYPOINT_CLASS_MAP,
  EntrypointClassValues,
  EvidenceClassValues,
  InitiativeEntrypointValues,
  MaterializationModeValues,
  PromotionValidationSchema,
  RecordMaterializationParamsSchema,
  SourceMaterializationRecordSchema,
  SyncedSourceRefSchema,
  SyncStatusValues,
  ValidatePromotionParamsSchema,
} from '../../../types/sourceTruthPreservation.js';

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
  addSyncedSourceRef,
  getMaterializationRecord,
  getSourcesByInitiative,
  getSyncedSourceRefs,
  recordSourceMaterialization,
  updateSyncStatus,
  validatePromotion,
} from '../sourceTruthService.js';

// ==========================================
// FIXTURES
// ==========================================

const ORG_A = '00000000-0000-4000-8000-000000000001';
const ORG_B = '00000000-0000-4000-8000-000000000099';
const INITIATIVE_ID = '00000000-0000-4000-8000-000000000010';
const INITIATIVE_ID_2 = '00000000-0000-4000-8000-000000000011';
const USER_ID = '00000000-0000-4000-8000-000000000020';
const SNAPSHOT_ID = '00000000-0000-4000-8000-000000000030';
const ARTIFACT_ID = 'tool-session-001';

function makeMatParams(
  overrides?: Partial<RecordMaterializationParams>
): RecordMaterializationParams {
  return {
    initiativeId: INITIATIVE_ID,
    organizationId: ORG_A,
    entrypoint: 'idea',
    sourceArtifactId: ARTIFACT_ID,
    sourceArtifactType: 'ToolSession',
    contextSnapshotId: SNAPSHOT_ID,
    materializationMode: 'invisible',
    evidenceClass: 'strong',
    promotedBy: USER_ID,
    ...overrides,
  };
}

function makeSyncParams(overrides?: Partial<AddSyncedSourceRefParams>): AddSyncedSourceRefParams {
  return {
    initiativeId: INITIATIVE_ID,
    organizationId: ORG_A,
    externalSourceId: 'jira-123',
    externalSystem: 'jira',
    syncStatus: 'active',
    lastSyncedAt: '2026-03-23T10:00:00.000Z',
    ...overrides,
  };
}

function makeMatRow(overrides?: Partial<Record<string, unknown>>) {
  return {
    record_id: '00000000-0000-4000-8000-bbbbbbbbbbbb',
    initiative_id: INITIATIVE_ID,
    organization_id: ORG_A,
    entrypoint: 'idea',
    entrypoint_class: 'derived_source',
    source_artifact_id: ARTIFACT_ID,
    source_artifact_type: 'ToolSession',
    context_snapshot_id: SNAPSHOT_ID,
    materialization_mode: 'invisible',
    evidence_class: 'strong',
    promoted_by: USER_ID,
    promoted_at: '2026-03-23T10:00:00.000Z',
    created_at: '2026-03-23T10:00:00.000Z',
    ...overrides,
  };
}

function makeSyncRow(overrides?: Partial<Record<string, unknown>>) {
  return {
    ref_id: '00000000-0000-4000-8000-cccccccccccc',
    initiative_id: INITIATIVE_ID,
    organization_id: ORG_A,
    external_source_id: 'jira-123',
    external_system: 'jira',
    sync_status: 'active',
    last_synced_at: '2026-03-23T10:00:00.000Z',
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
// recordSourceMaterialization
// ------------------------------------------

describe('recordSourceMaterialization', () => {
  it('creates a materialization record with all required fields', async () => {
    const result = await recordSourceMaterialization(makeMatParams());

    expect(result.recordId).toBeDefined();
    expect(result.initiativeId).toBe(INITIATIVE_ID);
    expect(result.organizationId).toBe(ORG_A);
    expect(result.entrypoint).toBe('idea');
    expect(result.entrypointClass).toBe('derived_source');
    expect(result.sourceArtifactId).toBe(ARTIFACT_ID);
    expect(result.sourceArtifactType).toBe('ToolSession');
    expect(result.contextSnapshotId).toBe(SNAPSHOT_ID);
    expect(result.materializationMode).toBe('invisible');
    expect(result.evidenceClass).toBe('strong');
    expect(result.promotedBy).toBe(USER_ID);
    expect(result.promotedAt).toBeDefined();

    expect(mockDbRun).toHaveBeenCalledOnce();
    const sql = mockDbRun.mock.calls[0][0] as string;
    expect(sql).toContain('INSERT INTO v8_source_materialization_records');
  });

  it('defaults materializationMode to invisible (Decision W3-1)', async () => {
    const result = await recordSourceMaterialization(
      makeMatParams({ materializationMode: undefined })
    );
    expect(result.materializationMode).toBe('invisible');
  });

  it('accepts explicit_confirmation mode when truth risk increases', async () => {
    const result = await recordSourceMaterialization(
      makeMatParams({ materializationMode: 'explicit_confirmation' })
    );
    expect(result.materializationMode).toBe('explicit_confirmation');
  });

  it('derives entrypointClass=derived_source for idea entrypoint', async () => {
    const result = await recordSourceMaterialization(makeMatParams({ entrypoint: 'idea' }));
    expect(result.entrypointClass).toBe('derived_source');
  });

  it('derives entrypointClass=derived_source for interview entrypoint', async () => {
    const result = await recordSourceMaterialization(makeMatParams({ entrypoint: 'interview' }));
    expect(result.entrypointClass).toBe('derived_source');
  });

  it('derives entrypointClass=derived_source for chat entrypoint', async () => {
    const result = await recordSourceMaterialization(makeMatParams({ entrypoint: 'chat' }));
    expect(result.entrypointClass).toBe('derived_source');
  });

  it('derives entrypointClass=derived_source for manual entrypoint', async () => {
    const result = await recordSourceMaterialization(makeMatParams({ entrypoint: 'manual' }));
    expect(result.entrypointClass).toBe('derived_source');
  });

  it('derives entrypointClass=native_source for tools_assessment entrypoint', async () => {
    const result = await recordSourceMaterialization(
      makeMatParams({ entrypoint: 'tools_assessment' })
    );
    expect(result.entrypointClass).toBe('native_source');
  });

  it('allows null contextSnapshotId', async () => {
    const result = await recordSourceMaterialization(makeMatParams({ contextSnapshotId: null }));
    expect(result.contextSnapshotId).toBeNull();
  });

  it('rejects invalid entrypoint via Zod', async () => {
    await expect(
      recordSourceMaterialization(makeMatParams({ entrypoint: 'invalid' as any }))
    ).rejects.toThrow(ZodError);
  });

  it('rejects invalid evidenceClass via Zod', async () => {
    await expect(
      recordSourceMaterialization(makeMatParams({ evidenceClass: 'unknown' as any }))
    ).rejects.toThrow(ZodError);
  });

  it('rejects missing required fields via Zod', async () => {
    await expect(recordSourceMaterialization({ organizationId: ORG_A } as any)).rejects.toThrow(
      ZodError
    );
  });

  it('rejects empty sourceArtifactId via Zod', async () => {
    await expect(
      recordSourceMaterialization(makeMatParams({ sourceArtifactId: '' }))
    ).rejects.toThrow(ZodError);
  });
});

// ------------------------------------------
// getSourcesByInitiative
// ------------------------------------------

describe('getSourcesByInitiative', () => {
  it('returns materialization records ordered by promoted_at', async () => {
    mockDbAll.mockResolvedValueOnce([
      makeMatRow({ promoted_at: '2026-03-23T10:00:00.000Z' }),
      makeMatRow({ record_id: 'rec-2', promoted_at: '2026-03-23T11:00:00.000Z' }),
    ]);

    const results = await getSourcesByInitiative(INITIATIVE_ID, ORG_A);

    expect(results).toHaveLength(2);
    expect(results[0].promotedAt).toBe('2026-03-23T10:00:00.000Z');
    expect(results[1].promotedAt).toBe('2026-03-23T11:00:00.000Z');
  });

  it('returns empty array when no records exist', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    const results = await getSourcesByInitiative(INITIATIVE_ID, ORG_A);
    expect(results).toEqual([]);
  });

  it('enforces organization isolation in query', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    await getSourcesByInitiative(INITIATIVE_ID, ORG_A);

    const sql = mockDbAll.mock.calls[0][0] as string;
    expect(sql).toContain('organization_id');
    const params = mockDbAll.mock.calls[0][1] as string[];
    expect(params).toContain(ORG_A);
  });
});

// ------------------------------------------
// getMaterializationRecord
// ------------------------------------------

describe('getMaterializationRecord', () => {
  it('returns a record when found with org isolation', async () => {
    mockDbGet.mockResolvedValueOnce(makeMatRow());

    const result = await getMaterializationRecord('00000000-0000-4000-8000-bbbbbbbbbbbb', ORG_A);

    expect(result).not.toBeNull();
    expect(result!.recordId).toBe('00000000-0000-4000-8000-bbbbbbbbbbbb');
    expect(result!.organizationId).toBe(ORG_A);
  });

  it('returns null when record does not exist', async () => {
    mockDbGet.mockResolvedValueOnce(null);
    const result = await getMaterializationRecord('nonexistent', ORG_A);
    expect(result).toBeNull();
  });

  it('does not return records from other organizations', async () => {
    mockDbGet.mockResolvedValueOnce(null);
    const result = await getMaterializationRecord('00000000-0000-4000-8000-bbbbbbbbbbbb', ORG_B);
    expect(result).toBeNull();

    const sql = mockDbGet.mock.calls[0][0] as string;
    expect(sql).toContain('organization_id');
  });
});

// ------------------------------------------
// validatePromotion (Decision W3-2: dual-gate)
// ------------------------------------------

describe('validatePromotion', () => {
  function makeValidateParams(
    overrides?: Partial<ValidatePromotionParams>
  ): ValidatePromotionParams {
    return {
      organizationId: ORG_A,
      promotedBy: USER_ID,
      entrypoint: 'interview',
      evidenceClass: 'strong',
      hasPermission: true,
      isHighImpact: false,
      ...overrides,
    };
  }

  it('allows promotion when both permission and evidence are sufficient', () => {
    const result = validatePromotion(makeValidateParams());

    expect(result.isAllowed).toBe(true);
    expect(result.evidenceSufficient).toBe(true);
    expect(result.requiresReview).toBe(false);
    expect(result.reasons).toEqual([]);
  });

  it('allows promotion with moderate evidence', () => {
    const result = validatePromotion(makeValidateParams({ evidenceClass: 'moderate' }));

    expect(result.isAllowed).toBe(true);
    expect(result.evidenceSufficient).toBe(true);
    expect(result.requiresReview).toBe(false);
  });

  it('blocks promotion when permission is missing', () => {
    const result = validatePromotion(makeValidateParams({ hasPermission: false }));

    expect(result.isAllowed).toBe(false);
    expect(result.reasons).toContain('Actor does not have initiative-creation permission');
  });

  it('marks evidence insufficient for weak evidence', () => {
    const result = validatePromotion(makeValidateParams({ evidenceClass: 'weak' }));

    expect(result.evidenceSufficient).toBe(false);
    expect(result.requiresReview).toBe(true);
    expect(result.reasons).toContain(
      "Evidence class 'weak' is below threshold (requires strong or moderate)"
    );
    expect(result.reasons).toContain('Weak evidence requires review before promotion');
  });

  it('marks evidence insufficient for mixed evidence', () => {
    const result = validatePromotion(makeValidateParams({ evidenceClass: 'mixed' }));

    expect(result.evidenceSufficient).toBe(false);
    expect(result.requiresReview).toBe(true);
    expect(result.reasons).toContain(
      "Evidence class 'mixed' is below threshold (requires strong or moderate)"
    );
    expect(result.reasons).toContain(
      'Mixed/contradictory evidence requires review before promotion'
    );
  });

  it('requires review for high-impact promotions even with strong evidence', () => {
    const result = validatePromotion(makeValidateParams({ isHighImpact: true }));

    expect(result.isAllowed).toBe(true);
    expect(result.evidenceSufficient).toBe(true);
    expect(result.requiresReview).toBe(true);
    expect(result.reasons).toContain('High-impact promotion requires review');
  });

  it('accumulates multiple reasons when both gates fail', () => {
    const result = validatePromotion(
      makeValidateParams({ hasPermission: false, evidenceClass: 'weak', isHighImpact: true })
    );

    expect(result.isAllowed).toBe(false);
    expect(result.evidenceSufficient).toBe(false);
    expect(result.requiresReview).toBe(true);
    expect(result.reasons.length).toBeGreaterThanOrEqual(3);
  });

  it('rejects invalid evidenceClass via Zod', () => {
    expect(() =>
      validatePromotion(makeValidateParams({ evidenceClass: 'invalid' as any }))
    ).toThrow(ZodError);
  });

  it('rejects invalid entrypoint via Zod', () => {
    expect(() => validatePromotion(makeValidateParams({ entrypoint: 'invalid' as any }))).toThrow(
      ZodError
    );
  });

  it('defaults isHighImpact to false', () => {
    const result = validatePromotion(makeValidateParams({ isHighImpact: undefined }));
    expect(result.requiresReview).toBe(false);
  });
});

// ------------------------------------------
// addSyncedSourceRef (Decision W3-3)
// ------------------------------------------

describe('addSyncedSourceRef', () => {
  it('creates a synced source ref with all fields', async () => {
    const result = await addSyncedSourceRef(makeSyncParams());

    expect(result.refId).toBeDefined();
    expect(result.initiativeId).toBe(INITIATIVE_ID);
    expect(result.organizationId).toBe(ORG_A);
    expect(result.externalSourceId).toBe('jira-123');
    expect(result.externalSystem).toBe('jira');
    expect(result.syncStatus).toBe('active');
    expect(result.lastSyncedAt).toBe('2026-03-23T10:00:00.000Z');

    expect(mockDbRun).toHaveBeenCalledOnce();
    const sql = mockDbRun.mock.calls[0][0] as string;
    expect(sql).toContain('INSERT INTO v8_synced_source_refs');
  });

  it('defaults syncStatus to active', async () => {
    const result = await addSyncedSourceRef(makeSyncParams({ syncStatus: undefined }));
    expect(result.syncStatus).toBe('active');
  });

  it('allows null lastSyncedAt', async () => {
    const result = await addSyncedSourceRef(makeSyncParams({ lastSyncedAt: null }));
    expect(result.lastSyncedAt).toBeNull();
  });

  it('rejects empty externalSourceId via Zod', async () => {
    await expect(addSyncedSourceRef(makeSyncParams({ externalSourceId: '' }))).rejects.toThrow(
      ZodError
    );
  });

  it('rejects invalid syncStatus via Zod', async () => {
    await expect(
      addSyncedSourceRef(makeSyncParams({ syncStatus: 'invalid' as any }))
    ).rejects.toThrow(ZodError);
  });
});

// ------------------------------------------
// getSyncedSourceRefs
// ------------------------------------------

describe('getSyncedSourceRefs', () => {
  it('returns synced refs ordered by created_at', async () => {
    mockDbAll.mockResolvedValueOnce([
      makeSyncRow({ created_at: '2026-03-23T10:00:00.000Z' }),
      makeSyncRow({
        ref_id: 'ref-2',
        created_at: '2026-03-23T11:00:00.000Z',
        external_system: 'confluence',
      }),
    ]);

    const results = await getSyncedSourceRefs(INITIATIVE_ID, ORG_A);

    expect(results).toHaveLength(2);
    expect(results[0].externalSystem).toBe('jira');
    expect(results[1].externalSystem).toBe('confluence');
  });

  it('returns empty array when no refs exist', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    const results = await getSyncedSourceRefs(INITIATIVE_ID, ORG_A);
    expect(results).toEqual([]);
  });

  it('enforces organization isolation in query', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    await getSyncedSourceRefs(INITIATIVE_ID, ORG_B);

    const params = mockDbAll.mock.calls[0][1] as string[];
    expect(params).toContain(ORG_B);
  });
});

// ------------------------------------------
// updateSyncStatus
// ------------------------------------------

describe('updateSyncStatus', () => {
  it('updates sync status and returns updated ref', async () => {
    mockDbGet.mockResolvedValueOnce(makeSyncRow());

    const result = await updateSyncStatus(
      '00000000-0000-4000-8000-cccccccccccc',
      ORG_A,
      'stale',
      '2026-03-23T12:00:00.000Z'
    );

    expect(result).not.toBeNull();
    expect(result!.syncStatus).toBe('stale');
    expect(result!.lastSyncedAt).toBe('2026-03-23T12:00:00.000Z');

    expect(mockDbRun).toHaveBeenCalledOnce();
    const sql = mockDbRun.mock.calls[0][0] as string;
    expect(sql).toContain('UPDATE v8_synced_source_refs');
  });

  it('returns null when ref not found', async () => {
    mockDbGet.mockResolvedValueOnce(null);

    const result = await updateSyncStatus('nonexistent', ORG_A, 'disconnected');
    expect(result).toBeNull();
    expect(mockDbRun).not.toHaveBeenCalled();
  });

  it('preserves existing lastSyncedAt when not provided', async () => {
    mockDbGet.mockResolvedValueOnce(makeSyncRow({ last_synced_at: '2026-03-23T10:00:00.000Z' }));

    const result = await updateSyncStatus('00000000-0000-4000-8000-cccccccccccc', ORG_A, 'error');

    expect(result!.lastSyncedAt).toBe('2026-03-23T10:00:00.000Z');
  });
});

// ------------------------------------------
// Organization isolation (cross-cutting)
// ------------------------------------------

describe('organization isolation', () => {
  it('getSourcesByInitiative scopes to correct org', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    await getSourcesByInitiative(INITIATIVE_ID, ORG_B);

    const params = mockDbAll.mock.calls[0][1] as string[];
    expect(params[0]).toBe(INITIATIVE_ID);
    expect(params[1]).toBe(ORG_B);
  });

  it('getSyncedSourceRefs scopes to correct org', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    await getSyncedSourceRefs(INITIATIVE_ID, ORG_B);

    const params = mockDbAll.mock.calls[0][1] as string[];
    expect(params[0]).toBe(INITIATIVE_ID);
    expect(params[1]).toBe(ORG_B);
  });

  it('getMaterializationRecord scopes to correct org', async () => {
    mockDbGet.mockResolvedValueOnce(null);
    await getMaterializationRecord('some-id', ORG_B);

    const params = mockDbGet.mock.calls[0][1] as string[];
    expect(params[1]).toBe(ORG_B);
  });

  it('updateSyncStatus scopes to correct org', async () => {
    mockDbGet.mockResolvedValueOnce(null);
    await updateSyncStatus('some-id', ORG_B, 'active');

    const params = mockDbGet.mock.calls[0][1] as string[];
    expect(params[1]).toBe(ORG_B);
  });
});

// ------------------------------------------
// Entrypoint class mapping
// ------------------------------------------

describe('ENTRYPOINT_CLASS_MAP', () => {
  it('maps idea to derived_source', () => {
    expect(ENTRYPOINT_CLASS_MAP.idea).toBe('derived_source');
  });

  it('maps interview to derived_source', () => {
    expect(ENTRYPOINT_CLASS_MAP.interview).toBe('derived_source');
  });

  it('maps tools_assessment to native_source', () => {
    expect(ENTRYPOINT_CLASS_MAP.tools_assessment).toBe('native_source');
  });

  it('maps chat to derived_source', () => {
    expect(ENTRYPOINT_CLASS_MAP.chat).toBe('derived_source');
  });

  it('maps manual to derived_source', () => {
    expect(ENTRYPOINT_CLASS_MAP.manual).toBe('derived_source');
  });

  it('covers all entrypoint values', () => {
    for (const ep of InitiativeEntrypointValues) {
      expect(ENTRYPOINT_CLASS_MAP[ep]).toBeDefined();
    }
  });
});

// ------------------------------------------
// Zod schema validation
// ------------------------------------------

describe('Zod schema validation', () => {
  it('validates a correct SourceMaterializationRecord', () => {
    const valid: SourceMaterializationRecord = {
      recordId: '00000000-0000-4000-8000-bbbbbbbbbbbb',
      initiativeId: INITIATIVE_ID,
      organizationId: ORG_A,
      entrypoint: 'idea',
      entrypointClass: 'derived_source',
      sourceArtifactId: ARTIFACT_ID,
      sourceArtifactType: 'ToolSession',
      contextSnapshotId: SNAPSHOT_ID,
      materializationMode: 'invisible',
      evidenceClass: 'strong',
      promotedBy: USER_ID,
      promotedAt: '2026-03-23T10:00:00.000Z',
      createdAt: '2026-03-23T10:00:00.000Z',
    };

    expect(() => SourceMaterializationRecordSchema.parse(valid)).not.toThrow();
  });

  it('validates a correct SyncedSourceRef', () => {
    const valid: SyncedSourceRef = {
      refId: '00000000-0000-4000-8000-cccccccccccc',
      initiativeId: INITIATIVE_ID,
      organizationId: ORG_A,
      externalSourceId: 'jira-123',
      externalSystem: 'jira',
      syncStatus: 'active',
      lastSyncedAt: '2026-03-23T10:00:00.000Z',
      createdAt: '2026-03-23T10:00:00.000Z',
    };

    expect(() => SyncedSourceRefSchema.parse(valid)).not.toThrow();
  });

  it('validates a correct PromotionValidation', () => {
    const valid = {
      isAllowed: true,
      evidenceSufficient: true,
      requiresReview: false,
      reasons: [],
    };

    expect(() => PromotionValidationSchema.parse(valid)).not.toThrow();
  });

  it('rejects SourceMaterializationRecord with invalid entrypoint', () => {
    expect(() =>
      SourceMaterializationRecordSchema.parse({
        recordId: '00000000-0000-4000-8000-bbbbbbbbbbbb',
        initiativeId: INITIATIVE_ID,
        organizationId: ORG_A,
        entrypoint: 'invalid_entrypoint',
        entrypointClass: 'derived_source',
        sourceArtifactId: ARTIFACT_ID,
        sourceArtifactType: 'ToolSession',
        contextSnapshotId: null,
        materializationMode: 'invisible',
        evidenceClass: 'strong',
        promotedBy: USER_ID,
        promotedAt: '2026-03-23T10:00:00.000Z',
        createdAt: '2026-03-23T10:00:00.000Z',
      })
    ).toThrow(ZodError);
  });

  it('rejects SyncedSourceRef with invalid syncStatus', () => {
    expect(() =>
      SyncedSourceRefSchema.parse({
        refId: '00000000-0000-4000-8000-cccccccccccc',
        initiativeId: INITIATIVE_ID,
        organizationId: ORG_A,
        externalSourceId: 'jira-123',
        externalSystem: 'jira',
        syncStatus: 'invalid_status',
        lastSyncedAt: null,
        createdAt: '2026-03-23T10:00:00.000Z',
      })
    ).toThrow(ZodError);
  });

  it('validates RecordMaterializationParams', () => {
    expect(() => RecordMaterializationParamsSchema.parse(makeMatParams())).not.toThrow();
  });

  it('validates AddSyncedSourceRefParams', () => {
    expect(() => AddSyncedSourceRefParamsSchema.parse(makeSyncParams())).not.toThrow();
  });

  it('validates ValidatePromotionParams', () => {
    const valid: ValidatePromotionParams = {
      organizationId: ORG_A,
      promotedBy: USER_ID,
      entrypoint: 'interview',
      evidenceClass: 'strong',
      hasPermission: true,
      isHighImpact: false,
    };
    expect(() => ValidatePromotionParamsSchema.parse(valid)).not.toThrow();
  });

  it('validates all InitiativeEntrypoint values are accepted', () => {
    for (const ep of InitiativeEntrypointValues) {
      const params = makeMatParams({ entrypoint: ep });
      expect(() => RecordMaterializationParamsSchema.parse(params)).not.toThrow();
    }
  });

  it('validates all EvidenceClass values are accepted', () => {
    for (const ec of EvidenceClassValues) {
      const params = makeMatParams({ evidenceClass: ec });
      expect(() => RecordMaterializationParamsSchema.parse(params)).not.toThrow();
    }
  });

  it('validates all SyncStatus values are accepted', () => {
    for (const ss of SyncStatusValues) {
      const params = makeSyncParams({ syncStatus: ss });
      expect(() => AddSyncedSourceRefParamsSchema.parse(params)).not.toThrow();
    }
  });
});
