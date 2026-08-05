// @ts-nocheck
/**
 * Partner Portal Routes
 *
 * API endpoints for Partner Portal module including:
 * - Partner organization management
 * - Referral codes & links (NEW)
 * - Attribution tracking (NEW)
 * - Client organizations
 * - Certifications & Learning
 * - Licenses & Billing
 * - Commissions & Payouts (NEW)
 * - Resources
 *
 * @module routes/partners
 */

import crypto from 'crypto';
import { NextFunction, Request, Response, Router } from 'express';

import { getDatabase } from '../database/Database.js';
import { verifyToken } from '../middleware/auth.middleware.js';
import { verifySuperAdmin } from '../middleware/superAdmin.middleware.js';
import {
  listPartnerApplications,
  reviewPartnerApplication,
} from '../services/partnerApplicationIntakeService.js';
import { generatePartnerCertificatePdf } from '../services/partnerCertificatePdf.js';
import {
  ensureLearningProgressRows,
  ensurePartnerCertificationMatrix,
  getCertificationBlueprints,
  getCertificationModules,
  getCertificationReviewQueue,
  getEffectivePartnerTier,
  getPartnerCertificationReporting,
  recalcCertificationProgress,
  startCertificationExam,
  submitCertificationExam,
  updateCertificationReviewState,
} from '../services/partnerCertificationService.js';
import PartnerCommissionService from '../services/partnerCommissionService.js';
import { ensurePartnerDemoDataset } from '../services/partnerDemoSeedService.js';
import { getActivePartnerOrgIdForUser } from '../services/partnerOrgResolution.js';
import {
  getPartnerPayoutSettings,
  updatePartnerPayoutSettings,
} from '../services/partnerPayoutSettingsService.js';
import PartnerProgramLedgerService from '../services/partnerProgramLedgerService.js';
import PartnerReferralService, {
  ensurePartnerReferralIdentity,
} from '../services/partnerReferralService.js';
import { generatePartnerToolkitResourceFile } from '../services/partnerToolkitResources.js';
import * as DbPromise from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

const router = Router();

function isSchemaMissingError(err: unknown): boolean {
  const msg = String((err as any)?.message || '').toLowerCase();
  return (
    msg.includes('no such table') || msg.includes('does not exist') || msg.includes('relation')
  );
}

const featureUnavailable = (res: Response, message: string) =>
  res.status(503).json({
    statusCode: 503,
    status: false,
    type: 'not_configured',
    message: message || 'Service temporarily unavailable due to missing configuration',
  });

// T7-be: stable 503 body for intentionally-unimplemented endpoints. The frontend
// (Agent F) detects code === 'FEATURE_NOT_AVAILABLE' to hide the action gracefully.
const featureNotAvailable = (res: Response, message: string) =>
  res.status(503).json({
    success: false,
    code: 'FEATURE_NOT_AVAILABLE',
    message: message || 'This feature is not available yet.',
  });

function resolvePayoutId(req: Request): string {
  return String(req.params.payoutId || req.body?.payoutId || '').trim();
}

function requireSensitivePayoutConfirmation(
  req: Request,
  res: Response,
  actionCode: 'P29_DUAL_CONTROL_REQUIRED' | 'P29_RECONCILIATION_CONFIRMATION_REQUIRED'
): { confirmed: boolean; reason: string } | null {
  const confirmation = Boolean(req.body?.confirmation);
  const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
  if (!confirmation || reason.length < 3) {
    res.status(428).json({
      success: false,
      error: 'Sensitive payout action requires explicit confirmation and reason',
      code: actionCode,
    });
    return null;
  }
  return { confirmed: true, reason };
}

type CanonicalTier = 'REGISTERED' | 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';
const TIER_ORDER: CanonicalTier[] = ['REGISTERED', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM'];
function tierRank(tier: string | null | undefined): number {
  if (!tier) return 0;
  const upper = String(tier).trim().toUpperCase();
  const idx = TIER_ORDER.indexOf(upper as CanonicalTier);
  if (idx >= 0) return idx;
  const legacy = String(tier).trim().toLowerCase();
  if (legacy === 'elite') return tierRank('PLATINUM');
  if (legacy === 'premier') return tierRank('GOLD');
  if (legacy === 'certified') return tierRank('SILVER');
  return tierRank('REGISTERED');
}

function looksPolish(req: Request): boolean {
  const al = String(req.headers['accept-language'] || '').toLowerCase();
  return al.includes('pl');
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let b = bytes;
  while (b >= 1024 && i < units.length - 1) {
    b /= 1024;
    i++;
  }
  const value = i === 0 ? Math.round(b) : Math.round(b * 10) / 10;
  return `${value} ${units[i]}`;
}

function resourceTypeLabel(mimeType?: string | null, fileType?: string | null): string {
  const v = String(mimeType || fileType || '').toLowerCase();
  if (v.includes('pdf')) return 'PDF';
  if (v.includes('presentation') || v.includes('pptx')) return 'PPTX';
  if (v.includes('zip')) return 'ZIP';
  if (v.includes('text')) return 'TXT';
  return 'FILE';
}

const hasReferralIdentity = (input: { referralCode?: string; referralLink?: string } | null) =>
  Boolean(String(input?.referralCode || '').trim() && String(input?.referralLink || '').trim());

async function normalizeReferralToolsForPartner(partnerOrgId: string, baseTools: any | null) {
  let orgName = '';
  try {
    const orgRow = await DbPromise.get<{ name?: string | null }>(
      getDatabase(),
      `SELECT name FROM partner_organizations WHERE id = ? LIMIT 1`,
      [partnerOrgId]
    );
    orgName = String(orgRow?.name || '').trim();
  } catch (error: any) {
    logger.warn('Referral tools: failed to read partner organization name', error?.message);
  }

  let ensuredIdentity: any = null;
  try {
    ensuredIdentity = await ensurePartnerReferralIdentity(partnerOrgId, orgName || undefined);
  } catch (error: any) {
    logger.warn('Referral tools: identity self-heal failed, using deterministic fallback', {
      partnerOrgId,
      error: error?.message,
    });
  }

  const prefix = String(orgName || 'partner')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '')
    .slice(0, 6);
  const fallbackCode = `${prefix || 'PARTNER'}-${String(partnerOrgId).slice(0, 4).toUpperCase()}`;
  const fallbackSlug = String(orgName || 'partner')
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
    ...baseTools,
    referralCode,
    referralLink:
      String(baseTools?.referralLink || '').trim() ||
      `${process.env.APP_BASE_URL || 'https://consultify.ai'}/r/${referralLinkSlug}`,
    referralLinkSlug,
    qrCodeUrl:
      String(baseTools?.qrCodeUrl || '').trim() ||
      `${process.env.APP_BASE_URL || 'https://consultify.ai'}/api/partner/qr/${referralLinkSlug}`,
    campaignLinks: Array.isArray(baseTools?.campaignLinks) ? baseTools.campaignLinks : [],
  };
}

async function requirePartnerOrgId(req: Request, res: Response): Promise<string | null> {
  const userId = (req as any).user?.id || (req as any).userId;
  if (!userId) {
    res.status(401).json({ success: false, error: 'Unauthorized' });
    return null;
  }
  const partnerOrgId = await getActivePartnerOrgIdForUser(userId);
  if (!partnerOrgId) {
    const hasPartnerUsersTable = await DbPromise.tableExists('partner_users');
    if (!hasPartnerUsersTable) {
      featureUnavailable(res, 'Partner access unavailable (database schema missing)');
      return null;
    }
    res.status(403).json({ success: false, error: 'Partner organization required' });
    return null;
  }
  await ensurePartnerDemoDataset(partnerOrgId);
  return partnerOrgId;
}

// Apply authentication to all routes
router.use(verifyToken);

// =============================================================================
// PARTNER CONNECTION (ONBOARDING)
// =============================================================================

/**
 * GET /api/partners/connection
 * Returns partner connection status without 403 gating.
 */
router.get('/connection', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id || (req as any).userId;
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    // T1-be: reflect the self-connect feature flag so the frontend can hide the
    // "Connect" button when self-service partner registration is disabled.
    const selfConnectEnabled = process.env.PARTNER_SELF_CONNECT_ENABLED === 'true';

    const partnerOrgId = await getActivePartnerOrgIdForUser(userId);
    if (!partnerOrgId) {
      return res.json({ success: true, data: { connected: false, selfConnectEnabled } });
    }

    const db = getDatabase();
    const org = await DbPromise.get<any>(
      db,
      `SELECT po.*
       FROM partner_organizations po
       WHERE po.id = ?
       LIMIT 1`,
      [partnerOrgId]
    );

    if (!org) {
      return res.json({ success: true, data: { connected: false, selfConnectEnabled } });
    }

    const [specializations, regions] = await Promise.all([
      DbPromise.all<{ framework: string }>(
        db,
        `SELECT framework FROM partner_specializations WHERE partner_org_id = ? ORDER BY framework ASC`,
        [org.id]
      ),
      DbPromise.all<{ region: string }>(
        db,
        `SELECT region FROM partner_regions WHERE partner_org_id = ? ORDER BY region ASC`,
        [org.id]
      ),
    ]);

    return res.json({
      success: true,
      data: {
        connected: true,
        selfConnectEnabled,
        organization: {
          id: org.id,
          name: org.name,
          legalName: org.legal_name || undefined,
          taxId: org.tax_id || undefined,
          contactEmail: org.contact_email,
          contactPhone: org.contact_phone || undefined,
          website: org.website || undefined,
          tier: org.tier,
          status: org.status,
          partnerSince: org.partner_since || undefined,
          licenseDiscountPercent:
            org.license_discount_percent != null ? Number(org.license_discount_percent) : undefined,
          commissionRatePercent:
            org.commission_rate_percent != null ? Number(org.commission_rate_percent) : undefined,
          performanceScore: org.performance_score ?? undefined,
          publicListingEnabled: Boolean(org.public_listing_enabled),
          specializations: specializations.map((s) => s.framework),
          regions: regions.map((r) => r.region),
        },
      },
    });
  } catch (error: any) {
    logger.error('Error fetching partner connection:', error);
    if (isSchemaMissingError(error)) {
      return featureUnavailable(res, 'Partner connection unavailable (database schema missing)');
    }
    next(error);
  }
});

/**
 * POST /api/partners/connect
 * Creates a partner organization and connects the current user (owner).
 * Idempotent: if already connected, returns existing connection.
 */
router.post('/connect', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id || (req as any).userId;
    const userEmail = String((req as any).user?.email || '').trim();
    const userName = String((req as any).user?.name || '').trim();
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const existingPartnerOrgId = await getActivePartnerOrgIdForUser(userId);
    if (existingPartnerOrgId) {
      await ensurePartnerDemoDataset(existingPartnerOrgId);
      const db = getDatabase();
      const org = await DbPromise.get<any>(
        db,
        `SELECT po.*
         FROM partner_organizations po
         WHERE po.id = ?
         LIMIT 1`,
        [existingPartnerOrgId]
      );
      if (!org) {
        return res.json({ success: true, data: { connected: false } });
      }

      const [specializations, regions] = await Promise.all([
        DbPromise.all<{ framework: string }>(
          db,
          `SELECT framework FROM partner_specializations WHERE partner_org_id = ? ORDER BY framework ASC`,
          [org.id]
        ),
        DbPromise.all<{ region: string }>(
          db,
          `SELECT region FROM partner_regions WHERE partner_org_id = ? ORDER BY region ASC`,
          [org.id]
        ),
      ]);

      return res.json({
        success: true,
        data: {
          connected: true,
          organization: {
            id: org.id,
            name: org.name,
            legalName: org.legal_name || undefined,
            taxId: org.tax_id || undefined,
            contactEmail: org.contact_email,
            contactPhone: org.contact_phone || undefined,
            website: org.website || undefined,
            tier: org.tier,
            status: org.status,
            partnerSince: org.partner_since || undefined,
            licenseDiscountPercent: org.license_discount_percent ?? undefined,
            commissionRatePercent: org.commission_rate_percent ?? undefined,
            performanceScore: org.performance_score ?? undefined,
            publicListingEnabled: Boolean(org.public_listing_enabled),
            specializations: specializations.map((s) => s.framework),
            regions: regions.map((r) => r.region),
          },
        },
      });
    }

    // T1-be: Lock self-service partner creation behind an explicit env flag.
    // Existing (already-connected) users above are unaffected; only NEW partner
    // org creation is gated. Flip PARTNER_SELF_CONNECT_ENABLED=true to allow.
    if (process.env.PARTNER_SELF_CONNECT_ENABLED !== 'true') {
      return res.status(403).json({
        success: false,
        code: 'PARTNER_SELF_CONNECT_DISABLED',
        message: 'Self-service partner registration is currently disabled.',
      });
    }

    const requestedName = String(req.body?.name || '').trim();
    const name = requestedName || (userName ? `${userName} — Partner` : 'Partner Organization');
    const contactEmail = String(req.body?.contactEmail || userEmail || '').trim();
    if (!contactEmail) {
      return res.status(400).json({ success: false, error: 'contactEmail is required' });
    }

    const partnerOrgId = crypto.randomUUID();
    const partnerUserId = crypto.randomUUID();
    const db = getDatabase();

    const result = await DbPromise.transaction([
      {
        sql: `INSERT INTO partner_organizations
              (id, name, contact_email, tier, status, partner_since, public_listing_enabled, created_at, updated_at, created_by, updated_by)
              VALUES (?, ?, ?, 'registered', 'active', NOW(), FALSE, NOW(), NOW(), ?, ?)`,
        params: [partnerOrgId, name, contactEmail, userId, userId],
      },
      {
        sql: `INSERT INTO partner_users
              (id, partner_org_id, user_id, role, status, joined_at, created_at, updated_at)
              VALUES (?, ?, ?, 'owner', 'active', NOW(), NOW(), NOW())`,
        params: [partnerUserId, partnerOrgId, userId],
      },
    ]);

    if (!result.success) {
      if (isSchemaMissingError(new Error(String(result.error || '')))) {
        return featureUnavailable(res, 'Partner connect unavailable (database schema missing)');
      }
      return res.status(500).json({ success: false, error: result.error || 'Failed to connect' });
    }

    const referralIdentity = await ensurePartnerReferralIdentity(partnerOrgId, name);
    await ensurePartnerDemoDataset(partnerOrgId);

    // Return connection info (connected: true)
    const org = await DbPromise.get<any>(
      db,
      `SELECT po.*
       FROM partner_organizations po
       WHERE po.id = ?
       LIMIT 1`,
      [partnerOrgId]
    );

    return res.status(201).json({
      success: true,
      data: {
        connected: true,
        organization: {
          id: org?.id || partnerOrgId,
          name: org?.name || name,
          legalName: org?.legal_name || undefined,
          taxId: org?.tax_id || undefined,
          contactEmail: org?.contact_email || contactEmail,
          contactPhone: org?.contact_phone || undefined,
          website: org?.website || undefined,
          tier: org?.tier || 'registered',
          status: org?.status || 'active',
          partnerSince: org?.partner_since || undefined,
          licenseDiscountPercent: org?.license_discount_percent ?? undefined,
          commissionRatePercent: org?.commission_rate_percent ?? undefined,
          performanceScore: org?.performance_score ?? undefined,
          publicListingEnabled: Boolean(org?.public_listing_enabled),
          referralCode: referralIdentity.referralCode,
          referralLinkSlug: referralIdentity.referralLinkSlug,
          specializations: [],
          regions: [],
        },
      },
    });
  } catch (error: any) {
    logger.error('Error connecting partner profile:', error);
    if (isSchemaMissingError(error)) {
      return featureUnavailable(res, 'Partner connect unavailable (database schema missing)');
    }
    next(error);
  }
});

/**
 * GET /api/partners/catalog
 * Canonical option lists for partner specialization frameworks and regions.
 * The backend has no dedicated enum/constant for partner specializations or
 * regions yet (partner_specializations / partner_regions store free-text
 * values), so this exposes a single canonical set for the frontend to choose
 * from. (Contract with Agent E.)
 * Guarded by the router-level verifyToken (router.use(verifyToken) above).
 */
const PARTNER_CATALOG_FRAMEWORKS: string[] = [
  'DRD',
  'SIRI',
  'ADMA',
  'LEAN 4.0',
  'PMBOK',
  'PRINCE2',
  'ISO 21500',
];

const PARTNER_CATALOG_REGIONS: string[] = [
  'DACH',
  'Nordics',
  'Benelux',
  'CEE',
  'UKI',
  'Southern Europe',
  'North America',
];

router.get('/catalog', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    return res.json({
      success: true,
      data: {
        frameworks: PARTNER_CATALOG_FRAMEWORKS,
        regions: PARTNER_CATALOG_REGIONS,
      },
    });
  } catch (error: any) {
    logger.error('Error fetching partner catalog:', error);
    next(error);
  }
});

// =============================================================================
// PARTNER ORGANIZATION ROUTES
// =============================================================================

/**
 * GET /api/partners/organization
 * Get current user's partner organization
 */
router.get('/organization', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id || (req as any).userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const db = getDatabase();
    const org = await DbPromise.get<any>(
      db,
      `SELECT po.*
       FROM partner_users pu
       JOIN partner_organizations po ON po.id = pu.partner_org_id
       WHERE pu.user_id = ? AND pu.status = 'active'
       LIMIT 1`,
      [userId],
      { fallback: false }
    );

    if (!org) {
      return res.status(403).json({ success: false, error: 'Partner organization required' });
    }

    const [specializations, regions] = await Promise.all([
      DbPromise.all<{ framework: string }>(
        db,
        `SELECT framework FROM partner_specializations WHERE partner_org_id = ? ORDER BY framework ASC`,
        [org.id]
      ),
      DbPromise.all<{ region: string }>(
        db,
        `SELECT region FROM partner_regions WHERE partner_org_id = ? ORDER BY region ASC`,
        [org.id]
      ),
    ]);

    return res.json({
      success: true,
      data: {
        id: org.id,
        name: org.name,
        legalName: org.legal_name || undefined,
        taxId: org.tax_id || undefined,
        contactEmail: org.contact_email,
        contactPhone: org.contact_phone || undefined,
        website: org.website || undefined,
        tier: org.tier,
        status: org.status,
        partnerSince: org.partner_since || undefined,
        licenseDiscountPercent: org.license_discount_percent ?? undefined,
        commissionRatePercent: org.commission_rate_percent ?? undefined,
        performanceScore: org.performance_score ?? undefined,
        publicListingEnabled: Boolean(org.public_listing_enabled),
        specializations: specializations.map((s) => s.framework),
        regions: regions.map((r) => r.region),
      },
    });
  } catch (error: any) {
    logger.error('Error fetching partner organization:', error);
    if (isSchemaMissingError(error)) {
      return featureUnavailable(res, 'Partner organization unavailable (database schema missing)');
    }
    next(error);
  }
});

/**
 * PUT /api/partners/organization
 * Update partner organization details
 */
router.put('/organization', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const partnerOrgId = await requirePartnerOrgId(req, res);
    if (!partnerOrgId) return;

    const { name, taxId, contactEmail, contactPhone, website } = req.body || {};
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ success: false, error: 'name is required' });
    }
    if (!contactEmail || typeof contactEmail !== 'string') {
      return res.status(400).json({ success: false, error: 'contactEmail is required' });
    }

    const db = getDatabase();
    await DbPromise.run(
      db,
      `UPDATE partner_organizations
       SET name = ?, tax_id = ?, contact_email = ?, contact_phone = ?, website = ?, updated_at = NOW()
       WHERE id = ?`,
      [name, taxId || null, contactEmail, contactPhone || null, website || null, partnerOrgId]
    );

    return res.json({ success: true, message: 'Organization updated successfully' });
  } catch (error: any) {
    logger.error('Error updating partner organization:', error);
    next(error);
  }
});

/**
 * PUT /api/partners/organization/specializations
 * Update partner specializations
 */
router.put(
  '/organization/specializations',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const partnerOrgId = await requirePartnerOrgId(req, res);
      if (!partnerOrgId) return;

      const { specializations } = req.body || {};
      if (!Array.isArray(specializations)) {
        return res.status(400).json({ success: false, error: 'specializations must be an array' });
      }

      const uniqueFrameworks = Array.from(
        new Set(
          specializations
            .filter((s: unknown) => typeof s === 'string' && s.trim().length > 0)
            .map((s: string) => s.trim())
        )
      );

      const statements = [
        {
          sql: `DELETE FROM partner_specializations WHERE partner_org_id = ?`,
          params: [partnerOrgId],
        },
        ...uniqueFrameworks.map((fw) => ({
          sql: `INSERT INTO partner_specializations (id, partner_org_id, framework, certified, created_at)
                VALUES (?, ?, ?, FALSE, NOW())
                ON CONFLICT (partner_org_id, framework) DO NOTHING`,
          params: [crypto.randomUUID(), partnerOrgId, fw],
        })),
      ];

      const result = await DbPromise.transaction(statements);
      if (!result.success) {
        return res.status(500).json({ success: false, error: result.error || 'Failed to update' });
      }

      return res.json({ success: true, message: 'Specializations updated successfully' });
    } catch (error: any) {
      logger.error('Error updating specializations:', error);
      next(error);
    }
  }
);

/**
 * PUT /api/partners/organization/regions
 * Update operating regions
 */
router.put('/organization/regions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const partnerOrgId = await requirePartnerOrgId(req, res);
    if (!partnerOrgId) return;

    const { regions } = req.body || {};
    if (!Array.isArray(regions)) {
      return res.status(400).json({ success: false, error: 'regions must be an array' });
    }

    const uniqueRegions = Array.from(
      new Set(
        regions
          .filter((r: unknown) => typeof r === 'string' && r.trim().length > 0)
          .map((r: string) => r.trim())
      )
    );

    const statements = [
      { sql: `DELETE FROM partner_regions WHERE partner_org_id = ?`, params: [partnerOrgId] },
      ...uniqueRegions.map((region) => ({
        sql: `INSERT INTO partner_regions (id, partner_org_id, region, is_primary, created_at)
              VALUES (?, ?, ?, FALSE, NOW())
              ON CONFLICT (partner_org_id, region) DO NOTHING`,
        params: [crypto.randomUUID(), partnerOrgId, region],
      })),
    ];

    const result = await DbPromise.transaction(statements);
    if (!result.success) {
      return res.status(500).json({ success: false, error: result.error || 'Failed to update' });
    }

    return res.json({ success: true, message: 'Regions updated successfully' });
  } catch (error: any) {
    logger.error('Error updating regions:', error);
    next(error);
  }
});

/**
 * PUT /api/partners/organization/listing
 * Update public listing settings
 */
router.put('/organization/listing', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const partnerOrgId = await requirePartnerOrgId(req, res);
    if (!partnerOrgId) return;

    const { publicListingEnabled } = req.body || {};
    if (typeof publicListingEnabled !== 'boolean') {
      return res
        .status(400)
        .json({ success: false, error: 'publicListingEnabled must be boolean' });
    }

    const db = getDatabase();
    await DbPromise.run(
      db,
      `UPDATE partner_organizations
       SET public_listing_enabled = ?, updated_at = NOW()
       WHERE id = ?`,
      [publicListingEnabled, partnerOrgId]
    );

    return res.json({ success: true, message: 'Listing updated successfully' });
  } catch (error: any) {
    logger.error('Error updating listing:', error);
    next(error);
  }
});

/**
 * GET /api/partners/payout-settings
 * Get partner-owned payout settings
 */
router.get('/payout-settings', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const partnerOrgId = await requirePartnerOrgId(req, res);
    if (!partnerOrgId) return;

    const settings = await getPartnerPayoutSettings(partnerOrgId);
    return res.json({ success: true, data: settings });
  } catch (error: any) {
    logger.error('Error fetching partner payout settings:', error);
    if (isSchemaMissingError(error)) {
      return featureUnavailable(
        res,
        'Partner payout settings unavailable (database schema missing)'
      );
    }
    next(error);
  }
});

/**
 * PUT /api/partners/payout-settings
 * Update partner-owned payout settings
 */
router.put('/payout-settings', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const partnerOrgId = await requirePartnerOrgId(req, res);
    if (!partnerOrgId) return;

    const settings = await updatePartnerPayoutSettings(partnerOrgId, req.body || {});
    return res.json({ success: true, data: settings });
  } catch (error: any) {
    logger.error('Error updating partner payout settings:', error);
    if (isSchemaMissingError(error)) {
      return featureUnavailable(
        res,
        'Partner payout settings unavailable (database schema missing)'
      );
    }
    next(error);
  }
});

// =============================================================================
// REFERRAL TOOLS ROUTES (NEW - Core Partner Referral System)
// =============================================================================

/**
 * GET /api/partners/referral-tools
 * Get partner's referral codes, links, and campaign links
 */
router.get('/referral-tools', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const partnerOrgId = await requirePartnerOrgId(req, res);
    if (!partnerOrgId) return;

    let tools: any = null;
    try {
      tools = await PartnerReferralService.getReferralTools(partnerOrgId);
    } catch (dbError: any) {
      logger.warn('Referral tools: DB query failed, using fallback data:', dbError?.message);
    }

    if (!tools || !hasReferralIdentity(tools)) {
      const normalizedTools = await normalizeReferralToolsForPartner(partnerOrgId, tools);
      return res.json({ success: true, data: normalizedTools });
    }

    res.json({ success: true, data: tools });
  } catch (error: any) {
    logger.error('Error fetching referral tools:', error);
    next(error);
  }
});

/**
 * POST /api/partners/campaign-links
 * Create a new campaign link with UTM parameters
 */
router.post('/campaign-links', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const partnerOrgId = await requirePartnerOrgId(req, res);
    if (!partnerOrgId) return;
    const { name, description, utmSource, utmMedium, utmCampaign, utmContent, destinationUrl } =
      req.body;
    const campaignName = String(name || '').trim();

    if (!campaignName) {
      return res.status(400).json({ success: false, error: 'Campaign name is required' });
    }

    const campaignLink = await PartnerReferralService.createCampaignLink({
      partnerOrgId,
      name: campaignName,
      description,
      utmSource,
      utmMedium,
      utmCampaign,
      utmContent,
      destinationUrl,
    });

    res.status(201).json({ success: true, data: campaignLink });
  } catch (error: any) {
    logger.error('Error creating campaign link:', error);
    next(error);
  }
});

/**
 * DELETE /api/partners/campaign-links/:linkId
 * Delete a campaign link
 */
router.delete(
  '/campaign-links/:linkId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const partnerOrgId = await requirePartnerOrgId(req, res);
      if (!partnerOrgId) return;
      const { linkId } = req.params;

      const deleted = await PartnerReferralService.deleteCampaignLink(partnerOrgId, linkId);

      if (!deleted) {
        return res.status(404).json({ success: false, error: 'Campaign link not found' });
      }

      res.json({ success: true, message: 'Campaign link deleted' });
    } catch (error: any) {
      logger.error('Error deleting campaign link:', error);
      next(error);
    }
  }
);

/**
 * GET /api/partners/referral-analytics
 * Get referral click and conversion analytics
 */
router.get('/referral-analytics', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const partnerOrgId = await requirePartnerOrgId(req, res);
    if (!partnerOrgId) return;
    const days = parseInt(req.query.days as string) || 30;

    let analytics;
    try {
      analytics = await PartnerReferralService.getReferralAnalytics(partnerOrgId, days);
    } catch (dbError: any) {
      logger.warn('Referral analytics: DB query failed, using fallback data:', dbError?.message);
      analytics = {
        totalClicks: 0,
        uniqueClicks: 0,
        signups: 0,
        conversions: 0,
        clicksByDay: [],
        topCampaigns: [],
      };
    }

    res.json({ success: true, data: analytics });
  } catch (error: any) {
    logger.error('Error fetching referral analytics:', error);
    next(error);
  }
});

/**
 * GET /api/partners/attributions
 * Get list of organizations attributed to this partner
 */
router.get('/attributions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const partnerOrgId = await requirePartnerOrgId(req, res);
    if (!partnerOrgId) return;
    const status = req.query.status as string | undefined;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    let attributions;
    try {
      attributions = await PartnerReferralService.getPartnerAttributions(partnerOrgId, {
        status: status as any,
        limit,
        offset,
      });
    } catch (dbError: any) {
      logger.warn('Attributions: DB query failed, using fallback data:', dbError?.message);
      attributions = { items: [], total: 0, limit, offset };
    }

    res.json({ success: true, data: attributions });
  } catch (error: any) {
    logger.error('Error fetching attributions:', error);
    next(error);
  }
});

// =============================================================================
// EARNINGS & PAYOUTS ROUTES (NEW - Commission System)
// =============================================================================

/**
 * GET /api/partners/earnings
 * @deprecated L-07 — DUPLIKAT v8. Kanon = `GET /api/v8/partner/earnings-summary`
 * (`v8/partner.routes.ts`), który zwraca P29 `lifecyclePhase`+`balances`. Ten legacy
 * endpoint zwraca uproszczone `commissionRate`-owe podsumowanie i jest utrzymany
 * WYŁĄCZNIE dopóki FE nie zmigruje 2 callerów (`PartnerRuntimeSummaryStrip.tsx:86`,
 * `EarningsSection.tsx:304`). Po migracji FE (grep `/api/partners/earnings` = 0) →
 * usunąć. Emituje nagłówki `Deprecation`/`Link`, żeby zużycie było widoczne w logach.
 */
router.get('/earnings', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const partnerOrgId = await requirePartnerOrgId(req, res);
    if (!partnerOrgId) return;

    // L-07: oznacz legacy surface jako deprecated (RFC 8594) — kanon to v8.
    res.setHeader('Deprecation', 'true');
    res.setHeader('Link', '</api/v8/partner/earnings-summary>; rel="successor-version"');

    let earnings;
    try {
      earnings = await PartnerCommissionService.getEarningsSummary(partnerOrgId);
    } catch (dbError: any) {
      logger.error('Earnings: DB query failed:', dbError?.message);
      return res
        .status(503)
        .json({ success: false, error: 'Earnings temporarily unavailable', code: 'DB_ERROR' });
    }

    res.json({ success: true, data: earnings });
  } catch (error: any) {
    logger.error('Error fetching earnings:', error);
    next(error);
  }
});

/**
 * GET /api/partners/commission-transactions
 * Get detailed commission transactions
 */
router.get('/commission-transactions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const partnerOrgId = await requirePartnerOrgId(req, res);
    if (!partnerOrgId) return;
    const status = req.query.status as string | undefined;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    let commissions;
    try {
      commissions = await PartnerCommissionService.getCommissions(partnerOrgId, {
        status: status as any,
        startDate,
        endDate,
        limit,
        offset,
      });
    } catch (dbError: any) {
      logger.warn(
        'Commission transactions: DB query failed, using fallback data:',
        dbError?.message
      );
      commissions = [];
    }

    res.json({ success: true, data: commissions });
  } catch (error: any) {
    logger.error('Error fetching commission transactions:', error);
    next(error);
  }
});

/**
 * POST /api/partners/payouts/request
 * Request a payout of approved commissions
 */
router.post('/payouts/request', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const partnerOrgId = await requirePartnerOrgId(req, res);
    if (!partnerOrgId) return;
    const userId = (req as any).user?.id;
    const { payoutAccountId, notes } = req.body;

    const payout = await PartnerCommissionService.requestPayout({
      partnerOrgId,
      payoutAccountId,
      requestedBy: userId,
      notes,
    });

    if (!payout) {
      return res.status(400).json({
        success: false,
        error: 'No approved commissions available for payout or amount below threshold',
      });
    }

    res.status(201).json({ success: true, data: payout });
  } catch (error: any) {
    logger.error('Error requesting payout:', error);
    next(error);
  }
});

/**
 * GET /api/partners/payouts
 * Get payout history
 */
router.get('/payouts', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // FIX (module 19 MVP): previously read `req.user?.partnerOrgId`, which the auth
    // middleware never sets, so this route was broken (403) for every caller.
    // Resolve the partner org from the DB like every other route in this file.
    const partnerOrgId = await requirePartnerOrgId(req, res);
    if (!partnerOrgId) return;
    const status = req.query.status as string | undefined;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    try {
      const payouts = await PartnerCommissionService.getPayouts(partnerOrgId, {
        status: status as any,
        limit,
        offset,
      });
      return res.json({ success: true, data: payouts });
    } catch (dbError: any) {
      logger.warn('Payouts: DB query failed:', dbError?.message);
      if (isSchemaMissingError(dbError)) {
        return featureUnavailable(
          res,
          'Partner payouts unavailable (database schema missing or misconfigured)'
        );
      }
      throw dbError;
    }
  } catch (error: any) {
    logger.error('Error fetching payouts:', error);
    next(error);
  }
});

// =============================================================================
// DASHBOARD & METRICS ROUTES
// =============================================================================

/**
 * GET /api/partners/dashboard
 * Get partner dashboard summary data
 * GAP-PARTNER-005: Connected to real database
 */
router.get('/dashboard', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Default fallback dashboard data
    const fallbackDashboard = {
      stats: {
        activeClients: 0,
        activeProjects: 0,
        certificationLevel: 'registered',
        monthlyRevenue: 0,
        revenueChange: 0,
        // licenses not yet tracked
        totalLicenses: 0,
        // licenses not yet tracked
        activeLicenses: 0,
        // licenses not yet tracked
        availableLicenses: 0,
      },
      recentActivity: [] as Array<{ type: string; text: string; time: string }>,
      // Honest zero. The real source of truth for certification progress is the
      // dedicated /api/partners/certifications endpoint; this summary card no
      // longer fabricates course completion data.
      certificationProgress: {
        completed: 0,
        total: 0,
        courses: [] as Array<{ name: string; status: string; progress?: number }>,
      },
    };

    // Try to load from database, fallback to demo data
    try {
      const partnerOrgId = await requirePartnerOrgId(req, res);
      if (!partnerOrgId) return;
      const { getDatabase } = await import('../database/Database.js');
      const db = getDatabase();
      const { get: dbGet, all: dbAll } = await import('../utils/DbPromise.js');

      const partnerOrg = await dbGet<{
        tier: string;
        status: string;
        commission_rate_percent: number;
      }>(
        db,
        `SELECT tier, status, commission_rate_percent FROM partner_organizations WHERE id = ?`,
        [partnerOrgId]
      );

      const clientStats = await dbGet<{ count: number }>(
        db,
        `SELECT COUNT(*) as count FROM partner_attributions WHERE partner_org_id = ? AND status = 'ACTIVE'`,
        [partnerOrgId]
      );

      const thisMonthRevenue = await dbGet<{ total: number }>(
        db,
        `SELECT COALESCE(SUM(gross_amount), 0) as total
               FROM partner_commission_transactions
               WHERE partner_org_id = ?
               AND transaction_date >= DATE_TRUNC('month', NOW())`,
        [partnerOrgId]
      );

      const lastMonthRevenue = await dbGet<{ total: number }>(
        db,
        `SELECT COALESCE(SUM(gross_amount), 0) as total
               FROM partner_commission_transactions
               WHERE partner_org_id = ?
               AND transaction_date >= DATE_TRUNC('month', NOW()) - INTERVAL '1 month'
               AND transaction_date < DATE_TRUNC('month', NOW())`,
        [partnerOrgId]
      );

      const currentRev = thisMonthRevenue?.total || 0;
      const lastRev = lastMonthRevenue?.total || 1;
      const revenueChange = lastRev > 0 ? Math.round(((currentRev - lastRev) / lastRev) * 100) : 0;

      const recentCommissions = await dbAll<{
        transaction_type: string;
        gross_amount: number;
        created_at: string;
      }>(
        db,
        `SELECT transaction_type, gross_amount, created_at 
               FROM partner_commission_transactions 
               WHERE partner_org_id = ? 
               ORDER BY created_at DESC 
               LIMIT 3`,
        [partnerOrgId]
      );

      const recentAttributions = await dbAll<{
        organization_id: string;
        attributed_at: string;
      }>(
        db,
        `SELECT pa.organization_id, pa.attributed_at, o.name as org_name
               FROM partner_attributions pa
               LEFT JOIN organizations o ON pa.organization_id = o.id
               WHERE pa.partner_org_id = ? 
               ORDER BY pa.attributed_at DESC 
               LIMIT 2`,
        [partnerOrgId]
      );

      const recentActivity: Array<{ type: string; text: string; time: string }> = [];

      for (const comm of recentCommissions || []) {
        const timeAgo = getTimeAgo(new Date(comm.created_at));
        recentActivity.push({
          type: 'commission',
          text: `Commission earned: €${Number(comm.gross_amount ?? 0).toFixed(2)} (${comm.transaction_type})`,
          time: timeAgo,
        });
      }

      for (const attr of (recentAttributions as any[]) || []) {
        const timeAgo = getTimeAgo(new Date(attr.attributed_at));
        recentActivity.push({
          type: 'client',
          text: `New referral: ${attr.org_name || 'Organization'}`,
          time: timeAgo,
        });
      }

      recentActivity.sort((a, b) => {
        const aTime = parseTimeAgo(a.time);
        const bTime = parseTimeAgo(b.time);
        return aTime - bTime;
      });

      fallbackDashboard.stats.activeClients = clientStats?.count || 0;
      fallbackDashboard.stats.certificationLevel = partnerOrg?.tier || 'registered';
      fallbackDashboard.stats.monthlyRevenue = Math.round(currentRev);
      fallbackDashboard.stats.revenueChange = revenueChange;
      fallbackDashboard.recentActivity = recentActivity.slice(0, 5);
    } catch (dbError: any) {
      if (isSchemaMissingError(dbError)) {
        return featureUnavailable(res, 'Partner dashboard unavailable (database schema missing)');
      }
      logger.warn('Dashboard: DB query failed, using fallback data:', dbError?.message);
    }

    res.json({ success: true, data: fallbackDashboard });
  } catch (error: any) {
    logger.error('Error fetching dashboard:', error);
    next(error);
  }
});

// Helper function to get time ago string
function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return `${Math.floor(diffDays / 7)}w ago`;
}

// Helper function to parse time ago for sorting
function parseTimeAgo(timeStr: string): number {
  const num = parseInt(timeStr);
  if (timeStr.includes('m')) return num;
  if (timeStr.includes('h')) return num * 60;
  if (timeStr.includes('d')) return num * 60 * 24;
  if (timeStr.includes('w')) return num * 60 * 24 * 7;
  return 9999;
}

/**
 * GET /api/partners/metrics
 * Referral funnel + earnings summary (same runtime services as V8 partner read bridge).
 */
router.get('/metrics', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id || (req as any).userId;
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const partnerOrgId = await getActivePartnerOrgIdForUser(userId);
    if (!partnerOrgId) {
      return res.status(403).json({ success: false, error: 'Partner organization required' });
    }

    const days = parseInt(req.query.days as string) || 30;
    const [referralAnalytics, earningsSummary] = await Promise.all([
      PartnerReferralService.getReferralAnalytics(partnerOrgId, days),
      PartnerCommissionService.getEarningsSummary(partnerOrgId),
    ]);

    return res.json({
      success: true,
      data: { partnerOrgId, days, referralAnalytics, earningsSummary },
    });
  } catch (error: any) {
    logger.error('Error fetching metrics:', error);
    if (isSchemaMissingError(error)) {
      return featureUnavailable(res, 'Partner metrics unavailable (database schema missing)');
    }
    next(error);
  }
});

// =============================================================================
// CLIENT ORGANIZATIONS ROUTES
// =============================================================================

/**
 * GET /api/partners/clients
 * Get list of client organizations
 */
router.get('/clients', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id || (req as any).userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const partnerOrgId = await getActivePartnerOrgIdForUser(userId);
    if (!partnerOrgId) {
      return res.status(403).json({ success: false, error: 'Partner organization required' });
    }

    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const clients = await PartnerReferralService.getPartnerClients(partnerOrgId, {
      status: status as any,
      limit,
      offset,
    });

    return res.json({ success: true, data: clients });
  } catch (error: any) {
    logger.error('Error fetching clients:', error);
    if (isSchemaMissingError(error)) {
      return featureUnavailable(res, 'Partner clients unavailable (database schema missing)');
    }
    next(error);
  }
});

/**
 * POST /api/partners/clients
 * Add new client organization
 */
router.post('/clients', async (req: Request, res: Response, next: NextFunction) => {
  try {
    return featureNotAvailable(res, 'Partner client creation is not available yet.');
  } catch (error: any) {
    logger.error('Error creating client:', error);
    next(error);
  }
});

/**
 * GET /api/partners/clients/:clientId
 * Get specific client details
 */
router.get('/clients/:clientId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    return featureNotAvailable(res, 'Partner client details are not available yet.');
  } catch (error: any) {
    logger.error('Error fetching client:', error);
    next(error);
  }
});

// =============================================================================
// EMPLOYEES ROUTES (Team Members with Client Access)
// =============================================================================

/**
 * GET /api/partners/employees
 * Get list of partner employees with client access
 */
router.get('/employees', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id || (req as any).userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const partnerOrgId = await getActivePartnerOrgIdForUser(userId);
    if (!partnerOrgId) {
      return res.status(403).json({ success: false, error: 'Partner organization required' });
    }

    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const employees = await PartnerReferralService.getPartnerEmployees(partnerOrgId, {
      status,
      limit,
      offset,
    });

    return res.json({ success: true, data: employees });
  } catch (error: any) {
    logger.error('Error fetching employees:', error);
    if (isSchemaMissingError(error)) {
      return featureUnavailable(res, 'Partner employees unavailable (database schema missing)');
    }
    next(error);
  }
});

/**
 * POST /api/partners/employees
 * Add new team member
 */
router.post('/employees', async (req: Request, res: Response, next: NextFunction) => {
  try {
    return featureNotAvailable(res, 'Partner employee creation is not available yet.');
  } catch (error: any) {
    logger.error('Error creating employee:', error);
    next(error);
  }
});

// =============================================================================
// STATS ROUTES
// =============================================================================

/**
 * GET /api/partners/stats
 * Get partner statistics summary
 */
router.get('/stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    return featureNotAvailable(res, 'Partner stats are not available yet.');
  } catch (error: any) {
    logger.error('Error fetching partner stats:', error);
    next(error);
  }
});

// =============================================================================
// ACCESS LINKS ROUTES
// =============================================================================

/**
 * POST /api/partners/access-links
 * Generate a new access link for client onboarding
 */
router.post('/access-links', async (req: Request, res: Response, next: NextFunction) => {
  try {
    return featureNotAvailable(res, 'Partner access links are not available yet.');
  } catch (error: any) {
    logger.error('Error generating access link:', error);
    next(error);
  }
});

// =============================================================================
// PROJECTS ROUTES
// =============================================================================

/**
 * GET /api/partners/projects
 * Get list of partner projects
 */
router.get('/projects', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id || (req as any).userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const partnerOrgId = await getActivePartnerOrgIdForUser(userId);
    if (!partnerOrgId) {
      return res.status(403).json({ success: false, error: 'Partner organization required' });
    }

    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const projects = await PartnerReferralService.getPartnerProjects(partnerOrgId, {
      limit,
      offset,
    });

    return res.json({ success: true, data: projects });
  } catch (error: any) {
    logger.error('Error fetching projects:', error);
    if (isSchemaMissingError(error)) {
      return featureUnavailable(res, 'Partner projects unavailable (database schema missing)');
    }
    next(error);
  }
});

// =============================================================================
// CERTIFICATION & LEARNING ROUTES
// =============================================================================

/**
 * GET /api/partners/certifications
 * Get partner certifications status
 */
router.get('/certifications', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const partnerOrgId = await requirePartnerOrgId(req, res);
    if (!partnerOrgId) return;
    const userId = (req as any).user?.id || (req as any).userId;
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const language = looksPolish(req) ? 'pl' : 'en';
    const blueprints = getCertificationBlueprints();
    const seeded = await ensurePartnerCertificationMatrix({ partnerOrgId, userId, language });
    const db = getDatabase();

    await Promise.all(
      seeded.map(async (row) => {
        const modules = await getCertificationModules(row.certification_type, language);
        await ensureLearningProgressRows({
          certificationId: row.id,
          moduleIds: modules.map((module) => module.id),
        });
        await recalcCertificationProgress(row.id);
      })
    );

    const currentRows = await DbPromise.all<any>(
      db,
      `SELECT * FROM partner_certifications
       WHERE partner_org_id = ? AND user_id = ?`,
      [partnerOrgId, userId]
    );
    const currentByType = new Map(currentRows.map((item: any) => [item.certification_type, item]));

    const certifications = await Promise.all(
      currentRows.map(async (updated) => {
        const modules = await getCertificationModules(updated.certification_type, language);
        const progressRows = await DbPromise.all<any>(
          db,
          `SELECT module_id, status, progress_percent, started_at, completed_at
           FROM partner_learning_progress
           WHERE certification_id = ?`,
          [updated.id]
        );
        const completedModules = progressRows.filter((item) => item.status === 'completed').length;

        const blueprint = blueprints.find((item) => item.type === updated.certification_type);
        const prerequisiteBlocked = (blueprint?.prerequisiteTypes || []).some((type) => {
          const prerequisite = currentByType.get(type);
          return (
            String(prerequisite?.status || '') !== 'completed' && !prerequisite?.certificate_id
          );
        });

        const totalMinutes = modules.reduce((sum, module) => {
          const value = Number(module.minutes ?? module.duration_minutes ?? 0);
          return sum + (Number.isFinite(value) ? value : 0);
        }, 0);
        const hours = Math.floor(totalMinutes / 60);
        const mins = totalMinutes % 60;
        const duration = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
        const reviewState = updated.review_state || undefined;
        const examMode = updated.exam_mode || blueprint?.examMode || 'exam';
        const examEligible =
          !prerequisiteBlocked &&
          examMode === 'exam' &&
          Number(updated.progress_percent || 0) >= 100 &&
          !updated.certificate_id;
        const needsReview =
          !prerequisiteBlocked &&
          examMode === 'review' &&
          Number(updated.progress_percent || 0) >= 100 &&
          !updated.certificate_id;
        const blockedReason = prerequisiteBlocked
          ? 'prerequisite_incomplete'
          : Number(updated.progress_percent || 0) < 100
            ? 'academy_incomplete'
            : needsReview && reviewState !== 'approved'
              ? 'review_pending'
              : null;

        return {
          id: updated.id,
          name: updated.certification_name || blueprint?.titleEn || updated.certification_type,
          type: updated.certification_type,
          track: updated.certification_track || blueprint?.track || null,
          level: updated.certification_level || blueprint?.level || null,
          status: updated.status || 'not_started',
          progress: updated.progress_percent || 0,
          duration,
          modules: modules.length,
          completedModules,
          startedAt: updated.started_at || undefined,
          completedAt: updated.completed_at || undefined,
          certificateId: updated.certificate_id || undefined,
          certificateUrl: updated.certificate_url || undefined,
          examMode,
          examEligible,
          reviewState,
          needsReview,
          targetTier: updated.tier_target || blueprint?.targetTier || null,
          validUntil: updated.valid_until || undefined,
          publicArticleSlug:
            updated.public_article_slug || blueprint?.publicArticleSlug || undefined,
          lifecycleStep: updated.partner_lifecycle_step || blueprint?.lifecycleStep || undefined,
          prerequisiteTypes: blueprint?.prerequisiteTypes || [],
          blockedReason,
        };
      })
    );

    return res.json({ success: true, data: certifications });
  } catch (error: any) {
    logger.error('Error fetching certifications:', error);
    next(error);
  }
});

/**
 * GET /api/partners/certifications/:certId/modules
 * Get modules for a certification
 */
router.get(
  '/certifications/:certId/modules',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const partnerOrgId = await requirePartnerOrgId(req, res);
      if (!partnerOrgId) return;
      const userId = (req as any).user?.id || (req as any).userId;
      if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

      const { certId } = req.params;
      const db = getDatabase();
      const cert = await DbPromise.get<any>(
        db,
        `SELECT * FROM partner_certifications WHERE id = ? AND partner_org_id = ? AND user_id = ?`,
        [certId, partnerOrgId, userId]
      );
      if (!cert) return res.status(404).json({ success: false, error: 'Certification not found' });

      const language = looksPolish(req) ? 'pl' : 'en';
      const modules = await getCertificationModules(cert.certification_type, language);
      await ensureLearningProgressRows({
        certificationId: certId,
        moduleIds: modules.map((m) => m.id),
      });

      const progressRows = await DbPromise.all<any>(
        db,
        `SELECT module_id, status, progress_percent, started_at, completed_at
         FROM partner_learning_progress
         WHERE certification_id = ?`,
        [certId]
      );
      const progressByModule = new Map(progressRows.map((r: any) => [r.module_id, r]));

      return res.json({
        success: true,
        data: modules.map((m) => {
          const p = progressByModule.get(m.id);
          return {
            id: m.id,
            name: m.name,
            description: m.description || null,
            order: m.module_order,
            minutes: m.minutes ?? m.duration_minutes ?? null,
            contentType: m.content_type || null,
            moduleKind: m.module_kind || 'lesson',
            articleSlug: m.resource_article_slug || null,
            articleLabel: m.resource_label || null,
            lifecycleStep: m.partner_lifecycle_step || null,
            ownerRole: m.owner_role || null,
            reviewRequired: Boolean(m.review_required),
            status: p?.status || 'not_started',
            progress: p?.progress_percent || 0,
            startedAt: p?.started_at || null,
            completedAt: p?.completed_at || null,
          };
        }),
      });
    } catch (error: any) {
      logger.error('Error fetching modules:', error);
      next(error);
    }
  }
);

/**
 * POST /api/partners/certifications/:certId/modules/:moduleId/progress
 * Update module progress
 */
router.post(
  '/certifications/:certId/modules/:moduleId/progress',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const partnerOrgId = await requirePartnerOrgId(req, res);
      if (!partnerOrgId) return;
      const userId = (req as any).user?.id || (req as any).userId;
      if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

      const { certId, moduleId } = req.params;
      const { status, progress } = req.body || {};

      const allowedStatus = new Set(['not_started', 'in_progress', 'completed']);
      const nextStatus = allowedStatus.has(status) ? status : null;
      const nextProgress = Number.isFinite(Number(progress))
        ? Math.max(0, Math.min(100, Number(progress)))
        : null;
      if (!nextStatus && nextProgress === null) {
        return res.status(400).json({ success: false, error: 'status or progress required' });
      }

      const db = getDatabase();
      const cert = await DbPromise.get<any>(
        db,
        `SELECT id FROM partner_certifications WHERE id = ? AND partner_org_id = ? AND user_id = ?`,
        [certId, partnerOrgId, userId]
      );
      if (!cert) return res.status(404).json({ success: false, error: 'Certification not found' });

      const certification = await DbPromise.get<any>(
        db,
        `SELECT certification_type FROM partner_certifications WHERE id = ?`,
        [certId]
      );
      const language = looksPolish(req) ? 'pl' : 'en';
      const validModules = await getCertificationModules(
        certification?.certification_type,
        language
      );
      if (!validModules.some((module) => module.id === moduleId)) {
        return res
          .status(404)
          .json({ success: false, error: 'Module not found for certification' });
      }

      await DbPromise.run(
        db,
        `INSERT INTO partner_learning_progress (id, certification_id, module_id, status, progress_percent, started_at, updated_at)
         VALUES (?, ?, ?, ?, ?, NOW(), NOW())
         ON CONFLICT (certification_id, module_id)
         DO UPDATE SET status = COALESCE(?, partner_learning_progress.status),
                       progress_percent = COALESCE(?, partner_learning_progress.progress_percent),
                       started_at = COALESCE(partner_learning_progress.started_at, NOW()),
                       completed_at = CASE WHEN COALESCE(?, partner_learning_progress.status) = 'completed'
                                           THEN COALESCE(partner_learning_progress.completed_at, NOW())
                                           ELSE partner_learning_progress.completed_at END,
                       updated_at = NOW()`,
        [
          crypto.randomUUID(),
          certId,
          moduleId,
          nextStatus || 'in_progress',
          nextProgress ?? 0,
          nextStatus,
          nextProgress,
          nextStatus,
        ]
      );

      await recalcCertificationProgress(certId);
      return res.json({ success: true });
    } catch (error: any) {
      logger.error('Error updating progress:', error);
      next(error);
    }
  }
);

/**
 * POST /api/partners/certifications/:certId/exam/start
 */
router.post(
  '/certifications/:certId/exam/start',
  async (req: Request, res: Response, _next: NextFunction) => {
    try {
      const partnerOrgId = await requirePartnerOrgId(req, res);
      if (!partnerOrgId) return;
      const userId = (req as any).user?.id || (req as any).userId;
      if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

      const { certId } = req.params;
      const language = req.body?.language === 'pl' || looksPolish(req) ? 'pl' : 'en';
      const ip = String((req.headers['x-forwarded-for'] as any) || req.socket.remoteAddress || '');
      const userAgent = String(req.headers['user-agent'] || '');

      const attempt = await startCertificationExam({
        certificationId: certId,
        partnerOrgId,
        userId,
        language,
        ip,
        userAgent,
      });

      return res.json({ success: true, data: attempt });
    } catch (error: any) {
      logger.error('Error starting exam:', error);
      return res
        .status(400)
        .json({ success: false, error: error?.message || 'Failed to start exam' });
    }
  }
);

/**
 * POST /api/partners/certifications/:certId/exam/submit
 */
router.post(
  '/certifications/:certId/exam/submit',
  async (req: Request, res: Response, _next: NextFunction) => {
    try {
      const partnerOrgId = await requirePartnerOrgId(req, res);
      if (!partnerOrgId) return;
      const userId = (req as any).user?.id || (req as any).userId;
      if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

      const { certId } = req.params;
      const { attemptId, answers } = req.body || {};
      if (!attemptId || typeof attemptId !== 'string') {
        return res.status(400).json({ success: false, error: 'attemptId is required' });
      }
      if (!answers || typeof answers !== 'object') {
        return res.status(400).json({ success: false, error: 'answers is required' });
      }

      const result = await submitCertificationExam({
        attemptId,
        certificationId: certId,
        partnerOrgId,
        userId,
        answers,
      });
      return res.json({ success: true, data: result });
    } catch (error: any) {
      logger.error('Error submitting exam:', error);
      return res
        .status(400)
        .json({ success: false, error: error?.message || 'Failed to submit exam' });
    }
  }
);

/**
 * GET /api/partners/certificates/:certificateId/download
 */
router.get(
  '/certificates/:certificateId/download',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const partnerOrgId = await requirePartnerOrgId(req, res);
      if (!partnerOrgId) return;
      const userId = (req as any).user?.id || (req as any).userId;
      if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

      const { certificateId } = req.params;
      const db = getDatabase();
      const cert = await DbPromise.get<any>(
        db,
        `SELECT pc.id, pc.certificate_type, pc.earned_at, po.name as partner_org_name
         FROM partner_certificates pc
         JOIN partner_organizations po ON po.id = pc.partner_org_id
         WHERE pc.id = ? AND pc.partner_org_id = ? AND pc.user_id = ?`,
        [certificateId, partnerOrgId, userId]
      );
      if (!cert) return res.status(404).json({ success: false, error: 'Certificate not found' });

      const pdf = await generatePartnerCertificatePdf({
        certificateId: cert.id,
        partnerOrgName: cert.partner_org_name || 'Partner',
        userName: (req as any).user?.name || 'User',
        certificateType: cert.certificate_type || 'sales',
        earnedAt: cert.earned_at || new Date().toISOString(),
        language: looksPolish(req) ? 'pl' : 'en',
      });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="partner-certificate-${certificateId}.pdf"`
      );
      return res.status(200).send(pdf);
    } catch (error: any) {
      logger.error('Error downloading certificate:', error);
      next(error);
    }
  }
);

// =============================================================================
// LICENSES ROUTES
// =============================================================================

/**
 * GET /api/partners/licenses
 * Get partner license allocations
 */
router.get('/licenses', async (req: Request, res: Response, next: NextFunction) => {
  try {
    return featureUnavailable(res, 'Partner licenses unavailable (no real implementation)');
  } catch (error: any) {
    logger.error('Error fetching licenses:', error);
    next(error);
  }
});

/**
 * POST /api/partners/licenses/order
 * Order additional licenses
 */
router.post('/licenses/order', async (req: Request, res: Response, next: NextFunction) => {
  try {
    return featureUnavailable(res, 'Partner license ordering unavailable (no real implementation)');
  } catch (error: any) {
    logger.error('Error ordering licenses:', error);
    next(error);
  }
});

// =============================================================================
// COMMISSIONS ROUTES
// =============================================================================

/**
 * GET /api/partners/commissions
 * Commission transactions for the authenticated partner org (read-only).
 */
router.get('/commissions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id || (req as any).userId;
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const partnerOrgId = await getActivePartnerOrgIdForUser(userId);
    if (!partnerOrgId) {
      return res.status(403).json({ success: false, error: 'Partner organization required' });
    }

    const status = req.query.status as string | undefined;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const commissions = await PartnerCommissionService.getCommissions(partnerOrgId, {
      status: status as any,
      startDate,
      endDate,
      limit,
      offset,
    });

    return res.json({ success: true, data: commissions });
  } catch (error: any) {
    logger.error('Error fetching commissions:', error);
    if (isSchemaMissingError(error)) {
      return featureUnavailable(res, 'Partner commissions unavailable (database schema missing)');
    }
    next(error);
  }
});

// =============================================================================
// INVOICES ROUTES
// =============================================================================

/**
 * GET /api/partners/invoices
 * Get partner invoices
 */
router.get('/invoices', async (req: Request, res: Response, next: NextFunction) => {
  try {
    return featureUnavailable(res, 'Partner invoices unavailable (no real implementation)');
  } catch (error: any) {
    logger.error('Error fetching invoices:', error);
    next(error);
  }
});

/**
 * GET /api/partners/invoices/:invoiceId/download
 * Download invoice PDF
 */
router.get(
  '/invoices/:invoiceId/download',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      return featureUnavailable(
        res,
        'Partner invoice downloads unavailable (no real implementation)'
      );
    } catch (error: any) {
      logger.error('Error downloading invoice:', error);
      next(error);
    }
  }
);

// =============================================================================
// RESOURCES ROUTES
// =============================================================================

/**
 * GET /api/partners/resources
 * Get partner resources
 */
router.get('/resources', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const partnerOrgId = await requirePartnerOrgId(req, res);
    if (!partnerOrgId) return;
    const userId = (req as any).user?.id || (req as any).userId;
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const db = getDatabase();
    const partnerTier = await getEffectivePartnerTier(partnerOrgId);
    const language = looksPolish(req) ? 'pl' : 'en';
    const certifications = await ensurePartnerCertificationMatrix({
      partnerOrgId,
      userId,
      language,
    });

    // M16 — an empty list must mean "no resources", never "the query blew up".
    //
    // `DbPromise.all` defaults to `fallback: true`, i.e. it swallows SQL errors
    // and returns []. Combined with the full projection below — which names
    // `file_key`/`file_name`/`mime_type`/`size_bytes`, columns that migration
    // 555 adds but that are absent on demo — every category rendered empty
    // while `partner_resources` held 15 active rows. We now run with
    // `fallback: false` and classify the failure instead of hiding it.
    //
    // Order: full projection → compat projection (schema before 555) → degraded.
    const RESOURCE_COLUMNS_FULL = `id, title, category, file_type, file_size_bytes, min_partner_tier,
              file_key, file_name, mime_type, size_bytes`;
    const RESOURCE_COLUMNS_COMPAT = `id, title, category, file_type, file_size_bytes, min_partner_tier`;
    const selectResources = (columns: string) =>
      DbPromise.all<any>(
        db,
        `SELECT ${columns}
       FROM partner_resources
       WHERE is_active = TRUE
       ORDER BY category ASC, title ASC`,
        [],
        { fallback: false }
      );

    let rows: any[] = [];
    let capability: 'FULL' | 'DEGRADED_SCHEMA' | 'DEGRADED_UNAVAILABLE' = 'FULL';
    let capabilityCode: string | null = null;
    let capabilityDetail: string | null = null;

    try {
      rows = await selectResources(RESOURCE_COLUMNS_FULL);
    } catch (fullErr: any) {
      try {
        rows = await selectResources(RESOURCE_COLUMNS_COMPAT);
        capability = 'DEGRADED_SCHEMA';
        capabilityCode = 'PARTNER_RESOURCES_SCHEMA_BEHIND';
        capabilityDetail = String(fullErr?.message || fullErr);
        logger.warn(
          '[partners] partner_resources full projection unavailable — serving compat read',
          { detail: capabilityDetail }
        );
      } catch (compatErr: any) {
        capability = 'DEGRADED_UNAVAILABLE';
        capabilityCode = 'PARTNER_RESOURCES_UNAVAILABLE';
        capabilityDetail = String(compatErr?.message || compatErr);
        logger.error('[partners] partner_resources unreadable', { detail: capabilityDetail });
      }
    }

    const grouped = {
      documentation: [] as any[],
      marketing: [] as any[],
      caseStudies: [] as any[],
      templates: [] as any[],
      docsBridge: [
        {
          id: 'partner-doc-overview',
          title: language === 'pl' ? 'Overview programu' : 'Program overview',
          href: '/docs/consultify-partner-program/partner-program-overview',
          kind: 'public_doc',
        },
        {
          id: 'partner-doc-application',
          title: language === 'pl' ? 'Partner application flow' : 'Application flow',
          href: '/docs/consultify-partner-program/partner-application-flow',
          kind: 'public_doc',
        },
        {
          id: 'partner-doc-payouts',
          title:
            language === 'pl' ? 'Activation i payout readiness' : 'Activation and payout readiness',
          href: '/docs/consultify-partner-operations/partner-payout-and-activation',
          kind: 'public_doc',
        },
        {
          id: 'partner-doc-certification',
          title: language === 'pl' ? 'Academy i certyfikacja' : 'Academy and certification',
          href: '/docs/consultify-partner-operations/partner-certification-explainer',
          kind: 'public_doc',
        },
      ],
      academyHighlights: certifications.map((item) => ({
        id: item.id,
        type: item.certification_type,
        track: item.certification_track,
        level: item.certification_level,
        status: item.status,
        progress: item.progress_percent || 0,
        reviewState: item.review_state || null,
        articleSlug: item.public_article_slug || null,
      })),
    };

    for (const r of rows) {
      if (tierRank(partnerTier) < tierRank(r.min_partner_tier)) continue;
      const bytes = Number(r.size_bytes ?? r.file_size_bytes ?? 0);
      const item = {
        id: r.id,
        title: r.title,
        type: resourceTypeLabel(r.mime_type, r.file_type),
        size: formatBytes(Number.isFinite(bytes) ? bytes : 0),
        category: r.category,
      };

      if (r.category === 'marketing') grouped.marketing.push(item);
      else if (r.category === 'documentation') grouped.documentation.push(item);
      else if (r.category === 'case_study') grouped.caseStudies.push(item);
      else if (r.category === 'template') grouped.templates.push(item);
      else grouped.documentation.push(item);
    }

    // The UI must be able to tell EMPTY from DEGRADED_UNAVAILABLE. `capability`
    // is the contract for that; `resourcesReadable` is false only when we could
    // not read the catalogue at all, so a truly empty catalogue still reads as
    // an honest empty state.
    return res.json({
      success: true,
      data: {
        ...grouped,
        capability,
        capabilityCode,
        resourcesReadable: capability !== 'DEGRADED_UNAVAILABLE',
        ...(capabilityDetail && process.env.NODE_ENV !== 'production'
          ? { capabilityDetail }
          : {}),
      },
    });
  } catch (error: any) {
    logger.error('Error fetching resources:', error);
    next(error);
  }
});

/**
 * GET /api/partners/resources/:resourceId/download
 * Download a resource
 */
router.get(
  '/resources/:resourceId/download',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const partnerOrgId = await requirePartnerOrgId(req, res);
      if (!partnerOrgId) return;
      const userId = (req as any).user?.id || (req as any).userId;
      if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

      const { resourceId } = req.params;
      const db = getDatabase();
      // L-06 (D-03): partner_resources to CELOWO współdzielony katalog (toolkit
      // dla wszystkich partnerów) — SELECT bez `partner_org_id` jest zamierzony,
      // NIE wyciek cross-partner. Dostęp bramkuje (1) `requirePartnerOrgId` wyżej
      // (tylko połączony partner), (2) `min_partner_tier` niżej (tier-gate). Każde
      // pobranie jest audytowane z `partner_org_id`+`user_id` (INSERT poniżej),
      // więc kto-co-pobrał jest rozliczalne per partner. Gdyby kiedyś katalog miał
      // być per-partner — dodać `partner_org_id` do tabeli i do tego WHERE.
      const resource = await DbPromise.get<any>(
        db,
        `SELECT id, title, category, min_partner_tier, file_key, file_name, mime_type, language,
                size_bytes, file_size_bytes, file_type
         FROM partner_resources
         WHERE id = ? AND is_active = TRUE
         LIMIT 1`,
        [resourceId]
      );
      if (!resource) return res.status(404).json({ success: false, error: 'Resource not found' });

      const partnerTier = await getEffectivePartnerTier(partnerOrgId);
      if (tierRank(partnerTier) < tierRank(resource.min_partner_tier)) {
        return res.status(403).json({ success: false, error: 'Insufficient partner tier' });
      }

      if (!resource.file_key) {
        return res.status(500).json({ success: false, error: 'Resource not configured' });
      }

      const generated = await generatePartnerToolkitResourceFile({
        fileKey: resource.file_key,
        language: resource.language === 'pl' ? 'pl' : 'en',
        fileNameHint: resource.file_name || null,
      });

      // Audit download (best-effort)
      const ip = String((req.headers['x-forwarded-for'] as any) || req.socket.remoteAddress || '');
      const ipHash = ip ? crypto.createHash('sha256').update(String(ip)).digest('hex') : null;
      const userAgent = String(req.headers['user-agent'] || '');

      try {
        await DbPromise.run(
          db,
          `INSERT INTO partner_resource_downloads
            (id, resource_id, partner_org_id, user_id, downloaded_at, ip_hash, user_agent)
           VALUES (?, ?, ?, ?, NOW(), ?, ?)`,
          [crypto.randomUUID(), resourceId, partnerOrgId, userId, ipHash, userAgent || null]
        );
      } catch {
        await DbPromise.run(
          db,
          `INSERT INTO partner_resource_downloads (id, resource_id, partner_org_id, user_id, downloaded_at)
           VALUES (?, ?, ?, ?, NOW())`,
          [crypto.randomUUID(), resourceId, partnerOrgId, userId]
        );
      }

      await DbPromise.run(
        db,
        `UPDATE partner_resources
         SET download_count = COALESCE(download_count, 0) + 1, updated_at = NOW()
         WHERE id = ?`,
        [resourceId]
      );

      res.setHeader('Content-Type', generated.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${generated.fileName}"`);
      return res.status(200).send(generated.buffer);
    } catch (error: any) {
      logger.error('Error downloading resource:', error);
      next(error);
    }
  }
);

// =============================================================================
// DISCOUNT TIERS ROUTES
// =============================================================================

/**
 * GET /api/partners/tiers
 * Get partner tier information and requirements
 */
router.get('/tiers', async (req: Request, res: Response, next: NextFunction) => {
  try {
    return featureUnavailable(res, 'Partner tiers unavailable (no real implementation)');
  } catch (error: any) {
    logger.error('Error fetching tiers:', error);
    next(error);
  }
});

// =============================================================================
// PUBLIC ROUTES (No Authentication Required)
// These need to be mounted separately or use a different middleware setup
// =============================================================================

/**
 * Create a separate router for public endpoints
 * These should be mounted at /api/public/partner in Gateway
 */
export const publicPartnerRouter = Router();

/**
 * GET /api/public/partner/validate-code/:code
 * Validate a partner/referral code (used during signup)
 */
publicPartnerRouter.get(
  '/validate-code/:code',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { code } = req.params;

      if (!code) {
        return res.status(400).json({ success: false, error: 'Code is required' });
      }

      const result = await PartnerReferralService.validateReferralCode(code);

      res.json({ success: true, data: result });
    } catch (error: any) {
      logger.error('Error validating partner code:', error);
      next(error);
    }
  }
);

/**
 * POST /api/public/partner/track-click
 * Track a referral link click (called when someone visits via referral link)
 */
publicPartnerRouter.post(
  '/track-click',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        referralCode,
        utmSource,
        utmMedium,
        utmCampaign,
        utmContent,
        utmTerm,
        landingPage,
        referer,
        sessionId,
        cookieId,
      } = req.body;

      if (!referralCode) {
        return res.status(400).json({ success: false, error: 'Referral code is required' });
      }

      // Look up partner by code
      const partner = await PartnerReferralService.getPartnerByReferralCode(referralCode);

      if (!partner) {
        return res.status(404).json({ success: false, error: 'Invalid referral code' });
      }

      // Hash IP for privacy
      const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
      const ipHash = require('crypto').createHash('sha256').update(String(ip)).digest('hex');

      const result = await PartnerReferralService.trackClick({
        partnerOrgId: partner.partnerOrgId,
        referralCode,
        ipHash,
        userAgent: req.headers['user-agent'] || undefined,
        referer,
        landingPage,
        utmSource,
        utmMedium,
        utmCampaign,
        utmContent,
        utmTerm,
        sessionId,
        cookieId,
      });

      res.json({ success: true, data: result });
    } catch (error: any) {
      logger.error('Error tracking click:', error);
      next(error);
    }
  }
);

// =============================================================================
// SUPERADMIN PARTNER SETTLEMENTS ROUTES
// These should be protected by superAdmin middleware
// =============================================================================

export const superAdminPartnerRouter = Router();

superAdminPartnerRouter.use(verifyToken);
superAdminPartnerRouter.use(verifySuperAdmin);

/**
 * GET /api/superadmin/partner-settlements/summary
 * Get overall partner settlements summary
 */
superAdminPartnerRouter.get('/summary', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const summary = await PartnerCommissionService.getSettlementsSummary();
    res.json({ success: true, data: summary });
  } catch (error: any) {
    logger.error('Error fetching settlements summary:', error);
    next(error);
  }
});

/**
 * GET /api/superadmin/partner-settlements/pending-commissions
 * Get all pending commissions across all partners
 */
superAdminPartnerRouter.get(
  '/pending-commissions',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const offset = parseInt(req.query.offset as string) || 0;

      const commissions = await PartnerCommissionService.getAllPendingCommissions({
        limit,
        offset,
      });
      res.json({ success: true, data: commissions });
    } catch (error: any) {
      logger.error('Error fetching pending commissions:', error);
      next(error);
    }
  }
);

/**
 * POST /api/superadmin/partner-settlements/approve-commissions
 * Approve selected commission transactions
 */
superAdminPartnerRouter.post(
  '/approve-commissions',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { commissionIds } = req.body;
      const approvedBy = (req as any).user?.id;

      if (!Array.isArray(commissionIds) || commissionIds.length === 0) {
        return res.status(400).json({ success: false, error: 'Commission IDs array is required' });
      }

      const result = await PartnerCommissionService.approveCommissions(commissionIds, approvedBy);
      res.json({ success: true, data: result });
    } catch (error: any) {
      logger.error('Error approving commissions:', error);
      next(error);
    }
  }
);

/**
 * GET /api/superadmin/partner-settlements/pending-payouts
 * Get all pending/processing payouts
 */
superAdminPartnerRouter.get(
  '/pending-payouts',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const offset = parseInt(req.query.offset as string) || 0;

      const payouts = await PartnerCommissionService.getAllPendingPayouts({ limit, offset });
      res.json({ success: true, data: payouts });
    } catch (error: any) {
      logger.error('Error fetching pending payouts:', error);
      next(error);
    }
  }
);

/**
 * POST /api/superadmin/partner-settlements/process-payout/:payoutId
 * Mark a payout as processing
 */
superAdminPartnerRouter.post(
  ['/process-payout', '/process-payout/:payoutId'],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const payoutId = resolvePayoutId(req);
      const processedBy = (req as any).user?.id;
      const { payoutReference, externalPayoutId } = req.body;
      const confirmation = requireSensitivePayoutConfirmation(
        req,
        res,
        'P29_DUAL_CONTROL_REQUIRED'
      );
      if (!confirmation) return;

      if (!payoutId) {
        return res.status(400).json({ success: false, error: 'payoutId is required' });
      }

      const success = await PartnerCommissionService.processPayout(payoutId, processedBy, {
        payoutReference,
        externalPayoutId,
        dualControlConfirmed: confirmation.confirmed,
        reason: confirmation.reason,
      });

      if (!success) {
        return res.status(400).json({ success: false, error: 'Could not process payout' });
      }

      res.json({ success: true, message: 'Payout marked as processing' });
    } catch (error: any) {
      logger.error('Error processing payout:', error);
      next(error);
    }
  }
);

/**
 * POST /api/superadmin/partner-settlements/complete-payout/:payoutId
 * Mark a payout as completed
 */
superAdminPartnerRouter.post(
  ['/complete-payout', '/complete-payout/:payoutId'],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const payoutId = resolvePayoutId(req);
      const { payoutReference } = req.body;
      const completedBy = (req as any).user?.id;
      const confirmation = requireSensitivePayoutConfirmation(
        req,
        res,
        'P29_RECONCILIATION_CONFIRMATION_REQUIRED'
      );
      if (!confirmation) return;

      if (!payoutId) {
        return res.status(400).json({ success: false, error: 'payoutId is required' });
      }

      const success = await PartnerCommissionService.completePayout(payoutId, {
        payoutReference,
        dualControlConfirmed: confirmation.confirmed,
        completedBy,
        reason: confirmation.reason,
      });

      if (!success) {
        return res.status(400).json({ success: false, error: 'Could not complete payout' });
      }

      res.json({ success: true, message: 'Payout completed successfully' });
    } catch (error: any) {
      logger.error('Error completing payout:', error);
      next(error);
    }
  }
);

/**
 * POST /api/superadmin/partner-settlements/fail-payout/:payoutId
 * Mark a payout as failed
 */
superAdminPartnerRouter.post(
  ['/fail-payout', '/fail-payout/:payoutId'],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const payoutId = resolvePayoutId(req);
      const { reason } = req.body;

      if (!reason) {
        return res.status(400).json({ success: false, error: 'Failure reason is required' });
      }

      if (!payoutId) {
        return res.status(400).json({ success: false, error: 'payoutId is required' });
      }

      const success = await PartnerCommissionService.failPayout(payoutId, reason);

      if (!success) {
        return res.status(400).json({ success: false, error: 'Could not fail payout' });
      }

      res.json({ success: true, message: 'Payout marked as failed' });
    } catch (error: any) {
      logger.error('Error failing payout:', error);
      next(error);
    }
  }
);

/**
 * GET /api/superadmin/partner-settlements/attributions
 * Get all partner-organization attributions
 */
superAdminPartnerRouter.get(
  '/attributions',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      return featureUnavailable(
        res,
        'Partner attributions listing unavailable (no real implementation)'
      );
    } catch (error: any) {
      logger.error('Error fetching attributions:', error);
      next(error);
    }
  }
);

/**
 * DELETE /api/superadmin/partner-settlements/attributions/:attributionId
 * Remove an attribution
 */
superAdminPartnerRouter.delete(
  '/attributions/:attributionId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      return featureUnavailable(
        res,
        'Partner attribution removal unavailable (no real implementation)'
      );
    } catch (error: any) {
      logger.error('Error removing attribution:', error);
      next(error);
    }
  }
);

/**
 * GET /api/superadmin/partner-settlements/expiring-attributions
 * Get attributions/discounts that are expiring soon
 * GAP-PARTNER-004: Expiring attributions view
 */
superAdminPartnerRouter.get(
  '/expiring-attributions',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const limit = parseInt(req.query.limit as string) || 100;
      const offset = parseInt(req.query.offset as string) || 0;

      // Query expiring attributions and their associated discounts
      const expiringAttributions = await PartnerReferralService.getExpiringAttributions(
        days,
        limit,
        offset
      );

      res.json({ success: true, data: expiringAttributions });
    } catch (error: any) {
      logger.error('Error fetching expiring attributions:', error);
      next(error);
    }
  }
);

/**
 * GET /api/superadmin/partner-settlements/code-analytics
 * Get analytics per referral code
 * GAP-PARTNER-003: Code analytics
 */
superAdminPartnerRouter.get(
  '/code-analytics',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const days = parseInt(req.query.days as string) || 90;
      const limit = parseInt(req.query.limit as string) || 20;

      const analytics = await PartnerReferralService.getCodeAnalytics(days, limit);

      res.json({ success: true, data: analytics });
    } catch (error: any) {
      logger.error('Error fetching code analytics:', error);
      next(error);
    }
  }
);

/**
 * GET /api/superadmin/partner-settlements/program/:partnerOrgId/status
 * P29 operator tower: same lifecycle + ledger truth as partner portal
 */
superAdminPartnerRouter.get(
  '/program/:partnerOrgId/status',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const partnerOrgId = String(req.params.partnerOrgId || '');
      if (!partnerOrgId) {
        return res.status(400).json({ success: false, error: 'partnerOrgId required' });
      }
      const detail = await PartnerProgramLedgerService.getProgramStatusDetail(
        partnerOrgId,
        'operator'
      );
      const entries = await PartnerProgramLedgerService.listEntries(partnerOrgId, { limit: 25 });
      res.json({
        success: true,
        data: {
          lifecyclePhase: detail.runtime.lifecycle_phase,
          partnerOrganizationStatus: detail.runtime.partner_status,
          balances: detail.balances,
          whatNext: detail.whatNext,
          hold: detail.hold,
          ...(detail.degraded ? { degraded: detail.degraded } : {}),
          recentLedgerEntries: entries,
        },
      });
    } catch (error: any) {
      logger.error('Error fetching partner program status:', error);
      next(error);
    }
  }
);

/**
 * POST /api/superadmin/partner-settlements/program/:partnerOrgId/lifecycle
 * Body: { toPhase: 'activate' | 'earn' | 'onboard' | 'payout', reason? }
 */
superAdminPartnerRouter.post(
  '/program/:partnerOrgId/lifecycle',
  async (req: Request, res: Response, next: NextFunction) => {
    // Hoisted so the catch block (lifecycle-error whatNext lookup) can reference it.
    const partnerOrgId = String(req.params.partnerOrgId || '');
    try {
      const toPhase = req.body?.toPhase;
      if (!partnerOrgId || !toPhase) {
        return res.status(400).json({ success: false, error: 'partnerOrgId and toPhase required' });
      }
      const userId = (req as any).user?.id;
      const result = await PartnerProgramLedgerService.transitionLifecycle({
        partnerOrgId,
        toPhase,
        actor: 'operator',
        actorId: userId,
        reason: typeof req.body?.reason === 'string' ? req.body.reason : undefined,
      });
      res.json({ success: true, data: result });
    } catch (error: any) {
      const code = error?.code;
      if (code === 'P29_LIFECYCLE_INVALID' || code === 'P29_LIFECYCLE_FORBIDDEN') {
        let whatNext: string[] = [];
        try {
          const d = await PartnerProgramLedgerService.getProgramStatusDetail(
            partnerOrgId,
            'operator'
          );
          whatNext = d.whatNext;
        } catch {
          /* ignore */
        }
        return res.status(400).json({
          success: false,
          error: error.message,
          code,
          ...(whatNext.length ? { whatNext } : {}),
        });
      }
      logger.error('Error transitioning partner program lifecycle:', error);
      next(error);
    }
  }
);

/**
 * POST /api/superadmin/partner-settlements/program/:partnerOrgId/ledger-entry
 * Operator-only accrual/hold/payout events (auditable append-only)
 */
superAdminPartnerRouter.post(
  '/program/:partnerOrgId/ledger-entry',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const partnerOrgId = String(req.params.partnerOrgId || '');
      if (!partnerOrgId) {
        return res.status(400).json({ success: false, error: 'partnerOrgId required' });
      }
      const {
        entryType,
        amount,
        currency,
        sourceRef,
        correlationId,
        idempotencyKey,
        reasonCode,
        note,
      } = req.body || {};
      if (!entryType || amount === undefined) {
        return res.status(400).json({ success: false, error: 'entryType and amount required' });
      }
      const userId = (req as any).user?.id;
      const out = await PartnerProgramLedgerService.appendEntry({
        partnerOrgId,
        entryType,
        amount: Number(amount),
        currency: currency || 'EUR',
        sourceRef: sourceRef && typeof sourceRef === 'object' ? sourceRef : {},
        actor: 'operator',
        actorId: userId ?? null,
        correlationId: correlationId || null,
        idempotencyKey: idempotencyKey || null,
        reasonCode: reasonCode || null,
        note: note || null,
      });
      res.json({ success: true, data: out });
    } catch (error: any) {
      logger.error('Error appending partner program ledger entry:', error);
      next(error);
    }
  }
);

// =============================================================================
// SUPERADMIN PARTNER CONFIG ROUTES
// =============================================================================

import * as PartnerConfigService from '../services/partnerConfigService.js';

export const partnerConfigRouter = Router();

partnerConfigRouter.use(verifyToken);
partnerConfigRouter.use(verifySuperAdmin);

/**
 * GET /api/superadmin/partner-config/commission-rates
 * Get commission rates per tier
 */
partnerConfigRouter.get(
  '/commission-rates',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rates = await PartnerConfigService.getCommissionRates();
      res.json({ success: true, data: rates });
    } catch (error: any) {
      logger.error('Error fetching commission rates:', error);
      next(error);
    }
  }
);

/**
 * PUT /api/superadmin/partner-config/commission-rates
 * Update commission rate for a tier
 */
partnerConfigRouter.put(
  '/commission-rates',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { tier, rate } = req.body;

      if (!tier || rate === undefined) {
        return res.status(400).json({ success: false, error: 'Tier and rate are required' });
      }

      await PartnerConfigService.updateCommissionRate(tier, rate);
      res.json({ success: true, message: 'Commission rate updated' });
    } catch (error: any) {
      logger.error('Error updating commission rate:', error);
      next(error);
    }
  }
);

/**
 * GET /api/superadmin/partner-config/discount
 * Get discount configuration
 */
partnerConfigRouter.get('/discount', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const config = await PartnerConfigService.getDiscountConfig();
    res.json({ success: true, data: config });
  } catch (error: any) {
    logger.error('Error fetching discount config:', error);
    next(error);
  }
});

/**
 * PUT /api/superadmin/partner-config/discount
 * Update discount configuration
 */
partnerConfigRouter.put('/discount', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const config = req.body;
    await PartnerConfigService.updateDiscountConfig(config);
    res.json({ success: true, message: 'Discount configuration updated' });
  } catch (error: any) {
    logger.error('Error updating discount config:', error);
    next(error);
  }
});

/**
 * GET /api/superadmin/partner-config/payout-settings
 * Get payout settings
 */
partnerConfigRouter.get(
  '/payout-settings',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const settings = await PartnerConfigService.getPayoutSettings();
      res.json({ success: true, data: settings });
    } catch (error: any) {
      logger.error('Error fetching payout settings:', error);
      next(error);
    }
  }
);

/**
 * PUT /api/superadmin/partner-config/payout-settings
 * Update payout settings
 */
partnerConfigRouter.put(
  '/payout-settings',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const settings = req.body;
      await PartnerConfigService.updatePayoutSettings(settings);
      res.json({ success: true, message: 'Payout settings updated' });
    } catch (error: any) {
      logger.error('Error updating payout settings:', error);
      next(error);
    }
  }
);

partnerConfigRouter.get(
  '/review-queue',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const limit = Math.max(1, Math.min(200, Number(req.query.limit || 50) || 50));
      const data = await getCertificationReviewQueue(limit);
      res.json({ success: true, data });
    } catch (error: any) {
      logger.error('Error fetching certification review queue:', error);
      next(error);
    }
  }
);

partnerConfigRouter.post(
  '/review-queue/:certificationId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const certificationId = String(req.params.certificationId || '').trim();
      const reviewState = String(req.body?.reviewState || '').trim() as
        | 'approved'
        | 'changes_requested'
        | 'pending';
      const notes = typeof req.body?.notes === 'string' ? req.body.notes : null;
      if (!certificationId) {
        return res.status(400).json({ success: false, error: 'certificationId is required' });
      }
      if (!['approved', 'changes_requested', 'pending'].includes(reviewState)) {
        return res.status(400).json({ success: false, error: 'Invalid reviewState' });
      }
      await updateCertificationReviewState({ certificationId, reviewState, notes });
      res.json({ success: true, message: 'Review state updated' });
    } catch (error: any) {
      logger.error('Error updating certification review state:', error);
      next(error);
    }
  }
);

partnerConfigRouter.get('/reporting', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const certification = await getPartnerCertificationReporting();
    const db = getDatabase();
    const [resourceDownloads, partnerDocViews] = await Promise.all([
      DbPromise.all<any>(
        db,
        `SELECT pr.category, COUNT(*) as downloads
         FROM partner_resource_downloads prd
         JOIN partner_resources pr ON pr.id = prd.resource_id
         GROUP BY pr.category
         ORDER BY downloads DESC`
      ),
      DbPromise.all<any>(
        db,
        `SELECT a.slug, COUNT(*) as views
         FROM kb_article_views v
         JOIN kb_articles a ON a.id = v.article_id
         WHERE a.slug IN (
           'partner-program-overview',
           'partner-application-flow',
           'partner-payout-and-activation',
           'partner-certification-explainer',
           'partner-faq',
           'partner-case-study-operations-rollout',
           'partner-case-study-cfo-governance'
         )
         GROUP BY a.slug
         ORDER BY views DESC`
      ),
    ]);
    res.json({
      success: true,
      data: {
        ...certification,
        resourceDownloads,
        partnerDocViews,
      },
    });
  } catch (error: any) {
    logger.error('Error fetching partner reporting:', error);
    next(error);
  }
});

partnerConfigRouter.get(
  '/applications',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const limit = Math.max(1, Math.min(200, Number(req.query.limit || 100) || 100));
      const data = await listPartnerApplications(limit);
      res.json({ success: true, data });
    } catch (error: any) {
      logger.error('Error fetching partner applications:', error);
      next(error);
    }
  }
);

partnerConfigRouter.post(
  '/applications/:applicationId/review',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const applicationId = String(req.params.applicationId || '').trim();
      const status = String(req.body?.status || '').trim() as
        | 'pending'
        | 'approved'
        | 'rejected'
        | 'needs_follow_up';
      const reviewNote = typeof req.body?.reviewNote === 'string' ? req.body.reviewNote : null;
      const reviewedBy = String((req as any).user?.id || (req as any).userId || '').trim() || null;

      if (!applicationId) {
        return res.status(400).json({ success: false, error: 'applicationId is required' });
      }
      if (!['pending', 'approved', 'rejected', 'needs_follow_up'].includes(status)) {
        return res.status(400).json({ success: false, error: 'Invalid status' });
      }

      await reviewPartnerApplication({ applicationId, status, reviewNote, reviewedBy });
      res.json({ success: true, message: 'Partner application reviewed' });
    } catch (error: any) {
      logger.error('Error reviewing partner application:', error);
      next(error);
    }
  }
);

export default router;
