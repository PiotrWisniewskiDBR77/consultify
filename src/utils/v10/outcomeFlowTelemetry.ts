import { trackFunnelEvent } from '@/services/funnelAnalytics';

import { isOutcomeTelemetryEnabled } from './outcomeTelemetryFlag';

export type OutcomeFlowTelemetrySource = 'admin_panel' | 'unknown';

function safeTrack(event: string, payload: Record<string, unknown>): boolean {
  try {
    if (!isOutcomeTelemetryEnabled()) return false;
    trackFunnelEvent(event as any, payload);
    return true;
  } catch {
    return false;
  }
}

export function bucketMetricsCount(count: unknown): '1' | '2_3' | '4_5' | '6_plus' {
  const n = typeof count === 'number' && Number.isFinite(count) ? count : Number(count);
  if (!Number.isFinite(n) || n <= 1) return '1';
  if (n <= 3) return '2_3';
  if (n <= 5) return '4_5';
  return '6_plus';
}

export function bucketAcceptedCount(count: unknown): '0' | '1' | '2_3' | '4_plus' {
  const n = typeof count === 'number' && Number.isFinite(count) ? count : Number(count);
  if (!Number.isFinite(n) || n <= 0) return '0';
  if (n <= 1) return '1';
  if (n <= 3) return '2_3';
  return '4_plus';
}

export function emitOutcomeKpiAcceptancePreviewed(payload: {
  readonly source: OutcomeFlowTelemetrySource;
  readonly metricsCountBucket: '1' | '2_3' | '4_5' | '6_plus';
}): boolean {
  return safeTrack('outcome_kpi_acceptance_previewed', { ...payload });
}

export function emitOutcomeSignalIngested(payload: {
  readonly source: OutcomeFlowTelemetrySource;
  readonly kind:
    | 'time_saved'
    | 'decision_shipped'
    | 'revenue'
    | 'margin'
    | 'risk_avoided'
    | 'quality';
}): boolean {
  return safeTrack('outcome_signal_ingested', { ...payload });
}

export function emitOutcomeAcceptanceResolved(payload: {
  readonly source: OutcomeFlowTelemetrySource;
  readonly decision: 'accepted' | 'rejected' | 'needs_revision';
  readonly acceptedCountBucket: '0' | '1' | '2_3' | '4_plus';
}): boolean {
  return safeTrack('outcome_acceptance_resolved', { ...payload });
}

export function emitOutcomeBusinessLinked(payload: {
  readonly source: OutcomeFlowTelemetrySource;
  readonly metricsCountBucket: '1' | '2_3' | '4_5' | '6_plus';
  readonly strongestSignalKind:
    | 'time_saved'
    | 'decision_shipped'
    | 'revenue'
    | 'margin'
    | 'risk_avoided'
    | 'quality';
}): boolean {
  return safeTrack('outcome_business_linked', { ...payload });
}
