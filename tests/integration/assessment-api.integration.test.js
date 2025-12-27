/**
 * Integration Tests: Assessment API Routes
 * Complete test coverage for assessment API endpoints including AI features
 */

import { describe, it, expect, beforeAll, beforeEach, vi, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';

// Mock database
const mockDb = {
    get: vi.fn(),
    run: vi.fn(),
    all: vi.fn()
};

vi.mock('../../server/database', () => ({
    default: mockDb
}));

// Mock assessment service
const mockAssessmentService = {
    getAssessment: vi.fn(),
    saveAssessment: vi.fn(),
    generateGapSummary: vi.fn()
};

vi.mock('../../server/services/assessmentService', () => ({
    default: mockAssessmentService
}));

// Mock AI services
const mockAiAssessmentPartner = {
    getAssessmentGuidance: vi.fn(),
    validateScoreConsistency: vi.fn(),
    generateGapAnalysis: vi.fn(),
    generateProactiveInsights: vi.fn(),
    askClarifyingQuestion: vi.fn(),
    suggestJustification: vi.fn(),
    suggestEvidence: vi.fn(),
    suggestTargetScore: vi.fn(),
    correctJustificationLanguage: vi.fn(),
    autocompleteJustification: vi.fn(),
    generateExecutiveSummary: vi.fn(),
    generateStakeholderView: vi.fn(),
    generateBenchmarkCommentary: vi.fn(),
    generateInitiativesFromGaps: vi.fn(),
    prioritizeInitiatives: vi.fn(),
    estimateInitiativeROI: vi.fn()
};

vi.mock('../../server/services/aiAssessmentPartnerService', () => ({
    aiAssessmentPartner: mockAiAssessmentPartner
}));

const mockAiFormHelper = {
    fillMissingFields: vi.fn(),
    reviewAllJustifications: vi.fn(),
    getContextualHelp: vi.fn(),
    getQuickActions: vi.fn(),
    validateFieldValue: vi.fn()
};

vi.mock('../../server/services/aiAssessmentFormHelper', () => ({
    aiAssessmentFormHelper: mockAiFormHelper,
    FIELD_TYPES: {
        JUSTIFICATION: 'justification',
        EVIDENCE: 'evidence',
        TARGET_SCORE: 'targetScore',
        ACTUAL_SCORE: 'actualScore'
    }
}));

const mockAiReportGenerator = {
    generateFullReport: vi.fn(),
    generateStakeholderReport: vi.fn(),
    generateBenchmarkReport: vi.fn(),
    generateInitiativePlan: vi.fn()
};

vi.mock('../../server/services/aiAssessmentReportGenerator', () => ({
    aiAssessmentReportGenerator: mockAiReportGenerator,
    REPORT_TYPES: {
        FULL_ASSESSMENT: 'full_assessment',
        STAKEHOLDER_VIEW: 'stakeholder_view'
    },
    STAKEHOLDER_ROLES: {
        CTO: 'CTO',
        CFO: 'CFO',
        CEO: 'CEO'
    }
}));

describe('Assessment API Integration Tests', () => {
    let app;
    let currentUser;

    const sampleAssessment = {
        projectId: 'project-123',
        axisScores: {
            processes: { actual: 4, target: 6, justification: 'Test justification' },
            dataManagement: { actual: 3, target: 5, justification: 'Data justification' }
        },
        completedAxes: ['processes', 'dataManagement'],
        isComplete: false
    };

    beforeAll(() => {
        app = express();
        app.use(express.json());

        // Mock auth middleware
        app.use((req, res, next) => {
            if (!currentUser) {
                return res.status(401).json({ error: 'Unauthorized' });
            }
            req.user = currentUser;
            req.can = (permission) => {
                if (currentUser.role === 'ADMIN') return true;
                if (currentUser.role === 'PROJECT_MANAGER') {
                    return ['edit_project_settings', 'view_project'].includes(permission);
                }
                if (currentUser.role === 'VIEWER') {
                    return permission === 'view_project';
                }
                return false;
            };
            next();
        });

        // Create test routes
        const router = express.Router();

        // GET assessment
        router.get('/:projectId', async (req, res) => {
            try {
                const assessment = await mockAssessmentService.getAssessment(req.params.projectId);
                if (!assessment) {
                    return res.json({ projectId: req.params.projectId, axisScores: [], completedAxes: [], isComplete: false });
                }
                const gapAnalysis = mockAssessmentService.generateGapSummary(assessment);
                res.json({ ...assessment, ...gapAnalysis });
            } catch (err) {
                res.status(500).json({ error: err.message });
            }
        });

        // PUT assessment
        router.put('/:projectId', async (req, res) => {
            if (!req.can('edit_project_settings')) {
                return res.status(403).json({ error: 'Permission denied' });
            }
            try {
                const result = await mockAssessmentService.saveAssessment(req.params.projectId, req.body);
                res.json(result);
            } catch (err) {
                res.status(500).json({ error: err.message });
            }
        });

        // POST gap-analysis
        router.post('/:projectId/gap-analysis', async (req, res) => {
            try {
                const assessment = await mockAssessmentService.getAssessment(req.params.projectId);
                if (!assessment) {
                    return res.status(404).json({ error: 'Assessment not found' });
                }
                const gapAnalysis = mockAssessmentService.generateGapSummary(assessment);
                res.json({
                    ...gapAnalysis,
                    aiRecommendations: gapAnalysis.prioritizedGaps?.length > 0
                        ? [`Focus on closing gaps in: ${gapAnalysis.prioritizedGaps.join(', ')}`]
                        : ['Assessment complete. Proceed to Initiatives.']
                });
            } catch (err) {
                res.status(500).json({ error: err.message });
            }
        });

        // AI Guidance
        router.post('/:projectId/ai/guidance', async (req, res) => {
            try {
                const { axisId, currentScore, targetScore, context } = req.body;
                if (!axisId || currentScore === undefined) {
                    return res.status(400).json({ error: 'axisId and currentScore are required' });
                }
                const guidance = await mockAiAssessmentPartner.getAssessmentGuidance(
                    axisId, currentScore, targetScore || currentScore + 1, context || {}
                );
                res.json(guidance);
            } catch (err) {
                res.status(500).json({ error: err.message });
            }
        });

        // AI Validate
        router.post('/:projectId/ai/validate', async (req, res) => {
            try {
                const assessment = await mockAssessmentService.getAssessment(req.params.projectId);
                if (!assessment) {
                    return res.status(404).json({ error: 'Assessment not found' });
                }
                const validation = await mockAiAssessmentPartner.validateScoreConsistency(
                    assessment.axisScores || {},
                    req.body.organizationContext || {}
                );
                res.json(validation);
            } catch (err) {
                res.status(500).json({ error: err.message });
            }
        });

        // AI Gap Analysis
        router.post('/:projectId/ai/gap/:axisId', async (req, res) => {
            try {
                const { currentScore, targetScore, justification } = req.body;
                if (currentScore === undefined || targetScore === undefined) {
                    return res.status(400).json({ error: 'currentScore and targetScore are required' });
                }
                const gapAnalysis = await mockAiAssessmentPartner.generateGapAnalysis(
                    req.params.axisId, currentScore, targetScore, justification || ''
                );
                res.json(gapAnalysis);
            } catch (err) {
                res.status(500).json({ error: err.message });
            }
        });

        // AI Insights
        router.get('/:projectId/ai/insights', async (req, res) => {
            try {
                const assessment = await mockAssessmentService.getAssessment(req.params.projectId);
                if (!assessment) {
                    return res.status(404).json({ error: 'Assessment not found' });
                }
                const insights = await mockAiAssessmentPartner.generateProactiveInsights(
                    assessment.axisScores || {}
                );
                res.json(insights);
            } catch (err) {
                res.status(500).json({ error: err.message });
            }
        });

        // AI Suggest Justification
        router.post('/:projectId/ai/suggest-justification', async (req, res) => {
            try {
                const { axisId, score } = req.body;
                if (!axisId || score === undefined) {
                    return res.status(400).json({ error: 'axisId and score are required' });
                }
                const suggestion = await mockAiAssessmentPartner.suggestJustification(axisId, score, {});
                res.json(suggestion);
            } catch (err) {
                res.status(500).json({ error: err.message });
            }
        });

        // AI Suggest Evidence
        router.post('/:projectId/ai/suggest-evidence', async (req, res) => {
            try {
                const { axisId, score } = req.body;
                if (!axisId || score === undefined) {
                    return res.status(400).json({ error: 'axisId and score are required' });
                }
                const evidence = await mockAiAssessmentPartner.suggestEvidence(axisId, score, {});
                res.json(evidence);
            } catch (err) {
                res.status(500).json({ error: err.message });
            }
        });

        // AI Suggest Target
        router.post('/:projectId/ai/suggest-target', async (req, res) => {
            try {
                const { axisId, currentScore, ambitionLevel } = req.body;
                if (!axisId || currentScore === undefined) {
                    return res.status(400).json({ error: 'axisId and currentScore are required' });
                }
                const suggestion = await mockAiAssessmentPartner.suggestTargetScore(
                    axisId, currentScore, ambitionLevel || 'balanced', {}
                );
                res.json(suggestion);
            } catch (err) {
                res.status(500).json({ error: err.message });
            }
        });

        // AI Correct Text
        router.post('/:projectId/ai/correct-text', async (req, res) => {
            try {
                const { text, targetLanguage } = req.body;
                if (!text) {
                    return res.status(400).json({ error: 'text is required' });
                }
                const corrected = await mockAiAssessmentPartner.correctJustificationLanguage(
                    text, targetLanguage || 'pl'
                );
                res.json(corrected);
            } catch (err) {
                res.status(500).json({ error: err.message });
            }
        });

        // AI Autocomplete
        router.post('/:projectId/ai/autocomplete', async (req, res) => {
            try {
                const { partialText, axisId, score } = req.body;
                if (!partialText || !axisId || score === undefined) {
                    return res.status(400).json({ error: 'partialText, axisId and score are required' });
                }
                const completion = await mockAiAssessmentPartner.autocompleteJustification(
                    partialText, axisId, score, {}
                );
                res.json(completion);
            } catch (err) {
                res.status(500).json({ error: err.message });
            }
        });

        // AI Fill Missing
        router.post('/:projectId/ai/fill-missing', async (req, res) => {
            if (!req.can('edit_project_settings')) {
                return res.status(403).json({ error: 'Permission denied' });
            }
            try {
                const assessment = await mockAssessmentService.getAssessment(req.params.projectId);
                if (!assessment) {
                    return res.status(404).json({ error: 'Assessment not found' });
                }
                const filled = await mockAiFormHelper.fillMissingFields(
                    { ...assessment.axisScores },
                    req.body.strategy || 'suggest-only'
                );
                res.json(filled);
            } catch (err) {
                res.status(500).json({ error: err.message });
            }
        });

        // AI Review Justifications
        router.post('/:projectId/ai/review-justifications', async (req, res) => {
            try {
                const assessment = await mockAssessmentService.getAssessment(req.params.projectId);
                if (!assessment) {
                    return res.status(404).json({ error: 'Assessment not found' });
                }
                const review = await mockAiFormHelper.reviewAllJustifications(
                    assessment.axisScores || {},
                    { language: req.body.language || 'pl' }
                );
                res.json(review);
            } catch (err) {
                res.status(500).json({ error: err.message });
            }
        });

        // AI Reports - Full
        router.post('/:projectId/ai/reports/full', async (req, res) => {
            try {
                const assessment = await mockAssessmentService.getAssessment(req.params.projectId);
                if (!assessment) {
                    return res.status(404).json({ error: 'Assessment not found' });
                }
                const report = await mockAiReportGenerator.generateFullReport(
                    assessment.axisScores || {},
                    req.body
                );
                res.json(report);
            } catch (err) {
                res.status(500).json({ error: err.message });
            }
        });

        // AI Reports - Stakeholder
        router.post('/:projectId/ai/reports/stakeholder', async (req, res) => {
            try {
                const { stakeholderRole } = req.body;
                if (!stakeholderRole) {
                    return res.status(400).json({ error: 'stakeholderRole is required' });
                }
                const assessment = await mockAssessmentService.getAssessment(req.params.projectId);
                if (!assessment) {
                    return res.status(404).json({ error: 'Assessment not found' });
                }
                const report = await mockAiReportGenerator.generateStakeholderReport(
                    assessment.axisScores || {},
                    stakeholderRole,
                    req.body
                );
                res.json(report);
            } catch (err) {
                res.status(500).json({ error: err.message });
            }
        });

        // AI Generate Initiatives
        router.post('/:projectId/ai/generate-initiatives', async (req, res) => {
            try {
                const assessment = await mockAssessmentService.getAssessment(req.params.projectId);
                if (!assessment) {
                    return res.status(404).json({ error: 'Assessment not found' });
                }
                const initiatives = await mockAiAssessmentPartner.generateInitiativesFromGaps(
                    [],
                    req.body
                );
                res.json(initiatives);
            } catch (err) {
                res.status(500).json({ error: err.message });
            }
        });

        // AI Prioritize Initiatives
        router.post('/:projectId/ai/prioritize-initiatives', async (req, res) => {
            try {
                const { initiatives } = req.body;
                if (!initiatives || !Array.isArray(initiatives)) {
                    return res.status(400).json({ error: 'initiatives array is required' });
                }
                const prioritized = await mockAiAssessmentPartner.prioritizeInitiatives(
                    initiatives,
                    req.body.criteria || {}
                );
                res.json(prioritized);
            } catch (err) {
                res.status(500).json({ error: err.message });
            }
        });

        // AI Estimate ROI
        router.post('/:projectId/ai/estimate-roi', async (req, res) => {
            try {
                const { initiative } = req.body;
                if (!initiative) {
                    return res.status(400).json({ error: 'initiative object is required' });
                }
                const estimate = await mockAiAssessmentPartner.estimateInitiativeROI(
                    initiative,
                    req.body
                );
                res.json(estimate);
            } catch (err) {
                res.status(500).json({ error: err.message });
            }
        });

        app.use('/api/assessment', router);
    });

    beforeEach(() => {
        vi.clearAllMocks();
        currentUser = {
            id: 'user-123',
            email: 'user@example.com',
            organizationId: 'org-123',
            role: 'PROJECT_MANAGER'
        };

        // Setup default mock responses
        mockAssessmentService.getAssessment.mockResolvedValue(sampleAssessment);
        mockAssessmentService.saveAssessment.mockResolvedValue({ success: true });
        mockAssessmentService.generateGapSummary.mockReturnValue({
            prioritizedGaps: ['processes', 'dataManagement'],
            averageGap: 2
        });

        mockAiAssessmentPartner.getAssessmentGuidance.mockResolvedValue({
            guidance: 'Test guidance',
            mode: 'AI_GENERATED'
        });
        mockAiAssessmentPartner.validateScoreConsistency.mockResolvedValue({
            hasInconsistencies: false,
            inconsistencies: []
        });
        mockAiAssessmentPartner.generateGapAnalysis.mockResolvedValue({
            gap: 2,
            pathway: [],
            estimatedMonths: 12
        });
        mockAiAssessmentPartner.generateProactiveInsights.mockResolvedValue({
            insights: []
        });
        mockAiAssessmentPartner.suggestJustification.mockResolvedValue({
            suggestion: 'AI suggested justification',
            mode: 'AI_GENERATED'
        });
        mockAiAssessmentPartner.suggestEvidence.mockResolvedValue({
            evidence: ['Evidence 1', 'Evidence 2']
        });
        mockAiAssessmentPartner.suggestTargetScore.mockResolvedValue({
            suggestedTarget: 5,
            reasoning: 'Based on analysis'
        });
        mockAiAssessmentPartner.correctJustificationLanguage.mockResolvedValue({
            correctedText: 'Corrected text',
            mode: 'AI_CORRECTED'
        });
        mockAiAssessmentPartner.autocompleteJustification.mockResolvedValue({
            completion: ' more text',
            mode: 'AI_COMPLETED'
        });
        mockAiAssessmentPartner.generateInitiativesFromGaps.mockResolvedValue({
            initiatives: []
        });
        mockAiAssessmentPartner.prioritizeInitiatives.mockResolvedValue({
            prioritizedList: []
        });
        mockAiAssessmentPartner.estimateInitiativeROI.mockResolvedValue({
            estimate: { roi: '2.5x' }
        });

        mockAiFormHelper.fillMissingFields.mockResolvedValue({
            filledFields: {},
            mode: 'SUGGESTIONS_ONLY'
        });
        mockAiFormHelper.reviewAllJustifications.mockResolvedValue({
            reviews: [],
            summary: { totalReviewed: 0 }
        });

        mockAiReportGenerator.generateFullReport.mockResolvedValue({
            reportType: 'full_assessment',
            sections: []
        });
        mockAiReportGenerator.generateStakeholderReport.mockResolvedValue({
            reportType: 'stakeholder_view',
            stakeholderRole: 'CTO'
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // =========================================================================
    // BASIC CRUD TESTS
    // =========================================================================

    describe('GET /api/assessment/:projectId', () => {
        it('should return assessment for valid project', async () => {
            const response = await request(app)
                .get('/api/assessment/project-123');

            expect(response.status).toBe(200);
            expect(response.body.projectId).toBe('project-123');
            expect(response.body.axisScores).toBeDefined();
        });

        it('should return empty assessment for non-existent project', async () => {
            mockAssessmentService.getAssessment.mockResolvedValue(null);

            const response = await request(app)
                .get('/api/assessment/unknown-project');

            expect(response.status).toBe(200);
            expect(response.body.axisScores).toEqual([]);
            expect(response.body.isComplete).toBe(false);
        });

        it('should reject unauthenticated request', async () => {
            currentUser = null;

            const response = await request(app)
                .get('/api/assessment/project-123');

            expect(response.status).toBe(401);
        });

        it('should include gap analysis in response', async () => {
            const response = await request(app)
                .get('/api/assessment/project-123');

            expect(response.body.prioritizedGaps).toBeDefined();
            expect(mockAssessmentService.generateGapSummary).toHaveBeenCalled();
        });
    });

    describe('PUT /api/assessment/:projectId', () => {
        it('should save assessment for authorized user', async () => {
            const response = await request(app)
                .put('/api/assessment/project-123')
                .send(sampleAssessment);

            expect(response.status).toBe(200);
            expect(mockAssessmentService.saveAssessment).toHaveBeenCalledWith(
                'project-123',
                expect.any(Object)
            );
        });

        it('should deny access for viewer', async () => {
            currentUser = { ...currentUser, role: 'VIEWER' };

            const response = await request(app)
                .put('/api/assessment/project-123')
                .send(sampleAssessment);

            expect(response.status).toBe(403);
        });
    });

    // =========================================================================
    // GAP ANALYSIS TESTS
    // =========================================================================

    describe('POST /api/assessment/:projectId/gap-analysis', () => {
        it('should return gap analysis for valid project', async () => {
            const response = await request(app)
                .post('/api/assessment/project-123/gap-analysis');

            expect(response.status).toBe(200);
            expect(response.body.prioritizedGaps).toBeDefined();
            expect(response.body.aiRecommendations).toBeDefined();
        });

        it('should return 404 for non-existent assessment', async () => {
            mockAssessmentService.getAssessment.mockResolvedValue(null);

            const response = await request(app)
                .post('/api/assessment/unknown/gap-analysis');

            expect(response.status).toBe(404);
        });
    });

    // =========================================================================
    // AI GUIDANCE TESTS
    // =========================================================================

    describe('POST /api/assessment/:projectId/ai/guidance', () => {
        it('should return AI guidance for valid request', async () => {
            const response = await request(app)
                .post('/api/assessment/project-123/ai/guidance')
                .send({ axisId: 'processes', currentScore: 3, targetScore: 5 });

            expect(response.status).toBe(200);
            expect(mockAiAssessmentPartner.getAssessmentGuidance).toHaveBeenCalledWith(
                'processes', 3, 5, expect.any(Object)
            );
        });

        it('should require axisId and currentScore', async () => {
            const response = await request(app)
                .post('/api/assessment/project-123/ai/guidance')
                .send({ axisId: 'processes' });

            expect(response.status).toBe(400);
            expect(response.body.error).toContain('required');
        });

        it('should use currentScore+1 as default target', async () => {
            const response = await request(app)
                .post('/api/assessment/project-123/ai/guidance')
                .send({ axisId: 'processes', currentScore: 3 });

            expect(response.status).toBe(200);
            expect(mockAiAssessmentPartner.getAssessmentGuidance).toHaveBeenCalledWith(
                'processes', 3, 4, expect.any(Object)
            );
        });
    });

    // =========================================================================
    // AI VALIDATION TESTS
    // =========================================================================

    describe('POST /api/assessment/:projectId/ai/validate', () => {
        it('should validate score consistency', async () => {
            const response = await request(app)
                .post('/api/assessment/project-123/ai/validate')
                .send({});

            expect(response.status).toBe(200);
            expect(mockAiAssessmentPartner.validateScoreConsistency).toHaveBeenCalled();
        });

        it('should return 404 for non-existent assessment', async () => {
            mockAssessmentService.getAssessment.mockResolvedValue(null);

            const response = await request(app)
                .post('/api/assessment/unknown/ai/validate')
                .send({});

            expect(response.status).toBe(404);
        });
    });

    // =========================================================================
    // AI GAP ANALYSIS TESTS
    // =========================================================================

    describe('POST /api/assessment/:projectId/ai/gap/:axisId', () => {
        it('should generate gap analysis for axis', async () => {
            const response = await request(app)
                .post('/api/assessment/project-123/ai/gap/processes')
                .send({ currentScore: 3, targetScore: 6 });

            expect(response.status).toBe(200);
            expect(mockAiAssessmentPartner.generateGapAnalysis).toHaveBeenCalledWith(
                'processes', 3, 6, ''
            );
        });

        it('should require currentScore and targetScore', async () => {
            const response = await request(app)
                .post('/api/assessment/project-123/ai/gap/processes')
                .send({ currentScore: 3 });

            expect(response.status).toBe(400);
        });

        it('should include justification when provided', async () => {
            const response = await request(app)
                .post('/api/assessment/project-123/ai/gap/processes')
                .send({ currentScore: 3, targetScore: 6, justification: 'Test justification' });

            expect(response.status).toBe(200);
            expect(mockAiAssessmentPartner.generateGapAnalysis).toHaveBeenCalledWith(
                'processes', 3, 6, 'Test justification'
            );
        });
    });

    // =========================================================================
    // AI INSIGHTS TESTS
    // =========================================================================

    describe('GET /api/assessment/:projectId/ai/insights', () => {
        it('should return proactive insights', async () => {
            mockAiAssessmentPartner.generateProactiveInsights.mockResolvedValue({
                insights: [
                    { type: 'STRENGTH', axis: 'processes' }
                ]
            });

            const response = await request(app)
                .get('/api/assessment/project-123/ai/insights');

            expect(response.status).toBe(200);
            expect(response.body.insights).toBeDefined();
        });

        it('should return 404 for non-existent assessment', async () => {
            mockAssessmentService.getAssessment.mockResolvedValue(null);

            const response = await request(app)
                .get('/api/assessment/unknown/ai/insights');

            expect(response.status).toBe(404);
        });
    });

    // =========================================================================
    // AI SUGGESTION TESTS
    // =========================================================================

    describe('POST /api/assessment/:projectId/ai/suggest-justification', () => {
        it('should suggest justification for axis', async () => {
            const response = await request(app)
                .post('/api/assessment/project-123/ai/suggest-justification')
                .send({ axisId: 'processes', score: 4 });

            expect(response.status).toBe(200);
            expect(response.body.suggestion).toBeDefined();
        });

        it('should require axisId and score', async () => {
            const response = await request(app)
                .post('/api/assessment/project-123/ai/suggest-justification')
                .send({ axisId: 'processes' });

            expect(response.status).toBe(400);
        });
    });

    describe('POST /api/assessment/:projectId/ai/suggest-evidence', () => {
        it('should suggest evidence for axis', async () => {
            const response = await request(app)
                .post('/api/assessment/project-123/ai/suggest-evidence')
                .send({ axisId: 'processes', score: 4 });

            expect(response.status).toBe(200);
            expect(response.body.evidence).toBeDefined();
        });

        it('should require axisId and score', async () => {
            const response = await request(app)
                .post('/api/assessment/project-123/ai/suggest-evidence')
                .send({});

            expect(response.status).toBe(400);
        });
    });

    describe('POST /api/assessment/:projectId/ai/suggest-target', () => {
        it('should suggest target score', async () => {
            const response = await request(app)
                .post('/api/assessment/project-123/ai/suggest-target')
                .send({ axisId: 'processes', currentScore: 3 });

            expect(response.status).toBe(200);
            expect(response.body.suggestedTarget).toBeDefined();
        });

        it('should accept ambition level parameter', async () => {
            const response = await request(app)
                .post('/api/assessment/project-123/ai/suggest-target')
                .send({ axisId: 'processes', currentScore: 3, ambitionLevel: 'aggressive' });

            expect(response.status).toBe(200);
            expect(mockAiAssessmentPartner.suggestTargetScore).toHaveBeenCalledWith(
                'processes', 3, 'aggressive', expect.any(Object)
            );
        });
    });

    // =========================================================================
    // AI TEXT PROCESSING TESTS
    // =========================================================================

    describe('POST /api/assessment/:projectId/ai/correct-text', () => {
        it('should correct text', async () => {
            const response = await request(app)
                .post('/api/assessment/project-123/ai/correct-text')
                .send({ text: 'Some text to correct' });

            expect(response.status).toBe(200);
            expect(response.body.correctedText).toBeDefined();
        });

        it('should require text parameter', async () => {
            const response = await request(app)
                .post('/api/assessment/project-123/ai/correct-text')
                .send({});

            expect(response.status).toBe(400);
        });
    });

    describe('POST /api/assessment/:projectId/ai/autocomplete', () => {
        it('should autocomplete text', async () => {
            const response = await request(app)
                .post('/api/assessment/project-123/ai/autocomplete')
                .send({ partialText: 'Organization has', axisId: 'processes', score: 4 });

            expect(response.status).toBe(200);
            expect(response.body.completion).toBeDefined();
        });

        it('should require all parameters', async () => {
            const response = await request(app)
                .post('/api/assessment/project-123/ai/autocomplete')
                .send({ partialText: 'Organization has' });

            expect(response.status).toBe(400);
        });
    });

    // =========================================================================
    // AI FORM HELPER TESTS
    // =========================================================================

    describe('POST /api/assessment/:projectId/ai/fill-missing', () => {
        it('should fill missing fields', async () => {
            const response = await request(app)
                .post('/api/assessment/project-123/ai/fill-missing')
                .send({ strategy: 'suggest-only' });

            expect(response.status).toBe(200);
            expect(mockAiFormHelper.fillMissingFields).toHaveBeenCalled();
        });

        it('should deny access for viewer', async () => {
            currentUser = { ...currentUser, role: 'VIEWER' };

            const response = await request(app)
                .post('/api/assessment/project-123/ai/fill-missing')
                .send({});

            expect(response.status).toBe(403);
        });

        it('should return 404 for non-existent assessment', async () => {
            mockAssessmentService.getAssessment.mockResolvedValue(null);

            const response = await request(app)
                .post('/api/assessment/project-123/ai/fill-missing')
                .send({});

            expect(response.status).toBe(404);
        });
    });

    describe('POST /api/assessment/:projectId/ai/review-justifications', () => {
        it('should review all justifications', async () => {
            const response = await request(app)
                .post('/api/assessment/project-123/ai/review-justifications')
                .send({});

            expect(response.status).toBe(200);
            expect(mockAiFormHelper.reviewAllJustifications).toHaveBeenCalled();
        });

        it('should return 404 for non-existent assessment', async () => {
            mockAssessmentService.getAssessment.mockResolvedValue(null);

            const response = await request(app)
                .post('/api/assessment/unknown/ai/review-justifications')
                .send({});

            expect(response.status).toBe(404);
        });
    });

    // =========================================================================
    // AI REPORT GENERATION TESTS
    // =========================================================================

    describe('POST /api/assessment/:projectId/ai/reports/full', () => {
        it('should generate full report', async () => {
            const response = await request(app)
                .post('/api/assessment/project-123/ai/reports/full')
                .send({ organizationName: 'Test Corp', language: 'pl' });

            expect(response.status).toBe(200);
            expect(response.body.reportType).toBe('full_assessment');
        });

        it('should return 404 for non-existent assessment', async () => {
            mockAssessmentService.getAssessment.mockResolvedValue(null);

            const response = await request(app)
                .post('/api/assessment/unknown/ai/reports/full')
                .send({});

            expect(response.status).toBe(404);
        });
    });

    describe('POST /api/assessment/:projectId/ai/reports/stakeholder', () => {
        it('should generate stakeholder report', async () => {
            const response = await request(app)
                .post('/api/assessment/project-123/ai/reports/stakeholder')
                .send({ stakeholderRole: 'CTO' });

            expect(response.status).toBe(200);
            expect(response.body.stakeholderRole).toBe('CTO');
        });

        it('should require stakeholderRole', async () => {
            const response = await request(app)
                .post('/api/assessment/project-123/ai/reports/stakeholder')
                .send({});

            expect(response.status).toBe(400);
        });
    });

    // =========================================================================
    // AI INITIATIVE GENERATION TESTS
    // =========================================================================

    describe('POST /api/assessment/:projectId/ai/generate-initiatives', () => {
        it('should generate initiatives from assessment', async () => {
            const response = await request(app)
                .post('/api/assessment/project-123/ai/generate-initiatives')
                .send({});

            expect(response.status).toBe(200);
            expect(mockAiAssessmentPartner.generateInitiativesFromGaps).toHaveBeenCalled();
        });

        it('should return 404 for non-existent assessment', async () => {
            mockAssessmentService.getAssessment.mockResolvedValue(null);

            const response = await request(app)
                .post('/api/assessment/unknown/ai/generate-initiatives')
                .send({});

            expect(response.status).toBe(404);
        });
    });

    describe('POST /api/assessment/:projectId/ai/prioritize-initiatives', () => {
        it('should prioritize initiatives', async () => {
            const response = await request(app)
                .post('/api/assessment/project-123/ai/prioritize-initiatives')
                .send({ initiatives: [{ name: 'Test' }] });

            expect(response.status).toBe(200);
            expect(mockAiAssessmentPartner.prioritizeInitiatives).toHaveBeenCalled();
        });

        it('should require initiatives array', async () => {
            const response = await request(app)
                .post('/api/assessment/project-123/ai/prioritize-initiatives')
                .send({});

            expect(response.status).toBe(400);
        });
    });

    describe('POST /api/assessment/:projectId/ai/estimate-roi', () => {
        it('should estimate ROI for initiative', async () => {
            const response = await request(app)
                .post('/api/assessment/project-123/ai/estimate-roi')
                .send({ initiative: { name: 'Test Initiative' } });

            expect(response.status).toBe(200);
            expect(mockAiAssessmentPartner.estimateInitiativeROI).toHaveBeenCalled();
        });

        it('should require initiative object', async () => {
            const response = await request(app)
                .post('/api/assessment/project-123/ai/estimate-roi')
                .send({});

            expect(response.status).toBe(400);
        });
    });

    // =========================================================================
    // ERROR HANDLING TESTS
    // =========================================================================

    describe('Error Handling', () => {
        it('should handle service errors gracefully', async () => {
            mockAssessmentService.getAssessment.mockRejectedValue(new Error('Database error'));

            const response = await request(app)
                .get('/api/assessment/project-123');

            expect(response.status).toBe(500);
            expect(response.body.error).toBeDefined();
        });

        it('should handle AI service errors gracefully', async () => {
            mockAiAssessmentPartner.getAssessmentGuidance.mockRejectedValue(new Error('AI error'));

            const response = await request(app)
                .post('/api/assessment/project-123/ai/guidance')
                .send({ axisId: 'processes', currentScore: 3 });

            expect(response.status).toBe(500);
            expect(response.body.error).toBeDefined();
        });
    });
});



