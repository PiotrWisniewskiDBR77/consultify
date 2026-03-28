/**
 * V8 Replay, Dead-Letter and Edge Reliability Service
 *
 * Manages dead-letter queue, replay requests, retry policies,
 * provider health, and schema drift detection with org-level isolation.
 * Canonical sources: WP-W5-EXT-02, Decisions W5-4 through W5-8.
 */

import { v4 as uuidv4 } from 'uuid';

import type {
  BulkReplaySafeguards,
  CreateDeadLetterRecordParams,
  DeadLetterRecord,
  ProviderHealthModel,
  RecordProviderHealthParams,
  RecordSchemaDriftParams,
  ReplayRequest,
  RequestReplayParams,
  ResolutionState,
  RetryPolicy,
  SchemaDriftEvent,
  SetRetryPolicyParams,
} from '../../types/replayDeadLetterReliability.js';
import {
  CreateDeadLetterRecordParamsSchema,
  DEAD_LETTER_RETENTION_DAYS,
  RecordProviderHealthParamsSchema,
  RecordSchemaDriftParamsSchema,
  RequestReplayParamsSchema,
  SetRetryPolicyParamsSchema,
} from '../../types/replayDeadLetterReliability.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

// ==========================================
// HELPERS
// ==========================================

const LOG_PREFIX = '[V8:ReplayDeadLetter]';

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
// ROW MAPPERS
// ==========================================

interface DeadLetterRow {
  dead_letter_id: string;
  original_job_ref: string;
  original_payload_ref: string | null;
  event_name: string;
  connector_id: string;
  organization_id: string;
  provider_key: string;
  object_type: string;
  object_ref: string;
  reason: string;
  error_class: string;
  replay_eligibility: string;
  retry_count: number;
  last_attempt_at: string;
  dead_lettered_at: string;
  correlation_id: string;
  operator_note: string | null;
  resolution_state: string;
  created_at: string;
  updated_at: string;
}

function rowToDeadLetterRecord(row: DeadLetterRow): DeadLetterRecord {
  return {
    deadLetterId: row.dead_letter_id,
    originalJobRef: row.original_job_ref,
    originalPayloadRef: row.original_payload_ref,
    eventName: row.event_name,
    connectorId: row.connector_id,
    organizationId: row.organization_id,
    providerKey: row.provider_key,
    objectType: row.object_type,
    objectRef: row.object_ref,
    reason: row.reason,
    errorClass: row.error_class as DeadLetterRecord['errorClass'],
    replayEligibility: row.replay_eligibility as DeadLetterRecord['replayEligibility'],
    retryCount: row.retry_count,
    lastAttemptAt: row.last_attempt_at,
    deadLetteredAt: row.dead_lettered_at,
    correlationId: row.correlation_id,
    operatorNote: row.operator_note,
    resolutionState: row.resolution_state as DeadLetterRecord['resolutionState'],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

interface RetryPolicyRow {
  policy_id: string;
  connector_family: string;
  organization_id: string;
  max_attempt_classes: string;
  backoff_family: string;
  jitter_enabled: number;
  escalation_handoff: string | null;
  created_at: string;
  updated_at: string;
}

function rowToRetryPolicy(row: RetryPolicyRow): RetryPolicy {
  return {
    policyId: row.policy_id,
    connectorFamily: row.connector_family,
    organizationId: row.organization_id,
    maxAttemptClasses: safeJsonParse<Record<string, number>>(row.max_attempt_classes, {}),
    backoffFamily: row.backoff_family as RetryPolicy['backoffFamily'],
    jitterEnabled: row.jitter_enabled === 1,
    escalationHandoff: row.escalation_handoff,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

interface ReplayRequestRow {
  replay_id: string;
  dead_letter_id: string;
  organization_id: string;
  replay_type: string;
  requested_by: string;
  status: string;
  safeguards: string | null;
  created_at: string;
  updated_at: string;
}

function rowToReplayRequest(row: ReplayRequestRow): ReplayRequest {
  return {
    replayId: row.replay_id,
    deadLetterId: row.dead_letter_id,
    organizationId: row.organization_id,
    replayType: row.replay_type as ReplayRequest['replayType'],
    requestedBy: row.requested_by,
    status: row.status as ReplayRequest['status'],
    safeguards: safeJsonParse<BulkReplaySafeguards | null>(row.safeguards, null),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

interface ProviderHealthRow {
  health_id: string;
  provider_key: string;
  organization_id: string;
  auth_health: string;
  transport_health: string;
  schema_health: string;
  sync_freshness: string;
  replay_pressure: string;
  dead_letter_pressure: string;
  overall_health: string;
  last_checked_at: string;
  created_at: string;
  updated_at: string;
}

function rowToProviderHealth(row: ProviderHealthRow): ProviderHealthModel {
  return {
    healthId: row.health_id,
    providerKey: row.provider_key,
    organizationId: row.organization_id,
    authHealth: row.auth_health as ProviderHealthModel['authHealth'],
    transportHealth: row.transport_health as ProviderHealthModel['transportHealth'],
    schemaHealth: row.schema_health as ProviderHealthModel['schemaHealth'],
    syncFreshness: row.sync_freshness as ProviderHealthModel['syncFreshness'],
    replayPressure: row.replay_pressure as ProviderHealthModel['replayPressure'],
    deadLetterPressure: row.dead_letter_pressure as ProviderHealthModel['deadLetterPressure'],
    overallHealth: row.overall_health as ProviderHealthModel['overallHealth'],
    lastCheckedAt: row.last_checked_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

interface SchemaDriftRow {
  event_id: string;
  connector_id: string;
  organization_id: string;
  drift_type: string;
  affected_fields: string;
  detected_at: string;
  created_at: string;
}

function rowToSchemaDriftEvent(row: SchemaDriftRow): SchemaDriftEvent {
  return {
    eventId: row.event_id,
    connectorId: row.connector_id,
    organizationId: row.organization_id,
    driftType: row.drift_type as SchemaDriftEvent['driftType'],
    affectedFields: safeJsonParse<string[]>(row.affected_fields, []),
    detectedAt: row.detected_at,
    createdAt: row.created_at,
  };
}

// ==========================================
// DEAD-LETTER QUEUE
// ==========================================

export async function createDeadLetterRecord(
  params: CreateDeadLetterRecordParams
): Promise<DeadLetterRecord> {
  const validated = CreateDeadLetterRecordParamsSchema.parse(params);

  const deadLetterId = uuidv4();
  const now = new Date().toISOString();

  await dbRun(
    `INSERT INTO v8_dead_letter_records (
      dead_letter_id, original_job_ref, original_payload_ref, event_name,
      connector_id, organization_id, provider_key, object_type, object_ref,
      reason, error_class, replay_eligibility, retry_count, last_attempt_at,
      dead_lettered_at, correlation_id, operator_note, resolution_state,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      deadLetterId,
      validated.originalJobRef,
      validated.originalPayloadRef ?? null,
      validated.eventName,
      validated.connectorId,
      validated.organizationId,
      validated.providerKey,
      validated.objectType,
      validated.objectRef,
      validated.reason,
      validated.errorClass,
      validated.replayEligibility,
      validated.retryCount,
      validated.lastAttemptAt,
      now,
      validated.correlationId,
      validated.operatorNote ?? null,
      'pending_review',
      now,
      now,
    ]
  );

  logger.info(
    `${LOG_PREFIX} Dead-lettered ${validated.objectType}:${validated.objectRef} (${validated.errorClass}) for connector ${validated.connectorId}`
  );

  return {
    deadLetterId,
    originalJobRef: validated.originalJobRef,
    originalPayloadRef: validated.originalPayloadRef ?? null,
    eventName: validated.eventName,
    connectorId: validated.connectorId,
    organizationId: validated.organizationId,
    providerKey: validated.providerKey,
    objectType: validated.objectType,
    objectRef: validated.objectRef,
    reason: validated.reason,
    errorClass: validated.errorClass,
    replayEligibility: validated.replayEligibility,
    retryCount: validated.retryCount,
    lastAttemptAt: validated.lastAttemptAt,
    deadLetteredAt: now,
    correlationId: validated.correlationId,
    operatorNote: validated.operatorNote ?? null,
    resolutionState: 'pending_review',
    createdAt: now,
    updatedAt: now,
  };
}

export async function getDeadLetterQueue(
  connectorId: string,
  orgId: string
): Promise<DeadLetterRecord[]> {
  const rows = await dbAll<DeadLetterRow>(
    `SELECT * FROM v8_dead_letter_records
     WHERE connector_id = ? AND organization_id = ?
     ORDER BY dead_lettered_at DESC`,
    [connectorId, orgId],
    { fallback: true }
  );

  return (rows || []).map(rowToDeadLetterRecord);
}

const VALID_RESOLUTION_TRANSITIONS: Record<string, readonly ResolutionState[]> = {
  pending_review: ['replayed', 'dismissed', 'escalated', 'remapped'],
  escalated: ['replayed', 'dismissed', 'remapped'],
  replayed: [],
  dismissed: [],
  remapped: [],
};

export async function updateDeadLetterResolution(
  deadLetterId: string,
  state: ResolutionState,
  operatorNote?: string | null
): Promise<DeadLetterRecord> {
  const row = await dbGet<DeadLetterRow>(
    `SELECT * FROM v8_dead_letter_records WHERE dead_letter_id = ?`,
    [deadLetterId]
  );

  if (!row) {
    throw new Error(`Dead-letter record ${deadLetterId} not found`);
  }

  const allowed = VALID_RESOLUTION_TRANSITIONS[row.resolution_state] ?? [];
  if (!(allowed as readonly string[]).includes(state)) {
    throw new Error(`Invalid resolution transition: ${row.resolution_state} → ${state}`);
  }

  const now = new Date().toISOString();

  await dbRun(
    `UPDATE v8_dead_letter_records
     SET resolution_state = ?, operator_note = COALESCE(?, operator_note), updated_at = ?
     WHERE dead_letter_id = ?`,
    [state, operatorNote ?? null, now, deadLetterId]
  );

  logger.info(`${LOG_PREFIX} Resolution ${deadLetterId}: ${row.resolution_state} → ${state}`);

  return {
    ...rowToDeadLetterRecord(row),
    resolutionState: state,
    operatorNote: operatorNote ?? row.operator_note,
    updatedAt: now,
  };
}

// ==========================================
// RETRY POLICIES (Decision W5-5)
// ==========================================

export async function setRetryPolicy(params: SetRetryPolicyParams): Promise<RetryPolicy> {
  const validated = SetRetryPolicyParamsSchema.parse(params);

  const existing = await dbGet<RetryPolicyRow>(
    `SELECT * FROM v8_retry_policies
     WHERE connector_family = ? AND organization_id = ?`,
    [validated.connectorFamily, validated.organizationId],
    { fallback: true }
  );

  const now = new Date().toISOString();

  if (existing) {
    await dbRun(
      `UPDATE v8_retry_policies
       SET max_attempt_classes = ?, backoff_family = ?, jitter_enabled = ?,
           escalation_handoff = ?, updated_at = ?
       WHERE policy_id = ?`,
      [
        JSON.stringify(validated.maxAttemptClasses),
        validated.backoffFamily,
        validated.jitterEnabled ? 1 : 0,
        validated.escalationHandoff ?? null,
        now,
        existing.policy_id,
      ]
    );

    logger.info(
      `${LOG_PREFIX} Updated retry policy ${existing.policy_id} for ${validated.connectorFamily}`
    );

    return {
      policyId: existing.policy_id,
      connectorFamily: validated.connectorFamily,
      organizationId: validated.organizationId,
      maxAttemptClasses: validated.maxAttemptClasses,
      backoffFamily: validated.backoffFamily,
      jitterEnabled: validated.jitterEnabled,
      escalationHandoff: validated.escalationHandoff ?? null,
      createdAt: existing.created_at,
      updatedAt: now,
    };
  }

  const policyId = uuidv4();

  await dbRun(
    `INSERT INTO v8_retry_policies (
      policy_id, connector_family, organization_id, max_attempt_classes,
      backoff_family, jitter_enabled, escalation_handoff, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      policyId,
      validated.connectorFamily,
      validated.organizationId,
      JSON.stringify(validated.maxAttemptClasses),
      validated.backoffFamily,
      validated.jitterEnabled ? 1 : 0,
      validated.escalationHandoff ?? null,
      now,
      now,
    ]
  );

  logger.info(`${LOG_PREFIX} Created retry policy ${policyId} for ${validated.connectorFamily}`);

  return {
    policyId,
    connectorFamily: validated.connectorFamily,
    organizationId: validated.organizationId,
    maxAttemptClasses: validated.maxAttemptClasses,
    backoffFamily: validated.backoffFamily,
    jitterEnabled: validated.jitterEnabled,
    escalationHandoff: validated.escalationHandoff ?? null,
    createdAt: now,
    updatedAt: now,
  };
}

export async function getRetryPolicy(
  connectorFamily: string,
  orgId: string
): Promise<RetryPolicy | null> {
  const row = await dbGet<RetryPolicyRow>(
    `SELECT * FROM v8_retry_policies
     WHERE connector_family = ? AND organization_id = ?`,
    [connectorFamily, orgId],
    { fallback: true }
  );

  if (!row) return null;
  return rowToRetryPolicy(row);
}

// ==========================================
// REPLAY REQUESTS (Decision W5-7)
// ==========================================

export async function requestReplay(params: RequestReplayParams): Promise<ReplayRequest> {
  const validated = RequestReplayParamsSchema.parse(params);

  if (validated.replayType === 'bulk' && !validated.safeguards) {
    throw new Error('Bulk replay requires safeguards (Decision W5-7: never blind fire-and-forget)');
  }

  const dlRow = await dbGet<DeadLetterRow>(
    `SELECT * FROM v8_dead_letter_records
     WHERE dead_letter_id = ? AND organization_id = ?`,
    [validated.deadLetterId, validated.organizationId]
  );

  if (!dlRow) {
    throw new Error(`Dead-letter record ${validated.deadLetterId} not found`);
  }

  if (dlRow.replay_eligibility === 'blocked') {
    throw new Error(
      `Dead-letter record ${validated.deadLetterId} is not replay-eligible (blocked)`
    );
  }

  const replayId = uuidv4();
  const now = new Date().toISOString();

  await dbRun(
    `INSERT INTO v8_replay_requests (
      replay_id, dead_letter_id, organization_id, replay_type,
      requested_by, status, safeguards, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      replayId,
      validated.deadLetterId,
      validated.organizationId,
      validated.replayType,
      validated.requestedBy,
      'pending',
      validated.safeguards ? JSON.stringify(validated.safeguards) : null,
      now,
      now,
    ]
  );

  logger.info(
    `${LOG_PREFIX} Replay requested ${replayId} (${validated.replayType}) for dead-letter ${validated.deadLetterId}`
  );

  return {
    replayId,
    deadLetterId: validated.deadLetterId,
    organizationId: validated.organizationId,
    replayType: validated.replayType,
    requestedBy: validated.requestedBy,
    status: 'pending',
    safeguards: validated.safeguards ?? null,
    createdAt: now,
    updatedAt: now,
  };
}

export async function getReplayRequests(
  deadLetterId: string,
  orgId: string
): Promise<ReplayRequest[]> {
  const rows = await dbAll<ReplayRequestRow>(
    `SELECT * FROM v8_replay_requests
     WHERE dead_letter_id = ? AND organization_id = ?
     ORDER BY created_at DESC`,
    [deadLetterId, orgId],
    { fallback: true }
  );

  return (rows || []).map(rowToReplayRequest);
}

// ==========================================
// PROVIDER HEALTH (Decision W5-8)
// ==========================================

export async function recordProviderHealth(
  params: RecordProviderHealthParams
): Promise<ProviderHealthModel> {
  const validated = RecordProviderHealthParamsSchema.parse(params);

  const existing = await dbGet<ProviderHealthRow>(
    `SELECT * FROM v8_provider_health
     WHERE provider_key = ? AND organization_id = ?`,
    [validated.providerKey, validated.organizationId],
    { fallback: true }
  );

  const now = new Date().toISOString();

  if (existing) {
    await dbRun(
      `UPDATE v8_provider_health
       SET auth_health = ?, transport_health = ?, schema_health = ?,
           sync_freshness = ?, replay_pressure = ?, dead_letter_pressure = ?,
           overall_health = ?, last_checked_at = ?, updated_at = ?
       WHERE health_id = ?`,
      [
        validated.authHealth,
        validated.transportHealth,
        validated.schemaHealth,
        validated.syncFreshness,
        validated.replayPressure,
        validated.deadLetterPressure,
        validated.overallHealth,
        now,
        now,
        existing.health_id,
      ]
    );

    logger.info(`${LOG_PREFIX} Updated provider health for ${validated.providerKey}`);

    return {
      healthId: existing.health_id,
      providerKey: validated.providerKey,
      organizationId: validated.organizationId,
      authHealth: validated.authHealth,
      transportHealth: validated.transportHealth,
      schemaHealth: validated.schemaHealth,
      syncFreshness: validated.syncFreshness,
      replayPressure: validated.replayPressure,
      deadLetterPressure: validated.deadLetterPressure,
      overallHealth: validated.overallHealth,
      lastCheckedAt: now,
      createdAt: existing.created_at,
      updatedAt: now,
    };
  }

  const healthId = uuidv4();

  await dbRun(
    `INSERT INTO v8_provider_health (
      health_id, provider_key, organization_id,
      auth_health, transport_health, schema_health,
      sync_freshness, replay_pressure, dead_letter_pressure,
      overall_health, last_checked_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      healthId,
      validated.providerKey,
      validated.organizationId,
      validated.authHealth,
      validated.transportHealth,
      validated.schemaHealth,
      validated.syncFreshness,
      validated.replayPressure,
      validated.deadLetterPressure,
      validated.overallHealth,
      now,
      now,
      now,
    ]
  );

  logger.info(`${LOG_PREFIX} Created provider health ${healthId} for ${validated.providerKey}`);

  return {
    healthId,
    providerKey: validated.providerKey,
    organizationId: validated.organizationId,
    authHealth: validated.authHealth,
    transportHealth: validated.transportHealth,
    schemaHealth: validated.schemaHealth,
    syncFreshness: validated.syncFreshness,
    replayPressure: validated.replayPressure,
    deadLetterPressure: validated.deadLetterPressure,
    overallHealth: validated.overallHealth,
    lastCheckedAt: now,
    createdAt: now,
    updatedAt: now,
  };
}

export async function getProviderHealth(
  providerKey: string,
  orgId: string
): Promise<ProviderHealthModel | null> {
  const row = await dbGet<ProviderHealthRow>(
    `SELECT * FROM v8_provider_health
     WHERE provider_key = ? AND organization_id = ?`,
    [providerKey, orgId],
    { fallback: true }
  );

  if (!row) return null;
  return rowToProviderHealth(row);
}

// ==========================================
// SCHEMA DRIFT (Decision W5-4)
// ==========================================

export async function recordSchemaDrift(
  params: RecordSchemaDriftParams
): Promise<SchemaDriftEvent> {
  const validated = RecordSchemaDriftParamsSchema.parse(params);

  const eventId = uuidv4();
  const now = new Date().toISOString();

  await dbRun(
    `INSERT INTO v8_schema_drift_events (
      event_id, connector_id, organization_id, drift_type,
      affected_fields, detected_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      eventId,
      validated.connectorId,
      validated.organizationId,
      validated.driftType,
      JSON.stringify(validated.affectedFields),
      now,
      now,
    ]
  );

  logger.info(
    `${LOG_PREFIX} Schema drift detected: ${validated.driftType} on connector ${validated.connectorId}`
  );

  return {
    eventId,
    connectorId: validated.connectorId,
    organizationId: validated.organizationId,
    driftType: validated.driftType,
    affectedFields: validated.affectedFields,
    detectedAt: now,
    createdAt: now,
  };
}

// ==========================================
// RETENTION (Decision W5-6)
// ==========================================

export function getRetentionCutoffDate(): string {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - DEAD_LETTER_RETENTION_DAYS);
  return cutoff.toISOString();
}

export async function getExpiredResolvedRecords(orgId: string): Promise<DeadLetterRecord[]> {
  const cutoff = getRetentionCutoffDate();

  const rows = await dbAll<DeadLetterRow>(
    `SELECT * FROM v8_dead_letter_records
     WHERE organization_id = ?
       AND resolution_state NOT IN ('pending_review', 'escalated')
       AND dead_lettered_at < ?
     ORDER BY dead_lettered_at ASC`,
    [orgId, cutoff],
    { fallback: true }
  );

  return (rows || []).map(rowToDeadLetterRecord);
}
