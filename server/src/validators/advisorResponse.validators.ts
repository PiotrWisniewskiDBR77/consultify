import { z } from 'zod';

export const AdvisorCitationSchema = z.object({
  id: z.string(),
  artifactType: z.enum([
    'assessment', 'initiative', 'report', 'roadmap', 'task', 'decision',
    'idea', 'tool_session', 'notebook', 'external', 'knowledge_base',
  ]),
  artifactId: z.string(),
  fragmentId: z.string().optional(),
  title: z.string(),
  excerpt: z.string().optional(),
  url: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
  verified: z.boolean().optional(),
});

export const ProposedActionSchema = z.object({
  id: z.string(),
  actionType: z.enum([
    'create_task', 'update_task', 'create_decision', 'update_decision',
    'create_initiative', 'update_initiative', 'create_raid_item',
    'send_notification', 'schedule_meeting', 'generate_report',
    'update_status', 'assign_user', 'set_field', 'custom',
  ]),
  label: z.string(),
  description: z.string().optional(),
  params: z.record(z.string(), z.unknown()),
  preview: z.string().optional(),
  diff: z.object({
    before: z.record(z.string(), z.unknown()).optional(),
    after: z.record(z.string(), z.unknown()),
  }).optional(),
  requiresApproval: z.boolean().default(false),
  estimatedImpact: z.enum(['low', 'medium', 'high']).optional(),
});

export const AdvisorQuestionSchema = z.object({
  id: z.string(),
  text: z.string(),
  questionType: z.enum(['clarification', 'confirmation', 'choice', 'open']),
  options: z.array(z.string()).optional(),
  required: z.boolean().default(false),
});

export const AdvisorResponseSchema = z.object({
  id: z.string(),
  intent: z.enum([
    'answer', 'analyze', 'recommend', 'create', 'update', 'explain',
    'compare', 'summarize', 'diagnose', 'plan', 'clarify', 'unknown',
  ]),
  answer: z.string(),
  citations: z.array(AdvisorCitationSchema).default([]),
  proposedActions: z.array(ProposedActionSchema).default([]),
  questions: z.array(AdvisorQuestionSchema).default([]),
  confidence: z.number().min(0).max(1),
  safetyNotes: z.array(z.string()).default([]),
  reasoning: z.string().optional(),
  metadata: z.object({
    model: z.string().optional(),
    tokensUsed: z.number().optional(),
    latencyMs: z.number().optional(),
    purpose: z.string().optional(),
    contextArtifacts: z.array(z.string()).default([]),
  }).optional(),
});

export type AdvisorResponse = z.infer<typeof AdvisorResponseSchema>;
export type AdvisorCitation = z.infer<typeof AdvisorCitationSchema>;
export type ProposedAction = z.infer<typeof ProposedActionSchema>;
export type AdvisorQuestion = z.infer<typeof AdvisorQuestionSchema>;

export function validateAdvisorResponse(data: unknown): {
  valid: boolean;
  data?: AdvisorResponse;
  errors?: z.ZodError;
} {
  const result = AdvisorResponseSchema.safeParse(data);
  if (result.success) return { valid: true, data: result.data };
  return { valid: false, errors: result.error };
}

export function normalizeToAdvisorResponse(
  rawResponse: any,
  options?: { intent?: string; purpose?: string },
): AdvisorResponse {
  return {
    id: rawResponse.id || crypto.randomUUID(),
    intent: (options?.intent || rawResponse.intent || 'answer') as AdvisorResponse['intent'],
    answer: rawResponse.answer || rawResponse.content || rawResponse.message || '',
    citations: (rawResponse.citations || []).map((c: any) => ({
      id: c.id || crypto.randomUUID(),
      artifactType: c.artifactType || c.type || 'external',
      artifactId: c.artifactId || c.entityId || c.id || '',
      fragmentId: c.fragmentId,
      title: c.title || '',
      excerpt: c.excerpt,
      url: c.url || c.link,
      confidence: c.confidence,
      verified: c.verified,
    })),
    proposedActions: (rawResponse.proposedActions || rawResponse.actions || []).map((a: any) => ({
      id: a.id || crypto.randomUUID(),
      actionType: a.actionType || a.type || 'custom',
      label: a.label || a.title || '',
      description: a.description,
      params: a.params || {},
      preview: a.preview,
      diff: a.diff,
      requiresApproval: a.requiresApproval ?? false,
      estimatedImpact: a.estimatedImpact,
    })),
    questions: (rawResponse.questions || []).map((q: any) => ({
      id: q.id || crypto.randomUUID(),
      text: q.text || q.question || '',
      questionType: q.questionType || 'open',
      options: q.options,
      required: q.required ?? false,
    })),
    confidence: rawResponse.confidence ?? 0.5,
    safetyNotes: rawResponse.safetyNotes || [],
    reasoning: rawResponse.reasoning,
    metadata: {
      model: rawResponse.model,
      tokensUsed: rawResponse.tokensUsed || rawResponse.token_count,
      latencyMs: rawResponse.latencyMs,
      purpose: options?.purpose || rawResponse.purpose,
      contextArtifacts: rawResponse.contextArtifacts || [],
    },
  };
}

export const AdvisorRespondRequestSchema = z.object({
  query: z.string().min(1),
  conversationId: z.string().optional(),
  context: z.object({
    artifactIds: z.array(z.string()).optional(),
    purpose: z.string().optional(),
  }).optional(),
});

export const AdvisorFeedbackRequestSchema = z.object({
  score: z.number().int().min(1).max(5),
  text: z.string().optional(),
});

export const AdvisorResponsesQuerySchema = z.object({
  conversationId: z.string().optional(),
  intent: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export const AdvisorExecuteActionRequestSchema = z.object({
  actionId: z.string().min(1),
});

export const AdvisorResponseIdParamSchema = z.object({
  responseId: z.string().min(1),
});
