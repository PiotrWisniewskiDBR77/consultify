/**
 * AI Assessment Form Helper Service
 * Provides real-time assistance for assessment form filling
 * Includes field suggestions, validation, and autocomplete
 */

const { aiAssessmentPartner, DRD_AXES } = require('./aiAssessmentPartnerService');

// Field types for form assistance
const FIELD_TYPES = {
    JUSTIFICATION: 'justification',
    EVIDENCE: 'evidence',
    TARGET_SCORE: 'targetScore',
    ACTUAL_SCORE: 'actualScore',
    NOTES: 'notes',
    PRIORITY: 'priority'
};

// Validation rules for different field types
const VALIDATION_RULES = {
    justification: {
        minLength: 50,
        maxLength: 2000,
        required: true
    },
    evidence: {
        minItems: 1,
        maxItems: 10,
        required: false
    },
    score: {
        min: 1,
        max: 7,
        required: true
    }
};

class AIAssessmentFormHelper {
    constructor() {
        this.aiPartner = aiAssessmentPartner;
    }

    // =========================================================================
    // REAL-TIME FORM ASSISTANCE
    // =========================================================================

    /**
     * Get AI suggestion for any form field
     */
    async getFieldSuggestion(fieldType, context = {}) {
        const { axisId, score, existingValue, language = 'pl' } = context;

        switch (fieldType) {
            case FIELD_TYPES.JUSTIFICATION:
                return this.aiPartner.suggestJustification(axisId, score, {
                    ...context,
                    existingJustification: existingValue,
                    language
                });

            case FIELD_TYPES.EVIDENCE:
                return this.aiPartner.suggestEvidence(axisId, score, {
                    ...context,
                    language
                });

            case FIELD_TYPES.TARGET_SCORE:
                return this.aiPartner.suggestTargetScore(
                    axisId,
                    score, // current score
                    context.ambitionLevel || 'balanced',
                    context
                );

            case FIELD_TYPES.NOTES:
                return this._suggestNotes(axisId, score, context);

            case FIELD_TYPES.PRIORITY:
                return this._suggestPriority(axisId, score, context);

            default:
                return { error: `Unknown field type: ${fieldType}` };
        }
    }

    /**
     * Validate field value with AI-powered feedback
     */
    async validateFieldValue(fieldType, value, context = {}) {
        const { axisId, score } = context;
        const validationResult = {
            isValid: true,
            errors: [],
            warnings: [],
            suggestions: []
        };

        // Basic validation
        const basicValidation = this._basicValidation(fieldType, value);
        if (!basicValidation.isValid) {
            return basicValidation;
        }

        // AI-powered validation for justifications
        if (fieldType === FIELD_TYPES.JUSTIFICATION && value) {
            const aiValidation = await this._validateJustification(value, axisId, score);
            validationResult.warnings = aiValidation.warnings || [];
            validationResult.suggestions = aiValidation.suggestions || [];
        }

        // Score consistency check
        if (fieldType === FIELD_TYPES.ACTUAL_SCORE || fieldType === FIELD_TYPES.TARGET_SCORE) {
            if (context.fullAssessment) {
                const consistencyCheck = await this.aiPartner.validateScoreConsistency(
                    { ...context.fullAssessment, [axisId]: { actual: score } }
                );
                if (consistencyCheck.hasInconsistencies) {
                    validationResult.warnings.push(...consistencyCheck.inconsistencies.map(i => i.message));
                }
            }
        }

        return validationResult;
    }

    /**
     * Autocomplete partial text input
     */
    async autocompleteJustification(partialText, axisId, score, context = {}) {
        if (!partialText || partialText.length < 10) {
            return { 
                completion: '',
                message: 'Wpisz co najmniej 10 znaków, aby otrzymać sugestię.'
            };
        }

        return this.aiPartner.autocompleteJustification(partialText, axisId, score, context);
    }

    // =========================================================================
    // BATCH OPERATIONS
    // =========================================================================

    /**
     * Fill missing fields in assessment with AI suggestions
     */
    async fillMissingFields(assessment, fillStrategy = 'conservative') {
        const filledFields = {};
        const axes = Object.keys(DRD_AXES);

        for (const axisId of axes) {
            const axisData = assessment[axisId] || {};
            
            // Fill missing justification
            if (axisData.actual && (!axisData.justification || axisData.justification.length < 50)) {
                const suggestion = await this.aiPartner.suggestJustification(
                    axisId,
                    axisData.actual,
                    { industry: assessment.metadata?.industry }
                );
                
                if (suggestion.suggestion) {
                    filledFields[axisId] = {
                        ...filledFields[axisId],
                        justification: {
                            suggested: suggestion.suggestion,
                            autoFilled: fillStrategy !== 'suggest-only'
                        }
                    };
                }
            }

            // Suggest target if missing
            if (axisData.actual && !axisData.target) {
                const targetSuggestion = await this.aiPartner.suggestTargetScore(
                    axisId,
                    axisData.actual,
                    fillStrategy === 'aggressive' ? 'aggressive' : 'balanced'
                );
                
                if (targetSuggestion.suggestedTarget) {
                    filledFields[axisId] = {
                        ...filledFields[axisId],
                        target: {
                            suggested: targetSuggestion.suggestedTarget,
                            reasoning: targetSuggestion.reasoning,
                            autoFilled: fillStrategy !== 'suggest-only'
                        }
                    };
                }
            }

            // Suggest evidence if missing
            if (axisData.actual && (!axisData.evidence || axisData.evidence.length === 0)) {
                const evidenceSuggestion = await this.aiPartner.suggestEvidence(
                    axisId,
                    axisData.actual,
                    { industry: assessment.metadata?.industry }
                );
                
                if (evidenceSuggestion.evidence) {
                    filledFields[axisId] = {
                        ...filledFields[axisId],
                        evidence: {
                            suggested: evidenceSuggestion.evidence,
                            autoFilled: fillStrategy !== 'suggest-only'
                        }
                    };
                }
            }
        }

        return {
            filledFields,
            strategy: fillStrategy,
            axesProcessed: Object.keys(filledFields).length,
            mode: fillStrategy === 'suggest-only' ? 'SUGGESTIONS_ONLY' : 'AUTO_FILLED'
        };
    }

    /**
     * Review and improve all justifications
     */
    async reviewAllJustifications(assessment, options = {}) {
        const reviews = [];
        const axes = Object.keys(DRD_AXES);

        for (const axisId of axes) {
            const axisData = assessment[axisId];
            
            if (axisData?.justification) {
                const review = await this._reviewSingleJustification(
                    axisId,
                    axisData.actual,
                    axisData.justification,
                    options
                );
                
                reviews.push({
                    axisId,
                    axisName: DRD_AXES[axisId].name,
                    ...review
                });
            }
        }

        // Calculate summary statistics
        const needsImprovement = reviews.filter(r => r.qualityScore < 70).length;
        const avgQuality = reviews.reduce((sum, r) => sum + r.qualityScore, 0) / reviews.length;

        return {
            reviews,
            summary: {
                totalReviewed: reviews.length,
                needsImprovement,
                averageQuality: avgQuality.toFixed(1),
                overallAssessment: avgQuality >= 80 ? 'GOOD' : avgQuality >= 60 ? 'ACCEPTABLE' : 'NEEDS_WORK'
            }
        };
    }

    /**
     * Get contextual help for current form state
     */
    async getContextualHelp(formState, context = {}) {
        const { currentField, currentAxis, currentScore } = formState;
        const help = {
            tips: [],
            warnings: [],
            nextSteps: []
        };

        // Field-specific tips
        if (currentField === 'justification') {
            help.tips.push('Opisz konkretne systemy, procesy lub osiągnięcia wspierające tę ocenę.');
            help.tips.push('Unikaj ogólników - im więcej szczegółów, tym lepsza jakość oceny.');
            
            if (currentScore <= 2) {
                help.tips.push('Dla niższych poziomów skup się na opisie barier i planów poprawy.');
            } else if (currentScore >= 5) {
                help.tips.push('Dla wyższych poziomów uwzględnij metryki i dowody sukcesu.');
            }
        }

        if (currentField === 'target') {
            help.tips.push('Cel powinien być ambitny, ale realistyczny do osiągnięcia w 12-24 miesiącach.');
            help.tips.push('Rozważ zależności między osiami przy ustalaniu celów.');
        }

        // Axis-specific warnings
        if (currentAxis && currentScore) {
            const axis = DRD_AXES[currentAxis];
            if (axis) {
                help.tips.push(`Poziom ${currentScore} w ${axis.name}: ${axis.levels[currentScore]}`);
            }
        }

        // Progress-based next steps
        if (context.completedAxes) {
            const remaining = 7 - context.completedAxes;
            if (remaining > 0) {
                help.nextSteps.push(`Pozostało ${remaining} osi do oceny.`);
            } else {
                help.nextSteps.push('Wszystkie osie zostały ocenione. Możesz przejść do przeglądu całości.');
            }
        }

        return help;
    }

    // =========================================================================
    // QUICK ACTIONS
    // =========================================================================

    /**
     * Get quick action buttons for current context
     */
    getQuickActions(formState) {
        const actions = [];
        const { currentField, currentAxis, hasJustification, hasEvidence, hasTarget } = formState;

        if (currentAxis) {
            // Always available
            actions.push({
                id: 'ai-explain-level',
                label: 'Wyjaśnij poziom',
                icon: 'info',
                action: 'explainLevel'
            });

            if (!hasJustification) {
                actions.push({
                    id: 'ai-suggest-justification',
                    label: 'Zasugeruj uzasadnienie',
                    icon: 'wand',
                    action: 'suggestJustification',
                    primary: true
                });
            }

            if (!hasEvidence) {
                actions.push({
                    id: 'ai-suggest-evidence',
                    label: 'Zasugeruj dowody',
                    icon: 'list',
                    action: 'suggestEvidence'
                });
            }

            if (!hasTarget) {
                actions.push({
                    id: 'ai-suggest-target',
                    label: 'Zasugeruj cel',
                    icon: 'target',
                    action: 'suggestTarget'
                });
            }

            // Text improvement
            if (hasJustification) {
                actions.push({
                    id: 'ai-improve-text',
                    label: 'Popraw tekst',
                    icon: 'edit',
                    action: 'improveText'
                });
            }
        }

        return actions;
    }

    // =========================================================================
    // PRIVATE HELPERS
    // =========================================================================

    _basicValidation(fieldType, value) {
        const result = { isValid: true, errors: [], warnings: [] };

        if (fieldType === FIELD_TYPES.JUSTIFICATION) {
            const rules = VALIDATION_RULES.justification;
            if (rules.required && (!value || value.trim().length === 0)) {
                result.isValid = false;
                result.errors.push('Uzasadnienie jest wymagane.');
            } else if (value && value.length < rules.minLength) {
                result.warnings.push(`Uzasadnienie powinno mieć co najmniej ${rules.minLength} znaków (obecnie: ${value.length}).`);
            } else if (value && value.length > rules.maxLength) {
                result.isValid = false;
                result.errors.push(`Uzasadnienie nie może przekraczać ${rules.maxLength} znaków.`);
            }
        }

        if (fieldType === FIELD_TYPES.ACTUAL_SCORE || fieldType === FIELD_TYPES.TARGET_SCORE) {
            const rules = VALIDATION_RULES.score;
            if (value < rules.min || value > rules.max) {
                result.isValid = false;
                result.errors.push(`Ocena musi być w zakresie ${rules.min}-${rules.max}.`);
            }
        }

        return result;
    }

    async _validateJustification(text, axisId, score) {
        const warnings = [];
        const suggestions = [];

        // Check for vague language
        const vagueTerms = ['różne', 'niektóre', 'czasami', 'pewne', 'około', 'mniej więcej'];
        const foundVague = vagueTerms.filter(term => text.toLowerCase().includes(term));
        if (foundVague.length > 0) {
            warnings.push(`Uzasadnienie zawiera niekonkretne określenia: ${foundVague.join(', ')}. Rozważ podanie dokładniejszych danych.`);
        }

        // Check for evidence of specific systems/tools
        if (score >= 3 && !text.match(/\b(system|narzędzie|platforma|ERP|CRM|BI|AI|ML|workflow)\b/i)) {
            suggestions.push('Dla tego poziomu dojrzałości warto wymienić konkretne systemy lub narzędzia.');
        }

        // Check for metrics
        if (score >= 4 && !text.match(/\d+%|\d+\s*(rok|miesiąc|dzień|godzin)/i)) {
            suggestions.push('Rozważ dodanie konkretnych metryk (np. "95% procesów", "w ciągu 2 lat").');
        }

        // Check justification length relative to score
        if (score >= 5 && text.length < 150) {
            warnings.push('Dla wysokich poziomów dojrzałości zalecane jest bardziej szczegółowe uzasadnienie.');
        }

        return { warnings, suggestions };
    }

    async _reviewSingleJustification(axisId, score, justification, options = {}) {
        let qualityScore = 100;
        const issues = [];
        const improvements = [];

        // Length check
        if (justification.length < 100) {
            qualityScore -= 20;
            issues.push('Zbyt krótkie uzasadnienie');
            improvements.push('Rozbuduj uzasadnienie o więcej szczegółów');
        }

        // Specificity check
        const hasSpecifics = justification.match(/\b(system|narzędzie|proces|certyfikat|ISO|ERP|CRM|AI)\b/i);
        if (!hasSpecifics) {
            qualityScore -= 15;
            issues.push('Brak konkretnych odniesień');
            improvements.push('Dodaj nazwy systemów, certyfikatów lub procesów');
        }

        // Metrics check
        const hasMetrics = justification.match(/\d+%|\d+\s*(rok|lat|miesięcy|pracownik)/i);
        if (!hasMetrics && score >= 4) {
            qualityScore -= 10;
            issues.push('Brak metryk dla wysokiego poziomu');
            improvements.push('Dodaj konkretne liczby i wskaźniki');
        }

        // Score-justification alignment check
        const axis = DRD_AXES[axisId];
        const levelKeywords = this._getLevelKeywords(axisId, score);
        const hasRelevantKeywords = levelKeywords.some(kw => 
            justification.toLowerCase().includes(kw.toLowerCase())
        );
        if (!hasRelevantKeywords) {
            qualityScore -= 15;
            issues.push('Uzasadnienie nie odpowiada poziomowi');
            improvements.push(`Dla poziomu ${score} uwzględnij: ${levelKeywords.slice(0, 3).join(', ')}`);
        }

        // Language quality
        const correctionResult = await this.aiPartner.correctJustificationLanguage(
            justification, 
            options.language || 'pl'
        );
        if (correctionResult.correctedText !== justification && correctionResult.mode === 'AI_CORRECTED') {
            qualityScore -= 5;
            improvements.push('Popraw jakość językową tekstu');
        }

        return {
            qualityScore: Math.max(0, qualityScore),
            issues,
            improvements,
            suggestedImprovement: improvements.length > 0 ? correctionResult.correctedText : null
        };
    }

    _getLevelKeywords(axisId, score) {
        const keywordsByLevel = {
            1: ['brak', 'ręczny', 'papierowy', 'podstawowy'],
            2: ['arkusze', 'email', 'podstawowe narzędzia', 'częściowy'],
            3: ['dedykowane systemy', 'standaryzacja', 'dokumentacja', 'procesy'],
            4: ['integracja', 'automatyzacja', 'workflow', 'analityka'],
            5: ['end-to-end', 'zaawansowany', 'predykcja', 'ML'],
            6: ['AI', 'optymalizacja', 'real-time', 'autonomiczny'],
            7: ['samouczący', 'autonomiczny', 'adaptacyjny', 'innowacyjny']
        };

        return keywordsByLevel[score] || [];
    }

    async _suggestNotes(axisId, score, context) {
        const axis = DRD_AXES[axisId];
        if (!axis) return { error: 'Invalid axis' };

        return {
            suggestion: `Dodatkowe uwagi dotyczące oceny ${axis.name} na poziomie ${score}.`,
            prompts: [
                'Jakie są główne wyzwania?',
                'Jakie inicjatywy są w toku?',
                'Kto jest odpowiedzialny za ten obszar?'
            ]
        };
    }

    async _suggestPriority(axisId, score, context) {
        const gap = context.targetScore ? context.targetScore - score : 0;
        
        let priority;
        if (gap >= 3) {
            priority = 'HIGH';
        } else if (gap >= 2) {
            priority = 'MEDIUM';
        } else {
            priority = 'LOW';
        }

        return {
            suggestedPriority: priority,
            reasoning: gap >= 3 
                ? 'Duży gap wymaga priorytetowego działania'
                : gap >= 2 
                    ? 'Umiarkowany gap - rekomendowany średni priorytet'
                    : 'Mały gap - możliwe szybkie zamknięcie'
        };
    }
}

// Export singleton instance
const aiAssessmentFormHelper = new AIAssessmentFormHelper();

module.exports = {
    AIAssessmentFormHelper,
    aiAssessmentFormHelper,
    FIELD_TYPES,
    VALIDATION_RULES
};

