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

import { resolveCname } from 'dns/promises';
import createDOMPurify from 'dompurify';
import { NextFunction, Response, Router } from 'express';
import fs from 'fs';
// jsdom ships no bundled types and we deliberately avoid adding @types/jsdom as a
// dependency; the only structural shape we use is `new JSDOM('').window`. With
// noImplicitAny disabled in tsconfig.build.json this resolves to an implicit
// `any` import without needing a suppression comment.
import { JSDOM } from 'jsdom';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

import { type AuthRequest, verifyToken } from '../../middleware/auth.middleware.js';
import { getRequestAccessRole, isRequestSuperAdmin } from '../../middleware/requestAccess.js';
import { verifySuperAdmin } from '../../middleware/superAdmin.middleware.js';
import { normalizeOrganizationRole } from '../../services/organizationService.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';
import { uploadsDir } from '../../utils/storagePaths.js';

const router = Router();

const brandingUpload = multer({
  storage: multer.diskStorage({
    destination: (req, _file, cb) => {
      const orgId = String(req.params.orgId || 'unknown');
      const uploadDir = uploadsDir('branding', orgId);
      cb(null, uploadDir);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || '').toLowerCase() || '.png';
      cb(null, `${uuidv4()}${ext}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    const ok = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml'].includes(
      file.mimetype
    );
    if (ok) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type') as any, false);
    }
  },
});

// ===========================================
// SVG SANITIZATION (stored-XSS hardening — M23 L-09)
// ===========================================
//
// Uploaded SVGs are served same-origin from /uploads/branding/* and can be
// opened directly (or inlined), so an attacker-supplied <script>, on* handler,
// <foreignObject>, javascript:/data: URI, or external <use href> would execute
// in our origin. We sanitize the file contents on upload with DOMPurify (SVG
// profile) and fail closed (delete the file) if sanitization is unavailable.
// A second defense layer (CSP + nosniff on /uploads responses) lives in
// server/src/index.ts.

const SVG_MIME_TYPES = new Set(['image/svg+xml']);
const SVG_EXTENSIONS = new Set(['.svg', '.svgz']);

// DOMPurify needs a DOM. On the server we back it with a JSDOM window.
// The server tsconfig has no DOM lib, so the global `Window` type is
// unavailable; createDOMPurify only needs a structurally compatible window, so
// we cast through its own first-parameter type.
const purifyWindow = new JSDOM('').window;
const svgPurifier = createDOMPurify(
  purifyWindow as unknown as Parameters<typeof createDOMPurify>[0]
);

/**
 * Returns sanitized SVG markup with all script-execution vectors removed:
 * <script>, <foreignObject>, on* event handlers, javascript:/data: URIs, and
 * external <use href>/<image>.
 */
const sanitizeSvgMarkup = (raw: string): string =>
  svgPurifier.sanitize(raw, {
    USE_PROFILES: { svg: true, svgFilters: true },
    // Defense in depth: even though the SVG profile drops most of these, we
    // forbid scripting/foreign-content vectors explicitly in case the profile
    // config ever loosens, and strip href/xlink:href so no external or
    // javascript: reference survives.
    FORBID_TAGS: ['script', 'foreignObject', 'iframe', 'a', 'use', 'image'],
    FORBID_ATTR: ['xlink:href', 'href'],
  });

const isSvgUpload = (mimetype: string | undefined, filename: string | undefined): boolean => {
  const ext = path.extname(filename || '').toLowerCase();
  return SVG_MIME_TYPES.has(String(mimetype || '').toLowerCase()) || SVG_EXTENSIONS.has(ext);
};

/**
 * Reads the just-written upload; if it is an SVG, rewrites it with sanitized
 * markup. Deletes the file and throws on any failure so we never persist
 * unsanitized SVG. Non-SVG files are left untouched.
 */
const sanitizeUploadedFileIfSvg = async (file: Express.Multer.File): Promise<void> => {
  if (!isSvgUpload(file.mimetype, file.originalname || file.filename)) return;

  try {
    const raw = await fs.promises.readFile(file.path, 'utf8');
    const clean = sanitizeSvgMarkup(raw);
    await fs.promises.writeFile(file.path, clean, 'utf8');
  } catch (err) {
    // Fail closed: remove the file we could not sanitize.
    try {
      await fs.promises.unlink(file.path);
    } catch {
      /* best-effort cleanup */
    }
    throw err;
  }
};

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

const ensureBrandingWriteAccess = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  if (isRequestSuperAdmin(req)) {
    next();
    return;
  }

  const targetOrgId = String(req.params.orgId || '');
  const requesterId = req.user?.id;
  const requesterOrgId = req.user?.organizationId || req.organizationId || '';

  if (!targetOrgId || !requesterId || requesterOrgId !== targetOrgId) {
    res.status(403).json({ error: 'Access denied to this organization branding' });
    return;
  }

  try {
    const membership = await dbGet<{ role?: string }>(
      `SELECT role FROM organization_members WHERE organization_id = ? AND user_id = ? LIMIT 1`,
      [targetOrgId, requesterId],
      { fallback: true }
    );
    const normalizedRole = normalizeOrganizationRole(membership?.role || getRequestAccessRole(req));

    if (normalizedRole === 'OWNER' || normalizedRole === 'ADMIN') {
      next();
      return;
    }
  } catch {
    // Fail closed when membership resolution is unavailable.
  }

  res.status(403).json({ error: 'Admin access required for organization branding' });
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
      logger.error('[branding] Error listing brandings', {
        err,
        correlationId: (req as any).correlationId,
      });
      return res
        .status(500)
        .json({ error: 'Failed to list brandings', code: 'BRANDING_LIST_FAILED' });
    }
  })
);

// ===========================================
// POST /api/branding/:orgId/upload - Upload branding asset
// ===========================================
router.post(
  '/:orgId/upload',
  verifyToken,
  ensureBrandingWriteAccess,
  brandingUpload.single('file'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { orgId } = req.params;
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    // Stored-XSS hardening (M23 L-09): strip scripts/handlers from SVG uploads
    // before they become same-origin servable assets. Fails closed (file
    // removed) on error.
    try {
      await sanitizeUploadedFileIfSvg(req.file);
    } catch (err: any) {
      logger.error(`[branding] SVG sanitization failed for org ${orgId}:`, err);
      return res.status(400).json({ error: 'Uploaded SVG could not be sanitized' });
    }

    const filename = req.file.filename;
    const url = `/uploads/branding/${orgId}/${filename}`;

    return res.status(201).json({
      url,
      id: filename,
      type: req.body?.type || null,
    });
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
      logger.error(`[branding] Error getting branding for ${orgId}`, {
        err,
        correlationId: (req as any).correlationId,
      });
      return res.status(500).json({ error: 'Failed to get branding', code: 'BRANDING_GET_FAILED' });
    }
  })
);

// ===========================================
// PATCH /api/branding/:orgId - Update branding (upsert)
// ===========================================

router.patch(
  '/:orgId',
  verifyToken,
  ensureBrandingWriteAccess,
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
      logger.error(`[branding] Error updating branding for ${orgId}`, {
        err,
        correlationId: (req as any).correlationId,
      });
      return res
        .status(500)
        .json({ error: 'Failed to update branding', code: 'BRANDING_UPDATE_FAILED' });
    }
  })
);

// ===========================================
// DELETE /api/branding/:orgId - Reset branding to defaults
// ===========================================

router.delete(
  '/:orgId',
  verifyToken,
  ensureBrandingWriteAccess,
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
      logger.error(`[branding] Error deleting branding for ${orgId}`, {
        err,
        correlationId: (req as any).correlationId,
      });
      return res
        .status(500)
        .json({ error: 'Failed to delete branding', code: 'BRANDING_DELETE_FAILED' });
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
      logger.error(`[branding] Error cloning branding to ${orgId}`, {
        err,
        correlationId: (req as any).correlationId,
      });
      return res
        .status(500)
        .json({ error: 'Failed to clone branding', code: 'BRANDING_CLONE_FAILED' });
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

      const domain = String((branding as any).custom_domain || '').trim();
      if (!domain) return res.status(400).json({ error: 'No custom domain configured' });

      const expectedTarget = String(process.env.BRANDING_CNAME_TARGET || 'app.consultify.com')
        .trim()
        .toLowerCase()
        .replace(/\.$/, '');

      const normalizeTarget = (value: string) =>
        String(value || '')
          .trim()
          .toLowerCase()
          .replace(/\.$/, '');

      let cnames: string[] = [];
      try {
        cnames = (await resolveCname(domain)).map(normalizeTarget).filter(Boolean);
      } catch (dnsErr: any) {
        // DNS errors are not "server errors" — they simply mean "not verified yet".
        await dbRun(
          `UPDATE organization_branding
           SET custom_domain_verified = 0,
               updated_at = datetime('now')
           WHERE organization_id = ?`,
          [orgId]
        );
        return res.json({
          verified: false,
          domain,
          expectedTarget,
          foundTargets: [],
          error: dnsErr?.code || dnsErr?.message || 'DNS lookup failed',
        });
      }

      const verified = cnames.includes(expectedTarget);

      await dbRun(
        `UPDATE organization_branding
         SET custom_domain_verified = ?,
             custom_domain_ssl_status = COALESCE(custom_domain_ssl_status, 'pending'),
             updated_at = datetime('now')
         WHERE organization_id = ?`,
        [verified ? 1 : 0, orgId]
      );

      return res.json({
        verified,
        domain,
        expectedTarget,
        foundTargets: cnames,
      });
    } catch (err: any) {
      logger.error(`[branding] Error verifying domain for ${orgId}`, {
        err,
        correlationId: (req as any).correlationId,
      });
      return res
        .status(500)
        .json({ error: 'Failed to verify domain', code: 'BRANDING_VERIFY_DOMAIN_FAILED' });
    }
  })
);

export default router;
