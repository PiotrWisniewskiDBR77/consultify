/**
 * presentationGovernanceWatchlistDiff
 *
 * Pure helper used by the SuperAdmin Governance Watchlist UI to detect
 * decks that transitioned INTO a blocked state (`BLOCKED_P0` or `BLOCKED_P1`)
 * between two consecutive snapshots from
 * {@link fetchPresentationGovernanceWatchlist}.
 *
 * The function is deliberately side-effect free so it can be reused in
 * unit tests, future toast pipelines, or telemetry processors without
 * pulling in any React or fetch concerns.
 *
 * Severity ordering used here:
 *   BLOCKED_P0 > BLOCKED_P1 > everything else > "deck not present" (-Infinity)
 *
 * "Transition INTO blocked" means the previous severity rank was strictly
 * lower than the current rank AND the current verdict is one of
 * BLOCKED_P0 / BLOCKED_P1. New decks (not present in `previous`) are
 * treated as `prev rank = -Infinity`, so any blocked verdict on them
 * counts as a transition.
 */
import type { WatchlistEntry } from './presentationGovernanceWatchlist';

export type BlockedVerdict = 'BLOCKED_P0' | 'BLOCKED_P1';

export interface WatchlistTransition {
  deckId: string;
  title: string;
  fromVerdict: string | null;
  toVerdict: BlockedVerdict;
}

const SEVERITY_RANK: Record<string, number> = {
  BLOCKED_P0: 4,
  BLOCKED_P1: 3,
  PASS_WITH_P2: 2,
  INCONCLUSIVE: 1,
  PASS: 0,
};

function rankFor(verdict: string | null | undefined): number {
  if (!verdict) return Number.NEGATIVE_INFINITY;
  if (Object.prototype.hasOwnProperty.call(SEVERITY_RANK, verdict)) {
    return SEVERITY_RANK[verdict];
  }
  // Unknown verdict strings are treated as the lowest known rank so that
  // any blocked verdict still counts as a transition.
  return -1;
}

function isBlocked(verdict: string): verdict is BlockedVerdict {
  return verdict === 'BLOCKED_P0' || verdict === 'BLOCKED_P1';
}

export function diffWatchlistForNewBlockers(
  previous: WatchlistEntry[] | null,
  current: WatchlistEntry[]
): WatchlistTransition[] {
  if (!Array.isArray(current) || current.length === 0) return [];

  const previousByDeckId = new Map<string, WatchlistEntry>();
  if (Array.isArray(previous)) {
    for (const entry of previous) {
      if (entry && typeof entry.deckId === 'string') {
        previousByDeckId.set(entry.deckId, entry);
      }
    }
  }

  const transitions: WatchlistTransition[] = [];

  for (const entry of current) {
    if (!entry || typeof entry.deckId !== 'string') continue;
    const currVerdict = entry.overallVerdict;
    if (!isBlocked(currVerdict)) continue;

    const prev = previousByDeckId.get(entry.deckId);
    const prevVerdict = prev ? prev.overallVerdict : null;
    const prevRank = rankFor(prevVerdict);
    const currRank = rankFor(currVerdict);

    if (prevRank < currRank) {
      transitions.push({
        deckId: entry.deckId,
        title: entry.title,
        fromVerdict: prevVerdict,
        toVerdict: currVerdict,
      });
    }
  }

  return transitions;
}
