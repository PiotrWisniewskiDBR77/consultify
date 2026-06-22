/**
 * Initiative similarity / duplicate detection (M13 Depth · Seria C · C1).
 *
 * "Portfolio-aware" generation (mapa myśli: "analiza inicjatyw obecnych w
 * strukturze wszystkich inicjatyw"): before creating/generating a new
 * initiative, surface existing ones in the org that look like duplicates, so
 * the user doesn't spin up a near-identical initiative.
 *
 * Pure lexical similarity (Jaccard over normalized tokens) — no LLM, cheap,
 * deterministic. Org-scoped. Excludes terminal (CANCELLED/ARCHIVED) rows.
 */
import * as queryHelpers from '../../utils/queryHelpers.js';
import logger from '../../utils/Logger.js';
import { jaccardSimilarity } from './similarityPrimitives.js';

export interface SimilarInitiative {
  id: string;
  name: string;
  status: string | null;
  /** 0..1 Jaccard similarity against the candidate */
  score: number;
}

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'of', 'to', 'for', 'in', 'on', 'with', 'by',
  'i', 'oraz', 'dla', 'do', 'na', 'w', 'z', 'ze', 'o', 'jest', 'inicjatywa',
  'initiative', 'projekt', 'project',
]);

/** Lowercase → token set, drop stopwords + short tokens. */
export function tokenize(text: string): Set<string> {
  const out = new Set<string>();
  for (const raw of String(text || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^a-z0-9]+/)) {
    if (raw.length >= 3 && !STOPWORDS.has(raw)) out.add(raw);
  }
  return out;
}

/**
 * Jaccard similarity (kept as a named export — used by callers & tests).
 * Delegates to the shared primitive; behavior is identical.
 */
export function jaccard(a: Set<string>, b: Set<string>): number {
  return jaccardSimilarity(a, b);
}

/**
 * Find existing org initiatives similar to a candidate {name, summary}.
 * Returns matches with score >= threshold, sorted desc, capped at `limit`.
 */
export async function findSimilarInitiatives(
  organizationId: string,
  candidate: { name?: string; summary?: string },
  opts?: { threshold?: number; limit?: number; excludeId?: string }
): Promise<SimilarInitiative[]> {
  const orgId = String(organizationId || '').trim();
  if (!orgId) return [];
  const threshold = opts?.threshold ?? 0.25;
  const limit = opts?.limit ?? 5;

  const candTokens = new Set<string>([
    ...tokenize(candidate.name || ''),
    ...tokenize(candidate.summary || ''),
  ]);
  if (candTokens.size === 0) return [];

  let rows: Array<{ id: string; name: string; summary: string; status: string }> = [];
  try {
    rows = await queryHelpers.queryAll(
      `SELECT id,
              COALESCE(title, name, '') AS name,
              COALESCE(summary, '')     AS summary,
              status
         FROM initiatives
        WHERE organization_id = ?
          AND UPPER(COALESCE(status, '')) NOT IN ('CANCELLED', 'ARCHIVED')
        LIMIT 500`,
      [orgId]
    );
  } catch (e: any) {
    // Non-fatal: dedup is advisory. Never block creation on a query error.
    logger.warn('[initiatives] similarity query failed:', e?.message);
    return [];
  }

  const scored: SimilarInitiative[] = [];
  for (const r of rows) {
    if (opts?.excludeId && String(r.id) === String(opts.excludeId)) continue;
    const tokens = new Set<string>([...tokenize(r.name), ...tokenize(r.summary)]);
    const score = jaccard(candTokens, tokens);
    if (score >= threshold) {
      scored.push({ id: String(r.id), name: r.name, status: r.status ?? null, score });
    }
  }

  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}
