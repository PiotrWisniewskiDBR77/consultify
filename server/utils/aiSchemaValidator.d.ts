/**
 * Validates data against a schema.
 * @param {any} data - The data to validate
 * @param {z.ZodSchema} schema - The Zod schema
 * @param {any} fallback - Fallback value if validation fails
 * @returns {any} Validated data or fallback
 */
export function validateOrFallback(data: any, schema: z.ZodSchema, fallback: any): any;
export const GapAnalysisSchema: z.ZodArray<z.ZodObject<{
    title: z.ZodString;
    description: z.ZodString;
    priority: z.ZodUnion<[z.ZodEnum<{
        LOW: "LOW";
        MEDIUM: "MEDIUM";
        HIGH: "HIGH";
    }>, z.ZodString]>;
    timeframe: z.ZodString;
}, z.core.$strip>>;
export const EvidenceSchema: z.ZodArray<z.ZodString>;
export const InitiativeListSchema: z.ZodArray<z.ZodObject<{
    name: z.ZodString;
    description: z.ZodString;
    targetAxes: z.ZodArray<z.ZodString>;
    priority: z.ZodUnion<[z.ZodEnum<{
        LOW: "LOW";
        MEDIUM: "MEDIUM";
        HIGH: "HIGH";
    }>, z.ZodString]>;
    estimatedDuration: z.ZodString;
    estimatedBudget: z.ZodString;
    expectedImpact: z.ZodString;
    dependencies: z.ZodOptional<z.ZodArray<z.ZodString>>;
}, z.core.$strip>>;
export const PrioritizedListSchema: z.ZodArray<z.ZodObject<{
    rank: z.ZodNumber;
    name: z.ZodString;
    priorityScore: z.ZodNumber;
    reasoning: z.ZodString;
    recommendedQuarter: z.ZodString;
}, z.core.$strip>>;
export const ROIEstimateSchema: z.ZodObject<{
    estimatedCost: z.ZodString;
    estimatedBenefitYear1: z.ZodString;
    estimatedBenefitYear3: z.ZodString;
    paybackPeriod: z.ZodString;
    roiPercentage3Years: z.ZodString;
    confidenceLevel: z.ZodUnion<[z.ZodEnum<{
        LOW: "LOW";
        MEDIUM: "MEDIUM";
        HIGH: "HIGH";
    }>, z.ZodString]>;
    assumptions: z.ZodArray<z.ZodString>;
    risks: z.ZodArray<z.ZodString>;
}, z.core.$strip>;
import { z } from 'zod';
//# sourceMappingURL=aiSchemaValidator.d.ts.map