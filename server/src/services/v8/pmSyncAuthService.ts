/**
 * V8 PM Sync Auth Baseline Service — Wave 5
 *
 * Production-grade auth lifecycle governance: credential storage,
 * refresh result tracking, transient-failure discrimination (Decision W5-2),
 * degraded-state escalation ladder (Decision W5-3), admin re-binding (Decision W5-1).
 */

import { v4 as uuidv4 } from 'uuid';

import type {
  ConnectionCredentialRef,
  RefreshTimingPolicy,
  AdminReBindRecord,
  LastRefreshResult,
  EscalationLevel,
  StoreCredentialParams,
  RecordRefreshResultParams,
  SetRefreshTimingPolicyParams,
  RecordAdminReBindParams,
} from '../../types/pmSyncAuthBaseline.js';
import {
  TRANSIENT_FAILURE_TYPES,
  AUTH_BREAK_FAILURE_TYPES,
  DEFAULT_ESCALATION_LADDER,
  StoreCredentialParamsSchema,
  RecordRefreshResultParamsSchema,
  SetRefreshTimingPolicyParamsSchema,
  RecordAdminReBindParamsSchema,
} from '../../types/pmSyncAuthBaseline.js';
import type { FailureAction } from '../../types/pmSyncAuthBaseline.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

// ==========================================
// HELPERS
// ==========================================

const LOG_PREFIX = '[V8:PMSyncAuth]';

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

interface CredentialRow {
  credential_id: string;
  connector_id: string;
  organization_id: string;
  provider_account_id: string;
  workspace_or_tenant_id: string;
  scopes_granted: string;
  token_expires_at: string | null;
  last_verification_at: string | null;
  last_refresh_at: string | null;
  last_refresh_result: string | null;
  created_at: string;
  updated_at: string;
}

function rowToCredentialRef(row: CredentialRow): ConnectionCredentialRef {
  return {
    credentialId: row.credential_id,
    connectorId: row.connector_id,
    organizationId: row.organization_id,
    providerAccountId: row.provider_account_id,
    workspaceOrTenantId: row.workspace_or_tenant_id,
    scopesGranted: safeJsonParse<string[]>(row.scopes_granted, []),
    tokenExpiresAt: row.token_expires_at,
    lastVerificationAt: row.last_verification_at,
    lastRefreshAt: row.last_refresh_at,
    lastRefreshResult: row.last_refresh_result as LastRefreshResult | null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

interface PolicyRow {
  policy_id: string;
  provider_family: string;
  organization_id: string;
  typical_token_lifetime_minutes: number;
  refresh_window_minutes: number;
  max_retry_attempts: number;
  created_at: string;
  updated_at: string;
}

function rowToRefreshPolicy(row: PolicyRow): RefreshTimingPolicy {
  return {
    policyId: row.policy_id,
    providerFamily: row.provider_family as RefreshTimingPolicy['providerFamily'],
    organizationId: row.organization_id,
    typicalTokenLifetimeMinutes: row.typical_token_lifetime_minutes,
    refreshWindowMinutes: row.refresh_window_minutes,
    maxRetryAttempts: row.max_retry_attempts,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

interface ReBindRow {
  rebind_id: string;
  connector_id: string;
  organization_id: string;
  old_credential_ref: string;
  new_credential_ref: string;
  actor_id: string;
  reason: string;
  audit_timestamp: string;
}

function rowToReBindRecord(row: ReBindRow): AdminReBindRecord {
  return {
    reBindId: row.rebind_id,
    connectorId: row.connector_id,
    organizationId: row.organization_id,
    oldCredentialRef: row.old_credential_ref,
    newCredentialRef: row.new_credential_ref,
    actorId: row.actor_id,
    reason: row.reason,
    auditTimestamp: row.audit_timestamp,
  };
}

// ==========================================
// CREDENTIAL MANAGEMENT
// ==========================================

/**
 * Store an encrypted credential reference.
 * Upserts on (connector_id, organization_id).
 */
export async function storeCredential(
  params: StoreCredentialParams,
): Promise<ConnectionCredentialRef> {
  const validated = StoreCredentialParamsSchema.parse(params);

  const existing = await dbGet<CredentialRow>(
    `SELECT * FROM v8_connection_credentials
     WHERE connector_id = ? AND organization_id = ?`,
    [validated.connectorId, validated.organizationId],
    { fallback: true },
  );

  const now = new Date().toISOString();

  if (existing) {
    await dbRun(
      `UPDATE v8_connection_credentials
       SET provider_account_id = ?, workspace_or_tenant_id = ?,
           scopes_granted = ?, token_expires_at = ?,
           last_verification_at = ?, updated_at = ?
       WHERE credential_id = ?`,
      [
        validated.providerAccountId,
        validated.workspaceOrTenantId,
        JSON.stringify(validated.scopesGranted),
        validated.tokenExpiresAt ?? null,
        now,
        now,
        existing.credential_id,
      ],
    );

    logger.info(
      `${LOG_PREFIX} Updated credential ${existing.credential_id} for connector ${validated.connectorId}`,
    );

    return {
      credentialId: existing.credential_id,
      connectorId: validated.connectorId,
      organizationId: validated.organizationId,
      providerAccountId: validated.providerAccountId,
      workspaceOrTenantId: validated.workspaceOrTenantId,
      scopesGranted: validated.scopesGranted,
      tokenExpiresAt: validated.tokenExpiresAt ?? null,
      lastVerificationAt: now,
      lastRefreshAt: existing.last_refresh_at,
      lastRefreshResult: existing.last_refresh_result as LastRefreshResult | null,
      createdAt: existing.created_at,
      updatedAt: now,
    };
  }

  const credentialId = uuidv4();

  await dbRun(
    `INSERT INTO v8_connection_credentials (
      credential_id, connector_id, organization_id,
      provider_account_id, workspace_or_tenant_id,
      scopes_granted, token_expires_at,
      last_verification_at, last_refresh_at, last_refresh_result,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      credentialId,
      validated.connectorId,
      validated.organizationId,
      validated.providerAccountId,
      validated.workspaceOrTenantId,
      JSON.stringify(validated.scopesGranted),
      validated.tokenExpiresAt ?? null,
      now,
      null,
      null,
      now,
      now,
    ],
  );

  logger.info(
    `${LOG_PREFIX} Stored credential ${credentialId} for connector ${validated.connectorId}`,
  );

  return {
    credentialId,
    connectorId: validated.connectorId,
    organizationId: validated.organizationId,
    providerAccountId: validated.providerAccountId,
    workspaceOrTenantId: validated.workspaceOrTenantId,
    scopesGranted: validated.scopesGranted,
    tokenExpiresAt: validated.tokenExpiresAt ?? null,
    lastVerificationAt: now,
    lastRefreshAt: null,
    lastRefreshResult: null,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Get credential reference for a connector within an org.
 */
export async function getCredential(
  connectorId: string,
  orgId: string,
): Promise<ConnectionCredentialRef | null> {
  const row = await dbGet<CredentialRow>(
    `SELECT * FROM v8_connection_credentials
     WHERE connector_id = ? AND organization_id = ?`,
    [connectorId, orgId],
    { fallback: true },
  );

  if (!row) return null;
  return rowToCredentialRef(row);
}

// ==========================================
// REFRESH RESULT TRACKING
// ==========================================

/**
 * Record the result of a token refresh attempt.
 * Updates last_refresh_at, last_refresh_result on the credential.
 */
export async function recordRefreshResult(
  params: RecordRefreshResultParams,
): Promise<ConnectionCredentialRef> {
  const validated = RecordRefreshResultParamsSchema.parse(params);

  const existing = await dbGet<CredentialRow>(
    `SELECT * FROM v8_connection_credentials
     WHERE connector_id = ? AND organization_id = ?`,
    [validated.connectorId, validated.organizationId],
    { fallback: true },
  );

  if (!existing) {
    throw new Error(
      `No credential found for connector ${validated.connectorId} in org ${validated.organizationId}`,
    );
  }

  const now = new Date().toISOString();

  await dbRun(
    `UPDATE v8_connection_credentials
     SET last_refresh_at = ?, last_refresh_result = ?, updated_at = ?
     WHERE credential_id = ?`,
    [now, validated.result, now, existing.credential_id],
  );

  logger.info(
    `${LOG_PREFIX} Recorded refresh result '${validated.result}' for connector ${validated.connectorId}`,
  );

  return {
    ...rowToCredentialRef(existing),
    lastRefreshAt: now,
    lastRefreshResult: validated.result,
    updatedAt: now,
  };
}

// ==========================================
// FAILURE CLASSIFICATION (Decision W5-2)
// ==========================================

/**
 * Classify an error type as transient (retry_later) or auth break (reauth_now).
 *
 * Decision W5-2: Provider-family criteria under one shared doctrine.
 * - retry_later: network timeout, rate limit, transient 5xx, temporary outage, webhook delivery issue
 * - reauth_now: expired/revoked token, missing scope, invalid refresh, account disconnected, user removed
 */
export function classifyFailure(errorType: string): FailureAction {
  if (TRANSIENT_FAILURE_TYPES.has(errorType)) {
    return 'retry_later';
  }
  if (AUTH_BREAK_FAILURE_TYPES.has(errorType)) {
    return 'reauth_now';
  }
  logger.warn(`${LOG_PREFIX} Unknown failure type '${errorType}', defaulting to reauth_now`);
  return 'reauth_now';
}

// ==========================================
// ESCALATION LADDER (Decision W5-3)
// ==========================================

/**
 * Check the escalation level for a connector based on how long it has been
 * in a degraded state.
 *
 * Decision W5-3: 4h → degraded, 24h → critical, 72h → disconnected candidate.
 * Uses the most recent auth state transition to degraded_reauth_needed.
 */
export async function checkEscalationLevel(
  connectorId: string,
  orgId: string,
): Promise<EscalationLevel> {
  const row = await dbGet<{ auth_state: string; transitioned_at: string }>(
    `SELECT auth_state, transitioned_at FROM v8_connector_auth_states
     WHERE connector_id = ? AND organization_id = ?
     ORDER BY transitioned_at DESC LIMIT 1`,
    [connectorId, orgId],
    { fallback: true },
  );

  if (!row) return 'healthy';

  const isDegraded =
    row.auth_state === 'degraded_reauth_needed' ||
    row.auth_state === 'degraded_scope_limited';

  if (!isDegraded) return 'healthy';

  const degradedSince = new Date(row.transitioned_at).getTime();
  const now = Date.now();
  const hoursInDegraded = (now - degradedSince) / (1000 * 60 * 60);

  const ladder = DEFAULT_ESCALATION_LADDER;

  if (hoursInDegraded >= ladder.disconnectedCandidateHours) {
    return 'disconnected_candidate';
  }
  if (hoursInDegraded >= ladder.criticalThresholdHours) {
    return 'critical';
  }
  if (hoursInDegraded >= ladder.degradedThresholdHours) {
    return 'degraded';
  }

  return 'healthy';
}

// ==========================================
// REFRESH TIMING POLICIES
// ==========================================

/**
 * Set or update a refresh timing policy for a provider family within an org.
 * Upserts on (provider_family, organization_id).
 */
export async function setRefreshTimingPolicy(
  params: SetRefreshTimingPolicyParams,
): Promise<RefreshTimingPolicy> {
  const validated = SetRefreshTimingPolicyParamsSchema.parse(params);

  const existing = await dbGet<PolicyRow>(
    `SELECT * FROM v8_refresh_timing_policies
     WHERE provider_family = ? AND organization_id = ?`,
    [validated.providerFamily, validated.organizationId],
    { fallback: true },
  );

  const now = new Date().toISOString();

  if (existing) {
    await dbRun(
      `UPDATE v8_refresh_timing_policies
       SET typical_token_lifetime_minutes = ?, refresh_window_minutes = ?,
           max_retry_attempts = ?, updated_at = ?
       WHERE policy_id = ?`,
      [
        validated.typicalTokenLifetimeMinutes,
        validated.refreshWindowMinutes,
        validated.maxRetryAttempts,
        now,
        existing.policy_id,
      ],
    );

    logger.info(
      `${LOG_PREFIX} Updated refresh policy ${existing.policy_id} for ${validated.providerFamily}`,
    );

    return {
      policyId: existing.policy_id,
      providerFamily: validated.providerFamily,
      organizationId: validated.organizationId,
      typicalTokenLifetimeMinutes: validated.typicalTokenLifetimeMinutes,
      refreshWindowMinutes: validated.refreshWindowMinutes,
      maxRetryAttempts: validated.maxRetryAttempts,
      createdAt: existing.created_at,
      updatedAt: now,
    };
  }

  const policyId = uuidv4();

  await dbRun(
    `INSERT INTO v8_refresh_timing_policies (
      policy_id, provider_family, organization_id,
      typical_token_lifetime_minutes, refresh_window_minutes,
      max_retry_attempts, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      policyId,
      validated.providerFamily,
      validated.organizationId,
      validated.typicalTokenLifetimeMinutes,
      validated.refreshWindowMinutes,
      validated.maxRetryAttempts,
      now,
      now,
    ],
  );

  logger.info(
    `${LOG_PREFIX} Created refresh policy ${policyId} for ${validated.providerFamily}`,
  );

  return {
    policyId,
    providerFamily: validated.providerFamily,
    organizationId: validated.organizationId,
    typicalTokenLifetimeMinutes: validated.typicalTokenLifetimeMinutes,
    refreshWindowMinutes: validated.refreshWindowMinutes,
    maxRetryAttempts: validated.maxRetryAttempts,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Get refresh timing policy for a provider family within an org.
 */
export async function getRefreshTimingPolicy(
  providerFamily: string,
  orgId: string,
): Promise<RefreshTimingPolicy | null> {
  const row = await dbGet<PolicyRow>(
    `SELECT * FROM v8_refresh_timing_policies
     WHERE provider_family = ? AND organization_id = ?`,
    [providerFamily, orgId],
    { fallback: true },
  );

  if (!row) return null;
  return rowToRefreshPolicy(row);
}

// ==========================================
// ADMIN RE-BIND (Decision W5-1)
// ==========================================

/**
 * Record an admin re-bind event. Re-bind must be explicit, auditable,
 * and policy-checked (Decision W5-1).
 */
export async function recordAdminReBind(
  params: RecordAdminReBindParams,
): Promise<AdminReBindRecord> {
  const validated = RecordAdminReBindParamsSchema.parse(params);

  const reBindId = uuidv4();
  const now = new Date().toISOString();

  await dbRun(
    `INSERT INTO v8_admin_rebind_records (
      rebind_id, connector_id, organization_id,
      old_credential_ref, new_credential_ref,
      actor_id, reason, audit_timestamp
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      reBindId,
      validated.connectorId,
      validated.organizationId,
      validated.oldCredentialRef,
      validated.newCredentialRef,
      validated.actorId,
      validated.reason,
      now,
    ],
  );

  logger.info(
    `${LOG_PREFIX} Admin re-bind ${reBindId}: connector ${validated.connectorId} by ${validated.actorId}`,
  );

  return {
    reBindId,
    connectorId: validated.connectorId,
    organizationId: validated.organizationId,
    oldCredentialRef: validated.oldCredentialRef,
    newCredentialRef: validated.newCredentialRef,
    actorId: validated.actorId,
    reason: validated.reason,
    auditTimestamp: now,
  };
}

/**
 * Get re-bind history for a connector within an org, ordered by most recent first.
 */
export async function getReBindHistory(
  connectorId: string,
  orgId: string,
): Promise<AdminReBindRecord[]> {
  const rows = await dbAll<ReBindRow>(
    `SELECT * FROM v8_admin_rebind_records
     WHERE connector_id = ? AND organization_id = ?
     ORDER BY audit_timestamp DESC`,
    [connectorId, orgId],
    { fallback: true },
  );

  return (rows || []).map(rowToReBindRecord);
}
