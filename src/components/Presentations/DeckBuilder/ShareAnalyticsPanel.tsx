/**
 * ShareAnalyticsPanel — G3: Share analytics for presentations.
 * Shows page views, per-card engagement, unique viewers, daily trends.
 */

import { BarChart3, Eye, TrendingUp, Users, X } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

const API_URL = import.meta.env.VITE_API_URL || '/api';

interface PerCardStat {
  card_index: number;
  views: number;
  avg_duration_ms: number;
}

interface DailyView {
  date: string;
  viewers: number;
}

interface AnalyticsData {
  summary: { unique_viewers: number; total_views: number };
  perCard: PerCardStat[];
  dailyViews: DailyView[];
}

interface ShareAnalyticsPanelProps {
  deckId: string;
  isOpen: boolean;
  onClose: () => void;
  totalCards: number;
}

function getHeaders() {
  return {
    Authorization: `Bearer ${localStorage.getItem('token')}`,
  };
}

export const ShareAnalyticsPanel: React.FC<ShareAnalyticsPanelProps> = ({
  deckId,
  isOpen,
  onClose,
  totalCards,
}) => {
  const { t } = useTranslation();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(false);

  const loadAnalytics = useCallback(async () => {
    if (!deckId) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/presentations/decks/${deckId}/analytics`, {
        headers: getHeaders(),
      });
      if (res.ok) {
        const json = await res.json();
        setData(json.data);
      }
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, [deckId]);

  useEffect(() => {
    if (isOpen && deckId) loadAnalytics();
  }, [isOpen, deckId, loadAnalytics]);

  if (!isOpen) return null;

  const maxCardViews = Math.max(1, ...(data?.perCard || []).map((c) => c.views));

  return (
    <div className="absolute top-0 right-0 w-80 h-full bg-c-surface border-l border-c-border-subtle z-30 flex flex-col shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-c-border-subtle">
        <div className="flex items-center gap-2">
          <BarChart3 size={16} className="text-c-accent" />
          <h3 className="text-sm font-semibold text-c-text">
            {t('presentations.analytics.title', 'Share Analytics')}
          </h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('common.close', 'Close')}
          title={t('common.close', 'Close')}
          className="inline-flex h-9 w-9 items-center justify-center rounded text-c-text-secondary hover:bg-c-surface-raised hover:text-c-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
        >
          <X size={16} aria-hidden />
        </button>
      </div>

      {/* Summary Cards */}
      {data && (
        <div className="grid grid-cols-2 gap-2 px-4 py-3 border-b border-c-border-subtle">
          <div className="p-3 rounded-lg bg-c-accent-soft0">
            <div className="flex items-center gap-1.5">
              <Eye size={12} className="text-c-accent" />
              <span className="text-[10px] text-c-text-secondary uppercase">
                {t('presentations.analytics.totalViews', 'Total Views')}
              </span>
            </div>
            <p className="text-xl font-bold text-c-text mt-1">{data.summary.total_views}</p>
          </div>
          <div className="p-3 rounded-lg bg-blue-500/5">
            <div className="flex items-center gap-1.5">
              <Users size={12} className="text-blue-500" />
              <span className="text-[10px] text-c-text-secondary uppercase">
                {t('presentations.analytics.uniqueViewers', 'Unique Viewers')}
              </span>
            </div>
            <p className="text-xl font-bold text-c-text mt-1">{data.summary.unique_viewers}</p>
          </div>
        </div>
      )}

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin w-5 h-5 border-2 border-c-accent border-t-transparent rounded-full" />
          </div>
        )}

        {!loading && data && (
          <>
            {/* Per-Card Engagement */}
            <div>
              <h4 className="text-xs font-semibold text-c-text-secondary uppercase tracking-wide mb-2">
                {t('presentations.analytics.perCard', 'Per-Card Engagement')}
              </h4>
              <div className="space-y-1.5">
                {Array.from({ length: totalCards }, (_, i) => {
                  const stat = data.perCard.find((c) => c.card_index === i);
                  const views = stat?.views || 0;
                  const avgDur = stat?.avg_duration_ms || 0;
                  const pct = (views / maxCardViews) * 100;

                  return (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-[10px] text-c-text-secondary w-5 text-right">
                        {i + 1}
                      </span>
                      <div className="flex-1 h-3 bg-c-surface-raised rounded-full overflow-hidden">
                        <div
                          className="h-full bg-c-surface rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-c-text-secondary w-10 text-right">
                        {views}
                      </span>
                      {avgDur > 0 && (
                        <span className="text-[9px] text-c-text-secondary w-12 text-right">
                          {(avgDur / 1000).toFixed(1)}s
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Daily Views */}
            {data.dailyViews.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-c-text-secondary uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <TrendingUp size={12} className="text-green-500" />
                  {t('presentations.analytics.dailyViews', 'Daily Viewers (last 30d)')}
                </h4>
                <div className="space-y-1">
                  {data.dailyViews.slice(0, 14).map((dv) => (
                    <div key={dv.date} className="flex items-center justify-between text-[11px]">
                      <span className="text-c-text-secondary">{dv.date}</span>
                      <span className="font-medium text-c-text">
                        {dv.viewers} viewer{dv.viewers !== 1 ? 's' : ''}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* No data */}
            {data.summary.total_views === 0 && (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <Eye size={28} className="text-c-text-secondary mb-2" />
                <p className="text-xs text-c-text-secondary">
                  {t(
                    'presentations.analytics.noViews',
                    'No views yet. Share your deck to start tracking engagement.'
                  )}
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-c-border-subtle">
        <button
          onClick={loadAnalytics}
          disabled={loading}
          className="w-full py-2 rounded-lg border border-c-border-subtle text-xs font-medium text-c-text-secondary hover:bg-c-surface-raised disabled:opacity-50"
        >
          {t('presentations.analytics.refresh', 'Refresh Analytics')}
        </button>
      </div>
    </div>
  );
};
