/**
 * proposalReconciliation — pure, deterministic core for the Initiative Generator.
 *
 * Implements the "reconciliation with the living siatka" doctrine from
 * docs/initiatives/INITIATIVE_FORMULA.md §5: every generated candidate is classified
 * by its RELATION to the existing initiative grid (not just duplicate↔new), and a
 * portfolio-level MECE coverage report (gaps + overlaps) is produced.
 *
 * Additive & decoupled on purpose: defines its own light input types so it does NOT
 * depend on the initiative model files currently being rebuilt by another agent.
 * No AI / no network — same inputs always yield the same output (auditable + testable).
 *
 * Relations that need judgment beyond text similarity (conflict / depends_on /
 * re_prioritize) are HINT-DRIVEN: the upstream evidence/AI layer passes an explicit
 * reference, and this core simply honors it. Similarity-derivable relations
 * (duplicate / extend / evidence_only / contributes_to_goal / new) are computed here.
 */

export type ProposalRelation =
  | 'new'
  | 'duplicate'
  | 'extend'
  | 'evidence_only'
  | 'conflict'
  | 'depends_on'
  | 're_prioritize'
  | 'contributes_to_goal';

export interface CandidateInput {
  title: string;
  description?: string;
  /** Value-driver / theme tags. */
  tags?: string[];
  /** Strategic objective / value-driver this candidate addresses. */
  goalKey?: string;
  /** True if the candidate brings genuinely new scope (vs only reinforcing). Default true. */
  novelScope?: boolean;
  /** Explicit hints from the evidence/AI layer (override similarity classification). */
  conflictsWithInitiativeId?: string;
  dependsOnInitiativeId?: string;
  rePrioritizeInitiativeId?: string;
}

export interface ExistingInitiative {
  id: string;
  title: string;
  description?: string;
  tags?: string[];
  goalKey?: string;
  /** Lifecycle status — terminal ones are excluded from matching. */
  status?: string;
}

export interface ClassifiedProposal {
  candidate: CandidateInput;
  relation: ProposalRelation;
  matchedInitiativeId?: string;
  /** Title similarity 0..1 to the matched initiative (0 when none). */
  score: number;
  rationale: string;
}

export interface ReconcileContext {
  /** All strategic goals/value-drivers the transformation must cover (for gap detection). */
  goalKeys?: string[];
}

export interface CoverageReport {
  /** goalKeys with no active initiative and no new/contributing candidate → white spots. */
  gaps: string[];
  /** Heavy-overlap pairs (MECE violation) among active existing + new candidates. */
  overlaps: Array<{ a: string; b: string; score: number }>;
}

export interface ReconcileResult {
  proposals: ClassifiedProposal[];
  coverage: CoverageReport;
}

// ── Tunables ────────────────────────────────────────────────────────────────
const DUPLICATE_THRESHOLD = 0.6; // ≥ → same initiative
const EXTEND_THRESHOLD = 0.28; // ≥ (and < dup) → refines an existing one
const TERMINAL_STATUSES = new Set(['DONE', 'CANCELLED', 'ARCHIVED', 'TRACKING']);

const STOPWORDS = new Set([
  'the',
  'a',
  'an',
  'and',
  'or',
  'of',
  'for',
  'to',
  'in',
  'on',
  'with',
  'by',
  'at',
  'initiative',
  'project',
  'program',
  'process',
  'improve',
  'improvement',
  'reduce',
]);

/** Lowercase → strip punctuation → drop short/stopwords → light singularization. */
export function normalizeTokens(text: string): Set<string> {
  const tokens = (text || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .map((t) => t.replace(/s$/, '')) // light stem: handoffs → handoff
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t));
  return new Set(tokens);
}

/** Jaccard similarity of two token sets (0..1). */
export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter += 1;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

const isActive = (i: ExistingInitiative): boolean =>
  !TERMINAL_STATUSES.has((i.status || '').toUpperCase());

const tagsOverlap = (a?: string[], b?: string[]): boolean => {
  if (!a?.length || !b?.length) return false;
  const set = new Set(a.map((t) => t.toLowerCase()));
  return b.some((t) => set.has(t.toLowerCase()));
};

/** Classify one candidate's relation to the existing grid. */
export function classifyProposalRelation(
  candidate: CandidateInput,
  existing: ExistingInitiative[]
): ClassifiedProposal {
  // 1) Explicit judgment hints win.
  if (candidate.conflictsWithInitiativeId) {
    return {
      candidate,
      relation: 'conflict',
      matchedInitiativeId: candidate.conflictsWithInitiativeId,
      score: 0,
      rationale: 'New evidence contradicts a running initiative (explicit hint).',
    };
  }
  if (candidate.dependsOnInitiativeId) {
    return {
      candidate,
      relation: 'depends_on',
      matchedInitiativeId: candidate.dependsOnInitiativeId,
      score: 0,
      rationale: 'Only makes sense with/after another initiative (explicit hint).',
    };
  }
  if (candidate.rePrioritizeInitiativeId) {
    return {
      candidate,
      relation: 're_prioritize',
      matchedInitiativeId: candidate.rePrioritizeInitiativeId,
      score: 0,
      rationale: 'New data changes the weight of an existing initiative (explicit hint).',
    };
  }

  // 2) Similarity-derived relations against ACTIVE initiatives.
  const candTokens = normalizeTokens(`${candidate.title} ${candidate.description || ''}`);
  let best: { init: ExistingInitiative; score: number } | null = null;
  for (const init of existing) {
    if (!isActive(init)) continue;
    const score = jaccard(candTokens, normalizeTokens(`${init.title} ${init.description || ''}`));
    if (!best || score > best.score) best = { init, score };
  }

  if (best && best.score >= DUPLICATE_THRESHOLD) {
    return {
      candidate,
      relation: 'duplicate',
      matchedInitiativeId: best.init.id,
      score: best.score,
      rationale: `Near-identical to "${best.init.title}".`,
    };
  }
  if (best && best.score >= EXTEND_THRESHOLD) {
    return {
      candidate,
      relation: 'extend',
      matchedInitiativeId: best.init.id,
      score: best.score,
      rationale: `Refines/extends "${best.init.title}" (shared theme, new scope).`,
    };
  }

  // 3) Goal-anchored relations (low title overlap but same strategic goal).
  if (candidate.goalKey) {
    const sameGoal = existing.find(
      (i) => isActive(i) && i.goalKey && i.goalKey === candidate.goalKey
    );
    if (sameGoal) {
      if (candidate.novelScope === false) {
        return {
          candidate,
          relation: 'evidence_only',
          matchedInitiativeId: sameGoal.id,
          score: best?.score ?? 0,
          rationale: `Reinforces "${sameGoal.title}" (same goal, no new scope).`,
        };
      }
      return {
        candidate,
        relation: 'contributes_to_goal',
        matchedInitiativeId: sameGoal.id,
        score: best?.score ?? 0,
        rationale: `New initiative under shared goal "${candidate.goalKey}".`,
      };
    }
  }

  // 4) Tag-anchored grouping (shares a value-driver tag with an active initiative).
  if (candidate.novelScope !== false) {
    const sameTag = existing.find((i) => isActive(i) && tagsOverlap(candidate.tags, i.tags));
    if (sameTag) {
      return {
        candidate,
        relation: 'contributes_to_goal',
        matchedInitiativeId: sameTag.id,
        score: best?.score ?? 0,
        rationale: `Shares a value-driver with "${sameTag.title}".`,
      };
    }
  }

  // 5) Nothing close → genuinely new.
  return {
    candidate,
    relation: 'new',
    score: best?.score ?? 0,
    rationale: 'No close match in the grid.',
  };
}

/** Reconcile a batch of candidates against the grid + produce MECE coverage. */
export function reconcileProposals(
  candidates: CandidateInput[],
  existing: ExistingInitiative[],
  context: ReconcileContext = {}
): ReconcileResult {
  const proposals = candidates.map((c) => classifyProposalRelation(c, existing));

  // Coverage gaps: goals with neither an active initiative nor a new/contributing candidate.
  const coveredGoals = new Set<string>();
  for (const i of existing) if (isActive(i) && i.goalKey) coveredGoals.add(i.goalKey);
  for (const p of proposals) {
    if ((p.relation === 'new' || p.relation === 'contributes_to_goal') && p.candidate.goalKey) {
      coveredGoals.add(p.candidate.goalKey);
    }
  }
  const gaps = (context.goalKeys || []).filter((g) => !coveredGoals.has(g));

  // Overlaps: heavy title similarity among active existing + new candidates (MECE violation).
  const overlaps: CoverageReport['overlaps'] = [];
  const grid: Array<{ id: string; tokens: Set<string> }> = [
    ...existing.filter(isActive).map((i) => ({
      id: i.id,
      tokens: normalizeTokens(`${i.title} ${i.description || ''}`),
    })),
    ...proposals
      .filter((p) => p.relation === 'new')
      .map((p, idx) => ({
        id: `candidate:${idx}:${p.candidate.title}`,
        tokens: normalizeTokens(`${p.candidate.title} ${p.candidate.description || ''}`),
      })),
  ];
  for (let i = 0; i < grid.length; i += 1) {
    for (let j = i + 1; j < grid.length; j += 1) {
      const score = jaccard(grid[i].tokens, grid[j].tokens);
      if (score >= DUPLICATE_THRESHOLD) overlaps.push({ a: grid[i].id, b: grid[j].id, score });
    }
  }

  return { proposals, coverage: { gaps, overlaps } };
}
