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
import { apiAuthRateLimiter } from '../middleware/rateLimiting.middleware.js';
import { requireOrgAccess } from '../middleware/rbac.middleware.js';
import { validateBody } from '../middleware/validation.middleware.js';
import activityService from '../services/ActivityService.js';
import industryBenchmarkService from '../services/ai/industryBenchmarkService.js';
import AssessmentInitiativeGenerationRunService from '../services/assessmentInitiativeGenerationRunService.js';
import AssessmentPermissionService from '../services/assessmentPermissionService.js';
import BenchmarkingService from '../services/benchmarkingService.js';
import { createInitiative as funnelCreateInitiative } from '../services/initiative/createInitiativeService.js';
import { resolveInitiativeProjectId } from '../services/initiativeProjectPolicyService.js';
import NotificationService from '../services/notificationService.js';
import { decodeHtmlEntities } from '../utils/htmlEntities.js';
import logger from '../utils/Logger.js';
import * as queryHelpers from '../utils/queryHelpers.js';
import {
  ApproveAssessmentAccessRequestSchema,
  ApproveAssessmentSchema,
  ApproveReportSchema,
  AssignAssessmentRoleSchema,
  CreateAssessmentSchema,
  CreateInitiativeGenerationRunSchema,
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
router.use(apiAuthRateLimiter);
router.use(verifyToken);
router.use(requireOrgAccess());
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
    logger.error('[ASSESSMENT_WORKFLOW_V2] evaluate permissions failed', {
      err: e,
      correlationId: (req as any).correlationId,
    });
    res.status(500).json({
      error: 'Nie udało się ocenić uprawnień',
      code: 'ASSESSMENT_WORKFLOW_V2_EVALUATE_PERMISSIONS_FAILED',
    });
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
    logger.error('[ASSESSMENT_WORKFLOW_V2] evaluate permissions failed', {
      err: e,
      correlationId: (req as any).correlationId,
    });
    res.status(500).json({
      error: 'Nie udało się ocenić uprawnień',
      code: 'ASSESSMENT_WORKFLOW_V2_EVALUATE_PERMISSIONS_FAILED',
    });
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
    logger.error('[AssessmentWorkflowV2] Error searching users', {
      err: err,
      correlationId: (req as any).correlationId,
    });
    res.status(500).json({
      error: 'Nie udało się wyszukać użytkowników',
      code: 'ASSESSMENT_WORKFLOW_V2_SEARCH_USERS_FAILED',
    });
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

// Duplicate assessment
router.post('/:assessmentId/duplicate', async (req, res) => {
  try {
    const { assessmentId } = req.params as any;
    const { userId, organizationId } = getAuthContext(req);
    const db = getDatabase();

    // Fetch original assessment
    const original = await new Promise<any>((resolve, reject) => {
      db.get(
        `SELECT * FROM assessments WHERE id = ? AND organization_id = ?`,
        [assessmentId, organizationId],
        (err: Error | null, row: any) => (err ? reject(err) : resolve(row))
      );
    });

    if (!original) return res.status(404).json({ error: 'Assessment not found' });

    const newId = uuidv4();
    const now = new Date().toISOString();
    const newName = `${original.name || 'Assessment'} (Copy)`;

    await new Promise<void>((resolve, reject) => {
      db.run(
        `INSERT INTO assessments (
          id, organization_id, project_id, assessment_type, name, status,
          completion_percent, confidence_avg,
          answers_json, context_snapshot, score_summary, navigation_json,
          assessment_definition_id, assessment_definition_version,
          created_by, updated_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 'DRAFT', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          newId,
          organizationId,
          original.project_id,
          original.assessment_type,
          newName,
          original.completion_percent || 0,
          original.confidence_avg || 0,
          original.answers_json || '{}',
          original.context_snapshot || '{}',
          original.p28_workbench_v1 ? '{}' : original.score_summary || '{}',
          original.navigation_json || '{}',
          original.assessment_definition_id || null,
          original.assessment_definition_version || null,
          userId,
          userId,
          now,
          now,
        ],
        (err: Error | null) => (err ? reject(err) : resolve())
      );
    });

    res.json({ id: newId, name: newName, status: 'DRAFT' });
  } catch (err: any) {
    logger.error('[assessment-workflow] duplicate error:', err?.message);
    res.status(500).json({ error: 'Failed to duplicate assessment' });
  }
});

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

router.get('/:assessmentId/report/versions', async (req, res) => {
  try {
    const { assessmentId } = req.params as any;
    const { userId, organizationId } = getAuthContext(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const db = getDatabase();
    const assessment = await db.get<any>(
      `SELECT id FROM assessments WHERE id = ? AND organization_id = ?`,
      [String(assessmentId), String(organizationId)]
    );
    if (!assessment) return res.status(404).json({ error: 'Assessment not found' });

    const rows = await db.all<any>(
      `SELECT id, assessment_id, version, status, approved_by, approved_at, created_by, created_at, updated_at
       FROM assessment_reports
       WHERE assessment_id = ?
       ORDER BY version DESC`,
      [String(assessmentId)]
    );

    const versions = (rows || []).map((r: any) => ({
      id: r.id,
      assessmentId: r.assessment_id,
      version: r.version,
      status: r.status,
      approvedBy: r.approved_by || null,
      approvedAt: r.approved_at || null,
      createdBy: r.created_by,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));

    return res.json({ versions });
  } catch (err: any) {
    logger.error('[AssessmentWorkflowV2] Error listing report versions', {
      err: err,
      correlationId: (req as any).correlationId,
    });
    res.status(500).json({
      error: 'Nie udało się pobrać listy wersji raportu',
      code: 'ASSESSMENT_WORKFLOW_V2_LIST_REPORT_VERSIONS_FAILED',
    });
  }
});
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
    logger.error('[AssessmentWorkflowV2] Error getting user role', {
      err: err,
      correlationId: (req as any).correlationId,
    });
    res.status(500).json({
      error: 'Nie udało się pobrać roli użytkownika',
      code: 'ASSESSMENT_WORKFLOW_V2_GET_USER_ROLE_FAILED',
    });
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
    logger.error('[AssessmentWorkflowV2] Error getting assessment roles', {
      err: err,
      correlationId: (req as any).correlationId,
    });
    res
      .status(500)
      .json({ error: 'Nie udało się pobrać ról', code: 'ASSESSMENT_WORKFLOW_V2_GET_ROLES_FAILED' });
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
    logger.error('[AssessmentWorkflowV2] Error building eligibility', {
      err: err,
      correlationId: (req as any).correlationId,
    });
    res.status(500).json({
      error: 'Nie udało się obliczyć kwalifikowalności',
      code: 'ASSESSMENT_WORKFLOW_V2_BUILD_ELIGIBILITY_FAILED',
    });
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
    logger.error('[AssessmentWorkflowV2] Error creating access request', {
      err,
      correlationId: (req as any).correlationId,
    });
    return res.status(500).json({
      error: 'Failed to create access request',
      code: 'ASSESSMENT_ACCESS_REQUEST_CREATE_FAILED',
    });
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
    logger.error('[AssessmentWorkflowV2] Error getting access requests', {
      err: err,
      correlationId: (req as any).correlationId,
    });
    res.status(500).json({
      error: 'Nie udało się pobrać wniosków o dostęp',
      code: 'ASSESSMENT_WORKFLOW_V2_GET_ACCESS_REQUESTS_FAILED',
    });
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
      logger.error('[AssessmentWorkflowV2] Error approving access request', {
        err,
        correlationId: (req as any).correlationId,
      });
      return res.status(500).json({
        error: 'Failed to approve access request',
        code: 'ASSESSMENT_ACCESS_REQUEST_APPROVE_FAILED',
      });
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
      logger.error('[AssessmentWorkflowV2] Error rejecting access request', {
        err,
        correlationId: (req as any).correlationId,
      });
      return res.status(500).json({
        error: 'Failed to reject access request',
        code: 'ASSESSMENT_ACCESS_REQUEST_REJECT_FAILED',
      });
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
    logger.error('[AssessmentWorkflowV2] Error cancelling access request', {
      err,
      correlationId: (req as any).correlationId,
    });
    return res.status(500).json({
      error: 'Failed to cancel access request',
      code: 'ASSESSMENT_ACCESS_REQUEST_CANCEL_FAILED',
    });
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

    // Best-effort activity log
    activityService
      .log({
        organizationId: String(organizationId),
        userId: String(actorId),
        action: 'TEAM_MEMBER_ADDED',
        entityType: 'ASSESSMENT',
        entityId: String(assessmentId),
        metadata: { targetUserId: String(userId), role },
        ipAddress: req.ip,
        userAgent: req.get('user-agent') || undefined,
      })
      .catch((err: unknown) => logger.warn('[AssessmentWorkflow] audit logging failed', err));

    return res.status(201).json({ role: record });
  } catch (err: any) {
    logger.error('[AssessmentWorkflowV2] Error assigning role', {
      err,
      correlationId: (req as any).correlationId,
    });
    return res
      .status(500)
      .json({ error: 'Failed to assign role', code: 'ASSESSMENT_ROLE_ASSIGN_FAILED' });
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

      // Best-effort activity log
      activityService
        .log({
          organizationId: String(organizationId),
          userId: String(actorId),
          action: 'TEAM_MEMBER_ROLE_UPDATED',
          entityType: 'ASSESSMENT',
          entityId: String(assessmentId),
          metadata: { targetUserId: String(userId), role },
          ipAddress: req.ip,
          userAgent: req.get('user-agent') || undefined,
        })
        .catch((err: unknown) => logger.warn('[AssessmentWorkflow] audit logging failed', err));

      return res.json({ role: record });
    } catch (err: any) {
      logger.error('[AssessmentWorkflowV2] Error updating role', {
        err,
        correlationId: (req as any).correlationId,
      });
      return res
        .status(500)
        .json({ error: 'Failed to update role', code: 'ASSESSMENT_ROLE_UPDATE_FAILED' });
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
    const { userId: actorId, organizationId } = getAuthContext(req);

    const ok = await requireAssessmentPermission(req, res, 'canManageTeam');
    if (!ok) return;

    const removed = await AssessmentPermissionService.removeRole(
      String(assessmentId),
      String(userId),
      String(organizationId)
    );
    if (!removed) return res.status(404).json({ error: 'Role not found' });

    // Best-effort activity log
    if (actorId) {
      activityService
        .log({
          organizationId: String(organizationId),
          userId: String(actorId),
          action: 'TEAM_MEMBER_REMOVED',
          entityType: 'ASSESSMENT',
          entityId: String(assessmentId),
          metadata: { targetUserId: String(userId) },
          ipAddress: req.ip,
          userAgent: req.get('user-agent') || undefined,
        })
        .catch((err: unknown) => logger.warn('[AssessmentWorkflow] audit logging failed', err));
    }

    return res.json({ ok: true });
  } catch (err: any) {
    logger.error('[AssessmentWorkflowV2] Error removing role', {
      err,
      correlationId: (req as any).correlationId,
    });
    return res
      .status(500)
      .json({ error: 'Failed to remove role', code: 'ASSESSMENT_ROLE_REMOVE_FAILED' });
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
 * Enterprise: initiative generation runs (50+ initiatives via sub-batches)
 */
router.post(
  '/:assessmentId/initiative-generation-runs',
  validateBody(CreateInitiativeGenerationRunSchema),
  async (req, res) => {
    try {
      const { assessmentId } = req.params as any;
      const { userId, organizationId } = getAuthContext(req);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const ok = await requireAssessmentFlag(req, res, 'canGenerateInitiatives');
      if (!ok) return;

      const {
        mode,
        methodologyId,
        requestedCount,
        batchSize,
        includeChatContext,
        reportId,
        templateId,
        consultantBrief,
      } = req.body || {};
      if (String(mode || '').toUpperCase() === 'REPORT_ONLY' && !reportId) {
        return res.status(400).json({ error: 'reportId is required for REPORT_ONLY mode' });
      }

      const run = await AssessmentInitiativeGenerationRunService.createAndStart({
        assessmentId: String(assessmentId),
        organizationId: String(organizationId),
        userId: String(userId),
        mode,
        methodologyId,
        requestedCount,
        batchSize: typeof batchSize === 'number' ? batchSize : 7,
        includeChatContext: includeChatContext !== undefined ? Boolean(includeChatContext) : true,
        reportId: reportId ? String(reportId) : null,
        templateId: templateId ? String(templateId) : null,
        consultantBrief: consultantBrief ? String(consultantBrief) : null,
        idempotencyKey: req.get('Idempotency-Key') || null,
      } as any);

      return res.status(202).json({ runId: run.runId });
    } catch (err: any) {
      const msg = String(err?.message || '');
      const missingSchema =
        msg.includes('no such table: assessment_initiative_generation_runs') ||
        msg.includes('relation "assessment_initiative_generation_runs" does not exist');
      if (missingSchema) {
        return res.status(409).json({
          error: 'Initiative generation unavailable (missing schema)',
          code: 'INITIATIVE_GENERATION_SCHEMA_MISSING',
        });
      }
      logger.error('[AssessmentWorkflowV2] Error creating initiative generation run:', err);
      res.status(500).json({
        error: 'Nie udało się utworzyć przebiegu',
        code: 'ASSESSMENT_WORKFLOW_V2_CREATE_RUN_FAILED',
      });
    }
  }
);

router.get('/:assessmentId/initiative-generation-runs', async (req, res) => {
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

    const runs = await AssessmentInitiativeGenerationRunService.listRuns(
      String(assessmentId),
      String(organizationId)
    );
    return res.json({ runs });
  } catch (err: any) {
    logger.error('[AssessmentWorkflowV2] Error listing initiative generation runs', {
      err: err,
      correlationId: (req as any).correlationId,
    });
    res.status(500).json({
      error: 'Nie udało się pobrać listy przebiegów',
      code: 'ASSESSMENT_WORKFLOW_V2_LIST_RUNS_FAILED',
    });
  }
});

router.get('/:assessmentId/initiative-generation-runs/:runId', async (req, res) => {
  try {
    const { assessmentId, runId } = req.params as any;
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

    const progress = await AssessmentInitiativeGenerationRunService.getProgress(
      String(runId),
      String(organizationId)
    );
    if (!progress) return res.status(404).json({ error: 'Run not found' });
    if (String(progress.assessmentId) !== String(assessmentId)) {
      return res.status(404).json({ error: 'Run not found for this assessment' });
    }
    return res.json({ run: progress });
  } catch (err: any) {
    logger.error('[AssessmentWorkflowV2] Error fetching initiative generation run', {
      err: err,
      correlationId: (req as any).correlationId,
    });
    res.status(500).json({
      error: 'Nie udało się pobrać przebiegu',
      code: 'ASSESSMENT_WORKFLOW_V2_FETCH_RUN_FAILED',
    });
  }
});

router.get('/:assessmentId/initiative-generation-runs/:runId/initiatives', async (req, res) => {
  try {
    const { assessmentId, runId } = req.params as any;
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

    const progress = await AssessmentInitiativeGenerationRunService.getProgress(
      String(runId),
      String(organizationId)
    );
    if (!progress) return res.status(404).json({ error: 'Run not found' });
    if (String(progress.assessmentId) !== String(assessmentId)) {
      return res.status(404).json({ error: 'Run not found for this assessment' });
    }

    const initiatives = await AssessmentInitiativeGenerationRunService.listRunInitiatives(
      String(runId),
      String(organizationId),
      200
    );
    return res.json({ initiatives });
  } catch (err: any) {
    logger.error('[AssessmentWorkflowV2] Error listing run initiatives', {
      err: err,
      correlationId: (req as any).correlationId,
    });
    res.status(500).json({
      error: 'Nie udało się pobrać listy inicjatyw przebiegu',
      code: 'ASSESSMENT_WORKFLOW_V2_LIST_RUN_INITIATIVES_FAILED',
    });
  }
});

router.post(
  '/:assessmentId/initiative-generation-runs/:runId/submit-for-review',
  async (req, res) => {
    try {
      const { assessmentId, runId } = req.params as any;
      const { userId, organizationId } = getAuthContext(req);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const ok = await requireAssessmentFlag(req, res, 'canManage');
      if (!ok) return;

      const { globalRole } = getAuthContext(req);
      const actorRole = String(globalRole || '').toUpperCase();
      const result = await AssessmentInitiativeGenerationRunService.bulkSubmitRunDrafts({
        runId: String(runId),
        assessmentId: String(assessmentId),
        organizationId: String(organizationId),
        actorId: String(userId),
        actorRole,
      });
      return res.json({ success: true, updated: result.updated });
    } catch (err: any) {
      logger.error('[AssessmentWorkflowV2] Error submitting run drafts for review', {
        err: err,
        correlationId: (req as any).correlationId,
      });
      res.status(500).json({
        error: 'Nie udało się przesłać szkiców',
        code: 'ASSESSMENT_WORKFLOW_V2_SUBMIT_DRAFTS_FAILED',
      });
    }
  }
);

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
    logger.error('[AssessmentWorkflowV2] Error listing initiative batches', {
      err: err,
      correlationId: (req as any).correlationId,
    });
    res.status(500).json({
      error: 'Nie udało się pobrać listy partii',
      code: 'ASSESSMENT_WORKFLOW_V2_LIST_BATCHES_FAILED',
    });
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

      const { title: rawTitle, description, category, priority, risk } = req.body || {};
      // F15 (data-integrity, continuation of Z139): decode HTML entities the
      // global input-sanitization middleware escaped on this field before
      // storing initiatives.title/name (funnel branch AND raw-insert fallback —
      // INITIATIVE_FUNNEL_ENABLED is default OFF).
      const title = decodeHtmlEntities(String(rawTitle));

      // Uspójnienie F1.7 — przez kanoniczny lejek (DRAFT pominięty → normalizowany w lejku;
      // name/title + lineage source_type='assessment'). Linki/batch używają id zwróconego z lejka.
      let createdInitiativeId = String(initiativeId);
      if (process.env.INITIATIVE_FUNNEL_ENABLED === 'true') {
        const __r = await funnelCreateInitiative(
          String(assessment.organization_id),
          {
            title: String(title),
            projectId: assessment.project_id || null,
            description: description ? String(description) : null,
            // status 'DRAFT' POMINIĘTY — lejek normalizuje do DRAFT
            priority: (priority || 'medium').toString(),
            category: category ? String(category) : null,
            sourceType: 'assessment',
            sourceId: String(assessmentId),
          },
          { validate: false, actor: { id: String(userId) } }
        );
        createdInitiativeId = __r.id;
        // Extra-kolumny, których lejek nie zna (risk_level, created_by) → post-create UPDATE.
        try {
          await db.run(
            `UPDATE initiatives SET risk_level = ?, created_by = ?, updated_at = ?
             WHERE id = ? AND organization_id = ?`,
            [
              (risk || 'medium').toString(),
              String(userId),
              now,
              createdInitiativeId,
              String(assessment.organization_id),
            ]
          );
        } catch (updErr: any) {
          logger.warn(
            `[AssessmentWorkflowV2] post-create UPDATE (risk/created_by) failed: ${updErr?.message || updErr}`
          );
        }
      } else {
        // D1 (Zwornik §9 Faza 3): live path (funnel flag off) — anchor to the
        // portfolio project instead of persisting project_id NULL.
        const anchoredProjectId = await resolveInitiativeProjectId(
          String(assessment.organization_id),
          assessment.project_id,
          { createdBy: userId ? String(userId) : null }
        );
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
            anchoredProjectId,
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
      }

      // Create a synthetic batch so history is consistent.
      // organization_id is NOT NULL with no DB default (Postgres) — omitting it
      // 500s with 23502. assessment.organization_id is already loaded above.
      await db.run(
        `INSERT INTO assessment_initiative_batches (
          id, assessment_id, organization_id, methodology_id, initiatives_count, include_chat_context, generated_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          batchId,
          String(assessmentId),
          String(assessment.organization_id),
          'manual',
          1,
          0,
          String(userId),
          now,
        ]
      );

      // Link row — używa id zwróconego z lejka (krytyczne: link nie może być sierotą).
      await db.run(
        `INSERT INTO assessment_initiative_links (id, assessment_id, batch_id, initiative_id, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        [String(linkId), String(assessmentId), String(batchId), String(createdInitiativeId), now]
      );

      return res.status(201).json({
        initiative: { id: createdInitiativeId, title, status: 'DRAFT', batchId },
      });
    } catch (err: any) {
      logger.error('[AssessmentWorkflowV2] Error creating manual initiative', {
        err,
        correlationId: (req as any).correlationId,
      });
      return res.status(500).json({
        error: 'Failed to create initiative',
        code: 'ASSESSMENT_MANUAL_INITIATIVE_CREATE_FAILED',
      });
    }
  }
);

// ============================================
// Gate Decisions Endpoints
// ============================================

/**
 * GET /api/assessment-workflow-v2/:assessmentId/gate-decisions
 * List gate decisions for this assessment with assignee info.
 */
router.get('/:assessmentId/gate-decisions', async (req, res) => {
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

    // Try to fetch from assessment_gate_decisions table (may not exist yet)
    let decisions: any[] = [];
    try {
      const rows = await db.all<any>(
        `SELECT 
          gd.id,
          gd.gate_type as "gateType",
          gd.from_status as "fromStatus",
          gd.to_status as "toStatus",
          gd.approver_role as "approverRole",
          gd.assignee_id as "assigneeId",
          gd.status,
          gd.requested_at as "requestedAt",
          gd.requested_by as "requestedBy",
          gd.request_comment as "requestComment",
          gd.decided_at as "decidedAt",
          gd.decided_by as "decidedBy",
          gd.decision_comment as "decisionComment",
          gd.reminder_count as "reminderCount",
          u_assignee.display_name as "assigneeName",
          u_assignee.email as "assigneeEmail",
          u_requester.display_name as "requesterName",
          u_requester.email as "requesterEmail"
        FROM assessment_gate_decisions gd
        LEFT JOIN users u_assignee ON u_assignee.id = gd.assignee_id
        LEFT JOIN users u_requester ON u_requester.id = gd.requested_by
        WHERE gd.assessment_id = ?
        ORDER BY gd.created_at ASC`,
        [String(assessmentId)]
      );
      decisions = rows || [];
    } catch (tableErr: any) {
      // Table doesn't exist yet - return empty decisions
      logger.warn('[AssessmentWorkflowV2] Gate decisions table not found, returning empty list');
      decisions = [];
    }

    return res.json({ decisions });
  } catch (err: any) {
    logger.error('[AssessmentWorkflowV2] Error fetching gate decisions', {
      err: err,
      correlationId: (req as any).correlationId,
    });
    res.status(500).json({
      error: 'Nie udało się pobrać decyzji bramkowych',
      code: 'ASSESSMENT_WORKFLOW_V2_FETCH_GATE_DECISIONS_FAILED',
    });
  }
});

/**
 * PUT /api/assessment-workflow-v2/:assessmentId/gate-decisions/:gateType
 * Update a gate decision (assign user, update status, etc.)
 */
router.put('/:assessmentId/gate-decisions/:gateType', async (req, res) => {
  try {
    const { assessmentId, gateType } = req.params as any;
    const { userId: actorId, organizationId } = getAuthContext(req);
    if (!actorId) return res.status(401).json({ error: 'Unauthorized' });

    const ok = await requireAssessmentPermission(req, res, 'canManage');
    if (!ok) return;

    const { assigneeId, status } = req.body || {};
    const db = getDatabase();
    const now = new Date().toISOString();

    // Validate gate type
    const validGates = [
      'REQUEST_REVIEW',
      'APPROVE_REPORT',
      'APPROVE_ASSESSMENT',
      'GENERATE_REPORT',
      'GENERATE_INITIATIVES',
    ];
    if (!validGates.includes(String(gateType).toUpperCase())) {
      return res.status(400).json({ error: 'Invalid gate type' });
    }

    // Check if record exists
    let existing: any = null;
    try {
      existing = await db.get<any>(
        `SELECT id FROM assessment_gate_decisions WHERE assessment_id = ? AND gate_type = ?`,
        [String(assessmentId), String(gateType).toUpperCase()]
      );
    } catch {
      // Table might not exist
    }

    if (existing) {
      // Update existing
      const updates: string[] = [];
      const params: any[] = [];

      if (assigneeId !== undefined) {
        updates.push('assignee_id = ?');
        params.push(assigneeId ? String(assigneeId) : null);
      }
      if (status !== undefined) {
        updates.push('status = ?');
        params.push(String(status).toUpperCase());
      }

      if (updates.length > 0) {
        updates.push('updated_at = ?');
        params.push(now);
        params.push(String(assessmentId));
        params.push(String(gateType).toUpperCase());

        await db.run(
          `UPDATE assessment_gate_decisions SET ${updates.join(', ')} WHERE assessment_id = ? AND gate_type = ?`,
          params
        );
      }
    } else {
      // Create new gate decision record
      const gateId = uuidv4();
      const gateConfig: Record<string, { from: string; to: string; role: string }> = {
        REQUEST_REVIEW: { from: 'DRAFT', to: 'IN_REVIEW', role: 'manager' },
        APPROVE_REPORT: { from: 'IN_REVIEW', to: 'AWAITING_APPROVAL', role: 'admin' },
        APPROVE_ASSESSMENT: { from: 'AWAITING_APPROVAL', to: 'APPROVED', role: 'admin' },
        GENERATE_REPORT: { from: 'APPROVED', to: 'APPROVED', role: 'manager' },
        GENERATE_INITIATIVES: { from: 'APPROVED', to: 'APPROVED', role: 'manager' },
      };

      const config = gateConfig[String(gateType).toUpperCase()] || {
        from: 'DRAFT',
        to: 'DRAFT',
        role: 'admin',
      };

      try {
        await db.run(
          `INSERT INTO assessment_gate_decisions (
            id, assessment_id, organization_id, gate_type, from_status, to_status,
            approver_role, assignee_id, status, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            gateId,
            String(assessmentId),
            String(organizationId),
            String(gateType).toUpperCase(),
            config.from,
            config.to,
            config.role,
            assigneeId ? String(assigneeId) : null,
            status ? String(status).toUpperCase() : 'NOT_STARTED',
            now,
            now,
          ]
        );
      } catch (insertErr: any) {
        logger.error('[AssessmentWorkflowV2] Error creating gate decision:', insertErr);
        return res.status(500).json({ error: 'Failed to create gate decision' });
      }
    }

    return res.json({ ok: true });
  } catch (err: any) {
    logger.error('[AssessmentWorkflowV2] Error updating gate decision', {
      err: err,
      correlationId: (req as any).correlationId,
    });
    res.status(500).json({
      error: 'Nie udało się zaktualizować decyzji bramkowej',
      code: 'ASSESSMENT_WORKFLOW_V2_UPDATE_GATE_DECISION_FAILED',
    });
  }
});

// =============================================================================
// V4-ASMT-01: BENCHMARK COMPARISON
// =============================================================================

const BENCHMARK_CATEGORY_TO_AXIS: Record<string, string> = {
  digital_strategy: 'digital_strategy',
  data_analytics: 'data_analytics',
  cybersecurity: 'cybersecurity',
  automation: 'automation',
  digital_culture: 'digital_culture',
  cloud_infrastructure: 'cloud_infrastructure',
  iot_connectivity: 'iot_connectivity',
  supply_chain: 'supply_chain',
  PROCESS: 'automation',
  PRODUCT: 'data_analytics',
  ORGANIZATION: 'digital_culture',
  CONNECTIVITY: 'iot_connectivity',
  DATA: 'data_analytics',
  INTELLIGENCE: 'automation',
  WORKFORCE: 'digital_culture',
};

router.get('/:assessmentId/benchmark-comparison', async (req, res) => {
  try {
    const { assessmentId } = req.params as any;
    const { userId, organizationId } = getAuthContext(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const db = getDatabase();
    const assessment = await db.get<any>(
      `SELECT id, assessment_type, overall_score, score_summary
       FROM assessments
       WHERE id = ? AND organization_id = ?`,
      [String(assessmentId), String(organizationId)]
    );
    if (!assessment) return res.status(404).json({ error: 'Assessment not found' });

    let resolvedIndustry = 'manufacturing';
    try {
      const orgContextService = (
        await import('../services/organizationContext/OrganizationContextService.js')
      ).default;
      const resolved = await orgContextService.buildResolvedContext(String(organizationId));
      resolvedIndustry = resolved?.profile?.industry || 'manufacturing';
    } catch {
      resolvedIndustry = 'manufacturing';
    }

    const framework = String(assessment.assessment_type || 'SIRI').toUpperCase();
    const industry = String(resolvedIndustry)
      .toLowerCase()
      .replace(/[^a-z_]/g, '_');
    const normalizedIndustry =
      industry === 'manufacturing_discrete' || industry === 'manufacturing_process'
        ? 'manufacturing'
        : industry;

    let orgScore = assessment.overall_score != null ? Number(assessment.overall_score) : 0;
    const categories: Record<string, number> = {};

    if (assessment.score_summary) {
      try {
        const ss =
          typeof assessment.score_summary === 'string'
            ? JSON.parse(assessment.score_summary)
            : assessment.score_summary;
        if (typeof ss?.overall?.actual === 'number') {
          orgScore = ss.overall.actual;
        }
        if (typeof ss === 'object') {
          for (const [k, v] of Object.entries(ss)) {
            const num =
              typeof v === 'number'
                ? v
                : ((v as any)?.actual ?? (v as any)?.score ?? (v as any)?.value);
            if (typeof num === 'number') categories[k] = num;
          }
        }
      } catch {
        /* ignore parse */
      }
    }

    const dataset = await queryHelpers.queryOne<any>(
      `SELECT id, framework, industry, p25, p50, p75, p90, cohort_size, last_updated, version_tag
       FROM benchmark_datasets
       WHERE framework = ? AND industry = ?
         AND (region IS NULL) AND (company_size IS NULL)
       ORDER BY last_updated DESC
       LIMIT 1`,
      [framework, normalizedIndustry]
    );

    if (!dataset) {
      return res.json({
        assessmentId,
        framework,
        benchmark: { percentiles: null, cohortSize: 0, suppressed: true },
        orgScore,
        gap: null,
      });
    }

    const cohortSize = Number(dataset.cohort_size || 0);
    const suppressed = cohortSize < 5;

    if (suppressed) {
      return res.json({
        assessmentId,
        framework,
        benchmark: { percentiles: null, cohortSize, suppressed: true },
        orgScore,
        gap: null,
      });
    }

    const p25 = Number(dataset.p25 ?? 0);
    const p50 = Number(dataset.p50 ?? 0);
    const p75 = Number(dataset.p75 ?? 0);
    const p90 = Number(dataset.p90 ?? p75);

    let percentile: number;
    if (orgScore <= p25) percentile = 25;
    else if (orgScore <= p50)
      percentile = Math.round(25 + ((orgScore - p25) / Math.max(p50 - p25, 0.01)) * 25);
    else if (orgScore <= p75)
      percentile = Math.round(50 + ((orgScore - p50) / Math.max(p75 - p50, 0.01)) * 25);
    else if (orgScore <= p90)
      percentile = Math.round(75 + ((orgScore - p75) / Math.max(p90 - p75, 0.01)) * 15);
    else percentile = 95;

    const orgScores = Object.entries(categories).map(([k, v]) => ({
      axis: BENCHMARK_CATEGORY_TO_AXIS[k] || k.toLowerCase().replace(/[^a-z_]/g, '_'),
      score: Number(v),
    }));
    const comparisons = industryBenchmarkService.compareToBenchmarks(normalizedIndustry, orgScores);

    const categoryComparison: Record<string, { score: number; benchmark: number; gap: number }> =
      {};
    for (const c of comparisons) {
      categoryComparison[c.axis] = { score: c.orgScore, benchmark: c.industryAverage, gap: c.gap };
    }

    return res.json({
      assessmentId,
      framework,
      benchmark: {
        percentiles: { p25, p50, p75, p90 },
        cohortSize,
        suppressed: false,
        percentile,
        percentileLabel: BenchmarkingService.getPercentileLabel(percentile),
        lastUpdated: dataset.last_updated,
        datasetVersion: dataset.version_tag,
      },
      orgScore,
      gap: parseFloat((orgScore - p50).toFixed(2)),
      categoryComparison,
    });
  } catch (err: any) {
    logger.error('[AssessmentWorkflowV2] Error fetching benchmark comparison', {
      err: err,
      correlationId: (req as any).correlationId,
    });
    res.status(500).json({
      error: 'Nie udało się pobrać porównania benchmarkowego',
      code: 'ASSESSMENT_WORKFLOW_V2_FETCH_BENCHMARK_COMPARISON_FAILED',
    });
  }
});

export default router;
