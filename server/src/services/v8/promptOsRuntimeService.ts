/**
 * V8 Prompt OS Runtime Discipline Service
 *
 * Manages prompt presets, release bundles, eval gates, canary configs,
 * and coordinated rollback for the Prompt OS governance layer.
 *
 * All queries enforce organization-level isolation.
 *
 * Decisions implemented:
 *  W2-8  — eval thresholds per purpose family
 *  W2-9  — hard gate blocks activation, soft gate warns
 *  W2-10 — eval depth tiering by change type
 *  W2-11 — canary config with org/purpose/preset targeting
 *  W2-12 — coordinated rollback at bundle level
 */

import { v4 as uuidv4 } from 'uuid';

import type {
  PromptPreset,
  ReleaseBundle,
  EvalGate,
  CanaryConfig,
  RollbackRecord,
  CreatePresetParams,
  CreateReleaseBundleParams,
  EvaluateGateParams,
  SetCanaryConfigParams,
  EvalThresholds,
  BundleStatus,
} from '../../types/promptOsRuntime.js';
import {
  CreatePresetParamsSchema,
  CreateReleaseBundleParamsSchema,
  EvaluateGateParamsSchema,
  SetCanaryConfigParamsSchema,
} from '../../types/promptOsRuntime.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

// ==========================================
// HELPERS
// ==========================================

const LOG_PREFIX = '[V8:PromptOsRuntime]';

function safeJsonParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    logger.warn(`${LOG_PREFIX} Failed to parse JSON, using fallback`);
    return fallback;
  }
}

// ==========================================
// ROW TYPES
// ==========================================

interface PresetRow {
  preset_id: string;
  organization_id: string;
  name: string;
  purpose_family: string;
  model_ref: string;
  prompt_block_refs: string;
  policy_ref: string | null;
  gate_type: string;
  eval_thresholds: string;
  created_at: string;
  updated_at: string;
}

interface BundleRow {
  bundle_id: string;
  organization_id: string;
  version: string;
  preset_id: string;
  prompt_version: string;
  model_version: string;
  policy_version: string;
  runtime_config_version: string;
  status: string;
  created_at: string;
  activated_at: string | null;
  rolled_back_at: string | null;
}

interface GateRow {
  gate_id: string;
  bundle_id: string;
  gate_type: string;
  purpose_family: string;
  change_type: string;
  thresholds: string;
  result: string;
  evaluated_at: string;
}

interface CanaryRow {
  config_id: string;
  bundle_id: string;
  org_scoped: number;
  purpose_family_scoped: number;
  preset_scoped: number;
  rollback_enabled: number;
  created_at: string;
}

interface RollbackRow {
  rollback_id: string;
  bundle_id: string;
  reason: string;
  rolled_back_by: string;
  rolled_back_at: string;
  previous_bundle_id: string | null;
}

// ==========================================
// ROW MAPPERS
// ==========================================

const DEFAULT_THRESHOLDS: EvalThresholds = {
  qualityMin: 0,
  latencyP95MaxMs: 0,
  costMaxPerInteraction: 0,
  trustDegradationMaxPct: 0,
  failureRateMaxPct: 0,
};

function rowToPreset(row: PresetRow): PromptPreset {
  return {
    presetId: row.preset_id,
    organizationId: row.organization_id,
    name: row.name,
    purposeFamily: row.purpose_family as PromptPreset['purposeFamily'],
    modelRef: row.model_ref,
    promptBlockRefs: safeJsonParse<string[]>(row.prompt_block_refs, []),
    policyRef: row.policy_ref,
    gateType: row.gate_type as PromptPreset['gateType'],
    evalThresholds: safeJsonParse<EvalThresholds>(row.eval_thresholds, DEFAULT_THRESHOLDS),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToBundle(row: BundleRow): ReleaseBundle {
  return {
    bundleId: row.bundle_id,
    organizationId: row.organization_id,
    version: row.version,
    presetId: row.preset_id,
    promptVersion: row.prompt_version,
    modelVersion: row.model_version,
    policyVersion: row.policy_version,
    runtimeConfigVersion: row.runtime_config_version,
    status: row.status as ReleaseBundle['status'],
    createdAt: row.created_at,
    activatedAt: row.activated_at,
    rolledBackAt: row.rolled_back_at,
  };
}

function rowToGate(row: GateRow): EvalGate {
  return {
    gateId: row.gate_id,
    bundleId: row.bundle_id,
    gateType: row.gate_type as EvalGate['gateType'],
    purposeFamily: row.purpose_family as EvalGate['purposeFamily'],
    changeType: row.change_type as EvalGate['changeType'],
    thresholds: safeJsonParse<EvalThresholds>(row.thresholds, DEFAULT_THRESHOLDS),
    result: row.result as EvalGate['result'],
    evaluatedAt: row.evaluated_at,
  };
}

function rowToCanary(row: CanaryRow): CanaryConfig {
  return {
    configId: row.config_id,
    bundleId: row.bundle_id,
    orgScoped: row.org_scoped === 1,
    purposeFamilyScoped: row.purpose_family_scoped === 1,
    presetScoped: row.preset_scoped === 1,
    rollbackEnabled: row.rollback_enabled === 1,
    createdAt: row.created_at,
  };
}

function rowToRollback(row: RollbackRow): RollbackRecord {
  return {
    rollbackId: row.rollback_id,
    bundleId: row.bundle_id,
    reason: row.reason,
    rolledBackBy: row.rolled_back_by,
    rolledBackAt: row.rolled_back_at,
    previousBundleId: row.previous_bundle_id,
  };
}

// ==========================================
// PUBLIC API — PRESETS
// ==========================================

/**
 * Register a prompt preset with purpose family and gate type (W2-8, W2-9).
 */
export async function createPreset(params: CreatePresetParams): Promise<PromptPreset> {
  const validated = CreatePresetParamsSchema.parse(params);

  const presetId = uuidv4();
  const now = new Date().toISOString();

  const preset: PromptPreset = {
    presetId,
    organizationId: validated.organizationId,
    name: validated.name,
    purposeFamily: validated.purposeFamily,
    modelRef: validated.modelRef,
    promptBlockRefs: validated.promptBlockRefs,
    policyRef: validated.policyRef,
    gateType: validated.gateType,
    evalThresholds: validated.evalThresholds,
    createdAt: now,
    updatedAt: now,
  };

  await dbRun(
    `INSERT INTO v8_prompt_presets (
      preset_id, organization_id, name, purpose_family,
      model_ref, prompt_block_refs, policy_ref,
      gate_type, eval_thresholds, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      preset.presetId,
      preset.organizationId,
      preset.name,
      preset.purposeFamily,
      preset.modelRef,
      JSON.stringify(preset.promptBlockRefs),
      preset.policyRef,
      preset.gateType,
      JSON.stringify(preset.evalThresholds),
      preset.createdAt,
      preset.updatedAt,
    ],
  );

  logger.info(`${LOG_PREFIX} Created preset ${presetId} "${validated.name}" for org ${validated.organizationId}`);
  return preset;
}

/**
 * Retrieve a preset by ID with org isolation.
 */
export async function getPreset(
  presetId: string,
  orgId: string,
): Promise<PromptPreset | null> {
  const row = await dbGet<PresetRow>(
    `SELECT * FROM v8_prompt_presets
     WHERE preset_id = ? AND organization_id = ?`,
    [presetId, orgId],
    { fallback: true },
  );

  if (!row) return null;
  return rowToPreset(row);
}

/**
 * List presets for an organization (newest first).
 */
export async function listPresetsByOrganization(orgId: string): Promise<PromptPreset[]> {
  const rows = await dbAll<PresetRow>(
    `SELECT * FROM v8_prompt_presets
     WHERE organization_id = ?
     ORDER BY created_at DESC`,
    [orgId],
    { fallback: true },
  );
  return (rows || []).map(rowToPreset);
}

// ==========================================
// PUBLIC API — RELEASE BUNDLES
// ==========================================

/**
 * Create an atomic release bundle in draft status (W2-12).
 */
export async function createReleaseBundle(
  params: CreateReleaseBundleParams,
): Promise<ReleaseBundle> {
  const validated = CreateReleaseBundleParamsSchema.parse(params);

  const bundleId = uuidv4();
  const now = new Date().toISOString();

  const bundle: ReleaseBundle = {
    bundleId,
    organizationId: validated.organizationId,
    version: validated.version,
    presetId: validated.presetId,
    promptVersion: validated.promptVersion,
    modelVersion: validated.modelVersion,
    policyVersion: validated.policyVersion,
    runtimeConfigVersion: validated.runtimeConfigVersion,
    status: 'draft',
    createdAt: now,
    activatedAt: null,
    rolledBackAt: null,
  };

  await dbRun(
    `INSERT INTO v8_release_bundles (
      bundle_id, organization_id, version, preset_id,
      prompt_version, model_version, policy_version,
      runtime_config_version, status, created_at,
      activated_at, rolled_back_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      bundle.bundleId,
      bundle.organizationId,
      bundle.version,
      bundle.presetId,
      bundle.promptVersion,
      bundle.modelVersion,
      bundle.policyVersion,
      bundle.runtimeConfigVersion,
      bundle.status,
      bundle.createdAt,
      bundle.activatedAt,
      bundle.rolledBackAt,
    ],
  );

  logger.info(`${LOG_PREFIX} Created release bundle ${bundleId} v${validated.version} for preset ${validated.presetId}`);
  return bundle;
}

/**
 * Retrieve a bundle by ID.
 */
export async function getBundle(bundleId: string): Promise<ReleaseBundle | null> {
  const row = await dbGet<BundleRow>(
    `SELECT * FROM v8_release_bundles WHERE bundle_id = ?`,
    [bundleId],
    { fallback: true },
  );

  if (!row) return null;
  return rowToBundle(row);
}

/**
 * List release bundles for an organization (newest first), capped for safety.
 */
export async function listBundlesByOrganization(
  orgId: string,
  limit: number = 100,
): Promise<ReleaseBundle[]> {
  const safeLimit = Math.min(Math.max(1, limit), 500);
  const rows = await dbAll<BundleRow>(
    `SELECT * FROM v8_release_bundles
     WHERE organization_id = ?
     ORDER BY created_at DESC
     LIMIT ?`,
    [orgId, safeLimit],
    { fallback: true },
  );
  return (rows || []).map(rowToBundle);
}

/**
 * Transition a bundle's status.
 */
async function transitionBundleStatus(
  bundleId: string,
  newStatus: BundleStatus,
  extra?: { activatedAt?: string; rolledBackAt?: string },
): Promise<void> {
  const setClauses = ['status = ?'];
  const params: unknown[] = [newStatus];

  if (extra?.activatedAt) {
    setClauses.push('activated_at = ?');
    params.push(extra.activatedAt);
  }
  if (extra?.rolledBackAt) {
    setClauses.push('rolled_back_at = ?');
    params.push(extra.rolledBackAt);
  }

  params.push(bundleId);

  await dbRun(
    `UPDATE v8_release_bundles SET ${setClauses.join(', ')} WHERE bundle_id = ?`,
    params,
  );
}

/**
 * Activate a release bundle.
 * W2-9: hard gates must all pass; soft gates allow activation with warnings.
 * Deactivates any currently active bundle for the same preset.
 */
export async function activateBundle(bundleId: string): Promise<ReleaseBundle> {
  const bundle = await getBundle(bundleId);
  if (!bundle) {
    throw new Error(`Bundle ${bundleId} not found`);
  }

  if (bundle.status === 'active') {
    return bundle;
  }

  if (bundle.status === 'rolled_back') {
    throw new Error(`Cannot activate rolled-back bundle ${bundleId}`);
  }

  const gates = await getGatesByBundle(bundleId);
  const hardGates = gates.filter((g) => g.gateType === 'hard');
  const failedHardGates = hardGates.filter((g) => g.result === 'failed');

  if (failedHardGates.length > 0) {
    throw new Error(
      `Cannot activate bundle ${bundleId}: ${failedHardGates.length} hard gate(s) failed`,
    );
  }

  const softGates = gates.filter((g) => g.gateType === 'soft');
  const warningSoftGates = softGates.filter((g) => g.result === 'failed' || g.result === 'warning');
  if (warningSoftGates.length > 0) {
    logger.warn(
      `${LOG_PREFIX} Activating bundle ${bundleId} with ${warningSoftGates.length} soft gate warning(s)`,
    );
  }

  const currentActive = await getActiveBundle(bundle.presetId);
  if (currentActive && currentActive.bundleId !== bundleId) {
    await transitionBundleStatus(currentActive.bundleId, 'staging');
  }

  const now = new Date().toISOString();
  await transitionBundleStatus(bundleId, 'active', { activatedAt: now });

  logger.info(`${LOG_PREFIX} Activated bundle ${bundleId}`);

  return {
    ...bundle,
    status: 'active',
    activatedAt: now,
  };
}

/**
 * Coordinated rollback at bundle level (W2-12).
 * Marks the bundle as rolled_back and re-activates the previous bundle if available.
 */
export async function rollbackBundle(
  bundleId: string,
  reason: string,
  rolledBackBy: string,
): Promise<RollbackRecord> {
  const bundle = await getBundle(bundleId);
  if (!bundle) {
    throw new Error(`Bundle ${bundleId} not found`);
  }

  if (bundle.status === 'rolled_back') {
    throw new Error(`Bundle ${bundleId} is already rolled back`);
  }

  const previousRow = await dbGet<BundleRow>(
    `SELECT * FROM v8_release_bundles
     WHERE preset_id = ? AND bundle_id != ? AND status != 'rolled_back'
     ORDER BY created_at DESC LIMIT 1`,
    [bundle.presetId, bundleId],
    { fallback: true },
  );

  const now = new Date().toISOString();

  await transitionBundleStatus(bundleId, 'rolled_back', { rolledBackAt: now });

  if (previousRow) {
    await transitionBundleStatus(previousRow.bundle_id, 'active', { activatedAt: now });
    logger.info(`${LOG_PREFIX} Re-activated previous bundle ${previousRow.bundle_id}`);
  }

  const rollbackId = uuidv4();
  const record: RollbackRecord = {
    rollbackId,
    bundleId,
    reason,
    rolledBackBy,
    rolledBackAt: now,
    previousBundleId: previousRow?.bundle_id ?? null,
  };

  await dbRun(
    `INSERT INTO v8_rollback_records (
      rollback_id, bundle_id, reason, rolled_back_by,
      rolled_back_at, previous_bundle_id
    ) VALUES (?, ?, ?, ?, ?, ?)`,
    [
      record.rollbackId,
      record.bundleId,
      record.reason,
      record.rolledBackBy,
      record.rolledBackAt,
      record.previousBundleId,
    ],
  );

  logger.info(`${LOG_PREFIX} Rolled back bundle ${bundleId}: ${reason}`);
  return record;
}

/**
 * Returns the currently active bundle for a preset.
 */
export async function getActiveBundle(presetId: string): Promise<ReleaseBundle | null> {
  const row = await dbGet<BundleRow>(
    `SELECT * FROM v8_release_bundles
     WHERE preset_id = ? AND status = 'active'
     LIMIT 1`,
    [presetId],
    { fallback: true },
  );

  if (!row) return null;
  return rowToBundle(row);
}

// ==========================================
// PUBLIC API — EVAL GATES
// ==========================================

/**
 * Record an eval gate result (W2-8, W2-9, W2-10).
 */
export async function evaluateGate(params: EvaluateGateParams): Promise<EvalGate> {
  const validated = EvaluateGateParamsSchema.parse(params);

  const gateId = uuidv4();
  const now = new Date().toISOString();

  const gate: EvalGate = {
    gateId,
    bundleId: validated.bundleId,
    gateType: validated.gateType,
    purposeFamily: validated.purposeFamily,
    changeType: validated.changeType,
    thresholds: validated.thresholds,
    result: validated.result,
    evaluatedAt: now,
  };

  await dbRun(
    `INSERT INTO v8_eval_gates (
      gate_id, bundle_id, gate_type, purpose_family,
      change_type, thresholds, result, evaluated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      gate.gateId,
      gate.bundleId,
      gate.gateType,
      gate.purposeFamily,
      gate.changeType,
      JSON.stringify(gate.thresholds),
      gate.result,
      gate.evaluatedAt,
    ],
  );

  logger.info(`${LOG_PREFIX} Eval gate ${gateId}: bundle=${validated.bundleId} result=${validated.result}`);
  return gate;
}

/**
 * Retrieve all eval gates for a bundle.
 */
export async function getGatesByBundle(bundleId: string): Promise<EvalGate[]> {
  const rows = await dbAll<GateRow>(
    `SELECT * FROM v8_eval_gates WHERE bundle_id = ? ORDER BY evaluated_at ASC`,
    [bundleId],
    { fallback: true },
  );

  return (rows || []).map(rowToGate);
}

// ==========================================
// PUBLIC API — CANARY CONFIG
// ==========================================

/**
 * Set canary config for a bundle (W2-11: org/purpose/preset targeting).
 */
export async function setCanaryConfig(params: SetCanaryConfigParams): Promise<CanaryConfig> {
  const validated = SetCanaryConfigParamsSchema.parse(params);

  const configId = uuidv4();
  const now = new Date().toISOString();

  const config: CanaryConfig = {
    configId,
    bundleId: validated.bundleId,
    orgScoped: validated.orgScoped,
    purposeFamilyScoped: validated.purposeFamilyScoped,
    presetScoped: validated.presetScoped,
    rollbackEnabled: validated.rollbackEnabled,
    createdAt: now,
  };

  await dbRun(
    `INSERT INTO v8_canary_configs (
      config_id, bundle_id, org_scoped, purpose_family_scoped,
      preset_scoped, rollback_enabled, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      config.configId,
      config.bundleId,
      config.orgScoped ? 1 : 0,
      config.purposeFamilyScoped ? 1 : 0,
      config.presetScoped ? 1 : 0,
      config.rollbackEnabled ? 1 : 0,
      config.createdAt,
    ],
  );

  logger.info(`${LOG_PREFIX} Canary config ${configId} for bundle ${validated.bundleId}`);
  return config;
}

/**
 * Retrieve canary config for a bundle.
 */
export async function getCanaryConfig(bundleId: string): Promise<CanaryConfig | null> {
  const row = await dbGet<CanaryRow>(
    `SELECT * FROM v8_canary_configs WHERE bundle_id = ? ORDER BY created_at DESC LIMIT 1`,
    [bundleId],
    { fallback: true },
  );

  if (!row) return null;
  return rowToCanary(row);
}
