import { apiGet, apiPost } from './api/baseClient';

export interface AiQualityMetrics {
  satisfactionRate: number | null;
  totalFeedback: number;
  positiveFeedback: number;
  negativeFeedback: number;
  avgActionability: number | null;
  avgAccuracy: number | null;
  activePatternsCount: number;
  userProfilesCount: number;
}
export interface AiFeedback {
  id: string;
  feedback_type?: string;
  rating?: number;
  screen_context?: string;
  user_name?: string;
  reviewed_at?: string | null;
  created_at?: string;
}
export interface AiLearningPattern {
  id: string;
  pattern_type?: string;
  pattern_value?: string;
  confidence_score?: number;
  occurrence_count?: number;
  status: string;
}

export const getAiQualityMetrics = async () =>
  (await apiGet<{ metrics: AiQualityMetrics }>('/admin/ai-quality/metrics')).metrics;
export const getAiQualityFeedback = async () =>
  (await apiGet<{ feedback: AiFeedback[] }>('/admin/ai-quality/feedback?limit=50')).feedback;
export const reviewAiQualityFeedback = (id: string) =>
  apiPost(`/admin/ai-quality/feedback/${encodeURIComponent(id)}/review`, {
    actionTaken: 'reviewed',
  });
export const getAiQualityPatterns = async () =>
  (await apiGet<{ patterns: AiLearningPattern[] }>('/admin/ai-quality/patterns?status=all'))
    .patterns;
export const updateAiQualityPatternStatus = (id: string, status: string) =>
  apiPost(`/admin/ai-quality/patterns/${encodeURIComponent(id)}/status`, { status });
export const getAiQualityAnalytics = async () => {
  const [contexts, formats, issues] = await Promise.all([
    apiGet<{ contexts: unknown[] }>('/admin/ai-quality/analytics/contexts'),
    apiGet<{ formats: unknown[] }>('/admin/ai-quality/analytics/formats'),
    apiGet<{ issues: unknown[] }>('/admin/ai-quality/analytics/issues'),
  ]);
  return { contexts: contexts.contexts, formats: formats.formats, issues: issues.issues };
};
