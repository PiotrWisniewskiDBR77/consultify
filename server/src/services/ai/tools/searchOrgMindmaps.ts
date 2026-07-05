/**
 * Tool: search_org_mindmaps (ff_teresaMindmap / ENABLE_TERESA_MINDMAP)
 *
 * Lets Teresa locate an existing organization idea-map (mind map) the user
 * references by topic ("znajdź mapę myśli o transformacji Apator") and inject
 * its serialized outline so the model can reason over the real structure.
 *
 * Data model (verified): `my_idea_maps` holds the graph in `nodes_json` /
 * `edges_json` and links to `my_ideas` via `idea_id`; the human title lives on
 * `my_ideas.title`. Scope is the caller's `organization_id` (org-scope, NOT
 * per-user) so any map in the org is discoverable.
 *
 * Matching: token-overlap over the idea title + the serialized node labels
 * (no FTS index on these tables). Serialization reuses the isomorphic
 * `ideaMapToMarkdown` (duplicated server-side in ../mindmapSerialize.ts).
 *
 * READ-only. Returns the compact { results, truncated } envelope (~4KB cap).
 * Co-gated: BOTH ENABLE_TERESA_RETRIEVAL and ENABLE_TERESA_MINDMAP must be on.
 */

import { all as dbAll } from '../../../utils/DbPromise.js';
import logger from '../../../utils/Logger.js';
import { parseMaybeJson } from '../../../utils/pgFlags.js';
import { ideaMapToMarkdown } from '../mindmapSerialize.js';
import {
  capResultPayload,
  clampLimit,
  isTeresaMindmapEnabled,
  isTeresaRetrievalEnabled,
  type OrgRetrievalEnvelope,
  toSnippet,
} from './orgRetrievalShared.js';

type SearchOrgMindmapsParams = {
  query: string;
  limit?: number;
};

type SearchOrgMindmapsContext = {
  organizationId?: string;
  userId?: string;
};

export interface OrgMindmapHit {
  mapId: string;
  ideaId: string;
  title: string;
  /** Serialized markdown outline of the graph (byte-capped). */
  outline: string;
  updatedAt: string | null;
}

interface MindmapRow {
  map_id?: string;
  idea_id?: string;
  title?: string;
  nodes_json?: unknown;
  edges_json?: unknown;
  updated_at?: string;
}

/** How many recent org maps to scan in-process for a match. */
const CANDIDATE_SCAN_LIMIT = 200;

/** Per-map outline byte cap — keep each result small so several fit in 4KB. */
const OUTLINE_MAX_BYTES = 1200;

function tokenize(query: string): string[] {
  return String(query || '')
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length >= 3);
}

export async function searchOrgMindmaps(
  params: SearchOrgMindmapsParams,
  context: SearchOrgMindmapsContext = {}
): Promise<OrgRetrievalEnvelope<OrgMindmapHit>> {
  // Co-gate: the mind-map retrieval path requires BOTH flags on.
  if (!isTeresaRetrievalEnabled() || !isTeresaMindmapEnabled()) {
    return { results: [], truncated: false };
  }

  const orgId = String(context.organizationId || '').trim();
  if (!orgId) {
    logger.warn('[searchOrgMindmaps] Missing organizationId in tool context — returning empty');
    return { results: [], truncated: false };
  }

  const query = String(params.query || '')
    .trim()
    .slice(0, 300);
  if (!query) return { results: [], truncated: false };

  const tokens = tokenize(query);
  if (tokens.length === 0) return { results: [], truncated: false };

  const limit = clampLimit(params.limit);

  // Org-scoped candidate scan. Join maps to their idea for the title.
  // `?` placeholders only (DbPromise translates to $n for pg). fallback:true so
  // a missing table under mock-DB yields [] instead of throwing.
  let rows: MindmapRow[] = [];
  try {
    rows = (await dbAll(
      `SELECT m.id AS map_id,
              m.idea_id AS idea_id,
              i.title AS title,
              m.nodes_json AS nodes_json,
              m.edges_json AS edges_json,
              m.updated_at AS updated_at
       FROM my_idea_maps m
       JOIN my_ideas i ON i.id = m.idea_id AND i.organization_id = m.organization_id
       WHERE m.organization_id = ?
       ORDER BY m.updated_at DESC
       LIMIT ?`,
      [orgId, CANDIDATE_SCAN_LIMIT],
      { fallback: true } as any
    )) as MindmapRow[];
  } catch (err: any) {
    logger.debug(`[searchOrgMindmaps] candidate scan failed (non-fatal): ${err?.message}`);
    return { results: [], truncated: false };
  }

  const scored = (rows || [])
    .map((row) => {
      const nodes = parseMaybeJson<any[]>(row.nodes_json, []);
      const edges = parseMaybeJson<any[]>(row.edges_json, []);
      const title = String(row.title || '').trim();
      const outline = ideaMapToMarkdown(
        { nodes: Array.isArray(nodes) ? nodes : [], edges: Array.isArray(edges) ? edges : [] },
        { title: title || undefined, maxBytes: OUTLINE_MAX_BYTES }
      );
      // Score over the title + serialized node labels (the outline text).
      const haystack = `${title} ${outline}`.toLowerCase();
      const score = tokens.reduce((acc, t) => acc + (haystack.includes(t) ? 1 : 0), 0);
      return { row, title, outline, score };
    })
    .filter((s) => s.score > 0 && s.row.map_id)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return capResultPayload(
    scored.map(({ row, title, outline }) => ({
      mapId: String(row.map_id),
      ideaId: String(row.idea_id || ''),
      title: toSnippet(title, 200),
      // outline is already newline-preserving markdown, byte-capped by the
      // serializer; do NOT run it through toSnippet (that collapses newlines).
      outline,
      updatedAt: row.updated_at ? String(row.updated_at) : null,
    }))
  );
}

export default { searchOrgMindmaps };
