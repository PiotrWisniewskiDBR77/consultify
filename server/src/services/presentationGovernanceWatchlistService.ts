/**
 * Presentation Governance Watchlist Service
 *
 * Pure aggregator that ranks presentation decks by governance severity for the
 * SuperAdmin "Governance Watchlist" surface. Inputs are intentionally minimal
 * "Like" shapes so this module stays decoupled from DB / IO and is unit-test
 * friendly. The route layer is responsible for fetching the deck list and the
 * per-deck Governance Card (`buildPresentationGovernanceCard`) and then
 * passing the slimmed entries into `buildPresentationGovernanceWatchlist`.
 */

export type WatchlistVerdict =
  | 'BLOCKED_P0'
  | 'BLOCKED_P1'
  | 'PASS_WITH_P2'
  | 'PASS'
  | 'INCONCLUSIVE';

export interface WatchlistEntryInput {
  deckId: string;
  title: string;
  confidentialityLevel: 'public' | 'internal' | 'confidential' | string;
  updatedAt: string | null;
  card: {
    overallVerdict: WatchlistVerdict;
    quality: { p0: number; p1: number; p2: number; gateCount: number };
    telemetry: { exportsBlocked: number; lastActivityAt: string | null };
  };
}

export interface WatchlistEntry extends WatchlistEntryInput {
  severityScore: number;
  isBlocked: boolean;
}

export interface WatchlistTotals {
  decks: number;
  blockedP0: number;
  blockedP1: number;
  passWithP2: number;
  pass: number;
  inconclusive: number;
}

export interface WatchlistResult {
  entries: WatchlistEntry[];
  totals: WatchlistTotals;
}

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

function clampLimit(limit: number | undefined): number {
  if (typeof limit !== 'number' || !Number.isFinite(limit)) return DEFAULT_LIMIT;
  const rounded = Math.round(limit);
  if (rounded < 1) return 1;
  if (rounded > MAX_LIMIT) return MAX_LIMIT;
  return rounded;
}

function safeNumber(n: unknown): number {
  return typeof n === 'number' && Number.isFinite(n) ? n : 0;
}

function computeSeverityScore(entry: WatchlistEntryInput): number {
  const p0 = safeNumber(entry.card?.quality?.p0);
  const p1 = safeNumber(entry.card?.quality?.p1);
  const p2 = safeNumber(entry.card?.quality?.p2);
  const exportsBlocked = safeNumber(entry.card?.telemetry?.exportsBlocked);
  return p0 * 100 + p1 * 10 + p2 + exportsBlocked * 5;
}

function isBlockedVerdict(verdict: WatchlistVerdict): boolean {
  return verdict === 'BLOCKED_P0' || verdict === 'BLOCKED_P1';
}

function compareUpdatedAtDesc(a: string | null, b: string | null): number {
  const ta = a ? Date.parse(a) : NaN;
  const tb = b ? Date.parse(b) : NaN;
  const va = Number.isNaN(ta) ? -Infinity : ta;
  const vb = Number.isNaN(tb) ? -Infinity : tb;
  return vb - va;
}

export function buildPresentationGovernanceWatchlist(
  rows: WatchlistEntryInput[],
  opts?: { onlyBlocked?: boolean; limit?: number }
): WatchlistResult {
  const safeRows = Array.isArray(rows) ? rows : [];

  const totals: WatchlistTotals = {
    decks: safeRows.length,
    blockedP0: 0,
    blockedP1: 0,
    passWithP2: 0,
    pass: 0,
    inconclusive: 0,
  };

  const enriched: WatchlistEntry[] = safeRows.map((row) => {
    const verdict = row.card?.overallVerdict;
    switch (verdict) {
      case 'BLOCKED_P0':
        totals.blockedP0 += 1;
        break;
      case 'BLOCKED_P1':
        totals.blockedP1 += 1;
        break;
      case 'PASS_WITH_P2':
        totals.passWithP2 += 1;
        break;
      case 'PASS':
        totals.pass += 1;
        break;
      case 'INCONCLUSIVE':
      default:
        totals.inconclusive += 1;
        break;
    }
    return {
      ...row,
      severityScore: computeSeverityScore(row),
      isBlocked: isBlockedVerdict(verdict),
    };
  });

  const filtered = opts?.onlyBlocked ? enriched.filter((e) => e.isBlocked) : enriched;

  filtered.sort((a, b) => {
    if (a.isBlocked !== b.isBlocked) return a.isBlocked ? -1 : 1;
    if (a.severityScore !== b.severityScore) return b.severityScore - a.severityScore;
    return compareUpdatedAtDesc(a.updatedAt, b.updatedAt);
  });

  const limit = clampLimit(opts?.limit);
  const entries = filtered.slice(0, limit);

  return { entries, totals };
}
