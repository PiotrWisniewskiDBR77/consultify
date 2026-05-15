/**
 * Table Platform - Shared TypeScript Definitions
 * Domain types for bases, tables, fields, views, records, and schema proposals.
 *
 * @module types/tablePlatform
 */

// ============================================================================
// FIELD TYPES & OPTIONS
// ============================================================================

export type FieldType =
  | 'singleLineText'
  | 'longText'
  | 'number'
  | 'currency'
  | 'percent'
  | 'checkbox'
  | 'date'
  | 'singleSelect'
  | 'multiSelect'
  | 'url'
  | 'email'
  | 'phone'
  | 'attachment'
  | 'linkedRecord'
  | 'count'
  | 'lookup'
  | 'rollup'
  | 'createdTime'
  | 'createdBy'
  | 'lastModifiedTime'
  | 'lastModifiedBy'
  | 'autoNumber'
  | 'formula'
  | 'button'
  | 'rating'
  | 'duration'
  | 'barcode';

/** Select option for singleSelect / multiSelect fields (avoids conflict with ui SelectOption) */
export interface TablePlatformSelectOption {
  id: string;
  name: string;
  color?: string;
}

export interface NumberFieldOptions {
  precision?: number;
  format?: 'decimal' | 'integer';
}

export interface CurrencyFieldOptions {
  currencySymbol?: string;
  precision?: number;
  locale?: string;
}

export interface PercentFieldOptions {
  precision?: number;
}

export interface DateFieldOptions {
  dateFormat?: string;
  includeTime?: boolean;
  timeZone?: string;
}

export interface SingleSelectFieldOptions {
  options: TablePlatformSelectOption[];
}

export interface MultiSelectFieldOptions {
  options: TablePlatformSelectOption[];
}

export interface LinkedRecordFieldOptions {
  linkedTableId: string;
  preferredViewId?: string;
  isReverse?: boolean;
  reverseFieldId?: string;
}

export interface LookupFieldOptions {
  linkedFieldId: string;
  lookupFieldId: string;
}

export interface RollupFieldOptions {
  linkedFieldId: string;
  lookupFieldId: string;
  aggregation: 'sum' | 'avg' | 'min' | 'max' | 'count' | 'counta' | 'concat';
}

export interface CountFieldOptions {
  linkedFieldId: string;
}

export interface AttachmentFieldOptions {
  maxFiles?: number;
  allowedMimeTypes?: string[];
}

export interface FormulaFieldOptions {
  expression: string;
  resultType?: 'string' | 'number' | 'boolean' | 'date';
  dependencies?: string[];
}

export interface RatingFieldOptions {
  max?: number;
}

export interface DurationFieldOptions {
  format?: 'h:mm' | 'h:mm:ss' | 'h:mm:ss.S';
}

export type FieldOptions =
  | NumberFieldOptions
  | CurrencyFieldOptions
  | PercentFieldOptions
  | DateFieldOptions
  | SingleSelectFieldOptions
  | MultiSelectFieldOptions
  | LinkedRecordFieldOptions
  | LookupFieldOptions
  | RollupFieldOptions
  | CountFieldOptions
  | AttachmentFieldOptions
  | FormulaFieldOptions
  | RatingFieldOptions
  | DurationFieldOptions
  | Record<string, never>;

// ============================================================================
// CORE DOMAIN ENTITIES
// ============================================================================

/** Base container (workspace-level) for tables */
export interface TablePlatformBase {
  id: string;
  workspaceId: string;
  name: string;
  schemaVersion: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

/** Table within a base */
export interface TablePlatformTable {
  id: string;
  baseId: string;
  name: string;
  description?: string;
  primaryFieldId: string;
  createdAt: string;
  updatedAt: string;
}

/** Field definition within a table */
export interface TablePlatformField {
  id: string;
  tableId: string;
  name: string;
  fieldType: FieldType;
  options: FieldOptions;
  isComputed: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
}

/** View configuration (grid, kanban, calendar, etc.) */
export interface TablePlatformView {
  id: string;
  tableId: string;
  name: string;
  viewType: 'grid' | 'kanban' | 'calendar' | 'timeline' | 'gallery' | 'form';
  visibleFieldIds: string[];
  config: ViewConfig;
  isPersonal?: boolean;
  ownerId?: string;
  isShared?: boolean;
  shareToken?: string;
  createdAt: string;
  updatedAt: string;
}

/** View display and filter configuration */
export interface ViewConfig {
  filters?: FilterGroup;
  sorts?: SortRule[];
  groupBy?: GroupConfig;
  rowHeight?: 'short' | 'medium' | 'tall';
  /** Field IDs still in `visibleFieldIds` but removed from schema; grid shows degraded columns */
  missing_fields?: string[];
  /** Display names captured when a field was deleted (field id → name) */
  missing_field_names?: Record<string, string>;
}

/** Filter expression group (AND/OR logic) */
export interface FilterGroup {
  logic: 'and' | 'or';
  rules: FilterRule[];
}

/** Single filter rule */
export interface FilterRule {
  fieldId: string;
  operator: string;
  value?: unknown;
}

/** Sort rule for a field */
export interface SortRule {
  fieldId: string;
  direction: 'asc' | 'desc';
  nulls?: 'first' | 'last';
}

/** Group-by configuration for grouped views */
export interface GroupConfig {
  fieldId: string;
  order?: 'asc' | 'desc';
  collapsed?: string[];
}

/** Record (row) with JSONB data keyed by field ID */
export interface TablePlatformRecord {
  id: string;
  tableId: string;
  data: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

/** Attachment file metadata */
export interface TablePlatformAttachment {
  id: string;
  recordId: string;
  fieldId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  storageKey: string;
  thumbnails?: { small?: string; large?: string };
  createdAt: string;
}

/** Link between records (linked record field) */
export interface RecordLink {
  fromRecordId: string;
  fromFieldId: string;
  toRecordId: string;
  createdAt: string;
}

// ============================================================================
// AUDIT EVENTS
// ============================================================================

/** Audit event for schema and record changes */
export interface AuditEvent {
  id: string;
  eventType: AuditEventType;
  entityType: 'base' | 'table' | 'field' | 'view' | 'record' | 'attachment' | 'record_link';
  entityId: string;
  actorId: string;
  timestamp: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export type AuditEventType =
  | 'record.created'
  | 'record.updated'
  | 'record.deleted'
  | 'field.created'
  | 'field.updated'
  | 'field.deleted'
  | 'table.created'
  | 'table.updated'
  | 'view.created'
  | 'view.updated'
  | 'base.created'
  | 'base.updated'
  | 'schema_proposal.approved'
  | 'schema_proposal.rejected';

// ============================================================================
// API REQUEST/RESPONSE TYPES
// ============================================================================

/** List records request with filters, sorts, and pagination */
export interface ListRecordsRequest {
  tableId: string;
  viewId?: string;
  filters?: FilterGroup;
  sorts?: SortRule[];
  fields?: string[];
  pageSize?: number;
  cursor?: string;
}

/** List records response with cursor pagination */
export interface ListRecordsResponse {
  records: TablePlatformRecord[];
  total: number;
  cursor?: string;
  hasMore: boolean;
}

/** Batch create/update/delete operations */
export interface BatchRecordsRequest {
  operations: Array<{
    type: 'create' | 'update' | 'delete';
    recordId?: string;
    data?: Record<string, unknown>;
  }>;
}

/** Result of batch operations */
export interface BatchRecordsResponse {
  results: Array<{
    success: boolean;
    recordId?: string;
    error?: string;
  }>;
}

// ============================================================================
// SCHEMA PROPOSAL TYPES (Chat-to-Schema)
// ============================================================================

/** Schema proposal from Chat-to-Schema flow */
export interface SchemaProposal {
  proposalId: string;
  createdAt: string;
  intent: SchemaIntent;
  confidence: number;
  summary: string;
  operations: SchemaOperation[];
  warnings: ProposalWarning[];
}

export type SchemaIntent =
  | 'create_base'
  | 'create_table'
  | 'create_tables'
  | 'add_field'
  | 'modify_field'
  | 'remove_field'
  | 'create_view'
  | 'modify_view'
  | 'seed_records'
  | 'describe_schema'
  | 'suggest_improvement';

/** Single schema mutation operation */
export interface SchemaOperation {
  operationId: string;
  operationType:
    | 'create_base'
    | 'create_table'
    | 'create_field'
    | 'update_field'
    | 'delete_field'
    | 'create_view'
    | 'create_record';
  target: {
    baseId?: string;
    tableId?: string;
    fieldId?: string;
    viewId?: string;
  };
  payload: Record<string, unknown>;
  dependencies: string[];
  reversible: boolean;
}

/** Warning on a proposal or operation */
export interface ProposalWarning {
  level: 'info' | 'warning' | 'error';
  message: string;
  operationId?: string;
}

/** User approval or rejection of a proposal */
export interface ProposalApprovalRequest {
  proposalId: string;
  approved: boolean;
  approvedOperationIds?: string[];
  refinementMessage?: string;
}

/** Result of executing approved proposal operations */
export interface MutationExecutionResult {
  proposalId: string;
  success: boolean;
  executedOperations: string[];
  failedOperations: Array<{ operationId: string; error: string }>;
  createdIds: Record<string, string>;
}
