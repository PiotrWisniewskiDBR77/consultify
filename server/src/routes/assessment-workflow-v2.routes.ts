/**
 * Assessment Workflow Routes v2
 * Assessment -> Initiatives workflow endpoints
 *
 * Endpoints:
 * - POST /api/assessment-workflow - Create assessment
 * - GET /api/assessment-workflow - List assessments
 * - GET /api/assessment-workflow/sessions - Get open sessions for submenu
 * - GET /api/assessment-workflow/:assessmentId - Get assessment
 * - PUT /api/assessment-workflow/:assessmentId - Update assessment
 * - DELETE /api/assessment-workflow/:assessmentId - Delete assessment
 * - POST /api/assessment-workflow/:assessmentId/session/open - Open session
 * - POST /api/assessment-workflow/:assessmentId/session/close - Close session
 * - POST /api/assessment-workflow/:assessmentId/request-review - Request review (DRAFT -> IN_REVIEW)
 * - POST /api/assessment-workflow/:assessmentId/report - Generate report
 * - POST /api/assessment-workflow/:assessmentId/report/approve - Approve report (required before assessment approval)
 * - POST /api/assessment-workflow/:assessmentId/approve - Approve assessment (IN_REVIEW/AWAITING_APPROVAL -> APPROVED)
 * - POST /api/assessment-workflow/:assessmentId/send-back - Send back to draft
 * - POST /api/assessment-workflow/:assessmentId/generate-initiatives - Generate initiatives (only after APPROVED)
 * - GET /api/assessment-workflow/:assessmentId/generated-initiatives - Get generated initiatives
 */

import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

import AssessmentControllerRaw from '../controllers/AssessmentController.js';
const AssessmentController = AssessmentControllerRaw as any;
import { getDatabase } from '../database/index.js';
import { verifyToken } from '../middleware/auth.middleware.js';
import { demoContextMiddleware } from '../middleware/demoGuard.middleware.js';
import { authRateLimiter } from '../middleware/rateLimiting.middleware.js';
import { validateBody } from '../middleware/validation.middleware.js';
import AssessmentPermissionService from '../services/assessmentPermissionService.js';
import NotificationService from '../services/notificationService.js';
import logger from '../utils/Logger.js';
import {
  ApproveAssessmentAccessRequestSchema,
  ApproveAssessmentSchema,
  ApproveReportSchema,
  AssignAssessmentRoleSchema,
  CreateAssessmentSchema,
  CreateManualInitiativeFromAssessmentSchema,
  GenerateInitiativesSchema,
  GenerateReportSchema,
  RejectAssessmentAccessRequestSchema,
  RequestReviewSchema,
  SendBackSchema,
  UpdateAssessmentSchema,
  UpdateUserStateSchema,
  UpsertAssessmentRoleSchema,
  UpsertAssignmentSchema,
} from '../validators/assessment.validators.js';

const router = Router();

// Apply middleware
router.use(authRateLimiter);
router.use(verifyToken);
router.use(demoContextMiddleware);

function getAuthContext(req: any): {
  userId: string | null;
  organizationId: string;
  globalRole: string;
} {
  const userId = req?.user?.id || req?.userId || null;
  const organizationId = req?.user?.organizationId || req?.organizationId || 'org-default';
  const globalRole = String(req?.user?.role || req?.userRole || '').toUpperCase();
  return { userId, organizationId, globalRole };
}

function isGlobalAdminRole(globalRole: string): boolean {
  return (
    globalRole === 'ADMIN' ||
    globalRole === 'ADMINISTRATOR' ||
    globalRole === 'OWNER' ||
    globalRole === 'SUPERADMIN' ||
    globalRole === 'SUPER_ADMIN'
  );
}

async function requireAssessmentFlag(req: any, res: any, flag: keyof any): Promise<boolean> {
  const { assessmentId } = req.params as any;
  const { userId, organizationId, globalRole } = getAuthContext(req);

  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }

  if (isGlobalAdminRole(globalRole)) return true;

  try {
    const roleInfo = await AssessmentPermissionService.getUserRole(
      String(assessmentId),
      String(userId),
      String(organizationId)
    );
    const allowed = Boolean((roleInfo as any)?.permissions?.[flag]);
    if (!allowed) {
      res.status(403).json({
        error: 'Permission denied',
        required: String(flag),
        role: roleInfo.role,
      });
      return false;
    }
    return true;
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to evaluate permissions', message: e?.message });
    return false;
  }
}

async function requireAssessmentPermission(
  req: any,
  res: any,
  permission: 'canManage' | 'canManageTeam'
): Promise<boolean> {
  const { assessmentId } = req.params as any;
  const { userId, organizationId, globalRole } = getAuthContext(req);

  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }

  if (isGlobalAdminRole(globalRole)) return true;

  try {
    const allowed = await AssessmentPermissionService.hasPermission(
      String(assessmentId),
      String(userId),
      String(organizationId),
      permission
    );
    if (!allowed) {
      res.status(403).json({
        error: 'Permission denied',
        required: permission,
      });
      return false;
    }
    return true;
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to evaluate permissions', message: e?.message });
    return false;
  }
}

// List assessments
router.get('/', AssessmentController.listAssessments);

// Get open sessions (for dynamic submenu)
router.get('/sessions', AssessmentController.getOpenSessions);

/**
 * GET /api/assessment-workflow-v2/:assessmentId/users
 * Lightweight user lookup for Team management (same org).
 */
router.get('/:assessmentId/users', async (req, res) => {
  try {
    const { assessmentId } = req.params as any;
    const { userId, organizationId } = getAuthContext(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const ok = await requireAssessmentPermission(req, res, 'canManageTeam');
    if (!ok) return;

    const q = String((req.query as any)?.query || '')
      .trim()
      .toLowerCase();
    const db = getDatabase();

    const limit = 20;
    const rows = await db.all<any>(
      `SELECT id, email, first_name, last_name, role, status
       FROM users
       WHERE organization_id = ?
         AND (
           ? = '' OR
           lower(email) LIKE ? OR
           lower(first_name) LIKE ? OR
           lower(last_name) LIKE ?
         )
       ORDER BY created_at DESC
       LIMIT ?`,
      [String(organizationId), q, `%${q}%`, `%${q}%`, `%${q}%`, limit]
    );

    const users = (rows || []).map((u: any) => ({
      id: u.id,
      email: u.email,
      firstName: u.first_name,
      lastName: u.last_name,
      role: u.role,
      status: u.status,
      name: u.first_name && u.last_name ? `${u.first_name} ${u.last_name}` : u.email || u.id,
    }));

    return res.json({ users });
  } catch (err: any) {
    logger.error('[AssessmentWorkflowV2] Error searching users:', err);
    return res.status(500).json({ error: 'Failed to search users', message: err.message });
  }
});

// Create assessment
router.post('/', validateBody(CreateAssessmentSchema), async (req, res, next) => {
  const { globalRole } = getAuthContext(req);
  if (!isGlobalAdminRole(globalRole)) {
    return res.status(403).json({ error: 'Only admins can create assessments' });
  }
  return (AssessmentController.createAssessment as any)(req, res, next);
});

// Get assessment by ID
router.get('/:assessmentId', AssessmentController.getAssessment);

// Update assessment
router.put(
  '/:assessmentId',
  validateBody(UpdateAssessmentSchema),
  AssessmentController.updateAssessment
);

// Enterprise: per-user state (resume)
router.get('/:assessmentId/user-state', AssessmentController.getUserState);
router.put(
  '/:assessmentId/user-state',
  validateBody(UpdateUserStateSchema),
  AssessmentController.updateUserState
);

// Enterprise: assignments
router.get('/:assessmentId/assignments', AssessmentController.listAssignments);
router.put(
  '/:assessmentId/assignments',
  validateBody(UpsertAssignmentSchema),
  AssessmentController.upsertAssignment
);

// Delete assessment
router.delete('/:assessmentId', AssessmentController.deleteAssessment);

// Session management (for dynamic submenu)
router.post('/:assessmentId/session/open', AssessmentController.openSession);
router.post('/:assessmentId/session/close', AssessmentController.closeSession);

// Workflow transitions
router.post(
  '/:assessmentId/request-review',
  validateBody(RequestReviewSchema),
  async (req, res, next) => {
    const ok = await requireAssessmentFlag(req, res, 'canChangeStatus');
    if (!ok) return;
    return (AssessmentController.requestReview as any)(req, res, next);
  }
);
router.post(
  '/:assessmentId/report',
  validateBody(GenerateReportSchema),
  AssessmentController.generateReport
);
router.post(
  '/:assessmentId/report/approve',
  validateBody(ApproveReportSchema),
  AssessmentController.approveReport
);
router.post(
  '/:assessmentId/approve',
  validateBody(ApproveAssessmentSchema),
  async (req, res, next) => {
    const ok = await requireAssessmentFlag(req, res, 'canApprove');
    if (!ok) return;
    return (AssessmentController.approveAssessment as any)(req, res, next);
  }
);
router.post('/:assessmentId/send-back', validateBody(SendBackSchema), async (req, res, next) => {
  const ok = await requireAssessmentFlag(req, res, 'canApprove');
  if (!ok) return;
  return (AssessmentController.sendBackToDraft as any)(req, res, next);
});

// =============================================================================
// PERMISSIONS & ACCESS REQUESTS (v2)
// =============================================================================

/**
 * GET /api/assessment-workflow-v2/:assessmentId/my-role
 */
router.get('/:assessmentId/my-role', async (req, res) => {
  try {
    const { assessmentId } = req.params as any;
    const { userId, organizationId, globalRole } = getAuthContext(req);

    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    if (isGlobalAdminRole(globalRole)) {
      return res.json({
        role: 'admin',
        permissions: AssessmentPermissionService.getDefaultPermissions('admin'),
        assignedAreas: null,
        isOwner: true,
      });
    }

    const roleInfo = await AssessmentPermissionService.getUserRole(
      String(assessmentId),
      String(userId),
      String(organizationId)
    );
    return res.json(roleInfo);
  } catch (err: any) {
    logger.error('[AssessmentWorkflowV2] Error getting user role:', err);
    return res.status(500).json({ error: 'Failed to get user role', message: err.message });
  }
});

/**
 * GET /api/assessment-workflow-v2/:assessmentId/roles
 */
router.get('/:assessmentId/roles', async (req, res) => {
  try {
    const { assessmentId } = req.params as any;
    const { userId, organizationId, globalRole } = getAuthContext(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const canManage = isGlobalAdminRole(globalRole)
      ? true
      : await AssessmentPermissionService.hasPermission(
          String(assessmentId),
          String(userId),
          String(organizationId),
          'canManage'
        );
    if (!canManage)
      return res.status(403).json({ error: 'You do not have permission to view roles' });

    const roles = await AssessmentPermissionService.getAssessmentRoles(
      String(assessmentId),
      String(organizationId)
    );
    return res.json({ roles });
  } catch (err: any) {
    logger.error('[AssessmentWorkflowV2] Error getting assessment roles:', err);
    return res.status(500).json({ error: 'Failed to get roles', message: err.message });
  }
});

/**
 * GET /api/assessment-workflow-v2/:assessmentId/eligibility
 * Enterprise: returns a compact authorization decision + gates for the current user.
 */
router.get('/:assessmentId/eligibility', async (req, res) => {
  try {
    const { assessmentId } = req.params as any;
    const { userId, organizationId, globalRole } = getAuthContext(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const db = getDatabase();
    const assessment = await db.get<any>(
      `SELECT id, assessment_type, status, completion_percent, confidence_avg, report_approved_at, approved_at, created_by, updated_by, updated_at
       FROM assessments
       WHERE id = ? AND organization_id = ?`,
      [String(assessmentId), String(organizationId)]
    );

    if (!assessment) return res.status(404).json({ error: 'Assessment not found' });

    const roleInfo = isGlobalAdminRole(globalRole)
      ? {
          role: 'admin',
          permissions: AssessmentPermissionService.getDefaultPermissions('admin'),
          assignedAreas: null,
          isOwner: true,
        }
      : await AssessmentPermissionService.getUserRole(
          String(assessmentId),
          String(userId),
          String(organizationId)
        );

    const completion = Number(assessment.completion_percent || 0);
    const confidence = Number(assessment.confidence_avg || 0);
    const dodPass = completion >= 100 && confidence >= 3;
    const reportApproved = Boolean(assessment.report_approved_at);

    // SoD (warning): approver should not be the last editor
    const sodWarn =
      assessment.updated_by && String(assessment.updated_by) === String(userId) ? true : false;

    const checks = [
      {
        key: 'auth',
        label: 'Authenticated user',
        pass: true,
        severity: 'blocking',
      },
      {
        key: 'role',
        label: 'Assessment role assigned',
        pass: Boolean(roleInfo?.permissions?.canView),
        severity: 'blocking',
        reason: roleInfo?.permissions?.canView ? undefined : 'No view permission',
      },
      {
        key: 'dod',
        label: 'Definition of done (DoD)',
        pass: dodPass,
        severity: 'blocking',
        reason: dodPass ? undefined : 'Requires completion >= 100% and confidence >= 3',
      },
      {
        key: 'sod',
        label: 'Segregation of duties (SoD)',
        pass: !sodWarn,
        severity: 'warning',
        reason: sodWarn ? 'Approver is also the last editor' : undefined,
      },
    ] as const;

    const actions = {
      requestReview: {
        allowed:
          Boolean(roleInfo?.permissions?.canChangeStatus) && String(assessment.status) === 'DRAFT',
        blockedBy: [
          !roleInfo?.permissions?.canChangeStatus ? 'Missing canChangeStatus permission' : null,
          String(assessment.status) !== 'DRAFT' ? 'Assessment not in DRAFT' : null,
          !dodPass ? 'DoD not satisfied' : null,
        ].filter(Boolean),
      },
      approve: {
        allowed:
          Boolean(roleInfo?.permissions?.canApprove) &&
          String(assessment.status) === 'AWAITING_APPROVAL' &&
          reportApproved,
        blockedBy: [
          !roleInfo?.permissions?.canApprove ? 'Missing canApprove permission' : null,
          String(assessment.status) !== 'AWAITING_APPROVAL'
            ? 'Assessment not awaiting approval'
            : null,
          !reportApproved ? 'Report must be approved first' : null,
          !dodPass ? 'DoD not satisfied' : null,
        ].filter(Boolean),
      },
      sendBack: {
        allowed:
          Boolean(roleInfo?.permissions?.canApprove) &&
          ['IN_REVIEW', 'AWAITING_APPROVAL'].includes(String(assessment.status)),
        blockedBy: [
          !roleInfo?.permissions?.canApprove ? 'Missing canApprove permission' : null,
          !['IN_REVIEW', 'AWAITING_APPROVAL'].includes(String(assessment.status))
            ? 'Assessment not in review'
            : null,
        ].filter(Boolean),
      },
      generateInitiatives: {
        allowed:
          Boolean(roleInfo?.permissions?.canGenerateInitiatives) &&
          String(assessment.status) === 'APPROVED' &&
          dodPass,
        blockedBy: [
          !roleInfo?.permissions?.canGenerateInitiatives
            ? 'Missing canGenerateInitiatives permission'
            : null,
          String(assessment.status) !== 'APPROVED' ? 'Assessment not APPROVED' : null,
          !dodPass ? 'DoD not satisfied' : null,
        ].filter(Boolean),
      },
    };

    return res.json({
      assessment: {
        id: assessment.id,
        type: assessment.assessment_type,
        status: assessment.status,
        completionPercent: completion,
        confidenceAvg: confidence,
        updatedAt: assessment.updated_at,
      },
      roleInfo,
      checks,
      actions,
    });
  } catch (err: any) {
    logger.error('[AssessmentWorkflowV2] Error building eligibility:', err);
    return res.status(500).json({ error: 'Failed to build eligibility', message: err.message });
  }
});

/**
 * POST /api/assessment-workflow-v2/:assessmentId/access-requests
 */
router.post('/:assessmentId/access-requests', async (req, res) => {
  try {
    const { assessmentId } = req.params as any;
    const { userId, organizationId } = getAuthContext(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { requestedRole, requestedAreas, justification, priority } = req.body || {};
    const request = await AssessmentPermissionService.createAccessRequest({
      assessmentId: String(assessmentId),
      organizationId: String(organizationId),
      requesterId: String(userId),
      requestedRole,
      requestedAreas,
      justification,
      priority,
    });

    // Notify admins (best-effort)
    try {
      const admins = await AssessmentPermissionService.getAssessmentAdmins(
        String(assessmentId),
        String(organizationId)
      );
      const requesterName = (req as any)?.user?.name || (req as any)?.user?.email || 'A user';
      for (const admin of admins) {
        await NotificationService.send({
          userId: admin.userId,
          organizationId,
          type: 'ASSESSMENT_ACCESS_REQUEST',
          title: 'New access request',
          body: `${requesterName} requested ${requestedRole} access`,
          entityType: 'assessment_access_request',
          entityId: request.id,
          actionUrl: `/assessment/drd/${assessmentId}?manage=access-requests`,
          actorId: userId,
          actorName: requesterName,
          priority: priority === 'URGENT' ? 'urgent' : priority === 'HIGH' ? 'high' : 'normal',
        });
      }
    } catch {
      // ignore
    }

    return res.status(201).json(request);
  } catch (err: any) {
    logger.error('[AssessmentWorkflowV2] Error creating access request:', err);
    return res.status(500).json({ error: err.message || 'Failed to create access request' });
  }
});

/**
 * GET /api/assessment-workflow-v2/:assessmentId/access-requests
 */
router.get('/:assessmentId/access-requests', async (req, res) => {
  try {
    const { assessmentId } = req.params as any;
    const { userId, organizationId, globalRole } = getAuthContext(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const canManage = isGlobalAdminRole(globalRole)
      ? true
      : await AssessmentPermissionService.hasPermission(
          String(assessmentId),
          String(userId),
          String(organizationId),
          'canManage'
        );
    if (!canManage) {
      return res.status(403).json({ error: 'You do not have permission to view access requests' });
    }

    const status = (req.query as any)?.status as
      | 'PENDING'
      | 'APPROVED'
      | 'REJECTED'
      | 'CANCELLED'
      | undefined;
    const requests = await AssessmentPermissionService.getAccessRequests(
      String(assessmentId),
      String(organizationId),
      status
    );
    return res.json({ requests });
  } catch (err: any) {
    logger.error('[AssessmentWorkflowV2] Error getting access requests:', err);
    return res.status(500).json({ error: 'Failed to get access requests', message: err.message });
  }
});

/**
 * POST /api/assessment-workflow-v2/:assessmentId/access-requests/:requestId/approve
 */
router.post(
  '/:assessmentId/access-requests/:requestId/approve',
  validateBody(ApproveAssessmentAccessRequestSchema),
  async (req, res) => {
    try {
      const { requestId, assessmentId } = req.params as any;
      const { userId } = getAuthContext(req);

      const ok = await requireAssessmentPermission(req, res, 'canManage');
      if (!ok) return;

      const { grantedRole, grantedAreas, grantedPermissions, notes } = req.body || {};
      const updated = await AssessmentPermissionService.approveAccessRequest({
        requestId: String(requestId),
        reviewerId: String(userId),
        grantedRole,
        grantedAreas: grantedAreas || undefined,
        grantedPermissions: grantedPermissions || undefined,
        notes,
      });

      return res.json({ request: updated, assessmentId: String(assessmentId) });
    } catch (err: any) {
      logger.error('[AssessmentWorkflowV2] Error approving access request:', err);
      return res.status(500).json({ error: err.message || 'Failed to approve access request' });
    }
  }
);

/**
 * POST /api/assessment-workflow-v2/:assessmentId/access-requests/:requestId/reject
 */
router.post(
  '/:assessmentId/access-requests/:requestId/reject',
  validateBody(RejectAssessmentAccessRequestSchema),
  async (req, res) => {
    try {
      const { requestId, assessmentId } = req.params as any;
      const { userId } = getAuthContext(req);

      const ok = await requireAssessmentPermission(req, res, 'canManage');
      if (!ok) return;

      const { reason } = req.body || {};
      const updated = await AssessmentPermissionService.rejectAccessRequest(
        String(requestId),
        String(userId),
        String(reason)
      );

      return res.json({ request: updated, assessmentId: String(assessmentId) });
    } catch (err: any) {
      logger.error('[AssessmentWorkflowV2] Error rejecting access request:', err);
      return res.status(500).json({ error: err.message || 'Failed to reject access request' });
    }
  }
);

/**
 * POST /api/assessment-workflow-v2/:assessmentId/access-requests/:requestId/cancel
 * - requester can cancel their own PENDING request
 * - managers/admins can cancel any PENDING request
 */
router.post('/:assessmentId/access-requests/:requestId/cancel', async (req, res) => {
  try {
    const { requestId, assessmentId } = req.params as any;
    const { userId, organizationId, globalRole } = getAuthContext(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const canManage = isGlobalAdminRole(globalRole)
      ? true
      : await AssessmentPermissionService.hasPermission(
          String(assessmentId),
          String(userId),
          String(organizationId),
          'canManage'
        );

    if (canManage) {
      const db = getDatabase();
      const now = new Date().toISOString();
      await db.run(
        `UPDATE assessment_access_requests
         SET status = 'CANCELLED',
             reviewed_by = ?,
             reviewed_at = ?,
             review_notes = COALESCE(review_notes, 'Cancelled by manager'),
             updated_at = ?
         WHERE id = ? AND assessment_id = ? AND organization_id = ? AND status = 'PENDING'`,
        [String(userId), now, now, String(requestId), String(assessmentId), String(organizationId)]
      );
      return res.json({ ok: true });
    }

    const ok = await AssessmentPermissionService.cancelAccessRequest(
      String(requestId),
      String(userId)
    );
    if (!ok) return res.status(404).json({ error: 'Request not found or not cancellable' });
    return res.json({ ok: true });
  } catch (err: any) {
    logger.error('[AssessmentWorkflowV2] Error cancelling access request:', err);
    return res.status(500).json({ error: err.message || 'Failed to cancel access request' });
  }
});

// =============================================================================
// TEAM (roles) – v2
// =============================================================================

/**
 * POST /api/assessment-workflow-v2/:assessmentId/roles
 * Assign a role to a user (or upsert).
 */
router.post('/:assessmentId/roles', validateBody(AssignAssessmentRoleSchema), async (req, res) => {
  try {
    const { assessmentId } = req.params as any;
    const { userId: actorId, organizationId } = getAuthContext(req);
    if (!actorId) return res.status(401).json({ error: 'Unauthorized' });

    const ok = await requireAssessmentPermission(req, res, 'canManageTeam');
    if (!ok) return;

    const { userId, role, permissions, assignedAreas } = req.body || {};

    // Ensure target user exists in org (better UX than silent assignment)
    const db = getDatabase();
    const user = await db.get<any>(`SELECT id FROM users WHERE id = ? AND organization_id = ?`, [
      String(userId),
      String(organizationId),
    ]);
    if (!user) return res.status(400).json({ error: 'User not found in this organization' });

    const record = await AssessmentPermissionService.assignRole({
      assessmentId: String(assessmentId),
      userId: String(userId),
      organizationId: String(organizationId),
      role,
      assignedBy: String(actorId),
      permissions: permissions || undefined,
      assignedAreas: assignedAreas || undefined,
    });

    return res.status(201).json({ role: record });
  } catch (err: any) {
    logger.error('[AssessmentWorkflowV2] Error assigning role:', err);
    return res.status(500).json({ error: err.message || 'Failed to assign role' });
  }
});

/**
 * PUT /api/assessment-workflow-v2/:assessmentId/roles/:userId
 * Update role for an existing user assignment (upsert).
 */
router.put(
  '/:assessmentId/roles/:userId',
  validateBody(UpsertAssessmentRoleSchema),
  async (req, res) => {
    try {
      const { assessmentId, userId } = req.params as any;
      const { userId: actorId, organizationId } = getAuthContext(req);
      if (!actorId) return res.status(401).json({ error: 'Unauthorized' });

      const ok = await requireAssessmentPermission(req, res, 'canManageTeam');
      if (!ok) return;

      const { role, permissions, assignedAreas } = req.body || {};
      const record = await AssessmentPermissionService.assignRole({
        assessmentId: String(assessmentId),
        userId: String(userId),
        organizationId: String(organizationId),
        role,
        assignedBy: String(actorId),
        permissions: permissions || undefined,
        assignedAreas: assignedAreas || undefined,
      });

      return res.json({ role: record });
    } catch (err: any) {
      logger.error('[AssessmentWorkflowV2] Error updating role:', err);
      return res.status(500).json({ error: err.message || 'Failed to update role' });
    }
  }
);

/**
 * DELETE /api/assessment-workflow-v2/:assessmentId/roles/:userId
 * Remove role assignment.
 */
router.delete('/:assessmentId/roles/:userId', async (req, res) => {
  try {
    const { assessmentId, userId } = req.params as any;
    const { organizationId } = getAuthContext(req);

    const ok = await requireAssessmentPermission(req, res, 'canManageTeam');
    if (!ok) return;

    const removed = await AssessmentPermissionService.removeRole(
      String(assessmentId),
      String(userId),
      String(organizationId)
    );
    if (!removed) return res.status(404).json({ error: 'Role not found' });
    return res.json({ ok: true });
  } catch (err: any) {
    logger.error('[AssessmentWorkflowV2] Error removing role:', err);
    return res.status(500).json({ error: err.message || 'Failed to remove role' });
  }
});

// Initiative generation
router.post(
  '/:assessmentId/generate-initiatives',
  validateBody(GenerateInitiativesSchema),
  async (req, res, next) => {
    const ok = await requireAssessmentFlag(req, res, 'canGenerateInitiatives');
    if (!ok) return;
    return (AssessmentController.generateInitiatives as any)(req, res, next);
  }
);
router.get('/:assessmentId/generated-initiatives', AssessmentController.getGeneratedInitiatives);

/**
 * GET /api/assessment-workflow-v2/:assessmentId/initiative-batches
 * List initiative generation batches for this assessment.
 */
router.get('/:assessmentId/initiative-batches', async (req, res) => {
  try {
    const { assessmentId } = req.params as any;
    const { userId, organizationId } = getAuthContext(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const roleInfo = await AssessmentPermissionService.getUserRole(
      String(assessmentId),
      String(userId),
      String(organizationId)
    );
    if (!roleInfo?.permissions?.canView) {
      return res.status(403).json({ error: 'Permission denied', required: 'canView' });
    }

    const db = getDatabase();
    const rows = await db.all<any>(
      `SELECT b.id, b.methodology_id, b.initiatives_count, b.include_chat_context, b.generated_by, b.created_at,
              u.email as user_email, u.first_name as user_first_name, u.last_name as user_last_name
       FROM assessment_initiative_batches b
       LEFT JOIN users u ON b.generated_by = u.id
       WHERE b.assessment_id = ?
       ORDER BY b.created_at DESC
       LIMIT 50`,
      [String(assessmentId)]
    );

    const batches = (rows || []).map((r: any) => ({
      id: r.id,
      methodologyId: r.methodology_id,
      initiativesCount: r.initiatives_count,
      includeChatContext: Boolean(r.include_chat_context),
      generatedBy: r.generated_by,
      generatedByName:
        r.user_first_name && r.user_last_name
          ? `${r.user_first_name} ${r.user_last_name}`
          : r.user_email || r.generated_by,
      createdAt: r.created_at,
    }));

    return res.json({ batches });
  } catch (err: any) {
    logger.error('[AssessmentWorkflowV2] Error listing initiative batches:', err);
    return res.status(500).json({ error: 'Failed to list batches', message: err.message });
  }
});

/**
 * POST /api/assessment-workflow-v2/:assessmentId/initiatives
 * Create a manual DRAFT initiative linked to this assessment.
 */
router.post(
  '/:assessmentId/initiatives',
  validateBody(CreateManualInitiativeFromAssessmentSchema),
  async (req, res) => {
    try {
      const { assessmentId } = req.params as any;
      const { userId, organizationId } = getAuthContext(req);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const roleInfo = await AssessmentPermissionService.getUserRole(
        String(assessmentId),
        String(userId),
        String(organizationId)
      );
      if (!roleInfo?.permissions?.canEdit) {
        return res.status(403).json({ error: 'Permission denied', required: 'canEdit' });
      }

      const db = getDatabase();
      const assessment = await db.get<any>(
        `SELECT id, organization_id, project_id, assessment_type, name
         FROM assessments
         WHERE id = ? AND organization_id = ?`,
        [String(assessmentId), String(organizationId)]
      );
      if (!assessment) return res.status(404).json({ error: 'Assessment not found' });

      const now = new Date().toISOString();
      const initiativeId = uuidv4();
      const linkId = uuidv4();
      const batchId = `manual-${initiativeId}`;

      const { title, description, category, priority, risk } = req.body || {};

      // Persist initiative (minimal fields; keep consistent with generated initiatives)
      await db.run(
        `INSERT INTO initiatives (
          id, organization_id, project_id, name, title, description,
          status, priority, risk_level, category, source_type, source_id,
          created_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          String(initiativeId),
          String(assessment.organization_id),
          assessment.project_id || null,
          String(title),
          String(title),
          description ? String(description) : null,
          'DRAFT',
          (priority || 'medium').toString(),
          (risk || 'medium').toString(),
          category ? String(category) : null,
          'assessment',
          String(assessmentId),
          String(userId),
          now,
          now,
        ]
      );

      // Create a synthetic batch so history is consistent
      await db.run(
        `INSERT INTO assessment_initiative_batches (
          id, assessment_id, methodology_id, initiatives_count, include_chat_context, generated_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [batchId, String(assessmentId), 'manual', 1, 0, String(userId), now]
      );

      // Link row
      await db.run(
        `INSERT INTO assessment_initiative_links (id, assessment_id, batch_id, initiative_id, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        [String(linkId), String(assessmentId), String(batchId), String(initiativeId), now]
      );

      return res.status(201).json({
        initiative: { id: initiativeId, title, status: 'DRAFT', batchId },
      });
    } catch (err: any) {
      logger.error('[AssessmentWorkflowV2] Error creating manual initiative:', err);
      return res.status(500).json({ error: err.message || 'Failed to create initiative' });
    }
  }
);

export default router;
