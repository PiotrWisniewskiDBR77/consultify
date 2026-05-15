/**
 * V8 Proposal Unification Service — Wave A6.
 *
 * Single canonical read path for proposals visible in a conversation.
 *
 * Merges three data sources:
 *   1. `conversation_messages` (rows of execution family)   — thread visibility + metadata snapshot
 *   2. `ai_actions`                                          — legacy governance (truth of lifecycle)
 *   3. `v8_action_proposals`                                 — V8 canonical governance (truth of lifecycle)
 *   4. `v8_chat_action_proposals`                            — V8 chat facade (rendering hints + chatProposalId)
 *
 * Produces `ChatProposalView[]` — one entry per unique underlying proposalId,
 * ordered by the first chat message referencing it (chronological thread order).
 *
 * Rules:
 *   - `lifecycleState` is sourced from the governance row when available;
 *     otherwise from the latest chat-message snapshot.
 *   - If no governance row is found, `source = 'archived'` and the view is
 *     reconstructed from the metadata snapshot only.
 *   - Read-only. All mutations still flow through the existing
 *     approve/reject/execute endpoints.
 */

import type {
  ChatProposalView,
  ProposalGovernanceSource,
  ProposalMessageType,
  V8LifecycleState,
} from '../../types/chatExecutionIntegration.js';
import { mapDbActionStatusToV8Lifecycle } from '../../types/chatExecutionIntegration.js';
import { all as dbAll } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

const LOG_PREFIX = '[V8:ProposalUnification]';

// ==========================================
// ROW TYPES
// ==========================================

interface MessageRow {
  id: string;
  conversation_id: string;
  role: string;
  content: string;
  message_type: string;
  metadata: string | null;
  created_at: string;
}

interface AiActionRow {
  id: string;
  action_type: string;
  status: string;
  approved_at: string | null;
  approved_by: string | null;
  executed_at: string | null;
  created_at: string;
}

interface V8ProposalRow {
  proposal_id: string;
  proposal_type: string;
  risk_class: string;
  approval_class: string;
  status: string;
  summary: string;
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
}

interface ChatFacadeRow {
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
// HELPERS
// ==========================================

function safeJsonParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function isExecutionMessage(messageType: string): messageType is ProposalMessageType {
  return (
    messageType === 'execution_proposal' ||
    messageType === 'execution_progress' ||
    messageType === 'execution_result'
  );
}

/**
 * Map the V8 canonical `v8_action_proposals.status` enum to our V8 lifecycle.
 */
function mapV8ProposalStatus(status: string | null | undefined): V8LifecycleState {
  switch ((status || '').toLowerCase()) {
    case 'draft':
      return 'proposed';
    case 'pending_review':
      return 'pending_review';
    case 'policy_allowed':
    case 'approved':
      return 'approved';
    case 'rejected':
      return 'rejected';
    case 'expired':
      // Treat expiry as a terminal rejection for the chat bubble.
      return 'rejected';
    default:
      return 'proposed';
  }
}

interface ExtractedMetadata {
  proposalId?: string;
  chatProposalId?: string;
  lifecycleState?: V8LifecycleState;
  actionType?: string;
  planSummary?: string;
  stepCount?: number;
  steps?: Array<{ id?: string; label?: string; description?: string }>;
  risk?: string;
  reviewer?: { userId?: string; name?: string } | null;
  rejectionReason?: string | null;
  expiresAt?: string | null;
  renderingHints?: Record<string, unknown>;
}

function extractProposalMeta(raw: string | null | undefined): ExtractedMetadata {
  const parsed = safeJsonParse<any>(raw, {});
  const ep = parsed?.executionProposal || parsed?.proposal || {};
  return {
    proposalId: ep.proposalId || parsed?.proposalId,
    chatProposalId: ep.chatProposalId,
    lifecycleState: ep.lifecycleState,
    actionType: ep.actionType,
    planSummary: ep.planSummary,
    stepCount: typeof ep.stepCount === 'number' ? ep.stepCount : undefined,
    steps: Array.isArray(ep.steps) ? ep.steps : undefined,
    risk: ep.risk,
    reviewer: ep.reviewer ?? null,
    rejectionReason: ep.rejectionReason ?? null,
    expiresAt: ep.expiresAt ?? null,
    renderingHints:
      parsed?.renderingHints && typeof parsed.renderingHints === 'object'
        ? parsed.renderingHints
        : undefined,
  };
}

function riskFromV8(risk: string | null | undefined): string | undefined {
  switch ((risk || '').toLowerCase()) {
    case 'safe_additive':
    case 'safe_update':
      return 'low';
    case 'sensitive_update':
      return 'medium';
    case 'destructive':
    case 'governance_transition':
      return 'high';
    default:
      return risk || undefined;
  }
}

// ==========================================
// PUBLIC API
// ==========================================

export interface GetConversationProposalsOptions {
  conversationId: string;
  /**
   * Optional organization scope. When provided, facade rows are filtered by
   * org for defense-in-depth isolation. Governance rows stay scoped by
   * proposalId (unique across the DB).
   */
  organizationId?: string;
}

/**
 * Return the unified list of proposals referenced by a conversation's chat
 * thread, ordered by first appearance. One entry per distinct proposalId.
 */
export async function getConversationProposals(
  opts: GetConversationProposalsOptions
): Promise<ChatProposalView[]> {
  const { conversationId, organizationId } = opts;

  const messages = await dbAll<MessageRow>(
    `SELECT id, conversation_id, role, content, message_type, metadata, created_at
       FROM conversation_messages
      WHERE conversation_id = ?
        AND message_type IN ('execution_proposal', 'execution_progress', 'execution_result')
      ORDER BY created_at ASC, id ASC`,
    [conversationId],
    { fallback: true }
  );

  if (!messages || messages.length === 0) return [];

  // Group messages by proposalId, preserving first-seen chronological order.
  const orderedProposalIds: string[] = [];
  const messagesByProposalId = new Map<
    string,
    Array<{ row: MessageRow; meta: ExtractedMetadata }>
  >();

  for (const row of messages) {
    const meta = extractProposalMeta(row.metadata);
    if (!meta.proposalId) continue;
    if (!messagesByProposalId.has(meta.proposalId)) {
      orderedProposalIds.push(meta.proposalId);
      messagesByProposalId.set(meta.proposalId, []);
    }
    messagesByProposalId.get(meta.proposalId)!.push({ row, meta });
  }

  if (orderedProposalIds.length === 0) return [];

  // Probe both governance tables in parallel for all proposalIds.
  const placeholders = orderedProposalIds.map(() => '?').join(',');
  const [aiActionRows, v8ProposalRows, facadeRows] = await Promise.all([
    dbAll<AiActionRow>(
      `SELECT id, action_type, status, approved_at, approved_by, executed_at, created_at
         FROM ai_actions
        WHERE id IN (${placeholders})`,
      orderedProposalIds,
      { fallback: true }
    ),
    dbAll<V8ProposalRow>(
      `SELECT proposal_id, proposal_type, risk_class, approval_class, status,
              summary, created_at, resolved_at, resolved_by
         FROM v8_action_proposals
        WHERE proposal_id IN (${placeholders})`,
      orderedProposalIds,
      { fallback: true }
    ),
    (async () => {
      const baseSql = `SELECT chat_proposal_id, conversation_id, message_id, underlying_proposal_id,
                             organization_id, display_summary, rendering_hints, created_at
                        FROM v8_chat_action_proposals
                       WHERE conversation_id = ?`;
      const sql = organizationId ? `${baseSql} AND organization_id = ?` : baseSql;
      const args = organizationId ? [conversationId, organizationId] : [conversationId];
      return dbAll<ChatFacadeRow>(sql, args, { fallback: true });
    })(),
  ]);

  const aiActionById = new Map<string, AiActionRow>();
  for (const row of aiActionRows || []) aiActionById.set(row.id, row);

  const v8ProposalById = new Map<string, V8ProposalRow>();
  for (const row of v8ProposalRows || []) v8ProposalById.set(row.proposal_id, row);

  const facadeByUnderlying = new Map<string, ChatFacadeRow>();
  for (const row of facadeRows || []) facadeByUnderlying.set(row.underlying_proposal_id, row);

  const views: ChatProposalView[] = [];
  for (const proposalId of orderedProposalIds) {
    const msgs = messagesByProposalId.get(proposalId) || [];
    if (msgs.length === 0) continue;

    const firstMessage = msgs[0];
    const lastMessage = msgs[msgs.length - 1];
    const facade = facadeByUnderlying.get(proposalId);

    let source: ProposalGovernanceSource = 'archived';
    let lifecycleState: V8LifecycleState =
      lastMessage.meta.lifecycleState || firstMessage.meta.lifecycleState || 'proposed';
    let actionType: string | undefined =
      lastMessage.meta.actionType || firstMessage.meta.actionType;
    let resolvedAt: string | null = null;
    let updatedAt: string | null = lastMessage.row.created_at;
    let planSummary: string =
      firstMessage.meta.planSummary || firstMessage.row.content || 'AI proposal';
    let risk: string | undefined = lastMessage.meta.risk || firstMessage.meta.risk;

    const v8Row = v8ProposalById.get(proposalId);
    const aiRow = aiActionById.get(proposalId);

    if (v8Row) {
      source = 'v8_action_proposals';
      lifecycleState = mapV8ProposalStatus(v8Row.status);
      actionType = actionType || v8Row.proposal_type;
      planSummary = facade?.display_summary || v8Row.summary || planSummary;
      risk = risk || riskFromV8(v8Row.risk_class);
      resolvedAt = v8Row.resolved_at;
      updatedAt = v8Row.resolved_at || updatedAt;
    } else if (aiRow) {
      source = 'ai_actions';
      lifecycleState = mapDbActionStatusToV8Lifecycle(aiRow.status);
      actionType = actionType || aiRow.action_type;
      resolvedAt = aiRow.executed_at || aiRow.approved_at;
      updatedAt = aiRow.executed_at || aiRow.approved_at || updatedAt;
    }

    views.push({
      proposalId,
      source,
      conversationId,
      chatProposalId: facade?.chat_proposal_id,
      messageIds: msgs.map((m) => m.row.id),
      latestMessageType: isExecutionMessage(lastMessage.row.message_type)
        ? (lastMessage.row.message_type as ProposalMessageType)
        : undefined,
      lifecycleState,
      actionType,
      planSummary,
      stepCount: firstMessage.meta.stepCount,
      steps: firstMessage.meta.steps,
      risk,
      renderingHints:
        (facade ? safeJsonParse<Record<string, unknown>>(facade.rendering_hints, {}) : undefined) ||
        firstMessage.meta.renderingHints,
      reviewer: lastMessage.meta.reviewer ?? null,
      rejectionReason: lastMessage.meta.rejectionReason ?? null,
      createdAt: firstMessage.row.created_at,
      updatedAt,
      resolvedAt,
      expiresAt: firstMessage.meta.expiresAt ?? null,
    });
  }

  logger.info(
    `${LOG_PREFIX} conversation=${conversationId} proposals=${views.length} (messages=${messages.length})`
  );

  return views;
}
