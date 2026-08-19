import type { Response } from 'express';

import type { AuthenticatedRequest } from '../types/index.js';
import { commandInvitation, listAdminInvitations } from '../services/adminIamCommandService.js';
import {
  changeOrganizationMemberRoleAtomicallyViaIam,
  removeOrganizationMemberAtomicallyViaIam,
} from '../services/orgPeopleIamService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const fail = (res: Response, error: any) =>
  res
    .status(Number(error?.status || 400))
    .json({
      code: error?.code || 'ADMIN_IAM_COMMAND_FAILED',
      error: String(error?.message || error),
    });

export class AdminIamController {
  static list = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    res.set('Cache-Control', 'no-store, private');
    try {
      res.json({
        invitations: await listAdminInvitations(req.params.orgId, String(req.user?.id || '')),
      });
    } catch (error) {
      fail(res, error);
    }
  });
  static command = (type: 'CREATE' | 'RESEND' | 'REVOKE') =>
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const key = String(req.get('X-Idempotency-Key') || '').trim();
      if (!key) {
        res
          .status(400)
          .json({ code: 'IDEMPOTENCY_KEY_REQUIRED', error: 'X-Idempotency-Key is required' });
        return;
      }
      try {
        const result = await commandInvitation({
          org: req.params.orgId,
          actorId: String(req.user?.id || ''),
          type,
          key,
          email: req.body?.email,
          role: req.body?.role,
          invitationId: req.params.invitationId,
        });
        res.status(result.replayed ? 200 : type === 'CREATE' ? 201 : 200).json(result);
      } catch (error) {
        fail(res, error);
      }
    });
  static changeRole = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const key = String(req.get('X-Idempotency-Key') || '').trim();
    if (!key) {
      res
        .status(400)
        .json({ code: 'IDEMPOTENCY_KEY_REQUIRED', error: 'X-Idempotency-Key is required' });
      return;
    }
    try {
      const result = await changeOrganizationMemberRoleAtomicallyViaIam({
        actorId: String(req.user?.id || ''),
        actorRole: String(req.user?.role || ''),
        organizationId: req.params.orgId,
        targetMemberId: req.params.memberId,
        newRole: String(req.body?.role || ''),
        expectedRole: req.body?.expectedRole,
        idempotencyKey: key,
      });
      if (result.denied) {
        const status =
          result.code === 'MEMBER_NOT_FOUND'
            ? 404
            : ['LAST_OWNER_PROTECTED', 'SELF_LOCKOUT_REJECTED'].includes(result.code)
              ? 409
              : 403;
        res.status(status).json({ code: result.code, error: result.message });
        return;
      }
      res.json({ ...result, memberId: req.params.memberId, role: req.body.role });
    } catch (error) {
      fail(res, error);
    }
  });
  static revokeMember = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const key = String(req.get('X-Idempotency-Key') || '').trim();
    if (!key) {
      res
        .status(400)
        .json({ code: 'IDEMPOTENCY_KEY_REQUIRED', error: 'X-Idempotency-Key is required' });
      return;
    }
    try {
      const result = await removeOrganizationMemberAtomicallyViaIam({
        actorId: String(req.user?.id || ''),
        actorRole: String(req.user?.role || ''),
        organizationId: req.params.orgId,
        targetMemberId: req.params.memberId,
        expectedRole: req.body?.expectedRole,
        idempotencyKey: key,
      });
      if (result.denied) {
        const status =
          result.code === 'MEMBER_NOT_FOUND'
            ? 404
            : ['LAST_OWNER_PROTECTED', 'SELF_LOCKOUT_REJECTED'].includes(result.code)
              ? 409
              : 403;
        res.status(status).json({ code: result.code, error: result.message });
        return;
      }
      res.json({ ...result, memberId: req.params.memberId, revoked: true });
    } catch (error) {
      fail(res, error);
    }
  });
}
