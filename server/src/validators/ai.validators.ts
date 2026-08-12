/**
 * AI Route Validators
 * Zod schemas for AI request validation
 */

import { z } from 'zod';

// Chat Request
export const ChatRequestSchema = z.object({
  message: z.string().min(1, 'Message is required'),
  projectId: z.string().uuid().optional(),
  currentScreen: z.string().optional(),
  selectedObjectId: z.string().optional(),
  selectedObjectType: z.string().optional(),
});

// Chat Confirm Request (Deep Thinking Confirm step)
export const ChatConfirmRequestSchema = z.object({
  message: z.string().min(1, 'Message is required'),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant', 'model']),
        content: z.string().optional(),
        parts: z
          .array(
            z.object({
              text: z.string(),
            })
          )
          .optional(),
      })
    )
    .optional(),
  systemInstruction: z.string().optional(),
  context: z.record(z.string(), z.unknown()).optional(),
  roleName: z.string().optional(),
  // Keep parity with stream schema for ToolsMenu & routing
  projectId: z.string().uuid().optional(),
  screenContext: z.record(z.string(), z.unknown()).nullable().optional(),
  focusMode: z.string().optional(),
  selectedTier: z.enum(['BUDGET', 'STANDARD', 'PREMIUM', 'REASONING']).optional(),
  selectedModelId: z.union([z.string().min(1), z.null()]).optional(),
  // Privacy
  privateMode: z.boolean().optional(),
  aiModes: z
    .object({
      deepResearch: z.boolean().optional(),
      webSearch: z.boolean().optional(),
      showReasoning: z.boolean().optional(),
      multiAgent: z.boolean().optional(),
      marketResearch: z.boolean().optional(),
      coThinkerMode: z.union([z.string().min(1), z.null()]).optional(),
      privateMode: z.boolean().optional(),
    })
    .nullable()
    .optional(),
  knowledgeSources: z
    .object({
      pmoDocuments: z.boolean().optional(),
      projectData: z.boolean().optional(),
      organizationData: z.boolean().optional(),
    })
    .optional(),
  // Free-text user steering ("how Teresa should answer"). Whitelisted so validateBody
  // does not strip it — required for the steering feature to reach the system prompt.
  customInstructions: z.string().max(4000).optional(),
  responseStyle: z
    .enum([
      'normal',
      'executive',
      'analyst',
      'coach',
      'concise',
      'formal',
      'professional',
      'friendly',
    ])
    .optional(),
  language: z
    .string()
    .transform((lang) => {
      if (!lang) return 'en';
      const base = lang.split('-')[0].toLowerCase();
      // 'jp' accepted for one release as a legacy input alias (S23-LOCALE,
      // 2026-08-12: 'jp' was not valid BCP47 for Japanese, migrated to 'ja').
      const mappedBase = base === 'jp' ? 'ja' : base;
      const validLangs = ['pl', 'en', 'de', 'es', 'ja', 'ar'];
      return validLangs.includes(mappedBase) ? mappedBase : 'en';
    })
    .optional(),
  conversationId: z.string().optional(),
});

// Chat Stream Request
export const ChatStreamRequestSchema = z.object({
  message: z.string().min(1, 'Message is required'),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant', 'model']),
        content: z.string().optional(),
        parts: z
          .array(
            z.object({
              text: z.string(),
            })
          )
          .optional(),
      })
    )
    .optional(),
  systemInstruction: z.string().optional(),
  context: z.record(z.string(), z.unknown()).optional(),
  roleName: z.string().optional(),
  // NOTE: these fields are intentionally whitelisted because validateBody()
  // replaces req.body with parsed data, stripping unknown keys by default.
  // They are required for end-to-end chat feature toggles (ToolsMenu), routing, and context.
  projectId: z.string().uuid().optional(),
  screenContext: z.record(z.string(), z.unknown()).nullable().optional(),
  focusMode: z.string().optional(),
  selectedTier: z.enum(['BUDGET', 'STANDARD', 'PREMIUM', 'REASONING']).optional(),
  selectedModelId: z.union([z.string().min(1), z.null()]).optional(),
  // Explicit provider override (used for per-user local inference like Ollama)
  provider: z.string().min(1).optional(),
  endpoint: z.string().min(1).optional(),
  // Privacy
  privateMode: z.boolean().optional(),
  assistantScope: z.enum(['anna_public', 'teresa_tenant']).optional(),
  memoryScope: z.enum(['public_product', 'tenant', 'org', 'user', 'project']).optional(),
  aiModes: z
    .object({
      deepResearch: z.boolean().optional(),
      webSearch: z.boolean().optional(),
      showReasoning: z.boolean().optional(),
      multiAgent: z.boolean().optional(),
      marketResearch: z.boolean().optional(),
      coThinkerMode: z.union([z.string().min(1), z.null()]).optional(),
      privateMode: z.boolean().optional(),
    })
    .optional(),
  knowledgeSources: z
    .object({
      pmoDocuments: z.boolean().optional(),
      projectData: z.boolean().optional(),
      organizationData: z.boolean().optional(),
    })
    .optional(),
  // Free-text user steering ("how Teresa should answer"). Whitelisted so validateBody
  // does not strip it — required for the steering feature to reach the system prompt.
  customInstructions: z.string().max(4000).optional(),
  responseStyle: z
    .enum([
      'normal',
      'executive',
      'analyst',
      'coach',
      'concise',
      'formal',
      'professional',
      'friendly',
    ])
    .optional(),
  language: z
    .string()
    .transform((lang) => {
      // Accept locale variants like 'en-GB', 'en-US', etc. and convert to base code
      if (!lang) return 'en';
      const base = lang.split('-')[0].toLowerCase();
      // 'jp' accepted for one release as a legacy input alias (S23-LOCALE,
      // 2026-08-12: 'jp' was not valid BCP47 for Japanese, migrated to 'ja').
      const mappedBase = base === 'jp' ? 'ja' : base;
      const validLangs = ['pl', 'en', 'de', 'es', 'ja', 'ar'];
      return validLangs.includes(mappedBase) ? mappedBase : 'en';
    })
    .optional(),
  conversationId: z.preprocess(
    (v) => (v === null || v === '' ? undefined : v),
    z.string().min(1).optional()
  ),
  resumeFromPartial: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// Agent Audit Layer (Post-DeepThinking)
// ---------------------------------------------------------------------------

export const AgentAuditDecisionContextSchema = z.object({
  topic: z.string().min(1, 'topic is required'),
  industry: z.string().optional(),
  horizon: z.string().optional(),
  functions: z.array(z.string()).optional().default([]),
  riskFocus: z.array(z.string()).optional().default([]),
});

export const AgentAuditSuggestRequestSchema = z.object({
  decisionContext: AgentAuditDecisionContextSchema,
  userIntent: z.enum(['validate', 'stress_test', 'approve']).optional().default('validate'),
  language: z
    .string()
    .transform((lang) => {
      if (!lang) return 'en';
      const base = lang.split('-')[0].toLowerCase();
      // 'jp' accepted for one release as a legacy input alias (S23-LOCALE,
      // 2026-08-12: 'jp' was not valid BCP47 for Japanese, migrated to 'ja').
      const mappedBase = base === 'jp' ? 'ja' : base;
      const validLangs = ['pl', 'en', 'de', 'es', 'ja', 'ar'];
      return validLangs.includes(mappedBase) ? mappedBase : 'en';
    })
    .optional(),
  maxAgents: z
    .union([z.literal(2), z.literal(3), z.literal(4)])
    .optional()
    .default(3),
});

export const AgentAuditReviewRequestSchema = z.object({
  decisionContext: AgentAuditDecisionContextSchema,
  deepThinkingReport: z.string().min(1, 'deepThinkingReport is required'),
  agentIds: z.array(z.string().min(1)).min(1),
  conversationId: z.string().optional(),
  dtSessionId: z.string().optional(),
  webSearchEnabled: z.boolean().optional().default(false),
  userIntent: z.enum(['validate', 'stress_test', 'approve']).optional().default('validate'),
  language: z
    .string()
    .transform((lang) => {
      if (!lang) return 'en';
      const base = lang.split('-')[0].toLowerCase();
      // 'jp' accepted for one release as a legacy input alias (S23-LOCALE,
      // 2026-08-12: 'jp' was not valid BCP47 for Japanese, migrated to 'ja').
      const mappedBase = base === 'jp' ? 'ja' : base;
      const validLangs = ['pl', 'en', 'de', 'es', 'ja', 'ar'];
      return validLangs.includes(mappedBase) ? mappedBase : 'en';
    })
    .optional(),
  selectedTier: z.enum(['BUDGET', 'STANDARD', 'PREMIUM', 'REASONING']).optional(),
  selectedModelId: z.union([z.string().min(1), z.null()]).optional(),
  loopIteration: z
    .union([z.literal(1), z.literal(2)])
    .optional()
    .default(1),
});

export const AgentAuditAcceptRunRequestSchema = z.object({
  note: z.string().max(2000).optional(),
});

// AI Context Query
export const AIContextQuerySchema = z.object({
  screen: z.string().optional(),
});

// AI Policy Update Request
export const UpdatePolicyRequestSchema = z.record(z.string(), z.unknown());

// Can Perform Action Query
export const CanPerformActionQuerySchema = z.object({
  projectId: z.string().uuid().optional(),
});

// Record Decision Request
export const RecordDecisionRequestSchema = z.object({
  decisionId: z.string().uuid(),
  title: z.string().min(1),
  outcome: z.string().min(1),
  rationale: z.string().optional(),
});

// Update User Preferences Request
export const UpdateUserPreferencesRequestSchema = z.record(z.string(), z.unknown());

/**
 * V8 chat-emission addendum.
 *
 * Any V8-aware endpoint that operates on an `ai_actions` lifecycle can pass
 * `conversationId` to wire the action to a chat thread so governed
 * proposal / progress / result messages get persisted inline (Chat V8
 * §ACTIONS_AND_APPROVALS). Fully optional — absence preserves legacy behavior.
 */
const ChatEmissionFieldsSchema = {
  conversationId: z.string().uuid().optional(),
  planSummary: z.string().max(500).optional(),
  stepCount: z.number().int().nonnegative().optional(),
  steps: z
    .array(
      z.object({
        id: z.string().optional(),
        label: z.string().optional(),
        description: z.string().optional(),
      })
    )
    .optional(),
  risk: z.enum(['low', 'medium', 'high']).optional(),
};

// Create Draft Request
export const CreateDraftRequestSchema = z.object({
  draftType: z.string().min(1),
  content: z.string().min(1),
  projectId: z.string().uuid(),
  ...ChatEmissionFieldsSchema,
});

// Get Pending Actions Query
export const GetPendingActionsQuerySchema = z.object({
  projectId: z.string().uuid().optional(),
});

// Approve Action Request
export const ApproveActionRequestSchema = z.object({
  alwaysApprove: z.boolean().optional(),
  ...ChatEmissionFieldsSchema,
});

// Reject Action Request
export const RejectActionRequestSchema = z.object({
  reason: z.string().optional(),
  alwaysReject: z.boolean().optional(),
  ...ChatEmissionFieldsSchema,
});

// Execute Action Request (V8 addition) — optional chat emission hint
export const ExecuteActionRequestSchema = z.object({
  ...ChatEmissionFieldsSchema,
});

// Generate Proposals Query
export const GenerateProposalsQuerySchema = z.object({
  organizationId: z.string().uuid().optional(),
});

// Recommend Request
export const RecommendRequestSchema = z.object({
  diagnosisReport: z.object({
    assessment: z.record(z.string(), z.unknown()).optional(),
    goals: z.array(z.string()).optional(),
    painPoints: z.array(z.string()).optional(),
    industry: z.string().optional(),
  }),
});

// Roadmap Request
export const RoadmapRequestSchema = z.object({
  initiatives: z
    .array(
      z.object({
        id: z.string().optional(),
        name: z.string(),
        priority: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']).optional(),
        complexity: z.string().optional(),
        expectedRoi: z.number().optional(),
        roi: z.number().optional(),
      })
    )
    .min(1),
});

const InitiativeAIItemSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  priority: z.string().optional(),
  owner: z.string().optional(),
  // Accept both full ISO date-time and HTML date input (YYYY-MM-DD) to match initiative validators.
  plannedStartDate: z
    .string()
    .transform((v) => String(v ?? '').trim())
    .refine(
      (v) => {
        if (!v) return true;
        if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return true;
        return z.string().datetime().safeParse(v).success;
      },
      { message: 'Invalid date format (expected YYYY-MM-DD or ISO datetime)' }
    )
    .optional(),
  plannedEndDate: z
    .string()
    .transform((v) => String(v ?? '').trim())
    .refine(
      (v) => {
        if (!v) return true;
        if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return true;
        return z.string().datetime().safeParse(v).success;
      },
      { message: 'Invalid date format (expected YYYY-MM-DD or ISO datetime)' }
    )
    .optional(),
  capacity: z.number().optional(),
});

const InitiativeDependencySchema = z.object({
  fromInitiativeId: z.string(),
  toInitiativeId: z.string(),
  type: z.string().optional(),
});

export const InitiativeConflictsRequestSchema = z.object({
  initiatives: z.array(InitiativeAIItemSchema).min(1),
  dependencies: z.array(InitiativeDependencySchema).optional(),
});

export const InitiativePrioritiesRequestSchema = z.object({
  initiatives: z.array(InitiativeAIItemSchema).min(1),
});

// Get Audit Logs Query
export const GetAuditLogsQuerySchema = z.object({
  projectId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  actionType: z.string().optional(),
  limit: z.string().transform(Number).pipe(z.number().int().positive().max(100)).default(50),
  offset: z.string().transform(Number).pipe(z.number().int().nonnegative()).default(0),
});

// Record Decision for Audit Request
export const RecordAuditDecisionRequestSchema = z.object({
  decision: z.enum(['approved', 'rejected', 'deferred']),
  feedback: z.string().optional(),
});

// Get Explanations Query
export const GetExplanationsQuerySchema = z.object({
  limit: z.string().transform(Number).pipe(z.number().int().positive().max(100)).default(50),
  offset: z.string().transform(Number).pipe(z.number().int().nonnegative()).default(0),
});

// Export Explanations Query
export const ExportExplanationsQuerySchema = z.object({
  projectId: z.string().uuid().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

// Get Suggestions Query
export const GetSuggestionsQuerySchema = z.object({
  projectId: z.string().uuid().optional(),
  screenContext: z.string().optional(),
});

// Post Suggestions Request
export const PostSuggestionsRequestSchema = z.object({
  projectId: z.string().uuid().optional(),
  conversationContext: z.record(z.string(), z.unknown()).optional(),
});

// Record Suggestion Action Request
export const RecordSuggestionActionRequestSchema = z.object({
  suggestionId: z.string().uuid(),
  action: z.enum(['accepted', 'dismissed', 'clicked']),
  feedback: z.string().optional(),
});

// Get Suggestion Metrics Query
export const GetSuggestionMetricsQuerySchema = z.object({
  days: z.string().transform(Number).pipe(z.number().int().positive()).default(30),
});

// Calculate Quality Request
export const CalculateQualityRequestSchema = z.object({
  query: z.string().min(1),
  response: z.string().min(1),
  context: z.record(z.string(), z.unknown()).optional(),
  sources: z.array(z.string()).optional(),
});

// Get Aggregate Quality Query
export const GetAggregateQualityQuerySchema = z.object({
  days: z.string().transform(Number).pipe(z.number().int().positive()).default(30),
});

// Get Quality Trends Query
export const GetQualityTrendsQuerySchema = z.object({
  days: z.string().transform(Number).pipe(z.number().int().positive()).default(30),
});

// Get Patterns Query
export const GetPatternsQuerySchema = z.object({
  actionType: z.string().optional(),
});

// Toggle Auto-Apply Request
export const ToggleAutoApplyRequestSchema = z.object({
  enabled: z.boolean(),
});

// Record Feedback Request
export const RecordFeedbackRequestSchema = z.object({
  messageId: z.string().uuid(),
  rating: z.enum(['up', 'down']),
});

// Report Message Request
export const ReportMessageRequestSchema = z.object({
  messageId: z.string().uuid(),
  reason: z.string().min(1),
});

// Get Memory Metrics Query
export const GetMemoryMetricsQuerySchema = z.object({
  period: z.string().transform(Number).pipe(z.number().int().positive()).default(7),
});

// Get Current Memory Query
export const GetCurrentMemoryQuerySchema = z.object({
  projectId: z.string().uuid().optional(),
});

// Get Memory Latency Query
export const GetMemoryLatencyQuerySchema = z.object({
  hours: z.string().transform(Number).pipe(z.number().int().positive()).default(24),
});

// ID Params
export const ProjectIdParamSchema = z.object({
  projectId: z.string().uuid(),
});

export const ActionIdParamSchema = z.object({
  id: z.string().uuid(),
});

export const ActionIdParamSchemaAlt = z.object({
  actionId: z.string().uuid(),
});

export const PatternIdParamSchema = z.object({
  patternId: z.string().uuid(),
});

export const AuditIdParamSchema = z.object({
  id: z.string().uuid(),
});

export const SessionIdParamSchema = z.object({
  sessionId: z.string(),
});

export const ActionTypeParamSchema = z.object({
  actionType: z.string(),
});

// Refine Text Request (AI Field Enhancer)
export const RefineTextRequestSchema = z.object({
  text: z.string().min(1, 'Text to refine is required'),
  mode: z.enum(['improve', 'shorten', 'expand', 'formal', 'generate']),
  systemInstruction: z.string().optional(),
  fieldLabel: z.string().optional(),
  artifactContext: z
    .object({
      title: z.string().optional(),
      status: z.string().optional(),
      priority: z.string().optional(),
      type: z.string(),
    })
    .optional(),
  language: z.string().optional(),
});

// ── Canvas inline-AI quick edit (floating selection menu) ───────────
// Non-streaming single-shot transform of a selected fragment.
// Consumed by src/components/AIChat/CanvasEditor/CanvasRichEditor.tsx.
export const ChatQuickRequestSchema = z.object({
  // C1.4: cap message + selectedText. /chat/quick is the cheap path the canvas
  // floating menu calls; without a length cap, a "select entire 200KB doc and
  // Improve" turn is fully chargeable. Floating-menu copy is short by design.
  message: z.string().min(1, 'Message is required').max(8000, 'Message too long'),
  context: z
    .object({
      source: z.string().optional(),
      selectedText: z.string().max(16000, 'Selection too long').optional(),
    })
    .passthrough()
    .optional(),
  language: z.string().optional(),
});

export const AiGenerateRequestSchema = z.object({
  message: z.string().min(1).max(32000),
  systemInstruction: z.string().max(16000).optional(),
  roleName: z.string().max(200).optional(),
});

// ── T032: AI Authoring ──────────────────────────────────────────────

export const GenerateCardDraftRequestSchema = z.object({
  artifactType: z.enum(['initiative', 'task', 'decision']),
  brief: z.string().min(10).max(4000),
  projectId: z.string().uuid(),
  language: z.string().optional(),
});

export const AIAuthoringAuditRequestSchema = z.object({
  artifactType: z.enum(['initiative', 'task', 'decision']),
  artifactId: z.string().uuid().optional(),
  actionType: z.enum([
    'field_generate',
    'field_improve',
    'field_shorten',
    'field_expand',
    'field_formal',
    'card_generate',
  ]),
  fieldKey: z.string().optional(),
  inputText: z.string().optional(),
  outputText: z.string().optional(),
  wasApplied: z.boolean(),
  wasUndone: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

// ── T033: AI Readiness Analysis ────────────────────────────────────

export const AIReadinessAnalysisRequestSchema = z.object({
  initiativeId: z.string().uuid(),
  projectId: z.string().uuid(),
  targetGate: z.string().optional(),
  language: z.string().optional(),
});

// Type exports
export type RefineTextRequest = z.infer<typeof RefineTextRequestSchema>;
export type ChatRequest = z.infer<typeof ChatRequestSchema>;
export type ChatStreamRequest = z.infer<typeof ChatStreamRequestSchema>;
export type UpdatePolicyRequest = z.infer<typeof UpdatePolicyRequestSchema>;
export type RecordDecisionRequest = z.infer<typeof RecordDecisionRequestSchema>;
export type UpdateUserPreferencesRequest = z.infer<typeof UpdateUserPreferencesRequestSchema>;
export type CreateDraftRequest = z.infer<typeof CreateDraftRequestSchema>;
export type ApproveActionRequest = z.infer<typeof ApproveActionRequestSchema>;
export type RejectActionRequest = z.infer<typeof RejectActionRequestSchema>;
export type ExecuteActionRequest = z.infer<typeof ExecuteActionRequestSchema>;
export type RecommendRequest = z.infer<typeof RecommendRequestSchema>;
export type RoadmapRequest = z.infer<typeof RoadmapRequestSchema>;
export type InitiativeConflictsRequest = z.infer<typeof InitiativeConflictsRequestSchema>;
export type InitiativePrioritiesRequest = z.infer<typeof InitiativePrioritiesRequestSchema>;
export type RecordAuditDecisionRequest = z.infer<typeof RecordAuditDecisionRequestSchema>;
export type PostSuggestionsRequest = z.infer<typeof PostSuggestionsRequestSchema>;
export type RecordSuggestionActionRequest = z.infer<typeof RecordSuggestionActionRequestSchema>;
export type CalculateQualityRequest = z.infer<typeof CalculateQualityRequestSchema>;
export type ToggleAutoApplyRequest = z.infer<typeof ToggleAutoApplyRequestSchema>;
export type RecordFeedbackRequest = z.infer<typeof RecordFeedbackRequestSchema>;
export type ReportMessageRequest = z.infer<typeof ReportMessageRequestSchema>;
export type ProjectIdParam = z.infer<typeof ProjectIdParamSchema>;
export type ActionIdParam = z.infer<typeof ActionIdParamSchema>;
export type PatternIdParam = z.infer<typeof PatternIdParamSchema>;
export type AuditIdParam = z.infer<typeof AuditIdParamSchema>;
export type SessionIdParam = z.infer<typeof SessionIdParamSchema>;
export type ActionTypeParam = z.infer<typeof ActionTypeParamSchema>;
export type GenerateCardDraftRequest = z.infer<typeof GenerateCardDraftRequestSchema>;
export type AIReadinessAnalysisRequest = z.infer<typeof AIReadinessAnalysisRequestSchema>;
export type AIAuthoringAuditRequest = z.infer<typeof AIAuthoringAuditRequestSchema>;
