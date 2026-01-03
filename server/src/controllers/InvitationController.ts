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
    CreateInvitationRequest,
    ResendInvitationRequest,
    AcceptInvitationRequest,
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

        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const InvitationService = require('../../services/invitationService');
        const invitations = await InvitationService.getInvitations(orgId);

        res.json(invitations);
    });

    /**
     * Create invitation
     */
    static createInvitation = asyncHandler(async (req: AuthenticatedRequest<CreateInvitationRequest>, res: Response): Promise<void> => {
        const { email, role, organizationId, message } = req.body;
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const InvitationService = require('../../services/invitationService');
        const invitation = await InvitationService.createInvitation({
            email,
            role,
            organizationId,
            invitedById: userId,
            message,
        });

        res.status(201).json(invitation);
    });

    /**
     * Resend invitation
     */
    static resendInvitation = asyncHandler(async (req: AuthenticatedRequest<ResendInvitationRequest>, res: Response): Promise<void> => {
        const { invitationId } = req.body;
        
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const InvitationService = require('../../services/invitationService');
        const invitation = await InvitationService.resendInvitation(invitationId);

        res.json(invitation);
    });

    /**
     * Accept invitation
     */
    static acceptInvitation = asyncHandler(async (req: AuthenticatedRequest<AcceptInvitationRequest>, res: Response): Promise<void> => {
        const { token } = req.body;
        
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const InvitationService = require('../../services/invitationService');
        const result = await InvitationService.acceptInvitation(token);

        res.json(result);
    });

    /**
     * Cancel invitation
     */
    static cancelInvitation = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const { id } = req.params;
        
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const InvitationService = require('../../services/invitationService');
        await InvitationService.cancelInvitation(id);

        res.json({ message: 'Invitation cancelled' });
    });
}

export default InvitationController;

