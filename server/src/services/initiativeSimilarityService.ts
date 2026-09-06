/**
 * Initiative Similarity Service
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Detects whether AI-proposed initiative candidates duplicate or closely
 * resemble initiatives that already exist (and are still active) in the
 * organization / project. Used by the AI Initiative Wizard so the generator
 * does NOT propose initiatives the org already has.
 *
 * Strategy:
 *  - Primary: semantic cosine similarity over OpenAI text embeddings
 *    (the same EmbeddingService used by KnowledgeService / ragService).
 *  - Fallback: cheap, deterministic token Jaccard overlap on normalized
 *    title + description. Used when embeddings are not configured / fail,
 *    so the feature always returns a useful verdict and never blocks the wizard.
 *
 * @module services/initiativeSimilarityService
 */

import { InitiativeStatus } from '../constants/initiativeStatuses.js';
import logger from '../utils/Logger.js';
import * as queryHelpers from '../utils/queryHelpers.js';
import { EmbeddingService } from './ai/embeddingService.js';
import { jaccardSimilarity } from './initiative/similarityPrimitives.js';

const embeddingService = new EmbeddingService();

// Cap how many existing initiatives we compare against per request to keep
// embedding cost / latency bounded. If exceeded, we log and truncate.
const MAX_EXISTING_INITIATIVES = 200;

// Terminal / out-of-scope statuses that should NOT count as existing coverage.
// We exclude cancelled, archived, and completed (DONE) so the wizard only warns
// about initiatives that are genuinely "live" in the org/project right now.
const EXCLUDED_STATUSES = new Set<string>([
  InitiativeStatus.REJECTED.toUpperCase(),
  InitiativeStatus.CLOSED.toUpperCase(),
]);

export type SimilarityVerdict = 'duplicate' | 'similar' | 'related' | 'new';

export interface SimilarityCandidateInput {
  title: string;
  description?: string | null;
}

export interface SimilarityMatch {
  id: string;
  title: string;
  status: string;
  owner?: string | null;
  score: number;
}

export interface SimilarityCandidateResult {
  candidateIndex: number;
  matches: SimilarityMatch[];
  topScore: number;
  verdict: SimilarityVerdict;
}

export interface CheckSimilarInitiativesParams {
  orgId: string;
  projectId?: string | null;
  candidates: SimilarityCandidateInput[];
}

export interface CheckSimilarInitiativesResult {
  results: SimilarityCandidateResult[];
  method: 'embeddings' | 'token-overlap';
  comparedCount: number;
  truncated: boolean;
}

interface ExistingInitiativeRow {
  id?: string | null;
  title?: string | null;
  name?: string | null;
  summary?: string | null;
  problem_statement?: string | null;
  status?: string | null;
  owner_name?: string | null;
}

interface ExistingInitiative {
  id: string;
  title: string;
  status: string;
  owner: string | null;
  text: string;
}

// Verdict thresholds (cosine similarity or normalized Jaccard, both 0..1).
const DUPLICATE_THRESHOLD = 0.7;
const SIMILAR_THRESHOLD = 0.5;
const RELATED_THRESHOLD = 0.3;

const MAX_MATCHES_PER_CANDIDATE = 5;

function verdictForScore(score: number): SimilarityVerdict {
  if (score >= DUPLICATE_THRESHOLD) return 'duplicate';
  if (score >= SIMILAR_THRESHOLD) return 'similar';
  if (score >= RELATED_THRESHOLD) return 'related';
  return 'new';
}

function buildCandidateText(candidate: SimilarityCandidateInput): string {
  return [candidate.title || '', candidate.description || ''].join(' ').trim();
}

function buildExistingText(row: ExistingInitiativeRow): string {
  return [row.title || row.name || '', row.summary || row.problem_statement || ''].join(' ').trim();
}

// ---------------------------------------------------------------------------
// Similarity primitives
// ---------------------------------------------------------------------------

function cosineSimilarity(a: number[], b: number[]): number {
  if (!a.length || !b.length || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  const sim = dot / (Math.sqrt(normA) * Math.sqrt(normB));
  // Clamp to [0,1] — embeddings can yield tiny negatives; treat those as 0.
  if (sim < 0) return 0;
  if (sim > 1) return 1;
  return sim;
}

const STOPWORDS = new Set<string>([
  // PL
  'i',
  'oraz',
  'lub',
  'w',
  'na',
  'do',
  'dla',
  'z',
  'ze',
  'o',
  'a',
  'aby',
  'jako',
  'przez',
  'po',
  'od',
  'the',
  'this',
  'project',
  // EN
  'and',
  'or',
  'of',
  'to',
  'for',
  'with',
  'in',
  'on',
  'a',
  'an',
  'by',
  'as',
  'at',
]);

function tokenize(text: string): Set<string> {
  const tokens = text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics so combining marks are removed
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((tok) => tok.length > 2 && !STOPWORDS.has(tok));
  return new Set(tokens);
}

// jaccardSimilarity is shared with the C1 portfolio-dedup service via
// ./initiative/similarityPrimitives.js (imported above) — identical behavior.

// ---------------------------------------------------------------------------
// Data access
// ---------------------------------------------------------------------------

async function loadExistingInitiatives(
  orgId: string,
  projectId?: string | null
): Promise<{ initiatives: ExistingInitiative[]; truncated: boolean }> {
  const params: unknown[] = [String(orgId)];
  let sql = `
    SELECT i.id            AS id,
           i.title         AS title,
           i.name          AS name,
           i.summary       AS summary,
           i.problem_statement AS problem_statement,
           i.status        AS status,
           TRIM(COALESCE(ob.first_name, '') || ' ' || COALESCE(ob.last_name, '')) AS owner_name
      FROM initiatives i
      LEFT JOIN users ob ON i.owner_business_id = ob.id
     WHERE i.organization_id = ?`;

  if (projectId) {
    sql += ` AND i.project_id = ?`;
    params.push(String(projectId));
  }

  sql += ` ORDER BY i.updated_at DESC`;

  let rows: ExistingInitiativeRow[] = [];
  try {
    rows = await queryHelpers.queryAll<ExistingInitiativeRow>(sql, params);
  } catch (error: unknown) {
    // Owner join can fail if the users table differs; retry without it.
    logger.warn(
      '[InitiativeSimilarity] owner-join query failed, retrying without owner:',
      (error as Error)?.message
    );
    const fallbackParams: unknown[] = [String(orgId)];
    let fallbackSql = `
      SELECT id, title, name, summary, problem_statement, status
        FROM initiatives
       WHERE organization_id = ?`;
    if (projectId) {
      fallbackSql += ` AND project_id = ?`;
      fallbackParams.push(String(projectId));
    }
    fallbackSql += ` ORDER BY updated_at DESC`;
    rows = await queryHelpers.queryAll<ExistingInitiativeRow>(fallbackSql, fallbackParams);
  }

  const active = rows
    .filter((row) => {
      const status = String(row.status || '').toUpperCase();
      return !EXCLUDED_STATUSES.has(status);
    })
    .map<ExistingInitiative>((row) => ({
      id: String(row.id || ''),
      title: String(row.title || row.name || 'Initiative'),
      status: String(row.status || ''),
      owner: row.owner_name ? row.owner_name.trim() || null : null,
      text: buildExistingText(row),
    }))
    .filter((item) => item.id && item.text.length > 0);

  const truncated = active.length > MAX_EXISTING_INITIATIVES;
  if (truncated) {
    logger.info(
      `[InitiativeSimilarity] Org ${orgId} has ${active.length} active initiatives; ` +
        `truncating comparison to ${MAX_EXISTING_INITIATIVES}.`
    );
  }

  return { initiatives: active.slice(0, MAX_EXISTING_INITIATIVES), truncated };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compare each candidate initiative against the org's existing active
 * initiatives and return a per-candidate verdict.
 */
export async function checkSimilarInitiatives(
  params: CheckSimilarInitiativesParams
): Promise<CheckSimilarInitiativesResult> {
  const { orgId, projectId, candidates } = params;

  const safeCandidates = Array.isArray(candidates) ? candidates : [];
  if (safeCandidates.length === 0) {
    return { results: [], method: 'token-overlap', comparedCount: 0, truncated: false };
  }

  const { initiatives: existing, truncated } = await loadExistingInitiatives(orgId, projectId);

  // No existing initiatives → everything is "new" by definition.
  if (existing.length === 0) {
    return {
      results: safeCandidates.map((_candidate, index) => ({
        candidateIndex: index,
        matches: [],
        topScore: 0,
        verdict: 'new' as SimilarityVerdict,
      })),
      method: 'token-overlap',
      comparedCount: 0,
      truncated,
    };
  }

  // Try embeddings first; fall back to token overlap on any failure.
  let scorer:
    | { method: 'embeddings'; score: (candidateIndex: number, existingIndex: number) => number }
    | { method: 'token-overlap'; score: (candidateIndex: number, existingIndex: number) => number };

  try {
    const candidateEmbeddings = await Promise.all(
      safeCandidates.map((candidate) =>
        embeddingService.generateEmbedding(buildCandidateText(candidate))
      )
    );
    const existingEmbeddings = await Promise.all(
      existing.map((item) => embeddingService.generateEmbedding(item.text))
    );
    scorer = {
      method: 'embeddings',
      score: (ci, ei) => cosineSimilarity(candidateEmbeddings[ci], existingEmbeddings[ei]),
    };
  } catch (error: unknown) {
    logger.warn(
      '[InitiativeSimilarity] Embedding similarity unavailable, falling back to token overlap:',
      (error as Error)?.message
    );
    const candidateTokens = safeCandidates.map((candidate) =>
      tokenize(buildCandidateText(candidate))
    );
    const existingTokens = existing.map((item) => tokenize(item.text));
    scorer = {
      method: 'token-overlap',
      score: (ci, ei) => jaccardSimilarity(candidateTokens[ci], existingTokens[ei]),
    };
  }

  const results: SimilarityCandidateResult[] = safeCandidates.map((_candidate, candidateIndex) => {
    const matches: SimilarityMatch[] = existing
      .map((item, existingIndex) => ({
        id: item.id,
        title: item.title,
        status: item.status,
        owner: item.owner,
        score: Number(scorer.score(candidateIndex, existingIndex).toFixed(4)),
      }))
      .filter((match) => match.score >= RELATED_THRESHOLD)
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_MATCHES_PER_CANDIDATE);

    const topScore = matches.length > 0 ? matches[0].score : 0;
    return {
      candidateIndex,
      matches,
      topScore,
      verdict: verdictForScore(topScore),
    };
  });

  return {
    results,
    method: scorer.method,
    comparedCount: existing.length,
    truncated,
  };
}

export default { checkSimilarInitiatives };
