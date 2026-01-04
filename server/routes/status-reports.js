/**
 * Status Reports Routes - PMO Status Reporting
 * 
 * PMO Standards Compliance:
 * - ISO 21500:2021 - Progress Reporting (Clause 4.5.3)
 * - PMI PMBOK 7th Edition - Status Report / Dashboard
 * - PRINCE2 - Highlight Report
 * 
 * PMO Domain: PERFORMANCE_MONITORING
 */

import express from 'express';
const router = express.Router();
import * as StatusReportServiceModule from '../services/statusReportService.js';
const StatusReportService = StatusReportServiceModule.default || StatusReportServiceModule;
import verifyToken from '../middleware/authMiddleware.js';
import { asyncHandler } from '../src/utils/asyncHandler.ts';

router.use(verifyToken);

// ==========================================
// GENERATE NEW REPORT
// ==========================================
router.post('/initiative/:initiativeId/generate', asyncHandler(async (req, res) => {
    const orgId = req.user.organizationId;
    const userId = req.user.id;
    const { initiativeId } = req.params;
    const { periodType = 'WEEKLY', periodDate } = req.body;

    if (!['WEEKLY', 'MONTHLY', 'QUARTERLY'].includes(periodType)) {
        return res.status(400).json({
            error: 'Invalid period type',
            validTypes: ['WEEKLY', 'MONTHLY', 'QUARTERLY']
        });
    }

    const report = await StatusReportService.generateReport(
        orgId,
        initiativeId,
        periodType,
        userId,
        { periodDate, method: 'MANUAL' }
    );

    res.status(201).json({
        success: true,
        report,
        message: 'Report generated successfully'
    });
}));

// ==========================================
// LIST REPORTS FOR INITIATIVE
// ==========================================
router.get('/initiative/:initiativeId', asyncHandler(async (req, res) => {
    const orgId = req.user.organizationId;
    const { initiativeId } = req.params;
    const { limit = 20, offset = 0, status } = req.query;

    const reports = await StatusReportService.listReports(
        initiativeId,
        orgId,
        { limit: parseInt(limit), offset: parseInt(offset), status }
    );

    res.json({ reports, total: reports.length });
}));

// ==========================================
// GET SINGLE REPORT
// ==========================================
router.get('/:reportId', asyncHandler(async (req, res) => {
    const orgId = req.user.organizationId;
    const { reportId } = req.params;

    const report = await StatusReportService.getReport(reportId, orgId);

    if (!report) {
        return res.status(404).json({ error: 'Report not found' });
    }

    res.json({ report });
}));

// ==========================================
// UPDATE REPORT
// ==========================================
router.put('/:reportId', asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { reportId } = req.params;
    const updates = req.body;

    const updated = await StatusReportService.updateReport(reportId, updates, userId);

    if (!updated) {
        return res.status(400).json({ error: 'No valid fields to update' });
    }

    res.json({ success: true, message: 'Report updated' });
}));

// ==========================================
// APPROVE REPORT
// ==========================================
router.post('/:reportId/approve', asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { reportId } = req.params;

    await StatusReportService.approveReport(reportId, userId);

    res.json({ success: true, message: 'Report approved' });
}));

// ==========================================
// PUBLISH REPORT
// ==========================================
router.post('/:reportId/publish', asyncHandler(async (req, res) => {
    const { reportId } = req.params;

    await StatusReportService.publishReport(reportId);

    res.json({ success: true, message: 'Report published' });
}));

// ==========================================
// DISTRIBUTE REPORT
// ==========================================
router.post('/:reportId/distribute', asyncHandler(async (req, res) => {
    const orgId = req.user.organizationId;
    const { reportId } = req.params;
    const { recipients } = req.body;

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
        return res.status(400).json({ error: 'Recipients array required' });
    }

    // Get report
    const report = await StatusReportService.getReport(reportId, orgId);
    if (!report) {
        return res.status(404).json({ error: 'Report not found' });
    }

    // Create distribution records
    const distributions = [];
    for (const recipient of recipients) {
        const dist = await StatusReportService.createDistribution(reportId, recipient);
        distributions.push(dist);
    }

    // In production, would trigger email sending here
    // For now, just mark as sent
    for (const dist of distributions) {
        await StatusReportService.markDistributionSent(dist.id);
    }

    res.json({
        success: true,
        message: `Report distributed to ${recipients.length} recipients`,
        distributions
    });
}));

// ==========================================
// EXPORT REPORT
// ==========================================
router.get('/:reportId/export/:format', asyncHandler(async (req, res) => {
    const orgId = req.user.organizationId;
    const { reportId, format } = req.params;

    if (!['pdf', 'pptx'].includes(format.toLowerCase())) {
        return res.status(400).json({
            error: 'Invalid export format',
            validFormats: ['pdf', 'pptx']
        });
    }

    // Get report
    const report = await StatusReportService.getReport(reportId, orgId);
    if (!report) {
        return res.status(404).json({ error: 'Report not found' });
    }

    try {
        if (format.toLowerCase() === 'pdf') {
            const PdfExportServiceModule = await import('../services/pdfExportService.js');
            const PdfExportService = PdfExportServiceModule.default || PdfExportServiceModule;

            // Generate PDF buffer
            const pdfBuffer = await PdfExportService.generateStatusReportPdf(report);

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition',
                `attachment; filename="status-report-${report.periodLabel.replace(/[^a-zA-Z0-9]/g, '-')}.pdf"`);
            res.send(pdfBuffer);
        } else {
            const PptxExportServiceModule = await import('../services/pptxExportService.js');
            const PptxExportService = PptxExportServiceModule.default || PptxExportServiceModule;

            // Generate PPTX buffer
            const pptxBuffer = await PptxExportService.generateStatusReportPptx(report);

            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
            res.setHeader('Content-Disposition',
                `attachment; filename="status-report-${report.periodLabel.replace(/[^a-zA-Z0-9]/g, '-')}.pptx"`);
            res.send(pptxBuffer);
        }
    } catch (error) {
        console.error('[StatusReports] Export error:', error);
        res.status(500).json({
            error: 'Failed to export report',
            message: error.message
        });
    }
}));

// ==========================================
// GET REPORT METADATA
// ==========================================
router.get('/metadata/options', asyncHandler(async (req, res) => {
    res.json({
        periodTypes: Object.values(StatusReportService.PERIOD_TYPES),
        ragStatuses: Object.values(StatusReportService.RAG_STATUS),
        sectionNames: Object.values(StatusReportService.SECTION_NAMES)
    });
}));

// ==========================================
// GET LATEST REPORT FOR INITIATIVE
// ==========================================
router.get('/initiative/:initiativeId/latest', asyncHandler(async (req, res) => {
    const orgId = req.user.organizationId;
    const { initiativeId } = req.params;

    const reports = await StatusReportService.listReports(initiativeId, orgId, { limit: 1 });

    if (reports.length === 0) {
        return res.json({ report: null, message: 'No reports found' });
    }

    // Get full report
    const report = await StatusReportService.getReport(reports[0].id, orgId);

    res.json({ report });
}));

export default router;











