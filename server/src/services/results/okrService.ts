/**
 * okrService — pure OKR functions (Doerr / "Measure What Matters").
 *
 * Objectives are qualitative goals; Key Results are quantitative, measurable
 * outcomes. Scoring follows the classic 0–1 progress scale, with weighted
 * roll-up of Key Results into Objective scores and parent/child cascade.
 *
 * All functions are pure (no I/O, no DB). Safe to use anywhere.
 */

export type KeyResult = {
  id: string;
  label: string;
  baseline?: number;
  target?: number;
  current?: number;
  /** Relative importance within its Objective. Defaults to 1 when omitted. */
  weight?: number;
};

export type Objective = {
  id: string;
  label: string;
  keyResults: KeyResult[];
  /** Id of a parent Objective for cascade roll-up. */
  parentId?: string;
};

export type ObjectiveStatus = 'on-track' | 'at-risk' | 'off-track';

export type ObjectiveScore = {
  score: number;
  status: ObjectiveStatus;
};

export type CascadedObjective = Objective & {
  /** Own score from this Objective's Key Results. */
  score: number;
  /** Blended score incorporating child Objectives by parentId. */
  rollupScore: number;
};

export type OkrSummary = {
  total: number;
  onTrack: number;
  atRisk: number;
  offTrack: number;
  avgScore: number;
};

const clamp01 = (n: number): number => {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
};

const isNum = (n: unknown): n is number =>
  typeof n === 'number' && Number.isFinite(n);

/**
 * Progress of a single Key Result on a 0–1 scale:
 *   (current − baseline) / (target − baseline), clamped to [0, 1].
 * Returns 0 when required data is missing or the range is degenerate.
 */
export function scoreKeyResult(kr: KeyResult): number {
  if (!kr || !isNum(kr.current) || !isNum(kr.target)) return 0;
  const baseline = isNum(kr.baseline) ? kr.baseline : 0;
  const range = kr.target - baseline;
  if (range === 0) return 0;
  return clamp01((kr.current - baseline) / range);
}

const statusFromScore = (score: number): ObjectiveStatus => {
  if (score >= 0.7) return 'on-track';
  if (score >= 0.4) return 'at-risk';
  return 'off-track';
};

/**
 * Weighted average of an Objective's Key Result scores, plus a status band:
 *   ≥0.7 on-track, ≥0.4 at-risk, else off-track.
 * An Objective with no Key Results scores 0 (off-track).
 */
export function scoreObjective(o: Objective): ObjectiveScore {
  const krs = o?.keyResults ?? [];
  if (krs.length === 0) {
    return { score: 0, status: statusFromScore(0) };
  }

  let weightedSum = 0;
  let totalWeight = 0;
  for (const kr of krs) {
    const weight = isNum(kr.weight) && kr.weight >= 0 ? kr.weight : 1;
    weightedSum += scoreKeyResult(kr) * weight;
    totalWeight += weight;
  }

  const score = totalWeight === 0 ? 0 : clamp01(weightedSum / totalWeight);
  return { score, status: statusFromScore(score) };
}

/**
 * Computes each Objective's own score, then a rollupScore that blends the
 * Objective's own score with the average rollupScore of its children
 * (linked by parentId). Leaf Objectives have rollupScore === score.
 *
 * The blend is a simple mean of [own score, ...child rollup scores], which
 * lets parent goals reflect progress cascaded up from sub-objectives.
 */
export function cascadeRollup(
  objectives: Objective[],
): CascadedObjective[] {
  const list = objectives ?? [];
  const childrenByParent = new Map<string, Objective[]>();
  for (const o of list) {
    if (o.parentId == null) continue;
    const arr = childrenByParent.get(o.parentId) ?? [];
    arr.push(o);
    childrenByParent.set(o.parentId, arr);
  }

  const rollupCache = new Map<string, number>();
  const visiting = new Set<string>();

  const computeRollup = (o: Objective): number => {
    const cached = rollupCache.get(o.id);
    if (cached != null) return cached;

    const own = scoreObjective(o).score;

    // Cycle guard: if we revisit an Objective mid-computation, fall back to own.
    if (visiting.has(o.id)) return own;
    visiting.add(o.id);

    const children = childrenByParent.get(o.id) ?? [];
    let rollup: number;
    if (children.length === 0) {
      rollup = own;
    } else {
      let sum = own;
      for (const child of children) {
        sum += computeRollup(child);
      }
      rollup = clamp01(sum / (children.length + 1));
    }

    visiting.delete(o.id);
    rollupCache.set(o.id, rollup);
    return rollup;
  };

  return list.map((o) => ({
    ...o,
    score: scoreObjective(o).score,
    rollupScore: computeRollup(o),
  }));
}

/**
 * Portfolio-level summary across all Objectives: counts by status band and
 * the average own score.
 */
export function okrSummary(objectives: Objective[]): OkrSummary {
  const list = objectives ?? [];
  const total = list.length;
  if (total === 0) {
    return { total: 0, onTrack: 0, atRisk: 0, offTrack: 0, avgScore: 0 };
  }

  let onTrack = 0;
  let atRisk = 0;
  let offTrack = 0;
  let scoreSum = 0;

  for (const o of list) {
    const { score, status } = scoreObjective(o);
    scoreSum += score;
    if (status === 'on-track') onTrack += 1;
    else if (status === 'at-risk') atRisk += 1;
    else offTrack += 1;
  }

  return {
    total,
    onTrack,
    atRisk,
    offTrack,
    avgScore: scoreSum / total,
  };
}
