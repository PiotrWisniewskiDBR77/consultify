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

/* ── Per-branch health scoring ─────────────────────────────────────── */

interface BranchHealthResult {
  score: number;
  label: 'healthy' | 'needs-work' | 'empty';
  childCount: number;
  hasNotes: boolean;
  hasEvidence: boolean;
  depthScore: number;
}

function collectDescendants(
  nodeId: string,
  edges: Array<{ source: string; target: string; data?: any }>
): string[] {
  const children = edges
    .filter((e) => e.source === nodeId && (!e.data?.edgeRole || e.data.edgeRole === 'structural'))
    .map((e) => e.target);
  const all: string[] = [...children];
  for (const cid of children) all.push(...collectDescendants(cid, edges));
  return all;
}

export function computeBranchHealth(
  branchNodeId: string,
  nodes: Array<{ id: string; data: any; type?: string }>,
  edges: Array<{ source: string; target: string; data?: any }>
): BranchHealthResult {
  const descendantIds = collectDescendants(branchNodeId, edges);
  const descendants = nodes.filter((n) => descendantIds.includes(n.id));

  const directChildren = edges.filter(
    (e) => e.source === branchNodeId && (!e.data?.edgeRole || e.data.edgeRole === 'structural')
  );
  const childCount = directChildren.length;

  const hasNotes = descendants.some((n) => n.data?.notes && String(n.data.notes).trim().length > 0);
  const hasEvidence = descendants.some(
    (n) => Array.isArray(n.data?.evidenceLinks) && n.data.evidenceLinks.length > 0
  );

  function maxDepth(nodeId: string, currentDepth: number): number {
    const kids = edges
      .filter((e) => e.source === nodeId && (!e.data?.edgeRole || e.data.edgeRole === 'structural'))
      .map((e) => e.target);
    if (kids.length === 0) return currentDepth;
    return Math.max(...kids.map((kid) => maxDepth(kid, currentDepth + 1)));
  }
  const depth = maxDepth(branchNodeId, 0);
  const depthScore = depth >= 3 ? 100 : Math.round((depth / 3) * 100);

  const childScore = childCount === 0 ? 0 : childCount === 1 ? 40 : childCount === 2 ? 70 : 100;
  const notesScore = hasNotes ? 100 : 0;
  const evidenceScore = hasEvidence ? 100 : 0;

  const score = Math.round(
    childScore * 0.3 + notesScore * 0.2 + evidenceScore * 0.2 + depthScore * 0.3
  );

  const label: BranchHealthResult['label'] =
    score >= 70 ? 'healthy' : score >= 30 ? 'needs-work' : 'empty';

  return { score, label, childCount, hasNotes, hasEvidence, depthScore };
}

/* ── BranchHealthDot — small colored indicator ────────────────────── */

export const BranchHealthDot: React.FC<{ score: number; size?: number }> = ({
  score,
  size = 8,
}) => {
  const color = score >= 70 ? 'var(--c-success)' : score >= 30 ? 'var(--c-warning)' : 'var(--c-danger)';
  return (
    <div
      title={`Health: ${score}%`}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        backgroundColor: color,
        flexShrink: 0,
        pointerEvents: 'auto',
      }}
    />
  );
};

/* ── Global MapHealthScore widget ─────────────────────────────────── */

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
      ? 'text-c-success'
      : overallScore >= 40
        ? 'text-c-warning'
        : 'text-c-danger';
  const ringColor = overallScore >= 70 ? 'var(--c-success)' : overallScore >= 40 ? 'var(--c-warning)' : 'var(--c-danger)';

  return (
    <div className="absolute top-14 right-3 z-dropdown">
      <div className="rounded-2xl bg-c-surface-raised dark:bg-c-surface backdrop-blur-xl border border-c-border-subtle dark:border-c-border-subtle shadow-2xl overflow-hidden min-w-[180px]">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-c-surface-raised dark:hover:bg-c-surface-raised transition-colors"
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
              className="text-c-text dark:text-c-text-secondary"
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
            <div className="text-[10px] font-bold text-c-text-secondary dark:text-c-text-muted">
              {isPl ? 'Zdrowie mapy' : 'Map Health'}
            </div>
            <div className={`text-[13px] font-bold ${scoreColor}`}>{overallScore}%</div>
          </div>
          {expanded ? (
            <ChevronUp size={12} className="text-c-text-secondary" />
          ) : (
            <ChevronDown size={12} className="text-c-text-secondary" />
          )}
        </button>

        {expanded && (
          <div className="px-3 pb-3 space-y-2">
            {metrics.map((m) => {
              const color =
                m.score >= 70 ? 'bg-c-success' : m.score >= 40 ? 'bg-c-warning' : 'bg-c-danger';
              return (
                <div key={m.key}>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[9px] font-medium text-c-text-secondary dark:text-c-text-muted">
                      {isPl ? m.labelPl : m.labelEn}
                    </span>
                    <span className="text-[9px] font-bold text-c-text-secondary dark:text-c-text-muted">
                      {m.score}%
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-c-surface-raised dark:bg-c-surface overflow-hidden">
                    <div
                      className={`h-full rounded-full ${color} transition-all duration-500`}
                      style={{ width: `${m.score}%` }}
                    />
                  </div>
                  <div className="text-[8px] text-c-text-secondary mt-0.5">{m.detail}</div>
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
