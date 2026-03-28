import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ZodError } from 'zod';

import type {
  CreatePresetParams,
  CreateReleaseBundleParams,
  EvalThresholds,
  EvaluateGateParams,
  SetCanaryConfigParams,
} from '../../../types/promptOsRuntime.js';
import {
  CanaryConfigSchema,
  CreatePresetParamsSchema,
  CreateReleaseBundleParamsSchema,
  DEFAULT_EVAL_THRESHOLDS,
  DegradedPromptStateSchema,
  EvalGateSchema,
  EvaluateGateParamsSchema,
  PromptPresetSchema,
  PurposeFamilyValues,
  ReleaseBundleSchema,
  RollbackRecordSchema,
  SetCanaryConfigParamsSchema,
} from '../../../types/promptOsRuntime.js';

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
  activateBundle,
  createPreset,
  createReleaseBundle,
  evaluateGate,
  getActiveBundle,
  getBundle,
  getCanaryConfig,
  getGatesByBundle,
  getPreset,
  listBundlesByOrganization,
  listPresetsByOrganization,
  rollbackBundle,
  setCanaryConfig,
} from '../promptOsRuntimeService.js';

// ==========================================
// FIXTURES
// ==========================================

const ORG_ID = '00000000-0000-4000-8000-000000000001';
const OTHER_ORG_ID = '00000000-0000-4000-8000-000000000099';
const PRESET_ID = '00000000-0000-4000-8000-aaaaaaaaaaaa';
const BUNDLE_ID = '00000000-0000-4000-8000-bbbbbbbbbbbb';
const PREV_BUNDLE_ID = '00000000-0000-4000-8000-cccccccccccc';

const THRESHOLDS: EvalThresholds = {
  qualityMin: 0.8,
  latencyP95MaxMs: 3000,
  costMaxPerInteraction: 0.05,
  trustDegradationMaxPct: 5,
  failureRateMaxPct: 3,
};

function makePresetParams(overrides?: Partial<CreatePresetParams>): CreatePresetParams {
  return {
    organizationId: ORG_ID,
    name: 'consultative_chat',
    purposeFamily: 'conversational',
    modelRef: 'gpt-4o',
    promptBlockRefs: ['block:role_advisor', 'block:output_structured'],
    policyRef: 'policy:default-v1',
    gateType: 'hard',
    evalThresholds: THRESHOLDS,
    ...overrides,
  };
}

function makeBundleParams(
  overrides?: Partial<CreateReleaseBundleParams>
): CreateReleaseBundleParams {
  return {
    organizationId: ORG_ID,
    version: '1.0.0',
    presetId: PRESET_ID,
    promptVersion: 'prompt-v2',
    modelVersion: 'gpt-4o-2026-03',
    policyVersion: 'policy-v1',
    runtimeConfigVersion: 'config-v1',
    ...overrides,
  };
}

function makeFakePresetRow(overrides?: Partial<Record<string, unknown>>) {
  return {
    preset_id: PRESET_ID,
    organization_id: ORG_ID,
    name: 'consultative_chat',
    purpose_family: 'conversational',
    model_ref: 'gpt-4o',
    prompt_block_refs: JSON.stringify(['block:role_advisor']),
    policy_ref: 'policy:default-v1',
    gate_type: 'hard',
    eval_thresholds: JSON.stringify(THRESHOLDS),
    created_at: '2026-03-23T10:00:00.000Z',
    updated_at: '2026-03-23T10:00:00.000Z',
    ...overrides,
  };
}

function makeFakeBundleRow(overrides?: Partial<Record<string, unknown>>) {
  return {
    bundle_id: BUNDLE_ID,
    organization_id: ORG_ID,
    version: '1.0.0',
    preset_id: PRESET_ID,
    prompt_version: 'prompt-v2',
    model_version: 'gpt-4o-2026-03',
    policy_version: 'policy-v1',
    runtime_config_version: 'config-v1',
    status: 'draft',
    created_at: '2026-03-23T10:00:00.000Z',
    activated_at: null,
    rolled_back_at: null,
    ...overrides,
  };
}

function makeFakeGateRow(overrides?: Partial<Record<string, unknown>>) {
  return {
    gate_id: '00000000-0000-4000-8000-gggggggggggg',
    bundle_id: BUNDLE_ID,
    gate_type: 'hard',
    purpose_family: 'conversational',
    change_type: 'block_edit',
    thresholds: JSON.stringify(THRESHOLDS),
    result: 'passed',
    evaluated_at: '2026-03-23T10:00:00.000Z',
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
// Preset creation with purpose families
// ------------------------------------------

describe('createPreset', () => {
  it('creates a preset with purpose family and gate type', async () => {
    const result = await createPreset(makePresetParams());

    expect(result.presetId).toBeDefined();
    expect(result.name).toBe('consultative_chat');
    expect(result.purposeFamily).toBe('conversational');
    expect(result.gateType).toBe('hard');
    expect(result.evalThresholds.qualityMin).toBe(0.8);
    expect(result.organizationId).toBe(ORG_ID);
    expect(result.promptBlockRefs).toEqual(['block:role_advisor', 'block:output_structured']);

    expect(mockDbRun).toHaveBeenCalledOnce();
    const sql = mockDbRun.mock.calls[0][0] as string;
    expect(sql).toContain('INSERT INTO v8_prompt_presets');
  });

  it('creates presets for all purpose families (W2-8)', async () => {
    for (const family of PurposeFamilyValues) {
      vi.clearAllMocks();
      const result = await createPreset(
        makePresetParams({
          purposeFamily: family,
          name: `preset_${family}`,
        })
      );
      expect(result.purposeFamily).toBe(family);
    }
  });

  it('supports soft gate type (W2-9)', async () => {
    const result = await createPreset(makePresetParams({ gateType: 'soft' }));
    expect(result.gateType).toBe('soft');
  });

  it('defaults policyRef to null when omitted', async () => {
    const result = await createPreset(makePresetParams({ policyRef: undefined }));
    expect(result.policyRef).toBeNull();
  });

  it('rejects invalid purpose family via Zod', async () => {
    await expect(
      createPreset(makePresetParams({ purposeFamily: 'invalid' as any }))
    ).rejects.toThrow(ZodError);
  });

  it('rejects invalid gate type via Zod', async () => {
    await expect(createPreset(makePresetParams({ gateType: 'invalid' as any }))).rejects.toThrow(
      ZodError
    );
  });

  it('rejects invalid organizationId via Zod', async () => {
    await expect(createPreset(makePresetParams({ organizationId: 'not-a-uuid' }))).rejects.toThrow(
      ZodError
    );
  });
});

describe('getPreset', () => {
  it('returns a preset with org isolation', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakePresetRow());

    const result = await getPreset(PRESET_ID, ORG_ID);

    expect(result).not.toBeNull();
    expect(result!.presetId).toBe(PRESET_ID);
    expect(result!.organizationId).toBe(ORG_ID);

    const query = mockDbGet.mock.calls[0][0] as string;
    expect(query).toContain('organization_id');
  });

  it('returns null when preset not found', async () => {
    mockDbGet.mockResolvedValueOnce(null);
    const result = await getPreset('nonexistent', ORG_ID);
    expect(result).toBeNull();
  });

  it('enforces org isolation — different org returns null', async () => {
    mockDbGet.mockResolvedValueOnce(null);
    const result = await getPreset(PRESET_ID, OTHER_ORG_ID);
    expect(result).toBeNull();
  });
});

describe('listPresetsByOrganization', () => {
  it('lists presets scoped to organization', async () => {
    mockDbAll.mockResolvedValueOnce([makeFakePresetRow()]);
    const rows = await listPresetsByOrganization(ORG_ID);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.presetId).toBe(PRESET_ID);
    expect(mockDbAll.mock.calls[0][0] as string).toContain('v8_prompt_presets');
    expect(mockDbAll.mock.calls[0][1]).toEqual([ORG_ID]);
  });
});

describe('listBundlesByOrganization', () => {
  it('lists bundles scoped to organization with limit', async () => {
    mockDbAll.mockResolvedValueOnce([makeFakeBundleRow()]);
    const rows = await listBundlesByOrganization(ORG_ID, 50);
    expect(rows).toHaveLength(1);
    expect(mockDbAll.mock.calls[0][0] as string).toContain('v8_release_bundles');
    expect(mockDbAll.mock.calls[0][1]).toEqual([ORG_ID, 50]);
  });

  it('clamps limit to safe bounds', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    await listBundlesByOrganization(ORG_ID, 99999);
    expect(mockDbAll.mock.calls[0][1]).toEqual([ORG_ID, 500]);
    mockDbAll.mockResolvedValueOnce([]);
    await listBundlesByOrganization(ORG_ID, 0);
    expect(mockDbAll.mock.calls[1][1]).toEqual([ORG_ID, 1]);
  });
});

// ------------------------------------------
// Release bundle lifecycle: draft → staging → canary → active
// ------------------------------------------

describe('createReleaseBundle', () => {
  it('creates a bundle in draft status', async () => {
    const result = await createReleaseBundle(makeBundleParams());

    expect(result.bundleId).toBeDefined();
    expect(result.status).toBe('draft');
    expect(result.version).toBe('1.0.0');
    expect(result.presetId).toBe(PRESET_ID);
    expect(result.activatedAt).toBeNull();
    expect(result.rolledBackAt).toBeNull();

    expect(mockDbRun).toHaveBeenCalledOnce();
    const sql = mockDbRun.mock.calls[0][0] as string;
    expect(sql).toContain('INSERT INTO v8_release_bundles');
  });

  it('rejects invalid presetId via Zod', async () => {
    await expect(createReleaseBundle(makeBundleParams({ presetId: 'not-a-uuid' }))).rejects.toThrow(
      ZodError
    );
  });
});

describe('activateBundle', () => {
  it('activates a draft bundle when no gates exist', async () => {
    // getBundle
    mockDbGet.mockResolvedValueOnce(makeFakeBundleRow());
    // getGatesByBundle
    mockDbAll.mockResolvedValueOnce([]);
    // getActiveBundle (no current active)
    mockDbGet.mockResolvedValueOnce(null);

    const result = await activateBundle(BUNDLE_ID);

    expect(result.status).toBe('active');
    expect(result.activatedAt).toBeDefined();
  });

  it('activates when all hard gates pass', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeBundleRow());
    mockDbAll.mockResolvedValueOnce([
      makeFakeGateRow({ gate_type: 'hard', result: 'passed' }),
      makeFakeGateRow({ gate_type: 'hard', result: 'passed', gate_id: 'gate-2' }),
    ]);
    mockDbGet.mockResolvedValueOnce(null);

    const result = await activateBundle(BUNDLE_ID);
    expect(result.status).toBe('active');
  });

  it('throws when bundle not found', async () => {
    mockDbGet.mockResolvedValueOnce(null);
    await expect(activateBundle(BUNDLE_ID)).rejects.toThrow('not found');
  });

  it('throws when bundle is already rolled back', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeBundleRow({ status: 'rolled_back' }));
    await expect(activateBundle(BUNDLE_ID)).rejects.toThrow('rolled-back');
  });

  it('returns immediately when bundle is already active', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeBundleRow({ status: 'active' }));

    const result = await activateBundle(BUNDLE_ID);
    expect(result.status).toBe('active');
    expect(mockDbAll).not.toHaveBeenCalled();
  });

  it('deactivates the currently active bundle for the same preset', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeBundleRow());
    mockDbAll.mockResolvedValueOnce([]);
    // getActiveBundle returns a different active bundle
    mockDbGet.mockResolvedValueOnce(
      makeFakeBundleRow({
        bundle_id: PREV_BUNDLE_ID,
        status: 'active',
      })
    );

    await activateBundle(BUNDLE_ID);

    const updateCalls = mockDbRun.mock.calls.filter((call) =>
      (call[0] as string).includes('UPDATE')
    );
    expect(updateCalls.length).toBeGreaterThanOrEqual(2);
  });
});

// ------------------------------------------
// Eval gate enforcement: hard gate blocks, soft gate warns
// ------------------------------------------

describe('evaluateGate', () => {
  it('records a passing eval gate', async () => {
    const result = await evaluateGate({
      bundleId: BUNDLE_ID,
      gateType: 'hard',
      purposeFamily: 'conversational',
      changeType: 'block_edit',
      thresholds: THRESHOLDS,
      result: 'passed',
    });

    expect(result.gateId).toBeDefined();
    expect(result.result).toBe('passed');
    expect(result.gateType).toBe('hard');
    expect(result.changeType).toBe('block_edit');

    const sql = mockDbRun.mock.calls[0][0] as string;
    expect(sql).toContain('INSERT INTO v8_eval_gates');
  });

  it('records a failing eval gate', async () => {
    const result = await evaluateGate({
      bundleId: BUNDLE_ID,
      gateType: 'hard',
      purposeFamily: 'governed_proposal',
      changeType: 'base_rewrite',
      thresholds: THRESHOLDS,
      result: 'failed',
    });

    expect(result.result).toBe('failed');
    expect(result.changeType).toBe('base_rewrite');
  });

  it('records a warning eval gate', async () => {
    const result = await evaluateGate({
      bundleId: BUNDLE_ID,
      gateType: 'soft',
      purposeFamily: 'artifact_generation',
      changeType: 'minor_wording',
      thresholds: THRESHOLDS,
      result: 'warning',
    });

    expect(result.result).toBe('warning');
    expect(result.gateType).toBe('soft');
  });

  it('supports all change types (W2-10)', async () => {
    const changeTypes = [
      'minor_wording',
      'block_edit',
      'routing_policy_change',
      'base_rewrite',
    ] as const;
    for (const ct of changeTypes) {
      vi.clearAllMocks();
      const result = await evaluateGate({
        bundleId: BUNDLE_ID,
        gateType: 'hard',
        purposeFamily: 'conversational',
        changeType: ct,
        thresholds: THRESHOLDS,
        result: 'passed',
      });
      expect(result.changeType).toBe(ct);
    }
  });

  it('rejects invalid change type via Zod', async () => {
    await expect(
      evaluateGate({
        bundleId: BUNDLE_ID,
        gateType: 'hard',
        purposeFamily: 'conversational',
        changeType: 'invalid' as any,
        thresholds: THRESHOLDS,
        result: 'passed',
      })
    ).rejects.toThrow(ZodError);
  });
});

describe('hard gate blocks activation (W2-9)', () => {
  it('blocks activation when a hard gate has failed', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeBundleRow());
    mockDbAll.mockResolvedValueOnce([makeFakeGateRow({ gate_type: 'hard', result: 'failed' })]);

    await expect(activateBundle(BUNDLE_ID)).rejects.toThrow('hard gate(s) failed');
  });

  it('allows activation when only soft gates failed', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeBundleRow());
    mockDbAll.mockResolvedValueOnce([
      makeFakeGateRow({ gate_type: 'soft', result: 'failed', gate_id: 'soft-1' }),
      makeFakeGateRow({ gate_type: 'soft', result: 'warning', gate_id: 'soft-2' }),
    ]);
    mockDbGet.mockResolvedValueOnce(null);

    const result = await activateBundle(BUNDLE_ID);
    expect(result.status).toBe('active');
  });

  it('allows activation with mixed gates: hard passed + soft failed', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeBundleRow());
    mockDbAll.mockResolvedValueOnce([
      makeFakeGateRow({ gate_type: 'hard', result: 'passed', gate_id: 'hard-1' }),
      makeFakeGateRow({ gate_type: 'soft', result: 'failed', gate_id: 'soft-1' }),
    ]);
    mockDbGet.mockResolvedValueOnce(null);

    const result = await activateBundle(BUNDLE_ID);
    expect(result.status).toBe('active');
  });
});

// ------------------------------------------
// Canary config targeting (W2-11)
// ------------------------------------------

describe('setCanaryConfig', () => {
  it('creates a canary config with org/purpose/preset targeting', async () => {
    const result = await setCanaryConfig({
      bundleId: BUNDLE_ID,
      orgScoped: true,
      purposeFamilyScoped: true,
      presetScoped: false,
    });

    expect(result.configId).toBeDefined();
    expect(result.bundleId).toBe(BUNDLE_ID);
    expect(result.orgScoped).toBe(true);
    expect(result.purposeFamilyScoped).toBe(true);
    expect(result.presetScoped).toBe(false);
    expect(result.rollbackEnabled).toBe(true);

    const sql = mockDbRun.mock.calls[0][0] as string;
    expect(sql).toContain('INSERT INTO v8_canary_configs');
  });

  it('supports disabling rollback', async () => {
    const result = await setCanaryConfig({
      bundleId: BUNDLE_ID,
      orgScoped: false,
      purposeFamilyScoped: false,
      presetScoped: true,
      rollbackEnabled: false,
    });

    expect(result.rollbackEnabled).toBe(false);
    expect(result.presetScoped).toBe(true);
  });

  it('defaults rollbackEnabled to true', async () => {
    const result = await setCanaryConfig({
      bundleId: BUNDLE_ID,
      orgScoped: false,
      purposeFamilyScoped: false,
      presetScoped: false,
    });

    expect(result.rollbackEnabled).toBe(true);
  });

  it('rejects invalid bundleId via Zod', async () => {
    await expect(
      setCanaryConfig({
        bundleId: 'not-a-uuid',
        orgScoped: true,
        purposeFamilyScoped: false,
        presetScoped: false,
      })
    ).rejects.toThrow(ZodError);
  });
});

// ------------------------------------------
// Coordinated rollback — bundle level (W2-12)
// ------------------------------------------

describe('rollbackBundle', () => {
  it('rolls back an active bundle and records the rollback', async () => {
    // getBundle
    mockDbGet.mockResolvedValueOnce(makeFakeBundleRow({ status: 'active' }));
    // find previous bundle
    mockDbGet.mockResolvedValueOnce(
      makeFakeBundleRow({
        bundle_id: PREV_BUNDLE_ID,
        status: 'staging',
      })
    );

    const result = await rollbackBundle(BUNDLE_ID, 'quality regression', 'operator:admin');

    expect(result.rollbackId).toBeDefined();
    expect(result.bundleId).toBe(BUNDLE_ID);
    expect(result.reason).toBe('quality regression');
    expect(result.rolledBackBy).toBe('operator:admin');
    expect(result.previousBundleId).toBe(PREV_BUNDLE_ID);

    const insertSql = mockDbRun.mock.calls.find((call) =>
      (call[0] as string).includes('INSERT INTO v8_rollback_records')
    );
    expect(insertSql).toBeDefined();
  });

  it('restores previous bundle to active status', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeBundleRow({ status: 'active' }));
    mockDbGet.mockResolvedValueOnce(
      makeFakeBundleRow({
        bundle_id: PREV_BUNDLE_ID,
        status: 'staging',
      })
    );

    await rollbackBundle(BUNDLE_ID, 'cost regression', 'operator:admin');

    const updateCalls = mockDbRun.mock.calls.filter((call) =>
      (call[0] as string).includes('UPDATE')
    );
    const reactivateCall = updateCalls.find((call) => {
      const params = call[1] as unknown[];
      return params.includes('active') && params.includes(PREV_BUNDLE_ID);
    });
    expect(reactivateCall).toBeDefined();
  });

  it('handles rollback when no previous bundle exists', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeBundleRow({ status: 'active' }));
    mockDbGet.mockResolvedValueOnce(null);

    const result = await rollbackBundle(BUNDLE_ID, 'trust degradation', 'operator:admin');

    expect(result.previousBundleId).toBeNull();
  });

  it('throws when bundle not found', async () => {
    mockDbGet.mockResolvedValueOnce(null);
    await expect(rollbackBundle(BUNDLE_ID, 'reason', 'operator')).rejects.toThrow('not found');
  });

  it('throws when bundle is already rolled back', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeBundleRow({ status: 'rolled_back' }));
    await expect(rollbackBundle(BUNDLE_ID, 'reason', 'operator')).rejects.toThrow(
      'already rolled back'
    );
  });
});

// ------------------------------------------
// Org isolation
// ------------------------------------------

describe('org isolation', () => {
  it('getPreset enforces org isolation in SQL query', async () => {
    mockDbGet.mockResolvedValueOnce(null);
    await getPreset(PRESET_ID, OTHER_ORG_ID);

    const query = mockDbGet.mock.calls[0][0] as string;
    expect(query).toContain('organization_id');
    const params = mockDbGet.mock.calls[0][1] as unknown[];
    expect(params).toContain(OTHER_ORG_ID);
  });

  it('createPreset stores organizationId', async () => {
    const result = await createPreset(makePresetParams({ organizationId: OTHER_ORG_ID }));
    expect(result.organizationId).toBe(OTHER_ORG_ID);
  });

  it('createReleaseBundle stores organizationId', async () => {
    const result = await createReleaseBundle(makeBundleParams({ organizationId: OTHER_ORG_ID }));
    expect(result.organizationId).toBe(OTHER_ORG_ID);
  });
});

// ------------------------------------------
// getGatesByBundle
// ------------------------------------------

describe('getGatesByBundle', () => {
  it('returns all gates for a bundle', async () => {
    mockDbAll.mockResolvedValueOnce([
      makeFakeGateRow({ gate_id: 'gate-1', result: 'passed' }),
      makeFakeGateRow({ gate_id: 'gate-2', result: 'failed' }),
    ]);

    const gates = await getGatesByBundle(BUNDLE_ID);
    expect(gates).toHaveLength(2);
    expect(gates[0].gateId).toBe('gate-1');
    expect(gates[1].result).toBe('failed');
  });

  it('returns empty array when no gates exist', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    const gates = await getGatesByBundle(BUNDLE_ID);
    expect(gates).toEqual([]);
  });
});

// ------------------------------------------
// getActiveBundle
// ------------------------------------------

describe('getActiveBundle', () => {
  it('returns the active bundle for a preset', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeBundleRow({ status: 'active' }));

    const result = await getActiveBundle(PRESET_ID);
    expect(result).not.toBeNull();
    expect(result!.status).toBe('active');
  });

  it('returns null when no active bundle exists', async () => {
    mockDbGet.mockResolvedValueOnce(null);
    const result = await getActiveBundle(PRESET_ID);
    expect(result).toBeNull();
  });
});

// ------------------------------------------
// DEFAULT_EVAL_THRESHOLDS (W2-8)
// ------------------------------------------

describe('DEFAULT_EVAL_THRESHOLDS', () => {
  it('defines thresholds for all purpose families', () => {
    for (const family of PurposeFamilyValues) {
      const t = DEFAULT_EVAL_THRESHOLDS[family];
      expect(t).toBeDefined();
      expect(t.qualityMin).toBeGreaterThan(0);
      expect(t.latencyP95MaxMs).toBeGreaterThan(0);
      expect(t.trustDegradationMaxPct).toBeLessThanOrEqual(100);
      expect(t.failureRateMaxPct).toBeLessThanOrEqual(100);
    }
  });

  it('governed_proposal has stricter quality than conversational', () => {
    expect(DEFAULT_EVAL_THRESHOLDS.governed_proposal.qualityMin).toBeGreaterThan(
      DEFAULT_EVAL_THRESHOLDS.conversational.qualityMin
    );
  });

  it('background_automation has stricter failure rate than conversational', () => {
    expect(DEFAULT_EVAL_THRESHOLDS.background_automation.failureRateMaxPct).toBeLessThan(
      DEFAULT_EVAL_THRESHOLDS.conversational.failureRateMaxPct
    );
  });
});

// ------------------------------------------
// Zod schema validation
// ------------------------------------------

describe('Zod schema validation', () => {
  it('validates a correct PromptPreset', () => {
    expect(() =>
      PromptPresetSchema.parse({
        presetId: PRESET_ID,
        organizationId: ORG_ID,
        name: 'test_preset',
        purposeFamily: 'conversational',
        modelRef: 'gpt-4o',
        promptBlockRefs: ['block:a'],
        policyRef: null,
        gateType: 'hard',
        evalThresholds: THRESHOLDS,
        createdAt: '2026-03-23T10:00:00.000Z',
        updatedAt: '2026-03-23T10:00:00.000Z',
      })
    ).not.toThrow();
  });

  it('rejects PromptPreset with invalid purposeFamily', () => {
    expect(() =>
      PromptPresetSchema.parse({
        presetId: PRESET_ID,
        organizationId: ORG_ID,
        name: 'test_preset',
        purposeFamily: 'invalid',
        modelRef: 'gpt-4o',
        promptBlockRefs: [],
        policyRef: null,
        gateType: 'hard',
        evalThresholds: THRESHOLDS,
        createdAt: '2026-03-23T10:00:00.000Z',
        updatedAt: '2026-03-23T10:00:00.000Z',
      })
    ).toThrow(ZodError);
  });

  it('validates a correct ReleaseBundle', () => {
    expect(() =>
      ReleaseBundleSchema.parse({
        bundleId: BUNDLE_ID,
        organizationId: ORG_ID,
        version: '1.0.0',
        presetId: PRESET_ID,
        promptVersion: 'v1',
        modelVersion: 'v1',
        policyVersion: 'v1',
        runtimeConfigVersion: 'v1',
        status: 'draft',
        createdAt: '2026-03-23T10:00:00.000Z',
        activatedAt: null,
        rolledBackAt: null,
      })
    ).not.toThrow();
  });

  it('rejects ReleaseBundle with invalid status', () => {
    expect(() =>
      ReleaseBundleSchema.parse({
        bundleId: BUNDLE_ID,
        organizationId: ORG_ID,
        version: '1.0.0',
        presetId: PRESET_ID,
        promptVersion: 'v1',
        modelVersion: 'v1',
        policyVersion: 'v1',
        runtimeConfigVersion: 'v1',
        status: 'invalid',
        createdAt: '2026-03-23T10:00:00.000Z',
        activatedAt: null,
        rolledBackAt: null,
      })
    ).toThrow(ZodError);
  });

  it('validates a correct EvalGate', () => {
    expect(() =>
      EvalGateSchema.parse({
        gateId: '00000000-0000-4000-8000-aaaaaaaaa001',
        bundleId: BUNDLE_ID,
        gateType: 'hard',
        purposeFamily: 'conversational',
        changeType: 'block_edit',
        thresholds: THRESHOLDS,
        result: 'passed',
        evaluatedAt: '2026-03-23T10:00:00.000Z',
      })
    ).not.toThrow();
  });

  it('validates a correct CanaryConfig', () => {
    expect(() =>
      CanaryConfigSchema.parse({
        configId: '00000000-0000-4000-8000-cccccccccccc',
        bundleId: BUNDLE_ID,
        orgScoped: true,
        purposeFamilyScoped: false,
        presetScoped: true,
        rollbackEnabled: true,
        createdAt: '2026-03-23T10:00:00.000Z',
      })
    ).not.toThrow();
  });

  it('validates a correct RollbackRecord', () => {
    expect(() =>
      RollbackRecordSchema.parse({
        rollbackId: '00000000-0000-4000-8000-aaaaaaaaa002',
        bundleId: BUNDLE_ID,
        reason: 'quality regression',
        rolledBackBy: 'operator:admin',
        rolledBackAt: '2026-03-23T12:00:00.000Z',
        previousBundleId: PREV_BUNDLE_ID,
      })
    ).not.toThrow();
  });

  it('validates a correct DegradedPromptState', () => {
    expect(() =>
      DegradedPromptStateSchema.parse({
        stateType: 'voice_transcript_partial',
        fallbackPresetId: PRESET_ID,
        userMessage: 'Transcript may be incomplete.',
      })
    ).not.toThrow();
  });

  it('rejects DegradedPromptState with invalid stateType', () => {
    expect(() =>
      DegradedPromptStateSchema.parse({
        stateType: 'invalid',
        fallbackPresetId: null,
        userMessage: 'msg',
      })
    ).toThrow(ZodError);
  });

  it('validates EvalThresholds boundaries', () => {
    expect(() =>
      CreatePresetParamsSchema.parse(
        makePresetParams({
          evalThresholds: {
            qualityMin: 1.5,
            latencyP95MaxMs: 3000,
            costMaxPerInteraction: 0.05,
            trustDegradationMaxPct: 5,
            failureRateMaxPct: 3,
          },
        })
      )
    ).toThrow(ZodError);
  });
});
