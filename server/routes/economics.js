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

import express from 'express';
const router = express.Router();
import multer from 'multer';
import path from 'path';
import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { v4 as uuidv4 } from 'uuid';
import rateLimit from 'express-rate-limit';

// Services
import * as EconomicsServiceModule from '../services/economicsService.js';
const EconomicsService = EconomicsServiceModule.default || EconomicsServiceModule;
import * as ExcelImportServiceModule from '../services/excelImportService.js';
const ExcelImportService = ExcelImportServiceModule.default || ExcelImportServiceModule;
import * as ExcelExportServiceModule from '../services/excelExportService.js';
const ExcelExportService = ExcelExportServiceModule.default || ExcelExportServiceModule;
import * as PDFExportServiceModule from '../services/pdfExportService.js';
const PDFExportService = PDFExportServiceModule.default || PDFExportServiceModule;
import * as GovernanceAuditServiceModule from '../services/governanceAuditService.js';
const GovernanceAuditService = GovernanceAuditServiceModule.default || GovernanceAuditServiceModule;
import * as VersioningServiceModule from '../services/versioningService.js';
const VersioningService = VersioningServiceModule.default || VersioningServiceModule;
import * as EvidenceServiceModule from '../services/evidenceService.js';
const EvidenceService = EvidenceServiceModule.default || EvidenceServiceModule;

// Middleware
import authMiddleware from '../middleware/authMiddleware.js';
import { requirePermission, auditAction } from '../middleware/permissionMiddleware.js';
import {
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
} from '../middleware/economicsValidation.js';

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
                try { await fs.unlink(req.file.path); } catch (e) { }
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
// Initiative Integration Endpoints
// ============================================

/**
 * POST /api/economics/analyses/:id/link-initiative
 * Link analysis to an initiative
 */
router.post('/analyses/:id/link-initiative',
    requireOrganization,
    validateAnalysisId,
    async (req, res) => {
        try {
            const { initiativeId } = req.body;

            if (!initiativeId) {
                return res.status(400).json({
                    error: 'Initiative ID is required',
                    code: 'INITIATIVE_REQUIRED'
                });
            }

            const analysis = await EconomicsService.linkAnalysisToInitiative(
                req.params.id,
                initiativeId,
                req.organizationId
            );

            if (!analysis) {
                return res.status(404).json({ error: 'Analysis not found', code: 'NOT_FOUND' });
            }

            // Audit log
            await logAudit(
                req,
                GovernanceAuditService.AUDIT_ACTIONS.UPDATE,
                GovernanceAuditService.RESOURCE_TYPES.DIGITIZATION_ANALYSIS,
                req.params.id,
                { initiative_id: null },
                { initiative_id: initiativeId }
            );

            res.json(analysis);
        } catch (error) {
            console.error('[Economics API] Link initiative error:', error);
            res.status(500).json({ error: 'Failed to link initiative', code: 'LINK_FAILED' });
        }
    }
);

/**
 * DELETE /api/economics/analyses/:id/link-initiative
 * Unlink analysis from initiative
 */
router.delete('/analyses/:id/link-initiative',
    requireOrganization,
    validateAnalysisId,
    async (req, res) => {
        try {
            const before = await EconomicsService.getAnalysisById(req.params.id, req.organizationId);

            const analysis = await EconomicsService.unlinkFromInitiative(
                req.params.id,
                req.organizationId
            );

            if (!analysis) {
                return res.status(404).json({ error: 'Analysis not found', code: 'NOT_FOUND' });
            }

            // Audit log
            await logAudit(
                req,
                GovernanceAuditService.AUDIT_ACTIONS.UPDATE,
                GovernanceAuditService.RESOURCE_TYPES.DIGITIZATION_ANALYSIS,
                req.params.id,
                { initiative_id: before?.initiative_id },
                { initiative_id: null }
            );

            res.json(analysis);
        } catch (error) {
            console.error('[Economics API] Unlink initiative error:', error);
            res.status(500).json({ error: 'Failed to unlink initiative', code: 'UNLINK_FAILED' });
        }
    }
);

// ============================================
// Financial Analysis Endpoints (Analysis-based)
// ============================================

/**
 * GET /api/economics/analyses/:id/financials
 * Get financial data for an analysis
 */
router.get('/analyses/:id/financials',
    requireOrganization,
    validateAnalysisId,
    async (req, res) => {
        try {
            const financials = await EconomicsService.getAnalysisFinancials(
                req.params.id,
                req.organizationId
            );

            if (!financials) {
                // Return empty structure if no financials exist yet
                return res.json({
                    analysisId: req.params.id,
                    costs: [],
                    benefits: [],
                    discountRate: 10,
                    investmentHorizon: 5
                });
            }

            res.json(financials);
        } catch (error) {
            console.error('[Economics API] Get analysis financials error:', error);
            res.status(500).json({ error: 'Failed to retrieve financial data', code: 'GET_FAILED' });
        }
    }
);

/**
 * PUT /api/economics/analyses/:id/financials
 * Update financial data for an analysis
 */
router.put('/analyses/:id/financials',
    requireOrganization,
    validateAnalysisId,
    async (req, res) => {
        try {
            const financials = await EconomicsService.updateAnalysisFinancials(
                req.params.id,
                {
                    costs: req.body.costs,
                    benefits: req.body.benefits,
                    discountRate: req.body.discountRate,
                    investmentHorizon: req.body.investmentHorizon
                },
                req.organizationId,
                req.user.id
            );

            // Audit log
            await logAudit(
                req,
                GovernanceAuditService.AUDIT_ACTIONS.UPDATE,
                'ANALYSIS_FINANCIALS',
                req.params.id,
                null,
                financials
            );

            res.json(financials);
        } catch (error) {
            console.error('[Economics API] Update analysis financials error:', error);
            res.status(500).json({ error: 'Failed to update financial data', code: 'UPDATE_FAILED' });
        }
    }
);

/**
 * POST /api/economics/analyses/:id/calculate-metrics
 * Calculate financial metrics (NPV, IRR, Payback, ROI)
 */
router.post('/analyses/:id/calculate-metrics',
    requireOrganization,
    validateAnalysisId,
    async (req, res) => {
        try {
            const FinancialCalcModule = await import('../services/financialCalculatorService.js');
            const FinancialCalc = FinancialCalcModule.default || FinancialCalcModule;

            // Get financial data for the analysis
            const financials = await EconomicsService.getAnalysisFinancials(
                req.params.id,
                req.organizationId
            );

            if (!financials || (!financials.costs?.length && !financials.benefits?.length)) {
                return res.status(400).json({
                    error: 'No financial data available for calculation',
                    code: 'NO_FINANCIAL_DATA'
                });
            }

            const discountRate = (financials.discountRate || 10) / 100;
            const horizon = financials.investmentHorizon || 5;

            // Build cash flows from costs and benefits
            const cashFlows = [];

            // Year 0: Initial costs
            const initialCosts = financials.costs
                .filter(c => c.year === 0)
                .reduce((sum, c) => sum + (c.amount || 0), 0);

            if (initialCosts > 0) {
                cashFlows.push({ year: 0, amount: -initialCosts });
            }

            // Years 1+: Net of benefits minus operating costs
            for (let year = 1; year <= horizon; year++) {
                const yearBenefits = financials.benefits
                    .filter(b => b.year === year || b.year === 1) // Annual benefits
                    .reduce((sum, b) => sum + (b.amount || 0), 0);

                const yearCosts = financials.costs
                    .filter(c => c.year === year || c.year === 1) // Annual costs
                    .reduce((sum, c) => sum + (c.amount || 0), 0);

                cashFlows.push({ year, amount: yearBenefits - yearCosts });
            }

            // Calculate metrics
            const npv = FinancialCalc.calculateNPV(cashFlows, discountRate);
            const irr = FinancialCalc.calculateIRR(cashFlows);
            const paybackPeriod = FinancialCalc.calculatePaybackPeriod(cashFlows);

            const totalBenefits = financials.benefits.reduce((sum, b) => sum + (b.amount || 0) * horizon, 0);
            const totalCosts = financials.costs.reduce((sum, c) => sum + (c.amount || 0), 0) +
                financials.costs.filter(c => c.year >= 1).reduce((sum, c) => sum + (c.amount || 0) * horizon, 0);
            const roi = FinancialCalc.calculateROI(totalBenefits, totalCosts);

            // Build cumulative cash flow for chart
            let cumulative = 0;
            const cashFlowsWithCumulative = cashFlows.map(cf => {
                cumulative += cf.amount;
                return {
                    ...cf,
                    costs: cf.amount < 0 ? Math.abs(cf.amount) : 0,
                    benefits: cf.amount > 0 ? cf.amount : 0,
                    netCashFlow: cf.amount,
                    cumulativeCashFlow: cumulative
                };
            });

            res.json({
                npv,
                irr,
                paybackPeriod,
                roi,
                totalCosts,
                totalBenefits,
                netBenefit: totalBenefits - totalCosts,
                cashFlows: cashFlowsWithCumulative,
                discountRate: financials.discountRate,
                horizon,
                calculatedAt: new Date().toISOString()
            });
        } catch (error) {
            console.error('[Economics API] Calculate metrics error:', error);
            res.status(500).json({ error: 'Failed to calculate financial metrics', code: 'CALC_FAILED' });
        }
    }
);

/**
 * GET /api/economics/analyses/:id/benefits
 * Get benefit tracking data for an analysis
 */
router.get('/analyses/:id/benefits',
    requireOrganization,
    validateAnalysisId,
    async (req, res) => {
        try {
            const benefits = await EconomicsService.getAnalysisBenefits(
                req.params.id,
                req.organizationId
            );
            res.json({ benefits });
        } catch (error) {
            console.error('[Economics API] Get benefits error:', error);
            res.status(500).json({ error: 'Failed to retrieve benefits', code: 'GET_FAILED' });
        }
    }
);

/**
 * PUT /api/economics/analyses/:id/benefits
 * Update benefit tracking data for an analysis
 */
router.put('/analyses/:id/benefits',
    requireOrganization,
    validateAnalysisId,
    async (req, res) => {
        try {
            const benefits = await EconomicsService.updateAnalysisBenefits(
                req.params.id,
                {
                    trackingPeriod: req.body.trackingPeriod,
                    plannedBenefits: req.body.plannedBenefits,
                    actualBenefits: req.body.actualBenefits
                },
                req.organizationId,
                req.user.id
            );
            res.json({ benefits });
        } catch (error) {
            console.error('[Economics API] Update benefits error:', error);
            res.status(500).json({ error: 'Failed to update benefits', code: 'UPDATE_FAILED' });
        }
    }
);

/**
 * GET /api/economics/analyses/:id/quality-assessment
 * Get quality assessment for an analysis
 */
router.get('/analyses/:id/quality-assessment',
    requireOrganization,
    validateAnalysisId,
    async (req, res) => {
        try {
            const assessment = await EconomicsService.getAnalysisQualityAssessment(
                req.params.id,
                req.organizationId
            );
            res.json(assessment);
        } catch (error) {
            console.error('[Economics API] Get quality assessment error:', error);
            res.status(500).json({ error: 'Failed to retrieve quality assessment', code: 'GET_FAILED' });
        }
    }
);

/**
 * POST /api/economics/analyses/:id/business-case
 * Generate business case document
 */
router.post('/analyses/:id/business-case',
    requireOrganization,
    validateAnalysisId,
    async (req, res) => {
        try {
            const analysis = await EconomicsService.getAnalysisById(req.params.id, req.organizationId);
            if (!analysis) {
                return res.status(404).json({ error: 'Analysis not found', code: 'NOT_FOUND' });
            }

            const options = {
                format: req.body.format || 'pdf',
                language: req.body.language || 'pl',
                includeExecutiveSummary: req.body.includeExecutiveSummary !== false,
                includeFinancialAnalysis: req.body.includeFinancialAnalysis !== false,
                includeRiskAssessment: req.body.includeRiskAssessment !== false
            };

            // For now, redirect to PDF export with business case template
            const timestamp = Date.now();
            const filename = `business_case_${analysis.name.replace(/[^a-z0-9]/gi, '_')}_${timestamp}.${options.format}`;

            // Use PDFExportService for business case generation
            const result = await PDFExportService.exportBusinessCase(
                analysis,
                options,
                req.user.id
            );

            res.json({
                downloadUrl: result.downloadUrl || `/api/economics/exports/${result.id}/download`,
                filename: result.filename || filename,
                format: options.format
            });
        } catch (error) {
            console.error('[Economics API] Generate business case error:', error);
            res.status(500).json({ error: 'Failed to generate business case', code: 'GENERATE_FAILED' });
        }
    }
);

// ============================================
// Financial Analysis Endpoints (Initiative-based)
// ============================================

// Import Financial Calculator Service (lazy load to avoid circular deps)
let FinancialCalculatorService;
const getFinancialService = () => {
    if (!FinancialCalculatorService) {
        FinancialCalculatorService = import('financialCalculatorService.js');
    }
    return FinancialCalculatorService;
};

/**
 * GET /api/economics/initiatives/:initiativeId/financials
 * Get financial analysis for an initiative
 */
router.get('/initiatives/:initiativeId/financials',
    requireOrganization,
    async (req, res) => {
        try {
            const financials = await getFinancialService().getFinancials(
                req.params.initiativeId,
                req.organizationId
            );

            if (!financials) {
                return res.status(404).json({
                    error: 'Financial analysis not found',
                    code: 'NOT_FOUND',
                    message: 'No financial analysis exists for this initiative. Create one first.'
                });
            }

            res.json(financials);
        } catch (error) {
            console.error('[Economics API] Get financials error:', error);
            res.status(500).json({ error: 'Failed to retrieve financial analysis', code: 'GET_FAILED' });
        }
    }
);

/**
 * POST /api/economics/initiatives/:initiativeId/financials
 * Create or update financial analysis for an initiative
 */
router.post('/initiatives/:initiativeId/financials',
    requireOrganization,
    async (req, res) => {
        try {
            const financialData = {
                // Cost Structure
                initialInvestment: req.body.initialInvestment,
                implementationCost: req.body.implementationCost,
                annualOperatingCost: req.body.annualOperatingCost,
                trainingCost: req.body.trainingCost,
                contingencyPercent: req.body.contingencyPercent,

                // Benefits Structure
                annualCostSavings: req.body.annualCostSavings,
                annualRevenueIncrease: req.body.annualRevenueIncrease,
                productivityGainsPercent: req.body.productivityGainsPercent,
                riskReductionValue: req.body.riskReductionValue,

                // Time Parameters
                implementationMonths: req.body.implementationMonths,
                benefitRealizationMonths: req.body.benefitRealizationMonths,
                analysisHorizonYears: req.body.analysisHorizonYears,
                discountRate: req.body.discountRate,

                // Metadata
                currency: req.body.currency || 'PLN',
                assumptions: req.body.assumptions,
                analysisId: req.body.analysisId
            };

            const financials = await getFinancialService().createOrUpdateFinancials(
                req.params.initiativeId,
                financialData,
                req.organizationId,
                req.user.id
            );

            // Audit log
            await logAudit(
                req,
                GovernanceAuditService.AUDIT_ACTIONS.CREATE,
                'INITIATIVE_FINANCIALS',
                financials.id,
                null,
                { initiativeId: req.params.initiativeId, npv: financials.npv, roi: financials.roi_percent }
            );

            res.status(201).json(financials);
        } catch (error) {
            console.error('[Economics API] Create financials error:', error);
            res.status(500).json({ error: 'Failed to create financial analysis', code: 'CREATE_FAILED' });
        }
    }
);

/**
 * PUT /api/economics/initiatives/:initiativeId/financials
 * Update financial analysis
 */
router.put('/initiatives/:initiativeId/financials',
    requireOrganization,
    async (req, res) => {
        try {
            const before = await getFinancialService().getFinancials(
                req.params.initiativeId,
                req.organizationId
            );

            if (!before) {
                return res.status(404).json({ error: 'Financial analysis not found', code: 'NOT_FOUND' });
            }

            const financials = await getFinancialService().updateFinancials(
                req.params.initiativeId,
                req.body,
                req.organizationId,
                req.user.id
            );

            // Audit log
            await logAudit(
                req,
                GovernanceAuditService.AUDIT_ACTIONS.UPDATE,
                'INITIATIVE_FINANCIALS',
                financials.id,
                before,
                financials
            );

            res.json(financials);
        } catch (error) {
            console.error('[Economics API] Update financials error:', error);
            res.status(500).json({ error: 'Failed to update financial analysis', code: 'UPDATE_FAILED' });
        }
    }
);

/**
 * POST /api/economics/initiatives/:initiativeId/financials/calculate
 * Recalculate financial metrics (NPV, IRR, etc.)
 */
router.post('/initiatives/:initiativeId/financials/calculate',
    requireOrganization,
    async (req, res) => {
        try {
            const result = await getFinancialService().recalculateMetrics(
                req.params.initiativeId,
                req.organizationId
            );

            res.json(result);
        } catch (error) {
            console.error('[Economics API] Calculate financials error:', error);
            if (error.message === 'Financial analysis not found') {
                return res.status(404).json({ error: error.message, code: 'NOT_FOUND' });
            }
            res.status(500).json({ error: 'Failed to calculate metrics', code: 'CALC_FAILED' });
        }
    }
);

/**
 * POST /api/economics/initiatives/:initiativeId/financials/sensitivity
 * Run sensitivity analysis
 */
router.post('/initiatives/:initiativeId/financials/sensitivity',
    requireOrganization,
    async (req, res) => {
        try {
            const { variables, ranges } = req.body;

            const result = await getFinancialService().runSensitivityAnalysis(
                req.params.initiativeId,
                variables || ['discount_rate', 'annual_cost_savings', 'initial_investment'],
                ranges || { min: -20, max: 20, steps: 5 },
                req.organizationId
            );

            res.json(result);
        } catch (error) {
            console.error('[Economics API] Sensitivity analysis error:', error);
            res.status(500).json({ error: 'Failed to run sensitivity analysis', code: 'SENSITIVITY_FAILED' });
        }
    }
);

/**
 * GET /api/economics/initiatives/:initiativeId/financials/cash-flow
 * Get cash flow projections
 */
router.get('/initiatives/:initiativeId/financials/cash-flow',
    requireOrganization,
    async (req, res) => {
        try {
            const cashFlow = await getFinancialService().getCashFlowProjections(
                req.params.initiativeId,
                req.organizationId
            );

            res.json(cashFlow);
        } catch (error) {
            console.error('[Economics API] Cash flow error:', error);
            res.status(500).json({ error: 'Failed to get cash flow projections', code: 'CASHFLOW_FAILED' });
        }
    }
);

/**
 * POST /api/economics/initiatives/:initiativeId/financials/business-case
 * Generate business case document
 */
router.post('/initiatives/:initiativeId/financials/business-case',
    requireOrganization,
    exportLimiter,
    async (req, res) => {
        try {
            const options = {
                template: req.body.template || 'executive',
                language: req.body.language || 'pl',
                includeCharts: req.body.includeCharts !== false,
                includeSensitivity: req.body.includeSensitivity !== false
            };

            const result = await getFinancialService().generateBusinessCase(
                req.params.initiativeId,
                options,
                req.organizationId
            );

            // Audit log
            await logAudit(
                req,
                GovernanceAuditService.AUDIT_ACTIONS.PUBLISH,
                'BUSINESS_CASE',
                req.params.initiativeId,
                null,
                { template: options.template, language: options.language }
            );

            res.json(result);
        } catch (error) {
            console.error('[Economics API] Business case error:', error);
            res.status(500).json({ error: 'Failed to generate business case', code: 'BUSINESS_CASE_FAILED' });
        }
    }
);

// ============================================
// Benefits Tracking Endpoints
// ============================================

/**
 * GET /api/economics/initiatives/:initiativeId/benefits
 * Get benefit tracking data for an initiative
 */
router.get('/initiatives/:initiativeId/benefits',
    requireOrganization,
    async (req, res) => {
        try {
            const filters = {
                periodType: req.query.periodType,
                startDate: req.query.startDate,
                endDate: req.query.endDate,
                verificationStatus: req.query.verificationStatus
            };

            const benefits = await getFinancialService().getBenefitTracking(
                req.params.initiativeId,
                filters,
                req.organizationId
            );

            res.json(benefits);
        } catch (error) {
            console.error('[Economics API] Get benefits error:', error);
            res.status(500).json({ error: 'Failed to retrieve benefit tracking', code: 'GET_FAILED' });
        }
    }
);

/**
 * POST /api/economics/initiatives/:initiativeId/benefits
 * Record a benefit measurement
 */
router.post('/initiatives/:initiativeId/benefits',
    requireOrganization,
    async (req, res) => {
        try {
            const measurementData = {
                periodStart: req.body.periodStart,
                periodEnd: req.body.periodEnd,
                periodType: req.body.periodType || 'monthly',

                // Planned values
                plannedCostSavings: req.body.plannedCostSavings,
                plannedRevenueIncrease: req.body.plannedRevenueIncrease,
                plannedProductivityGains: req.body.plannedProductivityGains,

                // Actual values
                actualCostSavings: req.body.actualCostSavings,
                actualRevenueIncrease: req.body.actualRevenueIncrease,
                actualProductivityGains: req.body.actualProductivityGains,

                // Qualitative
                varianceNotes: req.body.varianceNotes,
                achievements: req.body.achievements,
                challenges: req.body.challenges,
                evidenceLinks: req.body.evidenceLinks
            };

            const measurement = await getFinancialService().recordBenefitMeasurement(
                req.params.initiativeId,
                measurementData,
                req.organizationId,
                req.user.id
            );

            // Audit log
            await logAudit(
                req,
                GovernanceAuditService.AUDIT_ACTIONS.CREATE,
                'BENEFIT_TRACKING',
                measurement.id,
                null,
                { initiativeId: req.params.initiativeId, period: `${measurementData.periodStart} to ${measurementData.periodEnd}` }
            );

            res.status(201).json(measurement);
        } catch (error) {
            console.error('[Economics API] Record benefit error:', error);
            res.status(500).json({ error: 'Failed to record benefit measurement', code: 'RECORD_FAILED' });
        }
    }
);

/**
 * PUT /api/economics/initiatives/:initiativeId/benefits/:benefitId
 * Update a benefit measurement
 */
router.put('/initiatives/:initiativeId/benefits/:benefitId',
    requireOrganization,
    async (req, res) => {
        try {
            const measurement = await getFinancialService().updateBenefitMeasurement(
                req.params.benefitId,
                req.body,
                req.organizationId,
                req.user.id
            );

            if (!measurement) {
                return res.status(404).json({ error: 'Measurement not found', code: 'NOT_FOUND' });
            }

            res.json(measurement);
        } catch (error) {
            console.error('[Economics API] Update benefit error:', error);
            res.status(500).json({ error: 'Failed to update measurement', code: 'UPDATE_FAILED' });
        }
    }
);

/**
 * POST /api/economics/initiatives/:initiativeId/benefits/:benefitId/verify
 * Verify a benefit measurement
 */
router.post('/initiatives/:initiativeId/benefits/:benefitId/verify',
    requireOrganization,
    async (req, res) => {
        try {
            const measurement = await getFinancialService().verifyBenefitMeasurement(
                req.params.benefitId,
                req.user.id
            );

            if (!measurement) {
                return res.status(404).json({ error: 'Measurement not found', code: 'NOT_FOUND' });
            }

            // Audit log
            await logAudit(
                req,
                GovernanceAuditService.AUDIT_ACTIONS.UPDATE,
                'BENEFIT_TRACKING',
                req.params.benefitId,
                { verification_status: 'pending' },
                { verification_status: 'verified', verified_by: req.user.id }
            );

            res.json(measurement);
        } catch (error) {
            console.error('[Economics API] Verify benefit error:', error);
            res.status(500).json({ error: 'Failed to verify measurement', code: 'VERIFY_FAILED' });
        }
    }
);

/**
 * GET /api/economics/initiatives/:initiativeId/benefits/summary
 * Get benefit tracking summary
 */
router.get('/initiatives/:initiativeId/benefits/summary',
    requireOrganization,
    async (req, res) => {
        try {
            const summary = await getFinancialService().getBenefitSummary(
                req.params.initiativeId,
                req.organizationId
            );

            res.json(summary);
        } catch (error) {
            console.error('[Economics API] Benefit summary error:', error);
            res.status(500).json({ error: 'Failed to get benefit summary', code: 'SUMMARY_FAILED' });
        }
    }
);

/**
 * GET /api/economics/initiatives/:initiativeId/benefits/variance
 * Get variance analysis
 */
router.get('/initiatives/:initiativeId/benefits/variance',
    requireOrganization,
    async (req, res) => {
        try {
            const variance = await getFinancialService().getVarianceAnalysis(
                req.params.initiativeId,
                req.organizationId
            );

            res.json(variance);
        } catch (error) {
            console.error('[Economics API] Variance analysis error:', error);
            res.status(500).json({ error: 'Failed to get variance analysis', code: 'VARIANCE_FAILED' });
        }
    }
);

// ============================================
// Quality Assessment Endpoints
// ============================================

/**
 * GET /api/economics/initiatives/:initiativeId/quality
 * Get quality assessment for an initiative
 */
router.get('/initiatives/:initiativeId/quality',
    requireOrganization,
    async (req, res) => {
        try {
            const QualityServiceModule = await import('../services/qualityAssessmentService.js');
            const QualityService = QualityServiceModule.default || QualityServiceModule;
            const assessment = await QualityService.getQualityAssessment(
                req.params.initiativeId,
                req.organizationId
            );

            if (!assessment) {
                return res.status(404).json({
                    error: 'Quality assessment not found',
                    code: 'NOT_FOUND',
                    message: 'No quality assessment exists for this initiative.'
                });
            }

            res.json(assessment);
        } catch (error) {
            console.error('[Economics API] Get quality error:', error);
            res.status(500).json({ error: 'Failed to retrieve quality assessment', code: 'GET_FAILED' });
        }
    }
);

/**
 * POST /api/economics/initiatives/:initiativeId/quality
 * Create quality assessment
 */
router.post('/initiatives/:initiativeId/quality',
    requireOrganization,
    async (req, res) => {
        try {
            const QualityServiceModule = await import('../services/qualityAssessmentService.js');
            const QualityService = QualityServiceModule.default || QualityServiceModule;
            const assessmentData = {
                assessmentType: req.body.assessmentType || 'post_implementation',
                lessonsLearned: req.body.lessonsLearned,
                improvementRecommendations: req.body.improvementRecommendations,
                assessmentNotes: req.body.assessmentNotes
            };

            const assessment = await QualityService.createQualityAssessment(
                req.params.initiativeId,
                assessmentData,
                req.organizationId,
                req.user.id
            );

            // Audit log
            await logAudit(
                req,
                GovernanceAuditService.AUDIT_ACTIONS.CREATE,
                'QUALITY_ASSESSMENT',
                assessment.id,
                null,
                { initiativeId: req.params.initiativeId, rating: assessment.overall_quality_rating }
            );

            res.status(201).json(assessment);
        } catch (error) {
            console.error('[Economics API] Create quality error:', error);
            res.status(500).json({ error: 'Failed to create quality assessment', code: 'CREATE_FAILED' });
        }
    }
);

/**
 * PUT /api/economics/initiatives/:initiativeId/quality
 * Update quality assessment
 */
router.put('/initiatives/:initiativeId/quality',
    requireOrganization,
    async (req, res) => {
        try {
            const QualityServiceModule = await import('../services/qualityAssessmentService.js');
            const QualityService = QualityServiceModule.default || QualityServiceModule;
            const assessment = await QualityService.updateQualityAssessment(
                req.params.initiativeId,
                req.body,
                req.organizationId,
                req.user.id
            );

            if (!assessment) {
                return res.status(404).json({ error: 'Quality assessment not found', code: 'NOT_FOUND' });
            }

            res.json(assessment);
        } catch (error) {
            console.error('[Economics API] Update quality error:', error);
            res.status(500).json({ error: 'Failed to update quality assessment', code: 'UPDATE_FAILED' });
        }
    }
);

/**
 * POST /api/economics/initiatives/:initiativeId/quality/recalculate
 * Recalculate quality scores based on current data
 */
router.post('/initiatives/:initiativeId/quality/recalculate',
    requireOrganization,
    async (req, res) => {
        try {
            const QualityServiceModule = await import('../services/qualityAssessmentService.js');
            const QualityService = QualityServiceModule.default || QualityServiceModule;
            const assessment = await QualityService.recalculateQualityScores(
                req.params.initiativeId,
                req.organizationId
            );

            res.json(assessment);
        } catch (error) {
            console.error('[Economics API] Recalculate quality error:', error);
            res.status(500).json({ error: 'Failed to recalculate quality scores', code: 'RECALC_FAILED' });
        }
    }
);

/**
 * GET /api/economics/initiatives/:initiativeId/quality/lessons
 * Get lessons learned for an initiative
 */
router.get('/initiatives/:initiativeId/quality/lessons',
    requireOrganization,
    async (req, res) => {
        try {
            const QualityServiceModule = await import('../services/qualityAssessmentService.js');
            const QualityService = QualityServiceModule.default || QualityServiceModule;
            const lessons = await QualityService.getLessonsLearned(
                req.params.initiativeId,
                req.organizationId
            );

            res.json({ lessons });
        } catch (error) {
            console.error('[Economics API] Get lessons error:', error);
            res.status(500).json({ error: 'Failed to retrieve lessons learned', code: 'GET_FAILED' });
        }
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

export default router;
