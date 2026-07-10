/**
 * Projects Routes
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * All project-related API endpoints with Zod validation
 */

import { Router } from 'express';

import ProjectControllerRaw from '../../controllers/ProjectController.js';
import logger from '../../utils/Logger.js';
const ProjectController = ProjectControllerRaw as any;
import { verifyToken } from '../../middleware/auth.middleware.js';
import { demoContextMiddleware } from '../../middleware/demoGuard.middleware.js';
import { checkPlanLimit } from '../../middleware/planLimits.middleware.js';
import { apiAuthRateLimiter } from '../../middleware/rateLimiting.middleware.js';
import { requireOrgAccess } from '../../middleware/rbac.middleware.js';
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
router.post('/:id/members', ProjectController.addProjectMember);

/**
 * PATCH /api/projects/:id/members/:userId
 * Update project member fields (role/invoked/consultant overlay)
 */
router.patch('/:id/members/:userId', ProjectController.updateProjectMember);

/**
 * DELETE /api/projects/:id/members/:userId
 * Remove project member
 */
router.delete('/:id/members/:userId', ProjectController.removeProjectMember);

// ==========================================
// STEERING BOARD (OPTIONAL)
// ==========================================

router.get('/:id/steering-board', ProjectController.getSteeringBoard);
router.put('/:id/steering-board', ProjectController.updateSteeringBoard);
router.post('/:id/steering-board/members', ProjectController.addSteeringBoardMember);
router.delete('/:id/steering-board/members/:userId', ProjectController.removeSteeringBoardMember);

/**
 * PUT /api/projects/:id
 * Update project
 */
router.put('/:id', validateBody(UpdateProjectSchema), ProjectController.updateProject);

/**
 * DELETE /api/projects/:id
 * Delete project
 */
router.delete('/:id', ProjectController.deleteProject);

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
router.put('/:id/ai-role', validateBody(UpdateAIRoleSchema), ProjectController.updateAIRole);

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
router.post('/:id/archive', validateBody(ArchiveProjectSchema), ProjectController.archiveProject);

/**
 * POST /api/projects/:id/unarchive
 * Restore an archived project
 */
router.post('/:id/unarchive', ProjectController.unarchiveProject);

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
router.post('/:id/pmo-roles', ProjectController.assignPMORole);

/**
 * DELETE /api/projects/:id/pmo-roles/:assignmentId
 * Remove PMO role assignment
 */
router.delete('/:id/pmo-roles/:assignmentId', ProjectController.removePMORole);

// ==========================================
// LOCATIONS
// ==========================================

/**
 * GET /api/locations
 * Get all locations for organization
 */
router.get('/locations', ProjectController.getLocations);

export default router;
