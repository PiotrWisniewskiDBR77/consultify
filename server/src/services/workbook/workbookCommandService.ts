import { v4 as uuidv4 } from 'uuid';

import * as queryHelpers from '../../utils/queryHelpers.js';
import {
  applyWorkbookMutations,
  transformWorkbookRangeRef,
  type WorkbookMutation,
} from './workbookMutationEngine.js';
import { invalidateWorkbookRuntimeCache } from './workbookRuntimeCache.js';
import { assertWorkbookSchema } from './workbookSchemaGuard.js';
import type { WorkbookSchema } from './WorkbookSchema.js';

export class WorkbookCommandError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number,
    public readonly details: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'WorkbookCommandError';
  }
}

export interface ApplyWorkbookCommandInput {
  workbookId: string;
  organizationId: string;
  userId: string;
  commandId: string;
  baseVersion: number;
  idempotencyKey: string;
  operations: WorkbookMutation[];
}

export interface ApplyWorkbookCommandResult {
  duplicate: boolean;
  commandId: string;
  version: number;
  operationCount: number;
}

export interface UndoWorkbookCommandInput {
  workbookId: string;
  organizationId: string;
  userId: string;
  commandVersion: number;
  baseVersion: number;
  idempotencyKey: string;
}

export interface UndoWorkbookCommandResult {
  duplicate: boolean;
  commandVersion: number;
  version: number;
  restoredCommentSheetIds: string[];
  orphanedCommentSheetIds: string[];
}

// FIX (G3 closure, 2026-08-16): this used to run its own
// `CREATE TABLE IF NOT EXISTS` / `ALTER TABLE ... ADD COLUMN` block, in
// parallel with (and byte-for-byte duplicating) the one `ensureWorkbookSchema()`
// ran in `workbook.routes.ts` — TWO independent runtime-DDL call sites for the
// same tables. Both now delegate to the single shared assertion in
// `workbookSchemaGuard.ts`; see that module for the full rationale (closure
// gate G3: zero lazy/runtime DDL). DDL lives exclusively in
// `server/migrations/20260912_claude_c_workbook_schema.sql`.
async function ensureCommandStorage(): Promise<void> {
  await assertWorkbookSchema();
}

function validateInput(input: ApplyWorkbookCommandInput): void {
  if (!input.workbookId || !input.organizationId || !input.userId) {
    throw new WorkbookCommandError(
      'Workbook command scope is incomplete',
      'WORKBOOK_COMMAND_SCOPE_INVALID',
      400
    );
  }
  if (!input.commandId.trim() || input.commandId.length > 120) {
    throw new WorkbookCommandError('commandId is required', 'WORKBOOK_COMMAND_INVALID', 400);
  }
  if (!Number.isInteger(input.baseVersion) || input.baseVersion < 0) {
    throw new WorkbookCommandError(
      'baseVersion must be a non-negative integer',
      'WORKBOOK_COMMAND_INVALID',
      400
    );
  }
  if (!input.idempotencyKey.trim() || input.idempotencyKey.length > 200) {
    throw new WorkbookCommandError('idempotencyKey is required', 'WORKBOOK_COMMAND_INVALID', 400);
  }
  if (
    !Array.isArray(input.operations) ||
    input.operations.length < 1 ||
    input.operations.length > 1000
  ) {
    throw new WorkbookCommandError(
      'operations must contain between 1 and 1000 entries',
      'WORKBOOK_COMMAND_INVALID',
      400
    );
  }
}

export async function applyWorkbookCommand(
  input: ApplyWorkbookCommandInput
): Promise<ApplyWorkbookCommandResult> {
  validateInput(input);
  await ensureCommandStorage();
  const row = await queryHelpers.queryOne<{
    schema_json: string | null;
    version: number | null;
    last_mutation_key: string | null;
  }>(
    `SELECT schema_json, version, last_mutation_key
     FROM generated_workbooks WHERE id = ? AND organization_id = ?`,
    [input.workbookId, input.organizationId]
  );
  if (!row?.schema_json) {
    throw new WorkbookCommandError('Workbook not found or expired', 'WORKBOOK_NOT_FOUND', 404);
  }

  const currentVersion = Number(row.version ?? 0);
  if (row.last_mutation_key === input.idempotencyKey) {
    return {
      duplicate: true,
      commandId: input.commandId,
      version: currentVersion,
      operationCount: input.operations.length,
    };
  }
  if (currentVersion !== input.baseVersion) {
    throw new WorkbookCommandError('Workbook version conflict', 'WORKBOOK_VERSION_CONFLICT', 409, {
      expectedVersion: input.baseVersion,
      currentVersion,
    });
  }

  let schema: WorkbookSchema;
  let mutationOutcome: ReturnType<typeof applyWorkbookMutations>;
  try {
    schema = JSON.parse(row.schema_json) as WorkbookSchema;
    mutationOutcome = applyWorkbookMutations(schema, input.operations);
  } catch (error) {
    throw new WorkbookCommandError(
      error instanceof Error ? error.message : 'Invalid workbook mutation',
      'WORKBOOK_MUTATION_INVALID',
      400
    );
  }

  const nextVersion = currentVersion + 1;
  const serializedSchema = JSON.stringify(schema);
  const persisted = await queryHelpers.transaction(async () => {
    const result = await queryHelpers.queryRun(
      `UPDATE generated_workbooks
       SET schema_json = ?, version = ?, last_mutation_key = ?, approval_current = 0
       WHERE id = ? AND organization_id = ? AND COALESCE(version, 0) = ?`,
      [
        serializedSchema,
        nextVersion,
        input.idempotencyKey,
        input.workbookId,
        input.organizationId,
        currentVersion,
      ]
    );
    if (!result.changes) return false;
    await queryHelpers.queryRun(
      `INSERT INTO generated_workbook_revisions
       (id, workbook_id, organization_id, version, command_id, idempotency_key,
        base_schema_json, schema_json, operations_json, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuidv4(),
        input.workbookId,
        input.organizationId,
        nextVersion,
        input.commandId,
        input.idempotencyKey,
        row.schema_json,
        serializedSchema,
        JSON.stringify(input.operations),
        input.userId,
      ]
    );
    for (const sheetId of mutationOutcome.orphanedSheetIds) {
      await queryHelpers.queryRun(
        `UPDATE generated_workbook_comments
         SET anchor_state = 'orphaned', updated_at = CURRENT_TIMESTAMP
         WHERE workbook_id = ? AND organization_id = ? AND sheet_id = ?`,
        [input.workbookId, input.organizationId, sheetId]
      );
      await queryHelpers.queryRun(
        `UPDATE generated_workbook_source_bindings
         SET anchor_state = 'orphaned', updated_at = CURRENT_TIMESTAMP
         WHERE workbook_id = ? AND organization_id = ? AND sheet_id = ?`,
        [input.workbookId, input.organizationId, sheetId]
      );
    }
    if (mutationOutcome.anchorTransforms.length > 0) {
      const comments = await queryHelpers.queryAll<{
        id: string;
        sheet_id: string;
        range_ref: string;
      }>(
        `SELECT id, sheet_id, range_ref FROM generated_workbook_comments
         WHERE workbook_id = ? AND organization_id = ? AND anchor_state = 'active'
           AND deleted_at IS NULL AND range_ref IS NOT NULL`,
        [input.workbookId, input.organizationId]
      );
      for (const comment of comments) {
        let nextRange: string | null = comment.range_ref;
        for (const transform of mutationOutcome.anchorTransforms) {
          if (transform.sheetId === comment.sheet_id && nextRange) {
            nextRange = transformWorkbookRangeRef(nextRange, transform);
          }
        }
        if (!nextRange) {
          await queryHelpers.queryRun(
            `UPDATE generated_workbook_comments
             SET anchor_state = 'orphaned', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [comment.id]
          );
        } else if (nextRange !== comment.range_ref) {
          await queryHelpers.queryRun(
            `UPDATE generated_workbook_comments
             SET range_ref = ?, anchored_version = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [nextRange, nextVersion, comment.id]
          );
        }
      }
      const sourceBindings = await queryHelpers.queryAll<{
        id: string;
        sheet_id: string;
        range_ref: string;
      }>(
        `SELECT id, sheet_id, range_ref FROM generated_workbook_source_bindings
         WHERE workbook_id = ? AND organization_id = ? AND anchor_state = 'active'`,
        [input.workbookId, input.organizationId]
      );
      for (const binding of sourceBindings) {
        let nextRange: string | null = binding.range_ref;
        for (const transform of mutationOutcome.anchorTransforms) {
          if (transform.sheetId === binding.sheet_id && nextRange) {
            nextRange = transformWorkbookRangeRef(nextRange, transform);
          }
        }
        if (!nextRange) {
          await queryHelpers.queryRun(
            `UPDATE generated_workbook_source_bindings
             SET anchor_state = 'orphaned', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [binding.id]
          );
        } else if (nextRange !== binding.range_ref) {
          await queryHelpers.queryRun(
            `UPDATE generated_workbook_source_bindings
             SET range_ref = ?, anchored_version = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [nextRange, nextVersion, binding.id]
          );
        }
      }
    }
    return true;
  });

  if (!persisted) {
    throw new WorkbookCommandError('Workbook version conflict', 'WORKBOOK_VERSION_CONFLICT', 409, {
      expectedVersion: currentVersion,
    });
  }
  invalidateWorkbookRuntimeCache(input.workbookId);
  return {
    duplicate: false,
    commandId: input.commandId,
    version: nextVersion,
    operationCount: input.operations.length,
  };
}

export async function undoWorkbookCommand(
  input: UndoWorkbookCommandInput
): Promise<UndoWorkbookCommandResult> {
  if (!input.workbookId || !input.organizationId || !input.userId) {
    throw new WorkbookCommandError(
      'Workbook undo scope is incomplete',
      'WORKBOOK_COMMAND_SCOPE_INVALID',
      400
    );
  }
  if (
    !Number.isInteger(input.commandVersion) ||
    input.commandVersion < 1 ||
    !Number.isInteger(input.baseVersion) ||
    input.baseVersion < 0 ||
    !input.idempotencyKey.trim()
  ) {
    throw new WorkbookCommandError(
      'commandVersion, baseVersion and idempotencyKey are required',
      'WORKBOOK_COMMAND_INVALID',
      400
    );
  }

  await ensureCommandStorage();
  const head = await queryHelpers.queryOne<{
    schema_json: string;
    version: number | null;
    last_mutation_key: string | null;
  }>(
    `SELECT schema_json, version, last_mutation_key
     FROM generated_workbooks WHERE id = ? AND organization_id = ?`,
    [input.workbookId, input.organizationId]
  );
  if (!head?.schema_json) {
    throw new WorkbookCommandError('Workbook not found or expired', 'WORKBOOK_NOT_FOUND', 404);
  }

  const currentVersion = Number(head.version ?? 0);
  if (head.last_mutation_key === input.idempotencyKey) {
    return {
      duplicate: true,
      commandVersion: input.commandVersion,
      version: currentVersion,
      restoredCommentSheetIds: [],
      orphanedCommentSheetIds: [],
    };
  }
  if (currentVersion !== input.baseVersion) {
    throw new WorkbookCommandError('Workbook version conflict', 'WORKBOOK_VERSION_CONFLICT', 409, {
      expectedVersion: input.baseVersion,
      currentVersion,
    });
  }

  const commandRevision = await queryHelpers.queryOne<{ base_schema_json: string }>(
    `SELECT base_schema_json FROM generated_workbook_revisions
     WHERE workbook_id = ? AND organization_id = ? AND version = ?`,
    [input.workbookId, input.organizationId, input.commandVersion]
  );
  if (!commandRevision?.base_schema_json) {
    throw new WorkbookCommandError(
      'Workbook command revision not found',
      'WORKBOOK_REVISION_NOT_FOUND',
      404
    );
  }

  let headSchema: WorkbookSchema;
  let targetSchema: WorkbookSchema;
  try {
    headSchema = JSON.parse(head.schema_json) as WorkbookSchema;
    targetSchema = JSON.parse(commandRevision.base_schema_json) as WorkbookSchema;
  } catch {
    throw new WorkbookCommandError(
      'Workbook revision contains invalid schema JSON',
      'WORKBOOK_REVISION_INVALID',
      422
    );
  }

  const headSheetIds = new Set(
    (headSchema.sheets || [])
      .map((sheet) => sheet.id)
      .filter((sheetId): sheetId is string => typeof sheetId === 'string' && sheetId.length > 0)
  );
  const targetSheetIds = new Set(
    (targetSchema.sheets || [])
      .map((sheet) => sheet.id)
      .filter((sheetId): sheetId is string => typeof sheetId === 'string' && sheetId.length > 0)
  );
  const restoredSheetIds = [...targetSheetIds].filter((sheetId) => !headSheetIds.has(sheetId));
  const removedSheetIds = [...headSheetIds].filter((sheetId) => !targetSheetIds.has(sheetId));
  const nextVersion = currentVersion + 1;

  const persisted = await queryHelpers.transaction(async () => {
    const result = await queryHelpers.queryRun(
      `UPDATE generated_workbooks
       SET schema_json = ?, version = ?, last_mutation_key = ?, approval_current = 0
       WHERE id = ? AND organization_id = ? AND COALESCE(version, 0) = ?`,
      [
        commandRevision.base_schema_json,
        nextVersion,
        input.idempotencyKey,
        input.workbookId,
        input.organizationId,
        currentVersion,
      ]
    );
    if (!result.changes) return false;
    await queryHelpers.queryRun(
      `INSERT INTO generated_workbook_revisions
       (id, workbook_id, organization_id, version, command_id, idempotency_key,
        base_schema_json, schema_json, operations_json, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuidv4(),
        input.workbookId,
        input.organizationId,
        nextVersion,
        'xlsx.history.undo',
        input.idempotencyKey,
        head.schema_json,
        commandRevision.base_schema_json,
        JSON.stringify([{ commandVersion: input.commandVersion }]),
        input.userId,
      ]
    );
    for (const sheetId of restoredSheetIds) {
      await queryHelpers.queryRun(
        `UPDATE generated_workbook_comments
         SET anchor_state = 'active', updated_at = CURRENT_TIMESTAMP
         WHERE workbook_id = ? AND organization_id = ? AND sheet_id = ?
           AND deleted_at IS NULL`,
        [input.workbookId, input.organizationId, sheetId]
      );
      await queryHelpers.queryRun(
        `UPDATE generated_workbook_source_bindings
         SET anchor_state = 'active', updated_at = CURRENT_TIMESTAMP
         WHERE workbook_id = ? AND organization_id = ? AND sheet_id = ?`,
        [input.workbookId, input.organizationId, sheetId]
      );
    }
    for (const sheetId of removedSheetIds) {
      await queryHelpers.queryRun(
        `UPDATE generated_workbook_comments
         SET anchor_state = 'orphaned', updated_at = CURRENT_TIMESTAMP
         WHERE workbook_id = ? AND organization_id = ? AND sheet_id = ?
           AND deleted_at IS NULL`,
        [input.workbookId, input.organizationId, sheetId]
      );
      await queryHelpers.queryRun(
        `UPDATE generated_workbook_source_bindings
         SET anchor_state = 'orphaned', updated_at = CURRENT_TIMESTAMP
         WHERE workbook_id = ? AND organization_id = ? AND sheet_id = ?`,
        [input.workbookId, input.organizationId, sheetId]
      );
    }
    return true;
  });
  if (!persisted) {
    throw new WorkbookCommandError('Workbook version conflict', 'WORKBOOK_VERSION_CONFLICT', 409, {
      expectedVersion: currentVersion,
    });
  }
  invalidateWorkbookRuntimeCache(input.workbookId);
  return {
    duplicate: false,
    commandVersion: input.commandVersion,
    version: nextVersion,
    restoredCommentSheetIds: restoredSheetIds,
    orphanedCommentSheetIds: removedSheetIds,
  };
}
