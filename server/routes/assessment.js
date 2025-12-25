const express = require('express');
const router = express.Router();
const AssessmentService = require('../services/assessmentService');
const verifyToken = require('../middleware/authMiddleware');

// GET /api/assessment/:projectId
router.get('/:projectId', verifyToken, async (req, res) => {
    try {
        const assessment = await AssessmentService.getAssessment(req.params.projectId);
        if (!assessment) {
            return res.json({ projectId: req.params.projectId, axisScores: [], completedAxes: [], isComplete: false });
        }

        // Add gap analysis
        const gapAnalysis = AssessmentService.generateGapSummary(assessment);

        res.json({
            ...assessment,
            ...gapAnalysis
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/assessment/:projectId
router.put('/:projectId', verifyToken, async (req, res) => {
    if (!req.can('edit_project_settings')) {
        return res.status(403).json({ error: 'Permission denied' });
    }

    try {
        const result = await AssessmentService.saveAssessment(req.params.projectId, req.body);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/assessment/:projectId/gap-analysis (AI Triggered)
router.post('/:projectId/gap-analysis', verifyToken, async (req, res) => {
    try {
        const assessment = await AssessmentService.getAssessment(req.params.projectId);
        if (!assessment) {
            return res.status(404).json({ error: 'Assessment not found' });
        }

        const gapAnalysis = AssessmentService.generateGapSummary(assessment);

        // Future: Call AI for deeper analysis
        res.json({
            ...gapAnalysis,
            aiRecommendations: gapAnalysis.prioritizedGaps.length > 0
                ? [`Focus on closing gaps in: ${gapAnalysis.prioritizedGaps.join(', ')}`]
                : ['Assessment complete. Proceed to Initiatives.']
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// =====================================================
// AI THINKING_PARTNER Endpoints (Enterprise Workflow)
// =====================================================

const { aiAssessmentPartner } = require('../services/aiAssessmentPartnerService');
const { aiAssessmentFormHelper, FIELD_TYPES } = require('../services/aiAssessmentFormHelper');

/**
 * @route POST /api/assessment/:projectId/ai/guidance
 * @desc Get AI guidance for a specific axis assessment
 */
router.post('/:projectId/ai/guidance', verifyToken, async (req, res) => {
    try {
        const { axisId, currentScore, targetScore, context } = req.body;
        
        if (!axisId || currentScore === undefined) {
            return res.status(400).json({ error: 'axisId and currentScore are required' });
        }

        const guidance = await aiAssessmentPartner.getAssessmentGuidance(
            axisId, 
            currentScore, 
            targetScore || currentScore + 1,
            context || {}
        );

        res.json(guidance);
    } catch (err) {
        console.error('[AIPartner] Guidance error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * @route POST /api/assessment/:projectId/ai/validate
 * @desc Validate score consistency across assessment
 */
router.post('/:projectId/ai/validate', verifyToken, async (req, res) => {
    try {
        const assessment = await AssessmentService.getAssessment(req.params.projectId);
        if (!assessment) {
            return res.status(404).json({ error: 'Assessment not found' });
        }

        const validation = await aiAssessmentPartner.validateScoreConsistency(
            assessment.axisScores || {},
            req.body.organizationContext || {}
        );

        res.json(validation);
    } catch (err) {
        console.error('[AIPartner] Validation error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * @route POST /api/assessment/:projectId/ai/gap/:axisId
 * @desc Generate detailed gap analysis for an axis
 */
router.post('/:projectId/ai/gap/:axisId', verifyToken, async (req, res) => {
    try {
        const { axisId } = req.params;
        const { currentScore, targetScore, justification } = req.body;

        if (currentScore === undefined || targetScore === undefined) {
            return res.status(400).json({ error: 'currentScore and targetScore are required' });
        }

        const gapAnalysis = await aiAssessmentPartner.generateGapAnalysis(
            axisId,
            currentScore,
            targetScore,
            justification || ''
        );

        res.json(gapAnalysis);
    } catch (err) {
        console.error('[AIPartner] Gap analysis error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * @route GET /api/assessment/:projectId/ai/insights
 * @desc Generate proactive insights based on current assessment
 */
router.get('/:projectId/ai/insights', verifyToken, async (req, res) => {
    try {
        const assessment = await AssessmentService.getAssessment(req.params.projectId);
        if (!assessment) {
            return res.status(404).json({ error: 'Assessment not found' });
        }

        const insights = await aiAssessmentPartner.generateProactiveInsights(
            assessment.axisScores || {},
            req.query.organizationContext ? JSON.parse(req.query.organizationContext) : {}
        );

        res.json(insights);
    } catch (err) {
        console.error('[AIPartner] Insights error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * @route POST /api/assessment/:projectId/ai/clarify
 * @desc Get clarifying question for a specific axis score
 */
router.post('/:projectId/ai/clarify', verifyToken, async (req, res) => {
    try {
        const { axisId, score, context } = req.body;

        if (!axisId || score === undefined) {
            return res.status(400).json({ error: 'axisId and score are required' });
        }

        const question = await aiAssessmentPartner.askClarifyingQuestion(
            axisId,
            score,
            context || {}
        );

        res.json(question);
    } catch (err) {
        console.error('[AIPartner] Clarify error:', err);
        res.status(500).json({ error: err.message });
    }
});

// =====================================================
// AI FORM HELPER Endpoints
// =====================================================

/**
 * @route POST /api/assessment/:projectId/ai/suggest-justification
 * @desc Get AI-generated justification suggestion for an axis score
 */
router.post('/:projectId/ai/suggest-justification', verifyToken, async (req, res) => {
    try {
        const { axisId, score, existingJustification, language } = req.body;

        if (!axisId || score === undefined) {
            return res.status(400).json({ error: 'axisId and score are required' });
        }

        const suggestion = await aiAssessmentPartner.suggestJustification(
            axisId,
            score,
            {
                existingJustification,
                language: language || 'pl',
                industry: req.body.industry,
                companySize: req.body.companySize
            }
        );

        res.json(suggestion);
    } catch (err) {
        console.error('[AIPartner] Suggest justification error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * @route POST /api/assessment/:projectId/ai/suggest-evidence
 * @desc Get AI-suggested evidence for a given score
 */
router.post('/:projectId/ai/suggest-evidence', verifyToken, async (req, res) => {
    try {
        const { axisId, score, industry, language } = req.body;

        if (!axisId || score === undefined) {
            return res.status(400).json({ error: 'axisId and score are required' });
        }

        const evidence = await aiAssessmentPartner.suggestEvidence(
            axisId,
            score,
            {
                industry,
                language: language || 'pl'
            }
        );

        res.json(evidence);
    } catch (err) {
        console.error('[AIPartner] Suggest evidence error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * @route POST /api/assessment/:projectId/ai/suggest-target
 * @desc Get AI-suggested target score
 */
router.post('/:projectId/ai/suggest-target', verifyToken, async (req, res) => {
    try {
        const { axisId, currentScore, ambitionLevel, industryAverage } = req.body;

        if (!axisId || currentScore === undefined) {
            return res.status(400).json({ error: 'axisId and currentScore are required' });
        }

        const suggestion = await aiAssessmentPartner.suggestTargetScore(
            axisId,
            currentScore,
            ambitionLevel || 'balanced',
            { industryAverage }
        );

        res.json(suggestion);
    } catch (err) {
        console.error('[AIPartner] Suggest target error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * @route POST /api/assessment/:projectId/ai/correct-text
 * @desc Correct and improve justification text
 */
router.post('/:projectId/ai/correct-text', verifyToken, async (req, res) => {
    try {
        const { text, targetLanguage } = req.body;

        if (!text) {
            return res.status(400).json({ error: 'text is required' });
        }

        const corrected = await aiAssessmentPartner.correctJustificationLanguage(
            text,
            targetLanguage || 'pl'
        );

        res.json(corrected);
    } catch (err) {
        console.error('[AIPartner] Correct text error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * @route POST /api/assessment/:projectId/ai/autocomplete
 * @desc Autocomplete partial justification text
 */
router.post('/:projectId/ai/autocomplete', verifyToken, async (req, res) => {
    try {
        const { partialText, axisId, score, language } = req.body;

        if (!partialText || !axisId || score === undefined) {
            return res.status(400).json({ error: 'partialText, axisId and score are required' });
        }

        const completion = await aiAssessmentPartner.autocompleteJustification(
            partialText,
            axisId,
            score,
            { language: language || 'pl' }
        );

        res.json(completion);
    } catch (err) {
        console.error('[AIPartner] Autocomplete error:', err);
        res.status(500).json({ error: err.message });
    }
});

// =====================================================
// AI REPORT GENERATION Endpoints
// =====================================================

/**
 * @route POST /api/assessment/:projectId/ai/executive-summary
 * @desc Generate AI executive summary from assessment
 */
router.post('/:projectId/ai/executive-summary', verifyToken, async (req, res) => {
    try {
        const assessment = await AssessmentService.getAssessment(req.params.projectId);
        if (!assessment) {
            return res.status(404).json({ error: 'Assessment not found' });
        }

        const summary = await aiAssessmentPartner.generateExecutiveSummary(
            assessment.axisScores || {},
            {
                organizationName: req.body.organizationName,
                industry: req.body.industry,
                language: req.body.language || 'pl'
            }
        );

        res.json(summary);
    } catch (err) {
        console.error('[AIPartner] Executive summary error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * @route POST /api/assessment/:projectId/ai/stakeholder-view
 * @desc Generate stakeholder-specific view of assessment
 */
router.post('/:projectId/ai/stakeholder-view', verifyToken, async (req, res) => {
    try {
        const { stakeholderRole, organizationName, language } = req.body;

        if (!stakeholderRole) {
            return res.status(400).json({ error: 'stakeholderRole is required (CTO, CFO, COO, CEO, BOARD)' });
        }

        const assessment = await AssessmentService.getAssessment(req.params.projectId);
        if (!assessment) {
            return res.status(404).json({ error: 'Assessment not found' });
        }

        const view = await aiAssessmentPartner.generateStakeholderView(
            assessment.axisScores || {},
            stakeholderRole,
            { organizationName, language: language || 'pl' }
        );

        res.json(view);
    } catch (err) {
        console.error('[AIPartner] Stakeholder view error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * @route POST /api/assessment/:projectId/ai/benchmark-commentary
 * @desc Generate benchmark comparison commentary
 */
router.post('/:projectId/ai/benchmark-commentary', verifyToken, async (req, res) => {
    try {
        const { benchmarks, industry, language } = req.body;

        if (!benchmarks) {
            return res.status(400).json({ error: 'benchmarks object is required' });
        }

        const assessment = await AssessmentService.getAssessment(req.params.projectId);
        if (!assessment) {
            return res.status(404).json({ error: 'Assessment not found' });
        }

        const commentary = await aiAssessmentPartner.generateBenchmarkCommentary(
            assessment.axisScores || {},
            benchmarks,
            { industry, language: language || 'pl' }
        );

        res.json(commentary);
    } catch (err) {
        console.error('[AIPartner] Benchmark commentary error:', err);
        res.status(500).json({ error: err.message });
    }
});

// =====================================================
// AI INITIATIVE GENERATION Endpoints
// =====================================================

/**
 * @route POST /api/assessment/:projectId/ai/generate-initiatives
 * @desc Generate initiatives from gap analysis
 */
router.post('/:projectId/ai/generate-initiatives', verifyToken, async (req, res) => {
    try {
        const assessment = await AssessmentService.getAssessment(req.params.projectId);
        if (!assessment) {
            return res.status(404).json({ error: 'Assessment not found' });
        }

        // Build gap analysis from assessment
        const gapAnalysis = Object.entries(assessment.axisScores || {})
            .filter(([key, val]) => val?.actual && val?.target)
            .map(([key, val]) => ({
                axis: key,
                axisName: key,
                currentScore: val.actual,
                targetScore: val.target,
                gap: val.target - val.actual
            }))
            .filter(g => g.gap > 0);

        const initiatives = await aiAssessmentPartner.generateInitiativesFromGaps(
            gapAnalysis,
            {
                budget: req.body.budget,
                timeline: req.body.timeline,
                resources: req.body.resources,
                language: req.body.language || 'pl'
            }
        );

        res.json(initiatives);
    } catch (err) {
        console.error('[AIPartner] Generate initiatives error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * @route POST /api/assessment/:projectId/ai/prioritize-initiatives
 * @desc Prioritize a list of initiatives
 */
router.post('/:projectId/ai/prioritize-initiatives', verifyToken, async (req, res) => {
    try {
        const { initiatives, criteria } = req.body;

        if (!initiatives || !Array.isArray(initiatives)) {
            return res.status(400).json({ error: 'initiatives array is required' });
        }

        const prioritized = await aiAssessmentPartner.prioritizeInitiatives(
            initiatives,
            criteria || {}
        );

        res.json(prioritized);
    } catch (err) {
        console.error('[AIPartner] Prioritize initiatives error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * @route POST /api/assessment/:projectId/ai/estimate-roi
 * @desc Estimate ROI for an initiative
 */
router.post('/:projectId/ai/estimate-roi', verifyToken, async (req, res) => {
    try {
        const { initiative, companySize, industry, revenue } = req.body;

        if (!initiative) {
            return res.status(400).json({ error: 'initiative object is required' });
        }

        const roiEstimate = await aiAssessmentPartner.estimateInitiativeROI(
            initiative,
            { companySize, industry, revenue }
        );

        res.json(roiEstimate);
    } catch (err) {
        console.error('[AIPartner] Estimate ROI error:', err);
        res.status(500).json({ error: err.message });
    }
});

// =====================================================
// AI FORM HELPER Batch Operations
// =====================================================

/**
 * @route POST /api/assessment/:projectId/ai/fill-missing
 * @desc Fill missing fields with AI suggestions
 */
router.post('/:projectId/ai/fill-missing', verifyToken, async (req, res) => {
    if (!req.can('edit_project_settings')) {
        return res.status(403).json({ error: 'Permission denied' });
    }

    try {
        const assessment = await AssessmentService.getAssessment(req.params.projectId);
        if (!assessment) {
            return res.status(404).json({ error: 'Assessment not found' });
        }

        const filled = await aiAssessmentFormHelper.fillMissingFields(
            {
                ...assessment.axisScores,
                metadata: { industry: req.body.industry }
            },
            req.body.strategy || 'suggest-only'
        );

        res.json(filled);
    } catch (err) {
        console.error('[AIFormHelper] Fill missing error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * @route POST /api/assessment/:projectId/ai/review-justifications
 * @desc Review and score all justifications
 */
router.post('/:projectId/ai/review-justifications', verifyToken, async (req, res) => {
    try {
        const assessment = await AssessmentService.getAssessment(req.params.projectId);
        if (!assessment) {
            return res.status(404).json({ error: 'Assessment not found' });
        }

        const review = await aiAssessmentFormHelper.reviewAllJustifications(
            assessment.axisScores || {},
            { language: req.body.language || 'pl' }
        );

        res.json(review);
    } catch (err) {
        console.error('[AIFormHelper] Review justifications error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * @route POST /api/assessment/:projectId/ai/contextual-help
 * @desc Get contextual help for current form state
 */
router.post('/:projectId/ai/contextual-help', verifyToken, async (req, res) => {
    try {
        const { currentField, currentAxis, currentScore, completedAxes } = req.body;

        const help = await aiAssessmentFormHelper.getContextualHelp(
            { currentField, currentAxis, currentScore },
            { completedAxes }
        );

        res.json(help);
    } catch (err) {
        console.error('[AIFormHelper] Contextual help error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * @route POST /api/assessment/:projectId/ai/quick-actions
 * @desc Get available quick actions for current context
 */
router.post('/:projectId/ai/quick-actions', verifyToken, async (req, res) => {
    try {
        const formState = req.body;
        const actions = aiAssessmentFormHelper.getQuickActions(formState);
        res.json({ actions });
    } catch (err) {
        console.error('[AIFormHelper] Quick actions error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * @route POST /api/assessment/:projectId/ai/validate-field
 * @desc Validate a field value with AI feedback
 */
router.post('/:projectId/ai/validate-field', verifyToken, async (req, res) => {
    try {
        const { fieldType, value, axisId, score, fullAssessment } = req.body;

        if (!fieldType) {
            return res.status(400).json({ error: 'fieldType is required' });
        }

        const validation = await aiAssessmentFormHelper.validateFieldValue(
            fieldType,
            value,
            { axisId, score, fullAssessment }
        );

        res.json(validation);
    } catch (err) {
        console.error('[AIFormHelper] Validate field error:', err);
        res.status(500).json({ error: err.message });
    }
});

// =====================================================
// AI REPORT GENERATOR Endpoints
// =====================================================

const { aiAssessmentReportGenerator, REPORT_TYPES, STAKEHOLDER_ROLES } = require('../services/aiAssessmentReportGenerator');

/**
 * @route POST /api/assessment/:projectId/ai/reports/full
 * @desc Generate complete assessment report
 */
router.post('/:projectId/ai/reports/full', verifyToken, async (req, res) => {
    try {
        const assessment = await AssessmentService.getAssessment(req.params.projectId);
        if (!assessment) {
            return res.status(404).json({ error: 'Assessment not found' });
        }

        const { organizationName, industry, language, includeRecommendations, includeBenchmarks, includeRoadmap, benchmarks } = req.body;

        const report = await aiAssessmentReportGenerator.generateFullReport(
            assessment.axisScores || {},
            {
                organizationName,
                industry,
                language: language || 'pl',
                includeRecommendations: includeRecommendations !== false,
                includeBenchmarks: includeBenchmarks !== false,
                includeRoadmap: includeRoadmap !== false,
                benchmarks
            }
        );

        res.json(report);
    } catch (err) {
        console.error('[AIReportGenerator] Full report error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * @route POST /api/assessment/:projectId/ai/reports/stakeholder
 * @desc Generate stakeholder-specific report
 */
router.post('/:projectId/ai/reports/stakeholder', verifyToken, async (req, res) => {
    try {
        const { stakeholderRole, organizationName, language } = req.body;

        if (!stakeholderRole || !Object.values(STAKEHOLDER_ROLES).includes(stakeholderRole)) {
            return res.status(400).json({ 
                error: 'Valid stakeholderRole is required',
                validRoles: Object.values(STAKEHOLDER_ROLES)
            });
        }

        const assessment = await AssessmentService.getAssessment(req.params.projectId);
        if (!assessment) {
            return res.status(404).json({ error: 'Assessment not found' });
        }

        const report = await aiAssessmentReportGenerator.generateStakeholderReport(
            assessment.axisScores || {},
            stakeholderRole,
            { organizationName, language: language || 'pl' }
        );

        res.json(report);
    } catch (err) {
        console.error('[AIReportGenerator] Stakeholder report error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * @route POST /api/assessment/:projectId/ai/reports/benchmark
 * @desc Generate benchmark comparison report
 */
router.post('/:projectId/ai/reports/benchmark', verifyToken, async (req, res) => {
    try {
        const { benchmarks, industry, language } = req.body;

        if (!benchmarks) {
            return res.status(400).json({ error: 'benchmarks object is required' });
        }

        const assessment = await AssessmentService.getAssessment(req.params.projectId);
        if (!assessment) {
            return res.status(404).json({ error: 'Assessment not found' });
        }

        const report = await aiAssessmentReportGenerator.generateBenchmarkReport(
            assessment.axisScores || {},
            benchmarks,
            { industry, language: language || 'pl' }
        );

        res.json(report);
    } catch (err) {
        console.error('[AIReportGenerator] Benchmark report error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * @route POST /api/assessment/:projectId/ai/reports/initiative-plan
 * @desc Generate transformation initiative plan
 */
router.post('/:projectId/ai/reports/initiative-plan', verifyToken, async (req, res) => {
    try {
        const assessment = await AssessmentService.getAssessment(req.params.projectId);
        if (!assessment) {
            return res.status(404).json({ error: 'Assessment not found' });
        }

        const { budget, timeline, resources, companySize, industry, criteria, language } = req.body;

        const plan = await aiAssessmentReportGenerator.generateInitiativePlan(
            assessment.axisScores || {},
            { budget, timeline, resources, companySize, industry, criteria },
            { language: language || 'pl' }
        );

        res.json(plan);
    } catch (err) {
        console.error('[AIReportGenerator] Initiative plan error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * @route GET /api/assessment/:projectId/ai/reports/types
 * @desc Get available report types and stakeholder roles
 */
router.get('/:projectId/ai/reports/types', verifyToken, async (req, res) => {
    res.json({
        reportTypes: Object.values(REPORT_TYPES),
        stakeholderRoles: Object.values(STAKEHOLDER_ROLES)
    });
});

module.exports = router;
