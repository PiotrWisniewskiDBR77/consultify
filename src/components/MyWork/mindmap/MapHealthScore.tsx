/**
 * MapHealthScore — Floating widget showing map health metrics:
 * balance, depth, coverage, maturity, and overall score.
 */
import { Activity, ChevronDown, ChevronUp, Heart, TrendingUp } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface MapHealthScoreProps {
  nodes: Array<{ id: string; data: any; type?: string }>;
  edges: Array<{ source: string; target: string }>;
  visible?: boolean;
}

interface HealthMetric {
  key: string;
  labelPl: string;
  labelEn: string;
  score: number;
  detail: string;
}

export const MapHealthScore: React.FC<MapHealthScoreProps> = ({ nodes, edges, visible = true }) => {
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');
  const [expanded, setExpanded] = useState(false);

  const metrics = useMemo((): HealthMetric[] => {
    const branchNodes = nodes.filter((n) => n.id.startsWith('branch-'));
    const ideaNodes = nodes.filter((n) => n.id !== 'root' && !n.id.startsWith('branch-'));
    const totalIdeas = ideaNodes.length;

    if (totalIdeas === 0) return [];

    // Balance: how evenly distributed are ideas across branches
    const branchCounts = branchNodes.map((bn) => edges.filter((e) => e.source === bn.id).length);
    const maxCount = Math.max(...branchCounts, 1);
    const minCount = Math.min(...branchCounts);
    const avgCount = branchCounts.reduce((s, c) => s + c, 0) / Math.max(branchCounts.length, 1);
    const balanceScore =
      branchCounts.length > 1
        ? Math.max(0, 100 - Math.round(((maxCount - minCount) / Math.max(avgCount, 1)) * 30))
        : 50;

    // Depth: average depth of the tree
    const depths: number[] = [];
    function measureDepth(nodeId: string, depth: number) {
      const children = edges.filter((e) => e.source === nodeId).map((e) => e.target);
      if (children.length === 0) {
        depths.push(depth);
        return;
      }
      for (const cid of children) measureDepth(cid, depth + 1);
    }
    for (const bn of branchNodes) measureDepth(bn.id, 1);
    const avgDepth = depths.length > 0 ? depths.reduce((s, d) => s + d, 0) / depths.length : 0;
    const depthScore = Math.min(100, Math.round(avgDepth * 33));

    // Coverage: % of branches with at least 2 ideas
    const coveredBranches = branchCounts.filter((c) => c >= 2).length;
    const coverageScore = Math.round((coveredBranches / Math.max(branchNodes.length, 1)) * 100);

    // Maturity: % of ideas beyond 'idea' status
    const matureCount = ideaNodes.filter((n) => n.data?.status && n.data.status !== 'idea').length;
    const maturityScore = Math.round((matureCount / Math.max(totalIdeas, 1)) * 100);

    // Connectivity: cross-branch edges
    const crossBranchEdges = edges.filter((e) => {
      const src = nodes.find((n) => n.id === e.source);
      const tgt = nodes.find((n) => n.id === e.target);
      return (
        src &&
        tgt &&
        src.data?.branchKey &&
        tgt.data?.branchKey &&
        src.data.branchKey !== tgt.data.branchKey
      );
    });
    const connectivityScore = Math.min(100, crossBranchEdges.length * 20);

    return [
      {
        key: 'balance',
        labelPl: 'Balans',
        labelEn: 'Balance',
        score: balanceScore,
        detail: isPl ? `Min: ${minCount}, Max: ${maxCount}` : `Min: ${minCount}, Max: ${maxCount}`,
      },
      {
        key: 'depth',
        labelPl: 'Głębokość',
        labelEn: 'Depth',
        score: depthScore,
        detail: isPl
          ? `Śr. głębokość: ${avgDepth.toFixed(1)}`
          : `Avg depth: ${avgDepth.toFixed(1)}`,
      },
      {
        key: 'coverage',
        labelPl: 'Pokrycie',
        labelEn: 'Coverage',
        score: coverageScore,
        detail: isPl
          ? `${coveredBranches}/${branchNodes.length} gałęzi`
          : `${coveredBranches}/${branchNodes.length} branches`,
      },
      {
        key: 'maturity',
        labelPl: 'Dojrzałość',
        labelEn: 'Maturity',
        score: maturityScore,
        detail: isPl
          ? `${matureCount}/${totalIdeas} dojrzałych`
          : `${matureCount}/${totalIdeas} mature`,
      },
      {
        key: 'connectivity',
        labelPl: 'Połączenia',
        labelEn: 'Connectivity',
        score: connectivityScore,
        detail: isPl
          ? `${crossBranchEdges.length} cross-branch`
          : `${crossBranchEdges.length} cross-branch`,
      },
    ];
  }, [edges, isPl, nodes]);

  const overallScore = useMemo(() => {
    if (metrics.length === 0) return 0;
    return Math.round(metrics.reduce((s, m) => s + m.score, 0) / metrics.length);
  }, [metrics]);

  if (!visible || metrics.length === 0) return null;

  const scoreColor =
    overallScore >= 70
      ? 'text-emerald-500'
      : overallScore >= 40
        ? 'text-amber-500'
        : 'text-red-500';
  const ringColor = overallScore >= 70 ? '#34d399' : overallScore >= 40 ? '#fbbf24' : '#ef4444';

  return (
    <div className="absolute top-14 right-3 z-[89]">
      <div className="rounded-2xl bg-white/90 dark:bg-navy-900/90 backdrop-blur-xl border border-slate-200/40 dark:border-navy-700/40 shadow-2xl overflow-hidden min-w-[180px]">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors"
        >
          {/* Mini ring */}
          <svg width={28} height={28} className="transform -rotate-90 shrink-0">
            <circle
              cx={14}
              cy={14}
              r={11}
              fill="none"
              stroke="currentColor"
              strokeWidth={3}
              className="text-slate-200 dark:text-navy-700"
            />
            <circle
              cx={14}
              cy={14}
              r={11}
              fill="none"
              stroke={ringColor}
              strokeWidth={3}
              strokeDasharray={69.1}
              strokeDashoffset={69.1 - (overallScore / 100) * 69.1}
              strokeLinecap="round"
              className="transition-all duration-700"
            />
          </svg>
          <div className="flex-1 text-left">
            <div className="text-[10px] font-bold text-slate-600 dark:text-slate-300">
              {isPl ? 'Zdrowie mapy' : 'Map Health'}
            </div>
            <div className={`text-[13px] font-bold ${scoreColor}`}>{overallScore}%</div>
          </div>
          {expanded ? (
            <ChevronUp size={12} className="text-slate-400" />
          ) : (
            <ChevronDown size={12} className="text-slate-400" />
          )}
        </button>

        {expanded && (
          <div className="px-3 pb-3 space-y-2">
            {metrics.map((m) => {
              const color =
                m.score >= 70 ? 'bg-emerald-500' : m.score >= 40 ? 'bg-amber-500' : 'bg-red-500';
              return (
                <div key={m.key}>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[9px] font-medium text-slate-500 dark:text-slate-400">
                      {isPl ? m.labelPl : m.labelEn}
                    </span>
                    <span className="text-[9px] font-bold text-slate-600 dark:text-slate-300">
                      {m.score}%
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-200 dark:bg-navy-700 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${color} transition-all duration-500`}
                      style={{ width: `${m.score}%` }}
                    />
                  </div>
                  <div className="text-[8px] text-slate-400 mt-0.5">{m.detail}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default MapHealthScore;
