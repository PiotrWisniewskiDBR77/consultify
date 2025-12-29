/**
 * Management Reports API Routes
 * 
 * REST API endpoints for generating and managing management reports:
 * - Team Meeting Reports
 * - Steering Committee Reports
 * 
 * PMO Standards: ISO 21500, PMBOK 7, PRINCE2
 */

const express = require('express');
const router = express.Router();
const Joi = require('joi');
const authMiddleware = require('../middleware/authMiddleware');
const ManagementReportsService = require('../services/managementReportsService');
const BrandingService = require('../services/brandingService');

// ==========================================
// VALIDATION SCHEMAS
// ==========================================

const generateReportSchema = Joi.object({
    reportType: Joi.string().valid('TEAM_MEETING', 'STEERING_COMMITTEE').required()
        .messages({ 'any.required': 'reportType is required', 'any.only': 'reportType must be TEAM_MEETING or STEERING_COMMITTEE' }),
    scope: Joi.string().valid('PROJECT', 'PORTFOLIO').default('PORTFOLIO'),
    projectId: Joi.string().when('scope', { is: 'PROJECT', then: Joi.required() })
        .messages({ 'any.required': 'projectId is required when scope is PROJECT' }),
    organizationId: Joi.string().allow(null, ''),
    periodDays: Joi.number().integer().min(1).max(365).default(7)
        .messages({ 'number.min': 'periodDays must be at least 1', 'number.max': 'periodDays cannot exceed 365' }),
    customPeriodStart: Joi.date().iso().allow(null),
    customPeriodEnd: Joi.date().iso().greater(Joi.ref('customPeriodStart')).allow(null)
        .messages({ 'date.greater': 'customPeriodEnd must be after customPeriodStart' }),
    includeSections: Joi.array().items(Joi.string()).default([]),
    excludeSections: Joi.array().items(Joi.string()).default([]),
    aiEnhancement: Joi.boolean().default(true),
    generatePdf: Joi.boolean().default(false),
    generatePptx: Joi.boolean().default(false)
});

const historyFilterSchema = Joi.object({
    projectId: Joi.string().allow(null, ''),
    reportType: Joi.string().valid('TEAM_MEETING', 'STEERING_COMMITTEE').allow(null, ''),
    scope: Joi.string().valid('PROJECT', 'PORTFOLIO').allow(null, ''),
    status: Joi.string().valid('DRAFT', 'FINAL', 'ARCHIVED').allow(null, ''),
    fromDate: Joi.date().iso().allow(null, ''),
    toDate: Joi.date().iso().allow(null, ''),
    limit: Joi.number().integer().min(1).max(100).default(20),
    offset: Joi.number().integer().min(0).default(0)
});

const shareReportSchema = Joi.object({
    expiresInDays: Joi.number().integer().min(1).max(90).default(7)
});

const updateStatusSchema = Joi.object({
    status: Joi.string().valid('DRAFT', 'FINAL', 'ARCHIVED').required()
});

/**
 * Validation middleware factory
 */
const validate = (schema) => (req, res, next) => {
    const dataToValidate = req.method === 'GET' ? req.query : req.body;
    const { error, value } = schema.validate(dataToValidate, { abortEarly: false, stripUnknown: true });

    if (error) {
        const errors = error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message
        }));
        return res.status(400).json({ error: 'Validation failed', details: errors });
    }

    if (req.method === 'GET') {
        req.query = value;
    } else {
        req.body = value;
    }
    next();
};

// Lazy load PDF and PPTX generators to avoid startup errors
let PdfGeneratorService;
let PptxGeneratorService;

const getPdfGenerator = () => {
    if (!PdfGeneratorService) {
        try {
            PdfGeneratorService = require('../services/pdfGeneratorService');
        } catch (e) {
            console.warn('[ManagementReports] PDF Generator not available:', e.message);
        }
    }
    return PdfGeneratorService;
};

const getPptxGenerator = () => {
    if (!PptxGeneratorService) {
        try {
            PptxGeneratorService = require('../services/pptxGeneratorService');
        } catch (e) {
            console.warn('[ManagementReports] PPTX Generator not available:', e.message);
        }
    }
    return PptxGeneratorService;
};

// ==========================================
// REPORT GENERATION
// ==========================================

/**
 * POST /api/management-reports/generate
 * Generate a new management report
 */
router.post('/generate', authMiddleware, validate(generateReportSchema), async (req, res) => {
    try {
        const {
            reportType,
            scope,
            projectId,
            organizationId,
            periodDays,
            customPeriodStart,
            customPeriodEnd,
            includeSections,
            excludeSections,
            aiEnhancement,
            generatePdf,
            generatePptx
        } = req.body;

        const userId = req.user.id;
        const orgId = organizationId || req.user.organization_id;

        const options = {
            periodDays,
            customPeriodStart,
            customPeriodEnd,
            userId,
            aiEnhancement,
            includeSections,
            excludeSections
        };

        let report;

        // Generate appropriate report type
        if (reportType === 'TEAM_MEETING') {
            if (scope === 'PORTFOLIO' || !projectId) {
                report = await ManagementReportsService.generatePortfolioTeamReport(orgId, options);
            } else {
                report = await ManagementReportsService.generateTeamMeetingReport(projectId, options);
            }
        } else if (reportType === 'STEERING_COMMITTEE') {
            if (scope === 'PORTFOLIO' || !projectId) {
                report = await ManagementReportsService.generatePortfolioSteeringReport(orgId, options);
            } else {
                report = await ManagementReportsService.generateSteeringCommitteeReport(projectId, options);
            }
        }

        // Fetch organization branding for PDF/PPTX generation
        let branding = {};
        if (generatePdf || generatePptx) {
            try {
                const orgBranding = await BrandingService.getByOrganization(orgId);
                if (orgBranding) {
                    branding = {
                        companyName: orgBranding.organizationName,
                        logoUrl: orgBranding.logoLightUrl,
                        primaryColor: orgBranding.primaryColor,
                        secondaryColor: orgBranding.secondaryColor,
                        accentColor: orgBranding.accentColor,
                        fontFamily: orgBranding.fontFamily,
                        hidePoweredBy: orgBranding.hidePoweredBy
                    };
                }
            } catch (brandingErr) {
                console.warn('[ManagementReports] Could not fetch branding:', brandingErr.message);
            }
        }

        // Generate PDF if requested
        if (generatePdf) {
            const pdfGenerator = getPdfGenerator();
            if (pdfGenerator && pdfGenerator.generateManagementReportPDF) {
                try {
                    const pdfPath = await pdfGenerator.generateManagementReportPDF(report, { branding });
                    report.pdfPath = pdfPath;
                } catch (pdfError) {
                    console.error('[ManagementReports] PDF generation failed:', pdfError);
                }
            }
        }

        // Generate PPTX if requested
        if (generatePptx) {
            const pptxGenerator = getPptxGenerator();
            if (pptxGenerator && pptxGenerator.generateManagementReportPPTX) {
                try {
                    const pptxPath = await pptxGenerator.generateManagementReportPPTX(report, { branding });
                    report.pptxPath = pptxPath;
                } catch (pptxError) {
                    console.error('[ManagementReports] PPTX generation failed:', pptxError);
                }
            }
        }

        res.json({
            success: true,
            report
        });

    } catch (error) {
        console.error('[ManagementReports] Generate error:', error);
        res.status(500).json({ error: error.message || 'Failed to generate report' });
    }
});

// ==========================================
// REPORT RETRIEVAL
// ==========================================

/**
 * GET /api/management-reports/:id
 * Get a specific report by ID
 */
router.get('/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const report = await ManagementReportsService.getReport(id);

        if (!report) {
            return res.status(404).json({ error: 'Report not found' });
        }

        // Verify access (same organization)
        if (report.organization_id !== req.user.organization_id && req.user.role !== 'SUPERADMIN') {
            return res.status(403).json({ error: 'Access denied' });
        }

        res.json({ report });

    } catch (error) {
        console.error('[ManagementReports] Get report error:', error);
        res.status(500).json({ error: error.message || 'Failed to get report' });
    }
});

/**
 * GET /api/management-reports/history
 * Get report history with filters
 */
router.get('/history', authMiddleware, validate(historyFilterSchema), async (req, res) => {
    try {
        const {
            projectId,
            reportType,
            scope,
            status,
            fromDate,
            toDate,
            limit,
            offset
        } = req.query;

        const organizationId = req.user.organization_id;

        const { reports, total } = await ManagementReportsService.getReportHistory({
            organizationId,
            projectId,
            reportType,
            scope,
            status,
            fromDate,
            toDate,
            limit,
            offset
        });

        res.json({ reports, total, limit, offset });

    } catch (error) {
        console.error('[ManagementReports] Get history error:', error);
        res.status(500).json({ error: error.message || 'Failed to get report history' });
    }
});

// ==========================================
// REPORT ACTIONS
// ==========================================

/**
 * PATCH /api/management-reports/:id/status
 * Update report status (DRAFT -> FINAL -> ARCHIVED)
 */
router.patch('/:id/status', authMiddleware, validate(updateStatusSchema), async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        await ManagementReportsService.updateReportStatus(id, status);
        res.json({ success: true });

    } catch (error) {
        console.error('[ManagementReports] Update status error:', error);
        res.status(500).json({ error: error.message || 'Failed to update status' });
    }
});

/**
 * POST /api/management-reports/:id/share
 * Create a share link for the report
 */
router.post('/:id/share', authMiddleware, validate(shareReportSchema), async (req, res) => {
    try {
        const { id } = req.params;
        const { expiresInDays } = req.body;

        const result = await ManagementReportsService.createShareLink(id, expiresInDays);

        res.json({
            success: true,
            shareToken: result.shareToken,
            shareUrl: `/reports/shared/${result.shareToken}`,
            expiresAt: result.expiresAt
        });

    } catch (error) {
        console.error('[ManagementReports] Share error:', error);
        res.status(500).json({ error: error.message || 'Failed to create share link' });
    }
});

/**
 * GET /api/management-reports/shared/:token
 * Get report by share token (public access)
 */
router.get('/shared/:token', async (req, res) => {
    try {
        const { token } = req.params;
        const report = await ManagementReportsService.getReportByShareToken(token);

        if (!report) {
            return res.status(404).json({ error: 'Report not found or link expired' });
        }

        // Return report without sensitive data
        const publicReport = {
            id: report.id,
            reportType: report.report_type,
            scope: report.scope,
            title: report.title,
            periodStart: report.period_start,
            periodEnd: report.period_end,
            content: report.content,
            aiNarrative: report.ai_narrative,
            createdAt: report.created_at
        };

        res.json({ report: publicReport });

    } catch (error) {
        console.error('[ManagementReports] Get shared report error:', error);
        res.status(500).json({ error: error.message || 'Failed to get shared report' });
    }
});

// ==========================================
// EXPORT ENDPOINTS
// ==========================================

/**
 * GET /api/management-reports/:id/pdf
 * Export report to PDF
 */
router.get('/:id/pdf', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const report = await ManagementReportsService.getReport(id);

        if (!report) {
            return res.status(404).json({ error: 'Report not found' });
        }

        // Check if PDF already exists
        if (report.pdf_path) {
            return res.json({ pdfUrl: report.pdf_path });
        }

        // Generate PDF
        const pdfGenerator = getPdfGenerator();
        if (!pdfGenerator || !pdfGenerator.generateManagementReportPDF) {
            return res.status(501).json({ error: 'PDF generation not available' });
        }

        // Fetch organization branding
        let branding = {};
        try {
            const orgBranding = await BrandingService.getByOrganization(report.organization_id);
            if (orgBranding) {
                branding = {
                    companyName: orgBranding.organizationName,
                    logoUrl: orgBranding.logoLightUrl,
                    primaryColor: orgBranding.primaryColor,
                    secondaryColor: orgBranding.secondaryColor,
                    accentColor: orgBranding.accentColor,
                    fontFamily: orgBranding.fontFamily,
                    hidePoweredBy: orgBranding.hidePoweredBy
                };
            }
        } catch (brandingErr) {
            console.warn('[ManagementReports] Could not fetch branding for PDF:', brandingErr.message);
        }

        const pdfPath = await pdfGenerator.generateManagementReportPDF(report, { branding });

        res.json({ pdfUrl: pdfPath });

    } catch (error) {
        console.error('[ManagementReports] PDF export error:', error);
        res.status(500).json({ error: error.message || 'Failed to export PDF' });
    }
});

/**
 * GET /api/management-reports/:id/pptx
 * Export report to PowerPoint
 */
router.get('/:id/pptx', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const report = await ManagementReportsService.getReport(id);

        if (!report) {
            return res.status(404).json({ error: 'Report not found' });
        }

        // Check if PPTX already exists
        if (report.pptx_path) {
            return res.json({ pptxUrl: report.pptx_path });
        }

        // Generate PPTX
        const pptxGenerator = getPptxGenerator();
        if (!pptxGenerator || !pptxGenerator.generateManagementReportPPTX) {
            return res.status(501).json({ error: 'PowerPoint generation not available' });
        }

        // Fetch organization branding
        let branding = {};
        try {
            const orgBranding = await BrandingService.getByOrganization(report.organization_id);
            if (orgBranding) {
                branding = {
                    companyName: orgBranding.organizationName,
                    logoUrl: orgBranding.logoLightUrl,
                    primaryColor: orgBranding.primaryColor,
                    secondaryColor: orgBranding.secondaryColor,
                    accentColor: orgBranding.accentColor,
                    fontFamily: orgBranding.fontFamily,
                    hidePoweredBy: orgBranding.hidePoweredBy
                };
            }
        } catch (brandingErr) {
            console.warn('[ManagementReports] Could not fetch branding for PPTX:', brandingErr.message);
        }

        const pptxPath = await pptxGenerator.generateManagementReportPPTX(report, { branding });

        res.json({ pptxUrl: pptxPath });

    } catch (error) {
        console.error('[ManagementReports] PPTX export error:', error);
        res.status(500).json({ error: error.message || 'Failed to export PowerPoint' });
    }
});

// ==========================================
// ORGANIZATION/PROJECT SCOPED ENDPOINTS
// ==========================================

/**
 * GET /api/management-reports/organization/:orgId
 * Get all reports for an organization
 */
router.get('/organization/:orgId', authMiddleware, async (req, res) => {
    try {
        const { orgId } = req.params;
        const { reportType, limit = 20, offset = 0 } = req.query;

        // Verify access
        if (orgId !== req.user.organization_id && req.user.role !== 'SUPERADMIN') {
            return res.status(403).json({ error: 'Access denied' });
        }

        const reports = await ManagementReportsService.getReportHistory({
            organizationId: orgId,
            reportType,
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

        res.json({ reports });

    } catch (error) {
        console.error('[ManagementReports] Get org reports error:', error);
        res.status(500).json({ error: error.message || 'Failed to get reports' });
    }
});

/**
 * GET /api/management-reports/project/:projectId
 * Get all reports for a project
 */
router.get('/project/:projectId', authMiddleware, async (req, res) => {
    try {
        const { projectId } = req.params;
        const { reportType, limit = 20, offset = 0 } = req.query;

        const reports = await ManagementReportsService.getReportHistory({
            organizationId: req.user.organization_id,
            projectId,
            reportType,
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

        res.json({ reports });

    } catch (error) {
        console.error('[ManagementReports] Get project reports error:', error);
        res.status(500).json({ error: error.message || 'Failed to get reports' });
    }
});

// ==========================================
// REPORT TYPES METADATA
// ==========================================

/**
 * GET /api/management-reports/types
 * Get available report types and their configurations
 */
router.get('/types', authMiddleware, (req, res) => {
    res.json({
        types: [
            {
                id: 'TEAM_MEETING',
                name: 'Team Meeting Report',
                description: 'Weekly status report for project team synchronization',
                defaultPeriodDays: 7,
                prince2Mapping: 'Checkpoint Report',
                pmbokMapping: 'Team Performance Domain',
                sections: [
                    { id: 'statusSummary', name: 'Status Overview', required: true },
                    { id: 'completedWork', name: 'Completed Work', required: true },
                    { id: 'workInProgress', name: 'Work in Progress', required: true },
                    { id: 'blockers', name: 'Blockers & Issues', required: true },
                    { id: 'pendingDecisions', name: 'Pending Decisions', required: false },
                    { id: 'nextPeriodPlan', name: 'Next Period Plan', required: true }
                ]
            },
            {
                id: 'STEERING_COMMITTEE',
                name: 'Steering Committee Report',
                description: 'Executive summary for decision makers and board',
                defaultPeriodDays: 30,
                prince2Mapping: 'Highlight Report',
                pmbokMapping: 'Measurement Performance Domain',
                sections: [
                    { id: 'executiveSummary', name: 'Executive Summary', required: true },
                    { id: 'overallStatus', name: 'RAG Status', required: true },
                    { id: 'kpis', name: 'Key Performance Indicators', required: true },
                    { id: 'risksAndIssues', name: 'Risks & Issues', required: true },
                    { id: 'decisionsRequired', name: 'Decisions Required', required: true },
                    { id: 'forecast', name: 'Forecast & Milestones', required: true }
                ]
            }
        ],
        scopes: [
            { id: 'PROJECT', name: 'Single Project', description: 'Report for one specific project' },
            { id: 'PORTFOLIO', name: 'Portfolio', description: 'Aggregated report across all projects' }
        ]
    });
});

// ==========================================
// APPROVAL WORKFLOW
// ==========================================

// Lazy load approval service
let ReportApprovalService;
const getApprovalService = () => {
    if (!ReportApprovalService) {
        ReportApprovalService = require('../services/reportApprovalService');
    }
    return ReportApprovalService;
};

// Validation schemas for approval
const submitForApprovalSchema = Joi.object({
    config: Joi.object({
        levels: Joi.array().items(Joi.object({
            level: Joi.number().integer().min(1).required(),
            role: Joi.string().valid('MANAGER', 'PMO_LEAD', 'SPONSOR').required(),
            required: Joi.boolean().default(true),
            slaHours: Joi.number().integer().min(1).default(48),
            assignedTo: Joi.string().allow(null)
        })).min(1)
    }).allow(null)
});

const approvalDecisionSchema = Joi.object({
    comment: Joi.string().max(2000).allow(null, '')
});

const rejectSchema = Joi.object({
    comment: Joi.string().max(2000).required(),
    returnToDraft: Joi.boolean().default(true)
});

/**
 * POST /api/management-reports/:id/submit
 * Submit report for approval
 */
router.post('/:id/submit', authMiddleware, validate(submitForApprovalSchema), async (req, res) => {
    try {
        const { id } = req.params;
        const { config } = req.body;
        const userId = req.user.id;

        const approvalService = getApprovalService();
        const result = await approvalService.submitForApproval(id, userId, { config });

        res.json(result);
    } catch (error) {
        console.error('[ManagementReports] Submit for approval error:', error);
        res.status(500).json({ error: error.message || 'Failed to submit for approval' });
    }
});

/**
 * POST /api/management-reports/:id/approve
 * Approve report at current level
 */
router.post('/:id/approve', authMiddleware, validate(approvalDecisionSchema), async (req, res) => {
    try {
        const { id } = req.params;
        const { comment } = req.body;
        const userId = req.user.id;

        const approvalService = getApprovalService();
        const result = await approvalService.approve(id, userId, comment);

        res.json(result);
    } catch (error) {
        console.error('[ManagementReports] Approve error:', error);
        res.status(500).json({ error: error.message || 'Failed to approve' });
    }
});

/**
 * POST /api/management-reports/:id/reject
 * Reject report
 */
router.post('/:id/reject', authMiddleware, validate(rejectSchema), async (req, res) => {
    try {
        const { id } = req.params;
        const { comment, returnToDraft } = req.body;
        const userId = req.user.id;

        const approvalService = getApprovalService();
        const result = await approvalService.reject(id, userId, comment, returnToDraft);

        res.json(result);
    } catch (error) {
        console.error('[ManagementReports] Reject error:', error);
        res.status(500).json({ error: error.message || 'Failed to reject' });
    }
});

/**
 * GET /api/management-reports/:id/approval-status
 * Get approval chain status
 */
router.get('/:id/approval-status', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const approvalService = getApprovalService();
        const status = await approvalService.getApprovalStatus(id, userId);

        res.json(status);
    } catch (error) {
        console.error('[ManagementReports] Get approval status error:', error);
        res.status(500).json({ error: error.message || 'Failed to get approval status' });
    }
});

/**
 * GET /api/management-reports/pending-approvals
 * Get pending approvals for current user
 */
router.get('/pending-approvals', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const orgId = req.user.organization_id;
        const { limit = 20, offset = 0 } = req.query;

        const approvalService = getApprovalService();
        const result = await approvalService.getPendingApprovalsForUser(userId, orgId, {
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

        res.json(result);
    } catch (error) {
        console.error('[ManagementReports] Get pending approvals error:', error);
        res.status(500).json({ error: error.message || 'Failed to get pending approvals' });
    }
});

/**
 * GET /api/management-reports/:id/approval-history
 * Get approval history
 */
router.get('/:id/approval-history', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;

        const approvalService = getApprovalService();
        const history = await approvalService.getApprovalHistory(id);

        res.json({ history });
    } catch (error) {
        console.error('[ManagementReports] Get approval history error:', error);
        res.status(500).json({ error: error.message || 'Failed to get approval history' });
    }
});

// ==========================================
// VERSION CONTROL
// ==========================================

// Lazy load version service
let ReportVersionService;
const getVersionService = () => {
    if (!ReportVersionService) {
        ReportVersionService = require('../services/reportVersionService');
    }
    return ReportVersionService;
};

/**
 * GET /api/management-reports/:id/versions
 * List all versions of a report
 */
router.get('/:id/versions', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { limit = 50, offset = 0, includeContent = false } = req.query;

        const versionService = getVersionService();
        const result = await versionService.getVersions(id, {
            limit: parseInt(limit),
            offset: parseInt(offset),
            includeContent: includeContent === 'true'
        });

        res.json(result);
    } catch (error) {
        console.error('[ManagementReports] Get versions error:', error);
        res.status(500).json({ error: error.message || 'Failed to get versions' });
    }
});

/**
 * GET /api/management-reports/:id/versions/:versionNumber
 * Get specific version
 */
router.get('/:id/versions/:versionNumber', authMiddleware, async (req, res) => {
    try {
        const { id, versionNumber } = req.params;

        const versionService = getVersionService();
        const version = await versionService.getVersion(id, parseInt(versionNumber));

        res.json({ version });
    } catch (error) {
        console.error('[ManagementReports] Get version error:', error);
        res.status(500).json({ error: error.message || 'Failed to get version' });
    }
});

/**
 * GET /api/management-reports/:id/versions/compare
 * Compare two versions
 */
router.get('/:id/versions/compare', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { v1, v2 } = req.query;

        if (!v1 || !v2) {
            return res.status(400).json({ error: 'Both v1 and v2 query parameters are required' });
        }

        const versionService = getVersionService();
        const comparison = await versionService.compareVersions(id, parseInt(v1), parseInt(v2));

        res.json(comparison);
    } catch (error) {
        console.error('[ManagementReports] Compare versions error:', error);
        res.status(500).json({ error: error.message || 'Failed to compare versions' });
    }
});

/**
 * POST /api/management-reports/:id/versions/:versionNumber/restore
 * Restore a previous version
 */
router.post('/:id/versions/:versionNumber/restore', authMiddleware, async (req, res) => {
    try {
        const { id, versionNumber } = req.params;
        const userId = req.user.id;

        const versionService = getVersionService();
        const result = await versionService.restoreVersion(id, parseInt(versionNumber), userId);

        res.json({ success: true, version: result });
    } catch (error) {
        console.error('[ManagementReports] Restore version error:', error);
        res.status(500).json({ error: error.message || 'Failed to restore version' });
    }
});

// ==========================================
// LOCK / FINALIZE
// ==========================================

/**
 * POST /api/management-reports/:id/finalize
 * Finalize and lock a report
 */
router.post('/:id/finalize', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const result = await ManagementReportsService.finalizeReport(id, userId);

        res.json({ success: true, ...result });
    } catch (error) {
        console.error('[ManagementReports] Finalize error:', error);
        res.status(500).json({ error: error.message || 'Failed to finalize report' });
    }
});

/**
 * POST /api/management-reports/:id/unlock
 * Unlock a finalized report (admin only)
 */
router.post('/:id/unlock', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;
        const userId = req.user.id;

        // Check admin permission
        if (!['ADMIN', 'SUPERADMIN', 'admin'].includes(req.user.role)) {
            return res.status(403).json({ error: 'Only administrators can unlock reports' });
        }

        const result = await ManagementReportsService.unlockReport(id, userId, reason);

        res.json({ success: true, ...result });
    } catch (error) {
        console.error('[ManagementReports] Unlock error:', error);
        res.status(500).json({ error: error.message || 'Failed to unlock report' });
    }
});

/**
 * GET /api/management-reports/:id/verify-integrity
 * Verify report integrity
 */
router.get('/:id/verify-integrity', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;

        const result = await ManagementReportsService.verifyIntegrity(id);

        res.json(result);
    } catch (error) {
        console.error('[ManagementReports] Verify integrity error:', error);
        res.status(500).json({ error: error.message || 'Failed to verify integrity' });
    }
});

// ==========================================
// AUDIT LOG
// ==========================================

// Lazy load audit service
let ReportAuditService;
const getAuditService = () => {
    if (!ReportAuditService) {
        ReportAuditService = require('../services/reportAuditService');
    }
    return ReportAuditService;
};

/**
 * GET /api/management-reports/:id/audit-log
 * Get audit log for a report
 */
router.get('/:id/audit-log', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { actions, actorId, fromDate, toDate, limit = 100, offset = 0 } = req.query;

        const auditService = getAuditService();
        const result = await auditService.getAuditLog(id, {
            actions: actions ? actions.split(',') : undefined,
            actorId,
            fromDate,
            toDate,
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

        res.json(result);
    } catch (error) {
        console.error('[ManagementReports] Get audit log error:', error);
        res.status(500).json({ error: error.message || 'Failed to get audit log' });
    }
});

/**
 * GET /api/management-reports/:id/audit-log/export
 * Export audit log
 */
router.get('/:id/audit-log/export', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { format = 'json' } = req.query;

        const auditService = getAuditService();
        const result = await auditService.exportAuditLog(id, format);

        if (format === 'csv') {
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="audit-log-${id}.csv"`);
            return res.send(result);
        }

        res.json(result);
    } catch (error) {
        console.error('[ManagementReports] Export audit log error:', error);
        res.status(500).json({ error: error.message || 'Failed to export audit log' });
    }
});

/**
 * GET /api/management-reports/:id/activity-summary
 * Get activity summary
 */
router.get('/:id/activity-summary', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;

        const auditService = getAuditService();
        const summary = await auditService.getActivitySummary(id);

        res.json(summary);
    } catch (error) {
        console.error('[ManagementReports] Get activity summary error:', error);
        res.status(500).json({ error: error.message || 'Failed to get activity summary' });
    }
});

// ==========================================
// COMMENTS
// ==========================================

// Lazy load comments service
let ReportCommentsService;
const getCommentsService = () => {
    if (!ReportCommentsService) {
        ReportCommentsService = require('../services/reportCommentsService');
    }
    return ReportCommentsService;
};

const addCommentSchema = Joi.object({
    sectionId: Joi.string().allow(null, ''),
    content: Joi.string().max(5000).required(),
    mentions: Joi.array().items(Joi.string()).default([]),
    parentCommentId: Joi.string().allow(null)
});

const updateCommentSchema = Joi.object({
    content: Joi.string().max(5000).allow(null),
    isResolved: Joi.boolean().allow(null)
});

/**
 * POST /api/management-reports/:id/comments
 * Add a comment to a report
 */
router.post('/:id/comments', authMiddleware, validate(addCommentSchema), async (req, res) => {
    try {
        const { id } = req.params;
        const { sectionId, content, mentions, parentCommentId } = req.body;
        const userId = req.user.id;

        const commentsService = getCommentsService();
        const comment = await commentsService.addComment(
            id,
            sectionId,
            content,
            userId,
            mentions,
            parentCommentId
        );

        res.status(201).json({ success: true, comment });
    } catch (error) {
        console.error('[ManagementReports] Add comment error:', error);
        res.status(500).json({ error: error.message || 'Failed to add comment' });
    }
});

/**
 * GET /api/management-reports/:id/comments
 * Get comments for a report
 */
router.get('/:id/comments', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { sectionId, resolved } = req.query;

        const commentsService = getCommentsService();
        const resolvedFilter = resolved === 'true' ? true : resolved === 'false' ? false : null;
        const comments = await commentsService.getComments(id, sectionId, resolvedFilter);

        res.json({ success: true, comments });
    } catch (error) {
        console.error('[ManagementReports] Get comments error:', error);
        res.status(500).json({ error: error.message || 'Failed to get comments' });
    }
});

/**
 * GET /api/management-reports/:id/comments/threaded
 * Get threaded comments for a report
 */
router.get('/:id/comments/threaded', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;

        const commentsService = getCommentsService();
        const threads = await commentsService.getThreadedComments(id);

        res.json({ success: true, threads });
    } catch (error) {
        console.error('[ManagementReports] Get threaded comments error:', error);
        res.status(500).json({ error: error.message || 'Failed to get comments' });
    }
});

/**
 * GET /api/management-reports/:id/comments/count
 * Get comment counts for a report
 */
router.get('/:id/comments/count', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;

        const commentsService = getCommentsService();
        const counts = await commentsService.getCommentCount(id);

        res.json({ success: true, ...counts });
    } catch (error) {
        console.error('[ManagementReports] Get comment count error:', error);
        res.status(500).json({ error: error.message || 'Failed to get comment count' });
    }
});

/**
 * PATCH /api/management-reports/:id/comments/:commentId
 * Update or resolve a comment
 */
router.patch('/:id/comments/:commentId', authMiddleware, validate(updateCommentSchema), async (req, res) => {
    try {
        const { commentId } = req.params;
        const { content, isResolved } = req.body;
        const userId = req.user.id;

        const commentsService = getCommentsService();
        const comment = await commentsService.updateComment(commentId, userId, content, isResolved);

        res.json({ success: true, comment });
    } catch (error) {
        console.error('[ManagementReports] Update comment error:', error);
        res.status(500).json({ error: error.message || 'Failed to update comment' });
    }
});

/**
 * POST /api/management-reports/:id/comments/:commentId/resolve
 * Resolve a comment
 */
router.post('/:id/comments/:commentId/resolve', authMiddleware, async (req, res) => {
    try {
        const { commentId } = req.params;
        const userId = req.user.id;

        const commentsService = getCommentsService();
        const comment = await commentsService.resolveComment(commentId, userId);

        res.json({ success: true, comment });
    } catch (error) {
        console.error('[ManagementReports] Resolve comment error:', error);
        res.status(500).json({ error: error.message || 'Failed to resolve comment' });
    }
});

/**
 * POST /api/management-reports/:id/comments/:commentId/unresolve
 * Unresolve a comment
 */
router.post('/:id/comments/:commentId/unresolve', authMiddleware, async (req, res) => {
    try {
        const { commentId } = req.params;
        const userId = req.user.id;

        const commentsService = getCommentsService();
        const comment = await commentsService.unresolveComment(commentId, userId);

        res.json({ success: true, comment });
    } catch (error) {
        console.error('[ManagementReports] Unresolve comment error:', error);
        res.status(500).json({ error: error.message || 'Failed to unresolve comment' });
    }
});

/**
 * DELETE /api/management-reports/:id/comments/:commentId
 * Delete a comment
 */
router.delete('/:id/comments/:commentId', authMiddleware, async (req, res) => {
    try {
        const { commentId } = req.params;
        const userId = req.user.id;
        const isAdmin = ['ADMIN', 'SUPERADMIN', 'admin'].includes(req.user.role);

        const commentsService = getCommentsService();
        const result = await commentsService.deleteComment(commentId, userId, isAdmin);

        res.json({ success: true, ...result });
    } catch (error) {
        console.error('[ManagementReports] Delete comment error:', error);
        res.status(500).json({ error: error.message || 'Failed to delete comment' });
    }
});

module.exports = router;

