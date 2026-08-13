/**
 * RN-G1 Platform Foundation — visibility-scoped query CTE wrapper.
 *
 * Design: docs/product/results-vnext/RN_G1_PLATFORM_DESIGN.md §B.4.
 * Sibling of `visibilityResolver.ts` (§B.3): that file answers "can this one
 * user see this one resource" (single resolve-per-resource, used on detail
 * routes). This file answers the SAME question for list/count/search/export
 * surfaces — one SQL query returning every `resource_id` a user can see for
 * a given `resource_type`, instead of N resolve calls. Both implement the
 * identical branching (RBAC override / OPEN_ORG / PRIVATE / SCOPE /
 * MANAGEMENT_CHAIN / RESTRICTED_ACL) from §B.3 — read that file's comments
 * for the per-branch rationale; this file does not repeat them, only points
 * back where a branch deviates from the design in the same way.
 *
 * Status: NOT_IMPLEMENTED as a wired dependency — no domain repository
 * (KPI/ROI/OKR) exists yet to call this. This is intentionally inert
 * scaffolding, same status as the rest of `platform/*` per README.md.
 *
 * Threat model: this is the T3 mitigation from EXECUTION_LEDGER.md §4.3
 * ("Visibility leakage przez agregację" — counters/search/export/AI must
 * filter BEFORE aggregation, not after). The contract this wrapper exists to
 * enforce: a domain repository NEVER queries its base table directly for a
 * list/count/search/export — it always starts from the CTE this file builds
 * and INNER JOINs its base table against it. That makes "forgot the
 * visibility filter" structurally harder, the same way `check-list-canon.sh`
 * makes "built a bespoke table instead of StandardTable" structurally harder
 * on the UI side.
 *
 * ---------------------------------------------------------------------------
 * EXAMPLE USAGE (illustrative only — `kpiRepository` does not exist yet; the
 * KPI domain workstream is a separate, not-yet-started piece of work per
 * EXECUTION_LEDGER.md §12). This shows the intended calling convention for
 * whichever domain repository lands first.
 * ---------------------------------------------------------------------------
 *
 * ```ts
 * // server/src/services/resultsVnext/kpi/kpiRepository.ts (hypothetical)
 * import {
 *   buildVisibilityScopedCte,
 *   VISIBILITY_CTE_PARAM_COUNT,
 * } from '../platform/visibilityScopedQuery.js';
 *
 * export async function listScorecards(params: {
 *   userId: string;
 *   organizationId: string;
 *   status?: string;
 * }): Promise<ScorecardRow[]> {
 *   const cte = await buildVisibilityScopedCte({
 *     userId: params.userId,
 *     organizationId: params.organizationId,
 *     resourceType: 'kpi',
 *   });
 *
 *   // Domain filters (status, dates, text) are bound AFTER the CTE's own
 *   // params — `VISIBILITY_CTE_PARAM_COUNT` (3: organizationId, resourceType,
 *   // userId) tells the caller where its own placeholders must start, since
 *   // Postgres placeholder numbering is global across the whole query text
 *   // once the CTE is prepended.
 *   const values = [...cte.values];
 *   const filters: string[] = [];
 *   if (params.status) {
 *     values.push(params.status);
 *     filters.push(`ks.status = $${values.length}`);
 *   }
 *
 *   const baseQuerySql = `
 *     SELECT ks.*
 *       FROM rvn_kpi_scorecards ks
 *       -- The mandatory join: every domain repository's list/count/search
 *       -- query INNER JOINs its own table against the CTE on whatever
 *       -- column is its primary key — here ks.id, elsewhere it may be a
 *       -- different name, which is why this wrapper does not hardcode it.
 *       INNER JOIN rvn_visible_resources vr
 *               ON vr.resource_type = 'kpi' AND vr.resource_id = ks.id
 *      ${filters.length ? `WHERE ${filters.join(' AND ')}` : ''}
 *      ORDER BY ks.updated_at DESC
 *   `;
 *
 *   const result = await pool.query(`${cte.sql}\n${baseQuerySql}`, values);
 *   return result.rows;
 * }
 * ```
 *
 * The same pattern applies to COUNT(*), full-text search, CSV export and
 * Teresa's read path (§B.4: "Teresa nigdy nie robi raw query, zawsze przez te
 * same funkcje repozytorium co UI") — they all start from the same
 * `buildVisibilityScopedCte()` call, never a hand-rolled `WHERE
 * organization_id = ?`.
 */
import { hasEffectiveCapability, resolveEffectiveAccess } from '../../effectiveAccessService.js';

import { RVN_RESOURCE_TYPES, type RvnResourceType } from './resourceTypes.js';

export interface BuildVisibilityScopedCteParams {
  userId: string;
  organizationId: string;
  resourceType: RvnResourceType;
}

export interface VisibilityScopedSql {
  sql: string;
  values: unknown[];
}

/**
 * Number of positional parameters (`$1`..`$N`) `buildVisibilityScopedCte`
 * always binds, in this fixed order: organizationId, resourceType, userId
 * (reused across branches). A caller composing its own query text on top of
 * the returned CTE must number its own placeholders starting at
 * `VISIBILITY_CTE_PARAM_COUNT + 1` and append its own bind values after
 * `cte.values` in the same order — see the module-level example above.
 */
export const VISIBILITY_CTE_PARAM_COUNT = 3;

// DEVIATION FROM DESIGN: §B.4's signature is `rvnVisibilityScopedQuery(baseQuery,
// {userId, organizationId, resourceType, action})` — this module splits that
// into two smaller functions (`buildVisibilityScopedCte` /
// `wrapWithVisibilityScope`) per this package's task spec, and neither takes
// an `action`. List/count/search/export are inherently read operations with
// no single mutating action the way a detail-route resolve has one — so the
// RBAC/PBAC override check below is evaluated against the fixed capability
// `${resourceType}.view`, matching `visibilityResolver.ts`'s per-action check
// with `action` defaulted to `'view'`. A future caller that needs a
// non-view bulk operation (e.g. bulk-approve) should extend `resolveVisibility`
// per-row after narrowing with this CTE, not widen this CTE's RBAC branch —
// visibility and capability must stay separate per §B.3 step 4.
const DEFAULT_ACTION = 'view';

/**
 * Builds the `WITH rvn_visible_resources(resource_type, resource_id) AS (...)`
 * clause for a given user/org/resourceType, implementing the same branching
 * as `resolveVisibility()` in `visibilityResolver.ts` (§B.3), but as ONE
 * query returning every visible `resource_id` instead of one allow/deny per
 * call.
 *
 * Returns the full `WITH ...` clause text (ready to prepend to a caller's
 * own query — see `wrapWithVisibilityScope`). A caller that already has its
 * own multi-CTE `WITH` clause and wants to merge this in can strip the
 * leading `"WITH "` (5 characters) from `sql` and splice the remainder in as
 * one more comma-separated CTE definition — the design doc calls this out
 * as an acceptable alternative ("albo samą treść CTE do wstrzyknięcia przez
 * caller w jego własny WITH").
 *
 * Async because the RBAC/PBAC override check requires a DB round-trip via
 * `resolveEffectiveAccess` (same reason `resolveVisibility()` in
 * `visibilityResolver.ts` is async) — the override is resolved once in TS
 * before the SQL is built, then baked in as a conditionally-included branch
 * rather than a SQL-side boolean, since it is derived server-side and never
 * from request input.
 */
export async function buildVisibilityScopedCte(
  params: BuildVisibilityScopedCteParams
): Promise<VisibilityScopedSql> {
  const { userId, organizationId, resourceType } = params;

  if (!(RVN_RESOURCE_TYPES as readonly string[]).includes(resourceType)) {
    // Defense in depth: resourceType should already be typed as
    // RvnResourceType at every call site, but this function assembles SQL
    // text and must never trust an unvalidated value reaching here (e.g. a
    // caller that lost type information crossing a JSON boundary).
    throw new Error(
      `buildVisibilityScopedCte: resourceType "${String(resourceType)}" is not in RVN_RESOURCE_TYPES`
    );
  }

  // Step 2 of §B.3, evaluated once up front: RBAC/PBAC short-circuit, reused
  // from effectiveAccessService (not reinvented here), identical to
  // visibilityResolver.ts.
  const access = await resolveEffectiveAccess({ userId, organizationId });
  const requiredCapability = `${resourceType}.${DEFAULT_ACTION}`;
  const hasRbacOverride =
    hasEffectiveCapability(access, '*') || hasEffectiveCapability(access, requiredCapability);

  const values: unknown[] = [organizationId, resourceType, userId];

  const branches: string[] = [
    // OPEN_ORG — every resource of this type in the organization.
    `SELECT rv.resource_type, rv.resource_id
       FROM rvn_platform_resource_visibility rv
      WHERE rv.organization_id = $1
        AND rv.resource_type = $2
        AND rv.visibility_mode = 'OPEN_ORG'`,

    // PRIVATE — owner only.
    `SELECT rv.resource_type, rv.resource_id
       FROM rvn_platform_resource_visibility rv
      WHERE rv.organization_id = $1
        AND rv.resource_type = $2
        AND rv.visibility_mode = 'PRIVATE'
        AND rv.owner_user_id = $3`,

    // SCOPE (team only).
    // -- DEVIATION FROM DESIGN: see visibilityResolver.ts's
    // resolveScopeVisibility() for the full rationale — §B.3 names
    // "team_members/initiative_contributors" as the membership source for
    // SCOPE mode; `initiative_contributors` does not exist anywhere in
    // server/migrations/ or server/migrations-v2/. Only `scope_type='team'`
    // is wired against `team_members` here. Any other scope_type simply
    // contributes zero rows to this UNION branch — fail-closed, consistent
    // with the resolver's OUT_OF_SCOPE deny for the same case.
    `SELECT rv.resource_type, rv.resource_id
       FROM rvn_platform_resource_visibility rv
       JOIN team_members tm
         ON tm.team_id = rv.scope_id
        AND tm.user_id = $3
      WHERE rv.organization_id = $1
        AND rv.resource_type = $2
        AND rv.visibility_mode = 'SCOPE'
        AND rv.scope_type = 'team'`,

    // MANAGEMENT_CHAIN — owner branch.
    `SELECT rv.resource_type, rv.resource_id
       FROM rvn_platform_resource_visibility rv
      WHERE rv.organization_id = $1
        AND rv.resource_type = $2
        AND rv.visibility_mode = 'MANAGEMENT_CHAIN'
        AND rv.owner_user_id = $3`,

    // MANAGEMENT_CHAIN — ancestor-of-owner branch, via the materialized
    // closure table maintained by managementChainMaintenance.ts.
    `SELECT rv.resource_type, rv.resource_id
       FROM rvn_platform_resource_visibility rv
       JOIN rvn_platform_management_chain_closure mc
         ON mc.organization_id = rv.organization_id
        AND mc.ancestor_user_id = $3
        AND mc.descendant_user_id = rv.owner_user_id
      WHERE rv.organization_id = $1
        AND rv.resource_type = $2
        AND rv.visibility_mode = 'MANAGEMENT_CHAIN'`,

    // RESTRICTED_ACL — user grantee only.
    // team/role grantee matching is NOT_IMPLEMENTED here, identical scope to
    // visibilityResolver.ts's RESTRICTED_ACL case (would need the caller's
    // team/role memberships resolved the same way effectiveAccessService
    // resolves them) — see that file for the rationale. Any access_level
    // (view/contribute/approve) qualifies here because DEFAULT_ACTION is
    // 'view', the lowest rank; a future per-action variant of this wrapper
    // would need to rank-filter the same way resolveVisibility() does.
    `SELECT rv.resource_type, rv.resource_id
       FROM rvn_platform_resource_visibility rv
       JOIN rvn_platform_resource_acl acl
         ON acl.resource_type = rv.resource_type
        AND acl.resource_id = rv.resource_id
        AND acl.grantee_type = 'user'
        AND acl.grantee_id = $3
      WHERE rv.organization_id = $1
        AND rv.resource_type = $2
        AND rv.visibility_mode = 'RESTRICTED_ACL'`,
  ];

  if (hasRbacOverride) {
    // RBAC/PBAC override — sees every resource of this type in the org
    // regardless of visibility_mode, EXCEPT restricted-sensitivity
    // RESTRICTED_ACL resources without a break-glass audit event (§B.3 step
    // 2), matching visibilityResolver.ts's RESTRICTED_REQUIRES_BREAK_GLASS
    // deny exactly (break-glass emission is not built yet, so this branch
    // fails closed on that combination the same way the resolver does).
    //
    // This branch is deliberately UNIONed alongside the ordinary branches
    // above (not used as a replacement for them) — the design's own example
    // is "RBAC override + też właściciel" producing the same resource_id
    // via two different branches, deduplicated by UNION rather than by an
    // early return.
    branches.push(
      `SELECT rv.resource_type, rv.resource_id
         FROM rvn_platform_resource_visibility rv
        WHERE rv.organization_id = $1
          AND rv.resource_type = $2
          AND NOT (rv.sensitivity = 'restricted' AND rv.visibility_mode = 'RESTRICTED_ACL')`
    );
  }

  const cteBody = branches.join('\n      UNION\n');

  const sql = `WITH rvn_visible_resources(resource_type, resource_id) AS (\n      ${cteBody}\n    )`;

  return { sql, values };
}

/**
 * Prepends the `WITH rvn_visible_resources AS (...)` clause built by
 * `buildVisibilityScopedCte` to a caller-supplied query.
 *
 * Contract: `baseQuerySql` MUST contain an `INNER JOIN rvn_visible_resources
 * ON rvn_visible_resources.resource_id = <caller's PK column>` (and, for
 * safety when a table stores rows for more than one resource_type, also
 * `AND rvn_visible_resources.resource_type = '<literal>'`) — this wrapper
 * only supplies the CTE, it never inspects or rewrites `baseQuerySql`, and it
 * has no way to know the caller's primary-key column name (it differs per
 * domain table). See the module-level example above for the exact shape.
 *
 * `baseQuerySql`'s own positional placeholders must start at
 * `VISIBILITY_CTE_PARAM_COUNT + 1` (`$4` today) since Postgres placeholder
 * numbering is global across the whole query text once the CTE is
 * prepended; the caller is responsible for appending its own bind values
 * after the returned `values` array before executing.
 */
export async function wrapWithVisibilityScope(
  baseQuerySql: string,
  cteParams: BuildVisibilityScopedCteParams
): Promise<VisibilityScopedSql> {
  const cte = await buildVisibilityScopedCte(cteParams);
  return {
    sql: `${cte.sql}\n${baseQuerySql}`,
    values: cte.values,
  };
}
