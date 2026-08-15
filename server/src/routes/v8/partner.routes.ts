/**
 * V8 read-only Partner bridge — data scoped by `partner_users.partner_org_id`.
 * Namespace: /api/v8/partner (mounted by v8/index before v8OrgGate).
 *
 * Auth model:
 * - Same auth/context stack as other V8 routes: JWT + `req.organizationId` tenant context.
 * - This bridge bypasses tenant-wide v8OrgGate because partner access is scoped
 *   by partner membership, not by the tenant-wide V8 rollout flag.
 * - Partner rows are loaded only for `partnerOrgId` from `getActivePartnerOrgIdForUser(userId)`.
 * - `v8TenantOrganizationId` in meta is the JWT org (V8 gate); it must not be used as partner scope.
 *
 * @module routes/v8/partner.routes
 */

import crypto from 'node:crypto';

import type { Response } from 'express';
import { Router } from 'express';

import { getDatabase } from '../../database/Database.js';
import type { AuthRequest } from '../../middleware/auth.middleware.js';
import { getV8Context } from '../../middleware/v8Auth.middleware.js';
import legalService from '../../services/legalService.js';
import PartnerCommissionService from '../../services/partnerCommissionService.js';
import { getActivePartnerOrgIdForUser } from '../../services/partnerOrgResolution.js';
import {
  getPartnerPayoutSettings,
  isPartnerPayoutDestinationComplete,
  updatePartnerPayoutSettings,
} from '../../services/partnerPayoutSettingsService.js';
import PartnerProgramLedgerService from '../../services/partnerProgramLedgerService.js';
import PartnerReferralService from '../../services/partnerReferralService.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import * as DbPromise from '../../utils/DbPromise.js';
import { ensureUserOnboardingStatusTable } from '../../utils/ensureUserOnboardingStatusTable.js';
import logger from '../../utils/Logger.js';

const router = Router();

export const V8_PARTNER_READ_CONTRACT = 'partner_runtime_read_v1';
export const V8_PARTNER_PROGRAM_CONTRACT = 'partner_program_p29_v1';

function payoutPolicyNotConfigured(res: Response) {
  return res.status(503).json({
    error: 'A versioned commission and payout policy must be published before payout mutations',
    code: 'PARTNER_PAYOUT_POLICY_NOT_CONFIGURED',
  });
}

function partnerReadMeta(req: AuthRequest, partnerOrgId: string) {
  const { organizationId } = getV8Context(req);
  return {
    version: 'v8' as const,
    contract: V8_PARTNER_READ_CONTRACT,
    partnerOrgId,
    v8TenantOrganizationId: organizationId,
  };
}

async function readPartnerConnection(partnerOrgId: string) {
  const db = getDatabase();
  const organization = await DbPromise.get<any>(
    db,
    `SELECT id, name, legal_name, tax_id, contact_email, contact_phone, website,
            tier, status, partner_since, license_discount_percent,
            commission_rate_percent, performance_score, public_listing_enabled
       FROM partner_organizations WHERE id = ? LIMIT 1`,
    [partnerOrgId]
  );
  if (!organization) return null;
  const [specializations, regions] = await Promise.all([
    DbPromise.all<{ framework: string }>(
      db,
      `SELECT framework FROM partner_specializations WHERE partner_org_id = ? ORDER BY framework`,
      [partnerOrgId]
    ),
    DbPromise.all<{ region: string }>(
      db,
      `SELECT region FROM partner_regions WHERE partner_org_id = ? ORDER BY region`,
      [partnerOrgId]
    ),
  ]);
  return {
    id: organization.id,
    name: organization.name,
    legalName: organization.legal_name || undefined,
    taxId: organization.tax_id || undefined,
    contactEmail: organization.contact_email,
    contactPhone: organization.contact_phone || undefined,
    website: organization.website || undefined,
    tier: organization.tier,
    status: organization.status,
    partnerSince: organization.partner_since || undefined,
    licenseDiscountPercent: organization.license_discount_percent ?? undefined,
    commissionRatePercent: organization.commission_rate_percent ?? undefined,
    performanceScore: organization.performance_score ?? undefined,
    publicListingEnabled: Boolean(organization.public_listing_enabled),
    specializations: specializations.map((item) => item.framework),
    regions: regions.map((item) => item.region),
  };
}

/** Canonical partner connection read. It never creates or seeds product data. */
router.get(
  '/connection',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.userId || req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
    const partnerOrgId = await getActivePartnerOrgIdForUser(userId);
    if (!partnerOrgId) {
      return res.json({
        data: {
          connected: false,
          selfConnectEnabled: process.env.PARTNER_SELF_CONNECT_ENABLED === 'true',
        },
        meta: { version: 'v8', contract: V8_PARTNER_READ_CONTRACT },
      });
    }
    const organization = await readPartnerConnection(partnerOrgId);
    return res.json({
      data: {
        connected: Boolean(organization),
        selfConnectEnabled: process.env.PARTNER_SELF_CONNECT_ENABLED === 'true',
        ...(organization ? { organization } : {}),
      },
      meta: partnerReadMeta(req, partnerOrgId),
    });
  })
);

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
 * GET /api/v8/partner/program/status
 * P29 single truth: lifecycle phase (runtime) + derived ledger balances
 */
router.get(
  '/program/status',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.userId || req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
    }
    const partnerOrgId = await getActivePartnerOrgIdForUser(userId);
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
      meta: partnerProgramMeta(req, partnerOrgId),
    });
  })
);

/**
 * GET /api/v8/partner/program/ledger
 */
router.get(
  '/program/ledger',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.userId || req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
    }
    const partnerOrgId = await getActivePartnerOrgIdForUser(userId);
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
      meta: partnerProgramMeta(req, partnerOrgId),
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
    const partnerOrgId = await getActivePartnerOrgIdForUser(userId);
    if (!partnerOrgId) {
      return res.status(403).json({
        error: 'Partner organization required',
        code: 'PARTNER_ORG_REQUIRED',
      });
    }
    const authorizedPartnerOrgId: string = partnerOrgId;
    return payoutPolicyNotConfigured(res);
    /* c8 ignore start -- re-enabled only after a versioned policy authority is published */
    try {
      const payoutSettings = await getPartnerPayoutSettings(authorizedPartnerOrgId);
      if (!isPartnerPayoutDestinationComplete(payoutSettings)) {
        let whatNext: string[] = [
          'Uzupełnij dane wypłaty: PUT /api/v8/partner/payout-settings (konto i metoda), potem ponów request fazy payout.',
        ];
        try {
          const d = await PartnerProgramLedgerService.getProgramStatusDetail(
            authorizedPartnerOrgId,
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
          meta: partnerProgramMeta(req, authorizedPartnerOrgId),
        });
      }
      const result = await PartnerProgramLedgerService.transitionLifecycle({
        partnerOrgId: authorizedPartnerOrgId,
        toPhase: 'payout',
        actor: 'partner',
        actorId: userId,
        reason: typeof req.body?.reason === 'string' ? req.body.reason : undefined,
      });
      return res.json({
        data: result,
        meta: partnerProgramMeta(req, authorizedPartnerOrgId),
      });
    } catch (e: any) {
      const code = e?.code || 'P29_LIFECYCLE_ERROR';
      let whatNext: string[] = [];
      if (code === 'P29_LIFECYCLE_INVALID' || code === 'P29_LIFECYCLE_FORBIDDEN') {
        try {
          const d = await PartnerProgramLedgerService.getProgramStatusDetail(
            authorizedPartnerOrgId,
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
    /* c8 ignore stop */
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
    const partnerOrgId = await getActivePartnerOrgIdForUser(userId);
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
    const partnerOrgId = await getActivePartnerOrgIdForUser(userId);
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
    const partnerOrgId = await getActivePartnerOrgIdForUser(userId);
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
    const partnerOrgId = await getActivePartnerOrgIdForUser(userId);
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
    const partnerOrgId = await getActivePartnerOrgIdForUser(userId);
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
    const partnerOrgId = await getActivePartnerOrgIdForUser(userId);
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
    const partnerOrgId = await getActivePartnerOrgIdForUser(userId);
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
    const partnerOrgId = await getActivePartnerOrgIdForUser(userId);
    if (!partnerOrgId) {
      return res.status(403).json({
        error: 'Partner organization required',
        code: 'PARTNER_ORG_REQUIRED',
      });
    }
    const tools = await PartnerReferralService.getReferralTools(partnerOrgId);
    const hasIdentity = (input: { referralCode?: string; referralLink?: string } | null) =>
      Boolean(String(input?.referralCode || '').trim() && String(input?.referralLink || '').trim());
    if (!tools || !hasIdentity(tools)) {
      return res.status(409).json({
        error: 'Partner referral identity has not been provisioned',
        code: 'PARTNER_REFERRAL_IDENTITY_REQUIRED',
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
    const partnerOrgId = await getActivePartnerOrgIdForUser(userId);
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
    const partnerOrgId = await getActivePartnerOrgIdForUser(userId);
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
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.userId || req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
    }
    const partnerOrgId = await getActivePartnerOrgIdForUser(userId);
    if (!partnerOrgId) {
      return res.status(403).json({
        error: 'Partner organization required',
        code: 'PARTNER_ORG_REQUIRED',
      });
    }
    const [legacySummary, detail] = await Promise.all([
      PartnerCommissionService.getEarningsSummary(partnerOrgId),
      PartnerProgramLedgerService.getProgramStatusDetail(partnerOrgId, 'partner'),
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
      currency: detail.balances.currency || legacySummary.currency || 'EUR',
      lifecyclePhase: detail.runtime.lifecycle_phase,
      whatNext: detail.whatNext,
      hold: detail.hold,
      ...(detail.degraded ? { degraded: detail.degraded } : {}),
    };
    return res.json({
      data: { earnings },
      meta: partnerProgramMeta(req, partnerOrgId),
    });
  })
);

/**
 * GET /api/v8/partner/commission-transactions
 */
router.get(
  '/commission-transactions',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.userId || req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
    }
    const partnerOrgId = await getActivePartnerOrgIdForUser(userId);
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
      meta: partnerReadMeta(req, partnerOrgId),
    });
  })
);

/**
 * GET /api/v8/partner/payouts
 */
router.get(
  '/payouts',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.userId || req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
    }
    const partnerOrgId = await getActivePartnerOrgIdForUser(userId);
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
      meta: partnerReadMeta(req, partnerOrgId),
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
    const partnerOrgId = await getActivePartnerOrgIdForUser(userId);
    if (!partnerOrgId) {
      return res.status(403).json({
        error: 'Partner organization required',
        code: 'PARTNER_ORG_REQUIRED',
      });
    }
    const authorizedPartnerOrgId: string = partnerOrgId;
    return payoutPolicyNotConfigured(res);
    /* c8 ignore start -- re-enabled only after a versioned policy authority is published */
    const payoutSettings = await getPartnerPayoutSettings(authorizedPartnerOrgId);
    if (!isPartnerPayoutDestinationComplete(payoutSettings)) {
      const detail = await PartnerProgramLedgerService.getProgramStatusDetail(
        authorizedPartnerOrgId,
        'partner'
      );
      return res.status(409).json({
        error: 'Complete payout settings before requesting payout',
        code: 'P29_PAYOUT_SETTINGS_INCOMPLETE',
        whatNext: ['Uzupełnij payout settings i ponów żądanie payout.', ...detail.whatNext],
        meta: partnerProgramMeta(req, authorizedPartnerOrgId),
      });
    }

    const detail = await PartnerProgramLedgerService.getProgramStatusDetail(
      authorizedPartnerOrgId,
      'partner'
    );
    if (detail.runtime.lifecycle_phase === 'earn') {
      await PartnerProgramLedgerService.transitionLifecycle({
        partnerOrgId: authorizedPartnerOrgId,
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
        meta: partnerProgramMeta(req, authorizedPartnerOrgId),
      });
    }

    const payout = await PartnerCommissionService.requestPayout({
      partnerOrgId: authorizedPartnerOrgId,
      payoutAccountId: req.body?.payoutAccountId,
      requestedBy: userId,
      notes: req.body?.notes,
    });
    if (!payout) {
      return res.status(400).json({
        error: 'No approved commissions available for payout or amount below threshold',
        code: 'PAYOUT_NOT_AVAILABLE',
      });
    }
    const requestedPayout = payout!;

    await PartnerProgramLedgerService.appendEntry({
      partnerOrgId: authorizedPartnerOrgId,
      entryType: 'payout.requested',
      amount: Number(requestedPayout.netAmount || requestedPayout.grossAmount || 0),
      currency: requestedPayout.currency || 'EUR',
      actor: 'partner',
      actorId: userId,
      idempotencyKey:
        typeof req.body?.idempotencyKey === 'string' && req.body.idempotencyKey.trim()
          ? req.body.idempotencyKey.trim()
          : `partner-payout-request:${requestedPayout.id}`,
      sourceRef: {
        payoutId: requestedPayout.id,
        payoutAccountId: req.body?.payoutAccountId || null,
        bridge: 'partner_commission_service',
      },
      note: typeof req.body?.notes === 'string' ? req.body.notes : null,
    });

    const updatedDetail = await PartnerProgramLedgerService.getProgramStatusDetail(
      authorizedPartnerOrgId,
      'partner'
    );
    return res.status(201).json({
      data: {
        payout: requestedPayout,
        lifecyclePhase: updatedDetail.runtime.lifecycle_phase,
        balances: updatedDetail.balances,
        whatNext: updatedDetail.whatNext,
        hold: updatedDetail.hold,
      },
      meta: partnerProgramMeta(req, authorizedPartnerOrgId),
    });
    /* c8 ignore stop */
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
    const partnerOrgId = await getActivePartnerOrgIdForUser(userId);
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
    const partnerOrgId = await getActivePartnerOrgIdForUser(userId);
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
    const partnerOrgId = await getActivePartnerOrgIdForUser(userId);
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
    const partnerOrgId = await getActivePartnerOrgIdForUser(userId);
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
    const partnerOrgId = await getActivePartnerOrgIdForUser(userId);
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
    const partnerOrgId = await getActivePartnerOrgIdForUser(userId);
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

/**
 * GET /api/v8/partner/payout-settings
 */
router.get(
  '/payout-settings',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.userId || req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
    }
    const partnerOrgId = await getActivePartnerOrgIdForUser(userId);
    if (!partnerOrgId) {
      return res.status(403).json({
        error: 'Partner organization required',
        code: 'PARTNER_ORG_REQUIRED',
      });
    }

    const settings = await getPartnerPayoutSettings(partnerOrgId);
    return res.json({
      data: { settings },
      meta: partnerReadMeta(req, partnerOrgId),
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
    const partnerOrgId = await getActivePartnerOrgIdForUser(userId);
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

export default router;
