import { trackFunnelEvent } from '@/services/funnelAnalytics';

import { isLearningTelemetryEnabled } from './learningTelemetryFlag';

export type LearningLoopTelemetrySource = 'admin_panel' | 'unknown';

function safeTrack(event: string, payload: Record<string, unknown>): boolean {
  try {
    if (!isLearningTelemetryEnabled()) return false;
    trackFunnelEvent(event as any, payload);
    return true;
  } catch {
    return false;
  }
}

export function emitLearningLoopFeedbackSubmitted(payload: {
  readonly source: LearningLoopTelemetrySource;
  readonly rating: 1 | 2 | 3 | 4 | 5;
  readonly targetType: 'chat' | 'artifact' | 'tool' | 'unknown';
  readonly queuedForStewardship: boolean;
}): boolean {
  return safeTrack('learning_loop_feedback_submitted', { ...payload });
}

export function emitLearningLoopRetentionPreviewed(payload: {
  readonly source: LearningLoopTelemetrySource;
  readonly decision: 'retain' | 'deny';
}): boolean {
  return safeTrack('learning_loop_retention_previewed', { ...payload });
}

export function emitLearningLoopStewardshipLoaded(payload: {
  readonly source: LearningLoopTelemetrySource;
  readonly itemsCountBucket: '0' | '1_5' | '6_20' | '21_plus';
}): boolean {
  return safeTrack('learning_loop_stewardship_loaded', { ...payload });
}

export function emitLearningLoopStewardshipResolved(payload: {
  readonly source: LearningLoopTelemetrySource;
}): boolean {
  return safeTrack('learning_loop_stewardship_resolved', { ...payload });
}

export function emitLearningLoopIncidentReported(payload: {
  readonly source: LearningLoopTelemetrySource;
  readonly kind: 'drift' | 'incident';
  readonly severity: 'low' | 'medium' | 'high';
}): boolean {
  return safeTrack('learning_loop_incident_reported', { ...payload });
}

export function emitLearningLoopDashboardLoaded(payload: {
  readonly source: LearningLoopTelemetrySource;
}): boolean {
  return safeTrack('learning_loop_dashboard_loaded', { ...payload });
}

export function bucketItemsCount(count: unknown): '0' | '1_5' | '6_20' | '21_plus' {
  const n = typeof count === 'number' && Number.isFinite(count) ? count : Number(count);
  if (!Number.isFinite(n) || n <= 0) return '0';
  if (n <= 5) return '1_5';
  if (n <= 20) return '6_20';
  return '21_plus';
}

