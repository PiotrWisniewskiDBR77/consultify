/**
 * AI Editor Mutation Executor (Block C · C-S2/C-S3 · apply path).
 *
 * Turns the `operations` array persisted on a `tp_schema_proposals` row into
 * REAL mutations against `tp_records` / `tp_fields` / `tp_views`. This is the
 * component that `TableAiEditorService.applyProposal` delegates to once a
 * proposal is accepted — replacing the C-S1 `stub_handler_no_op`.
 *
 * Contract
 * --------
 *   - Each operation is validated against the canonical zod envelope in
 *     `operations.ts` BEFORE it is executed; a malformed op aborts the whole
 *     apply with `MutationExecutorError` so a partial proposal can never be
 *     half-applied silently. Operations execute in declared order (the
 *     handlers already topologically order `dependsOn`).
 *   - Cross-tenant safety: the executor receives the resolved `workspaceId` +
 *     `organizationId` from the apply flow and asserts that every `tableId`
 *     touched by an operation belongs to that tenant before mutating. A
 *     proposal that smuggles a foreign `tableId` is refused.
 *   - Levels 7 (methodological) and 8 (source) are READ-ONLY by design (they
 *     surface findings/suggestions, never mutate). Their operations are
 *     recorded as `skipped: 'read_only'` so apply is still idempotent and the
 *     audit trail reflects that nothing changed.
 *
 * Maps each operation type to the existing platform services:
 *   op_cell_set            → RecordsService.updateRecord (single field)
 *   op_record_update       → RecordsService.updateRecord (multi-field)
 *   op_record_create       → RecordsService.createRecord
 *   op_column_fill         → RecordsService.updateRecord per cell
 *   op_schema_add_field    → MetadataService.createField
 *   op_schema_rename_field → MetadataService.updateField (name)
 *   op_schema_retype_field → MetadataService.changeFieldType
 *   op_schema_drop_field   → MetadataService.deleteField
 *   op_view_create         → MetadataService.createView
 *   op_view_update         → MetadataService.updateView (config merge)
 *   op_relation_create     → MetadataService.createField (linkedRecord)
 *   op_methodological_flag → read-only (skipped)
 *   op_source_suggest      → read-only (skipped)
 */

import { getDatabase } from '../../../database/Database.js';
import logger from '../../../utils/Logger.js';
import metadataService from '../MetadataService.js';
import recordsService from '../RecordsService.js';
import { type AiEditorOperation, aiEditorOperation } from './operations.js';

export class MutationExecutorError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = 'MutationExecutorError';
  }
}

export interface ExecuteOperationsInput {
  /** Raw operations array as stored on the proposal row (already JSON-parsed). */
  operations: unknown[];
  /** Tenant resolved by the apply flow. */
  workspaceId: string;
  organizationId: string;
  /** Authenticated actor performing the apply. */
  actorUserId: string;
  /** AI Editor level — used to short-circuit read-only levels. */
  level: string | null;
}

export interface OperationOutcome {
  id: string;
  type: string;
  status: 'applied' | 'skipped';
  reason?: string;
  /** Best-effort id of the entity that was created/mutated. */
  entityId?: string;
}

export interface ExecuteOperationsResult {
  applied: number;
  skipped: number;
  outcomes: OperationOutcome[];
}

const READ_ONLY_LEVELS = new Set(['methodological', 'source']);

/**
 * Resolve the tenant (workspace + organization) that owns a table, so the
 * executor can refuse cross-tenant writes even if a proposal row references a
 * foreign tableId.
 */
async function assertTableInTenant(
  tableId: string,
  workspaceId: string,
  organizationId: string
): Promise<void> {
  const db = getDatabase();
  const { rows } = await db.query(
    `SELECT b.workspace_id, b.organization_id
       FROM tp_tables t
       JOIN tp_bases  b ON t.base_id = b.id
      WHERE t.id = $1
      LIMIT 1`,
    [tableId]
  );
  const row = rows?.[0] as { workspace_id?: unknown; organization_id?: unknown } | undefined;
  if (!row) {
    throw new MutationExecutorError('TABLE_NOT_FOUND', `Table ${tableId} not found`);
  }
  if (String(row.workspace_id) !== workspaceId || String(row.organization_id) !== organizationId) {
    throw new MutationExecutorError(
      'TENANT_VIOLATION',
      `Table ${tableId} does not belong to the actor tenant`
    );
  }
}

async function executeOne(
  op: AiEditorOperation,
  input: ExecuteOperationsInput,
  tenantCache: Set<string>
): Promise<OperationOutcome> {
  const { workspaceId, organizationId, actorUserId } = input;

  // Tenant gate (memoised per table within this apply).
  const tableId = op.target.tableId;
  if (!tenantCache.has(tableId)) {
    await assertTableInTenant(tableId, workspaceId, organizationId);
    tenantCache.add(tableId);
  }

  switch (op.type) {
    case 'op_cell_set': {
      const patch = { [op.target.fieldId]: op.after };
      await recordsService.updateRecord(op.target.recordId, patch, actorUserId);
      return { id: op.id, type: op.type, status: 'applied', entityId: op.target.recordId };
    }

    case 'op_record_update': {
      const patch: Record<string, unknown> = {};
      for (const change of op.fieldChanges) {
        patch[change.fieldId] = change.after;
      }
      await recordsService.updateRecord(op.target.recordId, patch, actorUserId);
      return { id: op.id, type: op.type, status: 'applied', entityId: op.target.recordId };
    }

    case 'op_record_create': {
      const created = await recordsService.createRecord(tableId, { ...op.data }, actorUserId);
      const entityId = (created as { id?: string } | null)?.id;
      return { id: op.id, type: op.type, status: 'applied', entityId };
    }

    case 'op_column_fill': {
      let lastId: string | undefined;
      for (const cell of op.cells) {
        await recordsService.updateRecord(
          cell.recordId,
          { [op.target.fieldId]: cell.after },
          actorUserId
        );
        lastId = cell.recordId;
      }
      return {
        id: op.id,
        type: op.type,
        status: 'applied',
        reason: `filled_${op.cells.length}_cells`,
        entityId: lastId,
      };
    }

    case 'op_schema_add_field': {
      const field = await metadataService.createField(
        tableId,
        op.payload.name,
        op.payload.fieldType,
        op.payload.options,
        actorUserId
      );
      return {
        id: op.id,
        type: op.type,
        status: 'applied',
        entityId: (field as { id?: string } | null)?.id,
      };
    }

    case 'op_schema_rename_field': {
      await metadataService.updateField(op.target.fieldId, { name: op.payload.to });
      return { id: op.id, type: op.type, status: 'applied', entityId: op.target.fieldId };
    }

    case 'op_schema_retype_field': {
      await metadataService.changeFieldType(
        op.target.fieldId,
        op.payload.to,
        actorUserId,
        op.payload.options,
        false
      );
      return { id: op.id, type: op.type, status: 'applied', entityId: op.target.fieldId };
    }

    case 'op_schema_drop_field': {
      await metadataService.deleteField(op.target.fieldId, actorUserId);
      return { id: op.id, type: op.type, status: 'applied', entityId: op.target.fieldId };
    }

    case 'op_view_create': {
      const view = await metadataService.createView(
        tableId,
        op.payload.name,
        op.payload.viewType,
        op.payload.config,
        actorUserId
      );
      return {
        id: op.id,
        type: op.type,
        status: 'applied',
        entityId: (view as { id?: string } | null)?.id,
      };
    }

    case 'op_view_update': {
      await metadataService.updateView(op.target.viewId, { config: op.payload.config });
      return { id: op.id, type: op.type, status: 'applied', entityId: op.target.viewId };
    }

    case 'op_relation_create': {
      // Both endpoints must live in the same tenant. fromTableId is the carrier
      // of the new linkedRecord field; toTableId is the linked table.
      await assertTableInTenant(op.payload.fromTableId, workspaceId, organizationId);
      await assertTableInTenant(op.payload.toTableId, workspaceId, organizationId);
      const field = await metadataService.createField(
        op.payload.fromTableId,
        op.payload.fromFieldName,
        'linkedRecord',
        {
          linkedTableId: op.payload.toTableId,
          bidirectional: op.payload.bidirectional,
        },
        actorUserId
      );
      return {
        id: op.id,
        type: op.type,
        status: 'applied',
        entityId: (field as { id?: string } | null)?.id,
      };
    }

    case 'op_methodological_flag':
    case 'op_source_suggest': {
      // Read-only by design: levels 7/8 surface findings/suggestions. Applying
      // them does not mutate data — the user acts on the finding separately.
      return { id: op.id, type: op.type, status: 'skipped', reason: 'read_only' };
    }

    default: {
      // Exhaustiveness guard — the zod union should make this unreachable.
      const _never: never = op;
      throw new MutationExecutorError(
        'UNKNOWN_OPERATION',
        `Unsupported operation type: ${JSON.stringify(_never)}`
      );
    }
  }
}

/**
 * Validate + execute every operation on a proposal. Throws
 * `MutationExecutorError` on the first invalid or failing op so the caller can
 * surface a clean failure without leaving a `tp_schema_proposals` row marked
 * applied when the mutations did not all land.
 */
export async function executeProposalOperations(
  input: ExecuteOperationsInput
): Promise<ExecuteOperationsResult> {
  const outcomes: OperationOutcome[] = [];
  const tenantCache = new Set<string>();

  // Read-only levels never carry mutating operations; short-circuit cleanly so
  // the apply remains idempotent and audit reflects "nothing changed".
  const levelIsReadOnly = input.level != null && READ_ONLY_LEVELS.has(input.level);

  const rawOps = Array.isArray(input.operations) ? input.operations : [];

  for (const raw of rawOps) {
    const parsed = aiEditorOperation.safeParse(raw);
    if (!parsed.success) {
      throw new MutationExecutorError(
        'INVALID_OPERATION',
        `Operation failed schema validation: ${parsed.error.issues
          .map((i) => `${i.path.join('.')}: ${i.message}`)
          .join('; ')}`
      );
    }

    if (levelIsReadOnly) {
      outcomes.push({
        id: parsed.data.id,
        type: parsed.data.type,
        status: 'skipped',
        reason: 'read_only',
      });
      continue;
    }

    try {
      const outcome = await executeOne(parsed.data, input, tenantCache);
      outcomes.push(outcome);
    } catch (e) {
      if (e instanceof MutationExecutorError) throw e;
      logger.error('[MutationExecutor] operation execution failed', {
        opId: parsed.data.id,
        opType: parsed.data.type,
        error: (e as Error).message,
      });
      throw new MutationExecutorError(
        'EXECUTION_FAILED',
        `Operation ${parsed.data.id} (${parsed.data.type}) failed: ${(e as Error).message}`
      );
    }
  }

  const applied = outcomes.filter((o) => o.status === 'applied').length;
  const skipped = outcomes.filter((o) => o.status === 'skipped').length;
  return { applied, skipped, outcomes };
}
