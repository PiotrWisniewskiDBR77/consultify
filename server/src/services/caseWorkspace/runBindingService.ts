/**
 * Case Workspace — Run Binding service (CW-P04, EPIC E4 "V8 Run, NodeRun and
 * recovery").
 *
 * Backs the `case_workspace_run_bindings` table added in
 * server/migrations/20260809_case_workspace_run_binding.sql. Per the
 * packet's collision-avoidance mandate (docs/product/case-workspace/
 * acceptance/CODEBASE_CONVERGENCE_MAP.csv, area=v8-runtime), this service
 * only ever SELECTs `v8_execution_runs`, `case_plan_versions` and
 * `case_core` — it never INSERT/UPDATE/DELETEs any of them, including
 * `v8_execution_runs.state`/`.plan_version` (the latter is a NAMING TRAP
 * from the old/legacy AgentPlan-style system, unrelated to CW-P02's
 * `case_plan_versions` table, and is never read or written here either). It
 * builds no NodeRun logic, retry/compensation, or execution engine (that
 * already exists in `v8_agent_work_graphs`/`v8_agent_branch_tasks`, out of
 * scope) and never references Finance or Results.
 *
 * req_id coverage (docs/product/case-workspace/acceptance/
 * FUNCTIONAL_REQUIREMENT_COVERAGE.csv, epics column contains "E4"):
 *
 *   bindRunToPlanVersion       -> CW-00-020-INV6, CW-01-011, CW-01-012, CW-RT-013,
 *                                  CW-RT-017, CW-RT-018
 *   getRunBinding              -> CW-00-020-INV6, CW-RT-018
 *   listRunBindingsForCase     -> CW-RT-013, CW-02-011, CW-02-024
 *   listRunBindingsForPlanVersion -> CW-00-020-INV6, CW-RT-017
 *
 * Cross-cutting invariants held by this service (see the migration file's
 * header for the exact canon citations):
 *   - CW-00-020-INV6 (every Run is bound to an exact plan version and
 *     semantic digest): `run_id` is this table's PRIMARY KEY, and
 *     graph_digest is copied in at bind time, never re-derived;
 *   - one run_id binds to at most one case_plan_version_id, ever — enforced
 *     structurally by run_id being the table's PK (via `INSERT ... ON
 *     CONFLICT (run_id) DO NOTHING RETURNING *`, same convention as
 *     capabilityRegistryService.ts's recordIdempotencyKeyCheck), not by a
 *     service-level check alone;
 *   - the binding is immutable once created — this file defines no UPDATE or
 *     DELETE method against case_workspace_run_bindings anywhere;
 *   - CW-01-011 (Plan Version is an immutable approved definition): only a
 *     case_plan_versions row whose status is 'PUBLISHED' may be bound;
 *   - CW-RT-013 (One Run belongs to exactly one Case): case_id is
 *     denormalized from the resolved plan version's own case_id and
 *     verified consistent by this service before INSERT;
 *   - this service only ever SELECTs v8_execution_runs and
 *     case_plan_versions/case_core, matching the packet mandate's explicit
 *     "no ALTER TABLE, ever" and CW-P01/P02/P03's own read-only posture
 *     toward tables outside their own migration.
 *
 * OPEN QUESTIONS (flagged in the approved design, carried forward here — not
 * resolved by this packet, product/API-owner confirmation needed):
 *   1. Call-site timing is unresolved: should bindRunToPlanVersion be
 *      invoked by whatever future E4 packet drives v8_execution_runs.state
 *      transitions (e.g. on entry to 'approved_for_apply' or 'applying'), or
 *      exposed as its own explicit command? This packet only builds the
 *      capability; the orchestration trigger point is out of scope and
 *      unconfirmed.
 *   2. Requiring case_plan_versions.status == 'PUBLISHED' at bind time is a
 *      design choice inferred from CW-01-011's "immutable approved
 *      definition" wording, not stated as an explicit rule anywhere in the
 *      E4 requirement rows. Confirm whether a dry-run/preview execution mode
 *      might legitimately need to bind against an IN_REVIEW version.
 *   3. The organization_id cross-check between v8_execution_runs and the
 *      resolved Case is a defensive addition beyond the literal packet
 *      scope — no requirement row demands it. Confirm whether Runs and
 *      Cases are already guaranteed same-org by an upstream invariant, which
 *      would make this check unreachable dead code rather than a real
 *      guard.
 *   4. No updated_at/version column exists by design, since this row is
 *      genuinely never mutated. Confirm this holds even once a future
 *      recovery/compensation packet (explicitly out of scope here) needs to
 *      record something like "this Run was re-run/superseded" — the
 *      expectation under this design is that would always be a NEW run_id
 *      with its own NEW binding row, never a mutation of this one.
 *   5. CW-RT-018's aspirational Run schema also lists correlationId on the
 *      Run aggregate itself. That field belongs on v8_execution_runs (out of
 *      scope — no ALTER permitted), not on this binding table; flagging in
 *      case a later packet expects correlationId duplicated here too for
 *      audit-trail completeness.
 */

import {
  queryAll,
  queryOne,
  withPgTransaction,
} from '../../utils/queryHelpers.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface RunBindingActor {
  actorUserId: string;
}

interface CaseWorkspaceRunBindingRow {
  run_id: string;
  case_plan_version_id: string;
  case_id: string;
  organization_id: string;
  graph_digest: string;
  bound_by_actor_id: string;
  created_at: string;
}

export interface CaseRunBinding {
  runId: string;
  casePlanVersionId: string;
  caseId: string;
  organizationId: string;
  graphDigest: string;
  boundByActorId: string;
  createdAt: string;
}

interface V8ExecutionRunRefRow {
  run_id: string;
  organization_id: string;
}

interface CasePlanVersionRefRow {
  case_plan_version_id: string;
  case_id: string;
  status: string;
  graph_digest: string;
}

interface CaseCoreRefRow {
  case_id: string;
  organization_id: string;
}

// ---------------------------------------------------------------------------
// Local helpers (mirrors caseCoreService.ts/casePlanVersionService.ts/
// capabilityRegistryService.ts's own local helpers — not imported from
// there, each service file in this directory keeps its own copy per that
// file's existing convention).
// ---------------------------------------------------------------------------

function requireNonBlank(value: string | null | undefined, reason: string): string {
  const normalized = String(value ?? '').trim();
  if (!normalized) throw new Error(reason);
  return normalized;
}

function mapRow(row: CaseWorkspaceRunBindingRow): CaseRunBinding {
  return {
    runId: row.run_id,
    casePlanVersionId: row.case_plan_version_id,
    caseId: row.case_id,
    organizationId: row.organization_id,
    graphDigest: row.graph_digest,
    boundByActorId: row.bound_by_actor_id,
    createdAt: row.created_at,
  };
}

// ---------------------------------------------------------------------------
// Service methods
// ---------------------------------------------------------------------------

/**
 * CW-00-020-INV6, CW-01-011, CW-01-012, CW-RT-013, CW-RT-017, CW-RT-018.
 *
 * In a single transaction:
 *   1. SELECT (read-only) v8_execution_runs WHERE run_id = ? — throws
 *      run_not_found if absent; never INSERT/UPDATE/DELETEs this table.
 *   2. SELECT (read-only) case_plan_versions WHERE case_plan_version_id = ?
 *      — throws plan_version_not_found if absent, throws
 *      plan_version_not_publishable_for_run if status != 'PUBLISHED'
 *      (CW-01-011: only an immutable approved definition may be bound).
 *   3. SELECT (read-only) case_core WHERE case_id = <resolved plan
 *      version's case_id> to fetch organization_id; throws
 *      run_case_organization_mismatch if it differs from the
 *      v8_execution_runs row's own organization_id.
 *   4. INSERT INTO case_workspace_run_bindings — graph_digest taken from
 *      the case_plan_versions row just loaded in step 2, not re-derived.
 *      Issues `INSERT ... ON CONFLICT (run_id) DO NOTHING RETURNING *` (same
 *      convention as capabilityRegistryService.ts's
 *      recordIdempotencyKeyCheck); no returned row means run_id was already
 *      bound, surfaced as the domain error run_already_bound — an explicit
 *      signal distinct from a generic DB error, never a silent overwrite.
 *
 * No UPDATE path exists anywhere in this service — the row this method
 * creates is never touched again.
 */
export async function bindRunToPlanVersion(input: {
  runId: string;
  casePlanVersionId: string;
  boundByActorId: string;
}): Promise<CaseRunBinding> {
  const runId = requireNonBlank(input.runId, 'run_binding_run_id_required');
  const casePlanVersionId = requireNonBlank(
    input.casePlanVersionId,
    'run_binding_case_plan_version_id_required'
  );
  const boundByActorId = requireNonBlank(
    input.boundByActorId,
    'run_binding_bound_by_actor_required'
  );

  return withPgTransaction(async (client) => {
    const runResult = await client.query<V8ExecutionRunRefRow>(
      `SELECT run_id, organization_id FROM v8_execution_runs WHERE run_id = ?`,
      [runId]
    );
    const run = runResult.rows[0];
    if (!run) throw new Error('run_not_found');

    const planVersionResult = await client.query<CasePlanVersionRefRow>(
      `SELECT case_plan_version_id, case_id, status, graph_digest
         FROM case_plan_versions WHERE case_plan_version_id = ?`,
      [casePlanVersionId]
    );
    const planVersion = planVersionResult.rows[0];
    if (!planVersion) throw new Error('plan_version_not_found');
    if (planVersion.status !== 'PUBLISHED') {
      throw new Error('plan_version_not_publishable_for_run');
    }

    const caseResult = await client.query<CaseCoreRefRow>(
      `SELECT case_id, organization_id FROM case_core WHERE case_id = ?`,
      [planVersion.case_id]
    );
    const caseRow = caseResult.rows[0];
    if (!caseRow) throw new Error('run_binding_case_not_found');
    if (caseRow.organization_id !== run.organization_id) {
      throw new Error('run_case_organization_mismatch');
    }

    const now = new Date().toISOString();
    const inserted = await client.query<CaseWorkspaceRunBindingRow>(
      `INSERT INTO case_workspace_run_bindings (
         run_id, case_plan_version_id, case_id, organization_id, graph_digest,
         bound_by_actor_id, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (run_id) DO NOTHING
       RETURNING *`,
      [
        run.run_id,
        planVersion.case_plan_version_id,
        caseRow.case_id,
        caseRow.organization_id,
        planVersion.graph_digest,
        boundByActorId,
        now,
      ]
    );
    if (!inserted.rows[0]) throw new Error('run_already_bound');
    return mapRow(inserted.rows[0]);
  });
}

/**
 * CW-00-020-INV6, CW-RT-018.
 *
 * Plain read, no lock. Returns null if the Run has never been bound (e.g.
 * still in 'drafting'/'planning' state in v8_execution_runs).
 */
export async function getRunBinding(runId: string): Promise<CaseRunBinding | null> {
  const id = requireNonBlank(runId, 'run_binding_run_id_required');
  const row = await queryOne<CaseWorkspaceRunBindingRow>(
    `SELECT * FROM case_workspace_run_bindings WHERE run_id = ?`,
    [id]
  );
  return row ? mapRow(row) : null;
}

/**
 * CW-RT-013, CW-02-011, CW-02-024.
 *
 * Plain read, no lock. Newest binding first. Feeds the Realizacja tab's need
 * to enumerate a Case's Runs; does not join into v8_execution_runs for
 * status/state — callers combine this list with v8_execution_runs reads
 * themselves, keeping this service's read surface limited to what it owns.
 */
export async function listRunBindingsForCase(caseId: string): Promise<CaseRunBinding[]> {
  const id = requireNonBlank(caseId, 'run_binding_case_id_required');
  const rows = await queryAll<CaseWorkspaceRunBindingRow>(
    `SELECT * FROM case_workspace_run_bindings WHERE case_id = ? ORDER BY created_at DESC`,
    [id]
  );
  return rows.map(mapRow);
}

/**
 * CW-00-020-INV6, CW-RT-017.
 *
 * Plain read, no lock. Newest binding first. Answers "which Runs actually
 * executed against exactly this published version" — the reverse direction
 * of the same invariant, useful for plan-version audit/diff tooling without
 * requiring a new column on case_plan_versions itself.
 */
export async function listRunBindingsForPlanVersion(
  casePlanVersionId: string
): Promise<CaseRunBinding[]> {
  const id = requireNonBlank(casePlanVersionId, 'run_binding_case_plan_version_id_required');
  const rows = await queryAll<CaseWorkspaceRunBindingRow>(
    `SELECT * FROM case_workspace_run_bindings WHERE case_plan_version_id = ? ORDER BY created_at DESC`,
    [id]
  );
  return rows.map(mapRow);
}
