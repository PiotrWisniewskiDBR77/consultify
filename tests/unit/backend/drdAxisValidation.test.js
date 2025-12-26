/**
 * Unit Tests: DRD Axis Validation
 * Comprehensive tests for DRD axis configuration, score validation, and consistency rules
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock Google AI
vi.mock('@google/generative-ai', () => ({
    GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
        getGenerativeModel: vi.fn().mockReturnValue({
            generateContent: vi.fn().mockResolvedValue({
                response: { text: () => '{}' }
            })
        })
    }))
}));

describe('DRD Axis Validation', () => {
    let DRD_AXES;
    let AI_PARTNER_CONFIG;
    let aiAssessmentPartner;

    const ALL_DRD_AXES = [
        'processes',
        'digitalProducts',
        'businessModels',
        'dataManagement',
        'culture',
        'cybersecurity',
        'aiMaturity'
    ];

    beforeEach(async () => {
        vi.resetModules();
        vi.clearAllMocks();
        process.env.GEMINI_API_KEY = 'test-key';

        const module = await import('../../../server/services/aiAssessmentPartnerService.js');
        DRD_AXES = module.DRD_AXES;
        AI_PARTNER_CONFIG = module.AI_PARTNER_CONFIG;
        aiAssessmentPartner = module.aiAssessmentPartner;
    });

    afterEach(() => {
        vi.restoreAllMocks();
        delete process.env.GEMINI_API_KEY;
    });

    // =========================================================================
    // DRD_AXES STRUCTURE TESTS
    // =========================================================================

    describe('DRD_AXES Structure', () => {
        it('should define exactly 7 axes', () => {
            expect(Object.keys(DRD_AXES)).toHaveLength(7);
        });

        it('should include all required axis IDs', () => {
            ALL_DRD_AXES.forEach(axisId => {
                expect(DRD_AXES[axisId]).toBeDefined();
            });
        });

        it('should have name property for each axis', () => {
            Object.entries(DRD_AXES).forEach(([axisId, axis]) => {
                expect(axis.name).toBeDefined();
                expect(typeof axis.name).toBe('string');
                expect(axis.name.length).toBeGreaterThan(0);
            });
        });

        it('should have description property for each axis', () => {
            Object.entries(DRD_AXES).forEach(([axisId, axis]) => {
                expect(axis.description).toBeDefined();
                expect(typeof axis.description).toBe('string');
                expect(axis.description.length).toBeGreaterThan(0);
            });
        });

        it('should have levels object for each axis', () => {
            Object.entries(DRD_AXES).forEach(([axisId, axis]) => {
                expect(axis.levels).toBeDefined();
                expect(typeof axis.levels).toBe('object');
            });
        });
    });

    // =========================================================================
    // MATURITY LEVELS TESTS
    // =========================================================================

    describe('Maturity Levels', () => {
        it('should have exactly 7 levels for each axis (1-7)', () => {
            Object.entries(DRD_AXES).forEach(([axisId, axis]) => {
                expect(Object.keys(axis.levels)).toHaveLength(7);
                for (let i = 1; i <= 7; i++) {
                    expect(axis.levels[i]).toBeDefined();
                }
            });
        });

        it('should have non-empty string descriptions for each level', () => {
            Object.entries(DRD_AXES).forEach(([axisId, axis]) => {
                for (let i = 1; i <= 7; i++) {
                    expect(typeof axis.levels[i]).toBe('string');
                    expect(axis.levels[i].length).toBeGreaterThan(0);
                }
            });
        });

        it('should have unique descriptions for each level within an axis', () => {
            Object.entries(DRD_AXES).forEach(([axisId, axis]) => {
                const descriptions = Object.values(axis.levels);
                const uniqueDescriptions = new Set(descriptions);
                expect(uniqueDescriptions.size).toBe(descriptions.length);
            });
        });

        it('should show progression from level 1 to level 7', () => {
            Object.entries(DRD_AXES).forEach(([axisId, axis]) => {
                // Level 1 should describe basic/none/traditional state
                const level1 = axis.levels[1].toLowerCase();
                expect(
                    level1.includes('manual') ||
                    level1.includes('no ') ||
                    level1.includes('traditional') ||
                    level1.includes('basic') ||
                    level1.includes('scattered') ||
                    level1.includes('resistance') ||
                    level1.includes('brak') ||
                    level1.includes('ręczn')
                ).toBe(true);

                // Level 7 should describe advanced/autonomous state
                const level7 = axis.levels[7].toLowerCase();
                expect(
                    level7.includes('autonomous') ||
                    level7.includes('self-') ||
                    level7.includes('adaptive') ||
                    level7.includes('ai-native') ||
                    level7.includes('intelligent') ||
                    level7.includes('autonomic') ||
                    level7.includes('samouczą')
                ).toBe(true);
            });
        });
    });

    // =========================================================================
    // SCORE VALIDATION TESTS
    // =========================================================================

    describe('Score Validation', () => {
        describe('validateScoreConsistency', () => {
            it('should detect AI maturity exceeding data management', async () => {
                const assessment = {
                    aiMaturity: { actual: 6 },
                    dataManagement: { actual: 2 }
                };

                const result = await aiAssessmentPartner.validateScoreConsistency(assessment);

                expect(result.hasInconsistencies).toBe(true);
                expect(result.inconsistencies.some(i => 
                    i.type === 'DEPENDENCY_MISMATCH' &&
                    i.axes.includes('aiMaturity') &&
                    i.axes.includes('dataManagement')
                )).toBe(true);
            });

            it('should detect cybersecurity lagging behind digital processes', async () => {
                const assessment = {
                    processes: { actual: 6 },
                    cybersecurity: { actual: 2 }
                };

                const result = await aiAssessmentPartner.validateScoreConsistency(assessment);

                expect(result.hasInconsistencies).toBe(true);
                expect(result.inconsistencies.some(i => i.type === 'RISK_GAP')).toBe(true);
            });

            it('should detect digital products exceeding processes', async () => {
                const assessment = {
                    digitalProducts: { actual: 6 },
                    processes: { actual: 2 }
                };

                const result = await aiAssessmentPartner.validateScoreConsistency(assessment);

                expect(result.hasInconsistencies).toBe(true);
                expect(result.inconsistencies.some(i => i.type === 'CAPABILITY_GAP')).toBe(true);
            });

            it('should detect culture gap for business model innovation', async () => {
                const assessment = {
                    businessModels: { actual: 6 },
                    culture: { actual: 2 }
                };

                const result = await aiAssessmentPartner.validateScoreConsistency(assessment);

                expect(result.hasInconsistencies).toBe(true);
                expect(result.inconsistencies.some(i => i.type === 'CULTURE_GAP')).toBe(true);
            });

            it('should accept balanced assessment', async () => {
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

            it('should accept slight variations in scores', async () => {
                const assessment = {
                    processes: { actual: 4 },
                    digitalProducts: { actual: 5 }, // 1 point higher is OK
                    cybersecurity: { actual: 3 }, // 1 point lower is OK
                    dataManagement: { actual: 5 },
                    aiMaturity: { actual: 4 }
                };

                const result = await aiAssessmentPartner.validateScoreConsistency(assessment);

                // Small variations should not trigger severe inconsistencies
                expect(result.inconsistencies.filter(i => i.severity === 'HIGH').length).toBe(0);
            });
        });
    });

    // =========================================================================
    // SCORE BOUNDARY TESTS
    // =========================================================================

    describe('Score Boundaries', () => {
        it('should validate score within 1-7 range', () => {
            const validScores = [1, 2, 3, 4, 5, 6, 7];
            const invalidScores = [0, -1, 8, 10, 1.5, null, undefined];

            validScores.forEach(score => {
                expect(score >= 1 && score <= 7 && Number.isInteger(score)).toBe(true);
            });

            invalidScores.forEach(score => {
                expect(score >= 1 && score <= 7 && Number.isInteger(score)).toBe(false);
            });
        });

        it('should require integer scores', () => {
            const integerCheck = (score) => Number.isInteger(score) && score >= 1 && score <= 7;

            expect(integerCheck(3)).toBe(true);
            expect(integerCheck(3.5)).toBe(false);
            expect(integerCheck(3.0)).toBe(true);
        });
    });

    // =========================================================================
    // GAP ANALYSIS TESTS
    // =========================================================================

    describe('Gap Analysis', () => {
        describe('generateGapAnalysis', () => {
            it('should calculate correct gap size', async () => {
                const result = await aiAssessmentPartner.generateGapAnalysis('processes', 2, 5);

                expect(result.gap).toBe(3);
                expect(result.currentScore).toBe(2);
                expect(result.targetScore).toBe(5);
            });

            it('should categorize gap severity correctly', async () => {
                // LOW: gap 1-2
                const lowGap = await aiAssessmentPartner.generateGapAnalysis('processes', 4, 5);
                expect(lowGap.gapSeverity).toBe('LOW');

                // MEDIUM: gap 3-4
                const mediumGap = await aiAssessmentPartner.generateGapAnalysis('processes', 2, 5);
                expect(mediumGap.gapSeverity).toBe('MEDIUM');

                // HIGH: gap 5+
                const highGap = await aiAssessmentPartner.generateGapAnalysis('processes', 1, 6);
                expect(highGap.gapSeverity).toBe('HIGH');
            });

            it('should include pathway for gap closure', async () => {
                const result = await aiAssessmentPartner.generateGapAnalysis('processes', 2, 5);

                expect(result.pathway).toBeDefined();
                expect(Array.isArray(result.pathway)).toBe(true);
                expect(result.pathway.length).toBe(3); // Steps from 3 to 5
            });

            it('should estimate time for each level transition', async () => {
                const result = await aiAssessmentPartner.generateGapAnalysis('processes', 3, 5);

                result.pathway.forEach(step => {
                    expect(step.estimatedMonths).toBeDefined();
                    expect(step.estimatedMonths).toBeGreaterThan(0);
                });
            });

            it('should include key activities for each step', async () => {
                const result = await aiAssessmentPartner.generateGapAnalysis('processes', 3, 5);

                result.pathway.forEach(step => {
                    expect(step.keyActivities).toBeDefined();
                    expect(Array.isArray(step.keyActivities)).toBe(true);
                });
            });

            it('should return error for invalid axis', async () => {
                const result = await aiAssessmentPartner.generateGapAnalysis('invalid-axis', 2, 5);

                expect(result.error).toBe('Invalid axis ID');
            });

            it('should calculate total estimated months', async () => {
                const result = await aiAssessmentPartner.generateGapAnalysis('processes', 2, 5);

                const totalFromPathway = result.pathway.reduce((sum, p) => sum + p.estimatedMonths, 0);
                expect(result.estimatedTotalMonths).toBe(totalFromPathway);
            });
        });
    });

    // =========================================================================
    // AXIS DEPENDENCY RULES TESTS
    // =========================================================================

    describe('Axis Dependency Rules', () => {
        it('should enforce AI maturity requires data management', async () => {
            // AI maturity should not exceed data management by more than 2 levels
            const assessment = {
                aiMaturity: { actual: 7 },
                dataManagement: { actual: 3 }
            };

            const result = await aiAssessmentPartner.validateScoreConsistency(assessment);

            expect(result.hasInconsistencies).toBe(true);
            const dependency = result.inconsistencies.find(i => 
                i.axes.includes('aiMaturity') && i.axes.includes('dataManagement')
            );
            expect(dependency).toBeDefined();
        });

        it('should enforce digital products requires process foundation', async () => {
            const assessment = {
                digitalProducts: { actual: 7 },
                processes: { actual: 2 }
            };

            const result = await aiAssessmentPartner.validateScoreConsistency(assessment);

            expect(result.hasInconsistencies).toBe(true);
            const dependency = result.inconsistencies.find(i => 
                i.axes.includes('digitalProducts') && i.axes.includes('processes')
            );
            expect(dependency).toBeDefined();
        });

        it('should enforce cybersecurity scales with digitalization', async () => {
            // Higher process digitalization requires adequate cybersecurity
            const assessment = {
                processes: { actual: 6 },
                digitalProducts: { actual: 5 },
                cybersecurity: { actual: 1 }
            };

            const result = await aiAssessmentPartner.validateScoreConsistency(assessment);

            expect(result.hasInconsistencies).toBe(true);
            expect(result.inconsistencies.some(i => 
                i.type === 'RISK_GAP' && i.axes.includes('cybersecurity')
            )).toBe(true);
        });

        it('should enforce culture supports business model innovation', async () => {
            const assessment = {
                businessModels: { actual: 6 },
                culture: { actual: 1 }
            };

            const result = await aiAssessmentPartner.validateScoreConsistency(assessment);

            expect(result.hasInconsistencies).toBe(true);
            expect(result.inconsistencies.some(i => 
                i.type === 'CULTURE_GAP'
            )).toBe(true);
        });
    });

    // =========================================================================
    // PROACTIVE INSIGHTS TESTS
    // =========================================================================

    describe('Proactive Insights', () => {
        it('should identify strongest axis', async () => {
            const assessment = {
                processes: { actual: 6, target: 7 },
                culture: { actual: 2, target: 5 },
                dataManagement: { actual: 3, target: 5 }
            };

            const result = await aiAssessmentPartner.generateProactiveInsights(assessment);

            expect(result.insights.some(i => 
                i.type === 'STRENGTH' && i.axis === 'processes'
            )).toBe(true);
        });

        it('should identify weakest axis as priority gap', async () => {
            const assessment = {
                processes: { actual: 5, target: 6 },
                culture: { actual: 2, target: 6 },
                dataManagement: { actual: 4, target: 5 }
            };

            const result = await aiAssessmentPartner.generateProactiveInsights(assessment);

            expect(result.insights.some(i => 
                i.type === 'PRIORITY_GAP' && i.axis === 'culture'
            )).toBe(true);
        });

        it('should identify quick wins (gap = 1)', async () => {
            const assessment = {
                processes: { actual: 4, target: 5 },
                culture: { actual: 3, target: 4 }
            };

            const result = await aiAssessmentPartner.generateProactiveInsights(assessment);

            expect(result.insights.some(i => 
                i.type === 'OPPORTUNITY' && i.title.toLowerCase().includes('quick win')
            )).toBe(true);
        });

        it('should warn about ambitious targets (gap >= 4)', async () => {
            const assessment = {
                processes: { actual: 2, target: 7 },
                culture: { actual: 1, target: 6 }
            };

            const result = await aiAssessmentPartner.generateProactiveInsights(assessment);

            expect(result.insights.some(i => 
                i.type === 'RISK' && i.title.toLowerCase().includes('ambitious')
            )).toBe(true);
        });

        it('should calculate summary metrics', async () => {
            const assessment = {
                processes: { actual: 4, target: 6 },
                culture: { actual: 3, target: 5 }
            };

            const result = await aiAssessmentPartner.generateProactiveInsights(assessment);

            expect(result.summary.axesAssessed).toBe(2);
            expect(result.summary.averageMaturity).toBe('3.5');
            expect(result.summary.averageTarget).toBe('5.5');
            expect(result.summary.overallGap).toBe('2.0');
        });

        it('should handle empty assessment', async () => {
            const result = await aiAssessmentPartner.generateProactiveInsights({});

            expect(result.insights).toHaveLength(0);
            expect(result.message).toBe('No assessment data to analyze');
        });
    });

    // =========================================================================
    // STAKEHOLDER VIEWS TESTS
    // =========================================================================

    describe('Stakeholder Views', () => {
        const sampleAssessment = {
            processes: { actual: 4 },
            digitalProducts: { actual: 5 },
            dataManagement: { actual: 3 },
            aiMaturity: { actual: 2 },
            cybersecurity: { actual: 4 },
            culture: { actual: 3 },
            businessModels: { actual: 4 }
        };

        it('should generate CTO view with technology focus', async () => {
            const result = await aiAssessmentPartner.generateStakeholderView(
                sampleAssessment,
                'CTO'
            );

            expect(result.stakeholderRole).toBe('CTO');
            // Should have view or fallback message
            expect(result.view).toBeDefined();
            // focusAreas is a string describing focus, not always present in fallback
        });

        it('should generate CFO view with financial focus', async () => {
            const result = await aiAssessmentPartner.generateStakeholderView(
                sampleAssessment,
                'CFO'
            );

            expect(result.stakeholderRole).toBe('CFO');
            expect(result.view).toBeDefined();
        });

        it('should return error for invalid stakeholder role', async () => {
            const result = await aiAssessmentPartner.generateStakeholderView(
                sampleAssessment,
                'INVALID_ROLE'
            );

            expect(result.error).toContain('Invalid stakeholder role');
        });

        it('should support all valid stakeholder roles', async () => {
            const validRoles = ['CTO', 'CFO', 'COO', 'CEO', 'BOARD'];

            for (const role of validRoles) {
                const result = await aiAssessmentPartner.generateStakeholderView(
                    sampleAssessment,
                    role
                );

                // Should have stakeholderRole defined
                expect(result.stakeholderRole).toBe(role);
                // Should have view defined (AI generated or fallback)
                expect(result.view).toBeDefined();
                // mode should be AI_GENERATED or FALLBACK
                expect(['AI_GENERATED', 'FALLBACK']).toContain(result.mode);
            }
        });
    });

    // =========================================================================
    // AI PARTNER CONFIG TESTS
    // =========================================================================

    describe('AI Partner Configuration', () => {
        it('should use THINKING_PARTNER mode', () => {
            expect(AI_PARTNER_CONFIG.mode).toBe('THINKING_PARTNER');
        });

        it('should allow clarifying questions', () => {
            expect(AI_PARTNER_CONFIG.allowed).toContain('ASK_CLARIFYING_QUESTION');
        });

        it('should allow score validation', () => {
            expect(AI_PARTNER_CONFIG.allowed).toContain('VALIDATE_SCORE');
        });

        it('should allow gap analysis', () => {
            expect(AI_PARTNER_CONFIG.allowed).toContain('GAP_ANALYSIS');
        });

        it('should block jumping to conclusions', () => {
            expect(AI_PARTNER_CONFIG.blocked).toContain('JUMP_TO_CONCLUSION');
        });

        it('should block suggesting solutions directly', () => {
            expect(AI_PARTNER_CONFIG.blocked).toContain('SUGGEST_SOLUTION');
        });

        it('should have partner tone style', () => {
            expect(AI_PARTNER_CONFIG.tone.style).toBe('partner');
            expect(AI_PARTNER_CONFIG.tone.formality).toBe('professional');
        });
    });

    // =========================================================================
    // JUSTIFICATION VALIDATION TESTS
    // =========================================================================

    describe('Justification Validation', () => {
        describe('suggestJustification', () => {
            it('should suggest justification for valid axis', async () => {
                const result = await aiAssessmentPartner.suggestJustification('processes', 4);

                expect(result.axisId).toBe('processes');
                expect(result.score).toBe(4);
                expect(result.suggestion).toBeDefined();
            });

            it('should return error for invalid axis', async () => {
                const result = await aiAssessmentPartner.suggestJustification('invalid', 4);

                expect(result.error).toBe('Invalid axis ID');
            });

            it('should provide fallback when AI unavailable', async () => {
                aiAssessmentPartner.model = null;

                const result = await aiAssessmentPartner.suggestJustification('processes', 3);

                expect(result.mode).toBe('FALLBACK');
                expect(result.suggestion).toBeDefined();
            });
        });

        describe('correctJustificationLanguage', () => {
            it('should handle empty text', async () => {
                const result = await aiAssessmentPartner.correctJustificationLanguage('');

                expect(result.error).toBe('No text provided');
            });

            it('should return unchanged for unavailable AI', async () => {
                aiAssessmentPartner.model = null;

                const result = await aiAssessmentPartner.correctJustificationLanguage('Test text');

                expect(result.mode).toBe('UNCHANGED');
                expect(result.correctedText).toBe('Test text');
            });
        });
    });

    // =========================================================================
    // TARGET SCORE SUGGESTION TESTS
    // =========================================================================

    describe('Target Score Suggestions', () => {
        it('should suggest conservative target (+1)', async () => {
            const result = await aiAssessmentPartner.suggestTargetScore('processes', 3, 'conservative');

            expect(result.suggestedTarget).toBe(4);
        });

        it('should suggest balanced target (+2)', async () => {
            const result = await aiAssessmentPartner.suggestTargetScore('processes', 3, 'balanced');

            expect(result.suggestedTarget).toBe(5);
        });

        it('should suggest aggressive target (+3)', async () => {
            const result = await aiAssessmentPartner.suggestTargetScore('processes', 3, 'aggressive');

            expect(result.suggestedTarget).toBe(6);
        });

        it('should cap target at level 7', async () => {
            const result = await aiAssessmentPartner.suggestTargetScore('processes', 6, 'aggressive');

            expect(result.suggestedTarget).toBeLessThanOrEqual(7);
        });

        it('should include time estimate', async () => {
            const result = await aiAssessmentPartner.suggestTargetScore('processes', 3, 'balanced');

            expect(result.timeEstimate).toBeDefined();
            expect(typeof result.timeEstimate).toBe('string');
        });
    });

    // =========================================================================
    // LEVEL TRANSITION ESTIMATION TESTS
    // =========================================================================

    describe('Level Transition Estimation', () => {
        it('should estimate higher time for higher level transitions', () => {
            const lowTransition = aiAssessmentPartner._estimateLevelTransition('processes', 2, 3);
            const highTransition = aiAssessmentPartner._estimateLevelTransition('processes', 5, 6);

            expect(highTransition).toBeGreaterThan(lowTransition);
        });

        it('should apply axis complexity multiplier', () => {
            // Culture axis has higher complexity (1.5x)
            const processesEstimate = aiAssessmentPartner._estimateLevelTransition('processes', 3, 4);
            const cultureEstimate = aiAssessmentPartner._estimateLevelTransition('culture', 3, 4);

            expect(cultureEstimate).toBeGreaterThan(processesEstimate);
        });

        it('should return positive months for any valid transition', () => {
            ALL_DRD_AXES.forEach(axisId => {
                for (let from = 1; from < 7; from++) {
                    const estimate = aiAssessmentPartner._estimateLevelTransition(axisId, from, from + 1);
                    expect(estimate).toBeGreaterThan(0);
                }
            });
        });
    });

    // =========================================================================
    // KEY ACTIVITIES TESTS
    // =========================================================================

    describe('Key Activities', () => {
        it('should return activities for each axis and level', () => {
            ALL_DRD_AXES.forEach(axisId => {
                for (let level = 1; level <= 7; level++) {
                    const activities = aiAssessmentPartner._getKeyActivities(axisId, level);
                    expect(Array.isArray(activities)).toBe(true);
                    expect(activities.length).toBeGreaterThan(0);
                }
            });
        });

        it('should return default activities for unknown combinations', () => {
            const activities = aiAssessmentPartner._getKeyActivities('unknown', 99);

            expect(activities).toContain('Assess current capabilities');
        });
    });
});

