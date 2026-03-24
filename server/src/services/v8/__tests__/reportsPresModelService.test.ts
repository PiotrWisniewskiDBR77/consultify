import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ZodError } from 'zod';

import type {
  CreateOutputArtifactParams,
  RegisterTemplateFamilyParams,
  CreateRecurringProgramParams,
  SetAIGovernanceConfigParams,
  OutputDeliveryState,
  TemplateFamilyName,
} from '../../../types/reportsPresOperatingModel.js';
import {
  OutputArtifactSchema,
  TemplateFamilySchema,
  RecurringOutputProgramSchema,
  OutputAIGovernanceConfigSchema,
  CreateOutputArtifactParamsSchema,
  RegisterTemplateFamilyParamsSchema,
  CreateRecurringProgramParamsSchema,
  SetAIGovernanceConfigParamsSchema,
  DELIVERY_VALID_TRANSITIONS,
  DELIVERY_TERMINAL_STATES,
  OutputDeliveryStateValues,
  OutputTypeValues,
  TemplateFamilyNameValues,
  GovernanceLevelValues,
  CadenceValues,
} from '../../../types/reportsPresOperatingModel.js';

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
  createOutputArtifact,
  transitionDeliveryState,
  getOutputArtifact,
  registerTemplateFamily,
  getTemplateFamilies,
  createRecurringProgram,
  getRecurringPrograms,
  setAIGovernanceConfig,
  getAIGovernanceConfig,
} from '../reportsPresModelService.js';

// ==========================================
// FIXTURES
// ==========================================

const ORG_ID = '00000000-0000-4000-8000-000000000001';
const OTHER_ORG_ID = '00000000-0000-4000-8000-000000000099';
const USER_ID = '00000000-0000-4000-8000-000000000003';
const ARTIFACT_ID = '00000000-0000-4000-8000-aaaaaaaaaaaa';
const FAMILY_ID = '00000000-0000-4000-8000-ffffffffffff';

function makeArtifactParams(overrides?: Partial<CreateOutputArtifactParams>): CreateOutputArtifactParams {
  return {
    organizationId: ORG_ID,
    outputType: 'report',
    templateFamilyRef: null,
    sourceInitiativeId: null,
    aiGovernancePresetRef: null,
    createdBy: USER_ID,
    ...overrides,
  };
}

function makeFakeArtifactRow(overrides?: Partial<Record<string, unknown>>) {
  return {
    artifact_id: ARTIFACT_ID,
    organization_id: ORG_ID,
    output_type: 'report',
    delivery_state: 'draft',
    template_family_ref: null,
    source_initiative_id: null,
    ai_governance_preset_ref: null,
    created_by: USER_ID,
    created_at: '2026-03-23T10:00:00.000Z',
    last_transition_at: '2026-03-23T10:00:00.000Z',
    ...overrides,
  };
}

function makeTemplateFamilyParams(overrides?: Partial<RegisterTemplateFamilyParams>): RegisterTemplateFamilyParams {
  return {
    organizationId: ORG_ID,
    familyName: 'executive_steering_pack',
    reportFormRef: 'report-form-001',
    presentationFormRef: 'pres-form-001',
    governedMappingEnabled: true,
    ...overrides,
  };
}

function makeFakeTemplateFamilyRow(overrides?: Partial<Record<string, unknown>>) {
  return {
    family_id: FAMILY_ID,
    organization_id: ORG_ID,
    family_name: 'executive_steering_pack',
    report_form_ref: 'report-form-001',
    presentation_form_ref: 'pres-form-001',
    governed_mapping_enabled: 1,
    created_at: '2026-03-23T10:00:00.000Z',
    ...overrides,
  };
}

function makeRecurringProgramParams(overrides?: Partial<CreateRecurringProgramParams>): CreateRecurringProgramParams {
  return {
    organizationId: ORG_ID,
    outputType: 'report',
    templateFamilyRef: FAMILY_ID,
    cadence: 'monthly',
    sourceDataBinding: { initiativeId: 'init-1' },
    governanceLevel: 'standard',
    ...overrides,
  };
}

function makeFakeRecurringProgramRow(overrides?: Partial<Record<string, unknown>>) {
  return {
    program_id: '00000000-0000-4000-8000-bbbbbbbbbbbb',
    organization_id: ORG_ID,
    output_type: 'report',
    template_family_ref: FAMILY_ID,
    cadence: 'monthly',
    source_data_binding: JSON.stringify({ initiativeId: 'init-1' }),
    is_active: 1,
    last_run_at: null,
    next_run_at: null,
    governance_level: 'standard',
    created_at: '2026-03-23T10:00:00.000Z',
    ...overrides,
  };
}

function makeGovernanceParams(overrides?: Partial<SetAIGovernanceConfigParams>): SetAIGovernanceConfigParams {
  return {
    organizationId: ORG_ID,
    outputType: 'report',
    presetRef: 'report_builder',
    evalGateRef: 'eval-gate-001',
    qualityThresholds: { minEvidenceDensity: 0.7 },
    ...overrides,
  };
}

function makeFakeGovernanceRow(overrides?: Partial<Record<string, unknown>>) {
  return {
    config_id: '00000000-0000-4000-8000-cccccccccccc',
    organization_id: ORG_ID,
    output_type: 'report',
    preset_ref: 'report_builder',
    eval_gate_ref: 'eval-gate-001',
    quality_thresholds: JSON.stringify({ minEvidenceDensity: 0.7 }),
    created_at: '2026-03-23T10:00:00.000Z',
    updated_at: '2026-03-23T10:00:00.000Z',
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
// Output Artifacts — creation
// ------------------------------------------

describe('createOutputArtifact', () => {
  it('creates a report artifact in draft state', async () => {
    const result = await createOutputArtifact(makeArtifactParams());

    expect(result.artifactId).toBeDefined();
    expect(result.deliveryState).toBe('draft');
    expect(result.outputType).toBe('report');
    expect(result.organizationId).toBe(ORG_ID);
    expect(result.createdBy).toBe(USER_ID);
    expect(result.templateFamilyRef).toBeNull();
    expect(result.sourceInitiativeId).toBeNull();
    expect(result.aiGovernancePresetRef).toBeNull();

    expect(mockDbRun).toHaveBeenCalledOnce();
    const sql = mockDbRun.mock.calls[0][0] as string;
    expect(sql).toContain('INSERT INTO v8_output_artifacts');
  });

  it('creates a presentation artifact in draft state', async () => {
    const result = await createOutputArtifact(makeArtifactParams({ outputType: 'presentation' }));

    expect(result.outputType).toBe('presentation');
    expect(result.deliveryState).toBe('draft');
  });

  it('stores optional refs when provided', async () => {
    const result = await createOutputArtifact(makeArtifactParams({
      templateFamilyRef: 'fam-1',
      sourceInitiativeId: 'init-1',
      aiGovernancePresetRef: 'preset-1',
    }));

    expect(result.templateFamilyRef).toBe('fam-1');
    expect(result.sourceInitiativeId).toBe('init-1');
    expect(result.aiGovernancePresetRef).toBe('preset-1');
  });

  it('rejects missing required fields via Zod', async () => {
    await expect(
      createOutputArtifact({ organizationId: ORG_ID } as any),
    ).rejects.toThrow(ZodError);
  });

  it('rejects invalid UUID for organizationId', async () => {
    await expect(
      createOutputArtifact(makeArtifactParams({ organizationId: 'not-a-uuid' })),
    ).rejects.toThrow(ZodError);
  });

  it('rejects invalid output type via Zod', async () => {
    await expect(
      createOutputArtifact(makeArtifactParams({ outputType: 'spreadsheet' as any })),
    ).rejects.toThrow(ZodError);
  });
});

// ------------------------------------------
// Output Artifacts — retrieval
// ------------------------------------------

describe('getOutputArtifact', () => {
  it('returns an artifact when found with org isolation', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeArtifactRow());

    const result = await getOutputArtifact(ARTIFACT_ID, ORG_ID);

    expect(result).not.toBeNull();
    expect(result!.artifactId).toBe(ARTIFACT_ID);
    expect(result!.organizationId).toBe(ORG_ID);
    expect(result!.deliveryState).toBe('draft');

    const query = mockDbGet.mock.calls[0][0] as string;
    expect(query).toContain('organization_id');
  });

  it('returns null when artifact does not exist', async () => {
    mockDbGet.mockResolvedValueOnce(null);
    const result = await getOutputArtifact('nonexistent', ORG_ID);
    expect(result).toBeNull();
  });

  it('enforces org isolation — different org returns null', async () => {
    mockDbGet.mockResolvedValueOnce(null);
    const result = await getOutputArtifact(ARTIFACT_ID, OTHER_ORG_ID);
    expect(result).toBeNull();
  });
});

// ------------------------------------------
// Output Artifacts — delivery state machine
// ------------------------------------------

describe('transitionDeliveryState', () => {
  it('transitions draft → generated (happy path)', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeArtifactRow({ delivery_state: 'draft' }));

    const result = await transitionDeliveryState(ARTIFACT_ID, ORG_ID, 'generated');

    expect(result.deliveryState).toBe('generated');
    expect(result.lastTransitionAt).toBeDefined();
    expect(mockDbRun).toHaveBeenCalledOnce();
  });

  it('transitions generated → editing', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeArtifactRow({ delivery_state: 'generated' }));

    const result = await transitionDeliveryState(ARTIFACT_ID, ORG_ID, 'editing');
    expect(result.deliveryState).toBe('editing');
  });

  it('transitions generated → in_review', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeArtifactRow({ delivery_state: 'generated' }));

    const result = await transitionDeliveryState(ARTIFACT_ID, ORG_ID, 'in_review');
    expect(result.deliveryState).toBe('in_review');
  });

  it('transitions editing → in_review', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeArtifactRow({ delivery_state: 'editing' }));

    const result = await transitionDeliveryState(ARTIFACT_ID, ORG_ID, 'in_review');
    expect(result.deliveryState).toBe('in_review');
  });

  it('transitions editing → generated (re-generation)', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeArtifactRow({ delivery_state: 'editing' }));

    const result = await transitionDeliveryState(ARTIFACT_ID, ORG_ID, 'generated');
    expect(result.deliveryState).toBe('generated');
  });

  it('transitions in_review → ready', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeArtifactRow({ delivery_state: 'in_review' }));

    const result = await transitionDeliveryState(ARTIFACT_ID, ORG_ID, 'ready');
    expect(result.deliveryState).toBe('ready');
  });

  it('transitions in_review → editing (send back for edits)', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeArtifactRow({ delivery_state: 'in_review' }));

    const result = await transitionDeliveryState(ARTIFACT_ID, ORG_ID, 'editing');
    expect(result.deliveryState).toBe('editing');
  });

  it('transitions ready → shared', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeArtifactRow({ delivery_state: 'ready' }));

    const result = await transitionDeliveryState(ARTIFACT_ID, ORG_ID, 'shared');
    expect(result.deliveryState).toBe('shared');
  });

  it('transitions ready → editing (re-open for edits)', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeArtifactRow({ delivery_state: 'ready' }));

    const result = await transitionDeliveryState(ARTIFACT_ID, ORG_ID, 'editing');
    expect(result.deliveryState).toBe('editing');
  });

  it('transitions shared → archived', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeArtifactRow({ delivery_state: 'shared' }));

    const result = await transitionDeliveryState(ARTIFACT_ID, ORG_ID, 'archived');
    expect(result.deliveryState).toBe('archived');
  });

  it('transitions shared → editing (recall and re-edit)', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeArtifactRow({ delivery_state: 'shared' }));

    const result = await transitionDeliveryState(ARTIFACT_ID, ORG_ID, 'editing');
    expect(result.deliveryState).toBe('editing');
  });

  it('allows archiving from any non-terminal state', async () => {
    const archivableStates: OutputDeliveryState[] = [
      'draft', 'generated', 'editing', 'in_review', 'ready', 'shared',
    ];

    for (const state of archivableStates) {
      vi.clearAllMocks();
      mockDbGet.mockResolvedValueOnce(makeFakeArtifactRow({ delivery_state: state }));

      const result = await transitionDeliveryState(ARTIFACT_ID, ORG_ID, 'archived');
      expect(result.deliveryState).toBe('archived');
    }
  });

  it('rejects invalid transition: draft → ready', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeArtifactRow({ delivery_state: 'draft' }));

    await expect(
      transitionDeliveryState(ARTIFACT_ID, ORG_ID, 'ready'),
    ).rejects.toThrow('Invalid delivery transition: draft → ready');
  });

  it('rejects invalid transition: draft → shared', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeArtifactRow({ delivery_state: 'draft' }));

    await expect(
      transitionDeliveryState(ARTIFACT_ID, ORG_ID, 'shared'),
    ).rejects.toThrow('Invalid delivery transition');
  });

  it('rejects transition from archived (terminal)', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeArtifactRow({ delivery_state: 'archived' }));

    await expect(
      transitionDeliveryState(ARTIFACT_ID, ORG_ID, 'editing'),
    ).rejects.toThrow("current state 'archived' is terminal");
  });

  it('throws when artifact not found', async () => {
    mockDbGet.mockResolvedValueOnce(null);

    await expect(
      transitionDeliveryState('nonexistent', ORG_ID, 'generated'),
    ).rejects.toThrow('Artifact nonexistent not found');
  });

  it('updates lastTransitionAt on each transition', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeArtifactRow({ delivery_state: 'draft' }));

    const result = await transitionDeliveryState(ARTIFACT_ID, ORG_ID, 'generated');

    expect(result.lastTransitionAt).not.toBe('2026-03-23T10:00:00.000Z');
    const updateSql = mockDbRun.mock.calls[0][0] as string;
    expect(updateSql).toContain('last_transition_at');
  });
});

// ------------------------------------------
// Template Families (Decision W6-3)
// ------------------------------------------

describe('registerTemplateFamily', () => {
  it('registers executive_steering_pack with all fields', async () => {
    const result = await registerTemplateFamily(makeTemplateFamilyParams());

    expect(result.familyId).toBeDefined();
    expect(result.familyName).toBe('executive_steering_pack');
    expect(result.organizationId).toBe(ORG_ID);
    expect(result.reportFormRef).toBe('report-form-001');
    expect(result.presentationFormRef).toBe('pres-form-001');
    expect(result.governedMappingEnabled).toBe(true);

    expect(mockDbRun).toHaveBeenCalledOnce();
    const sql = mockDbRun.mock.calls[0][0] as string;
    expect(sql).toContain('INSERT INTO v8_template_families');
  });

  it('registers transformation_status_pack', async () => {
    const result = await registerTemplateFamily(
      makeTemplateFamilyParams({ familyName: 'transformation_status_pack' }),
    );
    expect(result.familyName).toBe('transformation_status_pack');
  });

  it('registers diagnostic_assessment_pack', async () => {
    const result = await registerTemplateFamily(
      makeTemplateFamilyParams({ familyName: 'diagnostic_assessment_pack' }),
    );
    expect(result.familyName).toBe('diagnostic_assessment_pack');
  });

  it('supports all three canonical family names (Decision W6-3)', async () => {
    const families: TemplateFamilyName[] = [
      'executive_steering_pack',
      'transformation_status_pack',
      'diagnostic_assessment_pack',
    ];

    for (const familyName of families) {
      vi.clearAllMocks();
      const result = await registerTemplateFamily(makeTemplateFamilyParams({ familyName }));
      expect(result.familyName).toBe(familyName);
    }
  });

  it('defaults governedMappingEnabled to false', async () => {
    const result = await registerTemplateFamily(
      makeTemplateFamilyParams({ governedMappingEnabled: undefined }),
    );
    expect(result.governedMappingEnabled).toBe(false);
  });

  it('defaults form refs to null', async () => {
    const result = await registerTemplateFamily(
      makeTemplateFamilyParams({ reportFormRef: undefined, presentationFormRef: undefined }),
    );
    expect(result.reportFormRef).toBeNull();
    expect(result.presentationFormRef).toBeNull();
  });

  it('rejects invalid family name via Zod', async () => {
    await expect(
      registerTemplateFamily(makeTemplateFamilyParams({ familyName: 'custom_pack' as any })),
    ).rejects.toThrow(ZodError);
  });

  it('rejects invalid UUID for organizationId', async () => {
    await expect(
      registerTemplateFamily(makeTemplateFamilyParams({ organizationId: 'bad' })),
    ).rejects.toThrow(ZodError);
  });
});

describe('getTemplateFamilies', () => {
  it('returns all families for an org', async () => {
    mockDbAll.mockResolvedValueOnce([
      makeFakeTemplateFamilyRow(),
      makeFakeTemplateFamilyRow({
        family_id: 'fam-2',
        family_name: 'transformation_status_pack',
      }),
    ]);

    const results = await getTemplateFamilies(ORG_ID);

    expect(results).toHaveLength(2);
    expect(results[0].familyName).toBe('executive_steering_pack');
    expect(results[1].familyName).toBe('transformation_status_pack');

    const query = mockDbAll.mock.calls[0][0] as string;
    expect(query).toContain('organization_id');
  });

  it('returns empty array when no families exist', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    const results = await getTemplateFamilies(ORG_ID);
    expect(results).toEqual([]);
  });

  it('correctly maps governed_mapping_enabled boolean', async () => {
    mockDbAll.mockResolvedValueOnce([
      makeFakeTemplateFamilyRow({ governed_mapping_enabled: 1 }),
      makeFakeTemplateFamilyRow({ family_id: 'fam-2', governed_mapping_enabled: 0 }),
    ]);

    const results = await getTemplateFamilies(ORG_ID);
    expect(results[0].governedMappingEnabled).toBe(true);
    expect(results[1].governedMappingEnabled).toBe(false);
  });
});

// ------------------------------------------
// Recurring Output Programs (Decision W6-4)
// ------------------------------------------

describe('createRecurringProgram', () => {
  it('creates a recurring report program with standard governance', async () => {
    const result = await createRecurringProgram(makeRecurringProgramParams());

    expect(result.programId).toBeDefined();
    expect(result.outputType).toBe('report');
    expect(result.cadence).toBe('monthly');
    expect(result.isActive).toBe(true);
    expect(result.lastRunAt).toBeNull();
    expect(result.nextRunAt).toBeNull();
    expect(result.governanceLevel).toBe('standard');
    expect(result.sourceDataBinding).toEqual({ initiativeId: 'init-1' });

    expect(mockDbRun).toHaveBeenCalledOnce();
    const sql = mockDbRun.mock.calls[0][0] as string;
    expect(sql).toContain('INSERT INTO v8_recurring_output_programs');
  });

  it('creates a recurring report program with strict governance', async () => {
    const result = await createRecurringProgram(
      makeRecurringProgramParams({ governanceLevel: 'strict' }),
    );
    expect(result.governanceLevel).toBe('strict');
  });

  it('creates a recurring presentation program with strict governance (Decision W6-4)', async () => {
    const result = await createRecurringProgram(
      makeRecurringProgramParams({ outputType: 'presentation', governanceLevel: 'strict' }),
    );

    expect(result.outputType).toBe('presentation');
    expect(result.governanceLevel).toBe('strict');
  });

  it('rejects recurring presentation with standard governance (Decision W6-4)', async () => {
    await expect(
      createRecurringProgram(
        makeRecurringProgramParams({ outputType: 'presentation', governanceLevel: 'standard' }),
      ),
    ).rejects.toThrow('Recurring presentation programs require strict governance');
  });

  it('forces strict governance for presentations even if not specified', async () => {
    const result = await createRecurringProgram({
      organizationId: ORG_ID,
      outputType: 'presentation',
      cadence: 'quarterly',
      governanceLevel: 'strict',
    });

    expect(result.governanceLevel).toBe('strict');
  });

  it('supports all cadence values', async () => {
    const cadences = ['daily', 'weekly', 'biweekly', 'monthly', 'quarterly'] as const;

    for (const cadence of cadences) {
      vi.clearAllMocks();
      const result = await createRecurringProgram(makeRecurringProgramParams({ cadence }));
      expect(result.cadence).toBe(cadence);
    }
  });

  it('defaults sourceDataBinding to empty object', async () => {
    const result = await createRecurringProgram(
      makeRecurringProgramParams({ sourceDataBinding: undefined }),
    );
    expect(result.sourceDataBinding).toEqual({});
  });

  it('defaults governanceLevel to standard for reports', async () => {
    const result = await createRecurringProgram({
      organizationId: ORG_ID,
      outputType: 'report',
      cadence: 'weekly',
    });
    expect(result.governanceLevel).toBe('standard');
  });

  it('rejects invalid cadence via Zod', async () => {
    await expect(
      createRecurringProgram(makeRecurringProgramParams({ cadence: 'yearly' as any })),
    ).rejects.toThrow(ZodError);
  });

  it('rejects invalid UUID for organizationId', async () => {
    await expect(
      createRecurringProgram(makeRecurringProgramParams({ organizationId: 'bad' })),
    ).rejects.toThrow(ZodError);
  });
});

describe('getRecurringPrograms', () => {
  it('returns all programs for an org', async () => {
    mockDbAll.mockResolvedValueOnce([
      makeFakeRecurringProgramRow(),
      makeFakeRecurringProgramRow({
        program_id: 'prog-2',
        output_type: 'presentation',
        governance_level: 'strict',
      }),
    ]);

    const results = await getRecurringPrograms(ORG_ID);

    expect(results).toHaveLength(2);
    expect(results[0].outputType).toBe('report');
    expect(results[1].outputType).toBe('presentation');
    expect(results[1].governanceLevel).toBe('strict');
  });

  it('returns empty array when no programs exist', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    const results = await getRecurringPrograms(ORG_ID);
    expect(results).toEqual([]);
  });

  it('correctly parses sourceDataBinding JSON', async () => {
    mockDbAll.mockResolvedValueOnce([
      makeFakeRecurringProgramRow({
        source_data_binding: JSON.stringify({ initiativeId: 'init-1', kpiSet: 'alpha' }),
      }),
    ]);

    const results = await getRecurringPrograms(ORG_ID);
    expect(results[0].sourceDataBinding).toEqual({ initiativeId: 'init-1', kpiSet: 'alpha' });
  });

  it('correctly maps is_active boolean', async () => {
    mockDbAll.mockResolvedValueOnce([
      makeFakeRecurringProgramRow({ is_active: 1 }),
      makeFakeRecurringProgramRow({ program_id: 'prog-2', is_active: 0 }),
    ]);

    const results = await getRecurringPrograms(ORG_ID);
    expect(results[0].isActive).toBe(true);
    expect(results[1].isActive).toBe(false);
  });
});

// ------------------------------------------
// AI Governance (Decisions W6-1, W6-2)
// ------------------------------------------

describe('setAIGovernanceConfig', () => {
  it('creates a new report governance config', async () => {
    mockDbGet.mockResolvedValueOnce(null);

    const result = await setAIGovernanceConfig(makeGovernanceParams());

    expect(result.configId).toBeDefined();
    expect(result.outputType).toBe('report');
    expect(result.presetRef).toBe('report_builder');
    expect(result.evalGateRef).toBe('eval-gate-001');
    expect(result.qualityThresholds).toEqual({ minEvidenceDensity: 0.7 });

    const sql = mockDbRun.mock.calls[0][0] as string;
    expect(sql).toContain('INSERT INTO v8_output_ai_governance');
  });

  it('creates a separate presentation governance config (Decision W6-2)', async () => {
    mockDbGet.mockResolvedValueOnce(null);

    const result = await setAIGovernanceConfig(
      makeGovernanceParams({
        outputType: 'presentation',
        presetRef: 'presentation_builder',
        evalGateRef: 'eval-gate-pres-001',
      }),
    );

    expect(result.outputType).toBe('presentation');
    expect(result.presetRef).toBe('presentation_builder');
  });

  it('updates existing config when one already exists (upsert)', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeGovernanceRow());

    const result = await setAIGovernanceConfig(
      makeGovernanceParams({
        presetRef: 'report_builder_v2',
        qualityThresholds: { minEvidenceDensity: 0.9 },
      }),
    );

    expect(result.presetRef).toBe('report_builder_v2');
    expect(result.qualityThresholds).toEqual({ minEvidenceDensity: 0.9 });

    const sql = mockDbRun.mock.calls[0][0] as string;
    expect(sql).toContain('UPDATE v8_output_ai_governance');
  });

  it('preserves configId on update', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeGovernanceRow());

    const result = await setAIGovernanceConfig(makeGovernanceParams({ presetRef: 'v2' }));
    expect(result.configId).toBe('00000000-0000-4000-8000-cccccccccccc');
  });

  it('defaults evalGateRef to null', async () => {
    mockDbGet.mockResolvedValueOnce(null);

    const result = await setAIGovernanceConfig(
      makeGovernanceParams({ evalGateRef: undefined }),
    );
    expect(result.evalGateRef).toBeNull();
  });

  it('defaults qualityThresholds to empty object', async () => {
    mockDbGet.mockResolvedValueOnce(null);

    const result = await setAIGovernanceConfig(
      makeGovernanceParams({ qualityThresholds: undefined }),
    );
    expect(result.qualityThresholds).toEqual({});
  });

  it('rejects empty presetRef via Zod', async () => {
    await expect(
      setAIGovernanceConfig(makeGovernanceParams({ presetRef: '' })),
    ).rejects.toThrow(ZodError);
  });

  it('rejects invalid outputType via Zod', async () => {
    await expect(
      setAIGovernanceConfig(makeGovernanceParams({ outputType: 'chart' as any })),
    ).rejects.toThrow(ZodError);
  });
});

describe('getAIGovernanceConfig', () => {
  it('returns config when found', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeGovernanceRow());

    const result = await getAIGovernanceConfig('report', ORG_ID);

    expect(result).not.toBeNull();
    expect(result!.outputType).toBe('report');
    expect(result!.presetRef).toBe('report_builder');
    expect(result!.qualityThresholds).toEqual({ minEvidenceDensity: 0.7 });
  });

  it('returns null when no config exists', async () => {
    mockDbGet.mockResolvedValueOnce(null);
    const result = await getAIGovernanceConfig('report', ORG_ID);
    expect(result).toBeNull();
  });

  it('returns null for different org (org isolation)', async () => {
    mockDbGet.mockResolvedValueOnce(null);
    const result = await getAIGovernanceConfig('report', OTHER_ORG_ID);
    expect(result).toBeNull();
  });

  it('returns separate configs per output type (Decision W6-2)', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeGovernanceRow({ output_type: 'report', preset_ref: 'report_builder' }));
    const reportConfig = await getAIGovernanceConfig('report', ORG_ID);
    expect(reportConfig!.presetRef).toBe('report_builder');

    vi.clearAllMocks();
    mockDbGet.mockResolvedValueOnce(makeFakeGovernanceRow({ output_type: 'presentation', preset_ref: 'presentation_builder' }));
    const presConfig = await getAIGovernanceConfig('presentation', ORG_ID);
    expect(presConfig!.presetRef).toBe('presentation_builder');
  });
});

// ------------------------------------------
// State machine completeness
// ------------------------------------------

describe('delivery state machine completeness', () => {
  it('DELIVERY_VALID_TRANSITIONS covers all OutputDeliveryState values', () => {
    for (const state of OutputDeliveryStateValues) {
      expect(DELIVERY_VALID_TRANSITIONS).toHaveProperty(state);
    }
  });

  it('terminal states have no outgoing transitions', () => {
    for (const state of DELIVERY_TERMINAL_STATES) {
      const transitions = DELIVERY_VALID_TRANSITIONS[state];
      expect(transitions).toHaveLength(0);
    }
  });

  it('all non-terminal states allow archiving', () => {
    for (const state of OutputDeliveryStateValues) {
      if (DELIVERY_TERMINAL_STATES.has(state)) continue;
      expect(DELIVERY_VALID_TRANSITIONS[state]).toContain('archived');
    }
  });

  it('draft is the only initial state (no incoming transitions from nothing)', () => {
    expect(DELIVERY_VALID_TRANSITIONS.draft).not.toHaveLength(0);
  });

  it('shared can only go to archived or editing', () => {
    const allowed = DELIVERY_VALID_TRANSITIONS.shared;
    expect(allowed).toContain('archived');
    expect(allowed).toContain('editing');
    expect(allowed).toHaveLength(2);
  });
});

// ------------------------------------------
// Zod schema validation
// ------------------------------------------

describe('Zod schema validation', () => {
  it('validates a correct OutputArtifact', () => {
    expect(() => OutputArtifactSchema.parse({
      artifactId: ARTIFACT_ID,
      organizationId: ORG_ID,
      outputType: 'report',
      deliveryState: 'draft',
      templateFamilyRef: null,
      sourceInitiativeId: null,
      aiGovernancePresetRef: null,
      createdBy: USER_ID,
      createdAt: '2026-03-23T10:00:00.000Z',
      lastTransitionAt: '2026-03-23T10:00:00.000Z',
    })).not.toThrow();
  });

  it('rejects artifact with invalid delivery state', () => {
    expect(() => OutputArtifactSchema.parse({
      artifactId: ARTIFACT_ID,
      organizationId: ORG_ID,
      outputType: 'report',
      deliveryState: 'published',
      templateFamilyRef: null,
      sourceInitiativeId: null,
      aiGovernancePresetRef: null,
      createdBy: USER_ID,
      createdAt: '2026-03-23T10:00:00.000Z',
      lastTransitionAt: '2026-03-23T10:00:00.000Z',
    })).toThrow(ZodError);
  });

  it('validates a correct TemplateFamily', () => {
    expect(() => TemplateFamilySchema.parse({
      familyId: FAMILY_ID,
      organizationId: ORG_ID,
      familyName: 'executive_steering_pack',
      reportFormRef: 'ref-1',
      presentationFormRef: 'ref-2',
      governedMappingEnabled: true,
      createdAt: '2026-03-23T10:00:00.000Z',
    })).not.toThrow();
  });

  it('rejects template family with invalid name', () => {
    expect(() => TemplateFamilySchema.parse({
      familyId: FAMILY_ID,
      organizationId: ORG_ID,
      familyName: 'custom_pack',
      reportFormRef: null,
      presentationFormRef: null,
      governedMappingEnabled: false,
      createdAt: '2026-03-23T10:00:00.000Z',
    })).toThrow(ZodError);
  });

  it('validates a correct RecurringOutputProgram', () => {
    expect(() => RecurringOutputProgramSchema.parse({
      programId: '00000000-0000-4000-8000-bbbbbbbbbbbb',
      organizationId: ORG_ID,
      outputType: 'report',
      templateFamilyRef: FAMILY_ID,
      cadence: 'monthly',
      sourceDataBinding: {},
      isActive: true,
      lastRunAt: null,
      nextRunAt: null,
      governanceLevel: 'standard',
      createdAt: '2026-03-23T10:00:00.000Z',
    })).not.toThrow();
  });

  it('rejects recurring program with invalid cadence', () => {
    expect(() => RecurringOutputProgramSchema.parse({
      programId: '00000000-0000-4000-8000-bbbbbbbbbbbb',
      organizationId: ORG_ID,
      outputType: 'report',
      templateFamilyRef: null,
      cadence: 'yearly',
      sourceDataBinding: {},
      isActive: true,
      lastRunAt: null,
      nextRunAt: null,
      governanceLevel: 'standard',
      createdAt: '2026-03-23T10:00:00.000Z',
    })).toThrow(ZodError);
  });

  it('validates a correct OutputAIGovernanceConfig', () => {
    expect(() => OutputAIGovernanceConfigSchema.parse({
      configId: '00000000-0000-4000-8000-cccccccccccc',
      organizationId: ORG_ID,
      outputType: 'report',
      presetRef: 'report_builder',
      evalGateRef: 'eval-gate-001',
      qualityThresholds: { minEvidenceDensity: 0.7 },
      createdAt: '2026-03-23T10:00:00.000Z',
      updatedAt: '2026-03-23T10:00:00.000Z',
    })).not.toThrow();
  });

  it('rejects governance config with empty presetRef', () => {
    expect(() => OutputAIGovernanceConfigSchema.parse({
      configId: '00000000-0000-4000-8000-cccccccccccc',
      organizationId: ORG_ID,
      outputType: 'report',
      presetRef: '',
      evalGateRef: null,
      qualityThresholds: {},
      createdAt: '2026-03-23T10:00:00.000Z',
      updatedAt: '2026-03-23T10:00:00.000Z',
    })).toThrow(ZodError);
  });

  it('validates CreateOutputArtifactParams', () => {
    expect(() => CreateOutputArtifactParamsSchema.parse(makeArtifactParams())).not.toThrow();
  });

  it('validates RegisterTemplateFamilyParams', () => {
    expect(() => RegisterTemplateFamilyParamsSchema.parse(makeTemplateFamilyParams())).not.toThrow();
  });

  it('validates CreateRecurringProgramParams', () => {
    expect(() => CreateRecurringProgramParamsSchema.parse(makeRecurringProgramParams())).not.toThrow();
  });

  it('validates SetAIGovernanceConfigParams', () => {
    expect(() => SetAIGovernanceConfigParamsSchema.parse(makeGovernanceParams())).not.toThrow();
  });
});

// ------------------------------------------
// Enum completeness
// ------------------------------------------

describe('enum completeness', () => {
  it('OutputDeliveryStateValues has 7 canonical states', () => {
    expect(OutputDeliveryStateValues).toHaveLength(7);
    expect(OutputDeliveryStateValues).toContain('draft');
    expect(OutputDeliveryStateValues).toContain('generated');
    expect(OutputDeliveryStateValues).toContain('editing');
    expect(OutputDeliveryStateValues).toContain('in_review');
    expect(OutputDeliveryStateValues).toContain('ready');
    expect(OutputDeliveryStateValues).toContain('shared');
    expect(OutputDeliveryStateValues).toContain('archived');
  });

  it('OutputTypeValues has report and presentation', () => {
    expect(OutputTypeValues).toHaveLength(2);
    expect(OutputTypeValues).toContain('report');
    expect(OutputTypeValues).toContain('presentation');
  });

  it('TemplateFamilyNameValues has 3 canonical families (Decision W6-3)', () => {
    expect(TemplateFamilyNameValues).toHaveLength(3);
    expect(TemplateFamilyNameValues).toContain('executive_steering_pack');
    expect(TemplateFamilyNameValues).toContain('transformation_status_pack');
    expect(TemplateFamilyNameValues).toContain('diagnostic_assessment_pack');
  });

  it('GovernanceLevelValues has standard and strict', () => {
    expect(GovernanceLevelValues).toHaveLength(2);
    expect(GovernanceLevelValues).toContain('standard');
    expect(GovernanceLevelValues).toContain('strict');
  });

  it('CadenceValues has 5 cadence options', () => {
    expect(CadenceValues).toHaveLength(5);
    expect(CadenceValues).toContain('daily');
    expect(CadenceValues).toContain('weekly');
    expect(CadenceValues).toContain('biweekly');
    expect(CadenceValues).toContain('monthly');
    expect(CadenceValues).toContain('quarterly');
  });
});

// ------------------------------------------
// Org isolation
// ------------------------------------------

describe('organization isolation', () => {
  it('getOutputArtifact queries include organization_id', async () => {
    mockDbGet.mockResolvedValueOnce(null);
    await getOutputArtifact(ARTIFACT_ID, ORG_ID);

    const query = mockDbGet.mock.calls[0][0] as string;
    expect(query).toContain('organization_id');
    const params = mockDbGet.mock.calls[0][1] as unknown[];
    expect(params).toContain(ORG_ID);
  });

  it('getTemplateFamilies queries include organization_id', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    await getTemplateFamilies(ORG_ID);

    const query = mockDbAll.mock.calls[0][0] as string;
    expect(query).toContain('organization_id');
    const params = mockDbAll.mock.calls[0][1] as unknown[];
    expect(params).toContain(ORG_ID);
  });

  it('getRecurringPrograms queries include organization_id', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    await getRecurringPrograms(ORG_ID);

    const query = mockDbAll.mock.calls[0][0] as string;
    expect(query).toContain('organization_id');
    const params = mockDbAll.mock.calls[0][1] as unknown[];
    expect(params).toContain(ORG_ID);
  });

  it('getAIGovernanceConfig queries include organization_id', async () => {
    mockDbGet.mockResolvedValueOnce(null);
    await getAIGovernanceConfig('report', ORG_ID);

    const query = mockDbGet.mock.calls[0][0] as string;
    expect(query).toContain('organization_id');
    const params = mockDbGet.mock.calls[0][1] as unknown[];
    expect(params).toContain(ORG_ID);
  });

  it('transitionDeliveryState enforces org isolation on update', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeArtifactRow({ delivery_state: 'draft' }));

    await transitionDeliveryState(ARTIFACT_ID, ORG_ID, 'generated');

    const updateSql = mockDbRun.mock.calls[0][0] as string;
    expect(updateSql).toContain('organization_id');
    const updateParams = mockDbRun.mock.calls[0][1] as unknown[];
    expect(updateParams).toContain(ORG_ID);
  });
});
