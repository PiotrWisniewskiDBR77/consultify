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
import {
  apiAuthRateLimiter,
  invitePublicRateLimiter,
} from '../../middleware/rateLimiting.middleware.js';
import { validateBody } from '../../middleware/validation.middleware.js';
import {
  AcceptInvitationSchema,
  CreateInvitationSchema,
  ResendInvitationSchema,
} from '../../validators/invitation.validators.js';

const router = Router();

// Apply rate limiting
router.use(apiAuthRateLimiter);

// Apply auth middleware to all routes (except accept)
// Note: accept endpoint doesn't require auth - uses token validation

// ==========================================
// INVITATION CRUD
// ==========================================

/**
 * GET /api/invitations
 * Get all invitations for organization
 */
router.get('/', verifyToken, InvitationController.getInvitations);
router.get('/org', verifyToken, InvitationController.getInvitations);

/**
 * POST /api/invitations
 * Create invitation
 */
router.post(
  '/',
  verifyToken,
  validateBody(CreateInvitationSchema),
  InvitationController.createInvitation
);
router.post(
  '/org',
  verifyToken,
  validateBody(CreateInvitationSchema),
  InvitationController.createInvitation
);
router.post(
  '/project',
  verifyToken,
  validateBody(CreateInvitationSchema),
  InvitationController.createInvitation
);

/**
 * POST /api/invitations/resend
 * Resend invitation
 */
router.post(
  '/resend',
  verifyToken,
  validateBody(ResendInvitationSchema),
  InvitationController.resendInvitation
);
router.post('/:id/resend', verifyToken, InvitationController.resendInvitation);

/**
 * POST /api/invitations/accept
 * Accept invitation (no auth required - uses token)
 */
router.post(
  '/accept',
  invitePublicRateLimiter,
  validateBody(AcceptInvitationSchema),
  InvitationController.acceptInvitation
);

/**
 * GET /api/invitations/validate/:token
 * Validate token
 */
router.get('/validate/:token', invitePublicRateLimiter, InvitationController.validateToken);

/**
 * DELETE /api/invitations/:id
 * Cancel invitation
 */
router.delete('/:id', verifyToken, InvitationController.cancelInvitation);
router.post('/:id/revoke', verifyToken, InvitationController.cancelInvitation);

/**
 * GET /api/invitations/:id/audit
 * Get audit trail
 */
router.get('/:id/audit', verifyToken, InvitationController.getInvitationAudit);

export default router;
