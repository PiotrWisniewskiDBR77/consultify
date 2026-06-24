/**
 * valueReallocationService — pure functions recommending resource reallocation
 * from low-realizing items toward high-realizing ones.
 *
 * M15/W3 (3.3). No DB, no side effects — deterministic and unit-testable.
 */

export interface ReallocationItem {
  id: string;
  name?: string;
  /** Realization progress 0..100 (percent of expected value realized). */
  realizationPct?: number;
  /** Confidence 0..1 in the realization signal. */
  confidence?: number;
  /** Monetary/relative value at stake for this item. */
  valueAtStake?: number;
  /** Capacity currently allocated, in FTE. */
  capacityFte?: number;
}

export interface FromCandidate {
  id: string;
  name?: string;
  reason: string;
  capacityFte?: number;
}

export interface ToCandidate {
  id: string;
  name?: string;
  reason: string;
}

export interface ReallocationMove {
  fromId: string;
  toId: string;
  rationale: string;
}

export interface ReallocationRecommendation {
  fromCandidates: FromCandidate[];
  toCandidates: ToCandidate[];
  moves: ReallocationMove[];
}

export interface ReallocationSummary {
  freedFte: number;
  moveCount: number;
}

// Tunable bands. Low realization + low confidence → free capacity.
// High realization + high confidence → receive capacity.
const LOW_REALIZATION_PCT = 50; // below this = under-performing
const HIGH_REALIZATION_PCT = 70; // at/above this = performing well
const LOW_CONFIDENCE = 0.5; // at/below this = weak signal
const HIGH_CONFIDENCE = 0.6; // at/above this = strong signal

function num(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function fmtPct(value: number): string {
  return `${Math.round(value)}%`;
}

function fmtConf(value: number): string {
  return `${Math.round(value * 100)}%`;
}

/**
 * Recommend reallocation of capacity from low-realizing/low-confidence items
 * toward high-realizing/high-confidence items.
 *
 * Pairing: largest `from` (by freed capacity) with largest `to` (by value at
 * stake), greedily, until one side is exhausted.
 */
export function recommendReallocation(
  items: Array<ReallocationItem>
): ReallocationRecommendation {
  const list = Array.isArray(items) ? items : [];

  const fromCandidates: FromCandidate[] = [];
  const toCandidates: ToCandidate[] = [];

  for (const item of list) {
    if (!item || typeof item.id !== 'string') continue;

    const realization = num(item.realizationPct, 0);
    const confidence = num(item.confidence, 0);
    const capacity = num(item.capacityFte, 0);

    if (realization < LOW_REALIZATION_PCT && confidence <= LOW_CONFIDENCE) {
      fromCandidates.push({
        id: item.id,
        name: item.name,
        reason: `Low realization (${fmtPct(realization)}) and low confidence (${fmtConf(
          confidence
        )}) — capacity better deployed elsewhere`,
        capacityFte: item.capacityFte,
      });
    } else if (realization >= HIGH_REALIZATION_PCT && confidence >= HIGH_CONFIDENCE) {
      toCandidates.push({
        id: item.id,
        name: item.name,
        reason: `High realization (${fmtPct(realization)}) and high confidence (${fmtConf(
          confidence
        )}) — scaling investment compounds value`,
      });
    }
  }

  // Largest `from` by freed capacity first.
  const fromsByCapacity = [...fromCandidates].sort((a, b) => {
    const diff = num(b.capacityFte, 0) - num(a.capacityFte, 0);
    if (diff !== 0) return diff;
    return a.id.localeCompare(b.id);
  });

  // Largest `to` by value at stake first.
  const valueById = new Map<string, number>();
  for (const item of list) {
    if (item && typeof item.id === 'string') {
      valueById.set(item.id, num(item.valueAtStake, 0));
    }
  }
  const tosByValue = [...toCandidates].sort((a, b) => {
    const diff = (valueById.get(b.id) ?? 0) - (valueById.get(a.id) ?? 0);
    if (diff !== 0) return diff;
    return a.id.localeCompare(b.id);
  });

  const moves: ReallocationMove[] = [];
  const pairCount = Math.min(fromsByCapacity.length, tosByValue.length);
  for (let i = 0; i < pairCount; i++) {
    const from = fromsByCapacity[i];
    const to = tosByValue[i];
    const freed = num(from.capacityFte, 0);
    const fromLabel = from.name ?? from.id;
    const toLabel = to.name ?? to.id;
    const capacityNote = freed > 0 ? ` (~${freed} FTE)` : '';
    moves.push({
      fromId: from.id,
      toId: to.id,
      rationale: `Shift capacity${capacityNote} from under-realizing "${fromLabel}" to high-realizing "${toLabel}"`,
    });
  }

  return { fromCandidates, toCandidates, moves };
}

/**
 * Summarize a recommendation: total FTE freed across the moved `from` items and
 * the number of moves proposed.
 */
export function reallocationSummary(
  rec: ReallocationRecommendation
): ReallocationSummary {
  const moves = rec?.moves ?? [];
  const fromCandidates = rec?.fromCandidates ?? [];

  const capacityById = new Map<string, number>();
  for (const from of fromCandidates) {
    capacityById.set(from.id, num(from.capacityFte, 0));
  }

  let freedFte = 0;
  for (const move of moves) {
    freedFte += capacityById.get(move.fromId) ?? 0;
  }

  return {
    freedFte: Math.round(freedFte * 100) / 100,
    moveCount: moves.length,
  };
}

export default { recommendReallocation, reallocationSummary };
