/**
 * FIN-005 / VALUE-ENGINE — PROPOSED demo read-only exemption for the V8 Finance
 * value layer.
 *
 * ## Why this module exists
 *
 * `demoWriteProtection` (`middleware/demoGuard.middleware.ts`) classifies every
 * request as a write purely by HTTP verb: anything outside GET/HEAD/OPTIONS is
 * rejected in demo mode with `403 DEMO_READ_ONLY`. The Gateway mounts it with
 * `allowedRoutes: ['/api/demo/', '/api/auth/']` (`Gateway.ts:423-428`).
 *
 * The V8 Finance value layer is stateless compute exposed over POST because its
 * input is a JSON body, not because it persists anything. In demo mode the
 * Finance cockpit therefore renders "Value engine temporarily unavailable" —
 * a healthy engine reported as broken by a read-only guard.
 *
 * ## What this module is NOT
 *
 * It is a PROPOSAL. It is deliberately not imported by `Gateway.ts`. Changing
 * the global demo write guard is a security-review decision that sits outside
 * the FIN-005 ownership boundary. This module exists so that decision can be
 * reviewed against an exact, audited, executable list instead of a hand-waved
 * "exempt the value routes". The one-step Gateway diff lives in
 * `docs/program/WEEKEND_COMPLETION_2026-08-01/PACKETS/FIN-006_CROSS_MODULE_CURRENCY_AND_VALUE_ENGINE.md`
 * (§B.3).
 *
 * ## Audit method
 *
 * Every route in `financeValueRoutes.ts` was checked handler-by-handler, and
 * every service it calls was checked for database reach. The six value services
 * (`valueBridgeService`, `portfolioPrioritizationService`,
 * `capitalRationingService`, `investmentAppraisalService`,
 * `budgetVarianceService`, `valueAssuranceService`) have **zero import
 * statements** — no `DbPromise`, no pool, no repository, nothing. They are
 * deterministic functions over the request body. Reproduce with:
 *
 *   grep -cE '^import' server/src/services/valueBridgeService.ts   # -> 0
 *
 * ## Two deliberate narrowings
 *
 * 1. **Canonical mount only.** `financeValueRoutes` is mounted TWICE in
 *    `routes/v8/index.ts`: at `/finance/value` (line 80) and at the legacy
 *    alias `/finance-value` (line 85). Only the canonical `/api/v8/finance/value/*`
 *    prefix is allowlisted, because that is the only one any frontend caller
 *    uses. Exempting an alias nobody calls would double the exempted surface
 *    for zero benefit.
 *
 * 2. **Routes with a production caller only.** `POST /capital/ration` and
 *    `POST /value-assurance` are equally DB-free but have no caller anywhere in
 *    `src/`. They stay blocked: an exemption should be justified by a demo the
 *    client actually walks through, not by the route's existence. Both are
 *    listed in `AUDITED_VALUE_ROUTES` below so a reviewer can promote them in
 *    one line when a caller appears.
 *
 * ## Prefix semantics — read before applying
 *
 * `demoWriteProtection` matches with `pathForAllowlist.startsWith(prefix)`, so
 * feeding it these strings is prefix matching, not exact matching. None of the
 * four entries is a prefix of any other route in the router, so the effective
 * surface today is exactly these four endpoints. It is still weaker than
 * intended: a future `POST /api/v8/finance/value/appraise-and-save` would be
 * silently exempt. `isStatelessComputeDemoRoute()` below is the exact-match
 * predicate the proposed Gateway diff uses instead, which removes that class of
 * accident permanently.
 *
 * @module routes/v8/financeValueDemoAllowlist
 */

/** How a route was classified during the audit. */
export interface AuditedValueRoute {
  /** HTTP method the router registers. */
  readonly method: 'POST';
  /** Full path under the canonical `/api/v8/finance/value` mount. */
  readonly path: string;
  /** Pure-compute service the handler delegates to. */
  readonly service: string;
  /** Proven true for all six: the service file has zero imports. */
  readonly touchesDatabase: false;
  /** A file in `src/` that issues this request today. */
  readonly productionCaller: string | null;
  /** Whether this packet proposes exempting it from the demo write guard. */
  readonly proposedExempt: boolean;
}

/**
 * Complete audit of `financeValueRoutes.ts` — all six registered routes, no
 * omissions. `proposedExempt` is the minimality decision, `touchesDatabase` is
 * the safety precondition; a route may never be exempt with `touchesDatabase:
 * true`, which the type makes unrepresentable.
 */
export const AUDITED_VALUE_ROUTES: readonly AuditedValueRoute[] = [
  {
    method: 'POST',
    path: '/api/v8/finance/value/value-bridge',
    service: 'valueBridgeService.buildValueBridge',
    touchesDatabase: false,
    productionCaller: 'src/components/Economics/panels/ValueOfficePanel.tsx:98',
    proposedExempt: true,
  },
  {
    method: 'POST',
    path: '/api/v8/finance/value/portfolio/prioritize',
    service: 'portfolioPrioritizationService.prioritize',
    touchesDatabase: false,
    productionCaller: 'src/components/Economics/panels/ValueOfficePanel.tsx:112',
    proposedExempt: true,
  },
  {
    method: 'POST',
    path: '/api/v8/finance/value/appraise',
    service: 'investmentAppraisalService.appraise',
    touchesDatabase: false,
    productionCaller: 'src/components/Economics/panels/InvestmentAppraisalPanel.tsx:51',
    proposedExempt: true,
  },
  {
    method: 'POST',
    path: '/api/v8/finance/value/variance-bridge',
    service: 'budgetVarianceService.varianceBridge',
    touchesDatabase: false,
    productionCaller: 'src/components/Economics/panels/VarianceBridgePanel.tsx:45',
    proposedExempt: true,
  },
  {
    method: 'POST',
    path: '/api/v8/finance/value/capital/ration',
    service: 'capitalRationingService.knapsack',
    touchesDatabase: false,
    productionCaller: null,
    proposedExempt: false,
  },
  {
    method: 'POST',
    path: '/api/v8/finance/value/value-assurance',
    service: 'valueAssuranceService.assuranceSummary',
    touchesDatabase: false,
    productionCaller: null,
    proposedExempt: false,
  },
] as const;

/**
 * The proposed allowlist: exact, fully-qualified paths. No wildcards, no
 * trailing slash, no prefix that could ever cover a writing route.
 *
 * Shape matches `demoWriteProtection({ allowedRoutes })` so the proposal can be
 * mounted verbatim in a test against the REAL middleware.
 */
export const STATELESS_COMPUTE_DEMO_ALLOWLIST: readonly string[] = AUDITED_VALUE_ROUTES.filter(
  (route) => route.proposedExempt
).map((route) => route.path);

const EXEMPT_PATHS = new Set(STATELESS_COMPUTE_DEMO_ALLOWLIST);

/**
 * Exact-match predicate — the form the proposed `Gateway.ts` diff should use.
 *
 * Stricter than handing {@link STATELESS_COMPUTE_DEMO_ALLOWLIST} to
 * `demoWriteProtection` as prefixes in two ways:
 *   - the path must match exactly, so no future sibling route inherits the
 *     exemption by sharing a prefix;
 *   - the method must be POST, so a `DELETE` to a compute path is never exempt.
 *
 * @param method HTTP method of the incoming request.
 * @param pathname Request path WITHOUT query string or fragment.
 */
export function isStatelessComputeDemoRoute(method: string, pathname: string): boolean {
  if (String(method || '').toUpperCase() !== 'POST') return false;
  return EXEMPT_PATHS.has(String(pathname || ''));
}
