/**
 * SchemaValidationService - Validates schema operations before execution
 */

import { getDatabase } from '../../database/Database.js';
import logger from '../../utils/Logger.js';
import { ValidationError } from './ErrorHandling.js';

const MAX_RECORD_DATA_BYTES = 1_048_576;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const ALLOWED_FIELD_TYPES = [
  'singleLineText',
  'longText',
  'number',
  'currency',
  'percent',
  'checkbox',
  'date',
  'singleSelect',
  'multiSelect',
  'url',
  'email',
  'phone',
  'attachment',
  'linkedRecord',
  'count',
  'lookup',
  'rollup',
  'createdTime',
  'createdBy',
  'lastModifiedTime',
  'lastModifiedBy',
  'autoNumber',
  'formula',
  'button',
  'rating',
  'duration',
  'barcode',
] as const;

export const RESERVED_FIELD_NAMES = [
  'id',
  'created_at',
  'updated_at',
  'table_id',
  'data',
  'created_by',
];

export const MAX_FIELD_NAME_LENGTH = 256;
export const MAX_FIELDS_PER_TABLE = 500;
export const MAX_TABLES_PER_BASE = 100;

const FIELD_NAME_REGEX = /^[a-zA-Z][a-zA-Z0-9_\s]*$/;

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

const schemaValidationService = {
  async validateFieldName(
    tableId: string,
    name: string,
    excludeFieldId?: string
  ): Promise<{ valid: boolean; error?: string }> {
    if (!name || typeof name !== 'string') {
      return { valid: false, error: 'Field name is required' };
    }
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      return { valid: false, error: 'Field name cannot be empty' };
    }
    if (trimmed.length > MAX_FIELD_NAME_LENGTH) {
      return { valid: false, error: `Field name must be at most ${MAX_FIELD_NAME_LENGTH} characters` };
    }
    if (RESERVED_FIELD_NAMES.includes(trimmed.toLowerCase())) {
      return { valid: false, error: `'${trimmed}' is a reserved field name` };
    }
    if (!FIELD_NAME_REGEX.test(trimmed)) {
      return { valid: false, error: 'Field name must start with a letter and contain only letters, numbers, underscores, and spaces' };
    }

    const db = getDatabase();
    try {
      const params: unknown[] = [tableId, trimmed];
      let sql = 'SELECT id FROM tp_fields WHERE table_id = $1 AND LOWER(TRIM(name)) = LOWER(TRIM($2))';
      if (excludeFieldId) {
        sql += ' AND id != $3';
        params.push(excludeFieldId);
      }
      const result = await (db as any).query(sql, params);
      if (result.rows?.length > 0) {
        return { valid: false, error: `A field with name '${trimmed}' already exists in this table` };
      }
      return { valid: true };
    } catch (e) {
      logger.error('[SchemaValidationService] validateFieldName failed', {
        tableId,
        name,
        error: (e as Error).message,
      });
      throw e;
    }
  },

  validateFieldType(fieldType: string): { valid: boolean; error?: string } {
    if (!fieldType || typeof fieldType !== 'string') {
      return { valid: false, error: 'Field type is required' };
    }
    const normalized = fieldType.trim();
    if (!ALLOWED_FIELD_TYPES.includes(normalized as any)) {
      return { valid: false, error: `Invalid field type '${fieldType}'. Allowed: ${ALLOWED_FIELD_TYPES.join(', ')}` };
    }
    return { valid: true };
  },

  validateFieldOptions(fieldType: string, options: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (options == null || typeof options !== 'object') {
      return { valid: true, errors: [] };
    }

    const normalizedType = String(fieldType || '').trim();

    if (['singleSelect', 'single_select'].includes(normalizedType)) {
      if (!Array.isArray(options.options)) {
        errors.push('singleSelect must have an options array');
      } else if (options.options.length === 0) {
        errors.push('singleSelect options array cannot be empty');
      }
    }

    if (['multiSelect', 'multi_select'].includes(normalizedType)) {
      if (!Array.isArray(options.options)) {
        errors.push('multiSelect must have an options array');
      } else if (options.options.length === 0) {
        errors.push('multiSelect options array cannot be empty');
      }
    }

    if (['linkedRecord', 'linked_record'].includes(normalizedType)) {
      if (!options.linkedTableId && !options.linked_table_id) {
        errors.push('linkedRecord must have linkedTableId');
      }
    }

    if (['lookup'].includes(normalizedType)) {
      if (!options.linkedFieldId && !options.linked_field_id) {
        errors.push('lookup must have linkedFieldId');
      }
      if (!options.lookupFieldId && !options.lookup_field_id) {
        errors.push('lookup must have lookupFieldId');
      }
    }

    if (['rollup'].includes(normalizedType)) {
      if (!options.linkedFieldId && !options.linked_field_id) {
        errors.push('rollup must have linkedFieldId');
      }
      if (!options.lookupFieldId && !options.lookup_field_id) {
        errors.push('rollup must have lookupFieldId');
      }
      const validAgg = ['sum', 'avg', 'min', 'max', 'count', 'counta', 'concat'];
      const agg = options.aggregation ?? options.agg;
      if (agg && !validAgg.includes(String(agg))) {
        errors.push(`rollup aggregation must be one of: ${validAgg.join(', ')}`);
      }
    }

    if (['count'].includes(normalizedType)) {
      if (!options.linkedFieldId && !options.linked_field_id) {
        errors.push(`${normalizedType} must have linkedFieldId`);
      }
    }

    if (normalizedType === 'formula') {
      if (!options.formula || typeof options.formula !== 'string') {
        errors.push('formula field must have a formula string in options');
      }
    }

    if (normalizedType === 'button') {
      if (options.label != null && typeof options.label !== 'string') {
        errors.push('button label must be a string');
      }
      const validActionTypes = ['open_url', 'run_automation'];
      if (options.actionType && !validActionTypes.includes(String(options.actionType))) {
        errors.push(`button actionType must be one of: ${validActionTypes.join(', ')}`);
      }
      if (options.actionType === 'open_url') {
        if (options.actionConfig?.url && typeof options.actionConfig.url !== 'string') {
          errors.push('button actionConfig.url must be a string');
        }
      }
      if (options.actionType === 'run_automation') {
        if (options.actionConfig?.automationId && typeof options.actionConfig.automationId !== 'string') {
          errors.push('button actionConfig.automationId must be a string');
        }
      }
    }

    if (normalizedType === 'rating') {
      if (options.max != null) {
        const max = Number(options.max);
        if (!Number.isInteger(max) || max < 1 || max > 10) {
          errors.push('rating max must be an integer between 1 and 10');
        }
      }
    }

    if (normalizedType === 'duration') {
      const validFormats = ['h:mm', 'h:mm:ss', 'h:mm:ss.S'];
      if (options.format != null && !validFormats.includes(String(options.format))) {
        errors.push(`duration format must be one of: ${validFormats.join(', ')}`);
      }
    }

    return { valid: errors.length === 0, errors };
  },

  async validateTableName(
    baseId: string,
    name: string,
    excludeTableId?: string
  ): Promise<{ valid: boolean; error?: string }> {
    if (!name || typeof name !== 'string') {
      return { valid: false, error: 'Table name is required' };
    }
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      return { valid: false, error: 'Table name cannot be empty' };
    }
    if (trimmed.length > MAX_FIELD_NAME_LENGTH) {
      return { valid: false, error: `Table name must be at most ${MAX_FIELD_NAME_LENGTH} characters` };
    }

    const db = getDatabase();
    try {
      const params: unknown[] = [baseId, trimmed];
      let sql = 'SELECT id FROM tp_tables WHERE base_id = $1 AND LOWER(TRIM(name)) = LOWER(TRIM($2))';
      if (excludeTableId) {
        sql += ' AND id != $3';
        params.push(excludeTableId);
      }
      const result = await (db as any).query(sql, params);
      if (result.rows?.length > 0) {
        return { valid: false, error: `A table with name '${trimmed}' already exists in this base` };
      }
      return { valid: true };
    } catch (e) {
      logger.error('[SchemaValidationService] validateTableName failed', {
        baseId,
        name,
        error: (e as Error).message,
      });
      throw e;
    }
  },

  async validateLinkedRecordTarget(targetTableId: string): Promise<{ valid: boolean; error?: string }> {
    if (!targetTableId || typeof targetTableId !== 'string') {
      return { valid: false, error: 'Target table ID is required' };
    }

    const db = getDatabase();
    try {
      const result = await (db as any).query('SELECT id FROM tp_tables WHERE id = $1', [targetTableId]);
      if (!result.rows?.length) {
        return { valid: false, error: `Target table '${targetTableId}' does not exist` };
      }
      return { valid: true };
    } catch (e) {
      logger.error('[SchemaValidationService] validateLinkedRecordTarget failed', {
        targetTableId,
        error: (e as Error).message,
      });
      throw e;
    }
  },

  async validateRecord(
    tableId: string,
    data: Record<string, unknown>
  ): Promise<{ valid: boolean; errors: Array<{ fieldId: string; message: string }> }> {
    const db = getDatabase();
    const fieldsResult = await (db as any).query(
      'SELECT * FROM tp_fields WHERE table_id = $1',
      [tableId]
    );
    const fields = fieldsResult.rows as Array<{
      id: string;
      name: string;
      field_type: string;
      options: Record<string, unknown>;
    }>;

    const fieldByName = new Map<string, typeof fields[number]>();
    const fieldById = new Map<string, typeof fields[number]>();
    for (const f of fields) {
      fieldByName.set(f.name, f);
      fieldById.set(f.id, f);
    }

    const AUTO_FIELD_TYPES = new Set([
      'createdTime', 'createdBy', 'lastModifiedTime', 'lastModifiedBy', 'autoNumber',
    ]);
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})?)?$/;

    const errors: Array<{ fieldId: string; message: string }> = [];

    for (const [key, value] of Object.entries(data)) {
      const field = fieldByName.get(key) ?? fieldById.get(key);
      if (!field) continue;

      if (AUTO_FIELD_TYPES.has(field.field_type)) {
        errors.push({ fieldId: field.id, message: `Cannot set auto field '${field.name}' (type: ${field.field_type})` });
        continue;
      }

      if (value === null || value === undefined) continue;

      switch (field.field_type) {
        case 'singleLineText':
        case 'single_line_text':
          if (typeof value !== 'string') {
            errors.push({ fieldId: field.id, message: `'${field.name}' must be a string` });
          } else if (value.length > 10000) {
            errors.push({ fieldId: field.id, message: `'${field.name}' exceeds max length of 10000` });
          }
          break;

        case 'longText':
        case 'long_text':
          if (typeof value !== 'string') {
            errors.push({ fieldId: field.id, message: `'${field.name}' must be a string` });
          } else if (value.length > 100000) {
            errors.push({ fieldId: field.id, message: `'${field.name}' exceeds max length of 100000` });
          }
          break;

        case 'number':
          if (typeof value !== 'number' || isNaN(value) || !isFinite(value)) {
            errors.push({ fieldId: field.id, message: `'${field.name}' must be a finite number` });
          }
          break;

        case 'currency':
          if (typeof value !== 'number' || isNaN(value) || !isFinite(value)) {
            errors.push({ fieldId: field.id, message: `'${field.name}' must be a finite number` });
          }
          break;

        case 'percent':
          if (typeof value !== 'number' || isNaN(value) || !isFinite(value)) {
            errors.push({ fieldId: field.id, message: `'${field.name}' must be a finite number` });
          }
          break;

        case 'checkbox':
          if (typeof value !== 'boolean') {
            errors.push({ fieldId: field.id, message: `'${field.name}' must be a boolean` });
          }
          break;

        case 'date':
          if (typeof value !== 'string' || (!ISO_DATE_REGEX.test(value) && isNaN(Date.parse(value)))) {
            errors.push({ fieldId: field.id, message: `'${field.name}' must be a valid ISO date string` });
          }
          break;

        case 'singleSelect':
        case 'single_select': {
          if (value !== null && value !== '') {
            const opts = field.options as { options?: Array<{ value: string }> };
            const allowed = opts?.options?.map((o) => o.value) ?? [];
            if (allowed.length > 0 && !allowed.includes(String(value))) {
              errors.push({ fieldId: field.id, message: `'${field.name}' value '${value}' is not in allowed options` });
            }
          }
          break;
        }

        case 'multiSelect':
        case 'multi_select': {
          if (!Array.isArray(value)) {
            errors.push({ fieldId: field.id, message: `'${field.name}' must be an array` });
          } else {
            const opts = field.options as { options?: Array<{ value: string }> };
            const allowed = opts?.options?.map((o) => o.value) ?? [];
            if (allowed.length > 0) {
              for (const v of value) {
                if (!allowed.includes(String(v))) {
                  errors.push({ fieldId: field.id, message: `'${field.name}' value '${v}' is not in allowed options` });
                }
              }
            }
          }
          break;
        }

        case 'url':
          if (typeof value !== 'string') {
            errors.push({ fieldId: field.id, message: `'${field.name}' must be a string` });
          } else {
            try {
              new URL(value);
            } catch {
              errors.push({ fieldId: field.id, message: `'${field.name}' must be a valid URL` });
            }
          }
          break;

        case 'email':
          if (typeof value !== 'string' || !EMAIL_REGEX.test(value)) {
            errors.push({ fieldId: field.id, message: `'${field.name}' must be a valid email address` });
          }
          break;

        case 'phone':
          if (typeof value !== 'string') {
            errors.push({ fieldId: field.id, message: `'${field.name}' must be a string` });
          } else if (value.length > 30) {
            errors.push({ fieldId: field.id, message: `'${field.name}' exceeds max length of 30` });
          }
          break;

        case 'linkedRecord':
        case 'linked_record':
          if (!Array.isArray(value)) {
            errors.push({ fieldId: field.id, message: `'${field.name}' must be an array of UUIDs` });
          } else {
            for (const v of value) {
              if (typeof v !== 'string' || !UUID_REGEX.test(v)) {
                errors.push({ fieldId: field.id, message: `'${field.name}' contains invalid UUID: ${v}` });
              }
            }
          }
          break;

        case 'attachment':
          if (!Array.isArray(value)) {
            errors.push({ fieldId: field.id, message: `'${field.name}' must be an array of UUIDs` });
          } else {
            for (const v of value) {
              if (typeof v !== 'string' || !UUID_REGEX.test(v)) {
                errors.push({ fieldId: field.id, message: `'${field.name}' contains invalid UUID: ${v}` });
              }
            }
          }
          break;

        case 'count':
        case 'lookup':
        case 'rollup':
        case 'formula':
          errors.push({ fieldId: field.id, message: `Cannot set computed field '${field.name}' (type: ${field.field_type})` });
          break;

        case 'button':
          break;

        case 'rating': {
          if (typeof value !== 'number' || !Number.isInteger(value)) {
            errors.push({ fieldId: field.id, message: `'${field.name}' must be an integer` });
          } else {
            const max = Number((field.options as { max?: number })?.max) || 5;
            if (value < 0 || value > max) {
              errors.push({ fieldId: field.id, message: `'${field.name}' must be between 0 and ${max}` });
            }
          }
          break;
        }

        case 'duration':
          if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
            errors.push({ fieldId: field.id, message: `'${field.name}' must be a non-negative number (seconds)` });
          }
          break;

        case 'barcode':
          if (typeof value !== 'string') {
            errors.push({ fieldId: field.id, message: `'${field.name}' must be a string` });
          }
          break;

        default:
          break;
      }
    }

    return { valid: errors.length === 0, errors };
  },

  validateRecordSize(data: Record<string, unknown>): void {
    const serialized = JSON.stringify(data);
    if (serialized.length > MAX_RECORD_DATA_BYTES) {
      throw new ValidationError('Record data exceeds 1MB limit', {
        sizeBytes: serialized.length,
        limitBytes: MAX_RECORD_DATA_BYTES,
      });
    }
  },

  async validateSchemaProposal(operations: any[]): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    if (!Array.isArray(operations)) {
      return { valid: false, errors: ['operations must be an array'] };
    }

    for (let i = 0; i < operations.length; i++) {
      const op = operations[i];
      const prefix = `Operation ${i + 1}`;
      if (!op || typeof op !== 'object') {
        errors.push(`${prefix}: invalid operation object`);
        continue;
      }

      const opType = op.operationType ?? op.op ?? op.type;
      const target = op.target ?? {};
      const payload = op.payload ?? op.data ?? {};

      if (opType === 'create_field' || opType === 'add_field') {
        const tableId = target.tableId ?? target.table_id;
        if (!tableId) errors.push(`${prefix}: missing tableId`);
        const name = payload.name ?? payload.fieldName;
        if (!name) errors.push(`${prefix}: missing field name`);
        if (name) {
          const nameResult = await this.validateFieldName(tableId, name);
          if (!nameResult.valid) errors.push(`${prefix}: ${nameResult.error}`);
        }
        const fieldType = payload.fieldType ?? payload.type ?? 'singleLineText';
        const typeResult = this.validateFieldType(fieldType);
        if (!typeResult.valid) errors.push(`${prefix}: ${typeResult.error}`);
        const optsResult = this.validateFieldOptions(fieldType, payload.options ?? payload);
        if (!optsResult.valid) errors.push(...optsResult.errors.map((e) => `${prefix}: ${e}`));
        if (fieldType === 'linkedRecord' || fieldType === 'linked_record') {
          const linkedId = payload.options?.linkedTableId ?? payload.options?.linked_table_id;
          if (linkedId && !/^op_\d+$/.test(String(linkedId))) {
            const targetResult = await this.validateLinkedRecordTarget(linkedId);
            if (!targetResult.valid) errors.push(`${prefix}: ${targetResult.error}`);
          }
          // op_N placeholders are resolved at execution time
        }
      }

      if (opType === 'create_table' || opType === 'add_table') {
        const baseId = target.baseId ?? target.base_id;
        if (!baseId) errors.push(`${prefix}: missing baseId`);
        const name = payload.name ?? payload.tableName;
        if (!name) errors.push(`${prefix}: missing table name`);
        if (name && baseId) {
          const nameResult = await this.validateTableName(baseId, name);
          if (!nameResult.valid) errors.push(`${prefix}: ${nameResult.error}`);
        }
      }
    }

    return { valid: errors.length === 0, errors };
  },
};

export default schemaValidationService;
