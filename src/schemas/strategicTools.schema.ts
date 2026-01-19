/**
 * Zod schemas for Strategic Tools validation
 *
 * Provides runtime validation for:
 * - Tool session data
 * - SWOT items and correlations
 * - Porter forces data
 * - Initiative drafts
 */

import { z } from 'zod';

// ==================== COMMON SCHEMAS ====================

export const impactSchema = z.enum(['high', 'medium', 'low']);
export const effortSchema = z.enum(['high', 'medium', 'low']);
export const trendSchema = z.enum(['increasing', 'stable', 'decreasing']);
export const stepStatusSchema = z.enum(['pending', 'in_progress', 'completed', 'skipped']);
export const sessionStatusSchema = z.enum(['draft', 'in_progress', 'completed']);

// ==================== SWOT SCHEMAS ====================

export const swotQuadrantSchema = z.enum(['strengths', 'weaknesses', 'opportunities', 'threats']);

export const swotItemSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1, 'Item text is required').max(500, 'Item text too long'),
  impact: impactSchema,
  quadrant: swotQuadrantSchema,
  source: z.enum(['user', 'ai']).optional(),
});

export const swotCorrelationTypeSchema = z.enum(['SO', 'WO', 'ST', 'WT']);

export const swotCorrelationSchema = z.object({
  id: z.string().min(1),
  items: z.array(z.string()).min(2, 'Correlation requires at least 2 items'),
  type: swotCorrelationTypeSchema,
  insight: z.string().min(1, 'Insight is required').max(1000),
  initiativeProposal: z.string().max(1000).optional(),
});

export const swotContextSchema = z.object({
  goal: z.string().min(1, 'Strategic goal is required').max(500),
  scope: z.string().min(1, 'Scope is required').max(500),
  timeframe: z.enum(['short', 'medium', 'long']),
});

export const swotDataSchema = z.object({
  context: swotContextSchema,
  items: z.array(swotItemSchema),
  correlations: z.array(swotCorrelationSchema),
  summary: z.object({
    keyInsights: z.array(z.string()),
    recommendedInitiatives: z.array(z.any()),
  }).optional(),
});

// ==================== PORTER SCHEMAS ====================

export const marketPositionSchema = z.enum(['leader', 'challenger', 'follower', 'niche']);

export const forceDataSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  score: z.number().min(1).max(5),
  trend: trendSchema,
  drivers: z.array(z.string()),
  aiAnalysis: z.string().optional(),
});

export const porterContextSchema = z.object({
  industry: z.string().min(1, 'Industry is required').max(300),
  geographicScope: z.string().max(300),
  position: marketPositionSchema,
});

export const porterForcesSchema = z.object({
  rivalry: forceDataSchema,
  newEntrants: forceDataSchema,
  substitutes: forceDataSchema,
  buyerPower: forceDataSchema,
  supplierPower: forceDataSchema,
});

export const porterDataSchema = z.object({
  context: porterContextSchema,
  forces: porterForcesSchema,
  overallAttractiveness: z.number().min(1).max(5).optional(),
  summary: z.object({
    keyInsights: z.array(z.string()),
    recommendedInitiatives: z.array(z.any()),
  }).optional(),
});

// ==================== INITIATIVE SCHEMAS ====================

export const initiativeTypeSchema = z.enum(['strategic', 'operational', 'defensive', 'growth']);

export const initiativeDraftSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(2000),
  type: initiativeTypeSchema,
  source: z.string(),
  linkedItems: z.array(z.string()),
  estimatedImpact: impactSchema,
  estimatedEffort: effortSchema,
  rationale: z.string().max(1000),
});

export const initiativeFormSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(2000).optional(),
  type: initiativeTypeSchema,
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  estimatedImpact: impactSchema,
  estimatedEffort: effortSchema,
  rationale: z.string().max(1000).optional(),
  owner: z.string().max(100).optional(),
  category: z.string().max(100).optional(),
  tags: z.array(z.string().max(50)).max(10),
});

// ==================== SESSION SCHEMAS ====================

export const toolTypeSchema = z.enum([
  'dynamic-swot',
  'market-forces',
  'growth-paths',
  'value-chain',
  'portfolio-priority',
  'ambition-decomposer',
  'focus-tradeoff',
  'risk-uncertainty',
  'capability-mapper',
  'narrative-engine',
]);

export const toolStepSchema = z.object({
  stepId: z.string().min(1),
  status: stepStatusSchema,
  data: z.record(z.unknown()),
  aiSuggestions: z.array(z.string()).optional(),
  completedAt: z.string().datetime().optional(),
});

export const chatMessageSchema = z.object({
  id: z.string().min(1),
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1).max(10000),
  timestamp: z.string().datetime(),
  stepId: z.string().optional(),
});

export const toolSessionSchema = z.object({
  id: z.string().min(1),
  toolType: toolTypeSchema,
  name: z.string().min(1).max(200),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  currentStep: z.number().min(1),
  steps: z.array(toolStepSchema),
  inputData: z.union([swotDataSchema, porterDataSchema, z.record(z.unknown())]),
  chatHistory: z.array(chatMessageSchema),
  generatedInitiatives: z.array(initiativeDraftSchema),
  status: sessionStatusSchema,
});

// ==================== VALIDATION HELPERS ====================

export const validateSWOTItem = (data: unknown) => {
  return swotItemSchema.safeParse(data);
};

export const validateSWOTContext = (data: unknown) => {
  return swotContextSchema.safeParse(data);
};

export const validatePorterContext = (data: unknown) => {
  return porterContextSchema.safeParse(data);
};

export const validateInitiativeForm = (data: unknown) => {
  return initiativeFormSchema.safeParse(data);
};

export const validateToolSession = (data: unknown) => {
  return toolSessionSchema.safeParse(data);
};

// ==================== TYPE EXPORTS ====================

export type SWOTItem = z.infer<typeof swotItemSchema>;
export type SWOTCorrelation = z.infer<typeof swotCorrelationSchema>;
export type SWOTContext = z.infer<typeof swotContextSchema>;
export type SWOTData = z.infer<typeof swotDataSchema>;
export type ForceData = z.infer<typeof forceDataSchema>;
export type PorterContext = z.infer<typeof porterContextSchema>;
export type PorterData = z.infer<typeof porterDataSchema>;
export type InitiativeDraft = z.infer<typeof initiativeDraftSchema>;
export type InitiativeForm = z.infer<typeof initiativeFormSchema>;
export type ToolType = z.infer<typeof toolTypeSchema>;
export type ToolSession = z.infer<typeof toolSessionSchema>;
