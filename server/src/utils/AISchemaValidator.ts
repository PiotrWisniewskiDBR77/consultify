/**
 * AI Schema Validator
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Enforces strict typing and structure on AI-generated responses.
 * Uses Zod for runtime validation.
 */

import { z } from 'zod';

import logger from './Logger.ts';

// ==========================================
// SCHEMAS
// ==========================================

export const GapRecommendationSchema = z.object({
    title: z.string(),
    description: z.string(),
    priority: z.enum(['HIGH', 'MEDIUM', 'LOW']).or(z.string()), // Allow string fallback if AI gets creative
    timeframe: z.string(),
});

export const GapAnalysisSchema = z.array(GapRecommendationSchema);

export const EvidenceSchema = z.array(z.string());

export const InitiativeSchema = z.object({
    name: z.string(),
    description: z.string(),
    targetAxes: z.array(z.string()),
    priority: z.enum(['HIGH', 'MEDIUM', 'LOW']).or(z.string()),
    estimatedDuration: z.string(),
    estimatedBudget: z.string(),
    expectedImpact: z.string(),
    dependencies: z.array(z.string()).optional(),
});

export const InitiativeListSchema = z.array(InitiativeSchema);

export const PrioritizedInitiativeSchema = z.object({
    rank: z.number(),
    name: z.string(),
    priorityScore: z.number(),
    reasoning: z.string(),
    recommendedQuarter: z.string(),
});

export const PrioritizedListSchema = z.array(PrioritizedInitiativeSchema);

export const ROIEstimateSchema = z.object({
    estimatedCost: z.string(),
    estimatedBenefitYear1: z.string(),
    estimatedBenefitYear3: z.string(),
    paybackPeriod: z.string(),
    roiPercentage3Years: z.string(),
    confidenceLevel: z.enum(['HIGH', 'MEDIUM', 'LOW']).or(z.string()),
    assumptions: z.array(z.string()),
    risks: z.array(z.string()),
});

// ==========================================
// VALIDATION HELPER
// ==========================================

/**
 * Validates data against a schema.
 * @param data - The data to validate
 * @param schema - The Zod schema
 * @param fallback - Fallback value if validation fails
 * @returns Validated data or fallback
 */
export function validateOrFallback<T>(data: unknown, schema: z.ZodSchema<T>, fallback: T): T {
    try {
        const result = schema.safeParse(data);
        if (result.success) {
            return result.data;
        } else {
            logger.warn('[AIValidator] Validation failed:', result.error.flatten());
            return fallback;
        }
    } catch (error: unknown) {
        logger.error('[AIValidator] Unexpected validation error:', error);
        return fallback;
    }
}
