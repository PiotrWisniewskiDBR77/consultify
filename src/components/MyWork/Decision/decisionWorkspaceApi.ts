/**
 * MW-DEC-001 — thin client for the canonical Decision detail/collaboration
 * endpoints (server/src/routes/pmo/decisions.routes.ts). Deliberately reuses
 * the SAME `Api.get/post/put/delete` helpers every other screen in this repo
 * uses (src/services/api.ts) instead of raw `fetch` — that keeps auth
 * headers, demo-mode blocking, 401 refresh-and-retry, and error shape
 * (`err.status` / `err.data`) identical to the rest of the app. This file
 * only adds thin, typed wrappers around specific decision routes; it does
 * not add new transport plumbing and does not modify api.ts.
 */
import { Api } from '@/services/api';
import { normalizeApiErrorMessage } from '@/utils/apiError';

import type {
  DecideResultDTO,
  DecideTargetStatus,
  DecisionAlternativeDTO,
  DecisionCommentDTO,
  DecisionDetailDTO,
  DecisionRiskDTO,
} from './types';

/**
 * `Api.get/post/put/delete` (src/services/api.ts `handleResponse`) throw a
 * plain `Error` with `.status` (HTTP status) and `.data` (parsed JSON body,
 * e.g. `{ error, code, currentVersion, expectedVersion }` for a 409) already
 * attached — this type just names that shape so call sites can branch on it
 * without `as any` everywhere.
 */
export interface DecisionApiError extends Error {
  status?: number;
  data?: { error?: string; code?: string; [key: string]: unknown };
}

/** Normalizes whatever `Api.*` throws into the shape above (never throws itself). */
export function readDecisionApiError(err: unknown): DecisionApiError {
  if (err instanceof Error) return err as DecisionApiError;
  const wrapped = new Error(typeof err === 'string' ? err : 'Request failed') as DecisionApiError;
  return wrapped;
}

/**
 * Human-readable detail string for microcopy interpolation — the ONLY thing
 * that may be shown to a user.
 *
 * Finding M02-004: call sites used to interpolate `err.data?.error` directly,
 * which rendered "Could not load this decision. [object Object]" whenever an
 * endpoint answered with `{ error: { ... } }`. `Api.*` deliberately keeps the
 * RAW parsed body on `.data` (so callers can branch on `.code`,
 * `.currentVersion`, …) and puts the ALREADY-normalized string on `.message`
 * — so reaching into `.data.error` reaches *past* the normalization the
 * transport layer performed.
 *
 * This reuses the shared `normalizeApiErrorMessage` (src/utils/apiError.ts),
 * which flattens nested `{ error: {...} }` / validation payloads and refuses
 * to emit the literal "[object Object]". Returns '' when nothing readable is
 * available, so callers keep their own fallback copy.
 */
export function readDecisionApiErrorDetail(err: unknown): string {
  const apiErr = readDecisionApiError(err);
  const fromBody = apiErr.data ? normalizeApiErrorMessage(apiErr.data, '') : '';
  return fromBody || normalizeApiErrorMessage(apiErr.message, '') || '';
}

export interface CreateAlternativeInput {
  title: string;
  description?: string;
  benefits?: string;
  drawbacks?: string;
  costOrFeasibility?: string;
  isRecommended?: boolean;
}

export interface CreateRiskInput {
  description: string;
  severity?: string;
  likelihood?: string;
  mitigation?: string;
  ownerId?: string | null;
}

export interface DecideInput {
  status: DecideTargetStatus;
  rationale?: string;
  notes?: string;
  expectedVersion?: number;
}

/**
 * MW-05: input for POST /api/decisions (DecisionController.createDecision).
 * `projectId` is required in practice — the server 400s with "Missing
 * decision context" if projectId/initiativeId/taskId are all absent — but is
 * kept optional here to mirror the server's own Zod schema
 * (`CreateDecisionSchema`) exactly rather than inventing a stricter contract
 * client-side.
 */
export interface CreateDecisionInput {
  projectId?: string | null;
  title: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  impact?: 'low' | 'medium' | 'high';
  dueDate?: string | null;
  decisionType?: string;
}

/**
 * Matches `createDecision`'s response EXACTLY — see
 * `server/src/controllers/DecisionController.ts`:
 * `res.status(201).json({ id, projectId: projectIdValue, title: decodedTitle, status: 'PENDING' })`.
 * No other fields are invented here.
 */
export interface CreateDecisionResult {
  id: string;
  projectId?: string | null;
  title: string;
  status: string;
}

export const decisionWorkspaceApi = {
  getDetail: (decisionId: string): Promise<DecisionDetailDTO> =>
    Api.get(`/decisions/${decisionId}/detail`) as Promise<DecisionDetailDTO>,

  create: (input: CreateDecisionInput): Promise<CreateDecisionResult> =>
    Api.post('/decisions', input) as Promise<CreateDecisionResult>,

  postComment: (decisionId: string, body: string): Promise<DecisionCommentDTO> =>
    Api.post(`/decisions/${decisionId}/comments`, { body }) as Promise<DecisionCommentDTO>,

  updateComment: (
    decisionId: string,
    commentId: string,
    body: string
  ): Promise<DecisionCommentDTO> =>
    Api.put(`/decisions/${decisionId}/comments/${commentId}`, {
      body,
    }) as Promise<DecisionCommentDTO>,

  deleteComment: (decisionId: string, commentId: string): Promise<void> =>
    Api.delete(`/decisions/${decisionId}/comments/${commentId}`) as unknown as Promise<void>,

  postAlternative: (
    decisionId: string,
    input: CreateAlternativeInput
  ): Promise<DecisionAlternativeDTO> =>
    Api.post(`/decisions/${decisionId}/alternatives`, input) as Promise<DecisionAlternativeDTO>,

  updateAlternative: (
    decisionId: string,
    alternativeId: string,
    patch: Partial<CreateAlternativeInput>
  ): Promise<DecisionAlternativeDTO> =>
    Api.put(
      `/decisions/${decisionId}/alternatives/${alternativeId}`,
      patch
    ) as Promise<DecisionAlternativeDTO>,

  deleteAlternative: (decisionId: string, alternativeId: string): Promise<void> =>
    Api.delete(
      `/decisions/${decisionId}/alternatives/${alternativeId}`
    ) as unknown as Promise<void>,

  postRisk: (decisionId: string, input: CreateRiskInput): Promise<DecisionRiskDTO> =>
    Api.post(`/decisions/${decisionId}/risks`, input) as Promise<DecisionRiskDTO>,

  updateRisk: (
    decisionId: string,
    riskId: string,
    patch: Partial<CreateRiskInput>
  ): Promise<DecisionRiskDTO> =>
    Api.put(`/decisions/${decisionId}/risks/${riskId}`, patch) as Promise<DecisionRiskDTO>,

  deleteRisk: (decisionId: string, riskId: string): Promise<void> =>
    Api.delete(`/decisions/${decisionId}/risks/${riskId}`) as unknown as Promise<void>,

  /**
   * PUT /:id/decide. `expectedVersion` should always be the `version` field
   * from the last successful `getDetail()` read — the server 409s with
   * `code: 'STALE_VERSION'` when it does not match the current row, instead
   * of silently overwriting a concurrent change.
   */
  decide: (decisionId: string, input: DecideInput): Promise<DecideResultDTO> =>
    Api.put(`/decisions/${decisionId}/decide`, input) as Promise<DecideResultDTO>,
};

export default decisionWorkspaceApi;
