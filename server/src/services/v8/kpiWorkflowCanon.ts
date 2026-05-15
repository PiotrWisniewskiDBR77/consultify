/**
 * P04 Final V8 — KPI closed-loop workflow canon.
 *
 * Frozen vocabulary (§8.1A): signal / target / trend / report(scorecard) /
 * reconciliation / next-action — mapped to existing runtime types.
 *
 * Closed-loop contract (§8.1D):
 *   signal → inspect → report/scorecard → reconcile (optional) → next action
 *
 * Anti-duplicate gate (§8.1E): no BI-suite drift, no parallel finance truth.
 * Degraded posture (§8.1F): missing data, discrepancy unresolved, linkage
 *   unavailable, permission denied — all explicit.
 *
 * This module is the canonical bridge between the P04 contract vocabulary and
 * the existing resultsROIService / kpiDeviationService / kpiReportSnapshotService.
 */

import type {
  DeviationRecord,
  DeviationSeverity,
  DeviationType,
  ExecutiveReviewPack,
  KPIDefinition,
  KPIFinanceReconciliation,
  KPIScorecardSummary,
  KPIStatus,
  KPITrendPoint,
  ReconciliationHealthSummary,
  ReconciliationStatus,
  ResultsKpiDrawerAction,
  ResultsKpiDrawerCase,
  ReviewPackTimelineEntry,
} from '../../types/resultsROIContinuity.js';

// ────────────────────────────────────────────────────────────────
// §8.1A — Frozen vocabulary types (P04 canonical)
// ────────────────────────────────────────────────────────────────

export const P04_KPI_WORKFLOW_CONTRACT = 'kpi_workflow_v1';

/**
 * Signal: detection that a KPI requires inspection.
 * Maps to DeviationRecord + freshness issues + discrepancy vs Finance.
 */
export interface KpiSignal {
  signalId: string;
  kpiId: string;
  signalType: 'deviation' | 'freshness' | 'discrepancy' | 'measurement_gap';
  severity: DeviationSeverity;
  summary: string;
  detectedAt: string;
  sourceRef?: string | null;
}

/**
 * Target: governed expectation for a KPI over a defined window.
 * Maps to KPIDefinition.targetValue + baselineValue.
 */
export interface KpiTarget {
  kpiId: string;
  targetValue: number | null;
  baselineValue: number | null;
  window?: string | null;
  setBy?: string | null;
  setAt?: string | null;
}

/**
 * Trend: direction-of-change over a declared window + aggregation method.
 * Maps to KPITrendPoint[].
 */
export interface KpiTrend {
  kpiId: string;
  direction: 'improving' | 'declining' | 'stable' | 'insufficient_data';
  window: string;
  aggregation: 'last' | 'sum' | 'average';
  points: KPITrendPoint[];
}

/**
 * Report/Scorecard: operator artifact that snapshots KPI state + context +
 * commentary + explicit next actions.
 * Maps to ExecutiveReviewPack + KpiReportSnapshot.
 */
export interface KpiReport {
  reportId: string;
  kpiScorecard: KPIScorecardSummary;
  deviationHighlights: Array<{ signalId: string; kpiId: string; severity: DeviationSeverity }>;
  roiSnapshot: { totalRealized: number; entriesCount: number };
  status: 'draft' | 'in_review' | 'approved' | 'shared';
  nextActions: KpiNextAction[];
  createdAt: string;
}

/**
 * Reconciliation: governed comparison of Results KPI truth vs Finance
 * interpretation when linkage exists.
 * Maps to KPIFinanceReconciliation.
 */
export interface KpiReconciliation {
  reconciliationId: string;
  kpiId: string;
  financeRef: string;
  status: ReconciliationStatus;
  initiatedBy: 'results' | 'finance';
  differenceSummary?: string | null;
  notes?: string | null;
  createdAt: string;
  resolvedAt?: string | null;
}

/**
 * Next Action: explicit follow-up decision and assignment created from
 * inspection/report/reconciliation. Must be assignable and traceable.
 */
export interface KpiNextAction {
  actionId: string;
  kpiId: string;
  sourceType: 'signal' | 'report' | 'reconciliation' | 'manual';
  sourceRef: string;
  title: string;
  assigneeId?: string | null;
  dueDate?: string | null;
  status: 'open' | 'in_progress' | 'done' | 'cancelled';
  createdAt: string;
}

// ────────────────────────────────────────────────────────────────
// §8.1D — Closed-loop workflow states
// ────────────────────────────────────────────────────────────────

export const KPI_WORKFLOW_STATES = [
  'signal_detected',
  'inspecting',
  'report_created',
  'reconciling',
  'action_assigned',
  'resolved',
] as const;

export type KpiWorkflowState = (typeof KPI_WORKFLOW_STATES)[number];

export const KPI_WORKFLOW_TRANSITIONS: Record<KpiWorkflowState, KpiWorkflowState[]> = {
  signal_detected: ['inspecting'],
  inspecting: ['report_created', 'action_assigned'],
  report_created: ['reconciling', 'action_assigned'],
  reconciling: ['action_assigned', 'resolved'],
  action_assigned: ['resolved'],
  resolved: [],
};

// ────────────────────────────────────────────────────────────────
// §8.1F — Degraded posture types
// ────────────────────────────────────────────────────────────────

export const KPI_DEGRADED_POSTURE_VALUES = [
  'nominal',
  'missing_data',
  'discrepancy_unresolved',
  'linkage_unavailable',
  'permission_denied',
  'stale_data',
] as const;

export type KpiDegradedPosture = (typeof KPI_DEGRADED_POSTURE_VALUES)[number];

export const KPI_WORKFLOW_DEGRADED_REASONS = [
  'missing_data',
  'discrepancy_unresolved',
  'linkage_unavailable',
  'permission_denied',
] as const;

export type KpiWorkflowDegradedReason = (typeof KPI_WORKFLOW_DEGRADED_REASONS)[number];

export interface KpiHealthStatus {
  kpiId: string;
  posture: KpiDegradedPosture;
  message: string;
  lastRefreshedAt?: string | null;
  source?: string | null;
}

/**
 * Compute health posture for a KPI based on available data.
 */
export function computeKpiHealthPosture(kpi: {
  currentValue: number | null;
  targetValue: number | null;
  updatedAt?: string | null;
  financeLinked?: boolean;
  reconciliationStatus?: ReconciliationStatus | null;
  hasPermission?: boolean;
}): KpiDegradedPosture {
  if (kpi.hasPermission === false) return 'permission_denied';

  if (kpi.currentValue == null && kpi.targetValue == null) return 'missing_data';

  if (kpi.updatedAt) {
    const staleDays = (Date.now() - new Date(kpi.updatedAt).getTime()) / 86400000;
    if (staleDays > 30) return 'stale_data';
  }

  if (kpi.financeLinked === true && !kpi.reconciliationStatus) return 'linkage_unavailable';

  if (
    kpi.reconciliationStatus === 'disputed' ||
    kpi.reconciliationStatus === 'pending' ||
    kpi.reconciliationStatus === 'escalated'
  ) {
    return 'discrepancy_unresolved';
  }

  return 'nominal';
}

// ────────────────────────────────────────────────────────────────
// §8.1B — KPI→Finance linkage boundary types
// ────────────────────────────────────────────────────────────────

export const LINKAGE_PATTERNS = ['interpretation', 'driver', 'review', 'realization'] as const;

export type LinkagePattern = (typeof LINKAGE_PATTERNS)[number];

export interface KpiFinanceLinkMetadata {
  kpiId: string;
  financeArtifactType: string;
  financeArtifactId: string;
  linkMode: LinkagePattern;
  linkRationale?: string | null;
  syncStatus: 'active' | 'stale' | 'broken';
  lastReconciledAt?: string | null;
}

// ────────────────────────────────────────────────────────────────
// §8.1C — Permissions model
// ────────────────────────────────────────────────────────────────

export const KPI_PERMISSION_ROLES = {
  KPI_OWNER: 'kpi_owner',
  FINANCE_OWNER: 'finance_owner',
  VIEWER: 'viewer',
  COMMENTER: 'commenter',
} as const;

export type KpiPermissionRole = (typeof KPI_PERMISSION_ROLES)[keyof typeof KPI_PERMISSION_ROLES];

export const KPI_PERMISSION_MATRIX: Record<string, KpiPermissionRole[]> = {
  edit_definition: ['kpi_owner'],
  edit_targets: ['kpi_owner'],
  delete_kpi: ['kpi_owner'],
  record_measurement: ['kpi_owner', 'finance_owner'],
  create_report: ['kpi_owner', 'finance_owner'],
  manage_deviation: ['kpi_owner', 'finance_owner'],
  manage_reconciliation_results: ['kpi_owner'],
  edit_finance_artifacts: ['finance_owner'],
  manage_reconciliation_finance: ['finance_owner'],
  create_signal: ['kpi_owner', 'finance_owner'],
  create_next_action: ['kpi_owner', 'finance_owner'],
  manage_reconciliation: ['kpi_owner', 'finance_owner'],
  view: ['kpi_owner', 'finance_owner', 'viewer', 'commenter'],
  comment: ['kpi_owner', 'finance_owner', 'commenter'],
};

/**
 * Check if a role can perform an action on a KPI.
 */
export function canPerformKpiAction(
  role: KpiPermissionRole,
  action: keyof typeof KPI_PERMISSION_MATRIX
): boolean {
  return KPI_PERMISSION_MATRIX[action]?.includes(role) ?? false;
}

// ────────────────────────────────────────────────────────────────
// §8.1E — Anti-duplicate gate
// ────────────────────────────────────────────────────────────────

export const KPI_ANTI_DUPLICATE_RULES = {
  no_bi_suite_drift: 'KPI is not a dashboard builder; dashboards consume governed metric truth',
  no_parallel_finance_truth: 'KPI cannot become a finance model editor or shadow ledger',
  no_charts_only: 'Charting without report/scorecard + next action is incomplete',
  one_vocabulary: 'signal/target/trend/report/reconciliation/next-action are canonical',
} as const;

// ────────────────────────────────────────────────────────────────
// §8.1G — Acceptance checklist (programmatic)
// ────────────────────────────────────────────────────────────────

export const P04_ACCEPTANCE_CHECKLIST = [
  {
    id: 1,
    requirement: 'Vocabulary frozen: signal/target/trend/report/reconciliation/next-action',
    section: '§8.1A',
  },
  { id: 2, requirement: 'KPI is closed-loop lane, not BI suite', section: '§8.1E' },
  { id: 3, requirement: 'KPI truth vs finance model truth boundary explicit', section: '§8.1B' },
  {
    id: 4,
    requirement: 'Linkage optional, supports interpretation/driver/review/realization',
    section: '§8.1B',
  },
  {
    id: 5,
    requirement: 'Reconciliation ownership: Results starts, Finance resolves',
    section: '§8.1B',
  },
  { id: 6, requirement: 'Permissions frozen and enforced on all write routes', section: '§8.1C' },
  { id: 7, requirement: 'Permission denied has explicit degraded posture', section: '§8.1F' },
  { id: 8, requirement: 'Missing data has explicit degraded posture', section: '§8.1F' },
  { id: 9, requirement: 'Discrepancy unresolved has explicit degraded posture', section: '§8.1F' },
  { id: 10, requirement: 'Linkage unavailable has explicit degraded posture', section: '§8.1F' },
  { id: 11, requirement: 'Anti-duplicate gates explicit', section: '§8.1E' },
  {
    id: 12,
    requirement: 'Canonical workflow: signal→inspect→report→reconcile→next-action',
    section: '§8.1D',
  },
  { id: 13, requirement: 'Operator cockpit: Overview/Queue/Catalog modes', section: 'P04-D' },
  {
    id: 14,
    requirement: 'Queue semantics: needs-entry/below-target/discrepancy/requires-review',
    section: 'P04-D',
  },
  {
    id: 15,
    requirement: 'Template-first reports with snapshot refresh and task materialization',
    section: 'P04-D',
  },
  { id: 16, requirement: 'Batch measurement via signal sheets', section: 'P04-D' },
  {
    id: 17,
    requirement: 'Distribution surfaces: Schedules/Wallboards/Connectors',
    section: 'P04-E',
  },
  {
    id: 18,
    requirement: 'Goals/Scorecards: create, link initiatives, rollup, progress',
    section: 'P04-E',
  },
  {
    id: 19,
    requirement: 'Full 7-tab KPI drawer with deviation lifecycle and metric audit',
    section: 'P04-F',
  },
  { id: 20, requirement: 'AI-assisted operations without silent truth mutation', section: 'P04-G' },
  { id: 21, requirement: 'KPI attribution and showcase/demo data layer', section: 'P04-H' },
] as const;
