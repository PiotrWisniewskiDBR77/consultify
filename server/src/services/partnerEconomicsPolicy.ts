/**
 * AMD-PRT-ECONOMICS-002 (owner decision 2A) — Partner economics are excluded.
 *
 * Partner commission, discount, accrual and payout OPERATIONS are unavailable
 * and hidden; every attempt fails closed BEFORE any service call or DB write.
 * Historical records are preserved and stay readable, but only through an
 * authorized same-tenant OWNER/ADMIN audit surface, and a read must never
 * imply that an operation is enabled.
 *
 * WHY THIS FILE EXISTS AT ALL.
 * The DoD requires ONE exported server predicate driving every v8 + legacy
 * economic endpoint and the UI projection. That predicate is imported by two
 * routers (`routes/v8/partner.routes.ts`, `routes/partners.routes.ts`) AND by
 * four services (`partnerCommissionService`, `partnerProgramLedgerService`,
 * `partnerPayoutSettingsService`, `partnerConfigService`). Placing it inside
 * any one of those services creates a service->service import cycle, because
 * those same services already import each other. A dedicated module is the
 * only acyclic home. It deliberately mirrors the shape of the existing
 * `partnerAccrualPolicy.ts` (same directory, same fail-closed error class).
 *
 * WHY IT IS A COMPILE-TIME CONSTANT AND NOT A RUNTIME FLAG.
 * Same reasoning as `src/utils/auditIso27001LegacyPresetGate.ts`: a runtime
 * flag can be flipped by an env var, a query string, a copy-pasted support
 * link or a stale deploy config. The owner decision is not an operational
 * toggle, so there is deliberately NO env read, NO query read, NO storage
 * read and NO feature-flag-registry entry here. Re-enabling partner economics
 * is a code change plus a new owner decision, and it re-opens
 * AMD-PRT-ECONOMICS-002 by definition ("Invalidate on any Partner economics
 * route, flag or UI reactivation").
 */

import type { NextFunction, Request, Response } from 'express';

import * as DbPromise from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

/** The owner decision this module enforces. Quoted in every refusal body. */
export const PARTNER_ECONOMICS_POLICY_DECISION = 'AMD-PRT-ECONOMICS-002';

/**
 * Stable machine-readable refusal code. Deliberately distinct from
 * `PARTNER_LEGACY_WRITER_DISABLED` (cutover) so telemetry and clients can tell
 * "moved to V8" apart from "excluded by owner policy".
 */
export const PARTNER_ECONOMICS_POLICY_CODE = 'PARTNER_ECONOMICS_POLICY_DISABLED';

/**
 * 410 Gone, NOT 403.
 *
 * This is load-bearing, not stylistic. `src/services/api/v8/partner.ts`
 * `shouldFallbackToLegacyPartner()` re-tries a failed governed call against the
 * legacy `/api/partners/*` surface on `[400, 404, 405, 501]` and on
 * `403 + PARTNER_ORG_REQUIRED`. Answering 403 would therefore actively drive
 * the client into a legacy fallback — the exact opposite of the DoD's
 * "direct legacy fallbacks zero". 410 is on none of those lists, so a policy
 * refusal can never be converted into a legacy attempt.
 */
export const PARTNER_ECONOMICS_POLICY_STATUS = 410 as const;

/**
 * THE single source of truth for the whole packet. Everything else in this
 * file, both routers, all four writer services and the API projection consume
 * this one constant.
 */
export const PARTNER_ECONOMICS_OPERATIONS_ENABLED = false as const;

/** The excluded operation families, exactly as named by the owner decision. */
export type PartnerEconomicOperation =
  | 'commission'
  | 'discount'
  | 'accrual'
  | 'payout'
  | 'payout_settings'
  | 'lifecycle_payout';

export class PartnerEconomicsPolicyDisabledError extends Error {
  readonly code = PARTNER_ECONOMICS_POLICY_CODE;
  readonly status = PARTNER_ECONOMICS_POLICY_STATUS;
  readonly decision = PARTNER_ECONOMICS_POLICY_DECISION;
  readonly operation: PartnerEconomicOperation;

  constructor(operation: PartnerEconomicOperation, message?: string) {
    super(
      message ||
        `Partner ${operation.replace(/_/g, ' ')} operations are excluded by owner policy ${PARTNER_ECONOMICS_POLICY_DECISION}`
    );
    this.name = 'PartnerEconomicsPolicyDisabledError';
    this.operation = operation;
  }
}

/** The predicate. Reads the constant; never an env, query or storage value. */
export function isPartnerEconomicsOperationAvailable(): boolean {
  return PARTNER_ECONOMICS_OPERATIONS_ENABLED;
}

/**
 * Deep guard for writer services. Called as the FIRST statement of every
 * economic writer, before any SQL, transaction, advisory lock or client
 * acquisition, so a refusal can never leave residue.
 */
export function assertPartnerEconomicsOperationAllowed(
  operation: PartnerEconomicOperation
): void {
  if (!isPartnerEconomicsOperationAvailable()) {
    throw new PartnerEconomicsPolicyDisabledError(operation);
  }
}

/**
 * The projection every economic API response carries, so the UI derives its
 * state from the server and never from a second, client-side copy of the
 * policy. Absent (undefined) would be indistinguishable from "not yet loaded",
 * so this is always present on economic payloads.
 */
export interface PartnerEconomicsPolicyProjection {
  policyUnavailable: {
    decision: string;
    code: string;
    /** Operation families excluded. Never a boolean the UI could mis-read. */
    operations: PartnerEconomicOperation[];
    /**
     * Historical records stay readable for audit. This flag exists so a UI can
     * render an honest read-only audit view without ever implying readiness.
     */
    historicalReadOnly: true;
  };
}

const EXCLUDED_OPERATIONS: PartnerEconomicOperation[] = [
  'commission',
  'discount',
  'accrual',
  'payout',
  'payout_settings',
  'lifecycle_payout',
];

export function partnerEconomicsPolicyProjection(): PartnerEconomicsPolicyProjection {
  return {
    policyUnavailable: {
      decision: PARTNER_ECONOMICS_POLICY_DECISION,
      code: PARTNER_ECONOMICS_POLICY_CODE,
      operations: [...EXCLUDED_OPERATIONS],
      historicalReadOnly: true,
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Route rules                                                                 */
/* -------------------------------------------------------------------------- */

type EconomicRouteRule = {
  method: string;
  /** Router-local path. Express strips the mount prefix for `router.use()`. */
  path: RegExp;
  operation: PartnerEconomicOperation;
};

/** `/api/v8/partner` — the tenant-facing governed surface. */
export const V8_PARTNER_ECONOMIC_WRITERS: EconomicRouteRule[] = [
  {
    method: 'POST',
    path: /^\/program\/lifecycle\/request-payout-phase\/?$/,
    operation: 'lifecycle_payout',
  },
  { method: 'POST', path: /^\/payouts\/request\/?$/, operation: 'payout' },
  { method: 'PUT', path: /^\/payout-settings\/?$/, operation: 'payout_settings' },
];

/** `/api/partners` — the legacy tenant surface. */
export const LEGACY_PARTNER_ECONOMIC_WRITERS: EconomicRouteRule[] = [
  { method: 'POST', path: /^\/payouts\/request\/?$/, operation: 'payout' },
  { method: 'PUT', path: /^\/payout-settings\/?$/, operation: 'payout_settings' },
];

/**
 * `/api/superadmin/partner-settlements` — the operator "money path".
 *
 * These were previously registered in the legacy-cutover kernel registry with
 * `state: 'observed'`, and the kernel only refuses a writer whose state is
 * `disabled` (`legacyCutoverKernel.ts`: "A writer that is not `disabled` is
 * never blocked by this kernel"). All 13 partner sibling rules were
 * `observed`, so every endpoint below was reachable and unrefused before this
 * packet.
 */
export const SUPERADMIN_SETTLEMENT_ECONOMIC_WRITERS: EconomicRouteRule[] = [
  { method: 'POST', path: /^\/approve-commissions\/?$/, operation: 'commission' },
  { method: 'POST', path: /^\/process-payout(?:\/[^/]+)?\/?$/, operation: 'payout' },
  { method: 'POST', path: /^\/complete-payout(?:\/[^/]+)?\/?$/, operation: 'payout' },
  { method: 'POST', path: /^\/fail-payout(?:\/[^/]+)?\/?$/, operation: 'payout' },
  { method: 'DELETE', path: /^\/attributions\/[^/]+\/?$/, operation: 'commission' },
  { method: 'POST', path: /^\/program\/[^/]+\/lifecycle\/?$/, operation: 'lifecycle_payout' },
  { method: 'POST', path: /^\/program\/[^/]+\/ledger-entry\/?$/, operation: 'accrual' },
];

/** `/api/superadmin/partner-config` — commission-rate and discount authoring. */
export const SUPERADMIN_CONFIG_ECONOMIC_WRITERS: EconomicRouteRule[] = [
  { method: 'PUT', path: /^\/commission-rates\/?$/, operation: 'commission' },
  { method: 'PUT', path: /^\/discount\/?$/, operation: 'discount' },
  { method: 'PUT', path: /^\/payout-settings\/?$/, operation: 'payout_settings' },
];

export function findPartnerEconomicWriter(
  rules: EconomicRouteRule[],
  method: string,
  path: string
): EconomicRouteRule | null {
  const normalizedMethod = String(method || '').toUpperCase();
  const normalizedPath = String(path || '/').split('?')[0] || '/';
  return (
    rules.find(
      (rule) => rule.method === normalizedMethod && rule.path.test(normalizedPath)
    ) || null
  );
}

/* -------------------------------------------------------------------------- */
/* Durable telemetry                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Deliberately NOT written into `partner_legacy_usage_events`. That table's
 * CHECK constraint admits only legacy_read / legacy_uncovered_writer /
 * legacy_writer_blocked / rollback_writer, and overloading
 * `legacy_writer_blocked` would conflate "cut over to V8" with "excluded by
 * owner policy" and silently corrupt the cutover parity telemetry that
 * PRT-MVP-LEGACY-CUTOVER-001 depends on.
 */
export const PARTNER_ECONOMICS_POLICY_EVENT_TABLE = 'partner_economics_policy_events';

export async function recordPartnerEconomicsPolicyDenial(params: {
  req: Request;
  operation: PartnerEconomicOperation;
  surface: string;
}): Promise<void> {
  const req = params.req as any;
  const userId = String(req.user?.id || req.userId || '').trim();
  const organizationId = String(
    req.user?.organizationId || req.organizationId || req.organization?.id || ''
  ).trim();
  const partnerOrgId = String(req.partnerOrgId || '').trim();
  const requestId = String(params.req.headers?.['x-request-id'] || '').trim();

  await DbPromise.run(
    `INSERT INTO ${PARTNER_ECONOMICS_POLICY_EVENT_TABLE}
       (request_id,user_id,organization_id,partner_org_id,method,route_path,surface,operation,decision,denial_code)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [
      requestId || null,
      userId || null,
      organizationId || null,
      partnerOrgId || null,
      String(params.req.method || 'UNKNOWN').toUpperCase(),
      String((params.req as any).originalUrl || params.req.path || '/').split('?')[0],
      params.surface,
      params.operation,
      PARTNER_ECONOMICS_POLICY_DECISION,
      PARTNER_ECONOMICS_POLICY_CODE,
    ],
    { fallback: false }
  );
}

/* -------------------------------------------------------------------------- */
/* Express guard                                                               */
/* -------------------------------------------------------------------------- */

export function partnerEconomicsPolicyBody(operation: PartnerEconomicOperation) {
  return {
    success: false,
    code: PARTNER_ECONOMICS_POLICY_CODE,
    decision: PARTNER_ECONOMICS_POLICY_DECISION,
    operation,
    message:
      'Partner commission, discount, accrual and payout operations are excluded by owner policy. Historical records remain readable for authorized audit only.',
    ...partnerEconomicsPolicyProjection(),
  };
}

/**
 * Mounted BEFORE the leaf handlers (and before the legacy cutover guard on the
 * legacy router) so a refused writer never reaches its handler, never reaches a
 * service and never opens a transaction.
 *
 * FAIL-CLOSED TELEMETRY: a telemetry outage can never re-open a disabled
 * writer. The insert is awaited inside try/catch; a failure is logged and the
 * 410 is still returned. Same contract as the legacy cutover kernel.
 */
export function createPartnerEconomicsPolicyGuard(
  rules: EconomicRouteRule[],
  surface: string
) {
  return async function partnerEconomicsPolicyGuard(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const rule = findPartnerEconomicWriter(rules, req.method, (req as any).path);
    if (!rule || isPartnerEconomicsOperationAvailable()) {
      next();
      return;
    }

    try {
      await recordPartnerEconomicsPolicyDenial({
        req,
        operation: rule.operation,
        surface,
      });
    } catch (error) {
      logger.error(
        '[PartnerEconomicsPolicy] Failed to persist policy denial telemetry; refusal still enforced',
        error
      );
    }

    res.status(PARTNER_ECONOMICS_POLICY_STATUS).json(partnerEconomicsPolicyBody(rule.operation));
  };
}
