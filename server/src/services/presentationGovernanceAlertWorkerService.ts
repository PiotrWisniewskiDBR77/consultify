/**
 * Presentation Governance Alert Worker Service (Sprint 9)
 *
 * Pure-logic core that the periodic worker uses to detect new
 * `BLOCKED_P0` / `BLOCKED_P1` transitions between two consecutive
 * Governance Watchlist snapshots. The actual DB / fetch / loop scaffolding
 * lives in `server/scripts/run-presentation-alert-worker.ts`; everything
 * here is deterministic, side-effect free, and unit-testable in isolation.
 *
 * The severity-rank model mirrors `presentationGovernanceWatchlistDiff` on
 * the FE so a deck only triggers an alert when its rank STRICTLY increases
 * AND lands on a blocked verdict. We deliberately do NOT import the FE
 * helper — keeping a copy here means the server has no client coupling.
 *
 * First-cycle behavior: when `state.lastSnapshot === null` (the worker has
 * never run for this org) we report zero transitions. The current snapshot
 * is still returned via `nextSnapshotJson` so the next cycle can diff
 * against a real baseline. This avoids alert spam on bootstrap.
 */

import type { WatchlistEntry } from './presentationGovernanceWatchlistService.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type WorkerBlockedVerdict = 'BLOCKED_P0' | 'BLOCKED_P1';

export interface WorkerSnapshotState {
  organizationId: string;
  lastSnapshot: WatchlistEntry[] | null;
  pausedReason?: string | null;
}

export interface WorkerCycleInput {
  state: WorkerSnapshotState;
  current: WatchlistEntry[];
  nowIso: string;
}

export interface WorkerTransition {
  deckId: string;
  deckTitle: string;
  fromVerdict: string | null;
  toVerdict: WorkerBlockedVerdict;
}

export interface WorkerCycleOutput {
  transitions: WorkerTransition[];
  /** Compact JSON of the current watchlist; persisted as `last_snapshot_json`. */
  nextSnapshotJson: string;
  /**
   * Whether the caller should bother UPSERT-ing the snapshot row. False only
   * when both the previous and current snapshots are absent — in which case
   * there is nothing to persist that the next cycle would not derive itself.
   */
  shouldPersist: boolean;
}

// ---------------------------------------------------------------------------
// Severity ranking (mirrors src/services/presentationGovernanceWatchlistDiff.ts)
// ---------------------------------------------------------------------------

const SEVERITY_RANK: Record<string, number> = {
  BLOCKED_P0: 4,
  BLOCKED_P1: 3,
  PASS_WITH_P2: 2,
  INCONCLUSIVE: 1,
  PASS: 0,
};

function rankFor(verdict: string | null | undefined): number {
  if (verdict == null || verdict === '') return Number.NEGATIVE_INFINITY;
  if (Object.prototype.hasOwnProperty.call(SEVERITY_RANK, verdict)) {
    return SEVERITY_RANK[verdict] as number;
  }
  // Unknown verdicts rank below known ones but above "absent" so that any
  // blocked verdict still counts as a strict escalation.
  return -1;
}

function isBlockedVerdict(verdict: string): verdict is WorkerBlockedVerdict {
  return verdict === 'BLOCKED_P0' || verdict === 'BLOCKED_P1';
}

// ---------------------------------------------------------------------------
// Snapshot serialization (compact, deterministic)
// ---------------------------------------------------------------------------

interface CompactSnapshotEntry {
  deckId: string;
  title: string;
  verdict: string;
  updatedAt: string | null;
}

function compactEntries(entries: WatchlistEntry[]): CompactSnapshotEntry[] {
  if (!Array.isArray(entries)) return [];
  return entries.map((entry) => ({
    deckId: String(entry?.deckId ?? ''),
    title: String(entry?.title ?? ''),
    verdict: String(entry?.card?.overallVerdict ?? ''),
    updatedAt: typeof entry?.updatedAt === 'string' ? entry.updatedAt : null,
  }));
}

/**
 * Parse a previously-persisted snapshot JSON back into the minimal
 * `WatchlistEntry` shape the diff routine needs. Only `deckId`, `title`,
 * and `card.overallVerdict` are populated; numeric quality / telemetry
 * fields are zero-filled because the diff does not consult them.
 */
export function parseStoredSnapshot(json: string | null | undefined): WatchlistEntry[] | null {
  if (typeof json !== 'string' || json.length === 0) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed)) return null;
  const out: WatchlistEntry[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;
    const deckId = typeof obj.deckId === 'string' ? obj.deckId : '';
    if (!deckId) continue;
    const verdict = typeof obj.verdict === 'string' ? obj.verdict : '';
    out.push({
      deckId,
      title: typeof obj.title === 'string' ? obj.title : deckId,
      confidentialityLevel: 'internal',
      updatedAt: typeof obj.updatedAt === 'string' ? obj.updatedAt : null,
      card: {
        overallVerdict: (verdict || 'INCONCLUSIVE') as WatchlistEntry['card']['overallVerdict'],
        quality: { p0: 0, p1: 0, p2: 0, gateCount: 0 },
        telemetry: { exportsBlocked: 0, lastActivityAt: null },
      },
      severityScore: 0,
      isBlocked: isBlockedVerdict(verdict),
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Core cycle
// ---------------------------------------------------------------------------

export function runAlertWorkerCycle(input: WorkerCycleInput): WorkerCycleOutput {
  const current = Array.isArray(input?.current) ? input.current : [];
  const previous = input?.state?.lastSnapshot ?? null;

  const compact = compactEntries(current);
  const nextSnapshotJson = JSON.stringify(compact);
  const shouldPersist = current.length > 0 || previous !== null;

  // Bootstrap guard: never alert on the very first cycle. We still persist
  // the snapshot so the next cycle has a baseline to diff against.
  if (previous === null) {
    return {
      transitions: [],
      nextSnapshotJson,
      shouldPersist,
    };
  }

  const previousByDeckId = new Map<string, WatchlistEntry>();
  for (const entry of previous) {
    if (entry && typeof entry.deckId === 'string') {
      previousByDeckId.set(entry.deckId, entry);
    }
  }

  const transitions: WorkerTransition[] = [];
  for (const entry of current) {
    if (!entry || typeof entry.deckId !== 'string') continue;
    const currVerdict = String(entry.card?.overallVerdict ?? '');
    if (!isBlockedVerdict(currVerdict)) continue;

    const prev = previousByDeckId.get(entry.deckId) || null;
    const prevVerdict = prev ? String(prev.card?.overallVerdict ?? '') : null;
    const prevRank = rankFor(prevVerdict);
    const currRank = rankFor(currVerdict);

    if (prevRank < currRank) {
      transitions.push({
        deckId: entry.deckId,
        deckTitle: typeof entry.title === 'string' ? entry.title : entry.deckId,
        fromVerdict: prevVerdict,
        toVerdict: currVerdict,
      });
    }
  }

  return {
    transitions,
    nextSnapshotJson,
    shouldPersist,
  };
}

// Test surface: the exported helpers are kept as named exports above so
// they are tree-shakable. The bundle below is for diagnostic introspection.
export const __internal = { rankFor, isBlockedVerdict, compactEntries };
