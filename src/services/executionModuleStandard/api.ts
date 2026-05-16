/**
 * Consultify Execution-module UI/UX Standard — Frontend API client
 * (Slice FE-E1.1).
 *
 * Talks to /api/execution-modules (server/src/routes/execution-modules.routes.ts).
 *
 * Returns the response envelopes directly through small typed wrappers so the
 * caller does not have to remember the wire shape (`{ standard }`,
 * `{ manifests }`, `{ manifest }`, `{ result }`).
 */

import { fetchWithRetry, getHeaders, handleResponse } from '@/services/api/baseClient';

import type {
  ExecutionModuleId,
  ExecutionModuleManifest,
  ExecutionModuleStandard,
  ExecutionModuleValidationResult,
} from './types';

const BASE = '/api/execution-modules';

interface StandardResponse {
  standard: ExecutionModuleStandard;
}

interface ManifestsResponse {
  manifests: ExecutionModuleManifest[];
}

interface ManifestResponse {
  manifest: ExecutionModuleManifest;
}

interface ValidateResponse {
  result: ExecutionModuleValidationResult;
}

/**
 * GET /api/execution-modules/standard — returns the canonical
 * standard envelope (zones, chip order, collapse contract, allowed
 * agents, allowed AI slots).
 */
export async function fetchExecutionModuleStandard(): Promise<ExecutionModuleStandard> {
  const res = await fetchWithRetry(`${BASE}/standard`, {
    method: 'GET',
    headers: getHeaders(),
  });
  const json = await handleResponse<StandardResponse>(res, 'ExecutionModule standard');
  return json.standard;
}

/**
 * GET /api/execution-modules/manifests — returns all system-owned
 * reference manifests (doc-builder, deck-builder, excel-builder).
 */
export async function fetchExecutionModuleManifests(): Promise<ExecutionModuleManifest[]> {
  const res = await fetchWithRetry(`${BASE}/manifests`, {
    method: 'GET',
    headers: getHeaders(),
  });
  const json = await handleResponse<ManifestsResponse>(res, 'ExecutionModule manifests');
  return json.manifests;
}

/**
 * Thrown when the requested module id does not match a system-owned
 * reference manifest. The route returns 404 `module_not_found`.
 * Callers may surface a graceful empty state instead of a hard error.
 */
export class ExecutionModuleNotFoundError extends Error {
  readonly code = 'module_not_found';
  readonly moduleId: ExecutionModuleId;
  constructor(moduleId: ExecutionModuleId) {
    super(`Execution module manifest not found: ${moduleId}`);
    this.name = 'ExecutionModuleNotFoundError';
    this.moduleId = moduleId;
  }
}

/**
 * GET /api/execution-modules/manifests/:moduleId — returns the
 * system-owned reference manifest for the given moduleId.
 *
 * Throws `ExecutionModuleNotFoundError` on 404 so callers can match
 * the error class instead of parsing message strings.
 */
export async function fetchExecutionModuleManifest(
  moduleId: ExecutionModuleId
): Promise<ExecutionModuleManifest> {
  const res = await fetchWithRetry(
    `${BASE}/manifests/${encodeURIComponent(moduleId)}`,
    {
      method: 'GET',
      headers: getHeaders(),
    }
  );
  if (res.status === 404) {
    throw new ExecutionModuleNotFoundError(moduleId);
  }
  const json = await handleResponse<ManifestResponse>(res, 'ExecutionModule manifest');
  return json.manifest;
}

/**
 * POST /api/execution-modules/manifests/:moduleId/validate — runs the
 * server-side validator against a candidate manifest and returns the
 * full violation envelope so the caller can render a CI / governance
 * gate UI off the same source the backend uses.
 */
export async function validateExecutionModuleManifest(
  moduleId: ExecutionModuleId,
  candidate: ExecutionModuleManifest
): Promise<ExecutionModuleValidationResult> {
  const res = await fetchWithRetry(
    `${BASE}/manifests/${encodeURIComponent(moduleId)}/validate`,
    {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(candidate),
    }
  );
  const json = await handleResponse<ValidateResponse>(res, 'ExecutionModule validate');
  return json.result;
}
