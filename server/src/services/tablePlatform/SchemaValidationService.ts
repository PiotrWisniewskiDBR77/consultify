/**
 * SchemaValidationService - Validates schema operations before execution
 */

import { getDatabase } from '../../database/Database.js';
import logger from '../../utils/Logger.js';
import { ValidationError } from './ErrorHandling.js';
import {
  checkSpecializedFieldValue,
  isSpecializedFieldType,
  SPECIALIZED_FIELD_TYPES,
  type SpecializedFieldType,
  validateSpecializedField,
} from './SpecializedFieldTypes.js';

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
  'datetime',
  'user',
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
  // EPIC-T7 specialised types (Block A · Sprint 3). Validators live in
  // `SpecializedFieldTypes.ts`; AI-derived fields (ai_generated_summary,
  // ai_classification) are listed in `AI_REGEN_FIELD_TYPES` rather than
  // `AUTO_FIELD_TYPES` so manual writes are allowed (audited as
  // `manual_override = true` by Block C).
  ...SPECIALIZED_FIELD_TYPES,
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
// CURRENCY field type — options + value helpers
// ---------------------------------------------------------------------------

/**
 * Reasonable ISO-4217 currency code allow-list. Not exhaustive (ISO-4217 has
 * ~180 active codes); covers the currencies already referenced elsewhere in
 * the repo (`currencyService.ts` DEFAULT_CURRENCIES, `AddColumnDialog.tsx`
 * dropdown) plus the other majors/regional currencies a consulting-focused
 * product is likely to need. Extend here if a legitimate code is missing —
 * do not loosen the shape check (3 uppercase letters) below.
 */
export const SUPPORTED_CURRENCY_CODES = [
  'USD', 'EUR', 'GBP', 'PLN', 'CHF', 'JPY', 'CAD', 'AUD', 'NZD',
  'CNY', 'HKD', 'SGD', 'INR', 'BRL', 'MXN', 'ZAR', 'SEK', 'NOK', 'DKK',
  'CZK', 'HUF', 'RON', 'TRY', 'RUB', 'UAH', 'AED', 'SAR', 'ILS', 'KRW',
] as const;

export const DEFAULT_CURRENCY_CODE = 'USD';
export const DEFAULT_CURRENCY_PRECISION = 2;
export const MIN_CURRENCY_PRECISION = 0;
export const MAX_CURRENCY_PRECISION = 4;

const CURRENCY_CODE_SHAPE_REGEX = /^[A-Z]{3}$/;

/**
 * Validates the `currencyCode` / `precision` options of a `currency` field.
 * Absent options are always valid (backward compatible with pre-existing
 * currency fields that behaved like a plain `number`).
 */
export function validateCurrencyOptions(options: Record<string, unknown>): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (options.currencyCode != null) {
    const code = String(options.currencyCode).trim();
    if (!CURRENCY_CODE_SHAPE_REGEX.test(code)) {
      errors.push(
        `currency.currencyCode must be a 3-letter ISO-4217 code (got: '${options.currencyCode}')`
      );
    } else if (!(SUPPORTED_CURRENCY_CODES as readonly string[]).includes(code)) {
      errors.push(
        `currency.currencyCode '${code}' is not a supported currency code (supported: ${SUPPORTED_CURRENCY_CODES.join(', ')})`
      );
    }
  }

  if (options.precision != null) {
    const precision = Number(options.precision);
    if (
      !Number.isInteger(precision) ||
      precision < MIN_CURRENCY_PRECISION ||
      precision > MAX_CURRENCY_PRECISION
    ) {
      errors.push(
        `currency.precision must be an integer between ${MIN_CURRENCY_PRECISION} and ${MAX_CURRENCY_PRECISION} (got: ${String(
          options.precision
        )})`
      );
    }
  }

  return { valid: errors.length === 0, errors };
}

function resolveCurrencyPrecision(options: unknown): number {
  const opts = (options ?? {}) as Record<string, unknown>;
  const raw = opts.precision;
  const precision = Number(raw);
  if (
    raw != null &&
    Number.isInteger(precision) &&
    precision >= MIN_CURRENCY_PRECISION &&
    precision <= MAX_CURRENCY_PRECISION
  ) {
    return precision;
  }
  return DEFAULT_CURRENCY_PRECISION;
}

/**
 * Rounds a currency value to the field's configured precision (default 2).
 * Does not validate the value's type — call `checkCurrencyValue` first.
 */
export function normalizeCurrencyValue(value: number, options: unknown): number {
  const precision = resolveCurrencyPrecision(options);
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

/**
 * Validates a `currency` cell value. Behaves like `number` (finite,
 * non-NaN) — currency is still fundamentally a number — but additionally
 * exposes the precision-normalised value so callers can persist a
 * consistently-rounded amount.
 */
export function checkCurrencyValue(
  value: unknown,
  options: unknown
): { ok: boolean; message?: string; normalized?: number } {
  if (typeof value !== 'number' || Number.isNaN(value) || !Number.isFinite(value)) {
    return { ok: false, message: 'must be a finite number' };
  }
  return { ok: true, normalized: normalizeCurrencyValue(value, options) };
}

// ---------------------------------------------------------------------------
// DURATION field type — options + value helpers
// ---------------------------------------------------------------------------

/**
 * Supported duration display formats. `format` is the legacy option key
 * (still honoured for existing fields / templates, e.g. `TemplateService`
 * seeds); `durationFormat` is the new, explicit key going forward. Both are
 * validated the same way. `h:mm:ss.S` is kept for backward compatibility
 * with the pre-existing FE contract (`src/types/tablePlatform.ts`
 * `DurationFieldOptions.format`); `d h:mm` is the new Airtable-parity format.
 */
export const DURATION_FORMATS = ['h:mm', 'h:mm:ss', 'h:mm:ss.S', 'd h:mm'] as const;
export type DurationFormat = (typeof DURATION_FORMATS)[number];

export function validateDurationOptions(options: Record<string, unknown>): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const format = options.durationFormat ?? options.format;
  if (format != null && !(DURATION_FORMATS as readonly string[]).includes(String(format))) {
    errors.push(`duration.durationFormat must be one of: ${DURATION_FORMATS.join(', ')}`);
  }
  return { valid: errors.length === 0, errors };
}

const DURATION_STRING_REGEX = /^(?:(\d+)d\s*)?(\d{1,2}):(\d{2})(?::(\d{2}(?:\.\d+)?))?$/;

/**
 * Normalises a duration value to seconds.
 *  - A finite, non-negative `number` is returned unchanged (already seconds).
 *  - A `string` matching `[Nd] h:mm[:ss]` is parsed and converted to seconds.
 *  - Anything else (garbage strings, negative numbers, NaN, etc.) → `null`.
 */
export function normalizeDurationValue(value: unknown): number | null {
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0) return null;
    return value;
  }
  if (typeof value !== 'string') return null;

  const trimmed = value.trim();
  if (trimmed.length === 0) return null;

  const match = DURATION_STRING_REGEX.exec(trimmed);
  if (!match) return null;

  const days = match[1] != null ? parseInt(match[1], 10) : 0;
  const hours = parseInt(match[2], 10);
  const minutes = parseInt(match[3], 10);
  const seconds = match[4] != null ? parseFloat(match[4]) : 0;

  if (minutes > 59) return null;
  if (seconds >= 60) return null;

  const total = days * 86400 + hours * 3600 + minutes * 60 + seconds;
  return Number.isFinite(total) ? total : null;
}

/**
 * Validates a `duration` cell value, accepting either a raw seconds number
 * or a formatted duration string, normalising to seconds either way.
 */
export function checkDurationValue(value: unknown): {
  ok: boolean;
  message?: string;
  normalized?: number;
} {
  const normalized = normalizeDurationValue(value);
  if (normalized === null) {
    return {
      ok: false,
      message: 'must be a non-negative number of seconds, or a valid duration string (e.g. "1:30")',
    };
  }
  return { ok: true, normalized };
}

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
      return {
        valid: false,
        error: `Field name must be at most ${MAX_FIELD_NAME_LENGTH} characters`,
      };
    }
    if (RESERVED_FIELD_NAMES.includes(trimmed.toLowerCase())) {
      return { valid: false, error: `'${trimmed}' is a reserved field name` };
    }
    if (!FIELD_NAME_REGEX.test(trimmed)) {
      return {
        valid: false,
        error:
          'Field name must start with a letter and contain only letters, numbers, underscores, and spaces',
      };
    }

    const db = getDatabase();
    try {
      const params: unknown[] = [tableId, trimmed];
      let sql =
        'SELECT id FROM tp_fields WHERE table_id = $1 AND LOWER(TRIM(name)) = LOWER(TRIM($2))';
      if (excludeFieldId) {
        sql += ' AND id != $3';
        params.push(excludeFieldId);
      }
      const result = await (db as any).query(sql, params);
      if (result.rows?.length > 0) {
        return {
          valid: false,
          error: `A field with name '${trimmed}' already exists in this table`,
        };
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
      return {
        valid: false,
        error: `Invalid field type '${fieldType}'. Allowed: ${ALLOWED_FIELD_TYPES.join(', ')}`,
      };
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
        if (
          options.actionConfig?.automationId &&
          typeof options.actionConfig.automationId !== 'string'
        ) {
          errors.push('button actionConfig.automationId must be a string');
        }
      }
    }

    if (normalizedType === 'barcode') {
      if (options.symbology != null && typeof options.symbology !== 'string') {
        errors.push('barcode symbology must be a string');
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

    if (normalizedType === 'currency') {
      const currencyResult = validateCurrencyOptions(options);
      if (!currencyResult.valid) errors.push(...currencyResult.errors);
    }

    if (normalizedType === 'duration') {
      const durationResult = validateDurationOptions(options);
      if (!durationResult.valid) errors.push(...durationResult.errors);
    }

    // EPIC-T7 specialised types — dispatch to dedicated validators.
    if (isSpecializedFieldType(normalizedType)) {
      const specialisedResult = validateSpecializedField(normalizedType, options);
      if (!specialisedResult.valid) {
        errors.push(...specialisedResult.errors);
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
      return {
        valid: false,
        error: `Table name must be at most ${MAX_FIELD_NAME_LENGTH} characters`,
      };
    }

    const db = getDatabase();
    try {
      const params: unknown[] = [baseId, trimmed];
      let sql =
        'SELECT id FROM tp_tables WHERE base_id = $1 AND LOWER(TRIM(name)) = LOWER(TRIM($2))';
      if (excludeTableId) {
        sql += ' AND id != $3';
        params.push(excludeTableId);
      }
      const result = await (db as any).query(sql, params);
      if (result.rows?.length > 0) {
        return {
          valid: false,
          error: `A table with name '${trimmed}' already exists in this base`,
        };
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

  async validateLinkedRecordTarget(
    targetTableId: string
  ): Promise<{ valid: boolean; error?: string }> {
    if (!targetTableId || typeof targetTableId !== 'string') {
      return { valid: false, error: 'Target table ID is required' };
    }

    const db = getDatabase();
    try {
      const result = await (db as any).query('SELECT id FROM tp_tables WHERE id = $1', [
        targetTableId,
      ]);
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
    data: Record<string, unknown>,
    options?: { recordId?: string; isUpdate?: boolean }
  ): Promise<{ valid: boolean; errors: Array<{ fieldId: string; message: string }> }> {
    const db = getDatabase();
    const fieldsResult = await (db as any).query('SELECT * FROM tp_fields WHERE table_id = $1', [
      tableId,
    ]);
    const fields = fieldsResult.rows as Array<{
      id: string;
      name: string;
      field_type: string;
      options: Record<string, unknown>;
    }>;

    const fieldByName = new Map<string, (typeof fields)[number]>();
    const fieldById = new Map<string, (typeof fields)[number]>();
    for (const f of fields) {
      fieldByName.set(f.name, f);
      fieldById.set(f.id, f);
    }

    const AUTO_FIELD_TYPES = new Set([
      'createdTime',
      'createdBy',
      'lastModifiedTime',
      'lastModifiedBy',
      'autoNumber',
    ]);
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})?)?$/;

    const errors: Array<{ fieldId: string; message: string }> = [];

    // Enforce required constraints (skip on update — only check fields present in data)
    if (!options?.isUpdate) {
      for (const field of fields) {
        if (AUTO_FIELD_TYPES.has(field.field_type)) continue;
        const opts = field.options as Record<string, unknown> | null;
        if (opts?.required) {
          const val = data[field.id] ?? data[field.name];
          if (val === undefined || val === null || val === '') {
            if (opts.default === undefined) {
              errors.push({
                fieldId: field.id,
                message: `Required field '${field.name}' is missing`,
              });
            }
          }
        }
      }
    }

    // Enforce unique constraints
    for (const field of fields) {
      const opts = field.options as Record<string, unknown> | null;
      if (!opts?.unique) continue;
      const val = data[field.id] ?? data[field.name];
      if (val === undefined || val === null || val === '') continue;
      try {
        const excludeClause = options?.recordId ? ' AND id != $4' : '';
        const params: unknown[] = [tableId, field.id, String(val)];
        if (options?.recordId) params.push(options.recordId);
        const uniqueCheck = await (db as any).query(
          `SELECT COUNT(*)::int AS cnt FROM tp_records
           WHERE table_id = $1 AND data->>$2 = $3${excludeClause}`,
          params
        );
        if (uniqueCheck.rows[0]?.cnt > 0) {
          errors.push({
            fieldId: field.id,
            message: `Field '${field.name}' must be unique; value '${val}' already exists`,
          });
        }
      } catch (uniqueErr) {
        logger.error('[SchemaValidationService] unique check failed', {
          fieldId: field.id,
          error: (uniqueErr as Error).message,
        });
      }
    }

    for (const [key, value] of Object.entries(data)) {
      const field = fieldByName.get(key) ?? fieldById.get(key);
      if (!field) continue;

      if (AUTO_FIELD_TYPES.has(field.field_type)) {
        errors.push({
          fieldId: field.id,
          message: `Cannot set auto field '${field.name}' (type: ${field.field_type})`,
        });
        continue;
      }

      if (value === null || value === undefined) continue;

      switch (field.field_type) {
        case 'singleLineText':
        case 'single_line_text':
          if (typeof value !== 'string') {
            errors.push({ fieldId: field.id, message: `'${field.name}' must be a string` });
          } else if (value.length > 10000) {
            errors.push({
              fieldId: field.id,
              message: `'${field.name}' exceeds max length of 10000`,
            });
          }
          break;

        case 'longText':
        case 'long_text':
          if (typeof value !== 'string') {
            errors.push({ fieldId: field.id, message: `'${field.name}' must be a string` });
          } else if (value.length > 100000) {
            errors.push({
              fieldId: field.id,
              message: `'${field.name}' exceeds max length of 100000`,
            });
          }
          break;

        case 'number':
          if (typeof value !== 'number' || isNaN(value) || !isFinite(value)) {
            errors.push({ fieldId: field.id, message: `'${field.name}' must be a finite number` });
          }
          break;

        case 'currency': {
          const currencyCheck = checkCurrencyValue(value, field.options);
          if (!currencyCheck.ok) {
            errors.push({
              fieldId: field.id,
              message: `'${field.name}' ${currencyCheck.message ?? 'must be a finite number'}`,
            });
          }
          break;
        }

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
          if (
            typeof value !== 'string' ||
            (!ISO_DATE_REGEX.test(value) && isNaN(Date.parse(value)))
          ) {
            errors.push({
              fieldId: field.id,
              message: `'${field.name}' must be a valid ISO date string`,
            });
          }
          break;

        case 'user':
          if (typeof value !== 'string' || !UUID_REGEX.test(value)) {
            errors.push({
              fieldId: field.id,
              message: `'${field.name}' must be a valid UUID`,
            });
          }
          break;

        case 'datetime': {
          const d = new Date(value as string | number | Date);
          if (isNaN(d.getTime())) {
            errors.push({
              fieldId: field.id,
              message: `'${field.name}' has an invalid datetime value`,
            });
          }
          break;
        }

        case 'singleSelect':
        case 'single_select': {
          if (value !== null && value !== '') {
            const opts = field.options as { options?: Array<{ value: string }> };
            const allowed = opts?.options?.map((o) => o.value) ?? [];
            if (allowed.length > 0 && !allowed.includes(String(value))) {
              errors.push({
                fieldId: field.id,
                message: `'${field.name}' value '${value}' is not in allowed options`,
              });
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
                  errors.push({
                    fieldId: field.id,
                    message: `'${field.name}' value '${v}' is not in allowed options`,
                  });
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
            errors.push({
              fieldId: field.id,
              message: `'${field.name}' must be a valid email address`,
            });
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
            errors.push({
              fieldId: field.id,
              message: `'${field.name}' must be an array of UUIDs`,
            });
          } else {
            for (const v of value) {
              if (typeof v !== 'string' || !UUID_REGEX.test(v)) {
                errors.push({
                  fieldId: field.id,
                  message: `'${field.name}' contains invalid UUID: ${v}`,
                });
              }
            }
          }
          break;

        case 'attachment':
          if (!Array.isArray(value)) {
            errors.push({
              fieldId: field.id,
              message: `'${field.name}' must be an array of UUIDs`,
            });
          } else {
            for (const v of value) {
              if (typeof v !== 'string' || !UUID_REGEX.test(v)) {
                errors.push({
                  fieldId: field.id,
                  message: `'${field.name}' contains invalid UUID: ${v}`,
                });
              }
            }
          }
          break;

        case 'count':
        case 'lookup':
        case 'rollup':
        case 'formula':
          errors.push({
            fieldId: field.id,
            message: `Cannot set computed field '${field.name}' (type: ${field.field_type})`,
          });
          break;

        case 'button':
          break;

        case 'rating': {
          if (typeof value !== 'number' || !Number.isInteger(value)) {
            errors.push({ fieldId: field.id, message: `'${field.name}' must be an integer` });
          } else {
            const max = Number((field.options as { max?: number })?.max) || 5;
            if (value < 0 || value > max) {
              errors.push({
                fieldId: field.id,
                message: `'${field.name}' must be between 0 and ${max}`,
              });
            }
          }
          break;
        }

        case 'duration': {
          const durationCheck = checkDurationValue(value);
          if (!durationCheck.ok) {
            errors.push({
              fieldId: field.id,
              message: `'${field.name}' ${durationCheck.message ?? 'must be a non-negative number (seconds)'}`,
            });
          }
          break;
        }

        case 'barcode':
          if (typeof value !== 'string' || value.trim().length === 0) {
            errors.push({
              fieldId: field.id,
              message: `'${field.name}' must be a non-empty string`,
            });
          } else {
            const symbology = (field.options as { symbology?: unknown } | null)?.symbology;
            if (symbology != null && typeof symbology !== 'string') {
              errors.push({
                fieldId: field.id,
                message: `'${field.name}' has an invalid symbology configuration`,
              });
            }
          }
          break;

        case 'risk_score':
        case 'priority':
        case 'ai_generated_summary':
        case 'ai_classification':
        case 'source_reference': {
          const check = checkSpecializedFieldValue(
            field.field_type as SpecializedFieldType,
            value,
            field.options
          );
          if (!check.ok) {
            errors.push({
              fieldId: field.id,
              message: `'${field.name}' ${check.message ?? 'has an invalid value'}`,
            });
          }
          break;
        }

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

  // CURRENCY / DURATION helpers exposed on the service surface so callers
  // (e.g. RecordsService, cell renderers) can normalise values without
  // re-implementing the parsing logic.
  normalizeCurrencyValue,
  checkCurrencyValue,
  normalizeDurationValue,
  checkDurationValue,
};

export default schemaValidationService;
