/**
 * Idea FINANCIAL Case API client — Program E / epic E09, stream S6-E09 (RISK-12).
 * Backend: server/src/routes/ideaFinancialCase.routes.ts.
 * Payload shape: `IdeaFinancialCasePayload` in
 * server/src/services/ideaFinancialCaseService.ts (kept in sync by hand).
 *
 * ── WHY THIS ONE DOES NOT FAIL OPEN ────────────────────────────────────────
 * `ideaBusinessCase.api.ts`'s fetch swallows every error and returns `null`
 * ("no case yet" and "the server is down" become the same value). That is
 * survivable for prose sections; it is NOT survivable here. If a load failure
 * silently rendered as an empty case, the user would start typing drivers into
 * what looks like a blank case and the first save would either overwrite real
 * stored data or 409 out of nowhere. So `fetchIdeaFinancialCase` distinguishes
 * "no row" (null) from "could not load" (throws), and the hook renders a real
 * error state for the second. This is the "no false success" rule applied to
 * the READ side, where this program has been burned before (an early `return`
 * on a flag once turned a backend failure into a cheerful "you have no data").
 */
import { apiGet, apiPut } from './baseClient';

import type { FinancialCaseInput, FinancialCaseResult } from '@/components/MyWork/table/financial/financialTypes';

export interface IdeaFinancialCasePayload {
  input: FinancialCaseInput;
  /** Last computed snapshot, or null when saved while empty/stale. Never faked. */
  result: FinancialCaseResult | null;
  lastComputedAt: string | null;
}

export interface IdeaFinancialCaseApiResult {
  id: string;
  ideaId: string;
  organizationId: string;
  payload: IdeaFinancialCasePayload;
  version: number;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Thrown on 409 so the caller can offer "reload from server" instead of clobbering. */
export class IdeaFinancialCaseConflictError extends Error {
  readonly current: IdeaFinancialCaseApiResult | null;
  readonly currentVersion: number | null;
  constructor(current: IdeaFinancialCaseApiResult | null, currentVersion: number | null) {
    super('Financial case was modified by someone else');
    this.name = 'IdeaFinancialCaseConflictError';
    this.current = current;
    this.currentVersion = currentVersion;
  }
}

/**
 * `null` = this idea genuinely has no financial case yet.
 * Throws = the load failed (network, 5xx, 503 unmigrated, 404 not visible).
 * The two are deliberately NOT collapsed — see the file header.
 */
export async function fetchIdeaFinancialCase(
  ideaId: string
): Promise<IdeaFinancialCaseApiResult | null> {
  const res = await apiGet<{ financialCase: IdeaFinancialCaseApiResult | null }>(
    `/idea-financial-case/${encodeURIComponent(ideaId)}`,
    'Could not load the financial case'
  );
  return res?.financialCase ?? null;
}

/**
 * Whole-case save under optimistic concurrency. Pass the `version` that came
 * back from the last load/save; omit it only when no row exists yet.
 * A 409 surfaces as `IdeaFinancialCaseConflictError` carrying the server's
 * current row, so the UI can show the conflict rather than silently winning.
 */
export async function saveIdeaFinancialCase(
  ideaId: string,
  payload: IdeaFinancialCasePayload,
  version?: number
): Promise<IdeaFinancialCaseApiResult> {
  try {
    const res = await apiPut<{ financialCase: IdeaFinancialCaseApiResult }>(
      `/idea-financial-case/${encodeURIComponent(ideaId)}`,
      {
        case: {
          input: payload.input,
          result: payload.result ?? null,
          lastComputedAt: payload.lastComputedAt ?? null,
        },
        ...(version !== undefined ? { version } : {}),
      },
      'Could not save the financial case'
    );
    return res.financialCase;
  } catch (err: any) {
    if (err?.status === 409 || err?.data?.code === 'IDEA_FINANCIAL_CASE_VERSION_CONFLICT') {
      throw new IdeaFinancialCaseConflictError(
        (err?.data?.financialCase as IdeaFinancialCaseApiResult) ?? null,
        typeof err?.data?.currentVersion === 'number' ? err.data.currentVersion : null
      );
    }
    throw err;
  }
}
