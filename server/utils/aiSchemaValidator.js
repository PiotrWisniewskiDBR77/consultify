/**
 * AI Schema Validator
 * Enforces strict typing and structure on AI-generated responses.
 * Uses Zod for runtime validation.
 */

const { z } = require('zod');

// --- Schemas ---

const GapRecommendationSchema = z.object({
    title: z.string(),
    description: z.string(),
    priority: z.enum(['HIGH', 'MEDIUM', 'LOW']).or(z.string()), // Allow string fallback if AI gets creative
    timeframe: z.string()
});

const GapAnalysisSchema = z.array(GapRecommendationSchema);

const EvidenceSchema = z.array(z.string());

const InitiativeSchema = z.object({
    name: z.string(),
    description: z.string(),
    targetAxes: z.array(z.string()),
    priority: z.enum(['HIGH', 'MEDIUM', 'LOW']).or(z.string()),
    estimatedDuration: z.string(),
    estimatedBudget: z.string(),
    expectedImpact: z.string(),
    dependencies: z.array(z.string()).optional()
});

const InitiativeListSchema = z.array(InitiativeSchema);

const PrioritizedInitiativeSchema = z.object({
    rank: z.number(),
    name: z.string(),
    priorityScore: z.number(),
    reasoning: z.string(),
    recommendedQuarter: z.string()
});

const PrioritizedListSchema = z.array(PrioritizedInitiativeSchema);

const ROIEstimateSchema = z.object({
    estimatedCost: z.string(),
    estimatedBenefitYear1: z.string(),
    estimatedBenefitYear3: z.string(),
    paybackPeriod: z.string(),
    roiPercentage3Years: z.string(),
    confidenceLevel: z.enum(['HIGH', 'MEDIUM', 'LOW']).or(z.string()),
    assumptions: z.array(z.string()),
    risks: z.array(z.string())
});

// --- Validation Helper ---

/**
 * Validates data against a schema.
 * @param {any} data - The data to validate
 * @param {z.ZodSchema} schema - The Zod schema
 * @param {any} fallback - Fallback value if validation fails
 * @returns {any} Validated data or fallback
 */
function validateOrFallback(data, schema, fallback) {
    try {
        const result = schema.safeParse(data);
        if (result.success) {
            return result.data;
        } else {
            console.warn('[AIValidator] Validation failed:', result.error.flatten());
            return fallback;
        }
    } catch (error) {
        console.error('[AIValidator] Unexpected validation error:', error);
        return fallback;
    }
}

module.exports = {
    GapAnalysisSchema,
    EvidenceSchema,
    InitiativeListSchema,
    PrioritizedListSchema,
    ROIEstimateSchema,
    validateOrFallback
};
