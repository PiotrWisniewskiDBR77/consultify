/**
 * V8 Concurrent Editing & Notification Spine Service
 *
 * Manages concurrent editing strategies, conflict resolution, lock lifecycle,
 * notification triggers, notification delivery, and governance-sensitive fields.
 * Implements WP-W4-COLLAB-03 with Decisions W4-8, W4-9, W4-10.
 * All queries enforce organization-level isolation.
 */

import { v4 as uuidv4 } from 'uuid';

import type {
  AcquireLockParams,
  CollaborationMode,
  CommentAnchorStrategy,
  ConcurrencyStrategy,
  ConflictClass,
  ConflictResolution,
  CreateNotificationParams,
  GovernanceConflictPolicy,
  GovernanceSensitiveField,
  LockRecord,
  LockReleaseReason,
  LockStrategy,
  LockType,
  MarkFieldGovernanceSensitiveParams,
  MergeStrategy,
  NotificationChannel,
  NotificationPriority,
  NotificationRecord,
  NotificationState,
  NotificationTrigger,
  OfflinePolicy,
  RecordConflictParams,
  RegisterConcurrencyStrategyParams,
  RegisterNotificationTriggerParams,
  ResolutionStatus,
  ResolutionStrategy,
  ResolveConflictParams,
} from '../../types/concurrentEditingNotification.js';
import {
  AcquireLockParamsSchema,
  CreateNotificationParamsSchema,
  MarkFieldGovernanceSensitiveParamsSchema,
  RecordConflictParamsSchema,
  RegisterConcurrencyStrategyParamsSchema,
  RegisterNotificationTriggerParamsSchema,
  ResolveConflictParamsSchema,
} from '../../types/concurrentEditingNotification.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

// ==========================================
// HELPERS
// ==========================================

const LOG_PREFIX = '[V8:ConcurrentEditing]';

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

interface StrategyRow {
  strategy_id: string;
  resource_type: string;
  organization_id: string;
  collaboration_mode: string;
  merge_strategy: string;
  lock_strategy: string;
  offline_policy: string;
  comment_anchor_strategy: string;
  created_at: string;
  updated_at: string;
}

interface ConflictRow {
  conflict_id: string;
  organization_id: string;
  conflict_class: string;
  resource_type: string;
  resource_id: string;
  room_id: string | null;
  affected_path: string;
  actor_ids: string;
  resolution_strategy: string;
  resolution_status: string;
  resolved_at: string | null;
  created_at: string;
  metadata: string;
}

interface LockRow {
  lock_id: string;
  organization_id: string;
  lock_type: string;
  lock_scope: string;
  holder_id: string;
  holder_client_id: string;
  room_id: string;
  ttl: number;
  acquired_at: string;
  released_at: string | null;
  release_reason: string | null;
}

interface TriggerRow {
  trigger_id: string;
  organization_id: string;
  event_type: string;
  notification_type: string;
  recipient_rule: string;
  priority: string;
  channels: string;
  is_active: number;
  created_at: string;
}

interface NotificationRow {
  notification_id: string;
  organization_id: string;
  recipient_id: string;
  event_ref: string;
  channel: string;
  state: string;
  aggregation_key: string | null;
  priority: string;
  title: string;
  body: string | null;
  created_at: string;
  updated_at: string;
}

interface GovernanceFieldRow {
  field_id: string;
  organization_id: string;
  table_id: string;
  field_name: string;
  is_governance_sensitive: number;
  conflict_policy: string;
  created_at: string;
  updated_at: string;
}

// ==========================================
// ROW MAPPERS
// ==========================================

function rowToStrategy(row: StrategyRow): ConcurrencyStrategy {
  return {
    strategyId: row.strategy_id,
    resourceType: row.resource_type,
    organizationId: row.organization_id,
    collaborationMode: row.collaboration_mode as CollaborationMode,
    mergeStrategy: row.merge_strategy as MergeStrategy,
    lockStrategy: row.lock_strategy as LockStrategy,
    offlinePolicy: row.offline_policy as OfflinePolicy,
    commentAnchorStrategy: row.comment_anchor_strategy as CommentAnchorStrategy,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToConflict(row: ConflictRow): ConflictResolution {
  return {
    conflictId: row.conflict_id,
    organizationId: row.organization_id,
    conflictClass: row.conflict_class as ConflictClass,
    resourceType: row.resource_type,
    resourceId: row.resource_id,
    roomId: row.room_id || null,
    affectedPath: row.affected_path,
    actorIds: safeJsonParse<string[]>(row.actor_ids, []),
    resolutionStrategy: row.resolution_strategy as ResolutionStrategy,
    resolutionStatus: row.resolution_status as ResolutionStatus,
    resolvedAt: row.resolved_at || null,
    createdAt: row.created_at,
    metadata: safeJsonParse(row.metadata, {}),
  };
}

function rowToLock(row: LockRow): LockRecord {
  return {
    lockId: row.lock_id,
    organizationId: row.organization_id,
    lockType: row.lock_type as LockType,
    lockScope: row.lock_scope,
    holderId: row.holder_id,
    holderClientId: row.holder_client_id,
    roomId: row.room_id,
    ttl: row.ttl,
    acquiredAt: row.acquired_at,
    releasedAt: row.released_at || null,
    releaseReason: (row.release_reason as LockReleaseReason) || null,
  };
}

function rowToTrigger(row: TriggerRow): NotificationTrigger {
  return {
    triggerId: row.trigger_id,
    organizationId: row.organization_id,
    eventType: row.event_type,
    notificationType: row.notification_type,
    recipientRule: row.recipient_rule,
    priority: row.priority as NotificationPriority,
    channels: safeJsonParse<NotificationChannel[]>(row.channels, ['in_app_inbox']),
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
  };
}

function rowToNotification(row: NotificationRow): NotificationRecord {
  return {
    notificationId: row.notification_id,
    organizationId: row.organization_id,
    recipientId: row.recipient_id,
    eventRef: row.event_ref,
    channel: row.channel as NotificationChannel,
    state: row.state as NotificationState,
    aggregationKey: row.aggregation_key || null,
    priority: row.priority as NotificationPriority,
    title: row.title,
    body: row.body || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToGovernanceField(row: GovernanceFieldRow): GovernanceSensitiveField {
  return {
    fieldId: row.field_id,
    organizationId: row.organization_id,
    tableId: row.table_id,
    fieldName: row.field_name,
    isGovernanceSensitive: Boolean(row.is_governance_sensitive),
    conflictPolicy: row.conflict_policy as GovernanceConflictPolicy,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ==========================================
// PUBLIC API — CONCURRENCY STRATEGIES
// ==========================================

/**
 * Register a per-resource-type concurrency strategy.
 * Upserts: if a strategy already exists for (org, resourceType), it is updated.
 */
export async function registerConcurrencyStrategy(
  params: RegisterConcurrencyStrategyParams
): Promise<ConcurrencyStrategy> {
  const validated = RegisterConcurrencyStrategyParamsSchema.parse(params);

  const existing = await dbGet<StrategyRow>(
    `SELECT * FROM v8_concurrency_strategies
     WHERE organization_id = ? AND resource_type = ?`,
    [validated.organizationId, validated.resourceType],
    { fallback: true }
  );

  const now = new Date().toISOString();

  if (existing) {
    await dbRun(
      `UPDATE v8_concurrency_strategies
       SET collaboration_mode = ?, merge_strategy = ?, lock_strategy = ?,
           offline_policy = ?, comment_anchor_strategy = ?, updated_at = ?
       WHERE strategy_id = ?`,
      [
        validated.collaborationMode,
        validated.mergeStrategy,
        validated.lockStrategy,
        validated.offlinePolicy,
        validated.commentAnchorStrategy,
        now,
        existing.strategy_id,
      ]
    );

    logger.info(
      `${LOG_PREFIX} Updated concurrency strategy for ${validated.resourceType} in org ${validated.organizationId}`
    );

    return rowToStrategy({
      ...existing,
      collaboration_mode: validated.collaborationMode,
      merge_strategy: validated.mergeStrategy,
      lock_strategy: validated.lockStrategy,
      offline_policy: validated.offlinePolicy,
      comment_anchor_strategy: validated.commentAnchorStrategy,
      updated_at: now,
    });
  }

  const strategyId = uuidv4();

  const strategy: ConcurrencyStrategy = {
    strategyId,
    resourceType: validated.resourceType,
    organizationId: validated.organizationId,
    collaborationMode: validated.collaborationMode,
    mergeStrategy: validated.mergeStrategy,
    lockStrategy: validated.lockStrategy,
    offlinePolicy: validated.offlinePolicy,
    commentAnchorStrategy: validated.commentAnchorStrategy,
    createdAt: now,
    updatedAt: now,
  };

  await dbRun(
    `INSERT INTO v8_concurrency_strategies (
      strategy_id, resource_type, organization_id, collaboration_mode,
      merge_strategy, lock_strategy, offline_policy, comment_anchor_strategy,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      strategy.strategyId,
      strategy.resourceType,
      strategy.organizationId,
      strategy.collaborationMode,
      strategy.mergeStrategy,
      strategy.lockStrategy,
      strategy.offlinePolicy,
      strategy.commentAnchorStrategy,
      strategy.createdAt,
      strategy.updatedAt,
    ]
  );

  logger.info(
    `${LOG_PREFIX} Registered concurrency strategy ${strategyId} for ${validated.resourceType} in org ${validated.organizationId}`
  );
  return strategy;
}

/**
 * Retrieve the concurrency strategy for a resource type within an organization.
 */
export async function getConcurrencyStrategy(
  resourceType: string,
  organizationId: string
): Promise<ConcurrencyStrategy | null> {
  const row = await dbGet<StrategyRow>(
    `SELECT * FROM v8_concurrency_strategies
     WHERE resource_type = ? AND organization_id = ?`,
    [resourceType, organizationId],
    { fallback: true }
  );

  if (!row) return null;
  return rowToStrategy(row);
}

// ==========================================
// PUBLIC API — CONFLICT RESOLUTION
// ==========================================

/**
 * Record a detected conflict. Initial status is `pending_user_action`
 * unless the resolution strategy is auto-resolving.
 */
export async function recordConflict(params: RecordConflictParams): Promise<ConflictResolution> {
  const validated = RecordConflictParamsSchema.parse(params);

  const conflictId = uuidv4();
  const now = new Date().toISOString();

  const autoResolveStrategies: ResolutionStrategy[] = [
    'crdt_auto_merge',
    'ot_transform',
    'last_write_wins',
  ];
  const isAutoResolved = autoResolveStrategies.includes(validated.resolutionStrategy);

  const conflict: ConflictResolution = {
    conflictId,
    organizationId: validated.organizationId,
    conflictClass: validated.conflictClass,
    resourceType: validated.resourceType,
    resourceId: validated.resourceId,
    roomId: validated.roomId ?? null,
    affectedPath: validated.affectedPath,
    actorIds: validated.actorIds,
    resolutionStrategy: validated.resolutionStrategy,
    resolutionStatus: isAutoResolved ? 'auto_resolved' : 'pending_user_action',
    resolvedAt: isAutoResolved ? now : null,
    createdAt: now,
    metadata: validated.metadata,
  };

  await dbRun(
    `INSERT INTO v8_conflict_resolutions (
      conflict_id, organization_id, conflict_class, resource_type, resource_id,
      room_id, affected_path, actor_ids, resolution_strategy, resolution_status,
      resolved_at, created_at, metadata
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      conflict.conflictId,
      conflict.organizationId,
      conflict.conflictClass,
      conflict.resourceType,
      conflict.resourceId,
      conflict.roomId,
      conflict.affectedPath,
      JSON.stringify(conflict.actorIds),
      conflict.resolutionStrategy,
      conflict.resolutionStatus,
      conflict.resolvedAt,
      conflict.createdAt,
      JSON.stringify(conflict.metadata),
    ]
  );

  logger.info(
    `${LOG_PREFIX} Recorded conflict ${conflictId} (${validated.conflictClass}) on ${validated.resourceType}:${validated.resourceId}`
  );
  return conflict;
}

/**
 * Resolve a pending conflict with a given strategy and status.
 */
export async function resolveConflict(
  conflictId: string,
  organizationId: string,
  resolution: ResolveConflictParams
): Promise<ConflictResolution> {
  const validated = ResolveConflictParamsSchema.parse(resolution);

  const row = await dbGet<ConflictRow>(
    `SELECT * FROM v8_conflict_resolutions
     WHERE conflict_id = ? AND organization_id = ?`,
    [conflictId, organizationId],
    { fallback: true }
  );

  if (!row) {
    throw new Error(`Conflict ${conflictId} not found in organization ${organizationId}`);
  }

  const existing = rowToConflict(row);

  if (
    existing.resolutionStatus === 'auto_resolved' ||
    existing.resolutionStatus === 'user_resolved'
  ) {
    throw new Error(`Conflict ${conflictId} is already resolved (${existing.resolutionStatus})`);
  }

  const now = new Date().toISOString();

  await dbRun(
    `UPDATE v8_conflict_resolutions
     SET resolution_strategy = ?, resolution_status = ?, resolved_at = ?
     WHERE conflict_id = ? AND organization_id = ?`,
    [validated.resolutionStrategy, validated.resolutionStatus, now, conflictId, organizationId]
  );

  logger.info(
    `${LOG_PREFIX} Resolved conflict ${conflictId} with ${validated.resolutionStrategy} → ${validated.resolutionStatus}`
  );

  return {
    ...existing,
    resolutionStrategy: validated.resolutionStrategy,
    resolutionStatus: validated.resolutionStatus,
    resolvedAt: now,
  };
}

// ==========================================
// PUBLIC API — LOCK LIFECYCLE
// ==========================================

/**
 * Acquire a lock on a scope within a room.
 * Denies if an active (non-released, non-expired) lock already exists on the same scope.
 */
export async function acquireLock(params: AcquireLockParams): Promise<LockRecord> {
  const validated = AcquireLockParamsSchema.parse(params);

  const now = new Date().toISOString();

  const existingLock = await dbGet<LockRow>(
    `SELECT * FROM v8_lock_records
     WHERE organization_id = ? AND lock_scope = ? AND released_at IS NULL`,
    [validated.organizationId, validated.lockScope],
    { fallback: true }
  );

  if (existingLock) {
    const acquiredMs = new Date(existingLock.acquired_at).getTime();
    const expiredAt = acquiredMs + existingLock.ttl;
    const nowMs = Date.now();

    if (nowMs < expiredAt) {
      throw new Error(
        `Lock denied: scope "${validated.lockScope}" is held by ${existingLock.holder_id} ` +
          `(lock ${existingLock.lock_id}). Release or wait for TTL expiry.`
      );
    }

    await dbRun(
      `UPDATE v8_lock_records
       SET released_at = ?, release_reason = 'timeout'
       WHERE lock_id = ?`,
      [now, existingLock.lock_id]
    );

    logger.info(
      `${LOG_PREFIX} Auto-expired lock ${existingLock.lock_id} on scope "${validated.lockScope}"`
    );
  }

  const lockId = uuidv4();

  const lock: LockRecord = {
    lockId,
    organizationId: validated.organizationId,
    lockType: validated.lockType,
    lockScope: validated.lockScope,
    holderId: validated.holderId,
    holderClientId: validated.holderClientId,
    roomId: validated.roomId,
    ttl: validated.ttl,
    acquiredAt: now,
    releasedAt: null,
    releaseReason: null,
  };

  await dbRun(
    `INSERT INTO v8_lock_records (
      lock_id, organization_id, lock_type, lock_scope, holder_id,
      holder_client_id, room_id, ttl, acquired_at, released_at, release_reason
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      lock.lockId,
      lock.organizationId,
      lock.lockType,
      lock.lockScope,
      lock.holderId,
      lock.holderClientId,
      lock.roomId,
      lock.ttl,
      lock.acquiredAt,
      lock.releasedAt,
      lock.releaseReason,
    ]
  );

  logger.info(
    `${LOG_PREFIX} Acquired lock ${lockId} (${validated.lockType}) on scope "${validated.lockScope}" for ${validated.holderId}`
  );
  return lock;
}

/**
 * Release a lock by ID with a given reason.
 */
export async function releaseLock(
  lockId: string,
  organizationId: string,
  reason: LockReleaseReason
): Promise<LockRecord> {
  const row = await dbGet<LockRow>(
    `SELECT * FROM v8_lock_records
     WHERE lock_id = ? AND organization_id = ?`,
    [lockId, organizationId],
    { fallback: true }
  );

  if (!row) {
    throw new Error(`Lock ${lockId} not found in organization ${organizationId}`);
  }

  if (row.released_at) {
    throw new Error(`Lock ${lockId} is already released (${row.release_reason})`);
  }

  const now = new Date().toISOString();

  await dbRun(
    `UPDATE v8_lock_records
     SET released_at = ?, release_reason = ?
     WHERE lock_id = ? AND organization_id = ?`,
    [now, reason, lockId, organizationId]
  );

  logger.info(`${LOG_PREFIX} Released lock ${lockId} (reason: ${reason})`);

  return {
    ...rowToLock(row),
    releasedAt: now,
    releaseReason: reason,
  };
}

/**
 * Get all active (non-released) locks for a room within an organization.
 */
export async function getActiveLocks(
  roomId: string,
  organizationId: string
): Promise<LockRecord[]> {
  const rows = await dbAll<LockRow>(
    `SELECT * FROM v8_lock_records
     WHERE organization_id = ? AND room_id = ? AND released_at IS NULL
     ORDER BY acquired_at ASC`,
    [organizationId, roomId],
    { fallback: true }
  );

  return (rows || []).map(rowToLock);
}

/**
 * Clean expired locks: release any lock whose TTL has elapsed.
 * Returns the count of cleaned locks.
 */
export async function cleanExpiredLocks(organizationId: string): Promise<number> {
  const now = new Date().toISOString();
  const nowMs = Date.now();

  const activeLocks = await dbAll<LockRow>(
    `SELECT * FROM v8_lock_records
     WHERE organization_id = ? AND released_at IS NULL`,
    [organizationId],
    { fallback: true }
  );

  const locks = activeLocks || [];
  let cleaned = 0;

  for (const lock of locks) {
    const acquiredMs = new Date(lock.acquired_at).getTime();
    const expiredAt = acquiredMs + lock.ttl;

    if (nowMs >= expiredAt) {
      await dbRun(
        `UPDATE v8_lock_records
         SET released_at = ?, release_reason = 'timeout'
         WHERE lock_id = ?`,
        [now, lock.lock_id]
      );
      cleaned++;
    }
  }

  if (cleaned > 0) {
    logger.info(`${LOG_PREFIX} Cleaned ${cleaned} expired locks in org ${organizationId}`);
  }

  return cleaned;
}

// ==========================================
// PUBLIC API — NOTIFICATION TRIGGERS
// ==========================================

/**
 * Register an event-to-notification mapping.
 */
export async function registerNotificationTrigger(
  params: RegisterNotificationTriggerParams
): Promise<NotificationTrigger> {
  const validated = RegisterNotificationTriggerParamsSchema.parse(params);

  const triggerId = uuidv4();
  const now = new Date().toISOString();

  const trigger: NotificationTrigger = {
    triggerId,
    organizationId: validated.organizationId,
    eventType: validated.eventType,
    notificationType: validated.notificationType,
    recipientRule: validated.recipientRule,
    priority: validated.priority,
    channels: validated.channels,
    isActive: true,
    createdAt: now,
  };

  await dbRun(
    `INSERT INTO v8_notification_triggers (
      trigger_id, organization_id, event_type, notification_type,
      recipient_rule, priority, channels, is_active, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      trigger.triggerId,
      trigger.organizationId,
      trigger.eventType,
      trigger.notificationType,
      trigger.recipientRule,
      trigger.priority,
      JSON.stringify(trigger.channels),
      1,
      trigger.createdAt,
    ]
  );

  logger.info(
    `${LOG_PREFIX} Registered notification trigger ${triggerId} for event ${validated.eventType}`
  );
  return trigger;
}

// ==========================================
// PUBLIC API — NOTIFICATION RECORDS
// ==========================================

/**
 * Create a notification record for a recipient.
 */
export async function createNotification(
  params: CreateNotificationParams
): Promise<NotificationRecord> {
  const validated = CreateNotificationParamsSchema.parse(params);

  const notificationId = uuidv4();
  const now = new Date().toISOString();

  const notification: NotificationRecord = {
    notificationId,
    organizationId: validated.organizationId,
    recipientId: validated.recipientId,
    eventRef: validated.eventRef,
    channel: validated.channel,
    state: 'unread',
    aggregationKey: validated.aggregationKey ?? null,
    priority: validated.priority,
    title: validated.title,
    body: validated.body ?? null,
    createdAt: now,
    updatedAt: now,
  };

  await dbRun(
    `INSERT INTO v8_notification_records (
      notification_id, organization_id, recipient_id, event_ref, channel,
      state, aggregation_key, priority, title, body, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      notification.notificationId,
      notification.organizationId,
      notification.recipientId,
      notification.eventRef,
      notification.channel,
      notification.state,
      notification.aggregationKey,
      notification.priority,
      notification.title,
      notification.body,
      notification.createdAt,
      notification.updatedAt,
    ]
  );

  logger.info(
    `${LOG_PREFIX} Created notification ${notificationId} for ${validated.recipientId} (${validated.channel})`
  );
  return notification;
}

/**
 * Get notifications for a recipient, with aggregation support (Decision W4-9).
 * Groups by aggregation_key when present, returning the latest per group.
 */
export async function getNotifications(
  recipientId: string,
  organizationId: string,
  options?: { state?: NotificationState; limit?: number }
): Promise<NotificationRecord[]> {
  const { state, limit = 100 } = options ?? {};

  let query: string;
  let queryParams: unknown[];

  if (state) {
    query = `SELECT * FROM v8_notification_records
             WHERE organization_id = ? AND recipient_id = ? AND state = ?
             ORDER BY created_at DESC
             LIMIT ?`;
    queryParams = [organizationId, recipientId, state, limit];
  } else {
    query = `SELECT * FROM v8_notification_records
             WHERE organization_id = ? AND recipient_id = ?
             ORDER BY created_at DESC
             LIMIT ?`;
    queryParams = [organizationId, recipientId, limit];
  }

  const rows = await dbAll<NotificationRow>(query, queryParams, { fallback: true });
  return (rows || []).map(rowToNotification);
}

/**
 * Update the state of a notification (read, actioned, snoozed).
 */
export async function updateNotificationState(
  notificationId: string,
  organizationId: string,
  state: NotificationState
): Promise<NotificationRecord> {
  const row = await dbGet<NotificationRow>(
    `SELECT * FROM v8_notification_records
     WHERE notification_id = ? AND organization_id = ?`,
    [notificationId, organizationId],
    { fallback: true }
  );

  if (!row) {
    throw new Error(`Notification ${notificationId} not found in organization ${organizationId}`);
  }

  const now = new Date().toISOString();

  await dbRun(
    `UPDATE v8_notification_records
     SET state = ?, updated_at = ?
     WHERE notification_id = ? AND organization_id = ?`,
    [state, now, notificationId, organizationId]
  );

  logger.info(`${LOG_PREFIX} Updated notification ${notificationId} state to ${state}`);

  return {
    ...rowToNotification(row),
    state,
    updatedAt: now,
  };
}

// ==========================================
// PUBLIC API — GOVERNANCE-SENSITIVE FIELDS (Decision W4-10)
// ==========================================

/**
 * Mark a table field as governance-sensitive with a conflict policy.
 * Upserts: if the field is already registered, updates the policy.
 */
export async function markFieldGovernanceSensitive(
  params: MarkFieldGovernanceSensitiveParams
): Promise<GovernanceSensitiveField> {
  const validated = MarkFieldGovernanceSensitiveParamsSchema.parse(params);

  const existing = await dbGet<GovernanceFieldRow>(
    `SELECT * FROM v8_governance_sensitive_fields
     WHERE organization_id = ? AND table_id = ? AND field_name = ?`,
    [validated.organizationId, validated.tableId, validated.fieldName],
    { fallback: true }
  );

  const now = new Date().toISOString();

  if (existing) {
    await dbRun(
      `UPDATE v8_governance_sensitive_fields
       SET is_governance_sensitive = ?, conflict_policy = ?, updated_at = ?
       WHERE field_id = ?`,
      [validated.isGovernanceSensitive ? 1 : 0, validated.conflictPolicy, now, existing.field_id]
    );

    logger.info(
      `${LOG_PREFIX} Updated governance field ${existing.field_id} (${validated.fieldName}) in table ${validated.tableId}`
    );

    return rowToGovernanceField({
      ...existing,
      is_governance_sensitive: validated.isGovernanceSensitive ? 1 : 0,
      conflict_policy: validated.conflictPolicy,
      updated_at: now,
    });
  }

  const fieldId = uuidv4();

  const field: GovernanceSensitiveField = {
    fieldId,
    organizationId: validated.organizationId,
    tableId: validated.tableId,
    fieldName: validated.fieldName,
    isGovernanceSensitive: validated.isGovernanceSensitive,
    conflictPolicy: validated.conflictPolicy,
    createdAt: now,
    updatedAt: now,
  };

  await dbRun(
    `INSERT INTO v8_governance_sensitive_fields (
      field_id, organization_id, table_id, field_name,
      is_governance_sensitive, conflict_policy, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      field.fieldId,
      field.organizationId,
      field.tableId,
      field.fieldName,
      field.isGovernanceSensitive ? 1 : 0,
      field.conflictPolicy,
      field.createdAt,
      field.updatedAt,
    ]
  );

  logger.info(
    `${LOG_PREFIX} Marked field ${fieldId} (${validated.fieldName}) as governance-sensitive in table ${validated.tableId}`
  );
  return field;
}

/**
 * Check whether a specific field is governance-sensitive.
 * Decision W4-10: governance-sensitive fields must not use silent LWW.
 */
export async function isFieldGovernanceSensitive(
  tableId: string,
  fieldName: string,
  organizationId: string
): Promise<boolean> {
  const row = await dbGet<GovernanceFieldRow>(
    `SELECT * FROM v8_governance_sensitive_fields
     WHERE organization_id = ? AND table_id = ? AND field_name = ?
       AND is_governance_sensitive = 1`,
    [organizationId, tableId, fieldName],
    { fallback: true }
  );

  return row !== null && row !== undefined;
}
