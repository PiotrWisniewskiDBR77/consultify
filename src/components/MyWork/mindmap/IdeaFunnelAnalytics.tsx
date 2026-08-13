/**
 * IdeaFunnelAnalytics — Visualizes the idea funnel:
 * Idea → Exploring → Validated → Ready to Convert → Converted
 */
import { ArrowDown, BarChart3, ChevronLeft, TrendingUp, X } from 'lucide-react';
import React, { useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { useDialogA11y } from '@/components/ui/primitives/useDialogA11y';

interface IdeaFunnelAnalyticsProps {
  open: boolean;
  onClose: () => void;
  nodes: Array<{ id: string; data: any }>;
}

const FUNNEL_STAGES = [
  {
    key: 'idea',
    labelEn: 'Idea',
    color: 'var(--c-tag-8)',
    bg: 'bg-c-surface-raised dark:bg-c-surface',
  },
  {
    key: 'exploring',
    labelEn: 'Exploring',
    color: 'var(--c-info)',
    bg: 'bg-c-info dark:bg-c-info',
  },
  {
    key: 'validated',
    labelEn: 'Validated',
    color: 'var(--c-success)',
    bg: 'bg-c-success dark:bg-c-success',
  },
  {
    key: 'ready_to_convert',
    labelEn: 'Ready',
    color: 'var(--c-warning)',
    bg: 'bg-c-warning dark:bg-c-warning',
  },
  {
    key: 'converted',
    labelEn: 'Converted',
    color: 'var(--c-tag-2)',
    bg: 'bg-c-tag-2 dark:bg-c-tag-2',
  },
];

export const IdeaFunnelAnalytics: React.FC<IdeaFunnelAnalyticsProps> = ({
  open,
  onClose,
  nodes,
}) => {
  const { t } = useTranslation();

  const ideaNodes = useMemo(() => {
    return nodes.filter((n) => n.id !== 'root' && !n.id.startsWith('branch-'));
  }, [nodes]);

  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const stage of FUNNEL_STAGES) counts[stage.key] = 0;
    for (const n of ideaNodes) {
      const status = n.data?.status || 'idea';
      counts[status] = (counts[status] || 0) + 1;
    }
    return counts;
  }, [ideaNodes]);

  const total = ideaNodes.length || 1;

  const conversionRates = useMemo(() => {
    const rates: Record<string, number> = {};
    let remaining = total;
    for (const stage of FUNNEL_STAGES) {
      rates[stage.key] = remaining > 0 ? Math.round((stageCounts[stage.key] / remaining) * 100) : 0;
      remaining -= stageCounts[stage.key];
    }
    return rates;
  }, [stageCounts, total]);

  const overallConversion = useMemo(() => {
    const converted = stageCounts.converted || 0;
    return total > 0 ? Math.round((converted / total) * 100) : 0;
  }, [stageCounts, total]);

  // Branch breakdown
  const branchStats = useMemo(() => {
    const stats: Record<string, { total: number; converted: number }> = {};
    for (const n of ideaNodes) {
      const bk = n.data?.branchKey || 'unknown';
      if (!stats[bk]) stats[bk] = { total: 0, converted: 0 };
      stats[bk].total++;
      if (n.data?.status === 'converted') stats[bk].converted++;
    }
    return Object.entries(stats).sort((a, b) => b[1].total - a[1].total);
  }, [ideaNodes]);

  const containerRef = useRef<HTMLDivElement>(null);
  useDialogA11y({ open, onClose, containerRef });

  if (!open) return null;

  return (
    <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="idea-funnel-analytics-view-heading"
        tabIndex={-1}
        className="fixed inset-0 z-modal bg-c-surface-raised dark:bg-c-surface backdrop-blur-xl flex flex-col outline-none"
      >
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-c-border-subtle dark:border-c-border-subtle">
        <button
          onClick={onClose}
          className="p-2 rounded-lg text-c-text-secondary hover:text-c-text-secondary dark:text-c-text-muted dark:hover:text-c-text hover:bg-c-surface-raised dark:hover:bg-c-surface transition-colors"
        >
          <ChevronLeft size={16} />
        </button>
        <BarChart3 size={16} className="text-c-warning" />
        <h2 className="text-sm font-bold text-c-text dark:text-c-text" id="idea-funnel-analytics-view-heading">
          {t('ideas.mindmap.ideaFunnel', 'Idea Funnel')}
        </h2>
        <span className="text-[10px] text-c-text-secondary ml-auto">
          {total} {t('ideas.mindmap.ideas', 'ideas')} · {overallConversion}%{' '}
          {t('ideas.mindmap.conversion', 'conversion')}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-8">
        <div className="max-w-2xl mx-auto">
          {/* Funnel visualization */}
          <div className="space-y-0">
            {FUNNEL_STAGES.map((stage, idx) => {
              const count = stageCounts[stage.key] || 0;
              const pct = Math.round((count / total) * 100);
              const widthPct = Math.max(20, 100 - idx * 15);

              return (
                <React.Fragment key={stage.key}>
                  <div
                    className="flex items-center gap-4"
                    style={{ paddingLeft: `${idx * 3}%`, paddingRight: `${idx * 3}%` }}
                  >
                    <div
                      className={`flex-1 py-4 px-5 rounded-xl ${stage.bg} border border-c-border-subtle dark:border-c-border-subtle transition-all`}
                      style={{ borderLeftColor: stage.color, borderLeftWidth: 4 }}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-[12px] font-bold text-c-text-secondary dark:text-c-text">
                            {t(`myWorkMindmap.funnel.${stage.key}`, stage.labelEn)}
                          </div>
                          <div className="text-[10px] text-c-text-secondary dark:text-c-text-muted mt-0.5">
                            {count} {t('ideas.mindmap.ideas', 'ideas')} ({pct}%)
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[20px] font-bold" style={{ color: stage.color }}>
                            {count}
                          </div>
                        </div>
                      </div>
                      {/* Progress bar */}
                      <div className="mt-2 h-2 rounded-full bg-c-surface-raised dark:bg-c-surface overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${pct}%`, backgroundColor: stage.color }}
                        />
                      </div>
                    </div>
                  </div>

                  {idx < FUNNEL_STAGES.length - 1 && (
                    <div className="flex justify-center py-1">
                      <ArrowDown
                        size={16}
                        className="text-c-text-secondary dark:text-c-text-muted"
                      />
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>

          {/* Branch breakdown */}
          <div className="mt-8 pt-6 border-t border-c-border-subtle dark:border-c-border-subtle">
            <h3 className="text-[11px] font-bold text-c-text-secondary dark:text-c-text-muted mb-3 flex items-center gap-2">
              <TrendingUp size={14} />
              {t('ideas.mindmap.conversionPerBranch', 'Conversion per branch')}
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {branchStats.map(([bk, stats]) => (
                <div
                  key={bk}
                  className="p-3 rounded-xl bg-c-surface-raised dark:bg-c-surface border border-c-border-subtle dark:border-c-border-subtle"
                >
                  <div className="text-[11px] font-bold text-c-text-secondary dark:text-c-text capitalize">
                    {bk}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-c-text-secondary">{stats.total} total</span>
                    <span className="text-[10px] text-c-success font-bold">
                      {stats.converted} converted
                    </span>
                    <span className="text-[9px] text-c-text-secondary">
                      ({stats.total > 0 ? Math.round((stats.converted / stats.total) * 100) : 0}%)
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 rounded-full bg-c-surface-raised dark:bg-c-surface overflow-hidden">
                    <div
                      className="h-full rounded-full bg-c-success transition-all"
                      style={{
                        width: `${stats.total > 0 ? (stats.converted / stats.total) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IdeaFunnelAnalytics;
