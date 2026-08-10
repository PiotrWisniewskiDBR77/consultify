/**
 * ROI-E003 — `ApprovalSnapshot` types (§5).
 *
 * Design: docs/product/results-vnext/ROI_E003_DESIGN.md §5.
 * Schema: server/migrations/20260817_rvn_roi_decision_approval.sql.
 *
 * Same `*Row` (snake_case, 1:1 with DB columns) / DTO (camelCase) split
 * every other file in this package uses. `RoiApprovalSnapshotPayload` is the
 * frozen JSONB shape stored in `snapshot_payload` at INSERT time
 * (`approveRoiCase`, roiCaseApprovalCommands.ts) — never recomputed,
 * `content_hash` is computed once from exactly this shape via
 * `computeStateHash` (fixed key order).
 */
import type {
  RoiBenefitEvidenceLink,
  RoiBenefitLine,
  RoiCalculationPolicy,
  RoiCalculationRun,
  RoiCostLine,
  RoiAssumption,
  RoiScenario,
  RoiScenarioOverride,
} from './roiEconomicModelTypes.js';
import type { RoiBaseline, RoiCase } from './roiTypes.js';

// ==========================================
// rvn_roi_approval_snapshots
// ==========================================

export interface RoiApprovalSnapshotRow {
  snapshot_id: string;
  case_id: string;
  organization_id: string;
  sequence_number: number;
  decision_calculation_run_id: string;
  approved_by: string;
  approved_at: string;
  content_hash: string;
  snapshot_payload: RoiApprovalSnapshotPayload;
  created_at: string;
}

/**
 * Frozen payload — link metadata only (pinned kpi_id/version/purpose/
 * dispute_status), never hydrated KPI content (ROI-E002 D14 / ROI-E003 D11).
 * KPI hydration happens only at read time, per current reader
 * (`roiApprovalSnapshotRepository.ts`'s `getRoiApprovalSnapshot`).
 */
export interface RoiApprovalSnapshotPayload {
  case: RoiCase;
  baseline: RoiBaseline;
  calculationPolicy: RoiCalculationPolicy;
  assumptions: RoiAssumption[];
  costLines: RoiCostLine[];
  benefitLines: RoiBenefitLine[];
  benefitEvidenceLinks: RoiBenefitEvidenceLink[];
  scenarios: RoiScenario[];
  scenarioOverrides: RoiScenarioOverride[];
  decisionCalculationRun: RoiCalculationRun;
}

export interface RoiApprovalSnapshot {
  snapshotId: string;
  caseId: string;
  sequenceNumber: number;
  decisionCalculationRunId: string;
  approvedBy: string;
  approvedAt: string;
  contentHash: string;
  payload: RoiApprovalSnapshotPayload;
  createdAt: string;
}

export interface RoiApprovalSnapshotSummary {
  snapshotId: string;
  caseId: string;
  sequenceNumber: number;
  approvedBy: string;
  approvedAt: string;
  contentHash: string;
}

export function toRoiApprovalSnapshot(row: RoiApprovalSnapshotRow): RoiApprovalSnapshot {
  return {
    snapshotId: row.snapshot_id,
    caseId: row.case_id,
    sequenceNumber: row.sequence_number,
    decisionCalculationRunId: row.decision_calculation_run_id,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    contentHash: row.content_hash,
    payload: row.snapshot_payload,
    createdAt: row.created_at,
  };
}

export function toRoiApprovalSnapshotSummary(row: RoiApprovalSnapshotRow): RoiApprovalSnapshotSummary {
  return {
    snapshotId: row.snapshot_id,
    caseId: row.case_id,
    sequenceNumber: row.sequence_number,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    contentHash: row.content_hash,
  };
}
