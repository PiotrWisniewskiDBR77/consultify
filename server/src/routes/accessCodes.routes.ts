/**
 * Access Codes Routes — HARDENED
 * API endpoints for managing and using access codes
 *
 * SECURITY:
 * - Rate limiting on validate/accept endpoints
 * - Sanitized responses (no org names, no attribution, no uses_count)
 * - Email from body for email-match validation
 *
 * Fully migrated to TypeScript ES modules
 */

import { Request, Response, Router } from 'express';
import rateLimit from 'express-rate-limit';

import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import { apiAuthRateLimiter } from '../middleware/rateLimiting.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { get as dbGet } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

// Apply rate limiting
const router = Router();

const serviceFallback = (
  _req: AuthRequest,
  res: Response,
  readPayload?: Record<string, unknown>
) => {
  return res.status(503).json({
    statusCode: 503,
    status: false,
    type: 'not_configured',
    message: 'Service temporarily unavailable due to missing configuration',
    ...(readPayload || {}),
  });
};

// Service interfaces
interface AccessCodeServiceInterface {
  CODE_TYPES?: {
    CONSULTANT?: string;
    TRIAL?: string;
    INVITE?: string;
    [key: string]: string | undefined;
  };
  generateCode?: (options: {
    type: string;
    createdByUserId: string;
    createdByConsultantId?: string | null;
    organizationId?: string | null;
    targetEmail?: string | null;
    maxUses?: number;
    expiresInDays?: number;
    metadata?: unknown;
  }) => Promise<{
    code: string;
    expiresAt?: string;
    maxUses?: number;
  }>;
  validatePublic?: (code: string) => Promise<{
    valid: boolean;
    type?: string;
    requiresEmailMatch?: boolean;
  }>;
  acceptCode?: (options: {
    code: string;
    actorUserId: string;
    providedEmail?: string;
    actorIp?: string;
  }) => Promise<{
    ok: boolean;
    type?: string;
    outcome?: string;
    organizationId?: string;
    error?: string;
  }>;
  listCodes?: (
    userId: string,
    role: string
  ) => Promise<
    Array<{
      id?: string;
      code?: string;
      type?: string;
      max_uses?: number;
      uses_count?: number;
      expires_at?: string;
      status?: string;
      created_at?: string;
    }>
  >;
  revokeCode?: (id: string) => Promise<void>;
}

// Dynamic import for AccessCodeService (may not be migrated yet)
let AccessCodeService: AccessCodeServiceInterface | null = null;

try {
  const serviceModule = (await import('../services/accessCodeService.js')) as any;
  AccessCodeService = (serviceModule.default || serviceModule) as AccessCodeServiceInterface;
} catch {
  logger.warn('[AccessCodes Routes] AccessCodeService not available');
}

// ─────────────────────────────────────────────────────────────────────────────
// RATE LIMITERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validate endpoint: 60 requests/min per IP
 * (Prevents enumeration attacks)
 */
const validateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { valid: false, error: 'RATE_LIMIT_EXCEEDED' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false, default: true },
  skip: () => process.env.DISABLE_RATE_LIMIT === 'true',
});

const acceptLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { ok: false, error: 'RATE_LIMIT_EXCEEDED' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false, default: true },
  skip: () => process.env.DISABLE_RATE_LIMIT === 'true',
});

// ─────────────────────────────────────────────────────────────────────────────
// ROUTES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @route POST /api/access-codes/generate
 * @desc Generate a new access code
 * @access Protected (Admin, Consultant)
 */
router.post(
  '/generate',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!AccessCodeService?.generateCode || !AccessCodeService?.CODE_TYPES) {
      return serviceFallback(req, res);
    }

    try {
      const { type, maxUses, expiresInDays, organizationId, targetEmail, metadata } = req.body;
      const userId = req.user?.id;
      const userRole = req.user?.role;

      if (!userId || !userRole) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // RBAC enforcement
      let createdByConsultantId: string | null = null;

      // Cross-org mint guard (P0 fix 2026-08-28): a code minted with
      // `organizationId` set to an org the caller does not belong to lets
      // that organizationId's victim be onboarded into via the register
      // flow (auth.routes.ts, joiningExistingOrg) once the code is used —
      // full cross-tenant privilege escalation. Only a platform superadmin
      // (signed `isSuperAdmin` claim — same guard already used below for
      // /:id/revoke) may mint a code bound to an org other than their own.
      // Applied to EVERY code type reachable from this endpoint, not just
      // CONSULTANT/TRIAL: the INVITE branch already had an (narrower,
      // pre-existing, left untouched) org check, and anything falling
      // through to neither branch (e.g. REFERRAL) previously had NO check
      // at all, which was the same escalation with an even lower bar (no
      // role requirement whatsoever).
      const userOrgId = req.user?.organizationId || req.user?.organization_id;
      const isPlatformSuperAdmin = req.user?.isSuperAdmin === true;
      const assertSameOrgUnlessPlatformSuperAdmin = () => {
        if (!isPlatformSuperAdmin && organizationId && organizationId !== userOrgId) {
          return res
            .status(403)
            .json({ error: 'Cannot generate this access code for another organization' });
        }
        return null;
      };

      if (
        type === AccessCodeService.CODE_TYPES.CONSULTANT ||
        type === AccessCodeService.CODE_TYPES.TRIAL
      ) {
        const normalizedRole = (userRole || '').toLowerCase();
        if (
          !['superadmin', 'super_admin', 'owner', 'admin', 'administrator', 'consultant'].includes(
            normalizedRole
          )
        ) {
          return res.status(403).json({ error: 'Insufficient permissions' });
        }
        if (normalizedRole === 'consultant') {
          createdByConsultantId = userId;
        }
        const blocked = assertSameOrgUnlessPlatformSuperAdmin();
        if (blocked) return blocked;
      } else if (type === AccessCodeService.CODE_TYPES.INVITE) {
        const normalizedRole = (userRole || '').toLowerCase();
        if (
          !['superadmin', 'super_admin', 'owner', 'admin', 'administrator'].includes(normalizedRole)
        ) {
          return res.status(403).json({ error: 'Only Admins can generate team invites' });
        }
        // Org scoping — pre-existing, narrower check (admin/administrator
        // only), left as-is to avoid regressing existing INVITE behavior.
        if (
          ['admin', 'administrator'].includes(normalizedRole) &&
          organizationId &&
          organizationId !== userOrgId
        ) {
          return res.status(403).json({ error: 'Cannot generate invite for another organization' });
        }
      } else {
        // REFERRAL and any other/future type: same mint-time org guard.
        const blocked = assertSameOrgUnlessPlatformSuperAdmin();
        if (blocked) return blocked;
      }

      const code = await AccessCodeService.generateCode({
        type,
        createdByUserId: userId,
        createdByConsultantId,
        organizationId:
          organizationId ||
          (type === 'INVITE' ? req.user?.organizationId || req.user?.organization_id : null),
        targetEmail: targetEmail || null,
        maxUses,
        expiresInDays,
        metadata,
      });

      // Return plaintext code (ONCE)
      return res.status(201).json({
        code: code.code,
        expiresAt: code.expiresAt,
        maxUses: code.maxUses,
      });
    } catch (err: any) {
      logger.error('[AccessCodes] Generate error:', err);
      return res.status(500).json({
        error: 'Unknown error',
      });
    }
  })
);

/**
 * @route GET /api/access-codes/validate/:code
 * @desc Validate a code (PUBLIC, rate-limited)
 * @access Public
 *
 * PRIVACY: Returns ONLY { valid, type, requiresEmailMatch }
 * NO org names, NO uses_count, NO target_email value
 */
router.get(
  '/validate/:code',
  validateLimiter,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!AccessCodeService?.validatePublic) {
      return serviceFallback(req, res, { valid: false });
    }

    try {
      const result = await AccessCodeService.validatePublic(req.params.code);
      return res.json(result);
    } catch (err: any) {
      // Always return same shape for privacy
      return serviceFallback(req, res, { valid: false });
    }
  })
);

/**
 * @route POST /api/access-codes/accept
 * @desc Accept/consume a code (PUBLIC, rate-limited)
 * @access Public (for registration) or Protected (for logged-in users)
 *
 * PRIVACY: Returns { ok, outcome, organizationId? } but NO attribution, NO sensitive metadata
 */
router.post(
  '/accept',
  acceptLimiter,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!AccessCodeService?.acceptCode) {
      return serviceFallback(req, res);
    }

    try {
      const { code, email, userId: bodyUserId } = req.body;

      // Determine user ID (logged-in takes precedence)
      const actorUserId = req.user?.id || bodyUserId;

      if (!actorUserId) {
        return res.status(400).json({ ok: false, error: 'USER_REQUIRED' });
      }

      if (!code) {
        return res.status(400).json({ ok: false, error: 'CODE_REQUIRED' });
      }

      const result = await AccessCodeService.acceptCode({
        code,
        actorUserId,
        providedEmail: email,
        actorIp: (req as Request).ip,
      });

      // Sanitize response
      if (result.ok) {
        return res.json({
          ok: true,
          type: result.type,
          outcome: result.outcome,
          organizationId: result.organizationId || null,
        });
      } else {
        return res.status(400).json({
          ok: false,
          error: result.error,
        });
      }
    } catch (err: any) {
      logger.error('[AccessCodes] Accept error:', err);
      return res.status(500).json({ ok: false, error: 'INTERNAL_ERROR' });
    }
  })
);

/**
 * @route GET /api/access-codes/my-codes
 * @desc List codes created by current user
 * @access Protected
 */
router.get(
  '/my-codes',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!AccessCodeService?.listCodes) {
      return serviceFallback(req, res, { codes: [] });
    }

    try {
      const userId = req.user?.id;
      const userRole = req.user?.role;

      if (!userId || !userRole) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const codes = await AccessCodeService.listCodes(
        userId,
        userRole === 'CONSULTANT' ? 'CONSULTANT' : 'USER'
      );

      // Sanitize: remove code_hash from response
      const sanitized = codes.map((c) => ({
        id: c.id,
        code: c.code,
        type: c.type,
        maxUses: c.max_uses,
        usesCount: c.uses_count,
        expiresAt: c.expires_at,
        status: c.status,
        createdAt: c.created_at,
      }));

      return res.json(sanitized);
    } catch (err: any) {
      logger.error('[AccessCodes] List codes error:', err);
      return res.status(500).json({
        error: 'Unknown error',
      });
    }
  })
);

/**
 * @route POST /api/access-codes/:id/revoke
 * @desc Revoke a code
 * @access Protected
 */
router.post(
  '/:id/revoke',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!AccessCodeService?.revokeCode) {
      return serviceFallback(req, res);
    }

    try {
      const codeRecord = await dbGet<{ created_by?: string }>(
        'SELECT created_by FROM access_codes WHERE id = ? LIMIT 1',
        [req.params.id],
        { fallback: true }
      );

      if (!codeRecord) {
        return res.status(404).json({ error: 'Access code not found' });
      }

      if (codeRecord.created_by !== req.user?.id && !req.user?.isSuperAdmin) {
        return res.status(403).json({ error: 'Not authorized to revoke this access code' });
      }

      await AccessCodeService.revokeCode(req.params.id);
      return res.json({ success: true });
    } catch (err: any) {
      logger.error('[AccessCodes] Revoke code error:', err);
      return res.status(500).json({
        error: 'Unknown error',
      });
    }
  })
);

export default router;
