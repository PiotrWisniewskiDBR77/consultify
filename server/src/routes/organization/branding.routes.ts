/**
 * Branding Routes - Organization White-label & Branding Configuration
 *
 * Endpoints for managing organization branding including:
 * - Logo uploads (light/dark mode, icon, favicon)
 * - Color theme customization
 * - Typography settings
 * - Login page customization
 * - Custom domain configuration
 *
 * Used by: SuperAdmin White-label Studio, Organization Settings
 */

import { Response, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

import { type AuthRequest, verifyToken } from '../../middleware/auth.middleware.js';
import { verifySuperAdmin } from '../../middleware/superAdmin.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

const router = Router();

// ===========================================
// ENSURE BRANDING TABLE EXISTS
// ===========================================

const ensureBrandingTable = async () => {
  await dbRun(`
        CREATE TABLE IF NOT EXISTS organization_branding (
            id TEXT PRIMARY KEY,
            organization_id TEXT UNIQUE NOT NULL,
            logo_light_url TEXT,
            logo_dark_url TEXT,
            logo_icon_url TEXT,
            favicon_url TEXT,
            primary_color TEXT DEFAULT '#8B5CF6',
            secondary_color TEXT DEFAULT '#3B82F6',
            accent_color TEXT DEFAULT '#10B981',
            background_color TEXT DEFAULT '#F8FAFC',
            text_color TEXT DEFAULT '#1E293B',
            dark_primary_color TEXT DEFAULT '#A78BFA',
            dark_secondary_color TEXT DEFAULT '#60A5FA',
            dark_background_color TEXT DEFAULT '#0F172A',
            dark_text_color TEXT DEFAULT '#F8FAFC',
            font_family TEXT DEFAULT 'Inter',
            heading_font_family TEXT DEFAULT 'Inter',
            login_background_url TEXT,
            login_tagline TEXT,
            login_welcome_message TEXT,
            custom_domain TEXT,
            custom_domain_verified INTEGER DEFAULT 0,
            custom_domain_ssl_status TEXT DEFAULT 'pending',
            hide_powered_by INTEGER DEFAULT 0,
            custom_support_email TEXT,
            custom_terms_url TEXT,
            custom_privacy_url TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
        )
    `);
  await dbRun(
    `CREATE INDEX IF NOT EXISTS idx_org_branding_org ON organization_branding(organization_id)`
  );
};

// Helper to map DB row to API response
const mapBrandingToResponse = (row: any) => {
  if (!row) return null;
  return {
    id: row.id,
    organizationId: row.organization_id,
    logoLightUrl: row.logo_light_url,
    logoDarkUrl: row.logo_dark_url,
    logoIconUrl: row.logo_icon_url,
    faviconUrl: row.favicon_url,
    primaryColor: row.primary_color,
    secondaryColor: row.secondary_color,
    accentColor: row.accent_color,
    backgroundColor: row.background_color,
    textColor: row.text_color,
    darkPrimaryColor: row.dark_primary_color,
    darkSecondaryColor: row.dark_secondary_color,
    darkBackgroundColor: row.dark_background_color,
    darkTextColor: row.dark_text_color,
    fontFamily: row.font_family,
    headingFontFamily: row.heading_font_family,
    loginBackgroundUrl: row.login_background_url,
    loginTagline: row.login_tagline,
    loginWelcomeMessage: row.login_welcome_message,
    customDomain: row.custom_domain,
    customDomainVerified: row.custom_domain_verified === 1,
    customDomainSslStatus: row.custom_domain_ssl_status,
    hidePoweredBy: row.hide_powered_by === 1,
    customSupportEmail: row.custom_support_email,
    customTermsUrl: row.custom_terms_url,
    customPrivacyUrl: row.custom_privacy_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

// ===========================================
// GET /api/branding - List all brandings (SuperAdmin only)
// ===========================================

router.get(
  '/',
  verifyToken,
  verifySuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      await ensureBrandingTable();

      const brandings = await dbAll(
        `SELECT b.*, o.name as organization_name 
                 FROM organization_branding b
                 LEFT JOIN organizations o ON b.organization_id = o.id
                 ORDER BY o.name ASC`,
        []
      );

      const mappedBrandings = brandings.map((b: any) => ({
        ...mapBrandingToResponse(b),
        organizationName: b.organization_name,
      }));

      logger.info(`[branding] Listed ${mappedBrandings.length} brandings`);
      return res.json({ brandings: mappedBrandings });
    } catch (err: any) {
      logger.error('[branding] Error listing brandings:', err);
      return res.status(500).json({ error: err.message });
    }
  })
);

// ===========================================
// GET /api/branding/:orgId - Get branding for organization
// ===========================================

router.get(
  '/:orgId',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { orgId } = req.params;

    try {
      await ensureBrandingTable();

      const branding = await dbGet(
        `SELECT b.*, o.name as organization_name 
                 FROM organization_branding b
                 LEFT JOIN organizations o ON b.organization_id = o.id
                 WHERE b.organization_id = ?`,
        [orgId]
      );

      if (!branding) {
        // Return default branding structure
        return res.json({
          branding: null,
          defaults: {
            primaryColor: '#8B5CF6',
            secondaryColor: '#3B82F6',
            accentColor: '#10B981',
            backgroundColor: '#F8FAFC',
            textColor: '#1E293B',
            darkPrimaryColor: '#A78BFA',
            darkSecondaryColor: '#60A5FA',
            darkBackgroundColor: '#0F172A',
            darkTextColor: '#F8FAFC',
            fontFamily: 'Inter',
            headingFontFamily: 'Inter',
            customDomainVerified: false,
            customDomainSslStatus: 'pending',
            hidePoweredBy: false,
          },
        });
      }

      return res.json({
        branding: {
          ...mapBrandingToResponse(branding),
          organizationName: (branding as any).organization_name,
        },
      });
    } catch (err: any) {
      logger.error(`[branding] Error getting branding for ${orgId}:`, err);
      return res.status(500).json({ error: err.message });
    }
  })
);

// ===========================================
// PATCH /api/branding/:orgId - Update branding (upsert)
// ===========================================

router.patch(
  '/:orgId',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { orgId } = req.params;
    const brandingData = req.body;

    try {
      await ensureBrandingTable();

      // Check if branding exists
      const existing = await dbGet(
        'SELECT id FROM organization_branding WHERE organization_id = ?',
        [orgId]
      );

      if (existing) {
        // Update existing
        const updateFields: string[] = [];
        const updateValues: any[] = [];

        const fieldMap: Record<string, string> = {
          logoLightUrl: 'logo_light_url',
          logoDarkUrl: 'logo_dark_url',
          logoIconUrl: 'logo_icon_url',
          faviconUrl: 'favicon_url',
          primaryColor: 'primary_color',
          secondaryColor: 'secondary_color',
          accentColor: 'accent_color',
          backgroundColor: 'background_color',
          textColor: 'text_color',
          darkPrimaryColor: 'dark_primary_color',
          darkSecondaryColor: 'dark_secondary_color',
          darkBackgroundColor: 'dark_background_color',
          darkTextColor: 'dark_text_color',
          fontFamily: 'font_family',
          headingFontFamily: 'heading_font_family',
          loginBackgroundUrl: 'login_background_url',
          loginTagline: 'login_tagline',
          loginWelcomeMessage: 'login_welcome_message',
          customDomain: 'custom_domain',
          customDomainVerified: 'custom_domain_verified',
          customDomainSslStatus: 'custom_domain_ssl_status',
          hidePoweredBy: 'hide_powered_by',
          customSupportEmail: 'custom_support_email',
          customTermsUrl: 'custom_terms_url',
          customPrivacyUrl: 'custom_privacy_url',
        };

        for (const [jsKey, dbKey] of Object.entries(fieldMap)) {
          if (brandingData[jsKey] !== undefined) {
            updateFields.push(`${dbKey} = ?`);
            // Handle boolean to integer conversion
            let value = brandingData[jsKey];
            if (typeof value === 'boolean') {
              value = value ? 1 : 0;
            }
            updateValues.push(value);
          }
        }

        if (updateFields.length > 0) {
          updateFields.push('updated_at = datetime("now")');
          updateValues.push(orgId);

          await dbRun(
            `UPDATE organization_branding SET ${updateFields.join(', ')} WHERE organization_id = ?`,
            updateValues
          );
        }

        logger.info(`[branding] Updated branding for organization ${orgId}`);
      } else {
        // Insert new branding
        const id = uuidv4();
        await dbRun(
          `INSERT INTO organization_branding (
                        id, organization_id, logo_light_url, logo_dark_url, logo_icon_url, favicon_url,
                        primary_color, secondary_color, accent_color, background_color, text_color,
                        dark_primary_color, dark_secondary_color, dark_background_color, dark_text_color,
                        font_family, heading_font_family, login_background_url, login_tagline, login_welcome_message,
                        custom_domain, custom_domain_verified, custom_domain_ssl_status, hide_powered_by,
                        custom_support_email, custom_terms_url, custom_privacy_url
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            orgId,
            brandingData.logoLightUrl || null,
            brandingData.logoDarkUrl || null,
            brandingData.logoIconUrl || null,
            brandingData.faviconUrl || null,
            brandingData.primaryColor || '#8B5CF6',
            brandingData.secondaryColor || '#3B82F6',
            brandingData.accentColor || '#10B981',
            brandingData.backgroundColor || '#F8FAFC',
            brandingData.textColor || '#1E293B',
            brandingData.darkPrimaryColor || '#A78BFA',
            brandingData.darkSecondaryColor || '#60A5FA',
            brandingData.darkBackgroundColor || '#0F172A',
            brandingData.darkTextColor || '#F8FAFC',
            brandingData.fontFamily || 'Inter',
            brandingData.headingFontFamily || 'Inter',
            brandingData.loginBackgroundUrl || null,
            brandingData.loginTagline || null,
            brandingData.loginWelcomeMessage || null,
            brandingData.customDomain || null,
            brandingData.customDomainVerified ? 1 : 0,
            brandingData.customDomainSslStatus || 'pending',
            brandingData.hidePoweredBy ? 1 : 0,
            brandingData.customSupportEmail || null,
            brandingData.customTermsUrl || null,
            brandingData.customPrivacyUrl || null,
          ]
        );

        logger.info(`[branding] Created branding for organization ${orgId}`);
      }

      // Fetch and return updated branding
      const updated = await dbGet('SELECT * FROM organization_branding WHERE organization_id = ?', [
        orgId,
      ]);

      return res.json({
        success: true,
        branding: mapBrandingToResponse(updated),
      });
    } catch (err: any) {
      logger.error(`[branding] Error updating branding for ${orgId}:`, err);
      return res.status(500).json({ error: err.message });
    }
  })
);

// ===========================================
// DELETE /api/branding/:orgId - Reset branding to defaults
// ===========================================

router.delete(
  '/:orgId',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { orgId } = req.params;

    try {
      await ensureBrandingTable();

      const result = await dbRun('DELETE FROM organization_branding WHERE organization_id = ?', [
        orgId,
      ]);

      if (result.changes === 0) {
        return res.status(404).json({ error: 'Branding not found for this organization' });
      }

      logger.info(`[branding] Deleted branding for organization ${orgId}`);
      return res.json({ success: true, message: 'Branding reset to defaults' });
    } catch (err: any) {
      logger.error(`[branding] Error deleting branding for ${orgId}:`, err);
      return res.status(500).json({ error: err.message });
    }
  })
);

// ===========================================
// POST /api/branding/:orgId/clone - Clone branding from another org
// ===========================================

router.post(
  '/:orgId/clone',
  verifyToken,
  verifySuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { orgId } = req.params;
    const { sourceOrgId } = req.body;

    if (!sourceOrgId) {
      return res.status(400).json({ error: 'sourceOrgId is required' });
    }

    try {
      await ensureBrandingTable();

      // Get source branding
      const source = await dbGet('SELECT * FROM organization_branding WHERE organization_id = ?', [
        sourceOrgId,
      ]);

      if (!source) {
        return res.status(404).json({ error: 'Source organization has no branding to clone' });
      }

      // Delete existing branding for target
      await dbRun('DELETE FROM organization_branding WHERE organization_id = ?', [orgId]);

      // Clone branding with new ID and target org ID
      const id = uuidv4();
      await dbRun(
        `INSERT INTO organization_branding (
                    id, organization_id, logo_light_url, logo_dark_url, logo_icon_url, favicon_url,
                    primary_color, secondary_color, accent_color, background_color, text_color,
                    dark_primary_color, dark_secondary_color, dark_background_color, dark_text_color,
                    font_family, heading_font_family, login_background_url, login_tagline, login_welcome_message,
                    hide_powered_by, custom_support_email, custom_terms_url, custom_privacy_url
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          orgId,
          (source as any).logo_light_url,
          (source as any).logo_dark_url,
          (source as any).logo_icon_url,
          (source as any).favicon_url,
          (source as any).primary_color,
          (source as any).secondary_color,
          (source as any).accent_color,
          (source as any).background_color,
          (source as any).text_color,
          (source as any).dark_primary_color,
          (source as any).dark_secondary_color,
          (source as any).dark_background_color,
          (source as any).dark_text_color,
          (source as any).font_family,
          (source as any).heading_font_family,
          (source as any).login_background_url,
          (source as any).login_tagline,
          (source as any).login_welcome_message,
          (source as any).hide_powered_by,
          (source as any).custom_support_email,
          (source as any).custom_terms_url,
          (source as any).custom_privacy_url,
        ]
      );

      logger.info(`[branding] Cloned branding from ${sourceOrgId} to ${orgId}`);

      const cloned = await dbGet('SELECT * FROM organization_branding WHERE organization_id = ?', [
        orgId,
      ]);

      return res.json({
        success: true,
        branding: mapBrandingToResponse(cloned),
      });
    } catch (err: any) {
      logger.error(`[branding] Error cloning branding to ${orgId}:`, err);
      return res.status(500).json({ error: err.message });
    }
  })
);

// ===========================================
// POST /api/branding/:orgId/verify-domain - Verify custom domain (SuperAdmin)
// ===========================================

router.post(
  '/:orgId/verify-domain',
  verifyToken,
  verifySuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { orgId } = req.params;

    try {
      await ensureBrandingTable();

      const branding = await dbGet(
        'SELECT custom_domain FROM organization_branding WHERE organization_id = ?',
        [orgId]
      );

      if (!branding || !(branding as any).custom_domain) {
        return res.status(400).json({ error: 'No custom domain configured' });
      }

      // No simulated DNS verification in runtime.
      return res.status(503).json({
        error: 'Custom domain verification is not available',
        code: 'FEATURE_UNAVAILABLE',
      });
    } catch (err: any) {
      logger.error(`[branding] Error verifying domain for ${orgId}:`, err);
      return res.status(500).json({ error: err.message });
    }
  })
);

export default router;
