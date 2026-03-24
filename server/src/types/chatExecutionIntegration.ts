/**
 * V8 Chat → Execution Integration Types
 *
 * Wave 2 integration primitives connecting the chat surface to the execution/approval spine.
 * Implements Decision W2-1 (hybrid intent classification), W2-2 (facade alignment),
 * and W2-3 (dedicated messageType for governed proposals).
 *
 * Depends on Wave 1 types: contextSnapshot.ts, executionSpine.ts
 */

import { z } from 'zod';

// ==========================================
// ENUMS / LITERALS
// ==========================================

export const IntentTypeValues = ['conversational', 'governed_work', 'ambiguous'] as const;
export type IntentType = (typeof IntentTypeValues)[number];

export const SuggestedActionValues = [
  'continue_chat',
  'initiate_execution',
  'ask_user_confirmation',
] as const;
export type SuggestedAction = (typeof SuggestedActionValues)[number];

export const ProposalMessageTypeValues = [
  'execution_proposal',
  'execution_progress',
  'execution_result',
] as const;
export type ProposalMessageType = (typeof ProposalMessageTypeValues)[number];

export const RenderingHintStyleValues = [
  'inline_compact',
  'card_expanded',
  'card_collapsed',
  'diff_view',
] as const;
export type RenderingHintStyle = (typeof RenderingHintStyleValues)[number];

// ==========================================
// INTERFACES
// ==========================================

/**
 * Result of hybrid intent classification (Decision W2-1).
 * LLM classifies first; borderline cases require user confirmation.
 */
export interface IntentClassification {
  intentType: IntentType;
  confidence: number;
  suggestedAction: SuggestedAction;
  reasoning: string;
  classifiedAt: string;
}

/**
 * Rendering hints for chat-side proposal display.
 * Part of the facade alignment (Decision W2-2).
 */
export interface RenderingHints {
  style: RenderingHintStyle;
  showPreview: boolean;
  showRiskBadge: boolean;
  collapsible: boolean;
  expirationWarning: boolean;
}

/**
 * Wave 2 facade wrapping an ActionProposal with chat-specific rendering (Decision W2-2).
 * ChatActionProposal is a thin wrapper — it does not duplicate governance data.
 */
export interface ChatActionProposal {
  chatProposalId: string;
  conversationId: string;
  messageId: string;
  underlyingProposalId: string;
  organizationId: string;
  displaySummary: string;
  renderingHints: RenderingHints;
  createdAt: string;
}

/**
 * Dedicated messageType for governed proposals in chat (Decision W2-3).
 * Governed proposals render as explicit first-class proposal messages,
 * not hidden inside a generic `actions` field.
 */
export interface ProposalMessage {
  messageType: 'execution_proposal';
  conversationId: string;
  runId: string;
  proposalRefs: string[];
  planSummary: string;
  stepCount: number;
}

/**
 * Handoff record linking a chat conversation to an execution run.
 * Created when intent classification determines governed work.
 */
export interface ChatExecutionHandoff {
  handoffId: string;
  conversationId: string;
  contextSnapshotId: string;
  executionRunId: string;
  organizationId: string;
  initiatorUserId: string;
  intentClassification: IntentClassification;
  goal: string;
  createdAt: string;
}

// ==========================================
// ZOD SCHEMAS
// ==========================================

export const IntentClassificationSchema = z.object({
  intentType: z.enum(IntentTypeValues),
  confidence: z.number().min(0).max(1),
  suggestedAction: z.enum(SuggestedActionValues),
  reasoning: z.string().min(1),
  classifiedAt: z.string().min(1),
});

export const RenderingHintsSchema = z.object({
  style: z.enum(RenderingHintStyleValues),
  showPreview: z.boolean(),
  showRiskBadge: z.boolean(),
  collapsible: z.boolean(),
  expirationWarning: z.boolean(),
});

export const ChatActionProposalSchema = z.object({
  chatProposalId: z.string().uuid(),
  conversationId: z.string().uuid(),
  messageId: z.string().uuid(),
  underlyingProposalId: z.string().uuid(),
  organizationId: z.string().uuid(),
  displaySummary: z.string().min(1),
  renderingHints: RenderingHintsSchema,
  createdAt: z.string().min(1),
});

export const ProposalMessageSchema = z.object({
  messageType: z.literal('execution_proposal'),
  conversationId: z.string().uuid(),
  runId: z.string().uuid(),
  proposalRefs: z.array(z.string().uuid()),
  planSummary: z.string().min(1),
  stepCount: z.number().int().min(0),
});

export const ChatExecutionHandoffSchema = z.object({
  handoffId: z.string().uuid(),
  conversationId: z.string().uuid(),
  contextSnapshotId: z.string().uuid(),
  executionRunId: z.string().uuid(),
  organizationId: z.string().uuid(),
  initiatorUserId: z.string().uuid(),
  intentClassification: IntentClassificationSchema,
  goal: z.string().min(1),
  createdAt: z.string().min(1),
});

// ==========================================
// INPUT TYPES (for service layer)
// ==========================================

export interface ClassifyIntentParams {
  message: string;
  contextSnapshotId: string;
  organizationId: string;
}

export const ClassifyIntentParamsSchema = z.object({
  message: z.string().min(1),
  contextSnapshotId: z.string().uuid(),
  organizationId: z.string().uuid(),
});

export interface InitiateHandoffParams {
  conversationId: string;
  contextSnapshotId: string;
  userId: string;
  organizationId: string;
  goal: string;
}

export const InitiateHandoffParamsSchema = z.object({
  conversationId: z.string().uuid(),
  contextSnapshotId: z.string().uuid(),
  userId: z.string().uuid(),
  organizationId: z.string().uuid(),
  goal: z.string().min(1),
});

export interface CreateChatActionProposalParams {
  conversationId: string;
  messageId: string;
  underlyingProposalId: string;
  organizationId: string;
  displaySummary: string;
  renderingHints: RenderingHints;
}

export const CreateChatActionProposalParamsSchema = z.object({
  conversationId: z.string().uuid(),
  messageId: z.string().uuid(),
  underlyingProposalId: z.string().uuid(),
  organizationId: z.string().uuid(),
  displaySummary: z.string().min(1),
  renderingHints: RenderingHintsSchema,
});
