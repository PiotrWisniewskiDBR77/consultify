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
import aiUsageService, { AiBudgetExhaustedError, type AiEditorLevel } from './AiUsageService.js';
import auditService from './AuditService.js';
import { dispatchLevelStub } from './TableAiEditorLevels/index.js';
import {
  type ExecuteOperationsResult,
  executeProposalOperations,
  MutationExecutorError,
} from './TableAiEditorLevels/MutationExecutor.js';

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
  /**
   * Tenant of the actor. Required so the MutationExecutor can refuse
   * cross-tenant writes. When omitted, the service resolves it from the
   * proposal's workspace via `tp_bases` (Block B parity: org === workspace).
   */
  organizationId?: string;
  /** When true, the apply is idempotent — re-applying a 'applied' row is a no-op. */
  idempotent?: boolean;
}

export interface ApplyProposalResult {
  proposalId: string;
  applied: boolean;
  reason?: string;
  /** Per-operation execution summary from the MutationExecutor. */
  operationsApplied?: number;
  operationsSkipped?: number;
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

/** Shape of a `tp_schema_proposals` row as read by apply/reject. */
interface ProposalApplyRow {
  id: string;
  workspace_id: string;
  status: string;
  level: string | null;
  operations?: unknown;
}

function isAiEditorLevel(value: unknown): value is AiEditorLevel {
  return typeof value === 'string' && (AI_EDITOR_LEVELS as readonly string[]).includes(value);
}

/**
 * The `operations` column is JSONB. The pg driver may hand it back as an
 * already-parsed array or as a JSON string depending on column typing; this
 * normalises both into a plain array for the executor.
 */
function parseOperations(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * Resolve the organizationId that owns a workspace via `tp_bases`. Used as a
 * fallback when the apply route does not pass organizationId explicitly.
 */
async function resolveOrganizationId(workspaceId: string): Promise<string | null> {
  const db = getDatabase();
  const { rows } = await db.query<{ organization_id: string }>(
    'SELECT organization_id FROM tp_bases WHERE workspace_id = $1 LIMIT 1',
    [workspaceId]
  );
  const orgId = rows?.[0]?.organization_id;
  return orgId ? String(orgId) : null;
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
   * Apply an AI Editor proposal. The proposal's persisted `operations` array
   * is replayed against `tp_records` / `tp_fields` / `tp_views` by the
   * MutationExecutor, then the row is flipped to `status = 'applied'` and an
   * audit event records the real per-operation outcome.
   *
   * Failure semantics: if the executor throws (invalid op or a mutation
   * fails), the proposal row is NOT flipped — it stays `pending` so the user
   * can retry — and the error surfaces to the caller. A read-only level
   * (methodological / source) applies cleanly with zero mutations.
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
    const { rows } = await db.query<ProposalApplyRow>(
      `SELECT id, workspace_id, status, level, operations
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
      throw new TableAiEditorError('PROPOSAL_ALREADY_APPLIED', 'Proposal is already applied');
    }
    if (row.status === 'rejected') {
      throw new TableAiEditorError(
        'PROPOSAL_REJECTED',
        'Proposal is rejected and cannot be applied'
      );
    }
    if (row.status !== 'pending') {
      throw new TableAiEditorError(
        'PROPOSAL_INVALID_STATUS',
        `Proposal status '${row.status}' cannot be applied`
      );
    }

    const level = row.level == null ? null : String(row.level);
    const operations = parseOperations(row.operations);

    // Resolve the actor tenant. Block B parity: org === workspace, but we
    // resolve from tp_bases so the executor can refuse cross-tenant writes
    // even if a caller omits organizationId.
    const organizationId =
      input.organizationId && input.organizationId.length > 0
        ? input.organizationId
        : await resolveOrganizationId(input.workspaceId);
    if (!organizationId) {
      throw new TableAiEditorError(
        'ORG_RESOLUTION_FAILED',
        'Could not resolve organization for this workspace',
        404
      );
    }

    // Execute the real mutations BEFORE flipping status, so a failure leaves
    // the proposal `pending` and retryable.
    let execResult: ExecuteOperationsResult;
    try {
      execResult = await executeProposalOperations({
        operations,
        workspaceId: input.workspaceId,
        organizationId,
        actorUserId: input.actorUserId,
        level,
      });
    } catch (e) {
      if (e instanceof MutationExecutorError) {
        logger.error('[TableAiEditorService] applyProposal mutation failed', {
          proposalId: input.proposalId,
          level,
          code: e.code,
          error: e.message,
        });
        throw new TableAiEditorError('APPLY_MUTATION_FAILED', `Apply failed: ${e.message}`, 422);
      }
      throw e;
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
        level,
        workspaceId: input.workspaceId,
        handlerStatus: 'live',
        operationsApplied: execResult.applied,
        operationsSkipped: execResult.skipped,
        outcomes: execResult.outcomes,
      }
    );

    return {
      proposalId: input.proposalId,
      applied: true,
      reason: execResult.applied > 0 ? 'applied' : 'no_op_read_only',
      operationsApplied: execResult.applied,
      operationsSkipped: execResult.skipped,
    };
  },

  /**
   * Reject an AI Editor proposal. Always writes an audit row.
   */
  async rejectProposal(
    input: RejectProposalInput
  ): Promise<{ proposalId: string; rejected: true }> {
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
    const { rows } = await db.query<ProposalApplyRow>(
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
