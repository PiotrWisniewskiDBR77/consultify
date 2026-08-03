/**
 * KPI Attribution Service (T048)
 *
 * Heuristic-based contribution estimation for KPI changes.
 * Distributes observed KPI delta across mapped initiatives proportionally
 * to weights, progress, and timing.
 *
 * V2 baseline: deterministic heuristics with honest uncertainty.
 */

import { all as dbAll } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

export interface ContributionEstimate {
  initiativeId: string;
  initiativeName: string;
  contributionPercent: number;
  contributionValue: number;
  confidence: 'low' | 'medium' | 'high';
  confidenceReason: string;
  explanation: string;
  signals: string[];
}

export interface AttributionResult {
  kpiId: string;
  kpiName: string;
  periodStart: string;
  periodEnd: string;
  kpiDelta: number;
  contributions: ContributionEstimate[];
  unexplainedRemainder: number;
  unexplainedPercent: number;
  overallConfidence: 'low' | 'medium' | 'high';
  confidenceReasons: string[];
  assumptions: string[];
  disclaimer: string;
}

export async function computeAttribution(
  kpiId: string,
  organizationId: string,
  periodStart: string,
  periodEnd: string
): Promise<AttributionResult> {
  const disclaimer =
    'This is a contribution estimate based on heuristics, not a causal proof. Actual attribution may differ.';

  // RES-011: org-scoped by construction — no cross-tenant read. This used to
  // be `WHERE ik.id = ?` with no organization predicate at all (the caller's
  // `organizationId` param existed but was only applied to the later
  // initiative_kpi_mappings join, §7 of the RES-011 packet). A foreign-org
  // kpiId now falls into the exact same "Unknown" empty-result branch as a
  // genuinely nonexistent kpiId — the caller cannot distinguish "not yours"
  // from "doesn't exist", matching this codebase's existing convention for
  // cross-tenant artifact access (mirrors the ownership precheck already
  // used by the sibling POST /attribution/:kpiId/snapshot route).
  const kpiRows = await dbAll(
    `SELECT ik.id, ik.name, ik.unit, ik.baseline_value, ik.target_value, ik.current_value
     FROM initiative_kpis ik
     LEFT JOIN initiatives i ON i.id = ik.initiative_id
     WHERE ik.id = ? AND COALESCE(ik.organization_id, i.organization_id) = ?`,
    [kpiId, organizationId]
  );
  const kpi = kpiRows?.[0] as any;
  if (!kpi) {
    return emptyResult(kpiId, 'Unknown', periodStart, periodEnd, disclaimer);
  }

  const tsRows = await dbAll(
    `SELECT value, period_start FROM kpi_time_series
     WHERE kpi_id = ? AND organization_id = ? AND period_start >= ? AND period_start <= ?
     ORDER BY period_start`,
    [kpiId, organizationId, periodStart, periodEnd]
  );

  const timeSeries = (tsRows || []) as any[];
  if (timeSeries.length < 2) {
    return emptyResult(kpiId, kpi.name, periodStart, periodEnd, disclaimer, [
      'Insufficient KPI history (need at least 2 data points)',
    ]);
  }

  const firstVal = timeSeries[0].value;
  const lastVal = timeSeries[timeSeries.length - 1].value;
  const kpiDelta = lastVal - firstVal;

  if (Math.abs(kpiDelta) < 0.001) {
    return emptyResult(kpiId, kpi.name, periodStart, periodEnd, disclaimer, [
      'No significant KPI change in period',
    ]);
  }

  const mappings = await dbAll(
    `SELECT m.*, i.name as initiative_name, i.status, i.progress
     FROM initiative_kpi_mappings m
     JOIN initiatives i ON i.id = m.initiative_id
     WHERE m.kpi_id = ? AND m.organization_id = ?`,
    [kpiId, organizationId]
  );

  const maps = (mappings || []) as any[];
  if (maps.length === 0) {
    return {
      ...emptyResult(kpiId, kpi.name, periodStart, periodEnd, disclaimer),
      kpiDelta,
      unexplainedRemainder: kpiDelta,
      unexplainedPercent: 100,
      confidenceReasons: ['No initiatives mapped to this KPI'],
    };
  }

  const confidenceReasons: string[] = [];
  const assumptions: string[] = [
    'Contribution proportional to mapping weight × initiative progress',
    `Analysis period: ${periodStart} to ${periodEnd}`,
    `KPI delta: ${kpiDelta.toFixed(2)} ${kpi.unit || ''}`,
  ];

  let totalWeight = 0;
  const weightedMaps = maps.map((m: any) => {
    const progress = (m.progress || 0) / 100;
    const statusMultiplier = getStatusMultiplier(m.status);
    const effectiveWeight = (m.impact_weight || 1) * progress * statusMultiplier;
    totalWeight += effectiveWeight;
    return { ...m, effectiveWeight, progress, statusMultiplier };
  });

  if (totalWeight < 0.01) {
    confidenceReasons.push('All mapped initiatives have near-zero effective weight');
    return {
      ...emptyResult(kpiId, kpi.name, periodStart, periodEnd, disclaimer),
      kpiDelta,
      unexplainedRemainder: kpiDelta,
      unexplainedPercent: 100,
      confidenceReasons,
      assumptions,
    };
  }

  const coverageRatio = Math.min(1.0, totalWeight / Math.max(maps.length, 1));
  const attributablePortion = Math.min(0.9, coverageRatio);

  const contributions: ContributionEstimate[] = weightedMaps.map((m: any) => {
    const share = m.effectiveWeight / totalWeight;
    const contributionPercent = Math.round(share * attributablePortion * 100 * 10) / 10;
    const contributionValue = Math.round(kpiDelta * share * attributablePortion * 100) / 100;

    const signals: string[] = [];
    if (m.progress > 0) signals.push(`Progress: ${(m.progress * 100).toFixed(0)}%`);
    if (m.impact_weight !== 1) signals.push(`Weight: ${m.impact_weight}`);
    if (m.expected_delta) signals.push(`Expected delta: ${m.expected_delta}`);
    signals.push(`Status: ${m.status}`);

    const confidence = computeContributionConfidence(m, timeSeries.length);

    return {
      initiativeId: m.initiative_id,
      initiativeName: m.initiative_name || 'Unknown',
      contributionPercent,
      contributionValue,
      confidence,
      confidenceReason: getConfidenceReason(confidence, m, timeSeries.length),
      explanation: `${m.initiative_name} contributed ~${contributionPercent}% of the KPI change based on its weight (${m.impact_weight}), progress (${(m.progress * 100).toFixed(0)}%), and status (${m.status}).`,
      signals,
    };
  });

  const totalAttributed = contributions.reduce((s, c) => s + c.contributionPercent, 0);
  const unexplainedPercent = Math.round((100 - totalAttributed) * 10) / 10;
  const unexplainedRemainder = Math.round(kpiDelta * (unexplainedPercent / 100) * 100) / 100;

  if (maps.length > 5)
    confidenceReasons.push('Many overlapping initiatives reduce attribution precision');
  if (timeSeries.length < 4) confidenceReasons.push('Limited KPI history reduces trend confidence');
  if (totalWeight < maps.length * 0.3) confidenceReasons.push('Low overall initiative progress');

  const overallConfidence = computeOverallConfidence(timeSeries.length, maps.length, coverageRatio);

  return {
    kpiId,
    kpiName: kpi.name,
    periodStart,
    periodEnd,
    kpiDelta,
    contributions: contributions.sort((a, b) => b.contributionPercent - a.contributionPercent),
    unexplainedRemainder,
    unexplainedPercent,
    overallConfidence,
    confidenceReasons,
    assumptions,
    disclaimer,
  };
}

function getStatusMultiplier(status: string): number {
  const map: Record<string, number> = {
    DONE: 1.0,
    TRACKING: 0.9,
    EXECUTING: 0.7,
    PROMOTED: 0.5,
    PENDING_REVIEW: 0.2,
    BLOCKED: 0.1,
    CANCELLED: 0,
  };
  return map[status] || 0.3;
}

function computeContributionConfidence(
  mapping: any,
  dataPoints: number
): 'low' | 'medium' | 'high' {
  let score = 0;
  if (mapping.impact_weight > 0) score += 1;
  if (mapping.expected_delta) score += 1;
  if (mapping.progress > 0.5) score += 1;
  if (dataPoints >= 6) score += 1;
  if (['DONE', 'TRACKING'].includes(mapping.status)) score += 1;
  if (score >= 4) return 'high';
  if (score >= 2) return 'medium';
  return 'low';
}

function getConfidenceReason(conf: string, mapping: any, dp: number): string {
  if (conf === 'high') return 'Good data coverage: weights, progress, and KPI history available.';
  if (conf === 'medium') return 'Partial data: some mapping parameters or KPI history missing.';
  return `Low confidence: ${dp < 3 ? 'limited KPI history' : ''}${!mapping.expected_delta ? ', no expected delta' : ''}${mapping.progress < 0.3 ? ', low progress' : ''}.`;
}

function computeOverallConfidence(
  dataPoints: number,
  mappingCount: number,
  coverage: number
): 'low' | 'medium' | 'high' {
  let score = 0;
  if (dataPoints >= 6) score += 2;
  else if (dataPoints >= 3) score += 1;
  if (coverage > 0.5) score += 1;
  if (mappingCount > 0 && mappingCount <= 5) score += 1;
  if (score >= 3) return 'high';
  if (score >= 2) return 'medium';
  return 'low';
}

function emptyResult(
  kpiId: string,
  kpiName: string,
  periodStart: string,
  periodEnd: string,
  disclaimer: string,
  reasons: string[] = []
): AttributionResult {
  return {
    kpiId,
    kpiName,
    periodStart,
    periodEnd,
    kpiDelta: 0,
    contributions: [],
    unexplainedRemainder: 0,
    unexplainedPercent: 100,
    overallConfidence: 'low',
    confidenceReasons: reasons.length ? reasons : ['No data available for attribution'],
    assumptions: [],
    disclaimer,
  };
}
