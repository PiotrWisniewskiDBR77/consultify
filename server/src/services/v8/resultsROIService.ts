/**
 * V8 Results / ROI Continuity Service
 *
 * Core primitives for dual-mode KPI management, deviation governance,
 * ROI realization tracking, executive review packs, and KPI-Finance reconciliation.
 *
 * Decision W6-5: Results starts reconciliation, Finance resolves finance-side meaning.
 * Decision W6-6: Standalone KPI/ROI governance events in scope — dual-mode logic honored.
 * Decision W6-7: ExecutiveReviewPack is Results-native; Reports consumes as snapshot source.
 */

import { v4 as uuidv4 } from 'uuid';

import type {
  KPIDefinition,
  KPIStatus,
  DeviationRecord,
  ROIRealizationEntry,
  ExecutiveReviewPack,
  KPIFinanceReconciliation,
  ReconciliationStatus,
  KPISummary,
  DeviationHighlight,
  ROISnapshot,
  CreateKPIParams,
  RecordDeviationParams,
  RecordROIRealizationParams,
  CreateExecutiveReviewPackParams,
  InitiateReconciliationParams,
} from '../../types/resultsROIContinuity.js';
import {
  CreateKPIParamsSchema,
  RecordDeviationParamsSchema,
  RecordROIRealizationParamsSchema,
  CreateExecutiveReviewPackParamsSchema,
  InitiateReconciliationParamsSchema,
  KPI_STATUS_TRANSITIONS,
  KPIStatusValues,
  ReconciliationStatusValues,
} from '../../types/resultsROIContinuity.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

// ==========================================
// HELPERS
// ==========================================

const LOG_PREFIX = '[V8:ResultsROI]';

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

interface KPIRow {
  kpi_id: string;
  organization_id: string;
  name: string;
  mode: string;
  initiative_id: string | null;
  metric_type: string;
  baseline_value: number | null;
  target_value: number | null;
  current_value: number | null;
  measurement_cadence: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface DeviationRow {
  deviation_id: string;
  organization_id: string;
  kpi_id: string;
  deviation_type: string;
  severity: string;
  action_required: string;
  escalated_to: string | null;
  created_at: string;
}

interface ROIRow {
  entry_id: string;
  organization_id: string;
  kpi_id: string;
  initiative_id: string | null;
  realized_value: number;
  period: string;
  provenance_ref: string | null;
  verified_by: string | null;
  created_at: string;
}

interface ReviewPackRow {
  pack_id: string;
  organization_id: string;
  review_period: string;
  kpi_summaries: string;
  deviation_highlights: string;
  roi_snapshot: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface ReconciliationRow {
  reconciliation_id: string;
  organization_id: string;
  kpi_id: string;
  finance_ref: string;
  reconciliation_status: string;
  initiated_by: string;
  created_at: string;
  updated_at: string;
}

// ==========================================
// ROW MAPPERS
// ==========================================

function rowToKPI(row: KPIRow): KPIDefinition {
  return {
    kpiId: row.kpi_id,
    organizationId: row.organization_id,
    name: row.name,
    mode: row.mode as KPIDefinition['mode'],
    initiativeId: row.initiative_id,
    metricType: row.metric_type as KPIDefinition['metricType'],
    baselineValue: row.baseline_value,
    targetValue: row.target_value,
    currentValue: row.current_value,
    measurementCadence: row.measurement_cadence as KPIDefinition['measurementCadence'],
    status: row.status as KPIStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToDeviation(row: DeviationRow): DeviationRecord {
  return {
    deviationId: row.deviation_id,
    organizationId: row.organization_id,
    kpiId: row.kpi_id,
    deviationType: row.deviation_type as DeviationRecord['deviationType'],
    severity: row.severity as DeviationRecord['severity'],
    actionRequired: row.action_required,
    escalatedTo: row.escalated_to,
    createdAt: row.created_at,
  };
}

function rowToROI(row: ROIRow): ROIRealizationEntry {
  return {
    entryId: row.entry_id,
    organizationId: row.organization_id,
    kpiId: row.kpi_id,
    initiativeId: row.initiative_id,
    realizedValue: row.realized_value,
    period: row.period,
    provenanceRef: row.provenance_ref,
    verifiedBy: row.verified_by,
    createdAt: row.created_at,
  };
}

function rowToReviewPack(row: ReviewPackRow): ExecutiveReviewPack {
  return {
    packId: row.pack_id,
    organizationId: row.organization_id,
    reviewPeriod: row.review_period,
    kpiSummaries: safeJsonParse<KPISummary[]>(row.kpi_summaries, []),
    deviationHighlights: safeJsonParse<DeviationHighlight[]>(row.deviation_highlights, []),
    roiSnapshot: safeJsonParse<ROISnapshot>(row.roi_snapshot, {
      totalRealized: 0,
      entriesCount: 0,
      period: '',
    }),
    status: row.status as ExecutiveReviewPack['status'],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToReconciliation(row: ReconciliationRow): KPIFinanceReconciliation {
  return {
    reconciliationId: row.reconciliation_id,
    organizationId: row.organization_id,
    kpiId: row.kpi_id,
    financeRef: row.finance_ref,
    reconciliationStatus: row.reconciliation_status as KPIFinanceReconciliation['reconciliationStatus'],
    initiatedBy: row.initiated_by as KPIFinanceReconciliation['initiatedBy'],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ==========================================
// PUBLIC API
// ==========================================

/**
 * Create a KPI definition in dual-mode (initiative-linked or standalone).
 * Decision W6-6: standalone mode is first-class.
 */
export async function createKPI(params: CreateKPIParams): Promise<KPIDefinition> {
  const validated = CreateKPIParamsSchema.parse(params);

  const kpiId = uuidv4();
  const now = new Date().toISOString();

  const kpi: KPIDefinition = {
    kpiId,
    organizationId: validated.organizationId,
    name: validated.name,
    mode: validated.mode,
    initiativeId: validated.initiativeId ?? null,
    metricType: validated.metricType,
    baselineValue: validated.baselineValue ?? null,
    targetValue: validated.targetValue ?? null,
    currentValue: validated.currentValue ?? null,
    measurementCadence: validated.measurementCadence,
    status: 'design',
    createdAt: now,
    updatedAt: now,
  };

  await dbRun(
    `INSERT INTO v8_kpi_definitions (
      kpi_id, organization_id, name, mode, initiative_id,
      metric_type, baseline_value, target_value, current_value,
      measurement_cadence, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      kpi.kpiId,
      kpi.organizationId,
      kpi.name,
      kpi.mode,
      kpi.initiativeId,
      kpi.metricType,
      kpi.baselineValue,
      kpi.targetValue,
      kpi.currentValue,
      kpi.measurementCadence,
      kpi.status,
      kpi.createdAt,
      kpi.updatedAt,
    ],
  );

  logger.info(`${LOG_PREFIX} Created KPI ${kpiId} (${kpi.mode}) for org ${kpi.organizationId}`);
  return kpi;
}

/**
 * Retrieve a KPI by ID with organization-level isolation.
 */
export async function getKPI(
  kpiId: string,
  organizationId: string,
): Promise<KPIDefinition | null> {
  const row = await dbGet<KPIRow>(
    `SELECT * FROM v8_kpi_definitions
     WHERE kpi_id = ? AND organization_id = ?`,
    [kpiId, organizationId],
    { fallback: true },
  );

  if (!row) return null;
  return rowToKPI(row);
}

/**
 * Advance a KPI through its status lifecycle.
 * Validates transition against KPI_STATUS_TRANSITIONS.
 */
export async function updateKPIStatus(
  kpiId: string,
  organizationId: string,
  newStatus: KPIStatus,
): Promise<KPIDefinition> {
  if (!KPIStatusValues.includes(newStatus)) {
    throw new Error(`Invalid KPI status: ${newStatus}`);
  }

  const existing = await getKPI(kpiId, organizationId);
  if (!existing) {
    throw new Error(`KPI ${kpiId} not found in organization ${organizationId}`);
  }

  const allowedTransitions = KPI_STATUS_TRANSITIONS[existing.status];
  if (!allowedTransitions.includes(newStatus)) {
    throw new Error(
      `Invalid status transition: ${existing.status} → ${newStatus}. ` +
      `Allowed: ${allowedTransitions.join(', ') || 'none (terminal state)'}`,
    );
  }

  const now = new Date().toISOString();

  await dbRun(
    `UPDATE v8_kpi_definitions
     SET status = ?, updated_at = ?
     WHERE kpi_id = ? AND organization_id = ?`,
    [newStatus, now, kpiId, organizationId],
  );

  const updated: KPIDefinition = { ...existing, status: newStatus, updatedAt: now };
  logger.info(`${LOG_PREFIX} KPI ${kpiId} status: ${existing.status} → ${newStatus}`);
  return updated;
}

/**
 * Record a deviation against a KPI — closed-loop governance.
 */
export async function recordDeviation(
  params: RecordDeviationParams,
): Promise<DeviationRecord> {
  const validated = RecordDeviationParamsSchema.parse(params);

  const deviationId = uuidv4();
  const now = new Date().toISOString();

  const record: DeviationRecord = {
    deviationId,
    organizationId: validated.organizationId,
    kpiId: validated.kpiId,
    deviationType: validated.deviationType,
    severity: validated.severity,
    actionRequired: validated.actionRequired,
    escalatedTo: validated.escalatedTo ?? null,
    createdAt: now,
  };

  await dbRun(
    `INSERT INTO v8_deviation_records (
      deviation_id, organization_id, kpi_id, deviation_type,
      severity, action_required, escalated_to, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      record.deviationId,
      record.organizationId,
      record.kpiId,
      record.deviationType,
      record.severity,
      record.actionRequired,
      record.escalatedTo,
      record.createdAt,
    ],
  );

  logger.info(`${LOG_PREFIX} Recorded deviation ${deviationId} for KPI ${record.kpiId}`);
  return record;
}

/**
 * Retrieve all deviations for a KPI, scoped to organization.
 */
export async function getDeviationsByKPI(
  kpiId: string,
  organizationId: string,
): Promise<DeviationRecord[]> {
  const rows = await dbAll<DeviationRow>(
    `SELECT * FROM v8_deviation_records
     WHERE kpi_id = ? AND organization_id = ?
     ORDER BY created_at ASC`,
    [kpiId, organizationId],
    { fallback: true },
  );

  return (rows || []).map(rowToDeviation);
}

/**
 * Record a ROI realization entry — benefits tracking.
 */
export async function recordROIRealization(
  params: RecordROIRealizationParams,
): Promise<ROIRealizationEntry> {
  const validated = RecordROIRealizationParamsSchema.parse(params);

  const entryId = uuidv4();
  const now = new Date().toISOString();

  const entry: ROIRealizationEntry = {
    entryId,
    organizationId: validated.organizationId,
    kpiId: validated.kpiId,
    initiativeId: validated.initiativeId ?? null,
    realizedValue: validated.realizedValue,
    period: validated.period,
    provenanceRef: validated.provenanceRef ?? null,
    verifiedBy: validated.verifiedBy ?? null,
    createdAt: now,
  };

  await dbRun(
    `INSERT INTO v8_roi_realization_entries (
      entry_id, organization_id, kpi_id, initiative_id,
      realized_value, period, provenance_ref, verified_by, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      entry.entryId,
      entry.organizationId,
      entry.kpiId,
      entry.initiativeId,
      entry.realizedValue,
      entry.period,
      entry.provenanceRef,
      entry.verifiedBy,
      entry.createdAt,
    ],
  );

  logger.info(`${LOG_PREFIX} Recorded ROI entry ${entryId} for KPI ${entry.kpiId}`);
  return entry;
}

/**
 * Retrieve ROI realization entries by initiative, scoped to organization.
 */
export async function getROIByInitiative(
  initiativeId: string,
  organizationId: string,
): Promise<ROIRealizationEntry[]> {
  const rows = await dbAll<ROIRow>(
    `SELECT * FROM v8_roi_realization_entries
     WHERE initiative_id = ? AND organization_id = ?
     ORDER BY created_at ASC`,
    [initiativeId, organizationId],
    { fallback: true },
  );

  return (rows || []).map(rowToROI);
}

/**
 * Create an executive review pack (Decision W6-7: Results-native).
 */
export async function createExecutiveReviewPack(
  params: CreateExecutiveReviewPackParams,
): Promise<ExecutiveReviewPack> {
  const validated = CreateExecutiveReviewPackParamsSchema.parse(params);

  const packId = uuidv4();
  const now = new Date().toISOString();

  const pack: ExecutiveReviewPack = {
    packId,
    organizationId: validated.organizationId,
    reviewPeriod: validated.reviewPeriod,
    kpiSummaries: validated.kpiSummaries,
    deviationHighlights: validated.deviationHighlights,
    roiSnapshot: validated.roiSnapshot,
    status: 'draft',
    createdAt: now,
    updatedAt: now,
  };

  await dbRun(
    `INSERT INTO v8_executive_review_packs (
      pack_id, organization_id, review_period,
      kpi_summaries, deviation_highlights, roi_snapshot,
      status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      pack.packId,
      pack.organizationId,
      pack.reviewPeriod,
      JSON.stringify(pack.kpiSummaries),
      JSON.stringify(pack.deviationHighlights),
      JSON.stringify(pack.roiSnapshot),
      pack.status,
      pack.createdAt,
      pack.updatedAt,
    ],
  );

  logger.info(`${LOG_PREFIX} Created executive review pack ${packId} for period ${pack.reviewPeriod}`);
  return pack;
}

/**
 * Retrieve an executive review pack by ID with organization-level isolation.
 */
export async function getExecutiveReviewPack(
  packId: string,
  organizationId: string,
): Promise<ExecutiveReviewPack | null> {
  const row = await dbGet<ReviewPackRow>(
    `SELECT * FROM v8_executive_review_packs
     WHERE pack_id = ? AND organization_id = ?`,
    [packId, organizationId],
    { fallback: true },
  );

  if (!row) return null;
  return rowToReviewPack(row);
}

/**
 * Initiate a KPI-Finance reconciliation (Decision W6-5: Results starts).
 */
export async function initiateReconciliation(
  params: InitiateReconciliationParams,
): Promise<KPIFinanceReconciliation> {
  const validated = InitiateReconciliationParamsSchema.parse(params);

  const reconciliationId = uuidv4();
  const now = new Date().toISOString();

  const reconciliation: KPIFinanceReconciliation = {
    reconciliationId,
    organizationId: validated.organizationId,
    kpiId: validated.kpiId,
    financeRef: validated.financeRef,
    reconciliationStatus: 'pending',
    initiatedBy: validated.initiatedBy,
    createdAt: now,
    updatedAt: now,
  };

  await dbRun(
    `INSERT INTO v8_kpi_finance_reconciliations (
      reconciliation_id, organization_id, kpi_id, finance_ref,
      reconciliation_status, initiated_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      reconciliation.reconciliationId,
      reconciliation.organizationId,
      reconciliation.kpiId,
      reconciliation.financeRef,
      reconciliation.reconciliationStatus,
      reconciliation.initiatedBy,
      reconciliation.createdAt,
      reconciliation.updatedAt,
    ],
  );

  logger.info(
    `${LOG_PREFIX} Initiated reconciliation ${reconciliationId} for KPI ${reconciliation.kpiId} by ${reconciliation.initiatedBy}`,
  );
  return reconciliation;
}

/**
 * Resolve a KPI-Finance reconciliation (Decision W6-5: Finance resolves).
 */
export async function resolveReconciliation(
  reconciliationId: string,
  organizationId: string,
  newStatus: ReconciliationStatus,
): Promise<KPIFinanceReconciliation> {
  if (!ReconciliationStatusValues.includes(newStatus)) {
    throw new Error(`Invalid reconciliation status: ${newStatus}`);
  }

  const row = await dbGet<ReconciliationRow>(
    `SELECT * FROM v8_kpi_finance_reconciliations
     WHERE reconciliation_id = ? AND organization_id = ?`,
    [reconciliationId, organizationId],
    { fallback: true },
  );

  if (!row) {
    throw new Error(
      `Reconciliation ${reconciliationId} not found in organization ${organizationId}`,
    );
  }

  const now = new Date().toISOString();

  await dbRun(
    `UPDATE v8_kpi_finance_reconciliations
     SET reconciliation_status = ?, updated_at = ?
     WHERE reconciliation_id = ? AND organization_id = ?`,
    [newStatus, now, reconciliationId, organizationId],
  );

  const updated = rowToReconciliation(row);
  updated.reconciliationStatus = newStatus;
  updated.updatedAt = now;

  logger.info(
    `${LOG_PREFIX} Reconciliation ${reconciliationId} resolved to ${newStatus}`,
  );
  return updated;
}
