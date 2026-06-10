/**
 * Tool: search_org_notes (ff_teresaRetrieval / ENABLE_TERESA_RETRIEVAL)
 *
 * Wraps notebookService.semanticSearch (FTS + embedding hybrid, permission-safe)
 * scoped to the caller's organizationId so Teresa can locate a notebook page
 * the user references by topic ("notatka o spotkaniu z Elkomtech").
 *
 * READ-only. Returns the compact { results, truncated } envelope (~4KB cap).
 */

import { all as dbAll } from '../../../utils/DbPromise.js';
import logger from '../../../utils/Logger.js';
import notebookService from '../../notebookService.js';
import {
  capResultPayload,
  clampLimit,
  isTeresaRetrievalEnabled,
  type OrgRetrievalEnvelope,
  toSnippet,
} from './orgRetrievalShared.js';

type SearchOrgNotesParams = {
  query: string;
  limit?: number;
};

type SearchOrgNotesContext = {
  organizationId?: string;
  userId?: string;
};

export interface OrgNoteHit {
  pageId: string;
  title: string;
  snippet: string;
  updatedAt: string | null;
}

export async function searchOrgNotes(
  params: SearchOrgNotesParams,
  context: SearchOrgNotesContext = {}
): Promise<OrgRetrievalEnvelope<OrgNoteHit>> {
  if (!isTeresaRetrievalEnabled()) {
    return { results: [], truncated: false };
  }

  const orgId = String(context.organizationId || '').trim();
  const userId = String(context.userId || '').trim();
  if (!orgId || !userId) {
    logger.warn('[searchOrgNotes] Missing organizationId/userId in tool context — returning empty');
    return { results: [], truncated: false };
  }

  const query = String(params.query || '')
    .trim()
    .slice(0, 300);
  if (!query) return { results: [], truncated: false };

  const limit = clampLimit(params.limit);

  const hits = await notebookService.semanticSearch(orgId, userId, query, { limit });

  // semanticSearch does not return updated_at — fetch it in one org-scoped pass.
  const updatedAtById = new Map<string, string>();
  if (hits.length > 0) {
    try {
      const placeholders = hits.map(() => '?').join(', ');
      const rows = (await dbAll(
        `SELECT id, updated_at FROM notebook_pages
         WHERE organization_id = ? AND id IN (${placeholders})`,
        [orgId, ...hits.map((h) => h.pageId)],
        { fallback: true } as any
      )) as Array<{ id?: string; updated_at?: string }>;
      for (const row of rows || []) {
        if (row?.id) updatedAtById.set(String(row.id), String(row.updated_at || ''));
      }
    } catch (err: any) {
      logger.debug(`[searchOrgNotes] updated_at lookup failed (non-fatal): ${err?.message}`);
    }
  }

  return capResultPayload(
    hits.map((h) => ({
      pageId: h.pageId,
      title: toSnippet(h.title, 200),
      snippet: toSnippet(h.snippet, 300),
      updatedAt: updatedAtById.get(h.pageId) || null,
    }))
  );
}

export default { searchOrgNotes };
