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
 * =========================================================================
 * WHAT THIS REPLACES (2026-08-11, Stream B / CW-T-B)
 * =========================================================================
 * The previous body was a self-declared "heuristic stub (LLM call
 * placeholder)" whose pattern lists were EXCLUSIVELY ENGLISH
 * (`/\b(create|build|generate|make)\b.../i`, etc). Polish — this product's
 * primary language — never matched a single governed OR conversational
 * pattern, so every Polish message fell through to the `ambiguous` branch
 * regardless of content. A purely informational Polish question such as
 * "Jaki jest dzisiaj kurs euro?" was classified `ambiguous` (confidence 0.5)
 * rather than `conversational`, which meant the layer that exists
 * specifically to "not propose a Case for an informational chat turn" never
 * actually fired for the language most users type in.
 *
 * This body is now a real, production bilingual classifier — Polish
 * (primary, with and without diacritics) and English (retained verbatim so
 * every existing English-language caller/test keeps its exact behaviour) —
 * built from the same governed-vs-conversational pattern-matching shape as
 * before, just no longer blind to the product's own language. It is not a
 * simulated LLM call and does not claim to be one; a future upgrade to a
 * real model-backed classifier is a separate, larger change and does not
 * change the contract below.
 *
 * =========================================================================
 * WHY "AMBIGUOUS" NEEDS NO EXTRA SAFEGUARD HERE TO STAY SAFE
 * =========================================================================
 * This function only ever LABELS a message; it never creates anything.
 * Safety for the ambiguous case is structural, enforced by the caller and by
 * `caseIntakeService`, not by this function reaching a particular verdict:
 *   - `routes/v8/chat.routes.ts`'s `/case-intake/turn` only ever calls
 *     `proposeConversationWorkOrder` (never `confirm*`), and it does so for
 *     BOTH `governed_work` and `ambiguous` — a proposal creates zero Cases
 *     and zero Runs by construction (CW-CANON-01).
 *   - A Case is created ONLY by `confirmConversationWorkOrder`, which never
 *     reads this function's output at all — it re-derives the CURRENT
 *     work order from the outbox and requires the caller's digest to match
 *     it exactly (CW-CANON-03). Misclassifying a message here can at worst
 *     cause a proposal to be shown (or not shown) — it can never, by itself,
 *     cause a Case to be created without an explicit, digest-matched
 *     confirmation from a human.
 * So an "ambiguous" verdict — including every case this classifier cannot
 * confidently place in either bucket — is safe by default: it behaves
 * exactly like `governed_work` at the chat-route boundary (may propose, may
 * never confirm) and never like an auto-approval.
 */
export async function classifyIntent(
  message: string,
  contextSnapshotId: string,
  organizationId: string
): Promise<IntentClassification> {
  ClassifyIntentParamsSchema.parse({ message, contextSnapshotId, organizationId });

  const now = new Date().toISOString();

  // ---- English (unchanged verbatim from the pre-existing stub) -----------
  const governedPatternsEn = [
    /\b(create|build|generate|make)\b.*\b(report|deck|presentation|initiative|task)/i,
    /\b(update|modify|change|edit)\b.*\b(all|every|across)\b/i,
    /\b(execute|run|perform|carry out)\b.*\b(plan|workflow|process)/i,
    /\b(assign|reassign|delegate)\b.*\b(task|work|owner)/i,
  ];

  const conversationalPatternsEn = [
    /\b(what|how|why|when|where|who)\b.*\?$/i,
    /\b(explain|describe|summarize|tell me|show me)\b/i,
    /\b(status|progress|update on)\b.*\?$/i,
  ];

  // ---- Polish (new — CW-T-B). Both diacritic and stripped-diacritic
  // spellings are matched (a message typed on a keyboard/IME without Polish
  // letters is common and must classify identically to the accented form).
  const governedPatternsPl = [
    // "stwórz/zrób/przygotuj/opracuj/wygeneruj/napisz" + a concrete deliverable noun.
    /\b(stw[oó]rz|utw[oó]rz|zr[oó]b|przygotuj|wygeneruj|opracuj|napisz|sporz[aą]dz[iI]?)\b[\s\S]*\b(raport\w*|prezentacj\w*|dokument\w*|inicjatyw\w*|zadani\w*|analiz\w*|plan\w*|podsumowani\w*|wycen\w*|harmonogram\w*)\b/i,
    // "zaktualizuj/zmień/popraw" + a totality word ("wszystkie", "każdy", "cały").
    /\b(zaktualizuj|zmie[nń]|edytuj|popraw)\b[\s\S]*\b(wszystk\w*|ka[zż]d\w*|cał\w*|caly\w*)\b/i,
    // "wykonaj/uruchom/zrealizuj" + plan/proces/workflow.
    /\b(wykonaj|uruchom|zrealizuj)\b[\s\S]*\b(plan\w*|proces\w*|workflow\w*)\b/i,
    // "przypisz/deleguj" + zadanie/praca/właściciel.
    /\b(przypisz|zdeleguj|deleguj)\b[\s\S]*\b(zadani\w*|prac\w*|w[lł]a[sś]ciciel\w*)\b/i,
    // Compound "find/gather ... then produce": "znajdź informacje i przygotuj prezentację".
    /\b(znajd[zź]|zbierz|wyszukaj)\b[\s\S]*\b(przygotuj|stw[oó]rz|utw[oó]rz|opracuj|wygeneruj|napisz)\b/i,
    // Explicit autonomy / one-click phrasing — "pozwól na wszystko", "pełna autonomia".
    /\bpozw[oó]l\s+na\s+wszystko\b|\bpe[lł]n[aą]\s+autonomi\w*\b|\bbez\s+pytania\s+o\s+zgod\w*\b/i,
  ];

  const conversationalPatternsPl = [
    // Question words ("jak/jaki/co/dlaczego/kiedy/gdzie/kto/który/czy") … "?"
    /\b(jak\w*|co|dlaczego|kiedy|gdzie|kto|kt[oó]r\w*|czy)\b[\s\S]*\?\s*$/i,
    // Explanation/description asks with no production verb.
    /\b(wyja[sś]nij|opisz|wyt[lł]umacz|powiedz mi|poka[zż] mi|streść|streszcz)\b/i,
    /\b(status|post[eę]p|stan)\b[\s\S]*\?\s*$/i,
  ];

  const governedMatch =
    governedPatternsEn.some((p) => p.test(message)) || governedPatternsPl.some((p) => p.test(message));
  const conversationalMatch =
    conversationalPatternsEn.some((p) => p.test(message)) ||
    conversationalPatternsPl.some((p) => p.test(message));

  if (governedMatch && !conversationalMatch) {
    return {
      intentType: 'governed_work',
      confidence: 0.85,
      suggestedAction: 'initiate_execution',
      reasoning: 'Message contains work-producing intent patterns (PL/EN)',
      classifiedAt: now,
    };
  }

  if (conversationalMatch && !governedMatch) {
    return {
      intentType: 'conversational',
      confidence: 0.9,
      suggestedAction: 'continue_chat',
      reasoning: 'Message matches conversational question patterns (PL/EN)',
      classifiedAt: now,
    };
  }

  return {
    intentType: 'ambiguous',
    confidence: 0.5,
    suggestedAction: 'ask_user_confirmation',
    reasoning:
      'Intent is ambiguous — both conversational and work-producing signals detected, or neither matched clearly (PL/EN)',
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
 * with chat-specific rendering hints (Decision W2-2).
 *
 * V8: additionally persist a first-class `execution_proposal` row into
 * `conversation_messages`, so the proposal is visible and reviewable directly
 * in the chat thread (CHAT_V8_ACTIONS_AND_APPROVALS). The facade row in
 * `v8_chat_action_proposals` remains the canonical record of rendering hints
 * and the link to the underlying governance proposal.
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

  // V8 first-class thread visibility — persist an execution_proposal message
  // so the proposal is immediately visible as a governed bubble. Best-effort:
  // failures are logged and swallowed to avoid poisoning the facade write.
  try {
    const messageId = uuidv4();
    await dbRun(
      `INSERT INTO conversation_messages
         (id, conversation_id, role, content, message_type, metadata, created_at)
       VALUES (?, ?, 'ai', ?, 'execution_proposal', ?, ?)`,
      [
        messageId,
        validated.conversationId,
        validated.displaySummary,
        JSON.stringify({
          executionProposal: {
            proposalId: validated.underlyingProposalId,
            chatProposalId,
            lifecycleState: 'pending_review',
            planSummary: validated.displaySummary,
            risk: validated.renderingHints?.showRiskBadge ? 'medium' : undefined,
          },
          renderingHints: validated.renderingHints,
        }),
        now,
      ]
    );
  } catch (err: any) {
    logger.warn(
      `${LOG_PREFIX} Failed to persist execution_proposal message for chat proposal ${chatProposalId}: ${err?.message || String(err)}`
    );
  }

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
