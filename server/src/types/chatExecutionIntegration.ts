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

/**
 * Source governance table for a unified `ChatProposalView`.
 *
 * - `ai_actions`          — the legacy governance table, driven by
 *                           `AIActionExecutor` (approve/reject/execute).
 * - `v8_action_proposals` — the canonical V8 governance table, driven by
 *                           `executionSpineService`.
 * - `archived`            — the governance row no longer exists; the view is
 *                           reconstructed from the chat-message snapshot only.
 */
export const ProposalGovernanceSourceValues = [
  'ai_actions',
  'v8_action_proposals',
  'archived',
] as const;
export type ProposalGovernanceSource = (typeof ProposalGovernanceSourceValues)[number];

/**
 * Unified read view over proposals, merging governance truth with chat
 * surface rendering and thread context. This is the canonical shape returned
 * by `GET /api/ai/conversations/:conversationId/proposals`.
 *
 * Contract (Chat V8 / Wave A6):
 * - `lifecycleState` is sourced from the governance row when available,
 *   falling back to the latest chat-message snapshot otherwise.
 * - `messageIds` preserves the chronological chain of thread messages
 *   (`execution_proposal` → `execution_progress` → `execution_result`).
 * - Consumers MUST treat this view as read-only; writes still flow through
 *   the established approve/reject/execute endpoints.
 */
export interface ChatProposalView {
  proposalId: string;
  source: ProposalGovernanceSource;
  conversationId: string;
  chatProposalId?: string;
  messageIds: string[];
  latestMessageType?: ProposalMessageType;
  lifecycleState: V8LifecycleState;
  actionType?: string;
  planSummary: string;
  stepCount?: number;
  steps?: Array<{ id?: string; label?: string; description?: string }>;
  risk?: string;
  renderingHints?: Record<string, unknown>;
  reviewer?: { userId?: string; name?: string } | null;
  rejectionReason?: string | null;
  createdAt: string;
  updatedAt?: string | null;
  resolvedAt?: string | null;
  expiresAt?: string | null;
}

export const RenderingHintStyleValues = [
  'inline_compact',
  'card_expanded',
  'card_collapsed',
  'diff_view',
] as const;
export type RenderingHintStyle = (typeof RenderingHintStyleValues)[number];

/**
 * V8 canonical action lifecycle vocabulary (Chat V8 §ACTIONS_AND_APPROVALS).
 *
 * Public/user-visible states exposed to clients. This is the single canonical
 * vocabulary for the proposal → approval → execution → audit lifecycle as
 * defined by CHAT_V8_ACTIONS_AND_APPROVALS.md.
 *
 * - `proposed`       — AI has produced a proposal, not yet visible as review.
 * - `pending_review` — queued for explicit human approval in the chat thread.
 * - `approved`       — reviewer accepted; execution allowed but not yet started.
 * - `rejected`       — reviewer declined; terminal.
 * - `executing`      — side-effectful execution is in flight.
 * - `executed`       — side-effect applied successfully.
 * - `failed`         — execution attempted but failed.
 * - `audited`        — post-execution audit record closed; terminal success.
 *
 * This vocabulary is exposed ALONGSIDE the legacy DB enum (PENDING/APPROVED/
 * REJECTED/EXECUTED) via `mapDbActionStatusToV8Lifecycle` — the DB storage
 * remains unchanged until a dedicated migration lands.
 */
export const V8LifecycleStateValues = [
  'proposed',
  'pending_review',
  'approved',
  'rejected',
  'executing',
  'executed',
  'failed',
  'audited',
] as const;
export type V8LifecycleState = (typeof V8LifecycleStateValues)[number];

/**
 * Map legacy DB ai_actions.status values to the V8 canonical vocabulary.
 *
 * The mapping is intentionally conservative and lossy-forward only:
 *   PENDING  → pending_review   (an AI proposal awaiting human review)
 *   APPROVED → approved
 *   REJECTED → rejected
 *   EXECUTED → executed         (audited promotion happens post-log externally)
 *
 * Callers that have additional signal (e.g. an audit entry exists, or the
 * executor is actively running) may override the result to `executing`,
 * `failed`, or `audited`.
 */
export function mapDbActionStatusToV8Lifecycle(
  dbStatus: string | null | undefined
): V8LifecycleState {
  switch ((dbStatus || '').toUpperCase()) {
    case 'PENDING':
      return 'pending_review';
    case 'APPROVED':
      return 'approved';
    case 'REJECTED':
      return 'rejected';
    case 'EXECUTED':
      return 'executed';
    case 'FAILED':
      return 'failed';
    case 'EXECUTING':
      return 'executing';
    default:
      return 'proposed';
  }
}

/**
 * Inverse mapping for write paths that still target the legacy DB enum.
 * Any V8 state that does not exist in the DB enum collapses to the nearest
 * legacy equivalent so we never corrupt the storage contract.
 */
export function mapV8LifecycleToDbActionStatus(
  state: V8LifecycleState
): 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXECUTED' {
  switch (state) {
    case 'proposed':
    case 'pending_review':
      return 'PENDING';
    case 'approved':
    case 'executing':
      return 'APPROVED';
    case 'rejected':
      return 'REJECTED';
    case 'executed':
    case 'audited':
    case 'failed':
      return 'EXECUTED';
    default:
      return 'PENDING';
  }
}

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
  organizationId: z.string().min(1),
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
  organizationId: z.string().min(1),
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
  organizationId: z.string().min(1),
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
  organizationId: z.string().min(1),
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
  organizationId: z.string().min(1),
  displaySummary: z.string().min(1),
  renderingHints: RenderingHintsSchema,
});
