/**
 * Case Workspace routes — shared domain-error -> HTTP status mapping.
 *
 * The 11 caseWorkspace/* domain services (server/src/services/caseWorkspace/)
 * throw plain `new Error('snake_case_code')` (occasionally
 * `'code:dynamic-detail'`, e.g. `case_status_transition_not_allowed:DRAFT->CLOSED`)
 * for every validation/business-rule/state failure, and
 * `caseWorkspaceAuthContext.ts` throws a typed `CaseWorkspaceAuthError` for
 * tenant/membership failures. Neither layer knows about HTTP. This module is
 * the ONE place that turns those into stable `AppError`s
 * (server/src/utils/ErrorHandler.ts) so every case-workspace route file maps
 * errors identically.
 *
 * SEC-009 / CW-DOD-D6 (enumeration-safety): `CaseWorkspaceAuthError`'s
 * `case_access_denied` code maps to 404, NEVER 403 — a cross-tenant caseId
 * must be indistinguishable from a caseId that does not exist at all, at the
 * HTTP layer exactly as it already is at the service layer. Do not "fix"
 * this to 403; that would defeat the enumeration-oracle protection
 * `caseWorkspaceAuthContext.requireCaseAccess` was built for (see that
 * file's own header comment).
 */

import { randomUUID } from 'crypto';

import type { AuthRequest } from '../../../middleware/auth.middleware.js';
import { AppError } from '../../../utils/ErrorHandler.js';
import { CaseWorkspaceAuthError } from '../../../services/caseWorkspace/caseWorkspaceAuthContext.js';

/**
 * Exact-code overrides for domain errors whose correct HTTP status does not
 * follow the generic suffix heuristics below (see classifyDomainCode's
 * comment for why each family needs an override).
 */
const EXACT_STATUS_OVERRIDES: Record<string, number> = {
  // Natural-key / uniqueness conflicts that don't end in "_conflict".
  idempotency_key_conflict: 409,
  capability_already_registered: 409,
  case_already_exists_for_project: 409,
  case_closure_already_recorded: 409,
  run_already_bound: 409,
  wait_correlation_key_conflict: 409,
  wait_claim_fenced: 409,
  process_definition_share_requires_published_version: 409,

  // Genuine caller-identity authorization failures (distinct from the
  // "resource is in the wrong state" 409 family below).
  self_approval_forbidden: 403,
  plan_diff_cross_case_forbidden: 403,
  process_definition_share_not_authorized: 403,

  // Cross-reference / cross-tenant consistency problems in caller-supplied
  // ids — the referenced rows exist but don't agree with each other.
  case_project_organization_mismatch: 422,
  run_case_organization_mismatch: 422,
  process_version_case_organization_mismatch: 422,
  wait_run_binding_case_mismatch: 422,
  wait_action_proposal_case_mismatch: 422,
  proposal_case_plan_version_invalid: 422,
  proposal_supersedes_target_invalid: 422,
  plan_supersedes_target_invalid: 422,
  proposal_capability_not_found: 404,
  flag_definition_cycle_detected: 422,
  node_result_acceptance_unauthorized_skip_not_applicable: 422,
  gateway_evaluation_invalid_fields_for_node_type: 422,

  // "*_idempotency_record_not_found" is NOT a 404 — it means an INSERT ...
  // ON CONFLICT DO NOTHING reported a conflict but the immediate re-SELECT
  // by the same key found nothing, which should be structurally impossible
  // and indicates a real anomaly (e.g. a concurrent delete this codebase
  // never performs). Surface as 500, never as a client-facing 404/409.
};

const INTERNAL_INVARIANT_SUFFIX = '_idempotency_record_not_found';
const INSERT_FAILED_SUFFIX = '_insert_failed';

/**
 * Splits a domain error message into its stable code and optional dynamic
 * detail (`"code:DRAFT->CLOSED"` -> `"code"`), and classifies it into an
 * HTTP status using, in order: (1) the exact-override table above, (2) a
 * small set of ordered suffix/substring heuristics that cover the
 * remaining ~130 domain error codes across the 11 services without having
 * to enumerate every one by hand. Unrecognized-but-nonblank codes fall back
 * to 422 (a caught business-rule rejection is far more likely than a 500 for
 * anything shaped like `snake_case_reason`), never to 200/2xx.
 */
export function classifyDomainCode(rawMessage: string): { status: number; code: string } {
  const code = String(rawMessage || '').split(':')[0].trim() || 'case_workspace_unknown_error';

  const override = EXACT_STATUS_OVERRIDES[code];
  if (override != null) return { status: override, code };

  if (code.endsWith(INTERNAL_INVARIANT_SUFFIX)) return { status: 500, code };
  if (code.endsWith(INSERT_FAILED_SUFFIX)) return { status: 500, code };

  if (code === 'case_not_found' || code.endsWith('_not_found')) return { status: 404, code };

  if (
    code.endsWith('_conflict') ||
    code.includes('_determinism_conflict') ||
    code.includes('status_transition_not_allowed')
  ) {
    return { status: 409, code };
  }

  // "Resource exists, but is in the wrong lifecycle state for this action" —
  // 409 Conflict, distinct from the OCC "_version_conflict" family above but
  // the same HTTP status.
  if (
    code.endsWith('_not_editable') ||
    code.endsWith('_not_active') ||
    code.endsWith('_not_ready') ||
    code.includes('_not_publishable') ||
    code.endsWith('_not_in_review') ||
    code.endsWith('_stale') ||
    code.endsWith('_expired') ||
    code.includes('_requires_') ||
    code.endsWith('_validation_failed') ||
    code.endsWith('_not_a_widening')
  ) {
    return { status: 409, code };
  }

  if (code.endsWith('_forbidden') || code.endsWith('_unauthorized')) return { status: 403, code };
  if (code.endsWith('_required') || code.endsWith('_invalid')) return { status: 400, code };
  if (code.includes('_mismatch')) return { status: 422, code };

  return { status: 422, code };
}

/** True for AppError, ZodError-derived, or anything else already HTTP-shaped. */
function isAlreadyHttpShaped(err: unknown): err is AppError {
  return err instanceof AppError;
}

/**
 * Converts any error thrown by a caseWorkspace domain service, by
 * caseWorkspaceAuthContext, or by this route layer's own input validation
 * into a stable AppError. Never leaks a raw stack trace or SQL error text —
 * unrecognized non-Error throwables and anything without a plain
 * `snake_case`-shaped message become a generic 500 with no `details.cause`.
 */
export function toCaseWorkspaceAppError(err: unknown, correlationId: string): AppError {
  if (isAlreadyHttpShaped(err)) return err;

  if (err instanceof CaseWorkspaceAuthError) {
    // SEC-009/CW-DOD-D6: case_access_denied is 404, never 403 — see this
    // module's header comment. not_org_member/insufficient_org_role are
    // caller-identity-known org role failures, not existence oracles, so
    // 403 is safe there.
    const status = err.code === 'case_access_denied' ? 404 : 403;
    return new AppError(err.message, status, err.code.toUpperCase(), { correlationId });
  }

  if (err instanceof Error && /^[a-z][a-z0-9_]*(:.*)?$/.test(err.message)) {
    const { status, code } = classifyDomainCode(err.message);
    return new AppError(err.message, status, code.toUpperCase(), { correlationId });
  }

  return new AppError('An unexpected error occurred.', 500, 'INTERNAL_ERROR', { correlationId });
}

/**
 * Resolves (and stamps onto req, so errorHandlerMiddleware's own
 * `X-Correlation-ID` echo picks up the same value) the correlation id for
 * this request: an incoming `X-Correlation-ID` header, or a freshly
 * generated uuid. Route handlers pass this into any service call that
 * accepts a correlationId field (today: only
 * caseHistoryService.appendCaseHistoryEvent) and into
 * toCaseWorkspaceAppError so every error response — mapped or not — carries
 * it.
 */
export function resolveCorrelationId(req: AuthRequest): string {
  const existing = (req as unknown as { correlationId?: string }).correlationId;
  if (typeof existing === 'string' && existing.trim()) return existing;
  const header = typeof req.get === 'function' ? req.get('X-Correlation-ID') : undefined;
  const correlationId = typeof header === 'string' && header.trim() ? header.trim() : randomUUID();
  (req as unknown as { correlationId?: string }).correlationId = correlationId;
  return correlationId;
}
