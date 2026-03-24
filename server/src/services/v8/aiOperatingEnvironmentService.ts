/**
 * V8 AI Operating Environment Service
 *
 * Orchestrates the full AI runtime: Chat → Context → Prompt OS → Knowledge → Execution → Trust.
 * This is the Wave 9 integration proof — connecting all AI platform layers.
 *
 * Thin orchestrator: delegates to existing services, does not duplicate logic.
 */

import type { ContextSnapshot, ConsumerClass, V8ArtifactRef } from '../../types/contextSnapshot.js';
import type { IntentClassification } from '../../types/chatExecutionIntegration.js';
import type { PromptPreset, PurposeFamily } from '../../types/promptOsRuntime.js';
import type { RetrievalRequest } from '../../types/governedRetrieval.js';
import type { HealthSignal } from '../../types/trustAudit.js';

import * as contextConsumerBindingService from './contextConsumerBindingService.js';
import * as chatExecutionService from './chatExecutionService.js';
import * as governedRetrievalService from './governedRetrievalService.js';
import * as trustAuditService from './trustAuditService.js';
import * as executionSpineService from './executionSpineService.js';
import { all as dbAll } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

// ==========================================
// TYPES
// ==========================================

const LOG_PREFIX = '[V8:AIOperatingEnv]';

export interface ProcessChatTurnParams {
  conversationId: string;
  workspaceId: string;
  organizationId: string;
  projectId?: string | null;
  message: string;
  userId: string;
  artifactRefs: Array<{
    artifactId: string;
    artifactType: string;
    artifactModule: string;
    relationship: V8ArtifactRef['relationship'];
  }>;
  effectiveScopeRef: string;
  resolvedRoleRef: string;
}

export interface ChatTurnResult {
  type: 'execution' | 'chat' | 'ambiguous';
  snapshot: ContextSnapshot;
  intent: IntentClassification;
  handoff?: Awaited<ReturnType<typeof chatExecutionService.initiateHandoff>>;
  executionSnapshot?: ContextSnapshot;
}

export interface SelectPromptPresetParams {
  purposeFamily: PurposeFamily;
  organizationId: string;
  consumerClass: ConsumerClass;
}

export interface ExecuteGovernedRetrievalParams {
  snapshotId: string;
  organizationId: string;
  workspaceId: string;
  query: string;
  userId: string;
  searchPreset?: 'artifact_deep' | 'project_focused' | 'workspace_broad' | 'cross_org_federated';
}

export interface GovernedRetrievalResult {
  retrievalSnapshot: ContextSnapshot;
  request: RetrievalRequest;
}

export type LayerStatus = 'healthy' | 'degraded' | 'unavailable';

export interface OperatingEnvironmentStatus {
  healthy: boolean;
  layers: {
    context: LayerStatus;
    retrieval: LayerStatus;
    execution: LayerStatus;
    trust: LayerStatus;
  };
}

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

// ==========================================
// PUBLIC API
// ==========================================

/**
 * Full chat turn processing.
 *
 * Step 1: Capture context snapshot via captureForChat
 * Step 2: Classify intent via classifyIntent
 * Step 3: If governed_work → initiate handoff, capture execution snapshot
 * Step 4: If conversational → return chat result
 * Step 5: If ambiguous → return ambiguous result
 */
export async function processChatTurn(
  params: ProcessChatTurnParams,
): Promise<ChatTurnResult> {
  const snapshot = await contextConsumerBindingService.captureForChat({
    conversationId: params.conversationId,
    workspaceId: params.workspaceId,
    organizationId: params.organizationId,
    projectId: params.projectId ?? null,
    artifactRefs: params.artifactRefs,
    effectiveScopeRef: params.effectiveScopeRef,
    resolvedRoleRef: params.resolvedRoleRef,
    initiatorUserId: params.userId,
  });

  const intent = await chatExecutionService.classifyIntent(
    params.message,
    snapshot.snapshotId,
    params.organizationId,
  );

  if (intent.intentType === 'governed_work') {
    const handoff = await chatExecutionService.initiateHandoff({
      conversationId: params.conversationId,
      contextSnapshotId: snapshot.snapshotId,
      organizationId: params.organizationId,
      userId: params.userId,
      goal: params.message,
    });

    const executionSnapshot = await contextConsumerBindingService.captureForExecution({
      chatSnapshotId: snapshot.snapshotId,
      workspaceId: params.workspaceId,
      organizationId: params.organizationId,
      projectId: params.projectId ?? null,
      artifactRefs: params.artifactRefs,
      effectiveScopeRef: params.effectiveScopeRef,
      resolvedRoleRef: params.resolvedRoleRef,
      initiatorUserId: params.userId,
      executionRunId: handoff.executionRunId,
    });

    logger.info(
      `${LOG_PREFIX} Chat turn → governed_work: handoff=${handoff.handoffId}, ` +
      `execSnapshot=${executionSnapshot.snapshotId}`,
    );

    return {
      type: 'execution',
      snapshot,
      intent,
      handoff,
      executionSnapshot,
    };
  }

  logger.info(
    `${LOG_PREFIX} Chat turn → ${intent.intentType}: snapshot=${snapshot.snapshotId}`,
  );

  return {
    type: intent.intentType === 'conversational' ? 'chat' : 'ambiguous',
    snapshot,
    intent,
  };
}

/**
 * Select the appropriate Prompt OS preset for a purpose family.
 *
 * Queries presets by purpose family and organization, returns the first match.
 * In production, this would incorporate consumer class routing rules.
 */
export async function selectPromptPreset(
  params: SelectPromptPresetParams,
): Promise<PromptPreset | null> {
  const rows = await dbAll<PresetRow>(
    `SELECT * FROM v8_prompt_presets
     WHERE organization_id = ? AND purpose_family = ?
     ORDER BY created_at DESC
     LIMIT 1`,
    [params.organizationId, params.purposeFamily],
    { fallback: true },
  );

  if (!rows || rows.length === 0) {
    logger.info(
      `${LOG_PREFIX} No preset found for purpose=${params.purposeFamily}, ` +
      `org=${params.organizationId}, consumer=${params.consumerClass}`,
    );
    return null;
  }

  const row = rows[0];
  const preset: PromptPreset = {
    presetId: row.preset_id,
    organizationId: row.organization_id,
    name: row.name,
    purposeFamily: row.purpose_family as PurposeFamily,
    modelRef: row.model_ref,
    promptBlockRefs: safeJsonParse<string[]>(row.prompt_block_refs, []),
    policyRef: row.policy_ref,
    gateType: row.gate_type as PromptPreset['gateType'],
    evalThresholds: safeJsonParse(row.eval_thresholds, {
      qualityMin: 0,
      latencyP95MaxMs: 0,
      costMaxPerInteraction: 0,
      trustDegradationMaxPct: 0,
      failureRateMaxPct: 0,
    }),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };

  logger.info(
    `${LOG_PREFIX} Selected preset ${preset.presetId} "${preset.name}" ` +
    `for purpose=${params.purposeFamily}`,
  );

  return preset;
}

/**
 * Run governed retrieval with full context binding.
 *
 * Step 1: Capture retrieval snapshot via captureForRetrieval
 * Step 2: Create retrieval request via governedRetrievalService
 * Step 3: Return both the snapshot and request
 */
export async function executeGovernedRetrieval(
  params: ExecuteGovernedRetrievalParams,
): Promise<GovernedRetrievalResult> {
  const retrievalSnapshot = await contextConsumerBindingService.captureForRetrieval({
    activeSnapshotId: params.snapshotId,
    organizationId: params.organizationId,
    workspaceId: params.workspaceId,
    effectiveScopeRef: 'retrieval',
    initiatorUserId: params.userId,
  });

  const request = await governedRetrievalService.createRetrievalRequest({
    organizationId: params.organizationId,
    contextSnapshotId: retrievalSnapshot.snapshotId,
    consumerClass: 'retrieval',
    query: params.query,
    searchPreset: params.searchPreset ?? 'workspace_broad',
  });

  logger.info(
    `${LOG_PREFIX} Governed retrieval: snapshot=${retrievalSnapshot.snapshotId}, ` +
    `request=${request.requestId}`,
  );

  return { retrievalSnapshot, request };
}

/**
 * Health check across all AI layers.
 *
 * Queries health signals, degraded conditions, and active execution runs
 * to produce a composite status for the operating environment.
 */
export async function getOperatingEnvironmentStatus(
  organizationId: string,
): Promise<OperatingEnvironmentStatus> {
  const healthSignals = await trustAuditService.getHealthSignals(organizationId);
  const degradedConditions = await trustAuditService.getActiveDegradedConditions(organizationId);
  const activeRuns = await executionSpineService.getActiveRuns(organizationId);

  const layers: OperatingEnvironmentStatus['layers'] = {
    context: deriveLayerStatus(healthSignals, 'context'),
    retrieval: deriveLayerStatus(healthSignals, 'retrieval'),
    execution: deriveLayerStatus(healthSignals, 'execution'),
    trust: deriveLayerStatus(healthSignals, 'trust'),
  };

  if (degradedConditions.length > 0) {
    layers.trust = 'degraded';
  }

  const healthy = Object.values(layers).every((s) => s === 'healthy');

  logger.info(
    `${LOG_PREFIX} Environment status: healthy=${healthy}, ` +
    `degraded=${degradedConditions.length}, activeRuns=${activeRuns.length}`,
  );

  return { healthy, layers };
}

// ==========================================
// HELPERS
// ==========================================

function safeJsonParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function deriveLayerStatus(
  signals: HealthSignal[],
  componentPrefix: string,
): LayerStatus {
  const layerSignals = signals.filter((s) =>
    s.componentId.startsWith(componentPrefix),
  );

  if (layerSignals.length === 0) return 'healthy';

  const hasUnavailable = layerSignals.some((s) => s.status === 'critical');
  if (hasUnavailable) return 'unavailable';

  const hasDegraded = layerSignals.some(
    (s) => s.status === 'warning' || s.status === 'unknown',
  );
  if (hasDegraded) return 'degraded';

  return 'healthy';
}
