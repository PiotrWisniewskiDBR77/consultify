/**
 * Schema Mapping Engine — auto-mapping, type inference, value transformation, and validation.
 */

import type { ExternalSchema, FieldMapping } from './connectorFramework.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TargetField {
  id: string;
  name: string;
  field_type: string;
  options?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// autoMap
// ---------------------------------------------------------------------------

function normalize(s: string): string {
  return s.toLowerCase().replace(/[\s_-]+/g, '');
}

export function autoMap(
  externalSchema: ExternalSchema,
  targetFields: TargetField[]
): FieldMapping[] {
  const mappings: FieldMapping[] = [];
  if (!externalSchema.tables.length) return mappings;

  const sourceFields = externalSchema.tables[0].fields;
  const targetByNorm = new Map<string, TargetField>();
  for (const tf of targetFields) {
    targetByNorm.set(normalize(tf.name), tf);
  }

  for (const sf of sourceFields) {
    const normSource = normalize(sf.name);
    const match = targetByNorm.get(normSource);
    if (match) {
      mappings.push({
        sourceField: sf.name,
        targetFieldId: match.id,
      });
    }
  }

  return mappings;
}

// ---------------------------------------------------------------------------
// inferFieldType
// ---------------------------------------------------------------------------

const EXTERNAL_TYPE_MAP: Record<string, string> = {
  string: 'singleLineText',
  text: 'longText',
  varchar: 'singleLineText',
  char: 'singleLineText',
  int: 'number',
  integer: 'number',
  bigint: 'number',
  smallint: 'number',
  float: 'number',
  double: 'number',
  decimal: 'number',
  numeric: 'number',
  real: 'number',
  boolean: 'checkbox',
  bool: 'checkbox',
  date: 'date',
  datetime: 'date',
  timestamp: 'date',
  timestamptz: 'date',
  time: 'singleLineText',
  json: 'longText',
  jsonb: 'longText',
  uuid: 'singleLineText',
  url: 'url',
  email: 'email',
  phone: 'phone',
  currency: 'currency',
  percent: 'percent',
  attachment: 'attachment',
  multipleAttachments: 'attachment',
  singleSelect: 'singleSelect',
  multiSelect: 'multiSelect',
  multipleSelect: 'multiSelect',
  checkbox: 'checkbox',
  number: 'number',
  autoNumber: 'autoNumber',
  richText: 'longText',
  multilineText: 'longText',
  singleLineText: 'singleLineText',
  longText: 'longText',
};

const URL_RE = /^https?:\/\/[^\s]+$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}/;
const BOOL_VALS = new Set(['true', 'false', '1', '0', 'yes', 'no', 'y', 'n', 't', 'f']);

export function inferFieldType(externalType: string, sampleValues: unknown[]): string {
  const mapped = EXTERNAL_TYPE_MAP[externalType.toLowerCase()];
  if (mapped) return mapped;

  const stringVals = sampleValues.filter((v) => v != null && v !== '').map((v) => String(v).trim());

  if (stringVals.length === 0) return 'singleLineText';

  if (stringVals.every((v) => !isNaN(Number(v.replace(/,/g, ''))))) {
    return 'number';
  }
  if (stringVals.every((v) => BOOL_VALS.has(v.toLowerCase()))) {
    return 'checkbox';
  }
  if (stringVals.every((v) => ISO_DATE_RE.test(v))) {
    return 'date';
  }
  if (stringVals.every((v) => URL_RE.test(v))) {
    return 'url';
  }
  if (stringVals.every((v) => EMAIL_RE.test(v))) {
    return 'email';
  }

  const avgLen = stringVals.reduce((sum, v) => sum + v.length, 0) / stringVals.length;
  if (avgLen > 200) return 'longText';

  return 'singleLineText';
}

// ---------------------------------------------------------------------------
// transformValue
// ---------------------------------------------------------------------------

export function transformValue(value: unknown, _sourceType: string, targetType: string): unknown {
  if (value === null || value === undefined) return null;

  const str = String(value).trim();
  if (str === '') return null;

  switch (targetType) {
    case 'number':
    case 'currency':
    case 'percent': {
      const cleaned = str.replace(/[^0-9.\-eE]/g, '');
      const n = parseFloat(cleaned);
      return isNaN(n) ? str : n;
    }
    case 'checkbox': {
      const lower = str.toLowerCase();
      return ['true', '1', 'yes', 'y', 't'].includes(lower);
    }
    case 'date': {
      if (ISO_DATE_RE.test(str)) return str;
      const parsed = new Date(str);
      return isNaN(parsed.getTime()) ? str : parsed.toISOString();
    }
    case 'singleLineText':
    case 'longText':
    case 'url':
    case 'email':
    case 'phone':
    case 'singleSelect':
    case 'multiSelect':
      return str;
    default:
      return value;
  }
}

// ---------------------------------------------------------------------------
// validateMapping
// ---------------------------------------------------------------------------

export function validateMapping(
  mapping: FieldMapping[],
  targetFields: TargetField[]
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const targetIds = new Set(targetFields.map((f) => f.id));
  const seenTargets = new Set<string>();

  for (const m of mapping) {
    if (!m.sourceField) {
      errors.push('Mapping entry missing sourceField');
    }
    if (!m.targetFieldId) {
      errors.push(`Mapping for '${m.sourceField}' missing targetFieldId`);
      continue;
    }
    if (!targetIds.has(m.targetFieldId)) {
      errors.push(`Target field '${m.targetFieldId}' does not exist in table`);
    }
    if (seenTargets.has(m.targetFieldId)) {
      errors.push(`Duplicate mapping to target field '${m.targetFieldId}'`);
    }
    seenTargets.add(m.targetFieldId);
  }

  return { valid: errors.length === 0, errors };
}

const schemaMappingEngine = {
  autoMap,
  inferFieldType,
  transformValue,
  validateMapping,
};

export default schemaMappingEngine;
