/**
 * V8 Finance Integration & Promotion — Core Primitives
 *
 * Document ingestion pipeline, initiative economics linkage,
 * dual-gate promotion (Decision W6-8), unreconciled delta escalation
 * (Decision W6-9), and cloud-linked source refresh (Decision W6-10).
 * Canonical sources: WP-W6-OUT-03, DECISION_LOG_WAVE_6.
 */

import { z } from 'zod';

// ==========================================
// ENUMS / LITERALS
// ==========================================

export const IngestionReadinessStateValues = [
  'uploaded',
  'recognized',
  'confidence_assessed',
  'ready',
  'review_required',
  'failed',
  'rejected',
] as const;
export type IngestionReadinessState = (typeof IngestionReadinessStateValues)[number];

export const LinkageTypeValues = [
  'budget',
  'forecast',
  'actual',
  'variance',
] as const;
export type LinkageType = (typeof LinkageTypeValues)[number];

export const LinkageStatusValues = [
  'not_started',
  'local_only',
  'linked_to_finance_model',
  'linked_to_finance_scenario',
  'linked_to_roi_tracking',
  'stale_vs_finance_model',
] as const;
export type LinkageStatus = (typeof LinkageStatusValues)[number];

export const PromotionGateResultValues = [
  'approved',
  'rejected',
  'review_required',
] as const;
export type PromotionGateResult = (typeof PromotionGateResultValues)[number];

export const MaterialityLevelValues = [
  'low',
  'medium',
  'high',
  'critical',
] as const;
export type MaterialityLevel = (typeof MaterialityLevelValues)[number];

// ==========================================
// INTERFACES
// ==========================================

export interface FinanceDocumentIngestion {
  ingestionId: string;
  organizationId: string;
  documentRef: string;
  recognitionConfidence: number | null;
  readinessState: IngestionReadinessState;
  firstModelRef: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InitiativeEconomicsLinkage {
  linkageId: string;
  organizationId: string;
  financeModelRef: string;
  initiativeId: string;
  linkageType: LinkageType;
  status: LinkageStatus;
  createdAt: string;
  updatedAt: string;
}

export interface PromotionGate {
  gateId: string;
  organizationId: string;
  sourceArtifactRef: string;
  targetInitiativeId: string;
  permissionGateResult: PromotionGateResult;
  qualityGateResult: PromotionGateResult;
  provenancePreserved: boolean;
  staleStateChecked: boolean;
  overallResult: PromotionGateResult;
  createdAt: string;
}

export interface UnreconciledDeltaEscalation {
  escalationId: string;
  organizationId: string;
  initiativeId: string;
  financeRef: string;
  deltaMagnitude: number;
  deltaDuration: number;
  materialityLevel: MaterialityLevel;
  escalatedToCFO: boolean;
  thresholdBreached: boolean;
  createdAt: string;
  resolvedAt?: string | null;
  resolvedBy?: string | null;
  resolution?: string | null;
}

export interface CloudLinkedSourceRefresh {
  refreshId: string;
  organizationId: string;
  promotedArtifactRef: string;
  sourceModelRef: string;
  sourceUpdatedAt: string;
  staleWarningShown: boolean;
  reReviewPath: string | null;
  createdAt: string;
}

// ==========================================
// ZOD SCHEMAS
// ==========================================

export const FinanceDocumentIngestionSchema = z.object({
  ingestionId: z.string().uuid(),
  organizationId: z.string().uuid(),
  documentRef: z.string().min(1),
  recognitionConfidence: z.number().min(0).max(1).nullable(),
  readinessState: z.enum(IngestionReadinessStateValues),
  firstModelRef: z.string().nullable(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

export const InitiativeEconomicsLinkageSchema = z.object({
  linkageId: z.string().uuid(),
  organizationId: z.string().uuid(),
  financeModelRef: z.string().min(1),
  initiativeId: z.string().min(1),
  linkageType: z.enum(LinkageTypeValues),
  status: z.enum(LinkageStatusValues),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

export const PromotionGateSchema = z.object({
  gateId: z.string().uuid(),
  organizationId: z.string().uuid(),
  sourceArtifactRef: z.string().min(1),
  targetInitiativeId: z.string().min(1),
  permissionGateResult: z.enum(PromotionGateResultValues),
  qualityGateResult: z.enum(PromotionGateResultValues),
  provenancePreserved: z.boolean(),
  staleStateChecked: z.boolean(),
  overallResult: z.enum(PromotionGateResultValues),
  createdAt: z.string().min(1),
});

export const UnreconciledDeltaEscalationSchema = z.object({
  escalationId: z.string().uuid(),
  organizationId: z.string().uuid(),
  initiativeId: z.string().min(1),
  financeRef: z.string().min(1),
  deltaMagnitude: z.number().min(0),
  deltaDuration: z.number().int().min(0),
  materialityLevel: z.enum(MaterialityLevelValues),
  escalatedToCFO: z.boolean(),
  thresholdBreached: z.boolean(),
  createdAt: z.string().min(1),
  resolvedAt: z.string().min(1).nullable().optional(),
  resolvedBy: z.string().min(1).nullable().optional(),
  resolution: z.string().min(1).nullable().optional(),
});

export const CloudLinkedSourceRefreshSchema = z.object({
  refreshId: z.string().uuid(),
  organizationId: z.string().uuid(),
  promotedArtifactRef: z.string().min(1),
  sourceModelRef: z.string().min(1),
  sourceUpdatedAt: z.string().min(1),
  staleWarningShown: z.boolean(),
  reReviewPath: z.string().nullable(),
  createdAt: z.string().min(1),
});

// ==========================================
// INPUT TYPES (for service layer)
// ==========================================

export interface RecordIngestionParams {
  organizationId: string;
  documentRef: string;
  recognitionConfidence?: number | null;
  firstModelRef?: string | null;
}

export const RecordIngestionParamsSchema = z.object({
  organizationId: z.string().uuid(),
  documentRef: z.string().min(1),
  recognitionConfidence: z.number().min(0).max(1).nullable().optional(),
  firstModelRef: z.string().nullable().optional(),
});

export interface TransitionIngestionStateParams {
  ingestionId: string;
  organizationId: string;
  newState: IngestionReadinessState;
}

export const TransitionIngestionStateParamsSchema = z.object({
  ingestionId: z.string().uuid(),
  organizationId: z.string().uuid(),
  newState: z.enum(IngestionReadinessStateValues),
});

export interface CreateEconomicsLinkageParams {
  organizationId: string;
  financeModelRef: string;
  initiativeId: string;
  linkageType: LinkageType;
  status?: LinkageStatus;
}

export const CreateEconomicsLinkageParamsSchema = z.object({
  organizationId: z.string().uuid(),
  financeModelRef: z.string().min(1),
  initiativeId: z.string().min(1),
  linkageType: z.enum(LinkageTypeValues),
  status: z.enum(LinkageStatusValues).optional(),
});

export interface EvaluatePromotionGateParams {
  organizationId: string;
  sourceArtifactRef: string;
  targetInitiativeId: string;
  permissionGateResult: PromotionGateResult;
  qualityGateResult: PromotionGateResult;
  provenancePreserved: boolean;
  staleStateChecked: boolean;
}

export const EvaluatePromotionGateParamsSchema = z.object({
  organizationId: z.string().uuid(),
  sourceArtifactRef: z.string().min(1),
  targetInitiativeId: z.string().min(1),
  permissionGateResult: z.enum(PromotionGateResultValues),
  qualityGateResult: z.enum(PromotionGateResultValues),
  provenancePreserved: z.boolean(),
  staleStateChecked: z.boolean(),
});

export interface RecordDeltaEscalationParams {
  organizationId: string;
  initiativeId: string;
  financeRef: string;
  deltaMagnitude: number;
  deltaDuration: number;
  materialityLevel: MaterialityLevel;
}

export const RecordDeltaEscalationParamsSchema = z.object({
  organizationId: z.string().uuid(),
  initiativeId: z.string().min(1),
  financeRef: z.string().min(1),
  deltaMagnitude: z.number().min(0),
  deltaDuration: z.number().int().min(0),
  materialityLevel: z.enum(MaterialityLevelValues),
});

export interface RecordSourceRefreshParams {
  organizationId: string;
  promotedArtifactRef: string;
  sourceModelRef: string;
  sourceUpdatedAt: string;
  reReviewPath?: string | null;
}

export const RecordSourceRefreshParamsSchema = z.object({
  organizationId: z.string().uuid(),
  promotedArtifactRef: z.string().min(1),
  sourceModelRef: z.string().min(1),
  sourceUpdatedAt: z.string().min(1),
  reReviewPath: z.string().nullable().optional(),
});

// ==========================================
// INGESTION STATE MACHINE
// ==========================================

/**
 * Valid ingestion readiness state transitions.
 * Key = current state, Value = set of allowed target states.
 */
export const INGESTION_STATE_TRANSITIONS: Record<IngestionReadinessState, readonly IngestionReadinessState[]> = {
  uploaded: ['recognized', 'review_required', 'failed', 'rejected'],
  recognized: ['confidence_assessed', 'review_required', 'failed', 'rejected'],
  confidence_assessed: ['ready', 'review_required', 'failed', 'rejected'],
  ready: ['review_required', 'failed', 'rejected'],
  review_required: ['recognized', 'confidence_assessed', 'ready', 'failed', 'rejected'],
  failed: [],
  rejected: [],
} as const;

// ==========================================
// FINANCE RUNTIME SUMMARIES (Wave 18)
// ==========================================

export interface FinanceIngestionPipelineSummary {
  totalCount: number;
  byState: Partial<Record<IngestionReadinessState, number>>;
  confidenceBands: {
    high: number;
    medium: number;
    low: number;
    unknown: number;
  };
  averageConfidence: number | null;
}

export interface LinkageHealthSummary {
  totalLinkages: number;
  byLinkageType: Partial<Record<LinkageType, number>>;
  unlinkedInitiativesCount: number;
}

export interface FinanceRuntimeDashboard {
  ingestionPipeline: FinanceIngestionPipelineSummary;
  linkageHealth: LinkageHealthSummary;
  unresolvedEscalationsCount: number;
  staleSourceRefreshesCount: number;
  /** Share of gates with overall_result = approved; null when there are no gates. */
  promotionGatePassRate: number | null;
}

// ==========================================
// PROMOTION GATE LOGIC (Decision W6-8)
// ==========================================

/**
 * Compute overall promotion gate result from permission + quality sub-gates.
 * Rule: no finance-to-initiative promotion on permission alone.
 * Both gates must approve; any rejection rejects; otherwise review_required.
 */
export function computeOverallGateResult(
  permissionResult: PromotionGateResult,
  qualityResult: PromotionGateResult,
  provenancePreserved: boolean,
  staleStateChecked: boolean,
): PromotionGateResult {
  if (permissionResult === 'rejected' || qualityResult === 'rejected') {
    return 'rejected';
  }
  if (!provenancePreserved || !staleStateChecked) {
    return 'review_required';
  }
  if (permissionResult === 'approved' && qualityResult === 'approved') {
    return 'approved';
  }
  return 'review_required';
}

// ==========================================
// ESCALATION THRESHOLD LOGIC (Decision W6-9)
// ==========================================

export const DEFAULT_ESCALATION_THRESHOLDS = {
  deltaMagnitude: 0.1,
  deltaDuration: 30,
  materialityCFOLevel: 'high' as MaterialityLevel,
} as const;

/**
 * Determine whether an unreconciled delta breaches escalation thresholds.
 */
export function evaluateEscalationThreshold(
  deltaMagnitude: number,
  deltaDuration: number,
  materialityLevel: MaterialityLevel,
  thresholds = DEFAULT_ESCALATION_THRESHOLDS,
): { thresholdBreached: boolean; escalatedToCFO: boolean } {
  const magnitudeBreached = deltaMagnitude >= thresholds.deltaMagnitude;
  const durationBreached = deltaDuration >= thresholds.deltaDuration;
  const thresholdBreached = magnitudeBreached && durationBreached;

  const materialityOrder: MaterialityLevel[] = ['low', 'medium', 'high', 'critical'];
  const thresholdIdx = materialityOrder.indexOf(thresholds.materialityCFOLevel);
  const actualIdx = materialityOrder.indexOf(materialityLevel);
  const escalatedToCFO = thresholdBreached && actualIdx >= thresholdIdx;

  return { thresholdBreached, escalatedToCFO };
}
