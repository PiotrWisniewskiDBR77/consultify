/**
 * V8 PM Sync Platform Truth Service
 *
 * Manages connector auth lifecycle, provider depth profiles,
 * per-object sync state, and conflict records with org-level isolation.
 */

import { v4 as uuidv4 } from 'uuid';

import type {
  BusinessObjectSyncState,
  ConflictRecord,
  ConflictResolutionPath,
  ConnectorAuthRecord,
  ConnectorAuthState,
  ConnectorSyncHealthSummary,
  ParityScore,
  ProviderDepthProfile,
  RecordConflictParams,
  RegisterProviderProfileParams,
  SetConnectorAuthStateParams,
  SyncStatus,
  UpdateObjectSyncStateParams,
} from '../../types/pmSyncTruth.js';
import {
  AUTH_STATE_TRANSITIONS,
  RecordConflictParamsSchema,
  RegisterProviderProfileParamsSchema,
  SetConnectorAuthStateParamsSchema,
  UpdateObjectSyncStateParamsSchema,
} from '../../types/pmSyncTruth.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

// ==========================================
// HELPERS
// ==========================================

const LOG_PREFIX = '[V8:PMSyncTruth]';

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

interface AuthStateRow {
  record_id: string;
  connector_id: string;
  organization_id: string;
  auth_state: string;
  previous_state: string | null;
  transitioned_at: string;
  transitioned_by: string;
  reason: string | null;
  created_at: string;
}

function rowToAuthRecord(row: AuthStateRow): ConnectorAuthRecord {
  return {
    recordId: row.record_id,
    connectorId: row.connector_id,
    organizationId: row.organization_id,
    authState: row.auth_state as ConnectorAuthState,
    previousState: row.previous_state as ConnectorAuthState | null,
    transitionedAt: row.transitioned_at,
    transitionedBy: row.transitioned_by,
    reason: row.reason,
  };
}

interface ProviderProfileRow {
  profile_id: string;
  provider_id: string;
  provider_name: string;
  tier: string;
  parity_dimensions: string;
  limitations: string;
  display_contract: string;
  organization_id: string;
  created_at: string;
  updated_at: string;
}

function rowToProviderProfile(row: ProviderProfileRow): ProviderDepthProfile {
  return {
    profileId: row.profile_id,
    providerId: row.provider_id,
    providerName: row.provider_name,
    tier: row.tier as ProviderDepthProfile['tier'],
    parityDimensions: safeJsonParse<ParityScore[]>(row.parity_dimensions, []),
    limitations: safeJsonParse<string[]>(row.limitations, []),
    displayContract: row.display_contract,
    organizationId: row.organization_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

interface SyncStateRow {
  sync_state_id: string;
  object_type: string;
  object_id: string;
  connector_id: string;
  organization_id: string;
  sync_status: string;
  last_synced_at: string | null;
  stale_since: string | null;
  error_class: string | null;
  created_at: string;
  updated_at: string;
}

function rowToSyncState(row: SyncStateRow): BusinessObjectSyncState {
  return {
    syncStateId: row.sync_state_id,
    objectType: row.object_type as BusinessObjectSyncState['objectType'],
    objectId: row.object_id,
    connectorId: row.connector_id,
    organizationId: row.organization_id,
    syncStatus: row.sync_status as BusinessObjectSyncState['syncStatus'],
    lastSyncedAt: row.last_synced_at,
    staleSince: row.stale_since,
    errorClass: row.error_class as BusinessObjectSyncState['errorClass'],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

interface ConflictRow {
  conflict_id: string;
  object_sync_state_id: string;
  organization_id: string;
  conflict_class: string;
  severity: string;
  resolution_path: string | null;
  resolution_strategy: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
}

function rowToConflictRecord(row: ConflictRow): ConflictRecord {
  return {
    conflictId: row.conflict_id,
    objectSyncStateId: row.object_sync_state_id,
    organizationId: row.organization_id,
    conflictClass: row.conflict_class as ConflictRecord['conflictClass'],
    severity: row.severity as ConflictRecord['severity'],
    resolutionPath: row.resolution_path as ConflictResolutionPath | null,
    resolutionStrategy: row.resolution_strategy ?? null,
    resolvedAt: row.resolved_at,
    resolvedBy: row.resolved_by,
    createdAt: row.created_at,
  };
}

/** Higher rank = worse operational state for rollup health. */
const SYNC_STATUS_RANK: Record<SyncStatus, number> = {
  synced: 0,
  not_synced: 1,
  pending: 2,
  stale: 3,
  conflict: 4,
  error: 5,
  dead_letter: 6,
};

// ==========================================
// AUTH STATE MANAGEMENT
// ==========================================

export function isValidAuthTransition(
  current: ConnectorAuthState,
  target: ConnectorAuthState
): boolean {
  const allowed = AUTH_STATE_TRANSITIONS[current];
  return (allowed as readonly string[]).includes(target);
}

/**
 * Transition a connector's auth state with state-machine validation.
 * First transition from `not_connected` is always allowed (initial state).
 */
export async function setConnectorAuthState(
  params: SetConnectorAuthStateParams
): Promise<ConnectorAuthRecord> {
  const validated = SetConnectorAuthStateParamsSchema.parse(params);

  const currentRow = await dbGet<AuthStateRow>(
    `SELECT * FROM v8_connector_auth_states
     WHERE connector_id = ? AND organization_id = ?
     ORDER BY transitioned_at DESC LIMIT 1`,
    [validated.connectorId, validated.organizationId],
    { fallback: true }
  );

  const currentState: ConnectorAuthState = currentRow
    ? (currentRow.auth_state as ConnectorAuthState)
    : 'not_connected';

  if (currentRow && !isValidAuthTransition(currentState, validated.targetState)) {
    throw new Error(`Invalid auth state transition: ${currentState} → ${validated.targetState}`);
  }

  const recordId = uuidv4();
  const now = new Date().toISOString();

  await dbRun(
    `INSERT INTO v8_connector_auth_states (
      record_id, connector_id, organization_id, auth_state,
      previous_state, transitioned_at, transitioned_by, reason
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      recordId,
      validated.connectorId,
      validated.organizationId,
      validated.targetState,
      currentRow ? currentState : null,
      now,
      validated.transitionedBy,
      validated.reason ?? null,
    ]
  );

  const isRecovery =
    validated.targetState === 'healthy' &&
    currentRow != null &&
    ['degraded_reauth_needed', 'degraded_scope_limited', 'suspended'].includes(currentState);

  logger.info(
    `${LOG_PREFIX} Auth state transition: ${currentState} → ${validated.targetState} for connector ${validated.connectorId}${isRecovery ? ' [RECOVERED]' : ''}`
  );

  if (isRecovery) {
    try {
      await dbRun(
        `INSERT INTO integration_audit_log (id, organization_id, integration_id, action, actor_id, actor_name, details)
         VALUES (gen_random_uuid()::TEXT, ?, NULL, 'connection_recovered', ?, ?, ?::JSONB)`,
        [
          validated.organizationId,
          validated.transitionedBy,
          validated.transitionedBy,
          JSON.stringify({
            connectorId: validated.connectorId,
            previousState: currentState,
            recoveryReason: validated.reason ?? 'reauth_completed',
          }),
        ]
      );
    } catch {
      logger.warn(`${LOG_PREFIX} Failed to log connection_recovered audit event`);
    }
  }

  return {
    recordId,
    connectorId: validated.connectorId,
    organizationId: validated.organizationId,
    authState: validated.targetState,
    previousState: currentRow ? currentState : null,
    transitionedAt: now,
    transitionedBy: validated.transitionedBy,
    reason: validated.reason ?? null,
  };
}

/**
 * Get the current auth state for a connector (most recent transition).
 */
export async function getConnectorAuthState(
  connectorId: string,
  orgId: string
): Promise<ConnectorAuthRecord | null> {
  const row = await dbGet<AuthStateRow>(
    `SELECT * FROM v8_connector_auth_states
     WHERE connector_id = ? AND organization_id = ?
     ORDER BY transitioned_at DESC LIMIT 1`,
    [connectorId, orgId],
    { fallback: true }
  );

  if (!row) return null;
  return rowToAuthRecord(row);
}

// ==========================================
// PROVIDER DEPTH PROFILES
// ==========================================

/**
 * Register or update a provider depth profile.
 * Uses upsert on (provider_id, organization_id).
 */
export async function registerProviderProfile(
  params: RegisterProviderProfileParams
): Promise<ProviderDepthProfile> {
  const validated = RegisterProviderProfileParamsSchema.parse(params);

  const existing = await dbGet<ProviderProfileRow>(
    `SELECT * FROM v8_provider_depth_profiles
     WHERE provider_id = ? AND organization_id = ?`,
    [validated.providerId, validated.organizationId],
    { fallback: true }
  );

  const now = new Date().toISOString();

  if (existing) {
    await dbRun(
      `UPDATE v8_provider_depth_profiles
       SET provider_name = ?, tier = ?, parity_dimensions = ?,
           limitations = ?, display_contract = ?, updated_at = ?
       WHERE profile_id = ?`,
      [
        validated.providerName,
        validated.tier,
        JSON.stringify(validated.parityDimensions),
        JSON.stringify(validated.limitations),
        validated.displayContract,
        now,
        existing.profile_id,
      ]
    );

    logger.info(
      `${LOG_PREFIX} Updated provider profile ${existing.profile_id} for ${validated.providerId}`
    );

    return {
      profileId: existing.profile_id,
      providerId: validated.providerId,
      providerName: validated.providerName,
      tier: validated.tier,
      parityDimensions: validated.parityDimensions as ParityScore[],
      limitations: validated.limitations,
      displayContract: validated.displayContract,
      organizationId: validated.organizationId,
      createdAt: existing.created_at,
      updatedAt: now,
    };
  }

  const profileId = uuidv4();

  await dbRun(
    `INSERT INTO v8_provider_depth_profiles (
      profile_id, provider_id, provider_name, tier,
      parity_dimensions, limitations, display_contract, organization_id,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      profileId,
      validated.providerId,
      validated.providerName,
      validated.tier,
      JSON.stringify(validated.parityDimensions),
      JSON.stringify(validated.limitations),
      validated.displayContract,
      validated.organizationId,
      now,
      now,
    ]
  );

  logger.info(`${LOG_PREFIX} Registered provider profile ${profileId} for ${validated.providerId}`);

  return {
    profileId,
    providerId: validated.providerId,
    providerName: validated.providerName,
    tier: validated.tier,
    parityDimensions: validated.parityDimensions as ParityScore[],
    limitations: validated.limitations,
    displayContract: validated.displayContract,
    organizationId: validated.organizationId,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Retrieve a provider depth profile by provider ID and org.
 */
export async function getProviderProfile(
  providerId: string,
  orgId: string
): Promise<ProviderDepthProfile | null> {
  const row = await dbGet<ProviderProfileRow>(
    `SELECT * FROM v8_provider_depth_profiles
     WHERE provider_id = ? AND organization_id = ?`,
    [providerId, orgId],
    { fallback: true }
  );

  if (!row) return null;
  return rowToProviderProfile(row);
}

// ==========================================
// BUSINESS OBJECT SYNC STATE
// ==========================================

/**
 * Create or update per-object sync state.
 * Uses upsert on (object_type, object_id, connector_id, organization_id).
 */
export async function updateObjectSyncState(
  params: UpdateObjectSyncStateParams
): Promise<BusinessObjectSyncState> {
  const validated = UpdateObjectSyncStateParamsSchema.parse(params);

  const now = new Date().toISOString();

  const existing = await dbGet<SyncStateRow>(
    `SELECT * FROM v8_business_object_sync_states
     WHERE object_type = ? AND object_id = ? AND connector_id = ? AND organization_id = ?`,
    [validated.objectType, validated.objectId, validated.connectorId, validated.organizationId],
    { fallback: true }
  );

  const lastSyncedAt = validated.syncStatus === 'synced' ? now : (existing?.last_synced_at ?? null);
  const staleSince =
    validated.syncStatus === 'stale' && !existing?.stale_since
      ? now
      : validated.syncStatus !== 'stale'
        ? null
        : (existing?.stale_since ?? now);

  if (existing) {
    await dbRun(
      `UPDATE v8_business_object_sync_states
       SET sync_status = ?, last_synced_at = ?, stale_since = ?,
           error_class = ?, updated_at = ?
       WHERE sync_state_id = ?`,
      [
        validated.syncStatus,
        lastSyncedAt,
        staleSince,
        validated.errorClass ?? null,
        now,
        existing.sync_state_id,
      ]
    );

    logger.info(
      `${LOG_PREFIX} Updated sync state for ${validated.objectType}:${validated.objectId} → ${validated.syncStatus}`
    );

    return {
      syncStateId: existing.sync_state_id,
      objectType: validated.objectType,
      objectId: validated.objectId,
      connectorId: validated.connectorId,
      organizationId: validated.organizationId,
      syncStatus: validated.syncStatus,
      lastSyncedAt,
      staleSince,
      errorClass: validated.errorClass ?? null,
      createdAt: existing.created_at,
      updatedAt: now,
    };
  }

  const syncStateId = uuidv4();

  await dbRun(
    `INSERT INTO v8_business_object_sync_states (
      sync_state_id, object_type, object_id, connector_id, organization_id,
      sync_status, last_synced_at, stale_since, error_class,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      syncStateId,
      validated.objectType,
      validated.objectId,
      validated.connectorId,
      validated.organizationId,
      validated.syncStatus,
      lastSyncedAt,
      staleSince,
      validated.errorClass ?? null,
      now,
      now,
    ]
  );

  logger.info(
    `${LOG_PREFIX} Created sync state ${syncStateId} for ${validated.objectType}:${validated.objectId}`
  );

  return {
    syncStateId,
    objectType: validated.objectType,
    objectId: validated.objectId,
    connectorId: validated.connectorId,
    organizationId: validated.organizationId,
    syncStatus: validated.syncStatus,
    lastSyncedAt,
    staleSince,
    errorClass: validated.errorClass ?? null,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Get sync state for a specific object.
 */
export async function getObjectSyncState(
  objectType: string,
  objectId: string,
  orgId: string
): Promise<BusinessObjectSyncState | null> {
  const row = await dbGet<SyncStateRow>(
    `SELECT * FROM v8_business_object_sync_states
     WHERE object_type = ? AND object_id = ? AND organization_id = ?
     ORDER BY updated_at DESC LIMIT 1`,
    [objectType, objectId, orgId],
    { fallback: true }
  );

  if (!row) return null;
  return rowToSyncState(row);
}

/**
 * Get all sync states for a connector within an org.
 */
export async function getObjectSyncStatesByConnector(
  connectorId: string,
  orgId: string
): Promise<BusinessObjectSyncState[]> {
  const rows = await dbAll<SyncStateRow>(
    `SELECT * FROM v8_business_object_sync_states
     WHERE connector_id = ? AND organization_id = ?
     ORDER BY updated_at DESC`,
    [connectorId, orgId],
    { fallback: true }
  );

  return (rows || []).map(rowToSyncState);
}

// ==========================================
// CONFLICT RECORDS
// ==========================================

/**
 * Record a new conflict instance.
 */
export async function recordConflict(params: RecordConflictParams): Promise<ConflictRecord> {
  const validated = RecordConflictParamsSchema.parse(params);

  const conflictId = uuidv4();
  const now = new Date().toISOString();

  await dbRun(
    `INSERT INTO v8_conflict_records (
      conflict_id, object_sync_state_id, organization_id,
      conflict_class, severity, resolution_path, resolution_strategy,
      resolved_at, resolved_by, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      conflictId,
      validated.objectSyncStateId,
      validated.organizationId,
      validated.conflictClass,
      validated.severity,
      null,
      null,
      null,
      null,
      now,
    ]
  );

  logger.info(
    `${LOG_PREFIX} Recorded conflict ${conflictId}: ${validated.conflictClass} (${validated.severity})`
  );

  if (['schema_mismatch_conflict', 'custom_field_conflict', 'stale_snapshot_conflict'].includes(validated.conflictClass)) {
    try {
      await dbRun(
        `INSERT INTO integration_audit_log (id, organization_id, integration_id, action, actor_id, actor_name, details)
         VALUES (gen_random_uuid()::TEXT, ?, NULL, 'drift_detected', 'system', 'system', ?::JSONB)`,
        [
          validated.organizationId,
          JSON.stringify({
            conflictId,
            conflictClass: validated.conflictClass,
            severity: validated.severity,
            objectSyncStateId: validated.objectSyncStateId,
          }),
        ]
      );
    } catch {
      logger.warn(`${LOG_PREFIX} Failed to emit drift_detected telemetry event`);
    }
  }

  return {
    conflictId,
    objectSyncStateId: validated.objectSyncStateId,
    organizationId: validated.organizationId,
    conflictClass: validated.conflictClass,
    severity: validated.severity,
    resolutionPath: null,
    resolutionStrategy: null,
    resolvedAt: null,
    resolvedBy: null,
    createdAt: now,
  };
}

/**
 * Resolve an existing conflict with a canonical resolution path and strategy label.
 */
export async function resolveConflict(
  conflictId: string,
  resolution: ConflictResolutionPath,
  resolvedBy: string,
  organizationId?: string
): Promise<ConflictRecord> {
  const now = new Date().toISOString();
  const whereClause = organizationId
    ? 'conflict_id = ? AND organization_id = ?'
    : 'conflict_id = ?';
  const whereParams = organizationId ? [conflictId, organizationId] : [conflictId];

  const row = await dbGet<ConflictRow>(
    `SELECT * FROM v8_conflict_records WHERE ${whereClause}`,
    whereParams
  );

  if (!row) {
    throw new Error(`Conflict ${conflictId} not found`);
  }

  if (row.resolved_at) {
    throw new Error(`Conflict ${conflictId} is already resolved`);
  }

  await dbRun(
    `UPDATE v8_conflict_records
     SET resolution_path = ?, resolution_strategy = ?, resolved_at = ?, resolved_by = ?
     WHERE ${whereClause}`,
    [resolution, resolution, now, resolvedBy, ...whereParams]
  );

  logger.info(`${LOG_PREFIX} Resolved conflict ${conflictId} via ${resolution}`);

  return {
    ...rowToConflictRecord(row),
    resolutionPath: resolution,
    resolutionStrategy: resolution,
    resolvedAt: now,
    resolvedBy,
  };
}

/**
 * Get all conflicts for a specific object sync state.
 */
export async function getConflictsByObject(
  objectSyncStateId: string,
  orgId: string
): Promise<ConflictRecord[]> {
  const rows = await dbAll<ConflictRow>(
    `SELECT * FROM v8_conflict_records
     WHERE object_sync_state_id = ? AND organization_id = ?
     ORDER BY created_at DESC`,
    [objectSyncStateId, orgId],
    { fallback: true }
  );

  return (rows || []).map(rowToConflictRecord);
}

// ==========================================
// PROVIDER CATALOG STATE (§2.3.3A)
// ==========================================

const PROVIDER_LIFECYCLE_STATES = [
  'draft', 'connected', 'degraded', 'requires_action', 'recovered', 'blocked',
] as const;

type ProviderLifecycleState = (typeof PROVIDER_LIFECYCLE_STATES)[number];

export const PROVIDER_STATE_TRANSITIONS: Record<ProviderLifecycleState, readonly ProviderLifecycleState[]> = {
  draft: ['connected', 'blocked'],
  connected: ['degraded', 'requires_action', 'blocked'],
  degraded: ['connected', 'recovered', 'requires_action', 'blocked'],
  requires_action: ['connected', 'recovered', 'blocked'],
  recovered: ['connected'],
  blocked: ['connected', 'draft'],
};

export interface ProviderCatalogState {
  stateId: string;
  providerId: string;
  organizationId: string;
  lifecycleState: ProviderLifecycleState;
  previousState: ProviderLifecycleState | null;
  reason: string | null;
  incidentDescription: string | null;
  expectedRecoveryAt: string | null;
  transitionedAt: string;
  transitionedBy: string;
}

interface ProviderCatalogStateRow {
  state_id: string;
  provider_id: string;
  organization_id: string;
  lifecycle_state: string;
  previous_state: string | null;
  reason: string | null;
  incident_description: string | null;
  expected_recovery_at: string | null;
  transitioned_at: string;
  transitioned_by: string;
}

function rowToProviderCatalogState(row: ProviderCatalogStateRow): ProviderCatalogState {
  return {
    stateId: row.state_id,
    providerId: row.provider_id,
    organizationId: row.organization_id,
    lifecycleState: row.lifecycle_state as ProviderLifecycleState,
    previousState: row.previous_state as ProviderLifecycleState | null,
    reason: row.reason,
    incidentDescription: row.incident_description,
    expectedRecoveryAt: row.expected_recovery_at,
    transitionedAt: row.transitioned_at,
    transitionedBy: row.transitioned_by,
  };
}

export function isValidProviderStateTransition(
  current: ProviderLifecycleState,
  target: ProviderLifecycleState
): boolean {
  const allowed = PROVIDER_STATE_TRANSITIONS[current];
  return (allowed as readonly string[]).includes(target);
}

export async function setProviderCatalogState(params: {
  providerId: string;
  organizationId: string;
  targetState: ProviderLifecycleState;
  transitionedBy: string;
  reason?: string | null;
  incidentDescription?: string | null;
  expectedRecoveryAt?: string | null;
}): Promise<ProviderCatalogState> {
  const currentRow = await dbGet<ProviderCatalogStateRow>(
    `SELECT * FROM v8_provider_catalog_states
     WHERE provider_id = ? AND organization_id = ?`,
    [params.providerId, params.organizationId],
    { fallback: true }
  );

  const currentState: ProviderLifecycleState = currentRow
    ? (currentRow.lifecycle_state as ProviderLifecycleState)
    : 'draft';

  if (currentState !== params.targetState && !isValidProviderStateTransition(currentState, params.targetState)) {
    throw new Error(
      `Invalid provider state transition: ${currentState} → ${params.targetState}`
    );
  }

  const stateId = uuidv4();
  const now = new Date().toISOString();

  if (currentRow) {
    await dbRun(
      `UPDATE v8_provider_catalog_states
       SET lifecycle_state = ?, previous_state = ?, reason = ?,
           incident_description = ?, expected_recovery_at = ?,
           transitioned_at = ?, transitioned_by = ?
       WHERE provider_id = ? AND organization_id = ?`,
      [
        params.targetState,
        currentState,
        params.reason ?? null,
        params.incidentDescription ?? null,
        params.expectedRecoveryAt ?? null,
        now,
        params.transitionedBy,
        params.providerId,
        params.organizationId,
      ]
    );

    logger.info(
      `${LOG_PREFIX} Provider catalog state: ${currentState} → ${params.targetState} for ${params.providerId}`
    );

    return {
      stateId: currentRow.state_id,
      providerId: params.providerId,
      organizationId: params.organizationId,
      lifecycleState: params.targetState,
      previousState: currentState,
      reason: params.reason ?? null,
      incidentDescription: params.incidentDescription ?? null,
      expectedRecoveryAt: params.expectedRecoveryAt ?? null,
      transitionedAt: now,
      transitionedBy: params.transitionedBy,
    };
  }

  await dbRun(
    `INSERT INTO v8_provider_catalog_states (
      state_id, provider_id, organization_id, lifecycle_state,
      previous_state, reason, incident_description, expected_recovery_at,
      transitioned_at, transitioned_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      stateId,
      params.providerId,
      params.organizationId,
      params.targetState,
      null,
      params.reason ?? null,
      params.incidentDescription ?? null,
      params.expectedRecoveryAt ?? null,
      now,
      params.transitionedBy,
    ]
  );

  logger.info(
    `${LOG_PREFIX} Provider catalog state created: ${params.targetState} for ${params.providerId}`
  );

  return {
    stateId,
    providerId: params.providerId,
    organizationId: params.organizationId,
    lifecycleState: params.targetState,
    previousState: null,
    reason: params.reason ?? null,
    incidentDescription: params.incidentDescription ?? null,
    expectedRecoveryAt: params.expectedRecoveryAt ?? null,
    transitionedAt: now,
    transitionedBy: params.transitionedBy,
  };
}

export async function getProviderCatalogState(
  providerId: string,
  orgId: string
): Promise<ProviderCatalogState | null> {
  const row = await dbGet<ProviderCatalogStateRow>(
    `SELECT * FROM v8_provider_catalog_states
     WHERE provider_id = ? AND organization_id = ?`,
    [providerId, orgId],
    { fallback: true }
  );

  if (!row) return null;
  return rowToProviderCatalogState(row);
}

export async function listProviderCatalogStates(
  orgId: string
): Promise<ProviderCatalogState[]> {
  const rows = await dbAll<ProviderCatalogStateRow>(
    `SELECT * FROM v8_provider_catalog_states
     WHERE organization_id = ?
     ORDER BY transitioned_at DESC`,
    [orgId],
    { fallback: true }
  );

  return (rows || []).map(rowToProviderCatalogState);
}

// ==========================================
// CONNECTOR HEALTH & CONFLICT RECOVERY (WAVE 12)
// ==========================================

/**
 * Aggregate sync status, unresolved conflicts, and auth state for connector truth health.
 */
export async function getConnectorHealth(
  connectorId: string,
  organizationId: string
): Promise<ConnectorSyncHealthSummary> {
  const auth = await getConnectorAuthState(connectorId, organizationId);
  const authState: ConnectorSyncHealthSummary['authState'] = auth?.authState ?? 'unknown';

  const syncStates = await getObjectSyncStatesByConnector(connectorId, organizationId);

  let worstRank = -1;
  let rollupStatus: ConnectorSyncHealthSummary['syncStatus'] = 'unknown';
  let lastSyncAt: string | null = null;

  for (const s of syncStates) {
    const rank = SYNC_STATUS_RANK[s.syncStatus];
    if (rank > worstRank) {
      worstRank = rank;
      rollupStatus = s.syncStatus;
    }
    if (s.lastSyncedAt) {
      if (!lastSyncAt || s.lastSyncedAt > lastSyncAt) {
        lastSyncAt = s.lastSyncedAt;
      }
    }
  }

  const countRow = await dbGet<{ n: number }>(
    `SELECT COUNT(*) as n
     FROM v8_conflict_records cr
     INNER JOIN v8_business_object_sync_states s ON s.sync_state_id = cr.object_sync_state_id
     WHERE cr.organization_id = ? AND cr.resolved_at IS NULL AND s.connector_id = ?`,
    [organizationId, connectorId],
    { fallback: true }
  );
  const conflictCount = countRow?.n ?? 0;

  const authHealthy = authState === 'healthy' || authState === 'connected_pending_verification';
  const syncClean =
    rollupStatus === 'unknown' || !['error', 'dead_letter', 'conflict'].includes(rollupStatus);
  const healthy = authHealthy && conflictCount === 0 && syncClean;

  return {
    healthy,
    syncStatus: rollupStatus,
    conflictCount,
    lastSyncAt,
    authState,
  };
}

/**
 * List unresolved sync conflicts for an organization (newest first).
 */
export async function getUnresolvedConflicts(
  organizationId: string,
  limit?: number
): Promise<ConflictRecord[]> {
  const cap = limit === undefined ? 500 : Math.min(Math.max(limit, 1), 2000);

  const rows = await dbAll<ConflictRow>(
    `SELECT * FROM v8_conflict_records
     WHERE organization_id = ? AND resolved_at IS NULL
     ORDER BY created_at DESC
     LIMIT ?`,
    [organizationId, cap],
    { fallback: true }
  );

  return (rows || []).map(rowToConflictRecord);
}
