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

export async function v8Post<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetchWithRetry(`${V8_BASE}${path}`, {
    method: 'POST',
    headers: getHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await handleResponse<{ data: T }>(res, `V8 POST ${path}`);
  return json.data;
}

export async function v8Put<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetchWithRetry(`${V8_BASE}${path}`, {
    method: 'PUT',
    headers: getHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await handleResponse<{ data: T }>(res, `V8 PUT ${path}`);
  return json.data;
}

export async function v8Delete<T>(path: string): Promise<T> {
  const res = await fetchWithRetry(`${V8_BASE}${path}`, {
    method: 'DELETE',
    headers: getHeaders(),
  });
  const json = await handleResponse<{ data: T }>(res, `V8 DELETE ${path}`);
  return json.data;
}
