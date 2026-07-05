/**
 * Portfolio MECE check (uspójnienie F3.7).
 *
 * Before committing a batch of candidate initiatives, validate the proposed
 * portfolio against the EXISTING one for MECE-ness ("Mutually Exclusive,
 * Collectively Exhaustive"):
 *
 *   - Mutually Exclusive  → OVERLAPS: a candidate duplicates / heavily overlaps
 *     an existing initiative (similar title, same goalKey, or shared keywords).
 *   - Collectively Exhaustive → GAPS: existing goalKeys that NO candidate (and
 *     no existing initiative) is shown to cover are surfaced so the user knows
 *     which goals remain unaddressed by the proposed batch.
 *
 * Pure, deterministic, no LLM, no DB — the route is responsible for loading the
 * org's existing initiatives and passing them in. Lexical similarity reuses the
 * shared {@link jaccardSimilarity} primitive (same engine as C1 dedup) so the
 * notion of "similar" is consistent across the module.
 *
 * @module services/initiative/portfolioMeceService
 */
import { jaccardSimilarity } from './similarityPrimitives.js';

export interface MeceExistingInitiative {
  id: string;
  title: string;
  summary?: string;
  goalKey?: string;
}

export interface MeceCandidate {
  title: string;
  description?: string;
  goalKey?: string;
}

export interface MeceOverlap {
  candidateTitle: string;
  existingId: string;
  reason: string;
}

export interface PortfolioMeceResult {
  overlaps: MeceOverlap[];
  gaps: string[];
  /** 0..100 — share of distinct existing goalKeys that are covered. */
  coveragePct: number;
}

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'of', 'to', 'for', 'in', 'on', 'with', 'by',
  'i', 'oraz', 'dla', 'do', 'na', 'w', 'z', 'ze', 'o', 'jest', 'inicjatywa',
  'initiative', 'projekt', 'project',
]);

/** Lowercase → token set, drop stopwords + short tokens. */
function tokenize(text: string): Set<string> {
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

function normGoalKey(k?: string): string {
  return String(k || '').trim().toLowerCase();
}

/** Similarity threshold above which two token sets are treated as "overlapping". */
const OVERLAP_THRESHOLD = 0.4;

/**
 * Check a batch of candidate initiatives against the existing portfolio for MECE.
 *
 * Overlap is flagged when a candidate, versus an existing initiative, has any of:
 *   1. identical (normalized) goalKey,
 *   2. lexical similarity over {title+body} ≥ OVERLAP_THRESHOLD,
 *   3. a near-identical normalized title.
 * Only the strongest reason per (candidate, existing) pair is reported.
 *
 * Coverage = (# distinct existing goalKeys covered by some candidate OR existing
 * initiative) / (# distinct existing goalKeys). Gaps are the uncovered ones.
 * When there are no existing goalKeys, coverage is reported as 100 (nothing to
 * cover) and gaps is empty.
 */
export function checkPortfolioMece(
  existing: MeceExistingInitiative[],
  candidates: MeceCandidate[]
): PortfolioMeceResult {
  const safeExisting = Array.isArray(existing) ? existing : [];
  const safeCandidates = Array.isArray(candidates) ? candidates : [];

  // Precompute existing token sets + normalized titles/goalKeys.
  const existingInfo = safeExisting.map((e) => ({
    id: String(e.id),
    title: String(e.title || ''),
    goalKey: normGoalKey(e.goalKey),
    titleNorm: String(e.title || '').trim().toLowerCase(),
    tokens: new Set<string>([...tokenize(e.title || ''), ...tokenize(e.summary || '')]),
  }));

  const overlaps: MeceOverlap[] = [];

  for (const c of safeCandidates) {
    const candTitle = String(c.title || '');
    const candGoalKey = normGoalKey(c.goalKey);
    const candTitleNorm = candTitle.trim().toLowerCase();
    const candTokens = new Set<string>([
      ...tokenize(candTitle),
      ...tokenize(c.description || ''),
    ]);

    for (const e of existingInfo) {
      let reason: string | null = null;

      if (candGoalKey && e.goalKey && candGoalKey === e.goalKey) {
        reason = `Ten sam cel (goalKey="${e.goalKey}")`;
      } else if (candTitleNorm && candTitleNorm === e.titleNorm) {
        reason = `Identyczny tytuł ("${e.title}")`;
      } else {
        const score = jaccardSimilarity(candTokens, e.tokens);
        if (score >= OVERLAP_THRESHOLD) {
          reason = `Podobieństwo treści ${Math.round(score * 100)}% z "${e.title}"`;
        }
      }

      if (reason) {
        overlaps.push({ candidateTitle: candTitle, existingId: e.id, reason });
      }
    }
  }

  // --- Collectively Exhaustive: goalKey coverage ---------------------------
  const existingGoalKeys = new Set<string>();
  for (const e of existingInfo) {
    if (e.goalKey) existingGoalKeys.add(e.goalKey);
  }

  // A goalKey is "covered" if some candidate targets it (candidates are the
  // proposed forward plan). Existing initiatives already cover their own goal,
  // so a goalKey with an existing initiative AND no candidate is NOT a gap — it
  // is already served. A gap = an existing goalKey that no candidate addresses
  // AND that has no existing initiative still serving it... which by definition
  // every existing goalKey has. So gaps here = existing goalKeys NOT picked up
  // by any candidate, signalling the batch does not extend/refresh that goal.
  const candidateGoalKeys = new Set<string>();
  for (const c of safeCandidates) {
    const k = normGoalKey(c.goalKey);
    if (k) candidateGoalKeys.add(k);
  }

  const gaps: string[] = [];
  for (const k of existingGoalKeys) {
    if (!candidateGoalKeys.has(k)) gaps.push(k);
  }
  gaps.sort();

  const total = existingGoalKeys.size;
  const covered = total - gaps.length;
  const coveragePct = total === 0 ? 100 : Math.round((covered / total) * 100);

  return { overlaps, gaps, coveragePct };
}
