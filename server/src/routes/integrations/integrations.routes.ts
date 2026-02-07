/**
 * Integrations Routes
 * API endpoints for third-party integrations management
 */
import { Router, Request, Response } from 'express';
import { verifyToken, isAuthenticated } from '../../middleware/auth.middleware.js';
import { verifyAdmin } from '../../middleware/admin.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import { v4 as uuidv4 } from 'uuid';
import logger from '../../utils/Logger.js';

const router = Router();

interface AuthRequest extends Request {
  user?: { id: string; organizationId: string };
}

router.get('/', verifyToken, isAuthenticated, asyncHandler(async (req: AuthRequest, res: Response) => {
  const orgId = req.user?.organizationId;
  const integrations = await dbAll(`
    SELECT id, name, provider, type, status, config, last_synced_at, created_at
    FROM integrations WHERE organization_id = ?
    ORDER BY created_at DESC
  `, [orgId]);
  res.json(integrations || []);
}));

router.get('/available', verifyToken, isAuthenticated, asyncHandler(async (_req: AuthRequest, res: Response) => {
  res.json([
    { id: 'slack', name: 'Slack', category: 'communication', status: 'available' },
    { id: 'teams', name: 'Microsoft Teams', category: 'communication', status: 'available' },
    { id: 'jira', name: 'Jira', category: 'project_management', status: 'available' },
    { id: 'github', name: 'GitHub', category: 'development', status: 'available' },
    { id: 'google_calendar', name: 'Google Calendar', category: 'calendar', status: 'available' },
    { id: 'outlook', name: 'Outlook Calendar', category: 'calendar', status: 'available' },
    { id: 'stripe', name: 'Stripe', category: 'billing', status: 'available' },
    { id: 'salesforce', name: 'Salesforce', category: 'crm', status: 'coming_soon' },
    { id: 'hubspot', name: 'HubSpot', category: 'crm', status: 'coming_soon' },
  ]);
}));

router.post('/', verifyToken, verifyAdmin, asyncHandler(async (req: AuthRequest, res: Response) => {
  const orgId = req.user?.organizationId;
  const { name, provider, type, config } = req.body;
  if (!provider) return res.status(400).json({ error: 'Provider is required' });
  const id = uuidv4();
  await dbRun(`
    INSERT INTO integrations (id, organization_id, name, provider, type, status, config, created_at)
    VALUES (?, ?, ?, ?, ?, 'connected', ?, datetime('now'))
  `, [id, orgId, name || provider, provider, type || 'standard', JSON.stringify(config || {})]);
  logger.info(`[Integrations] Connected ${provider} for org ${orgId}`);
  res.status(201).json({ success: true, id });
}));

router.delete('/:id', verifyToken, verifyAdmin, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const orgId = req.user?.organizationId;
  await dbRun('DELETE FROM integrations WHERE id = ? AND organization_id = ?', [id, orgId]);
  res.json({ success: true });
}));

router.post('/:id/sync', verifyToken, verifyAdmin, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  await dbRun(`UPDATE integrations SET last_synced_at = datetime('now') WHERE id = ?`, [id]);
  res.json({ success: true, message: 'Sync initiated' });
}));

export default router;
