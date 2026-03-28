/**
 * V8 Chat → Execution Integration Service
 *
 * Connects the chat surface to the execution/approval spine.
 * Implements: hybrid intent classification (Decision W2-1), handoff creation,
 * chat action proposal facade (Decision W2-2), and conversation-scoped queries.
 *
 * Uses existing Wave 1 services — does NOT duplicate snapshot or run logic.
 */

import { v4 as uuidv4 } from 'uuid';

import type {
  ChatActionProposal,
  ChatExecutionHandoff,
  CreateChatActionProposalParams,
  InitiateHandoffParams,
  IntentClassification,
  RenderingHints,
} from '../../types/chatExecutionIntegration.js';
import {
  ClassifyIntentParamsSchema,
  CreateChatActionProposalParamsSchema,
  InitiateHandoffParamsSchema,
} from '../../types/chatExecutionIntegration.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';
import * as contextSnapshotService from './contextSnapshotService.js';
import * as executionSpineService from './executionSpineService.js';

// ==========================================
// HELPERS
// ==========================================

const LOG_PREFIX = '[V8:ChatExecution]';

function safeJsonParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    logger.warn(`${LOG_PREFIX} Failed to parse JSON, using fallback`);
    return fallback;
  }
}

// ==========================================
// ROW TYPES
// ==========================================

interface HandoffRow {
  handoff_id: string;
  conversation_id: string;
  context_snapshot_id: string;
  execution_run_id: string;
  organization_id: string;
  initiator_user_id: string;
  intent_classification: string;
  goal: string;
  created_at: string;
}

interface ChatProposalRow {
  chat_proposal_id: string;
  conversation_id: string;
  message_id: string;
  underlying_proposal_id: string;
  organization_id: string;
  display_summary: string;
  rendering_hints: string;
  created_at: string;
}

// ==========================================
// ROW MAPPERS
// ==========================================

const DEFAULT_INTENT: IntentClassification = {
  intentType: 'ambiguous',
  confidence: 0,
  suggestedAction: 'ask_user_confirmation',
  reasoning: '',
  classifiedAt: '',
};

const DEFAULT_HINTS: RenderingHints = {
  style: 'card_collapsed',
  showPreview: false,
  showRiskBadge: false,
  collapsible: true,
  expirationWarning: false,
};

function rowToHandoff(row: HandoffRow): ChatExecutionHandoff {
  return {
    handoffId: row.handoff_id,
    conversationId: row.conversation_id,
    contextSnapshotId: row.context_snapshot_id,
    executionRunId: row.execution_run_id,
    organizationId: row.organization_id,
    initiatorUserId: row.initiator_user_id,
    intentClassification: safeJsonParse(row.intent_classification, DEFAULT_INTENT),
    goal: row.goal,
    createdAt: row.created_at,
  };
}

function rowToChatProposal(row: ChatProposalRow): ChatActionProposal {
  return {
    chatProposalId: row.chat_proposal_id,
    conversationId: row.conversation_id,
    messageId: row.message_id,
    underlyingProposalId: row.underlying_proposal_id,
    organizationId: row.organization_id,
    displaySummary: row.display_summary,
    renderingHints: safeJsonParse(row.rendering_hints, DEFAULT_HINTS),
    createdAt: row.created_at,
  };
}

// ==========================================
// INTENT CLASSIFICATION (Decision W2-1)
// ==========================================

/**
 * Hybrid intent classification.
 *
 * Decision W2-1 rules:
 * - Clear conversational ask → stay in chat
 * - Clear governed work request → enter execution/proposal path
 * - Ambiguous → ask user whether this should become governed work
 *
 * Current implementation: heuristic stub (LLM call placeholder).
 * Production will replace the body with an actual LLM classification call.
 */
export async function classifyIntent(
  message: string,
  contextSnapshotId: string,
  organizationId: string
): Promise<IntentClassification> {
  ClassifyIntentParamsSchema.parse({ message, contextSnapshotId, organizationId });

  const now = new Date().toISOString();

  const governedPatterns = [
    /\b(create|build|generate|make)\b.*\b(report|deck|presentation|initiative|task)/i,
    /\b(update|modify|change|edit)\b.*\b(all|every|across)\b/i,
    /\b(execute|run|perform|carry out)\b.*\b(plan|workflow|process)/i,
    /\b(assign|reassign|delegate)\b.*\b(task|work|owner)/i,
  ];

  const conversationalPatterns = [
    /\b(what|how|why|when|where|who)\b.*\?$/i,
    /\b(explain|describe|summarize|tell me|show me)\b/i,
    /\b(status|progress|update on)\b.*\?$/i,
  ];

  const governedMatch = governedPatterns.some((p) => p.test(message));
  const conversationalMatch = conversationalPatterns.some((p) => p.test(message));

  if (governedMatch && !conversationalMatch) {
    return {
      intentType: 'governed_work',
      confidence: 0.85,
      suggestedAction: 'initiate_execution',
      reasoning: 'Message contains work-producing intent patterns',
      classifiedAt: now,
    };
  }

  if (conversationalMatch && !governedMatch) {
    return {
      intentType: 'conversational',
      confidence: 0.9,
      suggestedAction: 'continue_chat',
      reasoning: 'Message matches conversational question patterns',
      classifiedAt: now,
    };
  }

  return {
    intentType: 'ambiguous',
    confidence: 0.5,
    suggestedAction: 'ask_user_confirmation',
    reasoning:
      'Intent is ambiguous — both conversational and work-producing signals detected, or neither matched clearly',
    classifiedAt: now,
  };
}

// ==========================================
// HANDOFF LIFECYCLE
// ==========================================

/**
 * Initiate a handoff from chat to execution.
 *
 * 1. Retrieves the existing ContextSnapshot (validates it exists for the org).
 * 2. Creates an ExecutionAgentRun via executionSpineService.createRun().
 * 3. Records the handoff linking conversation → snapshot → run.
 */
export async function initiateHandoff(
  params: InitiateHandoffParams
): Promise<ChatExecutionHandoff> {
  const validated = InitiateHandoffParamsSchema.parse(params);

  const snapshot = await contextSnapshotService.getSnapshot(
    validated.contextSnapshotId,
    validated.organizationId
  );
  if (!snapshot) {
    throw new Error(
      `ContextSnapshot ${validated.contextSnapshotId} not found in organization ${validated.organizationId}`
    );
  }

  const run = await executionSpineService.createRun({
    organizationId: validated.organizationId,
    contextSnapshotId: validated.contextSnapshotId,
    initiatorUserId: validated.userId,
    goal: validated.goal,
  });

  const intentClassification = await classifyIntent(
    validated.goal,
    validated.contextSnapshotId,
    validated.organizationId
  );

  const handoffId = uuidv4();
  const now = new Date().toISOString();

  const handoff: ChatExecutionHandoff = {
    handoffId,
    conversationId: validated.conversationId,
    contextSnapshotId: validated.contextSnapshotId,
    executionRunId: run.runId,
    organizationId: validated.organizationId,
    initiatorUserId: validated.userId,
    intentClassification,
    goal: validated.goal,
    createdAt: now,
  };

  await dbRun(
    `INSERT INTO v8_chat_execution_handoffs (
      handoff_id, conversation_id, context_snapshot_id, execution_run_id,
      organization_id, initiator_user_id, intent_classification, goal, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      handoff.handoffId,
      handoff.conversationId,
      handoff.contextSnapshotId,
      handoff.executionRunId,
      handoff.organizationId,
      handoff.initiatorUserId,
      JSON.stringify(handoff.intentClassification),
      handoff.goal,
      handoff.createdAt,
    ]
  );

  logger.info(
    `${LOG_PREFIX} Handoff ${handoffId}: conversation ${validated.conversationId} → run ${run.runId}`
  );
  return handoff;
}

/**
 * Retrieve a handoff by ID with organization-level isolation.
 */
export async function getHandoff(
  handoffId: string,
  organizationId: string
): Promise<ChatExecutionHandoff | null> {
  const row = await dbGet<HandoffRow>(
    `SELECT * FROM v8_chat_execution_handoffs
     WHERE handoff_id = ? AND organization_id = ?`,
    [handoffId, organizationId],
    { fallback: true }
  );

  if (!row) return null;
  return rowToHandoff(row);
}

/**
 * Retrieve all handoffs for a conversation, scoped to an organization.
 */
export async function getHandoffsByConversation(
  conversationId: string,
  organizationId: string
): Promise<ChatExecutionHandoff[]> {
  const rows = await dbAll<HandoffRow>(
    `SELECT * FROM v8_chat_execution_handoffs
     WHERE conversation_id = ? AND organization_id = ?
     ORDER BY created_at ASC`,
    [conversationId, organizationId],
    { fallback: true }
  );

  return (rows || []).map(rowToHandoff);
}

// ==========================================
// CHAT ACTION PROPOSAL FACADE (Decision W2-2)
// ==========================================

/**
 * Create a ChatActionProposal wrapping an existing ActionProposal
 * with chat-specific rendering hints.
 */
export async function createChatActionProposal(
  params: CreateChatActionProposalParams
): Promise<ChatActionProposal> {
  const validated = CreateChatActionProposalParamsSchema.parse(params);

  const chatProposalId = uuidv4();
  const now = new Date().toISOString();

  const chatProposal: ChatActionProposal = {
    chatProposalId,
    conversationId: validated.conversationId,
    messageId: validated.messageId,
    underlyingProposalId: validated.underlyingProposalId,
    organizationId: validated.organizationId,
    displaySummary: validated.displaySummary,
    renderingHints: validated.renderingHints,
    createdAt: now,
  };

  await dbRun(
    `INSERT INTO v8_chat_action_proposals (
      chat_proposal_id, conversation_id, message_id, underlying_proposal_id,
      organization_id, display_summary, rendering_hints, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      chatProposal.chatProposalId,
      chatProposal.conversationId,
      chatProposal.messageId,
      chatProposal.underlyingProposalId,
      chatProposal.organizationId,
      chatProposal.displaySummary,
      JSON.stringify(chatProposal.renderingHints),
      chatProposal.createdAt,
    ]
  );

  logger.info(
    `${LOG_PREFIX} ChatProposal ${chatProposalId} wrapping ${validated.underlyingProposalId} in conversation ${validated.conversationId}`
  );
  return chatProposal;
}

/**
 * Retrieve all chat action proposals for a conversation, scoped to an organization.
 */
export async function getChatProposalsByConversation(
  conversationId: string,
  organizationId: string
): Promise<ChatActionProposal[]> {
  const rows = await dbAll<ChatProposalRow>(
    `SELECT * FROM v8_chat_action_proposals
     WHERE conversation_id = ? AND organization_id = ?
     ORDER BY created_at ASC`,
    [conversationId, organizationId],
    { fallback: true }
  );

  return (rows || []).map(rowToChatProposal);
}
