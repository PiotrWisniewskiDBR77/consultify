/**
 * Economics API Routes (Enterprise Edition)
 * 
 * RESTful API for digitization maturity analyses management.
 * Includes CRUD operations, import/export, versioning, evidence, and comparisons.
 * 
 * Security Features:
 * - JWT Authentication (authMiddleware)
 * - Role-Based Access Control (RBAC)
 * - Permission-Based Access Control (PBAC)
 * - Audit Logging (GovernanceAuditService)
 * - Input Validation (express-validator)
 * - Rate Limiting
 * 
 * PMO Standards Compliance:
 * - ISO 21500:2021 - Performance Monitoring
 * - PMI PMBOK 7 - Measurement Performance Domain
 * - PRINCE2 - Progress Theme
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');
const rateLimit = require('express-rate-limit');

// Services
const EconomicsService = require('../services/economicsService');
const ExcelImportService = require('../services/excelImportService');
const ExcelExportService = require('../services/excelExportService');
const PDFExportService = require('../services/pdfExportService');
const GovernanceAuditService = require('../services/governanceAuditService');
const VersioningService = require('../services/versioningService');
const EvidenceService = require('../services/evidenceService');

// Middleware
const authMiddleware = require('../middleware/authMiddleware');
const { requirePermission, auditAction } = require('../middleware/permissionMiddleware');
const {
    validateCreateAnalysis,
    validateUpdateAnalysis,
    validateAnalysisId,
    validateListQuery,
    validateBulkScores,
    validateSingleScore,
    validateCreateComparison,
    validateQuickCompare,
    validateExportRequest,
    validateCreateVersion,
    validateVersionId,
    validateAddEvidence
} = require('../middleware/economicsValidation');

// ============================================
// Rate Limiting
// ============================================

const economicsLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200, // 200 requests per window
    message: {
        error: 'Too many requests to Economics API',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: 15 * 60
    },
    standardHeaders: true,
    legacyHeaders: false
});

const exportLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 30, // 30 exports per hour
    message: {
        error: 'Export rate limit exceeded',
        code: 'EXPORT_RATE_LIMIT',
        retryAfter: 60 * 60
    }
});

const importLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 20, // 20 imports per hour
    message: {
        error: 'Import rate limit exceeded',
        code: 'IMPORT_RATE_LIMIT',
        retryAfter: 60 * 60
    }
});

// Apply authentication to all routes
router.use(authMiddleware);
router.use(economicsLimiter);

// ============================================
// File Upload Configuration
// ============================================

const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../../uploads/economics');
        try {
            await fs.mkdir(uploadDir, { recursive: true });
            cb(null, uploadDir);
        } catch (err) {
            cb(err);
        }
    },
    filename: (req, file, cb) => {
        const uniqueName = `${uuidv4()}_${file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
        const allowedTypes = [
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-excel'
        ];
        if (allowedTypes.includes(file.mimetype) || 
            file.originalname.endsWith('.xlsx') || 
            file.originalname.endsWith('.xls')) {
            cb(null, true);
        } else {
            cb(new Error('Only Excel files (.xlsx, .xls) are allowed'));
        }
    },
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    }
});

// ============================================
// Helper: Audit Logger
// ============================================

const logAudit = async (req, action, resourceType, resourceId, before = null, after = null) => {
    try {
        await GovernanceAuditService.logAudit({
            actorId: req.user?.id || req.userId,
            actorRole: req.user?.role || req.userRole,
            orgId: req.organizationId || req.user?.organizationId,
            action,
            resourceType,
            resourceId,
            before,
            after,
            correlationId: req.get('X-Correlation-Id') || `econ-${uuidv4()}`
        });
    } catch (err) {
        console.error('[Economics Audit] Failed to log audit:', err.message);
        // Don't fail the request if audit logging fails
    }
};

// ============================================
// Helper: Ensure Organization Context
// ============================================

const requireOrganization = (req, res, next) => {
    const orgId = req.organizationId || req.user?.organizationId || req.user?.organization_id;
    if (!orgId) {
        return res.status(400).json({
            error: 'Organization context required',
            code: 'ORG_CONTEXT_MISSING'
        });
    }
    req.organizationId = orgId;
    next();
};

// ============================================
// Analysis CRUD Endpoints
// ============================================

/**
 * GET /api/economics/analyses
 * List all analyses for organization
 */
router.get('/analyses',
    requireOrganization,
    validateListQuery,
    async (req, res) => {
        try {
            const filters = {
                status: req.query.status,
                projectId: req.query.projectId,
                search: req.query.search,
                sortBy: req.query.sortBy,
                sortOrder: req.query.sortOrder,
                page: parseInt(req.query.page) || 1,
                pageSize: parseInt(req.query.pageSize) || 20,
            };

            const result = await EconomicsService.getAnalyses(req.organizationId, filters);
            res.json(result);
        } catch (error) {
            console.error('[Economics API] List analyses error:', error);
            res.status(500).json({ error: 'Failed to retrieve analyses', code: 'LIST_FAILED' });
        }
    }
);

/**
 * POST /api/economics/analyses
 * Create new analysis
 */
router.post('/analyses',
    requireOrganization,
    validateCreateAnalysis,
    async (req, res) => {
        try {
            const { name, description, projectId, tags } = req.body;

            const analysis = await EconomicsService.createAnalysis(
                { name, description, projectId, tags },
                req.organizationId,
                req.user.id
            );

            // Audit log
            await logAudit(
                req,
                GovernanceAuditService.AUDIT_ACTIONS.CREATE,
                GovernanceAuditService.RESOURCE_TYPES.DIGITIZATION_ANALYSIS,
                analysis.id,
                null,
                analysis
            );

            res.status(201).json(analysis);
        } catch (error) {
            console.error('[Economics API] Create analysis error:', error);
            res.status(500).json({ error: 'Failed to create analysis', code: 'CREATE_FAILED' });
        }
    }
);

/**
 * GET /api/economics/analyses/:id
 * Get analysis by ID
 */
router.get('/analyses/:id',
    requireOrganization,
    validateAnalysisId,
    async (req, res) => {
        try {
            const analysis = await EconomicsService.getAnalysisById(
                req.params.id,
                req.organizationId
            );

            if (!analysis) {
                return res.status(404).json({ error: 'Analysis not found', code: 'NOT_FOUND' });
            }

            res.json(analysis);
        } catch (error) {
            console.error('[Economics API] Get analysis error:', error);
            res.status(500).json({ error: 'Failed to retrieve analysis', code: 'GET_FAILED' });
        }
    }
);

/**
 * PUT /api/economics/analyses/:id
 * Update analysis
 */
router.put('/analyses/:id',
    requireOrganization,
    validateUpdateAnalysis,
    async (req, res) => {
        try {
            const { name, description, status, projectId, tags } = req.body;

            // Get before state for audit
            const before = await EconomicsService.getAnalysisById(req.params.id, req.organizationId);
            if (!before) {
                return res.status(404).json({ error: 'Analysis not found', code: 'NOT_FOUND' });
            }

            const analysis = await EconomicsService.updateAnalysis(
                req.params.id,
                { name, description, status, projectId, tags },
                req.organizationId
            );

            // Audit log
            await logAudit(
                req,
                GovernanceAuditService.AUDIT_ACTIONS.UPDATE,
                GovernanceAuditService.RESOURCE_TYPES.DIGITIZATION_ANALYSIS,
                analysis.id,
                before,
                analysis
            );

            res.json(analysis);
        } catch (error) {
            console.error('[Economics API] Update analysis error:', error);
            if (error.message === 'Analysis not found') {
                return res.status(404).json({ error: error.message, code: 'NOT_FOUND' });
            }
            res.status(500).json({ error: 'Failed to update analysis', code: 'UPDATE_FAILED' });
        }
    }
);

/**
 * DELETE /api/economics/analyses/:id
 * Delete analysis
 */
router.delete('/analyses/:id',
    requireOrganization,
    validateAnalysisId,
    async (req, res) => {
        try {
            // Get before state for audit
            const before = await EconomicsService.getAnalysisById(req.params.id, req.organizationId);
            if (!before) {
                return res.status(404).json({ error: 'Analysis not found', code: 'NOT_FOUND' });
            }

            const success = await EconomicsService.deleteAnalysis(
                req.params.id,
                req.organizationId
            );

            if (!success) {
                return res.status(404).json({ error: 'Analysis not found', code: 'NOT_FOUND' });
            }

            // Audit log
            await logAudit(
                req,
                GovernanceAuditService.AUDIT_ACTIONS.DELETE,
                GovernanceAuditService.RESOURCE_TYPES.DIGITIZATION_ANALYSIS,
                req.params.id,
                before,
                null
            );

            res.json({ success: true, message: 'Analysis deleted' });
        } catch (error) {
            console.error('[Economics API] Delete analysis error:', error);
            res.status(500).json({ error: 'Failed to delete analysis', code: 'DELETE_FAILED' });
        }
    }
);

/**
 * POST /api/economics/analyses/:id/duplicate
 * Duplicate analysis
 */
router.post('/analyses/:id/duplicate',
    requireOrganization,
    validateAnalysisId,
    async (req, res) => {
        try {
            const { name } = req.body;

            const analysis = await EconomicsService.duplicateAnalysis(
                req.params.id,
                name,
                req.organizationId,
                req.user.id
            );

            // Audit log
            await logAudit(
                req,
                GovernanceAuditService.AUDIT_ACTIONS.CREATE,
                GovernanceAuditService.RESOURCE_TYPES.DIGITIZATION_ANALYSIS,
                analysis.id,
                null,
                { ...analysis, duplicatedFrom: req.params.id }
            );

            res.status(201).json(analysis);
        } catch (error) {
            console.error('[Economics API] Duplicate analysis error:', error);
            if (error.message === 'Original analysis not found') {
                return res.status(404).json({ error: error.message, code: 'NOT_FOUND' });
            }
            res.status(500).json({ error: 'Failed to duplicate analysis', code: 'DUPLICATE_FAILED' });
        }
    }
);

// ============================================
// Score Management Endpoints
// ============================================

/**
 * PUT /api/economics/analyses/:id/scores
 * Update scores for analysis (bulk)
 */
router.put('/analyses/:id/scores',
    requireOrganization,
    validateBulkScores,
    async (req, res) => {
        try {
            const { scores } = req.body;

            // Get before state for audit
            const before = await EconomicsService.getAnalysisById(req.params.id, req.organizationId);
            if (!before) {
                return res.status(404).json({ error: 'Analysis not found', code: 'NOT_FOUND' });
            }

            const analysis = await EconomicsService.bulkUpdateScores(
                req.params.id,
                scores,
                req.organizationId,
                req.user.id
            );

            // Audit log
            await logAudit(
                req,
                GovernanceAuditService.AUDIT_ACTIONS.UPDATE,
                GovernanceAuditService.RESOURCE_TYPES.DIGITIZATION_SCORE,
                req.params.id,
                { scoresCount: before.detailedScores?.length || 0 },
                { scoresCount: scores.length, updatedScores: scores.map(s => `${s.axisId}:${s.areaId}`) }
            );

            res.json(analysis);
        } catch (error) {
            console.error('[Economics API] Update scores error:', error);
            res.status(500).json({ error: 'Failed to update scores', code: 'SCORES_UPDATE_FAILED' });
        }
    }
);

/**
 * PUT /api/economics/analyses/:id/score
 * Update single score
 */
router.put('/analyses/:id/score',
    requireOrganization,
    validateSingleScore,
    async (req, res) => {
        try {
            const { axisId, areaId, areaCode, currentLevel, targetLevel, notes, evidence, justification } = req.body;

            await EconomicsService.updateAxisScore(
                req.params.id,
                { axisId, areaId, areaCode, currentLevel, targetLevel, notes, evidence, justification },
                req.user.id
            );

            // Recalculate and return updated analysis
            await EconomicsService.recalculateScores(req.params.id, req.organizationId);
            const analysis = await EconomicsService.getAnalysisById(req.params.id, req.organizationId);

            // Audit log
            await logAudit(
                req,
                GovernanceAuditService.AUDIT_ACTIONS.UPDATE,
                GovernanceAuditService.RESOURCE_TYPES.DIGITIZATION_SCORE,
                `${req.params.id}:${axisId}:${areaId}`,
                null,
                { axisId, areaId, currentLevel, targetLevel }
            );

            res.json(analysis);
        } catch (error) {
            console.error('[Economics API] Update score error:', error);
            res.status(500).json({ error: 'Failed to update score', code: 'SCORE_UPDATE_FAILED' });
        }
    }
);

// ============================================
// Import/Export Endpoints
// ============================================

/**
 * POST /api/economics/import
 * Import analysis from Excel file
 */
router.post('/import',
    requireOrganization,
    importLimiter,
    upload.single('file'),
    async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({ error: 'Excel file is required', code: 'FILE_REQUIRED' });
            }

            const { analysisName } = req.body;
            
            const result = await ExcelImportService.importExcel(
                req.file.path,
                {
                    organizationId: req.organizationId,
                    userId: req.user.id,
                    analysisName: analysisName || null,
                },
                { EconomicsService }
            );

            // Clean up uploaded file
            try {
                await fs.unlink(req.file.path);
            } catch (e) {
                console.warn('[Economics API] Failed to clean up temp file:', e.message);
            }

            if (!result.success) {
                return res.status(400).json(result);
            }

            // Audit log
            await logAudit(
                req,
                GovernanceAuditService.AUDIT_ACTIONS.CREATE,
                GovernanceAuditService.RESOURCE_TYPES.DIGITIZATION_ANALYSIS,
                result.analysisId,
                null,
                { importedFrom: req.file.originalname, stats: result.stats }
            );

            res.status(201).json(result);
        } catch (error) {
            console.error('[Economics API] Import error:', error);
            res.status(500).json({ error: 'Failed to import Excel file', code: 'IMPORT_FAILED' });
        }
    }
);

/**
 * GET /api/economics/analyses/:id/export
 * Export analysis to Excel
 */
router.get('/analyses/:id/export',
    requireOrganization,
    exportLimiter,
    validateExportRequest,
    async (req, res) => {
        try {
            const analysis = await EconomicsService.getAnalysisById(
                req.params.id,
                req.organizationId
            );

            if (!analysis) {
                return res.status(404).json({ error: 'Analysis not found', code: 'NOT_FOUND' });
            }

            const options = {
                includeRecommendations: req.query.recommendations !== 'false',
                includeRawData: req.query.rawData !== 'false',
                language: req.query.language || 'pl',
            };

            const filePath = await ExcelExportService.exportDigitizationAnalysis(analysis, options);

            // Record export for audit
            await EconomicsService.recordExport(
                analysis.id,
                'excel',
                path.basename(filePath),
                filePath,
                req.user.id
            );

            // Audit log
            await logAudit(
                req,
                GovernanceAuditService.AUDIT_ACTIONS.PUBLISH,
                GovernanceAuditService.RESOURCE_TYPES.DIGITIZATION_EXPORT,
                analysis.id,
                null,
                { format: 'excel', filename: path.basename(filePath), options }
            );

            res.json({ 
                success: true, 
                downloadUrl: filePath,
                filename: path.basename(filePath)
            });
        } catch (error) {
            console.error('[Economics API] Export error:', error);
            res.status(500).json({ error: 'Failed to export analysis', code: 'EXPORT_FAILED' });
        }
    }
);

/**
 * GET /api/economics/analyses/:id/export/pdf
 * Export analysis to PDF
 */
router.get('/analyses/:id/export/pdf',
    requireOrganization,
    exportLimiter,
    validateExportRequest,
    async (req, res) => {
        try {
            const analysis = await EconomicsService.getAnalysisById(
                req.params.id,
                req.organizationId
            );

            if (!analysis) {
                return res.status(404).json({ error: 'Analysis not found', code: 'NOT_FOUND' });
            }

            const options = {
                template: req.query.template || 'executive',
                language: req.query.language || 'pl',
                includeLogo: req.query.logo !== 'false',
                includeRecommendations: req.query.recommendations !== 'false',
                branding: {}
            };

            const filePath = await PDFExportService.exportAnalysisToPDF(analysis, options);

            // Record export for audit
            await EconomicsService.recordExport(
                analysis.id,
                'pdf',
                path.basename(filePath),
                filePath,
                req.user.id
            );

            // Audit log
            await logAudit(
                req,
                GovernanceAuditService.AUDIT_ACTIONS.PUBLISH,
                GovernanceAuditService.RESOURCE_TYPES.DIGITIZATION_EXPORT,
                analysis.id,
                null,
                { format: 'pdf', template: options.template, filename: path.basename(filePath) }
            );

            res.json({ 
                success: true, 
                downloadUrl: filePath,
                filename: path.basename(filePath)
            });
        } catch (error) {
            console.error('[Economics API] PDF Export error:', error);
            res.status(500).json({ error: 'Failed to export analysis to PDF', code: 'PDF_EXPORT_FAILED' });
        }
    }
);

// ============================================
// Statistics & Comparisons
// ============================================

/**
 * GET /api/economics/stats
 * Get catalog statistics
 */
router.get('/stats',
    requireOrganization,
    async (req, res) => {
        try {
            const stats = await EconomicsService.getCatalogStats(req.organizationId);
            res.json(stats);
        } catch (error) {
            console.error('[Economics API] Stats error:', error);
            res.status(500).json({ error: 'Failed to retrieve statistics', code: 'STATS_FAILED' });
        }
    }
);

/**
 * POST /api/economics/comparisons
 * Create comparison
 */
router.post('/comparisons',
    requireOrganization,
    validateCreateComparison,
    async (req, res) => {
        try {
            const { name, description, analysisIds, comparisonType } = req.body;

            const comparison = await EconomicsService.createComparison(
                { name, description, analysisIds, comparisonType },
                req.organizationId,
                req.user.id
            );

            // Audit log
            await logAudit(
                req,
                GovernanceAuditService.AUDIT_ACTIONS.CREATE,
                GovernanceAuditService.RESOURCE_TYPES.DIGITIZATION_COMPARISON,
                comparison.id,
                null,
                { analysisIds, comparisonType }
            );

            res.status(201).json(comparison);
        } catch (error) {
            console.error('[Economics API] Create comparison error:', error);
            res.status(500).json({ error: 'Failed to create comparison', code: 'COMPARISON_CREATE_FAILED' });
        }
    }
);

/**
 * GET /api/economics/comparisons/:id
 * Get comparison with full data
 */
router.get('/comparisons/:id',
    requireOrganization,
    async (req, res) => {
        try {
            const comparison = await EconomicsService.getComparison(
                req.params.id,
                req.organizationId
            );

            if (!comparison) {
                return res.status(404).json({ error: 'Comparison not found', code: 'NOT_FOUND' });
            }

            res.json(comparison);
        } catch (error) {
            console.error('[Economics API] Get comparison error:', error);
            res.status(500).json({ error: 'Failed to retrieve comparison', code: 'COMPARISON_GET_FAILED' });
        }
    }
);

/**
 * POST /api/economics/compare
 * Quick compare without saving
 */
router.post('/compare',
    requireOrganization,
    validateQuickCompare,
    async (req, res) => {
        try {
            const { analysisIds } = req.body;

            const analyses = [];
            for (const id of analysisIds) {
                const analysis = await EconomicsService.getAnalysisById(id, req.organizationId);
                if (analysis) analyses.push(analysis);
            }

            if (analyses.length < 2) {
                return res.status(400).json({ 
                    error: 'Not enough valid analyses found', 
                    code: 'INSUFFICIENT_ANALYSES' 
                });
            }

            res.json({ analyses });
        } catch (error) {
            console.error('[Economics API] Compare error:', error);
            res.status(500).json({ error: 'Failed to compare analyses', code: 'COMPARE_FAILED' });
        }
    }
);

// ============================================
// Versioning Endpoints
// ============================================

/**
 * POST /api/economics/analyses/:id/versions
 * Create a new version snapshot
 */
router.post('/analyses/:id/versions',
    requireOrganization,
    validateCreateVersion,
    async (req, res) => {
        try {
            const { versionName, versionType, notes } = req.body;

            // Verify analysis exists and belongs to org
            const analysis = await EconomicsService.getAnalysisById(req.params.id, req.organizationId);
            if (!analysis) {
                return res.status(404).json({ error: 'Analysis not found', code: 'NOT_FOUND' });
            }

            const version = await VersioningService.createVersion(
                req.params.id,
                { versionName, versionType, notes },
                req.user.id
            );

            // Audit log
            await logAudit(
                req,
                GovernanceAuditService.AUDIT_ACTIONS.CREATE,
                GovernanceAuditService.RESOURCE_TYPES.DIGITIZATION_VERSION,
                version.id,
                null,
                { analysisId: req.params.id, versionNumber: version.version_number, versionType }
            );

            res.status(201).json(version);
        } catch (error) {
            console.error('[Economics API] Create version error:', error);
            res.status(500).json({ error: 'Failed to create version', code: 'VERSION_CREATE_FAILED' });
        }
    }
);

/**
 * GET /api/economics/analyses/:id/versions
 * List all versions for an analysis
 */
router.get('/analyses/:id/versions',
    requireOrganization,
    validateAnalysisId,
    async (req, res) => {
        try {
            const versions = await VersioningService.getVersions(req.params.id, {
                limit: parseInt(req.query.limit) || 50,
                offset: parseInt(req.query.offset) || 0
            });

            res.json({ versions });
        } catch (error) {
            console.error('[Economics API] List versions error:', error);
            res.status(500).json({ error: 'Failed to retrieve versions', code: 'VERSIONS_LIST_FAILED' });
        }
    }
);

/**
 * GET /api/economics/analyses/:id/versions/:versionId
 * Get a specific version
 */
router.get('/analyses/:id/versions/:versionId',
    requireOrganization,
    validateVersionId,
    async (req, res) => {
        try {
            const version = await VersioningService.getVersion(req.params.versionId);

            if (!version || version.analysis_id !== req.params.id) {
                return res.status(404).json({ error: 'Version not found', code: 'NOT_FOUND' });
            }

            res.json(version);
        } catch (error) {
            console.error('[Economics API] Get version error:', error);
            res.status(500).json({ error: 'Failed to retrieve version', code: 'VERSION_GET_FAILED' });
        }
    }
);

/**
 * POST /api/economics/analyses/:id/versions/:versionId/restore
 * Restore analysis to a specific version
 */
router.post('/analyses/:id/versions/:versionId/restore',
    requireOrganization,
    validateVersionId,
    async (req, res) => {
        try {
            const version = await VersioningService.getVersion(req.params.versionId);

            if (!version || version.analysis_id !== req.params.id) {
                return res.status(404).json({ error: 'Version not found', code: 'NOT_FOUND' });
            }

            const restoredVersion = await VersioningService.restoreVersion(
                req.params.versionId,
                req.user.id,
                EconomicsService
            );

            // Audit log
            await logAudit(
                req,
                GovernanceAuditService.AUDIT_ACTIONS.UPDATE,
                GovernanceAuditService.RESOURCE_TYPES.DIGITIZATION_ANALYSIS,
                req.params.id,
                { restoredFromVersion: version.version_number },
                { newVersion: restoredVersion.version_number }
            );

            res.json({ 
                success: true, 
                message: `Restored to version ${version.version_number}`,
                newVersion: restoredVersion
            });
        } catch (error) {
            console.error('[Economics API] Restore version error:', error);
            res.status(500).json({ error: 'Failed to restore version', code: 'VERSION_RESTORE_FAILED' });
        }
    }
);

/**
 * GET /api/economics/analyses/:id/versions/compare
 * Compare two versions
 */
router.get('/analyses/:id/versions/compare',
    requireOrganization,
    async (req, res) => {
        try {
            const { v1, v2 } = req.query;

            if (!v1 || !v2) {
                return res.status(400).json({ 
                    error: 'Both version IDs (v1 and v2) are required', 
                    code: 'MISSING_VERSIONS' 
                });
            }

            const comparison = await VersioningService.compareVersions(v1, v2);

            res.json(comparison);
        } catch (error) {
            console.error('[Economics API] Compare versions error:', error);
            if (error.message.includes('not found')) {
                return res.status(404).json({ error: error.message, code: 'NOT_FOUND' });
            }
            res.status(500).json({ error: 'Failed to compare versions', code: 'VERSION_COMPARE_FAILED' });
        }
    }
);

/**
 * POST /api/economics/analyses/:id/versions/:versionId/baseline
 * Mark version as baseline
 */
router.post('/analyses/:id/versions/:versionId/baseline',
    requireOrganization,
    validateVersionId,
    async (req, res) => {
        try {
            const version = await VersioningService.markAsBaseline(req.params.versionId);

            // Audit log
            await logAudit(
                req,
                GovernanceAuditService.AUDIT_ACTIONS.UPDATE,
                GovernanceAuditService.RESOURCE_TYPES.DIGITIZATION_VERSION,
                req.params.versionId,
                { versionType: 'snapshot' },
                { versionType: 'baseline' }
            );

            res.json(version);
        } catch (error) {
            console.error('[Economics API] Mark baseline error:', error);
            res.status(500).json({ error: 'Failed to mark as baseline', code: 'BASELINE_FAILED' });
        }
    }
);

// ============================================
// Evidence Endpoints
// ============================================

/**
 * POST /api/economics/scores/:scoreId/evidence
 * Add evidence to a score
 */
router.post('/scores/:scoreId/evidence',
    requireOrganization,
    validateAddEvidence,
    async (req, res) => {
        try {
            const { evidenceType, title, content, category } = req.body;

            const evidence = await EvidenceService.addEvidence(
                req.params.scoreId,
                { evidenceType, title, content, category },
                req.user.id
            );

            // Audit log
            await logAudit(
                req,
                GovernanceAuditService.AUDIT_ACTIONS.CREATE,
                GovernanceAuditService.RESOURCE_TYPES.DIGITIZATION_EVIDENCE,
                evidence.id,
                null,
                { scoreId: req.params.scoreId, evidenceType, title }
            );

            res.status(201).json(evidence);
        } catch (error) {
            console.error('[Economics API] Add evidence error:', error);
            res.status(500).json({ error: 'Failed to add evidence', code: 'EVIDENCE_ADD_FAILED' });
        }
    }
);

/**
 * POST /api/economics/scores/:scoreId/evidence/upload
 * Upload file as evidence
 */
router.post('/scores/:scoreId/evidence/upload',
    requireOrganization,
    upload.single('file'),
    async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({ error: 'File is required', code: 'FILE_REQUIRED' });
            }

            const metadata = {
                title: req.body.title || req.file.originalname,
                description: req.body.description,
                category: req.body.category
            };

            const evidence = await EvidenceService.uploadEvidenceFile(
                req.params.scoreId,
                req.file,
                metadata,
                req.user.id
            );

            // Audit log
            await logAudit(
                req,
                GovernanceAuditService.AUDIT_ACTIONS.CREATE,
                GovernanceAuditService.RESOURCE_TYPES.DIGITIZATION_EVIDENCE,
                evidence.id,
                null,
                { scoreId: req.params.scoreId, filename: req.file.originalname, size: req.file.size }
            );

            res.status(201).json(evidence);
        } catch (error) {
            console.error('[Economics API] Upload evidence error:', error);
            // Clean up file on error
            if (req.file?.path) {
                try { await fs.unlink(req.file.path); } catch (e) {}
            }
            res.status(500).json({ error: error.message || 'Failed to upload evidence', code: 'EVIDENCE_UPLOAD_FAILED' });
        }
    }
);

/**
 * GET /api/economics/scores/:scoreId/evidence
 * Get all evidence for a score
 */
router.get('/scores/:scoreId/evidence',
    requireOrganization,
    async (req, res) => {
        try {
            const evidence = await EvidenceService.getEvidenceForScore(req.params.scoreId, {
                category: req.query.category,
                verified: req.query.verified === 'true' ? true : req.query.verified === 'false' ? false : undefined
            });

            res.json({ evidence });
        } catch (error) {
            console.error('[Economics API] Get evidence error:', error);
            res.status(500).json({ error: 'Failed to retrieve evidence', code: 'EVIDENCE_GET_FAILED' });
        }
    }
);

/**
 * GET /api/economics/analyses/:id/evidence
 * Get all evidence for an analysis
 */
router.get('/analyses/:id/evidence',
    requireOrganization,
    validateAnalysisId,
    async (req, res) => {
        try {
            const [evidence, stats, counts] = await Promise.all([
                EvidenceService.getEvidenceForAnalysis(req.params.id),
                EvidenceService.getVerificationStats(req.params.id),
                EvidenceService.getEvidenceCountsForAnalysis(req.params.id)
            ]);

            res.json({ evidence, stats, counts });
        } catch (error) {
            console.error('[Economics API] Get analysis evidence error:', error);
            res.status(500).json({ error: 'Failed to retrieve evidence', code: 'EVIDENCE_GET_FAILED' });
        }
    }
);

/**
 * PUT /api/economics/evidence/:id
 * Update evidence metadata
 */
router.put('/evidence/:id',
    requireOrganization,
    async (req, res) => {
        try {
            const { title, content, category } = req.body;

            const evidence = await EvidenceService.updateEvidence(req.params.id, {
                title, content, category
            });

            if (!evidence) {
                return res.status(404).json({ error: 'Evidence not found', code: 'NOT_FOUND' });
            }

            res.json(evidence);
        } catch (error) {
            console.error('[Economics API] Update evidence error:', error);
            res.status(500).json({ error: 'Failed to update evidence', code: 'EVIDENCE_UPDATE_FAILED' });
        }
    }
);

/**
 * DELETE /api/economics/evidence/:id
 * Delete evidence
 */
router.delete('/evidence/:id',
    requireOrganization,
    async (req, res) => {
        try {
            const evidence = await EvidenceService.getEvidence(req.params.id);
            
            if (!evidence) {
                return res.status(404).json({ error: 'Evidence not found', code: 'NOT_FOUND' });
            }

            await EvidenceService.deleteEvidence(req.params.id);

            // Audit log
            await logAudit(
                req,
                GovernanceAuditService.AUDIT_ACTIONS.DELETE,
                GovernanceAuditService.RESOURCE_TYPES.DIGITIZATION_EVIDENCE,
                req.params.id,
                evidence,
                null
            );

            res.json({ success: true, message: 'Evidence deleted' });
        } catch (error) {
            console.error('[Economics API] Delete evidence error:', error);
            res.status(500).json({ error: 'Failed to delete evidence', code: 'EVIDENCE_DELETE_FAILED' });
        }
    }
);

/**
 * POST /api/economics/evidence/:id/verify
 * Mark evidence as verified
 */
router.post('/evidence/:id/verify',
    requireOrganization,
    async (req, res) => {
        try {
            const evidence = await EvidenceService.verifyEvidence(req.params.id, req.user.id);

            if (!evidence) {
                return res.status(404).json({ error: 'Evidence not found', code: 'NOT_FOUND' });
            }

            // Audit log
            await logAudit(
                req,
                GovernanceAuditService.AUDIT_ACTIONS.UPDATE,
                GovernanceAuditService.RESOURCE_TYPES.DIGITIZATION_EVIDENCE,
                req.params.id,
                { is_verified: false },
                { is_verified: true, verified_by: req.user.id }
            );

            res.json(evidence);
        } catch (error) {
            console.error('[Economics API] Verify evidence error:', error);
            res.status(500).json({ error: 'Failed to verify evidence', code: 'EVIDENCE_VERIFY_FAILED' });
        }
    }
);

/**
 * GET /api/economics/evidence/categories
 * Get available evidence categories
 */
router.get('/evidence/categories',
    async (req, res) => {
        res.json({ categories: EvidenceService.getCategories() });
    }
);

// ============================================
// Error Handler
// ============================================

router.use((err, req, res, next) => {
    console.error('[Economics API] Unhandled error:', err);
    
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ 
                error: 'File too large. Maximum size is 10MB.', 
                code: 'FILE_TOO_LARGE' 
            });
        }
        return res.status(400).json({ 
            error: err.message, 
            code: 'UPLOAD_ERROR' 
        });
    }
    
    res.status(500).json({ 
        error: 'Internal server error', 
        code: 'INTERNAL_ERROR' 
    });
});

module.exports = router;
