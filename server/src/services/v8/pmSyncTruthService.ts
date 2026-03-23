/**
 * V8 PM Sync Platform Truth Service
 *
 * Manages connector auth lifecycle, provider depth profiles,
 * per-object sync state, and conflict records with org-level isolation.
 */

import { v4 as uuidv4 } from 'uuid';

import type {
  ConnectorAuthRecord,
  ConnectorAuthState,
  ProviderDepthProfile,
  BusinessObjectSyncState,
  ConflictRecord,
  SetConnectorAuthStateParams,
  RegisterProviderProfileParams,
  UpdateObjectSyncStateParams,
  RecordConflictParams,
  ParityScore,
  ConflictResolutionPath,
} from '../../types/pmSyncTruth.js';
import {
  AUTH_STATE_TRANSITIONS,
  SetConnectorAuthStateParamsSchema,
  RegisterProviderProfileParamsSchema,
  UpdateObjectSyncStateParamsSchema,
  RecordConflictParamsSchema,
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
    resolvedAt: row.resolved_at,
    resolvedBy: row.resolved_by,
    createdAt: row.created_at,
  };
}

// ==========================================
// AUTH STATE MANAGEMENT
// ==========================================

export function isValidAuthTransition(
  current: ConnectorAuthState,
  target: ConnectorAuthState,
): boolean {
  const allowed = AUTH_STATE_TRANSITIONS[current];
  return (allowed as readonly string[]).includes(target);
}

/**
 * Transition a connector's auth state with state-machine validation.
 * First transition from `not_connected` is always allowed (initial state).
 */
export async function setConnectorAuthState(
  params: SetConnectorAuthStateParams,
): Promise<ConnectorAuthRecord> {
  const validated = SetConnectorAuthStateParamsSchema.parse(params);

  const currentRow = await dbGet<AuthStateRow>(
    `SELECT * FROM v8_connector_auth_states
     WHERE connector_id = ? AND organization_id = ?
     ORDER BY transitioned_at DESC LIMIT 1`,
    [validated.connectorId, validated.organizationId],
    { fallback: true },
  );

  const currentState: ConnectorAuthState = currentRow
    ? (currentRow.auth_state as ConnectorAuthState)
    : 'not_connected';

  if (currentRow && !isValidAuthTransition(currentState, validated.targetState)) {
    throw new Error(
      `Invalid auth state transition: ${currentState} → ${validated.targetState}`,
    );
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
    ],
  );

  logger.info(
    `${LOG_PREFIX} Auth state transition: ${currentState} → ${validated.targetState} for connector ${validated.connectorId}`,
  );

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
  orgId: string,
): Promise<ConnectorAuthRecord | null> {
  const row = await dbGet<AuthStateRow>(
    `SELECT * FROM v8_connector_auth_states
     WHERE connector_id = ? AND organization_id = ?
     ORDER BY transitioned_at DESC LIMIT 1`,
    [connectorId, orgId],
    { fallback: true },
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
  params: RegisterProviderProfileParams,
): Promise<ProviderDepthProfile> {
  const validated = RegisterProviderProfileParamsSchema.parse(params);

  const existing = await dbGet<ProviderProfileRow>(
    `SELECT * FROM v8_provider_depth_profiles
     WHERE provider_id = ? AND organization_id = ?`,
    [validated.providerId, validated.organizationId],
    { fallback: true },
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
      ],
    );

    logger.info(`${LOG_PREFIX} Updated provider profile ${existing.profile_id} for ${validated.providerId}`);

    return {
      profileId: existing.profile_id,
      providerId: validated.providerId,
      providerName: validated.providerName,
      tier: validated.tier,
      parityDimensions: validated.parityDimensions,
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
    ],
  );

  logger.info(`${LOG_PREFIX} Registered provider profile ${profileId} for ${validated.providerId}`);

  return {
    profileId,
    providerId: validated.providerId,
    providerName: validated.providerName,
    tier: validated.tier,
    parityDimensions: validated.parityDimensions,
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
  orgId: string,
): Promise<ProviderDepthProfile | null> {
  const row = await dbGet<ProviderProfileRow>(
    `SELECT * FROM v8_provider_depth_profiles
     WHERE provider_id = ? AND organization_id = ?`,
    [providerId, orgId],
    { fallback: true },
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
  params: UpdateObjectSyncStateParams,
): Promise<BusinessObjectSyncState> {
  const validated = UpdateObjectSyncStateParamsSchema.parse(params);

  const now = new Date().toISOString();

  const existing = await dbGet<SyncStateRow>(
    `SELECT * FROM v8_business_object_sync_states
     WHERE object_type = ? AND object_id = ? AND connector_id = ? AND organization_id = ?`,
    [validated.objectType, validated.objectId, validated.connectorId, validated.organizationId],
    { fallback: true },
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
      ],
    );

    logger.info(
      `${LOG_PREFIX} Updated sync state for ${validated.objectType}:${validated.objectId} → ${validated.syncStatus}`,
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
    ],
  );

  logger.info(
    `${LOG_PREFIX} Created sync state ${syncStateId} for ${validated.objectType}:${validated.objectId}`,
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
  orgId: string,
): Promise<BusinessObjectSyncState | null> {
  const row = await dbGet<SyncStateRow>(
    `SELECT * FROM v8_business_object_sync_states
     WHERE object_type = ? AND object_id = ? AND organization_id = ?
     ORDER BY updated_at DESC LIMIT 1`,
    [objectType, objectId, orgId],
    { fallback: true },
  );

  if (!row) return null;
  return rowToSyncState(row);
}

/**
 * Get all sync states for a connector within an org.
 */
export async function getObjectSyncStatesByConnector(
  connectorId: string,
  orgId: string,
): Promise<BusinessObjectSyncState[]> {
  const rows = await dbAll<SyncStateRow>(
    `SELECT * FROM v8_business_object_sync_states
     WHERE connector_id = ? AND organization_id = ?
     ORDER BY updated_at DESC`,
    [connectorId, orgId],
    { fallback: true },
  );

  return (rows || []).map(rowToSyncState);
}

// ==========================================
// CONFLICT RECORDS
// ==========================================

/**
 * Record a new conflict instance.
 */
export async function recordConflict(
  params: RecordConflictParams,
): Promise<ConflictRecord> {
  const validated = RecordConflictParamsSchema.parse(params);

  const conflictId = uuidv4();
  const now = new Date().toISOString();

  await dbRun(
    `INSERT INTO v8_conflict_records (
      conflict_id, object_sync_state_id, organization_id,
      conflict_class, severity, resolution_path,
      resolved_at, resolved_by, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      conflictId,
      validated.objectSyncStateId,
      validated.organizationId,
      validated.conflictClass,
      validated.severity,
      null,
      null,
      null,
      now,
    ],
  );

  logger.info(
    `${LOG_PREFIX} Recorded conflict ${conflictId}: ${validated.conflictClass} (${validated.severity})`,
  );

  return {
    conflictId,
    objectSyncStateId: validated.objectSyncStateId,
    organizationId: validated.organizationId,
    conflictClass: validated.conflictClass,
    severity: validated.severity,
    resolutionPath: null,
    resolvedAt: null,
    resolvedBy: null,
    createdAt: now,
  };
}

/**
 * Resolve an existing conflict.
 */
export async function resolveConflict(
  conflictId: string,
  resolvedBy: string,
  resolutionPath: ConflictResolutionPath,
): Promise<ConflictRecord> {
  const now = new Date().toISOString();

  const row = await dbGet<ConflictRow>(
    `SELECT * FROM v8_conflict_records WHERE conflict_id = ?`,
    [conflictId],
  );

  if (!row) {
    throw new Error(`Conflict ${conflictId} not found`);
  }

  if (row.resolved_at) {
    throw new Error(`Conflict ${conflictId} is already resolved`);
  }

  await dbRun(
    `UPDATE v8_conflict_records
     SET resolution_path = ?, resolved_at = ?, resolved_by = ?
     WHERE conflict_id = ?`,
    [resolutionPath, now, resolvedBy, conflictId],
  );

  logger.info(`${LOG_PREFIX} Resolved conflict ${conflictId} via ${resolutionPath}`);

  return {
    ...rowToConflictRecord(row),
    resolutionPath,
    resolvedAt: now,
    resolvedBy,
  };
}

/**
 * Get all conflicts for a specific object sync state.
 */
export async function getConflictsByObject(
  objectSyncStateId: string,
  orgId: string,
): Promise<ConflictRecord[]> {
  const rows = await dbAll<ConflictRow>(
    `SELECT * FROM v8_conflict_records
     WHERE object_sync_state_id = ? AND organization_id = ?
     ORDER BY created_at DESC`,
    [objectSyncStateId, orgId],
    { fallback: true },
  );

  return (rows || []).map(rowToConflictRecord);
}
