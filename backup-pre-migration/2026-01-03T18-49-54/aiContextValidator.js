/**
 * AI Context Validator
 * 
 * ENTERPRISE SPEC COMPLIANCE:
 * - AI refuses when context is insufficient
 * - Explicit validation before AI responses
 * - Returns specific requirements when context missing
 * 
 * Usage:
 *   const validation = AiContextValidator.validate(context, requestType);
 *   if (!validation.valid) return validation.message;
 */

const REQUIRED_CONTEXT = {
    // Phase E - Guided First Value
    'drd_analysis': {
        required: ['organizationId', 'axisId'],
        recommended: ['industryContext', 'previousResponses'],
        minResponsesForFullAnalysis: 3,
    },

    // Phase E - Plan Generation
    'plan_generation': {
        required: ['organizationId', 'contextData'],
        recommended: ['goals', 'constraints', 'stakeholders'],
        minContextFields: 2,
    },

    // Phase F - Facilitation
    'facilitation': {
        required: ['organizationId', 'perspectives'],
        recommended: ['discussionTopic', 'participantRoles'],
        minPerspectives: 2,
    },

    // General Chat
    'chat': {
        required: [],
        recommended: ['phase', 'userState'],
    },

    // Analysis
    'recommendation': {
        required: ['organizationId', 'diagnosisData'],
        recommended: ['goals', 'constraints', 'timeline'],
        minDiagnosisAxes: 2,
    },
};

const REFUSAL_MESSAGES = {
    missing_org: {
        pl: 'Nie mogę przeanalizować bez kontekstu organizacji. Najpierw utwórz organizację.',
        en: 'I cannot analyze without organization context. Please create an organization first.',
    },
    missing_axis: {
        pl: 'Potrzebuję konkretnej osi DRD, aby przeanalizować. Wybierz oś.',
        en: 'I need a specific DRD axis to analyze. Please select an axis.',
    },
    insufficient_context: {
        pl: 'Mój kontekst jest zbyt ograniczony, aby dać wartościową odpowiedź. Dodaj więcej informacji o: {fields}.',
        en: 'My context is too limited for a valuable response. Please add more information about: {fields}.',
    },
    insufficient_perspectives: {
        pl: 'Potrzebuję minimum {min} perspektyw, aby przeprowadzić facylitację. Obecnie mam: {current}.',
        en: 'I need at least {min} perspectives for facilitation. Currently have: {current}.',
    },
    insufficient_diagnosis: {
        pl: 'Rekomendacje wymagają diagnozy na minimum {min} osiach. Obecne: {current}.',
        en: 'Recommendations require diagnosis on at least {min} axes. Currently have: {current}.',
    },
};

const AiContextValidator = {
    /**
     * Validate context for a specific request type
     * @param {object} context - The current context object
     * @param {string} requestType - Type of AI request
     * @param {string} lang - Language for refusal message ('pl' or 'en')
     * @returns {{ valid: boolean, message?: string, missingFields?: string[] }}
     */
    validate(context = {}, requestType = 'chat', lang = 'pl') {
        const spec = REQUIRED_CONTEXT[requestType] || REQUIRED_CONTEXT['chat'];
        const missingRequired = [];
        const missingRecommended = [];

        // Check required fields
        for (const field of spec.required || []) {
            if (!context[field]) {
                missingRequired.push(field);
            }
        }

        // Check recommended fields
        for (const field of spec.recommended || []) {
            if (!context[field]) {
                missingRecommended.push(field);
            }
        }

        // Hard fail on missing required
        if (missingRequired.length > 0) {
            // Return specific message for common cases
            if (missingRequired.includes('organizationId')) {
                return {
                    valid: false,
                    reason: 'MISSING_ORGANIZATION',
                    message: REFUSAL_MESSAGES.missing_org[lang],
                    missingFields: missingRequired,
                };
            }
            if (missingRequired.includes('axisId')) {
                return {
                    valid: false,
                    reason: 'MISSING_AXIS',
                    message: REFUSAL_MESSAGES.missing_axis[lang],
                    missingFields: missingRequired,
                };
            }
            if (missingRequired.includes('perspectives')) {
                const current = context.perspectives?.length || 0;
                const min = spec.minPerspectives || 2;
                return {
                    valid: false,
                    reason: 'INSUFFICIENT_PERSPECTIVES',
                    message: REFUSAL_MESSAGES.insufficient_perspectives[lang]
                        .replace('{min}', min)
                        .replace('{current}', current),
                    missingFields: missingRequired,
                };
            }

            return {
                valid: false,
                reason: 'MISSING_REQUIRED',
                message: REFUSAL_MESSAGES.insufficient_context[lang]
                    .replace('{fields}', missingRequired.join(', ')),
                missingFields: missingRequired,
            };
        }

        // Check min thresholds
        if (spec.minDiagnosisAxes) {
            const diagnosisAxes = context.diagnosisData?.axes?.length || 0;
            if (diagnosisAxes < spec.minDiagnosisAxes) {
                return {
                    valid: false,
                    reason: 'INSUFFICIENT_DIAGNOSIS',
                    message: REFUSAL_MESSAGES.insufficient_diagnosis[lang]
                        .replace('{min}', spec.minDiagnosisAxes)
                        .replace('{current}', diagnosisAxes),
                };
            }
        }

        if (spec.minPerspectives && context.perspectives) {
            const perspectives = context.perspectives?.length || 0;
            if (perspectives < spec.minPerspectives) {
                return {
                    valid: false,
                    reason: 'INSUFFICIENT_PERSPECTIVES',
                    message: REFUSAL_MESSAGES.insufficient_perspectives[lang]
                        .replace('{min}', spec.minPerspectives)
                        .replace('{current}', perspectives),
                };
            }
        }

        // Warn about missing recommended (but allow)
        if (missingRecommended.length > 0) {
            return {
                valid: true,
                warning: `Context could be improved with: ${missingRecommended.join(', ')}`,
                missingRecommended,
            };
        }

        return { valid: true };
    },

    /**
     * Validate and wrap AI response with context check
     * @param {object} context 
     * @param {string} requestType 
     * @param {Function} aiCall - The AI service call to wrap
     * @param {string} lang 
     * @returns {Promise<any>}
     */
    async validateAndCall(context, requestType, aiCall, lang = 'pl') {
        const validation = this.validate(context, requestType, lang);

        if (!validation.valid) {
            return {
                error: true,
                reason: validation.reason,
                message: validation.message,
                suggestion: validation.missingFields
                    ? `Dodaj: ${validation.missingFields.join(', ')}`
                    : null,
            };
        }

        // If valid, proceed with AI call
        const result = await aiCall();

        // Attach context warning if present
        if (validation.warning) {
            result._contextWarning = validation.warning;
        }

        return result;
    },

    /**
     * Get required context fields for a request type
     * @param {string} requestType 
     * @returns {{ required: string[], recommended: string[] }}
     */
    getRequirements(requestType) {
        const spec = REQUIRED_CONTEXT[requestType] || REQUIRED_CONTEXT['chat'];
        return {
            required: spec.required || [],
            recommended: spec.recommended || [],
        };
    },
};

module.exports = AiContextValidator;
