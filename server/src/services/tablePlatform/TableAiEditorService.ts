/**
 * Table AI Editor Service (Block C · EPIC-T10 · Sprint C-S1 skeleton)
 *
 * Orchestrator for the 8-level AI Editor that proposes structured edits
 * over `TableArtifact` (cell → record → column → structure → view →
 * relational → methodological → source). Every proposal flows through:
 *
 *     proposeEdit()  → AiUsageService.consume()  → level handler
 *                    → tp_schema_proposals row (status='pending', level=<L>)
 *                    → return { proposalId }
 *
 *     applyProposal() / rejectProposal()
 *                    → tp_schema_proposals.status flip
 *                    → tp_audit_events row
 *                    → for `apply`: delegate to MutationExecutor (level-specific
 *                      handler). C-S1 ships stubs that return `{applied: false,
 *                      reason: 'stub'}`. Real handlers land in C-S2 (levels
 *                      1–4) and C-S3 (levels 5–8).
 *
 * Cross-tenant safety: this service trusts that `workspaceId` and
 * `organizationId` have already been resolved by the route layer through
 * tenant ACL. Service rejects requests without those fields.
 *
 * AI cost-control invariant: `proposeEdit()` MUST call
 * `AiUsageService.consume()` BEFORE mutating any row, even before generating
 * the proposal ID. If `consume()` throws `AiBudgetExhaustedError` the
 * proposal is NOT created. Hard-cap status is recorded by `AiUsageService`
 * itself.
 *
 * Schema reference: server/migrations/20260508_block_c_ai_operator.sql
 * Spec reference:   docs/product/work-packets/tabele-full-product/block-C-ai-operator/00_TASK_PACKET.md
 */

import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../../database/Database.js';
import logger from '../../utils/Logger.js';
import aiUsageService, {
  AiBudgetExhaustedError,
  type AiEditorLevel,
} from './AiUsageService.js';
import auditService from './AuditService.js';
import { dispatchLevelStub } from './TableAiEditorLevels/index.js';

// ── Types ────────────────────────────────────────────────────────────────────

export const AI_EDITOR_LEVELS: readonly AiEditorLevel[] = [
  'cell',
  'record',
  'column',
  'structure',
  'view',
  'relational',
  'methodological',
  'source',
];

export interface ProposeEditInput {
  /** Logical table being edited. Resolved from URL path by the route layer. */
  tableId: string;
  /** AI Editor level (1..8). */
  level: AiEditorLevel;
  /** Natural-language prompt issued by the actor. */
  prompt: string;
  /**
   * Optional structured constraints. Forwarded to the level handler in
   * later sprints. C-S1 stubs do not consume them.
   */
  context?: Record<string, unknown>;

  /** Resolved by the route layer. */
  workspaceId: string;
  /** Resolved by the route layer (= organizationId for parity with Block B). */
  organizationId: string;
  /** Authenticated actor. */
  actorUserId: string;
  /** Super-admin flag from the JWT. Required for level 7/8. */
  actorIsSuperAdmin?: boolean;

  /** Token estimates (input/output). Routes pass conservative upper bounds. */
  estimatedTokensInput: number;
  estimatedTokensOutput: number;
  /** AI model identifier — must match what the level handler uses. */
  model: string;
}

export interface ProposeEditResult {
  proposalId: string;
  level: AiEditorLevel;
  /** Soft-warn flag from the budget gate (informational; does not block). */
  softWarn: boolean;
  /** "stub" until the corresponding C-S2/C-S3 sprint replaces the handler. */
  handlerStatus: 'stub' | 'live';
}

export interface ApplyProposalInput {
  proposalId: string;
  workspaceId: string;
  actorUserId: string;
  /** When true, the apply is idempotent — re-applying a 'applied' row is a no-op. */
  idempotent?: boolean;
}

export interface ApplyProposalResult {
  proposalId: string;
  applied: boolean;
  reason?: string;
}

export interface RejectProposalInput {
  proposalId: string;
  workspaceId: string;
  actorUserId: string;
  note?: string;
}

// ── Errors ───────────────────────────────────────────────────────────────────

export class TableAiEditorError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 400
  ) {
    super(message);
    this.name = 'TableAiEditorError';
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function isAiEditorLevel(value: unknown): value is AiEditorLevel {
  return (
    typeof value === 'string' &&
    (AI_EDITOR_LEVELS as readonly string[]).includes(value)
  );
}

// ── Service ──────────────────────────────────────────────────────────────────

const tableAiEditorService = {
  /**
   * Propose an AI edit at the given level. Atomically:
   *
   *   1. Consume the token budget (throws AiBudgetExhaustedError on hard cap).
   *   2. Dispatch to the level stub handler (C-S1) / real handler (C-S2+).
   *   3. Insert a `tp_schema_proposals` row with `level = <L>` and
   *      `status = 'pending'`.
   *   4. Return `{proposalId, level, softWarn, handlerStatus}`.
   *
   * The level handler in C-S1 returns a static envelope describing which
   * level was invoked plus a `summary` string. Real handlers (C-S2/C-S3)
   * generate the operations array.
   */
  async proposeEdit(input: ProposeEditInput): Promise<ProposeEditResult> {
    if (!input.tableId) {
      throw new TableAiEditorError('TABLE_ID_REQUIRED', 'tableId is required');
    }
    if (!isAiEditorLevel(input.level)) {
      throw new TableAiEditorError(
        'INVALID_LEVEL',
        `level must be one of ${AI_EDITOR_LEVELS.join(', ')}`
      );
    }
    if (!input.prompt || typeof input.prompt !== 'string') {
      throw new TableAiEditorError('PROMPT_REQUIRED', 'prompt is required');
    }
    if (!input.workspaceId) {
      throw new TableAiEditorError('WORKSPACE_ID_REQUIRED', 'workspaceId is required');
    }
    if (!input.organizationId) {
      throw new TableAiEditorError('ORG_ID_REQUIRED', 'organizationId is required');
    }
    if (!input.actorUserId) {
      throw new TableAiEditorError('ACTOR_REQUIRED', 'actorUserId is required');
    }

    // Levels 7 (methodological) and 8 (source) are super-admin-only per
    // EPIC-T10 §"Acceptance criteria". Gate runs BEFORE consume() so a
    // forbidden caller cannot drain another tenant's budget.
    if (
      (input.level === 'methodological' || input.level === 'source') &&
      input.actorIsSuperAdmin !== true
    ) {
      throw new TableAiEditorError(
        'SUPER_ADMIN_REQUIRED',
        `Level '${input.level}' requires super-admin role`,
        403
      );
    }

    // Step 1: budget gate. Throws AiBudgetExhaustedError on hard cap; the
    // service writes a hard_cap_429 audit row internally.
    const consume = await aiUsageService.consume({
      workspaceId: input.workspaceId,
      surface: 'ai_editor',
      level: input.level,
      actorUserId: input.actorUserId,
      tokensInput: input.estimatedTokensInput,
      tokensOutput: input.estimatedTokensOutput,
      model: input.model,
    });

    // Step 2: dispatch to level handler.
    const stub = await dispatchLevelStub({
      level: input.level,
      tableId: input.tableId,
      prompt: input.prompt,
      context: input.context ?? {},
      organizationId: input.organizationId,
      workspaceId: input.workspaceId,
      actorUserId: input.actorUserId,
      actorIsSuperAdmin: input.actorIsSuperAdmin === true,
    });

    // Step 3: persist proposal row.
    const proposalId = uuidv4();
    const operations = stub.operations ?? [];
    const summary = stub.summary || `AI Editor (${input.level}): ${input.prompt.slice(0, 200)}`;
    const warnings = stub.warnings ?? [];

    const db = getDatabase();
    try {
      await db.query(
        `INSERT INTO tp_schema_proposals
           (id, workspace_id, intent, confidence, summary, operations, warnings, status, created_by, level)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          proposalId,
          input.workspaceId,
          input.prompt,
          stub.confidence ?? 0.0,
          summary,
          JSON.stringify(operations),
          JSON.stringify(warnings),
          'pending',
          input.actorUserId,
          input.level,
        ]
      );
    } catch (e) {
      logger.error('[TableAiEditorService] proposeEdit insert failed', {
        proposalId,
        level: input.level,
        workspaceId: input.workspaceId,
        error: (e as Error).message,
      });
      throw e;
    }

    await auditService.logEvent(
      'ai_editor_propose',
      'tp_schema_proposals',
      proposalId,
      input.actorUserId,
      undefined,
      undefined,
      {
        level: input.level,
        tableId: input.tableId,
        workspaceId: input.workspaceId,
        organizationId: input.organizationId,
        handlerStatus: stub.handlerStatus,
        tokensConsumed: input.estimatedTokensInput + input.estimatedTokensOutput,
      }
    );

    return {
      proposalId,
      level: input.level,
      softWarn: consume.softWarn,
      handlerStatus: stub.handlerStatus,
    };
  },

  /**
   * Apply an AI Editor proposal. C-S1 skeleton flips status to 'applied' and
   * writes the audit event but DOES NOT execute the operations — real
   * MutationExecutor wiring lands in C-S2 (levels 1–4) and C-S3 (levels 5–8).
   */
  async applyProposal(input: ApplyProposalInput): Promise<ApplyProposalResult> {
    if (!input.proposalId) {
      throw new TableAiEditorError('PROPOSAL_ID_REQUIRED', 'proposalId is required');
    }
    if (!input.workspaceId) {
      throw new TableAiEditorError('WORKSPACE_ID_REQUIRED', 'workspaceId is required');
    }
    if (!input.actorUserId) {
      throw new TableAiEditorError('ACTOR_REQUIRED', 'actorUserId is required');
    }

    const db = getDatabase();
    const { rows } = await db.query(
      `SELECT id, workspace_id, status, level
         FROM tp_schema_proposals
        WHERE id = $1
          AND workspace_id = $2
        LIMIT 1`,
      [input.proposalId, input.workspaceId]
    );
    const row = rows?.[0];
    if (!row) {
      throw new TableAiEditorError(
        'PROPOSAL_NOT_FOUND',
        'Proposal not found in this workspace',
        404
      );
    }

    if (row.status === 'applied') {
      if (input.idempotent) {
        return { proposalId: input.proposalId, applied: true, reason: 'already_applied' };
      }
      throw new TableAiEditorError(
        'PROPOSAL_ALREADY_APPLIED',
        'Proposal is already applied'
      );
    }
    if (row.status === 'rejected') {
      throw new TableAiEditorError('PROPOSAL_REJECTED', 'Proposal is rejected and cannot be applied');
    }
    if (row.status !== 'pending') {
      throw new TableAiEditorError(
        'PROPOSAL_INVALID_STATUS',
        `Proposal status '${row.status}' cannot be applied`
      );
    }

    const beforeStatus = String(row.status);
    await db.query(
      `UPDATE tp_schema_proposals
          SET status      = 'applied',
              resolved_by = $2,
              resolved_at = NOW()
        WHERE id = $1`,
      [input.proposalId, input.actorUserId]
    );

    await auditService.logEvent(
      'ai_editor_apply',
      'tp_schema_proposals',
      input.proposalId,
      input.actorUserId,
      { status: beforeStatus },
      { status: 'applied' },
      {
        level: row.level ?? null,
        workspaceId: input.workspaceId,
        handlerStatus: 'stub', // C-S1 — replaced in C-S2/C-S3
      }
    );

    return {
      proposalId: input.proposalId,
      applied: true,
      reason: 'stub_handler_no_op',
    };
  },

  /**
   * Reject an AI Editor proposal. Always writes an audit row.
   */
  async rejectProposal(input: RejectProposalInput): Promise<{ proposalId: string; rejected: true }> {
    if (!input.proposalId) {
      throw new TableAiEditorError('PROPOSAL_ID_REQUIRED', 'proposalId is required');
    }
    if (!input.workspaceId) {
      throw new TableAiEditorError('WORKSPACE_ID_REQUIRED', 'workspaceId is required');
    }
    if (!input.actorUserId) {
      throw new TableAiEditorError('ACTOR_REQUIRED', 'actorUserId is required');
    }

    const db = getDatabase();
    const { rows } = await db.query(
      `SELECT id, workspace_id, status, level
         FROM tp_schema_proposals
        WHERE id = $1
          AND workspace_id = $2
        LIMIT 1`,
      [input.proposalId, input.workspaceId]
    );
    const row = rows?.[0];
    if (!row) {
      throw new TableAiEditorError(
        'PROPOSAL_NOT_FOUND',
        'Proposal not found in this workspace',
        404
      );
    }
    if (row.status === 'rejected') {
      // Idempotent reject.
      return { proposalId: input.proposalId, rejected: true };
    }
    if (row.status === 'applied') {
      throw new TableAiEditorError(
        'PROPOSAL_ALREADY_APPLIED',
        'Proposal is already applied and cannot be rejected'
      );
    }

    const beforeStatus = String(row.status);
    await db.query(
      `UPDATE tp_schema_proposals
          SET status      = 'rejected',
              resolved_by = $2,
              resolved_at = NOW()
        WHERE id = $1`,
      [input.proposalId, input.actorUserId]
    );

    await auditService.logEvent(
      'ai_editor_reject',
      'tp_schema_proposals',
      input.proposalId,
      input.actorUserId,
      { status: beforeStatus },
      { status: 'rejected' },
      {
        level: row.level ?? null,
        workspaceId: input.workspaceId,
        note: input.note ?? null,
      }
    );

    return { proposalId: input.proposalId, rejected: true };
  },
};

export default tableAiEditorService;
export { AiBudgetExhaustedError };
