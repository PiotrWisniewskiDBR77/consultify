/**
 * V8 Finance Integration & Promotion Service
 *
 * Document ingestion pipeline, initiative economics linkage,
 * dual-gate promotion (Decision W6-8), unreconciled delta escalation
 * (Decision W6-9), and cloud-linked source refresh (Decision W6-10).
 * Org-level isolation on every query.
 */

import { v4 as uuidv4 } from 'uuid';

import type {
  FinanceDocumentIngestion,
  InitiativeEconomicsLinkage,
  PromotionGate,
  UnreconciledDeltaEscalation,
  CloudLinkedSourceRefresh,
  IngestionReadinessState,
  RecordIngestionParams,
  TransitionIngestionStateParams,
  CreateEconomicsLinkageParams,
  EvaluatePromotionGateParams,
  RecordDeltaEscalationParams,
  RecordSourceRefreshParams,
} from '../../types/financeIntegrationPromotion.js';
import {
  INGESTION_STATE_TRANSITIONS,
  RecordIngestionParamsSchema,
  TransitionIngestionStateParamsSchema,
  CreateEconomicsLinkageParamsSchema,
  EvaluatePromotionGateParamsSchema,
  RecordDeltaEscalationParamsSchema,
  RecordSourceRefreshParamsSchema,
  computeOverallGateResult,
  evaluateEscalationThreshold,
} from '../../types/financeIntegrationPromotion.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

// ==========================================
// HELPERS
// ==========================================

const LOG_PREFIX = '[V8:FinanceIntegration]';

// ==========================================
// ROW MAPPERS
// ==========================================

interface IngestionRow {
  ingestion_id: string;
  organization_id: string;
  document_ref: string;
  recognition_confidence: number | null;
  readiness_state: string;
  first_model_ref: string | null;
  created_at: string;
  updated_at: string;
}

function rowToIngestion(row: IngestionRow): FinanceDocumentIngestion {
  return {
    ingestionId: row.ingestion_id,
    organizationId: row.organization_id,
    documentRef: row.document_ref,
    recognitionConfidence: row.recognition_confidence,
    readinessState: row.readiness_state as IngestionReadinessState,
    firstModelRef: row.first_model_ref,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

interface LinkageRow {
  linkage_id: string;
  organization_id: string;
  finance_model_ref: string;
  initiative_id: string;
  linkage_type: string;
  status: string;
  created_at: string;
  updated_at: string;
}

function rowToLinkage(row: LinkageRow): InitiativeEconomicsLinkage {
  return {
    linkageId: row.linkage_id,
    organizationId: row.organization_id,
    financeModelRef: row.finance_model_ref,
    initiativeId: row.initiative_id,
    linkageType: row.linkage_type as InitiativeEconomicsLinkage['linkageType'],
    status: row.status as InitiativeEconomicsLinkage['status'],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

interface PromotionGateRow {
  gate_id: string;
  organization_id: string;
  source_artifact_ref: string;
  target_initiative_id: string;
  permission_gate_result: string;
  quality_gate_result: string;
  provenance_preserved: number;
  stale_state_checked: number;
  overall_result: string;
  created_at: string;
}

function rowToPromotionGate(row: PromotionGateRow): PromotionGate {
  return {
    gateId: row.gate_id,
    organizationId: row.organization_id,
    sourceArtifactRef: row.source_artifact_ref,
    targetInitiativeId: row.target_initiative_id,
    permissionGateResult: row.permission_gate_result as PromotionGate['permissionGateResult'],
    qualityGateResult: row.quality_gate_result as PromotionGate['qualityGateResult'],
    provenancePreserved: row.provenance_preserved === 1,
    staleStateChecked: row.stale_state_checked === 1,
    overallResult: row.overall_result as PromotionGate['overallResult'],
    createdAt: row.created_at,
  };
}

interface EscalationRow {
  escalation_id: string;
  organization_id: string;
  initiative_id: string;
  finance_ref: string;
  delta_magnitude: number;
  delta_duration: number;
  materiality_level: string;
  escalated_to_cfo: number;
  threshold_breached: number;
  created_at: string;
}

function rowToEscalation(row: EscalationRow): UnreconciledDeltaEscalation {
  return {
    escalationId: row.escalation_id,
    organizationId: row.organization_id,
    initiativeId: row.initiative_id,
    financeRef: row.finance_ref,
    deltaMagnitude: row.delta_magnitude,
    deltaDuration: row.delta_duration,
    materialityLevel: row.materiality_level as UnreconciledDeltaEscalation['materialityLevel'],
    escalatedToCFO: row.escalated_to_cfo === 1,
    thresholdBreached: row.threshold_breached === 1,
    createdAt: row.created_at,
  };
}

interface SourceRefreshRow {
  refresh_id: string;
  organization_id: string;
  promoted_artifact_ref: string;
  source_model_ref: string;
  source_updated_at: string;
  stale_warning_shown: number;
  re_review_path: string | null;
  created_at: string;
}

function rowToSourceRefresh(row: SourceRefreshRow): CloudLinkedSourceRefresh {
  return {
    refreshId: row.refresh_id,
    organizationId: row.organization_id,
    promotedArtifactRef: row.promoted_artifact_ref,
    sourceModelRef: row.source_model_ref,
    sourceUpdatedAt: row.source_updated_at,
    staleWarningShown: row.stale_warning_shown === 1,
    reReviewPath: row.re_review_path,
    createdAt: row.created_at,
  };
}

// ==========================================
// INGESTION PIPELINE
// ==========================================

export function isValidIngestionTransition(
  current: IngestionReadinessState,
  target: IngestionReadinessState,
): boolean {
  const allowed = INGESTION_STATE_TRANSITIONS[current];
  return (allowed as readonly string[]).includes(target);
}

export async function recordIngestion(
  params: RecordIngestionParams,
): Promise<FinanceDocumentIngestion> {
  const validated = RecordIngestionParamsSchema.parse(params);

  const ingestionId = uuidv4();
  const now = new Date().toISOString();

  await dbRun(
    `INSERT INTO v8_finance_document_ingestions (
      ingestion_id, organization_id, document_ref,
      recognition_confidence, readiness_state, first_model_ref,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      ingestionId,
      validated.organizationId,
      validated.documentRef,
      validated.recognitionConfidence ?? null,
      'uploaded',
      validated.firstModelRef ?? null,
      now,
      now,
    ],
  );

  logger.info(`${LOG_PREFIX} Recorded ingestion ${ingestionId} for doc ${validated.documentRef}`);

  return {
    ingestionId,
    organizationId: validated.organizationId,
    documentRef: validated.documentRef,
    recognitionConfidence: validated.recognitionConfidence ?? null,
    readinessState: 'uploaded',
    firstModelRef: validated.firstModelRef ?? null,
    createdAt: now,
    updatedAt: now,
  };
}

export async function getIngestion(
  ingestionId: string,
  orgId: string,
): Promise<FinanceDocumentIngestion | null> {
  const row = await dbGet<IngestionRow>(
    `SELECT * FROM v8_finance_document_ingestions
     WHERE ingestion_id = ? AND organization_id = ?`,
    [ingestionId, orgId],
    { fallback: true },
  );

  if (!row) return null;
  return rowToIngestion(row);
}

export async function transitionIngestionState(
  params: TransitionIngestionStateParams,
): Promise<FinanceDocumentIngestion> {
  const validated = TransitionIngestionStateParamsSchema.parse(params);

  const row = await dbGet<IngestionRow>(
    `SELECT * FROM v8_finance_document_ingestions
     WHERE ingestion_id = ? AND organization_id = ?`,
    [validated.ingestionId, validated.organizationId],
    { fallback: true },
  );

  if (!row) {
    throw new Error(`Ingestion ${validated.ingestionId} not found`);
  }

  const currentState = row.readiness_state as IngestionReadinessState;

  if (!isValidIngestionTransition(currentState, validated.newState)) {
    throw new Error(
      `Invalid ingestion state transition: ${currentState} → ${validated.newState}`,
    );
  }

  const now = new Date().toISOString();

  await dbRun(
    `UPDATE v8_finance_document_ingestions
     SET readiness_state = ?, updated_at = ?
     WHERE ingestion_id = ?`,
    [validated.newState, now, validated.ingestionId],
  );

  logger.info(
    `${LOG_PREFIX} Ingestion ${validated.ingestionId}: ${currentState} → ${validated.newState}`,
  );

  return {
    ...rowToIngestion(row),
    readinessState: validated.newState,
    updatedAt: now,
  };
}

// ==========================================
// ECONOMICS LINKAGE
// ==========================================

export async function createEconomicsLinkage(
  params: CreateEconomicsLinkageParams,
): Promise<InitiativeEconomicsLinkage> {
  const validated = CreateEconomicsLinkageParamsSchema.parse(params);

  const linkageId = uuidv4();
  const now = new Date().toISOString();
  const status = validated.status ?? 'not_started';

  await dbRun(
    `INSERT INTO v8_initiative_economics_linkages (
      linkage_id, organization_id, finance_model_ref, initiative_id,
      linkage_type, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      linkageId,
      validated.organizationId,
      validated.financeModelRef,
      validated.initiativeId,
      validated.linkageType,
      status,
      now,
      now,
    ],
  );

  logger.info(
    `${LOG_PREFIX} Created economics linkage ${linkageId}: ${validated.linkageType} for initiative ${validated.initiativeId}`,
  );

  return {
    linkageId,
    organizationId: validated.organizationId,
    financeModelRef: validated.financeModelRef,
    initiativeId: validated.initiativeId,
    linkageType: validated.linkageType,
    status,
    createdAt: now,
    updatedAt: now,
  };
}

export async function getLinkagesByInitiative(
  initiativeId: string,
  orgId: string,
): Promise<InitiativeEconomicsLinkage[]> {
  const rows = await dbAll<LinkageRow>(
    `SELECT * FROM v8_initiative_economics_linkages
     WHERE initiative_id = ? AND organization_id = ?
     ORDER BY created_at DESC`,
    [initiativeId, orgId],
    { fallback: true },
  );

  return (rows || []).map(rowToLinkage);
}

// ==========================================
// PROMOTION GATES (Decision W6-8)
// ==========================================

export async function evaluatePromotionGate(
  params: EvaluatePromotionGateParams,
): Promise<PromotionGate> {
  const validated = EvaluatePromotionGateParamsSchema.parse(params);

  const overallResult = computeOverallGateResult(
    validated.permissionGateResult,
    validated.qualityGateResult,
    validated.provenancePreserved,
    validated.staleStateChecked,
  );

  const gateId = uuidv4();
  const now = new Date().toISOString();

  await dbRun(
    `INSERT INTO v8_promotion_gates (
      gate_id, organization_id, source_artifact_ref, target_initiative_id,
      permission_gate_result, quality_gate_result,
      provenance_preserved, stale_state_checked, overall_result,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      gateId,
      validated.organizationId,
      validated.sourceArtifactRef,
      validated.targetInitiativeId,
      validated.permissionGateResult,
      validated.qualityGateResult,
      validated.provenancePreserved ? 1 : 0,
      validated.staleStateChecked ? 1 : 0,
      overallResult,
      now,
    ],
  );

  logger.info(
    `${LOG_PREFIX} Promotion gate ${gateId}: ${overallResult} (perm=${validated.permissionGateResult}, qual=${validated.qualityGateResult})`,
  );

  return {
    gateId,
    organizationId: validated.organizationId,
    sourceArtifactRef: validated.sourceArtifactRef,
    targetInitiativeId: validated.targetInitiativeId,
    permissionGateResult: validated.permissionGateResult,
    qualityGateResult: validated.qualityGateResult,
    provenancePreserved: validated.provenancePreserved,
    staleStateChecked: validated.staleStateChecked,
    overallResult,
    createdAt: now,
  };
}

// ==========================================
// DELTA ESCALATION (Decision W6-9)
// ==========================================

export async function recordDeltaEscalation(
  params: RecordDeltaEscalationParams,
): Promise<UnreconciledDeltaEscalation> {
  const validated = RecordDeltaEscalationParamsSchema.parse(params);

  const { thresholdBreached, escalatedToCFO } = evaluateEscalationThreshold(
    validated.deltaMagnitude,
    validated.deltaDuration,
    validated.materialityLevel,
  );

  const escalationId = uuidv4();
  const now = new Date().toISOString();

  await dbRun(
    `INSERT INTO v8_unreconciled_delta_escalations (
      escalation_id, organization_id, initiative_id, finance_ref,
      delta_magnitude, delta_duration, materiality_level,
      escalated_to_cfo, threshold_breached, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      escalationId,
      validated.organizationId,
      validated.initiativeId,
      validated.financeRef,
      validated.deltaMagnitude,
      validated.deltaDuration,
      validated.materialityLevel,
      escalatedToCFO ? 1 : 0,
      thresholdBreached ? 1 : 0,
      now,
    ],
  );

  logger.info(
    `${LOG_PREFIX} Delta escalation ${escalationId}: magnitude=${validated.deltaMagnitude}, duration=${validated.deltaDuration}, cfo=${escalatedToCFO}`,
  );

  return {
    escalationId,
    organizationId: validated.organizationId,
    initiativeId: validated.initiativeId,
    financeRef: validated.financeRef,
    deltaMagnitude: validated.deltaMagnitude,
    deltaDuration: validated.deltaDuration,
    materialityLevel: validated.materialityLevel,
    escalatedToCFO,
    thresholdBreached,
    createdAt: now,
  };
}

export async function getEscalationsByInitiative(
  initiativeId: string,
  orgId: string,
): Promise<UnreconciledDeltaEscalation[]> {
  const rows = await dbAll<EscalationRow>(
    `SELECT * FROM v8_unreconciled_delta_escalations
     WHERE initiative_id = ? AND organization_id = ?
     ORDER BY created_at DESC`,
    [initiativeId, orgId],
    { fallback: true },
  );

  return (rows || []).map(rowToEscalation);
}

// ==========================================
// CLOUD-LINKED SOURCE REFRESH (Decision W6-10)
// ==========================================

export async function recordSourceRefresh(
  params: RecordSourceRefreshParams,
): Promise<CloudLinkedSourceRefresh> {
  const validated = RecordSourceRefreshParamsSchema.parse(params);

  const refreshId = uuidv4();
  const now = new Date().toISOString();

  await dbRun(
    `INSERT INTO v8_cloud_linked_source_refreshes (
      refresh_id, organization_id, promoted_artifact_ref, source_model_ref,
      source_updated_at, stale_warning_shown, re_review_path, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      refreshId,
      validated.organizationId,
      validated.promotedArtifactRef,
      validated.sourceModelRef,
      validated.sourceUpdatedAt,
      1,
      validated.reReviewPath ?? null,
      now,
    ],
  );

  logger.info(
    `${LOG_PREFIX} Source refresh ${refreshId}: artifact=${validated.promotedArtifactRef}, stale warning shown`,
  );

  return {
    refreshId,
    organizationId: validated.organizationId,
    promotedArtifactRef: validated.promotedArtifactRef,
    sourceModelRef: validated.sourceModelRef,
    sourceUpdatedAt: validated.sourceUpdatedAt,
    staleWarningShown: true,
    reReviewPath: validated.reReviewPath ?? null,
    createdAt: now,
  };
}

export async function getSourceRefreshes(
  promotedArtifactRef: string,
  orgId: string,
): Promise<CloudLinkedSourceRefresh[]> {
  const rows = await dbAll<SourceRefreshRow>(
    `SELECT * FROM v8_cloud_linked_source_refreshes
     WHERE promoted_artifact_ref = ? AND organization_id = ?
     ORDER BY created_at DESC`,
    [promotedArtifactRef, orgId],
    { fallback: true },
  );

  return (rows || []).map(rowToSourceRefresh);
}
