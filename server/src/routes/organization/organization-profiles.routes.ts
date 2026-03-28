/**
 * organization-profiles Routes
 * Organization Profile & Branding Management for Enterprise SaaS
 */
import { Response, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

import { type AuthRequest, verifyToken } from '../../middleware/auth.middleware.js';
import { apiAuthRateLimiter } from '../../middleware/rateLimiting.middleware.js';
import organizationContextService from '../../services/organizationContext/OrganizationContextService.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

const router = Router();
const notConfigured = (res: Response) =>
  res.status(503).json({
    statusCode: 503,
    status: false,
    type: 'not_configured',
    message: 'Service temporarily unavailable due to missing configuration',
  });

const safeParseArray = (value: unknown): string[] => {
  if (Array.isArray(value))
    return value.filter((entry): entry is string => typeof entry === 'string');
  if (typeof value !== 'string' || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((entry): entry is string => typeof entry === 'string')
      : [];
  } catch {
    return [];
  }
};

// Apply rate limiting and auth
router.use(apiAuthRateLimiter);
router.use(verifyToken);

/**
 * GET /api/organization-profiles/:orgId
 * Get organization profile with all settings
 */
router.get(
  '/:orgId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { orgId } = req.params;
    const userId = req.user?.id;
    const userOrgId = req.user?.organizationId;

    // Verify user has access to this organization
    if (userOrgId !== orgId) {
      return res.status(403).json({ error: 'Access denied to this organization' });
    }

    try {
      const resolvedContext = await organizationContextService
        .buildResolvedContext(orgId)
        .catch(() => null);

      // Get basic organization info
      const org = await dbGet<{
        id: string;
        name: string;
        default_timezone: string;
        default_language: string;
      }>(
        `SELECT id, name, default_timezone, default_language 
                 FROM organizations WHERE id = ?`,
        [orgId]
      );

      // Get branding info from organization_branding table (if it exists)
      const branding = await dbGet<{
        logo_light_url: string | null;
        primary_color: string | null;
        accent_color: string | null;
      }>(
        `SELECT logo_light_url, primary_color, accent_color 
                 FROM organization_branding WHERE organization_id = ?`,
        [orgId]
      );

      if (!org) {
        return res.status(404).json({ error: 'Organization not found' });
      }

      // Get extended profile from organization_profiles
      const profile = await dbGet<{
        industry: string;
        company_size: string;
        employee_count: number;
        headquarters_country: string;
        strategic_priorities: string;
        digital_maturity_overall: number;
        preferred_language: string;
        profile_completeness: number;
      }>(
        `SELECT industry, company_size, employee_count, headquarters_country,
                        strategic_priorities, digital_maturity_overall, preferred_language,
                        profile_completeness
                 FROM organization_profiles WHERE organization_id = ?`,
        [orgId]
      );

      // Get organization settings for additional branding
      const settings = await dbGet<{
        setting_value: string;
      }>(
        `SELECT setting_value FROM organization_settings 
                 WHERE organization_id = ? AND setting_key = 'branding'`,
        [orgId]
      );

      const brandingSettings = settings?.setting_value ? JSON.parse(settings.setting_value) : {};

      // Calculate profile completeness
      const fields = [
        org.name,
        branding?.logo_light_url,
        profile?.industry,
        profile?.company_size,
        brandingSettings.description,
      ];
      const filledFields = fields.filter(Boolean).length;
      const completeness = Math.round((filledFields / fields.length) * 100);
      const hasResolvedProfile =
        Boolean(resolvedContext?.profile.companyName) ||
        Boolean(resolvedContext?.profile.industry) ||
        Boolean(resolvedContext?.profile.description);

      return res.json({
        exists: !!profile || hasResolvedProfile,
        profile: {
          // Basic info
          name: resolvedContext?.profile.companyName || org.name,
          logoUrl: branding?.logo_light_url || brandingSettings.logoUrl || '',
          description: resolvedContext?.profile.description || brandingSettings.description || '',

          // Company details
          industry:
            resolvedContext?.profile.industry ||
            profile?.industry ||
            brandingSettings.industry ||
            'Technology',
          companySize:
            resolvedContext?.profile.companySize ||
            profile?.company_size ||
            brandingSettings.companySize ||
            '51-200',
          website: resolvedContext?.profile.website || brandingSettings.website || '',
          employee_count:
            resolvedContext?.profile.employeeCount || profile?.employee_count || undefined,
          annual_revenue:
            resolvedContext?.profile.annualRevenue &&
            Number.isFinite(Number(resolvedContext.profile.annualRevenue))
              ? Number(resolvedContext.profile.annualRevenue)
              : undefined,
          headquarters_country:
            resolvedContext?.profile.location || profile?.headquarters_country || '',
          strategic_priorities:
            resolvedContext?.strategic.priorities ||
            resolvedContext?.strategic.goals ||
            safeParseArray(profile?.strategic_priorities),
          competitive_position:
            resolvedContext?.strategic.competitivePosition ||
            (brandingSettings.competitive_position ?? ''),
          growth_stage:
            resolvedContext?.strategic.growthStage || (brandingSettings.growth_stage ?? ''),
          mission_statement:
            resolvedContext?.strategic.mission || (brandingSettings.mission_statement ?? ''),
          vision_statement:
            resolvedContext?.strategic.vision || (brandingSettings.vision_statement ?? ''),
          technology_stack:
            resolvedContext?.systems.stack || safeParseArray(brandingSettings.technology_stack),
          cloud_adoption_level:
            resolvedContext?.systems.cloudAdoption || brandingSettings.cloud_adoption_level || '',
          preferred_language:
            resolvedContext?.profile.defaultLanguage || profile?.preferred_language || 'en',
          currency: resolvedContext?.profile.currency || brandingSettings.currency || 'USD',

          // Branding
          brandColor:
            resolvedContext?.profile.brandColor ||
            branding?.primary_color ||
            brandingSettings.brandColor ||
            '#8B5CF6',
          accentColor:
            resolvedContext?.profile.accentColor ||
            branding?.accent_color ||
            brandingSettings.accentColor ||
            '#10B981',
          faviconUrl: brandingSettings.faviconUrl || '',

          // Regional
          defaultTimezone:
            resolvedContext?.profile.defaultTimezone ||
            org.default_timezone ||
            brandingSettings.defaultTimezone ||
            'Europe/Warsaw',
          defaultLanguage:
            resolvedContext?.profile.defaultLanguage ||
            org.default_language ||
            profile?.preferred_language ||
            'en',
          dateFormat: brandingSettings.dateFormat || 'DD/MM/YYYY',
          timeFormat: brandingSettings.timeFormat || '24h',

          // Custom domain
          customDomain:
            resolvedContext?.profile.customDomain || brandingSettings.customDomain || '',
          customDomainVerified: brandingSettings.customDomainVerified || false,

          // Social
          linkedinUrl: resolvedContext?.profile.linkedinUrl || brandingSettings.linkedinUrl || '',
          twitterUrl: resolvedContext?.profile.twitterUrl || brandingSettings.twitterUrl || '',
        },
        completeness,
      });
    } catch (error: any) {
      logger.error('[organization-profiles] Error fetching profile:', error);
      return res.status(500).json({ error: 'Failed to fetch organization profile' });
    }
  })
);

/**
 * PUT /api/organization-profiles/:orgId
 * Update organization profile
 */
router.put(
  '/:orgId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { orgId } = req.params;
    const userId = req.user?.id;
    const userOrgId = req.user?.organizationId;
    const userRole = req.user?.role;

    // Verify user has access and is admin
    if (userOrgId !== orgId) {
      return res.status(403).json({ error: 'Access denied to this organization' });
    }

    const normalizedRole = (userRole || '').toLowerCase();
    if (
      !['admin', 'administrator', 'superadmin', 'super_admin', 'owner'].includes(normalizedRole)
    ) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const {
      description,
      industry,
      companySize,
      website,
      logoUrl,
      faviconUrl,
      brandColor,
      accentColor,
      customDomain,
      customDomainVerified,
      defaultTimezone,
      defaultLanguage,
      dateFormat,
      timeFormat,
      currency,
      linkedinUrl,
      twitterUrl,
    } = req.body;

    try {
      // Update organizations table directly for core fields (timezone and language only)
      await dbRun(
        `UPDATE organizations SET 
                    default_timezone = COALESCE(?, default_timezone),
                    default_language = COALESCE(?, default_language),
                    updated_at = datetime('now')
                 WHERE id = ?`,
        [defaultTimezone, defaultLanguage, orgId]
      );

      // Update or insert branding in organization_branding table
      const existingBranding = await dbGet(
        `SELECT id FROM organization_branding WHERE organization_id = ?`,
        [orgId]
      );

      if (existingBranding) {
        await dbRun(
          `UPDATE organization_branding SET 
                        logo_light_url = COALESCE(?, logo_light_url),
                        primary_color = COALESCE(?, primary_color),
                        accent_color = COALESCE(?, accent_color),
                        updated_at = datetime('now')
                     WHERE organization_id = ?`,
          [logoUrl, brandColor, accentColor, orgId]
        );
      } else {
        await dbRun(
          `INSERT INTO organization_branding (id, organization_id, logo_light_url, primary_color, accent_color, created_at, updated_at)
                     VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
          [uuidv4(), orgId, logoUrl || null, brandColor || '#8B5CF6', accentColor || '#10B981']
        );
      }

      // Upsert organization_profiles for extended data
      const existingProfile = await dbGet(
        `SELECT id FROM organization_profiles WHERE organization_id = ?`,
        [orgId]
      );

      if (existingProfile) {
        await dbRun(
          `UPDATE organization_profiles SET 
                        industry = COALESCE(?, industry),
                        company_size = COALESCE(?, company_size),
                        preferred_language = COALESCE(?, preferred_language),
                        updated_at = datetime('now'),
                        updated_by = ?
                     WHERE organization_id = ?`,
          [industry, companySize, defaultLanguage, userId, orgId]
        );
      } else {
        await dbRun(
          `INSERT INTO organization_profiles (id, organization_id, industry, company_size, preferred_language, created_by, updated_by)
                     VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [uuidv4(), orgId, industry, companySize, defaultLanguage, userId, userId]
        );
      }

      // Store all branding settings in organization_settings
      const brandingData = {
        description,
        industry,
        companySize,
        website,
        logoUrl,
        faviconUrl,
        brandColor,
        accentColor,
        customDomain,
        customDomainVerified,
        defaultTimezone,
        defaultLanguage,
        dateFormat,
        timeFormat,
        currency,
        linkedinUrl,
        twitterUrl,
      };

      await dbRun(
        `INSERT OR REPLACE INTO organization_settings 
                    (organization_id, setting_key, setting_value, updated_at)
                 VALUES (?, 'branding', ?, datetime('now'))`,
        [orgId, JSON.stringify(brandingData)]
      );

      await organizationContextService.recordOrganizationProfile({
        organizationId: orgId,
        userId,
        payload: {
          ...req.body,
          description,
          industry,
          companySize,
          website,
          logoUrl,
          faviconUrl,
          brandColor,
          accentColor,
          customDomain,
          customDomainVerified,
          defaultTimezone,
          defaultLanguage,
          dateFormat,
          timeFormat,
          currency,
          linkedinUrl,
          twitterUrl,
        },
      });

      logger.info(`[organization-profiles] Profile updated for org ${orgId} by user ${userId}`);

      return res.json({ success: true, message: 'Organization profile updated' });
    } catch (error: any) {
      logger.error('[organization-profiles] Error updating profile:', error);
      return res.status(500).json({ error: 'Failed to update organization profile' });
    }
  })
);

/**
 * POST /api/organizations/:orgId/logo
 * Upload organization logo
 */
router.post(
  '/:orgId/logo',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { orgId } = req.params;
    const userOrgId = req.user?.organizationId;

    if (userOrgId !== orgId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // No fake success: logo uploads require real storage + upload middleware.
    return notConfigured(res);
  })
);

/**
 * POST /api/organizations/:orgId/verify-domain
 * Verify custom domain DNS
 */
router.post(
  '/:orgId/verify-domain',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { orgId } = req.params;
    const { domain } = req.body;
    const userOrgId = req.user?.organizationId;

    if (userOrgId !== orgId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!domain) {
      return res.status(400).json({ error: 'Domain is required' });
    }

    const isValidDomain = /^[a-z0-9]+([.-][a-z0-9]+)*\.[a-z]{2,}$/i.test(domain);
    if (!isValidDomain) {
      return res.json({
        verified: false,
        message: 'Invalid domain format',
      });
    }

    // No simulated verification in runtime.
    return notConfigured(res);
  })
);

export default router;
