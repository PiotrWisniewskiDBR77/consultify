/**
 * organization-profiles Routes
 * Organization Profile & Branding Management for Enterprise SaaS
 */
import { Response, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

import { type AuthRequest, verifyToken } from '../../middleware/auth.middleware.js';
import { apiAuthRateLimiter } from '../../middleware/rateLimiting.middleware.js';
import organizationContextService, {
  ORGANIZATION_CONTEXT_SCHEMA_VERSION,
} from '../../services/organizationContext/OrganizationContextService.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

const router = Router();
const PROFILE_CACHE_TTL_MS = Number(process.env.ORG_PROFILE_CACHE_TTL_MS || 60_000);
const profileResponseCache = new Map<
  string,
  { expiresAt: number; payload: Record<string, unknown> }
>();

const readCachedProfile = (orgId: string): Record<string, unknown> | null => {
  const cached = profileResponseCache.get(orgId);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    profileResponseCache.delete(orgId);
    return null;
  }
  return cached.payload;
};

const writeCachedProfile = (orgId: string, payload: Record<string, unknown>): void => {
  profileResponseCache.set(orgId, {
    payload,
    expiresAt: Date.now() + PROFILE_CACHE_TTL_MS,
  });
};

const invalidateProfileCache = (orgId: string): void => {
  profileResponseCache.delete(orgId);
};
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

type CanonicalBranding = {
  description?: string;
  industry?: string;
  companySize?: string;
  website?: string;
  logoUrl?: string;
  faviconUrl?: string;
  brandColor?: string;
  accentColor?: string;
  customDomain?: string;
  customDomainVerified?: boolean;
  defaultTimezone?: string;
  defaultLanguage?: string;
  dateFormat?: string;
  timeFormat?: string;
  currency?: string;
  linkedinUrl?: string;
  twitterUrl?: string;
  mission_statement?: string;
  vision_statement?: string;
  competitive_position?: string;
  growth_stage?: string;
  technology_stack?: string[];
  cloud_adoption_level?: string;
};

async function readCanonicalBranding(orgId: string): Promise<CanonicalBranding> {
  const settings = await dbGet<{ setting_value?: string | null }>(
    `SELECT setting_value FROM organization_settings
     WHERE organization_id = ? AND setting_key = 'branding'`,
    [orgId]
  ).catch(() => null);
  if (settings?.setting_value) {
    return JSON.parse(settings.setting_value) as CanonicalBranding;
  }

  // Legacy fallback only: if the canonical settings row is missing, hydrate from older branding storage.
  const legacyBranding = await dbGet<{
    logo_light_url?: string | null;
    primary_color?: string | null;
    accent_color?: string | null;
    custom_domain?: string | null;
    custom_domain_verified?: number | boolean | null;
  }>(
    `SELECT logo_light_url, primary_color, accent_color, custom_domain, custom_domain_verified
     FROM organization_branding WHERE organization_id = ?`,
    [orgId]
  ).catch(() => null);

  return {
    logoUrl: legacyBranding?.logo_light_url || undefined,
    brandColor: legacyBranding?.primary_color || undefined,
    accentColor: legacyBranding?.accent_color || undefined,
    customDomain: legacyBranding?.custom_domain || undefined,
    customDomainVerified: Boolean(legacyBranding?.custom_domain_verified),
  };
}

async function syncLegacyBrandingMirror(orgId: string, branding: CanonicalBranding): Promise<void> {
  try {
    const existingBranding = await dbGet<{ id: string }>(
      `SELECT id FROM organization_branding WHERE organization_id = ?`,
      [orgId]
    );

    if (existingBranding) {
      await dbRun(
        `UPDATE organization_branding SET
           logo_light_url = COALESCE(?, logo_light_url),
           primary_color = COALESCE(?, primary_color),
           accent_color = COALESCE(?, accent_color),
           custom_domain = COALESCE(?, custom_domain),
           custom_domain_verified = COALESCE(?, custom_domain_verified),
           updated_at = datetime('now')
         WHERE organization_id = ?`,
        [
          branding.logoUrl || null,
          branding.brandColor || null,
          branding.accentColor || null,
          branding.customDomain || null,
          branding.customDomainVerified === undefined
            ? null
            : Number(branding.customDomainVerified),
          orgId,
        ]
      );
    } else {
      await dbRun(
        `INSERT INTO organization_branding
           (id, organization_id, logo_light_url, primary_color, accent_color, custom_domain, custom_domain_verified, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
        [
          uuidv4(),
          orgId,
          branding.logoUrl || null,
          branding.brandColor || '#8B5CF6',
          branding.accentColor || '#10B981',
          branding.customDomain || null,
          Number(Boolean(branding.customDomainVerified)),
        ]
      );
    }
  } catch (error) {
    logger.warn('[organization-profiles] Failed to sync legacy branding mirror', { orgId, error });
  }
}

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
      const cached = readCachedProfile(orgId);
      if (cached) {
        return res.json({ ...cached, cached: true });
      }

      const resolvedContext = await organizationContextService
        .buildResolvedContext(orgId)
        .catch(() => null);

      // Get basic organization info
      const org = await dbGet<{
        id: string;
        name: string;
      }>(
        `SELECT id, name FROM organizations WHERE id = ?`,
        [orgId]
      );

      if (!org) {
        return res.status(404).json({ error: 'Organization not found' });
      }

      const profile = await dbGet<Record<string, any>>(
        `SELECT * FROM organization_profiles WHERE organization_id = ?`,
        [orgId]
      );

      const brandingSettings = await readCanonicalBranding(orgId);

      // Calculate profile completeness
      const fields = [
        org.name,
        brandingSettings.logoUrl,
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

      const payload = {
        exists: !!profile || hasResolvedProfile,
        profile: {
          // Basic info
          name: resolvedContext?.profile.companyName || org.name,
          logoUrl: brandingSettings.logoUrl || '',
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
            resolvedContext?.profile.brandColor || brandingSettings.brandColor || '#8B5CF6',
          accentColor:
            resolvedContext?.profile.accentColor || brandingSettings.accentColor || '#10B981',
          faviconUrl: brandingSettings.faviconUrl || '',

          // Regional
          defaultTimezone:
            resolvedContext?.profile.defaultTimezone ||
            brandingSettings.defaultTimezone ||
            'Europe/Warsaw',
          defaultLanguage:
            resolvedContext?.profile.defaultLanguage ||
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

          // P30-D new fields
          organization_type:
            resolvedContext?.profile.organizationType || profile?.organization_type || '',
          revenue_model: resolvedContext?.profile.revenueModel || profile?.revenue_model || '',
          delivery_model:
            resolvedContext?.operations?.deliveryModel || profile?.delivery_model || '',
          core_systems:
            resolvedContext?.systems?.coreSystems || safeParseArray(profile?.core_systems),
          founding_year: resolvedContext?.profile.foundingYear || profile?.founding_year || null,
          digital_maturity_overall: profile?.digital_maturity_overall || null,
          digital_budget_percent: profile?.digital_budget_percent || null,
          primary_markets: safeParseArray(profile?.primary_markets),
          customer_segments: safeParseArray(profile?.customer_segments),
          key_competitors: safeParseArray(profile?.key_competitors),
          market_share_estimate: profile?.market_share_estimate || null,
          regulatory_environment: safeParseArray(profile?.regulatory_environment),
          risk_appetite: resolvedContext?.strategic?.riskAppetite || profile?.risk_appetite || '',
          budget_constraints: profile?.budget_constraints || '',
          timeline_constraints: profile?.timeline_constraints || '',
          industry_code: resolvedContext?.profile.industryCode || profile?.industry_code || '',
          industry_subsector:
            resolvedContext?.profile.industrySubsector || profile?.industry_subsector || '',
          communication_style:
            resolvedContext?.profile?.communicationStyle || profile?.communication_style || '',
          industry_jargon_level:
            resolvedContext?.profile?.industryJargonLevel || profile?.industry_jargon_level || '',
          production_archetype:
            resolvedContext?.operations?.productionArchetype || profile?.production_archetype || '',
          shift_pattern: resolvedContext?.operations?.shiftPattern || profile?.shift_pattern || '',
          automation_level:
            resolvedContext?.operations?.automationLevel || profile?.automation_level || '',
        },
        completeness,
      };

      writeCachedProfile(orgId, payload);
      return res.json({ ...payload, cached: false });
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
      organization_type,
      revenue_model,
      delivery_model,
      core_systems,
      founding_year,
      employee_count,
      annual_revenue,
      headquarters_country,
      strategic_priorities,
      competitive_position,
      growth_stage,
      mission_statement,
      vision_statement,
      technology_stack,
      cloud_adoption_level,
      digital_maturity_overall,
      digital_budget_percent,
      primary_markets,
      customer_segments,
      key_competitors,
      market_share_estimate,
      regulatory_environment,
      risk_appetite,
      budget_constraints,
      timeline_constraints,
      industry_code,
      industry_subsector,
      communication_style,
      industry_jargon_level,
      production_archetype,
      shift_pattern,
      automation_level,
    } = req.body;

    try {
      invalidateProfileCache(orgId);

      // Update organizations table directly for core fields (timezone and language only)
      await dbRun(
        `UPDATE organizations SET 
                    default_timezone = COALESCE(?, default_timezone),
                    default_language = COALESCE(?, default_language),
                    updated_at = datetime('now')
                 WHERE id = ?`,
        [defaultTimezone, defaultLanguage, orgId]
      );

      // Upsert organization_profiles for extended data
      const existingProfile = await dbGet(
        `SELECT id FROM organization_profiles WHERE organization_id = ?`,
        [orgId]
      );

      const profileFields: Record<string, unknown> = {
        industry,
        company_size: companySize,
        preferred_language: defaultLanguage,
        organization_type,
        revenue_model,
        delivery_model,
        core_systems: core_systems ? JSON.stringify(core_systems) : undefined,
        founding_year,
        employee_count,
        annual_revenue,
        headquarters_country,
        strategic_priorities: strategic_priorities
          ? JSON.stringify(strategic_priorities)
          : undefined,
        competitive_position,
        growth_stage,
        mission_statement,
        vision_statement,
        technology_stack: technology_stack ? JSON.stringify(technology_stack) : undefined,
        cloud_adoption_level,
        digital_maturity_overall,
        digital_budget_percent,
        primary_markets: primary_markets ? JSON.stringify(primary_markets) : undefined,
        customer_segments: customer_segments ? JSON.stringify(customer_segments) : undefined,
        key_competitors: key_competitors ? JSON.stringify(key_competitors) : undefined,
        market_share_estimate,
        regulatory_environment: regulatory_environment
          ? JSON.stringify(regulatory_environment)
          : undefined,
        risk_appetite,
        budget_constraints,
        timeline_constraints,
        industry_code,
        industry_subsector,
        currency,
        communication_style,
        industry_jargon_level,
        production_archetype,
        shift_pattern,
        automation_level,
      };

      const definedFields = Object.entries(profileFields).filter(([, v]) => v !== undefined);

      if (existingProfile) {
        if (definedFields.length > 0) {
          const setClauses = definedFields.map(([k]) => `${k} = COALESCE(?, ${k})`).join(', ');
          await dbRun(
            `UPDATE organization_profiles SET ${setClauses}, updated_at = datetime('now'), updated_by = ? WHERE organization_id = ?`,
            [...definedFields.map(([, v]) => v), userId, orgId]
          );
        }
      } else {
        const cols = [
          'id',
          'organization_id',
          ...definedFields.map(([k]) => k),
          'created_by',
          'updated_by',
        ];
        const placeholders = cols.map(() => '?').join(', ');
        await dbRun(
          `INSERT INTO organization_profiles (${cols.join(', ')}) VALUES (${placeholders})`,
          [uuidv4(), orgId, ...definedFields.map(([, v]) => v), userId, userId]
        );
      }

      // Store all branding settings in organization_settings
      const brandingData: CanonicalBranding = {
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

      await syncLegacyBrandingMirror(orgId, brandingData);

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

      // Emit audit event
      try {
        await dbRun(
          `INSERT INTO organization_events (id, organization_id, event_type, actor_user_id, details, created_at)
           VALUES (?, ?, 'profile_updated', ?, ?, datetime('now'))`,
          [
            uuidv4(),
            orgId,
            userId,
            JSON.stringify({
              fields: Object.keys(req.body).filter((k) => req.body[k] !== undefined),
              source: 'organization-profiles',
            }),
          ]
        );
      } catch {
        // Audit is best-effort; don't fail the request
      }

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

// =========================================================================
// P30-B: Trust posture, conflicts, audit, ownership boundaries
// =========================================================================

/**
 * GET /api/organization-profiles/:orgId/trust
 * Read-only trust posture: MFA, SSO, security status.
 * Any org member can read; writes go through Admin (P32).
 */
router.get(
  '/:orgId/trust',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { orgId } = req.params;
    const userOrgId = req.user?.organizationId;

    if (userOrgId !== orgId) {
      return res.status(403).json({ error: 'Access denied to this organization' });
    }

    const resolved = await organizationContextService.buildResolvedContext(orgId);

    return res.json({
      ...resolved.trust,
      sso: {
        ...resolved.trust.sso,
        enabled: resolved.trust.sso.active,
      },
      _readOnly: true,
      _writeEndpoint: '/api/admin/security',
    });
  })
);

/**
 * PUT /api/organization-profiles/:orgId/trust
 * BLOCKED — trust writes go through Admin (P32).
 * Returns 403 with guidance to the correct surface.
 */
router.put(
  '/:orgId/trust',
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    return res.status(403).json({
      error: 'Trust settings are managed by Admin',
      code: 'OWNERSHIP_BOUNDARY_VIOLATION',
      guidance:
        'MFA, SSO, and security policies are managed through the Admin panel (P32). Use PUT /api/admin/security/:orgId instead.',
      ownerSurface: 'admin',
    });
  })
);

/**
 * GET /api/organization-profiles/:orgId/conflicts
 * Returns active claim conflicts from OrganizationContextService.
 */
router.get(
  '/:orgId/conflicts',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { orgId } = req.params;
    const userOrgId = req.user?.organizationId;

    if (userOrgId !== orgId) {
      return res.status(403).json({ error: 'Access denied to this organization' });
    }

    try {
      const resolved = await organizationContextService.buildResolvedContext(orgId);
      return res.json({
        conflicts: resolved.conflicts,
        count: resolved.conflicts.length,
        schemaVersion: resolved.schemaVersion,
      });
    } catch (error: any) {
      logger.error('[organization-profiles] Error fetching conflicts:', error);
      return res.status(500).json({ error: 'Failed to fetch conflicts' });
    }
  })
);

/**
 * GET /api/organization-profiles/:orgId/audit
 * Returns recent org profile change events from the context timeline.
 */
router.get(
  '/:orgId/audit',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { orgId } = req.params;
    const userOrgId = req.user?.organizationId;
    const userRole = (req.user?.role || '').toLowerCase();

    if (userOrgId !== orgId) {
      return res.status(403).json({ error: 'Access denied to this organization' });
    }

    if (!['admin', 'administrator', 'superadmin', 'super_admin', 'owner'].includes(userRole)) {
      return res.status(403).json({ error: 'Admin access required to view audit trail' });
    }

    try {
      const timeline = await organizationContextService.listTimeline(orgId, 50);

      const profileEvents = await dbAll<{
        id: string;
        event_type: string;
        actor_user_id: string;
        details: string;
        created_at: string;
      }>(
        `SELECT id, event_type, actor_user_id, details, created_at
         FROM organization_events
         WHERE organization_id = ? AND event_type LIKE 'profile%'
         ORDER BY created_at DESC LIMIT 50`,
        [orgId]
      ).catch(() => []);

      return res.json({
        timeline: timeline || [],
        profileEvents: profileEvents || [],
        totalEvents: (timeline?.length || 0) + (profileEvents?.length || 0),
      });
    } catch (error: any) {
      logger.error('[organization-profiles] Error fetching audit:', error);
      return res.status(500).json({ error: 'Failed to fetch audit trail' });
    }
  })
);

/**
 * GET /api/organization-profiles/:orgId/reuse-contract
 * Returns the stable reuse fields that downstream modules should consume.
 * This is the canonical "what fields does my module get from org?" endpoint.
 */
router.get(
  '/:orgId/reuse-contract',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { orgId } = req.params;
    const userOrgId = req.user?.organizationId;

    if (userOrgId !== orgId) {
      return res.status(403).json({ error: 'Access denied to this organization' });
    }

    try {
      const resolved = await organizationContextService.buildResolvedContext(orgId);

      return res.json({
        schemaVersion: resolved.schemaVersion,
        organizationId: resolved.organizationId,
        profile: resolved.profile,
        strategic: resolved.strategic,
        operations: {
          keyMetrics: resolved.operations.keyMetrics,
          constraints: resolved.operations.constraints,
        },
        systems: resolved.systems,
        trust: resolved.trust,
        conflictCount: resolved.conflicts.length,
        snapshotUpdatedAt: resolved.snapshotUpdatedAt,
        _contract: {
          version: `P30-B/${ORGANIZATION_CONTEXT_SCHEMA_VERSION}`,
          stableFields: [
            'profile.companyName',
            'profile.industry',
            'profile.companySize',
            'profile.defaultLanguage',
            'profile.defaultTimezone',
            'profile.currency',
            'profile.brandColor',
            'profile.accentColor',
            'profile.website',
            'strategic.mission',
            'strategic.vision',
            'strategic.priorities',
            'trust.mfa.required',
            'trust.sso.configured',
          ],
          ownershipBoundaries: {
            identity: 'organization (P30)',
            preferences: 'settings (P31)',
            security: 'admin (P32)',
            operator: 'superadmin (P33)',
          },
        },
      });
    } catch (error: any) {
      logger.error('[organization-profiles] Error building reuse contract:', error);
      return res.status(500).json({ error: 'Failed to build reuse contract' });
    }
  })
);

export default router;
