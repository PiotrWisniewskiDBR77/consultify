/**
 * V8 API Client
 * Base utilities for making V8 API requests.
 * Wraps the shared baseClient with V8 envelope unwrapping.
 */

import { fetchWithRetry, getHeaders, handleResponse } from '../baseClient';

const V8_BASE = '/api/v8';

export async function v8Get<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${V8_BASE}${path}`, window.location.origin);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }
  const res = await fetchWithRetry(url.toString(), {
    method: 'GET',
    headers: getHeaders(),
  });
  const json = await handleResponse<{ data: T }>(res, `V8 GET ${path}`);
  return json.data;
}

export async function v8Post<T>(
  path: string,
  body?: unknown,
  options?: { timeoutMs?: number; extraHeaders?: Record<string, string> }
): Promise<T> {
  const res = await fetchWithRetry(`${V8_BASE}${path}`, {
    method: 'POST',
    headers: options?.extraHeaders ? { ...getHeaders(), ...options.extraHeaders } : getHeaders(),
    body: body ? JSON.stringify(body) : undefined,
    // Some V8 endpoints (e.g. advisory/business-case) run a multi-phase LLM
    // pipeline server-side and legitimately take longer than the 20s default
    // hard timeout — callers can opt into a longer wait.
    ...(options?.timeoutMs ? { timeoutMs: options.timeoutMs } : {}),
  });
  const json = await handleResponse<{ data: T }>(res, `V8 POST ${path}`);
  return json.data;
}

// `extraHeaders` (FIN-005 Fix 2): lets a caller attach request-scoped
// headers — e.g. `Idempotency-Key` for FinancialStatementImportWizard's
// upload retries — without this generic multipart helper needing to know
// anything about idempotency itself.
export async function v8PostMultipart<T>(
  path: string,
  formData: FormData,
  extraHeaders?: Record<string, string>
): Promise<T> {
  const headers = { ...getHeaders(), ...(extraHeaders || {}) };
  delete headers['Content-Type'];
  const res = await fetchWithRetry(`${V8_BASE}${path}`, {
    method: 'POST',
    headers,
    body: formData,
    skipDefaultHeaders: true,
  });
  const json = await handleResponse<{ data: T }>(res, `V8 POST MULTIPART ${path}`);
  return json.data;
}

export async function v8Put<T>(
  path: string,
  body?: unknown,
  options?: { extraHeaders?: Record<string, string> }
): Promise<T> {
  const res = await fetchWithRetry(`${V8_BASE}${path}`, {
    method: 'PUT',
    headers: options?.extraHeaders ? { ...getHeaders(), ...options.extraHeaders } : getHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await handleResponse<{ data: T }>(res, `V8 PUT ${path}`);
  return json.data;
}

export async function v8Patch<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetchWithRetry(`${V8_BASE}${path}`, {
    method: 'PATCH',
    headers: getHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await handleResponse<{ data: T }>(res, `V8 PATCH ${path}`);
  return json.data;
}

export async function v8Delete<T>(
  path: string,
  options?: { extraHeaders?: Record<string, string> }
): Promise<T> {
  const res = await fetchWithRetry(`${V8_BASE}${path}`, {
    method: 'DELETE',
    headers: options?.extraHeaders ? { ...getHeaders(), ...options.extraHeaders } : getHeaders(),
  });
  // `handleResponse` returns `null` (not `{ data }`) for a genuine 204 No Content — a legal,
  // empty-body DELETE response, not an error. Reading `.data` off `null` unconditionally used to
  // throw "Cannot read properties of null (reading 'data')" on any endpoint that really answers
  // 204 (e.g. `saved-views.routes.ts`'s `DELETE /saved-views/:id`, `res.status(204).send()`, no
  // body at all). `json` is `null` only on 204 — `handleResponse` throws for any non-ok status
  // before returning, so by the time we get here it's either `null` (204) or the real envelope.
  const json = await handleResponse<{ data: T } | null>(res, `V8 DELETE ${path}`);
  return (json === null ? null : json.data) as T;
}
