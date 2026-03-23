/**
 * V8 Results / ROI Continuity — Core Type Family
 *
 * Dual-mode KPI operating model, deviation governance, ROI realization tracking,
 * executive review packs, and KPI-Finance reconciliation.
 *
 * Decision W6-5: Results starts reconciliation, Finance resolves finance-side meaning.
 * Decision W6-6: Standalone KPI/ROI governance events in scope — dual-mode logic honored.
 * Decision W6-7: ExecutiveReviewPack is Results-native; Reports consumes as snapshot source.
 */

import { z } from 'zod';

// ==========================================
// ENUMS / LITERALS
// ==========================================

export const KPIModeValues = ['initiative_linked', 'standalone'] as const;
export type KPIMode = (typeof KPIModeValues)[number];

export const KPIStatusValues = [
  'design',
  'baseline',
  'active',
  'measurement',
  'review',
  'deviation',
  'improvement',
  'benefits_realization',
] as const;
export type KPIStatus = (typeof KPIStatusValues)[number];

export const MetricTypeValues = [
  'currency',
  'percentage',
  'count',
  'ratio',
  'duration',
  'score',
  'index',
] as const;
export type MetricType = (typeof MetricTypeValues)[number];

export const MeasurementCadenceValues = [
  'daily',
  'weekly',
  'biweekly',
  'monthly',
  'quarterly',
  'annually',
] as const;
export type MeasurementCadence = (typeof MeasurementCadenceValues)[number];

export const DeviationTypeValues = [
  'underperformance',
  'overperformance',
  'data_quality',
  'measurement_gap',
] as const;
export type DeviationType = (typeof DeviationTypeValues)[number];

export const DeviationSeverityValues = ['low', 'medium', 'high', 'critical'] as const;
export type DeviationSeverity = (typeof DeviationSeverityValues)[number];

export const ReviewPackStatusValues = ['draft', 'in_review', 'approved', 'shared'] as const;
export type ReviewPackStatus = (typeof ReviewPackStatusValues)[number];

export const ReconciliationStatusValues = [
  'pending',
  'reconciled',
  'disputed',
  'escalated',
] as const;
export type ReconciliationStatus = (typeof ReconciliationStatusValues)[number];

export const ReconciliationInitiatorValues = ['results', 'finance'] as const;
export type ReconciliationInitiator = (typeof ReconciliationInitiatorValues)[number];

// ==========================================
// INTERFACES
// ==========================================

export interface KPIDefinition {
  kpiId: string;
  organizationId: string;
  name: string;
  mode: KPIMode;
  initiativeId: string | null;
  metricType: MetricType;
  baselineValue: number | null;
  targetValue: number | null;
  currentValue: number | null;
  measurementCadence: MeasurementCadence;
  status: KPIStatus;
  createdAt: string;
  updatedAt: string;
}

export interface DeviationRecord {
  deviationId: string;
  organizationId: string;
  kpiId: string;
  deviationType: DeviationType;
  severity: DeviationSeverity;
  actionRequired: string;
  escalatedTo: string | null;
  createdAt: string;
}

export interface ROIRealizationEntry {
  entryId: string;
  organizationId: string;
  kpiId: string;
  initiativeId: string | null;
  realizedValue: number;
  period: string;
  provenanceRef: string | null;
  verifiedBy: string | null;
  createdAt: string;
}

export interface KPISummary {
  kpiId: string;
  name: string;
  status: KPIStatus;
  currentValue: number | null;
  targetValue: number | null;
}

export interface DeviationHighlight {
  deviationId: string;
  kpiId: string;
  deviationType: DeviationType;
  severity: DeviationSeverity;
}

export interface ROISnapshot {
  totalRealized: number;
  entriesCount: number;
  period: string;
}

export interface ExecutiveReviewPack {
  packId: string;
  organizationId: string;
  reviewPeriod: string;
  kpiSummaries: KPISummary[];
  deviationHighlights: DeviationHighlight[];
  roiSnapshot: ROISnapshot;
  status: ReviewPackStatus;
  createdAt: string;
  updatedAt: string;
}

export interface KPIFinanceReconciliation {
  reconciliationId: string;
  organizationId: string;
  kpiId: string;
  financeRef: string;
  reconciliationStatus: ReconciliationStatus;
  initiatedBy: ReconciliationInitiator;
  createdAt: string;
  updatedAt: string;
}

// ==========================================
// ZOD SCHEMAS
// ==========================================

export const KPISummarySchema = z.object({
  kpiId: z.string().uuid(),
  name: z.string().min(1),
  status: z.enum(KPIStatusValues),
  currentValue: z.number().nullable(),
  targetValue: z.number().nullable(),
});

export const DeviationHighlightSchema = z.object({
  deviationId: z.string().uuid(),
  kpiId: z.string().uuid(),
  deviationType: z.enum(DeviationTypeValues),
  severity: z.enum(DeviationSeverityValues),
});

export const ROISnapshotSchema = z.object({
  totalRealized: z.number(),
  entriesCount: z.number().int().min(0),
  period: z.string().min(1),
});

export const KPIDefinitionSchema = z.object({
  kpiId: z.string().uuid(),
  organizationId: z.string().uuid(),
  name: z.string().min(1),
  mode: z.enum(KPIModeValues),
  initiativeId: z.string().uuid().nullable(),
  metricType: z.enum(MetricTypeValues),
  baselineValue: z.number().nullable(),
  targetValue: z.number().nullable(),
  currentValue: z.number().nullable(),
  measurementCadence: z.enum(MeasurementCadenceValues),
  status: z.enum(KPIStatusValues),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

export const DeviationRecordSchema = z.object({
  deviationId: z.string().uuid(),
  organizationId: z.string().uuid(),
  kpiId: z.string().uuid(),
  deviationType: z.enum(DeviationTypeValues),
  severity: z.enum(DeviationSeverityValues),
  actionRequired: z.string().min(1),
  escalatedTo: z.string().nullable(),
  createdAt: z.string().min(1),
});

export const ROIRealizationEntrySchema = z.object({
  entryId: z.string().uuid(),
  organizationId: z.string().uuid(),
  kpiId: z.string().uuid(),
  initiativeId: z.string().uuid().nullable(),
  realizedValue: z.number(),
  period: z.string().min(1),
  provenanceRef: z.string().nullable(),
  verifiedBy: z.string().nullable(),
  createdAt: z.string().min(1),
});

export const ExecutiveReviewPackSchema = z.object({
  packId: z.string().uuid(),
  organizationId: z.string().uuid(),
  reviewPeriod: z.string().min(1),
  kpiSummaries: z.array(KPISummarySchema),
  deviationHighlights: z.array(DeviationHighlightSchema),
  roiSnapshot: ROISnapshotSchema,
  status: z.enum(ReviewPackStatusValues),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

export const KPIFinanceReconciliationSchema = z.object({
  reconciliationId: z.string().uuid(),
  organizationId: z.string().uuid(),
  kpiId: z.string().uuid(),
  financeRef: z.string().min(1),
  reconciliationStatus: z.enum(ReconciliationStatusValues),
  initiatedBy: z.enum(ReconciliationInitiatorValues),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

// ==========================================
// INPUT TYPES (for service layer)
// ==========================================

export interface CreateKPIParams {
  organizationId: string;
  name: string;
  mode: KPIMode;
  initiativeId?: string | null;
  metricType: MetricType;
  baselineValue?: number | null;
  targetValue?: number | null;
  currentValue?: number | null;
  measurementCadence: MeasurementCadence;
}

export const CreateKPIParamsSchema = z.object({
  organizationId: z.string().uuid(),
  name: z.string().min(1),
  mode: z.enum(KPIModeValues),
  initiativeId: z.string().uuid().nullable().optional(),
  metricType: z.enum(MetricTypeValues),
  baselineValue: z.number().nullable().optional(),
  targetValue: z.number().nullable().optional(),
  currentValue: z.number().nullable().optional(),
  measurementCadence: z.enum(MeasurementCadenceValues),
});

export interface RecordDeviationParams {
  organizationId: string;
  kpiId: string;
  deviationType: DeviationType;
  severity: DeviationSeverity;
  actionRequired: string;
  escalatedTo?: string | null;
}

export const RecordDeviationParamsSchema = z.object({
  organizationId: z.string().uuid(),
  kpiId: z.string().uuid(),
  deviationType: z.enum(DeviationTypeValues),
  severity: z.enum(DeviationSeverityValues),
  actionRequired: z.string().min(1),
  escalatedTo: z.string().nullable().optional(),
});

export interface RecordROIRealizationParams {
  organizationId: string;
  kpiId: string;
  initiativeId?: string | null;
  realizedValue: number;
  period: string;
  provenanceRef?: string | null;
  verifiedBy?: string | null;
}

export const RecordROIRealizationParamsSchema = z.object({
  organizationId: z.string().uuid(),
  kpiId: z.string().uuid(),
  initiativeId: z.string().uuid().nullable().optional(),
  realizedValue: z.number(),
  period: z.string().min(1),
  provenanceRef: z.string().nullable().optional(),
  verifiedBy: z.string().nullable().optional(),
});

export interface CreateExecutiveReviewPackParams {
  organizationId: string;
  reviewPeriod: string;
  kpiSummaries: KPISummary[];
  deviationHighlights: DeviationHighlight[];
  roiSnapshot: ROISnapshot;
}

export const CreateExecutiveReviewPackParamsSchema = z.object({
  organizationId: z.string().uuid(),
  reviewPeriod: z.string().min(1),
  kpiSummaries: z.array(KPISummarySchema),
  deviationHighlights: z.array(DeviationHighlightSchema),
  roiSnapshot: ROISnapshotSchema,
});

export interface InitiateReconciliationParams {
  organizationId: string;
  kpiId: string;
  financeRef: string;
  initiatedBy: ReconciliationInitiator;
}

export const InitiateReconciliationParamsSchema = z.object({
  organizationId: z.string().uuid(),
  kpiId: z.string().uuid(),
  financeRef: z.string().min(1),
  initiatedBy: z.enum(ReconciliationInitiatorValues),
});

// ==========================================
// KPI STATUS LIFECYCLE (valid transitions)
// ==========================================

export const KPI_STATUS_TRANSITIONS: Record<KPIStatus, KPIStatus[]> = {
  design: ['baseline'],
  baseline: ['active'],
  active: ['measurement'],
  measurement: ['review'],
  review: ['deviation', 'improvement', 'benefits_realization'],
  deviation: ['improvement', 'review'],
  improvement: ['measurement', 'benefits_realization'],
  benefits_realization: [],
} as const;
