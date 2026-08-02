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
  CreateExecutiveReviewPackParams,
  CreateKPIParams,
  DeviationHighlight,
  DeviationRecord,
  DeviationSeverity,
  ExecutiveReviewPack,
  InitiateReconciliationParams,
  KPIDefinition,
  KPIFinanceReconciliation,
  KPIScorecardSummary,
  KPIStatus,
  KPISummary,
  KPITrendPoint,
  MeasurementCadence,
  ReconciliationHealthSummary,
  ReconciliationStatus,
  ReconciliationVarianceItem,
  ReconciliationVarianceOverview,
  RecordDeviationParams,
  RecordROIRealizationParams,
  ResultsDashboardSnapshot,
  ResultsKpiCatalog,
  ResultsKpiDrawerDetail,
  ReviewPackTimelineEntry,
  ROIDashboardSummary,
  ROIInitiativeDetail,
  ROIPortfolioSummary,
  ROIRealizationEntry,
  ROISnapshot,
} from '../../types/resultsROIContinuity.js';
import {
  CreateExecutiveReviewPackParamsSchema,
  CreateKPIParamsSchema,
  DeviationSeverityValues,
  InitiateReconciliationParamsSchema,
  KPI_STATUS_TRANSITIONS,
  KPIStatusValues,
  ReconciliationStatusValues,
  RecordDeviationParamsSchema,
  RecordROIRealizationParamsSchema,
} from '../../types/resultsROIContinuity.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import { getTableColumns } from '../../utils/dbSchema.js';
import logger from '../../utils/Logger.js';
import { eventBus } from '../event/EventBus.js';
import { send as sendNotification } from '../notificationService.js';
import { createDefinition as createKpiDefinition } from '../results/kpiDefinitionService.js';

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
  canonical_kpi_id?: string | null;
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
  resolved_at: string | null;
  resolved_by: string | null;
  resolution: string | null;
  observed_actual: number | null;
  observed_target: number | null;
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
    // Explicit unmapped state — never guessed. See KPIDefinition.canonicalKpiId.
    canonicalKpiId: row.canonical_kpi_id ?? null,
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
    observedActual: row.observed_actual ?? null,
    observedTarget: row.observed_target ?? null,
    resolvedAt: row.resolved_at ?? null,
    resolvedBy: row.resolved_by ?? null,
    resolution: row.resolution ?? null,
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
    reconciliationStatus:
      row.reconciliation_status as KPIFinanceReconciliation['reconciliationStatus'],
    initiatedBy: row.initiated_by as KPIFinanceReconciliation['initiatedBy'],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ==========================================
// PUBLIC API
// ==========================================

/**
 * RES-02 adapter: v8_kpi_definitions.measurement_cadence has a wider enum
 * (daily/weekly/biweekly/monthly/quarterly/annually) than the canonical
 * definition's measurementFrequency (DAILY/WEEKLY/MONTHLY/QUARTERLY) — a
 * best-effort, DETERMINISTIC mapping (never a guess about identity, only
 * about which of four buckets a cadence label falls into).
 */
function cadenceToCanonicalFrequency(cadence: MeasurementCadence): string {
  switch (cadence) {
    case 'daily':
      return 'DAILY';
    case 'weekly':
    case 'biweekly':
      return 'WEEKLY';
    case 'quarterly':
    case 'annually':
      return 'QUARTERLY';
    case 'monthly':
    default:
      return 'MONTHLY';
  }
}

/**
 * Create a KPI definition in dual-mode (initiative-linked or standalone).
 * Decision W6-6: standalone mode is first-class.
 *
 * RES-02: v8_kpi_definitions is NOT a second owner of KPI definitions. Every
 * new row created here also mints (or, if `canonicalKpiId` is supplied,
 * reuses) a canonical `initiative_kpis` definition through
 * kpiDefinitionService, and stores that id as `canonical_kpi_id` — never
 * left unmapped for a row this function creates. Pre-RES-02 rows keep
 * `canonical_kpi_id = NULL` (see KPIDefinition.canonicalKpiId) rather than
 * being heuristically backfilled by name-matching.
 */
export async function createKPI(
  params: CreateKPIParams & { canonicalKpiId?: string | null }
): Promise<KPIDefinition> {
  const validated = CreateKPIParamsSchema.parse(params);

  const kpiId = uuidv4();
  const now = new Date().toISOString();

  let canonicalKpiId = params.canonicalKpiId || null;
  if (!canonicalKpiId) {
    const canonical = await createKpiDefinition({
      organizationId: validated.organizationId,
      initiativeId: validated.initiativeId ?? null,
      name: validated.name,
      description: `Created via v8 ROI/Results dual-mode KPI (mode=${validated.mode}, metricType=${validated.metricType})`,
      category: 'roi_kpi',
      baselineValue: validated.baselineValue ?? null,
      targetValue: validated.targetValue ?? null,
      currentValue: validated.currentValue ?? null,
      measurementFrequency: cadenceToCanonicalFrequency(validated.measurementCadence),
      source: 'resultsROIService',
      reason: 'v8-roi-kpi-create',
    });
    canonicalKpiId = canonical.id;
  }

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
    canonicalKpiId,
  };

  await dbRun(
    `INSERT INTO v8_kpi_definitions (
      kpi_id, organization_id, name, mode, initiative_id,
      metric_type, baseline_value, target_value, current_value,
      measurement_cadence, status, created_at, updated_at, canonical_kpi_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      kpi.canonicalKpiId,
    ]
  );

  logger.info(`${LOG_PREFIX} Created KPI ${kpiId} (${kpi.mode}) for org ${kpi.organizationId}`);
  return kpi;
}

/**
 * Retrieve a KPI by ID with organization-level isolation.
 */
export async function getKPI(kpiId: string, organizationId: string): Promise<KPIDefinition | null> {
  const row = await dbGet<KPIRow>(
    `SELECT * FROM v8_kpi_definitions
     WHERE kpi_id = ? AND organization_id = ?`,
    [kpiId, organizationId],
    { fallback: true }
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
  newStatus: KPIStatus
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
        `Allowed: ${allowedTransitions.join(', ') || 'none (terminal state)'}`
    );
  }

  const now = new Date().toISOString();

  await dbRun(
    `UPDATE v8_kpi_definitions
     SET status = ?, updated_at = ?
     WHERE kpi_id = ? AND organization_id = ?`,
    [newStatus, now, kpiId, organizationId]
  );

  const updated: KPIDefinition = { ...existing, status: newStatus, updatedAt: now };
  logger.info(`${LOG_PREFIX} KPI ${kpiId} status: ${existing.status} → ${newStatus}`);
  return updated;
}

/**
 * Record a deviation against a KPI — closed-loop governance.
 */
export async function recordDeviation(params: RecordDeviationParams): Promise<DeviationRecord> {
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
    observedActual: validated.observedActual ?? null,
    observedTarget: validated.observedTarget ?? null,
    resolvedAt: null,
    resolvedBy: null,
    resolution: null,
  };

  await dbRun(
    `INSERT INTO v8_deviation_records (
      deviation_id, organization_id, kpi_id, deviation_type,
      severity, action_required, escalated_to, created_at,
      resolved_at, resolved_by, resolution,
      observed_actual, observed_target
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      record.deviationId,
      record.organizationId,
      record.kpiId,
      record.deviationType,
      record.severity,
      record.actionRequired,
      record.escalatedTo,
      record.createdAt,
      record.resolvedAt,
      record.resolvedBy,
      record.resolution,
      record.observedActual,
      record.observedTarget,
    ]
  );

  logger.info(`${LOG_PREFIX} Recorded deviation ${deviationId} for KPI ${record.kpiId}`);
  return record;
}

/**
 * Retrieve all deviations for a KPI, scoped to organization.
 */
export async function getDeviationsByKPI(
  kpiId: string,
  organizationId: string
): Promise<DeviationRecord[]> {
  const rows = await dbAll<DeviationRow>(
    `SELECT * FROM v8_deviation_records
     WHERE kpi_id = ? AND organization_id = ?
     ORDER BY created_at ASC`,
    [kpiId, organizationId],
    { fallback: true }
  );

  return (rows || []).map(rowToDeviation);
}

/**
 * Record a ROI realization entry — benefits tracking.
 */
export async function recordROIRealization(
  params: RecordROIRealizationParams
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
    ]
  );

  logger.info(`${LOG_PREFIX} Recorded ROI entry ${entryId} for KPI ${entry.kpiId}`);
  return entry;
}

/**
 * Retrieve ROI realization entries by initiative, scoped to organization.
 */
export async function getROIByInitiative(
  initiativeId: string,
  organizationId: string
): Promise<ROIRealizationEntry[]> {
  const rows = await dbAll<ROIRow>(
    `SELECT * FROM v8_roi_realization_entries
     WHERE initiative_id = ? AND organization_id = ?
     ORDER BY created_at ASC`,
    [initiativeId, organizationId],
    { fallback: true }
  );

  return (rows || []).map(rowToROI);
}

/**
 * Create an executive review pack (Decision W6-7: Results-native).
 */
export async function createExecutiveReviewPack(
  params: CreateExecutiveReviewPackParams
): Promise<ExecutiveReviewPack> {
  const validated = CreateExecutiveReviewPackParamsSchema.parse(params);

  const packId = uuidv4();
  const now = new Date().toISOString();

  const pack: ExecutiveReviewPack = {
    packId,
    organizationId: validated.organizationId,
    reviewPeriod: validated.reviewPeriod,
    kpiSummaries: validated.kpiSummaries as ExecutiveReviewPack['kpiSummaries'],
    deviationHighlights:
      validated.deviationHighlights as ExecutiveReviewPack['deviationHighlights'],
    roiSnapshot: validated.roiSnapshot as ExecutiveReviewPack['roiSnapshot'],
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
    ]
  );

  logger.info(
    `${LOG_PREFIX} Created executive review pack ${packId} for period ${pack.reviewPeriod}`
  );
  return pack;
}

/**
 * Retrieve an executive review pack by ID with organization-level isolation.
 */
export async function getExecutiveReviewPack(
  packId: string,
  organizationId: string
): Promise<ExecutiveReviewPack | null> {
  const row = await dbGet<ReviewPackRow>(
    `SELECT * FROM v8_executive_review_packs
     WHERE pack_id = ? AND organization_id = ?`,
    [packId, organizationId],
    { fallback: true }
  );

  if (!row) return null;
  return rowToReviewPack(row);
}

/**
 * Initiate a KPI-Finance reconciliation (Decision W6-5: Results starts).
 */
export async function initiateReconciliation(
  params: InitiateReconciliationParams
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
    ]
  );

  logger.info(
    `${LOG_PREFIX} Initiated reconciliation ${reconciliationId} for KPI ${reconciliation.kpiId} by ${reconciliation.initiatedBy}`
  );

  eventBus.publish('kpi.reconciliation_initiated', {
    organizationId: reconciliation.organizationId,
    kpiId: reconciliation.kpiId,
    reconciliationId,
    financeRef: reconciliation.financeRef,
    initiatedBy: reconciliation.initiatedBy,
  });

  try {
    const kpiRow = await dbGet<{ name?: string }>(
      `SELECT name FROM initiative_kpis WHERE id = ? AND organization_id = ?`,
      [reconciliation.kpiId, reconciliation.organizationId],
      { fallback: true }
    );
    const orgMembers: Array<{ user_id: string }> =
      (await dbAll(
        `SELECT user_id FROM organization_members WHERE organization_id = ? AND role IN ('owner', 'admin') LIMIT 5`,
        [reconciliation.organizationId],
        { fallback: true }
      )) || [];
    for (const member of orgMembers) {
      if (member.user_id === reconciliation.initiatedBy) continue;
      sendNotification({
        userId: member.user_id,
        organizationId: reconciliation.organizationId,
        type: 'KPI_RECONCILIATION_INITIATED',
        title: `Reconciliation Needed: ${kpiRow?.name || reconciliation.kpiId}`,
        body: `A KPI-Finance reconciliation has been initiated and requires review.`,
        severity: 'WARNING',
        entityType: 'kpi',
        entityId: reconciliation.kpiId,
        actionUrl: `/benefits?tab=results_kpi&mode=queue`,
      }).catch((err: unknown) =>
        logger.warn('[ResultsROI] reconciliation notification failed', err)
      );
    }
  } catch {
    // non-blocking
  }

  return reconciliation;
}

/**
 * Resolve a KPI-Finance reconciliation (Decision W6-5: Finance resolves).
 */
export async function resolveReconciliation(
  reconciliationId: string,
  organizationId: string,
  newStatus: ReconciliationStatus
): Promise<KPIFinanceReconciliation> {
  if (!ReconciliationStatusValues.includes(newStatus)) {
    throw new Error(`Invalid reconciliation status: ${newStatus}`);
  }

  const row = await dbGet<ReconciliationRow>(
    `SELECT * FROM v8_kpi_finance_reconciliations
     WHERE reconciliation_id = ? AND organization_id = ?`,
    [reconciliationId, organizationId],
    { fallback: true }
  );

  if (!row) {
    throw new Error(
      `Reconciliation ${reconciliationId} not found in organization ${organizationId}`
    );
  }

  const now = new Date().toISOString();

  await dbRun(
    `UPDATE v8_kpi_finance_reconciliations
     SET reconciliation_status = ?, updated_at = ?
     WHERE reconciliation_id = ? AND organization_id = ?`,
    [newStatus, now, reconciliationId, organizationId]
  );

  const updated = rowToReconciliation(row);
  updated.reconciliationStatus = newStatus;
  updated.updatedAt = now;

  logger.info(`${LOG_PREFIX} Reconciliation ${reconciliationId} resolved to ${newStatus}`);

  eventBus.publish('kpi.reconciliation_resolved', {
    organizationId,
    reconciliationId,
    kpiId: updated.kpiId,
    newStatus,
  });

  if (updated.initiatedBy) {
    sendNotification({
      userId: updated.initiatedBy,
      organizationId,
      type: 'KPI_RECONCILIATION_RESOLVED',
      title: `Reconciliation Resolved`,
      body: `KPI-Finance reconciliation resolved with status: ${newStatus}`,
      severity: 'INFO',
      entityType: 'kpi',
      entityId: updated.kpiId,
      actionUrl: `/benefits?tab=results_kpi&mode=queue`,
    }).catch((err: any) =>
      logger.debug(`${LOG_PREFIX} Reconciliation resolved notification failed: ${err?.message}`)
    );
  }

  return updated;
}

// ==========================================
// Runtime aggregates (Wave 19)
// ==========================================

function emptyKpiStatusCounts(): Partial<Record<KPIStatus, number>> {
  return Object.fromEntries(KPIStatusValues.map((s) => [s, 0])) as Partial<
    Record<KPIStatus, number>
  >;
}

function emptyReconciliationStatusCounts(): Partial<Record<ReconciliationStatus, number>> {
  return Object.fromEntries(ReconciliationStatusValues.map((s) => [s, 0])) as Partial<
    Record<ReconciliationStatus, number>
  >;
}

/**
 * KPI scorecard: counts, status/category breakdown, average capped achievement vs target.
 */
export async function getKPIScorecard(
  organizationId: string,
  initiativeId?: string
): Promise<KPIScorecardSummary> {
  const initiativeClause = initiativeId ? ` AND initiative_id = ?` : '';
  const initiativeParams: unknown[] = initiativeId ? [initiativeId] : [];
  const totalRow = await dbGet<{ total: number }>(
    `SELECT COUNT(*) AS total FROM v8_kpi_definitions WHERE organization_id = ?${initiativeClause}`,
    [organizationId, ...initiativeParams],
    { fallback: true }
  );
  const totalKpis = Number(totalRow?.total ?? 0);

  const statusRows = await dbAll<{ status: string; cnt: number }>(
    `SELECT status, COUNT(*) AS cnt FROM v8_kpi_definitions
     WHERE organization_id = ?${initiativeClause} GROUP BY status`,
    [organizationId, ...initiativeParams],
    { fallback: true }
  );

  const categoryRows = await dbAll<{ metric_type: string; cnt: number }>(
    `SELECT metric_type, COUNT(*) AS cnt FROM v8_kpi_definitions
     WHERE organization_id = ?${initiativeClause} GROUP BY metric_type`,
    [organizationId, ...initiativeParams],
    { fallback: true }
  );

  // Cap achievement ratio at 1.0 without scalar MIN(): Postgres MIN() is aggregate-only
  // (MIN(numeric, real) is invalid); nested CASE matches SQLite multi-arg MIN semantics.
  const avgRow = await dbGet<{ avg_rate: number | null }>(
    `SELECT AVG(
       CASE
         WHEN target_value IS NOT NULL AND target_value != 0 AND current_value IS NOT NULL
         THEN
           CASE
             WHEN (current_value * 1.0 / target_value) > 1 THEN 1.0
             ELSE (current_value * 1.0 / target_value)
           END
         ELSE NULL
       END
     ) AS avg_rate
     FROM v8_kpi_definitions WHERE organization_id = ?${initiativeClause}`,
    [organizationId, ...initiativeParams],
    { fallback: true }
  );

  const byStatus = emptyKpiStatusCounts();
  for (const r of statusRows || []) {
    const st = r.status as KPIStatus;
    if (KPIStatusValues.includes(st)) {
      byStatus[st] = r.cnt;
    }
  }

  const byCategory: Partial<Record<KPIDefinition['metricType'], number>> = {};
  for (const r of categoryRows || []) {
    byCategory[r.metric_type as KPIDefinition['metricType']] = r.cnt;
  }

  return {
    organizationId,
    totalKpis,
    byStatus,
    byCategory,
    averageTargetAchievementRate:
      avgRow?.avg_rate != null && !Number.isNaN(avgRow.avg_rate) ? avgRow.avg_rate : null,
  };
}

interface TrendJoinRow {
  created_at: string;
  observed_actual: number | null;
  observed_target: number | null;
  current_value: number | null;
  target_value: number | null;
}

/**
 * KPI value trend from deviation history (snapshots + KPI fallbacks).
 */
export async function getKPITrend(
  kpiId: string,
  organizationId: string,
  periods?: number
): Promise<KPITrendPoint[]> {
  const rows = await dbAll<TrendJoinRow>(
    `SELECT d.created_at, d.observed_actual, d.observed_target,
            k.current_value, k.target_value
     FROM v8_deviation_records d
     INNER JOIN v8_kpi_definitions k
       ON k.kpi_id = d.kpi_id AND k.organization_id = d.organization_id
     WHERE d.kpi_id = ? AND d.organization_id = ?
     ORDER BY d.created_at ASC`,
    [kpiId, organizationId],
    { fallback: true }
  );

  let points: KPITrendPoint[] = (rows || []).map((row) => {
    const actualValue = row.observed_actual != null ? row.observed_actual : row.current_value;
    const targetValue = row.observed_target != null ? row.observed_target : row.target_value;
    const deviation = actualValue != null && targetValue != null ? actualValue - targetValue : null;
    return {
      period: row.created_at,
      actualValue,
      targetValue,
      deviation,
    };
  });

  if (periods != null && periods > 0 && points.length > periods) {
    points = points.slice(-periods);
  }

  return points;
}

/**
 * Unresolved deviation governance items for an organization.
 */
export async function getActiveDeviations(
  organizationId: string,
  severity?: DeviationSeverity,
  initiativeId?: string
): Promise<DeviationRecord[]> {
  if (severity != null && !DeviationSeverityValues.includes(severity)) {
    throw new Error(`Invalid deviation severity: ${severity}`);
  }

  const initiativeClause = initiativeId
    ? ` AND EXISTS (
         SELECT 1
         FROM v8_kpi_definitions k
         WHERE k.kpi_id = v8_deviation_records.kpi_id
           AND k.organization_id = v8_deviation_records.organization_id
           AND k.initiative_id = ?
       )`
    : '';
  const initiativeParams: unknown[] = initiativeId ? [initiativeId] : [];
  const rows = severity
    ? await dbAll<DeviationRow>(
        `SELECT * FROM v8_deviation_records
         WHERE organization_id = ? AND resolved_at IS NULL AND severity = ?
         ${initiativeClause}
         ORDER BY created_at DESC`,
        [organizationId, severity, ...initiativeParams],
        { fallback: true }
      )
    : await dbAll<DeviationRow>(
        `SELECT * FROM v8_deviation_records
         WHERE organization_id = ? AND resolved_at IS NULL
         ${initiativeClause}
         ORDER BY created_at DESC`,
        [organizationId, ...initiativeParams],
        { fallback: true }
      );

  return (rows || []).map((row) => rowToDeviation(normalizeDeviationRow(row)));
}

function normalizeDeviationRow(row: DeviationRow): DeviationRow {
  return {
    ...row,
    resolved_at: row.resolved_at ?? null,
    resolved_by: row.resolved_by ?? null,
    resolution: row.resolution ?? null,
    observed_actual: row.observed_actual ?? null,
    observed_target: row.observed_target ?? null,
  };
}

/**
 * Close the loop on a deviation record.
 */
export async function resolveDeviation(
  deviationId: string,
  organizationId: string,
  resolution: string,
  resolvedBy: string
): Promise<DeviationRecord> {
  const row = await dbGet<DeviationRow>(
    `SELECT * FROM v8_deviation_records
     WHERE deviation_id = ? AND organization_id = ?`,
    [deviationId, organizationId],
    { fallback: true }
  );

  if (!row) {
    throw new Error(`Deviation ${deviationId} not found in organization ${organizationId}`);
  }

  const now = new Date().toISOString();

  await dbRun(
    `UPDATE v8_deviation_records
     SET resolved_at = ?, resolved_by = ?, resolution = ?
     WHERE deviation_id = ? AND organization_id = ?`,
    [now, resolvedBy, resolution, deviationId, organizationId]
  );

  const updated = normalizeDeviationRow({
    ...row,
    resolved_at: now,
    resolved_by: resolvedBy,
    resolution,
  });

  logger.info(`${LOG_PREFIX} Resolved deviation ${deviationId} by ${resolvedBy}`);
  return rowToDeviation(updated);
}

interface RoiInitiativeAggRow {
  initiative_id: string | null;
  entry_count: number;
  realized_sum: number;
}

interface LegacyRoiAssumptionRow {
  initiative_id: string;
  initiative_name: string;
  status: string;
  priority: string;
  capex: number | null;
  opex_annual: number | null;
  expected_revenue_delta: number | null;
  expected_cost_delta: number | null;
  confidence: string | null;
}

interface LegacyRoiRealizedAggRow {
  initiative_id: string;
  total_rev: number | null;
  total_cost: number | null;
  total_savings: number | null;
}

interface LegacyRoiRealizedRow {
  id: string;
  period_month: string;
  realized_revenue_delta: number | null;
  realized_cost_delta: number | null;
  realized_savings: number | null;
  variance_notes: string | null;
  recorded_by: string | null;
  created_at: string | null;
}

interface LegacyResultsKpiRow {
  id: string;
  mapping_id: string | null;
  initiative_id: string | null;
  initiative_name: string | null;
  initiative_status: string | null;
  name: string;
  description: string | null;
  category: string | null;
  unit: string | null;
  baseline_value: number | null;
  target_value: number | null;
  measurement_frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY';
  alert_threshold: number | null;
  alert_direction: 'BELOW' | 'ABOVE';
  is_primary: boolean | null;
  sort_order: number | null;
  owner_user_id: string | null;
  owner_first_name: string | null;
  owner_last_name: string | null;
  direction: 'HIGHER_IS_BETTER' | 'LOWER_IS_BETTER' | null;
  threshold_mode: 'ABSOLUTE' | 'PERCENT_FROM_TARGET' | null;
  amber_threshold_pct: number | null;
  red_threshold_pct: number | null;
  amber_threshold_abs: number | null;
  red_threshold_abs: number | null;
  current_value: number | null;
  latest_value: number | null;
  latest_period_start: string | null;
  prev_value: number | null;
  prev_period_start: string | null;
  open_case_id: string | null;
  open_case_severity: 'AMBER' | 'RED' | null;
  open_case_status: string | null;
  definition_source: string | null;
  observation_phase: string | null;
  tracked_in_realization: number | null;
  tracked_post_implementation: number | null;
  observation_status: string | null;
  realization_baseline_value: number | null;
  realization_target_value: number | null;
  realization_measurement_frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | null;
  post_implementation_baseline_value: number | null;
  post_implementation_target_value: number | null;
  post_implementation_measurement_frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | null;
  created_at: string;
  updated_at: string | null;
}

interface LegacyResultsKpiMappingRow {
  id: string;
  initiative_id: string;
  initiative_name: string | null;
  initiative_status: string | null;
  kpi_id: string;
  kpi_name: string | null;
  impact_direction: string | null;
  definition_source: string | null;
  observation_phase: string | null;
  tracked_in_realization: number | null;
  tracked_post_implementation: number | null;
  observation_status: string | null;
}

interface ResultsSnapshotRow {
  id: string;
  title: string | null;
  filters_json: string | null;
  created_at: string | null;
}

function normalizeLifecycleBucket(
  status: string | null | undefined
): 'in-realization' | 'realized' | null {
  const normalized = String(status || '')
    .trim()
    .toUpperCase();
  if (['APPROVED', 'SCHEDULED', 'EXECUTING'].includes(normalized)) return 'in-realization';
  if (['DONE', 'TRACKING'].includes(normalized)) return 'realized';
  return null;
}

function isNeedsEntry(
  latestMeasurementDate: string | null,
  measurementFrequency: string | null
): boolean {
  if (!latestMeasurementDate) return true;
  const latest = new Date(latestMeasurementDate);
  if (Number.isNaN(latest.getTime())) return true;
  const now = new Date();
  const freq = String(measurementFrequency || 'MONTHLY').toUpperCase();
  const diffDays = (now.getTime() - latest.getTime()) / 86400000;
  if (freq === 'DAILY') return diffDays > 2;
  if (freq === 'WEEKLY') return diffDays > 8;
  if (freq === 'MONTHLY') {
    return latest.getFullYear() < now.getFullYear() || latest.getMonth() < now.getMonth();
  }
  const latestQuarter = Math.floor(latest.getMonth() / 3);
  const currentQuarter = Math.floor(now.getMonth() / 3);
  return latest.getFullYear() < now.getFullYear() || latestQuarter < currentQuarter;
}

async function listResultsTrackedInitiatives(
  organizationId: string,
  kpis: ResultsKpiCatalog['kpis']
): Promise<ResultsKpiCatalog['initiatives']> {
  const byInitiative = new Map<
    string,
    {
      initiativeId: string;
      initiativeName: string;
      initiativeStatus: string;
      lifecycleBucket: 'in-realization' | 'realized';
      trackedKpiCount: number;
      realizationKpiCount: number;
      postImplementationKpiCount: number;
      belowTargetCount: number;
      needsEntryCount: number;
      openDeviationCount: number;
      openReportCount: number;
      lastReportTitle: string | null;
      lastReportId: string | null;
      lastReportCreatedAt: string | null;
    }
  >();

  for (const kpi of kpis) {
    const initiativeId = String(kpi.initiativeId || '').trim();
    if (!initiativeId) continue;
    const lifecycleBucket = normalizeLifecycleBucket(kpi.initiativeStatus);
    if (!lifecycleBucket) continue;

    const existing = byInitiative.get(initiativeId) || {
      initiativeId,
      initiativeName: String(kpi.initiativeName || initiativeId),
      initiativeStatus: String(kpi.initiativeStatus || ''),
      lifecycleBucket,
      trackedKpiCount: 0,
      realizationKpiCount: 0,
      postImplementationKpiCount: 0,
      belowTargetCount: 0,
      needsEntryCount: 0,
      openDeviationCount: 0,
      openReportCount: 0,
      lastReportTitle: null,
      lastReportId: null,
      lastReportCreatedAt: null,
    };

    existing.trackedKpiCount += 1;
    if (kpi.trackedInRealization) existing.realizationKpiCount += 1;
    if (kpi.trackedPostImplementation) existing.postImplementationKpiCount += 1;
    if (!kpi.isOnTarget && kpi.latestValue != null) existing.belowTargetCount += 1;
    if (isNeedsEntry(kpi.latestMeasurementDate || null, kpi.measurementFrequency || null)) {
      existing.needsEntryCount += 1;
    }
    if (kpi.openDeviationCase) existing.openDeviationCount += 1;

    byInitiative.set(initiativeId, existing);
  }

  const initiativeIds = Array.from(byInitiative.keys());
  if (initiativeIds.length > 0) {
    const snapshots = await dbAll<ResultsSnapshotRow>(
      `SELECT id, title, filters_json, created_at
       FROM results_kpi_report_snapshots
       WHERE organization_id = ?
       ORDER BY created_at DESC`,
      [organizationId],
      { fallback: true }
    ).catch(() => []);

    for (const snapshot of snapshots || []) {
      const filters = safeJsonParse<Record<string, unknown>>(snapshot.filters_json, {});
      const linkedInitiativeIds = Array.isArray(filters.initiativeIds)
        ? (filters.initiativeIds as unknown[])
            .map((entry) => String(entry || '').trim())
            .filter(Boolean)
        : [];

      for (const initiativeId of linkedInitiativeIds) {
        if (!initiativeIds.includes(initiativeId)) continue;
        const item = byInitiative.get(initiativeId);
        if (!item) continue;
        item.openReportCount += 1;
        if (!item.lastReportId) {
          item.lastReportId = snapshot.id;
          item.lastReportTitle = snapshot.title || null;
          item.lastReportCreatedAt = snapshot.created_at || null;
        }
      }
    }
  }

  return Array.from(byInitiative.values()).sort((a, b) =>
    a.initiativeName.localeCompare(b.initiativeName)
  );
}

interface LegacyKpiTimeSeriesRow {
  id: string;
  kpi_id: string;
  value: number;
  period_start: string | null;
  period_end: string | null;
  measurement_frequency: string | null;
  notes: string | null;
  created_at: string;
  user_id: string | null;
  user_first_name: string | null;
  user_last_name: string | null;
}

interface LegacyDeviationCaseRow {
  id: string;
  kpi_id: string;
  organization_id: string;
  period_start: string | null;
  period_end: string | null;
  severity: 'AMBER' | 'RED';
  status: string;
  owner_user_id: string | null;
  deviation_summary: string | null;
  rca_text: string | null;
  evidence_text: string | null;
  evidence_ref: string | null;
  resolution_notes: string | null;
  detected_at: string | null;
  acknowledged_at: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

interface LegacyDeviationActionRow {
  id: string;
  case_id: string;
  title: string;
  owner_user_id: string | null;
  due_date: string | null;
  status: 'OPEN' | 'DONE' | 'CANCELLED';
  created_at: string | null;
  updated_at: string | null;
}

/**
 * ROI realization aggregates for dashboards.
 */
export async function getROIDashboard(
  organizationId: string,
  initiativeId?: string
): Promise<ROIDashboardSummary> {
  const initiativeClause = initiativeId ? ` AND initiative_id = ?` : '';
  const initiativeParams: unknown[] = initiativeId ? [initiativeId] : [];
  const totalRow = await dbGet<{ total_entries: number; total_realized: number }>(
    `SELECT COUNT(*) AS total_entries, COALESCE(SUM(realized_value), 0) AS total_realized
     FROM v8_roi_realization_entries WHERE organization_id = ?${initiativeClause}`,
    [organizationId, ...initiativeParams],
    { fallback: true }
  );

  const projectedRow = await dbGet<{ projected: number | null }>(
    `SELECT COALESCE(SUM(k.target_value), 0) AS projected
     FROM v8_kpi_definitions k
     WHERE k.organization_id = ?
       ${initiativeId ? ` AND k.initiative_id = ?` : ''}
       AND k.target_value IS NOT NULL
       AND EXISTS (
         SELECT 1 FROM v8_roi_realization_entries r
         WHERE r.organization_id = k.organization_id AND r.kpi_id = k.kpi_id
           ${initiativeId ? `AND r.initiative_id = ?` : ''}
       )`,
    [organizationId, ...initiativeParams, ...initiativeParams],
    { fallback: true }
  );

  const initiativeRows = await dbAll<RoiInitiativeAggRow>(
    `SELECT initiative_id, COUNT(*) AS entry_count, COALESCE(SUM(realized_value), 0) AS realized_sum
     FROM v8_roi_realization_entries
     WHERE organization_id = ?${initiativeClause}
     GROUP BY initiative_id`,
    [organizationId, ...initiativeParams],
    { fallback: true }
  );

  const totalEntries = Number(totalRow?.total_entries ?? 0);
  const totalRealized = Number(totalRow?.total_realized ?? 0);
  const projectedFromKpiTargets = projectedRow?.projected ?? 0;
  const overallRealizationRate =
    projectedFromKpiTargets > 0 ? totalRealized / projectedFromKpiTargets : null;

  return {
    organizationId,
    totalEntries,
    totalRealized,
    projectedFromKpiTargets,
    overallRealizationRate,
    byInitiative: (initiativeRows || []).map((r) => ({
      initiativeId: r.initiative_id,
      entryCount: r.entry_count,
      realizedSum: r.realized_sum,
    })),
  };
}

/**
 * ROI portfolio rollup for the active Results ROI surfaces.
 * This is a bounded V8 bridge over the existing org-scoped ROI assumptions and realized tables.
 */
export async function getROIPortfolioSummary(
  organizationId: string,
  options?: { initiativeId?: string }
): Promise<ROIPortfolioSummary> {
  const initiativeId = options?.initiativeId?.trim() || undefined;
  const initiativeClause = initiativeId ? ' AND ra.initiative_id = ?' : '';
  const initiativeParams: unknown[] = initiativeId ? [initiativeId] : [];
  const assumptions = await dbAll<LegacyRoiAssumptionRow>(
    `SELECT
       ra.initiative_id,
       i.name AS initiative_name,
       i.status,
       i.priority,
       ra.capex,
       ra.opex_annual,
       ra.expected_revenue_delta,
       ra.expected_cost_delta,
       ra.confidence
     FROM roi_assumptions ra
     JOIN initiatives i ON i.id = ra.initiative_id
     WHERE ra.organization_id = ?${initiativeClause}`,
    [organizationId, ...initiativeParams],
    { fallback: true }
  );

  const realizedClause = initiativeId ? ' AND initiative_id = ?' : '';
  const realized = await dbAll<LegacyRoiRealizedAggRow>(
    `SELECT
       initiative_id,
       SUM(realized_revenue_delta) AS total_rev,
       SUM(realized_cost_delta) AS total_cost,
       SUM(realized_savings) AS total_savings
     FROM roi_realized_values
     WHERE organization_id = ?${realizedClause}
     GROUP BY initiative_id`,
    [organizationId, ...initiativeParams],
    { fallback: true }
  );

  const realizedMap = new Map<string, LegacyRoiRealizedAggRow>();
  for (const row of realized || []) {
    if (row.initiative_id) {
      realizedMap.set(row.initiative_id, row);
    }
  }

  const items = (assumptions || []).map((row) => {
    const realizedRow = realizedMap.get(row.initiative_id);
    const capex = row.capex || 0;
    const opexAnnual = row.opex_annual || 0;
    const projectedBenefit = (row.expected_revenue_delta || 0) + (row.expected_cost_delta || 0);
    const realizedBenefit = realizedRow
      ? (realizedRow.total_rev || 0) +
        (realizedRow.total_cost || 0) +
        (realizedRow.total_savings || 0)
      : 0;
    // Faza2 gap #3 — ROI netto: benefit pomniejszony o opex_annual (roi_assumptions).
    // Additive obok gross projectedBenefit/realizedBenefit powyżej — nie psuje istniejących pól.
    const netProjectedBenefit = projectedBenefit - opexAnnual;
    const netRealizedBenefit = realizedBenefit - opexAnnual;
    const roiPercentGross = capex > 0 ? (realizedBenefit / capex) * 100 : null;
    const roiPercentNet = capex > 0 ? (netRealizedBenefit / capex) * 100 : null;

    return {
      initiativeId: row.initiative_id,
      initiativeName: row.initiative_name,
      status: row.status,
      priority: row.priority,
      capex,
      opexAnnual,
      projectedBenefit,
      realizedBenefit,
      variance: realizedBenefit - projectedBenefit,
      confidence: row.confidence,
      hasRealized: Boolean(realizedRow),
      netProjectedBenefit,
      netRealizedBenefit,
      roiPercentGross,
      roiPercentNet,
    };
  });

  const totalProjected = items.reduce((sum, item) => sum + item.projectedBenefit, 0);
  const totalRealized = items.reduce((sum, item) => sum + item.realizedBenefit, 0);
  const totalCapex = items.reduce((sum, item) => sum + item.capex, 0);
  const totalOpexAnnual = items.reduce((sum, item) => sum + item.opexAnnual, 0);
  const netTotalProjected = totalProjected - totalOpexAnnual;
  const netTotalRealized = totalRealized - totalOpexAnnual;
  const coveragePercent =
    items.length > 0
      ? Math.round((items.filter((item) => item.hasRealized).length / items.length) * 100)
      : 0;

  return {
    organizationId,
    items,
    summary: {
      totalProjected,
      totalRealized,
      totalCapex,
      totalVariance: totalRealized - totalProjected,
      initiativeCount: items.length,
      coveragePercent,
      totalOpexAnnual,
      netTotalProjected,
      netTotalRealized,
      roiPercentGross: totalCapex > 0 ? (totalRealized / totalCapex) * 100 : null,
      roiPercentNet: totalCapex > 0 ? (netTotalRealized / totalCapex) * 100 : null,
    },
  };
}

/**
 * Initiative-level ROI detail bridge for the active ROI drawer surface.
 */
export async function getROIInitiativeDetail(
  initiativeId: string,
  organizationId: string
): Promise<ROIInitiativeDetail> {
  const assumptionRow = await dbGet<LegacyRoiAssumptionRow & Record<string, unknown>>(
    `SELECT * FROM roi_assumptions WHERE initiative_id = ? AND organization_id = ?`,
    [initiativeId, organizationId],
    { fallback: true }
  );

  const realizedRows = await dbAll<LegacyRoiRealizedRow>(
    `SELECT * FROM roi_realized_values
     WHERE initiative_id = ? AND organization_id = ?
     ORDER BY period_month DESC`,
    [initiativeId, organizationId],
    { fallback: true }
  );

  const realizedList = realizedRows || [];
  const totalRealizedRevDelta = realizedList.reduce(
    (sum, row) => sum + (row.realized_revenue_delta || 0),
    0
  );
  const totalRealizedCostDelta = realizedList.reduce(
    (sum, row) => sum + (row.realized_cost_delta || 0),
    0
  );
  const totalRealizedSavings = realizedList.reduce(
    (sum, row) => sum + (row.realized_savings || 0),
    0
  );

  let variance: ROIInitiativeDetail['variance'];
  let assumptions: ROIInitiativeDetail['assumptions'] = null;

  if (!assumptionRow) {
    variance = { hasAssumptions: false, variance: null };
  } else {
    const capex = Number(assumptionRow.capex || 0);
    const opexAnnual = Number(assumptionRow.opex_annual || 0);
    const projectedBenefit =
      Number(assumptionRow.expected_revenue_delta || 0) +
      Number(assumptionRow.expected_cost_delta || 0);
    const realizedBenefit = totalRealizedRevDelta + totalRealizedCostDelta + totalRealizedSavings;
    const varianceAbs = realizedBenefit - projectedBenefit;
    const variancePct =
      projectedBenefit !== 0 ? (varianceAbs / Math.abs(projectedBenefit)) * 100 : 0;
    // Faza2 gap #3 — ROI netto: benefit pomniejszony o opex_annual. Additive pola
    // obok istniejących gross totalBenefit — konsumenci ignorujący nowe pola działają bez zmian.
    const netProjectedBenefit = projectedBenefit - opexAnnual;
    const netRealizedBenefit = realizedBenefit - opexAnnual;

    variance = {
      hasAssumptions: true,
      projected: {
        revenueDelta: Number(assumptionRow.expected_revenue_delta || 0),
        costDelta: Number(assumptionRow.expected_cost_delta || 0),
        totalBenefit: projectedBenefit,
        capex,
        opexAnnual,
        roiPercent: Number(assumptionRow.expected_roi_percent || 0),
        npv: Number(assumptionRow.expected_npv || 0),
        paybackMonths: Number(assumptionRow.expected_payback_months || 0),
        horizonMonths: Number(assumptionRow.horizon_months || 0),
        confidence: String(assumptionRow.confidence || ''),
        netTotalBenefit: netProjectedBenefit,
        roiPercentNet: capex > 0 ? (netProjectedBenefit / capex) * 100 : null,
      },
      realized: {
        revenueDelta: totalRealizedRevDelta,
        costDelta: totalRealizedCostDelta,
        savings: totalRealizedSavings,
        totalBenefit: realizedBenefit,
        dataPoints: realizedList.length,
        netTotalBenefit: netRealizedBenefit,
        roiPercentNet: capex > 0 ? (netRealizedBenefit / capex) * 100 : null,
      },
      variance: {
        absolute: varianceAbs,
        percent: Math.round(variancePct * 10) / 10,
        status: variancePct > 10 ? 'above_plan' : variancePct < -10 ? 'below_plan' : 'on_track',
      },
    };

    assumptions = {
      expectedRevenueDelta: assumptionRow.expected_revenue_delta as number | null,
      expectedCostDelta: assumptionRow.expected_cost_delta as number | null,
      capex: assumptionRow.capex as number | null,
      opexAnnual: assumptionRow.opex_annual as number | null,
      horizonMonths: assumptionRow.horizon_months as number | null,
      effectStartDate: assumptionRow.effect_start_date as string | null,
      confidence: (assumptionRow.confidence as string | null) ?? null,
      assumptionsOwner: (assumptionRow.assumptions_owner as string | null) ?? null,
      assumptionsText: (assumptionRow.assumptions_text as string | null) ?? null,
    };
  }

  return {
    organizationId,
    initiativeId,
    variance,
    assumptions,
    realized: realizedList.map((row) => ({
      id: row.id,
      periodMonth: row.period_month,
      realizedRevenueDelta: row.realized_revenue_delta,
      realizedCostDelta: row.realized_cost_delta,
      realizedSavings: row.realized_savings,
      varianceNotes: row.variance_notes,
      recordedBy: row.recorded_by,
      createdAt: row.created_at,
    })),
  };
}

/**
 * Shared KPI catalog + mapping bridge for active Results read surfaces.
 */
export async function getResultsKpiCatalog(
  organizationId: string,
  options: { kpiId?: string; initiativeId?: string } = {}
): Promise<ResultsKpiCatalog> {
  const params: Array<string> = [organizationId, organizationId, organizationId, organizationId];
  let kpiFilterSql = '';
  if (options.kpiId) {
    kpiFilterSql = ' AND k.id = ?';
    params.push(options.kpiId);
  }
  if (options.initiativeId) {
    kpiFilterSql += ` AND (
      k.initiative_id = ?
      OR EXISTS (
        SELECT 1
        FROM initiative_kpi_mappings map_scope
        WHERE map_scope.organization_id = ?
          AND map_scope.initiative_id = ?
          AND map_scope.kpi_id = k.id
      )
    )`;
    params.push(options.initiativeId, organizationId, options.initiativeId);
  }

  const kpiRows = await dbAll<LegacyResultsKpiRow>(
    `SELECT
       m.id AS mapping_id,
       k.id,
       k.initiative_id,
       i.name AS initiative_name,
       i.status AS initiative_status,
       k.name,
       k.description,
       k.category,
       k.unit,
       k.baseline_value,
       k.target_value,
       k.measurement_frequency,
       k.alert_threshold,
       k.alert_direction,
       k.is_primary,
       k.sort_order,
       k.owner_user_id,
       u.first_name AS owner_first_name,
       u.last_name AS owner_last_name,
       k.direction,
       k.threshold_mode,
       k.amber_threshold_pct,
       k.red_threshold_pct,
       k.amber_threshold_abs,
       k.red_threshold_abs,
       k.current_value,
       ts.value AS latest_value,
       ts.period_start AS latest_period_start,
       ts_prev.value AS prev_value,
       ts_prev.period_start AS prev_period_start,
       c.id AS open_case_id,
       c.severity AS open_case_severity,
       c.status AS open_case_status,
       COALESCE(m.definition_source, CASE WHEN k.initiative_id IS NULL THEN 'library' ELSE 'initiative-custom' END) AS definition_source,
       COALESCE(m.observation_phase, 'post-implementation') AS observation_phase,
       COALESCE(m.tracked_in_realization, 0) AS tracked_in_realization,
       COALESCE(m.tracked_post_implementation, 1) AS tracked_post_implementation,
       COALESCE(m.observation_status, 'active') AS observation_status,
       COALESCE(m.realization_baseline_value, k.baseline_value) AS realization_baseline_value,
       COALESCE(m.realization_target_value, k.target_value) AS realization_target_value,
       COALESCE(m.realization_measurement_frequency, k.measurement_frequency) AS realization_measurement_frequency,
       COALESCE(m.post_implementation_baseline_value, k.baseline_value) AS post_implementation_baseline_value,
       COALESCE(m.post_implementation_target_value, k.target_value) AS post_implementation_target_value,
       COALESCE(m.post_implementation_measurement_frequency, k.measurement_frequency) AS post_implementation_measurement_frequency,
       k.created_at,
       k.updated_at
     FROM initiative_kpis k
     LEFT JOIN initiatives i ON i.id = k.initiative_id
     LEFT JOIN initiative_kpi_mappings m ON m.kpi_id = k.id AND m.organization_id = ?
     LEFT JOIN users u ON u.id = k.owner_user_id
     LEFT JOIN LATERAL (
       SELECT value, period_start
       FROM kpi_time_series
       WHERE kpi_id = k.id AND organization_id = ?
       ORDER BY period_start DESC, created_at DESC
       LIMIT 1
     ) ts ON TRUE
     LEFT JOIN LATERAL (
       SELECT value, period_start
       FROM kpi_time_series
       WHERE kpi_id = k.id AND organization_id = ?
       ORDER BY period_start DESC, created_at DESC
       OFFSET 1
       LIMIT 1
     ) ts_prev ON TRUE
     LEFT JOIN LATERAL (
       SELECT id, severity, status
       FROM kpi_deviation_cases
       WHERE organization_id = ? AND kpi_id = k.id AND status IN ('OPEN','ACKNOWLEDGED','IN_PROGRESS','MITIGATING')
       ORDER BY CASE WHEN severity = 'RED' THEN 0 ELSE 1 END, detected_at DESC
       LIMIT 1
     ) c ON TRUE
     WHERE COALESCE(k.organization_id, i.organization_id, m.organization_id) = ?
       AND k.archived_at IS NULL${kpiFilterSql}
     ORDER BY k.updated_at DESC NULLS LAST, k.created_at DESC`,
    [organizationId, ...params],
    { fallback: true }
  );

  const mappingParams: Array<string> = [organizationId];
  let mappingFilterSql = '';
  if (options.kpiId) {
    mappingFilterSql = ' AND m.kpi_id = ?';
    mappingParams.push(options.kpiId);
  }
  if (options.initiativeId) {
    mappingFilterSql += ' AND m.initiative_id = ?';
    mappingParams.push(options.initiativeId);
  }

  const mappingRows = await dbAll<LegacyResultsKpiMappingRow>(
    `SELECT
       m.id,
       m.initiative_id,
       COALESCE(NULLIF(i.name, ''), NULLIF(i.title, '')) AS initiative_name,
       i.status AS initiative_status,
       m.kpi_id,
       ik.name AS kpi_name,
       m.impact_direction,
       COALESCE(m.definition_source, CASE WHEN ik.initiative_id IS NULL THEN 'library' ELSE 'initiative-custom' END) AS definition_source,
       COALESCE(m.observation_phase, 'post-implementation') AS observation_phase,
       COALESCE(m.tracked_in_realization, 0) AS tracked_in_realization,
       COALESCE(m.tracked_post_implementation, 1) AS tracked_post_implementation,
       COALESCE(m.observation_status, 'active') AS observation_status
     FROM initiative_kpi_mappings m
     LEFT JOIN initiative_kpis ik ON ik.id = m.kpi_id
     LEFT JOIN initiatives i ON i.id = m.initiative_id
     WHERE m.organization_id = ?${mappingFilterSql}`,
    mappingParams,
    { fallback: true }
  );

  const kpis = (kpiRows || []).map((row) => {
    const latestValue = row.latest_value ?? row.current_value ?? null;
    const targetValue = row.target_value ?? null;
    const direction = row.direction || 'HIGHER_IS_BETTER';
    const isOnTarget =
      latestValue == null || targetValue == null
        ? false
        : direction === 'LOWER_IS_BETTER'
          ? Number(latestValue) <= Number(targetValue)
          : Number(latestValue) >= Number(targetValue);

    return {
      id: row.id,
      mappingId: row.mapping_id,
      initiativeId: row.initiative_id,
      initiativeName: row.initiative_name,
      initiativeStatus: row.initiative_status,
      name: row.name,
      description: row.description,
      category: row.category,
      unit: row.unit,
      baselineValue: row.baseline_value,
      targetValue,
      measurementFrequency: row.measurement_frequency || 'MONTHLY',
      alertThreshold: row.alert_threshold,
      alertDirection: row.alert_direction || 'BELOW',
      isPrimary: Boolean(row.is_primary),
      sortOrder: row.sort_order ?? 0,
      latestValue,
      latestMeasurementDate: row.latest_period_start,
      prevValue: row.prev_value != null ? Number(row.prev_value) : null,
      prevMeasurementDate: row.prev_period_start,
      isOnTarget,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      ownerUserId: row.owner_user_id,
      ownerName:
        row.owner_first_name || row.owner_last_name
          ? `${row.owner_first_name || ''} ${row.owner_last_name || ''}`.trim()
          : null,
      direction,
      thresholdMode: row.threshold_mode || 'PERCENT_FROM_TARGET',
      amberThresholdPct: row.amber_threshold_pct,
      redThresholdPct: row.red_threshold_pct,
      amberThresholdAbs: row.amber_threshold_abs,
      redThresholdAbs: row.red_threshold_abs,
      definitionSource: (String(row.definition_source || '')
        .trim()
        .toLowerCase() === 'library'
        ? 'library'
        : 'initiative-custom') as 'library' | 'initiative-custom',
      observationPhase: (String(row.observation_phase || '')
        .trim()
        .toLowerCase() === 'realization'
        ? 'realization'
        : String(row.observation_phase || '')
              .trim()
              .toLowerCase() === 'both'
          ? 'both'
          : 'post-implementation') as 'realization' | 'both' | 'post-implementation',
      trackedInRealization: Boolean(row.tracked_in_realization),
      trackedPostImplementation:
        row.tracked_post_implementation == null ? true : Boolean(row.tracked_post_implementation),
      observationStatus: (String(row.observation_status || '')
        .trim()
        .toLowerCase() === 'paused'
        ? 'paused'
        : String(row.observation_status || '')
              .trim()
              .toLowerCase() === 'completed'
          ? 'completed'
          : 'active') as 'active' | 'completed' | 'paused',
      realizationExpectation: {
        baselineValue: row.realization_baseline_value,
        targetValue: row.realization_target_value,
        measurementFrequency:
          row.realization_measurement_frequency || row.measurement_frequency || 'MONTHLY',
      },
      postImplementationExpectation: {
        baselineValue: row.post_implementation_baseline_value,
        targetValue: row.post_implementation_target_value,
        measurementFrequency:
          row.post_implementation_measurement_frequency || row.measurement_frequency || 'MONTHLY',
      },
      openDeviationCase: row.open_case_id
        ? {
            id: row.open_case_id,
            severity: row.open_case_severity || 'AMBER',
            status: row.open_case_status || 'OPEN',
          }
        : null,
    };
  });

  const mappings = (mappingRows || []).map((row) => ({
    id: row.id,
    initiativeId: row.initiative_id,
    initiativeName: row.initiative_name,
    initiativeStatus: row.initiative_status,
    kpiId: row.kpi_id,
    kpiName: row.kpi_name,
    impactDirection: row.impact_direction,
    definitionSource: (String(row.definition_source || '')
      .trim()
      .toLowerCase() === 'library'
      ? 'library'
      : 'initiative-custom') as 'library' | 'initiative-custom',
    observationPhase: (String(row.observation_phase || '')
      .trim()
      .toLowerCase() === 'realization'
      ? 'realization'
      : String(row.observation_phase || '')
            .trim()
            .toLowerCase() === 'both'
        ? 'both'
        : 'post-implementation') as 'realization' | 'both' | 'post-implementation',
    trackedInRealization: Boolean(row.tracked_in_realization),
    trackedPostImplementation:
      row.tracked_post_implementation == null ? true : Boolean(row.tracked_post_implementation),
    observationStatus: (String(row.observation_status || '')
      .trim()
      .toLowerCase() === 'paused'
      ? 'paused'
      : String(row.observation_status || '')
            .trim()
            .toLowerCase() === 'completed'
        ? 'completed'
        : 'active') as 'active' | 'completed' | 'paused',
  }));

  const initiatives = await listResultsTrackedInitiatives(organizationId, kpis);

  return {
    organizationId,
    initiatives,
    kpis,
    mappings,
  };
}

function deriveLegacyKpiPeriodKey(
  periodStart: string | null,
  measurementFrequency: string | null
): string | null {
  if (!periodStart) return null;
  const d = new Date(periodStart);
  if (Number.isNaN(d.getTime())) return null;
  const freq = String(measurementFrequency || 'MONTHLY').toUpperCase();
  if (freq === 'DAILY') return periodStart.slice(0, 10);
  if (freq === 'WEEKLY') {
    const year = d.getUTCFullYear();
    const firstDay = new Date(Date.UTC(year, 0, 1));
    const dayOfYear = Math.floor((d.getTime() - firstDay.getTime()) / 86400000) + 1;
    const week = Math.ceil(dayOfYear / 7);
    return `${year}-W${String(week).padStart(2, '0')}`;
  }
  if (freq === 'QUARTERLY') {
    const quarter = Math.floor(d.getUTCMonth() / 3) + 1;
    return `${d.getUTCFullYear()}-Q${quarter}`;
  }
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/**
 * KPI drawer detail bridge for active Results time-series and deviation continuity.
 */
export async function getResultsKpiDrawerDetail(
  kpiId: string,
  organizationId: string,
  options?: { initiativeId?: string }
): Promise<ResultsKpiDrawerDetail> {
  const initiativeId = options?.initiativeId?.trim() || undefined;
  if (initiativeId) {
    const scopedKpi = await dbGet<{ id: string }>(
      `SELECT k.id
       FROM initiative_kpis k
       LEFT JOIN initiatives i ON i.id = k.initiative_id
       WHERE k.id = ?
         AND COALESCE(k.organization_id, i.organization_id) = ?
         AND (
           k.initiative_id = ?
           OR EXISTS (
             SELECT 1
             FROM initiative_kpi_mappings m
             WHERE m.organization_id = ?
               AND m.initiative_id = ?
               AND m.kpi_id = k.id
           )
         )`,
      [kpiId, organizationId, initiativeId, organizationId, initiativeId],
      { fallback: true }
    );
    if (!scopedKpi?.id) {
      throw new Error('RESULTS_KPI_NOT_FOUND');
    }
  }
  const measurementRows = await dbAll<LegacyKpiTimeSeriesRow>(
    `SELECT
       ts.*,
       k.measurement_frequency,
       u.id AS user_id,
       u.first_name AS user_first_name,
       u.last_name AS user_last_name
     FROM kpi_time_series ts
     LEFT JOIN initiative_kpis k ON k.id = ts.kpi_id
     LEFT JOIN users u ON u.id = ts.recorded_by
     WHERE ts.kpi_id = ? AND ts.organization_id = ?
     ORDER BY ts.period_start DESC, ts.created_at DESC`,
    [kpiId, organizationId],
    { fallback: true }
  );

  const caseRows = await dbAll<LegacyDeviationCaseRow>(
    `SELECT *
     FROM kpi_deviation_cases
     WHERE organization_id = ? AND kpi_id = ?
       AND status IN ('OPEN','ACKNOWLEDGED','IN_PROGRESS','MITIGATING')
     ORDER BY detected_at DESC, created_at DESC`,
    [organizationId, kpiId],
    { fallback: true }
  );

  const openCaseRow = (caseRows || [])[0] || null;
  const actionRows = openCaseRow
    ? await dbAll<LegacyDeviationActionRow>(
        `SELECT *
         FROM kpi_deviation_actions
         WHERE case_id = ?
         ORDER BY created_at ASC`,
        [openCaseRow.id],
        { fallback: true }
      )
    : [];

  const auditRows = await dbAll<{
    id: string;
    section: string;
    event_type: string;
    source: string;
    actor_user_id?: string | null;
    summary?: string | null;
    before_json?: string | null;
    after_json?: string | null;
    created_at: string;
  }>(
    `SELECT *
     FROM kpi_metric_audit_log
     WHERE organization_id = ? AND kpi_id = ?
     ORDER BY created_at DESC
     LIMIT 30`,
    [organizationId, kpiId],
    { fallback: true }
  ).catch(() => []);

  return {
    organizationId,
    kpiId,
    measurements: (measurementRows || []).map((row) => ({
      id: row.id,
      kpiId: row.kpi_id,
      value: row.value,
      measuredAt: row.period_start,
      periodStart: row.period_start,
      periodEnd: row.period_end,
      periodKey: deriveLegacyKpiPeriodKey(row.period_start, row.measurement_frequency),
      notes: row.notes,
      createdAt: row.created_at,
      createdBy: row.user_id
        ? {
            id: row.user_id,
            firstName: row.user_first_name || '',
            lastName: row.user_last_name || '',
          }
        : undefined,
    })),
    openCase: openCaseRow
      ? {
          id: openCaseRow.id,
          kpiId: openCaseRow.kpi_id,
          organizationId: openCaseRow.organization_id,
          periodStart: openCaseRow.period_start,
          periodEnd: openCaseRow.period_end,
          severity: openCaseRow.severity,
          status: openCaseRow.status,
          ownerUserId: openCaseRow.owner_user_id,
          deviationSummary: openCaseRow.deviation_summary,
          rcaText: openCaseRow.rca_text,
          evidenceText: openCaseRow.evidence_text,
          evidenceRef: openCaseRow.evidence_ref,
          resolutionNotes: openCaseRow.resolution_notes,
          detectedAt: openCaseRow.detected_at,
          acknowledgedAt: openCaseRow.acknowledged_at,
          resolvedAt: openCaseRow.resolved_at,
          closedAt: openCaseRow.closed_at,
          createdAt: openCaseRow.created_at,
          updatedAt: openCaseRow.updated_at,
          actions: (actionRows || []).map((row) => ({
            id: row.id,
            title: row.title,
            ownerUserId: row.owner_user_id,
            dueDate: row.due_date,
            status: row.status,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
          })),
        }
      : null,
    auditLog: (auditRows || []).map((row) => ({
      id: row.id,
      section: row.section,
      eventType: row.event_type,
      source: row.source || 'results_runtime',
      actorUserId: row.actor_user_id || null,
      summary: row.summary || null,
      before: safeJsonParse(row.before_json, {}),
      after: safeJsonParse(row.after_json, {}),
      createdAt: row.created_at,
    })),
  };
}

/**
 * ROI entries whose created_at falls in [fromDate, toDate] (inclusive ISO strings).
 */
export async function getROIByDateRange(
  organizationId: string,
  fromDate: string,
  toDate: string
): Promise<ROIRealizationEntry[]> {
  const rows = await dbAll<ROIRow>(
    `SELECT * FROM v8_roi_realization_entries
     WHERE organization_id = ? AND created_at >= ? AND created_at <= ?
     ORDER BY created_at ASC`,
    [organizationId, fromDate, toDate],
    { fallback: true }
  );

  return (rows || []).map(rowToROI);
}

/**
 * Executive review packs on a timeline with lightweight rollups.
 */
export async function getReviewPackTimeline(
  organizationId: string
): Promise<ReviewPackTimelineEntry[]> {
  const rows = await dbAll<ReviewPackRow>(
    `SELECT * FROM v8_executive_review_packs
     WHERE organization_id = ?
     ORDER BY created_at ASC`,
    [organizationId],
    { fallback: true }
  );

  return (rows || []).map((row) => {
    const kpiSummaries = safeJsonParse<KPISummary[]>(row.kpi_summaries, []);
    const deviationHighlights = safeJsonParse<DeviationHighlight[]>(row.deviation_highlights, []);
    const roiSnap = safeJsonParse<ROISnapshot>(row.roi_snapshot, {
      totalRealized: 0,
      entriesCount: 0,
      period: '',
    });
    return {
      packId: row.pack_id,
      reviewPeriod: row.review_period,
      status: row.status as ExecutiveReviewPack['status'],
      createdAt: row.created_at,
      kpiSummaryCount: kpiSummaries.length,
      deviationHighlightCount: deviationHighlights.length,
      roiSnapshotTotalRealized: roiSnap.totalRealized,
      roiSnapshotEntriesCount: roiSnap.entriesCount,
    };
  });
}

interface ReconStatusRow {
  reconciliation_status: string;
  cnt: number;
}

interface ReconResolvedRow {
  created_at: string;
  updated_at: string;
}

/**
 * KPI–Finance reconciliation health for an organization.
 */
export async function getReconciliationHealth(
  organizationId: string
): Promise<ReconciliationHealthSummary> {
  const statusRows = await dbAll<ReconStatusRow>(
    `SELECT reconciliation_status, COUNT(*) AS cnt
     FROM v8_kpi_finance_reconciliations
     WHERE organization_id = ?
     GROUP BY reconciliation_status`,
    [organizationId],
    { fallback: true }
  );

  const totalRow = await dbGet<{ total: number }>(
    `SELECT COUNT(*) AS total FROM v8_kpi_finance_reconciliations WHERE organization_id = ?`,
    [organizationId],
    { fallback: true }
  );

  const resolvedRows = await dbAll<ReconResolvedRow>(
    `SELECT created_at, updated_at FROM v8_kpi_finance_reconciliations
     WHERE organization_id = ? AND reconciliation_status = 'reconciled'`,
    [organizationId],
    { fallback: true }
  );

  const byStatus = emptyReconciliationStatusCounts();
  for (const r of statusRows || []) {
    const st = r.reconciliation_status as ReconciliationStatus;
    if (ReconciliationStatusValues.includes(st)) {
      byStatus[st] = r.cnt;
    }
  }

  const total = Number(totalRow?.total ?? 0);
  const unresolvedCount =
    (byStatus.pending ?? 0) + (byStatus.disputed ?? 0) + (byStatus.escalated ?? 0);

  let sumHours = 0;
  let resolvedCount = 0;
  for (const r of resolvedRows || []) {
    const start = Date.parse(r.created_at);
    const end = Date.parse(r.updated_at);
    if (!Number.isNaN(start) && !Number.isNaN(end) && end >= start) {
      sumHours += (end - start) / 3600000;
      resolvedCount += 1;
    }
  }

  return {
    organizationId,
    total,
    byStatus,
    unresolvedCount,
    averageResolutionHours: resolvedCount > 0 ? sumHours / resolvedCount : null,
  };
}

interface ReconciliationVarianceRow {
  reconciliation_id: string;
  kpi_id: string;
  finance_ref: string;
  reconciliation_status: string;
  initiated_by: string;
  created_at: string;
  updated_at: string;
  kpi_name: string | null;
  initiative_id: string | null;
  unit: string | null;
  projected_value: number | null;
  realized_value: number | null;
  // Engine-persisted reconciliation (resultsFinanceReconciliationService). When
  // present these are unit-normalised to the finance basis and carry a real
  // deviation + CONCLUSION_LAYER — preferred over the legacy monetary heuristic.
  eng_driver_key?: string | null;
  eng_projected_value?: number | null;
  eng_realized_value?: number | null;
  eng_deviation_absolute?: number | null;
  eng_deviation_percent?: number | null;
  eng_conclusion_json?: string | null;
}

/**
 * A KPI unit is *monetary* when its target_value and the summed
 * `v8_roi_realization_entries` (which record currency deltas/savings) share a
 * comparable basis. Percentage / ratio / count units do NOT — comparing an OEE
 * target of 85 (%) against a summed monetary realized value of €138,000 yields a
 * nonsensical +162252% variance. For non-monetary units we still surface the
 * projected value but suppress the fabricated monetary variance/mismatch.
 */
// NOTE: the `unit` fed here is sourced from `v8_kpi_definitions.metric_type`
// (enum: currency|percentage|count|ratio|duration|score|index) — the table has no
// free-text `unit` column. Only `currency` is monetary; every other metric_type
// (incl. `duration`) must be classified non-monetary so a summed €-realized value is
// never differenced against a %/count/duration target.
const NON_MONETARY_UNIT_RE =
  /^\s*(%|percent|percentage|pct|pp|ppt|pts?|points?|ratio|score|index|nps|csat|duration|days?|day|hrs?|hours?|months?|weeks?|szt\.?|pcs?|count|qty|units?|x)\s*$/i;

export function isMonetaryUnit(unit: string | null | undefined): boolean {
  const u = (unit ?? '').trim();
  if (!u) return true; // no unit → assume monetary (legacy default)
  return !NON_MONETARY_UNIT_RE.test(u);
}

/** Rounds to 2 decimals; treats |x| < 1e-9 as 0 to avoid float noise. */
function round2(value: number): number {
  const r = Math.round(value * 100) / 100;
  return Math.abs(r) < 1e-9 ? 0 : r;
}

/**
 * Reconciliation overview for the Results ROI surface (M16 → M15 read seam).
 *
 * Each `v8_kpi_finance_reconciliations` row is enriched with the KPI's
 * `target_value` (projected benefit) and the summed `v8_roi_realization_entries`
 * realized value, then a variance (realized − projected) is computed. This is the
 * DISPLAY path: Finance writes the reconciliation status; Results reads status +
 * variance here. Org-scoping is enforced via the `organization_id` predicate;
 * optional `initiativeId` / `kpiId` narrow the set.
 */
export async function getReconciliationOverview(
  organizationId: string,
  options?: { initiativeId?: string; kpiId?: string }
): Promise<ReconciliationVarianceOverview> {
  const initiativeId = options?.initiativeId?.trim() || undefined;
  const kpiId = options?.kpiId?.trim() || undefined;

  const filters: string[] = [];
  const params: unknown[] = [organizationId];
  if (initiativeId) {
    filters.push(' AND k.initiative_id = ?');
    params.push(initiativeId);
  }
  if (kpiId) {
    filters.push(' AND r.kpi_id = ?');
    params.push(kpiId);
  }

  // Engine columns (resultsFinanceReconciliationService via migration 20260703)
  // are only present after that migration runs. Guard the SELECT so this read
  // still works on pre-migration schemas / mock DBs.
  let reconCols = new Set<string>();
  try {
    reconCols = await getTableColumns('v8_kpi_finance_reconciliations');
  } catch {
    reconCols = new Set<string>();
  }
  const hasEngineCols = reconCols.has('deviation_absolute') && reconCols.has('conclusion_json');
  const engineSelect = hasEngineCols
    ? `,
       r.driver_key AS eng_driver_key,
       r.projected_value AS eng_projected_value,
       r.realized_value AS eng_realized_value,
       r.deviation_absolute AS eng_deviation_absolute,
       r.deviation_percent AS eng_deviation_percent,
       r.conclusion_json AS eng_conclusion_json`
    : '';

  // LEFT JOIN to the KPI definition (projected = target_value) and a correlated
  // subquery sum of realized entries. All joins are org-scoped so a foreign-org
  // KPI/realization can never bleed into another org's variance. When the
  // reconciliation ENGINE has persisted a unit-normalised deviation (+ CONCLUSION
  // layer), those columns are preferred over the legacy monetary heuristic.
  const rows = await dbAll<ReconciliationVarianceRow>(
    `SELECT
       r.reconciliation_id,
       r.kpi_id,
       r.finance_ref,
       r.reconciliation_status,
       r.initiated_by,
       r.created_at,
       r.updated_at,
       k.name AS kpi_name,
       k.initiative_id AS initiative_id,
       k.metric_type AS unit,
       k.target_value AS projected_value,
       (
         SELECT SUM(e.realized_value)
         FROM v8_roi_realization_entries e
         WHERE e.organization_id = r.organization_id AND e.kpi_id = r.kpi_id
       ) AS realized_value${engineSelect}
     FROM v8_kpi_finance_reconciliations r
     LEFT JOIN v8_kpi_definitions k
       ON k.kpi_id = r.kpi_id AND k.organization_id = r.organization_id
     WHERE r.organization_id = ?${filters.join('')}
     ORDER BY r.created_at DESC`,
    params,
    // fallback:false — surface real query errors (bad column / schema drift) in the
    // log instead of silently returning []. A swallowed `column ... does not exist`
    // is what made this endpoint always-empty; the base tables exist in every real
    // deployment, so a genuine failure here SHOULD be loud (500 + logged), not hidden.
    { fallback: false }
  );

  const byStatus = emptyReconciliationStatusCounts();
  let mismatchCount = 0;

  const items: ReconciliationVarianceItem[] = (rows || []).map((row) => {
    const unit = row.unit != null && String(row.unit).trim() ? String(row.unit).trim() : null;

    // PREFER the engine's persisted deviation when present: it is unit-normalised
    // to a single finance basis (no "% vs €" fabrications) and carries a
    // CONCLUSION_LAYER. Detected by a non-null engine deviation OR conclusion.
    const engineReconciled = row.eng_deviation_absolute != null || row.eng_conclusion_json != null;

    let projectedValue: number | null;
    let realizedValue: number | null;
    let varianceAbsolute: number | null = null;
    let variancePercent: number | null = null;
    let hasMismatch = false;
    let conclusion: unknown | null = null;
    let driverKey: string | null = null;

    if (engineReconciled) {
      driverKey =
        row.eng_driver_key != null && String(row.eng_driver_key).trim()
          ? String(row.eng_driver_key)
          : null;
      projectedValue = row.eng_projected_value != null ? Number(row.eng_projected_value) : null;
      realizedValue = row.eng_realized_value != null ? Number(row.eng_realized_value) : null;
      varianceAbsolute =
        row.eng_deviation_absolute != null ? Number(row.eng_deviation_absolute) : null;
      variancePercent =
        row.eng_deviation_percent != null ? Number(row.eng_deviation_percent) : null;
      hasMismatch = varianceAbsolute != null && varianceAbsolute !== 0;
      if (row.eng_conclusion_json) {
        try {
          conclusion = JSON.parse(String(row.eng_conclusion_json));
        } catch {
          conclusion = null;
        }
      }
    } else {
      const monetary = isMonetaryUnit(unit);
      projectedValue = row.projected_value != null ? Number(row.projected_value) : null;
      // The realized side sums `v8_roi_realization_entries` (currency deltas), so it
      // is only comparable to `target_value` when the KPI is measured in money.
      realizedValue = monetary && row.realized_value != null ? Number(row.realized_value) : null;

      // Only compute a variance when both sides share a monetary basis. A percentage
      // KPI (e.g. OEE 85%) vs a summed €-realized value is not a real variance.
      if (monetary && projectedValue != null && realizedValue != null) {
        varianceAbsolute = round2(realizedValue - projectedValue);
        variancePercent =
          projectedValue !== 0 ? round2((varianceAbsolute / Math.abs(projectedValue)) * 100) : null;
        hasMismatch = varianceAbsolute !== 0;
      }
    }
    if (hasMismatch) mismatchCount += 1;

    const status = row.reconciliation_status as ReconciliationStatus;
    if (ReconciliationStatusValues.includes(status)) {
      byStatus[status] = (byStatus[status] ?? 0) + 1;
    }

    return {
      reconciliationId: row.reconciliation_id,
      kpiId: row.kpi_id,
      kpiName: row.kpi_name ?? null,
      unit,
      initiativeId: row.initiative_id ?? null,
      financeRef: row.finance_ref,
      reconciliationStatus: status,
      initiatedBy: row.initiated_by as ReconciliationVarianceItem['initiatedBy'],
      projectedValue,
      realizedValue,
      varianceAbsolute,
      variancePercent,
      hasMismatch,
      driverKey,
      conclusion,
      engineReconciled,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  });

  const unresolvedCount =
    (byStatus.pending ?? 0) + (byStatus.disputed ?? 0) + (byStatus.escalated ?? 0);

  return {
    organizationId,
    initiativeId: initiativeId ?? null,
    items,
    summary: {
      total: items.length,
      byStatus,
      mismatchCount,
      unresolvedCount,
    },
  };
}

/**
 * Master Results surface: composes scorecard, deviations, ROI, reconciliation, recent packs.
 */
export async function getResultsDashboard(
  organizationId: string,
  options?: { initiativeId?: string }
): Promise<ResultsDashboardSnapshot> {
  const initiativeId = options?.initiativeId?.trim() || undefined;
  const [kpiScorecard, activeDeviations, roiDashboard, reconciliationHealth, reviewTimeline] =
    await Promise.all([
      getKPIScorecard(organizationId, initiativeId),
      getActiveDeviations(organizationId, undefined, initiativeId),
      getROIDashboard(organizationId, initiativeId),
      getReconciliationHealth(organizationId),
      getReviewPackTimeline(organizationId),
    ]);

  const recentReviewPacks = reviewTimeline.slice(-5);

  return {
    organizationId,
    kpiScorecard,
    activeDeviationsCount: activeDeviations.length,
    roiDashboard,
    reconciliationHealth,
    recentReviewPacks,
  };
}

// ==========================================
// P04-B: CLOSED-LOOP WORKFLOW (signal→report→reconciliation→action)
// ==========================================

export const KpiSignalTypeValues = [
  'deviation',
  'target_drift',
  'data_quality',
  'reconciliation_needed',
  'freshness',
  'budget_health',
] as const;
export type KpiSignalType = (typeof KpiSignalTypeValues)[number];

export const NextActionStatusValues = [
  'pending',
  'acknowledged',
  'action_created',
  'dismissed',
] as const;
export type NextActionStatus = (typeof NextActionStatusValues)[number];

export const KpiNextActionTypeValues = [
  'reconcile',
  'investigate',
  'escalate',
  'create_initiative',
  'update_target',
] as const;
export type KpiNextActionType = (typeof KpiNextActionTypeValues)[number];

export interface KpiSignal {
  signalId: string;
  organizationId: string;
  kpiId: string;
  signalType: KpiSignalType;
  severity: DeviationSeverity;
  description: string;
  evidencePointers: string[];
  nextActionStatus: NextActionStatus;
  nextActionRef: string | null;
  acknowledgedBy: string | null;
  acknowledgedAt: string | null;
  createdAt: string;
}

export interface KpiNextAction {
  actionId: string;
  organizationId: string;
  signalId: string;
  kpiId: string;
  actionType: KpiNextActionType;
  description: string;
  assignedTo: string | null;
  status: 'open' | 'in_progress' | 'completed' | 'cancelled';
  financeConsequenceRef: string | null;
  executionFollowUpRef: string | null;
  createdBy: string;
  createdAt: string;
  completedAt: string | null;
}

export async function createKpiSignal(params: {
  organizationId: string;
  kpiId: string;
  signalType: KpiSignalType;
  severity: DeviationSeverity;
  description: string;
  evidencePointers?: string[];
}): Promise<KpiSignal> {
  const signalId = uuidv4();
  const now = new Date().toISOString();
  const signal: KpiSignal = {
    signalId,
    organizationId: params.organizationId,
    kpiId: params.kpiId,
    signalType: params.signalType,
    severity: params.severity,
    description: params.description,
    evidencePointers: params.evidencePointers || [],
    nextActionStatus: 'pending',
    nextActionRef: null,
    acknowledgedBy: null,
    acknowledgedAt: null,
    createdAt: now,
  };

  await dbRun(
    `INSERT INTO v8_kpi_signals (
      signal_id, organization_id, kpi_id, signal_type, severity,
      description, evidence_pointers, next_action_status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      signal.signalId,
      signal.organizationId,
      signal.kpiId,
      signal.signalType,
      signal.severity,
      signal.description,
      JSON.stringify(signal.evidencePointers),
      signal.nextActionStatus,
      signal.createdAt,
    ]
  );

  logger.info(
    `${LOG_PREFIX} Created KPI signal ${signalId} type=${params.signalType} for KPI ${params.kpiId}`
  );

  eventBus.publish('kpi.signal_created', {
    organizationId: params.organizationId,
    kpiId: params.kpiId,
    signalId,
    signalType: params.signalType,
    severity: params.severity,
  });

  try {
    const kpiRow = await dbGet<{ owner_user_id?: string; name?: string }>(
      `SELECT owner_user_id, name FROM initiative_kpis WHERE id = ? AND organization_id = ?`,
      [params.kpiId, params.organizationId],
      { fallback: true }
    );
    if (kpiRow?.owner_user_id) {
      sendNotification({
        userId: kpiRow.owner_user_id,
        organizationId: params.organizationId,
        type: 'KPI_SIGNAL_DETECTED',
        title: `KPI Signal: ${kpiRow.name || params.kpiId}`,
        body: params.description || `${params.signalType} signal detected (${params.severity})`,
        severity: params.severity === 'critical' ? 'CRITICAL' : 'WARNING',
        entityType: 'kpi',
        entityId: params.kpiId,
        actionUrl: `/benefits?tab=results_kpi&mode=queue`,
      }).catch((err: any) =>
        logger.debug(`${LOG_PREFIX} Signal notification failed: ${err?.message}`)
      );
    }
  } catch {
    // non-blocking
  }

  return signal;
}

export async function getKpiSignals(
  organizationId: string,
  filters?: { kpiId?: string; status?: NextActionStatus; signalType?: KpiSignalType }
): Promise<KpiSignal[]> {
  let sql = `SELECT * FROM v8_kpi_signals WHERE organization_id = ?`;
  const params: unknown[] = [organizationId];

  if (filters?.kpiId) {
    sql += ` AND kpi_id = ?`;
    params.push(filters.kpiId);
  }
  if (filters?.status) {
    sql += ` AND next_action_status = ?`;
    params.push(filters.status);
  }
  if (filters?.signalType) {
    sql += ` AND signal_type = ?`;
    params.push(filters.signalType);
  }
  sql += ` ORDER BY created_at DESC`;

  const rows = await dbAll<any>(sql, params, { fallback: true });
  return (rows || []).map((r: any) => ({
    signalId: r.signal_id,
    organizationId: r.organization_id,
    kpiId: r.kpi_id,
    signalType: r.signal_type,
    severity: r.severity,
    description: r.description,
    evidencePointers: safeJsonParse(r.evidence_pointers, []),
    nextActionStatus: r.next_action_status,
    nextActionRef: r.next_action_ref || null,
    acknowledgedBy: r.acknowledged_by || null,
    acknowledgedAt: r.acknowledged_at || null,
    createdAt: r.created_at,
  }));
}

export async function acknowledgeKpiSignal(
  signalId: string,
  organizationId: string,
  userId: string,
  _reason: string
): Promise<KpiSignal> {
  const now = new Date().toISOString();
  await dbRun(
    `UPDATE v8_kpi_signals SET next_action_status = 'acknowledged', acknowledged_by = ?, acknowledged_at = ?
     WHERE signal_id = ? AND organization_id = ?`,
    [userId, now, signalId, organizationId]
  );
  const signals = await getKpiSignals(organizationId, { kpiId: undefined });
  const found = signals.find((s) => s.signalId === signalId);
  if (!found) throw Object.assign(new Error('Signal not found'), { code: 'P04_SIGNAL_NOT_FOUND' });
  return found;
}

export async function createKpiNextAction(params: {
  organizationId: string;
  signalId: string;
  kpiId: string;
  actionType: KpiNextAction['actionType'];
  description: string;
  assignedTo?: string;
  createdBy: string;
  financeConsequenceRef?: string;
  executionFollowUpRef?: string;
}): Promise<KpiNextAction> {
  const actionId = uuidv4();
  const now = new Date().toISOString();
  const action: KpiNextAction = {
    actionId,
    organizationId: params.organizationId,
    signalId: params.signalId,
    kpiId: params.kpiId,
    actionType: params.actionType,
    description: params.description,
    assignedTo: params.assignedTo || null,
    status: 'open',
    financeConsequenceRef: params.financeConsequenceRef || null,
    executionFollowUpRef: params.executionFollowUpRef || null,
    createdBy: params.createdBy,
    createdAt: now,
    completedAt: null,
  };

  await dbRun(
    `INSERT INTO v8_kpi_next_actions (
      action_id, organization_id, signal_id, kpi_id, action_type,
      description, assigned_to, status, finance_consequence_ref,
      execution_follow_up_ref, created_by, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      action.actionId,
      action.organizationId,
      action.signalId,
      action.kpiId,
      action.actionType,
      action.description,
      action.assignedTo,
      action.status,
      action.financeConsequenceRef,
      action.executionFollowUpRef,
      action.createdBy,
      action.createdAt,
    ]
  );

  await dbRun(
    `UPDATE v8_kpi_signals SET next_action_status = 'action_created', next_action_ref = ?
     WHERE signal_id = ? AND organization_id = ?`,
    [actionId, params.signalId, params.organizationId]
  );

  logger.info(`${LOG_PREFIX} Created next action ${actionId} for signal ${params.signalId}`);

  eventBus.publish('kpi.next_action_created', {
    organizationId: params.organizationId,
    kpiId: params.kpiId,
    signalId: params.signalId,
    actionId,
    actionType: params.actionType,
    assignedTo: params.assignedTo || null,
  });

  if (params.assignedTo) {
    sendNotification({
      userId: params.assignedTo,
      organizationId: params.organizationId,
      type: 'KPI_NEXT_ACTION_ASSIGNED',
      title: `KPI Action Assigned`,
      body: params.description || `New ${params.actionType} action for KPI`,
      severity: 'INFO',
      entityType: 'kpi',
      entityId: params.kpiId,
      actionUrl: `/benefits?tab=results_kpi&mode=queue`,
    }).catch((err: any) =>
      logger.debug(`${LOG_PREFIX} Next action notification failed: ${err?.message}`)
    );
  }

  return action;
}

export async function getKpiNextActions(
  organizationId: string,
  filters?: { kpiId?: string; signalId?: string; status?: string }
): Promise<KpiNextAction[]> {
  let sql = `SELECT * FROM v8_kpi_next_actions WHERE organization_id = ?`;
  const params: unknown[] = [organizationId];
  if (filters?.kpiId) {
    sql += ` AND kpi_id = ?`;
    params.push(filters.kpiId);
  }
  if (filters?.signalId) {
    sql += ` AND signal_id = ?`;
    params.push(filters.signalId);
  }
  if (filters?.status) {
    sql += ` AND status = ?`;
    params.push(filters.status);
  }
  sql += ` ORDER BY created_at DESC`;

  const rows = await dbAll<any>(sql, params, { fallback: true });
  return (rows || []).map((r: any) => ({
    actionId: r.action_id,
    organizationId: r.organization_id,
    signalId: r.signal_id,
    kpiId: r.kpi_id,
    actionType: r.action_type,
    description: r.description,
    assignedTo: r.assigned_to || null,
    status: r.status,
    financeConsequenceRef: r.finance_consequence_ref || null,
    executionFollowUpRef: r.execution_follow_up_ref || null,
    createdBy: r.created_by,
    createdAt: r.created_at,
    completedAt: r.completed_at || null,
  }));
}

export async function completeKpiNextAction(
  actionId: string,
  organizationId: string
): Promise<void> {
  const now = new Date().toISOString();
  await dbRun(
    `UPDATE v8_kpi_next_actions SET status = 'completed', completed_at = ?
     WHERE action_id = ? AND organization_id = ?`,
    [now, actionId, organizationId]
  );
}

export { KPI_WORKFLOW_DEGRADED_REASONS as KpiWorkflowDegradedReasonValues } from './kpiWorkflowCanon.js';
import type { KpiWorkflowDegradedReason } from './kpiWorkflowCanon.js';
export type { KpiWorkflowDegradedReason };

export interface KpiWorkflowStatus {
  kpiId: string;
  organizationId: string;
  workflowState: 'ready' | 'degraded';
  degradedReasons: Array<{ reason: KpiWorkflowDegradedReason; detail: string; nextAction: string }>;
  openSignals: number;
  pendingActions: number;
  reconciliationHealth: ReconciliationHealthSummary;
}

export async function getKpiWorkflowStatus(
  kpiId: string,
  organizationId: string
): Promise<KpiWorkflowStatus> {
  const signals = await getKpiSignals(organizationId, { kpiId });
  const actions = await getKpiNextActions(organizationId, { kpiId });
  let reconciliationHealth: ReconciliationHealthSummary;
  try {
    reconciliationHealth = await getReconciliationHealth(organizationId);
  } catch {
    reconciliationHealth = {
      organizationId,
      total: 0,
      byStatus: { pending: 0, reconciled: 0, disputed: 0, escalated: 0 },
      unresolvedCount: 0,
      averageResolutionHours: null,
    };
  }

  const degradedReasons: KpiWorkflowStatus['degradedReasons'] = [];

  const kpi = await dbGet<any>(
    `SELECT current_value, target_value, updated_at, status, mode FROM v8_kpi_definitions WHERE kpi_id = ? AND organization_id = ?`,
    [kpiId, organizationId],
    { fallback: true }
  ).catch(() => null);

  if (!kpi || kpi.current_value == null) {
    degradedReasons.push({
      reason: 'missing_data',
      detail: 'KPI has no current value recorded',
      nextAction: 'Record a measurement via POST /api/v8/results/kpis/:kpiId/time-series',
    });
  }

  if (reconciliationHealth.unresolvedCount > 0) {
    degradedReasons.push({
      reason: 'discrepancy_unresolved',
      detail: `${reconciliationHealth.unresolvedCount} unresolved reconciliation(s)`,
      nextAction: 'Resolve via PUT /api/v8/results/reconciliations/:id/resolve',
    });
  }

  // §8.1F: linkage_unavailable — KPI is initiative-linked but has no finance reconciliation row
  const linkageRow = await dbGet<{ reconciliation_id: string }>(
    `SELECT reconciliation_id FROM v8_kpi_finance_reconciliations WHERE kpi_id = ? AND organization_id = ? LIMIT 1`,
    [kpiId, organizationId],
    { fallback: true }
  ).catch(() => null);

  if (!linkageRow) {
    const initiativeLinked = await dbGet<{ kpi_id: string }>(
      `SELECT kpi_id FROM v8_kpi_definitions WHERE kpi_id = ? AND organization_id = ? AND mode = 'initiative_linked'`,
      [kpiId, organizationId],
      { fallback: true }
    ).catch(() => null);
    if (initiativeLinked) {
      degradedReasons.push({
        reason: 'linkage_unavailable',
        detail: 'KPI is initiative-linked but has no finance reconciliation linkage',
        nextAction: 'Create finance linkage via POST /api/v8/results/reconciliations',
      });
    }
  }

  // §8.1F: permission_denied — locked statuses block definition/target edits
  if (kpi && (kpi.status === 'benefits_realization' || kpi.status === 'review')) {
    degradedReasons.push({
      reason: 'permission_denied',
      detail: `KPI is in '${kpi.status}' status — definition and target edits are blocked`,
      nextAction: 'Contact KPI Owner to transition status before editing',
    });
  }

  const openSignals = signals.filter((s) => s.nextActionStatus === 'pending').length;
  const pendingActions = actions.filter(
    (a) => a.status === 'open' || a.status === 'in_progress'
  ).length;

  return {
    kpiId,
    organizationId,
    workflowState: degradedReasons.length > 0 ? 'degraded' : 'ready',
    degradedReasons,
    openSignals,
    pendingActions,
    reconciliationHealth,
  };
}
