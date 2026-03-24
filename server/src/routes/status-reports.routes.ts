/**
 * Status Reports Routes
 * API endpoints for project and initiative status reports.
 * Initiative-scoped routes use StatusReportService (066 schema).
 */
import { Request, Response, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

import statusReportService from '../services/statusReportService.js';
import { isAuthenticated, verifyToken } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { all as dbAll, run as dbRun } from '../utils/DbPromise.js';

const router = Router();
interface AuthRequest extends Request {
  user?: { id: string; organizationId: string };
}

function paramStr(value: string | string[] | undefined): string {
  return Array.isArray(value) ? String(value[0] || '') : String(value || '');
}

// ─── Initiative-scoped (StatusReportBuilder) ───

router.get(
  '/initiative/:initiativeId/latest',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
    const { initiativeId } = req.params;
    const reports = await statusReportService.listReports(paramStr(initiativeId), orgId, { limit: 1 });
    const latest = reports[0];
    if (!latest) return res.json({ report: null });
    const full = await statusReportService.getReport(latest.id, orgId);
    res.json({ report: full });
  })
);

router.get(
  '/initiative/:initiativeId',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
    const { initiativeId } = req.params;
    const { limit = 20, offset = 0, status } = req.query;
    const reports = await statusReportService.listReports(paramStr(initiativeId), orgId, {
      limit: Number(limit),
      offset: Number(offset),
      status: status as string,
    });
    res.json({ reports });
  })
);

router.post(
  '/initiative/:initiativeId/generate',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    const userId = req.user?.id;
    if (!orgId || !userId) return res.status(401).json({ error: 'Unauthorized' });
    const { initiativeId } = req.params;
    const { periodType = 'WEEKLY', periodDate } = req.body || {};
    const result = await statusReportService.generateReport(orgId, paramStr(initiativeId), periodType, userId, {
      periodDate,
    });
    res.status(201).json(result);
  })
);

router.post(
  '/:id/distribute',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    const userId = req.user?.id;
    if (!orgId || !userId) return res.status(401).json({ error: 'Unauthorized' });
    const { id: reportId } = req.params;
    const { recipients } = req.body || {};
    if (!Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({ error: 'recipients array required' });
    }
    const report = await statusReportService.getReport(paramStr(reportId), orgId);
    if (!report) return res.status(404).json({ error: 'Report not found' });
    for (const r of recipients) {
      const email = typeof r === 'string' ? r : r?.email;
      if (email) {
        await dbRun(
          `INSERT INTO report_distributions (id, report_id, recipient_email, created_at)
           VALUES (?, ?, ?, datetime('now'))`,
          [uuidv4(), reportId, email]
        );
      }
    }
    res.json({ success: true });
  })
);

router.post(
  '/:id/approve',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { id: reportId } = req.params;
    const report = await statusReportService.getReport(paramStr(reportId), req.user!.organizationId!);
    if (!report) return res.status(404).json({ error: 'Report not found' });
    await statusReportService.approveReport(paramStr(reportId), userId);
    res.json({ success: true });
  })
);

router.post(
  '/:id/publish',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
    const { id: reportId } = req.params;
    const report = await statusReportService.getReport(paramStr(reportId), orgId);
    if (!report) return res.status(404).json({ error: 'Report not found' });
    await statusReportService.publishReport(paramStr(reportId));
    res.json({ success: true });
  })
);

router.get(
  '/',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    const { projectId } = req.query;
    let query =
      'SELECT id, project_id, title, content, health, period, created_by, created_at FROM status_reports WHERE organization_id = ?';
    const params: any[] = [orgId];
    if (projectId) {
      query += ' AND project_id = ?';
      params.push(projectId);
    }
    query += ' ORDER BY created_at DESC LIMIT 50';
    res.json(await dbAll(query, params));
  })
);

router.post(
  '/',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    const userId = req.user?.id;
    const { projectId, title, content, health, period } = req.body;
    const id = uuidv4();
    await dbRun(
      `INSERT INTO status_reports (id, organization_id, project_id, title, content, health, period, created_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [
        id,
        orgId,
        projectId,
        title || 'Status Report',
        JSON.stringify(content || {}),
        health || 'green',
        period || 'weekly',
        userId,
      ]
    );
    res.status(201).json({ success: true, id });
  })
);

router.delete(
  '/:id',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await dbRun('DELETE FROM status_reports WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  })
);

export default router;
