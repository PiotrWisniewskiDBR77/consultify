/**
 * Stage Gate Validators
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Zod schemas for stage gate-related API endpoints
 */

import { z } from 'zod';

// ==========================================
// ENUMS
// ==========================================

export const GateTypeEnum = z.enum([
    'CONTEXT_TO_PLANNING',
    'PLANNING_TO_EXECUTION',
    'EXECUTION_TO_MONITORING',
    'MONITORING_TO_CLOSURE',
    'CLOSURE_TO_COMPLETE',
]);

export const GateStatusEnum = z.enum(['not_started', 'in_progress', 'passed', 'failed']);

// ==========================================
// REQUEST SCHEMAS
// ==========================================

export const PassGateSchema = z.object({
    notes: z.string().max(1000).optional(),
});

// ==========================================
// TYPES
// ==========================================

export type PassGateRequest = z.infer<typeof PassGateSchema>;



