/**
 * My Work Routes
 * API endpoints for aggregated user work dashboard
 */
import { Router, Request, Response } from 'express';
import { verifyToken, isAuthenticated } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { all as dbAll, get as dbGet } from '../utils/DbPromise.js';

const router = Router();
interface AuthRequest extends Request { user?: { id: string; organizationId: string }; }

router.get('/', verifyToken, isAuthenticated, asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const orgId = req.user?.organizationId;

  const myTasks = await dbAll(`
    SELECT id, title, status, priority, due_date, project_id FROM tasks
    WHERE assignee_id = ? AND status != 'completed' ORDER BY priority DESC, due_date ASC LIMIT 20
  `, [userId]);

  const myProjects = await dbAll(`
    SELECT p.id, p.name, p.status, p.progress_pct FROM projects p
    JOIN project_members pm ON p.id = pm.project_id
    WHERE pm.user_id = ? AND p.status = 'active' LIMIT 10
  `, [userId]);

  const recentActivity = await dbAll(`
    SELECT id, action_type, resource_type, created_at FROM activity_logs
    WHERE user_id = ? ORDER BY created_at DESC LIMIT 10
  `, [userId]);

  const pendingApprovals = await dbAll(`
    SELECT id, title, type, created_at FROM approvals
    WHERE approver_id = ? AND status = 'pending' ORDER BY created_at DESC LIMIT 5
  `, [userId]);

  res.json({
    tasks: myTasks || [],
    projects: myProjects || [],
    recentActivity: recentActivity || [],
    pendingApprovals: pendingApprovals || [],
    stats: {
      openTasks: (myTasks || []).length,
      activeProjects: (myProjects || []).length,
      pendingApprovals: (pendingApprovals || []).length,
    }
  });
}));

router.get('/tasks', verifyToken, isAuthenticated, asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const { status, priority } = req.query;
  let where = 'WHERE assignee_id = ?';
  const params: any[] = [userId];
  if (status && status !== 'all') { where += ' AND status = ?'; params.push(status); }
  if (priority) { where += ' AND priority = ?'; params.push(priority); }
  const tasks = await dbAll(`SELECT * FROM tasks ${where} ORDER BY due_date ASC`, params);
  res.json(tasks || []);
}));

export default router;
