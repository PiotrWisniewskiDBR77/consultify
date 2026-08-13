/**
 * RN-G5 §G #30 — `attentionPresenters.ts` bucket extraction/count pure
 * functions. Proves: (a) the two source domains' buckets are extracted
 * independently with no cross-contamination, (b) `performanceDistribution`
 * (a single stats object per the confirmed server shape, NOT a list) is
 * wrapped as exactly one synthetic row, never zero/many, (c)
 * `okr/team-health`'s `sets` list feeds the `teamHealthSets` bucket
 * specifically (not the 5 real `okr/attention` buckets), and (d) every
 * chip's count matches the actual row count for that exact bucket (the
 * thing a user visually checks against the table before trusting the
 * screen).
 */
import { describe, expect, it } from 'vitest';

import {
  bucketCount,
  extractKpiBucketRows,
  extractOkrBucketRows,
} from '../../../src/components/ResultsVNext/attention/attentionPresenters';
import type {
  OrganizationKpiAttentionDto,
  OrganizationOkrAttentionDto,
  OrganizationOkrTeamHealthDto,
} from '../../../src/components/ResultsVNext/attention/attentionApi';

const kpiDto: OrganizationKpiAttentionDto = {
  processCoverage: [{ primaryProcessId: 'proc-1', totalKpis: 5, activeKpis: 4 }],
  ownerLoad: [{ ownerUserId: 'user-1', activeKpiCount: 3, openDeviationCaseCount: 1 }],
  missingOwnership: [
    { kpiId: 'kpi-1', kpiCode: 'K-1' },
    { kpiId: 'kpi-2', kpiCode: 'K-2' },
  ],
  performanceDistribution: { onTarget: 8, warning: 3, critical: 1, neutralOrMissing: 2 },
  overdueObligations: [],
  repeatedDeviations: [],
  ineffectiveCorrectiveActions: [],
};

const okrDto: OrganizationOkrAttentionDto = {
  staleCheckins: [{ setId: 'set-1', title: 'Q3', nextCheckinDueAt: '2026-08-01T00:00:00Z' }],
  lowConfidenceObjectives: [],
  openSupportRequests: [],
  openBlockers: [],
  escalatedSets: [
    { setId: 'set-2', title: 'Costs', attentionState: 'escalated' },
    { setId: 'set-3', title: 'NPS', attentionState: 'escalated' },
  ],
};

const teamHealthDto: OrganizationOkrTeamHealthDto = {
  countsByStatus: [{ status: 'active', count: 4 }],
  countsByScopeType: [{ scopeType: 'company', count: 1 }],
  attentionBreakdown: [{ attentionState: 'escalated', count: 2 }],
  sets: [
    { setId: 'set-1', currentVersion: 3, status: 'active', scopeType: 'team' },
    { setId: 'set-2', currentVersion: 5, status: 'active', scopeType: 'company' },
    { setId: 'set-3', currentVersion: 1, status: 'active', scopeType: 'team' },
  ],
};

describe('attentionPresenters — bucket extraction', () => {
  it('extracts each KPI bucket independently, with performanceDistribution wrapped as exactly ONE row', () => {
    expect(extractKpiBucketRows('missingOwnership', kpiDto)).toHaveLength(2);
    expect(extractKpiBucketRows('overdueObligations', kpiDto)).toHaveLength(0);
    const perf = extractKpiBucketRows('performanceDistribution', kpiDto);
    expect(perf).toHaveLength(1);
    expect(perf[0]).toMatchObject({ onTarget: 8, warning: 3, critical: 1, neutralOrMissing: 2 });
  });

  it('extracts each OKR bucket independently, and teamHealthSets reads from the team-health DTO, not the attention DTO', () => {
    expect(extractOkrBucketRows('staleCheckins', okrDto, teamHealthDto)).toHaveLength(1);
    expect(extractOkrBucketRows('escalatedSets', okrDto, teamHealthDto)).toHaveLength(2);
    const teamHealthRows = extractOkrBucketRows('teamHealthSets', okrDto, teamHealthDto);
    expect(teamHealthRows).toHaveLength(3);
    expect(teamHealthRows.map((r) => r.id)).toEqual(['set-1', 'set-2', 'set-3']);
    // Passing a NULL attention DTO must not affect teamHealthSets (it reads
    // the team-health DTO exclusively) — proves no accidental cross-read.
    expect(extractOkrBucketRows('teamHealthSets', null, teamHealthDto)).toHaveLength(3);
  });

  it('bucketCount matches the real row count for every bucket (what a chip visually promises)', () => {
    expect(bucketCount('kpi', 'missingOwnership', kpiDto, null, null)).toBe(2);
    expect(bucketCount('kpi', 'performanceDistribution', kpiDto, null, null)).toBe(1);
    expect(bucketCount('okr', 'escalatedSets', null, okrDto, null)).toBe(2);
    expect(bucketCount('okr', 'teamHealthSets', null, null, teamHealthDto)).toBe(3);
    // Missing DTO (still loading) -> honest 0, never a fabricated count.
    expect(bucketCount('kpi', 'missingOwnership', null, null, null)).toBe(0);
  });
});
