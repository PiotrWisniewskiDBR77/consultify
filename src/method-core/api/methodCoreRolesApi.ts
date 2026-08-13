/**
 * Shared Method Kernel — browser HTTP client for roles/assignment/approval
 * (agent S2, CEL 3, 2026-08-13).
 *
 * Talks to `server/src/routes/method-core-roles.routes.ts`
 * (`/api/method/sessions/:id/roles`, `.../roles/history`,
 * `.../approval-trail`, `.../send-back`) — this agent's OWN new router,
 * mounted alongside (not inside) `method-core.routes.ts`. Deliberately a
 * SEPARATE file from `src/method-core/api/methodCoreApi.ts` (owned by the
 * DRD HTTP session runtime, S3's territory) rather than an edit to it —
 * same reasoning as the server-side router split: two independently-owned
 * files, same shared fetch plumbing, zero collision surface.
 *
 * Reuses this repo's existing fetch plumbing (`fetchWithRetry`/`getHeaders`
 * from `src/services/api/baseClient.ts`), matching `methodCoreApi.ts`'s own
 * convention.
 */

import { fetchWithRetry, getHeaders } from '@/services/api/baseClient';
import type { MethodProcessRole, MethodSession } from '@/method-core/contracts';

const BASE = '/api/method';

export class MethodCoreRolesApiError extends Error {
  readonly status: number;
  readonly body: Record<string, unknown>;
  readonly isNetworkError: boolean;

  constructor(message: string, status: number, body: Record<string, unknown>, isNetworkError = false) {
    super(message);
    this.name = 'MethodCoreRolesApiError';
    this.status = status;
    this.body = body;
    this.isNetworkError = isNetworkError;
  }
}

async function handle<T>(promise: Promise<Response>): Promise<T> {
  let res: Response;
  try {
    res = await promise;
  } catch (err) {
    throw new MethodCoreRolesApiError(
      err instanceof Error ? err.message : 'Network request failed',
      0,
      {},
      true
    );
  }
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({}) as Record<string, unknown>);
  if (!res.ok) {
    throw new MethodCoreRolesApiError(
      typeof body.error === 'string' ? body.error : `Request failed with ${res.status}`,
      res.status,
      body
    );
  }
  return body as T;
}

export interface RoleAssignment {
  readonly sessionId: string;
  readonly userId: string;
  readonly role: MethodProcessRole;
  readonly createdAt: string;
}

export interface RoleHistoryEntry {
  readonly id: string;
  readonly sessionId: string;
  readonly userId: string;
  readonly role: MethodProcessRole;
  readonly eventType: 'granted' | 'revoked';
  readonly actorUserId: string;
  readonly occurredAt: string;
}

export interface ApprovalTrailEntry {
  readonly eventId: string;
  readonly sessionId: string;
  readonly version: number | null;
  readonly type: 'DECISION_APPROVED' | 'DECISION_SENT_BACK' | 'OUTPUT_APPROVED';
  readonly actorUserId: string | null;
  readonly occurredAt: string;
  readonly rationale: string | null;
}

export async function listRoles(sessionId: string): Promise<RoleAssignment[]> {
  const res = await handle<{ roles: RoleAssignment[] }>(
    fetchWithRetry(`${BASE}/sessions/${sessionId}/roles`, { headers: getHeaders() })
  );
  return res.roles;
}

export async function assignRole(
  sessionId: string,
  userId: string,
  role: MethodProcessRole
): Promise<{ assignment: RoleAssignment; alreadyGranted: boolean }> {
  return handle(
    fetchWithRetry(`${BASE}/sessions/${sessionId}/roles`, {
      method: 'POST',
      headers: { ...getHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, role }),
    })
  );
}

export async function revokeRole(
  sessionId: string,
  userId: string,
  role: MethodProcessRole
): Promise<{ revoked: boolean }> {
  return handle(
    fetchWithRetry(`${BASE}/sessions/${sessionId}/roles/${encodeURIComponent(userId)}/${encodeURIComponent(role)}`, {
      method: 'DELETE',
      headers: getHeaders(),
    })
  );
}

export async function roleHistory(sessionId: string): Promise<RoleHistoryEntry[]> {
  const res = await handle<{ history: RoleHistoryEntry[] }>(
    fetchWithRetry(`${BASE}/sessions/${sessionId}/roles/history`, { headers: getHeaders() })
  );
  return res.history;
}

export async function approvalTrail(sessionId: string): Promise<ApprovalTrailEntry[]> {
  const res = await handle<{ trail: ApprovalTrailEntry[] }>(
    fetchWithRetry(`${BASE}/sessions/${sessionId}/approval-trail`, { headers: getHeaders() })
  );
  return res.trail;
}

export async function sendBack(
  sessionId: string,
  comment: string
): Promise<{ session: MethodSession; newRevision: MethodSession | null }> {
  return handle(
    fetchWithRetry(`${BASE}/sessions/${sessionId}/send-back`, {
      method: 'POST',
      headers: { ...getHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ comment }),
    })
  );
}
