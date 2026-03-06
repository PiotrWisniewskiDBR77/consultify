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
import { requireAudit } from '../../middleware/requireAudit.middleware.js';
import { apiAuthRateLimiter } from '../../middleware/rateLimiting.middleware.js';
import { validateBody } from '../../middleware/validation.middleware.js';
import logger from '../../utils/Logger.js';
import {
  AddTaskCommentSchema,
  AssignTaskSchema,
  BlockTaskSchema,
  CreateTaskSchema,
  EscalateTaskSchema,
  ReassignTaskSchema,
  ResolveEscalationSchema,
  UnblockTaskSchema,
  UpdateTaskSchema,
} from '../../validators/task.validators.js';

const router = Router();

// Apply rate limiting
router.use(apiAuthRateLimiter);

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
router.post('/', requireAudit, validateBody(CreateTaskSchema), TaskController.createTask);

/**
 * GET /api/tasks/search
 * Search tasks by title (for dependency linking)
 * NOTE: Must be before /:id to avoid Express matching "search" as an id
 */
router.get('/search', TaskController.searchTasks);

/**
 * GET /api/tasks/rollups
 * V4-TASK-01: Hierarchy rollups by initiative/list/program
 */
router.get('/rollups', TaskController.getTaskHierarchyRollups);

/**
 * GET /api/tasks/workflow-config
 * V4-TASK-03: Canonical workflow statuses + transitions
 */
router.get('/workflow-config', TaskController.getWorkflowConfig);

/**
 * GET /api/tasks/:id
 * Get single task by ID
 */
router.get('/:id', TaskController.getTaskById);

/**
 * PUT /api/tasks/:id
 * Update task
 */
router.put('/:id', requireAudit, validateBody(UpdateTaskSchema), TaskController.updateTask);

/**
 * DELETE /api/tasks/:id
 * Delete task
 */
router.delete('/:id', requireAudit, TaskController.deleteTask);

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
router.post(
  '/:taskId/comments',
  requireAudit,
  validateBody(AddTaskCommentSchema),
  TaskController.addTaskComment
);

/**
 * DELETE /api/tasks/:taskId/comments/:commentId
 * Delete task comment
 */
router.delete('/:taskId/comments/:commentId', requireAudit, TaskController.deleteTaskComment);

// ==========================================
// TASK ASSIGNMENT & ESCALATION
// ==========================================

/**
 * POST /api/tasks/:id/assign
 * Assign task to user
 */
router.post('/:id/assign', requireAudit, validateBody(AssignTaskSchema), TaskController.assignTask);

/**
 * POST /api/tasks/:id/reassign
 * Reassign task
 */
router.post('/:id/reassign', requireAudit, validateBody(ReassignTaskSchema), TaskController.reassignTask);

/**
 * POST /api/tasks/:id/unassign
 * Unassign task
 */
router.post('/:id/unassign', requireAudit, TaskController.unassignTask);

/**
 * POST /api/tasks/:id/escalate
 * Escalate task
 */
router.post('/:id/escalate', requireAudit, validateBody(EscalateTaskSchema), TaskController.escalateTask);

/**
 * POST /api/tasks/:taskId/escalations/:escalationId/resolve
 * Resolve escalation
 */
router.post(
  '/:taskId/escalations/:escalationId/resolve',
  requireAudit,
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
router.post('/:id/block', requireAudit, validateBody(BlockTaskSchema), TaskController.blockTask);

/**
 * POST /api/tasks/:id/unblock
 * Unblock task
 */
router.post('/:id/unblock', requireAudit, validateBody(UnblockTaskSchema), TaskController.unblockTask);

/**
 * POST /api/tasks/:id/move
 * Move task to different initiative
 */
router.post('/:id/move', requireAudit, TaskController.moveTask);

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
router.post('/:id/dependencies', requireAudit, TaskController.addTaskDependency);

/**
 * DELETE /api/tasks/:id/dependencies/:depId
 * Remove a dependency
 */
router.delete('/:id/dependencies/:depId', requireAudit, TaskController.removeTaskDependency);

export default router;
