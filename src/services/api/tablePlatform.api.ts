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
  const url = query ? `${BASE_PATH}/tables/${tableId}/records?${query}` : `${BASE_PATH}/tables/${tableId}/records`;
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

export async function updateRecord(
  recordId: string,
  data: Record<string, unknown>
): Promise<any> {
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
  language?: string
): Promise<any> {
  const res = await fetchWithRetry(`${BASE_PATH}/schema/propose`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ workspaceId, message, existingSchema, language }),
  });
  return handleResponse(res, 'Failed to generate schema proposal');
}

/** Chat-to-Schema: execute proposal */
export async function executeSchemaProposal(
  proposalId: string,
  approvedOperationIds?: string[]
): Promise<any> {
  const res = await fetchWithRetry(`${BASE_PATH}/schema/proposals/${proposalId}/execute`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ approvedOperationIds }),
  });
  return handleResponse(res, 'Failed to execute schema proposal');
}

/** Chat-to-Schema: reject proposal */
export async function rejectSchemaProposal(
  proposalId: string,
  reason?: string
): Promise<void> {
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
export async function bulkDeleteRecords(
  tableId: string,
  recordIds: string[]
): Promise<any> {
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
export async function getLinkedRecords(
  recordId: string,
  fieldId: string
): Promise<any> {
  const res = await fetchWithRetry(
    `${BASE_PATH}/records/${recordId}/links/${fieldId}`,
    { headers: getHeaders() }
  );
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

/** List attachments for a record, optionally filtered by field */
export async function getAttachments(
  recordId: string,
  fieldId?: string
): Promise<any[]> {
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
export async function validateFormula(
  tableId: string,
  expression: string
): Promise<any> {
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
  const res = await fetchWithRetry(`${BASE_PATH}/forms/${formId}/submissions${qs ? `?${qs}` : ''}`, {
    headers: getHeaders(),
  });
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
  parentId?: string
): Promise<any> {
  const res = await fetchWithRetry(`${BASE_PATH}/records/${recordId}/comments`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ tableId, content, authorName, parentId }),
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

export async function updateRecordComment(
  commentId: string,
  content: string
): Promise<any> {
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

export async function getSharedViewData(token: string): Promise<any> {
  const res = await fetch(`${BASE_PATH}/public/views/${encodeURIComponent(token)}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as any).error || 'Shared view not found');
  }
  return res.json();
}

export async function getSharedViewRecords(
  token: string,
  options?: { pageSize?: number; cursor?: string }
): Promise<any> {
  const params = new URLSearchParams();
  if (options?.pageSize) params.set('pageSize', String(options.pageSize));
  if (options?.cursor) params.set('cursor', options.cursor);
  const query = params.toString();
  const url = query
    ? `${BASE_PATH}/public/views/${encodeURIComponent(token)}/records?${query}`
    : `${BASE_PATH}/public/views/${encodeURIComponent(token)}/records`;
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as any).error || 'Failed to fetch shared view records');
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
  updates: { name?: string; targetUrl?: string; secret?: string; eventTypes?: string[]; isActive?: boolean }
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

export async function testWebhookRelay(relayId: string): Promise<{ success: boolean; statusCode?: number; error?: string }> {
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
