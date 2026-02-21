/**
 * Sponsor Reports Routes (T017)
 * API endpoints for sponsor-level analysis reports.
 */

import { Request, Response, Router } from 'express';

import { verifyToken } from '../middleware/auth.middleware.js';
import { apiAuthRateLimiter } from '../middleware/rateLimiting.middleware.js';
import * as sponsorReportService from '../services/sponsorReportService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import logger from '../utils/Logger.js';

const router = Router();

interface AuthRequest extends Request {
  user?: { id: string; organizationId: string; role: string };
}

router.use(apiAuthRateLimiter);
router.use(verifyToken);

router.post(
  '/generate',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { projectId, assessmentId, insightIds, title, language, templateType } = req.body;

    const result = await sponsorReportService.generateSponsorReport({
      organizationId: orgId,
      projectId,
      assessmentId,
      insightIds,
      title,
      language,
      createdBy: req.user!.id,
      templateType,
    });

    res.status(201).json({ success: true, ...result });
  })
);

router.get(
  '/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const reports = await sponsorReportService.listReports(orgId);
    res.json(reports);
  })
);

router.get(
  '/:reportId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const report = await sponsorReportService.getReport(req.params.reportId, orgId);
    if (!report) return res.status(404).json({ error: 'Report not found' });

    res.json(report);
  })
);

router.put(
  '/:reportId/sections/:sectionId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { content } = req.body;
    await sponsorReportService.updateSection(req.params.sectionId, req.params.reportId, content);
    res.json({ success: true });
  })
);

router.put(
  '/:reportId/status',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { status, approvedBy, rejectedReason, utilizationNotes } = req.body;
    await sponsorReportService.updateReportStatus(req.params.reportId, orgId, status, {
      approvedBy: approvedBy || req.user?.id,
      rejectedReason,
      utilizationNotes,
    });
    res.json({ success: true });
  })
);

router.get(
  '/:reportId/export',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const format = (req.query.format as string) || 'pptx';
    const reportData = await sponsorReportService.getReportForExport(req.params.reportId, orgId);
    if (!reportData) return res.status(404).json({ error: 'Report not found' });

    if (format === 'json') {
      return res.json(reportData);
    }

    try {
      const PptxGenJS = require('pptxgenjs');
      const pptx = new PptxGenJS();

      pptx.layout = 'LAYOUT_16x9';
      pptx.author = 'Consultinity';
      pptx.title = reportData.title;

      const BRAND = { primary: '6366F1', text: '1E293B', textLight: '64748B', bg: 'FFFFFF', surface: 'F8FAFC' };

      const coverSlide = pptx.addSlide();
      coverSlide.addShape('rect', { x: 0, y: 0, w: '100%', h: '100%', fill: { color: BRAND.primary } });
      coverSlide.addText(reportData.title, { x: 0.8, y: 2.0, w: 8.4, fontSize: 32, color: 'FFFFFF', bold: true });
      coverSlide.addText('CONFIDENTIAL', { x: 0.8, y: 4.5, w: 8.4, fontSize: 12, color: 'CCCCFF', italic: true });

      for (const section of reportData.sections) {
        const slide = pptx.addSlide();
        slide.addShape('rect', { x: 0, y: 0, w: '100%', h: 0.8, fill: { color: BRAND.primary } });
        slide.addText(section.title, { x: 0.5, y: 0.1, w: 9, fontSize: 18, color: 'FFFFFF', bold: true });

        const bullets = section.content.split('\n').filter((l: string) => l.trim());
        const bodyText = bullets.map((b: string) => ({
          text: b.replace(/^\d+\.\s*/, '').replace(/^[•\-]\s*/, '').replace(/\*\*/g, ''),
          options: { fontSize: 13, color: BRAND.text, bullet: true, breakType: 'none' as const },
        }));

        slide.addText(bodyText.length > 0 ? bodyText : [{ text: section.content, options: { fontSize: 13, color: BRAND.text } }], {
          x: 0.5, y: 1.2, w: 9, h: 4,
        });
      }

      if (reportData.assumptions.length > 0 || reportData.unknowns.length > 0) {
        const caveatSlide = pptx.addSlide();
        caveatSlide.addShape('rect', { x: 0, y: 0, w: '100%', h: 0.8, fill: { color: BRAND.primary } });
        caveatSlide.addText(reportData.language === 'pl' ? 'Zastrzeżenia' : 'Caveats', {
          x: 0.5, y: 0.1, w: 9, fontSize: 18, color: 'FFFFFF', bold: true,
        });
        const items = [
          ...reportData.assumptions.map((a: string) => `[Assumption] ${a}`),
          ...reportData.unknowns.map((u: string) => `[Unknown] ${u}`),
          ...reportData.counterpoints.map((c: string) => `[Counterpoint] ${c}`),
        ];
        caveatSlide.addText(
          items.map((t: string) => ({ text: t, options: { fontSize: 11, color: BRAND.textLight, bullet: true } })),
          { x: 0.5, y: 1.2, w: 9, h: 4 }
        );
      }

      const thankSlide = pptx.addSlide();
      thankSlide.addShape('rect', { x: 0, y: 0, w: '100%', h: '100%', fill: { color: BRAND.primary } });
      thankSlide.addText(reportData.language === 'pl' ? 'Dziękujemy' : 'Thank You', {
        x: 0.8, y: 2.5, w: 8.4, fontSize: 36, color: 'FFFFFF', bold: true, align: 'center',
      });
      thankSlide.addText('Powered by Consultinity', {
        x: 0.8, y: 4.0, w: 8.4, fontSize: 14, color: 'CCCCFF', align: 'center',
      });

      const buffer = await pptx.write({ outputType: 'nodebuffer' });
      const filename = `sponsor-report-${reportData.reportId.substring(0, 8)}.pptx`;

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(buffer);
    } catch (err) {
      logger.error('[SponsorReport] PPTX export error:', err);
      res.status(500).json({ error: 'Export failed' });
    }
  })
);

export default router;
