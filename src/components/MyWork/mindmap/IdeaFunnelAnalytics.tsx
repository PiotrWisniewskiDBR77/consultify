/**
 * IdeaFunnelAnalytics — Visualizes the idea funnel:
 * Idea → Exploring → Validated → Ready to Convert → Converted
 */
import { ArrowDown, BarChart3, ChevronLeft, TrendingUp, X } from 'lucide-react';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

interface IdeaFunnelAnalyticsProps {
  open: boolean;
  onClose: () => void;
  nodes: Array<{ id: string; data: any }>;
}

const FUNNEL_STAGES = [
  { key: 'idea', labelPl: 'Pomysł', labelEn: 'Idea', color: '#94a3b8', bg: 'bg-slate-100 dark:bg-slate-800/30' },
  { key: 'exploring', labelPl: 'Eksploracja', labelEn: 'Exploring', color: '#3b82f6', bg: 'bg-blue-100 dark:bg-blue-900/30' },
  { key: 'validated', labelPl: 'Zwalidowany', labelEn: 'Validated', color: '#22c55e', bg: 'bg-emerald-100 dark:bg-emerald-900/30' },
  { key: 'ready_to_convert', labelPl: 'Gotowy', labelEn: 'Ready', color: '#f59e0b', bg: 'bg-amber-100 dark:bg-amber-900/30' },
  { key: 'converted', labelPl: 'Skonwertowany', labelEn: 'Converted', color: '#8b5cf6', bg: 'bg-purple-100 dark:bg-purple-900/30' },
];

export const IdeaFunnelAnalytics: React.FC<IdeaFunnelAnalyticsProps> = ({ open, onClose, nodes }) => {
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');

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

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[92] bg-white/95 dark:bg-navy-950/95 backdrop-blur-xl flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-200/60 dark:border-navy-700/60">
        <button onClick={onClose} className="p-2 rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors">
          <ChevronLeft size={16} />
        </button>
        <BarChart3 size={16} className="text-amber-500" />
        <h2 className="text-sm font-bold text-slate-800 dark:text-white">
          {isPl ? 'Lejek pomysłów' : 'Idea Funnel'}
        </h2>
        <span className="text-[10px] text-slate-400 ml-auto">
          {total} {isPl ? 'pomysłów' : 'ideas'} · {overallConversion}% {isPl ? 'konwersja' : 'conversion'}
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
                  <div className="flex items-center gap-4" style={{ paddingLeft: `${idx * 3}%`, paddingRight: `${idx * 3}%` }}>
                    <div
                      className={`flex-1 py-4 px-5 rounded-xl ${stage.bg} border border-slate-200/30 dark:border-navy-700/30 transition-all`}
                      style={{ borderLeftColor: stage.color, borderLeftWidth: 4 }}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-[12px] font-bold text-slate-700 dark:text-slate-200">
                            {isPl ? stage.labelPl : stage.labelEn}
                          </div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                            {count} {isPl ? 'pomysłów' : 'ideas'} ({pct}%)
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[20px] font-bold" style={{ color: stage.color }}>{count}</div>
                        </div>
                      </div>
                      {/* Progress bar */}
                      <div className="mt-2 h-2 rounded-full bg-slate-200/50 dark:bg-navy-700/50 overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: stage.color }} />
                      </div>
                    </div>
                  </div>

                  {idx < FUNNEL_STAGES.length - 1 && (
                    <div className="flex justify-center py-1">
                      <ArrowDown size={16} className="text-slate-300 dark:text-slate-600" />
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>

          {/* Branch breakdown */}
          <div className="mt-8 pt-6 border-t border-slate-200/40 dark:border-navy-700/40">
            <h3 className="text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-3 flex items-center gap-2">
              <TrendingUp size={14} />
              {isPl ? 'Konwersja per gałąź' : 'Conversion per branch'}
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {branchStats.map(([bk, stats]) => (
                <div key={bk} className="p-3 rounded-xl bg-slate-50/50 dark:bg-navy-950/20 border border-slate-200/30 dark:border-navy-700/30">
                  <div className="text-[11px] font-bold text-slate-700 dark:text-slate-200 capitalize">{bk}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-slate-500">{stats.total} total</span>
                    <span className="text-[10px] text-emerald-600 font-bold">{stats.converted} converted</span>
                    <span className="text-[9px] text-slate-400">
                      ({stats.total > 0 ? Math.round((stats.converted / stats.total) * 100) : 0}%)
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 rounded-full bg-slate-200 dark:bg-navy-700 overflow-hidden">
                    <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${stats.total > 0 ? (stats.converted / stats.total) * 100 : 0}%` }} />
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
