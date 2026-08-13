/**
 * ROI-E007 — shared row + DTO types for the Finance/KPI seam tables.
 *
 * Design: docs/product/results-vnext/ROI_E007_DESIGN.md §3.
 * Schema: server/migrations/20260820_rvn_roi_finance_seam.sql.
 *
 * Same `*Row` (snake_case, 1:1 with DB columns) / DTO (camelCase) split
 * every other file in this package uses — one file per epic's tables,
 * matching `roiForecastActualTypes.ts`'s precedent (design §4). Reuses
 * `toNullableNumber` from `kpi/kpiTypes.ts` rather than restating it.
 *
 * `finance_artifact_type`/`finance_artifact_id`/`finance_version_id` are
 * plain `TEXT`, not enums or FKs — Decision D4: no existence validation, no
 * coupling to Finance's own schema shape.
 */
import { toNullableNumber } from '../kpi/kpiTypes.js';

// ==========================================
// ENUMS (mirror the CHECK constraints in the migration)
// ==========================================

export const ROI_FINANCE_RECONCILIATION_STATUSES = ['open', 'investigating', 'resolved', 'accepted_divergence'] as const;
export type RoiFinanceReconciliationStatus = (typeof ROI_FINANCE_RECONCILIATION_STATUSES)[number];

/** Terminal statuses that fan `roi.finance_reconciliation_resolved` (D1) —
 * every other status transition (i.e. into 'investigating') fans the
 * lighter `roi.finance_reconciliation_status_updated` instead. */
export const ROI_FINANCE_RECONCILIATION_TERMINAL_STATUSES: readonly RoiFinanceReconciliationStatus[] = [
  'resolved',
  'accepted_divergence',
];

// ==========================================
// rvn_roi_finance_links
// ==========================================

export interface RoiFinanceLinkRow {
  link_id: string;
  case_id: string;
  organization_id: string;
  finance_artifact_type: string;
  finance_artifact_id: string;
  finance_version_id: string;
  mapping_version: number;
  source: string;
  as_of: string;
  semantic_unit: string | null;
  currency: string | null;
  link_purpose: string;
  linked_by: string;
  linked_at: string;
  row_version: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface RoiFinanceLink {
  linkId: string;
  caseId: string;
  organizationId: string;
  financeArtifactType: string;
  financeArtifactId: string;
  financeVersionId: string;
  mappingVersion: number;
  source: string;
  asOf: string;
  semanticUnit: string | null;
  currency: string | null;
  linkPurpose: string;
  linkedBy: string;
  linkedAt: string;
  rowVersion: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export function toRoiFinanceLink(row: RoiFinanceLinkRow): RoiFinanceLink {
  return {
    linkId: row.link_id,
    caseId: row.case_id,
    organizationId: row.organization_id,
    financeArtifactType: row.finance_artifact_type,
    financeArtifactId: row.finance_artifact_id,
    financeVersionId: row.finance_version_id,
    mappingVersion: row.mapping_version,
    source: row.source,
    asOf: row.as_of,
    semanticUnit: row.semantic_unit,
    currency: row.currency,
    linkPurpose: row.link_purpose,
    linkedBy: row.linked_by,
    linkedAt: row.linked_at,
    rowVersion: row.row_version,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ==========================================
// rvn_roi_finance_reconciliations
// ==========================================

export interface RoiFinanceReconciliationRow {
  reconciliation_id: string;
  case_id: string;
  organization_id: string;
  finance_link_id: string;
  roi_value: string;
  finance_value: string;
  divergence_reason: string | null;
  status: RoiFinanceReconciliationStatus;
  opened_by: string;
  opened_at: string;
  resolved_by: string | null;
  resolved_at: string | null;
  resolution_notes: string | null;
  row_version: number;
}

export interface RoiFinanceReconciliation {
  reconciliationId: string;
  caseId: string;
  organizationId: string;
  financeLinkId: string;
  roiValue: number | null;
  financeValue: number | null;
  divergenceReason: string | null;
  status: RoiFinanceReconciliationStatus;
  openedBy: string;
  openedAt: string;
  resolvedBy: string | null;
  resolvedAt: string | null;
  resolutionNotes: string | null;
  rowVersion: number;
}

export function toRoiFinanceReconciliation(row: RoiFinanceReconciliationRow): RoiFinanceReconciliation {
  return {
    reconciliationId: row.reconciliation_id,
    caseId: row.case_id,
    organizationId: row.organization_id,
    financeLinkId: row.finance_link_id,
    roiValue: toNullableNumber(row.roi_value),
    financeValue: toNullableNumber(row.finance_value),
    divergenceReason: row.divergence_reason,
    status: row.status,
    openedBy: row.opened_by,
    openedAt: row.opened_at,
    resolvedBy: row.resolved_by,
    resolvedAt: row.resolved_at,
    resolutionNotes: row.resolution_notes,
    rowVersion: row.row_version,
  };
}
