/**
 * Pure unit tests for the WP-B03 rank/cycle rule mirror — no database. The
 * DB trigger `finance_lineage_prevent_cycle` (migration
 * `20260809_finance_v3_b03_lineage_freshness.sql`) is the authoritative
 * enforcement and is exercised by the WP-C01 migration report's own test
 * #10 and by `canonicalServices.pg.test.ts` in this directory; this file
 * only proves the app-level pre-check (`validateEdgeRank`/`stageRank`)
 * agrees with that trigger's logic, so a client gets a fast, typed 4xx
 * instead of always paying a round-trip to discover a cycle.
 */
import { describe, expect, it } from 'vitest';

import { stageRank, validateEdgeRank } from '../lineageService.js';

describe('stageRank — mirrors finance_artifact_stage_rank() SQL function', () => {
  it('assigns the documented order STATEMENT_PACK < HISTORICAL_ANALYSIS < BASELINE_MODEL < PREDICTION_SCENARIO < VALUATION_CASE < REPORT_EXPORT', () => {
    expect(stageRank('STATEMENT_PACK')).toBe(0);
    expect(stageRank('HISTORICAL_ANALYSIS')).toBe(1);
    expect(stageRank('BASELINE_MODEL')).toBe(2);
    expect(stageRank('PREDICTION_SCENARIO')).toBe(3);
    expect(stageRank('VALUATION_CASE')).toBe(4);
    expect(stageRank('REPORT_EXPORT')).toBe(5);
  });
});

describe('validateEdgeRank — WP-B03 §4 cycle rule', () => {
  it('accepts a forward edge (source rank < target rank)', () => {
    const result = validateEdgeRank('STATEMENT_PACK', 'BASELINE_MODEL', 'STATEMENT_TO_MODEL');
    expect(result).toEqual({ ok: true });
  });

  it('rejects a same-rank edge (would-be self-loop at the type level)', () => {
    const result = validateEdgeRank('BASELINE_MODEL', 'BASELINE_MODEL', 'STATEMENT_TO_MODEL');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('LINEAGE_CYCLE_REJECTED');
  });

  it('rejects a backward edge (target rank < source rank) — the actual cycle case', () => {
    const result = validateEdgeRank('BASELINE_MODEL', 'STATEMENT_PACK', 'VERSION_TO_REPORT');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('LINEAGE_CYCLE_REJECTED');
  });

  it('VERSION_TO_MANAGEMENT_ADJUSTED_VARIANT is exempt from the rank rule even same-rank (WP-B06 §4.5)', () => {
    const result = validateEdgeRank('BASELINE_MODEL', 'BASELINE_MODEL', 'VERSION_TO_MANAGEMENT_ADJUSTED_VARIANT');
    expect(result).toEqual({ ok: true });
  });

  it('ANALYSIS_TO_MODEL requires an assumption_snapshot_hash (WP-B03 §3.3)', () => {
    const withoutHash = validateEdgeRank('HISTORICAL_ANALYSIS', 'BASELINE_MODEL', 'ANALYSIS_TO_MODEL');
    expect(withoutHash.ok).toBe(false);
    if (!withoutHash.ok) expect(withoutHash.code).toBe('ASSUMPTION_SNAPSHOT_HASH_REQUIRED');

    const withHash = validateEdgeRank('HISTORICAL_ANALYSIS', 'BASELINE_MODEL', 'ANALYSIS_TO_MODEL', 'sha256:abc');
    expect(withHash).toEqual({ ok: true });
  });

  it('STATEMENT_TO_MODEL does not require an assumption hash', () => {
    const result = validateEdgeRank('STATEMENT_PACK', 'BASELINE_MODEL', 'STATEMENT_TO_MODEL', null);
    expect(result).toEqual({ ok: true });
  });
});
