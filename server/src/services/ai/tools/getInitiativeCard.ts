/**
 * Tool: get_initiative (ff_teresaRetrieval / ENABLE_TERESA_RETRIEVAL)
 *
 * Fetches one initiative's core fields via initiativeService, org-scoped:
 * getInitiativeById(id, organizationId) adds `AND organization_id = ?`, so a
 * cross-org id yields a clean not-found result instead of leaking data.
 *
 * Named getInitiativeCard.ts to avoid clashing with the existing
 * createInitiative.ts tool file naming in this directory.
 *
 * READ-only. Returns the compact { results, truncated } envelope (~4KB cap).
 */

import logger from '../../../utils/Logger.js';
import initiativeService from '../../initiativeService.js';
import {
  capResultPayload,
  isTeresaRetrievalEnabled,
  type OrgRetrievalEnvelope,
  toSnippet,
} from './orgRetrievalShared.js';

type GetInitiativeParams = {
  initiativeId: string;
};

type GetInitiativeContext = {
  organizationId?: string;
  userId?: string;
};

export interface InitiativeCard {
  id: string;
  title: string;
  summary: string;
  status: string;
  axis: string | null;
  area: string | null;
  updatedAt: string | null;
}

export type GetInitiativeResult = OrgRetrievalEnvelope<InitiativeCard> & { notFound?: boolean };

export async function getInitiative(
  params: GetInitiativeParams,
  context: GetInitiativeContext = {}
): Promise<GetInitiativeResult> {
  if (!isTeresaRetrievalEnabled()) {
    return { results: [], truncated: false };
  }

  const orgId = String(context.organizationId || '').trim();
  if (!orgId) {
    logger.warn('[getInitiative] Missing organizationId in tool context — returning not-found');
    return { results: [], truncated: false, notFound: true };
  }

  const initiativeId = String(params.initiativeId || '').trim();
  if (!initiativeId) return { results: [], truncated: false, notFound: true };

  // organizationId is passed so the underlying query is `id = ? AND organization_id = ?`
  // — a foreign org's initiative resolves to null (no cross-org leak).
  const initiative = await initiativeService.getInitiativeById(initiativeId, orgId);
  if (!initiative || String(initiative.organization_id || '') !== orgId) {
    return { results: [], truncated: false, notFound: true };
  }

  return capResultPayload([
    {
      id: initiative.id,
      title: toSnippet(initiative.title, 200),
      summary: toSnippet(
        initiative.summary || initiative.hypothesis || initiative.business_value || '',
        500
      ),
      status: String(initiative.status || ''),
      axis: initiative.axis || null,
      area: initiative.area || null,
      updatedAt: initiative.updated_at || null,
    },
  ]);
}

export default { getInitiative };
