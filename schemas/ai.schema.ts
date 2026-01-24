import { z } from 'zod';

/**
 * Zod schema for LLMProvider as defined in types.ts
 */
export const LLMProviderSchema = z.object({
  id: z.string(),
  name: z.string(),
  provider: z.enum([
    'openai',
    'anthropic',
    'google',
    'mistral',
    'groq',
    'together',
    'nvidia',
    'deepseek',
    'qwen',
    'ernie',
    'z_ai',
    'ollama',
    'tavily',
    'google_search',
    'cohere',
  ]),
  api_key: z.string(),
  endpoint: z.string().optional(),
  model_id: z.string(),
  cost_per_1k: z.number(),
  input_cost_per_1k: z.number().optional(),
  output_cost_per_1k: z.number().optional(),
  markup_multiplier: z.number().optional(),
  is_active: z.boolean(),
  is_default: z.boolean().optional(),
  visibility: z.enum(['admin', 'public', 'beta']),
  priority: z.number().optional(),
  is_enabled_for_org: z.boolean().optional(),
  context_window: z.number().optional(),
  max_outputs: z.number().optional(),
  description: z.string().optional(),
  capabilities: z.array(z.string()).optional(),
  healthStatus: z.enum(['healthy', 'degraded', 'unhealthy', 'unknown']).optional(),
  lastHealthCheck: z.string().optional(),
  supportsVision: z.boolean().optional(),
  supportsTools: z.boolean().optional(),
  supportsStreaming: z.boolean().optional(),
  tier: z.string().optional(),
  isConfigured: z.boolean().optional(),
});

/**
 * Schema for Idea objects used in AI suggestions.
 */
export const IdeaSchema = z.object({
  id: z.string(),
  category: z.enum(['quickwin', 'process', 'ai']),
  title: z.string(),
  description: z.string(),
  difficulty: z.number().int().min(1).max(3),
  impactDescription: z.string(),
  area: z.enum(['Procesy', 'Dane', 'AI / Automatyzacja']),
  isSelected: z.boolean(),
});

/**
 * Schema for chat UI option buttons.
 */
export const ChatOptionSchema = z.object({
  id: z.string(),
  label: z.string(),
  value: z.string(),
});

/**
 * Schema for citations attached to AI responses.
 */
export const ChatCitationSchema = z.object({
  id: z.string(),
  type: z.enum(['assessment', 'initiative', 'report', 'roadmap', 'external']),
  title: z.string(),
  reference: z.string(),
  link: z.string().optional(),
  excerpt: z.string().optional(),
  entityId: z.string().optional(),
});

/**
 * Schema for action buttons that can be returned by the AI.
 */
export const ChatResponseActionSchema = z.object({
  id: z.string(),
  type: z.enum(['navigate', 'execute', 'expand', 'copy']),
  label: z.string(),
  icon: z.string().optional(),
  payload: z.object({
    view: z.string().optional(),
    apiCall: z.string().optional(),
    data: z.record(z.string(), z.unknown()).optional(),
    copyText: z.string().optional(),
  }),
});

/**
 * Schema for generated artifacts (code, markdown, diagrams, etc.).
 */
export const ArtifactSchema = z.object({
  id: z.string(),
  type: z.enum(['markdown', 'code', 'html', 'diagram', 'table', 'pmo-document']),
  title: z.string(),
  content: z.string(),
  language: z.string().optional(),
  editable: z.boolean(),
  version: z.number(),
  createdAt: z.date(),
  updatedAt: z.date().optional(),
  metadata: z
    .object({
      framework: z.string().optional(),
      templateType: z.string().optional(),
      exportFormats: z.array(z.string()).optional(),
    })
    .optional(),
});

/**
 * Schema for thinking steps used in chain‑of‑thought reasoning.
 */
export const ThinkingStepSchema = z.object({
  id: z.string(),
  label: z.string(),
  content: z.string(),
  status: z.enum(['pending', 'in_progress', 'done']),
  timestamp: z.date(),
  durationMs: z.number().optional(),
  category: z.enum(['analysis', 'research', 'synthesis', 'validation']).optional(),
});

/**
 * Schema for user feedback on AI messages.
 */
export const MessageFeedbackSchema = z.object({
  rating: z.enum(['positive', 'negative']),
  reason: z.string().optional(),
  timestamp: z.date(),
});

/**
 * Comprehensive schema for a chat message returned by the AI service.
 */
export const ChatMessageSchema = z.object({
  id: z.string(),
  role: z.enum(['ai', 'user']),
  content: z.string(),
  timestamp: z.date(),
  type: z.enum(['text', 'action_request', 'summary', 'file', 'tool_call']).optional(),
  options: z.array(ChatOptionSchema).optional(),
  multiSelect: z.boolean().optional(),
  toolCalls: z
    .array(
      z.object({
        name: z.string(),
        args: z.record(z.string(), z.unknown()),
        result: z.unknown().optional(),
        status: z.enum(['pending', 'approved', 'rejected', 'executed']).optional(),
      })
    )
    .optional(),
  isThinking: z.boolean().optional(),
  citations: z.array(ChatCitationSchema).optional(),
  actions: z.array(ChatResponseActionSchema).optional(),
  artifacts: z.array(ArtifactSchema).optional(),
  thinkingSteps: z.array(ThinkingStepSchema).optional(),
  canEdit: z.boolean().optional(),
  regenerateCount: z.number().optional(),
  focusMode: z.enum(['all', 'pmo-docs', 'project-data', 'research', 'web']).optional(),
  feedback: MessageFeedbackSchema.optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  parentMessageId: z.string().optional(),
  isStreaming: z.boolean().optional(),
  streamProgress: z.number().optional(),
});

/**
 * Schema for AI message history entries used in streaming contexts.
 */
export const AIMessageHistorySchema = z.object({
  role: z.enum(['user', 'model']),
  parts: z.array(z.object({ text: z.string() })),
});

/**
 * Example export of a collection of schemas for easy import elsewhere.
 */
export const AISchemas = {
  LLMProviderSchema,
  IdeaSchema,
  ChatOptionSchema,
  ChatCitationSchema,
  ChatResponseActionSchema,
  ArtifactSchema,
  ThinkingStepSchema,
  MessageFeedbackSchema,
  ChatMessageSchema,
  AIMessageHistorySchema,
};
