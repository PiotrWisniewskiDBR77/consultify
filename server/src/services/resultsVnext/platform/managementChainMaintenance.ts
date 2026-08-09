/**
 * RN-G1 Platform Foundation — management-chain closure maintenance.
 *
 * Design: docs/product/results-vnext/RN_G1_PLATFORM_DESIGN.md §B.2.
 * Schema: server/migrations/20260809_rvn_platform_management_chain.sql
 * (`rvn_platform_management_chain_closure(organization_id, ancestor_user_id,
 * descendant_user_id, depth)`, PK on the first three columns).
 * Decision: EXECUTION_LEDGER.md §7 decyzja #1 — maintenance is SERVICE-LAYER,
 * not a DB trigger, and runs in the SAME transaction as the `manager_id`
 * change (consistency with the rest of this module family — see
 * `atomicWrite.ts`'s doc comment on why `decisionCollaborationService.ts`'s
 * CAS pattern is the reference implementation for transactional writes here).
 *
 * Status: NOT_IMPLEMENTED as a wired dependency — no controller/repository
 * calls this yet (see README.md in this directory). This file implements the
 * §B.2 algorithm literally so the shape is locked in for the first real
 * caller.
 *
 * ALGORITHM
 * =========
 *
 * `rvn_platform_management_chain_closure` is a materialized transitive
 * closure over the `manager_id` edge on `user_profile_extended`: a row
 * `(org, A, D, depth)` means "A is D's manager, or manager-of-manager, ...,
 * `depth` hops up" (`depth=0` is always the self row `(org, X, X, 0)`).
 * Reparenting one user (`userId`) to a new manager (`newManagerId`) requires
 * two things, in order, on the SAME pinned `client`:
 *
 * 1. CYCLE PROTECTION (mandatory, runs before any write). Walk
 *    `newManagerId`'s CURRENT `manager_id` chain upward (following
 *    `user_profile_extended.manager_id` pointers, which point from an
 *    employee to their manager, i.e. "up" toward the root). If that walk
 *    ever reaches `userId`, applying the reparent would close a cycle: after
 *    the write, `userId -> newManagerId -> ... -> userId`. Reject with
 *    `ManagementChainCycleError` BEFORE touching any row. The walk is also
 *    bounded by the organization's user count (`COUNT(*) FROM users WHERE
 *    organization_id = $1` — see DEVIATION note below on why `users`, not
 *    `user_profile_extended`, is the bound source) so that a walk over
 *    already-corrupted data (a pre-existing cycle unrelated to this specific
 *    change) cannot loop forever; a walk that does not reach the root
 *    (`manager_id IS NULL`) within that many hops is rejected the same way.
 *
 * 2. SUBTREE RECOMPOSITION (only the affected subtree, never the whole
 *    org — the "poddrzewo" requirement from the design). Only the ancestors
 *    ABOVE `userId` change; the internal shape of `userId`'s own subtree
 *    (who reports to whom below `userId`) is untouched by `userId` changing
 *    its own manager. Concretely:
 *      a. Read `userId`'s current subtree from the closure table:
 *         every `(userId, M, depthFromUser)` row, i.e. every existing
 *         descendant of `userId` plus `userId` itself (depth 0, defaulted
 *         even if no self row exists yet — e.g. a user who never had a
 *         closure row before their first manager assignment).
 *      b. Read the NEW ancestor chain of `userId`: `newManagerId` itself
 *         (depth 1) plus every existing ancestor of `newManagerId` (their
 *         closure depth-to-`newManagerId`, plus 1 for the new
 *         `userId -> newManagerId` edge). Empty if `newManagerId` is null
 *         (userId becomes a root).
 *      c. DELETE every closure row that ends at a subtree member (from a)
 *         whose ancestor is OUTSIDE the subtree — these are exactly the
 *         OLD external ancestor links (both the direct old
 *         `ancestor -> userId` rows the design text calls out, and their
 *         propagation to every descendant of `userId`, per the "not just one
 *         row" requirement). Rows where BOTH endpoints are inside the
 *         subtree (e.g. `userId`'s own self row, or a
 *         grandchild-of-`userId` row) are left untouched — they did not
 *         change.
 *      d. Re-insert `userId`'s own self row if it did not already exist
 *         (`ON CONFLICT DO NOTHING` — idempotent no-op otherwise).
 *      e. INSERT the cross product of (new ancestors from b) x (subtree
 *         members from a), with `depth = ancestorDepthToUser +
 *         memberDepthFromUser`. This is the propagation to descendants: a
 *         user who reports (transitively) to `userId` now also transitively
 *         reports to every one of `userId`'s new ancestors.
 *
 * Both DELETE and INSERT are always scoped by `organization_id` in addition
 * to the user-id predicates above — this table is tenant-partitioned by its
 * own primary key, and every query here keeps that column as a literal
 * predicate rather than relying on `user_profile_extended`/`users` joins to
 * imply it.
 *
 * DEVIATION FROM DESIGN: the design's step-bound suggestion
 * ("COUNT(*) FROM user_profile_extended WHERE organization_id=$1 albo
 * podobne") assumes `user_profile_extended` carries `organization_id`. It
 * does not — verified via `server/migrations/130_user_profile_extended.sql`
 * / `server/migrations-v2/001_baseline_20260413.sql` (columns: `user_id`
 * PK, `manager_id`, no `organization_id`; only `users.organization_id`
 * exists, and `manager_id` is a plain `REFERENCES users(id)`). The bound
 * here is computed from `users` instead — same intent ("org size"), correct
 * source. `user_profile_extended` also has no existing UPDATE-on-manager_id
 * caller anywhere in `server/src` to mirror (verified via
 * `grep -rln "manager_id" server/src`, only false-positive
 * `project_manager_id` hits) — the closest existing pattern
 * (`UserController.ts` ~line 620, dynamic column list + `UPDATE ... WHERE
 * user_id = ?` then INSERT-if-`changes===0` fallback) uses a different DB
 * abstraction (`queryHelpers.queryRun`, `?` placeholders, SQLite-flavored)
 * that is orthogonal to the pinned-`PoolClient`/`$n`-placeholder convention
 * this module family uses (`atomicWrite.ts`, `visibilityResolver.ts`). This
 * file does not touch that controller code path — it performs its own
 * `INSERT ... ON CONFLICT (user_id) DO UPDATE` upsert on the same pinned
 * client, matching this directory's convention instead. `updated_at` on
 * `user_profile_extended` is `TEXT DEFAULT CURRENT_TIMESTAMP` (an untyped
 * ISO-string column, not `TIMESTAMPTZ` — confirmed in
 * `migrations-v2/001_baseline_20260413.sql`), so it is written as
 * `new Date().toISOString()` here, mirroring `UserController.ts`'s existing
 * convention for that same column rather than a SQL-side `now()`.
 */
import type { PoolClient, QueryResult } from 'pg';

// ==========================================
// ERRORS
// ==========================================

/**
 * Typed rejection for the cycle-protection check in step 1 of the algorithm
 * above. Shape (message/code/details) mirrors `AtomicWriteConflictError`
 * (`atomicWrite.ts`) for consistency across this module family.
 */
export class ManagementChainCycleError extends Error {
  code: string;
  details?: Record<string, unknown>;
  constructor(message: string, code: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'ManagementChainCycleError';
    this.code = code;
    this.details = details;
  }
}

// ==========================================
// PUBLIC TYPES
// ==========================================

export interface UpdateManagerAndRecomposeClosureParams {
  userId: string;
  organizationId: string;
  /** New manager's user id, or `null` to make `userId` a root (no manager). */
  newManagerId: string | null;
}

export interface UpdateManagerAndRecomposeClosureResult {
  /** Total closure rows deleted + inserted by the recomposition (step 2). Does
   * NOT include the `user_profile_extended` row itself — closure rows only,
   * for logging/tests. */
  closureRowsChanged: number;
}

// ==========================================
// INTERNAL HELPERS
// ==========================================

interface ManagerRow {
  manager_id: string | null;
}

interface ClosureDepthRow {
  ancestor_user_id?: string;
  descendant_user_id?: string;
  depth: number;
}

/**
 * Step 1 of the algorithm above. Reads only — never writes. Throws
 * `ManagementChainCycleError` and writes nothing if either:
 *   - `newManagerId` (or a user in its current manager chain) is `userId`
 *     itself (`CYCLE_DETECTED`), or
 *   - the walk does not reach a root (`manager_id IS NULL`) within
 *     `orgSize` hops (`CHAIN_DOES_NOT_REACH_ROOT` — corrupted pre-existing
 *     data, defensive bound per design §B.2).
 */
async function assertNoManagementChainCycle(
  client: PoolClient,
  params: { userId: string; organizationId: string; newManagerId: string | null }
): Promise<void> {
  const { userId, organizationId, newManagerId } = params;

  if (newManagerId === null) {
    // Removing a manager (userId becomes a root) can never create a cycle.
    return;
  }

  const orgSizeResult = await client.query<{ count: number }>(
    `SELECT COUNT(*)::int AS count FROM users WHERE organization_id = $1`,
    [organizationId]
  );
  const orgSize = orgSizeResult.rows[0]?.count ?? 0;

  let current: string | null = newManagerId;
  let steps = 0;
  while (current !== null) {
    if (current === userId) {
      throw new ManagementChainCycleError(
        `Assigning manager ${newManagerId} to user ${userId} would create a management-chain cycle`,
        'CYCLE_DETECTED',
        { userId, newManagerId, organizationId }
      );
    }
    steps += 1;
    if (steps > orgSize) {
      throw new ManagementChainCycleError(
        `Manager chain from ${newManagerId} did not reach a root within ${orgSize} hops (organization size) — corrupted or cyclic data`,
        'CHAIN_DOES_NOT_REACH_ROOT',
        { userId, newManagerId, organizationId, orgSize }
      );
    }
    // Explicit `QueryResult<ManagerRow>` annotation (rather than relying on
    // inference from the generic call alone) works around a TS7022
    // false-positive ("row implicitly has type any because it is referenced
    // in its own initializer") that this specific
    // declare-then-reassign-in-a-while-loop shape otherwise triggers here.
    const row: QueryResult<ManagerRow> = await client.query<ManagerRow>(
      `SELECT manager_id FROM user_profile_extended WHERE user_id = $1`,
      [current]
    );
    current = row.rows[0]?.manager_id ?? null;
  }
}

/**
 * Step 2 of the algorithm above (subtree recomposition). Assumes the cycle
 * check already passed — in particular that `newManagerId` (if not null) is
 * neither `userId` nor a descendant of `userId`, which is what guarantees
 * the "new ancestors" computed here can never overlap `userId`'s own
 * subtree and therefore never collide with the rows step (c)/(d) below
 * leave untouched.
 */
async function recomposeManagementChainSubtree(
  client: PoolClient,
  params: { userId: string; organizationId: string; newManagerId: string | null }
): Promise<number> {
  const { userId, organizationId, newManagerId } = params;

  // (a) userId's current subtree: itself (depth 0, defaulted) + every
  // existing descendant.
  const subtreeResult = await client.query<ClosureDepthRow>(
    `SELECT descendant_user_id, depth
       FROM rvn_platform_management_chain_closure
      WHERE organization_id = $1 AND ancestor_user_id = $2`,
    [organizationId, userId]
  );
  const depthFromUser = new Map<string, number>([[userId, 0]]);
  for (const row of subtreeResult.rows) {
    if (row.descendant_user_id) {
      depthFromUser.set(row.descendant_user_id, row.depth);
    }
  }
  const subtreeUserIds = Array.from(depthFromUser.keys());
  const subtreeDepths = subtreeUserIds.map((id) => depthFromUser.get(id) as number);

  // (b) userId's NEW ancestor chain: newManagerId (depth 1) + newManagerId's
  // existing ancestors (their depth-to-newManagerId + 1). Empty if
  // newManagerId is null.
  const depthToUser = new Map<string, number>();
  if (newManagerId !== null) {
    const managerAncestorsResult = await client.query<ClosureDepthRow>(
      `SELECT ancestor_user_id, depth
         FROM rvn_platform_management_chain_closure
        WHERE organization_id = $1 AND descendant_user_id = $2`,
      [organizationId, newManagerId]
    );
    depthToUser.set(newManagerId, 0);
    for (const row of managerAncestorsResult.rows) {
      if (row.ancestor_user_id) {
        depthToUser.set(row.ancestor_user_id, row.depth);
      }
    }
  }
  const newAncestorIds = Array.from(depthToUser.keys());
  // +1 for the new userId -> newManagerId edge.
  const newAncestorDepths = newAncestorIds.map((id) => (depthToUser.get(id) as number) + 1);

  let rowsChanged = 0;

  // (c) Delete OLD external ancestor -> subtree-member rows. Rows where the
  // ancestor is itself inside the subtree (internal, unaffected) are kept.
  const deleteResult = await client.query(
    `DELETE FROM rvn_platform_management_chain_closure
      WHERE organization_id = $1
        AND descendant_user_id = ANY($2::text[])
        AND NOT (ancestor_user_id = ANY($2::text[]))`,
    [organizationId, subtreeUserIds]
  );
  rowsChanged += deleteResult.rowCount ?? 0;

  // (d) Ensure userId's own self row exists (no-op if it already did).
  const selfInsertResult = await client.query(
    `INSERT INTO rvn_platform_management_chain_closure
       (organization_id, ancestor_user_id, descendant_user_id, depth)
     VALUES ($1, $2, $2, 0)
     ON CONFLICT (organization_id, ancestor_user_id, descendant_user_id) DO NOTHING`,
    [organizationId, userId]
  );
  rowsChanged += selfInsertResult.rowCount ?? 0;

  // (e) Insert cross product of (new ancestors) x (subtree members) —
  // propagates the new ancestor chain to userId and every one of its
  // existing descendants in one pass.
  if (newAncestorIds.length > 0) {
    const crossInsertResult = await client.query(
      `INSERT INTO rvn_platform_management_chain_closure
         (organization_id, ancestor_user_id, descendant_user_id, depth)
       SELECT $1, a.ancestor_user_id, d.descendant_user_id, a.rel_depth + d.rel_depth
         FROM unnest($2::text[], $3::int[]) AS a(ancestor_user_id, rel_depth)
        CROSS JOIN unnest($4::text[], $5::int[]) AS d(descendant_user_id, rel_depth)
       ON CONFLICT (organization_id, ancestor_user_id, descendant_user_id) DO NOTHING`,
      [organizationId, newAncestorIds, newAncestorDepths, subtreeUserIds, subtreeDepths]
    );
    rowsChanged += crossInsertResult.rowCount ?? 0;
  }

  return rowsChanged;
}

// ==========================================
// PUBLIC API
// ==========================================

/**
 * Reparents `userId` to `newManagerId` and recomposes
 * `rvn_platform_management_chain_closure` for the affected subtree, all on
 * the caller-supplied, already-open-in-a-transaction `client`.
 *
 * This function does NOT open or close a transaction — the caller (e.g.
 * `executeAtomicCommand`'s `applyMutation`, or any other code already
 * holding a pinned `PoolClient` mid-`BEGIN`) owns `BEGIN`/`COMMIT`/
 * `ROLLBACK`. On `ManagementChainCycleError` nothing has been written (the
 * cycle check runs first and throws before any query other than reads);
 * the caller's own `ROLLBACK` (or `executeAtomicCommand`'s) is what actually
 * discards anything else done earlier in the same transaction.
 */
export async function updateManagerAndRecomposeClosure(
  client: PoolClient,
  params: UpdateManagerAndRecomposeClosureParams
): Promise<UpdateManagerAndRecomposeClosureResult> {
  const { userId, organizationId, newManagerId } = params;

  // Step 1 (mandatory, before any write).
  await assertNoManagementChainCycle(client, { userId, organizationId, newManagerId });

  // `manager_id` write. Upsert because `user_profile_extended` rows are
  // created lazily elsewhere in this repo (see DEVIATION note above) — a
  // user who never touched their extended profile may not have a row yet.
  await client.query(
    `INSERT INTO user_profile_extended (user_id, manager_id, updated_at)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id) DO UPDATE
       SET manager_id = EXCLUDED.manager_id, updated_at = EXCLUDED.updated_at`,
    [userId, newManagerId, new Date().toISOString()]
  );

  // Step 2 — subtree recomposition.
  const closureRowsChanged = await recomposeManagementChainSubtree(client, {
    userId,
    organizationId,
    newManagerId,
  });

  return { closureRowsChanged };
}
