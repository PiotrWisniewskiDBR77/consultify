/**
 * Invitation Controller
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Handles all invitation-related business logic
 */

import type { Response } from 'express';

import {
  buildOrgSuspendedResponseBody,
  ORG_SUSPENDED_CODE,
} from '../services/organizationSuspensionGuard.js';
import type { AuthenticatedRequest } from '../types/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import logger from '../utils/Logger.js';
import type {
  AcceptInvitationRequest,
  CreateInvitationRequest,
  ResendInvitationRequest,
} from '../validators/invitation.validators.js';

// ==========================================
// CONTROLLER METHODS
// ==========================================

export class InvitationController {
  private static resolveCorrelationId(req: AuthenticatedRequest): string | null {
    const raw =
      (req as AuthenticatedRequest & { correlationId?: string }).correlationId ||
      req.get?.('X-Correlation-ID');
    return typeof raw === 'string' && raw.trim().length > 0 ? raw.trim() : null;
  }

  private static failEnvelope(
    req: AuthenticatedRequest,
    statusCode: number,
    code: string,
    message: string
  ): {
    status: 'fail' | 'error';
    correlationId: string | null;
    error: { code: string; message: string; timestamp: string };
  } {
    return {
      status: statusCode >= 500 ? 'error' : 'fail',
      correlationId: InvitationController.resolveCorrelationId(req),
      error: {
        code,
        message,
        timestamp: new Date().toISOString(),
      },
    };
  }

  private static mapAcceptInvitationErrorStatus(message: string): number {
    const normalized = String(message || '').toLowerCase();
    const clientErrorHints = [
      'invalid invitation token',
      'invitation is ',
      'invitation has expired',
      'invitation has already been accepted',
      'email address does not match invitation',
      'already a member',
      'multi-organization support is not yet available',
      'token does not match',
      'accepted',
    ];
    return clientErrorHints.some((hint) => normalized.includes(hint)) ? 400 : 500;
  }

  /**
   * Get all invitations for organization
   */
  static getInvitations = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      if (!orgId) {
        res
          .status(401)
          .json(
            InvitationController.failEnvelope(
              req,
              401,
              'INVITATIONS_UNAUTHORIZED',
              'Authentication is required.'
            )
          );
        return;
      }

      const InvitationService = (await import('../services/invitationService.js')).default;
      const invitations = await InvitationService.getInvitations(orgId);

      res.json(invitations);
    }
  );

  /**
   * Create invitation
   */
  static createInvitation = asyncHandler(
    async (req: AuthenticatedRequest<CreateInvitationRequest>, res: Response): Promise<void> => {
      const {
        email,
        role,
        organizationId: bodyOrgId,
        message,
        projectId,
        projectRole,
        orgRole,
        consultantProfile,
        engagementType,
      } = req.body as any;
      const userId = req.user?.id;
      const organizationId = bodyOrgId || req.user?.organizationId;

      if (!userId) {
        res
          .status(401)
          .json(
            InvitationController.failEnvelope(
              req,
              401,
              'INVITATION_UNAUTHORIZED',
              'Authentication is required.'
            )
          );
        return;
      }

      if (!organizationId) {
        res
          .status(400)
          .json(
            InvitationController.failEnvelope(
              req,
              400,
              'INVITATION_ORGANIZATION_ID_REQUIRED',
              'Organization ID is required.'
            )
          );
        return;
      }

      const InvitationService = (await import('../services/invitationService.js')).default;
      try {
        // Project invitation (outside-org invite to a specific project)
        if (projectId) {
          const invitation = await InvitationService.createProjectInvitation({
            email,
            organizationId,
            projectId,
            projectRole: projectRole || undefined,
            orgRole: orgRole || role || undefined,
            invitedByUserId: userId,
            metadata: {
              message,
              consultantProfile,
              engagementType,
            },
          });

          res.status(201).json({
            success: true,
            invitation,
          });
          return;
        }

        // Organization invitation (default)
        const invitation = await InvitationService.createInvitation({
          email,
          role,
          organizationId,
          invitedByUserId: userId,
          metadata: { message },
        });

        res.status(201).json({
          success: true,
          invitation,
        });
      } catch (error: any) {
        logger.error(`[InvitationController] Create failed: ${error.message}`);
        const status =
          error.message.includes('exists') ||
          error.message.includes('already a member') ||
          error.message.includes('seats') ||
          error.message.includes('format') ||
          error.message.toLowerCase().includes('demo')
            ? 400
            : 500;
        const code =
          status === 400 ? 'INVITATION_CREATE_VALIDATION_FAILED' : 'INVITATION_CREATE_FAILED';
        res
          .status(status)
          .json(
            InvitationController.failEnvelope(
              req,
              status,
              code,
              status === 400 ? 'Invitation payload is invalid.' : 'Failed to create invitation.'
            )
          );
      }
    }
  );

  /**
   * Resend invitation
   */
  static resendInvitation = asyncHandler(
    async (req: AuthenticatedRequest<ResendInvitationRequest>, res: Response): Promise<void> => {
      const invitationId = (req.body && req.body.invitationId) || req.params.id;
      const organizationId = req.user?.organizationId;
      const userId = req.user?.id;

      if (!invitationId) {
        res
          .status(400)
          .json(
            InvitationController.failEnvelope(
              req,
              400,
              'INVITATION_ID_REQUIRED',
              'Invitation ID is required.'
            )
          );
        return;
      }
      if (!organizationId || !userId) {
        res
          .status(401)
          .json(
            InvitationController.failEnvelope(
              req,
              401,
              'INVITATION_UNAUTHORIZED',
              'Authentication is required.'
            )
          );
        return;
      }

      const InvitationService = (await import('../services/invitationService.js')).default;
      try {
        const invitation = await InvitationService.resendInvitation(
          invitationId,
          userId,
          {},
          organizationId
        );

        res.json({
          success: true,
          invitation,
        });
      } catch (error: any) {
        const status =
          error.message.includes('not found') ||
          error.message.includes('limit') ||
          error.message.includes('wait') ||
          error.message.includes('Cannot resend')
            ? 400
            : 500;
        const code =
          status === 400 ? 'INVITATION_RESEND_VALIDATION_FAILED' : 'INVITATION_RESEND_FAILED';
        res
          .status(status)
          .json(
            InvitationController.failEnvelope(
              req,
              status,
              code,
              status === 400 ? 'Invitation cannot be resent.' : 'Failed to resend invitation.'
            )
          );
      }
    }
  );

  /**
   * Accept invitation
   */
  static acceptInvitation = asyncHandler(
    async (req: AuthenticatedRequest<AcceptInvitationRequest>, res: Response): Promise<void> => {
      const { token, email, firstName, lastName, password, jobTitle, department, siteLocation } =
        req.body;

      const { acceptInvitation } = await import('../services/invitationService.js');
      try {
        const result = await acceptInvitation({
          token,
          email,
          firstName,
          lastName,
          password,
          jobTitle,
          department,
          siteLocation,
        });
        res.json(result);
      } catch (error: any) {
        // DEC-91 — the suspension refusal is not an "invalid payload" (400) nor
        // an internal fault (500), and it must reach the client as the SAME
        // machine-readable body every other DEC-91 gate returns, so one client
        // branch handles all of them. Matched on the error CODE, not on the
        // prose, so rewording the message cannot silently downgrade this to a
        // 500.
        if (error?.code === ORG_SUSPENDED_CODE) {
          res.status(403).json(buildOrgSuspendedResponseBody());
          return;
        }

        const status = InvitationController.mapAcceptInvitationErrorStatus(
          error?.message || 'Unexpected error'
        );
        res
          .status(status)
          .json(
            InvitationController.failEnvelope(
              req,
              status,
              status === 400 ? 'INVITATION_ACCEPT_INVALID' : 'INVITATION_ACCEPT_FAILED',
              status === 400
                ? 'Invitation token or payload is invalid.'
                : 'Failed to accept invitation.'
            )
          );
      }
    }
  );

  /**
   * Validate token
   */
  static validateToken = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { token } = req.params;

      const { validateInvitationToken } = await import('../services/invitationService.js');
      try {
        const result = await validateInvitationToken(token);
        res.json({ valid: true, ...result });
      } catch (error: any) {
        res
          .status(404)
          .json(
            InvitationController.failEnvelope(
              req,
              404,
              'INVITATION_TOKEN_NOT_FOUND',
              'Invitation token was not found.'
            )
          );
      }
    }
  );

  /**
   * Get invitation audit trail
   */
  static getInvitationAudit = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { id } = req.params;
      const organizationId = req.user?.organizationId;
      const userId = req.user?.id;
      if (!organizationId || !userId) {
        res
          .status(401)
          .json(
            InvitationController.failEnvelope(
              req,
              401,
              'INVITATION_UNAUTHORIZED',
              'Authentication is required.'
            )
          );
        return;
      }

      const InvitationService = (await import('../services/invitationService.js')).default;
      const audit = await InvitationService.getInvitationAudit(id, organizationId, userId);

      res.json(audit);
    }
  );

  /**
   * Cancel invitation
   */
  static cancelInvitation = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { id } = req.params;
      const organizationId = req.user?.organizationId;
      const userId = req.user?.id;
      if (!organizationId || !userId) {
        res
          .status(401)
          .json(
            InvitationController.failEnvelope(
              req,
              401,
              'INVITATION_UNAUTHORIZED',
              'Authentication is required.'
            )
          );
        return;
      }

      const InvitationService = (await import('../services/invitationService.js')).default;
      try {
        const invitation = await InvitationService.revokeInvitation(
          id,
          userId,
          '',
          {},
          organizationId
        );
        res.json({
          success: true,
          message: 'Invitation cancelled',
          invitation,
        });
      } catch (error: any) {
        const status = error.message.includes('not found') ? 404 : 400;
        const code = status === 404 ? 'INVITATION_CANCEL_NOT_FOUND' : 'INVITATION_CANCEL_INVALID';
        res
          .status(status)
          .json(
            InvitationController.failEnvelope(
              req,
              status,
              code,
              status === 404 ? 'Invitation was not found.' : 'Invitation cannot be cancelled.'
            )
          );
      }
    }
  );
}

export default InvitationController;
