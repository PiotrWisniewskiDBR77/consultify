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
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

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
    acceptCode?: (options: { code: string; actorUserId: string; providedEmail?: string; actorIp?: string }) => Promise<{
        ok: boolean;
        type?: string;
        outcome?: string;
        organizationId?: string;
        error?: string;
    }>;
    listCodes?: (
        userId: string,
        role: string,
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
    const serviceModule = await import('../../services/accessCodeService.js');
    AccessCodeService = (serviceModule.default || serviceModule) as AccessCodeServiceInterface;
} catch {
    console.warn('[AccessCodes Routes] AccessCodeService not available');
}

// ─────────────────────────────────────────────────────────────────────────────
// RATE LIMITERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validate endpoint: 60 requests/min per IP
 * (Prevents enumeration attacks)
 */
const validateLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 60,
    message: { valid: false, error: 'RATE_LIMIT_EXCEEDED' },
    standardHeaders: true,
    legacyHeaders: false,
    validate: { xForwardedForHeader: false, default: true },
});

/**
 * Accept endpoint: 20 requests/min per IP
 * (Prevents trial spam)
 */
const acceptLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 20,
    message: { ok: false, error: 'RATE_LIMIT_EXCEEDED' },
    standardHeaders: true,
    legacyHeaders: false,
    validate: { xForwardedForHeader: false, default: true },
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
            return res.status(503).json({ error: 'AccessCodeService not available' });
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

            if (type === AccessCodeService.CODE_TYPES.CONSULTANT || type === AccessCodeService.CODE_TYPES.TRIAL) {
                if (!['owner', 'administrator', 'team_member'].includes(userRole)) {
                    return res.status(403).json({ error: 'Insufficient permissions' });
                }
                if (userRole === 'team_member') {
                    createdByConsultantId = userId;
                }
            } else if (type === AccessCodeService.CODE_TYPES.INVITE) {
                if (!['owner', 'administrator'].includes(userRole)) {
                    return res.status(403).json({ error: 'Only Admins can generate team invites' });
                }
                // Org scoping
                const userOrgId = req.user?.organizationId;
                if (userRole === 'administrator' && organizationId && organizationId !== userOrgId) {
                    return res.status(403).json({ error: 'Cannot generate invite for another organization' });
                }
            }

            const code = await AccessCodeService.generateCode({
                type,
                createdByUserId: userId,
                createdByConsultantId,
                organizationId:
                    organizationId ||
                    (type === 'INVITE' ? req.user?.organizationId : null),
                targetEmail: targetEmail || null,
                maxUses,
                expiresInDays,
                metadata,
            });

            // Return plaintext code (ONCE)
            res.status(201).json({
                code: code.code,
                expiresAt: code.expiresAt,
                maxUses: code.maxUses,
            });
        } catch (err: unknown) {
            console.error('[AccessCodes] Generate error:', err);
            return res.status(500).json({
                error: err instanceof Error ? err.message : 'Unknown error',
            });
        }
    }),
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
            return res.status(503).json({ valid: false, error: 'AccessCodeService not available' });
        }

        try {
            const code = Array.isArray(req.params.code) ? req.params.code[0] : req.params.code;
            const result = await AccessCodeService.validatePublic(code);
            res.json(result);
        } catch (err: unknown) {
            // Always return same shape for privacy
            res.json({ valid: false });
        }
    }),
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
            return res.status(503).json({ ok: false, error: 'AccessCodeService not available' });
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
                res.json({
                    ok: true,
                    type: result.type,
                    outcome: result.outcome,
                    organizationId: result.organizationId || null,
                });
            } else {
                res.status(400).json({
                    ok: false,
                    error: result.error,
                });
            }
        } catch (err: unknown) {
            console.error('[AccessCodes] Accept error:', err);
            return res.status(500).json({ ok: false, error: 'INTERNAL_ERROR' });
        }
    }),
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
            return res.status(503).json({ error: 'AccessCodeService not available' });
        }

        try {
            const userId = req.user?.id;
            const userRole = req.user?.role;

            if (!userId || !userRole) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            const codes = await AccessCodeService.listCodes(userId, userRole === 'team_member' ? 'CONSULTANT' : 'USER');

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

            res.json(sanitized);
        } catch (err: unknown) {
            return res.status(500).json({
                error: err instanceof Error ? err.message : 'Unknown error',
            });
        }
    }),
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
            return res.status(503).json({ error: 'AccessCodeService not available' });
        }

        try {
            // TODO: Add ownership verification
            const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            await AccessCodeService.revokeCode(id);
            res.json({ success: true });
        } catch (err: unknown) {
            return res.status(500).json({
                error: err instanceof Error ? err.message : 'Unknown error',
            });
        }
    }),
);

export default router;
