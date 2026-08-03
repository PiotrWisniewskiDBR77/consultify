/**
 * kpiVisibilityService — RES-11 (Phase 1) canonical KPI visibility policy.
 *
 * ONE policy, used by every aggregation point that reads `initiative_kpis`
 * (directly or via `v8_kpi_definitions.canonical_kpi_id`) so behavior can
 * never drift between call sites: `resultsStrategic.routes.ts` (BSC/BDN
 * composer), `resultsROIService.getKPIScorecard`, `planningPortfolioReadService
 * .getInitiativeGateReadinessRead` (gate-readiness KPI counts), Results
 * Scorecards (`kpiScorecardService.ts`, RES-10), and `kpiAttributionService
 * .computeAttribution`. Do not duplicate this logic inline anywhere — import
 * from here.
 *
 * SCOPES (see server/migrations/20260803_res011_kpi_visibility.sql):
 * The OWNER of a KPI (`initiative_kpis.owner_user_id`) always sees it,
 * independent of scope — a scope restricts OTHER viewers, it never locks
 * the owner out of their own object.
 *
 *   org_visible            — any authenticated member of the KPI's own org.
 *                            Default; MUST reproduce today's de facto
 *                            behavior for every existing query.
 *   initiative_restricted  — the owner, plus members of the KPI's own
 *                            initiative per the REAL existing team model —
 *                            `initiative_resources` (see
 *                            `getInitiativeResourcesRead` in
 *                            planningPortfolioReadService.ts). No second
 *                            membership concept invented for RES-11.
 *   private_to_owner       — the owner only.
 *
 * FAIL-CLOSED: a missing/unknown userId, or a visibility value outside the
 * three known scopes, is never treated as "visible" — the SQL fragment
 * below only grants access through one of the explicit branches, and
 * `isKpiVisible` mirrors that exactly. Tenant (organization_id) scoping is
 * NOT this module's job — every call site already scopes by org before this
 * filter is ever applied; visibility narrows further, it never widens past
 * the org boundary.
 *
 * ADMIN OVERRIDE: the packet's policy matrix (§10) leaves "does admin see
 * private_to_owner" as an OPEN decision for Piotr — this module supports an
 * `isAdmin` override (bypasses every scope, including private_to_owner) so
 * that decision can be wired in later without touching call sites again,
 * but every current call site in this codebase passes `isAdmin: false`
 * deliberately — fail-closed until the decision is made, per instruction.
 */

export type KpiVisibilityScope = 'org_visible' | 'initiative_restricted' | 'private_to_owner';

export const KPI_VISIBILITY_SCOPES: readonly KpiVisibilityScope[] = [
  'org_visible',
  'initiative_restricted',
  'private_to_owner',
];

export interface KpiVisibilityContext {
  userId: string | null | undefined;
  /** True for org admin/super_admin — overrides all three scopes. */
  isAdmin?: boolean;
}

export interface VisibilityGatedKpi {
  visibility?: KpiVisibilityScope | string | null;
  ownerUserId?: string | null;
  initiativeId?: string | null;
}

const UNREACHABLE_USER_ID = '__res11_no_caller__';

/**
 * SQL fragment (± its positional `?` params, IN ORDER) that filters rows of
 * `alias` (a table/subquery exposing `visibility`, `owner_user_id`,
 * `initiative_id` — i.e. `initiative_kpis`-shaped) down to what the caller
 * may see. AND this into an existing WHERE that already scopes by
 * organization_id; never use it as the only predicate.
 *
 * `allowNullVisibility`: when the aliased table may have no row at all for
 * a given join (e.g. `v8_kpi_definitions LEFT JOIN initiative_kpis ck ON
 * ck.id = canonical_kpi_id`), pass the join's own id column so an absent
 * canonical link is treated as visible (today's behavior for definitions
 * with no canonical KPI — nothing to hide, RES-11 does not retrofit a
 * concept that has no owner object to hang it on).
 */
export function kpiVisibilitySql(
  alias: string,
  ctx: KpiVisibilityContext,
  options?: { nullableJoinIdColumn?: string }
): { sql: string; params: unknown[] } {
  const userId = ctx.userId || UNREACHABLE_USER_ID;
  // The owner can always see their own KPI, independent of its scope — a
  // scope restricts OTHER viewers, it never locks the owner out of their
  // own object. Checked first so private_to_owner and initiative_restricted
  // both benefit without duplicating the owner check per branch.
  const visibilityClause = `(
    ${alias}.owner_user_id = ?
    OR COALESCE(${alias}.visibility, 'org_visible') = 'org_visible'
    OR (COALESCE(${alias}.visibility, 'org_visible') = 'initiative_restricted' AND EXISTS (
      SELECT 1 FROM initiative_resources ir
      WHERE ir.initiative_id = ${alias}.initiative_id AND ir.user_id = ?
    ))
  )`;

  if (ctx.isAdmin) {
    return { sql: '1=1', params: [] };
  }

  if (options?.nullableJoinIdColumn) {
    return {
      sql: `(${options.nullableJoinIdColumn} IS NULL OR ${visibilityClause})`,
      params: [userId, userId],
    };
  }

  return { sql: visibilityClause, params: [userId, userId] };
}

/**
 * Pure single-row check — same policy as `kpiVisibilitySql`, for call sites
 * that already fetched one KPI row by id (e.g. attribution) rather than
 * running a list query. `isInitiativeMember` must come from a REAL
 * `initiative_resources` lookup (or org-admin short-circuit) — never assume.
 */
export function isKpiVisible(
  kpi: VisibilityGatedKpi,
  ctx: KpiVisibilityContext,
  isInitiativeMember: boolean
): boolean {
  if (ctx.isAdmin) return true;
  // The owner always sees their own KPI, independent of scope — mirrors
  // kpiVisibilitySql's owner_user_id short-circuit.
  if (Boolean(ctx.userId) && kpi.ownerUserId === ctx.userId) return true;
  const scope = (kpi.visibility || 'org_visible') as KpiVisibilityScope;
  if (scope === 'org_visible') return true;
  if (scope === 'private_to_owner') return false;
  if (scope === 'initiative_restricted') return Boolean(ctx.userId) && isInitiativeMember;
  // Unknown value (should be impossible under the DB CHECK constraint) — fail closed.
  return false;
}
