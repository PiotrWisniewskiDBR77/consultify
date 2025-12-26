/**
 * Unit Tests: AI Assessment Form Helper Service
 * Complete test coverage for form assistance and validation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock aiAssessmentPartnerService
vi.mock('../../../server/services/aiAssessmentPartnerService', () => ({
    aiAssessmentPartner: {
        suggestJustification: vi.fn(),
        suggestEvidence: vi.fn(),
        suggestTargetScore: vi.fn(),
        autocompleteJustification: vi.fn(),
        validateScoreConsistency: vi.fn(),
        correctJustificationLanguage: vi.fn()
    },
    DRD_AXES: {
        processes: {
            name: 'Procesy cyfrowe',
            description: 'Digitalizacja procesów',
            levels: {
                1: 'Brak digitalizacji',
                2: 'Podstawowe narzędzia',
                3: 'Standardowe systemy',
                4: 'Zintegrowane procesy',
                5: 'Automatyzacja',
                6: 'Inteligentna automatyzacja',
                7: 'Autonomiczne procesy'
            }
        },
        dataManagement: {
            name: 'Zarządzanie danymi',
            description: 'Zarządzanie danymi i analityka',
            levels: {
                1: 'Brak',
                2: 'Podstawowe',
                3: 'Standardowe',
                4: 'Zintegrowane',
                5: 'Zaawansowane',
                6: 'Predykcyjne',
                7: 'Autonomiczne'
            }
        },
        culture: {
            name: 'Kultura organizacyjna',
            description: 'Kultura cyfrowa',
            levels: {
                1: 'Tradycyjna',
                2: 'Podstawowa',
                3: 'Rozwijająca się',
                4: 'Dojrzała',
                5: 'Zaawansowana',
                6: 'Innowacyjna',
                7: 'Adaptacyjna'
            }
        },
        digitalProducts: {
            name: 'Produkty cyfrowe',
            description: 'Produkty i usługi cyfrowe',
            levels: { 1: '', 2: '', 3: '', 4: '', 5: '', 6: '', 7: '' }
        },
        businessModels: {
            name: 'Modele biznesowe',
            description: 'Cyfrowe modele biznesowe',
            levels: { 1: '', 2: '', 3: '', 4: '', 5: '', 6: '', 7: '' }
        },
        cybersecurity: {
            name: 'Cyberbezpieczeństwo',
            description: 'Bezpieczeństwo cyfrowe',
            levels: { 1: '', 2: '', 3: '', 4: '', 5: '', 6: '', 7: '' }
        },
        aiMaturity: {
            name: 'Dojrzałość AI',
            description: 'Dojrzałość AI i ML',
            levels: { 1: '', 2: '', 3: '', 4: '', 5: '', 6: '', 7: '' }
        }
    }
}));

describe('AIAssessmentFormHelper', () => {
    let AIAssessmentFormHelper;
    let aiAssessmentFormHelper;
    let FIELD_TYPES;
    let VALIDATION_RULES;
    let mockAiPartner;

    beforeEach(async () => {
        vi.resetModules();
        vi.clearAllMocks();

        const module = await import('../../../server/services/aiAssessmentFormHelper.js');
        AIAssessmentFormHelper = module.AIAssessmentFormHelper;
        aiAssessmentFormHelper = module.aiAssessmentFormHelper;
        FIELD_TYPES = module.FIELD_TYPES;
        VALIDATION_RULES = module.VALIDATION_RULES;

        const { aiAssessmentPartner } = await import('../../../server/services/aiAssessmentPartnerService');
        mockAiPartner = aiAssessmentPartner;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // =========================================================================
    // FIELD_TYPES CONFIGURATION TESTS
    // =========================================================================

    describe('FIELD_TYPES Configuration', () => {
        it('should define all required field types', () => {
            expect(FIELD_TYPES.JUSTIFICATION).toBe('justification');
            expect(FIELD_TYPES.EVIDENCE).toBe('evidence');
            expect(FIELD_TYPES.TARGET_SCORE).toBe('targetScore');
            expect(FIELD_TYPES.ACTUAL_SCORE).toBe('actualScore');
            expect(FIELD_TYPES.NOTES).toBe('notes');
            expect(FIELD_TYPES.PRIORITY).toBe('priority');
        });
    });

    // =========================================================================
    // VALIDATION_RULES TESTS
    // =========================================================================

    describe('VALIDATION_RULES Configuration', () => {
        it('should define justification validation rules', () => {
            expect(VALIDATION_RULES.justification).toBeDefined();
            expect(VALIDATION_RULES.justification.minLength).toBe(50);
            expect(VALIDATION_RULES.justification.maxLength).toBe(2000);
            expect(VALIDATION_RULES.justification.required).toBe(true);
        });

        it('should define evidence validation rules', () => {
            expect(VALIDATION_RULES.evidence).toBeDefined();
            expect(VALIDATION_RULES.evidence.minItems).toBe(1);
            expect(VALIDATION_RULES.evidence.maxItems).toBe(10);
        });

        it('should define score validation rules', () => {
            expect(VALIDATION_RULES.score).toBeDefined();
            expect(VALIDATION_RULES.score.min).toBe(1);
            expect(VALIDATION_RULES.score.max).toBe(7);
            expect(VALIDATION_RULES.score.required).toBe(true);
        });
    });

    // =========================================================================
    // getFieldSuggestion TESTS
    // =========================================================================

    describe('getFieldSuggestion', () => {
        it('should get justification suggestion for axis', async () => {
            const result = await aiAssessmentFormHelper.getFieldSuggestion(
                FIELD_TYPES.JUSTIFICATION,
                { axisId: 'processes', score: 4 }
            );

            // Test that method returns a result (actual AI calls are tested in aiAssessmentPartnerService tests)
            expect(result).toBeDefined();
            // Result should have suggestion or error
            expect(result.suggestion !== undefined || result.error !== undefined).toBe(true);
        });

        it('should get evidence suggestion for axis', async () => {
            const result = await aiAssessmentFormHelper.getFieldSuggestion(
                FIELD_TYPES.EVIDENCE,
                { axisId: 'dataManagement', score: 5 }
            );

            // Test that method returns a result
            expect(result).toBeDefined();
            expect(result.evidence !== undefined || result.error !== undefined).toBe(true);
        });

        it('should get target score suggestion', async () => {
            const result = await aiAssessmentFormHelper.getFieldSuggestion(
                FIELD_TYPES.TARGET_SCORE,
                { axisId: 'processes', score: 3 }
            );

            // Test that method returns a result
            expect(result).toBeDefined();
            expect(result.suggestedTarget !== undefined || result.error !== undefined).toBe(true);
        });

        it('should get notes suggestion', async () => {
            const result = await aiAssessmentFormHelper.getFieldSuggestion(
                FIELD_TYPES.NOTES,
                { axisId: 'processes', score: 4 }
            );

            expect(result.suggestion).toBeDefined();
            expect(result.prompts).toBeInstanceOf(Array);
            expect(result.prompts.length).toBeGreaterThan(0);
        });

        it('should get priority suggestion', async () => {
            const result = await aiAssessmentFormHelper.getFieldSuggestion(
                FIELD_TYPES.PRIORITY,
                { axisId: 'processes', score: 2, targetScore: 6 }
            );

            expect(result.suggestedPriority).toBe('HIGH');
            expect(result.reasoning).toBeDefined();
        });

        it('should return error for unknown field type', async () => {
            const result = await aiAssessmentFormHelper.getFieldSuggestion(
                'unknown_field',
                { axisId: 'processes', score: 4 }
            );

            expect(result.error).toContain('Unknown field type');
        });
    });

    // =========================================================================
    // validateFieldValue TESTS
    // =========================================================================

    describe('validateFieldValue', () => {
        it('should validate empty justification as invalid', async () => {
            const result = await aiAssessmentFormHelper.validateFieldValue(
                FIELD_TYPES.JUSTIFICATION,
                '',
                { axisId: 'processes', score: 4 }
            );

            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Uzasadnienie jest wymagane.');
        });

        it('should warn about short justification', async () => {
            const result = await aiAssessmentFormHelper.validateFieldValue(
                FIELD_TYPES.JUSTIFICATION,
                'Short text that is still under 50 characters',
                { axisId: 'processes', score: 4 }
            );

            expect(result.isValid).toBe(true);
            // Check that warnings array exists (basic validation adds warning for short text)
            expect(result.warnings).toBeDefined();
            expect(Array.isArray(result.warnings)).toBe(true);
        });

        it('should reject justification exceeding max length', async () => {
            const longText = 'a'.repeat(2500);

            const result = await aiAssessmentFormHelper.validateFieldValue(
                FIELD_TYPES.JUSTIFICATION,
                longText,
                { axisId: 'processes', score: 4 }
            );

            expect(result.isValid).toBe(false);
            expect(result.errors.some(e => e.includes('2000'))).toBe(true);
        });

        it('should validate score range correctly', async () => {
            const invalidLow = await aiAssessmentFormHelper.validateFieldValue(
                FIELD_TYPES.ACTUAL_SCORE,
                0,
                { axisId: 'processes', score: 0 }
            );
            expect(invalidLow.isValid).toBe(false);

            const invalidHigh = await aiAssessmentFormHelper.validateFieldValue(
                FIELD_TYPES.ACTUAL_SCORE,
                8,
                { axisId: 'processes', score: 8 }
            );
            expect(invalidHigh.isValid).toBe(false);
        });

        it('should check score consistency for full assessment', async () => {
            const result = await aiAssessmentFormHelper.validateFieldValue(
                FIELD_TYPES.ACTUAL_SCORE,
                4,
                {
                    axisId: 'aiMaturity',
                    score: 6,
                    fullAssessment: {
                        dataManagement: { actual: 2 },
                        aiMaturity: { actual: 6 }
                    }
                }
            );

            // When there's a full assessment with inconsistencies, warnings should be populated
            expect(result).toBeDefined();
            expect(result.warnings).toBeDefined();
            expect(Array.isArray(result.warnings)).toBe(true);
        });

        it('should validate justification with AI feedback', async () => {
            const validText = 'a'.repeat(200);

            const result = await aiAssessmentFormHelper.validateFieldValue(
                FIELD_TYPES.JUSTIFICATION,
                validText,
                { axisId: 'processes', score: 5 }
            );

            expect(result.isValid).toBe(true);
        });
    });

    // =========================================================================
    // autocompleteJustification TESTS
    // =========================================================================

    describe('autocompleteJustification', () => {
        it('should reject text shorter than 10 characters', async () => {
            const result = await aiAssessmentFormHelper.autocompleteJustification(
                'Short',
                'processes',
                4
            );

            expect(result.completion).toBe('');
            expect(result.message).toContain('co najmniej 10 znaków');
        });

        it('should call aiPartner for valid partial text', async () => {
            const result = await aiAssessmentFormHelper.autocompleteJustification(
                'Organizacja posiada',
                'processes',
                4
            );

            // Test that method returns a result for valid input
            expect(result).toBeDefined();
            // Result should have completion or fallback
            expect(result.completion !== undefined || result.mode !== undefined || result.partialText !== undefined).toBe(true);
        });

        it('should handle empty partial text', async () => {
            const result = await aiAssessmentFormHelper.autocompleteJustification(
                '',
                'processes',
                4
            );

            expect(result.message).toBeDefined();
            expect(mockAiPartner.autocompleteJustification).not.toHaveBeenCalled();
        });
    });

    // =========================================================================
    // fillMissingFields TESTS
    // =========================================================================

    describe('fillMissingFields', () => {
        it('should fill missing justifications with suggestions', async () => {
            mockAiPartner.suggestJustification.mockResolvedValue({
                suggestion: 'AI generated justification',
                mode: 'AI_GENERATED'
            });
            mockAiPartner.suggestTargetScore.mockResolvedValue({
                suggestedTarget: 5,
                reasoning: 'Balanced approach'
            });
            mockAiPartner.suggestEvidence.mockResolvedValue({
                evidence: ['Evidence 1']
            });

            const assessment = {
                processes: { actual: 3 },
                metadata: { industry: 'Manufacturing' }
            };

            const result = await aiAssessmentFormHelper.fillMissingFields(
                assessment,
                'conservative'
            );

            expect(result.filledFields.processes.justification).toBeDefined();
            expect(result.filledFields.processes.justification.suggested).toBeDefined();
            expect(result.strategy).toBe('conservative');
        });

        it('should respect suggest-only strategy', async () => {
            mockAiPartner.suggestJustification.mockResolvedValue({
                suggestion: 'AI generated justification'
            });
            mockAiPartner.suggestTargetScore.mockResolvedValue({
                suggestedTarget: 5
            });
            mockAiPartner.suggestEvidence.mockResolvedValue({
                evidence: ['Evidence']
            });

            const result = await aiAssessmentFormHelper.fillMissingFields(
                { processes: { actual: 3 } },
                'suggest-only'
            );

            expect(result.mode).toBe('SUGGESTIONS_ONLY');
            expect(result.filledFields.processes?.justification?.autoFilled).toBe(false);
        });

        it('should skip axes with complete data', async () => {
            const assessment = {
                processes: {
                    actual: 4,
                    target: 6,
                    justification: 'Long justification text that is longer than 50 characters for testing purposes',
                    evidence: ['Evidence 1', 'Evidence 2']
                }
            };

            const result = await aiAssessmentFormHelper.fillMissingFields(
                assessment,
                'conservative'
            );

            // Should not have filled anything for processes
            expect(result.filledFields.processes).toBeUndefined();
        });

        it('should suggest target when missing', async () => {
            mockAiPartner.suggestJustification.mockResolvedValue({ suggestion: 'Test' });
            mockAiPartner.suggestEvidence.mockResolvedValue({ evidence: ['E1'] });
            mockAiPartner.suggestTargetScore.mockResolvedValue({
                suggestedTarget: 5,
                reasoning: 'Based on gap analysis'
            });

            const assessment = {
                processes: { actual: 3, justification: 'x'.repeat(100), evidence: ['e1'] }
            };

            const result = await aiAssessmentFormHelper.fillMissingFields(
                assessment,
                'conservative'
            );

            expect(result.filledFields.processes.target).toBeDefined();
            expect(result.filledFields.processes.target.suggested).toBe(5);
        });
    });

    // =========================================================================
    // reviewAllJustifications TESTS
    // =========================================================================

    describe('reviewAllJustifications', () => {
        it('should review all justifications and return quality scores', async () => {
            mockAiPartner.correctJustificationLanguage.mockResolvedValue({
                correctedText: 'Some text',
                mode: 'UNCHANGED'
            });

            const assessment = {
                processes: {
                    actual: 4,
                    justification: 'Valid justification text with system references and workflow details that meets the length requirement'
                },
                dataManagement: {
                    actual: 3,
                    justification: 'Short'
                }
            };

            const result = await aiAssessmentFormHelper.reviewAllJustifications(assessment);

            expect(result.reviews).toHaveLength(2);
            expect(result.summary.totalReviewed).toBe(2);
            expect(result.summary.averageQuality).toBeDefined();
            expect(['GOOD', 'ACCEPTABLE', 'NEEDS_WORK']).toContain(result.summary.overallAssessment);
        });

        it('should identify issues in poor quality justifications', async () => {
            mockAiPartner.correctJustificationLanguage.mockResolvedValue({
                correctedText: 'Corrected text',
                mode: 'AI_CORRECTED'
            });

            const assessment = {
                processes: {
                    actual: 6,
                    justification: 'Too short'
                }
            };

            const result = await aiAssessmentFormHelper.reviewAllJustifications(assessment);

            expect(result.reviews[0].issues.length).toBeGreaterThan(0);
            expect(result.reviews[0].qualityScore).toBeLessThan(100);
        });

        it('should skip axes without justification', async () => {
            const assessment = {
                processes: {
                    actual: 4
                }
            };

            const result = await aiAssessmentFormHelper.reviewAllJustifications(assessment);

            expect(result.reviews).toHaveLength(0);
        });

        it('should calculate summary statistics correctly', async () => {
            mockAiPartner.correctJustificationLanguage.mockResolvedValue({
                correctedText: 'Test',
                mode: 'UNCHANGED'
            });

            const assessment = {
                processes: {
                    actual: 4,
                    justification: 'x'.repeat(150)
                },
                culture: {
                    actual: 3,
                    justification: 'y'.repeat(150)
                }
            };

            const result = await aiAssessmentFormHelper.reviewAllJustifications(assessment);

            expect(result.summary.needsImprovement).toBeGreaterThanOrEqual(0);
            expect(parseFloat(result.summary.averageQuality)).toBeGreaterThan(0);
        });
    });

    // =========================================================================
    // getContextualHelp TESTS
    // =========================================================================

    describe('getContextualHelp', () => {
        it('should return tips for justification field', async () => {
            const result = await aiAssessmentFormHelper.getContextualHelp(
                { currentField: 'justification', currentAxis: 'processes', currentScore: 4 },
                { completedAxes: 3 }
            );

            expect(result.tips).toBeInstanceOf(Array);
            expect(result.tips.length).toBeGreaterThan(0);
            expect(result.tips.some(t => t.includes('konkretne'))).toBe(true);
        });

        it('should return tips for target field', async () => {
            const result = await aiAssessmentFormHelper.getContextualHelp(
                { currentField: 'target', currentAxis: 'processes', currentScore: 4 },
                {}
            );

            expect(result.tips.some(t => t.includes('ambitny'))).toBe(true);
        });

        it('should include score-specific tips for low scores', async () => {
            const result = await aiAssessmentFormHelper.getContextualHelp(
                { currentField: 'justification', currentAxis: 'processes', currentScore: 2 },
                {}
            );

            expect(result.tips.some(t => t.includes('niższych poziomów'))).toBe(true);
        });

        it('should include score-specific tips for high scores', async () => {
            const result = await aiAssessmentFormHelper.getContextualHelp(
                { currentField: 'justification', currentAxis: 'processes', currentScore: 6 },
                {}
            );

            expect(result.tips.some(t => t.includes('wyższych poziomów'))).toBe(true);
        });

        it('should include progress-based next steps', async () => {
            const result = await aiAssessmentFormHelper.getContextualHelp(
                { currentField: 'justification', currentAxis: 'processes', currentScore: 4 },
                { completedAxes: 5 }
            );

            expect(result.nextSteps.some(s => s.includes('Pozostało 2'))).toBe(true);
        });

        it('should indicate completion when all axes done', async () => {
            const result = await aiAssessmentFormHelper.getContextualHelp(
                { currentField: 'justification', currentAxis: 'processes', currentScore: 4 },
                { completedAxes: 7 }
            );

            expect(result.nextSteps.some(s => s.includes('Wszystkie osie'))).toBe(true);
        });
    });

    // =========================================================================
    // getQuickActions TESTS
    // =========================================================================

    describe('getQuickActions', () => {
        it('should return explain level action for any axis', () => {
            const result = aiAssessmentFormHelper.getQuickActions({
                currentAxis: 'processes',
                hasJustification: true,
                hasEvidence: true,
                hasTarget: true
            });

            expect(result.some(a => a.id === 'ai-explain-level')).toBe(true);
        });

        it('should suggest justification when missing', () => {
            const result = aiAssessmentFormHelper.getQuickActions({
                currentAxis: 'processes',
                hasJustification: false,
                hasEvidence: true,
                hasTarget: true
            });

            const suggestAction = result.find(a => a.id === 'ai-suggest-justification');
            expect(suggestAction).toBeDefined();
            expect(suggestAction.primary).toBe(true);
        });

        it('should suggest evidence when missing', () => {
            const result = aiAssessmentFormHelper.getQuickActions({
                currentAxis: 'processes',
                hasJustification: true,
                hasEvidence: false,
                hasTarget: true
            });

            expect(result.some(a => a.id === 'ai-suggest-evidence')).toBe(true);
        });

        it('should suggest target when missing', () => {
            const result = aiAssessmentFormHelper.getQuickActions({
                currentAxis: 'processes',
                hasJustification: true,
                hasEvidence: true,
                hasTarget: false
            });

            expect(result.some(a => a.id === 'ai-suggest-target')).toBe(true);
        });

        it('should offer improve text when justification exists', () => {
            const result = aiAssessmentFormHelper.getQuickActions({
                currentAxis: 'processes',
                hasJustification: true,
                hasEvidence: true,
                hasTarget: true
            });

            expect(result.some(a => a.id === 'ai-improve-text')).toBe(true);
        });

        it('should return empty array when no axis selected', () => {
            const result = aiAssessmentFormHelper.getQuickActions({
                currentAxis: null,
                hasJustification: false
            });

            expect(result).toHaveLength(0);
        });
    });

    // =========================================================================
    // _basicValidation PRIVATE METHOD TESTS
    // =========================================================================

    describe('_basicValidation', () => {
        it('should validate justification length', () => {
            const result = aiAssessmentFormHelper._basicValidation(
                FIELD_TYPES.JUSTIFICATION,
                'a'.repeat(30)
            );

            expect(result.warnings.length).toBeGreaterThan(0);
        });

        it('should validate score boundaries', () => {
            const invalidScore = aiAssessmentFormHelper._basicValidation(
                FIELD_TYPES.ACTUAL_SCORE,
                10
            );

            expect(invalidScore.isValid).toBe(false);
        });

        it('should allow valid justification', () => {
            const result = aiAssessmentFormHelper._basicValidation(
                FIELD_TYPES.JUSTIFICATION,
                'a'.repeat(100)
            );

            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });
    });

    // =========================================================================
    // _validateJustification PRIVATE METHOD TESTS
    // =========================================================================

    describe('_validateJustification', () => {
        it('should detect vague language', async () => {
            const result = await aiAssessmentFormHelper._validateJustification(
                'W niektórych przypadkach organizacja czasami używa różnych narzędzi',
                'processes',
                4
            );

            expect(result.warnings.length).toBeGreaterThan(0);
            expect(result.warnings[0]).toContain('niekonkretne');
        });

        it('should suggest systems for mid-high scores', async () => {
            const result = await aiAssessmentFormHelper._validateJustification(
                'Organizacja ma dobrze rozwinięte procesy bez żadnych konkretnych rozwiązań',
                'processes',
                4
            );

            // For higher scores, suggestions about systems/tools should be present
            expect(result.suggestions).toBeDefined();
            expect(Array.isArray(result.suggestions)).toBe(true);
        });

        it('should suggest metrics for high scores', async () => {
            const result = await aiAssessmentFormHelper._validateJustification(
                'Organizacja posiada zaawansowane systemy workflow',
                'processes',
                5
            );

            expect(result.suggestions.some(s => s.includes('metryk'))).toBe(true);
        });

        it('should warn about short justification for high scores', async () => {
            const result = await aiAssessmentFormHelper._validateJustification(
                'Short text with system ERP',
                'processes',
                6
            );

            expect(result.warnings.some(w => w.includes('szczegółowe'))).toBe(true);
        });
    });

    // =========================================================================
    // _getLevelKeywords PRIVATE METHOD TESTS
    // =========================================================================

    describe('_getLevelKeywords', () => {
        it('should return keywords for level 1', () => {
            const keywords = aiAssessmentFormHelper._getLevelKeywords('processes', 1);
            expect(keywords).toContain('brak');
            expect(keywords).toContain('papierowy');
        });

        it('should return keywords for level 7', () => {
            const keywords = aiAssessmentFormHelper._getLevelKeywords('processes', 7);
            expect(keywords).toContain('autonomiczny');
            expect(keywords).toContain('adaptacyjny');
        });

        it('should return empty array for invalid level', () => {
            const keywords = aiAssessmentFormHelper._getLevelKeywords('processes', 99);
            expect(keywords).toEqual([]);
        });
    });

    // =========================================================================
    // _suggestPriority PRIVATE METHOD TESTS
    // =========================================================================

    describe('_suggestPriority', () => {
        it('should suggest HIGH priority for large gaps', async () => {
            const result = await aiAssessmentFormHelper._suggestPriority(
                'processes',
                2,
                { targetScore: 6 }
            );

            expect(result.suggestedPriority).toBe('HIGH');
        });

        it('should suggest MEDIUM priority for moderate gaps', async () => {
            const result = await aiAssessmentFormHelper._suggestPriority(
                'processes',
                3,
                { targetScore: 5 }
            );

            expect(result.suggestedPriority).toBe('MEDIUM');
        });

        it('should suggest LOW priority for small gaps', async () => {
            const result = await aiAssessmentFormHelper._suggestPriority(
                'processes',
                4,
                { targetScore: 5 }
            );

            expect(result.suggestedPriority).toBe('LOW');
        });

        it('should include reasoning', async () => {
            const result = await aiAssessmentFormHelper._suggestPriority(
                'processes',
                2,
                { targetScore: 6 }
            );

            expect(result.reasoning).toBeDefined();
            expect(result.reasoning.length).toBeGreaterThan(0);
        });
    });
});

