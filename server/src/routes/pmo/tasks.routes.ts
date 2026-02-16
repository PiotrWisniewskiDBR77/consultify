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
  TaskController.getTasks
);

/**
 * POST /api/tasks
 * Create a new task
 */
router.post('/', validateBody(CreateTaskSchema), TaskController.createTask);

/**
 * GET /api/tasks/search
 * Search tasks by title (for dependency linking)
 * NOTE: Must be before /:id to avoid Express matching "search" as an id
 */
router.get('/search', TaskController.searchTasks);

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
  TaskController.resolveEscalation
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

// ==========================================
// FLOW-TASK-001: DECISION INTEGRATION
// ==========================================

/**
 * POST /api/tasks/:id/block
 * Block task (manual or by decision)
 */
router.post('/:id/block', TaskController.blockTask);

/**
 * POST /api/tasks/:id/unblock
 * Unblock task
 */
router.post('/:id/unblock', TaskController.unblockTask);

/**
 * POST /api/tasks/:id/move
 * Move task to different initiative
 */
router.post('/:id/move', TaskController.moveTask);

/**
 * GET /api/tasks/:id/blocking-decision
 * Get blocking decision details
 */
router.get('/:id/blocking-decision', TaskController.getBlockingDecision);

// ==========================================
// TASK DEPENDENCIES (Gantt-style)
// ==========================================

/**
 * GET /api/tasks/:id/dependencies
 * Get all dependencies for a task
 */
router.get('/:id/dependencies', TaskController.getTaskDependencies);

/**
 * POST /api/tasks/:id/dependencies
 * Add dependency between tasks
 */
router.post('/:id/dependencies', TaskController.addTaskDependency);

/**
 * DELETE /api/tasks/:id/dependencies/:depId
 * Remove a dependency
 */
router.delete('/:id/dependencies/:depId', TaskController.removeTaskDependency);

export default router;
