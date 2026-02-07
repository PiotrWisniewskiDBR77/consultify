/**
 * Audit Log Routes
 * API endpoints for viewing audit trail
 */
import { Router, Request, Response } from 'express';
import { verifyToken, isAuthenticated } from '../middleware/auth.middleware.js';
import { verifyAdmin } from '../middleware/admin.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { all as dbAll, get as dbGet } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

const router = Router();
interface AuthRequest extends Request { user?: { id: string; organizationId: string }; }

router.get('/', verifyToken, verifyAdmin, asyncHandler(async (req: AuthRequest, res: Response) => {
  const orgId = req.user?.organizationId;
  const { page = '1', limit = '50', action, userId, resource, from, to } = req.query;
  const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

  let where = 'WHERE al.organization_id = ?';
  const params: any[] = [orgId];
  if (action) { where += ' AND al.action_type = ?'; params.push(action); }
  if (userId) { where += ' AND al.user_id = ?'; params.push(userId); }
  if (resource) { where += ' AND al.resource_type = ?'; params.push(resource); }
  if (from) { where += ' AND al.created_at >= ?'; params.push(from); }
  if (to) { where += ' AND al.created_at <= ?'; params.push(to); }

  params.push(parseInt(limit as string), offset);

  const logs = await dbAll(`
    SELECT al.id, al.action_type, al.resource_type, al.resource_id, al.details,
           al.ip_address, al.user_agent, al.created_at,
           u.first_name, u.last_name, u.email
    FROM audit_log al
    LEFT JOIN users u ON al.user_id = u.id
    ${where}
    ORDER BY al.created_at DESC
    LIMIT ? OFFSET ?
  `, params);

  const countResult = await dbGet<{ count: number }>(`
    SELECT COUNT(*) as count FROM audit_log al ${where}
  `, params.slice(0, -2));

  res.json({
    data: logs || [],
    pagination: {
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      total: countResult?.count || 0,
      totalPages: Math.ceil((countResult?.count || 0) / parseInt(limit as string))
    }
  });
}));

router.get('/actions', verifyToken, verifyAdmin, asyncHandler(async (req: AuthRequest, res: Response) => {
  const orgId = req.user?.organizationId;
  const actions = await dbAll(`
    SELECT DISTINCT action_type, COUNT(*) as count 
    FROM audit_log WHERE organization_id = ?
    GROUP BY action_type ORDER BY count DESC
  `, [orgId]);
  res.json(actions || []);
}));

router.get('/export', verifyToken, verifyAdmin, asyncHandler(async (req: AuthRequest, res: Response) => {
  const orgId = req.user?.organizationId;
  const { from, to, format = 'json' } = req.query;

  let where = 'WHERE organization_id = ?';
  const params: any[] = [orgId];
  if (from) { where += ' AND created_at >= ?'; params.push(from); }
  if (to) { where += ' AND created_at <= ?'; params.push(to); }

  const logs = await dbAll(`
    SELECT * FROM audit_log ${where} ORDER BY created_at DESC LIMIT 10000
  `, params);

  if (format === 'csv') {
    const header = 'id,action_type,resource_type,resource_id,user_id,ip_address,created_at\n';
    const rows = (logs || []).map((l: any) =>
      `${l.id},${l.action_type},${l.resource_type},${l.resource_id},${l.user_id},${l.ip_address},${l.created_at}`
    ).join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=audit-log.csv');
    return res.send(header + rows);
  }

  res.json(logs || []);
}));

router.get('/:id', verifyToken, verifyAdmin, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const orgId = req.user?.organizationId;
  const log = await dbGet(`
    SELECT al.*, u.first_name, u.last_name, u.email
    FROM audit_log al LEFT JOIN users u ON al.user_id = u.id
    WHERE al.id = ? AND al.organization_id = ?
  `, [id, orgId]);
  if (!log) return res.status(404).json({ error: 'Audit log entry not found' });
  res.json(log);
}));

export default router;
