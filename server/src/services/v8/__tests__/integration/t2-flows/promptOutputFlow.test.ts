/**
 * F03 — Prompt release → output generation flow integration test
 *
 * Flow: createPreset() → createReleaseBundle() → evaluateGate() (pass) →
 *       activateBundle() → setAIGovernanceConfig() with preset ref →
 *       createOutputArtifact() with governance ref →
 *       verify output links to active bundle
 *
 * Services: promptOsRuntimeService, reportsPresModelService
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

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

import {
  activateBundle,
  createPreset,
  createReleaseBundle,
  evaluateGate,
} from '../../../promptOsRuntimeService.js';
import { createOutputArtifact, setAIGovernanceConfig } from '../../../reportsPresModelService.js';

// ==========================================
// FIXTURES
// ==========================================

const ORG_ID = '00000000-0000-4000-8000-000000000001';
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

describe('F03 — Prompt release → output generation flow', () => {
  it('canonical flow completes end-to-end', async () => {
    // Step 1: Create a prompt preset
    const preset = await createPreset({
      organizationId: ORG_ID,
      name: 'Report Generation v2',
      purposeFamily: 'artifact_generation',
      modelRef: 'gpt-4o',
      promptBlockRefs: ['block-intro', 'block-analysis', 'block-conclusion'],
      policyRef: 'policy-standard',
      gateType: 'hard',
      evalThresholds: {
        qualityMin: 0.8,
        latencyP95MaxMs: 5000,
        costMaxPerInteraction: 0.5,
        trustDegradationMaxPct: 5,
        failureRateMaxPct: 2,
      },
    });
    expect(preset.presetId).toBeDefined();
    expect(preset.organizationId).toBe(ORG_ID);
    expect(preset.purposeFamily).toBe('artifact_generation');

    // Step 2: Create a release bundle for this preset
    const bundle = await createReleaseBundle({
      organizationId: ORG_ID,
      version: '2.0.0',
      presetId: preset.presetId,
      promptVersion: '2.0.0',
      modelVersion: 'gpt-4o-2026-03',
      policyVersion: '1.2.0',
      runtimeConfigVersion: '1.0.0',
    });
    expect(bundle.bundleId).toBeDefined();
    expect(bundle.presetId).toBe(preset.presetId);
    expect(bundle.status).toBe('draft');

    // Step 3: Evaluate gate — pass
    const gate = await evaluateGate({
      bundleId: bundle.bundleId,
      gateType: 'hard',
      purposeFamily: 'artifact_generation',
      changeType: 'block_edit',
      thresholds: {
        qualityMin: 0.8,
        latencyP95MaxMs: 5000,
        costMaxPerInteraction: 0.5,
        trustDegradationMaxPct: 5,
        failureRateMaxPct: 2,
      },
      result: 'passed',
    });
    expect(gate.gateId).toBeDefined();
    expect(gate.bundleId).toBe(bundle.bundleId);
    expect(gate.result).toBe('passed');

    // Step 4: Activate the bundle
    // Mock getBundle to return our bundle, getGatesByBundle to return the passing gate,
    // and getActiveBundle to return null (no currently active bundle)
    mockDbGet.mockImplementation((sql: string, params?: unknown[]) => {
      if (
        typeof sql === 'string' &&
        sql.includes('v8_release_bundles') &&
        sql.includes('bundle_id')
      ) {
        return Promise.resolve({
          bundle_id: bundle.bundleId,
          organization_id: ORG_ID,
          version: '2.0.0',
          preset_id: preset.presetId,
          prompt_version: '2.0.0',
          model_version: 'gpt-4o-2026-03',
          policy_version: '1.2.0',
          runtime_config_version: '1.0.0',
          status: 'draft',
          created_at: bundle.createdAt,
          activated_at: null,
          rolled_back_at: null,
        });
      }
      if (
        typeof sql === 'string' &&
        sql.includes('v8_release_bundles') &&
        sql.includes('preset_id') &&
        sql.includes('active')
      ) {
        return Promise.resolve(null);
      }
      if (typeof sql === 'string' && sql.includes('v8_output_ai_governance')) {
        return Promise.resolve(null);
      }
      return Promise.resolve(null);
    });
    mockDbAll.mockImplementation((sql: string) => {
      if (typeof sql === 'string' && sql.includes('v8_eval_gates')) {
        return Promise.resolve([
          {
            gate_id: gate.gateId,
            bundle_id: bundle.bundleId,
            gate_type: 'hard',
            purpose_family: 'report_generation',
            change_type: 'prompt_update',
            thresholds: JSON.stringify(gate.thresholds),
            result: 'passed',
            evaluated_at: gate.evaluatedAt,
          },
        ]);
      }
      return Promise.resolve([]);
    });

    const activatedBundle = await activateBundle(bundle.bundleId);
    expect(activatedBundle.status).toBe('active');
    expect(activatedBundle.activatedAt).toBeDefined();

    // Step 5: Set AI governance config referencing the preset
    mockDbGet.mockImplementation((sql: string) => {
      if (typeof sql === 'string' && sql.includes('v8_output_ai_governance')) {
        return Promise.resolve(null);
      }
      return Promise.resolve(null);
    });

    const govConfig = await setAIGovernanceConfig({
      organizationId: ORG_ID,
      outputType: 'report',
      presetRef: preset.presetId,
      evalGateRef: gate.gateId,
      qualityThresholds: { minQuality: 0.8, maxLatencyMs: 5000 },
    });
    expect(govConfig.configId).toBeDefined();
    expect(govConfig.presetRef).toBe(preset.presetId);
    expect(govConfig.evalGateRef).toBe(gate.gateId);

    // Step 6: Create output artifact with governance reference
    const artifact = await createOutputArtifact({
      organizationId: ORG_ID,
      outputType: 'report',
      templateFamilyRef: null,
      sourceInitiativeId: null,
      aiGovernancePresetRef: preset.presetId,
      createdBy: USER_ID,
    });
    expect(artifact.artifactId).toBeDefined();
    expect(artifact.aiGovernancePresetRef).toBe(preset.presetId);
    expect(artifact.deliveryState).toBe('draft');

    // Verify the full chain: preset → bundle → gate → activation → governance → artifact
    expect(artifact.aiGovernancePresetRef).toBe(preset.presetId);
    expect(govConfig.presetRef).toBe(preset.presetId);
    expect(activatedBundle.bundleId).toBe(bundle.bundleId);
    expect(bundle.presetId).toBe(preset.presetId);
  });

  it('intermediate outputs satisfy downstream contracts', async () => {
    // createPreset output has presetId needed by createReleaseBundle
    const preset = await createPreset({
      organizationId: ORG_ID,
      name: 'Test Preset',
      purposeFamily: 'artifact_generation',
      modelRef: 'gpt-4o',
      promptBlockRefs: ['block-1'],
      policyRef: null,
      gateType: 'soft',
      evalThresholds: {
        qualityMin: 0.7,
        latencyP95MaxMs: 10000,
        costMaxPerInteraction: 1.0,
        trustDegradationMaxPct: 10,
        failureRateMaxPct: 5,
      },
    });
    expect(preset).toHaveProperty('presetId');
    expect(preset).toHaveProperty('organizationId');
    expect(preset).toHaveProperty('purposeFamily');
    expect(typeof preset.presetId).toBe('string');

    // createReleaseBundle output has bundleId needed by evaluateGate and activateBundle
    const bundle = await createReleaseBundle({
      organizationId: ORG_ID,
      version: '1.0.0',
      presetId: preset.presetId,
      promptVersion: '1.0.0',
      modelVersion: 'gpt-4o',
      policyVersion: '1.0.0',
      runtimeConfigVersion: '1.0.0',
    });
    expect(bundle).toHaveProperty('bundleId');
    expect(bundle).toHaveProperty('presetId');
    expect(bundle).toHaveProperty('status');
    expect(bundle.presetId).toBe(preset.presetId);

    // evaluateGate output has gateId needed by setAIGovernanceConfig
    const gate = await evaluateGate({
      bundleId: bundle.bundleId,
      gateType: 'soft',
      purposeFamily: 'artifact_generation',
      changeType: 'routing_policy_change',
      thresholds: preset.evalThresholds,
      result: 'passed',
    });
    expect(gate).toHaveProperty('gateId');
    expect(gate).toHaveProperty('bundleId');
    expect(gate).toHaveProperty('result');
    expect(gate.bundleId).toBe(bundle.bundleId);

    // setAIGovernanceConfig output has configId and presetRef
    mockDbGet.mockResolvedValue(null);
    const config = await setAIGovernanceConfig({
      organizationId: ORG_ID,
      outputType: 'report',
      presetRef: preset.presetId,
      evalGateRef: gate.gateId,
      qualityThresholds: {},
    });
    expect(config).toHaveProperty('configId');
    expect(config).toHaveProperty('presetRef');
    expect(config).toHaveProperty('outputType');
    expect(config.presetRef).toBe(preset.presetId);

    // createOutputArtifact output has artifactId and aiGovernancePresetRef
    const artifact = await createOutputArtifact({
      organizationId: ORG_ID,
      outputType: 'report',
      templateFamilyRef: null,
      sourceInitiativeId: null,
      aiGovernancePresetRef: preset.presetId,
      createdBy: USER_ID,
    });
    expect(artifact).toHaveProperty('artifactId');
    expect(artifact).toHaveProperty('aiGovernancePresetRef');
    expect(artifact).toHaveProperty('deliveryState');
    expect(artifact.aiGovernancePresetRef).toBe(preset.presetId);
  });
});
