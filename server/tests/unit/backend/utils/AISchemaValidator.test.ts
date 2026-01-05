/**
 * AI Schema Validator Tests
 * Enterprise SaaS Architecture - TypeScript Backend
 * ETAP 10.3: Testy dla Utils Layer - 100% coverage
 */

import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import {
    GapAnalysisSchema,
    GapRecommendationSchema,
    InitiativeListSchema,
    InitiativeSchema,
    PrioritizedInitiativeSchema,
    PrioritizedListSchema,
    ROIEstimateSchema,
    validateOrFallback,
} from '../../../../src/utils/AISchemaValidator.js';

describe('AISchemaValidator', () => {
    describe('validateOrFallback', () => {
        const TestSchema = z.object({
            name: z.string(),
            age: z.number(),
        });

        it('should return validated data when valid', () => {
            const validData = { name: 'Test', age: 25 };
            const fallback = { name: 'Fallback', age: 0 };

            const result = validateOrFallback(validData, TestSchema, fallback);
            expect(result).toEqual(validData);
        });

        it('should return fallback when validation fails', () => {
            const invalidData = { name: 'Test' }; // Missing age
            const fallback = { name: 'Fallback', age: 0 };

            const result = validateOrFallback(invalidData, TestSchema, fallback);
            expect(result).toEqual(fallback);
        });

        it('should return fallback on unexpected error', () => {
            const invalidData = null;
            const fallback = { name: 'Fallback', age: 0 };

            // Mock console.warn to avoid noise in tests
            const originalWarn = console.warn;
            console.warn = vi.fn();

            const result = validateOrFallback(invalidData, TestSchema, fallback);
            expect(result).toEqual(fallback);

            console.warn = originalWarn;
        });
    });

    describe('GapRecommendationSchema', () => {
        it('should validate valid gap recommendation', () => {
            const valid = {
                title: 'Test Title',
                description: 'Test Description',
                priority: 'HIGH',
                timeframe: 'Q1 2024',
            };

            const result = GapRecommendationSchema.safeParse(valid);
            expect(result.success).toBe(true);
        });

        it('should accept string priority as fallback', () => {
            const valid = {
                title: 'Test Title',
                description: 'Test Description',
                priority: 'CUSTOM_PRIORITY',
                timeframe: 'Q1 2024',
            };

            const result = GapRecommendationSchema.safeParse(valid);
            expect(result.success).toBe(true);
        });
    });

    describe('GapAnalysisSchema', () => {
        it('should validate array of gap recommendations', () => {
            const valid = [
                {
                    title: 'Test 1',
                    description: 'Desc 1',
                    priority: 'HIGH',
                    timeframe: 'Q1',
                },
                {
                    title: 'Test 2',
                    description: 'Desc 2',
                    priority: 'MEDIUM',
                    timeframe: 'Q2',
                },
            ];

            const result = GapAnalysisSchema.safeParse(valid);
            expect(result.success).toBe(true);
        });
    });

    describe('InitiativeSchema', () => {
        it('should validate valid initiative', () => {
            const valid = {
                name: 'Test Initiative',
                description: 'Test Description',
                targetAxes: ['axis1', 'axis2'],
                priority: 'HIGH',
                estimatedDuration: '6 months',
                estimatedBudget: '$100k',
                expectedImpact: 'High impact',
            };

            const result = InitiativeSchema.safeParse(valid);
            expect(result.success).toBe(true);
        });

        it('should validate initiative with optional dependencies', () => {
            const valid = {
                name: 'Test Initiative',
                description: 'Test Description',
                targetAxes: ['axis1'],
                priority: 'MEDIUM',
                estimatedDuration: '3 months',
                estimatedBudget: '$50k',
                expectedImpact: 'Medium impact',
                dependencies: ['dep1', 'dep2'],
            };

            const result = InitiativeSchema.safeParse(valid);
            expect(result.success).toBe(true);
        });
    });

    describe('PrioritizedInitiativeSchema', () => {
        it('should validate prioritized initiative', () => {
            const valid = {
                rank: 1,
                name: 'Test Initiative',
                priorityScore: 85.5,
                reasoning: 'High impact',
                recommendedQuarter: 'Q1 2024',
            };

            const result = PrioritizedInitiativeSchema.safeParse(valid);
            expect(result.success).toBe(true);
        });
    });

    describe('ROIEstimateSchema', () => {
        it('should validate ROI estimate', () => {
            const valid = {
                estimatedCost: '$100k',
                estimatedBenefitYear1: '$50k',
                estimatedBenefitYear3: '$200k',
                paybackPeriod: '2 years',
                roiPercentage3Years: '100%',
                confidenceLevel: 'HIGH',
                assumptions: ['Assumption 1', 'Assumption 2'],
                risks: ['Risk 1'],
            };

            const result = ROIEstimateSchema.safeParse(valid);
            expect(result.success).toBe(true);
        });
    });
});
