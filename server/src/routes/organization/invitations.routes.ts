/**
 * Invitations Routes
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * All invitation-related API endpoints with Zod validation
 */

import { Router } from 'express';

import InvitationControllerRaw from '../../controllers/InvitationController.js';
const InvitationController = InvitationControllerRaw as any;
import { verifyToken } from '../../middleware/auth.middleware.js';
import { authRateLimiter } from '../../middleware/rateLimiting.middleware.js';
import { validateBody } from '../../middleware/validation.middleware.js';
import {
    AcceptInvitationSchema,
    CreateInvitationSchema,
    ResendInvitationSchema,
} from '../../validators/invitation.validators.js';

const router = Router();

// Apply rate limiting
router.use(authRateLimiter);

// Apply auth middleware to all routes (except accept)
// Note: accept endpoint doesn't require auth - uses token validation

// ==========================================
// INVITATION CRUD
// ==========================================

/**
 * GET /api/invitations
 * Get all invitations for organization
 */
router.get('/', InvitationController.getInvitations);

/**
 * POST /api/invitations
 * Create invitation
 */
router.post('/', validateBody(CreateInvitationSchema), InvitationController.createInvitation);

/**
 * POST /api/invitations/resend
 * Resend invitation
 */
router.post('/resend', validateBody(ResendInvitationSchema), InvitationController.resendInvitation);

/**
 * GET /api/invitations
 * Get all invitations for organization
 */
router.get('/', verifyToken, InvitationController.getInvitations);

/**
 * POST /api/invitations
 * Create invitation
 */
router.post('/', verifyToken, validateBody(CreateInvitationSchema), InvitationController.createInvitation);

/**
 * POST /api/invitations/resend
 * Resend invitation
 */
router.post('/resend', verifyToken, validateBody(ResendInvitationSchema), InvitationController.resendInvitation);

/**
 * POST /api/invitations/accept
 * Accept invitation (no auth required - uses token)
 */
router.post('/accept', validateBody(AcceptInvitationSchema), InvitationController.acceptInvitation);

/**
 * DELETE /api/invitations/:id
 * Cancel invitation
 */
router.delete('/:id', verifyToken, InvitationController.cancelInvitation);

/**
 * DELETE /api/invitations/:id
 * Cancel invitation
 */
router.delete('/:id', InvitationController.cancelInvitation);

export default router;
