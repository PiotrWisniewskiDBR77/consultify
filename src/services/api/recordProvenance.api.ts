/**
 * Record Provenance API Client (Block B · EPIC-T8 + T9).
 *
 * Thin wrapper over the `/api/table-platform` endpoints introduced in
 * B-S2 and B-S3. Surface mirrors `RECORD_PROVENANCE_V1.md`:
 *
 *   GET    /records/:recordId/sources
 *   POST   /records/:recordId/sources
 *   PATCH  /sources/:sourceId
 *   POST   /sources/:sourceId/verify
 *   DELETE /sources/:sourceId
 *   GET    /records/:recordId/validation-status/transitions
 *   POST   /records/:recordId/validation-status
 */

import { API_URL, fetchWithRetry, getHeaders, handleResponse } from './baseClient';

const BASE = `${API_URL}/table-platform`;

export type SourceType = 'manual' | 'ai_extraction' | 'import' | 'integration' | 'system';

export interface RecordSource {
  id: string;
  organization_id: string;
  record_id: string;
  source_type: SourceType;
  source_uri: string | null;
  source_metadata: Record<string, unknown>;
  confidence_contribution: number | null;
  created_by: string;
  created_at: string;
  last_verified_at: string | null;
  last_verified_by: string | null;
  archived_at: string | null;
}

export type ValidationStatus = 'unverified' | 'verified' | 'flagged';

export interface ValidationTransitionsResponse {
  current: ValidationStatus;
  allowed: ValidationStatus[];
}

export interface SetValidationStatusResult {
  recordId: string;
  previous: ValidationStatus;
  next: ValidationStatus;
  changed: boolean;
}

export interface CreateRecordSourceInput {
  source_type: SourceType;
  source_uri?: string | null;
  source_metadata?: Record<string, unknown>;
  confidence_contribution?: number | null;
}

export interface UpdateRecordSourceInput {
  source_type?: SourceType;
  source_uri?: string | null;
  source_metadata?: Record<string, unknown>;
  confidence_contribution?: number | null;
}

// ── Sources ──────────────────────────────────────────────────────────────────

export async function listRecordSources(
  recordId: string,
  opts: { includeArchived?: boolean; sourceType?: SourceType } = {}
): Promise<RecordSource[]> {
  const params = new URLSearchParams();
  if (opts.includeArchived) params.set('includeArchived', '1');
  if (opts.sourceType) params.set('sourceType', opts.sourceType);
  const qs = params.toString() ? `?${params.toString()}` : '';
  const res = await fetchWithRetry(`${BASE}/records/${recordId}/sources${qs}`, {
    headers: getHeaders(),
  });
  const body = await handleResponse<{ sources?: RecordSource[] } | RecordSource[]>(
    res,
    'Failed to list record sources'
  );
  if (Array.isArray(body)) return body;
  return body?.sources ?? [];
}

export async function createRecordSource(
  recordId: string,
  input: CreateRecordSourceInput
): Promise<RecordSource> {
  const res = await fetchWithRetry(`${BASE}/records/${recordId}/sources`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(input),
  });
  return handleResponse<RecordSource>(res, 'Failed to create record source');
}

export async function updateRecordSource(
  sourceId: string,
  patch: UpdateRecordSourceInput
): Promise<RecordSource> {
  const res = await fetchWithRetry(`${BASE}/sources/${sourceId}`, {
    method: 'PATCH',
    headers: getHeaders(),
    body: JSON.stringify(patch),
  });
  return handleResponse<RecordSource>(res, 'Failed to update record source');
}

export async function verifyRecordSource(sourceId: string): Promise<RecordSource> {
  const res = await fetchWithRetry(`${BASE}/sources/${sourceId}/verify`, {
    method: 'POST',
    headers: getHeaders(),
  });
  return handleResponse<RecordSource>(res, 'Failed to verify record source');
}

export async function deleteRecordSource(sourceId: string): Promise<RecordSource> {
  const res = await fetchWithRetry(`${BASE}/sources/${sourceId}`, {
    method: 'DELETE',
    headers: getHeaders(),
  });
  return handleResponse<RecordSource>(res, 'Failed to delete record source');
}

// ── Validation status ────────────────────────────────────────────────────────

export async function getValidationStatusTransitions(
  recordId: string
): Promise<ValidationTransitionsResponse> {
  const res = await fetchWithRetry(`${BASE}/records/${recordId}/validation-status/transitions`, {
    headers: getHeaders(),
  });
  return handleResponse<ValidationTransitionsResponse>(
    res,
    'Failed to load validation transitions'
  );
}

export async function setValidationStatus(
  recordId: string,
  status: ValidationStatus,
  note?: string
): Promise<SetValidationStatusResult> {
  const res = await fetchWithRetry(`${BASE}/records/${recordId}/validation-status`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ status, ...(note ? { note } : {}) }),
  });
  return handleResponse<SetValidationStatusResult>(res, 'Failed to update validation status');
}
