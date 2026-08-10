/**
 * Table Platform API Client
 * Metadata and Records API for the Consultify Table Platform.
 */

import { API_URL, fetchWithRetry, getHeaders, handleResponse } from './baseClient';

const BASE_PATH = `${API_URL}/table-platform`;

// ============================================================================
// METADATA API
// ============================================================================

export async function createBase(workspaceId: string, name?: string): Promise<any> {
  const res = await fetchWithRetry(`${BASE_PATH}/bases`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ workspaceId, name }),
  });
  return handleResponse(res, 'Failed to create base');
}

export async function getBase(baseId: string): Promise<any> {
  const res = await fetchWithRetry(`${BASE_PATH}/bases/${baseId}`, {
    headers: getHeaders(),
  });
  return handleResponse(res, 'Failed to fetch base');
}

export async function listBases(workspaceId: string): Promise<any[]> {
  const res = await fetchWithRetry(`${BASE_PATH}/workspaces/${workspaceId}/bases`, {
    headers: getHeaders(),
  });
  const data = await handleResponse<{ bases?: any[] } | any[]>(res, 'Failed to list bases');
  return Array.isArray(data) ? data : (data?.bases ?? []);
}

export async function createTable(
  baseId: string,
  name: string,
  description?: string
): Promise<any> {
  const res = await fetchWithRetry(`${BASE_PATH}/bases/${baseId}/tables`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ name, description }),
  });
  return handleResponse(res, 'Failed to create table');
}

export async function getTable(tableId: string): Promise<any> {
  const res = await fetchWithRetry(`${BASE_PATH}/tables/${tableId}`, {
    headers: getHeaders(),
  });
  return handleResponse(res, 'Failed to fetch table');
}

export async function updateTable(
  tableId: string,
  updates: { name?: string; description?: string }
): Promise<any> {
  const res = await fetchWithRetry(`${BASE_PATH}/tables/${tableId}`, {
    method: 'PATCH',
    headers: getHeaders(),
    body: JSON.stringify(updates),
  });
  return handleResponse(res, 'Failed to update table');
}

export async function createField(
  tableId: string,
  name: string,
  fieldType: string,
  options?: Record<string, unknown>
): Promise<any> {
  const res = await fetchWithRetry(`${BASE_PATH}/tables/${tableId}/fields`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ name, fieldType, options: options ?? {} }),
  });
  return handleResponse(res, 'Failed to create field');
}

export async function updateField(
  fieldId: string,
  updates: { name?: string; options?: Record<string, unknown> }
): Promise<any> {
  const res = await fetchWithRetry(`${BASE_PATH}/fields/${fieldId}`, {
    method: 'PATCH',
    headers: getHeaders(),
    body: JSON.stringify(updates),
  });
  return handleResponse(res, 'Failed to update field');
}

export async function createView(
  tableId: string,
  name: string,
  viewType?: string,
  config?: Record<string, unknown>
): Promise<any> {
  const res = await fetchWithRetry(`${BASE_PATH}/tables/${tableId}/views`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ name, viewType, config: config ?? {} }),
  });
  return handleResponse(res, 'Failed to create view');
}

export async function updateView(
  viewId: string,
  updates: { name?: string; config?: Record<string, unknown>; visibleFieldIds?: string[] }
): Promise<any> {
  const res = await fetchWithRetry(`${BASE_PATH}/views/${viewId}`, {
    method: 'PATCH',
    headers: getHeaders(),
    body: JSON.stringify(updates),
  });
  return handleResponse(res, 'Failed to update view');
}

// ============================================================================
// RECORDS API
// ============================================================================

export async function listRecords(
  tableId: string,
  options?: {
    viewId?: string;
    pageSize?: number;
    cursor?: string;
    filters?: Array<{ field: string; op: string; value?: unknown }> | Record<string, unknown>;
    sorts?: Array<{ fieldId: string; direction: 'asc' | 'desc' }>;
  }
): Promise<any> {
  const params = new URLSearchParams();
  if (options?.viewId) params.set('viewId', options.viewId);
  if (options?.pageSize) params.set('pageSize', String(options.pageSize));
  if (options?.cursor) params.set('cursor', options.cursor);
  if (options?.filters) params.set('filters', JSON.stringify(options.filters));
  if (options?.sorts) params.set('sorts', JSON.stringify(options.sorts));

  const query = params.toString();
  const url = query
    ? `${BASE_PATH}/tables/${tableId}/records?${query}`
    : `${BASE_PATH}/tables/${tableId}/records`;
  const res = await fetchWithRetry(url, {
    headers: getHeaders(),
  });
  return handleResponse(res, 'Failed to list records');
}

export async function createRecord(tableId: string, data: Record<string, unknown>): Promise<any> {
  const res = await fetchWithRetry(`${BASE_PATH}/tables/${tableId}/records`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ data }),
  });
  return handleResponse(res, 'Failed to create record');
}

export async function getRecord(recordId: string): Promise<any> {
  const res = await fetchWithRetry(`${BASE_PATH}/records/${recordId}`, {
    headers: getHeaders(),
  });
  return handleResponse(res, 'Failed to fetch record');
}

export async function updateRecord(recordId: string, data: Record<string, unknown>): Promise<any> {
  const res = await fetchWithRetry(`${BASE_PATH}/records/${recordId}`, {
    method: 'PATCH',
    headers: getHeaders(),
    body: JSON.stringify({ data }),
  });
  return handleResponse(res, 'Failed to update record');
}

export async function deleteRecord(recordId: string): Promise<void> {
  const res = await fetchWithRetry(`${BASE_PATH}/records/${recordId}`, {
    method: 'DELETE',
    headers: getHeaders(),
  });
  await handleResponse(res, 'Failed to delete record');
}

export async function batchRecords(
  tableId: string,
  operations: Array<{
    type: string;
    recordId?: string;
    data?: Record<string, unknown>;
  }>
): Promise<any> {
  const res = await fetchWithRetry(`${BASE_PATH}/tables/${tableId}/records/batch`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ operations }),
  });
  return handleResponse(res, 'Failed to batch records');
}

// ============================================================================
// ADVANCED QUERY & MUTATIONS
// ============================================================================

/** Advanced query with filters/sorts in body */
export async function queryRecords(
  tableId: string,
  query: {
    filters?: any;
    sorts?: any[];
    groupBy?: string;
    fields?: string[];
    pageSize?: number;
    cursor?: string;
    search?: string;
    viewId?: string;
  }
): Promise<any> {
  const res = await fetchWithRetry(`${BASE_PATH}/tables/${tableId}/records/query`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(query),
  });
  return handleResponse(res, 'Failed to query records');
}

/** Delete field */
export async function deleteField(fieldId: string): Promise<void> {
  const res = await fetchWithRetry(`${BASE_PATH}/fields/${fieldId}`, {
    method: 'DELETE',
    headers: getHeaders(),
  });
  await handleResponse(res, 'Failed to delete field');
}

/** Delete table */
export async function deleteTable(tableId: string): Promise<void> {
  const res = await fetchWithRetry(`${BASE_PATH}/tables/${tableId}`, {
    method: 'DELETE',
    headers: getHeaders(),
  });
  await handleResponse(res, 'Failed to delete table');
}

/** CSV import to existing table */
export async function importCsvToTable(
  tableId: string,
  csvContent: string,
  mapping?: Record<string, string>
): Promise<any> {
  const res = await fetchWithRetry(`${BASE_PATH}/tables/${tableId}/import/csv`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ csvContent, mapping }),
  });
  return handleResponse(res, 'Failed to import CSV');
}

/** CSV import as new table */
export async function importCsvAsNewTable(
  baseId: string,
  csvContent: string,
  tableName?: string
): Promise<any> {
  const res = await fetchWithRetry(`${BASE_PATH}/bases/${baseId}/import/csv`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ csvContent, tableName }),
  });
  return handleResponse(res, 'Failed to import CSV as new table');
}

/** Google Sheets import as new table */
export async function importGoogleSheet(
  baseId: string,
  url: string,
  tableName?: string
): Promise<any> {
  const res = await fetchWithRetry(`${BASE_PATH}/bases/${baseId}/import/google-sheets`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ url, tableName }),
  });
  return handleResponse(res, 'Failed to import Google Sheet');
}

// ============================================================================
// CHAT-TO-SCHEMA (Schema Proposals)
// ============================================================================

/** Chat-to-Schema: generate proposal */
export async function generateSchemaProposal(
  workspaceId: string,
  message: string,
  existingSchema?: any,
  language?: string,
  companyContext?: { workspaceName?: string; moduleName?: string; existingTableNames?: string[] },
  signal?: AbortSignal
): Promise<any> {
  const res = await fetchWithRetry(`${BASE_PATH}/schema/propose`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ workspaceId, message, existingSchema, language, ...companyContext }),
    signal,
  });
  return handleResponse(res, 'Failed to generate schema proposal');
}

/** Chat-to-Schema: execute proposal */
export interface ExecutionResult {
  proposalId?: string;
  executed?: boolean;
  appliedOperationIds?: string[];
  auditId?: string;
  createdIds?: {
    baseId?: string;
    tableIds?: string[];
    fieldIds?: string[];
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export async function executeSchemaProposal(
  proposalId: string,
  options?: string[] | { approvedOperationIds?: string[]; executedBy?: string }
): Promise<ExecutionResult> {
  const body = Array.isArray(options)
    ? { approvedOperationIds: options }
    : {
        approvedOperationIds: options?.approvedOperationIds,
        executedBy: options?.executedBy,
      };
  const res = await fetchWithRetry(`${BASE_PATH}/schema/proposals/${proposalId}/execute`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(body),
  });
  return handleResponse<ExecutionResult>(res, 'Failed to execute schema proposal');
}

/** Chat-to-Schema: reject proposal */
export async function rejectSchemaProposal(proposalId: string, reason?: string): Promise<void> {
  const res = await fetchWithRetry(`${BASE_PATH}/schema/proposals/${proposalId}/reject`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ reason }),
  });
  await handleResponse(res, 'Failed to reject proposal');
}

/** Chat-to-Schema: refine proposal */
export async function refineSchemaProposal(
  proposalId: string,
  refinementMessage: string
): Promise<any> {
  const res = await fetchWithRetry(`${BASE_PATH}/schema/proposals/${proposalId}/refine`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ refinementMessage }),
  });
  return handleResponse(res, 'Failed to refine schema proposal');
}

/** Chat-to-Schema: undo proposal execution */
export async function undoSchemaProposal(proposalId: string): Promise<any> {
  const res = await fetchWithRetry(`${BASE_PATH}/schema/proposals/${proposalId}/undo`, {
    method: 'POST',
    headers: getHeaders(),
  });
  return handleResponse(res, 'Failed to undo schema proposal');
}

/** Chat-to-Schema: redo proposal execution */
export async function redoSchemaProposal(proposalId: string): Promise<any> {
  const res = await fetchWithRetry(`${BASE_PATH}/schema/proposals/${proposalId}/redo`, {
    method: 'POST',
    headers: getHeaders(),
  });
  return handleResponse(res, 'Failed to redo schema proposal');
}

/** Get proposal */
export async function getSchemaProposal(proposalId: string): Promise<any> {
  const res = await fetchWithRetry(`${BASE_PATH}/schema/proposals/${proposalId}`, {
    headers: getHeaders(),
  });
  return handleResponse(res, 'Failed to fetch schema proposal');
}

// ============================================================================
// SCHEMA-GOVERNANCE PROPOSALS — Table Studio Foundation block (Wave 1)
// ----------------------------------------------------------------------------
// These typed clients are added/refined by Sprint 2 / EPIC-1 US-1.7. The
// existing execute/reject call sites remain source-compatible.
// Backend routes are owned by Agent A (Sprint 1 / EPIC-3) — see
// DRD/consultify/docs/product/work-packets/table-studio-foundation/epics/EPIC-3_BACKEND_RELATION_EXPLAINABILITY.md
// for the agreed response shapes.
// ============================================================================

/**
 * Schema-Governance Proposal lifecycle.
 *
 * Backed by `POST /api/table-platform/schema/proposals` and the proposal
 * queue endpoints. All field shapes are intentionally permissive (extra
 * server-added fields preserved via `[key: string]: unknown`) so additive
 * backend changes do not break the frontend.
 */
export interface SchemaProposal {
  id: string;
  workspaceId: string;
  intent: string;
  actor?: string;
  status: 'pending' | 'approved' | 'rejected' | 'executed';
  /** Optional target hints surfaced by Sprint 3 schema preview (US-2.2). */
  targetTableId?: string;
  targetFieldId?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

/**
 * Relation-explain response shape — agreed with Agent A in EPIC-3.
 *
 * The route transport may wrap this object in `{ data }`; the client unwraps
 * that envelope so callers receive the inner shape directly.
 */
export interface RelationExplainResponse {
  relations: Array<{
    targetTableId: string;
    targetRecordId: string;
    targetDisplayName: string;
    fieldId: string;
    fieldName: string;
    reason: string;
    confidence: number;
    evidence: Array<{ kind: 'field_match' | 'temporal' | 'semantic'; ref: string }>;
  }>;
  cacheHit: boolean;
  computedInMs: number;
}

/**
 * Propose a chat-to-schema change. The backend persists a `SchemaProposal`
 * in `pending` status awaiting governance review.
 */
export async function proposeSchemaChange(
  workspaceId: string,
  intent: string,
  options?: { actor?: string; tableId?: string; context?: Record<string, unknown> }
): Promise<SchemaProposal> {
  const res = await fetchWithRetry(`${BASE_PATH}/schema/propose`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      workspaceId,
      message: intent,
      actor: options?.actor,
      tableId: options?.tableId,
      context: options?.context,
    }),
  });
  return handleResponse<SchemaProposal>(res, 'Failed to propose schema change');
}

/**
 * List Schema-Governance proposals for a workspace, optionally filtered by
 * lifecycle status. Returns an empty array when the workspace has none.
 */
export async function listSchemaProposals(
  workspaceId: string,
  status?: 'pending' | 'approved' | 'rejected' | 'executed'
): Promise<SchemaProposal[]> {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  const query = params.toString();
  const url = query
    ? `${BASE_PATH}/workspaces/${workspaceId}/schema/proposals?${query}`
    : `${BASE_PATH}/workspaces/${workspaceId}/schema/proposals`;
  const res = await fetchWithRetry(url, { headers: getHeaders() });
  const data = await handleResponse<{ proposals?: SchemaProposal[] } | SchemaProposal[]>(
    res,
    'Failed to list schema proposals'
  );
  if (Array.isArray(data)) return data;
  return Array.isArray(data?.proposals) ? data.proposals : [];
}

function unwrapDataEnvelope<T>(value: T | { data?: T }): T {
  if (value && typeof value === 'object' && 'data' in value) {
    const wrapped = value as { data?: T };
    if (wrapped.data !== undefined) return wrapped.data;
  }
  return value as T;
}

/**
 * Explain why a record is related to others. Used by Sprint 3 preview to
 * render rationale chips. Failures must be handled by the caller; the
 * Tabele preview pipeline intentionally treats this call as best-effort.
 */
export async function explainRelation(
  tableId: string,
  recordId: string,
  opts?: { max?: number }
): Promise<RelationExplainResponse> {
  const params = new URLSearchParams();
  if (opts?.max) params.set('max', String(opts.max));
  const query = params.toString();
  const url = query
    ? `${BASE_PATH}/tables/${tableId}/records/${recordId}/relations/explain?${query}`
    : `${BASE_PATH}/tables/${tableId}/records/${recordId}/relations/explain`;
  const res = await fetchWithRetry(url, { headers: getHeaders() });
  const data = await handleResponse<RelationExplainResponse | { data?: RelationExplainResponse }>(
    res,
    'Failed to explain relations'
  );
  return unwrapDataEnvelope<RelationExplainResponse>(data);
}

/** Delete view */
export async function deleteView(viewId: string): Promise<void> {
  const res = await fetchWithRetry(`${BASE_PATH}/views/${viewId}`, {
    method: 'DELETE',
    headers: getHeaders(),
  });
  await handleResponse(res, 'Failed to delete view');
}

/** Share a view publicly with optional password and expiration */
export async function shareView(
  viewId: string,
  options?: { password?: string; expiresAt?: string }
): Promise<{ token: string; url: string }> {
  const res = await fetchWithRetry(`${BASE_PATH}/views/${viewId}/share`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(options ?? {}),
  });
  return handleResponse(res, 'Failed to share view');
}

/** Remove public sharing from a view */
export async function unshareView(viewId: string): Promise<void> {
  const res = await fetchWithRetry(`${BASE_PATH}/views/${viewId}/unshare`, {
    method: 'POST',
    headers: getHeaders(),
  });
  await handleResponse(res, 'Failed to unshare view');
}

// ============================================================================
// AUDIT TRAIL
// ============================================================================

/** Fetch audit events for a specific entity */
export async function getAuditTrail(
  entityType: string,
  entityId: string,
  options?: { limit?: number; offset?: number }
): Promise<any> {
  const params = new URLSearchParams();
  if (options?.limit) params.set('limit', String(options.limit));
  if (options?.offset) params.set('offset', String(options.offset));
  const query = params.toString();
  const url = query
    ? `${BASE_PATH}/audit/${entityType}/${entityId}?${query}`
    : `${BASE_PATH}/audit/${entityType}/${entityId}`;
  const res = await fetchWithRetry(url, { headers: getHeaders() });
  return handleResponse(res, 'Failed to fetch audit trail');
}

/** Fetch audit events for a table (includes records and fields) */
export async function getTableAuditTrail(
  tableId: string,
  options?: { limit?: number; offset?: number; eventType?: string }
): Promise<any> {
  const params = new URLSearchParams();
  if (options?.limit) params.set('limit', String(options.limit));
  if (options?.offset) params.set('offset', String(options.offset));
  if (options?.eventType) params.set('eventType', options.eventType);
  const query = params.toString();
  const url = query
    ? `${BASE_PATH}/tables/${tableId}/audit?${query}`
    : `${BASE_PATH}/tables/${tableId}/audit`;
  const res = await fetchWithRetry(url, { headers: getHeaders() });
  return handleResponse(res, 'Failed to fetch table audit trail');
}

// ============================================================================
// BULK OPERATIONS
// ============================================================================

/** Bulk delete records */
export async function bulkDeleteRecords(tableId: string, recordIds: string[]): Promise<any> {
  const res = await fetchWithRetry(`${BASE_PATH}/tables/${tableId}/records/bulk-delete`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ recordIds }),
  });
  return handleResponse(res, 'Failed to bulk delete records');
}

/** Bulk update records */
export async function bulkUpdateRecords(
  tableId: string,
  updates: Array<{ recordId: string; data: Record<string, unknown> }>
): Promise<any> {
  const res = await fetchWithRetry(`${BASE_PATH}/tables/${tableId}/records/bulk-update`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ updates }),
  });
  return handleResponse(res, 'Failed to bulk update records');
}

// ============================================================================
// LINKED RECORDS / RELATIONS
// ============================================================================

/** Link records together */
export async function linkRecords(
  fromRecordId: string,
  fromFieldId: string,
  toRecordIds: string[]
): Promise<any> {
  const res = await fetchWithRetry(`${BASE_PATH}/records/${fromRecordId}/links`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ fromFieldId, toRecordIds }),
  });
  return handleResponse(res, 'Failed to link records');
}

/** Unlink records */
export async function unlinkRecords(
  fromRecordId: string,
  fromFieldId: string,
  toRecordIds: string[]
): Promise<any> {
  const res = await fetchWithRetry(`${BASE_PATH}/records/${fromRecordId}/links`, {
    method: 'DELETE',
    headers: getHeaders(),
    body: JSON.stringify({ fromFieldId, toRecordIds }),
  });
  return handleResponse(res, 'Failed to unlink records');
}

/** Get linked records for a record+field */
export async function getLinkedRecords(recordId: string, fieldId: string): Promise<any> {
  const res = await fetchWithRetry(`${BASE_PATH}/records/${recordId}/links/${fieldId}`, {
    headers: getHeaders(),
  });
  return handleResponse(res, 'Failed to fetch linked records');
}

// ============================================================================
// ATTACHMENTS
// ============================================================================

/** Create an attachment metadata record */
export async function createAttachment(
  recordId: string,
  fieldId: string,
  fileName: string,
  mimeType: string,
  sizeBytes: number,
  storageKey: string
): Promise<any> {
  const res = await fetchWithRetry(`${BASE_PATH}/records/${recordId}/attachments`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      fieldId,
      fileName,
      mimeType,
      sizeBytes,
      storageKey,
    }),
  });
  return handleResponse(res, 'Failed to create attachment');
}

/** Upload a real file (multipart) as an attachment for a record+field */
export async function uploadAttachment(
  recordId: string,
  fieldId: string,
  file: File
): Promise<any> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetchWithRetry(
    `${BASE_PATH}/records/${recordId}/fields/${fieldId}/attachments`,
    {
      method: 'POST',
      skipDefaultHeaders: true,
      headers: { Authorization: getHeaders()['Authorization'] },
      body: formData,
    }
  );
  return handleResponse(res, 'Failed to upload attachment');
}

/** List attachments for a record, optionally filtered by field */
export async function getAttachments(recordId: string, fieldId?: string): Promise<any[]> {
  const params = new URLSearchParams();
  if (fieldId) params.set('fieldId', fieldId);
  const query = params.toString();
  const url = query
    ? `${BASE_PATH}/records/${recordId}/attachments?${query}`
    : `${BASE_PATH}/records/${recordId}/attachments`;
  const res = await fetchWithRetry(url, { headers: getHeaders() });
  const data = await handleResponse<any[]>(res, 'Failed to fetch attachments');
  return Array.isArray(data) ? data : [];
}

/** Delete an attachment */
export async function deleteAttachment(attachmentId: string): Promise<void> {
  const res = await fetchWithRetry(`${BASE_PATH}/attachments/${attachmentId}`, {
    method: 'DELETE',
    headers: getHeaders(),
  });
  await handleResponse(res, 'Failed to delete attachment');
}

// ============================================================================
// GLOBAL SEARCH
// ============================================================================

/** Search across all tables in the organization */
export async function searchRecordsGlobal(query: string, limit?: number): Promise<any> {
  const params = new URLSearchParams({ q: query });
  if (limit) params.set('limit', String(limit));
  const res = await fetchWithRetry(`${BASE_PATH}/search?${params}`, {
    headers: getHeaders(),
  });
  return handleResponse(res, 'Failed to search records globally');
}

// ============================================================================
// SEARCH RECORDS
// ============================================================================

/** Search records in a table by query string */
export async function searchRecords(
  tableId: string,
  query: string,
  options?: { pageSize?: number; fields?: string[] }
): Promise<any> {
  const res = await fetchWithRetry(`${BASE_PATH}/tables/${tableId}/records/query`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      search: query,
      pageSize: options?.pageSize ?? 50,
      fields: options?.fields,
    }),
  });
  return handleResponse(res, 'Failed to search records');
}

// ============================================================================
// FORMULA VALIDATION
// ============================================================================

/** Validate a formula expression for a table */
export async function validateFormula(tableId: string, expression: string): Promise<any> {
  const res = await fetchWithRetry(`${BASE_PATH}/tables/${tableId}/validate-formula`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ expression }),
  });
  return handleResponse(res, 'Failed to validate formula');
}

/** Get formula preview (computed value for first record) */
export async function previewFormula(
  tableId: string,
  expression: string,
  recordId?: string
): Promise<any> {
  const res = await fetchWithRetry(`${BASE_PATH}/tables/${tableId}/preview-formula`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ expression, recordId }),
  });
  return handleResponse(res, 'Failed to preview formula');
}

// ============================================================================
// FORMS API
// ============================================================================

export async function createForm(
  tableId: string,
  data: { name: string; description?: string; slug?: string; config?: any }
): Promise<any> {
  const res = await fetchWithRetry(`${BASE_PATH}/tables/${tableId}/forms`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(data),
  });
  return handleResponse(res, 'Failed to create form');
}

export async function listForms(tableId: string): Promise<any[]> {
  const res = await fetchWithRetry(`${BASE_PATH}/tables/${tableId}/forms`, {
    headers: getHeaders(),
  });
  return handleResponse(res, 'Failed to list forms');
}

export async function getForm(formId: string): Promise<any> {
  const res = await fetchWithRetry(`${BASE_PATH}/forms/${formId}`, {
    headers: getHeaders(),
  });
  return handleResponse(res, 'Failed to fetch form');
}

export async function updateForm(
  formId: string,
  data: { name?: string; description?: string; slug?: string; is_published?: boolean; config?: any }
): Promise<any> {
  const res = await fetchWithRetry(`${BASE_PATH}/forms/${formId}`, {
    method: 'PATCH',
    headers: getHeaders(),
    body: JSON.stringify(data),
  });
  return handleResponse(res, 'Failed to update form');
}

export async function deleteForm(formId: string): Promise<void> {
  const res = await fetchWithRetry(`${BASE_PATH}/forms/${formId}`, {
    method: 'DELETE',
    headers: getHeaders(),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as any).error || 'Failed to delete form');
  }
}

export async function getFormSubmissions(
  formId: string,
  opts?: { limit?: number; offset?: number }
): Promise<{ records: any[]; total: number }> {
  const params = new URLSearchParams();
  if (opts?.limit) params.set('limit', String(opts.limit));
  if (opts?.offset) params.set('offset', String(opts.offset));
  const qs = params.toString();
  const res = await fetchWithRetry(
    `${BASE_PATH}/forms/${formId}/submissions${qs ? `?${qs}` : ''}`,
    {
      headers: getHeaders(),
    }
  );
  return handleResponse(res, 'Failed to fetch form submissions');
}

// ============================================================================
// RECORD UNDO
// ============================================================================

export async function undoRecordEdit(tableId: string): Promise<any> {
  const res = await fetchWithRetry(`${BASE_PATH}/tables/${tableId}/undo`, {
    method: 'POST',
    headers: getHeaders(),
  });
  return handleResponse(res, 'Failed to undo record edit');
}

// ============================================================================
// RECORD COMMENTS
// ============================================================================

export async function addRecordComment(
  recordId: string,
  tableId: string,
  content: string,
  authorName?: string,
  parentId?: string,
  mentions?: string[]
): Promise<any> {
  const res = await fetchWithRetry(`${BASE_PATH}/records/${recordId}/comments`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ tableId, content, authorName, parentId, mentions }),
  });
  return handleResponse(res, 'Failed to add comment');
}

export async function listRecordComments(
  recordId: string,
  options?: { limit?: number; offset?: number }
): Promise<any> {
  const params = new URLSearchParams();
  if (options?.limit) params.set('limit', String(options.limit));
  if (options?.offset) params.set('offset', String(options.offset));
  const query = params.toString();
  const url = query
    ? `${BASE_PATH}/records/${recordId}/comments?${query}`
    : `${BASE_PATH}/records/${recordId}/comments`;
  const res = await fetchWithRetry(url, { headers: getHeaders() });
  return handleResponse(res, 'Failed to list comments');
}

export async function updateRecordComment(commentId: string, content: string): Promise<any> {
  const res = await fetchWithRetry(`${BASE_PATH}/comments/${commentId}`, {
    method: 'PATCH',
    headers: getHeaders(),
    body: JSON.stringify({ content }),
  });
  return handleResponse(res, 'Failed to update comment');
}

export async function deleteRecordComment(commentId: string): Promise<void> {
  const res = await fetchWithRetry(`${BASE_PATH}/comments/${commentId}`, {
    method: 'DELETE',
    headers: getHeaders(),
  });
  await handleResponse(res, 'Failed to delete comment');
}

// ============================================================================
// RECORD WATCHES
// ============================================================================

export async function toggleRecordWatch(
  recordId: string,
  tableId: string
): Promise<{ watching: boolean }> {
  const res = await fetchWithRetry(`${BASE_PATH}/records/${recordId}/watch`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ tableId }),
  });
  return handleResponse(res, 'Failed to toggle watch');
}

export async function getRecordWatchers(recordId: string): Promise<any[]> {
  const res = await fetchWithRetry(`${BASE_PATH}/records/${recordId}/watchers`, {
    headers: getHeaders(),
  });
  return handleResponse(res, 'Failed to fetch watchers');
}

// ============================================================================
// TEMPLATES MARKETPLACE
// ============================================================================

export async function listTemplates(category?: string): Promise<any[]> {
  const params = new URLSearchParams();
  if (category) params.set('category', category);
  const query = params.toString();
  const url = query ? `${BASE_PATH}/templates?${query}` : `${BASE_PATH}/templates`;
  const res = await fetchWithRetry(url, { headers: getHeaders() });
  return handleResponse(res, 'Failed to list templates');
}

export async function getTemplate(templateId: string): Promise<any> {
  const res = await fetchWithRetry(`${BASE_PATH}/templates/${templateId}`, {
    headers: getHeaders(),
  });
  return handleResponse(res, 'Failed to fetch template');
}

export async function useTemplate(
  templateId: string,
  workspaceId: string,
  name?: string
): Promise<any> {
  const res = await fetchWithRetry(`${BASE_PATH}/templates/${templateId}/use`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ workspaceId, name }),
  });
  return handleResponse(res, 'Failed to use template');
}

export async function publishTemplate(
  baseId: string,
  data: { name: string; description?: string; category: string }
): Promise<any> {
  const res = await fetchWithRetry(`${BASE_PATH}/bases/${baseId}/publish-template`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(data),
  });
  return handleResponse(res, 'Failed to publish template');
}

// ============================================================================
// SHARED VIEW PUBLIC ACCESS
// ============================================================================

export async function getSharedViewData(token: string, password?: string): Promise<any> {
  const headers: Record<string, string> = {};
  if (password) headers['x-share-password'] = password;
  const res = await fetch(`${BASE_PATH}/public/views/${encodeURIComponent(token)}`, { headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err: any = new Error((body as any).error || 'Shared view not found');
    err.code = (body as any).code;
    err.hasPassword = (body as any).hasPassword;
    throw err;
  }
  return res.json();
}

export async function getSharedViewRecords(
  token: string,
  options?: { pageSize?: number; cursor?: string; password?: string }
): Promise<any> {
  const params = new URLSearchParams();
  if (options?.pageSize) params.set('pageSize', String(options.pageSize));
  if (options?.cursor) params.set('cursor', options.cursor);
  const query = params.toString();
  const url = query
    ? `${BASE_PATH}/public/views/${encodeURIComponent(token)}/records?${query}`
    : `${BASE_PATH}/public/views/${encodeURIComponent(token)}/records`;
  const headers: Record<string, string> = {};
  if (options?.password) headers['x-share-password'] = options.password;
  const res = await fetch(url, { headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err: any = new Error((body as any).error || 'Failed to fetch shared view records');
    err.code = (body as any).code;
    err.hasPassword = (body as any).hasPassword;
    throw err;
  }
  return res.json();
}

// ============================================================================
// PUBLIC FORMS
// ============================================================================

export async function getPublicForm(slug: string): Promise<any> {
  const res = await fetch(`${BASE_PATH}/public/forms/${encodeURIComponent(slug)}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as any).error || 'Form not found');
  }
  return res.json();
}

export async function submitPublicForm(
  slug: string,
  data: Record<string, unknown>
): Promise<{ recordId: string }> {
  const res = await fetch(`${BASE_PATH}/public/forms/${encodeURIComponent(slug)}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as any).error || 'Submission failed');
  }
  return res.json();
}

// ============================================================================
// WEBHOOK RELAYS (Zapier/Make)
// ============================================================================

export async function createWebhookRelay(
  baseId: string,
  config: { name: string; targetUrl: string; secret?: string; eventTypes?: string[] }
): Promise<any> {
  const res = await fetchWithRetry(`${BASE_PATH}/bases/${baseId}/relays`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(config),
  });
  return handleResponse(res, 'Failed to create webhook relay');
}

export async function listWebhookRelays(baseId: string): Promise<any> {
  const res = await fetchWithRetry(`${BASE_PATH}/bases/${baseId}/relays`, {
    headers: getHeaders(),
  });
  return handleResponse(res, 'Failed to list webhook relays');
}

export async function updateWebhookRelay(
  relayId: string,
  updates: {
    name?: string;
    targetUrl?: string;
    secret?: string;
    eventTypes?: string[];
    isActive?: boolean;
  }
): Promise<any> {
  const res = await fetchWithRetry(`${BASE_PATH}/relays/${relayId}`, {
    method: 'PATCH',
    headers: getHeaders(),
    body: JSON.stringify(updates),
  });
  return handleResponse(res, 'Failed to update webhook relay');
}

export async function deleteWebhookRelay(relayId: string): Promise<void> {
  const res = await fetchWithRetry(`${BASE_PATH}/relays/${relayId}`, {
    method: 'DELETE',
    headers: getHeaders(),
  });
  await handleResponse(res, 'Failed to delete webhook relay');
}

export async function testWebhookRelay(
  relayId: string
): Promise<{ success: boolean; statusCode?: number; error?: string }> {
  const res = await fetchWithRetry(`${BASE_PATH}/relays/${relayId}/test`, {
    method: 'POST',
    headers: getHeaders(),
  });
  return handleResponse(res, 'Failed to test webhook relay');
}

// ============================================================================
// DISTRIBUTIONS API
// ============================================================================

export async function createDistribution(
  baseId: string,
  config: {
    name: string;
    sourceType: string;
    sourceId: string;
    channel: string;
    channelConfig?: Record<string, unknown>;
    schedule?: string;
    format?: string;
  }
): Promise<any> {
  const res = await fetchWithRetry(`${BASE_PATH}/bases/${baseId}/distributions`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(config),
  });
  return handleResponse(res, 'Failed to create distribution');
}

export async function listDistributions(baseId: string): Promise<any[]> {
  const res = await fetchWithRetry(`${BASE_PATH}/bases/${baseId}/distributions`, {
    headers: getHeaders(),
  });
  return handleResponse(res, 'Failed to list distributions');
}

export async function getDistribution(distributionId: string): Promise<any> {
  const res = await fetchWithRetry(`${BASE_PATH}/distributions/${distributionId}`, {
    headers: getHeaders(),
  });
  return handleResponse(res, 'Failed to fetch distribution');
}

export async function updateDistribution(
  distributionId: string,
  updates: Record<string, unknown>
): Promise<any> {
  const res = await fetchWithRetry(`${BASE_PATH}/distributions/${distributionId}`, {
    method: 'PATCH',
    headers: getHeaders(),
    body: JSON.stringify(updates),
  });
  return handleResponse(res, 'Failed to update distribution');
}

export async function deleteDistribution(distributionId: string): Promise<void> {
  const res = await fetchWithRetry(`${BASE_PATH}/distributions/${distributionId}`, {
    method: 'DELETE',
    headers: getHeaders(),
  });
  await handleResponse(res, 'Failed to delete distribution');
}

export async function toggleDistribution(distributionId: string): Promise<any> {
  const res = await fetchWithRetry(`${BASE_PATH}/distributions/${distributionId}/toggle`, {
    method: 'POST',
    headers: getHeaders(),
  });
  return handleResponse(res, 'Failed to toggle distribution');
}

export async function executeDistribution(distributionId: string): Promise<any> {
  const res = await fetchWithRetry(`${BASE_PATH}/distributions/${distributionId}/execute`, {
    method: 'POST',
    headers: getHeaders(),
  });
  return handleResponse(res, 'Failed to execute distribution');
}

// ============================================================================
// GOVERNED MODELS API
// ============================================================================

export async function listGovernedModels(baseId: string): Promise<any[]> {
  const res = await fetchWithRetry(`${BASE_PATH}/bases/${baseId}/governed-models`, {
    headers: getHeaders(),
  });
  return handleResponse(res, 'Failed to list governed models');
}

export async function getGovernedModel(modelId: string): Promise<any> {
  const res = await fetchWithRetry(`${BASE_PATH}/governed-models/${modelId}`, {
    headers: getHeaders(),
  });
  return handleResponse(res, 'Failed to fetch governed model');
}

export async function createGovernedModel(
  baseId: string,
  data: { name: string; description?: string }
): Promise<any> {
  const res = await fetchWithRetry(`${BASE_PATH}/bases/${baseId}/governed-models`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(data),
  });
  return handleResponse(res, 'Failed to create governed model');
}

export async function updateGovernedModel(
  modelId: string,
  updates: { name?: string; description?: string; status?: string }
): Promise<any> {
  const res = await fetchWithRetry(`${BASE_PATH}/governed-models/${modelId}`, {
    method: 'PATCH',
    headers: getHeaders(),
    body: JSON.stringify(updates),
  });
  return handleResponse(res, 'Failed to update governed model');
}

export async function deleteGovernedModel(modelId: string): Promise<void> {
  const res = await fetchWithRetry(`${BASE_PATH}/governed-models/${modelId}`, {
    method: 'DELETE',
    headers: getHeaders(),
  });
  await handleResponse(res, 'Failed to delete governed model');
}

export async function addModelKpi(
  modelId: string,
  kpi: {
    code: string;
    labelEn: string;
    labelPl?: string;
    formulaType: string;
    formulaConfig?: Record<string, unknown>;
    sourceTableId?: string;
    sourceFieldId?: string;
    unit?: string;
    format?: string;
  }
): Promise<any> {
  const res = await fetchWithRetry(`${BASE_PATH}/governed-models/${modelId}/kpis`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(kpi),
  });
  return handleResponse(res, 'Failed to add KPI');
}

export async function listModelKpis(modelId: string): Promise<any[]> {
  const res = await fetchWithRetry(`${BASE_PATH}/governed-models/${modelId}/kpis`, {
    headers: getHeaders(),
  });
  return handleResponse(res, 'Failed to list KPIs');
}

export async function removeModelKpi(kpiId: string): Promise<void> {
  const res = await fetchWithRetry(`${BASE_PATH}/kpis/${kpiId}`, {
    method: 'DELETE',
    headers: getHeaders(),
  });
  await handleResponse(res, 'Failed to remove KPI');
}

export async function computeKpi(
  kpiId: string
): Promise<{ kpiId: string; value: number | null; computedAt: string }> {
  const res = await fetchWithRetry(`${BASE_PATH}/kpis/${kpiId}/compute`, {
    method: 'POST',
    headers: getHeaders(),
  });
  return handleResponse(res, 'Failed to compute KPI');
}

export async function addModelDimension(
  modelId: string,
  dim: { name: string; sourceTableId?: string; sourceFieldId?: string; dimensionType?: string }
): Promise<any> {
  const res = await fetchWithRetry(`${BASE_PATH}/governed-models/${modelId}/dimensions`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(dim),
  });
  return handleResponse(res, 'Failed to add dimension');
}

export async function listModelDimensions(modelId: string): Promise<any[]> {
  const res = await fetchWithRetry(`${BASE_PATH}/governed-models/${modelId}/dimensions`, {
    headers: getHeaders(),
  });
  return handleResponse(res, 'Failed to list dimensions');
}

export async function removeModelDimension(dimensionId: string): Promise<void> {
  const res = await fetchWithRetry(`${BASE_PATH}/dimensions/${dimensionId}`, {
    method: 'DELETE',
    headers: getHeaders(),
  });
  await handleResponse(res, 'Failed to remove dimension');
}

export async function addModelSource(
  modelId: string,
  data: { tableId: string; trusted?: boolean; requiredProvenance?: string }
): Promise<any> {
  const res = await fetchWithRetry(`${BASE_PATH}/governed-models/${modelId}/sources`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(data),
  });
  return handleResponse(res, 'Failed to add model source');
}

export async function listModelSources(modelId: string): Promise<any[]> {
  const res = await fetchWithRetry(`${BASE_PATH}/governed-models/${modelId}/sources`, {
    headers: getHeaders(),
  });
  return handleResponse(res, 'Failed to list model sources');
}

// ============================================================================
// MODULE LINKAGE API (Consultify Integration)
// ============================================================================

export async function publishToResults(
  modelId: string,
  mapping: { kpiIds: string[]; targetModule?: string }
): Promise<{ success: boolean; syncedRecords: number; message: string }> {
  const res = await fetchWithRetry(`${BASE_PATH}/governed-models/${modelId}/publish-to-results`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(mapping),
  });
  return handleResponse(res, 'Failed to publish to Results');
}

export async function syncToFinance(
  modelId: string,
  mapping: { fieldMappings: Record<string, string>; tableId: string }
): Promise<{ success: boolean; syncedRecords: number; message: string }> {
  const res = await fetchWithRetry(`${BASE_PATH}/governed-models/${modelId}/sync-to-finance`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(mapping),
  });
  return handleResponse(res, 'Failed to sync to Finance');
}

export async function syncToExecution(
  modelId: string,
  mapping: { fieldMappings: Record<string, string>; tableId: string }
): Promise<{ success: boolean; syncedRecords: number; message: string }> {
  const res = await fetchWithRetry(`${BASE_PATH}/governed-models/${modelId}/sync-to-execution`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(mapping),
  });
  return handleResponse(res, 'Failed to sync to Execution');
}

export async function syncToInitiatives(
  modelId: string,
  mapping: { fieldMappings: Record<string, string>; tableId: string }
): Promise<{ success: boolean; syncedRecords: number; message: string }> {
  const res = await fetchWithRetry(`${BASE_PATH}/governed-models/${modelId}/sync-to-initiatives`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(mapping),
  });
  return handleResponse(res, 'Failed to sync to Initiatives');
}

export async function getModuleLinkStatus(modelId: string): Promise<{
  results: { linked: boolean; lastSync?: string; recordCount: number; errors: string[] } | null;
  finance: { linked: boolean; lastSync?: string; recordCount: number; errors: string[] } | null;
  execution: { linked: boolean; lastSync?: string; recordCount: number; errors: string[] } | null;
  initiatives: { linked: boolean; lastSync?: string; recordCount: number; errors: string[] } | null;
}> {
  const res = await fetchWithRetry(`${BASE_PATH}/governed-models/${modelId}/link-status`, {
    headers: getHeaders(),
  });
  return handleResponse(res, 'Failed to fetch module link status');
}

// ============================================================================
// AUTOMATIONS API
// ============================================================================

export async function createAutomation(
  tableId: string,
  data: {
    name: string;
    description?: string;
    triggerType: string;
    triggerConfig: Record<string, unknown>;
    actions: Array<{ actionType: string; actionConfig: Record<string, unknown> }>;
  }
): Promise<any> {
  const res = await fetchWithRetry(`${BASE_PATH}/tables/${tableId}/automations`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(data),
  });
  return handleResponse(res, 'Failed to create automation');
}

export async function listAutomations(tableId: string): Promise<any[]> {
  const res = await fetchWithRetry(`${BASE_PATH}/tables/${tableId}/automations`, {
    headers: getHeaders(),
  });
  return handleResponse(res, 'Failed to list automations');
}

export async function toggleAutomation(automationId: string, enabled: boolean): Promise<void> {
  const res = await fetchWithRetry(`${BASE_PATH}/automations/${automationId}/toggle`, {
    method: 'PATCH',
    headers: getHeaders(),
    body: JSON.stringify({ enabled }),
  });
  await handleResponse(res, 'Failed to toggle automation');
}

export async function deleteAutomation(automationId: string): Promise<void> {
  const res = await fetchWithRetry(`${BASE_PATH}/automations/${automationId}`, {
    method: 'DELETE',
    headers: getHeaders(),
  });
  await handleResponse(res, 'Failed to delete automation');
}

export async function getAutomationRuns(automationId: string, limit = 20): Promise<any[]> {
  const res = await fetchWithRetry(`${BASE_PATH}/automations/${automationId}/runs?limit=${limit}`, {
    headers: getHeaders(),
  });
  return handleResponse(res, 'Failed to fetch automation runs');
}

export async function runAutomationNow(automationId: string): Promise<any> {
  const res = await fetchWithRetry(`${BASE_PATH}/automations/${automationId}/run-now`, {
    method: 'POST',
    headers: getHeaders(),
  });
  return handleResponse(res, 'Failed to run automation');
}

// ============================================================================
// TABLE SYNC API
// ============================================================================

export async function createTableSync(
  sourceTableId: string,
  targetTableId: string,
  fieldMapping: Record<string, string>,
  syncMode?: 'one_way' | 'two_way',
  filterConfig?: { fieldId: string; operator: string; value: string }
): Promise<any> {
  const res = await fetchWithRetry(`${BASE_PATH}/tables/${sourceTableId}/syncs`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ targetTableId, fieldMapping, syncMode, filterConfig }),
  });
  return handleResponse(res, 'Failed to create sync');
}

export async function listTableSyncs(tableId: string): Promise<any[]> {
  const res = await fetchWithRetry(`${BASE_PATH}/tables/${tableId}/syncs`, {
    headers: getHeaders(),
  });
  return handleResponse(res, 'Failed to list syncs');
}

export async function deleteTableSync(syncId: string): Promise<void> {
  const res = await fetchWithRetry(`${BASE_PATH}/syncs/${syncId}`, {
    method: 'DELETE',
    headers: getHeaders(),
  });
  await handleResponse(res, 'Failed to delete sync');
}

export async function executeTableSync(syncId: string): Promise<any> {
  const res = await fetchWithRetry(`${BASE_PATH}/syncs/${syncId}/execute`, {
    method: 'POST',
    headers: getHeaders(),
  });
  return handleResponse(res, 'Failed to execute sync');
}

// ============================================================================
// SHARING / PERMISSIONS API
// ============================================================================

export async function listBaseCollaborators(baseId: string): Promise<any[]> {
  const res = await fetchWithRetry(`${BASE_PATH}/bases/${baseId}/collaborators`, {
    headers: getHeaders(),
  });
  return handleResponse(res, 'Failed to list collaborators');
}

export async function inviteCollaborator(
  baseId: string,
  email: string,
  role: string
): Promise<any> {
  const res = await fetchWithRetry(`${BASE_PATH}/bases/${baseId}/collaborators`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ email, role }),
  });
  return handleResponse(res, 'Failed to invite collaborator');
}

export async function updateCollaboratorRole(
  baseId: string,
  userId: string,
  role: string
): Promise<any> {
  const res = await fetchWithRetry(`${BASE_PATH}/bases/${baseId}/collaborators/${userId}`, {
    method: 'PATCH',
    headers: getHeaders(),
    body: JSON.stringify({ role }),
  });
  return handleResponse(res, 'Failed to update collaborator role');
}

export async function removeCollaborator(baseId: string, userId: string): Promise<void> {
  const res = await fetchWithRetry(`${BASE_PATH}/bases/${baseId}/collaborators/${userId}`, {
    method: 'DELETE',
    headers: getHeaders(),
  });
  await handleResponse(res, 'Failed to remove collaborator');
}

// ============================================================================
// DATE DEPENDENCIES
// ============================================================================

export interface DateDependencyConfigPayload {
  startDateFieldId: string;
  endDateFieldId: string;
  durationFieldId?: string;
  predecessorFieldId?: string;
  dependencyTypeFieldId?: string;
  lagFieldId?: string;
  defaultDependencyType: 'FS' | 'SS' | 'FF' | 'SF';
  defaultLagDays: number;
  skipWeekends: boolean;
}

/** Get date dependency config for a table */
export async function getDependencyConfig(
  tableId: string
): Promise<{ config: DateDependencyConfigPayload | null }> {
  const res = await fetchWithRetry(`${BASE_PATH}/tables/${tableId}/dependency-config`, {
    headers: getHeaders(),
  });
  return handleResponse(res, 'Failed to fetch dependency config');
}

/** Save date dependency config for a table */
export async function putDependencyConfig(
  tableId: string,
  config: DateDependencyConfigPayload | null
): Promise<{ success: boolean; config: DateDependencyConfigPayload | null }> {
  const res = await fetchWithRetry(`${BASE_PATH}/tables/${tableId}/dependency-config`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify({ config }),
  });
  return handleResponse(res, 'Failed to save dependency config');
}

/** Recalculate date dependencies for a table */
export async function recalculateDateDependencies(
  tableId: string,
  config: DateDependencyConfigPayload
): Promise<{ success: boolean; updatedRecords: number }> {
  const res = await fetchWithRetry(`${BASE_PATH}/tables/${tableId}/date-dependencies/recalculate`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ config: { ...config, tableId } }),
  });
  return handleResponse(res, 'Failed to recalculate date dependencies');
}

/** Detect circular dependencies in date predecessor links */
export async function detectDateDependencyCycle(
  tableId: string,
  config: DateDependencyConfigPayload
): Promise<{ hasCycle: boolean; cycleNodes: string[] | null }> {
  const res = await fetchWithRetry(
    `${BASE_PATH}/tables/${tableId}/date-dependencies/detect-cycle`,
    {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ config: { ...config, tableId } }),
    }
  );
  return handleResponse(res, 'Failed to detect date dependency cycle');
}

// ============================================================================
// FIELD REORDER
// ============================================================================

export async function reorderFields(tableId: string, fieldIds: string[]): Promise<any> {
  const res = await fetchWithRetry(`${BASE_PATH}/tables/${tableId}/fields/reorder`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ fieldIds }),
  });
  return handleResponse(res, 'Failed to reorder fields');
}

// ============================================================================
// RECORD TEMPLATES
// ============================================================================

export async function listRecordTemplates(tableId: string): Promise<any> {
  const res = await fetchWithRetry(`${BASE_PATH}/tables/${tableId}/record-templates`, {
    headers: getHeaders(),
  });
  return handleResponse(res, 'Failed to list record templates');
}

export async function createRecordTemplate(
  tableId: string,
  name: string,
  data: Record<string, unknown>
): Promise<any> {
  const res = await fetchWithRetry(`${BASE_PATH}/tables/${tableId}/record-templates`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ name, data }),
  });
  return handleResponse(res, 'Failed to create record template');
}

export async function updateRecordTemplate(
  templateId: string,
  updates: { name?: string; data?: Record<string, unknown> }
): Promise<any> {
  const res = await fetchWithRetry(`${BASE_PATH}/record-templates/${templateId}`, {
    method: 'PATCH',
    headers: getHeaders(),
    body: JSON.stringify(updates),
  });
  return handleResponse(res, 'Failed to update record template');
}

export async function deleteRecordTemplate(templateId: string): Promise<void> {
  const res = await fetchWithRetry(`${BASE_PATH}/record-templates/${templateId}`, {
    method: 'DELETE',
    headers: getHeaders(),
  });
  await handleResponse(res, 'Failed to delete record template');
}

export async function getBaseShareSettings(baseId: string): Promise<any> {
  const res = await fetchWithRetry(`${BASE_PATH}/bases/${baseId}/share-settings`, {
    headers: getHeaders(),
  });
  return handleResponse(res, 'Failed to fetch share settings');
}

export async function updateBaseShareSettings(
  baseId: string,
  settings: { publicAccess?: boolean; publicRole?: string }
): Promise<any> {
  const res = await fetchWithRetry(`${BASE_PATH}/bases/${baseId}/share-settings`, {
    method: 'PATCH',
    headers: getHeaders(),
    body: JSON.stringify(settings),
  });
  return handleResponse(res, 'Failed to update share settings');
}

// ============================================================================
// AI EDITOR API (Block C · EPIC-T10 · Sprint C-S5 frontend client)
// ============================================================================

export type AiEditorLevel =
  | 'cell'
  | 'record'
  | 'column'
  | 'structure'
  | 'view'
  | 'relational'
  | 'methodological'
  | 'source';

export interface AiEditorProposeInput {
  level: AiEditorLevel;
  prompt: string;
  context?: Record<string, unknown>;
  estimatedTokensInput?: number;
  estimatedTokensOutput?: number;
  model?: string;
}

export interface AiEditorProposeResponse {
  proposalId: string;
  level: AiEditorLevel;
  softWarn: boolean;
  handlerStatus: 'stub' | 'live';
}

export interface AiBudgetSnapshot {
  workspaceId: string;
  budget: number;
  tokensUsedToday: number;
  lastResetAt: string;
  remaining: number;
  softWarnThreshold: number;
  softWarnTripped: boolean;
}

export async function proposeAiEdit(
  tableId: string,
  payload: AiEditorProposeInput
): Promise<AiEditorProposeResponse> {
  const res = await fetchWithRetry(
    `${BASE_PATH}/tables/${encodeURIComponent(tableId)}/ai-editor/propose`,
    {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    }
  );
  const data = await handleResponse<AiEditorProposeResponse | { data: AiEditorProposeResponse }>(
    res,
    'Failed to propose AI edit'
  );
  return unwrapDataEnvelope<AiEditorProposeResponse>(data);
}

export async function applyAiProposal(
  proposalId: string,
  workspaceId: string,
  options?: { idempotent?: boolean }
): Promise<{ proposalId: string; applied: boolean; reason?: string }> {
  const res = await fetchWithRetry(
    `${BASE_PATH}/ai-editor/proposals/${encodeURIComponent(proposalId)}/apply`,
    {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ workspaceId, idempotent: options?.idempotent ?? false }),
    }
  );
  const data = await handleResponse<any>(res, 'Failed to apply proposal');
  return unwrapDataEnvelope(data);
}

export async function rejectAiProposal(
  proposalId: string,
  workspaceId: string,
  note?: string
): Promise<{ proposalId: string; rejected: true }> {
  const res = await fetchWithRetry(
    `${BASE_PATH}/ai-editor/proposals/${encodeURIComponent(proposalId)}/reject`,
    {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ workspaceId, note }),
    }
  );
  const data = await handleResponse<any>(res, 'Failed to reject proposal');
  return unwrapDataEnvelope(data);
}

export async function getAiBudget(workspaceId: string): Promise<AiBudgetSnapshot> {
  const res = await fetchWithRetry(
    `${BASE_PATH}/ai-editor/budget?workspaceId=${encodeURIComponent(workspaceId)}`,
    { headers: getHeaders() }
  );
  const data = await handleResponse<any>(res, 'Failed to fetch AI budget');
  return unwrapDataEnvelope<AiBudgetSnapshot>(data);
}

// ============================================================================
// QA ENGINE API (Block C · EPIC-T11 · Sprint C-S5 frontend client)
// ============================================================================

export type QaTriggerKind = 'on_demand' | 'scheduled' | 'record_write';

export type QaAxisName =
  | 'completeness'
  | 'freshness'
  | 'sourceCoverage'
  | 'methodology'
  | 'formulaConsistency';

export type QaBand = 'red' | 'amber' | 'green';

export interface QaAxisDetail {
  score: number;
  band: QaBand;
  details: Array<{ metric: string; value: unknown }>;
}

export interface QaSuggestion {
  id: string;
  fingerprint: string;
  axis: QaAxisName;
  description: string;
  recommendedAction: {
    kind: 'open_ai_editor';
    level: AiEditorLevel;
    payload: Record<string, unknown>;
  };
  severity: 'low' | 'medium' | 'high';
}

export interface QaReport {
  id: string;
  tableId: string;
  organizationId: string;
  workspaceId: string;
  computedAt: string;
  computedBy: string;
  triggerKind: QaTriggerKind | 'migration';
  overallScore: number;
  axes: Record<QaAxisName, QaAxisDetail>;
  suggestions: QaSuggestion[];
  computationMs?: number;
}

export async function recomputeQaReport(
  tableId: string,
  triggerKind: QaTriggerKind = 'on_demand'
): Promise<QaReport> {
  const res = await fetchWithRetry(
    `${BASE_PATH}/tables/${encodeURIComponent(tableId)}/qa/recompute`,
    {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ triggerKind }),
    }
  );
  const data = await handleResponse<any>(res, 'Failed to recompute QA report');
  return unwrapDataEnvelope<QaReport>(data);
}

export async function getLatestQaReport(tableId: string): Promise<QaReport | null> {
  const res = await fetchWithRetry(`${BASE_PATH}/tables/${encodeURIComponent(tableId)}/qa/latest`, {
    headers: getHeaders(),
  });
  if (res.status === 204) return null;
  const data = await handleResponse<any>(res, 'Failed to fetch QA report');
  return unwrapDataEnvelope<QaReport>(data);
}

export async function dismissQaSuggestion(
  tableId: string,
  suggestionId: string,
  fingerprint: string,
  reason?: string
): Promise<{ tableId: string; fingerprint: string; dismissed: true }> {
  const res = await fetchWithRetry(
    `${BASE_PATH}/tables/${encodeURIComponent(tableId)}/qa/suggestions/${encodeURIComponent(suggestionId)}/inapplicable`,
    {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ fingerprint, reason }),
    }
  );
  const data = await handleResponse<any>(res, 'Failed to dismiss QA suggestion');
  return unwrapDataEnvelope(data);
}

// ============================================================================
// SOURCE PACK API (Block C · EPIC-T12 · Sprint C-S6 frontend client)
// ============================================================================

export interface SourcePackCandidate {
  recordId: string;
  tableId: string;
  title: string;
  preview: string;
  updatedAt: string;
  confidenceScore: number | null;
  hasVerifiedSource: boolean;
  validationStatus: string;
  rankScore: number;
  rankSignals: {
    lexical: number;
    recency: number;
    confidence: number;
    verifiedSource: number;
  };
}

export interface SourcePackSnapshot {
  records: Array<{
    id: string;
    data: Record<string, unknown>;
    confidenceScore: number | null;
    validationStatus: string;
    updatedAt: string;
  }>;
  fields: Array<{ id: string; name: string; fieldType: string }>;
  capturedAt: string;
  captureSource: 'source_pack_create';
}

export interface SourcePack {
  id: string;
  organizationId: string;
  workspaceId: string;
  ownerUserId: string;
  tableId: string | null;
  name: string;
  description: string | null;
  candidateRecordIds: string[];
  v8Snapshot: SourcePackSnapshot;
  createdAt: string;
  updatedAt: string;
  usedCount: number;
  archivedAt: string | null;
}

export interface FindCandidatesOptions {
  query?: string;
  verifiedOnly?: boolean;
  recencyDays?: number | null;
  limit?: number;
}

export async function findSourcePackCandidates(
  tableId: string,
  options: FindCandidatesOptions = {}
): Promise<SourcePackCandidate[]> {
  const res = await fetchWithRetry(
    `${BASE_PATH}/tables/${encodeURIComponent(tableId)}/source-pack/find-candidates`,
    {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(options),
    }
  );
  const data = await handleResponse<any>(res, 'Failed to find source pack candidates');
  return unwrapDataEnvelope<SourcePackCandidate[]>(data) ?? [];
}

export async function createSourcePack(input: {
  tableId: string;
  workspaceId: string;
  name: string;
  description?: string;
  candidateRecordIds: string[];
}): Promise<SourcePack> {
  const { tableId, ...body } = input;
  const res = await fetchWithRetry(
    `${BASE_PATH}/tables/${encodeURIComponent(tableId)}/source-pack/create`,
    {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(body),
    }
  );
  const data = await handleResponse<any>(res, 'Failed to create source pack');
  return unwrapDataEnvelope<SourcePack>(data);
}

export async function getSourcePack(packId: string): Promise<SourcePack | null> {
  const res = await fetchWithRetry(`${BASE_PATH}/source-packs/${encodeURIComponent(packId)}`, {
    headers: getHeaders(),
  });
  if (res.status === 404) return null;
  const data = await handleResponse<any>(res, 'Failed to fetch source pack');
  return unwrapDataEnvelope<SourcePack>(data);
}

export async function listSourcePacksForTable(
  tableId: string,
  options: { includeArchived?: boolean; limit?: number } = {}
): Promise<SourcePack[]> {
  const params = new URLSearchParams();
  if (options.includeArchived) params.set('includeArchived', 'true');
  if (options.limit) params.set('limit', String(options.limit));
  const qs = params.toString();
  const res = await fetchWithRetry(
    `${BASE_PATH}/tables/${encodeURIComponent(tableId)}/source-packs${qs ? `?${qs}` : ''}`,
    { headers: getHeaders() }
  );
  const data = await handleResponse<any>(res, 'Failed to list source packs');
  return unwrapDataEnvelope<SourcePack[]>(data) ?? [];
}

export async function listSourcePacksForWorkspace(
  workspaceId: string,
  options: { includeArchived?: boolean; limit?: number } = {}
): Promise<SourcePack[]> {
  const params = new URLSearchParams();
  if (options.includeArchived) params.set('includeArchived', 'true');
  if (options.limit) params.set('limit', String(options.limit));
  const qs = params.toString();
  const res = await fetchWithRetry(
    `${BASE_PATH}/workspaces/${encodeURIComponent(workspaceId)}/source-packs${qs ? `?${qs}` : ''}`,
    { headers: getHeaders() }
  );
  const data = await handleResponse<any>(res, 'Failed to list source packs');
  return unwrapDataEnvelope<SourcePack[]>(data) ?? [];
}

export async function markSourcePackUsed(
  packId: string
): Promise<{ packId: string; usedCount: number }> {
  const res = await fetchWithRetry(`${BASE_PATH}/source-packs/${encodeURIComponent(packId)}/used`, {
    method: 'POST',
    headers: getHeaders(),
  });
  const data = await handleResponse<any>(res, 'Failed to mark source pack used');
  return unwrapDataEnvelope(data);
}

// ============================================================================
// TABLE ARTIFACT CONVERSION API (Block D · Sprint D-S1)
// ============================================================================

export type TableConversionTarget = 'document' | 'presentation';

export type TableConversionStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';

export interface TableConversionOutlineHint {
  heading: string;
  bodyHint?: string;
}

export interface TableConvertInput {
  workspaceId: string;
  target: TableConversionTarget;
  sourcePackId?: string;
  title?: string;
  outline?: TableConversionOutlineHint[];
  liveRecordCap?: number;
}

export interface TableConvertResult {
  conversionId: string;
  status: TableConversionStatus;
  artifactRunId: string | null;
  artifactDeepLink: string | null;
  sourcePackId: string | null;
}

export interface TableConversionRecord {
  id: string;
  organizationId: string;
  workspaceId: string;
  tableId: string;
  sourcePackId: string | null;
  target: TableConversionTarget;
  title: string | null;
  outline: TableConversionOutlineHint[] | null;
  status: TableConversionStatus;
  artifactRunId: string | null;
  artifactDeepLink: string | null;
  initiatedBy: string;
  initiatedAt: string;
  completedAt: string | null;
  failureReason: string | null;
  failureStage: string | null;
}

export async function convertTable(
  tableId: string,
  input: TableConvertInput
): Promise<TableConvertResult> {
  const res = await fetchWithRetry(`${BASE_PATH}/tables/${encodeURIComponent(tableId)}/convert`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(input),
  });
  const data = await handleResponse<any>(res, 'Failed to convert table');
  return unwrapDataEnvelope(data);
}

export async function getTableConversion(conversionId: string): Promise<TableConversionRecord> {
  const res = await fetchWithRetry(
    `${BASE_PATH}/table-conversions/${encodeURIComponent(conversionId)}`,
    { headers: getHeaders() }
  );
  const data = await handleResponse<any>(res, 'Failed to fetch conversion');
  return unwrapDataEnvelope(data);
}

export async function listTableConversions(
  tableId: string,
  options?: { status?: TableConversionStatus; limit?: number }
): Promise<TableConversionRecord[]> {
  const params = new URLSearchParams();
  if (options?.status) params.set('status', options.status);
  if (options?.limit != null) params.set('limit', String(options.limit));
  const url = `${BASE_PATH}/tables/${encodeURIComponent(tableId)}/conversions${
    params.toString() ? `?${params.toString()}` : ''
  }`;
  const res = await fetchWithRetry(url, { headers: getHeaders() });
  const data = await handleResponse<any>(res, 'Failed to list conversions');
  return unwrapDataEnvelope<TableConversionRecord[]>(data) ?? [];
}

// ============================================================================
// FORM INTAKE (JWT) API (Block D · Sprint D-S2 / D-S4)
// ============================================================================

export type FormIntakeKind = 'slug' | 'jwt';

export interface FormIntakeContext {
  formId: string;
  formSlug: string;
  /** Either embed_target_table_id (when set) or the form's own table_id. */
  targetTableId: string;
  /** When NULL, the configured form fields are accepted as-is. */
  fieldAllowList: string[] | null;
  publicLinkExpiresAt: string | null;
  isPublished: boolean;
}

export interface IssueFormIntakeJwtInput {
  subject: string;
  expiresInSeconds?: number;
  hardExpiresAt?: string;
}

export interface IssuedFormIntakeJwt {
  token: string;
  expiresAt: string;
}

/** Admin: fetch the JWT-intake context for a form (target table + allow-list). */
export async function getFormIntakeContext(formId: string): Promise<FormIntakeContext> {
  const res = await fetchWithRetry(`${BASE_PATH}/forms/${encodeURIComponent(formId)}/intake`, {
    headers: getHeaders(),
  });
  const data = await handleResponse<any>(res, 'Failed to fetch form intake context');
  return unwrapDataEnvelope(data);
}

/** Admin: issue a JWT link for a recipient. */
export async function issueFormIntakeJwt(
  formId: string,
  input: IssueFormIntakeJwtInput
): Promise<IssuedFormIntakeJwt> {
  const res = await fetchWithRetry(`${BASE_PATH}/forms/${encodeURIComponent(formId)}/intake/jwt`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(input),
  });
  const data = await handleResponse<any>(res, 'Failed to issue intake JWT');
  return unwrapDataEnvelope(data);
}

/** Admin: replace the field allow-list. Pass `null` to fall back to the form's
 *  configured fields (no filter applied). */
export async function setFormIntakeAllowList(
  formId: string,
  allowList: string[] | null
): Promise<FormIntakeContext> {
  const res = await fetchWithRetry(
    `${BASE_PATH}/forms/${encodeURIComponent(formId)}/intake/allow-list`,
    {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ allowList }),
    }
  );
  const data = await handleResponse<any>(res, 'Failed to update allow list');
  return unwrapDataEnvelope(data);
}

/** Public (no auth): resolve the JWT and return the form context.
 *  Mirrors `getPublicForm(slug)` but verifies a JWT instead. */
export async function getPublicFormByJwt(token: string): Promise<{
  formId: string;
  formSlug: string;
  targetTableId: string;
  fieldAllowList: string[] | null;
  publicLinkExpiresAt: string | null;
  /** Form metadata returned via the slug-based endpoint to render fields.
   *  Fetched lazily by the caller via `getPublicForm(formSlug)`. */
}> {
  const res = await fetch(`${BASE_PATH}/public/forms/jwt/${encodeURIComponent(token)}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as any).error || 'Form not found');
  }
  const json = await res.json();
  return json.data ?? json;
}

/** Public (no auth): submit a form via JWT path. */
export async function submitPublicFormByJwt(
  token: string,
  data: Record<string, unknown>
): Promise<{ recordId: string }> {
  const res = await fetch(`${BASE_PATH}/public/forms/jwt/${encodeURIComponent(token)}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const code = (body as any)?.code;
    const message =
      (body as any).error ||
      (code === 'RATE_LIMITED' ? 'Submission rate limit exceeded' : 'Submission failed');
    throw new Error(message);
  }
  const json = await res.json();
  return json.data ?? json;
}
