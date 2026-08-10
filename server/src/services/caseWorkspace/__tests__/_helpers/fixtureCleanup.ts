/**
 * CW-T-F1 — per-suite cleanup + fixture-scoped query helpers.
 *
 * The 30 `*.pg.test.ts` files audited for CW-T-F1 already isolate WRITES
 * correctly (every test seeds its own org/project/case via
 * `${label}-${randomUUID()}`, never a shared `beforeEach` — see e.g.
 * `proposalApprovalService.pg.test.ts`'s own header comment, "ISOLATION").
 * What they do NOT have is a uniform way to (a) sweep up a suite's own rows
 * if a test throws before its own `finally` cleanup runs, and (b) scope a
 * diagnostic read to "rows my OWN fixtures produced" instead of "rows
 * anywhere in the table" — the latter matters because several existing
 * tests' `AND` clauses read `WHERE organization_id = $1` without further
 * scoping, which is safe (org ids are unique per test) but makes it easy for
 * a COPIED test to accidentally drop the org scope and start reading
 * cross-test state. These helpers make the safe pattern the path of least
 * resistance.
 */

import type { Pool, PoolClient } from 'pg';

import { TEST_NAMESPACE_MARKER } from './testNamespace.js';

type Queryable = Pool | PoolClient;

/**
 * Deletes every row this suite's OWN fixtures could have produced, scoped by
 * an explicit list of organization ids (never "everything with this
 * marker in the table" — that would risk touching another concurrently
 * running file's rows if two files happened to pick overlapping label
 * prefixes, which the random-uuid suffix makes astronomically unlikely but
 * not architecturally impossible). Call this from `afterAll`/`afterEach` as
 * a BACKSTOP in addition to (never instead of) each test's own `finally`
 * cleanup — the backstop only matters when a test's own cleanup itself
 * threw or was skipped by an early `return`.
 *
 * Delete order matches the FK graph documented across this directory's test
 * files (proposals/decisions cascade off proposals; waits/artifact-links/
 * history-events/plan-versions/capabilities/run-bindings/outbox rows do not
 * cascade off case_core and must be deleted before it; case_core has no
 * cascade off organizations/projects either). Pass only the tables your
 * suite actually wrote to — deleting from a table your suite never touched
 * is a harmless no-op (`WHERE organization_id = ANY($1)` matches zero rows),
 * so it's safe to always pass the full list.
 */
const CLEANUP_ORDER = [
  'case_workspace_event_outbox',
  'case_workspace_action_proposal_decisions',
  'case_workspace_action_proposals',
  'case_workspace_waits',
  'case_workspace_artifact_links',
  'case_workspace_history_events',
  'case_workspace_capabilities',
  'case_workspace_run_bindings',
  'case_plan_view_state',
  'case_plan_versions',
  'case_core',
  'v8_execution_runs',
  'organization_members',
  'users',
  'projects',
  'organizations',
] as const;

export interface CleanupScope {
  /** Organization ids this suite created — the primary scope for every table above. */
  organizationIds: string[];
}

/**
 * Sweeps every table in `CLEANUP_ORDER` for rows scoped to `scope.organizationIds`.
 * Tables keyed by `organization_id` are deleted directly; `case_workspace_event_outbox`
 * is also keyed by `organization_id` (NOT NULL column, see the migration). Tables with
 * no `organization_id` column of their own (none currently in this list lack one) would
 * need a join — none of the 30 audited files' fixtures require that, so this stays a
 * flat per-table DELETE for now; extend it here (not per-file) if a future table needs it.
 */
export async function cleanupSuiteFixtures(
  client: Queryable,
  scope: CleanupScope
): Promise<void> {
  if (scope.organizationIds.length === 0) return;
  for (const table of CLEANUP_ORDER) {
    // eslint-disable-next-line no-await-in-loop
    await client
      .query(`DELETE FROM ${table} WHERE organization_id = ANY($1::text[])`, [
        scope.organizationIds,
      ])
      .catch(() => undefined); // table may legitimately have no organization_id-scoped rows for this suite, or (for v8_execution_runs) may use a different id column — best-effort backstop only.
  }
}

/**
 * A read scoped to "rows belonging to organization ids THIS TEST created" —
 * the shape every diagnostic/assertion query in this directory should use
 * instead of an unscoped `SELECT * FROM case_workspace_event_outbox WHERE
 * aggregate_id = $1` when the goal is closer to "this suite's rows during
 * this run" (e.g. a leak-detection assertion, not a single aggregate's own
 * history — aggregate-scoped reads like `readOutboxRowsForAggregate` in
 * the existing test files are ALREADY correctly scoped and do not need
 * this).
 */
export async function readOutboxRowsForOrganizations<T = Record<string, unknown>>(
  client: Queryable,
  organizationIds: string[]
): Promise<T[]> {
  if (organizationIds.length === 0) return [];
  const result = await client.query<T>(
    `SELECT * FROM case_workspace_event_outbox
       WHERE organization_id = ANY($1::text[])
       ORDER BY organization_id, aggregate_id, created_at ASC`,
    [organizationIds]
  );
  return result.rows;
}

/** Re-exported so callers of this module don't need a second import for the marker. */
export { TEST_NAMESPACE_MARKER };
