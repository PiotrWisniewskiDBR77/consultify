/**
 * Idea Business Case API client — Program D / epic E08.
 * Backend: server/src/routes/ideaBusinessCase.routes.ts.
 * Shape: src/types/ideaBusinessCase.ts.
 */
import { apiGet, apiPut } from './baseClient';

import type {
  IdeaBusinessCaseSections,
  UpsertIdeaBusinessCaseBody,
} from '@/types/ideaBusinessCase';

export interface IdeaBusinessCaseApiResult {
  id: string;
  ideaId: string;
  organizationId: string;
  sections: Partial<IdeaBusinessCaseSections>;
  version: number;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Fail-open: no case yet, missing table (migration not applied) or network error → null. */
export async function fetchIdeaBusinessCase(
  ideaId: string
): Promise<IdeaBusinessCaseApiResult | null> {
  try {
    const res = await apiGet<{ businessCase: IdeaBusinessCaseApiResult | null }>(
      `/idea-business-case/${encodeURIComponent(ideaId)}`
    );
    return res?.businessCase ?? null;
  } catch {
    return null;
  }
}

/**
 * Shallow per-section upsert — `sections` keys REPLACE the matching section
 * server-side, omitted keys are left untouched. Callers typically pass one
 * edited section (e.g. `{ problemBaseline: {...} }`), not the whole schema.
 */
export async function upsertIdeaBusinessCase(
  ideaId: string,
  sections: UpsertIdeaBusinessCaseBody['sections']
): Promise<IdeaBusinessCaseApiResult> {
  const res = await apiPut<{ businessCase: IdeaBusinessCaseApiResult }>(
    `/idea-business-case/${encodeURIComponent(ideaId)}`,
    { sections }
  );
  return res.businessCase;
}
