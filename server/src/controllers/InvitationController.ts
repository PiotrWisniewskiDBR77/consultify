/**
 * Invitation Controller
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Handles all invitation-related business logic
 */

import type { Response } from 'express';

import type { AuthenticatedRequest } from '../types/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import type {
    AcceptInvitationRequest,
    CreateInvitationRequest,
    ResendInvitationRequest,
} from '../validators/invitation.validators.js';

// ==========================================
// CONTROLLER METHODS
// ==========================================

export class InvitationController {
    /**
     * Get all invitations for organization
     */
    static getInvitations = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const orgId = req.user?.organizationId;
        if (!orgId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const InvitationService = (await import('../services/invitationService.js')).default;
        const invitations = await InvitationService.getInvitations(orgId);

        res.json(invitations);
    });

    /**
     * Create invitation
     */
    static createInvitation = asyncHandler(
        async (req: AuthenticatedRequest<CreateInvitationRequest>, res: Response): Promise<void> => {
            const { email, role, organizationId, message } = req.body;
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({ error: 'Unauthorized' });
                return;
            }

            const InvitationService = (await import('../services/invitationService.js')).default;
            const invitation = await InvitationService.createInvitation({
                email,
                role,
                organizationId,
                invitedByUserId: userId,
                metadata: { message },
            });

            res.status(201).json(invitation);
        },
    );

    /**
     * Resend invitation
     */
    static resendInvitation = asyncHandler(
        async (req: AuthenticatedRequest<ResendInvitationRequest>, res: Response): Promise<void> => {
            const { invitationId } = req.body;

            const InvitationService = (await import('../services/invitationService.js')).default;
            const invitation = await InvitationService.resendInvitation(invitationId, req.user?.id || '');

            res.json(invitation);
        },
    );

    /**
     * Accept invitation
     */
    static acceptInvitation = asyncHandler(
        async (req: AuthenticatedRequest<AcceptInvitationRequest>, res: Response): Promise<void> => {
            const { token, email, firstName, lastName, password } = req.body;

            const { acceptInvitation } = await import('../services/invitationService.js');
            try {
                const result = await acceptInvitation({ token, email, firstName, lastName, password });
                res.json(result);
            } catch (error: any) {
                const status = error.message.includes('match') || error.message.includes('accepted') ? 400 : 500;
                res.status(status).json({ error: error.message });
            }
        },
    );

    /**
     * Validate token
     */
    static validateToken = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const { token } = req.params;

        const { validateInvitationToken } = await import('../services/invitationService.js');
        try {
            const result = await validateInvitationToken(token);
            res.json({ valid: true, ...result });
        } catch (error: any) {
            res.status(404).json({ error: error.message });
        }
    });

    /**
     * Get invitation audit trail
     */
    static getInvitationAudit = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const { id } = req.params;

        const InvitationService = (await import('../services/invitationService.js')).default;
        const audit = await InvitationService.getInvitationAudit(id);

        res.json(audit);
    });

    /**
     * Cancel invitation
     */
    static cancelInvitation = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const { id } = req.params;

        const InvitationService = (await import('../services/invitationService.js')).default;
        await InvitationService.cancelInvitation(id, req.user?.id || '');
        res.json({ message: 'Invitation cancelled' });
    });
}

export default InvitationController;
