/**
 * PDF Import Routes - API endpoints for importing PDF documents
 */
import { Router, Request, Response } from 'express';
import { verifyToken, isAuthenticated } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { all as dbAll, run as dbRun } from '../utils/DbPromise.js';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/Logger.js';

const router = Router();
interface AuthRequest extends Request { user?: { id: string; organizationId: string }; }

router.post('/', verifyToken, isAuthenticated, asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const orgId = req.user?.organizationId;
  const { filename, content, targetType, projectId } = req.body;
  if (!filename) return res.status(400).json({ error: 'Filename required' });
  const id = uuidv4();
  await dbRun(`INSERT INTO pdf_imports (id, organization_id, user_id, filename, target_type, project_id, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 'processing', datetime('now'))`,
    [id, orgId, userId, filename, targetType || 'document', projectId]);
  logger.info(`[PDFImport] Processing ${filename} for org ${orgId}`);
  res.status(201).json({ success: true, id, status: 'processing' });
}));

router.get('/', verifyToken, isAuthenticated, asyncHandler(async (req: AuthRequest, res: Response) => {
  const orgId = req.user?.organizationId;
  res.json(await dbAll(`SELECT id, filename, target_type, status, page_count, created_at
    FROM pdf_imports WHERE organization_id = ? ORDER BY created_at DESC LIMIT 50`, [orgId]) || []);
}));

router.get('/:id/status', verifyToken, isAuthenticated, asyncHandler(async (req: AuthRequest, res: Response) => {
  const record = await dbAll(`SELECT id, filename, status, page_count, error_message
    FROM pdf_imports WHERE id = ?`, [req.params.id]);
  if (!record?.length) return res.status(404).json({ error: 'Import not found' });
  res.json(record[0]);
}));

export default router;
