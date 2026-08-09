/**
 * KPI-E005 — InitiativeKPIImpact shared row + DTO types.
 *
 * Design: docs/product/results-vnext/KPI_E005_DESIGN.md §C.
 * Schema: server/migrations/20260813_rvn_kpi_initiative_impacts.sql.
 *
 * Convention mirrors kpiTypes.ts/kpiDeviationTypes.ts exactly: `*Row`
 * interfaces are snake_case, matching DB columns 1:1; DTO interfaces are
 * camelCase — the shape command/repository functions return to their
 * callers.
 */

import { toNullableNumber } from './kpiTypes.js';

// ==========================================
// ENUMS (mirror the CHECK constraints in the migration)
// ==========================================

export const INITIATIVE_KPI_IMPACT_STATUSES = [
  'proposed',
  'committed',
  'superseded',
  'realized_reviewed',
  'cancelled',
] as const;
export type InitiativeKpiImpactStatus = (typeof INITIATIVE_KPI_IMPACT_STATUSES)[number];

export const INITIATIVE_KPI_IMPACT_DIRECTIONS = ['increase', 'decrease'] as const;
export type InitiativeKpiImpactDirection = (typeof INITIATIVE_KPI_IMPACT_DIRECTIONS)[number];

// ==========================================
// rvn_kpi_initiative_impacts
// ==========================================

export interface InitiativeKpiImpactRow {
  impact_id: string;
  organization_id: string;
  kpi_id: string;
  initiative_id: string;
  definition_version_id_at_commitment: string | null;

  status: InitiativeKpiImpactStatus;

  expected_contribution_value: string | null;
  expected_contribution_direction: InitiativeKpiImpactDirection | null;
  target_completion_date: string | null;
  proposed_by: string;
  proposed_at: string;

  baseline_measurement_id: string | null;
  baseline_value_at_commitment: string | null;
  baseline_period_end: string | null;
  committed_by: string | null;
  committed_at: string | null;

  reviewed_attribution_value: string | null;
  reviewed_attribution_measurement_id: string | null;
  review_rationale: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;

  superseded_by_impact_id: string | null;
  superseded_at: string | null;

  row_version: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface InitiativeKpiImpact {
  impactId: string;
  organizationId: string;
  kpiId: string;
  initiativeId: string;
  definitionVersionIdAtCommitment: string | null;

  status: InitiativeKpiImpactStatus;

  expectedContributionValue: number | null;
  expectedContributionDirection: InitiativeKpiImpactDirection | null;
  targetCompletionDate: string | null;
  proposedBy: string;
  proposedAt: string;

  baselineMeasurementId: string | null;
  baselineValueAtCommitment: number | null;
  baselinePeriodEnd: string | null;
  committedBy: string | null;
  committedAt: string | null;

  reviewedAttributionValue: number | null;
  reviewedAttributionMeasurementId: string | null;
  reviewRationale: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;

  supersededByImpactId: string | null;
  supersededAt: string | null;

  rowVersion: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export function toInitiativeKpiImpact(row: InitiativeKpiImpactRow): InitiativeKpiImpact {
  return {
    impactId: row.impact_id,
    organizationId: row.organization_id,
    kpiId: row.kpi_id,
    initiativeId: row.initiative_id,
    definitionVersionIdAtCommitment: row.definition_version_id_at_commitment,
    status: row.status,
    expectedContributionValue: toNullableNumber(row.expected_contribution_value),
    expectedContributionDirection: row.expected_contribution_direction,
    targetCompletionDate: row.target_completion_date,
    proposedBy: row.proposed_by,
    proposedAt: row.proposed_at,
    baselineMeasurementId: row.baseline_measurement_id,
    baselineValueAtCommitment: toNullableNumber(row.baseline_value_at_commitment),
    baselinePeriodEnd: row.baseline_period_end,
    committedBy: row.committed_by,
    committedAt: row.committed_at,
    reviewedAttributionValue: toNullableNumber(row.reviewed_attribution_value),
    reviewedAttributionMeasurementId: row.reviewed_attribution_measurement_id,
    reviewRationale: row.review_rationale,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    supersededByImpactId: row.superseded_by_impact_id,
    supersededAt: row.superseded_at,
    rowVersion: row.row_version,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
