/**
 * V8 read-only Partner bridge — data scoped by `partner_users.partner_org_id`.
 * Namespace: /api/v8/partner (mounted by v8/index before v8OrgGate).
 *
 * Auth model:
 * - Same auth/context stack as other V8 routes: JWT + `req.organizationId` tenant context.
 * - This bridge bypasses tenant-wide v8OrgGate because partner access is scoped
 *   by partner membership, not by the tenant-wide V8 rollout flag.
 * - Reads retain the historical Partner membership projection.
 * - Every mutation additionally requires the Partner organization to be
 *   durably bound to the exact V8 tenant through `owner_organization_id`.
 *
 * @module routes/v8/partner.routes
 */

import crypto from 'node:crypto';

import type { NextFunction, Response } from 'express';
import { Router } from 'express';

import { getDatabase } from '../../database/Database.js';
import type { AuthRequest } from '../../middleware/auth.middleware.js';
import { requireOrgRole } from '../../middleware/rbac.middleware.js';
import { getV8Context } from '../../middleware/v8Auth.middleware.js';
import { requireActiveMembership } from '../../services/legacyCutover/requireActiveMembership.js';
import legalService from '../../services/legalService.js';
import PartnerCommissionService from '../../services/partnerCommissionService.js';
import {
  PartnerConnectionError,
  connectPartnerOrganization,
  getPartnerConnectionForTenant,
} from '../../services/partnerConnectionService.js';
import {
  startCertificationExam,
  submitCertificationExam,
  updateCertificationModuleProgress,
} from '../../services/partnerCertificationService.js';
import {
  V8_PARTNER_ECONOMIC_WRITERS,
  createPartnerEconomicsPolicyGuard,
  partnerEconomicsPolicyProjection,
} from '../../services/partnerEconomicsPolicy.js';
import { getActivePartnerOrgIdForTenantUser } from '../../services/partnerOrgResolution.js';
import {
  getPartnerPayoutSettings,
  isPartnerPayoutDestinationComplete,
  updatePartnerPayoutSettings,
} from '../../services/partnerPayoutSettingsService.js';
import PartnerProgramLedgerService from '../../services/partnerProgramLedgerService.js';
import { listPartnerParticipantLedger } from '../../services/partnerParticipantLedgerService.js';
import PartnerReferralService from '../../services/partnerReferralService.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import * as DbPromise from '../../utils/DbPromise.js';
import { ensureUserOnboardingStatusTable } from '../../utils/ensureUserOnboardingStatusTable.js';
import logger from '../../utils/Logger.js';

const router = Router();

type BoundPartnerRequest = AuthRequest & { boundPartnerOrgId?: string };

export const V8_PARTNER_READ_CONTRACT = 'partner_runtime_read_v1';
export const V8_PARTNER_PROGRAM_CONTRACT = 'partner_program_p29_v1';

const unavailablePartnerWriter = (capability: string) =>
  asyncHandler(async (_req: AuthRequest, res: Response) =>
    res.status(503).json({
      success: false,
      code: 'FEATURE_NOT_AVAILABLE',
      capability,
      message: 'This Partner capability is not available yet.',
    })
  );

const requireBoundPartnerTenant = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { organizationId, userId } = getV8Context(req);
    const partnerOrgId = await getActivePartnerOrgIdForTenantUser(organizationId, userId);
    if (!partnerOrgId) {
      return res.status(403).json({
        error: 'Partner organization required',
        code: 'PARTNER_ORG_REQUIRED',
      });
    }
    (req as BoundPartnerRequest).boundPartnerOrgId = partnerOrgId;
    next();
  }
);

const requireExactPartnerTenantContext = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  const { organizationId } = getV8Context(req);
  const requestedOrganizationId = String(req.requestedOrganizationId || '').trim();
  if (!requestedOrganizationId) {
    res.status(403).json({
      error: 'Explicit Partner tenant context required',
      code: 'PARTNER_TENANT_CONTEXT_REQUIRED',
    });
    return;
  }
  if (requestedOrganizationId !== organizationId) {
    res.status(403).json({ success: false, code: 'ORG_MEMBERSHIP_REVOKED' });
    return;
  }
  next();
};

async function getBoundPartnerOrgId(req: AuthRequest): Promise<string | null> {
  const cached = (req as BoundPartnerRequest).boundPartnerOrgId;
  if (cached) return cached;
  const { organizationId, userId } = getV8Context(req);
  return getActivePartnerOrgIdForTenantUser(organizationId, userId);
}

// AMD-PRT-ECONOMICS-002: economic mutations are refused here, as the FIRST
// middleware on this router. Placement is load-bearing: the demo-dataset
// middleware below performs writes (seeding), so guarding after it would let a
// policy-denied request mutate the database before being refused.
router.use(createPartnerEconomicsPolicyGuard(V8_PARTNER_ECONOMIC_WRITERS, 'v8_partner'));
router.use(requireExactPartnerTenantContext);

// Certification mutations must fail closed before the shared partner demo
// seeder below can perform any write. Route-level membership checks remain as
// defence in depth, but this ordering is what makes revoked requests no-write.
router.use(
  /^\/certifications\/[^/]+\/(?:modules\/[^/]+\/progress|exam\/(?:start|submit))\/?$/,
  requireActiveMembership
);

// Self-connect acquires Partner capability, so live tenant membership and an
// ADMIN/OWNER role must be established before any resolver/seeder can write.
router.use('/connect', requireActiveMembership, requireOrgRole('admin'));

// Every real V8 successor for PRT-W01..W08 and PRT-W13..W15 must prove the
// exact tenant-to-Partner binding before the shared demo seeder can write.
// Historical owner_organization_id=NULL rows intentionally fail this guard.
router.use(
  /^(?:\/payouts\/request|\/campaign-links(?:\/[^/]+)?|\/organization(?:\/specializations|\/regions|\/listing)?|\/payout-settings|\/certifications\/[^/]+\/(?:modules\/[^/]+\/progress|exam\/(?:start|submit)))\/?$/,
  requireActiveMembership,
  requireBoundPartnerTenant
);

// These four legacy endpoints were deliberate no-write 503 stubs. Their V8
// successors preserve that honest contract until the corresponding business
// commands are approved. They are registered before the demo seeder so even an
// authorized request cannot mutate Partner demo data on its way to a refusal.
router.post(
  '/clients',
  requireActiveMembership,
  requireOrgRole('admin'),
  requireBoundPartnerTenant,
  unavailablePartnerWriter('partner_client_creation')
);
router.post(
  '/employees',
  requireActiveMembership,
  requireOrgRole('admin'),
  requireBoundPartnerTenant,
  unavailablePartnerWriter('partner_employee_creation')
);
router.post(
  '/access-links',
  requireActiveMembership,
  requireOrgRole('admin'),
  requireBoundPartnerTenant,
  unavailablePartnerWriter('partner_access_link_creation')
);
router.post(
  '/licenses/order',
  requireActiveMembership,
  requireOrgRole('admin'),
  requireBoundPartnerTenant,
  unavailablePartnerWriter('partner_license_order')
);

export async function getPartnerConnectionHandler(req: AuthRequest, res: Response) {
  const { organizationId, userId } = getV8Context(req);
  try {
    const connection = await getPartnerConnectionForTenant({ organizationId, userId });
    return res.json({
      data: connection,
      meta: {
        version: 'v8',
        contract: V8_PARTNER_READ_CONTRACT,
        v8TenantOrganizationId: organizationId,
      },
    });
  } catch (error) {
    logger.error('[Partner] canonical connection read unavailable', error);
    return res.status(503).json({
      success: false,
      code: 'FEATURE_NOT_AVAILABLE',
      capability: 'partner_connection_read',
      message: 'Partner connection status is temporarily unavailable.',
    });
  }
}

/**
 * D8 / DEC-2026-08-25-64 — canonical, strict exact-tenant connection read.
 * Registered before `requireBoundPartnerTenant` so an authenticated tenant
 * member without a Partner binding receives `connected:false`, not a 403.
 */
router.get('/connection', requireActiveMembership, asyncHandler(getPartnerConnectionHandler));

// Every canonical Partner route after `/connect` is scoped to the exact live
// Consultify tenant selected by the request.  Do not resolve or self-heal a
// Partner membership from userId alone here: a user may legitimately belong
// to more than one Consultify organization.  Demo fixtures are seeded by
// explicit, disposable-DB harnesses rather than from a production request.
router.use(/^(?!\/(?:connect|connection)\/?$)/, requireActiveMembership, requireBoundPartnerTenant);

function partnerReadMeta(req: AuthRequest, partnerOrgId: string) {
  const { organizationId } = getV8Context(req);
  return {
    version: 'v8' as const,
    contract: V8_PARTNER_READ_CONTRACT,
    partnerOrgId,
    v8TenantOrganizationId: organizationId,
  };
}

function partnerProgramMeta(req: AuthRequest, partnerOrgId: string) {
  const { organizationId } = getV8Context(req);
  return {
    version: 'v8' as const,
    contract: V8_PARTNER_PROGRAM_CONTRACT,
    partnerOrgId,
    v8TenantOrganizationId: organizationId,
  };
}

/**
 * AMD-PRT-ECONOMICS-002 (owner decision 2A) read-side gate.
 *
 * Writes are already fully refused by `createPartnerEconomicsPolicyGuard`
 * above, but until now the economic READS (program/status, program/ledger,
 * earnings-summary, commission-transactions, payouts, payout-settings) had
 * NO role check at all: any authenticated partner-portal user could see full
 * commission/payout history. AMD-PRT-ECONOMICS-002 requires that historical
 * records "stay readable BUT ONLY through an authorized same-tenant
 * OWNER/ADMIN audit surface" — this array is that surface, applied only to
 * the six economic read routes below (never to the non-economic reads, which
 * must keep working for ordinary partner users).
 *
 * Two checks, both server-derived — never a client-supplied header/body:
 *  1. `requireActiveMembership` (server/src/services/legacyCutover/
 *     requireActiveMembership.ts) re-reads a REAL, per-request `status='ACTIVE'`
 *     row from `organization_members` for the V8 tenant context that
 *     `attachV8Context` already attached upstream (`req.v8Context.organizationId`
 *     / `.userId`). Its own doc comment: "Role claims, including SUPERADMIN,
 *     never bypass it" — this is what denies a SUPERADMIN JWT claim that has
 *     no live membership row, and denies a caller whose real membership is for
 *     a different (foreign) tenant, and denies a revoked membership.
 *  2. `requireOrgRole('admin')` (server/src/middleware/rbac.middleware.ts,
 *     `requireRole`/`requireOrgRole` — alias defined lines ~257-259) then
 *     requires ADMIN-or-above from `req.userRole`/`req.user.role`, which
 *     `verifyToken` resolved from that same `organization_members` row
 *     upstream. OWNER canonicalizes to the same "superadmin" bypass tier as
 *     ADMIN's hierarchy check (rbac.middleware.ts `toCanonicalRole`), so both
 *     OWNER and ADMIN pass while MEMBER (canonical "user", level 1 < 2) is
 *     rejected. Placing this SECOND means a membership-less SUPERADMIN claim
 *     is already denied by check 1 and never reaches the role bypass here.
 *
 * Call-convention precedent, copied rather than reinvented:
 * `server/src/routes/admin-data.routes.ts` line ~45
 * (`router.use(requireRole('super_admin', 'admin', 'owner'))`) and line ~108
 * (`router.put('/user-tiers/:orgId/:userId', requireRole(...), ...)`).
 */
const requirePartnerEconomicsReadAccess = [requireActiveMembership, requireOrgRole('admin')];

function requireIdempotencyKey(req: AuthRequest, res: Response): string | null {
  const key = String(req.headers['idempotency-key'] || '').trim();
  if (!key) {
    res
      .status(400)
      .json({ error: 'Idempotency-Key is required', code: 'IDEMPOTENCY_KEY_REQUIRED' });
    return null;
  }
  return key;
}

async function certificationActor(req: AuthRequest, res: Response) {
  const userId = req.userId || req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
    return null;
  }
  const partnerOrgId = await getBoundPartnerOrgId(req);
  if (!partnerOrgId) {
    res.status(403).json({ error: 'Partner organization required', code: 'PARTNER_ORG_REQUIRED' });
    return null;
  }
  return { userId, partnerOrgId };
}

router.post(
  '/connect',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    const result = await connectPartnerOrganization({
      organizationId,
      userId,
      idempotencyKey: String(req.headers['idempotency-key'] || '').trim() || undefined,
      name: req.body?.name,
      contactEmail: req.body?.contactEmail,
      actorName: req.user?.name,
      actorEmail: req.user?.email,
    });
    return res.status(result.status).json({
      data: result.data,
      meta: partnerReadMeta(req, result.data.organization.id),
    });
  })
);

/**
 * GET /api/v8/partner/program/status
 * P29 single truth: lifecycle phase (runtime) + derived ledger balances
 */
router.get(
  '/program/status',
  ...requirePartnerEconomicsReadAccess,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.userId || req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
    }
    const partnerOrgId = await getBoundPartnerOrgId(req);
    if (!partnerOrgId) {
      return res.status(403).json({
        error: 'Partner organization required',
        code: 'PARTNER_ORG_REQUIRED',
      });
    }
    const detail = await PartnerProgramLedgerService.getProgramStatusDetail(
      partnerOrgId,
      'partner'
    );
    const payoutSettings = await getPartnerPayoutSettings(partnerOrgId);
    return res.json({
      data: {
        lifecyclePhase: detail.runtime.lifecycle_phase,
        partnerOrganizationStatus: detail.runtime.partner_status,
        onboardChecklist: JSON.parse(detail.runtime.onboard_checklist_json || '{}'),
        payoutSettingsComplete: isPartnerPayoutDestinationComplete(payoutSettings),
        balances: detail.balances,
        whatNext: detail.whatNext,
        hold: detail.hold,
        ...(detail.degraded ? { degraded: detail.degraded } : {}),
      },
      // AMD-PRT-ECONOMICS-002 (GAP 2): every economic read carries the policy
      // projection inside `meta`, alongside the existing contract/version
      // fields — the one place a client already looks for server-derived
      // envelope state, so the UI needs no second, client-side copy of the
      // policy to render an honest read-only audit view.
      meta: { ...partnerProgramMeta(req, partnerOrgId), ...partnerEconomicsPolicyProjection() },
    });
  })
);

/**
 * GET /api/v8/partner/program/ledger
 */
router.get(
  '/program/ledger',
  ...requirePartnerEconomicsReadAccess,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.userId || req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
    }
    const partnerOrgId = await getBoundPartnerOrgId(req);
    if (!partnerOrgId) {
      return res.status(403).json({
        error: 'Partner organization required',
        code: 'PARTNER_ORG_REQUIRED',
      });
    }
    const limit =
      typeof req.query.limit === 'string' && /^\d+$/.test(req.query.limit)
        ? parseInt(req.query.limit, 10)
        : 50;
    const offset =
      typeof req.query.offset === 'string' && /^\d+$/.test(req.query.offset)
        ? parseInt(req.query.offset, 10)
        : 0;
    const entries = await PartnerProgramLedgerService.listEntries(partnerOrgId, { limit, offset });
    return res.json({
      data: { entries },
      meta: { ...partnerProgramMeta(req, partnerOrgId), ...partnerEconomicsPolicyProjection() },
    });
  })
);

/** Non-economic immutable participant/referral facts for the signed-in Partner. */
router.get(
  '/program/participant-ledger',
  requireBoundPartnerTenant,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const partnerOrgId = await getBoundPartnerOrgId(req);
    if (!partnerOrgId) {
      return res
        .status(403)
        .json({ error: 'Partner organization required', code: 'PARTNER_ORG_REQUIRED' });
    }
    const entries = await listPartnerParticipantLedger({
      tenantOrganizationId: organizationId,
      partnerOrgId,
      limit: Number(req.query.limit) || 50,
    });
    return res.json({
      data: { entries },
      meta: {
        contract: 'partner_participant_referral_v1',
        monetaryAccrual: false,
        payoutAvailable: false,
        decision: 'AMD-PRT-ECONOMICS-002',
      },
    });
  })
);

/**
 * POST /api/v8/partner/program/lifecycle/request-payout-phase
 * Partner-only edge per P29: earn → payout
 */
router.post(
  '/program/lifecycle/request-payout-phase',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.userId || req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
    }
    const partnerOrgId = await getBoundPartnerOrgId(req);
    if (!partnerOrgId) {
      return res.status(403).json({
        error: 'Partner organization required',
        code: 'PARTNER_ORG_REQUIRED',
      });
    }
    try {
      const payoutSettings = await getPartnerPayoutSettings(partnerOrgId);
      if (!isPartnerPayoutDestinationComplete(payoutSettings)) {
        let whatNext: string[] = [
          'Uzupełnij dane wypłaty: PUT /api/v8/partner/payout-settings (konto i metoda), potem ponów request fazy payout.',
        ];
        try {
          const d = await PartnerProgramLedgerService.getProgramStatusDetail(
            partnerOrgId,
            'partner'
          );
          whatNext = [...whatNext, ...d.whatNext];
        } catch {
          /* ignore */
        }
        return res.status(409).json({
          error: 'Complete payout settings before requesting payout phase',
          code: 'P29_PAYOUT_SETTINGS_INCOMPLETE',
          whatNext,
          meta: partnerProgramMeta(req, partnerOrgId),
        });
      }
      const result = await PartnerProgramLedgerService.transitionLifecycle({
        partnerOrgId,
        toPhase: 'payout',
        actor: 'partner',
        actorId: userId,
        reason: typeof req.body?.reason === 'string' ? req.body.reason : undefined,
      });
      return res.json({
        data: result,
        meta: partnerProgramMeta(req, partnerOrgId),
      });
    } catch (e: any) {
      const code = e?.code || 'P29_LIFECYCLE_ERROR';
      let whatNext: string[] = [];
      if (code === 'P29_LIFECYCLE_INVALID' || code === 'P29_LIFECYCLE_FORBIDDEN') {
        try {
          const d = await PartnerProgramLedgerService.getProgramStatusDetail(
            partnerOrgId,
            'partner'
          );
          whatNext = d.whatNext;
        } catch {
          /* ignore */
        }
      }
      return res.status(400).json({
        error: e?.message || 'Lifecycle error',
        code,
        ...(whatNext.length ? { whatNext } : {}),
      });
    }
  })
);

/**
 * GET /api/v8/partner/clients
 */
router.get(
  '/clients',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.userId || req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
    }
    const partnerOrgId = await getBoundPartnerOrgId(req);
    if (!partnerOrgId) {
      return res.status(403).json({
        error: 'Partner organization required',
        code: 'PARTNER_ORG_REQUIRED',
      });
    }
    const clients = await PartnerReferralService.getPartnerClients(partnerOrgId, {
      status: typeof req.query.status === 'string' ? req.query.status : undefined,
      limit:
        typeof req.query.limit === 'string' && /^\d+$/.test(req.query.limit)
          ? parseInt(req.query.limit, 10)
          : 50,
      offset:
        typeof req.query.offset === 'string' && /^\d+$/.test(req.query.offset)
          ? parseInt(req.query.offset, 10)
          : 0,
    });
    return res.json({
      data: { clients },
      meta: partnerReadMeta(req, partnerOrgId),
    });
  })
);

/**
 * GET /api/v8/partner/projects
 */
router.get(
  '/projects',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.userId || req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
    }
    const partnerOrgId = await getBoundPartnerOrgId(req);
    if (!partnerOrgId) {
      return res.status(403).json({
        error: 'Partner organization required',
        code: 'PARTNER_ORG_REQUIRED',
      });
    }
    const projects = await PartnerReferralService.getPartnerProjects(partnerOrgId, {
      limit:
        typeof req.query.limit === 'string' && /^\d+$/.test(req.query.limit)
          ? parseInt(req.query.limit, 10)
          : 50,
      offset:
        typeof req.query.offset === 'string' && /^\d+$/.test(req.query.offset)
          ? parseInt(req.query.offset, 10)
          : 0,
    });
    return res.json({
      data: { projects },
      meta: partnerReadMeta(req, partnerOrgId),
    });
  })
);

/**
 * GET /api/v8/partner/employees
 */
router.get(
  '/employees',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.userId || req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
    }
    const partnerOrgId = await getBoundPartnerOrgId(req);
    if (!partnerOrgId) {
      return res.status(403).json({
        error: 'Partner organization required',
        code: 'PARTNER_ORG_REQUIRED',
      });
    }
    const employees = await PartnerReferralService.getPartnerEmployees(partnerOrgId, {
      status: typeof req.query.status === 'string' ? req.query.status : undefined,
      limit:
        typeof req.query.limit === 'string' && /^\d+$/.test(req.query.limit)
          ? parseInt(req.query.limit, 10)
          : 50,
      offset:
        typeof req.query.offset === 'string' && /^\d+$/.test(req.query.offset)
          ? parseInt(req.query.offset, 10)
          : 0,
    });
    return res.json({
      data: { employees },
      meta: partnerReadMeta(req, partnerOrgId),
    });
  })
);

/**
 * GET /api/v8/partner/onboarding-status
 */
router.get(
  '/onboarding-status',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await ensureUserOnboardingStatusTable(getDatabase() as any);
    const userId = req.userId || req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
    }
    const partnerOrgId = await getBoundPartnerOrgId(req);
    if (!partnerOrgId) {
      return res.status(403).json({
        error: 'Partner organization required',
        code: 'PARTNER_ORG_REQUIRED',
      });
    }
    const db = getDatabase();
    const row = await DbPromise.get<{
      terms_accepted?: boolean | number | null;
      privacy_accepted?: boolean | number | null;
      pricing_tier?: string | null;
      payment_setup?: boolean | number | null;
      completed?: boolean | number | null;
    }>(
      db,
      `SELECT terms_accepted, privacy_accepted, pricing_tier, payment_setup, completed
       FROM user_onboarding_status
       WHERE user_id = ?`,
      [userId]
    );
    return res.json({
      data: {
        status: {
          termsAccepted: Boolean(row?.terms_accepted),
          privacyAccepted: Boolean(row?.privacy_accepted),
          pricingTier: row?.pricing_tier ?? null,
          paymentSetup: Boolean(row?.payment_setup),
          completed: Boolean(row?.completed),
        },
      },
      meta: partnerReadMeta(req, partnerOrgId),
    });
  })
);

/**
 * POST /api/v8/partner/onboarding/accept-terms
 */
router.post(
  '/onboarding/accept-terms',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await ensureUserOnboardingStatusTable(getDatabase() as any);
    const userId = req.userId || req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
    }
    const partnerOrgId = await getBoundPartnerOrgId(req);
    if (!partnerOrgId) {
      return res.status(403).json({
        error: 'Partner organization required',
        code: 'PARTNER_ORG_REQUIRED',
      });
    }

    const { termsVersion = 'v1.0', privacyVersion = 'v1.0' } = req.body ?? {};

    await DbPromise.run(
      getDatabase(),
      `INSERT INTO user_onboarding_status (
         user_id, terms_accepted, terms_accepted_at, terms_version,
         privacy_accepted, privacy_accepted_at, privacy_version, updated_at
       ) VALUES (?, TRUE, NOW(), ?, TRUE, NOW(), ?, NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         terms_accepted = TRUE,
         terms_accepted_at = NOW(),
         terms_version = excluded.terms_version,
         privacy_accepted = TRUE,
         privacy_accepted_at = NOW(),
         privacy_version = excluded.privacy_version,
         updated_at = NOW()`,
      [userId, termsVersion, privacyVersion]
    );

    const ipAddress =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket?.remoteAddress ||
      '';
    const userAgent = (req.headers['user-agent'] as string) || '';
    const organizationId = req.organizationId || req.user?.organizationId;

    try {
      await legalService.acceptDocuments(
        userId,
        ['TOS', 'PRIVACY'],
        'USER',
        ipAddress,
        userAgent,
        organizationId
      );
    } catch (legalErr) {
      logger.warn('[V8 Partner Onboarding] Legal acceptance sync failed (non-blocking):', legalErr);
    }

    return res.status(201).json({
      data: { success: true, message: 'Terms accepted' },
      meta: partnerReadMeta(req, partnerOrgId),
    });
  })
);

/**
 * POST /api/v8/partner/onboarding/select-tier
 */
router.post(
  '/onboarding/select-tier',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await ensureUserOnboardingStatusTable(getDatabase() as any);
    const userId = req.userId || req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
    }
    const partnerOrgId = await getBoundPartnerOrgId(req);
    if (!partnerOrgId) {
      return res.status(403).json({
        error: 'Partner organization required',
        code: 'PARTNER_ORG_REQUIRED',
      });
    }

    const tier = typeof req.body?.tier === 'string' ? req.body.tier : '';
    const validTiers = ['starter', 'professional', 'enterprise'];
    if (!validTiers.includes(tier)) {
      return res.status(400).json({
        error: 'Invalid pricing tier',
        code: 'INVALID_PRICING_TIER',
      });
    }

    await DbPromise.run(
      getDatabase(),
      `INSERT INTO user_onboarding_status (user_id, pricing_tier, pricing_tier_selected_at, updated_at)
       VALUES (?, ?, NOW(), NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         pricing_tier = excluded.pricing_tier,
         pricing_tier_selected_at = NOW(),
         updated_at = NOW()`,
      [userId, tier]
    );

    return res.json({
      data: { success: true, tier, message: 'Pricing tier selected' },
      meta: partnerReadMeta(req, partnerOrgId),
    });
  })
);

/**
 * POST /api/v8/partner/onboarding/complete
 */
router.post(
  '/onboarding/complete',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await ensureUserOnboardingStatusTable(getDatabase() as any);
    const userId = req.userId || req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
    }
    const partnerOrgId = await getBoundPartnerOrgId(req);
    if (!partnerOrgId) {
      return res.status(403).json({
        error: 'Partner organization required',
        code: 'PARTNER_ORG_REQUIRED',
      });
    }

    const status = await DbPromise.get<{
      terms_accepted?: boolean | number | null;
      privacy_accepted?: boolean | number | null;
      pricing_tier?: string | null;
    }>(
      getDatabase(),
      `SELECT terms_accepted, privacy_accepted, pricing_tier
       FROM user_onboarding_status
       WHERE user_id = ?`,
      [userId]
    );

    if (!status) {
      return res.status(400).json({
        error: 'No onboarding status found',
        code: 'ONBOARDING_STATUS_NOT_FOUND',
      });
    }

    if (!status.terms_accepted || !status.privacy_accepted) {
      return res.status(400).json({
        error: 'Terms not accepted',
        code: 'ONBOARDING_TERMS_REQUIRED',
      });
    }

    if (!status.pricing_tier) {
      return res.status(400).json({
        error: 'Pricing tier not selected',
        code: 'ONBOARDING_PRICING_TIER_REQUIRED',
      });
    }

    await DbPromise.run(
      getDatabase(),
      `UPDATE user_onboarding_status
       SET completed = TRUE,
           completed_at = NOW(),
           updated_at = NOW()
       WHERE user_id = ?`,
      [userId]
    );

    await DbPromise.run(
      getDatabase(),
      `UPDATE users SET onboarding_completed = TRUE WHERE id = ?`,
      [userId]
    );

    return res.json({
      data: { success: true, message: 'Onboarding completed!' },
      meta: partnerReadMeta(req, partnerOrgId),
    });
  })
);

/**
 * GET /api/v8/partner/referral-tools
 */
router.get(
  '/referral-tools',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.userId || req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
    }
    const partnerOrgId = await getBoundPartnerOrgId(req);
    if (!partnerOrgId) {
      return res.status(403).json({
        error: 'Partner organization required',
        code: 'PARTNER_ORG_REQUIRED',
      });
    }
    const tools = await PartnerReferralService.getReferralTools(partnerOrgId);
    const hasIdentity = (input: { referralCode?: string; referralLink?: string } | null) =>
      Boolean(String(input?.referralCode || '').trim() && String(input?.referralLink || '').trim());

    const normalizeWithEnsuredIdentity = async (
      baseTools: {
        referralCode?: string;
        referralLink?: string;
        referralLinkSlug?: string;
        qrCodeUrl?: string;
        campaignLinks?: unknown[];
      } | null
    ) => {
      const orgRow = await DbPromise.get<{ name?: string | null }>(
        getDatabase(),
        `SELECT name FROM partner_organizations WHERE id = ? LIMIT 1`,
        [partnerOrgId]
      );
      const ensuredIdentity =
        typeof (PartnerReferralService as any).ensurePartnerReferralIdentity === 'function'
          ? await (PartnerReferralService as any).ensurePartnerReferralIdentity(
              partnerOrgId,
              orgRow?.name || undefined
            )
          : null;
      const prefix = String(orgRow?.name || 'partner')
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '')
        .slice(0, 6);
      const fallbackCode = `${prefix || 'PARTNER'}-${String(partnerOrgId).slice(0, 4).toUpperCase()}`;
      const fallbackSlug = String(orgRow?.name || 'partner')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .concat(`-${String(partnerOrgId).slice(0, 6).toLowerCase()}`);
      const referralCode =
        String(baseTools?.referralCode || '').trim() ||
        String(ensuredIdentity?.referralCode || '').trim() ||
        fallbackCode;
      const referralLinkSlug =
        String(baseTools?.referralLinkSlug || '').trim() ||
        String(ensuredIdentity?.referralLinkSlug || '').trim() ||
        fallbackSlug;
      return {
        referralCode,
        referralLink: `${process.env.APP_BASE_URL || 'https://consultify.ai'}/r/${referralLinkSlug}`,
        referralLinkSlug,
        qrCodeUrl: `${
          process.env.APP_BASE_URL || 'https://consultify.ai'
        }/api/partner/qr/${referralLinkSlug}`,
        campaignLinks: Array.isArray(baseTools?.campaignLinks) ? baseTools?.campaignLinks : [],
      };
    };

    if (!tools) {
      // Compatibility guard: preserve a usable shape for clients even when
      // campaign rows are unavailable.
      const fallbackTools = await normalizeWithEnsuredIdentity(null);
      return res.json({
        data: { tools: fallbackTools },
        meta: partnerReadMeta(req, partnerOrgId),
      });
    }

    if (!hasIdentity(tools)) {
      const healedTools = await normalizeWithEnsuredIdentity(tools);
      return res.json({
        data: { tools: healedTools },
        meta: partnerReadMeta(req, partnerOrgId),
      });
    }

    return res.json({
      data: { tools },
      meta: partnerReadMeta(req, partnerOrgId),
    });
  })
);

/**
 * GET /api/v8/partner/referral-analytics?days=
 */
router.get(
  '/referral-analytics',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.userId || req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
    }
    const partnerOrgId = await getBoundPartnerOrgId(req);
    if (!partnerOrgId) {
      return res.status(403).json({
        error: 'Partner organization required',
        code: 'PARTNER_ORG_REQUIRED',
      });
    }
    const daysRaw = req.query.days;
    const days =
      typeof daysRaw === 'string' && /^\d+$/.test(daysRaw)
        ? Math.min(365, Math.max(1, parseInt(daysRaw, 10)))
        : 30;
    const analytics = await PartnerReferralService.getReferralAnalytics(partnerOrgId, days);
    return res.json({
      data: { analytics, days },
      meta: partnerReadMeta(req, partnerOrgId),
    });
  })
);

/**
 * GET /api/v8/partner/attributions
 */
router.get(
  '/attributions',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.userId || req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
    }
    const partnerOrgId = await getBoundPartnerOrgId(req);
    if (!partnerOrgId) {
      return res.status(403).json({
        error: 'Partner organization required',
        code: 'PARTNER_ORG_REQUIRED',
      });
    }
    const attributions = await PartnerReferralService.getPartnerAttributions(partnerOrgId, {
      status: typeof req.query.status === 'string' ? req.query.status : undefined,
      limit:
        typeof req.query.limit === 'string' && /^\d+$/.test(req.query.limit)
          ? parseInt(req.query.limit, 10)
          : 50,
      offset:
        typeof req.query.offset === 'string' && /^\d+$/.test(req.query.offset)
          ? parseInt(req.query.offset, 10)
          : 0,
    });
    return res.json({
      data: { attributions },
      meta: partnerReadMeta(req, partnerOrgId),
    });
  })
);

/**
 * GET /api/v8/partner/earnings-summary
 */
router.get(
  '/earnings-summary',
  ...requirePartnerEconomicsReadAccess,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.userId || req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
    }
    const partnerOrgId = await getBoundPartnerOrgId(req);
    if (!partnerOrgId) {
      return res.status(403).json({
        error: 'Partner organization required',
        code: 'PARTNER_ORG_REQUIRED',
      });
    }
    const [legacySummary, detail, payoutEligibility] = await Promise.all([
      PartnerCommissionService.getEarningsSummary(partnerOrgId),
      PartnerProgramLedgerService.getProgramStatusDetail(partnerOrgId, 'partner'),
      PartnerCommissionService.getPayoutEligibility(partnerOrgId),
    ]);
    const earnings = {
      totalEarned: detail.balances.grossEarned,
      totalPending: legacySummary.totalPending,
      totalApproved: legacySummary.totalApproved,
      totalPaid: detail.balances.paidOut,
      thisMonth: legacySummary.thisMonth,
      thisMonthCount: legacySummary.thisMonthCount,
      lastMonth: legacySummary.lastMonth,
      readyForPayout: detail.balances.availableToPayout,
      payoutEligibility,
      currency: detail.balances.currency || legacySummary.currency || 'EUR',
      lifecyclePhase: detail.runtime.lifecycle_phase,
      whatNext: detail.whatNext,
      hold: detail.hold,
      ...(detail.degraded ? { degraded: detail.degraded } : {}),
    };
    return res.json({
      data: { earnings },
      meta: { ...partnerProgramMeta(req, partnerOrgId), ...partnerEconomicsPolicyProjection() },
    });
  })
);

/**
 * GET /api/v8/partner/commission-transactions
 */
router.get(
  '/commission-transactions',
  ...requirePartnerEconomicsReadAccess,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.userId || req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
    }
    const partnerOrgId = await getBoundPartnerOrgId(req);
    if (!partnerOrgId) {
      return res.status(403).json({
        error: 'Partner organization required',
        code: 'PARTNER_ORG_REQUIRED',
      });
    }
    const transactions = await PartnerCommissionService.getCommissions(partnerOrgId, {
      status: typeof req.query.status === 'string' ? req.query.status : undefined,
      startDate: typeof req.query.startDate === 'string' ? req.query.startDate : undefined,
      endDate: typeof req.query.endDate === 'string' ? req.query.endDate : undefined,
      limit:
        typeof req.query.limit === 'string' && /^\d+$/.test(req.query.limit)
          ? parseInt(req.query.limit, 10)
          : 50,
      offset:
        typeof req.query.offset === 'string' && /^\d+$/.test(req.query.offset)
          ? parseInt(req.query.offset, 10)
          : 0,
    });
    return res.json({
      data: { transactions },
      meta: { ...partnerReadMeta(req, partnerOrgId), ...partnerEconomicsPolicyProjection() },
    });
  })
);

/**
 * GET /api/v8/partner/payouts
 */
router.get(
  '/payouts',
  ...requirePartnerEconomicsReadAccess,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.userId || req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
    }
    const partnerOrgId = await getBoundPartnerOrgId(req);
    if (!partnerOrgId) {
      return res.status(403).json({
        error: 'Partner organization required',
        code: 'PARTNER_ORG_REQUIRED',
      });
    }
    const payouts = await PartnerCommissionService.getPayouts(partnerOrgId, {
      status: typeof req.query.status === 'string' ? req.query.status : undefined,
      limit:
        typeof req.query.limit === 'string' && /^\d+$/.test(req.query.limit)
          ? parseInt(req.query.limit, 10)
          : 50,
      offset:
        typeof req.query.offset === 'string' && /^\d+$/.test(req.query.offset)
          ? parseInt(req.query.offset, 10)
          : 0,
    });
    return res.json({
      data: { payouts },
      meta: { ...partnerReadMeta(req, partnerOrgId), ...partnerEconomicsPolicyProjection() },
    });
  })
);

/**
 * POST /api/v8/partner/payouts/request
 */
router.post(
  '/payouts/request',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.userId || req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
    }
    const partnerOrgId = await getBoundPartnerOrgId(req);
    if (!partnerOrgId) {
      return res.status(403).json({
        error: 'Partner organization required',
        code: 'PARTNER_ORG_REQUIRED',
      });
    }
    const payoutSettings = await getPartnerPayoutSettings(partnerOrgId);
    if (!isPartnerPayoutDestinationComplete(payoutSettings)) {
      const detail = await PartnerProgramLedgerService.getProgramStatusDetail(
        partnerOrgId,
        'partner'
      );
      return res.status(409).json({
        error: 'Complete payout settings before requesting payout',
        code: 'P29_PAYOUT_SETTINGS_INCOMPLETE',
        whatNext: ['Uzupełnij payout settings i ponów żądanie payout.', ...detail.whatNext],
        meta: partnerProgramMeta(req, partnerOrgId),
      });
    }

    const detail = await PartnerProgramLedgerService.getProgramStatusDetail(
      partnerOrgId,
      'partner'
    );
    if (detail.runtime.lifecycle_phase === 'earn') {
      await PartnerProgramLedgerService.transitionLifecycle({
        partnerOrgId,
        toPhase: 'payout',
        actor: 'partner',
        actorId: userId,
        reason: typeof req.body?.notes === 'string' ? req.body.notes : 'Payout requested',
      });
    } else if (detail.runtime.lifecycle_phase !== 'payout') {
      return res.status(409).json({
        error: `Cannot request payout while lifecycle phase is ${detail.runtime.lifecycle_phase}`,
        code: 'P29_LIFECYCLE_INVALID',
        whatNext: detail.whatNext,
        meta: partnerProgramMeta(req, partnerOrgId),
      });
    }

    const payout = await PartnerCommissionService.requestPayout({
      partnerOrgId,
      payoutAccountId: req.body?.payoutAccountId,
      requestedBy: userId,
      notes: req.body?.notes,
      idempotencyKey:
        typeof req.body?.idempotencyKey === 'string' ? req.body.idempotencyKey.trim() : undefined,
    });
    if (!payout) {
      return res.status(400).json({
        error: 'No approved commissions available for payout or amount below threshold',
        code: 'PAYOUT_NOT_AVAILABLE',
      });
    }

    const updatedDetail = await PartnerProgramLedgerService.getProgramStatusDetail(
      partnerOrgId,
      'partner'
    );
    return res.status(201).json({
      data: {
        payout,
        lifecyclePhase: updatedDetail.runtime.lifecycle_phase,
        balances: updatedDetail.balances,
        whatNext: updatedDetail.whatNext,
        hold: updatedDetail.hold,
      },
      meta: partnerProgramMeta(req, partnerOrgId),
    });
  })
);

/**
 * POST /api/v8/partner/campaign-links
 */
router.post(
  '/campaign-links',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.userId || req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
    }
    const partnerOrgId = await getBoundPartnerOrgId(req);
    if (!partnerOrgId) {
      return res.status(403).json({
        error: 'Partner organization required',
        code: 'PARTNER_ORG_REQUIRED',
      });
    }
    const { name, description, utmSource, utmMedium, utmCampaign, utmContent, destinationUrl } =
      req.body ?? {};
    if (!name) {
      return res
        .status(400)
        .json({ error: 'Campaign name is required', code: 'CAMPAIGN_NAME_REQUIRED' });
    }
    const campaignLink = await PartnerReferralService.createCampaignLink({
      partnerOrgId,
      name,
      description,
      utmSource,
      utmMedium,
      utmCampaign,
      utmContent,
      destinationUrl,
    });
    return res.status(201).json({
      data: { campaignLink },
      meta: partnerReadMeta(req, partnerOrgId),
    });
  })
);

/**
 * DELETE /api/v8/partner/campaign-links/:linkId
 */
router.delete(
  '/campaign-links/:linkId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.userId || req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
    }
    const partnerOrgId = await getBoundPartnerOrgId(req);
    if (!partnerOrgId) {
      return res.status(403).json({
        error: 'Partner organization required',
        code: 'PARTNER_ORG_REQUIRED',
      });
    }
    const linkId = String(req.params.linkId || '');
    const deleted = await PartnerReferralService.deleteCampaignLink(partnerOrgId, linkId);
    if (!deleted) {
      return res
        .status(404)
        .json({ error: 'Campaign link not found', code: 'CAMPAIGN_LINK_NOT_FOUND' });
    }
    return res.json({
      data: { success: true, deleted: linkId },
      meta: partnerReadMeta(req, partnerOrgId),
    });
  })
);

/**
 * PUT /api/v8/partner/organization
 */
router.put(
  '/organization',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.userId || req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
    }
    const partnerOrgId = await getBoundPartnerOrgId(req);
    if (!partnerOrgId) {
      return res.status(403).json({
        error: 'Partner organization required',
        code: 'PARTNER_ORG_REQUIRED',
      });
    }
    const { contactPhone, website } = req.body ?? {};
    const ignoredFields = ['name', 'taxId', 'contactEmail'].filter(
      (field) => req.body?.[field] !== undefined
    );

    await DbPromise.run(
      getDatabase(),
      `UPDATE partner_organizations
       SET contact_phone = ?, website = ?, updated_at = NOW()
       WHERE id = ?`,
      [contactPhone || null, website || null, partnerOrgId]
    );

    return res.json({
      data: {
        success: true,
        message: 'Partner-program profile updated successfully',
        ignoredFields,
      },
      meta: partnerReadMeta(req, partnerOrgId),
    });
  })
);

/**
 * PUT /api/v8/partner/organization/specializations
 */
router.put(
  '/organization/specializations',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.userId || req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
    }
    const partnerOrgId = await getBoundPartnerOrgId(req);
    if (!partnerOrgId) {
      return res.status(403).json({
        error: 'Partner organization required',
        code: 'PARTNER_ORG_REQUIRED',
      });
    }
    const { specializations } = req.body ?? {};
    if (!Array.isArray(specializations)) {
      return res.status(400).json({
        error: 'specializations must be an array',
        code: 'PARTNER_SPECIALIZATIONS_ARRAY_REQUIRED',
      });
    }

    const uniqueFrameworks = Array.from(
      new Set(
        specializations
          .filter((s: unknown) => typeof s === 'string' && s.trim().length > 0)
          .map((s: string) => s.trim())
      )
    );

    const result = await DbPromise.transaction([
      {
        sql: `DELETE FROM partner_specializations WHERE partner_org_id = ?`,
        params: [partnerOrgId],
      },
      ...uniqueFrameworks.map((framework) => ({
        sql: `INSERT INTO partner_specializations (id, partner_org_id, framework, certified, created_at)
              VALUES (?, ?, ?, FALSE, NOW())
              ON CONFLICT (partner_org_id, framework) DO NOTHING`,
        params: [crypto.randomUUID(), partnerOrgId, framework],
      })),
    ]);

    if (!result.success) {
      return res.status(500).json({
        error: result.error || 'Failed to update specializations',
        code: 'PARTNER_SPECIALIZATIONS_UPDATE_FAILED',
      });
    }

    return res.json({
      data: { success: true, message: 'Specializations updated successfully' },
      meta: partnerReadMeta(req, partnerOrgId),
    });
  })
);

/**
 * PUT /api/v8/partner/organization/regions
 */
router.put(
  '/organization/regions',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.userId || req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
    }
    const partnerOrgId = await getBoundPartnerOrgId(req);
    if (!partnerOrgId) {
      return res.status(403).json({
        error: 'Partner organization required',
        code: 'PARTNER_ORG_REQUIRED',
      });
    }
    const { regions } = req.body ?? {};
    if (!Array.isArray(regions)) {
      return res.status(400).json({
        error: 'regions must be an array',
        code: 'PARTNER_REGIONS_ARRAY_REQUIRED',
      });
    }

    const uniqueRegions = Array.from(
      new Set(
        regions
          .filter((region: unknown) => typeof region === 'string' && region.trim().length > 0)
          .map((region: string) => region.trim())
      )
    );

    const result = await DbPromise.transaction([
      {
        sql: `DELETE FROM partner_regions WHERE partner_org_id = ?`,
        params: [partnerOrgId],
      },
      ...uniqueRegions.map((region) => ({
        sql: `INSERT INTO partner_regions (id, partner_org_id, region, is_primary, created_at)
              VALUES (?, ?, ?, FALSE, NOW())
              ON CONFLICT (partner_org_id, region) DO NOTHING`,
        params: [crypto.randomUUID(), partnerOrgId, region],
      })),
    ]);

    if (!result.success) {
      return res.status(500).json({
        error: result.error || 'Failed to update regions',
        code: 'PARTNER_REGIONS_UPDATE_FAILED',
      });
    }

    return res.json({
      data: { success: true, message: 'Regions updated successfully' },
      meta: partnerReadMeta(req, partnerOrgId),
    });
  })
);

/**
 * PUT /api/v8/partner/organization/listing
 */
router.put(
  '/organization/listing',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.userId || req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
    }
    const partnerOrgId = await getBoundPartnerOrgId(req);
    if (!partnerOrgId) {
      return res.status(403).json({
        error: 'Partner organization required',
        code: 'PARTNER_ORG_REQUIRED',
      });
    }
    const { publicListingEnabled } = req.body ?? {};
    if (typeof publicListingEnabled !== 'boolean') {
      return res.status(400).json({
        error: 'publicListingEnabled must be boolean',
        code: 'PUBLIC_LISTING_BOOLEAN_REQUIRED',
      });
    }

    await DbPromise.run(
      getDatabase(),
      `UPDATE partner_organizations
       SET public_listing_enabled = ?, updated_at = NOW()
       WHERE id = ?`,
      [publicListingEnabled, partnerOrgId]
    );

    return res.json({
      data: { success: true, publicListingEnabled },
      meta: partnerReadMeta(req, partnerOrgId),
    });
  })
);

router.post(
  '/certifications/:certId/modules/:moduleId/progress',
  requireActiveMembership,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const key = requireIdempotencyKey(req, res);
    if (!key) return;
    const actor = await certificationActor(req, res);
    if (!actor) return;
    const allowed = new Set(['not_started', 'in_progress', 'completed']);
    const status = allowed.has(req.body?.status) ? req.body.status : undefined;
    const progress = Number.isFinite(Number(req.body?.progress))
      ? Number(req.body.progress)
      : undefined;
    if (!status && progress === undefined) {
      return res
        .status(400)
        .json({ error: 'status or progress required', code: 'PROGRESS_REQUIRED' });
    }
    const data = await updateCertificationModuleProgress({
      certificationId: req.params.certId,
      moduleId: req.params.moduleId,
      ...actor,
      status,
      progress,
      idempotencyKey: key,
    });
    return res.json({ data, meta: partnerReadMeta(req, actor.partnerOrgId) });
  })
);

router.post(
  '/certifications/:certId/exam/start',
  requireActiveMembership,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const idempotencyKey = requireIdempotencyKey(req, res);
    if (!idempotencyKey) return;
    const actor = await certificationActor(req, res);
    if (!actor) return;
    const data = await startCertificationExam({
      certificationId: req.params.certId,
      ...actor,
      language: req.body?.language === 'pl' ? 'pl' : 'en',
      ip: String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || ''),
      userAgent: String(req.headers['user-agent'] || ''),
      idempotencyKey,
    });
    return res.json({ data, meta: partnerReadMeta(req, actor.partnerOrgId) });
  })
);

router.post(
  '/certifications/:certId/exam/submit',
  requireActiveMembership,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const idempotencyKey = requireIdempotencyKey(req, res);
    if (!idempotencyKey) return;
    const actor = await certificationActor(req, res);
    if (!actor) return;
    if (
      typeof req.body?.attemptId !== 'string' ||
      !req.body?.answers ||
      typeof req.body.answers !== 'object'
    ) {
      return res
        .status(400)
        .json({ error: 'attemptId and answers are required', code: 'EXAM_SUBMISSION_REQUIRED' });
    }
    const data = await submitCertificationExam({
      attemptId: req.body.attemptId,
      certificationId: req.params.certId,
      ...actor,
      answers: req.body.answers,
      idempotencyKey,
    });
    return res.json({ data, meta: partnerReadMeta(req, actor.partnerOrgId) });
  })
);

/** GET /api/v8/partner/payout-settings */
router.get(
  '/payout-settings',
  ...requirePartnerEconomicsReadAccess,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.userId || req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
    }
    const partnerOrgId = await getBoundPartnerOrgId(req);
    if (!partnerOrgId) {
      return res.status(403).json({
        error: 'Partner organization required',
        code: 'PARTNER_ORG_REQUIRED',
      });
    }

    const settings = await getPartnerPayoutSettings(partnerOrgId);
    return res.json({
      data: { settings },
      meta: { ...partnerReadMeta(req, partnerOrgId), ...partnerEconomicsPolicyProjection() },
    });
  })
);

/**
 * PUT /api/v8/partner/payout-settings
 */
router.put(
  '/payout-settings',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.userId || req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
    }
    const partnerOrgId = await getBoundPartnerOrgId(req);
    if (!partnerOrgId) {
      return res.status(403).json({
        error: 'Partner organization required',
        code: 'PARTNER_ORG_REQUIRED',
      });
    }

    const settings = await updatePartnerPayoutSettings(partnerOrgId, req.body ?? {});
    return res.json({
      data: { success: true, settings },
      meta: partnerReadMeta(req, partnerOrgId),
    });
  })
);

router.use((error: Error, _req: AuthRequest, res: Response, next: NextFunction) => {
  if (error instanceof PartnerConnectionError) {
    return res.status(error.status).json({ error: error.message, code: error.code });
  }
  if (error.message === 'Idempotency replay payload mismatch') {
    return res.status(409).json({
      error: error.message,
      code: 'IDEMPOTENCY_PAYLOAD_MISMATCH',
    });
  }
  next(error);
});

export default router;
