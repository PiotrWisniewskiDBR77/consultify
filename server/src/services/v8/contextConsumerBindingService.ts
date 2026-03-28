/**
 * V8 Context Consumer Binding Service
 *
 * Orchestrates ContextSnapshot capture and inheritance across
 * Chat, Execution, and Knowledge consumers.
 * Implements Decisions D1, D2, W2-4 from the V8 program.
 */

import type {
  ConsumerClass,
  ContextSnapshot,
  SourceRef,
  V8ArtifactRef,
} from '../../types/contextSnapshot.js';
import logger from '../../utils/Logger.js';
import * as contextSnapshotService from './contextSnapshotService.js';

// ==========================================
// HELPERS
// ==========================================

const LOG_PREFIX = '[V8:ConsumerBinding]';

// ==========================================
// PARAM TYPES
// ==========================================

export interface CaptureForChatParams {
  conversationId: string;
  workspaceId: string;
  organizationId: string;
  projectId?: string | null;
  artifactRefs: V8ArtifactRef[];
  effectiveScopeRef: string;
  resolvedRoleRef: string;
  initiatorUserId: string;
  sourceContextRefs?: SourceRef[];
}

export interface CaptureForExecutionParams {
  chatSnapshotId: string;
  workspaceId: string;
  organizationId: string;
  projectId?: string | null;
  artifactRefs: V8ArtifactRef[];
  effectiveScopeRef: string;
  resolvedRoleRef: string;
  initiatorUserId: string;
  executionRunId: string;
}

export interface CaptureForRetrievalParams {
  activeSnapshotId: string;
  organizationId: string;
  workspaceId: string;
  effectiveScopeRef: string;
  initiatorUserId: string;
  sourceContextRefs?: SourceRef[];
}

export interface ConsumerClassValidation {
  valid: boolean;
  actualClass: string;
  expectedClass: string;
}

// ==========================================
// PUBLIC API
// ==========================================

/**
 * Capture a snapshot for a chat conversation turn.
 *
 * Looks up the latest snapshot for the same conversation to establish
 * parent chaining, then captures a new snapshot with consumerClass 'chat'.
 */
export async function captureForChat(params: CaptureForChatParams): Promise<ContextSnapshot> {
  const previousSnapshots = await contextSnapshotService.getSnapshotsByConversation(
    params.conversationId,
    params.organizationId
  );

  const parentSnapshotId =
    previousSnapshots.length > 0
      ? previousSnapshots[previousSnapshots.length - 1].snapshotId
      : null;

  const snapshot = await contextSnapshotService.captureSnapshot({
    workspaceId: params.workspaceId,
    organizationId: params.organizationId,
    projectId: params.projectId ?? null,
    conversationId: params.conversationId,
    executionRunId: null,
    artifactRefs: params.artifactRefs,
    effectiveScopeRef: params.effectiveScopeRef,
    resolvedRoleRef: params.resolvedRoleRef,
    initiatorUserId: params.initiatorUserId,
    consumerClass: 'chat',
    sourceContextRefs: params.sourceContextRefs ?? [],
    parentSnapshotId: parentSnapshotId ?? undefined,
  });

  logger.info(
    `${LOG_PREFIX} Chat snapshot ${snapshot.snapshotId} captured for conversation ${params.conversationId}` +
      (parentSnapshotId ? ` (parent: ${parentSnapshotId})` : ' (root)')
  );

  return snapshot;
}

/**
 * Capture a snapshot for an execution run, inheriting from a chat snapshot.
 *
 * The chat snapshot ID is recorded as the parent, establishing the
 * chat → execution inheritance chain.
 */
export async function captureForExecution(
  params: CaptureForExecutionParams
): Promise<ContextSnapshot> {
  const snapshot = await contextSnapshotService.captureSnapshot({
    workspaceId: params.workspaceId,
    organizationId: params.organizationId,
    projectId: params.projectId ?? null,
    conversationId: null,
    executionRunId: params.executionRunId,
    artifactRefs: params.artifactRefs,
    effectiveScopeRef: params.effectiveScopeRef,
    resolvedRoleRef: params.resolvedRoleRef,
    initiatorUserId: params.initiatorUserId,
    consumerClass: 'execution',
    sourceContextRefs: [],
    parentSnapshotId: params.chatSnapshotId,
  });

  logger.info(
    `${LOG_PREFIX} Execution snapshot ${snapshot.snapshotId} captured for run ${params.executionRunId}` +
      ` (parent chat: ${params.chatSnapshotId})`
  );

  return snapshot;
}

/**
 * Capture a lightweight snapshot for a retrieval request.
 *
 * Binds to the currently active snapshot (from chat or execution)
 * as the parent, with consumerClass 'retrieval'.
 */
export async function captureForRetrieval(
  params: CaptureForRetrievalParams
): Promise<ContextSnapshot> {
  const snapshot = await contextSnapshotService.captureSnapshot({
    workspaceId: params.workspaceId,
    organizationId: params.organizationId,
    projectId: null,
    conversationId: null,
    executionRunId: null,
    artifactRefs: [],
    effectiveScopeRef: params.effectiveScopeRef,
    resolvedRoleRef: 'system',
    initiatorUserId: params.initiatorUserId,
    consumerClass: 'retrieval',
    sourceContextRefs: params.sourceContextRefs ?? [],
    parentSnapshotId: params.activeSnapshotId,
  });

  logger.info(
    `${LOG_PREFIX} Retrieval snapshot ${snapshot.snapshotId} captured` +
      ` (parent: ${params.activeSnapshotId})`
  );

  return snapshot;
}

/**
 * Validate that a snapshot's consumer class matches the expected class.
 *
 * Used by downstream consumers to assert they received a snapshot
 * of the correct type before proceeding.
 */
export async function validateConsumerClass(
  snapshotId: string,
  expectedClass: ConsumerClass,
  organizationId: string
): Promise<ConsumerClassValidation> {
  const snapshot = await contextSnapshotService.getSnapshot(snapshotId, organizationId);

  if (!snapshot) {
    logger.warn(
      `${LOG_PREFIX} validateConsumerClass: snapshot ${snapshotId} not found in org ${organizationId}`
    );
    return {
      valid: false,
      actualClass: 'unknown',
      expectedClass,
    };
  }

  const valid = snapshot.consumerClass === expectedClass;

  if (!valid) {
    logger.warn(
      `${LOG_PREFIX} Consumer class mismatch on ${snapshotId}: ` +
        `expected ${expectedClass}, got ${snapshot.consumerClass}`
    );
  }

  return {
    valid,
    actualClass: snapshot.consumerClass,
    expectedClass,
  };
}

/**
 * Get the full inheritance chain showing how context flows
 * from chat → execution → retrieval.
 *
 * Walks the parentSnapshotId chain manually. When WP-20W2-02 adds
 * contextSnapshotService.getSnapshotChain(), this can delegate there.
 */
export async function getInheritanceChain(
  snapshotId: string,
  organizationId: string
): Promise<ContextSnapshot[]> {
  const chain: ContextSnapshot[] = [];
  const visited = new Set<string>();
  let currentId: string | null = snapshotId;

  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);

    const snapshot = await contextSnapshotService.getSnapshot(currentId, organizationId);
    if (!snapshot) break;

    chain.push(snapshot);
    currentId = snapshot.parentSnapshotId;
  }

  chain.reverse();

  logger.info(
    `${LOG_PREFIX} Inheritance chain for ${snapshotId}: ${chain.length} snapshot(s) ` +
      `[${chain.map((s) => s.consumerClass).join(' → ')}]`
  );

  return chain;
}
