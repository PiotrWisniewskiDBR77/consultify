/**
 * V8 Operator/Admin Surfaces Service
 *
 * Manages connector fleet health, connector packages (Decision W5-9),
 * durable support notes (Decision W5-10), tenant-scoped emergency pause
 * (Decision W5-11), and fleet health signal evaluation.
 */

import { v4 as uuidv4 } from 'uuid';

import type {
  AddSupportNoteParams,
  ConnectorAuthState,
  ConnectorFleetHealthEntry,
  ConnectorPackage,
  DriftState,
  EmergencyPause,
  EmergencyPauseScope,
  FleetHealthSignal,
  FleetHealthSignalType,
  InitiateEmergencyPauseParams,
  InstallPackageForTenantParams,
  OperatorDashboardView,
  PackageCapability,
  PackageLifecycleState,
  PausedConnectorRef,
  ProviderTier,
  RecordFleetHealthParams,
  RegisterPackageParams,
  SupportNote,
  SupportNoteAuthorRole,
  TenantConnectorInstallation,
} from '../../types/operatorAdminSurfaces.js';
import {
  AddSupportNoteParamsSchema,
  FLEET_HEALTH_SIGNAL_THRESHOLDS,
  FleetHealthSignalTypeValues,
  InitiateEmergencyPauseParamsSchema,
  InstallPackageForTenantParamsSchema,
  RecordFleetHealthParamsSchema,
  RegisterPackageParamsSchema,
} from '../../types/operatorAdminSurfaces.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';
import { getActiveEscalations } from './pmSyncAuthService.js';

// ==========================================
// HELPERS
// ==========================================

const LOG_PREFIX = '[V8:OperatorAdmin]';

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

interface FleetHealthRow {
  entry_id: string;
  connector_id: string;
  organization_id: string;
  provider_key: string;
  auth_state: string;
  provider_tier: string;
  last_sync_success: string | null;
  last_sync_failure: string | null;
  staleness_indicator: number;
  drift_state: string;
  dead_letter_count: number;
  conflict_count: number;
  created_at: string;
  updated_at: string;
}

function rowToFleetHealth(row: FleetHealthRow): ConnectorFleetHealthEntry {
  return {
    entryId: row.entry_id,
    connectorId: row.connector_id,
    organizationId: row.organization_id,
    providerKey: row.provider_key,
    authState: row.auth_state as ConnectorAuthState,
    providerTier: row.provider_tier as ProviderTier,
    lastSyncSuccess: row.last_sync_success,
    lastSyncFailure: row.last_sync_failure,
    stalenessIndicator: row.staleness_indicator,
    driftState: row.drift_state as DriftState,
    deadLetterCount: row.dead_letter_count,
    conflictCount: row.conflict_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

interface PackageRow {
  package_id: string;
  provider_key: string;
  package_version: string;
  capabilities: string;
  lifecycle_state: string;
  tenant_installable: number;
  created_at: string;
  updated_at: string;
}

function rowToPackage(row: PackageRow): ConnectorPackage {
  return {
    packageId: row.package_id,
    providerKey: row.provider_key,
    packageVersion: row.package_version,
    capabilities: safeJsonParse<PackageCapability[]>(row.capabilities, []),
    lifecycleState: row.lifecycle_state as PackageLifecycleState,
    tenantInstallable: row.tenant_installable === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

interface InstallationRow {
  installation_id: string;
  package_id: string;
  organization_id: string;
  enabled_by: string;
  configuration_scope: string;
  installed_at: string;
}

function rowToInstallation(row: InstallationRow): TenantConnectorInstallation {
  return {
    installationId: row.installation_id,
    packageId: row.package_id,
    organizationId: row.organization_id,
    enabledBy: row.enabled_by,
    configurationScope: row.configuration_scope,
    installedAt: row.installed_at,
  };
}

interface SupportNoteRow {
  note_id: string;
  incident_ref: string;
  connector_id: string;
  organization_id: string;
  author_id: string;
  author_role: string;
  content: string;
  created_at: string;
}

function rowToSupportNote(row: SupportNoteRow): SupportNote {
  return {
    noteId: row.note_id,
    incidentRef: row.incident_ref,
    connectorId: row.connector_id,
    organizationId: row.organization_id,
    authorId: row.author_id,
    authorRole: row.author_role as SupportNoteAuthorRole,
    content: row.content,
    createdAt: row.created_at,
  };
}

interface EmergencyPauseRow {
  pause_id: string;
  organization_id: string;
  pause_scope: string;
  provider_key: string | null;
  paused_by: string;
  reason: string;
  blast_radius: number;
  paused_at: string;
  resumed_at: string | null;
  resumed_by: string | null;
}

function rowToEmergencyPause(row: EmergencyPauseRow): EmergencyPause {
  return {
    pauseId: row.pause_id,
    organizationId: row.organization_id,
    pauseScope: row.pause_scope as EmergencyPauseScope,
    providerKey: row.provider_key,
    pausedBy: row.paused_by,
    reason: row.reason,
    blastRadius: row.blast_radius,
    pausedAt: row.paused_at,
    resumedAt: row.resumed_at,
    resumedBy: row.resumed_by,
  };
}

// ==========================================
// FLEET HEALTH
// ==========================================

/**
 * Record or update connector fleet health.
 * Uses upsert on (connector_id, organization_id).
 */
export async function recordFleetHealth(
  params: RecordFleetHealthParams
): Promise<ConnectorFleetHealthEntry> {
  const validated = RecordFleetHealthParamsSchema.parse(params);

  const existing = await dbGet<FleetHealthRow>(
    `SELECT * FROM v8_connector_fleet_health
     WHERE connector_id = ? AND organization_id = ?`,
    [validated.connectorId, validated.organizationId],
    { fallback: true }
  );

  const now = new Date().toISOString();

  if (existing) {
    await dbRun(
      `UPDATE v8_connector_fleet_health
       SET provider_key = ?, auth_state = ?, provider_tier = ?,
           last_sync_success = ?, last_sync_failure = ?,
           staleness_indicator = ?, drift_state = ?,
           dead_letter_count = ?, conflict_count = ?, updated_at = ?
       WHERE entry_id = ?`,
      [
        validated.providerKey,
        validated.authState,
        validated.providerTier,
        validated.lastSyncSuccess ?? existing.last_sync_success,
        validated.lastSyncFailure ?? existing.last_sync_failure,
        validated.stalenessIndicator,
        validated.driftState,
        validated.deadLetterCount,
        validated.conflictCount,
        now,
        existing.entry_id,
      ]
    );

    logger.info(`${LOG_PREFIX} Updated fleet health for connector ${validated.connectorId}`);

    return {
      entryId: existing.entry_id,
      connectorId: validated.connectorId,
      organizationId: validated.organizationId,
      providerKey: validated.providerKey,
      authState: validated.authState,
      providerTier: validated.providerTier,
      lastSyncSuccess: validated.lastSyncSuccess ?? existing.last_sync_success,
      lastSyncFailure: validated.lastSyncFailure ?? existing.last_sync_failure,
      stalenessIndicator: validated.stalenessIndicator,
      driftState: validated.driftState,
      deadLetterCount: validated.deadLetterCount,
      conflictCount: validated.conflictCount,
      createdAt: existing.created_at,
      updatedAt: now,
    };
  }

  const entryId = uuidv4();

  await dbRun(
    `INSERT INTO v8_connector_fleet_health (
      entry_id, connector_id, organization_id, provider_key,
      auth_state, provider_tier, last_sync_success, last_sync_failure,
      staleness_indicator, drift_state, dead_letter_count, conflict_count,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      entryId,
      validated.connectorId,
      validated.organizationId,
      validated.providerKey,
      validated.authState,
      validated.providerTier,
      validated.lastSyncSuccess ?? null,
      validated.lastSyncFailure ?? null,
      validated.stalenessIndicator,
      validated.driftState,
      validated.deadLetterCount,
      validated.conflictCount,
      now,
      now,
    ]
  );

  logger.info(
    `${LOG_PREFIX} Recorded fleet health ${entryId} for connector ${validated.connectorId}`
  );

  return {
    entryId,
    connectorId: validated.connectorId,
    organizationId: validated.organizationId,
    providerKey: validated.providerKey,
    authState: validated.authState,
    providerTier: validated.providerTier,
    lastSyncSuccess: validated.lastSyncSuccess ?? null,
    lastSyncFailure: validated.lastSyncFailure ?? null,
    stalenessIndicator: validated.stalenessIndicator,
    driftState: validated.driftState,
    deadLetterCount: validated.deadLetterCount,
    conflictCount: validated.conflictCount,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Get all fleet health entries for an organization.
 */
export async function getFleetHealth(orgId: string): Promise<ConnectorFleetHealthEntry[]> {
  const rows = await dbAll<FleetHealthRow>(
    `SELECT * FROM v8_connector_fleet_health
     WHERE organization_id = ?
     ORDER BY updated_at DESC`,
    [orgId],
    { fallback: true }
  );

  return (rows || []).map(rowToFleetHealth);
}

/**
 * Get fleet health for a specific connector within an org.
 */
export async function getConnectorHealth(
  connectorId: string,
  orgId: string
): Promise<ConnectorFleetHealthEntry | null> {
  const row = await dbGet<FleetHealthRow>(
    `SELECT * FROM v8_connector_fleet_health
     WHERE connector_id = ? AND organization_id = ?`,
    [connectorId, orgId],
    { fallback: true }
  );

  if (!row) return null;
  return rowToFleetHealth(row);
}

// ==========================================
// CONNECTOR PACKAGES (Decision W5-9)
// ==========================================

/**
 * Register a new connector package (platform-managed asset).
 */
export async function registerPackage(params: RegisterPackageParams): Promise<ConnectorPackage> {
  const validated = RegisterPackageParamsSchema.parse(params);

  const packageId = uuidv4();
  const now = new Date().toISOString();

  await dbRun(
    `INSERT INTO v8_connector_packages (
      package_id, provider_key, package_version, capabilities,
      lifecycle_state, tenant_installable, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      packageId,
      validated.providerKey,
      validated.packageVersion,
      JSON.stringify(validated.capabilities),
      validated.lifecycleState,
      validated.tenantInstallable ? 1 : 0,
      now,
      now,
    ]
  );

  logger.info(
    `${LOG_PREFIX} Registered package ${packageId}: ${validated.providerKey}@${validated.packageVersion}`
  );

  return {
    packageId,
    providerKey: validated.providerKey,
    packageVersion: validated.packageVersion,
    capabilities: validated.capabilities,
    lifecycleState: validated.lifecycleState,
    tenantInstallable: validated.tenantInstallable,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Get a connector package by ID.
 */
export async function getPackage(packageId: string): Promise<ConnectorPackage | null> {
  const row = await dbGet<PackageRow>(
    `SELECT * FROM v8_connector_packages WHERE package_id = ?`,
    [packageId],
    { fallback: true }
  );

  if (!row) return null;
  return rowToPackage(row);
}

// ==========================================
// TENANT INSTALLATIONS
// ==========================================

/**
 * Install a connector package for a tenant.
 * Validates that the package exists and is installable.
 */
export async function installPackageForTenant(
  params: InstallPackageForTenantParams
): Promise<TenantConnectorInstallation> {
  const validated = InstallPackageForTenantParamsSchema.parse(params);

  const pkg = await dbGet<PackageRow>(
    `SELECT * FROM v8_connector_packages WHERE package_id = ?`,
    [validated.packageId],
    { fallback: true }
  );

  if (!pkg) {
    throw new Error(`Package ${validated.packageId} not found`);
  }

  if (pkg.tenant_installable !== 1) {
    throw new Error(`Package ${validated.packageId} is not tenant-installable`);
  }

  if (pkg.lifecycle_state === 'retired') {
    throw new Error(`Package ${validated.packageId} is retired and cannot be installed`);
  }

  if (pkg.lifecycle_state === 'deprecated') {
    logger.warn(
      `${LOG_PREFIX} Installing deprecated package ${validated.packageId} for org ${validated.organizationId}`
    );
  }

  const installationId = uuidv4();
  const now = new Date().toISOString();

  await dbRun(
    `INSERT INTO v8_tenant_connector_installations (
      installation_id, package_id, organization_id,
      enabled_by, configuration_scope, installed_at
    ) VALUES (?, ?, ?, ?, ?, ?)`,
    [
      installationId,
      validated.packageId,
      validated.organizationId,
      validated.enabledBy,
      validated.configurationScope,
      now,
    ]
  );

  logger.info(
    `${LOG_PREFIX} Installed package ${validated.packageId} for org ${validated.organizationId}`
  );

  return {
    installationId,
    packageId: validated.packageId,
    organizationId: validated.organizationId,
    enabledBy: validated.enabledBy,
    configurationScope: validated.configurationScope,
    installedAt: now,
  };
}

/**
 * Get all connector installations for a tenant.
 */
export async function getTenantInstallations(
  orgId: string
): Promise<TenantConnectorInstallation[]> {
  const rows = await dbAll<InstallationRow>(
    `SELECT * FROM v8_tenant_connector_installations
     WHERE organization_id = ?
     ORDER BY installed_at DESC`,
    [orgId],
    { fallback: true }
  );

  return (rows || []).map(rowToInstallation);
}

// ==========================================
// SUPPORT NOTES (Decision W5-10)
// ==========================================

/**
 * Add a durable, incident-scoped support note.
 */
export async function addSupportNote(params: AddSupportNoteParams): Promise<SupportNote> {
  const validated = AddSupportNoteParamsSchema.parse(params);

  const noteId = uuidv4();
  const now = new Date().toISOString();

  await dbRun(
    `INSERT INTO v8_support_notes (
      note_id, incident_ref, connector_id, organization_id,
      author_id, author_role, content, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      noteId,
      validated.incidentRef,
      validated.connectorId,
      validated.organizationId,
      validated.authorId,
      validated.authorRole,
      validated.content,
      now,
    ]
  );

  logger.info(`${LOG_PREFIX} Added support note ${noteId} for incident ${validated.incidentRef}`);

  return {
    noteId,
    incidentRef: validated.incidentRef,
    connectorId: validated.connectorId,
    organizationId: validated.organizationId,
    authorId: validated.authorId,
    authorRole: validated.authorRole,
    content: validated.content,
    createdAt: now,
  };
}

/**
 * Get all support notes for a connector within an org.
 */
export async function getSupportNotes(connectorId: string, orgId: string): Promise<SupportNote[]> {
  const rows = await dbAll<SupportNoteRow>(
    `SELECT * FROM v8_support_notes
     WHERE connector_id = ? AND organization_id = ?
     ORDER BY created_at DESC`,
    [connectorId, orgId],
    { fallback: true }
  );

  return (rows || []).map(rowToSupportNote);
}

// ==========================================
// EMERGENCY PAUSE (Decision W5-11)
// ==========================================

/**
 * Initiate a tenant-scoped emergency pause.
 * Requires explicit confirmation via blast radius.
 */
export async function initiateEmergencyPause(
  params: InitiateEmergencyPauseParams
): Promise<EmergencyPause> {
  const validated = InitiateEmergencyPauseParamsSchema.parse(params);

  if (validated.pauseScope === 'provider_type' && !validated.providerKey) {
    throw new Error('providerKey is required when pauseScope is provider_type');
  }

  const pauseId = uuidv4();
  const now = new Date().toISOString();

  await dbRun(
    `INSERT INTO v8_emergency_pauses (
      pause_id, organization_id, pause_scope, provider_key,
      paused_by, reason, blast_radius, paused_at,
      resumed_at, resumed_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      pauseId,
      validated.organizationId,
      validated.pauseScope,
      validated.providerKey ?? null,
      validated.pausedBy,
      validated.reason,
      validated.blastRadius,
      now,
      null,
      null,
    ]
  );

  logger.info(
    `${LOG_PREFIX} Emergency pause ${pauseId} initiated for org ${validated.organizationId} (scope: ${validated.pauseScope})`
  );

  return {
    pauseId,
    organizationId: validated.organizationId,
    pauseScope: validated.pauseScope,
    providerKey: validated.providerKey ?? null,
    pausedBy: validated.pausedBy,
    reason: validated.reason,
    blastRadius: validated.blastRadius,
    pausedAt: now,
    resumedAt: null,
    resumedBy: null,
  };
}

/**
 * Resume from an emergency pause.
 */
export async function resumeFromEmergencyPause(
  pauseId: string,
  resumedBy: string
): Promise<EmergencyPause> {
  const row = await dbGet<EmergencyPauseRow>(
    `SELECT * FROM v8_emergency_pauses WHERE pause_id = ?`,
    [pauseId]
  );

  if (!row) {
    throw new Error(`Emergency pause ${pauseId} not found`);
  }

  if (row.resumed_at) {
    throw new Error(`Emergency pause ${pauseId} is already resumed`);
  }

  const now = new Date().toISOString();

  await dbRun(
    `UPDATE v8_emergency_pauses
     SET resumed_at = ?, resumed_by = ?
     WHERE pause_id = ?`,
    [now, resumedBy, pauseId]
  );

  logger.info(`${LOG_PREFIX} Emergency pause ${pauseId} resumed by ${resumedBy}`);

  return {
    ...rowToEmergencyPause(row),
    resumedAt: now,
    resumedBy,
  };
}

/**
 * Get all active (non-resumed) emergency pauses for an org.
 */
export async function getActiveEmergencyPauses(orgId: string): Promise<EmergencyPause[]> {
  const rows = await dbAll<EmergencyPauseRow>(
    `SELECT * FROM v8_emergency_pauses
     WHERE organization_id = ? AND resumed_at IS NULL
     ORDER BY paused_at DESC`,
    [orgId],
    { fallback: true }
  );

  return (rows || []).map(rowToEmergencyPause);
}

// ==========================================
// FLEET HEALTH SIGNALS
// ==========================================

/**
 * Evaluate fleet health signals against canonical thresholds.
 * Returns all signal evaluations with breach status.
 */
export async function checkFleetHealthSignals(orgId: string): Promise<FleetHealthSignal[]> {
  const healthRows = await dbAll<FleetHealthRow>(
    `SELECT * FROM v8_connector_fleet_health
     WHERE organization_id = ?`,
    [orgId],
    { fallback: true }
  );

  const entries = (healthRows || []).map(rowToFleetHealth);

  const degradedAuthCount = entries.filter(
    (e) => e.authState === 'degraded_reauth_needed' || e.authState === 'degraded_scope_limited'
  ).length;

  const totalEntries = entries.length;

  const failedEntries = entries.filter((e) => e.lastSyncFailure !== null).length;
  const syncFailureRate = totalEntries > 0 ? (failedEntries / totalEntries) * 100 : 0;

  const totalDeadLetters = entries.reduce((sum, e) => sum + e.deadLetterCount, 0);

  const totalConflicts = entries.reduce((sum, e) => sum + e.conflictCount, 0);

  const providerErrorRate = syncFailureRate;

  const staleEntries = entries.filter((e) => e.stalenessIndicator > 0).length;
  const stalenessBreachRate = totalEntries > 0 ? (staleEntries / totalEntries) * 100 : 0;

  const reauthEntries = entries.filter((e) => e.authState === 'degraded_reauth_needed').length;

  const signalValues: Record<FleetHealthSignalType, number> = {
    degraded_auth_count: degradedAuthCount,
    sync_failure_rate: syncFailureRate,
    dead_letter_depth: totalDeadLetters,
    conflict_depth: totalConflicts,
    provider_error_rate: providerErrorRate,
    staleness_breach_rate: stalenessBreachRate,
    reauth_pending_duration: reauthEntries,
  };

  return FleetHealthSignalTypeValues.map((signalType) => {
    const threshold = FLEET_HEALTH_SIGNAL_THRESHOLDS[signalType];
    const currentValue = signalValues[signalType];
    return {
      signalType,
      threshold,
      currentValue,
      breached: currentValue >= threshold,
    };
  });
}

// ==========================================
// OPERATOR DASHBOARD & INCIDENTS (WAVE 12)
// ==========================================

const RECENT_NOTES_DEFAULT_LIMIT = 20;

/**
 * Aggregate fleet health, pauses, auth escalations, and recent support notes.
 */
export async function getOperatorDashboard(organizationId: string): Promise<OperatorDashboardView> {
  const [fleetHealth, activePauses, unresolvedAuthEscalations] = await Promise.all([
    getFleetHealth(organizationId),
    getActiveEmergencyPauses(organizationId),
    getActiveEscalations(organizationId),
  ]);

  const noteRows = await dbAll<SupportNoteRow>(
    `SELECT * FROM v8_support_notes
     WHERE organization_id = ?
     ORDER BY created_at DESC
     LIMIT ?`,
    [organizationId, RECENT_NOTES_DEFAULT_LIMIT],
    { fallback: true }
  );

  return {
    fleetHealth,
    activePauses,
    unresolvedAuthEscalations,
    recentSupportNotes: (noteRows || []).map(rowToSupportNote),
  };
}

/**
 * Connectors currently covered by an active emergency pause (org-wide or provider-scoped).
 */
export async function getPausedConnectors(organizationId: string): Promise<PausedConnectorRef[]> {
  const pauses = await getActiveEmergencyPauses(organizationId);
  const fleet = await getFleetHealth(organizationId);

  const candidates: PausedConnectorRef[] = [];

  for (const p of pauses) {
    if (p.pauseScope === 'all_connectors') {
      for (const e of fleet) {
        candidates.push({
          connectorId: e.connectorId,
          pauseId: p.pauseId,
          pauseScope: p.pauseScope,
          providerKey: p.providerKey,
          pausedAt: p.pausedAt,
        });
      }
    } else if (p.pauseScope === 'provider_type' && p.providerKey) {
      for (const e of fleet.filter((entry) => entry.providerKey === p.providerKey)) {
        candidates.push({
          connectorId: e.connectorId,
          pauseId: p.pauseId,
          pauseScope: p.pauseScope,
          providerKey: p.providerKey,
          pausedAt: p.pausedAt,
        });
      }
    }
  }

  const byConnector = new Map<string, PausedConnectorRef>();
  for (const ref of candidates) {
    const prev = byConnector.get(ref.connectorId);
    if (!prev || ref.pausedAt > prev.pausedAt) {
      byConnector.set(ref.connectorId, ref);
    }
  }

  return [...byConnector.values()];
}

/**
 * Support notes with an incident reference in the last N days (default 7).
 */
export async function getRecentIncidents(
  organizationId: string,
  days?: number
): Promise<SupportNote[]> {
  const windowDays = days === undefined ? 7 : Math.min(Math.max(days, 1), 365);
  const cutoff = new Date(Date.now() - windowDays * 86_400_000).toISOString();

  const rows = await dbAll<SupportNoteRow>(
    `SELECT * FROM v8_support_notes
     WHERE organization_id = ?
     AND incident_ref IS NOT NULL AND incident_ref != ''
     AND created_at >= ?
     ORDER BY created_at DESC`,
    [organizationId, cutoff],
    { fallback: true }
  );

  return (rows || []).map(rowToSupportNote);
}
