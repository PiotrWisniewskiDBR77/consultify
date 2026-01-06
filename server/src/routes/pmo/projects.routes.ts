/**
 * Projects Routes
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * All project-related API endpoints with Zod validation
 */

import { Router } from 'express';

import ProjectControllerRaw from '../../controllers/ProjectController.js';
const ProjectController = ProjectControllerRaw as any;
import { verifyToken } from '../../middleware/auth.middleware.js';
import { checkPlanLimit } from '../../middleware/planLimits.middleware.js';
import { authRateLimiter } from '../../middleware/rateLimiting.middleware.js';
import { validateBody, validateQuery } from '../../middleware/validation.middleware.js';
import {
    CreateProjectSchema,
    ProjectNotificationSettingsSchema,
    UpdateAIRoleSchema,
    UpdateProjectSchema,
    UpdateRegulatoryModeSchema,
} from '../../validators/project.validators.js';

const router = Router();

// Apply rate limiting
router.use(authRateLimiter);

// Apply auth middleware to all routes
router.use(verifyToken);

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
        console.log('[ProjectsRoute] POST / hit');
        next();
    },
    checkPlanLimit('max_projects'),
    validateBody(CreateProjectSchema),
    ProjectController.createProject,
);

/**
 * GET /api/projects/:id
 * Get single project details
 */
router.get('/:id', ProjectController.getProjectById);

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
    ProjectController.updateNotificationSettings,
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
router.put('/:id/regulatory-mode', validateBody(UpdateRegulatoryModeSchema), ProjectController.updateRegulatoryMode);

export default router;
