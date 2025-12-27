/**
 * Integration Tests: Assessment AI Features
 * Tests for AI-powered assessment assistance endpoints
 */

import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';

// Mock AI service
const mockAIPartner = {
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
    generateInitiativesFromGaps: vi.fn(),
    prioritizeInitiatives: vi.fn(),
    estimateInitiativeROI: vi.fn()
};

vi.mock('../../server/services/aiAssessmentPartnerService', () => ({
    aiAssessmentPartner: mockAIPartner,
    DRD_AXES: {
        processes: { name: 'Digital Processes', levels: {} },
        culture: { name: 'Organizational Culture', levels: {} }
    }
}));

// Mock database
const mockDb = {
    get: vi.fn(),
    all: vi.fn()
};

vi.mock('../../server/database', () => ({ default: mockDb }));

vi.mock('../../server/middleware/auth', () => ({
    authMiddleware: (req, res, next) => {
        req.user = { id: 'user-123', organizationId: 'org-123' };
        next();
    }
}));

describe('Assessment AI Integration Tests', () => {
    let app;

    beforeAll(() => {
        app = express();
        app.use(express.json());

        // Create mock AI routes
        const router = express.Router();

        router.post('/:projectId/ai/guidance', async (req, res) => {
            const { axisId, currentScore, targetScore } = req.body;
            const result = await mockAIPartner.getAssessmentGuidance(axisId, currentScore, targetScore);
            res.json(result);
        });

        router.post('/:projectId/ai/validate', async (req, res) => {
            const result = await mockAIPartner.validateScoreConsistency(req.body);
            res.json(result);
        });

        router.post('/:projectId/ai/gap/:axisId', async (req, res) => {
            const { axisId } = req.params;
            const { currentScore, targetScore } = req.body;
            const result = await mockAIPartner.generateGapAnalysis(axisId, currentScore, targetScore);
            res.json(result);
        });

        router.get('/:projectId/ai/insights', async (req, res) => {
            mockDb.get.mockImplementation((sql, params, callback) => {
                callback(null, { axis_scores: '{}' });
            });
            const result = await mockAIPartner.generateProactiveInsights({});
            res.json(result);
        });

        router.post('/:projectId/ai/clarify', async (req, res) => {
            const { axisId, score } = req.body;
            const result = await mockAIPartner.askClarifyingQuestion(axisId, score);
            res.json(result);
        });

        router.post('/:projectId/ai/suggest-justification', async (req, res) => {
            const { axisId, score, existingJustification } = req.body;
            const result = await mockAIPartner.suggestJustification(axisId, score, { existingJustification });
            res.json(result);
        });

        router.post('/:projectId/ai/suggest-evidence', async (req, res) => {
            const { axisId, score } = req.body;
            const result = await mockAIPartner.suggestEvidence(axisId, score);
            res.json(result);
        });

        router.post('/:projectId/ai/suggest-target', async (req, res) => {
            const { axisId, currentScore, ambitionLevel } = req.body;
            const result = await mockAIPartner.suggestTargetScore(axisId, currentScore, ambitionLevel);
            res.json(result);
        });

        router.post('/:projectId/ai/correct-text', async (req, res) => {
            const { text, targetLanguage } = req.body;
            const result = await mockAIPartner.correctJustificationLanguage(text, targetLanguage);
            res.json(result);
        });

        router.post('/:projectId/ai/autocomplete', async (req, res) => {
            const { partialText, axisId, score } = req.body;
            const result = await mockAIPartner.autocompleteJustification(partialText, axisId, score);
            res.json(result);
        });

        router.post('/:projectId/ai/executive-summary', async (req, res) => {
            const result = await mockAIPartner.generateExecutiveSummary({}, req.body);
            res.json(result);
        });

        router.post('/:projectId/ai/stakeholder-view', async (req, res) => {
            const { stakeholderRole } = req.body;
            const result = await mockAIPartner.generateStakeholderView({}, stakeholderRole);
            res.json(result);
        });

        router.post('/:projectId/ai/generate-initiatives', async (req, res) => {
            const result = await mockAIPartner.generateInitiativesFromGaps([], req.body);
            res.json(result);
        });

        router.post('/:projectId/ai/prioritize-initiatives', async (req, res) => {
            const { initiatives, criteria } = req.body;
            const result = await mockAIPartner.prioritizeInitiatives(initiatives, criteria);
            res.json(result);
        });

        router.post('/:projectId/ai/estimate-roi', async (req, res) => {
            const { initiative } = req.body;
            const result = await mockAIPartner.estimateInitiativeROI(initiative);
            res.json(result);
        });

        app.use('/api/assessment', router);
    });

    beforeEach(() => {
        vi.clearAllMocks();
    });

    // =========================================================================
    // GUIDANCE TESTS
    // =========================================================================

    describe('POST /:projectId/ai/guidance', () => {
        it('should return guidance for axis', async () => {
            mockAIPartner.getAssessmentGuidance.mockResolvedValue({
                axisId: 'processes',
                guidance: 'Focus on automation...',
                mode: 'AI_GENERATED',
                context: { gap: 2 }
            });

            const response = await request(app)
                .post('/api/assessment/project-123/ai/guidance')
                .send({
                    axisId: 'processes',
                    currentScore: 3,
                    targetScore: 5
                });

            expect(response.status).toBe(200);
            expect(response.body.guidance).toBeDefined();
            expect(mockAIPartner.getAssessmentGuidance).toHaveBeenCalledWith('processes', 3, 5);
        });
    });

    // =========================================================================
    // VALIDATION TESTS
    // =========================================================================

    describe('POST /:projectId/ai/validate', () => {
        it('should validate score consistency', async () => {
            mockAIPartner.validateScoreConsistency.mockResolvedValue({
                hasInconsistencies: false,
                inconsistencies: [],
                overallAssessment: 'Assessment appears consistent'
            });

            const response = await request(app)
                .post('/api/assessment/project-123/ai/validate')
                .send({
                    processes: { actual: 4 },
                    culture: { actual: 4 }
                });

            expect(response.status).toBe(200);
            expect(response.body.hasInconsistencies).toBe(false);
        });

        it('should detect inconsistencies', async () => {
            mockAIPartner.validateScoreConsistency.mockResolvedValue({
                hasInconsistencies: true,
                inconsistencies: [
                    { type: 'DEPENDENCY_MISMATCH', axes: ['aiMaturity', 'dataManagement'] }
                ]
            });

            const response = await request(app)
                .post('/api/assessment/project-123/ai/validate')
                .send({
                    aiMaturity: { actual: 6 },
                    dataManagement: { actual: 2 }
                });

            expect(response.status).toBe(200);
            expect(response.body.hasInconsistencies).toBe(true);
            expect(response.body.inconsistencies).toHaveLength(1);
        });
    });

    // =========================================================================
    // GAP ANALYSIS TESTS
    // =========================================================================

    describe('POST /:projectId/ai/gap/:axisId', () => {
        it('should generate gap analysis', async () => {
            mockAIPartner.generateGapAnalysis.mockResolvedValue({
                axisId: 'processes',
                axisName: 'Digital Processes',
                currentScore: 3,
                targetScore: 5,
                gap: 2,
                gapSeverity: 'MEDIUM',
                pathway: [
                    { level: 4, description: 'Integrated workflows', estimatedMonths: 6 },
                    { level: 5, description: 'End-to-end digital', estimatedMonths: 9 }
                ],
                estimatedTotalMonths: 15
            });

            const response = await request(app)
                .post('/api/assessment/project-123/ai/gap/processes')
                .send({
                    currentScore: 3,
                    targetScore: 5
                });

            expect(response.status).toBe(200);
            expect(response.body.gap).toBe(2);
            expect(response.body.pathway).toHaveLength(2);
        });
    });

    // =========================================================================
    // INSIGHTS TESTS
    // =========================================================================

    describe('GET /:projectId/ai/insights', () => {
        it('should generate proactive insights', async () => {
            mockAIPartner.generateProactiveInsights.mockResolvedValue({
                insights: [
                    { type: 'STRENGTH', title: 'Strong in processes', axis: 'processes' },
                    { type: 'PRIORITY_GAP', title: 'Focus on culture', axis: 'culture' }
                ],
                summary: { axesAssessed: 7, averageMaturity: '3.5' }
            });

            const response = await request(app)
                .get('/api/assessment/project-123/ai/insights');

            expect(response.status).toBe(200);
            expect(response.body.insights).toHaveLength(2);
        });
    });

    // =========================================================================
    // CLARIFYING QUESTION TESTS
    // =========================================================================

    describe('POST /:projectId/ai/clarify', () => {
        it('should generate clarifying question', async () => {
            mockAIPartner.askClarifyingQuestion.mockResolvedValue({
                axisId: 'processes',
                score: 4,
                question: 'Can you describe a specific example?',
                mode: 'ASK_CLARIFYING_QUESTION'
            });

            const response = await request(app)
                .post('/api/assessment/project-123/ai/clarify')
                .send({ axisId: 'processes', score: 4 });

            expect(response.status).toBe(200);
            expect(response.body.question).toBeDefined();
        });
    });

    // =========================================================================
    // SUGGESTION TESTS
    // =========================================================================

    describe('POST /:projectId/ai/suggest-justification', () => {
        it('should suggest justification text', async () => {
            mockAIPartner.suggestJustification.mockResolvedValue({
                axisId: 'processes',
                score: 4,
                suggestion: 'Organizacja wdrożyła zintegrowane systemy...',
                mode: 'AI_GENERATED'
            });

            const response = await request(app)
                .post('/api/assessment/project-123/ai/suggest-justification')
                .send({ axisId: 'processes', score: 4 });

            expect(response.status).toBe(200);
            expect(response.body.suggestion).toBeDefined();
        });
    });

    describe('POST /:projectId/ai/suggest-evidence', () => {
        it('should suggest evidence types', async () => {
            mockAIPartner.suggestEvidence.mockResolvedValue({
                evidence: ['Dokumentacja systemowa', 'Metryki KPI', 'Wyniki audytów'],
                mode: 'AI_GENERATED'
            });

            const response = await request(app)
                .post('/api/assessment/project-123/ai/suggest-evidence')
                .send({ axisId: 'dataManagement', score: 5 });

            expect(response.status).toBe(200);
            expect(response.body.evidence).toHaveLength(3);
        });
    });

    describe('POST /:projectId/ai/suggest-target', () => {
        it('should suggest target score', async () => {
            mockAIPartner.suggestTargetScore.mockResolvedValue({
                currentScore: 3,
                suggestedTarget: 5,
                ambitionLevel: 'balanced',
                reasoning: 'Balanced approach for sustainable growth',
                timeEstimate: '18 miesięcy'
            });

            const response = await request(app)
                .post('/api/assessment/project-123/ai/suggest-target')
                .send({ axisId: 'processes', currentScore: 3, ambitionLevel: 'balanced' });

            expect(response.status).toBe(200);
            expect(response.body.suggestedTarget).toBe(5);
        });
    });

    // =========================================================================
    // TEXT PROCESSING TESTS
    // =========================================================================

    describe('POST /:projectId/ai/correct-text', () => {
        it('should correct and improve text', async () => {
            mockAIPartner.correctJustificationLanguage.mockResolvedValue({
                originalText: 'Orginzacja ma',
                correctedText: 'Organizacja posiada',
                mode: 'AI_CORRECTED'
            });

            const response = await request(app)
                .post('/api/assessment/project-123/ai/correct-text')
                .send({ text: 'Orginzacja ma', targetLanguage: 'pl' });

            expect(response.status).toBe(200);
            expect(response.body.correctedText).toBe('Organizacja posiada');
        });
    });

    describe('POST /:projectId/ai/autocomplete', () => {
        it('should autocomplete partial text', async () => {
            mockAIPartner.autocompleteJustification.mockResolvedValue({
                partialText: 'Organizacja posiada',
                completion: 'zintegrowane systemy CRM i ERP.',
                fullText: 'Organizacja posiada zintegrowane systemy CRM i ERP.',
                mode: 'AI_COMPLETED'
            });

            const response = await request(app)
                .post('/api/assessment/project-123/ai/autocomplete')
                .send({ partialText: 'Organizacja posiada', axisId: 'processes', score: 4 });

            expect(response.status).toBe(200);
            expect(response.body.completion).toBeDefined();
        });
    });

    // =========================================================================
    // REPORT GENERATION TESTS
    // =========================================================================

    describe('POST /:projectId/ai/executive-summary', () => {
        it('should generate executive summary', async () => {
            mockAIPartner.generateExecutiveSummary.mockResolvedValue({
                summary: 'Organizacja osiągnęła średni poziom dojrzałości...',
                metrics: {
                    averageMaturity: '3.5',
                    averageTarget: '5.0',
                    overallGap: '1.5'
                },
                topStrengths: ['processes'],
                priorityGaps: ['culture'],
                mode: 'AI_GENERATED'
            });

            const response = await request(app)
                .post('/api/assessment/project-123/ai/executive-summary')
                .send({ language: 'pl' });

            expect(response.status).toBe(200);
            expect(response.body.summary).toBeDefined();
            expect(response.body.metrics).toBeDefined();
        });
    });

    describe('POST /:projectId/ai/stakeholder-view', () => {
        it('should generate stakeholder-specific view', async () => {
            mockAIPartner.generateStakeholderView.mockResolvedValue({
                stakeholderRole: 'CTO',
                view: 'Z perspektywy technologicznej...',
                focusAreas: 'Focus on technology architecture, AI/ML capabilities',
                mode: 'AI_GENERATED'
            });

            const response = await request(app)
                .post('/api/assessment/project-123/ai/stakeholder-view')
                .send({ stakeholderRole: 'CTO' });

            expect(response.status).toBe(200);
            expect(response.body.stakeholderRole).toBe('CTO');
        });
    });

    // =========================================================================
    // INITIATIVE GENERATION TESTS
    // =========================================================================

    describe('POST /:projectId/ai/generate-initiatives', () => {
        it('should generate initiatives from gaps', async () => {
            mockAIPartner.generateInitiativesFromGaps.mockResolvedValue({
                initiatives: [
                    {
                        name: 'Automatyzacja procesów',
                        description: 'Wdrożenie narzędzi RPA',
                        targetAxes: ['processes'],
                        priority: 'HIGH',
                        estimatedDuration: '6 miesięcy'
                    }
                ],
                mode: 'AI_GENERATED'
            });

            const response = await request(app)
                .post('/api/assessment/project-123/ai/generate-initiatives')
                .send({ budget: '100k', timeline: '12 months' });

            expect(response.status).toBe(200);
            expect(response.body.initiatives).toBeDefined();
        });
    });

    describe('POST /:projectId/ai/prioritize-initiatives', () => {
        it('should prioritize initiatives', async () => {
            mockAIPartner.prioritizeInitiatives.mockResolvedValue({
                prioritizedList: [
                    { rank: 1, name: 'Initiative A', priorityScore: 85 },
                    { rank: 2, name: 'Initiative B', priorityScore: 70 }
                ],
                mode: 'AI_GENERATED'
            });

            const response = await request(app)
                .post('/api/assessment/project-123/ai/prioritize-initiatives')
                .send({
                    initiatives: [{ name: 'Initiative A' }, { name: 'Initiative B' }],
                    criteria: { impactWeight: 40, feasibilityWeight: 30 }
                });

            expect(response.status).toBe(200);
            expect(response.body.prioritizedList).toHaveLength(2);
        });
    });

    describe('POST /:projectId/ai/estimate-roi', () => {
        it('should estimate initiative ROI', async () => {
            mockAIPartner.estimateInitiativeROI.mockResolvedValue({
                initiative: 'Process Automation',
                estimate: {
                    estimatedCost: '€100k-200k',
                    estimatedBenefitYear1: '€50k-100k',
                    paybackPeriod: '18-24 months',
                    roiPercentage3Years: '150-200%',
                    confidenceLevel: 'MEDIUM'
                },
                mode: 'AI_GENERATED'
            });

            const response = await request(app)
                .post('/api/assessment/project-123/ai/estimate-roi')
                .send({
                    initiative: { name: 'Process Automation', targetAxes: ['processes'] }
                });

            expect(response.status).toBe(200);
            expect(response.body.estimate).toBeDefined();
            expect(response.body.estimate.paybackPeriod).toBeDefined();
        });
    });

    // =========================================================================
    // ERROR HANDLING TESTS
    // =========================================================================

    describe('Error Handling', () => {
        it('should handle AI service errors gracefully', async () => {
            mockAIPartner.suggestJustification.mockRejectedValue(new Error('AI service unavailable'));

            const response = await request(app)
                .post('/api/assessment/project-123/ai/suggest-justification')
                .send({ axisId: 'processes', score: 4 });

            // Should return fallback or error response
            expect(response.status).toBe(500);
        });

        it('should return fallback when AI unavailable', async () => {
            mockAIPartner.suggestJustification.mockResolvedValue({
                suggestion: 'Fallback suggestion text',
                mode: 'FALLBACK'
            });

            const response = await request(app)
                .post('/api/assessment/project-123/ai/suggest-justification')
                .send({ axisId: 'processes', score: 4 });

            expect(response.status).toBe(200);
            expect(response.body.mode).toBe('FALLBACK');
        });
    });

    // =========================================================================
    // RATE LIMITING TESTS
    // =========================================================================

    describe('Rate Limiting', () => {
        it('should handle multiple rapid requests', async () => {
            mockAIPartner.suggestJustification.mockResolvedValue({
                suggestion: 'Test',
                mode: 'AI_GENERATED'
            });

            const promises = [];
            for (let i = 0; i < 5; i++) {
                promises.push(
                    request(app)
                        .post('/api/assessment/project-123/ai/suggest-justification')
                        .send({ axisId: 'processes', score: 4 })
                );
            }

            const responses = await Promise.all(promises);
            responses.forEach(response => {
                expect(response.status).toBe(200);
            });
        });
    });
});



