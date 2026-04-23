import { trackFunnelEvent } from '@/services/funnelAnalytics';

import { isResearchTelemetryEnabled } from './researchTelemetryFlag';

export type ResearchFlowTelemetrySource = 'admin_panel' | 'unknown';

function safeTrack(event: string, payload: Record<string, unknown>): boolean {
  try {
    if (!isResearchTelemetryEnabled()) return false;
    trackFunnelEvent(event as any, payload);
    return true;
  } catch {
    return false;
  }
}

export function emitResearchMissionPlanned(payload: {
  readonly source: ResearchFlowTelemetrySource;
  readonly depth: 'quick' | 'standard' | 'deep';
  readonly maxSourcesBucket: '1_5' | '6_10' | '11_20' | '21_plus';
}): boolean {
  return safeTrack('research_mission_planned', { ...payload });
}

export function emitResearchMissionWatchedDelta(payload: {
  readonly source: ResearchFlowTelemetrySource;
  readonly eventsCountBucket: '0' | '1_3' | '4_10' | '11_plus';
  readonly completed: boolean;
}): boolean {
  return safeTrack('research_mission_watched_delta', { ...payload });
}

export function emitResearchMissionSummaryLoaded(payload: {
  readonly source: ResearchFlowTelemetrySource;
  readonly status: 'planned' | 'running' | 'completed' | 'unknown';
}): boolean {
  return safeTrack('research_mission_summary_loaded', { ...payload });
}

export function emitReasoningDelegatedResearchPlan(payload: {
  readonly source: ResearchFlowTelemetrySource;
  readonly depth: 'quick' | 'standard' | 'deep';
}): boolean {
  return safeTrack('reasoning_delegated_research_plan', { ...payload });
}

export function bucketMaxSources(maxSources: unknown): '1_5' | '6_10' | '11_20' | '21_plus' {
  const n = typeof maxSources === 'number' && Number.isFinite(maxSources) ? maxSources : Number(maxSources);
  if (!Number.isFinite(n) || n <= 5) return '1_5';
  if (n <= 10) return '6_10';
  if (n <= 20) return '11_20';
  return '21_plus';
}

export function bucketEventsCount(count: unknown): '0' | '1_3' | '4_10' | '11_plus' {
  const n = typeof count === 'number' && Number.isFinite(count) ? count : Number(count);
  if (!Number.isFinite(n) || n <= 0) return '0';
  if (n <= 3) return '1_3';
  if (n <= 10) return '4_10';
  return '11_plus';
}

