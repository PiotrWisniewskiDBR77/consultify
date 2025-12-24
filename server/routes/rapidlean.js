/**
 * RapidLean Assessment API Routes
 */

const express = require('express');
const router = express.Router();
const RapidLeanService = require('../services/rapidLeanService');
const RapidLeanObservationMapper = require('../services/rapidLeanObservationMapper');
const RapidLeanReportService = require('../services/rapidLeanReportService');
const verifyToken = require('../middleware/authMiddleware');
const { rapidLeanPhotoUpload } = require('../middleware/rapidLeanUploadMiddleware');
const db = require('../database');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

router.use(verifyToken);

/**
 * Create RapidLean Assessment
 * POST /api/rapidlean
 */
router.post('/', async (req, res) => {
    try {
        const { projectId, responses } = req.body;
        const organizationId = req.user.organizationId;
        const userId = req.user.id;

        if (!responses || Object.keys(responses).length === 0) {
            return res.status(400).json({ error: 'Questionnaire responses required' });
        }

        const assessment = await RapidLeanService.createAssessment({
            organizationId,
            projectId: projectId || null,
            responses,
            userId
        });

        console.log(`[RapidLean API] Assessment created: ${assessment.id}`);
        res.status(201).json(assessment);
    } catch (error) {
        console.error('[RapidLean API] Error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Get RapidLean Assessment by ID
 * GET /api/rapidlean/:assessmentId
 */
router.get('/:assessmentId', async (req, res) => {
    try {
        const { assessmentId } = req.params;
        const organizationId = req.user.organizationId;

        const assessment = await RapidLeanService.getAssessment(assessmentId, organizationId);

        // Get observations if available
        const observations = await RapidLeanService.getObservations(assessmentId);
        
        // Add DRD mapping with observations
        const drdMapping = await RapidLeanService.mapToDRD(assessment, observations);

        res.json({
            assessment,
            drdMapping,
            observations,
            benchmark: assessment.industry_benchmark
        });
    } catch (error) {
        console.error('[RapidLean API] Error:', error.message);
        res.status(404).json({ error: error.message });
    }
});

/**
 * Get all RapidLean Assessments for a project
 * GET /api/rapidlean/project/:projectId
 */
router.get('/project/:projectId', async (req, res) => {
    try {
        const { projectId } = req.params;
        const organizationId = req.user.organizationId;

        const assessments = await RapidLeanService.getProjectAssessments(projectId, organizationId);
        res.json({ assessments });
    } catch (error) {
        console.error('[RapidLean API] Error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Get industry benchmark
 * GET /api/rapidlean/benchmark/:industry
 */
router.get('/benchmark/:industry', (req, res) => {
    const { industry } = req.params;
    const benchmark = RapidLeanService.INDUSTRY_BENCHMARKS[industry.toUpperCase()]
        || RapidLeanService.INDUSTRY_BENCHMARKS.DEFAULT;

    res.json({
        industry: industry.toUpperCase(),
        avgScore: benchmark,
        distributionByDimension: {
            value_stream: benchmark * 0.95,
            waste_elimination: benchmark * 0.90,
            flow_pull: benchmark * 1.05,
            quality_source: benchmark * 1.0,
            continuous_improvement: benchmark * 0.85,
            visual_management: benchmark * 0.95
        }
    });
});

/**
 * Save observations and generate assessment + report
 * POST /api/rapidlean/observations
 */
router.post('/observations', rapidLeanPhotoUpload, async (req, res) => {
    try {
        const { organizationId, id: userId } = req.user;
        let { projectId, observations } = req.body;

        // Parse observations if it's a string (from FormData)
        if (typeof observations === 'string') {
            try {
                observations = JSON.parse(observations);
            } catch (e) {
                return res.status(400).json({ error: 'Invalid observations JSON format' });
            }
        }

        if (!observations || !Array.isArray(observations) || observations.length === 0) {
            return res.status(400).json({ error: 'Observations array required' });
        }

        // Process uploaded photos
        const photoUrls = (req.files || []).map(file => {
            // Extract relative path from full path
            const relativePath = file.path.includes('rapidlean') 
                ? file.path.split('rapidlean/')[1] 
                : file.filename;
            return `/uploads/organizations/${organizationId}/rapidlean/${relativePath}`;
        });

        // Attach photos to observations (if photos are provided)
        if (photoUrls.length > 0 && observations.length > 0) {
            // Distribute photos to observations (simple round-robin for now)
            observations.forEach((obs, index) => {
                if (!obs.photos) obs.photos = [];
                const photosForThisObs = photoUrls.slice(index * 3, (index + 1) * 3); // Max 3 photos per observation
                obs.photos.push(...photosForThisObs);
            });
        }

        // Map observations to RapidLean responses
        const responses = RapidLeanObservationMapper.mapObservationsToResponses(observations);

        // Create RapidLean assessment
        const assessment = await RapidLeanService.createAssessment({
            organizationId,
            projectId,
            responses,
            userId
        });

        // Save observations to database
        await saveObservations(observations, assessment.id, organizationId, userId);

        // Update assessment with observation count
        await updateAssessmentObservationCount(assessment.id, observations.length);

        // Generate comprehensive report
        const report = RapidLeanObservationMapper.generateObservationReport(observations, assessment);
        
        // Generate PDF report
        const pdfReport = await RapidLeanReportService.generateReport(
            assessment.id,
            organizationId,
            { format: 'pdf', template: 'detailed', includeCharts: true }
        );

        res.json({
            assessment,
            report,
            pdfUrl: pdfReport.fileUrl,
            message: 'Observations saved and report generated successfully'
        });
    } catch (error) {
        console.error('[RapidLean API] Observations error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Get observations for an assessment
 * GET /api/rapidlean/observations/:assessmentId
 */
router.get('/observations/:assessmentId', async (req, res) => {
    try {
        const { assessmentId } = req.params;
        const organizationId = req.user.organizationId;

        // Verify assessment belongs to organization
        const assessment = await RapidLeanService.getAssessment(assessmentId, organizationId);
        
        // Get observations
        const observations = await RapidLeanService.getObservations(assessmentId);

        res.json({ observations });
    } catch (error) {
        console.error('[RapidLean API] Error fetching observations:', error.message);
        res.status(404).json({ error: error.message });
    }
});

/**
 * Generate report for assessment
 * POST /api/rapidlean/:id/report
 */
router.post('/:id/report', async (req, res) => {
    try {
        const { id: assessmentId } = req.params;
        const organizationId = req.user.organizationId;
        const { format = 'pdf', template = 'detailed', includeCharts = true } = req.body;

        const report = await RapidLeanReportService.generateReport(
            assessmentId,
            organizationId,
            { format, template, includeCharts }
        );

        res.json(report);
    } catch (error) {
        console.error('[RapidLean API] Report generation error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Get available observation templates
 * GET /api/rapidlean/templates
 */
router.get('/templates', (req, res) => {
    try {
        const { getAllTemplates } = require('../data/rapidLeanObservationTemplates');
        const templates = getAllTemplates();
        
        res.json({ templates });
    } catch (error) {
        console.error('[RapidLean API] Error fetching templates:', error.message);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Get DRD mapping with observations
 * GET /api/rapidlean/:id/drd-mapping
 */
router.get('/:id/drd-mapping', async (req, res) => {
    try {
        const { id: assessmentId } = req.params;
        const organizationId = req.user.organizationId;

        const assessment = await RapidLeanService.getAssessment(assessmentId, organizationId);
        const observations = await RapidLeanService.getObservations(assessmentId);
        const drdMapping = await RapidLeanService.mapToDRD(assessment, observations);
        const gaps = RapidLeanService.calculateDRDGaps(drdMapping);
        const pathways = RapidLeanService.generatePathways(drdMapping);

        res.json({
            drdMapping,
            gaps,
            pathways,
            observationsCount: observations.length
        });
    } catch (error) {
        console.error('[RapidLean API] DRD mapping error:', error.message);
        res.status(404).json({ error: error.message });
    }
});

/**
 * Helper function to save observations
 */
async function saveObservations(observations, assessmentId, organizationId, userId) {
    return new Promise((resolve, reject) => {
        const sql = `
            INSERT INTO rapid_lean_observations (
                id, assessment_id, organization_id, project_id, template_id,
                location, timestamp, answers, photos, notes, created_by, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        `;
        
        let completed = 0;
        let hasError = false;

        observations.forEach(obs => {
            const observationId = uuidv4();
            const projectId = obs.projectId || null;
            
            db.run(sql, [
                observationId,
                assessmentId,
                organizationId,
                projectId,
                obs.templateId,
                obs.location || 'Production Floor',
                obs.timestamp || new Date().toISOString(),
                JSON.stringify(obs.answers || {}),
                JSON.stringify(obs.photos || []),
                obs.notes || '',
                userId
            ], (err) => {
                if (err && !hasError) {
                    hasError = true;
                    return reject(err);
                }
                completed++;
                if (completed === observations.length && !hasError) {
                    resolve();
                }
            });
        });
    });
}

/**
 * Helper function to update assessment observation count
 */
async function updateAssessmentObservationCount(assessmentId, count) {
    return new Promise((resolve, reject) => {
        db.run(
            'UPDATE rapid_lean_assessments SET observation_count = ? WHERE id = ?',
            [count, assessmentId],
            (err) => {
                if (err) return reject(err);
                resolve();
            }
        );
    });
}

module.exports = router;
