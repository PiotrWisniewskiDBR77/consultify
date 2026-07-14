/**
 * Projects Routes
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * All project-related API endpoints with Zod validation
 */

import { Router } from 'express';

import ProjectControllerRaw from '../../controllers/ProjectController.js';
import logger from '../../utils/Logger.js';
import * as queryHelpers from '../../utils/queryHelpers.js';
const ProjectController = ProjectControllerRaw as any;
import { verifyToken } from '../../middleware/auth.middleware.js';
import { demoContextMiddleware } from '../../middleware/demoGuard.middleware.js';
import {
  requireAnyProjectCapability,
  requireProjectCapability,
} from '../../middleware/effectiveCapability.middleware.js';
import { checkPlanLimit } from '../../middleware/planLimits.middleware.js';
import { apiAuthRateLimiter } from '../../middleware/rateLimiting.middleware.js';
import { requireOrgAccess, requireOrgRole } from '../../middleware/rbac.middleware.js';
import { validateBody, validateQuery } from '../../middleware/validation.middleware.js';
import {
  ArchiveProjectSchema,
  CreateProjectSchema,
  ProjectNotificationSettingsSchema,
  UpdateAIRoleSchema,
  UpdateProjectSchema,
  UpdateRegulatoryModeSchema,
} from '../../validators/project.validators.js';

const router = Router();

// Apply rate limiting
router.use(apiAuthRateLimiter);

// Apply auth middleware to all routes
router.use(verifyToken);
router.use(requireOrgAccess());

// Apply demo context middleware (switches org to demo org if x-demo-mode header is set)
router.use(demoContextMiddleware);

// ==========================================
// PROJECT CRUD
// ==========================================

/**
 * GET /api/projects
 * Get all projects for organization
 */
router.get('/', ProjectController.getProjects);

/**
 * POST /api/projects
 * Create a new project
 */
router.post(
  '/',
  (req, res, next) => {
    logger.info('[ProjectsRoute] POST / hit');
    next();
  },
  checkPlanLimit('max_projects'),
  validateBody(CreateProjectSchema),
  ProjectController.createProject
);

// ==========================================
// MY MEMBERSHIPS
// ==========================================

/**
 * GET /api/projects/my-memberships
 * GET /api/pmo/projects/my-memberships
 *
 * Get all project memberships for current user.
 * Must be declared before `/:id` to avoid route shadowing.
 */
router.get('/my-memberships', ProjectController.getMyMemberships);

/**
 * GET /api/projects/:id
 * Get single project details
 */
router.get('/:id', ProjectController.getProjectById);

// ==========================================
// FINANCE ROLLUP (ZWORNIK DELTA B)
// ==========================================

/**
 * GET /api/pmo/projects/:id/finance
 * Project finance rollup (§4.2): own budget container(s) + Σ initiative
 * budgets/expenses + Σ initiative value + benefits/ROI + variance.
 */
router.get('/:id/finance', ProjectController.getProjectFinance);

// ==========================================
// PROGRAM ASSIGNMENT (Zwornik D3 — program → projekty, migration 916)
// ==========================================

/**
 * PUT /api/pmo/projects/:id/program
 * Assign (or clear, body.programId = null) the project's program. Backed by
 * `projects.program_id` (server/migrations/916_program_projects_link.sql —
 * additive, NOT auto-applied yet). Fail-soft: if the column doesn't exist on
 * this DB yet, returns 503 with a clear message instead of a raw 500 — same
 * posture as `programRollupService.getProgramProjectIds`.
 *
 * Program CRUD itself already lives at /api/initiatives/programs (V4-INIT-02,
 * see initiatives.routes.ts) — this is only the missing project-side link.
 */
router.put(
  '/:id/program',
  requireOrgRole('user'),
  requireAnyProjectCapability(['project.settings.manage', 'project.settings.update'], undefined, {
    shadow: true,
  }),
  async (req: any, res: any) => {
    try {
      const orgId = req.user?.organizationId;
      if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

      const { id } = req.params;
      const { programId } = req.body || {};

      const project = await queryHelpers.queryOne(
        `SELECT id FROM projects WHERE id = ? AND organization_id = ?`,
        [id, String(orgId)]
      );
      if (!project) return res.status(404).json({ error: 'Project not found' });

      if (programId) {
        const program = await queryHelpers.queryOne(
          `SELECT id FROM programs WHERE id = ? AND organization_id = ?`,
          [String(programId), String(orgId)]
        );
        if (!program) return res.status(400).json({ error: 'Program not found' });
      }

      await queryHelpers.queryRun(
        `UPDATE projects SET program_id = ? WHERE id = ? AND organization_id = ?`,
        [programId || null, id, String(orgId)]
      );

      return res.json({ id, programId: programId || null });
    } catch (err: any) {
      const msg = String(err?.message || err);
      if (/program_id/i.test(msg) && /column/i.test(msg)) {
        logger.warn(
          `[ProjectsRoute] PUT /:id/program — projects.program_id column missing (migration 916 not applied): ${msg}`
        );
        return res.status(503).json({
          error:
            'projects.program_id not available yet on this database (migration 916 not applied).',
        });
      }
      logger.error('[ProjectsRoute] PUT /:id/program failed:', err);
      return res.status(500).json({ error: 'Failed to assign project to program' });
    }
  }
);

// ==========================================
// PROJECT TEAM (CANONICAL MEMBERSHIP)
// ==========================================

/**
 * GET /api/projects/:id/members
 * Get canonical project members
 */
router.get('/:id/members', ProjectController.getProjectMembers);

/**
 * POST /api/projects/:id/members
 * Add project member (canonical)
 */
router.post(
  '/:id/members',
  requireAnyProjectCapability(['project.team.manage', 'project.team.update'], undefined, {
    shadow: true,
  }),
  ProjectController.addProjectMember
);

/**
 * PATCH /api/projects/:id/members/:userId
 * Update project member fields (role/invoked/consultant overlay)
 */
router.patch(
  '/:id/members/:userId',
  requireAnyProjectCapability(['project.team.manage', 'project.team.update'], undefined, {
    shadow: true,
  }),
  ProjectController.updateProjectMember
);

/**
 * DELETE /api/projects/:id/members/:userId
 * Remove project member
 */
router.delete(
  '/:id/members/:userId',
  requireAnyProjectCapability(['project.team.manage', 'project.team.update'], undefined, {
    shadow: true,
  }),
  ProjectController.removeProjectMember
);

// ==========================================
// STEERING BOARD (OPTIONAL)
// ==========================================

router.get('/:id/steering-board', ProjectController.getSteeringBoard);
router.put(
  '/:id/steering-board',
  requireAnyProjectCapability(['project.team.manage', 'project.team.update'], undefined, {
    shadow: true,
  }),
  ProjectController.updateSteeringBoard
);
router.post(
  '/:id/steering-board/members',
  requireAnyProjectCapability(['project.team.manage', 'project.team.update'], undefined, {
    shadow: true,
  }),
  ProjectController.addSteeringBoardMember
);
router.delete(
  '/:id/steering-board/members/:userId',
  requireAnyProjectCapability(['project.team.manage', 'project.team.update'], undefined, {
    shadow: true,
  }),
  ProjectController.removeSteeringBoardMember
);

/**
 * PUT /api/projects/:id
 * Update project
 */
router.put(
  '/:id',
  requireAnyProjectCapability(['project.settings.manage', 'project.settings.update'], undefined, {
    shadow: true,
  }),
  validateBody(UpdateProjectSchema),
  ProjectController.updateProject
);

/**
 * DELETE /api/projects/:id
 * Delete project
 */
router.delete(
  '/:id',
  requireProjectCapability('project.delete', undefined, { shadow: true }),
  ProjectController.deleteProject
);

// ==========================================
// PROJECT NOTIFICATION SETTINGS
// ==========================================

/**
 * GET /api/projects/:id/notification-settings
 * Get notification settings for project
 */
router.get('/:id/notification-settings', ProjectController.getNotificationSettings);

/**
 * PUT /api/projects/:id/notification-settings
 * Update notification settings for project
 */
router.put(
  '/:id/notification-settings',
  requireAnyProjectCapability(['project.settings.manage', 'project.settings.update'], undefined, {
    shadow: true,
  }),
  validateBody(ProjectNotificationSettingsSchema),
  ProjectController.updateNotificationSettings
);

// ==========================================
// AI ROLE MANAGEMENT
// ==========================================

/**
 * GET /api/projects/:id/ai-role
 * Get AI role for project
 */
router.get('/:id/ai-role', ProjectController.getAIRole);

/**
 * PUT /api/projects/:id/ai-role
 * Update AI role for project (Admin only)
 */
router.put(
  '/:id/ai-role',
  requireAnyProjectCapability(['project.settings.manage', 'project.settings.update'], undefined, {
    shadow: true,
  }),
  validateBody(UpdateAIRoleSchema),
  ProjectController.updateAIRole
);

// ==========================================
// REGULATORY MODE
// ==========================================

/**
 * GET /api/projects/:id/regulatory-mode
 * Get regulatory mode status for project
 */
router.get('/:id/regulatory-mode', ProjectController.getRegulatoryMode);

/**
 * PUT /api/projects/:id/regulatory-mode
 * Update regulatory mode for project (Admin only)
 */
router.put(
  '/:id/regulatory-mode',
  requireAnyProjectCapability(['project.settings.manage', 'project.settings.update'], undefined, {
    shadow: true,
  }),
  validateBody(UpdateRegulatoryModeSchema),
  ProjectController.updateRegulatoryMode
);

// ==========================================
// FLOW-PROJECT-001: ARCHIVE MANAGEMENT
// ==========================================

/**
 * POST /api/projects/:id/archive
 * Archive a completed or cancelled project
 */
router.post(
  '/:id/archive',
  requireProjectCapability('project.archive', undefined, { shadow: true }),
  validateBody(ArchiveProjectSchema),
  ProjectController.archiveProject
);

/**
 * POST /api/projects/:id/unarchive
 * Restore an archived project
 */
router.post(
  '/:id/unarchive',
  requireProjectCapability('project.archive', undefined, { shadow: true }),
  ProjectController.unarchiveProject
);

// ==========================================
// MY MEMBERSHIPS
// ==========================================

/**
// PMO ROLES
// ==========================================

/**
 * GET /api/projects/:id/pmo-roles
 * Get PMO role assignments for project
 */
router.get('/:id/pmo-roles', ProjectController.getPMORoles);

/**
 * POST /api/projects/:id/pmo-roles
 * Assign PMO role to user in project
 */
router.post(
  '/:id/pmo-roles',
  requireProjectCapability('project.roles.assign', undefined, { shadow: true }),
  ProjectController.assignPMORole
);

/**
 * DELETE /api/projects/:id/pmo-roles/:assignmentId
 * Remove PMO role assignment
 */
router.delete(
  '/:id/pmo-roles/:assignmentId',
  requireProjectCapability('project.roles.assign', undefined, { shadow: true }),
  ProjectController.removePMORole
);

// ==========================================
// LOCATIONS
// ==========================================

/**
 * GET /api/locations
 * Get all locations for organization
 */
router.get('/locations', ProjectController.getLocations);

export default router;
