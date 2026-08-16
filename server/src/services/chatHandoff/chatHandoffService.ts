/**
 * Lane C (closure) — chat governed proposal surface (CHAT-BVP-001 / CHAT-NFR-001).
 *
 * ── THE CONTRACT THIS FILE ENFORCES ─────────────────────────────────────
 * "Chat PROPOSES, and must never own Idea or artifact lifecycle." The
 * product-wide inventory at SHA 64f507859c found chat violating that today:
 * `AIPipeline.ts:363-369` exposes MCP tools (`create_task`, `create_decision`,
 * `generate_initiative`) directly to the model with NO approval gate, and
 * `createTask.ts` / `createDecision.ts` / `actionProposalEngine.ts` INSERT/
 * UPDATE `tasks` and `decisions` straight from tool output. All of those
 * files are OUTSIDE this lane's lease and are NOT touched here.
 *
 * This file is the governed ALTERNATIVE surface: it turns a chat message
 * into a `chat`-producer row in `artifact_handoff_proposals`
 * (`server/migrations/20260912_claude_c_handoff_spine.sql`), never a row in
 * any foreign-owned table. A human must call `approveChatProposal` (which
 * requires a real actor id — enforced by the spine's `requireHumanActor` and
 * a DB CHECK constraint) before anything downstream can happen, and even
 * then this file materializes NOTHING — see "CROSS-LANE CONTRACT" below.
 *
 * PROVABLE BY GREP: this file (and nothing else in this directory) contains
 * no `INSERT INTO tasks`, `UPDATE tasks`, `INSERT INTO decisions`,
 * `UPDATE decisions`, `initiatives`, `ideas`/`my_ideas`, `studio_documents`,
 * `presentation_decks`, or `generated_workbooks`. The only tables this file
 * writes are `artifact_handoff_proposals` / `artifact_handoff_receipts`
 * (via `handoffSpineService.ts`, never with raw SQL here). The only table
 * this file reads outside the spine is `conversation_messages` (joined to
 * `conversations` for tenant scoping) — a SELECT, to resolve the exact bytes
 * a proposal pins, never a write.
 *
 * ── CHAT-NFR-001: PROVIDER FAIL-CLOSED ──────────────────────────────────
 * The one external dependency `createChatProposal` has beyond the spine
 * itself is `ChatMessageSourceProvider` — whatever resolves "the content of
 * this chat message" (today: a Postgres SELECT; injectable for tests, and
 * for a future non-DB provider without changing this file's contract). If
 * that provider throws, returns "not found", or resolves empty content,
 * `createChatProposal` throws a `ChatHandoffError` with an explicit code
 * BEFORE calling `handoffSpineService.createProposal` — so an unavailable
 * or failing provider NEVER produces a fake success and NEVER leaves a
 * phantom/empty proposal row behind. See `assertHasContent` and the
 * `try { source = await provider.resolve(...) } catch` block below.
 *
 * ── CITATIONS PERSISTED SERVER-SIDE ─────────────────────────────────────
 * The inventory also found: "Citations live only inside
 * `conversation_messages.metadata` JSON and are persisted by the CLIENT
 * after the stream; the server never independently persists what it
 * extracted." `createChatProposal` closes that gap for every proposal it
 * creates: it runs the SAME extraction logic the streaming path uses
 * (`citationExtractor.extract`, imported read-only — this file does not
 * modify the streaming path) directly against the resolved message content,
 * and stores the result INSIDE the hashed proposal payload
 * (`payload.citations`). Because `source_content_hash` covers that payload,
 * a human's approval is pinned to the citations exactly as extracted at
 * proposal time — independent of whether the client ever wrote metadata
 * back. Any citations the caller supplies are also recorded, but only as
 * `payload.clientCitations` — informational, never authoritative.
 *
 * ── CROSS-LANE CONTRACT (for the lane that owns tasks/decisions, or the
 *    lane that owns documents/presentations/workbooks/materials) ─────────
 * Consume `artifact_handoff_proposals` WHERE `producer_kind = 'chat'`:
 *   - `producer_record_id` = the chat message id that sourced the proposal.
 *   - `payload_json` parses to `ChatProposalPayloadV1` (see below) —
 *     `schemaVersion: 'v1'`, `conversationId`, `messageId`, `content`,
 *     `citations` (server-extracted, authoritative), `clientCitations`
 *     (informational), `note`, `suggestedTitle`.
 *   - `source_content_hash` = sha256 of the CANONICALIZED payload above —
 *     this is what a human approved; do not materialize against different
 *     bytes than what this hash covers.
 *   - Idempotency key (if the CREATING caller supplied one) dedupes at
 *     CREATE time; this file does not mint one on the caller's behalf.
 *   - Once `state = 'approved'`, the consuming lane creates its OWN target
 *     row (a `studio_documents` / `presentation_decks` / `generated_workbooks`
 *     / material row) and calls `handoffSpineService.materializeProposal`
 *     with that row's id as `targetRecordId`. That call — NOT anything in
 *     this file — is what produces the `artifact_handoff_receipts` row and
 *     flips the proposal to `'materialized'`. This file deliberately has NO
 *     materialize endpoint: only the lane that owns the target table knows
 *     how to build it, and giving chat a materialize path would recreate
 *     exactly the ungated foreign-write pattern this spine exists to close.
 */

import type { Citation } from '../ai/citationExtractor.js';
import { citationExtractor } from '../ai/citationExtractor.js';
import { withPgTransaction } from '../../database/PostgresDatabase.js';
import logger from '../../utils/Logger.js';
import {
  approveProposal as spineApproveProposal,
  createProposal as spineCreateProposal,
  HandoffSpineError,
  isTargetKind,
  rejectProposal as spineRejectProposal,
  type HandoffProposal,
  type TargetKind,
} from '../artifactHandoff/handoffSpineService.js';

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class ChatHandoffError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly httpStatus: number = 400
  ) {
    super(message);
    this.name = 'ChatHandoffError';
  }
}

/** Maps the spine's own error codes onto an HTTP status for this surface,
 * so callers get a real distinction (404 vs 409 vs 400) instead of a flat
 * 400 for everything the shared spine can raise. */
function translateSpineError(err: unknown): Error {
  if (err instanceof HandoffSpineError) {
    const statusByCode: Record<string, number> = {
      NOT_FOUND: 404,
      INVALID_ARGUMENT: 400,
      NOT_A_HUMAN_ACTOR: 400,
      INVALID_STATE_TRANSITION: 409,
      NOT_APPROVED: 409,
      RECEIPT_MISSING: 500,
      INSERT_READBACK_FAILED: 500,
      UNREACHABLE: 500,
    };
    return new ChatHandoffError(err.message, err.code, statusByCode[err.code] ?? 400);
  }
  return err instanceof Error ? err : new Error(String(err));
}

// ---------------------------------------------------------------------------
// Validation helpers (small, local — chatHandoffService owns nothing shared)
// ---------------------------------------------------------------------------

function requireNonEmpty(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ChatHandoffError(`${field} is required`, 'INVALID_ARGUMENT', 400);
  }
  return value;
}

function normalizeOptionalText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

// ---------------------------------------------------------------------------
// Message source resolution — the one external dependency, injectable so
// CHAT-NFR-001's fail-closed behavior is directly testable.
// ---------------------------------------------------------------------------

export interface ChatMessageSource {
  messageId: string;
  conversationId: string;
  organizationId: string;
  role: string;
  content: string;
  createdAt: string;
}

export interface ChatMessageSourceProvider {
  resolve(input: {
    organizationId: string;
    conversationId: string;
    messageId: string;
  }): Promise<ChatMessageSource | null>;
}

interface ConversationMessageRow {
  id: string;
  conversation_id: string;
  role: string;
  content: string;
  created_at: Date | string;
  organization_id: string;
}

/**
 * Default, DB-backed provider. SELECT-only (never writes), joined to
 * `conversations` so tenant scoping is enforced at the SQL layer, not just
 * in application code — a message belonging to another organization reads
 * as "not found", same tenant-isolation posture as `handoffSpineService.ts`.
 */
export const pgChatMessageSourceProvider: ChatMessageSourceProvider = {
  async resolve({ organizationId, conversationId, messageId }) {
    return withPgTransaction(async (query) => {
      const rows = await query<ConversationMessageRow>(
        `SELECT cm.id, cm.conversation_id, cm.role, cm.content, cm.created_at, c.organization_id
           FROM conversation_messages cm
           JOIN conversations c ON c.id = cm.conversation_id
          WHERE cm.id = $1 AND cm.conversation_id = $2 AND c.organization_id = $3`,
        [messageId, conversationId, organizationId]
      );
      const row = rows.rows[0];
      if (!row) return null;
      return {
        messageId: row.id,
        conversationId: row.conversation_id,
        organizationId: row.organization_id,
        role: row.role,
        content: row.content,
        createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
      };
    });
  },
};

// ---------------------------------------------------------------------------
// Payload schema — this IS what gets hashed into source_content_hash
// ---------------------------------------------------------------------------

export interface ChatProposalPayloadV1 {
  schemaVersion: 'v1';
  conversationId: string;
  messageId: string;
  sourceRole: string;
  sourceCreatedAt: string;
  content: string;
  note: string | null;
  suggestedTitle: string | null;
  /** Server-extracted, authoritative — see file header. */
  citations: Citation[];
  citationStats: { totalFound: number; verified: number; unverified: number };
  /** Whatever the caller supplied, if anything. Informational only — never
   * used for the hash's authority and never trusted over `citations` above. */
  clientCitations: unknown[] | null;
}

// ---------------------------------------------------------------------------
// createChatProposal
// ---------------------------------------------------------------------------

export interface CreateChatProposalInput {
  organizationId: string;
  userId: string;
  conversationId: string;
  messageId: string;
  targetKind: TargetKind;
  note?: string | null;
  suggestedTitle?: string | null;
  clientCitations?: unknown[] | null;
  idempotencyKey?: string | null;
  /** Test/DI seam only — HTTP callers always get `pgChatMessageSourceProvider`. */
  sourceProvider?: ChatMessageSourceProvider;
}

export interface CreateChatProposalResult {
  proposal: HandoffProposal;
  replayed: boolean;
  citations: Citation[];
}

export async function createChatProposal(
  input: CreateChatProposalInput
): Promise<CreateChatProposalResult> {
  const organizationId = requireNonEmpty(input.organizationId, 'organizationId');
  const userId = requireNonEmpty(input.userId, 'userId');
  const conversationId = requireNonEmpty(input.conversationId, 'conversationId');
  const messageId = requireNonEmpty(input.messageId, 'messageId');
  if (!isTargetKind(input.targetKind)) {
    throw new ChatHandoffError('targetKind is invalid', 'INVALID_ARGUMENT', 400);
  }

  const provider = input.sourceProvider ?? pgChatMessageSourceProvider;

  // ── CHAT-NFR-001 fail-closed gate. Nothing below this block may run if
  // the provider is unavailable, found nothing, or found empty content. ──
  let source: ChatMessageSource | null;
  try {
    source = await provider.resolve({ organizationId, conversationId, messageId });
  } catch (err) {
    logger.error('[chatHandoff] message source provider failed — failing closed, no proposal created', {
      organizationId,
      conversationId,
      messageId,
      error: err instanceof Error ? err.message : String(err),
    });
    throw new ChatHandoffError(
      `chat message source is unavailable: ${err instanceof Error ? err.message : String(err)}`,
      'PROVIDER_UNAVAILABLE',
      503
    );
  }
  if (!source) {
    throw new ChatHandoffError(
      `conversation message not found (conversationId=${conversationId}, messageId=${messageId})`,
      'SOURCE_NOT_FOUND',
      404
    );
  }
  if (!source.content || source.content.trim() === '') {
    throw new ChatHandoffError(
      'source message has no content — refusing to create an empty proposal',
      'EMPTY_SOURCE',
      422
    );
  }

  // Server-side extraction — independent of whatever the client did or did
  // not persist back into `conversation_messages.metadata`.
  const extraction = citationExtractor.extract(source.content, [], []);

  const payload: ChatProposalPayloadV1 = {
    schemaVersion: 'v1',
    conversationId,
    messageId,
    sourceRole: source.role,
    sourceCreatedAt: source.createdAt,
    content: source.content,
    note: normalizeOptionalText(input.note),
    suggestedTitle: normalizeOptionalText(input.suggestedTitle),
    citations: extraction.citations,
    citationStats: {
      totalFound: extraction.totalFound,
      verified: extraction.verified,
      unverified: extraction.unverified,
    },
    clientCitations: Array.isArray(input.clientCitations) ? input.clientCitations : null,
  };

  try {
    const result = await spineCreateProposal({
      organizationId,
      producerKind: 'chat',
      producerRecordId: messageId,
      targetKind: input.targetKind,
      payload,
      createdBy: userId,
      idempotencyKey: input.idempotencyKey ?? null,
    });
    return { proposal: result.proposal, replayed: result.replayed, citations: extraction.citations };
  } catch (err) {
    throw translateSpineError(err);
  }
}

// ---------------------------------------------------------------------------
// Row mapping for the direct reads below (list / get). Duplicated in shape
// from handoffSpineService's internal mapper (not exported) — this file
// only ever SELECTs `artifact_handoff_proposals`, never writes it directly.
// ---------------------------------------------------------------------------

interface ProposalRow {
  proposal_id: string;
  organization_id: string;
  producer_kind: string;
  producer_record_id: string;
  source_content_hash: string;
  source_version: number;
  contract_version: string;
  target_kind: string;
  payload_json: string;
  state: string;
  created_by: string;
  created_at: Date | string;
  decided_by: string | null;
  decided_at: Date | string | null;
  decision_reason: string | null;
  self_approved: boolean;
  idempotency_key: string | null;
  updated_at: Date | string;
}

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

function toIsoOrNull(value: Date | string | null): string | null {
  return value === null ? null : toIso(value);
}

function mapProposalRow(row: ProposalRow): HandoffProposal {
  return {
    proposalId: row.proposal_id,
    organizationId: row.organization_id,
    producerKind: row.producer_kind as HandoffProposal['producerKind'],
    producerRecordId: row.producer_record_id,
    sourceContentHash: row.source_content_hash,
    sourceVersion: Number(row.source_version),
    contractVersion: row.contract_version,
    targetKind: row.target_kind as TargetKind,
    payload: (() => {
      try {
        return JSON.parse(row.payload_json);
      } catch {
        return null;
      }
    })(),
    state: row.state as HandoffProposal['state'],
    createdBy: row.created_by,
    createdAt: toIso(row.created_at),
    decidedBy: row.decided_by,
    decidedAt: toIsoOrNull(row.decided_at),
    decisionReason: row.decision_reason,
    selfApproved: Boolean(row.self_approved),
    idempotencyKey: row.idempotency_key,
    updatedAt: toIso(row.updated_at),
  };
}

/** Tenant- AND producer-scoped read: a proposal from another org, or a
 * non-chat proposal (e.g. `producer_kind = 'idea'`), both read as `null` —
 * this surface must not become a side door for approving/reading proposals
 * it did not create. */
async function fetchChatProposalRow(
  organizationId: string,
  proposalId: string
): Promise<ProposalRow | null> {
  return withPgTransaction(async (query) => {
    const rows = await query<ProposalRow>(
      `SELECT * FROM artifact_handoff_proposals
        WHERE proposal_id = $1 AND organization_id = $2 AND producer_kind = 'chat'`,
      [proposalId, organizationId]
    );
    return rows.rows[0] ?? null;
  });
}

// ---------------------------------------------------------------------------
// listChatProposalsForConversation / getChatProposal
// ---------------------------------------------------------------------------

export async function listChatProposalsForConversation(
  organizationId: string,
  conversationId: string
): Promise<HandoffProposal[]> {
  const orgId = requireNonEmpty(organizationId, 'organizationId');
  const convId = requireNonEmpty(conversationId, 'conversationId');
  return withPgTransaction(async (query) => {
    const rows = await query<ProposalRow>(
      `SELECT * FROM artifact_handoff_proposals
        WHERE organization_id = $1
          AND producer_kind = 'chat'
          AND (payload_json::jsonb ->> 'conversationId') = $2
        ORDER BY created_at DESC`,
      [orgId, convId]
    );
    return rows.rows.map(mapProposalRow);
  });
}

export async function getChatProposal(
  organizationId: string,
  proposalId: string
): Promise<HandoffProposal> {
  const row = await fetchChatProposalRow(
    requireNonEmpty(organizationId, 'organizationId'),
    requireNonEmpty(proposalId, 'proposalId')
  );
  if (!row) {
    throw new ChatHandoffError('chat proposal not found', 'NOT_FOUND', 404);
  }
  return mapProposalRow(row);
}

// ---------------------------------------------------------------------------
// approveChatProposal / rejectChatProposal
// ---------------------------------------------------------------------------

export interface DecideChatProposalInput {
  organizationId: string;
  proposalId: string;
  decidedBy: string;
  reason?: string | null;
}

export async function approveChatProposal(input: DecideChatProposalInput): Promise<HandoffProposal> {
  const organizationId = requireNonEmpty(input.organizationId, 'organizationId');
  const proposalId = requireNonEmpty(input.proposalId, 'proposalId');
  const row = await fetchChatProposalRow(organizationId, proposalId);
  if (!row) {
    throw new ChatHandoffError('chat proposal not found', 'NOT_FOUND', 404);
  }
  try {
    return await spineApproveProposal({
      organizationId,
      proposalId,
      decidedBy: input.decidedBy,
      reason: input.reason ?? null,
    });
  } catch (err) {
    throw translateSpineError(err);
  }
}

export async function rejectChatProposal(input: DecideChatProposalInput): Promise<HandoffProposal> {
  const organizationId = requireNonEmpty(input.organizationId, 'organizationId');
  const proposalId = requireNonEmpty(input.proposalId, 'proposalId');
  const row = await fetchChatProposalRow(organizationId, proposalId);
  if (!row) {
    throw new ChatHandoffError('chat proposal not found', 'NOT_FOUND', 404);
  }
  try {
    return await spineRejectProposal({
      organizationId,
      proposalId,
      decidedBy: input.decidedBy,
      reason: input.reason ?? null,
    });
  } catch (err) {
    throw translateSpineError(err);
  }
}
