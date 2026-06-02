/**
 * P05 Final V8 — Finance lane canon.
 *
 * §2.3.1 Bounded lanes: import → analysis → mutation → readback
 * §2.3.2 KPI↔Finance coherence boundary
 * §2.3.3 Versioning semantics (current vs actual)
 * §2.3.4 Error taxonomy + recovery posture
 * §2.3.5 Anti-duplicate gate
 * §2.3.6 Degraded posture (9 scenarios)
 * §2.3.7 Acceptance checklist (12 points)
 *
 * This module re-exports the lane service types and adds the P05 acceptance
 * checklist and anti-duplicate rules as programmatic constants.
 */

export {
  type FinanceDegradedReason,
  FinanceDegradedReasonValues,
  type FinanceLaneRun,
  type FinanceLaneStep,
  FinanceLaneStepValues,
  type FinanceMutationAudit,
  type FinanceVersionSnapshot,
  type ImportOutcome,
  ImportOutcomeValues,
  type MutationOutcome,
  MutationOutcomeValues,
  type VersionType,
  VersionTypeValues,
} from './financeLaneService.js';

export const P05_FINANCE_LANE_CONTRACT = 'finance_lane_v1';

// ────────────────────────────────────────────────────────────────
// §2.3.2 — KPI↔Finance coherence boundary
// ────────────────────────────────────────────────────────────────

export const FINANCE_OWNERSHIP_BOUNDARY = {
  results_owns: [
    'KPI metric truth (values, cadence, validation)',
    'Reconciliation workflow trigger',
    'KPI-facing context and linkage status',
  ],
  finance_owns: [
    'Finance interpretation and finance model truth',
    'CFO review semantics and finance-side resolution',
    'Finance-side audit posture for mutations and model state',
  ],
  shared: ['Reconciliation as governed cross-module process'],
  one_truth_rule:
    'Results values are not overwritten by finance estimates; Finance model state is not overwritten by KPI values',
} as const;

// ────────────────────────────────────────────────────────────────
// §2.3.3 — Versioning semantics
// ────────────────────────────────────────────────────────────────

export const VERSION_SEMANTICS = {
  actual:
    'Realized/committed truth for a closed window (post-review); changes require governed correction',
  current: 'Working view (forecast/planned/in-progress); default target for controlled mutation',
  switchover:
    'Explicit event/date boundary where window becomes actual; must be visible and reviewable',
} as const;

// ────────────────────────────────────────────────────────────────
// §2.3.4 — Error taxonomy
// ────────────────────────────────────────────────────────────────

export const IMPORT_ERROR_TAXONOMY = {
  completed: 'Import successful — all rows ingested',
  completed_with_warnings: 'Import successful with warnings — review impacted rows/fields',
  failed: 'Import failed — no partial mutation allowed; last good state preserved',
  queued: 'Import queued for processing',
  running: 'Import in progress',
  cancelled: 'Import cancelled by operator',
} as const;

export const MUTATION_ERROR_TAXONOMY = {
  applied: 'Mutation applied successfully',
  failed: 'Mutation failed — audit event created; safe degraded state preserved',
  conflict: 'Concurrent mutation conflict — retry on latest model state required',
  rolled_back: 'Mutation rolled back — previous state restored',
} as const;

// ────────────────────────────────────────────────────────────────
// §2.3.5 — Anti-duplicate gate
// ────────────────────────────────────────────────────────────────

export const FINANCE_ANTI_DUPLICATE_RULES = {
  no_parallel_finance_truth: 'No parallel finance truth tables outside this lane grammar',
  no_second_kpi_finance_mapping: 'No second KPI-finance mapping truth outside linkage SSOT',
  extension_requires_justification:
    'New finance object family must be justified as canon extension, not shadow system',
} as const;

// ────────────────────────────────────────────────────────────────
// §2.3.6 — Degraded posture (9 scenarios)
// ────────────────────────────────────────────────────────────────

export const FINANCE_DEGRADED_SCENARIOS: ReadonlyArray<{
  id: number;
  scenario: string;
  degradedReason: string;
  userVisibleState: string;
  nextAction: string;
}> = [
  {
    id: 1,
    scenario: 'Import mapping missing/invalid',
    degradedReason: 'import_mapping_missing',
    userVisibleState: 'Import blocked',
    nextAction: 'Show required mapping fields; suggest fix + retry',
  },
  {
    id: 2,
    scenario: 'Import completed with warnings',
    degradedReason: 'import_completed_with_warnings',
    userVisibleState: 'Warning posture — analysis allowed',
    nextAction: 'Highlight impacted rows/fields; suggest remediation',
  },
  {
    id: 3,
    scenario: 'Import failed',
    degradedReason: 'import_failed',
    userVisibleState: 'Last good snapshot preserved; mutation blocked',
    nextAction: 'Show failure code family + retry path',
  },
  {
    id: 4,
    scenario: 'Source dataset schema drift',
    degradedReason: 'schema_drift',
    userVisibleState: 'Mismatch detected',
    nextAction: 'Offer mapping update workflow; do not auto-adapt',
  },
  {
    id: 5,
    scenario: 'Stale model / stale linkage',
    degradedReason: 'stale_model',
    userVisibleState: 'Linkage stale',
    nextAction: 'Require refresh/reconcile before showing consequence confirmed',
  },
  {
    id: 6,
    scenario: 'Mutation conflict / concurrency',
    degradedReason: 'mutation_conflict',
    userVisibleState: 'Unsafe write prevented; audit event created',
    nextAction: 'Retry on latest model state',
  },
  {
    id: 7,
    scenario: 'Permission denied / locked review window',
    degradedReason: 'permission_denied',
    userVisibleState: 'Mutation disabled; read-only',
    nextAction: 'Show which role/state blocks action',
  },
  {
    id: 8,
    scenario: 'Switchover misconfigured',
    degradedReason: 'switchover_misconfigured',
    userVisibleState: 'Actual finalize blocked',
    nextAction: 'Require explicit correction; do not flip automatically',
  },
  {
    id: 9,
    scenario: 'Reconciliation mismatch',
    degradedReason: 'reconciliation_mismatch',
    userVisibleState: 'Mismatch category shown',
    nextAction: 'Allow notes + acknowledge path; do not auto-force equality',
  },
] as const;

// ────────────────────────────────────────────────────────────────
// §2.3.7 — Acceptance checklist (12 points)
// ────────────────────────────────────────────────────────────────

export const P05_ACCEPTANCE_CHECKLIST = [
  {
    id: 1,
    requirement: 'Import→analysis(L1/L2/L3)→mutation→readback lane order explicit',
    section: '§2.3.1',
  },
  {
    id: 2,
    requirement:
      'Finance non-goals explicit: no ERP/accounting suite, no pretty reports without audit',
    section: '§2.2',
  },
  {
    id: 3,
    requirement:
      'KPI↔Finance ownership boundary explicit (Results owns KPI truth + reconciliation trigger; Finance owns model truth)',
    section: '§2.3.2',
  },
  {
    id: 4,
    requirement: 'System forbids silent overwrite of Results KPI values by Finance and vice-versa',
    section: '§2.3.2',
  },
  {
    id: 5,
    requirement: 'Version semantics: current vs actual with explicit switchover boundary',
    section: '§2.3.3',
  },
  {
    id: 6,
    requirement: 'Reconciliation required to explain divergence; cannot be hidden',
    section: '§2.3.3',
  },
  {
    id: 7,
    requirement:
      'Import completion taxonomy: completed/completed_with_warnings/failed + user-visible codes',
    section: '§2.3.4',
  },
  {
    id: 8,
    requirement: 'Import failure blocks downstream mutation; preserves last known good state',
    section: '§2.3.4',
  },
  {
    id: 9,
    requirement: 'Mutation failure requires audit logging and safe degraded state',
    section: '§2.3.4',
  },
  {
    id: 10,
    requirement: 'Anti-duplicate gate forbids parallel finance truth tables',
    section: '§2.3.5',
  },
  {
    id: 11,
    requirement:
      'Degraded posture lists at least 7 scenarios with user-visible state + next action',
    section: '§2.3.6',
  },
  {
    id: 12,
    requirement: 'Dependencies for P05-B clear: P04-A approved, linkage SSOT authority',
    section: '§2.3.7',
  },
] as const;
