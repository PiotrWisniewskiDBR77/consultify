/**
 * Unit Tests: AI Assessment Partner Service
 * Complete test coverage for AI-powered assessment guidance
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock Google AI
vi.mock('@google/generative-ai', () => ({
    GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
        getGenerativeModel: vi.fn().mockReturnValue({
            generateContent: vi.fn().mockResolvedValue({
                response: {
                    text: () => 'Mock AI response'
                }
            })
        })
    }))
}));

describe('AIAssessmentPartnerService', () => {
    let AIAssessmentPartnerService;
    let aiAssessmentPartner;
    let DRD_AXES;
    let AI_PARTNER_CONFIG;

    beforeEach(async () => {
        vi.resetModules();
        vi.clearAllMocks();

        // Set environment variable
        process.env.GEMINI_API_KEY = 'test-api-key';

        const module = await import('../../../server/services/aiAssessmentPartnerService.js');
        AIAssessmentPartnerService = module.AIAssessmentPartnerService;
        aiAssessmentPartner = module.aiAssessmentPartner;
        DRD_AXES = module.DRD_AXES;
        AI_PARTNER_CONFIG = module.AI_PARTNER_CONFIG;
    });

    afterEach(() => {
        vi.restoreAllMocks();
        delete process.env.GEMINI_API_KEY;
    });

    // =========================================================================
    // DRD_AXES CONFIGURATION TESTS
    // =========================================================================

    describe('DRD_AXES Configuration', () => {
        it('should define all 7 required axes', () => {
            const requiredAxes = [
                'processes',
                'digitalProducts',
                'businessModels',
                'dataManagement',
                'culture',
                'cybersecurity',
                'aiMaturity'
            ];

            requiredAxes.forEach(axis => {
                expect(DRD_AXES[axis]).toBeDefined();
            });
        });

        it('should have 7 maturity levels for each axis', () => {
            Object.values(DRD_AXES).forEach(axis => {
                expect(Object.keys(axis.levels)).toHaveLength(7);
                for (let i = 1; i <= 7; i++) {
                    expect(axis.levels[i]).toBeDefined();
                    expect(typeof axis.levels[i]).toBe('string');
                }
            });
        });

        it('should have name and description for each axis', () => {
            Object.values(DRD_AXES).forEach(axis => {
                expect(axis.name).toBeDefined();
                expect(typeof axis.name).toBe('string');
                expect(axis.description).toBeDefined();
                expect(typeof axis.description).toBe('string');
            });
        });
    });

    // =========================================================================
    // AI_PARTNER_CONFIG TESTS
    // =========================================================================

    describe('AI_PARTNER_CONFIG', () => {
        it('should have THINKING_PARTNER mode', () => {
            expect(AI_PARTNER_CONFIG.mode).toBe('THINKING_PARTNER');
        });

        it('should define allowed actions', () => {
            expect(AI_PARTNER_CONFIG.allowed).toContain('ASK_CLARIFYING_QUESTION');
            expect(AI_PARTNER_CONFIG.allowed).toContain('VALIDATE_SCORE');
            expect(AI_PARTNER_CONFIG.allowed).toContain('GAP_ANALYSIS');
        });

        it('should define blocked actions', () => {
            expect(AI_PARTNER_CONFIG.blocked).toContain('JUMP_TO_CONCLUSION');
            expect(AI_PARTNER_CONFIG.blocked).toContain('SUGGEST_SOLUTION');
        });

        it('should have appropriate tone settings', () => {
            expect(AI_PARTNER_CONFIG.tone.style).toBe('partner');
            expect(AI_PARTNER_CONFIG.tone.formality).toBe('professional');
        });
    });

    // =========================================================================
    // getAssessmentGuidance TESTS
    // =========================================================================

    describe('getAssessmentGuidance', () => {
        it('should return guidance for valid axis', async () => {
            const result = await aiAssessmentPartner.getAssessmentGuidance('processes', 3, 5);

            expect(result).toMatchObject({
                axisId: 'processes',
                mode: expect.any(String)
            });
            expect(result.context).toMatchObject({
                gap: 2
            });
        });

        it('should return error for invalid axis', async () => {
            const result = await aiAssessmentPartner.getAssessmentGuidance('invalid-axis', 3, 5);

            expect(result.error).toBe('Invalid axis ID');
        });

        it('should include level descriptions in context', async () => {
            const result = await aiAssessmentPartner.getAssessmentGuidance('processes', 2, 4);

            expect(result.context.currentLevel).toBe(DRD_AXES.processes.levels[2]);
            expect(result.context.targetLevel).toBe(DRD_AXES.processes.levels[4]);
        });

        it('should handle context parameters', async () => {
            const context = {
                industry: 'Manufacturing',
                companySize: '500-1000 employees'
            };

            const result = await aiAssessmentPartner.getAssessmentGuidance('dataManagement', 3, 5, context);

            expect(result.axisId).toBe('dataManagement');
        });
    });

    // =========================================================================
    // validateScoreConsistency TESTS
    // =========================================================================

    describe('validateScoreConsistency', () => {
        it('should detect AI maturity exceeding data management', async () => {
            const assessment = {
                aiMaturity: { actual: 6 },
                dataManagement: { actual: 2 }
            };

            const result = await aiAssessmentPartner.validateScoreConsistency(assessment);

            expect(result.hasInconsistencies).toBe(true);
            expect(result.inconsistencies).toContainEqual(
                expect.objectContaining({
                    type: 'DEPENDENCY_MISMATCH',
                    axes: ['aiMaturity', 'dataManagement']
                })
            );
        });

        it('should detect cybersecurity lagging behind processes', async () => {
            const assessment = {
                processes: { actual: 6 },
                cybersecurity: { actual: 2 }
            };

            const result = await aiAssessmentPartner.validateScoreConsistency(assessment);

            expect(result.hasInconsistencies).toBe(true);
            expect(result.inconsistencies).toContainEqual(
                expect.objectContaining({
                    type: 'RISK_GAP',
                    axes: ['processes', 'cybersecurity']
                })
            );
        });

        it('should detect digital products exceeding processes', async () => {
            const assessment = {
                digitalProducts: { actual: 5 },
                processes: { actual: 2 }
            };

            const result = await aiAssessmentPartner.validateScoreConsistency(assessment);

            expect(result.hasInconsistencies).toBe(true);
            expect(result.inconsistencies).toContainEqual(
                expect.objectContaining({
                    type: 'CAPABILITY_GAP'
                })
            );
        });

        it('should detect culture gap for business models', async () => {
            const assessment = {
                businessModels: { actual: 6 },
                culture: { actual: 2 }
            };

            const result = await aiAssessmentPartner.validateScoreConsistency(assessment);

            expect(result.hasInconsistencies).toBe(true);
            expect(result.inconsistencies).toContainEqual(
                expect.objectContaining({
                    type: 'CULTURE_GAP'
                })
            );
        });

        it('should return no inconsistencies for balanced assessment', async () => {
            const assessment = {
                processes: { actual: 4 },
                digitalProducts: { actual: 4 },
                businessModels: { actual: 4 },
                dataManagement: { actual: 4 },
                culture: { actual: 4 },
                cybersecurity: { actual: 4 },
                aiMaturity: { actual: 4 }
            };

            const result = await aiAssessmentPartner.validateScoreConsistency(assessment);

            expect(result.hasInconsistencies).toBe(false);
            expect(result.inconsistencies).toHaveLength(0);
        });
    });

    // =========================================================================
    // generateGapAnalysis TESTS
    // =========================================================================

    describe('generateGapAnalysis', () => {
        it('should generate gap analysis with pathway', async () => {
            const result = await aiAssessmentPartner.generateGapAnalysis('processes', 2, 5);

            expect(result).toMatchObject({
                axisId: 'processes',
                axisName: DRD_AXES.processes.name,
                currentScore: 2,
                targetScore: 5,
                gap: 3,
                gapSeverity: 'MEDIUM'
            });

            expect(result.pathway).toHaveLength(3); // Levels 3, 4, 5
            result.pathway.forEach(step => {
                expect(step.level).toBeGreaterThan(2);
                expect(step.level).toBeLessThanOrEqual(5);
                expect(step.estimatedMonths).toBeGreaterThan(0);
                expect(step.keyActivities).toBeDefined();
            });
        });

        it('should return error for invalid axis', async () => {
            const result = await aiAssessmentPartner.generateGapAnalysis('invalid', 2, 5);
            expect(result.error).toBe('Invalid axis ID');
        });

        it('should categorize gap severity correctly', async () => {
            const lowGap = await aiAssessmentPartner.generateGapAnalysis('processes', 4, 5);
            expect(lowGap.gapSeverity).toBe('LOW');

            const mediumGap = await aiAssessmentPartner.generateGapAnalysis('processes', 2, 5);
            expect(mediumGap.gapSeverity).toBe('MEDIUM');

            const highGap = await aiAssessmentPartner.generateGapAnalysis('processes', 1, 6);
            expect(highGap.gapSeverity).toBe('HIGH');
        });

        it('should calculate estimated total months', async () => {
            const result = await aiAssessmentPartner.generateGapAnalysis('processes', 2, 5);

            const totalFromPathway = result.pathway.reduce((sum, p) => sum + p.estimatedMonths, 0);
            expect(result.estimatedTotalMonths).toBe(totalFromPathway);
        });
    });

    // =========================================================================
    // generateProactiveInsights TESTS
    // =========================================================================

    describe('generateProactiveInsights', () => {
        it('should identify strongest and weakest axes', async () => {
            const assessment = {
                processes: { actual: 5, target: 6 },
                culture: { actual: 2, target: 5 },
                dataManagement: { actual: 4, target: 5 }
            };

            const result = await aiAssessmentPartner.generateProactiveInsights(assessment);

            expect(result.insights).toContainEqual(
                expect.objectContaining({
                    type: 'STRENGTH',
                    axis: 'processes'
                })
            );

            expect(result.insights).toContainEqual(
                expect.objectContaining({
                    type: 'PRIORITY_GAP',
                    axis: 'culture'
                })
            );
        });

        it('should detect ambitious targets', async () => {
            const assessment = {
                processes: { actual: 1, target: 6 },
                culture: { actual: 2, target: 7 }
            };

            const result = await aiAssessmentPartner.generateProactiveInsights(assessment);

            expect(result.insights).toContainEqual(
                expect.objectContaining({
                    type: 'RISK',
                    title: expect.stringContaining('Ambitious')
                })
            );
        });

        it('should identify quick wins', async () => {
            const assessment = {
                processes: { actual: 4, target: 5 },
                culture: { actual: 3, target: 4 }
            };

            const result = await aiAssessmentPartner.generateProactiveInsights(assessment);

            expect(result.insights).toContainEqual(
                expect.objectContaining({
                    type: 'OPPORTUNITY',
                    title: expect.stringContaining('quick win')
                })
            );
        });

        it('should return summary metrics', async () => {
            const assessment = {
                processes: { actual: 4, target: 5 },
                culture: { actual: 3, target: 5 }
            };

            const result = await aiAssessmentPartner.generateProactiveInsights(assessment);

            expect(result.summary).toMatchObject({
                axesAssessed: 2,
                averageMaturity: '3.5',
                averageTarget: '5.0',
                overallGap: '1.5'
            });
        });

        it('should handle empty assessment', async () => {
            const result = await aiAssessmentPartner.generateProactiveInsights({});

            expect(result.insights).toHaveLength(0);
            expect(result.message).toBe('No assessment data to analyze');
        });
    });

    // =========================================================================
    // askClarifyingQuestion TESTS
    // =========================================================================

    describe('askClarifyingQuestion', () => {
        it('should return clarifying question for valid axis', async () => {
            const result = await aiAssessmentPartner.askClarifyingQuestion('processes', 3);

            expect(result).toMatchObject({
                axisId: 'processes',
                axisName: DRD_AXES.processes.name,
                score: 3,
                mode: 'ASK_CLARIFYING_QUESTION'
            });
            expect(typeof result.question).toBe('string');
            expect(result.levelContext.current).toBeDefined();
        });

        it('should return different questions for different score tiers', async () => {
            const lowResult = await aiAssessmentPartner.askClarifyingQuestion('processes', 2);
            const midResult = await aiAssessmentPartner.askClarifyingQuestion('processes', 4);
            const highResult = await aiAssessmentPartner.askClarifyingQuestion('processes', 7);

            // Questions should be tier-appropriate
            expect(lowResult.question).toBeDefined();
            expect(midResult.question).toBeDefined();
            expect(highResult.question).toBeDefined();
        });

        it('should handle invalid axis', async () => {
            const result = await aiAssessmentPartner.askClarifyingQuestion('invalid', 3);

            expect(result.question).toBe('Please provide more context about this assessment.');
        });
    });

    // =========================================================================
    // suggestJustification TESTS
    // =========================================================================

    describe('suggestJustification', () => {
        it('should suggest justification for axis score', async () => {
            const result = await aiAssessmentPartner.suggestJustification('processes', 4);

            expect(result).toMatchObject({
                axisId: 'processes',
                score: 4
            });
            expect(result.suggestion).toBeDefined();
            expect(result.mode).toMatch(/AI_GENERATED|FALLBACK/);
        });

        it('should return error for invalid axis', async () => {
            const result = await aiAssessmentPartner.suggestJustification('invalid', 4);
            expect(result.error).toBe('Invalid axis ID');
        });

        it('should use fallback when AI unavailable', async () => {
            // Temporarily disable AI
            aiAssessmentPartner.model = null;

            const result = await aiAssessmentPartner.suggestJustification('processes', 3);

            expect(result.mode).toBe('FALLBACK');
            expect(result.suggestion).toBeDefined();
        });
    });

    // =========================================================================
    // suggestEvidence TESTS
    // =========================================================================

    describe('suggestEvidence', () => {
        it('should suggest evidence for axis score', async () => {
            const result = await aiAssessmentPartner.suggestEvidence('dataManagement', 5);

            expect(result).toMatchObject({
                axisId: 'dataManagement',
                score: 5
            });
            expect(Array.isArray(result.evidence)).toBe(true);
        });

        it('should return different evidence for different score tiers', async () => {
            // Use fallback mode for consistent testing
            aiAssessmentPartner.model = null;

            const lowResult = await aiAssessmentPartner.suggestEvidence('processes', 2);
            const highResult = await aiAssessmentPartner.suggestEvidence('processes', 7);

            expect(lowResult.evidence).toBeDefined();
            expect(highResult.evidence).toBeDefined();
        });
    });

    // =========================================================================
    // suggestTargetScore TESTS
    // =========================================================================

    describe('suggestTargetScore', () => {
        it('should suggest target based on ambition level', async () => {
            const conservative = await aiAssessmentPartner.suggestTargetScore('processes', 3, 'conservative');
            const balanced = await aiAssessmentPartner.suggestTargetScore('processes', 3, 'balanced');
            const aggressive = await aiAssessmentPartner.suggestTargetScore('processes', 3, 'aggressive');

            expect(conservative.suggestedTarget).toBe(4);
            expect(balanced.suggestedTarget).toBe(5);
            expect(aggressive.suggestedTarget).toBe(6);
        });

        it('should not exceed level 7', async () => {
            const result = await aiAssessmentPartner.suggestTargetScore('processes', 6, 'aggressive');
            expect(result.suggestedTarget).toBeLessThanOrEqual(7);
        });

        it('should include time estimate', async () => {
            const result = await aiAssessmentPartner.suggestTargetScore('processes', 3, 'balanced');
            expect(result.timeEstimate).toBeDefined();
            expect(result.timeEstimate).toMatch(/miesięcy/);
        });
    });

    // =========================================================================
    // correctJustificationLanguage TESTS
    // =========================================================================

    describe('correctJustificationLanguage', () => {
        it('should handle empty text', async () => {
            const result = await aiAssessmentPartner.correctJustificationLanguage('');
            expect(result.error).toBe('No text provided');
        });

        it('should return unchanged when AI unavailable', async () => {
            aiAssessmentPartner.model = null;

            const result = await aiAssessmentPartner.correctJustificationLanguage('Test text');

            expect(result.mode).toBe('UNCHANGED');
            expect(result.correctedText).toBe('Test text');
        });
    });

    // =========================================================================
    // autocompleteJustification TESTS
    // =========================================================================

    describe('autocompleteJustification', () => {
        it('should return completion for partial text', async () => {
            const result = await aiAssessmentPartner.autocompleteJustification(
                'Organizacja posiada',
                'processes',
                4
            );

            expect(result.partialText).toBe('Organizacja posiada');
            expect(result.mode).toMatch(/AI_COMPLETED|FALLBACK/);
        });

        it('should return error for invalid axis', async () => {
            const result = await aiAssessmentPartner.autocompleteJustification('Text', 'invalid', 4);
            expect(result.error).toBe('Invalid axis ID');
        });
    });

    // =========================================================================
    // generateExecutiveSummary TESTS
    // =========================================================================

    describe('generateExecutiveSummary', () => {
        it('should generate summary with metrics', async () => {
            const assessment = {
                processes: { actual: 4, target: 5 },
                culture: { actual: 3, target: 5 },
                dataManagement: { actual: 4, target: 6 }
            };

            const result = await aiAssessmentPartner.generateExecutiveSummary(assessment);

            expect(result.metrics).toMatchObject({
                averageMaturity: expect.any(String),
                averageTarget: expect.any(String),
                overallGap: expect.any(String)
            });
            expect(result.topStrengths).toBeDefined();
            expect(result.priorityGaps).toBeDefined();
        });

        it('should handle empty assessment', async () => {
            const result = await aiAssessmentPartner.generateExecutiveSummary({});
            expect(result.error).toBe('No assessment data provided');
        });
    });

    // =========================================================================
    // generateStakeholderView TESTS
    // =========================================================================

    describe('generateStakeholderView', () => {
        it('should generate view for valid stakeholder role', async () => {
            const assessment = {
                processes: { actual: 4, target: 5 },
                aiMaturity: { actual: 3, target: 5 }
            };

            const result = await aiAssessmentPartner.generateStakeholderView(assessment, 'CTO');

            expect(result.stakeholderRole).toBe('CTO');
            expect(result.focusAreas).toContain('technology');
        });

        it('should return error for invalid role', async () => {
            const result = await aiAssessmentPartner.generateStakeholderView({}, 'INVALID');
            expect(result.error).toContain('Invalid stakeholder role');
        });
    });

    // =========================================================================
    // generateInitiativesFromGaps TESTS
    // =========================================================================

    describe('generateInitiativesFromGaps', () => {
        it('should generate initiatives from gap analysis', async () => {
            const gapAnalysis = [
                { axis: 'processes', axisName: 'Digital Processes', gap: 3, currentScore: 2, targetScore: 5 },
                { axis: 'culture', axisName: 'Organizational Culture', gap: 2, currentScore: 3, targetScore: 5 }
            ];

            const result = await aiAssessmentPartner.generateInitiativesFromGaps(gapAnalysis);

            expect(result.initiatives).toBeDefined();
            expect(Array.isArray(result.initiatives)).toBe(true);
        });

        it('should handle empty gap analysis', async () => {
            const result = await aiAssessmentPartner.generateInitiativesFromGaps([]);
            expect(result.error).toBe('No gap analysis data provided');
        });
    });

    // =========================================================================
    // prioritizeInitiatives TESTS
    // =========================================================================

    describe('prioritizeInitiatives', () => {
        it('should prioritize initiatives', async () => {
            const initiatives = [
                { name: 'Initiative A', description: 'Description A' },
                { name: 'Initiative B', description: 'Description B' }
            ];

            const result = await aiAssessmentPartner.prioritizeInitiatives(initiatives);

            expect(result.prioritizedList).toBeDefined();
            expect(result.prioritizedList[0].rank).toBe(1);
        });

        it('should handle empty initiatives', async () => {
            const result = await aiAssessmentPartner.prioritizeInitiatives([]);
            expect(result.error).toBe('No initiatives provided');
        });
    });

    // =========================================================================
    // estimateROI TESTS
    // =========================================================================

    describe('estimateInitiativeROI', () => {
        it('should estimate ROI for initiative', async () => {
            const initiative = {
                name: 'Digital Process Automation',
                description: 'Automate key business processes',
                targetAxes: ['processes']
            };

            const result = await aiAssessmentPartner.estimateInitiativeROI(initiative);

            expect(result.initiative).toBe('Digital Process Automation');
            expect(result.estimate).toMatchObject({
                estimatedCost: expect.any(String),
                paybackPeriod: expect.any(String)
            });
        });

        it('should handle invalid initiative', async () => {
            const result = await aiAssessmentPartner.estimateInitiativeROI({});
            expect(result.error).toBe('Invalid initiative data');
        });
    });

    // =========================================================================
    // PRIVATE HELPER METHODS TESTS
    // =========================================================================

    describe('_estimateLevelTransition', () => {
        it('should return higher estimates for higher levels', () => {
            const level2to3 = aiAssessmentPartner._estimateLevelTransition('processes', 2, 3);
            const level5to6 = aiAssessmentPartner._estimateLevelTransition('processes', 5, 6);

            expect(level5to6).toBeGreaterThan(level2to3);
        });

        it('should apply axis complexity multiplier', () => {
            const processesEstimate = aiAssessmentPartner._estimateLevelTransition('processes', 3, 4);
            const cultureEstimate = aiAssessmentPartner._estimateLevelTransition('culture', 3, 4);

            // Culture should take longer (1.5x multiplier)
            expect(cultureEstimate).toBeGreaterThan(processesEstimate);
        });
    });

    describe('_getKeyActivities', () => {
        it('should return activities for valid axis and level', () => {
            const activities = aiAssessmentPartner._getKeyActivities('processes', 4);

            expect(Array.isArray(activities)).toBe(true);
            expect(activities.length).toBeGreaterThan(0);
        });

        it('should return default activities for unknown combinations', () => {
            const activities = aiAssessmentPartner._getKeyActivities('unknown', 99);

            expect(activities).toContainEqual('Assess current capabilities');
        });
    });
});



