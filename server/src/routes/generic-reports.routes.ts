/**
 * Generic Reports Routes
 * API endpoints for report generation and management
 */
import { Router, Request, Response } from 'express';
import { verifyToken, isAuthenticated } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';
import { v4 as uuidv4 } from 'uuid';

const router = Router();
interface AuthRequest extends Request { user?: { id: string; organizationId: string }; }

router.get('/', verifyToken, isAuthenticated, asyncHandler(async (req: AuthRequest, res: Response) => {
  const orgId = req.user?.organizationId;
  const reports = await dbAll(`
    SELECT id, name, type, format, status, scheduled, last_generated_at, created_at
    FROM reports WHERE organization_id = ? ORDER BY created_at DESC
  `, [orgId]);
  res.json(reports || []);
}));

router.get('/templates', verifyToken, isAuthenticated, asyncHandler(async (_req: AuthRequest, res: Response) => {
  res.json([
    { id: 'project_status', name: 'Project Status Report', category: 'pmo' },
    { id: 'financial_summary', name: 'Financial Summary', category: 'finance' },
    { id: 'resource_utilization', name: 'Resource Utilization', category: 'hr' },
    { id: 'risk_assessment', name: 'Risk Assessment', category: 'governance' },
    { id: 'kpi_dashboard', name: 'KPI Dashboard Report', category: 'analytics' },
    { id: 'audit_trail', name: 'Audit Trail Report', category: 'compliance' },
  ]);
}));

router.post('/', verifyToken, isAuthenticated, asyncHandler(async (req: AuthRequest, res: Response) => {
  const orgId = req.user?.organizationId;
  const userId = req.user?.id;
  const { name, type, format, config } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const id = uuidv4();
  await dbRun(`
    INSERT INTO reports (id, organization_id, name, type, format, status, config, created_by, created_at)
    VALUES (?, ?, ?, ?, ?, 'draft', ?, ?, datetime('now'))
  `, [id, orgId, name, type || 'custom', format || 'pdf', JSON.stringify(config || {}), userId]);
  res.status(201).json({ success: true, id });
}));

router.post('/:id/generate', verifyToken, isAuthenticated, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  await dbRun(`UPDATE reports SET status = 'generating', last_generated_at = datetime('now') WHERE id = ?`, [id]);
  // In production, trigger async report generation
  setTimeout(async () => {
    await dbRun(`UPDATE reports SET status = 'completed' WHERE id = ?`, [id]);
  }, 1000);
  res.json({ success: true, message: 'Report generation started' });
}));

router.delete('/:id', verifyToken, isAuthenticated, asyncHandler(async (req: AuthRequest, res: Response) => {
  await dbRun('DELETE FROM reports WHERE id = ?', [req.params.id]);
  res.json({ success: true });
}));

export default router;
