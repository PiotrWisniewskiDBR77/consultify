/**
 * presentationDeckScorecard — compact per-deck quality summary for the LIST row.
 *
 * The rich `bundleQualityScorecard` (buildQualityScorecard, 7 dimensions + A-F)
 * is business-plan-bundle only: its input is a bag of analyzer outputs run
 * against a BusinessPlanSpine, not deck content. Force-fitting it to arbitrary
 * decks would mean re-running 7 analyzers per deck — the wrong path for a list.
 *
 * `checkDeckQualityGates` (presentationQualityGatesService) is ALREADY deck-native:
 * it loads the deck via normalizeDeckDocument and returns a 0-100 score,
 * PASS/PASS_WITH_P2/BLOCKED_P1/INCONCLUSIVE result, a p0/p1/p2 breakdown and the
 * full gate list. This module derives a compact, list-friendly scorecard from
 * that existing output (score → A-F grade + top failing gates), so the deck list
 * badge shows a REAL quality signal without re-computing anything new.
 *
 * Fail-open by contract: any error / unreadable deck returns null so the list
 * falls back to the existing governance validationState badge and never breaks.
 */
import logger from '../utils/Logger.js';
import { checkDeckQualityGates } from './presentationQualityGatesService.js';

export type DeckQualityGrade = 'A' | 'B' | 'C' | 'D' | 'F';

/** Compact scorecard attached to a deck list row (see ArtifactGovernanceSummary). */
export interface DeckListScorecard {
  /** 0..100 from checkDeckQualityGates (100 − errors*20 − warnings*5, floored at 0). */
  score: number;
  /** A-F letter derived from `score` (same banding as bundleQualityScorecard). */
  grade: DeckQualityGrade;
  /** Pass vocabulary from the gate engine (PASS / PASS_WITH_P2 / BLOCKED_P1 / INCONCLUSIVE). */
  result: 'PASS' | 'PASS_WITH_P2' | 'BLOCKED_P1' | 'INCONCLUSIVE';
  /** Priority breakdown (blocking P0/P1 vs advisory P2). */
  p0: number;
  p1: number;
  p2: number;
  /** Whether the deck currently clears the export gate (no error-severity gates). */
  canExport: boolean;
  /** Up to 5 actionable failing-gate messages (error/warning), most severe first. */
  topIssues: string[];
}

/** Same A-F banding as bundleQualityScorecard.gradeOf — keep the two consistent. */
export function gradeOfScore(score: number): DeckQualityGrade {
  const s = Number.isFinite(score) ? score : 0;
  if (s >= 90) return 'A';
  if (s >= 80) return 'B';
  if (s >= 70) return 'C';
  if (s >= 60) return 'D';
  return 'F';
}

const SEVERITY_RANK: Record<string, number> = { error: 0, warning: 1, info: 2 };

/**
 * Map a full DeckQualityReport (from checkDeckQualityGates) into the compact
 * list scorecard. Pure — no I/O — so it is trivially unit-testable and reusable
 * anywhere a report is already in hand (e.g. the export gate path).
 */
export function toDeckListScorecard(report: {
  score: number;
  result: DeckListScorecard['result'];
  canExport: boolean;
  scorecard: { p0: number; p1: number; p2: number };
  gates: Array<{ severity: string; message: string }>;
}): DeckListScorecard {
  const topIssues = [...(report.gates || [])]
    .filter((g) => g.severity === 'error' || g.severity === 'warning')
    .sort((a, b) => (SEVERITY_RANK[a.severity] ?? 9) - (SEVERITY_RANK[b.severity] ?? 9))
    .slice(0, 5)
    .map((g) => g.message);

  return {
    score: report.score,
    grade: gradeOfScore(report.score),
    result: report.result,
    p0: report.scorecard?.p0 ?? 0,
    p1: report.scorecard?.p1 ?? 0,
    p2: report.scorecard?.p2 ?? 0,
    canExport: report.canExport,
    topIssues,
  };
}

/**
 * Compute the compact list scorecard for one deck. Fail-open: returns null on any
 * error (missing deck, schema not ready, gate engine throw) so the caller keeps
 * the existing governance badge.
 */
export async function computeDeckListScorecard(
  organizationId: string,
  deckId: string
): Promise<DeckListScorecard | null> {
  if (!organizationId || !deckId) return null;
  try {
    const report = await checkDeckQualityGates(organizationId, deckId);
    // A "deck not found" report is inconclusive noise for the list — skip it so
    // we fall back to the governance badge rather than fabricate an F.
    if (
      report.result === 'BLOCKED_P1' &&
      report.gates.some((g) => g.gateType === 'DECK_NOT_FOUND')
    ) {
      return null;
    }
    return toDeckListScorecard(report);
  } catch (err) {
    logger.warn(
      `[presentationDeckScorecard] fail-open for deck ${deckId}: ${err instanceof Error ? err.message : String(err)}`
    );
    return null;
  }
}
