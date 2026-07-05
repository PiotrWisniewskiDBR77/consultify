// @vitest-environment node
/**
 * P2.6 — presentationDeckScorecard: derive the compact LIST scorecard from the
 * existing deck-native checkDeckQualityGates output, and fail open so the list
 * never breaks. Covers the pure mappers (gradeOfScore, toDeckListScorecard) and
 * the computeDeckListScorecard wrapper (fail-open + deck-not-found skip).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

// checkDeckQualityGates hits the DB (dbGet); mock it so the wrapper is testable
// without a database. The pure mappers need no mock.
const checkDeckQualityGates = vi.fn();
vi.mock('../../../server/src/services/presentationQualityGatesService', () => ({
  checkDeckQualityGates: (...args: unknown[]) => checkDeckQualityGates(...args),
}));
vi.mock('../../../server/src/services/presentationQualityGatesService.js', () => ({
  checkDeckQualityGates: (...args: unknown[]) => checkDeckQualityGates(...args),
}));

import {
  computeDeckListScorecard,
  gradeOfScore,
  toDeckListScorecard,
} from '../../../server/src/services/presentationDeckScorecard';

function report(overrides: Record<string, unknown> = {}) {
  return {
    deckId: 'deck-1',
    canExport: true,
    canShare: true,
    score: 100,
    result: 'PASS' as const,
    scorecard: { p0: 0, p1: 0, p2: 0, passVocabulary: 'PASS' as const },
    gates: [] as Array<{ severity: string; message: string; gateType?: string }>,
    checkedAt: '2026-07-05T00:00:00Z',
    ...overrides,
  };
}

afterEach(() => {
  checkDeckQualityGates.mockReset();
});

describe('gradeOfScore — A-F banding (matches bundleQualityScorecard)', () => {
  it('maps score bands to letters', () => {
    expect(gradeOfScore(95)).toBe('A');
    expect(gradeOfScore(90)).toBe('A');
    expect(gradeOfScore(85)).toBe('B');
    expect(gradeOfScore(75)).toBe('C');
    expect(gradeOfScore(60)).toBe('D');
    expect(gradeOfScore(40)).toBe('F');
    expect(gradeOfScore(0)).toBe('F');
  });

  it('non-finite score → F (never throws)', () => {
    expect(gradeOfScore(Number.NaN)).toBe('F');
  });
});

describe('toDeckListScorecard — compact mapping', () => {
  it('carries score/grade/result/priorities and clean top issues for a healthy deck', () => {
    const sc = toDeckListScorecard(report({ score: 92 }));
    expect(sc.score).toBe(92);
    expect(sc.grade).toBe('A');
    expect(sc.result).toBe('PASS');
    expect(sc).toMatchObject({ p0: 0, p1: 0, p2: 0, canExport: true });
    expect(sc.topIssues).toEqual([]);
  });

  it('surfaces up to 5 error/warning gate messages, errors before warnings', () => {
    const gates = [
      { severity: 'warning', message: 'W-1' },
      { severity: 'error', message: 'E-1' },
      { severity: 'info', message: 'I-1 (dropped)' },
      { severity: 'error', message: 'E-2' },
      { severity: 'warning', message: 'W-2' },
      { severity: 'warning', message: 'W-3' },
      { severity: 'warning', message: 'W-4' },
    ];
    const sc = toDeckListScorecard(report({ score: 55, result: 'BLOCKED_P1', gates }));
    expect(sc.grade).toBe('F');
    // errors first, info dropped, capped at 5
    expect(sc.topIssues.slice(0, 2)).toEqual(['E-1', 'E-2']);
    expect(sc.topIssues).toHaveLength(5);
    expect(sc.topIssues).not.toContain('I-1 (dropped)');
  });
});

describe('computeDeckListScorecard — wrapper', () => {
  it('returns the compact scorecard for a readable deck', async () => {
    checkDeckQualityGates.mockResolvedValue(
      report({ score: 75, result: 'PASS_WITH_P2', scorecard: { p0: 0, p1: 0, p2: 2 } })
    );
    const sc = await computeDeckListScorecard('org-1', 'deck-1');
    expect(sc).not.toBeNull();
    expect(sc?.grade).toBe('C');
    expect(sc?.result).toBe('PASS_WITH_P2');
  });

  it('fails open (null) when the gate engine throws — list keeps governance badge', async () => {
    checkDeckQualityGates.mockRejectedValue(new Error('schema not ready'));
    const sc = await computeDeckListScorecard('org-1', 'deck-1');
    expect(sc).toBeNull();
  });

  it('returns null for a DECK_NOT_FOUND report (no fabricated F)', async () => {
    checkDeckQualityGates.mockResolvedValue(
      report({
        score: 0,
        result: 'BLOCKED_P1',
        canExport: false,
        scorecard: { p0: 0, p1: 1, p2: 0 },
        gates: [{ severity: 'error', message: 'Deck not found', gateType: 'DECK_NOT_FOUND' }],
      })
    );
    const sc = await computeDeckListScorecard('org-1', 'missing');
    expect(sc).toBeNull();
  });

  it('returns null for empty ids without calling the engine', async () => {
    expect(await computeDeckListScorecard('', 'deck-1')).toBeNull();
    expect(await computeDeckListScorecard('org-1', '')).toBeNull();
    expect(checkDeckQualityGates).not.toHaveBeenCalled();
  });
});
