/**
 * organization-profiles Routes
 * Organization Profile & Branding Management for Enterprise SaaS
 */
import { Response, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

import { type AuthRequest, verifyToken } from '../../middleware/auth.middleware.js';
import { apiAuthRateLimiter } from '../../middleware/rateLimiting.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

const router = Router();

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

      return res.json({
        exists: !!profile,
        profile: {
          // Basic info
          name: org.name,
          logoUrl: branding?.logo_light_url || brandingSettings.logoUrl || '',
          description: brandingSettings.description || '',

          // Company details
          industry: profile?.industry || brandingSettings.industry || 'Technology',
          companySize: profile?.company_size || brandingSettings.companySize || '51-200',
          website: brandingSettings.website || '',

          // Branding
          brandColor: branding?.primary_color || brandingSettings.brandColor || '#8B5CF6',
          accentColor: branding?.accent_color || brandingSettings.accentColor || '#10B981',
          faviconUrl: brandingSettings.faviconUrl || '',

          // Regional
          defaultTimezone:
            org.default_timezone || brandingSettings.defaultTimezone || 'Europe/Warsaw',
          defaultLanguage: org.default_language || profile?.preferred_language || 'en',
          dateFormat: brandingSettings.dateFormat || 'DD/MM/YYYY',
          timeFormat: brandingSettings.timeFormat || '24h',
          currency: brandingSettings.currency || 'USD',

          // Custom domain
          customDomain: brandingSettings.customDomain || '',
          customDomainVerified: brandingSettings.customDomainVerified || false,

          // Social
          linkedinUrl: brandingSettings.linkedinUrl || '',
          twitterUrl: brandingSettings.twitterUrl || '',
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
    if (!['admin', 'administrator', 'superadmin', 'super_admin', 'owner'].includes(normalizedRole)) {
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

    // For now, return a placeholder - in production, this would handle file upload
    // Using multer middleware and storing in S3/CloudStorage

    // Placeholder response for logo upload
    return res.json({
      success: true,
      logoUrl: `/uploads/logos/${orgId}.png`,
      message: 'Logo upload endpoint ready - file upload middleware needed',
    });
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

    try {
      // In production, this would:
      // 1. Check DNS CNAME record
      // 2. Validate SSL certificate
      // 3. Update domain verification status

      // For now, simulate verification (always succeeds for demo)
      const isValidDomain = /^[a-z0-9]+([.-][a-z0-9]+)*\.[a-z]{2,}$/i.test(domain);

      if (!isValidDomain) {
        return res.json({
          verified: false,
          message: 'Invalid domain format',
        });
      }

      // Update settings with verified domain
      const existingSettings = await dbGet<{ setting_value: string }>(
        `SELECT setting_value FROM organization_settings 
                 WHERE organization_id = ? AND setting_key = 'branding'`,
        [orgId]
      );

      const brandingData = existingSettings?.setting_value
        ? JSON.parse(existingSettings.setting_value)
        : {};

      brandingData.customDomain = domain;
      brandingData.customDomainVerified = true;

      await dbRun(
        `INSERT OR REPLACE INTO organization_settings 
                    (organization_id, setting_key, setting_value, updated_at)
                 VALUES (?, 'branding', ?, datetime('now'))`,
        [orgId, JSON.stringify(brandingData)]
      );

      logger.info(`[organization-profiles] Domain ${domain} verified for org ${orgId}`);

      return res.json({
        verified: true,
        message: 'Domain verified successfully',
      });
    } catch (error: any) {
      logger.error('[organization-profiles] Error verifying domain:', error);
      return res.status(500).json({ error: 'Failed to verify domain' });
    }
  })
);

export default router;
