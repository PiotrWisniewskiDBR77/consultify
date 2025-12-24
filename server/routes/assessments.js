/**
 * Assessment Module API Routes
 * Handles RapidLean, ADKAR, External Digital, Generic Reports
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Services
const RapidLeanService = require('../services/rapidLeanService');
const ADKARService = require('../services/adkarService');
const ExternalAssessmentService = require('../services/externalAssessmentService');
const GenericReportService = require('../services/genericReportService');
const AssessmentOverviewService = require('../services/assessmentOverviewService');
const { assessmentRBAC } = require('../middleware/assessmentRBAC');
const AssessmentAuditLogger = require('../utils/assessmentAuditLogger');

// File upload configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/assessments/');
    },
    filename: (req, file, cb) => {
        const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (req, file, cb) => {
        const allowedTypes = /pdf|doc|docx|xls|xlsx/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (extname && mimetype) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only PDF, Word, Excel allowed.'));
        }
    }
});

// ============================================================================
// RAPIDLEAN ROUTES
// ============================================================================

// Create RapidLean assessment
router.post('/rapidlean', assessmentRBAC('create'), async (req, res) => {
    try {
        const { projectId, responses } = req.body;

        const result = await RapidLeanService.createAssessment({
            organizationId: req.user.organizationId,
            projectId,
            responses,
            userId: req.user.id
        });

        await AssessmentAuditLogger.logCreation(req, result.id, 'RAPIDLEAN');

        res.status(201).json(result);
    } catch (error) {
        console.error('Error creating RapidLean assessment:', error);
        res.status(500).json({ error: 'Failed to create assessment' });
    }
});

// Get RapidLean assessment
router.get('/rapidlean/:id', assessmentRBAC('read'), async (req, res) => {
    try {
        const assessment = await RapidLeanService.getAssessment(req.params.id);

        if (!assessment) {
            return res.status(404).json({ error: 'Assessment not found' });
        }

        res.json(assessment);
    } catch (error) {
        console.error('Error fetching RapidLean assessment:', error);
        res.status(500).json({ error: 'Failed to fetch assessment' });
    }
});

// ============================================================================
// ADKAR ROUTES
// ============================================================================

// Create ADKAR assessment
router.post('/adkar', assessmentRBAC('create'), async (req, res) => {
    try {
        const { projectId, responses } = req.body;

        const result = await ADKARService.createAssessment({
            organizationId: req.user.organizationId,
            projectId,
            responses,
            userId: req.user.id
        });

        await AssessmentAuditLogger.logCreation(req, result.id, 'ADKAR');

        res.status(201).json(result);
    } catch (error) {
        console.error('Error creating ADKAR assessment:', error);
        res.status(500).json({ error: 'Failed to create assessment' });
    }
});

// Get ADKAR assessment
router.get('/adkar/:id', assessmentRBAC('read'), async (req, res) => {
    try {
        const assessment = await ADKARService.getAssessment(req.params.id);

        if (!assessment) {
            return res.status(404).json({ error: 'Assessment not found' });
        }

        res.json(assessment);
    } catch (error) {
        console.error('Error fetching ADKAR assessment:', error);
        res.status(500).json({ error: 'Failed to fetch assessment' });
    }
});

// ============================================================================
// EXTERNAL ASSESSMENTS ROUTES
// ============================================================================

// Upload external assessment (SIRI/ADMA/CMMI)
router.post('/external-assessments',
    assessmentRBAC('create'),
    upload.single('file'),
    async (req, res) => {
        try {
            const { frameworkType, frameworkVersion, assessmentDate, projectId } = req.body;

            if (!req.file) {
                return res.status(400).json({ error: 'No file uploaded' });
            }

            const result = await ExternalAssessmentService.createAssessment({
                organizationId: req.user.organizationId,
                projectId,
                frameworkType,
                frameworkVersion,
                assessmentDate,
                filePath: req.file.path,
                fileName: req.file.originalname,
                fileSize: req.file.size,
                userId: req.user.id
            });

            await AssessmentAuditLogger.logFileUpload(req, result.id, req.file.originalname, req.file.size);

            res.status(201).json(result);
        } catch (error) {
            console.error('Error uploading external assessment:', error);
            res.status(500).json({ error: 'Failed to upload assessment' });
        }
    });

// Get external assessment
router.get('/external-assessments/:id', assessmentRBAC('read'), async (req, res) => {
    try {
        const assessment = await ExternalAssessmentService.getAssessment(req.params.id);

        if (!assessment) {
            return res.status(404).json({ error: 'Assessment not found' });
        }

        res.json(assessment);
    } catch (error) {
        console.error('Error fetching external assessment:', error);
        res.status(500).json({ error: 'Failed to fetch assessment' });
    }
});

// List external assessments for organization
router.get('/external-assessments/organization/:orgId', assessmentRBAC('read'), async (req, res) => {
    try {
        const { framework } = req.query;
        const assessments = await ExternalAssessmentService.listAssessments(req.params.orgId, framework);

        res.json({ assessments, total: assessments.length });
    } catch (error) {
        console.error('Error listing external assessments:', error);
        res.status(500).json({ error: 'Failed to list assessments' });
    }
});

// ============================================================================
// GENERIC REPORTS ROUTES
// ============================================================================

// Upload generic report
router.post('/generic-reports',
    assessmentRBAC('create'),
    upload.single('file'),
    async (req, res) => {
        try {
            const { title, reportType, consultantName, reportDate, tags, projectId } = req.body;

            if (!req.file) {
                return res.status(400).json({ error: 'No file uploaded' });
            }

            const result = await GenericReportService.createReport({
                organizationId: req.user.organizationId,
                projectId,
                title,
                reportType,
                consultantName,
                reportDate,
                tags,
                filePath: req.file.path,
                fileName: req.file.originalname,
                fileSize: req.file.size,
                userId: req.user.id
            });

            await AssessmentAuditLogger.logFileUpload(req, result.id, req.file.originalname, req.file.size);

            res.status(201).json(result);
        } catch (error) {
            console.error('Error uploading generic report:', error);
            res.status(500).json({ error: 'Failed to upload report' });
        }
    });

// Search/list generic reports
router.get('/generic-reports/organization/:orgId', assessmentRBAC('read'), async (req, res) => {
    try {
        const { search, type, limit = 50, offset = 0 } = req.query;

        const reports = await GenericReportService.searchReports(
            req.params.orgId,
            { search, type, limit: parseInt(limit), offset: parseInt(offset) }
        );

        res.json(reports);
    } catch (error) {
        console.error('Error searching generic reports:', error);
        res.status(500).json({ error: 'Failed to search reports' });
    }
});

// Get generic report details
router.get('/generic-reports/:id', assessmentRBAC('read'), async (req, res) => {
    try {
        const report = await GenericReportService.getReport(req.params.id);

        if (!report) {
            return res.status(404).json({ error: 'Report not found' });
        }

        res.json(report);
    } catch (error) {
        console.error('Error fetching generic report:', error);
        res.status(500).json({ error: 'Failed to fetch report' });
    }
});

// Delete generic report
router.delete('/generic-reports/:id', assessmentRBAC('delete'), async (req, res) => {
    try {
        await GenericReportService.deleteReport(req.params.id);
        await AssessmentAuditLogger.logDeletion(req, req.params.id, 'GENERIC_REPORT');

        res.status(204).send();
    } catch (error) {
        console.error('Error deleting generic report:', error);
        res.status(500).json({ error: 'Failed to delete report' });
    }
});

// ============================================================================
// ASSESSMENT OVERVIEW / HUB
// ============================================================================

// Get unified assessment overview for project
router.get('/sessions/:projectId/assessment-overview', assessmentRBAC('read'), async (req, res) => {
    try {
        const overview = await AssessmentOverviewService.getOverview(
            req.user.organizationId,
            req.params.projectId
        );

        res.json(overview);
    } catch (error) {
        console.error('Error fetching assessment overview:', error);
        res.status(500).json({ error: 'Failed to fetch overview' });
    }
});

module.exports = router;
