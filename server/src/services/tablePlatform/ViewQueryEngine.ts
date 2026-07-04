/**
 * ViewQueryEngine - Server-side query builder for Table Platform
 * Translates view configurations into parameterized SQL.
 */

import { getDatabase } from '../../database/Database.js';
import logger from '../../utils/Logger.js';
import { type FormulaAST, parseFormula } from './formulaEngine.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface QueryOptions {
  tableId: string;
  viewId?: string;
  filters?: FilterGroup;
  filterByFormula?: string;
  sorts?: SortRule[];
  groupBy?: string;
  groupAggregates?: GroupAggregate[];
  fields?: string[];
  pageSize?: number;
  cursor?: string;
  page?: number;
  search?: string;
  searchFieldIds?: string[];
  userRole?: string;
}

export interface GroupAggregate {
  fieldId: string;
  functions: Array<'count' | 'sum' | 'avg' | 'min' | 'max'>;
}

/**
 * A filter tree node: either a leaf rule (fieldId/operator/value) or a nested
 * group with its own AND/OR logic. Groups may nest arbitrarily (bounded by
 * MAX_FILTER_GROUP_DEPTH) to express Airtable-style "AND of (OR of AND...)"
 * combinations.
 */
export interface FilterGroup {
  logic: 'and' | 'or';
  rules: Array<FilterRule | FilterGroup>;
}

export interface FilterRule {
  fieldId: string;
  operator: string;
  value?: unknown;
}

/** Narrow a filter-tree node to a nested FilterGroup (vs. a leaf FilterRule). */
function isFilterGroup(node: FilterRule | FilterGroup): node is FilterGroup {
  return (
    !!node &&
    typeof node === 'object' &&
    'logic' in node &&
    'rules' in node &&
    Array.isArray((node as FilterGroup).rules)
  );
}

export interface SortRule {
  fieldId: string;
  direction: 'asc' | 'desc';
  nulls?: 'first' | 'last';
}

export interface QueryResult {
  records: any[];
  total: number;
  cursor?: string;
  hasMore: boolean;
  page?: number;
  pageSize?: number;
  groups?: GroupResult[];
}

export interface GroupResult {
  value: string | null;
  count: number;
  records: any[];
  aggregates?: Record<string, Record<string, number | null>>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;
const CURSOR_DELIM = '|';
const QUERY_TIMEOUT_MS = 30000;

/**
 * Maximum nesting depth for FilterGroup trees (a top-level group is depth 1).
 * Guards against pathological/abusive payloads recursing unbounded SQL.
 */
const MAX_FILTER_GROUP_DEPTH = 5;

const TEXT_FIELD_TYPES = new Set([
  'singleLineText',
  'longText',
  'url',
  'email',
  'phone',
  'single_line_text',
  'long_text',
]);

const NUMBER_FIELD_TYPES = new Set(['number', 'currency', 'percent']);

const SELECT_FIELD_TYPES = new Set(['singleSelect', 'single_select']);
const MULTI_SELECT_TYPES = new Set(['multiSelect', 'multi_select']);
const DATE_FIELD_TYPES = new Set([
  'date',
  'createdTime',
  'lastModifiedTime',
  'created_time',
  'last_modified_time',
]);
const CHECKBOX_TYPE = 'checkbox';
const LINKED_RECORD_TYPES = new Set(['linkedRecord', 'linked_record']);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Sanitize field key for JSONB - allow alphanumeric, underscore, hyphen (UUID) */
function sanitizeFieldKey(key: string): string {
  return key.replace(/[^a-zA-Z0-9_-]/g, '');
}

/** Validate field key format (non-empty after sanitization) */
function isValidFieldKey(key: string): boolean {
  const sanitized = sanitizeFieldKey(key);
  return sanitized.length > 0 && sanitized === key;
}

const VALID_INTERVAL_UNITS = new Set(['days', 'weeks', 'months', 'years', 'hours', 'minutes']);

/**
 * Parse "isWithin" value like "7_days", "30_days", "3_months" into a safe
 * Postgres INTERVAL literal. Returns null if the format is invalid.
 */
function parseIsWithinInterval(value: string): string | null {
  const match = /^(\d{1,6})_(days|weeks|months|years|hours|minutes)$/i.exec(value);
  if (!match) return null;
  const n = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  if (!VALID_INTERVAL_UNITS.has(unit) || n <= 0) return null;
  return `${n} ${unit}`;
}

// ---------------------------------------------------------------------------
// Filter SQL Builder
// ---------------------------------------------------------------------------

function buildSingleFilterClause(
  rule: FilterRule,
  params: unknown[],
  startIdx: number,
  fieldType: string
): { sql: string; nextIdx: number } {
  const op = (rule.operator || '').toLowerCase();
  const key = sanitizeFieldKey(rule.fieldId);
  if (!key) {
    return { sql: 'TRUE', nextIdx: startIdx };
  }

  const dataKey = `r.data->>$${startIdx}`;
  const dataJson = `r.data->$${startIdx}`;
  params.push(rule.fieldId);
  const nextIdx = startIdx + 1;

  // Text types
  if (TEXT_FIELD_TYPES.has(fieldType)) {
    switch (op) {
      case 'contains':
        params.push(`%${String(rule.value ?? '')}%`);
        return { sql: `${dataKey} ILIKE $${nextIdx}`, nextIdx: nextIdx + 1 };
      case 'doesnotcontain':
      case 'does_not_contain':
        params.push(`%${String(rule.value ?? '')}%`);
        return {
          sql: `(${dataKey} IS NULL OR ${dataKey} NOT ILIKE $${nextIdx})`,
          nextIdx: nextIdx + 1,
        };
      case 'equals':
        params.push(rule.value);
        return { sql: `${dataKey} = $${nextIdx}`, nextIdx: nextIdx + 1 };
      case 'notequals':
      case 'not_equals':
        params.push(rule.value);
        return { sql: `(${dataKey} IS NULL OR ${dataKey} != $${nextIdx})`, nextIdx: nextIdx + 1 };
      case 'isempty':
      case 'is_empty':
        return { sql: `(${dataKey} IS NULL OR ${dataKey} = '')`, nextIdx };
      case 'isnotempty':
      case 'is_not_empty':
        return { sql: `${dataKey} IS NOT NULL AND ${dataKey} != ''`, nextIdx };
      case 'startswith':
      case 'starts_with':
        params.push(`${String(rule.value ?? '')}%`);
        return { sql: `${dataKey} ILIKE $${nextIdx}`, nextIdx: nextIdx + 1 };
      case 'endswith':
      case 'ends_with':
        params.push(`%${String(rule.value ?? '')}`);
        return { sql: `${dataKey} ILIKE $${nextIdx}`, nextIdx: nextIdx + 1 };
      default:
        return { sql: 'TRUE', nextIdx };
    }
  }

  // Number types
  if (NUMBER_FIELD_TYPES.has(fieldType)) {
    const castExpr = `(${dataKey})::numeric`;
    switch (op) {
      case 'equals':
        params.push(rule.value);
        return { sql: `${castExpr} = $${nextIdx}`, nextIdx: nextIdx + 1 };
      case 'notequals':
      case 'not_equals':
        params.push(rule.value);
        return { sql: `(${castExpr} IS NULL OR ${castExpr} != $${nextIdx})`, nextIdx: nextIdx + 1 };
      case 'gt':
        params.push(rule.value);
        return { sql: `${castExpr} > $${nextIdx}`, nextIdx: nextIdx + 1 };
      case 'gte':
        params.push(rule.value);
        return { sql: `${castExpr} >= $${nextIdx}`, nextIdx: nextIdx + 1 };
      case 'lt':
        params.push(rule.value);
        return { sql: `${castExpr} < $${nextIdx}`, nextIdx: nextIdx + 1 };
      case 'lte':
        params.push(rule.value);
        return { sql: `${castExpr} <= $${nextIdx}`, nextIdx: nextIdx + 1 };
      case 'isempty':
      case 'is_empty':
        return { sql: `(${dataKey} IS NULL OR ${dataKey} = '')`, nextIdx };
      case 'isnotempty':
      case 'is_not_empty':
        return { sql: `${dataKey} IS NOT NULL AND ${dataKey} != ''`, nextIdx };
      default:
        return { sql: 'TRUE', nextIdx };
    }
  }

  // Single select
  if (SELECT_FIELD_TYPES.has(fieldType)) {
    switch (op) {
      case 'is':
        params.push(rule.value);
        return { sql: `${dataKey} = $${nextIdx}`, nextIdx: nextIdx + 1 };
      case 'isnot':
      case 'is_not':
        params.push(rule.value);
        return { sql: `(${dataKey} IS NULL OR ${dataKey} != $${nextIdx})`, nextIdx: nextIdx + 1 };
      case 'isanyof':
      case 'is_any_of': {
        const vals = Array.isArray(rule.value) ? rule.value : [rule.value];
        if (vals.length === 0) return { sql: 'FALSE', nextIdx };
        const placeholders = vals.map((_, i) => `$${nextIdx + i}`).join(', ');
        params.push(...vals);
        return { sql: `${dataKey} IN (${placeholders})`, nextIdx: nextIdx + vals.length };
      }
      case 'isnoneof':
      case 'is_none_of': {
        const vals = Array.isArray(rule.value) ? rule.value : [rule.value];
        if (vals.length === 0) return { sql: 'TRUE', nextIdx };
        const placeholders = vals.map((_, i) => `$${nextIdx + i}`).join(', ');
        params.push(...vals);
        return {
          sql: `(${dataKey} IS NULL OR ${dataKey} NOT IN (${placeholders}))`,
          nextIdx: nextIdx + vals.length,
        };
      }
      case 'isempty':
      case 'is_empty':
        return { sql: `(${dataKey} IS NULL OR ${dataKey} = '')`, nextIdx };
      case 'isnotempty':
      case 'is_not_empty':
        return { sql: `${dataKey} IS NOT NULL AND ${dataKey} != ''`, nextIdx };
      default:
        return { sql: 'TRUE', nextIdx };
    }
  }

  // Multi select (stored as JSON array)
  if (MULTI_SELECT_TYPES.has(fieldType)) {
    const arrContains = `EXISTS (SELECT 1 FROM jsonb_array_elements_text(COALESCE(${dataJson}, '[]'::jsonb)) AS elem WHERE elem = $${nextIdx})`;
    switch (op) {
      case 'contains':
        params.push(rule.value);
        return { sql: arrContains, nextIdx: nextIdx + 1 };
      case 'doesnotcontain':
      case 'does_not_contain':
        params.push(rule.value);
        return { sql: `NOT (${arrContains})`, nextIdx: nextIdx + 1 };
      case 'isanyof':
      case 'is_any_of': {
        const vals = Array.isArray(rule.value) ? rule.value : [rule.value];
        if (vals.length === 0) return { sql: 'FALSE', nextIdx };
        params.push(JSON.stringify(vals));
        return {
          sql: `EXISTS (SELECT 1 FROM jsonb_array_elements_text(COALESCE(${dataJson}, '[]'::jsonb)) AS elem WHERE elem = ANY(SELECT jsonb_array_elements_text($${nextIdx}::jsonb)))`,
          nextIdx: nextIdx + 1,
        };
      }
      case 'isempty':
      case 'is_empty':
        return { sql: `(${dataKey} IS NULL OR ${dataKey} = '[]' OR ${dataKey} = '')`, nextIdx };
      case 'isnotempty':
      case 'is_not_empty':
        return {
          sql: `${dataKey} IS NOT NULL AND ${dataKey} != '[]' AND ${dataKey} != ''`,
          nextIdx,
        };
      default:
        return { sql: 'TRUE', nextIdx };
    }
  }

  // Date types
  if (DATE_FIELD_TYPES.has(fieldType)) {
    switch (op) {
      case 'is':
        params.push(rule.value);
        return { sql: `(${dataKey})::date = ($${nextIdx}::text)::date`, nextIdx: nextIdx + 1 };
      case 'isbefore':
      case 'is_before':
        params.push(rule.value);
        return {
          sql: `(${dataKey})::timestamptz < ($${nextIdx}::text)::timestamptz`,
          nextIdx: nextIdx + 1,
        };
      case 'isafter':
      case 'is_after':
        params.push(rule.value);
        return {
          sql: `(${dataKey})::timestamptz > ($${nextIdx}::text)::timestamptz`,
          nextIdx: nextIdx + 1,
        };
      case 'isonorbefore':
      case 'is_on_or_before':
        params.push(rule.value);
        return {
          sql: `(${dataKey})::timestamptz <= ($${nextIdx}::text)::timestamptz`,
          nextIdx: nextIdx + 1,
        };
      case 'isonorafter':
      case 'is_on_or_after':
        params.push(rule.value);
        return {
          sql: `(${dataKey})::timestamptz >= ($${nextIdx}::text)::timestamptz`,
          nextIdx: nextIdx + 1,
        };
      case 'iswithin':
      case 'is_within': {
        const interval = parseIsWithinInterval(String(rule.value ?? ''));
        if (!interval) return { sql: 'TRUE', nextIdx };
        return { sql: `(${dataKey})::timestamptz >= NOW() - INTERVAL '${interval}'`, nextIdx };
      }
      case 'isempty':
      case 'is_empty':
        return { sql: `(${dataKey} IS NULL OR ${dataKey} = '')`, nextIdx };
      case 'isnotempty':
      case 'is_not_empty':
        return { sql: `${dataKey} IS NOT NULL AND ${dataKey} != ''`, nextIdx };
      default:
        return { sql: 'TRUE', nextIdx };
    }
  }

  // Checkbox
  if (fieldType === CHECKBOX_TYPE) {
    if (op === 'is') {
      const v = rule.value;
      const isTrue = v === true || v === 'true' || v === 1 || v === '1';
      return {
        sql: isTrue
          ? `(${dataKey} = 'true' OR ${dataKey} = true)`
          : `(${dataKey} IS NULL OR ${dataKey} = 'false' OR ${dataKey} = false OR ${dataKey} = '')`,
        nextIdx,
      };
    }
    return { sql: 'TRUE', nextIdx };
  }

  // Linked record (stored as array of IDs; check via tp_record_links or JSONB)
  if (LINKED_RECORD_TYPES.has(fieldType)) {
    switch (op) {
      case 'contains':
        params.push(rule.value);
        return {
          sql: `EXISTS (SELECT 1 FROM tp_record_links rl WHERE rl.from_record_id = r.id AND rl.from_field_id = $${startIdx} AND rl.to_record_id = $${nextIdx})`,
          nextIdx: nextIdx + 1,
        };
      case 'doesnotcontain':
      case 'does_not_contain':
        params.push(rule.value);
        return {
          sql: `NOT EXISTS (SELECT 1 FROM tp_record_links rl WHERE rl.from_record_id = r.id AND rl.from_field_id = $${startIdx} AND rl.to_record_id = $${nextIdx})`,
          nextIdx: nextIdx + 1,
        };
      case 'isempty':
      case 'is_empty':
        return {
          sql: `NOT EXISTS (SELECT 1 FROM tp_record_links rl WHERE rl.from_record_id = r.id AND rl.from_field_id = $${startIdx})`,
          nextIdx,
        };
      case 'isnotempty':
      case 'is_not_empty':
        return {
          sql: `EXISTS (SELECT 1 FROM tp_record_links rl WHERE rl.from_record_id = r.id AND rl.from_field_id = $${startIdx})`,
          nextIdx,
        };
      default:
        return { sql: 'TRUE', nextIdx };
    }
  }

  // Fallback: treat as text
  return buildSingleFilterClause(
    { ...rule, operator: op || 'equals' },
    params,
    startIdx,
    'singleLineText'
  );
}

/**
 * Recursively translate a (possibly nested) FilterGroup into a parameterized,
 * fully-parenthesized SQL boolean expression. Each nesting level is wrapped in
 * its own parens so precedence matches the tree exactly, e.g.
 *   { and: [A, { or: [B, C] }] }  ->  "(A) AND ((B) OR (C))"
 *
 * `depth` is 1-based for the top-level group; nesting beyond
 * MAX_FILTER_GROUP_DEPTH throws a clear error instead of recursing unbounded.
 */
export function buildFilterClause(
  filters: FilterGroup,
  params: unknown[],
  startIdx: number,
  fieldTypes: Map<string, string>,
  depth = 1
): { sql: string; nextIdx: number } {
  if (!filters?.rules?.length) {
    return { sql: 'TRUE', nextIdx: startIdx };
  }

  if (depth > MAX_FILTER_GROUP_DEPTH) {
    throw new Error(
      `Filter group nesting exceeds maximum depth of ${MAX_FILTER_GROUP_DEPTH}`
    );
  }

  const logic = (filters.logic || 'and').toUpperCase();
  const parts: string[] = [];
  let idx = startIdx;

  for (const node of filters.rules) {
    if (!node) continue;

    if (isFilterGroup(node)) {
      // Nested group: recurse with incremented depth. An empty/degenerate
      // nested group resolves to 'TRUE' and is skipped like an empty rule.
      const { sql, nextIdx } = buildFilterClause(node, params, idx, fieldTypes, depth + 1);
      idx = nextIdx;
      if (sql === 'TRUE' && !node.rules?.length) continue;
      parts.push(`(${sql})`);
      continue;
    }

    const rule = node as FilterRule;
    if (!rule.fieldId) continue;
    const fieldType = fieldTypes.get(rule.fieldId) || 'singleLineText';
    const { sql, nextIdx } = buildSingleFilterClause(rule, params, idx, fieldType);
    parts.push(`(${sql})`);
    idx = nextIdx;
  }

  if (parts.length === 0) return { sql: 'TRUE', nextIdx: idx };
  return { sql: parts.join(` ${logic} `), nextIdx: idx };
}

// ---------------------------------------------------------------------------
// Sort SQL Builder
// ---------------------------------------------------------------------------

export function buildSortClause(
  sorts: SortRule[],
  params: unknown[],
  startIdx: number
): { sql: string; nextIdx: number } {
  if (!sorts?.length) {
    return { sql: 'r.created_at DESC, r.id ASC', nextIdx: startIdx };
  }

  const parts: string[] = [];
  let idx = startIdx;

  for (const s of sorts) {
    const key = sanitizeFieldKey(s.fieldId);
    if (!key) continue;
    params.push(s.fieldId);
    const dir = (s.direction || 'asc').toUpperCase();
    const defaultNulls = dir === 'ASC' ? 'NULLS LAST' : 'NULLS FIRST';
    const nulls =
      s.nulls === 'first' ? 'NULLS FIRST' : s.nulls === 'last' ? 'NULLS LAST' : defaultNulls;
    parts.push(`(r.data->>$${idx}) ${dir} ${nulls}`);
    idx++;
  }

  parts.push('r.created_at DESC', 'r.id ASC');
  return { sql: parts.join(', '), nextIdx: idx };
}

// ---------------------------------------------------------------------------
// View Resolution
// ---------------------------------------------------------------------------

export async function resolveView(viewId: string): Promise<{
  filters?: FilterGroup;
  sorts?: SortRule[];
  fields?: string[];
  groupBy?: string;
}> {
  const db = getDatabase();
  try {
    const result = await (db as any).query(
      'SELECT config, visible_field_ids FROM tp_views WHERE id = $1',
      [viewId]
    );
    const row = result.rows[0];
    if (!row) return {};

    const config = row.config || {};
    const visibleFieldIds = row.visible_field_ids || [];

    return {
      filters: config.filters,
      sorts: config.sorts,
      fields: visibleFieldIds.length > 0 ? visibleFieldIds : config.fields,
      groupBy: config.groupBy ?? config.group_by,
    };
  } catch (e) {
    logger.error('[ViewQueryEngine] resolveView failed', { viewId, error: (e as Error).message });
    return {};
  }
}

// ---------------------------------------------------------------------------
// Field Types Loading
// ---------------------------------------------------------------------------

async function loadFieldTypes(tableId: string): Promise<Map<string, string>> {
  const db = getDatabase();
  const result = await (db as any).query(
    'SELECT id, field_type FROM tp_fields WHERE table_id = $1',
    [tableId]
  );
  const map = new Map<string, string>();
  for (const row of result.rows || []) {
    map.set(row.id, row.field_type || 'singleLineText');
  }
  return map;
}

async function loadFieldNameToId(tableId: string): Promise<Map<string, string>> {
  const db = getDatabase();
  const result = await (db as any).query('SELECT id, name FROM tp_fields WHERE table_id = $1', [
    tableId,
  ]);
  const map = new Map<string, string>();
  for (const row of result.rows || []) {
    if (row.name) map.set(row.name, row.id);
    map.set(row.id, row.id);
  }
  return map;
}

// ---------------------------------------------------------------------------
// Search Builder
// ---------------------------------------------------------------------------

function buildSearchClause(
  search: string,
  textFieldIds: string[],
  params: unknown[],
  startIdx: number
): { sql: string; nextIdx: number } {
  if (!search?.trim() || textFieldIds.length === 0) {
    return { sql: 'TRUE', nextIdx: startIdx };
  }

  const pattern = `%${String(search).replace(/%/g, '\\%').replace(/_/g, '\\_')}%`;
  const parts: string[] = [];
  let idx = startIdx;

  for (const fieldId of textFieldIds) {
    if (!isValidFieldKey(fieldId)) continue;
    params.push(fieldId);
    params.push(pattern);
    parts.push(`(r.data->>$${idx} ILIKE $${idx + 1})`);
    idx += 2;
  }

  if (parts.length === 0) return { sql: 'TRUE', nextIdx: startIdx };
  return { sql: `(${parts.join(' OR ')})`, nextIdx: idx };
}

// ---------------------------------------------------------------------------
// Formula Filter Builder
// ---------------------------------------------------------------------------

/**
 * Resolve a field name to its ID using the field name→id map.
 * Falls back to the name itself if not found (may be an ID already).
 */
function resolveFieldName(name: string, fieldNameToId: Map<string, string>): string {
  return fieldNameToId.get(name) ?? name;
}

/**
 * Convert a formula AST into a parameterized SQL WHERE clause.
 * Field references `{FieldName}` become `(r.data->>$N)` with parameterized field IDs.
 */
function astToSql(
  node: FormulaAST,
  params: unknown[],
  startIdx: number,
  fieldNameToId: Map<string, string>,
  fieldTypes: Map<string, string>
): { sql: string; nextIdx: number } {
  const idx = startIdx;

  switch (node.type) {
    case 'literal': {
      params.push(node.value);
      return { sql: `$${idx}`, nextIdx: idx + 1 };
    }

    case 'fieldRef': {
      const fieldId = resolveFieldName(node.name!, fieldNameToId);
      params.push(fieldId);
      const fieldType = fieldTypes.get(fieldId) || 'singleLineText';
      const isNumeric = NUMBER_FIELD_TYPES.has(fieldType);
      const expr = isNumeric ? `(r.data->>$${idx})::numeric` : `(r.data->>$${idx})`;
      return { sql: expr, nextIdx: idx + 1 };
    }

    case 'operator': {
      const op = node.name!;
      const children = node.children ?? [];

      if (op === 'NOT') {
        const { sql: childSql, nextIdx } = astToSql(
          children[0],
          params,
          idx,
          fieldNameToId,
          fieldTypes
        );
        return { sql: `NOT (${childSql})`, nextIdx };
      }

      if (op === 'AND' || op === 'OR') {
        const { sql: leftSql, nextIdx: afterLeft } = astToSql(
          children[0],
          params,
          idx,
          fieldNameToId,
          fieldTypes
        );
        const { sql: rightSql, nextIdx: afterRight } = astToSql(
          children[1],
          params,
          afterLeft,
          fieldNameToId,
          fieldTypes
        );
        return { sql: `(${leftSql} ${op} ${rightSql})`, nextIdx: afterRight };
      }

      // Comparison / arithmetic operators
      const { sql: leftSql, nextIdx: afterLeft } = astToSql(
        children[0],
        params,
        idx,
        fieldNameToId,
        fieldTypes
      );
      const { sql: rightSql, nextIdx: afterRight } = astToSql(
        children[1],
        params,
        afterLeft,
        fieldNameToId,
        fieldTypes
      );

      const sqlOp = op === '=' ? '=' : op === '!=' ? '!=' : op;
      return { sql: `(${leftSql} ${sqlOp} ${rightSql})`, nextIdx: afterRight };
    }

    case 'function': {
      // For filter formulas, we don't support function calls in SQL generation.
      // Return TRUE as a safe fallback.
      return { sql: 'TRUE', nextIdx: idx };
    }

    default:
      return { sql: 'TRUE', nextIdx: idx };
  }
}

function buildFormulaFilterClause(
  formula: string,
  params: unknown[],
  startIdx: number,
  fieldNameToId: Map<string, string>,
  fieldTypes: Map<string, string>
): { sql: string; nextIdx: number } {
  try {
    const ast = parseFormula(formula);
    return astToSql(ast, params, startIdx, fieldNameToId, fieldTypes);
  } catch (e) {
    logger.warn('[ViewQueryEngine] filterByFormula parse failed', {
      formula,
      error: (e as Error).message,
    });
    return { sql: 'TRUE', nextIdx: startIdx };
  }
}

// ---------------------------------------------------------------------------
// Group Query Builder
// ---------------------------------------------------------------------------

async function buildGroupQuery(
  tableId: string,
  groupByFieldId: string,
  filters: FilterGroup | undefined,
  sorts: SortRule[] | undefined,
  fields: string[] | undefined,
  pageSize: number,
  fieldTypes: Map<string, string>,
  aggregates?: GroupAggregate[]
): Promise<GroupResult[]> {
  const db = getDatabase();
  const params: unknown[] = [tableId];
  let paramIdx = 2;

  const { sql: filterSql, nextIdx: afterFilter } = buildFilterClause(
    filters || { logic: 'and', rules: [] },
    params,
    paramIdx,
    fieldTypes
  );
  paramIdx = afterFilter;

  const keySanitized = sanitizeFieldKey(groupByFieldId);
  if (!keySanitized) return [];

  params.push(groupByFieldId);
  const groupKeyParamIdx = paramIdx;
  paramIdx++;

  // Build aggregate columns for the group-level query
  const aggColumns: string[] = [];
  const aggFieldParamIndices: { fieldId: string; paramIdx: number; functions: string[] }[] = [];
  if (aggregates?.length) {
    for (const agg of aggregates) {
      const safeKey = sanitizeFieldKey(agg.fieldId);
      if (!safeKey) continue;
      params.push(agg.fieldId);
      const aggParamIdx = paramIdx;
      paramIdx++;
      for (const fn of agg.functions) {
        const fnUpper = fn.toUpperCase();
        if (fnUpper === 'COUNT') {
          aggColumns.push(`COUNT(*) AS "agg_${safeKey}_count"`);
        } else if (['SUM', 'AVG', 'MIN', 'MAX'].includes(fnUpper)) {
          aggColumns.push(
            `${fnUpper}((r.data->>$${aggParamIdx})::numeric) AS "agg_${safeKey}_${fn}"`
          );
        }
      }
      aggFieldParamIndices.push({
        fieldId: agg.fieldId,
        paramIdx: aggParamIdx,
        functions: agg.functions.map((f) => f.toLowerCase()),
      });
    }
  }

  const extraAggSelect = aggColumns.length > 0 ? ', ' + aggColumns.join(', ') : '';

  const countSql = `
    SELECT r.data->>$${groupKeyParamIdx} AS group_value, COUNT(*) AS cnt${extraAggSelect}
    FROM tp_records r
    WHERE r.table_id = $1 AND (${filterSql})
    GROUP BY r.data->>$${groupKeyParamIdx}
    ORDER BY group_value ASC NULLS LAST
  `;

  const countResult = await (db as any).query(countSql, params);
  const groups: GroupResult[] = [];
  const limit = Math.min(pageSize, MAX_PAGE_SIZE);

  for (const row of countResult.rows || []) {
    const groupValue =
      row.group_value !== undefined && row.group_value !== '' ? row.group_value : null;
    const count = parseInt(String(row.cnt ?? 0), 10);

    // Extract aggregate values from the row
    let groupAggregates: Record<string, Record<string, number | null>> | undefined;
    if (aggFieldParamIndices.length > 0) {
      groupAggregates = {};
      for (const agg of aggFieldParamIndices) {
        const safeKey = sanitizeFieldKey(agg.fieldId);
        if (!safeKey) continue;
        const fieldAggs: Record<string, number | null> = {};
        for (const fn of agg.functions) {
          const colName = `agg_${safeKey}_${fn}`;
          const rawVal = row[colName];
          fieldAggs[fn] = rawVal != null ? parseFloat(String(rawVal)) : null;
        }
        groupAggregates[agg.fieldId] = fieldAggs;
      }
    }

    const recParams: unknown[] = [tableId, groupByFieldId];
    const groupFilter =
      groupValue === null
        ? `AND (r.data->>$2 IS NULL OR r.data->>$2 = '')`
        : `AND r.data->>$2 = $3`;
    if (groupValue !== null) recParams.push(groupValue);

    const sortStartIdx = recParams.length + 1;
    const { sql: sortSql } = buildSortClause(sorts || [], recParams, sortStartIdx);

    const fieldParamStart = recParams.length + 1;
    const selectFields =
      fields?.length && fields.length > 0
        ? fields
            .map((f, i) => {
              const safe = sanitizeFieldKey(f);
              return safe
                ? `r.data->>$${fieldParamStart + i} AS "${safe.replace(/"/g, '""')}"`
                : null;
            })
            .filter(Boolean)
            .join(', ') + ', r.id, r.table_id, r.data, r.created_at, r.updated_at, r.created_by'
        : 'r.*';

    if (fields?.length) recParams.push(...fields);
    recParams.push(limit);
    const limitParamIdx = recParams.length;

    const recSql = `
      SELECT ${selectFields}
      FROM tp_records r
      WHERE r.table_id = $1 ${groupFilter}
      ORDER BY ${sortSql}
      LIMIT $${limitParamIdx}
    `;

    const recResult = await (db as any).query(recSql, recParams);
    const groupResult: GroupResult = {
      value: groupValue,
      count,
      records: recResult.rows || [],
    };
    if (groupAggregates) {
      groupResult.aggregates = groupAggregates;
    }
    groups.push(groupResult);
  }

  return groups;
}

// ---------------------------------------------------------------------------
// Main Entry Point
// ---------------------------------------------------------------------------

const viewQueryEngine = {
  async executeQuery(options: QueryOptions): Promise<QueryResult> {
    const db = getDatabase();
    const pageSize = Math.min(Math.max(1, options.pageSize ?? DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE);

    let filters = options.filters;
    let sorts = options.sorts;
    let fields = options.fields;
    let groupBy = options.groupBy;

    if (options.viewId) {
      const viewConfig = await resolveView(options.viewId);
      filters = filters ?? viewConfig.filters;
      sorts = sorts ?? viewConfig.sorts;
      fields = fields ?? viewConfig.fields;
      groupBy = groupBy ?? viewConfig.groupBy;
    }

    const fieldTypes = await loadFieldTypes(options.tableId);
    const params: unknown[] = [options.tableId];
    let paramIdx = 2;

    let whereClause = 'r.table_id = $1';
    const conditions: string[] = [];

    if (filters?.rules?.length) {
      const { sql, nextIdx } = buildFilterClause(filters, params, paramIdx, fieldTypes);
      conditions.push(`(${sql})`);
      paramIdx = nextIdx;
    }

    if (options.filterByFormula?.trim()) {
      const fieldNameToId = await loadFieldNameToId(options.tableId);
      const { sql, nextIdx } = buildFormulaFilterClause(
        options.filterByFormula,
        params,
        paramIdx,
        fieldNameToId,
        fieldTypes
      );
      if (sql !== 'TRUE') {
        conditions.push(`(${sql})`);
      }
      paramIdx = nextIdx;
    }

    if (options.search?.trim()) {
      const searchFieldIds = options.searchFieldIds?.length
        ? options.searchFieldIds.filter((id) => isValidFieldKey(id))
        : Array.from(fieldTypes.entries())
            .filter(([, t]) => TEXT_FIELD_TYPES.has(t))
            .map(([id]) => id);
      const { sql, nextIdx } = buildSearchClause(options.search, searchFieldIds, params, paramIdx);
      conditions.push(sql);
      paramIdx = nextIdx;
    }

    if (options.userRole) {
      try {
        const { default: rowPolicyService } = await import('./RowPolicyService.js');
        const { sql: policySql, nextIdx: afterPolicy } =
          await rowPolicyService.buildRowFilterClause(
            options.tableId,
            options.userRole,
            params,
            paramIdx
          );
        if (policySql !== 'TRUE') {
          conditions.push(`(${policySql})`);
        }
        paramIdx = afterPolicy;
      } catch (policyErr) {
        logger.warn('[ViewQueryEngine] row policy filter failed, skipping', {
          tableId: options.tableId,
          error: (policyErr as Error).message,
        });
      }
    }

    if (conditions.length > 0) {
      whereClause += ' AND ' + conditions.join(' AND ');
    }

    if (groupBy) {
      const groups = await buildGroupQuery(
        options.tableId,
        groupBy,
        filters,
        sorts,
        fields,
        pageSize,
        fieldTypes,
        options.groupAggregates
      );
      const total = groups.reduce((sum, g) => sum + g.count, 0);
      return {
        records: [],
        total,
        hasMore: false,
        groups,
      };
    }

    const useOffsetPagination = options.page != null && options.page > 0;

    try {
      await (db as any).query(`SET LOCAL statement_timeout = ${QUERY_TIMEOUT_MS}`);

      const countParams = [...params];
      const countResult = await (db as any).query(
        `SELECT COUNT(*) AS total FROM tp_records r WHERE ${whereClause}`,
        countParams
      );
      const total = parseInt(String((countResult.rows[0] as { total?: string })?.total ?? 0), 10);

      const finalParams = [...params];

      // Offset pagination path
      if (useOffsetPagination) {
        const page = Math.max(1, options.page!);
        const offset = (page - 1) * pageSize;

        const { sql: sortSql, nextIdx: afterSortIdx } = buildSortClause(
          sorts || [],
          finalParams,
          paramIdx
        );
        paramIdx = afterSortIdx;

        let selectClause: string;
        if (fields?.length && fields.length > 0) {
          const projectionParts = fields
            .map((f, i) => {
              const safe = sanitizeFieldKey(f);
              if (!safe) return null;
              return `$${paramIdx + i}, r.data->$${paramIdx + i}`;
            })
            .filter(Boolean);
          const projectedData = `jsonb_build_object(${projectionParts.join(', ')})`;
          selectClause = `r.id, r.table_id, ${projectedData} AS data, r.created_at, r.updated_at, r.created_by`;
          finalParams.push(...fields);
          paramIdx += fields.length;
        } else {
          selectClause = 'r.*';
        }

        finalParams.push(pageSize);
        const limitParamIdx = paramIdx;
        paramIdx++;

        finalParams.push(offset);
        const offsetParamIdx = paramIdx;

        const listSql = `SELECT ${selectClause}
          FROM tp_records r
          WHERE ${whereClause}
          ORDER BY ${sortSql}
          LIMIT $${limitParamIdx} OFFSET $${offsetParamIdx}`;

        const listResult = await (db as any).query(listSql, finalParams);
        const records = listResult.rows || [];
        const hasMore = offset + records.length < total;

        return { records, total, hasMore, page, pageSize };
      }

      // Cursor pagination path (default)
      let cursorWhere = '';
      if (options.cursor) {
        const parts = options.cursor.split(CURSOR_DELIM);
        const cursorCreatedAt = parts[0];
        const cursorId = parts[1];
        if (cursorCreatedAt && cursorId) {
          cursorWhere = ` AND (r.created_at, r.id) < ($${paramIdx}, $${paramIdx + 1})`;
          finalParams.push(cursorCreatedAt, cursorId);
          paramIdx += 2;
        }
      }

      const { sql: sortSql, nextIdx: afterSortIdx } = buildSortClause(
        sorts || [],
        finalParams,
        paramIdx
      );
      paramIdx = afterSortIdx;

      let selectClause: string;
      let limitParamIdx: number;
      if (fields?.length && fields.length > 0) {
        const projectionParts = fields
          .map((f, i) => {
            const safe = sanitizeFieldKey(f);
            if (!safe) return null;
            return `$${paramIdx + i}, r.data->$${paramIdx + i}`;
          })
          .filter(Boolean);
        const projectedData = `jsonb_build_object(${projectionParts.join(', ')})`;
        selectClause = `r.id, r.table_id, ${projectedData} AS data, r.created_at, r.updated_at, r.created_by`;
        finalParams.push(...fields);
        limitParamIdx = paramIdx + fields.length;
        paramIdx = limitParamIdx;
      } else {
        selectClause = 'r.*';
        limitParamIdx = paramIdx;
      }
      finalParams.push(pageSize + 1);

      const listSql = `SELECT ${selectClause}
        FROM tp_records r
        WHERE ${whereClause}${cursorWhere}
        ORDER BY ${sortSql}
        LIMIT $${limitParamIdx}`;

      const listResult = await (db as any).query(listSql, finalParams);
      const rows = listResult.rows || [];
      const hasMore = rows.length > pageSize;
      const records = hasMore ? rows.slice(0, pageSize) : rows;

      let nextCursor: string | undefined;
      if (hasMore && records.length) {
        const last = records[records.length - 1] as Record<string, unknown>;
        nextCursor = `${last.created_at}${CURSOR_DELIM}${last.id}`;
      }

      return { records, total, cursor: nextCursor, hasMore };
    } catch (e) {
      const errMsg = (e as Error).message || '';
      if (errMsg.includes('statement timeout') || errMsg.includes('canceling statement')) {
        logger.warn('[ViewQueryEngine] query timed out', { tableId: options.tableId });
        throw new Error('Query timed out. Try narrowing your filters.');
      }
      logger.error('[ViewQueryEngine] executeQuery failed', {
        tableId: options.tableId,
        error: errMsg,
      });
      throw e;
    }
  },

  buildFilterClause,
  buildSortClause,
  resolveView,
};

export default viewQueryEngine;
