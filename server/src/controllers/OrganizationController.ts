/**
 * Organization Controller
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Handles all organization-related business logic
 */

import type { Response } from 'express';

import type { AuthenticatedRequest } from '../types/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { get as dbGet } from '../utils/DbPromise.js';
import type {
  AddMemberRequest,
  CreateOrganizationRequest,
  InviteMemberRequest,
  UpdateMemberRoleRequest,
  UpdateOrganizationRequest,
} from '../validators/organization.validators.js';

const ADMIN_MEMBERSHIP_ROLES = new Set(['OWNER', 'ADMIN']);

function getDeniedGuidance(role?: string): string {
  const normalized = String(role || '')
    .trim()
    .toUpperCase();
  if (normalized === 'GUEST' || normalized === 'VIEWER') {
    return 'Guests cannot access admin tools.';
  }
  return 'You need admin access. Ask your workspace admin.';
}

function forbidden(res: Response, error: string, code: string, guidance: string): void {
  res.status(403).json({ error, code, guidance });
}

function conflict(res: Response, error: string, code: string, guidance: string): void {
  res.status(409).json({ error, code, guidance });
}

function respondIamDenial(res: Response, denial: { code: string; message: string }): void {
  const status = ['LAST_OWNER_PROTECTED', 'SELF_LOCKOUT_REJECTED'].includes(denial.code)
    ? 409
    : denial.code === 'MEMBER_NOT_FOUND'
      ? 404
      : 403;
  res.status(status).json({ error: denial.message, code: denial.code });
}

// ==========================================
// CONTROLLER METHODS
// ==========================================

export class OrganizationController {
  /**
   * Get current user's organizations
   */
  static getCurrentOrganizations = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { getUserOrganizations } = await import('../services/organizationService.js');
      const orgs = await getUserOrganizations(userId);

      console.log(
        `[OrgSwitcher] userId=${userId} orgs=${orgs.length}: ${orgs.map((o: any) => `${o.name}(${o.id})`).join(', ')}`
      );

      const currentOrgId = (req as any).organizationId;
      const enriched = orgs.map((org) => ({
        ...org,
        is_current: org.id === currentOrgId,
        access_type: org.role === 'CONSULTANT' ? 'CONSULTANT' : 'MEMBER',
      }));

      // Tenant membership/context must never be reused as a conditional browser
      // cache entry. The client intentionally requests `no-store`; make the
      // server contract explicit as defense in depth and to avoid 304 responses
      // being mistaken for failed authenticated loads.
      res.set?.('Cache-Control', 'no-store, private');
      res.json({ organizations: enriched });
    }
  );

  /**
   * Create new organization
   */
  static createOrganization = asyncHandler(
    async (req: AuthenticatedRequest<CreateOrganizationRequest>, res: Response): Promise<void> => {
      const userId = req.user?.id;
      const { name, industry, domain, vatNumber, attributionData } = req.body;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      if (!name) {
        res.status(400).json({ error: 'Name is required' });
        return;
      }

      const { createOrganization } = await import('../services/organizationService.js');
      const org = await createOrganization({
        userId,
        name,
        industry: industry || null,
        domain: domain || null,
        vatNumber: vatNumber || null,
        attributionData: (attributionData as any) || null,
      });

      res.status(201).json(org);
    }
  );

  /**
   * Get organization by ID
   */
  static getOrganizationById = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { orgId } = req.params;
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { getMembers, getOrganization } = await import('../services/organizationService.js');

      // Security check: User must be member
      const members = await getMembers(orgId);
      const isMember = members.some((m) => m.user_id === userId);
      if (!isMember && req.user?.role !== 'SUPERADMIN') {
        res.status(403).json({ error: 'Access denied' });
        return;
      }

      const org = await getOrganization(orgId);
      res.json(org);
    }
  );

  /**
   * Update organization
   */
  static updateOrganization = asyncHandler(
    async (req: AuthenticatedRequest<UpdateOrganizationRequest>, res: Response): Promise<void> => {
      const { orgId } = req.params;
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { getMembers, updateOrganization } = await import('../services/organizationService.js');
      const members = await getMembers(orgId);
      const member = members.find((m) => m.user_id === userId);
      const isAdmin = member && ['OWNER', 'ADMIN'].includes(member.role);
      const isSuperAdmin = req.user?.role === 'SUPERADMIN';
      if (!isAdmin && !isSuperAdmin) {
        res.status(403).json({ error: 'Only organization admins can update organization' });
        return;
      }

      const { name, industry, domain, vatNumber, attributionData, onboardingStatus } = req.body;
      const result = await updateOrganization(orgId, {
        name,
        industry,
        domain,
        vatNumber,
        attributionData: attributionData as any,
        onboardingStatus,
      });

      res.json({ ...result, message: 'Organization updated' });
    }
  );

  /**
   * Get organization members
   */
  static getMembers = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { orgId } = req.params;
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { getMembers } = await import('../services/organizationService.js');

      // Security check
      const members = await getMembers(orgId);
      const isMember = members.some((m) => m.user_id === userId);
      if (!isMember && req.user?.role !== 'SUPERADMIN') {
        res.status(403).json({ error: 'Access denied' });
        return;
      }

      res.json(members);
    }
  );

  /**
   * Add member to organization
   */
  static addMember = asyncHandler(
    async (req: AuthenticatedRequest<AddMemberRequest>, res: Response): Promise<void> => {
      const { orgId } = req.params;
      const { targetUserId, targetEmail, role } = req.body as AddMemberRequest & {
        targetEmail?: string;
      };
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const {
        getMembers,
        addMember: addMemberService,
        normalizeOrganizationRole,
      } = await import('../services/organizationService.js');

      const members = await getMembers(orgId);
      const currentUserMember = members.find((m) => m.user_id === userId);
      const actorRole = normalizeOrganizationRole(currentUserMember?.role || req.user?.role);
      const isSuperAdmin = req.user?.role === 'SUPERADMIN' || req.user?.role === 'SUPER_ADMIN';

      if (!currentUserMember && !isSuperAdmin) {
        forbidden(
          res,
          'Admin access required',
          'ADMIN_ACCESS_REQUIRED',
          getDeniedGuidance(req.user?.role)
        );
        return;
      }

      if (!isSuperAdmin && !ADMIN_MEMBERSHIP_ROLES.has(actorRole)) {
        forbidden(
          res,
          'Admin access required',
          'ADMIN_ACCESS_REQUIRED',
          getDeniedGuidance(actorRole)
        );
        return;
      }

      const desiredRole = normalizeOrganizationRole(role);
      if (desiredRole === 'OWNER' && actorRole !== 'OWNER' && !isSuperAdmin) {
        forbidden(
          res,
          'Only an owner can assign owner role',
          'OWNER_ACTION_REQUIRED',
          'Only an owner can do this.'
        );
        return;
      }

      let resolvedTargetUserId = targetUserId;
      const lookupEmail =
        targetEmail || (targetUserId && targetUserId.includes('@') ? targetUserId : undefined);

      if (!resolvedTargetUserId && lookupEmail) {
        const userByEmail = await dbGet<{ id: string }>(
          `SELECT id FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1`,
          [lookupEmail]
        );
        if (!userByEmail?.id) {
          res.status(404).json({
            error: 'User not found for the provided email',
            code: 'USER_NOT_FOUND',
            guidance:
              'Invite an existing workspace user or create the account before adding membership.',
          });
          return;
        }
        resolvedTargetUserId = userByEmail.id;
      }

      if (!resolvedTargetUserId) {
        res.status(400).json({
          error: 'Target user is required',
          code: 'TARGET_USER_REQUIRED',
          guidance: 'Provide a user id or an email address for the member you want to add.',
        });
        return;
      }

      const targetMember = members.find((m) => m.user_id === resolvedTargetUserId);
      if (targetMember) {
        conflict(
          res,
          'User is already a member of this organization',
          'MEMBER_ALREADY_EXISTS',
          'Open Members & Roles to update the existing membership instead of creating a duplicate.'
        );
        return;
      }

      const result = await addMemberService({
        organizationId: orgId,
        userId: resolvedTargetUserId,
        role: desiredRole,
        invitedBy: userId,
      });

      res.json(result);
    }
  );

  /**
   * Update member role
   */
  static updateMemberRole = asyncHandler(
    async (req: AuthenticatedRequest<UpdateMemberRoleRequest>, res: Response): Promise<void> => {
      const { orgId, memberId } = req.params;
      const { role } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { getMembers, normalizeOrganizationRole } =
        await import('../services/organizationService.js');
      const members = await getMembers(orgId);
      const actor = members.find((m) => m.user_id === userId);
      // Accept either the membership id or the user_id as the {memberId} path param.
      // The Members & Roles FE surfaces both fields; historically only user_id
      // matched here, so passing a membership id yielded a spurious 404
      // (MEMBER_NOT_FOUND). Resolve against both without changing the FE contract.
      const target = members.find((m) => m.user_id === memberId || m.id === memberId);
      const targetUserId = target?.user_id;
      const actorRole = normalizeOrganizationRole(actor?.role || req.user?.role);
      const currentTargetRole = normalizeOrganizationRole(target?.role);
      const nextRole = normalizeOrganizationRole(role);
      const isSuperAdmin = req.user?.role === 'SUPERADMIN' || req.user?.role === 'SUPER_ADMIN';

      if (!target?.user_id) {
        res.status(404).json({
          error: 'Member not found',
          code: 'MEMBER_NOT_FOUND',
          guidance: 'Refresh Members & Roles and try again.',
        });
        return;
      }

      if (!actor && !isSuperAdmin) {
        forbidden(
          res,
          'Admin access required',
          'ADMIN_ACCESS_REQUIRED',
          getDeniedGuidance(req.user?.role)
        );
        return;
      }

      if (!isSuperAdmin && !ADMIN_MEMBERSHIP_ROLES.has(actorRole)) {
        forbidden(
          res,
          'Admin access required',
          'ADMIN_ACCESS_REQUIRED',
          getDeniedGuidance(actorRole)
        );
        return;
      }

      if (
        (currentTargetRole === 'OWNER' || nextRole === 'OWNER') &&
        actorRole !== 'OWNER' &&
        !isSuperAdmin
      ) {
        forbidden(
          res,
          'Only an owner can change owner roles',
          'OWNER_ACTION_REQUIRED',
          'Only an owner can do this.'
        );
        return;
      }

      const ownerCount = members.filter(
        (member) => normalizeOrganizationRole(member.role) === 'OWNER'
      ).length;
      if (currentTargetRole === 'OWNER' && nextRole !== 'OWNER' && ownerCount <= 1) {
        conflict(
          res,
          'At least one owner required',
          'LAST_OWNER_PROTECTED',
          'At least one owner is required for the workspace.'
        );
        return;
      }

      if (targetUserId === userId && !['OWNER', 'ADMIN'].includes(nextRole)) {
        conflict(
          res,
          'Role change would remove your admin access',
          'SELF_LOCKOUT_REJECTED',
          'Assign another owner/admin before changing your own role.'
        );
        return;
      }

      const { changeOrganizationMemberRoleAtomicallyViaIam } =
        await import('../services/orgPeopleIamService.js');
      const iamResult = await changeOrganizationMemberRoleAtomicallyViaIam({
        actorId: userId,
        actorRole,
        organizationId: orgId,
        targetMemberId: target.user_id,
        newRole: nextRole,
      });
      if (iamResult.denied) {
        respondIamDenial(res, iamResult);
        return;
      }

      res.json({ organizationId: orgId, userId: target.user_id, role: nextRole });
    }
  );

  /**
   * Remove member from organization
   */
  static removeMember = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { orgId, memberId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { getMembers, normalizeOrganizationRole } =
        await import('../services/organizationService.js');
      const members = await getMembers(orgId);
      const actor = members.find((m) => m.user_id === userId);
      // Accept either the membership id or the user_id as the {memberId} path param
      // (see updateMemberRole) so the FE can pass whichever id it holds.
      const target = members.find((m) => m.user_id === memberId || m.id === memberId);
      const targetUserId = target?.user_id;
      const actorRole = normalizeOrganizationRole(actor?.role || req.user?.role);
      const targetRole = normalizeOrganizationRole(target?.role);
      const isSuperAdmin = req.user?.role === 'SUPERADMIN' || req.user?.role === 'SUPER_ADMIN';

      if (!target?.user_id) {
        res.status(404).json({
          error: 'Member not found',
          code: 'MEMBER_NOT_FOUND',
          guidance: 'Refresh Members & Roles and try again.',
        });
        return;
      }

      if (!actor && !isSuperAdmin) {
        forbidden(
          res,
          'Admin access required',
          'ADMIN_ACCESS_REQUIRED',
          getDeniedGuidance(req.user?.role)
        );
        return;
      }

      if (!isSuperAdmin && !ADMIN_MEMBERSHIP_ROLES.has(actorRole)) {
        forbidden(
          res,
          'Admin access required',
          'ADMIN_ACCESS_REQUIRED',
          getDeniedGuidance(actorRole)
        );
        return;
      }

      if (targetRole === 'OWNER' && actorRole !== 'OWNER' && !isSuperAdmin) {
        forbidden(
          res,
          'Only an owner can remove an owner',
          'OWNER_ACTION_REQUIRED',
          'Only an owner can do this.'
        );
        return;
      }

      const ownerCount = members.filter(
        (member) => normalizeOrganizationRole(member.role) === 'OWNER'
      ).length;
      if (targetRole === 'OWNER' && ownerCount <= 1) {
        conflict(
          res,
          'At least one owner required',
          'LAST_OWNER_PROTECTED',
          'At least one owner is required for the workspace.'
        );
        return;
      }

      if (targetUserId === userId && ['OWNER', 'ADMIN'].includes(actorRole)) {
        conflict(
          res,
          'Removal would revoke your admin access',
          'SELF_LOCKOUT_REJECTED',
          'Ask another owner/admin to remove you after access is transferred.'
        );
        return;
      }

      const { removeOrganizationMemberAtomicallyViaIam } =
        await import('../services/orgPeopleIamService.js');
      const iamResult = await removeOrganizationMemberAtomicallyViaIam({
        actorId: userId,
        actorRole,
        organizationId: orgId,
        targetMemberId: target.user_id,
      });
      if (iamResult.denied) {
        respondIamDenial(res, iamResult);
        return;
      }

      res.json({ message: 'Member removed' });
    }
  );
}

export default OrganizationController;
