/**
 * AssessmentReportView — data fetching.
 *
 * Reuses the EXISTING method-core kernel endpoints — no new server route.
 * Verified directly against `server/src/routes/method-core.routes.ts`
 * (28 routes, all mounted at `/api/method` via
 * `server/src/Gateway.ts:902` — `app.use('/api/method', methodCoreRoutes)`):
 *
 *   GET /api/method/outputs/:id             — full immutable Output
 *   GET /api/method/sessions/:id            — session metadata
 *   GET /api/method/sessions/:id/approvals  — approval trail ("kto zatwierdził")
 *
 * ★ CORRECTION (verified empirically before writing this file, not assumed):
 * there is NO `GET /api/method/outputs/:id/report`. That path only has a
 * `router.post(...)` handler (`createArtefactSnapshot` — it creates a NEW
 * Report *snapshot* row from client-supplied `content`, it does not read
 * one). A same-repo coordinator flagged this path as "already existing" —
 * empirical proof offered was a live 401 on the running dev server. That
 * 401 is a false positive: `method-core.routes.ts:110` runs
 * `router.use(verifyToken, isAuthenticated)` with NO path filter, so it
 * intercepts and 401s ANY request under `/api/method/*`, including paths
 * with zero matching route — confirmed by curling a deliberately bogus path
 * under the same prefix and getting the identical 401 body, while a bogus
 * path OUTSIDE `/api/method` correctly 404s. Recorded here so nobody
 * re-derives "the GET report endpoint exists" from the same false signal.
 *
 * `getOutput`/`getSession` are re-used from the shared kernel client
 * (`@/method-core/api/methodCoreApi`) rather than re-implemented — only the
 * approvals fetch is new (no existing client function calls that route).
 * `getOutput`'s return type is the client's NARROWED `MethodOutputSummary`;
 * the real JSON on the wire is the full `MethodOutputRecord` (see
 * `types.ts`'s header comment) — cast once, at this one boundary, with the
 * reasoning on record, rather than scattering `as any` through the renderer.
 */
import {
  getOutput as getOutputSummary,
  getSession as getSessionRaw,
  isAuthError,
  isOfflineError,
  MethodCoreApiError,
} from '@/method-core/api/methodCoreApi';
import { fetchWithRetry, getHeaders } from '@/services/api/baseClient';

import type { FullAssessmentOutput, ReportApproval, ReportSessionMeta } from './types';

export { isAuthError, isOfflineError, MethodCoreApiError };

const BASE = '/api/method';

async function handleJson<T>(promise: Promise<Response>): Promise<T> {
  let res: Response;
  try {
    res = await promise;
  } catch (err) {
    throw new MethodCoreApiError(
      err instanceof Error ? err.message : 'Network request failed',
      0,
      {},
      true
    );
  }
  const body = await res.json().catch(() => ({}) as Record<string, unknown>);
  if (!res.ok) {
    throw new MethodCoreApiError(
      typeof body.error === 'string' ? body.error : `Request failed with ${res.status}`,
      res.status,
      body
    );
  }
  return body as T;
}

export interface OutputFetchResult {
  readonly output: FullAssessmentOutput;
  readonly superseded: boolean;
  readonly supersededByOutputId: string | null;
}

/** Fetches the immutable Output. Returns `null` on a 404 ("this id does not
 * exist / does not belong to this org") — the caller renders the honest
 * "not frozen" state, never a substitute calculation. */
export async function fetchOutputForReport(outputId: string): Promise<OutputFetchResult | null> {
  try {
    const res = await getOutputSummary(outputId);
    // See module header comment — the wire payload is the FULL record.
    return {
      output: res.output as unknown as FullAssessmentOutput,
      superseded: res.superseded,
      supersededByOutputId: res.supersededByOutputId,
    };
  } catch (err) {
    if (err instanceof MethodCoreApiError && err.status === 404) return null;
    throw err;
  }
}

/** Fetches session metadata for the header block (module, pinned method
 * pack, lifecycle state). Returns `null` on 404 rather than throwing — the
 * report still renders from the Output alone, just without session
 * enrichment, and says so. */
export async function fetchSessionForReport(sessionId: string): Promise<ReportSessionMeta | null> {
  try {
    const res = await getSessionRaw(sessionId);
    return res.session as unknown as ReportSessionMeta;
  } catch (err) {
    if (err instanceof MethodCoreApiError && err.status === 404) return null;
    throw err;
  }
}

/** Fetches the approval trail for the EXACT session revision the Output was
 * frozen from — this is where "kto zatwierdził" comes from (S2 hard rule
 * #4: approvals are scoped by sessionId, and a reopened session always gets
 * a brand-new sessionId, so this can never surface another revision's
 * decision). Returns `[]` on failure rather than throwing — approver info
 * is an enrichment, not a precondition for showing the frozen result. */
export async function fetchApprovalsForReport(sessionId: string): Promise<ReportApproval[]> {
  try {
    const res = await handleJson<{ approvals: ReportApproval[] }>(
      fetchWithRetry(`${BASE}/sessions/${encodeURIComponent(sessionId)}/approvals`, {
        method: 'GET',
        headers: getHeaders(),
      })
    );
    return res.approvals ?? [];
  } catch {
    return [];
  }
}
