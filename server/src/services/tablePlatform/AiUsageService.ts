/**
 * AI Usage Service (Block C · EPIC-T10 · Sprint C-S1)
 *
 * Owns the per-workspace AI token budget enforcement and the append-only
 * `tp_ai_usage` audit ledger. Every AI mutation surface in Block C
 * (TableAiEditorService, TableQaService, SourcePackBuilderService) MUST go
 * through `consume()` BEFORE issuing the LLM call so the budget gate is
 * authoritative.
 *
 * Key invariants:
 *
 *   1. Atomic budget gate. `consume()` runs a single SQL statement that
 *      atomically increments `tokens_used_today` only if the resulting value
 *      is ≤ the configured `ai_daily_token_budget`. No application-level
 *      compare-and-swap; no race window.
 *
 *   2. Daily reset. Whenever `last_reset_at` is older than the current
 *      calendar day (UTC), the row is reset to `tokens_used_today = 0` before
 *      the increment happens. The reset and increment occur in the same
 *      transaction.
 *
 *   3. Soft warn. When usage crosses 70 % of the budget the result includes
 *      `softWarn: true` so the UI can render an amber banner. Soft warn does
 *      NOT block the call.
 *
 *   4. Hard cap. When the increment would exceed the budget the call is
 *      blocked. The service records a `hard_cap_429` audit row with
 *      `tokens_input = tokens_output = 0` (we did not call the LLM) and
 *      throws `AiBudgetExhaustedError` so the route can return HTTP 429.
 *
 *   5. Append-only audit. Every `consume()` outcome (success / soft_warn /
 *      hard_cap_429 / error) writes exactly one `tp_ai_usage` row. Rows are
 *      retained for ≥ 30 days (cleanup is owned by an external cron, not by
 *      this service).
 *
 * Cross-tenant safety: this service trusts that `workspaceId` has already
 * been resolved by the route layer through tenant ACL. It does NOT
 * cross-check tenant scope; doing so here would require coupling to
 * PermissionsService and would duplicate a check the route layer already
 * performs.
 *
 * Schema reference: server/migrations/20260508_block_c_ai_operator.sql
 * Spec reference:   docs/product/work-packets/tabele-full-product/block-C-ai-operator/audit-findings/AI_OPERATOR_BASELINE_2026-05-08.md
 */

import { getDatabase } from '../../database/Database.js';
import logger from '../../utils/Logger.js';

// ── Types ────────────────────────────────────────────────────────────────────

export type AiUsageSurface =
  | 'ai_editor'
  | 'qa_engine'
  | 'source_pack'
  | 'summarizer'
  | 'classification'
  | 'schema_proposal'
  | 'other';

export type AiEditorLevel =
  | 'cell'
  | 'record'
  | 'column'
  | 'structure'
  | 'view'
  | 'relational'
  | 'methodological'
  | 'source';

export type AiUsageStatus = 'success' | 'soft_warn' | 'hard_cap_429' | 'error';

export interface ConsumeInput {
  workspaceId: string;
  surface: AiUsageSurface;
  level?: AiEditorLevel | null;
  proposalId?: string | null;
  actorUserId: string;
  tokensInput: number;
  tokensOutput: number;
  model: string;
}

export interface ConsumeOutcome {
  status: 'success' | 'soft_warn';
  tokensUsedToday: number;
  budget: number;
  /** True when crossing the 70% soft-warn threshold during this consume. */
  softWarn: boolean;
}

export interface BudgetSnapshot {
  workspaceId: string;
  budget: number;
  tokensUsedToday: number;
  lastResetAt: string;
  remaining: number;
  softWarnThreshold: number;
  softWarnTripped: boolean;
}

// ── Errors ───────────────────────────────────────────────────────────────────

export class AiBudgetExhaustedError extends Error {
  readonly code = 'AI_BUDGET_EXHAUSTED';
  readonly status = 429;
  readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: number) {
    super('AI daily token budget exhausted for this workspace');
    this.name = 'AiBudgetExhaustedError';
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

// ── Constants ────────────────────────────────────────────────────────────────

const SOFT_WARN_RATIO = 0.7;
const DEFAULT_BUDGET = 2_000_000;

// ── Helpers ──────────────────────────────────────────────────────────────────

function secondsUntilNextUtcMidnight(): number {
  const now = new Date();
  const tomorrow = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0)
  );
  return Math.max(1, Math.ceil((tomorrow.getTime() - now.getTime()) / 1000));
}

function ensurePositiveInteger(name: string, value: unknown): number {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    !Number.isInteger(value) ||
    value < 0
  ) {
    throw new Error(`${name} must be a non-negative integer`);
  }
  return value;
}

// ── Service ──────────────────────────────────────────────────────────────────

const aiUsageService = {
  /**
   * Atomically attempt to consume `tokensInput + tokensOutput` from the
   * workspace's daily AI token budget. Always writes one `tp_ai_usage` row.
   *
   * Throws `AiBudgetExhaustedError` when the consume would exceed the budget.
   */
  async consume(input: ConsumeInput): Promise<ConsumeOutcome> {
    const tokensInput = ensurePositiveInteger('tokensInput', input.tokensInput);
    const tokensOutput = ensurePositiveInteger('tokensOutput', input.tokensOutput);
    const total = tokensInput + tokensOutput;
    if (!input.workspaceId || typeof input.workspaceId !== 'string') {
      throw new Error('workspaceId is required');
    }
    if (!input.actorUserId || typeof input.actorUserId !== 'string') {
      throw new Error('actorUserId is required');
    }
    if (!input.model || typeof input.model !== 'string') {
      throw new Error('model is required');
    }

    const db = getDatabase();

    // Atomic upsert + reset + increment.
    //
    // The single statement:
    //   1. Inserts a default settings row if one does not exist.
    //   2. Resets `tokens_used_today` to 0 if `last_reset_at < current UTC day`.
    //   3. Increments `tokens_used_today` only if `tokens_used_today + total <= budget`.
    //   4. Returns the post-increment row.
    //
    // If RETURNING is empty, the budget would have been exceeded.
    type BudgetUsageRow = {
      tokens_used_today: number;
      ai_daily_token_budget: number;
      previous_used: number;
    };
    let row: BudgetUsageRow | null = null;
    try {
      const sql = `
        WITH ensured AS (
          INSERT INTO tp_workspace_settings (workspace_id)
          VALUES ($1)
          ON CONFLICT (workspace_id) DO NOTHING
          RETURNING workspace_id
        ),
        reset AS (
          UPDATE tp_workspace_settings
             SET tokens_used_today = 0,
                 last_reset_at     = NOW(),
                 updated_at        = NOW()
           WHERE workspace_id = $1
             AND date_trunc('day', last_reset_at AT TIME ZONE 'UTC')
                 < date_trunc('day', NOW() AT TIME ZONE 'UTC')
          RETURNING workspace_id
        )
        UPDATE tp_workspace_settings
           SET tokens_used_today = tokens_used_today + $2,
               updated_at        = NOW()
         WHERE workspace_id = $1
           AND tokens_used_today + $2 <= ai_daily_token_budget
        RETURNING tokens_used_today, ai_daily_token_budget,
                  (tokens_used_today - $2) AS previous_used
      `;
      const result = await db.query(sql, [input.workspaceId, total]);
      row = (result.rows?.[0] as BudgetUsageRow | undefined) ?? null;
    } catch (e) {
      logger.error('[AiUsageService] consume failed (db error)', {
        workspaceId: input.workspaceId,
        surface: input.surface,
        error: (e as Error).message,
      });
      // Best-effort error audit: write 'error' row but do not block on its failure.
      await this._writeAudit({ ...input, status: 'error', errorCode: 'DB_ERROR' }).catch(
        () => undefined
      );
      throw e;
    }

    if (row == null) {
      // Budget exhausted. Write `hard_cap_429` audit with zero tokens and throw.
      await this._writeAudit({
        ...input,
        tokensInput: 0,
        tokensOutput: 0,
        status: 'hard_cap_429',
        errorCode: 'AI_BUDGET_EXHAUSTED',
      });
      throw new AiBudgetExhaustedError(secondsUntilNextUtcMidnight());
    }

    const budget = Number(row.ai_daily_token_budget) || DEFAULT_BUDGET;
    const usedAfter = Number(row.tokens_used_today) || 0;
    const usedBefore = Number(row.previous_used) || 0;
    const softWarnThreshold = Math.floor(budget * SOFT_WARN_RATIO);
    const softWarn = usedBefore < softWarnThreshold && usedAfter >= softWarnThreshold;
    const status: AiUsageStatus = softWarn ? 'soft_warn' : 'success';

    await this._writeAudit({
      ...input,
      tokensInput,
      tokensOutput,
      status,
    });

    return {
      status: status === 'soft_warn' ? 'soft_warn' : 'success',
      tokensUsedToday: usedAfter,
      budget,
      softWarn,
    };
  },

  /**
   * Read-only snapshot of the current budget state for a workspace. Resets
   * the row in-line if `last_reset_at` is older than the current UTC day so
   * the snapshot reflects the post-reset state.
   */
  async getSnapshot(workspaceId: string): Promise<BudgetSnapshot> {
    if (!workspaceId || typeof workspaceId !== 'string') {
      throw new Error('workspaceId is required');
    }
    const db = getDatabase();
    const sql = `
      INSERT INTO tp_workspace_settings (workspace_id)
      VALUES ($1)
      ON CONFLICT (workspace_id) DO UPDATE
        SET tokens_used_today =
              CASE
                WHEN date_trunc('day', tp_workspace_settings.last_reset_at AT TIME ZONE 'UTC')
                     < date_trunc('day', NOW() AT TIME ZONE 'UTC')
                THEN 0
                ELSE tp_workspace_settings.tokens_used_today
              END,
            last_reset_at =
              CASE
                WHEN date_trunc('day', tp_workspace_settings.last_reset_at AT TIME ZONE 'UTC')
                     < date_trunc('day', NOW() AT TIME ZONE 'UTC')
                THEN NOW()
                ELSE tp_workspace_settings.last_reset_at
              END,
            updated_at = NOW()
      RETURNING workspace_id, ai_daily_token_budget, tokens_used_today, last_reset_at
    `;
    const { rows } = await db.query<{
      workspace_id: string;
      ai_daily_token_budget: number;
      tokens_used_today: number;
      last_reset_at: string | Date | null;
    }>(sql, [workspaceId]);
    const row: Partial<{
      workspace_id: string;
      ai_daily_token_budget: number;
      tokens_used_today: number;
      last_reset_at: string | Date | null;
    }> = rows?.[0] ?? {};
    const budget = Number(row.ai_daily_token_budget) || DEFAULT_BUDGET;
    const used = Number(row.tokens_used_today) || 0;
    const lastReset =
      row.last_reset_at instanceof Date
        ? row.last_reset_at.toISOString()
        : String(row.last_reset_at ?? new Date().toISOString());
    const softWarnThreshold = Math.floor(budget * SOFT_WARN_RATIO);
    return {
      workspaceId,
      budget,
      tokensUsedToday: used,
      lastResetAt: lastReset,
      remaining: Math.max(0, budget - used),
      softWarnThreshold,
      softWarnTripped: used >= softWarnThreshold,
    };
  },

  /** Internal: append a single row to `tp_ai_usage`. */
  async _writeAudit(
    input: ConsumeInput & { status: AiUsageStatus; errorCode?: string | null }
  ): Promise<void> {
    const db = getDatabase();
    try {
      await db.query(
        `INSERT INTO tp_ai_usage
           (workspace_id, surface, level, proposal_id, actor_user_id,
            tokens_input, tokens_output, model, status, error_code)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          input.workspaceId,
          input.surface,
          input.level ?? null,
          input.proposalId ?? null,
          input.actorUserId,
          input.tokensInput,
          input.tokensOutput,
          input.model,
          input.status,
          input.errorCode ?? null,
        ]
      );
    } catch (e) {
      logger.error('[AiUsageService] _writeAudit failed', {
        workspaceId: input.workspaceId,
        surface: input.surface,
        status: input.status,
        error: (e as Error).message,
      });
      // Re-throw so test environments that mock the DB can detect this.
      throw e;
    }
  },
};

export default aiUsageService;
