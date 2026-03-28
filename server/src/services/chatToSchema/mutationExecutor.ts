/**
 * MutationExecutor — transactional execution of schema operations with
 * rollback support and @ref:Name reference resolution.
 *
 * Pipeline position: ProposalGenerator → SchemaValidator → **MutationExecutor**
 */

import { getDatabase } from '../../database/Database.js';
import logger from '../../utils/Logger.js';
import metadataService from '../tablePlatform/MetadataService.js';
import recordsService from '../tablePlatform/RecordsService.js';
import type { SchemaOperation } from './proposalGenerator.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RollbackAction {
  type: string;
  params: Record<string, unknown>;
}

export interface MutationResult {
  operationId: string;
  operationType: string;
  success: boolean;
  result?: Record<string, unknown>;
  error?: string;
  rollbackAction?: RollbackAction;
}

export interface ExecutionOutcome {
  results: MutationResult[];
  allSucceeded: boolean;
  createdEntities: Map<string, string>;
}

// ---------------------------------------------------------------------------
// Reference resolution
// ---------------------------------------------------------------------------

const REF_PATTERN = /^@ref:(.+)$/;

function resolveReferences(
  operations: SchemaOperation[],
  createdEntities: Map<string, string>
): SchemaOperation[] {
  return operations.map((op) => ({
    ...op,
    target: resolveObject(op.target, createdEntities) as SchemaOperation['target'],
    payload: resolveObject(op.payload, createdEntities) as Record<string, unknown>,
  }));
}

function resolveObject(obj: unknown, createdEntities: Map<string, string>): unknown {
  if (typeof obj === 'string') {
    const match = REF_PATTERN.exec(obj);
    if (match) {
      const refName = match[1];
      return createdEntities.get(refName) ?? obj;
    }
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => resolveObject(item, createdEntities));
  }
  if (obj !== null && typeof obj === 'object') {
    const resolved: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      resolved[key] = resolveObject(value, createdEntities);
    }
    return resolved;
  }
  return obj;
}

// ---------------------------------------------------------------------------
// Topological sort by dependencies
// ---------------------------------------------------------------------------

function sortByDependencies(operations: SchemaOperation[]): SchemaOperation[] {
  const byId = new Map<string, SchemaOperation>();
  for (const op of operations) {
    byId.set(op.id, op);
  }

  const visited = new Set<string>();
  const sorted: SchemaOperation[] = [];

  function visit(id: string) {
    if (visited.has(id)) return;
    visited.add(id);
    const op = byId.get(id);
    if (!op) return;
    for (const dep of op.dependencies ?? []) {
      visit(dep);
    }
    sorted.push(op);
  }

  for (const op of operations) {
    visit(op.id);
  }

  return sorted;
}

// ---------------------------------------------------------------------------
// Field type normalization (camelCase → snake_case for DB)
// ---------------------------------------------------------------------------

const FIELD_TYPE_MAP: Record<string, string> = {
  singleLineText: 'single_line_text',
  longText: 'long_text',
  singleSelect: 'single_select',
  multiSelect: 'multi_select',
  linkedRecord: 'linked_record',
  createdTime: 'created_time',
  createdBy: 'created_by',
  lastModifiedTime: 'last_modified_time',
  lastModifiedBy: 'last_modified_by',
  autoNumber: 'auto_number',
};

function normalizeFieldType(ft: string): string {
  return FIELD_TYPE_MAP[ft] ?? ft;
}

// ---------------------------------------------------------------------------
// MutationExecutor
// ---------------------------------------------------------------------------

export class MutationExecutor {
  async executeOperations(
    operations: SchemaOperation[],
    baseId: string,
    userId?: string,
    organizationId?: string,
    workspaceId?: string
  ): Promise<ExecutionOutcome> {
    const sorted = sortByDependencies(operations);
    const createdEntities = new Map<string, string>();
    const results: MutationResult[] = [];

    for (let i = 0; i < sorted.length; i++) {
      const resolved = resolveReferences([sorted[i]], createdEntities);
      const op = resolved[0];
      const opType = op.operation_type;

      try {
        const result = await this.executeSingle(
          op,
          baseId,
          createdEntities,
          userId,
          organizationId,
          workspaceId
        );
        results.push(result);

        if (!result.success) {
          logger.error('[MutationExecutor] Operation failed, rolling back', {
            operationId: op.id,
            error: result.error,
          });
          await this.rollback(results);
          return { results, allSucceeded: false, createdEntities };
        }

        if (result.result?.id) {
          createdEntities.set(op.id, String(result.result.id));
          const entityName = (op.payload?.name as string) ?? undefined;
          if (entityName) {
            createdEntities.set(entityName, String(result.result.id));
          }
        }
      } catch (err) {
        const errMsg = (err as Error).message;
        logger.error('[MutationExecutor] Unexpected error, rolling back', {
          operationId: op.id,
          opType,
          error: errMsg,
        });
        results.push({
          operationId: op.id,
          operationType: opType,
          success: false,
          error: errMsg,
        });
        await this.rollback(results);
        return { results, allSucceeded: false, createdEntities };
      }
    }

    return { results, allSucceeded: true, createdEntities };
  }

  async rollback(results: MutationResult[]): Promise<void> {
    const successful = results.filter((r) => r.success && r.rollbackAction);
    for (const result of [...successful].reverse()) {
      const action = result.rollbackAction!;
      try {
        await this.executeRollbackAction(action);
        logger.info('[MutationExecutor] Rolled back operation', {
          operationId: result.operationId,
          rollbackType: action.type,
        });
      } catch (err) {
        logger.error('[MutationExecutor] Rollback failed for operation', {
          operationId: result.operationId,
          rollbackType: action.type,
          error: (err as Error).message,
        });
      }
    }
  }

  // -----------------------------------------------------------------------
  // Single operation dispatch
  // -----------------------------------------------------------------------

  private async executeSingle(
    op: SchemaOperation,
    baseId: string,
    createdEntities: Map<string, string>,
    userId?: string,
    organizationId?: string,
    workspaceId?: string
  ): Promise<MutationResult> {
    const opType = op.operation_type;
    const target = (op.target ?? {}) as Record<string, string>;
    const payload = (op.payload ?? {}) as Record<string, unknown>;

    switch (opType) {
      case 'create_base':
      case 'add_base':
        return this.execCreateBase(op.id, payload, workspaceId, organizationId, userId);

      case 'create_table':
      case 'add_table':
        return this.execCreateTable(op.id, target, payload, baseId, createdEntities, userId);

      case 'create_field':
      case 'add_field':
        return this.execCreateField(op.id, target, payload, createdEntities, userId);

      case 'modify_field':
      case 'update_field':
        return this.execUpdateField(op.id, target, payload, createdEntities);

      case 'remove_field':
      case 'delete_field':
        return this.execDeleteField(op.id, target, createdEntities, userId);

      case 'create_view':
      case 'add_view':
        return this.execCreateView(op.id, target, payload, createdEntities, userId);

      case 'create_record':
      case 'add_record':
      case 'seed_records':
        return this.execCreateRecord(op.id, target, payload, createdEntities, userId);

      default:
        return {
          operationId: op.id,
          operationType: opType,
          success: false,
          error: `Unknown operation type: ${opType}`,
        };
    }
  }

  // -----------------------------------------------------------------------
  // Operation handlers
  // -----------------------------------------------------------------------

  private async execCreateBase(
    opId: string,
    payload: Record<string, unknown>,
    workspaceId?: string,
    organizationId?: string,
    userId?: string
  ): Promise<MutationResult> {
    if (!organizationId || !workspaceId) {
      return {
        operationId: opId,
        operationType: 'create_base',
        success: false,
        error: 'organizationId and workspaceId required for create_base',
      };
    }
    const name = (payload.name as string) ?? 'Untitled base';
    const base = await metadataService.createBase(workspaceId, organizationId, name, userId);
    return {
      operationId: opId,
      operationType: 'create_base',
      success: true,
      result: base as Record<string, unknown>,
      rollbackAction: { type: 'deleteBase', params: { baseId: base?.id } },
    };
  }

  private async execCreateTable(
    opId: string,
    target: Record<string, string>,
    payload: Record<string, unknown>,
    defaultBaseId: string,
    createdEntities: Map<string, string>,
    userId?: string
  ): Promise<MutationResult> {
    const resolvedBaseId = target.base_id ?? target.baseId ?? defaultBaseId;
    const effectiveBaseId = createdEntities.get(resolvedBaseId) ?? resolvedBaseId;
    const name = (payload.name ?? payload.tableName) as string;
    const description = (payload.description as string) ?? undefined;
    const table = await metadataService.createTable(effectiveBaseId, name, description, userId);
    return {
      operationId: opId,
      operationType: 'create_table',
      success: true,
      result: table as Record<string, unknown>,
      rollbackAction: { type: 'deleteTable', params: { tableId: table?.id } },
    };
  }

  private async execCreateField(
    opId: string,
    target: Record<string, string>,
    payload: Record<string, unknown>,
    createdEntities: Map<string, string>,
    userId?: string
  ): Promise<MutationResult> {
    const rawTableId = target.table_id ?? target.tableId;
    const tableId = createdEntities.get(rawTableId) ?? rawTableId;
    if (!tableId) {
      return {
        operationId: opId,
        operationType: 'create_field',
        success: false,
        error: 'tableId not resolved (dependency not executed?)',
      };
    }
    const name = (payload.name ?? payload.fieldName) as string;
    let fieldType = (payload.fieldType ?? payload.type ?? 'singleLineText') as string;
    fieldType = normalizeFieldType(fieldType);
    const options = (payload.options ?? {}) as Record<string, unknown>;
    const field = await metadataService.createField(tableId, name, fieldType, options, userId);
    return {
      operationId: opId,
      operationType: 'create_field',
      success: true,
      result: field as Record<string, unknown>,
      rollbackAction: { type: 'deleteField', params: { fieldId: field?.id } },
    };
  }

  private async execUpdateField(
    opId: string,
    target: Record<string, string>,
    payload: Record<string, unknown>,
    createdEntities: Map<string, string>
  ): Promise<MutationResult> {
    const rawFieldId = target.field_id ?? target.fieldId;
    const fieldId = createdEntities.get(rawFieldId) ?? rawFieldId;
    if (!fieldId) {
      return {
        operationId: opId,
        operationType: 'modify_field',
        success: false,
        error: 'fieldId not resolved',
      };
    }

    const db = getDatabase();
    const before = (await db.query('SELECT * FROM tp_fields WHERE id = $1', [fieldId])).rows[0] as
      | Record<string, unknown>
      | undefined;
    if (!before) {
      return {
        operationId: opId,
        operationType: 'modify_field',
        success: false,
        error: `Field ${fieldId} not found`,
      };
    }

    const updates: { name?: string; options?: Record<string, unknown> } = {};
    if (payload.name) updates.name = payload.name as string;
    if (payload.options) updates.options = payload.options as Record<string, unknown>;
    await metadataService.updateField(fieldId, updates);

    return {
      operationId: opId,
      operationType: 'modify_field',
      success: true,
      result: { id: fieldId },
      rollbackAction: {
        type: 'updateField',
        params: {
          fieldId,
          name: before.name as string,
          options: before.options,
        },
      },
    };
  }

  private async execDeleteField(
    opId: string,
    target: Record<string, string>,
    createdEntities: Map<string, string>,
    userId?: string
  ): Promise<MutationResult> {
    const rawFieldId = target.field_id ?? target.fieldId;
    const fieldId = createdEntities.get(rawFieldId) ?? rawFieldId;
    if (!fieldId) {
      return {
        operationId: opId,
        operationType: 'remove_field',
        success: false,
        error: 'fieldId not resolved',
      };
    }

    const db = getDatabase();
    const before = (await db.query('SELECT * FROM tp_fields WHERE id = $1', [fieldId])).rows[0] as
      | Record<string, unknown>
      | undefined;
    if (!before) {
      return {
        operationId: opId,
        operationType: 'remove_field',
        success: false,
        error: `Field ${fieldId} not found`,
      };
    }

    await metadataService.deleteField(fieldId, userId);

    return {
      operationId: opId,
      operationType: 'remove_field',
      success: true,
      result: { id: fieldId },
      rollbackAction: {
        type: 'createField',
        params: {
          tableId: before.table_id,
          name: before.name,
          fieldType: before.field_type,
          options: before.options,
        },
      },
    };
  }

  private async execCreateView(
    opId: string,
    target: Record<string, string>,
    payload: Record<string, unknown>,
    createdEntities: Map<string, string>,
    userId?: string
  ): Promise<MutationResult> {
    const rawTableId = target.table_id ?? target.tableId;
    const tableId = createdEntities.get(rawTableId) ?? rawTableId;
    if (!tableId) {
      return {
        operationId: opId,
        operationType: 'create_view',
        success: false,
        error: 'tableId not resolved (dependency not executed?)',
      };
    }
    const name = (payload.name ?? payload.viewName ?? 'Grid view') as string;
    const viewType = (payload.viewType ?? payload.view_type ?? 'grid') as string;
    const config = (payload.config ?? {}) as Record<string, unknown>;
    const view = await metadataService.createView(tableId, name, viewType, config, userId);
    return {
      operationId: opId,
      operationType: 'create_view',
      success: true,
      result: view as Record<string, unknown>,
      rollbackAction: { type: 'deleteView', params: { viewId: view?.id } },
    };
  }

  private async execCreateRecord(
    opId: string,
    target: Record<string, string>,
    payload: Record<string, unknown>,
    createdEntities: Map<string, string>,
    userId?: string
  ): Promise<MutationResult> {
    const rawTableId = target.table_id ?? target.tableId;
    const tableId = createdEntities.get(rawTableId) ?? rawTableId;
    if (!tableId) {
      return {
        operationId: opId,
        operationType: 'create_record',
        success: false,
        error: 'tableId not resolved (dependency not executed?)',
      };
    }
    const data = (payload.data ?? payload) as Record<string, unknown>;
    const record = await recordsService.createRecord(tableId, data, userId);
    return {
      operationId: opId,
      operationType: 'create_record',
      success: true,
      result: record as Record<string, unknown>,
      rollbackAction: { type: 'deleteRecord', params: { recordId: record?.id } },
    };
  }

  // -----------------------------------------------------------------------
  // Rollback dispatch
  // -----------------------------------------------------------------------

  private async executeRollbackAction(action: RollbackAction): Promise<void> {
    switch (action.type) {
      case 'deleteBase':
        await metadataService.deleteBase(action.params.baseId as string);
        break;
      case 'deleteTable':
        await metadataService.deleteTable(action.params.tableId as string);
        break;
      case 'deleteField':
        await metadataService.deleteField(action.params.fieldId as string);
        break;
      case 'deleteView':
        await metadataService.deleteView(action.params.viewId as string);
        break;
      case 'deleteRecord':
        await recordsService.deleteRecord(action.params.recordId as string);
        break;
      case 'createField':
        await metadataService.createField(
          action.params.tableId as string,
          action.params.name as string,
          action.params.fieldType as string,
          action.params.options as Record<string, unknown> | undefined
        );
        break;
      case 'updateField':
        await metadataService.updateField(action.params.fieldId as string, {
          name: action.params.name as string | undefined,
          options: action.params.options as Record<string, unknown> | undefined,
        });
        break;
      default:
        logger.warn('[MutationExecutor] Unknown rollback action type', { type: action.type });
    }
  }
}

export default new MutationExecutor();
