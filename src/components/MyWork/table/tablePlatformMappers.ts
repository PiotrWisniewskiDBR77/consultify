/**
 * tablePlatformMappers — pure conversion functions between legacy table UI types
 * and Table Platform API types.
 */

import type { FieldType, TablePlatformField, TablePlatformView } from '@/types/tablePlatform';
import type {
  FilterGroup as TPFilterGroup,
  FilterRule as TPFilterRule,
  SortRule as TPSortRule,
} from '@/types/tablePlatform';
import type { TablePlatformRecord } from '@/types/tablePlatform';

import type {
  ColumnDef,
  ColumnType,
  FilterGroup,
  FilterRule,
  SavedView,
  SortConfig,
  TableNode,
} from './tableTypes';
import { DEFAULT_COLUMN_WIDTH } from './tableTypes';

// Legacy ColumnType -> new FieldType
const COLUMN_TYPE_TO_FIELD_TYPE: Record<string, string> = {
  text: 'singleLineText',
  number: 'number',
  select: 'singleSelect',
  multiselect: 'multiSelect',
  status: 'singleSelect',
  date: 'date',
  checkbox: 'checkbox',
  url: 'url',
  currency: 'currency',
  phone: 'phone',
  email: 'email',
  file: 'attachment',
  relation: 'linkedRecord',
  rollup: 'rollup',
  created_time: 'createdTime',
  created_by: 'createdBy',
  last_edited_time: 'lastModifiedTime',
  last_edited_by: 'lastModifiedBy',
};

// New FieldType -> legacy ColumnType
const FIELD_TYPE_TO_COLUMN_TYPE: Record<string, ColumnType> = {} as Record<string, ColumnType>;
for (const [k, v] of Object.entries(COLUMN_TYPE_TO_FIELD_TYPE)) {
  if (!FIELD_TYPE_TO_COLUMN_TYPE[v]) {
    FIELD_TYPE_TO_COLUMN_TYPE[v] = k as ColumnType;
  }
}
// Fallbacks for TP types not in map
FIELD_TYPE_TO_COLUMN_TYPE['singleLineText'] ??= 'text';
FIELD_TYPE_TO_COLUMN_TYPE['longText'] ??= 'text';
FIELD_TYPE_TO_COLUMN_TYPE['percent'] ??= 'number';

/** Convert TablePlatformField to legacy ColumnDef */
export function fieldToColumn(field: TablePlatformField): ColumnDef {
  const options = field.options as
    | { options?: Array<{ id?: string; name?: string; color?: string }> }
    | undefined;
  const optList = options?.options ?? [];
  return {
    key: field.id,
    header: field.name,
    type: (FIELD_TYPE_TO_COLUMN_TYPE[field.fieldType] ?? 'text') as ColumnType,
    visible: true,
    width: DEFAULT_COLUMN_WIDTH,
    options: optList.map((o) => o?.name ?? o?.id ?? String(o)).filter(Boolean),
    optionColors: optList.reduce<Record<string, string>>((acc, o) => {
      if (o?.id && o?.color) acc[o.id] = o.color;
      return acc;
    }, {}),
  };
}

/** Convert legacy ColumnDef to partial TablePlatformField (for create/update) */
export function columnToField(column: ColumnDef): Partial<TablePlatformField> {
  const fieldType = COLUMN_TYPE_TO_FIELD_TYPE[column.type] ?? 'singleLineText';
  const options: Record<string, unknown> = {};
  if (column.options?.length) {
    options.options = column.options.map((name, i) => ({
      id: `opt-${i}`,
      name,
      color: column.optionColors?.[name],
    }));
  }
  return {
    name: column.header,
    fieldType: fieldType as FieldType,
    options,
  };
}

/**
 * Internal `TableNode.data` keys carrying Block B / record-provenance
 * metadata. The `__` prefix is intentional and protects the keys from
 * colliding with field IDs (which are UUIDs, never starting with `__`).
 */
export const PROVENANCE_DATA_KEYS = {
  confidenceScore: '__confidence_score',
  validationStatus: '__validation_status',
} as const;

/** Convert TablePlatformRecord to legacy TableNode.
 * Data is keyed by fieldId (column.key) for compatibility with CellRenderer/GridView.
 *
 * Provenance metadata (`confidence_score`, `validation_status`) is mirrored
 * onto the node under `__`-prefixed keys so the grid gutter and
 * RowDetailPanel can read it without touching every consumer of
 * `node.data`. Keys are listed in `PROVENANCE_DATA_KEYS`.
 */
export function recordToNode(record: TablePlatformRecord, fields: TablePlatformField[]): TableNode {
  const data: Record<string, unknown> = { ...(record.data ?? {}) };
  data.id = record.id;
  if (record.confidence_score !== undefined) {
    data[PROVENANCE_DATA_KEYS.confidenceScore] = record.confidence_score;
  }
  if (record.validation_status !== undefined) {
    data[PROVENANCE_DATA_KEYS.validationStatus] = record.validation_status;
  }
  return {
    id: record.id,
    type: 'idea',
    data,
  };
}

/** Convert legacy TableNode to record data (fieldId-keyed) for API */
export function nodeToRecordData(node: TableNode, columns: ColumnDef[]): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  const nodeData = node?.data ?? {};
  const colByKey = new Map(columns.map((c) => [c.key, c]));
  for (const [key, value] of Object.entries(nodeData)) {
    if (key === 'id') continue;
    const col = colByKey.get(key);
    const fieldId = col?.key ?? key;
    data[fieldId] = value;
  }
  return data;
}

/** Map legacy filter operator to TP/backend operator */
const LEGACY_OP_TO_TP: Record<string, string> = {
  contains: 'contains',
  equals: 'equals',
  not_empty: 'isNotEmpty',
  is_empty: 'isEmpty',
  gt: 'gt',
  lt: 'lt',
  between: 'between',
  in: 'in',
};

/** Map TP operator to legacy */
const TP_OP_TO_LEGACY: Record<string, string> = {
  contains: 'contains',
  equals: 'equals',
  isNotEmpty: 'not_empty',
  isEmpty: 'is_empty',
  gt: 'gt',
  lt: 'lt',
  between: 'between',
  in: 'in',
};

/** Convert legacy FilterGroup to Table Platform FilterGroup */
export function legacyFiltersToTP(filters: FilterGroup): TPFilterGroup {
  return {
    logic: filters.logic,
    rules: filters.rules.map(
      (r): TPFilterRule => ({
        fieldId: r.column,
        operator: LEGACY_OP_TO_TP[r.operator] ?? r.operator,
        value: r.value,
      })
    ),
  };
}

/** Convert Table Platform FilterGroup to legacy FilterGroup */
export function tpFiltersToLegacy(filters: TPFilterGroup): FilterGroup {
  return {
    logic: filters.logic,
    rules: filters.rules.map(
      (r): FilterRule => ({
        id: `${r.fieldId}-${r.operator}`,
        column: r.fieldId,
        operator: (TP_OP_TO_LEGACY[r.operator] ?? r.operator) as FilterRule['operator'],
        value: r.value as string | string[] | number,
      })
    ),
  };
}

/** Convert legacy SortConfig to Table Platform SortRule */
export function legacySortToTP(sort: SortConfig): TPSortRule {
  return {
    fieldId: sort.key,
    direction: sort.direction,
  };
}

/** Convert Table Platform SortRule to legacy SortConfig */
export function tpSortToLegacy(sort: TPSortRule): SortConfig {
  return {
    key: sort.fieldId,
    direction: sort.direction,
  };
}

/** Convert legacy SavedView to TP view config shape */
export function legacyViewToTP(view: SavedView): Record<string, unknown> {
  const config: Record<string, unknown> = {};
  if (view.sort?.length) {
    config.sorts = view.sort.map(legacySortToTP);
  }
  if (view.filters) {
    config.filters = legacyFiltersToTP(view.filters);
  }
  if (view.groupBy) {
    config.groupBy = { fieldId: view.groupBy };
  }
  return config;
}

/** Convert TablePlatformView to legacy SavedView */
export function tpViewToLegacy(view: TablePlatformView, fields: TablePlatformField[]): SavedView {
  const config = view.config ?? {};
  const sort = config.sorts?.map(tpSortToLegacy);
  const filters = config.filters ? tpFiltersToLegacy(config.filters) : undefined;
  const groupBy = (config.groupBy as { fieldId?: string })?.fieldId;
  const visibleFieldIds = view.visibleFieldIds ?? [];
  const fieldOrder = new Map(fields.map((f, i) => [f.id, i]));
  const columns = visibleFieldIds
    .sort((a, b) => (fieldOrder.get(a) ?? 0) - (fieldOrder.get(b) ?? 0))
    .map((fid) => ({ key: fid, visible: true, width: DEFAULT_COLUMN_WIDTH }));
  return {
    id: view.id,
    name: view.name,
    sort,
    filters,
    groupBy,
    columns: columns.length ? columns : undefined,
    layout: view.viewType as SavedView['layout'],
  };
}
