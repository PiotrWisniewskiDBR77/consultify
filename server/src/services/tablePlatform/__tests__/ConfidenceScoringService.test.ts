/**
 * Unit tests for ConfidenceScoringService (Block B · EPIC-T9 · Sprint 3).
 *
 * Coverage:
 *   - computeScore (pure): all weight components, clamp, rounding
 *   - recompute: feature-flag gate, missing record, no sources, multiple
 *     sources, recent verification window, validation_status flagged/verified,
 *     idempotent UPDATE skip, contribution averaging
 *   - recomputeBulk: error isolation
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockQuery = vi.fn();

vi.mock('../../../database/Database.js', () => ({
  getDatabase: () => ({ query: mockQuery }),
}));

vi.mock('../../../utils/Logger.js', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../../config/FeatureFlags.js', () => ({
  featureFlags: {
    ENABLE_RECORD_PROVENANCE: true,
    ENABLE_TABLE_PLATFORM_METADATA_FIRST: true,
    ENABLE_TABLE_PLATFORM_RECORDS_API: true,
    ENABLE_ACTION_EXECUTION: false,
    ENABLE_ACTION_DECISIONS: true,
    ENABLE_METRICS_DASHBOARD: true,
    ENABLE_AI_COACH: true,
    ENABLE_HELP_SYSTEM: true,
    ENABLE_V8_GLOBAL: false,
    ENABLE_V8_SHADOW_MODE: false,
  },
}));

import { featureFlags } from '../../../config/FeatureFlags.js';
import confidenceScoringService, { CONFIDENCE_WEIGHTS } from '../ConfidenceScoringService.js';

const RECORD_ID = 'rec-uuid-1';

function recordRow(overrides: Record<string, unknown> = {}) {
  return {
    id: RECORD_ID,
    confidence_score: null as number | null,
    validation_status: 'unverified' as const,
    ...overrides,
  };
}

describe('ConfidenceScoringService.computeScore (pure)', () => {
  it('returns base 0.30 with no sources and unverified status', () => {
    const { score, components } = confidenceScoringService.computeScore({
      activeSourceContributions: [],
      lastVerifiedAtIsoStrings: [],
      validationStatus: 'unverified',
    });
    expect(components.base).toBe(CONFIDENCE_WEIGHTS.base);
    expect(components.sourceCountBonus).toBe(0);
    expect(components.sourceContribution).toBe(0);
    expect(components.verificationBonus).toBe(0);
    expect(components.manualVerifiedBonus).toBe(0);
    expect(components.flaggedPenalty).toBe(0);
    expect(score).toBe(0.3);
  });

  it('applies +0.10 per source up to the cap of 3', () => {
    const four = confidenceScoringService.computeScore({
      activeSourceContributions: [null, null, null, null],
      lastVerifiedAtIsoStrings: [null, null, null, null],
      validationStatus: 'unverified',
    });
    // base 0.30 + capped 3 * 0.10 = 0.60
    expect(four.score).toBe(0.6);
    expect(four.components.sourceCountBonus).toBeCloseTo(0.3, 6);
  });

  it('averages confidence_contribution and applies the 0.20 multiplier', () => {
    const { score, components } = confidenceScoringService.computeScore({
      activeSourceContributions: [0.5, 1.0],
      lastVerifiedAtIsoStrings: [null, null],
      validationStatus: 'unverified',
    });
    // base 0.30 + 2 * 0.10 + avg(0.75) * 0.20 = 0.30 + 0.20 + 0.15 = 0.65
    expect(components.sourceContribution).toBeCloseTo(0.15, 6);
    expect(score).toBe(0.65);
  });

  it('ignores null contributions when averaging', () => {
    const { score } = confidenceScoringService.computeScore({
      activeSourceContributions: [null, 0.8],
      lastVerifiedAtIsoStrings: [null, null],
      validationStatus: 'unverified',
    });
    // base 0.30 + 2 * 0.10 + 0.8 * 0.20 = 0.66 → rounds to 0.66
    expect(score).toBe(0.66);
  });

  it('adds verification bonus only when at least one source is within 30 days', () => {
    const now = Date.parse('2026-05-08T00:00:00Z');
    const fresh = new Date(now - 5 * 24 * 60 * 60 * 1000).toISOString();
    const stale = new Date(now - 60 * 24 * 60 * 60 * 1000).toISOString();

    const withFresh = confidenceScoringService.computeScore({
      activeSourceContributions: [null],
      lastVerifiedAtIsoStrings: [fresh],
      validationStatus: 'unverified',
      nowMs: now,
    });
    expect(withFresh.components.verificationBonus).toBe(0.1);

    const withStale = confidenceScoringService.computeScore({
      activeSourceContributions: [null],
      lastVerifiedAtIsoStrings: [stale],
      validationStatus: 'unverified',
      nowMs: now,
    });
    expect(withStale.components.verificationBonus).toBe(0);
  });

  it('adds +0.10 when validation_status = verified', () => {
    const { score, components } = confidenceScoringService.computeScore({
      activeSourceContributions: [],
      lastVerifiedAtIsoStrings: [],
      validationStatus: 'verified',
    });
    expect(components.manualVerifiedBonus).toBe(0.1);
    expect(score).toBe(0.4);
  });

  it('subtracts 0.20 when validation_status = flagged', () => {
    const { score, components } = confidenceScoringService.computeScore({
      activeSourceContributions: [0.9, 0.9, 0.9],
      lastVerifiedAtIsoStrings: [null, null, null],
      validationStatus: 'flagged',
    });
    expect(components.flaggedPenalty).toBe(-0.2);
    // base 0.30 + 3 * 0.10 + 0.9 * 0.20 - 0.20 = 0.30 + 0.30 + 0.18 - 0.20 = 0.58
    expect(score).toBe(0.58);
  });

  it('clamps to [0, 1]', () => {
    const high = confidenceScoringService.computeScore({
      activeSourceContributions: [1, 1, 1, 1, 1, 1, 1],
      lastVerifiedAtIsoStrings: [new Date().toISOString()],
      validationStatus: 'verified',
    });
    expect(high.score).toBeLessThanOrEqual(1);

    const low = confidenceScoringService.computeScore({
      activeSourceContributions: [],
      lastVerifiedAtIsoStrings: [],
      validationStatus: 'flagged',
    });
    // base 0.30 - 0.20 = 0.10 (still clamped fine)
    expect(low.score).toBe(0.1);
  });

  it('ignores malformed iso timestamps', () => {
    const { components } = confidenceScoringService.computeScore({
      activeSourceContributions: [null],
      lastVerifiedAtIsoStrings: ['not-a-date'],
      validationStatus: 'unverified',
    });
    expect(components.verificationBonus).toBe(0);
  });
});

describe('ConfidenceScoringService.recompute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    featureFlags.ENABLE_RECORD_PROVENANCE = true;
  });

  it('throws on empty recordId', async () => {
    await expect(confidenceScoringService.recompute('')).rejects.toThrow(/required/i);
  });

  it('no-ops when feature flag is OFF', async () => {
    featureFlags.ENABLE_RECORD_PROVENANCE = false;
    const out = await confidenceScoringService.recompute(RECORD_ID);
    expect(out).toEqual({
      recordId: RECORD_ID,
      applied: false,
      reason: 'feature_disabled',
    });
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('returns record_not_found when the record SELECT is empty', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const out = await confidenceScoringService.recompute(RECORD_ID);
    expect(out).toEqual({
      recordId: RECORD_ID,
      applied: false,
      reason: 'record_not_found',
    });
  });

  it('writes a new score on a fresh record with no sources', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [recordRow({ confidence_score: null })] }) // SELECT record
      .mockResolvedValueOnce({ rows: [] }) // SELECT sources
      .mockResolvedValueOnce({ rows: [] }); // UPDATE

    const out = await confidenceScoringService.recompute(RECORD_ID);
    expect(out.applied).toBe(true);
    if (out.applied) {
      expect(out.next).toBe(0.3);
      expect(out.previous).toBeNull();
      expect(out.activeSourceCount).toBe(0);
      expect(out.validationStatus).toBe('unverified');
    }
    expect(mockQuery).toHaveBeenCalledTimes(3);
    const updateCall = mockQuery.mock.calls[2];
    expect(updateCall[0]).toMatch(/UPDATE\s+tp_records/i);
    expect(updateCall[1]).toEqual([0.3, RECORD_ID]);
  });

  it('skips UPDATE when the score is unchanged (idempotent)', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [recordRow({ confidence_score: 0.3 })] })
      .mockResolvedValueOnce({ rows: [] });

    const out = await confidenceScoringService.recompute(RECORD_ID);
    expect(out.applied).toBe(true);
    if (out.applied) {
      expect(out.previous).toBe(0.3);
      expect(out.next).toBe(0.3);
    }
    expect(mockQuery).toHaveBeenCalledTimes(2); // no UPDATE
  });

  it('combines sources with verified status (numeric strings from PG NUMERIC)', async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [recordRow({ confidence_score: '0.30', validation_status: 'verified' })],
      })
      .mockResolvedValueOnce({
        rows: [
          { confidence_contribution: '0.80', last_verified_at: null },
          { confidence_contribution: '0.60', last_verified_at: null },
        ],
      })
      .mockResolvedValueOnce({ rows: [] });

    const out = await confidenceScoringService.recompute(RECORD_ID);
    expect(out.applied).toBe(true);
    if (out.applied) {
      // base 0.30 + 2*0.10 + avg(0.70)*0.20 + 0.10 (verified) = 0.30+0.20+0.14+0.10 = 0.74
      expect(out.next).toBe(0.74);
      expect(out.activeSourceCount).toBe(2);
    }
  });

  it('recogniSes Date instances on last_verified_at', async () => {
    const fresh = new Date(Date.now() - 1000 * 60 * 60 * 24); // 1 day ago
    mockQuery
      .mockResolvedValueOnce({ rows: [recordRow()] })
      .mockResolvedValueOnce({
        rows: [{ confidence_contribution: null, last_verified_at: fresh }],
      })
      .mockResolvedValueOnce({ rows: [] });

    const out = await confidenceScoringService.recompute(RECORD_ID);
    expect(out.applied).toBe(true);
    if (out.applied) {
      // base 0.30 + 1*0.10 + verification 0.10 = 0.50
      expect(out.next).toBe(0.5);
    }
  });

  it('caps source-count bonus at 3 sources', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [recordRow()] })
      .mockResolvedValueOnce({
        rows: Array.from({ length: 7 }, () => ({
          confidence_contribution: null,
          last_verified_at: null,
        })),
      })
      .mockResolvedValueOnce({ rows: [] });

    const out = await confidenceScoringService.recompute(RECORD_ID);
    expect(out.applied).toBe(true);
    if (out.applied) {
      // base 0.30 + capped 3 * 0.10 = 0.60
      expect(out.next).toBe(0.6);
      expect(out.activeSourceCount).toBe(7);
    }
  });
});

describe('ConfidenceScoringService.recomputeBulk', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    featureFlags.ENABLE_RECORD_PROVENANCE = true;
  });

  it('isolates errors so one failure does not stop the loop', async () => {
    mockQuery
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({ rows: [recordRow()] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const out = await confidenceScoringService.recomputeBulk(['rec-bad', 'rec-ok']);
    expect(out).toHaveLength(1); // only the second one succeeded
    expect(out[0]?.recordId).toBe('rec-ok');
  });
});
