import { createHash } from 'node:crypto';

import logger from '../utils/Logger.js';
import { withPgTransaction, type PgTransactionClient } from '../utils/queryHelpers.js';
import { requireOrgMemberWithClient } from './caseWorkspace/caseWorkspaceAuthContext.js';
import {
  getExecutionActionPolicy,
  recordExecutionActionAudit,
  type ExecutionActionOutcome,
} from './executionActionRegistryService.js';
import { deleteBudgetEntry, emitBudgetDeleteSideEffects } from './executionBudgetService.js';

const ACTION_ID = 'execution.budget.delete';
const ROLE_RANK = { CONSULTANT: 0, MEMBER: 1, ADMIN: 2, OWNER: 3 } as const;

export type BudgetDeleteReceipt = {
  receiptId: string;
  organizationId: string;
  actionId: typeof ACTION_ID;
  entryId: string;
  initiativeId: string;
  expectedVersion: number;
  idempotencyKey: string;
  requestDigest: string;
  actorId: string;
  outcome: ExecutionActionOutcome;
  reasonCode: string | null;
  result: { deleted: boolean; entryVersion: number | null };
  createdAt: string;
  replayed: boolean;
};

type ReceiptRow = {
  receipt_id: string;
  organization_id: string;
  action_id: typeof ACTION_ID;
  entry_id: string;
  initiative_id: string;
  expected_version: number;
  idempotency_key: string;
  request_digest: string;
  actor_id: string;
  outcome: ExecutionActionOutcome;
  reason_code: string | null;
  result_json: { deleted: boolean; entryVersion: number | null };
  created_at: string;
};

function digest(input: {
  organizationId: string;
  actorId: string;
  entryId: string;
  initiativeId: string;
  expectedVersion: number;
}): string {
  return createHash('sha256')
    .update(
      JSON.stringify([
        ACTION_ID,
        input.organizationId,
        input.actorId,
        input.entryId,
        input.initiativeId,
        input.expectedVersion,
      ])
    )
    .digest('hex');
}

function mapReceipt(row: ReceiptRow, replayed: boolean): BudgetDeleteReceipt {
  return {
    receiptId: row.receipt_id,
    organizationId: row.organization_id,
    actionId: row.action_id,
    entryId: row.entry_id,
    initiativeId: row.initiative_id,
    expectedVersion: Number(row.expected_version),
    idempotencyKey: row.idempotency_key,
    requestDigest: row.request_digest,
    actorId: row.actor_id,
    outcome: row.outcome,
    reasonCode: row.reason_code,
    result: row.result_json,
    createdAt: row.created_at,
    replayed,
  };
}

async function insertTerminalReceipt(
  tx: PgTransactionClient,
  input: {
    organizationId: string;
    actorId: string;
    entryId: string;
    initiativeId: string;
    expectedVersion: number;
    idempotencyKey: string;
    requestDigest: string;
    outcome: ExecutionActionOutcome;
    reasonCode: string | null;
    deleted: boolean;
    entryVersion: number | null;
  }
): Promise<BudgetDeleteReceipt> {
  await recordExecutionActionAudit(
    {
      organizationId: input.organizationId,
      actionId: ACTION_ID,
      targetId: input.entryId,
      actorId: input.actorId,
      outcome: input.outcome,
      reasonCode: input.reasonCode,
      requestId: input.idempotencyKey,
    },
    tx
  );
  const inserted = await tx.query<ReceiptRow>(
    `INSERT INTO execution_budget_delete_receipts
       (organization_id,action_id,entry_id,initiative_id,expected_version,
        idempotency_key,request_digest,actor_id,outcome,reason_code,result_json)
     VALUES (?,?,?,?,?,?,?,?,?,?,?::jsonb) RETURNING *`,
    [
      input.organizationId,
      ACTION_ID,
      input.entryId,
      input.initiativeId,
      input.expectedVersion,
      input.idempotencyKey,
      input.requestDigest,
      input.actorId,
      input.outcome,
      input.reasonCode,
      JSON.stringify({ deleted: input.deleted, entryVersion: input.entryVersion }),
    ]
  );
  return mapReceipt(inserted.rows[0], false);
}

export async function executeBudgetDeleteCommand(input: {
  organizationId: string;
  actorId: string;
  entryId: string;
  initiativeId: string;
  expectedVersion: number;
  idempotencyKey: string;
}): Promise<BudgetDeleteReceipt> {
  if (!input.idempotencyKey.trim()) throw new Error('execution_budget_delete_idempotency_required');
  if (!Number.isInteger(input.expectedVersion) || input.expectedVersion < 1) {
    throw new Error('execution_budget_delete_expected_version_invalid');
  }
  const requestDigest = digest(input);
  const receipt = await withPgTransaction(async (tx) => {
    await tx.query(`SELECT pg_advisory_xact_lock(hashtextextended(?, 0))`, [
      `${input.organizationId}:${ACTION_ID}:${input.idempotencyKey}`,
    ]);

    // Authority is re-read on the exact transaction that may mutate. A replay
    // still requires a currently ACTIVE actor, but is resolved before target
    // lookup so a deleted row never turns a valid retry into NOT_FOUND.
    const membership = await requireOrgMemberWithClient(tx, input.actorId, input.organizationId);
    const policy = await getExecutionActionPolicy(ACTION_ID, tx);
    if (!policy || policy.runtimeState !== 'IMPLEMENTED') {
      throw new Error('execution_action_hidden_or_unregistered');
    }
    const existing = await tx.query<ReceiptRow>(
      `SELECT * FROM execution_budget_delete_receipts
        WHERE organization_id=? AND action_id=? AND idempotency_key=?`,
      [input.organizationId, ACTION_ID, input.idempotencyKey]
    );
    if (existing.rows[0]) {
      if (existing.rows[0].request_digest !== requestDigest) {
        throw new Error('execution_budget_delete_idempotency_conflict');
      }
      return mapReceipt(existing.rows[0], true);
    }
    if (ROLE_RANK[membership.role] < ROLE_RANK[policy.minimumRole]) {
      return insertTerminalReceipt(tx, {
        ...input,
        requestDigest,
        outcome: 'DENIED',
        reasonCode: 'insufficient_org_role',
        deleted: false,
        entryVersion: null,
      });
    }

    const target = await tx.query<{ version: number }>(
      `SELECT version FROM budget_entries
        WHERE id=? AND organization_id=? AND initiative_id=? FOR UPDATE`,
      [input.entryId, input.organizationId, input.initiativeId]
    );
    if (!target.rows[0]) {
      return insertTerminalReceipt(tx, {
        ...input,
        requestDigest,
        outcome: 'NOT_FOUND',
        reasonCode: 'budget_entry_not_found',
        deleted: false,
        entryVersion: null,
      });
    }
    const actualVersion = Number(target.rows[0].version);
    if (actualVersion !== input.expectedVersion) {
      return insertTerminalReceipt(tx, {
        ...input,
        requestDigest,
        outcome: 'CONFLICT',
        reasonCode: 'budget_entry_version_conflict',
        deleted: false,
        entryVersion: actualVersion,
      });
    }
    const deleted = await deleteBudgetEntry(
      input.organizationId,
      input.entryId,
      input.initiativeId,
      input.expectedVersion,
      { deferSideEffects: true }
    );
    if (!deleted) throw new Error('execution_budget_delete_cas_lost');
    return insertTerminalReceipt(tx, {
      ...input,
      requestDigest,
      outcome: 'SUCCEEDED',
      reasonCode: null,
      deleted: true,
      entryVersion: actualVersion,
    });
  });

  if (receipt.outcome === 'SUCCEEDED' && !receipt.replayed) {
    void emitBudgetDeleteSideEffects(
      input.organizationId,
      input.initiativeId,
      input.entryId,
      input.actorId
    ).catch((error) =>
      logger.warn('[ExecutionBudgetDelete] post-commit Results signal failed', {
        organizationId: input.organizationId,
        initiativeId: input.initiativeId,
        entryId: input.entryId,
        error: error instanceof Error ? error.message : String(error),
      })
    );
  }
  return receipt;
}

export async function getBudgetDeleteReceipt(input: {
  organizationId: string;
  actorId: string;
  entryId: string;
  initiativeId: string;
  idempotencyKey: string;
}): Promise<BudgetDeleteReceipt | null> {
  return withPgTransaction(async (tx) => {
    const membership = await requireOrgMemberWithClient(tx, input.actorId, input.organizationId);
    const policy = await getExecutionActionPolicy(ACTION_ID, tx);
    if (
      !policy ||
      policy.runtimeState !== 'IMPLEMENTED' ||
      ROLE_RANK[membership.role] < ROLE_RANK[policy.minimumRole]
    ) {
      throw new Error('insufficient_org_role');
    }
    const result = await tx.query<ReceiptRow>(
      `SELECT * FROM execution_budget_delete_receipts
        WHERE organization_id=? AND action_id=? AND entry_id=? AND initiative_id=?
          AND idempotency_key=? AND actor_id=?`,
      [
        input.organizationId,
        ACTION_ID,
        input.entryId,
        input.initiativeId,
        input.idempotencyKey,
        input.actorId,
      ]
    );
    return result.rows[0] ? mapReceipt(result.rows[0], true) : null;
  });
}
