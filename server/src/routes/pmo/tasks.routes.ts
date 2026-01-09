/**
 * Tasks Routes
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * All task-related API endpoints with Zod validation
 */

import { Router } from 'express';

import TaskControllerRaw from '../../controllers/TaskController.js';
const TaskController = TaskControllerRaw as any;
import { verifyToken } from '../../middleware/auth.middleware.js';
import { demoContextMiddleware } from '../../middleware/demoGuard.middleware.js';
import { authRateLimiter } from '../../middleware/rateLimiting.middleware.js';
import { validateBody } from '../../middleware/validation.middleware.js';
import logger from '../../utils/Logger.js';
import {
    AddTaskCommentSchema,
    AssignTaskSchema,
    CreateTaskSchema,
    EscalateTaskSchema,
    ReassignTaskSchema,
    ResolveEscalationSchema,
    UpdateTaskSchema,
} from '../../validators/task.validators.js';

const router = Router();

// Apply rate limiting
router.use(authRateLimiter);

// Apply auth middleware to all routes
router.use(verifyToken);

// Apply demo context middleware (switches org to demo org if x-demo-mode header is set)
router.use(demoContextMiddleware);

// ==========================================
// TASK CRUD
// ==========================================

/**
 * GET /api/tasks
 * Get all tasks with filters
 */
router.get(
    '/',
    (req, res, next) => {
        logger.info('[TasksRoute] GET / matched');
        next();
    },
    TaskController.getTasks,
);

/**
 * POST /api/tasks
 * Create a new task
 */
router.post('/', validateBody(CreateTaskSchema), TaskController.createTask);

/**
 * GET /api/tasks/:id
 * Get single task by ID
 */
router.get('/:id', TaskController.getTaskById);

/**
 * PUT /api/tasks/:id
 * Update task
 */
router.put('/:id', validateBody(UpdateTaskSchema), TaskController.updateTask);

/**
 * DELETE /api/tasks/:id
 * Delete task
 */
router.delete('/:id', TaskController.deleteTask);

// ==========================================
// TASK COMMENTS
// ==========================================

/**
 * GET /api/tasks/:taskId/comments
 * Get comments for a task
 */
router.get('/:taskId/comments', TaskController.getTaskComments);

/**
 * POST /api/tasks/:taskId/comments
 * Add comment to task
 */
router.post('/:taskId/comments', validateBody(AddTaskCommentSchema), TaskController.addTaskComment);

/**
 * DELETE /api/tasks/:taskId/comments/:commentId
 * Delete task comment
 */
router.delete('/:taskId/comments/:commentId', TaskController.deleteTaskComment);

// ==========================================
// TASK ASSIGNMENT & ESCALATION
// ==========================================

/**
 * POST /api/tasks/:id/assign
 * Assign task to user
 */
router.post('/:id/assign', validateBody(AssignTaskSchema), TaskController.assignTask);

/**
 * POST /api/tasks/:id/reassign
 * Reassign task
 */
router.post('/:id/reassign', validateBody(ReassignTaskSchema), TaskController.reassignTask);

/**
 * POST /api/tasks/:id/unassign
 * Unassign task
 */
router.post('/:id/unassign', TaskController.unassignTask);

/**
 * POST /api/tasks/:id/escalate
 * Escalate task
 */
router.post('/:id/escalate', validateBody(EscalateTaskSchema), TaskController.escalateTask);

/**
 * POST /api/tasks/:taskId/escalations/:escalationId/resolve
 * Resolve escalation
 */
router.post(
    '/:taskId/escalations/:escalationId/resolve',
    validateBody(ResolveEscalationSchema),
    TaskController.resolveEscalation,
);

/**
 * GET /api/tasks/:id/escalations
 * Get task escalation history
 */
router.get('/:id/escalations', TaskController.getTaskEscalations);

// ==========================================
// TASK ANALYTICS
// ==========================================

/**
 * GET /api/tasks/overdue
 * Get overdue tasks
 */
router.get('/overdue', TaskController.getOverdueTasks);

/**
 * GET /api/tasks/at-risk
 * Get tasks approaching SLA deadline
 */
router.get('/at-risk', TaskController.getTasksAtRisk);

/**
 * GET /api/tasks/workload/:userId
 * Get user workload
 */
router.get('/workload/:userId', TaskController.getUserWorkload);

/**
 * GET /api/tasks/my-workload
 * Get current user workload
 */
router.get('/my-workload', TaskController.getMyWorkload);

export default router;
